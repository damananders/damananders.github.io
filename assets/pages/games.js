/* pages/games.js: the game ratings page (/games/). Prefix gm-.
 * Anyone can search and read scores. Rating, reviewing and adding a game are a Discord server perk:
 * visitors sign in with Discord, and a server-side check (Supabase function "verify-member") confirms they
 * are in the server. The database enforces that rule itself, so nothing here is trusted for security.
 * The key below is Supabase's publishable key: it is meant to be public.
 */
import { chipRow, chipSvg, CHIP_WORD, sb, $, el, INVITE, CONSOLES, me, onAuth, authPill, subnav, takeReturn, avatar, nameLink, adminTag, colorClass, memberSince, profileUrl, sfx, consoleChip, PLATFORMS, FAMILIES, FAMILY, platformName, PLATFORM, reactBar, myReactions, platformUrl, compareUrl, gameUrl, platformLink, scoreCols, hasOpenScores, scorePair, guestRatings, guestRate, VISITOR_NOTE, titleSearch , reportBtn , artSlot , hasSearchKey , statsChanged, fmtWhen, CHIPPER, gameInfo, hoverCard, sortReviews, reviewSort, reviewSortPicker, richText, fmtBar, reviewsPanel } from "./games.common.js?v=30";

const say = (msg, bad) => { const s = $("gm-status"); s.textContent = msg || ""; s.classList.toggle("gm-bad", !!bad); };
const slug = (t) => t.normalize("NFKD").replace(/[^\x00-\x7f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

let user = null, member = false, consoleFilter = "", famFilter = "", mine = new Map(), reviewCounts = new Map(), searchTimer = 0, lastQuery = "", loadSeq = 0, rankBy = "verified";

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
  // row 1: platform families; row 2: the platforms in the chosen family
  const row1 = el("div", { class: "gm-tabrow gm-tabrow--fam" });
  for (const [k, name, color] of [["", "All", ""], ...FAMILIES]) {
    const on = k === famFilter;
    row1.append(el("button", { class: "gm-tab gm-tab--fam" + (on ? " is-on" : ""), "data-c": k || "all", style: color ? "--fc:" + color : null, type: "button", "aria-pressed": on ? "true" : "false",
      text: name, onclick: () => { famFilter = k; consoleFilter = ""; tabs(); load(); } }));
  }
  t.append(row1);
  if (famFilter) {
    const row2 = el("div", { class: "gm-tabrow gm-tabrow--plat" });
    const list = PLATFORMS.filter((p) => p.fam === famFilter);
    for (const p of [{ id: "", name: "All " + FAMILY[famFilter].name }, ...list]) {
      const on = p.id === consoleFilter;
      row2.append(el("button", { class: "gm-tab gm-tab--plat" + (on ? " is-on" : ""), "data-c": p.id || "all", "data-f": famFilter, type: "button", "aria-pressed": on ? "true" : "false",
        text: p.name, onclick: () => { consoleFilter = p.id; tabs(); load(); } }));
    }
    t.append(row2);
  }
  t.append(el("p", { class: "gm-hubrow" }, consoleFilter
    ? el("a", { class: "linkbtn gm-hublink", href: platformUrl(consoleFilter), text: "Open the " + platformName(consoleFilter) + " hub →" })
    : el("a", { class: "linkbtn gm-hublink", href: "/games/platform/" + (famFilter ? "?f=" + famFilter : ""), text: famFilter ? "All " + FAMILY[famFilter].name + " hubs →" : "Platform hubs →" }),
    el("a", { class: "linkbtn gm-hublink", href: compareUrl(), text: "Compare two games →" }),
    el("a", { class: "linkbtn gm-hublink", href: "/games/lists/", text: "Game lists →" })));
}
const filterIds = () => consoleFilter ? [consoleFilter] : famFilter ? PLATFORMS.filter((p) => p.fam === famFilter).map((p) => p.id) : null;
const filterName = () => consoleFilter ? platformName(consoleFilter) : famFilter ? FAMILY[famFilter].name : "All-time";
function ratingRow(g) {
  const my = mine.has(g.id) ? mine.get(g.id) : null;
  const row = el("div", { class: "gm-rate", role: "group", "aria-label": "Your rating for " + g.title });
  if (!user || !member) {
    if (g.open_votes === undefined) { row.append(el("span", { class: "gm-rate__lock", text: user ? "Join the Discord to rate" : "Sign in to rate" })); return row; }
    // visitors (and signed-in non-members) rate too; their vote only counts toward the Open-Vote score
    return el("div", { class: "gm-rate gm-rate--guest" }, chipRow(my, (v) => rateGuest(g, v), "Your visitor rating for " + g.title), el("span", { class: "gm-rate__hint", text: VISITOR_NOTE }));
  }
  return chipRow(my, (v) => rate(g, v), "Your rating for " + g.title);
}
/* search results: the same title on several platforms (PC, Mac, Linux...) shows once, with chips to switch */
const sameKey = (t) => String(t || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
function groupSame(rows) {
  const out = [], at = new Map();
  for (const g of rows) {
    const k = sameKey(g.title), i = at.get(k);
    if (i === undefined) { at.set(k, out.length); out.push([g]); } else out[i].push(g);
  }
  return out;
}
function altRow(group, cur, swap) {
  if (group.length < 2) return null;
  return el("div", { class: "gm-alts", role: "group", "aria-label": "Platforms" }, el("span", { class: "gm-alts__l", text: "On:" }),
    ...group.map((x) => el("button", { class: "gm-alts__b" + (x === cur ? " is-on" : ""), type: "button", "aria-pressed": String(x === cur), title: platformName(x.console) + (x.votes ? " · " + x.votes + (x.votes === 1 ? " vote" : " votes") : ""),
      text: x.console, onclick: () => { if (x !== cur) swap(x); } })));
}
function card(g, rank, group) {
  const score = g.votes > 0 ? Number(g.average).toFixed(1) + " / 5" : "not rated yet";
  const more = el("div", { class: "gm-more", hidden: true });
  const n = reviewCounts.get(g.id) || 0;
  const toggle = el("button", { class: "gm-toggle", type: "button", "aria-expanded": "false" });
  function sync(open) {
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.replaceChildren(
      ico("talk", "gm-toggle__i" + (open ? " is-open" : "")),
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
      artSlot(g.id, g.title, "gm-art"),
      platformLink(g.console),
      el("h3", { class: "gm-title" }, el("a", { class: "gm-title__a", href: "/games/game/?id=" + encodeURIComponent(g.id), title: "Open the info card", text: g.title })),
      rank && rank <= 10 ? el("span", { class: "gm-mustplay", title: "Top 10 on Rate-O-Pedia · Fromie approved" }, Object.assign(chipSvg(5), { className: "rop-chip__svg gm-mustplay__chip" }), "Must Play!") : null,
      g.open_votes === undefined ? mood : null, g.open_votes === undefined ? el("span", { class: "gm-score", text: score }) : null,
      g.open_votes === undefined ? el("span", { class: "gm-votes", text: g.votes === 1 ? "1 vote" : g.votes + " votes" }) : null,
      el("a", { class: "gm-expand", href: "/games/game/?id=" + encodeURIComponent(g.id), title: "Open the full game page", "aria-label": "Open the full page for " + g.title,
        html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>' })),
    g.open_votes === undefined ? null : el("div", { class: "gm-card__scores" }, mood, scorePair(g)),
    altRow(group || [g], g, (x) => c.replaceWith(card(x, rank, group))),
    ratingRow(g), toggle, more);
  c.dataset.id = g.id;
  // a one-line blurb under the name and "(year)" beside it, from the site's game info (Wikipedia / Wikidata)
  const blurb = el("p", { class: "gm-blurb", hidden: true });
  c.querySelector(".gm-card__top").after(blurb);
  gameInfo(g.id).then((x) => {
    if (x && x.y) c.querySelector(".gm-title").append(el("span", { class: "gm-year", text: " (" + x.y + ")" }));
    const d = x && typeof x.d === "string" ? x.d.trim() : "";
    if (d) { const one = (d.match(/^.{40,220}?[.!?](\s|$)/) || [d.slice(0, 200) + (d.length > 200 ? "…" : "")])[0].trim(); blurb.textContent = one; blurb.title = d.slice(0, 600); blurb.hidden = false; }
  }, () => {});
  c._redraw = (x) => { const open = !more.hidden; const n2 = card(x, rank, group); c.replaceWith(n2); if (open) n2.querySelector(".gm-toggle").click(); };
  return c;
}
async function load() {
  const seq = ++loadSeq;
  const q = $("gm-q").value.trim(); lastQuery = q;
  const list = $("gm-list"), head = $("gm-head");
  const cols = await scoreCols();
  if (seq !== loadSeq) return;
  const open = rankBy === "open" && cols.includes("open_votes");
  let req = sb.from("game_scores").select(cols);
  const ids = filterIds();
  if (ids) req = ids.length === 1 ? req.eq("console", ids[0]) : req.in("console", ids);
  if (q.length >= 2) { await hasSearchKey(); req = titleSearch(req, q).order("votes", { ascending: false }).order("title").limit(90); head.textContent = "Results for “" + q + "”"; }
  else if (open) { req = req.gt("open_votes", 0).order("open_average", { ascending: false }).order("open_votes", { ascending: false }).limit(25); head.textContent = filterName() + " top rated · Open-Vote"; }
  else { req = req.gt("votes", 0).order("average", { ascending: false }).order("votes", { ascending: false }).limit(25); head.textContent = filterName() + " top rated" + (cols.includes("open_votes") ? " · Verified" : ""); }
  rankSwitch(q.length < 2 && cols.includes("open_votes"));
  const { data, error } = await req;
  if (seq !== loadSeq) return;                        // a newer load is already on its way
  if (error) { say("Couldn't load the games: " + error.message, true); return; }
  const myMap = new Map();
  if (user && member && data.length) {
    const r = await sb.from("ratings").select("game_id,stars").in("game_id", data.map((g) => g.id));
    if (seq !== loadSeq) return;
    for (const x of r.data || []) myMap.set(x.game_id, x.stars);
  } else if (data.length && cols.includes("open_votes")) {
    const r = await guestRatings(data.map((g) => g.id));
    if (seq !== loadSeq) return;
    for (const [k, v] of r) myMap.set(k, v);
  }
  const counts = new Map();
  if (data.length) {
    const rc = await sb.from("public_reviews").select("game_id").in("game_id", data.map((g) => g.id));
    if (seq !== loadSeq) return;
    for (const x of rc.data || []) counts.set(x.game_id, (counts.get(x.game_id) || 0) + 1);
  }
  mine = myMap; reviewCounts = counts;               // publish both only once this load is the live one
  const ranked = q.length < 2;   // the top-rated list (not search results) gets medals and Must Play! flair
  if (ranked) list.replaceChildren(...data.map((g, i) => card(g, i + 1)));
  else list.replaceChildren(...groupSame(data).slice(0, 40).map((grp) => card(grp[0], 0, grp)));
  if (!data.length) list.append(el("p", { class: "gm-empty", text: q.length >= 2 ? "No game by that name in the list yet." : "No ratings here yet. Search for a game and be the first." }));
  addBox(q, data);
  browse(q);
}

/* ---------------- browse A-Z and a "Surprise me" slot (for the chosen family / platform, or everything) ----------------
 * Left: letter tiles and a shelf of game rows with little covers. Right: the Surprise me card, which rolls a random
 * game IN PLACE (cover, year, blurb, scores) so you can keep rolling before you open one. */
let browseKey = "", browseLetter = "", browseFrom = 0;
const blurbOf = (x) => { const d = x && typeof x.d === "string" ? x.d.trim() : ""; return d ? (d.match(/^.{40,240}?[.!?](\s|$)/) || [d.slice(0, 200) + "…"])[0].trim() : ""; };
function browse(q) {
  const box = $("gm-browse"); if (!box) return;
  if (q.length >= 2) { box.replaceChildren(); browseKey = ""; return; }
  const key = famFilter + "|" + consoleFilter;
  if (key === browseKey && box.childElementCount) return;
  browseKey = key; browseLetter = "A"; browseFrom = 0;
  const where = filterName() === "All-time" ? "every game" : filterName();
  const letters = el("div", { class: "gm-az", role: "group", "aria-label": "First letter" });
  const list = el("ol", { class: "gm-blist" });
  const more = el("button", { class: "btn gm-btn gm-bmore", type: "button", hidden: true, text: "Show more", onclick: () => page(false) });
  const note = el("p", { class: "gm-note", role: "status" });
  const count = el("span", { class: "gm-browse__count" });
  for (const L of ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"]) letters.append(el("button", { class: "gm-az__b", type: "button", text: L, "aria-pressed": String(L === browseLetter),
    onclick: (e) => { letters.querySelectorAll(".gm-az__b").forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget))); browseLetter = L; browseFrom = 0; page(true); } }));
  /* Surprise me card */
  const sView = el("div", { class: "gm-sup__view" },
    el("div", { class: "gm-sup__idle" }, el("span", { class: "gm-sup__dice", "aria-hidden": "true", text: "🎲" }),
      el("p", { text: "Can't pick? Roll a random game from " + where + ". Keep rolling till one grabs you." })));
  const sBtn = el("button", { class: "btn gm-btn gm-sup__roll", type: "button", onclick: roll }, el("span", { "aria-hidden": "true", class: "gm-sup__die", text: "🎲" }), el("span", { class: "gm-sup__lbl", text: "Surprise me" }));
  const sup = el("aside", { class: "gm-sup", "aria-label": "Surprise me", "aria-live": "polite" },
    el("div", { class: "gm-sup__head" }, el("b", { text: "Surprise me" }), el("small", { text: "a random pick" })), sView, sBtn);
  box.replaceChildren(
    el("div", { class: "gm-browse__head" },
      el("div", null, el("h2", { class: "gm-head", text: "Browse " + where }), count),
      el("p", { class: "gm-browse__sub", text: "Pick a letter to flip through the shelf. Hover a title for a quick peek." })),
    el("div", { class: "gm-browse__grid" },
      el("div", { class: "gm-browse__main" }, letters, list, more, note), sup));
  idsCount().then((n) => { if (n) count.textContent = n.toLocaleString() + (n === 1 ? " game" : " games"); });
  page(true);
  function scoped(req) { const ids = filterIds(); return ids ? (ids.length === 1 ? req.eq("console", ids[0]) : req.in("console", ids)) : req; }
  async function idsCount() { try { const { count: n } = await scoped(sb.from("game_scores").select("id", { count: "exact", head: true })); return n || 0; } catch (e) { return 0; } }
  async function page(fresh) {
    let req = scoped(sb.from("game_scores").select(await scoreCols()));
    req = browseLetter === "#" ? req.filter("title", "match", "^[^A-Za-z]") : req.ilike("title", browseLetter + "%");
    const { data, error } = await req.order("title").range(browseFrom, browseFrom + 59);
    if (error) { note.textContent = "Couldn't load that list: " + error.message; return; }
    if (fresh) list.replaceChildren();
    for (const g of data || []) list.append(el("li", { class: "gm-brow" },
      el("span", { class: "gm-brow__art" }, artSlot(g.id, g.title, "gm-brow__img"), el("span", { class: "gm-brow__ph", text: g.title.charAt(0) })),
      el("span", { class: "gm-brow__mid" }, hoverCard(el("a", { class: "gm-brow__t", href: gameUrl(g.id), text: g.title }), "game", g.id),
        el("span", { class: "gm-brow__meta" }, consoleChip(g.console),
          g.open_votes === undefined ? el("span", { class: "gm-brow__s", text: g.votes > 0 ? Number(g.average).toFixed(1) + " / 5" : "not rated" }) : scorePair(g, true)))));
    browseFrom += (data || []).length;
    more.hidden = (data || []).length < 60;
    note.textContent = fresh && !(data || []).length ? "No games starting with " + browseLetter + " here." : "";
  }
  let total = 0, rolling = false;
  async function roll() {
    if (rolling) return; rolling = true; sup.classList.add("is-rolling"); sBtn.disabled = true;
    try {
      if (!total) total = await idsCount();
      if (!total) { sView.replaceChildren(el("p", { class: "gm-note", text: "No games here yet." })); return; }
      const off = Math.floor(Math.random() * total);
      const [{ data }] = await Promise.all([scoped(sb.from("game_scores").select(await scoreCols())).order("id").range(off, off), new Promise((r) => setTimeout(r, 450))]);
      const g = data && data[0]; if (!g) return;
      const x = await gameInfo(g.id).catch(() => null), blurb = blurbOf(x);
      const art = el("div", { class: "gm-sup__art" }, artSlot(g.id, g.title, "gm-sup__img"), chipSvg(g.votes ? Math.round(Number(g.average)) : 3));
      sView.replaceChildren(el("div", { class: "gm-sup__pick" }, art,
        el("div", { class: "gm-sup__info" },
          el("div", { class: "gm-sup__top" }, consoleChip(g.console), x && x.y ? el("span", { class: "gm-year", text: String(x.y) }) : null),
          el("a", { class: "gm-sup__t", href: gameUrl(g.id), text: g.title }),
          blurb ? el("p", { class: "gm-sup__d", text: blurb }) : null,
          g.open_votes === undefined ? el("span", { class: "gm-brow__s", text: g.votes > 0 ? Number(g.average).toFixed(1) + " / 5" : "Not rated yet. Be the first!" }) : scorePair(g, true),
          el("a", { class: "gm-sup__go", href: gameUrl(g.id), text: "Open this game →" }))));
      sBtn.querySelector(".gm-sup__lbl").textContent = "Roll again";
    } finally { rolling = false; sup.classList.remove("is-rolling"); sBtn.disabled = false; }
  }
}
async function rate(g, stars) {
  say("");
  const res = stars == null
    ? await sb.from("ratings").delete().eq("user_id", user.id).eq("game_id", g.id)
    : await sb.from("ratings").upsert({ user_id: user.id, game_id: g.id, stars, updated_at: new Date().toISOString() });
  if (res.error) { say("That vote didn't save: " + res.error.message, true); return; }
  if (window.Site && Site.sfx) try { Site.sfx("success"); } catch (e) {} statsChanged();
  if (stars == null) mine.delete(g.id); else mine.set(g.id, stars);
  refreshCard(g);
  voters();
}
/* after a vote only that card updates (new scores, your chip lit); the list order changes on the next load or refresh */
async function refreshCard(g) {
  const cols = await scoreCols();
  const { data } = await sb.from("game_scores").select(cols).eq("id", g.id).maybeSingle();
  const x = Object.assign({}, g, data || {});
  document.querySelectorAll("#gm-list .gm-card").forEach((c) => { if (c.dataset.id === g.id && c._redraw) c._redraw(x); });
}

async function rateGuest(g, stars) {
  say("");
  try { await guestRate(g.id, stars); } catch (e) { say("That vote didn't save: " + e.message, true); return; }
  if (window.Site && Site.sfx) try { Site.sfx("success"); } catch (e) {}
  if (stars == null) mine.delete(g.id); else mine.set(g.id, stars);
  refreshCard(g);
}
/* the top-rated list can rank by either score */
function rankSwitch(show) {
  let sw = $("gm-rankby");
  if (!show) { if (sw) sw.hidden = true; return; }
  if (!sw) { sw = el("div", { id: "gm-rankby", class: "gm-rankby", role: "group", "aria-label": "Rank by" }); $("gm-head").after(sw); }
  sw.hidden = false;
  sw.replaceChildren(el("span", { class: "gm-note", text: "Rank by" }),
    ...[["verified", "✔ Verified", "Discord members' votes only"], ["open", "🌐 Open-Vote", "Members and visitors together"]].map(([k, label, tip]) =>
      el("button", { class: "gm-tab" + (rankBy === k ? " is-on" : ""), type: "button", title: tip, "aria-pressed": rankBy === k ? "true" : "false", text: label, onclick: () => { if (rankBy !== k) { rankBy = k; load(); } } })));
}

/* ---------------- reviews (the panel itself lives in games.common.js so the game page shares it) ---------------- */
function reviews(g, box) { return reviewsPanel(g, box, { onPosted: (x) => reviewCounts.set(x.id, (reviewCounts.get(x.id) || 0) + 1) }); }



/* ---------------- add a missing game ---------------- */
function addBox(q, data) {
  const box = $("gm-add"); box.replaceChildren();
  if (q.length < 2 || !user || !member) return;
  if (data.some((g) => g.title.toLowerCase() === q.toLowerCase())) return;
  const pick = consoleFilter || (famFilter ? PLATFORMS.find((p) => p.fam === famFilter).id : "PC");
  const sel = el("select", { class: "gm-sel", "aria-label": "Platform" }, ...FAMILIES.map(([k, name]) => el("optgroup", { label: name },
    ...PLATFORMS.filter((p) => p.fam === k).map((p) => el("option", { value: p.id, text: p.name, selected: p.id === pick })))));
  const note = el("p", { class: "gm-note", role: "status" });
  box.append(el("p", { class: "gm-add__line", text: "Can't find it? Add “" + q + "” to the list:" }), sel,
    el("button", { class: "btn gm-btn", type: "button", text: "Add this game", onclick: async () => {
      const s = slug(q); if (!s) { note.textContent = "That name needs some letters or numbers."; return; }
      const r = await sb.rpc("add_game", { p_console: sel.value, p_title: q.slice(0, 120) });
      if (r.error) { note.textContent = /add_game|function|schema cache/i.test(r.error.message) ? "Adding games switches back on with the next database update." : "That didn't work: " + r.error.message; return; }
      if (!r.data || !r.data.ok) { note.textContent = (r.data && r.data.error) || "That didn't work."; return; }
      sfx("success");
      note.textContent = r.data.approved ? "Added. It's in the list now, so search for it to rate it." : "Sent. It shows up for everyone once the owner or an admin approves it.";
    } }), note);
}

/* ---------------- leaderboard: top voters, medals, mottos ----------------
 * Rows come from the public voter_stats view (names, pictures, mottos and counts only, never account ids).
 * Until that view exists the section falls back to reviewers, from the public reviews.
 * #1 / #2 / #3 wear gold / silver / bronze medal flair. The right side of each row is the member's motto in the
 * colour they chose on their profile. The earned badges live inside the opened row. */
/* badge icons: simple line drawings in the site's warm palette (maroon, amber, gold, rose) */
const ICO = {
  crown:  '<path d="M4 17l-1-9 5 4 4-6 4 6 5-4-1 9z"/><path d="M5 20h14"/>',
  quill:  '<path d="M20 4c-7 1-11 6-13 13l-2 3"/><path d="M20 4c0 6-4 10-10 11"/><path d="M9 10h5"/>',
  flag:   '<path d="M6 21V4"/><path d="M6 4h11l-2 4 2 4H6"/>',
  sun:    '<path d="M3 18h18"/><path d="M7 18a5 5 0 0 1 10 0"/><path d="M12 8V5M5.6 10.6 4 9M18.4 10.6 20 9"/>',
  stack:  '<rect x="4" y="13" width="16" height="6" rx="1.5"/><path d="M6 13V9h12v4"/><path d="M8 9V6h8v3"/>',
  ballot: '<rect x="4" y="11" width="16" height="9" rx="1.5"/><path d="M9 11V4h6v7"/><path d="M8 15h8"/>',
  heart:  '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  ice:    '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/><path d="M10 5l2 2 2-2M10 19l2-2 2 2"/>',
  pen:    '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
  talk:   '<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-7l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="M8 9h8M8 12h5"/>',
};
const ico = (k, cls) => { const s = document.createElement("span"); s.className = cls; s.setAttribute("aria-hidden", "true");
  s.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICO[k] + '</svg>'; return s; };
const BADGES = {
  topVoter:  { g: "crown",  c: "gold",  name: "Top Voter",    why: "more votes than anyone else" },
  topCritic: { g: "quill",  c: "gold",  name: "Top Critic",   why: "more reviews than anyone else" },
  founder:   { g: "flag",   c: "amber", name: "First In",     why: "cast the very first vote" },
  early:     { g: "sun",    c: "amber", name: "Early Bird",   why: "one of the first ten voters" },
  founderR:  { g: "flag",   c: "amber", name: "First In",     why: "wrote the very first review" },
  earlyR:    { g: "sun",    c: "amber", name: "Early Bird",   why: "one of the first ten reviewers" },
  c100:      { g: "stack",  c: "rose",  name: "Centurion",    why: "100 or more votes" },
  c50:       { g: "stack",  c: "rose",  name: "Half-Century", why: "50 or more votes" },
  c10:       { g: "ballot", c: "rose",  name: "Regular",      why: "10 or more votes" },
  writer:    { g: "pen",    c: "rose",  name: "Wordsmith",    why: "5 or more reviews" },
  generous:  { g: "heart",  c: "red",   name: "Big Heart",    why: "handed out 10 or more perfect 5/5 scores" },
  tough:     { g: "ice",    c: "ice",   name: "Tough Crowd",  why: "gave 3 or more 0/5 scores" },
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
const vb = (k) => ico(BADGES[k].g, "gm-vb gm-vb--" + BADGES[k].c);

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
      if (i < 3 && rows.length > 3) return;            // the top 3 stand on the podium above
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
          hoverCard(avatar(v.avatar, v.name, place <= 3 ? 42 : 36, "gm-vav"), "member", v.handle),
          el("span", { class: "gm-vwho" },
            el("span", { class: "gm-vname" }, v.name, v.staff ? adminTag() : null),
            el("span", { class: "gm-vcount", text: counts })),
          v.motto ? el("span", { class: "gm-vmotto " + colorClass(v.color), title: v.motto, text: "“" + v.motto + "”" }) : el("span", { class: "gm-vmotto gm-vmotto--none" })),
        el("div", { class: "gm-vprofile" },
          el("dl", null, ...stats),
          bs.length
            ? el("ul", { class: "gm-vblist" }, ...bs.map((k) => el("li", null, vb(k), el("b", { text: BADGES[k].name }), el("span", { class: "gm-vblist__w", text: BADGES[k].why }))))
            : el("p", { class: "gm-note", text: "No badges yet. Keep rating." }),
          v.handle ? el("a", { class: "linkbtn gm-vopen", href: profileUrl(v.handle), text: "Open full profile →" }) : null)));
    });
    const more = rows.length > SHOW ? el("button", { class: "linkbtn gm-vmore", type: "button", text: "Show all " + rows.length, onclick: () => { box.classList.add("gm-voters--all"); more.remove(); } }) : null;
    box.classList.remove("gm-voters--all");
    // the podium: 2nd · 1st · 3rd, with the gap to the next place
    const unit = full ? "vote" : "review", val = (v) => full ? v.votes : v.reviews;
    const step = (i) => { const v = rows[i]; if (!v) return el("div", { class: "gm-pod gm-pod--empty gm-pod--" + (i + 1) }, el("span", { class: "gm-pod__name", text: "Up for grabs" }));
      return hoverCard(el(v.handle ? "a" : "div", { class: "gm-pod gm-pod--" + (i + 1), href: v.handle ? profileUrl(v.handle) : null },
        i === 0 ? el("span", { class: "gm-pod__crown", "aria-hidden": "true", html: '<svg viewBox="0 0 24 24"><path d="M3 18 2 7l5.5 4L12 4l4.5 7L22 7l-1 11z" fill="currentColor"/></svg>' }) : null,
        avatar(v.avatar, v.name, i === 0 ? 64 : 52, "gm-pod__av"),
        el("span", { class: "gm-pod__name", text: v.name }),
        el("span", { class: "gm-pod__n", text: plural(val(v), unit) }),
        el("span", { class: "gm-pod__step" }, el("b", { text: ["1st", "2nd", "3rd"][i] }))), "member", v.handle); };
    const podium = el("div", { class: "gm-podium" }, step(1), step(0), step(2));
    const meH = me.profile && me.profile.handle, myI = meH ? rows.findIndex((v) => v.handle === meH) : -1;
    let chase = null;
    if (myI >= 3 && rows[2]) { const gap = val(rows[2]) - val(rows[myI]) + 1; chase = "You're #" + (myI + 1) + ". " + plural(gap, "more " + unit) + " puts you on the podium."; }
    else if (myI >= 0 && myI < 3) { const next = rows[3], gap = next ? val(rows[myI]) - val(next) : null; chase = "You're on the podium at #" + (myI + 1) + "!" + (gap != null ? " #4 is " + plural(gap, unit) + " behind you." : ""); }
    else if (user && member && rows[2]) chase = "Rate " + plural(val(rows[2]) + 1, "game") + " to reach the podium.";
    box.replaceChildren(
      el("h2", { class: "gm-head", text: "Leaderboard" }),
      el("p", { class: "gm-note", text: "The top 3 raters wear gold, silver and bronze medals on their name across the whole site. Every Verified vote counts." }),
      rows.length > 3 ? podium : null,
      chase ? el("p", { class: "gm-chase", text: chase }) : null,
      list);
    if (more) box.append(more);
    box.hidden = false;
  } catch (e) { /* the leaderboard is extra; never let it break the page */ }
  finally { votersBusy = false; }
}

/* ---------------- this week: top rated, most reviewed, most active voters (rolling 7 days) ---------------- */
async function week() {
  const box = $("gm-week"); if (!box) return;
  try {
    const [a, b, c] = await Promise.all([
      sb.from("week_top_rated").select("*").limit(5), sb.from("week_most_reviewed").select("*").limit(5), sb.from("week_top_voters").select("*").limit(5)]);
    if (a.error || b.error) return;           // database update not run yet: leave the section out
    const col = (title, rows, line, empty) => el("div", { class: "gm-week__col" }, el("h3", { text: title }),
      rows.length ? el("ol", { class: "gm-week__list" }, ...rows.map(line)) : el("p", { class: "gm-note", text: empty }));
    const gameLine = (tail) => (g) => el("li", null, consoleChip(g.console), hoverCard(el("a", { href: gameUrl(g.id), text: g.title }), "game", g.id), el("span", { class: "gm-week__n", text: tail(g) }));
    box.replaceChildren(el("h2", { class: "gm-head", text: "This week on Rate-O-Pedia" }), el("div", { class: "gm-week__cols" },
      col("Top rated", a.data || [], gameLine((g) => Number(g.average).toFixed(1) + " · " + g.votes + "v"), "No votes this week yet. Be the first."),
      col("Most reviewed", b.data || [], gameLine((g) => g.reviews + (g.reviews === 1 ? " review" : " reviews")), "No reviews this week yet."),
      c.error ? null : col("Most active voters", c.data || [], (v) => el("li", null, avatar(v.avatar, v.name, 22), hoverCard(el("a", { href: profileUrl(v.handle), text: v.name }), "member", v.handle), el("span", { class: "gm-week__n", text: v.votes + " votes" })), "Nobody has voted this week yet.")));
    box.hidden = false;
  } catch (e) {}
}

/* ---------------- start ---------------- */
// Deep link from the hub's "Top rated" cards: /games/?q=Title opens the list already searched.
try { const q0 = new URLSearchParams(location.search).get("q"); if (q0) $("gm-q").value = q0.slice(0, 80); } catch (e) {}
// Deep link from a platform hub: /games/?p=SNES opens with that platform picked
try { const p0 = new URLSearchParams(location.search).get("p"); if (p0 && PLATFORM[p0]) { consoleFilter = p0; famFilter = PLATFORM[p0].fam; } } catch (e) {}
tabs();
week();
$("gm-q").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(load, 250); });
const qbox = $("gm-qbox"); if (qbox) qbox.addEventListener("submit", (e) => { e.preventDefault(); clearTimeout(searchTimer); load(); });
subnav($("rop-tabs"), "ratings");
onAuth(onSession);

/* the Chippers line-up in "How scores work" */
{ const box = $("gm-chippers"); if (box) box.replaceChildren(...CHIPPER.map((n, i) => el("span", { class: "gm-chipper rop-chip--" + i, title: i + " · " + n + " (" + CHIP_WORD[i] + ")" },
  chipSvg(i), el("b", { text: n }), el("small", { text: CHIP_WORD[i] })))); }
