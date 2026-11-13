/* Trophy Cabinet (/trophies/): a full-page view of every trophy, earned or not.
 * Reads the same per-browser store play.js writes (Site.store "trophies" = { id: timestamp }).
 * The CATALOG below MIRRORS the TROPHIES list in assets/play.js — keep the two in sync when trophies change.
 * (Kept separate on purpose so this page needs no sitewide interact.js cache bump to render.)
 */
(function () {
  "use strict";
  if (!window.Site) return;
  var S = Site;

  var CATALOG = [
    { id: "hello", name: "Player One", desc: "Showed up. That's the first step." },
    { id: "explorer", name: "Cartographer", desc: "Visited the hub, AndersCraft, AnyPS, the ratings and the résumé." },
    { id: "theme", name: "Night Shift", desc: "Flipped between the dark and light themes." },
    { id: "settings", name: "Tinkerer", desc: "Opened the settings panel." },
    { id: "bottom", name: "Rock Bottom", desc: "Scrolled a page all the way down." },
    { id: "share", name: "Word of Mouth", desc: "Used the share button." },
    { id: "dj", name: "Sea Breeze", desc: "Turned on the soundscape." },
    { id: "hire", name: "Headhunter", desc: "Opened the 'work with me' box." },
    { id: "card", name: "Due Diligence", desc: "Opened a project card on the résumé." },
    { id: "lost", name: "Off the Map", desc: "Found the 404 page.", secret: true },
    { id: "door", name: "Knock Knock", desc: "Found the hidden door.", secret: true },
    { id: "key", name: "Keymaster", desc: "Got through the hidden door.", secret: true },
    { id: "konami", name: "Old School", desc: "Entered a very famous cheat code.", secret: true },
    { id: "australia", name: "Down Under", desc: "Turned the whole site upside down.", secret: true },
    { id: "codes", name: "Codebreaker", desc: "Discovered three different secret words.", secret: true },
    { id: "combo", name: "Button Masher", desc: "Pulled off the controller combo.", secret: true },
    { id: "sailor", name: "Old Salt", desc: "Scored 300 or more in the boat game on the lost page.", secret: true },
    { id: "boat1k", name: "Steady Hand", desc: "Scored 1,000 or more in the boat game on the lost page.", secret: true },
    { id: "boat5k", name: "Master Mariner", desc: "Scored 5,000 or more in the boat game on the lost page.", secret: true },
    { id: "rs-easy", name: "First Stamp", desc: "Beat Easy in the Review Score game.", secret: true },
    { id: "rs-medium", name: "Getting Critical", desc: "Beat Medium in the Review Score game.", secret: true },
    { id: "rs-hard", name: "Tough Critic", desc: "Beat Hard in the Review Score game.", secret: true },
    { id: "rs-harder", name: "Harsh Reviewer", desc: "Beat Harder ;) in the Review Score game.", secret: true },
    { id: "rs-harderer", name: "Ruthless", desc: "Beat the hidden Harder…er in the Review Score game.", secret: true },
    { id: "menu", name: "Navigator", desc: "Opened the page menu." },
    { id: "deepcuts", name: "Deep Cuts", desc: "Visited Links I Like, the stream page, Uses and What's New." },
    { id: "forum", name: "Town Square", desc: "Dropped by the Rate-O-Pedia forums." },
    { id: "linkout", name: "Link Hopper", desc: "Visited a site from Links I Like." },
    { id: "voter", name: "Have Your Say", desc: "Voted on a site in Links I Like." },
    { id: "classic", name: "Lighthouse Keeper", desc: "Switched the site to its Classic skin." },
    { id: "seasons", name: "Four Seasons", desc: "Tried the fall, winter, spring and summer skins." },
    { id: "access", name: "Easy Reader", desc: "Tried an accessibility option." },
    { id: "shortcuts", name: "Shortcut Artist", desc: "Opened the keyboard shortcut map." },
    { id: "room", name: "Window Shopper", desc: "Looked through the trophy list." },
    { id: "regular", name: "Regular", desc: "Came back on three different days." },
    { id: "streak", name: "On a Roll", desc: "Came back three days in a row.", secret: true },
    { id: "miss5", name: "Unfivetunately", desc: "Typed five wrong codes into the hidden door.", secret: true },
    { id: "nightowl", name: "Night Owl", desc: "Visited between midnight and four in the morning.", secret: true },
    { id: "all", name: "Completionist", desc: "Earned every other trophy." },
    { id: "special", name: "Super Duper Special", desc: "Reserved for the people Anders has made an Admin in Discord.", special: true }
  ];

  function tierOf(t) {
    if (t.special) return "special";
    if (t.id === "all") return "platinum";
    if (t.secret) return "rare";
    return "common";
  }
  var TIER_LABEL = { common: "Common", rare: "Secret", platinum: "Platinum", special: "Special" };

  var CUP = '<path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 5.5H5.2a2.6 2.6 0 0 0 2.9 3.6M16 5.5h2.8a2.6 2.6 0 0 1-2.9 3.6M12 13v3.5M8.5 20h7M9.5 20c0-2 1-3.5 2.5-3.5s2.5 1.5 2.5 3.5"/>';
  var LOCK = '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>';
  var QMARK = '<path d="M9.2 9a2.8 2.8 0 1 1 3.8 2.6c-.8.4-1.5 1-1.5 2v.6"/><circle cx="11.5" cy="17.5" r="1.1" fill="currentColor" stroke="none"/>';

  function fmtDate(ts) {
    try { return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
    catch (e) { return ""; }
  }

  S.ready(function () {
    var progEl = document.getElementById("tr-prog"),
        filtEl = document.getElementById("tr-filters"),
        grid = document.getElementById("tr-grid");
    if (!grid) return;
    var got = S.store.get("trophies", {}) || {};
    var core = CATALOG.filter(function (t) { return !t.special; });
    var earnedCore = core.filter(function (t) { return got[t.id]; }).length;
    var pct = Math.round(earnedCore / core.length * 100);

    /* progress ring */
    if (progEl) {
      var R = 52, C = 2 * Math.PI * R, off = C * (1 - earnedCore / core.length);
      progEl.appendChild(S.el("div", { class: "tr-ring" },
        S.svg('<circle cx="60" cy="60" r="' + R + '" class="tr-ring-bg"/>' +
              '<circle cx="60" cy="60" r="' + R + '" class="tr-ring-fg" pathLength="' + C.toFixed(1) + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/>',
              { viewBox: "0 0 120 120", class: "tr-ring-svg", "stroke-width": "9" }),
        S.el("div", { class: "tr-ring-c" }, S.el("b", { text: earnedCore + "/" + core.length }), S.el("span", { text: pct + "%" }))));
      progEl.appendChild(S.el("div", { class: "tr-prog-txt" },
        S.el("b", { text: earnedCore === core.length ? "Completionist!" : "Keep collecting" }),
        S.el("span", { text: earnedCore === core.length ? "You've earned every trophy on the site." : (core.length - earnedCore) + " still to find · saved in this browser only" })));
    }

    /* filter tabs */
    var state = { filter: "all" };
    var FILTERS = [["all", "All"], ["earned", "Earned"], ["locked", "Locked"], ["secret", "Secret"]];
    var tabs = {};
    FILTERS.forEach(function (f) {
      var b = S.el("button", { class: "tr-tab" + (f[0] === "all" ? " is-on" : ""), type: "button", role: "tab",
        "aria-selected": f[0] === "all" ? "true" : "false",
        onclick: function () { state.filter = f[0]; for (var k in tabs) { tabs[k].classList.toggle("is-on", k === f[0]); tabs[k].setAttribute("aria-selected", k === f[0] ? "true" : "false"); } draw(); } },
        S.el("span", { text: f[1] }));
      tabs[f[0]] = b; if (filtEl) filtEl.appendChild(b);
    });

    function card(t) {
      var have = !!got[t.id], tier = tierOf(t), hiddenSecret = t.secret && !have;
      var icoInner = have ? CUP : (t.secret ? QMARK : LOCK);
      var name = hiddenSecret ? "Secret trophy" : t.name;
      var desc = hiddenSecret ? "Keep exploring to reveal this one." : t.desc;
      var c = S.el("article", { class: "tr-card tr-" + tier + (have ? " is-got" : " is-locked"), dataset: { tier: tier, got: have ? "1" : "0", secret: t.secret ? "1" : "0" } },
        S.el("span", { class: "tr-ico" }, S.svg(icoInner)),
        S.el("div", { class: "tr-body" },
          S.el("h2", { class: "tr-name", text: name }),
          S.el("p", { class: "tr-desc", text: desc }),
          S.el("div", { class: "tr-foot" },
            S.el("span", { class: "tr-tier", text: TIER_LABEL[tier] }),
            have ? S.el("span", { class: "tr-date", text: "Earned " + fmtDate(got[t.id]) }) : S.el("span", { class: "tr-date tr-date--locked", text: "Locked" }))));
      return c;
    }

    function draw() {
      grid.textContent = "";
      var list = CATALOG.filter(function (t) {
        var have = !!got[t.id];
        if (state.filter === "earned") return have;
        if (state.filter === "locked") return !have;
        if (state.filter === "secret") return !!t.secret;
        return true;
      });
      if (!list.length) { grid.appendChild(S.el("div", { class: "tr-empty", text: "Nothing here yet." })); return; }
      list.forEach(function (t) { grid.appendChild(card(t)); });
    }
    draw();

    /* opening the cabinet counts as "looked through the trophy list" */
    if (S.trophy) setTimeout(function () { S.trophy("room"); }, 900);
  }, "trophy cabinet");
})();
