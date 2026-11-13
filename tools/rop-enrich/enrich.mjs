// tools/rop-enrich/enrich.mjs — builds the Rate-O-Pedia game info cards.
// Runs in GitHub Actions (.github/workflows/rop-enrich.yml), which has the open internet this repo's tooling needs.
// Output: assets/data/gameinfo/<00..ff>.json, one shard per FNV-1a hash byte of the game id, plus _stats.json.
//
// Sources (all free, no keys):
//   game list          Supabase game_scores view (public, publishable key)
//   facts + platforms  Wikidata (CC0)
//   descriptions       Wikipedia lead section (CC BY-SA 4.0; each card links back to its article)
//   PS1 facts + compat DuckStation gamedb.yaml        PS2 compat  PCSX2 GameIndex.yaml
//   PS3 compat         RPCS3 compatibility API        Vita compat Vita3K/compatibility issues
//   PS4 compat         shadps4-game-compatibility issues        PSP: PPSSPP keeps no public list
import fs from "node:fs";
import path from "node:path";

const OUT = process.env.OUT || "assets/data/gameinfo";
const UA = "RateOPediaInfoBot/1.0 (https://damananders.github.io/games/; non-commercial fan site)";
const GH = process.env.GITHUB_TOKEN;
const SB_URL = "https://zjhlhkruqzfendvbglsb.supabase.co";
const SB_KEY = "sb_publishable_j-EgPXB3ZvKuz_3h8dZaNA_aLgmcQrk";
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, opts = {}, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { ...opts, headers: { "User-Agent": UA, ...(opts.headers || {}) } });
      if (r.status === 429 || r.status >= 500) { await sleep(2000 * (i + 1)); continue; }
      return r;
    } catch (e) { await sleep(2000 * (i + 1)); }
  }
  throw new Error("failed: " + url);
}

/* ---------------- titles ---------------- */
const ROMAN = { ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10", xi: "11", xii: "12", xiii: "13" };
export function norm(t) {
  return String(t || "").normalize("NFKC").toLowerCase()
    .replace(/\[[^\]]*\]|\([^)]*\)/g, " ")                 // [Demo], (Japan), (aka …)
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ").replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ").filter(Boolean).map((w) => ROMAN[w] || w).filter((w) => w !== "the" && w !== "a").join(" ")
    .replace(/\b(greatest hits|platinum|the best|playstation the best|best price|essentials|collectors edition|limited edition|special edition|demo|trial|disc \d+|vol \d+ disc \d+|bundle)\b/g, " ")
    .replace(/\s+/g, " ").trim();
}
// looser key: also drops publisher/brand prefixes that Wikipedia often leaves off
const loose = (t) => norm(t).replace(/^(disneys?|disney pixars?|pixars?|tom clancys|sid meiers|clive barkers|marvels?|dreamworks|nickelodeon|sega|namco|capcom|konami|ea sports|nba|nfl) /, "").replace(/ (game|video game)$/, "");
function splitTitle(t) {
  const m = String(t).match(/^(.{2,}?)(?:\s*:\s+|\s+[-–—]\s+)(.+)$/);
  return m ? [m[1].trim(), m[2].trim()] : [String(t).trim(), ""];
}
const fnv = (s) => { let h = 0x811c9dc5; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
export const shardOf = (id) => (fnv(id) & 0xff).toString(16).padStart(2, "0");

/* ---------------- 1. our game list ---------------- */
async function loadGames() {
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

/* ---------------- 2. tiny YAML readers for the two emulator databases ---------------- */
function readGameDb(text, keys) {
  const out = []; let cur = null, sub = "";
  for (const line of text.split("\n")) {
    let m;
    if ((m = line.match(/^([A-Z]{4}-\d{3,5}[A-Z]?):\s*$/))) { cur = { serial: m[1] }; out.push(cur); sub = ""; continue; }
    if (!cur) continue;
    if ((m = line.match(/^  (\w[\w-]*):\s*(.*)$/))) { sub = m[1]; if (keys.includes(m[1]) && m[2]) cur[m[1]] = m[2].replace(/^"|"$/g, ""); continue; }
    if ((m = line.match(/^    (\w+):\s*(.+)$/)) && keys.includes(sub + "." + m[1])) cur[sub + "." + m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return out;
}

/* compat is stored as { e: emulator, s: 0..5, l: label } ; s: 5 perfect, 4 playable, 3 in-game, 2 menus, 1 boots/intro, 0 nothing */
const C = (e, s, l) => ({ e, s, l });
async function compatSources() {
  const by = { PS1: new Map(), PS2: new Map(), PSP: new Map(), PS3: new Map(), Vita: new Map(), PS4: new Map() };
  const meta1 = new Map();     // PS1 facts from DuckStation, by normalised title
  const enName = new Map();    // PS2 Japanese title -> PCSX2's English name
  const put = (con, title, c) => { const k = norm(title); if (!k) return; const old = by[con].get(k); if (!old || c.s > old.s) by[con].set(k, c); };

  try { // PS1: DuckStation
    const t = await (await get("https://raw.githubusercontent.com/stenzek/duckstation/master/data/resources/gamedb.yaml")).text();
    const rows = readGameDb(t, ["name", "localizedName", "compatibility.rating", "metadata.publisher", "metadata.developer", "metadata.releaseDate", "metadata.genre"]);
    const R = { NoIssues: C("DuckStation", 5, "Perfect"), GraphicalAudioIssues: C("DuckStation", 4, "Playable, minor glitches"), CrashesInGame: C("DuckStation", 3, "Crashes in game"), CrashesInIntro: C("DuckStation", 1, "Crashes at intro"), DoesntBoot: C("DuckStation", 0, "Doesn't boot") };
    for (const r of rows) {
      for (const nm of [r.name, r.localizedName]) {
        if (!nm) continue;
        if (r["compatibility.rating"] && R[r["compatibility.rating"]]) put("PS1", nm, R[r["compatibility.rating"]]);
        const k = norm(nm);
        if (k && !meta1.has(k) && (r["metadata.publisher"] || r["metadata.releaseDate"])) meta1.set(k, { pub: r["metadata.publisher"], dev: r["metadata.developer"], date: r["metadata.releaseDate"], genre: r["metadata.genre"] });
      }
    }
    log("DuckStation rows", rows.length, "compat", by.PS1.size, "meta", meta1.size);
  } catch (e) { log("DuckStation failed", e.message); }

  try { // PS2: PCSX2
    const t = await (await get("https://raw.githubusercontent.com/PCSX2/pcsx2/master/bin/resources/GameIndex.yaml")).text();
    const rows = readGameDb(t, ["name", "name-en", "compat"]);
    const R = { 6: C("PCSX2", 5, "Perfect"), 5: C("PCSX2", 4, "Playable"), 4: C("PCSX2", 3, "In-game"), 3: C("PCSX2", 2, "Menus"), 2: C("PCSX2", 1, "Intro"), 1: C("PCSX2", 0, "Nothing") };
    for (const r of rows) {
      if (r["name-en"]) { const k = norm(r.name); if (k && !enName.has(k)) enName.set(k, r["name-en"]); }
      if (R[r.compat]) { put("PS2", r.name, R[r.compat]); if (r["name-en"]) put("PS2", r["name-en"], R[r.compat]); }
    }
    log("PCSX2 rows", rows.length, "compat", by.PS2.size);
  } catch (e) { log("PCSX2 failed", e.message); }

  try { // PS3: RPCS3 — the API pages through its whole list (r = results per page, p = page)
    const R = { Playable: C("RPCS3", 4, "Playable"), Ingame: C("RPCS3", 3, "In-game"), Intro: C("RPCS3", 1, "Intro"), Loadable: C("RPCS3", 1, "Loads"), Nothing: C("RPCS3", 0, "Nothing") };
    const seen = new Set();
    const take = (j) => { let fresh = 0; for (const [ser, v] of Object.entries((j && j.results) || {})) { if (seen.has(ser)) continue; seen.add(ser); fresh++; if (R[v.status]) put("PS3", v.title, R[v.status]); } return fresh; };
    for (let p = 1; p <= 400; p++) {
      const j = await (await get("https://rpcs3.net/compatibility?api=v1&r=100&p=" + p)).json().catch(() => null);
      const fresh = take(j);
      if (p <= 2) log("RPCS3 page", p, "code", j && j.return_code, "results", j && j.results ? Object.keys(j.results).length : 0, "fresh", fresh);
      if (!fresh) break;
      await sleep(250);
    }
    if (seen.size < 2000) {   // paging not honoured: sweep searches by two-letter prefixes as well
      const al = "abcdefghijklmnopqrstuvwxyz0123456789".split("");
      for (const a of al) for (const b of ["", ...al.slice(0, 26)]) {
        const j = await (await get("https://rpcs3.net/compatibility?api=v1&g=" + encodeURIComponent(a + b))).json().catch(() => null);
        take(j); await sleep(150);
      }
    }
    log("RPCS3 serials", seen.size, "titles", by.PS3.size);
  } catch (e) { log("RPCS3 failed", e.message); }

  async function ghIssues(repo, map) {
    let n = 0;
    for (let page = 1; page < 200; page++) {
      const r = await get(`https://api.github.com/repos/${repo}/issues?state=all&per_page=100&page=${page}`, { headers: GH ? { Authorization: "Bearer " + GH } : {} });
      const j = await r.json(); if (!Array.isArray(j) || !j.length) break;
      for (const is of j) { if (is.pull_request) continue; const c = map(is.title, (is.labels || []).map((l) => l.name)); if (c) n++; }
    }
    return n;
  }
  try { // Vita: Vita3K
    const L = [["Playable", C("Vita3K", 4, "Playable")], ["Ingame +", C("Vita3K", 3, "In-game, mostly works")], ["Ingame -", C("Vita3K", 3, "In-game, major issues")], ["Menu", C("Vita3K", 2, "Menus")], ["Intro", C("Vita3K", 1, "Intro")], ["Bootable", C("Vita3K", 1, "Boots")], ["Nothing", C("Vita3K", 0, "Nothing")]];
    const n = await ghIssues("Vita3K/compatibility", (title, labels) => { const hit = L.find(([l]) => labels.includes(l)); if (!hit) return null; put("Vita", title.replace(/\[[A-Z]{4}\d{5}\]/g, ""), hit[1]); return 1; });
    log("Vita3K issues", n, "titles", by.Vita.size);
  } catch (e) { log("Vita3K failed", e.message); }
  try { // PS4: shadPS4
    const L = [["status-playable", C("shadPS4", 4, "Playable")], ["status-ingame", C("shadPS4", 3, "In-game")], ["status-menus", C("shadPS4", 2, "Menus")], ["status-boots", C("shadPS4", 1, "Boots")], ["status-nothing", C("shadPS4", 0, "Nothing")]];
    const n = await ghIssues("shadps4-emu/shadps4-game-compatibility", (title, labels) => { const hit = L.find(([l]) => labels.includes(l)); if (!hit) return null; put("PS4", title.replace(/^[A-Z]{4}\d{5}\s*[-–:]\s*/, ""), hit[1]); return 1; });
    log("shadPS4 issues", n, "titles", by.PS4.size);
  } catch (e) { log("shadPS4 failed", e.message); }
  return { by, meta1, enName };
}

/* ---------------- 3. Wikidata ---------------- */
const PLATFORM_Q = { PS1: "Q10677", PS2: "Q10680", PSP: "Q170325", PS3: "Q10683", Vita: "Q188808", PS4: "Q5014725", PS5: "Q63184502" };
async function sparql(q) {
  const r = await get("https://query.wikidata.org/sparql", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/sparql-results+json" }, body: "query=" + encodeURIComponent(q) });
  if (!r.ok) throw new Error("sparql " + r.status + " " + (await r.text()).slice(0, 300));
  return (await r.json()).results.bindings;
}
async function wikidata() {
  const items = new Map();   // qid -> { names:Set, cons:Set, article }
  for (const [con, pq] of Object.entries(PLATFORM_Q)) {
    const rows = await sparql(`SELECT ?item WHERE { ?item wdt:P400 wd:${pq} . }`);
    for (const b of rows) {
      const q = b.item.value.split("/").pop();
      const it = items.get(q) || { q, names: new Set(), cons: new Set(), article: null };
      it.cons.add(con); items.set(q, it);
    }
    log("Wikidata", con, rows.length, "items; total", items.size);
    await sleep(1000);
  }
  return items;
}
// Entity details straight from the Wikidata API (the query service's label index has gaps for some items)
const labelCache = new Map();
async function wbget(ids, props, langs) {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const u = "https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&maxlag=5&props=" + props + "&languages=" + langs + "&sitefilter=enwiki&ids=" + ids.slice(i, i + 50).join("|");
    let j = null;
    for (let t = 0; t < 4 && !(j && j.entities); t++) { j = await (await get(u)).json().catch(() => null); if (!(j && j.entities)) await sleep(3000); }
    Object.assign(out, (j && j.entities) || {});
    await sleep(100);
  }
  return out;
}
const claimIds = (e, p) => ((e.claims || {})[p] || []).filter((c) => c.rank !== "deprecated" && c.mainsnak && c.mainsnak.datavalue).map((c) => c.mainsnak.datavalue.value.id).filter(Boolean);
async function facts(items, qs) {
  const raw = new Map();
  for (let i = 0; i < qs.length; i += 1000) {
    Object.entries(await wbget(qs.slice(i, i + 1000), "labels|aliases|descriptions|claims|sitelinks", "en|ja")).forEach(([q, e]) => raw.set(q, e));
    log("entities", Math.min(i + 1000, qs.length), "/", qs.length);
  }
  const refs = new Set();
  for (const e of raw.values()) for (const p of ["P400", "P123", "P178", "P136"]) claimIds(e, p).forEach((x) => { if (!labelCache.has(x)) refs.add(x); });
  const labs = await wbget([...refs], "labels", "en");
  for (const [q, e] of Object.entries(labs)) labelCache.set(q, e.labels && e.labels.en ? e.labels.en.value : null);
  log("labels for", refs.size, "linked items");
  const L = (ids) => new Set(ids.map((x) => labelCache.get(x)).filter(Boolean));
  const QCON = Object.fromEntries(Object.entries(PLATFORM_Q).map(([c, q]) => [q, c]));
  for (const [q, e] of raw) {
    const it = items.get(q); if (!it || !e.labels) continue;
    for (const lang of ["en", "ja"]) if (e.labels[lang]) it.names.add(e.labels[lang].value);
    for (const al of (e.aliases && e.aliases.en) || []) it.names.add(al.value);
    if (e.labels.en) it.label = e.labels.en.value;
    if (e.descriptions && e.descriptions.en) it.desc = e.descriptions.en.value;
    if (e.sitelinks && e.sitelinks.enwiki) it.article = e.sitelinks.enwiki.title;
    const years = ((e.claims || {}).P577 || []).filter((c) => c.rank !== "deprecated" && c.mainsnak && c.mainsnak.datavalue).map((c) => +String(c.mainsnak.datavalue.value.time).slice(1, 5)).filter((y) => y > 1970);
    if (years.length) it.year = Math.min(...years);
    const plat = claimIds(e, "P400"); plat.forEach((x) => { if (QCON[x]) it.cons.add(QCON[x]); });
    it.plats = L(plat); it.pubs = L(claimIds(e, "P123")); it.devs = L(claimIds(e, "P178")); it.genres = L(claimIds(e, "P136"));
  }
}
// exact English-label lookup for games whose Wikidata entry doesn't list the PlayStation platform
const lit = (t) => '"' + t.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"@en';
async function byLabel(labels) {
  const hits = new Map();   // label -> [item]
  for (let i = 0; i < labels.length; i += 150) {
    const batch = labels.slice(i, i + 150);
    let rows = [];
    try {
      rows = await sparql(`SELECT ?item ?lab ?article (GROUP_CONCAT(DISTINCT ?p; separator="|") AS ?plats) WHERE { VALUES ?lab { ${batch.map(lit).join(" ")} }
        ?item rdfs:label ?lab ; wdt:P31/wdt:P279* wd:Q7889 .
        OPTIONAL { ?item wdt:P400 ?p }
        OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . } } GROUP BY ?item ?lab ?article`);
    } catch (e) { log("label batch failed", i, e.message.slice(0, 120)); }
    for (const b of rows) {
      const arr = hits.get(b.lab.value) || [];
      arr.push({ q: b.item.value.split("/").pop(), article: b.article ? decodeURIComponent(b.article.value.split("/wiki/").pop()).replace(/_/g, " ") : null,
                 platQ: (b.plats ? b.plats.value : "").split("|").map((u) => u.split("/").pop()).filter(Boolean) });
      hits.set(b.lab.value, arr);
    }
    await sleep(500);
  }
  return hits;
}

/* ---------------- 4. Wikipedia lead sections ---------------- */
async function extracts(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 20) {
    const batch = titles.slice(i, i + 20);
    const u = "https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=extracts&exintro=1&explaintext=1&exsentences=4&maxlag=5&titles=" + encodeURIComponent(batch.join("|"));
    const j = await (await get(u)).json().catch(() => null);
    if (!j || !j.query) { await sleep(3000); continue; }
    const back = new Map(batch.map((t) => [t, t]));
    for (const r of j.query.redirects || []) back.set(r.to, r.from);
    for (const r of j.query.normalized || []) back.set(r.to, r.from);
    for (const p of j.query.pages || []) if (p.extract) out.set(back.get(p.title) || p.title, p.extract);
    if (i % 2000 === 0) log("extracts", i, "/", titles.length);
    await sleep(120);
  }
  return out;
}
function tidy(x) {
  if (!x) return "";
  let s = x.replace(/\s*\([^()]*(?:Japanese|Hepburn|romanized)[^()]*\)/g, "").replace(/\s+/g, " ").trim();
  if (s.length > 700) s = s.slice(0, 697).replace(/\s+\S*$/, "") + "…";
  return s;
}

/* ---------------- main ---------------- */
if (process.env.PROBE) {
  for (const q of [`SELECT ?x ?v WHERE { wd:Q2539517 wdt:P400 ?x . OPTIONAL { ?x rdfs:label ?v FILTER(LANG(?v)="en") } }`,
                   `SELECT ?x ?v WHERE { wd:Q2539517 p:P400 ?st . ?st ps:P400 ?x ; wikibase:rank ?v }`,
                   `SELECT ?item ?v WHERE { VALUES ?item { wd:Q2539517 wd:Q5098997 } ?item wdt:P400 ?x . ?x rdfs:label ?v FILTER(LANG(?v)="en") }`,
                   `SELECT ?item ?v WHERE { VALUES ?item { wd:Q5098997 } ?item wdt:P577 ?v }`]) {
    const r = await get("https://query.wikidata.org/sparql", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/sparql-results+json" }, body: "query=" + encodeURIComponent(q) });
    log("PROBE", r.status, (await r.text()).replace(/\s+/g, " ").slice(0, 1500));
  }
  process.exit(0);
}
const games = await loadGames();
log("games", games.length);
const { by: compat, meta1, enName } = await compatSources();
const items = await wikidata();
await facts(items, [...items.keys()]);

// index Wikidata by console + normalised name, plus a console-free index of names that point at one item only
const idx = new Map(), any = new Map(), idxL = new Map();
const add = (m, k, it) => { if (!k) return; const arr = m.get(k) || []; if (!arr.includes(it)) arr.push(it); m.set(k, arr); };
for (const it of items.values()) for (const nm of it.names) {
  for (const con of it.cons) { add(idx, con + "|" + norm(nm), it); add(idxL, con + "|" + loose(nm), it); }
  add(any, norm(nm), it);
}
const ERA = { PS1: [1994, 2006], PS2: [2000, 2014], PSP: [2004, 2016], PS3: [2006, 2020], Vita: [2011, 2020], PS4: [2013, 2026], PS5: [2020, 2030] };
const fitsEra = (it, con) => !it.year || (it.year >= ERA[con][0] - 1 && it.year <= ERA[con][1]);
const pick = (arr, con) => arr.slice().sort((a, b) => (fitsEra(b, con) ? 1 : 0) - (fitsEra(a, con) ? 1 : 0) || (b.article ? 1 : 0) - (a.article ? 1 : 0) || (b.plats ? b.plats.size : 0) - (a.plats ? a.plats.size : 0))[0];
const how = {};
const matched = new Map();
for (const g of games) {
  const names = [g.title];
  if (g.console === "PS2" && enName.has(norm(g.title))) names.push(enName.get(norm(g.title)));
  const aka = g.title.match(/\(aka ([^)]+)\)/i); if (aka) names.push(aka[1]);
  for (const n of [...names]) { const [main, sub] = splitTitle(n); if (main !== n && /\b(edition|collection|hd|remaster(ed)?|anniversary|pack|best|greatest hits|platinum|bundle|demo|trial|disc)\b/i.test(sub)) names.push(main); }
  let arr = null, via = "";
  for (const n of names) { if ((arr = idx.get(g.console + "|" + norm(n)))) { via = "exact"; break; } }
  if (!arr) for (const n of names) { if ((arr = idxL.get(g.console + "|" + loose(n)))) { via = "loose"; break; } }
  if (!arr) for (const n of names) { const a = any.get(norm(n)); if (a && a.length === 1 && norm(n).length >= 6 && a[0].year && fitsEra(a[0], g.console)) { arr = a; via = "other-platform"; break; } }
  if (arr) { matched.set(g.id, pick(arr, g.console)); how[via] = (how[via] || 0) + 1; }
}
// second pass: exact Wikidata labels for what's still unmatched
{
  const want = new Map();   // label -> [game]
  const variants = (g) => { const v = new Set([g.title.replace(/\s+:\s+/g, ": ").replace(/\s+/g, " ").trim()]);
    if (g.console === "PS2" && enName.has(norm(g.title))) v.add(enName.get(norm(g.title)).replace(/\s+:\s+/g, ": "));
    const aka = g.title.match(/\(aka ([^)]+)\)/i); if (aka) v.add(aka[1].trim());
    for (const x of [...v]) { v.add(x.replace(/\s*\[[^\]]*\]|\s*\((?!aka)[^)]*\)/g, "").trim()); }
    return [...v].filter((x) => x.length >= 3); };
  for (const g of games) if (!matched.has(g.id)) for (const l of variants(g)) { const a = want.get(l) || []; a.push(g); want.set(l, a); }
  log("label lookups", want.size);
  const hits = await byLabel([...want.keys()]);
  const fresh = new Set();
  for (const cands of hits.values()) for (const c of cands) if (!items.has(c.q)) { items.set(c.q, { q: c.q, names: new Set(), cons: new Set(), article: c.article }); fresh.add(c.q); }
  await facts(items, [...fresh]);
  for (const [lab, cands] of hits) for (const g of want.get(lab) || []) {
    if (matched.has(g.id)) continue;
    const ok = cands.map((c) => Object.assign(items.get(c.q), { _p: c.platQ.includes(PLATFORM_Q[g.console]) })).filter((it) => it._p || (it.year && fitsEra(it, g.console)));
    const it = ok.find((x) => x._p) || (ok.length === 1 ? ok[0] : null);
    if (!it) continue;
    matched.set(g.id, it); how.label = (how.label || 0) + 1;
  }
}
log("match routes", JSON.stringify(how));
for (const t of ["Grand Theft Auto : Liberty City Stories", "Chill", "Spider-Man", "Capcom vs. SNK Pro"]) {
  const k = norm(t), hits = [...items.values()].filter((it) => [...it.names].some((n) => norm(n) === k));
  log("probe", JSON.stringify(t), "norm", JSON.stringify(k), "items", JSON.stringify(hits.slice(0, 4).map((it) => ({ q: it.q, cons: [...it.cons], y: it.year, plats: it.plats ? [...it.plats] : [] }))));
}
log("matched to Wikidata", matched.size, "of", games.length);
const arts = [...new Set([...matched.values()].map((it) => it.article).filter(Boolean))];
const ext = await extracts(arts);
log("descriptions", ext.size, "of", arts.length);

const shards = {};
const stats = { built: new Date().toISOString(), games: games.length, wikidata: 0, description: 0, compat: 0, byConsole: {} };
for (const g of games) {
  const it = matched.get(g.id), k = norm(g.title);
  const [t, st] = splitTitle(g.title);
  const rec = { t, st: st || undefined };
  const m1 = g.console === "PS1" ? meta1.get(k) : null;
  if (it) {
    rec.q = it.q;
    if (it.year) rec.y = it.year;
    if (it.plats && it.plats.size) rec.pl = [...it.plats].sort();
    if (it.pubs && it.pubs.size) rec.pub = [...it.pubs].slice(0, 4);
    if (it.devs && it.devs.size) rec.dev = [...it.devs].slice(0, 4);
    if (it.genres && it.genres.size) rec.gn = [...it.genres].slice(0, 3);
    if (it.article) { rec.w = it.article; const d = tidy(ext.get(it.article)); if (d) rec.d = d; }
    if (!rec.d && it.desc && !/^\d{4} video game$|^video game$/i.test(it.desc)) rec.d = it.desc.charAt(0).toUpperCase() + it.desc.slice(1) + ".";
  }
  if (rec.y && !fitsEra({ year: rec.y }, g.console)) {   // a re-release date: prefer the year the lead section gives, else leave it out
    const ys = (ext.get(it && it.article) || "").match(/\b(19[89]\d|20[0-3]\d)\b/g) || [];
    const y2 = ys.map(Number).find((y) => fitsEra({ year: y }, g.console));
    if (y2) rec.y = y2; else delete rec.y;
  }
  if (m1) {
    if (m1.date && (!rec.y || +m1.date.slice(0, 4) < rec.y)) rec.y = +m1.date.slice(0, 4);
    if (!rec.pub && m1.pub) rec.pub = [m1.pub];
    if (!rec.dev && m1.dev) rec.dev = [m1.dev];
    if (!rec.gn && m1.genre && !/DEMO/.test(m1.genre)) rec.gn = [m1.genre];
  }
  if (!rec.d && (rec.gn || rec.pub || rec.y)) {
    const CN = { PS1: "PlayStation", PS2: "PlayStation 2", PSP: "PlayStation Portable", PS3: "PlayStation 3", Vita: "PlayStation Vita", PS4: "PlayStation 4", PS5: "PlayStation 5" };
    const genre = rec.gn ? String(rec.gn[0]).replace(/\s*\/\s*/g, " / ").toLowerCase().replace(/ game$/, "") : "";
    let line = (rec.st ? rec.t + ": " + rec.st : rec.t) + " is " + (genre ? (/^[aeiou]/.test(genre) ? "an " : "a ") + genre + " game" : "a game") + " for the " + CN[g.console];
    if (rec.pub) line += ", published by " + rec.pub[0];
    if (rec.y) line += " in " + rec.y;
    rec.d = line + "."; rec.da = 1;   // da = description written from the facts, not quoted
  }
  const c = compat[g.console] && (compat[g.console].get(k) || (enName.has(k) && compat[g.console].get(norm(enName.get(k)))));
  if (c) rec.c = c;
  const s = (stats.byConsole[g.console] ||= { games: 0, wikidata: 0, description: 0, compat: 0 });
  s.games++; if (it) { s.wikidata++; stats.wikidata++; } if (rec.d && !rec.da) { s.description++; stats.description++; } if (rec.d) { s.anyText = (s.anyText || 0) + 1; } if (c) { s.compat++; stats.compat++; }
  (shards[shardOf(g.id)] ||= {})[g.id] = rec;
}
fs.mkdirSync(OUT, { recursive: true });
for (const [h, obj] of Object.entries(shards)) fs.writeFileSync(path.join(OUT, h + ".json"), JSON.stringify(obj));
fs.writeFileSync(path.join(OUT, "_stats.json"), JSON.stringify(stats, null, 1));
log("done", JSON.stringify(stats));
