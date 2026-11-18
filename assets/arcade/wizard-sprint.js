/* arcade/wizard-sprint.js — "Wizard of the Sprint": a left-to-right runner with spell combat, loot and a hub that rebuilds.
 *
 * This file is the level 1 slice: the character creator, the ruined tower hub (Prep Time, Equipment, Settings, then the
 * Magickal Condenser and the Wizard Drip Armoire once the forest is cleared), the forest's five-minute first run with its
 * boss, Endless mode afterwards, six Incantations with mastery, the Gust Step buff, gear drops with rarities and stats,
 * the bag, Wiz Level, in-run challenges, rebindable controls and one whole-save record that syncs to the account
 * (newest save wins; the other is kept as a backup and the player is told).
 * Everything is drawn in code on a 640 x 360 pixel buffer and scaled up crisp. Sound is synthesised.
 * Story text lives in wizard-story.js; the director edits it from the control panel's Wizard Story page.
 */
(function () {
  "use strict";
  if (!window.Site || !window.Arcade) return;
  var Site = window.Site, A = window.Arcade, D = A.draw, F = A.FONT, el = Site.el, store = Site.store;
  if (((Site.config && Site.config.features) || {}).game404 === false) return;

  var W = 1280, H = 720, BW = 640, BH = 360, GY = 292, WX = 150, M = 16, BASE = 170, GRAV = 1400, TAU = Math.PI * 2;
  var SKEY = "arcade.wizard-sprint.save";
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  /* live balance tunables — the Maintenance Hatch "Wizard — balance tunables" panel overrides these for every player.
     Each is a multiplier (1 = the built-in value); tune() reads the live override with a safe fallback. */
  var TUNE = {};
  var TUNEDEF = [
    { k: "speed",    n: "Run speed",           d: "How fast the forest scrolls past.",            lo: 0.5, hi: 2 },
    { k: "jump",     n: "Jump height",         d: "How high a jump and glide carry.",             lo: 0.5, hi: 2 },
    { k: "orbRate",  n: "Whisper-orb drops",   d: "How often Whisper Orbs appear in a run.",      lo: 0.25, hi: 4 },
    { k: "grimRate", n: "Grimoire drops",      d: "How often Grimoires appear in a run.",         lo: 0.25, hi: 4 },
    { k: "spellCd",  n: "Incantation cooldowns", d: "Time between casts — lower is faster.",      lo: 0.4, hi: 2 },
    { k: "xpCurve",  n: "XP needed per level", d: "XP each level costs — lower levels faster.",   lo: 0.4, hi: 2.5 },
    { k: "chalXp",   n: "Challenge XP payout", d: "XP awarded for finishing a run challenge.",    lo: 0.25, hi: 4 },
    { k: "oblOrbs",  n: "Obliviate orb yield", d: "Whisper Orbs from obliviating an item.",       lo: 0.25, hi: 4 }
  ];
  function tune(k) { var v = TUNE && TUNE[k]; return (typeof v === "number" && isFinite(v) && v > 0) ? clamp(v, 0.1, 8) : 1; }
  function sanitizeTune(o) { var out = {}; if (o && typeof o === "object") TUNEDEF.forEach(function (t) { var v = Number(o[t.k]); if (isFinite(v) && v > 0 && Math.abs(v - 1) > 1e-4) out[t.k] = clamp(v, t.lo, t.hi); }); return out; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function ri(a, b) { return Math.floor(rnd(a, b + 1)); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function fmt(n) { n = Math.floor(n); return n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e4 ? (n / 1e3).toFixed(1) + "k" : String(n); }
  function r1(n) { return Math.round(n * 10) / 10; }
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round(r + (t - r) * p); g = Math.round(g + (t - g) * p); b = Math.round(b + (t - b) * p);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  function lerpHex(a, b, t) {
    var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), c = [16, 8, 0].map(function (s) { var p = (x >> s) & 255, q = (y >> s) & 255; return Math.round(p + (q - p) * t); });
    return "#" + ((1 << 24) + (c[0] << 16) + (c[1] << 8) + c[2]).toString(16).slice(1);
  }

  /* ---------------- story (PLACEHOLDER text: the director writes the final lines) ---------------- */
  /* All story text lives in wizard-story.js (window.WizStory), where the control panel's editor can change it. */
  var WS = window.WizStory;
  function applyStory() { try { Site.remote().then(function (r) { WS.apply(r && r.config && r.config.wizardStory); }); } catch (e) {} }
  applyStory();
  var lastLine = {};
  function line(k) { var a = WS.lines(k), s; do { s = pick(a); } while (a.length > 1 && s === lastLine[k]); lastLine[k] = s; return named(s); }
  function named(s) { return String(s).replace(/\{Name\}/g, (S && S.wiz.name) || "The Wizard"); }
  function txt(id) { return named(WS.first(id)); }

  /* ---------------- data ---------------- */
  var RAR = [
    { n: "Unremarkable",  c: "#e8e8e8", lines: 1, m: 1,    lv: 1,  w: 60,  cap: 60, syl: 1 },
    { n: "Markable",      c: "#4ed16a", lines: 2, m: 1.15, lv: 1,  w: 25,  cap: 50, syl: 3 },
    { n: "Impressive",    c: "#4aa3ff", lines: 2, m: 1.35, lv: 10, w: 10,  cap: 20, syl: 8 },
    { n: "Outstanding",   c: "#b46bff", lines: 3, m: 1.6,  lv: 25, w: 4,   cap: 8,  syl: 20 },
    { n: "Splendiforous", c: "#ff9a2e", lines: 4, m: 2,    lv: 45, w: 0.9, cap: 3,  syl: 50 },
    { n: "Thunderfuck",   c: "#ff6bd6", lines: 5, m: 2.6,  lv: 70, w: 0.1, cap: 1,  syl: 120 }
  ];
  var STAT = {
    pow: { n: "Understanding of Magicks", d: "Power",             a: 2,   b: 27,  u: "%",   cap: 1e9, rank: 2 },
    flu: { n: "Incantation Fluency",      d: "Attack speed",      a: 1,   b: 13,  u: "%",   cap: 100, rank: 1.5 },
    vit: { n: "Vitality",                 d: "HP",                a: 2,   b: 50,  u: " HP", cap: 1e9, rank: 5 },
    ton: { n: "Flexor Toneage",           d: "Move speed",        a: 1,   b: 12,  u: "%",   cap: 60,  rank: 1.5 },
    mag: { n: "Magickal Magnetism",       d: "Pickup radius",     a: 5,   b: 60,  u: "%",   cap: 300, rank: 5 },
    hap: { n: "Happenstance",             d: "Loot luck",         a: 1,   b: 15,  u: "%",   cap: 150, rank: 2 },
    ret: { n: "Magick Retention",         d: "Buff duration",     a: 0.2, b: 2.5, u: "s",   cap: 15,  rank: 0.3 },
    con: { n: "Confidence",               d: "Damage mitigation", a: 1,   b: 10,  u: "%",   cap: 60,  rank: 1 }
  };
  var SK = Object.keys(STAT);
  var ADJ = { pow: "Scholarly", flu: "Chatty", vit: "Hearty", ton: "Sprightly", mag: "Clingy", hap: "Lucky", ret: "Lingering", con: "Cocky" };
  var SLOTS = [
    { k: "head", n: "Head", lv: 1, nouns: ["Cap", "Hat", "Hood", "Cowl"] },
    { k: "chest", n: "Chest", lv: 1, nouns: ["Tunic", "Robe", "Vest"] },
    { k: "hands", n: "Hands", lv: 1, nouns: ["Mitts", "Gloves", "Wraps"] },
    { k: "legs", n: "Legs", lv: 1, nouns: ["Skivvies", "Trousers", "Leggings"] },
    { k: "feet", n: "Feet", lv: 1, nouns: ["Slippers", "Boots", "Sandals"] },
    { k: "main", n: "Main Hand", lv: 1, nouns: ["Stick", "Wand", "Staff", "Ladle"], lean: ["pow", "flu"] },
    { k: "off", n: "Off Hand", lv: 5, nouns: ["Tome", "Orb", "Lantern"], lean: ["vit", "con"] },
    { k: "waist", n: "Waist", lv: 10, nouns: ["Sash", "Belt"] },
    { k: "neck", n: "Neck", lv: 15, nouns: ["Amulet", "Scarf"] },
    { k: "shoulder", n: "Shoulder", lv: 22, nouns: ["Pads", "Mantle"] },
    { k: "back", n: "Back", lv: 30, nouns: ["Cape", "Cloak"] },
    { k: "sim", n: "Magick Simulacrum", lv: 8, nouns: ["Ring", "Familiar", "Aura", "Charm"], sims: [8, 20, 35, 50, 70, 90] }
  ];
  function slotDef(k) { k = /^sim/.test(k) ? "sim" : k; return SLOTS.filter(function (s) { return s.k === k; })[0]; }
  var UNLOCK = { 5: "Off Hand slot", 8: "Simulacrum slot 1", 10: "Waist slot, and Impressive drops", 15: "Neck slot", 20: "Simulacrum slot 2", 22: "Shoulder slot",
    25: "Incantation slot 2, and Outstanding drops", 30: "Back slot", 35: "Simulacrum slot 3", 45: "Splendiforous drops", 50: "Simulacrum slot 4",
    60: "Incantation slot 3", 70: "Simulacrum slot 5, and Thunderfuck drops", 90: "Simulacrum slot 6", 100: "Return to Reality" };

  var INC = {
    poof:   { n: "Magick Poof",      r: 0, cast: "Auto, every 2s",    d: "A dust puff at the nearest enemy.",                     cd: 2,   dmg: 5, m: "Bigger puff at mastery 3, a second puff at 6." },
    snaps:  { n: "Spark Snaps",      r: 0, cast: "Key, 3 charges",    d: "A fast straight bolt. A charge returns every 1.5s.",    cd: 1.5, dmg: 6, key: 1, m: "Pierces at mastery 3, a 4th charge at 6." },
    social: { n: "Social Distance",  r: 0, cast: "Auto",              d: "Thorns orbit you and bite whatever gets close.",        cd: 0.5, dmg: 10, m: "A second thorn and a wider ring at mastery 4." },
    rainy:  { n: "Rainy Day",        r: 1, cast: "Auto",              d: "A small storm cloud ahead zaps whatever is under it.",  cd: 0.12, dmg: 2, m: "A bigger cloud at mastery 3." },
    sneeze: { n: "Peppery Sneeze",   r: 1, cast: "Auto, every 1.5s",  d: "A short cone of fire that burns.",                      cd: 1.5, dmg: 8, m: "A longer cone at mastery 3." },
    ward:   { n: "Ward of Whatever", r: 2, cast: "Key, 12s",          d: "A bubble that blocks one hit.",                         cd: 12,  dmg: 0, key: 1, m: "Recharges faster at mastery 3 and 6." }
  };
  var BUFF = { gust: { n: "Gust Step", d: "Double jump plus a speed burst.", up: "Each rank adds a second. Rank 3 adds a triple jump." } };
  var ORBCOST = [5, 10, 20, 35, 60];
  var RANKS = [
    { k: "jump", n: "Jump Height", max: 10, d: function (l) { return "Jump " + Math.round(Math.pow(1.06, l) * 100) + "%" + (l >= 6 ? " (reaches high platforms)" : ""); } },
    { k: "glide", n: "Levitation Glide", max: 10, d: function (l) { return "Falls " + Math.round((1 - Math.pow(0.92, l)) * 100) + "% slower while gliding"; } }
  ].concat(SK.map(function (k) { return { k: k, n: STAT[k].n, max: 20, d: function (l) { return "+" + r1(l * STAT[k].rank) + STAT[k].u + " " + STAT[k].d; } }; }));
  function rankCost(l) { return Math.round(50 * Math.pow(1.35, l)); }

  var CH = [
    { id: "spell", n: "Spell It Out",             d: "Defeat 10 enemies",                    need: 10,   ev: "kill" },
    { id: "rich",  n: "Don't Touch Me, I'm Rich", d: "Collect 300 Remnants in one run",      need: 300,  ev: "rem", run: 1 },
    { id: "slap",  n: "Hand Slapper",             d: "High-five 3 friendlies",               need: 3,    ev: "five" },
    { id: "hero",  n: "Hero-ish",                 d: "Rescue a friendly",                    need: 1,    ev: "rescue" },
    { id: "dip",   n: "Double Dip",               d: "Pick up 2 Whisper Orbs in one run",    need: 2,    ev: "orb", run: 1 },
    { id: "leg",   n: "Leg Day",                  d: "Run 1,500 m",                          need: 1500, ev: "m" },
    { id: "snob",  n: "Platform Snob",            d: "Land on 15 platforms",                 need: 15,   ev: "plat" },
    { id: "imp",   n: "Imp-ertinent",             d: "Defeat 5 Mud Imps",                    need: 5,    ev: "imp" }
  ];
  function chDef(id) { return CH.filter(function (c) { return c.id === id; })[0]; }

  /* looks: 30 skin tones, 12 head shapes, 15 hair styles, 5 brows, 8 facial hair */
  var SKIN = (function () {
    var an = ["#fde7d6", "#f6d2b4", "#eabf98", "#d9a577", "#c08a5c", "#a06d45", "#7d5234", "#5e3a26", "#452a1c", "#2f1c13"], out = [];
    for (var i = 0; i < 30; i++) { var f = i / 29 * (an.length - 1), a = Math.floor(f); out.push(lerpHex(an[a], an[Math.min(an.length - 1, a + 1)], f - a)); }
    return out;
  })();
  var HEADN = ["Round", "Oval", "Square", "Narrow", "Heart", "Pear", "Diamond", "Egg", "Block", "Lantern", "Pointy", "Turnip"];
  var HEADS = [[5, 6, 5, 4], [4, 5, 4, 3], [6, 6, 6, 5], [4, 4, 4, 3], [6, 5, 3, 2], [4, 5, 6, 5], [3, 6, 3, 2], [4, 6, 5, 3], [5, 5, 6, 6], [5, 6, 6, 4], [5, 5, 3, 1], [6, 6, 3, 2]].map(function (p) {
    var o = [];
    for (var r = 0; r < 12; r++) {
      var v;
      if (r === 0) v = p[0] - 1; else if (r < 4) v = p[0] + (p[1] - p[0]) * (r / 4); else if (r < 8) v = p[1]; else if (r < 11) v = p[1] + (p[2] - p[1]) * ((r - 7) / 3); else v = p[3];
      o.push(Math.max(1, Math.round(v)));
    }
    return o;
  });
  var HAIRN = ["Bald", "Short Crop", "Long Straight", "Ponytail", "Wild Frizz", "Side Part", "Mohawk", "Bun", "Braids", "Curly", "Bowl", "Tonsure", "Receding Long", "Big Puff", "Pigtails"];
  var HAIRC = [["White", "#f2f0ea"], ["Grey", "#a9a9b0"], ["Silver", "#d5dbe6"], ["Black", "#1d1a22"], ["Brown", "#5b3a22"], ["Auburn", "#8a3f22"], ["Blonde", "#e2c36a"], ["Red", "#c2452b"], ["Blue", "#4a7bd6"], ["Green", "#4fa860"]];
  var BROWN = ["Thin", "Regular", "Thick", "Bushy", "Big Ass Bushy Scientist"];
  var BEARDN = ["None", "Stubble", "Moustache", "Goatee", "Short Beard", "Long Beard", "Full Wizard", "Mutton Chops"];
  var NAMES = ["Bartholomew", "Griselda", "Mortimer", "Agnes", "Thaddeus", "Winifred", "Cornelius", "Hortense", "Ignatius", "Prudence", "Balthazar", "Mildred"];

  /* ---------------- save ---------------- */
  var S, UI = { scene: "hub" };
  function starter() {
    return {
      head:  { id: 1, s: "head",  r: 0, il: 1, n: "Tattered Sleep Cap",  l: [], k: 0, st: 1 },
      chest: { id: 2, s: "chest", r: 0, il: 1, n: "Slept-In Tunic",      l: [], k: 0, st: 1 },
      legs:  { id: 3, s: "legs",  r: 0, il: 1, n: "Well Worn Skivvies",  l: [], k: 0, st: 1 }
    };
  }
  function fresh() {
    return { v: 1, ts: 0, made: false,
      wiz: { name: "", body: 0, skin: 6, head: 0, shape: 0.4, age: 104, hair: 2, hairCol: 0, brow: 1, beard: 0, height: 0.5 },
      rem: 0, orbs: 0, grim: 0, syl: 0, xp: 0, lvl: 1, rank: 0, cleared: {}, tower: 0, story: {},
      inc: { poof: { k: 0 } }, incEq: ["poof"], buffs: {}, buffEq: [], ranks: {}, bag: [], eq: starter(), bagCap: 12, speed: 0.5,
      binds: {}, pad: {}, snd: true, vol: 0.7, flashOn: true, comfort: false, cos: {}, cnt: {}, best: {}, ch: [], shop: { slot: 0, items: [] }, nid: 10, title: "robbed", tseen: {} };
  }
  function load() {
    var s = store.get(SKEY, null), f = fresh(); S = f;
    if (s && typeof s === "object") for (var k in s) if (s[k] != null) S[k] = s[k];
    ["wiz", "cleared", "story", "inc", "buffs", "ranks", "eq", "binds", "pad", "cos", "cnt", "best", "shop", "tseen"].forEach(function (k) { if (!S[k] || typeof S[k] !== "object" || Array.isArray(S[k])) S[k] = fresh()[k]; });
    ["incEq", "buffEq", "bag", "ch"].forEach(function (k) { if (!Array.isArray(S[k])) S[k] = fresh()[k]; });
    for (var w in f.wiz) if (S.wiz[w] == null) S.wiz[w] = f.wiz[w];
    if (!S.inc.poof) S.inc.poof = { k: 0 };
    if (!S.incEq.length) S.incEq = ["poof"];
    if (S.speed == null || S.speed === 1) S.speed = 0.5;   /* pace slider re-centred to neutral (old default was 1) */
    if (!S.title) S.title = "robbed";
    fillCh();
    TITLES.forEach(function (t) { if (titleUnlocked(t.id)) S.tseen[t.id] = 1; });   /* silent baseline: only newly-earned titles toast from here on */
  }
  function save() { S.ts = Date.now(); if (typeof checkTitles === "function") checkTitles(); store.set(SKEY, S); }
  function cnt(k, n) { S.cnt[k] = (S.cnt[k] || 0) + n; }
  function fillCh() {
    S.ch = S.ch.filter(function (c) { return c && chDef(c.id); });
    while (S.ch.length < 3) { var pool = CH.filter(function (c) { return !S.ch.some(function (a) { return a.id === c.id; }); }); S.ch.push({ id: pick(pool).id, p: 0, done: false }); }
  }
  /* a fresh set of 3 challenges for the next run; the three assigned are the only ones that run, then they reroll */
  function rollChals() {
    var pool = CH.slice(), out = [];
    while (out.length < 3 && pool.length) { var c = pick(pool); out.push({ id: c.id, p: 0, done: false }); pool.splice(pool.indexOf(c), 1); }
    S.ch = out;
  }

  /* ---------------- stats, levels, items ---------------- */
  function calc() {
    var t = {}; SK.forEach(function (k) { t[k] = (S.ranks[k] || 0) * STAT[k].rank; });
    Object.keys(S.eq).forEach(function (s) { var it = S.eq[s]; if (it) (it.l || []).forEach(function (l) { t[l[0]] += l[1]; }); });
    SK.forEach(function (k) { t[k] = Math.min(STAT[k].cap, r1(t[k])); });
    t.hp = 10 + t.vit; t.jump = 70 * Math.pow(1.06, S.ranks.jump || 0); t.glide = 260 * Math.pow(0.92, S.ranks.glide || 0);
    return t;
  }
  function xpNeed(l) { return Math.max(1, Math.round(100 * Math.pow(l, 1.4) * tune("xpCurve"))); }
  function addXP(n, g) {
    S.xp += Math.round(n);
    while (S.lvl < 100 && S.xp >= xpNeed(S.lvl)) {
      S.xp -= xpNeed(S.lvl); S.lvl++;
      if (g) { sfx("lvl"); g.toast("Wiz Level " + S.lvl, "gold"); if (UNLOCK[S.lvl]) g.toast("Unlocked: " + UNLOCK[S.lvl], "gold"); }
    }
  }
  function incSlots() { return 1 + (S.lvl >= 25 ? 1 : 0) + (S.lvl >= 60 ? 1 : 0); }
  function openSlots() {
    var o = [];
    SLOTS.forEach(function (s) {
      if (s.k === "sim") s.sims.forEach(function (lv, i) { if (S.lvl >= lv) o.push("sim" + (i + 1)); });
      else if (S.lvl >= s.lv) o.push(s.k);
    });
    return o;
  }
  function mlvl(id) { var k = (S.inc[id] || {}).k || 0, m = 0, need = 0; while (m < 10) { need += Math.round(25 * Math.pow(m + 1, 1.5)); if (k < need) break; m++; } return m; }
  function mnext(id) { var m = mlvl(id), need = 0; for (var i = 0; i <= m && i < 10; i++) need += Math.round(25 * Math.pow(i + 1, 1.5)); return m >= 10 ? null : need - ((S.inc[id] || {}).k || 0); }
  function mfrac(id) { var m = mlvl(id); if (m >= 10) return 1; var span = Math.round(25 * Math.pow(m + 1, 1.5)), rem = mnext(id); return clamp((span - rem) / span, 0, 1); }
  /* --- Wizard titles: 25 unlockable nameplate titles, each firing off stuff the game already tracks --- */
  function bestDist() { return Math.max(S.best.story1 || 0, S.best.endless1 || 0); }
  function eqAny(fn) { return Object.keys(S.eq).some(function (k) { var it = S.eq[k]; return it && fn(it); }); }
  function eqCount(fn) { return Object.keys(S.eq).filter(function (k) { var it = S.eq[k]; return it && fn(it); }).length; }
  function ownedInc() { return Object.keys(S.inc).filter(function (id) { return INC[id]; }); }
  var TITLES = [
    { id: "robbed",   n: "The Robbed",          d: "Start your first run (default)",      chk: function () { return true; } },
    { id: "tracks",   n: "Tracks Follower",     d: "Reach 500 m in a run",                chk: function () { return bestDist() >= 500; } },
    { id: "runner",   n: "Forest Runner",       d: "Reach 2,000 m in a run",              chk: function () { return bestDist() >= 2000; } },
    { id: "relent",   n: "The Relentless",      d: "Reach 5,000 m in Endless",            chk: function () { return (S.best.endless1 || 0) >= 5000; } },
    { id: "impbane",  n: "Imp's Bane",          d: "Defeat 500 Mud Imps",                 chk: function () { return (S.cnt.imps || 0) >= 500; } },
    { id: "boss",     n: "Boss Flattener",      d: "Beat the forest boss",                chk: function () { return !!S.cleared[1]; } },
    { id: "drip",     n: "Drip Lord",           d: "Fill every equipment slot at once",   chk: function () { return openSlots().every(function (k) { return !!S.eq[k]; }); } },
    { id: "thunder",  n: "Thunderstruck",       d: "Equip a Thunderfuck-rarity item",     chk: function () { return eqAny(function (it) { return it.r >= 5; }); } },
    { id: "dressed",  n: "Well Dressed",        d: "Wear 3 Splendiforous+ items at once", chk: function () { return eqCount(function (it) { return it.r >= 4; }) >= 3; } },
    { id: "spark",    n: "Spark Master",        d: "Take any Incantation to Mastery 6",   chk: function () { return ownedInc().some(function (id) { return mlvl(id) >= 6; }); } },
    { id: "polyglot", n: "Polyglot",            d: "Own 8 different Incantations",        chk: function () { return ownedInc().length >= 8; } },
    { id: "nimble",   n: "Nimble",              d: "Dodge 100 times with Illusion Flash", chk: function () { return (S.cnt.flash || 0) >= 100; } },
    { id: "untouch",  n: "Untouchable",         d: "Finish a run without taking a hit",   chk: function () { return (S.cnt.cleanwin || 0) >= 1; } },
    { id: "fiver",    n: "High Fiver",          d: "High-five 50 friendlies",             chk: function () { return (S.cnt.fives || 0) >= 50; } },
    { id: "savior",   n: "Squirrel Savior",     d: "Rescue 25 squirrel families",         chk: function () { return (S.cnt.rescues || 0) >= 25; } },
    { id: "orbs",     n: "Orb Hoarder",         d: "Collect 100 Whisper Orbs",            chk: function () { return (S.cnt.orbs || 0) >= 100; } },
    { id: "baron",    n: "Remnant Baron",       d: "Bank 10,000 Remnants",                chk: function () { return (S.cnt.rem || 0) >= 10000; } },
    { id: "grimoire", n: "Grimoire Keeper",     d: "Hold 25 Grimoires",                   chk: function () { return S.grim >= 25; } },
    { id: "chaser",   n: "Challenge Chaser",    d: "Complete 50 challenges",              chk: function () { return (S.cnt.ch || 0) >= 50; } },
    { id: "platsnob", n: "Platform Snob",       d: "Land on 500 platforms",               chk: function () { return (S.cnt.plats || 0) >= 500; } },
    { id: "collect",  n: "The Collector",       d: "Loot 100 pieces of Wizard Drip",      chk: function () { return (S.cnt.loot || 0) >= 100; } },
    { id: "obliv",    n: "Obliviator",          d: "Obliviate 25 items",                  chk: function () { return (S.cnt.obliv || 0) >= 25; } },
    { id: "arch",     n: "Archmage",            d: "Reach Wiz Level 50",                  chk: function () { return S.lvl >= 50; } },
    { id: "legend",   n: "Legend of the Tower", d: "Reach Wiz Level 100",                 chk: function () { return S.lvl >= 100; } },
    { id: "bingus",   n: "Bingus the Great",    d: "Name your wizard “Bingus”", chk: function () { return (S.wiz.name || "").trim().toLowerCase() === "bingus"; } }
  ];
  function titleDef(id) { for (var i = 0; i < TITLES.length; i++) if (TITLES[i].id === id) return TITLES[i]; return TITLES[0]; }
  function titleUnlocked(id) { try { return !!titleDef(id).chk(); } catch (e) { return false; } }
  function curTitle() { var id = S.title || "robbed"; return titleUnlocked(id) ? titleDef(id) : TITLES[0]; }
  function titleName() { return curTitle().n; }
  function titlesHave() { return TITLES.filter(function (t) { return titleUnlocked(t.id); }).length; }
  function checkTitles() {            /* toast any title that just unlocked; S.tseen keeps it from re-toasting */
    if (!S.tseen) S.tseen = {};
    for (var i = 0; i < TITLES.length; i++) { var t = TITLES[i];
      if (t.id !== "robbed" && !S.tseen[t.id] && titleUnlocked(t.id)) { S.tseen[t.id] = 1; if (G && G.toast) G.toast("Title unlocked: " + t.n, "gold"); } }
  }
  function rollRarity(minR) {
    var f = clamp(calc().hap / 150, 0, 1), w = RAR.map(function (r, i) { return i === 0 ? r.w : r.w + (r.cap - r.w) * f; }), tot = 0, i;
    for (i = 0; i < w.length; i++) tot += w[i];
    var x = Math.random() * tot, r = 0;
    for (i = 0; i < w.length; i++) { if (x < w[i]) { r = i; break; } x -= w[i]; }
    r = Math.max(r, minR || 0);
    while (r > 0 && S.lvl < RAR[r].lv) r--;                   /* a rarity not unlocked yet rolls down */
    return r;
  }
  function makeItem(minR, forceR) {
    var open = openSlots().map(function (k) { return /^sim/.test(k) ? "sim" : k; }).filter(function (k, i, a) { return a.indexOf(k) === i; });
    var sk = pick(open), sd = slotDef(sk), r = forceR != null ? forceR : rollRarity(minR), il = clamp(S.lvl + ri(-2, 2), 1, 100), R_ = RAR[r];
    var pool = SK.slice(), lines = [];
    for (var i = 0; i < R_.lines && pool.length; i++) {
      var wts = pool.map(function (k) { return sd.lean && sd.lean.indexOf(k) >= 0 ? 3 : 1; }), tot = wts.reduce(function (a, b) { return a + b; }, 0), x = Math.random() * tot, j = 0;
      while (x >= wts[j]) { x -= wts[j]; j++; }
      var k = pool.splice(j, 1)[0], st = STAT[k];
      lines.push([k, r1((st.a + (st.b - st.a) * (il - 1) / 99) * R_.m)]);
    }
    var kind = ri(0, sd.nouns.length - 1);
    return { id: S.nid++, s: sk, r: r, il: il, n: ADJ[lines[0][0]] + " " + sd.nouns[kind], l: lines, k: kind, h: ri(0, 359) };
  }
  function itemSub(it) { return "Lv " + it.il + (it.l.length ? " · " + it.l.map(function (l) { return "+" + l[1] + STAT[l[0]].u + " " + STAT[l[0]].d; }).join(" · ") : " · no stats"); }
  function buyPrice(it) { return Math.round((80 + 12 * it.il) * (it.r ? 3 : 1)); }
  function sellPrice(it) { return it.st ? 1 : Math.round((20 + 3 * it.il) * (1 + it.r * 1.5)); }
  function stock() {
    var slot = Math.floor(Date.now() / 1800000);
    if (S.shop.slot !== slot || !S.shop.items) { S.shop = { slot: slot, items: [] }; for (var i = 0; i < 6; i++) S.shop.items.push(makeItem(0, Math.random() < 0.08 ? 1 : 0)); save(); }
    return S.shop.items;
  }
  function giveInc(id, g) {
    if (S.inc[id]) { var n = RAR[INC[id].r].syl; S.syl += n; if (g) g.toast("Duplicate " + INC[id].n + ": +" + n + " Shattered Syllables"); return false; }
    S.inc[id] = { k: 0 }; if (g) g.toast("New Incantation: " + INC[id].n, "gold"); return true;
  }

  /* ---------------- controls ---------------- */
  var ACTS = [["jump", "Jump / Hold To Glide"], ["drop", "Drop Through Platform"], ["flash", "Illusion Flash (dodge)"], ["c1", "Incantation 1"], ["c2", "Incantation 2"], ["c3", "Incantation 3"], ["five", "High Five"], ["slow", "Run Slower"], ["fast", "Run Faster"]];
  var DEFK = { jump: ["Space", "KeyW", "ArrowUp"], drop: ["KeyS", "ArrowDown"], flash: ["ShiftLeft"], c1: ["KeyJ"], c2: ["KeyK"], c3: ["KeyL"], five: ["KeyF"], slow: ["Digit1"], fast: ["Digit2"] };
  var DEFP = { jump: "a", drop: "down", flash: "lb", c1: "x", c2: "y", c3: "b", five: "rb", slow: "lt", fast: "rt" };
  var FLASHCD = 3.2, FLASHDUR = 0.5;                     /* Illusion Flash: a short dodge of i-frames on a cooldown */
  var LOOTCARD = 2.7;                                     /* how long a "Loot Get!" card stays on screen */
  /* ---- touch controls: on-screen buttons for phones/tablets, shown once a coarse pointer is seen ---- */
  var touchUI = false; try { touchUI = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(pointer: fine)").matches); } catch (e) {}
  var TB = { jump: { cx: W - 108, cy: H - 112, r: 76 }, dodge: { cx: W - 108, cy: H - 262, r: 54 }, drop: { cx: W - 262, cy: H - 112, r: 56 } };
  function spellRects() {                                 /* the in-run spell-rack cards double as cast buttons */
    var out = []; S.incEq.slice(0, incSlots()).forEach(function (id, j) { out.push({ slot: j, keyed: !!(INC[id] && INC[id].key), x: 150 + j * 262, y: H - 78, w: 250, h: 62 }); }); return out;
  }
  function hitTouchZone(x, y) {                           /* which on-screen control a tap landed on (null = open area -> jump) */
    function inC(c) { var dx = x - c.cx, dy = y - c.cy; return dx * dx + dy * dy <= c.r * c.r; }
    if (S.flashOn && inC(TB.dodge)) return "flash";
    if (inC(TB.drop)) return "drop";
    if (inC(TB.jump)) return "jump";
    var sr = spellRects(); for (var i = 0; i < sr.length; i++) { var s = sr[i]; if (s.keyed && x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return "c" + (s.slot + 1); }
    return null;
  }
  function chevron(ctx, cx, cy, dir, col) {               /* a small up/down arrow glyph */
    ctx.strokeStyle = col; ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(cx - 15, cy + dir * 8); ctx.lineTo(cx, cy - dir * 8); ctx.lineTo(cx + 15, cy + dir * 8); ctx.stroke(); ctx.lineCap = "butt";
  }
  function touchBtn(ctx, c, glyph, label, held) {        /* a round on-screen control */
    ctx.fillStyle = held ? "rgba(255,224,138,.26)" : "rgba(14,10,8,.60)"; ctx.beginPath(); ctx.arc(c.cx, c.cy, c.r, 0, TAU); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = held ? "#ffe08a" : "rgba(232,193,90,.7)"; ctx.beginPath(); ctx.arc(c.cx, c.cy, c.r - 2, 0, TAU); ctx.stroke();
    glyph(ctx, c);
    if (label) bold(ctx, label, c.cx, c.cy + c.r - 9, "800 13px " + F.mono, "rgba(255,243,196,.9)", "center");
  }
  function drawTouchControls(ctx) {                        /* jump / dodge / drop pads for touch play */
    touchBtn(ctx, TB.jump, function (x, geo) { chevron(x, geo.cx, geo.cy - 6, 1, "#fff3c4"); }, "JUMP", R.touchZone === "jump");
    touchBtn(ctx, TB.drop, function (x, geo) { chevron(x, geo.cx, geo.cy - 6, -1, "#f3e6c4"); }, "DROP", !!R.touchHeld.drop);
    if (S.flashOn) {
      var ready = R.flashCd <= 0, ff = ready ? 1 : 1 - clamp(R.flashCd / FLASHCD, 0, 1), c = TB.dodge;
      touchBtn(ctx, c, function () {
        icoAt(ctx, "flash", c.cx - 16, c.cy - 20, 2);
        ctx.strokeStyle = ready ? "#9ff0c4" : "rgba(127,220,255,.9)"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(c.cx, c.cy, c.r - 7, -Math.PI / 2, -Math.PI / 2 + ff * TAU); ctx.stroke();
      }, ready ? "DODGE" : r1(R.flashCd) + "s", false);
    }
  }
  /* Binds are arrays of up to 3 (keyboard codes or pad buttons); old single-string saves and the defaults both read fine. */
  function keysOf(a) { var b = S.binds[a]; if (Array.isArray(b)) return b.length ? b : DEFK[a]; return b ? [b] : DEFK[a]; }
  function padsOf(a) { var b = S.pad[a]; if (Array.isArray(b)) return b.length ? b : (DEFP[a] ? [DEFP[a]] : []); return b ? [b] : (DEFP[a] ? [DEFP[a]] : []); }
  function padOf(a) { return padsOf(a)[0]; }
  function bindsOf(kind, a) { return kind === "key" ? keysOf(a) : padsOf(a); }
  function bindLabel(kind, c) { return kind === "key" ? keyName(c) : String(c).toUpperCase(); }
  function bindOwn(kind, a) { var m = kind === "key" ? S.binds : S.pad; if (!Array.isArray(m[a])) m[a] = bindsOf(kind, a).slice(); return m[a]; }
  function addBind(kind, a, code) { if (!code) return; var arr = bindOwn(kind, a); if (arr.indexOf(code) >= 0) return;
    ACTS.forEach(function (o) { if (o[0] !== a && bindsOf(kind, o[0]).indexOf(code) >= 0) { var oa = bindOwn(kind, o[0]); if (oa.length > 1) oa.splice(oa.indexOf(code), 1); } });
    if (arr.length < 3) arr.push(code); save(); }
  function removeBind(kind, a, code) { var arr = bindOwn(kind, a); if (arr.length <= 1) return; var k = arr.indexOf(code); if (k >= 0) arr.splice(k, 1); save(); }
  function keyName(c) { if (/^Shift/.test(c)) return "Shift"; if (/^Control/.test(c)) return "Ctrl"; return c.replace(/^Key|^Digit/, "").replace(/^Arrow/, "Arrow ").replace("Space", "Space"); }
  function isDown(g, a) {
    if (R && R.touchHeld && R.touchHeld[a]) return true;
    var ks = keysOf(a); for (var i = 0; i < ks.length; i++) if (g.key(ks[i])) return true;
    if (g.pad) { var ps = padsOf(a); for (var j = 0; j < ps.length; j++) if (g.pad.btn[ps[j]]) return true; }
    return a === "drop" && g.pad && g.pad.ly > 0.6;
  }
  function isHit(g, a) {
    if (R && R.touchHit && R.touchHit[a]) return true;
    var ks = keysOf(a); for (var i = 0; i < ks.length; i++) if (g.hit(ks[i])) return true;
    if (g.pad) { var ps = padsOf(a); for (var j = 0; j < ps.length; j++) if (g.pad.hit[ps[j]]) return true; }
    return false;
  }

  /* ---------------- sound ---------------- */
  var SND = { ctx: null };
  function ac() {
    if (!S.snd) return null;
    try {
      if (!SND.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
        SND.ctx = new AC(); SND.master = SND.ctx.createGain(); SND.master.connect(SND.ctx.destination);
        var len = SND.ctx.sampleRate, buf = SND.ctx.createBuffer(1, len, SND.ctx.sampleRate), d = buf.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        SND.noise = buf; SND.clip = {};
        ["item", "item-rare", "levelup", "challenge"].forEach(function (n) {          /* the recorded sounds; the synth versions cover until they load */
          fetch("/assets/arcade/sfx/wz-" + n + ".mp3?v=1").then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); })
            .then(function (ab) { return new Promise(function (ok, no) { SND.ctx.decodeAudioData(ab, ok, no); }); }).then(function (bf) { SND.clip[n] = bf; }).catch(function () {});
        });
      }
      if (SND.ctx.state === "suspended") SND.ctx.resume();
      SND.master.gain.value = 0.5 * S.vol;
      return SND.ctx;
    } catch (e) { return null; }
  }
  function env(gn, t, a, peak, dec) { gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); gn.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  function tone(type, f0, f1, dur, peak, delay) {
    var c = ac(); if (!c) return; var t = c.currentTime + (delay || 0), o = c.createOscillator(), gn = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(gn, t, 0.004, peak, dur); o.connect(gn); gn.connect(SND.master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(ftype, f0, f1, dur, peak) {
    var c = ac(); if (!c) return; var t = c.currentTime, n = c.createBufferSource(), f = c.createBiquadFilter(), gn = c.createGain();
    n.buffer = SND.noise; f.type = ftype; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(gn, t, 0.005, peak, dur); n.connect(f); f.connect(gn); gn.connect(SND.master); n.start(t, Math.random() * 0.5); n.stop(t + dur + 0.05);
  }
  function clip(n) {                                    /* plays a recorded sound; false when it isn't loaded */
    var c = ac(); if (!c || !SND.clip || !SND.clip[n]) return false;
    try { var s = c.createBufferSource(), gn = c.createGain(); s.buffer = SND.clip[n]; gn.gain.value = 1.5; s.connect(gn); gn.connect(SND.master); s.start(); return true; } catch (e) { return false; }
  }
  function sfx(k) {
    if (k === "loot" && clip("item")) return;
    if (k === "lootBig" && clip("item-rare")) return;
    if (k === "ch" && clip("challenge")) return;
    if (k === "lvl") { if (!clip("levelup")) [523, 659, 784, 1047].forEach(function (f, i) { tone("square", f, 0, 0.16, 0.14, i * 0.12); }); return; }
    if (k === "jump") tone("square", 300, 520, 0.09, 0.12);
    else if (k === "jump2") { tone("square", 420, 760, 0.1, 0.12); noise("highpass", 1800, 4000, 0.12, 0.08); }
    else if (k === "land") noise("lowpass", 300, 120, 0.06, 0.12);
    else if (k === "poof") noise("bandpass", 700, 250, 0.16, 0.3);
    else if (k === "snap") { tone("sawtooth", 1400, 500, 0.08, 0.14); noise("highpass", 3000, 6000, 0.05, 0.1); }
    else if (k === "zap") tone("sawtooth", 900, 200, 0.07, 0.08);
    else if (k === "fire") noise("bandpass", 1200, 400, 0.22, 0.2);
    else if (k === "hit") { tone("square", 180, 70, 0.2, 0.3); noise("lowpass", 800, 200, 0.2, 0.3); }
    else if (k === "ward") { tone("sine", 500, 900, 0.2, 0.2); }
    else if (k === "kill") { tone("triangle", 260, 90, 0.14, 0.2); noise("bandpass", 900, 300, 0.1, 0.15); }
    else if (k === "rem") tone("sine", 1250 + Math.random() * 250, 0, 0.06, 0.07);
    else if (k === "orb") { tone("sine", 520, 1040, 0.3, 0.2); tone("sine", 780, 1560, 0.3, 0.14, 0.08); }
    else if (k === "grim") { tone("triangle", 392, 0, 0.12, 0.2); tone("triangle", 523, 0, 0.12, 0.2, 0.1); tone("triangle", 659, 0, 0.2, 0.2, 0.2); }
    /* synth versions of the recorded pickups, used only if a file fails to load */
    else if (k === "loot") { [784, 988, 1319].forEach(function (f, i) { tone("triangle", f, 0, 0.12, 0.16, i * 0.06); }); noise("highpass", 5000, 8000, 0.1, 0.05); }
    else if (k === "lootBig") { [523, 659, 784, 1047, 1319, 1568].forEach(function (f, i) { tone("square", f, 0, 0.18, 0.13, i * 0.085); tone("sine", f * 2, 0, 0.3, 0.08, i * 0.085); }); tone("sawtooth", 98, 196, 0.5, 0.16); noise("highpass", 4000, 9000, 0.7, 0.07); }
    else if (k === "ch") { tone("square", 660, 0, 0.08, 0.12); tone("square", 990, 0, 0.14, 0.12, 0.08); }
    else if (k === "five") { noise("highpass", 1500, 3000, 0.05, 0.3); }
    else if (k === "slap") { noise("lowpass", 1700, 500, 0.05, 0.5); noise("highpass", 2600, 1200, 0.04, 0.18); tone("sine", 240, 90, 0.07, 0.2); }
    else if (k === "flash") { tone("sine", 900, 1700, 0.14, 0.14); tone("sine", 1400, 2600, 0.12, 0.08, 0.02); noise("highpass", 3200, 7000, 0.12, 0.09); }
    else if (k === "boss") { tone("sawtooth", 110, 55, 0.6, 0.3); }
    else if (k === "win") { [523, 659, 784, 1047].forEach(function (f, i) { tone("square", f, 0, 0.16, 0.14, i * 0.12); }); }
    else if (k === "lose") { [392, 330, 262, 196].forEach(function (f, i) { tone("triangle", f, 0, 0.2, 0.2, i * 0.14); }); }
    else if (k === "buy") { tone("sine", 880, 0, 0.08, 0.16); tone("sine", 1320, 0, 0.12, 0.16, 0.07); }
  }

  /* ---------------- the pixel wizard ---------------- */
  function hslHex(h, s, l) {
    s /= 100; l /= 100; var k = function (n) { return (n + h / 30) % 12; }, a = s * Math.min(l, 1 - l);
    var f = function (n) { return Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))); };
    return "#" + ((1 << 24) + (f(0) << 16) + (f(8) << 8) + f(4)).toString(16).slice(1);
  }
  function lookOf(comfort, nude) {
    var eq = nude ? {} : comfort ? starter() : S.eq;
    function col(it) {
      if (!it) return null;
      if (it.st) return { c1: "#e6e3dc", c2: "#8f8f96", st: 1, k: it.k };
      return { c1: hslHex(it.h || 0, 42, 44), c2: it.r === 5 ? "rb" : RAR[it.r].c, k: it.k };
    }
    var sims = []; for (var i = 1; i <= 6; i++) if (eq["sim" + i]) sims.push(col(eq["sim" + i]));
    return { a: S.wiz, head: col(eq.head), chest: col(eq.chest), legs: col(eq.legs), feet: col(eq.feet), hands: col(eq.hands), main: col(eq.main), off: col(eq.off),
      waist: col(eq.waist), neck: col(eq.neck), shoulder: col(eq.shoulder), back: col(eq.back), sims: sims, hat: !nude && !!(S.cos.hat && S.cos.hatOn), nude: !!nude };
  }
  var WC = document.createElement("canvas"); WC.width = 64; WC.height = 88; var wc = WC.getContext("2d");
  function P(x, y, w, h, c) { wc.fillStyle = c; wc.fillRect(Math.round(x), Math.round(y), w, h); }
  function PL(x0, y0, x1, y1, th, c, c2, split) {      /* a chunky pixel line; c2 takes over after `split` (0..1), or stripes when split is absent */
    var n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (var i = 0; i <= n; i++) {
      wc.fillStyle = c2 ? (split != null ? (i / n < split ? c : c2) : (((i >> 1) & 1) ? c2 : c)) : c;
      wc.fillRect(Math.round(x0 + (x1 - x0) * i / n - th / 2), Math.round(y0 + (y1 - y0) * i / n - th / 2), th, th);
    }
  }
  function wizSprite(L, pose, t) {
    wc.clearRect(0, 0, 64, 88);
    var a = L.a, cx = 30, fy = 84, sh = clamp(Math.round(a.shape * 10), 0, 10), lth = sh >= 9 ? 5 : sh >= 5 ? 4 : 3, ath = sh >= 9 ? 4 : sh >= 5 ? 3 : 2, i;
    var leg = 14 + Math.round(4 * a.height), tor = 16 + Math.round(4 * a.height), tw = 3 + Math.round(0.7 * sh), belly = [0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3][sh];
    var skin = SKIN[a.skin], skinD = shade(skin, -0.2), hairC = HAIRC[a.hairCol][1];
    function rc(o) { return o.c2 === "rb" ? hslHex((t * 140) % 360, 85, 62) : o.c2; }
    var p = t * 11, lean = 0, hipY = fy - leg, torL = tor, bob = 0, hx0 = 0;
    var f1 = [cx - 2, fy], f2 = [cx + 2, fy], k1 = null, k2 = null;
    if (pose === "run") { lean = 2; f1 = [cx - Math.sin(p) * 6, fy - Math.max(0, -Math.cos(p)) * 4]; f2 = [cx + Math.sin(p) * 6, fy - Math.max(0, Math.cos(p)) * 4]; bob = Math.abs(Math.sin(p)) > 0.7 ? 1 : 0; }
    else if (pose === "jump") { f1 = [cx - 4, fy - 1]; f2 = [cx + 4, fy - 5]; lean = 1; }
    else if (pose === "glide") { f1 = [cx - 7, fy - 2]; f2 = [cx - 3, fy]; lean = 3; }
    else if (pose === "sit") { hipY = fy - 9; k1 = [cx + 6, hipY + 1]; k2 = [cx + 8, hipY + 1]; f1 = [cx + 6, fy]; f2 = [cx + 8, fy]; lean = 3; bob = Math.sin(t * 5) > 0 ? 1 : 0; }
    else if (pose === "dig") { lean = 9; torL = Math.round(tor * 0.8); f1 = [cx - 4, fy]; f2 = [cx + 4, fy]; }
    else if (pose === "read") { hx0 = Math.round(Math.sin(t * 13)); }
    hipY += bob;
    var sy = hipY - torL, sx = cx + lean, h1 = [sx - tw - 1, sy + 12], h2 = [sx + tw + 1, sy + 12];
    if (pose === "run") { h1 = [sx - tw + Math.sin(p) * 5, sy + 10]; h2 = [sx + tw - Math.sin(p) * 5, sy + 10]; }
    else if (pose === "jump") { h1 = [sx - tw - 3, sy - 3]; h2 = [sx + tw + 3, sy - 5]; }
    else if (pose === "glide") { h1 = [sx - tw - 6, sy + 3]; h2 = [sx + tw + 6, sy + 1]; }
    else if (pose === "sit") { h1 = [sx + 4, hipY - 1]; h2 = [sx + 6, hipY - 1]; }
    else if (pose === "dig") { var dg = Math.sin(t * 12) * 3; h1 = [sx + 3, fy - 8 + dg]; h2 = [sx + 7, fy - 6 - dg]; }
    else if (pose === "read") { h1 = [sx + tw + 2, sy + 8]; h2 = [sx + tw + 4, sy + 7]; }
    else if (pose === "five") { h2 = [sx + tw + 5, sy - 6]; }
    else if (pose === "hold") { h1 = [sx - 3, sy - 17]; h2 = [sx + 6, sy - 17]; }
    var cc = L.chest ? L.chest.c1 : skin, ccD = shade(cc, -0.18);
    var legC = L.legs ? L.legs.c1 : L.nude ? skin : "#d8d4cc", legLong = !!(L.legs && !L.legs.st && L.legs.k > 0), shoe = L.feet ? L.feet.c1 : null;
    /* cape */
    if (L.back) for (i = 1; i < torL + 4; i++) P(sx - tw - 2 - Math.round(Math.sin(t * 6 + i * 0.4) * (pose === "run" ? 2 : 0.6) + i * 0.25), sy + i, 3, 1, i % 5 === 4 ? rc(L.back) : L.back.c1);
    /* back arm */
    PL(sx - tw + 1, sy + 2, h1[0], h1[1], ath, L.chest ? ccD : skinD, skinD, 0.55);
    if (L.hands) P(h1[0] - 1, h1[1] - 1, ath, 3, shade(L.hands.c1, -0.15));
    if (L.off) {
      if (L.off.k === 0) { P(h1[0] - 3, h1[1] - 2, 5, 6, L.off.c1); P(h1[0] - 3, h1[1] - 2, 1, 6, rc(L.off)); }
      else if (L.off.k === 1) { P(h1[0] - 2, h1[1] + 1, 3, 3, rc(L.off)); }
      else { P(h1[0] - 2, h1[1] + 1, 3, 4, L.off.c1); P(h1[0] - 1, h1[1] + 2, 1, 2, "#ffe58a"); }
    }
    /* legs */
    function legDraw(hx, f, k, dark) {
      k = k || [(hx + f[0]) / 2 + 1.5, (hipY + f[1]) / 2];
      var c = dark ? shade(legC, -0.15) : legC, sk = dark ? skinD : skin, stripe = L.legs && L.legs.st ? (dark ? "#77777e" : "#8f8f96") : null;
      PL(hx, hipY, k[0], k[1], lth, c, stripe);
      PL(k[0], k[1], f[0], f[1] - 2, lth, legLong ? c : sk);
      P(f[0] - 1, f[1] - 2, lth + 2, 2, shoe ? (dark ? shade(shoe, -0.15) : shoe) : sk);
    }
    legDraw(cx - 1, f1, k1, true); legDraw(cx + 1, f2, k2, false);
    /* torso */
    var front = 0;
    for (i = 0; i < torL; i++) {
      var fr = 1 - i / torL, xo = Math.round(lean * fr), hw = tw; front = 0;
      if (a.body === 0 && i < 3) hw += 1;
      if (a.body === 1 && (i < 2 || (i > torL * 0.45 && i < torL * 0.65))) hw -= 1;
      if (belly && i > torL * 0.3 && i < torL * 0.9) front = (i > torL * 0.45 && i < torL * 0.8) ? belly : Math.max(1, belly - 1);
      P(cx + xo - Math.max(2, hw), sy + i, Math.max(2, hw) * 2 + front, 1, cc);
    }
    if (L.chest) {
      P(cx - tw, hipY, tw * 2, 3, cc); P(cx - tw, hipY + 2, tw * 2, 1, rc(L.chest));
      if (L.chest.st) { P(cx + lean, sy + 6, 2, 2, "#b9b29e"); P(cx - 3 + lean, sy + 4, 1, 1, "#a9a290"); P(cx - 2, sy + 11, 1, 1, skin); P(cx + 2, sy + 13, 2, 1, skin); }
      else P(cx + lean - 1, sy + 1, 2, torL - 2, rc(L.chest));
    }
    if (L.nude) {                                        /* fig leaves, for modesty */
      var lf = "#4f9a3f", lfD = "#2f6b2c";
      P(cx - 3, hipY - 2, 7, 3, lf); P(cx - 2, hipY + 1, 5, 2, lf); P(cx - 1, hipY + 3, 3, 1, lf); P(cx, hipY - 2, 1, 6, lfD); P(cx - 2, hipY - 1, 1, 1, lfD); P(cx + 2, hipY - 1, 1, 1, lfD);
      if (a.body === 1) { var ly = sy + 4, lx = cx + Math.round(lean * 0.75); P(lx - 5, ly, 5, 3, lf); P(lx - 4, ly + 3, 3, 1, lf); P(lx - 3, ly, 1, 4, lfD); P(lx + 1, ly, 5, 3, lf); P(lx + 2, ly + 3, 3, 1, lf); P(lx + 3, ly, 1, 4, lfD); }
    }
    if (L.waist) { P(cx - tw, hipY - 2, tw * 2, 2, L.waist.c1); P(cx + 1, hipY - 2, 2, 2, rc(L.waist)); }
    if (L.shoulder) { P(sx - tw - 1, sy, 3, 2, L.shoulder.c1); P(sx + tw - 2, sy, 3, 2, L.shoulder.c1); }
    /* head */
    var hx = sx + 1 + hx0, T = sy - 13, rows = HEADS[a.head], hwm = rows[5];
    P(hx - 2, sy - 1, 4, 1, skinD);
    if (L.neck) P(hx - 3, sy - 1, 6, 2, L.neck.c1);
    for (i = 0; i < 12; i++) P(hx - rows[i], T + i, rows[i] * 2, 1, skin);
    function top() { P(hx - hwm, T - 1, hwm * 2, 3, hairC); P(hx - hwm, T + 2, 3, 3, hairC); }
    switch (a.hair) {
      case 1: top(); break;
      case 2: top(); P(hx - hwm - 1, T + 2, 3, 16, hairC); break;
      case 3: top(); PL(hx - hwm, T + 4, hx - hwm - 7, T + 9, 2, hairC); break;
      case 4: top(); for (i = 0; i < 7; i++) P(hx - hwm - 2 + i * 2 + (i % 2), T - 3 - (i % 3), 2, 3, hairC); break;
      case 5: top(); P(hx + hwm - 4, T + 1, 4, 3, hairC); break;
      case 6: P(hx - 3, T - 5, 7, 5, hairC); P(hx - 2, T - 6, 5, 1, hairC); break;
      case 7: top(); P(hx - hwm - 3, T - 3, 5, 5, hairC); break;
      case 8: top(); for (i = 0; i < 18; i++) { P(hx - hwm - 1 + ((i >> 1) & 1), T + 3 + i, 2, 1, hairC); P(hx - hwm + 2 - ((i >> 1) & 1), T + 12 + i * 0.5, 1, 1, hairC); } break;
      case 9: top(); for (i = 0; i < 5; i++) P(hx - hwm - 1 + i * 3, T - 2, 2, 2, hairC); P(hx - hwm - 1, T + 2, 3, 8, hairC); break;
      case 10: P(hx - hwm - 1, T - 1, hwm * 2 + 2, 4, hairC); P(hx - hwm - 1, T + 3, 3, 4, hairC); break;
      case 11: P(hx - hwm, T + 3, 3, 5, hairC); break;
      case 12: P(hx - hwm, T + 1, 3, 3, hairC); P(hx - hwm - 1, T + 3, 3, 14, hairC); break;
      case 13: for (i = -7; i <= 7; i++) { var bw = Math.round(Math.sqrt(Math.max(0, 81 - i * i * 1.5))), yy = T + i, x0 = hx - 1 - bw;
        if (yy <= T + 1) P(x0, yy, bw * 2, 1, hairC); else P(x0, yy, Math.max(0, hx - hwm + 2 - x0), 1, hairC); } break;
      case 14: top(); P(hx - hwm - 4, T + 3, 4, 3, hairC); P(hx - hwm - 5, T + 5, 3, 3, hairC); P(hx - hwm - 3, T + 9, 3, 3, hairC); break;
    }
    if (L.head || L.hat) wc.clearRect(0, 0, 64, T - 1);
    /* face */
    P(hx - 1, T + 5, 1, 2, "#1a1420"); P(hx + 2, T + 5, 1, 2, "#1a1420");
    P(hx + rows[6], T + 6, 1, 2, skinD);
    P(hx + 1, T + 9, 2, 1, shade(skin, -0.38));
    var bd = a.beard, r0 = rows[9];
    if (bd === 1) { for (i = 8; i < 12; i++) for (var q = -rows[i]; q < rows[i]; q++) if ((q + i) % 2 === 0) P(hx + q, T + i, 1, 1, shade(skin, -0.3)); }
    if (bd === 2 || bd >= 4 && bd <= 6) { P(hx - 1, T + 8, 5, 1, hairC); P(hx - 2, T + 9, 1, 1, hairC); P(hx + 4, T + 9, 1, 1, hairC); }
    if (bd === 3) P(hx, T + 10, 3, 3, hairC);
    if (bd >= 4 && bd <= 6) {
      for (i = 9; i < 12; i++) P(hx - rows[i], T + i, rows[i] * 2, 1, hairC);
      P(hx + 1, T + 9, 2, 1, shade(skin, -0.38));
      var len = bd === 4 ? 2 : bd === 5 ? 8 : torL + 2;
      for (i = 0; i < len; i++) { var bwid = Math.max(2, Math.round(r0 * 2 * (1 - i / (len + 2)))); P(hx - Math.floor(bwid / 2) + (bd === 6 ? Math.round(Math.sin(t * 5 + i * 0.5) * (pose === "run" ? 1 : 0)) : 0), T + 12 + i, bwid, 1, hairC); }
    }
    if (bd === 7) {                                      /* both chops run from the hairline down to the jaw */
      for (i = 2; i < 11; i++) { P(hx - rows[i], T + i, i > 7 ? 3 : 2, 1, hairC); P(hx + rows[i] - (i > 7 ? 2 : 1), T + i, i > 7 ? 2 : 1, 1, hairC); }
      P(hx - 1, T + 5, 1, 2, "#1a1420"); P(hx + 2, T + 5, 1, 2, "#1a1420");
    }
    var br = a.brow;
    if (br === 0) { P(hx - 2, T + 4, 2, 1, hairC); P(hx + 1, T + 4, 2, 1, hairC); }
    else if (br === 1) { P(hx - 3, T + 4, 3, 1, hairC); P(hx + 1, T + 4, 3, 1, hairC); }
    else if (br === 2) { P(hx - 3, T + 3, 3, 2, hairC); P(hx + 1, T + 3, 3, 2, hairC); }
    else if (br === 3) { P(hx - 5, T + 3, 5, 2, hairC); P(hx + 1, T + 3, 5, 2, hairC); P(hx - 6, T + 2, 2, 1, hairC); P(hx + 5, T + 2, 2, 1, hairC); }
    else { P(hx - 9, T + 2, 9, 3, hairC); P(hx + 1, T + 2, 9, 3, hairC); P(hx - 11, T, 3, 2, hairC); P(hx + 9, T, 3, 2, hairC); P(hx - 12, T - 2, 2, 2, hairC); P(hx + 11, T - 2, 2, 2, hairC); }
    /* hat */
    if (L.hat) {
      P(hx - hwm - 3, T + 1, hwm * 2 + 6, 2, "#5b3aa8");
      for (i = 0; i < 14; i++) { var cw = Math.max(1, hwm * 2 - i); P(hx - cw / 2 - Math.round(i * i * 0.03), T - i, cw, 1, "#6a45c2"); }
      P(hx - hwm, T - 1, hwm * 2, 1, "#f0c23a"); P(hx - 1, T - 6, 2, 2, "#f0c23a");
    } else if (L.head) {
      var hc = L.head, k = hc.k;
      if (k === 0) {
        for (i = -hwm - 1; i <= hwm; i++) P(hx + i, T - 2, 1, 4, (((i + 20) >> 1) & 1) ? hc.c1 : hc.c2);
        PL(hx - 2, T - 3, hx - hwm - 7, T + 5, 3, hc.c1, hc.c2); P(hx - hwm - 9, T + 5, 3, 3, "#ffffff");
        if (hc.st) { wc.clearRect(hx + 2, T + 1, 1, 1); wc.clearRect(hx - 3, T - 2, 1, 1); wc.clearRect(hx - hwm - 4, T + 2, 1, 1); }
      } else if (k === 1) {
        P(hx - hwm - 3, T + 1, hwm * 2 + 6, 2, hc.c1);
        for (i = 0; i < 14; i++) { var cw2 = Math.max(1, hwm * 2 - i); P(hx - cw2 / 2 - Math.round(i * i * 0.03), T - i, cw2, 1, hc.c1); }
        P(hx - hwm, T - 1, hwm * 2, 1, rc(hc));
      } else {
        P(hx - hwm - 1, T - 2, hwm * 2 + 2, 4, hc.c1); P(hx - hwm - 2, T + 2, 3, 11, hc.c1); P(hx + hwm, T - 1, 1, 3, rc(hc));
        if (k === 3) P(hx - hwm - 1, T + 11, hwm * 2 + 2, 3, hc.c1);
      }
    }
    /* front arm, and what it holds */
    PL(sx + tw - 1, sy + 2, h2[0], h2[1], ath, L.chest ? cc : skin, skin, 0.55);
    if (L.hands) P(h2[0] - 1, h2[1] - 1, ath, 3, L.hands.c1);
    if (pose === "read") { P(h2[0] - 1, h2[1] - 6, 6, 8, "#efe2b8"); P(h2[0], h2[1] - 4, 4, 1, "#8a7a55"); P(h2[0], h2[1] - 2, 4, 1, "#8a7a55"); }
    else if (pose === "hold") { P(sx - 7, sy - 21, 16, 3, "#efe2b8"); P(sx - 7, sy - 18, 16, 1, "#c9b98a"); }
    else if (L.main) {
      var mk = L.main.k, wx = h2[0], wy = h2[1];
      if (mk === 2) { PL(wx + 1, wy + 6, wx + 1, sy - 12, 1, "#7a5a3a"); P(wx, sy - 15, 3, 3, rc(L.main)); }
      else { PL(wx, wy, wx + 5, wy - 9, 1, mk === 1 ? L.main.c1 : "#7a5a3a"); if (mk === 1) P(wx + 5, wy - 10, 2, 2, rc(L.main)); if (mk === 3) P(wx + 4, wy - 11, 3, 2, rc(L.main)); }
    }
    for (i = 0; i < L.sims.length; i++) { var an = t * 1.5 + i * TAU / L.sims.length; P(hx + Math.cos(an) * 13, T + 4 + Math.sin(an) * 5, 2, 2, rc(L.sims[i])); }
  }
  function blitWiz(c, x, footY, sc) { c.drawImage(WC, Math.round(x - 30 * sc), Math.round(footY - 84 * sc), 64 * sc, 88 * sc); }

  /* ---------------- the pixel buffer and the scenery ---------------- */
  var BUF = document.createElement("canvas"); BUF.width = BW; BUF.height = BH; var b = BUF.getContext("2d");
  function px(x, y, w, h, c) { b.fillStyle = c; b.fillRect(Math.round(x), Math.round(y), w, h); }
  function drawForest(dist, t) {
    var i, x, sky = ["#6fb7e2", "#82c3e8", "#97d0ec", "#aedcef", "#c5e7f1", "#d9f0f2"];
    for (i = 0; i < 6; i++) px(0, i * 34, BW, 34, sky[i]);
    for (i = 0; i < 5; i++) { x = ((i * 190 - dist * 0.04) % (BW + 120) + BW + 120) % (BW + 120) - 60; var cy = 24 + hash(i) * 50; px(x, cy, 44, 8, "#fff"); px(x + 8, cy - 5, 26, 5, "#fff"); px(x + 4, cy + 8, 34, 3, "#e6f1f6"); }
    /* far tree line, with the tower you left behind */
    var fo = dist * 0.12, tx = 250 - fo;
    if (tx > -60) { px(tx, 96, 26, 110, "#6a7482"); px(tx - 14, 150, 54, 56, "#6a7482"); px(tx + 6, 86, 6, 10, "#6a7482"); px(tx + 16, 90, 5, 6, "#6a7482"); px(tx + 8, 118, 9, 12, "#39424f"); }
    for (x = -((fo) % 8); x < BW; x += 8) { var c0 = Math.floor((x + fo) / 8), hh = 34 + hash(c0) * 30 + Math.sin(c0 * 0.35) * 10; px(x, 204 - hh, 8, hh + 90, "#4f8f68"); if (hash(c0 + 9) > 0.6) px(x + 2, 200 - hh, 4, 4, "#5d9d76"); }
    /* a slow river across the far distance, sitting in the very back behind the trees */
    var rvo = dist * 0.06, ry = 198;
    for (x = 0; x < BW; x += 4) { var rw = Math.sin((x + rvo) * 0.028) * 2; px(x, ry + rw, 4, 10, "#4f9fd0"); px(x, ry + rw, 4, 3, "#79c0e8"); px(x, ry + rw + 10, 4, 2, "#3f7faa"); }
    for (i = 0; i < 44; i++) { var gx = ((i * 71 - rvo * 1.4) % (BW + 40) + BW + 40) % (BW + 40) - 20, gw = Math.sin((gx + rvo) * 0.028) * 2; px(gx, ry + 2 + (i % 4) * 2 + gw, 5, 1, "#d8f2ff"); }
    /* a hazier row of trees behind, so the wood has depth */
    var ho = dist * 0.26;
    for (i = Math.floor(ho / 58) - 1; i < Math.floor((ho + BW) / 58) + 2; i++) {
      x = i * 58 + hash(i * 2.9) * 30 - ho; var hh2 = 70 + hash(i * 4.3) * 60, pine = hash(i * 6.1) > 0.6;
      px(x + 8, GY - hh2, 5, hh2, "#3d5f4c");
      if (pine) { for (var q = 0; q < 5; q++) px(x + 2 - q * 3, GY - hh2 - 26 + q * 12, 17 + q * 6, 12, "#34674a"); }
      else { px(x - 10, GY - hh2 - 22, 40, 30, "#3f7d58"); px(x - 4, GY - hh2 - 32, 28, 12, "#3f7d58"); px(x - 6, GY - hh2 - 16, 16, 8, "#4a8a63"); }
    }
    /* middle trees: thick oaks, medium trees, thin birches, the odd orange one, apple trees and pines */
    var mo = dist * 0.45;
    for (i = Math.floor(mo / 74) - 2; i < Math.floor((mo + BW) / 74) + 2; i++) {
      x = Math.round(i * 74 + hash(i * 3.1) * 44 - mo); var th = 120 + hash(i * 7.7) * 50, kd = hash(i * 9.7), top = GY - th, k2;
      if (kd < 0.2) {                                    /* thick oak */
        px(x + 6, top + 34, 24, th, "#3f2c1d"); px(x + 10, top + 34, 6, th, "#54402c"); px(x + 24, top + 60, 3, th, "#2f2015"); px(x + 2, GY - 6, 6, 8, "#3f2c1d"); px(x + 28, GY - 5, 6, 7, "#3f2c1d");
        px(x + 14, top + 70, 5, 7, "#2a1c12"); px(x - 26, top - 16, 90, 58, "#27603a"); px(x - 14, top - 34, 66, 22, "#27603a"); px(x - 34, top + 2, 20, 30, "#27603a"); px(x + 58, top + 6, 14, 26, "#27603a");
        px(x - 16, top - 10, 40, 22, "#35804a"); px(x + 20, top - 26, 26, 12, "#35804a"); px(x + 26, top + 18, 34, 18, "#1f4f2f"); px(x - 22, top + 26, 30, 12, "#1f4f2f"); px(x - 4, top - 4, 10, 5, "#4a9a5c");
      } else if (kd < 0.36) {                             /* thin birch */
        px(x + 15, top + 20, 6, th, "#e9e6dc"); px(x + 19, top + 20, 2, th, "#c9c6ba"); for (k2 = 0; k2 < 7; k2++) px(x + 15 + (k2 % 2) * 3, top + 40 + k2 * 17, 3, 2, "#3a3a3a");
        px(x - 2, top - 8, 40, 34, "#6fae5a"); px(x + 4, top - 20, 28, 14, "#6fae5a"); px(x + 2, top - 2, 18, 12, "#8cc873"); px(x + 20, top + 12, 16, 10, "#5a9648");
      } else if (kd < 0.46) {                             /* pine */
        px(x + 15, top + 40, 7, th, "#4a3524"); for (k2 = 0; k2 < 6; k2++) { px(x + 12 - k2 * 5, top - 20 + k2 * 16, 14 + k2 * 10, 16, "#1f4d33"); px(x + 12 - k2 * 5, top - 6 + k2 * 16, 14 + k2 * 10, 2, "#173a27"); px(x + 14 - k2 * 3, top - 18 + k2 * 16, 5, 3, "#2f6a48"); }
      } else {                                            /* medium tree: green, autumn orange, or apple */
        var org = kd > 0.9, app = kd > 0.78 && !org, c1 = org ? "#d9772b" : "#2f6b3d", c2 = org ? "#f0a040" : "#3c8049", c3 = org ? "#b85c1e" : "#27593a";
        px(x + 13, top + 30, 12, th, "#4a3524"); px(x + 15, top + 30, 3, th, "#5c4530"); px(x + 22, top + 52, 9, 3, "#4a3524");
        px(x - 12, top - 10, 62, 46, c1); px(x - 2, top - 24, 42, 18, c1); px(x - 18, top + 6, 10, 20, c1); px(x - 4, top - 2, 26, 14, c2); px(x + 22, top + 12, 24, 14, c3); px(x + 8, top - 18, 12, 5, c2);
        if (app) { for (k2 = 0; k2 < 7; k2++) { var ax2 = x - 8 + hash(i + k2 * 1.7) * 52, ay2 = top - 6 + hash(i * 2 + k2) * 36; px(ax2, ay2, 4, 4, "#e23b3b"); px(ax2, ay2, 2, 2, "#ff8a7a"); px(ax2 + 1, ay2 - 1, 1, 1, "#4a3524"); } px(x - 6, GY - 3, 4, 3, "#e23b3b"); px(x + 34, GY - 2, 4, 3, "#c22e2e"); }
        if (org) { for (k2 = 0; k2 < 3; k2++) px(x + 6 + k2 * 14 + Math.sin(t * 1.5 + k2 + i) * 6, top + 40 + ((t * 18 + k2 * 40 + i * 13) % (th - 30)), 3, 2, "#f0a040"); px(x - 4, GY - 2, 5, 2, "#d9772b"); px(x + 30, GY - 2, 6, 2, "#f0a040"); }
      }
    }
    /* grass, flowers, and the small things at the edge of the path */
    for (x = -(dist % 6); x < BW; x += 6) { var g0 = Math.floor((x + dist) / 6); px(x, GY - 3 - (hash(g0) * 4 | 0), 6, 8, hash(g0 + 2) > 0.5 ? "#3f8a3f" : "#357a38"); if (hash(g0 * 1.7) > 0.93) { px(x + 2, GY - 9, 2, 2, hash(g0) > 0.5 ? "#ffd76b" : "#ff8fb0"); } }
    for (i = Math.floor((dist - 40) / 96); i <= Math.floor((dist + BW + 40) / 96); i++) {
      var pk2 = hash(i * 12.7); x = Math.round(i * 96 + hash(i * 3.3) * 60 - dist);
      if (pk2 < 0.16) { px(x, GY - 9, 22, 9, "#2f6b3d"); px(x + 4, GY - 13, 14, 5, "#3c8049"); px(x + 3, GY - 7, 2, 2, "#e23b6b"); px(x + 12, GY - 10, 2, 2, "#e23b6b"); px(x + 17, GY - 5, 2, 2, "#e23b6b"); }
      else if (pk2 < 0.28) { px(x, GY - 6, 14, 6, "#8d98a6"); px(x + 2, GY - 9, 9, 3, "#a9b4c0"); px(x + 9, GY - 4, 5, 4, "#6b7686"); }
      else if (pk2 < 0.38) { px(x + 2, GY - 5, 2, 5, "#efe2b8"); px(x, GY - 8, 6, 3, "#d94a4a"); px(x + 1, GY - 8, 1, 1, "#fff"); px(x + 4, GY - 7, 1, 1, "#fff"); px(x + 9, GY - 3, 2, 3, "#efe2b8"); px(x + 8, GY - 5, 4, 2, "#d94a4a"); }
      else if (pk2 < 0.46) { px(x, GY - 9, 14, 9, "#5c4530"); px(x + 1, GY - 10, 12, 2, "#a67c52"); px(x + 4, GY - 10, 5, 1, "#7a5a3a"); px(x - 2, GY - 2, 3, 2, "#4a3524"); }
    }
    /* the muddy path, with the footprints you are following */
    px(0, GY, BW, BH - GY, "#6b5237"); px(0, GY, BW, 2, "#7d6244"); px(0, GY + 26, BW, BH - GY - 26, "#59432c");
    for (x = -(dist % 5); x < BW; x += 5) { var m0 = Math.floor((x + dist) / 5); if (hash(m0 * 2.3) > 0.72) px(x, GY + 4 + (hash(m0) * 50 | 0), 3, 1, "#59432c"); }
    for (i = Math.floor(dist / 46) - 1; i < Math.floor((dist + BW) / 46) + 1; i++) { x = i * 46 - dist; px(x, GY + 8 + (i % 2) * 6, 5, 2, "#4a3722"); px(x + 5, GY + 8 + (i % 2) * 6, 1, 1, "#4a3722"); }
  }
  function drawFore(dist) {
    var fo = dist * 1.35, i, x;
    for (i = Math.floor(fo / 140) - 1; i < Math.floor((fo + BW) / 140) + 1; i++) {
      if (hash(i * 5.3) < 0.45) continue;
      x = i * 140 + hash(i) * 60 - fo; px(x, 338, 26, 22, "#245a34"); px(x + 6, 330, 6, 10, "#2f6b3d"); px(x + 16, 334, 5, 6, "#2f6b3d"); px(x - 6, 346, 8, 14, "#2f6b3d");
    }
  }
  /* the tower, seen from outside: a tall, bent witch's-hat spire joined to a low watermill shack (an "L"),
     a wheel turning at its foot. Each lit window or door is a station — the wizard walks over and steps inside. */
  var HOX = 170, GND = 300;
  var SPL = 254, SPR = 330, SAX = 292;                   /* spire body left / right, roof apex x */
  var MML = 20, MMR = 254, MRDG = 196;                   /* mill shack left / right, sagging roof ridge */
  var WHX = 26, WHY = 256, WHR = 34;                     /* waterwheel centre + radius */
  var WL = SPL, WR = SPR, APEX = SAX;                    /* kept names for drawWreck: spire walls + apex */
  var SPOT = { crate: 382, read: 352, dig: 420, prep: 312, equip: 312, armoire: 184, condenser: 102 };
  var DOOR = { prep: 290, equip: 290, armoire: 150, condenser: 70 };   /* where the wizard steps in */
  function hubHotspots(stage) {                           /* clickable station zones, in the hub's drawing coords */
    var h = [{ key: "prep", name: "Prep Time", x: SPL + 8, y: 138, w: 30, h: 42, lx: SPL + 23 },
             { key: "equip", name: "Equipment", x: SPL + 8, y: 196, w: 30, h: 42, lx: SPL + 23 }];
    if (stage >= 1) { h.push({ key: "armoire", name: "Wardrobe", x: 132, y: 256, w: 36, h: 44, lx: 150 });
      h.push({ key: "condenser", name: "Condenser", x: 52, y: 222, w: 36, h: 40, lx: 70 }); }
    return h;
  }
  function wreckOf() {                                    /* 0 = whole, 1 = clearly wrecked. Mends as you level, snaps whole on the forest clear */
    if (S.cleared[1]) return 0;
    return clamp(1 - (S.lvl - 1) * 0.06, 0.45, 1);
  }
  function drawHub(t, stage) {
    var i, x, y, L3 = !!S.cleared[3], c1 = stage >= 1, wreck = wreckOf();
    function stone(l, r, top, bot, base) {               /* a block of stonework with a shaded + a lit edge */
      px(l, top, r - l, bot - top, base || "#44414f");
      var n = Math.floor((r - l) * (bot - top) / 150);
      for (var s = 0; s < n; s++) { var bx = l + 4 + hash(s * 3 + l) * (r - l - 16), by = top + 4 + hash(s * 7 + top) * (bot - top - 10); px(bx, by, 11, 5, "#504c5e"); px(bx, by + 5, 11, 1, "#312e3a"); }
      px(l, top, 5, bot - top, "#312d39"); px(r - 5, top, 5, bot - top, "#56526a");
    }
    /* ---- dusk sky ---- */
    var sky = ["#241a34", "#2b2140", "#352a4e", "#40345c", "#4d4068", "#5e4f6e", "#7a5f6e", "#a0705f", "#c08a5f"];
    for (i = 0; i < sky.length; i++) px(-HOX, i * 20, BW + HOX, 20, sky[i]);
    for (i = 0; i < 26; i++) { var stx = -HOX + hash(i * 9) * (BW + HOX), sty = hash(i * 5) * 128; px(stx, sty, hash(i * 5) < 0.5 ? 2 : 1, 1, "rgba(255,247,220,.7)"); }
    /* a low moon, off to the right */
    px(430, 28, 34, 34, "#efe3bf"); px(434, 25, 27, 27, "#fff6de"); px(448, 40, 7, 7, "#e6dab6"); px(455, 50, 4, 4, "#e6dab6");
    /* far treeline behind the tower */
    for (x = -HOX - 4; x < BW; x += 9) { var hh = 20 + hash(x * 1.3 + 40) * 20; px(x, 150 - (hh >> 1), 9, hh + 46, "#1c3326"); }
    /* ground: dirt yard, with a grassy fringe */
    px(-HOX, GND, BW + HOX, BH - GND, "#3a2d1f"); px(-HOX, GND, BW + HOX, 3, "#4a3a28"); px(-HOX, GND + 7, BW + HOX, 1, "#2a2016");
    for (x = -HOX; x < BW; x += 6) if (hash(x + 700) > 0.5) px(x, GND - (hash(x + 1) * 3 | 0), 6, 5, "#2d5433");
    /* the millrace / stream running under the wheel */
    px(MML - 40, 290, 130, 12, "#2f4a5e"); px(MML - 40, 290, 130, 2, "#4a6f84");
    for (i = 0; i < 8; i++) px(MML - 40 + hash(i) * 128, 293 + hash(i * 3) * 5, 8, 1, "#6b9ab0");

    /* ================= the watermill shack (left foot of the L) ================= */
    stone(MML + 30, MMR, 232, GND, "#403d4b");                            /* stone base */
    px(MML + 30, 232, MMR - (MML + 30), 6, "#8a6a44");                    /* sill beam */
    for (x = MML + 36; x < MMR - 4; x += 15) { px(x, 238, 12, GND - 238, "#5c4530"); px(x, 238, 12, 2, "#6b4a2e"); px(x + 12, 238, 2, GND - 238, "#3a2a1a"); }  /* plank gable */
    for (i = 0; i < 20; i++) { var rx = MML + 26 + i * ((MMR - MML) / 20), sag = Math.round(Math.sin(i * 0.5) * 3) + Math.round(i * 0.5); px(rx, MRDG - 4 + sag, ((MMR - MML) / 20) + 3, 11, i % 2 ? "#6b4a2e" : "#5c4530"); }  /* sagging roof */
    px(MML + 24, MRDG - 6, MMR - MML + 4, 5, "#8a6a44");                  /* ridge beam */
    /* chimney with a wisp of smoke */
    px(MMR - 72, MRDG - 34, 18, 32, "#3a3444"); px(MMR - 72, MRDG - 34, 18, 5, "#4a4458");
    px(MMR - 67, MRDG - 48, 7, 7, "rgba(210,210,220,.45)"); px(MMR - 63, MRDG - 62, 8, 8, "rgba(210,210,220,.3)");
    /* the Condenser window (lit once the forest's cleared; a dim boarded hole before) */
    (function () { var wx = 54, wy = 224, lit = c1;
      px(wx - 3, wy - 3, 36, 40, "#1a1422"); px(wx, wy, 30, 34, lit ? (Math.sin(t * 3) > -0.4 ? "#ffd36b" : "#e0b457") : "#2a2236");
      if (lit) { px(wx, wy, 30, 3, "#ffe9a8"); px(wx + 13, wy, 3, 34, "#caa35a"); px(wx + 6, wy + 8, 6, 10, "#3a2a1a"); px(wx + 18, wy + 8, 6, 14, "#3a2a1a"); }
      else { px(wx + 2, wy + 6, 26, 5, "#5c4530"); px(wx + 2, wy + 18, 26, 5, "#4a3826"); }
      px(wx - 5, wy - 9, 40, 7, "#34303e"); })();
    /* the Wardrobe door (a hanging sign lights up once your hat is won back) */
    (function () { var dx = 132; px(dx, 258, 36, GND - 258, "#2a2238"); px(dx + 4, 266, 28, GND - 266, "#1a1422"); px(dx, 256, 36, 4, "#3a3048"); px(dx + 24, 288, 4, 4, "#e8c15a");
      px(dx + 8, 250, 20, 8, c1 ? "#7b2f3e" : "#2e2838"); px(dx + 10, 252, 16, 4, c1 ? "#ffd36b" : "#4a4458"); })();

    /* ================= the spire (right arm of the L) ================= */
    stone(SPL, SPR, 118, GND);                                            /* main body */
    stone(SPL - 4, SPR - 8, 118, 212, "#423f4d");                         /* a narrower upper section, leaning a touch left */
    /* the pointed witch-hat roof, tall and bent */
    var eaveL = SPL - 30, eaveR = SPR + 18, eaveY = 118;
    for (y = eaveY; y > 26; y -= 4) { var fr = (eaveY - y) / (eaveY - 26), lx = Math.round(eaveL + (SAX - 8 - eaveL) * fr), rx2 = Math.round(eaveR - (eaveR - (SAX + 12)) * fr); px(lx, y - 4, rx2 - lx, 5, ((eaveY - y) >> 2) % 2 ? "#3a2560" : "#2e1c4c"); }
    px(eaveL - 5, eaveY, eaveR - eaveL + 10, 7, "#4a2f78"); px(eaveL - 5, eaveY + 5, eaveR - eaveL + 10, 3, "#281646");  /* eave */
    for (i = 0; i < 9; i++) px(eaveL - 1 + i * (eaveR - eaveL) / 8, eaveY + 7, 4, 4 + (i % 2) * 3, "#281646");           /* eave teeth */
    /* the belled, bent tip + gold finial */
    px(SAX - 6, 38, 14, 10, "#2e1c4c"); px(SAX - 1, 28, 11, 10, "#3a2560"); px(SAX + 7, 23, 7, 7, "#4a2f78"); px(SAX + 10, 19, 4, 5, "#f0c23a"); px(SAX + 10, 14, 2, 5, "#3a2560");
    /* a glowing arched window high in the roof — warm and bright once the chandelier's rehung (clear 3) */
    px(SAX - 9, 62, 18, 22, "#1a1226"); px(SAX - 6, 65, 12, 18, L3 ? "#ffe9a8" : (Math.sin(t * 2) > -0.6 ? "#ffd874" : "#d9a94a")); px(SAX - 1, 65, 2, 18, "#1a1226"); px(SAX - 6, 65, 12, 2, "#1a1226");
    if (L3) { px(SAX - 12, 60, 24, 3, "rgba(255,233,168,.25)"); }
    /* the two spire windows — the stations (always lit: the spire is your home) */
    (function () { var cols = [[SPL + 8, 138, "Prep"], [SPL + 8, 196, "Equip"]];
      cols.forEach(function (w, k) { var wx = w[0], wy = w[1], warm = Math.sin(t * 2.2 + k * 2) > -0.5;
        px(wx - 3, wy - 3, 30, 42, "#1a1226"); px(wx, wy, 24, 36, warm ? "#ffd36b" : "#d9a94a");
        px(wx, wy, 24, 3, "#ffe9a8"); px(wx + 10, wy, 3, 36, "#caa35a"); px(wx + 4, wy + 6, 6, 10, "#3a2a1a"); px(wx + 15, wy + 6, 6, 14, "#3a2a1a");
        px(wx - 5, wy - 10, 34, 8, "#2e1c4c"); }); })();
    /* the spire door at the base */
    px(SAX - 16, 250, 34, GND - 250, "#2a2238"); px(SAX - 16, 248, 34, 4, "#3a3048"); px(SAX - 12, 258, 26, GND - 258, "#1a1422"); px(SAX + 4, 282, 4, 4, "#e8c15a"); px(SAX - 2, 258, 2, GND - 258, "#0d0a14");

    /* ================= the waterwheel (toe of the L) ================= */
    b.save(); b.translate(WHX, WHY); var spin = t * 0.5;
    for (i = 0; i < 12; i++) { var pa = i / 12 * TAU + spin; px(Math.round(Math.cos(pa) * WHR) - 3, Math.round(Math.sin(pa) * WHR) - 3, 7, 7, "#4a3420"); }  /* paddles */
    b.strokeStyle = "#6b4a2e"; b.lineWidth = 4; b.beginPath(); b.arc(0, 0, WHR - 4, 0, TAU); b.stroke();
    b.strokeStyle = "#8a6a44"; b.lineWidth = 3; b.beginPath(); b.arc(0, 0, WHR - 13, 0, TAU); b.stroke();
    for (i = 0; i < 6; i++) { var sa = i / 6 * TAU + spin; b.strokeStyle = "#5c4530"; b.lineWidth = 3; b.beginPath(); b.moveTo(0, 0); b.lineTo(Math.cos(sa) * (WHR - 6), Math.sin(sa) * (WHR - 6)); b.stroke(); }
    px(-6, -6, 12, 12, "#8a6a44"); px(-3, -3, 6, 6, "#4a3420"); b.restore();

    /* ================= the yard, right of the spire: the wizard's loitering spots ================= */
    px(SPOT.crate - 11, 282, 24, 18, "#7a5a3a"); px(SPOT.crate - 11, 282, 24, 3, "#8f6d48"); px(SPOT.crate - 11, 299, 24, 1, "#5c4530"); px(SPOT.crate - 2, 282, 2, 18, "#5c4530");   /* a crate he sits on */
    px(SPOT.read - 8, 290, 16, 10, "#4a3524"); px(SPOT.read - 8, 288, 16, 3, "#5c4530"); px(SPOT.read + 4, 284, 6, 8, "#6b4a2e"); px(SPOT.read + 4, 284, 6, 2, "#7b2f3e");            /* a reading stump + book */
    px(SPOT.dig - 7, 295, 26, 5, "#2f2416"); px(SPOT.dig + 2, 292, 12, 4, "#4a3826"); px(SPOT.dig + 8, 294, 4, 2, "#efe2b8");                                                         /* a dig patch with a glint */

    if (wreck > 0) drawWreck(t, wreck);
  }
  /* storm damage over the spire, scaled by wreck (1 = ruined, easing to 0 as the wizard rebuilds) */
  function drawWreck(t, w) {
    var i;
    /* a jagged hole punched through the roof, sky showing through */
    if (w > 0.5) {
      px(APEX + 16, 88, 24, 16, "#352a4e"); px(APEX + 12, 94, 7, 9, "#352a4e"); px(APEX + 18, 82, 14, 6, "#40345c");
      px(APEX + 22, 92, 2, 2, "rgba(255,247,220,.7)"); px(APEX + 30, 98, 1, 1, "rgba(255,247,220,.6)");
      px(APEX + 14, 86, 4, 4, "#2e1c4c"); px(APEX + 36, 90, 4, 5, "#3a2560"); px(APEX + 20, 102, 5, 4, "#2e1c4c");
    }
    /* the belled tip snapped off */
    if (w > 0.7) {
      px(APEX + 6, 14, 10, 24, "#241a34"); px(APEX - 6, 38, 14, 10, "#241a34");
      px(APEX - 3, 40, 7, 8, "#2e1c4c"); px(APEX - 1, 36, 4, 6, "#3a2560"); px(APEX, 33, 2, 4, "#241633");
    }
    /* the roof window boarded over (dark, crossed planks) instead of glowing */
    if (w > 0.6) {
      px(APEX - 9, 62, 18, 22, "#15101c");
      px(APEX - 11, 66, 22, 4, "#5c4530"); px(APEX - 11, 74, 22, 4, "#4a3826"); px(APEX - 2, 58, 4, 24, "#5c4530");
      px(APEX - 11, 66, 22, 1, "#6b4a2e"); px(APEX - 11, 74, 22, 1, "#6b4a2e");
    }
    /* cracks running down the spire walls */
    if (w > 0.3) for (i = 0; i < 2; i++) { var wx = i ? WR - 6 : WL + 2, cy = 140 + i * 40, s; for (s = 0; s < 70; s += 4) { var jx = wx + Math.round(Math.sin(s * 0.8 + i * 2) * 2); px(jx, cy + s, 2, 4, "#1c1826"); px(jx + 2, cy + s + 1, 1, 3, "#120e18"); } }
    /* knocked-out stones along the spire edges */
    if (w > 0.4) { px(WR - 7, 170, 7, 10, "#241f2e"); px(WR - 7, 236, 7, 9, "#241f2e"); px(WL, 200, 7, 9, "#1c1826"); }
    /* rubble heaped at the spire's foot */
    var rb = Math.round(w * 6);
    for (i = 0; i < rb; i++) { var bx = i < rb / 2 ? WL - 6 + (i * 9) % 30 : WR - 24 + (i * 11) % 28, by = 296 + (i % 2) * 3, bw = 6 + (i % 3) * 3; px(bx, by, bw, 5, "#44414f"); px(bx, by, bw, 1, "#56526a"); px(bx + 1, by + 4, bw - 1, 1, "#312e3a"); }
    /* scaffolding leaning on the spire while repairs are underway (gone once ruined, gone once whole) */
    if (w > 0.25 && w < 0.9) {
      px(WL - 8, 150, 3, 150, "#6b4a2e"); px(WL + 2, 150, 3, 150, "#5c4530");
      for (i = 0; i < 4; i++) { var py = 172 + i * 34; px(WL - 8, py, 13, 3, "#7a5a3a"); px(WL - 8, py, 13, 1, "#8f6d48"); }
      for (var d = 0; d < 150; d += 5) px(WL - 8 + Math.round(d * 0.08), 150 + d, 2, 3, "#5c4530");
    }
  }
  function drawRain(t) { for (var i = 0; i < 70; i++) { var x = (hash(i) * BW + t * 40) % BW, y = (hash(i + 50) * BH + t * (340 + hash(i) * 120)) % BH; px(x, y, 1, 5, "rgba(190,215,240,.5)"); } }

  /* ---------------- a run ---------------- */
  var R = null, G = null;
  function wxw() { return R.dist + WX; }
  function prog() { return R.mode === "story" && !S.cleared[1] ? clamp(R.dist / R.bossAt, 0, 1) : 1; }
  function say(s, at, dur) { R.bub = R.bub.filter(function (q) { return (q.at || null) !== (at || null); }); R.bub.push({ s: s, at: at || null, t: dur || 2.2 }); }
  function chEv(ev, n) {
    for (var i = 0; i < S.ch.length; i++) {
      var c = S.ch[i], d = chDef(c.id); if (d.ev !== ev || c.done) continue;
      c.p += n;
      /* once per run: the three assigned stay put and mark done when met, no mid-run refill; the reward is scaled up to match */
      if (c.p >= d.need) { c.done = true; var cxp = Math.round(200 * tune("chalXp")); R.xp += cxp; R.rem += 50; G.toast("Challenge done: " + d.n + "  (+" + cxp + " XP, +50 Remnants)", "gold"); sfx("ch"); cnt("ch", 1); }
    }
  }
  function startRun(g, mode) {
    if (R && !R.over) bankRun();
    var st = calc();
    S.speed = 0.5;                                        /* every run starts at 100% pace; adjust live with the Run Slower/Faster keys */
    S.ch.forEach(function (c) { c.p = 0; c.done = false; });   /* the run's three challenges start fresh */
    R = { mode: mode, t: 0, dist: 0, y: GY, vy: 0, ground: true, plat: null, jumps: 0, dropT: 0, glide: false, hp: st.hp, maxhp: st.hp, inv: 0, st: st, look: lookOf(false),
      plats: [], rems: [], picks: [], haz: [], en: [], shots: [], eshots: [], fr: [], fx: [], bub: [], loot: [], lootCards: [], cds: {},
      nx: 420, rem: 0, orbs: 0, grim: 0, kills: 0, hurt: 0, xp: 0, buffT: 0, buffMax: 1, buff: null, ward: 0, thorn: 0, boss: null, bossN: 0, tough: 1, mAcc: 0,
      bossAt: (mode === "story" ? 300 : 390) * BASE, win: 0, over: false, revived: false, fiveT: 0, fiveWin: 0, shake: 0, mud: 0, chat: 5, tap: false, flashCd: 0, flashT: 0,
      nextOrb: rnd(40, 60) * BASE / tune("orbRate"), nextGrim: rnd(110, 170) * BASE / tune("grimRate"), nextRes: rnd(60, 100) * BASE, alcAt: mode === "story" && !S.cos.alcove1 ? rnd(110, 150) * BASE : 1e12,
      touchHit: {}, touchHeld: {}, touchZone: null };
    S.incEq.forEach(function (id) { R.cds[id] = { t: 0.8, ch: 3, r: 0 }; });
    UI.scene = "run"; cnt("runs", 1);
    g.start();
  }
  /* the run-pace control: a baseline band every player has (75%–115%), the top of which the Move-speed stat
     (ton) widens. S.speed is the 0..1 slider position; 0.5 is neutral 100%. */
  function pacePct(ton) { var s = S.speed == null ? 0.5 : clamp(S.speed, 0, 1); ton = ton || 0; return Math.round(s <= 0.5 ? 75 + 50 * s : 100 + (15 + ton) * (s - 0.5) * 2); }
  function paceMax(ton) { return 115 + (ton || 0); }
  function speedNow() { return BASE * tune("speed") * (pacePct(R.st.ton) / 100) * (R.buffT > 0 && R.buff === "gust" ? 1.25 : 1) * (R.mud > 0 ? 0.6 : 1); }

  /* --- spawning --- */
  function plat(x, h, w) { var p = { x: x, y: GY - h, w: w }; R.plats.push(p); return p; }
  function coins(x, y, n, gap, arc) { for (var i = 0; i < n; i++) R.rems.push({ x: x + i * gap, y: y - (arc ? Math.sin(i / Math.max(1, n - 1) * Math.PI) * arc : 0) }); }
  function enemy(k, x, y) {
    var base = { imp: [10, 14, 14], sprite: [5, 10, 10], toad: [10, 16, 12] }[k], e = { k: k, x: x, y: y, hp: base[0] * R.tough, w: base[1], h: base[2], t: Math.random() * 6, cd: 1.2, y0: y, ht: 0, burn: 0, fl: 0 };
    var p = prog();
    if (Math.random() < 0.004) { e.gold = true; e.hp *= 2; }
    else if (p > 0.2 && Math.random() < 0.06) { e.elite = true; e.hp *= 3; }
    e.max = e.hp; R.en.push(e); return e;
  }
  function chunk() {
    var x = R.nx, p = prog(), i, L = 300;
    if (R.boss || R.win || R.dist + BW > R.bossAt - 420) { if (Math.random() < 0.5) coins(x + 20, GY - 14, 4, 22); R.nx = x + 280; return; }
    if (x < 900) { coins(x + 40, GY - 14, 6, 22); R.nx = x + 300; return; }
    if (x > R.nextOrb) { R.nextOrb = x + rnd(50, 75) * BASE / tune("orbRate"); R.picks.push({ k: "orb", x: x + 120, y: GY - 44 }); coins(x + 30, GY - 14, 3, 22); R.nx = x + 260; return; }
    if (x > R.nextGrim) { R.nextGrim = x + rnd(120, 200) * BASE / tune("grimRate"); plat(x + 40, 36, 70); plat(x + 144, 62, 70); R.picks.push({ k: "grim", x: x + 180, y: GY - 62 - 12 }); coins(x + 52, GY - 50, 3, 22); R.nx = x + 300; return; }
    if (x > R.nextRes) { R.nextRes = x + rnd(80, 120) * BASE; plat(x + 40, 36, 70); plat(x + 144, 62, 80); R.picks.push({ k: "cage", x: x + 186, y: GY - 62 }); R.nx = x + 320; return; }
    if (x > R.alcAt) { R.alcAt = 1e12; plat(x + 40, 36, 70); plat(x + 144, 62, 70); plat(x + 248, 62, 90); R.picks.push({ k: "alcove", x: x + 300, y: GY - 62 }); coins(x + 156, GY - 76, 3, 22); R.nx = x + 420; return; }
    if (Math.random() < 0.0006) { R.picks.push({ k: "satchel", x: x + 140, y: GY - 10 }); R.nx = x + 240; return; }
    var r = Math.random();
    if (r < 0.16) { coins(x + 30, GY - 14, 6, 22); L = 240; }
    else if (r < 0.36) {
      var hz = Math.random();
      if (hz < 0.35) { R.haz.push({ k: "mud", x: x + 100, w: 70 }); coins(x + 96, GY - 30, 5, 20, 34); }
      else if (hz < 0.7) { R.haz.push({ k: "log", x: x + 260, vx: -60, t: 0 }); coins(x + 60, GY - 14, 4, 22); L = 340; }
      else { R.haz.push({ k: "branch", x: x + 160, y: 40, st: 0, vy: 0, t: 0 }); coins(x + 30, GY - 14, 4, 22); }
    } else if (r < 0.58) {
      var n = ri(2, 4), x0 = x + 40;
      for (i = 0; i < n; i++) { var h = i === 0 ? 36 : (i === 3 ? 96 : 62); plat(x0, h, 70); coins(x0 + 12, GY - h - 14, i === 3 ? 5 : 3, i === 3 ? 12 : 22); x0 += 104; }
      if (p > 0.25 && Math.random() < 0.5) enemy("imp", x + 200, GY);
      L = n * 104 + 90;
    } else if (r < 0.74) {
      var ni = 1 + (p > 0.3 ? 1 : 0) + (p > 0.7 && Math.random() < 0.5 ? 1 : 0);
      for (i = 0; i < ni; i++) enemy("imp", x + 80 + i * 46, GY);
      coins(x + 60, GY - 60, 4, 22);
    } else if (r < 0.84) {
      var sy0 = GY - ri(34, 78); for (i = 0; i < 3; i++) enemy("sprite", x + 90 + i * 38, sy0);
    } else if (r < 0.92) {
      if (Math.random() < 0.5) { plat(x + 110, 36, 70); enemy("toad", x + 146, GY - 36); } else enemy("toad", x + 150, GY);
      coins(x + 20, GY - 14, 3, 22); L = 320;
    } else { R.fr.push({ k: pick(["deer", "squirrel", "forager"]), x: x + 130, done: false }); L = 250; }
    R.nx = x + L;
  }

  /* --- combat --- */
  function fxAdd(k, x, y, o) { var f = { k: k, x: x, y: y, t: 0, d: 0.35 }; if (o) for (var q in o) f[q] = o[q]; R.fx.push(f); }
  function hurt(n) {
    if (R.inv > 0 || R.over || R.win) return;
    if (R.ward > 0) { R.ward = 0; R.inv = 0.6; sfx("ward"); fxAdd("ring", wxw(), R.y - 20, { c: "#9fe8ff" }); return; }
    R.hp -= n * (1 - R.st.con / 100); R.inv = 1.2; R.shake = 0.3; R.hurt++; sfx("hit"); cnt("hits", 1);
    if (R.hp <= 0.01) { R.hp = 0; die(); } else say(line("hit"));
  }
  function die() {
    var g = G; sfx("lose");
    if (!R.revived && S.grim + R.grim >= 10) {
      g.setState("over");
      MN(g, { kicker: "Down, not out", title: "Revive?", sub: "Spend 10 Grimoires to get back up with full HP. You have " + (S.grim + R.grim) + ".",
        items: [{ label: "Revive", sub: "10 Grimoires", cls: "is-primary", act: function () { var need = 10, a = Math.min(R.grim, need); R.grim -= a; S.grim -= need - a; R.revived = true; R.hp = R.maxhp; R.inv = 2.5; g.start(); } },
          { label: "End The Run", act: function () { endRun(false); } }] });
      return;
    }
    endRun(false);
  }
  function lootDrop(minR) { var it = makeItem(minR); R.loot.push(it); R.lootCards.push({ it: it, t: 0 }); if (R.lootCards.length > 4) R.lootCards.shift(); cnt("loot", 1); sfx(it.r >= 4 ? "lootBig" : "loot"); fxAdd("ring", wxw(), R.y - 20, { c: RAR[it.r].c }); }
  function damage(e, n, src) {
    if (e.dead) return;
    e.hp -= n; e.fl = 0.1; cnt("dmg", n); fxAdd("num", e.x, e.y - e.h - 4, { s: String(Math.max(1, Math.round(n))), d: 0.6 });
    if (e.hp > 0) return;
    e.dead = true; R.kills++; cnt("kills", 1); sfx("kill"); fxAdd("pop", e.x, e.y - e.h / 2, { d: 0.3 });
    if (src && S.inc[src]) { var m0 = mlvl(src); S.inc[src].k++; if (mlvl(src) > m0) G.toast(INC[src].n + " mastery " + mlvl(src), "gold"); }
    if (e.k === "boss") {
      R.xp += 200; R.rem += 60; R.boss = null; sfx("win"); R.eshots = [];
      if (R.mode === "story") { R.win = 2.4; lootDrop(1); lootDrop(1); }
      else { lootDrop(1); R.tough *= 1.15; R.bossN++; R.bossAt = R.dist + 390 * BASE; R.nx = R.dist + BW + 80; G.toast("The imps are getting tougher.", "info"); }
      return;
    }
    R.xp += 5 * (e.elite ? 3 : 1) * (e.gold ? 6 : 1); R.rem += e.gold ? 40 : 2; chEv("kill", 1); if (e.k === "imp") { chEv("imp", 1); cnt("imps", 1); }
    if (Math.random() < (e.gold ? 1 : e.elite ? 0.25 : 0.065)) lootDrop(e.gold ? 2 : 0);
  }
  function dmgOf(id) { return INC[id].dmg * (1 + R.st.pow / 100) * (1 + 0.08 * mlvl(id)); }
  function cdOf(id) { var c = INC[id].cd; if (id === "ward") c = mlvl(id) >= 6 ? 7 : mlvl(id) >= 3 ? 9 : 12; return c * tune("spellCd") / (1 + R.st.flu / 100); }
  function spellFrac(id) {                                 /* 0..1 charge of a spell, same as the rack wand */
    var c = R.cds[id] || { t: 0, ch: 0 };
    if (id === "snaps") return clamp(c.ch / (mlvl(id) >= 6 ? 4 : 3), 0, 1);
    if (id === "social") return 1;
    if (id === "ward") return R.ward > 0 ? 1 : 1 - clamp(c.t / cdOf(id), 0, 1);
    return 1 - clamp(c.t / cdOf(id), 0, 1);
  }
  function live() { return R.en.filter(function (e) { var sx = e.x - R.dist; return !e.dead && sx > -10 && sx < BW - 6; }); }
  function casting(g, dt) {
    var wx = wxw(), cy = R.y - 20, list = live();
    S.incEq.slice(0, incSlots()).forEach(function (id, slot) {
      var c = R.cds[id] || (R.cds[id] = { t: 0.5, ch: 3, r: 0 }), m = mlvl(id), act = "c" + (slot + 1), i;
      if (id === "poof") {
        c.t -= dt; if (c.t > 0) return;
        var tg = list.filter(function (e) { return e.x > wx - 60 && e.x < wx + BW - WX; }).sort(function (a, b2) { return Math.abs(a.x - wx) - Math.abs(b2.x - wx); }).slice(0, m >= 6 ? 2 : 1);
        if (!tg.length) { c.t = 0.12; return; }
        tg.forEach(function (e) { var rad = m >= 3 ? 28 : 18, ex = e.x, ey = e.y - e.h / 2; fxAdd("puff", ex, ey, { r: rad, d: 0.4 });
          list.forEach(function (o) { if (Math.abs(o.x - ex) < rad + o.w / 2 && Math.abs(o.y - o.h / 2 - ey) < rad + o.h / 2) damage(o, dmgOf(id), id); }); });
        sfx("poof"); c.t = cdOf(id);
      } else if (id === "snaps") {
        var mx = m >= 6 ? 4 : 3; if (c.ch < mx) { c.r -= dt; if (c.r <= 0) { c.ch++; c.r = cdOf(id); } }
        if (isHit(g, act) && c.ch > 0) { if (c.ch === mx) c.r = cdOf(id); c.ch--; R.shots.push({ x: wx + 8, y: R.y - 11, vx: 520 + speedNow(), dmg: dmgOf(id), pierce: m >= 3, src: id, hit: [] }); sfx("snap"); }
      } else if (id === "social") {
        var rad = m >= 4 ? 44 : 34;                    /* the thorns whip round fast enough that anything inside the ring gets bitten */
        list.forEach(function (e) { var ex = e.x - wx, ey = e.y - e.h / 2 - cy; if (e.ht <= 0 && Math.sqrt(ex * ex + ey * ey) < rad + e.w / 2) { e.ht = cdOf(id); damage(e, dmgOf(id), id); sfx("zap"); } });
      } else if (id === "rainy") {
        c.t -= dt; if (c.t > 0) return; c.t = cdOf(id);
        var cxw = wx + 130, hw = m >= 3 ? 90 : 70, any = false;
        list.forEach(function (e) { if (Math.abs(e.x - cxw) < hw + e.w / 2) { any = true; if (Math.random() < 0.3) fxAdd("bolt", e.x, e.y - e.h, { d: 0.12 }); damage(e, dmgOf(id), id); } });
        if (any && Math.random() < 0.3) sfx("zap");
      } else if (id === "sneeze") {
        c.t -= dt; if (c.t > 0) return;
        var ln = m >= 3 ? 180 : 140, hitAny = false;
        list.forEach(function (e) { if (e.x > wx && e.x < wx + ln + e.w / 2 && Math.abs(e.y - e.h / 2 - cy) < 28) { hitAny = true; e.burn = 3; damage(e, dmgOf(id), id); } });
        if (!hitAny) { c.t = 0.12; return; }
        fxAdd("cone", wx + 10, cy, { len: ln, d: 0.3 }); sfx("fire"); c.t = cdOf(id);
      } else if (id === "ward") {
        c.t -= dt; if (isHit(g, act) && c.t <= 0 && R.ward <= 0) { R.ward = 6; c.t = cdOf(id); sfx("ward"); }
      }
    });
    R.thorn += dt * 4.5; if (R.ward > 0) R.ward -= dt;
  }
  function lob(x, y, T) { var tx = wxw() + speedNow() * T, ty = R.y - 16, g2 = 520; R.eshots.push({ x: x, y: y, vx: (tx - x) / T, vy: (ty - y - 0.5 * g2 * T * T) / T, g: g2 }); }
  function bossUpdate(e, dt) {
    e.t += dt; var s = speedNow();
    if (e.st === "in") { e.sx -= 180 * dt; if (e.sx <= BW - 96) { e.sx = BW - 96; e.st = "lob"; e.t = 0; e.n = 0; } }
    else if (e.st === "lob") { if (e.t > 0.75) { e.t = 0; e.n++; lob(e.x - 10, e.y - 34, 1.15); sfx("poof"); if (e.n >= 3) { e.st = "rest"; e.t = 0; } } }
    else if (e.st === "rest") { if (e.t > 1.3) { e.st = "tell"; e.t = 0; } }
    else if (e.st === "tell") { if (e.t > 0.85) { e.st = "charge"; e.t = 0; sfx("boss"); } }
    else if (e.st === "charge") { e.sx -= 440 * dt; if (e.sx < -60) { e.sx = BW + 50; e.st = "in"; e.t = 0; } }
    e.x = R.dist + e.sx; void s;
  }

  function collect(pk) {
    var g = G;
    if (pk.k === "orb") {
      R.orbs++; cnt("orbs", 1); sfx("orb"); chEv("orb", 1);
      if (S.buffs.gust == null) { S.buffs.gust = 0; S.buffEq = ["gust"]; g.toast("New buff: Gust Step", "gold"); say(line("orb")); }
      var id = S.buffEq[0]; if (id) { R.buff = id; R.buffMax = 10 + R.st.ret + (S.buffs[id] || 0); R.buffT = R.buffMax; }
    } else if (pk.k === "grim") { R.grim++; cnt("grims", 1); sfx("grim"); if (Math.random() < 0.5) say(line("grim")); }
    else if (pk.k === "satchel") { sfx("grim"); say(line("satchel")); giveInc("ward", g); cnt("satchels", 1); }
    else if (pk.k === "alcove") { sfx("grim"); S.cos.alcove1 = true; giveInc("sneeze", g); g.toast("You found a lore alcove.", "gold"); }
    else if (pk.k === "cage") { sfx("win"); R.rem += 25; R.xp += 50; cnt("rescues", 1); chEv("rescue", 1); say(line("rescue")); fxAdd("ring", pk.x, pk.y - 8, { c: "#ffe58a" }); g.toast("Rescued a squirrel family  (+25 Remnants)", "gold"); }
  }

  function update(g, dt) {
    if (!R || R.over) return;
    dt = Math.min(dt, 0.05);
    var i, e, wx, sp = speedNow(), held = isDown(g, "jump") || (!touchUI && g.pointer.down), pressed = isHit(g, "jump") || R.tap; R.tap = false;
    R.t += dt; R.dist += sp * dt; wx = wxw();
    R.mAcc += sp * dt / M; if (R.mAcc >= 1) { var mm = Math.floor(R.mAcc); R.mAcc -= mm; cnt("m", mm); chEv("m", mm); }
    if (isHit(g, "slow")) { S.speed = clamp(S.speed - 0.1, 0, 1); g.toast("Pace " + pacePct(R.st.ton) + "%"); }
    if (isHit(g, "fast")) { S.speed = clamp(S.speed + 0.1, 0, 1); g.toast("Pace " + pacePct(R.st.ton) + "%"); }
    /* movement */
    var jv = Math.sqrt(2 * GRAV * R.st.jump) * Math.sqrt(tune("jump")) * (R.mud > 0 ? 0.85 : 1), gust = R.buffT > 0 && R.buff === "gust", maxJ = gust ? ((S.buffs.gust || 0) >= 3 ? 3 : 2) : 1;
    if (pressed) {
      if (R.ground) { R.vy = -jv; R.ground = false; R.plat = null; R.jumps = 1; sfx("jump"); cnt("jumps", 1); }
      else if (R.jumps < maxJ) { R.vy = -jv * 0.9; R.jumps++; sfx("jump2"); cnt("jumps", 1); fxAdd("ring", wx, R.y, { c: "#d9f0f2", d: 0.25 }); }
    }
    if (R.ground && R.plat && isHit(g, "drop")) { R.ground = false; R.plat = null; R.dropT = 0.22; R.y += 2; R.jumps = 1; }
    if (R.dropT > 0) R.dropT -= dt;
    R.glide = false;
    if (!R.ground) {
      var py = R.y;
      R.vy += GRAV * dt; if (R.vy < 0 && !held) R.vy += GRAV * 1.3 * dt;
      if (R.vy > 0 && held) { R.vy = Math.min(R.vy, R.st.glide); R.glide = true; cnt("glide", sp * dt / M); }
      R.y += R.vy * dt;
      if (R.vy >= 0 && R.dropT <= 0) for (i = 0; i < R.plats.length; i++) { var pl = R.plats[i]; if (wx >= pl.x - 4 && wx <= pl.x + pl.w + 4 && py <= pl.y + 1 && R.y >= pl.y) { R.y = pl.y; R.vy = 0; R.ground = true; R.plat = pl; R.jumps = 0; sfx("land"); chEv("plat", 1); cnt("plats", 1); break; } }
      if (R.y >= GY) { R.y = GY; R.vy = 0; if (!R.ground) sfx("land"); R.ground = true; R.plat = null; R.jumps = 0; }
    } else if (R.plat && (wx < R.plat.x - 4 || wx > R.plat.x + R.plat.w + 4)) { R.ground = false; R.plat = null; R.jumps = 1; }
    if (R.inv > 0) R.inv -= dt; if (R.shake > 0) R.shake -= dt; if (R.fiveT > 0) R.fiveT -= dt; if (R.buffT > 0) R.buffT -= dt;
    if (R.flashCd > 0) R.flashCd -= dt; if (R.flashT > 0) R.flashT -= dt;
    if (S.flashOn && isHit(g, "flash") && R.flashCd <= 0 && !R.over && !R.win) {   /* a dark-souls dodge: ~0.5s of i-frames you trigger on purpose */
      R.inv = Math.max(R.inv, FLASHDUR); R.flashT = FLASHDUR; R.flashCd = FLASHCD; sfx("flash"); fxAdd("flash", wx, R.y - 20, { d: FLASHDUR }); cnt("flash", 1);
    }
    if (isHit(g, "five")) { R.fiveWin = 0.45; R.fiveT = 0.35; } if (R.fiveWin > 0) R.fiveWin -= dt;
    /* spawn */
    while (R.nx < R.dist + BW + 140) chunk();
    if (!R.boss && !R.win && R.dist >= R.bossAt) {
      e = { k: "boss", x: 0, sx: BW + 50, y: GY, w: 34, h: 40, hp: 150 * R.tough, st: "in", t: 0, n: 0, ht: 0, burn: 0, fl: 0 }; e.max = e.hp; R.en.push(e); R.boss = e; sfx("boss"); say(line("boss"), null, 2.6);
    }
    /* the world */
    var top = R.y - 38, hx0 = wx - 5, hx1 = wx + 5;
    R.mud = 0;
    R.haz.forEach(function (h) {
      if (h.k === "mud") { if (R.ground && !R.plat && wx > h.x && wx < h.x + h.w) R.mud = 1; }
      else if (h.k === "log") { h.x += h.vx * dt; h.t += dt; if (Math.abs(h.x - wx) < 11 && R.y > GY - 13) hurt(10); }
      else if (h.k === "branch") {
        if (h.st === 0 && h.x - wx < sp * 1.12) h.st = 1;
        else if (h.st === 1) { h.vy += 880 * dt; h.y += h.vy * dt; if (h.y >= GY - 6) { h.y = GY - 6; h.st = 2; h.t = 0; sfx("land"); R.shake = 0.12; } if (Math.abs(h.x - wx) < 14 && top < h.y + 4 && R.y > h.y - 6) hurt(10); }
        else if (h.st === 2) { h.t += dt; if (Math.abs(h.x - wx) < 15 && R.y > GY - 8) hurt(10); }
      }
    });
    var mag = 16 * (1 + R.st.mag / 100);
    for (i = R.rems.length - 1; i >= 0; i--) { var c = R.rems[i], dx = c.x - wx, dy = c.y - (R.y - 20);
      if (dx * dx + dy * dy < mag * mag || (Math.abs(dx) < 9 && c.y > top - 4 && c.y < R.y + 4)) { R.rems.splice(i, 1); R.rem++; chEv("rem", 1); sfx("rem"); } }
    for (i = R.picks.length - 1; i >= 0; i--) { var pk = R.picks[i]; if (Math.abs(pk.x - wx) < 14 && pk.y > top - 8 && pk.y - 14 < R.y + 2) { R.picks.splice(i, 1); collect(pk); } }
    R.fr.forEach(function (f) {
      if (f.done || Math.abs(f.x - wx) > 26) return; f.done = true;
      if (R.fiveWin > 0) { R.fiveT = 0.4; R.rem += 3; cnt("fives", 1); chEv("five", 1); sfx("slap"); f.hi = 0.6; fxAdd("slap", f.x, GY - 20, { d: 0.4 }); say(line("five")); }
      else if (Math.random() < 0.45) { say(line("cheer"), f, 2); }
      else if (Math.random() < 0.12 && R.t - (R.sorryT || -99) > 60) { R.sorryT = R.t; cnt("sorry", 1); say(line("sorry")); f.reply = 0.9; f.rk = "reply"; }
      else { say(line("greet")); f.reply = 0.9; f.rk = "greetReply"; }
    });
    R.fr.forEach(function (f) { if (f.hi > 0) f.hi -= dt; if (f.reply > 0) { f.reply -= dt; if (f.reply <= 0) say(line(f.rk || "reply"), f, 2); } });
    /* enemies */
    R.en.forEach(function (e2) {
      if (e2.dead) return;
      e2.t += dt; if (e2.ht > 0) e2.ht -= dt; if (e2.fl > 0) e2.fl -= dt;
      if (e2.burn > 0) { e2.burn -= dt; e2.bt = (e2.bt || 0) + dt; if (e2.bt >= 0.5) { e2.bt = 0; damage(e2, 2 * (1 + R.st.pow / 100), "sneeze"); if (e2.dead) return; } }
      var sx = e2.x - R.dist;
      if (e2.k === "boss") bossUpdate(e2, dt);
      else if (e2.k === "imp") { if (sx < BW + 20) e2.x -= 40 * dt; }
      else if (e2.k === "sprite") { if (sx < BW + 20) { e2.x -= 70 * dt; e2.y = e2.y0 + Math.sin(e2.t * 4) * 14; } }
      else if (e2.k === "toad") { if (sx > 190 && sx < BW - 20) { e2.cd -= dt; if (e2.cd <= 0) { e2.cd = 2.3; e2.spit = 0.3; lob(e2.x - 4, e2.y - 12, 1.3); } } if (e2.spit > 0) e2.spit -= dt; }
      if (e2.x + e2.w / 2 > hx0 && e2.x - e2.w / 2 < hx1 && e2.y > top && e2.y - e2.h < R.y) hurt(10);
    });
    for (i = R.eshots.length - 1; i >= 0; i--) { var s = R.eshots[i]; s.vy += s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (Math.abs(s.x - wx) < 8 && s.y > top && s.y < R.y) { R.eshots.splice(i, 1); hurt(10); }
      else if (s.y > GY) { fxAdd("splat", s.x, GY, { d: 0.3 }); R.eshots.splice(i, 1); } }
    for (i = R.shots.length - 1; i >= 0; i--) { var sh = R.shots[i]; sh.x += sh.vx * dt; var gone = sh.x - R.dist > BW + 20;
      R.en.forEach(function (e3) { if (gone || e3.dead || sh.hit.indexOf(e3) >= 0) return; if (Math.abs(e3.x - sh.x) < e3.w / 2 + 6 && sh.y > e3.y - e3.h - 8 && sh.y < e3.y + 6) { sh.hit.push(e3); damage(e3, sh.dmg, sh.src); if (!sh.pierce) gone = true; } });
      if (gone) R.shots.splice(i, 1); }
    casting(g, dt);
    /* tidy up */
    var cut = R.dist - 90;
    R.en = R.en.filter(function (q) { return !q.dead && (q.k === "boss" || q.x > cut); });
    R.plats = R.plats.filter(function (q) { return q.x + q.w > cut; }); R.rems = R.rems.filter(function (q) { return q.x > cut; });
    R.picks = R.picks.filter(function (q) { return q.x > cut; }); R.fr = R.fr.filter(function (q) { return q.x > cut; });
    R.haz = R.haz.filter(function (q) { return q.x + (q.w || 0) > cut && !(q.k === "branch" && q.st === 2 && q.t > 4); });
    R.fx = R.fx.filter(function (q) { q.t += dt; return q.t < q.d; });
    if (R.lootCards.length) { R.lootCards[0].t += dt; if (R.lootCards[0].t >= LOOTCARD) R.lootCards.shift(); }
    R.bub = R.bub.filter(function (q) { q.t -= dt; return q.t > 0; });
    R.chat -= dt; if (R.chat <= 0 && !R.boss) { R.chat = rnd(16, 28); if (!R.bub.length) say(line(R.dist < R.bossAt * 0.5 || R.mode !== "story" ? (Math.random() < 0.5 ? "early" : "mid") : "late")); }
    if (R.win > 0) { R.win -= dt; if (Math.random() < 0.5) R.rems.push({ x: wx + rnd(60, 300), y: GY - rnd(10, 70) }); if (R.win <= 0) endRun(true); }
    R.touchHit = {};                                      /* one-shot touch presses are consumed each frame, like key hits */
  }

  function bankRun() {                                  /* whatever happens to a run, you keep what you picked up */
    var o = { m: Math.floor(R.dist / M), l0: S.lvl, sold: 0, kept: 0 }; o.xp = Math.round(R.xp + o.m / 10);
    R.over = true;
    S.rem += R.rem; S.orbs += R.orbs; S.grim += R.grim; cnt("rem", R.rem);
    R.loot.forEach(function (it) { if (S.bag.length < S.bagCap) { it.nw = 1; S.bag.push(it); o.kept++; } else { S.rem += sellPrice(it); o.sold++; } });
    var bk = R.mode === "story" ? "story1" : "endless1"; if (o.m > (S.best[bk] || 0)) S.best[bk] = o.m;
    addXP(o.xp, G); rollChals(); save(); return o;   /* reroll the three challenges for the next run */
  }
  function endRun(win) {
    if (win && R && !R.hurt) cnt("cleanwin", 1);           /* Untouchable: cleared a run without taking a single hit */
    var g = G, first = win && !S.cleared[1], o = bankRun(), m = o.m, xp = o.xp, l0 = o.l0, sold = o.sold, kept = o.kept, i;
    var extra = [];
    if (first) { S.cleared[1] = true; S.tower = 1; S.cos.hat = true; giveInc("snaps", null); extra.push("New Incantation: Spark Snaps", "Your favorite hat is back (wear it at the Armoire)", "Unlocked: Magickal Condenser, Wizard Drip Armoire, Endless mode"); }
    save(); g.setState("over"); if (!win) { /* the lose jingle already played */ }
    var kv = el("div", { class: "ak-kv" });
    function row(k, v) { kv.appendChild(el("span", { text: k })); kv.appendChild(el("b", { text: String(v) })); }
    row("Distance", fmt(m) + " m"); row("Enemies defeated", R.kills); row("Remnants", "+" + fmt(R.rem)); row("Whisper Orbs", "+" + R.orbs); row("Grimoires", "+" + R.grim);
    row("Wiz XP", "+" + fmt(xp) + (S.lvl > l0 ? "  (now Wiz Level " + S.lvl + ")" : "")); row("Loot", kept + " to the bag" + (sold ? ", " + sold + " sold (bag full)" : ""));
    for (i = 0; i < extra.length; i++) row(i === 0 ? "Rewards" : "", extra[i]);
    var res = el("div", {}, kv);
    if (R.loot.length) {
      res.appendChild(el("div", { class: "wz-loothead", text: R.loot.length > 1 ? "Loot Get!  ·  " + R.loot.length + " drops" : "Loot Get!" }));
      var lb = el("div", { class: "wz-lootgrid" });
      R.loot.forEach(function (it) {
        lb.appendChild(el("div", { class: "wz-lootcard is-r" + it.r },
          el("div", { class: "wz-lootcard__img" }, icoEl(itemIco(it))),
          el("div", { class: "wz-lootcard__meta" },
            el("b", { text: it.n }),
            el("span", { class: "wz-lootcard__slot", text: "NEW · " + slotName(it.s) }),
            el("span", { class: "wz-lootcard__lv", text: "Lv " + it.il + " · " + RAR[it.r].n }))));
      });
      res.appendChild(lb);
    }
    MN(g, { kicker: R.mode === "story" ? "Magickal Mad Dash · The Forest Around the Tower" : "Endless · The Forest Around the Tower",
      title: win ? "Forest Cleared" : "Flattened at " + fmt(m) + " m", sub: win ? txt("win1") : txt("lose"), body: res, cls: "is-wide",
      items: [
        first ? { label: "Continue", cls: "is-primary ak-pz ak-pz--go", act: function () { panels(g, WS.lines("clear1"), "After the forest", function () { g.toTitle(); }); } }
              : { label: "Run It Again", cls: "is-primary ak-pz ak-pz--warn", act: function () { startRun(g, R.mode); } },
        first ? null : { label: "Back To The Tower", cls: "ak-pz ak-pz--exit", act: function () { g.toTitle(); } }
      ] });
    /* keep a held key (the jump button at the moment of death) from instantly firing a button,
       so the player actually gets to see the death screen before Run It Again / Continue can trigger */
    lockMenu(g, 850);
  }
  function lockMenu(g, ms) {
    try {
      var btns = g.stage.querySelectorAll(".ak-menu .ak-btn"), j;
      for (j = 0; j < btns.length; j++) { btns[j].disabled = true; }
      var ae = document.activeElement; if (ae && ae.blur && g.stage.contains(ae)) try { ae.blur(); } catch (e) {}
      setTimeout(function () {
        try {
          var bs = g.stage.querySelectorAll(".ak-menu .ak-btn"), k;
          for (k = 0; k < bs.length; k++) { bs[k].disabled = false; }
          var sel = g.stage.querySelector(".ak-menu .ak-btn.is-sel") || bs[0];
          if (sel && g.menuOpen && g.menuOpen()) try { sel.focus({ preventScroll: true }); } catch (e) {}
        } catch (e) {}
      }, ms || 800);
    } catch (e) {}
  }

  /* ---------------- drawing a run ---------------- */
  /* outlines: anything drawn through outlined() gets a one pixel rim, red for enemies and light blue for friendlies */
  var OC = document.createElement("canvas"); OC.width = OC.height = 112; var oc = OC.getContext("2d");
  var SC = document.createElement("canvas"); SC.width = SC.height = 112; var sc = SC.getContext("2d");
  var HOSTILE = "#ff2a2a", FRIEND = "#8fdcff";
  function outlined(fn, ox, oy, col) {                   /* fn draws with px() around the point (56, 96) */
    var b0 = b; b = oc; oc.clearRect(0, 0, 112, 112); try { fn(56, 96); } finally { b = b0; }
    sc.globalCompositeOperation = "source-over"; sc.clearRect(0, 0, 112, 112); sc.drawImage(OC, 0, 0); sc.globalCompositeOperation = "source-in"; sc.fillStyle = col; sc.fillRect(0, 0, 112, 112);
    var X = ox - 56, Y = oy - 96;
    b.drawImage(SC, X - 1, Y); b.drawImage(SC, X + 1, Y); b.drawImage(SC, X, Y - 1); b.drawImage(SC, X, Y + 1); b.drawImage(SC, X - 1, Y - 1); b.drawImage(SC, X + 1, Y - 1); b.drawImage(SC, X - 1, Y + 1); b.drawImage(SC, X + 1, Y + 1);
    b.drawImage(OC, X, Y);
  }
  function drawEnemy(e, d, t) {
    var x = Math.round(e.x - d), y = Math.round(e.y);
    if (x < -50 || x > BW + 60) return;
    if (e.elite || e.gold) px(x - e.w / 2 - 3, y - e.h - 3, e.w + 6, e.h + 5, e.gold ? "rgba(255,215,90,.55)" : "rgba(255,120,90,.45)");
    outlined(function (ax, ay) { enemyBody(e, ax, ay, t); }, x, y, HOSTILE);
    if (e.burn > 0) { px(x - 3, y - e.h - 5 - (Math.sin(t * 20) > 0 ? 1 : 0), 3, 4, "#ff9a2e"); px(x + 1, y - e.h - 3, 2, 3, "#ffd76b"); }
    if (e.k !== "boss" && e.hp < e.max) { px(x - 9, y - e.h - 9, 18, 4, "#1a0f08"); px(x - 8, y - e.h - 8, Math.max(1, Math.round(16 * e.hp / e.max)), 2, "#ff5a5a"); }
  }
  function enemyBody(e, x, y, t) {
    var fl = e.fl > 0, c;
    if (e.k === "imp") {
      c = fl ? "#fff" : e.gold ? "#e0b020" : "#7a5536";
      px(x - 7, y - 12, 14, 10, c); px(x - 8, y - 15, 3, 4, c); px(x + 5, y - 15, 3, 4, c); px(x - 5, y - 9, 2, 2, "#ffe58a"); px(x, y - 9, 2, 2, "#ffe58a"); px(x - 4, y - 5, 6, 1, "#3a2414");
      var st = Math.sin(e.t * 12) > 0 ? 1 : 0; px(x - 5 + st, y - 2, 3, 2, c); px(x + 2 - st, y - 2, 3, 2, c);
    } else if (e.k === "sprite") {
      c = fl ? "#fff" : "#8a5a2b"; var fp = Math.sin(e.t * 20) > 0 ? 0 : 3;
      px(x - 9, y - 9 + fp, 5, 3, "#e8f6fa"); px(x + 4, y - 9 + fp, 5, 3, "#e8f6fa");
      px(x - 4, y - 10, 8, 4, c); px(x - 3, y - 6, 6, 3, c); px(x - 2, y - 3, 4, 2, c); px(x - 1, y - 1, 2, 1, c); px(x - 3, y - 8, 2, 1, "#5c3a18"); px(x + 1, y - 6, 2, 1, "#5c3a18"); px(x - 3, y - 9, 1, 1, "#ffe58a");
    } else if (e.k === "toad") {
      c = fl ? "#fff" : "#4c9a4a";
      px(x - 8, y - 10, 16, 10, c); px(x - 7, y - 13, 4, 4, c); px(x + 3, y - 13, 4, 4, c); px(x - 6, y - 12, 2, 2, "#1a1420"); px(x + 4, y - 12, 2, 2, "#1a1420");
      if (e.spit > 0) px(x - 6, y - 6, 10, 4, "#2a1a14"); else px(x - 6, y - 4, 12, 1, "#2f6b3d"); px(x - 9, y - 2, 4, 2, c); px(x + 5, y - 2, 4, 2, c);
    } else if (e.k === "boss") {
      c = fl ? "#fff" : "#7a5536"; var sh = e.st === "tell" ? (Math.sin(t * 60) > 0 ? 1 : -1) : 0; x += sh;
      px(x - 17, y - 34, 34, 30, c); px(x - 10, y - 22, 20, 16, fl ? "#fff" : "#94694a"); px(x - 21, y - 36, 6, 9, c); px(x + 15, y - 36, 6, 9, c);
      px(x - 11, y - 29, 5, 5, "#ffe58a"); px(x + 1, y - 29, 5, 5, "#ffe58a"); px(x - 10, y - 27, 2, 2, "#1a1420"); px(x + 2, y - 27, 2, 2, "#1a1420"); px(x - 8, y - 14, 14, 2, "#3a2414");
      var stp = Math.sin(e.t * 14) > 0 ? 2 : 0; px(x - 13 + stp, y - 4, 9, 4, c); px(x + 4 - stp, y - 4, 9, 4, c); px(x - 23, y - 22, 6, 12, c); px(x + 17, y - 22, 6, 12, c);
      px(x - 15, y - 38, 30, 4, "#5b3aa8"); for (var i = 0; i < 16; i++) px(x - 10 + i * 0.4, y - 39 - i, Math.max(2, 20 - i * 1.2), 1, "#6a45c2"); px(x - 10, y - 40, 20, 1, "#f0c23a"); px(x - 1, y - 47, 2, 2, "#f0c23a");
    }
  }
  function friendBody(f, x, GY) {
    var hi = f.hi > 0, bob = hi ? -2 : 0;                 /* a high-fived friendly hops and throws up a paw */
    if (f.k === "deer") { px(x - 11, GY - 22 + bob, 22, 10, "#a8763f"); px(x - 9, GY - 12, 3, 12, "#8a5f30"); px(x + 6, GY - 12, 3, 12, "#8a5f30"); px(x - 16, GY - 30 + bob, 8, 9, "#a8763f"); px(x - 15, GY - 35 + bob, 2, 6, "#e8d9b8"); px(x - 11, GY - 36 + bob, 2, 7, "#e8d9b8"); px(x - 15, GY - 27 + bob, 1, 1, "#1a1420"); px(x + 10, GY - 23 + bob, 3, 3, "#f4efe6"); if (hi) { px(x + 9, GY - 34, 3, 12, "#8a5f30"); px(x + 9, GY - 37, 4, 4, "#a8763f"); } }
    else if (f.k === "squirrel") { px(x - 4, GY - 9 + bob, 8, 8, "#a0562a"); px(x - 6, GY - 13 + bob, 6, 5, "#a0562a"); px(x + 3, GY - 15 + bob, 5, 12, "#c07a44"); px(x - 5, GY - 12 + bob, 1, 1, "#1a1420"); px(x - 4, GY - 1, 3, 1, "#7a3f1e"); if (hi) { px(x + 1, GY - 20, 3, 9, "#a0562a"); px(x + 1, GY - 23, 4, 4, "#a0562a"); } }
    else { px(x - 4, GY - 20 + bob, 8, 13, "#7b6aa8"); px(x - 3, GY - 7, 3, 7, "#4a3a2a"); px(x + 1, GY - 7, 3, 7, "#4a3a2a"); px(x - 3, GY - 27 + bob, 7, 7, "#eabf98"); px(x - 5, GY - 29 + bob, 11, 3, "#c9a26b"); if (hi) { px(x + 3, GY - 30, 3, 10, "#eabf98"); px(x + 3, GY - 33, 4, 4, "#eabf98"); } else px(x - 9, GY - 14, 6, 6, "#a67c52"); px(x - 2, GY - 25 + bob, 1, 1, "#1a1420"); }
  }
  function drawRun(g, ctx) {
    var d = R.dist, t = R.t, i, x, y, wx = WX;
    b.setTransform(1, 0, 0, 1, 0, 0); b.globalAlpha = 1;   /* a thrown-and-caught draw last frame can't leave the buffer skewed */
    b.save();
    try {
    if (R.shake > 0) b.translate(ri(-2, 2), ri(-1, 1));
    drawForest(d, t);
    R.haz.forEach(function (h) {
      x = Math.round(h.x - d);
      if (h.k === "mud") { px(x, GY, h.w, 5, "#3e2f1e"); px(x + 4, GY + 5, h.w - 8, 2, "#3e2f1e"); px(x + 10 + (Math.sin(t * 3) * 3 | 0), GY + 1, 3, 2, "#59432c"); px(x + h.w - 20, GY + 2, 2, 2, "#59432c"); }
      else if (h.k === "log") { var rot = Math.floor(h.t * 8) % 2; px(x - 8, GY - 16, 16, 16, "#7a5536"); px(x - 6, GY - 18, 12, 2, "#7a5536"); px(x - 6, GY, 12, 1, "#5c3f26"); px(x - 4 + rot * 2, GY - 12, 6, 6, "#a67c52"); px(x - 2 + rot * 2, GY - 10, 2, 2, "#7a5536"); }
      else { if (h.st < 2) { px(x - 11, GY + 1, 22, 2, "rgba(0,0,0,.28)"); px(x - 13, h.y - 4, 26, 6, "#5c4530"); px(x - 16, h.y - 8, 10, 6, "#2f6b3d"); px(x + 4, h.y - 9, 12, 7, "#3c8049"); if (h.st === 0 && Math.sin(t * 16) > 0) px(x - 2, h.y + 6, 2, 3, "#ffe58a"); }
        else { px(x - 14, GY - 8, 28, 8, "#5c4530"); px(x - 12, GY - 11, 9, 4, "#2f6b3d"); px(x + 6, GY - 10, 7, 3, "#3c8049"); } }
    });
    R.plats.forEach(function (p) { x = Math.round(p.x - d); px(x, p.y, p.w, 8, "#6b4a2e"); px(x, p.y, p.w, 3, "#5aa04a"); px(x + 2, p.y + 3, p.w - 4, 1, "#7d5a3a"); px(x + 4, p.y + 8, 5, 3, "#4a3524"); px(x + p.w - 9, p.y + 8, 5, 3, "#4a3524"); for (i = 0; i < p.w; i += 9) if (hash(p.x + i) > 0.5) px(x + i, p.y - 2, 3, 2, "#6bb85a"); });
    R.fr.forEach(function (f) { x = Math.round(f.x - d); if (x < -30 || x > BW + 30) return; outlined(function (ax, ay) { friendBody(f, ax, ay); }, x, GY, FRIEND); });
    R.picks.forEach(function (p) {
      x = Math.round(p.x - d); y = Math.round(p.y + (p.k === "orb" || p.k === "grim" ? Math.sin(t * 4 + p.x) * 3 : 0));
      if (p.k === "orb") { px(x - 6, y - 9, 12, 6, "rgba(160,240,255,.35)"); px(x - 3, y - 12, 6, 12, "rgba(160,240,255,.35)"); px(x - 4, y - 10, 8, 8, "#7fe3ff"); px(x - 2, y - 8, 4, 4, "#fff"); }
      else if (p.k === "grim") { px(x - 5, y - 13, 11, 13, "#5b3aa8"); px(x - 5, y - 13, 2, 13, "#3d2575"); px(x - 1, y - 9, 4, 4, "#f0c23a"); px(x - 3, y - 1, 9, 1, "#efe2b8"); }
      else if (p.k === "satchel") { px(x - 7, y - 9, 14, 9, "#8a5a2b"); px(x - 7, y - 9, 14, 4, "#6b4420"); px(x - 1, y - 6, 2, 2, "#f0c23a"); px(x - 4, y - 12, 8, 3, "#efe2b8"); }
      else if (p.k === "alcove") { px(x - 9, y - 26, 18, 26, "#4a3524"); px(x - 6, y - 22, 12, 22, Math.sin(t * 5) > 0 ? "#ffd76b" : "#ffe9a8"); px(x - 6, y - 24, 12, 2, "#2f6b3d"); px(x - 2, y - 14, 4, 6, "#5b3aa8"); }
      else if (p.k === "cage") { px(x - 9, y - 16, 18, 16, "#3a2a1a"); px(x - 7, y - 14, 14, 13, "#1c1410"); px(x - 3, y - 8, 6, 7, "#a0562a"); px(x - 2, y - 7, 1, 1, "#fff"); for (i = 0; i < 4; i++) px(x - 7 + i * 4, y - 14, 1, 13, "#8a6a44"); }
    });
    R.rems.forEach(function (c) { x = Math.round(c.x - d); y = Math.round(c.y + Math.sin(t * 5 + c.x * 0.05) * 2);
      px(x - 3, y - 4, 6, 8, "#3d418f"); px(x - 4, y - 3, 8, 6, "#3d418f");          /* periwinkle, with a dark rim so it reads against sky and leaves */
      px(x - 2, y - 3, 4, 6, "#9ea3ff"); px(x - 3, y - 2, 6, 4, "#9ea3ff"); px(x - 1, y - 1, 3, 3, "#7f85ee"); px(x - 2, y - 2, 2, 2, "#eef0ff"); });
    R.en.forEach(function (e) { if (!e.dead) drawEnemy(e, d, t); });
    R.eshots.forEach(function (s) { px(s.x - d - 4, s.y - 4, 8, 8, HOSTILE); px(s.x - d - 3, s.y - 5, 6, 10, HOSTILE); px(s.x - d - 3, s.y - 3, 6, 6, "#4a3722"); px(s.x - d - 2, s.y - 4, 4, 8, "#4a3722"); px(s.x - d - 2, s.y - 3, 2, 2, "#8a6a48"); });
    R.shots.forEach(function (s) { px(s.x - d - 6, s.y - 1, 10, 3, "#ffe58a"); px(s.x - d + 2, s.y - 2, 4, 5, "#fff"); });
    /* the wizard, and whatever is cast around them */
    var pose = R.fiveT > 0 ? "five" : R.ground ? "run" : R.glide ? "glide" : "jump";
    if (!(R.inv > 0 && Math.floor(t * 18) % 2)) { wizSprite(R.look, pose, t); blitWiz(b, wx, R.y, 1); }
    if (R.buffT > 0) for (i = 0; i < 3; i++) px(wx - 14 - i * 7 - (t * 60 % 7), R.y - 8 - i * 9, 6, 1, "rgba(220,245,255,.8)");
    if (R.ward > 0) for (i = 0; i < 18; i++) px(wx + Math.cos(i / 18 * TAU + t) * 24, R.y - 22 + Math.sin(i / 18 * TAU + t) * 27, 2, 2, "#9fe8ff");
    var eqd = S.incEq.slice(0, incSlots());
    if (eqd.indexOf("social") >= 0) for (i = 0; i < (mlvl("social") >= 4 ? 2 : 1); i++) { var srad = mlvl("social") >= 4 ? 44 : 34, an = R.thorn * 2.4 + i * Math.PI; x = wx + Math.cos(an) * srad; y = R.y - 20 + Math.sin(an) * srad; px(x - 3, y - 1, 6, 2, "#6bb85a"); px(x - 1, y - 3, 2, 6, "#6bb85a"); px(x - 1, y - 1, 2, 2, "#c8f0b8"); }
    if (eqd.indexOf("rainy") >= 0) { var chw = mlvl("rainy") >= 3 ? 90 : 70; x = wx + 130; y = GY - 128; px(x - chw, y, chw * 2, 10, "#6f7a8c"); px(x - chw + 14, y - 6, chw * 2 - 28, 6, "#6f7a8c"); px(x - chw + 6, y + 10, chw * 2 - 12, 2, "#555f70"); for (i = 0; i < chw / 4; i++) px(x - chw + 4 + i * 8, y + 14 + ((t * 120 + i * 37) % 100), 1, 5, "#9fd0ff"); }
    R.fx.forEach(function (f) {
      var q = f.t / f.d; x = f.x - d;
      if (f.k === "puff") { for (i = 0; i < 8; i++) { var a2 = i / 8 * TAU, rr = f.r * (0.3 + q * 0.8); px(x + Math.cos(a2) * rr - 3, f.y + Math.sin(a2) * rr - 3, 6 - (q * 4 | 0), 6 - (q * 4 | 0), i % 2 ? "#e9e2d2" : "#c9bfa8"); } px(x - 4, f.y - 4, 8, 8, "rgba(233,226,210," + (1 - q) + ")"); }
      else if (f.k === "ring") { var r2 = 6 + q * 22; for (i = 0; i < 12; i++) px(x + Math.cos(i / 12 * TAU) * r2, f.y + Math.sin(i / 12 * TAU) * r2, 2, 2, f.c || "#fff"); }
      else if (f.k === "pop") { for (i = 0; i < 6; i++) px(x + Math.cos(i) * q * 16, f.y + Math.sin(i * 2.1) * q * 14, 3, 3, i % 2 ? "#ffe58a" : "#fff"); }
      else if (f.k === "bolt") { for (i = 0; i < 8; i++) px(x + ((i % 2) ? 2 : -2), f.y - i * 9, 2, 9, "#fff7b0"); }
      else if (f.k === "cone") { for (i = 0; i < 14; i++) { var fx2 = x + (i / 14) * f.len * (0.4 + q * 0.6); px(fx2, f.y - 2 - i * 0.9 + (hash(i + t) * 6 | 0), 5, 4 + (i * 1.4 | 0), i % 3 ? "#ff9a2e" : "#ffd76b"); } }
      else if (f.k === "splat") { px(x - 6 - q * 4, f.y - 2, 12 + q * 8, 3, "#4a3722"); }
      else if (f.k === "slap") { for (i = 0; i < 7; i++) { var sa = i / 7 * TAU, sr = 4 + q * 16; px(x + Math.cos(sa) * sr - 1, f.y + Math.sin(sa) * sr - 1, 3, 3, i % 2 ? "#fff3c4" : "#ffd76b"); } if (q < 0.5) px(x - 5, f.y - 5, 10, 10, "rgba(255,247,196," + (1 - q * 2) + ")"); }
      else if (f.k === "flash") { var fr = 1 - q; for (i = 0; i < 16; i++) { var fa = i / 16 * TAU; px(x + Math.cos(fa) * (10 + q * 26) - 1, f.y + Math.sin(fa) * (12 + q * 26) - 1, 2, 2, "rgba(190,225,255," + fr.toFixed(2) + ")"); } px(x - 14, f.y - 24, 28, 44, "rgba(150,210,255," + (fr * 0.5).toFixed(2) + ")"); }
    });
    drawFore(d);
    } finally { b.restore(); b.setTransform(1, 0, 0, 1, 0, 0); b.globalAlpha = 1; }
    ctx.imageSmoothingEnabled = false; ctx.drawImage(BUF, 0, 0, W, H);
    hud(g, ctx);
  }
  function bubble(ctx, x, y, s) {
    ctx.font = "600 20px " + F.display; var w = Math.min(520, ctx.measureText(s).width + 28), bx = clamp(x - w / 2, 12, W - w - 12), by = y - 44;
    ctx.fillStyle = "rgba(0,0,0,.35)"; D.rr(ctx, bx + 3, by + 4, w, 38, 10); ctx.fill();
    ctx.fillStyle = "#fffdf5"; D.rr(ctx, bx, by, w, 38, 10); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 8, by + 37); ctx.lineTo(x, by + 50); ctx.lineTo(x + 8, by + 37); ctx.fill();
    ctx.fillStyle = "#1c1a22"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(s, bx + w / 2, by + 20, w - 16); ctx.textBaseline = "alphabetic";
  }
  function bar(ctx, x, y, w, h, f, col, back) { ctx.fillStyle = back || "rgba(0,0,0,.5)"; D.rr(ctx, x, y, w, h, h / 2); ctx.fill(); if (f > 0) { ctx.fillStyle = col; D.rr(ctx, x + 2, y + 2, Math.max(h - 4, (w - 4) * clamp(f, 0, 1)), h - 4, (h - 4) / 2); ctx.fill(); } }
  function bold(ctx, s, x, y, font, col, align) {        /* text with a dark rim, readable over any backdrop */
    ctx.font = font; ctx.textAlign = align || "left"; ctx.lineJoin = "round"; ctx.lineWidth = 4; ctx.strokeStyle = "rgba(16,9,5,.9)"; ctx.strokeText(s, x, y); ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.textAlign = "left";
  }
  function vial(ctx, x, y, len, h, f, t) {               /* HP: a long thin vial of red, corked at the far end */
    var r = h / 2, low = f < 0.34, i;
    ctx.fillStyle = "rgba(16,9,5,.55)"; D.rr(ctx, x - 4, y - 4, len + 30, h + 8, r + 4); ctx.fill();
    ctx.fillStyle = "rgba(190,225,255,.16)"; D.rr(ctx, x, y, len, h, r); ctx.fill();
    ctx.save(); D.rr(ctx, x + 2, y + 2, len - 4, h - 4, r - 2); ctx.clip();
    var w = (len - 4) * clamp(f, 0, 1);
    if (w > 0) {
      var gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, low && Math.sin(t * 10) > 0 ? "#ff9aa5" : "#ff6676"); gr.addColorStop(0.5, "#e02a44"); gr.addColorStop(1, "#a3142c");
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2 + w, y);
      for (i = 0; i <= 6; i++) ctx.lineTo(x + 2 + w + Math.sin(t * 5 + i * 1.1) * 3, y + (h * i) / 6);
      ctx.lineTo(x, y + h); ctx.fill();
      for (i = 0; i < 5; i++) { var bx = x + 8 + ((hash(i) * w + t * (10 + i * 5)) % Math.max(10, w - 10)); ctx.fillStyle = "rgba(255,255,255,.4)"; ctx.fillRect(bx, y + 5 + hash(i * 3) * (h - 12), 3, 3); }
    }
    ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(x + 8, y + 4, len - 20, 3);
    ctx.restore();
    ctx.strokeStyle = "#e6f4ff"; ctx.lineWidth = 2.5; D.rr(ctx, x, y, len, h, r); ctx.stroke();
    ctx.fillStyle = "#dff1ff"; ctx.fillRect(x + len - 3, y - 1, 6, h + 2);                                   /* the lip of the glass */
    ctx.fillStyle = "#b98450"; D.rr(ctx, x + len + 2, y - 3, 20, h + 6, 4); ctx.fill(); ctx.fillStyle = "#d9a66b"; ctx.fillRect(x + len + 4, y - 1, 16, 4);
    ctx.fillStyle = "#8a5f33"; ctx.fillRect(x + len + 7, y + 6, 3, 3); ctx.fillRect(x + len + 14, y + 11, 3, 3); ctx.fillRect(x + len + 9, y + h - 4, 3, 2);
  }
  function wand(ctx, x, y, len, f, col, t) {             /* a spell's charge runs up the wand from the grip to the tip */
    var ready = f >= 0.999, i;
    ctx.fillStyle = "#1a0f08"; ctx.beginPath(); ctx.moveTo(x - 2, y - 8); ctx.lineTo(x + len + 2, y - 4); ctx.lineTo(x + len + 2, y + 4); ctx.lineTo(x - 2, y + 8); ctx.fill();
    ctx.fillStyle = "#6b4a2a"; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + len, y - 2); ctx.lineTo(x + len, y + 2); ctx.lineTo(x, y + 6); ctx.fill();
    if (f > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(x + 40, y - 8, (len - 40) * clamp(f, 0, 1), 16); ctx.clip();
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + len, y - 2); ctx.lineTo(x + len, y + 2); ctx.lineTo(x, y + 6); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.fillRect(x + 40, y - 3, len, 2);
      ctx.restore();
    }
    ctx.fillStyle = "#3a2414"; D.rr(ctx, x - 2, y - 8, 42, 16, 5); ctx.fill(); ctx.fillStyle = "#54361f"; ctx.fillRect(x + 2, y - 6, 34, 4);
    ctx.fillStyle = "#e8c15a"; ctx.fillRect(x + 8, y - 8, 4, 16); ctx.fillRect(x + 30, y - 8, 4, 16); ctx.fillStyle = "#fff3c4"; ctx.fillRect(x + 8, y - 8, 4, 3); ctx.fillRect(x + 30, y - 8, 4, 3);
    var tx = x + len + 6, s = ready ? 9 + Math.sin(t * 8) * 2 : 5;
    if (ready) { ctx.fillStyle = "rgba(255,240,170,.35)"; ctx.beginPath(); ctx.arc(tx, y, 15 + Math.sin(t * 8) * 2, 0, TAU); ctx.fill(); }
    ctx.fillStyle = ready ? "#fff7b0" : "#8d98a6"; ctx.fillRect(tx - 2, y - s, 4, s * 2); ctx.fillRect(tx - s, y - 2, s * 2, 4); ctx.fillStyle = ready ? "#fff" : "#b9c2cd"; ctx.fillRect(tx - 3, y - 3, 6, 6);
    if (ready) for (i = 0; i < 3; i++) { var a = t * 3 + i * 2.1; ctx.fillStyle = "#ffe58a"; ctx.fillRect(tx + Math.cos(a) * 16 - 1, y + Math.sin(a) * 12 - 1, 3, 3); }
  }
  function chip(ctx, x, y, ico, s, col) {                /* a resource: icon and count on a plate */
    ctx.font = "800 20px " + F.mono; var w = 50 + ctx.measureText(s).width;
    plate(ctx, x, y, w, 38); icoAt(ctx, ico, x + 6, y + 3, 2); bold(ctx, s, x + 42, y + 26, "800 20px " + F.mono, col); return w + 8;
  }
  /* a round ability pip: name above, icon in the middle, a clock-style cooldown wipe, key/countdown below */
  function abilityPip(ctx, cx, cy, r, ico, name, sub, frac, ready) {
    frac = clamp(frac, 0, 1);
    bold(ctx, name, cx, cy - r - 9, "800 13px " + F.mono, ready ? "#bfe3ff" : "#9aa6b4", "center");
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = "rgba(14,10,8,.78)"; ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r - 3, -Math.PI / 2, -Math.PI / 2 + frac * TAU); ctx.closePath();
    ctx.fillStyle = ready ? "rgba(127,220,255,.32)" : "rgba(127,220,255,.26)"; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = ready ? "#7fdcff" : "rgba(127,180,220,.5)"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    if (ready) { ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255," + (0.22 + Math.sin(R.t * 8) * 0.14) + ")"; ctx.beginPath(); ctx.arc(cx, cy, r + 3 + Math.sin(R.t * 8) * 1.5, 0, TAU); ctx.stroke(); }
    icoAt(ctx, ico, cx - 8 * (r / 24 * 1.9), cy - 8 * (r / 24 * 1.9), r / 24 * 1.9);
    bold(ctx, sub, cx, cy + r + 16, "700 12px " + F.mono, ready ? "#e6f4ff" : "#8d98a6", "center");
  }
  function hud(g, ctx) {
    var i, m = Math.floor(R.dist / M), t = R.t;
    vial(ctx, 24, 20, 320, 24, R.hp / R.maxhp, t);
    bold(ctx, "HP " + Math.ceil(R.hp) + " / " + Math.ceil(R.maxhp), 38, 38, "800 16px " + F.mono, "#fff");
    var cx = 22; cx += chip(ctx, cx, 58, "rem", fmt(R.rem), "#c3c6ff"); cx += chip(ctx, cx, 58, "orb", String(R.orbs), "#c8f6ff"); chip(ctx, cx, 58, "grim", String(R.grim), "#d9c2ff");
    plate(ctx, 22, 102, 118, 26); bold(ctx, "Pace " + pacePct(R.st.ton) + "%", 32, 121, "700 15px " + F.mono, "#f3e6c4");
    if (R.boss) {
      plate(ctx, W / 2 - 236, 16, 500, 40); bar(ctx, W / 2 - 228, 22, 484, 28, R.boss.hp / R.boss.max, "#e02a44", "rgba(0,0,0,.6)"); icoAt(ctx, "skull", W / 2 - 222, 20, 2);
      bold(ctx, "GRAND MUD IMP", W / 2 + 14, 43, "800 18px " + SERIF, "#fff3c4", "center");
    } else if (R.mode === "story") {
      var px0 = W / 2 - 230, pw = 460, f = clamp(R.dist / R.bossAt, 0, 1), wxp = px0 + pw * f, bobY = Math.sin(t * 3) * 2, by = 80;
      plate(ctx, px0 - 10, by - 6, pw + 44, 22, 11);
      ctx.fillStyle = "#4a8f5a"; D.rr(ctx, px0, by, Math.max(10, pw * f), 10, 5); ctx.fill(); ctx.fillStyle = "#8fd89a"; ctx.fillRect(px0 + 4, by + 2, Math.max(2, pw * f - 8), 2);
      for (i = 1; i < 4; i++) { ctx.fillStyle = "rgba(232,193,90,.7)"; ctx.fillRect(px0 + pw * i / 4 - 1, by - 2, 2, 14); }
      icoAt(ctx, "skull", px0 + pw + 4, by - 11, 2);
      /* the little wizard on a cloud marks how far along you are */
      wizSprite(R.look, "sit", t); ctx.imageSmoothingEnabled = false; ctx.drawImage(WC, Math.round(wxp - 32), Math.round(by - 84 + bobY), 64, 88);
      var cl = [[-26, -6, 54, 15], [-16, -14, 36, 14], [-34, 0, 20, 11], [16, 0, 22, 11]];
      ctx.fillStyle = "rgba(16,9,5,.55)"; cl.forEach(function (c) { D.rr(ctx, wxp + c[0] - 2, by + c[1] + bobY - 2, c[2] + 4, c[3] + 5, 8); ctx.fill(); });
      ctx.fillStyle = "#ffffff"; cl.forEach(function (c) { D.rr(ctx, wxp + c[0], by + c[1] + bobY, c[2], c[3], 6); ctx.fill(); });
      ctx.fillStyle = "#d3e3ee"; D.rr(ctx, wxp - 22, by + 6 + bobY, 44, 4, 2); ctx.fill();
      gildBanner(ctx, W / 2, by + 22, "The Forest Around the Tower");
    } else { plate(ctx, W / 2 - 150, 18, 300, 36); icoAt(ctx, "skull", W / 2 - 142, 20, 2); bold(ctx, "Endless · boss in " + Math.max(0, Math.ceil((R.bossAt - R.dist) / speedNow())) + "s", W / 2 + 14, 43, "800 17px " + F.mono, "#fff3c4", "center"); }
    /* top right: distance, level and the challenges in play */
    ctx.font = "800 30px " + F.display; var dw = Math.max(150, ctx.measureText(fmt(m) + " m").width + 36);
    plate(ctx, W - 24 - dw, 16, dw, 46); bold(ctx, fmt(m) + " m", W - 40, 50, "800 30px " + F.display, "#fff", "right");
    plate(ctx, W - 24 - 132, 68, 132, 28); bold(ctx, "Wiz Lv " + S.lvl, W - 38, 88, "800 16px " + F.mono, "#ffe58a", "right");
    S.ch.forEach(function (c, j) {
      var d = chDef(c.id), y = 104 + j * 32, fr = clamp(c.p / d.need, 0, 1), done = fr >= 1;
      chalPlate(ctx, W - 24 - 360, y, 360, 28, fr, done ? "rgba(104,211,145,.3)" : "rgba(232,193,90,.32)");
      bold(ctx, d.n, W - 352, y + 20, "700 14px " + F.mono, "#f3e6c4"); bold(ctx, Math.min(d.need, Math.floor(c.p)) + " / " + d.need, W - 36, y + 20, "800 15px " + F.mono, done ? "#9ae6b4" : "#ffe58a", "right");
    });
    /* the spell rack: one wand per Incantation */
    var eqd = S.incEq.slice(0, incSlots());
    eqd.forEach(function (id, j) {
      var x = 150 + j * 262, y = H - 78, c = R.cds[id] || { t: 0, ch: 0 }, I = INC[id], f = 1, lab = I.n;
      if (id === "snaps") { f = c.ch / (mlvl(id) >= 6 ? 4 : 3); lab += "  " + "●".repeat(c.ch) + "○".repeat(Math.max(0, (mlvl(id) >= 6 ? 4 : 3) - c.ch)); }
      else if (id === "social") f = 1; else if (id === "ward") { f = R.ward > 0 ? 1 : 1 - clamp(c.t / cdOf(id), 0, 1); if (R.ward > 0) lab += "  UP"; } else f = 1 - clamp(c.t / cdOf(id), 0, 1);
      plate(ctx, x, y, 250, 62);
      bold(ctx, lab, x + 12, y + 22, "800 16px " + SERIF, "#fff3c4"); bold(ctx, I.key ? keyName(keysOf("c" + (j + 1))[0]) : "AUTO", x + 238, y + 22, "800 13px " + F.mono, I.key ? "#ffe58a" : "#9ae6b4", "right");
      wand(ctx, x + 14, y + 43, 200, f, RAR[I.r].c === "rb" ? "#ffd84a" : RAR[I.r].c, t + j);
    });
    if (R.buffT > 0 && R.buff) { plate(ctx, 150, H - 126, 250, 40); bar(ctx, 158, H - 104, 234, 12, R.buffT / R.buffMax, "#7fe3ff"); icoAt(ctx, "wing", 156, H - 126, 1.3); bold(ctx, BUFF[R.buff].n + "  " + R.buffT.toFixed(1) + "s", 182, H - 108, "800 14px " + F.mono, "#c8f6ff"); }
    /* equipped weapon badges, bottom-left: main over off, as rarity-bordered rounded squares */
    [S.eq.main, S.eq.off].forEach(function (it, i2) {
      if (!it) return;
      var bx0 = 20, bs = 56, by0 = H - 128 + i2 * 62, rc = RAR[it.r].c === "rb" ? "#ffd84a" : RAR[it.r].c;
      ctx.fillStyle = "rgba(14,10,8,.82)"; D.rr(ctx, bx0, by0, bs, bs, 12); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = rc; D.rr(ctx, bx0 + 2, by0 + 2, bs - 4, bs - 4, 10); ctx.stroke();
      icoAt(ctx, i2 === 0 ? mainIco(it) : offIco(it), bx0 + 8, by0 + 8, 2.5);
    });
    /* under the wizard: lead-spell attack charge, with the dodge cooldown directly beneath (no labels) */
    var lead = eqd[0];
    if (lead) {
      var la = clamp(spellFrac(lead), 0, 1), abw = 64, abx = WX * 2 - abw / 2, aby = H - 124;
      ctx.fillStyle = "rgba(0,0,0,.5)"; D.rr(ctx, abx, aby, abw, 9, 3); ctx.fill();
      ctx.fillStyle = la >= 0.999 ? "#ffe58a" : "#ffd84a"; D.rr(ctx, abx, aby, Math.max(3, abw * la), 9, 3); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.fillRect(abx + 2, aby + 1, Math.max(1, abw * la - 4), 2);
      if (S.flashOn) {
        var dready = R.flashCd <= 0, dff = dready ? 1 : 1 - clamp(R.flashCd / FLASHCD, 0, 1), dby = aby + 12;
        ctx.fillStyle = "rgba(0,0,0,.5)"; D.rr(ctx, abx, dby, abw, 7, 3); ctx.fill();
        ctx.fillStyle = dready ? "#9ff0c4" : "#7fdcff"; D.rr(ctx, abx, dby, Math.max(3, abw * dff), 7, 3); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.fillRect(abx + 2, dby + 1, Math.max(1, abw * dff - 4), 2);
      }
    }
    if (S.flashOn && !touchUI) {                          /* Illusion Flash: the round pip, bottom-right (desktop/gamepad) */
      var rdy = R.flashCd <= 0, ff = rdy ? 1 : 1 - clamp(R.flashCd / FLASHCD, 0, 1);
      abilityPip(ctx, W - 74, H - 78, 30, "flash", "Illusion Flash", rdy ? keyName(keysOf("flash")[0]) + " · dodge" : r1(R.flashCd) + "s", ff, rdy);
    }
    if (touchUI) drawTouchControls(ctx);                  /* on-screen jump / dodge / drop pads for phones + tablets */
    if (R.t < 9 && !(S.cnt.runs > 2)) {
      var hs = touchUI ? "Tap to jump, hold to glide   ·   DODGE / DROP, bottom-right   ·   tap an Incantation to cast"
        : keyName(keysOf("jump")[0]) + ": jump, hold to glide   ·   " + keyName(keysOf("drop")[0]) + ": drop down" + (S.flashOn ? "   ·   " + keyName(keysOf("flash")[0]) + ": dodge" : "") + "   ·   " + keyName(keysOf("five")[0]) + ": high five";
      ctx.font = "700 18px " + F.display; var hw = ctx.measureText(hs).width + 36; plate(ctx, W / 2 - hw / 2, H - 150, hw, 36); bold(ctx, hs, W / 2, H - 126, "700 18px " + F.display, "#fff", "center");
    }
    R.fx.forEach(function (f) { if (f.k === "num") bold(ctx, f.s, (f.x - R.dist) * 2, (f.y - f.t * 30) * 2, "800 19px " + F.mono, "#fff", "center"); });
    R.bub.forEach(function (q) { if (q.at) bubble(ctx, (q.at.x - R.dist) * 2, (GY - 44) * 2, q.s); else bubble(ctx, WX * 2 + 30, (R.y - 66) * 2, q.s); });
    if (R.lootCards.length) lootGetCard(ctx, R.lootCards[0]);
  }

  /* ---------------- the hub ---------------- */
  var Hb = { x: SPOT.crate + 4, tx: SPOT.crate + 4, act: "sit", t: 0, idleT: 6, then: null, busy: false, face: 1, moving: false };
  function hubIdle(g, dt) {
    Hb.t += dt;
    if (UI.scene === "rebind" && UI.bind && UI.bind.kind === "pad" && g.pad) { for (var k in g.pad.hit) if (k !== "start" && k !== "select") { captureBind(k); return; } }
    if (Hb.enter) {                                        /* stepping through a door into the chosen room */
      var e = Hb.enter; e.t += dt; Hb.face = e.face; Hb.act = "stand";
      var edx = e.x - Hb.x;
      if (Math.abs(edx) > 1) { Hb.x += (edx > 0 ? 1 : -1) * Math.min(Math.abs(edx), 150 * dt); Hb.moving = true; }
      else { Hb.moving = false; if (e.t >= e.dur) { Hb.enter = null; e.then(); } }
      return;
    }
    var dx = Hb.tx - Hb.x;
    if (Math.abs(dx) > 1) { Hb.x += (dx > 0 ? 1 : -1) * Math.min(Math.abs(dx), 170 * dt); Hb.face = dx > 0 ? 1 : -1; Hb.moving = true; return; }
    if (Hb.moving) { Hb.moving = false; Hb.face = 1; if (Hb.then) { var f = Hb.then; Hb.then = null; f(); return; } }
    if (!Hb.busy) { Hb.idleT -= dt; if (Hb.idleT <= 0) { Hb.idleT = rnd(7, 11); Hb.act = pick(["sit", "read", "dig"]); Hb.tx = { sit: SPOT.crate + 4, read: SPOT.read - 16, dig: SPOT.dig - 14 }[Hb.act]; } }
  }
  function goStation(g, key, fn) {
    Hb.busy = true; Hb.act = "stand"; Hb.tx = SPOT[key]; Hb.enter = null; g.closeMenu(); UI.scene = "hub";
    var doorX = DOOR[key];
    function enterRoom() {
      if (Site.reducedMotion || doorX == null) { fn(); return; }
      Hb.enter = { x: doorX, t: 0, dur: 0.6, then: fn, face: doorX < Hb.x ? -1 : 1 };
      g.wake && g.wake();
    }
    if (Site.reducedMotion || Math.abs(Hb.tx - Hb.x) <= 1) { Hb.x = Hb.tx; enterRoom(); return; }
    Hb.then = enterRoom; g.wake && g.wake();
  }
  /* a persistent HUD over the menus: Wiz level as an XP bar up top, the four currencies top-right, the bag bottom-right.
     Shown on every menu scene except the dressing chamber and the Settings pages. */
  function chipR(ctx, right, y, ico, s, col) {
    ctx.font = "800 20px " + F.mono; var w = 48 + ctx.measureText(s).width, x = right - w;
    plate(ctx, x, y, w, 38); icoAt(ctx, ico, x + 6, y + 3, 2); bold(ctx, s, x + 40, y + 26, "800 20px " + F.mono, col); return x;
  }
  function menuHud(ctx) {
    /* a Wiz-level XP bar, up top in the clear band to the right of the side panel */
    var ebw = 344, ex = (UI.scene === "equip" || UI.scene === "prep") ? Math.round((W - ebw) / 2) : 560, ey = 16, need = xpNeed(S.lvl), max = S.lvl >= 100, f = max ? 1 : clamp(S.xp / need, 0, 1);
    plate(ctx, ex - 10, ey, ebw + 20, 44, 10);
    bold(ctx, "WIZ LEVEL", ex + 6, ey + 18, "800 11px " + F.mono, "#e8c15a");
    bold(ctx, String(S.lvl), ex + 92, ey + 20, "800 18px " + SERIF, "#fff3c4", "left");
    bold(ctx, max ? "MAX" : fmt(S.xp) + " / " + fmt(need) + " XP", ex + ebw - 2, ey + 18, "700 12px " + F.mono, "#dccb9f", "right");
    var by = ey + 26, bw = ebw;
    ctx.fillStyle = "rgba(0,0,0,.55)"; D.rr(ctx, ex, by, bw, 11, 5); ctx.fill();
    ctx.fillStyle = "#e8c15a"; D.rr(ctx, ex, by, Math.max(7, bw * f), 11, 5); ctx.fill();
    ctx.fillStyle = "#fff3c4"; ctx.fillRect(ex + 3, by + 2, Math.max(2, bw * f - 6), 2);
    for (var i = 1; i < 4; i++) { ctx.fillStyle = "rgba(16,9,5,.5)"; ctx.fillRect(ex + bw * i / 4 - 1, by, 2, 11); }
    /* top right: the four currencies */
    var right = W - 24;
    right = chipR(ctx, right, 16, "syl", fmt(S.syl), "#e4caff") - 8;
    right = chipR(ctx, right, 16, "grim", fmt(S.grim), "#d9c2ff") - 8;
    right = chipR(ctx, right, 16, "orb", fmt(S.orbs), "#c8f6ff") - 8;
    chipR(ctx, right, 16, "rem", fmt(S.rem), "#c9ccff");
    /* bottom right: the bag */
    var full = S.bag.length >= S.bagCap, nw = S.bag.filter(function (q) { return q.nw; }).length;
    ctx.font = "800 20px " + F.mono; var bs = S.bag.length + " / " + S.bagCap, bgw = 50 + ctx.measureText(bs).width, bgx = W - 24 - bgw, bgy = H - 24 - 42;
    plate(ctx, bgx, bgy, bgw, 42); icoAt(ctx, "equip", bgx + 7, bgy + 6, 1.9);
    bold(ctx, bs, bgx + 42, bgy + 28, "800 20px " + F.mono, full ? "#ff9aa5" : "#f6ecd0");
    if (nw) { ctx.fillStyle = "#ffd84a"; D.rr(ctx, bgx - 6, bgy - 6, 14, 14, 4); ctx.fill(); bold(ctx, String(nw), bgx + 1, bgy + 5, "800 11px " + F.mono, "#2a1a0e", "center"); }
  }
  function drawHubScene(g, ctx) {
    var t = Hb.t, st = S.tower || 0;
    b.setTransform(1, 0, 0, 1, 0, 0); b.globalAlpha = 1;   /* a thrown-and-caught draw last frame can't leave the buffer skewed */
    b.save();
    try {
      b.translate(HOX, 0); drawHub(t, st);
      var pose = Hb.moving ? "run" : (Hb.busy ? (st === 1 ? "hold" : "stand") : Hb.act);
      wizSprite(lookOf(S.comfort), pose, t);
      var fade = Hb.enter ? clamp((Hb.enter.t - (Hb.enter.dur - 0.32)) / 0.32, 0, 1) : 0;   /* dim out as he steps inside */
      b.save(); if (fade > 0) b.globalAlpha = 1 - fade; b.translate(Math.round(Hb.x), 0); if (Hb.face < 0) b.scale(-1, 1); blitWiz(b, 0, 300, 1); b.restore();
      if (st === 1 && pose !== "hold") { var a = S.wiz, top = 300 - (14 + Math.round(4 * a.height)) - (16 + Math.round(4 * a.height)) - 22 + (pose === "sit" ? 5 + Math.round(4 * a.height) : pose === "dig" ? 8 : 0); px(Hb.x - 8 + (pose === "dig" ? 9 : 2), top, 16, 3, "#efe2b8"); px(Hb.x - 8 + (pose === "dig" ? 9 : 2), top + 3, 16, 1, "#c9b98a"); }
    } finally { b.restore(); b.setTransform(1, 0, 0, 1, 0, 0); b.globalAlpha = 1; }
    if (st < 2) drawRain(t);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(BUF, 0, 0, W, H);
    /* name tags over each station, so you can click the tower itself to open it; the picked one glows */
    if (UI.menu === "hub" && g.menuOpen()) {
      var selK = null; try { var pn = document.querySelector('.ak-stage[data-game="wizard-sprint"] .ak-panel'), sb = pn && pn.querySelector(".ak-btn.is-sel"); selK = sb && sb.dataset ? sb.dataset.wzSlot : null; } catch (e) {}
      hubHotspots(st).forEach(function (hs) {
        var lx = (hs.lx + HOX) * 2, ly = (hs.y - 8) * 2, on = hs.key === selK;
        ctx.font = "800 14px " + F.mono; var w = ctx.measureText(hs.name).width + 26, px0 = lx - w / 2, py0 = ly - 26;
        if (on) { ctx.strokeStyle = "rgba(255,224,138,.8)"; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.strokeRect((hs.x + HOX) * 2, hs.y * 2, hs.w * 2, hs.h * 2); ctx.setLineDash([]); }
        ctx.fillStyle = on ? "rgba(90,48,12,.96)" : "rgba(22,13,8,.82)"; D.rr(ctx, px0, py0, w, 24, 6); ctx.fill();
        ctx.strokeStyle = on ? "#ffe08a" : "rgba(232,193,90,.55)"; ctx.lineWidth = on ? 2 : 1.5; D.rr(ctx, px0 + 1, py0 + 1, w - 2, 22, 5); ctx.stroke();
        bold(ctx, hs.name, lx, py0 + 17, "800 14px " + F.mono, on ? "#fff3c4" : "#e8d5a8", "center");
        ctx.fillStyle = on ? "#ffe08a" : "rgba(232,193,90,.6)"; ctx.beginPath(); ctx.moveTo(lx - 5, py0 + 24); ctx.lineTo(lx + 5, py0 + 24); ctx.lineTo(lx, py0 + 30); ctx.fill();
      });
    }
  }
  function hubClick(g, gx, gy) {                          /* a click on the tower picks the station there */
    if (UI.menu !== "hub" || UI.scene !== "hub" || !g.menuOpen()) return;
    var tx = gx / 2 - HOX, ty = gy / 2, hit = null;
    hubHotspots(S.tower || 0).forEach(function (hs) { if (tx >= hs.x && tx <= hs.x + hs.w && ty >= hs.y && ty <= hs.y + hs.h) hit = hs; });
    if (!hit) return;
    var c1 = !!S.cleared[1];
    if ((hit.key === "condenser" || hit.key === "armoire") && !c1) { g.toast("Locked · clear the forest first"); return; }
    sfx("buy");
    if (hit.key === "prep") goStation(g, "prep", function () { prep(g, 0); });
    else if (hit.key === "equip") goStation(g, "equip", function () { equip(g, 0); });
    else if (hit.key === "condenser") goStation(g, "condenser", function () { condenser(g, 0); });
    else if (hit.key === "armoire") goStation(g, "armoire", function () { armoire(g, 0); });
  }
  function ell(ctx, x, y, rx, ry, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); }
  function drawCreator(g, ctx) {                        /* the dressing chamber: a gilt mirror, drapes and candles */
    var t = Hb.t, i, x, y, cx = 1055, my = 372;
    ctx.fillStyle = "#17151f"; ctx.fillRect(0, 0, W, H);
    for (y = 0; y < 580; y += 40) for (x = -((y / 40) % 2) * 44; x < W; x += 88) { ctx.fillStyle = hash(x * 0.13 + y * 0.7) > 0.5 ? "#262433" : "#201e2c"; ctx.fillRect(x + 2, y + 2, 84, 36); }
    var gl = ctx.createRadialGradient(cx, my, 60, cx, my, 520); gl.addColorStop(0, "rgba(255,214,130,.20)"); gl.addColorStop(1, "rgba(255,214,130,0)"); ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#3a2a1c"; ctx.fillRect(0, 580, W, 140); ctx.fillStyle = "#4d3926"; ctx.fillRect(0, 580, W, 6);
    for (x = 0; x < W; x += 128) { ctx.fillStyle = "#2c1f14"; ctx.fillRect(x + (hash(x) * 30 | 0), 586, 4, 134); }
    ell(ctx, cx, 664, 250, 40, "#4a1d2a"); ell(ctx, cx, 664, 226, 33, "#7a2f44"); ell(ctx, cx, 664, 196, 26, "#4a1d2a"); ell(ctx, cx, 664, 186, 23, "#8a3a50");
    /* drapes */
    [[cx - 262, 1], [cx + 262, -1]].forEach(function (d) {
      for (i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? "#4b2a78" : "#3a1f60"; ctx.fillRect(d[0] - 34 + i * 14 - (d[1] < 0 ? 2 : 0), 0, 14, 520 + Math.sin(i * 1.7) * 26); }
      ctx.fillStyle = "#e8c15a"; ctx.fillRect(d[0] - 38, 300, 76, 10); ctx.fillRect(d[0] - 6, 310, 12, 34); ell(ctx, d[0], 350, 9, 12, "#e8c15a");
    });
    ctx.fillStyle = "#2a1640"; ctx.fillRect(cx - 310, 0, 620, 26); for (x = cx - 300; x < cx + 300; x += 40) { ctx.fillStyle = "#4b2a78"; ctx.beginPath(); ctx.moveTo(x, 26); ctx.lineTo(x + 20, 54); ctx.lineTo(x + 40, 26); ctx.fill(); ell(ctx, x + 20, 58, 4, 4, "#e8c15a"); }
    /* the mirror */
    ctx.fillStyle = "#6b4a22"; ctx.fillRect(cx - 30, 600, 60, 46); ctx.fillRect(cx - 90, 640, 180, 12);
    ell(ctx, cx, my, 196, 276, "#8a6220"); ell(ctx, cx, my, 188, 268, "#e8c15a"); ell(ctx, cx, my, 176, 256, "#b98a2e");
    var mg = ctx.createLinearGradient(cx - 170, my - 250, cx + 170, my + 250); mg.addColorStop(0, "#3a4f86"); mg.addColorStop(0.5, "#22305a"); mg.addColorStop(1, "#141b38");
    ctx.fillStyle = mg; ctx.beginPath(); ctx.ellipse(cx, my, 168, 248, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.ellipse(cx, my, 168, 248, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,.07)"; ctx.beginPath(); ctx.moveTo(cx - 190, my - 40); ctx.lineTo(cx - 60, my - 260); ctx.lineTo(cx - 10, my - 260); ctx.lineTo(cx - 190, my + 60); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 40, my + 260); ctx.lineTo(cx + 190, my + 10); ctx.lineTo(cx + 190, my + 60); ctx.lineTo(cx + 80, my + 260); ctx.fill();
    ell(ctx, cx, 640, 150, 22, "rgba(0,0,0,.35)");
    wizSprite(lookOf(true, UI.nude), (t % 9) < 5 ? "stand" : (t % 9) < 7.5 ? "run" : "five", t);
    ctx.imageSmoothingEnabled = false; blitWiz(ctx, cx, 628, 5.4);
    ctx.restore();
    for (i = 0; i < 16; i++) { var an = i / 16 * TAU; x = cx + Math.cos(an) * 182; y = my + Math.sin(an) * 262; ctx.fillStyle = i % 4 === 0 ? "#ff5a6a" : i % 4 === 2 ? "#8f6bff" : "#fff3c4"; ctx.fillRect(Math.round(x) - 4, Math.round(y) - 4, 8, 8); ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.fillRect(Math.round(x) - 3, Math.round(y) - 3, 3, 3); }
    /* candles */
    [cx - 232, cx + 232].forEach(function (c, k) {
      ctx.fillStyle = "#6b4a22"; ctx.fillRect(c - 4, 470, 8, 140); ctx.fillRect(c - 22, 606, 44, 10); ctx.fillStyle = "#e8c15a"; ctx.fillRect(c - 16, 462, 32, 8);
      ctx.fillStyle = "#f4ecd8"; ctx.fillRect(c - 6, 424, 12, 38);
      var fl = Math.sin(t * 11 + k * 2) * 2; ell(ctx, c, 408 + fl * 0.4, 26, 30, "rgba(255,190,80,.16)"); ell(ctx, c + fl * 0.5, 410, 7, 13, "#ff9a2e"); ell(ctx, c + fl * 0.3, 414, 4, 8, "#ffe58a");
    });
    for (i = 0; i < 26; i++) { var sp = (t * (0.12 + hash(i) * 0.2) + hash(i * 3)) % 1; x = cx - 240 + hash(i * 7) * 480 + Math.sin(t + i) * 8; y = 640 - sp * 560; var sz = hash(i * 5) > 0.7 ? 6 : 4; ctx.fillStyle = "rgba(255,236,170," + (0.9 * Math.sin(sp * Math.PI)).toFixed(2) + ")"; ctx.fillRect(x, y, sz, 2); ctx.fillRect(x + sz / 2 - 1, y - sz / 2 + 1, 2, sz); }
    /* name plate */
    var nm = S.wiz.name || "Unnamed Wizard"; ctx.font = "700 30px " + SERIF; var nw = Math.max(260, Math.min(420, ctx.measureText(nm).width + 90));
    ctx.fillStyle = "#8a6a3a"; ctx.beginPath(); ctx.moveTo(cx - nw / 2 - 30, 72); ctx.lineTo(cx - nw / 2, 86); ctx.lineTo(cx - nw / 2, 130); ctx.lineTo(cx - nw / 2 - 30, 116); ctx.lineTo(cx - nw / 2 - 14, 94); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + nw / 2 + 30, 72); ctx.lineTo(cx + nw / 2, 86); ctx.lineTo(cx + nw / 2, 130); ctx.lineTo(cx + nw / 2 + 30, 116); ctx.lineTo(cx + nw / 2 + 14, 94); ctx.fill();
    ctx.fillStyle = "#efe0b4"; D.rr(ctx, cx - nw / 2, 64, nw, 58, 6); ctx.fill(); ctx.strokeStyle = "#8a6a3a"; ctx.lineWidth = 3; D.rr(ctx, cx - nw / 2 + 5, 69, nw - 10, 48, 4); ctx.stroke();
    ctx.fillStyle = "#2a1a0e"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "700 30px " + SERIF; ctx.fillText(nm, cx, 94, nw - 30); ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    plate(ctx, cx - 150, 132, 300, 30); D.text(ctx, "Age " + (UI.ageBad ? "???" : S.wiz.age) + "  ·  All-Knowing (formerly)", cx, 153, "700 15px " + F.mono, "#f3e6c4", "center");
  }
  /* ---------------- menu dressing: pixel icons, stat chips and NEW tags ---------------- */
  var SERIF = '"Palatino Linotype", Palatino, "Book Antiqua", "URW Palladio L", Georgia, serif';
  function plate(ctx, x, y, w, h, r) { ctx.fillStyle = "rgba(22,13,8,.78)"; D.rr(ctx, x, y, w, h, r == null ? 7 : r); ctx.fill(); ctx.strokeStyle = "rgba(232,193,90,.6)"; ctx.lineWidth = 2; D.rr(ctx, x + 1, y + 1, w - 2, h - 2, r == null ? 6 : r); ctx.stroke(); }
  function diamond(ctx, x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill(); }
  /* a gilded blue-and-gold banner for mission flavour: royal-blue fill, gold rule, a blue-cored gold diamond at each end */
  function gildBanner(ctx, cx, y, text) {
    ctx.font = "800 16px " + SERIF; var w = ctx.measureText(text).width + 76, x = cx - w / 2;
    ctx.fillStyle = "rgba(20,32,70,.9)"; D.rr(ctx, x, y, w, 30, 7); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "#e8c15a"; D.rr(ctx, x + 1, y + 1, w - 2, 28, 6); ctx.stroke();
    diamond(ctx, x + 17, y + 15, 5, "#e8c15a"); diamond(ctx, x + 17, y + 15, 2.4, "#1a2c5c");
    diamond(ctx, x + w - 17, y + 15, 5, "#e8c15a"); diamond(ctx, x + w - 17, y + 15, 2.4, "#1a2c5c");
    bold(ctx, text, cx, y + 21, "800 16px " + SERIF, "#fff3c4", "center");
  }
  /* a royal-blue, gold-ruled challenge plate with a blue-cored gold diamond, matched to the gilded card style */
  function chalPlate(ctx, x, y, w, h, fr, col) {
    ctx.fillStyle = "rgba(24,42,88,.82)"; D.rr(ctx, x, y, w, h, 6); ctx.fill();
    if (fr > 0) { ctx.save(); ctx.beginPath(); D.rr(ctx, x, y, w, h, 6); ctx.clip(); ctx.fillStyle = col || "rgba(232,193,90,.34)"; ctx.fillRect(x, y, w * fr, h); ctx.restore(); }
    ctx.lineWidth = 2; ctx.strokeStyle = "#e8c15a"; D.rr(ctx, x + 1, y + 1, w - 2, h - 2, 5); ctx.stroke();
    diamond(ctx, x + 11, y + h / 2, 4, "#e8c15a"); diamond(ctx, x + 11, y + h / 2, 2, "#1a2c5c");
  }
  /* the "Loot Get!" card that slides in from the left when a drop lands: brown panel, gold rule, rarity-tinted item box */
  function lootGetCard(ctx, c) {
    var it = c.it, rc = RAR[it.r].c === "rb" ? "#ffd84a" : RAR[it.r].c;
    var inA = clamp(c.t / 0.3, 0, 1), outA = clamp((LOOTCARD - c.t) / 0.3, 0, 1), app = Math.min(inA, outA), ease = app * app * (3 - 2 * app);
    var cw = 324, ch = 112, x = -cw + (24 + cw) * ease, y = 150;
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, app + 0.15));
    ctx.fillStyle = "rgba(40,22,11,.95)"; D.rr(ctx, x, y, cw, ch, 12); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = "#e8c15a"; D.rr(ctx, x + 1.5, y + 1.5, cw - 3, ch - 3, 11); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = "rgba(232,193,90,.3)"; D.rr(ctx, x + 6, y + 6, cw - 12, ch - 12, 8); ctx.stroke();
    bold(ctx, "LOOT  GET!", x + 18, y + 26, "800 17px " + SERIF, "#ffe58a", "left");
    var bx = x + 18, by = y + 36, bs = 60;
    ctx.fillStyle = "rgba(0,0,0,.4)"; D.rr(ctx, bx, by, bs, bs, 8); ctx.fill();
    ctx.save(); ctx.globalAlpha *= 0.2; ctx.fillStyle = rc; D.rr(ctx, bx + 3, by + 3, bs - 6, bs - 6, 6); ctx.fill(); ctx.restore();
    ctx.lineWidth = 2.5; ctx.strokeStyle = rc; D.rr(ctx, bx + 1.5, by + 1.5, bs - 3, bs - 3, 7); ctx.stroke();
    ctx.save(); ctx.imageSmoothingEnabled = false; var isc = (bs - 18) / 16; icoAt(ctx, itemIco(it), bx + 9, by + 9, isc); ctx.restore();
    var tx = bx + bs + 14;
    bold(ctx, it.n, tx, y + 52, "800 16px " + SERIF, "#fff6de", "left");
    bold(ctx, "NEW  ·  " + slotName(it.s), tx, y + 72, "800 12px " + F.mono, rc, "left");
    bold(ctx, "Lv " + it.il + "  ·  " + RAR[it.r].n, tx, y + 91, "700 12px " + F.mono, "#d8c7a0", "left");
    ctx.restore();
  }
  /* every icon is drawn on a 16 by 16 grid through r(x, y, w, h, colour), so the HUD and the menus share them */
  var ICO = {
    rem: function (r) { r(7, 1, 2, 1, "#3d418f"); r(5, 2, 6, 1, "#3d418f"); r(4, 3, 8, 2, "#3d418f"); r(3, 5, 10, 5, "#3d418f"); r(4, 10, 8, 2, "#3d418f"); r(5, 12, 6, 2, "#3d418f"); r(7, 14, 2, 1, "#3d418f");
      r(7, 2, 2, 1, "#c9ccff"); r(5, 3, 6, 2, "#a7abff"); r(4, 5, 8, 5, "#8f94f5"); r(5, 10, 6, 2, "#7479dc"); r(7, 12, 2, 2, "#5d62c4"); r(5, 4, 2, 4, "#e6e8ff"); r(6, 3, 2, 1, "#fff"); r(9, 6, 2, 4, "#7479dc"); r(8, 5, 1, 6, "#b9bdff"); },
    orb: function (r) { r(5, 2, 6, 1, "#1f6f8f"); r(3, 3, 10, 2, "#1f6f8f"); r(2, 5, 12, 6, "#1f6f8f"); r(3, 11, 10, 2, "#1f6f8f"); r(5, 13, 6, 1, "#1f6f8f");
      r(5, 3, 6, 1, "#9ff0ff"); r(4, 4, 8, 1, "#7fe3ff"); r(3, 5, 10, 6, "#58cdf0"); r(4, 11, 8, 1, "#3aa9d0"); r(5, 12, 6, 1, "#2f8fb5"); r(5, 5, 3, 2, "#fff"); r(4, 7, 1, 2, "#e6fbff");
      r(8, 7, 3, 1, "#d8f8ff"); r(10, 8, 1, 2, "#d8f8ff"); r(7, 9, 3, 1, "#d8f8ff"); r(6, 8, 1, 1, "#d8f8ff"); r(13, 2, 1, 1, "#fff"); r(1, 12, 1, 1, "#fff"); },
    grim: function (r) { r(2, 1, 12, 14, "#2a1650"); r(3, 2, 10, 12, "#6a45c2"); r(3, 2, 2, 12, "#3d2575"); r(5, 2, 8, 1, "#8f6bff"); r(12, 3, 1, 10, "#efe2b8"); r(4, 13, 9, 1, "#efe2b8");
      r(7, 5, 4, 4, "#f0c23a"); r(8, 6, 2, 2, "#fff3c4"); r(6, 10, 6, 1, "#f0c23a"); r(5, 3, 1, 1, "#f0c23a"); r(11, 3, 1, 1, "#f0c23a"); r(13, 7, 2, 2, "#c9972e"); },
    prep: function (r) { r(4, 2, 5, 8, "#8a5a2b"); r(4, 2, 5, 2, "#c9a26b"); r(3, 10, 10, 3, "#8a5a2b"); r(10, 9, 3, 2, "#8a5a2b"); r(3, 13, 11, 1, "#3a2414"); r(5, 5, 3, 1, "#e8c15a"); r(5, 7, 3, 1, "#e8c15a"); r(0, 6, 2, 1, "#fff"); r(1, 9, 2, 1, "#fff"); r(0, 12, 2, 1, "#fff"); },
    equip: function (r) { r(5, 1, 6, 2, "#c9a26b"); r(6, 3, 4, 2, "#6b4420"); r(3, 5, 10, 9, "#8a5a2b"); r(2, 7, 12, 6, "#8a5a2b"); r(3, 14, 10, 1, "#6b4420"); r(4, 6, 8, 1, "#e8c15a"); r(7, 9, 2, 3, "#e8c15a"); r(4, 8, 1, 4, "#a67c52"); },
    condenser: function (r) { r(6, 1, 4, 1, "#c9a26b"); r(7, 2, 2, 4, "#dff1ff"); r(5, 6, 6, 2, "#dff1ff"); r(3, 8, 10, 5, "#dff1ff"); r(4, 13, 8, 1, "#dff1ff"); r(4, 9, 8, 4, "#8f94f5"); r(5, 10, 2, 1, "#e6e8ff"); r(9, 11, 1, 1, "#e6e8ff"); r(7, 4, 2, 1, "#8f94f5"); },
    hat: function (r) { r(8, 1, 2, 2, "#6a45c2"); r(7, 3, 3, 2, "#6a45c2"); r(6, 5, 5, 3, "#6a45c2"); r(5, 8, 7, 3, "#6a45c2"); r(1, 11, 14, 2, "#5b3aa8"); r(5, 10, 7, 1, "#f0c23a"); r(8, 6, 2, 2, "#f0c23a"); r(2, 13, 12, 1, "#3d2575"); },
    lock: function (r) { r(5, 2, 6, 1, "#b9c2cd"); r(4, 3, 2, 4, "#b9c2cd"); r(10, 3, 2, 4, "#b9c2cd"); r(3, 7, 10, 7, "#8a6a3a"); r(3, 7, 10, 1, "#c9a26b"); r(7, 9, 2, 3, "#2a1a0e"); },
    gear: function (r) { r(6, 1, 4, 14, "#b9c2cd"); r(1, 6, 14, 4, "#b9c2cd"); r(3, 3, 10, 10, "#b9c2cd"); r(5, 5, 6, 6, "#6b7686"); r(7, 7, 2, 2, "#1c1a22"); },
    scroll: function (r) { r(2, 2, 12, 2, "#c9b98a"); r(3, 4, 10, 9, "#efe2b8"); r(2, 12, 12, 2, "#c9b98a"); r(5, 6, 6, 1, "#8a7a55"); r(5, 8, 6, 1, "#8a7a55"); r(5, 10, 4, 1, "#8a7a55"); r(1, 2, 1, 2, "#8a7a55"); r(14, 12, 1, 2, "#8a7a55"); },
    back: function (r) { r(2, 7, 12, 2, "#e8c15a"); r(4, 5, 2, 6, "#e8c15a"); r(6, 3, 2, 10, "#e8c15a"); r(3, 6, 1, 4, "#e8c15a"); },
    spark: function (r) { r(7, 1, 2, 14, "#ffe58a"); r(1, 7, 14, 2, "#ffe58a"); r(5, 5, 6, 6, "#fff7b0"); r(7, 7, 2, 2, "#fff"); r(3, 3, 2, 2, "#ffe58a"); r(11, 3, 2, 2, "#ffe58a"); r(3, 11, 2, 2, "#ffe58a"); r(11, 11, 2, 2, "#ffe58a"); },
    /* per-spell icons, by shape/attack/element: dust puff, straight bolt, thorn ring, storm cloud, fire cone, ward bubble */
    poof: function (r) { r(4, 7, 9, 4, "#b3a07d"); r(5, 6, 7, 6, "#b3a07d"); r(6, 5, 4, 1, "#b3a07d"); r(5, 6, 5, 2, "#d8c9a6"); r(6, 5, 3, 1, "#efe2c2"); r(7, 8, 2, 2, "#fff6de"); r(2, 4, 1, 1, "#fff"); r(13, 5, 1, 1, "#fff"); r(3, 12, 1, 1, "#fff6de"); r(12, 12, 1, 1, "#fff6de"); r(9, 2, 1, 1, "#fff"); },
    snaps: function (r) { r(10, 1, 3, 5, "#e0a825"); r(6, 5, 5, 3, "#e0a825"); r(8, 7, 4, 4, "#e0a825"); r(3, 10, 6, 3, "#e0a825"); r(5, 12, 3, 3, "#e0a825"); r(11, 1, 2, 5, "#fff7b0"); r(7, 6, 3, 2, "#ffe58a"); r(9, 8, 2, 3, "#ffe58a"); r(4, 11, 4, 2, "#ffe58a"); r(5, 12, 2, 2, "#fff7b0"); },
    social: function (r) { r(6, 2, 4, 1, "#3aa857"); r(6, 13, 4, 1, "#3aa857"); r(2, 6, 1, 4, "#3aa857"); r(13, 6, 1, 4, "#3aa857"); r(4, 4, 2, 2, "#3aa857"); r(10, 4, 2, 2, "#3aa857"); r(4, 10, 2, 2, "#3aa857"); r(10, 10, 2, 2, "#3aa857"); r(7, 0, 2, 2, "#6ee38a"); r(7, 14, 2, 2, "#6ee38a"); r(0, 7, 2, 2, "#6ee38a"); r(14, 7, 2, 2, "#6ee38a"); r(6, 6, 4, 4, "#4ed16a"); r(7, 7, 2, 2, "#d6ffe0"); },
    rainy: function (r) { r(4, 3, 8, 3, "#8b9cae"); r(3, 4, 10, 3, "#8b9cae"); r(5, 2, 5, 1, "#8b9cae"); r(4, 3, 6, 1, "#b4c2d2"); r(5, 2, 3, 1, "#cdd8e4"); r(8, 7, 2, 3, "#ffe58a"); r(6, 9, 3, 2, "#ffe58a"); r(7, 10, 2, 3, "#fff7b0"); r(4, 8, 1, 2, "#9fd0ee"); r(11, 8, 1, 2, "#9fd0ee"); r(4, 12, 1, 2, "#9fd0ee"); },
    sneeze: function (r) { r(3, 7, 2, 2, "#e0431f"); r(5, 5, 2, 6, "#e0431f"); r(7, 4, 2, 8, "#ff6a2e"); r(9, 3, 2, 10, "#ff6a2e"); r(11, 2, 2, 12, "#ff8a3e"); r(4, 7, 2, 2, "#ffd84a"); r(6, 6, 2, 4, "#ffd84a"); r(8, 5, 2, 6, "#ffe58a"); r(10, 5, 2, 6, "#fff7b0"); },
    ward: function (r) { r(6, 1, 4, 1, "#7fd0ee"); r(4, 2, 2, 1, "#7fd0ee"); r(10, 2, 2, 1, "#7fd0ee"); r(3, 3, 1, 2, "#7fd0ee"); r(12, 3, 1, 2, "#7fd0ee"); r(2, 5, 1, 6, "#7fd0ee"); r(13, 5, 1, 6, "#7fd0ee"); r(3, 11, 1, 2, "#7fd0ee"); r(12, 11, 1, 2, "#7fd0ee"); r(4, 13, 2, 1, "#7fd0ee"); r(10, 13, 2, 1, "#7fd0ee"); r(6, 14, 4, 1, "#7fd0ee"); r(4, 4, 8, 9, "rgba(150,220,245,.30)"); r(5, 3, 2, 2, "#fff"); r(5, 5, 1, 3, "#eaffff"); },
    wing: function (r) { r(2, 5, 12, 2, "#e6fbff"); r(3, 7, 10, 2, "#bfeeff"); r(5, 9, 7, 2, "#9fe0f8"); r(7, 11, 4, 2, "#7fd0ee"); r(1, 4, 3, 1, "#fff"); },
    coin: function (r) { r(5, 2, 6, 1, "#c9972e"); r(3, 3, 10, 10, "#f0c23a"); r(5, 13, 6, 1, "#c9972e"); r(2, 5, 1, 6, "#c9972e"); r(13, 5, 1, 6, "#c9972e"); r(7, 5, 2, 6, "#c9972e"); r(5, 5, 2, 1, "#fff3c4"); },
    quill: function (r) { r(10, 1, 4, 3, "#f4efe6"); r(8, 3, 5, 3, "#f4efe6"); r(6, 6, 5, 3, "#e0d8c8"); r(5, 9, 3, 2, "#c9bfa8"); r(3, 11, 3, 2, "#8a7a55"); r(2, 13, 2, 2, "#1c1a22"); },
    dice: function (r) { r(2, 2, 12, 12, "#f4efe6"); r(2, 13, 12, 1, "#c9bfa8"); r(4, 4, 2, 2, "#7a2230"); r(10, 4, 2, 2, "#7a2230"); r(7, 7, 2, 2, "#7a2230"); r(4, 10, 2, 2, "#7a2230"); r(10, 10, 2, 2, "#7a2230"); },
    hourglass: function (r) { r(3, 1, 10, 2, "#c9972e"); r(3, 13, 10, 2, "#c9972e"); r(4, 3, 8, 3, "#dff1ff"); r(6, 6, 4, 1, "#dff1ff"); r(7, 7, 2, 2, "#e8c15a"); r(6, 9, 4, 1, "#dff1ff"); r(4, 10, 8, 3, "#dff1ff"); r(5, 4, 6, 1, "#e8c15a"); r(5, 11, 6, 2, "#e8c15a"); },
    leaf: function (r) { r(7, 1, 2, 2, "#2f6b2c"); r(5, 3, 6, 2, "#4f9a3f"); r(3, 5, 10, 4, "#4f9a3f"); r(4, 9, 8, 2, "#4f9a3f"); r(6, 11, 4, 2, "#4f9a3f"); r(7, 3, 2, 12, "#2f6b2c"); r(5, 6, 2, 1, "#2f6b2c"); r(9, 7, 2, 1, "#2f6b2c"); },
    tree: function (r) { r(7, 9, 2, 6, "#5c4530"); r(4, 2, 8, 3, "#3c8049"); r(2, 5, 12, 4, "#2f6b3d"); r(4, 9, 8, 1, "#27593a"); r(5, 3, 2, 1, "#6bb85a"); },
    inf: function (r) { r(2, 6, 4, 1, "#f0c23a"); r(1, 7, 2, 2, "#f0c23a"); r(2, 9, 4, 1, "#f0c23a"); r(6, 7, 1, 2, "#f0c23a"); r(7, 8, 2, 1, "#f0c23a"); r(9, 7, 1, 2, "#f0c23a"); r(10, 6, 4, 1, "#f0c23a"); r(13, 7, 2, 2, "#f0c23a"); r(10, 9, 4, 1, "#f0c23a"); },
    sound: function (r) { r(2, 6, 3, 4, "#b9c2cd"); r(5, 4, 2, 8, "#b9c2cd"); r(7, 2, 2, 12, "#b9c2cd"); r(11, 5, 1, 6, "#e8c15a"); r(13, 3, 1, 10, "#e8c15a"); },
    keys: function (r) { r(1, 4, 14, 9, "#6b7686"); r(2, 5, 3, 3, "#eef0f3"); r(6, 5, 3, 3, "#eef0f3"); r(10, 5, 4, 3, "#eef0f3"); r(2, 9, 12, 3, "#eef0f3"); },
    pad: function (r) { r(2, 5, 12, 6, "#6b7686"); r(1, 7, 2, 6, "#6b7686"); r(13, 7, 2, 6, "#6b7686"); r(4, 7, 1, 3, "#eef0f3"); r(3, 8, 3, 1, "#eef0f3"); r(10, 7, 2, 2, "#ff5a6a"); r(12, 9, 1, 1, "#68d391"); },
    skull: function (r) { r(4, 2, 8, 2, "#f4efe6"); r(3, 4, 10, 5, "#f4efe6"); r(5, 9, 6, 3, "#f4efe6"); r(5, 5, 2, 3, "#1c1a22"); r(9, 5, 2, 3, "#1c1a22"); r(7, 8, 2, 1, "#1c1a22"); r(6, 11, 1, 2, "#1c1a22"); r(8, 11, 1, 2, "#1c1a22"); },
    /* gear slots */
    head: function (r) { ICO.hat(r); },
    chest: function (r) { r(1, 3, 4, 5, "#7b6aa8"); r(11, 3, 4, 5, "#7b6aa8"); r(4, 2, 8, 12, "#8f7cc4"); r(6, 2, 4, 2, "#2a1a0e"); r(7, 4, 2, 10, "#e8c15a"); },
    hands: function (r) { r(4, 6, 8, 8, "#a67c52"); r(4, 2, 2, 5, "#a67c52"); r(6, 1, 2, 6, "#a67c52"); r(8, 1, 2, 6, "#a67c52"); r(10, 2, 2, 5, "#a67c52"); r(1, 7, 3, 3, "#a67c52"); r(4, 12, 8, 2, "#6b4420"); },
    legs: function (r) { r(3, 1, 10, 4, "#6f7a8c"); r(3, 5, 4, 10, "#6f7a8c"); r(9, 5, 4, 10, "#6f7a8c"); r(3, 1, 10, 1, "#e8c15a"); },
    feet: function (r) { ICO.prep(r); },
    main: function (r) { r(11, 1, 3, 3, "#ffe58a"); r(12, 2, 1, 1, "#fff"); r(10, 4, 2, 2, "#7a5a3a"); r(8, 6, 2, 2, "#7a5a3a"); r(6, 8, 2, 2, "#7a5a3a"); r(4, 10, 2, 2, "#7a5a3a"); r(2, 12, 3, 3, "#5c4530"); },
    off: function (r) { ICO.grim(r); },
    waist: function (r) { r(1, 6, 14, 4, "#8a5a2b"); r(6, 5, 4, 6, "#e8c15a"); r(7, 7, 2, 2, "#2a1a0e"); },
    neck: function (r) { r(3, 1, 1, 6, "#e8c15a"); r(12, 1, 1, 6, "#e8c15a"); r(4, 7, 1, 2, "#e8c15a"); r(11, 7, 1, 2, "#e8c15a"); r(5, 9, 6, 5, "#e8c15a"); r(6, 10, 4, 3, "#ff5a6a"); r(7, 10, 1, 1, "#fff"); },
    shoulder: function (r) { r(2, 5, 12, 3, "#b9c2cd"); r(1, 8, 5, 4, "#8d98a6"); r(10, 8, 5, 4, "#8d98a6"); r(4, 4, 8, 1, "#eef0f3"); },
    back: null,
    sim: function (r) { r(6, 2, 4, 2, "#ffb0e0"); r(4, 4, 8, 6, "#ff7ac8"); r(6, 10, 4, 3, "#c94a98"); r(5, 5, 2, 2, "#fff"); r(1, 7, 1, 1, "#fff"); r(14, 4, 1, 1, "#fff"); }
  };
  ICO.cape = function (r) { r(5, 1, 6, 2, "#e8c15a"); r(3, 3, 10, 9, "#a8324a"); r(2, 12, 12, 2, "#7a2230"); r(5, 4, 1, 8, "#7a2230"); r(9, 4, 1, 8, "#7a2230"); };
  ICO.back = function (r) { r(2, 7, 12, 2, "#e8c15a"); r(4, 5, 2, 6, "#e8c15a"); r(6, 3, 2, 10, "#e8c15a"); r(3, 6, 1, 4, "#e8c15a"); };
  ICO.flash = function (r) { r(8, 1, 3, 6, "#bfe3ff"); r(5, 6, 4, 3, "#bfe3ff"); r(6, 7, 3, 7, "#7fd0ff"); r(9, 5, 2, 4, "#e6f6ff"); r(3, 8, 2, 2, "#e6f6ff"); r(12, 4, 2, 2, "#e6f6ff"); r(7, 8, 2, 3, "#fff"); };
  ICO.syl = function (r) { r(5, 1, 6, 2, "#6a45c2"); r(4, 3, 3, 10, "#8f6bff"); r(9, 3, 3, 6, "#6a45c2"); r(8, 9, 4, 5, "#8f6bff"); r(6, 6, 4, 2, "#c9b3ff"); r(5, 4, 1, 7, "#3d2575"); r(10, 10, 1, 3, "#3d2575"); r(2, 7, 2, 2, "#f0c23a"); r(13, 11, 2, 2, "#f0c23a"); };
  /* per-type weapon icons (main hand: Stick / Wand / Staff / Ladle · off hand: Tome / Orb / Lantern) */
  ICO.w_stick = function (r) { r(2, 12, 3, 3, "#5c4530"); r(5, 10, 2, 2, "#6b4a2a"); r(7, 8, 2, 2, "#7a5a3a"); r(9, 6, 2, 2, "#7a5a3a"); r(11, 4, 2, 2, "#8a6a44"); r(13, 2, 2, 2, "#8a6a44"); r(10, 5, 2, 1, "#6b4a2a"); r(11, 3, 1, 2, "#6b4a2a"); r(13, 2, 1, 1, "#a67c52"); r(14, 1, 1, 1, "#4f9a3f"); };
  ICO.w_wand = function (r) { r(2, 12, 3, 3, "#3a2414"); r(4, 10, 2, 2, "#54361f"); r(6, 8, 2, 2, "#6b4a2a"); r(8, 6, 2, 2, "#6b4a2a"); r(10, 4, 2, 2, "#54361f"); r(11, 1, 3, 3, "#ffe58a"); r(12, 2, 1, 1, "#fff"); r(10, 1, 1, 1, "#fff7b0"); r(13, 0, 1, 1, "#fff7b0"); r(11, 0, 1, 1, "#fff7b0"); };
  ICO.w_staff = function (r) { r(7, 5, 2, 10, "#6b4a2a"); r(7, 5, 1, 10, "#54361f"); r(5, 4, 6, 1, "#8a6a44"); r(5, 2, 1, 3, "#8a6a44"); r(10, 2, 1, 3, "#8a6a44"); r(6, 1, 4, 4, "#8f6bff"); r(7, 2, 2, 2, "#c9b3ff"); r(7, 1, 1, 1, "#fff"); r(6, 14, 4, 1, "#54361f"); };
  ICO.w_ladle = function (r) { r(12, 2, 2, 2, "#b9c2cd"); r(10, 4, 2, 2, "#b9c2cd"); r(8, 6, 2, 2, "#b9c2cd"); r(6, 8, 2, 2, "#9aa6b4"); r(2, 10, 6, 4, "#b9c2cd"); r(3, 11, 4, 2, "#6b7686"); r(2, 10, 6, 1, "#eef0f3"); r(13, 2, 1, 1, "#eef0f3"); };
  ICO.o_tome = function (r) { r(3, 2, 10, 12, "#8a5a2b"); r(3, 2, 10, 2, "#a67c52"); r(3, 2, 2, 12, "#6b4420"); r(12, 3, 1, 10, "#efe2b8"); r(4, 13, 8, 1, "#e8d9b8"); r(7, 5, 3, 4, "#e8c15a"); r(8, 6, 1, 2, "#fff3c4"); r(6, 10, 4, 1, "#e8c15a"); };
  ICO.o_orb = function (r) { r(5, 2, 6, 1, "#8f6bff"); r(4, 3, 8, 6, "#8f6bff"); r(5, 9, 6, 1, "#6a45c2"); r(5, 3, 6, 1, "#c9b3ff"); r(5, 4, 5, 4, "#a789ff"); r(6, 4, 2, 2, "#fff"); r(4, 10, 8, 1, "#8a6a44"); r(5, 11, 2, 2, "#6b4420"); r(9, 11, 2, 2, "#6b4420"); r(4, 13, 8, 1, "#54361f"); };
  ICO.o_lantern = function (r) { r(7, 0, 2, 1, "#b9c2cd"); r(6, 1, 4, 1, "#8a6a44"); r(4, 3, 8, 9, "#8a6a44"); r(5, 4, 6, 6, "#ffe9a8"); r(7, 5, 2, 4, "#ff8a3e"); r(7, 5, 2, 2, "#ffd84a"); r(7, 4, 1, 1, "#fff7b0"); r(7, 4, 1, 6, "#6b4420"); r(4, 12, 8, 2, "#6b4420"); r(5, 13, 6, 1, "#54361f"); };
  /* per-Incantation icons, by shape / attack type / element */
  ICO.poof = function (r) { r(5, 6, 6, 5, "#d8d2c8"); r(3, 8, 10, 3, "#e8e2d8"); r(6, 4, 4, 3, "#eee"); r(2, 9, 3, 2, "#c8c2b8"); r(11, 9, 3, 2, "#c8c2b8"); r(7, 5, 2, 2, "#fff"); r(1, 11, 1, 1, "#c8c2b8"); r(14, 10, 1, 1, "#c8c2b8"); r(8, 2, 1, 1, "#eee"); };
  ICO.snaps = function (r) { r(1, 7, 10, 2, "#ffd84a"); r(9, 5, 2, 6, "#ffe58a"); r(11, 6, 2, 4, "#ffe58a"); r(13, 7, 2, 2, "#fff7b0"); r(2, 6, 6, 1, "#fff7b0"); r(0, 8, 3, 1, "#f0a800"); };
  ICO.social = function (r) { r(6, 2, 4, 2, "#3f7d58"); r(6, 12, 4, 2, "#3f7d58"); r(2, 6, 2, 4, "#3f7d58"); r(12, 6, 2, 4, "#3f7d58"); r(4, 4, 2, 2, "#3f7d58"); r(10, 4, 2, 2, "#3f7d58"); r(4, 10, 2, 2, "#3f7d58"); r(10, 10, 2, 2, "#3f7d58"); r(7, 0, 2, 2, "#4a8a63"); r(7, 14, 2, 2, "#4a8a63"); r(0, 7, 2, 2, "#4a8a63"); r(14, 7, 2, 2, "#4a8a63"); r(7, 7, 2, 2, "#2d5433"); };
  ICO.rainy = function (r) { r(5, 2, 5, 2, "#b8c2cd"); r(4, 3, 8, 4, "#8d98a6"); r(3, 5, 10, 3, "#a9b4c0"); r(3, 5, 2, 2, "#8d98a6"); r(11, 5, 2, 2, "#8d98a6"); r(4, 9, 1, 3, "#7fdcff"); r(7, 10, 1, 3, "#7fdcff"); r(10, 9, 1, 3, "#7fdcff"); r(5, 13, 1, 2, "#7fdcff"); r(9, 13, 1, 2, "#7fdcff"); };
  ICO.sneeze = function (r) { r(2, 6, 3, 4, "#d94a2a"); r(5, 5, 3, 6, "#f0702a"); r(8, 6, 3, 4, "#ff9a3e"); r(11, 7, 3, 2, "#ffd84a"); r(4, 7, 2, 2, "#ffd84a"); r(13, 7, 2, 1, "#fff7b0"); r(6, 4, 1, 1, "#f0702a"); r(7, 11, 1, 1, "#d94a2a"); };
  ICO.ward = function (r) { r(5, 1, 6, 2, "#cfeeff"); r(3, 3, 2, 2, "#9fd8ff"); r(11, 3, 2, 2, "#9fd8ff"); r(2, 5, 2, 6, "#7fc8ff"); r(12, 5, 2, 6, "#7fc8ff"); r(3, 11, 2, 2, "#9fd8ff"); r(11, 11, 2, 2, "#9fd8ff"); r(5, 13, 6, 2, "#cfeeff"); r(5, 4, 3, 3, "#eaf7ff"); r(7, 7, 2, 2, "#bfe8ff"); };
  function mainIco(it) { return (it && ["w_stick", "w_wand", "w_staff", "w_ladle"][it.k]) || "main"; }
  function offIco(it) { return (it && ["o_tome", "o_orb", "o_lantern"][it.k]) || "off"; }
  function itemIco(it) { return it ? (it.s === "main" ? mainIco(it) : it.s === "off" ? offIco(it) : slotIco(it.s)) : "spark"; }
  function icoEl(k) { var c = el("canvas", { class: "wz-ico", width: "16", height: "16", "aria-hidden": "true" }), x = c.getContext("2d"); (ICO[k] || ICO.spark)(function (a, b2, w, h, col) { x.fillStyle = col; x.fillRect(a, b2, w, h); }); return c; }
  function icoAt(ctx, k, x, y, s) { ICO[k](function (a, b2, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x + a * s, y + b2 * s, w * s, h * s); }); }
  function slotIco(k) { return /^sim/.test(k) ? "sim" : k === "back" ? "cape" : k; }
  function itemChips(it, extra) {
    var c = [[RAR[it.r].n, "r" + it.r], [slotDef(it.s).n, ""], ["Lv " + it.il, ""]];
    if (it.l.length) it.l.forEach(function (l) { var u = STAT[l[0]].u, dn = STAT[l[0]].d; c.push(["+" + l[1] + u + (u.trim() === dn ? "" : " " + dn), "st"]); }); else c.push(["No stats", "dim"]);
    return c.concat(extra || []);
  }
  function MN(g, spec) {                                  /* g.menu, plus an icon, stat chips and a NEW tag on any item that asks */
    g.menu(spec);
    var panel = document.querySelector('.ak-stage[data-game="wizard-sprint"] .ak-panel'); if (!panel) return;
    var btns = panel.querySelectorAll(".ak-panel__items > .ak-btn"), j = 0;
    (spec.items || []).forEach(function (it) {
      if (!it || it.head) return; var bt = btns[j++]; if (!bt) return;
      if (it.tag) bt.dataset.wzSlot = it.tag;
      var ic = it.ico || (/^Back\b/.test(it.label) ? "back" : null);
      if (ic) { bt.insertBefore(icoEl(ic), bt.firstChild); bt.classList.add("has-ico"); }
      if (it.chips) { var box = el("span", { class: "wz-chips" }); it.chips.forEach(function (c) { box.appendChild(el("i", { class: "wz-chip " + (c[1] ? "is-" + c[1] : ""), text: c[0] })); }); var sp = bt.querySelector("span"); if (sp) bt.replaceChild(box, sp); else bt.appendChild(box); }
      if (it.more) { var bx2 = el("span", { class: "wz-chips" }); it.more.forEach(function (c) { bx2.appendChild(el("i", { class: "wz-chip " + (c[1] ? "is-" + c[1] : ""), text: c[0] })); }); bt.appendChild(bx2); }
      if (it.isNew) { bt.classList.add("is-new"); bt.appendChild(el("em", { class: "wz-new", text: it.isNew === true ? "NEW!" : it.isNew })); }
      if (it.pos) { var P = it.pos; bt.style.cssText += ";position:absolute;margin:0;left:" + (P[0] / 1280 * 100) + "cqw;top:" + (P[1] / 720 * 100) + "cqh;width:" + (P[2] / 1280 * 100) + "cqw;height:" + (P[3] / 720 * 100) + "cqh"; }
      if (it.card) {                                      /* a body-map slot: rarity-bordered icon preview, slot name, item name, level */
        var c = it.card, itm = c.it, rc = itm ? (RAR[itm.r].c === "rb" ? "#ffd84a" : RAR[itm.r].c) : "";
        while (bt.firstChild) bt.removeChild(bt.firstChild);
        var imgBox = el("span", { class: "wz-card__img" }, icoEl(itm ? itemIco(itm) : slotIco(c.k))); if (rc) imgBox.style.setProperty("--lc", rc);
        bt.appendChild(imgBox);
        bt.appendChild(el("span", { class: "wz-card__meta" },
          el("em", { class: "wz-card__slot", text: slotName(c.k) }),
          el("b", { class: "wz-card__name", text: itm ? itm.n : "Empty" }),
          el("span", { class: "wz-card__lv", text: itm ? "Lv " + itm.il + " · " + RAR[itm.r].n : (c.fit ? c.fit + " fit" : "—") })));
        if (c.nn) bt.appendChild(el("em", { class: "wz-new", text: "NEW" }));
        bt.dataset.wzSlot = c.k;
      }
      if (it.spell) {                                     /* a big equipped-spell card for the dash screen */
        var s = it.spell; while (bt.firstChild) bt.removeChild(bt.firstChild);
        bt.appendChild(el("span", { class: "wz-sc__top" }, icoEl(s.ico || "spark"), el("em", { class: "wz-sc__slot", text: "Incantation " + s.n })));
        bt.appendChild(el("b", { class: "wz-sc__name", text: s.name }));
        bt.appendChild(el("span", { class: "wz-sc__sub", text: s.cast }));
        if (s.frac != null) {
          var mrow = el("span", { class: "wz-sc__mrow" },
            el("em", { class: "wz-sc__mlvl", text: s.m >= 10 ? "Mastery MAX" : "Mastery " + s.m }),
            el("span", { class: "wz-sc__mbar" }, el("i", { style: "width:" + Math.round(s.frac * 100) + "%" })));
          bt.appendChild(mrow);
        }
        if (s.swap) bt.appendChild(el("span", { class: "wz-sc__swap", text: "▸ tap to swap" }));
      }
      if (it.shop) {                                      /* an upgrade mini-shop tile with a price tag */
        var sh = it.shop; while (bt.firstChild) bt.removeChild(bt.firstChild);
        bt.appendChild(el("b", { class: "wz-st__name", text: sh.name }));
        bt.appendChild(el("span", { class: "wz-st__sub", text: sh.sub }));
        if (sh.price) bt.appendChild(el("span", { class: "wz-price" + (sh.no ? " is-no" : ""), text: sh.price }));
      }
    });
  }
  function tile(l, v, note) { return el("div", { class: "ak-stat" }, el("span", { text: l }), el("b", { text: String(v) }), note ? el("em", { text: note }) : null); }
  function pips(l, max) { return "●".repeat(Math.min(l, max)) + "○".repeat(Math.max(0, max - l)); }
  function cyc(v, d, n) { return ((v + d) % n + n) % n; }
  function panels(g, lines, kicker, done, i) {
    i = i || 0;
    MN(g, { kicker: kicker, cls: "is-wide wz-story", body: named(lines[i]),
      items: [{ label: i < lines.length - 1 ? "Next" : "Onward", cls: "is-primary", act: function () { if (i < lines.length - 1) panels(g, lines, kicker, done, i + 1); else done(); } }] });
  }
  var SHAPEN = ["Twig", "Skinny", "Slim", "Lean", "Average", "Sturdy", "Stout", "Hefty", "Large", "Fairly Large", "Magnificently Round"];
  function creator(g, focus, done) {
    UI.scene = "creator"; UI.menu = "creator";
    var a = S.wiz, items = [];
    function row(label, val, fn) { var idx = items.length; items.push({ label: label, sub: "‹  " + val + "  ›", adj: function (d) { fn(d); creator(g, idx, done); }, act: function () { fn(1); creator(g, idx, done); } }); }
    var input = el("input", { type: "text", class: "wz-input", maxlength: "16", placeholder: "Name your wizard", value: a.name, "aria-label": "Wizard name" });
    input.addEventListener("input", function () { a.name = input.value.replace(/[^\w '\-.]/g, "").slice(0, 16); g.paint(); });
    input.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); input.blur(); creator(g, 0, done); } });
    /* age is typed: whole numbers from 104 to 999 only */
    var ageIn = el("input", { type: "text", inputmode: "numeric", class: "wz-input wz-age", maxlength: "4", value: UI.ageTxt != null ? UI.ageTxt : String(a.age), "aria-label": "Wizard age, 104 to 999" });
    var err = el("p", { class: "wz-err", role: "alert" });
    function ageCheck() {
      var v = ageIn.value.trim(), n = /^\d+$/.test(v) ? parseInt(v, 10) : NaN, bad = !(n >= 104 && n <= 999);
      err.textContent = !bad ? "" : n > 999 ? "Error: nobody is older than 999. Not even you. Ages run from 104 to 999." : n < 104 ? "Error: under 104 is a mere child. Ages run from 104 to 999." : "Error: the age must be a whole number from 104 to 999.";
      ageIn.classList.toggle("is-bad", bad); UI.ageBad = bad; UI.ageTxt = bad ? v : null; if (!bad) a.age = n; g.paint();
    }
    ageIn.addEventListener("input", ageCheck);
    ageIn.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); ageIn.blur(); creator(g, 2, done); } });
    items.push({ label: "Name", ico: "quill", sub: a.name ? a.name + "  (select to type)" : "Select to type a name", act: function () { try { input.focus(); input.select(); } catch (e) {} } });
    items.push({ label: "Random Name", ico: "dice", sub: "For when you can't decide", act: function () { a.name = pick(NAMES); creator(g, 1, done); } });
    items.push({ label: "Age", ico: "hourglass", sub: (UI.ageBad ? "Not valid yet" : a.age + " years") + "  (select to type, 104 to 999)", cls: UI.ageBad ? "is-bad" : "", act: function () { try { ageIn.focus(); ageIn.select(); } catch (e) {} } });
    items.push({ label: "Clothes: " + (UI.nude ? "Off" : "On"), ico: "leaf", sub: UI.nude ? "Fig leaves only, so you can see your changes" : "Take them off to see your changes", act: function () { UI.nude = !UI.nude; creator(g, 3, done); } });
    row("Body Type", ["Masculine", "Feminine"][a.body], function (d) { a.body = cyc(a.body, d, 2); });
    row("Skin Tone", (a.skin + 1) + " of 30", function (d) { a.skin = cyc(a.skin, d, 30); });
    row("Head Shape", HEADN[a.head] + "  (" + (a.head + 1) + " of 12)", function (d) { a.head = cyc(a.head, d, 12); });
    row("Body Weight", SHAPEN[clamp(Math.round(a.shape * 10), 0, 10)] + "  (" + (Math.round(a.shape * 10) + 1) + " of 11)", function (d) { a.shape = clamp(Math.round(a.shape * 10 + d) / 10, 0, 1); });
    row("Height", (Math.round(a.height * 10) + 1) + " of 11", function (d) { a.height = clamp(Math.round(a.height * 10 + d) / 10, 0, 1); });
    row("Hair Style", HAIRN[a.hair] + "  (" + (a.hair + 1) + " of 15)", function (d) { a.hair = cyc(a.hair, d, 15); });
    row("Hair Colour", HAIRC[a.hairCol][0], function (d) { a.hairCol = cyc(a.hairCol, d, HAIRC.length); });
    row("Brows", BROWN[a.brow] + "  (" + (a.brow + 1) + " of 5)", function (d) { a.brow = cyc(a.brow, d, 5); });
    row("Facial Hair", BEARDN[a.beard] + "  (" + (a.beard + 1) + " of 8)", function (d) { a.beard = cyc(a.beard, d, 8); });
    var rz = items.length;
    items.push({ label: "Randomize Everything", ico: "dice", act: function () { a.body = ri(0, 1); a.skin = ri(0, 29); a.head = ri(0, 11); a.shape = ri(0, 10) / 10; a.height = ri(0, 10) / 10; a.age = ri(104, 999); UI.ageTxt = null; UI.ageBad = false; a.hair = ri(0, 14); a.hairCol = ri(0, HAIRC.length - 1); a.brow = ri(0, 4); a.beard = ri(0, 7); creator(g, rz, done); } });
    items.push({ label: "This Is My Wizard", ico: "hat", cls: "is-primary", sub: "You can change it later at the Mirror of Distortion", act: function () {
      if (UI.ageBad) { g.toast("Fix the age first: 104 to 999", "bad"); try { ageIn.focus(); } catch (e) {} return; }
      if (!a.name) a.name = pick(NAMES); UI.nude = false; UI.ageTxt = null; save(); done(); } });
    var box = el("div", { class: "wz-namebox" },
      el("label", { class: "wz-field" }, el("span", { text: "Name" }), input),
      el("label", { class: "wz-field wz-field--age" }, el("span", { text: "Age" }), ageIn), err);
    MN(g, { cls: "is-side is-wide wz-creator", kicker: "The Dressing Chamber", title: "Who Is This Wizard?", sub: "Left and right change a value. All of it is looks only.", body: box, grid: true, items: items, focus: focus });
    if (UI.ageTxt != null) ageCheck();
  }
  function hub(g, focus) {
    UI.scene = "hub"; UI.menu = "hub"; Hb.busy = false; Hb.idleT = Math.min(Hb.idleT, 3);
    var c1 = !!S.cleared[1], nwN = S.bag.filter(function (q) { return q.nw; }).length;
    function go(key, fn) { return function () { goStation(g, key, fn); }; }
    g.setBest(c1 ? "Forest cleared · Wiz Level " + S.lvl : "Wiz Level " + S.lvl);
    MN(g, { cls: "is-side wz-narrow wz-hub", kicker: "Wizard of the Sprint", title: (S.wiz.name || "The Wizard") + "'s Tower",
      sub: c1 ? txt("hub1") : txt("hub0"), focus: focus,
      items: [
        { label: "Prep Time", ico: "prep", tag: "prep", sub: c1 ? "Plan a Magickal Mad Dash" : "Follow the tracks", cls: "is-primary", act: go("prep", function () { prep(g, 0); }) },
        { label: "Equipment", ico: "equip", tag: "equip", isNew: nwN ? nwN + " NEW!" : null, sub: nwN ? nwN + " new " + (nwN > 1 ? "items" : "item") + " in the bag" : "Wear or remove your Wizard Drip", cls: S.bag.length ? "is-hot" : "", act: go("equip", function () { equip(g, 0); }) },
        { label: "Magickal Condenser", ico: c1 ? "condenser" : "lock", tag: c1 ? "condenser" : null, sub: c1 ? "Upgrades and wares for Remnants" : "Locked · clear the forest to open the caravan", disabled: !c1, act: go("condenser", function () { condenser(g, 0); }) },
        { label: "Wizard Drip Armoire", ico: c1 ? "hat" : "lock", tag: c1 ? "armoire" : null, sub: c1 ? "Comfort wear and your hat" : "Locked · clear the forest to win back your hat", disabled: !c1, act: go("armoire", function () { armoire(g, 0); }) },
        { label: "Still Locked", ico: "lock", sub: "Mirror of Distortion and Brags (clear 2 levels) · Bookshelf (3) · Incantation Study (4)", disabled: true },
        { label: "Settings", ico: "gear", sub: "Sound and controls", act: function () { settings(g, 0); } },
        { label: "How To Play", ico: "scroll", sub: "The short version", act: function () { how(g); } }
      ] });
  }
  /* the dash prep screen: a full-bleed layout — name/info left, challenges right, big spell cards in the
     middle (tap to swap), an upgrade mini-shop, a big red Start Run and an orange-brown back arrow. */
  function prep(g, focus) {
    UI.scene = "prep"; UI.menu = "prep";
    var c1 = !!S.cleared[1], st = calc(), owned = Object.keys(S.inc).filter(function (k) { return INC[k]; });
    var items = [], ns = incSlots();
    /* --- incantation cards, centered in the middle column (631) whatever the slot count --- */
    var spw = ns <= 1 ? 380 : 186, spgap = 16, spy = 122, sph = 152, spx = Math.round(631 - (ns * spw + (ns - 1) * spgap) / 2);
    for (var i = 0; i < ns; i++) (function (slot) {
      var idx = items.length, id = S.incEq[slot] || "poof", I = INC[id];
      function turn(d) { var free = owned.filter(function (k) { return S.incEq.indexOf(k) < 0 || S.incEq[slot] === k; }), at = free.indexOf(id); S.incEq[slot] = free[cyc(at < 0 ? 0 : at, d, free.length)]; prep(g, idx); }
      items.push({ pos: [spx + slot * (spw + spgap), spy, spw, sph], cls: "wz-spellcard wz-r" + I.r,
        spell: { n: slot + 1, name: I.n, cast: I.cast, m: mlvl(id), frac: mfrac(id), swap: owned.length > 1, ico: id },
        adj: owned.length > 1 ? turn : null, act: function () { if (owned.length > 1) spellPick(g, slot, idx); } });
    })(i);
    /* --- upgrade mini-shop: the buff opens its own detailed panel --- */
    var shy = 376, bid = S.buffEq[0];
    if (bid) { var rk = S.buffs[bid] || 0, cost = ORBCOST[rk], maxed = rk >= 5;
      items.push({ pos: [335, shy, 590, 92], cls: "wz-shoptile" + (!maxed && S.orbs >= cost ? " is-hot" : ""),
        shop: { name: "Buff · " + BUFF[bid].n + "  " + pips(rk, 5), sub: maxed ? "Fully upgraded · lasts " + r1(10 + st.ret + rk) + "s" : "Lasts " + r1(10 + st.ret + rk) + "s · tap for details", price: maxed ? "MAXED" : "◆ " + cost + " Orbs", no: !maxed && S.orbs < cost },
        act: function () { buffPanel(g, 0); } });
    } else items.push({ pos: [335, shy, 590, 92], cls: "wz-shoptile", shop: { name: "Buff · Locked", sub: "Pick up a Whisper Orb on a run to earn one", price: "LOCKED" }, act: function () { buffPanel(g, 0); } });
    /* --- start run (and endless once the forest's cleared) --- */
    if (c1) items.push({ pos: [639, 540, 286, 48], cls: "wz-endless", ico: "inf", label: "Endless Forest", act: function () { save(); startRun(g, "endless"); } });
    items.push({ pos: [639, 596, 286, 92], cls: "wz-startbtn", ico: "tree", label: "Start Run", act: function () { save(); startRun(g, "story"); } });
    items.push({ pos: [30, 596, 270, 92], cls: "wz-backarrow", ico: "back", label: "Back To The Tower", act: function () { save(); hub(g, 0); } });
    /* --- shortcut buttons: jump straight to the other tower stations without leaving the loadout --- */
    var jumps = [
      { label: "Equipment", ico: "equip", fn: function () { equip(g, 0); } },
      { label: "Condenser", ico: c1 ? "condenser" : "lock", fn: c1 ? function () { condenser(g, 0); } : null, dis: !c1 },
      { label: "Armoire", ico: c1 ? "hat" : "lock", fn: c1 ? function () { armoire(g, 0); } : null, dis: !c1 },
      { label: "Settings", ico: "gear", fn: function () { settings(g, 0); } }
    ];
    jumps.forEach(function (s, k) {
      items.push({ pos: [30, 366 + k * 56, 270, 48], cls: "wz-shortcut", ico: s.ico, label: s.label, disabled: s.dis,
        act: function () { if (s.fn) { save(); s.fn(); } } });
    });
    MN(g, { cls: "wz-prepmap", kicker: "Prep Time", title: "Plan The Dash", items: items, focus: focus || 0, back: function () { save(); hub(g, 0); } });
  }
  /* the buff's own detailed panel: effect, what each rank adds, current rank/duration, and the upgrade */
  function buffPanel(g, focus) {
    UI.scene = "hub"; UI.menu = "prep";
    var bid = S.buffEq[0], st = calc();
    if (!bid) {
      MN(g, { cls: "is-side wz-narrow", kicker: "Upgrades", title: "Buff · Locked", sub: "Pick up a Whisper Orb on a run to unlock and equip your buff.",
        items: [{ label: "Back", cls: "is-primary", act: function () { prep(g, 0); } }], back: function () { prep(g, 0); } });
      return;
    }
    var B = BUFF[bid], rk = S.buffs[bid] || 0, cost = ORBCOST[rk], maxed = rk >= 5, dur = r1(10 + st.ret + rk);
    var body = el("div", {},
      el("p", { class: "wz-bp", text: B.up }),
      el("div", { class: "ak-stats" }, tile("Rank", pips(rk, 5)), tile("Lasts", dur + "s"), tile("Your Orbs", "◆ " + S.orbs)));
    var items = [];
    if (maxed) items.push({ label: "Fully Upgraded", cls: "is-primary", disabled: true });
    else items.push({ label: "Upgrade  ·  ◆ " + cost + " Orbs", cls: "is-primary", disabled: S.orbs < cost,
      act: function () { if (S.orbs < cost) { g.toast("Not enough Whisper Orbs"); return; } S.orbs -= cost; S.buffs[bid] = rk + 1; save(); sfx("buy"); buffPanel(g, 0); } });
    items.push({ label: "Back", act: function () { prep(g, 0); } });
    MN(g, { cls: "is-side wz-narrow", kicker: "Upgrades · Buff", title: B.n, sub: B.d, body: body, items: items, focus: focus || 0, back: function () { prep(g, 0); } });
  }
  /* pick an incantation for a spell slot (the spell-card popup switcher) */
  function spellPick(g, slot, backFocus) {
    UI.scene = "prep"; UI.menu = "prep";
    var owned = Object.keys(S.inc).filter(function (k) { return INC[k]; }), cur = S.incEq[slot] || "poof";
    var items = owned.map(function (id) { var I = INC[id], at = S.incEq.indexOf(id), elsewhere = at >= 0 && at !== slot, nx = mnext(id);
      return { label: I.n, ico: id, sub: I.d, cls: "wz-r" + I.r + (id === cur ? " is-owned" : ""),
        more: [[RAR[I.r].n, "r" + I.r], [I.cast, ""], ["Mastery " + mlvl(id) + " / 10", "st"], [nx == null ? "Mastery maxed" : nx + " kills to next", nx == null ? "r4" : "dim"]].concat(elsewhere ? [["in Incantation " + (at + 1), "dim"]] : []),
        act: function () { var prev = S.incEq[slot]; S.incEq[slot] = id; if (elsewhere) S.incEq[at] = prev; save(); sfx("buy"); prep(g, backFocus); } }; });
    items.push({ label: "Back", cls: "is-primary", act: function () { prep(g, backFocus); } });
    MN(g, { cls: "is-side is-wide", kicker: "Swap Incantation " + (slot + 1), title: "Choose an Incantation", sub: "Pick what this slot casts — each one's effect is shown below it.", items: items, focus: Math.max(0, owned.indexOf(cur)), back: function () { prep(g, backFocus); } });
  }
  function wrapLines(ctx, s, maxw) { var words = ("" + s).split(" "), lines = [], cur = ""; words.forEach(function (w) { var t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > maxw && cur) { lines.push(cur); cur = w; } else cur = t; }); if (cur) lines.push(cur); return lines; }
  function drawChalCard(ctx, x, y, w, h, d, done, fr) {
    ctx.fillStyle = "rgba(24,40,86,.94)"; D.rr(ctx, x, y, w, h, 10); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "#e8c15a"; D.rr(ctx, x + 1, y + 1, w - 2, h - 2, 9); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = "rgba(200,180,255,.25)"; D.rr(ctx, x + 5, y + 5, w - 10, h - 10, 7); ctx.stroke();
    diamond(ctx, x + 12, y + 13, 4, "#ffe08a"); diamond(ctx, x + w - 12, y + 13, 4, "#ffe08a");
    bold(ctx, d.n, x + 20, y + 28, "800 15px " + SERIF, "#fff3d0", "left");
    bold(ctx, done + " / " + d.need, x + w - 20, y + 28, "800 13px " + F.mono, done >= d.need ? "#9ae6b4" : "#ffe08a", "right");
    var bx = x + 16, bw = w - 32, by = y + 40; ctx.fillStyle = "rgba(0,0,0,.5)"; D.rr(ctx, bx, by, bw, 9, 4); ctx.fill();
    if (fr > 0) { ctx.fillStyle = "#ffe58a"; D.rr(ctx, bx, by, Math.max(7, bw * fr), 9, 4); ctx.fill(); }
    ctx.font = "600 11px " + F.mono; var ls = wrapLines(ctx, d.d, w - 32);
    for (var li = 0; li < ls.length && li < 3; li++) D.text(ctx, ls[li], x + 16, y + 66 + li * 15, "600 11px " + F.mono, "#d7e2ff", "left");
    bold(ctx, "+200 XP  ·  +50 Remnants", x + w / 2, y + h - 12, "800 11px " + F.mono, "#ffe08a", "center");
  }
  function drawPrepScene(g, ctx) {
    var i, c1 = !!S.cleared[1];
    var bgg = ctx.createLinearGradient(0, 0, 0, H); bgg.addColorStop(0, "#2a2033"); bgg.addColorStop(1, "#1a1422"); ctx.fillStyle = bgg; ctx.fillRect(0, 0, W, H);
    for (i = 0; i < 80; i++) { ctx.fillStyle = i % 2 ? "rgba(255,220,170,.05)" : "rgba(0,0,0,.08)"; ctx.fillRect((i * 83) % W, (i * 127) % H, 40 + (i % 3) * 20, 3); }
    var fx = 14, fy = 62, fw = W - 28, fh = H - 76;
    ctx.fillStyle = "rgba(40,28,20,.4)"; D.rr(ctx, fx, fy, fw, fh, 16); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = "#e8c15a"; D.rr(ctx, fx + 1.5, fy + 1.5, fw - 3, fh - 3, 15); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = "rgba(232,193,90,.3)"; D.rr(ctx, fx + 6, fy + 6, fw - 12, fh - 12, 12); ctx.stroke();
    /* left: name & info */
    var lx = 30, ly = 92, lw = 275, lh = 250;
    plate(ctx, lx, ly, lw, lh, 10);
    bold(ctx, "The Forest", lx + lw / 2, ly + 28, "800 22px " + SERIF, "#fff3c4", "center");
    D.text(ctx, "Around the Tower · Level 1", lx + lw / 2, ly + 46, "700 11px " + F.mono, "#e4cf9a", "center");
    ctx.strokeStyle = "rgba(232,193,90,.35)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lx + 22, ly + 58); ctx.lineTo(lx + lw - 22, ly + 58); ctx.stroke();
    bold(ctx, S.wiz.name || "The Wizard", lx + lw / 2, ly + 84, "800 19px " + SERIF, "#ffe9b8", "center");
    D.text(ctx, "“" + titleName() + "”", lx + lw / 2, ly + 101, "700 11px " + F.mono, "#ffd98a", "center");
    bold(ctx, "Wiz Level " + S.lvl, lx + lw / 2, ly + 119, "700 12px " + F.mono, "#dccb9f", "center");
    D.text(ctx, c1 ? "Run the forest again — about" : "Follow the tracks — about", lx + 20, ly + 140, "600 12px " + F.mono, "#cbbf9f", "left");
    D.text(ctx, "five minutes, then the boss.", lx + 20, ly + 158, "600 12px " + F.mono, "#cbbf9f", "left");
    D.text(ctx, "Three challenges, once each", lx + 20, ly + 188, "600 12px " + F.mono, "#cbbf9f", "left");
    D.text(ctx, "per run. Finish one for", lx + 20, ly + 206, "600 12px " + F.mono, "#cbbf9f", "left");
    D.text(ctx, "+200 XP and +50 Remnants.", lx + 20, ly + 224, "700 12px " + F.mono, "#ffe08a", "left");
    /* section labels */
    D.text(ctx, "JUMP TO", lx + 4, ly + 268, "800 11px " + F.mono, "#e4cf9a", "left");
    /* the Select Incantation tray — framed and centered over its cards, so it reads as a panel, not a stray label */
    (function () {
      var ns2 = incSlots(), spw2 = ns2 <= 1 ? 380 : 186, cw2 = ns2 * spw2 + (ns2 - 1) * 16, sx2 = Math.round(631 - cw2 / 2);
      var tx = sx2 - 16, tw = cw2 + 32, ty = 116, th = 168;
      var tg = ctx.createLinearGradient(0, ty, 0, ty + th); tg.addColorStop(0, "rgba(74,54,104,.42)"); tg.addColorStop(1, "rgba(44,32,64,.34)");
      ctx.fillStyle = tg; D.rr(ctx, tx, ty, tw, th, 14); ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(232,193,90,.42)"; D.rr(ctx, tx + 0.75, ty + 0.75, tw - 1.5, th - 1.5, 13); ctx.stroke();
      ctx.strokeStyle = "rgba(232,193,90,.28)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(631 - 70, 110); ctx.lineTo(631 + 70, 110); ctx.stroke();
      bold(ctx, "Select Incantation", 631, 104, "800 17px " + SERIF, "#f3e6c4", "center");
    })();
    bold(ctx, "Upgrades", 335, 366, "800 17px " + SERIF, "#f3e6c4", "left");
    bold(ctx, "Challenges", 958, 86, "800 16px " + SERIF, "#ffe08a", "left");
    /* right: the three challenges, as gilded blue & gold cards */
    var cx0 = 958, cw = 282, cy = 96, chh = 162, cg = 12;
    S.ch.forEach(function (c, ci) { if (ci > 2) return; var d = chDef(c.id), done = Math.min(d.need, Math.floor(c.p)), fr = clamp(done / d.need, 0, 1); drawChalCard(ctx, cx0, cy + ci * (chh + cg), cw, chh, d, done, fr); });
  }
  function incList(g) {
    UI.scene = "hub"; UI.menu = "prep";
    var items = Object.keys(S.inc).filter(function (k) { return INC[k]; }).map(function (id) { var I = INC[id], n = mnext(id);
      return { label: I.n, ico: id, sub: I.d + " " + I.m, more: [[RAR[I.r].n, "r" + I.r], [I.cast, ""], ["Mastery " + mlvl(id) + " / 10", "st"], [n == null ? "Maxed" : n + " kills to next", n == null ? "r4" : ""]], cls: "wz-r" + I.r, act: function () {} }; });
    items.push({ label: "Back", cls: "is-primary", act: function () { prep(g, 0); } });
    MN(g, { cls: "is-side is-wide", kicker: "Prep Time", title: "Incantations", sub: "Shattered Syllables: " + S.syl + " (spent at the Incantation Study, later)", items: items, focus: items.length - 1, back: function () { prep(g, 0); } });
  }
  function slotName(k) { var sd = slotDef(k); return /^sim/.test(k) ? "Simulacrum " + k.slice(3) : sd.n; }
  /* the equipment body-map: each open slot is a card placed at a body position (canvas px, 1280x720);
     locked slots never appear. Simulacra sit bottom-left, weapons bottom-centre, the wizard preview centre-right. */
  /* a tidy 3-column body map down the left; the wizard medallion sits centre-right, stats far right */
  var EMAP = {
    neck:  [20,  86, 182, 78], head:  [212,  86, 182, 78], shoulder: [404,  86, 182, 78],
    back:  [20, 174, 182, 78], chest: [212, 174, 182, 78], hands:    [404, 174, 182, 78],
    waist: [20, 262, 182, 78], legs:  [212, 262, 182, 78], feet:     [404, 262, 182, 78],
    main:  [628, 578, 170, 60], off: [812, 578, 170, 60],
    sim1: [20, 384, 182, 68], sim2: [212, 384, 182, 68], sim3: [404, 384, 182, 68],
    sim4: [20, 458, 182, 68], sim5: [212, 458, 182, 68], sim6: [404, 458, 182, 68]
  };
  function equip(g, focus) {
    UI.scene = "equip"; UI.menu = "equip";
    var open = openSlots();
    var items = open.map(function (k, i) { var it = S.eq[k], kind = /^sim/.test(k) ? "sim" : k, fit = S.bag.filter(function (q) { return q.s === kind; }), nn = fit.filter(function (q) { return q.nw; }).length;
      return { label: slotName(k), tag: k, pos: EMAP[k] || [0, 0, 178, 62], card: { k: k, it: it, fit: fit.length, nn: nn },
        cls: "wz-card " + (it ? "wz-r" + it.r : "wz-empty") + (fit.length ? " is-hot" : "") + (nn ? " is-new" : ""), act: function () { slotMenu(g, k, 0, i); } }; });
    var nb = S.bag.filter(function (q) { return q.nw; }).length;
    items.push({ label: "Rummage In The Bag", ico: "equip", pos: [340, 650, 360, 48], cls: "wz-equipbtn is-primary" + (nb ? " is-new" : ""), act: function () { bag(g, 0, function () { equip(g, open.length); }); } });
    items.push({ label: "Back To The Tower", ico: "back", pos: [724, 650, 260, 48], cls: "wz-equipbtn", act: function () { hub(g, 1); } });
    MN(g, { cls: "wz-equipmap", kicker: "Wizard Drip", title: "Equipment", items: items, focus: focus, back: function () { hub(g, 1); } });
  }
  function slotMenu(g, k, focus, backF) {
    UI.scene = "bag"; UI.menu = "slot";
    var kind = /^sim/.test(k) ? "sim" : k, cur = S.eq[k];
    function leave() { S.bag.forEach(function (q) { if (q.s === kind) delete q.nw; }); save(); equip(g, backF); }
    var items = S.bag.filter(function (q) { return q.s === kind; }).sort(function (x, y) { return (y.nw || 0) - (x.nw || 0) || y.r - x.r || y.il - x.il; }).map(function (it) {
      return { label: it.n, ico: itemIco(it), chips: itemChips(it), isNew: !!it.nw, cls: "wz-r" + it.r, act: function () { S.bag.splice(S.bag.indexOf(it), 1); delete it.nw; if (cur) S.bag.push(cur); S.eq[k] = it; sfx("buy"); leave(); } }; });
    if (cur) items.push({ label: "Take Off " + cur.n, sub: S.bag.length >= S.bagCap ? "The bag is full" : "Back into the bag", disabled: S.bag.length >= S.bagCap, act: function () { S.bag.push(cur); delete S.eq[k]; leave(); } });
    items.push({ label: "Back", act: leave });
    var body = cur ? el("div", { class: "wz-worn" }, el("span", { text: "Wearing now" }), el("b", { class: "wz-rt" + cur.r, text: cur.n }), (function () { var bx = el("span", { class: "wz-chips" }); itemChips(cur).forEach(function (c) { bx.appendChild(el("i", { class: "wz-chip " + (c[1] ? "is-" + c[1] : ""), text: c[0] })); }); return bx; })()) : null;
    MN(g, { cls: "is-side is-wide wz-bag", kicker: "Inside the bag", title: slotName(k), sub: cur ? "" : "Nothing worn here yet.", body: body, items: items, focus: focus, back: leave });
  }
  /* Obliviate: destroy an Impressive-or-better item for Whisper Orbs, with a scaling shot at rarer currency.
     Payout scales with item level (×(1 + il/100)); the chances come from the proposed-odds table. */
  function canObliviate(it) { return !it.st && it.r >= 2; }
  function oblRoll(it) {
    var orbBase = { 2: [1, 2], 3: [2, 4], 4: [4, 7], 5: [8, 12] }[it.r] || [1, 1];
    var scale = 1 + it.il / 100;
    var orbs = Math.max(1, Math.round(ri(orbBase[0], orbBase[1]) * scale * tune("oblOrbs")));
    var gChance = { 2: 0.08, 3: 0.20, 4: 0.40, 5: 1 }[it.r] || 0, gAmt = it.r >= 5 ? ri(2, 3) : it.r >= 4 ? ri(1, 2) : 1;
    var sChance = { 2: 0, 3: 0.03, 4: 0.10, 5: 0.25 }[it.r] || 0, sAmt = it.r >= 5 ? ri(1, 2) : 1;
    return { orbs: orbs, grim: Math.random() < gChance ? gAmt : 0, syl: Math.random() < sChance ? sAmt : 0 };
  }
  function obliviate(g, picks, done) {
    var n = picks.length;
    MN(g, { cls: "is-side wz-narrow", kicker: "Obliviate  ·  Impressive+", title: "Obliviate " + n + (n > 1 ? " Items" : " Item"),
      sub: "Destroy " + (n > 1 ? "them" : "it") + " forever for Whisper Orbs, with a chance at Grimoires and Shattered Syllables. This can't be undone.",
      items: [
        { label: "Obliviate " + (n > 1 ? "Them" : "It"), ico: "spark", cls: "is-primary", act: function () {
            var to = 0, tg = 0, ts = 0;
            picks.forEach(function (it) { var ix = S.bag.indexOf(it); if (ix < 0) return; S.bag.splice(ix, 1); var r = oblRoll(it); to += r.orbs; tg += r.grim; ts += r.syl; cnt("obliv", 1); });
            S.orbs += to; S.grim += tg; S.syl += ts; save(); sfx("lootBig");
            var parts = ["+" + to + " Whisper Orb" + (to > 1 ? "s" : "")];
            if (tg) parts.push("+" + tg + " Grimoire" + (tg > 1 ? "s" : ""));
            if (ts) parts.push("+" + ts + " Shattered Syllable" + (ts > 1 ? "s" : ""));
            g.toast("Obliviated: " + parts.join(", "), "gold"); done();
          } },
        { label: "Keep " + (n > 1 ? "Them" : "It"), act: function () { done(); } }
      ], focus: 1, back: function () { done(); } });
  }
  function bag(g, focus, back, sel) {
    UI.scene = "bag"; UI.menu = "bag"; sel = sel || {};
    function leave() { S.bag.forEach(function (q) { delete q.nw; }); save(); back(); }
    function reopen(f) { bag(g, f, back, sel); }
    var ids = {}; S.bag.forEach(function (q) { ids[q.id] = 1; });
    Object.keys(sel).forEach(function (id) { if (!ids[id]) delete sel[id]; });   /* forget anything no longer carried */
    var list = S.bag.slice().sort(function (x, y) { return (y.nw || 0) - (x.nw || 0) || y.r - x.r || y.il - x.il; });
    var picked = S.bag.filter(function (q) { return sel[q.id]; }), sellSum = picked.reduce(function (a, it) { return a + sellPrice(it); }, 0);
    var oblPicked = picked.filter(canObliviate);
    var items = list.map(function (it) { var i = list.indexOf(it), on = !!sel[it.id], ob = canObliviate(it);
      return { label: (on ? "✓  " : "") + it.n, ico: itemIco(it), isNew: !!it.nw, cls: "wz-r" + it.r + (on ? " is-picked" : ""),
        chips: itemChips(it, [["◆ " + sellPrice(it), "rem"]].concat(ob ? [["Obliviate", "r" + it.r]] : [])),
        act: function () { if (sel[it.id]) delete sel[it.id]; else sel[it.id] = 1; sfx("rem"); reopen(i); } }; });
    /* bottom action row keeps item focus stable (items always start at index 0) */
    if (picked.length) {
      items.push({ label: "Sell Selected (" + picked.length + ")", ico: "coin", cls: "is-primary", sub: "Get ◆ " + fmt(sellSum) + " Remnants  ·  can't be undone",
        act: function () { var nn = picked.length; picked.forEach(function (it) { var ix = S.bag.indexOf(it); if (ix >= 0) S.bag.splice(ix, 1); S.rem += sellPrice(it); }); clearSel(); save(); sfx("buy"); g.toast("Sold " + nn + (nn > 1 ? " items" : " item") + " for ◆ " + fmt(sellSum), "gold"); reopen(0); } });
      if (oblPicked.length) items.push({ label: "Obliviate Selected (" + oblPicked.length + ")", ico: "spark", cls: "is-gold", sub: "Impressive+ only  ·  destroy for Whisper Orbs & rarer currency",
        act: function () { obliviate(g, oblPicked, function () { clearSel(); reopen(0); }); } });
      items.push({ label: "Clear Selection", act: function () { clearSel(); reopen(0); } });
    }
    function clearSel() { Object.keys(sel).forEach(function (k) { delete sel[k]; }); }
    items.push({ label: "Back", cls: picked.length ? "" : "is-primary", act: leave });
    MN(g, { cls: "is-side is-wide wz-bag", kicker: "Rummage Through The Bag  ·  " + S.bag.length + " / " + S.bagCap + " carried", title: "The Bag",
      sub: S.bag.length ? "Tap items to select, then Sell or Obliviate them together below. Impressive (blue) and up can be Obliviated for currency. Wear things from the equipment slots." : "Empty. Enemies drop Wizard Drip now and then.",
      items: items, focus: focus, back: leave });
  }
  function drawBagScene(g, ctx) {                        /* looking down into one enormous bag */
    var t = Hb.t, i, x, y, an;
    ctx.fillStyle = "#6b4420"; ctx.fillRect(0, 0, W, H);
    for (i = 0; i < 70; i++) { ctx.fillStyle = i % 2 ? "rgba(0,0,0,.07)" : "rgba(255,220,170,.05)"; ctx.fillRect(hash(i) * W, hash(i * 3) * H, 50 + hash(i * 5) * 140, 3); }
    ell(ctx, 640, 372, 700, 410, "#3a2412"); ell(ctx, 640, 372, 690, 400, "#a06d3a"); ell(ctx, 640, 378, 664, 378, "#7a4f28"); ell(ctx, 640, 386, 640, 360, "#4a2f18");
    var gr = ctx.createRadialGradient(700, 470, 40, 640, 400, 660); gr.addColorStop(0, "#4a321d"); gr.addColorStop(0.55, "#24160c"); gr.addColorStop(1, "#0d0704");
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(640, 394, 622, 344, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.ellipse(640, 394, 622, 344, 0, 0, TAU); ctx.clip();
    for (i = 0; i < 9; i++) { ctx.strokeStyle = "rgba(0,0,0,.28)"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(40 + i * 150, 40); ctx.quadraticCurveTo(640 + (i - 4) * 60, 420, 300 + i * 85, 760); ctx.stroke(); }
    /* the odds and ends at the bottom */
    var junk = [[840, 640, "scroll"], [930, 676, "rem"], [1150, 650, "grim"], [760, 690, "coin"], [1210, 600, "orb"], [1000, 700, "leaf"], [880, 700, "rem"], [1100, 706, "dice"]];
    junk.forEach(function (j, k) { ctx.globalAlpha = 0.5; icoAt(ctx, j[2], j[0], j[1] - 20 + Math.sin(t * 0.8 + k) * 1.5, 3); }); ctx.globalAlpha = 1;
    var sp = ctx.createRadialGradient(1040, 600, 10, 1040, 520, 330); sp.addColorStop(0, "rgba(255,226,160,.26)"); sp.addColorStop(1, "rgba(255,226,160,0)"); ctx.fillStyle = sp; ctx.fillRect(700, 120, 580, 600);
    ell(ctx, 1040, 628, 120, 18, "rgba(0,0,0,.45)");
    wizSprite(lookOf(false), "stand", t); ctx.imageSmoothingEnabled = false; blitWiz(ctx, 1040, 624, 5);
    for (i = 0; i < 14; i++) { var q = (t * (0.05 + hash(i) * 0.08) + hash(i * 3)) % 1; ctx.fillStyle = "rgba(255,236,190," + (0.5 * Math.sin(q * Math.PI)).toFixed(2) + ")"; ctx.fillRect(760 + hash(i * 7) * 480, 640 - q * 460, 3, 3); }
    ctx.restore();
    for (i = 0; i < 64; i++) { an = i / 64 * TAU; x = 640 + Math.cos(an) * 676; y = 375 + Math.sin(an) * 388; ctx.save(); ctx.translate(x, y); ctx.rotate(an + Math.PI / 2); ctx.fillStyle = "#f0dcae"; ctx.fillRect(-10, -2, 20, 4); ctx.restore(); }
    for (i = 0; i < 12; i++) { an = -Math.PI + (i + 0.5) / 12 * Math.PI; x = 640 + Math.cos(an) * 652; y = 380 + Math.sin(an) * 370; if (y < 8) continue; ell(ctx, x, y, 13, 13, "#e8c15a"); ell(ctx, x, y, 7, 7, "#1a0f08"); }
    ctx.strokeStyle = "#d9c08a"; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(1150, 40); ctx.quadraticCurveTo(1230, 90 + Math.sin(t) * 4, 1200, 190); ctx.quadraticCurveTo(1180, 250, 1236, 300); ctx.stroke(); ell(ctx, 1238, 306, 12, 16, "#b98a4e");
    plate(ctx, 884, 30, 312, 52); D.text(ctx, (S.wiz.name || "The Wizard") + "  ·  Wiz Lv " + S.lvl, 1040, 54, "700 20px " + SERIF, "#f3e6c4", "center");
    D.text(ctx, "“" + titleName() + "”", 1040, 72, "700 12px " + F.mono, "#ffd98a", "center");
  }
  function statWord(k) { return STAT[k].d.split(" ")[0]; }
  function drawEquipScene(g, ctx) {
    var t = Hb.t, i, wx2 = 812, footY = 470;
    /* an armory alcove: warm lit stone */
    var bgg = ctx.createLinearGradient(0, 0, 0, H); bgg.addColorStop(0, "#3a2c20"); bgg.addColorStop(1, "#241a14"); ctx.fillStyle = bgg; ctx.fillRect(0, 0, W, H);
    for (i = 0; i < 90; i++) { ctx.fillStyle = i % 2 ? "rgba(255,210,150,.07)" : "rgba(0,0,0,.09)"; var bx = (i * 73) % W, by = (i * 97) % H; ctx.fillRect(bx, by, 46 + (i % 3) * 22, 3); }
    /* the Wizard Drip bordered cell the whole screen sits inside */
    var fx = 14, fy = 62, fw = W - 28, fh = H - 76;
    ctx.fillStyle = "rgba(70,48,28,.42)"; D.rr(ctx, fx, fy, fw, fh, 16); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = "#e8c15a"; D.rr(ctx, fx + 1.5, fy + 1.5, fw - 3, fh - 3, 15); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = "rgba(232,193,90,.32)"; D.rr(ctx, fx + 6, fy + 6, fw - 12, fh - 12, 12); ctx.stroke();
    /* header (drawn on canvas so it stays aligned at any window ratio) */
    bold(ctx, "✦  WIZARD DRIP  ✦", 40, 34, "800 15px " + F.mono, "#e8c15a", "left");
    bold(ctx, "Equipment", 40, 56, "800 26px " + SERIF, "#fff3c4", "left");
    /* a lit medallion holds the wizard preview, bright and clear (no more dim radial) — big enough to frame the whole wizard */
    var mcx = wx2, mcy = 272, mrx = 176, mry = 226;
    var halo = ctx.createRadialGradient(mcx, mcy, 16, mcx, mcy, 250); halo.addColorStop(0, "rgba(255,236,176,.72)"); halo.addColorStop(.45, "rgba(255,222,142,.3)"); halo.addColorStop(1, "rgba(255,222,142,0)"); ctx.fillStyle = halo; ctx.fillRect(wx2 - 210, fy + 4, 420, fh - 8);
    ctx.fillStyle = "rgba(46,32,19,.72)"; ctx.beginPath(); ctx.ellipse(mcx, mcy, mrx, mry, 0, 0, TAU); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(232,193,90,.7)"; ctx.beginPath(); ctx.ellipse(mcx, mcy, mrx, mry, 0, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1.25; ctx.strokeStyle = "rgba(232,193,90,.3)"; ctx.beginPath(); ctx.ellipse(mcx, mcy, mrx - 7, mry - 7, 0, 0, TAU); ctx.stroke();
    ell(ctx, wx2, footY + 8, 112, 19, "rgba(0,0,0,.4)");
    wizSprite(lookOf(S.comfort), (t % 8) < 5 ? "stand" : (t % 8) < 6.5 ? "five" : "stand", t);
    ctx.imageSmoothingEnabled = false; blitWiz(ctx, wx2, footY, 4.8);
    plate(ctx, wx2 - 124, mcy + mry - 2, 248, 58, 9);
    D.text(ctx, "— " + titleName() + " —", wx2, mcy + mry + 15, "800 12px " + F.mono, "#ffd98a", "center");
    bold(ctx, S.wiz.name || "The Wizard", wx2, mcy + mry + 34, "800 19px " + SERIF, "#fff3c4", "center");
    bold(ctx, "Wiz Level " + S.lvl, wx2, mcy + mry + 50, "700 12px " + F.mono, "#dccb9f", "center");
    /* right-hand stat stack: a base number, with a green bump from whatever gear is on */
    var tot = calc(), base = {}; SK.forEach(function (k) { base[k] = Math.min(STAT[k].cap, r1((S.ranks[k] || 0) * STAT[k].rank)); });
    var px0 = 992, pw = 262, py0 = 134, rh = 50;
    plate(ctx, px0, py0 - 42, pw, 34); D.text(ctx, "Wizard Stats", px0 + pw / 2, py0 - 19, "700 19px " + SERIF, "#f3e6c4", "center");
    SK.forEach(function (k, i3) {
      var y = py0 + i3 * rh, bv = k === "vit" ? 10 + base.vit : base[k], tv = k === "vit" ? tot.hp : tot[k], u = k === "vit" ? "" : STAT[k].u, dl = r1(tv - bv);
      plate(ctx, px0, y, pw, rh - 8, 6);
      D.text(ctx, STAT[k].d, px0 + 12, y + 18, "700 14px " + SERIF, "#f0e4c4", "left");
      D.text(ctx, STAT[k].n, px0 + 12, y + 32, "600 8px " + F.mono, "#9a8f7a", "left");
      D.text(ctx, r1(bv) + u, px0 + pw - 12, y + 17, "800 16px " + F.mono, "#f6ecd0", "right");
      if (dl > 0.0001) D.text(ctx, "+" + dl + u + " gear", px0 + pw - 12, y + 33, "800 11px " + F.mono, "#7fdc9c", "right");
      else D.text(ctx, "no gear bonus", px0 + pw - 12, y + 33, "600 9px " + F.mono, "#7a7161", "right");
    });
  }
  function condenser(g, focus) {
    UI.scene = "hub"; UI.menu = "condenser";
    var left = 1800 - Math.floor(Date.now() / 1000) % 1800;
    MN(g, { cls: "is-side wz-narrow", kicker: "The caravan out front", title: "Magickal Condenser", body: el("div", { class: "ak-stats" }, tile("Remnants", fmt(S.rem), "to spend"), tile("Bag", S.bag.length + " / " + S.bagCap), tile("Wiz Level", S.lvl)), focus: focus, back: function () { hub(g, 2); },
      items: [
        { label: "Upgrades", ico: "condenser", sub: "Jump, glide and all eight stats", cls: "is-primary", act: function () { upgrades(g, 0); } },
        { label: "Wares", ico: "equip", sub: "New stock in " + Math.floor(left / 60) + ":" + ("0" + left % 60).slice(-2), act: function () { wares(g, 0); } },
        { label: "Sell From The Bag", ico: "coin", sub: S.bag.length + " / " + S.bagCap, act: function () { bag(g, 0, function () { condenser(g, 2); }); } },
        { label: "Back", act: function () { hub(g, 2); } }
      ] });
  }
  function upgrades(g, focus) {
    UI.scene = "hub"; UI.menu = "condenser";
    var items = RANKS.map(function (u, i) {
      var l = S.ranks[u.k] || 0, cost = rankCost(l), mx = l >= u.max, can = !mx && S.rem >= cost;
      return { label: u.n + "  " + (u.max <= 10 ? pips(l, u.max) : l + " / " + u.max), chips: mx ? [[u.d(l), "st"], ["Maxed", "r4"]] : [[u.d(l), ""], ["→ " + u.d(l + 1), "st"], ["◆ " + fmt(cost), can ? "rem" : "no"]], cls: can ? "is-hot" : mx ? "is-owned" : "",
        act: function () { if (mx) return; if (!can) { g.toast("Not enough Remnants"); return; } S.rem -= cost; cnt("spent", cost); S.ranks[u.k] = l + 1; save(); sfx("buy"); upgrades(g, i); } };
    });
    items.push({ label: "Back", act: function () { condenser(g, 0); } });
    MN(g, { cls: "is-side is-wide", kicker: "Magickal Condenser", title: "Upgrades", body: el("div", { class: "ak-stats" }, tile("Remnants", fmt(S.rem), "to spend")), grid: true, items: items, focus: focus, back: function () { condenser(g, 0); } });
  }
  function wares(g, focus) {
    UI.scene = "hub"; UI.menu = "condenser";
    var st = stock(), items = st.map(function (it, i) { var pr = buyPrice(it);
      return { label: it.n, ico: itemIco(it), chips: itemChips(it, [["◆ " + fmt(pr), S.rem >= pr ? "rem" : "no"]]), cls: "wz-r" + it.r + (S.rem >= pr ? " is-hot" : ""),
        act: function () { if (S.rem < pr) { g.toast("Not enough Remnants"); return; } if (S.bag.length >= S.bagCap) { g.toast("The bag is full"); return; } S.rem -= pr; cnt("spent", pr); st.splice(st.indexOf(it), 1); it.nw = 1; S.bag.push(it); save(); sfx("buy"); wares(g, Math.min(i, st.length)); } }; });
    [["social", 600], ["rainy", 1500]].forEach(function (w) { if (S.inc[w[0]]) return; var I = INC[w[0]], idx = items.length;
      items.push({ label: "Incantation: " + I.n, ico: w[0], sub: I.cast + ". " + I.d, chips: null, cls: "is-gold", price: w[1], act: function () { if (S.rem < w[1]) { g.toast("Not enough Remnants"); return; } S.rem -= w[1]; cnt("spent", w[1]); giveInc(w[0], g); save(); sfx("buy"); wares(g, Math.min(idx, items.length - 2)); } }); });
    items.push({ label: "Back", act: function () { condenser(g, 1); } });
    items.forEach(function (it) { if (it.price) it.label += "   ◆ " + fmt(it.price); });
    MN(g, { cls: "is-side is-wide", kicker: "Magickal Condenser", title: "Wares", sub: "Bought items go to the bag.", body: el("div", { class: "ak-stats" }, tile("Remnants", fmt(S.rem), "to spend"), tile("Bag", S.bag.length + " / " + S.bagCap)), items: items, focus: focus, back: function () { condenser(g, 1); } });
  }
  function armoire(g, focus) {
    UI.scene = "hub"; UI.menu = "armoire";
    MN(g, { cls: "is-side wz-narrow", kicker: "Wizard Drip Armoire", title: "The Armoire", sub: "What you wear around the tower. Runs always show your equipped gear.", focus: focus, back: function () { hub(g, 3); },
      items: [
        { label: "Around The Tower: " + (S.comfort ? "Comfort Wear" : "Equipped Gear"), ico: "chest", sub: "Comfort wear is the sleep cap, tunic and skivvies", act: function () { S.comfort = !S.comfort; save(); armoire(g, 0); } },
        { label: "Favorite Hat: " + (S.cos.hatOn ? "On" : "Off"), ico: "hat", sub: "Won back from the Grand Mud Imp. Worn over any headgear.", act: function () { S.cos.hatOn = !S.cos.hatOn; save(); armoire(g, 1); } },
        { label: "Wizard Titles", ico: "scroll", sub: titlesHave() + " of " + TITLES.length + " earned  ·  wearing “" + titleName() + "”", act: function () { titles(g, 0); } },
        { label: "Back", act: function () { hub(g, 3); } }
      ] });
  }
  /* pick which earned title rides on the nameplate; locked ones show how to earn them */
  function titles(g, focus) {
    UI.scene = "hub"; UI.menu = "armoire";
    var cur = S.title || "robbed";
    var items = TITLES.map(function (t) {
      var un = titleUnlocked(t.id), sel = t.id === cur && un;
      return { label: t.n, ico: un ? (sel ? "quill" : "scroll") : "lock",
        sub: un ? (sel ? "Worn on your nameplate now" : "Earned — tap to wear it") : "Locked  ·  " + t.d,
        cls: "wz-title" + (sel ? " is-owned" : "") + (un ? "" : " is-locked"), disabled: !un,
        act: un ? function () { S.title = t.id; save(); sfx("buy"); titles(g, TITLES.indexOf(t)); } : null };
    });
    items.push({ label: "Back", cls: "is-primary", act: function () { armoire(g, 2); } });
    MN(g, { cls: "is-side is-wide", kicker: "Wizard Drip Armoire", title: "Wizard Titles",
      sub: "Earned " + titlesHave() + " of " + TITLES.length + ". The one you wear shows on your nameplate across the tower.",
      items: items, focus: focus || 0, back: function () { armoire(g, 2); } });
  }
  function settings(g, focus) {
    UI.scene = "hub"; UI.menu = "settings";
    MN(g, { cls: "is-side wz-narrow", kicker: "Wizard of the Sprint", title: "Settings", focus: focus, back: function () {  hub(g, 4); },
      items: [
        { label: "Game Sound: " + (S.snd ? "On" : "Off"), ico: "sound", act: function () { S.snd = !S.snd; save(); sfx("buy"); settings(g, 0); } },
        { label: "Volume: " + Math.round(S.vol * 100) + "%", ico: "sound", sub: "‹  left and right  ›", adj: function (d) { S.vol = clamp(Math.round(S.vol * 10 + d) / 10, 0.1, 1); save(); sfx("rem"); settings(g, 1); }, act: function () { S.vol = S.vol >= 1 ? 0.1 : Math.round(S.vol * 10 + 1) / 10; save(); sfx("rem"); settings(g, 1); } },
        { label: "Illusion Flash: " + (S.flashOn ? "On" : "Off"), ico: "flash", sub: S.flashOn ? "Press " + keyName(keysOf("flash")[0]) + " mid-run for a half-second dodge" : "A half-second i-frame dodge you trigger on demand", act: function () { S.flashOn = !S.flashOn; save(); sfx("buy"); settings(g, 2); } },
        { label: "Keyboard Controls", ico: "keys", sub: "Rebind any action", act: function () { controls(g, "key", 0); } },
        { label: "Controller Controls", ico: "pad", sub: "Rebind any action", act: function () { controls(g, "pad", 0); } },
        { label: "Start Over", ico: "skull", sub: "Erase this wizard and everything they own", act: function () { MN(g, { kicker: "Start over", title: "Erase Everything?", sub: "Your wizard, gear, currencies and progress are deleted on this device, and on your account at the next sync. This can't be undone.",
          items: [{ label: "Keep My Wizard", cls: "is-primary", act: function () { settings(g, 5); } }, { label: "Erase And Start Over", act: function () { var kb = S.binds, pb = S.pad; S = fresh(); S.binds = kb; S.pad = pb; fillCh(); save(); title(g); } }], back: function () { settings(g, 5); } }); } },
        { label: "Back", act: function () {  hub(g, 4); } }
      ] });
  }
  function controls(g, kind, focus) {
    UI.scene = "hub"; UI.menu = "controls"; UI.bind = null;
    var items = ACTS.map(function (a, i) { return { label: a[1], sub: bindsOf(kind, a[0]).map(function (c) { return bindLabel(kind, c); }).join("  ·  "), act: function () { bindEdit(g, kind, a[0], i); } }; });
    items.push({ label: "Reset To Defaults", act: function () { if (kind === "key") S.binds = {}; else S.pad = {}; save(); controls(g, kind, items.length - 2); } });
    items.push({ label: "Back", act: function () { settings(g, kind === "key" ? 3 : 4); } });
    MN(g, { cls: "is-side is-wide", kicker: "Settings", title: kind === "key" ? "Keyboard Controls" : "Controller Controls", sub: "Select an action to manage its binds (up to 3 each). Esc and P stay as pause.", grid: true, items: items, focus: focus, back: function () { settings(g, kind === "key" ? 3 : 4); } });
  }
  function bindEdit(g, kind, a, i) {
    UI.scene = "hub"; UI.menu = "controls"; UI.bind = null;
    var name = (ACTS.filter(function (x) { return x[0] === a; })[0] || ["", a])[1];
    var cur = bindsOf(kind, a), many = cur.length > 1;
    var items = cur.map(function (c) { return { label: bindLabel(kind, c), ico: kind === "key" ? "keys" : "pad",
      sub: many ? "Select to remove" : "The only bind — add another before removing", act: function () { if (many) { removeBind(kind, a, c); sfx("rem"); bindEdit(g, kind, a, i); } else g.toast("Keep at least one bind"); } }; });
    if (cur.length < 3) items.push({ label: "Add a bind", ico: kind === "key" ? "keys" : "pad", cls: "is-primary", sub: "Press a " + (kind === "key" ? "key" : "button") + " to add it", act: function () { UI.scene = "rebind"; UI.bind = { a: a, kind: kind, ei: i, name: name }; g.closeMenu(); g.paint(); g.wake && g.wake(); } });
    items.push({ label: "Back", act: function () { controls(g, kind, i); } });
    MN(g, { cls: "is-side is-wide", kicker: name, title: name + " Binds", sub: "Up to 3 " + (kind === "key" ? "keys" : "buttons") + " for this action.", grid: true, items: items, back: function () { controls(g, kind, i); } });
  }
  function captureBind(code) {
    var b = UI.bind; if (!b) return; UI.scene = "hub";
    if (code) { addBind(b.kind, b.a, code); sfx("buy"); }
    bindEdit(G, b.kind, b.a, b.ei || 0);
  }
  function how(g) {
    UI.scene = "hub"; UI.menu = "how";
    MN(g, { cls: "is-side is-wide", kicker: "Wizard of the Sprint", title: "How To Play", back: function () { hub(g, 5); },
      body: el("div", { class: "ak-panel__body" },
        el("p", { text: "You run on your own. Jump with " + keyName(keysOf("jump")[0]) + " and hold it to glide. Your jump is pitiful at first: it reaches low and middle platforms, and you climb to the high ones from a middle one. " + keyName(keysOf("drop")[0]) + " drops you through a platform." }),
        el("p", { text: "Incantations do the fighting. Magick Poof casts by itself; keyed ones use " + keyName(keysOf("c1")[0]) + ". Kills raise an Incantation's mastery." }),
        el("p", { text: "You start with 10 HP and most hits do 10, so one hit ends a run until you add Vitality or Confidence. You keep everything you collected either way." }),
        el("p", { text: "Illusion Flash (" + keyName(keysOf("flash")[0]) + ") blinks you out for about half a second, long enough to dodge a hit. It then needs a few seconds to recharge. Turn it off in Settings if you'd rather not have it." }),
        el("p", { text: "Remnants buy upgrades. A Whisper Orb fires your buff for 10 seconds. Grimoires are rare, and 10 of them buy a revive. Enemies sometimes drop Wizard Drip: wear it from Equipment." }),
        el("p", { text: "Press " + keyName(keysOf("five")[0]) + " as you pass a friendly for a high five. Clear the forest's boss to unlock the Condenser, the Armoire and Endless mode." })),
      items: [{ label: "Back", cls: "is-primary", act: function () { hub(g, 5); } }] });
  }
  function conflict(g) {
    var c = store.get(SKEY + ".conflict", null); if (!c) return false;
    MN(g, { kicker: "Save sync", title: "Two Saves, One Wizard", cls: "is-wide",
      sub: "This wizard was played on two devices that hadn't synced with each other. The newer save was kept (" + (c.kept === "account" ? "the one from your account" : "the one on this device") + "). The older one is stored as a backup.",
      items: [
        { label: "OK, Keep The Newer Save", cls: "is-primary", act: function () { store.set(SKEY + ".conflict", false); title(g); } },
        { label: "Use The Older Backup Instead", act: function () { var bk = store.get(SKEY + ".backup", null), cur = store.get(SKEY, null); if (bk) { store.set(SKEY + ".backup", cur); store.set(SKEY, bk); load(); save(); } store.set(SKEY + ".conflict", false); title(g); } }
      ] });
    return true;
  }
  function title(g) {
    applyStory();
    G = g; if (R && !R.over && UI.scene === "run") { bankRun(); g.toast("Run ended. You keep what you picked up."); }
    UI.scene = "hub";
    if (conflict(g)) return;
    if (!S.made) { creator(g, 0, function () { S.made = true; save(); UI.scene = "hub"; panels(g, WS.lines("open"), "Wizard of the Sprint", function () { hub(g, 0); }); }); return; }
    hub(g, 0);
  }

  /* ---------------- register ---------------- */
  load();
  var DEF = {
    id: "wizard-sprint", name: "Wizard of the Sprint", icon: "🧙", accent: "#8f6bff", W: W, H: H, order: 0.5, badge: "Beta",
    tags: ["Runner", "RPG loot", "Campaign"],
    tagline: "A robbed arch-wizard chases the thief's footprints through the forest. Run, jump, cast, loot, and rebuild your tower.",
    about: "A left-to-right runner with Incantation combat and loot. Build your wizard, follow the tracks through the forest, fight with Incantations that level up as you use them, pick up Wizard Drip in six rarities, and spend Remnants on upgrades back at your ruined tower. This is the first level: clear its boss to unlock the shop, the wardrobe and Endless mode. More levels are on the way.",
    controls: [["Jump, hold to glide", "Space, W or Up (A)"], ["Drop through a platform", "S or Down"], ["Illusion Flash (dodge)", "Shift (LB)"], ["Keyed Incantation", "J (X)"], ["High five", "F (RB)"], ["Run pace", "1 and 2 (LT, RT)"], ["Pause", "Esc, P or Start"], ["Rebind", "Settings, inside the game"]],
    stats: function () { return [["Wiz Level", S.lvl], ["Forest", S.cleared[1] ? "Cleared" : "Not cleared yet"], ["Best Endless", fmt(S.best.endless1 || 0) + " m"], ["Remnants", fmt(S.rem)], ["Incantations", Object.keys(S.inc).length + " / 20"], ["Enemies defeated", fmt(S.cnt.kills || 0)]]; },
    poster: function (x, w, h, t) { drawForest(t * 150, t); wizSprite(lookOf(true), "run", t); blitWiz(b, 200, GY, 1); px(330 - (t * 40 % 60), GY - 12, 14, 10, "#7a5536"); drawFore(t * 150); x.imageSmoothingEnabled = false; x.drawImage(BUF, 0, 0, w, h); },
    blurb: "Run, cast and loot your way after whoever robbed your tower.",
    sync: [{ k: "save", s: SKEY, t: "newest" }],
    onSync: function (g) { load(); if (g.state === "title" && UI.scene === "hub" && g.menuOpen()) title(g); },
    init: function (g) { G = g; registerHatch(); g.debug = { S: function () { return S; }, R: function () { return R; }, UI: UI, start: function (m) { startRun(g, m || "story"); }, save: save, load: load, calc: calc, makeItem: makeItem, giveInc: giveInc, step: function (n, dt) { for (var i = 0; i < n && R && !R.over; i++) update(g, dt); }, endRun: endRun, wiz: wizSprite, look: lookOf, WC: WC, wreckOf: wreckOf }; },
    title: title,
    update: update,
    idle: hubIdle,
    rawKey: function (g, e) {
      if (UI.scene !== "rebind" || !UI.bind) return false;
      if (e.code === "Escape") { captureBind(null); return true; }
      if (UI.bind.kind !== "key") return true;
      if (e.code === "KeyP" || /^(Meta|Control|Alt|OS)/.test(e.code)) { g.toast("That key is reserved"); return true; }
      captureBind(e.code); return true;
    },
    pointer: function (g, type, x, y, e) {
      if (e && e.pointerType === "touch") touchUI = true;
      if (g.state !== "play" || !R) return;
      if (type === "up") { R.touchHeld.jump = false; R.touchHeld.drop = false; R.touchZone = null; return; }
      if (type !== "down") return;
      if (!touchUI) { R.tap = true; return; }              /* desktop: tap anywhere jumps, as before */
      var z = hitTouchZone(x, y);
      if (z === "flash") R.touchHit.flash = true;
      else if (z === "drop") { R.touchHeld.drop = true; R.touchZone = "drop"; }
      else if (z && z.charAt(0) === "c") R.touchHit[z] = true;
      else { R.tap = true; R.touchHeld.jump = true; R.touchZone = "jump"; }   /* jump button or open area */
    },
    backdropClick: function (g, x, y) { hubClick(g, x, y); },
    restart: function (g) { if (R) startRun(g, R.mode); },
    pauseTheme: true,
    draw: function (g, ctx) {
      if (R && (g.state === "play" || g.state === "paused" || g.state === "over") && UI.scene === "run") { drawRun(g, ctx); return; }
      if (UI.scene === "creator") { drawCreator(g, ctx); return; }
      if (UI.scene === "equip") { drawEquipScene(g, ctx); menuHud(ctx); return; }
      if (UI.scene === "prep") { drawPrepScene(g, ctx); menuHud(ctx); return; }
      if (UI.scene === "bag") { drawBagScene(g, ctx); menuHud(ctx); return; }
      drawHubScene(g, ctx);
      if (UI.scene === "hub" && UI.menu !== "settings" && UI.menu !== "controls") menuHud(ctx);
      if (UI.scene === "rebind" && UI.bind) {
        ctx.fillStyle = "rgba(4,8,14,.78)"; ctx.fillRect(0, 0, W, H);
        D.text(ctx, "Press a " + (UI.bind.kind === "key" ? "key" : "controller button") + " for", W / 2, H / 2 - 30, "600 26px " + F.display, "#b9c2cd", "center");
        D.text(ctx, UI.bind.name, W / 2, H / 2 + 22, "700 48px " + F.display, "#fff", "center");
        D.text(ctx, "Esc cancels", W / 2, H / 2 + 70, "500 18px " + F.mono, "#b9c2cd", "center");
      }
    }
  };
  /* ---------- Maintenance Hatch: live balance tunables (owner-edited on /arcade/, applied for every player) ---------- */
  function balanceEditor(pane, api) {
    var cur = {}, saved = api.get() || {};
    TUNEDEF.forEach(function (t) { var v = Number(saved[t.k]); cur[t.k] = (isFinite(v) && v > 0) ? clamp(v, t.lo, t.hi) : 1; });
    function pushVal() { var out = {}; TUNEDEF.forEach(function (t) { if (Math.abs(cur[t.k] - 1) > 1e-4) out[t.k] = cur[t.k]; }); api.set(out); }
    var root = el("div", { class: "wzh" });
    root.appendChild(el("p", { class: "wzh-note", text: "Each slider multiplies the built-in value — 1.00× is default. Saving changes the game for every player." }));
    TUNEDEF.forEach(function (t) {
      var val = el("b", { class: "wzh-val" }), slider = el("input", { class: "wzh-range", type: "range", min: String(t.lo), max: String(t.hi), step: "0.05", value: String(cur[t.k]), "aria-label": t.n });
      var reset = el("button", { class: "wzh-reset", type: "button", title: "Reset to 1.00×", text: "Reset" });
      var row = el("div", { class: "wzh-row" },
        el("div", { class: "wzh-meta" }, el("strong", { text: t.n }), el("span", { class: "wzh-desc", text: t.d })),
        el("div", { class: "wzh-ctl" }, slider, val, reset));
      function paint() { val.textContent = cur[t.k].toFixed(2) + "×"; slider.value = String(cur[t.k]); if (row.classList) row.classList.toggle("is-set", Math.abs(cur[t.k] - 1) > 1e-4); }
      slider.addEventListener("input", function () { cur[t.k] = clamp(Number(slider.value) || 1, t.lo, t.hi); paint(); pushVal(); });
      reset.addEventListener("click", function () { cur[t.k] = 1; paint(); pushVal(); });
      root.appendChild(row); paint();
    });
    pane.appendChild(root);
  }
  var hatchDone = false;
  function registerHatch() {
    if (hatchDone || !window.Site || !Site.hatch || typeof Site.hatch.register !== "function") return;
    hatchDone = true;
    Site.hatch.register({
      id: "arcade-wizard-balance", page: "arcade", label: "Wizard — balance tunables",
      render: function (pane, api) { try { balanceEditor(pane, api); } catch (e) {} },
      load: function (value) { try { TUNE = sanitizeTune(value); } catch (e) { TUNE = {}; } }
    });
  }
  try { if (window.Site && Site.on) Site.on("hatch:ready", registerHatch); } catch (e) {}
  registerHatch();
  /* Public beta: the owner-only preview gate was lifted on the owner's go-ahead. The card is badged Beta. */
  A.register(DEF);
})();
