/* arcade/row-home.js — "Row home": an endless rowing run through changing waters.
 *
 * Steer and row forward / back, dash past trouble, grab the lights. A hull health bar (repair kits float by),
 * power-ups (shield, magnet, slow-mo, lantern), hazards (rocks, logs, whirlpools, other boats, side-push waves,
 * night and storm legs), a combo multiplier for chaining lights without a hit, island checkpoints that change the
 * scene each leg, coins to spend in the Boatyard on upgrades and skins, and a Daily Voyage with a shared seed.
 * Keyboard: arrows / WASD move, Shift or Space dashes. Mouse / touch: hold and drag to steer, tap to dash.
 * Controller: left stick or D-pad, A or RT dashes. Esc / P / Start pauses.
 * Trophies (play.js): sailor 300, boat1k 1000, boat5k 5000 points in one run. features.game404 = false removes it.
 */
(function () {
  "use strict";
  if (!window.Site || !window.Arcade) return;
  var Site = window.Site, A = window.Arcade, D = A.draw, F = A.FONT, el = Site.el, store = Site.store;
  if (((Site.config && Site.config.features) || {}).game404 === false) return;

  var W = 1280, H = 720, PX_PER_M = 20, LEG_M = 600;
  var LEGS = [
    { name: "Calm Bay",        sea: ["#1b5f86", "#0d3a58"], foam: "rgba(200,235,255,.16)", rocks: 0.55, logs: 0,    boats: 0,    pools: 0,   waves: 0,    night: false, storm: false, lights: 1.4 },
    { name: "Rocky Straits",   sea: ["#18506f", "#0a2c43"], foam: "rgba(190,225,245,.15)", rocks: 1.25, logs: 0.25, boats: 0,    pools: 0,   waves: 0,    night: false, storm: false, lights: 1 },
    { name: "Night Crossing",  sea: ["#0b1a2e", "#050d18"], foam: "rgba(160,200,255,.10)", rocks: 0.8,  logs: 0.2,  boats: 0.1,  pools: 0,   waves: 0,    night: true,  storm: false, lights: 1.3 },
    { name: "Driftwood Run",   sea: ["#2a5d58", "#123630"], foam: "rgba(210,240,225,.15)", rocks: 0.45, logs: 1.1,  boats: 0.45, pools: 0,   waves: 0.15, night: false, storm: false, lights: 1 },
    { name: "Storm Sea",       sea: ["#26323f", "#111820"], foam: "rgba(220,230,240,.18)", rocks: 0.7,  logs: 0.3,  boats: 0.2,  pools: 0.1, waves: 0.6,  night: false, storm: true,  lights: 1.1 },
    { name: "Whirlpool Reach", sea: ["#1d4a6e", "#0b2238"], foam: "rgba(190,220,255,.16)", rocks: 0.6,  logs: 0.2,  boats: 0.15, pools: 0.6, waves: 0.2,  night: false, storm: false, lights: 1.1 }
  ];
  var POWERS = {
    shield: { name: "Shield",  col: "#5ec8ff", icon: "◈", dur: 0 },
    magnet: { name: "Magnet",  col: "#ff6b8a", icon: "∪", dur: 7 },
    slow:   { name: "Slow-Mo", col: "#b38cff", icon: "◷", dur: 5 },
    lantern:{ name: "Lantern", col: "#ffd76b", icon: "✦", dur: 12 }
  };
  var UPG = [
    { key: "hull",    name: "Hull",          max: 5, cost: [20, 40, 80, 140, 220], desc: function (l) { return (3 + l) + " hull points"; } },
    { key: "oars",    name: "Oars",          max: 4, cost: [15, 35, 70, 120],      desc: function (l) { return "Steering " + (100 + l * 12) + "%"; } },
    { key: "boost",   name: "Boost",         max: 4, cost: [20, 45, 90, 150],      desc: function (l) { return "Dash cooldown " + (3 - l * 0.35).toFixed(2) + "s"; } },
    { key: "magnet",  name: "Magnet",        max: 3, cost: [25, 60, 120],          desc: function (l) { return "Magnet lasts " + (7 + l * 2) + "s"; } },
    { key: "lantern", name: "Lantern",       max: 3, cost: [20, 50, 100],          desc: function (l) { return "Sees " + (100 + l * 20) + "% as far at night"; } },
    { key: "start",   name: "Launch Shield", max: 1, cost: [150],                  desc: function (l) { return l ? "Start every run shielded" : "Start every run with a shield"; } }
  ];
  var SKINS = [
    { key: "classic", name: "Classic",  cost: 0,   hull: "#c98a4b", trim: "#8a5a2b", sail: "#f4efe6" },
    { key: "maroon",  name: "Maroon",   cost: 30,  hull: "#8e2a3b", trim: "#5e1826", sail: "#f2d7dc" },
    { key: "royal",   name: "Royal",    cost: 60,  hull: "#2d4fa8", trim: "#1b2f66", sail: "#f6e7b0" },
    { key: "pirate",  name: "Pirate",   cost: 60,  hull: "#2a2622", trim: "#151210", sail: "#1b1b1b", mark: "#e8e1d6" },
    { key: "mint",    name: "Mint",     cost: 40,  hull: "#4fbf9a", trim: "#2b7a60", sail: "#fdfbf3" },
    { key: "neon",    name: "Neon",     cost: 120, hull: "#141420", trim: "#ff3fa4", sail: "#2ee6ff", glow: true },
    { key: "gold",    name: "Gilded",   cost: 150, hull: "#d9a520", trim: "#8a6410", sail: "#fff4c9", glow: true }
  ];

  /* ---------------- save data ---------------- */
  function lvl(k) { return (store.get("arcade.row-home.upg", {}) || {})[k] || 0; }
  function setLvl(k, v) { var u = store.get("arcade.row-home.upg", {}) || {}; u[k] = v; store.set("arcade.row-home.upg", u); }
  function coins() { return store.get("arcade.row-home.coins", 0) || 0; }
  function addCoins(n) { store.set("arcade.row-home.coins", Math.max(0, coins() + n)); }
  function ownedSkins() { return store.get("arcade.row-home.skins", ["classic"]) || ["classic"]; }
  function skin() { var k = store.get("arcade.row-home.skin", "classic"); return SKINS.filter(function (s) { return s.key === k; })[0] || SKINS[0]; }
  function today() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function seedOf(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function bestEndless() { return store.get("best404", 0) || 0; }
  function bestDaily() { return store.get("arcade.row-home.daily." + today(), 0) || 0; }

  /* ---------------- run state ---------------- */
  var R = null, wave = 0, MO = Site.reducedMotion ? 0.7 : 1;
  function newRun(mode) {
    var seed = mode === "daily" ? seedOf("row-home:" + today()) : (Math.random() * 4294967295) >>> 0;
    var maxHp = 3 + lvl("hull");
    R = {
      mode: mode, rnd: A.rng(seed), t: 0, dist: 0, speed: 230, score: 0, lights: 0, coinsRun: 0, chain: 0, bestChain: 0,
      boat: { x: W / 2, y: H - 130, vx: 0, vy: 0 }, hp: maxHp, maxHp: maxHp, inv: 0, dash: 0, dashCd: 0, dashDir: { x: 0, y: -1 },
      shield: lvl("start") > 0, pw: { magnet: 0, slow: 0, lantern: 0 }, things: [], fx: [],
      spawn: { rock: 1, log: 3, boat: 6, pool: 8, wave: 5, light: 0.6, coin: 1.6, power: 9, kit: 14, bolt: 3 },
      leg: 0, legShown: -1, islandAt: LEG_M, islands: 0, flash: 0, bolt: 0, gust: 0, target: null, rain: []
    };
    for (var i = 0; i < 90; i++) R.rain.push({ x: Math.random() * W, y: Math.random() * H, s: 0.6 + Math.random() * 0.6 });
  }
  function legOf(m) { return LEGS[Math.floor(m / LEG_M) % LEGS.length]; }
  function tierOf(m) { return Math.floor(m / (LEG_M * LEGS.length)); }

  /* ---------------- spawning ---------------- */
  function spawnTick(dt) {
    var L = legOf(R.dist), tier = tierOf(R.dist), dense = 1 + tier * 0.35 + Math.min(1, R.dist / 3000) * 0.4, r = R.rnd, s = R.spawn;
    function due(k, base, mult) {
      if (!mult) return false;
      s[k] -= dt * mult * dense; if (s[k] > 0) return false;
      s[k] = base * (0.6 + r() * 0.8); return true;
    }
    if (due("rock", 1.1, L.rocks)) { var rr = 18 + r() * 26; R.things.push({ k: "rock", x: 40 + r() * (W - 80), y: -60, r: rr, pts: rockPts(rr, r) }); }
    if (due("log", 2.6, L.logs)) { var lw = 140 + r() * 140; R.things.push({ k: "log", x: lw / 2 + r() * (W - lw), y: -60, w: lw, h: 26, rot: (r() - 0.5) * 0.5, vx: (r() - 0.5) * 50 }); }
    if (due("boat", 4.5, L.boats)) { var fromL = r() < 0.5; R.things.push({ k: "skiff", x: fromL ? -80 : W + 80, y: -40 - r() * 80, vx: (fromL ? 1 : -1) * (120 + r() * 90), w: 96, h: 36, col: ["#7a4b2a", "#2f5d8a", "#8a2f3b", "#3b6b3b"][(r() * 4) | 0] }); }
    if (due("pool", 6, L.pools)) R.things.push({ k: "pool", x: 140 + r() * (W - 280), y: -140, r: 90, spin: r() < 0.5 ? 1 : -1, hurtT: 0 });
    if (due("wave", 4.5, L.waves)) R.things.push({ k: "wave", y: -80, h: 70, dir: r() < 0.5 ? -1 : 1 });
    if (due("light", 0.75, L.lights)) R.things.push({ k: "light", x: 40 + r() * (W - 80), y: -30, r: 16 });
    if (due("coin", 1.7, 1)) { var cx = 60 + r() * (W - 120), n = r() < 0.3 ? 4 : 1; for (var i = 0; i < n; i++) R.things.push({ k: "coin", x: cx, y: -30 - i * 46, r: 14 }); }
    if (due("power", 11, 1)) { var keys = Object.keys(POWERS); if (!L.night) keys = keys.filter(function (k) { return k !== "lantern"; }); R.things.push({ k: "power", p: keys[(r() * keys.length) | 0], x: 60 + r() * (W - 120), y: -30, r: 22 }); }
    if (due("kit", 16, R.hp < R.maxHp ? 1 : 0.25)) R.things.push({ k: "kit", x: 60 + r() * (W - 120), y: -30, r: 20 });
    if (L.storm && due("bolt", 3.4, 1)) R.things.push({ k: "bolt", x: Math.max(80, Math.min(W - 80, R.boat.x + (r() - 0.5) * 520)), y: Math.max(200, Math.min(H - 80, R.boat.y + (r() - 0.5) * 240)), warn: 1.1, r: 70, fixed: true });
  }
  function rockPts(rad, r) { var p = [], n = 7 + ((r() * 3) | 0); for (var i = 0; i < n; i++) { var a = i / n * 6.283, k = 0.72 + r() * 0.36; p.push([Math.cos(a) * rad * k, Math.sin(a) * rad * k]); } return p; }

  /* ---------------- collisions ---------------- */
  function boatCircles() { var b = R.boat; return [{ x: b.x, y: b.y - 20, r: 15 }, { x: b.x, y: b.y + 16, r: 16 }]; }
  function circRect(c, rx, ry, hw, hh, rot) {
    var dx = c.x - rx, dy = c.y - ry, co = Math.cos(-rot || 0), si = Math.sin(-rot || 0), lx = dx * co - dy * si, ly = dx * si + dy * co;
    var nx = Math.max(-hw, Math.min(hw, lx)), ny = Math.max(-hh, Math.min(hh, ly));
    return (lx - nx) * (lx - nx) + (ly - ny) * (ly - ny) <= c.r * c.r;
  }
  function touches(o) {
    var cs = boatCircles();
    for (var i = 0; i < cs.length; i++) {
      var c = cs[i];
      if (o.k === "log") { if (circRect(c, o.x, o.y, o.w / 2, o.h / 2, o.rot)) return true; }
      else if (o.k === "skiff") { if (circRect(c, o.x, o.y, o.w / 2, o.h / 2, 0)) return true; }
      else { var dx = c.x - o.x, dy = c.y - o.y, rr = c.r + (o.k === "rock" ? o.r * 0.85 : o.r); if (dx * dx + dy * dy <= rr * rr) return true; }
    }
    return false;
  }
  function damage(g, why) {
    if (R.inv > 0 || R.dash > 0) return;
    if (R.shield) { R.shield = false; R.inv = 0.8; g.toast("Shield broke", "info"); Site.sfx("toggle"); burst(R.boat.x, R.boat.y, "#5ec8ff", 18); return; }
    R.hp -= 1; R.inv = 1.3; R.flash = 1;
    if (R.chain >= 4) g.toast("Combo lost", "bad");
    R.chain = 0;
    g.toast(why + "  −1 hull", "bad"); Site.sfx("error");
    burst(R.boat.x, R.boat.y, "#ffb08a", 14);
    if (R.hp <= 0) end(g);
  }
  function burst(x, y, col, n) { for (var i = 0; i < n; i++) { var a = Math.random() * 6.283, v = 80 + Math.random() * 220; R.fx.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6 + Math.random() * 0.4, col: col }); } }
  function mult() { return Math.min(5, 1 + Math.floor(R.chain / 4) * 0.5); }

  /* ---------------- update ---------------- */
  function update(g, dt) {
    var slow = R.pw.slow > 0 ? 0.5 : 1, wdt = dt * slow;
    R.t += dt; wave += dt * R.speed * slow * 0.5;
    var tier = tierOf(R.dist);
    R.speed = (230 + Math.min(260, R.dist * 0.07) + tier * 40) * MO;
    var adv = R.speed * wdt; R.dist += adv / PX_PER_M; R.score += adv / PX_PER_M;
    ["magnet", "slow", "lantern"].forEach(function (k) { if (R.pw[k] > 0) R.pw[k] = Math.max(0, R.pw[k] - dt); });
    if (R.inv > 0) R.inv -= dt; if (R.flash > 0) R.flash = Math.max(0, R.flash - dt * 2);
    if (R.dash > 0) R.dash -= dt; if (R.dashCd > 0) R.dashCd -= dt;
    if (R.bolt > 0) R.bolt -= dt * 3;

    /* leg banner + island checkpoints */
    var li = Math.floor(R.dist / LEG_M);
    if (li !== R.legShown) { R.legShown = li; var L0 = legOf(R.dist); if (li > 0) { R.islands++; R.hp = Math.min(R.maxHp, R.hp + 1); R.score += 100 * li; g.toast("Island " + li + " reached  +" + 100 * li + "  +1 hull", "good"); Site.sfx("success"); } R.banner = { txt: "Leg " + (li + 1) + " · " + L0.name, t: 2.6 }; R.isle = { y: -260, side: li % 2 ? 1 : -1 }; }
    if (R.banner) { R.banner.t -= dt; if (R.banner.t <= 0) R.banner = null; }
    if (R.isle) { R.isle.y += adv; if (R.isle.y > H + 300) R.isle = null; }

    /* input → boat */
    var b = R.boat, p = g.pad, ax = 0, ay = 0, steer = (440 + lvl("oars") * 52) * MO;
    if (g.key("ArrowLeft") || g.key("KeyA") || p.btn.left) ax -= 1;
    if (g.key("ArrowRight") || g.key("KeyD") || p.btn.right) ax += 1;
    if (g.key("ArrowUp") || g.key("KeyW") || p.btn.up) ay -= 1;
    if (g.key("ArrowDown") || g.key("KeyS") || p.btn.down) ay += 1;
    if (p.lx || p.ly) { ax = p.lx; ay = p.ly; }
    if (R.target && g.pointer.down) { var tx = R.target.x - b.x, ty = R.target.y - b.y; ax = Math.max(-1, Math.min(1, tx / 60)); ay = Math.max(-1, Math.min(1, ty / 60)); }
    if ((g.hit("ShiftLeft") || g.hit("ShiftRight") || g.hit("Space") || p.hit.a || p.hit.rt) ) dash(g, ax, ay);
    if (R.dash > 0) { b.vx = R.dashDir.x * 980; b.vy = R.dashDir.y * 980; }
    else { b.vx += (ax * steer - b.vx) * Math.min(1, dt * 8); b.vy += (ay * steer * 0.75 - b.vy) * Math.min(1, dt * 8); }
    if (R.gust) b.vx += R.gust * dt;
    /* side-push waves and whirlpools */
    R.things.forEach(function (o) {
      if (o.k === "wave" && Math.abs(b.y - o.y) < o.h / 2 + 10) b.vx += o.dir * 900 * dt;
      if (o.k === "pool") { var dx = o.x - b.x, dy = o.y - b.y, d = Math.hypot(dx, dy); if (d < o.r * 1.9 && d > 1) { var f = (1 - d / (o.r * 1.9)) * 1300; b.vx += dx / d * f * dt + (-dy / d) * o.spin * f * 0.5 * dt; b.vy += dy / d * f * dt; } }
    });
    b.x = Math.max(24, Math.min(W - 24, b.x + b.vx * dt)); b.y = Math.max(H * 0.3, Math.min(H - 48, b.y + b.vy * dt));
    if (legOf(R.dist).storm) { R.gust += ((Math.sin(R.t * 0.7) * 160) - R.gust) * dt; } else R.gust *= 0.9;

    /* world */
    spawnTick(wdt);
    var magnet = R.pw.magnet > 0, mr = 260 + lvl("magnet") * 30;
    for (var i = R.things.length - 1; i >= 0; i--) {
      var o = R.things[i];
      if (!o.fixed) o.y += adv;
      if (o.k === "log") { o.x += o.vx * wdt; }
      if (o.k === "skiff") { o.x += o.vx * wdt; }
      if (magnet && (o.k === "light" || o.k === "coin")) { var mx = b.x - o.x, my = b.y - o.y, md = Math.hypot(mx, my); if (md < mr) { o.x += mx / md * 620 * dt; o.y += my / md * 620 * dt; } }
      if (o.k === "bolt") {
        o.warn -= wdt;
        if (o.warn <= 0 && !o.struck) { o.struck = true; R.bolt = 1; Site.sfx("error"); if (Math.hypot(b.x - o.x, b.y - o.y) < o.r) damage(g, "Lightning"); }
        if (o.warn < -0.4) { R.things.splice(i, 1); continue; }
      } else if (o.k === "pool") {
        var pd = Math.hypot(b.x - o.x, b.y - o.y); o.hurtT -= dt;
        if (pd < 34 && o.hurtT <= 0) { o.hurtT = 1; damage(g, "Whirlpool"); }
      } else if (o.k === "wave") { /* push handled above */ }
      else if (touches(o)) {
        if (o.k === "light") { R.chain++; R.bestChain = Math.max(R.bestChain, R.chain); R.lights++; var pts = Math.round(25 * mult()); R.score += pts; R.fx.push({ txt: "+" + pts, x: o.x, y: o.y, vy: -60, life: 0.9, col: "#fff3c4" }); if (R.chain % 4 === 0) g.toast("Combo x" + mult().toFixed(1), "gold"); Site.sfx("tap"); R.things.splice(i, 1); continue; }
        if (o.k === "coin") { R.coinsRun++; R.fx.push({ txt: "+1", x: o.x, y: o.y, vy: -60, life: 0.7, col: "#f0c23a" }); Site.sfx("tap"); R.things.splice(i, 1); continue; }
        if (o.k === "kit") { if (R.hp < R.maxHp) { R.hp++; g.toast("Repair kit  +1 hull", "good"); } else { R.score += 50; g.toast("Hull full  +50", "good"); } Site.sfx("success"); R.things.splice(i, 1); continue; }
        if (o.k === "power") { takePower(g, o.p); R.things.splice(i, 1); continue; }
        if (o.k === "rock") damage(g, "Rock");
        else if (o.k === "log") damage(g, "Log");
        else if (o.k === "skiff") damage(g, "Another boat");
      }
      if (o.y > H + 200 || o.x < -300 || o.x > W + 300) R.things.splice(i, 1);
    }
    for (var j = R.fx.length - 1; j >= 0; j--) { var f = R.fx[j]; f.life -= dt; if (f.txt) f.y += f.vy * dt; else { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 300 * dt; } if (f.life <= 0) R.fx.splice(j, 1); }
    if (legOf(R.dist).storm) R.rain.forEach(function (d) { d.y += 900 * d.s * dt; d.x += (R.gust * 0.6 - 120) * dt; if (d.y > H) { d.y = -10; d.x = Math.random() * (W + 200); } });
  }
  function dash(g, ax, ay) {
    if (R.dashCd > 0) return;
    var m = Math.hypot(ax, ay); if (m < 0.2) { ax = 0; ay = -1; m = 1; }
    R.dashDir = { x: ax / m, y: ay / m }; R.dash = 0.2; R.dashCd = 3 - lvl("boost") * 0.35; Site.sfx("toggle");
    burst(R.boat.x, R.boat.y + 30, "rgba(220,240,255,.9)", 10);
  }
  function takePower(g, k) {
    var P = POWERS[k];
    if (k === "shield") R.shield = true;
    else if (k === "magnet") R.pw.magnet = P.dur + lvl("magnet") * 2;
    else R.pw[k] = P.dur;
    g.toast(P.name + "!", "good"); Site.sfx("success"); burst(R.boat.x, R.boat.y, P.col, 16);
  }

  /* ---------------- end of run ---------------- */
  function end(g) {
    if (g.state !== "play") return;
    var s = Math.floor(R.score), bonus = Math.floor(s / 100), earned = R.coinsRun + bonus, rec = false;
    addCoins(earned);
    if (R.mode === "daily") { var dk = "arcade.row-home.daily." + today(); if (s > (store.get(dk, 0) || 0)) { store.set(dk, s); rec = true; } }
    else if (s > bestEndless()) { store.set("best404", s); rec = true; }
    if (Site.trophy) { if (s >= 300) Site.trophy("sailor"); if (s >= 1000) Site.trophy("boat1k"); if (s >= 5000) Site.trophy("boat5k"); }
    g.setState("over"); paintBest(g); Site.sfx(rec ? "success" : "error");
    var kv = el("div", { class: "ak-kv" });
    function row(k, v) { kv.appendChild(el("span", { text: k })); kv.appendChild(el("b", { text: String(v) })); }
    row("Score", s + (rec ? "  (new best)" : "")); row("Distance", Math.floor(R.dist) + " m"); row("Islands reached", R.islands);
    row("Lights", R.lights); row("Best combo", R.bestChain + " in a row"); row("Coins", "+" + earned + "  (" + R.coinsRun + " found, " + bonus + " score bonus)");
    g.menu({
      kicker: R.mode === "daily" ? "Daily Voyage · " + today() : "Endless Voyage", title: "Sunk at " + Math.floor(R.dist) + " m", body: kv,
      sub: rec ? "New personal best. The lighthouse keeper is impressed." : "Have another go?",
      items: [
        { label: "Row Again", cls: "is-primary", act: function () { go(g, R.mode); } },
        { label: "Boatyard", sub: coins() + " coins", act: function () { shop(g, function () { g.toTitle(); }); } },
        { label: "Main Menu", act: function () { g.toTitle(); } }
      ],
      back: function () { g.toTitle(); }
    });
  }
  function go(g, mode) { newRun(mode); g.start(); R.legShown = -1; Site.sfx("open"); }
  function paintBest(g) { var b = bestEndless(); g.setBest((b ? "Best " + b + "  ·  " : "") + coins() + " coins"); }

  /* ---------------- menus ---------------- */
  function titleMenu(g) {
    paintBest(g);
    g.menu({
      cls: "is-hero", kicker: "Arcade", title: "Row Home",
      sub: "Row through the islands. Dodge rocks, logs, whirlpools and storms. Grab the lights and chain them for combos.",
      items: [
        { label: "Endless Voyage", cls: "is-primary", sub: bestEndless() ? "Best " + bestEndless() : "Go as far as you can", act: function () { go(g, "endless"); } },
        { label: "Daily Voyage", sub: "Same seas for everyone today" + (bestDaily() ? " · your best " + bestDaily() : ""), act: function () { go(g, "daily"); } },
        { label: "Boatyard", sub: coins() + " coins · upgrades and skins", act: function () { shop(g, function () { titleMenu(g); }); } },
        { label: "How to Play", act: function () { howMenu(g, function () { titleMenu(g); }); } },
        { label: "Best Scores", act: function () { bestMenu(g); } }
      ],
      back: function () { if (g.isFull()) g.full(false); },
      foot: "Esc, P or Start pauses. ⤢ plays in the full window."
    });
  }
  function howMenu(g, back) {
    var ul = el("ul", { class: "ak-howto" },
      el("li", { html: "<kbd>←→</kbd> / <kbd>A D</kbd> steer, <kbd>↑↓</kbd> / <kbd>W S</kbd> row forward and back, <kbd>Shift</kbd> or <kbd>Space</kbd> dashes (you can't be hurt mid-dash). Controller: stick or D-pad, <kbd>A</kbd> / <kbd>RT</kbd> dashes. Mouse or touch: hold and drag to steer, tap to dash." }),
      el("li", { html: "Your <b>hull</b> takes hits from rocks, logs, other boats, whirlpool centres and lightning. Repair kits fix it, and every island you reach patches one point." }),
      el("li", { html: "<b>Lights</b> score points. Chain them without getting hit to raise the <b>combo</b> (up to x5)." }),
      el("li", { html: "Power-ups: <b style='color:#5ec8ff'>Shield</b> blocks a hit, <b style='color:#ff6b8a'>Magnet</b> pulls in lights and coins, <b style='color:#b38cff'>Slow-Mo</b> slows the sea, <b style='color:#ffd76b'>Lantern</b> lights up the night." }),
      el("li", { html: "Waves push you sideways, whirlpools drag you in, storms bring wind and lightning (watch for the warning rings)." }),
      el("li", { html: "Every " + LEG_M + " m is an <b>island</b> and a new stretch of sea. Coins (plus a bonus from your score) buy upgrades and skins in the <b>Boatyard</b>." }));
    g.menu({ title: "How to Play", body: ul, items: [{ label: "Back", act: back }], back: back, cls: "is-wide" });
  }
  function bestMenu(g) {
    var kv = el("div", { class: "ak-kv" });
    function row(k, v) { kv.appendChild(el("span", { text: k })); kv.appendChild(el("b", { text: String(v) })); }
    row("Endless Voyage", bestEndless() || "—"); row("Daily Voyage (today)", bestDaily() || "—"); row("Coins", coins());
    g.menu({ title: "Best Scores", sub: "Saved in this browser.", body: kv, items: [{ label: "Back", act: function () { titleMenu(g); } }], back: function () { titleMenu(g); } });
  }
  function shop(g, back, focus) {
    var items = [], c = coins();
    UPG.forEach(function (u) {
      var l = lvl(u.key), maxed = l >= u.max, cost = maxed ? 0 : u.cost[l];
      items.push({ label: u.name + " " + (u.max > 1 ? "Lv " + l + "/" + u.max : (l ? "✓" : "")), sub: u.desc(l) + (maxed ? " · maxed" : " · next " + cost + " coins"),
        disabled: maxed || c < cost, act: function () { addCoins(-cost); setLvl(u.key, l + 1); Site.sfx("success"); shop(g, back, items.indexOf(this)); } });
    });
    var own = ownedSkins(), cur = skin().key;
    SKINS.forEach(function (s) {
      var has = own.indexOf(s.key) >= 0;
      items.push({ label: "Skin: " + s.name + (cur === s.key ? " ✓" : ""), sub: has ? (cur === s.key ? "Equipped" : "Owned · equip") : s.cost + " coins", cls: s.glow ? "is-gold" : "",
        disabled: cur === s.key || (!has && c < s.cost),
        act: function () { if (!has) { addCoins(-s.cost); own.push(s.key); store.set("arcade.row-home.skins", own); } store.set("arcade.row-home.skin", s.key); Site.sfx("success"); shop(g, back); } });
    });
    items.forEach(function (it, i) { var a = it.act; it.act = function () { a.call(it); }; it.i = i; });
    items.push({ label: "Back", act: back });
    paintBest(g);
    g.menu({ title: "Boatyard", sub: c + " coins. Upgrades last forever (in this browser).", items: items, back: back, grid: true, cls: "is-wide", focus: focus || 0 });
  }

  /* ---------------- drawing ---------------- */
  function drawSea(x, L, t) {
    var gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, L.sea[0]); gr.addColorStop(1, L.sea[1]);
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    x.strokeStyle = L.foam; x.lineWidth = 2;
    for (var r = 0; r < 12; r++) {
      var y = ((r * 66 + wave) % (H + 66)) - 33; x.beginPath();
      for (var px = 0; px <= W; px += 24) x.lineTo(px, y + Math.sin(px / 60 + r * 1.7 + t * 0.6) * 6);
      x.stroke();
    }
  }
  function drawIsland(x) {
    var I = R.isle; if (!I) return;
    var cx = I.side > 0 ? W - 90 : 90, cy = I.y;
    x.fillStyle = "rgba(255,255,255,.18)"; x.beginPath(); x.ellipse(cx, cy, 190, 120, 0, 0, 6.3); x.fill();
    x.fillStyle = "#e6cf8f"; x.beginPath(); x.ellipse(cx, cy, 170, 104, 0, 0, 6.3); x.fill();
    x.fillStyle = "#3f8a4a"; x.beginPath(); x.ellipse(cx + I.side * 20, cy - 8, 120, 70, 0, 0, 6.3); x.fill();
    x.fillStyle = "#e9e3d6"; x.fillRect(cx - 12, cy - 90, 24, 70); x.fillStyle = "#cd4257"; x.fillRect(cx - 12, cy - 70, 24, 14); x.fillRect(cx - 12, cy - 42, 24, 14);
    x.fillStyle = "#fff3c4"; x.beginPath(); x.arc(cx, cy - 96, 10, 0, 6.3); x.fill();
    x.fillStyle = "#6b4a2a"; x.fillRect(I.side > 0 ? cx - 260 : cx + 170, cy + 6, 90, 12);
  }
  function drawThing(x, o, t) {
    switch (o.k) {
      case "rock":
        x.fillStyle = "rgba(255,255,255,.16)"; x.beginPath(); x.ellipse(o.x, o.y + o.r * 0.55, o.r * 1.2, o.r * 0.32, 0, 0, 6.3); x.fill();
        x.fillStyle = "#3a4654"; x.beginPath(); o.pts.forEach(function (p, i) { i ? x.lineTo(o.x + p[0], o.y + p[1]) : x.moveTo(o.x + p[0], o.y + p[1]); }); x.closePath(); x.fill();
        x.fillStyle = "rgba(255,255,255,.12)"; x.beginPath(); x.ellipse(o.x - o.r * 0.25, o.y - o.r * 0.3, o.r * 0.4, o.r * 0.2, -0.5, 0, 6.3); x.fill();
        break;
      case "log":
        x.save(); x.translate(o.x, o.y); x.rotate(o.rot);
        x.fillStyle = "#6b4426"; D.rr(x, -o.w / 2, -o.h / 2, o.w, o.h, o.h / 2); x.fill();
        x.strokeStyle = "rgba(0,0,0,.25)"; x.lineWidth = 2; x.beginPath(); x.moveTo(-o.w / 2 + 14, -4); x.lineTo(o.w / 2 - 20, -4); x.moveTo(-o.w / 2 + 30, 5); x.lineTo(o.w / 2 - 12, 5); x.stroke();
        x.fillStyle = "#b9875a"; x.beginPath(); x.ellipse(o.w / 2 - 4, 0, 7, o.h / 2 - 2, 0, 0, 6.3); x.fill();
        x.restore(); break;
      case "skiff":
        x.save(); x.translate(o.x, o.y); x.scale(o.vx > 0 ? 1 : -1, 1);
        x.fillStyle = "rgba(255,255,255,.18)"; x.beginPath(); x.ellipse(-o.w / 2 - 10, 0, 24, 8, 0, 0, 6.3); x.fill();
        x.fillStyle = o.col; x.beginPath(); x.moveTo(-o.w / 2, -o.h / 2); x.lineTo(o.w / 2 - 14, -o.h / 2); x.quadraticCurveTo(o.w / 2 + 12, 0, o.w / 2 - 14, o.h / 2); x.lineTo(-o.w / 2, o.h / 2); x.closePath(); x.fill();
        x.fillStyle = "rgba(0,0,0,.25)"; x.fillRect(-o.w / 2 + 10, -o.h / 2 + 7, o.w - 34, o.h - 14);
        x.fillStyle = "#f1d3a8"; x.beginPath(); x.arc(-6, 0, 8, 0, 6.3); x.fill();
        x.restore(); break;
      case "pool":
        x.save(); x.translate(o.x, o.y);
        for (var k = 0; k < 5; k++) { x.strokeStyle = "rgba(200,235,255," + (0.08 + k * 0.06).toFixed(2) + ")"; x.lineWidth = 4; x.beginPath(); x.arc(0, 0, o.r * (1 - k * 0.18), t * o.spin * (1.5 + k) , t * o.spin * (1.5 + k) + 4.2); x.stroke(); }
        x.fillStyle = "rgba(0,10,20,.55)"; x.beginPath(); x.arc(0, 0, 22, 0, 6.3); x.fill();
        x.restore(); break;
      case "wave":
        x.fillStyle = "rgba(220,240,255,.14)"; x.fillRect(0, o.y - o.h / 2, W, o.h);
        x.strokeStyle = "rgba(240,250,255,.55)"; x.lineWidth = 4;
        for (var ax = (t * 140 * o.dir) % 80 - 80; ax < W + 80; ax += 80) { x.beginPath(); x.moveTo(ax - o.dir * 14, o.y - 14); x.lineTo(ax + o.dir * 6, o.y); x.lineTo(ax - o.dir * 14, o.y + 14); x.stroke(); }
        break;
      case "light":
        var g2 = x.createRadialGradient(o.x, o.y, 0, o.x, o.y, 30); g2.addColorStop(0, "rgba(255,236,170,.95)"); g2.addColorStop(1, "rgba(255,236,170,0)");
        x.fillStyle = g2; x.beginPath(); x.arc(o.x, o.y, 30, 0, 6.3); x.fill();
        x.fillStyle = "#fff6d6"; x.beginPath(); x.arc(o.x, o.y, 7, 0, 6.3); x.fill(); break;
      case "coin":
        var sq = Math.abs(Math.cos(t * 4 + o.x)); x.fillStyle = "#f0c23a"; x.beginPath(); x.ellipse(o.x, o.y, o.r * Math.max(0.2, sq), o.r, 0, 0, 6.3); x.fill();
        x.strokeStyle = "#a97c10"; x.lineWidth = 2; x.stroke(); break;
      case "kit":
        x.fillStyle = "#f4f4f4"; D.rr(x, o.x - 20, o.y - 16, 40, 32, 6); x.fill(); x.fillStyle = "#e23b3b"; x.fillRect(o.x - 4, o.y - 11, 8, 22); x.fillRect(o.x - 11, o.y - 4, 22, 8); break;
      case "power":
        var P = POWERS[o.p], pul = 1 + Math.sin(t * 6) * 0.08;
        x.save(); x.translate(o.x, o.y); x.scale(pul, pul);
        x.fillStyle = "rgba(255,255,255,.12)"; x.beginPath(); x.arc(0, 0, 28, 0, 6.3); x.fill();
        x.strokeStyle = P.col; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 22, 0, 6.3); x.stroke();
        x.fillStyle = P.col; x.font = "800 22px " + F.display; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(P.icon, 0, 1); x.textBaseline = "alphabetic";
        x.restore(); break;
      case "bolt":
        if (o.warn > 0) { x.strokeStyle = "rgba(255,230,120," + (0.4 + Math.sin(t * 20) * 0.3).toFixed(2) + ")"; x.lineWidth = 4; x.setLineDash([10, 8]); x.beginPath(); x.arc(o.x, o.y, o.r * (0.6 + 0.4 * (1 - o.warn / 1.1)), 0, 6.3); x.stroke(); x.setLineDash([]); }
        else { x.strokeStyle = "#fffbe0"; x.lineWidth = 6; x.beginPath(); x.moveTo(o.x + 30, 0); x.lineTo(o.x - 20, o.y * 0.4); x.lineTo(o.x + 15, o.y * 0.6); x.lineTo(o.x - 10, o.y * 0.85); x.lineTo(o.x, o.y); x.stroke(); }
        break;
    }
  }
  function drawBoat(x, b, sk, t) {
    var tilt = Math.max(-0.3, Math.min(0.3, b.vx / 900));
    x.save(); x.translate(b.x, b.y); x.rotate(tilt);
    x.fillStyle = "rgba(255,255,255,.22)"; x.beginPath(); x.moveTo(-14, 40); x.lineTo(-30, 80); x.lineTo(30, 80); x.lineTo(14, 40); x.fill();
    if (R && R.inv > 0 && Math.floor(R.inv * 12) % 2) x.globalAlpha = 0.45;
    if (sk.glow) { x.shadowColor = sk.trim; x.shadowBlur = 18; }
    x.fillStyle = sk.hull; x.beginPath(); x.moveTo(0, -46); x.quadraticCurveTo(26, -20, 22, 34); x.quadraticCurveTo(0, 46, -22, 34); x.quadraticCurveTo(-26, -20, 0, -46); x.fill();
    x.shadowBlur = 0;
    x.strokeStyle = sk.trim; x.lineWidth = 4; x.stroke();
    x.fillStyle = "rgba(0,0,0,.22)"; x.beginPath(); x.moveTo(0, -34); x.quadraticCurveTo(16, -14, 14, 28); x.quadraticCurveTo(0, 36, -14, 28); x.quadraticCurveTo(-16, -14, 0, -34); x.fill();
    var row = Math.sin(t * 9) * 0.5;                     /* oars */
    x.strokeStyle = "#d8b07a"; x.lineWidth = 4;
    x.beginPath(); x.moveTo(-14, 4); x.lineTo(-44, 4 + row * 26); x.moveTo(14, 4); x.lineTo(44, 4 + row * 26); x.stroke();
    x.fillStyle = sk.sail; x.beginPath(); x.moveTo(2, -30); x.lineTo(2, 18); x.lineTo(30, 10); x.closePath(); x.fill();
    if (sk.mark) { x.fillStyle = sk.mark; x.beginPath(); x.arc(12, 0, 5, 0, 6.3); x.fill(); }
    x.strokeStyle = "#e8dcc8"; x.lineWidth = 3; x.beginPath(); x.moveTo(0, -34); x.lineTo(0, 22); x.stroke();
    x.restore();
    if (R && R.shield) { x.strokeStyle = "rgba(94,200,255,.85)"; x.lineWidth = 3; x.beginPath(); x.arc(b.x, b.y, 56 + Math.sin(t * 5) * 3, 0, 6.3); x.stroke(); x.fillStyle = "rgba(94,200,255,.1)"; x.fill(); }
  }
  function hud(g, x) {
    var gr = x.createLinearGradient(0, 0, 0, 90); gr.addColorStop(0, "rgba(4,7,12,.8)"); gr.addColorStop(1, "rgba(4,7,12,0)"); x.fillStyle = gr; x.fillRect(0, 0, W, 90);
    D.text(x, "SCORE", 26, 26, "700 14px " + F.mono, "#9aa6b4");
    D.text(x, String(Math.floor(R.score)), 26, 60, "800 34px " + F.display, "#ffffff");
    var m = mult(); if (m > 1 || R.chain) D.text(x, "x" + m.toFixed(1) + "  · " + R.chain + " chain", 170, 58, "700 20px " + F.display, m > 1 ? "#ffd76b" : "#c6ced8");
    /* hull */
    for (var i = 0; i < R.maxHp; i++) { x.fillStyle = i < R.hp ? (R.hp <= 1 ? "#ff5d6c" : "#7ee6a6") : "rgba(255,255,255,.15)"; D.rr(x, 26 + i * 30, 70, 24, 10, 4); x.fill(); }
    /* leg progress */
    var L = legOf(R.dist), into = (R.dist % LEG_M) / LEG_M, li = Math.floor(R.dist / LEG_M);
    D.text(x, "Leg " + (li + 1) + " · " + L.name, W / 2, 30, "700 18px " + F.display, "#e6ebf1", "center");
    x.fillStyle = "rgba(255,255,255,.15)"; D.rr(x, W / 2 - 160, 42, 320, 8, 4); x.fill();
    x.fillStyle = "#7fd3ff"; D.rr(x, W / 2 - 160, 42, Math.max(8, 320 * into), 8, 4); x.fill();
    D.text(x, Math.floor(R.dist) + " m", W / 2, 74, "600 15px " + F.mono, "#c6ced8", "center");
    /* coins + dash + powers */
    D.text(x, "● " + R.coinsRun, W - 26, 34, "800 22px " + F.display, "#f0c23a", "right");
    var cd = Math.max(0, R.dashCd) / (3 - lvl("boost") * 0.35);
    x.strokeStyle = "rgba(255,255,255,.2)"; x.lineWidth = 5; x.beginPath(); x.arc(W - 46, 70, 15, 0, 6.3); x.stroke();
    x.strokeStyle = cd > 0 ? "#9aa6b4" : "#7fd3ff"; x.beginPath(); x.arc(W - 46, 70, 15, -1.57, -1.57 + 6.283 * (1 - cd)); x.stroke();
    D.text(x, "DASH", W - 70, 76, "700 12px " + F.mono, cd > 0 ? "#9aa6b4" : "#7fd3ff", "right");
    var px = W - 140;
    ["magnet", "slow", "lantern"].forEach(function (k) { if (R.pw[k] > 0) { D.text(x, POWERS[k].icon + " " + Math.ceil(R.pw[k]) + "s", px, 76, "700 16px " + F.display, POWERS[k].col, "right"); px -= 80; } });
    if (R.banner) { x.globalAlpha = Math.min(1, R.banner.t); D.text(x, R.banner.txt, W / 2, H * 0.36, "800 54px " + F.display, "#ffffff", "center"); x.globalAlpha = 1; }
  }

  var tTitle = 0, titleBoat = { x: W / 2, y: H * 0.62, vx: 0 };
  A.register({
    id: "row-home", name: "Row Home", icon: "🚣", accent: "#7fd3ff", W: W, H: H,
    blurb: "Row through the islands, dodge trouble, grab the lights. Coins buy upgrades in the Boatyard.",
    sync: [
      { k: "best", s: "best404", t: "max" }, { k: "coins", s: "arcade.row-home.coins", t: "max" },
      { k: "upg", s: "arcade.row-home.upg", t: "maxmap" }, { k: "skins", s: "arcade.row-home.skins", t: "union" }
    ],
    onSync: function (g) { paintBest(g); },
    init: function (g) { paintBest(g); g.debug = function (m) { if (R) { R.dist = m; } }; },
    title: function (g) { titleMenu(g); },
    restart: function (g) { go(g, R ? R.mode : "endless"); },
    idle: function (g, dt) { tTitle += dt; wave += dt * 30; titleBoat.x = W / 2 + Math.sin(tTitle * 0.6) * 160; titleBoat.vx = Math.cos(tTitle * 0.6) * 96; },
    update: update,
    pointer: function (g, type, px, py) {
      if (g.state !== "play") return;
      if (type === "down") { R.target = { x: px, y: py }; R.downAt = performance.now(); R.downPt = { x: px, y: py }; }
      else if (type === "move" && g.pointer.down) R.target = { x: px, y: py };
      else if (type === "up") {
        if (R.downAt && performance.now() - R.downAt < 200 && R.downPt && Math.hypot(px - R.downPt.x, py - R.downPt.y) < 14) dash(g, (px - R.boat.x) / 200, (py - R.boat.y) / 200);
        R.target = null; R.downAt = 0;
      }
    },
    draw: function (g, x) {
      var t = performance.now() / 1000;
      if (!R || g.state === "title") {
        drawSea(x, LEGS[0], t); drawBoat(x, titleBoat, skin(), t); return;
      }
      var L = legOf(R.dist);
      drawSea(x, L, t); drawIsland(x);
      R.things.forEach(function (o) { if (o.k === "wave" || o.k === "pool") drawThing(x, o, t); });
      R.things.forEach(function (o) { if (o.k !== "wave" && o.k !== "pool" && o.k !== "light") drawThing(x, o, t); });
      drawBoat(x, R.boat, skin(), t);
      if (L.night) {                                  /* darkness with a pool of light around the boat */
        var rad = (190 + lvl("lantern") * 38) * (R.pw.lantern > 0 ? 1.9 : 1);
        var c = x.createRadialGradient(R.boat.x, R.boat.y, rad * 0.35, R.boat.x, R.boat.y, rad);
        c.addColorStop(0, "rgba(2,4,10,0)"); c.addColorStop(1, "rgba(2,4,10,.93)");
        x.fillStyle = c; x.fillRect(0, 0, W, H);
      }
      R.things.forEach(function (o) { if (o.k === "light") drawThing(x, o, t); });
      if (L.storm) {
        x.strokeStyle = "rgba(200,215,235,.35)"; x.lineWidth = 1.5; x.beginPath();
        R.rain.forEach(function (d) { x.moveTo(d.x, d.y); x.lineTo(d.x - 8 + R.gust * 0.02, d.y + 22); }); x.stroke();
        x.fillStyle = "rgba(10,14,22,.25)"; x.fillRect(0, 0, W, H);
      }
      R.fx.forEach(function (f) { x.globalAlpha = Math.max(0, Math.min(1, f.life)); if (f.txt) D.text(x, f.txt, f.x, f.y, "800 26px " + F.display, f.col, "center"); else { x.fillStyle = f.col; x.fillRect(f.x - 3, f.y - 3, 6, 6); } }); x.globalAlpha = 1;
      if (R.bolt > 0) { x.fillStyle = "rgba(255,255,240," + (R.bolt * 0.5).toFixed(2) + ")"; x.fillRect(0, 0, W, H); }
      if (R.flash > 0) { x.fillStyle = "rgba(220,40,60," + (R.flash * 0.22).toFixed(2) + ")"; x.fillRect(0, 0, W, H); }
      if (R.pw.slow > 0) { x.fillStyle = "rgba(150,110,255,.08)"; x.fillRect(0, 0, W, H); }
      hud(g, x);
    }
  });
})();
