/* arcade/wizard-sprint.js — "Wizard of the Sprint": a left-to-right runner with spell combat, loot and a hub that rebuilds.
 *
 * This file is the level 1 slice: the character creator, the ruined tower hub (Prep Time, Equipment, Settings, then the
 * Magickal Condenser and the Wizard Drip Armoire once the forest is cleared), the forest's five-minute first run with its
 * boss, Endless mode afterwards, six Incantations with mastery, the Gust Step buff, gear drops with rarities and stats,
 * the bag, Wiz Level, in-run challenges, rebindable controls and one whole-save record that syncs to the account
 * (newest save wins; the other is kept as a backup and the player is told).
 * Everything is drawn in code on a 640 x 360 pixel buffer and scaled up crisp. Sound is synthesised.
 * Story text in STORY / CHAT is placeholder: the director writes the final lines.
 */
(function () {
  "use strict";
  if (!window.Site || !window.Arcade) return;
  var Site = window.Site, A = window.Arcade, D = A.draw, F = A.FONT, el = Site.el, store = Site.store;
  if (((Site.config && Site.config.features) || {}).game404 === false) return;

  var W = 1280, H = 720, BW = 640, BH = 360, GY = 292, WX = 150, M = 16, BASE = 170, GRAV = 1400, TAU = Math.PI * 2;
  var SKEY = "arcade.wizard-sprint.save";
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
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
  var STORY = {
    open: [
      "{Name} the All-Knowing had nothing left to learn, nobody worth fearing, and nobody worth caring about. So {Name} took a nap. A long, magickal one.",
      "SNAP.  FLASH.  BOOM.",
      "Morning. The tomes: gone. The robes: shredded. The wands, swords and bows: missing or melted. There is a hole in the tower where the library used to be.",
      "{Name} is wearing a sleep cap, a stained tunic and some deeply questionable skivvies. In the mud by the hole is a trail of footprints.",
      "For the first time in centuries, {Name} is afraid. And furious. And... motivated?"
    ],
    clear1: [
      "Your hat, back from a mud imp! The tracks lead on, toward a tavern.",
      "Back home it is still raining through the roof you do not have. You hold a soggy scroll over your head. It's a start."
    ]
  };
  var CHAT = {
    early: ["I used to have SO many hats.", "Running. Me. Disgusting.", "Whoever did this is getting a strongly worded hex.", "My feet are touching MUD."],
    cheer: ["Go get 'em, weird old wizard!", "Nice jammies!", "Run, wizard, run!"],
    reply: ["Uh... thanks?", "You were, though.", "Apology noted."],
    five: ["Up high!", "Yes! Contact!", "Nailed it."],
    rescue: ["You're safe. Don't make it weird.", "Fine. FINE. You're welcome."],
    hit: ["Ow, my dignity.", "That's going in my diary."],
    orb: ["Ooh, that tingles. I remember tingles."],
    grim: ["MY BOOK! ...wait, not mine. Mine now."],
    satchel: ["Somebody's mail is late. Too bad."],
    boss: ["Oh, you're big. I hate that.", "Is that MY HAT?"]
  };

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
      inc: { poof: { k: 0 } }, incEq: ["poof"], buffs: {}, buffEq: [], ranks: {}, bag: [], eq: starter(), bagCap: 12, speed: 1,
      binds: {}, pad: {}, snd: true, vol: 0.7, comfort: false, cos: {}, cnt: {}, best: {}, ch: [], shop: { slot: 0, items: [] }, nid: 10 };
  }
  function load() {
    var s = store.get(SKEY, null), f = fresh(); S = f;
    if (s && typeof s === "object") for (var k in s) if (s[k] != null) S[k] = s[k];
    ["wiz", "cleared", "story", "inc", "buffs", "ranks", "eq", "binds", "pad", "cos", "cnt", "best", "shop"].forEach(function (k) { if (!S[k] || typeof S[k] !== "object" || Array.isArray(S[k])) S[k] = fresh()[k]; });
    ["incEq", "buffEq", "bag", "ch"].forEach(function (k) { if (!Array.isArray(S[k])) S[k] = fresh()[k]; });
    for (var w in f.wiz) if (S.wiz[w] == null) S.wiz[w] = f.wiz[w];
    if (!S.inc.poof) S.inc.poof = { k: 0 };
    if (!S.incEq.length) S.incEq = ["poof"];
    fillCh();
  }
  function save() { S.ts = Date.now(); store.set(SKEY, S); }
  function cnt(k, n) { S.cnt[k] = (S.cnt[k] || 0) + n; }
  function fillCh() {
    S.ch = S.ch.filter(function (c) { return c && chDef(c.id); });
    while (S.ch.length < 3) { var pool = CH.filter(function (c) { return !S.ch.some(function (a) { return a.id === c.id; }); }); S.ch.push({ id: pick(pool).id, p: 0 }); }
  }

  /* ---------------- stats, levels, items ---------------- */
  function calc() {
    var t = {}; SK.forEach(function (k) { t[k] = (S.ranks[k] || 0) * STAT[k].rank; });
    Object.keys(S.eq).forEach(function (s) { var it = S.eq[s]; if (it) (it.l || []).forEach(function (l) { t[l[0]] += l[1]; }); });
    SK.forEach(function (k) { t[k] = Math.min(STAT[k].cap, r1(t[k])); });
    t.hp = 10 + t.vit; t.jump = 70 * Math.pow(1.06, S.ranks.jump || 0); t.glide = 260 * Math.pow(0.92, S.ranks.glide || 0);
    return t;
  }
  function xpNeed(l) { return Math.round(100 * Math.pow(l, 1.4)); }
  function addXP(n, g) {
    S.xp += Math.round(n);
    while (S.lvl < 100 && S.xp >= xpNeed(S.lvl)) {
      S.xp -= xpNeed(S.lvl); S.lvl++;
      if (g) { g.toast("Wiz Level " + S.lvl, "gold"); if (UNLOCK[S.lvl]) g.toast("Unlocked: " + UNLOCK[S.lvl], "gold"); }
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
  var ACTS = [["jump", "Jump / Hold To Glide"], ["drop", "Drop Through Platform"], ["c1", "Incantation 1"], ["c2", "Incantation 2"], ["c3", "Incantation 3"], ["five", "High Five"], ["slow", "Run Slower"], ["fast", "Run Faster"]];
  var DEFK = { jump: ["Space", "KeyW", "ArrowUp"], drop: ["KeyS", "ArrowDown"], c1: ["KeyJ"], c2: ["KeyK"], c3: ["KeyL"], five: ["KeyF"], slow: ["Digit1"], fast: ["Digit2"] };
  var DEFP = { jump: "a", drop: "down", c1: "x", c2: "y", c3: "b", five: "rb", slow: "lt", fast: "rt" };
  function keysOf(a) { return S.binds[a] ? [S.binds[a]] : DEFK[a]; }
  function padOf(a) { return S.pad[a] || DEFP[a]; }
  function keyName(c) { return c.replace(/^Key|^Digit/, "").replace(/^Arrow/, "Arrow ").replace("Space", "Space"); }
  function isDown(g, a) {
    var ks = keysOf(a); for (var i = 0; i < ks.length; i++) if (g.key(ks[i])) return true;
    if (g.pad && g.pad.btn[padOf(a)]) return true;
    return a === "drop" && g.pad && g.pad.ly > 0.6;
  }
  function isHit(g, a) {
    var ks = keysOf(a); for (var i = 0; i < ks.length; i++) if (g.hit(ks[i])) return true;
    return !!(g.pad && g.pad.hit[padOf(a)]);
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
        SND.noise = buf;
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
  function sfx(k) {
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
    else if (k === "loot") { tone("square", 660, 0, 0.08, 0.12); tone("square", 990, 0, 0.14, 0.12, 0.08); }
    else if (k === "five") { noise("highpass", 1500, 3000, 0.05, 0.3); }
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
  function lookOf(comfort) {
    var eq = comfort ? starter() : S.eq;
    function col(it) {
      if (!it) return null;
      if (it.st) return { c1: "#e6e3dc", c2: "#8f8f96", st: 1, k: it.k };
      return { c1: hslHex(it.h || 0, 42, 44), c2: it.r === 5 ? "rb" : RAR[it.r].c, k: it.k };
    }
    var sims = []; for (var i = 1; i <= 6; i++) if (eq["sim" + i]) sims.push(col(eq["sim" + i]));
    return { a: S.wiz, head: col(eq.head), chest: col(eq.chest), legs: col(eq.legs), feet: col(eq.feet), hands: col(eq.hands), main: col(eq.main), off: col(eq.off),
      waist: col(eq.waist), neck: col(eq.neck), shoulder: col(eq.shoulder), back: col(eq.back), sims: sims, hat: !!(S.cos.hat && S.cos.hatOn) };
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
    var a = L.a, cx = 30, fy = 84, big = a.shape > 0.62, lth = big ? 4 : 3, ath = big ? 3 : 2, i;
    var leg = 14 + Math.round(4 * a.height), tor = 16 + Math.round(4 * a.height), tw = 4 + Math.round(5 * a.shape);
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
    var legC = L.legs ? L.legs.c1 : "#d8d4cc", legLong = !!(L.legs && !L.legs.st && L.legs.k > 0), shoe = L.feet ? L.feet.c1 : null;
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
      if (a.shape > 0.5 && i > torL * 0.35 && i < torL * 0.85) front = a.shape > 0.85 ? 2 : 1;
      P(cx + xo - Math.max(2, hw), sy + i, Math.max(2, hw) * 2 + front, 1, cc);
    }
    if (L.chest) {
      P(cx - tw, hipY, tw * 2, 3, cc); P(cx - tw, hipY + 2, tw * 2, 1, rc(L.chest));
      if (L.chest.st) { P(cx + lean, sy + 6, 2, 2, "#b9b29e"); P(cx - 3 + lean, sy + 4, 1, 1, "#a9a290"); P(cx - 2, sy + 11, 1, 1, skin); P(cx + 2, sy + 13, 2, 1, skin); }
      else P(cx + lean - 1, sy + 1, 2, torL - 2, rc(L.chest));
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
    if (bd === 7) { P(hx - hwm, T + 4, 2, 7, hairC); P(hx + hwm - 2, T + 7, 2, 4, hairC); }
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
    /* middle trees */
    var mo = dist * 0.45;
    for (i = Math.floor(mo / 90) - 1; i < Math.floor((mo + BW) / 90) + 2; i++) {
      x = i * 90 + hash(i * 3.1) * 40 - mo; var th = 120 + hash(i * 7.7) * 50;
      px(x + 14, GY - th + 30, 10, th, "#4a3524"); px(x + 16, GY - th + 30, 3, th, "#5c4530");
      px(x - 8, GY - th - 10, 54, 46, "#2f6b3d"); px(x, GY - th - 24, 38, 18, "#2f6b3d"); px(x - 2, GY - th - 2, 26, 14, "#3c8049"); px(x + 20, GY - th + 12, 22, 12, "#27593a");
    }
    for (x = -(dist % 6); x < BW; x += 6) { var g0 = Math.floor((x + dist) / 6); px(x, GY - 3 - (hash(g0) * 4 | 0), 6, 8, hash(g0 + 2) > 0.5 ? "#3f8a3f" : "#357a38"); if (hash(g0 * 1.7) > 0.93) { px(x + 2, GY - 9, 2, 2, hash(g0) > 0.5 ? "#ffd76b" : "#ff8fb0"); } }
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
  /* the tower: a boxy house with the tower on its left, a hole blown in the side, and no roof (stage 0 and 1) */
  var HOX = 170, SPOT = { crate: 300, read: 262, dig: 392, prep: 452, equip: 350, condenser: 138, armoire: 232 };
  function drawHub(t, stage) {
    var i, x;
    for (i = 0; i < 9; i++) px(-HOX, i * 40, BW + HOX, 40, ["#3a4658", "#414e61", "#49566a", "#515f73", "#5a687c", "#627085", "#627085", "#627085", "#627085"][i]);
    for (x = -HOX - 6; x < BW; x += 8) { var c0 = x / 8, hh = 30 + hash(c0 + 40) * 28 + Math.sin(c0 * 0.4) * 8; px(x, 230 - hh, 8, hh + 80, "#2c4a3c"); }
    px(-HOX, 300, BW + HOX, 60, "#4c3d2b"); px(-HOX, 300, BW + HOX, 2, "#5d4c36");
    for (x = -HOX; x < BW; x += 6) if (hash(x + 700) > 0.5 && (x < 186 || x > 470)) px(x, 296 - (hash(x + 1) * 3 | 0), 6, 5, "#2f5d36");
    /* back wall of the house, and the tower above its left half */
    px(196, 170, 266, 130, "#3b3944"); px(206, 44, 92, 130, "#3b3944");
    for (i = 0; i < 40; i++) { var bx = 200 + hash(i * 3) * 250, by = 176 + hash(i * 7) * 116; px(bx, by, 12, 5, "#45434f"); }
    for (i = 0; i < 16; i++) px(210 + hash(i * 5) * 78, 50 + hash(i * 9) * 116, 12, 5, "#45434f");
    px(236, 80, 14, 22, "#1c2230"); px(238, 82, 10, 18, "#55647a");                 /* tower window */
    /* the hole in the tower's side, and the jagged top where the roof was */
    for (i = 0; i < 12; i++) { px(262 + i * 3, 96 + Math.abs(i - 5) * 4, 3, 52 - Math.abs(i - 5) * 8, "#55647a"); }
    for (i = 0; i < 12; i++) px(206 + i * 8, 44 - (hash(i * 2.2) * 12 | 0), 8, 14, i % 3 ? "#3b3944" : "#515f73");
    for (i = 0; i < 34; i++) px(196 + i * 8, 170 - (hash(i * 1.3) * 9 | 0), 8, 10, (i < 13) ? "#3b3944" : (hash(i) > 0.4 ? "#3b3944" : "#515f73"));
    /* side walls: the left one stands, the right one is mostly gone */
    px(190, 150, 10, 150, "#5a5866"); px(190, 250, 10, 50, "#2a2832");
    for (i = 0; i < 9; i++) px(456 + (hash(i) * 6 | 0), 300 - i * 9 - 9, 12 - i, 9, "#5a5866");
    px(430, 292, 30, 8, "#5a5866"); px(470, 294, 16, 6, "#4d4b58"); px(492, 296, 9, 4, "#5a5866"); px(408, 295, 12, 5, "#4d4b58");
    /* what is left inside */
    px(SPOT.crate - 4, 291, 20, 9, "#7a5a3a"); px(SPOT.crate - 4, 291, 20, 2, "#8f6d48"); px(SPOT.crate + 5, 291, 2, 9, "#5c4530");
    px(SPOT.equip - 12, 288, 24, 12, "#6b4a2e"); px(SPOT.equip - 12, 288, 24, 3, "#8a6a44"); px(SPOT.equip - 1, 291, 3, 3, "#f0c23a");
    px(SPOT.dig - 4, 292, 30, 8, "#4d4b58"); px(SPOT.dig + 2, 287, 14, 6, "#5a5866"); px(SPOT.dig + 10, 290, 6, 3, "#efe2b8"); px(SPOT.dig - 2, 294, 5, 2, "#8a3f22");
    px(250, 282, 5, 18, "#5c4530"); px(246, 296, 14, 4, "#5c4530"); px(244, 280, 16, 3, "#7a5a3a"); px(247, 277, 8, 3, "#efe2b8");   /* a lectern with a scroll */
    px(404, 262, 14, 30, "#2b3340"); px(405, 263, 12, 28, "#6d7f96"); px(409, 263, 1, 12, "#2b3340"); px(410, 274, 5, 1, "#2b3340");   /* the cracked mirror */
    if (stage >= 1) {
      px(SPOT.armoire - 16, 252, 26, 48, "#5c4530"); px(SPOT.armoire - 14, 254, 10, 44, "#7a5a3a"); px(SPOT.armoire - 2, 254, 10, 44, "#7a5a3a"); px(SPOT.armoire - 5, 276, 2, 3, "#f0c23a"); px(SPOT.armoire - 1, 276, 2, 3, "#f0c23a");
      /* the caravan that rolls up outside */
      x = SPOT.condenser - 60;
      px(x, 262, 64, 30, "#7b2f3e"); px(x, 258, 64, 5, "#f0c23a"); px(x + 4, 248, 56, 10, "#5e1826"); px(x + 8, 268, 20, 14, "#ffd76b"); px(x + 10, 270, 16, 10, "#3a2a1a");
      px(x + 40, 268, 14, 24, "#3a2a1a"); px(x + 6, 290, 12, 12, "#2a2018"); px(x + 9, 293, 6, 6, "#7a5a3a"); px(x + 46, 290, 12, 12, "#2a2018"); px(x + 49, 293, 6, 6, "#7a5a3a");
      px(x + 62, 266, 2, 8, "#3a2a1a"); px(x + 60, 274, 6, 6, Math.sin(t * 6) > 0 ? "#ffe58a" : "#ffd04a");
    }
    for (i = 0; i < 9; i++) { x = 436 + i * 20; px(x, 304 + (i % 2) * 5, 5, 2, "#33291c"); px(x + 5, 304 + (i % 2) * 5, 1, 1, "#33291c"); }   /* the tracks */
  }
  function drawRain(t) { for (var i = 0; i < 70; i++) { var x = (hash(i) * BW + t * 40) % BW, y = (hash(i + 50) * BH + t * (340 + hash(i) * 120)) % BH; px(x, y, 1, 5, "rgba(190,215,240,.5)"); } }

  /* ---------------- a run ---------------- */
  var R = null, G = null;
  function wxw() { return R.dist + WX; }
  function prog() { return R.mode === "story" && !S.cleared[1] ? clamp(R.dist / R.bossAt, 0, 1) : 1; }
  function say(s, at, dur) { R.bub = R.bub.filter(function (q) { return (q.at || null) !== (at || null); }); R.bub.push({ s: s, at: at || null, t: dur || 2.2 }); }
  function chEv(ev, n) {
    for (var i = 0; i < S.ch.length; i++) {
      var c = S.ch[i], d = chDef(c.id); if (d.ev !== ev) continue;
      c.p += n;
      if (c.p >= d.need) { R.xp += 100; R.rem += 25; G.toast("Challenge done: " + d.n + "  (+100 XP, +25 Remnants)", "gold"); sfx("loot"); cnt("ch", 1); S.ch.splice(i, 1); fillCh(); i--; }
    }
  }
  function startRun(g, mode) {
    if (R && !R.over) bankRun();
    var st = calc();
    S.ch.forEach(function (c) { if (chDef(c.id).run) c.p = 0; });
    R = { mode: mode, t: 0, dist: 0, y: GY, vy: 0, ground: true, plat: null, jumps: 0, dropT: 0, glide: false, hp: st.hp, maxhp: st.hp, inv: 0, st: st, look: lookOf(false),
      plats: [], rems: [], picks: [], haz: [], en: [], shots: [], eshots: [], fr: [], fx: [], bub: [], loot: [], cds: {},
      nx: 420, rem: 0, orbs: 0, grim: 0, kills: 0, xp: 0, buffT: 0, buffMax: 1, buff: null, ward: 0, thorn: 0, boss: null, bossN: 0, tough: 1, mAcc: 0,
      bossAt: (mode === "story" ? 300 : 390) * BASE, win: 0, over: false, revived: false, fiveT: 0, fiveWin: 0, shake: 0, mud: 0, chat: 5, tap: false,
      nextOrb: rnd(40, 60) * BASE, nextGrim: rnd(110, 170) * BASE, nextRes: rnd(60, 100) * BASE, alcAt: mode === "story" && !S.cos.alcove1 ? rnd(110, 150) * BASE : 1e12 };
    S.incEq.forEach(function (id) { R.cds[id] = { t: 0.8, ch: 3, r: 0 }; });
    UI.scene = "run"; cnt("runs", 1);
    g.start();
  }
  function speedNow() { return BASE * (1 + R.st.ton * S.speed / 100) * (R.buffT > 0 && R.buff === "gust" ? 1.25 : 1) * (R.mud > 0 ? 0.6 : 1); }

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
    if (x > R.nextOrb) { R.nextOrb = x + rnd(50, 75) * BASE; R.picks.push({ k: "orb", x: x + 120, y: GY - 44 }); coins(x + 30, GY - 14, 3, 22); R.nx = x + 260; return; }
    if (x > R.nextGrim) { R.nextGrim = x + rnd(120, 200) * BASE; plat(x + 40, 36, 70); plat(x + 144, 62, 70); R.picks.push({ k: "grim", x: x + 180, y: GY - 62 - 12 }); coins(x + 52, GY - 50, 3, 22); R.nx = x + 300; return; }
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
    R.hp -= n * (1 - R.st.con / 100); R.inv = 1.2; R.shake = 0.3; sfx("hit"); cnt("hits", 1);
    if (R.hp <= 0.01) { R.hp = 0; die(); } else say(pick(CHAT.hit));
  }
  function die() {
    var g = G; sfx("lose");
    if (!R.revived && S.grim + R.grim >= 10) {
      g.setState("over");
      g.menu({ kicker: "Down, not out", title: "Revive?", sub: "Spend 10 Grimoires to get back up with full HP. You have " + (S.grim + R.grim) + ".",
        items: [{ label: "Revive", sub: "10 Grimoires", cls: "is-primary", act: function () { var need = 10, a = Math.min(R.grim, need); R.grim -= a; S.grim -= need - a; R.revived = true; R.hp = R.maxhp; R.inv = 2.5; g.start(); } },
          { label: "End The Run", act: function () { endRun(false); } }] });
      return;
    }
    endRun(false);
  }
  function lootDrop(minR) { var it = makeItem(minR); R.loot.push(it); G.toast("Loot: " + it.n + "  (" + RAR[it.r].n + ")", it.r >= 2 ? "gold" : "info"); sfx("loot"); fxAdd("ring", wxw(), R.y - 20, { c: RAR[it.r].c }); }
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
    R.xp += 5 * (e.elite ? 3 : 1) * (e.gold ? 6 : 1); R.rem += e.gold ? 40 : 2; chEv("kill", 1); if (e.k === "imp") chEv("imp", 1);
    if (Math.random() < (e.gold ? 1 : e.elite ? 0.25 : 0.04)) lootDrop(e.gold ? 2 : 0);
  }
  function dmgOf(id) { return INC[id].dmg * (1 + R.st.pow / 100) * (1 + 0.08 * mlvl(id)); }
  function cdOf(id) { var c = INC[id].cd; if (id === "ward") c = mlvl(id) >= 6 ? 7 : mlvl(id) >= 3 ? 9 : 12; return c / (1 + R.st.flu / 100); }
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
      if (S.buffs.gust == null) { S.buffs.gust = 0; S.buffEq = ["gust"]; g.toast("New buff: Gust Step", "gold"); say(pick(CHAT.orb)); }
      var id = S.buffEq[0]; if (id) { R.buff = id; R.buffMax = 10 + R.st.ret + (S.buffs[id] || 0); R.buffT = R.buffMax; }
    } else if (pk.k === "grim") { R.grim++; cnt("grims", 1); sfx("grim"); if (Math.random() < 0.5) say(pick(CHAT.grim)); }
    else if (pk.k === "satchel") { sfx("grim"); say(pick(CHAT.satchel)); giveInc("ward", g); cnt("satchels", 1); }
    else if (pk.k === "alcove") { sfx("grim"); S.cos.alcove1 = true; giveInc("sneeze", g); g.toast("You found a lore alcove.", "gold"); }
    else if (pk.k === "cage") { sfx("win"); R.rem += 25; R.xp += 50; cnt("rescues", 1); chEv("rescue", 1); say(pick(CHAT.rescue)); fxAdd("ring", pk.x, pk.y - 8, { c: "#ffe58a" }); g.toast("Rescued a squirrel family  (+25 Remnants)", "gold"); }
  }

  function update(g, dt) {
    if (!R || R.over) return;
    dt = Math.min(dt, 0.05);
    var i, e, wx, sp = speedNow(), held = isDown(g, "jump") || g.pointer.down, pressed = isHit(g, "jump") || R.tap; R.tap = false;
    R.t += dt; R.dist += sp * dt; wx = wxw();
    R.mAcc += sp * dt / M; if (R.mAcc >= 1) { var mm = Math.floor(R.mAcc); R.mAcc -= mm; cnt("m", mm); chEv("m", mm); }
    if (R.st.ton > 0) { if (isHit(g, "slow")) { S.speed = clamp(S.speed - 0.25, 0, 1); g.toast("Pace " + Math.round(100 + R.st.ton * S.speed) + "%"); } if (isHit(g, "fast")) { S.speed = clamp(S.speed + 0.25, 0, 1); g.toast("Pace " + Math.round(100 + R.st.ton * S.speed) + "%"); } }
    /* movement */
    var jv = Math.sqrt(2 * GRAV * R.st.jump) * (R.mud > 0 ? 0.85 : 1), gust = R.buffT > 0 && R.buff === "gust", maxJ = gust ? ((S.buffs.gust || 0) >= 3 ? 3 : 2) : 1;
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
      if (R.vy >= 0 && R.dropT <= 0) for (i = 0; i < R.plats.length; i++) { var pl = R.plats[i]; if (wx >= pl.x - 4 && wx <= pl.x + pl.w + 4 && py <= pl.y + 1 && R.y >= pl.y) { R.y = pl.y; R.vy = 0; R.ground = true; R.plat = pl; R.jumps = 0; sfx("land"); chEv("plat", 1); break; } }
      if (R.y >= GY) { R.y = GY; R.vy = 0; if (!R.ground) sfx("land"); R.ground = true; R.plat = null; R.jumps = 0; }
    } else if (R.plat && (wx < R.plat.x - 4 || wx > R.plat.x + R.plat.w + 4)) { R.ground = false; R.plat = null; R.jumps = 1; }
    if (R.inv > 0) R.inv -= dt; if (R.shake > 0) R.shake -= dt; if (R.fiveT > 0) R.fiveT -= dt; if (R.buffT > 0) R.buffT -= dt;
    if (isHit(g, "five")) { R.fiveWin = 0.45; R.fiveT = 0.35; } if (R.fiveWin > 0) R.fiveWin -= dt;
    /* spawn */
    while (R.nx < R.dist + BW + 140) chunk();
    if (!R.boss && !R.win && R.dist >= R.bossAt) {
      e = { k: "boss", x: 0, sx: BW + 50, y: GY, w: 34, h: 40, hp: 150 * R.tough, st: "in", t: 0, n: 0, ht: 0, burn: 0, fl: 0 }; e.max = e.hp; R.en.push(e); R.boss = e; sfx("boss"); say(pick(CHAT.boss), null, 2.6);
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
      if (R.fiveWin > 0) { R.fiveT = 0.4; R.rem += 3; cnt("fives", 1); chEv("five", 1); sfx("five"); say(pick(CHAT.five)); }
      else if (Math.random() < 0.5) { say(pick(CHAT.cheer), f, 2); }
      else { cnt("sorry", 1); say("Sorry if I was ever a dick!"); f.reply = 0.9; }
    });
    R.fr.forEach(function (f) { if (f.reply > 0) { f.reply -= dt; if (f.reply <= 0) say(pick(CHAT.reply), f, 2); } });
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
    R.bub = R.bub.filter(function (q) { q.t -= dt; return q.t > 0; });
    R.chat -= dt; if (R.chat <= 0 && !R.boss) { R.chat = rnd(16, 28); if (!R.bub.length) say(pick(CHAT.early)); }
    if (R.win > 0) { R.win -= dt; if (Math.random() < 0.5) R.rems.push({ x: wx + rnd(60, 300), y: GY - rnd(10, 70) }); if (R.win <= 0) endRun(true); }
  }

  function bankRun() {                                  /* whatever happens to a run, you keep what you picked up */
    var o = { m: Math.floor(R.dist / M), l0: S.lvl, sold: 0, kept: 0 }; o.xp = Math.round(R.xp + o.m / 10);
    R.over = true;
    S.rem += R.rem; S.orbs += R.orbs; S.grim += R.grim; cnt("rem", R.rem);
    R.loot.forEach(function (it) { if (S.bag.length < S.bagCap) { S.bag.push(it); o.kept++; } else { S.rem += sellPrice(it); o.sold++; } });
    var bk = R.mode === "story" ? "story1" : "endless1"; if (o.m > (S.best[bk] || 0)) S.best[bk] = o.m;
    addXP(o.xp, G); save(); return o;
  }
  function endRun(win) {
    var g = G, first = win && !S.cleared[1], o = bankRun(), m = o.m, xp = o.xp, l0 = o.l0, sold = o.sold, kept = o.kept, i;
    var extra = [];
    if (first) { S.cleared[1] = true; S.tower = 1; S.cos.hat = true; giveInc("snaps", null); extra.push("New Incantation: Spark Snaps", "Your favorite hat is back (wear it at the Armoire)", "Unlocked: Magickal Condenser, Wizard Drip Armoire, Endless mode"); }
    save(); g.setState("over"); if (!win) { /* the lose jingle already played */ }
    var kv = el("div", { class: "ak-kv" });
    function row(k, v) { kv.appendChild(el("span", { text: k })); kv.appendChild(el("b", { text: String(v) })); }
    row("Distance", fmt(m) + " m"); row("Enemies defeated", R.kills); row("Remnants", "+" + fmt(R.rem)); row("Whisper Orbs", "+" + R.orbs); row("Grimoires", "+" + R.grim);
    row("Wiz XP", "+" + fmt(xp) + (S.lvl > l0 ? "  (now Wiz Level " + S.lvl + ")" : "")); row("Loot", kept + " to the bag" + (sold ? ", " + sold + " sold (bag full)" : ""));
    for (i = 0; i < extra.length; i++) row(i === 0 ? "Rewards" : "", extra[i]);
    g.menu({ kicker: R.mode === "story" ? "Magickal Mad Dash · The Forest Around the Tower" : "Endless · The Forest Around the Tower",
      title: win ? "Forest Cleared" : "Flattened at " + fmt(m) + " m", sub: win ? "The Grand Mud Imp drops your hat and runs." : "You keep everything you picked up.", body: kv, cls: "is-wide",
      items: [
        first ? { label: "Continue", cls: "is-primary", act: function () { panels(g, STORY.clear1, "After the forest", function () { g.toTitle(); }); } }
              : { label: "Run It Again", cls: "is-primary", act: function () { startRun(g, R.mode); } },
        first ? null : { label: "Back To The Tower", act: function () { g.toTitle(); } }
      ] });
  }

  /* ---------------- drawing a run ---------------- */
  function drawEnemy(e, d, t) {
    var x = Math.round(e.x - d), y = Math.round(e.y), fl = e.fl > 0, c;
    if (e.elite || e.gold) px(x - e.w / 2 - 2, y - e.h - 2, e.w + 4, e.h + 3, e.gold ? "rgba(255,215,90,.55)" : "rgba(255,120,90,.45)");
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
    if (e.burn > 0) { px(x - 3, y - e.h - 5 - (Math.sin(t * 20) > 0 ? 1 : 0), 3, 4, "#ff9a2e"); px(x + 1, y - e.h - 3, 2, 3, "#ffd76b"); }
    if (e.k !== "boss" && e.hp < e.max) { px(x - 8, y - e.h - 8, 16, 2, "#2a1a14"); px(x - 8, y - e.h - 8, Math.max(1, Math.round(16 * e.hp / e.max)), 2, "#ff5a5a"); }
  }
  function drawRun(g, ctx) {
    var d = R.dist, t = R.t, i, x, y, wx = WX;
    b.save(); if (R.shake > 0) b.translate(ri(-2, 2), ri(-1, 1));
    drawForest(d, t);
    R.haz.forEach(function (h) {
      x = Math.round(h.x - d);
      if (h.k === "mud") { px(x, GY, h.w, 5, "#3e2f1e"); px(x + 4, GY + 5, h.w - 8, 2, "#3e2f1e"); px(x + 10 + (Math.sin(t * 3) * 3 | 0), GY + 1, 3, 2, "#59432c"); px(x + h.w - 20, GY + 2, 2, 2, "#59432c"); }
      else if (h.k === "log") { var rot = Math.floor(h.t * 8) % 2; px(x - 8, GY - 16, 16, 16, "#7a5536"); px(x - 6, GY - 18, 12, 2, "#7a5536"); px(x - 6, GY, 12, 1, "#5c3f26"); px(x - 4 + rot * 2, GY - 12, 6, 6, "#a67c52"); px(x - 2 + rot * 2, GY - 10, 2, 2, "#7a5536"); }
      else { if (h.st < 2) { px(x - 11, GY + 1, 22, 2, "rgba(0,0,0,.28)"); px(x - 13, h.y - 4, 26, 6, "#5c4530"); px(x - 16, h.y - 8, 10, 6, "#2f6b3d"); px(x + 4, h.y - 9, 12, 7, "#3c8049"); if (h.st === 0 && Math.sin(t * 16) > 0) px(x - 2, h.y + 6, 2, 3, "#ffe58a"); }
        else { px(x - 14, GY - 8, 28, 8, "#5c4530"); px(x - 12, GY - 11, 9, 4, "#2f6b3d"); px(x + 6, GY - 10, 7, 3, "#3c8049"); } }
    });
    R.plats.forEach(function (p) { x = Math.round(p.x - d); px(x, p.y, p.w, 8, "#6b4a2e"); px(x, p.y, p.w, 3, "#5aa04a"); px(x + 2, p.y + 3, p.w - 4, 1, "#7d5a3a"); px(x + 4, p.y + 8, 5, 3, "#4a3524"); px(x + p.w - 9, p.y + 8, 5, 3, "#4a3524"); for (i = 0; i < p.w; i += 9) if (hash(p.x + i) > 0.5) px(x + i, p.y - 2, 3, 2, "#6bb85a"); });
    R.fr.forEach(function (f) {
      x = Math.round(f.x - d);
      if (f.k === "deer") { px(x - 11, GY - 22, 22, 10, "#a8763f"); px(x - 9, GY - 12, 3, 12, "#8a5f30"); px(x + 6, GY - 12, 3, 12, "#8a5f30"); px(x - 16, GY - 30, 8, 9, "#a8763f"); px(x - 15, GY - 35, 2, 6, "#e8d9b8"); px(x - 11, GY - 36, 2, 7, "#e8d9b8"); px(x - 15, GY - 27, 1, 1, "#1a1420"); px(x + 10, GY - 23, 3, 3, "#f4efe6"); }
      else if (f.k === "squirrel") { px(x - 4, GY - 9, 8, 8, "#a0562a"); px(x - 6, GY - 13, 6, 5, "#a0562a"); px(x + 3, GY - 15, 5, 12, "#c07a44"); px(x - 5, GY - 12, 1, 1, "#1a1420"); px(x - 4, GY - 1, 3, 1, "#7a3f1e"); }
      else { px(x - 4, GY - 20, 8, 13, "#7b6aa8"); px(x - 3, GY - 7, 3, 7, "#4a3a2a"); px(x + 1, GY - 7, 3, 7, "#4a3a2a"); px(x - 3, GY - 27, 7, 7, "#eabf98"); px(x - 5, GY - 29, 11, 3, "#c9a26b"); px(x - 9, GY - 14, 6, 6, "#a67c52"); px(x - 2, GY - 25, 1, 1, "#1a1420"); }
    });
    R.picks.forEach(function (p) {
      x = Math.round(p.x - d); y = Math.round(p.y + (p.k === "orb" || p.k === "grim" ? Math.sin(t * 4 + p.x) * 3 : 0));
      if (p.k === "orb") { px(x - 6, y - 9, 12, 6, "rgba(160,240,255,.35)"); px(x - 3, y - 12, 6, 12, "rgba(160,240,255,.35)"); px(x - 4, y - 10, 8, 8, "#7fe3ff"); px(x - 2, y - 8, 4, 4, "#fff"); }
      else if (p.k === "grim") { px(x - 5, y - 13, 11, 13, "#5b3aa8"); px(x - 5, y - 13, 2, 13, "#3d2575"); px(x - 1, y - 9, 4, 4, "#f0c23a"); px(x - 3, y - 1, 9, 1, "#efe2b8"); }
      else if (p.k === "satchel") { px(x - 7, y - 9, 14, 9, "#8a5a2b"); px(x - 7, y - 9, 14, 4, "#6b4420"); px(x - 1, y - 6, 2, 2, "#f0c23a"); px(x - 4, y - 12, 8, 3, "#efe2b8"); }
      else if (p.k === "alcove") { px(x - 9, y - 26, 18, 26, "#4a3524"); px(x - 6, y - 22, 12, 22, Math.sin(t * 5) > 0 ? "#ffd76b" : "#ffe9a8"); px(x - 6, y - 24, 12, 2, "#2f6b3d"); px(x - 2, y - 14, 4, 6, "#5b3aa8"); }
      else if (p.k === "cage") { px(x - 9, y - 16, 18, 16, "#3a2a1a"); px(x - 7, y - 14, 14, 13, "#1c1410"); px(x - 3, y - 8, 6, 7, "#a0562a"); px(x - 2, y - 7, 1, 1, "#fff"); for (i = 0; i < 4; i++) px(x - 7 + i * 4, y - 14, 1, 13, "#8a6a44"); }
    });
    R.rems.forEach(function (c) { x = Math.round(c.x - d); y = Math.round(c.y + Math.sin(t * 5 + c.x * 0.05) * 2); px(x - 2, y - 3, 4, 6, "#5fd4ff"); px(x - 3, y - 2, 6, 4, "#5fd4ff"); px(x - 1, y - 2, 2, 2, "#fff"); });
    R.en.forEach(function (e) { if (!e.dead) drawEnemy(e, d, t); });
    R.eshots.forEach(function (s) { px(s.x - d - 3, s.y - 3, 6, 6, "#4a3722"); px(s.x - d - 2, s.y - 4, 4, 1, "#6b5237"); });
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
    });
    drawFore(d);
    b.restore();
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
  function hud(g, ctx) {
    var i, mono = "600 18px " + F.mono, m = Math.floor(R.dist / M);
    bar(ctx, 24, 22, 260, 24, R.hp / R.maxhp, "#ff5a6a");
    D.text(ctx, "HP " + Math.ceil(R.hp) + " / " + Math.ceil(R.maxhp), 36, 40, "700 15px " + F.mono, "#fff");
    D.text(ctx, "◆ " + fmt(R.rem), 28, 74, mono, "#8fe3ff"); D.text(ctx, "● " + R.orbs, 128, 74, mono, "#c8f6ff"); D.text(ctx, "▮ " + R.grim, 198, 74, mono, "#c9a8ff");
    if (R.boss) { bar(ctx, W / 2 - 260, 22, 520, 24, R.boss.hp / R.boss.max, "#f0c23a"); D.text(ctx, "Grand Mud Imp", W / 2, 40, "700 15px " + F.mono, "#1c1a22", "center", false); }
    else if (R.mode === "story") { bar(ctx, W / 2 - 220, 26, 440, 14, R.dist / R.bossAt, "#68d391"); D.text(ctx, "The Forest Around the Tower", W / 2, 62, "600 15px " + F.mono, "#eaf6ee", "center"); }
    else D.text(ctx, "Endless · boss in " + Math.max(0, Math.ceil((R.bossAt - R.dist) / speedNow())) + "s", W / 2, 44, "600 16px " + F.mono, "#eaf6ee", "center");
    D.text(ctx, fmt(m) + " m", W - 28, 44, "700 26px " + F.display, "#fff", "right"); D.text(ctx, "Wiz Lv " + S.lvl, W - 28, 70, "600 15px " + F.mono, "#ffe9a8", "right");
    S.ch.forEach(function (c, j) { var d = chDef(c.id); D.text(ctx, d.n + "  " + Math.min(d.need, Math.floor(c.p)) + "/" + d.need, W - 28, 100 + j * 22, "500 14px " + F.mono, "rgba(255,255,255,.82)", "right"); });
    var eqd = S.incEq.slice(0, incSlots());
    eqd.forEach(function (id, j) {
      var x = 24 + j * 236, y = H - 62, c = R.cds[id] || { t: 0, ch: 0 }, I = INC[id], f = 1, lab = I.n;
      if (id === "snaps") { f = c.ch / (mlvl(id) >= 6 ? 4 : 3); lab += "  " + "●".repeat(c.ch) + "○".repeat(Math.max(0, (mlvl(id) >= 6 ? 4 : 3) - c.ch)); }
      else if (id === "social") f = 1; else if (id === "ward") { f = R.ward > 0 ? 1 : 1 - clamp(c.t / cdOf(id), 0, 1); if (R.ward > 0) lab += "  UP"; } else f = 1 - clamp(c.t / cdOf(id), 0, 1);
      ctx.fillStyle = "rgba(0,0,0,.55)"; D.rr(ctx, x, y, 224, 42, 10); ctx.fill();
      ctx.fillStyle = RAR[I.r].c; ctx.globalAlpha = 0.28; D.rr(ctx, x, y, 224 * clamp(f, 0.04, 1), 42, 10); ctx.fill(); ctx.globalAlpha = 1;
      D.text(ctx, lab, x + 12, y + 20, "700 15px " + F.display, "#fff"); D.text(ctx, I.key ? "Press " + keyName(keysOf("c" + (j + 1))[0]) : "Auto", x + 12, y + 36, "500 12px " + F.mono, "#b9c2cd");
    });
    if (R.buffT > 0 && R.buff) { bar(ctx, 24, H - 96, 224, 16, R.buffT / R.buffMax, "#7fe3ff"); D.text(ctx, BUFF[R.buff].n + "  " + R.buffT.toFixed(1) + "s", 36, H - 102, "600 14px " + F.mono, "#c8f6ff"); }
    if (R.st.ton > 0) D.text(ctx, "Pace " + Math.round(100 + R.st.ton * S.speed) + "%", 28, 100, "500 14px " + F.mono, "rgba(255,255,255,.8)");
    if (R.t < 9 && !(S.cnt.runs > 2)) { D.text(ctx, keyName(keysOf("jump")[0]) + ": jump, hold to glide   ·   " + keyName(keysOf("drop")[0]) + ": drop down   ·   " + keyName(keysOf("five")[0]) + ": high five", W / 2, H - 90, "600 18px " + F.display, "#fff", "center"); }
    R.fx.forEach(function (f) { if (f.k === "num") D.text(ctx, f.s, (f.x - R.dist) * 2, (f.y - f.t * 30) * 2, "700 18px " + F.mono, "#fff", "center"); });
    R.bub.forEach(function (q) { if (q.at) bubble(ctx, (q.at.x - R.dist) * 2, (GY - 44) * 2, q.s); else bubble(ctx, WX * 2 + 30, (R.y - 66) * 2, q.s); });
    void i;
  }

  /* ---------------- the hub ---------------- */
  var Hb = { x: SPOT.crate + 4, tx: SPOT.crate + 4, act: "sit", t: 0, idleT: 6, then: null, busy: false, face: 1, moving: false };
  function hubIdle(g, dt) {
    Hb.t += dt;
    if (UI.scene === "rebind" && UI.bind && UI.bind.kind === "pad" && g.pad) { for (var k in g.pad.hit) if (k !== "start" && k !== "select") { setBind("pad", UI.bind.a, k); return; } }
    var dx = Hb.tx - Hb.x;
    if (Math.abs(dx) > 1) { Hb.x += (dx > 0 ? 1 : -1) * Math.min(Math.abs(dx), 170 * dt); Hb.face = dx > 0 ? 1 : -1; Hb.moving = true; return; }
    if (Hb.moving) { Hb.moving = false; Hb.face = 1; if (Hb.then) { var f = Hb.then; Hb.then = null; f(); return; } }
    if (!Hb.busy) { Hb.idleT -= dt; if (Hb.idleT <= 0) { Hb.idleT = rnd(7, 11); Hb.act = pick(["sit", "read", "dig"]); Hb.tx = { sit: SPOT.crate + 4, read: SPOT.read - 16, dig: SPOT.dig - 14 }[Hb.act]; } }
  }
  function goStation(g, key, fn) {
    Hb.busy = true; Hb.act = "stand"; Hb.tx = SPOT[key]; g.closeMenu(); UI.scene = "hub";
    if (Site.reducedMotion || Math.abs(Hb.tx - Hb.x) <= 1) { Hb.x = Hb.tx; fn(); return; }
    Hb.then = fn; g.wake && g.wake();
  }
  function drawHubScene(g, ctx) {
    var t = Hb.t, st = S.tower || 0;
    b.save(); b.translate(HOX, 0); drawHub(t, st);
    var pose = Hb.moving ? "run" : (Hb.busy ? (st === 1 ? "hold" : "stand") : Hb.act);
    wizSprite(lookOf(S.comfort), pose, t);
    b.save(); b.translate(Math.round(Hb.x), 0); if (Hb.face < 0) b.scale(-1, 1); blitWiz(b, 0, 300, 1); b.restore();
    if (st === 1 && pose !== "hold") { var a = S.wiz, top = 300 - (14 + Math.round(4 * a.height)) - (16 + Math.round(4 * a.height)) - 22 + (pose === "sit" ? 5 + Math.round(4 * a.height) : pose === "dig" ? 8 : 0); px(Hb.x - 8 + (pose === "dig" ? 9 : 2), top, 16, 3, "#efe2b8"); px(Hb.x - 8 + (pose === "dig" ? 9 : 2), top + 3, 16, 1, "#c9b98a"); }
    b.restore();
    if (st < 2) drawRain(t);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(BUF, 0, 0, W, H);
  }
  function drawCreator(g, ctx) {
    var t = Hb.t, gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#1a2233"); gr.addColorStop(1, "#0c1018"); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,.05)"; ctx.beginPath(); ctx.ellipse(1055, 640, 170, 26, 0, 0, TAU); ctx.fill();
    wizSprite(lookOf(true), (t % 8) < 4 ? "stand" : "run", t);
    ctx.imageSmoothingEnabled = false; blitWiz(ctx, 1055, 640, 6);
    D.text(ctx, S.wiz.name || "Unnamed Wizard", 1055, 110, "700 34px " + F.display, "#fff", "center");
    D.text(ctx, "Age " + S.wiz.age + "  ·  All-Knowing (formerly)", 1055, 142, "500 16px " + F.mono, "#b9c2cd", "center");
  }

  /* ---------------- menus ---------------- */
  function tile(l, v, note) { return el("div", { class: "ak-stat" }, el("span", { text: l }), el("b", { text: String(v) }), note ? el("em", { text: note }) : null); }
  function pips(l, max) { return "●".repeat(Math.min(l, max)) + "○".repeat(Math.max(0, max - l)); }
  function cyc(v, d, n) { return ((v + d) % n + n) % n; }
  function panels(g, lines, kicker, done, i) {
    i = i || 0;
    g.menu({ kicker: kicker, cls: "is-wide wz-story", body: lines[i].replace(/\{Name\}/g, S.wiz.name || "The Wizard"),
      items: [{ label: i < lines.length - 1 ? "Next" : "Onward", cls: "is-primary", act: function () { if (i < lines.length - 1) panels(g, lines, kicker, done, i + 1); else done(); } }] });
  }
  function creator(g, focus, done) {
    UI.scene = "creator";
    var a = S.wiz, items = [];
    function row(label, val, fn) { var idx = items.length; items.push({ label: label, sub: "‹  " + val + "  ›", adj: function (d) { fn(d); creator(g, idx, done); }, act: function () { fn(1); creator(g, idx, done); } }); }
    var input = el("input", { type: "text", class: "wz-input", maxlength: "16", placeholder: "Name your wizard", value: a.name, "aria-label": "Wizard name" });
    input.addEventListener("input", function () { a.name = input.value.replace(/[^\w '\-.]/g, "").slice(0, 16); g.paint(); });
    input.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); input.blur(); creator(g, 1, done); } });
    items.push({ label: "Name", sub: a.name ? a.name + "  (select to type)" : "Select to type a name", act: function () { try { input.focus(); input.select(); } catch (e) {} } });
    items.push({ label: "Random Name", sub: "For when you can't decide", act: function () { a.name = pick(NAMES); creator(g, 1, done); } });
    row("Body Type", ["Masculine", "Feminine"][a.body], function (d) { a.body = cyc(a.body, d, 2); });
    row("Skin Tone", (a.skin + 1) + " of 30", function (d) { a.skin = cyc(a.skin, d, 30); });
    row("Head Shape", HEADN[a.head] + "  (" + (a.head + 1) + " of 12)", function (d) { a.head = cyc(a.head, d, 12); });
    row("Body Shape", ["Skinny", "Slim", "Lean", "Average", "Average", "Sturdy", "Stout", "Hefty", "Large", "Fairly Large", "Fairly Large"][Math.round(a.shape * 10)] + "  (" + Math.round(a.shape * 10) + " of 10)", function (d) { a.shape = clamp(Math.round(a.shape * 10 + d) / 10, 0, 1); });
    row("Height", Math.round(a.height * 10) + " of 10", function (d) { a.height = clamp(Math.round(a.height * 10 + d) / 10, 0, 1); });
    row("Age", a.age + " years", function (d) { a.age = clamp(a.age + d, 104, 999); });
    items.push({ label: "Age: +25 Years", sub: "Wraps from 999 back to 104", act: function () { a.age = a.age + 25 > 999 ? 104 : a.age + 25; creator(g, items.length - 0, done); } });
    var ageJump = items.length - 1; items[ageJump].act = function () { a.age = a.age + 25 > 999 ? 104 : a.age + 25; creator(g, ageJump, done); };
    row("Hair Style", HAIRN[a.hair] + "  (" + (a.hair + 1) + " of 15)", function (d) { a.hair = cyc(a.hair, d, 15); });
    row("Hair Colour", HAIRC[a.hairCol][0], function (d) { a.hairCol = cyc(a.hairCol, d, HAIRC.length); });
    row("Brows", BROWN[a.brow] + "  (" + (a.brow + 1) + " of 5)", function (d) { a.brow = cyc(a.brow, d, 5); });
    row("Facial Hair", BEARDN[a.beard] + "  (" + (a.beard + 1) + " of 8)", function (d) { a.beard = cyc(a.beard, d, 8); });
    items.push({ label: "Randomize Everything", act: function () { a.body = ri(0, 1); a.skin = ri(0, 29); a.head = ri(0, 11); a.shape = ri(0, 10) / 10; a.height = ri(0, 10) / 10; a.age = ri(104, 999); a.hair = ri(0, 14); a.hairCol = ri(0, HAIRC.length - 1); a.brow = ri(0, 4); a.beard = ri(0, 7); creator(g, items.length - 2, done); } });
    items.push({ label: "This Is My Wizard", cls: "is-primary", sub: "You can change it later at the Mirror of Distortion", act: function () { if (!a.name) a.name = pick(NAMES); save(); done(); } });
    g.menu({ cls: "is-side is-wide", kicker: "Wizard of the Sprint", title: "Who Is This Wizard?", sub: "Left and right change a value. All of it is looks only.", body: el("div", { class: "wz-namebox" }, input), grid: true, items: items, focus: focus });
  }
  function hub(g, focus) {
    UI.scene = "hub"; Hb.busy = false; Hb.idleT = Math.min(Hb.idleT, 3);
    var st = calc(), c1 = !!S.cleared[1];
    var tiles = el("div", { class: "ak-stats" }, tile("Wiz Level", S.lvl, fmt(S.xp) + " / " + fmt(xpNeed(S.lvl)) + " XP"), tile("Remnants", fmt(S.rem)), tile("Whisper Orbs", S.orbs),
      tile("Grimoires", S.grim), tile("Bag", S.bag.length + " / " + S.bagCap), tile("Health", r1(st.hp) + " HP"));
    function go(key, fn) { return function () { goStation(g, key, fn); }; }
    g.setBest(c1 ? "Forest cleared · Wiz Level " + S.lvl : "Wiz Level " + S.lvl);
    g.menu({ cls: "is-side wz-narrow", kicker: "Wizard of the Sprint", title: (S.wiz.name || "The Wizard") + "'s Tower",
      sub: c1 ? "Still no roof, but you have a scroll to hold over your head. The tracks lead on to a tavern (coming next)." : "Robbed, roofless and in your pyjamas. The footprints lead into the forest.", body: tiles, focus: focus,
      items: [
        { label: "Prep Time", sub: c1 ? "Plan a Magickal Mad Dash" : "Follow the tracks", cls: "is-primary", act: go("prep", function () { prep(g, 0); }) },
        { label: "Equipment", sub: "Wear or remove your Wizard Drip", cls: S.bag.length ? "is-hot" : "", act: go("equip", function () { equip(g, 0); }) },
        { label: "Magickal Condenser", sub: c1 ? "Upgrades and wares for Remnants" : "Locked: clear the forest", disabled: !c1, act: go("condenser", function () { condenser(g, 0); }) },
        { label: "Wizard Drip Armoire", sub: c1 ? "Comfort wear and your hat" : "Locked: clear the forest", disabled: !c1, act: go("armoire", function () { armoire(g, 0); }) },
        { label: "Still Locked", sub: "Mirror of Distortion and Brags (clear 2 levels) · Bookshelf (3) · Incantation Study (4)", disabled: true },
        { label: "Settings", sub: "Sound and controls", act: function () { settings(g, 0); } },
        { label: "How To Play", act: function () { how(g); } }
      ] });
  }
  function prep(g, focus) {
    var c1 = !!S.cleared[1], st = calc(), items = [], owned = Object.keys(S.inc).filter(function (k) { return INC[k]; });
    items.push({ label: c1 ? "Run The Forest Again" : "Follow The Tracks", sub: "The Forest Around the Tower · about 5 minutes, then a boss", cls: "is-primary", act: function () { save(); startRun(g, "story"); } });
    if (c1) items.push({ label: "Endless Forest", sub: "Farm currency and gear. The boss returns every 6.5 minutes. Best " + fmt(S.best.endless1 || 0) + " m", cls: "is-gold", act: function () { save(); startRun(g, "endless"); } });
    for (var i = 0; i < incSlots(); i++) (function (slot) {
      var idx = items.length, id = S.incEq[slot] || "poof", I = INC[id];
      function turn(d) { var free = owned.filter(function (k) { return S.incEq.indexOf(k) < 0 || S.incEq[slot] === k; }), at = free.indexOf(id); S.incEq[slot] = free[cyc(at < 0 ? 0 : at, d, free.length)]; prep(g, idx); }
      items.push({ label: "Incantation " + (slot + 1), sub: (owned.length > 1 ? "‹  " + I.n + "  ›" : I.n) + " · " + I.cast + " · mastery " + mlvl(id), cls: "wz-r" + I.r, adj: turn, act: function () { turn(1); } });
    })(i);
    var bid = S.buffEq[0];
    if (bid) {
      var rk = S.buffs[bid] || 0, cost = ORBCOST[rk], bi = items.length;
      items.push({ label: "Buff: " + BUFF[bid].n + "  " + pips(rk, 5), sub: rk >= 5 ? "Fully upgraded · lasts " + r1(10 + st.ret + rk) + "s" : "Lasts " + r1(10 + st.ret + rk) + "s · upgrade for " + cost + " Whisper Orbs (you have " + S.orbs + ")",
        cls: rk < 5 && S.orbs >= cost ? "is-hot" : "", act: function () { if (rk >= 5) return; if (S.orbs < cost) { g.toast("Not enough Whisper Orbs"); return; } S.orbs -= cost; S.buffs[bid] = rk + 1; save(); sfx("buy"); prep(g, bi); } });
    } else items.push({ label: "Buff", sub: "Pick up your first Whisper Orb on a run to earn one", disabled: true });
    if (st.ton > 0) { var pi = items.length; items.push({ label: "Run Pace", sub: "‹  " + Math.round(100 + st.ton * S.speed) + "%  ›  of base speed", adj: function (d) { S.speed = clamp(S.speed + d * 0.25, 0, 1); prep(g, pi); }, act: function () { S.speed = S.speed >= 1 ? 0 : S.speed + 0.25; prep(g, pi); } }); }
    items.push({ label: "Incantations", sub: owned.length + " owned · what each one does", act: function () { incList(g); } });
    items.push({ label: "Back", act: function () { save(); hub(g, 0); } });
    var kv = el("div", { class: "ak-kv" });
    S.ch.forEach(function (c) { var d = chDef(c.id); kv.appendChild(el("span", { text: d.n, title: d.d })); kv.appendChild(el("b", { text: Math.min(d.need, Math.floor(c.p)) + " / " + d.need })); kv.appendChild(el("em", { class: "wz-note", text: d.d })); });
    g.menu({ cls: "is-side wz-narrow", kicker: "Prep Time", title: "Plan The Dash", sub: "Challenges in play, 100 XP and 25 Remnants each:", body: kv, items: items, focus: focus, back: function () { save(); hub(g, 0); } });
  }
  function incList(g) {
    var items = Object.keys(S.inc).filter(function (k) { return INC[k]; }).map(function (id) { var I = INC[id], n = mnext(id);
      return { label: I.n + "  ·  " + RAR[I.r].n, sub: I.cast + ". " + I.d + " Mastery " + mlvl(id) + (n == null ? " (max)" : ", " + n + " more kills to the next") + ". " + I.m, cls: "wz-r" + I.r, act: function () {} }; });
    items.push({ label: "Back", cls: "is-primary", act: function () { prep(g, 0); } });
    g.menu({ cls: "is-side is-wide", kicker: "Prep Time", title: "Incantations", sub: "Shattered Syllables: " + S.syl + " (spent at the Incantation Study, later)", items: items, focus: items.length - 1, back: function () { prep(g, 0); } });
  }
  function slotName(k) { var sd = slotDef(k); return /^sim/.test(k) ? "Simulacrum " + k.slice(3) : sd.n; }
  function equip(g, focus) {
    var st = calc(), open = openSlots();
    var items = open.map(function (k, i) { var it = S.eq[k], kind = /^sim/.test(k) ? "sim" : k, n = S.bag.filter(function (q) { return q.s === kind; }).length;
      return { label: slotName(k) + ": " + (it ? it.n : "Empty"), sub: (it ? itemSub(it) : "Nothing worn") + (n ? "  ·  " + n + " in the bag fit" : ""), cls: (it ? "wz-r" + it.r : "") + (n ? " is-hot" : ""), act: function () { slotMenu(g, k, 0, i); } }; });
    items.push({ label: "Bag", sub: S.bag.length + " / " + S.bagCap + " · sell what you don't need", act: function () { bag(g, 0, function () { equip(g, items.length - 2); }); } });
    items.push({ label: "Back", act: function () { hub(g, 1); } });
    var tiles = el("div", { class: "ak-stats" }); SK.forEach(function (k) { tiles.appendChild(tile(STAT[k].d, (k === "vit" ? r1(st.hp) + " HP" : "+" + st[k] + STAT[k].u), STAT[k].n)); });
    g.menu({ cls: "is-side is-wide", kicker: "Equipment", title: "Wizard Drip", sub: "More slots open as your Wiz Level rises. Enemies only drop gear for slots you have.", body: tiles, grid: true, items: items, focus: focus, back: function () { hub(g, 1); } });
  }
  function slotMenu(g, k, focus, backF) {
    var kind = /^sim/.test(k) ? "sim" : k, cur = S.eq[k];
    var items = S.bag.filter(function (q) { return q.s === kind; }).map(function (it) {
      return { label: it.n, sub: RAR[it.r].n + " · " + itemSub(it), cls: "wz-r" + it.r, act: function () { S.bag.splice(S.bag.indexOf(it), 1); if (cur) S.bag.push(cur); S.eq[k] = it; save(); sfx("buy"); equip(g, backF); } }; });
    if (cur) items.push({ label: "Take Off " + cur.n, sub: S.bag.length >= S.bagCap ? "The bag is full" : "Back into the bag", disabled: S.bag.length >= S.bagCap, act: function () { S.bag.push(cur); delete S.eq[k]; save(); equip(g, backF); } });
    items.push({ label: "Back", act: function () { equip(g, backF); } });
    g.menu({ cls: "is-side is-wide", kicker: "Equipment", title: slotName(k), sub: cur ? "Wearing: " + cur.n + " · " + itemSub(cur) : "Nothing worn here yet.", items: items, focus: focus, back: function () { equip(g, backF); } });
  }
  function bag(g, focus, back) {
    var items = S.bag.map(function (it, i) { return { label: it.n, sub: RAR[it.r].n + " · " + slotDef(it.s).n + " · " + itemSub(it) + " · sells for " + sellPrice(it), cls: "wz-r" + it.r,
      act: function () { g.menu({ kicker: "Sell", title: it.n, sub: "Sell it for " + sellPrice(it) + " Remnants? This can't be undone.", items: [
        { label: "Sell", cls: "is-primary", act: function () { S.bag.splice(S.bag.indexOf(it), 1); S.rem += sellPrice(it); save(); sfx("buy"); bag(g, Math.min(i, S.bag.length), back); } },
        { label: "Keep It", act: function () { bag(g, i, back); } }], focus: 1, back: function () { bag(g, i, back); } }); } }; });
    items.push({ label: "Back", cls: "is-primary", act: back });
    g.menu({ cls: "is-side is-wide", kicker: "Bag  ·  " + S.bag.length + " / " + S.bagCap, title: "The Bag", sub: S.bag.length ? "Select an item to sell it. Wear things from the Equipment slots." : "Empty. Enemies drop Wizard Drip now and then.", items: items, focus: focus, back: back });
  }
  function condenser(g, focus) {
    var left = 1800 - Math.floor(Date.now() / 1000) % 1800;
    g.menu({ cls: "is-side wz-narrow", kicker: "The caravan out front", title: "Magickal Condenser", sub: "You have " + fmt(S.rem) + " Remnants.", focus: focus, back: function () { hub(g, 2); },
      items: [
        { label: "Upgrades", sub: "Jump, glide and all eight stats", cls: "is-primary", act: function () { upgrades(g, 0); } },
        { label: "Wares", sub: "New stock in " + Math.floor(left / 60) + ":" + ("0" + left % 60).slice(-2), act: function () { wares(g, 0); } },
        { label: "Sell From The Bag", sub: S.bag.length + " / " + S.bagCap, act: function () { bag(g, 0, function () { condenser(g, 2); }); } },
        { label: "Back", act: function () { hub(g, 2); } }
      ] });
  }
  function upgrades(g, focus) {
    var items = RANKS.map(function (u, i) {
      var l = S.ranks[u.k] || 0, cost = rankCost(l), mx = l >= u.max, can = !mx && S.rem >= cost;
      return { label: u.n + "  " + (u.max <= 10 ? pips(l, u.max) : l + " / " + u.max), sub: mx ? u.d(l) + " · maxed" : u.d(l) + "  →  " + u.d(l + 1) + "  ·  " + fmt(cost) + " Remnants", cls: can ? "is-hot" : mx ? "is-owned" : "",
        act: function () { if (mx) return; if (!can) { g.toast("Not enough Remnants"); return; } S.rem -= cost; cnt("spent", cost); S.ranks[u.k] = l + 1; save(); sfx("buy"); upgrades(g, i); } };
    });
    items.push({ label: "Back", act: function () { condenser(g, 0); } });
    g.menu({ cls: "is-side is-wide", kicker: "Magickal Condenser", title: "Upgrades", sub: "You have " + fmt(S.rem) + " Remnants.", grid: true, items: items, focus: focus, back: function () { condenser(g, 0); } });
  }
  function wares(g, focus) {
    var st = stock(), items = st.map(function (it, i) { var pr = buyPrice(it);
      return { label: it.n, sub: RAR[it.r].n + " · " + slotDef(it.s).n + " · " + itemSub(it) + " · " + fmt(pr) + " Remnants", cls: "wz-r" + it.r + (S.rem >= pr ? " is-hot" : ""),
        act: function () { if (S.rem < pr) { g.toast("Not enough Remnants"); return; } if (S.bag.length >= S.bagCap) { g.toast("The bag is full"); return; } S.rem -= pr; cnt("spent", pr); st.splice(st.indexOf(it), 1); S.bag.push(it); save(); sfx("buy"); wares(g, Math.min(i, st.length)); } }; });
    [["social", 600], ["rainy", 1500]].forEach(function (w) { if (S.inc[w[0]]) return; var I = INC[w[0]], idx = items.length;
      items.push({ label: "Incantation: " + I.n, sub: I.cast + ". " + I.d + " · " + fmt(w[1]) + " Remnants", cls: "is-gold", act: function () { if (S.rem < w[1]) { g.toast("Not enough Remnants"); return; } S.rem -= w[1]; cnt("spent", w[1]); giveInc(w[0], g); save(); sfx("buy"); wares(g, Math.min(idx, items.length - 2)); } }); });
    items.push({ label: "Back", act: function () { condenser(g, 1); } });
    g.menu({ cls: "is-side is-wide", kicker: "Magickal Condenser", title: "Wares", sub: "You have " + fmt(S.rem) + " Remnants. Bought items go to the bag (" + S.bag.length + " / " + S.bagCap + ").", items: items, focus: focus, back: function () { condenser(g, 1); } });
  }
  function armoire(g, focus) {
    g.menu({ cls: "is-side wz-narrow", kicker: "Wizard Drip Armoire", title: "The Armoire", sub: "What you wear around the tower. Runs always show your equipped gear.", focus: focus, back: function () { hub(g, 3); },
      items: [
        { label: "Around The Tower: " + (S.comfort ? "Comfort Wear" : "Equipped Gear"), sub: "Comfort wear is the sleep cap, tunic and skivvies", act: function () { S.comfort = !S.comfort; save(); armoire(g, 0); } },
        { label: "Favorite Hat: " + (S.cos.hatOn ? "On" : "Off"), sub: "Won back from the Grand Mud Imp. Worn over any headgear.", act: function () { S.cos.hatOn = !S.cos.hatOn; save(); armoire(g, 1); } },
        { label: "Back", act: function () { hub(g, 3); } }
      ] });
  }
  function settings(g, focus) {
    g.menu({ cls: "is-side wz-narrow", kicker: "Wizard of the Sprint", title: "Settings", focus: focus, back: function () {  hub(g, 4); },
      items: [
        { label: "Game Sound: " + (S.snd ? "On" : "Off"), act: function () { S.snd = !S.snd; save(); sfx("buy"); settings(g, 0); } },
        { label: "Volume: " + Math.round(S.vol * 100) + "%", sub: "‹  left and right  ›", adj: function (d) { S.vol = clamp(Math.round(S.vol * 10 + d) / 10, 0.1, 1); save(); sfx("rem"); settings(g, 1); }, act: function () { S.vol = S.vol >= 1 ? 0.1 : Math.round(S.vol * 10 + 1) / 10; save(); sfx("rem"); settings(g, 1); } },
        { label: "Keyboard Controls", sub: "Rebind any action", act: function () { controls(g, "key", 0); } },
        { label: "Controller Controls", sub: "Rebind any action", act: function () { controls(g, "pad", 0); } },
        { label: "Start Over", sub: "Erase this wizard and everything they own", act: function () { g.menu({ kicker: "Start over", title: "Erase Everything?", sub: "Your wizard, gear, currencies and progress are deleted on this device, and on your account at the next sync. This can't be undone.",
          items: [{ label: "Keep My Wizard", cls: "is-primary", act: function () { settings(g, 4); } }, { label: "Erase And Start Over", act: function () { var kb = S.binds, pb = S.pad; S = fresh(); S.binds = kb; S.pad = pb; fillCh(); save(); title(g); } }], back: function () { settings(g, 4); } }); } },
        { label: "Back", act: function () {  hub(g, 4); } }
      ] });
  }
  function controls(g, kind, focus) {
    UI.scene = "hub"; UI.bind = null;
    var items = ACTS.map(function (a, i) { return { label: a[1], sub: kind === "key" ? keysOf(a[0]).map(keyName).join(" or ") : padOf(a[0]).toUpperCase(), act: function () { UI.scene = "rebind"; UI.bind = { a: a[0], kind: kind, i: i, name: a[1] }; g.closeMenu(); g.paint(); g.wake && g.wake(); } }; });
    items.push({ label: "Reset To Defaults", act: function () { if (kind === "key") S.binds = {}; else S.pad = {}; save(); controls(g, kind, items.length - 2); } });
    items.push({ label: "Back", act: function () { settings(g, kind === "key" ? 2 : 3); } });
    g.menu({ cls: "is-side is-wide", kicker: "Settings", title: kind === "key" ? "Keyboard Controls" : "Controller Controls", sub: "Select an action, then press the " + (kind === "key" ? "key" : "button") + " for it. Esc and P stay as pause.", grid: true, items: items, focus: focus, back: function () { settings(g, kind === "key" ? 2 : 3); } });
  }
  function setBind(kind, a, code) {
    var g = G, i = UI.bind ? UI.bind.i : 0;
    if (code) {
      if (kind === "key") { var old = keysOf(a)[0]; ACTS.forEach(function (o) { if (o[0] !== a && keysOf(o[0]).indexOf(code) >= 0) S.binds[o[0]] = old; }); S.binds[a] = code; }
      else { var oldp = padOf(a); ACTS.forEach(function (o) { if (o[0] !== a && padOf(o[0]) === code) S.pad[o[0]] = oldp; }); S.pad[a] = code; }
      save(); sfx("buy");
    }
    controls(g, kind, i);
  }
  function how(g) {
    g.menu({ cls: "is-side is-wide", kicker: "Wizard of the Sprint", title: "How To Play", back: function () { hub(g, 5); },
      body: el("div", { class: "ak-panel__body" },
        el("p", { text: "You run on your own. Jump with " + keyName(keysOf("jump")[0]) + " and hold it to glide. Your jump is pitiful at first: it reaches low and middle platforms, and you climb to the high ones from a middle one. " + keyName(keysOf("drop")[0]) + " drops you through a platform." }),
        el("p", { text: "Incantations do the fighting. Magick Poof casts by itself; keyed ones use " + keyName(keysOf("c1")[0]) + ". Kills raise an Incantation's mastery." }),
        el("p", { text: "You start with 10 HP and most hits do 10, so one hit ends a run until you add Vitality or Confidence. You keep everything you collected either way." }),
        el("p", { text: "Remnants buy upgrades. A Whisper Orb fires your buff for 10 seconds. Grimoires are rare, and 10 of them buy a revive. Enemies sometimes drop Wizard Drip: wear it from Equipment." }),
        el("p", { text: "Press " + keyName(keysOf("five")[0]) + " as you pass a friendly for a high five. Clear the forest's boss to unlock the Condenser, the Armoire and Endless mode." })),
      items: [{ label: "Back", cls: "is-primary", act: function () { hub(g, 5); } }] });
  }
  function conflict(g) {
    var c = store.get(SKEY + ".conflict", null); if (!c) return false;
    g.menu({ kicker: "Save sync", title: "Two Saves, One Wizard", cls: "is-wide",
      sub: "This wizard was played on two devices that hadn't synced with each other. The newer save was kept (" + (c.kept === "account" ? "the one from your account" : "the one on this device") + "). The older one is stored as a backup.",
      items: [
        { label: "OK, Keep The Newer Save", cls: "is-primary", act: function () { store.set(SKEY + ".conflict", false); title(g); } },
        { label: "Use The Older Backup Instead", act: function () { var bk = store.get(SKEY + ".backup", null), cur = store.get(SKEY, null); if (bk) { store.set(SKEY + ".backup", cur); store.set(SKEY, bk); load(); save(); } store.set(SKEY + ".conflict", false); title(g); } }
      ] });
    return true;
  }
  function title(g) {
    G = g; if (R && !R.over && UI.scene === "run") { bankRun(); g.toast("Run ended. You keep what you picked up."); }
    UI.scene = "hub";
    if (conflict(g)) return;
    if (!S.made) { creator(g, 0, function () { S.made = true; save(); UI.scene = "hub"; panels(g, STORY.open, "Wizard of the Sprint", function () { hub(g, 0); }); }); return; }
    hub(g, 0);
  }

  /* ---------------- register ---------------- */
  load();
  A.register({
    id: "wizard-sprint", name: "Wizard of the Sprint", icon: "🧙", accent: "#8f6bff", W: W, H: H, order: 0.5, badge: "New",
    tags: ["Runner", "RPG loot", "Campaign"],
    tagline: "A robbed arch-wizard in pyjamas chases a trail of footprints. Run, jump, cast, loot, and rebuild your tower.",
    about: "A left-to-right runner with spell combat and loot. Build your wizard, follow the tracks through the forest, fight with Incantations that level up as you use them, pick up Wizard Drip in six rarities, and spend Remnants on upgrades back at your ruined tower. This is the first level: clear its boss to unlock the shop, the wardrobe and Endless mode. More levels are on the way.",
    controls: [["Jump, hold to glide", "Space, W or Up (A)"], ["Drop through a platform", "S or Down"], ["Keyed Incantation", "J (X)"], ["High five", "F (RB)"], ["Run pace", "1 and 2 (LT, RT)"], ["Pause", "Esc, P or Start"], ["Rebind", "Settings, inside the game"]],
    stats: function () { return [["Wiz Level", S.lvl], ["Forest", S.cleared[1] ? "Cleared" : "Not cleared yet"], ["Best Endless", fmt(S.best.endless1 || 0) + " m"], ["Remnants", fmt(S.rem)], ["Incantations", Object.keys(S.inc).length + " / 20"], ["Enemies defeated", fmt(S.cnt.kills || 0)]]; },
    poster: function (x, w, h, t) { drawForest(t * 150, t); wizSprite(lookOf(true), "run", t); blitWiz(b, 200, GY, 1); px(330 - (t * 40 % 60), GY - 12, 14, 10, "#7a5536"); drawFore(t * 150); x.imageSmoothingEnabled = false; x.drawImage(BUF, 0, 0, w, h); },
    blurb: "Run, cast and loot your way after whoever robbed your tower.",
    sync: [{ k: "save", s: SKEY, t: "newest" }],
    onSync: function (g) { load(); if (g.state === "title" && UI.scene === "hub" && g.menuOpen()) title(g); },
    init: function (g) { G = g; g.debug = { S: function () { return S; }, R: function () { return R; }, UI: UI, start: function (m) { startRun(g, m || "story"); }, save: save, load: load, calc: calc, makeItem: makeItem, giveInc: giveInc, step: function (n, dt) { for (var i = 0; i < n && R && !R.over; i++) update(g, dt); }, wiz: wizSprite, look: lookOf, WC: WC }; },
    title: title,
    update: update,
    idle: hubIdle,
    rawKey: function (g, e) {
      if (UI.scene !== "rebind" || !UI.bind) return false;
      if (e.code === "Escape") { setBind(UI.bind.kind, UI.bind.a, null); return true; }
      if (UI.bind.kind !== "key") return true;
      if (e.code === "KeyP" || /^(Meta|Control|Alt|OS)/.test(e.code)) { g.toast("That key is reserved"); return true; }
      setBind("key", UI.bind.a, e.code); return true;
    },
    pointer: function (g, type) { if (type === "down" && g.state === "play" && R) R.tap = true; },
    restart: function (g) { if (R) startRun(g, R.mode); },
    draw: function (g, ctx) {
      if (R && (g.state === "play" || g.state === "paused" || g.state === "over") && UI.scene === "run") { drawRun(g, ctx); return; }
      if (UI.scene === "creator") { drawCreator(g, ctx); return; }
      drawHubScene(g, ctx);
      if (UI.scene === "rebind" && UI.bind) {
        ctx.fillStyle = "rgba(4,8,14,.78)"; ctx.fillRect(0, 0, W, H);
        D.text(ctx, "Press a " + (UI.bind.kind === "key" ? "key" : "controller button") + " for", W / 2, H / 2 - 30, "600 26px " + F.display, "#b9c2cd", "center");
        D.text(ctx, UI.bind.name, W / 2, H / 2 + 22, "700 48px " + F.display, "#fff", "center");
        D.text(ctx, "Esc cancels", W / 2, H / 2 + 70, "500 18px " + F.mono, "#b9c2cd", "center");
      }
    }
  });
})();
