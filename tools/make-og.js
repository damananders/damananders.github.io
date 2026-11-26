/* tools/make-og.js — draws the 1200x630 share images in assets/og/ for the pages listed below.
 * Run from the repo root with Node and Playwright available:   node tools/make-og.js
 * Add a page to CARDS, run it, then point that page's og:image at the new file. Not used by the live site. */
const { chromium } = require("playwright");
const path = require("path"), fs = require("fs");
const root = path.resolve(__dirname, "..");
const CARDS = [
  // "hub" is drawn by tools/og-hub/ (the fanned panels card), not here.
  { file: "resume", kicker: "Interactive résumé", title: "Anders", sub: "Compliance & Sales Lead. Builder and reverse-engineer after hours.", accent: "#cd4257" },
  { file: "changelog", kicker: "Changelog", title: "What's new", sub: "Every update across the hub, AnyPS, AndersCraft and the game ratings.", accent: "#cd4257" },
  { file: "projects", kicker: "The Project Library", title: "Everything I build", sub: "Ramses, AndersCraft, AnyPS, AndersMod Studio, the Arcade and more, plus what's on the workbench.", accent: "#cd4257" },
  { file: "uses", kicker: "Uses", title: "What I build with", sub: "The machine, the tools and the stack behind the projects.", accent: "#cd4257" },
  { file: "stream", kicker: "Stream", title: "Live from the workbench", sub: "Coding, reverse engineering, servers and game dev, live.", accent: "#9146ff" },
  { file: "links", kicker: "Links I like", title: "Sites I actually use", sub: "Places on the internet worth your click, ranked by me and by you.", accent: "#cd4257" },
  { file: "games", kicker: "Wiki-Chip Dex", title: "Rate every game", sub: "Search 336,000+ games on 75 platforms and rate them 0 to 5 with the Chippers.", accent: "#36d39a" },
  { file: "support", kicker: "Support", title: "Keep the lights on", sub: "Fan projects I build for fun and run at my own cost. Chip in, no pressure.", accent: "#cd4257" },
  { file: "anderscraft", kicker: "Private WoW server · WotLK 3.3.5a", title: "AndersCraft", sub: "A Wrath-era Azeroth built around freedom — any race, any class, a level 125 arc and a hardcore realm. Sign up in a minute.", accent: "#cd4257" },
  { file: "anyps", kicker: "PlayStation launcher · Windows", title: "AnyPS", sub: "One controller-first launcher for six generations of PlayStation emulators, now with PS Vita. Bring your own games.", accent: "#3d8bff" },
  { file: "discord", kicker: "Friends of DaManAnders", title: "Come hang out", sub: "Go-live alerts, new-review feeds and a place to talk about the projects. The Discord for everything Anders.", accent: "#5865f2" },
  { file: "arcade", kicker: "Arcade", title: "Play something", sub: "Little browser games tucked into the site — row the boat home, stamp review scores, and more to come.", accent: "#cd4257" },
  { file: "andersmod", kicker: "Live modding tool · Windows", title: "AndersMod Studio", sub: "Find values, make cheats and build mod tables for single-player PC games. Games with anti-cheat are never touched.", accent: "#f2a93b", bg: "assets/andersmod/studio.jpg" },
  { file: "ramses", kicker: "Personal AI agent · Windows", title: "Ramses", sub: "Your own AI assistant that runs on your PC: chats, files, code, pictures and boards, offline by default.", accent: "#d4af37", bg: "assets/ramses/chat.jpg" },
  { file: "trophies", kicker: "Trophy cabinet", title: "Collect them all", sub: "Hidden trophies across the whole site — secret words, cheat codes and milestones. See how many you can find.", accent: "#f0b065" }
];
const b64 = f => fs.readFileSync(path.join(root, f)).toString("base64");
const html = c => `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:SG;src:url(data:font/woff2;base64,${b64("assets/fonts/space-grotesk-latin.woff2")});font-weight:500 700}
@font-face{font-family:IN;src:url(data:font/woff2;base64,${b64("assets/fonts/inter-latin.woff2")});font-weight:400 600}
*{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px}
body{background:linear-gradient(110deg,rgba(7,9,11,.94) 30%,rgba(7,9,11,.55)),url(data:image/jpeg;base64,${b64(c.bg || "assets/anyps-bg.jpg")}) center/cover;color:#eef0f3;
  font-family:IN,sans-serif;padding:76px 84px;display:flex;flex-direction:column;justify-content:space-between;border-left:18px solid ${c.accent}}
.k{font:600 26px SG;letter-spacing:.16em;text-transform:uppercase;color:${c.accent}}
h1{font:700 112px/1.02 SG;letter-spacing:-.02em;margin:18px 0 22px}
p{font-size:34px;line-height:1.35;color:#c9d0d8;max-width:900px;margin:0}
.f{display:flex;align-items:center;gap:18px;font:600 28px SG}
.f img{width:64px;height:64px;border-radius:50%;box-shadow:0 0 0 3px ${c.accent}}
.f span{color:#9aa3ad;font-weight:500}
</style><div><div class="k">${c.kicker}</div><h1>${c.title}</h1><p>${c.sub}</p></div>
<div class="f"><img src="data:image/png;base64,${b64("assets/icons/icon-192.png")}">Anders <span>· damananders.github.io</span></div>`;
(async () => {
  const only = process.argv.slice(2);                 // e.g. `node tools/make-og.js hub` regenerates just that card
  const cards = only.length ? CARDS.filter(c => only.includes(c.file)) : CARDS;
  const b = await chromium.launch({ args: ["--no-sandbox"] }), p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  for (const c of cards) {
    await p.setContent(html(c)); await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(root, "assets/og", c.file + ".jpg"), type: "jpeg", quality: 86 });
    console.log("wrote assets/og/" + c.file + ".jpg");
  }
  await b.close();
})();
