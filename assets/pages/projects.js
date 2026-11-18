/* pages/projects.js — upvotes + comments for the /projects/ ("What I'm working on") page.
 *
 * Verified members can upvote each project (one per project, revocable, no downvotes) and leave comments +
 * one level of replies. Backend = Wiki-Chip Dex / Supabase (SQL 34, contract in PROJECT_VOTES_API.md):
 * project_board(), project_comments_of(key), project_vote(key,on), project_comment(key,body,parent?),
 * project_comment_edit(id,body), project_comment_delete(id).
 *
 * Gated behind Site.config.features.projectFeedback (opt-in, default OFF) — the page stays a plain static
 * rundown until the backend is live and the flag is flipped. Reads are public; voting/commenting is
 * verified-only (server-enforced; the UI reflects project_board().can_vote).
 */
const SB = (window.Site && Site.sb) || {};
const el = Site.el, svg = Site.svg;
function feat(name) { var f = (Site.config && Site.config.features) || {}; return f[name] === true; }
function toast(m, t) { try { if (window.Site && Site.toast) Site.toast(m, { type: t || "info" }); } catch (e) {} }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

/* ---------- lazy Supabase client (shared pattern) ---------- */
var SUPA_REF = (String(SB.url || "").match(/^https:\/\/([a-z0-9-]+)\.supabase/i) || [])[1] || "";
var AUTH_LS = SUPA_REF ? "sb-" + SUPA_REF + "-auth-token" : "";
var _sb = null, _sbLoad = null;
function supa() {
  if (_sb) return Promise.resolve(_sb);
  if (_sbLoad) return _sbLoad;
  if (!SB.url || !SB.key) return Promise.resolve(null);
  _sbLoad = import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm").then(function (m) { _sb = m.createClient(SB.url, SB.key); return _sb; }).catch(function () { return null; });
  return _sbLoad;
}
function hasSession() { if (!AUTH_LS) return false; try { var raw = localStorage.getItem(AUTH_LS); if (!raw) return false; var s = JSON.parse(raw); var sess = (s && s.currentSession) || s; return !!(sess && sess.access_token); } catch (e) { return false; } }
function rpc(fn, args) { return supa().then(function (sb) { if (!sb) return { error: { message: "offline" } }; return sb.rpc(fn, args || {}); }); }

/* ---------- icons ---------- */
var UP = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 4l8 9h-5v7h-6v-7H4z"/></svg>';
var CHAT = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-5 4V5a1 1 0 0 1 1-1Z"/></svg>';

var CAN_VOTE = false;
var cards = {}; /* key -> { card, voteBtn, countEl, chatBtn, chatCount, panel, open } */

function timeAgo(iso) {
  try {
    var t = new Date(iso).getTime(); if (!t) return "";
    var s = Math.max(1, (Date.now() - t) / 1000);
    if (s < 60) return "just now";
    var m = s / 60; if (m < 60) return Math.floor(m) + "m ago";
    var h = m / 60; if (h < 24) return Math.floor(h) + "h ago";
    var d = h / 24; if (d < 30) return Math.floor(d) + "d ago";
    return Site.fmtDate(iso);
  } catch (e) { return ""; }
}
function initialOf(name) { var s = String(name || "").replace(/[^A-Za-z0-9]/g, ""); return (s[0] || "★").toUpperCase(); }

/* ---------- build the social footer on each card ---------- */
function buildSocial(card, key) {
  var bar = el("div", { class: "pj-social" });
  var vote = el("button", { type: "button", class: "pj-vote", "aria-pressed": "false", title: "Upvote this project" }, el("span", { class: "pj-vote__ico", html: UP }), el("b", { class: "pj-vote__n", text: "0" }));
  var chat = el("button", { type: "button", class: "pj-chatbtn", "aria-expanded": "false" }, el("span", { class: "pj-chatbtn__ico", html: CHAT }), el("span", { class: "pj-chatbtn__n", text: "Comments" }));
  vote.addEventListener("click", function () { onVote(key); });
  chat.addEventListener("click", function () { toggleComments(key); });
  bar.appendChild(vote); bar.appendChild(chat);
  var panel = el("div", { class: "pj-comments", hidden: true });
  card.appendChild(bar); card.appendChild(panel);
  cards[key] = { card: card, voteBtn: vote, countEl: vote.querySelector(".pj-vote__n"), chatBtn: chat, chatCount: chat.querySelector(".pj-chatbtn__n"), panel: panel, open: true, loaded: false };
}

function paintBoard(projects) {
  projects.forEach(function (p) {
    var c = cards[p.key]; if (!c) return;
    c.open = p.open !== false;
    c.countEl.textContent = Site.fmtNum(p.votes || 0);
    c.voteBtn.setAttribute("aria-pressed", p.voted ? "true" : "false");
    c.voteBtn.classList.toggle("is-on", !!p.voted);
    c.chatCount.textContent = (p.comments || 0) + (p.comments === 1 ? " comment" : " comments");
    if (!c.open) { c.card.classList.add("pj-card--closed"); c.voteBtn.disabled = true; }
  });
}

/* ---------- voting ---------- */
function onVote(key) {
  var c = cards[key]; if (!c) return;
  if (!hasSession()) { toast("Sign in as a verified member to upvote.", "info"); return; }
  if (!CAN_VOTE) { toast("Only verified members can upvote — confirm your account first.", "info"); return; }
  if (!c.open) { toast("This project is closed to new votes.", "info"); return; }
  var on = c.voteBtn.getAttribute("aria-pressed") !== "true";
  c.voteBtn.disabled = true;
  rpc("project_vote", { p_key: key, p_on: on }).then(function (res) {
    c.voteBtn.disabled = false; var d = res && res.data;
    if (!d || d.ok === false) { toast((d && d.error) || "Couldn't register that vote.", "err"); return; }
    c.countEl.textContent = Site.fmtNum(d.votes || 0);
    c.voteBtn.setAttribute("aria-pressed", d.voted ? "true" : "false");
    c.voteBtn.classList.toggle("is-on", !!d.voted);
    if (d.voted) {
      try { Site.sfx && Site.sfx("toggle"); } catch (e) {}
      try {
        if (Site.trophy) {
          Site.trophy("pj-vote");
          var pv = Site.store.get("pjVotes", {}) || {}; pv[key] = 1; Site.store.set("pjVotes", pv);
          if (Object.keys(pv).length >= 3) Site.trophy("pj-vote3");
        }
      } catch (e) {}
    }
  }).catch(function () { c.voteBtn.disabled = false; toast("Couldn't register that vote.", "err"); });
}

/* ---------- comments ---------- */
function toggleComments(key) {
  var c = cards[key]; if (!c) return;
  var showing = !c.panel.hidden;
  c.panel.hidden = showing;
  c.chatBtn.setAttribute("aria-expanded", showing ? "false" : "true");
  if (!showing && !c.loaded) loadComments(key);
}
function loadComments(key) {
  var c = cards[key]; c.loaded = true;
  c.panel.replaceChildren(el("p", { class: "pj-cm-empty", text: "Loading comments…" }));
  rpc("project_comments_of", { p_key: key }).then(function (res) {
    var d = res && res.data;
    if (!d || d.ok === false) { renderComments(key, []); return; }
    renderComments(key, d.comments || []);
  }).catch(function () { c.panel.replaceChildren(el("p", { class: "pj-cm-empty", text: "Couldn't load comments." })); });
}
function renderComments(key, list) {
  var c = cards[key]; c.panel.replaceChildren();
  /* group: tops (no parent_id) + replies by parent_id; orphan replies (hidden parent) under a stub */
  var tops = [], byParent = {}, haveTop = {};
  list.forEach(function (cm) { if (cm.parent_id == null) { tops.push(cm); haveTop[cm.id] = true; } });
  list.forEach(function (cm) { if (cm.parent_id != null) { (byParent[cm.parent_id] = byParent[cm.parent_id] || []).push(cm); } });

  var thread = el("div", { class: "pj-cm-list" });
  tops.forEach(function (t) { thread.appendChild(commentNode(key, t, byParent[t.id] || [])); });
  /* orphan replies whose parent was hidden */
  Object.keys(byParent).forEach(function (pid) {
    if (haveTop[pid]) return;
    var stub = el("div", { class: "pj-cm pj-cm--hidden" }, el("p", { class: "pj-cm__body pj-cm__body--muted", text: "[comment hidden]" }));
    byParent[pid].forEach(function (r) { stub.appendChild(commentNode(key, r, [], true)); });
    thread.appendChild(stub);
  });
  if (!tops.length && !Object.keys(byParent).length) thread.appendChild(el("p", { class: "pj-cm-empty", text: "No comments yet — be the first." }));
  c.panel.appendChild(thread);

  /* compose box */
  if (hasSession() && CAN_VOTE && c.open) c.panel.appendChild(composer(key, null, function () { loadComments(key); }));
  else {
    var why = !hasSession() ? "Sign in as a verified member to join the conversation." : (!CAN_VOTE ? "Only verified members can comment." : "This project is closed to new comments.");
    c.panel.appendChild(el("p", { class: "pj-cm-gate", text: why }));
  }
  /* deep-link: /projects/#<key>-c<id> */
  try {
    var m = (location.hash || "").match(/^#([a-z0-9-]+)-c(\d+)$/);
    if (m && m[1] === key) { var node = document.getElementById(key + "-c" + m[2]); if (node) { node.scrollIntoView({ block: "center" }); node.classList.add("is-flash"); } }
  } catch (e) {}
}
function commentNode(key, cm, replies, isReply) {
  var node = el("div", { class: "pj-cm" + (isReply ? " pj-cm--reply" : ""), id: key + "-c" + cm.id });
  var av = el("span", { class: "pj-cm__av" });
  if (cm.avatar) av.appendChild(el("img", { class: "pj-cm__img", src: cm.avatar, alt: "", loading: "lazy" }));
  else { av.classList.add("is-initial"); av.textContent = initialOf(cm.name); }
  if (cm.frame) av.classList.add("pj-cm__av--framed");
  var head = el("div", { class: "pj-cm__head" },
    el("span", { class: "pj-cm__name", text: cm.name || cm.handle || "Member" }),
    cm.is_owner ? el("span", { class: "pj-cm__tag", text: "Owner" }) : null,
    el("span", { class: "pj-cm__time", text: timeAgo(cm.at) + (cm.edited ? " · edited" : "") }));
  var body = el("p", { class: "pj-cm__body", text: cm.body || "" });
  var main = el("div", { class: "pj-cm__main" }, head, body);
  node.appendChild(av); node.appendChild(main);

  var actions = el("div", { class: "pj-cm__actions" });
  if (!isReply && hasSession() && CAN_VOTE && cards[key].open) {
    var rb = el("button", { type: "button", class: "pj-cm__act", text: "Reply" });
    rb.addEventListener("click", function () {
      if (main.querySelector(".pj-composer")) return;
      main.appendChild(composer(key, cm.id, function () { loadComments(key); }));
    });
    actions.appendChild(rb);
  }
  if (cm.mine) {
    var ed = el("button", { type: "button", class: "pj-cm__act", text: "Edit" });
    ed.addEventListener("click", function () { startEdit(key, cm, body); });
    var del = el("button", { type: "button", class: "pj-cm__act pj-cm__act--danger", text: "Delete" });
    del.addEventListener("click", function () { doDelete(key, cm.id); });
    actions.appendChild(ed); actions.appendChild(del);
  } else if (cm.is_owner === false && Site.owner) {
    var odel = el("button", { type: "button", class: "pj-cm__act pj-cm__act--danger", text: "Remove" });
    odel.addEventListener("click", function () { doDelete(key, cm.id); });
    actions.appendChild(odel);
  }
  if (actions.childNodes.length) main.appendChild(actions);

  replies.forEach(function (r) { node.appendChild(commentNode(key, r, [], true)); });
  return node;
}
function composer(key, parentId, done) {
  var box = el("div", { class: "pj-composer" });
  var ta = el("textarea", { class: "pj-composer__ta", rows: parentId ? "2" : "3", maxlength: "1000", placeholder: parentId ? "Write a reply…" : "Add a comment…" });
  var btn = el("button", { type: "button", class: "btn pj-composer__send", text: parentId ? "Reply" : "Comment" });
  var msg = el("span", { class: "pj-composer__msg" });
  btn.addEventListener("click", function () {
    var body = ta.value.trim();
    if (body.length < 1) { ta.focus(); return; }
    if (body.length > 1000) { msg.textContent = "Keep it under 1,000 characters."; return; }
    btn.disabled = true; msg.textContent = "Posting…";
    var args = { p_key: key, p_body: body }; if (parentId) args.p_parent = parentId;
    rpc("project_comment", args).then(function (res) {
      btn.disabled = false; var d = res && res.data;
      if (!d || d.ok === false) { msg.textContent = (d && d.error) || "Couldn't post that."; return; }
      ta.value = ""; msg.textContent = ""; done && done();
      try { if (Site.trophy) Site.trophy(parentId ? "pj-reply" : "pj-comment"); } catch (e) {}
    }).catch(function () { btn.disabled = false; msg.textContent = "Couldn't post — try again."; });
  });
  box.appendChild(ta); box.appendChild(el("div", { class: "pj-composer__row" }, btn, msg));
  setTimeout(function () { try { ta.focus(); } catch (e) {} }, 40);
  return box;
}
function startEdit(key, cm, bodyEl) {
  if (bodyEl.nextSibling && bodyEl.nextSibling.classList && bodyEl.nextSibling.classList.contains("pj-composer")) return;
  var ta = el("textarea", { class: "pj-composer__ta", rows: "2", maxlength: "1000" }); ta.value = cm.body || "";
  var save = el("button", { type: "button", class: "btn pj-composer__send", text: "Save" });
  var cancel = el("button", { type: "button", class: "pj-cm__act", text: "Cancel" });
  var msg = el("span", { class: "pj-composer__msg" });
  var box = el("div", { class: "pj-composer" }, ta, el("div", { class: "pj-composer__row" }, save, cancel, msg));
  bodyEl.style.display = "none"; bodyEl.parentNode.insertBefore(box, bodyEl.nextSibling);
  cancel.addEventListener("click", function () { box.remove(); bodyEl.style.display = ""; });
  save.addEventListener("click", function () {
    var v = ta.value.trim(); if (!v) return;
    save.disabled = true; msg.textContent = "Saving…";
    rpc("project_comment_edit", { p_id: cm.id, p_body: v }).then(function (res) {
      var d = res && res.data;
      if (!d || d.ok === false) { save.disabled = false; msg.textContent = (d && d.error) || "Couldn't save."; return; }
      loadComments(key);
    }).catch(function () { save.disabled = false; msg.textContent = "Couldn't save."; });
  });
}
function doDelete(key, id) {
  rpc("project_comment_delete", { p_id: id }).then(function (res) {
    var d = res && res.data;
    if (!d || d.ok === false) { toast((d && d.error) || "Couldn't delete that.", "err"); return; }
    loadComments(key);
  }).catch(function () { toast("Couldn't delete that.", "err"); });
}

/* ---------- boot ---------- */
function boot() {
  if (!feat("projectFeedback")) return; /* page stays a plain static rundown */
  var nodes = document.querySelectorAll("[data-project]");
  if (!nodes.length) return;
  Array.prototype.forEach.call(nodes, function (card) { buildSocial(card, card.getAttribute("data-project")); });
  rpc("project_board").then(function (res) {
    var d = res && res.data;
    if (!d || d.ok === false || !Array.isArray(d.projects)) return; /* backend not live yet — footers show 0/0, harmless */
    CAN_VOTE = !!d.can_vote;
    paintBoard(d.projects);
    /* if arriving on a deep-link, auto-open that project's comments */
    var m = (location.hash || "").match(/^#([a-z0-9-]+)-c\d+$/);
    if (m && cards[m[1]]) toggleComments(m[1]);
  }).catch(function () {});
}

if (window.Site && Site.ready) Site.ready(boot, "projects"); else boot();
