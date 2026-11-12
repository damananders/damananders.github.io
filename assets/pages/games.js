/* pages/games.js: the game ratings page (/games/). Prefix gm-.
 * Anyone can search and read scores. Rating, reviewing and adding a game are a Discord server perk:
 * visitors sign in with Discord, and a server-side check (Supabase function "verify-member") confirms they
 * are in the server. The database enforces that rule itself, so nothing here is trusted for security.
 * The key below is Supabase's publishable key: it is meant to be public.
 */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SB_URL = "https://zjhlhkruqzfendvbglsb.supabase.co";
const SB_KEY = "sb_publishable_j-EgPXB3ZvKuz_3h8dZaNA_aLgmcQrk";
const INVITE = "https://discord.gg/U35dt6Qb2A";
const CONSOLES = ["PS1", "PS2", "PSP", "Vita", "PS3", "PS4", "PS5"];
const sb = createClient(SB_URL, SB_KEY);

const $ = (id) => document.getElementById(id);
function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "text") n.textContent = v; else if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids) if (k != null) n.append(k);
  return n;
}
const say = (msg, bad) => { const s = $("gm-status"); s.textContent = msg || ""; s.classList.toggle("gm-bad", !!bad); };
const slug = (t) => t.normalize("NFKD").replace(/[^\x00-\x7f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

let user = null, member = false, consoleFilter = "", mine = new Map(), reviewCounts = new Map(), searchTimer = 0, lastQuery = "", loadSeq = 0;

/* ---------------- sign-in and membership ---------------- */
function signIn() {
  sb.auth.signInWithOAuth({ provider: "discord", options: { scopes: "identify guilds.members.read", redirectTo: location.origin + "/games/" } });
}
async function refreshMember(session) {
  // Right after the Discord redirect the session carries the visitor's Discord token: ask the server to check.
  if (session && session.provider_token) {
    try { await sb.functions.invoke("verify-member", { body: { provider_token: session.provider_token } }); } catch (e) { /* profile read below still answers */ }
  }
  const { data } = await sb.from("profiles").select("is_member,name,avatar").eq("id", user.id).maybeSingle();
  member = !!(data && data.is_member);
  return data;
}
async function onSession(session) {
  user = session ? session.user : null; member = false;
  const box = $("gm-auth"); box.replaceChildren();
  if (!user) {
    box.append(el("p", { class: "gm-auth__line", text: "Rating is a Discord-server perk." }),
      el("div", { class: "gm-auth__row" },
        el("button", { class: "btn gm-btn", type: "button", onclick: signIn, text: "Sign in with Discord" }),
        el("a", { class: "linkbtn", href: INVITE, target: "_blank", rel: "noopener", text: "Join the server first" })));
  } else {
    box.append(el("p", { class: "gm-auth__line", text: "Checking membership…" }));
    const p = await refreshMember(session);
    box.replaceChildren();
    const name = (p && p.name) || (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || "you";
    if (member) box.append(el("p", { class: "gm-auth__line gm-ok", text: "Signed in as " + name + " · in the server, votes count." }));
    else box.append(el("p", { class: "gm-auth__line", text: "Signed in as " + name + " · not in the server yet." }),
      el("div", { class: "gm-auth__row" },
        el("a", { class: "btn gm-btn", href: INVITE, target: "_blank", rel: "noopener", text: "Join the Discord" }),
        el("button", { class: "linkbtn", type: "button", onclick: signIn, text: "I've joined — check again" })));
    box.append(el("button", { class: "linkbtn gm-out", type: "button", text: "Sign out", onclick: async () => { await sb.auth.signOut(); } }));
  }
  load();
}

/* ---------------- list ---------------- */
function tabs() {
  const t = $("gm-tabs"); t.replaceChildren();
  for (const c of ["", ...CONSOLES]) {
    t.append(el("button", { class: "gm-tab" + (c === consoleFilter ? " is-on" : ""), "data-c": c || "all", type: "button", "aria-pressed": c === consoleFilter ? "true" : "false",
      text: c || "All", onclick: () => { consoleFilter = c; tabs(); load(); } }));
  }
}
const SHAPES = ["△", "○", "✕", "□", "△"];
function ratingRow(g) {
  const my = mine.has(g.id) ? mine.get(g.id) : null;
  const row = el("div", { class: "gm-rate", role: "group", "aria-label": "Your rating for " + g.title });
  if (!user || !member) { row.append(el("span", { class: "gm-rate__lock", text: user ? "Join the Discord to rate" : "Sign in to rate" })); return row; }
  row.append(el("button", { class: "gm-zero" + (my === 0 ? " is-on" : ""), type: "button", title: my === 0 ? "rated 0 — click to remove" : "0 out of 5", text: "0", onclick: () => rate(g, my === 0 ? null : 0) }));
  for (let i = 1; i <= 5; i++)
    row.append(el("button", { class: "gm-pip gm-pip--" + i + (my != null && i <= my ? " is-on" : ""), type: "button", title: my === i ? i + " — click again to remove your rating" : i + " out of 5", "aria-label": i + " out of 5", text: SHAPES[i - 1], onclick: () => rate(g, my === i ? null : i) }));
  return row;
}
function card(g) {
  const score = g.votes > 0 ? Number(g.average).toFixed(1) + " / 5" : "not rated yet";
  const more = el("div", { class: "gm-more", hidden: true });
  const n = reviewCounts.get(g.id) || 0;
  const toggle = el("button", { class: "linkbtn gm-toggle", type: "button", "aria-expanded": "false" });
  function sync(open) {
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.replaceChildren(document.createTextNode("Reviews (" + n + ") "),
      el("span", { class: "gm-toggle__i gm-toggle__i--" + (open ? "o" : "x"), "aria-hidden": "true", text: open ? "○" : "✕" }));
  }
  sync(false);
  toggle.addEventListener("click", () => { const open = more.hidden; more.hidden = !open; sync(open); if (open) reviews(g, more); });
  const c = el("article", { class: "gm-card" },
    el("div", { class: "gm-card__top" },
      el("span", { class: "gm-console", "data-c": g.console, text: g.console }),
      el("h3", { class: "gm-title", text: g.title }),
      el("span", { class: "gm-score", text: score }),
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
  list.replaceChildren(...data.map(card));
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
  const { data } = await sb.from("public_reviews").select("body,name,stars,created_at").eq("game_id", g.id).order("created_at", { ascending: false }).limit(20);
  box.replaceChildren();
  for (const r of data || [])
    box.append(el("blockquote", { class: "gm-review" }, el("p", { text: r.body }), el("footer", { text: (r.name || "A member") + (r.stars != null ? "  ·  " + r.stars + " / 5" : "") })));
  if (!(data || []).length) box.append(el("p", { class: "gm-empty", text: "No reviews yet." }));
  if (user && member) {
    const ta = el("textarea", { class: "gm-ta", maxlength: "1000", rows: "3", placeholder: "A few words about this game (optional)", "aria-label": "Your review of " + g.title });
    const note = el("p", { class: "gm-note", role: "status" });
    box.append(ta, el("button", { class: "btn gm-btn", type: "button", text: "Send review", onclick: async () => {
      const body = ta.value.trim(); if (body.length < 3) { note.textContent = "Write a little more first."; return; }
      const { error } = await sb.from("reviews").insert({ user_id: user.id, game_id: g.id, body });
      note.textContent = error ? (error.code === "23505" ? "You've already reviewed this game." : "That didn't send: " + error.message) : "Thanks! Your review is up.";
      if (!error) ta.value = "";
    } }), note);
  }
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

/* ---------------- voters: profiles and badges ----------------
 * Counts come from the public voter_stats view (setup file 09_voter_stats.sql: display names and totals only,
 * never account ids). Until that view exists the section falls back to reviewers, from the public reviews.
 * Badge glyphs are the four face buttons, in their PlayStation colours. */
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
const vb = (k, title) => el("span", { class: "gm-vb gm-vb--" + BADGES[k].c, title: title ? BADGES[k].name + " — " + BADGES[k].why : null, "aria-label": title ? BADGES[k].name : null, "aria-hidden": title ? null : "true", text: BADGES[k].g });
let votersBusy = false;
async function voters() {
  const box = $("gm-voters"); if (!box || votersBusy) return;
  votersBusy = true;
  try {
    let rows = [], full = true;
    const r = await sb.from("voter_stats").select("name,avatar,votes,reviews,fives,zeros,first_vote,last_vote").order("votes", { ascending: false }).limit(200);
    if (!r.error && Array.isArray(r.data)) rows = r.data.map((x) => ({ name: x.name, avatar: x.avatar, votes: +x.votes || 0, reviews: +x.reviews || 0, fives: +x.fives || 0, zeros: +x.zeros || 0, first: x.first_vote, last: x.last_vote }));
    else {
      full = false;
      const pr = await sb.from("public_reviews").select("name,avatar,created_at").limit(5000);
      if (pr.error || !Array.isArray(pr.data)) { box.hidden = true; return; }
      const m = new Map();
      for (const x of pr.data) {
        if (!x.name) continue;
        const v = m.get(x.name) || { name: x.name, avatar: x.avatar, votes: 0, reviews: 0, fives: 0, zeros: 0, first: x.created_at, last: x.created_at };
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
      const bs = badgesFor(v, ctx);
      const av = typeof v.avatar === "string" && /^https:\/\/cdn\.discordapp\.com\//.test(v.avatar)
        ? el("img", { class: "gm-vav", src: v.avatar, alt: "", loading: "lazy", width: "36", height: "36", referrerpolicy: "no-referrer",
            onerror: (e) => { e.target.replaceWith(el("span", { class: "gm-vav gm-vav--txt", "aria-hidden": "true", text: v.name.trim().charAt(0).toUpperCase() })); } })
        : el("span", { class: "gm-vav gm-vav--txt", "aria-hidden": "true", text: v.name.trim().charAt(0).toUpperCase() });
      const counts = full ? plural(v.votes, "vote") + (v.reviews ? " · " + plural(v.reviews, "review") : "") : plural(v.reviews, "review");
      const stats = [];
      const stat = (k, val) => stats.push(el("dt", { text: k }), el("dd", { text: String(val) }));
      if (full) stat("Votes", v.votes);
      stat("Reviews", v.reviews);
      if (full) { stat("Perfect 5/5s", v.fives); stat("0/5s", v.zeros); }
      stat(full ? "First vote" : "First review", fmt(v.first));
      stat(full ? "Latest vote" : "Latest review", fmt(v.last));
      list.append(el("details", { class: "gm-vcard" + (i >= SHOW ? " gm-vcard--more" : "") },
        el("summary", null,
          el("span", { class: "gm-vrank", text: "#" + (i + 1) }), av,
          el("span", { class: "gm-vname", text: v.name }),
          el("span", { class: "gm-vcount", text: counts }),
          el("span", { class: "gm-vbadges" }, ...bs.map((k) => vb(k, true)))),
        el("div", { class: "gm-vprofile" },
          el("dl", null, ...stats),
          bs.length
            ? el("ul", { class: "gm-vblist" }, ...bs.map((k) => el("li", null, vb(k, false), el("b", { text: BADGES[k].name }), " — " + BADGES[k].why)))
            : el("p", { class: "gm-note", text: "No badges yet. Keep rating." }))));
    });
    const more = rows.length > SHOW ? el("button", { class: "linkbtn gm-vmore", type: "button", text: "Show all " + rows.length, onclick: () => { box.classList.add("gm-voters--all"); more.remove(); } }) : null;
    box.classList.remove("gm-voters--all");
    box.replaceChildren(
      el("h2", { class: "gm-head", text: "Top voters" }),
      el("p", { class: "gm-note", text: full ? "The Discord members who rate the most, and the badges they've earned. Open one to see their profile." : "The members who've written reviews, and the badges they've earned. Open one to see their profile." }),
      list);
    if (more) box.append(more);
    box.hidden = false;
  } catch (e) { /* the voters board is extra; never let it break the page */ }
  finally { votersBusy = false; }
}

/* ---------------- start ---------------- */
// Deep link from the hub's "Top rated" cards: /games/?q=Title opens the list already searched.
try { const q0 = new URLSearchParams(location.search).get("q"); if (q0) $("gm-q").value = q0.slice(0, 80); } catch (e) {}
tabs();
$("gm-q").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(load, 250); });
sb.auth.onAuthStateChange((_event, session) => { setTimeout(() => onSession(session), 0); });
voters();
