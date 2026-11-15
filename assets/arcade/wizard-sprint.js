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
    early: ["I used to have SO many hats.", "Running. Me. Disgusting.", "Whoever did this is getting a strongly worded hex.", "My feet are touching MUD.", "I have not jogged since the Third Age.",
      "These skivvies were not built for speed.", "Is this what 'cardio' is? I hate it.", "I knew everything yesterday. EVERYTHING.", "Footprints. Rude, muddy footprints.", "A nap. One nap. And THIS.",
      "My knees are filing a complaint.", "I could have teleported. I HAD a spell for that.", "Note to self: lock the tower.", "The forest smells like... outside.", "Fresh air. Ugh."],
    mid: ["Do imps always look this smug?", "I am sweating. Wizards do not sweat.", "That squirrel judged me. I felt it.", "Somewhere, someone is wearing my robes.", "I miss my chair.",
      "Left foot, right foot. Riveting.", "If I find my wand I'm never putting it down.", "Who steals a whole LIBRARY?", "I had a tome for blisters. HAD.", "The audacity. The sheer audacity.",
      "I'd turn them into a newt if I remembered how.", "Poof. Poof. Is that all I've got? Poof?", "Still got it. Sort of. A bit.", "Mud between the toes. Delightful. No.", "This is fine. I'm fine. Everything is fine."],
    late: ["The tracks are fresher here.", "I can smell my own hat. Don't ask.", "Closer. I can feel it in my beard.", "Whoever you are, I'm RIGHT behind you.", "Getting the hang of this running thing.",
      "Huh. I haven't thought about tax scrolls in an hour.", "Is this... am I having FUN? No. Surely not.", "Something big is up ahead. Wonderful.", "My legs have stopped screaming. Suspicious."],
    cheer: ["Go get 'em, weird old wizard!", "Nice jammies!", "Run, wizard, run!", "Looking spry, grandpa!", "Love the cap!", "You dropped your dignity back there!", "Wooo! Mystery jogger!", "Is that the tower hermit? RUNNING?", "Knees up, old timer!", "You've got this, pyjama person!"],
    greet: ["Morning! Don't mind the pyjamas.", "Lovely day for being robbed.", "Seen a thief? Tall? Short? Any size?", "Hello, small woodland citizen.", "Carry on. Wizard business.", "Nice fur. Very... furry.",
      "Have you seen a library go by?", "You there! Good job existing.", "Out of the way, I'm exercising!", "I'd stop to chat, but, you know. Vengeance."],
    greetReply: ["...okay?", "He seems nice.", "That man has no trousers.", "Wizards. Honestly.", "Should we tell someone?", "Bye, weird wizard!", "Good luck with... that!"],
    reply: ["Uh... thanks?", "You were, though.", "Apology noted.", "A bit, yeah.", "Water under the bridge!", "Who ARE you?"],
    five: ["Up high!", "Yes! Contact!", "Nailed it.", "Skin! Or fur! Whatever!", "Still got the reflexes.", "Best part of my day, honestly.", "Put it there!"],
    rescue: ["You're safe. Don't make it weird.", "Fine. FINE. You're welcome.", "Out you get. No hugging.", "Freedom! Now scram.", "I'm not crying. It's forest in my eye."],
    hit: ["Ow, my dignity.", "That's going in my diary.", "Right in the pyjamas!", "I felt that in a previous century.", "Rude!", "My everything hurts."],
    orb: ["Ooh, that tingles. I remember tingles.", "Whispers! I love gossip.", "Yes. YES. Power. A little bit of it."],
    grim: ["MY BOOK! ...wait, not mine. Mine now.", "A book! I remember reading.", "Finders keepers, that's the law."],
    satchel: ["Somebody's mail is late. Too bad."],
    boss: ["Oh, you're big. I hate that.", "Is that MY HAT?", "That is a LOT of imp."]
  };
  var lastLine = {};
  function line(k) { var a = CHAT[k], s; do { s = pick(a); } while (a.length > 1 && s === lastLine[k]); lastLine[k] = s; return s; }

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
    /* a hazier row of trees behind, so the wood has depth */
    var ho = dist * 0.26;
    for (i = Math.floor(ho / 58) - 1; i < Math.floor((ho + BW) / 58) + 2; i++) {
      x = i * 58 + hash(i * 2.9) * 30 - ho; var hh2 = 70 + hash(i * 4.3) * 60, pine = hash(i * 6.1) > 0.6;
      px(x + 8, GY - hh2, 5, hh2, "#3d5f4c");
      if (pine) { for (var q = 0; q < 5; q++) px(x + 2 - q * 3, GY - hh2 - 26 + q * 12, 17 + q * 6, 12, "#34674a"); }
      else { px(x - 10, GY - hh2 - 22, 40, 30, "#3f7d58"); px(x - 4, GY - hh2 - 32, 28, 12, "#3f7d58"); px(x - 6, GY - hh2 - 16, 16, 8, "#4a8a63"); }
    }
    /* a brook winding out of the trees now and then; it crosses the path under a plank bridge further down */
    for (i = Math.floor((dist - 80) / 1500); i <= Math.floor((dist + BW + 80) / 1500); i++) {
      if (hash(i * 8.3) < 0.35) continue; x = i * 1500 + 300 + hash(i * 1.9) * 700 - dist;
      for (var r2 = 0; r2 < 22; r2++) { var wy = GY - 44 + r2 * 2, ww = 6 + r2 * 1.3, wxo = Math.sin(r2 * 0.45) * 7; px(x + wxo - ww / 2, wy, ww, 2, r2 % 5 === 2 ? "#8fd0ee" : "#4f9fd0"); }
      px(x - 3 + Math.sin(t * 3) * 3, GY - 22, 4, 1, "#d8f2ff"); px(x + 4 - Math.sin(t * 2.3) * 4, GY - 10, 5, 1, "#d8f2ff");
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
    var BROOKS = [];
    for (i = Math.floor((dist - 80) / 1500); i <= Math.floor((dist + BW + 80) / 1500); i++) { if (hash(i * 8.3) < 0.35) continue; BROOKS.push(Math.round(i * 1500 + 300 + hash(i * 1.9) * 700 - dist)); }
    for (x = -(dist % 5); x < BW; x += 5) { var m0 = Math.floor((x + dist) / 5); if (hash(m0 * 2.3) > 0.72) px(x, GY + 4 + (hash(m0) * 50 | 0), 3, 1, "#59432c"); }
    for (i = Math.floor(dist / 46) - 1; i < Math.floor((dist + BW) / 46) + 1; i++) { x = i * 46 - dist; px(x, GY + 8 + (i % 2) * 6, 5, 2, "#4a3722"); px(x + 5, GY + 8 + (i % 2) * 6, 1, 1, "#4a3722"); }
    BROOKS.forEach(function (bx) {                         /* the brook under its plank bridge: scenery only */
      px(bx - 22, GY + 1, 44, BH - GY, "#3f8cc0"); px(bx - 22, GY + 1, 3, BH - GY, "#2f6f9c"); px(bx + 19, GY + 1, 3, BH - GY, "#2f6f9c");
      for (var k3 = 0; k3 < 5; k3++) px(bx - 16 + ((k3 * 13 + t * 14) % 30), GY + 22 + k3 * 10, 7, 1, "#bfe6fa");
      px(bx - 30, GY - 1, 60, 6, "#8a6a44"); px(bx - 30, GY + 5, 60, 2, "#5c4530"); for (k3 = 0; k3 < 6; k3++) px(bx - 30 + k3 * 10, GY - 1, 1, 6, "#5c4530"); px(bx - 28, GY + 7, 4, 9, "#5c4530"); px(bx + 24, GY + 7, 4, 9, "#5c4530");
    });
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
      if (c.p >= d.need) { R.xp += 100; R.rem += 25; G.toast("Challenge done: " + d.n + "  (+100 XP, +25 Remnants)", "gold"); sfx("ch"); cnt("ch", 1); S.ch.splice(i, 1); fillCh(); i--; }
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
  function lootDrop(minR) { var it = makeItem(minR); R.loot.push(it); G.toast("Loot: " + it.n + "  (" + RAR[it.r].n + ")", it.r >= 2 ? "gold" : "info"); sfx(it.r >= 4 ? "lootBig" : "loot"); fxAdd("ring", wxw(), R.y - 20, { c: RAR[it.r].c }); }
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
      if (R.fiveWin > 0) { R.fiveT = 0.4; R.rem += 3; cnt("fives", 1); chEv("five", 1); sfx("five"); say(line("five")); }
      else if (Math.random() < 0.45) { say(line("cheer"), f, 2); }
      else if (Math.random() < 0.12 && R.t - (R.sorryT || -99) > 60) { R.sorryT = R.t; cnt("sorry", 1); say("Sorry if I was ever a dick!"); f.reply = 0.9; f.rk = "reply"; }
      else { say(line("greet")); f.reply = 0.9; f.rk = "greetReply"; }
    });
    R.fr.forEach(function (f) { if (f.reply > 0) { f.reply -= dt; if (f.reply <= 0) say(line(f.rk || "reply"), f, 2); } });
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
    R.chat -= dt; if (R.chat <= 0 && !R.boss) { R.chat = rnd(16, 28); if (!R.bub.length) say(line(R.dist < R.bossAt * 0.5 || R.mode !== "story" ? (Math.random() < 0.5 ? "early" : "mid") : "late")); }
    if (R.win > 0) { R.win -= dt; if (Math.random() < 0.5) R.rems.push({ x: wx + rnd(60, 300), y: GY - rnd(10, 70) }); if (R.win <= 0) endRun(true); }
  }

  function bankRun() {                                  /* whatever happens to a run, you keep what you picked up */
    var o = { m: Math.floor(R.dist / M), l0: S.lvl, sold: 0, kept: 0 }; o.xp = Math.round(R.xp + o.m / 10);
    R.over = true;
    S.rem += R.rem; S.orbs += R.orbs; S.grim += R.grim; cnt("rem", R.rem);
    R.loot.forEach(function (it) { if (S.bag.length < S.bagCap) { it.nw = 1; S.bag.push(it); o.kept++; } else { S.rem += sellPrice(it); o.sold++; } });
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
    var res = el("div", {}, kv);
    if (R.loot.length) { var lb = el("div", { class: "wz-chips wz-loot" }); R.loot.forEach(function (it) { lb.appendChild(el("i", { class: "wz-chip is-r" + it.r, text: it.n + "  ·  " + RAR[it.r].n })); }); res.appendChild(lb); }
    MN(g, { kicker: R.mode === "story" ? "Magickal Mad Dash · The Forest Around the Tower" : "Endless · The Forest Around the Tower",
      title: win ? "Forest Cleared" : "Flattened at " + fmt(m) + " m", sub: win ? "The Grand Mud Imp drops your hat and runs." : "You keep everything you picked up.", body: res, cls: "is-wide",
      items: [
        first ? { label: "Continue", cls: "is-primary", act: function () { panels(g, STORY.clear1, "After the forest", function () { g.toTitle(); }); } }
              : { label: "Run It Again", cls: "is-primary", act: function () { startRun(g, R.mode); } },
        first ? null : { label: "Back To The Tower", act: function () { g.toTitle(); } }
      ] });
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
    if (f.k === "deer") { px(x - 11, GY - 22, 22, 10, "#a8763f"); px(x - 9, GY - 12, 3, 12, "#8a5f30"); px(x + 6, GY - 12, 3, 12, "#8a5f30"); px(x - 16, GY - 30, 8, 9, "#a8763f"); px(x - 15, GY - 35, 2, 6, "#e8d9b8"); px(x - 11, GY - 36, 2, 7, "#e8d9b8"); px(x - 15, GY - 27, 1, 1, "#1a1420"); px(x + 10, GY - 23, 3, 3, "#f4efe6"); }
    else if (f.k === "squirrel") { px(x - 4, GY - 9, 8, 8, "#a0562a"); px(x - 6, GY - 13, 6, 5, "#a0562a"); px(x + 3, GY - 15, 5, 12, "#c07a44"); px(x - 5, GY - 12, 1, 1, "#1a1420"); px(x - 4, GY - 1, 3, 1, "#7a3f1e"); }
    else { px(x - 4, GY - 20, 8, 13, "#7b6aa8"); px(x - 3, GY - 7, 3, 7, "#4a3a2a"); px(x + 1, GY - 7, 3, 7, "#4a3a2a"); px(x - 3, GY - 27, 7, 7, "#eabf98"); px(x - 5, GY - 29, 11, 3, "#c9a26b"); px(x - 9, GY - 14, 6, 6, "#a67c52"); px(x - 2, GY - 25, 1, 1, "#1a1420"); }
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
  function hud(g, ctx) {
    var i, m = Math.floor(R.dist / M), t = R.t;
    vial(ctx, 24, 20, 320, 24, R.hp / R.maxhp, t);
    bold(ctx, "HP " + Math.ceil(R.hp) + " / " + Math.ceil(R.maxhp), 38, 38, "800 16px " + F.mono, "#fff");
    var cx = 22; cx += chip(ctx, cx, 58, "rem", fmt(R.rem), "#c3c6ff"); cx += chip(ctx, cx, 58, "orb", String(R.orbs), "#c8f6ff"); chip(ctx, cx, 58, "grim", String(R.grim), "#d9c2ff");
    if (R.st.ton > 0) { plate(ctx, 22, 102, 118, 26); bold(ctx, "Pace " + Math.round(100 + R.st.ton * S.speed) + "%", 32, 121, "700 15px " + F.mono, "#f3e6c4"); }
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
      plate(ctx, W / 2 - 150, by + 22, 300, 26); bold(ctx, "The Forest Around the Tower", W / 2, by + 41, "700 15px " + SERIF, "#f3e6c4", "center");
    } else { plate(ctx, W / 2 - 150, 18, 300, 36); icoAt(ctx, "skull", W / 2 - 142, 20, 2); bold(ctx, "Endless · boss in " + Math.max(0, Math.ceil((R.bossAt - R.dist) / speedNow())) + "s", W / 2 + 14, 43, "800 17px " + F.mono, "#fff3c4", "center"); }
    /* top right: distance, level and the challenges in play */
    ctx.font = "800 30px " + F.display; var dw = Math.max(150, ctx.measureText(fmt(m) + " m").width + 36);
    plate(ctx, W - 24 - dw, 16, dw, 46); bold(ctx, fmt(m) + " m", W - 40, 50, "800 30px " + F.display, "#fff", "right");
    plate(ctx, W - 24 - 132, 68, 132, 28); bold(ctx, "Wiz Lv " + S.lvl, W - 38, 88, "800 16px " + F.mono, "#ffe58a", "right");
    S.ch.forEach(function (c, j) {
      var d = chDef(c.id), y = 104 + j * 32, fr = clamp(c.p / d.need, 0, 1);
      plate(ctx, W - 24 - 360, y, 360, 28); ctx.fillStyle = "rgba(104,211,145,.28)"; D.rr(ctx, W - 382, y + 2, 356 * fr, 24, 5); ctx.fill();
      bold(ctx, d.n, W - 372, y + 20, "700 14px " + F.mono, "#f3e6c4"); bold(ctx, Math.min(d.need, Math.floor(c.p)) + " / " + d.need, W - 36, y + 20, "800 15px " + F.mono, "#9ae6b4", "right");
    });
    /* the spell rack: one wand per Incantation */
    var eqd = S.incEq.slice(0, incSlots());
    eqd.forEach(function (id, j) {
      var x = 22 + j * 262, y = H - 78, c = R.cds[id] || { t: 0, ch: 0 }, I = INC[id], f = 1, lab = I.n;
      if (id === "snaps") { f = c.ch / (mlvl(id) >= 6 ? 4 : 3); lab += "  " + "●".repeat(c.ch) + "○".repeat(Math.max(0, (mlvl(id) >= 6 ? 4 : 3) - c.ch)); }
      else if (id === "social") f = 1; else if (id === "ward") { f = R.ward > 0 ? 1 : 1 - clamp(c.t / cdOf(id), 0, 1); if (R.ward > 0) lab += "  UP"; } else f = 1 - clamp(c.t / cdOf(id), 0, 1);
      plate(ctx, x, y, 250, 62);
      bold(ctx, lab, x + 12, y + 22, "800 16px " + SERIF, "#fff3c4"); bold(ctx, I.key ? keyName(keysOf("c" + (j + 1))[0]) : "AUTO", x + 238, y + 22, "800 13px " + F.mono, I.key ? "#ffe58a" : "#9ae6b4", "right");
      wand(ctx, x + 14, y + 43, 200, f, RAR[I.r].c === "rb" ? "#ffd84a" : RAR[I.r].c, t + j);
    });
    if (R.buffT > 0 && R.buff) { plate(ctx, 22, H - 126, 250, 40); bar(ctx, 30, H - 104, 234, 12, R.buffT / R.buffMax, "#7fe3ff"); icoAt(ctx, "wing", 28, H - 126, 1.3); bold(ctx, BUFF[R.buff].n + "  " + R.buffT.toFixed(1) + "s", 54, H - 108, "800 14px " + F.mono, "#c8f6ff"); }
    if (R.t < 9 && !(S.cnt.runs > 2)) { ctx.font = "700 18px " + F.display; var hs = keyName(keysOf("jump")[0]) + ": jump, hold to glide   ·   " + keyName(keysOf("drop")[0]) + ": drop down   ·   " + keyName(keysOf("five")[0]) + ": high five", hw = ctx.measureText(hs).width + 36; plate(ctx, W / 2 - hw / 2, H - 150, hw, 36); bold(ctx, hs, W / 2, H - 126, "700 18px " + F.display, "#fff", "center"); }
    R.fx.forEach(function (f) { if (f.k === "num") bold(ctx, f.s, (f.x - R.dist) * 2, (f.y - f.t * 30) * 2, "800 19px " + F.mono, "#fff", "center"); });
    R.bub.forEach(function (q) { if (q.at) bubble(ctx, (q.at.x - R.dist) * 2, (GY - 44) * 2, q.s); else bubble(ctx, WX * 2 + 30, (R.y - 66) * 2, q.s); });
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
      if (!it) return; var bt = btns[j++]; if (!bt) return;
      var ic = it.ico || (/^Back\b/.test(it.label) ? "back" : null);
      if (ic) { bt.insertBefore(icoEl(ic), bt.firstChild); bt.classList.add("has-ico"); }
      if (it.chips) { var box = el("span", { class: "wz-chips" }); it.chips.forEach(function (c) { box.appendChild(el("i", { class: "wz-chip " + (c[1] ? "is-" + c[1] : ""), text: c[0] })); }); var sp = bt.querySelector("span"); if (sp) bt.replaceChild(box, sp); else bt.appendChild(box); }
      if (it.more) { var bx2 = el("span", { class: "wz-chips" }); it.more.forEach(function (c) { bx2.appendChild(el("i", { class: "wz-chip " + (c[1] ? "is-" + c[1] : ""), text: c[0] })); }); bt.appendChild(bx2); }
      if (it.isNew) { bt.classList.add("is-new"); bt.appendChild(el("em", { class: "wz-new", text: it.isNew === true ? "NEW!" : it.isNew })); }
    });
  }
  function tile(l, v, note) { return el("div", { class: "ak-stat" }, el("span", { text: l }), el("b", { text: String(v) }), note ? el("em", { text: note }) : null); }
  function pips(l, max) { return "●".repeat(Math.min(l, max)) + "○".repeat(Math.max(0, max - l)); }
  function cyc(v, d, n) { return ((v + d) % n + n) % n; }
  function panels(g, lines, kicker, done, i) {
    i = i || 0;
    MN(g, { kicker: kicker, cls: "is-wide wz-story", body: lines[i].replace(/\{Name\}/g, S.wiz.name || "The Wizard"),
      items: [{ label: i < lines.length - 1 ? "Next" : "Onward", cls: "is-primary", act: function () { if (i < lines.length - 1) panels(g, lines, kicker, done, i + 1); else done(); } }] });
  }
  var SHAPEN = ["Twig", "Skinny", "Slim", "Lean", "Average", "Sturdy", "Stout", "Hefty", "Large", "Fairly Large", "Magnificently Round"];
  function creator(g, focus, done) {
    UI.scene = "creator";
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
    UI.scene = "hub"; Hb.busy = false; Hb.idleT = Math.min(Hb.idleT, 3);
    var st = calc(), c1 = !!S.cleared[1], nwN = S.bag.filter(function (q) { return q.nw; }).length;
    var tiles = el("div", { class: "ak-stats" }, tile("Wiz Level", S.lvl, fmt(S.xp) + " / " + fmt(xpNeed(S.lvl)) + " XP"), tile("Remnants", fmt(S.rem)), tile("Whisper Orbs", S.orbs),
      tile("Grimoires", S.grim), tile("Bag", S.bag.length + " / " + S.bagCap), tile("Health", r1(st.hp) + " HP"));
    function go(key, fn) { return function () { goStation(g, key, fn); }; }
    g.setBest(c1 ? "Forest cleared · Wiz Level " + S.lvl : "Wiz Level " + S.lvl);
    MN(g, { cls: "is-side wz-narrow wz-hub", kicker: "Wizard of the Sprint", title: (S.wiz.name || "The Wizard") + "'s Tower",
      sub: c1 ? "Still no roof, but you have a scroll to hold over your head. The tracks lead on to a tavern (coming next)." : "Robbed, roofless and in your pyjamas. The footprints lead into the forest.", body: tiles, focus: focus,
      items: [
        { label: "Prep Time", ico: "prep", sub: c1 ? "Plan a Magickal Mad Dash" : "Follow the tracks", cls: "is-primary", act: go("prep", function () { prep(g, 0); }) },
        { label: "Equipment", ico: "equip", isNew: nwN ? nwN + " NEW!" : null, sub: nwN ? nwN + " new " + (nwN > 1 ? "items" : "item") + " in the bag" : "Wear or remove your Wizard Drip", cls: S.bag.length ? "is-hot" : "", act: go("equip", function () { equip(g, 0); }) },
        { label: "Magickal Condenser", ico: c1 ? "condenser" : "lock", sub: c1 ? "Upgrades and wares for Remnants" : "Locked: clear the forest", disabled: !c1, act: go("condenser", function () { condenser(g, 0); }) },
        { label: "Wizard Drip Armoire", ico: c1 ? "hat" : "lock", sub: c1 ? "Comfort wear and your hat" : "Locked: clear the forest", disabled: !c1, act: go("armoire", function () { armoire(g, 0); }) },
        { label: "Still Locked", ico: "lock", sub: "Mirror of Distortion and Brags (clear 2 levels) · Bookshelf (3) · Incantation Study (4)", disabled: true },
        { label: "Settings", ico: "gear", sub: "Sound and controls", act: function () { settings(g, 0); } },
        { label: "How To Play", ico: "scroll", sub: "The short version", act: function () { how(g); } }
      ] });
  }
  function prep(g, focus) {
    var c1 = !!S.cleared[1], st = calc(), items = [], owned = Object.keys(S.inc).filter(function (k) { return INC[k]; });
    items.push({ label: c1 ? "Run The Forest Again" : "Follow The Tracks", ico: "tree", sub: "The Forest Around the Tower · about 5 minutes, then a boss", cls: "is-primary", act: function () { save(); startRun(g, "story"); } });
    if (c1) items.push({ label: "Endless Forest", ico: "inf", sub: "Farm currency and gear. The boss returns every 6.5 minutes. Best " + fmt(S.best.endless1 || 0) + " m", cls: "is-gold", act: function () { save(); startRun(g, "endless"); } });
    for (var i = 0; i < incSlots(); i++) (function (slot) {
      var idx = items.length, id = S.incEq[slot] || "poof", I = INC[id];
      function turn(d) { var free = owned.filter(function (k) { return S.incEq.indexOf(k) < 0 || S.incEq[slot] === k; }), at = free.indexOf(id); S.incEq[slot] = free[cyc(at < 0 ? 0 : at, d, free.length)]; prep(g, idx); }
      items.push({ label: "Incantation " + (slot + 1), ico: "spark", sub: (owned.length > 1 ? "‹  " + I.n + "  ›" : I.n) + " · " + I.cast + " · mastery " + mlvl(id), cls: "wz-r" + I.r, adj: turn, act: function () { turn(1); } });
    })(i);
    var bid = S.buffEq[0];
    if (bid) {
      var rk = S.buffs[bid] || 0, cost = ORBCOST[rk], bi = items.length;
      items.push({ label: "Buff: " + BUFF[bid].n + "  " + pips(rk, 5), ico: "wing", sub: rk >= 5 ? "Fully upgraded · lasts " + r1(10 + st.ret + rk) + "s" : "Lasts " + r1(10 + st.ret + rk) + "s · upgrade for " + cost + " Whisper Orbs (you have " + S.orbs + ")",
        cls: rk < 5 && S.orbs >= cost ? "is-hot" : "", act: function () { if (rk >= 5) return; if (S.orbs < cost) { g.toast("Not enough Whisper Orbs"); return; } S.orbs -= cost; S.buffs[bid] = rk + 1; save(); sfx("buy"); prep(g, bi); } });
    } else items.push({ label: "Buff", sub: "Pick up your first Whisper Orb on a run to earn one", disabled: true });
    if (st.ton > 0) { var pi = items.length; items.push({ label: "Run Pace", sub: "‹  " + Math.round(100 + st.ton * S.speed) + "%  ›  of base speed", adj: function (d) { S.speed = clamp(S.speed + d * 0.25, 0, 1); prep(g, pi); }, act: function () { S.speed = S.speed >= 1 ? 0 : S.speed + 0.25; prep(g, pi); } }); }
    items.push({ label: "Incantations", ico: "grim", sub: owned.length + " owned · what each one does", act: function () { incList(g); } });
    items.push({ label: "Back", act: function () { save(); hub(g, 0); } });
    var kv = el("div", { class: "ak-kv" });
    S.ch.forEach(function (c) { var d = chDef(c.id); kv.appendChild(el("span", { text: d.n, title: d.d })); kv.appendChild(el("b", { text: Math.min(d.need, Math.floor(c.p)) + " / " + d.need })); kv.appendChild(el("em", { class: "wz-note", text: d.d })); });
    MN(g, { cls: "is-side wz-narrow", kicker: "Prep Time", title: "Plan The Dash", sub: "Challenges in play, 100 XP and 25 Remnants each:", body: kv, items: items, focus: focus, back: function () { save(); hub(g, 0); } });
  }
  function incList(g) {
    var items = Object.keys(S.inc).filter(function (k) { return INC[k]; }).map(function (id) { var I = INC[id], n = mnext(id);
      return { label: I.n, ico: "spark", sub: I.d + " " + I.m, more: [[RAR[I.r].n, "r" + I.r], [I.cast, ""], ["Mastery " + mlvl(id) + " / 10", "st"], [n == null ? "Maxed" : n + " kills to next", n == null ? "r4" : ""]], cls: "wz-r" + I.r, act: function () {} }; });
    items.push({ label: "Back", cls: "is-primary", act: function () { prep(g, 0); } });
    MN(g, { cls: "is-side is-wide", kicker: "Prep Time", title: "Incantations", sub: "Shattered Syllables: " + S.syl + " (spent at the Incantation Study, later)", items: items, focus: items.length - 1, back: function () { prep(g, 0); } });
  }
  function slotName(k) { var sd = slotDef(k); return /^sim/.test(k) ? "Simulacrum " + k.slice(3) : sd.n; }
  function equip(g, focus) {
    UI.scene = "bag";
    var st = calc(), open = openSlots();
    var items = open.map(function (k, i) { var it = S.eq[k], kind = /^sim/.test(k) ? "sim" : k, fit = S.bag.filter(function (q) { return q.s === kind; }), nn = fit.filter(function (q) { return q.nw; }).length;
      var chips = it ? itemChips(it) : [[slotName(k), ""], ["Nothing worn", "dim"]]; if (it) chips[1] = [slotName(k), ""];
      if (fit.length) chips.push([fit.length + " in the bag fit", "hot"]);
      return { label: it ? it.n : "Empty", ico: slotIco(k), chips: chips, isNew: nn ? nn + " NEW!" : null, cls: (it ? "wz-r" + it.r : "wz-empty") + (fit.length ? " is-hot" : ""), act: function () { slotMenu(g, k, 0, i); } }; });
    var nb = S.bag.filter(function (q) { return q.nw; }).length;
    items.push({ label: "Rummage In The Bag", ico: "equip", isNew: nb ? nb + " NEW!" : null, chips: [[S.bag.length + " / " + S.bagCap + " carried", ""], ["Sell what you don't need", "dim"]], act: function () { bag(g, 0, function () { equip(g, items.length - 2); }); } });
    items.push({ label: "Back", act: function () { hub(g, 1); } });
    var tiles = el("div", { class: "ak-stats wz-stats4" }); SK.forEach(function (k) { tiles.appendChild(tile(STAT[k].n, (k === "vit" ? r1(st.hp) + " HP" : "+" + st[k] + STAT[k].u), STAT[k].d)); });
    MN(g, { cls: "is-side is-wide wz-bag", kicker: "Inside the bag", title: "Wizard Drip", sub: "More slots open as your Wiz Level rises. Enemies only drop gear for slots you have.", body: tiles, grid: true, items: items, focus: focus, back: function () { hub(g, 1); } });
  }
  function slotMenu(g, k, focus, backF) {
    UI.scene = "bag";
    var kind = /^sim/.test(k) ? "sim" : k, cur = S.eq[k];
    function leave() { S.bag.forEach(function (q) { if (q.s === kind) delete q.nw; }); save(); equip(g, backF); }
    var items = S.bag.filter(function (q) { return q.s === kind; }).sort(function (x, y) { return (y.nw || 0) - (x.nw || 0) || y.r - x.r || y.il - x.il; }).map(function (it) {
      return { label: it.n, ico: slotIco(k), chips: itemChips(it), isNew: !!it.nw, cls: "wz-r" + it.r, act: function () { S.bag.splice(S.bag.indexOf(it), 1); delete it.nw; if (cur) S.bag.push(cur); S.eq[k] = it; sfx("buy"); leave(); } }; });
    if (cur) items.push({ label: "Take Off " + cur.n, sub: S.bag.length >= S.bagCap ? "The bag is full" : "Back into the bag", disabled: S.bag.length >= S.bagCap, act: function () { S.bag.push(cur); delete S.eq[k]; leave(); } });
    items.push({ label: "Back", act: leave });
    var body = cur ? el("div", { class: "wz-worn" }, el("span", { text: "Wearing now" }), el("b", { class: "wz-rt" + cur.r, text: cur.n }), (function () { var bx = el("span", { class: "wz-chips" }); itemChips(cur).forEach(function (c) { bx.appendChild(el("i", { class: "wz-chip " + (c[1] ? "is-" + c[1] : ""), text: c[0] })); }); return bx; })()) : null;
    MN(g, { cls: "is-side is-wide wz-bag", kicker: "Inside the bag", title: slotName(k), sub: cur ? "" : "Nothing worn here yet.", body: body, items: items, focus: focus, back: leave });
  }
  function bag(g, focus, back) {
    UI.scene = "bag";
    function leave() { S.bag.forEach(function (q) { delete q.nw; }); save(); back(); }
    var list = S.bag.slice().sort(function (x, y) { return (y.nw || 0) - (x.nw || 0); });
    var items = list.map(function (it, i) { return { label: it.n, ico: slotIco(it.s), chips: itemChips(it, [["Sells ◆ " + sellPrice(it), "rem"]]), isNew: !!it.nw, cls: "wz-r" + it.r,
      act: function () { MN(g, { kicker: "Sell", title: it.n, sub: "Sell it for " + sellPrice(it) + " Remnants? This can't be undone.", items: [
        { label: "Sell", ico: "coin", cls: "is-primary", act: function () { S.bag.splice(S.bag.indexOf(it), 1); S.rem += sellPrice(it); save(); sfx("buy"); bag(g, Math.min(i, S.bag.length), back); } },
        { label: "Keep It", act: function () { bag(g, i, back); } }], focus: 1, back: function () { bag(g, i, back); } }); } }; });
    items.push({ label: "Back", cls: "is-primary", act: leave });
    MN(g, { cls: "is-side is-wide wz-bag", kicker: "Inside the bag  ·  " + S.bag.length + " / " + S.bagCap, title: "The Bag", sub: S.bag.length ? "Select an item to sell it. Wear things from the slots." : "Empty. Enemies drop Wizard Drip now and then.", items: items, focus: focus, back: leave });
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
    plate(ctx, 890, 34, 300, 40); D.text(ctx, (S.wiz.name || "The Wizard") + "  ·  Wiz Lv " + S.lvl, 1040, 61, "700 20px " + SERIF, "#f3e6c4", "center");
  }
  function condenser(g, focus) {
    UI.scene = "hub";
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
    var items = RANKS.map(function (u, i) {
      var l = S.ranks[u.k] || 0, cost = rankCost(l), mx = l >= u.max, can = !mx && S.rem >= cost;
      return { label: u.n + "  " + (u.max <= 10 ? pips(l, u.max) : l + " / " + u.max), chips: mx ? [[u.d(l), "st"], ["Maxed", "r4"]] : [[u.d(l), ""], ["→ " + u.d(l + 1), "st"], ["◆ " + fmt(cost), can ? "rem" : "no"]], cls: can ? "is-hot" : mx ? "is-owned" : "",
        act: function () { if (mx) return; if (!can) { g.toast("Not enough Remnants"); return; } S.rem -= cost; cnt("spent", cost); S.ranks[u.k] = l + 1; save(); sfx("buy"); upgrades(g, i); } };
    });
    items.push({ label: "Back", act: function () { condenser(g, 0); } });
    MN(g, { cls: "is-side is-wide", kicker: "Magickal Condenser", title: "Upgrades", body: el("div", { class: "ak-stats" }, tile("Remnants", fmt(S.rem), "to spend")), grid: true, items: items, focus: focus, back: function () { condenser(g, 0); } });
  }
  function wares(g, focus) {
    var st = stock(), items = st.map(function (it, i) { var pr = buyPrice(it);
      return { label: it.n, ico: slotIco(it.s), chips: itemChips(it, [["◆ " + fmt(pr), S.rem >= pr ? "rem" : "no"]]), cls: "wz-r" + it.r + (S.rem >= pr ? " is-hot" : ""),
        act: function () { if (S.rem < pr) { g.toast("Not enough Remnants"); return; } if (S.bag.length >= S.bagCap) { g.toast("The bag is full"); return; } S.rem -= pr; cnt("spent", pr); st.splice(st.indexOf(it), 1); it.nw = 1; S.bag.push(it); save(); sfx("buy"); wares(g, Math.min(i, st.length)); } }; });
    [["social", 600], ["rainy", 1500]].forEach(function (w) { if (S.inc[w[0]]) return; var I = INC[w[0]], idx = items.length;
      items.push({ label: "Incantation: " + I.n, ico: "spark", sub: I.cast + ". " + I.d, chips: null, cls: "is-gold", price: w[1], act: function () { if (S.rem < w[1]) { g.toast("Not enough Remnants"); return; } S.rem -= w[1]; cnt("spent", w[1]); giveInc(w[0], g); save(); sfx("buy"); wares(g, Math.min(idx, items.length - 2)); } }); });
    items.push({ label: "Back", act: function () { condenser(g, 1); } });
    items.forEach(function (it) { if (it.price) it.label += "   ◆ " + fmt(it.price); });
    MN(g, { cls: "is-side is-wide", kicker: "Magickal Condenser", title: "Wares", sub: "Bought items go to the bag.", body: el("div", { class: "ak-stats" }, tile("Remnants", fmt(S.rem), "to spend"), tile("Bag", S.bag.length + " / " + S.bagCap)), items: items, focus: focus, back: function () { condenser(g, 1); } });
  }
  function armoire(g, focus) {
    MN(g, { cls: "is-side wz-narrow", kicker: "Wizard Drip Armoire", title: "The Armoire", sub: "What you wear around the tower. Runs always show your equipped gear.", focus: focus, back: function () { hub(g, 3); },
      items: [
        { label: "Around The Tower: " + (S.comfort ? "Comfort Wear" : "Equipped Gear"), ico: "chest", sub: "Comfort wear is the sleep cap, tunic and skivvies", act: function () { S.comfort = !S.comfort; save(); armoire(g, 0); } },
        { label: "Favorite Hat: " + (S.cos.hatOn ? "On" : "Off"), ico: "hat", sub: "Won back from the Grand Mud Imp. Worn over any headgear.", act: function () { S.cos.hatOn = !S.cos.hatOn; save(); armoire(g, 1); } },
        { label: "Back", act: function () { hub(g, 3); } }
      ] });
  }
  function settings(g, focus) {
    MN(g, { cls: "is-side wz-narrow", kicker: "Wizard of the Sprint", title: "Settings", focus: focus, back: function () {  hub(g, 4); },
      items: [
        { label: "Game Sound: " + (S.snd ? "On" : "Off"), ico: "sound", act: function () { S.snd = !S.snd; save(); sfx("buy"); settings(g, 0); } },
        { label: "Volume: " + Math.round(S.vol * 100) + "%", ico: "sound", sub: "‹  left and right  ›", adj: function (d) { S.vol = clamp(Math.round(S.vol * 10 + d) / 10, 0.1, 1); save(); sfx("rem"); settings(g, 1); }, act: function () { S.vol = S.vol >= 1 ? 0.1 : Math.round(S.vol * 10 + 1) / 10; save(); sfx("rem"); settings(g, 1); } },
        { label: "Keyboard Controls", ico: "keys", sub: "Rebind any action", act: function () { controls(g, "key", 0); } },
        { label: "Controller Controls", ico: "pad", sub: "Rebind any action", act: function () { controls(g, "pad", 0); } },
        { label: "Start Over", ico: "skull", sub: "Erase this wizard and everything they own", act: function () { MN(g, { kicker: "Start over", title: "Erase Everything?", sub: "Your wizard, gear, currencies and progress are deleted on this device, and on your account at the next sync. This can't be undone.",
          items: [{ label: "Keep My Wizard", cls: "is-primary", act: function () { settings(g, 4); } }, { label: "Erase And Start Over", act: function () { var kb = S.binds, pb = S.pad; S = fresh(); S.binds = kb; S.pad = pb; fillCh(); save(); title(g); } }], back: function () { settings(g, 4); } }); } },
        { label: "Back", act: function () {  hub(g, 4); } }
      ] });
  }
  function controls(g, kind, focus) {
    UI.scene = "hub"; UI.bind = null;
    var items = ACTS.map(function (a, i) { return { label: a[1], sub: kind === "key" ? keysOf(a[0]).map(keyName).join(" or ") : padOf(a[0]).toUpperCase(), act: function () { UI.scene = "rebind"; UI.bind = { a: a[0], kind: kind, i: i, name: a[1] }; g.closeMenu(); g.paint(); g.wake && g.wake(); } }; });
    items.push({ label: "Reset To Defaults", act: function () { if (kind === "key") S.binds = {}; else S.pad = {}; save(); controls(g, kind, items.length - 2); } });
    items.push({ label: "Back", act: function () { settings(g, kind === "key" ? 2 : 3); } });
    MN(g, { cls: "is-side is-wide", kicker: "Settings", title: kind === "key" ? "Keyboard Controls" : "Controller Controls", sub: "Select an action, then press the " + (kind === "key" ? "key" : "button") + " for it. Esc and P stay as pause.", grid: true, items: items, focus: focus, back: function () { settings(g, kind === "key" ? 2 : 3); } });
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
    MN(g, { cls: "is-side is-wide", kicker: "Wizard of the Sprint", title: "How To Play", back: function () { hub(g, 5); },
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
    MN(g, { kicker: "Save sync", title: "Two Saves, One Wizard", cls: "is-wide",
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
  var DEF = {
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
      if (UI.scene === "bag") { drawBagScene(g, ctx); return; }
      drawHubScene(g, ctx);
      if (UI.scene === "rebind" && UI.bind) {
        ctx.fillStyle = "rgba(4,8,14,.78)"; ctx.fillRect(0, 0, W, H);
        D.text(ctx, "Press a " + (UI.bind.kind === "key" ? "key" : "controller button") + " for", W / 2, H / 2 - 30, "600 26px " + F.display, "#b9c2cd", "center");
        D.text(ctx, UI.bind.name, W / 2, H / 2 + 22, "700 48px " + F.display, "#fff", "center");
        D.text(ctx, "Esc cancels", W / 2, H / 2 + 70, "500 18px " + F.mono, "#b9c2cd", "center");
      }
    }
  };
  /* Owner preview: the game only appears while a control panel session is live and the server confirms it. */
  var S0 = window.Site;
  /* A control panel sign-in leaves "site.adminSeen" (its session end, in ms) on this browser, so the preview
     also shows in other tabs until that session would have ended. Signing out removes it. */
  var seen = 0; try { seen = +localStorage.getItem("site.adminSeen") || 0; } catch (e) {}
  if (seen > Date.now()) A.register(DEF);
  else if (S0 && S0.admin && S0.admin.get()) S0.admin.check().then(function (r) { if (r && r.ok) A.register(DEF); });
})();
