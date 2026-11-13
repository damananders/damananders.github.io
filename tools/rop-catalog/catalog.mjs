/* Rate-O-Pedia catalog builder: game lists for every platform in assets/pages/games.platforms.js.
 *
 *   Older systems: libretro-database (No-Intro / Redump / TOSEC sets: complete retail lists, with year,
 *                  developer, publisher and genre where libretro has them).
 *   Everything:    Wikidata (every item that is a video game and lists the platform), with English Wikipedia
 *                  lead sections for the info cards.
 *
 * Output (OUT, default out/):
 *   catalog/<platform>.tsv   id <TAB> title, one game per line (the database pulls these, see SQL 14)
 *   catalog/index.json       platform -> count, plus build stats
 *   gameinfo/<shard>.json    info cards, merged on top of the existing ones (PlayStation cards are kept as they are)
 *
 * PS1 / PS2 / PSP / PS3 already have complete lists in the database (from the emulator projects), so they are
 * skipped here; Vita / PS4 / PS5 are filled in, without repeating games the database already has.
 */
import fs from "node:fs";
import path from "node:path";
import { PLATFORMS } from "../../assets/pages/games.platforms.js";
import { libretroGames } from "./libretro.mjs";

const OUT = process.env.OUT || "out";
const INFO_IN = process.env.INFO_IN || "assets/data/gameinfo";
const ONLY = (process.env.ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);
const UA = "RateOPediaCatalogBot/1.0 (https://damananders.github.io/games/; non-commercial fan site)";
const SB_URL = "https://zjhlhkruqzfendvbglsb.supabase.co";
const SB_KEY = "sb_publishable_j-EgPXB3ZvKuz_3h8dZaNA_aLgmcQrk";
const SKIP_PLATFORMS = new Set(["PS1", "PS2", "PSP", "PS3"]);
const JUNK = /(?:[\s:(-]+)(?:demo|playtest|soundtrack|original soundtrack|ost|artbook|art book|dedicated server|benchmark|sdk|level editor|public test|test server)\)?$/i;
const MUST = [["PC", "World of Warcraft"], ["Mac", "World of Warcraft"]];   // checked at the end of the run

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, opts = {}, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { ...opts, headers: { "User-Agent": UA, ...(opts.headers || {}) }, signal: AbortSignal.timeout(opts.timeout || 90000) });
      if ((r.status === 429 || r.status >= 500) && i < tries - 1) { await sleep(3000 * (i + 1)); continue; }
      return r;
    } catch (e) { if (i === tries - 1) throw e; await sleep(3000 * (i + 1)); }
  }
  throw new Error("failed: " + url);
}

/* ---------------- titles ---------------- */
const ROMAN = { ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10", xi: "11", xii: "12", xiii: "13" };
export function norm(t) {
  return String(t || "").normalize("NFKC").toLowerCase()
    .replace(/\[[^\]]*\]|\([^)]*\)/g, " ")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ").replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ").filter(Boolean).map((w) => ROMAN[w] || w).filter((w) => w !== "the" && w !== "a").join(" ")
    .replace(/\s+/g, " ").trim();
}
const slug = (t) => norm(t).replace(/ /g, "-").slice(0, 80) || "game";
function splitTitle(t) {
  const m = String(t).match(/^(.{2,}?)(?:\s*:\s+|\s+[-–—]\s+)(.+)$/);
  return m ? [m[1].trim(), m[2].trim()] : [String(t).trim(), ""];
}
const fnv = (s) => { let h = 0x811c9dc5; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
const shardOf = (id) => (fnv(id) & 0xfff).toString(16).padStart(3, "0");   // 4096 small files
const artTitle = (a) => a.replace(/\s*\((?:\d{4} )?(?:[\w .-]+ )?(?:video )?game\)$/i, "").trim();
const clean = (s) => String(s || "").replace(/[\t\r\n]+/g, " ").replace(/\s+/g, " ").trim();

/* ---------------- Wikidata ---------------- */
async function sparql(q, tries = 4) {
  const r = await get("https://query.wikidata.org/sparql", { method: "POST", timeout: 75000,
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/sparql-results+json" }, body: "query=" + encodeURIComponent(q) }, tries);
  if (!r.ok) throw new Error("sparql " + r.status + " " + (await r.text()).slice(0, 200).replace(/\s+/g, " "));
  return (await r.json()).results.bindings;
}
const qid = (u) => u.split("/").pop();
const wpUrl = (t) => "<https://en.wikipedia.org/wiki/" + encodeURI(t.replace(/ /g, "_")).replace(/[()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()) + ">";

async function platformQids() {
  const want = [];
  for (const p of PLATFORMS) for (const t of [p.wp, ...(p.wpx || [])]) if (t) want.push([p.id, t]);
  const map = new Map();   // our id -> [qid]
  const name = new Map();  // qid -> our display name
  for (let i = 0; i < want.length; i += 40) {
    const batch = want.slice(i, i + 40);
    // the same article can be written with %28 or ( in the URL, so try both spellings
    const vals = batch.flatMap(([, t]) => [wpUrl(t), "<https://en.wikipedia.org/wiki/" + encodeURI(t.replace(/ /g, "_")) + ">"]);
    const rows = await sparql(`SELECT ?article ?item WHERE { VALUES ?article { ${[...new Set(vals)].join(" ")} } ?article schema:about ?item . }`);
    for (const b of rows) {
      const title = decodeURIComponent(b.article.value.split("/wiki/").pop()).replace(/_/g, " ");
      for (const [id, t] of batch) if (t === title) { const a = map.get(id) || []; if (!a.includes(qid(b.item.value))) a.push(qid(b.item.value)); map.set(id, a); }
    }
    await sleep(500);
  }
  for (const p of PLATFORMS) for (const q of p.qx || []) { const a = map.get(p.id) || []; if (!a.includes(q)) a.push(q); map.set(p.id, a); }
  for (const p of PLATFORMS) for (const q of map.get(p.id) || []) name.set(q, p.name);
  return { map, name };
}
async function gameClasses() {
  const rows = await sparql(`SELECT DISTINCT ?c WHERE { ?c wdt:P279* wd:Q7889 . }`);
  const s = new Set(rows.map((b) => qid(b.c.value)));
  s.add("Q7889");
  for (const bad of ["Q7058673", "Q8076"]) s.delete(bad);   // series, consoles never count
  return s;
}
async function platformItems(pq, classes) {
  const q = (filter) => `SELECT ?item ?c ?article ?label WHERE { ?item p:P400/ps:P400 wd:${pq} . ${filter}
    ?item wdt:P31 ?c .
    OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
    OPTIONAL { ?item rdfs:label ?label FILTER(LANG(?label) = "en") } }`;
  let rows = null;
  try { rows = await sparql(q(""), 1); }
  catch (e) {
    log("  whole query failed (", e.message.slice(0, 60), ") -> 10 parts");
    rows = [];
    for (let d = 0; d < 10; d++) {
      try { rows.push(...await sparql(q(`FILTER(STRENDS(STR(?item), "${d}"))`), 2)); }
      catch (e2) {
        log("  part", d, "failed -> 10 more parts");
        for (let d2 = 0; d2 < 10; d2++) {
          try { rows.push(...await sparql(q(`FILTER(STRENDS(STR(?item), "${d2}${d}"))`), 3)); }
          catch (e3) { log("  part", d2 + "" + d, "failed:", e3.message.slice(0, 80)); }
        }
      }
      await sleep(400);
    }
  }
  const items = new Map();
  for (const b of rows) {
    const id = qid(b.item.value);
    const it = items.get(id) || { q: id, game: false, article: null, label: null };
    if (classes.has(qid(b.c.value))) it.game = true;
    if (b.article) it.article = decodeURIComponent(b.article.value.split("/wiki/").pop()).replace(/_/g, " ");
    if (b.label) it.label = b.label.value;
    items.set(id, it);
  }
  return [...items.values()].filter((it) => it.game && (it.article || it.label));
}
async function labels(qs) {
  const out = new Map();
  for (let i = 0; i < qs.length; i += 400) {
    const vals = qs.slice(i, i + 400).map((q) => "wd:" + q).join(" ");
    try {
      const rows = await sparql(`SELECT ?x ?l WHERE { VALUES ?x { ${vals} } ?x rdfs:label ?l FILTER(LANG(?l) = "en") }`);
      for (const b of rows) out.set(qid(b.x.value), b.l.value);
    } catch (e) { log("labels batch failed", e.message.slice(0, 80)); }
    await sleep(200);
  }
  return out;
}
async function facts(items, platName) {
  const PROPS = [["desc", `?item schema:description ?v FILTER(LANG(?v)="en")`], ["date", "P577"], ["plats", "P400"], ["pubs", "P123"], ["devs", "P178"], ["genres", "P136"]];
  const qs = [...items.keys()];
  const refs = new Set();
  for (let i = 0; i < qs.length; i += 250) {
    const vals = qs.slice(i, i + 250).map((q) => "wd:" + q).join(" ");
    for (const [key, prop] of PROPS) {
      const pat = prop.startsWith("P") ? `?item p:${prop} ?st . ?st ps:${prop} ?v . FILTER NOT EXISTS { ?st wikibase:rank wikibase:DeprecatedRank }` : prop;
      let rows;
      try { rows = await sparql(`SELECT ?item ?v WHERE { VALUES ?item { ${vals} } ${pat} }`); }
      catch (e) { log("facts", key, i, "failed", e.message.slice(0, 100)); continue; }
      for (const b of rows) {
        const it = items.get(qid(b.item.value)); if (!it || !b.v) continue;
        const v = b.v.value;
        if (key === "desc") it.desc = v;
        else if (key === "date") { const y = +v.slice(0, 4); if (y > 1950 && y < 2100 && (!it.year || y < it.year)) it.year = y; }
        else { const q = qid(v); (it["_" + key] ||= []).push(q); if (!platName.has(q)) refs.add(q); }
      }
      await sleep(120);
    }
    if (i % 5000 === 0) log("facts", i, "/", qs.length);
  }
  const labs = await labels([...refs]);
  for (const it of items.values()) {
    const L = (arr) => [...new Set((arr || []).map((x) => platName.get(x) || labs.get(x)).filter(Boolean))];
    it.plats = L(it._plats); it.pubs = L(it._pubs); it.devs = L(it._devs); it.genres = L(it._genres);
    delete it._plats; delete it._pubs; delete it._devs; delete it._genres;
  }
}
async function extracts(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 20) {
    const batch = titles.slice(i, i + 20);
    const u = "https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=extracts&exintro=1&explaintext=1&exsentences=4&maxlag=5&titles=" + encodeURIComponent(batch.join("|"));
    let j = null;
    try { j = await (await get(u)).json(); } catch (e) {}
    if (!j || !j.query) { await sleep(3000); continue; }
    const back = new Map(batch.map((t) => [t, t]));
    for (const r of j.query.redirects || []) back.set(r.to, r.from);
    for (const r of j.query.normalized || []) back.set(r.to, r.from);
    for (const p of j.query.pages || []) if (p.extract) out.set(back.get(p.title) || p.title, p.extract);
    if (i % 4000 === 0) log("extracts", i, "/", titles.length);
    await sleep(100);
  }
  return out;
}
function tidy(x) {
  if (!x) return "";
  let s = x.replace(/\s*\([^()]*(?:Japanese|Hepburn|romanized|Korean|Chinese)[^()]*\)/g, "").replace(/\s+/g, " ").trim();
  if (s.length > 700) s = s.slice(0, 697).replace(/\s+\S*$/, "") + "…";
  return s;
}

/* ---------------- the games already in the database ---------------- */
async function dbGames() {
  const all = [];
  for (let from = 0; ; from += 1000) {
    const r = await get(SB_URL + "/rest/v1/game_scores?select=id,console,title&order=id", { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, Range: from + "-" + (from + 999) } });
    const rows = await r.json();
    if (!Array.isArray(rows)) throw new Error("game list: " + JSON.stringify(rows).slice(0, 300));
    all.push(...rows);
    if (rows.length < 1000) break;
  }
  return all;
}

/* ---------------- main ---------------- */
if (process.env.PROBE) {   // which Wikidata items carry these labels, and how many games list each as a platform
  for (const lab of process.env.PROBE.split(",").map((x) => x.trim()).filter(Boolean)) {
    if (/^Q\d+$/.test(lab)) {
      try {
        const rows = await sparql(`SELECT ?l ?d (COUNT(?g) AS ?n) WHERE { OPTIONAL { wd:${lab} rdfs:label ?l FILTER(LANG(?l)="en") } OPTIONAL { wd:${lab} schema:description ?d FILTER(LANG(?d)="en") } OPTIONAL { ?g wdt:P400 wd:${lab} } } GROUP BY ?l ?d`, 2);
        log("PROBE", lab, rows.map((b) => (b.l ? b.l.value : "?") + " [" + b.n.value + "] " + (b.d ? b.d.value : "")).join(" | "));
      } catch (e) { log("PROBE", lab, "failed", e.message.slice(0, 80)); }
      continue;
    }
    try {
      const rows = await sparql(`SELECT ?item ?d (COUNT(?g) AS ?n) WHERE { ?item rdfs:label ${JSON.stringify(lab)}@en . OPTIONAL { ?item schema:description ?d FILTER(LANG(?d)="en") }
        OPTIONAL { ?g wdt:P400 ?item } } GROUP BY ?item ?d ORDER BY DESC(?n) LIMIT 6`, 2);
      log("PROBE", lab, rows.map((b) => qid(b.item.value) + " [" + b.n.value + "] " + (b.d ? b.d.value : "")).join(" | "));
    } catch (e) { log("PROBE", lab, "failed", e.message.slice(0, 80)); }
  }
  process.exit(0);
}
const t0 = Date.now();
const existing = await dbGames();
log("database games", existing.length);
const haveId = new Set(existing.map((g) => g.id));
const haveTitle = new Map();   // platform -> Set(norm title)
for (const g of existing) { const s = haveTitle.get(g.console) || new Set(); s.add(norm(g.title)); haveTitle.set(g.console, s); }

const { map: PQ, name: PLAT_NAME } = await platformQids();
log("platform items", JSON.stringify(Object.fromEntries(PQ)));
for (const p of PLATFORMS) if (!SKIP_PLATFORMS.has(p.id) && !PQ.has(p.id)) log("!! no Wikidata item for", p.id, p.wp);
const classes = await gameClasses();
log("game classes", classes.size);

const plats = PLATFORMS.filter((p) => !SKIP_PLATFORMS.has(p.id) && (!ONLY.length || ONLY.includes(p.id)));
const wd = new Map();        // qid -> item (shared across platforms)
const perPlat = new Map();   // platform -> Map(norm -> entry)
const stats = { built: new Date().toISOString(), platforms: {} };

for (const p of plats) {
  const entries = new Map();   // norm -> { title, src, lr?, q? }
  // 1. libretro list
  if (p.lr) {
    const lr = await libretroGames(p.lr, (u) => get(u), norm, log);
    const vals = [...lr.values()];
    const withMeta = vals.filter((x) => x.dev || x.pub).length, withYear = vals.filter((x) => x.y).length;
    // keep only well-documented entries where the set mixes retail games with homebrew/odd dumps
    const need = withMeta / vals.length >= 0.4 ? (x) => x.dev || x.pub : withYear / vals.length >= 0.4 ? (x) => x.y : () => true;
    for (const [k, x] of lr) if (need(x)) entries.set(k, { title: x.t, lr: x });
  }
  // 2. Wikidata
  let wdCount = 0, wdAdded = 0;
  for (const pq of PQ.get(p.id) || []) {
    let list = [];
    try { list = await platformItems(pq, classes); } catch (e) { log("!! Wikidata", p.id, e.message.slice(0, 120)); }
    for (const it of list) {
      const name = it.article ? artTitle(it.article) : it.label;
      if (!name || JUNK.test(name)) continue;
      const k = norm(name), kl = it.label ? norm(it.label) : k;
      const shared = wd.get(it.q) || Object.assign(it, { name });
      wd.set(it.q, shared);
      wdCount++;
      const hit = entries.get(k) || entries.get(kl);
      if (hit) { if (!hit.q) hit.q = it.q; continue; }
      // on systems with a full retail list, only add extra Wikidata games that have a Wikipedia article
      if (p.lr && entries.size >= 300 && !it.article) continue;
      entries.set(k, { title: name, q: it.q });
      wdAdded++;
    }
    await sleep(800);
  }
  for (const [pid, t] of MUST) if (pid === p.id && !entries.has(norm(t))) { entries.set(norm(t), { title: t }); log("added by hand:", pid, t); }
  // 3. never repeat a game the database already has for this platform
  const have = haveTitle.get(p.id) || new Set();
  for (const k of [...entries.keys()]) if (have.has(k)) entries.delete(k);
  perPlat.set(p.id, entries);
  stats.platforms[p.id] = { games: entries.size, libretro: p.lr ? [...entries.values()].filter((e) => e.lr).length : 0, wikidataRows: wdCount, wikidataAdded: wdAdded };
  log("platform", p.id, JSON.stringify(stats.platforms[p.id]));
}

// facts + Wikipedia text for every Wikidata item we kept
const used = new Map();
for (const entries of perPlat.values()) for (const e of entries.values()) if (e.q && wd.has(e.q)) used.set(e.q, wd.get(e.q));
log("Wikidata items in use", used.size);
await facts(used, PLAT_NAME);
const arts = [...new Set([...used.values()].map((it) => it.article).filter(Boolean))];
const ext = await extracts(arts);
log("Wikipedia descriptions", ext.size, "of", arts.length);

// ids, catalog files and info cards
const shards = {};
if (fs.existsSync(INFO_IN)) for (const f of fs.readdirSync(INFO_IN)) if (/^[0-9a-f]{2,3}\.json$/.test(f)) for (const [id, rec] of Object.entries(JSON.parse(fs.readFileSync(path.join(INFO_IN, f), "utf8")))) (shards[shardOf(id)] ||= {})[id] = rec;
fs.mkdirSync(path.join(OUT, "catalog"), { recursive: true });
fs.mkdirSync(path.join(OUT, "gameinfo"), { recursive: true });
const index = { built: stats.built, platforms: {} };
let total = 0, described = 0;
for (const p of plats) {
  const entries = [...perPlat.get(p.id).values()].sort((a, b) => a.title.localeCompare(b.title));
  const used = new Set(), lines = [];
  for (const e of entries) {
    let id = p.id + ":" + slug(e.title), n = 2;
    while (used.has(id) || (haveId.has(id))) id = p.id + ":" + slug(e.title) + "-" + n++;
    used.add(id);
    const title = clean(e.title).slice(0, 120);
    if (title.length < 2) continue;
    lines.push(id + "\t" + title);
    // info card
    const it = e.q ? wd.get(e.q) : null, lr = e.lr;
    const [t, st] = splitTitle(title);
    const rec = { t };
    if (st) rec.st = st;
    if (it) {
      rec.q = it.q;
      if (it.year) rec.y = it.year;
      if (it.plats && it.plats.length) rec.pl = it.plats.slice().sort();
      if (it.pubs && it.pubs.length) rec.pub = it.pubs.slice(0, 4);
      if (it.devs && it.devs.length) rec.dev = it.devs.slice(0, 4);
      if (it.genres && it.genres.length) rec.gn = it.genres.slice(0, 3);
      if (it.article) { rec.w = it.article; const d = tidy(ext.get(it.article)); if (d) rec.d = d; }
      if (!rec.d && it.desc && !/^(\d{4} )?video game$/i.test(it.desc)) rec.d = it.desc.charAt(0).toUpperCase() + it.desc.slice(1) + ".";
    }
    if (lr) {
      if (lr.y && (!rec.y || lr.y < rec.y) && lr.y >= p.year - 1) rec.y = lr.y;
      if (!rec.dev && lr.dev) rec.dev = [lr.dev];
      if (!rec.pub && lr.pub) rec.pub = [lr.pub];
      if (!rec.gn && lr.gn) rec.gn = [lr.gn];
    }
    if (!rec.pl) rec.pl = [p.name];
    if (!rec.d) {
      const genre = rec.gn ? String(rec.gn[0]).replace(/\s*\/\s*/g, " / ").replace(/\s*\([^)]*\)/g, "").toLowerCase().replace(/ (video )?game$/, "") : "";
      let line = title + " is " + (genre ? (/^[aeiou]/.test(genre) ? "an " : "a ") + genre + " game" : "a game") + " for the " + p.name;
      if (rec.dev) line += ", developed by " + rec.dev[0];
      if (rec.pub && (!rec.dev || rec.pub[0] !== rec.dev[0])) line += (rec.dev ? " and" : ",") + " published by " + rec.pub[0];
      if (rec.y) line += " in " + rec.y;
      rec.d = line + "."; rec.da = 1;
    } else described++;
    (shards[shardOf(id)] ||= {})[id] = rec;
  }
  fs.writeFileSync(path.join(OUT, "catalog", p.id + ".tsv"), lines.join("\n") + "\n");
  index.platforms[p.id] = lines.length;
  total += lines.length;
}
for (const [h, obj] of Object.entries(shards)) fs.writeFileSync(path.join(OUT, "gameinfo", h + ".json"), JSON.stringify(obj));
index.total = total; index.described = described; index.stats = stats.platforms;
fs.writeFileSync(path.join(OUT, "catalog", "index.json"), JSON.stringify(index, null, 1));

for (const [pid, t] of MUST) {
  const f = path.join(OUT, "catalog", pid + ".tsv");
  const hit = fs.existsSync(f) && fs.readFileSync(f, "utf8").split("\n").find((l) => l.split("\t")[1] === t);
  log("check", pid, t, hit ? "OK " + hit.split("\t")[0] : "MISSING");
}
log("done:", total, "new games,", described, "with Wikipedia text, in", Math.round((Date.now() - t0) / 60000), "min");
