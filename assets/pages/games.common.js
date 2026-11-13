/* pages/games.common.js: shared pieces for every Rate-O-Pedia page (/games/, /games/forum/, /games/profile/, /games/station/).
 * One Supabase client, the Discord sign-in pill, the Ratings / Forums / Profile tabs, avatars, dates and motto colours.
 * The key below is Supabase's publishable key: it is meant to be public. Every permission is enforced by the database.
 */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const SB_URL = "https://zjhlhkruqzfendvbglsb.supabase.co";
const SB_KEY = "sb_publishable_j-EgPXB3ZvKuz_3h8dZaNA_aLgmcQrk";
export const INVITE = "https://discord.gg/U35dt6Qb2A";
import { PLATFORMS, PLATFORM, FAMILIES, FAMILY, platformName, familyOf } from "./games.platforms.js?v=2";
export { PLATFORMS, PLATFORM, FAMILIES, FAMILY, platformName, familyOf };
export const CONSOLES = PLATFORMS.map((p) => p.id);
export const sb = createClient(SB_URL, SB_KEY);

export const $ = (id) => document.getElementById(id);
export function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "text") n.textContent = v; else if (k === "class") n.className = v;
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
  try { const r = sessionStorage.getItem(RETURN_KEY); sessionStorage.removeItem(RETURN_KEY); return r && r.startsWith("/games/") ? r : null; } catch (e) { return null; }
}

/* me = { user, profile, member, banned, ready } ; ready = the round-11 SQL (11_rateopedia_profiles_forums_station.sql) has been run (profiles have handles) */
export const me = { user: null, profile: null, member: false, banned: false, ready: false, admin: false, staff: false, verify: null };
let staffSent = false, trophiesSent = -1;
// The site's trophies live in this browser; copy the count to the profile so others can see it (best effort).
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
  if (!me.user) return me;
  if (session.provider_token && !skipVerify) await verify(session.provider_token, false);   // ask the server to check server membership
  let r = await sb.from("profiles").select(FULL).eq("id", me.user.id).maybeSingle();
  me.ready = !r.error;
  if (r.error) r = await sb.from("profiles").select("is_member,name,avatar").eq("id", me.user.id).maybeSingle();
  me.profile = r.data || null;
  me.banned = !!(me.profile && me.profile.banned);
  me.member = !!(me.profile && me.profile.is_member) && !me.banned;
  if (me.ready) { try { const a = await sb.rpc("is_admin"); me.admin = a.data === true; } catch (e) {} }
  // Admin bubble (set server-side from the Discord role); tells the site trophies about it once per page load
  if (me.ready) { try { const s = await sb.from("profiles").select("is_staff").eq("id", me.user.id).maybeSingle(); me.staff = !!(s.data && s.data.is_staff) && !me.banned; } catch (e) {} }
  if (me.ready && !me.banned) syncTrophies();
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
  box.classList.add("rop-me");
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
  const flair = el("span", { class: "rop-me__flair" }, me.admin ? ownerTag() : null, me.staff ? adminTag() : null);
  const status = me.banned ? el("span", { class: "rop-me__sub gm-bad", text: "This account is suspended." })
    : me.member ? el("span", { class: "rop-me__sub gm-ok", text: "In the server" + (o.okTail ? o.okTail.replace(/^,\s*/, " · ").replace(/\.$/, "") : " · votes count") })
    : el("span", { class: "rop-me__sub", text: "Not in the server yet" });
  const stat = (label) => { const b = el("b", { text: "–" }); return [el("li", null, b, el("span", { text: label })), b]; };
  const [rLi, rB] = stat("Reviews"), [pLi, pB] = stat("Posts"), [cLi, cB] = stat("Comments");
  box.append(
    el("div", { class: "rop-me__head" }, avatar(myAvatar(), myName(), 52, "rop-me__av"),
      el("div", { class: "rop-me__who" }, el("span", { class: "rop-me__line" }, el("b", { class: "rop-me__name", text: myName() }), flair), status)),
    el("ul", { class: "rop-me__stats" }, rLi, pLi, cLi));
  const btns = el("div", { class: "rop-me__btns" });
  if (!me.member && !me.banned) btns.append(el("a", { class: "btn gm-btn rop-me__main", href: INVITE, target: "_blank", rel: "noopener", text: "Join the Discord" }),
    el("button", { class: "rop-me__btn", type: "button", onclick: (e) => recheck(e.currentTarget), text: "I've joined, check again" }));
  if (handle) btns.append(el("a", { class: (me.member ? "btn gm-btn rop-me__main" : "rop-me__btn"), href: profileUrl(handle), text: "My profile" }));
  if (me.admin) btns.append(el("a", { class: "rop-me__btn rop-me__op", href: "/games/station/", text: "Operation Station" }));
  btns.append(el("button", { class: "rop-me__btn rop-me__out", type: "button", text: "Sign out of Discord", onclick: async () => { await sb.auth.signOut(); } }));
  box.append(btns);
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
    return el("a", { class: "rop-tab rop-tab--big" + (k === active ? " is-on" : ""), href, "aria-current": k === active ? "page" : null },
      svg, el("span", { class: "rop-tab__t" }, el("b", { text: label }), el("small", { text: sub })));
  }));
}

/* Share: the phone share sheet when there is one, otherwise copy the link */
export async function share(url, title) {
  const full = new URL(url, location.origin).href;
  try { if (navigator.share) { await navigator.share({ title, url: full }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(full); toast("Link copied", "ok"); sfx("copy"); }
  catch (e) { prompt("Copy this link:", full); }
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
      title: on ? i + " (" + CHIP_WORD[i] + ") — click again to remove your rating" : i + " out of 5 · " + CHIP_WORD[i], "aria-label": i + " out of 5, " + CHIP_WORD[i],
      onclick: () => onPick(on ? null : i) }, chipSvg(i), el("span", { class: "rop-chip__n", text: String(i) })));
  }
  return row;
}
