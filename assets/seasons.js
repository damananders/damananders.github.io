/* seasons.js — the site's skins, loaded by assets/interact.js on every page (prefix sn-).
 *
 *   classic  the original look: no seasonal dress, gold accent, the lighthouse; its sound is the ocean
 *   fall     leaves blowing through on gusts of wind, warm amber light
 *   winter   falling snow, frosted screen edges
 *   spring   drifting petals, sprigs and flowers growing in the bottom corners, fresh green light
 *   summer   sandy ground glow, a hot sun, steam rising and grains of sand on the breeze
 *
 * "Auto" follows the visitor's calendar (flipped for the southern hemisphere). Visitors pick a skin in the
 * settings panel. This file draws the look only; each skin's sound is the hub soundscape in assets/audio.js,
 * which asks Site.skin() and listens for the "skin" event. features.seasons = false leaves the site on classic;
 * seasons.force = "winter" pins one for everyone. Try one with ?sx=season:winter (or season:classic)
 */
(function () {
  "use strict";
  if (!window.Site || window.__snLoaded) return;
  window.__snLoaded = true;
  var Site = window.Site, el = Site.el, doc = document, root = doc.documentElement;
  var cfg = (Site.config && Site.config.seasons) || {};
  if (((Site.config && Site.config.features) || {}).seasons === false) return;
  var NAMES = ["winter", "spring", "summer", "fall"];

  function southern() {
    if (cfg.hemisphere) return /^s/i.test(cfg.hemisphere);
    var tz = ""; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
    return /^(Australia|Antarctica)\/|Auckland|Chatham|Fiji|Sao_Paulo|Buenos_Aires|Argentina|Santiago|Montevideo|Asuncion|La_Paz|Lima|Johannesburg|Maputo|Harare|Windhoek|Gaborone|Lusaka|Antananarivo|Mauritius|Reunion|Jakarta|Port_Moresby|Noumea|Tongatapu|Apia|Punta_Arenas/.test(tz);
  }
  function calendarSeason() {
    var m = new Date().getMonth();                       /* Dec-Feb winter, Mar-May spring, Jun-Aug summer, Sep-Nov fall */
    var i = m === 11 || m < 2 ? 0 : m < 5 ? 1 : m < 8 ? 2 : 3;
    if (southern()) i = (i + 2) % 4;
    return NAMES[i];
  }
  function chosen() {
    var d = Site.debug("season"); if (d && NAMES.indexOf(d) >= 0) return d;
    if (d === "classic") return null;
    var p = Site.store.get("season", "auto");
    if (p === "off" || p === "classic") return null;        /* "off" is the old name for classic */
    if (NAMES.indexOf(p) >= 0) return p;
    if (cfg.force && NAMES.indexOf(cfg.force) >= 0) return cfg.force;
    return calendarSeason();
  }

  /* ---------- decorations (all original vector shapes) ---------- */
  function sprig(flip) {
    var leaves = "", i;
    for (i = 0; i < 9; i++) {
      var t = i / 8, x = 14 + t * 150, y = 196 - t * 150 - Math.sin(t * 3.1) * 22, a = -50 + i * 9 + (i % 2 ? 62 : -48);
      leaves += '<ellipse cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" rx="' + (17 - t * 6).toFixed(0) + '" ry="' + (7 - t * 2).toFixed(1) + '" transform="rotate(' + a + " " + x.toFixed(0) + " " + y.toFixed(0) + ')" fill="' + (i % 3 ? "#4fbf6b" : "#2f9d57") + '"/>';
    }
    function flower(x, y, r, c) {
      var s = ""; for (var k = 0; k < 5; k++) { var an = k * 72 * Math.PI / 180; s += '<circle cx="' + (x + Math.cos(an) * r).toFixed(1) + '" cy="' + (y + Math.sin(an) * r).toFixed(1) + '" r="' + r + '" fill="' + c + '"/>'; }
      return s + '<circle cx="' + x + '" cy="' + y + '" r="' + (r * 0.8).toFixed(1) + '" fill="#ffd95e"/>';
    }
    var svg = '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M6 200C30 150 70 120 100 92s58-44 70-80" fill="none" stroke="#2f8a4d" stroke-width="3.5" stroke-linecap="round"/>' +
      '<path d="M40 200c6-30 26-48 44-58M0 170c22-4 40-18 52-34" fill="none" stroke="#2f8a4d" stroke-width="2.5" stroke-linecap="round"/>' +
      leaves + flower(96, 96, 7, "#ffb3d1") + flower(52, 140, 6, "#fff3f8") + flower(150, 38, 6, "#ff9ec4") + flower(24, 176, 5, "#ffd0e4") + "</svg>";
    var d = el("div", { class: "sn-sprig" + (flip ? " sn-sprig--r" : ""), "aria-hidden": "true" }); d.innerHTML = svg; return d;
  }

  /* ---------- particles ---------- */
  var cv = null, ctx = null, raf = 0, parts = [], W = 0, H = 0, season = null, wind = 0, gust = 0, gustT = 0, last = 0, layer = null;
  var LEAF = ["#d9772b", "#c2452d", "#e2a13a", "#8a4b25", "#b5651d", "#e0532f"], PETAL = ["#ffc4dc", "#ffe3ee", "#ffffff", "#ffa9cb", "#bfe8a4"];
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function spawn(p, fresh) {
    p = p || {};
    if (season === "fall") {
      p.x = fresh ? rnd(0, W) : rnd(-W * 0.3, W * 0.8); p.y = fresh ? rnd(0, H) : -20; p.s = rnd(7, 15); p.vy = rnd(28, 70); p.vx = rnd(10, 40);
      p.r = rnd(0, 6.3); p.vr = rnd(-2.2, 2.2); p.c = LEAF[(Math.random() * LEAF.length) | 0]; p.ph = rnd(0, 6.3); p.a = rnd(0.55, 0.9);
    } else if (season === "winter") {
      p.x = rnd(0, W); p.y = fresh ? rnd(0, H) : -6; p.s = rnd(1, 3.6); p.vy = 16 + p.s * 14; p.vx = rnd(-8, 8); p.ph = rnd(0, 6.3); p.a = rnd(0.45, 0.95);
    } else if (season === "spring") {
      p.x = rnd(0, W); p.y = fresh ? rnd(0, H) : -10; p.s = rnd(4, 8); p.vy = rnd(18, 42); p.vx = rnd(-6, 16);
      p.r = rnd(0, 6.3); p.vr = rnd(-1.4, 1.4); p.c = PETAL[(Math.random() * PETAL.length) | 0]; p.ph = rnd(0, 6.3); p.a = rnd(0.6, 0.95);
    } else {                                              /* summer: k 0 = steam wisp rising, 1 = sand grain blowing */
      p.k = Math.random() < 0.3 ? 0 : 1;
      if (p.k === 0) { p.x = rnd(0, W); p.y = fresh ? rnd(H * 0.4, H) : H + 40; p.s = rnd(40, 110); p.vy = -rnd(10, 26); p.vx = rnd(-4, 4); p.a = rnd(0.03, 0.075); p.ph = rnd(0, 6.3); }
      else { p.x = fresh ? rnd(0, W) : -6; p.y = H - Math.pow(Math.random(), 2.2) * H * 0.55; p.s = rnd(0.7, 1.9); p.vx = rnd(50, 150); p.vy = rnd(-6, 6); p.a = rnd(0.35, 0.8); p.ph = rnd(0, 6.3); }
    }
    return p;
  }
  function count() {
    var area = (W * H) / (1280 * 800), n = season === "winter" ? 90 : season === "fall" ? 34 : season === "spring" ? 30 : 60;
    return Math.round(Math.max(0.45, Math.min(1.6, area)) * n);
  }
  function size() {
    if (!cv) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = count(); while (parts.length < n) parts.push(spawn(null, true)); parts.length = n;
  }
  function frame(t) {
    raf = requestAnimationFrame(frame);
    var dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
    if (doc.hidden) return;
    /* wind: a slow sway plus, in fall, a gust every so often */
    if (t > gustT) { gust = season === "fall" ? rnd(120, 260) : season === "winter" ? rnd(10, 40) : rnd(6, 24); gustT = t + rnd(5000, 11000); }
    gust *= Math.pow(0.55, dt);
    wind = Math.sin(t / 3700) * 14 + gust;
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.ph += dt * 1.6;
      if (season === "summer" && p.k === 0) {
        p.x += (p.vx + Math.sin(p.ph) * 8) * dt; p.y += p.vy * dt; p.s += dt * 6;
        var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s);
        g.addColorStop(0, "rgba(255,244,225," + p.a + ")"); g.addColorStop(1, "rgba(255,244,225,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.3); ctx.fill();
        if (p.y < H * 0.25 - p.s) spawn(p, false);
        continue;
      }
      p.x += (p.vx + wind * (season === "winter" ? 0.5 : 1) + Math.sin(p.ph) * (season === "summer" ? 4 : 16)) * dt;
      p.y += (p.vy + (season === "fall" ? Math.cos(p.ph * 0.7) * 14 - gust * 0.08 : 0)) * dt;
      if (p.vr) p.r += p.vr * dt * (1 + gust / 120);
      ctx.globalAlpha = p.a;
      if (season === "winter") { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.3); ctx.fill(); }
      else if (season === "summer") { ctx.fillStyle = "#e9cf9a"; ctx.fillRect(p.x, p.y, p.s * 2.4, p.s); }
      else {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.cos(p.ph * 0.8)));
        ctx.fillStyle = p.c; ctx.beginPath();
        if (season === "fall") { ctx.moveTo(-p.s, 0); ctx.quadraticCurveTo(0, -p.s * 0.75, p.s, 0); ctx.quadraticCurveTo(0, p.s * 0.75, -p.s, 0); ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-p.s, 0); ctx.lineTo(p.s * 1.25, 0); ctx.stroke(); }
        else { ctx.ellipse(0, 0, p.s, p.s * 0.6, 0, 0, 6.3); ctx.fill(); }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      if (p.y > H + 24 || p.x > W + 40 || p.x < -W * 0.35) spawn(p, false);
    }
  }
  function stop() {
    cancelAnimationFrame(raf); raf = 0; parts = [];
    if (layer) { layer.remove(); layer = null; cv = null; ctx = null; }
    root.removeAttribute("data-season");
  }
  function start() {
    stop();
    season = chosen();
    root.setAttribute("data-skin", season || "classic");
    Site.emit("skin", season || "classic");
    if (!season || !doc.body || root.hasAttribute("data-lite")) return;
    root.setAttribute("data-season", season);
    layer = el("div", { class: "sn-layer sn-" + season, "aria-hidden": "true" }, el("div", { class: "sn-tint" }));
    if (season === "spring") { layer.appendChild(sprig(false)); layer.appendChild(sprig(true)); }
    if (season === "summer") { layer.appendChild(el("div", { class: "sn-sun" })); layer.appendChild(el("div", { class: "sn-sand" })); }
    if (season === "winter") layer.appendChild(el("div", { class: "sn-frost" }));
    doc.body.appendChild(layer);
    if (Site.reducedMotion) return;                       /* tint and decorations only */
    cv = el("canvas", { class: "sn-canvas" }); ctx = cv.getContext("2d"); layer.appendChild(cv);
    gustT = performance.now() + rnd(1500, 4000); size(); last = performance.now(); raf = requestAnimationFrame(frame);
  }

  /* ---------- wiring ---------- */
  Site.ready(function () {
    Site.settings.register({
      id: "season", label: "Site Skin", type: "choice", pref: "season", order: 25,
      hint: "Classic is the original lighthouse look. The seasons add leaves, snow, petals or summer heat, each with its own sound. Auto follows your calendar.",
      choices: [{ value: "auto", label: "Auto" }, { value: "classic", label: "Classic" }, { value: "fall", label: "Fall" }, { value: "winter", label: "Winter" }, { value: "spring", label: "Spring" }, { value: "summer", label: "Summer" }],
      get: function () { var v = Site.store.get("season", "auto"); return v === "off" ? "classic" : v; },
      set: function (v) { Site.setPref("season", v); }
    });
    Site.on("pref:season", start);
    Site.on("pref:motion", start);
    var rt = 0; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(size, 150); });
    start();
  }, "seasons");
  Site.season = function () { return season; };
  Site.skin = function () { return chosen() || "classic"; };
})();
