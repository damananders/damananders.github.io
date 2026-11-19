/* pages/hub.js: the hub page's own content upgrades (prefix hb-). See assets/README.md.
 * The owner-only Vault card, live status chips, AnyPS "New" badge, keyboard navigation between the cards,
 * the latest-update ticker, the "Now" card and the lazy AnyPS preview video.
 * Each part runs inside Site.ready so one failure cannot stop the others; the page works without this file.
 */
(function () {
  "use strict";
  if (!window.Site) return;
  var Site = window.Site, doc = document, root = doc.documentElement, el = Site.el;
  var cfg = Site.config || {}, legacy = Site.legacy || {};

  function feat(name) { var f = cfg.features || {}; return f[name] !== false; }
  function byId(id) { return doc.getElementById(id); }
  function safe(fn) { return function (v) { try { return fn(v); } catch (e) { console.error("[site] hub", e); } }; }
  /* Only same-site paths and https links are ever turned into hrefs. */
  function safeUrl(u) { return (typeof u === "string" && (/^\/(?!\/)/.test(u) || /^https:\/\//i.test(u))) ? u : ""; }
  function isVisible(n) { return !!(n && n.getClientRects().length); }
  /* Is the Personal Vault card shown to this visitor? Fails closed: unless site-config.js loaded and says
     hideOnHub:false, only the owner's browser gets the card and anything that mentions the vault. */
  var vaultPublic = !!(cfg.vault && cfg.vault.hideOnHub === false);
  function vaultShown() { return vaultPublic || Site.owner; }

  /* The Personal Vault card was removed from the hub at the owner's request \u2014 the hub is AnyPS and
   * AndersCraft only. The vault page still exists at its own address; it simply has no card here.
   * vaultShown() is kept (above) so the news ticker still keeps any vault-tagged note off the public hub. */

  /* ====================================================================================================
   * Items 7 and 24: status chips inside each card's artwork.
   * ==================================================================================================== */
  function chip(text, state, title) {
    return el("span", { class: "sx-chip" + (state ? " " + state : ""), title: title || null },
      state && /is-(on|off|wait)/.test(state) ? el("i", { class: "sx-dot", "aria-hidden": "true" }) : null, text);
  }

  Site.ready(function () {
    var host = byId("hb-chips-craft"); if (!host) return;
    host.setAttribute("aria-live", "polite");
    var status = chip("Checking", "is-wait");
    host.appendChild(status);
    Site.live.signup().then(safe(function (state) {
      var up = state === "up";
      var next = chip(up ? "Sign-ups open" : "Sign-ups offline", up ? "is-on" : "is-off");
      host.replaceChild(next, status); status = next;
    }));
    Site.live.realms().then(safe(function (s) {
      if (!s || !Array.isArray(s.realms)) return;
      var total = 0, any = false;
      s.realms.forEach(function (r) { if (r && r.online !== false && typeof r.players === "number" && r.players >= 0) { total += r.players; any = true; } });
      if (!any) return;
      host.appendChild(chip(Site.fmtNum(total) + " online", "", total === 1 ? "1 player online right now" : Site.fmtNum(total) + " players online right now"));
    }));
  }, "hub chips: anderscraft");

  Site.ready(function () {
    var host = byId("hb-chips-anyps"), a = legacy.anyps; if (!host || !a || !a.version) return;
    var v = String(a.version), when = a.date ? Site.fmtDate(a.date) : "";
    var isNew = Site.store.get("anyps.seenVersion", null) !== v;
    var c = chip((isNew ? "New: V" : "V") + v, isNew ? "hb-chip--new" : "", when ? "Released " + when : null);
    host.appendChild(c);
  }, "hub chips: anyps");

  Site.ready(function () {
    var host = byId("hb-chips-vault"), list = legacy.vault && legacy.vault.list; if (!host || !Array.isArray(list)) return;
    var n = list.filter(function (g) { return g && g.title; }).length;
    host.appendChild(chip(n === 1 ? "1 item" : n + " items"));
  }, "hub chips: vault");

  /* ====================================================================================================
   * Item 6: keyboard navigation between the visible cards.
   * Left / Right always move. Up / Down move when the cards are stacked (phones, narrow windows) and are
   * left alone otherwise, so they keep scrolling the page. Home / End and 1 / 2 / 3 jump. Enter is native.
   * ==================================================================================================== */
  Site.ready(function () {
    function cards() { return Array.prototype.filter.call(doc.querySelectorAll(".avenues .avenue"), isVisible); }
    if (!cards().length) return;
    root.classList.add("hb-keys");
    function go(card) {
      if (!card) return;
      try { card.focus({ focusVisible: true }); } catch (e) { card.focus(); }
      Site.sfx("nav");
    }
    doc.addEventListener("keydown", function (e) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.isComposing) return;
      var t = e.target;
      if (t && t.nodeType === 1 && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;   /* typing */
      if (doc.querySelector("dialog[open]") || root.classList.contains("ch-open")) return;                         /* a dialog or the settings panel is open */
      var k = e.key, list = cards(); if (!list.length) return;
      var a = doc.activeElement, nothing = !a || a === doc.body || a === root, i = list.indexOf(a), target = null;

      if (k === "1" || k === "2" || k === "3") {
        if (!nothing && i < 0 && t && t.closest && t.closest('[role="slider"],[role="listbox"],[role="menu"],[role="tablist"],[role="radiogroup"]')) return;
        target = list[parseInt(k, 10) - 1];
        if (target) { e.preventDefault(); go(target); }
        return;
      }
      if (!nothing && i < 0) return;   /* focus is on something else: leave its keys alone */

      var stacked = list.length > 1 && list[1].getBoundingClientRect().top > list[0].getBoundingClientRect().top + 8;
      if (nothing) {
        if (k === "ArrowRight" || (k === "ArrowDown" && stacked)) target = list[0];
        else if (k === "ArrowLeft") target = list[list.length - 1];
      } else if (k === "ArrowRight" || (k === "ArrowDown" && stacked)) target = list[i + 1];
      else if (k === "ArrowLeft" || (k === "ArrowUp" && stacked)) target = list[i - 1];
      else if (k === "Home") target = list[0];
      else if (k === "End") target = list[list.length - 1];
      if (!target || target === a) return;   /* at an end: let the key do its normal job */
      e.preventDefault(); go(target);
    });
  }, "hub keyboard navigation");

  /* ====================================================================================================
   * Items 10 and 58: latest-update ticker and the "All updates" dialog.
   * ==================================================================================================== */
  var VAULT_WORDS = /personal vault|my vault|the vault/i;   /* not "save vault", which is an AnyPS feature */
  var TAGS = { site: "Site", anyps: "AnyPS", anderscraft: "AndersCraft", games: "Ratings", vault: "Vault" };
  function pill(tag) {
    var key = TAGS[tag] ? tag : "site";
    return el("span", { class: "hb-pill hb-pill--" + key }, el("i", { "aria-hidden": "true" }), TAGS[key]);
  }

  Site.ready(function () {
    var host = byId("hb-ticker"); if (!host) return;
    if (!feat("ticker")) { host.hidden = true; return; }
    Site.news().then(function (all) {
      try { build(Array.isArray(all) ? all : []); } catch (e) { host.hidden = true; console.error("[site] hub ticker failed", e); }
    });

    function build(all) {
      /* The public never reads about the vault while its card is hidden. */
      var pub = !vaultShown();
      all = all.filter(function (n) { return n && n.title && !(pub && (n.tag === "vault" || VAULT_WORDS.test(n.title))); });
      var items = all.filter(function (n) { return n.date; }).slice(0, 5);
      if (!items.length) { host.hidden = true; return; }

      var idx = 0, timer = 0, hover = false, inside = false, manual = false, modal = null;
      var stage = el("div", { class: "hb-tick__stage", "aria-live": "off", "aria-atomic": "true" });
      var links = items.map(function (n, i) {
        var url = safeUrl(n.url);
        var kids = [pill(n.tag), el("span", { class: "hb-tick__title", text: n.title }), el("time", { class: "hb-tick__date", datetime: String(n.date).slice(0, 10), text: Site.fmtDate(n.date) })];
        var a = url ? el("a", { class: "hb-tick__item", href: url }, kids) : el("span", { class: "hb-tick__item" }, kids);
        if (i === 0) a.classList.add("hb-is-on");
        stage.appendChild(a); return a;
      });
      var count = el("span", { class: "hb-tick__count", "aria-hidden": "true" });
      var prev = el("button", { type: "button", class: "hb-tick__btn", "aria-label": "Previous update", onclick: function () { step(-1, true); } }, Site.svg('<path d="m14.5 6-6 6 6 6"/>'));
      var next = el("button", { type: "button", class: "hb-tick__btn", "aria-label": "Next update", onclick: function () { step(1, true); } }, Site.svg('<path d="m9.5 6 6 6-6 6"/>'));
      var allBtn = el("button", { type: "button", class: "hb-tick__all", "aria-haspopup": "dialog", onclick: openAll }, "All updates");
      var ctl = el("div", { class: "hb-tick__ctl" }, items.length > 1 ? [prev, count, next] : null, allBtn);
      host.textContent = "";
      host.appendChild(el("span", { class: "hb-tick__label", "aria-hidden": "true", text: "Latest" }));
      host.appendChild(stage); host.appendChild(ctl);
      host.classList.add("hb-is-ready");
      show(0);

      function show(i) {
        idx = (i + items.length) % items.length;
        links.forEach(function (a, j) { a.classList.toggle("hb-is-on", j === idx); });
        count.textContent = (idx + 1) + " / " + items.length;
      }
      function step(d, byHand) {
        if (byHand) { manual = true; stage.setAttribute("aria-live", "polite"); Site.sfx("tap"); stop(); }
        show(idx + d);
      }
      /* Rotation: every 6 seconds, never under reduced motion, paused on hover, focus, a hidden tab or an open dialog,
         and stopped for good once the visitor uses the previous / next buttons. */
      function canRun() { return items.length > 1 && !manual && !hover && !inside && !doc.hidden && !Site.reducedMotion && !(modal && modal.open); }
      function stop() { if (timer) { clearTimeout(timer); timer = 0; } }
      function start() { stop(); if (canRun()) timer = setTimeout(function () { timer = 0; if (canRun()) { step(1); start(); } }, 6000); }
      host.addEventListener("pointerenter", function (e) { if (e.pointerType !== "touch") { hover = true; stop(); } });
      host.addEventListener("pointerleave", function () { hover = false; start(); });
      host.addEventListener("focusin", function () { inside = true; stop(); });
      host.addEventListener("focusout", function (e) { if (!host.contains(e.relatedTarget)) { inside = false; start(); } });
      doc.addEventListener("visibilitychange", start);
      Site.on("pref:motion", function () { if (Site.reducedMotion && !manual) show(0); start(); });
      start();

      function openAll() {
        if (!modal) {
          modal = Site.modal({ id: "hb-news", title: "All updates", body: newsList(all, pub) });
          modal.classList.add("hb-news");
          modal.addEventListener("close", function () { Site.sfx("close"); start(); });
        }
        stop();
        Site.dialog.open(modal);
      }
      Site.on("ui:escape", function () { if (modal && modal.open) { Site.dialog.close(modal); try { allBtn.focus(); } catch (e) {} } });
    }

    /* Every item, grouped by date (the core already sorted them newest first; undated ones come last under "Recently"). */
    function newsList(all, pub) {
      var wrap = el("div", { class: "hb-news__days" }), groups = [], map = {};
      all.forEach(function (n) {
        var key = n.date ? String(n.date).slice(0, 10) : "";
        if (!map[key]) { map[key] = { key: key, rows: [] }; groups.push(map[key]); }
        map[key].rows.push(n);
      });
      groups.forEach(function (g) {
        var ul = el("ul", { class: "hb-news__list" });
        g.rows.forEach(function (n) {
          var url = safeUrl(n.url), body = n.body && !(pub && VAULT_WORDS.test(n.body)) ? String(n.body) : "";
          ul.appendChild(el("li", { class: "hb-news__row" }, pill(n.tag),
            url ? el("a", { class: "hb-news__title", href: url, text: n.title }) : el("span", { class: "hb-news__title", text: n.title }),
            body ? el("p", { class: "hb-news__body", text: body }) : null));
        });
        wrap.appendChild(el("section", { class: "hb-news__day" },
          el("h3", { class: "hb-news__date" }, g.key ? el("time", { datetime: g.key, text: Site.fmtDate(g.key) }) : "Recently"), ul));
      });
      return wrap;
    }
  }, "hub ticker");

  /* ====================================================================================================
   * Item 54: the "Now" card.
   * ==================================================================================================== */
  Site.ready(function () {
    var host = byId("hb-now"); if (!host || !feat("nowCard")) return;
    var ICONS = {
      building: '<path d="m14.5 5.5 4 4"/><path d="M12.5 7.5 4 16v4h4l8.5-8.5"/><path d="m13 3 8 8-2.5 2.5-8-8z"/>',
      playing: '<circle cx="12" cy="12" r="9"/><path d="m10 8.5 5.5 3.5-5.5 3.5z"/>'
    };
    Site.data("now").then(safe(function (d) {
      if (!d) return;
      if (Array.isArray(d.slides) && d.slides.some(function (x) { return x && typeof x.title === "string" && x.title.trim(); })) return nowSlides(host, d);
      var grid = el("div", { class: "hb-now__grid" }), n = 0;
      [["building", "Now building"], ["playing", "Now playing"]].forEach(function (pair) {
        var e = d[pair[0]]; if (!e || typeof e.title !== "string" || !e.title.trim()) return;
        var url = safeUrl(e.url), title = e.title.trim();
        var heading = el("h3", { class: "hb-now__title" },
          url ? el("a", { class: "hb-now__link", href: url }, title, el("span", { class: "hb-now__arrow", "aria-hidden": "true", text: "→" })) : title);
        grid.appendChild(el("div", { class: "hb-now__item hb-now__item--" + pair[0] },
          el("span", { class: "hb-now__ico", "aria-hidden": "true" }, Site.svg(ICONS[pair[0]])),
          el("div", null, el("div", { class: "hb-now__kind", text: pair[1] }), heading,
            e.note && String(e.note).trim() ? el("p", { class: "hb-now__note", text: String(e.note).trim() }) : null)));
        n++;
      });
      if (!n) return;
      host.textContent = "";
      host.appendChild(el("div", { class: "hb-now__head" },
        el("h2", { class: "hb-now__h", text: "Now" }),
        d.updated ? el("span", { class: "hb-now__upd" }, "Updated ", el("time", { datetime: String(d.updated).slice(0, 10), text: Site.fmtDate(d.updated) })) : null));
      host.appendChild(grid);
      host.hidden = false;
    }));

    /* the banner version: one slide per project, pips underneath, cycles every 8s (pauses on hover/focus, off with reduced motion) */
    function nowSlides(host, d) {
      var ART = {
        anyps: '<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="nsA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a1a33"/><stop offset="1" stop-color="#03060d"/></linearGradient></defs><rect width="320" height="180" fill="url(#nsA)"/><g fill="none" stroke="#3d8bff" stroke-opacity=".35" stroke-width="1.2"><path d="M0 120h70l12-12h60l12 12h166M0 140h40l10 10h90l10-10h170M210 0v40l12 12v60"/></g><g transform="translate(196 52)"><rect width="76" height="76" rx="12" fill="#06101f" stroke="#3d8bff" stroke-width="2"/><path d="M14 0v-8M30 0v-8M46 0v-8M62 0v-8M14 76v8M30 76v8M46 76v8M62 76v8M0 14h-8M0 30h-8M0 46h-8M0 62h-8M76 14h8M76 30h8M76 46h8M76 62h8" stroke="#3d8bff" stroke-width="2.4" stroke-linecap="round"/><text x="38" y="46" text-anchor="middle" font-family="Space Grotesk,system-ui,sans-serif" font-weight="800" font-size="20" fill="#9fd3ff">PS2</text></g><circle cx="234" cy="90" r="70" fill="#3d8bff" opacity=".10"/></svg>',
        wizard: '<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" aria-hidden="true"><rect width="320" height="180" fill="#120a24"/><rect y="90" width="320" height="90" fill="#1b1036"/><g fill="#fff" opacity=".8"><rect x="30" y="20" width="2" height="2"/><rect x="90" y="44" width="2" height="2"/><rect x="150" y="14" width="2" height="2"/><rect x="300" y="30" width="2" height="2"/><rect x="120" y="70" width="2" height="2"/><rect x="60" y="64" width="1" height="1"/></g><circle cx="266" cy="30" r="14" fill="#f6e7b0" shape-rendering="auto"/><circle cx="273" cy="25" r="12" fill="#120a24" shape-rendering="auto"/><g fill="#0b2a1a"><rect x="0" y="132" width="320" height="48"/><rect x="10" y="112" width="18" height="22"/><rect x="40" y="104" width="22" height="30"/><rect x="290" y="108" width="22" height="26"/></g><g transform="translate(176 40)"><polygon points="32,0 4,52 60,52" fill="#3b2a6b"/><rect x="2" y="50" width="60" height="8" fill="#2a1e4d"/><rect x="10" y="58" width="44" height="40" fill="#4a3a7e"/><rect x="26" y="74" width="12" height="24" fill="#120a24"/><rect x="16" y="64" width="8" height="8" fill="#f5c542"/><rect x="40" y="64" width="8" height="8" fill="#f5c542"/></g><g transform="translate(118 108)"><polygon points="12,0 0,18 24,18" fill="#8f6bff"/><rect x="4" y="18" width="16" height="22" fill="#6b4fd8"/><rect x="8" y="20" width="8" height="6" fill="#f2d3b0"/><rect x="22" y="22" width="12" height="2" fill="#c9a24a"/><rect x="34" y="20" width="4" height="4" fill="#7ef0ff"/></g></svg>'
      };
      var slides = d.slides.filter(function (x) { return x && typeof x.title === "string" && x.title.trim(); });
      var cur = 0, timer = 0, paused = false;
      var reduce = function () { return document.documentElement.getAttribute("data-motion") === "reduce"; };
      var track = el("div", { class: "hb-ns__track", "aria-live": "polite" });
      var pips = el("div", { class: "hb-ns__pips", role: "tablist", "aria-label": "Projects" });
      slides.forEach(function (x, i) {
        var url = safeUrl(x.url), acc = /^#[0-9a-f]{6}$/i.test(x.accent || "") ? x.accent : "";
        var slide = el("article", { class: "hb-ns__slide" + (i ? "" : " is-on"), "aria-hidden": i ? "true" : "false", "aria-roledescription": "slide", "aria-label": (i + 1) + " of " + slides.length },
          el("div", { class: "hb-ns__art hb-ns__art--" + (ART[x.art] ? x.art : "none"), "aria-hidden": "true" }),
          el("div", { class: "hb-ns__body" },
            el("div", { class: "hb-ns__kind", text: String(x.kind || "Now building") }),
            el("h3", { class: "hb-ns__title", text: x.title.trim() }),
            x.note ? el("p", { class: "hb-ns__note", text: String(x.note).trim() }) : null,
            url ? el("a", { class: "hb-ns__cta", href: url, tabindex: i ? "-1" : "0" }, String(x.cta || "Take a look"), el("span", { class: "hb-ns__arr", "aria-hidden": "true", text: "→" })) : null));
        if (acc) slide.style.setProperty("--ns-c", acc);
        if (ART[x.art]) slide.querySelector(".hb-ns__art").innerHTML = ART[x.art];
        track.appendChild(slide);
        pips.appendChild(el("button", { class: "hb-ns__pip" + (i ? "" : " is-on"), type: "button", role: "tab", "aria-selected": i ? "false" : "true", "aria-label": "Show " + x.title.trim(),
          onclick: function () { go(i); restart(); } }, el("span", { class: "hb-ns__fill" })));
      });
      function go(i) {
        cur = (i + slides.length) % slides.length;
        Array.prototype.forEach.call(track.children, function (s, k) { var on = k === cur; s.classList.toggle("is-on", on); s.setAttribute("aria-hidden", on ? "false" : "true"); var a = s.querySelector(".hb-ns__cta"); if (a) a.setAttribute("tabindex", on ? "0" : "-1"); });
        Array.prototype.forEach.call(pips.children, function (p, k) { var on = k === cur; p.classList.toggle("is-on", on); p.setAttribute("aria-selected", on ? "true" : "false"); });
      }
      function restart() {
        clearInterval(timer); host.classList.remove("is-cycling");
        if (slides.length < 2 || reduce()) return;
        void host.offsetWidth; host.classList.add("is-cycling");
        timer = setInterval(function () { if (!paused && !document.hidden) { go(cur + 1); host.classList.remove("is-cycling"); void host.offsetWidth; host.classList.add("is-cycling"); } }, 8000);
      }
      host.addEventListener("mouseenter", function () { paused = true; host.classList.add("is-paused"); });
      host.addEventListener("mouseleave", function () { paused = false; host.classList.remove("is-paused"); });
      host.addEventListener("focusin", function () { paused = true; host.classList.add("is-paused"); });
      host.addEventListener("focusout", function () { paused = false; host.classList.remove("is-paused"); });
      host.textContent = "";
      host.classList.add("hb-ns");
      host.appendChild(el("div", { class: "hb-now__head" },
        el("h2", { class: "hb-now__h", text: "Now" }),
        d.updated ? el("span", { class: "hb-now__upd" }, "Updated ", el("time", { datetime: String(d.updated).slice(0, 10), text: Site.fmtDate(d.updated) })) : null));
      host.appendChild(track);
      if (slides.length > 1) host.appendChild(pips);
      host.hidden = false;
      restart();
    }
  }, "hub now card");

  /* ====================================================================================================
   * Item 56: the AnyPS card video. Nothing is downloaded until the card is near the viewport; it pauses
   * off screen and in a hidden tab, and stays a poster under reduced motion or data saver.
   * ==================================================================================================== */
  Site.ready(function () {
    var v = byId("hb-vid"); if (!v || !("IntersectionObserver" in window)) return;
    var src = v.getAttribute("data-hb-src"); if (!src) return;
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn && conn.saveData === true) return;
    var near = false;
    function sync() {
      var want = near && !doc.hidden && !Site.reducedMotion;
      if (!want) { if (!v.paused) v.pause(); return; }
      if (!v.getAttribute("src")) { v.muted = true; v.setAttribute("src", src); }
      if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    }
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { near = e.isIntersecting; });
      sync();
    }, { rootMargin: "200px 0px" }).observe(v);
    doc.addEventListener("visibilitychange", sync);
    Site.on("pref:motion", sync);
  }, "hub lazy video");

  /* ---- Hidden door: five quick clicks on the footer mark open a code box. The codes are stored as
     SHA-256 hashes, not as text. This is a convenience, not security: the pages behind it are
     protected by Drive's Restricted sharing, not by the code. ---- */
  Site.ready(function () {
    var btn = document.getElementById("hb-door"); if (!btn) return;
    var DOORS = { "fabd43b9d8c7ac6e8e88b9bfeb7479dc68b55540d41e5c0a3492011f9b240fed": "/q9w2z7r5/", "57548c4cdac3905a5f2e7ad5a00d2eb03f2204a28ac962664a94e64e3ceebd13": "/n6h3y8c4/" };
    var n = 0, timer = 0, dlg = null, input = null, msg = null, form = null;
    function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }
    function open() {
      if (!dlg) {
        input = Site.el("input", { id: "hb-code-in", type: "password", autocomplete: "off", autocapitalize: "off", spellcheck: "false", maxlength: "64" });
        msg = Site.el("p", { class: "hb-code__msg", role: "status", "aria-live": "polite" });
        form = Site.el("form", { class: "hb-code", novalidate: true }, Site.el("label", { for: "hb-code-in", text: "Enter code" }), input, msg);
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          var v = input.value.trim().toLowerCase(); if (!v) return;
          if (!(window.crypto && crypto.subtle && window.TextEncoder)) { msg.textContent = "This browser can't check codes."; return; }
          crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)).then(function (buf) {
            var to = DOORS[hex(buf)];
            if (to) { Site.sfx("success"); location.href = to; return; }
            /* not a door: maybe one of the secret words (assets/play.js). Those run on the page behind the box. */
            if (Site.secret && /^[a-z0-9 ]+$/.test(v) && Site.secret(v)) { input.value = ""; msg.textContent = ""; Site.dialog.close(dlg); return; }
            msg.textContent = Site.codeMiss ? Site.codeMiss() : "Nothing happens."; Site.sfx("error");
            form.classList.remove("hb-code--no"); void form.offsetWidth; form.classList.add("hb-code--no");
            input.select();
          }, function () { msg.textContent = "This browser can't check codes."; });
        });
        dlg = Site.modal({ id: "hb-code", title: "\u25B3 \u25CB \u2715 \u25A1", body: form });
      }
      input.value = ""; msg.textContent = ""; form.classList.remove("hb-code--no");
      Site.dialog.open(dlg); input.focus();
    }
    btn.addEventListener("click", function () {
      n++; clearTimeout(timer); timer = setTimeout(function () { n = 0; }, 2500);
      if (n >= 5) { n = 0; clearTimeout(timer); open(); }
    });
  }, "hidden door");
})();
