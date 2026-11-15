/* sync.js — cross-device account sync, loaded on every page by assets/interact.js (prefix sy-).
 *
 * The idea: sign in with Discord once on your Rate-O-Pedia profile and it shows a secret sync code
 * (XXXX-XXXX-XXXX-XXXX). Paste that code into the "Link account" box on ANY page here and this browser
 * is linked — your trophies (and arcade progress, once the games side plugs in) follow you across devices.
 *
 * The account, the code and the cloud storage all live on the Rate-O-Pedia / Supabase side. This file only
 * talks to three public RPCs with the site's publishable key (meant to be public):
 *   sync_pull(p_code)            -> { ok, state:{ trophies:{id->ts}, arcade:{...}, ... }, handle }
 *   sync_push(p_code,p_ns,p_patch) shallow-merges a patch into one namespace -> { ok, state:<section> }
 *   (signed-in only, on the profile: my_sync_code / sync_regenerate — not called from here)
 *
 * Safety: syncing is MERGE-ONLY. A pull folds remote trophies in (earliest timestamp wins, nothing removed);
 * a push adds this browser's trophies up. So a leaked code can never wipe anyone's progress. On a bad code we
 * stop and ask the user to re-enter — we never retry automatically (the backend rate-limits wrong codes).
 */
(function () {
  "use strict";
  if (!window.Site || window.Site.__syncLoaded) return;
  var Site = window.Site; Site.__syncLoaded = true;
  var el = Site.el, svg = Site.svg, doc = document;
  var SB = Site.sb || {};
  function feat(name) { var f = (Site.config && Site.config.features) || {}; return f[name] !== false; }
  if (!feat("sync")) return;

  var CODE_KEY = "syncCode", HANDLE_KEY = "syncHandle";
  var LINK = '<path d="M9.5 14.5 14.5 9.5"/><path d="M11 7l1.2-1.2a3.5 3.5 0 0 1 5 5L16 12"/><path d="M13 17l-1.2 1.2a3.5 3.5 0 0 1-5-5L8 12"/>';
  var PERSON = '<circle cx="12" cy="8.2" r="3.6"/><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0"/>';

  function code() { return String(Site.store.get(CODE_KEY, "") || ""); }
  function linked() { return !!code(); }
  function handle() { return String(Site.store.get(HANDLE_KEY, "") || ""); }
  /* The display form: letters/digits only, upper-cased, grouped in fours. Input is forgiving — the backend
     normalizes too, so lowercase or missing dashes are fine; we just tidy what we store and show. */
  function normalize(raw) { return String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
  function pretty(raw) { var s = normalize(raw); return s.replace(/(.{4})(?=.)/g, "$1-"); }

  function rpc(name, body) {
    if (!SB.url || !SB.key || !window.fetch) return Promise.reject("offline");
    return fetch(SB.url + "/rest/v1/rpc/" + name, {
      method: "POST", keepalive: true,
      headers: { apikey: SB.key, Authorization: "Bearer " + SB.key, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (r.status === 404) return { ok: false, error: "unset" };   /* RPCs not deployed yet: feature simply idle */
      if (!r.ok) throw r.status;
      return r.json();
    });
  }

  /* ---- namespaces ----
     trophies is wired here. Any other part of the site (the arcade games) can push its own namespace with
     Site.sync.push(ns, patch) and receive merged remote state via Site.on("sync:pulled", {ns, state}). */
  function applyNs(ns, state) {
    if (ns === "trophies") { if (Site.trophy && Site.trophy.merge) Site.trophy.merge(state || {}); }
    Site.emit("sync:pulled", { ns: ns, state: state || {} });
    Site.emit("sync:pulled:" + ns, state || {});
  }

  /* Pull the whole account and fold every section in. Then push this browser's trophies back up, so a browser
     that already had some get shared to the others (merge-only, so this can only add). */
  function pull(opts) {
    opts = opts || {};
    if (!linked()) return Promise.resolve({ ok: false, error: "no-code" });
    return rpc("sync_pull", { p_code: code() }).then(function (res) {
      if (!res || res.ok === false) {
        if (res && res.error === "bad-code") {   /* regenerated or wrong: forget it, do NOT retry */
          Site.store.set(CODE_KEY, ""); Site.store.set(HANDLE_KEY, ""); Site.store.set(PROFILE_KEY, null);
          Site.emit("sync:changed");
          if (opts.loud) say("That sync code didn't work. Please enter it again from your profile.", "err");
        }
        return res || { ok: false };
      }
      if (res.handle) Site.store.set(HANDLE_KEY, String(res.handle));
      var state = res.state || {};
      Object.keys(state).forEach(function (ns) { applyNs(ns, state[ns]); });
      Site.emit("sync:changed");
      /* send our own trophies up so this device's progress joins the account */
      if (Site.trophy && Site.trophy.all) {
        var mine = Site.trophy.all();
        if (mine && Object.keys(mine).length) push("trophies", mine);
      }
      return { ok: true, handle: handle() };
    }).catch(function () { return { ok: false, error: "offline" }; });
  }

  /* Push is coalesced per namespace: rapid earns in a row (or several arcade saves) go up as one patch. */
  var pending = {}, flushTimer = 0;
  function flush() {
    flushTimer = 0;
    if (!linked()) { pending = {}; return; }
    Object.keys(pending).forEach(function (ns) {
      var patch = pending[ns]; delete pending[ns];
      if (!patch || !Object.keys(patch).length) return;
      rpc("sync_push", { p_code: code(), p_ns: ns, p_patch: patch }).then(function (res) {
        if (res && res.ok === false && res.error === "bad-code") {
          Site.store.set(CODE_KEY, ""); Site.store.set(HANDLE_KEY, ""); Site.store.set(PROFILE_KEY, null); Site.emit("sync:changed");
        }
      }).catch(function () {});
    });
  }
  function push(ns, patch) {
    if (!linked() || !patch || typeof patch !== "object") return;
    if (!/^[a-z0-9_-]{1,32}$/.test(ns)) return;
    var bucket = pending[ns] || (pending[ns] = {});
    Object.keys(patch).forEach(function (k) { bucket[k] = patch[k]; });
    if (!flushTimer) flushTimer = setTimeout(flush, 800);
  }

  /* Link this browser to a code the user pasted in. Validates the shape loosely, stores it, then pulls. */
  function link(raw) {
    var norm = normalize(raw);
    if (norm.length < 12) return Promise.resolve({ ok: false, error: "short" });
    Site.store.set(CODE_KEY, pretty(norm));
    Site.emit("sync:changed");
    return pull({ loud: false }).then(function (res) {
      if (!res.ok) {   /* bad code: pull() already cleared it on bad-code */
        if (res.error !== "bad-code") { Site.store.set(CODE_KEY, ""); Site.store.set(HANDLE_KEY, ""); Site.emit("sync:changed"); }
        return res;
      }
      return res;
    });
  }
  function unlink() {
    Site.store.set(CODE_KEY, ""); Site.store.set(HANDLE_KEY, ""); Site.store.set(PROFILE_KEY, null);
    Site.emit("sync:changed");
  }

  /* ---- Rate-O-Pedia profile (sync_profile) ----
     The chip and the mini profile card mirror the member's ROP customization: display name, picture, accent
     colour and a few public stats. Keyed off the sync code, so it works for the linked member regardless of
     their profile-search opt-in. 404/offline leaves whatever is cached (graceful); a bad code clears it. */
  var PROFILE_KEY = "syncProfile";
  var AV_OK = /^https:\/\/(cdn\.discordapp\.com\/|[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/avatars\/)/i;
  function profileData() { var p = Site.store.get(PROFILE_KEY, null); return p && typeof p === "object" ? p : null; }
  function fetchProfile() {
    if (!linked()) return Promise.resolve(null);
    return rpc("sync_profile", { p_code: code() }).then(function (res) {
      if (!res || res.ok === false) {
        if (res && res.error === "bad-code") { Site.store.set(CODE_KEY, ""); Site.store.set(HANDLE_KEY, ""); Site.store.set(PROFILE_KEY, null); Site.emit("sync:changed"); }
        return null;
      }
      var s = (res.stats && typeof res.stats === "object") ? res.stats : {};
      var p = {
        handle: String(res.handle || handle() || ""), name: String(res.name || "").slice(0, 60),
        avatar: AV_OK.test(String(res.avatar || "")) ? String(res.avatar) : "",
        accentHex: /^#[0-9a-f]{6}$/i.test(String(res.accent_hex || "")) ? String(res.accent_hex) : "",
        motto: String(res.motto || "").slice(0, 160), member: res.member !== false, since: String(res.member_since || ""),
        stats: { ratings: +s.ratings || 0, reviews: +s.reviews || 0, lists: +s.lists || 0, followers: +s.followers || 0, following: +s.following || 0 }
      };
      Site.store.set(PROFILE_KEY, p);
      if (p.handle) Site.store.set(HANDLE_KEY, p.handle);
      Site.emit("sync:changed");
      return p;
    }).catch(function () { return null; });
  }

  Site.sync = { code: code, linked: linked, handle: handle, link: link, unlink: unlink, pull: pull, push: push, pretty: pretty, profile: profileData, fetchProfile: fetchProfile };

  /* A tiny status line used inside the dialog. */
  var statusEl = null;
  function say(msg, kind) { if (statusEl) { statusEl.textContent = msg || ""; statusEl.className = "sy-status" + (kind ? " sy-status--" + kind : ""); } }

  function openDialog() {
    var body = el("div", { class: "sy-box" });
    var dlgOpen = true;
    statusEl = el("p", { class: "sy-status", role: "status", "aria-live": "polite" });

    function paint() {
      body.textContent = "";
      if (linked()) {
        var who = handle(), p = profileData();
        var profUrl = who ? "/games/profile/?u=" + encodeURIComponent(who) : "/games/";
        var nameStr = (p && p.name) || who || "Your profile";

        /* header: avatar, name (links to the full ROP profile), @handle, accent-tinted */
        var avBig = el("span", { class: "sy-card__av" });
        if (p && p.avatar) {
          var im = el("img", { class: "sy-card__img", src: p.avatar, alt: "" });
          im.addEventListener("error", function () { avBig.replaceChildren(); avBig.classList.add("is-initial"); avBig.textContent = letterOf(nameStr); });
          avBig.appendChild(im);
        } else { avBig.classList.add("is-initial"); avBig.textContent = letterOf(nameStr); }
        var who2 = el("div", { class: "sy-card__who" },
          el("a", { class: "sy-card__name", href: profUrl, text: nameStr }),
          who ? el("span", { class: "sy-card__handle", text: "@" + who }) : null,
          p && p.member === false ? el("span", { class: "sy-card__flag", text: "Restricted" }) : null);
        var card = el("div", { class: "sy-card" + (p && p.accentHex ? " sy-card--accent" : "") }, el("div", { class: "sy-card__head" }, avBig, who2));
        if (p && p.accentHex) card.style.setProperty("--sy-ac", p.accentHex);
        if (p && p.motto) card.appendChild(el("p", { class: "sy-card__motto", text: p.motto }));

        /* stats overview */
        if (p && p.stats) {
          var S = p.stats, fmt = Site.fmtNum || function (n) { return String(n); };
          var grid = el("div", { class: "sy-stats" });
          [["Ratings", S.ratings], ["Reviews", S.reviews], ["Lists", S.lists], ["Followers", S.followers], ["Following", S.following]].forEach(function (s) {
            grid.appendChild(el("div", { class: "sy-stat" }, el("b", { text: fmt(s[1] || 0) }), el("span", { text: s[0] })));
          });
          card.appendChild(grid);
        }
        if (p && p.since && Site.fmtDate) card.appendChild(el("p", { class: "sy-card__since", text: "Member since " + Site.fmtDate(p.since) }));
        body.appendChild(card);

        body.appendChild(el("p", { class: "sy-note", text: "Your trophies and arcade progress sync to this account automatically. Syncing only ever adds — it never deletes." }));
        var now = el("button", { type: "button", class: "btn btn--primary sy-btn", text: "Sync now" });
        var off = el("button", { type: "button", class: "btn sy-btn sy-btn--ghost", text: "Unlink this browser" });
        now.addEventListener("click", function () {
          say("Syncing…"); now.disabled = true;
          Promise.all([pull({ loud: true }), fetchProfile()]).then(function (rs) { now.disabled = false; var r = rs[0]; paint(); say(r.ok ? "Synced. You're up to date." : (r.error === "bad-code" ? "" : "Couldn't sync just now."), r.ok ? "ok" : "err"); });
        });
        off.addEventListener("click", function () { unlink(); Site.sfx("toggle"); paint(); });
        body.appendChild(el("div", { class: "sy-actions" }, now, off));
        body.appendChild(el("a", { class: "sy-help", href: profUrl, text: "View my full Rate-O-Pedia profile →" }));
        body.appendChild(statusEl);
        /* no profile data cached yet (first open, or RPC just went live) — fetch and repaint */
        if (!p) fetchProfile().then(function (np) { if (np && dlgOpen) paint(); });
      } else {
        body.appendChild(el("p", { class: "sy-note", text: "Link this browser to carry your trophies and arcade progress across devices. On your home browser, sign in with Discord on your Rate-O-Pedia profile to get a secret sync code, then paste it below." }));
        var input = el("input", { type: "text", class: "sy-input", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", placeholder: "XXXX-XXXX-XXXX-XXXX", "aria-label": "Sync code" });
        input.addEventListener("input", function () {
          var p = input.selectionStart === input.value.length;
          input.value = pretty(input.value).slice(0, 19);
          if (p) try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {}
        });
        var go = el("button", { type: "button", class: "btn btn--primary sy-btn", text: "Link this browser" });
        function submit() {
          var v = input.value;
          if (normalize(v).length < 12) { say("That doesn't look like a full code yet.", "err"); input.focus(); return; }
          say("Linking…"); go.disabled = true;
          link(v).then(function (r) {
            go.disabled = false;
            if (r.ok) { Site.sfx("success"); say(""); paint(); Site.toast("Account linked. Your progress now follows you across devices.", { type: "ok", ms: 4200 }); }
            else if (r.error === "unset") say("Account sync isn't switched on yet. Try again a little later.", "err");
            else if (r.error === "offline") say("Couldn't reach the server. Check your connection and try again.", "err");
            else say("That code didn't work. Double-check it on your profile and try again.", "err");
          });
        }
        go.addEventListener("click", submit);
        input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); submit(); } });
        body.appendChild(el("div", { class: "sy-form" }, input, go));
        body.appendChild(statusEl);
        body.appendChild(el("a", { class: "sy-help", href: "/games/", text: "Open Rate-O-Pedia to find your code →" }));
        setTimeout(function () { try { input.focus(); } catch (e) {} }, 60);
      }
    }
    paint();
    var d = Site.modal({ id: "sy-link", title: linked() ? "Your profile" : "Sign in", className: "sy-modal", body: body });
    d.addEventListener("close", function () { dlgOpen = false; d.remove(); statusEl = null; });
    Site.dialog.open(d);
  }

  /* the first letter of a name/handle, for the avatar fallback (a star if there's nothing usable) */
  function letterOf(str) { var s = String(str || "").replace(/[^A-Za-z0-9]/g, ""); return s ? s.charAt(0).toUpperCase() : "★"; }

  Site.ready(function () {
    /* header profile chip — the account's home in the top-right corner of every page. Shows the linked
       handle (with an avatar) when signed in, or a quiet "Sign in" when not. Click opens the profile panel. */
    var tools = Site.tools();
    if (tools) {
      var av = el("span", { class: "sy-av", "aria-hidden": "true" });
      var nm = el("span", { class: "sy-name" });
      var btn = el("button", { type: "button", class: "sx-iconbtn sy-profile", style: { order: "50" }, "aria-haspopup": "dialog" }, av, nm);
      function paint() {
        var on = linked(), who = handle(), p = profileData();
        btn.classList.toggle("is-linked", on);
        av.replaceChildren(); av.classList.remove("sy-av--initial");
        var ac = on && p && p.accentHex ? p.accentHex : "";
        if (ac) { btn.style.setProperty("--sy-ac", ac); btn.classList.add("sy-profile--accent"); }
        else { btn.style.removeProperty("--sy-ac"); btn.classList.remove("sy-profile--accent"); }
        var nameStr = on ? ((p && p.name) || who) : "";
        if (on && p && p.avatar) {
          var img = el("img", { class: "sy-av-img", src: p.avatar, alt: "", loading: "lazy" });
          img.addEventListener("error", function () { av.replaceChildren(); av.classList.add("sy-av--initial"); av.textContent = letterOf(nameStr || who); });
          av.appendChild(img);
        } else if (on) { av.classList.add("sy-av--initial"); av.textContent = letterOf(nameStr || who); }
        else { av.appendChild(svg(PERSON)); }
        nm.textContent = on ? (nameStr || "Account") : "Sign in";
        var lbl = on ? ("Profile" + (nm.textContent ? " — " + nm.textContent : "")) : "Sign in to your profile";
        btn.setAttribute("aria-label", lbl); btn.title = lbl;
      }
      paint();
      Site.on("sync:changed", paint);
      btn.addEventListener("click", function () { Site.sfx("open"); openDialog(); });
      tools.appendChild(btn);
    }

    /* when linked, pull progress AND refresh the profile (name/pic/accent/stats) once on load */
    if (linked()) setTimeout(function () { pull({ loud: false }); fetchProfile(); }, 1500);

    /* live: a trophy earned on this browser goes up to the account */
    Site.on("trophy:earned", function (v) {
      var d = (v && v.detail) || v; if (!d || !d.id) return;
      var patch = {}; patch[d.id] = d.at || Date.now();
      push("trophies", patch);
    });

    /* arcade progress: the playable-games pages emit "arcade:save" with {game: bestScore, ...}; we store it
       locally and push it up. On a pull, "sync:pulled:arcade" hands them the merged set to apply. */
    Site.on("arcade:save", function (v) {
      var d = (v && v.detail) || v; if (!d || typeof d !== "object") return;
      try { var cur = Site.store.get("arcade", {}) || {}; Object.keys(d).forEach(function (k) { cur[k] = d[k]; }); Site.store.set("arcade", cur); } catch (e) {}
      push("arcade", d);
    });
    Site.on("sync:pulled:arcade", function (v) {
      var state = (v && v.detail) || v; if (!state || typeof state !== "object") return;
      try { var cur = Site.store.get("arcade", {}) || {}; var changed = false;
        Object.keys(state).forEach(function (k) { if (cur[k] == null || (+state[k] || 0) > (+cur[k] || 0)) { cur[k] = state[k]; changed = true; } });
        if (changed) Site.store.set("arcade", cur);
      } catch (e) {}
    });
  }, "account sync");
})();
