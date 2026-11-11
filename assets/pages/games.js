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

let user = null, member = false, consoleFilter = "", mine = new Map(), searchTimer = 0, lastQuery = "";

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
    box.append(el("p", { class: "gm-auth__line", text: "Rating games is a perk for members of the Discord server." }),
      el("div", { class: "gm-auth__row" },
        el("button", { class: "btn gm-btn", type: "button", onclick: signIn, text: "Sign in with Discord" }),
        el("a", { class: "linkbtn", href: INVITE, target: "_blank", rel: "noopener", text: "Join the server first" })));
  } else {
    box.append(el("p", { class: "gm-auth__line", text: "Checking your Discord membership…" }));
    const p = await refreshMember(session);
    box.replaceChildren();
    const name = (p && p.name) || (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || "you";
    if (member) box.append(el("p", { class: "gm-auth__line gm-ok", text: "Signed in as " + name + ". You're in the server, so your votes count." }));
    else box.append(el("p", { class: "gm-auth__line", text: "Signed in as " + name + ", but you're not in the Discord server yet. Join it, then check again." }),
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
  row.append(el("button", { class: "gm-zero" + (my === 0 ? " is-on" : ""), type: "button", title: "0 out of 5", text: "0", onclick: () => rate(g, 0) }));
  for (let i = 1; i <= 5; i++)
    row.append(el("button", { class: "gm-pip gm-pip--" + i + (my != null && i <= my ? " is-on" : ""), type: "button", title: i + " out of 5", "aria-label": i + " out of 5", text: SHAPES[i - 1], onclick: () => rate(g, i) }));
  if (my != null) row.append(el("button", { class: "linkbtn gm-clear", type: "button", text: "clear", onclick: () => rate(g, null) }));
  return row;
}
function card(g) {
  const score = g.votes > 0 ? Number(g.average).toFixed(1) + " / 5" : "not rated yet";
  const more = el("div", { class: "gm-more", hidden: true });
  const c = el("article", { class: "gm-card" },
    el("div", { class: "gm-card__top" },
      el("span", { class: "gm-console", "data-c": g.console, text: g.console }),
      el("h3", { class: "gm-title", text: g.title }),
      el("span", { class: "gm-score", text: score }),
      el("span", { class: "gm-votes", text: g.votes === 1 ? "1 vote" : g.votes + " votes" })),
    ratingRow(g),
    el("button", { class: "linkbtn gm-toggle", type: "button", text: "Reviews", onclick: () => { more.hidden = !more.hidden; if (!more.hidden) reviews(g, more); } }),
    more);
  c.dataset.id = g.id;
  return c;
}
async function load() {
  const q = $("gm-q").value.trim(); lastQuery = q;
  const list = $("gm-list"), head = $("gm-head");
  let req = sb.from("game_scores").select("id,console,title,votes,average");
  if (consoleFilter) req = req.eq("console", consoleFilter);
  if (q.length >= 2) { req = req.ilike("title", "%" + q.replace(/[%_]/g, " ") + "%").order("votes", { ascending: false }).order("title").limit(40); head.textContent = "Results for “" + q + "”"; }
  else { req = req.gt("votes", 0).order("average", { ascending: false }).order("votes", { ascending: false }).limit(25); head.textContent = (consoleFilter || "All-time") + " top rated"; }
  const { data, error } = await req;
  if (q !== lastQuery) return;                       // a newer search is already on its way
  if (error) { say("Couldn't load the games: " + error.message, true); return; }
  mine = new Map();
  if (user && data.length) {
    const r = await sb.from("ratings").select("game_id,stars").in("game_id", data.map((g) => g.id));
    for (const x of r.data || []) mine.set(x.game_id, x.stars);
  }
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

/* ---------------- start ---------------- */
tabs();
$("gm-q").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(load, 250); });
sb.auth.onAuthStateChange((_event, session) => { setTimeout(() => onSession(session), 0); });
