/* a11y.js — comfort and access options, loaded on every page by assets/interact.js (prefix ax-).
 *
 *   Text size        Normal / Large / Larger                       pref "textSize"
 *   High contrast    stronger text, lines and focus rings          pref "contrast"
 *   Reading font     OpenDyslexic in place of the site fonts       pref "readFont"   (font loads only when switched on)
 *   Lite mode        no background photo, video or particles; follows the device's data-saver setting until changed   pref "lite"
 *   Announcements    Site.announce(text) speaks through a polite live region; live status chips use it
 *   Keyboard map     press ? anywhere for the list; the ratings page gains / (search), J and K (move), Enter (reviews)
 *
 * features.a11y = false turns the whole file off.
 */
(function () {
  "use strict";
  if (!window.Site || window.__axLoaded) return;
  window.__axLoaded = true;
  var Site = window.Site, el = Site.el, doc = document, root = doc.documentElement;
  if (((Site.config && Site.config.features) || {}).a11y === false) return;
  function get(k, d) { return Site.store.get(k, d); }

  /* ---------- apply stored choices ---------- */
  function deviceLite() {
    try { if (navigator.connection && navigator.connection.saveData) return true; } catch (e) {}
    try { return matchMedia("(prefers-reduced-data: reduce)").matches; } catch (e) { return false; }
  }
  function liteOn() { var v = get("lite", null); return v === true || (v !== false && deviceLite()); }
  function apply() {
    var size = get("textSize", "normal");
    if (size === "large" || size === "larger") root.setAttribute("data-text", size); else root.removeAttribute("data-text");
    if (get("contrast", false) === true) root.setAttribute("data-contrast", "more"); else root.removeAttribute("data-contrast");
    if (get("readFont", false) === true) root.setAttribute("data-font", "dyslexic"); else root.removeAttribute("data-font");
    if (liteOn()) {
      root.setAttribute("data-lite", "");
      Array.prototype.forEach.call(doc.querySelectorAll("video"), function (v) { try { v.removeAttribute("autoplay"); v.preload = "none"; v.pause(); } catch (e) {} });
    } else root.removeAttribute("data-lite");
  }
  apply();

  /* ---------- announcements ---------- */
  var live = null, lastSaid = "";
  function announce(text) {
    text = String(text || "").trim(); if (!text || !doc.body) return;
    if (!live) { live = el("div", { class: "sx-sr ax-live", role: "status", "aria-live": "polite", "aria-atomic": "true" }); doc.body.appendChild(live); }
    if (text === lastSaid) return; lastSaid = text;
    live.textContent = ""; setTimeout(function () { live.textContent = text; }, 60);
  }
  Site.announce = announce;

  Site.ready(function () {
    /* settings rows */
    Site.settings.register({ id: "textSize", label: "Text size", type: "choice", pref: "textSize", order: 12,
      choices: [{ value: "normal", label: "Normal" }, { value: "large", label: "Large" }, { value: "larger", label: "Larger" }],
      get: function () { return get("textSize", "normal"); }, set: function (v) { Site.setPref("textSize", v); } });
    Site.settings.register({ id: "contrast", label: "High contrast", hint: "Stronger text, lines and focus rings.", type: "toggle", pref: "contrast", order: 13,
      get: function () { return get("contrast", false) === true; }, set: function (v) { Site.setPref("contrast", !!v); } });
    Site.settings.register({ id: "readFont", label: "Dyslexia-friendly font", hint: "Switches the site to OpenDyslexic.", type: "toggle", pref: "readFont", order: 14,
      get: function () { return get("readFont", false) === true; }, set: function (v) { Site.setPref("readFont", !!v); } });
    Site.settings.register({ id: "lite", label: "Lite mode", type: "toggle", pref: "lite", order: 26,
      hint: function () { return deviceLite() && get("lite", null) === null ? "On, because your device is saving data." : "No background photo, video or particles. Easier on slow or metered connections."; },
      get: liteOn, set: function (v) { Site.setPref("lite", !!v); } });
    ["textSize", "contrast", "readFont", "lite"].forEach(function (k) { Site.on("pref:" + k, apply); });
    Site.on("pref:lite", function () { Site.emit("pref:season", get("season", "auto")); });

    /* live status chips: say it when their text changes after the first paint */
    if ("MutationObserver" in window) {
      var armed = false, t = 0; setTimeout(function () { armed = true; }, 4000);
      new MutationObserver(function (list) {
        if (!armed) return;
        for (var i = 0; i < list.length; i++) {
          var n = list[i].target; n = n.nodeType === 3 ? n.parentNode : n;
          var chip = n && n.closest ? n.closest(".sx-chip,.sl-badge") : null;
          if (chip && !chip.closest("[aria-live]")) { clearTimeout(t); t = setTimeout((function (c) { return function () { announce(c.textContent); }; })(chip), 400); break; }
        }
      }).observe(doc.body, { subtree: true, childList: true, characterData: true });
    }
  }, "a11y settings");

  /* ---------- keyboard map ---------- */
  Site.ready(function () {
    var COMMON = [["?", "Show this list"], ["Tab", "Move to the next link or button"], ["Esc", "Close a box, or stop a secret effect"], ["Start (controller)", "Open settings"]];
    var BY_PAGE = {
      hub: [["Arrow keys", "Move between the avenues"], ["Enter", "Open the highlighted avenue"]],
      games: [["/", "Jump to the search box"], ["J or ↓", "Next game"], ["K or ↑", "Previous game"], ["Enter", "Open or close that game's reviews"], ["Esc", "Leave the search box"]],
      resume: [["Enter or Space", "Open or close a project card"]],
      "404": [["← → or A D", "Steer the boat"]]
    };
    function row(k, d) { return el("li", { class: "ax-key" }, el("kbd", { text: k }), el("span", { text: d })); }
    function openMap() {
      if (doc.getElementById("ax-keys")) return;
      var ul = el("ul", { class: "ax-keys" });
      (BY_PAGE[Site.page] || []).concat(COMMON).forEach(function (r) { ul.appendChild(row(r[0], r[1])); });
      var d = Site.modal({ id: "ax-keys", title: "Keyboard shortcuts", body: ul });
      d.addEventListener("close", function () { d.remove(); });
      Site.dialog.open(d);
    }
    Site.keys = openMap;
    function typing(t) { return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); }
    doc.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target;
      if (Site.page === "games") {
        var q = doc.getElementById("gm-q");
        if (e.key === "Escape" && t === q) { q.blur(); return; }
        if (typing(t)) return;
        if (e.key === "/" && q) { e.preventDefault(); q.focus(); q.select(); return; }
        var down = e.key === "j" || e.key === "J" || e.key === "ArrowDown", up = e.key === "k" || e.key === "K" || e.key === "ArrowUp";
        if (down || up) {
          var cards = Array.prototype.slice.call(doc.querySelectorAll("#gm-list .gm-card")); if (!cards.length) return;
          var cur = t && t.closest ? cards.indexOf(t.closest(".gm-card")) : -1;
          var next = cards[Math.max(0, Math.min(cards.length - 1, cur + (down ? 1 : -1)))];
          if (cur < 0) next = cards[0];
          if (!next.hasAttribute("tabindex")) next.setAttribute("tabindex", "-1");
          e.preventDefault(); next.focus(); next.scrollIntoView({ block: "nearest", behavior: Site.reducedMotion ? "auto" : "smooth" });
          return;
        }
        if (e.key === "Enter" && t && t.classList && t.classList.contains("gm-card")) { var tg = t.querySelector(".gm-toggle"); if (tg) { e.preventDefault(); tg.click(); } return; }
      }
      if (typing(t)) return;
      if (e.key === "?") { e.preventDefault(); openMap(); }
    });
  }, "a11y keys");
})();
