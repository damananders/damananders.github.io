/* pages/games.js: the game ratings page (/games/). Prefix gm-.
 * Anyone can search and read scores. Rating, reviewing and adding a game are a Discord server perk:
 * visitors sign in with Discord, and a server-side check (Supabase function "verify-member") confirms they
 * are in the server. The database enforces that rule itself, so nothing here is trusted for security.
 * The key below is Supabase's publishable key: it is meant to be public.
 */
import { chipRow, chipSvg, CHIP_WORD, sb, $, el, INVITE, CONSOLES, me, onAuth, authPill, subnav, takeReturn, avatar, nameLink, adminTag, colorClass, memberSince, profileUrl, sfx } from "./games.common.js?v=5";

const say = (msg, bad) => { const s = $("gm-status"); s.textContent = msg || ""; s.classList.toggle("gm-bad", !!bad); };
const slug = (t) => t.normalize("NFKD").replace(/[^\x00-\x7f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

let user = null, member = false, consoleFilter = "", mine = new Map(), reviewCounts = new Map(), searchTimer = 0, lastQuery = "", loadSeq = 0;

/* ---------------- sign-in and membership (shared pill, see games.common.js) ---------------- */
function onSession(m) {
  user = m.user; member = m.member;
  // Discord always lands here; send people back to the Rate-O-Pedia page they signed in from
  if (user) { const back = takeReturn(); if (back && back !== location.pathname + location.search) { location.replace(back); return; } }
  authPill($("gm-auth"));
  load();
  voters();
}

/* ---------------- list ---------------- */
function tabs() {
  const t = $("gm-tabs"); t.replaceChildren();
  for (const c of ["", ...CONSOLES]) {
    t.append(el("button", { class: "gm-tab" + (c === consoleFilter ? " is-on" : ""), "data-c": c || "all", type: "button", "aria-pressed": c === consoleFilter ? "true" : "false",
      text: c || "All", onclick: () => { consoleFilter = c; tabs(); load(); } }));
  }
}
function ratingRow(g) {
  const my = mine.has(g.id) ? mine.get(g.id) : null;
  const row = el("div", { class: "gm-rate", role: "group", "aria-label": "Your rating for " + g.title });
  if (!user || !member) { row.append(el("span", { class: "gm-rate__lock", text: user ? "Join the Discord to rate" : "Sign in to rate" })); return row; }
  return chipRow(my, (v) => rate(g, v), "Your rating for " + g.title);
}
function card(g, rank) {
  const score = g.votes > 0 ? Number(g.average).toFixed(1) + " / 5" : "not rated yet";
  const more = el("div", { class: "gm-more", hidden: true });
  const n = reviewCounts.get(g.id) || 0;
  const toggle = el("button", { class: "gm-toggle", type: "button", "aria-expanded": "false" });
  function sync(open) {
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.replaceChildren(
      el("span", { class: "gm-toggle__i gm-toggle__i--" + (open ? "o" : "x"), "aria-hidden": "true", text: open ? "○" : "✕" }),
      el("span", { class: "gm-toggle__t", text: open ? "Hide reviews" : "Reviews" }),
      el("span", { class: "gm-toggle__n" + (n ? "" : " is-zero"), text: String(n) }));
  }
  sync(false);
  toggle.addEventListener("click", () => { const open = more.hidden; more.hidden = !open; sync(open); if (open) reviews(g, more); });
  const medalCls = rank && rank <= 3 ? " gm-card--" + MEDALS[rank].cls : "";
  const mood = g.votes > 0 ? el("span", { class: "gm-mood rop-chip--" + Math.round(Number(g.average)), title: CHIP_WORD[Math.round(Number(g.average))] }, chipSvg(Math.round(Number(g.average)))) : null;
  const c = el("article", { class: "gm-card" + medalCls + (rank && rank <= 10 ? " gm-card--top10" : "") },
    el("div", { class: "gm-card__top" },
      rank && rank <= 3 ? medal(rank) : (rank ? el("span", { class: "gm-vrank", text: "#" + rank }) : null),
      el("span", { class: "gm-console", "data-c": g.console, text: g.console }),
      el("h3", { class: "gm-title" }, el("a", { class: "gm-title__a", href: "/games/game/?id=" + encodeURIComponent(g.id), title: "Open the info card", text: g.title })),
      rank && rank <= 10 ? el("span", { class: "gm-mustplay", title: "Top 10 on Rate-O-Pedia" }, el("span", { "aria-hidden": "true", text: "★ " }), "Must Play!") : null,
      mood, el("span", { class: "gm-score", text: score }),
      el("span", { class: "gm-votes", text: g.votes === 1 ? "1 vote" : g.votes + " votes" })),
    ratingRow(g), toggle, more);
  c.dataset.id = g.id;
  return c;
}
async function load() {
  const seq = ++loadSeq;
  const q = $("gm-q").value.trim(); lastQuery = q;
  const list = $("gm-list"), head = $("gm-head");
  let req = sb.from("game_scores").select("id,console,title,votes,average");
  if (consoleFilter) req = req.eq("console", consoleFilter);
  if (q.length >= 2) { req = req.ilike("title", "%" + q.replace(/[%_]/g, " ") + "%").order("votes", { ascending: false }).order("title").limit(40); head.textContent = "Results for “" + q + "”"; }
  else { req = req.gt("votes", 0).order("average", { ascending: false }).order("votes", { ascending: false }).limit(25); head.textContent = (consoleFilter || "All-time") + " top rated"; }
  const { data, error } = await req;
  if (seq !== loadSeq) return;                        // a newer load is already on its way
  if (error) { say("Couldn't load the games: " + error.message, true); return; }
  const myMap = new Map();
  if (user && data.length) {
    const r = await sb.from("ratings").select("game_id,stars").in("game_id", data.map((g) => g.id));
    if (seq !== loadSeq) return;
    for (const x of r.data || []) myMap.set(x.game_id, x.stars);
  }
  const counts = new Map();
  if (data.length) {
    const rc = await sb.from("public_reviews").select("game_id").in("game_id", data.map((g) => g.id));
    if (seq !== loadSeq) return;
    for (const x of rc.data || []) counts.set(x.game_id, (counts.get(x.game_id) || 0) + 1);
  }
  mine = myMap; reviewCounts = counts;               // publish both only once this load is the live one
  const ranked = q.length < 2;   // the top-rated list (not search results) gets medals and Must Play! flair
  list.replaceChildren(...data.map((g, i) => card(g, ranked ? i + 1 : 0)));
  if (!data.length) list.append(el("p", { class: "gm-empty", text: q.length >= 2 ? "No game by that name in the list yet." : "No ratings here yet. Search for a game and be the first." }));
  addBox(q, data);
}
async function rate(g, stars) {
  say("");
  const res = stars == null
    ? await sb.from("ratings").delete().eq("user_id", user.id).eq("game_id", g.id)
    : await sb.from("ratings").upsert({ user_id: user.id, game_id: g.id, stars, updated_at: new Date().toISOString() });
  if (res.error) { say("That vote didn't save: " + res.error.message, true); return; }
  if (window.Site && Site.sfx) try { Site.sfx("success"); } catch (e) {}
  load();
  voters();
}

/* ---------------- reviews ---------------- */
async function reviews(g, box) {
  box.replaceChildren(el("p", { class: "gm-empty", text: "Loading…" }));
  const { data } = await sb.from("public_reviews").select("*").eq("game_id", g.id).order("created_at", { ascending: false }).limit(20);
  box.replaceChildren();
  for (const r of data || []) {
    const head = el("header", { class: "gm-review__head" }, avatar(r.avatar, r.name, 32), el("span", { class: "gm-review__who" }, nameLink(r.handle, r.name || "A member"), r.is_staff ? adminTag() : null,
      el("span", { class: "gm-review__when", text: new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) })),
      r.stars != null ? el("span", { class: "gm-review__mood rop-chip--" + r.stars, title: r.stars + " / 5 · " + CHIP_WORD[r.stars] }, chipSvg(r.stars), el("b", { text: String(r.stars) })) : null);
    const art = el("article", { class: "gm-review" + (r.stars != null ? " gm-review--s" + r.stars : "") }, head, el("p", { class: "gm-review__body", text: r.body }));
    if (member && r.id != null && me.ready) art.append(el("button", { class: "linkbtn gm-report", type: "button", text: "Report", onclick: (e) => report({ review_id: r.id }, e.target) }));
    box.append(art);
  }
  if (!(data || []).length) box.append(el("p", { class: "gm-empty", text: "No reviews yet." }));
  writeBox(g, box, data || []);
}

/* Your own review: a write box if you haven't reviewed the game yet, otherwise your review read-only with an Edit button. */
async function writeBox(g, box, shown) {
  if (!user) { box.append(el("p", { class: "gm-note", text: "Sign in with Discord to write a review." })); return; }
  if (!member) { box.append(el("p", { class: "gm-note", text: "Join the Discord server to write reviews." })); return; }
  const wrap = el("div", { class: "gm-write" });
  box.append(wrap);
  let mineRow = null;
  const r = await sb.rpc("my_review", { p_game: g.id });
  if (!r.error && r.data && r.data.length) mineRow = r.data[0];
  else if (r.error && me.profile && me.profile.handle) {         // database update not run yet: find it among the shown reviews
    const hit = shown.find((x) => x.handle === me.profile.handle);
    if (hit) mineRow = { body: hit.body, created_at: hit.created_at, hidden: false };
  }
  const note = el("p", { class: "gm-note", role: "status" });
  const ta = el("textarea", { class: "gm-ta", maxlength: "1000", rows: "3", placeholder: "A few words about this game", "aria-label": "Your review of " + g.title });
  const count = el("span", { class: "gm-write__count", text: "0 / 1000" });
  ta.addEventListener("input", () => { count.textContent = ta.value.length + " / 1000"; });
  const send = el("button", { class: "btn gm-btn", type: "button" });

  function showMine() {
    ta.value = mineRow.body; ta.disabled = true; ta.readOnly = true; count.textContent = mineRow.body.length + " / 1000";
    send.textContent = "Edit review"; send.onclick = startEdit;
    wrap.replaceChildren(el("p", { class: "gm-write__h", text: "Your review" + (mineRow.hidden ? " (hidden by a moderator)" : "") }), ta,
      el("div", { class: "gm-write__bar" }, send, count), note);
  }
  function startEdit() {
    ta.disabled = false; ta.readOnly = false; ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    send.textContent = "Save changes"; send.onclick = save;
    const cancel = el("button", { class: "linkbtn gm-cancel", type: "button", text: "Cancel", onclick: () => { note.textContent = ""; showMine(); } });
    wrap.querySelector(".gm-write__bar").insertBefore(cancel, count);
  }
  async function save() {
    const body = ta.value.trim(); if (body.length < 3) { note.textContent = "Write a little more first."; return; }
    send.disabled = true;
    const { error } = await sb.rpc("edit_my_review", { p_game: g.id, p_body: body });
    send.disabled = false;
    if (error) { note.textContent = /edit_my_review|function|schema cache/i.test(error.message) ? "Editing needs the latest database update. The owner has to run it first." : "That didn't save: " + error.message; return; }
    mineRow.body = body; note.textContent = "Saved. Your review is updated."; reviews(g, box);
  }
  async function create() {
    const body = ta.value.trim(); if (body.length < 3) { note.textContent = "Write a little more first."; return; }
    send.disabled = true;
    const { error } = await sb.from("reviews").insert({ user_id: user.id, game_id: g.id, body });
    send.disabled = false;
    if (error) {
      if (error.code === "23505") { note.textContent = "You've already reviewed this game. Use Edit review to change it."; reviews(g, box); return; }
      note.textContent = "That didn't send: " + error.message; return;
    }
    if (window.Site && Site.sfx) try { Site.sfx("success"); } catch (e) {}
    reviewCounts.set(g.id, (reviewCounts.get(g.id) || 0) + 1);
    reviews(g, box);
  }
  if (mineRow) showMine();
  else {
    send.textContent = "Send review"; send.onclick = create;
    wrap.replaceChildren(el("p", { class: "gm-write__h", text: "Write a review" }), ta, el("div", { class: "gm-write__bar" }, send, count), note);
  }
}

async function report(target, btn) {
  const reason = prompt("What's wrong with it? (optional)") ;
  if (reason === null) return;
  const { error } = await sb.from("forum_reports").insert({ user_id: user.id, reason: reason.trim().slice(0, 300) || null, ...target });
  btn.textContent = error ? "Couldn't report" : "Reported";
  btn.disabled = true;
}

/* ---------------- add a missing game ---------------- */
function addBox(q, data) {
  const box = $("gm-add"); box.replaceChildren();
  if (q.length < 2 || !user || !member) return;
  if (data.some((g) => g.title.toLowerCase() === q.toLowerCase())) return;
  const sel = el("select", { class: "gm-sel", "aria-label": "Console" }, ...CONSOLES.map((c) => el("option", { value: c, text: c, selected: c === (consoleFilter || "PS3") })));
  const note = el("p", { class: "gm-note", role: "status" });
  box.append(el("p", { class: "gm-add__line", text: "Can't find it? Add “" + q + "” to the list:" }), sel,
    el("button", { class: "btn gm-btn", type: "button", text: "Add this game", onclick: async () => {
      const s = slug(q); if (!s) { note.textContent = "That name needs some letters or numbers."; return; }
      const id = sel.value + ":" + s + "-m" + Math.random().toString(36).slice(2, 6);
      const { error } = await sb.from("games").insert({ id, console: sel.value, title: q.slice(0, 120), added_by: user.id });
      note.textContent = error ? "That didn't work: " + error.message : "Added — it's in the list now. Search for it to rate it.";
    } }), note);
}

/* ---------------- leaderboard: top voters, medals, mottos ----------------
 * Rows come from the public voter_stats view (names, pictures, mottos and counts only, never account ids).
 * Until that view exists the section falls back to reviewers, from the public reviews.
 * #1 / #2 / #3 wear gold / silver / bronze medal flair. The right side of each row is the member's motto in the
 * colour they chose on their profile. The earned badges live inside the opened row. */
const BADGES = {
  topVoter:  { g: "△", c: "tri", name: "Top Voter",    why: "more votes than anyone else" },
  topCritic: { g: "○", c: "cir", name: "Top Critic",   why: "more reviews than anyone else" },
  founder:   { g: "✕", c: "crs", name: "First In",     why: "cast the very first vote" },
  early:     { g: "✕", c: "crs", name: "Early Bird",   why: "one of the first ten voters" },
  founderR:  { g: "✕", c: "crs", name: "First In",     why: "wrote the very first review" },
  earlyR:    { g: "✕", c: "crs", name: "Early Bird",   why: "one of the first ten reviewers" },
  c100:      { g: "□", c: "sqr", name: "Centurion",    why: "100 or more votes" },
  c50:       { g: "□", c: "sqr", name: "Half-Century", why: "50 or more votes" },
  c10:       { g: "□", c: "sqr", name: "Regular",      why: "10 or more votes" },
  writer:    { g: "○", c: "cir", name: "Wordsmith",    why: "5 or more reviews" },
  generous:  { g: "△", c: "tri", name: "Big Heart",    why: "handed out 10 or more perfect 5/5 scores" },
  tough:     { g: "△", c: "tri", name: "Tough Crowd",  why: "gave 3 or more 0/5 scores" },
};
function badgesFor(v, ctx) {
  const b = [];
  if (ctx.full && v.votes > 0 && v.votes === ctx.maxVotes) b.push("topVoter");
  if (v.reviews > 0 && v.reviews === ctx.maxReviews) b.push("topCritic");
  if (v.first && v.first === ctx.firstAt) b.push(ctx.full ? "founder" : "founderR"); else if (ctx.early.has(v.name)) b.push(ctx.full ? "early" : "earlyR");
  if (ctx.full) { if (v.votes >= 100) b.push("c100"); else if (v.votes >= 50) b.push("c50"); else if (v.votes >= 10) b.push("c10"); }
  if (v.reviews >= 5) b.push("writer");
  if (v.fives >= 10) b.push("generous");
  if (v.zeros >= 3) b.push("tough");
  return b;
}
const vb = (k) => el("span", { class: "gm-vb gm-vb--" + BADGES[k].c, "aria-hidden": "true", text: BADGES[k].g });

const MEDALS = [null, { cls: "gold", label: "Gold medal, first place" }, { cls: "silver", label: "Silver medal, second place" }, { cls: "bronze", label: "Bronze medal, third place" }];
let medalN = 0;
function medal(place) {
  const m = MEDALS[place], id = "gmm" + (++medalN);
  const w = document.createElement("span");
  w.className = "gm-medal gm-medal--" + m.cls; w.setAttribute("role", "img"); w.setAttribute("aria-label", m.label); w.title = m.label;
  // ribbon + struck medal, drawn here so it stays sharp at any size; colours come from the CSS custom properties
  w.innerHTML = '<svg viewBox="0 0 40 48" aria-hidden="true">'
    + '<path d="M9 0h9l5 15h-9z" fill="var(--rib-a)"/><path d="M31 0h-9l-5 15h9z" fill="var(--rib-b)"/>'
    + '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--m-hi)"/><stop offset=".5" stop-color="var(--m-mid)"/><stop offset="1" stop-color="var(--m-lo)"/></linearGradient></defs>'
    + '<circle cx="20" cy="31" r="15" fill="url(#' + id + ')" stroke="var(--m-edge)" stroke-width="1.6"/>'
    + '<circle cx="20" cy="31" r="11" fill="none" stroke="var(--m-edge)" stroke-opacity=".55" stroke-width="1"/>'
    + '<text x="20" y="36" text-anchor="middle" font-size="13" font-weight="800" fill="var(--m-ink)" font-family="Space Grotesk,system-ui,sans-serif">' + place + '</text></svg>';
  return w;
}

let votersBusy = false;
async function voters() {
  const box = $("gm-voters"); if (!box || votersBusy) return;
  votersBusy = true;
  try {
    let rows = [], full = true;
    const r = await sb.from("voter_stats").select("*").order("votes", { ascending: false }).limit(200);
    if (!r.error && Array.isArray(r.data)) rows = r.data.map((x) => ({ handle: x.handle || null, staff: !!x.is_staff, name: x.name, avatar: x.avatar, motto: x.motto || "", color: x.motto_color || "white", since: x.member_since || null,
      votes: +x.votes || 0, reviews: +x.reviews || 0, fives: +x.fives || 0, zeros: +x.zeros || 0, first: x.first_vote, last: x.last_vote }));
    else {
      full = false;
      const pr = await sb.from("public_reviews").select("*").limit(5000);
      if (pr.error || !Array.isArray(pr.data)) { box.hidden = true; return; }
      const m = new Map();
      for (const x of pr.data) {
        if (!x.name) continue;
        const v = m.get(x.name) || { handle: x.handle || null, staff: !!x.is_staff, name: x.name, avatar: x.avatar, motto: "", color: "white", votes: 0, reviews: 0, fives: 0, zeros: 0, first: x.created_at, last: x.created_at };
        v.reviews++; if (x.created_at < v.first) v.first = x.created_at; if (x.created_at > v.last) v.last = x.created_at;
        m.set(x.name, v);
      }
      rows = [...m.values()].sort((a, b) => b.reviews - a.reviews || String(a.first).localeCompare(String(b.first)));
    }
    rows = rows.filter((v) => v.name);
    if (!rows.length) { box.hidden = true; return; }
    const byFirst = rows.filter((v) => v.first).sort((a, b) => String(a.first).localeCompare(String(b.first)));
    const ctx = { full, maxVotes: Math.max(0, ...rows.map((v) => v.votes)), maxReviews: Math.max(0, ...rows.map((v) => v.reviews)), firstAt: byFirst.length ? byFirst[0].first : null, early: new Set(byFirst.slice(0, 10).map((v) => v.name)) };
    const fmt = (s) => { const d = s ? new Date(s) : null; return d && !isNaN(d) ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"; };
    const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");
    const SHOW = 12, list = el("div", { class: "gm-vlist" });
    rows.forEach((v, i) => {
      const place = i + 1, bs = badgesFor(v, ctx);
      const counts = full ? plural(v.votes, "vote") + (v.reviews ? " · " + plural(v.reviews, "review") : "") : plural(v.reviews, "review");
      const stats = [];
      const stat = (k, val) => stats.push(el("dt", { text: k }), el("dd", { text: String(val) }));
      if (v.since) stat("Member since", memberSince(v.since));
      if (full) stat("Votes", v.votes);
      stat("Reviews", v.reviews);
      if (full) { stat("Perfect 5/5s", v.fives); stat("0/5s", v.zeros); }
      stat(full ? "First vote" : "First review", fmt(v.first));
      stat(full ? "Latest vote" : "Latest review", fmt(v.last));
      const medalCls = place <= 3 ? " gm-vcard--" + MEDALS[place].cls : "";
      list.append(el("details", { class: "gm-vcard" + medalCls + (i >= SHOW ? " gm-vcard--more" : "") },
        el("summary", null,
          place <= 3 ? medal(place) : el("span", { class: "gm-vrank", text: "#" + place }),
          avatar(v.avatar, v.name, place <= 3 ? 42 : 36, "gm-vav"),
          el("span", { class: "gm-vwho" },
            el("span", { class: "gm-vname" }, v.name, v.staff ? adminTag() : null),
            el("span", { class: "gm-vcount", text: counts })),
          v.motto ? el("span", { class: "gm-vmotto " + colorClass(v.color), title: v.motto, text: "“" + v.motto + "”" }) : el("span", { class: "gm-vmotto gm-vmotto--none" })),
        el("div", { class: "gm-vprofile" },
          el("dl", null, ...stats),
          bs.length
            ? el("ul", { class: "gm-vblist" }, ...bs.map((k) => el("li", null, vb(k), el("b", { text: BADGES[k].name }), " — " + BADGES[k].why)))
            : el("p", { class: "gm-note", text: "No badges yet. Keep rating." }),
          v.handle ? el("a", { class: "linkbtn gm-vopen", href: profileUrl(v.handle), text: "Open full profile →" }) : null)));
    });
    const more = rows.length > SHOW ? el("button", { class: "linkbtn gm-vmore", type: "button", text: "Show all " + rows.length, onclick: () => { box.classList.add("gm-voters--all"); more.remove(); } }) : null;
    box.classList.remove("gm-voters--all");
    box.replaceChildren(
      el("h2", { class: "gm-head", text: "Leaderboard" }),
      el("p", { class: "gm-note", text: full ? "The Discord members who rate the most. Open a row for their stats and badges." : "The members who've written reviews. Open a row for their stats and badges." }),
      list);
    if (more) box.append(more);
    box.hidden = false;
  } catch (e) { /* the leaderboard is extra; never let it break the page */ }
  finally { votersBusy = false; }
}

/* ---------------- start ---------------- */
// Deep link from the hub's "Top rated" cards: /games/?q=Title opens the list already searched.
try { const q0 = new URLSearchParams(location.search).get("q"); if (q0) $("gm-q").value = q0.slice(0, 80); } catch (e) {}
tabs();
$("gm-q").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(load, 250); });
subnav($("rop-tabs"), "ratings");
onAuth(onSession);
