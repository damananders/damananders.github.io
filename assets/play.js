/* play.js — the playful layer, loaded on every page by assets/interact.js (prefix pl-).
 *
 *   1. Trophies       small achievements for exploring the site; a cup button in the tool rail lists them.
 *                     Site.trophy("id") awards one. Stored per browser. features.trophies
 *   2. Secret codes   type a word anywhere (not in a text box) to trigger an effect. features.secretCodes
 *                     australia, gravity, moon, barrelroll, crt, disco, matrix
 *   3. Controller     press Y, B, A, X (triangle, circle, cross, square) in a row. features.padCombo
 *   4. Boot intro     hub only, once per browser session, skippable. features.intro
 *
 * Everything moving is skipped when motion is reduced; trophies still work.
 */
(function () {
  "use strict";
  if (!window.Site || window.__plLoaded) return;
  window.__plLoaded = true;
  var Site = window.Site, el = Site.el, svg = Site.svg, doc = document, root = doc.documentElement;
  function feat(name) { var f = (Site.config && Site.config.features) || {}; return f[name] !== false; }

  /* ====================================================================================================
   * 1. Trophies
   * ==================================================================================================== */
  var TROPHIES = [
    { id: "hello",     name: "Player One",        desc: "Showed up. That's the first step." },
    { id: "explorer",  name: "Cartographer",      desc: "Visited the hub, AndersCraft, AnyPS, the ratings and the résumé." },
    { id: "theme",     name: "Night Shift",       desc: "Flipped between the dark and light themes." },
    { id: "settings",  name: "Tinkerer",          desc: "Opened the settings panel." },
    { id: "bottom",    name: "Rock Bottom",       desc: "Scrolled a page all the way down." },
    { id: "share",     name: "Word of Mouth",     desc: "Used the share button." },
    { id: "dj",        name: "Sea Breeze",        desc: "Turned on the soundscape." },
    { id: "hire",      name: "Headhunter",        desc: "Opened the 'work with me' box." },
    { id: "card",      name: "Due Diligence",     desc: "Opened a project card on the résumé." },
    { id: "lost",      name: "Off the Map",       desc: "Found the 404 page.", secret: true },
    { id: "door",      name: "Knock Knock",       desc: "Found the hidden door.", secret: true },
    { id: "key",       name: "Keymaster",         desc: "Got through the hidden door.", secret: true },
    { id: "konami",    name: "Old School",        desc: "Entered a very famous cheat code.", secret: true },
    { id: "australia", name: "Down Under",        desc: "Turned the whole site upside down.", secret: true },
    { id: "codes",     name: "Codebreaker",       desc: "Discovered three different secret words.", secret: true },
    { id: "combo",     name: "Button Masher",     desc: "Pulled off the controller combo.", secret: true },
    { id: "sailor",    name: "Old Salt",          desc: "Scored 300 or more in the game on the lost page.", secret: true },
    { id: "all",       name: "Completionist",     desc: "Earned every other trophy." }
  ];
  var CUP = '<path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 5.5H5.2a2.6 2.6 0 0 0 2.9 3.6M16 5.5h2.8a2.6 2.6 0 0 1-2.9 3.6M12 13v3.5M8.5 20h7M9.5 20c0-2 1-3.5 2.5-3.5s2.5 1.5 2.5 3.5"/>';
  var got = Site.store.get("trophies", {}) || {};
  var queue = [], showing = false, cupBtn = null, cupCount = null;

  function count() { var n = 0; TROPHIES.forEach(function (t) { if (got[t.id]) n++; }); return n; }
  function paintCup() { if (cupCount) cupCount.textContent = count() + "/" + TROPHIES.length; }
  function nextPop() {
    if (showing || !queue.length || !doc.body) return;
    showing = true;
    var t = queue.shift();
    var pop = el("div", { class: "pl-trophy", role: "status" },
      el("span", { class: "pl-trophy__ico" }, svg(CUP)),
      el("span", { class: "pl-trophy__txt" }, el("small", { text: "Trophy earned" }), el("strong", { text: t.name }), el("span", { text: t.desc })));
    doc.body.appendChild(pop);
    try { if (pop.showPopover) { pop.setAttribute("popover", "manual"); pop.showPopover(); } } catch (e) {}
    Site.sfx("success");
    requestAnimationFrame(function () { pop.classList.add("is-in"); });
    setTimeout(function () { pop.classList.remove("is-in"); setTimeout(function () { pop.remove(); showing = false; nextPop(); }, 420); }, 4200);
  }
  function award(id) {
    if (!feat("trophies") || got[id]) return false;
    var t = null; TROPHIES.forEach(function (x) { if (x.id === id) t = x; });
    if (!t) return false;
    got[id] = Date.now(); Site.store.set("trophies", got); paintCup();
    queue.push(t); setTimeout(nextPop, 350);
    if (id !== "all" && count() === TROPHIES.length - 1) setTimeout(function () { award("all"); }, 600);
    return true;
  }
  Site.trophy = award;

  function openList() {
    var list = el("ul", { class: "pl-list" });
    TROPHIES.forEach(function (t) {
      var have = !!got[t.id], hidden = t.secret && !have;
      list.appendChild(el("li", { class: "pl-item" + (have ? " is-got" : "") },
        el("span", { class: "pl-item__ico" }, svg(CUP)),
        el("span", { class: "pl-item__txt" }, el("strong", { text: hidden ? "Secret trophy" : t.name }), el("span", { text: hidden ? "Keep poking around." : t.desc }))));
    });
    var body = el("div", {},
      el("p", { class: "pl-list__sum", text: count() + " of " + TROPHIES.length + " earned. They're saved in this browser only." }),
      list,
      el("p", { class: "pl-list__hint", text: "Psst: some words do things if you just type them. One of them is a country where everything is upside down." }));
    var d = Site.modal({ id: "pl-trophies", title: "Trophies", className: "pl-modal", body: body });
    d.addEventListener("close", function () { d.remove(); });
    Site.dialog.open(d);
  }

  Site.ready(function () {
    if (!feat("trophies")) return;
    var tools = Site.tools();
    if (tools) {
      cupCount = el("span", { class: "pl-cup__n", "aria-hidden": "true" });
      cupBtn = el("button", { type: "button", class: "sx-iconbtn pl-cup", style: { order: "40" }, "aria-label": "Trophies", title: "Trophies" }, svg(CUP), cupCount);
      cupBtn.addEventListener("click", function () { Site.sfx("open"); openList(); });
      tools.appendChild(cupBtn); paintCup();
    }
    /* triggers */
    setTimeout(function () { award("hello"); }, 1800);
    var seen = Site.store.get("seen", {}) || {};
    if (Site.page) { seen[Site.page] = 1; Site.store.set("seen", seen); }
    if (seen.hub && seen.anderscraft && seen.anyps && seen.games && seen.resume) setTimeout(function () { award("explorer"); }, 2600);
    if (Site.page === "404") setTimeout(function () { award("lost"); }, 1200);
    if (Site.page === "vault" || Site.page === "locker") setTimeout(function () { award("key"); }, 1200);
    Site.on("pref:soundscape", function (v) { if (v === true || (v && v.detail === true)) award("dj"); });
    Site.on("konami", function () { award("konami"); });
    Site.on("dialog:open", function (d) {
      var n = d && d.id ? d : d && d.detail; var id = n && n.id;
      if (id === "hb-code") award("door"); else if (id === "hg-box") award("hire");
    });
    doc.addEventListener("click", function (e) {
      var t = e.target; if (!t || !t.closest) return;
      if (t.closest(".ch-theme")) award("theme");
      else if (t.closest(".ch-gear")) award("settings");
      else if (t.closest(".ch-share")) award("share");
      else if (t.closest(".rz-card__head")) award("card");
    });
    var bottomDone = false;
    window.addEventListener("scroll", function () {
      if (bottomDone) return;
      var max = root.scrollHeight - window.innerHeight;
      if (max > 600 && (window.pageYOffset || root.scrollTop) >= max - 4) { bottomDone = true; award("bottom"); }
    }, { passive: true });
  }, "trophies");

  /* ====================================================================================================
   * 2. Secret codes
   * ==================================================================================================== */
  var FALLERS = ".avenue,.hb-rate,.hb-hire,.hb-ticker,.hb-now,.hb-hint,.rz-stat,.rz-card,.rz-job,.rz-skillset,.rz-cred__col,.rz-contact,.rz-btn," +
    ".game,.panel,.feat li,.social,.sx-chip,.sx-iconbtn,.brand,h1,h2,h3,.lead,.eyebrow,.rz-pitch,.rz-role,footer p,form,.discord-btn,img,video";
  var active = {}, found = Site.store.get("codes", {}) || {};

  function inView() {
    var out = [], all = doc.querySelectorAll(FALLERS), vh = window.innerHeight, vw = window.innerWidth;
    for (var i = 0; i < all.length && out.length < 70; i++) {
      var n = all[i];
      if (n.closest("dialog,.pl-trophy,.ix-ring")) continue;
      var r = n.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
      /* skip anything that contains another faller, so the pieces that fall are the leaves */
      if (n.querySelector(FALLERS) && !/^(H1|H2|H3)$/.test(n.tagName) && !n.matches(".avenue,.rz-card,.rz-job,.rz-stat,.game")) continue;
      if (n.parentElement && n.parentElement.closest(".avenue,.rz-card,.rz-job,.rz-stat,.game,.hb-rate,.rz-contact,.rz-skillset,.rz-cred__col")) continue;
      out.push({ n: n, r: r });
    }
    return out;
  }
  /* drop: every visible block falls to the bottom of the screen and piles up. flipped = the page is upside down,
     so "down on screen" is "up" in the page's own coordinates. Returns a function that puts everything back. */
  function drop(flipped) {
    var items = inView(), vh = window.innerHeight;
    items.forEach(function (it, i) {
      var n = it.n, r = it.r;
      it.t = n.style.transform; it.tr = n.style.transition; it.z = n.style.zIndex; it.pos = n.style.position;
      var dist = Math.max(0, vh - r.bottom - 6 - Math.random() * 26), rot = (Math.random() * 50 - 25);
      n.style.transition = "transform " + (0.75 + Math.random() * 0.5).toFixed(2) + "s cubic-bezier(.5,0,.9,.45) " + (i * 0.018 + Math.random() * 0.25).toFixed(2) + "s";
      if (getComputedStyle(n).position === "static") n.style.position = "relative";
      n.style.zIndex = "5";
      n.style.transform = "translate(" + (Math.random() * 40 - 20).toFixed(0) + "px," + ((flipped ? -1 : 1) * dist).toFixed(0) + "px) rotate(" + rot.toFixed(1) + "deg)";
    });
    return function restore() {
      items.forEach(function (it) {
        var n = it.n;
        n.style.transition = "transform .7s cubic-bezier(.2,.8,.2,1)";
        n.style.transform = it.t || "";
        setTimeout(function () { n.style.transition = it.tr || ""; n.style.zIndex = it.z || ""; n.style.position = it.pos || ""; }, 760);
      });
    };
  }
  function pivot() { var y = (window.pageYOffset || root.scrollTop || 0) + window.innerHeight / 2; doc.body.style.transformOrigin = "50% " + y + "px"; }
  function timed(name, ms, stop) {
    var t = setTimeout(function () { end(name); }, ms);
    active[name] = function () { clearTimeout(t); stop(); };
  }
  function end(name) { var f = active[name]; if (f) { delete active[name]; f(); } }
  function endAll() { Object.keys(active).forEach(end); }

  var CODES = {
    australia: function () {
      pivot(); root.classList.add("pl-flip");
      Site.toast("G'day. Type it again or press Esc to come back up.", { type: "ok", ms: 5200 });
      var restore = null, t1 = setTimeout(function () { restore = drop(true); }, 1250);
      timed("australia", 14000, function () {
        clearTimeout(t1); if (restore) restore();
        setTimeout(function () { root.classList.remove("pl-flip"); setTimeout(function () { doc.body.style.transformOrigin = ""; }, 1300); }, restore ? 500 : 0);
      });
      award("australia");
    },
    gravity: function () {
      Site.toast("Gravity: on.", { type: "info", ms: 2600 });
      var restore = drop(false);
      timed("gravity", 7000, restore);
    },
    moon: function () {
      Site.toast("One sixth of the gravity.", { type: "info", ms: 2600 });
      var items = inView();
      items.forEach(function (it) { it.n.style.setProperty("--pl-d", (Math.random() * -4).toFixed(2) + "s"); it.n.style.setProperty("--pl-a", (8 + Math.random() * 16).toFixed(0) + "px"); it.n.classList.add("pl-float"); });
      timed("moon", 10000, function () { items.forEach(function (it) { it.n.classList.remove("pl-float"); it.n.style.removeProperty("--pl-d"); it.n.style.removeProperty("--pl-a"); }); });
    },
    barrelroll: function () {
      pivot(); root.classList.add("pl-roll");
      timed("barrelroll", 1500, function () { root.classList.remove("pl-roll"); doc.body.style.transformOrigin = ""; });
    },
    crt: function () {
      var on = root.classList.toggle("pl-crt");
      Site.store.set("crt", on);
      Site.toast(on ? "CRT mode on. Type crt again to switch it off." : "CRT mode off.", { type: "info", ms: 3000 });
    },
    disco: function () {
      root.classList.add("pl-disco");
      Site.toast("Disco.", { type: "ok", ms: 2200 });
      timed("disco", 9000, function () { root.classList.remove("pl-disco"); });
    },
    matrix: function () {
      var cv = el("canvas", { class: "pl-matrix", "aria-hidden": "true" }), ctx = cv.getContext("2d"), raf = 0, cols = [], last = 0;
      doc.body.appendChild(cv);
      function size() { cv.width = window.innerWidth; cv.height = window.innerHeight; cols = []; for (var i = 0; i < Math.ceil(cv.width / 16); i++) cols.push(Math.random() * -40); }
      function frame(t) {
        raf = requestAnimationFrame(frame);
        if (t - last < 55) return; last = t;
        ctx.fillStyle = "rgba(0,0,0,.09)"; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.font = "15px monospace";
        for (var i = 0; i < cols.length; i++) {
          var ch = String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96)), y = cols[i] * 16;
          ctx.fillStyle = Math.random() < 0.06 ? "#d9ffe6" : "#35e07a"; ctx.fillText(ch, i * 16, y);
          cols[i] = y > cv.height && Math.random() > 0.975 ? 0 : cols[i] + 1;
        }
      }
      size(); raf = requestAnimationFrame(frame);
      requestAnimationFrame(function () { cv.classList.add("is-in"); });
      timed("matrix", 9000, function () { cv.classList.remove("is-in"); setTimeout(function () { cancelAnimationFrame(raf); cv.remove(); }, 600); });
    }
  };
  var STILL_OK = { crt: 1 };                          /* effects that are fine with reduced motion */

  function run(word) {
    if (active[word]) { end(word); return; }
    if (Site.reducedMotion && !STILL_OK[word]) { Site.toast("That one needs motion. Turn off 'Reduce Motion' in settings to see it.", { type: "info", ms: 4200 }); return; }
    endAll();
    CODES[word]();
    found[word] = 1; Site.store.set("codes", found);
    if (Object.keys(found).length >= 3) award("codes");
  }
  Site.secret = function (word) { word = String(word || "").toLowerCase().replace(/[^a-z]/g, ""); if (CODES[word]) { run(word); return true; } return false; };

  Site.ready(function () {
    if (!feat("secretCodes")) return;
    if (Site.store.get("crt", false) === true) root.classList.add("pl-crt");
    var buf = "", names = Object.keys(CODES);
    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { endAll(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey || !e.key || e.key.length !== 1) return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      var c = e.key.toLowerCase(); if (c < "a" || c > "z") return;
      buf = (buf + c).slice(-16);
      for (var i = 0; i < names.length; i++) if (buf.slice(-names[i].length) === names[i]) { buf = ""; run(names[i]); break; }
    });
  }, "secret codes");

  /* ====================================================================================================
   * 3. Controller combo: Y, B, A, X  (triangle, circle, cross, square)
   * ==================================================================================================== */
  Site.ready(function () {
    if (!feat("padCombo") || !Site.gamepad) return;
    var want = ["y", "b", "a", "x"], at = 0, last = 0;
    Site.gamepad.on(function (btn) {
      var now = Date.now(); if (now - last > 2500) at = 0; last = now;
      if (btn === want[at]) at++; else at = btn === want[0] ? 1 : 0;
      if (at === want.length) {
        at = 0; award("combo");
        Site.toast("Combo! Triangle, circle, cross, square.", { type: "ok", ms: 3200 });
        if (!Site.reducedMotion) { end("barrelroll"); CODES.barrelroll(); }
      }
    });
  }, "pad combo");

  /* ====================================================================================================
   * 4. Boot intro (hub, once per session). index.html adds .pl-preboot before first paint so nothing flashes.
   * ==================================================================================================== */
  Site.ready(function () {
    var pre = root.classList.contains("pl-preboot");
    function clear() { root.classList.remove("pl-preboot"); }
    if (Site.page !== "hub" || !feat("intro") || Site.reducedMotion || !doc.body) { clear(); return; }
    var done = false; try { done = sessionStorage.getItem("pl.boot") === "1"; } catch (e) {}
    if (done || !pre) { clear(); return; }
    try { sessionStorage.setItem("pl.boot", "1"); } catch (e) {}
    var boot = el("div", { class: "pl-boot", role: "presentation" },
      el("div", { class: "pl-boot__in" },
        el("span", { class: "pl-boot__ring" }, el("img", { src: "/assets/icons/icon-192.png", alt: "", width: "96", height: "96" })),
        el("strong", { class: "pl-boot__name", text: "ANDERS" }),
        el("span", { class: "pl-boot__bar" }, el("i")),
        el("small", { class: "pl-boot__skip", text: "Press any key to skip" })));
    doc.body.appendChild(boot);
    clear();
    var gone = false;
    function finish() {
      if (gone) return; gone = true;
      boot.classList.add("is-out");
      window.removeEventListener("keydown", finish, true); boot.removeEventListener("pointerdown", finish);
      setTimeout(function () { boot.remove(); }, 520);
    }
    window.addEventListener("keydown", finish, true); boot.addEventListener("pointerdown", finish);
    requestAnimationFrame(function () { boot.classList.add("is-on"); });
    setTimeout(finish, 2500);
  }, "boot intro");
})();
