/* Site core: shared helpers used by every page (loaded with defer, before the other site scripts).
 * The public surface is window.Site and is documented in assets/README.md. Keep it stable:
 * other files only ever ADD to the site by calling these helpers.
 */
(function () {
  "use strict";
  if (window.Site) return;

  var root = document.documentElement;
  var cfg = window.SITE_EXTRA || {};
  var LS = "site.";
  root.classList.add("sx-js");

  /* ---------- page id ---------- */
  var page = root.getAttribute("data-page");
  if (!page) {
    var p = location.pathname;
    page = /^\/anderscraft(\/|$)/.test(p) ? "anderscraft" : /^\/anyps(\/|$)/.test(p) ? "anyps" : /^\/vault(\/|$)/.test(p) ? "vault" : (p === "/" || p === "/index.html") ? "hub" : "404";
    root.setAttribute("data-page", page);
  }

  /* ---------- storage (never throws) ---------- */
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(LS + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(LS + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    remove: function (k) { try { localStorage.removeItem(LS + k); } catch (e) {} }
  };

  /* ---------- events ---------- */
  var bus = document.createElement("i");
  function on(evt, fn) { var h = function (e) { try { fn(e.detail); } catch (err) { console.error("[site] handler for " + evt, err); } }; bus.addEventListener(evt, h); return function () { bus.removeEventListener(evt, h); }; }
  function emit(evt, detail) { bus.dispatchEvent(new CustomEvent(evt, { detail: detail })); }

  /* ---------- debug flags: ?sx=signup:up,twitch:live,discord:1234,status:demo,releases:demo,night ---------- */
  var dbg = {};
  try {
    (new URLSearchParams(location.search).get("sx") || "").split(",").forEach(function (part) {
      if (!part) return; var i = part.indexOf(":"); if (i < 0) dbg[part] = true; else dbg[part.slice(0, i)] = part.slice(i + 1);
    });
  } catch (e) {}
  function debug(k) { return dbg[k]; }

  /* ---------- preferences ---------- */
  var PREFS = { theme: "dark", motion: "auto", cursor: true, sfx: false, soundscape: false, volume: 0.3, glyphs: "ps" };
  var mqReduce = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var mqLight = window.matchMedia ? matchMedia("(prefers-color-scheme: light)") : { matches: false };
  function pref(name) { return store.get(name, PREFS[name]); }
  function reduced() { var m = pref("motion"); return m === "off" || (m !== "on" && mqReduce.matches); }
  function themeNow() { var t = pref("theme"); if (t === "auto") t = mqLight.matches ? "light" : "dark"; return t === "light" ? "light" : "dark"; }
  /* "Follow the sun": light between an estimated local sunrise and sunset, dark otherwise. No location is asked for;
     day length comes from the date and an assumed latitude (site-config sun.latitude, default 40). The result is
     stored as a plain "light"/"dark" theme so each page's first-paint script needs no change. */
  function sunTheme() {
    var d = new Date(), n = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5), rad = Math.PI / 180;
    var lat = parseFloat(cfg.sun && cfg.sun.latitude); if (!isFinite(lat)) lat = 40;
    var decl = -23.44 * Math.cos(2 * Math.PI * (n + 10) / 365), x = -Math.tan(lat * rad) * Math.tan(decl * rad);
    var half = Math.acos(Math.max(-1, Math.min(1, x))) / rad / 15;                     /* half the day length, in hours */
    var jan = new Date(d.getFullYear(), 0, 1).getTimezoneOffset(), jul = new Date(d.getFullYear(), 6, 1).getTimezoneOffset();
    var noon = 12 + (d.getTimezoneOffset() < Math.max(jan, jul) ? 1 : 0);              /* an hour later on summer time */
    var h = d.getHours() + d.getMinutes() / 60;
    if (dbg.hour != null && isFinite(parseFloat(dbg.hour))) h = parseFloat(dbg.hour);
    return h >= noon - half && h < noon + half ? "light" : "dark";
  }
  function sunTick() {
    if (store.get("themeSun", false) !== true) return;
    var t = sunTheme();
    if (store.get("theme", "dark") !== t) { store.set("theme", t); applyTheme(); emit("pref:theme", t); }
  }
  function applyTheme() {
    var t = themeNow(); root.setAttribute("data-theme", t);
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", t === "light" ? "#f3f1ec" : "#07090b");
  }
  function applyMotion() { if (reduced()) root.setAttribute("data-motion", "reduce"); else root.removeAttribute("data-motion"); }
  function setPref(name, value) {
    if (name === "theme") { var sun = value === "sun"; store.set("themeSun", sun); if (sun) value = sunTheme(); }
    store.set(name, value);
    if (name === "theme") applyTheme();
    if (name === "motion") applyMotion();
    emit("pref:" + name, value); emit("pref", { name: name, value: value });
  }
  sunTick(); applyTheme(); applyMotion();
  setInterval(sunTick, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) sunTick(); });
  function mqListen(mq, fn) { if (mq.addEventListener) mq.addEventListener("change", fn); else if (mq.addListener) mq.addListener(fn); }
  mqListen(mqReduce, function () { applyMotion(); emit("pref:motion", pref("motion")); });
  mqListen(mqLight, function () { if (pref("theme") === "auto") { applyTheme(); emit("pref:theme", "auto"); } });

  /* ---------- owner view (?owner turns it on for this browser, ?owner=0 turns it off) ---------- */
  var pendingToast = null;
  try {
    var q = new URLSearchParams(location.search);
    if (q.has("owner")) {
      var off = /^(0|off|false|no)$/i.test(q.get("owner") || "");
      if (off) { store.remove("owner"); root.removeAttribute("data-owner"); pendingToast = "Owner view is off for this browser."; }
      else { store.set("owner", true); root.setAttribute("data-owner", ""); pendingToast = "Owner view is on for this browser."; }
      q.delete("owner"); var qs = q.toString();
      history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
    } else if (store.get("owner", false) === true) root.setAttribute("data-owner", "");
  } catch (e) {}

  /* ---------- DOM helpers ---------- */
  function append(n, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(n, x); }); return; }
    n.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  /* el("div", {class:"a", text:"safe text", onclick:fn, dataset:{k:"v"}}, child, "text", [more]) */
  function el(tag, attrs) {
    var n = document.createElement(tag), k, v;
    if (attrs) for (k in attrs) {
      v = attrs[k]; if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k === "html") n.innerHTML = v;            /* trusted, hard-coded markup only */
      else if (k === "dataset") { for (var d in v) n.dataset[d] = v[d]; }
      else if (k === "style" && typeof v === "object") { for (var s in v) n.style.setProperty(s, v[s]); }
      else if (k.slice(0, 2) === "on" && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (var i = 2; i < arguments.length; i++) append(n, arguments[i]);
    return n;
  }
  /* svg('<path d="..."/>', {viewBox:"0 0 24 24", class:"x"}) -> stroke icon by default */
  function svg(inner, attrs) {
    var a = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" }, k;
    if (attrs) for (k in attrs) a[k] = attrs[k];
    var s = "<svg xmlns='http://www.w3.org/2000/svg'"; for (k in a) if (a[k] != null) s += " " + k + '="' + String(a[k]).replace(/"/g, "&quot;") + '"';
    var t = document.createElement("template"); t.innerHTML = s + ">" + inner + "</svg>"; return t.content.firstChild;
  }
  function list(t) { if (!t) return []; if (typeof t === "string") return Array.prototype.slice.call(document.querySelectorAll(t)); if (t.nodeType) return [t]; return Array.prototype.slice.call(t); }
  function ready(fn, name) { try { fn(); } catch (e) { console.error("[site] " + (name || "module") + " failed", e); } }
  function idle(fn) { if (window.requestIdleCallback) requestIdleCallback(fn, { timeout: 1500 }); else setTimeout(fn, 200); }

  /* ---------- sounds (a no-op until assets/audio.js registers a player and the visitor turns UI sounds on) ---------- */
  var sfxImpl = null;
  function sfx(name) { if (sfxImpl && pref("sfx") === true) { try { sfxImpl(name); } catch (e) {} } }

  /* ---------- toast ---------- */
  function toast(msg, o) {
    o = o || {};
    var host = document.getElementById("sx-toasts");
    if (!host) { host = el("div", { id: "sx-toasts", class: "sx-toasts", role: "status", "aria-live": "polite" }); document.body.appendChild(host); }
    var t = el("div", { class: "sx-toast sx-toast--" + (o.type || "info") }, msg);
    host.appendChild(t);
    /* top layer, so toasts stay above open dialogs */
    try { if (host.showPopover) { host.setAttribute("popover", "manual"); if (host.matches(":popover-open")) host.hidePopover(); host.showPopover(); } } catch (e) {}
    requestAnimationFrame(function () { requestAnimationFrame(function () { t.classList.add("is-in"); }); });
    setTimeout(function () { t.classList.remove("is-in"); setTimeout(function () { t.remove(); }, 320); }, o.ms || 2600);
    sfx(o.type === "err" || o.type === "warn" ? "error" : "toast");
    return t;
  }

  /* ---------- clipboard ---------- */
  function copy(text, okMsg) {
    function legacy() {
      return new Promise(function (res, rej) {
        var ta = el("textarea", { style: { position: "fixed", left: "-9999px", top: "0" } }); ta.value = text; document.body.appendChild(ta); ta.select();
        var ok = false; try { ok = document.execCommand("copy"); } catch (e) {} ta.remove(); ok ? res() : rej();
      });
    }
    var p = (navigator.clipboard && navigator.clipboard.writeText) ? navigator.clipboard.writeText(text).catch(legacy) : legacy();
    return p.then(function () { toast(okMsg || "Copied to clipboard", { type: "ok" }); sfx("copy"); return true; },
                  function () { toast("Couldn't copy. Select it and copy by hand.", { type: "warn" }); return false; });
  }

  /* ---------- data + network (never reject; null means "not available") ---------- */
  var dataCache = {};
  function data(name) {
    if (!dataCache[name]) dataCache[name] = fetch("/assets/data/" + name + ".json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    return dataCache[name];
  }
  /* fetchJSON(url, {timeout:6000, ttl:seconds (sessionStorage cache), headers:{}, text:false}) */
  function fetchJSON(url, o) {
    o = o || {};
    var key = o.ttl ? "sxc:" + url : null;
    if (key) { try { var c = JSON.parse(sessionStorage.getItem(key)); if (c && Date.now() - c.t < o.ttl * 1000) return Promise.resolve(c.v); } catch (e) {} }
    var ctl = window.AbortController ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, o.timeout || 6000);
    return fetch(url, { signal: ctl ? ctl.signal : undefined, headers: o.headers || {}, cache: "no-store" })
      .then(function (r) { if (!r.ok) return null; return o.text ? r.text() : r.json(); })
      .then(function (v) { if (key && v != null) { try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), v: v })); } catch (e) {} } return v; })
      .catch(function () { return null; })
      .then(function (v) { clearTimeout(to); return v; });
  }
  function news() {
    return data("news").then(function (d) {
      var items = (d && Array.isArray(d.items)) ? d.items : [];
      return items.filter(function (n) { return n && n.title; }).sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); });
    });
  }

  /* ---------- live status lookups (shared so the hub chips and the page widgets agree) ---------- */
  var live = {
    /* "up" | "down". Only meaningful on the real site: the sign-up service answers this site's origin only. */
    signup: function () {
      var d = debug("signup"); if (d) return Promise.resolve(d === "up" ? "up" : "down");
      var url = ""; try { if (typeof ANDERSCRAFT !== "undefined" && ANDERSCRAFT.apiUrl) url = ANDERSCRAFT.apiUrl; } catch (e) {}
      url = url || (cfg.anderscraft && cfg.anderscraft.apiUrl) || "";
      if (!url) return Promise.resolve("down");
      try { var c = JSON.parse(sessionStorage.getItem("sxc:signup")); if (c && Date.now() - c.t < 60000) return Promise.resolve(c.v); } catch (e) {}
      var ctl = window.AbortController ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 7000);
      /* A plain GET: the service replies "405 Use POST" (with CORS) when it is running; a dead tunnel fails CORS and rejects. */
      return fetch(url, { method: "GET", headers: { "ngrok-skip-browser-warning": "1" }, cache: "no-store", signal: ctl ? ctl.signal : undefined })
        .then(function (r) { return (r.status === 405 || r.ok) ? "up" : "down"; }, function () { return "down"; })
        .then(function (v) { clearTimeout(to); try { sessionStorage.setItem("sxc:signup", JSON.stringify({ t: Date.now(), v: v })); } catch (e) {} return v; });
    },
    /* Realm status object (see assets/README.md) or null when no status endpoint is configured / reachable. */
    realms: function () {
      if (debug("status") === "demo") return data("demo-status");
      var url = cfg.anderscraft && cfg.anderscraft.statusUrl; if (!url) return Promise.resolve(null);
      return fetchJSON(url, { ttl: 45, headers: { "ngrok-skip-browser-warning": "1" } }).then(function (s) { return s && s.ok !== false ? s : null; });
    },
    /* {live:true|false, uptime:"1 hour, 2 minutes"} or null when unknown */
    twitch: function () {
      var d = debug("twitch"); if (d) return Promise.resolve({ live: d === "live", uptime: d === "live" ? "12 minutes" : "" });
      var t = cfg.twitch || {}; if (t.live === true) return Promise.resolve({ live: true, uptime: "" }); if (t.live === false || !t.channel) return Promise.resolve({ live: false, uptime: "" });
      return fetchJSON("https://decapi.me/twitch/uptime/" + encodeURIComponent(t.channel), { ttl: 120, text: true, timeout: 5000 }).then(function (txt) {
        if (typeof txt !== "string" || !txt.trim() || txt.length > 120) return null;
        if (/offline|not found|error|no user|invalid/i.test(txt)) return { live: false, uptime: "" };
        return /\d/.test(txt) ? { live: true, uptime: txt.trim() } : null;
      });
    },
    /* {members, online, name} or null */
    discord: function () {
      var d = debug("discord"); if (d) return Promise.resolve({ members: parseInt(d, 10) || 0, online: Math.round((parseInt(d, 10) || 0) / 5), name: "AndersCraft" });
      var c = cfg.discord || {}; if (!c.invite || c.showCount === false) return Promise.resolve(null);
      return fetchJSON("https://discord.com/api/v10/invites/" + encodeURIComponent(c.invite) + "?with_counts=true", { ttl: 600, timeout: 5000 }).then(function (j) {
        if (!j || typeof j.approximate_member_count !== "number") return null;
        return { members: j.approximate_member_count, online: j.approximate_presence_count || 0, name: (j.guild && j.guild.name) || "" };
      });
    },
    /* Latest AnyPS release on GitHub: {tag, url, published, downloads, assets:[{name,size,downloads,url}]} or null (dormant until anyps.githubRepo is set). */
    releases: function () {
      function shape(list) {
        if (!Array.isArray(list) || !list.length) return null;
        var total = 0; list.forEach(function (r) { (r.assets || []).forEach(function (a) { total += a.download_count || 0; }); });
        var r0 = list.filter(function (r) { return !r.draft && !r.prerelease; })[0] || list[0];
        return { tag: r0.tag_name || "", url: r0.html_url || "", published: (r0.published_at || "").slice(0, 10), downloads: total,
                 assets: (r0.assets || []).map(function (a) { return { name: a.name, size: a.size, downloads: a.download_count || 0, url: a.browser_download_url }; }) };
      }
      if (debug("releases") === "demo") return data("demo-releases").then(shape);
      var repo = cfg.anyps && cfg.anyps.githubRepo; if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return Promise.resolve(null);
      return fetchJSON("https://api.github.com/repos/" + repo + "/releases?per_page=30", { ttl: 900, timeout: 6000 }).then(shape);
    }
  };

  /* ---------- scroll reveal: add data-reveal to an element (optionally ="left|right|zoom", data-reveal-delay="120") ---------- */
  var io = ("IntersectionObserver" in window) ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -6% 0px", threshold: 0.05 }) : null;
  function reveal(t) {
    list(t).forEach(function (n) {
      if (!n.hasAttribute("data-reveal")) n.setAttribute("data-reveal", "");
      var d = n.getAttribute("data-reveal-delay"); if (d) n.style.transitionDelay = (parseInt(d, 10) || 0) + "ms";
      if (reduced() || !io) n.classList.add("is-in"); else io.observe(n);
    });
  }

  /* ---------- dialogs ---------- */
  function openDialog(d) {
    if (typeof d === "string") d = document.querySelector(d); if (!d) return null;
    if (!d.open) { try { d.showModal(); } catch (e) { d.setAttribute("open", ""); } sfx("open"); emit("dialog:open", d); }
    return d;
  }
  function closeDialog(d) { if (typeof d === "string") d = document.querySelector(d); if (d && d.open) { try { d.close(); } catch (e) { d.removeAttribute("open"); } } }
  /* modal({id, title, body: Node|string(trusted html), wide:true}) -> <dialog class="sx-modal">, appended to <body>, not yet open */
  var modalN = 0;
  function modal(o) {
    o = o || {}; var id = o.id || ("sx-modal-" + (++modalN));
    var body = el("div", { class: "sx-modal__body" }); if (typeof o.body === "string") body.innerHTML = o.body; else append(body, o.body);
    var d = el("dialog", { class: "sx-modal" + (o.wide ? " sx-modal--wide" : "") + (o.className ? " " + o.className : ""), id: id, "aria-labelledby": id + "-t" },
      el("div", { class: "sx-modal__head" }, el("h2", { id: id + "-t", text: o.title || "" }), el("button", { class: "sx-x", type: "button", "aria-label": "Close", "data-close": true, html: "&times;" })),
      body);
    document.body.appendChild(d); return d;
  }

  /* ---------- gamepad: Site.gamepad.on(function(button, pad){}) with button in
     up|down|left|right|a|b|x|y|lb|rb|lt|rt|select|start. Polls only while a pad is connected and the tab is visible. ---------- */
  var gamepad = (function () {
    var subs = [], raf = 0, held = {}, MAP = { 0: "a", 1: "b", 2: "x", 3: "y", 4: "lb", 5: "rb", 6: "lt", 7: "rt", 8: "select", 9: "start", 12: "up", 13: "down", 14: "left", 15: "right" };
    function pads() { try { return Array.prototype.filter.call(navigator.getGamepads ? navigator.getGamepads() : [], function (g) { return g && g.connected; }); } catch (e) { return []; } }
    function fire(name, pad) { subs.slice().forEach(function (fn) { try { fn(name, pad); } catch (e) { console.error("[site] gamepad handler", e); } }); }
    function tick(t) {
      raf = 0; var ps = pads(); if (!ps.length || !subs.length || document.hidden) return;
      ps.forEach(function (pad) {
        var st = {}, i;
        for (i in MAP) { var b = pad.buttons[i]; if (b && (b.pressed || b.value > 0.5)) st[MAP[i]] = true; }
        var ax = pad.axes || []; if (ax[0] < -0.6) st.left = true; if (ax[0] > 0.6) st.right = true; if (ax[1] < -0.6) st.up = true; if (ax[1] > 0.6) st.down = true;
        var h = held[pad.index] || (held[pad.index] = {});
        for (var name in st) {
          var dir = name === "up" || name === "down" || name === "left" || name === "right";
          if (!h[name]) { h[name] = { next: t + 380 }; fire(name, pad); }
          else if (dir && t >= h[name].next) { h[name].next = t + 130; fire(name, pad); }
        }
        for (var n2 in h) if (!st[n2]) delete h[n2];
      });
      raf = requestAnimationFrame(tick);
    }
    function start() { if (!raf && subs.length && pads().length && !document.hidden) raf = requestAnimationFrame(tick); }
    window.addEventListener("gamepadconnected", function (e) { root.setAttribute("data-gamepad", ""); emit("gamepad:connected", e.gamepad); start(); });
    window.addEventListener("gamepaddisconnected", function () { if (!pads().length) { root.removeAttribute("data-gamepad"); emit("gamepad:disconnected"); } });
    document.addEventListener("visibilitychange", start);
    return { on: function (fn) { subs.push(fn); start(); return function () { subs = subs.filter(function (f) { return f !== fn; }); }; }, connected: function () { return pads().length > 0; } };
  })();

  /* ---------- settings registry (assets/chrome.js draws the panel; anyone may register a row) ----------
     register({id, label, hint, type:"toggle"|"choice"|"range", pref:"name", choices:[{value,label}], min, max, step, pages:["hub"], order}) */
  var settingsRows = [];
  var settings = {
    register: function (row) { if (!row || !row.id) return; settingsRows = settingsRows.filter(function (r) { return r.id !== row.id; }); settingsRows.push(row); emit("settings:changed"); },
    list: function () { return settingsRows.filter(function (r) { return !r.pages || r.pages.indexOf(page) >= 0; }).sort(function (a, b) { return (a.order || 50) - (b.order || 50); }); }
  };

  /* ---------- header tools: one shared container at the right end of <nav> for small header buttons ----------
     Site.tools() returns it (created on first use). Give your button style="order:N" to place it (theme 10, settings 20, sound 30). */
  function tools() {
    var t = document.getElementById("sx-tools"); if (t) return t;
    var nav = document.querySelector("nav"); if (!nav) return null;
    t = el("div", { id: "sx-tools", class: "sx-tools" }); nav.appendChild(t); return t;
  }

  /* ---------- formatting ---------- */
  function fmtDate(iso) {
    if (!iso) return ""; var d = new Date(String(iso).slice(0, 10) + "T12:00:00"); if (isNaN(d)) return String(iso);
    try { return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); } catch (e) { return String(iso); }
  }
  function fmtNum(n) { try { return Number(n).toLocaleString(); } catch (e) { return String(n); } }
  function fmtBytes(b) { if (!(b > 0)) return ""; var u = ["B", "KB", "MB", "GB"], i = 0; while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; } return (b >= 100 || i === 0 ? Math.round(b) : b.toFixed(1)) + " " + u[i]; }

  /* ---------- delegated hooks: data-copy, data-copy-target, data-open, data-close, backdrop click on .sx-modal ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target : null; if (!t) return;
    var c = t.closest("[data-copy],[data-copy-target]");
    if (c) { var txt = c.getAttribute("data-copy"); if (txt == null || txt === "") { var src = document.querySelector(c.getAttribute("data-copy-target")); txt = src ? (src.value || src.textContent || "") : ""; } if (txt) { e.preventDefault(); copy(txt.trim(), c.getAttribute("data-copy-msg") || undefined); } return; }
    var o = t.closest("[data-open]"); if (o) { var dlg = document.querySelector(o.getAttribute("data-open")); if (dlg) { e.preventDefault(); openDialog(dlg); } return; }
    var x = t.closest("dialog.sx-modal [data-close]"); if (x) { closeDialog(x.closest("dialog")); return; }
    if (t.matches && t.matches("dialog.sx-modal")) { var r = t.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog(t); }
  });

  window.Site = {
    version: 1,
    page: page, config: cfg, legacy: window.SITE || null,
    store: store, pref: pref, setPref: setPref, prefs: PREFS,
    get reducedMotion() { return reduced(); },
    get owner() { return store.get("owner", false) === true; },
    theme: { get: themeNow, set: function (t) { setPref("theme", t); }, toggle: function () { setPref("theme", themeNow() === "light" ? "dark" : "light"); } },
    on: on, emit: emit, debug: debug,
    el: el, svg: svg, ready: ready, idle: idle,
    toast: toast, copy: copy, sfx: sfx, registerSfx: function (fn) { sfxImpl = fn; },
    data: data, fetchJSON: fetchJSON, news: news, live: live,
    reveal: reveal, dialog: { open: openDialog, close: closeDialog }, modal: modal,
    gamepad: gamepad, settings: settings, tools: tools,
    fmtDate: fmtDate, fmtNum: fmtNum, fmtBytes: fmtBytes
  };

  reveal("[data-reveal]");
  if (pendingToast) setTimeout(function () { toast(pendingToast, { type: "ok", ms: 4200 }); }, 400);
})();
