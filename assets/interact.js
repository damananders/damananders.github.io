/* Site-wide motion and input (see assets/README.md). Styles: assets/interact.css. Class prefix: ix-.
 *
 *   1. Cursor ring            fine pointers only; Settings row "Cursor ring"; features.cursorRing
 *   2. Page transitions       cross-document View Transitions, or a quick fade where they are missing; features.transitions
 *   3. Button feedback        ripple on .btn / .social / #go, UI sound requests (press-down is plain CSS)
 *   4. Konami code            keyboard and controller; features.konami
 *   5. Controller navigation  D-pad / stick moves focus, A selects, B goes back, Start opens settings, LB / RB scroll
 *
 * Each feature runs inside its own Site.ready() block, so one failing cannot stop the others.
 * Nothing here is needed for the pages to work: without this file they simply lose the extras.
 */
(function () {
  "use strict";
  if (!window.Site) return;

  var Site = window.Site, doc = document, root = doc.documentElement;
  var features = (Site.config && Site.config.features) || {};
  var finePointer = window.matchMedia ? matchMedia("(hover: hover) and (pointer: fine)") : { matches: false };

  function enabled(name) { return features[name] !== false; }
  function mqListen(mq, fn) { if (mq.addEventListener) mq.addEventListener("change", fn); else if (mq.addListener) mq.addListener(fn); }
  function closest(e, sel) { var t = e && e.target; return t && t.closest ? t.closest(sel) : null; }
  function usable(n) { return !!n && !n.disabled && n.getAttribute("aria-disabled") !== "true"; }

  /* A link that loads another page of this site in this tab (not a new tab, a download, a file or a #hash jump). */
  function internalLink(a) {
    if (!a || !a.getAttribute || a.hasAttribute("download") || !usable(a)) return false;
    var target = (a.getAttribute("target") || "").toLowerCase();
    if (target && target !== "_self") return false;
    if (a.origin !== location.origin || !/^https?:$/.test(a.protocol || "")) return false;
    if (a.pathname === location.pathname && a.search === location.search) return false;
    if (/\.(?!html?$)[a-z0-9]{1,8}$/i.test(a.pathname)) return false;
    return true;
  }

  /* Dialogs opened with showModal() sit in the browser's top layer, above any z-index. Showing an element
     as a manual popover puts it there too, and showing it again moves it back to the front. */
  function topLayer(el) {
    if (!el || typeof el.showPopover !== "function") return false;
    try {
      if (!el.hasAttribute("popover")) el.setAttribute("popover", "manual");
      if (el.matches(":popover-open")) el.hidePopover();
      el.showPopover();
      return true;
    } catch (e) { try { el.removeAttribute("popover"); } catch (e2) {} return false; }
  }

  /* Shared between the features below. */
  var go = function (url) { location.href = url; };   /* the page-transition fallback swaps in a fading version */
  var padSwallow = "";                                 /* a controller press the Konami code has claimed */

  /* ====================================================================================================
   * 1. Cursor ring (item 40)
   * ==================================================================================================== */
  Site.ready(function () {
    if (!enabled("cursorRing")) return;
    var HOT = 'a[href],button,summary,input,select,textarea,label[for],[role="button"],[role="tab"],.avenue';
    var ring = null, active = false, shown = false, raf = 0, last = 0, registered = false;
    var x = 0, y = 0, tx = 0, ty = 0, hot = null, layer = null;

    function wanted() { return finePointer.matches && !Site.reducedMotion && Site.pref("cursor") !== false; }
    var dot = null, shapeEl = null, shape = -1;
    /* The ring trails the pointer; the dot inside it sits exactly on the pointer, so aiming stays precise
       now that the normal cursor is hidden while the ring is showing. */
    function place() {
      ring.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0)";
      if (dot) dot.style.transform = "translate3d(" + (tx - x).toFixed(1) + "px," + (ty - y).toFixed(1) + "px,0)";
    }
    function show() { if (!shown) { shown = true; ring.classList.add("ix-ring--show"); root.classList.add("ix-nocursor"); } }
    function hide() { root.classList.remove("ix-nocursor"); if (ring && shown) { shown = false; ring.classList.remove("ix-ring--show", "ix-ring--down"); } }
    /* Themed cursors. AnyPS page: one of the four face-button shapes, re-rolled at random on every click.
       AndersCraft page: weapon outlines that cycle sword, arrow, axe on every click. Hub: the plain ring,
       which turns into the matching set while the pointer is over the AnyPS or AndersCraft card. */
    var FACE = [
      '<path d="M7 7 23 23M23 7 7 23"/>',
      '<circle cx="15" cy="15" r="11"/>',
      '<path d="M15 4.5 26.5 24.5H3.5Z"/>',
      '<rect x="5" y="5" width="20" height="20" rx="1.5"/>'
    ];
    var WEAPONS = [
      /* sword */ '<path d="M26.5 3.5 25 10 12.5 22.5 7.5 17.5 20 5Z"/><path d="M4.5 14.5 15.5 25.5M10 20 5.2 24.8"/><circle cx="4" cy="26" r="1.7"/>',
      /* arrow */ '<path d="M27 3 24.5 12.5 17.5 5.5Z"/><path d="M21 9 5 25M5 25V19.5L8.5 16M5 25H10.5L14 21.5"/>',
      /* axe   */ '<g transform="rotate(28 15 15)"><path d="M14 2.5V27.5"/><path d="M14 6.5C18 6.5 21 5 23 3 27 8 27 15.5 23 20.5 21 18.5 18 17 14 17Z"/><path d="M14 9H9.5V14.5H14"/></g>'
    ];
    FACE.random = true;
    var PAGE_SET = Site.page === "anyps" ? FACE : Site.page === "anderscraft" ? WEAPONS : null;
    var set = null;
    function roll() {
      if (!shapeEl || !set) return;
      var n = shape;
      if (set.random) { do { n = Math.floor(Math.random() * set.length); } while (n === shape); }
      else n = (shape + 1) % set.length;
      shape = n;
      shapeEl.textContent = "";
      shapeEl.appendChild(Site.svg(set[n], { viewBox: "0 0 30 30", "stroke-width": "2" }));
    }
    function useSet(next) {
      if (!ring || next === set) return;
      set = next; shape = -1;
      ring.classList.toggle("ix-ring--shapes", !!set);
      if (set) roll(); else if (shapeEl) shapeEl.textContent = "";
    }

    /* One loop. It eases the ring towards the pointer and stops as soon as it has caught up. */
    function frame(t) {
      raf = 0;
      if (!active || doc.hidden) return;
      var dt = last ? Math.min(48, t - last) : 16.7; last = t;
      var k = 1 - Math.pow(0.76, dt / 16.7);
      x += (tx - x) * k; y += (ty - y) * k;
      if (Math.abs(tx - x) < 0.1 && Math.abs(ty - y) < 0.1) { x = tx; y = ty; place(); return; }
      place();
      raf = requestAnimationFrame(frame);
    }
    function wake() { if (!raf && active && !doc.hidden) { last = 0; raf = requestAnimationFrame(frame); } }

    function setHot(h) {
      if (h && !usable(h)) h = null;
      if (h === hot) return;
      hot = h;
      ring.classList.toggle("ix-ring--hot", !!h);
      /* over a hub card the ring picks up that card's colour */
      var c = "";
      if (h && h.classList.contains("avenue")) { try { c = getComputedStyle(h).getPropertyValue("--accent").trim(); } catch (e) {} }
      if (c) ring.style.setProperty("--ix-ring-accent", c); else ring.style.removeProperty("--ix-ring-accent");
      /* ...and, on the hub, that card's shape set */
      if (Site.page === "hub") {
        var av = h && h.classList.contains("avenue") ? h : null;
        useSet(av && av.classList.contains("anyps") ? FACE : av && av.classList.contains("craft") ? WEAPONS : null);
      }
    }
    function onMove(e) {
      if (e.pointerType === "touch") { hide(); return; }
      tx = e.clientX; ty = e.clientY;
      if (!shown) { x = tx; y = ty; setHot(closest(e, HOT)); show(); }
      place();
      wake();
    }
    function onOver(e) {
      if (e.pointerType === "touch") return;
      setHot(closest(e, HOT));
      var d = closest(e, "dialog[open]");
      if (d !== layer) { layer = d; topLayer(ring); }
    }
    function onDown(e) { if (e.pointerType === "touch") hide(); else if (shown) ring.classList.add("ix-ring--down"); }
    function onUp(e) { if (ring) ring.classList.remove("ix-ring--down"); if (e && e.type === "pointerup") roll(); }
    function onVisible() { if (!doc.hidden && (x !== tx || y !== ty)) wake(); }
    function onDialog() { if (ring) { layer = null; topLayer(ring); } }

    var passive = { passive: true };
    var wiring = [
      [doc, "pointermove", onMove], [doc, "pointerover", onOver], [doc, "pointerdown", onDown],
      [doc, "pointerup", onUp], [doc, "pointercancel", onUp],
      [root, "pointerleave", hide], [root, "mouseleave", hide], [window, "blur", hide],
      [doc, "visibilitychange", onVisible]
    ];
    function enable() {
      if (active || !doc.body) return;
      active = true;
      dot = Site.el("span", { class: "ix-ring-dot" });
      shapeEl = Site.el("span", { class: "ix-ring-shape" });
      ring = Site.el("div", { class: "ix-ring", "aria-hidden": "true" }, Site.el("span", { class: "ix-ring-c" }, shapeEl), dot);
      set = null; useSet(PAGE_SET);
      doc.body.appendChild(ring);
      topLayer(ring);
      wiring.forEach(function (w) { w[0].addEventListener(w[1], w[2], passive); });
    }
    function disable() {
      if (!active) return;
      active = false; shown = false; hot = null; layer = null;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      wiring.forEach(function (w) { w[0].removeEventListener(w[1], w[2], passive); });
      if (ring) ring.remove();
      ring = null; dot = null; shapeEl = null; set = null;
      root.classList.remove("ix-nocursor");
    }
    function sync() {
      if (finePointer.matches && !registered) {
        registered = true;
        Site.settings.register({ id: "cursor", label: "Cursor ring", hint: "Replaces your mouse pointer with a ring.", type: "toggle", pref: "cursor", order: 30 });
      }
      if (wanted()) enable(); else disable();
    }

    Site.on("pref:cursor", sync);
    Site.on("pref:motion", sync);
    Site.on("dialog:open", onDialog);
    mqListen(finePointer, sync);
    sync();
  }, "cursor ring");

  /* ====================================================================================================
   * 2. Page transitions (item 41)
   * ==================================================================================================== */
  Site.ready(function () {
    function wanted() { return enabled("transitions") && !Site.reducedMotion; }
    function clear() { root.classList.remove("ix-leave"); }

    /* Never leave a faded page behind: back/forward cache restores and tab switches always show the page again. */
    window.addEventListener("pageshow", clear);
    doc.addEventListener("visibilitychange", clear);

    /* Browsers with cross-document View Transitions: interact.css opts in, this only says when to skip. */
    if ("CSSViewTransitionRule" in window) {
      /* Chrome only keeps an incoming transition when the stylesheet holding the opt-in rule is already there as
         <body> starts, which in practice means "straight from the cache". Otherwise it drops the transition and
         logs an error. Two small helpers keep that from happening (both switch themselves off if a page ever
         carries the opt-in rule inline in its <head>):
           warm()       when the visitor heads for a link, re-request the stylesheet so a copy that has gone stale
                        is revalidated before the click (no network at all while the copy is fresh);
           cacheCheck() if the cache cannot be used (DevTools "Disable cache", test tools), skip the transition
                        instead of starting one the next page cannot finish. */
      var inline = false, sheetUrl = "", cacheWorks = null, warmedAt = Date.now(), warmLink = null, i;
      try {
        var styles = doc.querySelectorAll("head style");
        for (i = 0; i < styles.length; i++) if (/@view-transition/.test(styles[i].textContent)) inline = true;
        var own = doc.querySelector('link[rel~="stylesheet"][href*="/interact.css"]');
        if (own) sheetUrl = own.href;
      } catch (e) {}

      var skip = function (e) {
        var vt = e && e.viewTransition;
        if (!vt || (wanted() && (inline || cacheWorks !== false || e.type !== "pageswap"))) return;
        ["ready", "finished", "updateCallbackDone"].forEach(function (k) { try { vt[k].catch(function () {}); } catch (err) {} });
        try { vt.skipTransition(); } catch (err2) {}
      };
      window.addEventListener("pageswap", skip);
      window.addEventListener("pagereveal", skip);

      if (!inline && sheetUrl && enabled("transitions")) {
        var warm = function (e) {
          if (Date.now() - warmedAt < 4000 || !wanted() || !internalLink(closest(e, "a[href]"))) return;
          warmedAt = Date.now();
          var old = warmLink;
          warmLink = Site.el("link", { rel: "stylesheet", media: "not all", href: sheetUrl, class: "ix-warm" });   /* never applied: media "not all" */
          doc.head.appendChild(warmLink);
          if (old) old.remove();
        };
        ["pointerover", "focusin", "touchstart"].forEach(function (type) { doc.addEventListener(type, warm, { passive: true }); });

        /* Asks for this page's own address again, cache only (HEAD, so nothing is downloaded). Deliberately not the
           stylesheet: fetching that from script would push it out of the browser's in-memory cache, which is
           exactly where the next page needs to find it. */
        var cacheCheck = function () {
          var here = location.href.split("#")[0];
          if (!window.fetch || !performance.getEntriesByName || Site.page === "404") return;   /* a missing page would log a second 404 */
          fetch(here, { method: "HEAD", cache: "force-cache", credentials: "same-origin" })
            .then(function () {
              setTimeout(function () {
                var list = performance.getEntriesByName(here), last = null;
                for (var j = 0; j < list.length; j++) if (list[j].initiatorType === "fetch") last = list[j];
                if (last && typeof last.transferSize === "number") cacheWorks = last.transferSize === 0;
              }, 60);
            })
            .catch(function () {});
        };
        if (doc.readyState === "complete") setTimeout(cacheCheck, 0);
        else window.addEventListener("load", function () { setTimeout(cacheCheck, 0); });
      }
      return;
    }
    if (!enabled("transitions")) return;

    /* Everyone else: fade the content out (at most 140ms), then go. */
    var timer = 0;
    function leave(url) {
      if (timer) { clearTimeout(timer); timer = 0; location.href = url; return; }
      if (!wanted()) { location.href = url; return; }
      root.classList.add("ix-leave");
      timer = setTimeout(function () {
        timer = 0;
        location.href = url;
        setTimeout(clear, 800);   /* still here (blocked, a download, a slow host)? show the page again */
      }, 140);
    }
    go = leave;

    doc.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !wanted()) return;
      var a = closest(e, "a[href]");
      if (!internalLink(a)) return;
      e.preventDefault();
      leave(a.href);
    });

    /* Fade in, but only when nothing has been painted yet, so the page never flashes. */
    try {
      if (wanted() && window.PerformanceObserver && (PerformanceObserver.supportedEntryTypes || []).indexOf("paint") >= 0 &&
          !performance.getEntriesByType("paint").length) {
        root.classList.add("ix-enter");
        setTimeout(function () { root.classList.remove("ix-enter"); }, 500);
      }
    } catch (e) {}
  }, "page transitions");

  /* ====================================================================================================
   * 3. Button feedback (item 46): ripple and UI sound requests. The press-down itself is CSS (:active).
   * ==================================================================================================== */
  Site.ready(function () {
    var RIPPLE = ".btn,.social,#go";
    var HOVER = ".avenue,.btn,.social";
    var CLICKABLE = 'a[href],button,summary,select,[role="button"],[role="tab"],[role="switch"],' +
      'input[type="checkbox"],input[type="radio"],input[type="submit"],input[type="button"],input[type="reset"]';

    /* The ripple is drawn inside its own clipped box so the button never needs overflow:hidden.
       Looked up on every press because a page may replace a button's contents (the sign-up button does). */
    function holder(host) {
      for (var c = host.firstElementChild; c; c = c.nextElementSibling) if (c.classList.contains("ix-ripple")) return c;
      if (getComputedStyle(host).position === "static") host.classList.add("ix-rel");
      c = Site.el("span", { class: "ix-ripple", "aria-hidden": "true" });
      host.appendChild(c);
      return c;
    }
    function ripple(host, cx, cy) {
      if (Site.reducedMotion || !usable(host)) return;
      var r = host.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return;
      var box = holder(host);
      var px = cx == null ? r.width / 2 : cx - r.left - host.clientLeft;
      var py = cy == null ? r.height / 2 : cy - r.top - host.clientTop;
      var rad = Math.sqrt(Math.pow(Math.max(px, r.width - px), 2) + Math.pow(Math.max(py, r.height - py), 2));
      var ink = Site.el("span", { class: "ix-ripple-ink", style: {
        left: (px - rad).toFixed(1) + "px", top: (py - rad).toFixed(1) + "px", width: (rad * 2).toFixed(1) + "px", height: (rad * 2).toFixed(1) + "px" } });
      box.appendChild(ink);
      var done = function () { ink.remove(); };
      ink.addEventListener("animationend", done);
      setTimeout(done, 900);
    }

    doc.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      var host = closest(e, RIPPLE);
      if (host) ripple(host, e.clientX, e.clientY);
    }, { passive: true });

    /* Counts every UI sound that is asked for, whoever asks (this file loads before audio.js, so the player it
       registers is wrapped here; sounds requested through Site.sfx are counted as well, in case it ever is not). */
    var asked = 0;
    function counted(fn) { return function (name) { if (name !== "hover") asked++; return fn.apply(this, arguments); }; }
    try {
      var register = Site.registerSfx, direct = Site.sfx;
      if (typeof register === "function") Site.registerSfx = function (fn) { return register.call(Site, typeof fn === "function" ? counted(fn) : fn); };
      if (typeof direct === "function") Site.sfx = counted(direct);
    } catch (e) {}

    /* Capture phase, so the sound request is made even if a handler stops the click from bubbling.
       The plain "tap" is only the fallback: it waits until the click's own handlers have run and stays quiet
       when one of them asked for a sound of its own (a switch, the theme button, a panel opening). */
    doc.addEventListener("click", function (e) {
      var hit = closest(e, CLICKABLE);
      if (!usable(hit)) return;
      if (e.detail === 0) { var host = closest(e, RIPPLE); if (host) ripple(host); }   /* keyboard or controller: ripple from the middle */
      if (internalLink(hit)) { Site.sfx("nav"); return; }   /* the page is about to go, so this one cannot wait */
      var before = asked;
      setTimeout(function () { if (asked === before) Site.sfx("tap"); }, 0);
    }, true);

    var lastHover = 0;
    doc.addEventListener("pointerover", function (e) {
      if (e.pointerType !== "mouse" || !finePointer.matches) return;
      var hit = closest(e, HOVER);
      if (!usable(hit)) return;
      var from = e.relatedTarget;
      if (from && from.nodeType && hit.contains(from)) return;   /* moving around inside it */
      var now = Date.now();
      if (now - lastHover < 140) return;
      lastHover = now;
      Site.sfx("hover");
    }, { passive: true });

    /* iOS only applies :active styles when a touch listener exists. */
    doc.addEventListener("touchstart", function () {}, { passive: true });
  }, "button feedback");

  /* ====================================================================================================
   * 4. Konami code (item 48): up up down down left right left right B A, on the keyboard or a controller.
   * ==================================================================================================== */
  Site.ready(function () {
    if (!enabled("konami")) return;
    var CODE = ["up", "up", "down", "down", "left", "right", "left", "right", "b", "a"];
    var KEYS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", b: "b", B: "b", a: "a", A: "a" };
    var COLORS = ["#ff7a1f", "#3d8bff", "#36d39a"];
    var running = false;

    /* Returns a function that takes one input and answers how many of the latest inputs match the start of the code. */
    function tracker() {
      var buf = [];
      var feed = function (k) {
        buf.push(k);
        if (buf.length > CODE.length) buf.shift();
        for (var n = buf.length; n > 0; n--) {
          var ok = true;
          for (var i = 0; i < n; i++) if (buf[buf.length - n + i] !== CODE[i]) { ok = false; break; }
          if (ok) return n;
        }
        return 0;
      };
      feed.reset = function () { buf = []; };
      return feed;
    }

    function confetti(done) {
      var cv = Site.el("canvas", { class: "ix-confetti", "aria-hidden": "true" }), ctx = null;
      try { ctx = cv.getContext("2d"); } catch (e) {}
      if (!ctx || !doc.body) { done(); return; }
      doc.body.appendChild(cv);
      topLayer(cv);

      var TOTAL = 6000, FADE = 900, RAIN = 3600, DRAG = 1.9, GRAVITY = 620, MAX = 340;
      var W = 0, H = 0, dpr = 1, parts = [], elapsed = 0, last = 0, raf = 0, owed = 0, second = false, over = false;

      function size() {
        dpr = Math.min(2, window.devicePixelRatio || 1);
        W = window.innerWidth; H = window.innerHeight;
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      }
      function piece(px, py, vx, vy) {
        if (parts.length >= MAX) return;
        parts.push({ x: px, y: py, vx: vx, vy: vy, w: 6 + Math.random() * 6, h: 9 + Math.random() * 8,
          r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 9, ph: Math.random() * 6.28, vp: 3 + Math.random() * 5,
          sway: 20 + Math.random() * 50, c: COLORS[(Math.random() * COLORS.length) | 0], round: Math.random() < 0.22 });
      }
      function cannon(scale) {
        var n = Math.round(Math.max(30, Math.min(84, W / 16)) * scale);
        for (var i = 0; i < n; i++) {
          var side = i % 2 ? 1 : -1;
          piece(side < 0 ? -8 : W + 8, H * (0.8 + Math.random() * 0.12),
            -side * W * DRAG * (0.05 + Math.random() * 0.5), -H * DRAG * (0.55 + Math.random() * 0.7));
        }
      }
      function step(dt) {
        if (!second && elapsed > 420) { second = true; cannon(0.6); }
        if (elapsed < RAIN) {
          owed += dt * Math.max(10, W / 38);
          while (owed >= 1) { owed -= 1; piece(Math.random() * W, -14, (Math.random() - 0.5) * 120, 40 + Math.random() * 140); }
        }
        var damp = Math.exp(-DRAG * dt);
        for (var i = parts.length - 1; i >= 0; i--) {
          var p = parts[i];
          p.vx *= damp; p.vy = p.vy * damp + GRAVITY * dt;
          p.ph += p.vp * dt; p.r += p.vr * dt;
          p.x += (p.vx + Math.sin(p.ph) * p.sway) * dt; p.y += p.vy * dt;
          if (p.y > H + 30) parts.splice(i, 1);
        }
      }
      function draw() {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, cv.width, cv.height);
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i], c = Math.cos(p.r) * dpr, s = Math.sin(p.r) * dpr, flip = Math.cos(p.ph);
          ctx.setTransform(c, s, -s * flip, c * flip, p.x * dpr, p.y * dpr);
          ctx.fillStyle = p.c;
          if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w * 0.55, 0, 6.2832); ctx.fill(); }
          else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
      }
      function frame(t) {
        raf = 0;
        if (over || doc.hidden) return;          /* paused while the tab is hidden; resumes below */
        var dt = last ? t - last : 16.7; last = t;
        elapsed += Math.min(dt, 250);            /* real time while visible, so a slow device still ends on time */
        if (elapsed >= TOTAL) { stop(); return; }
        step(Math.min(dt, 40) / 1000); draw();
        if (elapsed > TOTAL - FADE) cv.style.opacity = String(Math.max(0, (TOTAL - elapsed) / FADE));
        raf = requestAnimationFrame(frame);
      }
      function resume() { if (!doc.hidden && !raf && !over) { last = 0; raf = requestAnimationFrame(frame); } }
      function stop() {
        if (over) return;
        over = true;
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener("resize", size);
        doc.removeEventListener("visibilitychange", resume);
        cv.remove();
        done();
      }
      size();
      cannon(1);
      window.addEventListener("resize", size);
      doc.addEventListener("visibilitychange", resume);
      resume();
    }

    function party() {
      if (running) return;
      running = true;
      Site.emit("konami");
      Site.toast("Cheat activated. Enjoy the confetti.", { type: "ok", ms: 4200 });
      Site.sfx("success");
      if (Site.reducedMotion) { setTimeout(function () { running = false; }, 2000); return; }   /* toast only */
      confetti(function () { running = false; });
    }

    var keys = tracker(), pad = tracker();

    /* Keyboard: only listens, never preventDefault, so the pages' own arrow-key shortcuts keep working. */
    doc.addEventListener("keydown", function (e) {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Shift" || e.key === "CapsLock") return;
      var t = e.target;
      if (t && t.nodeType === 1 && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) { keys.reset(); return; }   /* typing */
      if (keys(KEYS[e.key] || "other") === CODE.length) { keys.reset(); party(); }
    });

    /* Controller: registered before the navigation below, so it can claim the closing B and A
       (otherwise B would go back and A would click something). */
    Site.gamepad.on(function (btn) {
      var n = pad(btn);
      padSwallow = "";
      if (n === CODE.length) { padSwallow = btn; pad.reset(); party(); }
      else if (n === CODE.length - 1) padSwallow = btn;
    });
  }, "konami");

  /* ====================================================================================================
   * 5. Controller navigation (site-wide)
   * ==================================================================================================== */
  Site.ready(function () {
    if (!enabled("controller")) return;
    var FOCUSABLE = 'a[href],button,input,select,textarea,summary,[tabindex],[contenteditable="true"]';
    /* Widgets that keep one member in the Tab order and move between the others with the arrow keys
       (tabs, the video chapter dots): the D-pad may land on every member, not only on the one with tabindex 0. */
    var ROVING = '[role="tablist"],[role="toolbar"],[role="group"],[role="radiogroup"],[role="menu"],[role="listbox"]';
    var ROVER = 'button,a[href],[role="tab"],[role="radio"],[role="option"],[role="menuitem"]';
    /* Looked at first, innermost first, before anything outside them. */
    var GROUPS = '[role="dialog"],[role="menu"],[role="listbox"],[role="radiogroup"],[role="tablist"],[role="toolbar"]';
    var TOLD = "ix:pad-told";
    var marked = null, told = false;

    function smooth() { return Site.reducedMotion ? "auto" : "smooth"; }

    /* The dialog on top: the open one that holds the focus, else the last one opened in the page. */
    function topDialog() {
      var ds = doc.querySelectorAll("dialog[open]"), act = doc.activeElement;
      if (!ds.length) return null;
      for (var i = ds.length - 1; i >= 0; i--) if (act && act !== doc.body && ds[i].contains(act)) return ds[i];
      return ds[ds.length - 1];
    }
    function scrolledAncestor(el) {
      for (var p = el.parentElement; p && p !== doc.body; p = p.parentElement) if (p.scrollTop > 0 || p.scrollLeft > 0) return true;
      return false;
    }
    /* The on-page box of something the D-pad may land on, or null (hidden, disabled, or parked off the page). */
    function roving(el) {
      return el.getAttribute("tabindex") === "-1" && el.matches(ROVER) && !!(el.parentElement && el.parentElement.closest(ROVING));
    }
    function box(el) {
      if (el.disabled || el.type === "hidden" || el.getAttribute("aria-disabled") === "true") return null;
      if (el.tabIndex < 0 && !roving(el)) return null;
      if (el.closest('[inert],[aria-hidden="true"]')) return null;
      if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true, checkVisibilityCSS: true })) return null;
      var cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.pointerEvents === "none") return null;
      var r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return null;
      var offPage = r.right + window.pageXOffset <= 0 || r.bottom + window.pageYOffset <= 0 || r.left >= Math.max(root.scrollWidth, window.innerWidth);
      if (offPage && !scrolledAncestor(el)) return null;   /* honeypot fields, visually hidden skip links */
      return r;
    }
    function candidates(scope) {
      var out = [], nodes = scope.querySelectorAll(FOCUSABLE);
      for (var i = 0; i < nodes.length; i++) { var r = box(nodes[i]); if (r) out.push({ el: nodes[i], r: r }); }
      return out;
    }
    function current(scope) {
      var a = doc.activeElement;
      if (!a || a === doc.body || a === root || !scope.contains(a) || !box(a)) return null;
      return a;
    }
    function headerH() { return parseFloat(getComputedStyle(root).getPropertyValue("--sx-header-h")) || 0; }
    /* Does this element ride along with the screen instead of the page? "fixed" (the back-to-top button),
       "sticky" (the header, once the page has scrolled and it is stuck to the top), or "". */
    function pinned(el) {
      for (var p = el; p && p !== doc.body && p !== root; p = p.parentElement) {
        var pos = getComputedStyle(p).position;
        if (pos === "fixed") return "fixed";
        if (pos === "sticky" && window.pageYOffset > 4) return "sticky";
      }
      return "";
    }
    function offScreen(r) { return r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth; }
    /* The thing closest to the middle of what the visitor is looking at (below the header), or null. */
    function nearest(scope, list) {
      var top = scope === doc ? headerH() : 0, w = window.innerWidth, h = window.innerHeight;
      var mx = w / 2, my = (top + h) / 2, best = null, bestD = Infinity;
      for (var i = 0; i < list.length; i++) {
        var r = list[i].r, cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
        if (cy < top || cy > h || cx < 0 || cx > w) continue;
        if (r.top < top - 1 && r.bottom > h + 1) continue;             /* a box taller than the screen is not "near" anything */
        if (scope === doc && pinned(list[i].el)) continue;
        var d = Math.abs(cy - my) + Math.abs(cx - mx) * 0.5;
        if (d < bestD) { bestD = d; best = list[i].el; }
      }
      return best;
    }
    /* Where to start when nothing is focused: the first hub card, else the first thing in the main content.
       If that is not on screen (the visitor has scrolled), whatever is nearest the middle of the screen. */
    function first(scope, list) {
      if (!list.length) return null;
      if (scope !== doc) return list[0].el;
      var i, pick = null, main = doc.querySelector('main,[role="main"]');
      for (i = 0; i < list.length && !pick; i++) if (list[i].el.classList.contains("avenue")) pick = list[i];
      if (main) for (i = 0; i < list.length && !pick; i++) if (main.contains(list[i].el)) pick = list[i];
      for (i = 0; i < list.length && !pick; i++) if (!list[i].el.closest("nav")) pick = list[i];
      if (!pick) pick = list[0];
      if (pick.r.bottom > headerH() && pick.r.top < window.innerHeight) return pick.el;
      return nearest(scope, list) || pick.el;
    }

    function unmark() { if (marked) { marked.classList.remove("ix-pad-focus"); marked = null; } }
    function focus(el) {
      if (!el) return;
      unmark();
      marked = el;
      el.classList.add("ix-pad-focus");   /* a focus ring that does not depend on the browser's keyboard heuristics */
      try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) {} }
      if (doc.activeElement !== el) { unmark(); return; }
      stopGlide();
      try { el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: smooth() }); } catch (e3) { el.scrollIntoView(false); }
    }
    doc.addEventListener("focusout", function (e) { if (e.target === marked) unmark(); });

    function gap(a1, a2, b1, b2) { return b1 >= a2 ? b1 - a2 : a1 >= b2 ? a1 - b2 : 0; }
    /* Lower is better; Infinity means "not in that direction". Distance along the pressed direction,
       plus a penalty for being off to the side (stronger for left/right, because pages flow downwards). */
    function score(dir, a, b, rows) {
      var ax = (a.left + a.right) / 2, ay = (a.top + a.bottom) / 2, along, aside, weight;
      if (dir === "right") { if (b.left < ax || b.right <= a.right) return Infinity; along = b.left - a.right; }
      else if (dir === "left") { if (b.right > ax || b.left >= a.left) return Infinity; along = a.left - b.right; }
      else if (dir === "down") { if (b.top < ay || b.bottom <= a.bottom) return Infinity; along = b.top - a.bottom; }
      else { if (b.bottom > ay || b.top >= a.top) return Infinity; along = a.top - b.bottom; }
      if (dir === "left" || dir === "right") { aside = gap(a.top, a.bottom, b.top, b.bottom); weight = 3; }
      else { aside = gap(a.left, a.right, b.left, b.right); weight = 1.5; }
      if (along < 0) along = 0;
      /* in a panel of rows, up / down goes to the next row, however far to the side its control sits */
      if (rows) return along * 4 + aside * 0.25 + Math.abs((b.left + b.right) / 2 - ax) * 0.02;
      if (aside > 2 * along + 32) return Infinity;
      return along + aside * weight + (Math.abs((b.left + b.right) / 2 - ax) + Math.abs((b.top + b.bottom) / 2 - ay)) * 0.02;
    }
    /* One box drawn inside the other (the "show passwords" button sits inside its field): edges cannot say which
       way it lies, so the centres do. */
    function within(outer, inner) {
      return inner.left >= outer.left - 1 && inner.right <= outer.right + 1 && inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
    }
    function nestedScore(dir, a, b) {
      var dx = (b.left + b.right) / 2 - (a.left + a.right) / 2, dy = (b.top + b.bottom) / 2 - (a.top + a.bottom) / 2;
      var ok = dir === "right" ? dx > 2 && dx >= Math.abs(dy) : dir === "left" ? -dx > 2 && -dx >= Math.abs(dy)
        : dir === "down" ? dy > 2 && dy > Math.abs(dx) : -dy > 2 && -dy > Math.abs(dx);
      return ok ? (Math.abs(dx) + Math.abs(dy)) * 0.02 : Infinity;
    }
    /* When the focused element has been scrolled out of view and nothing on screen can take over,
       start from the edge of the screen instead. */
    function edge(dir) {
      var w = window.innerWidth, h = window.innerHeight;
      var top = headerH();
      if (dir === "down") return { left: 0, right: w, top: top, bottom: top };
      if (dir === "up") return { left: 0, right: w, top: h, bottom: h };
      if (dir === "right") return { left: 0, right: 0, top: top, bottom: h };
      return { left: w, right: w, top: top, bottom: h };
    }
    /* The part of a dialog that actually scrolls (the dialog itself, or a body element one or two levels in). */
    function scroller(d) {
      var pool = [d], i, j, k;
      for (i = 0; i < d.children.length; i++) { k = d.children[i]; pool.push(k); for (j = 0; j < k.children.length; j++) pool.push(k.children[j]); }
      for (i = 0; i < pool.length; i++) {
        if (pool[i].scrollHeight > pool[i].clientHeight + 4 && /auto|scroll/.test(getComputedStyle(pool[i]).overflowY)) return pool[i];
      }
      return d;
    }
    /* Page scrolling for LB / RB and for "nothing that way". Animated here rather than with the browser's smooth
       scrolling, because two overlapping smooth scrolls (a press landing while the last one is still moving)
       regularly lose one of them. Presses add up; under reduced motion or in a hidden tab it simply jumps. */
    var glide = null;
    function pos(el) { return el === window ? window.pageYOffset : el.scrollTop; }
    function put(el, y) {
      try { el.scrollTo({ top: y, behavior: "instant" }); }
      catch (e) { if (el === window) window.scrollTo(window.pageXOffset, y); else el.scrollTop = y; }
    }
    function limit(el) {
      return el === window ? Math.max(root.scrollHeight, doc.body ? doc.body.scrollHeight : 0) - window.innerHeight : el.scrollHeight - el.clientHeight;
    }
    function stopGlide() { if (glide) { cancelAnimationFrame(glide.raf); glide = null; } }
    function glideTo(el, to) {
      to = Math.max(0, Math.min(limit(el), to));
      stopGlide();
      if (Site.reducedMotion || doc.hidden) { put(el, to); return; }
      var g = glide = { el: el, from: pos(el), to: to, t0: 0, raf: 0 };
      var step = function (t) {
        if (glide !== g) return;
        if (!g.t0) g.t0 = t;
        var k = doc.hidden ? 1 : Math.min(1, (t - g.t0) / 260);
        put(el, g.from + (g.to - g.from) * (1 - Math.pow(1 - k, 3)));
        if (k < 1) g.raf = requestAnimationFrame(step); else glide = null;
      };
      g.raf = requestAnimationFrame(step);
    }
    function scrollBy(sign, share) {
      var d = topDialog(), el = d ? scroller(d) : window;
      var amount = Math.round((d ? el.clientHeight : window.innerHeight) * share) * sign;
      glideTo(el, (glide && glide.el === el ? glide.to : pos(el)) + amount);
    }

    function move(dir) {
      var scope = topDialog() || doc, list = candidates(scope), cur = current(scope), a, best = null, bestScore = Infinity;
      if (!cur) {
        if (list.length) { focus(first(scope, list)); Site.sfx("hover"); }
        return;
      }
      /* a slider takes left / right itself */
      if (cur.tagName === "INPUT" && cur.type === "range" && (dir === "left" || dir === "right")) {
        var before = cur.value;
        try { if (dir === "left") cur.stepDown(); else cur.stepUp(); } catch (e) {}
        if (cur.value !== before) {
          cur.dispatchEvent(new Event("input", { bubbles: true }));
          cur.dispatchEvent(new Event("change", { bubbles: true }));
        }
        return;
      }
      a = cur.getBoundingClientRect();
      if (offScreen(a)) {
        /* The visitor scrolled away from it (LB / RB, the mouse wheel): carry on from what they are looking at,
           not from where the focus was left. */
        var near = nearest(scope, list);
        if (near && near !== cur) { focus(near); Site.sfx("hover"); return; }
        a = edge(dir);
      }
      var vertical = dir === "up" || dir === "down", field = /^(INPUT|TEXTAREA|SELECT)$/;
      /* From the page, things that ride along with the screen (the stuck header, the back-to-top button) are not
         "above" or "beside" anything: they would catch every other press. See below for how they are reached. */
      var free = scope === doc && !pinned(cur);
      var pick = function (group, rows, riders) {
        list.forEach(function (c) {
          if (c.el === cur || (group && !group.contains(c.el))) return;
          if (free && !group && !riders && pinned(c.el)) return;
          var s = within(a, c.r) || (field.test(c.el.tagName) && within(c.r, a)) ? nestedScore(dir, a, c.r) : score(dir, a, c.r, rows);
          if (s < bestScore) { bestScore = s; best = c.el; }
        });
      };
      /* Inside a widget or a floating panel (tabs, a menu, the settings panel) look there first, so the D-pad does
         not wander off to something that merely sits closer on the page behind it. With nothing left that way it
         may leave a widget, but not a panel: that stays put until B closes it. */
      var held = false;
      for (var g = cur.parentElement && cur.parentElement.closest(GROUPS); g && g !== scope && !best && !held; g = g.parentElement && g.parentElement.closest(GROUPS)) {
        var panel = g.getAttribute("role") === "dialog";
        pick(g, panel && vertical, false);
        if (panel) held = true;
      }
      if (!best && !held) pick(null, false, false);
      if (!best && !held && free) {
        /* the header once the page is back at the top (it is not stuck there, so the pass above finds it);
           the floating buttons from the very end of the page */
        if (dir === "down" && window.pageYOffset >= limit(window) - 4) {
          pick(null, false, true);
          if (!best) list.forEach(function (c) {   /* nothing lower: the floating button nearest by */
            if (c.el === cur || pinned(c.el) !== "fixed") return;
            var d = Math.abs((c.r.left + c.r.right - a.left - a.right) / 2) + Math.abs((c.r.top + c.r.bottom - a.top - a.bottom) / 2);
            if (d < bestScore) { bestScore = d; best = c.el; }
          });
        }
      }
      if (best) { focus(best); Site.sfx("hover"); }
      else if (vertical && !held) scrollBy(dir === "up" ? -1 : 1, 0.35);   /* nothing that way: read on */
    }

    function activate() {
      var scope = topDialog() || doc, cur = current(scope);
      if (!cur) { focus(first(scope, candidates(scope))); return; }
      if (offScreen(cur.getBoundingClientRect())) {   /* never press something the visitor cannot see */
        var near = nearest(scope, candidates(scope));
        if (near) { focus(near); return; }
      }
      cur.classList.add("ix-press");
      setTimeout(function () { cur.classList.remove("ix-press"); }, 160);
      if (cur.tagName === "SELECT" && cur.showPicker) { try { cur.showPicker(); return; } catch (e) {} }
      cur.click();
    }

    /* Something the visitor would expect B to close: an expanded popover or panel. */
    function openThings() {
      try { return doc.querySelectorAll('[aria-expanded="true"]:not(summary),[popover]:popover-open:not(.ix-ring):not(.ix-confetti)').length; }
      catch (e) { return doc.querySelectorAll('[aria-expanded="true"]:not(summary)').length; }
    }
    function back() {
      var d = topDialog();
      if (d) { Site.dialog.close(d); Site.sfx("close"); return; }
      var before = openThings(), act = doc.activeElement;
      Site.emit("ui:escape");
      if (openThings() < before || doc.activeElement !== act) return;   /* a popover or panel took it */
      if (Site.page !== "hub") { Site.sfx("nav"); go("/"); }
    }

    Site.gamepad.on(function (btn) {
      if (padSwallow === btn) { padSwallow = ""; return; }   /* the last two presses of the Konami code */
      padSwallow = "";
      if (btn === "up" || btn === "down" || btn === "left" || btn === "right") move(btn);
      else if (btn === "a") activate();
      else if (btn === "b") back();
      else if (btn === "start") Site.emit("ui:settings");
      else if (btn === "lb") scrollBy(-1, 0.8);
      else if (btn === "rb") scrollBy(1, 0.8);
    });

    /* One hint per browser session, the first time a controller shows up. */
    function hello() {
      if (told) return;
      told = true;
      try { if (sessionStorage.getItem(TOLD)) return; sessionStorage.setItem(TOLD, "1"); } catch (e) {}
      Site.toast("Controller connected. D-pad moves, A selects, B goes back.", { ms: 5200 });
    }
    Site.on("gamepad:connected", hello);
    if (Site.gamepad.connected()) hello();
  }, "controller");

  /* ---- add-on layers, loaded here so every page gets them without editing its HTML ----
     play     trophies, secret codes, boot intro      (features.play)
     seasons  seasonal effects                         (features.seasons) */
  Site.ready(function () {
    var f = (Site.config && Site.config.features) || {};
    function load(name, v, flag, onFail) {
      if (f[flag] === false || doc.querySelector('script[src*="/assets/' + name + '.js"]')) { if (onFail) onFail(); return; }
      var css = doc.createElement("link"); css.rel = "stylesheet"; css.href = "/assets/" + name + ".css?v=" + v; doc.head.appendChild(css);
      var js = doc.createElement("script"); js.src = "/assets/" + name + ".js?v=" + v; js.async = true;
      if (onFail) js.onerror = onFail;
      doc.head.appendChild(js);
    }
    load("play", 3, "play", function () { doc.documentElement.classList.remove("pl-preboot"); });
    load("seasons", 1, "seasons");
  }, "add-on loader");
})();
