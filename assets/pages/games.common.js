/* pages/games.common.js: shared pieces for every Rate-O-Pedia page (/games/, /games/forum/, /games/profile/, /games/station/).
 * One Supabase client, the Discord sign-in pill, the Ratings / Forums / Profile tabs, avatars, dates and motto colours.
 * The key below is Supabase's publishable key: it is meant to be public. Every permission is enforced by the database.
 */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const SB_URL = "https://zjhlhkruqzfendvbglsb.supabase.co";
const SB_KEY = "sb_publishable_j-EgPXB3ZvKuz_3h8dZaNA_aLgmcQrk";
export const INVITE = "https://discord.gg/U35dt6Qb2A";
export const CONSOLES = ["PS1", "PS2", "PSP", "Vita", "PS3", "PS4", "PS5"];
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
export const me = { user: null, profile: null, member: false, banned: false, ready: false, admin: false, staff: false };
let staffSent = false;
const FULL = "is_member,name,avatar,handle,display_name,custom_avatar,motto,motto_color,fav_games,banned,created_at";
export async function loadMe(session) {
  me.user = session ? session.user : null; me.profile = null; me.member = false; me.banned = false; me.admin = false; me.staff = false;
  if (!me.user) return me;
  if (session.provider_token) {   // right after the Discord redirect: ask the server to check server membership
    try { await sb.functions.invoke("verify-member", { body: { provider_token: session.provider_token } }); } catch (e) {}
  }
  let r = await sb.from("profiles").select(FULL).eq("id", me.user.id).maybeSingle();
  me.ready = !r.error;
  if (r.error) r = await sb.from("profiles").select("is_member,name,avatar").eq("id", me.user.id).maybeSingle();
  me.profile = r.data || null;
  me.banned = !!(me.profile && me.profile.banned);
  me.member = !!(me.profile && me.profile.is_member) && !me.banned;
  if (me.ready) { try { const a = await sb.rpc("is_admin"); me.admin = a.data === true; } catch (e) {} }
  // Admin bubble (set server-side from the Discord role); tells the site trophies about it once per page load
  if (me.ready) { try { const s = await sb.from("profiles").select("is_staff").eq("id", me.user.id).maybeSingle(); me.staff = !!(s.data && s.data.is_staff) && !me.banned; } catch (e) {} }
  if (me.staff && !staffSent) { staffSent = true; window.ROP_ADMIN = true; try { if (window.Site && Site.emit) Site.emit("rop:admin", true); } catch (e) {} }
  return me;
}
export const myName = () => (me.profile && (me.profile.display_name || me.profile.name)) || (me.user && me.user.user_metadata && (me.user.user_metadata.full_name || me.user.user_metadata.name)) || "you";
export const myAvatar = () => me.profile ? (me.profile.custom_avatar || me.profile.avatar) : null;

/* Calls fn(me) on load and on every sign-in / sign-out */
export function onAuth(fn) {
  let seq = 0;
  sb.auth.onAuthStateChange((_event, session) => {
    const n = ++seq;
    setTimeout(async () => { await loadMe(session); if (n === seq) fn(me); }, 0);
  });
}

/* The slim pill under the Donate / Discord / Twitch banner */
export function authPill(box, opts) {
  box.replaceChildren();
  const o = opts || {};
  if (!me.user) {
    box.append(el("p", { class: "gm-auth__line", text: o.why || "Rating, posting and profiles are a Discord-server perk." }),
      el("div", { class: "gm-auth__row" },
        el("button", { class: "btn gm-btn", type: "button", onclick: signIn, text: "Sign in with Discord" }),
        el("a", { class: "linkbtn", href: INVITE, target: "_blank", rel: "noopener", text: "Join the server first" })));
    return;
  }
  const who = me.ready && me.profile && me.profile.handle
    ? el("a", { class: "gm-auth__me", href: profileUrl(me.profile.handle), title: "Your profile" }, avatar(myAvatar(), myName(), 22), el("span", { text: myName() }))
    : el("b", { text: myName() });
  if (me.banned) box.append(el("p", { class: "gm-auth__line gm-bad" }, "Signed in as ", who, " · this account is suspended."));
  else if (me.member) box.append(el("p", { class: "gm-auth__line gm-ok" }, "Signed in as ", who, " · in the server" + (o.okTail || ", votes count.")));
  else box.append(el("p", { class: "gm-auth__line" }, "Signed in as ", who, " · not in the server yet."),
    el("div", { class: "gm-auth__row" },
      el("a", { class: "btn gm-btn", href: INVITE, target: "_blank", rel: "noopener", text: "Join the Discord" }),
      el("button", { class: "linkbtn", type: "button", onclick: signIn, text: "I've joined — check again" })));
  if (me.admin) box.append(el("a", { class: "linkbtn gm-auth__op", href: "/games/station/", text: "Operation Station" }));
  box.append(el("button", { class: "linkbtn gm-out", type: "button", text: "Sign out", onclick: async () => { await sb.auth.signOut(); } }));
}

/* Ratings / Forums / My profile tabs */
export function subnav(box, active) {
  if (!box) return;
  const tabs = [["ratings", "Ratings", "/games/"], ["forum", "Forums", "/games/forum/"], ["profile", "My profile", "/games/profile/"]];
  box.replaceChildren(...tabs.map(([k, label, href]) => el("a", { class: "rop-tab" + (k === active ? " is-on" : ""), href, "aria-current": k === active ? "page" : null, text: label })));
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
