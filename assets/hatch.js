/* hatch.js — the whole-site "Maintenance Hatch".
 *
 * A per-page admin edit framework. Any page registers editable regions; when the owner is signed in
 * (control-panel session, same marker the admin badge uses) a wrench floats in the corner that opens a
 * panel of those regions. Content is stored in the existing site_settings "hatch" row (13_maintenance_hatch.sql)
 * and read publicly, so edits hydrate the live page for every visitor.
 *
 * Public API (window.Site.hatch):
 *   Site.hatch.register({ id, page, label, render(pane, api), load(value) })
 *       id     unique key (also the storage key within the page)
 *       page   the Site.page value the region lives on
 *       label  shown in the hatch menu
 *       render(pane, api)  build the editor UI in `pane`; api.get()/set(v)/save()
 *       load(value)        hydrate the live page from saved content — runs for EVERY visitor
 *   Site.hatch.canEdit()   -> boolean, true when an admin sign-in is active on this browser
 *   Site.hatch.get(page,id)-> the saved value (read-only), or undefined
 *
 * The region owner never touches the admin token or control.js — this file handles auth and the save RPC.
 */
(function () {
  "use strict";
  if (!window.Site) return;
  var Site = window.Site, doc = document;
  var SB = Site.sb || { url: "https://zjhlhkruqzfendvbglsb.supabase.co", key: "sb_publishable_j-EgPXB3ZvKuz_3h8dZaNA_aLgmcQrk" };
  var PAGE = Site.page || "";

  var regs = [];          // all registrations
  var all = null;         // the whole hatch object { page: { id: value } }, once fetched
  var fetched = false;
  var panel = null, fab = null;

  function el(tag, attrs, kids) {
    var n = doc.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === "class") n.className = attrs[k]; else if (k === "html") n.innerHTML = attrs[k]; else if (k === "text") n.textContent = attrs[k]; else if (attrs[k] != null) n.setAttribute(k, attrs[k]); }
    if (kids) (Array.isArray(kids) ? kids : [kids]).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function rpc(name, body) {
    return fetch(SB.url + "/rest/v1/rpc/" + name, { method: "POST", headers: { apikey: SB.key, Authorization: "Bearer " + SB.key, "Content-Type": "application/json" }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json(); }).catch(function () { return { ok: false, error: "offline" }; });
  }
  function adminToken() { try { var a = JSON.parse(sessionStorage.getItem("site.admin")); return a && a.token ? a.token : ""; } catch (e) { return ""; } }
  function canEdit() { try { return Number(localStorage.getItem("site.adminSeen") || 0) > Date.now(); } catch (e) { return false; } }

  /* ---------- content ---------- */
  function fetchAll() {
    return fetch(SB.url + "/rest/v1/site_settings?key=eq.hatch&select=value", { headers: { apikey: SB.key, Authorization: "Bearer " + SB.key }, cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (rows) { all = (rows && rows[0] && rows[0].value) || {}; fetched = true; return all; })
      .catch(function () { all = all || {}; fetched = true; return all; });
  }
  function valueOf(page, id) { return all && all[page] && all[page][id]; }

  function hydrate(reg) {
    if (!fetched || !reg || reg.page !== PAGE || typeof reg.load !== "function") return;
    var v = valueOf(reg.page, reg.id);
    if (v !== undefined) { try { reg.load(v); } catch (e) {} }
  }
  function hydrateAll() { regs.forEach(hydrate); }

  /* ---------- register ---------- */
  function register(spec) {
    if (!spec || !spec.id) return;
    spec.page = spec.page || PAGE;
    regs.push(spec);
    if (fetched) hydrate(spec);        // late registration: hydrate immediately
    if (canEdit() && spec.page === PAGE) { ensureFab(); emitFab(); }
    return spec;
  }

  /* ---------- editor api + save ---------- */
  function apiFor(reg, statusEl) {
    var staged;
    return {
      get: function () { return staged !== undefined ? staged : valueOf(reg.page, reg.id); },
      set: function (v) { staged = v; },
      save: function () {
        var value = staged !== undefined ? staged : valueOf(reg.page, reg.id);
        return persist(reg, value, statusEl);
      }
    };
  }
  function persist(reg, value, statusEl) {
    var tok = adminToken();
    if (!tok) { if (statusEl) { statusEl.textContent = "Sign in on this tab to save (open the control panel)."; statusEl.className = "ht-status is-warn"; } return Promise.resolve({ ok: false, error: "no-token" }); }
    if (statusEl) { statusEl.textContent = "Saving…"; statusEl.className = "ht-status"; }
    all = all || {}; all[reg.page] = all[reg.page] || {}; all[reg.page][reg.id] = value;
    return rpc("site_admin_save", { p_token: tok, p_key: "hatch", p_value: all }).then(function (r) {
      if (r && r.ok) { if (statusEl) { statusEl.textContent = "Saved. Live for visitors shortly."; statusEl.className = "ht-status is-ok"; } try { if (typeof reg.load === "function") reg.load(value); } catch (e) {} }
      else { if (statusEl) { statusEl.textContent = (r && r.error === "signed-out") ? "Your sign-in ended — open the control panel again." : "Couldn't save — try again."; statusEl.className = "ht-status is-warn"; } }
      return r;
    });
  }

  /* ---------- admin UI ---------- */
  var WRENCH = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M21.7 5.6a.6.6 0 0 0-1-.3l-2.3 2.3-2-2L18.7 3.3a.6.6 0 0 0-.3-1A5 5 0 0 0 12 8.2L3.3 16.9a2 2 0 1 0 2.8 2.8L14.8 11a5 5 0 0 0 6.9-5.4ZM5.5 19a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>';
  var CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  var onKey = null;
  function ensureFab() {
    if (fab || !canEdit()) return;
    if (!regs.some(function (r) { return r.page === PAGE; })) return;
    fab = el("button", { class: "ht-fab", type: "button", title: "Maintenance Hatch", "aria-label": "Maintenance Hatch", html: WRENCH });
    fab.addEventListener("click", togglePanel);
    doc.body.appendChild(fab);
  }
  function togglePanel() { if (panel) closePanel(); else openPanel(); }
  function closePanel() {
    if (onKey) { doc.removeEventListener("keydown", onKey); onKey = null; }
    if (panel) { panel.remove(); panel = null; }
  }
  function emitFab() { try { Site.emit && Site.emit("hatch:fab"); } catch (e) {} }
  // Does this page have any editors (optionally for a given game)? Used by callers (e.g. the arcade cards)
  // to decide whether to show a per-game "open the hatch" entry point.
  function hasGame(game) { return regs.some(function (r) { return r.page === PAGE && (!game || r.game === game); }); }
  // Public opener. Pass { game, title } to open the panel scoped to one game's editors (pre-expanded);
  // no opts opens the whole page (what the floating wrench does).
  function openFor(opts) { if (!canEdit()) return; ensureFab(); if (panel) closePanel(); openPanel(opts || {}); }
  function openPanel(opts) {
    opts = opts || {};
    var scoped = !!opts.game;
    var mine = regs.filter(function (r) { return r.page === PAGE && (!scoped || r.game === opts.game); });
    panel = el("div", { class: "ht-panel", role: "dialog", "aria-modal": "true", "aria-label": "Maintenance Hatch" });
    var inner = el("div", { class: "ht-inner" });
    var titleTxt = scoped && opts.title ? opts.title + " — hatch" : "Maintenance Hatch";
    var head = el("div", { class: "ht-head" }, [el("strong", { text: titleTxt }), el("button", { class: "ht-x", type: "button", "aria-label": "Close", html: "&times;" })]);
    head.querySelector(".ht-x").addEventListener("click", closePanel);
    inner.appendChild(head);
    if (scoped) {
      var back = el("button", { class: "ht-back", type: "button", text: "← All editors on this page" });
      back.addEventListener("click", function () { closePanel(); openPanel(); });
      inner.appendChild(back);
    }
    if (!adminToken()) inner.appendChild(signInBox());
    var list = el("div", { class: "ht-list" });
    mine.forEach(function (reg) { list.appendChild(buildCat(reg, scoped)); });
    if (!mine.length) list.appendChild(el("p", { class: "ht-empty", text: scoped ? "This game has no editors wired up yet." : "Nothing on this page is wired for editing yet." }));
    inner.appendChild(list);
    panel.appendChild(inner);
    doc.body.appendChild(panel);
    onKey = function (e) { if (e.key === "Escape") closePanel(); };
    doc.addEventListener("keydown", onKey);
  }
  // One collapsible category per registered editor. Collapsed by default (unless openNow); the editor
  // (and any lazy-loaded script it pulls) is rendered the first time it's expanded.
  function buildCat(reg, openNow) {
    var cat = el("div", { class: "ht-cat" });
    var head = el("button", { class: "ht-cat-head", type: "button", "aria-expanded": "false" },
      [el("span", { class: "ht-cat-label", text: reg.label || reg.id }), el("span", { class: "ht-chev", "aria-hidden": "true", html: CHEV })]);
    var body = el("div", { class: "ht-cat-body" });
    var built = false;
    function build() {
      if (built) return; built = true;
      var pane = el("div", { class: "ht-pane" });
      var status = el("p", { class: "ht-status", role: "status" });
      var api = apiFor(reg, status);
      try { reg.render(pane, api); } catch (e) { pane.appendChild(el("p", { class: "ht-empty", text: "This editor failed to load." })); }
      var foot = el("div", { class: "ht-foot" }, [status, el("button", { class: "btn ht-save", type: "button", text: "Save" })]);
      foot.querySelector(".ht-save").addEventListener("click", function () { api.save(); });
      body.appendChild(pane); body.appendChild(foot);
    }
    function setOpen(open) {
      cat.classList.toggle("is-open", open);
      head.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) build();
    }
    head.addEventListener("click", function () { setOpen(!cat.classList.contains("is-open")); });
    cat.appendChild(head); cat.appendChild(body);
    if (openNow) setOpen(true);
    return cat;
  }
  function signInBox() {
    var box = el("div", { class: "ht-signin" });
    box.appendChild(el("p", { class: "ht-note", text: "You're signed in on another tab. Enter your owner password (and 2FA code) to edit here." }));
    var pw = el("input", { class: "ht-input", type: "password", placeholder: "Owner password", autocomplete: "current-password" });
    var code = el("input", { class: "ht-input", type: "text", inputmode: "numeric", placeholder: "2FA code (if set up)", autocomplete: "one-time-code", maxlength: "7" });
    var go = el("button", { class: "btn", type: "button", text: "Sign in here" });
    var m = el("p", { class: "ht-status", role: "status" });
    go.addEventListener("click", function () {
      go.disabled = true; m.textContent = "Signing in…"; m.className = "ht-status";
      rpc("site_admin_login", { p_pass: pw.value, p_code: (code.value || "").replace(/\s+/g, "") }).then(function (r) {
        go.disabled = false;
        if (r && r.ok && r.token) {
          try { sessionStorage.setItem("site.admin", JSON.stringify({ token: r.token, twofa: !!r.twofa, expires: r.expires })); } catch (e) {}
          try { localStorage.setItem("site.adminSeen", String(new Date(r.expires).getTime())); } catch (e) {}
          closePanel(); openPanel();
        } else { m.textContent = "That didn't match — try again."; m.className = "ht-status is-warn"; }
      });
    });
    box.appendChild(pw); box.appendChild(code); box.appendChild(go); box.appendChild(m);
    return box;
  }

  /* ---------- boot ---------- */
  /* Drain any registrations queued against the early stub (interact.js) before this file loaded,
     then replace the stub with the real API. Queued specs register as if they had arrived now. */
  var early = (Site.hatch && Site.hatch._stub && Site.hatch._queue) || [];
  Site.hatch = { register: register, canEdit: canEdit, get: valueOf, open: openFor, has: hasGame };
  for (var qi = 0; qi < early.length; qi++) { try { register(early[qi]); } catch (e) {} }
  try { Site.emit && Site.emit("hatch:ready"); } catch (e) {}
  (Site.ready || function (fn) { fn(); })(function () {
    fetchAll().then(function () { hydrateAll(); if (canEdit()) { ensureFab(); emitFab(); } });
  }, "hatch");
})();
