/* pages/games.profile.js: member profiles (/games/profile/?u=<handle>). Prefix pf-.
 * Anyone can view a profile. The owner of a profile can edit its username, picture, motto (+ colour) and 3 favourite
 * games. Saving goes through the database function update_my_profile, which checks every field again.
 */
import { sb, $, el, me, onAuth, loadMe, authPill, subnav, signIn, avatar, colorClass, COLORS, memberSince, ago, profileUrl, ownerTag, share, sfx, toast, SB_URL } from "./games.common.js?v=1";

const params = new URLSearchParams(location.search);
const wanted = (params.get("u") || "").slice(0, 40);
const root = $("pf-root");
const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");

function notice(title, body, ...extra) {
  root.replaceChildren(el("section", { class: "pf-card pf-notice" }, el("h2", { text: title }), body ? el("p", { text: body }) : null, ...extra));
}

async function render() {
  authPill($("gm-auth"), { okTail: "." });
  const handle = wanted || (me.ready && me.profile && me.profile.handle) || "";
  if (!handle) {
    if (!me.user) return notice("Your profile", "Sign in with Discord to set up your profile: a username, a picture, a motto and your 3 favourite games.",
      el("button", { class: "btn gm-btn", type: "button", onclick: signIn, text: "Sign in with Discord" }));
    return notice("Profiles are almost here", "Custom profiles switch on as soon as the site's database update goes in. Check back soon.");
  }
  if (!wanted) history.replaceState(null, "", profileUrl(handle));
  root.replaceChildren(el("p", { class: "gm-empty", text: "Loading profile…" }));
  const { data: p, error } = await sb.from("member_profiles").select("*").eq("handle", handle).maybeSingle();
  if (error) return notice("Profiles are almost here", "Custom profiles switch on as soon as the site's database update goes in. Check back soon.");
  if (!p) return notice("No one here", "That profile doesn't exist, or the member isn't around any more.", el("a", { class: "linkbtn", href: "/games/", text: "Back to Rate-O-Pedia" }));
  const mine = !!(me.profile && me.profile.handle === p.handle);
  document.title = p.name + " — Rate-O-Pedia";

  const head = el("section", { class: "pf-card pf-head" },
    avatar(p.avatar, p.name, 112, "pf-av"),
    el("div", { class: "pf-id" },
      el("h1", { class: "pf-name" }, el("span", { text: p.name }), p.is_owner ? ownerTag() : null),
      p.motto ? el("p", { class: "pf-motto " + colorClass(p.motto_color), text: "“" + p.motto + "”" }) : (mine ? el("p", { class: "pf-motto pf-motto--none", text: "No motto yet." }) : null),
      el("p", { class: "pf-since" }, el("b", { text: "Member Since: " }), memberSince(p.member_since)),
      el("ul", { class: "pf-stats" },
        el("li", null, el("b", { text: String(p.votes) }), " votes"),
        el("li", null, el("b", { text: String(p.reviews) }), " reviews"),
        el("li", null, el("b", { text: String(p.posts) }), " forum posts"),
        p.hearts != null ? el("li", null, el("b", { text: String(p.hearts) }), " hearted") : null)),
    el("div", { class: "pf-actions" },
      mine ? el("button", { class: "btn gm-btn", type: "button", text: "Edit profile", onclick: () => editor(p) }) : null,
      el("button", { class: "linkbtn", type: "button", text: "Share", onclick: () => share(profileUrl(p.handle), p.name + " on Rate-O-Pedia") })));

  const favs = Array.isArray(p.favorites) ? p.favorites : [];
  const favBox = el("section", { class: "pf-card" }, el("h2", { class: "gm-head", text: "Favourite games" }),
    favs.length
      ? el("ol", { class: "pf-favs" }, ...favs.map((g, i) => el("li", null,
          el("a", { class: "pf-fav", href: "/games/game/?id=" + encodeURIComponent(g.id) },
            el("span", { class: "pf-fav__n", text: String(i + 1) }),
            el("span", { class: "gm-console", "data-c": g.console, text: g.console }),
            el("span", { class: "pf-fav__t", text: g.title })))))
      : el("p", { class: "gm-note", text: mine ? "Pick up to 3 in Edit profile." : "No favourites picked yet." }));

  const postsBox = el("section", { class: "pf-card" }, el("h2", { class: "gm-head", text: "Recent forum posts" }), el("p", { class: "gm-empty", text: "Loading…" }));
  const revBox = el("section", { class: "pf-card" }, el("h2", { class: "gm-head", text: "Recent reviews" }), el("p", { class: "gm-empty", text: "Loading…" }));
  const heartBox = el("section", { class: "pf-card" }, el("h2", { class: "gm-head", text: "♥ Hearted games" }), el("p", { class: "gm-empty", text: "Loading…" }));
  root.replaceChildren(head, favBox, heartBox, el("div", { class: "pf-cols" }, postsBox, revBox));
  sb.from("member_hearts").select("game_id,title,console,created_at").eq("handle", p.handle).order("created_at", { ascending: false }).limit(300).then(({ data, error }) => {
    heartBox.lastChild.remove();
    if (error) { heartBox.remove(); return; }
    if (!data || !data.length) return heartBox.append(el("p", { class: "gm-note", text: mine ? "Tap the heart on any game's info card to bank it here." : "No hearted games yet." }));
    heartBox.firstChild.textContent = "♥ Hearted games (" + data.length + ")";
    heartBox.append(el("div", { class: "pf-bank" }, ...data.map((g) => el("a", { class: "pf-bank__g", href: "/games/game/?id=" + encodeURIComponent(g.game_id) },
      el("span", { class: "gm-console", "data-c": g.console, text: g.console }), el("span", { class: "pf-fav__t", text: g.title })))));
  });
  if (mine && params.has("edit")) editor(p);

  sb.from("forum_feed").select("id,title,category,created_at,comments,reaction_total").eq("handle", p.handle).order("created_at", { ascending: false }).limit(6).then(({ data }) => {
    postsBox.lastChild.remove();
    if (!data || !data.length) return postsBox.append(el("p", { class: "gm-note", text: "No posts yet." }));
    postsBox.append(el("ul", { class: "pf-list" }, ...data.map((f) => el("li", null,
      el("a", { href: "/games/forum/?p=" + f.id, text: f.title }),
      el("span", { class: "gm-note", text: " · " + ago(f.created_at) + " · " + plural(f.comments, "comment") })))));
  });
  sb.from("public_reviews").select("game_id,body,stars,created_at").eq("handle", p.handle).order("created_at", { ascending: false }).limit(6).then(async ({ data }) => {
    revBox.lastChild.remove();
    if (!data || !data.length) return revBox.append(el("p", { class: "gm-note", text: "No reviews yet." }));
    const g = await sb.from("game_scores").select("id,title,console").in("id", data.map((r) => r.game_id));
    const titles = new Map((g.data || []).map((x) => [x.id, x]));
    revBox.append(el("ul", { class: "pf-list" }, ...data.map((r) => {
      const gm = titles.get(r.game_id);
      return el("li", null,
        el("a", { href: "/games/game/?id=" + encodeURIComponent(r.game_id), text: gm ? gm.title : "A game" }),
        r.stars != null ? el("span", { class: "gm-note", text: " · " + r.stars + " / 5" }) : null,
        el("p", { class: "pf-snip", text: r.body.length > 160 ? r.body.slice(0, 157) + "…" : r.body }));
    })));
  });
}

/* ---------------- editor ---------------- */
async function toWebp(file) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height), size = Math.min(256, s);
  const c = document.createElement("canvas"); c.width = c.height = size;
  c.getContext("2d").drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);   // centre square crop
  return await new Promise((res) => c.toBlob(res, "image/webp", 0.86));
}

function editor(p) {
  const prof = me.profile || {};
  let pic = prof.custom_avatar || null;       // null = use the Discord picture
  let color = prof.motto_color || "white";
  const favs = (Array.isArray(p.favorites) ? p.favorites : []).slice(0, 3);
  while (favs.length < 3) favs.push(null);

  const d = el("dialog", { class: "sx-modal pf-dlg", "aria-label": "Edit profile" });
  const note = el("p", { class: "gm-note", role: "status" });
  const name = el("input", { class: "gm-search pf-in", maxlength: "24", value: prof.display_name || "", placeholder: prof.name || "Your Discord name", "aria-label": "Username" });
  const preview = el("span", { class: "pf-pic" });
  const showPic = () => preview.replaceChildren(avatar(pic || prof.avatar, name.value || prof.name, 84));
  showPic();
  const file = el("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif", hidden: true, onchange: async () => {
    const f = file.files && file.files[0]; if (!f) return;
    if (f.size > 8 * 1024 * 1024) { note.textContent = "That picture is over 8 MB."; return; }
    note.textContent = "Uploading…";
    try {
      const blob = await toWebp(f);
      const path = me.user.id + "/" + Date.now() + ".webp";
      const up = await sb.storage.from("avatars").upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
      if (up.error) throw up.error;
      pic = SB_URL + "/storage/v1/object/public/avatars/" + path;
      showPic(); note.textContent = "Picture ready. Press Save to keep it.";
    } catch (e) { note.textContent = "That picture didn't upload: " + (e.message || e); }
    file.value = "";
  } });

  const motto = el("input", { class: "gm-search pf-in", maxlength: "60", value: prof.motto || "", placeholder: "A line that sums you up", "aria-label": "Motto" });
  const mottoPrev = el("p", { class: "pf-motto" });
  const paintMotto = () => { mottoPrev.className = "pf-motto " + colorClass(color); mottoPrev.textContent = motto.value.trim() ? "“" + motto.value.trim() + "”" : "Your motto shows here, and on the leaderboard."; };
  motto.addEventListener("input", paintMotto);
  const swatches = el("div", { class: "pf-sw", role: "radiogroup", "aria-label": "Motto colour" }, ...COLORS.map(([k, label]) => {
    const b = el("button", { type: "button", class: "pf-sw__b " + colorClass(k) + (k === color ? " is-on" : ""), role: "radio", "aria-checked": k === color ? "true" : "false", title: label, "aria-label": label,
      onclick: () => { color = k; swatches.querySelectorAll(".pf-sw__b").forEach((x) => { const on = x === b; x.classList.toggle("is-on", on); x.setAttribute("aria-checked", on ? "true" : "false"); }); paintMotto(); } });
    return b;
  }));
  paintMotto();

  const favRows = el("div", { class: "pf-favedit" });
  const drawFavs = () => favRows.replaceChildren(...favs.map((g, i) => favSlot(i)));
  function favSlot(i) {
    const g = favs[i];
    if (g) return el("div", { class: "pf-slot" }, el("span", { class: "pf-fav__n", text: String(i + 1) }), el("span", { class: "gm-console", "data-c": g.console, text: g.console }),
      el("span", { class: "pf-fav__t", text: g.title }), el("button", { class: "linkbtn", type: "button", text: "Change", onclick: () => { favs[i] = null; drawFavs(); } }));
    const q = el("input", { class: "gm-search pf-in", type: "search", placeholder: "Search for favourite #" + (i + 1), "aria-label": "Favourite game " + (i + 1) });
    const res = el("div", { class: "pf-res" });
    let t = 0;
    q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(async () => {
      const s = q.value.trim(); if (s.length < 2) { res.replaceChildren(); return; }
      const { data } = await sb.from("game_scores").select("id,title,console").ilike("title", "%" + s.replace(/[%_]/g, " ") + "%").order("votes", { ascending: false }).limit(8);
      res.replaceChildren(...(data || []).filter((x) => !favs.some((f) => f && f.id === x.id)).map((x) =>
        el("button", { type: "button", class: "pf-res__b", onclick: () => { favs[i] = x; drawFavs(); } }, el("span", { class: "gm-console", "data-c": x.console, text: x.console }), " " + x.title)));
      if (!res.children.length) res.append(el("p", { class: "gm-note", text: "No match. You can add missing games on the Ratings page." }));
    }, 220); });
    return el("div", { class: "pf-slot pf-slot--empty" }, el("span", { class: "pf-fav__n", text: String(i + 1) }), el("div", { class: "pf-slot__q" }, q, res));
  }
  drawFavs();

  const save = el("button", { class: "btn gm-btn", type: "button", text: "Save profile", onclick: async () => {
    save.disabled = true; note.textContent = "Saving…";
    const { error } = await sb.rpc("update_my_profile", { p_name: name.value.trim(), p_avatar: pic || "", p_motto: motto.value.trim(), p_color: color, p_favs: favs.filter(Boolean).map((g) => g.id) });
    save.disabled = false;
    if (error) { note.textContent = error.message; sfx("error"); return; }
    sfx("success"); toast("Profile saved", "ok");
    // tidy: keep only the picture in use in this member's storage folder
    try { const ls = await sb.storage.from("avatars").list(me.user.id); const keep = pic ? pic.split("/").pop() : ""; const old = (ls.data || []).map((o) => o.name).filter((n) => n !== keep); if (old.length) await sb.storage.from("avatars").remove(old.map((n) => me.user.id + "/" + n)); } catch (e) {}
    d.close(); d.remove();
    const { data: s } = await sb.auth.getSession();
    await loadMe(s.session); render();
  } });

  d.append(
    el("div", { class: "pf-dlg__head" }, el("h2", { text: "Edit profile" }), el("button", { class: "sx-x pf-x", type: "button", "aria-label": "Close", text: "✕", onclick: () => { d.close(); d.remove(); } })),
    el("label", { class: "pf-lab", text: "Username" }), name,
    el("p", { class: "gm-note", text: "2 to 24 letters, numbers, spaces, _ . or -. Leave empty to use your Discord name." }),
    el("label", { class: "pf-lab", text: "Profile picture" }),
    el("div", { class: "pf-picrow" }, preview,
      el("button", { class: "btn gm-btn", type: "button", text: "Upload a picture", onclick: () => file.click() }),
      el("button", { class: "linkbtn", type: "button", text: "Use my Discord picture", onclick: () => { pic = null; showPic(); } }), file),
    el("label", { class: "pf-lab", text: "Motto" }), motto, swatches, mottoPrev,
    el("label", { class: "pf-lab", text: "Favourite 3 games" }), favRows,
    el("div", { class: "pf-dlg__foot" }, save, note));
  name.addEventListener("input", showPic);
  document.body.append(d);
  d.addEventListener("close", () => d.remove());
  d.showModal();
}

subnav($("rop-tabs"), wanted && !(me.profile && me.profile.handle === wanted) ? "" : "profile");
onAuth((m) => {
  subnav($("rop-tabs"), !wanted || (m.profile && m.profile.handle === wanted) ? "profile" : "");
  render();
});
