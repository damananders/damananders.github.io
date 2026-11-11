/* pages/hub.js: the hub page's own content upgrades (prefix hb-). See assets/README.md.
 * Vault card visibility, live status chips, AnyPS "New" badge, keyboard navigation between the cards,
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
  /* Is the Personal Vault card shown to this visitor? */
  function vaultShown() { return !(cfg.vault && cfg.vault.hideOnHub === true) || Site.owner; }

  /* ====================================================================================================
   * Item 39: the Vault card. CSS hides it unless <html data-owner>; this only handles hideOnHub:false
   * and the owner-only wording of the hero lead (the public copy never mentions the vault).
   * ==================================================================================================== */
  Site.ready(function () {
    if (!(cfg.vault && cfg.vault.hideOnHub === true)) root.classList.add("hb-vault-on");
    if (!vaultShown()) return;
    var lead = byId("hb-lead");
    if (lead) lead.textContent = "A WoW server to join, a launcher to download, and my personal vault. Pick one to learn more.";
  }, "hub vault card");

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
  var TAGS = { site: "Site", anyps: "AnyPS", anderscraft: "AndersCraft", vault: "Vault" };
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
})();
