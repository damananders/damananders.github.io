// Dumps every game in the live Rate-O-Pedia list (public game_scores view) to out/games.tsv: id, console, votes, title.
// Used to audit the list (duplicates etc.); the runner can reach Supabase, the dev container can't.
import fs from "node:fs";
const SB_URL = "https://zjhlhkruqzfendvbglsb.supabase.co", SB_KEY = "sb_publishable_j-EgPXB3ZvKuz_3h8dZaNA_aLgmcQrk";
const rows = [];
for (let from = 0; ; from += 1000) {
  let r, j;
  for (let t = 0; t < 5; t++) { try { r = await fetch(SB_URL + "/rest/v1/game_scores?select=id,console,title,votes&order=id", { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, Range: from + "-" + (from + 999) } }); j = await r.json(); if (Array.isArray(j)) break; } catch (e) {} await new Promise((ok) => setTimeout(ok, 2000 * (t + 1))); }
  if (!Array.isArray(j)) throw new Error("page " + from + ": " + JSON.stringify(j).slice(0, 300));
  rows.push(...j);
  if (j.length < 1000) break;
}
fs.mkdirSync("out", { recursive: true });
fs.writeFileSync("out/games.tsv", rows.map((g) => [g.id, g.console, g.votes, String(g.title).replace(/[\t\n]/g, " ")].join("\t")).join("\n") + "\n");
console.log("games", rows.length);
