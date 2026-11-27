/* pages/account.js — the native DMA Account page (/account/).
 *
 * SITE-owned front end for the native-account system (see the "DMA Accounts — Native Sign-up Plan" and the
 * backend contract at /mnt/project-files/site-hub/rateopedia/DMA_ACCOUNTS_API.md). Two ways to a full account:
 * a standalone DMA Account (email + password) or Continue with Discord; either can link the other to become a
 * joint account and sign in whichever way they like.
 *
 * The Supabase auth backend (email provider, SMTP, captcha, schema, the member-gate change) lives on the
 * Wiki-Chip Dex / Supabase side (SQL 32). This file only calls it, and stays dark behind
 * Site.config.features.accounts (DEFAULT OFF — opt-in, not the usual !== false) until the owner finishes the
 * dashboard steps in DMA_ACCOUNTS_SETUP.md (email provider, confirm email, manual linking, SMTP, Turnstile,
 * redirect allow-list https://damananders.github.io/**). When the flag is off, or the backend can't be
 * reached, the page shows a friendly "almost ready" state instead of a broken form.
 */

const SB = (window.Site && Site.sb) || {};
const CAPTCHA_KEY = (Site.config && Site.config.captcha && Site.config.captcha.turnstile) || "";
const root = document.getElementById("ac-root");

/* ---------- tiny helpers (no games.common.js — this page is SITE-owned and self-contained) ---------- */
function feat(name) { var f = (Site.config && Site.config.features) || {}; return f[name] === true; } /* opt-IN */
function toast(msg, type) { try { if (window.Site && Site.toast) Site.toast(msg, { type: type || "info" }); } catch (e) {} }
function el(tag, attrs, html) {
  var n = document.createElement(tag);
  if (attrs) for (var k in attrs) { if (k === "class") n.className = attrs[k]; else if (k === "html") n.innerHTML = attrs[k]; else if (k === "text") n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); }
  if (html != null) n.innerHTML = html;
  return n;
}
function clear() { while (root.firstChild) root.removeChild(root.firstChild); }
/* our sections are inserted after site.js has already wired its reveal observer, so hand them over now */
function revealIn() { try { if (window.Site && Site.reveal) Site.reveal("#ac-root [data-reveal]"); } catch (e) {} }
function val(id) { var n = document.getElementById(id); return n ? n.value : ""; }
function say(node, msg, kind) { if (!node) return; node.textContent = msg || ""; node.className = "ac-msg" + (kind ? " ac-msg--" + kind : ""); }
function escapeHtml(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

/* ---------- lazy Supabase client (same CDN + pattern as assets/sync.js) ---------- */
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

/* ---------- Turnstile captcha (mounts only when the owner has set a site key) ----------
   Each form (sign-up, sign-in) gets its OWN widget and token. Turnstile tokens are single-use and expire
   after ~5 minutes, so every widget is reset after each attempt (pass or fail) and on expiry/error. Before
   this, one widget served both forms and was never reset: once a token was spent (a sign-up, a typo'd
   password) every later sign-in was rejected by Supabase as "captcha verification process failed", which
   the page reported as a wrong password. */
var _cap = {};                              /* form key -> { id: widgetId, token: "" } */
var _turnstileLoaded = false, _turnstileWaiters = [];
function loadTurnstile(cb) {
  if (window.turnstile) { cb(); return; }
  _turnstileWaiters.push(cb);
  if (_turnstileLoaded) return;
  _turnstileLoaded = true;
  var s = document.createElement("script");
  s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
  s.async = true; s.defer = true;
  s.onload = function () { var w = _turnstileWaiters; _turnstileWaiters = []; w.forEach(function (f) { try { f(); } catch (e) {} }); };
  document.head.appendChild(s);
}
function mountCaptcha(hostId, key) {
  if (!CAPTCHA_KEY) return;                 /* no key yet → captcha skipped until the owner wires it */
  key = key || hostId;
  var host = document.getElementById(hostId);
  if (!host) return;
  host.setAttribute("aria-hidden", "false");
  var old = _cap[key];
  if (old && old.id != null) { try { window.turnstile.remove(old.id); } catch (e) {} }
  var slot = _cap[key] = { id: null, token: "" };
  var tries = 0;
  loadTurnstile(function render() {
    if (host.firstChild) return;
    if (!document.body.contains(host)) { if (++tries < 40) setTimeout(render, 50); return; }
    try {
      slot.id = window.turnstile.render(host, {
        sitekey: CAPTCHA_KEY,
        callback: function (t) { slot.token = t || ""; },
        "expired-callback": function () { slot.token = ""; try { window.turnstile.reset(slot.id); } catch (e) {} },
        "error-callback": function () { slot.token = ""; },
        "timeout-callback": function () { slot.token = ""; }
      });
    } catch (e) {}
  });
}
function resetCaptcha(key) {
  var slot = _cap[key]; if (!slot) return;
  slot.token = "";
  try { if (window.turnstile && slot.id != null) window.turnstile.reset(slot.id); } catch (e) {}
}
/* add captchaToken to an options object only when we actually have one */
function withCaptcha(opts, key) { opts = opts || {}; var slot = _cap[key]; if (CAPTCHA_KEY && slot && slot.token) opts.captchaToken = slot.token; return opts; }
function captchaReady(msg, key) {
  var slot = _cap[key];
  if (CAPTCHA_KEY && !(slot && slot.token)) { say(msg, "Please finish the security check just above the button first.", "warn"); return false; }
  return true;
}
var CAPTCHA_FAIL = "Security check expired, please try again. It refreshes on its own, so wait for the tick and press the button once more.";
function isCaptchaErr(m) { return /captcha/i.test(String(m || "")); }

/* ---------- SVG bits ---------- */
var DISCORD_SVG = '<svg viewBox="0 0 127.14 96.36" aria-hidden="true" fill="currentColor"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/></svg>';
var TICK_SVG = '<svg class="ac-tick" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

/* ---------- validation ---------- */
function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim()); }
function validHandle(v) { return /^[a-z0-9_]{3,20}$/i.test(String(v || "").trim()); }
function pwIssues(v) { v = String(v || ""); var out = []; if (v.length < 8) out.push("at least 8 characters"); if (!/[a-z]/i.test(v)) out.push("a letter"); if (!/[0-9]/.test(v)) out.push("a number"); return out; }

/* ---------- small DOM builders ---------- */
function field(id, label, type, placeholder, extra) {
  var wrap = el("label", { class: "ac-field", for: id });
  wrap.appendChild(el("span", { class: "ac-label", text: label }));
  var inp = el("input", { class: "ac-input", id: id, type: type, placeholder: placeholder || "" });
  if (extra) for (var k in extra) inp.setAttribute(k, extra[k]);
  wrap.appendChild(inp);
  return wrap;
}
var busy = false;
function lock(btn, v, labelBusy) { busy = v; if (!btn) return; btn.disabled = v; if (v) { btn.dataset.label = btn.textContent; btn.textContent = labelBusy || "Working…"; } else if (btn.dataset.label) { btn.textContent = btn.dataset.label; } }

/* ---------- "coming soon" state (flag off / no backend) ---------- */
function renderComingSoon() {
  clear();
  var card = el("section", { class: "panel pg-card ac-soon", "data-reveal": "" });
  card.appendChild(el("div", { class: "ac-soon__badge", text: "Almost ready" }));
  card.appendChild(el("h2", { text: "DMA Accounts are on the way" }));
  card.appendChild(el("p", { class: "lead", html: "Native sign-up is being built right now. Very soon you'll be able to create a standalone <strong>DMA Account</strong> with just an email, or carry on with Discord — your choice." }));
  var row = el("div", { class: "pg-actions" });
  if (hasSession()) row.appendChild(el("a", { class: "btn", href: "/games/profile/", text: "Go to your profile" }));
  else { var dc = el("button", { class: "btn ac-btn--discord", type: "button", html: DISCORD_SVG + "<span>Continue with Discord</span>" }); dc.addEventListener("click", startDiscord); row.appendChild(dc); }
  row.appendChild(el("a", { class: "btn ghost", href: "/", text: "Back to the hub" }));
  card.appendChild(row);
  root.appendChild(card);
  revealIn();
}

/* ---------- Discord OAuth (sends through /games/ — the only allow-listed sign-in return) ---------- */
function startDiscord() {
  supa().then(function (sb) {
    if (!sb) { toast("Couldn't start Discord sign-in — try again in a moment.", "err"); return; }
    try { localStorage.setItem("site.syncReturn", location.pathname + location.search); } catch (e) {}
    sb.auth.signInWithOAuth({ provider: "discord", options: { scopes: "identify guilds.members.read", redirectTo: location.origin + "/games/" } });
  });
}

/* ---------- signed-out: create + sign in ---------- */
function renderSignedOut() {
  clear();

  var top = el("section", { class: "panel pg-card ac-quick", "data-reveal": "" });
  top.appendChild(el("h2", { text: "The quick way" }));
  top.appendChild(el("p", { class: "ac-sub", text: "Already in the Discord? One tap and you're in — nothing new to remember." }));
  var dc = el("button", { class: "btn ac-btn--discord", type: "button", html: DISCORD_SVG + "<span>Continue with Discord</span>" });
  dc.addEventListener("click", startDiscord);
  top.appendChild(dc);
  root.appendChild(top);

  root.appendChild(el("div", { class: "ac-split", html: "<span>or make a DMA Account</span>" }));

  var grid = el("div", { class: "ac-grid", "data-reveal": "" });

  /* ---- Create a DMA Account ---- */
  var create = el("section", { class: "panel pg-card ac-form" });
  create.appendChild(el("h3", { text: "Create a DMA Account" }));
  create.appendChild(el("p", { class: "ac-sub", text: "Your own standalone account — all the same powers a Discord member gets, and you're Verified too." }));
  var cf = el("form", { class: "ac-fields", novalidate: "" });
  cf.appendChild(field("ac-su-name", "Display name", "text", "What people will see", { autocomplete: "nickname" }));
  var hf = field("ac-su-handle", "Handle", "text", "letters, numbers, underscores", { autocomplete: "username" });
  hf.appendChild(el("span", { class: "ac-hint", id: "ac-su-handle-hint" }));
  cf.appendChild(hf);
  cf.appendChild(field("ac-su-email", "Email", "email", "you@example.com", { autocomplete: "email" }));
  cf.appendChild(field("ac-su-pw", "Password", "password", "at least 8 characters", { autocomplete: "new-password" }));
  cf.appendChild(el("div", { class: "ac-captcha", id: "ac-captcha", "aria-hidden": "true" }));
  var cmsg = el("p", { class: "ac-msg", id: "ac-su-msg", role: "status" });
  cf.appendChild(cmsg);
  var cbtn = el("button", { class: "btn ac-cta", type: "submit", text: "Create my account" });
  cf.appendChild(cbtn);
  cf.appendChild(el("p", { class: "ac-fine", text: "I'll email a confirmation link — click it to finish and you're Verified. If you don't see it in a minute, check your spam/junk folder." }));
  cf.addEventListener("submit", function (e) { e.preventDefault(); doSignUp(cbtn, cmsg); });
  create.appendChild(cf);
  grid.appendChild(create);
  /* live handle availability — use the node refs we just built (not in the document yet) */
  var hin = hf.querySelector(".ac-input");
  var hintEl = hf.querySelector(".ac-hint");
  var hT = 0;
  hin.addEventListener("input", function () {
    clearTimeout(hT); var v = hin.value.trim();
    if (!v) { hintEl.textContent = ""; hintEl.className = "ac-hint"; return; }
    if (!validHandle(v)) { hintEl.textContent = "3–20 letters, numbers or _"; hintEl.className = "ac-hint ac-hint--warn"; return; }
    hintEl.textContent = "checking…"; hintEl.className = "ac-hint";
    hT = setTimeout(function () { checkHandle(v, hintEl); }, 400);
  });

  /* ---- Sign in ---- */
  var signin = el("section", { class: "panel pg-card ac-form" });
  signin.appendChild(el("h3", { text: "Sign in" }));
  signin.appendChild(el("p", { class: "ac-sub", text: "Already have a DMA Account? Welcome back." }));
  var sf = el("form", { class: "ac-fields", novalidate: "" });
  sf.appendChild(field("ac-si-email", "Email", "email", "you@example.com", { autocomplete: "email" }));
  sf.appendChild(field("ac-si-pw", "Password", "password", "your password", { autocomplete: "current-password" }));
  sf.appendChild(el("div", { class: "ac-captcha", id: "ac-si-captcha", "aria-hidden": "true" }));
  var smsg = el("p", { class: "ac-msg", id: "ac-si-msg", role: "status" });
  sf.appendChild(smsg);
  var sbtn = el("button", { class: "btn ac-cta", type: "submit", text: "Sign in" });
  sf.appendChild(sbtn);
  var forgot = el("button", { class: "ac-link", type: "button", text: "Forgot your password?" });
  forgot.addEventListener("click", function () { doReset(smsg); });
  sf.appendChild(forgot);
  sf.addEventListener("submit", function (e) { e.preventDefault(); doSignIn(sbtn, smsg); });
  signin.appendChild(sf);
  grid.appendChild(signin);

  root.appendChild(grid);
  mountCaptcha("ac-captcha", "su");    /* now that the hosts are in the document: one widget per form */
  mountCaptcha("ac-si-captcha", "si");
  revealIn();
}

function checkHandle(v, hintEl) {
  supa().then(function (sb) {
    if (!sb) { hintEl.textContent = ""; return; }
    sb.rpc("handle_available", { p_handle: v }).then(function (r) {
      var d = r && r.data; if (!d) { hintEl.textContent = ""; return; }
      if (d.available) { hintEl.textContent = "✓ available"; hintEl.className = "ac-hint ac-hint--ok"; }
      else { hintEl.textContent = d.reason || "already taken"; hintEl.className = "ac-hint ac-hint--warn"; }
    }).catch(function () { hintEl.textContent = ""; });
  });
}

/* ---------- sign-up ---------- */
function doSignUp(btn, msg) {
  if (busy) return;
  var name = val("ac-su-name").trim(), handle = val("ac-su-handle").trim(), email = val("ac-su-email").trim(), pw = val("ac-su-pw");
  if (!name) { say(msg, "Pick a display name first.", "warn"); return; }
  if (!validHandle(handle)) { say(msg, "Handle should be 3–20 letters, numbers or underscores.", "warn"); return; }
  if (!validEmail(email)) { say(msg, "That email doesn't look right.", "warn"); return; }
  var issues = pwIssues(pw);
  if (issues.length) { say(msg, "Password needs " + issues.join(", ") + ".", "warn"); return; }
  if (!captchaReady(msg, "su")) return;
  lock(btn, true, "Creating…");
  say(msg, "Creating your account…");
  supa().then(function (sb) {
    if (!sb) { done(); return; }
    sb.auth.signUp({
      email: email, password: pw,
      options: withCaptcha({ emailRedirectTo: location.origin + "/account/?confirmed=1", data: { display_name: name, handle: handle } }, "su")
    }).then(function (res) {
      lock(btn, false);
      resetCaptcha("su");                   /* the token is spent either way */
      var err = res && res.error;
      if (err) {
        var m = String(err.message || "");
        if (isCaptchaErr(m)) say(msg, CAPTCHA_FAIL, "warn");
        else say(msg, m || "Couldn't create the account — please try again.", "err");
        return;
      }
      /* collision: Supabase returns a user with an empty identities array and sends no email */
      var u = res && res.data && res.data.user;
      if (u && Array.isArray(u.identities) && u.identities.length === 0) {
        say(msg, "That email already has an account. Sign in, then add a password from this page.", "warn");
        return;
      }
      say(msg, "Almost there! Check your email for a confirmation link to finish — if it's not in your inbox, look in your spam/junk folder and mark it “Not spam.” 💛", "ok");
      try { if (window.Site && Site.sfx) Site.sfx("win"); } catch (e) {}
    }).catch(function () { resetCaptcha("su"); done(); });
  });
  function done() { lock(btn, false); say(msg, "Accounts are being set up — check back soon. 💛"); }
}

/* ---------- sign-in (email only — handle sign-in would leak which email a handle uses) ---------- */
function doSignIn(btn, msg) {
  if (busy) return;
  var email = val("ac-si-email").trim(), pw = val("ac-si-pw");
  if (!validEmail(email)) { say(msg, "Enter the email you signed up with.", "warn"); return; }
  if (!pw) { say(msg, "Enter your password.", "warn"); return; }
  if (!captchaReady(msg, "si")) return;
  lock(btn, true, "Signing in…");
  say(msg, "Signing you in…");
  supa().then(function (sb) {
    if (!sb) { done(); return; }
    sb.auth.signInWithPassword({ email: email, password: pw, options: withCaptcha({}, "si") })  /* supabase-js reads the token from options.captchaToken only */.then(function (res) {
      lock(btn, false);
      resetCaptcha("si");                   /* single-use token: get a fresh one for any retry */
      var err = res && res.error;
      if (err) {
        var em = String(err.message || "");
        if (isCaptchaErr(em)) say(msg, CAPTCHA_FAIL, "warn");
        else if (/not confirmed|confirm/i.test(em)) say(msg, "Please confirm your email first — check your inbox (and spam) for the link.", "warn");
        else if (/invalid login|invalid credentials/i.test(em)) say(msg, "That email and password don't match.", "err");
        else if (/rate|too many/i.test(em)) say(msg, "Too many tries — wait a minute and try again.", "warn");
        else say(msg, "Couldn't sign in (" + em.slice(0, 120) + "). Please try again.", "err");
        return;
      }
      afterPasswordLogin(sb, msg, function () {
        say(msg, "Welcome back! Taking you in…", "ok");
        var back = "/games/profile/";
        try { back = localStorage.getItem("site.syncReturn") || back; localStorage.removeItem("site.syncReturn"); } catch (e) {}
        location.href = back;
      });
    }).catch(function () { resetCaptcha("si"); done(); });
  });
  function done() { lock(btn, false); say(msg, "Accounts are being set up — check back soon. 💛"); }
}

/* ---------- two-factor at sign-in (TOTP challenge) ---------- */
function afterPasswordLogin(sb, msg, onDone) {
  if (!sb.auth.mfa || !sb.auth.mfa.getAuthenticatorAssuranceLevel) { onDone(); return; }
  sb.auth.mfa.getAuthenticatorAssuranceLevel().then(function (r) {
    var d = r && r.data;
    if (d && d.nextLevel === "aal2" && d.currentLevel !== "aal2") renderMfaPrompt(sb, onDone);
    else onDone();
  }).catch(function () { onDone(); });
}
function renderMfaPrompt(sb, onDone) {
  clear();
  var card = el("section", { class: "panel pg-card ac-form ac-2fa-gate", "data-reveal": "" });
  card.appendChild(el("h2", { text: "Two-factor code" }));
  card.appendChild(el("p", { class: "ac-sub", text: "Enter the 6-digit code from your authenticator app to finish signing in." }));
  var f = el("form", { class: "ac-fields", novalidate: "" });
  var wrap = el("label", { class: "ac-field", for: "ac-mfa-code" });
  wrap.appendChild(el("span", { class: "ac-label", text: "Authenticator code" }));
  var inp = el("input", { class: "ac-input ac-codein", id: "ac-mfa-code", type: "text", inputmode: "numeric", autocomplete: "one-time-code", maxlength: "7", placeholder: "123456" });
  wrap.appendChild(inp); f.appendChild(wrap);
  var m = el("p", { class: "ac-msg", role: "status" }); f.appendChild(m);
  var b = el("button", { class: "btn ac-cta", type: "submit", text: "Verify & sign in" }); f.appendChild(b);
  f.addEventListener("submit", function (e) {
    e.preventDefault();
    var code = (inp.value || "").replace(/\s+/g, "");
    if (!/^\d{6}$/.test(code)) { say(m, "Enter the 6-digit code.", "warn"); return; }
    lock(b, true, "Verifying…"); say(m, "Checking…");
    sb.auth.mfa.listFactors().then(function (lf) {
      var tf = (lf && lf.data && lf.data.totp) || [];
      var fac = tf.filter(function (x) { return x.status === "verified"; })[0] || tf[0];
      if (!fac) { lock(b, false); say(m, "No authenticator is set up on this account.", "err"); return; }
      sb.auth.mfa.challenge({ factorId: fac.id }).then(function (ch) {
        if (ch.error) { lock(b, false); say(m, "Couldn't start the check — try again.", "err"); return; }
        sb.auth.mfa.verify({ factorId: fac.id, challengeId: ch.data.id, code: code }).then(function (v) {
          lock(b, false);
          if (v.error) { say(m, "That code didn't match — enter the current one.", "err"); return; }
          onDone();
        }).catch(function () { lock(b, false); say(m, "Couldn't verify — try again.", "err"); });
      }).catch(function () { lock(b, false); say(m, "Couldn't start the check — try again.", "err"); });
    }).catch(function () { lock(b, false); say(m, "Couldn't reach your account — try again.", "err"); });
  });
  var cancel = el("button", { class: "ac-link", type: "button", text: "Cancel and sign out" });
  cancel.addEventListener("click", function () { sb.auth.signOut().then(boot).catch(boot); });
  f.appendChild(cancel);
  card.appendChild(f); root.appendChild(card); revealIn();
  try { inp.focus(); } catch (e) {}
}

/* ---------- password reset ---------- */
function doReset(msg) {
  var id = (val("ac-si-email") || "").trim();
  if (!validEmail(id)) { say(msg, "Type your account email above, then tap this again.", "warn"); return; }
  if (!captchaReady(msg, "si")) return;
  say(msg, "Sending a reset link…");
  supa().then(function (sb) {
    if (!sb) { say(msg, "Password reset is being set up — check back soon."); return; }
    sb.auth.resetPasswordForEmail(id, withCaptcha({ redirectTo: location.origin + "/account/?reset=1" }, "si")).then(function (res) {
      resetCaptcha("si");
      if (res && res.error) say(msg, isCaptchaErr(res.error.message) ? CAPTCHA_FAIL : "Couldn't send the reset link — try again in a moment.", "err");
      else say(msg, "If that email has an account, a reset link is on its way — check your spam folder if it's not in your inbox. 💛", "ok");
    }).catch(function () { say(msg, "Password reset is being set up — check back soon."); });
  });
}

/* ---------- set a new password (arriving via the reset link, ?reset=1) ---------- */
function renderResetForm(linkErr) {
  clear();
  var card = el("section", { class: "panel pg-card ac-form ac-reset", "data-reveal": "" });
  card.appendChild(el("h2", { text: "Set a new password" }));
  if (linkErr || !hasSession()) {
    /* stale/used link (email scanners can open one-time links first) or the session didn't come through */
    card.appendChild(el("p", { class: "ac-sub", text: "This reset link has expired or was already used. Reset links work once and only for about an hour. Go back to sign in, choose Forgot your password, and open the newest email." }));
    var again = el("a", { class: "btn ac-cta", href: "/account/", text: "Back to sign in" });
    card.appendChild(again);
    root.appendChild(card); revealIn(); return;
  }
  card.appendChild(el("p", { class: "ac-sub", text: "Pick a new password for your DMA Account." }));
  var f = el("form", { class: "ac-fields", novalidate: "" });
  f.appendChild(field("ac-rs-pw", "New password", "password", "at least 8 characters", { autocomplete: "new-password" }));
  var m = el("p", { class: "ac-msg", role: "status" });
  f.appendChild(m);
  var b = el("button", { class: "btn ac-cta", type: "submit", text: "Save new password" });
  f.appendChild(b);
  f.addEventListener("submit", function (e) {
    e.preventDefault();
    var pw = val("ac-rs-pw"); var issues = pwIssues(pw);
    if (issues.length) { say(m, "Password needs " + issues.join(", ") + ".", "warn"); return; }
    lock(b, true, "Saving…"); say(m, "Saving…");
    supa().then(function (sb) {
      if (!sb) { lock(b, false); say(m, "Couldn't reach your account — try again."); return; }
      sb.auth.updateUser({ password: pw }).then(function (res) {
        lock(b, false);
        var em = res && res.error ? String(res.error.message || "") : "";
        if (em && /session|jwt|token|expired/i.test(em)) say(m, "This reset link has expired. Go back to sign in, choose Forgot your password, and use the newest email.", "err");
        else if (em && /different from the old|same password/i.test(em)) say(m, "Pick a password you haven't used on this account before.", "warn");
        else if (em) say(m, em || "Couldn't update the password.", "err");
        else { say(m, "Password updated. You're all set. 💛", "ok"); setTimeout(function () { location.href = "/account/"; }, 1200); }
      }).catch(function () { lock(b, false); say(m, "Couldn't update the password — try again."); });
    });
  });
  card.appendChild(f);
  root.appendChild(card);
  revealIn();
}

/* ---------- signed-in: account home (state from my_account()) ---------- */
function renderAccount() {
  clear();
  var card = el("section", { class: "panel pg-card ac-home", "data-reveal": "" });
  card.appendChild(el("h2", { html: TICK_SVG + "<span>You're signed in</span>" }));
  var body = el("div", { class: "ac-home__body" });
  body.appendChild(el("p", { class: "lead", text: "Loading your account…" }));
  card.appendChild(body);
  root.appendChild(card);
  revealIn();

  supa().then(function (sb) {
    if (!sb) { body.innerHTML = ""; body.appendChild(el("p", { class: "pg-empty", text: "Couldn't reach your account right now — try again in a moment." })); return; }
    sb.rpc("my_account").then(function (res) {
      var a = res && res.data;
      if (res && res.error) { /* backend not live yet */ body.innerHTML = ""; body.appendChild(el("p", { class: "pg-empty", text: "Your account isn't ready on the server yet — check back soon." })); return; }
      if (Array.isArray(a)) a = a[0];
      paintAccount(sb, a || {}, body);
    }).catch(function () { body.innerHTML = ""; body.appendChild(el("p", { class: "pg-empty", text: "Couldn't load your account." })); });
  });
}

function paintAccount(sb, a, body) {
  body.innerHTML = "";
  var hasDiscord = !!a.has_discord, hasDma = !!a.has_dma, joint = hasDiscord && hasDma;
  var name = a.name || "You", handle = a.handle || "";

  /* avatar header */
  var head = el("div", { class: "ac-head2" });
  head.appendChild(el("div", { class: "ac-avatar", "aria-hidden": "true", text: (name.trim()[0] || "D").toUpperCase() }));
  var idb = el("div", { class: "ac-idblock" });
  var nm = el("div", { class: "ac-idblock__name" });
  nm.appendChild(el("span", { class: "ac-idblock__nm", text: name }));
  if (a.verified) nm.appendChild(el("span", { class: "ac-badge ac-badge--verified", html: TICK_SVG + "<span>Verified</span>" }));
  if (a.cooldown_until) nm.appendChild(el("span", { class: "ac-badge ac-badge--cool", text: "New account" }));
  if (a.restricted) nm.appendChild(el("span", { class: "ac-badge ac-badge--restricted", text: "Restricted" }));
  idb.appendChild(nm);
  if (handle) idb.appendChild(el("span", { class: "ac-idblock__at", text: "@" + handle }));
  idb.appendChild(el("p", { class: "ac-idblock__edit", html: 'Edit public profile, avatar &amp; bio over on <a href="/games/profile/">your profile →</a>' }));
  head.appendChild(idb);
  body.appendChild(head);

  /* sign-in methods */
  var c1 = acCard("Sign-in methods");
  c1.appendChild(svcRow({ cls: "dma", title: "DMA Account", sub: hasDma ? "Email & password" : "Not set up yet", on: hasDma, chip: "Active", action: hasDma ? null : "Add", fn: function () { addDma(sb); } }));
  c1.appendChild(svcRow({ cls: "discord", title: "Discord", sub: hasDiscord ? "Linked" : "Continue with Discord", on: hasDiscord, chip: "Linked", action: hasDiscord ? null : "Link", primary: true, fn: function () { linkDiscord(sb); } }));
  body.appendChild(c1);

  /* access across projects — one DMA Account spans all three (informational) */
  var c2 = acCard("Access across projects");
  c2.appendChild(svcRow({ cls: "craft", title: "AndersCraft", sub: "Sign-ups & realm status", on: true, chip: "Linked" }));
  c2.appendChild(svcRow({ cls: "anyps", title: "AnyPS", sub: "Downloads & licence", on: true, chip: "Linked" }));
  c2.appendChild(svcRow({ cls: "games", title: "Wiki-Chip Dex", sub: "Ratings, reviews & lists", on: true, chip: "Linked" }));
  body.appendChild(c2);

  /* security */
  var c3 = acCard("Security");
  if (hasDma) {
    c3.appendChild(twoFactorBlock(sb));
    c3.appendChild(svcRow({ cls: "key", title: "Password", sub: "Change your account password", action: "Change", fn: function () { changePw(sb); } }));
  } else {
    c3.appendChild(el("p", { class: "ac-sub", text: "Add a DMA Account (email + password) above to turn on two-factor and manage a password." }));
  }
  body.appendChild(c3);

  /* game libraries — the linking itself lives on /games/steam/ */
  var c4 = acCard("Game libraries");
  c4.appendChild(svcRow({ cls: "steam", title: "Steam", sub: "Show your games & hours on your profile", action: "Link", href: "/games/steam/" }));
  c4.appendChild(svcRow({ cls: "bnet", title: "Battle.net", sub: "Link your Blizzard account", action: "Link", href: "/games/steam/" }));
  body.appendChild(c4);

  /* profile flair (Verified ✔ is separate and always shown) */
  var choices = el("div", { class: "ac-flair__row" });
  if (hasDiscord) choices.appendChild(flairChip("discord", "Discord", a.flair));
  if (hasDma) choices.appendChild(flairChip("dma", "DMA", a.flair));
  if (joint) choices.appendChild(flairChip("both", "Both", a.flair));
  if (choices.childNodes.length) {
    var c5 = acCard("Profile flair");
    c5.appendChild(el("p", { class: "ac-sub", text: joint ? "You've linked both — show your Discord flair, your DMA flair, or both." : "The badge shown next to your name. More unlock as you link accounts." }));
    choices.addEventListener("click", function (e) {
      var chip = e.target.closest(".ac-flair__chip"); if (!chip) return;
      choices.querySelectorAll(".ac-flair__chip").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
      chip.setAttribute("aria-pressed", "true");
      saveFlair(sb, chip.dataset.flair);
    });
    c5.appendChild(choices);
    body.appendChild(c5);
  }

  /* actions */
  var sec = el("div", { class: "ac-actions" });
  sec.appendChild(actionBtn("Download my data", function () { toast("Data export is coming soon.", "info"); }));
  var out = actionBtn("Sign out", function () { signOut(sb); });
  out.classList.add("ac-action--danger");
  sec.appendChild(out);
  body.appendChild(sec);
  body.appendChild(el("p", { class: "ac-msg", id: "ac-home-msg", role: "status" }));
}

/* a labelled card that service rows (svcRow) drop into */
function acCard(title) {
  var c = el("section", { class: "ac-card2" });
  c.appendChild(el("p", { class: "ac-card2__h", text: title }));
  return c;
}
/* one row: coloured badge, name + sub, and a status chip or a Link/Manage control (button, or <a> when href set) */
function svcRow(o) {
  var row = el("div", { class: "ac-svc" + (o.on ? " is-on" : "") });
  row.appendChild(el("span", { class: "ac-svc__badge ac-svc__badge--" + (o.cls || "x"), "aria-hidden": "true" }));
  var t = el("div", { class: "ac-svc__t" });
  t.appendChild(el("span", { class: "ac-svc__name", text: o.title }));
  if (o.sub) t.appendChild(el("span", { class: "ac-svc__sub", text: o.sub }));
  row.appendChild(t);
  var r = el("div", { class: "ac-svc__r" });
  if (o.on && o.chip) r.appendChild(el("span", { class: "ac-badge ac-badge--verified", html: TICK_SVG + "<span>" + escapeHtml(o.chip) + "</span>" }));
  if (o.href) { var aLink = el("a", { class: "btn ac-svc__btn" + (o.primary ? "" : " ghost"), href: o.href }); aLink.textContent = o.action || "Open"; r.appendChild(aLink); }
  else if (o.action) { var b = el("button", { class: "btn ac-svc__btn" + (o.primary ? "" : " ghost"), type: "button", text: o.action }); b.addEventListener("click", o.fn); r.appendChild(b); }
  row.appendChild(r);
  return row;
}
function flairChip(value, label, current) { return el("button", { class: "ac-flair__chip", type: "button", "data-flair": value, "aria-pressed": current === value ? "true" : "false", text: label }); }
function actionBtn(label, fn) { var b = el("button", { class: "btn ghost ac-action", type: "button", text: label }); b.addEventListener("click", fn); return b; }

function linkDiscord(sb) {
  var m = document.getElementById("ac-home-msg");
  if (!sb.auth.linkIdentity) { startDiscord(); return; }
  sb.auth.linkIdentity({ provider: "discord", options: { redirectTo: location.origin + "/account/?linked=discord", scopes: "identify guilds.members.read" } })
    .then(function (res) { if (res && res.error) say(m, "Couldn't start linking — turn on manual linking, or try again.", "err"); })
    .catch(function () { say(m, "Linking is being set up — check back soon.", "info"); });
}
function addDma(sb) {
  var m = document.getElementById("ac-home-msg");
  var email = window.prompt("Email for your DMA login:"); if (!email) return;
  if (!validEmail(email)) { say(m, "That email doesn't look right.", "warn"); return; }
  var pw = window.prompt("Choose a password (at least 8 characters, a letter and a number):"); if (!pw) return;
  if (pwIssues(pw).length) { say(m, "Password needs at least 8 characters, a letter and a number.", "warn"); return; }
  say(m, "Adding your password login…");
  sb.auth.updateUser({ email: email, password: pw }).then(function (res) {
    if (res && res.error) say(m, res.error.message || "Couldn't add the login.", "err");
    else say(m, "Check your email to confirm the new address, then you can sign in with it too. 💛", "ok");
  }).catch(function () { say(m, "Couldn't add the login — try again."); });
}
function changePw(sb) {
  var m = document.getElementById("ac-home-msg");
  var pw = window.prompt("New password (at least 8 characters, a letter and a number):"); if (!pw) return;
  if (pwIssues(pw).length) { say(m, "Password needs at least 8 characters, a letter and a number.", "warn"); return; }
  say(m, "Saving…");
  sb.auth.updateUser({ password: pw }).then(function (res) {
    if (res && res.error) say(m, res.error.message || "Couldn't change the password.", "err");
    else say(m, "Password updated. 💛", "ok");
  }).catch(function () { say(m, "Couldn't change the password — try again."); });
}
function saveFlair(sb, choice) {
  var m = document.getElementById("ac-home-msg");
  sb.rpc("set_my_flair", { p_choice: choice }).then(function (res) {
    if (res && res.error) say(m, "Couldn't save your flair — try again.", "err");
    else { say(m, "Flair updated. 💛", "ok"); try { if (window.Site && Site.emit) Site.emit("profile:changed"); } catch (e) {} }
  }).catch(function () { say(m, "Couldn't save your flair — try again.", "err"); });
}
function signOut(sb) {
  sb.auth.signOut().then(function () { try { if (AUTH_LS) localStorage.removeItem(AUTH_LS); } catch (e) {} toast("Signed out.", "info"); boot(); })
    .catch(function () { boot(); });
}

/* ---------- two-factor: manage (enroll / disable) ---------- */
function twoFactorBlock(sb) {
  var box = el("div", { class: "ac-2fa" });
  box.appendChild(el("h3", { text: "Two-factor authentication" }));
  box.appendChild(el("p", { class: "ac-sub", text: "Add a second step at sign-in with an authenticator app (Google Authenticator, Authy, 1Password…)." }));
  var slot = el("div", { class: "ac-2fa__slot" }); box.appendChild(slot);
  var msg = el("p", { class: "ac-msg", role: "status" }); box.appendChild(msg);
  function refresh() {
    slot.innerHTML = ""; slot.appendChild(el("p", { class: "ac-sub", text: "Checking…" }));
    if (!sb.auth.mfa || !sb.auth.mfa.listFactors) { slot.innerHTML = ""; slot.appendChild(el("p", { class: "ac-sub", text: "Two-factor isn't available on the server yet." })); return; }
    sb.auth.mfa.listFactors().then(function (r) {
      var tf = (r && r.data && r.data.totp) || [];
      var on = tf.filter(function (x) { return x.status === "verified"; });
      slot.innerHTML = "";
      if (on.length) {
        slot.appendChild(el("p", { class: "ac-2fa__on", html: TICK_SVG + "<span>Two-factor is <strong>on</strong>.</span>" }));
        var off = el("button", { class: "btn ghost ac-action ac-action--danger", type: "button", text: "Turn off two-factor" });
        off.addEventListener("click", function () {
          if (!window.confirm("Turn off two-factor? You'll sign in with just your password.")) return;
          say(msg, "Turning off…");
          sb.auth.mfa.unenroll({ factorId: on[0].id }).then(function (res) {
            if (res.error) say(msg, (res.error.message || "Couldn't turn it off") + " — sign in again with a code first, then retry.", "err");
            else { say(msg, "Two-factor turned off.", "ok"); refresh(); }
          }).catch(function () { say(msg, "Couldn't turn it off — try again.", "err"); });
        });
        slot.appendChild(off);
      } else {
        var start = el("button", { class: "btn ac-action", type: "button", text: "Turn on two-factor" });
        start.addEventListener("click", function () { startEnroll(sb, slot, msg, refresh, tf); });
        slot.appendChild(start);
      }
    }).catch(function () { slot.innerHTML = ""; slot.appendChild(el("p", { class: "ac-sub", text: "Couldn't check your two-factor status." })); });
  }
  refresh();
  return box;
}
function startEnroll(sb, slot, msg, refresh, existing) {
  say(msg, "Setting up…");
  (existing || []).filter(function (x) { return x.status !== "verified"; }).forEach(function (x) { try { sb.auth.mfa.unenroll({ factorId: x.id }); } catch (e) {} });
  sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator " + Date.now() }).then(function (r) {
    if (r.error) { say(msg, r.error.message || "Couldn't start setup — make sure two-factor is enabled on the server.", "err"); return; }
    say(msg, "");
    var d = r.data, fid = d.id, totp = d.totp || {};
    slot.innerHTML = "";
    var step = el("div", { class: "ac-2fa__enroll" });
    step.appendChild(el("p", { class: "ac-sub", text: "1. Scan this in your authenticator app, or type the key by hand." }));
    var qr = el("div", { class: "ac-2fa__qr" });
    if (totp.qr_code) { if (/^\s*<svg/i.test(totp.qr_code)) qr.innerHTML = totp.qr_code; else { var img = el("img", { alt: "Two-factor QR code" }); img.src = totp.qr_code; qr.appendChild(img); } }
    step.appendChild(qr);
    if (totp.secret) step.appendChild(el("p", { class: "ac-2fa__key", html: "Key: <code>" + escapeHtml(totp.secret) + "</code>" }));
    step.appendChild(el("p", { class: "ac-sub", text: "2. Enter the 6-digit code it shows." }));
    var row = el("div", { class: "ac-2fa__verify" });
    var inp = el("input", { class: "ac-input ac-codein", type: "text", inputmode: "numeric", autocomplete: "one-time-code", maxlength: "7", placeholder: "123456" });
    var go = el("button", { class: "btn", type: "button", text: "Verify" });
    row.appendChild(inp); row.appendChild(go); step.appendChild(row);
    var cancel = el("button", { class: "ac-link", type: "button", text: "Cancel" });
    cancel.addEventListener("click", function () { try { sb.auth.mfa.unenroll({ factorId: fid }); } catch (e) {} refresh(); });
    step.appendChild(cancel);
    slot.appendChild(step);
    try { inp.focus(); } catch (e) {}
    go.addEventListener("click", function () {
      var code = (inp.value || "").replace(/\s+/g, "");
      if (!/^\d{6}$/.test(code)) { say(msg, "Enter the 6-digit code.", "warn"); return; }
      go.disabled = true; say(msg, "Verifying…");
      sb.auth.mfa.challenge({ factorId: fid }).then(function (ch) {
        if (ch.error) { go.disabled = false; say(msg, "Couldn't verify — try again.", "err"); return; }
        sb.auth.mfa.verify({ factorId: fid, challengeId: ch.data.id, code: code }).then(function (v) {
          go.disabled = false;
          if (v.error) { say(msg, "That code didn't match — enter the current one.", "err"); return; }
          say(msg, "Two-factor is on. 💛", "ok");
          try { if (window.Site && Site.sfx) Site.sfx("win"); } catch (e) {}
          refresh();
        }).catch(function () { go.disabled = false; say(msg, "Couldn't verify — try again.", "err"); });
      }).catch(function () { go.disabled = false; say(msg, "Couldn't verify — try again.", "err"); });
    });
  }).catch(function () { say(msg, "Couldn't start setup — try again.", "err"); });
}

/* ---------- boot + return-link handling ---------- */
function boot() {
  if (!feat("accounts")) { renderComingSoon(); return; }
  var q = new URLSearchParams(location.search);

  /* Email links (reset, confirm) come back with the sign-in in the URL: #access_token=… (or ?code=…), or
     #error_code=otp_expired when the link is stale. The Supabase client must read that BEFORE the address is
     tidied; stripping it first is what left reset-link visitors with "Auth session missing" on save. */
  var hp = new URLSearchParams((location.hash || "").replace(/^#/, ""));
  var linkErr = hp.get("error_description") || q.get("error_description") || "";
  var fromLink = hp.has("access_token") || q.has("code") || !!linkErr;
  if (q.has("reset")) {
    if (linkErr) { stripQuery(); renderResetForm(linkErr); return; }
    supa().then(function (sb) { return sb ? sb.auth.getSession() : null; })
      .then(function () { stripQuery(); renderResetForm(); }, function () { stripQuery(); renderResetForm(); });
    return;
  }
  if (fromLink && !linkErr) {               /* let the client pick up the session from a confirm link, then carry on */
    supa().then(function (sb) { return sb ? sb.auth.getSession() : null; })
      .then(function () { bootRest(q); }, function () { bootRest(q); });
    return;
  }
  bootRest(q);
}
function bootRest(q) {
  if (q.has("confirmed")) { toast("Email confirmed — you're Verified. Welcome aboard! 💛", "ok"); try { if (window.Site && Site.sfx) Site.sfx("win"); } catch (e) {} stripQuery(); }
  if (q.has("linked")) { stripQuery(); verifyAfterLink(); return; }

  if (hasSession()) renderAccount();
  else renderSignedOut();
}
function stripQuery() { try { history.replaceState(null, "", location.pathname); } catch (e) {} }   /* drops ?query and #hash */

/* after linkIdentity returns, verify-member needs the provider_token to set discord_member (same as a Discord sign-in) */
function verifyAfterLink() {
  renderAccount();
  supa().then(function (sb) {
    if (!sb) return;
    sb.auth.getSession().then(function (res) {
      var s = res && res.data && res.data.session;
      var tok = s && s.provider_token;
      if (!tok) return;
      sb.functions.invoke("verify-member", { body: { provider_token: tok } }).then(function () { renderAccount(); }).catch(function () {});
    }).catch(function () {});
  });
}

if (window.Site && Site.ready) Site.ready(boot, "account");
else boot();
