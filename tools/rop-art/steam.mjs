// tools/rop-art/steam.mjs: box art for modern games (PS4, PS5, Switch, Xbox, PC and friends) that libretro has no art for.
//   node tools/rop-art/steam.mjs            (run by .github/workflows/rop-art-modern.yml; needs the open internet)
// Pass 1, Wikidata: every game card with a Wikidata id ("q") and no art yet is looked up for its Steam app id (P1733).
//   A hit is stored as "sa" = the app id; pages load Steam's public cover (library_600x900.jpg, falling back to header.jpg).
//   Console games sold on Steam too get the same cover, which is the same game's key art.
// Pass 2, RAWG (only when the RAWG_API_KEY secret is set): games still without art on the modern platforms below are
//   searched by title on rawg.io; an exact title match stores its picture URL as "ra". RAWG asks for a credit, which
//   the game page shows under the picture. Capped per run (RAWG_MAX, default 700) and a miss is remembered as "rx": 1
//   so the free monthly allowance goes on games not tried yet.
// Writes only the shards that changed in assets/data/gameinfo/.
import fs from "node:fs";
import path from "node:path";

const INFO = process.env.INFO || "assets/data/gameinfo";
const UA = "RateOPediaInfoBot/1.0 (https://damananders.github.io/games/; non-commercial fan site)";
const WDQS = "https://query.wikidata.org/sparql";
const RAWG_KEY = process.env.RAWG_API_KEY || "";
const RAWG_MAX = +(process.env.RAWG_MAX || 700);
// Rate-O-Pedia platform id -> RAWG platform ids (https://api.rawg.io/api/platforms)
const RAWG_PLAT = { PS5: 187, PS4: 18, Switch: 7, XSX: 186, XOne: 1, WiiU: 10, "3DS": 8, Vita: 19, PC: 4, Mac: 5, Linux: 6, iOS: 3, Android: 21, X360: 14, PS3: 16, PS2: 15, PS1: 27 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function get(url, opts = {}) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, { ...opts, headers: { "User-Agent": UA, ...(opts.headers || {}) }, signal: AbortSignal.timeout(90000) });
      if (r.status === 429 || r.status >= 500) throw Object.assign(new Error("HTTP " + r.status), { wait: (+r.headers.get("retry-after") || 0) * 1000 });
      return r;
    } catch (e) {
      if (i >= 5) throw e;
      const ms = Math.max(e.wait || 0, 5000 * 2 ** i); log("retry in", ms / 1000 + "s:", e.message); await sleep(ms);
    }
  }
}

// ---- load every shard
const shards = new Map(), dirty = new Set();
for (const f of fs.readdirSync(INFO)) if (/^[0-9a-f]{3}\.json$/.test(f)) shards.set(f, JSON.parse(fs.readFileSync(path.join(INFO, f), "utf8")));
const hasArt = (x) => x.a || x.sa || x.ra;
let entries = 0;
const byQ = new Map();       // QID -> [[shard, id], ...]
for (const [f, j] of shards) for (const [id, x] of Object.entries(j)) {
  entries++;
  if (hasArt(x) || !x.q || !/^Q\d+$/.test(x.q)) continue;
  if (!byQ.has(x.q)) byQ.set(x.q, []);
  byQ.get(x.q).push([f, id]);
}
log(entries, "game cards;", byQ.size, "Wikidata ids without art");

// ---- pass 1: Steam app ids from Wikidata
const qs = [...byQ.keys()];
let steamHits = 0;
for (let i = 0; i < qs.length; i += 250) {
  const batch = qs.slice(i, i + 250);
  const sparql = "SELECT ?item ?s WHERE { VALUES ?item { " + batch.map((q) => "wd:" + q).join(" ") + " } ?item wdt:P1733 ?s . }";
  const r = await get(WDQS, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/sparql-results+json" }, body: "query=" + encodeURIComponent(sparql) });
  if (!r.ok) { log("batch", i, "HTTP", r.status, "- skipped"); continue; }
  const best = new Map();   // a game can carry several app ids (editions, soundtracks): keep the smallest, the original release
  for (const b of (await r.json()).results.bindings) {
    const q = b.item.value.split("/").pop(), s = b.s.value;
    if (!/^\d{1,9}$/.test(s)) continue;
    if (!best.has(q) || +s < +best.get(q)) best.set(q, s);
  }
  for (const [q, s] of best) for (const [f, id] of byQ.get(q) || []) { shards.get(f)[id].sa = +s; dirty.add(f); steamHits++; }
  if ((i / 250) % 40 === 0) log("wikidata", i + batch.length, "/", qs.length, "steam covers so far", steamHits);
  await sleep(+(process.env.NAP ?? 1200));
}
log("steam covers:", steamHits);

// ---- pass 2: RAWG pictures for the rest of the modern platforms
const norm = (t) => String(t || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/['’`™®]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
let rawgHits = 0, rawgCalls = 0;
if (RAWG_KEY) {
  const todo = [];
  for (const [f, j] of shards) for (const [id, x] of Object.entries(j)) {
    const con = id.split(":")[0];
    if (!RAWG_PLAT[con] || hasArt(x) || x.rx) continue;
    const title = x.t ? x.t + (x.st ? ": " + x.st : "") : x.w;
    if (title) todo.push([f, id, con, title, x.q ? 0 : 1]);
  }
  // newer platforms first, then games with a Wikidata page (better-known titles)
  const order = Object.keys(RAWG_PLAT);
  todo.sort((a, b) => order.indexOf(a[2]) - order.indexOf(b[2]) || a[4] - b[4]);
  log("rawg: ", todo.length, "games without art; this run tries up to", RAWG_MAX);
  for (const [f, id, con, title] of todo.slice(0, RAWG_MAX)) {
    const u = "https://api.rawg.io/api/games?key=" + encodeURIComponent(RAWG_KEY) + "&page_size=5&search_precise=true&platforms=" + RAWG_PLAT[con] + "&search=" + encodeURIComponent(title);
    rawgCalls++;
    let r;
    try { r = await get(u); } catch (e) { log("rawg stopped:", e.message); break; }
    if (r.status === 401 || r.status === 403) { log("rawg key refused (" + r.status + "), stopping"); break; }
    const x = shards.get(f)[id];
    const hit = r.ok ? ((await r.json()).results || []).find((g) => norm(g.name) === norm(title) && /^https:\/\/media\.rawg\.io\//.test(g.background_image || "")) : null;
    if (hit) { x.ra = hit.background_image.replace("/media/games/", "/media/crop/600/400/games/"); rawgHits++; } else x.rx = 1;
    dirty.add(f);
    await sleep(+(process.env.NAP ?? 350));
  }
  log("rawg:", rawgCalls, "searches,", rawgHits, "pictures");
} else log("rawg: no RAWG_API_KEY secret, skipped");

for (const f of dirty) fs.writeFileSync(path.join(INFO, f), JSON.stringify(shards.get(f)));
log("wrote", dirty.size, "shards");
