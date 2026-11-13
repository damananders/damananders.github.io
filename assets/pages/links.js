/* pages/links.js — the "Links I Like" page (/links/). Prefix lk2-.
 *
 * The list itself is assets/data/links.json (edit that file to add a site).
 * Clicks and votes are kept in the site's Supabase project, in the table and two functions created by the setup file
 * 10_links.sql. The key below is Supabase's publishable key: it is meant to be public. Until that setup file has
 * been run the page still works; it just shows no counts and keeps votes in this browser only.
 * Votes: one per browser per site, up or down, and a site's score never goes below zero.
 */
(function () {
  "use strict";
  if (!window.Site || window.Site.page !== "links") return;
  var Site = window.Site, el = Site.el, doc = document;
  var SB_URL = "https://zjhlhkruqzfendvbglsb.supabase.co", SB_KEY = "sb_publishable_j-EgPXB3ZvKuz_3h8dZaNA_aLgmcQrk";
  var HEAD = { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" };
  var items = [], stats = {}, online = false, sort = Site.store.get("linksSort", "mine"), myVotes = Site.store.get("linkVotes", {}) || {};
  var list = doc.getElementById("lk2-list"), statusEl = doc.getElementById("lk2-status"), bar = doc.getElementById("lk2-sort");
  if (!list) return;

  function okId(id) { return /^[a-z0-9-]{1,40}$/.test(String(id || "")); }
  function okUrl(u) { return /^https:\/\//.test(String(u || "")); }
  function okMedia(u) { return /^(\/(?!\/)|https:\/\/)/.test(String(u || "")); }
  function okColor(c) { return /^#[0-9a-f]{6}$/i.test(String(c || "")) ? c : "#cd4257"; }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } }
  function rpc(name, body) {
    return fetch(SB_URL + "/rest/v1/rpc/" + name, { method: "POST", headers: HEAD, body: JSON.stringify(body), keepalive: true })
      .then(function (r) { return r.ok ? r.json().catch(function () { return null; }) : Promise.reject(r.status); });
  }
  function loadStats() {
    return fetch(SB_URL + "/rest/v1/link_stats?select=id,clicks,score", { headers: HEAD, cache: "no-store" })
      .then(function (r) { if (!r.ok) throw r.status; return r.json(); })
      .then(function (rows) { online = true; stats = {}; (rows || []).forEach(function (x) { stats[x.id] = { clicks: +x.clicks || 0, score: Math.max(0, +x.score || 0) }; }); })
      .catch(function () { online = false; });
  }
  function st(id) { return stats[id] || (stats[id] = { clicks: 0, score: 0 }); }
  function score(id) { return online ? st(id).score : Math.max(0, myVotes[id] || 0); }

  function sorted() {
    var a = items.slice();
    if (sort === "az") a.sort(function (x, y) { return x.title.localeCompare(y.title); });
    else if (sort === "public") a.sort(function (x, y) { return score(y.id) - score(x.id) || st(y.id).clicks - st(x.id).clicks || x.rank - y.rank; });
    else a.sort(function (x, y) { return x.rank - y.rank || x.title.localeCompare(y.title); });
    return a;
  }

  function preview(it) {
    var box = el("div", { class: "lk2-shot" });
    if (it.video && okMedia(it.video)) {
      var v = el("video", { src: it.video, muted: "", loop: "", playsinline: "", preload: "none", poster: okMedia(it.image) ? it.image : null, "aria-hidden": "true" });
      box.appendChild(v);
      box.addEventListener("pointerenter", function () { if (!Site.reducedMotion) { try { v.play(); } catch (e) {} } });
      box.addEventListener("pointerleave", function () { try { v.pause(); } catch (e) {} });
    } else if (it.image && okMedia(it.image)) {
      var img = el("img", { src: it.image, alt: "", loading: "lazy", decoding: "async", width: "640", height: "400" });
      img.addEventListener("error", function () { box.textContent = ""; box.appendChild(tile(it)); });
      box.appendChild(img);
    } else box.appendChild(tile(it));
    return box;
  }
  function tile(it) { return el("div", { class: "lk2-tile", "aria-hidden": "true" }, el("b", { text: it.title.trim().charAt(0).toUpperCase() }), el("span", { text: host(it.url) })); }

  function card(it, pos) {
    var s = st(it.id), mine = myVotes[it.id] || 0;
    var scoreEl = el("strong", { class: "lk2-score", text: String(score(it.id)) });
    var up = el("button", { type: "button", class: "lk2-vote lk2-vote--up", "aria-pressed": String(mine === 1), "aria-label": "Vote " + it.title + " up", title: "Vote up" }, Site.svg('<path d="M6 14l6-6 6 6"/>'));
    var down = el("button", { type: "button", class: "lk2-vote lk2-vote--down", "aria-pressed": String(mine === -1), "aria-label": "Vote " + it.title + " down", title: "Vote down" }, Site.svg('<path d="M6 10l6 6 6-6"/>'));
    up.addEventListener("click", function () { vote(it, 1); });
    down.addEventListener("click", function () { vote(it, -1); });
    var clicksEl = el("span", { class: "lk2-clicks", text: online ? Site.fmtNum(s.clicks) + (s.clicks === 1 ? " visit from here" : " visits from here") : "" });
    var go = el("a", { class: "lk2-go", href: it.url, target: "_blank", rel: "noopener", text: "Visit " + host(it.url) + " ↗" });
    function clicked() {
      if (!online) return;
      st(it.id).clicks++; clicksEl.textContent = Site.fmtNum(st(it.id).clicks) + (st(it.id).clicks === 1 ? " visit from here" : " visits from here");
      rpc("link_click", { p_id: it.id }).catch(function () {});
    }
    go.addEventListener("click", clicked);
    var shot = preview(it), shotLink = el("a", { class: "lk2-shotlink", href: it.url, target: "_blank", rel: "noopener", tabindex: "-1", "aria-hidden": "true" }, shot);
    shotLink.addEventListener("click", clicked);
    var c = el("article", { class: "lk2-card", style: { "--lk": okColor(it.color) }, "data-id": it.id },
      shotLink,
      el("div", { class: "lk2-body" },
        el("div", { class: "lk2-top" }, el("span", { class: "lk2-rank", text: "#" + pos }), el("h2", { class: "lk2-title", text: it.title }),
          it.founded ? el("span", { class: "lk2-founded", text: "Founded " + it.founded }) : null),
        el("p", { class: "lk2-blurb", text: it.blurb || "" }),
        el("div", { class: "lk2-foot" }, go, clicksEl)),
      el("div", { class: "lk2-votes", role: "group", "aria-label": "Public ranking for " + it.title }, up, scoreEl, el("small", { text: "points" }), down));
    return c;
  }

  function vote(it, dir) {
    var cur = myVotes[it.id] || 0, next = cur === dir ? 0 : dir, delta = next - cur;        /* -2 .. 2 */
    if (!delta) return;
    myVotes[it.id] = next; if (!next) delete myVotes[it.id];
    Site.store.set("linkVotes", myVotes);
    if (online) {
      st(it.id).score = Math.max(0, st(it.id).score + delta);
      rpc("link_vote", { p_id: it.id, p_delta: delta }).then(function (v) { if (typeof v === "number") { st(it.id).score = Math.max(0, v); draw(); } })
        .catch(function () { say("That vote could not be saved just now."); });
    }
    Site.sfx(next ? "success" : "toggle");
    draw();
  }
  function say(t) { if (statusEl) statusEl.textContent = t || ""; }

  function draw() {
    list.textContent = "";
    var rows = sorted();
    if (!rows.length) { list.appendChild(el("p", { class: "pg-empty", text: "No links yet." })); return; }
    rows.forEach(function (it, i) { list.appendChild(card(it, i + 1)); });
    if (bar) Array.prototype.forEach.call(bar.children, function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-sort") === sort)); });
  }

  Site.ready(function () {
    if (bar) bar.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-sort]"); if (!b) return;
      sort = b.getAttribute("data-sort"); Site.store.set("linksSort", sort); Site.sfx("toggle"); draw();
    });
    Site.data("links").then(function (d) {
      items = ((d && d.items) || []).filter(function (x) { return x && okId(x.id) && x.title && okUrl(x.url); })
        .map(function (x, i) { return { id: x.id, title: String(x.title), url: x.url, founded: x.founded ? String(x.founded) : "", blurb: x.blurb ? String(x.blurb) : "", color: x.color, image: x.image || "", video: x.video || "", rank: isFinite(+x.rank) ? +x.rank : 1000 + i }; });
      draw();
      loadStats().then(function () {
        draw();
        if (!online) say("Visit counts and the shared ranking are not switched on yet, so votes stay in this browser for now.");
      });
    });
  }, "links");
})();
