/* pages/games.buddies.js: Buddies & Messages (/games/buddies/). Prefix bd-.
 * Tabs: Messages (your conversations), Buddies (who's around), Requests (in and out) and Opps (your private block list),
 * plus a conversation view at ?dm=<handle>. Everything goes through the round-33 database functions, which only ever
 * return your own data. Messages arrive live (Realtime) with a slow poll as a fallback.
 */
import { sb, $, el, me, onAuth, authPill, subnav, signIn, avatar, nameLink, ago, profileUrl, toast, sfx, opps } from "./games.common.js?v=27";

const root = $("bd-root");
const params = new URLSearchParams(location.search);
let tab = (location.hash || "").replace("#", "") || "messages";
let data = null, threads = [], live = null, pollT = 0;
const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const dayKey = (iso) => new Date(iso).toDateString();
const dayLabel = (iso) => { const d = new Date(iso), t = new Date(); const y = new Date(t); y.setDate(t.getDate() - 1);
  return d.toDateString() === t.toDateString() ? "Today" : d.toDateString() === y.toDateString() ? "Yesterday" : d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" }); };
const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");

function hero(title, lead, ...extra) {
  return el("header", { class: "hero bd-hero" }, el("div", { class: "eyebrow", text: "Rate-O-Pedia · hang out" }), el("h1", { text: title }),
    lead ? el("p", { class: "lead", text: lead }) : null, ...extra);
}
const who = (c, size) => el("span", { class: "bd-who" },
  el("span", { class: "bd-av" + (c.online ? " is-online" : ""), title: c.online ? "Online now" : null }, avatar(c.avatar, c.name, size || 40)),
  el("span", { class: "bd-who__t" }, nameLink(c.handle, c.name), el("small", { class: "gm-note", text: "@" + c.handle })));
async function call(fn, args) {
  const r = await sb.rpc(fn, args || {});
  if (r.error) { toast(/function|schema cache/i.test(r.error.message) ? "This switches on after the next database update." : r.error.message, "err"); return null; }
  if (r.data && r.data.ok === false) { toast(r.data.error || "That didn't work", "err"); return null; }
  return r.data;
}

/* ---------------- home: tabs ---------------- */
async function home() {
  stopLive();
  const [b, t] = await Promise.all([sb.rpc("my_buddies"), sb.rpc("dm_threads")]);
  if (b.error || !b.data || !b.data.ok) {
    root.replaceChildren(hero("Buddies & Messages", null),
      el("p", { class: "gm-note", text: b.error && /function|schema cache/i.test(b.error.message) ? "Buddies and messages switch on after the owner runs 33_buddies_opps_messages.sql." : ((b.data && b.data.error) || (b.error && b.error.message) || "Couldn't load this right now.") }));
    return;
  }
  data = b.data; threads = (t.data && t.data.threads) || [];
  const unread = threads.reduce((n, x) => n + (x.unread || 0), 0);
  const online = data.buddies.filter((x) => x.online).length;
  const TABS = [["messages", "Messages", unread], ["buddies", "Buddies", data.buddies.length], ["requests", "Requests", data.incoming.length], ["opps", "Opps", data.opps.length]];
  const bar = el("div", { class: "gm-tabs bd-tabs", role: "tablist" }, ...TABS.map(([k, l, n]) =>
    el("button", { class: "gm-tab" + (tab === k ? " is-on" : ""), type: "button", role: "tab", "aria-selected": String(tab === k),
      onclick: () => { tab = k; history.replaceState(null, "", "#" + k); sfx("tap"); home(); } },
      l, n ? el("span", { class: "bd-count" + (k === "messages" || k === "requests" ? " is-hot" : ""), text: String(n) }) : null)));
  const body = el("div", { class: "bd-body" });
  root.replaceChildren(hero("Buddies & Messages",
      data.buddies.length ? plural(data.buddies.length, "buddy").replace("buddys", "buddies") + (online ? " · " + online + " online now" : "") : "Add buddies from their profile, then hang out and talk games."),
    bar, body);
  ({ messages: drawThreads, buddies: drawBuddies, requests: drawRequests, opps: drawOpps }[tab] || drawThreads)(body);
}

function drawThreads(body) {
  const start = el("form", { class: "bd-start", onsubmit: (e) => { e.preventDefault(); const h = inp.value.trim().replace(/^@/, ""); if (h) openDm(h); } });
  const inp = el("input", { class: "gm-input", type: "text", placeholder: "Message someone: type their @handle", "aria-label": "Handle to message", list: "bd-handles" });
  start.append(inp, el("datalist", { id: "bd-handles" }, ...data.buddies.map((x) => el("option", { value: x.handle, label: x.name }))),
    el("button", { class: "btn gm-btn", type: "submit", text: "Start" }));
  if (!threads.length) { body.append(start, el("p", { class: "gm-empty", text: "No messages yet. Buddies can always message each other; other members choose who can message them in Settings." })); return; }
  body.append(start, el("ul", { class: "bd-threads" }, ...threads.map((x) => el("li", null,
    el("a", { class: "bd-thread" + (x.unread ? " is-unread" : ""), href: "?dm=" + encodeURIComponent(x.handle), onclick: (e) => { e.preventDefault(); openDm(x.handle); } },
      el("span", { class: "bd-av" + (x.online ? " is-online" : "") }, avatar(x.avatar, x.name, 44)),
      el("span", { class: "bd-thread__t" },
        el("span", { class: "bd-thread__top" }, el("b", { text: x.name }), x.buddy ? el("span", { class: "bd-tag", text: "Buddy" }) : null, el("span", { class: "gm-note bd-thread__when", text: ago(x.last_at) })),
        el("span", { class: "bd-thread__last" }, x.from_me ? el("span", { class: "gm-note", text: "You: " }) : null, x.last_body)),
      x.unread ? el("span", { class: "bd-count is-hot", text: String(x.unread) }) : null)))));
}

function drawBuddies(body) {
  const s = data.settings || {};
  const pol = el("select", { class: "gm-input bd-sel", "aria-label": "Who can message you" },
    ...[["everyone", "Anyone can message me"], ["buddies", "Only buddies can message me"], ["nobody", "Nobody can message me"]].map(([v, l]) => el("option", { value: v, selected: s.dm_policy === v, text: l })));
  pol.addEventListener("change", async () => { if (await call("set_social_settings", { p: { dm_policy: pol.value } })) toast("Saved", "ok"); });
  const pub = el("input", { type: "checkbox", checked: s.buddies_public !== false });
  pub.addEventListener("change", async () => { if (await call("set_social_settings", { p: { buddies_public: pub.checked } })) toast("Saved", "ok"); });
  body.append(el("div", { class: "bd-prefs" }, pol, el("label", { class: "bd-check" }, pub, " Show my buddies on my profile")));
  if (!data.buddies.length) { body.append(el("p", { class: "gm-empty" }, "No buddies yet. Open someone's profile and press ", el("b", { text: "Add buddy" }), ".")); return; }
  body.append(el("ul", { class: "bd-grid" }, ...data.buddies.map((x) => el("li", { class: "bd-card" },
    who(x, 48),
    el("small", { class: "gm-note bd-card__s", text: x.online ? "Online now" : x.seen ? "Seen " + ago(x.seen) : "Buddies since " + new Date(x.since).toLocaleDateString() }),
    el("div", { class: "bd-card__a" },
      el("button", { class: "btn gm-btn", type: "button", text: "Message", onclick: () => openDm(x.handle) }),
      el("button", { class: "linkbtn", type: "button", text: "Unbuddy", onclick: async () => {
        if (!confirm("Remove " + x.name + " from your buddies?")) return;
        if (await call("buddy_remove", { p_handle: x.handle })) { toast("Removed", "ok"); home(); } } }))))));
}

function drawRequests(body) {
  body.append(el("h2", { class: "gm-head bd-h", text: "Waiting for you" }));
  if (!data.incoming.length) body.append(el("p", { class: "gm-empty", text: "No requests right now." }));
  else body.append(el("ul", { class: "bd-list" }, ...data.incoming.map((x) => el("li", { class: "bd-row" }, who(x), el("span", { class: "gm-note", text: ago(x.at) }),
    el("span", { class: "bd-row__a" },
      el("button", { class: "btn gm-btn", type: "button", text: "Accept", onclick: async () => { if (await call("buddy_respond", { p_handle: x.handle, p_accept: true })) { sfx("success"); toast("You and " + x.name + " are buddies", "ok"); home(); } } }),
      el("button", { class: "btn ghost gm-btn", type: "button", text: "Decline", onclick: async () => { if (await call("buddy_respond", { p_handle: x.handle, p_accept: false })) home(); } }))))));
  body.append(el("h2", { class: "gm-head bd-h", text: "You asked" }));
  if (!data.outgoing.length) body.append(el("p", { class: "gm-empty", text: "Nothing pending." }));
  else body.append(el("ul", { class: "bd-list" }, ...data.outgoing.map((x) => el("li", { class: "bd-row" }, who(x), el("span", { class: "gm-note", text: "Sent " + ago(x.at) }),
    el("span", { class: "bd-row__a" }, el("button", { class: "linkbtn", type: "button", text: "Cancel", onclick: async () => { if (await call("buddy_remove", { p_handle: x.handle })) home(); } }))))));
}

function drawOpps(body) {
  body.append(el("p", { class: "gm-note bd-explain", text: "Opps can't message you, send you buddy requests, follow you or sign your guestbook, and their reviews, posts and comments are hidden from you. They're never told." }));
  if (!data.opps.length) { body.append(el("p", { class: "gm-empty", text: "Nobody in your Opps. Add someone from the ⋯ menu on their profile." })); return; }
  body.append(el("ul", { class: "bd-list" }, ...data.opps.map((x) => el("li", { class: "bd-row" }, who(x), el("span", { class: "gm-note", text: "Added " + ago(x.at) }),
    el("span", { class: "bd-row__a" }, el("button", { class: "linkbtn", type: "button", text: "Remove from Opps", onclick: async () => {
      if (await call("opp_remove", { p_handle: x.handle })) { opps.delete(x.handle); toast("Removed from Opps", "ok"); home(); } } }))))));
}

/* ---------------- one conversation ---------------- */
let conv = null;   // { handle, msgs: Map(id -> msg), list, with }
function openDm(handle) {
  history.pushState(null, "", "?dm=" + encodeURIComponent(handle));
  dm(handle);
}
async function dm(handle) {
  stopLive();
  root.replaceChildren(el("p", { class: "gm-empty", text: "Loading…" }));
  const r = await sb.rpc("dm_read", { p_handle: handle });
  if (r.error || !r.data || !r.data.ok) {
    root.replaceChildren(backBtn(), el("p", { class: "gm-note", text: (r.data && r.data.error) || (r.error && /function|schema cache/i.test(r.error.message) ? "Messages switch on after the next database update." : (r.error && r.error.message)) || "Couldn't open that conversation." }));
    return;
  }
  const w = r.data.with, st = r.data.status || {};
  conv = { handle: w.handle, msgs: new Map(), list: el("div", { class: "bd-msgs", role: "log", "aria-live": "polite" }), oldest: null, more: null };
  const box = el("textarea", { class: "gm-input bd-compose__t", rows: 1, maxlength: 1000, placeholder: st.can_dm === false ? "You can't message this member right now." : "Message " + w.name + "…", "aria-label": "Message", disabled: st.can_dm === false });
  const count = el("span", { class: "gm-note bd-compose__n" });
  const send = el("button", { class: "btn gm-btn", type: "submit", text: "Send", disabled: st.can_dm === false });
  const grow = () => { box.style.height = "auto"; box.style.height = Math.min(box.scrollHeight, 180) + "px"; const n = box.value.length; count.textContent = n > 800 ? (1000 - n) + " left" : ""; };
  box.addEventListener("input", grow);
  box.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
  const form = el("form", { class: "bd-compose", onsubmit: async (e) => {
    e.preventDefault(); const body = box.value.trim(); if (!body) return;
    send.disabled = true;
    const q = await sb.rpc("dm_send", { p_handle: w.handle, p_body: body });
    send.disabled = false;
    if (q.error || !q.data || !q.data.ok) { toast((q.data && q.data.error) || (q.error && q.error.message) || "Not sent", "err"); return; }
    box.value = ""; grow(); sfx("tap");
    add([{ id: q.data.id, mine: true, body, at: q.data.at, read: false }]); box.focus();
  } }, box, el("div", { class: "bd-compose__side" }, count, send));
  const head = el("div", { class: "bd-convhead" }, backBtn(),
    el("a", { class: "bd-convhead__who", href: profileUrl(w.handle) }, el("span", { class: "bd-av" + (st.buddy ? "" : "") }, avatar(w.avatar, w.name, 40)),
      el("span", null, el("b", { text: w.name }), el("small", { class: "gm-note", text: st.buddy ? "Buddy" : st.incoming ? "Wants to be buddies" : "@" + w.handle }))),
    el("button", { class: "linkbtn", type: "button", text: "Delete conversation", onclick: async () => {
      if (!confirm("Delete this whole conversation from your side? " + w.name + " keeps their copy.")) return;
      if (await call("dm_delete", { p_id: null, p_handle: w.handle })) { toast("Deleted", "ok"); goHome(); } } }));
  conv.more = el("button", { class: "linkbtn bd-more", type: "button", text: "Load earlier messages", hidden: true, onclick: older });
  root.replaceChildren(el("section", { class: "pf-card bd-conv" }, head, conv.more, conv.list, form));
  add(r.data.messages || []);
  conv.more.hidden = (r.data.messages || []).length < 60;
  box.focus();
  startLive(w.handle);
}
function backBtn() { return el("button", { class: "btn ghost gm-btn bd-back", type: "button", text: "← All messages", onclick: goHome }); }
function goHome() { history.pushState(null, "", location.pathname + "#messages"); tab = "messages"; conv = null; home(); }
async function older() {
  if (!conv || !conv.oldest) return;
  const r = await sb.rpc("dm_read", { p_handle: conv.handle, p_before: conv.oldest });
  const rows = (r.data && r.data.messages) || [];
  const h0 = conv.list.scrollHeight;
  add(rows, true);
  conv.list.scrollTop = conv.list.scrollHeight - h0;
  conv.more.hidden = rows.length < 60;
}
function add(rows, prepend) {
  if (!conv) return;
  let changed = false;
  rows.forEach((m) => { if (!conv.msgs.has(m.id)) { conv.msgs.set(m.id, m); changed = true; } else Object.assign(conv.msgs.get(m.id), m); });
  if (!changed && !prepend) return;
  const all = [...conv.msgs.values()].sort((a, b) => a.id - b.id);
  conv.oldest = all.length ? all[0].id : null;
  const nearBottom = conv.list.scrollHeight - conv.list.scrollTop - conv.list.clientHeight < 120;
  const out = []; let day = "";
  all.forEach((m, i) => {
    if (dayKey(m.at) !== day) { day = dayKey(m.at); out.push(el("p", { class: "bd-day", text: dayLabel(m.at) })); }
    const prev = all[i - 1], grouped = prev && prev.mine === m.mine && new Date(m.at) - new Date(prev.at) < 5 * 60e3 && dayKey(prev.at) === day;
    out.push(el("div", { class: "bd-msg" + (m.mine ? " is-mine" : "") + (grouped ? " is-grouped" : ""), "data-id": m.id },
      el("div", { class: "bd-bubble" + (m.removed ? " is-removed" : "") }, m.removed ? "Message removed by a moderator" : m.body),
      el("div", { class: "bd-meta" }, el("span", { text: fmtTime(m.at) }), m.mine && all[all.length - 1] === m && m.read ? el("span", { text: " · Seen" }) : null,
        el("button", { class: "bd-msg__x", type: "button", title: "Delete for me", "aria-label": "Delete for me", text: "Delete", onclick: () => delMsg(m) }),
        !m.mine && !m.removed ? el("button", { class: "bd-msg__x", type: "button", text: "Report", onclick: () => report(m) }) : null)));
  });
  if (!all.length) out.push(el("p", { class: "gm-empty bd-empty", text: "Say hi. Messages here are private to the two of you." }));
  conv.list.replaceChildren(...out);
  if (nearBottom || !prepend) conv.list.scrollTop = conv.list.scrollHeight;
}
async function delMsg(m) {
  if (await call("dm_delete", { p_id: m.id })) { conv.msgs.delete(m.id); add([], true); }
}
async function report(m) {
  const why = prompt("Report this message to the site owner. What's wrong with it? (optional)");
  if (why === null) return;
  if (await call("dm_report", { p_id: m.id, p_reason: why })) toast("Reported. Thanks for looking out.", "ok");
}

/* live: Realtime when available, plus a gentle poll (also catches "Seen") */
function startLive(handle) {
  const refresh = async () => {
    if (!conv || conv.handle !== handle || document.hidden) return;
    const r = await sb.rpc("dm_read", { p_handle: handle });
    if (r.data && r.data.ok) add(r.data.messages || []);
  };
  try {
    if (sb.channel && me.user) {
      live = sb.channel("dm-" + me.user.id).on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_messages", filter: "recipient=eq." + me.user.id },
        () => { refresh(); sfx("pop"); }).subscribe();
    }
  } catch (e) { live = null; }
  pollT = setInterval(refresh, live ? 30000 : 8000);
}
function stopLive() {
  if (pollT) { clearInterval(pollT); pollT = 0; }
  if (live) { try { sb.removeChannel(live); } catch (e) {} live = null; }
}

/* ---------------- start ---------------- */
subnav($("rop-tabs"), "");
window.addEventListener("popstate", () => { const h = new URLSearchParams(location.search).get("dm"); if (h) dm(h); else { tab = (location.hash || "").replace("#", "") || "messages"; home(); } });
onAuth(() => {
  authPill($("gm-auth"));
  if (!me.user) {
    root.replaceChildren(hero("Buddies & Messages", "Add buddies, see who's around and message each other privately."),
      el("button", { class: "btn gm-btn", type: "button", onclick: signIn, text: "Sign in to see your buddies" }));
    return;
  }
  const h = params.get("dm");
  if (h) dm(h.slice(0, 40)); else home();
});
