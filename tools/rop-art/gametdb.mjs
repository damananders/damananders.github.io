// tools/rop-art/gametdb.mjs: PS3 covers from GameTDB (the libretro thumbnail server has only a few dozen PS3 covers).
//   node tools/rop-art/gametdb.mjs <games.tsv[.gz]>      (run by rop-art-fix.yml; needs the open internet)
// libretro's PS3 database gives each release its disc serial (BLUS30821 ...). For each PS3 game without a cover
// it matches the title, tries the serials (USA first) on art.gametdb.com and stores the first that exists as
//   "g" = "ps3/cover/<region>/<serial>"   -> pages load https://art.gametdb.com/<g>.jpg
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { readRdb } from "../rop-catalog/rdb.mjs";
import { cleanTitle } from "../rop-catalog/libretro.mjs";

const INFO = process.env.INFO || "assets/data/gameinfo";
const UA = "RateOPediaInfoBot/1.0 (https://damananders.github.io/games/; non-commercial fan site)";
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROMAN = { ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10", xi: "11", xii: "12", xiii: "13" };
function norm(t) {   // same as art.mjs
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
const unhex = (h) => /^[0-9a-f]+$/i.test(h || "") && h.length % 2 === 0 ? Buffer.from(h, "hex").toString("latin1") : String(h || "");
// BLUS / BCUS / NPUB... -> US; BLES / BCES / NPEB -> EN; BLJM / BCJS / NPJB -> JA; BLAS / BCAS (Asia) -> ZH
const regions = (s) => { const c = s[2]; return c === "U" ? ["US", "EN"] : c === "E" ? ["EN", "US"] : c === "J" ? ["JA"] : c === "A" ? ["ZH", "US"] : ["US", "EN"]; };
const rank = (s) => ({ U: 0, E: 1, A: 2, J: 3 }[s[2]] ?? 2);

const src = process.argv[2];
let tsv = fs.readFileSync(src); if (src.endsWith(".gz")) tsv = zlib.gunzipSync(tsv);
const titles = new Map();
for (const line of tsv.toString("utf8").split("\n")) { const [id, con, , t] = line.split("\t"); if (con === "PS3" && t) titles.set(id, t); }

const r = await fetch("https://raw.githubusercontent.com/libretro/libretro-database/master/rdb/Sony%20-%20PlayStation%203.rdb");
const serials = new Map();   // norm title -> [serial...]
for (const x of readRdb(Buffer.from(await r.arrayBuffer()))) {
  const s = unhex(x.serial).trim().toUpperCase();
  if (!/^[A-Z]{4}\d{5}$/.test(s)) continue;
  const k = norm(cleanTitle(x.name || "")); if (!k) continue;
  const l = serials.get(k) || serials.set(k, []).get(k);
  if (!l.includes(s)) l.push(s);
}
for (const l of serials.values()) l.sort((a, b) => rank(a) - rank(b));
log(serials.size, "PS3 titles with serials");

const shards = new Map(), dirty = new Set();
for (const f of fs.readdirSync(INFO)) if (/^[0-9a-f]{3}\.json$/.test(f)) shards.set(f.slice(0, 3), JSON.parse(fs.readFileSync(path.join(INFO, f), "utf8")));
const ids = new Set(titles.keys());
for (const [, sh] of shards) for (const id of Object.keys(sh)) if (id.startsWith("PS3:")) ids.add(id);

let tried = 0, hits = 0, checks = 0;
for (const id of ids) {
  const s = shardOf(id), sh = shards.get(s); if (!sh) continue;
  const rec = sh[id];
  if (rec && (rec.g || rec.sa)) continue;
  const keys = [titles.get(id), rec && rec.t && rec.t + (rec.st ? " " + rec.st : ""), rec && rec.w].filter(Boolean).map((t) => norm(cleanTitle(t)));
  let list = null; for (const k of keys) if ((list = serials.get(k))) break;
  if (!list) continue;
  tried++;
  let found = null;
  for (const serial of list.slice(0, 3)) {
    for (const reg of regions(serial)) {
      checks++;
      const g = "ps3/cover/" + reg + "/" + serial;
      const h = await fetch("https://art.gametdb.com/" + g + ".jpg", { method: "HEAD", headers: { "User-Agent": UA } }).catch(() => null);
      await sleep(120);
      if (h && h.ok && /image/.test(h.headers.get("content-type") || "")) { found = g; break; }
    }
    if (found) break;
  }
  if (found) { if (rec) rec.g = found; else sh[id] = { g: found }; dirty.add(s); hits++; }
  if (tried % 250 === 0) log(tried, "games tried,", hits, "covers,", checks, "checks");
}
for (const s of dirty) fs.writeFileSync(path.join(INFO, s + ".json"), JSON.stringify(shards.get(s)));
log("PS3:", tried, "games matched a serial,", hits, "GameTDB covers; shards written", dirty.size);
