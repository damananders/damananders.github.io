/* pages/games.station.js: the Operation Station (/games/station/), the site owner's moderation desk. Prefix op-.
 * The page itself is not the lock: every read here is allowed only by the database's is_admin() policies, and every
 * action is a database function that refuses anyone who isn't in public.site_admins. Nobody can add themselves to
 * that table from a browser; the owner does it once from the Supabase SQL editor.
 */
import { sb, $, el, me, onAuth, authPill, subnav, signIn, avatar, profileUrl, shortDate, ago, sfx, toast, consoleChip } from "./games.common.js?v=11";

const root = $("op-root");
const TABS = [["reports", "Reports"], ["posts", "Posts"], ["comments", "Comments"], ["reviews", "Reviews"], ["members", "Members"], ["media", "Media"], ["games", "Added games"]];
let tab = TABS.some(([k]) => k === location.hash.slice(1)) ? location.hash.slice(1) : "reports";
const people = new Map();   // user_id -> profile row (admin can read every profile)

async function loadPeople(ids) {
  const need = [...new Set(ids.filter((id) => id && !people.has(id)))];
  if (!need.length) return;
  const { data } = await sb.from("profiles").select("id,handle,name,display_name,avatar,custom_avatar,banned,is_member,created_at,motto").in("id", need);
  for (const p of data || []) people.set(p.id, p);
}
function who(id) {
  const p = people.get(id);
  if (!p) return el("span", { class: "gm-note", text: "unknown member" });
  const n = p.display_name || p.name || "member";
  return el("a", { class: "op-who", href: profileUrl(p.handle), target: "_blank", rel: "noopener" }, avatar(p.custom_avatar || p.avatar, n, 22), el("span", { text: n }), p.banned ? el("span", { class: "op-pill op-pill--bad", text: "banned" }) : null);
}
const pill = (on, text, bad) => on ? el("span", { class: "op-pill" + (bad ? " op-pill--bad" : ""), text }) : null;
async function act(fn, args, okMsg, then) {
  const { error } = await sb.rpc(fn, args);
  if (error) { toast(error.message, "err"); sfx("error"); return false; }
  toast(okMsg, "ok"); sfx("success"); if (then) then(); return true;
}
const btn = (text, onclick, danger) => el("button", { class: "op-btn" + (danger ? " op-btn--danger" : ""), type: "button", text, onclick });
const sure = (msg) => confirm(msg);
const snip = (t, n) => { t = String(t || ""); return t.length > (n || 220) ? t.slice(0, (n || 220) - 1) + "…" : t; };

/* ---------------- gate ---------------- */
function gate() {
  if (!me.user) return root.replaceChildren(el("section", { class: "pf-card op-gate" }, el("h2", { text: "Operation Station" }), el("p", { text: "Sign in to continue." }),
    el("button", { class: "btn gm-btn", type: "button", onclick: signIn, text: "Sign in with Discord" })));
  if (!me.ready) return root.replaceChildren(el("section", { class: "pf-card op-gate" }, el("h2", { text: "Operation Station" }),
    el("p", { text: "The station needs the database update first: run 11_rateopedia_profiles_forums_station.sql in Supabase › SQL Editor, then reload this page." })));
  if (!me.admin) {
    const line = "insert into public.site_admins (user_id) values ('" + me.user.id + "') on conflict do nothing;";
    return root.replaceChildren(el("section", { class: "pf-card op-gate" }, el("h2", { text: "Access denied." }),
      el("p", { text: "This station belongs to the site owner. If that's you, paste this one line into Supabase › SQL Editor › New query, press Run, then reload:" }),
      el("pre", { class: "op-code", text: line }),
      el("button", { class: "linkbtn", type: "button", text: "Copy it", onclick: () => navigator.clipboard.writeText(line).then(() => toast("Copied", "ok")) }),
      el("p", { class: "gm-note", text: "Only someone signed in to your Supabase dashboard can run it, so showing it here gives nothing away." })));
  }
  shell();
}

/* ---------------- shell ---------------- */
async function counts() {
  const c = async (q) => { const r = await q; return r.count ?? "?"; };
  const [rep, posts, coms, mem, ban] = await Promise.all([
    c(sb.from("forum_reports").select("id", { count: "exact", head: true }).eq("resolved", false)),
    c(sb.from("forum_posts").select("id", { count: "exact", head: true })),
    c(sb.from("forum_comments").select("id", { count: "exact", head: true })),
    c(sb.from("profiles").select("id", { count: "exact", head: true })),
    c(sb.from("profiles").select("id", { count: "exact", head: true }).eq("banned", true)),
  ]);
  $("op-counts").replaceChildren(...[["Open reports", rep, rep > 0], ["Posts", posts], ["Comments", coms], ["Members", mem], ["Banned", ban]].map(([k, v, hot]) =>
    el("div", { class: "op-stat" + (hot ? " is-hot" : "") }, el("b", { text: String(v) }), el("span", { text: k }))));
}
function shell() {
  const nav = el("div", { class: "gm-tabs op-tabs", role: "tablist" });
  const body = el("section", { class: "op-body", id: "op-body" });
  const draw = () => nav.replaceChildren(...TABS.map(([k, label]) => el("button", { type: "button", role: "tab", class: "gm-tab" + (k === tab ? " is-on" : ""), "aria-selected": k === tab ? "true" : "false", text: label,
    onclick: () => { tab = k; history.replaceState(null, "", "#" + k); draw(); open(); } })));
  draw();
  root.replaceChildren(el("div", { class: "op-counts", id: "op-counts" }), nav, body);
  counts(); open();
}
function open() {
  const body = $("op-body"); body.replaceChildren(el("p", { class: "gm-empty", text: "Loading…" }));
  ({ reports, posts, comments, reviews, members, media, games })[tab](body).catch((e) => body.replaceChildren(el("p", { class: "gm-bad", text: "Couldn't load: " + (e.message || e) })));
}
const refresh = () => { counts(); open(); };
function row(...kids) { return el("article", { class: "op-row" }, ...kids); }

/* ---------------- reports ---------------- */
async function reports(body) {
  const { data, error } = await sb.from("forum_reports").select("*").order("resolved").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  const mIds = data.filter((r) => r.media_id).map((r) => r.media_id);
  const M = mIds.length ? await sb.from("game_media").select("id,game_id,path,caption,user_id,hidden").in("id", mIds) : { data: [] };
  const meds = new Map((M.data || []).map((x) => [x.id, x]));
  const pIds = data.filter((r) => r.post_id).map((r) => r.post_id), cIds = data.filter((r) => r.comment_id).map((r) => r.comment_id), rIds = data.filter((r) => r.review_id).map((r) => r.review_id);
  const [P, C, R] = await Promise.all([
    pIds.length ? sb.from("forum_posts").select("id,title,body,user_id,hidden").in("id", pIds) : { data: [] },
    cIds.length ? sb.from("forum_comments").select("id,post_id,body,user_id,hidden").in("id", cIds) : { data: [] },
    rIds.length ? sb.from("reviews").select("id,game_id,body,user_id,hidden").in("id", rIds) : { data: [] }]);
  const posts = new Map((P.data || []).map((x) => [x.id, x])), coms = new Map((C.data || []).map((x) => [x.id, x])), revs = new Map((R.data || []).map((x) => [x.id, x]));
  await loadPeople([...data.map((r) => r.user_id), ...[...posts.values(), ...coms.values(), ...revs.values(), ...meds.values()].map((x) => x.user_id)]);
  body.replaceChildren();
  if (!data.length) return body.append(el("p", { class: "gm-empty", text: "No reports. All quiet." }));
  for (const r of data) {
    let kind, t, link, hideFn, delKind, id;
    if (r.post_id) { kind = "Post"; t = posts.get(r.post_id); id = r.post_id; link = "/games/forum/?p=" + id; hideFn = (h) => act("mod_post", { p_id: id, p_hidden: h }, h ? "Post hidden" : "Post shown", refresh); delKind = "post"; }
    else if (r.comment_id) { kind = "Comment"; t = coms.get(r.comment_id); id = r.comment_id; link = t ? "/games/forum/?p=" + t.post_id + "#c" + id : null; hideFn = (h) => act("mod_comment", { p_id: id, p_hidden: h }, h ? "Comment hidden" : "Comment shown", refresh); delKind = "comment"; }
    else if (r.media_id) { kind = "Upload"; t = meds.get(r.media_id); id = r.media_id; if (t) t.body = (t.caption ? t.caption + " · " : "") + t.path; link = t ? "/games/game/?id=" + encodeURIComponent(t.game_id) : null; hideFn = (h) => act("mod_media", { p_id: id, p_hidden: h }, h ? "Upload hidden" : "Upload shown", refresh); delKind = "media"; }
    else { kind = "Review"; t = revs.get(r.review_id); id = r.review_id; link = t ? "/games/?q=" : null; hideFn = (h) => act("mod_review", { p_id: id, p_hidden: h }, h ? "Review hidden" : "Review shown", refresh); delKind = "review"; }
    body.append(row(
      el("div", { class: "op-meta" }, el("span", { class: "op-pill", text: kind }), pill(r.resolved, "resolved"), pill(t && t.hidden, "hidden", true),
        el("span", { class: "gm-note", text: "reported " + ago(r.created_at) + " by " }), who(r.user_id)),
      el("p", { class: "op-reason", text: r.reason ? "“" + r.reason + "”" : "(no reason given)" }),
      t ? el("blockquote", { class: "op-quote" }, t.title ? el("b", { text: t.title + " — " }) : null, snip(t.body), el("div", { class: "op-by" }, "by ", who(t.user_id))) : el("p", { class: "gm-note", text: "The reported item is already gone." }),
      el("div", { class: "op-acts" },
        link ? el("a", { class: "op-btn", href: link, target: "_blank", rel: "noopener", text: "Open" }) : null,
        t ? btn(t.hidden ? "Unhide" : "Hide", () => hideFn(!t.hidden)) : null,
        t ? btn("Delete " + kind.toLowerCase(), () => sure("Delete this " + kind.toLowerCase() + " for good?") && act("mod_delete", { p_kind: delKind, p_id: String(id) }, kind + " deleted", refresh), true) : null,
        t ? btn("Ban author", () => { const p = people.get(t.user_id); if (p && sure("Ban " + (p.display_name || p.name) + "?")) act("mod_ban", { p_handle: p.handle, p_banned: true }, "Banned", refresh); }, true) : null,
        btn(r.resolved ? "Reopen" : "Mark resolved", () => act("mod_resolve_report", { p_id: r.id, p_resolved: !r.resolved }, r.resolved ? "Reopened" : "Resolved", refresh)))));
  }
}

/* ---------------- posts ---------------- */
async function posts(body) {
  const q = el("input", { class: "gm-search op-search", type: "search", placeholder: "Search titles…" });
  const list = el("div", { class: "op-list" });
  body.replaceChildren(q, list);
  let t = 0; q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(go, 250); });
  async function go() {
    let req = sb.from("forum_posts").select("id,title,body,category,created_at,hidden,pinned,locked,user_id").order("created_at", { ascending: false }).limit(60);
    if (q.value.trim().length >= 2) req = req.ilike("title", "%" + q.value.trim().replace(/[%_]/g, " ") + "%");
    const { data, error } = await req; if (error) throw error;
    await loadPeople(data.map((p) => p.user_id));
    list.replaceChildren(...data.map((p) => row(
      el("div", { class: "op-meta" }, el("span", { class: "op-pill", text: p.category }), pill(p.pinned, "📌 pinned"), pill(p.locked, "🔒 locked"), pill(p.hidden, "hidden", true), who(p.user_id), el("span", { class: "gm-note", text: ago(p.created_at) })),
      el("h3", { class: "op-title" }, el("a", { href: "/games/forum/?p=" + p.id, target: "_blank", rel: "noopener", text: p.title })),
      el("p", { class: "op-snip", text: snip(p.body) }),
      el("div", { class: "op-acts" },
        btn(p.pinned ? "Unpin" : "Pin", () => act("mod_post", { p_id: p.id, p_pinned: !p.pinned }, p.pinned ? "Unpinned" : "Pinned", go)),
        btn(p.locked ? "Unlock" : "Lock", () => act("mod_post", { p_id: p.id, p_locked: !p.locked }, p.locked ? "Unlocked" : "Locked", go)),
        btn(p.hidden ? "Unhide" : "Hide", () => act("mod_post", { p_id: p.id, p_hidden: !p.hidden }, p.hidden ? "Visible again" : "Hidden", go)),
        btn("Delete", () => sure("Delete “" + p.title + "” and all its comments?") && act("mod_delete", { p_kind: "post", p_id: String(p.id) }, "Deleted", refresh), true)))));
    if (!data.length) list.append(el("p", { class: "gm-empty", text: "No posts." }));
  }
  await go();
}

/* ---------------- comments ---------------- */
async function comments(body) {
  const { data, error } = await sb.from("forum_comments").select("id,post_id,body,created_at,hidden,user_id").order("created_at", { ascending: false }).limit(80);
  if (error) throw error;
  await loadPeople(data.map((c) => c.user_id));
  body.replaceChildren(...data.map((c) => row(
    el("div", { class: "op-meta" }, pill(c.hidden, "hidden", true), who(c.user_id), el("span", { class: "gm-note", text: ago(c.created_at) }),
      el("a", { class: "gm-note", href: "/games/forum/?p=" + c.post_id + "#c" + c.id, target: "_blank", rel: "noopener", text: "on post #" + c.post_id })),
    el("p", { class: "op-snip", text: snip(c.body, 400) }),
    el("div", { class: "op-acts" },
      btn(c.hidden ? "Unhide" : "Hide", () => act("mod_comment", { p_id: c.id, p_hidden: !c.hidden }, c.hidden ? "Visible again" : "Hidden", refresh)),
      btn("Delete", () => sure("Delete this comment?") && act("mod_delete", { p_kind: "comment", p_id: String(c.id) }, "Deleted", refresh), true)))));
  if (!data.length) body.append(el("p", { class: "gm-empty", text: "No comments." }));
}

/* ---------------- reviews ---------------- */
async function reviews(body) {
  const { data, error } = await sb.from("reviews").select("id,game_id,body,created_at,hidden,user_id").order("created_at", { ascending: false }).limit(80);
  if (error) throw error;
  await loadPeople(data.map((r) => r.user_id));
  const g = data.length ? await sb.from("games").select("id,title,console").in("id", [...new Set(data.map((r) => r.game_id))]) : { data: [] };
  const games = new Map((g.data || []).map((x) => [x.id, x]));
  body.replaceChildren(...data.map((r) => { const gm = games.get(r.game_id); return row(
    el("div", { class: "op-meta" }, pill(r.hidden, "hidden", true), who(r.user_id), el("span", { class: "gm-note", text: ago(r.created_at) }),
      el("a", { class: "gm-note", href: "/games/?q=" + encodeURIComponent(gm ? gm.title : ""), target: "_blank", rel: "noopener", text: gm ? gm.console + " · " + gm.title : r.game_id })),
    el("p", { class: "op-snip", text: snip(r.body, 400) }),
    el("div", { class: "op-acts" },
      btn(r.hidden ? "Unhide" : "Hide", () => act("mod_review", { p_id: r.id, p_hidden: !r.hidden }, r.hidden ? "Visible again" : "Hidden", refresh)),
      btn("Delete", () => sure("Delete this review?") && act("mod_delete", { p_kind: "review", p_id: String(r.id) }, "Deleted", refresh), true))); }));
  if (!data.length) body.append(el("p", { class: "gm-empty", text: "No reviews." }));
}

/* ---------------- members ---------------- */
async function members(body) {
  const q = el("input", { class: "gm-search op-search", type: "search", placeholder: "Search by username or Discord name…" });
  const only = el("select", { class: "gm-sel" }, el("option", { value: "", text: "Everyone" }), el("option", { value: "banned", text: "Banned only" }), el("option", { value: "nonmember", text: "Not in the server" }));
  const list = el("div", { class: "op-list" });
  body.replaceChildren(el("div", { class: "fr-tools" }, q, only), list);
  let t = 0; q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(go, 250); }); only.addEventListener("change", go);
  async function go() {
    let req = sb.from("profiles").select("*").order("created_at", { ascending: false }).limit(100);
    const s = q.value.trim().replace(/[%_,()]/g, " ");
    if (s.length >= 2) req = req.or("name.ilike.%" + s + "%,display_name.ilike.%" + s + "%");
    if (only.value === "banned") req = req.eq("banned", true);
    if (only.value === "nonmember") req = req.eq("is_member", false);
    const { data, error } = await req; if (error) throw error;
    for (const p of data) people.set(p.id, p);
    list.replaceChildren(...data.map((p) => { const n = p.display_name || p.name || "member"; return row(
      el("div", { class: "op-meta" }, who(p.id), p.display_name && p.name && p.display_name !== p.name ? el("span", { class: "gm-note", text: "Discord: " + p.name }) : null,
        pill(!p.is_member, "not in server"), p.is_staff ? el("span", { class: "rop-admin", text: "Admin" }) : null, el("span", { class: "gm-note", text: "joined " + shortDate(p.created_at) })),
      p.motto ? el("p", { class: "op-snip", text: "“" + p.motto + "”" }) : null,
      el("div", { class: "op-acts" },
        el("a", { class: "op-btn", href: profileUrl(p.handle), target: "_blank", rel: "noopener", text: "Profile" }),
        p.is_staff !== undefined ? btn(p.is_staff ? "Remove Admin badge" : "Give Admin badge", () => act("mod_staff", { p_handle: p.handle, p_staff: !p.is_staff }, p.is_staff ? "Badge removed" : "Admin badge given", go)) : null,
        btn("Reset name / picture / motto", () => sure("Clear " + n + "'s custom username, picture and motto?") && act("mod_reset_profile", { p_handle: p.handle }, "Profile reset", go)),
        btn("Wipe all their ratings", () => sure("Delete every rating " + n + " has given? This can't be undone.") && act("mod_delete", { p_kind: "rating-wipe", p_id: p.handle }, "Ratings wiped", go), true),
        btn(p.banned ? "Unban" : "Ban", () => (p.banned || sure("Ban " + n + "? They can't rate, review, post or react, and they vanish from public lists.")) && act("mod_ban", { p_handle: p.handle, p_banned: !p.banned }, p.banned ? "Unbanned" : "Banned", () => { counts(); go(); }), !p.banned))); }));
    if (!data.length) list.append(el("p", { class: "gm-empty", text: "Nobody matches." }));
  }
  await go();
}

/* ---------------- member screenshots and clips ---------------- */
const MEDIA_BASE = "https://zjhlhkruqzfendvbglsb.supabase.co/storage/v1/object/public/game-media/";
async function media(body) {
  const { data, error } = await sb.from("game_media").select("id,game_id,kind,path,caption,created_at,hidden,user_id").order("created_at", { ascending: false }).limit(120);
  if (error) throw error;
  await loadPeople(data.map((m) => m.user_id));
  const grid = el("div", { class: "op-media" });
  grid.append(...data.map((m) => el("figure", { class: "op-mtile" + (m.hidden ? " is-hidden" : "") },
    m.kind === "video" ? el("video", { src: MEDIA_BASE + m.path, controls: true, preload: "metadata" }) : el("img", { src: MEDIA_BASE + m.path, alt: m.caption || "", loading: "lazy" }),
    el("figcaption", null,
      el("div", { class: "op-meta" }, pill(m.hidden, "hidden", true), who(m.user_id), el("a", { class: "gm-note", href: "/games/game/?id=" + encodeURIComponent(m.game_id), target: "_blank", rel: "noopener", text: m.game_id })),
      m.caption ? el("p", { class: "op-snip", text: m.caption }) : null,
      el("div", { class: "op-acts" },
        btn(m.hidden ? "Unhide" : "Hide", () => act("mod_media", { p_id: m.id, p_hidden: !m.hidden }, m.hidden ? "Visible again" : "Hidden", refresh)),
        btn("Delete", async () => { if (!sure("Delete this upload and its file?")) return; await sb.storage.from("game-media").remove([m.path]); act("mod_delete", { p_kind: "media", p_id: String(m.id) }, "Deleted", refresh); }, true))))));
  body.replaceChildren(el("p", { class: "gm-note", text: "Newest uploads first. Deleting also frees the storage space." }), grid);
  if (!data.length) body.append(el("p", { class: "gm-empty", text: "No uploads yet." }));
}

/* ---------------- member-added games ---------------- */
async function games(body) {
  const { data, error } = await sb.from("games").select("id,title,console,approved,added_by").not("added_by", "is", null).order("approved").order("title").limit(200);
  if (error) throw error;
  await loadPeople(data.map((g) => g.added_by));
  body.replaceChildren(el("p", { class: "gm-note", text: "Games members added to the list. Hide one to take it off the public list without deleting its ratings." }),
    ...data.map((g) => row(
      el("div", { class: "op-meta" }, consoleChip(g.console), el("b", { text: g.title }), pill(!g.approved, "hidden", true), el("span", { class: "gm-note", text: "added by" }), who(g.added_by)),
      el("div", { class: "op-acts" },
        btn(g.approved ? "Hide" : "Show", () => act("mod_game", { p_id: g.id, p_approved: !g.approved }, g.approved ? "Hidden" : "Visible", refresh)),
        btn("Delete", () => sure("Delete “" + g.title + "” and every rating and review on it?") && act("mod_delete", { p_kind: "game", p_id: g.id }, "Deleted", refresh), true)))));
  if (!data.length) body.append(el("p", { class: "gm-empty", text: "No member-added games." }));
}

/* ---------------- start ---------------- */
subnav($("rop-tabs"), "");
onAuth(() => { authPill($("gm-auth"), { okTail: "." }); gate(); });
