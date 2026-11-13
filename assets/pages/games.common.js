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
  if (me.staff && !staffSent) { staffSent = true; try { if (window.Site && Site.emit) Site.emit("rop:admin", true); } catch (e) {} }
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
