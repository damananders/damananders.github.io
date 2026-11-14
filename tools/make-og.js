/* tools/make-og.js — draws the 1200x630 share images in assets/og/ for the pages listed below.
 * Run from the repo root with Node and Playwright available:   node tools/make-og.js
 * Add a page to CARDS, run it, then point that page's og:image at the new file. Not used by the live site. */
const { chromium } = require("playwright");
const path = require("path"), fs = require("fs");
const root = path.resolve(__dirname, "..");
const CARDS = [
  { file: "hub", kicker: "DaManAnders", title: "Choose your avenue", sub: "The AndersCraft WoW server, the AnyPS PlayStation launcher and Rate-O-Pedia game ratings — fan projects, built for fun.", accent: "#cd4257", bg: "assets/hub-bg.jpg" },
  { file: "resume", kicker: "Interactive résumé", title: "Anders", sub: "Compliance & Sales Lead. Builder and reverse-engineer after hours.", accent: "#cd4257" },
  { file: "changelog", kicker: "Changelog", title: "What's new", sub: "Every update across the hub, AnyPS, AndersCraft and the game ratings.", accent: "#cd4257" },
  { file: "uses", kicker: "Uses", title: "What I build with", sub: "The machine, the tools and the stack behind the projects.", accent: "#cd4257" },
  { file: "stream", kicker: "Stream", title: "Live from the workbench", sub: "Coding, reverse engineering, servers and game dev, live.", accent: "#9146ff" },
  { file: "links", kicker: "Links I like", title: "Sites I actually use", sub: "Places on the internet worth your click, ranked by me and by you.", accent: "#cd4257" },
  { file: "games", kicker: "Rate-O-Pedia Forums", title: "Rate the classics", sub: "Search thousands of PlayStation games and rate them 0 to 5.", accent: "#36d39a" },
  { file: "support", kicker: "Support", title: "Keep the lights on", sub: "Fan projects I build for fun and run at my own cost. Chip in, no pressure.", accent: "#cd4257" }
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
