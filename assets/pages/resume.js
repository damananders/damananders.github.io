/* resume.js — behaviour for /resume/ : count-up stats, expandable project cards, live chips, config links. */
(function () {
  if (!window.Site || Site.page !== "resume") return;
  var cfg = (Site.config && Site.config.resume) || {};

  /* ---- config-driven links ---- */
  Site.ready(function () {
    if (cfg.linkedin) { var a = document.querySelectorAll('a[href*="linkedin.com/in/anders"]'); for (var i = 0; i < a.length; i++) a[i].href = cfg.linkedin; }
    var pdf = document.getElementById("rz-pdf");
    if (pdf && cfg.pdfUrl) { pdf.href = cfg.pdfUrl; pdf.hidden = false; pdf.setAttribute("download", ""); }
  }, "resume links");

  /* ---- count-up on reveal ---- */
  Site.ready(function () {
    var nums = Array.prototype.slice.call(document.querySelectorAll("[data-count]"));
    if (!nums.length) return;
    function run(nEl) {
      var target = parseFloat(nEl.getAttribute("data-count")) || 0, suffix = nEl.getAttribute("data-suffix") || "";
      if (Site.reducedMotion || !window.requestAnimationFrame) { nEl.textContent = target + suffix; return; }
      var t0 = 0, dur = 1100;
      function step(t) {
        if (!t0) t0 = t;
        var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        nEl.textContent = Math.round(target * e) + suffix;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
    if (!("IntersectionObserver" in window)) { nums.forEach(run); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { run(en.target); io.unobserve(en.target); } });
    }, { threshold: 0.4 });
    nums.forEach(function (n) { io.observe(n); });
  }, "resume counters");

  /* ---- expandable project cards ---- */
  Site.ready(function () {
    var heads = document.querySelectorAll(".rz-card__head");
    for (var i = 0; i < heads.length; i++) {
      heads[i].addEventListener("click", function () {
        var card = this.closest(".rz-card"), open = card.classList.toggle("is-open");
        this.setAttribute("aria-expanded", open ? "true" : "false");
        if (Site.sfx) Site.sfx(open ? "open" : "toggle");
      });
    }
  }, "resume cards");

  /* ---- live chips (fail quietly to their neutral text) ---- */
  Site.ready(function () {
    var tw = document.getElementById("rz-twitch");
    if (tw && Site.live && Site.live.twitch) Site.live.twitch().then(function (s) {
      if (!s) return;
      if (s.live) { tw.classList.add("is-on"); tw.lastChild.textContent = "Live on Twitch"; }
      else { tw.lastChild.textContent = "Twitch"; }
    }).catch(function () {});
    var dc = document.getElementById("rz-discord");
    if (dc && Site.live && Site.live.discord) Site.live.discord().then(function (s) {
      if (s && s.members) dc.lastChild.textContent = Site.fmtNum(s.members) + " in Discord";
    }).catch(function () {});
  }, "resume chips");
})();
