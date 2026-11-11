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
    var TEXT = { wait: "Checking", up: "Sign-ups open", down: "Sign-up server offline" };
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
          /* its "offline" message means the request itself failed, so the service is off right now */
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
      var v = pw.value, n = v.length, level = 0;
      if (!n) sayPw("", null);
      else if (/\s/.test(v)) { level = 1; sayPw("No spaces", "err", "Passwords can't have spaces"); }
      else if (/[^\x21-\x7E]/.test(v)) { level = 1; sayPw("Plain characters only", "err", "Use plain letters, numbers and symbols only"); }
      else if (n < 6) { level = 1; sayPw("Too short · " + n + " / 6", "err", "Too short, " + n + " of at least 6 characters"); }
      else if (n > 16) { level = 1; sayPw("Too long", "err", "Too long, 16 characters is the limit"); }
      else {
        var kinds = (/[a-z]/.test(v) ? 1 : 0) + (/[A-Z]/.test(v) ? 1 : 0) + (/[0-9]/.test(v) ? 1 : 0) + (/[^A-Za-z0-9]/.test(v) ? 1 : 0);
        if ((n >= 12 && kinds >= 3) || (n >= 10 && kinds === 4)) { level = 4; sayPw("Strong", "ok", "Password strength: strong"); }
        else if ((n >= 8 && kinds >= 2) || kinds >= 3) { level = 3; sayPw("Good", "ok", "Password strength: good"); }
        else { level = 2; sayPw("Fine", "warn", "Password strength: fine"); }
      }
      if (meter) meter.setAttribute("data-ac-level", String(level));
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
})();
