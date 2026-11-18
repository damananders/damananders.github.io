// tools/rop-enrich/fix-wrong-leads.mjs: one-off (and re-runnable) clean-up of game info cards whose description is
// really about something else. Cause: some Wikidata items link to an English Wikipedia REDIRECT (e.g.
// "Yume Kōjō: Doki Doki Panic" -> Super Mario Bros. 2), and the lead fetch followed it. The builders now skip
// redirects (see extracts() in enrich.mjs / catalog.mjs); this pass fixes the cards already built.
// A description is "wrong" when its subject (the words before "is a / was a ...") shares no word with the game's
// title or article and doesn't name the game in its opening either. Those get the plain facts line instead.
// Usage: node tools/rop-enrich/fix-wrong-leads.mjs [assets/data/gameinfo] [--dry]
import fs from "node:fs";
import path from "node:path";
import { PLATFORMS } from "../../assets/pages/games.platforms.js";

const DIR = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "assets/data/gameinfo";
const DRY = process.argv.includes("--dry");
const NAME = Object.fromEntries(PLATFORMS.map((p) => [p.id, p.name]));
const ROMAN = { ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10" };
const words = (t) => String(t || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/['’`]/g, "")
  .replace(/[^\p{L}\p{N}]+/gu, " ").split(" ").filter(Boolean).map((w) => ROMAN[w] || w).filter((w) => !["the", "a", "an", "of", "and"].includes(w));
const squash = (t) => words(t).join("");
const LEAD = /^(.{2,160}?)(?:,? \([^)]*\))?,? (?:is|was|are|were) (?:a|an|the|one|\d)/;
const GENERIC = /^(this|it|these|the following|following|there)\b/i;

function factsLine(id, r) {
  const con = NAME[id.split(":")[0]] || id.split(":")[0];
  const genre = Array.isArray(r.gn) && r.gn[0] ? String(r.gn[0]).replace(/\s*\/\s*/g, " / ").toLowerCase().replace(/ (video )?game$/, "") : "";
  let line = (r.st ? r.t + ": " + r.st : r.t) + " is " + (genre ? (/^[aeiou]/.test(genre) ? "an " : "a ") + genre + " game" : "a game") + " for the " + con;
  if (Array.isArray(r.pub) && r.pub[0]) line += ", published by " + r.pub[0];
  if (r.y) line += (Array.isArray(r.pub) && r.pub[0] ? " in " : ", released in ") + r.y;
  return line + ".";
}

let seen = 0, fixed = 0; const sample = [];
for (const f of fs.readdirSync(DIR)) {
  if (!/^[0-9a-f]{3}\.json$/.test(f)) continue;
  const file = path.join(DIR, f), j = JSON.parse(fs.readFileSync(file, "utf8"));
  let dirty = false;
  for (const [id, r] of Object.entries(j)) {
    if (!r || !r.d || r.da) continue;
    seen++;
    const m = r.d.match(LEAD); if (!m || GENERIC.test(m[1])) continue;
    const subj = words(m[1]); if (!subj.length) continue;
    const mine = new Set([...words(r.t), ...words(r.st), ...words(r.w)]);
    if (subj.some((w) => mine.has(w))) continue;
    const t = squash((r.t || "") + (r.st || "")), head = squash(m[0]);
    if (t.length >= 4 && (head.includes(t) || head.includes(squash(r.t)))) continue;   // "Gates of Skeldal (Czech: Brány Skeldalu) is ..."
    if (squash(m[1]) === squash(r.t) || squash(m[1]) === squash(r.w)) continue;        // "ExZeus" vs "Ex Zeus"
    if (sample.length < 25) sample.push(id + "  |  " + r.d.slice(0, 90));
    r.d = factsLine(id, r); r.da = 1; delete r.w; fixed++; dirty = true;
  }
  if (dirty && !DRY) fs.writeFileSync(file, JSON.stringify(j));
}
// facts lines with a year but no publisher read "for the PC in 1996": make that ", released in 1996"
let reworded = 0;
for (const f of fs.readdirSync(DIR)) {
  if (!/^[0-9a-f]{3}\.json$/.test(f)) continue;
  const file = path.join(DIR, f), j = JSON.parse(fs.readFileSync(file, "utf8")); let dirty = false;
  for (const r of Object.values(j)) if (r && r.da && r.d && !/, published by /.test(r.d) && / for the .+ in \d{4}\.$/.test(r.d)) { r.d = r.d.replace(/ in (\d{4})\.$/, ", released in $1."); reworded++; dirty = true; }
  if (dirty && !DRY) fs.writeFileSync(file, JSON.stringify(j));
}
console.log(sample.join("\n"));
console.log("reworded", reworded);
console.log(JSON.stringify({ descriptions: seen, replaced: fixed, dry: DRY }));
