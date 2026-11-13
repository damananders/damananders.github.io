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
    const rows = await sparql(`SELECT ?item ?name ?article WHERE {
      ?item wdt:P400 wd:${pq} ; wdt:P31 wd:Q7889 .
      { ?item rdfs:label ?name FILTER(LANG(?name) IN ("en","ja")) } UNION { ?item skos:altLabel ?name FILTER(LANG(?name) = "en") }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . } }`);
    for (const b of rows) {
      const q = b.item.value.split("/").pop();
      const it = items.get(q) || { q, names: new Set(), cons: new Set(), article: null };
      it.names.add(b.name.value); it.cons.add(con);
      if (b.article) it.article = decodeURIComponent(b.article.value.split("/wiki/").pop()).replace(/_/g, " ");
      items.set(q, it);
    }
    log("Wikidata", con, rows.length, "rows; items so far", items.size);
    await sleep(1500);
  }
  // facts for every item, 300 at a time
  const qs = [...items.keys()];
  for (let i = 0; i < qs.length; i += 300) {
    const vals = qs.slice(i, i + 300).map((q) => "wd:" + q).join(" ");
    const rows = await sparql(`SELECT ?item ?label ?desc ?date ?platL ?pubL ?devL ?genreL WHERE { VALUES ?item { ${vals} }
      OPTIONAL { ?item rdfs:label ?label FILTER(LANG(?label)="en") }
      OPTIONAL { ?item schema:description ?desc FILTER(LANG(?desc)="en") }
      OPTIONAL { ?item wdt:P577 ?date }
      OPTIONAL { ?item wdt:P400 ?plat . ?plat rdfs:label ?platL FILTER(LANG(?platL)="en") }
      OPTIONAL { ?item wdt:P123 ?pub . ?pub rdfs:label ?pubL FILTER(LANG(?pubL)="en") }
      OPTIONAL { ?item wdt:P178 ?dev . ?dev rdfs:label ?devL FILTER(LANG(?devL)="en") }
      OPTIONAL { ?item wdt:P136 ?genre . ?genre rdfs:label ?genreL FILTER(LANG(?genreL)="en") } }`);
    for (const b of rows) {
      const it = items.get(b.item.value.split("/").pop()); if (!it) continue;
      it.plats = it.plats || new Set(); it.pubs = it.pubs || new Set(); it.devs = it.devs || new Set(); it.genres = it.genres || new Set();
      if (b.label) it.label = b.label.value;
      if (b.desc) it.desc = b.desc.value;
      if (b.date) { const y = +b.date.value.slice(0, 4); if (y > 1980 && (!it.year || y < it.year)) it.year = y; }
      if (b.platL) it.plats.add(b.platL.value);
      if (b.pubL) it.pubs.add(b.pubL.value);
      if (b.devL) it.devs.add(b.devL.value);
      if (b.genreL) it.genres.add(b.genreL.value);
    }
    if (i % 3000 === 0) log("facts", i, "/", qs.length);
    await sleep(700);
  }
  return items;
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
const games = await loadGames();
log("games", games.length);
const { by: compat, meta1, enName } = await compatSources();
const items = await wikidata();

// index Wikidata by console + normalised name, plus a console-free index of names that point at one item only
const idx = new Map(), any = new Map(), idxL = new Map();
const add = (m, k, it) => { if (!k) return; const arr = m.get(k) || []; if (!arr.includes(it)) arr.push(it); m.set(k, arr); };
for (const it of items.values()) for (const nm of it.names) {
  for (const con of it.cons) { add(idx, con + "|" + norm(nm), it); add(idxL, con + "|" + loose(nm), it); }
  add(any, norm(nm), it);
}
const pick = (arr) => arr.slice().sort((a, b) => (b.article ? 1 : 0) - (a.article ? 1 : 0) || (b.plats ? b.plats.size : 0) - (a.plats ? a.plats.size : 0))[0];
const how = {};
const matched = new Map();
for (const g of games) {
  const names = [g.title];
  if (g.console === "PS2" && enName.has(norm(g.title))) names.push(enName.get(norm(g.title)));
  const aka = g.title.match(/\(aka ([^)]+)\)/i); if (aka) names.push(aka[1]);
  for (const n of [...names]) { const [main] = splitTitle(n); if (main !== n) names.push(main); }
  let arr = null, via = "";
  for (const n of names) { if ((arr = idx.get(g.console + "|" + norm(n)))) { via = "exact"; break; } }
  if (!arr) for (const n of names) { if ((arr = idxL.get(g.console + "|" + loose(n)))) { via = "loose"; break; } }
  if (!arr) for (const n of names) { const a = any.get(norm(n)); if (a && a.length === 1 && norm(n).length >= 6) { arr = a; via = "other-platform"; break; } }
  if (arr) { matched.set(g.id, pick(arr)); how[via] = (how[via] || 0) + 1; }
}
log("match routes", JSON.stringify(how));
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
  if (m1) {
    if (!rec.y && m1.date) rec.y = +m1.date.slice(0, 4);
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
