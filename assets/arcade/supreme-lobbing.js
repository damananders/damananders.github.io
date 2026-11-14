/* arcade/supreme-lobbing.js — "Supreme Lobbing": turn-based raft-vs-raft lobbing.
 *
 * Your crew lobs things in an arc at the enemy raft; theirs lobs back. Wind and waves change every turn. Rafts are
 * built from planks and walls that break, exposing the crew behind them. Each crew member has their own health and
 * a once-per-battle special shot. Ammo: rocks, bouncers, splitters, bombs, fire, a homing seagull, and repair kits
 * you lob onto your own raft. Coins from battles buy upgrades and decor at the Shipwright. An island campaign with
 * region bosses, an endless survival mode, enemy AI from Sloppy to Scary, and two-player hot-seat Versus.
 *
 * Aim: drag back from anywhere and let go (mouse / touch). Keyboard: arrows aim, hold Space to charge, release to
 * throw, Q / E switch thrower, Z / X or 1-8 pick ammo. Controller: left stick aims, hold RT (or A) to charge,
 * LB / RB switch thrower, D-pad up / down picks ammo. Esc / P / Start pauses.
 */
(function () {
  "use strict";
  if (!window.Site || !window.Arcade) return;
  var Site = window.Site, A = window.Arcade, D = A.draw, F = A.FONT, el = Site.el, store = Site.store;
  if (((Site.config && Site.config.features) || {}).lobbing === false) return;

  var W = 1280, H = 720, WY = 566, PW = 40, BH = 30, GRAV = 900, STEP = 1 / 120;
  var NS = "arcade.supreme-lobbing.";
  function sget(k, f) { var v = store.get(NS + k, f); return v == null ? f : v; }
  function sset(k, v) { store.set(NS + k, v); }

  /* ---------------- ammo ---------------- */
  var AMMO = {
    rock:    { name: "Rock",         icon: "●", col: "#9aa3ad", crew: 30, block: 1, rad: 30, cost: 0 },
    bouncer: { name: "Bouncer",      icon: "◎", col: "#4fd1c5", crew: 22, block: 1, rad: 26, cost: 40, bounces: 3 },
    splitter:{ name: "Splitter",     icon: "✣", col: "#f6ad55", crew: 18, block: 1, rad: 24, cost: 60 },
    bomb:    { name: "Bomb",         icon: "✹", col: "#fc8181", crew: 55, block: 3, rad: 88, cost: 90 },
    fire:    { name: "Fire Pot",     icon: "♨", col: "#ff7a2f", crew: 15, block: 1, rad: 50, cost: 90, burn: 3 },
    gull:    { name: "Seagull",      icon: "➶", col: "#e2e8f0", crew: 40, block: 1, rad: 30, cost: 140 },
    repair:  { name: "Repair Kit",   icon: "✚", col: "#68d391", crew: 0,  block: 0, rad: 110, cost: 70, heal: 35 },
    ball:    { name: "Cannonball",   icon: "⬤", col: "#2d3748", crew: 45, block: 2, rad: 46, cost: 0 }
  };
  var AMMO_ORDER = ["rock", "bouncer", "splitter", "bomb", "fire", "gull", "repair"];
  var ROLES = [
    { key: "cap",  name: "Cap",  hat: "#cd4257", shirt: "#e9e3d6", special: "bomb",     pow: 1.08 },
    { key: "pip",  name: "Pip",  hat: "#f6ad55", shirt: "#4a90d9", special: "splitter", pow: 1 },
    { key: "doc",  name: "Doc",  hat: "#68d391", shirt: "#f7fafc", special: "repair",   pow: 0.95 },
    { key: "gull", name: "Wren", hat: "#b794f4", shirt: "#2d3748", special: "gull",     pow: 1 }
  ];
  var UPG = [
    { key: "armor", name: "Hull Armor",      max: 4, cost: [30, 60, 110, 180], desc: function (l) { return "Planks take " + (3 + l) + " hits"; } },
    { key: "tough", name: "Crew Toughness",  max: 4, cost: [30, 60, 110, 180], desc: function (l) { return "Crew health " + (100 + l * 20); } },
    { key: "size",  name: "Bigger Raft",     max: 2, cost: [80, 200],          desc: function (l) { return (2 + l) + " crew · " + (6 + l) + " planks"; } },
    { key: "arms",  name: "Strong Arms",     max: 3, cost: [40, 90, 160],      desc: function (l) { return "Throw power " + (100 + l * 8) + "%"; } },
    { key: "satchel", name: "Ammo Satchel",  max: 2, cost: [100, 220],         desc: function (l) { return (2 + l) + " of each ammo per battle"; } },
    { key: "cannon", name: "Deck Cannon",    max: 1, cost: [250],              desc: function (l) { return l ? "Mounted" : "A cannon that fires heavy balls"; } }
  ];
  var DECOR = {
    sail: [["#cd4257", "Maroon", 0], ["#3b82f6", "Ocean", 25], ["#f6c445", "Sunflower", 25], ["#1f2937", "Midnight", 35], ["#ec4899", "Bubblegum", 35], ["#d4af37", "Gold", 90]],
    wood: [["#a0703f", "Oak", 0], ["#6b4426", "Walnut", 20], ["#c9a26b", "Birch", 20], ["#5b7f8c", "Painted Teal", 40]],
    flag: [["★", "Star", 0], ["⚓", "Anchor", 15], ["♛", "Crown", 30], ["♥", "Heart", 15], ["☠", "Skull", 40]]
  };
  function upg(k) { return (sget("upg", {}) || {})[k] || 0; }
  function setUpg(k, v) { var u = sget("upg", {}) || {}; u[k] = v; sset("upg", u); }
  function coins() { return sget("coins", 0) || 0; }
  function addCoins(n) { sset("coins", Math.max(0, coins() + n)); }
  function unlocked(a) { return a === "rock" || !!(sget("ammo", {}) || {})[a]; }
  function deco() { return sget("deco", { sail: 0, wood: 0, flag: 0 }) || { sail: 0, wood: 0, flag: 0 }; }
  function owns(kind, i) { return i === 0 || ((sget("owned", {}) || {})[kind + i]); }
  var AI_LEVELS = [
    { key: "sloppy", name: "Sloppy", ang: 9, pow: 0.13 },
    { key: "fair",   name: "Fair",   ang: 4.5, pow: 0.065 },
    { key: "sharp",  name: "Sharp",  ang: 2, pow: 0.03 },
    { key: "scary",  name: "Scary",  ang: 0.7, pow: 0.012 }
  ];
  function aiLevel() { var k = sget("ai", "fair"); return AI_LEVELS.filter(function (l) { return l.key === k; })[0] || AI_LEVELS[1]; }
  function guideMode() { return sget("guide", "auto"); }      /* auto: on for Sloppy / Fair, off for Sharp / Scary */

  /* ---------------- campaign ---------------- */
  var REGIONS = [
    { name: "Gull Lagoon", sky: ["#7cc3f0", "#cfeaff"], sea: ["#2b88b8", "#145a80"], wind: 0.45 },
    { name: "Coral Teeth", sky: ["#f3a46b", "#ffd9a8"], sea: ["#2a7d8f", "#11475a"], wind: 0.7 },
    { name: "Iron Tide",   sky: ["#3b4a63", "#8191a8"], sea: ["#28455c", "#0f2230"], wind: 1 }
  ];
  var BATTLES = [
    { r: 0, name: "Driftwood Dan",      crew: 1, planks: 5, walls: 0, tower: 0, hp: 80,  ammo: [],                    acc: 0.6 },
    { r: 0, name: "The Sandbar Twins",  crew: 2, planks: 5, walls: 0, tower: 0, hp: 80,  ammo: ["bouncer"],           acc: 0.7 },
    { r: 0, name: "Old Kelp",           crew: 2, planks: 6, walls: 1, tower: 0, hp: 90,  ammo: ["bouncer"],           acc: 0.8 },
    { r: 0, name: "Captain Barnacle",   crew: 3, planks: 7, walls: 2, tower: 1, hp: 110, ammo: ["bomb"], boss: true,  acc: 0.9 },
    { r: 1, name: "Reef Raiders",       crew: 2, planks: 6, walls: 2, tower: 0, hp: 100, ammo: ["bouncer", "splitter"], acc: 0.9 },
    { r: 1, name: "Salt & Pepper",      crew: 3, planks: 6, walls: 1, tower: 0, hp: 100, ammo: ["splitter"],          acc: 0.95 },
    { r: 1, name: "Mad Marlin",         crew: 3, planks: 7, walls: 2, tower: 0, hp: 110, ammo: ["splitter", "bomb"],  acc: 1 },
    { r: 1, name: "Admiral Anemone",    crew: 4, planks: 8, walls: 2, tower: 2, hp: 120, ammo: ["fire", "bomb"], boss: true, acc: 1.05 },
    { r: 2, name: "Rustbucket",         crew: 3, planks: 7, walls: 2, tower: 0, hp: 120, ammo: ["bomb"], armor: 1,    acc: 1.05 },
    { r: 2, name: "The Clank Brothers", crew: 4, planks: 7, walls: 2, tower: 1, hp: 120, ammo: ["bomb", "fire"],      acc: 1.1 },
    { r: 2, name: "Foghorn Fiona",      crew: 4, planks: 8, walls: 2, tower: 1, hp: 130, ammo: ["gull", "splitter"],  acc: 1.15 },
    { r: 2, name: "The Iron Duchess",   crew: 5, planks: 9, walls: 3, tower: 2, hp: 150, ammo: ["bomb", "gull", "fire"], boss: true, cannon: true, armor: 2, acc: 1.2 }
  ];
  function cleared() { return sget("cleared", []) || []; }

  /* ---------------- battle state ---------------- */
  var B = null, MO = Site.reducedMotion ? 0.6 : 1;

  function makeRaft(side, o) {
    var n = o.planks, x0 = side < 0 ? Math.max(24, 330 - n * PW) : Math.min(W - 24 - n * PW, W - 330);
    var r = { side: side, x0: x0, n: n, phase: Math.random() * 6, deck: [], walls: [], crew: [], cannon: null, ammo: {}, name: o.name, human: o.human, flag: o.flag || "★", sail: o.sail || "#cd4257", wood: o.wood || "#a0703f", acc: o.acc || 1, bhp: o.bhp || 3 };
    for (var i = 0; i < n; i++) r.deck.push({ i: i, hp: r.bhp, max: r.bhp, alive: true, burn: 0 });
    var front = side < 0 ? n - 1 : 0, mid = Math.floor(n / 2);
    for (var k = 0; k < o.walls; k++) r.walls.push({ col: front, row: k, hp: r.bhp, max: r.bhp, alive: true, burn: 0 });
    for (k = 0; k < o.tower; k++) r.walls.push({ col: side < 0 ? mid : mid - (n % 2 ? 0 : 1), row: k, hp: r.bhp, max: r.bhp, alive: true, burn: 0, tower: true });
    var used = {}; r.walls.forEach(function (w) { used[w.col] = 1; });
    if (o.cannon) { var cc = side < 0 ? n - 2 : 1; if (used[cc]) cc = side < 0 ? n - 3 : 2; r.cannon = { col: cc, hp: 4, alive: true, ball: true }; used[cc] = 1; }
    var cols = []; for (i = 0; i < n; i++) if (!used[i]) cols.push(i);
    if (side > 0) cols.reverse();                  /* crew stand back-to-front, away from the enemy */
    for (i = 0; i < o.crew; i++) {
      var role = o.roles ? o.roles[i % o.roles.length] : ROLES[i % ROLES.length];
      var col = cols[Math.min(cols.length - 1, Math.floor(i * cols.length / Math.max(1, o.crew)))];
      r.crew.push({ role: role, name: o.names ? o.names[i] : role.name, col: col, hp: o.hp, max: o.hp, alive: true, special: true, burn: 0, swim: false, anim: 0, dx: (i % 2 ? 8 : -6) * (cols.length < o.crew ? 1 : 0) });
    }
    o.ammo.forEach(function (a) { r.ammo[a] = (r.ammo[a] || 0) + (o.ammoN || 2); });
    r.ammo.rock = Infinity;
    r.turn = 0;
    return r;
  }
  function bob(r) { return Math.sin(B.t * 1.3 * MO + r.phase) * 5 * B.waves; }
  function deckY(r) { return WY - 22 + bob(r); }
  function colX(r, c) { return r.x0 + c * PW + PW / 2; }
  function crewPos(r, m) { return { x: colX(r, m.col) + m.dx, y: deckY(r) - 26 + (m.swim ? 30 : 0) }; }
  function blockRect(r, b, wall) {
    var dy = deckY(r);
    if (!wall) return { x: r.x0 + b.i * PW + 1, y: dy, w: PW - 2, h: 20 };
    return { x: r.x0 + b.col * PW + 3, y: dy - (b.row + 1) * BH, w: PW - 6, h: BH - 2 };
  }
  function throwers(r) {
    var list = r.crew.filter(function (m) { return m.alive; }).map(function (m) { return { m: m }; });
    if (r.cannon && r.cannon.alive) list.push({ cannon: true });
    return list;
  }
  function originOf(r, t) {
    if (t.cannon) return { x: colX(r, r.cannon.col) + r.side * -18, y: deckY(r) - 22 };
    var p = crewPos(r, t.m); return { x: p.x + r.side * -12, y: p.y - 30 };
  }

  function startBattle(g, kind, idx) {
    var region, foeCfg, mine, isVs = kind === "versus";
    var bhp = 3 + upg("armor"), chp = 100 + upg("tough") * 20, size = upg("size"), d = deco();
    var myAmmo = isVs ? AMMO_ORDER.slice(1) : AMMO_ORDER.slice(1).filter(unlocked);
    mine = { name: isVs ? "Player 1" : "Your Raft", human: true, crew: isVs ? 3 : 2 + size, planks: isVs ? 7 : 6 + size, walls: 1, tower: 0, hp: isVs ? 120 : chp, ammo: myAmmo, ammoN: isVs ? 2 : 2 + upg("satchel"),
      bhp: isVs ? 4 : bhp, cannon: !isVs && upg("cannon") > 0, sail: DECOR.sail[d.sail][0], wood: DECOR.wood[d.wood][0], flag: DECOR.flag[d.flag][0] };
    if (kind === "campaign") {
      var bt = BATTLES[idx]; region = REGIONS[bt.r];
      foeCfg = { name: bt.name, crew: bt.crew, planks: bt.planks, walls: bt.walls, tower: bt.tower, hp: bt.hp, ammo: bt.ammo, ammoN: bt.boss ? 3 : 2, bhp: 3 + (bt.armor || 0), cannon: bt.cannon, acc: bt.acc,
        sail: ["#2d3748", "#7b341e", "#1a202c"][bt.r], wood: "#7a5230", flag: bt.boss ? "☠" : "⚑", names: crewNames(bt.crew, idx), roles: ROLES };
    } else if (kind === "endless") {
      var wv = idx; region = REGIONS[Math.min(2, Math.floor(wv / 4))];
      var pool = ["bouncer", "splitter", "bomb", "fire", "gull"];
      foeCfg = { name: "Wave " + (wv + 1), crew: Math.min(5, 1 + Math.floor(wv / 2)), planks: Math.min(9, 5 + Math.floor(wv / 2)), walls: Math.min(3, Math.floor(wv / 2)), tower: wv > 5 ? 1 : 0, hp: 80 + wv * 8,
        ammo: pool.slice(0, Math.min(pool.length, Math.floor(wv / 2))), ammoN: 1 + Math.floor(wv / 4), bhp: 3 + Math.floor(wv / 5), cannon: wv >= 9, acc: Math.min(1.25, 0.6 + wv * 0.06), sail: "#2d3748", wood: "#7a5230", flag: "⚑", names: crewNames(5, wv), roles: ROLES };
    } else {
      region = REGIONS[(Math.random() * 3) | 0];
      foeCfg = { name: "Player 2", human: true, crew: 3, planks: 7, walls: 1, tower: 0, hp: 120, ammo: AMMO_ORDER.slice(1), ammoN: 2, bhp: 4, sail: "#3b82f6", wood: "#6b4426", flag: "⚓" };
    }
    var keep = kind === "endless" && idx > 0 && B && B.mine ? B.mine : null;
    B = { kind: kind, idx: idx, region: region, t: 0, waves: 1, wind: 0, projs: [], fx: [], debris: [], phase: "aim", turnSide: -1, settle: 0, timer: 0,
      aim: { ang: 0.75, pow: 0.62, charging: false, chargeDir: 1, drag: null }, sel: 0, ammoSel: "rock", log: [], over: false, ai: null, firstTurn: true };
    B.mine = keep || makeRaft(-1, mine);
    if (keep) { refit(B.mine); }
    B.foe = makeRaft(1, foeCfg);
    if ((kind === "campaign" && idx < 2) || (kind === "endless" && idx < 2)) B.foe.crew.forEach(function (m) { m.special = false; });   /* early foes have no specials */
    B.windMax = region.wind;
    newTurn(g, -1);
    g.start(); Site.sfx("open");
    g.toast(kind === "campaign" ? REGIONS[BATTLES[idx].r].name + ": " + BATTLES[idx].name : kind === "endless" ? "Wave " + (idx + 1) : "Versus: Player 1 starts", "info");
  }
  function crewNames(n, seed) {
    var pool = ["Gus", "Mags", "Nell", "Rook", "Bo", "Tess", "Fitz", "Ida", "Moss", "Quill", "Rue", "Sal", "Tam", "Vic", "Yara", "Zed"], out = [];
    for (var i = 0; i < n; i++) out.push(pool[(seed * 3 + i * 5) % pool.length]);
    return out;
  }
  function refit(r) {                            /* endless: patch up between waves */
    r.crew.forEach(function (m) { if (m.alive) { m.hp = Math.min(m.max, m.hp + Math.round(m.max * 0.3)); m.special = true; m.burn = 0; } });
    var dead = r.deck.filter(function (b) { return !b.alive; }); dead.slice(0, Math.ceil(dead.length / 2)).forEach(function (b) { b.alive = true; b.hp = b.max; });
    r.walls.forEach(function (w) { if (!w.alive && Math.random() < 0.5) { w.alive = true; w.hp = w.max; } });
    var n = 2 + upg("satchel"); AMMO_ORDER.slice(1).filter(unlocked).forEach(function (a) { r.ammo[a] = Math.max(r.ammo[a] || 0, n); });
    r.crew.forEach(function (m) { m.swim = !r.deck[m.col].alive; });
  }

  function side(s) { return s < 0 ? B.mine : B.foe; }
  function newTurn(g, s) {
    B.turnSide = s; B.phase = "aim"; B.wind = Math.round((Math.random() * 2 - 1) * B.windMax * 100) / 100;
    var r = side(s), list = throwers(r);
    if (!list.length) return;
    r.turn = (r.turn || 0) % list.length; B.sel = r.turn; r.turn++;
    B.ammoSel = "rock"; B.aim.charging = false; B.aim.drag = null;
    if (s > 0) { B.aim.ang = 0.8; B.aim.pow = 0.6; } else { B.aim.ang = 0.75; B.aim.pow = 0.6; }
    if (!r.human) { B.phase = "ai"; B.timer = 0.9; B.ai = planAI(r); }
    else if (B.kind === "versus" && !B.firstTurn) g.toast((s < 0 ? "Player 1" : "Player 2") + "'s turn", "info");
    B.firstTurn = false;
  }
  function thrower() { var r = side(B.turnSide), l = throwers(r); return l[Math.min(B.sel, l.length - 1)]; }
  function availAmmo(r, t) {
    if (t && t.cannon) return [{ k: "ball", n: Infinity }];
    var out = [{ k: "rock", n: Infinity }];
    AMMO_ORDER.slice(1).forEach(function (a) { if (r.ammo[a] > 0) out.push({ k: a, n: r.ammo[a] }); });
    if (t && t.m && t.m.special) out.push({ k: t.m.role.special, n: 1, special: true });
    return out;
  }

  /* ---------------- physics ---------------- */
  function speedOf(r, t, pow) {
    var arms = r.human && B.kind !== "versus" ? 1 + upg("arms") * 0.08 : 1;
    var base = t && t.cannon ? 1.25 : (t && t.m ? t.m.role.pow : 1);
    return (330 + pow * 720) * arms * base;
  }
  function launchVel(s, ang, sp) { return { vx: Math.cos(ang) * sp * (s < 0 ? 1 : -1), vy: -Math.sin(ang) * sp }; }
  function stepP(p, dt, wind) {
    if (p.homing && p.age > 0.45) return;
    p.vy += GRAV * dt; p.vx += wind * 240 * dt;
  }
  function throwNow(g) {
    var r = side(B.turnSide), t = thrower(), choice = availAmmo(r, t).filter(function (a) { return a.k === B.ammoSel; })[0] || { k: "rock" };
    var o = originOf(r, t), v = launchVel(B.turnSide, B.aim.ang, speedOf(r, t, B.aim.pow));
    var p = { k: choice.k, x: o.x, y: o.y, vx: v.vx, vy: v.vy, age: 0, from: B.turnSide, bounces: 0, alive: true, trail: [] };
    if (choice.k === "gull") p.homing = true;
    B.projs.push(p);
    if (choice.special) t.m.special = false; else if (choice.k !== "rock" && choice.k !== "ball") r.ammo[choice.k]--;
    if (t.m) t.m.anim = 0.4;
    B.phase = "fly"; B.aim.charging = false; B.aim.drag = null; B.settle = 0;
    Site.sfx("tap");
  }

  function hitTest(p) {
    var rafts = [B.mine, B.foe];
    for (var ri = 0; ri < 2; ri++) {
      var r = rafts[ri], own = r.side === p.from;
      if (own && (p.age < 0.3 || (p.k === "repair" && p.vy < 0))) continue;
      if (p.k === "repair" && !own) continue;
      for (var i = 0; i < r.crew.length; i++) { var m = r.crew[i]; if (!m.alive) continue; var c = crewPos(r, m); if (Math.hypot(p.x - c.x, p.y - (c.y - 12)) < 26) return { r: r, crew: m }; }
      for (i = 0; i < r.walls.length; i++) { var w = r.walls[i]; if (!w.alive) continue; var b = blockRect(r, w, true); if (p.x > b.x - 6 && p.x < b.x + b.w + 6 && p.y > b.y - 6 && p.y < b.y + b.h + 6) return { r: r, block: w, rect: b }; }
      if (r.cannon && r.cannon.alive) { var cx = colX(r, r.cannon.col), cy = deckY(r) - 14; if (Math.hypot(p.x - cx, p.y - cy) < 22) return { r: r, cannon: true }; }
      for (i = 0; i < r.deck.length; i++) { var dk = r.deck[i]; if (!dk.alive) continue; b = blockRect(r, dk, false); if (p.x > b.x - 5 && p.x < b.x + b.w + 5 && p.y > b.y - 6 && p.y < b.y + b.h + 4) return { r: r, block: dk, rect: b }; }
    }
    if (p.y > WY + Math.sin(p.x / 70 + B.t * 1.6) * 4 * B.waves) return { water: true };
    if (p.x < -400 || p.x > W + 400 || p.y > H + 50) return { water: true, lost: true };
    return null;
  }
  function dmgCrew(g, r, m, n, why) {
    if (!m.alive || n <= 0) return;
    m.hp = Math.max(0, Math.round(m.hp - n)); m.anim = -0.4;
    var c = crewPos(r, m);
    B.fx.push({ txt: "-" + Math.round(n), x: c.x, y: c.y - 60, vy: -50, life: 1, col: "#ff8a8a" });
    if (m.hp <= 0) { m.alive = false; g.toast(m.name + " is out" + (why ? " (" + why + ")" : ""), r.human ? "bad" : "good"); }
  }
  function dmgBlock(r, b, n, rect) {
    if (!b.alive) return;
    b.hp -= n;
    if (b.hp <= 0) {
      b.alive = false;
      for (var i = 0; i < 6; i++) B.debris.push({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, vx: (Math.random() - 0.5) * 300, vy: -150 - Math.random() * 250, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, w: 10 + Math.random() * 16, col: r.wood, life: 2.2 });
      if (b.i !== undefined) r.crew.forEach(function (m) { if (m.col === b.i) m.swim = true; });
    }
  }
  function explode(g, p, x, y) {
    var a = AMMO[p.k];
    if (p.k === "repair") {
      var r = side(p.from), healed = 0;
      r.crew.forEach(function (m) { if (!m.alive) return; var c = crewPos(r, m); if (Math.hypot(c.x - x, c.y - y) < a.rad) { m.hp = Math.min(m.max, m.hp + a.heal); healed++; m.burn = 0; } });
      var fixed = 0; r.deck.forEach(function (b) { if (!b.alive && fixed < 2) { b.alive = true; b.hp = b.max; fixed++; r.crew.forEach(function (m) { if (m.col === b.i) m.swim = false; }); } });
      r.walls.forEach(function (w) { if (w.alive) w.burn = 0; }); r.deck.forEach(function (b) { b.burn = 0; });
      ring(x, y, a.rad, "#68d391"); g.toast("Repaired " + fixed + " plank" + (fixed === 1 ? "" : "s") + ", healed " + healed, "good");
      return;
    }
    ring(x, y, a.rad, p.k === "bomb" ? "#ffb26b" : p.k === "fire" ? "#ff7a2f" : "rgba(255,255,255,.7)");
    [B.mine, B.foe].forEach(function (r) {
      r.crew.forEach(function (m) {
        if (!m.alive) return; var c = crewPos(r, m), d = Math.hypot(c.x - x, c.y - 12 - y);
        if (d < a.rad + 14) { dmgCrew(g, r, m, a.crew * (d < 26 ? 1 : 0.55)); if (a.burn) m.burn = a.burn; }
      });
      r.walls.concat(r.deck).forEach(function (b) {
        if (!b.alive) return; var isW = b.col !== undefined, rc = blockRect(r, b, isW), d = Math.hypot(rc.x + rc.w / 2 - x, rc.y + rc.h / 2 - y);
        if (d < a.rad * 0.75) { dmgBlock(r, b, a.block, rc); if (a.burn && b.alive) b.burn = a.burn; }
      });
      if (r.cannon && r.cannon.alive) { var d2 = Math.hypot(colX(r, r.cannon.col) - x, deckY(r) - 14 - y); if (d2 < a.rad) { r.cannon.hp -= a.block; if (r.cannon.hp <= 0) { r.cannon.alive = false; g.toast((r.human ? "Your" : "Their") + " cannon is wrecked", r.human ? "bad" : "good"); } } }
    });
    Site.sfx(p.k === "bomb" ? "error" : "tap");
  }
  function ring(x, y, rad, col) { B.fx.push({ ring: true, x: x, y: y, r: 6, max: rad, life: 0.45, col: col }); for (var i = 0; i < 10; i++) { var an = Math.random() * 6.28, v = 80 + Math.random() * 200; B.fx.push({ x: x, y: y, vx: Math.cos(an) * v, vy: Math.sin(an) * v - 80, life: 0.6, col: col }); } }

  function stepProjectiles(g, dt) {
    var add = [];
    B.projs.forEach(function (p) {
      if (!p.alive) return;
      var n = Math.max(1, Math.round(dt / STEP));
      for (var s = 0; s < n && p.alive; s++) {
        var h = dt / n; p.age += h;
        if (p.homing && p.age > 0.45) {
          var foe = side(-p.from), best = null, bd = 1e9;
          foe.crew.forEach(function (m) { if (!m.alive) return; var c = crewPos(foe, m), dd = Math.hypot(c.x - p.x, c.y - p.y); if (dd < bd) { bd = dd; best = c; } });
          if (best) { var want = Math.atan2(best.y - 14 - p.y, best.x - p.x), cur = Math.atan2(p.vy, p.vx), diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur)), turn = Math.max(-2.6 * h, Math.min(2.6 * h, diff)), sp = Math.max(420, Math.hypot(p.vx, p.vy)); cur += turn; p.vx = Math.cos(cur) * sp; p.vy = Math.sin(cur) * sp; }
          if (p.age > 5) { p.alive = false; break; }
        }
        var vy0 = p.vy;
        stepP(p, h, B.wind); p.x += p.vx * h; p.y += p.vy * h;
        if (p.k === "splitter" && vy0 < 0 && p.vy >= 0) {
          p.alive = false;
          [-0.22, 0, 0.22].forEach(function (da) { var sp = Math.hypot(p.vx, p.vy) * 0.95 + 40, an = Math.atan2(p.vy, p.vx) + da; add.push({ k: "shard", x: p.x, y: p.y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, age: 1, from: p.from, bounces: 0, alive: true, trail: [] }); });
          ring(p.x, p.y, 20, "#f6ad55"); break;
        }
        var hit = hitTest(p);
        if (!hit) continue;
        var key = p.k === "shard" ? "splitter" : p.k, a = AMMO[key];
        if (hit.water && p.k !== "repair") {
          if (p.k === "bouncer" && p.bounces < a.bounces && !hit.lost) { p.bounces++; p.vy = -Math.abs(p.vy) * 0.55; p.vx *= 0.8; p.y = WY - 2; splash(p.x); continue; }
          splash(p.x); p.alive = false;
          if (!hit.lost && (p.k === "bomb" || p.k === "fire")) explode(g, { k: key, from: p.from }, p.x, WY);
          break;
        }
        if (hit.water) { splash(p.x); p.alive = false; g.toast("The repair kit sank", "info"); break; }
        if (p.k === "repair") { explode(g, p, p.x, p.y); p.alive = false; break; }
        if (key === "bomb" || key === "fire") explode(g, { k: key, from: p.from }, p.x, p.y);     /* the blast does all the damage */
        else {
          if (hit.crew) dmgCrew(g, hit.r, hit.crew, a.crew, null);
          else if (hit.block) dmgBlock(hit.r, hit.block, a.block, hit.rect);
          else if (hit.cannon) { hit.r.cannon.hp -= a.block; if (hit.r.cannon.hp <= 0) hit.r.cannon.alive = false; }
          ring(p.x, p.y, 16, a.col); if (hit.crew) Site.sfx("success");
        }
        if (p.k === "bouncer" && p.bounces < a.bounces) { p.bounces++; p.vy = -Math.abs(p.vy) * 0.6; p.vx *= -0.5; p.age = Math.max(p.age, 0.3); continue; }
        p.alive = false; break;
      }
      p.trail.push({ x: p.x, y: p.y }); if (p.trail.length > 18) p.trail.shift();
    });
    B.projs = B.projs.filter(function (p) { return p.alive; }).concat(add);
  }
  function splash(x) { for (var i = 0; i < 12; i++) B.fx.push({ x: x, y: WY, vx: (Math.random() - 0.5) * 160, vy: -120 - Math.random() * 220, life: 0.7, col: "rgba(220,240,255,.9)" }); }

  /* ---------------- AI ---------------- */
  function simulate(s, ang, sp, origin, target, wind) {
    var p = { x: origin.x, y: origin.y, vx: Math.cos(ang) * sp * (s < 0 ? 1 : -1), vy: -Math.sin(ang) * sp }, best = 1e9;
    for (var i = 0; i < 900; i++) {
      p.vy += GRAV * STEP; p.vx += wind * 240 * STEP; p.x += p.vx * STEP; p.y += p.vy * STEP;
      var d = Math.hypot(p.x - target.x, p.y - target.y); if (d < best) best = d;
      if (p.y > WY + 10 || (s > 0 ? p.x < target.x - 80 : p.x > target.x + 80) && p.vy > 0) break;
    }
    return best;
  }
  function planAI(r) {
    var foe = side(-r.side), list = throwers(r), t = list[Math.min(B.sel, list.length - 1)];
    var targets = foe.crew.filter(function (m) { return m.alive; });
    if (!targets.length) return null;
    var tm = targets.slice().sort(function (a, b) { return a.hp - b.hp; })[Math.random() < 0.6 ? 0 : (Math.random() * targets.length) | 0];
    var c = crewPos(foe, tm), target = { x: c.x, y: c.y - 12 }, o = originOf(r, t);
    var ammo = availAmmo(r, t), pick = ammo[0];
    var hurt = r.crew.filter(function (m) { return m.alive && m.hp < m.max * 0.45; }).length;
    var rep = ammo.filter(function (a) { return a.k === "repair"; })[0];
    if (rep && hurt && Math.random() < 0.6) { pick = rep; var mc = crewPos(r, r.crew.filter(function (m) { return m.alive && m.hp < m.max * 0.45; })[0]); target = { x: mc.x, y: mc.y - 20 }; }
    else if (ammo.length > 1 && Math.random() < 0.55) pick = ammo[1 + ((Math.random() * (ammo.length - 1)) | 0)];
    if (pick.k === "repair" && !hurt) pick = ammo[0];
    var bestA = 0.8, bestP = 0.6, bestD = 1e9;
    for (var a = 0.2; a <= 1.35; a += 0.05) for (var pw = 0.05; pw <= 1.0; pw += 0.05) {
      var dd = simulate(r.side, a, speedOf(r, t, pw), o, target, pick.k === "gull" ? 0 : B.wind);
      if (dd < bestD) { bestD = dd; bestA = a; bestP = pw; }
    }
    var L = aiLevel(), k = 1 / Math.max(0.4, r.acc || 1), gauss = function () { return (Math.random() + Math.random() + Math.random() - 1.5) / 0.75; };
    if (B.kind === "versus") k = 1;
    return { ang: Math.max(0.1, Math.min(1.45, bestA + gauss() * L.ang * k * Math.PI / 180)), pow: Math.max(0.03, Math.min(1, bestP * (1 + gauss() * L.pow * k))), ammo: pick.k };
  }

  /* ---------------- turn flow ---------------- */
  function aliveCrew(r) { return r.crew.some(function (m) { return m.alive; }) || (r.cannon && r.cannon.alive); }
  function sunk(r) { return r.deck.filter(function (b) { return b.alive; }).length < r.n * 0.35; }
  function endTurn(g) {
    [B.mine, B.foe].forEach(function (r) {                 /* fire burns, swimmers tire */
      r.crew.forEach(function (m) { if (!m.alive) return; if (m.burn > 0) { m.burn--; dmgCrew(g, r, m, 8, "burns"); } if (m.swim) dmgCrew(g, r, m, 10, "overboard"); });
      r.walls.concat(r.deck).forEach(function (b) { if (b.alive && b.burn > 0) { b.burn--; dmgBlock(r, b, 1, blockRect(r, b, b.col !== undefined)); } });
    });
    var mineOut = !aliveCrew(B.mine) || sunk(B.mine), foeOut = !aliveCrew(B.foe) || sunk(B.foe);
    if (mineOut || foeOut) return finishBattle(g, !mineOut && foeOut, mineOut && foeOut);
    newTurn(g, -B.turnSide);
  }
  function finishBattle(g, won, draw) {
    g.setState("over"); B.over = true;
    var kind = B.kind, idx = B.idx, earned = 0, kv = el("div", { class: "ak-kv" }), title, sub = "", items = [];
    function row(k, v) { kv.appendChild(el("span", { text: k })); kv.appendChild(el("b", { text: String(v) })); }
    var lost = B.foe.crew.filter(function (m) { return !m.alive; }).length, mineLost = B.mine.crew.filter(function (m) { return !m.alive; }).length;
    if (kind === "versus") {
      title = draw ? "Both rafts down!" : (won ? "Player 1 wins" : "Player 2 wins");
      items = [{ label: "Rematch", cls: "is-primary", act: function () { startBattle(g, "versus", 0); } }, { label: "Main Menu", act: function () { g.toTitle(); } }];
      Site.sfx("success");
    } else if (kind === "campaign") {
      var bt = BATTLES[idx], first = cleared().indexOf(idx) < 0;
      if (won) {
        earned = 15 + idx * 5 + (bt.boss ? 40 : 0) + (first ? 20 : 0);
        if (first) { var c = cleared(); c.push(idx); sset("cleared", c); }
      } else earned = 4;
      addCoins(earned);
      title = won ? (bt.boss ? "Boss sunk!" : "Victory!") : "Your raft went down";
      sub = won ? (first ? "First clear bonus included." : "") : "Upgrades at the Shipwright can help.";
      row("Battle", bt.name); row("Enemy crew knocked out", lost + " of " + B.foe.crew.length); row("Your crew lost", mineLost); row("Coins", "+" + earned + "  (" + coins() + " total)");
      if (won && idx + 1 < BATTLES.length) items.push({ label: "Next Battle", cls: "is-primary", act: function () { startBattle(g, "campaign", idx + 1); } });
      items.push({ label: won ? "Replay" : "Retry", cls: won ? "" : "is-primary", act: function () { startBattle(g, "campaign", idx); } });
      items.push({ label: "Shipwright", sub: coins() + " coins", act: function () { shop(g, function () { campaignMenu(g); }); } });
      items.push({ label: "Campaign Map", act: function () { campaignMenu(g); } });
      Site.sfx(won ? "success" : "error");
    } else {
      if (won) {
        earned = 6 + idx * 2; addCoins(earned);
        title = "Wave " + (idx + 1) + " cleared";
        row("Coins", "+" + earned); row("Your crew left", B.mine.crew.filter(function (m) { return m.alive; }).length);
        items = [{ label: "Next Wave", cls: "is-primary", act: function () { startBattle(g, "endless", idx + 1); } }, { label: "Main Menu", sub: "Ends the run", act: function () { g.toTitle(); } }];
        Site.sfx("success");
      } else {
        var best = sget("bestWave", 0), rec = idx > best; if (rec) sset("bestWave", idx);
        title = "Sunk on wave " + (idx + 1);
        row("Waves cleared", idx + (rec ? "  (new best)" : "")); row("Best", Math.max(best, idx));
        items = [{ label: "Try Again", cls: "is-primary", act: function () { B = null; startBattle(g, "endless", 0); } }, { label: "Shipwright", sub: coins() + " coins", act: function () { shop(g, function () { titleMenu(g); }); } }, { label: "Main Menu", act: function () { g.toTitle(); } }];
        Site.sfx("error");
      }
    }
    items.push({ label: "Main Menu", act: function () { g.toTitle(); } });
    var seen = {}; items = items.filter(function (it) { if (seen[it.label]) return false; seen[it.label] = 1; return true; });
    paintBest(g);
    g.menu({ kicker: kind === "campaign" ? REGIONS[BATTLES[idx].r].name : kind === "endless" ? "Endless Survival" : "Versus", title: title, sub: sub, body: kv, items: items, back: function () { g.toTitle(); } });
  }

  function update(g, dt) {
    B.t += dt;
    var r = side(B.turnSide), human = r.human;
    [B.mine, B.foe].forEach(function (rr) { rr.crew.forEach(function (m) { if (m.anim > 0) m.anim = Math.max(0, m.anim - dt); else if (m.anim < 0) m.anim = Math.min(0, m.anim + dt); }); });
    if (B.phase === "aim" && human) aimInput(g, dt);
    else if (B.phase === "ai") {
      B.timer -= dt;
      if (B.ai) { B.aim.ang += (B.ai.ang - B.aim.ang) * Math.min(1, dt * 3); B.aim.pow += (B.ai.pow - B.aim.pow) * Math.min(1, dt * 3); B.ammoSel = B.ai.ammo; }
      if (B.timer <= 0) { if (B.ai) { B.aim.ang = B.ai.ang; B.aim.pow = B.ai.pow; throwNow(g); } else endTurn(g); }
    } else if (B.phase === "fly") {
      stepProjectiles(g, dt);
      if (!B.projs.length) { B.settle += dt; if (B.settle > 0.7) endTurn(g); }
    }
    for (var i = B.fx.length - 1; i >= 0; i--) { var f = B.fx[i]; f.life -= dt; if (f.ring) f.r += (f.max - f.r) * Math.min(1, dt * 12); else if (f.txt) f.y += f.vy * dt; else { f.vy += 600 * dt; f.x += f.vx * dt; f.y += f.vy * dt; } if (f.life <= 0) B.fx.splice(i, 1); }
    for (i = B.debris.length - 1; i >= 0; i--) { var d = B.debris[i]; d.life -= dt; d.vy += 700 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt; if (d.y > WY) { d.vy *= 0.2; d.vx *= 0.95; d.y = WY; } if (d.life <= 0) B.debris.splice(i, 1); }
  }
  function aimInput(g, dt) {
    var p = g.pad, s = B.turnSide, r = side(s), list = throwers(r);
    var up = g.key("ArrowUp") || g.key("KeyW"), dn = g.key("ArrowDown") || g.key("KeyS");
    var lf = g.key("ArrowLeft") || g.key("KeyA"), rt = g.key("ArrowRight") || g.key("KeyD");
    var away = s < 0 ? lf : rt, toward = s < 0 ? rt : lf;               /* arrows: up / "back" raise the arc */
    if (up || away) B.aim.ang = Math.min(1.45, B.aim.ang + dt * 0.9);
    if (dn || toward) B.aim.ang = Math.max(0.05, B.aim.ang - dt * 0.9);
    if (Math.hypot(p.lx, p.ly) > 0.35) { var ax = p.lx * (s < 0 ? 1 : -1), ay = -p.ly; if (ax > -0.2) B.aim.ang = Math.max(0.05, Math.min(1.45, Math.atan2(Math.max(0, ay), Math.max(0.05, ax)))); }
    /* switch thrower / ammo */
    if (g.hit("KeyQ") || p.hit.lb) { B.sel = (B.sel - 1 + list.length) % list.length; B.ammoSel = availAmmo(r, thrower())[0].k; Site.sfx("hover"); }
    if (g.hit("KeyE") || p.hit.rb) { B.sel = (B.sel + 1) % list.length; B.ammoSel = availAmmo(r, thrower())[0].k; Site.sfx("hover"); }
    var am = availAmmo(r, thrower()), ai = Math.max(0, am.map(function (a) { return a.k; }).indexOf(B.ammoSel));
    if (g.hit("KeyZ") || p.hit.up) { ai = (ai - 1 + am.length) % am.length; B.ammoSel = am[ai].k; Site.sfx("hover"); }
    if (g.hit("KeyX") || g.hit("Tab") || p.hit.down || p.hit.y) { ai = (ai + 1) % am.length; B.ammoSel = am[ai].k; Site.sfx("hover"); }
    for (var n = 1; n <= 9; n++) if (g.hit("Digit" + n) && am[n - 1]) { B.ammoSel = am[n - 1].k; Site.sfx("hover"); }
    /* charge: Space / RT / A held */
    var hold = g.key("Space") || p.rt > 0.3 || p.btn.a;
    if (hold) {
      if (!B.aim.charging) { B.aim.charging = true; B.aim.pow = 0.05; B.aim.chargeDir = 1; }
      B.aim.pow += B.aim.chargeDir * dt * 0.75;
      if (B.aim.pow >= 1) { B.aim.pow = 1; B.aim.chargeDir = -1; } if (B.aim.pow <= 0.05) { B.aim.pow = 0.05; B.aim.chargeDir = 1; }
    } else if (B.aim.charging) throwNow(g);
  }

  /* ---------------- drawing ---------------- */
  function showGuide() { var m = guideMode(); if (m === "always") return true; if (m === "never") return false; var k = aiLevel().key; return B.kind === "versus" || k === "sloppy" || k === "fair"; }
  function drawScene(x, reg, t) {
    var g = x.createLinearGradient(0, 0, 0, WY); g.addColorStop(0, reg.sky[0]); g.addColorStop(1, reg.sky[1]); x.fillStyle = g; x.fillRect(0, 0, W, WY);
    x.fillStyle = "rgba(255,250,220,.9)"; x.beginPath(); x.arc(W * 0.78, 110, 46, 0, 6.3); x.fill();
    var wind = B ? B.wind : 0.2;
    x.fillStyle = "rgba(255,255,255,.75)";
    for (var i = 0; i < 6; i++) { var cx = ((i * 260 + t * (20 + wind * 60)) % (W + 400) + W + 400) % (W + 400) - 200, cy = 70 + (i * 53) % 160; x.beginPath(); x.ellipse(cx, cy, 70, 22, 0, 0, 6.3); x.ellipse(cx + 40, cy - 12, 46, 20, 0, 0, 6.3); x.ellipse(cx - 40, cy - 6, 40, 16, 0, 0, 6.3); x.fill(); }
    x.fillStyle = "rgba(40,70,60,.45)"; x.beginPath(); x.moveTo(380, WY); x.quadraticCurveTo(520, WY - 70, 660, WY); x.quadraticCurveTo(760, WY - 40, 900, WY); x.fill();
    g = x.createLinearGradient(0, WY, 0, H); g.addColorStop(0, reg.sea[0]); g.addColorStop(1, reg.sea[1]); x.fillStyle = g;
    x.beginPath(); x.moveTo(0, H); for (var px = 0; px <= W; px += 20) x.lineTo(px, WY + Math.sin(px / 70 + t * 1.6) * 4 * (B ? B.waves : 1)); x.lineTo(W, H); x.closePath(); x.fill();
    x.strokeStyle = "rgba(255,255,255,.25)"; x.lineWidth = 2;
    for (var row = 1; row < 5; row++) { x.beginPath(); for (px = 0; px <= W; px += 24) x.lineTo(px, WY + row * 34 + Math.sin(px / 60 + t * 1.2 + row) * 4); x.stroke(); }
  }
  function drawRaft(x, r, t) {
    var dy = deckY(r), d;
    x.fillStyle = "rgba(0,0,0,.25)"; x.beginPath(); x.ellipse(r.x0 + r.n * PW / 2, WY + 10, r.n * PW / 2 + 10, 8, 0, 0, 6.3); x.fill();
    for (var i = 0; i < r.n; i++) { if (!r.deck[i].alive) continue; x.fillStyle = "#5a3b1f"; x.beginPath(); x.ellipse(r.x0 + i * PW + PW / 2, dy + 22, PW / 2 - 1, 9, 0, 0, 6.3); x.fill(); }
    var mastCol = Math.floor(r.n / 2), mx = colX(r, mastCol) + (r.side < 0 ? -PW / 2 : PW / 2);
    x.strokeStyle = "#4a3220"; x.lineWidth = 6; x.beginPath(); x.moveTo(mx, dy); x.lineTo(mx, dy - 170); x.stroke();
    x.fillStyle = r.sail; x.beginPath(); x.moveTo(mx + 3 * -r.side, dy - 160); x.quadraticCurveTo(mx - r.side * 70, dy - 110, mx + 3 * -r.side, dy - 60); x.closePath(); x.fill();
    x.fillStyle = "#fff"; x.font = "700 26px " + F.display; x.textAlign = "center"; x.fillText(r.flag, mx - r.side * 26, dy - 100);
    var fw = Math.sin(t * 6) * 4; x.fillStyle = r.sail; x.beginPath(); x.moveTo(mx, dy - 170); x.lineTo(mx - r.side * (30 + fw), dy - 163); x.lineTo(mx, dy - 156); x.fill();
    r.deck.forEach(function (b) { if (!b.alive) return; var rc = blockRect(r, b, false); plank(x, rc, r.wood, b); });
    r.walls.forEach(function (w) { if (!w.alive) return; var rc = blockRect(r, w, true); plank(x, rc, w.tower ? shade(r.wood, -18) : shade(r.wood, -8), w); });
    if (r.cannon && r.cannon.alive) {
      var cx = colX(r, r.cannon.col), cy = dy - 14, ang = (B.turnSide === r.side && thrower() && thrower().cannon) ? B.aim.ang : 0.5;
      x.save(); x.translate(cx, cy); x.scale(-r.side, 1); x.rotate(-ang); x.fillStyle = "#2d3748"; D.rr(x, -6, -8, 40, 16, 6); x.fill(); x.restore();
      x.fillStyle = "#4a3220"; x.beginPath(); x.arc(cx, cy + 4, 12, 0, 6.3); x.fill();
    }
    r.crew.forEach(function (m) { drawCrew(x, r, m, t); });
  }
  function shade(hex, n) { var v = parseInt(hex.slice(1), 16), rr = Math.max(0, Math.min(255, (v >> 16) + n)), gg = Math.max(0, Math.min(255, ((v >> 8) & 255) + n)), bb = Math.max(0, Math.min(255, (v & 255) + n)); return "rgb(" + rr + "," + gg + "," + bb + ")"; }
  function plank(x, rc, col, b) {
    x.fillStyle = col; D.rr(x, rc.x, rc.y, rc.w, rc.h, 3); x.fill();
    x.strokeStyle = "rgba(0,0,0,.25)"; x.lineWidth = 1.5; x.beginPath(); x.moveTo(rc.x + 4, rc.y + rc.h * 0.4); x.lineTo(rc.x + rc.w - 4, rc.y + rc.h * 0.4); x.stroke();
    if (b.hp < b.max) { x.strokeStyle = "rgba(0,0,0,.55)"; x.lineWidth = 2; x.beginPath(); x.moveTo(rc.x + rc.w * 0.3, rc.y); x.lineTo(rc.x + rc.w * 0.5, rc.y + rc.h * 0.6); x.lineTo(rc.x + rc.w * 0.4, rc.y + rc.h); if (b.hp < b.max - 1) { x.moveTo(rc.x + rc.w * 0.8, rc.y); x.lineTo(rc.x + rc.w * 0.65, rc.y + rc.h * 0.7); } x.stroke(); }
    if (b.burn > 0) { x.fillStyle = "rgba(255,120,40,.75)"; x.beginPath(); x.moveTo(rc.x + 6, rc.y); x.quadraticCurveTo(rc.x + rc.w / 2, rc.y - 22 - Math.random() * 6, rc.x + rc.w - 6, rc.y); x.fill(); }
  }
  function drawCrew(x, r, m, t) {
    var c = crewPos(r, m), face = -r.side;
    if (!m.alive) { x.globalAlpha = 0.5; x.fillStyle = "#cbd5e0"; x.font = "700 18px " + F.display; x.textAlign = "center"; x.fillText("✕", c.x, c.y + 6); x.globalAlpha = 1; return; }
    var active = B.phase !== "fly" && B.turnSide === r.side && thrower() && thrower().m === m;
    var arm = m.anim > 0 ? -2.4 + (0.4 - m.anim) * 8 : active ? -(B.aim.ang + 0.6) : -0.5;
    if (m.anim < 0) { x.save(); x.translate(Math.sin(t * 60) * 3, 0); }
    x.fillStyle = "#2d3748"; x.fillRect(c.x - 7, c.y + 6, 5, 16); x.fillRect(c.x + 2, c.y + 6, 5, 16);
    x.fillStyle = m.role.shirt; D.rr(x, c.x - 11, c.y - 16, 22, 26, 6); x.fill();
    x.save(); x.translate(c.x + face * 6, c.y - 10); x.scale(face, 1); x.rotate(arm); x.strokeStyle = "#f1c9a5"; x.lineWidth = 6; x.lineCap = "round"; x.beginPath(); x.moveTo(0, 0); x.lineTo(20, 0); x.stroke(); x.restore();
    x.fillStyle = "#f1c9a5"; x.beginPath(); x.arc(c.x, c.y - 26, 11, 0, 6.3); x.fill();
    x.fillStyle = "#1a202c"; x.beginPath(); x.arc(c.x + face * 4, c.y - 28, 1.8, 0, 6.3); x.fill();
    x.fillStyle = m.role.hat; x.beginPath(); x.ellipse(c.x, c.y - 35, 13, 5, 0, 0, 6.3); x.fill(); x.fillRect(c.x - 8, c.y - 44, 16, 10);
    if (m.burn > 0) { x.fillStyle = "rgba(255,120,40,.8)"; x.beginPath(); x.arc(c.x - 6, c.y - 6, 5 + Math.random() * 3, 0, 6.3); x.fill(); }
    if (m.anim < 0) x.restore();
    var bw = 40, p = m.hp / m.max;
    x.fillStyle = "rgba(0,0,0,.45)"; D.rr(x, c.x - bw / 2, c.y - 62, bw, 7, 3); x.fill();
    x.fillStyle = p > 0.5 ? "#68d391" : p > 0.25 ? "#f6c445" : "#fc8181"; D.rr(x, c.x - bw / 2, c.y - 62, Math.max(3, bw * p), 7, 3); x.fill();
    x.fillStyle = "#fff"; x.font = "700 12px " + F.display; x.textAlign = "center"; x.fillText(m.name + (m.special ? " ★" : ""), c.x, c.y - 68);
    if (active) { x.fillStyle = "#fff"; x.beginPath(); var by = c.y - 92 + Math.sin(t * 6) * 3; x.moveTo(c.x - 8, by); x.lineTo(c.x + 8, by); x.lineTo(c.x, by + 10); x.fill(); }
  }
  function drawProj(x, p, t) {
    var key = p.k === "shard" ? "splitter" : p.k, a = AMMO[key];
    x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 3; x.beginPath(); p.trail.forEach(function (q, i) { i ? x.lineTo(q.x, q.y) : x.moveTo(q.x, q.y); }); x.stroke();
    if (p.y < 0) { x.fillStyle = "#fff"; x.beginPath(); x.moveTo(p.x, 6); x.lineTo(p.x - 9, 22); x.lineTo(p.x + 9, 22); x.fill(); D.text(x, Math.round(-p.y) + "", p.x, 40, "700 12px " + F.mono, "#fff", "center"); return; }
    if (key === "gull") {
      var an = Math.atan2(p.vy, p.vx); x.save(); x.translate(p.x, p.y); x.rotate(an); var fl = Math.sin(t * 22) * 8;
      x.fillStyle = "#f7fafc"; x.beginPath(); x.ellipse(0, 0, 14, 6, 0, 0, 6.3); x.fill();
      x.strokeStyle = "#e2e8f0"; x.lineWidth = 4; x.beginPath(); x.moveTo(-2, 0); x.lineTo(-10, -12 - fl); x.moveTo(-2, 0); x.lineTo(-10, 12 + fl); x.stroke();
      x.fillStyle = "#f6ad55"; x.beginPath(); x.moveTo(14, -2); x.lineTo(22, 0); x.lineTo(14, 2); x.fill(); x.restore(); return;
    }
    var rad = key === "bomb" ? 11 : key === "ball" ? 10 : key === "splitter" && p.k === "shard" ? 6 : 9;
    x.fillStyle = a.col; x.beginPath(); x.arc(p.x, p.y, rad, 0, 6.3); x.fill();
    x.strokeStyle = "rgba(0,0,0,.4)"; x.lineWidth = 2; x.stroke();
    if (key === "bomb") { x.strokeStyle = "#fbd38d"; x.beginPath(); x.moveTo(p.x + 6, p.y - 8); x.lineTo(p.x + 10, p.y - 14); x.stroke(); }
    if (key === "fire") { x.fillStyle = "rgba(255,170,60,.8)"; x.beginPath(); x.arc(p.x - p.vx * 0.012, p.y - p.vy * 0.012, 7, 0, 6.3); x.fill(); }
    if (key === "repair") { x.fillStyle = "#fff"; x.fillRect(p.x - 2, p.y - 6, 4, 12); x.fillRect(p.x - 6, p.y - 2, 12, 4); }
  }
  function drawAim(x, g) {
    var s = B.turnSide, r = side(s), t = thrower(); if (!t) return;
    var o = originOf(r, t), sp = speedOf(r, t, B.aim.pow), v = launchVel(s, B.aim.ang, sp);
    if (showGuide() || !r.human) {
      if (r.human) {
        var p = { x: o.x, y: o.y, vx: v.vx, vy: v.vy };
        x.fillStyle = "rgba(255,255,255,.9)";
        for (var i = 1; i <= 26; i++) { for (var k = 0; k < 2; k++) { p.vy += GRAV * STEP * 2; p.x += p.vx * STEP * 2; p.y += p.vy * STEP * 2; } if (i % 2) { x.beginPath(); x.arc(p.x, p.y, 3.2 - i * 0.08, 0, 6.3); x.fill(); } }
      }
    }
    x.strokeStyle = "rgba(255,255,255,.9)"; x.lineWidth = 3; x.beginPath(); x.moveTo(o.x, o.y); x.lineTo(o.x + Math.cos(B.aim.ang) * 46 * (s < 0 ? 1 : -1), o.y - Math.sin(B.aim.ang) * 46); x.stroke();
    if (r.human) {                                   /* power meter */
      var mx = o.x + (s < 0 ? -44 : 44), my = o.y + 10;
      x.fillStyle = "rgba(0,0,0,.5)"; D.rr(x, mx - 7, my - 70, 14, 74, 6); x.fill();
      var pc = B.aim.pow; x.fillStyle = pc > 0.8 ? "#fc8181" : pc > 0.5 ? "#f6c445" : "#68d391"; D.rr(x, mx - 5, my + 2 - 70 * pc, 10, 70 * pc, 4); x.fill();
      D.text(x, Math.round(B.aim.ang * 57.3) + "°", o.x + (s < 0 ? 30 : -30), o.y - 64, "700 14px " + F.mono, "#fff", "center");
    }
    if (B.aim.drag) { x.strokeStyle = "rgba(255,255,255,.4)"; x.setLineDash([6, 6]); x.beginPath(); x.moveTo(B.aim.drag.x0, B.aim.drag.y0); x.lineTo(B.aim.drag.x, B.aim.drag.y); x.stroke(); x.setLineDash([]); }
  }
  var SLOT = { y: H - 66, w: 92, h: 52 };
  function slotRects() {
    var r = side(B.turnSide), am = availAmmo(r, thrower()), tot = am.length * (SLOT.w + 8) - 8, x0 = W / 2 - tot / 2;
    return am.map(function (a, i) { return { a: a, x: x0 + i * (SLOT.w + 8), y: SLOT.y, w: SLOT.w, h: SLOT.h }; });
  }
  function hud(g, x) {
    var w = B.wind, wx = W / 2;
    x.fillStyle = "rgba(4,7,12,.55)"; D.rr(x, wx - 110, 12, 220, 48, 12); x.fill();
    D.text(x, "WIND", wx, 30, "700 12px " + F.mono, "#cbd5e0", "center", false);
    var len = Math.abs(w) * 80; x.strokeStyle = "#fff"; x.lineWidth = 4; x.beginPath(); x.moveTo(wx - len * Math.sign(w), 44); x.lineTo(wx + len * Math.sign(w), 44); x.stroke();
    if (Math.abs(w) > 0.02) { x.fillStyle = "#fff"; x.beginPath(); x.moveTo(wx + (len + 10) * Math.sign(w), 44); x.lineTo(wx + len * Math.sign(w), 37); x.lineTo(wx + len * Math.sign(w), 51); x.fill(); }
    else D.text(x, "calm", wx, 50, "600 13px " + F.display, "#fff", "center", false);
    D.text(x, B.mine.name, 24, 36, "800 22px " + F.display, "#fff");
    D.text(x, B.foe.name, W - 24, 36, "800 22px " + F.display, "#fff", "right");
    var turnTxt = B.phase === "fly" ? "" : (side(B.turnSide).human ? (B.kind === "versus" ? (B.turnSide < 0 ? "Player 1" : "Player 2") + ": your throw" : "Your throw") : B.foe.name + " is aiming…");
    if (turnTxt) D.text(x, turnTxt, wx, 88, "700 18px " + F.display, "#fff", "center");
    if (B.phase !== "aim" || !side(B.turnSide).human) return;
    var t = thrower(); D.text(x, (t.cannon ? "Deck Cannon" : t.m.name) + " throws  ·  Q / E switch  ·  Z / X ammo  ·  hold Space", wx, SLOT.y - 12, "600 14px " + F.display, "#e2e8f0", "center");
    slotRects().forEach(function (s) {
      var A2 = AMMO[s.a.k], on = s.a.k === B.ammoSel;
      x.fillStyle = on ? "rgba(255,255,255,.22)" : "rgba(4,7,12,.6)"; D.rr(x, s.x, s.y, s.w, s.h, 10); x.fill();
      x.strokeStyle = on ? (s.a.special ? "#f6c445" : "#fff") : "rgba(255,255,255,.2)"; x.lineWidth = on ? 3 : 1.5; D.rr(x, s.x, s.y, s.w, s.h, 10); x.stroke();
      D.text(x, A2.icon, s.x + 18, s.y + 32, "800 22px " + F.display, A2.col, "center", false);
      D.text(x, A2.name.split(" ")[0], s.x + 34, s.y + 22, "700 12px " + F.display, "#fff", "left", false);
      D.text(x, s.a.special ? "★ special" : s.a.n === Infinity ? "∞" : "×" + s.a.n, s.x + 34, s.y + 40, "700 12px " + F.mono, s.a.special ? "#f6c445" : "#cbd5e0", "left", false);
    });
  }

  /* ---------------- menus ---------------- */
  function paintBest(g) { var c = cleared().length; g.setBest(c + "/" + BATTLES.length + " battles  ·  best wave " + (sget("bestWave", 0) || 0) + "  ·  " + coins() + " coins"); }
  function titleMenu(g) {
    paintBest(g);
    g.menu({
      cls: "is-hero", kicker: "Arcade", title: "Supreme Lobbing",
      sub: "Lob rocks, bombs and seagulls at the enemy raft before they sink yours. Mind the wind.",
      items: [
        { label: "Campaign", cls: "is-primary", sub: cleared().length + " of " + BATTLES.length + " battles won", act: function () { campaignMenu(g); } },
        { label: "Endless Survival", sub: "Best: " + (sget("bestWave", 0) || 0) + " waves", act: function () { B = null; startBattle(g, "endless", 0); } },
        { label: "Versus (2 Players)", sub: "Take turns on one keyboard or controller", act: function () { startBattle(g, "versus", 0); } },
        { label: "Shipwright", sub: coins() + " coins · upgrades and decor", act: function () { shop(g, function () { titleMenu(g); }); } },
        { label: "Settings", sub: "Enemy aim: " + aiLevel().name, act: function () { settingsMenu(g); } },
        { label: "How to Play", act: function () { howMenu(g, function () { titleMenu(g); }); } }
      ],
      back: function () { if (g.isFull()) g.full(false); },
      foot: "Esc, P or Start pauses. ⤢ plays in the full window."
    });
  }
  function campaignMenu(g) {
    var cl = cleared(), items = BATTLES.map(function (bt, i) {
      var open = i === 0 || cl.indexOf(i - 1) >= 0 || cl.indexOf(i) >= 0, done = cl.indexOf(i) >= 0;
      return { label: (i + 1) + ". " + bt.name + (done ? " ✓" : ""), sub: open ? REGIONS[bt.r].name + (bt.boss ? " · BOSS" : "") + " · " + bt.crew + " crew" : "Locked", cls: bt.boss ? "is-gold" : "", disabled: !open,
        act: function () { startBattle(g, "campaign", i); } };
    });
    items.push({ label: "Back", act: function () { titleMenu(g); } });
    var next = 0; for (var i = 0; i < BATTLES.length; i++) if (cl.indexOf(i) < 0) { next = i; break; }
    g.menu({ title: "Campaign", sub: "Three regions, a boss at the end of each. Enemy aim: " + aiLevel().name + ".", items: items, grid: true, cls: "is-wide", back: function () { titleMenu(g); }, focus: Math.min(next, items.length - 1) });
  }
  function settingsMenu(g) {
    var items = AI_LEVELS.map(function (l) { return { label: "Enemy aim: " + l.name + (aiLevel().key === l.key ? " ✓" : ""), act: function () { sset("ai", l.key); settingsMenu(g); } }; });
    [["auto", "Aim guide: Auto"], ["always", "Aim guide: Always"], ["never", "Aim guide: Never"]].forEach(function (o) { items.push({ label: o[1] + (guideMode() === o[0] ? " ✓" : ""), sub: o[0] === "auto" ? "On for Sloppy and Fair, off for Sharp and Scary" : "", act: function () { sset("guide", o[0]); settingsMenu(g); } }); });
    items.push({ label: "Back", act: function () { titleMenu(g); } });
    g.menu({ title: "Settings", items: items, grid: true, cls: "is-wide", back: function () { titleMenu(g); } });
  }
  function howMenu(g, back) {
    var ul = el("ul", { class: "ak-howto" },
      el("li", { html: "<b>Aim</b>: drag back from anywhere and let go, like a slingshot. Or use <kbd>↑↓</kbd> / <kbd>←→</kbd> to set the angle and hold <kbd>Space</kbd> to charge power, then release. Controller: left stick aims, hold <kbd>RT</kbd> or <kbd>A</kbd> to charge." }),
      el("li", { html: "<b>Wind</b> (top centre) and the swell change every turn. The dotted guide only shows the start of the arc and ignores the wind." }),
      el("li", { html: "Each crew member has their own health and a <b>★ special shot</b> once per battle. Switch thrower with <kbd>Q</kbd> / <kbd>E</kbd> (<kbd>LB</kbd> / <kbd>RB</kbd>), and ammo with <kbd>Z</kbd> / <kbd>X</kbd>, <kbd>1</kbd>–<kbd>8</kbd> or <kbd>Y</kbd>." }),
      el("li", { html: "Ammo: <b>Rock</b> (unlimited), <b>Bouncer</b> skips up to 3 times, <b>Splitter</b> breaks in three at the top of its arc, <b>Bomb</b> blasts a wide area, <b>Fire Pot</b> burns for 3 turns, <b>Seagull</b> homes in on the nearest enemy, <b>Repair Kit</b> heals your crew and replaces planks where it lands on your own raft." }),
      el("li", { html: "Planks and walls break. Crew whose plank is gone end up <b>overboard</b> and lose health every turn. A raft with under a third of its deck left sinks." }),
      el("li", { html: "Win battles for coins and spend them at the <b>Shipwright</b>: armor, tougher crew, a bigger raft (more crew), stronger arms, ammo, a deck cannon and decor." }));
    g.menu({ title: "How to Play", body: ul, items: [{ label: "Back", act: back }], back: back, cls: "is-wide" });
  }
  function shop(g, back, focus) {
    var items = [], c = coins();
    UPG.forEach(function (u) {
      var l = upg(u.key), maxed = l >= u.max, cost = maxed ? 0 : u.cost[l];
      items.push({ label: u.name + (u.max > 1 ? " Lv " + l + "/" + u.max : l ? " ✓" : ""), sub: u.desc(l) + (maxed ? " · maxed" : " · " + cost + " coins"), disabled: maxed || c < cost,
        act: function () { addCoins(-cost); setUpg(u.key, l + 1); Site.sfx("success"); shop(g, back, items.length && idxOf(u.name)); } });
    });
    AMMO_ORDER.slice(1).forEach(function (k) {
      var a = AMMO[k], has = unlocked(k);
      items.push({ label: "Ammo: " + a.name + (has ? " ✓" : ""), sub: has ? "Unlocked" : a.cost + " coins", disabled: has || c < a.cost,
        act: function () { addCoins(-a.cost); var u = sget("ammo", {}) || {}; u[k] = true; sset("ammo", u); Site.sfx("success"); shop(g, back); } });
    });
    var dc = deco();
    ["sail", "wood", "flag"].forEach(function (kind) {
      DECOR[kind].forEach(function (d, i) {
        var own = owns(kind, i), on = dc[kind] === i, label = (kind === "sail" ? "Sail" : kind === "wood" ? "Wood" : "Flag") + ": " + d[1] + (kind === "flag" ? " " + d[0] : "");
        items.push({ label: label + (on ? " ✓" : ""), sub: on ? "In use" : own ? "Owned · use" : d[2] + " coins", disabled: on || (!own && c < d[2]),
          act: function () { if (!own) { addCoins(-d[2]); var o = sget("owned", {}) || {}; o[kind + i] = true; sset("owned", o); } var dd = deco(); dd[kind] = i; sset("deco", dd); Site.sfx("success"); shop(g, back); } });
      });
    });
    function idxOf(name) { for (var i = 0; i < items.length; i++) if (items[i].label.indexOf(name) === 0) return i; return 0; }
    items.push({ label: "Back", act: back });
    paintBest(g);
    g.menu({ title: "Shipwright", sub: c + " coins. Upgrades are kept in this browser.", items: items, grid: true, cls: "is-wide", back: back, focus: focus || 0 });
  }

  /* ---------------- register ---------------- */
  A.register({
    id: "supreme-lobbing", name: "Supreme Lobbing", icon: "🎯", accent: "#f6ad55", W: W, H: H,
    blurb: "Turn-based raft battles: lob things in an arc, mind the wind, upgrade your raft.",
    init: function (g) { paintBest(g); },
    title: function (g) { titleMenu(g); },
    restart: function (g) { if (B) { var k = B.kind, i = B.kind === "endless" ? 0 : B.idx; if (k === "endless") B = null; startBattle(g, k, i); } },
    update: update,
    idle: function () {},
    alwaysAnimate: true,
    pointer: function (g, type, px, py) {
      if (g.state !== "play" || !B || B.phase !== "aim" || !side(B.turnSide).human) return;
      var r = side(B.turnSide);
      if (type === "down") {
        var slots = slotRects();
        for (var i = 0; i < slots.length; i++) { var s = slots[i]; if (px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h) { B.ammoSel = s.a.k; Site.sfx("hover"); return; } }
        var list = throwers(r);
        for (i = 0; i < list.length; i++) { var o = originOf(r, list[i]); if (Math.hypot(px - o.x, py - o.y - 20) < 34 && i !== B.sel) { B.sel = i; B.ammoSel = availAmmo(r, thrower())[0].k; Site.sfx("hover"); return; } }
        B.aim.drag = { x0: px, y0: py, x: px, y: py };
      } else if (type === "move" && B.aim.drag) {
        B.aim.drag.x = px; B.aim.drag.y = py;
        var dx = (B.aim.drag.x0 - px) * (B.turnSide < 0 ? 1 : -1), dy = B.aim.drag.y0 - py, len = Math.hypot(dx, dy);
        if (len > 12) { B.aim.ang = Math.max(0.05, Math.min(1.45, Math.atan2(-dy, Math.max(0.01, dx)))); if (dx <= 0.01) B.aim.ang = 1.45; B.aim.pow = Math.max(0.05, Math.min(1, len / 260)); }
      } else if (type === "up" && B.aim.drag) {
        var d = B.aim.drag, l2 = Math.hypot(d.x0 - d.x, d.y0 - d.y); B.aim.drag = null;
        if (l2 > 24) throwNow(g);
      }
    },
    draw: function (g, x) {
      var t = performance.now() / 1000;
      if (!B || g.state === "title") {
        drawScene(x, REGIONS[0], t);
        x.save(); x.globalAlpha = 0.9; D.text(x, "🎯", W / 2, H * 0.5, "120px " + F.display, "#fff", "center", false); x.restore();
        return;
      }
      drawScene(x, B.region, B.t);
      drawRaft(x, B.mine, B.t); drawRaft(x, B.foe, B.t);
      B.debris.forEach(function (d) { x.save(); x.translate(d.x, d.y); x.rotate(d.rot); x.globalAlpha = Math.min(1, d.life); x.fillStyle = d.col; x.fillRect(-d.w / 2, -4, d.w, 8); x.restore(); });
      if ((B.phase === "aim" || B.phase === "ai") && g.state === "play") drawAim(x, g);
      B.projs.forEach(function (p) { drawProj(x, p, t); });
      B.fx.forEach(function (f) {
        x.globalAlpha = Math.max(0, Math.min(1, f.life * 2));
        if (f.ring) { x.strokeStyle = f.col; x.lineWidth = 5; x.beginPath(); x.arc(f.x, f.y, f.r, 0, 6.3); x.stroke(); }
        else if (f.txt) D.text(x, f.txt, f.x, f.y, "800 22px " + F.display, f.col, "center");
        else { x.fillStyle = f.col; x.fillRect(f.x - 3, f.y - 3, 6, 6); }
      });
      x.globalAlpha = 1;
      hud(g, x);
    }
  });
})();
