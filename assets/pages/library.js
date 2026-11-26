/* pages/library.js — /projects/ (the Project Library): live chips on the AndersCraft and AnyPS cards and the
 * lazy AnyPS preview video. Same behaviour as the hub had before the landing rework (see hub.js); prefix lb-.
 * The page works without this file. */
(function () {
  "use strict";
  if (!window.Site) return;
  var Site = window.Site, doc = document, el = Site.el, legacy = Site.legacy || {};
  function byId(id) { return doc.getElementById(id); }
  function safe(fn) { return function (v) { try { return fn(v); } catch (e) { console.error("[site] library", e); } }; }
  function chip(text, state, title) {
    return el("span", { class: "sx-chip" + (state ? " " + state : ""), title: title || null },
      state && /is-(on|off|wait)/.test(state) ? el("i", { class: "sx-dot", "aria-hidden": "true" }) : null, text);
  }

  Site.ready(function () {
    var host = byId("lb-chips-craft"); if (!host || !Site.live) return;
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
  }, "library chips: anderscraft");

  Site.ready(function () {
    var host = byId("lb-chips-anyps"), a = legacy.anyps; if (!host || !a || !a.version) return;
    var v = String(a.version), when = a.date ? Site.fmtDate(a.date) : "";
    var isNew = Site.store.get("anyps.seenVersion", null) !== v;
    host.appendChild(chip((isNew ? "New: V" : "V") + v, isNew ? "hb-chip--new" : "", when ? "Released " + when : null));
  }, "library chips: anyps");

  /* AnyPS preview: nothing downloads until the card is near the viewport; pauses off screen and in a hidden tab,
     and stays a poster under reduced motion or data saver. */
  Site.ready(function () {
    var v = byId("lb-vid"); if (!v || !("IntersectionObserver" in window)) return;
    var src = v.getAttribute("data-src"); if (!src) return;
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn && conn.saveData === true) return;
    var near = false;
    function sync() {
      var want = near && !doc.hidden && !Site.reducedMotion;
      if (!want) { if (!v.paused) v.pause(); return; }
      if (!v.getAttribute("src")) { v.muted = true; v.setAttribute("src", src); }
      if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    }
    new IntersectionObserver(function (es) { es.forEach(function (e) { near = e.isIntersecting; }); sync(); }, { rootMargin: "200px 0px" }).observe(v);
    doc.addEventListener("visibilitychange", sync);
    Site.on("pref:motion", sync);
  }, "library lazy video");
})();
