/* pages/games.compare.js: two games side by side (/games/compare/?a=<id>&b=<id>). Prefix cmp-.
 * Scores, votes, hearts, reviews and backlog counts come live from the database; facts from the static info cards
 * (with the owner's corrections on top). The better number in each row is highlighted.
 */
import { sb, $, el, onAuth, authPill, subnav, share, consoleChip, platformLink, gameUrl, compareUrl, gameInfo, chipSvg, CHIP_WORD, platformName, scoreCols, titleSearch , boxArt , hasSearchKey } from "./games.common.js?v=16";

const root = $("cmp-root");
const qs = new URLSearchParams(location.search);
const pick = { a: (qs.get("a") || "").slice(0, 160), b: (qs.get("b") || "").slice(0, 160) };

async function load(id) {
  if (!id) return null;
  const [g, base, fix, h, bl, rv] = await Promise.all([
    scoreCols().then((c) => sb.from("game_scores").select(c).eq("id", id).maybeSingle()),
    gameInfo(id),
    sb.from("game_info_fix").select("data").eq("game_id", id).maybeSingle(),
    sb.from("game_heart_counts").select("hearts").eq("game_id", id).maybeSingle(),
    sb.from("game_backlog_counts").select("*").eq("game_id", id).maybeSingle(),
    sb.from("public_reviews").select("id", { count: "exact", head: true }).eq("game_id", id)]);
  if (!g.data) return null;
  const info = Object.assign({}, base, (fix.data && fix.data.data) || {});
  const b = bl.error ? null : (bl.data || { want: 0, playing: 0, beaten: 0, dropped: 0 });
  return { id, g: g.data, info, hearts: h.data ? h.data.hearts : 0, bl: b, reviews: rv.count || 0 };
}

function searcher(side) {
  const q = el("input", { class: "gm-search", type: "search", placeholder: side === "a" ? "Pick the first game…" : "Pick the second game…", "aria-label": "Game " + (side === "a" ? 1 : 2) });
  const res = el("div", { class: "pf-res" });
  let t = 0;
  q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(async () => {
    const s = q.value.trim(); if (s.length < 2) { res.replaceChildren(); return; }
    await hasSearchKey(); const { data } = await (titleSearch(sb.from("game_scores").select("id,title,console"), s)).order("votes", { ascending: false }).limit(8);
    res.replaceChildren(...(data || []).map((x) => el("button", { type: "button", class: "pf-res__b", onclick: () => { pick[side] = x.id; go(); } }, consoleChip(x.console), " " + x.title)));
    if (!res.children.length) res.append(el("p", { class: "gm-note", text: "No match." }));
  }, 220); });
  return el("div", { class: "pf-slot__q" }, q, res);
}

function go() {
  history.replaceState(null, "", compareUrl(pick.a, pick.b));
  render();
}

async function render() {
  authPill($("gm-auth"), { okTail: "." });
  root.replaceChildren(el("p", { class: "gm-empty", text: "Loading…" }));
  const [A, B] = await Promise.all([load(pick.a), load(pick.b)]);
  const head = el("header", { class: "hero", style: "padding:0 0 10px" }, el("div", { class: "eyebrow", text: "Rate-O-Pedia · head to head" }), el("h1", { text: A && B ? A.g.title + " vs " + B.g.title : "Compare two games" }));
  const side = (X, k) => X ? el("div", { class: "pf-slot" }, consoleChip(X.g.console), el("span", { class: "pf-fav__t", text: X.g.title }), el("button", { class: "linkbtn", type: "button", text: "Change", onclick: () => { pick[k] = ""; go(); } })) : searcher(k);
  const picker = el("div", { class: "cmp-pick" }, side(A, "a"), el("span", { class: "cmp-vs", text: "VS" }), side(B, "b"));
  const tools = A && B ? el("div", { class: "ph-btns" },
    el("button", { class: "linkbtn", type: "button", text: "⇄ Swap sides", onclick: () => { [pick.a, pick.b] = [pick.b, pick.a]; go(); } }),
    el("button", { class: "linkbtn", type: "button", text: "Share this matchup", onclick: () => share(compareUrl(pick.a, pick.b), A.g.title + " vs " + B.g.title) })) : null;
  root.replaceChildren(...[head, picker, tools, A || B ? grid(A, B) : el("p", { class: "gm-note", text: "Search for two games to put them side by side. Tip: the Compare button on any game's info card starts a matchup with that game." })].filter(Boolean));
  document.title = (A && B ? A.g.title + " vs " + B.g.title : "Compare games") + " — Rate-O-Pedia";
}

function grid(A, B) {
  const num = (X, f) => (X ? f(X) : null);
  const best = (f, low) => { const a = num(A, f), b = num(B, f); if (a == null || b == null || a === b) return [false, false]; return low ? [a < b, b < a] : [a > b, b > a]; };
  const score = (X) => X.g.votes > 0 ? Number(X.g.average) : null;
  const open = [A, B].some((X) => X && X.g.open_votes !== undefined);
  const rows = [
    [open ? "✔ Verified score" : "Score", (X) => score(X) != null ? Number(X.g.average).toFixed(2) + " / 5" : "Not rated", (X) => score(X) ?? -1],
    [open ? "Member votes" : "Votes", (X) => X.g.votes.toLocaleString(), (X) => X.g.votes],
    ...(open ? [
      ["🌐 Open-Vote score", (X) => X.g.open_votes > 0 ? Number(X.g.open_average).toFixed(2) + " / 5" : "Not rated", (X) => X.g.open_votes > 0 ? Number(X.g.open_average) : -1],
      ["All votes", (X) => X.g.open_votes.toLocaleString() + " (" + (X.g.visitor_votes || 0).toLocaleString() + " visitors)", (X) => X.g.open_votes]] : []),
    ["Reviews", (X) => X.reviews.toLocaleString(), (X) => X.reviews],
    ["Hearts", (X) => X.hearts.toLocaleString(), (X) => X.hearts],
    ["Beaten by", (X) => X.bl ? X.bl.beaten + " members" : "–", (X) => X.bl ? X.bl.beaten : -1],
    ["Want to play", (X) => X.bl ? X.bl.want + " members" : "–", (X) => X.bl ? X.bl.want : -1],
    ["Released", (X) => X.info.y || "–", (X) => X.info.y || 9999, true],
    ["Platform", (X) => platformName(X.g.console)],
    ["Developer", (X) => (X.info.dev || []).join(", ") || "–"],
    ["Publisher", (X) => (X.info.pub || []).join(", ") || "–"],
    ["Genre", (X) => (X.info.gn || []).filter((x) => !/^video game (with|featuring|based on)|^LGBT/i.test(x)).map((x) => x.replace(/ video game$/i, "")).slice(0, 4).join(", ") || "–"],
  ];
  const sa = A && score(A), sb2 = B && score(B);
  const win = sa != null && sb2 != null && sa !== sb2 ? (sa > sb2 ? "a" : "b") : "";
  const card = (X, k, i) => {
    if (!X) return el("article", { class: "cmp-card" }, el("p", { class: "gm-note", text: "Pick a game on this side." }));
    const s = score(X), mood = s != null ? Math.round(s) : null;
    const dl = el("dl", { class: "cmp-rows" });
    for (const [label, show, val, low] of rows) {
      const isBest = val ? best(val, low)[i] : false;
      dl.append(el("dt", { text: label }), el("dd", { class: isBest ? "is-best" : null, text: String(show(X)) }));
    }
    const d = X.info.d ? (X.info.d.length > 320 ? X.info.d.slice(0, 317).replace(/\s+\S*$/, "") + "…" : X.info.d) : "";
    return el("article", { class: "cmp-card" + (win === k ? " is-win" : "") },
      win === k ? el("span", { class: "cmp-crown", text: "👑 Community favourite" }) : null,
      X.info.a || X.info.sa || X.info.ra ? el("div", { class: "cmp-art" }, boxArt(X.info, X.g.title)) : null,
      el("div", { class: "gi-chips" }, platformLink(X.g.console)),
      el("h2", null, el("a", { href: gameUrl(X.id), text: X.info.t || X.g.title })),
      el("p", { class: "cmp-big" + (mood != null ? " rop-chip--" + mood : "") }, mood != null ? chipSvg(mood) : null, " ", s != null ? s.toFixed(1) : "–", el("small", { class: "gm-note", text: mood != null ? "  " + CHIP_WORD[mood] : "" })),
      el("div", { class: "cmp-bar", "aria-hidden": "true" }, el("span", { style: "width:" + ((s || 0) / 5) * 100 + "%" })),
      dl, d ? el("p", { class: "cmp-desc", text: d }) : null,
      el("a", { class: "linkbtn", href: gameUrl(X.id), text: "Open the info card →" }));
  };
  // phones: one head-to-head table (A | what | B) instead of two long cards one under the other
  const h2h = A && B ? el("table", { class: "cmp-h2h" },
    el("thead", null, el("tr", null, el("th", { text: A.info.t || A.g.title }), el("th", { "aria-label": "Stat" }), el("th", { text: B.info.t || B.g.title }))),
    el("tbody", null, ...rows.filter((r) => r[2]).map(([label, show, val, low]) => { const [ba, bb] = best(val, low);
      return el("tr", null, el("td", { class: ba ? "is-best" : null, text: String(show(A)) }), el("th", { scope: "row", text: label.replace(/^[^A-Za-z]+/, "") }), el("td", { class: bb ? "is-best" : null, text: String(show(B)) })); }))) : null;
  return el("div", null, h2h, el("div", { class: "cmp-grid" + (h2h ? " has-h2h" : "") }, card(A, "a", 0), card(B, "b", 1)));
}

subnav($("rop-tabs"), "ratings");
onAuth(() => render());
