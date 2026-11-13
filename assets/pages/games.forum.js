/* pages/games.forum.js: Rate-O-Pedia Forums (/games/forum/ and /games/forum/?p=<id>). Prefix fr-.
 * Everyone can read. Discord-server members can post, comment, react and report. Posts and comments are plain
 * text (links become clickable); nothing a member writes is ever inserted as HTML.
 */
import { sb, $, el, me, onAuth, authPill, subnav, signIn, avatar, nameLink, ownerTag, adminTag, ago, share, sfx, toast, INVITE } from "./games.common.js?v=4";

const CATS = [["", "All"], ["anyps", "AnyPS"], ["games", "Games"], ["general", "General"], ["help", "Help"], ["offtopic", "Off-topic"]];
const catName = (k) => (CATS.find(([c]) => c === k) || [k, k])[1];
const REACTS = [["like", "👍", "Like"], ["love", "❤️", "Love"], ["laugh", "😂", "Haha"], ["wow", "😮", "Wow"], ["fire", "🔥", "Fire"], ["gg", "🎮", "GG"]];
const SORTS = [["bumped_at", "Latest activity"], ["created_at", "Newest"], ["reaction_total", "Most reactions"], ["comments", "Most comments"]];
const PAGE = 20;
const root = $("fr-root");
const params = new URLSearchParams(location.search);
const postId = /^\d+$/.test(params.get("p") || "") ? +params.get("p") : null;
const postUrl = (id) => "/games/forum/?p=" + id;
const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");
let cat = CATS.some(([c]) => c === params.get("c")) ? params.get("c") : "", sort = "bumped_at", query = "", shown = 0, myReacts = new Map();

/* plain text with clickable links and kept line breaks */
function rich(text, cls) {
  const box = el("div", { class: cls || "fr-body" });
  for (const para of String(text || "").split(/\n{2,}/)) {
    const p = el("p");
    const lines = para.split("\n");
    lines.forEach((line, li) => {
      let last = 0;
      line.replace(/https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g, (url, at) => {
        if (at > last) p.append(line.slice(last, at));
        p.append(el("a", { href: url, target: "_blank", rel: "nofollow noopener ugc", text: url.length > 60 ? url.slice(0, 57) + "…" : url }));
        last = at + url.length; return url;
      });
      if (last < line.length) p.append(line.slice(last));
      if (li < lines.length - 1) p.append(el("br"));
    });
    box.append(p);
  }
  return box;
}

const canWrite = () => me.member && me.ready;
function gate(what) {
  if (!me.user) return el("p", { class: "fr-gate" }, el("button", { class: "btn gm-btn", type: "button", onclick: signIn, text: "Sign in with Discord" }), " to " + what + ".");
  if (me.banned) return el("p", { class: "fr-gate gm-bad", text: "This account is suspended." });
  if (!me.member) return el("p", { class: "fr-gate" }, el("a", { class: "btn gm-btn", href: INVITE, target: "_blank", rel: "noopener", text: "Join the Discord" }), " to " + what + ". Members only, to keep the spam out.");
  return null;
}
function byline(x, extra) {
  return el("div", { class: "fr-by" }, avatar(x.avatar, x.author, 28), nameLink(x.handle, x.author), x.author_is_owner ? ownerTag() : null, x.author_is_staff ? adminTag() : null,
    el("span", { class: "fr-when", title: new Date(x.created_at).toLocaleString(), text: ago(x.created_at) + (x.edited_at ? " · edited" : "") }), extra || null);
}
async function report(target, btn) {
  const reason = prompt("What's wrong with it? (optional)");
  if (reason === null) return;
  const { error } = await sb.from("forum_reports").insert({ user_id: me.user.id, reason: reason.trim().slice(0, 300) || null, ...target });
  btn.textContent = error ? "Couldn't report" : "Reported — thanks"; btn.disabled = true;
}

/* ---------------- reactions ---------------- */
async function loadMyReacts(ids) {
  myReacts = new Map();
  if (!me.user || !ids.length) return;
  const { data } = await sb.from("forum_reactions").select("post_id,emoji").in("post_id", ids);
  for (const r of data || []) { if (!myReacts.has(r.post_id)) myReacts.set(r.post_id, new Set()); myReacts.get(r.post_id).add(r.emoji); }
}
function reactBar(post, compact) {
  const bar = el("div", { class: "fr-reacts" + (compact ? " fr-reacts--compact" : ""), role: "group", "aria-label": "Reactions" });
  const counts = Object.assign({}, post.reactions || {});
  const mine = myReacts.get(post.id) || new Set();
  const draw = () => {
    bar.replaceChildren();
    for (const [k, glyph, label] of REACTS) {
      const n = counts[k] || 0, on = mine.has(k);
      if (compact && !n) continue;
      bar.append(el("button", { type: "button", class: "fr-react" + (on ? " is-on" : ""), "aria-pressed": on ? "true" : "false", title: label + (canWrite() ? "" : " (members can react)"), "aria-label": label + ", " + n,
        disabled: compact || !canWrite() ? true : null, onclick: () => toggle(k) }, el("span", { class: "fr-react__g", text: glyph }), n ? el("span", { class: "fr-react__n", text: String(n) }) : null));
    }
  };
  async function toggle(k) {
    const on = mine.has(k);
    if (on) { mine.delete(k); counts[k] = Math.max(0, (counts[k] || 1) - 1); } else { mine.add(k); counts[k] = (counts[k] || 0) + 1; }
    myReacts.set(post.id, mine); draw(); sfx("tap");
    const res = on
      ? await sb.from("forum_reactions").delete().eq("post_id", post.id).eq("user_id", me.user.id).eq("emoji", k)
      : await sb.from("forum_reactions").insert({ post_id: post.id, user_id: me.user.id, emoji: k });
    if (res.error) { toast("That reaction didn't save", "err"); if (on) { mine.add(k); counts[k]++; } else { mine.delete(k); counts[k]--; } draw(); }
  }
  draw();
  return bar;
}

/* ---------------- the list ---------------- */
function postCard(f) {
  const excerpt = f.body.length > 280 ? f.body.slice(0, 277).trimEnd() + "…" : f.body;
  return el("article", { class: "fr-card" + (f.pinned ? " fr-card--pin" : "") },
    el("div", { class: "fr-card__top" },
      el("span", { class: "fr-cat", "data-c": f.category, text: catName(f.category) }),
      f.pinned ? el("span", { class: "fr-flag", text: "📌 Pinned" }) : null,
      f.locked ? el("span", { class: "fr-flag", text: "🔒 Locked" }) : null),
    el("h3", { class: "fr-title" }, el("a", { href: postUrl(f.id), text: f.title })),
    el("p", { class: "fr-excerpt", text: excerpt }),
    byline(f),
    el("div", { class: "fr-card__foot" },
      reactBar(f, true),
      el("a", { class: "linkbtn fr-ccount", href: postUrl(f.id) + "#comments", text: "💬 " + plural(f.comments, "comment") }),
      el("button", { class: "linkbtn fr-share", type: "button", text: "Share", onclick: () => share(postUrl(f.id), f.title) })));
}

async function listView(more) {
  const list = $("fr-list"), status = $("fr-status");
  if (!more) { shown = 0; list.replaceChildren(); }
  status.textContent = "Loading…";
  let req = sb.from("forum_feed").select("*");
  if (cat) req = req.eq("category", cat);
  if (query.length >= 2) req = req.ilike("title", "%" + query.replace(/[%_]/g, " ") + "%");
  req = req.order("pinned", { ascending: false }).order(sort, { ascending: false }).order("id", { ascending: false }).range(shown, shown + PAGE - 1);
  const { data, error } = await req;
  if (error) { status.textContent = "The forums switch on as soon as the site's database update goes in. Check back soon."; $("fr-more").hidden = true; return; }
  await loadMyReacts(data.map((f) => f.id));
  status.textContent = "";
  list.append(...data.map(postCard));
  shown += data.length;
  if (!shown) list.append(el("p", { class: "gm-empty", text: query ? "No posts match that." : "No posts here yet. Start the first one!" }));
  $("fr-more").hidden = data.length < PAGE;
}

function composer() {
  const box = $("fr-new"); box.replaceChildren();
  const g = gate("start a post"); if (g) { box.append(g); return; }
  const sel = el("select", { class: "gm-sel", "aria-label": "Category" }, ...CATS.slice(1).map(([k, label]) => el("option", { value: k, text: label, selected: k === (cat || "general") })));
  const title = el("input", { class: "gm-search", maxlength: "120", placeholder: "Title", "aria-label": "Post title" });
  const body = el("textarea", { class: "gm-ta", maxlength: "5000", rows: "6", placeholder: "Say what's on your mind. AnyPS, a game, a question, anything. Links work.", "aria-label": "Post body" });
  const note = el("p", { class: "gm-note", role: "status" });
  const go = el("button", { class: "btn gm-btn", type: "button", text: "Post it", onclick: async () => {
    const t = title.value.trim(), b = body.value.trim();
    if (t.length < 3) { note.textContent = "Give it a title (3 characters or more)."; return; }
    if (!b) { note.textContent = "Write something first."; return; }
    go.disabled = true; note.textContent = "Posting…";
    const { data, error } = await sb.from("forum_posts").insert({ user_id: me.user.id, category: sel.value, title: t, body: b }).select("id").single();
    go.disabled = false;
    if (error) { note.textContent = "That didn't post: " + error.message; sfx("error"); return; }
    sfx("success"); location.href = postUrl(data.id);
  } });
  const det = el("details", { class: "fr-compose" }, el("summary", { class: "btn gm-btn", text: "＋ New post" }),
    el("div", { class: "fr-compose__body" }, el("div", { class: "fr-compose__row" }, sel, title), body, el("div", { class: "fr-compose__row" }, go, note)));
  box.append(det);
}

function listShell() {
  document.title = "Forums — Rate-O-Pedia";
  const tabs = el("div", { class: "gm-tabs fr-cats", role: "group", "aria-label": "Category" });
  const drawTabs = () => tabs.replaceChildren(...CATS.map(([k, label]) => el("button", { type: "button", class: "gm-tab fr-cat-tab" + (k === cat ? " is-on" : ""), "data-c": k || "all", "aria-pressed": k === cat ? "true" : "false", text: label,
    onclick: () => { cat = k; drawTabs(); history.replaceState(null, "", k ? "?c=" + k : location.pathname); listView(); composer(); } })));
  drawTabs();
  const sortSel = el("select", { class: "gm-sel", "aria-label": "Sort" , onchange: (e) => { sort = e.target.value; listView(); } }, ...SORTS.map(([k, label]) => el("option", { value: k, text: label })));
  let t = 0;
  const search = el("input", { class: "gm-search fr-search", type: "search", placeholder: "Search post titles…", "aria-label": "Search posts", oninput: (e) => { clearTimeout(t); t = setTimeout(() => { query = e.target.value.trim(); listView(); }, 250); } });
  root.replaceChildren(
    el("div", { id: "fr-new" }),
    el("div", { class: "fr-tools" }, search, sortSel),
    tabs,
    el("p", { class: "gm-status", id: "fr-status", role: "status", "aria-live": "polite" }),
    el("section", { class: "fr-list", id: "fr-list", "aria-label": "Posts" }),
    el("button", { class: "linkbtn fr-morebtn", id: "fr-more", type: "button", hidden: true, text: "Load more", onclick: () => listView(true) }));
  composer();
  listView();
}

/* ---------------- one post ---------------- */
async function postView() {
  root.replaceChildren(el("p", { class: "gm-empty", text: "Loading…" }));
  const { data: f, error } = await sb.from("forum_feed").select("*").eq("id", postId).maybeSingle();
  if (error) return root.replaceChildren(el("p", { class: "gm-empty", text: "The forums switch on as soon as the site's database update goes in. Check back soon." }));
  if (!f) return root.replaceChildren(el("section", { class: "fr-post" }, el("h2", { text: "Post not found" }), el("p", { class: "gm-note", text: "It may have been deleted." }), el("a", { class: "linkbtn", href: "/games/forum/", text: "← All posts" })));
  document.title = f.title + " — Rate-O-Pedia Forums";
  await loadMyReacts([f.id]);
  const mine = !!(me.profile && me.profile.handle === f.handle);
  const tools = el("span", { class: "fr-tools-inline" });
  if (mine && canWrite()) tools.append(
    el("button", { class: "linkbtn", type: "button", text: "Edit", onclick: () => editPost(f, art) }),
    el("button", { class: "linkbtn", type: "button", text: "Delete", onclick: async () => {
      if (!confirm("Delete this post and its comments?")) return;
      const { error } = await sb.from("forum_posts").delete().eq("id", f.id);
      if (error) toast("Couldn't delete: " + error.message, "err"); else location.href = "/games/forum/";
    } }));
  else if (canWrite()) tools.append(el("button", { class: "linkbtn", type: "button", text: "Report", onclick: (e) => report({ post_id: f.id }, e.target) }));
  const art = el("article", { class: "fr-post" },
    el("a", { class: "linkbtn fr-back", href: "/games/forum/" + (f.category ? "?c=" + f.category : ""), text: "← " + catName(f.category) }),
    el("div", { class: "fr-card__top" }, el("span", { class: "fr-cat", "data-c": f.category, text: catName(f.category) }),
      f.pinned ? el("span", { class: "fr-flag", text: "📌 Pinned" }) : null, f.locked ? el("span", { class: "fr-flag", text: "🔒 Locked" }) : null),
    el("h1", { class: "fr-ptitle", text: f.title }),
    byline(f, tools),
    rich(f.body),
    el("div", { class: "fr-card__foot" }, reactBar(f, false),
      el("button", { class: "btn gm-btn fr-share", type: "button", text: "Share", onclick: () => share(postUrl(f.id), f.title) })));
  const comments = el("section", { class: "fr-comments", id: "comments", "aria-label": "Comments" });
  root.replaceChildren(art, comments);
  loadComments(f, comments);
}

function editPost(f, art) {
  const title = el("input", { class: "gm-search", maxlength: "120", value: f.title, "aria-label": "Post title" });
  const body = el("textarea", { class: "gm-ta", maxlength: "5000", rows: "8", "aria-label": "Post body" }); body.value = f.body;
  const note = el("p", { class: "gm-note", role: "status" });
  art.replaceChildren(el("h2", { text: "Edit post" }), title, body, el("div", { class: "fr-compose__row" },
    el("button", { class: "btn gm-btn", type: "button", text: "Save", onclick: async () => {
      const { error } = await sb.from("forum_posts").update({ title: title.value.trim(), body: body.value.trim(), edited_at: new Date().toISOString() }).eq("id", f.id);
      if (error) { note.textContent = "Didn't save: " + error.message; return; }
      postView();
    } }),
    el("button", { class: "linkbtn", type: "button", text: "Cancel", onclick: postView }), note));
}

async function loadComments(f, box) {
  const { data } = await sb.from("forum_thread").select("*").eq("post_id", f.id).order("created_at").limit(500);
  const rows = data || [];
  box.replaceChildren(el("h2", { class: "gm-head", text: plural(rows.length, "comment") }));
  for (const c of rows) {
    const mine = !!(me.profile && me.profile.handle === c.handle);
    const tools = el("span", { class: "fr-tools-inline" });
    const item = el("div", { class: "fr-comment", id: "c" + c.id });
    if (mine && canWrite()) tools.append(
      el("button", { class: "linkbtn", type: "button", text: "Edit", onclick: () => {
        const ta = el("textarea", { class: "gm-ta", maxlength: "2000", rows: "3", "aria-label": "Edit comment" }); ta.value = c.body;
        item.replaceChildren(ta, el("div", { class: "fr-compose__row" },
          el("button", { class: "btn gm-btn", type: "button", text: "Save", onclick: async () => {
            const { error } = await sb.from("forum_comments").update({ body: ta.value.trim(), edited_at: new Date().toISOString() }).eq("id", c.id);
            if (error) toast("Didn't save: " + error.message, "err"); else loadComments(f, box);
          } }),
          el("button", { class: "linkbtn", type: "button", text: "Cancel", onclick: () => loadComments(f, box) })));
      } }),
      el("button", { class: "linkbtn", type: "button", text: "Delete", onclick: async () => {
        if (!confirm("Delete this comment?")) return;
        const { error } = await sb.from("forum_comments").delete().eq("id", c.id);
        if (error) toast("Couldn't delete: " + error.message, "err"); else loadComments(f, box);
      } }));
    else if (canWrite()) tools.append(el("button", { class: "linkbtn", type: "button", text: "Report", onclick: (e) => report({ comment_id: c.id }, e.target) }));
    tools.append(el("button", { class: "linkbtn", type: "button", text: "Link", title: "Share this comment", onclick: () => share(postUrl(f.id) + "#c" + c.id, f.title) }));
    item.append(byline(c, tools), rich(c.body, "fr-body fr-body--c"));
    box.append(item);
  }
  if (!rows.length) box.append(el("p", { class: "gm-note", text: "No comments yet." }));
  if (f.locked) { box.append(el("p", { class: "gm-note", text: "🔒 This post is locked, so it can't take new comments." })); return; }
  const g = gate("comment"); if (g) { box.append(g); return; }
  const ta = el("textarea", { class: "gm-ta", maxlength: "2000", rows: "3", placeholder: "Add a comment…", "aria-label": "Your comment" });
  const note = el("p", { class: "gm-note", role: "status" });
  const go = el("button", { class: "btn gm-btn", type: "button", text: "Comment", onclick: async () => {
    const b = ta.value.trim(); if (!b) return;
    go.disabled = true;
    const { error } = await sb.from("forum_comments").insert({ post_id: f.id, user_id: me.user.id, body: b });
    go.disabled = false;
    if (error) { note.textContent = "That didn't send: " + error.message; sfx("error"); return; }
    sfx("success"); loadComments(f, box);
  } });
  box.append(el("div", { class: "fr-reply" }, avatar(me.profile && (me.profile.custom_avatar || me.profile.avatar), me.profile && (me.profile.display_name || me.profile.name), 32), el("div", { class: "fr-reply__in" }, ta, el("div", { class: "fr-compose__row" }, go, note))));
  if (location.hash && location.hash.startsWith("#c")) { const t = document.getElementById(location.hash.slice(1)); if (t) { t.classList.add("is-target"); t.scrollIntoView({ block: "center" }); } }
}

/* ---------------- start ---------------- */
subnav($("rop-tabs"), "forum");
onAuth(() => {
  authPill($("gm-auth"), { okTail: ", you can post." });
  if (postId) postView(); else listShell();
});
