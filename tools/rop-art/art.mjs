// tools/rop-art/art.mjs: box art + missing facts for the Rate-O-Pedia info cards, from libretro.
//   node tools/rop-art/art.mjs <games.tsv>      (games.tsv = id, console, votes, title; e.g. from the rop-dump branch)
// For every platform with a libretro-database list it reads the .rdb, matches each game by its tidied title, and:
//   * stores the box-art path as "a" ("<libretro system>/<No-Intro name>"); pages load
//     https://thumbnails.libretro.com/<system>/Named_Boxarts/<name>.png and hide it if it doesn't exist
//   * fills a missing release year, developer, publisher or genre from libretro's data (never overwrites)
// Writes only the shards that changed in assets/data/gameinfo/.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { readRdb } from "../rop-catalog/rdb.mjs";
import { cleanTitle } from "../rop-catalog/libretro.mjs";
import { PLATFORMS } from "../../assets/pages/games.platforms.js";

const INFO = process.env.INFO || "assets/data/gameinfo";
const RAW = "https://raw.githubusercontent.com/libretro/libretro-database/master/rdb/";
// libretro lists for platforms whose game list came from elsewhere
const EXTRA = { PS1: ["Sony - PlayStation"], PS2: ["Sony - PlayStation 2"], PSP: ["Sony - PlayStation Portable"], PS3: ["Sony - PlayStation 3"] };
const SKIP = /\((?:beta|proto|prototype|demo|sample|kiosk|debug|test|pirate)[^)]*\)|\[b\]|\bbios\b/i;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const ROMAN = { ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10", xi: "11", xii: "12", xiii: "13" };
function norm(t) {   // same as tools/rop-catalog/catalog.mjs
  return String(t || "").normalize("NFKC").toLowerCase()
    .replace(/\[[^\]]*\]|\([^)]*\)/g, " ")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ").replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ").filter(Boolean).map((w) => ROMAN[w] || w).filter((w) => w !== "the" && w !== "a").join(" ")
    .replace(/\s+/g, " ").trim();
}
const fnv = (s) => { let h = 0x811c9dc5; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
const shardOf = (id) => (fnv(id) & 0xfff).toString(16).padStart(3, "0");
const thumbName = (n) => n.replace(/[&*/:`<>?\\|"]/g, "_");
const region = (n) => /\((?:[^)]*\b(?:USA|World)\b[^)]*)\)/.test(n) ? 0 : /\((?:[^)]*\b(?:Europe|UK|Australia)\b[^)]*)\)/.test(n) ? 1 : /\(Japan/.test(n) ? 3 : 2;

// titles per platform
const src = process.argv[2];
if (!src) { console.error("usage: node tools/rop-art/art.mjs <games.tsv[.gz]>"); process.exit(1); }
let tsv = fs.readFileSync(src); if (src.endsWith(".gz")) tsv = zlib.gunzipSync(tsv);
const byPlat = new Map();
for (const line of tsv.toString("utf8").split("\n")) {
  const [id, con, , title] = line.split("\t");
  if (!id || !title) continue;
  (byPlat.get(con) || byPlat.set(con, []).get(con)).push([id, title]);
}

// shards
const shards = new Map(), dirty = new Set();
for (const f of fs.readdirSync(INFO)) if (/^[0-9a-f]{3}\.json$/.test(f)) shards.set(f.slice(0, 3), JSON.parse(fs.readFileSync(path.join(INFO, f), "utf8")));

const stats = {};
for (const p of PLATFORMS) {
  const systems = EXTRA[p.id] || p.lr;
  const games = byPlat.get(p.id);
  if (!systems || !games) continue;
  const best = new Map();   // norm -> { sys, name, rank, y, dev, pub, gn }
  for (const sys of systems) {
    const r = await fetch(RAW + encodeURIComponent(sys) + ".rdb");
    if (!r.ok) { log(p.id, sys, "HTTP", r.status); continue; }
    for (const x of readRdb(Buffer.from(await r.arrayBuffer()))) {
      const nm = x.name || x.description || "";
      if (!nm || SKIP.test(nm)) continue;
      const k = norm(cleanTitle(nm)); if (!k) continue;
      const rank = region(nm), cur = best.get(k);
      if (!cur || rank < cur.rank) best.set(k, { sys, name: nm, rank, y: x.releaseyear || cur?.y || null, dev: x.developer || cur?.dev || null, pub: x.publisher || cur?.pub || null, gn: x.genre || cur?.gn || null });
      else { cur.y ||= x.releaseyear || null; cur.dev ||= x.developer || null; cur.pub ||= x.publisher || null; cur.gn ||= x.genre || null; }
    }
  }
  let art = 0, filled = 0, seen = 0;
  for (const [id, title] of games) {
    const sh = shards.get(shardOf(id)); const rec = sh && sh[id];
    if (!rec) continue;   // merged away or no card
    seen++;
    const m = best.get(norm(title)) || best.get(norm(rec.t + (rec.st ? " " + rec.st : "")));
    if (!m) continue;
    const a = m.sys + "/" + thumbName(m.name);
    let ch = false;
    if (rec.a !== a) { rec.a = a; ch = true; art++; }
    if (!rec.y && m.y && m.y > 1950) { rec.y = m.y; ch = true; filled++; }
    if (!rec.dev && m.dev) { rec.dev = [m.dev]; ch = true; filled++; }
    if (!rec.pub && m.pub) { rec.pub = [m.pub]; ch = true; filled++; }
    if (!rec.gn && m.gn) { rec.gn = String(m.gn).split(/\s*[\/,]\s*/).filter(Boolean).slice(0, 3); ch = true; filled++; }
    if (ch) dirty.add(shardOf(id));
  }
  stats[p.id] = { cards: seen, art, factsFilled: filled };
  log(p.id, JSON.stringify(stats[p.id]));
}
for (const s of dirty) fs.writeFileSync(path.join(INFO, s + ".json"), JSON.stringify(shards.get(s)));
log("shards written", dirty.size);
fs.writeFileSync(path.join(INFO, "_art.json"), JSON.stringify({ built: new Date().toISOString(), platforms: stats }, null, 1));
