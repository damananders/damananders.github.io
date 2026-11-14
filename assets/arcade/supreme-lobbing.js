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

  /* ---------------- prestige campaign (secret: opens once all 12 battles above are cleared) ---------------- */
  var PREGIONS = [
    { name: "Bureau Bay",          sky: ["#6b7280", "#c4c9d0"], sea: ["#4a6274", "#22333f"], wind: 0.7 },
    { name: "Feed Falls",          sky: ["#f472b6", "#fde2f3"], sea: ["#3a87b5", "#1b4f72"], wind: 0.75 },
    { name: "Audit Abyss",         sky: ["#8fb996", "#e3f1de"], sea: ["#2f6b5a", "#123a30"], wind: 0.85 },
    { name: "The Last Shore",      sky: ["#2a0f2e", "#7a1f3d"], sea: ["#2b1830", "#0b0710"], wind: 1 },
    { name: "Friends Archipelago", sky: ["#6d3fa0", "#f6a96b"], sea: ["#2f5e8c", "#132c47"], wind: 0.85 },
    { name: "Profit Pier",         sky: ["#3f7d4a", "#c9e8b2"], sea: ["#2a5d4f", "#0f2a22"], wind: 0.9 },
    { name: "Lighthouse Point",    sky: ["#5a1426", "#cd4257"], sea: ["#29324a", "#0c111c"], wind: 1 }
  ];
  /* character looks: skin, hair (bald/short/combover/wolf/bowl/long/curly), hairCol, beard (full/stache/stache70),
     goatee, glasses (70s/shades), eyes (blue), bloodshot, hat {col, patch: anime/wanted}, headset, hood, shirt, mark,
     over (suit/hoodie/poncho/open/coat) + overCol + tie, pants, shoes, w (body width), item, pin, orbs, smile */
  var LK = {
    gov: [
      { skin: "#e8c4a0", hair: "combover", hairCol: "#9aa0a6", over: "suit", overCol: "#4a5568", tie: "#c53030", shirt: "#f7fafc", pants: "#2d3748", shoes: "#111", item: "briefcase" },
      { skin: "#d9a982", hair: "short", hairCol: "#3b2a1e", glasses: "shades", over: "suit", overCol: "#2d3748", tie: "#2b6cb0", shirt: "#f7fafc", pants: "#1a202c", shoes: "#111", item: "briefcase" },
      { skin: "#f0cfb4", hair: "bald", over: "suit", overCol: "#5a6170", tie: "#d69e2e", shirt: "#f7fafc", pants: "#2d3748", shoes: "#111", item: "briefcase", stache: true },
      { skin: "#c68a63", hair: "short", hairCol: "#1a1a1a", shirt: "#e2e8f0", tie: "#4a5568", pants: "#4a5568", shoes: "#222", item: "phone" }
    ],
    infl: [
      { skin: "#f3d2bc", hair: "long", hairCol: "#f6e05e", glasses: "shades", shirt: "#ed64a6", pants: "#f7fafc", shoes: "#f7fafc", item: "phone", smile: true },
      { skin: "#a8724f", hair: "short", hairCol: "#9f7aea", shirt: "#38b2ac", pants: "#1a202c", shoes: "#f6e05e", item: "phone", hat: { col: "#1a202c" }, smile: true },
      { skin: "#f0c7a6", hair: "long", hairCol: "#2d1b14", shirt: "#f6ad55", pants: "#2b6cb0", shoes: "#fff", item: "phone", smile: true },
      { skin: "#e9bf9b", hair: "short", hairCol: "#c05621", glasses: "shades", shirt: "#4299e1", pants: "#e2e8f0", shoes: "#e53e3e", item: "phone", smile: true }
    ],
    bigc: [
      { skin: "#f0cfb4", hair: "short", hairCol: "#d4b483", over: "suit", overCol: "#1c4532", tie: "#68d391", shirt: "#f7fafc", pants: "#1a202c", shoes: "#111", item: "moneybag", smile: true },
      { skin: "#e8c4a0", hair: "combover", hairCol: "#3b2a1e", over: "suit", overCol: "#111827", tie: "#38a169", shirt: "#f7fafc", pants: "#111827", shoes: "#111", item: "moneybag", glasses: "shades" },
      { skin: "#f3d6c0", hair: "bald", over: "suit", overCol: "#22543d", tie: "#d4af37", shirt: "#f7fafc", pants: "#1a202c", shoes: "#111", item: "moneybag", smile: true },
      { skin: "#d9a982", hair: "short", hairCol: "#111", over: "suit", overCol: "#2f855a", tie: "#f6e05e", shirt: "#f7fafc", pants: "#1a202c", shoes: "#111", item: "phone", glasses: "shades" }
    ],
    keaton: { skin: "#f6d5bd", hair: "wolf", hairCol: "#a4572f", beard: "stache", beardCol: "#a4572f", shirt: "#141414", mark: "🤘", pants: "#2d3748", shoes: "#111", w: 18, item: "controller" },
    mark:   { skin: "#f6d5bd", hair: "short", hairCol: "#b8935e", headset: true, shirt: "#6b46c1", mark: "F", pants: "#2a4365", shoes: "#e2e8f0", w: 18, item: "keyboard", pin: "maple" },
    dwayne: { skin: "#5b3a29", hair: "bald", hat: { col: "#1a202c", patch: "anime" }, shirt: "#718096", hoodUnder: true, over: "poncho", overCol: "#b7791f", pants: "#2c5282", shoes: "#6b3e1e", w: 28, item: "mic", smile: true },
    ally:   { skin: "#f3d2bc", hair: "bowl", hairCol: "#c8923f", over: "coat", overCol: "#2c5282", shirt: "#1a202c", pants: "#1a202c", shoes: "#111", w: 21 },
    goof:   { skin: "#f0c8a8", hair: "curly", hairCol: "#6b4423", beard: "stache70", beardCol: "#5a381c", goatee: true, glasses: "70s", shirt: "#edf2f7", over: "open", overCol: "#c97b2a", pants: "#4a5568", shoes: "#5a3a1a", w: 20, item: "mic", smile: true },
    dylan:  { skin: "#f3d2bc", hair: "short", hairCol: "#8b5a2b", eyes: "blue", bloodshot: true, hat: { col: "#d9c39a", patch: "wanted" }, over: "hoodie", overCol: "#9aa5b1", shirt: "#9aa5b1", pants: "#2b6cb0", shoes: "#7b4a1e", item: "cards", orbs: true },
    anders: { skin: "#f2c6a0", hair: "long", hairCol: "#6b4423", beard: "full", beardCol: "#6b4423", hood: true, over: "hoodie", overCol: "#cdb98c", shirt: "#cdb98c", pants: "#2d3748", shoes: "#1a202c", item: "controller", smile: true }
  };
  var PRESTIGE = [
    { r: 0, name: "Duh Gubberment", short: "The Gubberment", crew: 4, looks: LK.gov, names: ["Clerk", "Deputy", "Sub-Clerk", "Intern"], planks: 8, walls: 2, tower: 1, hp: 120, ammo: ["bouncer", "splitter"], acc: 1.2,
      traits: ["redtape"], skin: "form", flag: "⚖", sail: "#4a5568", blurb: "Seizes your ammo, loses its own in paperwork",
      lines: ["Please take a number.", "Your throw is denied pending review.", "Form 27-B is missing a signature.", "We'll get back to you in 6 to 8 weeks.", "Have you tried the other window?"] },
    { r: 1, name: "Annoying Influencers", short: "The Influencers", crew: 4, looks: LK.infl, names: ["@yolo.vibes", "@its.brayden", "@glowqueen", "@unboxdaddy"], planks: 8, walls: 1, tower: 1, hp: 115, ammo: ["bouncer", "gull"], acc: 1.25,
      traits: ["flash"], skin: "phone", flag: "♥", sail: "#ec4899", blurb: "Ring-light flashes hide your aim guide",
      lines: ["Smash that like button!", "This raft is sponsored!", "Use my code for 10% off!", "Wait, let me film that again.", "Hey guys, welcome back to my raft!"] },
    { r: 2, name: "Taxes", short: "Taxes", crew: 1, look: "doc", scale: 1.3, planks: 8, walls: 2, tower: 0, hp: 300, ammo: ["splitter", "bomb"], acc: 1.3,
      traits: ["hop"], skin: "paper", flag: "%", sail: "#2f855a", blurb: "Hops to a new spot every turn",
      lines: ["You owe.", "Interest is accruing.", "Did you itemize?", "Penalty applied.", "Nothing is certain except me."] },
    { r: 3, name: "Death", short: "Death", crew: 1, look: "reaper", scale: 1.45, planks: 8, walls: 2, tower: 1, hp: 280, ammo: ["fire", "bomb"], acc: 1.35,
      traits: ["reaper"], skin: "skull", flag: "☠", sail: "#111", wood: "#3a2a24", blurb: "Calls lightning, and only waits 20 seconds a throw",
      lines: ["Tick tock.", "Everyone's turn comes.", "No rush. Actually, rush.", "I have all the time. You don't."] },
    { r: 4, name: "Keaton, the Kind", short: "Keaton", crew: 1, look: LK.keaton, scale: 1.3, planks: 8, walls: 2, tower: 0, hp: 280, ammo: ["bouncer", "bomb"], acc: 1.35,
      traits: ["kind"], skin: "pick", flag: "⚡", sail: "#2d3748", blurb: "Kind enough to patch you up now and then",
      lines: ["Turn it up to eleven! 🤘", "Good game so far, buddy.", "Riff incoming!", "One more round, then food."] },
    { r: 4, name: "Mark, The Busy", short: "Mark", crew: 1, look: LK.mark, scale: 1.3, planks: 8, walls: 2, tower: 1, hp: 250, ammo: ["splitter", "gull"], acc: 1.4,
      traits: ["busy"], skin: "key", flag: "maple", sail: "#c53030", blurb: "Sometimes too busy to take his turn",
      lines: ["Sorry, one sec, on a call.", "Can we circle back on this?", "Just finishing a ranked match, eh.", "Sorry! Sorry. Okay, throwing."] },
    { r: 4, name: "Dwayne, Production Master", short: "Dwayne", crew: 1, look: LK.dwayne, scale: 1.45, planks: 9, walls: 2, tower: 0, hp: 340, ammo: ["bomb", "fire"], acc: 1.4,
      traits: ["beat", "dance"], skin: "vinyl", flag: "♫", sail: "#6b46c1", blurb: "Dances out of the way, beats leave a haze",
      lines: ["Drop the beat.", "Feel that bass.", "Hold up, I'm vibing.", "Watch the footwork."] },
    { r: 5, name: "Big Cannabis", short: "Big Cannabis", crew: 4, looks: LK.bigc, names: ["Founder", "CEO", "Investor", "VP of Synergy"], planks: 9, walls: 3, tower: 2, hp: 135, ammo: ["bomb", "splitter", "gull"], acc: 1.45, cannon: true,
      traits: ["buyout"], skin: "money", flag: "$", sail: "#22543d", blurb: "Buys back its raft every turn",
      lines: ["Synergy!", "Let's disrupt your raft.", "Quarterly profits, baby.", "We're pivoting to your destruction.", "Think of the shareholders.", "Circle back, leverage, monetize."] },
    { r: 4, name: "Ally, Aires Allmother", short: "Ally", crew: 1, look: LK.ally, scale: 1.25, dmgMul: 0.7, planks: 9, walls: 3, tower: 1, hp: 320, ammo: ["bomb", "gull", "fire"], acc: 1.5,
      traits: ["command"], skin: "star", flag: "✦", sail: "#2c5282", blurb: "Her crew hits harder and keeps healing",
      lines: ["Hold the line.", "On my mark.", "I expect better. I know you've got it.", "Good. Again."] },
    { r: 4, name: "Goof, Son of Raba", short: "Goof", crew: 1, look: LK.goof, scale: 1.4, planks: 8, walls: 2, tower: 1, hp: 300, ammo: ["bouncer", "splitter", "bomb"], acc: 1.5,
      traits: ["nowind"], skin: "record", flag: "☮", sail: "#c97b2a", blurb: "His throws ignore the wind",
      lines: ["No cops on this sea, man.", "The wind's just a suggestion.", "Peace, love and lobbing.", "It's all connected, man."] },
    { r: 4, name: "Dylan, Dab Dominator", short: "Dylan", crew: 1, look: LK.dylan, scale: 1.3, planks: 9, walls: 2, tower: 1, hp: 320, ammo: ["fire", "bomb", "gull"], acc: 1.55,
      traits: ["bend"], skin: "wax", flag: "✺", sail: "#b7791f", blurb: "Bends his shots toward your crew",
      lines: ["Concentrate, man.", "It bends to my will.", "Rare pull!", "Hold on, quick dab."] },
    { r: 6, name: "DaManAnders", short: "DaManAnders", crew: 1, look: LK.anders, scale: 1.35, planks: 9, walls: 3, tower: 2, hp: 420, ammo: ["bomb", "fire", "gull", "splitter", "bouncer"], acc: 1.6, cannon: true,
      traits: ["copycat", "phases"], skin: "controller", flag: "lighthouse", sail: "#cd4257", blurb: "Copies your throws and powers up as he loses",
      lines: ["GG. Now let's go again.", "Welcome to the arcade!", "I built this raft. I know its weak spots.", "Thumbs up! 👍", "That throw looked familiar…"] }
  ];
  function pcleared() { return sget("pcleared", []) || []; }
  function prestigeOpen() { return cleared().length >= BATTLES.length; }

  /* ---------------- battle state ---------------- */
  var B = null, MO = Site.reducedMotion ? 0.6 : 1;

  function makeRaft(side, o) {
    var n = o.planks, x0 = side < 0 ? Math.max(24, 330 - n * PW) : Math.min(W - 24 - n * PW, W - 330);
    var r = { side: side, x0: x0, n: n, phase: Math.random() * 6, deck: [], walls: [], crew: [], cannon: null, ammo: {}, name: o.name, human: o.human, flag: o.flag || "★", sail: o.sail || "#cd4257", wood: o.wood || "#a0703f", acc: o.acc || 1, bhp: o.bhp || 3,
      traits: (o.traits || []).slice(), skin: o.skin || null, mul: 1 };
    var tr = r.traits; r.nowind = tr.indexOf("nowind") >= 0; r.bend = tr.indexOf("bend") >= 0; r.fizzle = tr.indexOf("redtape") >= 0; if (tr.indexOf("command") >= 0) r.mul = 1.3;
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
      r.crew.push({ role: role, name: o.names ? o.names[i] : role.name, col: col, hp: o.hp, max: o.hp, alive: true, special: true, burn: 0, swim: false, anim: 0, dx: (i % 2 ? 8 : -6) * (cols.length < o.crew ? 1 : 0),
        look: o.looks ? o.looks[i % o.looks.length] : null, scale: o.scale || 1, armor: o.dmgMul || 1, dance: tr.indexOf("dance") >= 0 });
    }
    o.ammo.forEach(function (a) { r.ammo[a] = (r.ammo[a] || 0) + (o.ammoN || 2); });
    r.ammo.rock = Infinity;
    r.turn = 0;
    return r;
  }
  function bob(r) { return Math.sin(B.t * 1.3 * MO + r.phase) * 5 * B.waves; }
  function deckY(r) { return WY - 22 + bob(r); }
  function colX(r, c) { return r.x0 + c * PW + PW / 2; }
  function crewPos(r, m) {
    var s = m.scale || 1, x = colX(r, m.col) + m.dx, y = deckY(r) - 26 * s + (m.swim ? 30 : 0);
    if (m.dance) x += Math.sin(B.t * 2.4) * 14;                              /* Dwayne never stands still */
    if (m.look === "doc") y -= Math.abs(Math.sin(B.t * 4)) * 10;              /* Taxes hops */
    return { x: x, y: y };
  }
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
    var p = crewPos(r, t.m), s = t.m.scale || 1; return { x: p.x + r.side * -12 * s, y: p.y - 30 * s };
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
    } else if (kind === "prestige") {
      var P = PRESTIGE[idx]; region = PREGIONS[P.r];
      foeCfg = { name: P.name, crew: P.crew, planks: P.planks, walls: P.walls, tower: P.tower, hp: P.hp, ammo: P.ammo, ammoN: 3, bhp: 4, cannon: P.cannon, acc: P.acc,
        sail: P.sail, wood: P.wood || "#5a3a22", flag: P.flag, names: P.names || [P.short], looks: P.looks || [P.look], scale: P.scale || 1, dmgMul: P.dmgMul, traits: P.traits, skin: P.skin,
        roles: [{ key: "boss", name: P.short, hat: "#000", shirt: "#000", special: "bomb", pow: 1.05 }] };
    } else {
      region = REGIONS[(Math.random() * 3) | 0];
      foeCfg = { name: "Player 2", human: true, crew: 3, planks: 7, walls: 1, tower: 0, hp: 120, ammo: AMMO_ORDER.slice(1), ammoN: 2, bhp: 4, sail: "#3b82f6", wood: "#6b4426", flag: "⚓" };
    }
    var keep = kind === "endless" && idx > 0 && B && B.mine ? B.mine : null;
    B = { kind: kind, idx: idx, region: region, t: 0, waves: 1, wind: 0, projs: [], fx: [], debris: [], phase: "aim", turnSide: -1, settle: 0, timer: 0,
      aim: { ang: 0.75, pow: 0.62, charging: false, chargeDir: 1, drag: null }, sel: 0, ammoSel: "rock", log: [], over: false, ai: null, firstTurn: true,
      bolts: [], reaper: 0, blind: false, haze: false, flash: 0, foeTurns: 0, lastHuman: null };
    B.mine = keep || makeRaft(-1, mine);
    if (keep) { refit(B.mine); }
    B.foe = makeRaft(1, foeCfg);
    if ((kind === "campaign" && idx < 2) || (kind === "endless" && idx < 2)) B.foe.crew.forEach(function (m) { m.special = false; });   /* early foes have no specials */
    B.windMax = region.wind;
    newTurn(g, -1);
    g.start(); Site.sfx("open");
    g.toast(kind === "campaign" ? REGIONS[BATTLES[idx].r].name + ": " + BATTLES[idx].name : kind === "prestige" ? PREGIONS[PRESTIGE[idx].r].name + ": " + PRESTIGE[idx].name : kind === "endless" ? "Wave " + (idx + 1) : "Versus: Player 1 starts", "info");
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
    if (B.kind === "prestige") traitTurn(g, s);
    B.firstTurn = false;
  }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  function hasT(r, k) { return r.traits && r.traits.indexOf(k) >= 0; }
  function hop(r) {                              /* Taxes jumps to another free plank */
    var used = {}; r.walls.forEach(function (w) { used[w.col] = 1; }); if (r.cannon) used[r.cannon.col] = 1;
    r.crew.forEach(function (m) {
      if (!m.alive) return;
      var cols = r.deck.filter(function (b) { return b.alive && !used[b.i] && b.i !== m.col; }).map(function (b) { return b.i; });
      if (!cols.length) return;
      var from = crewPos(r, m); m.col = pick(cols); m.swim = false; used[m.col] = 1;
      ring(from.x, from.y - 10, 26, "rgba(255,255,255,.8)");
    });
  }
  var BUZZ = ["Synergy", "Disruption", "Leverage", "Growth hacking", "Vertical integration", "Monetization", "Shareholder value", "Paradigm shift"];
  function traitTurn(g, s) {
    var foe = B.foe, P = PRESTIGE[B.idx], msg = null;
    if (s < 0) {                                 /* the player's turn begins */
      if (hasT(foe, "hop")) hop(foe);
      if (hasT(foe, "reaper")) B.reaper = 20;
      return;
    }
    var n = ++B.foeTurns, mine = B.mine;
    if (hasT(foe, "phases")) {                   /* DaManAnders powers up as he loses */
      var boss = foe.crew[0], f = boss.alive ? boss.hp / boss.max : 0;
      if (f < 0.66 && !hasT(foe, "flash")) { foe.traits.push("flash"); g.toast("DaManAnders powers up: ring light on!", "bad"); }
      if (f < 0.33 && !hasT(foe, "lightning")) { foe.traits.push("lightning"); foe.bend = true; g.toast("DaManAnders goes all out: bending shots and lightning!", "bad"); }
    }
    if (hasT(foe, "busy") && Math.random() < 0.35) { B.ai = null; B.timer = 1.4; g.toast("Mark is busy (on a call, eh). Turn skipped.", "good"); return; }
    if (hasT(foe, "redtape") && Math.random() < 0.3) {
      var ks = AMMO_ORDER.slice(1).filter(function (k) { return mine.ammo[k] > 0; });
      if (ks.length) { var k = pick(ks); mine.ammo[k]--; msg = "Red tape: 1 " + AMMO[k].name + " seized for review"; }
    }
    if (hasT(foe, "flash") && Math.random() < 0.5) { B.blind = true; B.flash = 0.9; msg = msg || "Ring-light flash! No aim guide on your next throw"; }
    if (hasT(foe, "beat")) { B.haze = true; msg = msg || pick(["Dwayne drops a beat. The air gets hazy.", "Dwayne lights up. Hazy over there.", "Bass drop! You can barely see his raft."]); }
    if (hasT(foe, "kind") && n % 3 === 0) {
      mine.crew.forEach(function (m) { if (m.alive) m.hp = Math.min(m.max, m.hp + 20); });
      msg = "Keaton, the Kind patches up your crew (+20). Good game, buddy.";
    }
    if (hasT(foe, "buyout")) {
      var dead = foe.deck.filter(function (b) { return !b.alive; });
      if (dead.length) { var b = dead[0]; b.alive = true; b.hp = b.max; foe.crew.forEach(function (m) { if (m.col === b.i) m.swim = false; }); msg = msg || pick(BUZZ) + "! Big Cannabis buys back a plank."; }
      else { var lo = foe.crew.filter(function (m) { return m.alive && m.hp < m.max; }).sort(function (a, c) { return a.hp - c.hp; })[0]; if (lo) { lo.hp = Math.min(lo.max, lo.hp + 15); msg = msg || pick(BUZZ) + "! " + lo.name + " gets a bonus (+15)."; } }
    }
    if (hasT(foe, "command")) { var healed = 0; foe.crew.forEach(function (m) { if (m.alive && m.hp < m.max) { m.hp = Math.min(m.max, m.hp + 15); healed++; } }); if (healed) msg = msg || "Ally steadies herself (+15)."; }
    if ((hasT(foe, "reaper") || hasT(foe, "lightning")) && n % 2 === 1) {
      var tg = mine.crew.filter(function (m) { return m.alive; });
      if (tg.length) { B.bolts.push({ x: crewPos(mine, pick(tg)).x, warn: 1.1 }); B.timer = Math.max(B.timer, 1.6); msg = msg || "Lightning is coming!"; }
    }
    if (hasT(foe, "copycat") && B.lastHuman && B.ai && Math.random() < 0.4) {
      var la = B.lastHuman, can = availAmmo(foe, thrower()).some(function (a) { return a.k === la.ammo; });
      B.ai = { ang: la.ang, pow: la.pow, ammo: can ? la.ammo : B.ai.ammo }; msg = "DaManAnders copies your last throw!";
    }
    if (!msg && P.lines && Math.random() < 0.5) msg = P.short + ": \u201c" + pick(P.lines) + "\u201d";
    if (msg) g.toast(msg, "info");
  }
  function strike(g, bolt) {                     /* lightning lands */
    B.fx.push({ bolt: true, x: bolt.x, life: 0.4, seed: Math.random() * 100 });
    B.flash = Math.max(B.flash, 0.5);
    var r = B.mine;
    r.crew.forEach(function (m) { if (!m.alive) return; var c = crewPos(r, m); if (Math.abs(c.x - bolt.x) < 38) dmgCrew(g, r, m, 25, "lightning"); });
    r.deck.forEach(function (b) { if (!b.alive) return; var rc = blockRect(r, b, false); if (Math.abs(rc.x + rc.w / 2 - bolt.x) < 30) dmgBlock(r, b, 1, rc); });
    Site.sfx("error");
  }
  function reap(g) {                             /* Death got tired of waiting */
    B.reaper = 0; B.aim.charging = false; B.aim.drag = null;
    var r = B.mine;
    r.deck.forEach(function (b) { if (b.alive) dmgBlock(r, b, 99, blockRect(r, b, false)); });
    r.walls.forEach(function (w) { if (w.alive) dmgBlock(r, w, 99, blockRect(r, w, true)); });
    B.fx.push({ bolt: true, x: r.x0 + r.n * PW / 2, life: 0.6, seed: 7 }); B.flash = 1;
    g.toast("Death got tired of waiting. Your raft is gone.", "bad");
    B.phase = "fly"; B.settle = 0;
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
    p.vy += GRAV * dt; if (!p.nowind) p.vx += wind * 240 * dt;
  }
  function throwNow(g) {
    var r = side(B.turnSide), t = thrower(), choice = availAmmo(r, t).filter(function (a) { return a.k === B.ammoSel; })[0] || { k: "rock" };
    var o = originOf(r, t), v = launchVel(B.turnSide, B.aim.ang, speedOf(r, t, B.aim.pow));
    var p = { k: choice.k, x: o.x, y: o.y, vx: v.vx, vy: v.vy, age: 0, from: B.turnSide, bounces: 0, alive: true, trail: [] };
    if (choice.k === "gull") p.homing = true;
    if (r.nowind) p.nowind = true;
    if (r.bend && choice.k !== "repair") p.bend = true;
    if (r.fizzle && Math.random() < 0.15) p.fizzleAt = 0.5 + Math.random() * 0.4;
    if (r.skin && !choice.special && (choice.k === "rock" || choice.k === "ball")) p.skin = r.skin;
    if (r.human) { B.blind = false; B.haze = false; B.reaper = 0; B.lastHuman = { ang: B.aim.ang, pow: B.aim.pow, ammo: choice.special ? "rock" : choice.k }; }
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
      for (var i = 0; i < r.crew.length; i++) { var m = r.crew[i]; if (!m.alive) continue; var c = crewPos(r, m), sc = m.scale || 1; if (Math.hypot(p.x - c.x, p.y - (c.y - 12 * sc)) < 26 * sc) return { r: r, crew: m }; }
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
    n *= m.armor || 1;
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
    var mul = side(p.from).mul || 1;
    [B.mine, B.foe].forEach(function (r) {
      r.crew.forEach(function (m) {
        if (!m.alive) return; var sc = m.scale || 1, c = crewPos(r, m), d = Math.hypot(c.x - x, c.y - 12 * sc - y);
        if (d < a.rad + 14 * sc) { dmgCrew(g, r, m, a.crew * mul * (d < 26 * sc ? 1 : 0.55)); if (a.burn) m.burn = a.burn; }
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
        if (p.fizzleAt && p.age > p.fizzleAt) { p.alive = false; ring(p.x, p.y, 24, "#e2e8f0"); g.toast("Lost in paperwork", "good"); break; }
        if (p.bend && p.age > 0.4) {             /* dab bending: steer toward the nearest enemy */
          var bf = side(-p.from), bt = null, bdd = 1e9;
          bf.crew.forEach(function (m) { if (!m.alive) return; var c = crewPos(bf, m), dd = Math.hypot(c.x - p.x, c.y - p.y); if (dd < bdd) { bdd = dd; bt = c; } });
          if (bt) { var wa = Math.atan2(bt.y - 14 - p.y, bt.x - p.x), ca = Math.atan2(p.vy, p.vx), df = Math.atan2(Math.sin(wa - ca), Math.cos(wa - ca)), bsp = Math.hypot(p.vx, p.vy); ca += Math.max(-1.2 * h, Math.min(1.2 * h, df)); p.vx = Math.cos(ca) * bsp; p.vy = Math.sin(ca) * bsp; }
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
          if (hit.crew) dmgCrew(g, hit.r, hit.crew, a.crew * (side(p.from).mul || 1), null);
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
      var dd = simulate(r.side, a, speedOf(r, t, pw), o, target, pick.k === "gull" || r.nowind ? 0 : B.wind);
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
      if (won && first && cleared().length >= BATTLES.length) {
        sub = "Secret unlocked: the Prestige Campaign is now on the main menu.";
        items.unshift({ label: "Prestige Campaign", cls: "is-gold", sub: "Twelve new bosses", act: function () { prestigeMenu(g); } });
      }
      Site.sfx(won ? "success" : "error");
    } else if (kind === "prestige") {
      var P = PRESTIGE[idx], pf = pcleared().indexOf(idx) < 0;
      if (won) { earned = 50 + idx * 10 + (pf ? 60 : 0); if (pf) { var pc = pcleared(); pc.push(idx); sset("pcleared", pc); } } else earned = 10;
      addCoins(earned);
      title = won ? P.short + " defeated!" : "Your raft went down";
      sub = won ? (idx === PRESTIGE.length - 1 ? "You beat DaManAnders himself. GG, well played." : pf ? "First clear bonus included." : "") : P.blurb + ".";
      row("Boss", P.name); row("Enemy crew knocked out", lost + " of " + B.foe.crew.length); row("Your crew lost", mineLost); row("Coins", "+" + earned + "  (" + coins() + " total)");
      if (won && idx + 1 < PRESTIGE.length) items.push({ label: "Next Boss", cls: "is-primary", act: function () { startBattle(g, "prestige", idx + 1); } });
      items.push({ label: won ? "Replay" : "Retry", cls: won ? "" : "is-primary", act: function () { startBattle(g, "prestige", idx); } });
      items.push({ label: "Shipwright", sub: coins() + " coins", act: function () { shop(g, function () { prestigeMenu(g); }); } });
      items.push({ label: "Prestige Map", act: function () { prestigeMenu(g); } });
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
    g.menu({ kicker: kind === "campaign" ? REGIONS[BATTLES[idx].r].name : kind === "prestige" ? "Prestige · " + PREGIONS[PRESTIGE[idx].r].name : kind === "endless" ? "Endless Survival" : "Versus", title: title, sub: sub, body: kv, items: items, back: function () { g.toTitle(); } });
  }

  function update(g, dt) {
    B.t += dt;
    var r = side(B.turnSide), human = r.human;
    [B.mine, B.foe].forEach(function (rr) { rr.crew.forEach(function (m) { if (m.anim > 0) m.anim = Math.max(0, m.anim - dt); else if (m.anim < 0) m.anim = Math.min(0, m.anim + dt); }); });
    if (B.flash > 0) B.flash = Math.max(0, B.flash - dt * 1.4);
    for (var bi = B.bolts.length - 1; bi >= 0; bi--) { B.bolts[bi].warn -= dt; if (B.bolts[bi].warn <= 0) { strike(g, B.bolts[bi]); B.bolts.splice(bi, 1); } }
    if (B.phase === "aim" && human && B.reaper > 0) { B.reaper -= dt; if (B.reaper <= 0) { reap(g); return; } }
    if (B.phase === "aim" && human) aimInput(g, dt);
    else if (B.phase === "ai") {
      B.timer -= dt;
      if (B.ai) { B.aim.ang += (B.ai.ang - B.aim.ang) * Math.min(1, dt * 3); B.aim.pow += (B.ai.pow - B.aim.pow) * Math.min(1, dt * 3); B.ammoSel = B.ai.ammo; }
      if (B.timer <= 0) { if (B.ai) { B.aim.ang = B.ai.ang; B.aim.pow = B.ai.pow; throwNow(g); } else endTurn(g); }
    } else if (B.phase === "fly") {
      stepProjectiles(g, dt);
      if (!B.projs.length) { B.settle += dt; if (B.settle > 0.7) endTurn(g); }
    }
    for (var i = B.fx.length - 1; i >= 0; i--) { var f = B.fx[i]; f.life -= dt; if (f.ring) f.r += (f.max - f.r) * Math.min(1, dt * 12); else if (f.txt) f.y += f.vy * dt; else if (!f.bolt) { f.vy += 600 * dt; f.x += f.vx * dt; f.y += f.vy * dt; } if (f.life <= 0) B.fx.splice(i, 1); }
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
  function showGuide() { if (B.blind && side(B.turnSide).human) return false; var m = guideMode(); if (m === "always") return true; if (m === "never") return false; var k = aiLevel().key; return B.kind === "versus" || k === "sloppy" || k === "fair"; }
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
    if (r.flag === "maple") canFlag(x, mx - r.side * 28, dy - 110, 34);
    else if (r.flag === "lighthouse") {
      var lx = mx - r.side * 26, ly = dy - 86;
      fillPath(x, "#f7fafc", [[lx - 7, ly], [lx + 7, ly], [lx + 4, ly - 34], [lx - 4, ly - 34]]);
      x.fillStyle = "#c53030"; x.fillRect(lx - 6, ly - 10, 12, 5); x.fillRect(lx - 5, ly - 24, 10, 5);
      x.fillStyle = "rgba(255,236,150," + (0.45 + Math.sin(t * 3) * 0.25) + ")"; x.beginPath(); x.moveTo(lx, ly - 39); x.lineTo(lx - r.side * 40, ly - 50); x.lineTo(lx - r.side * 40, ly - 28); x.closePath(); x.fill();
      circ(x, "#f6e05e", lx, ly - 38, 4); x.fillStyle = "#1a202c"; x.fillRect(lx - 5, ly - 44, 10, 3);
    }
    else { x.fillStyle = "#fff"; x.font = "700 26px " + F.display; x.textAlign = "center"; x.fillText(r.flag, mx - r.side * 26, dy - 100); }
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
    var c = crewPos(r, m), face = -r.side, s = m.scale || 1;
    if (!m.alive) { x.globalAlpha = 0.5; x.fillStyle = "#cbd5e0"; x.font = "700 " + Math.round(18 * s) + "px " + F.display; x.textAlign = "center"; x.fillText("✕", c.x, c.y + 6); x.globalAlpha = 1; return; }
    var active = B.phase !== "fly" && B.turnSide === r.side && thrower() && thrower().m === m;
    var arm = m.anim > 0 ? -2.4 + (0.4 - m.anim) * 8 : active ? -(B.aim.ang + 0.6) : -0.5;
    if (m.anim < 0) { x.save(); x.translate(Math.sin(t * 60) * 3, 0); }
    if (m.look) {
      x.save(); x.translate(c.x, c.y); x.scale(s, s);
      if (m.look === "doc") drawDoc(x, face, t);
      else if (m.look === "reaper") drawReaper(x, face, arm, t);
      else drawPerson(x, m.look, face, arm, t);
      x.restore();
    } else {
      x.fillStyle = "#2d3748"; x.fillRect(c.x - 7, c.y + 6, 5, 16); x.fillRect(c.x + 2, c.y + 6, 5, 16);
      x.fillStyle = m.role.shirt; D.rr(x, c.x - 11, c.y - 16, 22, 26, 6); x.fill();
      x.save(); x.translate(c.x + face * 6, c.y - 10); x.scale(face, 1); x.rotate(arm); x.strokeStyle = "#f1c9a5"; x.lineWidth = 6; x.lineCap = "round"; x.beginPath(); x.moveTo(0, 0); x.lineTo(20, 0); x.stroke(); x.restore();
      x.fillStyle = "#f1c9a5"; x.beginPath(); x.arc(c.x, c.y - 26, 11, 0, 6.3); x.fill();
      x.fillStyle = "#1a202c"; x.beginPath(); x.arc(c.x + face * 4, c.y - 28, 1.8, 0, 6.3); x.fill();
      x.fillStyle = m.role.hat; x.beginPath(); x.ellipse(c.x, c.y - 35, 13, 5, 0, 0, 6.3); x.fill(); x.fillRect(c.x - 8, c.y - 44, 16, 10);
    }
    if (m.burn > 0) { x.fillStyle = "rgba(255,120,40,.8)"; x.beginPath(); x.arc(c.x - 6 * s, c.y - 6 * s, (5 + Math.random() * 3) * s, 0, 6.3); x.fill(); }
    if (m.anim < 0) x.restore();
    var top = m.look === "reaper" ? 72 : m.look === "doc" ? 52 : 62, bw = 40 * Math.min(1.5, s), p = m.hp / m.max, by0 = c.y - top * s - (r.crew.length > 3 && r.crew.indexOf(m) % 2 ? 22 : 0);
    x.fillStyle = "rgba(0,0,0,.45)"; D.rr(x, c.x - bw / 2, by0, bw, 7, 3); x.fill();
    x.fillStyle = p > 0.5 ? "#68d391" : p > 0.25 ? "#f6c445" : "#fc8181"; D.rr(x, c.x - bw / 2, by0, Math.max(3, bw * p), 7, 3); x.fill();
    x.fillStyle = "#fff"; x.font = "700 12px " + F.display; x.textAlign = "center"; x.fillText(m.name + (m.special ? " ★" : ""), c.x, by0 - 6);
    if (active) { x.fillStyle = "#fff"; x.beginPath(); var by = by0 - 30 + Math.sin(t * 6) * 3; x.moveTo(c.x - 8, by); x.lineTo(c.x + 8, by); x.lineTo(c.x, by + 10); x.fill(); }
  }

  /* ---- character drawer: origin at the body centre, feet at y +22, head at y -26, +x faces the enemy ---- */
  function fillPath(x, col, pts) { x.fillStyle = col; x.beginPath(); pts.forEach(function (q, i) { i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]); }); x.closePath(); x.fill(); }
  function circ(x, col, cx, cy, rad) { x.fillStyle = col; x.beginPath(); x.arc(cx, cy, rad, 0, 6.3); x.fill(); }
  var MAPLE = [[0, -9], [1.6, -5.5], [3.6, -6.5], [3, -2.2], [6.5, -3.4], [5.4, -0.4], [7.6, 1], [3.4, 3.2], [3.8, 5.4], [0.6, 4.4], [0.6, 8], [-0.6, 8], [-0.6, 4.4], [-3.8, 5.4], [-3.4, 3.2], [-7.6, 1], [-5.4, -0.4], [-6.5, -3.4], [-3, -2.2], [-3.6, -6.5], [-1.6, -5.5]];
  function maple(x, cx, cy, k, col) { fillPath(x, col, MAPLE.map(function (q) { return [cx + q[0] * k, cy + q[1] * k]; })); }
  function canFlag(x, cx, cy, w) {                /* a small Canadian flag */
    var h = w / 2; x.fillStyle = "#fff"; x.fillRect(cx - w / 2, cy - h / 2, w, h);
    x.fillStyle = "#d52b1e"; x.fillRect(cx - w / 2, cy - h / 2, w / 4, h); x.fillRect(cx + w / 4, cy - h / 2, w / 4, h);
    maple(x, cx, cy, w / 40, "#d52b1e");
  }
  function hairCap(x, col, browY, backY) {        /* hair over the top of the head, down to browY at the front and backY at the back */
    x.fillStyle = col; x.beginPath(); x.arc(0, -26, 12, Math.PI, 0); x.lineTo(12, browY); x.quadraticCurveTo(2, browY - 7, -8, browY - 2); x.lineTo(-12, backY); x.closePath(); x.fill();
  }
  function drawPerson(x, L, face, arm, t) {
    var w = L.w || 22, hw = w / 2, sk = L.skin || "#f1c9a5", hc = L.hairCol || "#3b2a1e", oc = L.overCol || L.shirt || "#718096";
    x.save(); x.scale(face, 1);
    /* behind the body */
    if (L.hood) { circ(x, shade(oc, -14), -2, -26, 16); }
    if (L.hair === "long") { x.fillStyle = hc; D.rr(x, -13, -34, 18, L.hood ? 26 : 32, 7); x.fill(); }
    if (L.hair === "wolf") fillPath(x, hc, [[-12, -34], [-14, -12], [-10, -16], [-8, -9], [-5, -15], [-2, -12], [2, -20], [8, -30]]);
    if (L.hair === "curly") [[-13, -30], [-15, -22], [-14, -14], [-11, -7], [-7, -10], [-9, -36], [-2, -39], [6, -38], [12, -33]].forEach(function (q) { circ(x, hc, q[0], q[1], 6.5); });
    if (L.orbs) for (var i = 0; i < 3; i++) { var an = t * 2.2 + i * 2.09; if (Math.sin(an) < 0) { circ(x, "rgba(246,173,85,.35)", Math.cos(an) * 24, -14 + Math.sin(an) * 7, 7); circ(x, "#f6ad55", Math.cos(an) * 24, -14 + Math.sin(an) * 7, 4); } }
    /* legs and shoes */
    x.fillStyle = L.pants || "#2d3748"; x.fillRect(-hw + 4, 6, 5, 14); x.fillRect(hw - 9, 6, 5, 14);
    x.fillStyle = L.shoes || "#1a202c"; D.rr(x, -hw + 3, 18, 9, 5, 2); x.fill(); D.rr(x, hw - 10, 18, 9, 5, 2); x.fill();
    /* torso */
    if (L.hoodUnder) circ(x, shade(L.shirt, -10), -5, -15, 8);
    x.fillStyle = L.shirt || "#e2e8f0"; D.rr(x, -hw, -16, w, 26, 6); x.fill();
    if (L.over === "suit") {
      x.fillStyle = oc; D.rr(x, -hw, -16, w, 26, 6); x.fill();
      fillPath(x, L.shirt || "#fff", [[-4, -16], [5, -16], [0.5, -4]]);
      fillPath(x, L.tie || "#c53030", [[-1.2, -15], [2.2, -15], [3, -2], [0.5, 2], [-2, -2]]);
    } else if (L.over === "hoodie") {
      x.fillStyle = oc; D.rr(x, -hw, -16, w, 26, 6); x.fill();
      if (!L.hood) circ(x, shade(oc, -12), -6, -15, 7);
      x.strokeStyle = shade(oc, -40); x.lineWidth = 1.5; x.beginPath(); x.moveTo(2, -14); x.lineTo(2, 9); x.stroke();
      x.strokeStyle = "#e2e8f0"; x.beginPath(); x.moveTo(-1, -14); x.lineTo(-1, -6); x.moveTo(5, -14); x.lineTo(5, -6); x.stroke();
      x.fillStyle = shade(oc, -16); D.rr(x, -hw + 3, 1, w - 6, 7, 3); x.fill();
    } else if (L.over === "poncho") {
      fillPath(x, oc, [[-hw - 2, -15], [hw + 2, -15], [hw + 9, 6], [-hw - 9, 6]]);
      ["#f6e05e", "#2c7a7b", "#c53030"].forEach(function (col, k) { x.fillStyle = col; x.fillRect(-hw - 4 - k * 2, -8 + k * 5, w + 8 + k * 4, 2.5); });
      circ(x, "#fff", 3, -8, 4.6); circ(x, "#1a202c", 1.4, -8.4, 1.6); circ(x, "#1a202c", 4.8, -8.4, 1.6); circ(x, "#fff", 1.9, -9, 0.6); circ(x, "#fff", 5.3, -9, 0.6);
    } else if (L.over === "open") {
      x.fillStyle = oc; D.rr(x, -hw, -16, 7, 26, 4); x.fill(); D.rr(x, hw - 7, -16, 7, 26, 4); x.fill();
      fillPath(x, shade(oc, -20), [[-hw + 2, -16], [-hw + 9, -16], [-hw + 6, -10]]); fillPath(x, shade(oc, -20), [[hw - 9, -16], [hw - 2, -16], [hw - 6, -10]]);
    } else if (L.over === "coat") {
      x.fillStyle = oc; D.rr(x, -hw, -16, w, 30, 5); x.fill();
      x.fillStyle = "#d4af37"; x.fillRect(-hw - 2, -16, 7, 3); x.fillRect(hw - 5, -16, 7, 3);
      for (var bb = 0; bb < 3; bb++) { circ(x, "#d4af37", -3, -10 + bb * 6, 1.3); circ(x, "#d4af37", 4, -10 + bb * 6, 1.3); }
      x.fillStyle = "#1a202c"; x.fillRect(-hw, 2, w, 3);
    } else if (L.tie) fillPath(x, L.tie, [[-1, -15], [2, -15], [2.6, -3], [0.5, 0], [-1.6, -3]]);
    if (L.mark) { x.save(); x.scale(face, 1); x.fillStyle = L.mark === "F" ? "#fff" : "#f7fafc"; x.font = "800 " + (L.mark === "F" ? 13 : 11) + "px " + F.display; x.textAlign = "center"; x.fillText(L.mark, L.mark === "F" ? 0 : 0, -1); x.restore(); }
    if (L.pin === "maple") canFlag(x, -hw + 5, -10, 8);
    /* held item in the off hand */
    var it = L.item;
    if (it === "keyboard") { x.save(); x.translate(-hw - 4, 2); x.rotate(-0.5); x.fillStyle = "#1a202c"; D.rr(x, -16, -4, 30, 9, 2); x.fill(); x.fillStyle = "#a0aec0"; for (var kx = 0; kx < 6; kx++) { x.fillRect(-14 + kx * 4.6, -2.5, 3, 2.5); x.fillRect(-14 + kx * 4.6, 1, 3, 2.5); } x.restore(); }
    else if (it === "phone") { x.fillStyle = "#111"; D.rr(x, -hw - 6, -10, 7, 12, 2); x.fill(); x.fillStyle = "#90cdf4"; x.fillRect(-hw - 5, -8.5, 5, 8); }
    else if (it === "briefcase") { x.fillStyle = "#6b4426"; D.rr(x, -hw - 12, 2, 13, 10, 2); x.fill(); x.strokeStyle = "#3b2414"; x.lineWidth = 1.5; x.strokeRect(-hw - 8, -0.5, 5, 3); }
    else if (it === "moneybag") { circ(x, "#c9a66b", -hw - 6, 6, 7); x.fillStyle = "#c9a66b"; x.fillRect(-hw - 8, -3, 4, 4); x.fillStyle = "#22543d"; x.font = "800 9px " + F.display; x.textAlign = "center"; x.fillText("$", -hw - 6, 9); }
    else if (it === "cards") { [-0.4, 0, 0.4].forEach(function (a, k) { x.save(); x.translate(-hw - 4, 0); x.rotate(a); x.fillStyle = ["#e53e3e", "#f6e05e", "#4299e1"][k]; D.rr(x, -3, -10, 7, 10, 1.5); x.fill(); x.strokeStyle = "#fff"; x.lineWidth = 1; D.rr(x, -3, -10, 7, 10, 1.5); x.stroke(); x.restore(); }); }
    else if (it === "mic") { x.fillStyle = "#1a202c"; x.save(); x.translate(-hw - 3, -2); x.rotate(-0.4); x.fillRect(-1.5, -2, 3, 12); circ(x, "#a0aec0", 0, -4, 3.6); x.restore(); }
    else if (it === "controller") { x.fillStyle = "#1a202c"; D.rr(x, -hw - 12, -2, 16, 9, 4); x.fill(); circ(x, "#cd4257", -hw - 1, 1, 1.4); circ(x, "#68d391", -hw + 1.5, 3, 1.4); x.fillStyle = "#4a5568"; x.fillRect(-hw - 9, 1.5, 4, 1.4); x.fillRect(-hw - 7.7, 0.2, 1.4, 4); }
    /* throwing arm */
    x.save(); x.translate(6, -10); x.rotate(arm); x.strokeStyle = L.over && L.over !== "poncho" ? oc : L.over === "poncho" ? oc : (L.shirt || sk); x.lineWidth = 6; x.lineCap = "round"; x.beginPath(); x.moveTo(0, 0); x.lineTo(13, 0); x.stroke();
    x.strokeStyle = sk; x.beginPath(); x.moveTo(13, 0); x.lineTo(20, 0); x.stroke(); x.restore();
    /* head */
    circ(x, sk, 0, -26, 11);
    if (L.hair === "short") hairCap(x, hc, -29, -24);
    else if (L.hair === "combover") { hairCap(x, hc, -31, -25); x.strokeStyle = shade(hc, 30); x.lineWidth = 1; x.beginPath(); x.moveTo(-9, -33); x.quadraticCurveTo(0, -38, 10, -33); x.stroke(); }
    else if (L.hair === "wolf") { hairCap(x, hc, -27, -20); fillPath(x, hc, [[2, -36], [12, -30], [11, -24], [8, -27], [6, -24], [4, -28]]); }
    else if (L.hair === "bowl") { hairCap(x, hc, -25, -22); x.strokeStyle = shade(hc, -40); x.lineWidth = 1.4; x.beginPath(); x.moveTo(1, -38); x.lineTo(3, -31); x.stroke(); }
    else if (L.hair === "long") { if (!L.hood) hairCap(x, hc, -28, -16); else fillPath(x, hc, [[-6, -36], [10, -36], [11, -30], [2, -32], [-6, -30]]); }
    else if (L.hair === "curly") [[-8, -35], [-1, -38], [6, -37], [10, -34]].forEach(function (q) { circ(x, hc, q[0], q[1], 5.5); });
    else if (L.hair === "bald") { x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 2; x.beginPath(); x.arc(0, -26, 8, 3.6, 4.4); x.stroke(); }
    /* face */
    var ey = -28;
    if (L.eyes === "blue") { circ(x, L.bloodshot ? "#ffd9d9" : "#fff", 4.5, ey, 2.6); circ(x, "#1e90ff", 5, ey, 1.6); circ(x, "#111", 5.2, ey, 0.7); if (L.bloodshot) { x.strokeStyle = "#e53e3e"; x.lineWidth = 0.6; x.beginPath(); x.moveTo(2, ey - 1); x.lineTo(3.4, ey); x.moveTo(2.2, ey + 1.2); x.lineTo(3.6, ey + 0.4); x.stroke(); } }
    else circ(x, "#1a202c", 4.5, ey, 1.8);
    if (L.beard === "full") {
      x.fillStyle = L.beardCol || hc; x.beginPath(); x.moveTo(-9, -27); x.quadraticCurveTo(-8, -10, 3, -10); x.quadraticCurveTo(11, -11, 11.5, -24); x.lineTo(9, -22); x.quadraticCurveTo(4, -20, 0, -22); x.quadraticCurveTo(-4, -22, -6, -27); x.closePath(); x.fill();
    }
    if (L.smile) { x.fillStyle = L.beard === "full" ? "#7a2e2e" : "#5a1e1e"; x.beginPath(); x.arc(5.5, -20.5, 3.2, 0.1, Math.PI - 0.1); x.fill(); x.fillStyle = "#fff"; x.fillRect(3, -20.5, 5, 1.3); }
    else if (L.beard !== "full") { x.strokeStyle = "#5a1e1e"; x.lineWidth = 1.2; x.beginPath(); x.moveTo(3.5, -20); x.lineTo(8, -20); x.stroke(); }
    if (L.beard === "stache" || L.stache) { x.fillStyle = L.beardCol || hc; D.rr(x, 1.5, -23.8, 10, 3.6, 1.6); x.fill(); }
    if (L.beard === "stache70") fillPath(x, L.beardCol || hc, [[0, -24.5], [12, -24.5], [12.5, -17], [10, -17], [9.5, -21.5], [2.5, -21.5], [2, -17], [-0.5, -17]]);
    if (L.goatee) { x.fillStyle = L.beardCol || hc; D.rr(x, 4, -16.5, 4, 4, 1.5); x.fill(); }
    if (L.glasses === "70s") { x.strokeStyle = "#6b4426"; x.lineWidth = 1.6; x.fillStyle = "rgba(246,173,85,.35)"; D.rr(x, -2.5, -32.5, 6.5, 7, 2); x.fill(); x.stroke(); D.rr(x, 4.8, -32.5, 6.5, 7, 2); x.fill(); x.stroke(); }
    else if (L.glasses === "shades") { x.fillStyle = "#111"; D.rr(x, -1, -31, 12.5, 4.6, 2); x.fill(); }
    if (L.hat) {
      x.fillStyle = L.hat.col; x.beginPath(); x.arc(0, -30, 12, Math.PI, 0); x.closePath(); x.fill(); D.rr(x, 3, -32, 15, 3.8, 1.8); x.fill();
      if (L.hat.patch === "anime") { circ(x, "#fff", -1, -36, 4.6); circ(x, "#2b6cb0", -2.8, -36.4, 1.7); circ(x, "#2b6cb0", 0.8, -36.4, 1.7); circ(x, "#fff", -2.3, -37.1, 0.6); circ(x, "#fff", 1.3, -37.1, 0.6); x.strokeStyle = "#e53e3e"; x.lineWidth = 0.8; x.beginPath(); x.arc(-1, -34.6, 1.3, 0.3, 2.8); x.stroke(); }
      if (L.hat.patch === "wanted") { x.fillStyle = "#efe2b8"; x.fillRect(-5, -40, 9, 10); x.fillStyle = "#3b2a1e"; x.fillRect(-4, -39, 7, 1.4); circ(x, "#a0703f", -0.5, -35, 2.4); x.fillRect(-4, -32, 7, 1); }
    }
    if (L.headset) {
      x.strokeStyle = "#111"; x.lineWidth = 3; x.beginPath(); x.arc(0, -27, 13, Math.PI * 1.08, Math.PI * 1.92); x.stroke();
      x.fillStyle = "#111"; D.rr(x, -12, -32, 8, 12, 3); x.fill(); circ(x, "#a0aec0", -8, -26, 3.2); circ(x, "#718096", -8, -26, 1.4);
      x.strokeStyle = "#111"; x.lineWidth = 1.6; x.beginPath(); x.moveTo(-6, -22); x.quadraticCurveTo(0, -16, 8, -19); x.stroke();
    }
    if (L.hood) { x.strokeStyle = oc; x.lineWidth = 5; x.beginPath(); x.arc(-1, -27, 13.5, Math.PI * 0.75, Math.PI * 1.95); x.stroke(); }
    if (L.orbs) for (i = 0; i < 3; i++) { an = t * 2.2 + i * 2.09; if (Math.sin(an) >= 0) { circ(x, "rgba(246,173,85,.35)", Math.cos(an) * 24, -14 + Math.sin(an) * 7, 7); circ(x, "#fbd38d", Math.cos(an) * 24, -14 + Math.sin(an) * 7, 4); } }
    x.restore();
  }
  function drawDoc(x, face, t) {                  /* Taxes: a hopping, angry tax form */
    x.save(); x.scale(face, 1);
    x.strokeStyle = "#1a202c"; x.lineWidth = 3; x.beginPath(); x.moveTo(-6, 8); x.lineTo(-7, 22); x.moveTo(6, 8); x.lineTo(7, 22); x.stroke();
    fillPath(x, "#f7f7ef", [[-16, -38], [9, -38], [17, -30], [17, 12], [-16, 12]]);
    fillPath(x, "#d9d9c8", [[9, -38], [9, -30], [17, -30]]);
    x.strokeStyle = "#a0aec0"; x.lineWidth = 1.2; for (var i = 0; i < 6; i++) { x.beginPath(); x.moveTo(-12, -12 + i * 4); x.lineTo(13, -12 + i * 4); x.stroke(); }
    x.fillStyle = "#2f855a"; x.font = "800 8px " + F.mono; x.textAlign = "left"; x.fillText("FORM 1040", -13, -30);
    circ(x, "#fff", -4, -22, 4); circ(x, "#fff", 7, -22, 4); circ(x, "#111", -3, -21.5, 2); circ(x, "#111", 8, -21.5, 2);
    x.strokeStyle = "#111"; x.lineWidth = 2; x.beginPath(); x.moveTo(-9, -29); x.lineTo(-1, -26); x.moveTo(12, -29); x.lineTo(4, -26); x.stroke();
    x.beginPath(); x.arc(2, -13, 4, Math.PI * 1.15, Math.PI * 1.85); x.stroke();
    x.restore();
  }
  function drawReaper(x, face, arm, t) {          /* Death */
    x.save(); x.scale(face, 1);
    var sway = Math.sin(t * 2) * 2;
    x.strokeStyle = "#5a4630"; x.lineWidth = 3; x.beginPath(); x.moveTo(-14, 22); x.lineTo(-10 + sway, -56); x.stroke();
    x.fillStyle = "#cbd5e0"; x.beginPath(); x.moveTo(-10 + sway, -56); x.quadraticCurveTo(14, -66, 26, -44); x.quadraticCurveTo(10, -54, -9 + sway, -50); x.closePath(); x.fill();
    fillPath(x, "#141018", [[-15, 22], [15, 22], [11, -14], [12, -30], [3, -44], [-9, -40], [-13, -24], [-11, -10]]);
    x.fillStyle = "#050307"; x.beginPath(); x.ellipse(3, -27, 7.5, 10, 0, 0, 6.3); x.fill();
    var gl = 0.7 + Math.sin(t * 5) * 0.3;
    circ(x, "rgba(127,219,255," + gl + ")", 1, -29, 1.9); circ(x, "rgba(127,219,255," + gl + ")", 6, -29, 1.9);
    x.save(); x.translate(5, -8); x.rotate(arm); x.strokeStyle = "#141018"; x.lineWidth = 6; x.lineCap = "round"; x.beginPath(); x.moveTo(0, 0); x.lineTo(14, 0); x.stroke(); circ(x, "#e2e8f0", 17, 0, 3); x.restore();
    x.restore();
  }
  function drawSkin(x, p, t) {                    /* what bosses throw instead of plain rocks */
    var k = p.skin; x.save(); x.translate(p.x, p.y); x.rotate(p.age * 7);
    if (k === "form" || k === "paper") { x.fillStyle = "#f7f7ef"; x.fillRect(-8, -10, 16, 20); x.strokeStyle = k === "paper" ? "#2f855a" : "#a0aec0"; x.lineWidth = 1.2; for (var i = 0; i < 4; i++) { x.beginPath(); x.moveTo(-5, -5 + i * 4); x.lineTo(5, -5 + i * 4); x.stroke(); } if (k === "form") { x.fillStyle = "#c53030"; x.font = "800 7px " + F.mono; x.textAlign = "center"; x.fillText("DENIED", 0, -6); } }
    else if (k === "phone") { x.fillStyle = "#111"; D.rr(x, -6, -10, 12, 20, 3); x.fill(); x.fillStyle = "#f687b3"; x.fillRect(-4.5, -8, 9, 15); }
    else if (k === "skull") { circ(x, "#edf2f7", 0, -2, 9); x.fillRect(-5, 4, 10, 6); circ(x, "#1a202c", -3.5, -3, 2.6); circ(x, "#1a202c", 3.5, -3, 2.6); }
    else if (k === "pick") { x.fillStyle = "#111"; x.beginPath(); x.moveTo(-9, -8); x.quadraticCurveTo(0, -12, 9, -8); x.quadraticCurveTo(6, 6, 0, 11); x.quadraticCurveTo(-6, 6, -9, -8); x.fill(); x.fillStyle = "#e53e3e"; x.font = "800 9px " + F.display; x.textAlign = "center"; x.fillText("⚡", 0, 3); }
    else if (k === "key") { x.fillStyle = "#e2e8f0"; D.rr(x, -9, -9, 18, 18, 3); x.fill(); x.fillStyle = "#cbd5e0"; D.rr(x, -6, -7, 12, 11, 2); x.fill(); x.fillStyle = "#1a202c"; x.font = "800 9px " + F.mono; x.textAlign = "center"; x.fillText("W", 0, 1); }
    else if (k === "vinyl" || k === "record") { circ(x, "#111", 0, 0, 11); x.strokeStyle = "#2d2d2d"; x.lineWidth = 1; x.beginPath(); x.arc(0, 0, 7.5, 0, 6.3); x.stroke(); circ(x, k === "vinyl" ? "#9f7aea" : "#f6ad55", 0, 0, 4); circ(x, "#111", 0, 0, 1); }
    else if (k === "money") { x.fillStyle = "#68a35a"; x.fillRect(-12, -6, 24, 12); x.strokeStyle = "#2f5d27"; x.lineWidth = 1.2; x.strokeRect(-10, -4, 20, 8); x.fillStyle = "#1c4532"; x.font = "800 9px " + F.display; x.textAlign = "center"; x.fillText("$", 0, 3); }
    else if (k === "wax") { circ(x, "rgba(246,173,85,.35)", 0, 0, 13); x.fillStyle = "#f6ad55"; x.beginPath(); x.moveTo(-8, 2); x.quadraticCurveTo(-6, -9, 2, -7); x.quadraticCurveTo(10, -3, 7, 4); x.quadraticCurveTo(0, 9, -8, 2); x.fill(); circ(x, "#fde2a8", -2, -3, 2); }
    else if (k === "controller") { x.fillStyle = "#1a202c"; D.rr(x, -12, -7, 24, 14, 6); x.fill(); circ(x, "#cd4257", 6, -1, 2); circ(x, "#68d391", 9, 2, 2); x.fillStyle = "#718096"; x.fillRect(-9, -1, 6, 2); x.fillRect(-7, -3, 2, 6); }
    else if (k === "star") { x.fillStyle = "#f6e05e"; x.beginPath(); for (i = 0; i < 10; i++) { var rr = i % 2 ? 4.5 : 11, an = i * Math.PI / 5 - Math.PI / 2; i ? x.lineTo(Math.cos(an) * rr, Math.sin(an) * rr) : x.moveTo(Math.cos(an) * rr, Math.sin(an) * rr); } x.closePath(); x.fill(); }
    else circ(x, "#9aa3ad", 0, 0, 9);
    x.restore();
  }
  function drawProj(x, p, t) {
    var key = p.k === "shard" ? "splitter" : p.k, a = AMMO[key];
    x.strokeStyle = p.bend ? "rgba(246,173,85,.6)" : "rgba(255,255,255,.35)"; x.lineWidth = 3; x.beginPath(); p.trail.forEach(function (q, i) { i ? x.lineTo(q.x, q.y) : x.moveTo(q.x, q.y); }); x.stroke();
    if (p.y < 0) { x.fillStyle = "#fff"; x.beginPath(); x.moveTo(p.x, 6); x.lineTo(p.x - 9, 22); x.lineTo(p.x + 9, 22); x.fill(); D.text(x, Math.round(-p.y) + "", p.x, 40, "700 12px " + F.mono, "#fff", "center"); return; }
    if (p.skin) { drawSkin(x, p, t); return; }
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
    if (B.reaper > 0 && B.phase === "aim" && side(B.turnSide).human) D.text(x, "☠ Death waits " + Math.ceil(B.reaper) + "s", wx, 116, "800 20px " + F.display, B.reaper < 6 ? "#fc8181" : "#fff", "center");
    else if (B.blind && B.phase === "aim" && side(B.turnSide).human) D.text(x, "Blinded by the ring light: no aim guide", wx, 116, "700 15px " + F.display, "#fbd38d", "center");
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
  function paintBest(g) { var c = cleared().length; g.setBest(c + "/" + BATTLES.length + " battles" + (prestigeOpen() ? "  ·  prestige " + pcleared().length + "/" + PRESTIGE.length : "") + "  ·  best wave " + (sget("bestWave", 0) || 0) + "  ·  " + coins() + " coins"); }
  function titleMenu(g) {
    paintBest(g);
    g.menu({
      cls: "is-hero", kicker: "Arcade", title: "Supreme Lobbing",
      sub: "Lob rocks, bombs and seagulls at the enemy raft before they sink yours. Mind the wind.",
      items: [
        { label: "Campaign", cls: "is-primary", sub: cleared().length + " of " + BATTLES.length + " battles won", act: function () { campaignMenu(g); } }
      ].concat(prestigeOpen() ? [{ label: "Prestige Campaign", cls: "is-gold", sub: pcleared().length + " of " + PRESTIGE.length + " bosses beaten", act: function () { prestigeMenu(g); } }] : []).concat([
        { label: "Endless Survival", sub: "Best: " + (sget("bestWave", 0) || 0) + " waves", act: function () { B = null; startBattle(g, "endless", 0); } },
        { label: "Versus (2 Players)", sub: "Take turns on one keyboard or controller", act: function () { startBattle(g, "versus", 0); } },
        { label: "Shipwright", sub: coins() + " coins · upgrades and decor", act: function () { shop(g, function () { titleMenu(g); }); } },
        { label: "Settings", sub: "Enemy aim: " + aiLevel().name, act: function () { settingsMenu(g); } },
        { label: "How to Play", act: function () { howMenu(g, function () { titleMenu(g); }); } }
      ]),
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
  function prestigeMenu(g) {
    var pc = pcleared(), items = PRESTIGE.map(function (P, i) {
      var open = i === 0 || pc.indexOf(i - 1) >= 0 || pc.indexOf(i) >= 0, done = pc.indexOf(i) >= 0;
      return { label: (i + 1) + ". " + (open ? P.name : "???") + (done ? " ✓" : ""), sub: open ? PREGIONS[P.r].name + " · " + P.blurb : "Locked", cls: "is-gold", disabled: !open,
        act: function () { startBattle(g, "prestige", i); } };
    });
    items.push({ label: "Back", act: function () { titleMenu(g); } });
    var next = 0; for (var i = 0; i < PRESTIGE.length; i++) if (pc.indexOf(i) < 0) { next = i; break; }
    paintBest(g);
    g.menu({ kicker: "Secret", title: "Prestige Campaign", sub: "Twelve bosses, each with their own tricks. Enemy aim: " + aiLevel().name + ".", items: items, grid: true, cls: "is-wide", back: function () { titleMenu(g); }, focus: Math.min(next, items.length - 1) });
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
    init: function (g) { paintBest(g); g.debug = { B: function () { return B; }, start: function (k, i) { startBattle(g, k, i); } }; },
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
      if (B.haze && B.phase === "aim" && side(B.turnSide).human) {   /* Dwayne's haze hangs over his raft */
        for (var hz = 0; hz < 7; hz++) { var hx = W * 0.56 + hz * 85 + Math.sin(B.t * 0.7 + hz) * 30, hy = 380 + Math.cos(B.t * 0.5 + hz * 1.7) * 90, gr = x.createRadialGradient(hx, hy, 10, hx, hy, 150); gr.addColorStop(0, "rgba(190,205,180,.62)"); gr.addColorStop(1, "rgba(190,205,180,0)"); x.fillStyle = gr; x.fillRect(hx - 150, hy - 150, 300, 300); }
      }
      B.bolts.forEach(function (b) {                   /* lightning warning */
        x.fillStyle = "rgba(20,10,30,.8)"; x.beginPath(); x.ellipse(b.x, 40, 70, 22, 0, 0, 6.3); x.ellipse(b.x + 40, 30, 46, 18, 0, 0, 6.3); x.fill();
        x.strokeStyle = "rgba(255,240,150," + (0.4 + Math.sin(B.t * 20) * 0.3) + ")"; x.setLineDash([8, 10]); x.lineWidth = 3; x.beginPath(); x.moveTo(b.x, 60); x.lineTo(b.x, WY - 30); x.stroke(); x.setLineDash([]);
        D.text(x, "⚡", b.x, 120, "800 30px " + F.display, "#f6e05e", "center");
      });
      if ((B.phase === "aim" || B.phase === "ai") && g.state === "play") drawAim(x, g);
      B.projs.forEach(function (p) { drawProj(x, p, t); });
      B.fx.forEach(function (f) {
        x.globalAlpha = Math.max(0, Math.min(1, f.life * 2));
        if (f.ring) { x.strokeStyle = f.col; x.lineWidth = 5; x.beginPath(); x.arc(f.x, f.y, f.r, 0, 6.3); x.stroke(); }
        else if (f.bolt) { x.strokeStyle = "#fffbd0"; x.lineWidth = 6; x.shadowColor = "#f6e05e"; x.shadowBlur = 20; x.beginPath(); x.moveTo(f.x, 0); for (var by = 40; by < WY - 20; by += 40) x.lineTo(f.x + Math.sin(by * 0.13 + f.seed) * 22, by); x.lineTo(f.x, WY - 20); x.stroke(); x.shadowBlur = 0; }
        else if (f.txt) D.text(x, f.txt, f.x, f.y, "800 22px " + F.display, f.col, "center");
        else { x.fillStyle = f.col; x.fillRect(f.x - 3, f.y - 3, 6, 6); }
      });
      x.globalAlpha = 1;
      if (B.flash > 0) { x.fillStyle = "rgba(255,255,255," + Math.min(0.85, B.flash) + ")"; x.fillRect(0, 0, W, H); }
      hud(g, x);
    }
  });
})();
