/* pages/hub-fx.js: visual effects on the hub page (prefix hx-). See assets/README.md.
 * 1 typing headline, 2 parallax photo, 3 card tilt + glare, 4 accent glow, 5 ambient motes, 8 day and night.
 * Each one has a switch in site-config.js (features.*) and a quiet, static fallback for reduced motion.
 * All frame-by-frame work shares ONE requestAnimationFrame loop that sleeps when nothing is changing
 * and stops while the tab is hidden. Everything ambient (motes, glow, lamp, caret, retyping) also comes to
 * rest after a minute without input or when the window loses focus, and picks up again on the next input.
 * Test switch: ?sx=idle:5 rests after 5 seconds instead of 60.
 */
(function () {
  "use strict";
  if (!window.Site) return;
  var Site = window.Site, doc = document, root = doc.documentElement;
  if (Site.page !== "hub") return;

  function feature(name) { var f = Site.config && Site.config.features; return !(f && f[name] === false); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  var mqFine = window.matchMedia ? window.matchMedia("(hover: hover) and (pointer: fine)") : { matches: false };

  /* ---------- shared frame loop: a task returns true while it still has something to animate ---------- */
  var tasks = [], raf = 0, lastT = 0;
  function frame(t) {
    raf = 0;
    if (doc.hidden) { lastT = 0; return; }
    var dt = lastT ? Math.min(64, t - lastT) : 16; lastT = t;
    var more = false;
    for (var i = tasks.length - 1; i >= 0; i--) {
      try { if (tasks[i](t, dt)) more = true; }
      catch (e) { console.error("[site] hub effect stopped", e); tasks.splice(i, 1); }
    }
    if (more) raf = requestAnimationFrame(frame); else lastT = 0;
  }
  function wake() { if (!raf && !doc.hidden) raf = requestAnimationFrame(frame); }
  function addTask(fn) { tasks.push(fn); wake(); }

  var visSubs = [];
  function onVisible(fn) { visSubs.push(fn); }
  doc.addEventListener("visibilitychange", function () {
    root.classList.toggle("hx-hidden", doc.hidden);          /* pauses the CSS animations (glow, lamp, caret) */
    if (doc.hidden) return;
    input();                                                 /* coming back to the tab counts as input */
    wake();
    visSubs.forEach(function (fn) { try { fn(); } catch (e) {} });
  });
  if (doc.hidden) root.classList.add("hx-hidden");

  /* ---------- rest: nobody has touched the page for a while, or the window is in the background ---------- */
  var IDLE_MS = 60000, resting = false, lastInput = 0, idleTimer = 0;
  (function () { var s = parseFloat(Site.debug("idle")); if (isFinite(s) && s > 0) IDLE_MS = s * 1000; })();
  function now() { return window.performance && performance.now ? performance.now() : Date.now(); }
  function setRest(on) {
    if (on === resting) return;
    resting = on;
    root.classList.toggle("hx-rest", on);                    /* pauses the CSS animations, like hx-hidden */
    if (on) return;
    wake();
    visSubs.forEach(function (fn) { try { fn(); } catch (e) {} });
  }
  function checkIdle() {
    idleTimer = 0;
    if (doc.hidden) return;                                  /* nothing runs while hidden; re-armed on return */
    var left = IDLE_MS - (now() - lastInput);
    if (left > 0) idleTimer = setTimeout(checkIdle, left + 20); else setRest(true);
  }
  function input() {
    lastInput = now();
    if (resting) setRest(false);
    if (!idleTimer) idleTimer = setTimeout(checkIdle, IDLE_MS + 20);
  }
  ["pointermove", "pointerdown", "keydown", "wheel", "touchstart", "scroll", "focus"].forEach(function (type) {
    window.addEventListener(type, input, { passive: true, capture: true });
  });
  window.addEventListener("blur", function () { setRest(true); });
  try { if (Site.gamepad && Site.gamepad.on) Site.gamepad.on(input); } catch (e) {}
  input();

  /* ---------- the scene: one fixed box behind the page for the photo layers and the motes ---------- */
  var IMG_W = 1920, IMG_H = 1012;          /* assets/hub-bg.* */
  var LAMP_X = 1126, LAMP_Y = 162;         /* centre of the lighthouse lantern glass in the picture */
  var scene = null, layers = null, sceneW = 0, sceneH = 0, resizeSubs = [];

  function getScene() {
    if (scene) return scene;
    scene = Site.el("div", { class: "hx-scene", "aria-hidden": "true" });
    root.appendChild(scene);               /* a child of <html>, so body fades (page transitions) never touch it */
    measure();
    var pending = false;
    window.addEventListener("resize", function () {
      if (pending) return; pending = true;
      requestAnimationFrame(function () { pending = false; measure(); resizeSubs.forEach(function (fn) { try { fn(); } catch (e) {} }); wake(); });
    });
    return scene;
  }
  function measure() { if (!scene) return; sceneW = scene.clientWidth || window.innerWidth || 1; sceneH = scene.clientHeight || window.innerHeight || 1; }

  /* Photo + wash moved off <body> onto layers, so they can be transformed and tinted. Returns null on pages
     without a body.photo picture. The body's own picture is only switched off after the layers have faded in. */
  function getLayers() {
    if (layers) return layers;
    var body = doc.body; if (!body || !body.classList.contains("photo")) return null;
    var bg = ""; try { bg = getComputedStyle(body).getPropertyValue("--bg").trim(); } catch (e) {}
    var m = /^url\(\s*(['"]?)(.+?)\1\s*\)$/.exec(bg); if (!m) return null;
    var sc = getScene();
    var photo = Site.el("div", { class: "hx-photo" }); photo.style.backgroundImage = bg;
    var lamp = Site.el("div", { class: "hx-lamp", hidden: true },
      Site.el("div", { class: "hx-beam" }), Site.el("div", { class: "hx-lamp-glow" }), Site.el("div", { class: "hx-lamp-core" }));
    var moveA = Site.el("div", { class: "hx-move" }, photo, Site.el("div", { class: "hx-tint--night" }), Site.el("div", { class: "hx-tint--warm" }));
    var moveB = Site.el("div", { class: "hx-move" }, lamp);
    var back = Site.el("div", { class: "hx-back" }, moveA, Site.el("div", { class: "hx-wash" }), moveB, Site.el("div", { class: "hx-veil" }));
    sc.insertBefore(back, sc.firstChild);
    layers = { back: back, moves: [moveA, moveB], lamp: lamp };

    function placeLamp() {                 /* same maths as background-size:cover / background-position:center */
      var s = Math.max(sceneW / IMG_W, sceneH / IMG_H);
      lamp.style.left = (sceneW / 2 + (LAMP_X - IMG_W / 2) * s).toFixed(1) + "px";
      lamp.style.top = (sceneH / 2 + (LAMP_Y - IMG_H / 2) * s).toFixed(1) + "px";
      lamp.style.setProperty("--hx-s", s.toFixed(4));
    }
    placeLamp(); resizeSubs.push(placeLamp);

    var shown = false;
    function show() {
      if (shown) return; shown = true;
      requestAnimationFrame(function () {
        back.classList.add("hx-in");
        setTimeout(function () { root.classList.add("hx-layers"); }, Site.reducedMotion ? 0 : 620);
      });
    }
    var img = new Image();
    img.onload = show;                     /* never swap to a picture that isn't there yet */
    img.onerror = function () { back.remove(); layers = null; };
    img.src = m[2];
    return layers;
  }

  /* =====================================================================================
   * ITEM 1: typing headline
   * ===================================================================================== */
  Site.ready(function () {
    var h1 = doc.querySelector(".hero h1");
    function off() { root.classList.add("hx-type-off"); }
    if (!h1 || h1.children.length) { off(); return; }
    var original = (h1.textContent || "").replace(/\s+/g, " ").trim();
    if (!original || !feature("typing")) { off(); return; }

    /* Keep the longest line the same as the one in hub-fx.css (it reserves the height before this runs). */
    var LINES = [original, "Azeroth, with looser rules?", "One launcher, six PlayStations?"];
    var textEl = null, caret = null, timer = 0, waiting = false;
    var li = 0, ci = 0, mode = "type";

    function build() {
      if (textEl) return;
      h1.setAttribute("aria-label", original);      /* the real heading for assistive tech; the animation is hidden from it */
      h1.textContent = "";
      LINES.forEach(function (l) { h1.appendChild(Site.el("span", { class: "hx-ghost", "aria-hidden": "true", text: l })); });
      textEl = Site.el("span", { class: "hx-text" });
      caret = Site.el("span", { class: "hx-caret" });
      h1.appendChild(Site.el("span", { class: "hx-line", "aria-hidden": "true" }, textEl, caret));
      h1.classList.add("hx-typed");
    }
    function blink(on) { if (caret) caret.classList.toggle("hx-caret--blink", on); }
    function later(ms) { clearTimeout(timer); timer = setTimeout(step, ms); }
    function step() {
      timer = 0;
      if (Site.reducedMotion) return;
      if (doc.hidden) { waiting = true; return; }   /* picked up again by onVisible */
      if (resting && mode === "hold") { waiting = true; return; }   /* at rest the finished line simply stays */
      var line = LINES[li];
      if (mode === "type") {
        blink(false);
        ci++; textEl.textContent = line.slice(0, ci);
        if (ci >= line.length) { mode = "hold"; blink(true); later(li === 0 ? 6200 : 4600); }
        else later(38 + Math.random() * 46 + (/[,?]/.test(line.charAt(ci - 1)) ? 170 : 0));
      } else if (mode === "hold") {
        mode = "erase"; blink(false); later(30);
      } else {
        ci = Math.max(0, ci - 1); textEl.textContent = line.slice(0, ci);
        if (ci === 0) { li = (li + 1) % LINES.length; mode = "type"; blink(true); later(420); }
        else later(20);
      }
    }
    function start() {
      build();
      li = 0; ci = 0; mode = "type"; textEl.textContent = ""; blink(true);
      later(320);
    }
    function stop() {                                 /* plain static heading (the caret is hidden by CSS) */
      clearTimeout(timer); timer = 0; waiting = false;
      if (textEl) { textEl.textContent = original; blink(false); }
    }
    onVisible(function () { if (waiting) { waiting = false; if (!timer) later(200); } });
    var running = false;
    function sync() {
      var want = !Site.reducedMotion; if (want === running) return;
      running = want; if (want) start(); else stop();
    }
    Site.on("pref:motion", sync);
    sync();
  }, "hub typing headline");

  /* =====================================================================================
   * ITEM 8: day and night (tint from the visitor's local hour, lamp light at night)
   * ===================================================================================== */
  Site.ready(function () {
    if (!feature("dayNight")) return;
    var L = getLayers(); if (!L) return;
    function hourNow() {
      if (Site.debug("night")) return 23;
      var h = parseFloat(Site.debug("hour"));
      if (isFinite(h)) return ((h % 24) + 24) % 24;
      var d = new Date(); return d.getHours() + d.getMinutes() / 60;
    }
    function tri(h, peak, half) { return clamp(1 - Math.abs(h - peak) / half, 0, 1); }
    function apply() {
      var h = hourNow();
      /* night: full from 20:30 to 05:30, fading in and out over the hour around 20:00 and 06:00 */
      var night = h >= 12 ? clamp(h - 19.5, 0, 1) : clamp(6.5 - h, 0, 1);
      /* warm light around sunrise (about 05:30-08:30) and sunset (about 17:30-20:30) */
      var warm = Math.max(tri(h, 6.75, 1.75), tri(h, 19, 1.5));
      var st = scene.style;
      st.setProperty("--hx-night", night.toFixed(3));
      st.setProperty("--hx-warm", warm.toFixed(3));
      root.setAttribute("data-hx-phase", night > 0.5 ? "night" : warm > 0.25 ? (h < 12 ? "dawn" : "dusk") : "day");
      L.lamp.hidden = night < 0.02;
    }
    apply();
    setInterval(function () { if (!doc.hidden) apply(); }, 5 * 60 * 1000);
    onVisible(apply);
  }, "hub day and night");

  /* =====================================================================================
   * ITEM 2: parallax (the photo drifts a few pixels with the pointer and with scrolling)
   * ===================================================================================== */
  Site.ready(function () {
    if (!feature("parallax")) return;
    var L = getLayers(); if (!L) return;
    var ZOOM = 1.06;
    var px = 0, py = 0, sy = window.pageYOffset || 0;          /* pointer (-.5 .. .5) and scroll */
    var cx = 0, cy = 0, cz = 1, applied = "";
    function on() { return !Site.reducedMotion; }
    function task(t, dt) {
      var active = on();
      var z = active ? ZOOM : 1;
      var mx = Math.max(0, sceneW * (cz - 1) / 2 - 1), my = Math.max(0, sceneH * (cz - 1) / 2 - 1);   /* never show an edge */
      var tx = active ? clamp(-px * 26, -mx, mx) : 0;
      var ty = active ? clamp(-py * 16 - Math.min(sy * 0.05, 14), -my, my) : 0;
      var k = active ? 1 - Math.exp(-dt / 140) : 1;
      cx += (tx - cx) * k; cy += (ty - cy) * k; cz += (z - cz) * (active ? 1 - Math.exp(-dt / 420) : 1);
      var done = Math.abs(tx - cx) < 0.04 && Math.abs(ty - cy) < 0.04 && Math.abs(z - cz) < 0.0004;
      if (done) { cx = tx; cy = ty; cz = z; }
      var tf = (cz === 1 && !cx && !cy) ? "" : "translate3d(" + cx.toFixed(2) + "px," + cy.toFixed(2) + "px,0) scale(" + cz.toFixed(4) + ")";
      if (tf !== applied) { applied = tf; L.moves[0].style.transform = tf; L.moves[1].style.transform = tf; }
      return !done;
    }
    addTask(task);
    window.addEventListener("scroll", function () { sy = window.pageYOffset || 0; if (on()) wake(); }, { passive: true });
    window.addEventListener("pointermove", function (e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      if (!mqFine.matches || !on()) return;
      px = clamp(e.clientX / (window.innerWidth || 1) - 0.5, -0.5, 0.5);
      py = clamp(e.clientY / (window.innerHeight || 1) - 0.5, -0.5, 0.5);
      wake();
    }, { passive: true });
    Site.on("pref:motion", wake);
  }, "hub parallax");

  /* =====================================================================================
   * ITEM 4: accent glow pulse (all CSS; the class only switches it on)
   * ===================================================================================== */
  Site.ready(function () {
    if (feature("glow")) root.classList.add("hx-glow");
  }, "hub glow");

  /* =====================================================================================
   * ITEM 3: 3D tilt with glare on the cards (mouse only; keyboard focus and touch keep the plain lift)
   * ===================================================================================== */
  Site.ready(function () {
    if (!feature("tilt")) return;
    var cards = Array.prototype.slice.call(doc.querySelectorAll(".avenues .avenue"));
    if (!cards.length) return;
    var MAX_X = 5, MAX_Y = 6;
    var states = cards.map(function (card) {
      var glare = Site.el("span", { class: "hx-glare", "aria-hidden": "true" });
      card.appendChild(glare);
      var s = { card: card, glare: glare, over: false, live: false, rx: 0, ry: 0, l: 0, go: 0, trx: 0, try_: 0 };
      function move(e) {
        if (e.pointerType && e.pointerType !== "mouse") return;
        if (!mqFine.matches || Site.reducedMotion) { if (s.over) leave(); return; }
        var r = card.getBoundingClientRect(); if (r.width < 8 || r.height < 8) return;
        var x = clamp((e.clientX - r.left) / r.width, 0, 1), y = clamp((e.clientY - r.top) / r.height, 0, 1);
        s.over = true;
        s.try_ = (x - 0.5) * 2 * MAX_Y;              /* the side under the pointer leans away, like pressing it */
        s.trx = -(y - 0.5) * 2 * MAX_X;
        glare.style.setProperty("--hx-gx", (x * 100).toFixed(1) + "%");
        glare.style.setProperty("--hx-gy", (y * 100).toFixed(1) + "%");
        if (!s.live) { s.live = true; card.classList.add("hx-tilting"); }
        wake();
      }
      function leave() { if (!s.over) return; s.over = false; wake(); }
      card.addEventListener("pointerenter", move);
      card.addEventListener("pointermove", move, { passive: true });
      card.addEventListener("pointerleave", leave);
      card.addEventListener("pointercancel", leave);
      return s;
    });
    function reset(s) {
      s.live = false; s.over = false; s.rx = s.ry = s.l = s.go = 0;
      s.card.classList.remove("hx-tilting");
      ["--hx-rx", "--hx-ry", "--hx-l"].forEach(function (p) { s.card.style.removeProperty(p); });
      s.glare.style.removeProperty("--hx-go");
    }
    addTask(function (t, dt) {
      var more = false, k = 1 - Math.exp(-dt / 95);
      states.forEach(function (s) {
        if (!s.live) return;
        if (Site.reducedMotion) { reset(s); return; }
        var trx = s.over ? s.trx : 0, tr_y = s.over ? s.try_ : 0, tl = s.over ? 1 : 0;
        s.rx += (trx - s.rx) * k; s.ry += (tr_y - s.ry) * k; s.l += (tl - s.l) * k; s.go += (tl - s.go) * k;
        var settled = Math.abs(trx - s.rx) < 0.02 && Math.abs(tr_y - s.ry) < 0.02 && Math.abs(tl - s.l) < 0.01;
        if (settled && !s.over) { reset(s); return; }
        var st = s.card.style;
        st.setProperty("--hx-rx", s.rx.toFixed(3)); st.setProperty("--hx-ry", s.ry.toFixed(3)); st.setProperty("--hx-l", s.l.toFixed(3));
        s.glare.style.setProperty("--hx-go", s.go.toFixed(3));
        if (!settled) more = true;
      });
      return more;
    });
    function sync() { root.classList.toggle("hx-tilt", mqFine.matches && !Site.reducedMotion); wake(); }
    sync();
    Site.on("pref:motion", sync);
    if (mqFine.addEventListener) mqFine.addEventListener("change", sync);
  }, "hub card tilt");

  /* =====================================================================================
   * ITEM 5: ambient motes (one canvas, about 20 frames a second, soft dots in the three avenue colours)
   * Kept cheap: the canvas is one canvas pixel per CSS pixel whatever the screen density (the dots are soft
   * blurs), only the boxes the dots were drawn in are cleared, the frame loop is woken by a timer for each
   * mote frame instead of spinning at the screen rate, and nothing is drawn while the page is at rest.
   * ===================================================================================== */
  Site.ready(function () {
    if (!feature("particles")) return;
    var probe = doc.createElement("canvas");
    var ctx0 = probe.getContext && probe.getContext("2d"); if (!ctx0) return;
    var canvas = null, ctx = null, motes = [], sprites = [], alphaK = 1, running = false;
    var FRAME = 50, last = 0, tick = 0;
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    var lowPower = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || !!(conn && conn.saveData);

    function colours() {
      var cs = null; try { cs = getComputedStyle(root); } catch (e) {}
      return [["--craft", "#ff7a1f"], ["--anyps", "#3d8bff"], ["--games", "#36d39a"]].map(function (p) {
        var v = cs ? cs.getPropertyValue(p[0]).trim() : ""; return v || p[1];
      });
    }
    function makeSprites() {
      sprites = colours().map(function (col) {
        var c = doc.createElement("canvas"); c.width = c.height = 64;
        var g = c.getContext("2d");
        g.fillStyle = col; g.fillRect(0, 0, 64, 64);
        g.globalCompositeOperation = "destination-in";         /* keep the colour, shape it into a soft dot */
        var rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        rg.addColorStop(0, "rgba(0,0,0,1)"); rg.addColorStop(0.4, "rgba(0,0,0,.7)"); rg.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
        return c;
      });
      alphaK = Site.theme.get() === "light" ? 0.8 : 1;         /* stays faint on the light wash */
    }
    function count() {
      var n = Math.round(sceneW * sceneH / 34000);
      if (sceneW < 700 || lowPower) n = Math.round(n / 2);
      return clamp(n, 6, 48);
    }
    function spawn(anywhere) {
      var big = Math.random() < 0.18;
      return {
        x: Math.random() * sceneW, y: anywhere ? Math.random() * sceneH : sceneH + 20,
        r: big ? 12 + Math.random() * 12 : 3.5 + Math.random() * 4.5,
        a: big ? 0.09 + Math.random() * 0.07 : 0.22 + Math.random() * 0.2,
        vx: (Math.random() - 0.5) * 9, vy: -(3 + Math.random() * 9),
        ph: Math.random() * 6.283, sp: 0.4 + Math.random() * 0.9, c: (Math.random() * 3) | 0,
        bw: 0, bx: 0, by: 0, bs: 0                             /* the box it was last drawn in (bw 0: not drawn) */
      };
    }
    /* Text that sits straight on the photo (hero, hint line, footer): motes fade to a fifth of their strength
       behind it, so they never eat into its contrast. Boxes are re-read only after a scroll or resize. */
    var QUIET = ".hero, #hb-hint, footer", zones = [], zonesDirty = true;
    function readZones() {
      zonesDirty = false; zones = [];
      Array.prototype.forEach.call(doc.querySelectorAll(QUIET), function (n) {
        var r = n.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.bottom > -40 && r.top < sceneH + 40) zones.push(r);
      });
    }
    function quiet(m) {
      var k = 1;
      for (var i = 0; i < zones.length; i++) {
        var z = zones[i];
        var d = Math.max(z.left - m.x, m.x - z.right, z.top - m.y, m.y - z.bottom) - m.r;   /* px outside the box */
        if (d < 28) k = Math.min(k, 0.2 + 0.8 * clamp(d / 28, 0, 1));
      }
      return k;
    }
    function fit() {
      if (!canvas) return;
      zonesDirty = true;
      var w = Math.max(1, Math.round(sceneW)), h = Math.max(1, Math.round(sceneH));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }   /* (this also wipes it) */
      else ctx.clearRect(0, 0, w, h);
      var n = count();
      while (motes.length < n) motes.push(spawn(true));
      motes.length = n;
      motes.forEach(function (m) { m.bw = 0; if (m.x > sceneW) m.x = Math.random() * sceneW; if (m.y > sceneH + 20) m.y = Math.random() * sceneH; });
      last = 0;                                                /* draw on the very next frame */
    }
    function nextFrame() { if (!tick) tick = setTimeout(function () { tick = 0; wake(); }, FRAME - 10); }
    function task(t, dt) {
      if (!running || resting) return false;                   /* at rest the dots stay where they are */
      var gap = last ? t - last : FRAME;
      if (gap < FRAME - 4) {                                   /* not due yet: only another effect is using this frame */
        if (!tick) return true;                                /* (no timer pending, e.g. right after a resize) */
        return false;
      }
      last = t;
      var step = Math.min(gap, 100) / 1000, i, m;
      if (zonesDirty) readZones();
      for (i = 0; i < motes.length; i++) { m = motes[i]; if (m.bw) { ctx.clearRect(m.bx, m.by, m.bs, m.bs); m.bw = 0; } }
      for (i = 0; i < motes.length; i++) {
        m = motes[i];
        m.ph += m.sp * step; m.x += (m.vx + Math.sin(m.ph) * 4) * step; m.y += m.vy * step;
        if (m.y < -24 || m.x < -24 || m.x > sceneW + 24) motes[i] = m = spawn(false);      /* drifted off: come back in from the bottom */
        if (m.y - m.r > sceneH || m.y + m.r < 0 || m.x + m.r < 0 || m.x - m.r > sceneW) continue;   /* outside the picture */
        var a = m.a * alphaK * quiet(m) * (0.8 + 0.2 * Math.sin(m.ph * 1.7));
        if (a < 0.004) continue;
        ctx.globalAlpha = a;
        ctx.drawImage(sprites[m.c], m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
        m.bx = Math.floor(m.x - m.r) - 1; m.by = Math.floor(m.y - m.r) - 1; m.bs = Math.ceil(m.r * 2) + 3; m.bw = 1;
      }
      ctx.globalAlpha = 1;
      nextFrame();                                             /* the loop sleeps until the next mote frame is due */
      return false;
    }
    function start() {
      if (running) return;
      if (!canvas) {
        var sc = getScene();
        canvas = Site.el("canvas", { class: "hx-motes", "aria-hidden": "true" });
        ctx = canvas.getContext("2d"); if (!ctx) { canvas = null; return; }
        sc.appendChild(canvas);
        resizeSubs.push(fit);
        window.addEventListener("scroll", function () { zonesDirty = true; }, { passive: true });
        setInterval(function () { zonesDirty = true; }, 2000);    /* content that loads late can move the text */
        Site.on("pref:theme", makeSprites);
        addTask(task);
      }
      makeSprites(); fit();
      canvas.hidden = false; running = true; last = 0; wake();
    }
    function stop() { running = false; if (canvas) { ctx.clearRect(0, 0, canvas.width, canvas.height); motes.forEach(function (m) { m.bw = 0; }); canvas.hidden = true; } }
    function sync() { if (Site.reducedMotion) stop(); else start(); }
    Site.on("pref:motion", sync);
    sync();
  }, "hub ambient motes");
})();
