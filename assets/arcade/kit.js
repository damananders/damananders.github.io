/* arcade/kit.js — the shared shell for the site's playable games (the Arcade page and the 404 page).
 *
 * Each game registers itself with Arcade.register({...}); the kit gives it:
 *   - a tab in the game picker, and a stage (canvas + menu layer + toasts) that lives in the page;
 *   - "take over the window": starting a run lifts the stage into a full-window overlay; Shrink puts it back in
 *     the page, where it stays fully playable (the run is not interrupted);
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

  var games = [], active = null, wrap = null, picker = null, fullHost = null;
  var DPR_CAP = 2, PAD_DEAD = 0.18;

  function host() {
    if (wrap) return wrap;
    var h = doc.querySelector(".nf-arcade") || doc.querySelector(".nf-hero");
    if (!h) return null;
    picker = el("div", { class: "ak-pick", role: "tablist", "aria-label": "Pick a game" });
    wrap = el("section", { class: "ak", "aria-label": "Games" }, picker);
    h.appendChild(wrap);
    fullHost = el("div", { class: "ak-full", hidden: "" });
    (doc.body || h).appendChild(fullHost);
    return wrap;
  }

  /* ---------------- capture: who owns the keyboard / controller right now ---------------- */
  function captured(g) { return !!g && (g.isFull() || g.state === "play" || g.state === "paused"); }
  function syncCapture() {
    var on = captured(active);
    if (on) root.setAttribute("data-arcade-input", ""); else root.removeAttribute("data-arcade-input");
  }

  /* ---------------- picker ---------------- */
  function select(g, focusTab) {
    if (active === g) return;
    if (active) { if (active.state === "play") active.pause(); if (active.isFull()) active.full(false); active.card.hidden = true; active.tab.setAttribute("aria-selected", "false"); active.tab.classList.remove("is-active"); }
    active = g; g.card.hidden = false; g.tab.setAttribute("aria-selected", "true"); g.tab.classList.add("is-active");
    Site.store.set("arcade.pick", g.id);
    if (focusTab) try { g.tab.focus(); } catch (e) {}
    g.wake(); syncCapture();
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
    var bSize = el("button", { type: "button", class: "ak-hb ak-hb--size", title: "Full window", "aria-label": "Full window" }, "⤢");
    var hb = el("div", { class: "ak-hbs" }, bPause, bSize);
    var stage = el("div", { class: "ak-stage", style: { "--ak-ar": W + " / " + H, "--ak-accent": def.accent || "#cd4257" } }, cv, menuLayer, toasts, hb);
    var slot = el("div", { class: "ak-slot" }, stage);
    var bestEl = el("span", { class: "ak-card__best" });
    var card = el("article", { class: "ak-card", id: "ak-" + def.id, hidden: "", "aria-label": def.name },
      el("div", { class: "ak-card__head" }, el("h2", { text: (def.icon ? def.icon + " " : "") + def.name }), bestEl),
      slot, def.blurb ? el("p", { class: "ak-card__blurb", text: def.blurb }) : null);
    var tab = el("button", { type: "button", class: "ak-pick__b", role: "tab", "aria-selected": "false", "aria-controls": "ak-" + def.id }, (def.icon ? def.icon + " " : "") + def.name);

    var ctx = cv.getContext("2d");
    var g = {
      id: def.id, def: def, W: W, H: H, ctx: ctx, canvas: cv, stage: stage, card: card, tab: tab,
      state: "title", time: 0, view: { s: 1, ox: 0, oy: 0, cw: 0, ch: 0, dpr: 1 },
      keys: {}, keyHits: {}, pointer: { x: W / 2, y: H / 2, down: false, inside: false, type: "mouse" }, pad: pollPad(null),
      store: {
        get: function (k, f) { return Site.store.get("arcade." + def.id + "." + k, f); },
        set: function (k, v) { Site.store.set("arcade." + def.id + "." + k, v); }
      }
    };
    var full = false, raf = 0, last = 0, menuSpec = null, menuBtns = [], menuSel = 0;

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

    /* ---- full window / shrink ---- */
    g.isFull = function () { return full; };
    g.full = function (on) {
      on = !!on; if (on === full) return;
      full = on;
      if (on) { fullHost.appendChild(stage); fullHost.hidden = false; root.classList.add("ak-lock"); }
      else { slot.appendChild(stage); fullHost.hidden = true; root.classList.remove("ak-lock"); }
      stage.classList.toggle("is-full", on);
      bSize.textContent = on ? "⤡" : "⤢"; bSize.title = on ? "Shrink back into the page" : "Full window"; bSize.setAttribute("aria-label", bSize.title);
      fit(); syncCapture(); paint();
      if (menuSpec) focusSel(); else try { cv.focus({ preventScroll: true }); } catch (e) {}
      if (!on && g.state !== "play") try { card.scrollIntoView({ block: "nearest" }); } catch (e) {}
    };
    bSize.addEventListener("click", function () { g.full(!full); });
    bPause.addEventListener("click", function () { if (g.state === "play") g.pause(); else if (g.state === "paused") g.resume(); });

    /* ---- states ---- */
    g.setState = function (s) {
      g.state = s; stage.setAttribute("data-state", s);
      bPause.hidden = !(s === "play" || s === "paused");
      syncCapture(); g.wake();
    };
    g.start = function () { g.closeMenu(); g.setState("play"); if (!full && def.autoFull !== false) g.full(true); try { cv.focus({ preventScroll: true }); } catch (e) {} last = performance.now(); };
    g.pause = function () {
      if (g.state !== "play") return;
      g.setState("paused"); g.keys = {}; Site.sfx("close");
      var items = [{ label: "Resume", act: g.resume }];
      if (def.restart) items.push({ label: "Restart", act: function () { def.restart(g); } });
      (def.pauseItems ? def.pauseItems(g) : []).forEach(function (it) { items.push(it); });
      items.push({ label: full ? "Shrink Window" : "Full Window", act: function () { g.full(!full); g.pause.reopen(); } });
      items.push({ label: "Main Menu", sub: "Ends this run", act: function () { g.toTitle(); } });
      g.menu({ title: "Paused", items: items, back: g.resume, cls: "is-pause" });
    };
    g.pause.reopen = function () { g.state = "play"; g.pause(); };
    g.resume = function () { if (g.state !== "paused") return; g.closeMenu(); g.setState("play"); last = performance.now(); Site.sfx("open"); try { cv.focus({ preventScroll: true }); } catch (e) {} };
    g.toTitle = function () { g.closeMenu(); g.setState("title"); if (def.title) def.title(g); };

    /* ---- menus (real buttons) ---- */
    g.menu = function (spec) {
      menuSpec = spec; menuLayer.textContent = ""; menuBtns = [];
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
        list.appendChild(b); if (!it.disabled) menuBtns.push(b);
      });
      panel.appendChild(list);
      if (spec.foot) panel.appendChild(typeof spec.foot === "string" ? el("p", { class: "ak-panel__foot", text: spec.foot }) : spec.foot);
      menuLayer.appendChild(panel); menuLayer.hidden = false;
      menuSel = Math.max(0, Math.min(menuBtns.length - 1, spec.focus || 0));
      mark(); focusSel(); paint();
    };
    g.closeMenu = function () { menuSpec = null; menuBtns = []; menuLayer.hidden = true; menuLayer.textContent = ""; };
    g.menuOpen = function () { return !!menuSpec; };
    function mark() { menuBtns.forEach(function (b, i) { b.classList.toggle("is-sel", i === menuSel); }); }
    function focusSel() { var b = menuBtns[menuSel]; if (b && (full || captured(g) || stage.contains(doc.activeElement))) try { b.focus({ preventScroll: true }); } catch (e) {} }
    function moveSel(d) { if (!menuBtns.length) return; menuSel = (menuSel + d + menuBtns.length) % menuBtns.length; mark(); try { menuBtns[menuSel].focus({ preventScroll: true }); } catch (e) {} Site.sfx("hover"); }
    function menuBack() { if (menuSpec && menuSpec.back) { Site.sfx("close"); menuSpec.back(); } }
    function menuOk() { var b = menuBtns[menuSel]; if (b) b.click(); }
    g._menuKey = function (k) {
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
      if (doc.hidden || active !== g) return;
      var dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      g.pad = pollPad(g.pad);
      if (g.pad.hit.start && captured(g) && !menuSpec) { if (g.state === "play") g.pause(); }
      if (g.state === "play") { g.time += dt; try { def.update(g, dt); } catch (e) { console.error("[arcade] update", e); } }
      else if (def.idle) { try { def.idle(g, dt); } catch (e) {} }
      paint();
      g.keyHits = {};
      if (!Site.reducedMotion || g.state === "play" || def.alwaysAnimate) raf = requestAnimationFrame(frame);
    }
    g.wake = function () { if (!raf && active === g && !doc.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    g.paint = paint;
    g.key = function (code) { return !!g.keys[code]; };
    g.hit = function (code) { return !!g.keyHits[code]; };

    host(); wrap.appendChild(card); picker.appendChild(tab);
    tab.addEventListener("click", function () { select(g); });
    return g;
  }

  /* ---------------- keyboard routing ---------------- */
  var GAMEKEYS = /^(Arrow|Space$|Enter$|Key[WASDPZXCQEF]$|Shift|Digit[0-9]$|Tab$)/;
  doc.addEventListener("keydown", function (e) {
    var g = active; if (!g) return;
    var t = e.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
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
    if (k === "Escape" && g.isFull()) { e.preventDefault(); g.full(false); return; }
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

  window.Arcade = {
    register: function (def) {
      if (!host()) return null;
      var g = make(def); games.push(g);
      var want = Site.store.get("arcade.pick", null);
      if (!active || g.id === want) select(g);
      try { if (def.init) def.init(g); } catch (e) { console.error("[arcade] init " + def.id, e); }
      g.setState("title");
      if (def.title) def.title(g);
      g.wake(); g.paint();
      return g;
    },
    draw: draw, FONT: FONT, rng: rng, games: games,
    active: function () { return active; }
  };
})();
