/* arcade/review-score.js — "Review Score": stamp the flying game cases, leave the hardware alone.
 *
 * Real box art from Rate-O-Pedia's info cards (assets/data/rop-cases.json, heavily weighted to popular games with
 * a random spread mixed in). Stamp a case and it scores its live Rate-O-Pedia average (minimum 1 point, unrated
 * games score 1) with a GOLD (4+), SILVER (2 to under 4) or BRONZE (under 2) stamp.
 * A misclick (clicking empty space) or clicking any hardware costs a quarter of a heart, with a toast saying why.
 * A case that gets away scores nothing and costs nothing. Survive the timer AND reach the round's goal to win.
 * Beating "Harder ;)" unlocks "Harder…er". A random background each play.
 * Mouse / touch: click or slice. Keyboard: arrows or WASD move the reticle, Space / Enter stamps.
 * Controller: left stick or D-pad moves the reticle, A stamps. Esc / P / Start pauses.
 * features.caseGame404 = false removes it.
 */
(function () {
  "use strict";
  if (!window.Site || !window.Arcade) return;
  var Site = window.Site, A = window.Arcade, D = A.draw, F = A.FONT, store = Site.store, el = Site.el;
  if (((Site.config && Site.config.features) || {}).caseGame404 === false) return;

  var W = 1280, H = 720, HUD = 64;
  var SB = "https://zjhlhkruqzfendvbglsb.supabase.co", SB_KEY = "sb_publishable_j-EgPXB3ZvKuz_3h8dZaNA_aLgmcQrk";
  var HR_KEY = "case404.hr";
  function hardererUnlocked() { return !!store.get(HR_KEY, false); }

  var DIFF = [
    { key: "easy",     name: "Easy",      time: 45,  lives: 6, goal: 0.40, interval: 1.15, haz: 0.12 },
    { key: "medium",   name: "Medium",    time: 60,  lives: 5, goal: 0.50, interval: 0.95, haz: 0.16 },
    { key: "hard",     name: "Hard",      time: 90,  lives: 4, goal: 0.60, interval: 0.82, haz: 0.22 },
    { key: "harder",   name: "Harder ;)", time: 120, lives: 3, goal: 0.70, interval: 0.70, haz: 0.28 },
    { key: "harderer", name: "Harder…er", time: 240, lives: 1, goal: 0.80, interval: 0.56, haz: 0.32, hidden: true }
  ];
  var CW = 118, CH = 160;                       /* case size in game pixels */

  /* ---------------- data: case pool, box art, live scores ---------------- */
  var POOL = { pop: [], rnd: [] }, poolReady = null;
  function loadPool() {
    if (poolReady) return poolReady;
    poolReady = Promise.resolve(Site.data ? Site.data("rop-cases") : null).then(function (d) {
      if (d && Array.isArray(d.pop)) { POOL.pop = d.pop; POOL.rnd = d.rnd || []; }
      else if (d && Array.isArray(d.cases)) POOL.pop = d.cases.map(function (c, i) { return ["x:" + i, c.title, c.cover ? { ra: c.cover } : null]; });
    }, function () {});
    return poolReady;
  }
  function artUrl(a) {
    if (a && typeof a === "object") {
      if (a.g && /^ps3\/cover\/[A-Z]{2}\/[A-Z]{4}\d{5}$/.test(a.g)) return "https://art.gametdb.com/" + a.g + ".jpg";
      if (a.a) return artUrl(a.a);
      if (a.sa) return "https://cdn.cloudflare.steamstatic.com/steam/apps/" + encodeURIComponent(a.sa) + "/library_600x900.jpg";
      if (a.ra && /^https:\/\/media\.rawg\.io\//.test(a.ra)) return a.ra;
      return null;
    }
    if (!a || typeof a !== "string") return null;
    var i = a.indexOf("/"); if (i < 1) return null;
    return "https://thumbnails.libretro.com/" + encodeURIComponent(a.slice(0, i)) + "/Named_Boxarts/" + encodeURIComponent(a.slice(i + 1)) + ".png";
  }
  var IMG = {};                                  /* id -> {img, st: 0 loading, 1 ok, -1 failed} */
  var loadingN = 0, loadQ = [];
  function want(e) {
    var id = e[0]; if (IMG[id]) return IMG[id];
    var rec = IMG[id] = { img: null, st: 0, e: e };
    loadQ.push(rec); pump(); return rec;
  }
  function pump() {
    while (loadingN < 6 && loadQ.length) {
      var rec = loadQ.shift(), url = artUrl(rec.e[2]);
      if (!url) { rec.st = -1; continue; }
      loadingN++;
      (function (rec) {
        var im = new Image(); im.decoding = "async"; im.referrerPolicy = "no-referrer";
        var done = function (ok) { if (rec.st) return; rec.st = ok ? 1 : -1; if (ok) rec.img = im; loadingN--; pump(); };
        im.onload = function () { done(im.naturalWidth > 8); };
        im.onerror = function () { done(false); };
        setTimeout(function () { done(false); }, 9000);
        im.src = url;
      })(rec);
    }
  }
  function fetchScores(ids) {
    var out = {}, chunks = [], i;
    for (i = 0; i < ids.length; i += 60) chunks.push(ids.slice(i, i + 60));
    return Promise.all(chunks.map(function (c) {
      var list = c.map(function (id) { return '"' + String(id).replace(/["\\]/g, "") + '"'; }).join(",");
      var url = SB + "/rest/v1/game_scores?select=id,average,votes&id=in.(" + encodeURIComponent(list) + ")";
      var ctl = window.AbortController ? new AbortController() : null;
      if (ctl) setTimeout(function () { ctl.abort(); }, 3500);
      return fetch(url, { headers: { apikey: SB_KEY, Accept: "application/json" }, signal: ctl ? ctl.signal : undefined })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (rows) { (rows || []).forEach(function (r) { var a = +r.average; if (r.votes > 0 && isFinite(a)) out[r.id] = a; }); }, function () {});
    })).then(function () { return out; });
  }
  var SCORE = {};                                /* id -> live average (only rated games) */
  function pointsOf(id) { var s = SCORE[id]; return typeof s === "number" ? Math.max(1, s) : 1; }
  function tierOf(id) {
    var s = SCORE[id];
    if (typeof s !== "number") return { col: "#c58551", ink: "#2a1708", label: "BRONZE", txt: "UNRATED" };
    if (s >= 4) return { col: "#f0c23a", ink: "#2a2103", label: "GOLD", txt: s.toFixed(1) };
    if (s >= 2) return { col: "#d2d8e0", ink: "#20262e", label: "SILVER", txt: s.toFixed(1) };
    return { col: "#c58551", ink: "#2a1708", label: "BRONZE", txt: s.toFixed(1) };
  }
  function pickEntry(used) {
    for (var tries = 0; tries < 30; tries++) {
      var list = (Math.random() < 0.8 && POOL.pop.length) || !POOL.rnd.length ? POOL.pop : POOL.rnd;
      if (!list.length) return null;
      var e = list[(Math.random() * list.length) | 0];
      if (!used[e[0]] && !(IMG[e[0]] && IMG[e[0]].st === -1)) { used[e[0]] = 1; return e; }
    }
    return null;
  }

  /* ---------------- platform badge ---------------- */
  function badge(id) {
    var p = String(id).split(":")[0];
    var col = /^PS|^Vita/.test(p) ? "#1d4fc4" : /^(NES|SNES|N64|GC|Wii|WiiU|Switch|GB|GBC|GBA|DS|3DS|FDS|VB)$/.test(p) ? "#d3222f" :
      /^(GEN|SMS|SAT|DC|GG|SCD|32X|Pico)$/.test(p) ? "#16181d" : /^(Xbox|X360|XB1|XSX)$/.test(p) ? "#1f8a2e" :
      /^(DOS|PC|Win)$/.test(p) ? "#4b5563" : "#5b3fa6";
    return { p: p.slice(0, 6), col: col };
  }

  /* ---------------- backgrounds: a random one each play ---------------- */
  function makeBg(kind, seed) {
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var x = c.getContext("2d"), r = A.rng(seed), i, g;
    function grad(stops, x0, y0, x1, y1) { var gg = x.createLinearGradient(x0 || 0, y0 || 0, x1 || 0, y1 === undefined ? H : y1); stops.forEach(function (s, k) { gg.addColorStop(k / (stops.length - 1), s); }); return gg; }
    function blob(cx, cy, rad, col) { var gg = x.createRadialGradient(cx, cy, 0, cx, cy, rad); gg.addColorStop(0, col); gg.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = gg; x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2); }
    var name = "";
    switch (kind) {
      case 0: name = "Synth Sunset";
        x.fillStyle = grad(["#1a0b33", "#5a1a5e", "#d9466f", "#ffb36b"], 0, 0, 0, H * 0.62); x.fillRect(0, 0, W, H);
        x.save(); x.beginPath(); x.arc(W / 2, H * 0.6, 190, Math.PI, 0); x.clip();
        x.fillStyle = grad(["#ffe27a", "#ff7a59", "#e23b8a"], 0, H * 0.6 - 190, 0, H * 0.6); x.fillRect(W / 2 - 200, H * 0.6 - 200, 400, 200);
        x.fillStyle = "#2a0d3a"; for (i = 0; i < 7; i++) x.fillRect(W / 2 - 200, H * 0.6 - 70 + i * 11, 400, 2 + i * 1.1); x.restore();
        x.fillStyle = "#12061f"; x.fillRect(0, H * 0.6, W, H);
        x.strokeStyle = "rgba(255,80,200,.55)"; x.lineWidth = 2;
        for (i = 0; i < 14; i++) { var yy = H * 0.6 + Math.pow(i / 13, 2) * H * 0.42; x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke(); }
        for (i = -20; i <= 20; i++) { x.beginPath(); x.moveTo(W / 2 + i * 12, H * 0.6); x.lineTo(W / 2 + i * 120, H); x.stroke(); }
        break;
      case 1: name = "Deep Space";
        x.fillStyle = grad(["#02030a", "#070b1f", "#0b0717"]); x.fillRect(0, 0, W, H);
        blob(W * r(), H * r(), 420, "rgba(90,60,200,.35)"); blob(W * r(), H * r(), 360, "rgba(30,140,200,.28)"); blob(W * r(), H * r(), 300, "rgba(220,60,140,.22)");
        for (i = 0; i < 420; i++) { var a = r(); x.fillStyle = "rgba(255,255,255," + (0.25 + a * 0.75).toFixed(2) + ")"; var s = a > 0.97 ? 2.4 : a > 0.85 ? 1.6 : 1; x.fillRect(r() * W, r() * H, s, s); }
        break;
      case 2: name = "Game Shop";
        x.fillStyle = "#1b1410"; x.fillRect(0, 0, W, H);
        for (var row = 0; row < 5; row++) {
          var y0 = 40 + row * 140; x.fillStyle = "#3b2a1e"; x.fillRect(0, y0 + 112, W, 16);
          for (var px = 0; px < W;) { var sw = 14 + r() * 16, sh = 92 + r() * 16; x.fillStyle = "hsl(" + ((r() * 360) | 0) + "," + (35 + r() * 40 | 0) + "%," + (22 + r() * 30 | 0) + "%)"; x.fillRect(px, y0 + 112 - sh, sw - 2, sh); x.fillStyle = "rgba(255,255,255,.18)"; x.fillRect(px + 3, y0 + 112 - sh + 8, sw - 8, 6); px += sw; }
        }
        x.fillStyle = "rgba(8,6,4,.55)"; x.fillRect(0, 0, W, H);
        break;
      case 3: name = "Arcade Carpet";
        x.fillStyle = "#0a0614"; x.fillRect(0, 0, W, H);
        var cols = ["#ff3fa4", "#2ee6ff", "#ffe14d", "#7b5cff", "#2bff88"];
        for (i = 0; i < 90; i++) {
          x.save(); x.translate(r() * W, r() * H); x.rotate(r() * 6.3); x.strokeStyle = cols[(r() * cols.length) | 0]; x.lineWidth = 4; x.globalAlpha = 0.55;
          var t = (r() * 4) | 0;
          if (t === 0) { x.beginPath(); x.moveTo(-18, 14); x.lineTo(0, -16); x.lineTo(18, 14); x.closePath(); x.stroke(); }
          else if (t === 1) { x.beginPath(); for (var k = 0; k < 5; k++) x.lineTo(-30 + k * 15, k % 2 ? -10 : 10); x.stroke(); }
          else if (t === 2) { x.beginPath(); x.arc(0, 0, 14, 0, 6.3); x.stroke(); }
          else { x.strokeRect(-12, -12, 24, 24); }
          x.restore();
        }
        break;
      case 4: name = "Bokeh Night";
        x.fillStyle = grad(["#0b1020", "#141a33", "#1e1030"]); x.fillRect(0, 0, W, H);
        for (i = 0; i < 46; i++) blob(r() * W, r() * H, 30 + r() * 110, "hsla(" + ((r() * 360) | 0) + ",80%,60%," + (0.12 + r() * 0.22).toFixed(2) + ")");
        break;
      case 5: name = "Ocean Deep";
        x.fillStyle = grad(["#0b4f78", "#06304d", "#021623"]); x.fillRect(0, 0, W, H);
        x.globalAlpha = 0.16; x.fillStyle = "#bfefff";
        for (i = 0; i < 9; i++) { var bx = r() * W; x.beginPath(); x.moveTo(bx, 0); x.lineTo(bx + 60 + r() * 40, 0); x.lineTo(bx + 240 + r() * 160, H); x.lineTo(bx + 120, H); x.closePath(); x.fill(); }
        x.globalAlpha = 1; x.strokeStyle = "rgba(200,240,255,.35)"; x.lineWidth = 1.5;
        for (i = 0; i < 60; i++) { x.beginPath(); x.arc(r() * W, r() * H, 2 + r() * 7, 0, 6.3); x.stroke(); }
        break;
      case 6: name = "Checkerboard";
        var c1 = "hsl(" + ((r() * 360) | 0) + ",45%,16%)", c2 = "hsl(" + ((r() * 360) | 0) + ",45%,10%)";
        x.save(); x.translate(W / 2, H / 2); x.rotate(-0.35); x.translate(-W, -H);
        for (var cy = 0; cy < H * 2; cy += 64) for (var cx = 0; cx < W * 2; cx += 64) { x.fillStyle = ((cx + cy) / 64) % 2 ? c1 : c2; x.fillRect(cx, cy, 64, 64); }
        x.restore();
        break;
      default: name = "Aurora";
        x.fillStyle = grad(["#020611", "#04101c", "#06121a"]); x.fillRect(0, 0, W, H);
        for (i = 0; i < 5; i++) {
          var hue = [150, 170, 280, 200, 120][i], y1 = H * (0.15 + r() * 0.45);
          g = x.createLinearGradient(0, y1 - 120, 0, y1 + 120); g.addColorStop(0, "hsla(" + hue + ",90%,60%,0)"); g.addColorStop(0.5, "hsla(" + hue + ",90%,60%,.32)"); g.addColorStop(1, "hsla(" + hue + ",90%,60%,0)");
          x.fillStyle = g; x.beginPath(); x.moveTo(0, y1);
          for (var ax = 0; ax <= W; ax += 40) x.lineTo(ax, y1 + Math.sin(ax / 160 + i * 2 + r()) * 60 - 110);
          for (ax = W; ax >= 0; ax -= 40) x.lineTo(ax, y1 + Math.sin(ax / 170 + i) * 50 + 110);
          x.closePath(); x.fill();
        }
        for (i = 0; i < 160; i++) { x.fillStyle = "rgba(255,255,255," + (r() * 0.7).toFixed(2) + ")"; x.fillRect(r() * W, r() * H * 0.7, 1.4, 1.4); }
    }
    g = x.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.75);     /* vignette so the cases pop */
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.6)"); x.fillStyle = g; x.fillRect(0, 0, W, H);
    c.bgName = name;
    return c;
  }
  var BG_N = 8;

  /* ---------------- hardware (hazards) ---------------- */
  var HAZ = {
    pad:    { name: "Controller",  hw: 70, hh: 44 },
    console:{ name: "Console",     hw: 78, hh: 40 },
    headset:{ name: "Headset",     hw: 58, hh: 58 },
    remote: { name: "TV Remote",   hw: 24, hh: 70 },
    brick:  { name: "Power Brick", hw: 62, hh: 36 },
    mug:    { name: "Coffee Mug",  hw: 46, hh: 48 },
    phone:  { name: "Phone",       hw: 34, hh: 64 }
  };
  var HAZ_KEYS = Object.keys(HAZ);
  function drawHaz(x, o) {
    var t = o.type, gg;
    x.save(); x.translate(o.x, o.y); x.rotate(o.rot);
    x.shadowColor = "rgba(0,0,0,.55)"; x.shadowBlur = 18; x.shadowOffsetY = 8;
    if (t === "pad") {
      gg = x.createLinearGradient(0, -40, 0, 44); gg.addColorStop(0, "#3a4250"); gg.addColorStop(1, "#1a1f27"); x.fillStyle = gg;
      x.beginPath(); x.moveTo(-40, -30); x.lineTo(40, -30); x.bezierCurveTo(62, -30, 74, -6, 72, 22); x.bezierCurveTo(70, 46, 50, 48, 40, 32);
      x.lineTo(28, 16); x.lineTo(-28, 16); x.lineTo(-40, 32); x.bezierCurveTo(-50, 48, -70, 46, -72, 22); x.bezierCurveTo(-74, -6, -62, -30, -40, -30); x.closePath(); x.fill();
      x.shadowColor = "transparent";
      x.fillStyle = "#0f1217"; x.fillRect(-52, -8, 26, 8); x.fillRect(-43, -17, 8, 26);
      [["#3fd47a", 44, -18], ["#e8475a", 56, -6], ["#4aa3ff", 32, -6], ["#f2c94c", 44, 6]].forEach(function (b) { x.fillStyle = b[0]; x.beginPath(); x.arc(b[1], b[2], 6, 0, 6.3); x.fill(); });
      x.fillStyle = "#11151b"; [[-16, 6], [16, 6]].forEach(function (p) { x.beginPath(); x.arc(p[0], p[1], 10, 0, 6.3); x.fill(); });
      x.fillStyle = "#59606b"; [[-16, 6], [16, 6]].forEach(function (p) { x.beginPath(); x.arc(p[0], p[1], 6, 0, 6.3); x.fill(); });
    } else if (t === "console") {
      gg = x.createLinearGradient(0, -40, 0, 40); gg.addColorStop(0, "#e9ecf1"); gg.addColorStop(1, "#aab1bc"); x.fillStyle = gg;
      D.rr(x, -78, -36, 156, 72, 10); x.fill(); x.shadowColor = "transparent";
      x.fillStyle = "#1c2129"; D.rr(x, -78, 6, 156, 30, 8); x.fill();
      x.fillStyle = "#8d96a3"; x.fillRect(-60, 16, 70, 4);
      x.fillStyle = "#38e07b"; x.beginPath(); x.arc(56, 20, 4, 0, 6.3); x.fill();
      x.strokeStyle = "rgba(0,0,0,.18)"; x.lineWidth = 2; for (var i = 0; i < 6; i++) { x.beginPath(); x.moveTo(-60 + i * 22, -26); x.lineTo(-50 + i * 22, -6); x.stroke(); }
    } else if (t === "headset") {
      x.strokeStyle = "#2b313b"; x.lineWidth = 12; x.beginPath(); x.arc(0, 4, 46, Math.PI * 1.05, Math.PI * 1.95); x.stroke();
      x.shadowColor = "transparent";
      [-46, 46].forEach(function (cx) { x.fillStyle = "#1c2028"; D.rr(x, cx - 16, -4, 32, 52, 12); x.fill(); x.fillStyle = "#d9466f"; D.rr(x, cx - 10, 4, 20, 36, 8); x.fill(); });
      x.strokeStyle = "#2b313b"; x.lineWidth = 5; x.beginPath(); x.moveTo(-46, 40); x.quadraticCurveTo(-34, 62, -6, 58); x.stroke();
      x.fillStyle = "#2b313b"; x.beginPath(); x.arc(-4, 58, 6, 0, 6.3); x.fill();
    } else if (t === "remote") {
      x.fillStyle = "#23272f"; D.rr(x, -24, -70, 48, 140, 16); x.fill(); x.shadowColor = "transparent";
      x.fillStyle = "#e23b3b"; x.beginPath(); x.arc(0, -52, 7, 0, 6.3); x.fill();
      x.fillStyle = "#596170"; for (var r2 = 0; r2 < 4; r2++) for (var c2 = 0; c2 < 3; c2++) { D.rr(x, -16 + c2 * 12, -30 + r2 * 14, 9, 9, 3); x.fill(); }
      x.fillStyle = "#3c4450"; x.beginPath(); x.arc(0, 40, 13, 0, 6.3); x.fill();
    } else if (t === "brick") {
      x.strokeStyle = "#16191f"; x.lineWidth = 6; x.beginPath(); x.moveTo(60, 0); x.bezierCurveTo(90, -10, 80, 40, 110, 30); x.stroke();
      x.fillStyle = "#1e2229"; D.rr(x, -62, -34, 124, 68, 10); x.fill(); x.shadowColor = "transparent";
      x.fillStyle = "#2d333d"; D.rr(x, -50, -22, 100, 44, 6); x.fill();
      x.fillStyle = "#8a93a0"; x.font = "700 12px " + F.mono; x.textAlign = "center"; x.fillText("12V ⎓ 5A", 0, 5);
      x.fillStyle = "#3ccf6e"; x.beginPath(); x.arc(42, -12, 3.5, 0, 6.3); x.fill();
    } else if (t === "mug") {
      x.strokeStyle = "#e8e1d6"; x.lineWidth = 10; x.beginPath(); x.arc(38, 4, 18, -1.3, 1.3); x.stroke();
      gg = x.createLinearGradient(-40, 0, 40, 0); gg.addColorStop(0, "#d8d0c3"); gg.addColorStop(0.5, "#fbf7f0"); gg.addColorStop(1, "#c9c0b2"); x.fillStyle = gg;
      D.rr(x, -40, -40, 76, 88, 12); x.fill(); x.shadowColor = "transparent";
      x.fillStyle = "#4a2b1a"; x.beginPath(); x.ellipse(-2, -38, 34, 7, 0, 0, 6.3); x.fill();
      x.fillStyle = "#cd4257"; x.font = "800 22px " + F.display; x.textAlign = "center"; x.fillText("GG", -2, 14);
    } else {
      x.fillStyle = "#15181d"; D.rr(x, -34, -64, 68, 128, 12); x.fill(); x.shadowColor = "transparent";
      gg = x.createLinearGradient(-28, -56, 28, 56); gg.addColorStop(0, "#3b82f6"); gg.addColorStop(1, "#9333ea"); x.fillStyle = gg; D.rr(x, -28, -56, 56, 112, 7); x.fill();
      x.fillStyle = "rgba(255,255,255,.75)"; x.font = "700 16px " + F.display; x.textAlign = "center"; x.fillText("12:04", 0, -24);
      x.fillStyle = "#15181d"; D.rr(x, -10, -61, 20, 5, 2); x.fill();
    }
    if (o.hit) {
      x.globalAlpha = Math.min(0.9, o.stamp * 1.5); x.strokeStyle = "#ff3b4f"; x.lineWidth = 10; x.lineCap = "round";
      x.beginPath(); x.moveTo(-34, -34); x.lineTo(34, 34); x.moveTo(34, -34); x.lineTo(-34, 34); x.stroke(); x.globalAlpha = 1;
    }
    x.restore();
  }

  /* ---------------- cases ---------------- */
  function drawCover(x, im, dx, dy, dw, dh) {
    var iw = im.naturalWidth, ih = im.naturalHeight, s = Math.max(dw / iw, dh / ih), sw = dw / s, sh = dh / s;
    x.drawImage(im, (iw - sw) / 2, (ih - sh) / 2, sw, sh, dx, dy, dw, dh);
  }
  function wrapTitle(x, s, maxW, maxLines) {
    var words = String(s).split(/\s+/), lines = [], line = "";
    for (var i = 0; i < words.length; i++) {
      var t = line ? line + " " + words[i] : words[i];
      if (x.measureText(t).width > maxW && line) { lines.push(line); line = words[i]; if (lines.length >= maxLines) break; } else line = t;
    }
    if (line && lines.length < maxLines) lines.push(line);
    return lines;
  }
  function drawCase(x, o, scale) {
    var w = CW, h = CH, b = badge(o.id), rec = IMG[o.id];
    x.save(); x.translate(o.x, o.y); x.rotate(o.rot); if (scale) x.scale(scale, scale);
    x.shadowColor = "rgba(0,0,0,.6)"; x.shadowBlur = 20; x.shadowOffsetY = 10;
    x.fillStyle = "#0b0e13"; D.rr(x, -w / 2, -h / 2, w, h, 8); x.fill();
    x.shadowColor = "transparent";
    var ix = -w / 2 + 6, iy = -h / 2 + 22, iw = w - 10, ih = h - 27;
    x.save(); D.rr(x, ix, iy, iw, ih, 3); x.clip();
    if (rec && rec.st === 1) drawCover(x, rec.img, ix, iy, iw, ih);
    else {
      var gg = x.createLinearGradient(0, iy, 0, iy + ih); gg.addColorStop(0, "#2a3446"); gg.addColorStop(1, "#141a24"); x.fillStyle = gg; x.fillRect(ix, iy, iw, ih);
      x.fillStyle = "#e6ebf1"; x.font = "700 14px " + F.display; x.textAlign = "center";
      wrapTitle(x, o.title, iw - 12, 5).forEach(function (l, i) { x.fillText(l, 3, iy + 30 + i * 18); });
    }
    x.restore();
    x.fillStyle = b.col; D.rr(x, -w / 2 + 6, -h / 2 + 5, w - 10, 15, 3); x.fill();
    x.fillStyle = "#fff"; x.font = "800 11px " + F.mono; x.textAlign = "left"; x.fillText(b.p, -w / 2 + 11, -h / 2 + 16);
    x.fillStyle = "rgba(255,255,255,.08)"; x.fillRect(-w / 2, -h / 2 + 4, 5, h - 8);                     /* spine edge */
    var gl = x.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);                                        /* plastic gloss */
    gl.addColorStop(0, "rgba(255,255,255,.22)"); gl.addColorStop(0.35, "rgba(255,255,255,.02)"); gl.addColorStop(0.36, "rgba(255,255,255,0)"); gl.addColorStop(1, "rgba(255,255,255,.06)");
    x.fillStyle = gl; D.rr(x, -w / 2, -h / 2, w, h, 8); x.fill();
    x.strokeStyle = "rgba(255,255,255,.22)"; x.lineWidth = 1.5; D.rr(x, -w / 2 + 0.75, -h / 2 + 0.75, w - 1.5, h - 1.5, 8); x.stroke();
    if (o.hit) {
      var t = o.tier, s = o.stamp, a = Math.min(1, s * 2.2), k = 1.9 - Math.min(1, s * 1.6) * 0.9;
      x.globalAlpha = a; x.rotate(-0.32); x.scale(k, k);
      x.fillStyle = t.col; x.strokeStyle = t.ink; x.lineWidth = 3;
      D.rr(x, -54, -30, 108, 60, 10); x.fill();
      x.strokeStyle = "rgba(0,0,0,.45)"; x.lineWidth = 2; D.rr(x, -48, -24, 96, 48, 7); x.stroke();
      x.fillStyle = t.ink; x.textAlign = "center";
      x.font = "800 13px " + F.mono; x.fillText(t.label, 0, -6);
      x.font = "800 " + (t.txt.length > 4 ? 15 : 24) + "px " + F.display; x.fillText(t.txt, 0, 18);
      x.globalAlpha = 1;
    }
    x.restore();
  }

  /* ---------------- the game ---------------- */
  var S = {
    d: DIFF[0], items: [], si: 0, clock: 0, objs: [], fx: [], score: 0, goal: 0, lives: 0, flash: 0, shake: [],
    stats: null, bg: null, titleBg: null, ret: { x: W / 2, y: H / 2, on: false }, trail: [], lastPt: null, go: 0
  };
  var MO = Site.reducedMotion ? 0.62 : 1, GRAV = 1150 * MO;

  function bestOf(k) { return store.get("case404.best." + k, 0) || 0; }
  function paintBest(g) { var b = bestOf(S.d.key); g.setBest(b ? "Best (" + S.d.name + ") " + b : ""); }

  /* ---- menus ---- */
  function titleMenu(g) {
    g.menu({
      cls: "is-hero", kicker: "Arcade", title: "Review Score",
      sub: "Stamp the flying game cases with their Rate-O-Pedia score. Leave the hardware alone.",
      items: [
        { label: "Play", cls: "is-primary", act: function () { diffMenu(g); } },
        { label: "How to Play", act: function () { howMenu(g, function () { titleMenu(g); }); } },
        { label: "Best Scores", act: function () { bestMenu(g); } }
      ],
      back: function () { if (g.isFull()) g.full(false); },
      foot: "Esc, P or Start pauses. ⤢ plays in the full window."
    });
  }
  function diffMenu(g) {
    var items = DIFF.filter(function (d) { return !d.hidden || hardererUnlocked(); }).map(function (d) {
      var b = bestOf(d.key), won = store.get("case404.won." + d.key, false);
      return { label: d.name + (won ? " ✓" : ""), cls: d.hidden ? "is-gold" : "", sub: d.time + "s · " + d.lives + " ♥ · goal " + Math.round(d.goal * 100) + "%" + (b ? " · best " + b : ""),
        act: function () { startRound(g, d); } };
    });
    items.push({ label: "Back", act: function () { titleMenu(g); } });
    var di = DIFF.indexOf(S.d); g.menu({ title: "Pick a Difficulty", sub: "Survive the timer and reach the goal. The goal is a share of every point thrown this round.", items: items, back: function () { titleMenu(g); }, focus: di >= 0 ? di : 0 });
  }
  function howMenu(g, back) {
    var ul = el("ul", { class: "ak-howto" },
      el("li", { html: "<b>Stamp game cases</b> by clicking or slicing across them. Each one scores its Rate-O-Pedia average (minimum 1 point; unrated games score 1)." }),
      el("li", { html: "Stamps: <b style='color:#f0c23a'>GOLD</b> 4+, <b style='color:#d2d8e0'>SILVER</b> 2 to under 4, <b style='color:#c58551'>BRONZE</b> under 2." }),
      el("li", { html: "<b>Don't click the hardware</b> (controllers, consoles, headsets, remotes, mugs…). It costs a quarter of a heart." }),
      el("li", { html: "<b>A misclick</b> on empty space also costs a quarter of a heart. A case that gets away just scores nothing." }),
      el("li", { html: "<b>Win</b> by lasting until the timer runs out with your Review Score at or above the goal. Run out of hearts and the round ends." }),
      el("li", { html: "Keyboard: <kbd>←↑↓→</kbd> / <kbd>WASD</kbd> move the reticle, <kbd>Space</kbd> stamps. Controller: stick or D-pad, <kbd>A</kbd> stamps. <kbd>Esc</kbd> / <kbd>P</kbd> / <kbd>Start</kbd> pauses." }),
      el("li", { html: "Beat <b>Harder ;)</b> to unlock a secret fifth difficulty." }));
    g.menu({ title: "How to Play", body: ul, items: [{ label: "Back", act: back }], back: back, cls: "is-wide" });
  }
  function bestMenu(g) {
    var tb = el("table", {}, el("tr", {}, el("th", { text: "Difficulty" }), el("th", { text: "Best Review Score" }), el("th", { text: "Beaten" })));
    DIFF.forEach(function (d) {
      if (d.hidden && !hardererUnlocked()) return;
      tb.appendChild(el("tr", {}, el("td", { text: d.name }), el("td", { class: "n", text: String(bestOf(d.key) || "—") }), el("td", { text: store.get("case404.won." + d.key, false) ? "Yes" : "—" })));
    });
    g.menu({ title: "Best Scores", sub: "Saved in this browser.", body: tb, items: [{ label: "Back", act: function () { titleMenu(g); } }], back: function () { titleMenu(g); } });
  }

  /* ---- a round ---- */
  var roundToken = 0;
  function startRound(g, d) {
    S.d = d; paintBest(g);
    var token = ++roundToken;
    if (!g.isFull()) g.full(true);
    g.menu({ kicker: d.name, title: "Shuffling the cases…", sub: "Grabbing box art and the latest Rate-O-Pedia scores.", items: [{ label: "Cancel", act: function () { roundToken++; titleMenu(g); } }], back: function () { roundToken++; titleMenu(g); } });
    loadPool().then(function () {
      if (token !== roundToken) return;
      var items = [], t = 0.9, used = {};
      while (t < d.time - 0.5) {
        if (Math.random() < d.haz) items.push({ t: t, kind: "haz", type: HAZ_KEYS[(Math.random() * HAZ_KEYS.length) | 0] });
        else { var e = pickEntry(used); items.push(e ? { t: t, kind: "case", e: e } : { t: t, kind: "haz", type: "pad" }); }
        t += d.interval * (0.72 + Math.random() * 0.62);
      }
      var cases = items.filter(function (it) { return it.kind === "case"; });
      cases.forEach(function (it, i) { if (i < 16) want(it.e); });
      var ids = cases.map(function (it) { return it.e[0]; });
      var waitArt = new Promise(function (res) {
        var t0 = performance.now();
        (function check() {
          var ok = 0, done = 0; cases.slice(0, 16).forEach(function (it) { var r = IMG[it.e[0]]; if (r && r.st) { done++; if (r.st === 1) ok++; } });
          if (done >= Math.min(16, cases.length) || ok >= 10 || performance.now() - t0 > 4500) res(); else setTimeout(check, 120);
        })();
      });
      Promise.all([fetchScores(ids).then(function (m) { for (var k in m) SCORE[k] = m[k]; }), waitArt]).then(function () {
        if (token !== roundToken) return;
        var total = 0; cases.forEach(function (it) { total += pointsOf(it.e[0]); });
        S.items = items; S.si = 0; S.clock = 0; S.objs = []; S.fx = []; S.score = 0; S.lives = d.lives; S.flash = 0; S.go = 1.2;
        S.goal = Math.max(1, Math.round(d.goal * total)); S.shake = [];
        S.stats = { gold: 0, silver: 0, bronze: 0, escaped: 0, mis: 0, haz: 0, thrown: total };
        S.bg = makeBg((Math.random() * BG_N) | 0, (Math.random() * 1e9) | 0);
        S.ret.x = W / 2; S.ret.y = H / 2 + 40;
        g.start(); Site.sfx("open");
        g.toast(S.bg.bgName + " · goal " + S.goal, "info");
      });
    });
  }
  function lookahead() {
    for (var i = S.si; i < S.items.length && i < S.si + 14; i++) if (S.items[i].kind === "case") want(S.items[i].e);
  }
  function launch(it) {
    var o;
    if (it.kind === "case") {
      var e = it.e, r = IMG[e[0]];
      if (!r || r.st !== 1) {                         /* art not here (or broken): swap in a case whose art is loaded */
        var ok = []; for (var k in IMG) if (IMG[k].st === 1) ok.push(IMG[k].e);
        if (ok.length) e = ok[(Math.random() * ok.length) | 0];
      }
      o = { kind: "case", id: e[0], title: e[1], hw: CW / 2, hh: CH / 2 };
    } else { var hz = HAZ[it.type]; o = { kind: "haz", type: it.type, hw: hz.hw, hh: hz.hh }; }
    if (Math.random() < 0.26) {
      var right = Math.random() < 0.5;
      o.x = right ? W + 90 : -90; o.y = H - 60 - Math.random() * 170;
      o.vx = (right ? -1 : 1) * (380 + Math.random() * 180) * MO; o.vy = -(700 + Math.random() * 260) * MO;
    } else {
      o.x = 140 + Math.random() * (W - 280); o.y = H + 100;
      o.vx = (Math.random() * 2 - 1) * 190 * MO; o.vy = -(1050 + Math.random() * 260) * MO;
    }
    o.rot = (Math.random() * 2 - 1) * 0.35; o.vr = (Math.random() * 2 - 1) * (it.kind === "case" ? 0.7 : 1.6); o.hit = false; o.stamp = 0;
    S.objs.push(o);
  }
  function inside(o, px, py, pad) {
    var dx = px - o.x, dy = py - o.y, c = Math.cos(-o.rot), s = Math.sin(-o.rot);
    var lx = dx * c - dy * s, ly = dx * s + dy * c;
    return Math.abs(lx) <= o.hw + pad && Math.abs(ly) <= o.hh + pad;
  }
  /* returns "case" | "haz" | "used" (an already stamped thing) | null */
  function tryHit(g, px, py, pad) {
    for (var i = S.objs.length - 1; i >= 0; i--) {
      var o = S.objs[i];
      if (!inside(o, px, py, pad)) continue;
      if (o.hit) return "used";
      stamp(g, o); return o.kind;
    }
    return null;
  }
  function stamp(g, o) {
    o.hit = true; o.stamp = 0; o.vy = Math.min(o.vy, 0) - 160 * MO; o.vr *= 0.3;
    if (o.kind === "case") {
      var pts = pointsOf(o.id), t = tierOf(o.id); o.tier = t;
      S.score += pts; S.stats[t.label.toLowerCase()]++;
      S.fx.push({ k: "txt", x: o.x, y: o.y - 70, vy: -90, life: 1, txt: "+" + (Math.round(pts * 10) / 10), col: t.col });
      for (var i = 0; i < 16; i++) { var a = Math.random() * 6.28, v = 120 + Math.random() * 260; S.fx.push({ k: "bit", x: o.x, y: o.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: 0.8 + Math.random() * 0.4, col: t.col }); }
      Site.sfx(t.label === "GOLD" ? "success" : "tap");
    } else {
      S.stats.haz++;
      hurt(g, "Hazard: " + HAZ[o.type].name, o.x, o.y);
    }
  }
  function hurt(g, why, x, y) {
    S.lives = Math.max(0, Math.round((S.lives - 0.25) * 4) / 4); S.flash = 1;
    S.shake.push({ i: Math.ceil(S.lives) , t: 0.45 });
    g.toast(why + "  −¼ ♥", "bad");
    if (x != null) S.fx.push({ k: "txt", x: x, y: y - 30, vy: -70, life: 0.9, txt: "−¼ ♥", col: "#ff6b7c" });
    Site.sfx("error");
    if (S.lives <= 0) finish(g);
  }
  function click(g, px, py, pad) {
    if (g.state !== "play") return;
    var r = tryHit(g, px, py, pad);
    if (r === null) { S.stats.mis++; hurt(g, "Misclick", px, py); }
  }
  function slice(g, x0, y0, x1, y1) {
    var dx = x1 - x0, dy = y1 - y0, n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 18));
    for (var i = 1; i <= n && g.state === "play"; i++) {
      var px = x0 + dx * i / n, py = y0 + dy * i / n;
      for (var j = S.objs.length - 1; j >= 0; j--) { var o = S.objs[j]; if (!o.hit && inside(o, px, py, 4)) stamp(g, o); }
    }
  }
  function finish(g) {
    if (g.state !== "play") return;
    var sc = Math.round(S.score * 10) / 10, scR = Math.round(S.score), d = S.d, won = S.lives > 0 && S.score >= S.goal && S.clock >= d.time;
    var bk = "case404.best." + d.key, best = bestOf(d.key), rec = scR > best;
    if (rec) store.set(bk, scR);
    var unlock = false;
    if (won) { store.set("case404.won." + d.key, true); if (d.key === "harder" && !hardererUnlocked()) { store.set(HR_KEY, true); unlock = true; } if (Site.trophy) Site.trophy("rs-" + d.key); }
    g.setState("over"); paintBest(g); Site.sfx(won ? "success" : "error");
    var st = S.stats, kv = el("div", { class: "ak-kv" });
    function row(k, v) { kv.appendChild(el("span", { text: k })); kv.appendChild(el("b", { text: String(v) })); }
    row("Review Score", sc + (rec ? "  (new best)" : "")); row("Goal", S.goal);
    row("Stamped", st.gold + st.silver + st.bronze + "  (" + st.gold + " gold · " + st.silver + " silver · " + st.bronze + " bronze)");
    row("Got away", st.escaped); row("Misclicks", st.mis); row("Hardware clicked", st.haz); row("Hearts left", S.lives);
    g.menu({
      kicker: d.name, title: won ? "Stamped! Goal reached" : (S.lives <= 0 ? "Out of hearts" : "Time's up, just short"),
      cls: won ? "is-win" : "", body: kv,
      sub: unlock ? "You beat Harder ;) and unlocked Harder…er." : (won ? "Every case filed and graded." : "Stamp the box art, leave the hardware alone."),
      items: [
        { label: "Play Again", cls: "is-primary", act: function () { startRound(g, d); } },
        { label: "Change Difficulty", act: function () { diffMenu(g); } },
        { label: "Main Menu", act: function () { g.toTitle(); } }
      ],
      back: function () { g.toTitle(); }
    });
  }

  /* ---- drawing ---- */
  function hud(g, x) {
    var gg = x.createLinearGradient(0, 0, 0, HUD + 20); gg.addColorStop(0, "rgba(4,7,12,.85)"); gg.addColorStop(1, "rgba(4,7,12,0)");
    x.fillStyle = gg; x.fillRect(0, 0, W, HUD + 20);
    var done = S.score >= S.goal;
    D.text(x, "REVIEW SCORE", 26, 26, "700 14px " + F.mono, "#9aa6b4");
    D.text(x, String(Math.round(S.score)) + " / " + S.goal, 26, 58, "800 32px " + F.display, done ? "#7ee6a6" : "#ffffff");
    var bw = 220, p = Math.min(1, S.score / Math.max(1, S.goal));
    x.fillStyle = "rgba(255,255,255,.14)"; D.rr(x, 200, 42, bw, 12, 6); x.fill();
    x.fillStyle = done ? "#7ee6a6" : "#f0c23a"; D.rr(x, 200, 42, Math.max(12, bw * p), 12, 6); x.fill();
    var left = Math.max(0, S.d.time - S.clock), mm = (left / 60) | 0, ss = Math.floor(left % 60);
    D.text(x, mm + ":" + (ss < 10 ? "0" : "") + ss, W / 2, 52, "800 40px " + F.display, left < 10 ? "#ffcf6b" : "#ffffff", "center");
    var n = S.d.lives, sz = n > 4 ? 17 : 20, gap = sz * 2.6, hx = W - 30 - sz;
    for (var i = 0; i < n; i++) {
      var idx = n - 1 - i, fill = Math.max(0, Math.min(1, S.lives - idx)), cx = hx - i * gap, cy = 38, sh = 0;
      S.shake.forEach(function (s) { if (s.i === idx + 1 || (s.i === idx && fill === 0)) sh = Math.sin(s.t * 60) * 6 * s.t; });
      D.heart(x, cx + sh, cy, sz, fill);
    }
    x.textAlign = "left";
  }
  function drawReticle(x) {
    var r = S.ret; if (!r.on) return;
    x.save(); x.strokeStyle = "rgba(255,255,255,.95)"; x.lineWidth = 3; x.shadowColor = "rgba(0,0,0,.7)"; x.shadowBlur = 6;
    x.beginPath(); x.arc(r.x, r.y, 30, 0, 6.3); x.stroke();
    x.beginPath(); x.moveTo(r.x - 46, r.y); x.lineTo(r.x - 16, r.y); x.moveTo(r.x + 16, r.y); x.lineTo(r.x + 46, r.y);
    x.moveTo(r.x, r.y - 46); x.lineTo(r.x, r.y - 16); x.moveTo(r.x, r.y + 16); x.lineTo(r.x, r.y + 46); x.stroke();
    x.restore();
  }
  function drawTrail(x) {
    if (S.trail.length < 2) return;
    x.save(); x.lineCap = "round"; x.lineJoin = "round";
    for (var i = 1; i < S.trail.length; i++) {
      var a = S.trail[i], b = S.trail[i - 1], k = i / S.trail.length;
      x.strokeStyle = "rgba(255,240,200," + (k * 0.8).toFixed(2) + ")"; x.lineWidth = 2 + k * 9;
      x.beginPath(); x.moveTo(b.x, b.y); x.lineTo(a.x, a.y); x.stroke();
    }
    x.restore();
  }
  function drawFx(x) {
    S.fx.forEach(function (f) {
      x.globalAlpha = Math.max(0, Math.min(1, f.life));
      if (f.k === "bit") { x.fillStyle = f.col; x.fillRect(f.x - 4, f.y - 4, 8, 8); }
      else D.text(x, f.txt, f.x, f.y, "800 34px " + F.display, f.col, "center");
    });
    x.globalAlpha = 1;
  }

  /* title-screen ambience: a few cases drifting behind the menu */
  var drift = [];
  function seedDrift() {
    drift = [];
    var n = 9, list = POOL.pop.slice(0, 120);
    for (var i = 0; i < n; i++) {
      var e = list.length ? list[(Math.random() * list.length) | 0] : ["x:" + i, "Game", null];
      if (list.length) want(e);
      drift.push({ kind: "case", id: e[0], title: e[1], x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 24, vy: -10 - Math.random() * 18, rot: Math.random() - 0.5, vr: (Math.random() - 0.5) * 0.2, hit: false, s: 0.7 + Math.random() * 0.5 });
    }
  }

  A.register({
    id: "review-score", name: "Review Score", icon: "🎮", accent: "#f0c23a", W: W, H: H,
    blurb: "Stamp the flying game cases with their Rate-O-Pedia score. Skip the hardware.",
    sync: DIFF.map(function (d) { return { k: "best." + d.key, s: "case404.best." + d.key, t: "max" }; })
      .concat(DIFF.map(function (d) { return { k: "won." + d.key, s: "case404.won." + d.key, t: "or" }; }))
      .concat([{ k: "hr", s: HR_KEY, t: "or" }]),
    onSync: function (g) { paintBest(g); },
    init: function (g) {
      S.titleBg = makeBg((Math.random() * BG_N) | 0, (Math.random() * 1e9) | 0);
      loadPool().then(function () { seedDrift(); g.paint(); });
      paintBest(g);
      g.debug = function () { return S.objs.map(function (o) { return { k: o.kind, x: o.x, y: o.y, hit: o.hit }; }); };
    },
    title: function (g) { titleMenu(g); paintBest(g); },
    restart: function (g) { startRound(g, S.d); },
    alwaysAnimate: false,
    idle: function (g, dt) {
      drift.forEach(function (o) { o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.vr * dt; if (o.y < -120) { o.y = H + 120; o.x = Math.random() * W; } if (o.x < -120) o.x = W + 120; if (o.x > W + 120) o.x = -120; });
      if (g.state === "over" && S.fx.length) stepFx(dt);
    },
    update: function (g, dt) {
      S.clock += dt; if (S.go > 0) S.go -= dt;
      if (S.flash > 0) S.flash = Math.max(0, S.flash - dt * 2.4);
      S.shake = S.shake.filter(function (s) { s.t -= dt; return s.t > 0; });
      while (S.si < S.items.length && S.items[S.si].t <= S.clock) { launch(S.items[S.si]); S.si++; lookahead(); }
      for (var i = S.objs.length - 1; i >= 0; i--) {
        var o = S.objs[i];
        o.vy += GRAV * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.vr * dt;
        if (o.hit) o.stamp = Math.min(1, o.stamp + dt * 3);
        if ((o.y > H + 160 && o.vy > 0) || o.x < -220 || o.x > W + 220) { if (o.kind === "case" && !o.hit) S.stats.escaped++; S.objs.splice(i, 1); }
      }
      stepFx(dt);
      /* reticle: keyboard / controller */
      var p = g.pad, ax = 0, ay = 0, sp = 1050;
      if (g.key("ArrowLeft") || g.key("KeyA") || p.btn.left) ax -= 1;
      if (g.key("ArrowRight") || g.key("KeyD") || p.btn.right) ax += 1;
      if (g.key("ArrowUp") || g.key("KeyW") || p.btn.up) ay -= 1;
      if (g.key("ArrowDown") || g.key("KeyS") || p.btn.down) ay += 1;
      if (Math.abs(p.lx) > 0 || Math.abs(p.ly) > 0) { ax = p.lx; ay = p.ly; sp = 1250; }
      if (ax || ay) { S.ret.on = true; S.ret.x = Math.max(10, Math.min(W - 10, S.ret.x + ax * sp * dt)); S.ret.y = Math.max(HUD, Math.min(H - 10, S.ret.y + ay * sp * dt)); }
      if (p.hit.a || p.hit.rt || p.hit.x) { S.ret.on = true; click(g, S.ret.x, S.ret.y, 26); }
      if (S.trail.length) { S.trail.forEach(function (t) { t.a -= dt; }); S.trail = S.trail.filter(function (t) { return t.a > 0; }); }
      if (S.clock >= S.d.time) finish(g);
    },
    key: function (g, e) {
      if (g.state !== "play") return;
      if ((e.code === "Space" || e.code === "Enter") && !e.repeat) { S.ret.on = true; click(g, S.ret.x, S.ret.y, 26); }
    },
    pointer: function (g, type, x, y) {
      if (g.state !== "play") return;
      if (type === "down") { S.ret.on = false; S.lastPt = { x: x, y: y }; S.trail = [{ x: x, y: y, a: 0.18 }]; click(g, x, y, 6); }
      else if (type === "move" && g.pointer.down && S.lastPt) { slice(g, S.lastPt.x, S.lastPt.y, x, y); S.lastPt = { x: x, y: y }; S.trail.push({ x: x, y: y, a: 0.18 }); if (S.trail.length > 14) S.trail.shift(); }
      else if (type === "up") S.lastPt = null;
      else if (type === "move" && g.pointer.type === "mouse") S.ret.on = false;
    },
    draw: function (g, x) {
      var playing = g.state === "play" || g.state === "paused" || (g.state === "over" && S.bg);
      x.drawImage(playing && S.bg ? S.bg : S.titleBg, 0, 0);
      if (!playing || (g.state !== "play" && g.state !== "paused" && g.menuOpen() && !S.bg)) {
        drift.forEach(function (o) { x.globalAlpha = 0.85; drawCase(x, o, o.s); }); x.globalAlpha = 1; return;
      }
      for (var i = 0; i < S.objs.length; i++) { var o = S.objs[i]; if (o.kind === "case") drawCase(x, o); else drawHaz(x, o); }
      drawTrail(x); drawFx(x);
      if (S.flash > 0) { x.fillStyle = "rgba(220,40,60," + (S.flash * 0.25).toFixed(3) + ")"; x.fillRect(0, 0, W, H); }
      hud(g, x);
      if (S.go > 0 && g.state === "play") { x.globalAlpha = Math.min(1, S.go); D.text(x, S.go > 0.5 ? "Ready…" : "Stamp!", W / 2, H / 2, "800 84px " + F.display, "#ffffff", "center"); x.globalAlpha = 1; }
      if (g.state === "play") drawReticle(x);
    }
  });
  function stepFx(dt) {
    for (var i = S.fx.length - 1; i >= 0; i--) {
      var f = S.fx[i]; f.life -= dt;
      if (f.k === "bit") { f.vy += 900 * dt; f.x += f.vx * dt; f.y += f.vy * dt; } else f.y += f.vy * dt;
      if (f.life <= 0) S.fx.splice(i, 1);
    }
  }
})();
