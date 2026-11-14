/* sync.js — cross-device account sync, loaded on every page by assets/interact.js (prefix sy-).
 *
 * The idea: sign in with Discord once on your Rate-O-Pedia profile and it shows a secret sync code
 * (XXXX-XXXX-XXXX-XXXX). Paste that code into the "Link account" box on ANY page here and this browser
 * is linked — your trophies (and arcade progress, once the games side plugs in) follow you across devices.
 *
 * The account, the code and the cloud storage all live on the Rate-O-Pedia / Supabase side. This file only
 * talks to three public RPCs with the site's publishable key (meant to be public):
 *   sync_pull(p_code)            -> { ok, state:{ trophies:{id->ts}, arcade:{...}, ... }, handle }
 *   sync_push(p_code,p_ns,p_patch) shallow-merges a patch into one namespace -> { ok, state:<section> }
 *   (signed-in only, on the profile: my_sync_code / sync_regenerate — not called from here)
 *
 * Safety: syncing is MERGE-ONLY. A pull folds remote trophies in (earliest timestamp wins, nothing removed);
 * a push adds this browser's trophies up. So a leaked code can never wipe anyone's progress. On a bad code we
 * stop and ask the user to re-enter — we never retry automatically (the backend rate-limits wrong codes).
 */
(function () {
  "use strict";
  if (!window.Site || window.Site.__syncLoaded) return;
  var Site = window.Site; Site.__syncLoaded = true;
  var el = Site.el, svg = Site.svg, doc = document;
  var SB = Site.sb || {};
  function feat(name) { var f = (Site.config && Site.config.features) || {}; return f[name] !== false; }
  if (!feat("sync")) return;

  var CODE_KEY = "syncCode", HANDLE_KEY = "syncHandle";
  var LINK = '<path d="M9.5 14.5 14.5 9.5"/><path d="M11 7l1.2-1.2a3.5 3.5 0 0 1 5 5L16 12"/><path d="M13 17l-1.2 1.2a3.5 3.5 0 0 1-5-5L8 12"/>';

  function code() { return String(Site.store.get(CODE_KEY, "") || ""); }
  function linked() { return !!code(); }
  function handle() { return String(Site.store.get(HANDLE_KEY, "") || ""); }
  /* The display form: letters/digits only, upper-cased, grouped in fours. Input is forgiving — the backend
     normalizes too, so lowercase or missing dashes are fine; we just tidy what we store and show. */
  function normalize(raw) { return String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
  function pretty(raw) { var s = normalize(raw); return s.replace(/(.{4})(?=.)/g, "$1-"); }

  function rpc(name, body) {
    if (!SB.url || !SB.key || !window.fetch) return Promise.reject("offline");
    return fetch(SB.url + "/rest/v1/rpc/" + name, {
      method: "POST", keepalive: true,
      headers: { apikey: SB.key, Authorization: "Bearer " + SB.key, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (r.status === 404) return { ok: false, error: "unset" };   /* RPCs not deployed yet: feature simply idle */
      if (!r.ok) throw r.status;
      return r.json();
    });
  }

  /* ---- namespaces ----
     trophies is wired here. Any other part of the site (the arcade games) can push its own namespace with
     Site.sync.push(ns, patch) and receive merged remote state via Site.on("sync:pulled", {ns, state}). */
  function applyNs(ns, state) {
    if (ns === "trophies") { if (Site.trophy && Site.trophy.merge) Site.trophy.merge(state || {}); }
    Site.emit("sync:pulled", { ns: ns, state: state || {} });
    Site.emit("sync:pulled:" + ns, state || {});
  }

  /* Pull the whole account and fold every section in. Then push this browser's trophies back up, so a browser
     that already had some get shared to the others (merge-only, so this can only add). */
  function pull(opts) {
    opts = opts || {};
    if (!linked()) return Promise.resolve({ ok: false, error: "no-code" });
    return rpc("sync_pull", { p_code: code() }).then(function (res) {
      if (!res || res.ok === false) {
        if (res && res.error === "bad-code") {   /* regenerated or wrong: forget it, do NOT retry */
          Site.store.set(CODE_KEY, ""); Site.store.set(HANDLE_KEY, "");
          Site.emit("sync:changed");
          if (opts.loud) say("That sync code didn't work. Please enter it again from your profile.", "err");
        }
        return res || { ok: false };
      }
      if (res.handle) Site.store.set(HANDLE_KEY, String(res.handle));
      var state = res.state || {};
      Object.keys(state).forEach(function (ns) { applyNs(ns, state[ns]); });
      Site.emit("sync:changed");
      /* send our own trophies up so this device's progress joins the account */
      if (Site.trophy && Site.trophy.all) {
        var mine = Site.trophy.all();
        if (mine && Object.keys(mine).length) push("trophies", mine);
      }
      return { ok: true, handle: handle() };
    }).catch(function () { return { ok: false, error: "offline" }; });
  }

  /* Push is coalesced per namespace: rapid earns in a row (or several arcade saves) go up as one patch. */
  var pending = {}, flushTimer = 0;
  function flush() {
    flushTimer = 0;
    if (!linked()) { pending = {}; return; }
    Object.keys(pending).forEach(function (ns) {
      var patch = pending[ns]; delete pending[ns];
      if (!patch || !Object.keys(patch).length) return;
      rpc("sync_push", { p_code: code(), p_ns: ns, p_patch: patch }).then(function (res) {
        if (res && res.ok === false && res.error === "bad-code") {
          Site.store.set(CODE_KEY, ""); Site.store.set(HANDLE_KEY, ""); Site.emit("sync:changed");
        }
      }).catch(function () {});
    });
  }
  function push(ns, patch) {
    if (!linked() || !patch || typeof patch !== "object") return;
    if (!/^[a-z0-9_-]{1,32}$/.test(ns)) return;
    var bucket = pending[ns] || (pending[ns] = {});
    Object.keys(patch).forEach(function (k) { bucket[k] = patch[k]; });
    if (!flushTimer) flushTimer = setTimeout(flush, 800);
  }

  /* Link this browser to a code the user pasted in. Validates the shape loosely, stores it, then pulls. */
  function link(raw) {
    var norm = normalize(raw);
    if (norm.length < 12) return Promise.resolve({ ok: false, error: "short" });
    Site.store.set(CODE_KEY, pretty(norm));
    Site.emit("sync:changed");
    return pull({ loud: false }).then(function (res) {
      if (!res.ok) {   /* bad code: pull() already cleared it on bad-code */
        if (res.error !== "bad-code") { Site.store.set(CODE_KEY, ""); Site.store.set(HANDLE_KEY, ""); Site.emit("sync:changed"); }
        return res;
      }
      return res;
    });
  }
  function unlink() {
    Site.store.set(CODE_KEY, ""); Site.store.set(HANDLE_KEY, "");
    Site.emit("sync:changed");
  }

  Site.sync = { code: code, linked: linked, handle: handle, link: link, unlink: unlink, pull: pull, push: push, pretty: pretty };

  /* A tiny status line used inside the dialog. */
  var statusEl = null;
  function say(msg, kind) { if (statusEl) { statusEl.textContent = msg || ""; statusEl.className = "sy-status" + (kind ? " sy-status--" + kind : ""); } }

  function openDialog() {
    var body = el("div", { class: "sy-box" });
    statusEl = el("p", { class: "sy-status", role: "status", "aria-live": "polite" });

    function paint() {
      body.textContent = "";
      if (linked()) {
        var who = handle();
        body.appendChild(el("p", { class: "sy-linked" },
          svg('<path d="M4 12.5 9.5 18 20 6.5"/>', { class: "sy-tick" }),
          el("span", { html: who ? "This browser is linked to <strong>" + who.replace(/[<>&]/g, "") + "</strong>." : "This browser is linked to your account." })));
        body.appendChild(el("p", { class: "sy-note", text: "Your trophies and arcade progress sync here automatically. Syncing only ever adds — it never deletes, so linking is safe." }));
        var now = el("button", { type: "button", class: "btn sy-btn", text: "Sync now" });
        var off = el("button", { type: "button", class: "btn sy-btn sy-btn--ghost", text: "Unlink this browser" });
        now.addEventListener("click", function () {
          say("Syncing…"); now.disabled = true;
          pull({ loud: true }).then(function (r) { now.disabled = false; say(r.ok ? "Synced. You're up to date." : (r.error === "bad-code" ? "" : "Couldn't sync just now."), r.ok ? "ok" : "err"); });
        });
        off.addEventListener("click", function () { unlink(); Site.sfx("toggle"); paint(); });
        body.appendChild(el("div", { class: "sy-actions" }, now, off));
        body.appendChild(statusEl);
      } else {
        body.appendChild(el("p", { class: "sy-note", text: "Link this browser to carry your trophies and arcade progress across devices. On your home browser, sign in with Discord on your Rate-O-Pedia profile to get a secret sync code, then paste it below." }));
        var input = el("input", { type: "text", class: "sy-input", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", placeholder: "XXXX-XXXX-XXXX-XXXX", "aria-label": "Sync code" });
        input.addEventListener("input", function () {
          var p = input.selectionStart === input.value.length;
          input.value = pretty(input.value).slice(0, 19);
          if (p) try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {}
        });
        var go = el("button", { type: "button", class: "btn btn--primary sy-btn", text: "Link this browser" });
        function submit() {
          var v = input.value;
          if (normalize(v).length < 12) { say("That doesn't look like a full code yet.", "err"); input.focus(); return; }
          say("Linking…"); go.disabled = true;
          link(v).then(function (r) {
            go.disabled = false;
            if (r.ok) { Site.sfx("success"); say(""); paint(); Site.toast("Account linked. Your progress now follows you across devices.", { type: "ok", ms: 4200 }); }
            else if (r.error === "unset") say("Account sync isn't switched on yet. Try again a little later.", "err");
            else if (r.error === "offline") say("Couldn't reach the server. Check your connection and try again.", "err");
            else say("That code didn't work. Double-check it on your profile and try again.", "err");
          });
        }
        go.addEventListener("click", submit);
        input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); submit(); } });
        body.appendChild(el("div", { class: "sy-form" }, input, go));
        body.appendChild(statusEl);
        body.appendChild(el("a", { class: "sy-help", href: "/games/", text: "Open Rate-O-Pedia to find your code →" }));
        setTimeout(function () { try { input.focus(); } catch (e) {} }, 60);
      }
    }
    paint();
    var d = Site.modal({ id: "sy-link", title: "Link account", className: "sy-modal", body: body });
    d.addEventListener("close", function () { d.remove(); statusEl = null; });
    Site.dialog.open(d);
  }

  Site.ready(function () {
    /* header tool button, sits with the theme / sound / trophy buttons */
    var tools = Site.tools();
    if (tools) {
      var btn = el("button", { type: "button", class: "sx-iconbtn sy-btn-tool", style: { order: "35" }, "aria-label": "Link account", title: "Link account across devices" }, svg(LINK));
      var dot = el("span", { class: "sy-dot", "aria-hidden": "true" });
      btn.appendChild(dot);
      function paintDot() { btn.classList.toggle("is-linked", linked()); }
      paintDot();
      Site.on("sync:changed", paintDot);
      btn.addEventListener("click", function () { Site.sfx("open"); openDialog(); });
      tools.appendChild(btn);
    }

    /* when linked, pull once on load so this browser catches anything earned elsewhere */
    if (linked()) setTimeout(function () { pull({ loud: false }); }, 1500);

    /* live: a trophy earned on this browser goes up to the account */
    Site.on("trophy:earned", function (v) {
      var d = (v && v.detail) || v; if (!d || !d.id) return;
      var patch = {}; patch[d.id] = d.at || Date.now();
      push("trophies", patch);
    });

    /* arcade progress: the playable-games pages emit "arcade:save" with {game: bestScore, ...}; we store it
       locally and push it up. On a pull, "sync:pulled:arcade" hands them the merged set to apply. */
    Site.on("arcade:save", function (v) {
      var d = (v && v.detail) || v; if (!d || typeof d !== "object") return;
      try { var cur = Site.store.get("arcade", {}) || {}; Object.keys(d).forEach(function (k) { cur[k] = d[k]; }); Site.store.set("arcade", cur); } catch (e) {}
      push("arcade", d);
    });
    Site.on("sync:pulled:arcade", function (v) {
      var state = (v && v.detail) || v; if (!state || typeof state !== "object") return;
      try { var cur = Site.store.get("arcade", {}) || {}; var changed = false;
        Object.keys(state).forEach(function (k) { if (cur[k] == null || (+state[k] || 0) > (+cur[k] || 0)) { cur[k] = state[k]; changed = true; } });
        if (changed) Site.store.set("arcade", cur);
      } catch (e) {}
    });
  }, "account sync");
})();
