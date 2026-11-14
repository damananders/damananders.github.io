// tools/arcade/build-cases.mjs — builds assets/data/rop-cases.json, the case pool for the "Review Score" arcade game.
//
// Only games that have real box art in the Rate-O-Pedia info cards (assets/data/gameinfo, field "a") are used.
// Popularity = Wikidata sitelink count (how many Wikipedias have an article on the game), looked up in batches
// from query.wikidata.org. If that service can't be reached, a local fallback rank is used instead (has a
// Wikipedia article, length of its description, number of platforms), and the file says so in "rank".
//
//   pop: the most popular games (one entry per game, the best-covered platform), the game picks ~80% from here
//   rnd: a random spread of every other covered game, ~20%
//
// Each entry is [id, title, art] where art is the info card's "a" value (resolved to a URL by the game).
// Scores are not stored: the game reads live averages from Rate-O-Pedia's public game_scores view at round start.
//
// Run: node tools/arcade/build-cases.mjs [--offline]       (also run by .github/workflows/arcade-cases.yml)
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const INFO = join(ROOT, "assets", "data", "gameinfo");
const OUT = join(ROOT, "assets", "data", "rop-cases.json");
const POP_N = 500, RND_N = 1800;
const OFFLINE = process.argv.includes("--offline");
const UA = "damananders.github.io arcade case builder (https://damananders.github.io/arcade/)";

// platform preference when a game exists on several (better-known box art first)
const PREF = ["PS2", "PS1", "PS3", "SNES", "N64", "GC", "Wii", "NES", "GEN", "PSP", "GBA", "DS", "X360", "Xbox", "SAT", "DC", "GB", "GBC", "3DS", "WiiU", "SMS"];
const prefRank = (id) => { const p = id.split(":")[0]; const i = PREF.indexOf(p); return i < 0 ? 99 : i; };

function hasArt(a) {
  if (!a) return false;
  if (typeof a === "string") return a.indexOf("/") > 0;
  return !!(a.g || a.a || a.sa || a.ra);
}

// ---- read every info card that has box art ----
const all = [];
for (const f of readdirSync(INFO)) {
  if (!/^[0-9a-f]{3}\.json$/.test(f)) continue;
  let d; try { d = JSON.parse(readFileSync(join(INFO, f), "utf8")); } catch { continue; }
  for (const [id, v] of Object.entries(d)) {
    if (!v || typeof v !== "object" || !hasArt(v.a) || !v.t) continue;
    const title = v.st ? v.t + ": " + v.st : v.t;
    if (title.length > 80) continue;
    all.push({ id, title, art: v.a, q: v.q || null, w: v.w || null, dl: (v.d || "").length, pl: (v.pl || []).length });
  }
}
console.log("covered games:", all.length);

// ---- popularity ----
const byQ = new Map();
for (const g of all) if (g.q && /^Q\d+$/.test(g.q)) { if (!byQ.has(g.q)) byQ.set(g.q, []); byQ.get(g.q).push(g); }
const qids = [...byQ.keys()];
let links = new Map(), rank = "wikidata-sitelinks";

async function sitelinks(batch) {
  const q = "SELECT ?i ?n WHERE { VALUES ?i { " + batch.map((x) => "wd:" + x).join(" ") + " } ?i wikibase:sitelinks ?n }";
  for (let tries = 0; tries < 4; tries++) {
    try {
      const r = await fetch("https://query.wikidata.org/sparql", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/sparql-results+json", "User-Agent": UA },
        body: "query=" + encodeURIComponent(q)
      });
      if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 3000 * (tries + 1))); continue; }
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      for (const b of j.results.bindings) links.set(b.i.value.split("/").pop(), +b.n.value);
      return true;
    } catch (e) { if (tries === 3) throw e; await new Promise((s) => setTimeout(s, 2000)); }
  }
  return false;
}
if (!OFFLINE) {
  try {
    for (let i = 0; i < qids.length; i += 300) {
      await sitelinks(qids.slice(i, i + 300));
      if ((i / 300) % 10 === 0) console.log("sitelinks", Math.min(i + 300, qids.length), "/", qids.length);
    }
  } catch (e) { console.warn("Wikidata unreachable, using the local fallback rank:", e.message); links = new Map(); }
}
if (!links.size) rank = "fallback";

function score(q, group) {
  if (rank !== "fallback") return links.get(q) || 0;
  const g = group[0];   // fallback: article + description length + platform count
  return (g.w ? 10 : 0) + Math.min(10, g.dl / 120) + Math.min(8, g.pl * 1.5) + group.length * 2;
}
const ranked = [...byQ.entries()].map(([q, group]) => ({ q, group, s: score(q, group) })).sort((a, b) => b.s - a.s);

const pop = [], used = new Set();
for (const r of ranked) {
  if (pop.length >= POP_N) break;
  const best = r.group.slice().sort((a, b) => prefRank(a.id) - prefRank(b.id) || (typeof a.art === "string" ? 0 : -1))[0];
  pop.push([best.id, best.title, best.art, Math.round(r.s)]);
  for (const g of r.group) used.add(g.id);
}

// ---- random spread: seeded so the file only changes when the catalog does ----
let seed = 0x9e3779b9;
const rand = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; };
const rest = all.filter((g) => !used.has(g.id)).sort((a, b) => (a.id < b.id ? -1 : 1));
for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
const rnd = rest.slice(0, RND_N).map((g) => [g.id, g.title, g.art]);

const out = { v: 2, built: new Date().toISOString().slice(0, 10), rank, note: "Review Score case pool. Built by tools/arcade/build-cases.mjs; entries are [id, title, art(, popularity)].", pop, rnd };
writeFileSync(OUT, JSON.stringify(out) + "\n");
console.log("wrote", OUT, "rank:", rank, "pop:", pop.length, "rnd:", rnd.length, "top:", pop.slice(0, 12).map((p) => p[1]).join(" | "));
