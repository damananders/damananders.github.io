/* pages/games.profile.js: member profiles (/games/profile/?u=<handle>). Prefix pf-.
 * Anyone can view a profile. Its owner can customise nearly all of it: username, picture, motto (+ colour), a banner
 * (preset or uploaded), accent colour, avatar frame, name style, pronouns, a status, "now playing", an About box,
 * gamer tags, a 6-game showcase, which sections show, a pinned badge and whether the guestbook is open.
 * Saving goes through the database functions update_my_profile and update_my_profile_extras, which check every field.
 * Badges and the level are worked out here from the public counts, so nobody can fake them.
 */
import { sb, $, el, me, onAuth, loadMe, authPill, subnav, signIn, avatar, colorClass, COLORS, memberSince, ago, profileUrl, ownerTag, adminTag, share, sfx, toast, SB_URL,
  consoleChip, platformLink, gameUrl, compareUrl, ACCENTS, accentOf, BACKLOG, BACKLOG_LABEL, raUserUrl, FAMILY, familyOf, platformName, INVITE, titleSearch , reportBtn , hasSearchKey , statsChanged } from "./games.common.js?v=16";

const params = new URLSearchParams(location.search);
const wanted = (params.get("u") || "").slice(0, 40);
const root = $("pf-root");
const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");
const fmt = (n) => Number(n || 0).toLocaleString();

/* ---------------- customisation choices (the database accepts exactly these keys) ---------------- */
const BANNERS = [
  ["maroon", "Maroon"], ["sunset", "Sunset"], ["ocean", "Ocean"], ["forest", "Forest"], ["grape", "Grape"], ["ember", "Ember"],
  ["midnight", "Midnight"], ["aurora", "Aurora"], ["synthwave", "Synthwave"], ["grid", "Retro grid"], ["stars", "Starfield"],
  ["circuit", "Circuit"], ["carbon", "Carbon"], ["candy", "Candy"], ["gold", "Gold rush"], ["mono", "Mono"],
];
const FRAMES = [["none", "None"], ["ring", "Ring"], ["double", "Double"], ["glow", "Glow"], ["gold", "Gold"], ["neon", "Neon"],
  ["rainbow", "Rainbow"], ["pixel", "Pixel"], ["flame", "Flame"], ["ice", "Ice"], ["chip", "Chip"]];
const NAME_FX = [["plain", "Plain"], ["glow", "Glow"], ["shine", "Shine"], ["rainbow", "Rainbow"], ["pixel", "Pixel"], ["outline", "Outline"]];
/* exclusives: Admins (Discord Admin role) get the adm- set, the site owner gets both sets (the database checks) */
const X_ADMIN = { banners: [["adm-crimson", "Crimson ops"], ["adm-alert", "Red alert"], ["adm-shield", "Shield wall"]],
  frames: [["adm-shield", "Shield"], ["adm-pulse", "Pulse"]], fx: [["adm-alert", "Alert"], ["adm-stamp", "Stamped"]], page: [["adm-scan", "Scanlines"]] };
const X_OWNER = { banners: [["own-throne", "Throne room"], ["own-cosmos", "Cosmos"], ["own-royale", "Royale"]],
  frames: [["own-crown", "Crown"], ["own-halo", "Halo"]], fx: [["own-royal", "Royal"], ["own-holo", "Holo"]], page: [["own-embers", "Embers"], ["own-stars", "Starfall"], ["own-aurora", "Aurora"]] };
const ALL_BANNERS = [...BANNERS, ...X_ADMIN.banners, ...X_OWNER.banners];
const ALL_FRAMES = [...FRAMES, ...X_ADMIN.frames, ...X_OWNER.frames];
const ALL_FX = [...NAME_FX, ...X_ADMIN.fx, ...X_OWNER.fx];
const PAGE_FX = [["none", "None"], ...X_ADMIN.page, ...X_OWNER.page];
const ACCENT_NAMES = { maroon: "Maroon", white: "White", gray: "Gray", red: "Red", orange: "Orange", gold: "Gold", yellow: "Yellow", green: "Green", teal: "Teal", blue: "Blue", purple: "Purple", pink: "Pink" };
const STATUS_EMOJI = ["🎮", "🔥", "🏆", "😴", "💀", "🎧", "🍿", "🧠", "😤", "🥳", "📺", "🛠️", "🌙", "☕", "❤️", "👾"];
const SECTIONS = [["now", "Now playing"], ["stats", "Stats"], ["links", "Gamer tags"], ["showcase", "Showcase"], ["badges", "Badges"],
  ["backlog", "Backlog (also hides it from everyone)"], ["hearts", "Hearted games"], ["wall", "Guestbook (also hides it from everyone)"], ["reviews", "Recent reviews"], ["posts", "Recent forum posts"]];
/* gamer tags: [key, label, link builder or null (copy instead)] */
const at = (v) => String(v).replace(/^@/, "");
const LINKS = [
  ["twitch", "Twitch", (v) => "https://www.twitch.tv/" + encodeURIComponent(at(v))],
  ["youtube", "YouTube", (v) => "https://www.youtube.com/@" + encodeURIComponent(at(v))],
  ["steam", "Steam", (v) => /^\d{17}$/.test(v) ? "https://steamcommunity.com/profiles/" + v : "https://steamcommunity.com/id/" + encodeURIComponent(v)],
  ["psn", "PSN", (v) => "https://psnprofiles.com/" + encodeURIComponent(v)],
  ["xbox", "Xbox", (v) => "https://account.xbox.com/en-us/profile?gamertag=" + encodeURIComponent(v)],
  ["switch", "Switch friend code", null],
  ["ra", "RetroAchievements", (v) => raUserUrl(v)],
  ["epic", "Epic Games", null],
  ["battlenet", "Battle.net", null],
  ["tiktok", "TikTok", (v) => "https://www.tiktok.com/@" + encodeURIComponent(at(v))],
  ["x", "X", (v) => "https://x.com/" + encodeURIComponent(at(v))],
  ["bluesky", "Bluesky", (v) => "https://bsky.app/profile/" + encodeURIComponent(at(v))],
  ["instagram", "Instagram", (v) => "https://www.instagram.com/" + encodeURIComponent(at(v))],
];
const BANNER_OK = SB_URL + "/storage/v1/object/public/banners/";

/* ---------------- level: experience from everything a member does ---------------- */
const TITLES = ["Newcomer", "Player", "Challenger", "Regular", "Veteran", "Elite", "Master", "Grandmaster", "Legend", "Mythic"];
function levelOf(p) {
  const bl = p.backlog || {};
  const xp = (p.votes || 0) * 10 + (p.reviews || 0) * 40 + (p.posts || 0) * 25 + (p.comments || 0) * 8 + (p.hearts || 0) * 3
    + (p.helpful_received || 0) * 15 + (p.trophies || 0) * 20 + (bl.beaten || 0) * 12 + (p.wall_notes || 0) * 2;
  const lvl = Math.floor(Math.sqrt(xp / 60)) + 1;
  const from = 60 * (lvl - 1) ** 2, to = 60 * lvl ** 2;
  return { xp, lvl, title: TITLES[Math.min(TITLES.length - 1, Math.floor((lvl - 1) / 4))], pct: Math.round(((xp - from) / (to - from)) * 100), next: to - xp };
}

/* ---------------- badges: [key, icon, name, how to earn, test] ---------------- */
const BADGES = [
  ["owner", "👑", "Site Owner", "runs Rate-O-Pedia", (p) => p.is_owner],
  ["admin", "🛡️", "Admin", "an admin on the Discord server", (p) => p.is_staff],
  ["podium", "🥇", "Podium", "top 3 on the voter leaderboard", (p, x) => x.rank > 0 && x.rank <= 3],
  ["founder", "🌱", "Founding Member", "joined in Rate-O-Pedia's first year", (p) => p.member_since && new Date(p.member_since) < new Date("2027-01-01")],
  ["veteran", "🎖️", "Veteran", "a member for over a year", (p) => p.member_since && Date.now() - new Date(p.member_since) > 365 * 864e5],
  ["first-vote", "🗳️", "First Vote", "rated a game", (p) => p.votes >= 1],
  ["rater", "📊", "Rater", "10 ratings", (p) => p.votes >= 10],
  ["critic", "🎯", "Critic", "50 ratings", (p) => p.votes >= 50],
  ["centurion", "💯", "Centurion", "100 ratings", (p) => p.votes >= 100],
  ["archivist", "📚", "Archivist", "500 ratings", (p) => p.votes >= 500],
  ["legend", "🌟", "Living Legend", "1,000 ratings", (p) => p.votes >= 1000],
  ["wordsmith", "✍️", "Wordsmith", "wrote a review", (p) => p.reviews >= 1],
  ["reviewer", "📝", "Reviewer", "10 reviews", (p) => p.reviews >= 10],
  ["columnist", "📰", "Columnist", "50 reviews", (p) => p.reviews >= 50],
  ["trusted", "🤝", "Trusted Voice", "10 helpful votes on their reviews", (p) => p.helpful_received >= 10],
  ["crowd", "🎭", "Crowd Pleaser", "50 reactions on their reviews", (p) => p.reactions_received >= 50],
  ["speaker", "📣", "Speaker", "started a forum thread", (p) => p.posts >= 1],
  ["regular", "🍻", "Regular", "25 forum threads", (p) => p.posts >= 25],
  ["chatter", "💬", "Chatterbox", "50 forum comments", (p) => p.comments >= 50],
  ["collector", "❤️", "Collector", "hearted 10 games", (p) => p.hearts >= 10],
  ["hoarder", "💎", "Hoarder", "hearted 50 games", (p) => p.hearts >= 50],
  ["explorer", "🧭", "Explorer", "rated games on 5 platforms", (p) => p.platforms_rated >= 5],
  ["globe", "🌍", "Globetrotter", "rated games on 15 platforms", (p) => p.platforms_rated >= 15],
  ["finisher", "🏁", "Finisher", "beat 10 backlog games", (p) => (p.backlog || {}).beaten >= 10],
  ["completionist", "🏆", "Completionist", "beat 50 backlog games", (p) => (p.backlog || {}).beaten >= 50],
  ["hype", "🚀", "Hype Machine", "20 five-out-of-five ratings", (p) => p.fives >= 20],
  ["tough", "🧊", "Tough Crowd", "10 zero-out-of-five ratings", (p) => p.zeros >= 10],
  ["trophy", "🏅", "Trophy Hunter", "10 site trophies", (p) => p.trophies >= 10],
  ["trophy-master", "🎇", "Trophy Master", "30 site trophies", (p) => p.trophies >= 30],
  ["popular", "📖", "Popular", "10 guestbook notes", (p) => p.wall_notes >= 10],
];
const earned = (p, x) => BADGES.filter((b) => { try { return !!b[4](p, x); } catch (e) { return false; } });

function notice(title, body, ...extra) {
  root.replaceChildren(el("section", { class: "pf-card pf-notice" }, el("h2", { text: title }), body ? el("p", { text: body }) : null, ...extra));
}
const isHidden = (p, k) => Array.isArray(p.hidden_sections) && p.hidden_sections.includes(k);
const bannerStyle = (b) => typeof b === "string" && b.startsWith(BANNER_OK) ? { cls: "pf-ban pf-ban--img", style: "--ban:url('" + b.replace(/'/g, "%27") + "')" } : { cls: "pf-ban pf-ban--" + (ALL_BANNERS.some(([k]) => k === b) ? b : "maroon"), style: null };
function avatarFramed(url, name, size, frame) {
  return el("span", { class: "pf-avw pf-frame--" + (ALL_FRAMES.some(([k]) => k === frame) ? frame : "none"), style: "--s:" + size + "px" }, avatar(url, name, size, "pf-av"));
}
const nameFx = (fx) => "pf-fx pf-fx--" + (ALL_FX.some(([k]) => k === fx) ? fx : "plain");

/* one card section; owners see hidden sections with a note */
function section(p, mine, key, title, ...kids) {
  if (key && isHidden(p, key) && !mine) return null;
  return el("section", { class: "pf-card pf-sec pf-sec--" + (key || "x") },
    el("h2", { class: "gm-head pf-h" }, el("span", { text: title }), key && isHidden(p, key) ? el("span", { class: "pf-hiddenTag", text: "Hidden from visitors" }) : null), ...kids);
}

/* ---------------- render ---------------- */
async function render() {
  authPill($("gm-auth"), { okTail: "." });
  const handle = wanted || (me.ready && me.profile && me.profile.handle) || "";
  if (!handle) {
    if (!me.user) return notice("Your profile", "Sign in with Discord to set up your profile: a banner, colours, a picture frame, your showcase games, a backlog, gamer tags and a guestbook.",
      el("button", { class: "btn gm-btn", type: "button", onclick: signIn, text: "Sign in with Discord" }));
    return notice("Profiles are almost here", "Custom profiles switch on as soon as the site's database update goes in. Check back soon.");
  }
  if (!wanted) history.replaceState(null, "", profileUrl(handle));
  root.replaceChildren(el("p", { class: "gm-empty", text: "Loading profile…" }));
  const [{ data: p, error }, top] = await Promise.all([
    sb.from("member_profiles").select("*").eq("handle", handle).maybeSingle(),
    sb.from("voter_stats").select("handle").order("votes", { ascending: false }).limit(3)]);
  if (error) return notice("Profiles are almost here", "Custom profiles switch on as soon as the site's database update goes in. Check back soon.");
  if (!p) return notice("No one here", "That profile doesn't exist, or the member isn't around any more.", el("a", { class: "linkbtn", href: "/games/", text: "Back to Rate-O-Pedia" }));
  const mine = !!(me.profile && me.profile.handle === p.handle);
  const plus = "banner" in p;      // round 15 is in
  const rank = ((top.data || []).findIndex((x) => x.handle === p.handle)) + 1;
  const ctx = { rank };
  const badges = earned(p, ctx);
  const lv = levelOf(p);
  document.title = p.name + " — Rate-O-Pedia";
  root.style.setProperty("--acc", accentOf(p.accent));
  document.querySelectorAll(".pf-pagefx").forEach((x) => x.remove());
  if (p.page_fx && p.page_fx !== "none" && PAGE_FX.some(([k]) => k === p.page_fx)) document.body.append(el("div", { class: "pf-pagefx pf-pagefx--" + p.page_fx, "aria-hidden": "true" }));

  /* ---- hero ---- */
  const ban = bannerStyle(p.banner);
  const pinned = p.pinned_badge && badges.find((b) => b[0] === p.pinned_badge);
  const status = (p.status_emoji || p.status_text) && !isHidden(p, "now")
    ? el("p", { class: "pf-status" }, p.status_emoji ? el("span", { class: "pf-status__e", "aria-hidden": "true", text: p.status_emoji }) : null, el("span", { text: p.status_text || "" })) : null;
  const head = el("section", { class: "pf-card pf-hero" },
    el("div", { class: ban.cls, style: ban.style, "aria-hidden": "true" }, el("span", { class: "pf-ban__lvl", text: "LV " + lv.lvl })),
    el("div", { class: "pf-hero__body" },
      avatarFramed(p.avatar, p.name, 120, p.frame),
      el("div", { class: "pf-id" },
        el("h1", { class: "pf-name" }, el("span", { class: nameFx(p.name_fx), "data-text": p.name, text: p.name }),
          pinned ? el("span", { class: "pf-pin", title: pinned[2] + ": " + pinned[3] }, pinned[1]) : null,
          p.is_owner ? ownerTag() : null, p.is_staff ? adminTag() : null, supporterTag(p),
          rank && rank <= 3 ? el("span", { class: "rop-me__medal rop-me__medal--" + ["gold", "silver", "bronze"][rank - 1], title: "Top " + rank + " voter", text: ["1st", "2nd", "3rd"][rank - 1] }) : null),
        el("p", { class: "pf-sub" }, p.flair_text ? el("span", { class: "pf-flair" + (p.is_owner ? " pf-flair--own" : ""), text: p.flair_text }) : null,
          p.pronouns ? el("span", { class: "pf-pron", text: p.pronouns }) : null,
          el("span", { class: "pf-title", text: lv.title }), el("span", { class: "pf-since", text: "Member since " + memberSince(p.member_since) })),
        status,
        p.motto ? el("p", { class: "pf-motto " + colorClass(p.motto_color), text: "“" + p.motto + "”" }) : (mine ? el("p", { class: "pf-motto pf-motto--none", text: "No motto yet." }) : null)),
      el("div", { class: "pf-actions" },
        mine ? el("button", { class: "btn gm-btn", type: "button", text: "Edit profile", onclick: () => editor(p) }) : followBtn(p),
        followCounts(p, mine),
        el("button", { class: "linkbtn", type: "button", text: "Share", onclick: () => share(profileUrl(p.handle), p.name + " on Rate-O-Pedia") }))),
    el("div", { class: "pf-xp", title: fmt(lv.xp) + " XP · " + fmt(lv.next) + " to level " + (lv.lvl + 1) },
      el("span", { class: "pf-xp__l", text: "Level " + lv.lvl }),
      el("span", { class: "pf-xp__bar" }, el("span", { class: "pf-xp__fill", style: "width:" + lv.pct + "%" })),
      el("span", { class: "pf-xp__n", text: fmt(lv.xp) + " XP" })));

  /* ---- stats ---- */
  const stat = (n, label, title) => n == null ? null : el("li", { title: title || null }, el("b", { text: fmt(n) }), el("span", { text: label }));
  const statsBox = section(p, mine, "stats", "Stats", el("ul", { class: "pf-statgrid" },
    stat(p.votes, "ratings"), stat(p.reviews, "reviews"), stat(p.posts, "forum threads"), stat(p.comments, "comments"),
    stat(p.hearts, "hearted"), stat(p.trophies, "trophies", "Site trophies earned"), stat(p.helpful_received, "found helpful", "Helpful votes on their reviews"),
    stat(p.platforms_rated, "platforms rated"), stat(p.fives, "perfect 5s"), stat(badges.length, "badges")));

  /* ---- now playing + about + gamer tags ---- */
  const np = p.now_playing && !isHidden(p, "now") ? p.now_playing : (mine && p.now_playing ? p.now_playing : null);
  const nowBox = np ? section(p, mine, "now", "Now playing",
    el("a", { class: "pf-now", href: gameUrl(np.id), "data-f": familyOf(np.console), style: "--fc:" + (FAMILY[familyOf(np.console)] || {}).color },
      el("span", { class: "pf-now__pulse", "aria-hidden": "true" }), el("span", { class: "pf-now__t", text: np.title }),
      el("span", { class: "pf-now__c", text: platformName(np.console) }))) : null;
  const links = Object.entries(p.links || {}).filter(([, v]) => v);
  const linkBox = links.length ? section(p, mine, "links", "Gamer tags", el("div", { class: "pf-links" }, ...LINKS.filter(([k]) => p.links[k]).map(([k, label, url]) => {
    const v = p.links[k];
    return url ? el("a", { class: "pf-link pf-link--" + k, href: url(v), target: "_blank", rel: "noopener nofollow" }, el("small", { text: label }), el("b", { text: v }))
      : el("button", { class: "pf-link pf-link--" + k, type: "button", title: "Copy", onclick: async () => { try { await navigator.clipboard.writeText(v); toast(label + " copied", "ok"); } catch (e) { prompt(label + ":", v); } } },
        el("small", { text: label + " · copy" }), el("b", { text: v }));
  }))) : null;
  const raBox = p.ra_user ? raCard(p, mine) : null;
  const aboutBox = p.bio || mine ? el("section", { class: "pf-card pf-sec pf-sec--about" }, el("h2", { class: "gm-head pf-h", text: "About" }),
    p.bio ? el("div", { class: "pf-bio" }, ...p.bio.split(/\n{2,}/).map((para) => el("p", { text: para })))
      : el("p", { class: "gm-note", text: plus ? "Tell people about yourself in Edit profile → About." : "The About box arrives with the next database update." })) : null;

  /* ---- showcase ---- */
  const favs = Array.isArray(p.favorites) ? p.favorites : [];
  const showGrid = el("ol", { class: "pf-show" });
  const showBox = section(p, mine, "showcase", plus ? "Showcase" : "Favourite games",
    favs.length ? showGrid : el("p", { class: "gm-note", text: mine ? "Pick up to " + (plus ? 6 : 3) + " games in Edit profile → Showcase." : "Nothing in the showcase yet." }));
  if (favs.length) {
    const tile = (g, i, avg) => el("li", { class: "pf-show__i", style: "--fc:" + ((FAMILY[familyOf(g.console)] || {}).color || "#888") },
      el("a", { class: "pf-show__a", href: gameUrl(g.id) },
        el("span", { class: "pf-show__n", text: String(i + 1) }),
        el("span", { class: "pf-show__t", text: g.title }),
        el("span", { class: "pf-show__f" }, consoleChip(g.console), avg != null ? el("span", { class: "pf-show__s", text: Number(avg).toFixed(1) + " / 5" }) : null)));
    showGrid.replaceChildren(...favs.map((g, i) => tile(g, i, null)));
    sb.from("game_scores").select("id,average,votes").in("id", favs.map((g) => g.id)).then(({ data }) => {
      const m = new Map((data || []).filter((x) => x.votes > 0).map((x) => [x.id, x.average]));
      showGrid.replaceChildren(...favs.map((g, i) => tile(g, i, m.get(g.id))));
    }, () => {});
  }

  /* ---- badges ---- */
  const badgeBox = section(p, mine, "badges", "Badges · " + badges.length + " / " + BADGES.length,
    el("ul", { class: "pf-badges" }, ...(mine ? BADGES : badges).map((b) => {
      const got = badges.includes(b);
      return el("li", { class: "pf-badge" + (got ? "" : " is-locked") + (p.pinned_badge === b[0] ? " is-pinned" : ""), title: b[2] + ": " + b[3] + (got ? "" : " (not yet)") },
        el("span", { class: "pf-badge__i", "aria-hidden": "true", text: b[1] }), el("b", { text: b[2] }), el("small", { text: b[3] }));
    })),
    mine ? el("p", { class: "gm-note", text: "Locked badges are dimmed (only you see those). Pin your favourite next to your name in Edit profile → Look." }) : null);

  /* ---- backlog ---- */
  const blBox = plus ? section(p, mine, "backlog", "Backlog", el("p", { class: "gm-empty", text: "Loading…" })) : null;
  /* ---- hearts ---- */
  const heartBox = section(p, mine, "hearts", "♥ Hearted games", el("p", { class: "gm-empty", text: "Loading…" }));
  /* ---- guestbook ---- */
  const wallBox = plus ? section(p, mine, "wall", "Guestbook", el("p", { class: "gm-empty", text: "Loading…" })) : null;
  /* ---- recent ---- */
  const listsBox = section(p, mine, "lists", "Lists", el("p", { class: "gm-empty", text: "Loading…" }));
  const postsBox = section(p, mine, "posts", "Recent forum posts", el("p", { class: "gm-empty", text: "Loading…" }));
  const revBox = section(p, mine, "reviews", "Recent reviews", el("p", { class: "gm-empty", text: "Loading…" }));

  root.replaceChildren(...[head,
    el("div", { class: "pf-cols pf-cols--top" }, el("div", { class: "pf-col" }, aboutBox, linkBox), el("div", { class: "pf-col" }, nowBox, raBox, statsBox)),
    showBox, listsBox, badgeBox, blBox, heartBox, wallBox,
    el("div", { class: "pf-cols" }, postsBox, revBox)].filter(Boolean));
  root.querySelectorAll(".pf-col:empty").forEach((c) => c.remove());
  if (mine && params.has("edit")) editor(p);

  if (blBox) backlog(p, mine, blBox);
  if (listsBox) sb.from("public_lists").select("*").eq("handle", p.handle).order("updated_at", { ascending: false }).limit(12).then(({ data, error }) => {
    listsBox.lastChild.remove();
    if (error || (!(data || []).length && !mine)) { listsBox.remove(); return; }
    if (!(data || []).length) return listsBox.append(el("p", { class: "gm-note" }, "No public lists yet. ", el("a", { href: "/games/lists/", text: "Make one →" })));
    listsBox.append(el("ul", { class: "pf-list" }, ...data.map((l) => el("li", null, el("a", { href: "/games/lists/?id=" + l.id, text: l.title }),
      el("span", { class: "gm-note", text: " · " + l.games + (l.games === 1 ? " game" : " games") + " · ♥ " + l.likes })))));
  }, () => listsBox.remove());
  if (wallBox) wall(p, mine, wallBox);
  if (heartBox) sb.from("member_hearts").select("game_id,title,console,created_at").eq("handle", p.handle).order("created_at", { ascending: false }).limit(300).then(({ data, error }) => {
    heartBox.lastChild.remove();
    if (error) { heartBox.remove(); return; }
    if (!data || !data.length) return heartBox.append(el("p", { class: "gm-note", text: mine ? "Tap the heart on any game's info card to bank it here." : "No hearted games yet." }));
    heartBox.querySelector(".pf-h span").textContent = "♥ Hearted games (" + data.length + ")";
    heartBox.append(el("div", { class: "pf-bank" }, ...data.map((g) => el("a", { class: "pf-bank__g", href: gameUrl(g.game_id) },
      consoleChip(g.console), el("span", { class: "pf-fav__t", text: g.title })))));
  });
  if (postsBox) sb.from("forum_feed").select("id,title,category,created_at,comments,reaction_total").eq("handle", p.handle).order("created_at", { ascending: false }).limit(6).then(({ data }) => {
    postsBox.lastChild.remove();
    if (!data || !data.length) return postsBox.append(el("p", { class: "gm-note", text: "No posts yet." }));
    postsBox.append(el("ul", { class: "pf-list" }, ...data.map((f) => el("li", null,
      el("a", { href: "/games/forum/?p=" + f.id, text: f.title }),
      el("span", { class: "gm-note", text: " · " + ago(f.created_at) + " · " + plural(f.comments, "comment") })))));
  });
  if (revBox) sb.from("public_reviews").select("*").eq("handle", p.handle).order("created_at", { ascending: false }).limit(6).then(async ({ data }) => {
    revBox.lastChild.remove();
    if (!data || !data.length) return revBox.append(el("p", { class: "gm-note", text: "No reviews yet." }));
    const g = await sb.from("game_scores").select("id,title,console").in("id", data.map((r) => r.game_id));
    const titles = new Map((g.data || []).map((x) => [x.id, x]));
    revBox.append(el("ul", { class: "pf-list" }, ...data.map((r) => {
      const gm = titles.get(r.game_id);
      const rx = r.helpful != null && (r.helpful || r.funny || r.agree) ? " · 👍 " + r.helpful + " 😂 " + r.funny + " 🤝 " + r.agree : "";
      return el("li", null,
        el("a", { href: gameUrl(r.game_id), text: gm ? gm.title : "A game" }),
        r.stars != null ? el("span", { class: "gm-note", text: " · " + r.stars + " / 5" + rx }) : null,
        el("p", { class: "pf-snip", text: r.body.length > 160 ? r.body.slice(0, 157) + "…" : r.body }));
    })));
  });
}

/* ---------------- backlog: progress bar, status tabs, list ---------------- */
async function backlog(p, mine, box) {
  // owners read their own list directly (so it works even when hidden); everyone else reads the public view
  const res = mine
    ? await sb.from("game_backlog").select("game_id,status,updated_at,games(title,console)").order("updated_at", { ascending: false }).limit(2000)
    : await sb.from("member_backlog").select("game_id,title,console,status,updated_at").eq("handle", p.handle).order("updated_at", { ascending: false }).limit(2000);
  box.lastChild.remove();
  if (res.error) { box.remove(); return; }
  let rows = (res.data || []).map((r) => r.games ? { game_id: r.game_id, status: r.status, updated_at: r.updated_at, title: r.games.title, console: r.games.console } : r);
  let filter = "";
  const body = el("div", { class: "pf-bl" });
  box.append(body);
  draw();
  function draw() {
    const c = { want: 0, playing: 0, beaten: 0, dropped: 0 };
    rows.forEach((r) => { c[r.status]++; });
    const active = c.want + c.playing + c.beaten;
    const pct = active ? Math.round((c.beaten / active) * 100) : 0;
    box.querySelector(".pf-h span").textContent = "Backlog (" + rows.length + ")";
    if (!rows.length) { body.replaceChildren(el("p", { class: "gm-note", text: mine ? "Use the backlog buttons on any game's info card (Want to play, Playing, Beaten, Dropped) to build your list." : "Nothing on the backlog yet." })); return; }
    const seg = (k, n) => n ? el("span", { class: "pf-bl__seg pf-bl__seg--" + k, style: "flex:" + n, title: BACKLOG_LABEL[k][0] + ": " + n }) : null;
    const list = rows.filter((r) => !filter || r.status === filter);
    body.replaceChildren(
      el("div", { class: "pf-bl__prog" },
        el("p", { class: "pf-bl__big" }, el("b", { text: pct + "%" }), el("span", { text: " beaten · " + c.beaten + " of " + active + " games" + (c.dropped ? " (" + c.dropped + " dropped)" : "") })),
        el("div", { class: "pf-bl__bar", role: "img", "aria-label": c.beaten + " beaten, " + c.playing + " playing, " + c.want + " want to play" }, seg("beaten", c.beaten), seg("playing", c.playing), seg("want", c.want))),
      el("div", { class: "pf-bl__tabs", role: "group", "aria-label": "Show" },
        ...[["", "All", rows.length, ""], ...BACKLOG.map(([k, l, i]) => [k, l, c[k], i])].map(([k, l, n, i]) =>
          el("button", { class: "gm-tab" + (filter === k ? " is-on" : ""), type: "button", "aria-pressed": filter === k ? "true" : "false", onclick: () => { filter = k; draw(); } },
            (i ? i + " " : "") + l + " (" + n + ")"))),
      list.length ? el("ul", { class: "pf-bl__list" }, ...list.slice(0, 300).map((r) => el("li", { class: "pf-bl__row pf-bl__row--" + r.status },
        el("span", { class: "pf-bl__st", title: BACKLOG_LABEL[r.status][0], text: BACKLOG_LABEL[r.status][1] }),
        consoleChip(r.console),
        el("a", { class: "pf-bl__t", href: gameUrl(r.game_id), text: r.title }),
        mine ? statusSelect(r) : el("span", { class: "gm-note", text: ago(r.updated_at) }))))
        : el("p", { class: "gm-note", text: "Nothing here." }),
      list.length > 300 ? el("p", { class: "gm-note", text: "Showing the latest 300." }) : "");
  }
  function statusSelect(r) {
    const s = el("select", { class: "pf-bl__sel", "aria-label": "Status of " + r.title },
      ...BACKLOG.map(([k, l]) => el("option", { value: k, selected: k === r.status, text: l })), el("option", { value: "", text: "Remove" }));
    s.addEventListener("change", async () => {
      const v = s.value;
      const { error } = await sb.rpc("set_backlog", { p_game: r.game_id, p_status: v });
      if (error) { toast(error.message, "err"); s.value = r.status; return; }
      if (v) { r.status = v; r.updated_at = new Date().toISOString(); } else rows = rows.filter((x) => x !== r);
      sfx("tap"); draw();
    });
    return s;
  }
}

/* ---------------- guestbook ---------------- */
async function wall(p, mine, box) {
  const list = el("div", { class: "pf-wall" });
  box.lastChild.replaceWith(list);
  box.id = "wall";
  async function load() {
    const { data, error } = await sb.from("public_wall").select("*").eq("profile_handle", p.handle).order("created_at", { ascending: false }).limit(60);
    if (error) { box.remove(); return; }
    box.querySelector(".pf-h span").textContent = "Guestbook" + (data.length ? " (" + data.length + (data.length === 60 ? "+" : "") + ")" : "");
    list.replaceChildren(...data.map((n) => {
      const canDel = mine || me.admin || (me.profile && me.profile.handle === n.handle);
      return el("article", { class: "pf-note", style: "--nc:" + accentOf(n.author_accent) },
        el("span", { class: "pf-avw pf-frame--" + (n.author_frame || "none"), style: "--s:40px" }, avatar(n.avatar, n.author, 40, "pf-av")),
        el("div", { class: "pf-note__b" },
          el("header", null, el("a", { class: "rop-name", href: profileUrl(n.handle), text: n.author }), n.author_is_owner ? ownerTag() : null, n.author_is_staff ? adminTag() : null,
            el("span", { class: "gm-note", text: " · " + ago(n.created_at) }),
            canDel ? el("button", { class: "linkbtn gm-report", type: "button", text: "Delete", onclick: async () => {
              if (!confirm("Delete this note?")) return;
              const { error } = await sb.rpc("wall_delete", { p_id: n.id });
              if (error) toast(error.message, "err"); else { sfx("tap"); load(); }
            } }) : reportBtn("wall", n.id)),
          el("p", { text: n.body })));
    }));
    if (!data.length) list.append(el("p", { class: "gm-note", text: mine ? "No notes yet. Friends can sign your guestbook here." : "No notes yet. Be the first to sign it." }));
  }
  await load();
  if (!box.isConnected) return;
  if (!p.wall_open && !mine) { box.append(el("p", { class: "gm-note", text: "This guestbook is closed." })); return; }
  if (!me.user) { box.append(el("p", { class: "fr-gate" }, el("button", { class: "linkbtn", type: "button", onclick: signIn, text: "Sign in" }), " to sign the guestbook.")); return; }
  if (!me.member) { box.append(el("p", { class: "fr-gate" }, el("a", { class: "linkbtn", href: INVITE, target: "_blank", rel: "noopener", text: "Join the Discord" }), " to sign the guestbook.")); return; }
  const ta = el("textarea", { class: "gm-ta", maxlength: "300", rows: "2", placeholder: mine ? "Pin a note on your own guestbook" : "Say hi to " + p.name, "aria-label": "Guestbook note" });
  const count = el("span", { class: "gm-note", text: "0 / 300" });
  ta.addEventListener("input", () => { count.textContent = ta.value.length + " / 300"; });
  const send = el("button", { class: "btn gm-btn", type: "button", text: "Sign guestbook", onclick: async () => {
    const body = ta.value.trim(); if (!body) return;
    send.disabled = true;
    const { error } = await sb.rpc("wall_post", { p_handle: p.handle, p_body: body });
    send.disabled = false;
    if (error) { toast(error.message, "err"); sfx("error"); return; }
    ta.value = ""; count.textContent = "0 / 300"; sfx("success"); load();
  } });
  box.append(el("div", { class: "pf-wall__write" }, ta, el("div", { class: "gm-write__bar" }, send, count)));
}

/* ---------------- Supporter badge (round 22): anyone who has donated through /support/ ---------------- */
function supporterTag(p) {
  const t = el("a", { class: "pf-supporter", href: "/support/", hidden: true, text: "♥ Supporter" });
  sb.from("member_supporters").select("supporter_since,supporter_tier").eq("handle", p.handle).maybeSingle().then(({ data, error }) => {
    if (error || !data) { t.remove(); return; }
    t.title = (data.supporter_tier === "monthly" ? "Monthly supporter" : "Supporter") + " since " + memberSince(data.supporter_since) + ". Thank you!";
    if (data.supporter_tier === "monthly") t.classList.add("pf-supporter--monthly");
    t.hidden = false;
  }, () => t.remove());
  return t;
}

/* ---------------- follow button + follower counts (round 21) ---------------- */
function followBtn(p) {
  const b = el("button", { class: "btn gm-btn pf-follow", type: "button", hidden: true });
  let on = false;
  const draw = () => { b.textContent = on ? "✓ Following" : "＋ Follow"; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", String(on)); };
  sb.rpc("follow_info", { p_handle: p.handle }).then(({ data, error }) => {
    if (error || !me.user) return;          // database update not run yet, or signed out: no button
    on = !!(data && data[0] && data[0].i_follow); draw(); b.hidden = false;
  }, () => {});
  b.addEventListener("click", async () => {
    if (!me.member) { toast("Join the Discord to follow members."); return; }
    b.disabled = true;
    const { data, error } = await sb.rpc("toggle_follow", { p_handle: p.handle });
    b.disabled = false;
    if (error) { toast(error.message, "err"); return; }
    on = data === true; draw(); sfx(on ? "success" : "tap"); statsChanged();
    document.querySelectorAll(".pf-fcount__n").forEach((x) => { x.textContent = String(Math.max(0, (+x.textContent || 0) + (on ? 1 : -1))); });
  });
  return b;
}
function followCounts(p, mine) {
  const box = el("span", { class: "pf-fcount", hidden: true });
  sb.rpc("follow_info", { p_handle: p.handle }).then(({ data, error }) => {
    if (error || !data || !data[0]) return;
    box.replaceChildren(el("b", { class: "pf-fcount__n", text: String(data[0].followers) }), " followers · ", el("b", { text: String(data[0].following) }), " following",
      mine ? el("a", { class: "linkbtn", href: "/games/feed/", text: " · Feed →" }) : "");
    box.hidden = false;
  }, () => {});
  return box;
}

/* ---------------- RetroAchievements card ----------------
 * Points and mastered games come from the ra-sync function (it holds the RA key); the picture straight from RA. */
function raCard(p, mine) {
  const num = (v, k) => el("div", { class: "pf-ra__n" }, el("b", { text: v == null ? "–" : Number(v).toLocaleString() }), el("span", { text: k }));
  const nums = el("div", { class: "pf-ra__nums" }, num(p.ra_points, "points"), num(p.ra_masteries, "mastered"));
  const card = el("section", { class: "pf-card pf-sec pf-ra" },
    el("h2", { class: "gm-head pf-h", text: "RetroAchievements" }),
    el("a", { class: "pf-ra__who", href: raUserUrl(p.ra_user), target: "_blank", rel: "noopener nofollow" },
      el("img", { class: "pf-ra__pic", src: "https://media.retroachievements.org/UserPic/" + encodeURIComponent(p.ra_user) + ".png", alt: "", loading: "lazy", referrerpolicy: "no-referrer", onerror: (e) => e.target.remove() }),
      el("span", null, el("b", { text: p.ra_user }), p.ra_verified ? el("span", { class: "pf-ra__ok", title: "Their RetroAchievements motto confirms this account", text: " ✔ verified" }) : null)),
    nums,
    mine && !p.ra_verified ? el("p", { class: "gm-note", text: "To show the ✔, put rop:" + p.handle + " anywhere in your RetroAchievements motto. It updates within a few hours." }) : null);
  // ask for fresh numbers (the function keeps them for 6 hours, so this is cheap)
  sb.functions.invoke("ra-sync", { body: { handle: p.handle } }).then(({ data }) => {
    if (!data || !data.ok || data.cached) return;
    nums.replaceWith(el("div", { class: "pf-ra__nums" }, num(data.ra_points, "points"), num(data.ra_masteries, "mastered")));
  }, () => {});
  return card;
}

/* ---------------- editor ---------------- */
async function toWebp(file, w, h, q) {
  const bmp = await createImageBitmap(file);
  const want = w / h, have = bmp.width / bmp.height;
  const sw = have > want ? bmp.height * want : bmp.width, sh = have > want ? bmp.height : bmp.width / want;   // centre crop to w:h
  const scale = Math.min(1, w / sw);
  const c = document.createElement("canvas"); c.width = Math.round(sw * scale); c.height = Math.round(sh * scale);
  c.getContext("2d").drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, 0, 0, c.width, c.height);
  return await new Promise((res) => c.toBlob(res, "image/webp", q || 0.86));
}
async function tidy(bucket, keepUrl) {
  try { const ls = await sb.storage.from(bucket).list(me.user.id); const keep = keepUrl ? keepUrl.split("/").pop() : ""; const old = (ls.data || []).map((o) => o.name).filter((n) => n !== keep); if (old.length) await sb.storage.from(bucket).remove(old.map((n) => me.user.id + "/" + n)); } catch (e) {}
}
/* a game search box: onPick(game) */
function gameSearch(placeholder, onPick, skip) {
  const q = el("input", { class: "gm-search pf-in", type: "search", placeholder, "aria-label": placeholder });
  const res = el("div", { class: "pf-res" });
  let t = 0;
  q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(async () => {
    const s = q.value.trim(); if (s.length < 2) { res.replaceChildren(); return; }
    await hasSearchKey(); const { data } = await (titleSearch(sb.from("game_scores").select("id,title,console"), s)).order("votes", { ascending: false }).limit(8);
    res.replaceChildren(...(data || []).filter((x) => !(skip && skip(x))).map((x) =>
      el("button", { type: "button", class: "pf-res__b", onclick: () => onPick(x) }, consoleChip(x.console), " " + x.title)));
    if (!res.children.length) res.append(el("p", { class: "gm-note", text: "No match. You can add missing games on the Ratings page." }));
  }, 220); });
  return el("div", { class: "pf-slot__q" }, q, res);
}

function editor(p) {
  const prof = me.profile || {};
  const plus = "banner" in p;
  const max = plus ? 6 : 3;
  const st = {
    pic: prof.custom_avatar || null, color: prof.motto_color || "white",
    banner: p.banner || "maroon", accent: p.accent || "maroon", frame: p.frame || "none", fx: p.name_fx || "plain",
    emoji: p.status_emoji || "", now: p.now_playing || null, hidden: new Set(p.hidden_sections || []), wall: p.wall_open !== false,
    pin: p.pinned_badge || "", links: Object.assign({}, p.links || {}), page: p.page_fx || "none",
  };
  const favs = (Array.isArray(p.favorites) ? p.favorites : []).slice(0, max);
  while (favs.length < max) favs.push(null);

  const d = el("dialog", { class: "sx-modal pf-dlg pf-dlg--big", "aria-label": "Edit profile" });
  const note = el("p", { class: "gm-note", role: "status" });
  const close = () => { d.close(); };

  /* live preview of the hero */
  const pv = el("div", { class: "pf-pv" });
  const name = el("input", { class: "gm-search pf-in", maxlength: "24", value: prof.display_name || "", placeholder: prof.name || "Your Discord name", "aria-label": "Username" });
  const pron = el("input", { class: "gm-search pf-in", maxlength: "24", value: p.pronouns || "", placeholder: "e.g. she/her, he/him, they/them", "aria-label": "Pronouns" });
  const motto = el("input", { class: "gm-search pf-in", maxlength: "60", value: prof.motto || "", placeholder: "A line that sums you up", "aria-label": "Motto" });
  const stText = el("input", { class: "gm-search pf-in", maxlength: "80", value: p.status_text || "", placeholder: "What are you up to?", "aria-label": "Status" });
  function paint() {
    const b = bannerStyle(st.banner);
    pv.style.setProperty("--acc", accentOf(st.accent));
    const nm = name.value.trim() || prof.name || "You";
    pv.replaceChildren(el("div", { class: b.cls, style: b.style }),
      el("div", { class: "pf-pv__body" }, avatarFramed(st.pic || prof.avatar, nm, 72, st.frame),
        el("div", null,
          el("b", { class: "pf-pv__name" }, el("span", { class: nameFx(st.fx), "data-text": nm, text: nm }), st.pin ? el("span", { class: "pf-pin", text: (BADGES.find((x) => x[0] === st.pin) || [])[1] || "" }) : null),
          flair && flair.value.trim() ? el("span", { class: "pf-flair" + (me.admin ? " pf-flair--own" : ""), text: flair.value.trim() }) : null,
          pron.value.trim() ? el("span", { class: "pf-pron", text: pron.value.trim() }) : null,
          (st.emoji || stText.value.trim()) ? el("p", { class: "pf-status" }, st.emoji ? el("span", { class: "pf-status__e", text: st.emoji }) : null, stText.value.trim()) : null,
          motto.value.trim() ? el("p", { class: "pf-motto " + colorClass(st.color), text: "“" + motto.value.trim() + "”" }) : null)));
  }
  const flair = (me.staff || me.admin) && "flair_text" in p ? el("input", { class: "gm-search pf-in", maxlength: "24", value: p.flair_text || "", placeholder: me.admin ? "e.g. Founder, Head Honcho" : "e.g. Moderator, Event Host", "aria-label": "Flair" }) : null;
  [name, pron, motto, stText, flair].filter(Boolean).forEach((x) => x.addEventListener("input", paint));

  const swatchRow = (items, cur, set, cls, label, deco) => {
    const row = el("div", { class: "pf-sw " + (cls || ""), role: "radiogroup", "aria-label": label });
    for (const [k, l] of items) {
      const b = el("button", { type: "button", class: "pf-sw__b " + (deco ? deco(k) : "") + (k === cur() ? " is-on" : ""), role: "radio", "aria-checked": k === cur() ? "true" : "false", title: l, "aria-label": l,
        onclick: () => { set(k); row.querySelectorAll(".pf-sw__b").forEach((x) => { const on = x === b; x.classList.toggle("is-on", on); x.setAttribute("aria-checked", on ? "true" : "false"); }); paint(); } },
      );
      if (cls === "pf-sw--txt") b.textContent = l;
      row.append(b);
    }
    return row;
  };

  /* --- Basics --- */
  const file = el("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif", hidden: true, onchange: async () => {
    const f = file.files && file.files[0]; if (!f) return;
    if (f.size > 8 * 1024 * 1024) { note.textContent = "That picture is over 8 MB."; return; }
    note.textContent = "Uploading…";
    try {
      const blob = await toWebp(f, 256, 256);
      const path = me.user.id + "/" + Date.now() + ".webp";
      const up = await sb.storage.from("avatars").upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
      if (up.error) throw up.error;
      st.pic = SB_URL + "/storage/v1/object/public/avatars/" + path;
      paint(); note.textContent = "Picture ready. Press Save to keep it.";
    } catch (e) { note.textContent = "That picture didn't upload: " + (e.message || e); }
    file.value = "";
  } });
  const basics = el("div", { class: "pf-tabpane" },
    el("label", { class: "pf-lab", text: "Username" }), name,
    el("p", { class: "gm-note", text: "2 to 24 letters, numbers, spaces, _ . or -. Leave empty to use your Discord name." }),
    plus ? el("label", { class: "pf-lab", text: "Pronouns (optional)" }) : null, plus ? pron : null,
    el("label", { class: "pf-lab", text: "Profile picture" }),
    el("div", { class: "pf-picrow" },
      el("button", { class: "btn gm-btn", type: "button", text: "Upload a picture", onclick: () => file.click() }),
      el("button", { class: "linkbtn", type: "button", text: "Use my Discord picture", onclick: () => { st.pic = null; paint(); } }), file),
    el("label", { class: "pf-lab", text: "Motto" }), motto,
    swatchRow(COLORS, () => st.color, (k) => { st.color = k; }, "", "Motto colour", (k) => colorClass(k)));

  /* --- Look --- */
  const bfile = el("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif", hidden: true, onchange: async () => {
    const f = bfile.files && bfile.files[0]; if (!f) return;
    if (f.size > 12 * 1024 * 1024) { note.textContent = "That image is over 12 MB."; return; }
    note.textContent = "Uploading banner…";
    try {
      const blob = await toWebp(f, 1500, 500, 0.84);
      const path = me.user.id + "/" + Date.now() + ".webp";
      const up = await sb.storage.from("banners").upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
      if (up.error) throw up.error;
      st.banner = BANNER_OK + path; banRow.querySelectorAll(".pf-sw__b").forEach((x) => x.classList.remove("is-on"));
      paint(); note.textContent = "Banner ready. Press Save to keep it.";
    } catch (e) { note.textContent = "That banner didn't upload: " + (e.message || e); }
    bfile.value = "";
  } });
  const banRow = swatchRow(BANNERS, () => st.banner, (k) => { st.banner = k; }, "pf-sw--ban", "Banner", (k) => "pf-ban pf-ban--" + k);
  const look = plus ? el("div", { class: "pf-tabpane", hidden: true },
    el("label", { class: "pf-lab", text: "Banner" }), banRow,
    el("div", { class: "pf-picrow" }, el("button", { class: "btn gm-btn", type: "button", text: "Upload my own banner", onclick: () => bfile.click() }), el("span", { class: "gm-note", text: "Wide images work best (3:1, cropped from the centre)." }), bfile),
    el("label", { class: "pf-lab", text: "Accent colour" }),
    swatchRow(Object.keys(ACCENTS).map((k) => [k, ACCENT_NAMES[k]]), () => st.accent, (k) => { st.accent = k; }, "pf-sw--acc", "Accent colour", (k) => "pf-acc--" + k),
    el("label", { class: "pf-lab", text: "Picture frame" }),
    swatchRow(FRAMES, () => st.frame, (k) => { st.frame = k; }, "pf-sw--txt", "Picture frame"),
    el("label", { class: "pf-lab", text: "Name style" }),
    swatchRow(NAME_FX, () => st.fx, (k) => { st.fx = k; }, "pf-sw--txt", "Name style"),
    el("label", { class: "pf-lab", text: "Pinned badge (shows next to your name)" }),
    (() => {
      const got = earned(p, { rank: 0 });
      const s = el("select", { class: "gm-search pf-in", "aria-label": "Pinned badge" }, el("option", { value: "", text: "None" }),
        ...BADGES.filter((b) => got.includes(b) || b[0] === "podium").map((b) => el("option", { value: b[0], selected: b[0] === st.pin, text: b[1] + "  " + b[2] })));
      s.addEventListener("change", () => { st.pin = s.value; paint(); });
      return s;
    })()) : null;

  /* --- Admin / owner exclusives --- */
  const hasX = plus && "page_fx" in p && (me.staff || me.admin);
  const xset = (k) => [...((me.staff || me.admin) ? X_ADMIN[k] : []), ...(me.admin ? X_OWNER[k] : [])];
  const hex = me.admin ? el("input", { type: "color", class: "pf-hex", value: /^#[0-9a-f]{6}$/i.test(st.accent) ? st.accent : accentOf(st.accent), "aria-label": "Any accent colour" }) : null;
  if (hex) hex.addEventListener("input", () => { st.accent = hex.value; paint(); });
  const excl = hasX ? el("div", { class: "pf-tabpane pf-xpane", hidden: true },
    el("p", { class: "pf-xhead" }, me.admin ? "👑 Owner + 🛡️ Admin exclusives" : "🛡️ Admin exclusives",
      el("small", { text: me.admin ? "Only you can use the gold set. Admins get the red set." : "Only Admins (and the site owner) can use these." })),
    el("label", { class: "pf-lab", text: "Flair (shows under your name)" }), flair,
    el("label", { class: "pf-lab", text: "Exclusive banners" }),
    swatchRow(xset("banners"), () => st.banner, (k) => { st.banner = k; banRow.querySelectorAll(".pf-sw__b").forEach((x) => x.classList.remove("is-on")); }, "pf-sw--ban", "Exclusive banner", (k) => "pf-ban pf-ban--" + k),
    el("label", { class: "pf-lab", text: "Exclusive frames" }),
    swatchRow(xset("frames"), () => st.frame, (k) => { st.frame = k; }, "pf-sw--txt", "Exclusive frame"),
    el("label", { class: "pf-lab", text: "Exclusive name styles" }),
    swatchRow(xset("fx"), () => st.fx, (k) => { st.fx = k; }, "pf-sw--txt", "Exclusive name style"),
    el("label", { class: "pf-lab", text: "Page effect (covers your whole profile page)" }),
    swatchRow([["none", "None"], ...xset("page")], () => st.page, (k) => { st.page = k; }, "pf-sw--txt", "Page effect"),
    hex ? el("label", { class: "pf-lab", text: "Any accent colour" }) : null,
    hex ? el("div", { class: "pf-picrow" }, hex, el("span", { class: "gm-note", text: "Overrides the accent swatches." })) : null) : null;

  /* --- About --- */
  const bio = el("textarea", { class: "gm-ta", maxlength: "600", rows: "6", placeholder: "Who you are, what you play, your hottest take…", "aria-label": "About me" });
  bio.value = p.bio || "";
  const bioN = el("span", { class: "gm-note", text: bio.value.length + " / 600" });
  bio.addEventListener("input", () => { bioN.textContent = bio.value.length + " / 600"; });
  const emo = el("input", { class: "gm-search pf-in pf-in--emo", maxlength: "8", value: st.emoji, placeholder: "🙂", "aria-label": "Status emoji" });
  emo.addEventListener("input", () => { st.emoji = emo.value.trim(); paint(); });
  const nowBox = el("div", { class: "pf-nowedit" });
  const drawNow = () => nowBox.replaceChildren(st.now
    ? el("div", { class: "pf-slot" }, consoleChip(st.now.console), el("span", { class: "pf-fav__t", text: st.now.title }), el("button", { class: "linkbtn", type: "button", text: "Clear", onclick: () => { st.now = null; drawNow(); } }))
    : gameSearch("Search for what you're playing", (g) => { st.now = g; drawNow(); }));
  drawNow();
  const about = plus ? el("div", { class: "pf-tabpane", hidden: true },
    el("label", { class: "pf-lab", text: "Status" }),
    el("div", { class: "pf-emorow" }, emo, stText),
    el("div", { class: "pf-emopick" }, ...STATUS_EMOJI.map((e) => el("button", { type: "button", class: "pf-emo", text: e, "aria-label": "Use " + e, onclick: () => { st.emoji = e; emo.value = e; paint(); } })),
      el("button", { type: "button", class: "linkbtn", text: "Clear", onclick: () => { st.emoji = ""; emo.value = ""; stText.value = ""; paint(); } })),
    el("label", { class: "pf-lab", text: "Now playing" }), nowBox,
    el("label", { class: "pf-lab", text: "About me" }), bio, bioN) : null;

  /* --- Showcase --- */
  const favRows = el("div", { class: "pf-favedit" });
  const drawFavs = () => favRows.replaceChildren(...favs.map((g, i) => favSlot(i)));
  function favSlot(i) {
    const g = favs[i];
    const move = (dir) => { const j = i + dir; if (j < 0 || j >= favs.length) return; [favs[i], favs[j]] = [favs[j], favs[i]]; drawFavs(); };
    if (g) return el("div", { class: "pf-slot" }, el("span", { class: "pf-fav__n", text: String(i + 1) }), consoleChip(g.console),
      el("span", { class: "pf-fav__t", text: g.title }),
      el("button", { class: "linkbtn", type: "button", "aria-label": "Move up", text: "↑", disabled: i === 0, onclick: () => move(-1) }),
      el("button", { class: "linkbtn", type: "button", "aria-label": "Move down", text: "↓", disabled: i === favs.length - 1, onclick: () => move(1) }),
      el("button", { class: "linkbtn", type: "button", text: "Change", onclick: () => { favs[i] = null; drawFavs(); } }));
    return el("div", { class: "pf-slot pf-slot--empty" }, el("span", { class: "pf-fav__n", text: String(i + 1) }),
      gameSearch("Search for showcase game #" + (i + 1), (x) => { favs[i] = x; drawFavs(); }, (x) => favs.some((f) => f && f.id === x.id)));
  }
  drawFavs();
  const show = el("div", { class: "pf-tabpane", hidden: true }, el("p", { class: "gm-note", text: "Your top " + max + ", in order. They show as big tiles on your profile." }), favRows);

  /* --- Gamer tags --- */
  const linkIns = {};
  const tags = plus ? el("div", { class: "pf-tabpane", hidden: true },
    el("p", { class: "gm-note", text: "Type the name or tag only, not a link. The site builds the link." }),
    el("div", { class: "pf-linkedit" }, ...LINKS.map(([k, label]) => {
      linkIns[k] = el("input", { class: "gm-search pf-in", maxlength: "40", value: st.links[k] || "", placeholder: label, "aria-label": label });
      return el("label", { class: "pf-linkedit__row" }, el("span", { text: label }), linkIns[k]);
    }))) : null;

  /* --- Sections --- */
  const secs = plus ? el("div", { class: "pf-tabpane", hidden: true },
    el("p", { class: "gm-note", text: "Untick anything you'd rather keep off your profile." }),
    el("div", { class: "pf-checks" }, ...SECTIONS.map(([k, label]) => {
      const c = el("input", { type: "checkbox", checked: !st.hidden.has(k) });
      c.addEventListener("change", () => { if (c.checked) st.hidden.delete(k); else st.hidden.add(k); });
      return el("label", { class: "pf-check" }, c, el("span", { text: label }));
    })),
    (() => {
      const c = el("input", { type: "checkbox", checked: st.wall });
      c.addEventListener("change", () => { st.wall = c.checked; });
      return el("label", { class: "pf-check pf-check--wall" }, c, el("span", { text: "Let other members sign my guestbook" }));
    })()) : null;

  /* tabs */
  const panes = [["Basics", basics], ["Look", look], [me.admin ? "👑 Exclusive" : "🛡️ Exclusive", excl], ["About", about], ["Showcase", show], ["Gamer tags", tags], ["Sections", secs]].filter(([, x]) => x);
  const tabBar = el("div", { class: "pf-etabs", role: "tablist" }, ...panes.map(([label, pane], i) => el("button", { class: "pf-etab" + (i ? "" : " is-on"), type: "button", role: "tab", "aria-selected": i ? "false" : "true",
    text: label, onclick: (e) => { panes.forEach(([, x]) => { x.hidden = x !== pane; }); tabBar.querySelectorAll(".pf-etab").forEach((t) => { const on = t === e.currentTarget; t.classList.toggle("is-on", on); t.setAttribute("aria-selected", on ? "true" : "false"); }); } })));

  const save = el("button", { class: "btn gm-btn", type: "button", text: "Save profile", onclick: async () => {
    save.disabled = true; note.textContent = "Saving…";
    const a = await sb.rpc("update_my_profile", { p_name: name.value.trim(), p_avatar: st.pic || "", p_motto: motto.value.trim(), p_color: st.color, p_favs: favs.filter(Boolean).map((g) => g.id) });
    if (a.error) { save.disabled = false; note.textContent = a.error.message; sfx("error"); return; }
    if (plus) {
      const links = {}; for (const [k] of LINKS) { const v = linkIns[k].value.trim(); if (v) links[k] = v; }
      const b = await sb.rpc("update_my_profile_extras", { p: {
        bio: bio.value, pronouns: pron.value.trim(), status_emoji: st.emoji, status_text: stText.value.trim(), now_playing: st.now ? st.now.id : "",
        banner: st.banner, accent: st.accent, frame: st.frame, name_fx: st.fx, links, hidden_sections: [...st.hidden], wall_open: st.wall, pinned_badge: st.pin,
        ...(hasX ? { flair_text: flair ? flair.value.trim() : "", page_fx: st.page } : {}) } });
      if (b.error) { save.disabled = false; note.textContent = b.error.message; sfx("error"); return; }
      // RetroAchievements tag doubles as the RA account the profile card syncs from (round 20)
      if (p.ra_user !== undefined && (links.ra || null) !== (p.ra_user || null)) {
        const r = await sb.rpc("set_my_ra", { p_user: links.ra || "" });
        if (r.error) toast(r.error.message, "err");
      }
    }
    save.disabled = false;
    sfx("success"); toast("Profile saved", "ok");
    tidy("avatars", st.pic);
    if (plus) tidy("banners", typeof st.banner === "string" && st.banner.startsWith(BANNER_OK) ? st.banner : "");
    close();
    const { data: s } = await sb.auth.getSession();
    await loadMe(s.session); render();
  } });

  d.append(
    el("div", { class: "pf-dlg__head" }, el("h2", { text: "Edit profile" }), el("button", { class: "sx-x pf-x", type: "button", "aria-label": "Close", text: "✕", onclick: close })),
    pv, tabBar, ...panes.map(([, x]) => x),
    plus ? "" : el("p", { class: "gm-note", text: "Banners, colours, frames, the About box, backlog and guestbook switch on with the next database update." }),
    el("div", { class: "pf-dlg__foot" }, save, note));
  paint();
  document.body.append(d);
  d.addEventListener("close", () => d.remove());
  d.showModal();
}

subnav($("rop-tabs"), "");
onAuth(() => render());
