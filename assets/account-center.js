/* account-center.js — the site-wide Account settings center. Opens from the header profile chip on any page.
 *
 * One place for everything about a member's account: Profile, Look & cosmetics, Privacy, Notifications,
 * Friends & messages, and Account/security. Backed by the Rate-O-Pedia social backend (SQL 33 + 28/31/32),
 * contract at /mnt/project-files/site-hub/rateopedia/SOCIAL_SETTINGS_API.md. One editor, one backend:
 * every text / toggle / pick field goes through set_my_settings(p); the heavy pieces (avatar & banner upload,
 * the showcase picker, the badge grid, the full preset galleries, DMs) deep-link to /games/profile/?edit and
 * /games/buddies/, which stay canonical.
 *
 * Gated behind Site.config.features.accounts (opt-in, default OFF). Loaded only when that flag is on
 * (see the add-on loader in interact.js). Degrades to a friendly "almost ready" state if the RPCs aren't
 * live yet (SQL 33 runs with the owner's go-live steps).
 */
(function () {
  "use strict";
  if (!window.Site) return;
  var el = Site.el, svg = Site.svg;
  var SB = Site.sb || {};
  var ACCENTS = { maroon: "#cd4257", white: "#e8eaed", gray: "#8a94a6", red: "#e5484d", orange: "#f2792b", gold: "#d9a441", yellow: "#e7c94a", green: "#36d39a", teal: "#2bb6c4", blue: "#3d8bff", purple: "#a06cff", pink: "#ff74c3" };
  var ACCENT_ORDER = ["maroon", "white", "gray", "red", "orange", "gold", "yellow", "green", "teal", "blue", "purple", "pink"];
  var MOTTO_ORDER = ["white", "gray", "red", "orange", "gold", "yellow", "green", "teal", "blue", "purple", "pink"];
  var NOTIFY = [
    ["follow", "New followers"], ["buddy", "Buddy requests & accepts"], ["dm", "Direct messages"],
    ["wall", "Posts on my wall"], ["reply", "Replies to me"], ["reaction", "Reactions to my posts"], ["review_reaction", "Reactions to my reviews"]
  ];

  /* ---------- lazy Supabase client (shared pattern with sync.js) ---------- */
  var SUPA_REF = (String(SB.url || "").match(/^https:\/\/([a-z0-9-]+)\.supabase/i) || [])[1] || "";
  var AUTH_LS = SUPA_REF ? "sb-" + SUPA_REF + "-auth-token" : "";
  var _sb = null, _sbLoad = null;
  function supa() {
    if (_sb) return Promise.resolve(_sb);
    if (_sbLoad) return _sbLoad;
    if (!SB.url || !SB.key) return Promise.resolve(null);
    _sbLoad = import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")
      .then(function (m) { _sb = m.createClient(SB.url, SB.key); return _sb; })
      .catch(function () { return null; });
    return _sbLoad;
  }
  function hasSession() {
    if (!AUTH_LS) return false;
    try { var raw = localStorage.getItem(AUTH_LS); if (!raw) return false; var s = JSON.parse(raw); var sess = (s && s.currentSession) || s; return !!(sess && sess.access_token); } catch (e) { return false; }
  }
  function rpc(fn, args) { return supa().then(function (sb) { if (!sb) return { error: { message: "offline" } }; return sb.rpc(fn, args || {}); }); }

  /* ---------- state ---------- */
  var S = null;          /* the last my_settings() result */
  var dlg = null, paneEl = null, tabsEl = null, savedEl = null;
  var activeTab = "profile";
  var loadingState = "idle"; /* idle | loading | ready | error */

  /* ---------- small helpers ---------- */
  function field(label, controlNode, hint) {
    var w = el("label", { class: "ac2-field" }, el("span", { class: "ac2-flabel", text: label }), controlNode);
    if (hint) w.appendChild(el("span", { class: "ac2-fhint", text: hint }));
    return w;
  }
  function input(value, attrs) { var i = el("input", Object.assign({ class: "ac2-input", type: "text", value: value == null ? "" : value }, attrs || {})); return i; }
  function textarea(value, attrs) { var t = el("textarea", Object.assign({ class: "ac2-input ac2-textarea", rows: "3" }, attrs || {})); t.value = value == null ? "" : value; return t; }
  function toggle(on, onChange) {
    var b = el("button", { type: "button", class: "ac2-toggle", role: "switch", "aria-checked": on ? "true" : "false" }, el("span", { class: "ac2-toggle__dot" }));
    b.addEventListener("click", function () { var v = b.getAttribute("aria-checked") !== "true"; b.setAttribute("aria-checked", v ? "true" : "false"); onChange(v); });
    return b;
  }
  function segmented(options, current, onPick) {
    var row = el("div", { class: "ac2-seg", role: "group" });
    options.forEach(function (o) {
      var b = el("button", { type: "button", class: "ac2-seg__b", "data-v": o.value, "aria-pressed": o.value === current ? "true" : "false", text: o.label });
      b.addEventListener("click", function () {
        row.querySelectorAll(".ac2-seg__b").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true"); onPick(o.value);
      });
      row.appendChild(b);
    });
    return row;
  }
  function flashSaved(ok, msg) {
    if (!savedEl) return;
    savedEl.textContent = msg || (ok ? "Saved ✓" : "Couldn't save");
    savedEl.className = "ac2-saved " + (ok ? "is-ok" : "is-err") + " is-show";
    clearTimeout(savedEl._t); savedEl._t = setTimeout(function () { savedEl.classList.remove("is-show"); }, 1800);
  }
  function savingNow() { if (savedEl) { savedEl.textContent = "Saving…"; savedEl.className = "ac2-saved is-show"; } }

  /* ---------- persistence: send a patch, merge the returned full state ---------- */
  var saveQueue = Promise.resolve();
  function save(patch) {
    savingNow();
    saveQueue = saveQueue.then(function () {
      return rpc("set_my_settings", { p: patch }).then(function (res) {
        var d = res && res.data, err = res && res.error;
        if (err || (d && d.ok === false)) { flashSaved(false, (d && d.error) || "Couldn't save — try again"); return; }
        if (d && d.ok) { S = d; mirrorPreview(); flashSaved(true); }
      }).catch(function () { flashSaved(false, "Couldn't save — check your connection"); });
    });
    return saveQueue;
  }
  /* debounced text saver keyed by a path label */
  var tTimers = {};
  function saveTextLater(key, patch) { clearTimeout(tTimers[key]); tTimers[key] = setTimeout(function () { save(patch); }, 650); }

  /* ---------- live preview card (profile tab) ---------- */
  var preview = null;
  function mirrorPreview() {
    if (!preview || !S) return;
    var p = S.profile || {}, a = S.account || {};
    var accent = ACCENTS[p.accent] || ACCENTS.maroon;
    preview.style.setProperty("--ac2-accent", accent);
    var name = p.name || p.discord_name || a.handle || "You";
    preview.querySelector(".ac2-pv__name").textContent = name;
    preview.querySelector(".ac2-pv__handle").textContent = a.handle ? "@" + a.handle : "";
    var motto = preview.querySelector(".ac2-pv__motto");
    motto.textContent = p.motto || "";
    motto.style.color = p.motto_color && ACCENTS[p.motto_color] ? ACCENTS[p.motto_color] : "";
    var av = preview.querySelector(".ac2-pv__av");
    av.replaceChildren();
    if (p.avatar) { av.classList.remove("is-initial"); av.appendChild(el("img", { class: "ac2-pv__img", src: p.avatar, alt: "" })); }
    else { av.classList.add("is-initial"); av.textContent = (name.replace(/[^A-Za-z0-9]/g, "")[0] || "★").toUpperCase(); }
    var status = preview.querySelector(".ac2-pv__status");
    var st = [p.status_emoji, p.status_text].filter(Boolean).join(" ");
    status.textContent = st; status.hidden = !st;
    var flair = preview.querySelector(".ac2-pv__flair");
    flair.textContent = a.flair ? a.flair.toUpperCase() : ""; flair.hidden = !a.flair;
  }

  /* ========================================================================== TABS */
  var TABS = [
    { id: "profile", label: "Profile", icon: "M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-5 0-9 2.5-9 6v2h18v-2c0-3.5-4-6-9-6Z" },
    { id: "look", label: "Look", icon: "M12 3a9 9 0 1 0 0 18c1 0 1.7-.8 1.7-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7Zm-5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" },
    { id: "privacy", label: "Privacy", icon: "M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5l-8-3Zm0 6a2.5 2.5 0 0 1 2.5 2.5c0 1-.6 1.9-1.5 2.3V15h-2v-2.2a2.5 2.5 0 0 1-1.5-2.3A2.5 2.5 0 0 1 12 8Z" },
    { id: "notify", label: "Alerts", icon: "M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6-1.5-1.8V9.5A5.5 5.5 0 0 0 13 4.1V3.5a1 1 0 1 0-2 0v.6A5.5 5.5 0 0 0 6.5 9.5v4.7L5 16a1 1 0 0 0 .8 1.6h12.4A1 1 0 0 0 19 16Z" },
    { id: "social", label: "Friends", icon: "M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 2c-3 0-6 1.5-6 4v2h8v-2c0-1 .3-1.9.9-2.7A8.5 8.5 0 0 0 8 13Zm8 0c-.5 0-1 0-1.4.1.9.9 1.4 1.9 1.4 3.2V20h8v-2c0-2.5-3-4-6-4Z" },
    { id: "account", label: "Account", icon: "M19.4 13a7.8 7.8 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1l-.4-2.6H9.1l-.4 2.6a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4L2.6 11a7.8 7.8 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1l.4 2.6h5.8l.4-2.6a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4L19.4 13ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" }
  ];

  function renderTabs() {
    tabsEl.replaceChildren();
    TABS.forEach(function (t) {
      var b = el("button", { type: "button", class: "ac2-tab" + (t.id === activeTab ? " is-on" : ""), "data-tab": t.id, "aria-selected": t.id === activeTab ? "true" : "false" },
        svgPath(t.icon), el("span", { text: t.label }));
      if (t.id === "social") { var badge = el("span", { class: "ac2-tab__badge", hidden: true }); b._badge = badge; b.appendChild(badge); }
      b.addEventListener("click", function () { activeTab = t.id; renderTabs(); renderPane(); });
      tabsEl.appendChild(b);
    });
    paintSocialBadge();
  }
  function svgPath(d) { var s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); var p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("fill", "currentColor"); p.setAttribute("d", d); s.appendChild(p); return s; }

  function paintSocialBadge() {
    var tab = tabsEl && tabsEl.querySelector('.ac2-tab[data-tab="social"]');
    if (!tab || !tab._badge || !S) return;
    var c = S.counts || {}, n = (c.unread_messages || 0) + (c.requests || 0);
    tab._badge.hidden = !n; tab._badge.textContent = n > 99 ? "99+" : String(n);
  }

  /* ---------- the content pane ---------- */
  function renderPane() {
    paneEl.replaceChildren();
    if (loadingState === "loading") { paneEl.appendChild(el("p", { class: "ac2-empty", text: "Loading your settings…" })); return; }
    if (loadingState === "error") {
      paneEl.appendChild(el("div", { class: "ac2-notready" },
        el("h3", { text: "Settings aren't live yet" }),
        el("p", { text: "Account settings switch on with the rest of the DMA Account rollout. Check back soon." }),
        el("a", { class: "btn ghost", href: "/account/", text: "Go to your account" })));
      return;
    }
    ({ profile: tabProfile, look: tabLook, privacy: tabPrivacy, notify: tabNotify, social: tabSocial, account: tabAccount })[activeTab]();
  }

  /* ---------- PROFILE ---------- */
  function tabProfile() {
    var p = S.profile || {}, a = S.account || {};
    /* live preview */
    preview = el("div", { class: "ac2-pv" },
      el("div", { class: "ac2-pv__av is-initial", "aria-hidden": "true" }),
      el("div", { class: "ac2-pv__who" },
        el("div", { class: "ac2-pv__line" }, el("span", { class: "ac2-pv__name" }), el("span", { class: "ac2-pv__flair", hidden: true })),
        el("div", { class: "ac2-pv__handle" }),
        el("div", { class: "ac2-pv__motto" }),
        el("div", { class: "ac2-pv__status", hidden: true })));
    paneEl.appendChild(preview);
    mirrorPreview();

    var nameI = input(p.name, { maxlength: "24", placeholder: p.discord_name || "Your display name" });
    nameI.addEventListener("input", function () { saveTextLater("name", { profile: { name: nameI.value.trim() || null } }); });
    paneEl.appendChild(field("Display name", nameI, p.name ? "" : "Blank shows your Discord name."));

    var pronI = input(p.pronouns, { maxlength: "24", placeholder: "she/her, they/them…" });
    pronI.addEventListener("input", function () { saveTextLater("pronouns", { profile: { pronouns: pronI.value.trim() } }); });
    paneEl.appendChild(field("Pronouns", pronI));

    var emo = input(p.status_emoji, { maxlength: "4", placeholder: "🎮", class: "ac2-input ac2-input--emoji" });
    var stx = input(p.status_text, { maxlength: "60", placeholder: "What you're up to" });
    emo.addEventListener("input", function () { saveTextLater("status", { profile: { status_emoji: emo.value.trim(), status_text: stx.value.trim() } }); });
    stx.addEventListener("input", function () { saveTextLater("status", { profile: { status_emoji: emo.value.trim(), status_text: stx.value.trim() } }); });
    paneEl.appendChild(field("Status", el("div", { class: "ac2-row2" }, emo, stx)));

    var mot = input(p.motto, { maxlength: "60", placeholder: "A short line about you" });
    mot.addEventListener("input", function () { saveTextLater("motto", { profile: { motto: mot.value.trim() } }); });
    var motWrap = field("Motto", mot);
    motWrap.appendChild(swatches(MOTTO_ORDER, p.motto_color, function (v) { save({ profile: { motto_color: v } }); }, "motto colour"));
    paneEl.appendChild(motWrap);

    var bioT = textarea(p.bio, { maxlength: "600", rows: "4", placeholder: "Tell people about yourself (up to 600 characters)" });
    bioT.addEventListener("input", function () { saveTextLater("bio", { profile: { bio: bioT.value } }); });
    paneEl.appendChild(field("Bio", bioT));

    var np = input(p.now_playing, { maxlength: "80", placeholder: "What you're playing right now" });
    np.addEventListener("input", function () { saveTextLater("np", { profile: { now_playing: np.value.trim() } }); });
    paneEl.appendChild(field("Now playing", np));

    paneEl.appendChild(field("Accent colour", swatches(ACCENT_ORDER, p.accent, function (v) { save({ profile: { accent: v } }); }, "accent")));

    paneEl.appendChild(deepLink("/games/profile/?edit", "Edit avatar, banner, showcase games & pinned badges on your profile →"));
  }
  function swatches(order, current, onPick, label) {
    var row = el("div", { class: "ac2-swatches", role: "group", "aria-label": label || "colour" });
    order.forEach(function (name) {
      var b = el("button", { type: "button", class: "ac2-swatch" + (name === current ? " is-on" : ""), title: name, "aria-label": name, "aria-pressed": name === current ? "true" : "false" });
      b.style.background = ACCENTS[name]; if (name === "white") b.style.borderColor = "rgba(0,0,0,.25)";
      b.addEventListener("click", function () { row.querySelectorAll(".ac2-swatch").forEach(function (x) { x.classList.remove("is-on"); x.setAttribute("aria-pressed", "false"); }); b.classList.add("is-on"); b.setAttribute("aria-pressed", "true"); onPick(name); });
      row.appendChild(b);
    });
    return row;
  }

  /* ---------- LOOK & COSMETICS ---------- */
  function tabLook() {
    paneEl.appendChild(el("p", { class: "ac2-lead", text: "Cosmetics you've earned. Equip them here; the full banner, frame and name-style galleries live on your profile." }));
    var list = el("div", { class: "ac2-rewards" }, el("p", { class: "ac2-empty", text: "Loading cosmetics…" }));
    paneEl.appendChild(list);
    paneEl.appendChild(deepLink("/games/profile/?edit", "Open the full look editor on your profile →"));
    rpc("my_rewards").then(function (res) {
      var d = res && res.data;
      list.replaceChildren();
      if (!d || d.ok === false || !Array.isArray(d.rewards)) { list.appendChild(el("p", { class: "ac2-empty", text: "No cosmetics yet — earn them through rewards." })); return; }
      var cos = d.rewards.filter(function (r) { return r.kind === "banner" || r.kind === "frame" || r.kind === "name_fx"; });
      if (!cos.length) { list.appendChild(el("p", { class: "ac2-empty", text: "No cosmetics yet — earn them through rewards." })); return; }
      cos.forEach(function (r) { list.appendChild(rewardRow(r)); });
    }).catch(function () { list.replaceChildren(el("p", { class: "ac2-empty", text: "Couldn't load cosmetics right now." })); });
  }
  function rewardRow(r) {
    var row = el("div", { class: "ac2-reward" + (r.equipped ? " is-on" : "") },
      el("span", { class: "ac2-reward__kind", text: (r.kind || "").replace("_", " ") }),
      el("span", { class: "ac2-reward__name", text: r.name || r.value || r.id }));
    var btn = el("button", { type: "button", class: "btn ghost ac2-reward__btn", text: r.equipped ? "Equipped" : "Equip" });
    if (r.equipped) btn.classList.add("is-on");
    btn.addEventListener("click", function () {
      var on = !row.classList.contains("is-on"); btn.disabled = true;
      rpc("equip_reward", { p_id: r.id, p_on: on }).then(function (res) {
        btn.disabled = false; var d = res && res.data;
        if (!d || d.ok === false) { flashSaved(false, "Couldn't change that"); return; }
        row.classList.toggle("is-on", !!d.equipped); btn.textContent = d.equipped ? "Equipped" : "Equip"; btn.classList.toggle("is-on", !!d.equipped);
        flashSaved(true);
      }).catch(function () { btn.disabled = false; flashSaved(false, "Couldn't change that"); });
    });
    row.appendChild(btn);
    return row;
  }

  /* ---------- PRIVACY ---------- */
  function tabPrivacy() {
    var pv = S.privacy || {};
    paneEl.appendChild(el("p", { class: "ac2-lead", text: "Quick presets set everything below in one tap. Fine-tune anything underneath." }));
    var presets = el("div", { class: "ac2-presets" });
    [["Private", { searchable: false, dm_policy: "nobody", buddies_public: false, show_online: false, buddy_requests: "nobody", wall_open: false }],
     ["Friends only", { searchable: true, dm_policy: "buddies", buddies_public: false, show_online: true, buddy_requests: "everyone", wall_open: false }],
     ["Public", { searchable: true, dm_policy: "everyone", buddies_public: true, show_online: true, buddy_requests: "everyone", wall_open: true }]
    ].forEach(function (pr) {
      var b = el("button", { type: "button", class: "ac2-preset", text: pr[0] });
      b.addEventListener("click", function () { save({ privacy: pr[1] }).then(function () { renderPane(); }); });
      presets.appendChild(b);
    });
    paneEl.appendChild(presets);

    paneEl.appendChild(toggleRow("Show up in search", "Let other members find you by name or handle.", !!pv.searchable, function (v) { save({ privacy: { searchable: v } }); }));
    paneEl.appendChild(choiceRow("Who can message me", [{ value: "everyone", label: "Everyone" }, { value: "buddies", label: "Buddies" }, { value: "nobody", label: "Nobody" }], pv.dm_policy || "buddies", function (v) { save({ privacy: { dm_policy: v } }); }));
    paneEl.appendChild(choiceRow("Who can add me as a buddy", [{ value: "everyone", label: "Everyone" }, { value: "nobody", label: "Nobody" }], pv.buddy_requests || "everyone", function (v) { save({ privacy: { buddy_requests: v } }); }));
    paneEl.appendChild(toggleRow("Public buddies list", "Let anyone see who your buddies are.", !!pv.buddies_public, function (v) { save({ privacy: { buddies_public: v } }); }));
    paneEl.appendChild(toggleRow("Show when I'm online", "Buddies see a dot when you're active.", pv.show_online !== false, function (v) { save({ privacy: { show_online: v } }); }));
    paneEl.appendChild(toggleRow("Open profile wall", "Let buddies post on your wall.", !!pv.wall_open, function (v) { save({ privacy: { wall_open: v } }); }));
  }
  function toggleRow(label, hint, on, onChange) {
    return el("div", { class: "ac2-settingrow" },
      el("div", { class: "ac2-settingrow__text" }, el("span", { class: "ac2-settingrow__label", text: label }), hint ? el("span", { class: "ac2-settingrow__hint", text: hint }) : null),
      toggle(on, onChange));
  }
  function choiceRow(label, options, current, onPick) {
    return el("div", { class: "ac2-settingrow ac2-settingrow--seg" },
      el("div", { class: "ac2-settingrow__text" }, el("span", { class: "ac2-settingrow__label", text: label })),
      segmented(options, current, onPick));
  }

  /* ---------- NOTIFICATIONS ---------- */
  function tabNotify() {
    var n = S.notify || {};
    paneEl.appendChild(el("p", { class: "ac2-lead", text: "Choose what pings you. Turning one off mutes just that kind." }));
    NOTIFY.forEach(function (row) {
      paneEl.appendChild(toggleRow(row[1], "", n[row[0]] !== false, function (v) { var patch = { notify: {} }; patch.notify[row[0]] = v; save(patch); }));
    });
  }

  /* ---------- FRIENDS & MESSAGES ---------- */
  function tabSocial() {
    var c = S.counts || {};
    var grid = el("div", { class: "ac2-counts" });
    [["Buddies", c.buddies || 0, "/games/buddies/"], ["Requests", c.requests || 0, "/games/buddies/?tab=requests"], ["Opps", c.opps || 0, "/games/buddies/?tab=opps"], ["Unread DMs", c.unread_messages || 0, "/games/buddies/?tab=messages"]]
      .forEach(function (s) {
        grid.appendChild(el("a", { class: "ac2-count", href: s[2] }, el("b", { text: Site.fmtNum(s[1]) }), el("span", { text: s[0] })));
      });
    paneEl.appendChild(grid);
    paneEl.appendChild(el("div", { class: "ac2-social-cta" },
      el("a", { class: "btn", href: "/games/buddies/", text: "Open Friends & Messages" }),
      el("a", { class: "btn ghost", href: "/games/buddies/?tab=requests", text: "Buddy requests" })));
    paneEl.appendChild(el("p", { class: "ac2-fine", text: "Conversations, buddy lists and requests all live on the Friends page." }));
  }

  /* ---------- ACCOUNT & SECURITY ---------- */
  function tabAccount() {
    var a = S.account || {};
    var facts = el("div", { class: "ac2-facts" });
    if (a.verified) facts.appendChild(factChip("Verified", "ok"));
    if (a.supporter) facts.appendChild(factChip("Supporter 💛", "gold"));
    if (a.has_dma) facts.appendChild(factChip("DMA login", "plain"));
    if (a.has_discord) facts.appendChild(factChip("Discord linked", "plain"));
    if (a.cooldown_until) facts.appendChild(factChip("New account", "warn"));
    if (a.restricted) facts.appendChild(factChip("Restricted", "err"));
    if (facts.childNodes.length) paneEl.appendChild(facts);
    if (a.member_since) paneEl.appendChild(el("p", { class: "ac2-fine", text: "Member since " + Site.fmtDate(a.member_since) + "." }));

    /* handle */
    var canChange = !a.handle_claimed_at || daysSince(a.handle_claimed_at) >= 30;
    var hi = input(a.handle, { maxlength: "20", placeholder: "yourhandle", autocapitalize: "off", spellcheck: "false" });
    var hmsg = el("span", { class: "ac2-fhint" });
    hi.disabled = !canChange;
    var hbtn = el("button", { type: "button", class: "btn ghost", text: "Change", disabled: !canChange });
    hbtn.addEventListener("click", function () {
      var v = hi.value.trim(); if (!/^[A-Za-z0-9_]{3,20}$/.test(v)) { hmsg.textContent = "3–20 letters, numbers or _"; hmsg.className = "ac2-fhint is-warn"; return; }
      hbtn.disabled = true; hmsg.textContent = "Saving…"; hmsg.className = "ac2-fhint";
      save({ handle: v }).then(function () { hbtn.disabled = false; hmsg.textContent = S && S.account && S.account.handle === v ? "Handle updated ✓" : "Handle change requested"; hmsg.className = "ac2-fhint is-ok"; });
    });
    var hf = field("Handle", el("div", { class: "ac2-row2" }, hi, hbtn), canChange ? "You can change this once every 30 days." : "You can change your handle again " + Site.fmtDate(addDays(a.handle_claimed_at, 30)) + ".");
    hf.appendChild(hmsg);
    paneEl.appendChild(hf);

    /* flair (needs 32) */
    if (a.has_dma || a.has_discord) {
      var choices = [];
      if (a.has_discord) choices.push({ value: "discord", label: "Discord" });
      if (a.has_dma) choices.push({ value: "dma", label: "DMA" });
      if (a.has_dma && a.has_discord) choices.push({ value: "both", label: "Both" });
      paneEl.appendChild(choiceRow("Profile flair", choices, a.flair || (a.has_dma ? "dma" : "discord"), function (v) { save({ flair: v }); }));
    }

    paneEl.appendChild(deepLink("/account/", "Password, linked logins and 2FA on your account page →"));
    var out = el("button", { type: "button", class: "btn ghost ac2-signout", text: "Sign out" });
    out.addEventListener("click", function () { supa().then(function (sb) { if (sb) sb.auth.signOut().then(afterSignOut).catch(afterSignOut); else afterSignOut(); }); });
    paneEl.appendChild(out);
  }
  function factChip(text, kind) { return el("span", { class: "ac2-fact ac2-fact--" + kind, text: text }); }
  function afterSignOut() { try { if (AUTH_LS) localStorage.removeItem(AUTH_LS); } catch (e) {} Site.toast("Signed out.", { type: "info" }); close(); try { Site.emit("sync:changed"); } catch (e) {} location.reload(); }

  function deepLink(href, text) { return el("a", { class: "ac2-deeplink", href: href }, el("span", { text: text })); }
  function daysSince(iso) { try { return (Date.now() - new Date(iso).getTime()) / 86400000; } catch (e) { return 999; } }
  function addDays(iso, n) { try { return new Date(new Date(iso).getTime() + n * 86400000).toISOString(); } catch (e) { return iso; } }

  /* ========================================================================== open / close */
  function open(tab) {
    if (!hasSession()) { return false; }
    activeTab = tab || "profile";
    if (dlg) { Site.dialog.close(dlg); dlg.remove(); dlg = null; }
    var shell = el("div", { class: "ac2-shell" });
    tabsEl = el("nav", { class: "ac2-tabs", "aria-label": "Settings sections" });
    paneEl = el("div", { class: "ac2-pane" });
    savedEl = el("span", { class: "ac2-saved" });
    shell.appendChild(tabsEl);
    shell.appendChild(el("div", { class: "ac2-main" }, paneEl, savedEl));
    dlg = Site.modal({ id: "ac2", title: "Account settings", className: "ac2-modal", wide: true, body: shell });
    dlg.addEventListener("close", function () { dlg && dlg.remove(); dlg = null; });
    renderTabs();
    loadingState = "loading"; renderPane();
    Site.dialog.open(dlg);
    rpc("my_settings").then(function (res) {
      var d = res && res.data;
      if (!d || d.ok === false || !d.profile) { loadingState = "error"; renderPane(); return; }
      S = d; loadingState = "ready"; renderPane(); paintSocialBadge(); pushChipFromSettings();
    }).catch(function () { loadingState = "error"; renderPane(); });
    return true;
  }
  function close() { if (dlg) { Site.dialog.close(dlg); } }

  /* reflect the freshest name/avatar/accent/flair onto the header chip via sync's profile cache event */
  function pushChipFromSettings() {
    if (!S) return;
    try { Site.emit("account:settings", S); } catch (e) {}
  }

  /* ---------- header unread badge (poll dm_unread ~60s while signed in) ---------- */
  var badgeEl = null, pollT = 0;
  function ensureBadge() {
    var chip = document.querySelector(".sy-profile"); if (!chip) return null;
    if (badgeEl && chip.contains(badgeEl)) return badgeEl;
    badgeEl = el("span", { class: "ac2-chipbadge", hidden: true, "aria-hidden": "true" });
    chip.appendChild(badgeEl); chip.classList.add("sy-profile--hasbadge");
    return badgeEl;
  }
  function pollUnread() {
    if (!hasSession()) return;
    rpc("dm_unread").then(function (res) {
      var n = res && typeof res.data === "number" ? res.data : 0;
      var b = ensureBadge(); if (!b) return;
      b.hidden = !n; b.textContent = n > 9 ? "9+" : String(n);
      var chip = document.querySelector(".sy-profile"); if (chip) chip.setAttribute("aria-label", (chip.getAttribute("aria-label") || "Profile").replace(/ · \d+ unread.*/, "") + (n ? " · " + n + " unread" : ""));
    }).catch(function () {});
  }
  function startPolling() {
    if (pollT || !hasSession()) return;
    pollUnread();
    pollT = setInterval(function () { if (!document.hidden) pollUnread(); }, 60000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) pollUnread(); });
  }

  /* ---------- wire up ---------- */
  Site.accountCenter = { open: open, close: close };
  Site.ready(function () {
    /* give the profile chip time to mount (sync.js), then attach the unread badge + poll */
    setTimeout(startPolling, 2000);
  }, "account-center");
})();
