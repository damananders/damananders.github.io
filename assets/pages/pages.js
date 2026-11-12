/* pages/pages.js — behaviour for the small standalone pages: /changelog/, /uses/, /stream/, /dash/. Prefix pg-. */
(function () {
  "use strict";
  if (!window.Site) return;
  var Site = window.Site, el = Site.el, doc = document, cfg = Site.config || {};
  function $(id) { return doc.getElementById(id); }
  function safeUrl(u) { u = String(u || ""); return /^(\/(?!\/)|https:\/\/)/.test(u) ? u : ""; }

  /* ====================================== /changelog/ ====================================== */
  if (Site.page === "changelog") Site.ready(function () {
    var box = $("pg-log"), bar = $("pg-filter"); if (!box || !bar) return;
    var TAGS = { all: "Everything", site: "Site", anyps: "AnyPS", anderscraft: "AndersCraft", games: "Ratings" };
    var VAULT = /personal vault|my vault|the vault/i, pick = "all", items = [];
    try { var h = location.hash.slice(1); if (TAGS[h]) pick = h; } catch (e) {}
    function draw() {
      box.textContent = "";
      var rows = items.filter(function (n) { return pick === "all" || n.tag === pick; }), map = {}, groups = [];
      if (!rows.length) { box.appendChild(el("p", { class: "pg-empty", text: "Nothing here yet." })); return; }
      rows.forEach(function (n) { var k = n.date ? String(n.date).slice(0, 10) : ""; if (!map[k]) { map[k] = { k: k, rows: [] }; groups.push(map[k]); } map[k].rows.push(n); });
      groups.forEach(function (g) {
        var ul = el("ul", { class: "pg-log__list" });
        g.rows.forEach(function (n) {
          var url = safeUrl(n.url), tag = TAGS[n.tag] ? n.tag : "site";
          ul.appendChild(el("li", { class: "pg-log__row pg-tag--" + tag },
            el("span", { class: "pg-pill", text: TAGS[tag] }),
            el("div", {}, url ? el("a", { class: "pg-log__title", href: url, text: n.title }) : el("span", { class: "pg-log__title", text: n.title }),
              n.body ? el("p", { class: "pg-log__body", text: String(n.body) }) : null)));
        });
        box.appendChild(el("section", { class: "pg-log__day" }, el("h2", { class: "pg-log__date" }, g.k ? el("time", { datetime: g.k, text: Site.fmtDate(g.k) }) : "Recently"), ul));
      });
    }
    Object.keys(TAGS).forEach(function (k) {
      var b = el("button", { type: "button", class: "pg-chip", "aria-pressed": String(k === pick), text: TAGS[k] });
      b.addEventListener("click", function () {
        pick = k; Array.prototype.forEach.call(bar.children, function (c) { c.setAttribute("aria-pressed", String(c === b)); });
        try { history.replaceState(null, "", k === "all" ? location.pathname : "#" + k); } catch (e) {}
        Site.sfx("toggle"); draw();
      });
      bar.appendChild(b);
    });
    Site.news().then(function (all) {
      items = (all || []).filter(function (n) { return n.tag !== "vault" && !(Site.owner ? false : VAULT.test(n.title + " " + (n.body || ""))); });
      draw();
    });
  }, "changelog");

  /* ====================================== /stream/ ====================================== */
  if (Site.page === "stream") Site.ready(function () {
    var stage = $("pg-stage"), off = $("pg-off"), lead = $("pg-stream-lead"); if (!stage || !off) return;
    var channel = (cfg.twitch && cfg.twitch.channel) || "", shown = false;
    var tw = $("pg-tw"); if (tw && channel) tw.href = "https://www.twitch.tv/" + encodeURIComponent(channel);
    function host() { return location.hostname || "damananders.github.io"; }
    function show(s) {
      if (shown) return; shown = true;
      var base = "parent=" + encodeURIComponent(host());
      stage.textContent = "";
      stage.appendChild(el("div", { class: "pg-player" }, el("iframe", { src: "https://player.twitch.tv/?channel=" + encodeURIComponent(channel) + "&" + base + "&muted=true", title: "Live stream", allowfullscreen: "", allow: "autoplay; fullscreen" })));
      stage.appendChild(el("div", { class: "pg-chat" }, el("iframe", { src: "https://www.twitch.tv/embed/" + encodeURIComponent(channel) + "/chat?" + base + "&darkpopout", title: "Stream chat" })));
      stage.hidden = false; off.hidden = true;
      if (lead) lead.textContent = s && s.uptime ? "Live now, on air for " + s.uptime + "." : "Live now.";
      Site.sfx("success");
    }
    function hide() {
      if (shown) { stage.textContent = ""; shown = false; }
      stage.hidden = true; off.hidden = false;
      if (lead) lead.textContent = "The stream is off at the moment.";
    }
    function check() {
      if (!channel || !Site.live || !Site.live.twitch) { hide(); return; }
      Site.live.twitch().then(function (s) { if (s && s.live) show(s); else hide(); }).catch(hide);
    }
    check();
    setInterval(function () { if (!doc.hidden) check(); }, 125000);
  }, "stream");

  /* ====================================== /dash/ (owner only) ====================================== */
  if (Site.page === "dash") Site.ready(function () {
    var grid = $("pg-dash"), nope = $("pg-nope"); if (!grid || !nope) return;
    if (!Site.owner) { nope.hidden = false; var l = $("pg-dash-lead"); if (l) l.textContent = ""; return; }
    grid.hidden = false;
    function tile(title, href) {
      var val = el("strong", { class: "pg-tile__val", text: "…" }), sub = el("span", { class: "pg-tile__sub" });
      var t = el(href ? "a" : "div", href ? { class: "pg-tile", href: href } : { class: "pg-tile" }, el("small", { text: title }), val, sub);
      grid.appendChild(t);
      return { set: function (v, s, state) { val.textContent = v; sub.textContent = s || ""; t.setAttribute("data-state", state || ""); } };
    }
    var tTw = tile("Twitch", "/stream/"), tDc = tile("Discord", (window.SITE && SITE.discord) || null), tSign = tile("AndersCraft sign-ups", "/anderscraft/"),
      tRealm = tile("AndersCraft realms", "/anderscraft/"), tAny = tile("AnyPS", "/anyps/"), tDl = tile("AnyPS downloads", "/anyps/"),
      tKo = tile("Ko-fi goal", cfg.kofi && cfg.kofi.url), tUp = tile("Site last updated", "/changelog/"), tNews = tile("Latest update", "/changelog/"), tTro = tile("Your trophies");
    function load() {
      Site.live.twitch().then(function (s) { if (!s) tTw.set("Unknown", "The lookup did not answer."); else tTw.set(s.live ? "Live" : "Offline", s.live && s.uptime ? "On air for " + s.uptime : "", s.live ? "ok" : ""); });
      Site.live.discord().then(function (s) { if (!s) tDc.set("Unknown", "The lookup did not answer."); else tDc.set(Site.fmtNum(s.members) + " members", Site.fmtNum(s.online) + " online now", "ok"); });
      Site.live.signup().then(function (v) { tSign.set(v === "up" ? "Open" : "Offline", v === "up" ? "The sign-up service is answering." : "The sign-up service is not reachable.", v === "up" ? "ok" : "bad"); });
      Site.live.realms().then(function (s) {
        if (!s || !Array.isArray(s.realms)) { tRealm.set("Not connected", "Fill in anderscraft.statusUrl in site-config.js."); return; }
        var p = 0, up = 0; s.realms.forEach(function (r) { p += r.players || 0; if (r.online) up++; });
        tRealm.set(Site.fmtNum(p) + " players", up + " of " + s.realms.length + " realms up", up === s.realms.length ? "ok" : "bad");
      });
      var a = (window.SITE && SITE.anyps) || {};
      tAny.set(a.version ? "V" + a.version : "Unknown", a.date ? "Published " + Site.fmtDate(a.date) : "");
      Site.live.releases().then(function (r) { if (!r) tDl.set("Not connected", "Fill in anyps.githubRepo in site-config.js."); else tDl.set(Site.fmtNum(r.downloads), "Across all GitHub releases, latest " + r.tag, "ok"); });
      var g = cfg.kofi && cfg.kofi.goal;
      if (g && isFinite(g.target) && g.target > 0) tKo.set((g.currency || "$") + (g.current || 0) + " of " + (g.currency || "$") + g.target, Math.round(100 * (g.current || 0) / g.target) + "% this month");
      else tKo.set("No goal set", "");
      Site.fetchJSON("https://api.github.com/repos/damananders/damananders.github.io/commits?per_page=1", { ttl: 600 }).then(function (j) {
        var c = j && j[0] && j[0].commit; if (!c) { tUp.set("Unknown", ""); return; }
        tUp.set(Site.fmtDate(((c.author || {}).date || "").slice(0, 10)), String(c.message || "").split("\n")[0].slice(0, 90));
      });
      Site.news().then(function (all) { var n = all && all[0]; if (n) tNews.set(n.title, n.date ? Site.fmtDate(n.date) : ""); else tNews.set("None", ""); });
      var got = Site.store.get("trophies", {}) || {}; tTro.set(Object.keys(got).length + " earned", "In this browser");
    }
    load();
    setInterval(function () { if (!doc.hidden) load(); }, 120000);
    grid.parentNode.appendChild(el("p", { class: "pg-note", text: "Refreshes every two minutes. This page appears only in browsers that have opened the site with ?owner. To leave owner view, open any page with ?owner=0." }));
  }, "dash");
})();
