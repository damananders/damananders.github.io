/* pages/games.feed.js: the Following feed (/games/feed/). Prefix fd-.
 * The latest ratings, reviews and lists from the members you follow, from the database function my_feed(),
 * which only ever returns your own feed. Follow people with the Follow button on their profile.
 */
import { sb, $, el, me, onAuth, authPill, subnav, signIn, avatar, nameLink, ago, INVITE, consoleChip, gameUrl, artSlot, chipSvg, CHIP_WORD, profileUrl } from "./games.common.js?v=16";

const root = $("fd-root");
let oldest = null;

function hero(...extra) {
  return el("header", { class: "hero", style: "padding:0 0 10px" }, el("div", { class: "eyebrow", text: "Rate-O-Pedia · following" }), el("h1", { text: "Following" }),
    el("p", { class: "lead", text: "What the members you follow have been rating, reviewing and listing." }), ...extra);
}

function item(x) {
  const who = el("span", { class: "fd-who" }, avatar(x.avatar, x.author, 28), nameLink(x.handle, x.author));
  const when = el("span", { class: "gm-note", text: ago(x.at) });
  if (x.kind === "list") return el("article", { class: "fd-item fd-item--list" }, el("div", { class: "fd-line" }, who, el("span", { text: " made a list " }), when),
    el("a", { class: "fd-list", href: "/games/lists/?id=" + x.list_id }, el("span", { "aria-hidden": "true", text: "📋 " }), x.list_title), x.body ? el("p", { class: "fd-body", text: x.body }) : null);
  const game = el("a", { class: "fd-game", href: gameUrl(x.game_id) }, consoleChip(x.console || ""), " ", x.title || x.game_id);
  if (x.kind === "rating") return el("article", { class: "fd-item" }, artSlot(x.game_id, x.title, "fd-art"),
    el("div", { class: "fd-main" }, el("div", { class: "fd-line" }, who, el("span", { text: " rated " }), when), game,
      el("span", { class: "fd-stars rop-chip--" + x.stars, title: x.stars + " / 5 · " + CHIP_WORD[x.stars] }, chipSvg(x.stars), el("b", { text: x.stars + " / 5 · " + CHIP_WORD[x.stars] }))));
  return el("article", { class: "fd-item" }, artSlot(x.game_id, x.title, "fd-art"),
    el("div", { class: "fd-main" }, el("div", { class: "fd-line" }, who, el("span", { text: " reviewed " }), when), game,
      el("p", { class: "fd-body", text: x.body && x.body.length > 400 ? x.body.slice(0, 397) + "…" : x.body })));
}

async function load(list, more) {
  more.disabled = true;
  const { data, error } = await sb.rpc("my_feed", { p_before: oldest, p_limit: 40 });
  more.disabled = false;
  if (error) {
    list.replaceChildren(el("p", { class: "gm-note", text: /my_feed|function|schema cache/i.test(error.message) ? "The feed switches on after the owner runs 21_rateopedia_lists_follows.sql." : error.message }));
    more.hidden = true; return;
  }
  const rows = data || [];
  if (!oldest) list.replaceChildren();
  list.append(...rows.map(item));
  if (rows.length) oldest = rows[rows.length - 1].at;
  more.hidden = rows.length < 40;
  if (!list.children.length) list.append(el("p", { class: "gm-note" }, "Nothing here yet. Follow members from their profiles, or find some on the ",
    el("a", { href: "/games/#gm-voters", text: "leaderboard" }), "."));
}

async function following(box) {
  if (!me.profile || !me.profile.handle) return;
  const { data, error } = await sb.rpc("following_of", { p_handle: me.profile.handle, p_limit: 60 });
  if (error || !(data || []).length) { box.remove(); return; }
  box.replaceChildren(el("h2", { class: "gm-head", text: "You follow " + data.length }),
    el("div", { class: "fd-people" }, ...data.map((p) => el("a", { class: "fd-person", href: profileUrl(p.handle), title: p.name }, avatar(p.avatar, p.name, 36), el("span", { text: p.name })))));
}

function render() {
  authPill($("gm-auth"), { okTail: "." });
  oldest = null;
  if (!me.user) { root.replaceChildren(hero(), el("p", { class: "fr-gate" }, el("button", { class: "linkbtn", type: "button", onclick: signIn, text: "Sign in" }), " to see the people you follow.")); return; }
  if (!me.member) { root.replaceChildren(hero(), el("p", { class: "fr-gate" }, el("a", { class: "linkbtn", href: INVITE, target: "_blank", rel: "noopener", text: "Join the Discord" }), " to follow members.")); return; }
  const list = el("div", { class: "fd-list" }, el("p", { class: "gm-empty", text: "Loading…" }));
  const more = el("button", { class: "btn gm-btn fd-more", type: "button", text: "Show older", hidden: true });
  const people = el("section", { class: "pf-card fd-following" });
  more.addEventListener("click", () => load(list, more));
  root.replaceChildren(hero(), people, list, more);
  following(people);
  load(list, more);
}
subnav($("rop-tabs"), "ratings");
onAuth(() => render());
