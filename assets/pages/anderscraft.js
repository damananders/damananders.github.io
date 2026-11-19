/* pages/anderscraft.js: the AndersCraft page's own upgrades (see assets/README.md).
 * Live sign-up status, realm counts and leaderboard, the setup checklist, form hints, and the "Latest" list.
 * It only ever adds to the page: the sign-up form and its inline submit script are left exactly as they are.
 */
(function () {
  "use strict";
  if (!window.Site) return;
  var Site = window.Site, el = Site.el, root = document.documentElement;
  var FEATURES = (Site.config && Site.config.features) || {};
  function enabled(name) { return FEATURES[name] !== false; }           /* undefined counts as on */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function isNum(n) { return typeof n === "number" && isFinite(n) && n >= 0; }
  function plural(n, one, many) { return Site.fmtNum(n) + " " + (n === 1 ? one : many); }
  var settings = null;
  try { if (typeof ANDERSCRAFT !== "undefined" && ANDERSCRAFT) settings = ANDERSCRAFT; } catch (e) {}

  root.classList.add("ac-js");

  /* ---------- Discord links follow the page's own config ---------- */
  Site.ready(function () {
    var url = settings && settings.discord;
    if (typeof url !== "string" || !/^https:\/\//i.test(url)) return;
    $all("a.ac-discord").forEach(function (a) { a.href = url; });
  }, "ac-discord");

  /* ---------- Item 11: live sign-up status chip + calm offline note ---------- */
  Site.ready(function () {
    var chip = $("#ac-signup-chip"), label = $("#ac-signup-chip-t"), note = $("#ac-offnote"), msg = $("#msg");
    if (!chip || !label) return;
    if (!enabled("acSignupStatus")) { chip.hidden = true; return; }
    var TEXT = { wait: "Checking", up: "Sign-ups open", down: "Sign-ups offline" };
    var state = "wait", timer = 0, busy = false, RECHECK = 61000;   /* just past the core's 60 s cache, so every recheck is a real one */

    function show(next) {
      if (next !== "up" && next !== "down") next = "wait";
      if (next === state) return;
      state = next;
      chip.className = "sx-chip ac-chip " + (next === "up" ? "is-on" : next === "down" ? "is-off" : "is-wait");
      label.textContent = TEXT[next];
      if (note) note.hidden = next !== "down";
    }
    function schedule() { clearTimeout(timer); timer = 0; if (!document.hidden) timer = setTimeout(check, RECHECK); }
    function check() {
      if (busy || document.hidden) return;
      busy = true; clearTimeout(timer); timer = 0;
      Site.live.signup().then(function (v) { busy = false; show(v === "up" ? "up" : "down"); schedule(); },
                              function () { busy = false; schedule(); });
    }
    document.addEventListener("visibilitychange", function () { if (document.hidden) { clearTimeout(timer); timer = 0; } else check(); });

    /* The inline submit script writes its result into #msg: learn from it without touching it. */
    if (msg && "MutationObserver" in window) {
      new MutationObserver(function () {
        if (msg.classList.contains("ok")) { show("up"); schedule(); }
        else if (msg.classList.contains("err")) {
          /* its "offline" message means the request itself failed, so sign-ups are offline right now */
          if (/offline/i.test(msg.textContent || "")) { show("down"); schedule(); }
          else check();
        }
      }).observe(msg, { attributes: true, attributeFilter: ["class"], childList: true, characterData: true, subtree: true });
    }
    check();
  }, "ac-signup-status");

  /* ---------- Items 12 + 18: player and bot counts, leaderboard (absent until the status endpoint answers) ---------- */
  Site.ready(function () {
    var wantCounts = enabled("acRealmStatus"), wantBoard = enabled("acLeaderboard");
    if (!wantCounts && !wantBoard) return;
    var summary = $("#ac-summary"), cards = $all("[data-ac-realm]");
    var section = $("#ac-board"), box = $("#ac-board-box");
    var timer = 0, busy = false, lastBoard = "", lastCounts = "";

    function clean(v, max) { return typeof v === "string" ? v.trim().slice(0, max || 40) : ""; }

    function renderCounts(d) {
      var realms = d && Array.isArray(d.realms) ? d.realms.filter(function (r) { return r && typeof r === "object"; }) : [];
      var key = JSON.stringify(realms); if (key === lastCounts) return; lastCounts = key;
      var players = 0, bots = 0, any = false;
      cards.forEach(function (card) {
        var line = $("[data-ac-live]", card); if (!line) return;
        var id = card.getAttribute("data-ac-realm");
        var r = realms.filter(function (x) { return String(x.id) === id; })[0];
        line.textContent = "";
        if (!r || typeof r.online !== "boolean") { line.hidden = true; return; }
        var name = clean(r.name);
        line.appendChild(el("span", { class: "sx-chip " + (r.online ? "is-on" : "is-off") }, el("i", { class: "sx-dot", "aria-hidden": "true" }), r.online ? "Online" : "Offline"));
        var bits = [];
        if (name) bits.push(name);
        if (r.online && isNum(r.players)) { bits.push(plural(r.players, "player", "players")); players += r.players; any = true; }
        if (r.online && isNum(r.bots) && r.bots > 0) { bits.push(plural(r.bots, "bot", "bots")); bots += r.bots; }
        if (bits.length) line.appendChild(el("span", { class: "ac-realm-count", text: bits.join(" · ") }));
        line.hidden = false;
      });
      if (summary) {
        if (any) { summary.textContent = plural(players, "player", "players") + (bots > 0 ? " and " + plural(bots, "bot", "bots") : "") + " online right now"; summary.hidden = false; }
        else { summary.textContent = ""; summary.hidden = true; }
      }
    }

    function entries(list) {
      return (Array.isArray(list) ? list : []).filter(function (c) { return c && clean(c.name) && isNum(c.level); }).slice(0, 10);
    }
    function renderBoard(d) {
      if (!section || !box) return;
      var lb = d && d.leaderboard && typeof d.leaderboard === "object" ? d.leaderboard : null;
      var top = lb ? entries(lb.topLevel) : [], hc = lb ? entries(lb.hardcore) : [];
      var realmNames = {};
      if (d && Array.isArray(d.realms)) d.realms.forEach(function (r) { if (r && clean(r.name)) realmNames[String(r.id)] = clean(r.name); });
      var key = JSON.stringify([top, hc, realmNames]); if (key === lastBoard) return; lastBoard = key;
      box.textContent = "";
      if (!top.length && !hc.length) { section.hidden = true; return; }

      function who(c) { return [clean(c.race, 24), clean(c["class"], 24)].filter(Boolean).join(" "); }
      function row(c, i, hardcore) {
        var meta = who(c), fallen = hardcore && c.alive === false;
        if (!hardcore && realmNames[String(c.realm)]) meta = (meta ? meta + " · " : "") + realmNames[String(c.realm)];
        var right = el("span", { class: "ac-lvl" }, "Level " + Site.fmtNum(c.level));
        if (hardcore && typeof c.alive === "boolean") right.appendChild(el("small", { class: c.alive ? "ac-alive" : "ac-fallen", text: c.alive ? "Alive" : "Fallen" }));
        return el("li", { class: "ac-row" + (fallen ? " ac-is-fallen" : "") },
          el("span", { class: "ac-rank", text: String(i + 1) }),
          el("span", { class: "ac-who" }, el("span", { class: "ac-name", text: clean(c.name) }), meta ? el("span", { class: "ac-meta", text: meta }) : null),
          right);
      }
      var defs = [
        { id: "top", label: "Top level", list: top, hardcore: false, empty: "No characters to show yet." },
        { id: "hardcore", label: "Hardcore", list: hc, hardcore: true, empty: "No hardcore characters to show yet." }
      ];
      var current = Site.store.get("ac.boardTab", "top"); if (current !== "hardcore") current = "top";
      if (!top.length) current = "hardcore"; else if (!hc.length) current = "top";
      var tabs = [], panels = [];
      function select(id, focus) {
        current = id;
        defs.forEach(function (t, i) {
          var on = t.id === id;
          tabs[i].setAttribute("aria-selected", on ? "true" : "false");
          tabs[i].setAttribute("tabindex", on ? "0" : "-1");
          panels[i].hidden = !on;
          if (on && focus) tabs[i].focus();
        });
      }
      var tablist = el("div", { class: "ac-tabs", role: "tablist", "aria-label": "Leaderboard" });
      defs.forEach(function (t, i) {
        var tab = el("button", { type: "button", class: "ac-tab", role: "tab", id: "ac-tab-" + t.id, "aria-controls": "ac-panel-" + t.id, text: t.label,
          onclick: function () { if (current !== t.id) { select(t.id, false); Site.store.set("ac.boardTab", t.id); Site.sfx("tap"); } },
          onkeydown: function (e) {
            var n = e.key === "ArrowRight" || e.key === "ArrowDown" ? i + 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? defs.length - 1 : null;
            if (n == null) return;
            e.preventDefault(); n = (n + defs.length) % defs.length;
            select(defs[n].id, true); Site.store.set("ac.boardTab", defs[n].id); Site.sfx("tap");
          } });
        var panel = el("div", { class: "ac-panel", role: "tabpanel", id: "ac-panel-" + t.id, "aria-labelledby": "ac-tab-" + t.id });
        if (t.list.length) panel.appendChild(el("ol", { class: "ac-rows" }, t.list.map(function (c, n) { return row(c, n, t.hardcore); })));
        else panel.appendChild(el("p", { class: "ac-empty", text: t.empty }));
        tabs.push(tab); panels.push(panel); tablist.appendChild(tab);
      });
      box.appendChild(tablist); panels.forEach(function (p) { box.appendChild(p); });
      select(current, false);
      section.hidden = false;
    }

    function schedule() { clearTimeout(timer); timer = 0; if (!document.hidden) timer = setTimeout(load, 60000); }
    function load() {
      if (busy || document.hidden) return;
      busy = true; clearTimeout(timer); timer = 0;
      Site.live.realms().then(function (d) {
        busy = false;
        if (wantCounts) Site.ready(function () { renderCounts(d); }, "ac-counts");
        if (wantBoard) Site.ready(function () { renderBoard(d); }, "ac-leaderboard");
        schedule();
      }, function () { busy = false; schedule(); });
    }
    document.addEventListener("visibilitychange", function () { if (document.hidden) { clearTimeout(timer); timer = 0; } else load(); });
    load();
  }, "ac-realm-status");

  /* ---------- Item 16: "How to play" becomes a checklist with a progress bar ---------- */
  Site.ready(function () {
    if (!enabled("acWizard")) return;
    var wiz = $("#ac-wiz"), list = wiz && $(".ac-steps", wiz); if (!list) return;
    var steps = $all(".ac-step[data-ac-step]", list); if (!steps.length) return;
    var KEY = "ac.wizard", saved = Site.store.get(KEY, {});
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) saved = {};
    var CHECK = '<path d="M5 12.5l4.5 4.5L19 7.5"/>';

    var bar = el("div", { class: "sx-progress ac-prog", role: "progressbar", "aria-label": "Setup progress", "aria-valuemin": "0", "aria-valuemax": String(steps.length) }, el("i"));
    var count = el("span", { class: "ac-wiz-count", role: "status", "aria-live": "polite" });
    var reset = el("button", { type: "button", class: "ac-btn ac-reset", text: "Reset", "aria-label": "Reset the checklist", onclick: function () {
      saved = {}; Site.store.remove(KEY); paint(); Site.sfx("toggle");
    } });
    var buttons = steps.map(function (li, i) {
      var id = li.getAttribute("data-ac-step"), title = ($(".ac-step-t", li) || li).textContent.trim();
      var b = el("button", { type: "button", class: "ac-check", "aria-pressed": "false", "aria-label": "Step " + (i + 1) + " done: " + title,
        onclick: function () { set(id, !saved[id], true); } },
        el("span", { class: "ac-check-n", "aria-hidden": "true", text: String(i + 1) }), Site.svg(CHECK, { "stroke-width": "2.6" }));
      li.insertBefore(b, li.firstChild);
      return b;
    });
    function doneCount() { return steps.filter(function (li) { return saved[li.getAttribute("data-ac-step")] === true; }).length; }
    function paint() {
      var n = doneCount();
      steps.forEach(function (li, i) {
        var on = saved[li.getAttribute("data-ac-step")] === true;
        li.classList.toggle("ac-done", on); buttons[i].setAttribute("aria-pressed", on ? "true" : "false");
      });
      bar.style.setProperty("--sx-p", Math.round(n / steps.length * 100) + "%");
      bar.setAttribute("aria-valuenow", String(n));
      bar.setAttribute("aria-valuetext", n + " of " + steps.length + " steps done");
      var text = n === steps.length ? "All " + steps.length + " done" : n + " of " + steps.length + " done";
      if (count.textContent !== text) count.textContent = text;
      reset.disabled = n === 0;
    }
    function set(id, on, byHand) {
      var before = doneCount();
      if (on) saved[id] = true; else delete saved[id];
      Site.store.set(KEY, saved); paint();
      if (byHand) {
        if (doneCount() === steps.length && before < steps.length) { Site.sfx("success"); Site.toast("All four steps done. See you in game.", { type: "ok" }); }
        else Site.sfx("toggle");
      }
    }
    wiz.insertBefore(el("div", { class: "ac-wiz-top" }, bar, count, reset), list);
    wiz.classList.add("ac-on");
    paint();

    /* Step one ticks itself when the sign-up form reports success in this session. */
    var msg = $("#msg");
    if (msg && "MutationObserver" in window) {
      new MutationObserver(function () { if (msg.classList.contains("ok") && saved.account !== true) set("account", true, false); })
        .observe(msg, { attributes: true, attributeFilter: ["class"] });
    }
  }, "ac-wizard");

  /* ---------- Item 17: live hints on the form (they describe, they never block; the submit script decides) ---------- */
  Site.ready(function () {
    if (!enabled("acPasswordHints")) { var m0 = $("#ac-meter"); if (m0) m0.hidden = true; return; }
    var form = $("#signup"); if (!form) return;
    var user = $("#username"), pw = $("#password"), pw2 = $("#password2");

    /* What you see changes at once; what a screen reader hears waits until typing pauses. */
    function hint(node) {
      if (!node) return function () {};
      node.removeAttribute("aria-live");
      var seen = el("span", { "aria-hidden": "true" }), heard = el("span", { class: "sx-sr", "aria-live": "polite" }), t = 0;
      node.textContent = ""; node.appendChild(seen); node.appendChild(heard);
      return function (text, state, spoken) {
        if (seen.textContent !== text) seen.textContent = text;
        if (state) node.setAttribute("data-ac-state", state); else node.removeAttribute("data-ac-state");
        clearTimeout(t); var say = spoken == null ? text : spoken;
        t = setTimeout(function () { if (heard.textContent !== say) heard.textContent = say; }, 700);
      };
    }
    var sayUser = hint($("#ac-user-live")), sayPw = hint($("#ac-meter-t")), sayMatch = hint($("#ac-match")), meter = $("#ac-meter");

    function checkUser() {
      if (!user) return;
      var v = user.value.trim(), n = v.length;                        /* the submit script trims too */
      if (!n) sayUser("", null);
      else if (/[^A-Za-z0-9]/.test(v)) sayUser("Letters and numbers only", "err");
      else if (n < 3) sayUser(n + " / 16 · needs 3", "warn", n + " of 16 characters, needs at least 3");
      else if (n > 16) sayUser(n + " / 16 · too long", "err", n + " characters, 16 is the limit");
      else sayUser(n + " / 16 ✓", "ok", n + " of 16 characters, looks good");
    }
    function checkPw() {
      if (!pw) return;
      var v = pw.value, n = v.length, level = 0, tone = "";
      if (!n) sayPw("", null);
      else if (/\s/.test(v)) { level = 1; sayPw("No spaces", "err", "Passwords can't have spaces"); }
      else if (/[^\x21-\x7E]/.test(v)) { level = 1; sayPw("Plain characters only", "err", "Use plain letters, numbers and symbols only"); }
      else if (n < 6) { level = 1; sayPw("Too short · " + n + " / 6", "err", "Too short, " + n + " of at least 6 characters"); }
      else if (n > 16) { level = 1; sayPw("Too long", "err", "Too long, 16 characters is the limit"); }
      else {
        var kinds = (/[a-z]/.test(v) ? 1 : 0) + (/[A-Z]/.test(v) ? 1 : 0) + (/[0-9]/.test(v) ? 1 : 0) + (/[^A-Za-z0-9]/.test(v) ? 1 : 0);
        var seen = {}, unique = 0, i;
        for (i = 0; i < n; i++) if (!seen[v.charAt(i)]) { seen[v.charAt(i)] = true; unique++; }
        /* Weak: valid, but short, mostly one repeated character, or a single kind of character (123456, password, aaaaaa). */
        if (n < 8 || unique < 5 || (kinds === 1 && n < 12)) { level = 1; tone = "warn"; sayPw("Weak", "warn", "Password strength: weak. It will work, but a longer, more varied one is safer"); }
        else if ((n >= 12 && kinds >= 3) || (n >= 10 && kinds === 4)) { level = 4; sayPw("Strong", "ok", "Password strength: strong"); }
        else if ((n >= 12 && kinds >= 2) || kinds >= 3) { level = 3; sayPw("Good", "ok", "Password strength: good"); }
        else { level = 2; sayPw("Fine", "warn", "Password strength: fine"); }
      }
      if (meter) {
        meter.setAttribute("data-ac-level", String(level));
        if (tone) meter.setAttribute("data-ac-tone", tone); else meter.removeAttribute("data-ac-tone");   /* one amber bar for weak, one red bar for not allowed */
      }
    }
    function checkMatch() {
      if (!pw || !pw2) return;
      if (!pw2.value) sayMatch("", null);
      else if (pw2.value === pw.value) sayMatch("Passwords match ✓", "ok", "Passwords match");
      else sayMatch("Passwords don't match yet", "warn");
    }
    function all() { checkUser(); checkPw(); checkMatch(); }
    if (user) user.addEventListener("input", checkUser);
    if (pw) pw.addEventListener("input", function () { checkPw(); checkMatch(); });
    if (pw2) pw2.addEventListener("input", checkMatch);
    form.addEventListener("reset", function () { setTimeout(all, 0); });
    all();

    /* show / hide for both password boxes */
    var field = $("#ac-pwfield");
    if (field && pw) {
      var EYE = '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>';
      var EYE_OFF = EYE + '<path d="M4 4l16 16"/>';
      var shown = false;
      var eye = el("button", { type: "button", class: "ac-eye", "aria-pressed": "false", "aria-label": "Show passwords", title: "Show passwords", onclick: function () {
        shown = !shown;
        [pw, pw2].forEach(function (i) { if (i) i.type = shown ? "text" : "password"; });
        eye.setAttribute("aria-pressed", shown ? "true" : "false");
        eye.setAttribute("aria-label", shown ? "Hide passwords" : "Show passwords"); eye.title = shown ? "Hide passwords" : "Show passwords";
        eye.textContent = ""; eye.appendChild(Site.svg(shown ? EYE_OFF : EYE));
        Site.sfx("toggle");
      } }, Site.svg(EYE));
      field.appendChild(eye); field.classList.add("ac-has-eye");
    }
  }, "ac-form-hints");

  /* ---------- Item 19: "Latest" from the shared news list ---------- */
  Site.ready(function () {
    if (!enabled("acNews")) return;
    var section = $("#ac-latest"), list = $("#ac-news"); if (!section || !list) return;
    Site.news().then(function (items) {
      Site.ready(function () {
        var mine = (items || []).filter(function (n) { return n && n.tag === "anderscraft" && typeof n.title === "string"; });
        if (!mine.length) return;
        var dated = mine.filter(function (n) { return !!n.date; }), undated = mine.filter(function (n) { return !n.date; });
        dated.concat(undated).slice(0, 6).forEach(function (n) {
          var when = n.date ? el("time", { class: "ac-news-date", datetime: String(n.date).slice(0, 10), text: Site.fmtDate(n.date) }) : el("span", { class: "ac-news-date", text: "Recently" });
          list.appendChild(el("li", null, when, el("h3", { class: "ac-news-title", text: n.title }), typeof n.body === "string" && n.body ? el("p", { class: "ac-news-body", text: n.body }) : null));
        });
        section.hidden = false;
      }, "ac-news-render");
    });
  }, "ac-news");

  /* ---------- 60-second walkthrough: an animated run through the four steps (hidden under reduced motion) ---------- */
  Site.ready(function () {
    var box = $("#ac-tour"), stage = $("#ac-tour-stage"), cap = $("#ac-tour-cap"), fill = $("#ac-tour-fill"), clock = $("#ac-tour-clock"), play = $("#ac-tour-play");
    if (!box || !stage || !enabled("craftTour") || Site.reducedMotion) return;
    var realm = ""; try { realm = (settings && settings.realmlist) || ""; } catch (e) {}
    realm = realm || "set realmlist (ask in Discord)";
    function typed(text, mask) { return el("span", { class: "ac-tour-type", "data-text": mask ? text.replace(/./g, "•") : text }); }
    function field(label, node) { return el("div", { class: "ac-tour-field" }, el("small", { text: label }), el("div", { class: "ac-tour-input" }, node)); }
    var SCENES = [
      { t: 15, cap: "1. Make your account: an email, a username and a password.", build: function () {
          return el("div", { class: "ac-tour-form" }, field("Email", typed("you@example.com")), field("Username", typed("Thrallfan")), field("Password", typed("hunter22", true)), el("span", { class: "ac-tour-btn", text: "Create account" })); } },
      { t: 15, cap: "2. Grab the AndersCraft client. It is handed out in Discord.", build: function () {
          return el("div", { class: "ac-tour-chat" }, el("p", { class: "ac-tour-msg", text: "Hi! Could I get the client?" }), el("p", { class: "ac-tour-msg ac-tour-msg--them", text: "Welcome! Here you go, unzip it anywhere." }), el("span", { class: "ac-tour-file", text: "AndersCraft client" })); } },
      { t: 15, cap: "3. Point the game at the server by setting the realmlist.", build: function () {
          return el("div", { class: "ac-tour-file2" }, el("small", { text: "Data\\enUS\\realmlist.wtf" }), el("code", {}, typed(realm))); } },
      { t: 15, cap: "4. Start AndersCraft.exe, log in, and you are in.", build: function () {
          return el("div", { class: "ac-tour-login" }, field("Account", typed("Thrallfan")), field("Password", typed("hunter22", true)), el("span", { class: "ac-tour-btn ac-tour-btn--go", text: "Enter World" })); } }
    ];
    var total = 60, SPEED = 5, at = 0, cur = -1, on = true, seen = false, last = 0, timers = [];   /* 60 "seconds" play in 12 real ones */
    function typeAll(node) {
      $all(".ac-tour-type", node).forEach(function (n, k) {
        var text = n.getAttribute("data-text"), i = 0;
        timers.push(setTimeout(function step() { if (i <= text.length) { n.textContent = text.slice(0, i++); timers.push(setTimeout(step, 38)); } }, 250 + k * 650));
      });
    }
    function show(i) {
      cur = i; timers.forEach(clearTimeout); timers = [];
      stage.textContent = ""; var node = SCENES[i].build(); node.classList.add("ac-tour-scene"); stage.appendChild(node);
      cap.textContent = SCENES[i].cap; typeAll(node);
    }
    function tick(now) {
      requestAnimationFrame(tick);
      var dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
      if (!on || !seen || document.hidden) return;
      at += dt * SPEED; if (at >= total + 6) at = 0;
      var shownAt = Math.min(at, total), acc = 0, idx = SCENES.length - 1;
      for (var i = 0; i < SCENES.length; i++) { acc += SCENES[i].t; if (shownAt < acc) { idx = i; break; } }
      if (idx !== cur) show(idx);
      fill.style.width = (100 * shownAt / total).toFixed(1) + "%";
      var sec = Math.floor(shownAt); clock.textContent = "0:" + (sec < 10 ? "0" : "") + (sec >= 60 ? "60" : sec); if (sec >= 60) clock.textContent = "1:00";
    }
    play.addEventListener("click", function () { on = !on; play.textContent = on ? "Pause" : "Play"; play.setAttribute("aria-pressed", String(on)); Site.sfx("toggle"); });
    box.hidden = false; show(0);
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { seen = es[0].isIntersecting; }, { threshold: 0.3 }).observe(box); else seen = true;
    requestAnimationFrame(tick);
  }, "ac-tour");

  /* ======================================================================
     AZEROTH LAYER (v3): achievements, realm charters, loot tooltips, the
     quest log, roll-a-hero, the XP bar and a counting stat band.
     ====================================================================== */
  var Ach = (function () {
    var KEY = "ac.ach", got = Site.store.get(KEY, {});
    if (!got || typeof got !== "object" || Array.isArray(got)) got = {};
    var DEFS = [
      { id: "scout", name: "Realm Scout", desc: "Read both realm charters.", pts: 10 },
      { id: "loot", name: "Loot Goblin", desc: "Inspect every custom feature.", pts: 10 },
      { id: "quests", name: "Quest Completionist", desc: "Turn in every quest in the quest log.", pts: 10 },
      { id: "alts", name: "Altoholic", desc: "Roll ten heroes.", pts: 5 },
      { id: "ding", name: "Ding!", desc: "Reach level 125 on the XP bar.", pts: 10 },
      { id: "signup", name: "Welcome to Azeroth", desc: "Create your AndersCraft account.", pts: 25 },
      { id: "murloc", name: "Mrgllglglgl!", desc: "Find the murloc hiding in the title.", pts: 5, hidden: true }
    ];
    var listeners = [], queue = [], showing = false;
    function def(id) { return DEFS.filter(function (d) { return d.id === id; })[0]; }
    function pop() {
      if (showing || !queue.length) return;
      showing = true;
      var d = queue.shift();
      var box = el("div", { class: "ac-ach", role: "status", "aria-live": "polite" },
        el("span", { class: "ac-ach-shield", "aria-hidden": "true", text: String(d.pts) }),
        el("span", null, el("span", { class: "ac-ach-k", text: "Achievement earned" }), el("span", { class: "ac-ach-n", text: d.name }), el("span", { class: "ac-ach-d", text: d.desc })));
      document.body.appendChild(box);
      try { if (box.showPopover) { box.setAttribute("popover", "manual"); box.showPopover(); } } catch (e) {}
      Site.sfx("win");
      requestAnimationFrame(function () { requestAnimationFrame(function () { box.classList.add("is-in"); }); });
      setTimeout(function () { box.classList.remove("is-in"); setTimeout(function () { box.remove(); showing = false; pop(); }, 480); }, 3800);
    }
    return {
      defs: DEFS, has: function (id) { return got[id] === true; },
      award: function (id) {
        var d = def(id); if (!d || got[id] === true) return;
        got[id] = true; Site.store.set(KEY, got);
        queue.push(d); pop();
        listeners.forEach(function (fn) { try { fn(); } catch (e) {} });
      },
      reset: function () { got = {}; Site.store.remove(KEY); listeners.forEach(function (fn) { try { fn(); } catch (e) {} }); },
      on: function (fn) { listeners.push(fn); }
    };
  })();

  function floatText(text, x, y) {
    if (Site.reducedMotion) return;
    var n = el("span", { class: "ac-float", "aria-hidden": "true", text: text, style: { left: x + "px", top: y + "px" } });
    document.body.appendChild(n); setTimeout(function () { n.remove(); }, 1500);
  }

  /* ---------- realm charters: the realm banners open a dialog with live numbers ---------- */
  Site.ready(function () {
    var dialogs = $all("dialog[data-ac-realm-dlg]"); if (!dialogs.length) return;
    var seen = Site.store.get("ac.realmsSeen", {}); if (!seen || typeof seen !== "object") seen = {};
    var ROMAN = { "1": "Realm I", "2": "Realm II" };

    function fmtUptime(sec) {
      if (!isNum(sec)) return null;
      var d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60);
      return d ? d + "d " + h + "h" : h ? h + "h " + m + "m" : m + "m";
    }
    function population(r) {
      if (!r || r.online === false) return ["offline", "Offline"];
      if (!isNum(r.players)) return ["", "Unknown"];
      var p = r.players;
      return p >= 30 ? ["full", "Full"] : p >= 15 ? ["high", "High"] : p >= 5 ? ["medium", "Medium"] : ["low", "Low"];
    }
    function setStat(dlg, key, value) {
      var n = $('[data-ac-stat="' + key + '"]', dlg); if (!n) return;
      var has = value != null && value !== "";
      n.textContent = has ? value : "—";
      n.classList.toggle("ac-dim", !has);
    }
    function fill(dlg, d) {
      var id = dlg.getAttribute("data-ac-realm-dlg");
      var r = d && Array.isArray(d.realms) ? d.realms.filter(function (x) { return x && String(x.id) === id; })[0] : null;
      var chip = $('[data-ac-stat="chip"]', dlg), state = $('[data-ac-stat="state"]', dlg);
      if (chip && state) {
        var known = r && typeof r.online === "boolean";
        chip.className = "sx-chip " + (!known ? "is-wait" : r.online ? "is-on" : "is-off");
        state.textContent = !known ? "The scrying orb is cloudy" : r.online ? "Online and accepting heroes" : "Offline. The realm sleeps";
      }
      var pop = population(r), popN = $('[data-ac-stat="pop"]', dlg);
      if (popN) { popN.textContent = pop[1]; if (pop[0]) popN.setAttribute("data-pop", pop[0]); else popN.removeAttribute("data-pop"); }
      var online = r && r.online === true;
      setStat(dlg, "players", online && isNum(r.players) ? Site.fmtNum(r.players) : null);
      setStat(dlg, "bots", online && isNum(r.bots) ? Site.fmtNum(r.bots) : null);
      var accounts = r && isNum(r.accounts) ? r.accounts : d && isNum(d.accounts) ? d.accounts : null;
      setStat(dlg, "accounts", accounts != null ? Site.fmtNum(accounts) : null);
      setStat(dlg, "characters", r && isNum(r.characters) ? Site.fmtNum(r.characters) : null);
      setStat(dlg, "peak", r && isNum(r.peak) ? Site.fmtNum(r.peak) : null);
      setStat(dlg, "uptime", online ? fmtUptime(r.uptime) : null);
      var kind = $(".ac-dlg-kind", dlg), name = r && typeof r.name === "string" ? r.name.trim().slice(0, 40) : "";
      if (kind) kind.textContent = (ROMAN[id] || "Realm") + (name ? " · " + name : "");
    }
    function refresh(dlg) { Site.live.realms().then(function (d) { fill(dlg, d); }, function () { fill(dlg, null); }); }

    var opener = null, timers = {};
    dialogs.forEach(function (dlg) {
      var id = dlg.getAttribute("data-ac-realm-dlg");
      var card = $('.ac-realm[data-ac-realm="' + id + '"]'), crest = card && $(".ac-realm-crest svg", card), slot = $(".ac-dlg-crest", dlg);
      if (crest && slot) slot.appendChild(crest.cloneNode(true));
      if (typeof dlg.showModal !== "function") return;
      dlg.addEventListener("click", function (e) {
        if (e.target === dlg) { dlg.close(); return; }                 /* a click on the backdrop */
        var c = e.target.closest("[data-ac-close]"); if (!c) return;
        var pick = c.getAttribute("data-ac-pick");
        if (pick) Site.toast((pick === "2" ? "Andersian Hardcore" : "The main realm") + " it is. One account opens both realms.", { type: "ok", ms: 3600 });
        dlg.close();
      });
      dlg.addEventListener("close", function () {
        clearInterval(timers[id]); Site.sfx("close");
        if (opener && document.contains(opener) && !location.hash.match(/^#ac-signup$/)) opener.focus();
      });
    });
    function open(dlg, from) {
      var id = dlg.getAttribute("data-ac-realm-dlg");
      opener = from || null;
      fill(dlg, null); refresh(dlg);
      clearInterval(timers[id]); timers[id] = setInterval(function () { if (!document.hidden) refresh(dlg); }, 30000);
      dlg.showModal(); Site.sfx("open");
      seen[id] = true; Site.store.set("ac.realmsSeen", seen);
      if (seen["1"] && seen["2"]) Ach.award("scout");
    }
    $all("[data-ac-open]").forEach(function (b) {
      var dlg = document.getElementById(b.getAttribute("data-ac-open"));
      if (!dlg || typeof dlg.showModal !== "function") { b.hidden = true; return; }
      b.addEventListener("click", function () { open(dlg, b); });
    });
    /* a click anywhere on the banner counts, except on links inside it */
    $all(".ac-realm[data-ac-realm]").forEach(function (card) {
      card.addEventListener("click", function (e) {
        if (e.target.closest("a,button")) return;
        var b = $("[data-ac-open]", card); if (b && !b.hidden) b.click();
      });
    });
    /* deep links: /anderscraft/#realm-1 or #realm-2 open the charter */
    var m = /^#realm-([12])$/.exec(location.hash || "");
    if (m) { var d0 = document.getElementById("ac-dlg-" + m[1]); if (d0 && typeof d0.showModal === "function") setTimeout(function () { open(d0, null); }, 400); }
  }, "ac-realm-dialogs");

  /* ---------- feature tiles: item tooltips, like inspecting loot ---------- */
  Site.ready(function () {
    var tiles = $all(".ac-tile[data-ac-q]"); if (!tiles.length) return;
    var KEY = "ac.lootSeen", seen = Site.store.get(KEY, {}); if (!seen || typeof seen !== "object") seen = {};
    var tip = el("div", { class: "ac-tip", role: "tooltip", id: "ac-tip" }); document.body.appendChild(tip);
    var current = null, hideT = 0;
    var BIND = { uncommon: "Binds when equipped", rare: "Binds when picked up", epic: "Binds to account", legendary: "Unique · Binds to soul" };
    function key(t) { return ($("b", t) || t).textContent.trim(); }
    function place(t) {
      var r = t.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
      var x = r.right + 10, y = r.top;
      if (x + w > vw - 8) { x = Math.max(8, Math.min(vw - w - 8, r.left)); y = r.bottom + 8; if (y + h > vh - 20) y = r.top - h - 8; }
      if (y + h > vh - 20) y = vh - h - 20; if (y < 8) y = 8;
      tip.style.left = Math.round(x) + "px"; tip.style.top = Math.round(y) + "px";
    }
    function show(t) {
      clearTimeout(hideT);
      if (current && current !== t) current.classList.remove("ac-tip-on");
      current = t; t.classList.add("ac-tip-on");
      var q = t.getAttribute("data-ac-q"), name = key(t), body = ($("span", t) || {}).textContent || "", flavor = t.getAttribute("data-ac-flavor");
      tip.textContent = "";
      tip.appendChild(el("b", { text: name, style: { color: "var(--q-" + q + ")" } }));
      tip.appendChild(el("i", { class: "t-bind", text: BIND[q] || "Soulbound" }));
      tip.appendChild(el("i", { class: "t-q", text: q + " server feature" }));
      tip.appendChild(el("i", { class: "t-use", text: "Equip: " + body }));
      if (flavor) tip.appendChild(el("i", { class: "t-flavor", text: "“" + flavor + "”" }));
      tip.classList.add("is-on"); place(t);
      if (!seen[name]) {
        seen[name] = true; Site.store.set(KEY, seen); t.classList.add("ac-seen");
        if (tiles.every(function (x) { return seen[key(x)]; })) Ach.award("loot");
      }
    }
    function hide() { hideT = setTimeout(function () { tip.classList.remove("is-on"); if (current) current.classList.remove("ac-tip-on"); current = null; }, 60); }
    tiles.forEach(function (t) {
      t.setAttribute("tabindex", "0"); t.setAttribute("aria-describedby", "ac-tip");
      if (seen[key(t)]) t.classList.add("ac-seen");
      t.addEventListener("mouseenter", function () { show(t); });
      t.addEventListener("mouseleave", hide);
      t.addEventListener("focus", function () { show(t); });
      t.addEventListener("blur", hide);
      t.addEventListener("click", function () { if (current === t && tip.classList.contains("is-on")) hide(); else { show(t); Site.sfx("tap"); } });
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && current) hide(); });
    window.addEventListener("scroll", function () { if (current) hide(); }, { passive: true });
  }, "ac-loot-tips");

  /* ---------- quest log: every rules / FAQ entry is a quest to turn in ---------- */
  Site.ready(function () {
    var qs = $all("#ac-rules .ac-q, #ac-faq .ac-q"); if (!qs.length) return;
    var KEY = "ac.questsRead", read = Site.store.get(KEY, {}); if (!read || typeof read !== "object") read = {};
    function k(q) { var s = $("summary", q); return s ? s.textContent.trim().slice(0, 60) : ""; }
    qs.forEach(function (q) {
      if (read[k(q)]) q.classList.add("ac-read");
      q.addEventListener("toggle", function () {
        if (!q.open) return;
        Site.sfx("open");
        if (read[k(q)]) return;
        read[k(q)] = true; Site.store.set(KEY, read); q.classList.add("ac-read");
        var s = $("summary", q), r = s && s.getBoundingClientRect();
        if (r) floatText("Quest complete", r.left + 120, r.top);
        if (qs.every(function (x) { return read[k(x)]; })) Ach.award("quests");
      });
    });
  }, "ac-quest-log");

  /* ---------- roll a hero: any race, any class, any regrettable title ---------- */
  Site.ready(function () {
    var box = $("#ac-roll"), btn = $("#ac-roll-btn"), nameN = $("#ac-roll-name"), lineN = $("#ac-roll-line"); if (!box || !btn) return;
    var RACES = ["Human", "Dwarf", "Night Elf", "Gnome", "Draenei", "Worgen", "Orc", "Undead", "Tauren", "Troll", "Blood Elf", "Goblin"];
    var CLASSES = ["Warrior", "Paladin", "Hunter", "Rogue", "Priest", "Death Knight", "Shaman", "Mage", "Warlock", "Druid"];
    var A = ["Grim", "Thrag", "Mor", "Bel", "Zul", "Gor", "Fen", "Kael", "Bram", "Vol", "Ur", "Snik", "Mog", "Dra", "Thal", "Grub", "Ash", "Vex"];
    var B = ["dak", "thas", "gul", "wick", "nar", "rok", "iel", "zz", "ble", "goth", "ius", "mo", "fang", "drin", "bottom", "ra"];
    var TITLES = ["the Unkillable (Probably)", "Slayer of Several Boars", "the Mildly Feared", "Bane of Kobolds", "Who Pulled Too Much", "the Twice Resurrected",
      "Keeper of the Spare Hearthstone", "the Unbound", "Champion of Goldshire", "the Very Serious", "of the Ashen Ledger", "Dread Lord of the Bank Alt",
      "the Patient, Eventually", "Scourge of the Auction House", "Who Stood in the Fire", "the Last Light of Westfall", "the Grim", "Herald of Questionable Gear"];
    var rolls = 0, busy = false;
    function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
    function hero() {
      var lvl = 1 + Math.floor(Math.random() * 125);
      return { name: pick(A) + pick(B) + " " + pick(TITLES), line: "Level " + lvl + " " + pick(RACES) + " " + pick(CLASSES),
        q: lvl >= 120 ? "legendary" : lvl >= 80 ? "epic" : lvl >= 40 ? "rare" : "uncommon" };
    }
    function paint(h) { nameN.textContent = h.name; lineN.textContent = h.line; nameN.style.color = "var(--q-" + h.q + ")"; }
    btn.addEventListener("click", function () {
      if (busy) return; busy = true;
      var card = $(".ac-roll-card", box), n = Site.reducedMotion ? 0 : 7;
      card.classList.add("is-rolling");
      (function spin() {
        paint(hero()); Site.sfx("tap");
        if (n-- > 0) return setTimeout(spin, 70);
        card.classList.remove("is-rolling"); busy = false;
        rolls++; Site.store.set("ac.rolls", (Site.store.get("ac.rolls", 0) || 0) + 1);
        var r = btn.getBoundingClientRect(); floatText("+1 Alt", r.left + r.width / 2, r.top - 6);
        if ((Site.store.get("ac.rolls", 0) || 0) >= 10) Ach.award("alts");
      })();
    });
    paint(hero()); box.hidden = false;
  }, "ac-roll");

  /* ---------- the murloc in the title (click it five times) ---------- */
  Site.ready(function () {
    var h1 = $(".ac-hero h1"); if (!h1) return;
    var clicks = 0, t = 0;
    h1.addEventListener("click", function (e) {
      clicks++; clearTimeout(t); t = setTimeout(function () { clicks = 0; }, 1600);
      if (clicks < 5) return;
      clicks = 0;
      floatText(pick(["Mrgllglglgl!", "Aaaaughibbrgubugbugrguburgle!", "Mrrrggk!"]), e.clientX, e.clientY - 10);
      Site.sfx("success"); Ach.award("murloc");
    });
    function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  }, "ac-murloc");

  /* ---------- XP bar: scrolling the page levels you up to 125 ---------- */
  Site.ready(function () {
    if (!enabled("acXpBar")) return;
    var fill = el("i", { class: "ac-xp-fill" }), label = el("span", { class: "ac-xp-t" });
    var bar = el("div", { class: "ac-xp", "aria-hidden": "true", title: "Experience: earned by reading. Very realistic." }, fill, label);
    document.body.appendChild(bar); document.body.classList.add("ac-has-xp");
    var lastLvl = 0, raf = 0, dinged = false;
    function paint() {
      raf = 0;
      var max = document.documentElement.scrollHeight - window.innerHeight, p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 1;
      var lvl = p >= 0.995 ? 125 : 1 + Math.floor(p * 124);
      fill.style.width = (p * 100).toFixed(2) + "%";
      if (lvl !== lastLvl) {
        label.textContent = lvl >= 125 ? "Level 125 · Ding! Max level" : "Level " + lvl + " · " + Math.round(p * 100) + "% to 125";
        bar.classList.toggle("is-ding", lvl >= 125);
        if (lvl >= 125 && !dinged && lastLvl) { dinged = true; Ach.award("ding"); }
        lastLvl = lvl;
      }
    }
    window.addEventListener("scroll", function () { if (!raf) raf = requestAnimationFrame(paint); }, { passive: true });
    window.addEventListener("resize", function () { if (!raf) raf = requestAnimationFrame(paint); });
    paint();
  }, "ac-xp");

  /* ---------- stat band: the numbers count up when they come into view ---------- */
  Site.ready(function () {
    if (Site.reducedMotion || !("IntersectionObserver" in window)) return;
    var nums = $all(".ac-statband .ac-stat b").filter(function (b) { return /^\d+$/.test(b.textContent.trim()); }); if (!nums.length) return;
    nums.forEach(function (b) { b.setAttribute("data-ac-to", b.textContent.trim()); });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return; io.unobserve(e.target);
        var b = e.target, to = parseInt(b.getAttribute("data-ac-to"), 10), t0 = 0;
        (function step(now) {
          if (!t0) t0 = now; var k = Math.min(1, (now - t0) / 1100), v = Math.round(to * (1 - Math.pow(1 - k, 3)));
          b.textContent = String(v); if (k < 1) requestAnimationFrame(step);
        })(performance.now());
      });
    }, { threshold: 0.6 });
    nums.forEach(function (b) { io.observe(b); });
  }, "ac-countup");

  /* ---------- account created: the big one ---------- */
  Site.ready(function () {
    var msg = $("#msg"); if (!msg || !("MutationObserver" in window)) return;
    new MutationObserver(function () { if (msg.classList.contains("ok")) Ach.award("signup"); })
      .observe(msg, { attributes: true, attributeFilter: ["class"] });
  }, "ac-ach-signup");

  /* ---------- achievements panel ---------- */
  Site.ready(function () {
    var section = $("#ac-feats"), list = $("#ac-feats-list"), count = $("#ac-feats-count"); if (!section || !list) return;
    function paint() {
      list.textContent = "";
      var n = 0, pts = 0;
      Ach.defs.forEach(function (d) {
        var got = Ach.has(d.id); if (got) { n++; pts += d.pts; }
        list.appendChild(el("li", { class: "ac-feat" + (got ? " is-got" : "") },
          el("span", { class: "ac-ach-shield", "aria-hidden": "true", text: String(d.pts) }),
          el("div", null, el("b", { text: !got && d.hidden ? "Hidden achievement" : d.name }),
            el("span", { text: !got && d.hidden ? "Some deeds are found, not followed." : d.desc }),
            el("span", { class: "sx-sr", text: got ? "Earned." : "Not earned yet." }))));
      });
      if (count) count.textContent = n + " of " + Ach.defs.length + " earned · " + pts + " points.";
    }
    Ach.on(paint); paint(); section.hidden = false;
  }, "ac-ach-panel");

  /* ---------- Down states: the Under Maintenance banner + caution tape under each service that is down ----------
     Realms: down when status.php says online:false, or status.php can't be reached at all (the PC, tunnel or
     service is off, so the realms are off too). Sign-ups: down when register.php doesn't answer.
     The checks here bypass the shared caches and give up after 4.5 s, so a dead tunnel shows within seconds.
     The last result is remembered for 10 minutes, so a reload shows the tape at once and then confirms it.
     An unreachable endpoint is retried once after 3 s before it counts, so one network hiccup never flashes it.
     Test: ?sx=status:down (realms down), ?sx=signup:down (sign-ups down), ?sx=status:demo (demo, online). */
  Site.ready(function () {
    if (!enabled("acMaintenance")) return;
    var banner = $("#ac-maint");
    var cfgA = (Site.config && Site.config.anderscraft) || {};
    var statusUrl = cfgA.statusUrl || "";
    var signupUrl = ""; try { signupUrl = (settings && settings.apiUrl) || cfgA.apiUrl || ""; } catch (e) {}
    var dStatus = Site.debug("status"), dSignup = Site.debug("signup");
    var KEY = "ac.downState", TIMEOUT = 4500, EVERY = 30000;
    var HDR = { "ngrok-skip-browser-warning": "1" };

    /* one strip of tape per service, added along the bottom edge of its section */
    function tape(host, text) {
      if (!host) return null;
      var unit = text + " ◆ Caution ◆ ", half = new Array(9).join(unit);
      var t = el("div", { class: "ac-svc-tape", role: "status", hidden: true },
        el("span", { class: "sx-sr", text: text + "." }),
        el("span", { class: "ac-svc-tape-run", "aria-hidden": "true" }, el("span", { text: half }), el("span", { text: half })));
      host.appendChild(t); host.classList.add("ac-has-tape");
      return t;
    }
    var tapes = {
      signup: tape($("#ac-signup"), "Sign-ups are down"),
      r1: tape($('.ac-realm[data-ac-realm="1"]'), "Realm offline"),
      r2: tape($('.ac-realm[data-ac-realm="2"]'), "Realm offline")
    };

    var state = { r1: null, r2: null, signup: null };   /* true = down, false = up, null = unknown */
    function paint(fresh) {
      var realmsDown = state.r1 === true && state.r2 === true;
      if (banner) { var was = !banner.hidden; banner.hidden = !realmsDown; if (realmsDown && !was && fresh) Site.sfx("error"); }
      ["r1", "r2", "signup"].forEach(function (k) {
        var t = tapes[k]; if (!t) return;
        t.hidden = state[k] !== true;
        if (t.parentNode) t.parentNode.classList.toggle("ac-is-down", state[k] === true);
      });
    }
    /* instant: last known result from this browser, if recent */
    try {
      var last = Site.store.get(KEY, null);
      if (last && typeof last === "object" && Date.now() - (last.t || 0) < 600000) {
        ["r1", "r2", "signup"].forEach(function (k) { if (typeof last[k] === "boolean") state[k] = last[k]; });
        paint(false);
      }
    } catch (e) {}
    function save() { Site.store.set(KEY, { t: Date.now(), r1: state.r1, r2: state.r2, signup: state.signup }); }

    function get(url) {
      var ctl = window.AbortController ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, TIMEOUT);
      return fetch(url, { method: "GET", headers: HDR, cache: "no-store", signal: ctl ? ctl.signal : undefined })
        .then(function (r) { clearTimeout(to); return r; }, function (e) { clearTimeout(to); throw e; });
    }
    /* {r1, r2} as booleans (down), or null when the endpoint itself failed */
    function checkRealms() {
      if (dStatus === "down") return Promise.resolve({ r1: true, r2: true });
      if (dStatus === "demo") return Site.live.realms().then(read);
      if (!statusUrl) return Promise.resolve("skip");
      return get(statusUrl).then(function (r) { return r.ok ? r.json() : null; }).then(read, function () { return null; });
      function read(d) {
        if (!d || d.ok === false || !Array.isArray(d.realms)) return null;
        var out = {};
        d.realms.forEach(function (x) { if (x && typeof x.online === "boolean" && (String(x.id) === "1" || String(x.id) === "2")) out["r" + x.id] = !x.online; });
        return ("r1" in out || "r2" in out) ? out : null;
      }
    }
    /* true (down), false (up), or null when unsure */
    function checkSignup() {
      if (dSignup) return Promise.resolve(dSignup !== "up");
      if (!signupUrl) return Promise.resolve("skip");
      /* the service answers a plain GET with "405 Use POST"; a dead tunnel errors or returns ngrok's own error page */
      return get(signupUrl).then(function (r) { return !(r.status === 405 || r.ok); }, function () { return null; });
    }

    var timer = 0, busy = false, misses = { realms: 0, signup: 0 };
    function next(ms) { clearTimeout(timer); timer = 0; if (!document.hidden) timer = setTimeout(run, ms); }
    function run() {
      if (busy || document.hidden) return; busy = true;
      Promise.all([checkRealms(), checkSignup()]).then(function (res) {
        busy = false;
        var realms = res[0], signup = res[1], retry = false;
        if (realms !== "skip") {
          if (realms) { misses.realms = 0; if (typeof realms.r1 === "boolean") state.r1 = realms.r1; if (typeof realms.r2 === "boolean") state.r2 = realms.r2; }
          else if (++misses.realms >= 2) { state.r1 = true; state.r2 = true; }      /* unreachable twice: the PC is off, so the realms are too */
          else retry = true;
        }
        if (signup !== "skip") {
          if (signup === null) { if (++misses.signup >= 2) state.signup = true; else retry = true; }
          else { misses.signup = 0; state.signup = signup; }
        }
        paint(true); save();
        next(retry ? 3000 : EVERY);
      });
    }
    document.addEventListener("visibilitychange", function () { if (document.hidden) { clearTimeout(timer); timer = 0; } else run(); });
    run();
  }, "ac-maintenance");
})();
