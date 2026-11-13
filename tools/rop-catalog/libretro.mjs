/* Game lists from libretro-database (No-Intro / Redump / TOSEC based .rdb files, with release year, developer,
 * publisher and genre where libretro has them). One entry per distinct game title per platform. */
import { readRdb } from "./rdb.mjs";

const RAW = "https://raw.githubusercontent.com/libretro/libretro-database/master/rdb/";
const SKIP = /\bhack\b|\[(?:t[-+r ]|tr |h\d*\]|h[ ]|hack)|\((?:beta|proto|prototype|demo|sample|kiosk|program|debug|test|pirate|homebrew|aftermarket|competition|preview|promo|alt|unl\) \(pirate)[^)]*\)|\bbios\b|\[bios\]|virtual console|\(sdk|\bsystem menu\b|\btech demo\b|\bdiagnostic|\bboot ?rom\b/i;
const ARTICLE = /^(.*?), (The|A|An|Le|La|Les|L'|Die|Der|Das|El|Los|Las|Il|Lo)$/;

export function cleanTitle(name) {
  let t = String(name || "").replace(/\s*\[[^\]]*\]/g, "").replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  // "Legend of Zelda, The - A Link to the Past" -> "The Legend of Zelda: A Link to the Past"
  const parts = t.split(" - ");
  parts[0] = parts[0].replace(ARTICLE, (_, a, b) => (b.endsWith("'") ? b : b + " ") + a);
  if (parts.length > 1) parts[1] = parts[1].replace(ARTICLE, (_, a, b) => (b.endsWith("'") ? b : b + " ") + a);
  t = parts.length > 1 ? parts[0] + ": " + parts.slice(1).join(" - ") : parts[0];
  return t.replace(/\s+/g, " ").trim();
}
const regionRank = (n) => /\((?:[^)]*\b(?:USA|World)\b[^)]*)\)/.test(n) ? 0 : /\((?:[^)]*\b(?:Europe|UK|Australia)\b[^)]*)\)/.test(n) ? 1 : /\(Japan/.test(n) ? 3 : 2;

export async function libretroGames(systems, get, norm, log) {
  const by = new Map();   // norm -> { t, y, dev, pub, gn, rank }
  for (const sys of systems) {
    const r = await get(RAW + encodeURIComponent(sys) + ".rdb");
    if (!r.ok) { log("libretro", sys, "HTTP", r.status); continue; }
    const rows = readRdb(Buffer.from(await r.arrayBuffer()));
    let kept = 0;
    for (const x of rows) {
      const nm = x.name || x.description || "";
      if (!nm || SKIP.test(nm)) continue;
      const t = cleanTitle(nm);
      const k = norm(t);
      if (!k || k.length < 2) continue;
      const rank = regionRank(nm);
      const cur = by.get(k);
      if (!cur) { by.set(k, { t, rank, y: x.releaseyear || null, dev: x.developer || null, pub: x.publisher || null, gn: x.genre || null }); kept++; continue; }
      if (rank < cur.rank) { cur.t = t; cur.rank = rank; }
      if (!cur.y && x.releaseyear) cur.y = x.releaseyear;
      if (x.releaseyear && cur.y && x.releaseyear < cur.y) cur.y = x.releaseyear;
      if (!cur.dev && x.developer) cur.dev = x.developer;
      if (!cur.pub && x.publisher) cur.pub = x.publisher;
      if (!cur.gn && x.genre) cur.gn = x.genre;
    }
    log("libretro", sys, rows.length, "entries,", kept, "new titles");
  }
  return by;
}
