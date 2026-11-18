/* sync.js — cross-device account sync, loaded on every page by assets/interact.js (prefix sy-).
 *
 * The idea: sign in with Discord once on your Wiki-Chip Dex profile and it shows a secret sync code
 * (XXXX-XXXX-XXXX-XXXX). Paste that code into the "Link account" box on ANY page here and this browser
 * is linked — your trophies (and arcade progress, once the games side plugs in) follow you across devices.
 *
 * The account, the code and the cloud storage all live on the Wiki-Chip Dex / Supabase side. This file only
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
  /* Discord mark (filled) — rendered via a dedicated <svg> so it keeps its own fill independent of the stroke icons */
  function discordMark() {
    var s = "<svg class='sy-dc' viewBox='0 0 24 24' width='18' height='18' aria-hidden='true' focusable='false'>" +
      "<path fill='currentColor' d='M20.3 4.5A19 19 0 0 0 15.6 3l-.2.5a17 17 0 0 1 4.2 1.4A13.5 13.5 0 0 0 4.4 4.9 17 17 0 0 1 8.6 3.5L8.4 3a19 19 0 0 0-4.7 1.5C.9 8.7.1 12.8.5 16.9a19.2 19.2 0 0 0 5.8 2.9l.5-1.3a12.4 12.4 0 0 1-2-1l.5-.4a13.7 13.7 0 0 0 11.6 0l.5.4a12.4 12.4 0 0 1-2 1l.5 1.3a19.1 19.1 0 0 0 5.8-2.9c.5-4.8-.8-8.9-3.3-12.4ZM8.5 14.5c-1.1 0-2-1-2-2.3s.9-2.3 2-2.3 2 1 2 2.3-.9 2.3-2 2.3Zm7 0c-1.1 0-2-1-2-2.3s.9-2.3 2-2.3 2 1 2 2.3-.9 2.3-2 2.3Z'/></svg>";
    var w = document.createElement("span"); w.className = "sy-dc-wrap"; w.innerHTML = s; return w.firstChild;
  }

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

  /* ---- Wiki-Chip Dex profile (sync_profile) ----
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

  /* ---- Discord sign-in (shared Supabase session) ----
     The Wiki-Chip Dex side (/games/) signs people in with Discord through the Supabase JS client. Because the hub
     and /games/ are the SAME origin, that sign-in leaves a session in localStorage we can read here — so someone
     already signed in on /games/ shouldn't have to sign in again. When we spot that session we quietly fetch their
     sync code (my_sync_code(), signed-in only) and link this browser, so all the code-based machinery just works.
     The client is only loaded on demand (a session exists, or they click "Continue with Discord"), so pages with
     no signed-in visitor pay nothing. Supabase only allows /games/ as a Discord redirect, so that's where sign-in
     lands; from there every hub page shows them signed in. */
  var SUPA_REF = (String(SB.url || "").match(/^https:\/\/([a-z0-9-]+)\.supabase/i) || [])[1] || "";
  var AUTH_LS = SUPA_REF ? "sb-" + SUPA_REF + "-auth-token" : "";
  function hasDiscordSession() {
    if (!AUTH_LS) return false;
    try { var raw = localStorage.getItem(AUTH_LS); if (!raw) return false; var s = JSON.parse(raw); var sess = (s && s.currentSession) || s; return !!(sess && sess.access_token); } catch (e) { return false; }
  }
  /* the raw access token from the stored Supabase session (any provider) — lets us make one authenticated
     call without loading the heavy supabase-js client, so signed-out pages still pay nothing */
  function sessionToken() {
    if (!AUTH_LS) return "";
    try { var raw = localStorage.getItem(AUTH_LS); if (!raw) return ""; var s = JSON.parse(raw); var sess = (s && s.currentSession) || s; return (sess && sess.access_token) || ""; } catch (e) { return ""; }
  }
  /* Member traffic: log this page view for the owner's ops-station analytics (log_member_visit, 44_traffic_stats.sql).
     Only fires for a signed-in member, once per page load, and the RPC itself sanitises the path and rate-limits. */
  var _visitLogged = false;
  function logMemberVisit() {
    if (_visitLogged || feat("memberTraffic") === false) return;
    var tok = sessionToken(); if (!tok || !SB.url || !SB.key || !window.fetch) return;
    _visitLogged = true;
    try {
      fetch(SB.url + "/rest/v1/rpc/log_member_visit", {
        method: "POST", keepalive: true,
        headers: { apikey: SB.key, Authorization: "Bearer " + tok, "Content-Type": "application/json" },
        body: JSON.stringify({ p_path: location.pathname })
      }).catch(function () {});
    } catch (e) {}
  }
  var _sb = null, _sbLoad = null;
  function supaClient() {
    if (_sb) return Promise.resolve(_sb);
    if (_sbLoad) return _sbLoad;
    if (!SB.url || !SB.key) return Promise.resolve(null);
    _sbLoad = import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")
      .then(function (m) { _sb = m.createClient(SB.url, SB.key); return _sb; })
      .catch(function () { return null; });
    return _sbLoad;
  }
  /* If signed in via Discord but not yet linked, adopt their sync code so the chip + sync light up. Returns the
     code (now stored) or null. Never auto-unlinks — the code is a durable cross-device link independent of auth. */
  function adoptDiscordSession() {
    if (linked() || !hasDiscordSession()) return Promise.resolve(null);
    return supaClient().then(function (sb) {
      if (!sb) return null;
      return sb.auth.getSession().then(function (res) {
        var session = res && res.data && res.data.session;
        if (!session) return null;
        return sb.rpc("my_sync_code").then(function (r) {
          var sc = r && r.data;
          if (sc && typeof sc === "string" && normalize(sc).length >= 12 && !linked()) {
            Site.store.set(CODE_KEY, pretty(normalize(sc))); Site.emit("sync:changed"); return code();
          }
          return null;
        }, function () { return null; });
      }, function () { return null; });
    });
  }
  /* Start Discord OAuth. Supabase's allow-list only knows /games/, so that's the return address (matches ROP). */
  function signInDiscord() {
    return supaClient().then(function (sb) {
      if (!sb) return false;
      try { localStorage.setItem("site.syncReturn", location.pathname + location.search); } catch (e) {}
      sb.auth.signInWithOAuth({ provider: "discord", options: { scopes: "identify guilds.members.read", redirectTo: location.origin + "/games/" } });
      return true;
    });
  }

  /* ---- native DMA account (email + password) sign-in, mirroring /account/ (assets/pages/account.js) ----
     The heavy signup/verification flow stays on /account/; this is the quick returning-user sign-in that the
     header dialog leads with. Same Supabase client, same Turnstile captcha the owner wired for accounts. */
  var CAPTCHA_KEY = (((Site.config || {}).captcha) || {}).turnstile || "";
  var _capToken = "", _capLoaded = false, _capWidget = null;
  window.__syCaptcha = function (t) { _capToken = t || ""; };
  function mountCaptcha(host) {
    if (!CAPTCHA_KEY || !host) return;
    host.setAttribute("aria-hidden", "false");
    function render() { try { if (window.turnstile && host && !host.firstChild) _capWidget = window.turnstile.render(host, { sitekey: CAPTCHA_KEY, callback: window.__syCaptcha }); } catch (e) {} }
    if (window.turnstile) { render(); return; }
    if (!_capLoaded) {
      _capLoaded = true;
      var s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      s.async = true; s.defer = true; s.onload = render;
      document.head.appendChild(s);
    } else { setTimeout(render, 400); }
  }
  function resetCaptcha() { _capToken = ""; try { if (window.turnstile && _capWidget != null) window.turnstile.reset(_capWidget); } catch (e) {} }
  function authError(m) {
    m = String(m || "");
    if (/invalid login|invalid credentials/i.test(m)) return "That email or password isn't right.";
    if (/email not confirmed/i.test(m)) return "Check your inbox and confirm your email first.";
    if (/captcha/i.test(m)) return "Please complete the captcha and try again.";
    if (/rate|too many/i.test(m)) return "Too many tries — wait a moment and try again.";
    return "Couldn't sign in. Please try again.";
  }
  function signInPassword(email, pw) {
    return supaClient().then(function (sb) {
      if (!sb) return { ok: false, error: "Couldn't reach the server. Try again." };
      var opts = { email: email, password: pw };
      if (CAPTCHA_KEY && _capToken) opts.captchaToken = _capToken;
      return sb.auth.signInWithPassword(opts).then(function (res) {
        if (res && res.error) return { ok: false, error: authError(res.error.message) };
        return { ok: true };
      }, function () { return { ok: false, error: "Couldn't sign in. Try again." }; });
    });
  }
  function sendReset(email) {
    return supaClient().then(function (sb) {
      if (!sb) return { ok: false };
      var opts = { redirectTo: location.origin + "/account/?reset=1" };
      if (CAPTCHA_KEY && _capToken) opts.captchaToken = _capToken;
      return sb.auth.resetPasswordForEmail(email, opts).then(function (res) {
        return { ok: !(res && res.error) };
      }, function () { return { ok: false }; });
    });
  }

  Site.sync = { code: code, linked: linked, handle: handle, link: link, unlink: unlink, pull: pull, push: push, pretty: pretty, profile: profileData, fetchProfile: fetchProfile, hasDiscordSession: hasDiscordSession, signInDiscord: signInDiscord, adoptDiscordSession: adoptDiscordSession };

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
        body.appendChild(el("a", { class: "sy-help", href: profUrl, text: "View my full Wiki-Chip Dex profile →" }));
        body.appendChild(statusEl);
        /* no profile data cached yet (first open, or RPC just went live) — fetch and repaint */
        if (!p) fetchProfile().then(function (np) { if (np && dlgOpen) paint(); });
      } else if (((((Site.config || {}).features) || {}).accounts) === true) {
        /* PRIMARY: DMA account (email + password) — the site's recommended way in. Discord is secondary.
           Account creation + the full verified flow live on /account/ (signup sends a confirmation email). */
        body.appendChild(el("p", { class: "sy-note", text: "Sign in to carry your profile, trophies and arcade progress across every device. A DMA account is the way in — Discord still works too." }));

        var emailI = el("input", { type: "email", class: "sy-input", autocomplete: "email", autocapitalize: "off", spellcheck: "false", placeholder: "you@email.com", "aria-label": "Email" });
        var pwI = el("input", { type: "password", class: "sy-input", autocomplete: "current-password", placeholder: "Password", "aria-label": "Password" });
        var rememberedEmail = ""; try { rememberedEmail = localStorage.getItem("site.rememberEmail") || ""; } catch (e) {}
        if (rememberedEmail) emailI.value = rememberedEmail;
        var remCb = el("input", { type: "checkbox", class: "sy-remember__cb" }); remCb.checked = !!rememberedEmail;
        var remLabel = el("label", { class: "sy-remember" }, remCb, el("span", { text: "Remember my email on this device" }));
        var capHost = el("div", { class: "sy-captcha" });
        var signIn = el("button", { type: "button", class: "btn sy-btn sy-btn--primary", text: "Sign in" });
        var create = el("a", { class: "sy-authlink", href: "/account/", text: "Create a DMA account →" });
        var forgot = el("button", { type: "button", class: "sy-authlink sy-authlink--btn", text: "Forgot password?" });

        function doSignIn() {
          var email = emailI.value.trim(), pw = pwI.value;
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say("Enter a valid email.", "err"); emailI.focus(); return; }
          if (!pw) { say("Enter your password.", "err"); pwI.focus(); return; }
          if (CAPTCHA_KEY && !_capToken) { say("Please complete the captcha first.", "err"); return; }
          say("Signing in…"); signIn.disabled = true;
          signInPassword(email, pw).then(function (r) {
            signIn.disabled = false;
            if (!r.ok) { say(r.error || "Couldn't sign in.", "err"); resetCaptcha(); return; }
            try { if (remCb.checked) localStorage.setItem("site.rememberEmail", email); else localStorage.removeItem("site.rememberEmail"); } catch (e) {}
            Site.sfx("success"); say("Signed in ✓", "ok");
            adoptDiscordSession().then(function () { fetchProfile().then(function () { if (dlgOpen) paint(); }); });
          });
        }
        signIn.addEventListener("click", doSignIn);
        pwI.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); doSignIn(); } });
        forgot.addEventListener("click", function () {
          var email = emailI.value.trim();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say("Type your email above first, then tap Forgot password.", "err"); emailI.focus(); return; }
          if (CAPTCHA_KEY && !_capToken) { say("Please complete the captcha first.", "err"); return; }
          say("Sending reset email…"); forgot.disabled = true;
          sendReset(email).then(function (r) { forgot.disabled = false; say(r.ok ? "Check your inbox for a reset link." : "Couldn't send that just now.", r.ok ? "ok" : "err"); if (!r.ok) resetCaptcha(); });
        });

        body.appendChild(el("div", { class: "sy-authform" }, emailI, pwI, remLabel, capHost, signIn));
        body.appendChild(el("div", { class: "sy-authrow" }, forgot, create));
        body.appendChild(statusEl);

        /* SECONDARY: Discord (same shared Supabase session Wiki-Chip Dex uses) */
        body.appendChild(el("div", { class: "sy-or" }, el("span", { text: "or" })));
        var dc = el("button", { type: "button", class: "btn sy-btn sy-btn--discord sy-btn--secondary" }, discordMark(), el("span", { text: "Continue with Discord" }));
        dc.addEventListener("click", function () {
          say("Opening Discord…"); dc.disabled = true;
          signInDiscord().then(function (ok) { if (!ok) { dc.disabled = false; say("Couldn't start Discord sign-in.", "err"); } });
        });
        body.appendChild(dc);

        mountCaptcha(capHost);
        setTimeout(function () { try { (rememberedEmail ? pwI : emailI).focus(); } catch (e) {} }, 60);
      } else {
        /* accounts feature OFF — the original Discord + sync-code flow (fallback until native accounts are live) */
        body.appendChild(el("p", { class: "sy-note", text: "Sign in with Discord to carry your profile, trophies and arcade progress across devices. If you're already signed in on Wiki-Chip Dex, this picks that up automatically." }));

        var dc0 = el("button", { type: "button", class: "btn sy-btn sy-btn--discord" }, discordMark(), el("span", { text: "Continue with Discord" }));
        dc0.addEventListener("click", function () {
          say("Opening Discord…"); dc0.disabled = true;
          signInDiscord().then(function (ok) { if (!ok) { dc0.disabled = false; say("Couldn't start Discord sign-in. Try the sync code below instead.", "err"); } });
        });
        body.appendChild(dc0);

        body.appendChild(el("div", { class: "sy-or" }, el("span", { text: "or paste a sync code" })));
        var input = el("input", { type: "text", class: "sy-input", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", placeholder: "XXXX-XXXX-XXXX-XXXX", "aria-label": "Sync code" });
        input.addEventListener("input", function () {
          var p = input.selectionStart === input.value.length;
          input.value = pretty(input.value).slice(0, 19);
          if (p) try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {}
        });
        var go = el("button", { type: "button", class: "btn sy-btn sy-btn--ghost", text: "Link" });
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
        body.appendChild(el("a", { class: "sy-help", href: "/games/", text: "Open Wiki-Chip Dex to find your code →" }));
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
      btn.addEventListener("click", function () {
        Site.sfx("open");
        /* when native accounts are live and there's a real auth session, open the full Account center;
           otherwise fall back to the sign-in / mini-profile dialog */
        var accOn = ((((Site.config || {}).features) || {}).accounts) === true;
        if (accOn && hasDiscordSession() && Site.accountCenter && Site.accountCenter.open()) return;
        openDialog();
      });
      tools.appendChild(btn);
    }

    /* on load: if already linked, pull + refresh the profile; otherwise, if signed in via Discord on /games/,
       adopt that session (fetch the sync code) so the chip reflects it without a second sign-in */
    setTimeout(function () {
      if (linked()) { pull({ loud: false }); fetchProfile(); }
      else adoptDiscordSession().then(function (sc) { if (sc) { pull({ loud: false }); fetchProfile(); } });
      logMemberVisit();
    }, 1500);

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
