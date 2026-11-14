/* pages/games.platform.js: platform hubs (/games/platform/?p=<platform id>). Prefix ph-.
 * Without ?p= it lists every platform by family (optionally one family with ?f=). With ?p= it shows that platform's
 * numbers, its own leaderboard (top rated, most voted), its top raters, recent reviews, a random pick and browsing.
 */
import { sb, $, el, onAuth, authPill, subnav, avatar, profileUrl, gameUrl, compareUrl, consoleChip, PLATFORMS, PLATFORM, FAMILIES, FAMILY, platformUrl, ago, chipSvg, CHIP_WORD, RA_PLATFORMS, hasOpenScores } from "./games.common.js?v=16";

const qs = new URLSearchParams(location.search);
const pid = qs.get("p") || "", fam = qs.get("f") || "";
const root = $("ph-root");
const fmt = (n) => Number(n || 0).toLocaleString();

/* live numbers per platform; the static catalog's game counts fill any gap (e.g. before the database update) */
async function counts() {
  const m = new Map();
  try { const j = await (await fetch("/assets/data/catalog/index.json")).json(); for (const [k, n] of Object.entries(j.platforms || {})) m.set(k, { id: k, games: n }); } catch (e) {}
  const s = await sb.from("platform_stats").select("*");
  if (!s.error) for (const x of s.data || []) m.set(x.id, Object.assign({}, m.get(x.id), x, { games: x.games || (m.get(x.id) || {}).games || 0 }));
  return m;
}

async function index() {
  const m = await counts();
  const fams = fam && FAMILY[fam] ? FAMILIES.filter(([k]) => k === fam) : FAMILIES;
  document.title = (fam && FAMILY[fam] ? FAMILY[fam].name + " platforms" : "Platforms") + " — Rate-O-Pedia";
  root.replaceChildren(
    el("header", { class: "hero", style: "padding:0 0 10px" }, el("div", { class: "eyebrow", text: "Rate-O-Pedia · platform hubs" }),
      el("h1", { text: fam && FAMILY[fam] ? FAMILY[fam].name : "Every platform" }),
      el("p", { class: "lead", text: "Each console, handheld and computer has its own hub: its leaderboard, its top raters, recent reviews and a random pick." }),
      fam ? el("a", { class: "linkbtn", href: "/games/platform/", text: "← All families" }) : null),
    ...fams.map(([k, name, color]) => el("section", { class: "pf-card", style: "margin-top:14px" },
      el("h2", { class: "gm-head", text: name }),
      el("div", { class: "ph-grid" }, ...PLATFORMS.filter((p) => p.fam === k).map((p) => {
        const c = m.get(p.id) || {};
        return el("a", { class: "ph-fam", href: platformUrl(p.id), style: "--fc:" + color },
          el("span", null, consoleChip(p.id)), el("b", { text: p.name }),
          el("small", { text: fmt(c.games) + " games" + (c.votes ? " · " + fmt(c.votes) + " votes" : "") + (p.year ? " · " + p.year : "") }));
      })))));
}

async function hub(p) {
  const color = (FAMILY[p.fam] || {}).color || "#cd4257";
  document.title = p.name + " hub — Rate-O-Pedia";
  const m = await counts();
  const c = m.get(p.id) || {};
  const note = el("p", { class: "gm-note", role: "status" });
  const random = async () => {
    const { count } = await sb.from("game_scores").select("id", { count: "exact", head: true }).eq("console", p.id);
    if (!count) { note.textContent = "No games here yet."; return; }
    const off = Math.floor(Math.random() * count);
    const { data } = await sb.from("game_scores").select("id").eq("console", p.id).order("id").range(off, off);
    if (data && data[0]) location.href = gameUrl(data[0].id);
  };
  const stat = (n, l) => n == null ? null : el("li", null, el("b", { text: fmt(n) }), el("span", { text: l }));
  const hero = el("section", { class: "ph-hero", style: "--fc:" + color },
    el("span", { class: "ph-hero__big", "aria-hidden": "true", text: p.id }),
    el("div", { class: "eyebrow", text: (FAMILY[p.fam] || {}).name + (p.year ? " · " + p.year : "") }),
    el("h1", { text: p.name }),
    el("ul", { class: "ph-stats" }, stat(c.games, "games listed"), stat(c.rated, "rated"), stat(c.votes, "votes"), stat(c.reviews, "reviews")),
    el("div", { class: "ph-btns" },
      el("a", { class: "btn gm-btn", href: "/games/?p=" + encodeURIComponent(p.id), text: "Rate & browse " + p.id + " games" }),
      el("button", { class: "linkbtn", type: "button", text: "🎲 Random " + p.id + " game", onclick: random }),
      el("a", { class: "linkbtn", href: compareUrl(), text: "Compare two games" }),
      RA_PLATFORMS.has(p.id) ? el("span", { class: "gm-note", text: "🏆 RetroAchievements supported" }) : null),
    note);
  const sibs = el("nav", { class: "ph-sib", "aria-label": "Other " + (FAMILY[p.fam] || {}).name + " platforms", style: "--fc:" + color },
    ...PLATFORMS.filter((x) => x.fam === p.fam).map((x) => el("a", { class: x.id === p.id ? "is-on" : null, href: platformUrl(x.id), "aria-current": x.id === p.id ? "page" : null, text: x.name })),
    el("a", { href: "/games/platform/", text: "All platforms →" }));
  const box = (title) => el("section", { class: "pf-card" }, el("h2", { class: "gm-head", text: title }), el("p", { class: "gm-empty", text: "Loading…" }));
  const top = box("Top rated on " + p.id + " · Verified"), openTop = box("Top rated on " + p.id + " · Open-Vote"), most = box("Most voted"), raters = box("Top " + p.id + " raters"), recent = box("Latest " + p.id + " reviews");
  root.replaceChildren(hero, el("div", { style: "margin-top:12px" }, sibs), el("div", { class: "ph-cols" }, top, openTop, most, raters, recent));

  const gameRow = (g, tail) => el("li", null, g.votes > 0 ? el("span", { class: "gm-mood rop-chip--" + Math.round(g.average), title: CHIP_WORD[Math.round(g.average)] }, chipSvg(Math.round(g.average))) : null,
    el("a", { href: gameUrl(g.id), text: g.title }), el("span", { class: "gm-note", text: tail(g) }));
  const fill = (b, rows, make, empty) => { b.lastChild.replaceWith(rows.length ? el("ol", { class: "ph-top" }, ...rows.map(make)) : el("p", { class: "gm-note", text: empty })); };
  sb.from("game_scores").select("id,title,votes,average").eq("console", p.id).gt("votes", 0).order("average", { ascending: false }).order("votes", { ascending: false }).limit(10)
    .then(({ data }) => fill(top, data || [], (g) => gameRow(g, (g) => Number(g.average).toFixed(1) + " / 5"), "Nothing rated on " + p.id + " yet. Be the first."));
  hasOpenScores().then((ok) => {
    if (!ok) { openTop.remove(); top.querySelector("h2").textContent = "Top rated on " + p.id; return; }
    sb.from("game_scores").select("id,title,open_votes,open_average").eq("console", p.id).gt("open_votes", 0).order("open_average", { ascending: false }).order("open_votes", { ascending: false }).limit(10)
      .then(({ data }) => fill(openTop, (data || []).map((g) => ({ id: g.id, title: g.title, votes: g.open_votes, average: g.open_average })),
        (g) => gameRow(g, (g) => Number(g.average).toFixed(1) + " / 5 · " + fmt(g.votes) + "v"), "No votes on " + p.id + " yet. Anyone can vote, no sign-in needed."));
  });
  sb.from("game_scores").select("id,title,votes,average").eq("console", p.id).gt("votes", 0).order("votes", { ascending: false }).limit(10)
    .then(({ data }) => fill(most, data || [], (g) => gameRow(g, (g) => fmt(g.votes) + " votes"), "No votes yet."));
  sb.rpc("platform_top_raters", { p_console: p.id, p_limit: 10 }).then(({ data, error }) => {
    if (error) { raters.remove(); return; }
    fill(raters, data || [], (v) => el("li", null, avatar(v.avatar, v.name, 24), el("a", { href: profileUrl(v.handle), text: v.name }), el("span", { class: "gm-note", text: fmt(v.votes) + " votes" + (v.reviews ? " · " + v.reviews + " reviews" : "") })), "Nobody has rated a " + p.id + " game yet.");
  });
  sb.from("public_reviews").select("*").like("game_id", p.id + ":%").order("created_at", { ascending: false }).limit(6).then(async ({ data }) => {
    const rows = data || [];
    const t = rows.length ? await sb.from("game_scores").select("id,title").in("id", rows.map((r) => r.game_id)) : { data: [] };
    const titles = new Map((t.data || []).map((x) => [x.id, x.title]));
    recent.lastChild.replaceWith(rows.length ? el("ul", { class: "pf-list" }, ...rows.map((r) => el("li", null,
      el("a", { href: gameUrl(r.game_id), text: titles.get(r.game_id) || "A game" }),
      el("span", { class: "gm-note", text: " · " + (r.stars != null ? r.stars + " / 5 · " : "") + "by " + r.name + " · " + ago(r.created_at) }),
      el("p", { class: "pf-snip", text: r.body.length > 140 ? r.body.slice(0, 137) + "…" : r.body }))))
      : el("p", { class: "gm-note", text: "No reviews yet." }));
  });
}

function render() {
  authPill($("gm-auth"), { okTail: "." });
  root.style.removeProperty("--fc");
  if (pid && PLATFORM[pid]) hub(PLATFORM[pid]); else index();
}
subnav($("rop-tabs"), "ratings");
onAuth(() => render());
