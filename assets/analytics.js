/* analytics.js: loads GoatCounter (privacy friendly, no cookies) only when a site code is set in
 * assets/site-config.js (analytics.goatcounter). With a blank code this file does nothing and requests nothing.
 * It also stays off on localhost / file:, on the private pages (vault, locker, control panel, dashboard), for visitors who send Do Not Track, and in owner view.
 * See assets/README.md.
 */
(function () {
  "use strict";
  if (!window.Site) return;
  var Site = window.Site;

  Site.ready(function () {
    var cfg = Site.config || {};
    if (cfg.features && cfg.features.analytics === false) return;
    var code = cfg.analytics && cfg.analytics.goatcounter;
    if (typeof code !== "string" || !/^[a-z0-9-]+$/i.test(code)) return;

    var host = location.hostname;
    if (location.protocol === "file:" || !host || host === "localhost" || host === "127.0.0.1" || host === "[::1]") return;
    if (Site.page === "vault" || Site.page === "locker" || Site.page === "control" || Site.page === "dash") return;
    var dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
    if (dnt === "1" || dnt === "yes") return;
    if (Site.owner) return;
    if (document.querySelector("script[data-goatcounter]")) return;

    var s = document.createElement("script");
    s.async = true;
    s.setAttribute("data-goatcounter", "https://" + code + ".goatcounter.com/count");
    s.src = "https://gc.zgo.at/count.js";
    (document.head || document.documentElement).appendChild(s);

    /* AnyPS download buttons, counted as events named with the version (for example "anyps-download-1.05.1"). */
    function version(is32) {
      var a = (Site.legacy && Site.legacy.anyps) || {};
      var v = String((is32 ? (a.version32 || a.version) : a.version) || "").replace(/[^\w.-]/g, "");
      return v || "unknown";
    }
    /* The version the visitor was actually offered: the page (and pages/anyps-plus.js, when a newer GitHub release
       takes over the buttons) writes it as "V1.06" on the main button and at the start of the 32-bit note. */
    function shown(t, is32) {
      var src = is32 ? document.getElementById("dl32meta") : t, text = "";
      if (src) text = is32 ? ((src.firstChild && src.firstChild.nodeType === 3 && src.firstChild.nodeValue) || "") : (src.textContent || "");
      var m = /(?:^|[\s(])V(\d+(?:\.\d+)*)(?![\w.])/.exec(text);
      return m ? m[1] : version(is32);
    }
    function count(e) {
      var t = e.target && e.target.closest ? e.target.closest("#dl, #dl32link") : null;
      if (!t || t.getAttribute("aria-disabled") === "true") return;
      if (e.type === "auxclick" && e.button !== 1) return;
      var gc = window.goatcounter;
      if (!gc || typeof gc.count !== "function") return;
      var is32 = t.id === "dl32link";
      try {
        gc.count({ path: "anyps-download-" + (is32 ? "32bit-" : "") + shown(t, is32), title: "AnyPS download" + (is32 ? " (32-bit)" : ""), event: true });
      } catch (err) {}
    }
    document.addEventListener("click", count, true);
    document.addEventListener("auxclick", count, true);
  }, "analytics");
})();
