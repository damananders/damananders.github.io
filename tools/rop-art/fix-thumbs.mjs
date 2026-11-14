// tools/rop-art/fix-thumbs.mjs: second box-art pass that checks every libretro cover against the covers that really exist.
//   node tools/rop-art/fix-thumbs.mjs <games.tsv[.gz]>     (PLATS="PS1 PS2 PS3" by default; run by rop-art-fix.yml)
// The first pass (art.mjs) names covers after libretro's game database, but the thumbnail server often files the
// picture under a slightly different name (another region, "Disc 1" instead of "Disc 4", a revision tag), so the
// page asks for a picture that isn't there and shows none. This pass lists the real Named_Boxarts files on
// github.com/libretro-thumbnails and, for each game:
//   * keeps "a" when that file exists;
//   * otherwise picks the best real file with the same tidied title (USA/World first, then Europe, other, Japan;
//     disc 1 over later discs; plainest name), also for games that have no info card yet (a small card is made);
//   * drops an "a" that can't be matched, so other sources (RAWG) can fill it later.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { cleanTitle } from "../rop-catalog/libretro.mjs";
import { PLATFORMS } from "../../assets/pages/games.platforms.js";

const INFO = process.env.INFO || "assets/data/gameinfo";
const PLATS = (process.env.PLATS || "PS1 PS2 PS3").split(/[\s,]+/).filter(Boolean);
const EXTRA = { PS1: ["Sony - PlayStation"], PS2: ["Sony - PlayStation 2"], PSP: ["Sony - PlayStation Portable"], PS3: ["Sony - PlayStation 3"] };
const GH = { "User-Agent": "rop-art", Accept: "application/vnd.github+json", ...(process.env.GITHUB_TOKEN ? { Authorization: "Bearer " + process.env.GITHUB_TOKEN } : {}) };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const ROMAN = { ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10", xi: "11", xii: "12", xiii: "13" };
function norm(t) {   // same as art.mjs / catalog.mjs
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
const keyOf = (name) => norm(cleanTitle(name.replace(/_/g, " ")));   // thumbnail names swap & * / : etc. for _
const region = (n) => /\((?:[^)]*\b(?:USA|World)\b[^)]*)\)/.test(n) ? 0 : /\((?:[^)]*\b(?:Europe|UK|Australia)\b[^)]*)\)/.test(n) ? 1 : /\(Japan/.test(n) ? 3 : 2;
const disc = (n) => { const m = /\(Disc (\d+)/i.exec(n); return m ? +m[1] - 1 : 0; };
const junk = (n) => /\((?:beta|proto|prototype|demo|sample|kiosk|debug|test|pirate)[^)]*\)/i.test(n) ? 1 : 0;
const score = (n) => junk(n) * 1000 + region(n) * 100 + disc(n) * 10 + (n.match(/\(/g) || []).length;

async function gh(url) {
  for (let i = 0; ; i++) {
    const r = await fetch(url, { headers: GH });
    if (r.ok) return r.json();
    if (i >= 4) throw new Error(url + " HTTP " + r.status);
    await new Promise((s) => setTimeout(s, 5000 * 2 ** i));
  }
}
let truncated = false;
async function boxarts(sys) {
  const repo = "libretro-thumbnails/" + sys.replace(/ /g, "_");
  const meta = await gh("https://api.github.com/repos/" + repo);
  const root = await gh("https://api.github.com/repos/" + repo + "/git/trees/" + meta.default_branch);
  const dir = root.tree.find((x) => x.path === "Named_Boxarts");
  if (!dir) return [];
  const t = await gh("https://api.github.com/repos/" + repo + "/git/trees/" + dir.sha);
  if (t.truncated) { log(sys, "listing truncated"); truncated = true; }
  return t.tree.filter((x) => x.type === "blob" && x.path.endsWith(".png")).map((x) => x.path.slice(0, -4));
}

const src = process.argv[2];
if (!src) { console.error("usage: node tools/rop-art/fix-thumbs.mjs <games.tsv[.gz]>"); process.exit(1); }
let tsv = fs.readFileSync(src); if (src.endsWith(".gz")) tsv = zlib.gunzipSync(tsv);
const titles = new Map();
for (const line of tsv.toString("utf8").split("\n")) {
  const [id, con, , title] = line.split("\t");
  if (id && title && PLATS.includes(con)) titles.set(id, title);
}

const shards = new Map(), dirty = new Set();
for (const f of fs.readdirSync(INFO)) if (/^[0-9a-f]{3}\.json$/.test(f)) shards.set(f.slice(0, 3), JSON.parse(fs.readFileSync(path.join(INFO, f), "utf8")));

const stats = {};
for (const pid of PLATS) {
  const p = PLATFORMS.find((x) => x.id === pid);
  const systems = EXTRA[pid] || (p && p.lr) || [];
  const have = new Set(), best = new Map();
  for (const sys of systems) {
    let names = [];
    try { names = await boxarts(sys); } catch (e) { log(pid, sys, e.message); continue; }
    log(pid, sys, names.length, "covers on the thumbnail server");
    for (const n of names) {
      have.add(sys + "/" + n);
      const k = keyOf(n); if (!k) continue;
      const cur = best.get(k);
      if (!cur || score(n) < cur.s) best.set(k, { a: sys + "/" + n, s: score(n) });
    }
  }
  if (!have.size) continue;
  // safety: if the listing came back far smaller than the covers we already point at, don't drop anything
  const mayDrop = !truncated;   // a full listing is the truth, even when it is small (PS3 has only a few dozen)
  if (!mayDrop) log(pid, "listing incomplete: re-matching but not dropping");
  const st = stats[pid] = { games: 0, ok: 0, fixed: 0, added: 0, dropped: 0, none: 0 };
  const ids = new Set(titles.keys());
  for (const [, sh] of shards) for (const id of Object.keys(sh)) if (id.startsWith(pid + ":")) ids.add(id);
  for (const id of ids) {
    if (!id.startsWith(pid + ":")) continue;
    st.games++;
    const s = shardOf(id), sh = shards.get(s); if (!sh) continue;
    const rec = sh[id];
    if (rec && rec.a && have.has(rec.a)) { st.ok++; continue; }
    const keys = [titles.get(id), rec && rec.t && rec.t + (rec.st ? " " + rec.st : ""), rec && rec.t, rec && rec.w, rec && rec.a && rec.a.slice(rec.a.indexOf("/") + 1).replace(/_/g, " ")]
      .filter(Boolean).map((t) => norm(cleanTitle(t)));
    let m = null;
    for (const k of keys) if (k && (m = best.get(k))) break;
    if (m) {
      if (!rec) { sh[id] = { a: m.a }; st.added++; } else { rec.a = m.a; st.fixed++; }
      dirty.add(s);
    } else if (rec && rec.a && mayDrop) { delete rec.a; st.dropped++; dirty.add(s); }
    else st.none++;
  }
  log(pid, JSON.stringify(st));
}
for (const s of dirty) fs.writeFileSync(path.join(INFO, s + ".json"), JSON.stringify(shards.get(s)));
log("shards written", dirty.size);
