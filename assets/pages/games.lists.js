/* pages/games.lists.js: game lists (/games/lists/, one list at /games/lists/?id=N). Prefix ls-.
 * Anyone reads public lists. Members make, edit, like and share them. Every write goes through a database function
 * (save_list, delete_list, toggle_list_like) that checks the member and the limits, so nothing here is trusted.
 */
import { sb, $, el, me, onAuth, authPill, subnav, signIn, avatar, profileUrl, nameLink, ago, share, sfx, toast, INVITE,
  consoleChip, gameUrl, artSlot, hasSearchKey, titleSearch, scoreCols, scorePair , statsChanged } from "./games.common.js?v=16";

const root = $("ls-root");
const qs = new URLSearchParams(location.search);
const listId = /^\d+$/.test(qs.get("id") || "") ? +qs.get("id") : null;
const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");
const canWrite = () => me.user && me.member && me.ready && !me.banned;
const notReady = (e) => /game_lists|public_lists|save_list|relation|function|schema cache/i.test((e && e.message) || "");

function hero(title, sub, ...btns) {
  return el("header", { class: "hero ls-hero", style: "padding:0 0 10px" }, el("div", { class: "eyebrow", text: "Rate-O-Pedia · lists" }), el("h1", { text: title }),
    sub ? el("p", { class: "lead", text: sub }) : null, btns.length ? el("div", { class: "ph-btns" }, ...btns) : null);
}
const waitNote = () => el("p", { class: "gm-note", text: "Lists switch on after the owner runs 21_rateopedia_lists_follows.sql." });

/* a list card: 2x2 box-art mosaic, title, author, counts */
function card(l) {
  const mosaic = el("div", { class: "ls-mosaic", "aria-hidden": "true" }, ...(l.preview || []).slice(0, 4).map((id) => artSlot(id, "", "ls-tile")));
  return el("a", { class: "ls-card", href: "/games/lists/?id=" + l.id },
    mosaic,
    el("div", { class: "ls-card__b" },
      el("b", { class: "ls-card__t", text: l.title }),
      el("span", { class: "ls-card__by" }, avatar(l.avatar, l.author, 20), el("span", { text: l.author || "member" })),
      el("span", { class: "gm-note", text: plural(l.games || 0, "game") + " · ♥ " + (l.likes || 0) + (l.ranked ? " · ranked" : "") + " · " + ago(l.updated_at) })));
}

/* ---------------- index: new, mine, recent, most liked ---------------- */
async function index() {
  const newBtn = canWrite() ? el("button", { class: "btn gm-btn", type: "button", text: "＋ New list", onclick: () => editor(null) })
    : el("p", { class: "gm-note" }, me.user ? el("a", { href: INVITE, target: "_blank", rel: "noopener", text: "Join the Discord" }) : el("button", { class: "linkbtn", type: "button", onclick: signIn, text: "Sign in" }), " to make your own lists.");
  const recent = el("div", { class: "ls-grid" }, el("p", { class: "gm-empty", text: "Loading…" }));
  const liked = el("div", { class: "ls-grid" });
  const mine = el("div", { class: "ls-grid" });
  root.replaceChildren(hero("Game lists", "Favourites, rankings, hidden gems and to-play piles from the community.", newBtn),
    canWrite() ? el("section", { class: "ls-sec", id: "ls-mine" }, el("h2", { class: "gm-head", text: "Your lists" }), mine) : "",
    el("section", { class: "ls-sec" }, el("h2", { class: "gm-head", text: "Most liked" }), liked),
    el("section", { class: "ls-sec" }, el("h2", { class: "gm-head", text: "Latest lists" }), recent));
  const [r, k] = await Promise.all([
    sb.from("public_lists").select("*").order("updated_at", { ascending: false }).limit(30),
    sb.from("public_lists").select("*").gt("likes", 0).order("likes", { ascending: false }).limit(8)]);
  if (r.error) { recent.replaceChildren(notReady(r.error) ? waitNote() : el("p", { class: "gm-bad", text: r.error.message })); liked.parentElement.remove(); mine.parentElement && mine.parentElement.remove(); return; }
  recent.replaceChildren(...(r.data || []).map(card));
  if (!(r.data || []).length) recent.append(el("p", { class: "gm-note", text: "No lists yet. Make the first one." }));
  if ((k.data || []).length) liked.replaceChildren(...k.data.map(card)); else liked.parentElement.remove();
  if (canWrite()) {
    const m = await sb.from("game_lists").select("id,title,ranked,is_public,updated_at").eq("user_id", me.user.id).order("updated_at", { ascending: false });
    const pub = new Map((r.data || []).map((x) => [x.id, x]));
    mine.replaceChildren(...(m.data || []).map((x) => pub.get(x.id) ? card(pub.get(x.id))
      : el("a", { class: "ls-card ls-card--private", href: "/games/lists/?id=" + x.id }, el("div", { class: "ls-mosaic" }), el("div", { class: "ls-card__b" }, el("b", { class: "ls-card__t", text: x.title }), el("span", { class: "gm-note", text: (x.is_public ? "public" : "🔒 private") + " · " + ago(x.updated_at) })))));
    if (!(m.data || []).length) mine.append(el("p", { class: "gm-note", text: "You haven't made a list yet." }));
  }
  document.title = "Game lists — Rate-O-Pedia";
}

/* ---------------- one list ---------------- */
async function view() {
  const { data: l, error } = await sb.from("game_lists").select("*").eq("id", listId).maybeSingle();
  if (error) { root.replaceChildren(hero("Game lists", ""), notReady(error) ? waitNote() : el("p", { class: "gm-bad", text: error.message })); return; }
  if (!l) { root.replaceChildren(hero("List not found", "It may be private or deleted."), el("a", { class: "linkbtn", href: "/games/lists/", text: "← All lists" })); return; }
  const [items, pub] = await Promise.all([
    sb.from("game_list_items").select("game_id,position,note").eq("list_id", l.id).order("position"),
    sb.from("public_lists").select("handle,author,avatar,likes").eq("id", l.id).maybeSingle()]);
  const rows = items.data || [];
  const cols = await scoreCols("id,console,title,votes,average");
  const g = rows.length ? await sb.from("game_scores").select(cols).in("id", rows.map((x) => x.game_id)) : { data: [] };
  const games = new Map((g.data || []).map((x) => [x.id, x]));
  const mine = me.user && l.user_id === me.user.id;
  const author = pub.data;   // null for a private list: shown as "You"
  let likes = (pub.data && pub.data.likes) || 0, liked = false;
  if (canWrite()) { const x = await sb.from("game_list_likes").select("list_id").eq("list_id", l.id).maybeSingle(); liked = !!x.data; }
  const likeBtn = el("button", { class: "linkbtn ls-like" + (liked ? " is-on" : ""), type: "button", "aria-pressed": String(liked) });
  const drawLike = () => { likeBtn.textContent = (liked ? "♥ Liked" : "♡ Like") + " · " + likes; likeBtn.classList.toggle("is-on", liked); likeBtn.setAttribute("aria-pressed", String(liked)); };
  drawLike();
  likeBtn.addEventListener("click", async () => {
    if (!canWrite()) { toast(me.user ? "Join the Discord to like lists." : "Sign in to like lists."); return; }
    if (mine) { toast("That's your own list."); return; }
    const { data, error: e } = await sb.rpc("toggle_list_like", { p_id: l.id });
    if (e) { toast(e.message, "err"); return; }
    liked = data === true; likes += liked ? 1 : -1; drawLike(); sfx("tap");
  });
  const btns = [likeBtn, el("button", { class: "linkbtn", type: "button", text: "Share", onclick: () => share("/games/lists/?id=" + l.id, l.title) })];
  if (mine) btns.push(el("button", { class: "linkbtn", type: "button", text: "Edit", onclick: () => editor(l, rows, games) }),
    el("button", { class: "linkbtn gm-bad", type: "button", text: "Delete", onclick: async () => {
      if (!confirm("Delete “" + l.title + "” for good?")) return;
      const { error: e } = await sb.rpc("delete_list", { p_id: l.id });
      if (e) toast(e.message, "err"); else location.href = "/games/lists/";
    } }));
  else if (me.admin) btns.push(el("button", { class: "linkbtn gm-bad", type: "button", text: "Delete (owner)", onclick: async () => {
    if (!confirm("Delete this member's list?")) return;
    const { error: e } = await sb.rpc("delete_list", { p_id: l.id }); if (e) toast(e.message, "err"); else location.href = "/games/lists/";
  } }));
  const by = el("p", { class: "ls-by" }, author ? avatar(author.avatar, author.author, 24) : null, author ? nameLink(author.handle, author.author) : el("span", { text: mine ? "You" : "A member" }),
    el("span", { class: "gm-note", text: " · " + plural(rows.length, "game") + " · updated " + ago(l.updated_at) + (l.is_public ? "" : " · 🔒 private") }));
  const list = el("ol", { class: "ls-items" + (l.ranked ? " is-ranked" : "") }, ...rows.map((x, i) => {
    const gg = games.get(x.game_id) || { id: x.game_id, title: x.game_id, console: x.game_id.split(":")[0], votes: 0 };
    return el("li", { class: "ls-item" },
      l.ranked ? el("span", { class: "ls-rank", text: String(i + 1) }) : null,
      artSlot(gg.id, gg.title, "ls-art"),
      el("div", { class: "ls-item__b" },
        el("div", { class: "ls-item__top" }, consoleChip(gg.console), el("a", { class: "ls-item__t", href: gameUrl(gg.id), text: gg.title })),
        scorePair(gg, true) || el("span", { class: "gm-note", text: gg.votes > 0 ? Number(gg.average).toFixed(1) + " / 5" : "not rated yet" }),
        x.note ? el("p", { class: "ls-note", text: x.note }) : null));
  }));
  root.replaceChildren(el("a", { class: "linkbtn fr-back", href: "/games/lists/", text: "← All lists" }),
    hero(l.title, l.description || "", ...btns), by,
    rows.length ? list : el("p", { class: "gm-note", text: "This list is empty." + (mine ? " Press Edit to add games." : "") }));
  document.title = l.title + " — Rate-O-Pedia lists";
}

/* ---------------- editor (new or existing list) ---------------- */
function editor(l, rows, games) {
  const d = el("dialog", { class: "pf-dlg ls-dlg", "aria-label": l ? "Edit list" : "New list" });
  const close = () => d.close();
  const items = (rows || []).map((x) => { const g = (games && games.get(x.game_id)) || { id: x.game_id, title: x.game_id, console: x.game_id.split(":")[0] }; return { id: g.id, title: g.title, console: g.console, note: x.note || "" }; });
  const title = el("input", { class: "gm-search", maxlength: "80", value: l ? l.title : "", placeholder: "List name, e.g. Best PS2 RPGs", "aria-label": "List name" });
  const desc = el("textarea", { class: "gm-ta", maxlength: "500", rows: "2", placeholder: "What's this list about? (optional)", "aria-label": "Description" });
  desc.value = l ? l.description || "" : "";
  const ranked = el("input", { type: "checkbox" }); ranked.checked = l ? l.ranked : false;
  const pub = el("input", { type: "checkbox" }); pub.checked = l ? l.is_public : true;
  const q = el("input", { class: "gm-search", type: "search", placeholder: "Add a game…", "aria-label": "Search for a game to add" });
  const res = el("div", { class: "pf-res" });
  const box = el("ol", { class: "ls-edit" });
  const note = el("p", { class: "gm-note", role: "status" });
  const draw = () => {
    box.replaceChildren(...items.map((it, i) => el("li", { class: "ls-edit__row" },
      el("span", { class: "ls-rank", text: String(i + 1) }), consoleChip(it.console), el("b", { class: "ls-edit__t", text: it.title }),
      el("input", { class: "ls-edit__note", maxlength: "200", value: it.note, placeholder: "Note (optional)", "aria-label": "Note for " + it.title, oninput: (e) => { it.note = e.target.value; } }),
      el("span", { class: "ls-edit__btns" },
        el("button", { class: "linkbtn", type: "button", "aria-label": "Move up", text: "↑", disabled: i === 0, onclick: () => { [items[i - 1], items[i]] = [items[i], items[i - 1]]; draw(); } }),
        el("button", { class: "linkbtn", type: "button", "aria-label": "Move down", text: "↓", disabled: i === items.length - 1, onclick: () => { [items[i + 1], items[i]] = [items[i], items[i + 1]]; draw(); } }),
        el("button", { class: "linkbtn gm-bad", type: "button", "aria-label": "Remove " + it.title, text: "✕", onclick: () => { items.splice(i, 1); draw(); } })))));
    if (!items.length) box.append(el("li", { class: "gm-note", text: "No games yet. Search above to add some." }));
  };
  let t = 0;
  q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(async () => {
    const s = q.value.trim(); if (s.length < 2) { res.replaceChildren(); return; }
    await hasSearchKey();
    const { data } = await titleSearch(sb.from("game_scores").select("id,title,console"), s).order("votes", { ascending: false }).limit(8);
    res.replaceChildren(...(data || []).map((x) => el("button", { type: "button", class: "pf-res__b", onclick: () => {
      if (items.some((it) => it.id === x.id)) { note.textContent = "That game is already on the list."; return; }
      if (items.length >= 100) { note.textContent = "A list holds up to 100 games."; return; }
      items.push({ id: x.id, title: x.title, console: x.console, note: "" }); draw(); q.value = ""; res.replaceChildren(); q.focus();
    } }, consoleChip(x.console), " " + x.title)));
    if (!res.children.length) res.append(el("p", { class: "gm-note", text: "No match." }));
  }, 220); });
  const save = el("button", { class: "btn gm-btn", type: "button", text: l ? "Save changes" : "Create list", onclick: async () => {
    save.disabled = true; note.textContent = "";
    const { data, error } = await sb.rpc("save_list", { p_id: l ? l.id : null, p_title: title.value, p_description: desc.value, p_ranked: ranked.checked, p_public: pub.checked,
      p_items: items.map((it) => ({ game_id: it.id, note: it.note.trim() })) });
    save.disabled = false;
    if (error) { note.textContent = notReady(error) ? "Lists switch on after the owner runs the database update." : error.message; sfx("error"); return; }
    sfx("success"); statsChanged(); toast(l ? "List saved" : "List created", "ok"); close();
    if (!l) location.href = "/games/lists/?id=" + data; else view();
  } });
  d.append(
    el("div", { class: "pf-dlg__head" }, el("h2", { text: l ? "Edit list" : "New list" }), el("button", { class: "sx-x pf-x", type: "button", "aria-label": "Close", text: "✕", onclick: close })),
    el("div", { class: "ls-form" }, title, desc,
      el("div", { class: "ls-opts" }, el("label", null, ranked, " Ranked (numbered 1, 2, 3…)"), el("label", null, pub, " Public (anyone can see it)")),
      el("div", { class: "pf-slot__q" }, q, res), box),
    el("div", { class: "pf-dlg__foot" }, save, note));
  draw();
  document.body.append(d);
  d.addEventListener("close", () => d.remove());
  d.showModal();
  title.focus();
}

function render() {
  authPill($("gm-auth"), { okTail: ", you can make lists." });
  if (listId) view(); else index();
}
subnav($("rop-tabs"), "ratings");
onAuth(() => render());
