/* pages/games.game.js: one game's info card (/games/game/?id=<game id>). Prefix gi-.
 * Facts come from assets/data/gameinfo/<shard>.json (built by tools/rop-enrich from Wikidata, Wikipedia and the
 * emulator compatibility lists), with the owner's corrections from game_info_fix laid on top. Ratings, reviews,
 * hearts and member screenshots/videos come live from the database.
 */
import { chipRow, sb, $, el, me, onAuth, authPill, subnav, signIn, avatar, nameLink, adminTag, ago, share, sfx, toast, INVITE, consoleChip, platformLink, compareUrl, backlogPicker, RA_PLATFORMS, raSearchUrl, BACKLOG, platformName, reactBar, myReactions, scoreCols, guestRatings, guestRate, VISITOR_NOTE , reportBtn , boxArt , shareUrlFor , statsChanged , memberCover, forgetCover, hasAutoArt } from "./games.common.js?v=18";

const id = (new URLSearchParams(location.search).get("id") || "").slice(0, 160);
const root = $("gi-root");
const SHAPES = ["△", "○", "✕", "□", "△"];
const EMU = { PS1: "DuckStation", PS2: "PCSX2", PSP: "PPSSPP", PS3: "RPCS3", Vita: "Vita3K", PS4: "shadPS4", PS5: "AnyPS5" };
const EMU_SRC = { DuckStation: "https://github.com/stenzek/duckstation", PCSX2: "https://pcsx2.net/compat/", RPCS3: "https://rpcs3.net/compatibility", Vita3K: "https://vita3k.org/compatibility.html", shadPS4: "https://github.com/shadps4-emu/shadps4-game-compatibility" };
const TIERS = ["Nothing", "Boots", "Menus", "In-game", "Playable", "Perfect"];
const fnv = (s) => { let h = 0x811c9dc5; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
const shardOf = (s) => (fnv(s) & 0xfff).toString(16).padStart(3, "0");
const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");
let game = null, info = {}, myStars = null;

async function staticInfo() {
  try { const r = await fetch("/assets/data/gameinfo/" + shardOf(id) + ".json"); if (!r.ok) return {}; const j = await r.json(); return j[id] || {}; } catch (e) { return {}; }
}

/* ---------------- render ---------------- */
async function render() {
  authPill($("gm-auth"), { okTail: ", you can rate and upload." });
  if (!id) { root.replaceChildren(el("p", { class: "gm-empty", text: "No game picked. " }, el("a", { href: "/games/", text: "Search Rate-O-Pedia" }))); return; }
  const [g, base, fix] = await Promise.all([
    scoreCols().then((c) => sb.from("game_scores").select(c).eq("id", id).maybeSingle()),
    staticInfo(),
    sb.from("game_info_fix").select("data").eq("game_id", id).maybeSingle()]);
  game = g.data;
  if (!game) {   // merged duplicate? follow it to the copy that was kept
    const a = await sb.from("game_aliases").select("new_id").eq("old_id", id).maybeSingle();
    if (a.data && a.data.new_id) { location.replace("/games/game/?id=" + encodeURIComponent(a.data.new_id)); return; }
  }
  if (!game) { root.replaceChildren(el("section", { class: "pf-card pf-notice" }, el("h2", { text: "Game not found" }), el("a", { class: "linkbtn", href: "/games/", text: "← Back to Rate-O-Pedia" }))); return; }
  info = Object.assign({}, base, (fix.data && fix.data.data) || {});
  const title = info.t || game.title, sub = info.st || "";
  document.title = title + (sub ? " — " + sub : "") + " · Rate-O-Pedia";
  let shareHref = "/games/game/?id=" + encodeURIComponent(id);
  shareUrlFor(id).then((u) => { shareHref = u; });

  myStars = null;
  if (me.user && me.member) { const r = await sb.from("ratings").select("stars").eq("game_id", id).maybeSingle(); myStars = r.data ? r.data.stars : null; }
  else if (game.open_votes !== undefined) { const r = await guestRatings([id]); myStars = r.has(id) ? r.get(id) : null; }

  const facts = el("dl", { class: "gi-facts" });
  const fact = (k, v) => { if (v == null || v === "" || (Array.isArray(v) && !v.length)) return; facts.append(el("dt", { text: k }), el("dd", null, ...(Array.isArray(v) ? [v.join(", ")] : [String(v)]))); };
  fact("Released", info.y);
  if (info.pl && info.pl.length) facts.append(el("dt", { text: "Platforms" }), el("dd", { class: "gi-plats" }, ...info.pl.map((p) => el("span", { class: "gi-plat", text: p }))));
  else fact("Platforms", game.console);
  fact("Publisher", info.pub);
  fact("Developer", info.dev);
  fact("Genre", Array.isArray(info.gn) ? info.gn.filter((x) => !/^video game (with|featuring|based on)|^LGBT/i.test(x)).map((x) => x.replace(/ video game$/i, "")) : info.gn);
  if (!facts.children.length) facts.append(el("dt", { text: "Details" }), el("dd", { class: "gm-note", text: "Not filled in yet." }));

  const desc = el("section", { class: "gi-desc" },
    info.d ? el("p", { text: info.d }) : el("p", { class: "gm-note", text: "No description yet." }),
    info.w ? el("p", { class: "gi-src" }, "Description from ", el("a", { href: "https://en.wikipedia.org/wiki/" + encodeURIComponent(info.w.replace(/ /g, "_")), target: "_blank", rel: "noopener", text: "Wikipedia" }), " (CC BY-SA 4.0).") : null);

  const card = el("article", { class: "gi-card", "data-c": game.console },
    el("header", { class: "gi-head" },
      headArt(title),
      el("div", { class: "gi-headtext" },
        el("div", { class: "gi-chips" }, platformLink(game.console), info.y ? el("span", { class: "gi-year", text: String(info.y) }) : null),
        el("h1", { class: "gi-title", text: title }),
        sub ? el("p", { class: "gi-sub", text: sub }) : null),
      el("div", { class: "gi-headbtns" }, heartBtn(),
        el("a", { class: "linkbtn", href: compareUrl(id), text: "Compare" }),
        el("button", { class: "linkbtn", type: "button", text: "Share", onclick: () => share(shareHref, title) }))),
    el("div", { class: "gi-grid" },
      el("div", { class: "gi-main" }, desc, facts),
      el("aside", { class: "gi-side" }, scoreBox(), playBox(title), compatBox())),
    reviewBox(),
    mediaBox(),
    me.admin ? el("button", { class: "linkbtn gi-fixbtn", type: "button", text: "Correct this card (owner)", onclick: fixer }) : null);
  root.replaceChildren(el("a", { class: "linkbtn fr-back", href: "/games/?q=" + encodeURIComponent(game.title), text: "← Rate-O-Pedia" }), card);
}

/* ---------------- score + rating ---------------- */
function scoreBox() {
  const box = el("section", { class: "gi-box gi-score" });
  const avg = game.votes > 0 ? Number(game.average).toFixed(1) : "–";
  const open = game.open_votes !== undefined;
  if (!open) box.append(el("h2", { class: "gi-h", text: "Rate-O-Pedia score" }),
    el("p", { class: "gi-big" }, el("b", { text: avg }), el("span", { text: " / 5" })),
    el("p", { class: "gm-note", text: game.votes ? plural(game.votes, "vote") : "Not rated yet" }));
  else {
    const oavg = game.open_votes > 0 ? Number(game.open_average).toFixed(1) : "–";
    const half = (cls, icon, title, val, note, tip) => el("div", { class: "gi-sc gi-sc--" + cls, title: tip },
      el("h2", { class: "gi-h" }, el("span", { "aria-hidden": "true", text: icon + " " }), title),
      el("p", { class: "gi-big" }, el("b", { text: val }), el("span", { text: " / 5" })), el("p", { class: "gm-note", text: note }));
    box.append(el("div", { class: "gi-scores" },
      half("v", "✔", "Verified Review Score", avg, game.votes ? plural(game.votes, "member vote") : "No member votes yet", "Discord members only"),
      half("o", "🌐", "Open-Vote Review Score", oavg, game.open_votes ? plural(game.open_votes, "vote") + " · " + plural(game.visitor_votes || 0, "visitor") : "No votes yet", "Members and visitors together")));
  }
  const row = el("div", { class: "gm-rate" });
  if (me.user && me.member) row.append(chipRow(myStars, (v) => rate(v), "Your rating"));
  else if (open) {
    row.append(chipRow(myStars, (v) => rateGuest(v), "Your visitor rating"));
    box.append(row, el("p", { class: "gm-note gi-guestnote" }, VISITOR_NOTE + " ",
      me.user ? el("a", { href: INVITE, target: "_blank", rel: "noopener", text: "Join the Discord" }) : el("button", { class: "linkbtn", type: "button", onclick: signIn, text: "Sign in" })));
    if (me.admin && game.visitor_votes) box.append(clearGuests());
    return box;
  }
  else if (!me.user) row.append(el("button", { class: "linkbtn", type: "button", onclick: signIn, text: "Sign in to rate" }));
  else row.append(el("a", { class: "linkbtn", href: INVITE, target: "_blank", rel: "noopener", text: "Join the Discord to rate" }));
  box.append(row);
  if (me.admin && game.visitor_votes) box.append(clearGuests());
  return box;
}
async function rate(stars) {
  const res = stars == null ? await sb.from("ratings").delete().eq("user_id", me.user.id).eq("game_id", id)
    : await sb.from("ratings").upsert({ user_id: me.user.id, game_id: id, stars, updated_at: new Date().toISOString() });
  if (res.error) { toast("That vote didn't save: " + res.error.message, "err"); return; }
  sfx("success"); statsChanged(); render();
}

async function rateGuest(stars) {
  try { await guestRate(id, stars); } catch (e) { toast("That vote didn't save: " + e.message, "err"); return; }
  sfx("success"); render();
}
/* owner: wipe this game's visitor votes (if a game gets brigaded) */
function clearGuests() {
  return el("button", { class: "linkbtn gi-fixbtn", type: "button", text: "Clear " + plural(game.visitor_votes, "visitor vote") + " (owner)", onclick: async (e) => {
    if (!confirm("Remove every visitor vote on this game? Member votes stay.")) return;
    const { data, error } = await sb.rpc("mod_clear_guest_ratings", { p_game: id });
    if (error) { toast("Couldn't clear them: " + error.message, "err"); return; }
    toast("Removed " + plural(data || 0, "visitor vote") + "."); render();
  } });
}

/* ---------------- your backlog, how many members have it listed, RetroAchievements ---------------- */
function playBox(title) {
  const count = el("p", { class: "gi-blcount" });
  const drawCount = (c) => {
    const parts = BACKLOG.map(([k, l, i]) => c && c[k] ? i + " " + c[k] + " " + l.toLowerCase() : null).filter(Boolean);
    count.textContent = parts.length ? parts.join(" · ") : "Nobody has this on their backlog yet.";
  };
  let counts = null;
  sb.from("game_backlog_counts").select("*").eq("game_id", id).maybeSingle().then(({ data, error }) => { if (error) { count.remove(); return; } counts = data || {}; drawCount(counts); }, () => {});
  const picker = backlogPicker(id, (now, was) => {
    if (!counts) return;
    if (was) counts[was] = Math.max(0, (counts[was] || 0) - 1);
    if (now) counts[now] = (counts[now] || 0) + 1;
    drawCount(counts);
  });
  const links = el("div", { class: "gi-links" },
    RA_PLATFORMS.has(game.console) ? el("a", { class: "gi-ra", href: raSearchUrl(title), target: "_blank", rel: "noopener", title: "Look this game up on RetroAchievements" }, el("span", { "aria-hidden": "true", text: "🏆" }), "RetroAchievements") : null,
    el("a", { class: "linkbtn", href: "/games/platform/?p=" + encodeURIComponent(game.console), text: platformName(game.console) + " hub →" }));
  return el("section", { class: "gi-box gi-bl" }, el("h2", { class: "gi-h", text: "Backlog" }), picker, count, links);
}

/* ---------------- emulator playability ---------------- */
function compatBox() {
  const c = info.c, emu = (c && c.e) || EMU[game.console];
  if (!c && !EMU[game.console]) return null;   // no emulator list for this platform: leave the box out
  const box = el("section", { class: "gi-box gi-compat" }, el("h2", { class: "gi-h", text: "Emulator playability" }));
  if (!c) {
    box.append(el("p", { class: "gm-note", text: game.console === "PSP" ? "PPSSPP doesn't publish a compatibility list, so there's no rating for this one yet." : emu + " hasn't reported on this game yet." }));
    return box;
  }
  const meter = el("div", { class: "gi-meter", role: "meter", "aria-valuemin": "0", "aria-valuemax": "5", "aria-valuenow": String(c.s), "aria-label": "Playability " + c.s + " of 5" });
  for (let i = 1; i <= 5; i++) meter.append(el("span", { class: "gi-meter__s" + (i <= c.s ? " is-on" : "") }));
  box.append(el("p", { class: "gi-tier gi-tier--" + c.s, text: c.l || TIERS[c.s] }), meter,
    el("p", { class: "gm-note" }, "Per ", EMU_SRC[c.e] ? el("a", { href: EMU_SRC[c.e], target: "_blank", rel: "noopener", text: c.e }) : c.e, "'s compatibility list. AnyPS uses " + EMU[game.console] + " for " + game.console + "."));
  return box;
}

/* ---------------- review snippet ---------------- */
function reviewBox() {
  const box = el("section", { class: "gi-box gi-reviews" }, el("h2", { class: "gi-h", text: "From the reviews" }), el("p", { class: "gm-empty", text: "Loading…" }));
  sb.from("public_reviews").select("*").eq("game_id", id).order("created_at", { ascending: false }).limit(20).then(async ({ data }) => {
    box.lastChild.remove();
    const rows = data || [];
    if (!rows.length) { box.append(el("p", { class: "gm-note", text: "No reviews yet." }), el("a", { class: "linkbtn", href: "/games/?q=" + encodeURIComponent(game.title), text: "Write the first one →" })); return; }
    // the snippet: the highest-scored review, newest first among ties
    const r = rows.slice().sort((a, b) => (b.stars ?? -1) - (a.stars ?? -1))[0];
    const body = r.body.length > 280 ? r.body.slice(0, 277).replace(/\s+\S*$/, "") + "…" : r.body;
    box.append(el("blockquote", { class: "gm-review gi-quote" }, el("p", { text: "“" + body + "”" }),
      el("footer", null, avatar(r.avatar, r.name, 20), nameLink(r.handle, r.name), r.is_staff ? adminTag() : null, r.stars != null ? "  ·  " + r.stars + " / 5" : null),
      reactBar(r, (await myReactions([r.id])).get(r.id))),
      el("a", { class: "linkbtn", href: "/games/?q=" + encodeURIComponent(game.title), text: "Read all " + plural(rows.length, "review") + " →" }));
  });
  return box;
}

/* ---------------- hearts ---------------- */
function heartBtn() {
  const b = el("button", { class: "gi-heart", type: "button", "aria-pressed": "false", title: "Add to your hearted games" }, el("span", { class: "gi-heart__i", "aria-hidden": "true", text: "♡" }), el("span", { class: "gi-heart__n", text: "" }));
  let on = false, n = 0;
  const draw = () => { b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); b.firstChild.textContent = on ? "♥" : "♡"; b.lastChild.textContent = n ? String(n) : ""; b.setAttribute("aria-label", (on ? "Hearted" : "Heart this game") + (n ? ", " + n : "")); };
  Promise.all([sb.from("game_heart_counts").select("hearts").eq("game_id", id).maybeSingle(), me.user ? sb.from("game_hearts").select("game_id").eq("game_id", id).maybeSingle() : { data: null }]).then(([c, mine]) => {
    if (c.error) { b.hidden = true; return; }
    n = c.data ? c.data.hearts : 0; on = !!mine.data; draw();
  });
  b.addEventListener("click", async () => {
    if (!me.user) { signIn(); return; }
    on = !on; n += on ? 1 : -1; draw(); sfx(on ? "success" : "tap");
    if (on) b.classList.add("gi-heart--pop"), setTimeout(() => b.classList.remove("gi-heart--pop"), 500);
    const res = on ? await sb.from("game_hearts").insert({ user_id: me.user.id, game_id: id }) : await sb.from("game_hearts").delete().eq("user_id", me.user.id).eq("game_id", id);
    if (res.error) { on = !on; n += on ? 1 : -1; draw(); toast("Couldn't save that: " + res.error.message, "err"); }
    else if (on) toast("Added to your hearted games", "ok");
  });
  draw();
  return b;
}

/* ---------------- cover: automatic sources first, else a member's upload (round 24) ---------------- */
function headArt(title) {
  if (hasAutoArt(info)) {
    return el("div", { class: "gi-art" }, boxArt(info, title),
      !info.g && !info.a && !info.sa && info.ra ? el("a", { class: "gi-credit", href: "https://rawg.io/", target: "_blank", rel: "noopener", text: "Picture: RAWG" }) : null);
  }
  const box = el("div", { class: "gi-art gi-art--member" });
  memberCover(id).then((c) => {
    if (c) {
      const mine = me.profile && me.profile.handle === c.handle;
      box.replaceChildren(boxArt(c, title), el("span", { class: "gi-credit" }, "Cover by ", nameLink(c.handle, c.by)),
        mine || me.admin ? el("button", { class: "linkbtn gi-credit", type: "button", text: "Remove cover", onclick: () => removeCover(c) }) : reportBtn("media", c.id));
    } else if (me.member && me.ready) {
      box.classList.add("gi-art--add");
      box.replaceChildren(el("button", { class: "gi-addcover", type: "button", onclick: () => pickCover(box, title) },
        el("span", { "aria-hidden": "true", text: "＋" }), el("span", { text: "Add the cover" })));
    }
  });
  return box;
}
async function removeCover(c) {
  if (!confirm("Remove this cover?")) return;
  const row = await sb.from("game_media").select("path").eq("id", c.id).maybeSingle();
  if (row.data) await sb.storage.from("game-media").remove([row.data.path]);
  const { error } = await sb.from("game_media").delete().eq("id", c.id);
  if (error) { toast(error.message, "err"); return; }
  forgetCover(id); render();
}
function pickCover(box, title) {
  const f = el("input", { type: "file", accept: "image/png,image/jpeg,image/webp", hidden: true });
  f.addEventListener("change", async () => {
    const file = f.files && f.files[0]; if (!file) return;
    try {
      const bmp = await createImageBitmap(file);
      if (bmp.width < 120 || bmp.height < 120) throw new Error("That picture is too small for a cover.");
      const s = Math.min(1, 1000 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas"); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, "image/webp", 0.9));
      toast("Uploading cover…", "info");
      const p = me.user.id + "/cover-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7) + ".webp";
      const up = await sb.storage.from("game-media").upload(p, blob, { contentType: "image/webp", cacheControl: "31536000" });
      if (up.error) throw up.error;
      const { error } = await sb.from("game_media").insert({ game_id: id, user_id: me.user.id, kind: "cover", path: p, caption: null });
      if (error) {
        await sb.storage.from("game-media").remove([p]);
        throw new Error(/check constraint|kind/i.test(error.message) ? "Cover uploads switch on after the owner's database update." : error.message.replace(/new row violates row-level security policy.*/, "Upload limit reached (20 a day)."));
      }
      sfx("success"); toast("Cover added. Thanks!", "ok"); forgetCover(id); render();
    } catch (e) { toast(e.message || String(e), "err"); sfx("error"); }
  });
  box.append(f); f.click();
}

/* ---------------- member screenshots and clips ---------------- */
function mediaBox() {
  const box = el("section", { class: "gi-box gi-media" }, el("h2", { class: "gi-h", text: "Screenshots & clips" }));
  const grid = el("div", { class: "gi-gallery" });
  box.append(grid);
  load();
  async function load() {
    const { data, error } = await sb.from("public_game_media").select("*").eq("game_id", id).neq("kind", "cover").order("created_at", { ascending: false }).limit(60);
    if (error) { grid.replaceChildren(el("p", { class: "gm-note", text: "Uploads switch on once the site's database update goes in." })); return; }
    grid.replaceChildren(...(data || []).map(tile));
    if (!(data || []).length) grid.append(el("p", { class: "gm-note", text: "No screenshots yet." }));
  }
  function tile(m) {
    const media = m.kind === "video"
      ? el("video", { src: m.url, muted: true, playsinline: true, preload: "metadata", loop: true, onmouseenter: (e) => e.target.play().catch(() => {}), onmouseleave: (e) => e.target.pause() })
      : el("img", { src: m.url, alt: m.caption || "Screenshot of " + game.title, loading: "lazy" });
    const mine = me.profile && me.profile.handle === m.handle;
    return el("figure", { class: "gi-tile" + (m.kind === "video" ? " gi-tile--v" : "") },
      el("button", { class: "gi-tile__open", type: "button", "aria-label": "Open " + (m.kind === "video" ? "clip" : "screenshot"), onclick: () => lightbox(m) }, media),
      el("figcaption", null, m.caption ? el("span", { text: m.caption }) : null, el("span", { class: "gm-note" }, "by ", nameLink(m.handle, m.author), m.is_staff ? adminTag() : null),
        mine ? el("button", { class: "linkbtn gm-report", type: "button", text: "Delete", onclick: async () => {
          if (!confirm("Delete this upload?")) return;
          const row = await sb.from("game_media").select("path").eq("id", m.id).maybeSingle();
          if (row.data) await sb.storage.from("game-media").remove([row.data.path]);
          const { error } = await sb.from("game_media").delete().eq("id", m.id);
          if (error) toast(error.message, "err"); else load();
        } }) : reportBtn("media", m.id)));
  }
  // uploader
  if (!me.user) box.append(el("p", { class: "fr-gate" }, el("button", { class: "linkbtn", type: "button", onclick: signIn, text: "Sign in" }), " to upload screenshots or clips."));
  else if (!me.member) box.append(el("p", { class: "fr-gate" }, el("a", { class: "linkbtn", href: INVITE, target: "_blank", rel: "noopener", text: "Join the Discord" }), " to upload screenshots or clips."));
  else if (me.ready) {
    const note = el("p", { class: "gm-note", role: "status" });
    const cap = el("input", { class: "gm-search gi-cap", maxlength: "140", placeholder: "Caption (optional)", "aria-label": "Caption" });
    const file = el("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm", hidden: true, onchange: () => upload(file.files && file.files[0]) });
    box.append(el("div", { class: "gi-up" }, cap, el("button", { class: "btn gm-btn", type: "button", text: "Upload screenshot or clip", onclick: () => file.click() }), file),
      el("p", { class: "gm-note", text: "Images or videos up to 60 seconds and 25 MB. Keep it to this game; the owner removes anything off-topic." }), note);
    async function upload(f) {
      if (!f) return;
      const isVid = f.type.startsWith("video/");
      try {
        let blob = f, ext = (f.name.split(".").pop() || "").toLowerCase(), type = f.type;
        if (isVid) {
          if (f.size > 25 * 1024 * 1024) throw new Error("That clip is over 25 MB.");
          const dur = await new Promise((res) => { const v = document.createElement("video"); v.preload = "metadata"; v.onloadedmetadata = () => { res(v.duration); URL.revokeObjectURL(v.src); }; v.onerror = () => res(0); v.src = URL.createObjectURL(f); });
          if (dur > 61) throw new Error("Clips can be up to 60 seconds; that one is " + Math.round(dur) + ".");
          ext = type === "video/webm" ? "webm" : "mp4";
        } else if (type !== "image/gif") {   // shrink stills to 1920px webp; keep GIFs as they are
          const bmp = await createImageBitmap(f); const s = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
          const c = document.createElement("canvas"); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
          c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
          blob = await new Promise((r) => c.toBlob(r, "image/webp", 0.88)); type = "image/webp"; ext = "webp";
        } else if (f.size > 25 * 1024 * 1024) throw new Error("That GIF is over 25 MB.");
        note.textContent = "Uploading…";
        const p = me.user.id + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 7) + "." + ext;
        const up = await sb.storage.from("game-media").upload(p, blob, { contentType: type, cacheControl: "31536000" });
        if (up.error) throw up.error;
        const { error } = await sb.from("game_media").insert({ game_id: id, user_id: me.user.id, kind: isVid ? "video" : "image", path: p, caption: cap.value.trim() || null });
        if (error) { await sb.storage.from("game-media").remove([p]); throw error; }
        note.textContent = "Uploaded. Thanks!"; cap.value = ""; sfx("success"); load();
      } catch (e) { note.textContent = (e.message || String(e)).replace(/new row violates row-level security policy.*/, "Upload limit reached (20 a day), or your membership needs re-checking."); sfx("error"); }
      file.value = "";
    }
  }
  return box;
}
function lightbox(m) {
  const d = el("dialog", { class: "sx-modal gi-lb", "aria-label": m.caption || "Media" },
    el("button", { class: "sx-x pf-x gi-lb__x", type: "button", "aria-label": "Close", text: "✕", onclick: () => d.close() }),
    m.kind === "video" ? el("video", { src: m.url, controls: true, autoplay: true, playsinline: true }) : el("img", { src: m.url, alt: m.caption || "" }),
    m.caption ? el("p", { class: "gm-note", text: m.caption }) : null);
  d.addEventListener("close", () => d.remove());
  d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
  document.body.append(d); d.showModal();
}

/* ---------------- owner corrections ---------------- */
function fixer() {
  const f = {};
  const field = (k, label, val, area) => { f[k] = el(area ? "textarea" : "input", { class: area ? "gm-ta" : "gm-search pf-in", rows: area ? "5" : null, "aria-label": label }); f[k].value = val == null ? "" : val; return [el("label", { class: "pf-lab", text: label }), f[k]]; };
  const list = (v) => (Array.isArray(v) ? v.join(", ") : v || "");
  const note = el("p", { class: "gm-note", role: "status" });
  const d = el("dialog", { class: "sx-modal pf-dlg" },
    el("div", { class: "pf-dlg__head" }, el("h2", { text: "Correct this card" }), el("button", { class: "sx-x pf-x", type: "button", "aria-label": "Close", text: "✕", onclick: () => d.close() })),
    ...field("t", "Title", info.t || game.title), ...field("st", "Subtitle", info.st), ...field("y", "Year", info.y),
    ...field("pl", "Platforms (comma separated)", list(info.pl)), ...field("pub", "Publisher(s)", list(info.pub)), ...field("dev", "Developer(s)", list(info.dev)),
    ...field("gn", "Genre(s)", list(info.gn)), ...field("d", "Description", info.d, true), ...field("w", "Wikipedia article title (for the credit link)", info.w),
    el("div", { class: "pf-dlg__foot" },
      el("button", { class: "btn gm-btn", type: "button", text: "Save", onclick: async () => {
        const split = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);
        const data = { t: f.t.value.trim(), st: f.st.value.trim(), y: +f.y.value || null, pl: split(f.pl.value), pub: split(f.pub.value), dev: split(f.dev.value), gn: split(f.gn.value), d: f.d.value.trim(), w: f.w.value.trim() };
        for (const k of Object.keys(data)) if (data[k] === "" || data[k] == null || (Array.isArray(data[k]) && !data[k].length)) delete data[k];
        const { error } = await sb.rpc("mod_game_info", { p_game: id, p_data: data });
        if (error) { note.textContent = error.message; return; }
        toast("Card updated", "ok"); d.close(); render();
      } }),
      el("button", { class: "linkbtn", type: "button", text: "Reset to the automatic info", onclick: async () => {
        const { error } = await sb.rpc("mod_game_info", { p_game: id, p_data: {} });
        if (error) { note.textContent = error.message; return; }
        toast("Back to automatic", "ok"); d.close(); render();
      } }), note));
  d.addEventListener("close", () => d.remove());
  document.body.append(d); d.showModal();
}

subnav($("rop-tabs"), "ratings");
onAuth(render);
