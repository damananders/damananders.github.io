/* pages/games.common.js: shared pieces for every Rate-O-Pedia page (/games/, /games/forum/, /games/profile/, the owner station).
 * One Supabase client, the Discord sign-in pill, the Ratings / Forums / Profile tabs, avatars, dates and motto colours.
 * The key below is Supabase's publishable key: it is meant to be public. Every permission is enforced by the database.
 */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const SB_URL = "https://zjhlhkruqzfendvbglsb.supabase.co";
const SB_KEY = "sb_publishable_j-EgPXB3ZvKuz_3h8dZaNA_aLgmcQrk";
export const INVITE = "https://discord.gg/U35dt6Qb2A";
import { PLATFORMS, PLATFORM, FAMILIES, FAMILY, platformName, familyOf } from "./games.platforms.js?v=3";
export { PLATFORMS, PLATFORM, FAMILIES, FAMILY, platformName, familyOf };
export const CONSOLES = PLATFORMS.map((p) => p.id);
export const sb = createClient(SB_URL, SB_KEY);

export const $ = (id) => document.getElementById(id);
export function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "text") n.textContent = v; else if (k === "class") n.className = v; else if (k === "html") n.innerHTML = v;   // html: only ever our own constants
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids) if (k != null && k !== false) n.append(k);
  return n;
}
export const sfx = (name) => { try { if (window.Site && Site.sfx) Site.sfx(name); } catch (e) {} };
export const toast = (msg, type) => { try { if (window.Site && Site.toast) return Site.toast(msg, { type: type || "info" }); } catch (e) {} };

/* ---------------- motto colours (standard choices; the database only accepts these keys) ---------------- */
export const COLORS = [
  ["white", "White"], ["gray", "Gray"], ["red", "Red"], ["orange", "Orange"], ["gold", "Gold"], ["yellow", "Yellow"],
  ["green", "Green"], ["teal", "Teal"], ["blue", "Blue"], ["purple", "Purple"], ["pink", "Pink"],
];
export const colorClass = (c) => "rop-c rop-c--" + (COLORS.some(([k]) => k === c) ? c : "white");

/* ---------------- dates ---------------- */
export function memberSince(iso) {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d) ? d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—";
}
/* review / post times: the visitor's own time zone, 12-hour by default; "site.clock24" (true) switches to 24-hour.
   The quick profile box and the site settings both write that same key. */
export const clock24 = () => { try { return JSON.parse(localStorage.getItem("site.clock24") || "false") === true; } catch (e) { return false; } };
export function setClock24(on) { try { localStorage.setItem("site.clock24", JSON.stringify(!!on)); } catch (e) {} try { window.dispatchEvent(new CustomEvent("site:clock", { detail: !!on })); } catch (e) {} }
export function fmtWhen(iso) {
  const d = iso ? new Date(iso) : null; if (!d || isNaN(d)) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + " · " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: !clock24() });
}
export function shortDate(iso) {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d) ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
}
export function ago(iso) {
  const d = iso ? new Date(iso) : null; if (!d || isNaN(d)) return "";
  const s = Math.max(1, (Date.now() - d) / 1000);
  for (const [n, w] of [[31536000, "year"], [2592000, "month"], [604800, "week"], [86400, "day"], [3600, "hour"], [60, "minute"]])
    if (s >= n) { const k = Math.floor(s / n); return k + " " + w + (k === 1 ? "" : "s") + " ago"; }
  return "just now";
}

/* ---------------- avatars: uploaded picture or Discord picture, else the first letter ---------------- */
const AV_OK = new RegExp("^(https://cdn\\.discordapp\\.com/|" + SB_URL.replace(/[.]/g, "\\.") + "/storage/v1/object/public/avatars/)");
export function avatar(url, name, size, cls) {
  const letter = () => el("span", { class: "rop-av rop-av--txt " + (cls || ""), style: "--s:" + (size || 36) + "px", "aria-hidden": "true", text: String(name || "?").trim().charAt(0).toUpperCase() || "?" });
  if (typeof url !== "string" || !AV_OK.test(url)) return letter();
  return el("img", { class: "rop-av " + (cls || ""), style: "--s:" + (size || 36) + "px", src: url, alt: "", loading: "lazy", width: String(size || 36), height: String(size || 36), referrerpolicy: "no-referrer",
    onerror: (e) => e.target.replaceWith(letter()) });
}
export const profileUrl = (handle) => "/games/profile/?u=" + encodeURIComponent(handle);
export function nameLink(handle, name, extra) {
  return handle ? el("a", { class: "rop-name " + (extra || ""), href: profileUrl(handle), text: name || "A member" }) : el("span", { class: "rop-name " + (extra || ""), text: name || "A member" });
}
export const ownerTag = () => el("span", { class: "rop-owner", title: "Site owner", text: "Owner" });
export const consoleChip = (id) => el("span", { class: "gm-console", "data-c": id, "data-f": familyOf(id), title: platformName(id), text: id });
export const adminTag = () => el("span", { class: "rop-admin", title: "Admin (from the Discord server)", text: "Admin" });

/* ---------------- sign-in ----------------
 * Discord always sends people back to /games/ (the one address Supabase is known to allow), and that page then
 * returns them to wherever they pressed "Sign in". */
const RETURN_KEY = "rop.return";
export function signIn() {
  try { sessionStorage.setItem(RETURN_KEY, location.pathname + location.search + location.hash); } catch (e) {}
  sb.auth.signInWithOAuth({ provider: "discord", options: { scopes: "identify guilds.members.read", redirectTo: location.origin + "/games/" } });
}
export function takeReturn() {
  try { const r = sessionStorage.getItem(RETURN_KEY); sessionStorage.removeItem(RETURN_KEY); return r && /^\/(?:games|support)\//.test(r) ? r : null; } catch (e) { return null; }
}

/* me = { user, profile, member, banned, ready } ; ready = the round-11 SQL (11_rateopedia_profiles_forums_station.sql) has been run (profiles have handles) */
export const me = { user: null, profile: null, member: false, banned: false, ready: false, admin: false, staff: false, verify: null };
let staffSent = false, trophiesSent = -1;
// The site's trophies live in this browser; copy the count to the profile so others can see it (best effort).
/* Rating milestones for the site's Trophy Cabinet: the pages announce your counts as "rop:stats"
 * ({ votes, reviews, lists, following, member }) and the trophy code decides what they earn. Visitors count the
 * games this browser has rated. Also left on window.ROP_STATS for code that loads later. */
let statsSent = false;
const VRATED = "rop.vrated";
function visitorRated() { try { return JSON.parse(localStorage.getItem(VRATED) || "[]"); } catch (e) { return []; } }
function sendStats(st) {
  window.ROP_STATS = st;
  try { if (window.Site && Site.emit) Site.emit("rop:stats", st); } catch (e) {}
}
async function emitStats(force) {
  if (statsSent && !force) return; statsSent = true;
  const st = { votes: visitorRated().length, reviews: 0, lists: 0, following: 0, member: !!me.member };
  const h = me.profile && me.profile.handle;
  if (me.member && h) {
    try {
      const [mp, ls, fi] = await Promise.all([
        sb.from("member_profiles").select("votes,reviews").eq("handle", h).maybeSingle(),
        sb.from("public_lists").select("id", { count: "exact", head: true }).eq("handle", h),
        sb.rpc("follow_info", { p_handle: h })]);
      if (mp.data) { st.votes = Math.max(st.votes, mp.data.votes || 0); st.reviews = mp.data.reviews || 0; }
      if (!ls.error) st.lists = ls.count || 0;
      if (!fi.error && fi.data && fi.data[0]) st.following = fi.data[0].following || 0;
    } catch (e) {}
  }
  sendStats(st);
}
/* pages call this after a rating, review, list or follow so a milestone lands straight away */
export function statsChanged() { emitStats(true); }

function syncTrophies() {
  let n = 0;
  try { const got = (window.Site && Site.store && Site.store.get("trophies", {})) || {}; n = Object.keys(got).filter((k) => got[k]).length; } catch (e) { return; }
  if (n === trophiesSent) return;
  trophiesSent = n;
  sb.rpc("set_my_trophies", { p_count: n }).then(() => {}, () => {});
}
/* Server-membership check. Discord rate-limits it hard, so: one check at a time, at most once every 20 minutes per
 * sign-in (unless forced by "check again"), and a short retry when Discord didn't give a clear answer. */
const VERIFY_KEY = "rop.verified";
let verifying = null;
const tokenTag = (t) => { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
function verify(token, force) {
  const tag = tokenTag(token);
  if (!force) { try { const v = JSON.parse(localStorage.getItem(VERIFY_KEY) || "null"); if (v && v.t === tag && Date.now() - v.at < 20 * 60e3) return Promise.resolve(null); } catch (e) {} }
  if (verifying) return verifying;
  verifying = (async () => {
    let out = null;
    for (let i = 0; i < 3; i++) {
      if (i) await pause(1200 * i);
      try { const { data, error } = await sb.functions.invoke("verify-member", { body: { provider_token: token } }); out = error ? { error: String(error.message || error) } : (data || {}); }
      catch (e) { out = { error: String(e) }; }
      if (out.reason === "token_expired") break;
      if (!out.error && !out.unchanged && out.member) break;           // a clear yes
      if (!out.error && !out.unchanged && out.member === false && i >= 1) break;   // a no, confirmed twice
    }
    me.verify = out;
    if (out && !out.error && !out.unchanged) { try { localStorage.setItem(VERIFY_KEY, JSON.stringify({ t: tag, at: Date.now() })); } catch (e) {} }
    return out;
  })().finally(() => { verifying = null; });
  return verifying;
}
/* "I've joined, check again": re-ask with the current Discord sign-in; only send people through Discord again if it expired */
export async function recheck(btn) {
  if (btn) { btn.disabled = true; btn.textContent = "Checking…"; }
  const { data } = await sb.auth.getSession();
  const session = data && data.session;
  if (!session || !session.provider_token) { signIn(); return; }
  const out = await verify(session.provider_token, true);
  if (out && out.reason === "token_expired") { signIn(); return; }
  await loadMe(session, true);
  listeners.forEach((fn) => { try { fn(me); } catch (e) {} });
  if (!me.member) toast(out && (out.error || out.unchanged) ? "Discord didn't answer just now. Try again in a few seconds." : "Still not showing as a member. Join the server, then check again.", "warn");
  else toast("You're in! Rating and posting are unlocked.", "ok");
}
const listeners = [];
const FULL = "is_member,name,avatar,handle,display_name,custom_avatar,motto,motto_color,fav_games,banned,created_at";
export async function loadMe(session, skipVerify) {
  me.user = session ? session.user : null; me.profile = null; me.member = false; me.banned = false; me.admin = false; me.staff = false;
  if (!me.user) { emitStats(); return me; }
  if (session.provider_token && !skipVerify) await verify(session.provider_token, false);   // ask the server to check server membership
  let r = await sb.from("profiles").select(FULL).eq("id", me.user.id).maybeSingle();
  me.ready = !r.error;
  if (r.error) r = await sb.from("profiles").select("is_member,name,avatar").eq("id", me.user.id).maybeSingle();
  me.profile = r.data || null;
  me.banned = !!(me.profile && me.profile.banned);
  me.member = !!(me.profile && me.profile.is_member) && !me.banned;
  me.restricted = null;   // muted or kicked from the control panel (round 25): read-only for now
  if (me.member) {
    try { const r = await sb.rpc("my_restrictions"); const x = r.data;
      if (!r.error && x && (x.muted || x.kicked_until)) { me.restricted = x; me.member = false; } } catch (e) {}
  }
  if (me.ready) { try { const a = await sb.rpc("is_admin"); me.admin = a.data === true; } catch (e) {} }
  // Admin bubble (set server-side from the Discord role); tells the site trophies about it once per page load
  if (me.ready) { try { const s = await sb.from("profiles").select("is_staff").eq("id", me.user.id).maybeSingle(); me.staff = !!(s.data && s.data.is_staff) && !me.banned; } catch (e) {} }
  if (me.ready && !me.banned) syncTrophies();
  if (me.ready) loadOpps();
  if (!me.banned) emitStats();
  if (me.staff && !staffSent) { staffSent = true; window.ROP_ADMIN = true; try { if (window.Site && Site.emit) Site.emit("rop:admin", true); } catch (e) {} }
  return me;
}
export const myName = () => (me.profile && (me.profile.display_name || me.profile.name)) || (me.user && me.user.user_metadata && (me.user.user_metadata.full_name || me.user.user_metadata.name)) || "you";
export const myAvatar = () => me.profile ? (me.profile.custom_avatar || me.profile.avatar) : null;

/* Calls fn(me) on load and on every sign-in / sign-out */
let chain = Promise.resolve();
export function onAuth(fn) {
  let seq = 0;
  listeners.push(fn);
  sb.auth.onAuthStateChange((event, session) => {
    if (event === "TOKEN_REFRESHED") return;          // same person, nothing new to check
    const n = ++seq;
    // one load at a time, so two sign-in events can't race each other over `me`
    chain = chain.then(() => new Promise((ok) => setTimeout(ok, 0))).then(() => loadMe(session)).then(() => { if (n === seq) fn(me); }, () => { if (n === seq) fn(me); });
  });
}

/* The slim pill under the Donate / Discord / Twitch banner */
export function authPill(box, opts) {
  box.replaceChildren();
  box.classList.add("rop-me"); box.classList.remove("rop-me--hub");
  const o = opts || {};
  if (!me.user) {
    box.append(
      el("div", { class: "rop-me__head" }, el("span", { class: "rop-me__discord", "aria-hidden": "true" }, discordSvg()),
        el("div", { class: "rop-me__who" }, el("b", { class: "rop-me__name", text: "Join the conversation" }), el("span", { class: "rop-me__sub", text: o.why || "Rating, reviews, forums and profiles are a Discord-server perk." }))),
      el("div", { class: "rop-me__btns" },
        el("button", { class: "btn gm-btn rop-me__main", type: "button", onclick: signIn, text: "Sign in with Discord" }),
        el("a", { class: "rop-me__btn", href: INVITE, target: "_blank", rel: "noopener", text: "Join the server first" })));
    return;
  }
  const handle = me.ready && me.profile && me.profile.handle;
  if (o.hub && handle) return hubPill(box, handle);
  const flair = el("span", { class: "rop-me__flair" }, me.admin ? ownerTag() : null, me.staff ? adminTag() : null);
  const status = me.banned ? el("span", { class: "rop-me__sub gm-bad", text: "This account is suspended." })
    : me.restricted ? el("span", { class: "rop-me__sub gm-bad", text: me.restricted.kicked_until
        ? "Read-only until " + new Date(me.restricted.kicked_until).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
        : "Your account is muted (read-only)" })
    : me.member ? el("span", { class: "rop-me__sub gm-ok", text: "In the server" + (o.okTail ? o.okTail.replace(/^,\s*/, " · ").replace(/\.$/, "") : " · votes count") })
    : el("span", { class: "rop-me__sub", text: "Not in the server yet" });
  const stat = (label) => { const b = el("b", { text: "–" }); return [el("li", null, b, el("span", { text: label })), b]; };
  const [rLi, rB] = stat("Reviews"), [pLi, pB] = stat("Posts"), [cLi, cB] = stat("Comments");
  box.append(
    el("div", { class: "rop-me__head" }, avatar(myAvatar(), myName(), 52, "rop-me__av"),
      el("div", { class: "rop-me__who" }, el("span", { class: "rop-me__line" }, el("b", { class: "rop-me__name", text: myName() }), flair), status)),
    el("ul", { class: "rop-me__stats" }, rLi, pLi, cLi));
  if (me.ready) box.querySelector(".rop-me__head").append(bell());
  if (me.admin) box.querySelector(".rop-me__head").append(el("a", { class: "rop-me__opico", href: "/games/ti3c20mi/", title: "Operation Station", "aria-label": "Operation Station", html: OP_ICO }));
  const btns = el("div", { class: "rop-me__btns" });
  if (!me.member && !me.banned && !me.restricted) btns.append(el("a", { class: "btn gm-btn rop-me__main", href: INVITE, target: "_blank", rel: "noopener", text: "Join the Discord" }),
    el("button", { class: "rop-me__btn", type: "button", onclick: (e) => recheck(e.currentTarget), text: "I've joined, check again" }));
  if (handle) btns.append(el("a", { class: (me.member || me.restricted ? "btn gm-btn rop-me__main" : "rop-me__btn"), href: profileUrl(handle), text: "My profile" }));
  if (handle && me.member) btns.append(el("a", { class: "rop-me__btn", href: "/games/feed/", text: "Following" }), el("a", { class: "rop-me__btn", href: "/games/lists/", text: "Lists" }));
  if (handle) btns.append(buddiesBtn());
  box.append(btns);
  const out = el("button", { class: "rop-me__out", type: "button", text: "Sign out", title: "Sign out", onclick: async () => { await sb.auth.signOut(); } });
  const clk = el("button", { class: "rop-me__clock", type: "button", "aria-pressed": clock24() ? "true" : "false", title: "How review and post times are shown",
    onclick: () => { setClock24(!clock24()); paintClk(); } });
  const paintClk = () => { const on = clock24(); clk.setAttribute("aria-pressed", on ? "true" : "false"); clk.replaceChildren(el("span", { class: "rop-me__clockk", text: "Clock" }), el("b", { class: on ? "" : "is-on", text: "12h" }), el("b", { class: on ? "is-on" : "", text: "24h" })); };
  paintClk(); box.append(el("div", { class: "rop-me__foot" }, clk, out));
  if (!handle) { [rB, pB, cB].forEach((x) => { x.textContent = "0"; }); return; }
  // counts and the top-3 voter medal, filled in as they arrive
  sb.from("member_profiles").select("reviews,posts").eq("handle", handle).maybeSingle().then(({ data }) => {
    rB.textContent = String((data && data.reviews) || 0); pB.textContent = String((data && data.posts) || 0);
  }, () => {});
  sb.from("forum_thread").select("id", { count: "exact", head: true }).eq("handle", handle).then((r) => { cB.textContent = String(r.count || 0); }, () => { cB.textContent = "0"; });
  sb.from("voter_stats").select("handle").order("votes", { ascending: false }).limit(3).then(({ data }) => {
    const i = (data || []).findIndex((x) => x.handle === handle);
    if (i >= 0) flair.append(el("span", { class: "rop-me__medal rop-me__medal--" + ["gold", "silver", "bronze"][i], title: "Top " + (i + 1) + " voter on the leaderboard", text: ["1st", "2nd", "3rd"][i] }));
  }, () => {});
}
/* On your own profile the card above is redundant: just the buttons, as a slim row of icons */
const HUB_ICO = {
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  following: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h7"/><path d="M17 15l2 2 4-4"/></svg>',
  lists: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="18" r="1.2"/></svg>',
  out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16l-4-4 4-4M6 12h10"/></svg>'
};
function hubPill(box, handle) {
  box.classList.add("rop-me--hub");
  const a = (cls, href, label, ico) => el("a", { class: "rop-hub__b " + cls, href, title: label, "aria-label": label, html: ico });
  const row = el("nav", { class: "rop-hub", "aria-label": "Your shortcuts" });
  if (me.ready) row.append(bell());
  row.append(a("rop-hub__b--me", profileUrl(handle), "My profile", HUB_ICO.profile));
  if (me.member) row.append(a("", "/games/feed/", "Following", HUB_ICO.following), a("", "/games/lists/", "Lists", HUB_ICO.lists));
  row.append(unreadBadge(el("a", { class: "rop-hub__b rop-hub__b--bud", href: "/games/buddies/", title: "Buddies & messages", "aria-label": "Buddies & messages", html: BUD_ICO })));
  if (me.admin) row.append(a("rop-hub__b--op", "/games/ti3c20mi/", "Operation Station", OP_ICO));
  row.append(el("button", { class: "rop-hub__b rop-hub__b--out", type: "button", title: "Sign out", "aria-label": "Sign out", html: HUB_ICO.out, onclick: async () => { await sb.auth.signOut(); } }));
  box.append(row);
}
/* ---------------- Buddies, Opps and messages (round 33) ----------------
 * Opps: members you've blocked. Anything they wrote (reviews, posts, comments, guestbook notes) is hidden from you on
 * every Rate-O-Pedia page. Pages opt a box out with data-no-opp-hide (the Buddies page's own Opps list, for one). */
export const opps = new Set();
let oppObs = null;
async function loadOpps() {
  try {
    const r = await sb.rpc("my_opp_handles");
    opps.clear(); if (!r.error && Array.isArray(r.data)) r.data.forEach((h) => opps.add(h));
  } catch (e) {}
  hideOpps(document.body);
  if (!oppObs && typeof MutationObserver !== "undefined") {
    oppObs = new MutationObserver((ms) => { if (!opps.size) return; ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) hideOpps(n); })); });
    oppObs.observe(document.body, { childList: true, subtree: true });
  }
}
export const isOpp = (handle) => !!handle && opps.has(handle);
export function hideOpps(root) {
  if (!opps.size || !root || !root.querySelectorAll) return;
  const links = [...root.querySelectorAll('a.rop-name[href^="/games/profile/?u="]')];
  if (root.matches && root.matches('a.rop-name[href^="/games/profile/?u="]')) links.push(root);
  links.forEach((a) => {
    const h = decodeURIComponent((a.getAttribute("href").split("u=")[1] || "").split(/[&#]/)[0]);
    if (!opps.has(h) || a.closest("[data-no-opp-hide]")) return;
    const box = a.closest(".rop-rep, .gm-review, .pf-note, .fd-item, .fr-c, .fr-post, article, li");
    if (box && !box.hidden) { box.hidden = true; box.dataset.opp = "1"; }
  });
}
export function unreadBadge(node) {
  const b = el("span", { class: "rop-badge", hidden: true });
  node.append(b);
  const tick = () => sb.rpc("dm_unread").then(({ data, error }) => {
    if (error) return; const n = +data || 0; b.hidden = !n; b.textContent = n > 99 ? "99+" : String(n);
    node.setAttribute("aria-label", "Buddies and messages" + (n ? ", " + n + " unread" : ""));
  }, () => {});
  tick(); setInterval(() => { if (!document.hidden) tick(); }, 60000);
  return node;
}
const OP_ICO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/><path d="M7 8l2 2-2 2M11 12h4"/></svg>';
/* a heart with a fist inside it */
const BUD_ICO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.3-9.4C1.4 8 3.6 4.5 7.1 4.5c2 0 3.7 1.1 4.9 2.8 1.2-1.7 2.9-2.8 4.9-2.8 3.5 0 5.7 3.5 4.4 7.1C19.5 16.4 12 21 12 21z" fill="currentColor"/><path d="M8.6 10.2h5.6a1.3 1.3 0 0 1 1.3 1.3v2.4a2.6 2.6 0 0 1-2.6 2.6h-2.3a2 2 0 0 1-2-2v-4.3zM10.5 10.2v1.6M12.4 10.2v1.6M8.6 12.4h1.6" fill="#fff" stroke="#b0123f" stroke-width="1" stroke-linejoin="round"/></svg>';
function buddiesBtn() { return unreadBadge(el("a", { class: "rop-me__btn rop-me__bud", href: "/games/buddies/" }, el("span", { class: "rop-me__budi", html: BUD_ICO }), el("span", { text: "Buddies & messages" }))); }

function discordSvg() {
  const ns = "http://www.w3.org/2000/svg", s = document.createElementNS(ns, "svg"), p = document.createElementNS(ns, "path");
  s.setAttribute("viewBox", "0 0 127.14 96.36"); s.setAttribute("fill", "currentColor");
  p.setAttribute("d", "M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z");
  s.append(p); return s;
}

/* Ratings / Forums: two big main tabs (your profile lives in the account box) */
export function subnav(box, active) {
  if (!box) return;
  const tabs = [["ratings", "Ratings", "Score and review games", "/games/", "M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z"],
                ["forum", "Forums", "Talk with the community", "/games/forum/", "M4 5h16v10H9l-5 4zM8 9h8M8 12h5"]];
  box.classList.add("rop-tabs--big");
  box.replaceChildren(...tabs.map(([k, label, sub, href, d]) => {
    const ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg"), path = document.createElementNS(ns, "path");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round"); svg.setAttribute("aria-hidden", "true"); svg.classList.add("rop-tab__i");
    path.setAttribute("d", d); svg.append(path);
    const ico = k === "ratings" ? Object.assign(chipSvg(5), { className: "rop-chip__svg rop-tab__i rop-tab__chip" }) : svg;
    return el("a", { class: "rop-tab rop-tab--big" + (k === active ? " is-on" : ""), href, "aria-current": k === active ? "page" : null },
      ico, el("span", { class: "rop-tab__t" }, el("b", { text: label }), el("small", { text: sub })));
  }));
}

/* Share: the phone share sheet when there is one, otherwise copy the link */
export async function share(url, title) {
  const full = new URL(url, location.origin).href;
  try { if (navigator.share) { await navigator.share({ title, url: full }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(full); toast("Link copied", "ok"); sfx("copy"); }
  catch (e) { prompt("Copy this link:", full); }
}

/* the link-preview page for a game (games/s/, built daily for rated games) when there is one, else the game page */
export async function shareUrlFor(id) {
  const m = /^([A-Za-z0-9]+):([a-z0-9-]{1,90})$/.exec(id || "");
  if (m) try { const r = await fetch("/games/s/" + m[1] + "/" + m[2] + ".html", { method: "HEAD" }); if (r.ok) return "/games/s/" + m[1] + "/" + m[2] + ".html"; } catch (e) {}
  return "/games/game/?id=" + encodeURIComponent(id);
}

/* ---------------- rating chips: a little CPU chip with a face, 0 (miserable) to 5 (overjoyed) ---------------- */
const CHIP_FACE = [
  // eyes, mouth (drawn in the chip's 24x24 die, centre 20,20)
  '<path d="M14.5 15.5l3 3m0-3l-3 3M22.5 15.5l3 3m0-3l-3 3"/><path d="M14.5 27c2-3.4 9-3.4 11 0"/><path d="M27 19.5c.9 1.2.9 2.4 0 3.1" stroke-width="1.2"/>',
  '<path d="M14 15.2l3.2 1.2M26 15.2l-3.2 1.2"/><circle cx="16" cy="18.3" r="1.3" fill="currentColor" stroke="none"/><circle cx="24" cy="18.3" r="1.3" fill="currentColor" stroke="none"/><path d="M15 26.4c2.2-2.6 7.8-2.6 10 0"/>',
  '<circle cx="16" cy="17.8" r="1.3" fill="currentColor" stroke="none"/><circle cx="24" cy="17.8" r="1.3" fill="currentColor" stroke="none"/><path d="M15.5 25.6c2-1.3 7-1.3 9 0"/>',
  '<circle cx="16" cy="17.8" r="1.3" fill="currentColor" stroke="none"/><circle cx="24" cy="17.8" r="1.3" fill="currentColor" stroke="none"/><path d="M15.5 24.6h9"/>',
  '<circle cx="16" cy="17.6" r="1.3" fill="currentColor" stroke="none"/><circle cx="24" cy="17.6" r="1.3" fill="currentColor" stroke="none"/><path d="M15 23.4c2.4 2.6 7.6 2.6 10 0"/>',
  '<path d="M13.8 18.4c.8-2 3.6-2 4.4 0M21.8 18.4c.8-2 3.6-2 4.4 0"/><path d="M14 22.2h12c0 4.4-3 6.2-6 6.2s-6-1.8-6-6.2z" fill="currentColor" fill-opacity=".9"/><path d="M16.5 26.5c2 1.3 5 1.3 7 0" stroke="var(--chip-bg,#0f1216)" stroke-width="1.1"/>',
];
const CHIP_PINS = '<path d="M14 5v3M20 5v3M26 5v3M14 32v3M20 32v3M26 32v3M5 14h3M5 20h3M5 26h3M32 14h3M32 20h3M32 26h3"/>';
export const CHIP_WORD = ["Awful", "Bad", "Meh", "Okay", "Great", "Must play"];
/* the rating chips are "the Chippers"; each mood has a name */
export const CHIPPER = ["Poobar", "Eskritt", "Meepo", "Gibby", "Perisa", "Fromie"];
export function chipSvg(n) {
  const w = document.createElement("span");
  w.className = "rop-chip__svg"; w.setAttribute("aria-hidden", "true");
  w.innerHTML = '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
    + CHIP_PINS + '<rect x="8" y="8" width="24" height="24" rx="4.5" fill="var(--chip-bg,#0f1216)"/><circle cx="11.6" cy="11.6" r=".9" fill="currentColor" stroke="none" opacity=".6"/>'
    + CHIP_FACE[n] + '</svg>';
  return w;
}
/* the 0..5 picker: each chip is its own mood; the chosen one lights up */
export function chipRow(current, onPick, label) {
  const row = el("div", { class: "gm-rate rop-chips", role: "radiogroup", "aria-label": label || "Your rating" });
  for (let i = 0; i <= 5; i++) {
    const on = current === i;
    row.append(el("button", { class: "rop-chip rop-chip--" + i + (on ? " is-on" : ""), type: "button", role: "radio", "aria-checked": on ? "true" : "false",
      title: on ? i + " · " + CHIPPER[i] + " (" + CHIP_WORD[i] + ") — click again to remove your rating" : i + " out of 5 · " + CHIPPER[i] + " (" + CHIP_WORD[i] + ")", "aria-label": i + " out of 5, " + CHIP_WORD[i],
      onclick: () => onPick(on ? null : i) }, chipSvg(i), el("span", { class: "rop-chip__n", text: String(i) })));
  }
  return row;
}

/* ---------------- links between pages ---------------- */
export const gameUrl = (id) => "/games/game/?id=" + encodeURIComponent(id);
export const platformUrl = (id) => "/games/platform/?p=" + encodeURIComponent(id);
export const compareUrl = (a, b) => "/games/compare/?" + [a ? "a=" + encodeURIComponent(a) : "", b ? "b=" + encodeURIComponent(b) : ""].filter(Boolean).join("&");
/* a platform badge that opens that platform's hub (only use where it isn't already inside another link) */
export const platformLink = (id) => el("a", { class: "gm-console gm-console--link", "data-c": id, "data-f": familyOf(id), href: platformUrl(id), title: platformName(id) + " hub", text: id });

/* ---------------- accent colours for profiles (keys the database accepts) ---------------- */
export const ACCENTS = {
  maroon: "#cd4257", white: "#e9edf2", gray: "#9aa6b4", red: "#ff5a5a", orange: "#ff8c3a", gold: "#f5c542", yellow: "#ffe45c",
  green: "#46d37a", teal: "#2fd1c0", blue: "#4b9bff", purple: "#a374ff", pink: "#ff6fb5",
};
export const accentOf = (k) => ACCENTS[k] || (/^#[0-9a-f]{6}$/i.test(k || "") ? k : ACCENTS.maroon);

/* ---------------- RetroAchievements: platforms it has achievement sets for ---------------- */
export const RA_PLATFORMS = new Set(["PS1", "PS2", "PSP", "NES", "FDS", "SNES", "N64", "GC", "GB", "GBC", "GBA", "DS", "VB", "PokeMini",
  "SG1000", "SMS", "GEN", "SCD", "32X", "SAT", "DC", "GG", "2600", "7800", "Lynx", "Jaguar", "CV", "INTV", "Vectrex", "O2", "ChanF",
  "PCE", "PCECD", "PCFX", "NeoGeo", "NGCD", "NGP", "WS", "3DO", "Arcadia", "SV", "MSX", "CPC", "Apple2", "Arcade", "DOS", "A8", "X68K"]);
export const raSearchUrl = (title) => "https://retroachievements.org/searchresults.php?s=" + encodeURIComponent(title) + "&t=1";
export const raUserUrl = (user) => "https://retroachievements.org/user/" + encodeURIComponent(user);

/* ---------------- backlog: want to play / playing / beaten / dropped ---------------- */
export const BACKLOG = [["want", "Want to play", "📌"], ["playing", "Playing", "🎮"], ["beaten", "Beaten", "🏁"], ["dropped", "Dropped", "💤"]];
export const BACKLOG_LABEL = Object.fromEntries(BACKLOG.map(([k, l, i]) => [k, [l, i]]));
/* a little picker for one game; hides itself until the database has backlogs */
export function backlogPicker(gameId, onChange) {
  const box = el("div", { class: "rop-bl", role: "group", "aria-label": "Your backlog" });
  let cur = null;
  const draw = () => box.replaceChildren(el("span", { class: "rop-bl__lab", text: "My backlog" }), ...BACKLOG.map(([k, label, icon]) =>
    el("button", { class: "rop-bl__b rop-bl__b--" + k + (cur === k ? " is-on" : ""), type: "button", "aria-pressed": cur === k ? "true" : "false",
      title: cur === k ? "Remove from your backlog" : "Mark as " + label.toLowerCase(), onclick: () => pick(cur === k ? null : k) },
      el("span", { "aria-hidden": "true", text: icon + " " }), label)));
  async function pick(k) {
    if (!me.user) { signIn(); return; }
    const was = cur; cur = k; draw();
    const { error } = await sb.rpc("set_backlog", { p_game: gameId, p_status: k || "" });
    if (error) { cur = was; draw(); toast("Couldn't save that: " + error.message, "err"); return; }
    sfx(k ? "success" : "tap"); toast(k ? "Backlog: " + BACKLOG_LABEL[k][0] : "Removed from your backlog", "ok");
    if (onChange) onChange(k, was);
  }
  if (!me.user) { draw(); return box; }
  box.hidden = true;
  sb.from("game_backlog").select("status").eq("game_id", gameId).maybeSingle().then(({ data, error }) => {
    if (error) return;            // database update not run yet
    cur = data ? data.status : null; box.hidden = false; draw();
  }, () => {});
  return box;
}

/* ---------------- review reactions: helpful / funny / agree ---------------- */
export const REACTS = [["helpful", "Helpful", "👍"], ["funny", "Funny", "😂"], ["agree", "Agree", "🤝"],
  ["fire", "Fire", "🔥"], ["mind", "Mind-blown", "🤯"], ["love", "Love", "❤️"], ["disagree", "Disagree", "👎"]];
/* review sorting: [key, label, apply(order on a public_reviews query)]. The choice is remembered per browser. */
export const REVIEW_SORTS = [
  ["new", "Newest", (q) => q.order("created_at", { ascending: false })],
  ["old", "Oldest", (q) => q.order("created_at", { ascending: true })],
  ["helpful", "Most helpful", (q) => q.order("helpful", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false })],
  ["high", "Highest score", (q) => q.order("stars", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false })],
  ["low", "Lowest score", (q) => q.order("stars", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false })]];
export function reviewSort() { try { const k = localStorage.getItem("rop.revsort"); if (REVIEW_SORTS.some((x) => x[0] === k)) return k; } catch (e) {} return "new"; }
export function sortReviews(q, key) { return (REVIEW_SORTS.find((x) => x[0] === key) || REVIEW_SORTS[0])[2](q); }
export function reviewSortPicker(onChange) {
  const sel = el("select", { class: "rop-rsort__s", "aria-label": "Sort reviews" });
  for (const [k, label] of REVIEW_SORTS) sel.append(el("option", { value: k, text: label }));
  sel.value = reviewSort();
  sel.addEventListener("change", () => { try { localStorage.setItem("rop.revsort", sel.value); } catch (e) {} onChange(sel.value); });
  return el("label", { class: "rop-rsort" }, el("span", { text: "Sort" }), sel);
}
/* which of these reviews you've reacted to: Map(review id -> Set(kind)) */
export async function myReactions(ids) {
  const out = new Map();
  if (!ids.length) return out;
  if (!(me.member && me.ready)) return guestReactions("review", ids);
  try {
    const { data } = await sb.from("review_reactions").select("review_id,kind").in("review_id", ids);
    for (const x of data || []) { if (!out.has(x.review_id)) out.set(x.review_id, new Set()); out.get(x.review_id).add(x.kind); }
  } catch (e) {}
  return out;
}
/* r = a public_reviews row (has helpful/funny/agree once round 15 is in). Members react as themselves; everyone
 * else (signed out, or not in the Discord yet) reacts as a visitor. mine = Set of reactions already on. */
export function reactBar(r, mine) {
  if (r.helpful == null) return null;
  const set = mine || new Set();
  const own = !!(me.profile && me.profile.handle && me.profile.handle === r.handle);
  const asMember = me.member && me.ready;
  const bar = el("div", { class: "rop-rx", role: "group", "aria-label": "Reactions to this review" });
  for (const [k, label, icon] of REACTS) {
    if (!(k in r)) continue;   // newer kinds appear once their SQL round is in
    let n = +r[k] || 0, on = set.has(k);
    const b = el("button", { class: "rop-rx__b" + (on ? " is-on" : ""), type: "button", "aria-pressed": on ? "true" : "false", disabled: own, title: own ? "Your own review" : label });
    const draw = () => { b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); b.replaceChildren(el("span", { "aria-hidden": "true", text: icon }), el("span", { class: "rop-rx__l", text: label }), el("b", { text: n ? String(n) : "" })); };
    b.addEventListener("click", async () => {
      on = !on; n += on ? 1 : -1; draw(); if (on) { b.classList.add("rop-rx__b--pop"); setTimeout(() => b.classList.remove("rop-rx__b--pop"), 450); }
      let now;
      try {
        if (asMember) { const { data, error } = await sb.rpc("toggle_review_reaction", { p_review: r.id, p_kind: k }); if (error) throw error; now = data === true; }
        else now = await guestReact("review", r.id, k);
      } catch (e) { on = !on; n += on ? 1 : -1; draw(); toast(e.message || String(e), "err"); return; }
      if (now !== on) { on = now; n = Math.max(0, n + (on ? 1 : -1)); draw(); }
      if (on) set.add(k); else set.delete(k);
      sfx(on ? "success" : "tap");
    });
    draw(); bar.append(b);
  }
  return bar;
}
/* ---------------- static game info (assets/data/gameinfo/<3-hex shard>.json) ---------------- */
const fnv1a = (s) => { let h = 0x811c9dc5; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
export const shardOf = (s) => (fnv1a(s) & 0xfff).toString(16).padStart(3, "0");
const shardCache = new Map();
export async function gameInfo(id) {
  const k = shardOf(id);
  if (!shardCache.has(k)) shardCache.set(k, fetch("/assets/data/gameinfo/" + k + ".json").then((r) => r.ok ? r.json() : {}, () => ({})).catch(() => ({})));
  const j = await shardCache.get(k);
  return (j && j[id]) || {};
}

/* ---------------- visitor reactions (no sign-in needed) ----------------
 * Each browser gets a random visitor key; the database keeps only a hash of it and rate-limits it. */
export function visitorKey() {
  try {
    let k = localStorage.getItem("rop.visitor");
    if (!k || !/^[A-Za-z0-9_-]{20,64}$/.test(k)) {
      const a = new Uint8Array(24); crypto.getRandomValues(a);
      k = Array.from(a, (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"[b & 63]).join("");
      localStorage.setItem("rop.visitor", k);
    }
    return k;
  } catch (e) { return null; }
}
/* which of these items this browser reacted to as a visitor: Map(id -> Set(reaction)) */
export async function guestReactions(target, ids) {
  const out = new Map(), k = visitorKey();
  if (!k || !ids.length) return out;
  try {
    const { data } = await sb.rpc("guest_my_reactions", { p_target: target, p_ids: ids, p_key: k });
    for (const x of data || []) { if (!out.has(x.target_id)) out.set(x.target_id, new Set()); out.get(x.target_id).add(x.reaction); }
  } catch (e) {}
  return out;
}
/* flip one visitor reaction; resolves to the new state (true = on) or throws with a readable message */
export async function guestReact(target, id, reaction) {
  const k = visitorKey();
  if (!k) throw new Error("Your browser is blocking storage, so reactions can't be saved.");
  const { data, error } = await sb.rpc("guest_react", { p_target: target, p_id: id, p_reaction: reaction, p_key: k });
  if (error) throw new Error(/guest_react|function|schema cache/i.test(error.message) ? "Visitor reactions switch on with the next site update." : error.message);
  return data === true;
}

/* ---------------- two scores: Verified (Discord members) and Open-Vote (members + visitors) ----------------
 * Visitors rate without signing in; their votes only count toward the Open-Vote score.
 * Until the database update that adds the Open-Vote columns is run, pages ask for the old columns only. */
export const SCORE_COLS = "id,console,title,votes,average";
let openProbe = null;
export function hasOpenScores() {
  if (!openProbe) openProbe = sb.from("game_scores").select("id,open_votes").limit(1).then((r) => !r.error, () => false);
  return openProbe;
}
export async function scoreCols(base) { return (base || SCORE_COLS) + ((await hasOpenScores()) ? ",open_votes,open_average,visitor_votes" : ""); }
export const fmtScore = (avg, votes) => votes > 0 ? Number(avg).toFixed(1) : "–";
/* the two scores side by side, for cards and lists; null when the Open-Vote columns aren't there yet */
export function scorePair(g, compact) {
  if (g.open_votes === undefined) return null;
  const v = (n) => n === 1 ? "1 vote" : Number(n || 0).toLocaleString() + " votes";
  const pill = (cls, icon, label, avg, n, tip) => el("span", { class: "rop-sc rop-sc--" + cls, title: tip },
    el("span", { class: "rop-sc__i", "aria-hidden": "true", text: icon }), el("span", { class: "rop-sc__l", text: label }),
    el("b", { text: fmtScore(avg, n) }), compact ? null : el("span", { class: "rop-sc__n", text: v(n) }));
  return el("span", { class: "rop-scores" + (compact ? " rop-scores--c" : "") },
    pill("v", "✔", "Verified", g.average, g.votes, "Verified Review Score: Verified members only, from the Discord server or a confirmed DMA account (" + v(g.votes) + ")"),
    pill("o", "🌐", "Open-Vote", g.open_average, g.open_votes, "Open-Vote Review Score: members and visitors together (" + v(g.open_votes) + ", " + v(g.visitor_votes) + " from visitors)"));
}
/* this browser's own visitor ratings: Map(game id -> stars) */
export async function guestRatings(ids) {
  const out = new Map(), k = visitorKey();
  if (!k || !ids.length) return out;
  try { const { data } = await sb.rpc("guest_my_ratings", { p_ids: ids, p_key: k }); for (const x of data || []) out.set(x.game_id, x.stars); } catch (e) {}
  return out;
}
/* set (0-5) or clear (null) this browser's visitor rating; throws with a readable message */
export async function guestRate(id, stars) {
  const k = visitorKey();
  if (!k) throw new Error("Your browser is blocking storage, so visitor ratings can't be saved.");
  const { error } = await sb.rpc("guest_rate", { p_game: id, p_stars: stars, p_key: k });
  if (error) throw new Error(/guest_rate|function|schema cache/i.test(error.message) ? "Visitor ratings switch on with the next site update." : error.message);
  try { const v = new Set(visitorRated()); if (stars == null) v.delete(id); else v.add(id); localStorage.setItem(VRATED, JSON.stringify([...v].slice(-5000))); } catch (e) {}
  if (!me.member) emitStats(true);
}
export const VISITOR_NOTE = "Visitor vote: counts toward the Open-Vote score. Join the Discord to make it Verified.";

/* ---------------- smarter title search ----------------
 * "battlecity" finds "Battle City", "zelda link past" finds "The Legend of Zelda: A Link to the Past",
 * "ratchet and clank" finds "Ratchet & Clank". Uses the database's skey column (title without spaces,
 * punctuation, "the" and "and") once it exists; plain title search before that. */
export const searchKey = (t) => String(t || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .replace(/\b(the|and)\b|&/g, "").replace(/[^a-z0-9]+/g, "");
let skeyProbe = null, skeyOk = false;
export function hasSearchKey() {
  if (!skeyProbe) skeyProbe = sb.from("game_scores").select("id,skey").limit(1).then((r) => (skeyOk = !r.error), () => false);
  return skeyProbe;
}
/* add a title filter to a game_scores query. Not async on purpose (query builders are thenables):
 * await hasSearchKey() once before calling it. */
export function titleSearch(req, q) {
  const raw = String(q || "").trim();
  const words = raw.replace(/[%_*,()."\\]/g, " ").split(/\s+/).filter(Boolean);
  if (!skeyOk) return req.ilike("title", "%" + raw.replace(/[%_]/g, " ") + "%");
  const k = searchKey(raw);
  // every word in order, with anything between ("zelda link past"), or the squashed key ("battlecity")
  const loose = "*" + words.join("*") + "*";
  return k ? req.or("title.ilike." + loose + ",skey.ilike.*" + k + "*") : req.ilike("title", loose.replace(/\*/g, "%"));
}

/* ---------------- notifications bell (signed-in members) ----------------
 * Reactions, replies and guestbook notes on your stuff. Opening the list marks everything read. */
const NOTE_TEXT = {
  reply: (n, who) => n > 1 ? n + " new replies on your thread, latest from " + (who || "someone") : (who || "Someone") + " replied to your thread",
  reaction: (n, who) => (who || "A visitor") + (n > 1 ? " and " + (n - 1) + " more reacted" : " reacted") + " to your post",
  review_reaction: (n, who) => (who || "A visitor") + (n > 1 ? " and " + (n - 1) + " more reacted" : " reacted") + " to your review",
  follow: (n, who) => (who || "Someone") + (n > 1 ? " and " + (n - 1) + " more followed you" : " followed you"),
  list_like: (n, who) => (who || "Someone") + (n > 1 ? " and " + (n - 1) + " more liked" : " liked") + " your list",
  wall: (n, who) => (who || "Someone") + (n > 1 ? " and others left " + n + " notes" : " signed") + " your guestbook",
  buddy: (n, who, snip) => (who || "Someone") + " " + (snip || "wants to be buddies"),
  dm: (n, who) => (n > 1 ? n + " new messages from " : "New message from ") + (who || "someone"),
};
const NOTE_ICON = { reply: "💬", reaction: "✨", review_reaction: "👍", wall: "📝", follow: "👋", list_like: "♥", buddy: "🤝", dm: "✉️" };
let bellTimer = 0;
export function bell() {
  const count = el("span", { class: "rop-bell__n", hidden: true });
  const panel = el("div", { class: "rop-bell__panel", hidden: true, role: "dialog", "aria-label": "Notifications" });
  const b = el("button", { class: "rop-bell", type: "button", "aria-label": "Notifications", "aria-expanded": "false", title: "Notifications" },
    el("span", { "aria-hidden": "true", text: "🔔" }), count);
  const wrap = el("div", { class: "rop-bell__wrap", hidden: true }, b, panel);
  let rows = [];
  const draw = () => {
    const unread = rows.filter((r) => !r.read).length;
    count.hidden = !unread; count.textContent = unread > 9 ? "9+" : String(unread);
    b.setAttribute("aria-label", unread ? unread + " new notifications" : "Notifications");
    panel.replaceChildren(el("p", { class: "rop-bell__h", text: "Notifications" }),
      rows.length ? el("ul", { class: "rop-bell__list" }, ...rows.map((r) => el("li", { class: r.read ? "" : "is-new" },
        el("a", { href: r.link }, el("span", { class: "rop-bell__i", "aria-hidden": "true", text: NOTE_ICON[r.kind] || "•" }),
          el("span", { class: "rop-bell__t" }, el("b", { text: (NOTE_TEXT[r.kind] || (() => "Something happened"))(r.n, r.actor_name, r.snippet) }),
            r.snippet && r.kind !== "buddy" ? el("span", { class: "rop-bell__s", text: r.snippet }) : null,
            el("span", { class: "rop-bell__when", text: ago(r.created_at) }))))))
        : el("p", { class: "gm-note", text: "Nothing yet. Reactions, replies and guestbook notes show up here." }));
  };
  const load = () => sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(25).then(({ data, error }) => {
    if (error) return;            // database update not run yet: no bell
    rows = data || []; wrap.hidden = false; draw();
  }, () => {});
  b.addEventListener("click", async () => {
    const open = panel.hidden;
    panel.hidden = !open; b.setAttribute("aria-expanded", String(open));
    if (open && rows.some((r) => !r.read)) {
      try { await sb.rpc("mark_notifications_read"); } catch (e) {}
      setTimeout(() => { rows.forEach((r) => { r.read = true; }); count.hidden = true; }, 1500);
    }
  });
  document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) { panel.hidden = true; b.setAttribute("aria-expanded", "false"); } });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { panel.hidden = true; b.setAttribute("aria-expanded", "false"); } });
  load();
  clearInterval(bellTimer);
  bellTimer = setInterval(() => { if (wrap.isConnected && document.visibilityState === "visible" && panel.hidden) load(); }, 120000);
  return wrap;
}

/* ---------------- report button (anyone; visitors use their visitor key) ---------------- */
export async function reportItem(kind, id, reason) {
  const col = { post: "post_id", comment: "comment_id", review: "review_id", wall: "wall_id", media: "media_id", reply: "reply_id" }[kind];
  const r = await sb.rpc("report_item", { p_kind: kind, p_id: id, p_reason: reason, p_key: visitorKey() });
  if (!r.error) return null;
  if (/report_item|function|schema cache/i.test(r.error.message) && me.member && me.user && kind !== "wall") {   // before the database update
    const x = await sb.from("forum_reports").insert({ user_id: me.user.id, reason: reason || null, [col]: id });
    return x.error ? x.error.message : null;
  }
  return r.error.message;
}
export function reportBtn(kind, id, cls) {
  return el("button", { class: "linkbtn " + (cls || "gm-report"), type: "button", text: "Report", title: "Tell the moderators about this", onclick: async (e) => {
    const b = e.currentTarget;
    const reason = prompt("What's wrong with it? (optional)");
    if (reason === null) return;
    b.disabled = true;
    const err = await reportItem(kind, id, reason.trim().slice(0, 300));
    b.textContent = err ? "Couldn't report" : "Reported, thanks";
    if (err) { b.title = err; b.disabled = false; }
  } });
}

/* ---------------- box art (libretro-thumbnails; hidden if the picture doesn't exist) ---------------- */
export function boxArtUrl(a) {
  if (a && typeof a === "object") {
    if (a.g && /^ps3\/cover\/[A-Z]{2}\/[A-Z]{4}\d{5}$/.test(a.g)) return "https://art.gametdb.com/" + a.g + ".jpg";
    if (a.a) return boxArtUrl(a.a);
    if (a.sa) return "https://cdn.cloudflare.steamstatic.com/steam/apps/" + encodeURIComponent(a.sa) + "/library_600x900.jpg";
    if (a.ra && /^https:\/\/media\.rawg\.io\//.test(a.ra)) return a.ra;
    if (a.mc && a.mc.startsWith(MEDIA_URL)) return a.mc;   // a member's uploaded cover
    return null;
  }
  if (!a) return null;
  const i = a.indexOf("/"); if (i < 1) return null;
  return "https://thumbnails.libretro.com/" + encodeURIComponent(a.slice(0, i)) + "/Named_Boxarts/" + encodeURIComponent(a.slice(i + 1)) + ".png";
}
export function boxArt(a, title, cls) {
  const src = boxArtUrl(a); if (!src) return null;
  const img = el("img", { class: "rop-art " + (cls || ""), src, alt: "Box art: " + (title || ""), loading: "lazy", decoding: "async", referrerpolicy: "no-referrer" });
  img.addEventListener("error", () => {
    // Steam: not every game has the tall cover; fall back to the wide header once
    if (/library_600x900\.jpg$/.test(img.src)) { img.src = img.src.replace("library_600x900.jpg", "header.jpg"); img.classList.add("is-wide"); return; }
    img.remove();
  });
  img.addEventListener("load", () => img.classList.add("is-in"));
  return img;
}
/* members' uploaded covers (round 24), used where no automatic cover exists. Lookups made in the same moment
 * are sent as one query. Resolves to { mc, by, handle, id } or null. */
const MEDIA_URL = "https://zjhlhkruqzfendvbglsb.supabase.co/storage/v1/object/public/game-media/";
const coverCache = new Map(); let coverQueue = null;
export function memberCover(id) {
  if (coverCache.has(id)) return coverCache.get(id);
  const p = new Promise((res) => {
    if (!coverQueue) {
      coverQueue = new Map();
      setTimeout(async () => {
        const q = coverQueue; coverQueue = null;
        let rows = [];
        try { const r = await sb.from("public_game_covers").select("id,game_id,url,handle,author").in("game_id", [...q.keys()]); rows = r.error ? [] : r.data || []; } catch (e) {}
        const got = new Map(rows.map((x) => [x.game_id, { mc: x.url, by: x.author, handle: x.handle, id: x.id }]));
        for (const [k, fns] of q) fns.forEach((f) => f(got.get(k) || null));
      }, 30);
    }
    (coverQueue.get(id) || coverQueue.set(id, []).get(id)).push(res);
  });
  coverCache.set(id, p);
  return p;
}
export function forgetCover(id) { coverCache.delete(id); }
export const hasAutoArt = (x) => !!(x && (x.g || x.a || x.sa || x.ra));
/* fill box art into elements later (cards render first, art arrives with the info shard) */
export function artSlot(id, title, cls) {
  const slot = el("span", { class: "rop-artslot " + (cls || ""), "aria-hidden": "true" });
  gameInfo(id).then(async (x) => {
    let img = hasAutoArt(x) ? boxArt(x, title) : null;
    if (!img) { const c = await memberCover(id); img = c ? boxArt(c, title) : null; }
    if (img) slot.append(img); else slot.remove();
  }, () => slot.remove());
  return slot;
}

/* ---------------- hover cards: a game's cover, blurb and both scores; a member's mini profile ----------------
   Mouse and keyboard focus only (touch taps just follow the link). One card at a time. */
let hcEl = null, hcFor = null, hcT = 0;
const hcCache = new Map();
function hcHide() { clearTimeout(hcT); if (hcEl) hcEl.remove(); hcEl = null; hcFor = null; }
function hcPlace(card, a) {
  const r = a.getBoundingClientRect(), w = card.offsetWidth, h = card.offsetHeight;
  let x = r.left + r.width / 2 - w / 2, y = r.bottom + 8;
  x = Math.max(8, Math.min(x, innerWidth - w - 8));
  if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 8);
  card.style.left = x + "px"; card.style.top = y + "px";
}
export function hoverCard(a, kind, key) {
  if (!a || !key || !(window.matchMedia && matchMedia("(hover: hover)").matches)) return a;
  const show = () => { clearTimeout(hcT); hcT = setTimeout(async () => {
    const ck = kind + ":" + key;
    if (!hcCache.has(ck)) hcCache.set(ck, (kind === "game" ? hcGame(key) : hcMember(key)).catch(() => null));
    const body = await hcCache.get(ck); if (!body || !a.isConnected) return;
    hcHide(); hcFor = a;
    hcEl = el("div", { class: "rop-hc rop-hc--" + kind, role: "tooltip" }); hcEl.append(body.cloneNode(true));
    document.body.append(hcEl); hcPlace(hcEl, a);
  }, 260); };
  const hide = () => { clearTimeout(hcT); hcT = setTimeout(() => { if (hcFor === a) hcHide(); }, 120); };
  a.addEventListener("mouseenter", show); a.addEventListener("focus", show);
  a.addEventListener("mouseleave", hide); a.addEventListener("blur", hide);
  return a;
}
addEventListener("scroll", () => hcHide(), { passive: true });
async function hcGame(id) {
  const [x, sc] = await Promise.all([gameInfo(id), sb.from("game_scores").select("*").eq("id", id).maybeSingle().then((r) => r.data, () => null)]);
  if (!sc) return null;
  const art = el("div", { class: "rop-hc__art" });
  let img = hasAutoArt(x) ? boxArt(x, sc.title) : null;
  if (!img) { const c = await memberCover(id); img = c ? boxArt(c, sc.title) : null; }
  if (img) art.append(img); else art.append(chipSvg(sc.votes ? Math.round(Number(sc.average)) : 3));
  const d = x && typeof x.d === "string" ? x.d.trim() : "";
  const blurb = d ? (d.match(/^.{40,240}?[.!?](\s|$)/) || [d.slice(0, 200) + "…"])[0].trim() : "";
  const sc5 = (avg, n) => n > 0 ? el("span", { class: "rop-hc__sc rop-chip--" + Math.round(Number(avg)) }, chipSvg(Math.round(Number(avg))), el("b", { text: Number(avg).toFixed(1) }), el("small", { text: n + (n === 1 ? " vote" : " votes") }))
    : el("span", { class: "rop-hc__sc rop-hc__sc--none", text: "Not rated yet" });
  return el("div", { class: "rop-hc__in" }, art,
    el("div", { class: "rop-hc__body" },
      el("div", { class: "rop-hc__top" }, consoleChip(sc.console), x && x.y ? el("span", { class: "rop-hc__year", text: String(x.y) }) : null),
      el("b", { class: "rop-hc__t", text: sc.title }),
      blurb ? el("p", { class: "rop-hc__d", text: blurb }) : null,
      el("div", { class: "rop-hc__scores" },
        el("span", { class: "rop-hc__lab", text: "Verified" }), sc5(sc.average, sc.votes || 0),
        "open_votes" in sc ? el("span", { class: "rop-hc__lab", text: "Open-Vote" }) : null, "open_votes" in sc ? sc5(sc.open_average, sc.open_votes || 0) : null)));
}
async function hcMember(handle) {
  const { data: p } = await sb.from("member_profiles").select("*").eq("handle", handle).maybeSingle();
  if (!p) return null;
  const stat = (n, l) => el("span", { class: "rop-hc__st" }, el("b", { text: String(n || 0) }), el("small", { text: l }));
  return el("div", { class: "rop-hc__in rop-hc__in--m", style: "--acc:" + accentOf(p.accent) },
    avatar(p.avatar, p.name, 52, "rop-hc__av"),
    el("div", { class: "rop-hc__body" },
      el("b", { class: "rop-hc__t" }, p.name, p.is_owner ? ownerTag() : null, p.is_staff ? adminTag() : null),
      p.motto ? el("p", { class: "rop-hc__motto " + colorClass(p.motto_color), text: "“" + p.motto + "”" }) : null,
      el("div", { class: "rop-hc__stats" }, stat(p.votes, "votes"), stat(p.reviews, "reviews"), stat(p.posts, "posts")),
      p.member_since ? el("small", { class: "rop-hc__since", text: "Member since " + memberSince(p.member_since) }) : null));
}

/* ---------------- review formatting (stored as plain text with light marks; rendered as DOM, never as HTML) ----------------
 * **bold**   *italic*   ||spoiler||   lines starting "- " make a bullet list, "1. " a numbered list. One font throughout. */
const RT_INLINE = /(\*\*([^*\n]+?)\*\*|\|\|([^|\n]+?)\|\||\*([^*\n]+?)\*|_([^_\n]+?)_)/;
function rtInline(s) {
  const f = document.createDocumentFragment();
  while (s) {
    const m = s.match(RT_INLINE);
    if (!m) { f.append(s); break; }
    if (m.index) f.append(s.slice(0, m.index));
    if (m[2] != null) f.append(el("strong", null, rtInline(m[2])));
    else if (m[3] != null) {
      const sp = el("span", { class: "rop-spoil", role: "button", tabindex: "0", title: "Spoiler: click to show", "aria-label": "Spoiler, click to show" }, rtInline(m[3]));
      const flip = (e) => { e.stopPropagation(); sp.classList.toggle("is-shown"); sp.setAttribute("aria-label", sp.classList.contains("is-shown") ? "Spoiler shown" : "Spoiler, click to show"); };
      sp.addEventListener("click", flip); sp.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(e); } });
      f.append(sp);
    } else f.append(el("em", null, rtInline(m[4] != null ? m[4] : m[5])));
    s = s.slice(m.index + m[0].length);
  }
  return f;
}
export function richText(src) {
  const f = document.createDocumentFragment();
  let list = null, kind = "", para = null;
  for (const line of String(src || "").split("\n")) {
    const ub = line.match(/^\s*[-*•]\s+(.*)$/), ob = line.match(/^\s*\d{1,3}[.)]\s+(.*)$/);
    const k = ub ? "ul" : ob ? "ol" : "";
    if (k) {
      if (kind !== k) { list = el(k, { class: "rop-rt__list" }); f.append(list); kind = k; }
      list.append(el("li", null, rtInline((ub || ob)[1]))); para = null; continue;
    }
    kind = ""; list = null;
    if (!line.trim()) { para = null; continue; }
    if (para) para.append(el("br"), rtInline(line));
    else { para = el("p", { class: "rop-rt__p" }, rtInline(line)); f.append(para); }
  }
  return f;
}
/* for short snippets: marks removed, spoilers hidden */
export function plainText(src) {
  return String(src || "").replace(/\|\|[^|\n]+?\|\|/g, "[spoiler]").replace(/\*\*([^*\n]+?)\*\*/g, "$1").replace(/\*([^*\n]+?)\*/g, "$1").replace(/_([^_\n]+?)_/g, "$1")
    .replace(/^\s*(?:[-*•]|\d{1,3}[.)])\s+/gm, "• ");
}
const RT_EMOJI = ["🔥", "😂", "😍", "🤯", "😭", "😤", "👍", "👎", "💯", "🎮", "🕹️", "🏆", "💀", "👀", "🤔", "😴", "❤️", "⭐", "🎉", "🫡"];
export function fmtBar(ta) {
  const fire = () => ta.dispatchEvent(new Event("input", { bubbles: true }));
  const wrap = (a, b, ph) => {
    const s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e) || ph;
    ta.setRangeText(a + sel + b, s, e, "end");
    if (s === e) { ta.selectionStart = s + a.length; ta.selectionEnd = s + a.length + sel.length; }
    ta.focus(); fire();
  };
  const lines = (mk) => {
    const s = ta.value.lastIndexOf("\n", ta.selectionStart - 1) + 1, e0 = ta.value.indexOf("\n", ta.selectionEnd), e = e0 < 0 ? ta.value.length : e0;
    const out = ta.value.slice(s, e).split("\n").map((l, i) => l.replace(/^\s*(?:[-*•]|\d{1,3}[.)])\s+/, "")).map((l, i) => mk(i) + l).join("\n");
    ta.setRangeText(out, s, e, "end"); ta.focus(); fire();
  };
  const b = (label, title, fn, cls) => el("button", { class: "rop-fmt__b " + (cls || ""), type: "button", title, "aria-label": title, onmousedown: (e) => e.preventDefault(), onclick: fn }, label);
  const pop = el("div", { class: "rop-fmt__pop", hidden: true, role: "menu" });
  for (const em of RT_EMOJI) pop.append(el("button", { class: "rop-fmt__em", type: "button", text: em, onmousedown: (e) => e.preventDefault(),
    onclick: () => { ta.setRangeText(em, ta.selectionStart, ta.selectionEnd, "end"); pop.hidden = true; ta.focus(); fire(); } }));
  const emb = b("😀", "Emoji", () => { pop.hidden = !pop.hidden; });
  document.addEventListener("click", (e) => { if (!pop.hidden && !pop.contains(e.target) && e.target !== emb) pop.hidden = true; });
  ta.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === "b") { e.preventDefault(); wrap("**", "**", "bold"); } else if (k === "i") { e.preventDefault(); wrap("*", "*", "italic"); }
  });
  return el("div", { class: "rop-fmt", role: "toolbar", "aria-label": "Formatting" },
    b(el("b", { text: "Bold" }), "Bold (Ctrl+B)", () => wrap("**", "**", "bold")),
    b(el("i", { text: "Italic" }), "Italic (Ctrl+I)", () => wrap("*", "*", "italic")),
    b("• List", "Bullet list", () => lines(() => "- ")),
    b("1. List", "Numbered list", () => lines((i) => (i + 1) + ". ")),
    b("Spoiler", "Hide a spoiler (readers click to show it)", () => wrap("||", "||", "spoiler"), "rop-fmt__b--sp"),
    el("span", { class: "rop-fmt__emw" }, emb, pop));
}

/* ---------------- reviews ---------------- */
/* Your own review shows in the list like everyone else's, with an "Edit review" button. Editing turns that same
   review into the text box in place (one box only); Save replaces the posted text. The write box only appears when
   you haven't reviewed the game yet. */
export async function reviewsPanel(g, box, opts = {}) {
  const user = me.user, member = me.member, reviews = (g2, b2) => reviewsPanel(g2, b2, opts);
  box.replaceChildren(el("p", { class: "gm-empty", text: "Loading…" }));
  const { data } = await sortReviews(sb.from("public_reviews").select("*").eq("game_id", g.id), reviewSort()).limit(opts.limit || 20);
  box.replaceChildren();
  if ((data || []).length > 1) box.append(el("div", { class: "gm-review__bar" }, el("span", { class: "gm-note", text: data.length + (data.length >= (opts.limit || 20) ? "+" : "") + " reviews" }), reviewSortPicker(() => reviews(g, box))));
  const rx = await myReactions((data || []).map((r) => r.id));
  const reps = await loadReplies((data || []).map((r) => r.id));
  const myHandle = me.profile && me.profile.handle;
  let mineShown = false;
  for (const r of data || []) {
    const isMine = !!(myHandle && r.handle === myHandle);
    if (isMine) mineShown = true;
    const when = el("time", { class: "gm-review__when", datetime: r.created_at, "data-when": r.created_at, text: fmtWhen(r.created_at) });
    const head = el("header", { class: "gm-review__head" }, avatar(r.avatar, r.name, 32), el("span", { class: "gm-review__who" }, nameLink(r.handle, r.name || "A member"), r.is_staff ? adminTag() : null, when),
      r.stars != null ? el("span", { class: "gm-review__mood rop-chip--" + r.stars, title: r.stars + " / 5 · " + CHIP_WORD[r.stars] }, chipSvg(r.stars), el("b", { text: String(r.stars) })) : null);
    const body = el("div", { class: "gm-review__body" }, richText(r.body));
    const art = el("article", { class: "gm-review" + (r.stars != null ? " gm-review--s" + r.stars : "") + (isMine ? " gm-review--mine" : "") }, head, body, reactBar(r, rx.get(r.id)));
    if (isMine && member) art.append(rvEditTools(g, box, art, body, r));
    else if (r.id != null && !isMine) art.append(reportBtn("review", r.id));
    if (reps) art.append(replyThread(r, reps.get(r.id) || []));
    box.append(art);
  }
  if (!(data || []).length) box.append(el("p", { class: "gm-empty", text: "No reviews yet." }));
  rvWriteBox(g, box, mineShown, opts);
}

/* "Edit review" on your own posted review: the posted text becomes the editable box right there */
function rvEditTools(g, box, art, body, r) {
  const bar = el("div", { class: "gm-review__mine" });
  const note = el("span", { class: "gm-note", role: "status" });
  const edit = el("button", { class: "rop-me__btn gm-review__edit", type: "button", text: "Edit review", onclick: start });
  bar.append(edit, note);
  function start() {
    const ta = el("textarea", { class: "gm-ta gm-review__ta", maxlength: "1000", rows: String(Math.min(12, Math.max(3, r.body.split("\n").length + 1))), "aria-label": "Edit your review of " + g.title });
    ta.value = r.body;
    const count = el("span", { class: "gm-write__count", text: ta.value.length + " / 1000" });
    ta.addEventListener("input", () => { count.textContent = ta.value.length + " / 1000"; });
    const save = el("button", { class: "btn gm-btn", type: "button", text: "Save changes", onclick: async () => {
      const v = ta.value.trim(); if (v.length < 3) { note.textContent = "Write a little more first."; return; }
      save.disabled = true;
      const { error } = await sb.rpc("edit_my_review", { p_game: g.id, p_body: v });
      save.disabled = false;
      if (error) { note.textContent = /edit_my_review|function|schema cache/i.test(error.message) ? "Editing needs the latest database update." : "That didn't save: " + error.message; return; }
      r.body = v; body.replaceChildren(richText(v)); tb.remove(); ta.replaceWith(body); bar.replaceChildren(edit, note); note.textContent = "Saved.";
      sfx("success");
    } });
    const cancel = el("button", { class: "linkbtn gm-cancel", type: "button", text: "Cancel", onclick: () => { tb.remove(); ta.replaceWith(body); bar.replaceChildren(edit, note); note.textContent = ""; } });
    const tb = fmtBar(ta);
    body.replaceWith(tb, ta); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    note.textContent = "";
    bar.replaceChildren(save, cancel, count, note);
  }
  return bar;
}

/* The write box: only when you haven't reviewed this game yet */
async function rvWriteBox(g, box, mineShown, opts) {
  const user = me.user, member = me.member, reviews = (g2, b2) => reviewsPanel(g2, b2, opts);
  if (!user) { box.append(el("p", { class: "gm-note", text: "Sign in to write a review." })); return; }
  if (!member) { box.append(el("p", { class: "gm-note", text: "Verified members can write reviews." })); return; }
  if (mineShown) return;
  const r = await sb.rpc("my_review", { p_game: g.id });
  if (!r.error && r.data && r.data.length) {        // you have one, but it isn't in the list (hidden by a moderator)
    box.append(el("p", { class: "gm-note", text: r.data[0].hidden ? "Your review of this game is hidden by a moderator." : "You've already reviewed this game." }));
    return;
  }
  const wrap = el("div", { class: "gm-write" });
  const note = el("p", { class: "gm-note", role: "status" });
  const ta = el("textarea", { class: "gm-ta", maxlength: "1000", rows: "3", placeholder: "A few words about this game. Shift+Enter or Enter starts a new line.", "aria-label": "Your review of " + g.title });
  const count = el("span", { class: "gm-write__count", text: "0 / 1000" });
  ta.addEventListener("input", () => { count.textContent = ta.value.length + " / 1000"; });
  const send = el("button", { class: "btn gm-btn", type: "button", text: "Send review", onclick: async () => {
    const body = ta.value.trim(); if (body.length < 3) { note.textContent = "Write a little more first."; return; }
    send.disabled = true;
    const { error } = await sb.from("reviews").insert({ user_id: user.id, game_id: g.id, body });
    send.disabled = false;
    if (error) {
      if (error.code === "23505") { note.textContent = "You've already reviewed this game."; reviews(g, box); return; }
      note.textContent = "That didn't send: " + error.message; return;
    }
    sfx("success"); statsChanged();
    if (opts.onPosted) opts.onPosted(g);
    reviews(g, box);
  } });
  wrap.append(el("p", { class: "gm-write__h", text: "Write a review" }), fmtBar(ta), ta, el("div", { class: "gm-write__bar" }, send, count), note);
  box.append(wrap);
}

/* re-draw shown times when the 12h / 24h switch changes */
window.addEventListener("site:clock", () => document.querySelectorAll("time[data-when]").forEach((t) => { t.textContent = fmtWhen(t.dataset.when); }));

/* ---------------- replies under reviews (round 38). null = the SQL isn't in yet, so the feature stays out of sight ---------------- */
async function loadReplies(ids) {
  if (!ids.length) return new Map();
  try {
    const { data, error } = await sb.from("public_review_replies").select("*").in("review_id", ids).order("created_at", { ascending: true }).limit(1000);
    if (error) return null;
    const m = new Map(); for (const x of data || []) { if (!m.has(x.review_id)) m.set(x.review_id, []); m.get(x.review_id).push(x); }
    return m;
  } catch (e) { return null; }
}
function replyThread(r, list) {
  const wrap = el("div", { class: "rop-reps" });
  const items = el("div", { class: "rop-reps__list" });
  const SHOW = 3; let expanded = list.length <= SHOW;
  const more = el("button", { class: "linkbtn rop-reps__more", type: "button" });
  const draw = () => {
    items.replaceChildren(...(expanded ? list : list.slice(-SHOW)).map((x) => replyItem(x, () => { list.splice(list.indexOf(x), 1); draw(); })));
    more.hidden = expanded; more.textContent = "Show all " + list.length + " replies";
    count.textContent = list.length ? (list.length === 1 ? "1 reply" : list.length + " replies") : "";
  };
  more.addEventListener("click", () => { expanded = true; draw(); });
  const count = el("span", { class: "rop-reps__n" });
  const bar = el("div", { class: "rop-reps__bar" }, count);
  if (me.user && me.member) {
    const open = el("button", { class: "linkbtn rop-reps__open", type: "button", text: "Reply", onclick: () => { open.hidden = true; items.after(composer()); } });
    bar.append(open);
    function composer() {
      const ta = el("textarea", { class: "gm-ta rop-reps__ta", maxlength: "1000", rows: "2", placeholder: "Reply to " + (r.name || "this review") + "…", "aria-label": "Your reply" });
      const note = el("span", { class: "gm-note", role: "status" });
      const box = el("div", { class: "rop-reps__write" });
      const send = el("button", { class: "btn gm-btn", type: "button", text: "Reply", onclick: async () => {
        const v = ta.value.trim(); if (!v) { ta.focus(); return; }
        send.disabled = true;
        const { data, error } = await sb.rpc("add_review_reply", { p_review: r.id, p_body: v });
        send.disabled = false;
        if (error || !data || !data.ok) { note.textContent = (data && data.error) || (error && error.message) || "That didn't send."; return; }
        list.push({ id: data.id, review_id: r.id, body: v, created_at: new Date().toISOString(), name: (me.profile && (me.profile.display_name || me.profile.name)) || "You",
          avatar: me.profile && (me.profile.custom_avatar || me.profile.avatar), handle: me.profile && me.profile.handle, is_staff: me.staff });
        expanded = true; draw(); box.remove(); open.hidden = false; sfx("success");
      } });
      const cancel = el("button", { class: "linkbtn gm-cancel", type: "button", text: "Cancel", onclick: () => { box.remove(); open.hidden = false; } });
      box.append(fmtBar(ta), ta, el("div", { class: "rop-reps__acts" }, send, cancel, note));
      setTimeout(() => ta.focus(), 0);
      return box;
    }
  }
  wrap.append(bar, more, items);
  draw();
  if (!list.length && !(me.user && me.member)) wrap.hidden = true;
  return wrap;
}
function replyItem(x, onGone) {
  const mine = !!(me.profile && me.profile.handle && me.profile.handle === x.handle);
  const body = el("div", { class: "rop-rep__body" }, richText(x.body));
  const when = el("time", { class: "gm-review__when", datetime: x.created_at, "data-when": x.created_at, text: fmtWhen(x.created_at) + (x.edited_at ? " · edited" : "") });
  const acts = el("div", { class: "rop-rep__acts" });
  const item = el("div", { class: "rop-rep", id: "reply-" + x.id },
    avatar(x.avatar, x.name, 24),
    el("div", { class: "rop-rep__main" }, el("div", { class: "rop-rep__head" }, nameLink(x.handle, x.name || "A member"), x.is_staff ? adminTag() : null, when), body, acts));
  if (mine && me.member) {
    const edit = el("button", { class: "linkbtn", type: "button", text: "Edit", onclick: () => {
      const ta = el("textarea", { class: "gm-ta rop-reps__ta", maxlength: "1000", rows: "2" }); ta.value = x.body;
      const tb = fmtBar(ta), note = el("span", { class: "gm-note", role: "status" });
      const done = () => { tb.remove(); ta.replaceWith(body); acts.replaceChildren(edit, del); };
      const save = el("button", { class: "btn gm-btn", type: "button", text: "Save", onclick: async () => {
        const v = ta.value.trim(); if (!v) return;
        const { data, error } = await sb.rpc("edit_review_reply", { p_id: x.id, p_body: v });
        if (error || !data || !data.ok) { note.textContent = (data && data.error) || (error && error.message) || "That didn't save."; return; }
        x.body = v; body.replaceChildren(richText(v)); done(); sfx("success");
      } });
      body.replaceWith(tb, ta); acts.replaceChildren(save, el("button", { class: "linkbtn gm-cancel", type: "button", text: "Cancel", onclick: done }), note); ta.focus();
    } });
    const del = el("button", { class: "linkbtn", type: "button", text: "Delete", onclick: async () => {
      if (!confirm("Delete your reply?")) return;
      const { data, error } = await sb.rpc("delete_review_reply", { p_id: x.id });
      if (error || !data || !data.ok) { toast((data && data.error) || (error && error.message) || "Couldn't delete.", "err"); return; }
      item.remove(); onGone();
    } });
    acts.append(edit, del);
  } else {
    acts.append(reportBtn("reply", x.id));
    if (me.admin) acts.append(el("button", { class: "linkbtn", type: "button", text: "Hide (mod)", onclick: async () => {
      const { error } = await sb.rpc("mod_reply", { p_id: x.id, p_hidden: true });
      if (error) { toast(error.message, "err"); return; } item.remove(); onGone();
    } }));
  }
  return item;
}
