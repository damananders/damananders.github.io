/* resume.js — behaviour for /resume/ : count-up stats, expandable project cards, live chips, config links. */
(function () {
  if (!window.Site || Site.page !== "resume") return;
  var cfg = (Site.config && Site.config.resume) || {};

  /* ---- config-driven links ---- */
  Site.ready(function () {
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

  /* ---- typewriter role line: types, holds, erases, next. Static under reduced motion. ---- */
  Site.ready(function () {
    var role = document.querySelector(".rz-role");
    if (!role || Site.reducedMotion || (Site.config.features || {}).typing === false) return;
    var full = role.textContent, lines = [full, "Builds private game servers for fun", "Takes software apart to see how it works",
      "Fortnite island creator (UEFN + Verse)", "Streams it all on Twitch", "90+ five-star customer reviews"];
    role.setAttribute("aria-label", full);
    var txt = Site.el("span", { "aria-hidden": "true", text: full }), caret = Site.el("span", { class: "rz-caret", "aria-hidden": "true" });
    role.textContent = ""; role.appendChild(txt); role.appendChild(caret);
    var li = 0, pos = full.length, dir = -1;
    function tick() {
      if (document.hidden) { setTimeout(tick, 800); return; }
      var cur = lines[li];
      if (dir < 0) {
        if (pos > 0) { pos--; txt.textContent = cur.slice(0, pos); setTimeout(tick, 22); }
        else { li = (li + 1) % lines.length; dir = 1; setTimeout(tick, 260); }
      } else {
        if (pos < cur.length) { pos++; txt.textContent = cur.slice(0, pos); setTimeout(tick, 42); }
        else { dir = -1; setTimeout(tick, li === 0 ? 5200 : 2600); }
      }
    }
    setTimeout(tick, 4200);
  }, "resume typewriter");

  /* ---- skill filter: pick a skill, matching roles / projects / skill groups light up, the rest dim ---- */
  Site.ready(function () {
    var bar = document.getElementById("rz-filter"), out = document.getElementById("rz-filter-out"); if (!bar) return;
    var items = Array.prototype.slice.call(document.querySelectorAll("[data-skills]")), now = "";
    function apply(skill, label) {
      now = skill; var jobs = 0, projects = 0;
      items.forEach(function (n) {
        var hit = !!skill && (" " + n.getAttribute("data-skills") + " ").indexOf(" " + skill + " ") >= 0;
        n.classList.toggle("is-hit", hit); n.classList.toggle("is-dim", !!skill && !hit);
        if (hit && n.classList.contains("rz-job")) jobs++;
        if (n.classList.contains("rz-card")) {
          if (hit) projects++;
          var head = n.querySelector(".rz-card__head");
          if (skill && head) { n.classList.toggle("is-open", hit); head.setAttribute("aria-expanded", hit ? "true" : "false"); }
        }
      });
      Array.prototype.forEach.call(bar.children, function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-skill") === skill)); });
      if (out) out.textContent = skill ? label + ": " + jobs + (jobs === 1 ? " role" : " roles") + " and " + projects + (projects === 1 ? " project" : " projects") + ". Tap it again to clear." : "";
    }
    bar.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest(".rz-fchip"); if (!b) return;
      var k = b.getAttribute("data-skill");
      apply(k === now ? "" : k, b.textContent); if (Site.sfx) Site.sfx("toggle");
    });
  }, "resume skill filter");

  /* ---- recruiter mode: a plain, tight, one-column version with everything expanded. Remembered; ?recruiter turns it on. ---- */
  Site.ready(function () {
    var btn = document.getElementById("rz-plain"); if (!btn) return;
    var root = document.documentElement;
    function set(on, quiet) {
      root.classList.toggle("rz-plain", on);
      btn.setAttribute("aria-pressed", String(on)); btn.textContent = on ? "Back to the full version" : "Recruiter mode";
      Array.prototype.forEach.call(document.querySelectorAll(".rz-card"), function (c) {
        var h = c.querySelector(".rz-card__head"); c.classList.toggle("is-open", on); if (h) h.setAttribute("aria-expanded", String(on));
      });
      if (on) Array.prototype.forEach.call(document.querySelectorAll("[data-reveal]"), function (n) { n.classList.add("is-in"); });
      if (!quiet) { Site.store.set("recruiter", on); if (Site.sfx) Site.sfx("toggle"); window.scrollTo(0, 0); }
    }
    var q = /[?&]recruiter(=([^&#]*))?/.exec(location.search), start = Site.store.get("recruiter", false) === true;
    if (q) start = !/^(0|off|false|no)$/i.test(q[2] || "");
    if (start) set(true, true);
    btn.addEventListener("click", function () { set(!root.classList.contains("rz-plain")); });
  }, "resume recruiter mode");
})();
