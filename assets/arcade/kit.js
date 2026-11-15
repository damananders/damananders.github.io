/* arcade/kit.js — the shared shell for the site's playable games (the Arcade page and the 404 page).
 *
 * Each game registers itself with Arcade.register({...}); the kit gives it:
 *   - a big launcher card on the page (poster art drawn by def.poster, tagline, tags, your progress, Play + Info);
 *   - a stage (canvas + menu layer + toasts) that opens in the full window when the card is played. Minimize docks
 *     it as a small player in the corner that stays fully playable; Expand brings it back; Close pauses the run and
 *     returns to the cards. True browser fullscreen is one button away. Each game has a link (/arcade/#<id>) and the
 *     browser Back button closes it;
 *   - a title-menu system (Arcade menus are real buttons: mouse, keyboard arrows + Enter, controller D-pad + A, B back);
 *   - pause on Esc / P / controller Start, and automatically when the tab or window loses focus;
 *   - input state: held keys, pointer in game coordinates, and the polled controller (sticks, triggers, buttons);
 *   - a fixed logical resolution (W x H) that is letterboxed and scaled to whatever size the stage is.
 *
 * While a game is in the full-window overlay, or a run is in play or paused, <html data-arcade-input> is set so the
 * site's own controller navigation and key shortcuts stand aside (see interact.js / play.js).
 * Stored per browser under Site.store "arcade.*" (games may keep their older keys for continuity).
 */
(function () {
  "use strict";
  if (!window.Site || (window.Site.page !== "404" && window.Site.page !== "arcade")) return;
  var Site = window.Site, el = Site.el, doc = document, root = doc.documentElement;
  if (((Site.config && Site.config.features) || {}).arcade === false) return;

  var games = [], active = null, wrap = null, grid = null, filters = null, fullHost = null, sheet = null;
  var DPR_CAP = 2, PAD_DEAD = 0.18, ROUTE = Site.page === "arcade";

  function host() {
    if (wrap) return wrap;
    var h = doc.querySelector(".nf-arcade") || doc.querySelector(".nf-hero");
    if (!h) return null;
    filters = el("div", { class: "ak-filters", hidden: "", role: "toolbar", "aria-label": "Filter games" });
    grid = el("div", { class: "ak-grid", role: "list" });
    wrap = el("section", { class: "ak" + (Site.page === "404" ? " is-compact" : ""), "aria-label": "Games" },
      Site.page === "404" ? el("h2", { class: "ak-head", text: "Or play a game while you're here" }) : null, filters, grid);
    h.appendChild(wrap);
    fullHost = el("div", { class: "ak-full", hidden: "", role: "dialog", "aria-modal": "false" });
    (doc.body || h).appendChild(fullHost);
    return wrap;
  }
  /* once there are enough games, tag chips filter the grid */
  var tagSel = "";
  function paintFilters() {
    if (games.length <= 6) { filters.hidden = true; return; }
    var tags = []; games.forEach(function (g) { (g.def.tags || []).forEach(function (t) { if (tags.indexOf(t) < 0) tags.push(t); }); });
    filters.textContent = ""; filters.hidden = false;
    [""].concat(tags).forEach(function (t) {
      var b = el("button", { type: "button", class: "ak-chip" + (t === tagSel ? " is-on" : ""), "aria-pressed": t === tagSel ? "true" : "false", text: t || "All games" });
      b.addEventListener("click", function () { tagSel = t; paintFilters(); games.forEach(function (g) { g.tile.hidden = !!t && (g.def.tags || []).indexOf(t) < 0; }); });
      filters.appendChild(b);
    });
  }

  /* ---------------- capture: who owns the keyboard / controller right now ---------------- */
  function captured(g) { return !!g && (g.isFull() || g.state === "play" || g.state === "paused"); }
  function syncCapture() {
    var on = captured(active);
    if (on) root.setAttribute("data-arcade-input", ""); else root.removeAttribute("data-arcade-input");
  }

  /* ---------------- open / close (one game open at a time) ---------------- */
  function select(g) {
    if (active === g) return;
    if (active && active.isOpen()) active.close(true);
    active = g;
    Site.store.set("arcade.pick", g.id);
    g.wake(); syncCapture();
  }
  /* routing: /arcade/#<id> opens a game; Back closes it */
  var pushed = false;
  function route(g) {
    if (!ROUTE || !history.pushState) return;
    var want = g ? "#" + g.id : "";
    if (location.hash === want) return;
    try {
      if (g) { history.pushState({ ak: g.id }, "", want); pushed = true; }
      else if (pushed && history.state && history.state.ak) { pushed = false; history.back(); }
      else history.replaceState(null, "", location.pathname + location.search);
    } catch (e) {}
  }
  function fromHash() {
    var id = (location.hash || "").slice(1), g = games.filter(function (x) { return x.id === id; })[0];
    if (g) { if (!g.isOpen()) g.open({ fromRoute: true }); }
    else if (active && active.isOpen()) active.close(false, true);
  }
  if (ROUTE) window.addEventListener("popstate", function () { pushed = false; fromHash(); });

  /* ---------------- details sheet ---------------- */
  function openSheet(g) {
    closeSheet();
    var d = g.def, body = el("div", { class: "ak-sheet__body" });
    body.appendChild(el("p", { class: "ak-sheet__lead", text: d.about || d.blurb || "" }));
    if (d.controls && d.controls.length) {
      var kv = el("div", { class: "ak-kv ak-sheet__kv" });
      d.controls.forEach(function (c) { kv.appendChild(el("span", { text: c[0] })); kv.appendChild(el("b", { text: c[1] })); });
      body.appendChild(el("h4", { text: "Controls" })); body.appendChild(kv);
    }
    var st = []; try { st = d.stats ? d.stats(g) || [] : []; } catch (e) {}
    if (st.length) {
      var kv2 = el("div", { class: "ak-kv ak-sheet__kv" });
      st.forEach(function (c) { kv2.appendChild(el("span", { text: c[0] })); kv2.appendChild(el("b", { text: String(c[1]) })); });
      body.appendChild(el("h4", { text: "Your progress" })); body.appendChild(kv2);
    }
    var play = el("button", { type: "button", class: "ak-play", text: "Play " + d.name });
    var x = el("button", { type: "button", class: "ak-sheet__x", "aria-label": "Close", text: "✕" });
    sheet = el("div", { class: "ak-sheet", role: "dialog", "aria-modal": "true", "aria-label": d.name, style: { "--ak-accent": d.accent || "#cd4257" } },
      el("div", { class: "ak-sheet__card" }, x, el("div", { class: "ak-sheet__kicker", text: (d.tags || []).join(" · ") }), el("h3", { text: d.name }), body, play));
    function shut() { closeSheet(); try { g.tile.querySelector(".ak-info").focus(); } catch (e) {} }
    x.addEventListener("click", shut);
    sheet.addEventListener("click", function (e) { if (e.target === sheet) shut(); });
    sheet.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); shut(); } });
    play.addEventListener("click", function () { closeSheet(); g.open(); });
    doc.body.appendChild(sheet); root.classList.add("ak-lock");
    try { play.focus(); } catch (e) {}
  }
  function closeSheet() { if (sheet && sheet.parentNode) sheet.parentNode.removeChild(sheet); sheet = null; if (!(active && active.isOpen() && active.isFull())) root.classList.remove("ak-lock"); }

  /* ---------------- posters: drawn by the game, animated while hovered or focused ---------------- */
  var PW_ = 640, PH_ = 360;
  function posterLoop(g) {
    var cv = g.posterCv, ctx = cv.getContext("2d"), live = false, raf2 = 0, t0 = performance.now();
    function size() {
      var r = cv.getBoundingClientRect(), dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
      var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    }
    function drawP(t) {
      size();
      var sx = cv.width / PW_, sy = cv.height / PH_, s = Math.max(sx, sy);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = "#04070b"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.setTransform(s, 0, 0, s, (cv.width - PW_ * s) / 2, (cv.height - PH_ * s) / 2);
      try { if (g.def.poster) g.def.poster(ctx, PW_, PH_, t); else { ctx.fillStyle = g.def.accent || "#cd4257"; ctx.fillRect(0, 0, PW_, PH_); draw.text(ctx, g.def.icon || "🎮", PW_ / 2, PH_ / 2 + 40, "120px " + FONT.display, "#fff", "center"); } } catch (e) { console.error("[arcade] poster " + g.id, e); }
    }
    function tick(now) { raf2 = 0; drawP((now - t0) / 1000); if (live) raf2 = requestAnimationFrame(tick); }
    g.posterOn = function (on) { live = !!on && !Site.reducedMotion; if (live && !raf2) raf2 = requestAnimationFrame(tick); };
    if (window.ResizeObserver) new ResizeObserver(function () { drawP(1.2); }).observe(cv);
    drawP(1.2);
  }

  /* ---------------- controller polling (analog sticks + triggers for gameplay) ---------------- */
  var PADMAP = { 0: "a", 1: "b", 2: "x", 3: "y", 4: "lb", 5: "rb", 6: "lt", 7: "rt", 8: "select", 9: "start", 12: "up", 13: "down", 14: "left", 15: "right" };
  function dz(v) { v = +v || 0; return Math.abs(v) < PAD_DEAD ? 0 : (v - (v > 0 ? PAD_DEAD : -PAD_DEAD)) / (1 - PAD_DEAD); }
  function pollPad(prev) {
    var out = { on: false, lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0, btn: {}, hit: {} }, list = [];
    try { list = Array.prototype.filter.call(navigator.getGamepads ? navigator.getGamepads() : [], function (p) { return p && p.connected; }); } catch (e) {}
    list.forEach(function (p) {
      out.on = true;
      var ax = p.axes || [];
      if (Math.abs(dz(ax[0])) > Math.abs(out.lx)) out.lx = dz(ax[0]);
      if (Math.abs(dz(ax[1])) > Math.abs(out.ly)) out.ly = dz(ax[1]);
      if (Math.abs(dz(ax[2])) > Math.abs(out.rx)) out.rx = dz(ax[2]);
      if (Math.abs(dz(ax[3])) > Math.abs(out.ry)) out.ry = dz(ax[3]);
      for (var i in PADMAP) { var b = p.buttons[i]; if (!b) continue; var v = typeof b.value === "number" ? b.value : (b.pressed ? 1 : 0);
        if (b.pressed || v > 0.5) out.btn[PADMAP[i]] = true;
        if (i === "6") out.lt = Math.max(out.lt, v); if (i === "7") out.rt = Math.max(out.rt, v); }
    });
    for (var k in out.btn) if (!(prev && prev.btn[k])) out.hit[k] = true;
    return out;
  }

  /* ---------------- the game object ---------------- */
  function make(def) {
    var W = def.W || 1280, H = def.H || 720;
    var cv = el("canvas", { class: "ak-cv", role: "img", "aria-label": def.name, tabindex: "-1" });
    var menuLayer = el("div", { class: "ak-menu", hidden: "" });
    var toasts = el("div", { class: "ak-toasts", "aria-live": "polite" });
    var bPause = el("button", { type: "button", class: "ak-hb ak-hb--pause", title: "Pause (Esc / P / Start)", "aria-label": "Pause", hidden: "" }, "❚❚");
    var bSize = el("button", { type: "button", class: "ak-hb ak-hb--size", title: "Minimize", "aria-label": "Minimize" }, "▁");
    var bFs = el("button", { type: "button", class: "ak-hb ak-hb--fs", title: "Fullscreen", "aria-label": "Fullscreen" }, "⛶");
    var bClose = el("button", { type: "button", class: "ak-hb ak-hb--close", title: "Close (keeps your run paused)", "aria-label": "Close game" }, "✕");
    if (!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled)) bFs.hidden = true;
    var hb = el("div", { class: "ak-hbs" }, bPause, bFs, bSize, bClose);
    var stage = el("div", { class: "ak-stage", "data-game": def.id, style: { "--ak-ar": W + " / " + H, "--ak-accent": def.accent || "#cd4257" } }, cv, menuLayer, toasts, hb);
    var shelf = el("div", { class: "ak-shelf", hidden: "" }, stage);

    /* the launcher card */
    var bestEl = el("span", { class: "ak-tile__best" });
    var posterCv = el("canvas", { class: "ak-tile__poster", "aria-hidden": "true" });
    var playBtn = el("button", { type: "button", class: "ak-play", "aria-label": "Play " + def.name, text: "Play" });
    var infoBtn = el("button", { type: "button", class: "ak-info", "aria-label": "About " + def.name, title: "How to play and your progress", text: "i" });
    var tags = el("div", { class: "ak-tile__tags" }); (def.tags || []).forEach(function (t) { tags.appendChild(el("span", { text: t })); });
    var tile = el("article", { class: "ak-tile", id: "ak-" + def.id, role: "listitem", style: { "--ak-accent": def.accent || "#cd4257" } },
      el("div", { class: "ak-tile__art" }, posterCv, def.badge ? el("span", { class: "ak-tile__badge", text: def.badge }) : null),
      el("div", { class: "ak-tile__body" },
        el("h2", { class: "ak-tile__name", text: def.name }),
        el("p", { class: "ak-tile__pitch", text: def.tagline || def.blurb || "" }),
        tags, bestEl,
        el("div", { class: "ak-tile__row" }, playBtn, infoBtn)));

    var ctx = cv.getContext("2d");
    var g = {
      id: def.id, def: def, W: W, H: H, ctx: ctx, canvas: cv, stage: stage, tile: tile, posterCv: posterCv, playBtn: playBtn,
      state: "title", time: 0, view: { s: 1, ox: 0, oy: 0, cw: 0, ch: 0, dpr: 1 },
      keys: {}, keyHits: {}, pointer: { x: W / 2, y: H / 2, down: false, inside: false, type: "mouse" }, pad: pollPad(null),
      store: {
        get: function (k, f) { return Site.store.get("arcade." + def.id + "." + k, f); },
        set: function (k, v) { Site.store.set("arcade." + def.id + "." + k, v); }
      }
    };
    var full = false, open = false, raf = 0, last = 0, menuSpec = null, menuBtns = [], menuIts = [], menuSel = 0;

    /* ---- sizing ---- */
    function fit() {
      var r = stage.getBoundingClientRect(), dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
      var cw = Math.max(1, Math.round(r.width)), ch = Math.max(1, Math.round(r.height));
      if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
      var s = Math.min(cw / W, ch / H);
      g.view = { s: s, ox: (cw - W * s) / 2, oy: (ch - H * s) / 2, cw: cw, ch: ch, dpr: dpr };
      stage.style.setProperty("--ak-s", String(s));
    }
    if (window.ResizeObserver) new ResizeObserver(function () { fit(); if (!raf) paint(); }).observe(stage);
    window.addEventListener("resize", fit);
    g.toGame = function (cx, cy) { var r = cv.getBoundingClientRect(), v = g.view; return { x: (cx - r.left - v.ox) / v.s, y: (cy - r.top - v.oy) / v.s }; };

    /* ---- open (full window) / minimize (docked mini player) / close ---- */
    g.isOpen = function () { return open; };
    g.isFull = function () { return open && full; };
    function layout() {
      fullHost.classList.toggle("is-mini", open && !full);
      stage.classList.toggle("is-full", open && full); stage.classList.toggle("is-mini", open && !full);
      fullHost.setAttribute("aria-modal", open && full ? "true" : "false"); fullHost.setAttribute("aria-label", def.name);
      if (open && full) root.classList.add("ak-lock"); else if (!sheet) root.classList.remove("ak-lock");
      bSize.textContent = full ? "▁" : "⤢"; bSize.title = full ? "Minimize (keep playing in the corner)" : "Expand to the full window"; bSize.setAttribute("aria-label", bSize.title);
      tile.classList.toggle("is-open", open);
      playBtn.textContent = open ? "Open" : g.state === "paused" ? "Resume" : "Play";
      fit(); syncCapture(); paint();
    }
    g.open = function (o) {
      o = o || {};
      select(g);
      if (!open) { open = true; full = true; fullHost.textContent = ""; fullHost.appendChild(stage); fullHost.hidden = false; if (!o.fromRoute) route(g); }
      else full = true;
      layout();
      if (menuSpec) focusSel(); else try { cv.focus({ preventScroll: true }); } catch (e) {}
      Site.sfx("open"); g.wake();
    };
    g.full = function (on) {
      on = !!on;
      if (!open) { if (on) g.open(); return; }
      if (on === full) return;
      full = on; layout();
      if (menuSpec) focusSel(); else try { cv.focus({ preventScroll: true }); } catch (e) {}
    };
    g.close = function (quiet, fromRoute) {
      if (!open) return;
      if (g.state === "play") g.pause();
      exitFs();
      open = false; full = false; shelf.appendChild(stage); fullHost.hidden = true;
      layout();
      if (!fromRoute) route(null);
      if (!quiet) { Site.sfx("close"); try { playBtn.focus({ preventScroll: true }); } catch (e) {} }
    };
    function exitFs() { try { if (doc.fullscreenElement) doc.exitFullscreen(); else if (doc.webkitFullscreenElement) doc.webkitExitFullscreen(); } catch (e) {} }
    bSize.addEventListener("click", function () { g.full(!full); });
    bClose.addEventListener("click", function () { g.close(); });
    bFs.addEventListener("click", function () {
      if (doc.fullscreenElement || doc.webkitFullscreenElement) { exitFs(); return; }
      if (!full) g.full(true);
      try { (fullHost.requestFullscreen || fullHost.webkitRequestFullscreen).call(fullHost); } catch (e) {}
    });
    bPause.addEventListener("click", function () { if (g.state === "play") g.pause(); else if (g.state === "paused") g.resume(); });

    /* ---- states ---- */
    g.setState = function (s) {
      g.state = s; stage.setAttribute("data-state", s);
      if (!open) playBtn.textContent = s === "paused" ? "Resume" : "Play";
      bPause.hidden = !(s === "play" || s === "paused");
      syncCapture(); g.wake();
      if ((s === "over" || s === "title") && def.sync) sySoon();
    };
    g.start = function () { g.closeMenu(); g.setState("play"); if (!open) g.open(); try { cv.focus({ preventScroll: true }); } catch (e) {} last = performance.now(); };
    g.pause = function () {
      if (g.state !== "play") return;
      g.setState("paused"); g.keys = {}; Site.sfx("close");
      var items = [{ label: "Resume", act: g.resume }];
      if (def.restart) items.push({ label: "Restart", act: function () { def.restart(g); } });
      (def.pauseItems ? def.pauseItems(g) : []).forEach(function (it) { items.push(it); });
      items.push({ label: full ? "Minimize" : "Full Window", sub: full ? "Keep playing in the corner" : "", act: function () { g.full(!full); g.pause.reopen(); } });
      items.push({ label: "Main Menu", sub: "Ends this run", act: function () { g.toTitle(); } });
      g.menu({ title: "Paused", items: items, back: g.resume, cls: "is-pause" });
    };
    g.pause.reopen = function () { g.state = "play"; g.pause(); };
    g.resume = function () { if (g.state !== "paused") return; g.closeMenu(); g.setState("play"); last = performance.now(); Site.sfx("open"); try { cv.focus({ preventScroll: true }); } catch (e) {} };
    g.toTitle = function () { g.closeMenu(); g.setState("title"); if (def.title) def.title(g); };

    /* ---- menus (real buttons) ---- */
    g.menu = function (spec) {
      menuSpec = spec; menuLayer.textContent = ""; menuBtns = []; menuIts = [];
      var panel = el("div", { class: "ak-panel " + (spec.cls || ""), role: "dialog", "aria-label": spec.title || def.name });
      if (spec.kicker) panel.appendChild(el("div", { class: "ak-panel__kicker", text: spec.kicker }));
      if (spec.title) panel.appendChild(el("h3", { class: "ak-panel__title", text: spec.title }));
      if (spec.sub) panel.appendChild(el("p", { class: "ak-panel__sub", text: spec.sub }));
      if (spec.body) panel.appendChild(typeof spec.body === "string" ? el("p", { class: "ak-panel__body", text: spec.body }) : spec.body);
      var list = el("div", { class: "ak-panel__items" + (spec.grid ? " is-grid" : "") });
      (spec.items || []).forEach(function (it) {
        if (!it) return;
        var b = el("button", { type: "button", class: "ak-btn " + (it.cls || ""), disabled: it.disabled ? "" : null },
          el("b", { text: it.label }), it.sub ? el("span", { text: it.sub }) : null);
        b.addEventListener("click", function () { if (it.disabled) return; Site.sfx("tap"); it.act && it.act(); });
        b.addEventListener("mouseenter", function () { var i = menuBtns.indexOf(b); if (i >= 0) { menuSel = i; mark(); } });
        list.appendChild(b); if (!it.disabled) { menuBtns.push(b); menuIts.push(it); }
      });
      panel.appendChild(list);
      if (spec.foot) panel.appendChild(typeof spec.foot === "string" ? el("p", { class: "ak-panel__foot", text: spec.foot }) : spec.foot);
      menuLayer.appendChild(panel); menuLayer.hidden = false;
      menuSel = Math.max(0, Math.min(menuBtns.length - 1, spec.focus || 0));
      mark(); focusSel(); paint();
    };
    g.closeMenu = function () { menuSpec = null; menuBtns = []; menuIts = []; menuLayer.hidden = true; menuLayer.textContent = ""; };
    g.menuOpen = function () { return !!menuSpec; };
    function mark() { menuBtns.forEach(function (b, i) { b.classList.toggle("is-sel", i === menuSel); }); }
    function focusSel() { var b = menuBtns[menuSel]; if (b && open && (full || captured(g) || stage.contains(doc.activeElement))) try { b.focus({ preventScroll: true }); } catch (e) {} }
    function moveSel(d) { if (!menuBtns.length) return; menuSel = (menuSel + d + menuBtns.length) % menuBtns.length; mark(); try { menuBtns[menuSel].focus({ preventScroll: true }); } catch (e) {} Site.sfx("hover"); }
    function menuBack() { if (menuSpec && menuSpec.back) { Site.sfx("close"); menuSpec.back(); } }
    function menuOk() { var b = menuBtns[menuSel]; if (b) b.click(); }
    g._menuKey = function (k) {
      var cur = menuIts[menuSel];
      if ((k === "left" || k === "right") && cur && cur.adj) { Site.sfx("tap"); cur.adj(k === "left" ? -1 : 1); return; }   /* a value row: left / right change it */
      if (k === "up" || k === "left") moveSel(-1); else if (k === "down" || k === "right") moveSel(1);
      else if (k === "ok") menuOk(); else if (k === "back") menuBack();
    };

    /* ---- toasts ---- */
    g.toast = function (text, kind) {
      var t = el("div", { class: "ak-toast is-" + (kind || "info"), text: text });
      toasts.appendChild(t);
      while (toasts.children.length > 4) toasts.removeChild(toasts.firstChild);
      setTimeout(function () { t.classList.add("is-out"); }, 1500);
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 1900);
    };
    g.setBest = function (text) { bestEl.textContent = text || ""; };

    /* ---- pointer ---- */
    function pt(e, type) {
      var p = g.toGame(e.clientX, e.clientY); g.pointer.x = p.x; g.pointer.y = p.y; g.pointer.type = e.pointerType || "mouse";
      g.pointer.inside = p.x >= 0 && p.y >= 0 && p.x <= W && p.y <= H;
      if (def.pointer) def.pointer(g, type, p.x, p.y, e);
    }
    cv.addEventListener("pointerdown", function (e) { if (menuSpec) return; g.pointer.down = true; try { cv.setPointerCapture(e.pointerId); } catch (x) {} try { cv.focus({ preventScroll: true }); } catch (x) {} pt(e, "down"); if (g.state === "play") e.preventDefault(); });
    cv.addEventListener("pointermove", function (e) { pt(e, "move"); });
    cv.addEventListener("pointerup", function (e) { g.pointer.down = false; pt(e, "up"); });
    cv.addEventListener("pointercancel", function (e) { g.pointer.down = false; pt(e, "up"); });
    cv.addEventListener("pointerleave", function () { g.pointer.inside = false; });
    cv.addEventListener("contextmenu", function (e) { if (g.state === "play") e.preventDefault(); });

    /* ---- loop ---- */
    function paint() {
      var v = g.view; if (!v.cw) fit(); v = g.view;
      ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
      ctx.fillStyle = "#04070b"; ctx.fillRect(0, 0, v.cw, v.ch);
      ctx.setTransform(v.dpr * v.s, 0, 0, v.dpr * v.s, v.dpr * v.ox, v.dpr * v.oy);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
      try { def.draw(g, ctx); } catch (e) { console.error("[arcade] draw", e); }
      ctx.restore();
    }
    function frame(now) {
      raf = 0;
      if (doc.hidden || active !== g || !open) return;
      var dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      g.pad = pollPad(g.pad);
      if (g.pad.hit.start && captured(g) && !menuSpec) { if (g.state === "play") g.pause(); }
      if (g.state === "play") { g.time += dt; try { def.update(g, dt); } catch (e) { console.error("[arcade] update", e); } }
      else if (def.idle) { try { def.idle(g, dt); } catch (e) {} }
      paint();
      g.keyHits = {};
      if (!Site.reducedMotion || g.state === "play" || def.alwaysAnimate) raf = requestAnimationFrame(frame);
    }
    g.wake = function () { if (!raf && active === g && open && !doc.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    g.paint = paint;
    g.key = function (code) { return !!g.keys[code]; };
    g.hit = function (code) { return !!g.keyHits[code]; };

    host(); grid.appendChild(tile); wrap.appendChild(shelf);
    playBtn.addEventListener("click", function () { if (open) g.full(true); else g.open(); });
    infoBtn.addEventListener("click", function () { Site.sfx("open"); openSheet(g); });
    tile.querySelector(".ak-tile__art").addEventListener("click", function () { playBtn.click(); });
    tile.addEventListener("pointerenter", function () { g.posterOn(true); });
    tile.addEventListener("pointerleave", function () { g.posterOn(false); });
    tile.addEventListener("focusin", function () { g.posterOn(true); });
    tile.addEventListener("focusout", function () { g.posterOn(false); });
    posterLoop(g);
    return g;
  }

  /* ---------------- keyboard routing ---------------- */
  var GAMEKEYS = /^(Arrow|Space$|Enter$|Key[WASDPZXCQEF]$|Shift|Digit[0-9]$|Tab$)/;
  doc.addEventListener("keydown", function (e) {
    var g = active; if (!g || !g.isOpen() || sheet) return;
    var t = e.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    if (g.def.rawKey && g.def.rawKey(g, e)) { e.preventDefault(); e.stopPropagation(); return; }   /* a game listening for a key to bind */
    var cap = captured(g), inStage = g.stage.contains(doc.activeElement);
    if (!cap && !inStage) return;
    var k = e.key;
    if (g.menuOpen()) {
      var map = { ArrowUp: "up", ArrowLeft: "left", ArrowDown: "down", ArrowRight: "right", w: "up", W: "up", s: "down", S: "down", a: "left", A: "left", d: "right", D: "right", Escape: "back", Backspace: "back" };
      if (k === "Tab") { if (!cap) return; e.preventDefault(); g._menuKey(e.shiftKey ? "up" : "down"); return; }
      if (map[k]) { e.preventDefault(); e.stopPropagation(); g._menuKey(map[k]); return; }
      if (k === "p" || k === "P") { if (g.state === "paused") { e.preventDefault(); g.resume(); } return; }
      if ((k === "Enter" || k === " ") && !(doc.activeElement && doc.activeElement.classList && doc.activeElement.classList.contains("ak-btn"))) { e.preventDefault(); g._menuKey("ok"); }
      return;   /* otherwise Enter / Space: the focused button handles them natively */
    }
    if (g.state === "play" && (k === "Escape" || k === "p" || k === "P")) { e.preventDefault(); e.stopPropagation(); g.pause(); return; }
    if (k === "Escape" && g.isFull()) { e.preventDefault(); g.close(); return; }
    if (!g.keys[e.code]) g.keyHits[e.code] = true;
    g.keys[e.code] = true;
    if (g.def.key) g.def.key(g, e);
    if (cap && GAMEKEYS.test(e.code)) e.preventDefault();
  }, true);
  doc.addEventListener("keyup", function (e) { if (active) { delete active.keys[e.code]; if (active.def.keyup) active.def.keyup(active, e); } }, true);
  window.addEventListener("blur", function () { if (active) { active.keys = {}; if (active.state === "play") active.pause(); } });
  doc.addEventListener("visibilitychange", function () { if (!active) return; if (doc.hidden) { if (active.state === "play") active.pause(); } else active.wake(); });

  /* controller: menus + pause while captured (edge events with auto-repeat come from Site.gamepad) */
  if (Site.gamepad) Site.gamepad.on(function (b) {
    var g = active; if (!g || !captured(g)) return;
    if (g.menuOpen()) {
      if (b === "up" || b === "down" || b === "left" || b === "right") g._menuKey(b);
      else if (b === "a") g._menuKey("ok");
      else if (b === "b") g._menuKey("back");
      else if (b === "start" && g.state === "paused") g.resume();
    }
  });

  /* ---------------- shared drawing helpers ---------------- */
  var draw = {
    rr: function (ctx, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2); ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    },
    heartPath: function (ctx, cx, cy, s) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + s * 0.95);
      ctx.bezierCurveTo(cx - s * 1.6, cy - s * 0.1, cx - s * 0.75, cy - s * 1.35, cx, cy - s * 0.45);
      ctx.bezierCurveTo(cx + s * 0.75, cy - s * 1.35, cx + s * 1.6, cy - s * 0.1, cx, cy + s * 0.95);
      ctx.closePath();
    },
    /* a heart split into four quarters; fill = 0..1 in quarter steps, drawn clockwise from the top */
    heart: function (ctx, cx, cy, s, fill, opts) {
      opts = opts || {};
      ctx.save();
      draw.heartPath(ctx, cx, cy, s); ctx.fillStyle = "rgba(255,255,255,.10)"; ctx.fill();
      var q = Math.round(fill * 4);
      if (q > 0) {
        ctx.save(); draw.heartPath(ctx, cx, cy, s); ctx.clip();
        ctx.fillStyle = opts.col || "#ff4d63";
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, s * 2.2, -Math.PI / 2, -Math.PI / 2 + q * Math.PI / 2); ctx.closePath(); ctx.fill();
        var sh = ctx.createLinearGradient(cx, cy - s, cx, cy + s); sh.addColorStop(0, "rgba(255,255,255,.35)"); sh.addColorStop(0.5, "rgba(255,255,255,0)");
        ctx.fillStyle = sh; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, s * 2.2, -Math.PI / 2, -Math.PI / 2 + q * Math.PI / 2); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.save(); draw.heartPath(ctx, cx, cy, s); ctx.clip();      /* quarter seams */
      ctx.strokeStyle = "rgba(10,12,18,.55)"; ctx.lineWidth = Math.max(1.5, s * 0.09);
      ctx.beginPath(); ctx.moveTo(cx, cy - s * 1.5); ctx.lineTo(cx, cy + s * 1.5); ctx.moveTo(cx - s * 1.8, cy); ctx.lineTo(cx + s * 1.8, cy); ctx.stroke();
      ctx.restore();
      draw.heartPath(ctx, cx, cy, s); ctx.strokeStyle = opts.rim || "rgba(255,150,160,.9)"; ctx.lineWidth = Math.max(1.5, s * 0.1); ctx.stroke();
      ctx.restore();
    },
    text: function (ctx, s, x, y, font, col, align, shadow) {
      ctx.font = font; ctx.textAlign = align || "left"; ctx.textBaseline = "alphabetic";
      if (shadow !== false) { ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillText(s, x + 2, y + 3); }
      ctx.fillStyle = col; ctx.fillText(s, x, y);
    }
  };
  var FONT = { display: "var(--display, 'Space Grotesk', system-ui, sans-serif)", mono: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" };
  /* canvas cannot read CSS variables in a font string: resolve them once */
  (function () { try { var cs = getComputedStyle(root), d = (cs.getPropertyValue("--display") || "").trim(); FONT.display = d || "'Space Grotesk', system-ui, sans-serif"; } catch (e) { FONT.display = "'Space Grotesk', system-ui, sans-serif"; } })();

  /* small seeded random, for daily runs and backgrounds */
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  /* ---------------- account sync (assets/sync.js) ----------------
     A game lists what to carry across devices in def.sync: [{ k: name, s: Site.store key, t: type, d: default }].
     Types say how two copies merge, and every one of them only ever adds or keeps the best:
       max (numbers), or (flags), union (arrays), maxmap ({key: number}), ormap ({key: flag}).
     Values go up in the "arcade" section as "<game id>/<k>". The server replaces a key with whatever is pushed,
     so a browser pulls and merges before its first push, and only ever pushes its merged (never lower) copy. */
  var SY = { pulled: false, pulling: false, sent: {}, timer: 0 };
  function syEq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function syMerge(t, a, b) {
    if (a == null) return b; if (b == null) return a;
    if (t === "max") return Math.max(+a || 0, +b || 0);
    if (t === "or") return !!(a || b);
    if (t === "newest") return ((b && b.ts) || 0) > ((a && a.ts) || 0) ? b : a;   /* a whole save: the later one wins */
    if (t === "union") {
      var out = (Array.isArray(a) ? a : []).slice();
      (Array.isArray(b) ? b : []).forEach(function (v) { if (out.indexOf(v) < 0) out.push(v); });
      return out.every(function (v) { return typeof v === "number"; }) ? out.sort(function (x, y) { return x - y; }) : out;
    }
    if (t === "maxmap" || t === "ormap") {
      var o = {}, A = a && typeof a === "object" ? a : {}, Bm = b && typeof b === "object" ? b : {};
      Object.keys(A).concat(Object.keys(Bm)).forEach(function (k) { o[k] = t === "maxmap" ? Math.max(+A[k] || 0, +Bm[k] || 0) : !!(A[k] || Bm[k]); });
      return o;
    }
    return a;
  }
  function syEmpty(v) { return v == null || v === 0 || v === false || (Array.isArray(v) && !v.length) || (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length); }
  function syEach(fn) { games.forEach(function (g) { (g.def.sync || []).forEach(function (sp) { fn(g, sp, g.id + "/" + sp.k); }); }); }
  function syLinked() { return !!(Site.sync && Site.sync.linked && Site.sync.linked()); }
  function syPush() {
    SY.timer = 0;
    if (!syLinked()) return;
    if (!SY.pulled) {                             /* merge with the account first, so a stale copy never goes up */
      if (SY.pulling) return; SY.pulling = true;
      Site.sync.pull({ loud: false }).then(function (r) { SY.pulling = false; if (r && r.ok) { SY.pulled = true; syPush(); } }, function () { SY.pulling = false; });
      return;
    }
    var patch = {}, n = 0;
    syEach(function (g, sp, key) {
      var v = Site.store.get(sp.s, sp.d == null ? null : sp.d);
      if (syEmpty(v) || syEq(v, SY.sent[key])) return;
      patch[key] = v; SY.sent[key] = v; n++;
      if (sp.t === "newest") Site.store.set(sp.s + ".synced", (v && v.ts) || 0);
    });
    if (n) Site.emit("arcade:save", patch);
  }
  function sySoon(ms) { if (!SY.timer) SY.timer = setTimeout(syPush, ms == null ? 1200 : ms); }
  Site.on("sync:pulled:arcade", function (state) {
    if (!state || typeof state !== "object") return;
    SY.pulled = true;
    var touched = [];
    syEach(function (g, sp, key) {
      if (!(key in state)) return;
      var rv = state[key], lv = Site.store.get(sp.s, null), m = syMerge(sp.t, lv, rv);
      if (sp.t === "newest") {                    /* both copies moved on since they last agreed: keep the loser as a backup and say so */
        var base = Site.store.get(sp.s + ".synced", 0) || 0, lt = (lv && lv.ts) || 0, rt = (rv && rv.ts) || 0;
        if (lt && rt && lt > base && rt !== base && rt !== lt) {
          Site.store.set(sp.s + ".backup", m === rv ? lv : rv);
          Site.store.set(sp.s + ".conflict", { at: Date.now(), kept: m === rv ? "account" : "device" });
        }
        Site.store.set(sp.s + ".synced", (m && m.ts) || 0);
      }
      SY.sent[key] = rv;                          /* what the account holds now */
      if (!syEq(m, lv)) { Site.store.set(sp.s, m); if (touched.indexOf(g) < 0) touched.push(g); }
    });
    touched.forEach(function (g) { try { if (g.def.onSync) g.def.onSync(g); } catch (e) {} });
    sySoon(400);                                  /* send up anything this browser has that the account lacked */
  });
  Site.on("sync:changed", function () { if (!syLinked()) { SY.pulled = false; SY.sent = {}; } });
  document.addEventListener("visibilitychange", function () { if (document.hidden && SY.pulled) syPush(); });

  /* the page header's "Continue playing" button + sync status (only where the page has the slots) */
  function paintContinue() {
    var slot = doc.querySelector(".ak-continue"); if (!slot) return;
    var id = Site.store.get("arcade.pick", null), g = games.filter(function (x) { return x.id === id; })[0];
    slot.textContent = "";
    if (g) {
      var b = el("button", { type: "button", class: "ak-cont", style: { "--ak-accent": g.def.accent || "#cd4257" } }, el("span", { text: "Continue playing" }), el("b", { text: g.def.name }));
      b.addEventListener("click", function () { g.open(); }); slot.appendChild(b);
    }
    var st = doc.querySelector(".ak-syncstat");
    if (st) { var on = syLinked(), h = Site.sync && Site.sync.handle ? Site.sync.handle() : ""; st.textContent = on ? "Progress syncs to your account" + (h ? " (" + h + ")" : "") + "." : "Progress is saved in this browser. Link your account (top of the page) to carry it to other devices."; }
  }
  Site.on("sync:changed", function () { setTimeout(paintContinue, 0); });
  /* controller Start on the page (no game open) opens the last game */
  if (Site.gamepad) Site.gamepad.on(function (b) { if (b !== "start" || (active && active.isOpen()) || sheet || Site.page !== "arcade") return; var g = games.filter(function (x) { return x.id === Site.store.get("arcade.pick", null); })[0] || games[0]; if (g) g.open(); });
  doc.addEventListener("fullscreenchange", function () { if (active) setTimeout(function () { active.paint(); }, 50); });

  window.Arcade = {
    register: function (def) {
      if (!host()) return null;
      var g = make(def); games.push(g);
      try { if (def.init) def.init(g); } catch (e) { console.error("[arcade] init " + def.id, e); }
      g.setState("title");
      if (def.title) def.title(g);
      games.slice().sort(function (a, b) { return (a.def.order || 99) - (b.def.order || 99); }).forEach(function (x) { grid.appendChild(x.tile); });
      paintFilters(); paintContinue();
      if (ROUTE && location.hash === "#" + g.id) setTimeout(function () { if (!g.isOpen()) g.open({ fromRoute: true }); }, 0);
      if (def.sync) sySoon(4000);                 /* after sync.js's own pull on page load */
      return g;
    },
    draw: draw, FONT: FONT, rng: rng, games: games, open: function (id) { var g = games.filter(function (x) { return x.id === id; })[0]; if (g) g.open(); return g; },
    active: function () { return active; }
  };
})();
