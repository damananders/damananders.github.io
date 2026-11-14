/* Hub: a one-time first-visit tour. Spotlights a few landmarks (the avenues, the radial menu, search,
 * Rate-O-Pedia, the trophy cup) with a little tooltip card and Next / Skip. Shows once per browser
 * (localStorage "hub.tour"); add ?sx=tour:show to replay it. Hub only, and it waits for the async header
 * buttons to mount, skipping any step whose target isn't there. Self-contained: injects its own CSS. Prefix ht-.
 */
(function () {
  "use strict";
  if (!window.Site || window.Site.page !== "hub") return;
  var Site = window.Site, el = Site.el, doc = document;
  function feat(n) { var f = (Site.config && Site.config.features) || {}; return f[n] !== false; }
  if (!feat("tour")) return;

  var force = false; try { force = !!(Site.debug && Site.debug("tour")); } catch (e) {}
  var done = false; try { done = localStorage.getItem("hub.tour") === "1"; } catch (e) {}
  if (done && !force) return;

  var STEPS = [
    { sel: "main.avenues", title: "Two ways in", text: "A private WoW server to join, and a PlayStation launcher to download. Pick a card to dive in.", place: "below" },
    { sel: ".ch-menu", title: "The page wheel", text: "This opens a radial menu of every page — click any spoke to go there.", place: "below" },
    { sel: ".ch-search", title: "Or just search", text: "Hit this (or press the “/” key) to search and jump straight to a page or a game.", place: "below" },
    { sel: "a.hb-rate", title: "Rate-O-Pedia", text: "Score games from every platform, write reviews, and chat in the forums.", place: "above" },
    { sel: ".pl-cup", title: "Collect trophies", text: "You earn little trophies just by exploring the site. Keep an eye on this cup. Have fun!", place: "below" }
  ];

  var CSS =
    ".ht-ov{position:fixed;inset:0;z-index:2147482200}" +
    ".ht-hole{position:fixed;border-radius:14px;box-shadow:0 0 0 9999px rgba(6,8,13,.74);pointer-events:none;" +
      "outline:2px solid var(--sx-accent,#cd4257);outline-offset:3px;transition:all .32s cubic-bezier(.3,.8,.3,1)}" +
    ":root[data-motion=reduce] .ht-hole{transition:none}" +
    ".ht-card{position:fixed;width:min(320px,calc(100vw - 24px));z-index:1;background:var(--sx-surface,#12161c);color:var(--sx-text,#e8e8ea);" +
      "border:1px solid var(--sx-line-2,rgba(255,255,255,.18));border-radius:16px;padding:16px 18px;box-shadow:0 24px 60px -20px rgba(0,0,0,.75);" +
      "opacity:0;transform:translateY(6px);transition:opacity .25s,transform .25s}" +
    ".ht-card.is-in{opacity:1;transform:none}" +
    ":root[data-motion=reduce] .ht-card{transition:opacity .2s}" +
    ".ht-x{position:absolute;top:9px;right:9px;width:30px;height:30px;display:grid;place-items:center;border-radius:9px;cursor:pointer;" +
      "border:0;background:none;color:var(--sx-muted,#a8abb3);font-size:1.3rem;line-height:1;padding:0}" +
    ".ht-x:hover{background:var(--sx-surface-2,rgba(255,255,255,.08));color:var(--sx-text,#e8e8ea)}" +
    ".ht-x:focus-visible{outline:2px solid var(--sx-accent,#cd4257);outline-offset:2px}" +
    ".ht-card__k{font:600 .66rem var(--sx-mono,ui-monospace,monospace);letter-spacing:.12em;text-transform:uppercase;color:var(--sx-muted,#a8abb3)}" +
    ".ht-card__h{padding-right:26px}" +
    ".ht-hint{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:1;font:600 .78rem var(--sx-display,system-ui);" +
      "color:var(--sx-muted,#cfd3da);background:var(--sx-surface,#12161c);border:1px solid var(--sx-line-2,rgba(255,255,255,.18));" +
      "border-radius:999px;padding:7px 14px;box-shadow:0 10px 30px -12px rgba(0,0,0,.7);pointer-events:none;opacity:.92}" +
    ".ht-card__h{margin:3px 0 6px;font:700 1.12rem var(--sx-display,system-ui);color:var(--sx-text,#e8e8ea)}" +
    ".ht-card__t{margin:0;font-size:.94rem;line-height:1.5;color:var(--sx-text,#dfe2e7)}" +
    ".ht-card__row{display:flex;align-items:center;gap:10px;margin-top:14px}" +
    ".ht-dots{display:flex;gap:5px;margin-right:auto}" +
    ".ht-dot{width:7px;height:7px;border-radius:50%;background:var(--sx-line-2,rgba(255,255,255,.25))}" +
    ".ht-dot.is-on{background:var(--sx-accent,#cd4257)}" +
    ".ht-skip{background:none;border:0;color:var(--sx-muted,#a8abb3);font:600 .86rem var(--sx-display,system-ui);cursor:pointer;padding:6px 4px}" +
    ".ht-skip:hover{color:var(--sx-text,#e8e8ea)}" +
    ".ht-next{cursor:pointer;border:0;border-radius:10px;padding:8px 16px;font:700 .9rem var(--sx-display,system-ui);" +
      "background:var(--sx-accent,#cd4257);color:var(--sx-on-accent,#fff)}" +
    ".ht-next:hover{filter:brightness(1.08)}" +
    ".ht-skip:focus-visible,.ht-next:focus-visible{outline:2px solid var(--sx-accent,#cd4257);outline-offset:2px}" +
    "@media print{.ht-ov{display:none}}";

  function finish() {
    try { localStorage.setItem("hub.tour", "1"); } catch (e) {}
    if (ov) { ov.remove(); ov = null; }
    window.removeEventListener("resize", place); window.removeEventListener("scroll", place);
    doc.removeEventListener("keydown", onKey, true);
  }

  var ov = null, hole = null, card = null, kEl, hEl, tEl, dots, steps = [], at = 0;

  function target() { return steps[at] && doc.querySelector(steps[at].sel); }
  function place() {
    var t = target(); if (!t) return;
    var r = t.getBoundingClientRect(), pad = 6;
    var x = Math.max(6, r.left - pad), y = Math.max(6, r.top - pad);
    var w = Math.min(window.innerWidth - 12, r.width + pad * 2), h = r.height + pad * 2;
    hole.style.left = x + "px"; hole.style.top = y + "px"; hole.style.width = w + "px"; hole.style.height = h + "px";
    /* card below or above the target, clamped to the viewport */
    var cw = Math.min(320, window.innerWidth - 24), ch = card.offsetHeight || 150, gap = 16;
    var below = steps[at].place !== "above";
    var cy = below ? y + h + gap : y - ch - gap;
    if (cy + ch > window.innerHeight - 10) cy = Math.max(10, y - ch - gap);
    if (cy < 10) cy = Math.min(window.innerHeight - ch - 10, y + h + gap);
    var cx = r.left + r.width / 2 - cw / 2;
    cx = Math.max(12, Math.min(window.innerWidth - cw - 12, cx));
    card.style.left = cx + "px"; card.style.top = Math.max(10, cy) + "px";
  }
  function render() {
    var s = steps[at];
    kEl.textContent = "Step " + (at + 1) + " of " + steps.length;
    hEl.textContent = s.title; tEl.textContent = s.text;
    Array.prototype.forEach.call(dots.children, function (d, i) { d.classList.toggle("is-on", i === at); });
    card.querySelector(".ht-next").textContent = at === steps.length - 1 ? "Done" : "Next";
    var t = target();
    if (t) { try { t.scrollIntoView({ block: "center", behavior: Site.reducedMotion ? "auto" : "smooth" }); } catch (e) {} }
    requestAnimationFrame(function () { requestAnimationFrame(place); });
  }
  function next() { if (at >= steps.length - 1) { finish(); try { Site.sfx("success"); } catch (e) {} return; } at++; try { Site.sfx("tap"); } catch (e) {} render(); }
  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); finish(); }
    else if (e.key === "Enter" || e.key === "ArrowRight") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); if (at > 0) { at--; render(); } }
  }

  function startTour() {
    steps = STEPS.filter(function (s) { return doc.querySelector(s.sel); });
    if (steps.length < 2) { try { localStorage.setItem("hub.tour", "1"); } catch (e) {} return; }   /* nothing worth touring */
    var st = doc.createElement("style"); st.textContent = CSS; doc.head.appendChild(st);
    hole = el("div", { class: "ht-hole" });
    kEl = el("span", { class: "ht-card__k" }); hEl = el("h2", { class: "ht-card__h" }); tEl = el("p", { class: "ht-card__t" });
    dots = el("div", { class: "ht-dots" });
    steps.forEach(function () { dots.appendChild(el("span", { class: "ht-dot" })); });
    var skip = el("button", { type: "button", class: "ht-skip", text: "Skip tour" });
    var go = el("button", { type: "button", class: "ht-next", text: "Next" });
    var x = el("button", { type: "button", class: "ht-x", "aria-label": "Close tour", title: "Close tour", html: "&times;" });
    function quit() { try { Site.sfx("close"); } catch (e) {} finish(); }
    skip.addEventListener("click", quit);
    x.addEventListener("click", quit);
    go.addEventListener("click", next);
    card = el("div", { class: "ht-card", role: "dialog", "aria-label": "Site tour" }, x, kEl, hEl, tEl,
      el("div", { class: "ht-card__row" }, dots, skip, go));
    var hint = el("div", { class: "ht-hint", text: "Click anywhere or press Esc to skip" });
    ov = el("div", { class: "ht-ov" }, hole, card, hint);
    /* click anywhere outside the card closes it — makes the whole thing easy to dismiss */
    ov.addEventListener("click", function (e) { if (!card.contains(e.target)) quit(); });
    (doc.body || doc.documentElement).appendChild(ov);
    window.addEventListener("resize", place); window.addEventListener("scroll", place, { passive: true });
    doc.addEventListener("keydown", onKey, true);
    render();
    requestAnimationFrame(function () { card.classList.add("is-in"); });
    setTimeout(function () { try { go.focus(); } catch (e) {} }, 60);
  }

  Site.ready(function () {
    /* give the async header buttons (menu, search) and the trophy cup time to mount, and let any
       first-visit boot splash clear, before spotlighting anything */
    var delay = 2200;
    try { if (sessionStorage.getItem("pl.boot") === "1") delay = 1400; } catch (e) {}
    setTimeout(startTour, delay);
  }, "hub tour");
})();
