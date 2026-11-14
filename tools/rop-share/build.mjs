// tools/rop-share/build.mjs: link-preview pages for Rate-O-Pedia games (games/s/<platform>/<game>.html).
// Game pages are drawn by JavaScript, so Discord, X and friends see no title, score or picture when someone pastes a
// link. These tiny static pages carry the preview (title, both scores, description, box art) and send people on to
// the real game page. One page per game that has at least one vote; .github/workflows/rop-share.yml rebuilds them daily.
import fs from "node:fs";
import path from "node:path";

const SB_URL = "https://zjhlhkruqzfendvbglsb.supabase.co", SB_KEY = "sb_publishable_j-EgPXB3ZvKuz_3h8dZaNA_aLgmcQrk";
const SITE = "https://damananders.github.io";
const OUT = "games/s", INFO = "assets/data/gameinfo";
const ID = /^[A-Za-z0-9]+:[a-z0-9-]{1,90}$/;

async function rows(filter, cols) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(SB_URL + "/rest/v1/game_scores?select=" + cols + "&" + filter + "&order=id", { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, Range: from + "-" + (from + 999) } });
    const j = await r.json();
    if (!Array.isArray(j)) return { error: j };
    out.push(...j);
    if (j.length < 1000) return { rows: out };
  }
}
let res = await rows("or=(votes.gt.0,open_votes.gt.0)", "id,console,title,votes,average,open_votes,open_average");
if (res.error) res = await rows("votes=gt.0", "id,console,title,votes,average");   // before round 19
if (res.error) throw new Error(JSON.stringify(res.error));

const fnv = (s) => { let h = 0x811c9dc5; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
const shards = new Map();
const info = (id) => {
  const k = (fnv(id) & 0xfff).toString(16).padStart(3, "0");
  if (!shards.has(k)) { try { shards.set(k, JSON.parse(fs.readFileSync(path.join(INFO, k + ".json"), "utf8"))); } catch (e) { shards.set(k, {}); } }
  return shards.get(k)[id] || {};
};
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const art = (a) => { const i = a ? a.indexOf("/") : -1; return i > 0 ? "https://thumbnails.libretro.com/" + encodeURIComponent(a.slice(0, i)) + "/Named_Boxarts/" + encodeURIComponent(a.slice(i + 1)) + ".png" : null; };
const score = (avg, n) => n > 0 ? Number(avg).toFixed(1) + "/5 (" + n + (n === 1 ? " vote" : " votes") + ")" : "not rated yet";

const keep = new Set();
for (const g of res.rows) {
  if (!ID.test(g.id)) continue;
  const x = info(g.id);
  const title = x.t ? x.t + (x.st ? ": " + x.st : "") : g.title;
  const [con, slug] = g.id.split(":");
  const rel = con + "/" + slug + ".html";
  keep.add(rel);
  const url = SITE + "/games/game/?id=" + encodeURIComponent(g.id);
  const scores = "Verified " + score(g.average, g.votes) + (g.open_votes !== undefined ? " · Open-Vote " + score(g.open_average, g.open_votes) : "");
  const desc = (scores + (x.y ? " · " + x.y : "") + (x.d ? " · " + x.d : "")).slice(0, 290);
  const img = art(x.a);
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(title)} · Rate-O-Pedia</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="${esc(url)}">
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Rate-O-Pedia">
<meta property="og:title" content="${esc(title)} (${esc(con)}) · ${g.votes > 0 ? Number(g.average).toFixed(1) + "/5" : "Rate-O-Pedia"}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(img || SITE + "/assets/og/games.jpg")}">
<meta name="twitter:card" content="${img ? "summary" : "summary_large_image"}">
<meta name="theme-color" content="#cd4257">
<meta http-equiv="refresh" content="0;url=${esc(url)}">
<script>location.replace(${JSON.stringify("/games/game/?id=" + encodeURIComponent(g.id))})</script>
</head><body><p><a href="${esc(url)}">${esc(title)} on Rate-O-Pedia</a></p></body></html>
`;
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== html) fs.writeFileSync(file, html);
}
// drop pages for games that lost their votes or were merged away
let removed = 0;
if (fs.existsSync(OUT)) for (const d of fs.readdirSync(OUT)) {
  const dir = path.join(OUT, d);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir)) if (!keep.has(d + "/" + f)) { fs.unlinkSync(path.join(dir, f)); removed++; }
}
console.log("share pages", keep.size, "removed", removed);
