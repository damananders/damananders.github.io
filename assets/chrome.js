/* Site chrome: the interface layer shared by every page (styles in chrome.css, overview in assets/README.md).
 *
 *   header     makes the existing <nav> sticky, shrinks it after a little scrolling, keeps --sx-header-h current
 *   skip link  "Skip to content" as the first focusable element
 *   theme      sun / moon button in Site.tools() (order 10)
 *   settings   gear button (order 20) and the panel that draws Site.settings.list()
 *   top        floating back-to-top button
 *
 * Every part is wrapped in Site.ready so one failure cannot stop the rest, and each can be switched off in
 * site-config.js with features.stickyHeader / skipLink / themeToggle / settingsPanel / backToTop = false
 * (all default to on). If this file never loads, the pages are simply the plain pages they were.
 *
 * Settings rows come from Site.settings.register(row) (see README). Besides the documented fields the panel
 * also understands, for rows that need it:
 *   on / off      the stored values a toggle switches between (default true / false)
 *   get(), set(v) read / write the value yourself instead of Site.pref(row.pref)
 *   disabled()    return true to show the control but not let it change
 *   hint          may be a function returning the text
 */
(function () {
  "use strict";
  if (!window.Site) return;

  var Site = window.Site, root = document.documentElement, el = Site.el, svg = Site.svg;
  var nav = document.querySelector(".wrap > nav") || document.querySelector("nav");
  root.classList.add("ch-js");

  function feat(name) { var f = (Site.config && Site.config.features) || {}; return f[name] !== false; }
  function sfx(name) { try { Site.sfx(name); } catch (e) {} }
  function focusQuietly(n) { if (!n) return; try { n.focus({ preventScroll: true }); } catch (e) { try { n.focus(); } catch (e2) {} } }
  function scrollY() { return window.pageYOffset || root.scrollTop || 0; }

  /* Icons: plain original line drawings on the shared 24x24 grid. */
  var ICON = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.3M12 19.2v2.3M2.5 12h2.3M19.2 12h2.3M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
    moon: '<path d="M20.2 13.6A8.4 8.4 0 1 1 10.4 3.8a7 7 0 0 0 9.8 9.8Z"/>',
    gear: '<path d="M9.8 5L10.1 2.6L13.9 2.6L14.2 5L15.4 5.5L17.3 4L20 6.7L18.5 8.6L19 9.8L21.4 10.1L21.4 13.9L19 14.2L18.5 15.4L20 17.3L17.3 20L15.4 18.5L14.2 19L13.9 21.4L10.1 21.4L9.8 19L8.6 18.5L6.7 20L4 17.3L5.5 15.4L5 14.2L2.6 13.9L2.6 10.1L5 9.8L5.5 8.6L4 6.7L6.7 4L8.6 5.5Z"/><circle cx="12" cy="12" r="3"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    up: '<path d="M12 19V5.5M5.5 12 12 5.5l6.5 6.5"/>',
    share: '<circle cx="6" cy="12" r="2.4"/><circle cx="17.5" cy="5.5" r="2.4"/><circle cx="17.5" cy="18.5" r="2.4"/><path d="M8.2 10.9 15.3 6.6M8.2 13.1l7.1 4.3"/>',
    star: '<path d="M12 3.5l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.8l6-.8z"/>'
  };

  /* Change the theme with a short cross-fade where the browser supports view transitions; instantly otherwise. */
  function switchTheme(apply) {
    var before = Site.theme.get(), ran = false;
    function run() { if (!ran) { ran = true; apply(); } }
    if (Site.reducedMotion || document.hidden || typeof document.startViewTransition !== "function") { run(); return before !== Site.theme.get(); }
    try {
      root.classList.add("ch-vt");
      var vt = document.startViewTransition(run), done = function () { root.classList.remove("ch-vt"); };
      if (vt && vt.finished) vt.finished.then(done, done); else done();
      if (vt && vt.ready && vt.ready.catch) vt.ready.catch(function () {});
    } catch (e) { root.classList.remove("ch-vt"); run(); }
    return true;
  }

  /* ------------------------------------------------------------------------------------------------
     Sticky, shrinking header
     ------------------------------------------------------------------------------------------------ */
  Site.ready(function () {
    if (!nav || !feat("stickyHeader")) return;

    /* Wrap each social button's bare text in a span so CSS can hide it (the button keeps its name for screen readers). */
    Array.prototype.forEach.call(nav.querySelectorAll(".social"), function (b) {
      if (b.querySelector(".ch-label")) return;
      for (var n = b.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3 && n.nodeValue.trim()) { var s = el("span", { class: "ch-label" }); b.insertBefore(s, n); s.appendChild(n); break; }
      }
    });

    var scrolled = false, fullC = 0, pad = 0, toggledAt = -1e9, settleTimer = 0, remeasureTimer = 0, lastW = root.clientWidth, lastHeaderH = -1;

    /* Height of the nav's content (its rows of buttons), straight from layout: fractional, and unaffected by
       transforms on ancestors. The header people see is this plus the fixed padding above and below. */
    function contentH() {
      var cs = getComputedStyle(nav), h = parseFloat(cs.height);
      if (cs.boxSizing === "border-box") h -= (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      return h > 0 ? h : 0;
    }

    /* How far the glass bar must reach left and right of the nav to touch the viewport edges. */
    function bleed() {
      var r = nav.getBoundingClientRect(), vw = root.clientWidth;
      nav.style.setProperty("--ch-bl", Math.max(0, r.left).toFixed(1) + "px");
      nav.style.setProperty("--ch-br", Math.max(0, vw - r.right).toFixed(1) + "px");
    }

    /* Publish the header height, and hand any height the content lost by shrinking back as bottom padding
       (--ch-comp) so the nav box keeps its size. fullC is the content height of the full-size header. */
    function apply(c) {
      if (!(c > 0)) return;
      if (!scrolled && Date.now() - toggledAt > 420) fullC = c;
      nav.style.setProperty("--ch-comp", Math.max(0, fullC - c).toFixed(2) + "px");
      var hh = Math.round(c + 2 * pad);
      if (hh !== lastHeaderH) { lastHeaderH = hh; root.style.setProperty("--sx-header-h", hh + "px"); }
      bleed();
    }

    /* While shrunk, find out how tall the full-size header would be right now (after a resize, or after another
       script added a button). Done in one go with transitions off, so nothing is painted in between. */
    function remeasure() {
      if (!scrolled) { apply(contentH()); return; }
      root.classList.add("ch-measuring"); root.classList.remove("ch-scrolled");
      var c = contentH();
      root.classList.add("ch-scrolled");
      void nav.offsetHeight;
      root.classList.remove("ch-measuring");
      if (c > 0) fullC = c;
      apply(contentH());
    }
    function remeasureSoon() { clearTimeout(remeasureTimer); remeasureTimer = setTimeout(remeasure, 160); }

    function onScroll() {
      var y = scrollY(), s = scrolled ? y > 8 : y > 24;
      if (s === scrolled) return;
      scrolled = s; toggledAt = Date.now();
      /* Swap sizes and hand the lost height back (--ch-comp) in this one task, with scroll anchoring off while the
         two layouts happen. Otherwise the browser sees a shorter nav for one layout and "corrects" the scroll
         position by that much: the page jumped 50-150px on phones, where the header changes size at once. */
      var anchor = root.style.getPropertyValue("overflow-anchor");
      root.style.setProperty("overflow-anchor", "none");
      root.classList.toggle("ch-scrolled", s);
      apply(contentH());
      void nav.offsetHeight;
      if (anchor) root.style.setProperty("overflow-anchor", anchor); else root.style.removeProperty("overflow-anchor");
      clearTimeout(settleTimer); settleTimer = setTimeout(function () { apply(contentH()); }, 460);
    }

    root.classList.add("ch-on");
    pad = parseFloat(getComputedStyle(nav).paddingTop) || 0;
    fullC = contentH(); apply(fullC);
    onScroll();

    if ("ResizeObserver" in window) {
      new ResizeObserver(function (entries) {
        var e = entries[entries.length - 1], b = e && e.contentBoxSize, c = b ? (b[0] ? b[0].blockSize : b.blockSize) : 0;
        apply(c > 0 ? c : contentH());
      }).observe(nav);
    }
    if ("MutationObserver" in window) {
      new MutationObserver(function (list) {
        for (var i = 0; i < list.length; i++) { var t = list[i].target; if (!(t && t.closest && t.closest(".ch-panel"))) { remeasureSoon(); return; } }
      }).observe(nav, { childList: true, subtree: true });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () {
      bleed();
      var w = root.clientWidth; if (w !== lastW) { lastW = w; remeasureSoon(); }
    });
    window.addEventListener("load", remeasureSoon);
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) document.fonts.ready.then(remeasureSoon, function () {});
  }, "chrome:header");

  /* The hub brand ("Anders …") always returns to the landing page, from any page or depth. */
  Site.ready(function () {
    Array.prototype.forEach.call(document.querySelectorAll("a.brand"), function (a) {
      if (/anders/i.test(a.textContent || "")) a.setAttribute("href", "/");
    });
  }, "chrome:brand");

  /* ------------------------------------------------------------------------------------------------
     Skip link
     ------------------------------------------------------------------------------------------------ */
  Site.ready(function () {
    if (!feat("skipLink") || !document.body) return;
    var target = document.querySelector("main") || document.querySelector(".split") || document.querySelector(".grid") || document.querySelector(".hero");
    if (!target) return;
    if (!target.id) target.id = "ch-content";
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.setAttribute("data-ch-skip-target", "");
    /* Pages without a <main> get their main landmark here, so screen readers have one to jump to. */
    if (!document.querySelector("main,[role='main']") && !target.hasAttribute("role")) target.setAttribute("role", "main");
    var link = el("a", { class: "ch-skip", href: "#" + target.id, text: "Skip to content" });
    link.addEventListener("click", function (e) {
      e.preventDefault();                       /* no hash in the address bar: AnyPS uses the hash for its own dialog */
      focusQuietly(target);
      try { target.scrollIntoView({ block: "start", behavior: "auto" }); } catch (err) { target.scrollIntoView(true); }
    });
    document.body.insertBefore(link, document.body.firstChild);
  }, "chrome:skip");

  /* ------------------------------------------------------------------------------------------------
     Theme button
     ------------------------------------------------------------------------------------------------ */
  Site.ready(function () {
    if (!feat("themeToggle")) return;
    var tools = Site.tools(); if (!tools) return;
    var btn = el("button", { type: "button", class: "sx-iconbtn ch-theme", style: { order: "10" }, "aria-label": "Light theme", "aria-pressed": "false" },
      svg(ICON.sun, { class: "ch-ico ch-ico--sun" }), svg(ICON.moon, { class: "ch-ico ch-ico--moon" }));
    function sync() {
      var light = Site.theme.get() === "light";
      btn.setAttribute("aria-pressed", String(light));
      btn.title = light ? "Switch to the dark theme" : "Switch to the light theme";
    }
    btn.addEventListener("click", function () { switchTheme(function () { Site.theme.toggle(); }); sfx("toggle"); });
    Site.on("pref:theme", sync); sync();
    tools.appendChild(btn);
  }, "chrome:theme");

  /* ------------------------------------------------------------------------------------------------
     Settings panel
     ------------------------------------------------------------------------------------------------ */
  Site.ready(function () {
    if (!feat("settingsPanel")) return;

    Site.settings.register({
      id: "theme", label: "Theme", type: "choice", pref: "theme", order: 10,
      choices: [{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }, { value: "auto", label: "Match Device" }, { value: "sun", label: "Follow the Sun" }],
      hint: function () { return Site.store.get("themeSun", false) === true ? "Light from sunrise to sunset where you are, dark at night." : ""; },
      get: function () { return Site.store.get("themeSun", false) === true ? "sun" : Site.pref("theme"); },
      set: function (v) { switchTheme(function () { Site.setPref("theme", v); }); }
    });
    /* Stored as motion "off" (reduced) or "auto" (follow the device). When the device itself asks for less motion
       the switch shows on and cannot be turned off here, because "auto" would reduce motion anyway. */
    function motionForcedByDevice() { return Site.reducedMotion && Site.pref("motion") !== "off"; }
    Site.settings.register({
      id: "motion", label: "Reduce Motion", type: "toggle", pref: "motion", order: 20,
      hint: function () { return motionForcedByDevice() ? "On, because your device asks for less motion." : "Turns off animations and moving effects."; },
      get: function () { return Site.reducedMotion; },
      set: function (v) { Site.setPref("motion", v ? "off" : "auto"); },
      disabled: motionForcedByDevice
    });

    var tools = Site.tools(); if (!tools || !nav) return;

    var open = false, dirty = true, drawing = false, syncers = [];
    var rowsBox = el("div", { class: "ch-panel__rows" });
    var closeBtn = el("button", { type: "button", class: "ch-panel__x", "aria-label": "Close settings" }, svg(ICON.close));
    var panel = el("div", { class: "ch-panel", id: "ch-settings", role: "dialog", "aria-modal": "false", "aria-labelledby": "ch-settings-title", tabindex: "-1", hidden: true },
      el("div", { class: "ch-panel__head" }, el("h2", { class: "ch-panel__title", id: "ch-settings-title", text: "Settings" }), closeBtn),
      rowsBox);
    var gear = el("button", { type: "button", class: "sx-iconbtn ch-gear", style: { order: "20" }, "aria-label": "Settings", "aria-haspopup": "dialog", "aria-expanded": "false", "aria-controls": "ch-settings" },
      svg(ICON.gear));

    function read(row) { return typeof row.get === "function" ? row.get() : Site.pref(row.pref); }
    function write(row, v) { if (typeof row.set === "function") row.set(v); else Site.setPref(row.pref, v); }
    function locked(row) { return typeof row.disabled === "function" && !!row.disabled(); }
    function hintOf(row) { return typeof row.hint === "function" ? row.hint() : row.hint; }

    function buildRow(row, n) {
      if (!row || !row.label || (!row.pref && typeof row.get !== "function")) return null;
      var base = "ch-set-" + n, lid = base + "-l", hid = base + "-h", key = String(row.id);
      var label = el("div", { class: "ch-row__label", id: lid, text: String(row.label) });
      var hint = el("div", { class: "ch-row__hint", id: hid });
      var text = el("div", { class: "ch-row__text" }, label, hint);
      var node = el("div", { class: "ch-row ch-row--" + row.type }, text);
      function syncHint() { var h = hintOf(row); hint.textContent = h ? String(h) : ""; hint.hidden = !h; }

      if (row.type === "toggle") {
        var onV = "on" in row ? row.on : true, offV = "off" in row ? row.off : false;
        var sw = el("button", { type: "button", class: "ch-switch", role: "switch", "aria-checked": "false", "aria-labelledby": lid, "aria-describedby": hid, "data-ch-key": key });
        var isOn = function () { var v = read(row); return typeof row.get === "function" ? !!v : v === onV; };
        sw.addEventListener("click", function () {
          if (locked(row)) return;
          var next = !isOn(); write(row, typeof row.set === "function" ? next : (next ? onV : offV)); sfx("toggle");
        });
        node.appendChild(sw);
        syncers.push(function () {
          sw.setAttribute("aria-checked", String(isOn()));
          if (locked(row)) sw.setAttribute("aria-disabled", "true"); else sw.removeAttribute("aria-disabled");
          syncHint();
        });
      } else if (row.type === "choice") {
        var choices = Array.isArray(row.choices) ? row.choices : [];
        if (!choices.length) return null;
        var seg = el("div", { class: "ch-seg", role: "group", "aria-labelledby": lid, "aria-describedby": hid });
        var btns = choices.map(function (c, i) {
          var b = el("button", { type: "button", class: "ch-seg__btn", "aria-pressed": "false", "data-ch-key": key + ":" + i, text: String(c.label != null ? c.label : c.value) });
          b.addEventListener("click", function () { if (locked(row) || read(row) === c.value) return; write(row, c.value); sfx("toggle"); });
          seg.appendChild(b); return b;
        });
        node.appendChild(seg);
        syncers.push(function () {
          var v = read(row);
          btns.forEach(function (b, i) { b.setAttribute("aria-pressed", String(choices[i].value === v)); });
          syncHint();
        });
      } else if (row.type === "range") {
        var min = row.min != null ? +row.min : 0, max = row.max != null ? +row.max : 1, step = row.step != null ? +row.step : (max - min) / 20;
        var out = el("span", { class: "ch-row__val", "aria-hidden": "true" });
        var input = el("input", { type: "range", class: "ch-range", min: String(min), max: String(max), step: String(step), "aria-labelledby": lid, "aria-describedby": hid, "data-ch-key": key });
        var show = function (v) {
          var pct = max > min ? Math.max(0, Math.min(1, (v - min) / (max - min))) : 0;
          input.style.setProperty("--ch-fill", (pct * 100).toFixed(1) + "%");
          var txt = max <= 1 && min >= 0 ? Math.round(v * 100) + "%" : String(Math.round(v * 100) / 100);
          out.textContent = txt; input.setAttribute("aria-valuetext", txt);
        };
        input.addEventListener("input", function () { var v = parseFloat(input.value); if (isNaN(v) || locked(row)) return; show(v); write(row, v); });
        node.appendChild(out); node.appendChild(input);
        syncers.push(function () {
          var v = parseFloat(read(row)); if (isNaN(v)) v = min;
          if (document.activeElement !== input || parseFloat(input.value) !== v) input.value = String(v);
          show(v); syncHint();
        });
      } else return null;
      return node;
    }

    function syncAll() { syncers.forEach(function (fn) { try { fn(); } catch (e) { console.error("[site] settings row", e); } }); }

    function draw() {
      dirty = false; drawing = true;
      var act = document.activeElement, key = act && rowsBox.contains(act) ? act.getAttribute("data-ch-key") : null;
      syncers = []; rowsBox.textContent = "";
      Site.settings.list().forEach(function (row, i) { var n = null; try { n = buildRow(row, i); } catch (e) { console.error("[site] settings row", e); } if (n) rowsBox.appendChild(n); });
      syncAll();
      if (key != null) {
        var again = null;
        Array.prototype.forEach.call(rowsBox.querySelectorAll("[data-ch-key]"), function (c) { if (!again && c.getAttribute("data-ch-key") === key) again = c; });
        focusQuietly(again || panel);
      }
      drawing = false;
    }

    /* focus: "back" returns it to the gear, "auto" does so only if it was inside the panel, "leave" never moves it */
    function setOpen(v, focus) {
      if (v === open) return;
      open = v;
      gear.setAttribute("aria-expanded", String(v));
      root.classList.toggle("ch-open", v);
      if (v) {
        if (dirty) draw(); else syncAll();
        panel.hidden = false; void panel.offsetWidth; panel.classList.add("is-in");
        focusQuietly(rowsBox.querySelector("[data-ch-key]:not([aria-disabled='true'])") || closeBtn);
        sfx("open");
      } else {
        var inside = panel.contains(document.activeElement);
        panel.classList.remove("is-in"); panel.hidden = true;
        if (focus === "back" || (focus === "auto" && inside)) focusQuietly(gear);
        sfx("close");
      }
    }
    function toggle() { setOpen(!open, "back"); }

    gear.addEventListener("click", toggle);
    closeBtn.addEventListener("click", function () { setOpen(false, "back"); });
    document.addEventListener("keydown", function (e) { if (open && e.key === "Escape") { e.preventDefault(); setOpen(false, "back"); } });
    /* A press outside the panel only dismisses it: the click that ends that same press is swallowed, so it cannot
       also follow a link or flip a button underneath. Any later press or key forgets it again. */
    var swallow = false;
    document.addEventListener("pointerdown", function (e) {
      swallow = false;
      if (!open) return; var t = e.target;
      if (t && t.nodeType === 1 && (panel.contains(t) || gear.contains(t))) return;
      setOpen(false, "auto");
      swallow = !e.button;
    }, true);
    window.addEventListener("pointercancel", function () { swallow = false; }, true);   /* the press became a scroll */
    window.addEventListener("keydown", function () { swallow = false; }, true);
    window.addEventListener("click", function (e) {
      if (!swallow) return; swallow = false;
      if (e.detail === 0) return;                                                         /* keyboard activation */
      e.preventDefault(); e.stopImmediatePropagation();
    }, true);
    /* Keys that move a slider or a scroll position stay inside the panel (pages have their own arrow-key shortcuts). */
    panel.addEventListener("keydown", function (e) { if (/^(Arrow|Home$|End$|Page)/.test(e.key)) e.stopPropagation(); });
    /* Tabbing (or steering with a controller) out of the panel closes it; focus stays where the visitor put it. */
    panel.addEventListener("focusout", function (e) {
      if (!open || drawing) return; var to = e.relatedTarget;
      if (to && !panel.contains(to) && to !== gear) setOpen(false, "leave");
    });

    Site.on("ui:escape", function () { if (open) setOpen(false, "back"); });
    Site.on("ui:settings", toggle);
    Site.on("settings:changed", function () { dirty = true; if (open) draw(); });
    Site.on("pref", function () { if (open) syncAll(); });
    Site.on("pref:theme", function () { if (open) syncAll(); });    /* also fired when the device theme changes */
    Site.on("pref:motion", function () { if (open) syncAll(); });   /* also fired when the device motion setting changes */

    tools.appendChild(gear);
    nav.appendChild(panel);
  }, "chrome:settings");

  /* ------------------------------------------------------------------------------------------------
     Back to top
     ------------------------------------------------------------------------------------------------ */
  Site.ready(function () {
    if (!feat("backToTop") || !document.body) return;
    var shown = false, raf = 0, host = null;
    var btn = el("button", { type: "button", class: "ch-top", "aria-label": "Back to top" }, svg(ICON.up));

    /* True while a link, button or field sits under the button, so it never covers something people need to press
       (a form's submit button, a "show password" eye, a drop-down). Cards and full-width rows do not count: there
       is plenty of them left to press beside the button. */
    var CONTROL = "a[href],button,input,select,textarea,summary,label,[role='button']";
    function inTheWay() {
      if (!document.elementsFromPoint || document.activeElement === btn) return false;
      var cs = getComputedStyle(btn), w = btn.offsetWidth, h = btn.offsetHeight;
      var x0 = root.clientWidth - (parseFloat(cs.right) || 0) - w, y0 = window.innerHeight - (parseFloat(cs.bottom) || 0) - h;
      var pts = [[.5, .5], [.12, .15], [.12, .85], [.5, .08], [.5, .92]];
      for (var i = 0; i < pts.length; i++) {
        var stack = document.elementsFromPoint(x0 + w * pts[i][0], y0 + h * pts[i][1]);
        for (var j = 0; j < stack.length; j++) {
          var n = stack[j]; if (n === btn || btn.contains(n)) continue;
          var c = n.closest ? n.closest(CONTROL) : null;
          if (c) { var r = c.getBoundingClientRect(); if (r.height <= 96 && (r.width < root.clientWidth * .75 || c.closest("form"))) return true; }
          break;                                                   /* only what is directly underneath counts */
        }
      }
      return false;
    }

    function update() {
      raf = 0;
      var y = scrollY(), on = y > 600 && !inTheWay();
      if (on !== shown) { shown = on; btn.classList.toggle("is-on", on); }
      if (on) btn.style.setProperty("--ch-p", Math.min(1, y / Math.max(1, root.scrollHeight - window.innerHeight)).toFixed(3));
    }
    function onScroll() { if (!raf && !document.hidden) raf = requestAnimationFrame(update); }

    /* Toasts live at the bottom centre. On narrow screens they can reach the corner, so step up above them. */
    function lift() {
      var up = 0;
      if (host && host.childElementCount) {
        var t = host.getBoundingClientRect(), cs = getComputedStyle(btn);
        var left = root.clientWidth - (parseFloat(cs.right) || 0) - btn.offsetWidth;
        if (t.width > 0 && t.right > left - 10) up = Math.max(0, window.innerHeight - t.top + 10);
      }
      if (up) btn.style.setProperty("--ch-lift", Math.round(up) + "px"); else btn.style.removeProperty("--ch-lift");
    }
    function watchToasts() {
      var h = document.getElementById("sx-toasts"); if (!h || h === host) return;
      host = h; new MutationObserver(lift).observe(host, { childList: true }); lift();
    }

    btn.addEventListener("click", function () {
      sfx("nav");
      try { window.scrollTo({ top: 0, behavior: Site.reducedMotion ? "auto" : "smooth" }); } catch (e) { window.scrollTo(0, 0); }
      focusQuietly(nav && nav.querySelector("a[href],button"));     /* keyboard focus goes back to the top with the page */
    });
    document.body.appendChild(btn);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () { onScroll(); lift(); });
    document.addEventListener("click", onScroll);                   /* a drop-down may have opened under the button */
    document.addEventListener("focusin", onScroll);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) onScroll(); });
    if ("MutationObserver" in window) { new MutationObserver(watchToasts).observe(document.body, { childList: true }); watchToasts(); }
    update();
  }, "chrome:top");

  /* ====================================================================================================
   * Scroll progress bar (idea #6) — a thin accent line at the very top that fills as you scroll.
   * ==================================================================================================== */
  Site.ready(function () {
    if (!feat("scrollProgress") || !document.body) return;
    var bar = el("div", { class: "ch-progress", "aria-hidden": "true" }, el("i"));
    document.body.appendChild(bar);
    var fill = bar.firstChild, raf = 0;
    function paint() {
      raf = 0;
      var d = document.documentElement, max = (d.scrollHeight - window.innerHeight);
      var p = max > 0 ? Math.min(1, Math.max(0, scrollY() / max)) : 0;
      fill.style.transform = "scaleX(" + p.toFixed(4) + ")";
      bar.classList.toggle("ch-progress--on", max > 40);
    }
    function onScroll() { if (!raf) raf = requestAnimationFrame(paint); }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    paint();
  }, "chrome:progress");

  /* ====================================================================================================
   * Share button (idea #70) — a tool-rail icon that uses the native share sheet, or copies the link.
   * ==================================================================================================== */
  Site.ready(function () {
    if (!feat("shareButton")) return;
    var tools = Site.tools(); if (!tools) return;
    var btn = el("button", { type: "button", class: "sx-iconbtn ch-share", style: { order: "5" }, "aria-label": "Share this page", title: "Share this page" }, svg(ICON.share));
    btn.addEventListener("click", function () {
      sfx("nav");
      var url = location.href, title = document.title || "Anders";
      if (navigator.share) { navigator.share({ title: title, url: url }).catch(function () {}); return; }
      if (Site.copy) Site.copy(url, "Link copied to clipboard");
    });
    tools.appendChild(btn);
  }, "chrome:share");

  /* ====================================================================================================
   * Site admin badge — a small pill at the bottom of every page while an admin session from /control/ is live.
   * It is drawn only after the server confirms the session. Green: password and authenticator. Amber: password only.
   * ==================================================================================================== */
  Site.ready(function () {
    if (Site.page === "control" || !Site.admin || !Site.admin.get()) return;
    var pill = null;
    function draw(info) {
      if (pill) { pill.remove(); pill = null; }
      if (!info) return;
      pill = el("a", { class: "ch-admin", href: "/control/", "data-level": info.twofa ? "full" : "pass", title: "Open the control panel",
        "aria-label": "You are signed in as site admin" + (info.twofa ? ", verified with password and authenticator" : ", password only") + ". Open the control panel." },
        el("i", { "aria-hidden": "true" }), el("span", { text: "Site Admin" }), el("b", { text: "Live" }));
      document.body.appendChild(pill);
    }
    Site.admin.check().then(function (r) { if (r && r.ok) draw(r); });
    Site.on("admin", function (a) { if (!a) draw(null); });
  }, "chrome:admin");

  /* ====================================================================================================
   * Navigation menu — a list button at the left end of the header on every page, with the main pages.
   * The private pages are deliberately not listed, and the résumé is left out at the owner's request (the footer's hire link leads there). features.navMenu = false removes it.
   * ==================================================================================================== */
  var PAGES = [
    ["hub", "/", "Home"], ["anyps", "/anyps/", "AnyPS"], ["anderscraft", "/anderscraft/", "AndersCraft"],
    ["games", "/games/", "Rate-O-Pedia"], ["forum", "/games/forum/", "Forums"],
    ["links", "/links/", "Links I Like"], ["stream", "/stream/", "Stream"],
    ["arcade", "/arcade/", "Arcade"], ["uses", "/uses/", "Uses"], ["changelog", "/changelog/", "What's New"]
  ];
  /* A radial "wheel" of the site's pages. The header button opens a centered overlay; the pages fan out from
     the middle on a ring, each an ordinary link (click or Enter to visit). Animated, colour-accented, and
     drivable by mouse, keyboard (Tab, or arrows to step around the ring) or a controller. The dim backdrop,
     Esc, or the centre button close it. Reduced motion keeps it, just without the fly-out. */
  var RAD_ACCENTS = ["#cd4257", "#3d8bff", "#ff7a1f", "#36d39a", "#c77dff", "#1ec5b3", "#f0c23a", "#ff6076", "#8c5aff", "#2fbf71"];
  Site.ready(function () {
    if (!feat("navMenu") || !nav) return;
    var here = Site.page, open = false, closing = 0;
    var path = location.pathname.replace(/index\.html$/, "");
    var exact = PAGES.some(function (p) { return p[1] === path; });

    var btn = el("button", { type: "button", class: "sx-iconbtn ch-menu", "aria-label": "Site menu", "aria-haspopup": "true", "aria-expanded": "false", "aria-controls": "ch-radial", title: "Site menu" },
      svg('<circle cx="12" cy="12" r="2.1"/><circle cx="12" cy="4.4" r="1.5"/><circle cx="19.6" cy="12" r="1.5"/><circle cx="12" cy="19.6" r="1.5"/><circle cx="4.4" cy="12" r="1.5"/>', { fill: "currentColor", stroke: "none" }));
    var box = el("div", { class: "ch-menu__box" }, btn);
    nav.insertBefore(box, nav.firstChild);

    /* overlay lives on <body> so position:fixed centres on the viewport, not a transformed ancestor */
    var wheel = el("div", { class: "ch-rad__wheel", role: "menu", "aria-label": "Site pages" });
    var center = el("button", { type: "button", class: "ch-rad__center", "aria-label": "Close menu", title: "Close" },
      svg('<path d="M6 6l12 12M18 6 6 18"/>'));
    wheel.appendChild(center);
    var N = PAGES.length, nodes = [];
    PAGES.forEach(function (p, i) {
      var cur = exact ? p[1] === path : p[0] === here;
      var ang = i * (360 / N);
      var a = el("a", { href: p[1], class: "ch-rad__node" + (cur ? " is-current" : ""), role: "menuitem",
        "aria-current": cur ? "page" : null, style: { "--a": ang + "deg", "--d": (i * 34) + "ms", "--ac": RAD_ACCENTS[i % RAD_ACCENTS.length] } },
        el("span", { class: "ch-rad__t", text: p[2] }));
      wheel.appendChild(a); nodes.push(a);
    });
    var scrim = el("div", { class: "ch-rad__scrim" });
    var overlay = el("div", { class: "ch-radial", id: "ch-radial", hidden: true }, scrim, wheel);
    (document.body || document.documentElement).appendChild(overlay);

    function focusables() { return [center].concat(nodes); }
    function set(on) {
      if (on === open) return;
      open = on; btn.setAttribute("aria-expanded", String(on));
      document.documentElement.classList.toggle("ch-radial-open", on);
      if (closing) { clearTimeout(closing); closing = 0; }
      if (on) {
        overlay.hidden = false;
        /* next frame so the fly-out transition runs from the collapsed state */
        requestAnimationFrame(function () { requestAnimationFrame(function () { overlay.classList.add("is-open"); }); });
        var cur = wheel.querySelector(".is-current") || nodes[0];
        setTimeout(function () { try { (cur || center).focus(); } catch (e) {} }, 40);
      } else {
        overlay.classList.remove("is-open");
        var ms = Site.reducedMotion ? 0 : 320;
        closing = setTimeout(function () { overlay.hidden = true; closing = 0; }, ms);
      }
    }
    btn.addEventListener("click", function () { set(!open); sfx(open ? "open" : "close"); });
    center.addEventListener("click", function () { set(false); sfx("close"); try { btn.focus(); } catch (e) {} });
    scrim.addEventListener("click", function () { set(false); sfx("close"); try { btn.focus(); } catch (e) {} });
    Site.on("ui:escape", function () { if (open) { set(false); try { btn.focus(); } catch (e) {} } });

    overlay.addEventListener("keydown", function (e) {
      if (!open) return;
      if (e.key === "Escape") { set(false); sfx("close"); try { btn.focus(); } catch (x) {} return; }
      /* arrows / step keys move focus around the ring */
      var step = 0;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") step = 1;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") step = -1;
      if (step && nodes.length) {
        e.preventDefault();
        var cur = nodes.indexOf(document.activeElement);
        if (cur < 0) cur = step > 0 ? -1 : 0;
        var next = (cur + step + nodes.length) % nodes.length;
        try { nodes[next].focus(); sfx("hover"); } catch (x) {}
        return;
      }
      if (e.key === "Tab") {   /* keep focus inside the wheel */
        var f = focusables(), first = f[0], last = f[f.length - 1], act = document.activeElement;
        if (e.shiftKey && act === first) { e.preventDefault(); try { last.focus(); } catch (x) {} }
        else if (!e.shiftKey && act === last) { e.preventDefault(); try { first.focus(); } catch (x) {} }
      }
    });
  }, "chrome:menu");

  /* ====================================================================================================
   * Site search — a small command palette. A header button or the "/" key opens it; type to jump to any
   * page, or hit the Rate-O-Pedia action to search the games there. Keyboard-first (arrows + Enter).
   * ==================================================================================================== */
  Site.ready(function () {
    if (!feat("search") || !nav) return;
    var dlg = null, input = null, listEl = null, results = [], sel = 0;

    function items() {
      var out = PAGES.map(function (p) { return { label: p[2], href: p[1], kind: "Page", key: (p[0] + " " + p[2]).toLowerCase() }; });
      out.push({ label: "Trophy Cabinet", href: "/trophies/", kind: "Page", key: "trophies trophy cabinet achievements" });
      out.push({ label: "Résumé", href: "/resume/", kind: "Page", key: "resume cv hire work with me" });
      if (Site.owner) out.push({ label: "Dashboard", href: "/dash/", kind: "Owner", key: "dashboard owner stats" });
      return out;
    }
    function score(it, q) {
      var l = it.label.toLowerCase();
      if (l === q) return 0;
      if (l.indexOf(q) === 0) return 1;
      if (it.key.indexOf(q) === 0 || (" " + it.key).indexOf(" " + q) >= 0) return 2;
      if (l.indexOf(q) >= 0 || it.key.indexOf(q) >= 0) return 3;
      return Infinity;
    }
    function compute(q) {
      q = (q || "").trim().toLowerCase();
      var out = [];
      var pool = items().map(function (it) { return { it: it, s: q ? score(it, q) : 4 }; })
        .filter(function (r) { return r.s !== Infinity; }).sort(function (a, b) { return a.s - b.s; });
      pool.forEach(function (r) { out.push(r.it); });
      /* always offer the Rate-O-Pedia search as the last option — the fallback when a page isn't what you want */
      if (q) out.push({ label: "Search Rate-O-Pedia for “" + q + "”", href: "/games/?q=" + encodeURIComponent(q), kind: "Search", rop: true });
      return out;
    }
    function draw() {
      results = compute(input.value); sel = 0; listEl.textContent = "";
      results.forEach(function (it, i) {
        var a = el("a", { href: it.href, class: "ch-srch__item" + (i === 0 ? " is-sel" : "") + (it.rop ? " ch-srch__item--rop" : ""), role: "option", "aria-selected": i === 0 ? "true" : "false" },
          el("span", { class: "ch-srch__label", text: it.label }),
          el("span", { class: "ch-srch__kind", text: it.kind }));
        a.addEventListener("mousemove", function () { move(i); });
        listEl.appendChild(a);
      });
      if (!results.length) listEl.appendChild(el("p", { class: "ch-srch__empty", text: "No pages match. Try the Rate-O-Pedia search." }));
    }
    function move(i) {
      if (!results.length) return;
      i = (i + results.length) % results.length; if (i === sel) return;
      var nodes = listEl.querySelectorAll(".ch-srch__item");
      if (nodes[sel]) { nodes[sel].classList.remove("is-sel"); nodes[sel].setAttribute("aria-selected", "false"); }
      sel = i;
      if (nodes[sel]) { nodes[sel].classList.add("is-sel"); nodes[sel].setAttribute("aria-selected", "true"); try { nodes[sel].scrollIntoView({ block: "nearest" }); } catch (e) {} }
    }
    function build() {
      if (dlg) return dlg;
      input = el("input", { type: "search", class: "ch-srch__input", placeholder: "Search pages, or jump to Rate-O-Pedia…", "aria-label": "Search", autocomplete: "off", spellcheck: "false" });
      listEl = el("ul", { class: "ch-srch__list", role: "listbox", "aria-label": "Results" });
      var body = el("div", { class: "ch-srch" }, input, listEl);
      dlg = Site.modal({ id: "ch-search", title: "Search", className: "ch-srch__modal", body: body });
      input.addEventListener("input", draw);
      input.addEventListener("keydown", function (e) {
        if (e.key === "ArrowDown") { e.preventDefault(); move(sel + 1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); move(sel - 1); }
        else if (e.key === "Enter") { var node = listEl.querySelectorAll(".ch-srch__item")[sel]; if (node) { e.preventDefault(); sfx("nav"); node.click(); } }
      });
      dlg.addEventListener("close", function () { dlg.remove(); dlg = null; });
      return dlg;
    }
    function openSearch() {
      build(); input.value = ""; draw(); Site.dialog.open(dlg);
      setTimeout(function () { try { input.focus(); } catch (e) {} }, 30);
    }

    var btn = el("button", { type: "button", class: "sx-iconbtn ch-search", style: { order: "15" }, "aria-label": "Search", title: "Search ( / )" },
      svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'));
    btn.addEventListener("click", function () { sfx("open"); openSearch(); });
    var toolbar = Site.tools(); if (toolbar) toolbar.appendChild(btn);

    document.addEventListener("keydown", function (e) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (dlg && dlg.open) return;
      e.preventDefault(); sfx("open"); openSearch();
    });
  }, "chrome:search");

  /* ====================================================================================================
   * Footer stamp (ideas #79 + #75) — "Last updated <date>" from the repo's latest commit, plus a
   * quiet "Star on GitHub" link. Degrades to just the star link if the commit date can't be fetched.
   * ==================================================================================================== */
  Site.ready(function () {
    if (!feat("lastUpdated")) return;
    var foot = document.querySelector("footer"); if (!foot) return;
    var repo = "damananders/damananders.github.io";
    var stamp = el("p", { class: "ch-stamp" });
    var star = el("a", { class: "ch-stamp__star", href: "https://github.com/" + repo, target: "_blank", rel: "noopener" }, svg(ICON.star, { width: 14, height: 14 }), "Star on GitHub");
    var here = Site.page, links = el("p", { class: "ch-links" });
    [["links", "/links/", "Links I Like"], ["changelog", "/changelog/", "What's New"], ["uses", "/uses/", "Uses"], ["stream", "/stream/", "Stream"], ["dash", "/dash/", "Dashboard"]].forEach(function (l) {
      if (l[0] === here || (l[0] === "dash" && !Site.owner)) return;
      if (links.firstChild) links.appendChild(document.createTextNode("  ·  "));
      links.appendChild(el("a", { href: l[1], text: l[2] }));
    });
    if (links.firstChild && feat("footerLinks")) foot.appendChild(links);

    /* other channels (site-config channels): one small badge per link that is filled in */
    var ch = (Site.config && Site.config.channels) || {}, NAMES = { youtube: "YouTube", tiktok: "TikTok", x: "X", instagram: "Instagram", bluesky: "Bluesky" };
    var badges = el("p", { class: "ch-channels" });
    Object.keys(NAMES).forEach(function (k) {
      var u = String(ch[k] || ""); if (!/^https:\/\//.test(u)) return;
      badges.appendChild(el("a", { class: "ch-channel ch-channel--" + k, href: u, target: "_blank", rel: "noopener me", text: NAMES[k] }));
    });
    if (badges.firstChild && feat("channelBadges")) foot.appendChild(badges);

    /* retro visitor counter: counts once per browser session, hides itself if the counter does not answer */
    var cc = (Site.config && Site.config.counter) || {};
    if (feat("visitorCounter") && cc.provider === "abacus" && /^[\w-]{3,64}$/.test(cc.namespace || "") && /^[\w-]{1,64}$/.test(cc.key || "")) {
      var counted = false; try { counted = sessionStorage.getItem("ch.counted") === "1"; } catch (e) {}
      var base = "https://abacus.jasoncameron.dev/" + (counted || Site.owner ? "get" : "hit") + "/" + cc.namespace + "/" + cc.key;
      Site.fetchJSON(base, { timeout: 5000 }).then(function (j) {
        var n = j && typeof j.value === "number" ? j.value : null; if (n == null) return;
        try { sessionStorage.setItem("ch.counted", "1"); } catch (e) {}
        var digits = String(Math.max(0, Math.floor(n))); while (digits.length < 6) digits = "0" + digits;
        var box = el("p", { class: "ch-counter", "aria-label": "Total visitors: " + n });
        box.appendChild(el("span", { class: "ch-counter__label", "aria-hidden": "true", text: "Total Visitors" }));
        var reel = el("span", { class: "ch-counter__reel", "aria-hidden": "true" });
        digits.split("").forEach(function (d) { reel.appendChild(el("i", { text: d })); });
        box.appendChild(reel); foot.insertBefore(box, stamp);
      }).catch(function () {});
    }
    foot.appendChild(stamp);
    function render(dateStr) {
      stamp.textContent = "";
      if (dateStr) stamp.appendChild(el("span", { class: "ch-stamp__when", text: "Last updated " + dateStr }));
      if (dateStr) stamp.appendChild(document.createTextNode("  ·  "));
      stamp.appendChild(star);
    }
    render("");
    if (Site.fetchJSON) Site.fetchJSON("https://api.github.com/repos/" + repo + "/commits?per_page=1", { ttl: 3600, timeout: 6000 }).then(function (j) {
      try {
        var iso = j && j[0] && j[0].commit && (j[0].commit.author || j[0].commit.committer || {}).date;
        if (iso) render(Site.fmtDate ? Site.fmtDate(iso.slice(0, 10)) : iso.slice(0, 10));
      } catch (e) {}
    }).catch(function () {});
  }, "chrome:stamp");
})();
