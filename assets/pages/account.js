/* pages/account.js — the native DMA Account page (/account/).
 *
 * SITE-owned front end for the native-account system (see the "DMA Accounts — Native Sign-up Plan" and the
 * backend contract at /mnt/project-files/site-hub/rateopedia/DMA_ACCOUNTS_API.md). Two ways to a full account:
 * a standalone DMA Account (email + password) or Continue with Discord; either can link the other to become a
 * joint account and sign in whichever way they like.
 *
 * The Supabase auth backend (email provider, SMTP, captcha, schema, the member-gate change) lives on the
 * Rate-O-Pedia / Supabase side (SQL 32). This file only calls it, and stays dark behind
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

/* ---------- Turnstile captcha (mounts only when the owner has set a site key) ---------- */
var _captchaToken = "";
window.__acCaptcha = function (t) { _captchaToken = t || ""; };
var _turnstileLoaded = false;
function mountCaptcha(hostId) {
  if (!CAPTCHA_KEY) return;                 /* no key yet → captcha skipped until the owner wires it */
  var host = document.getElementById(hostId);
  if (host) host.setAttribute("aria-hidden", "false");
  function render() { try { if (window.turnstile && host) window.turnstile.render(host, { sitekey: CAPTCHA_KEY, callback: window.__acCaptcha }); } catch (e) {} }
  if (window.turnstile) { render(); return; }
  if (!_turnstileLoaded) {
    _turnstileLoaded = true;
    var s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true; s.defer = true; s.onload = render;
    document.head.appendChild(s);
  } else { setTimeout(render, 400); }
}
/* add captchaToken to an options object only when we actually have one */
function withCaptcha(opts) { opts = opts || {}; if (CAPTCHA_KEY && _captchaToken) opts.captchaToken = _captchaToken; return opts; }
function captchaReady(msg) {
  if (CAPTCHA_KEY && !_captchaToken) { say(msg, "Please complete the captcha first.", "warn"); return false; }
  return true;
}

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
  cf.appendChild(el("p", { class: "ac-fine", text: "I'll email a confirmation link — click it to finish and you're Verified." }));
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
  mountCaptcha("ac-captcha"); /* now that #ac-captcha is in the document */
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
  if (!captchaReady(msg)) return;
  lock(btn, true, "Creating…");
  say(msg, "Creating your account…");
  supa().then(function (sb) {
    if (!sb) { done(); return; }
    sb.auth.signUp({
      email: email, password: pw,
      options: withCaptcha({ emailRedirectTo: location.origin + "/account/?confirmed=1", data: { display_name: name, handle: handle } })
    }).then(function (res) {
      lock(btn, false);
      var err = res && res.error;
      if (err) {
        var m = String(err.message || "");
        if (/captcha/i.test(m)) say(msg, "Please complete the captcha and try again.", "warn");
        else say(msg, m || "Couldn't create the account — please try again.", "err");
        return;
      }
      /* collision: Supabase returns a user with an empty identities array and sends no email */
      var u = res && res.data && res.data.user;
      if (u && Array.isArray(u.identities) && u.identities.length === 0) {
        say(msg, "That email already has an account. Sign in, then add a password from this page.", "warn");
        return;
      }
      say(msg, "Almost there! Check your email for a confirmation link to finish. 💛", "ok");
      try { if (window.Site && Site.sfx) Site.sfx("win"); } catch (e) {}
    }).catch(done);
  });
  function done() { lock(btn, false); say(msg, "Accounts are being set up — check back soon. 💛"); }
}

/* ---------- sign-in (email only — handle sign-in would leak which email a handle uses) ---------- */
function doSignIn(btn, msg) {
  if (busy) return;
  var email = val("ac-si-email").trim(), pw = val("ac-si-pw");
  if (!validEmail(email)) { say(msg, "Enter the email you signed up with.", "warn"); return; }
  if (!pw) { say(msg, "Enter your password.", "warn"); return; }
  if (!captchaReady(msg)) return;
  lock(btn, true, "Signing in…");
  say(msg, "Signing you in…");
  supa().then(function (sb) {
    if (!sb) { done(); return; }
    sb.auth.signInWithPassword(withCaptcha({ email: email, password: pw })).then(function (res) {
      lock(btn, false);
      var err = res && res.error;
      if (err) {
        if (/confirm/i.test(err.message || "")) say(msg, "Please confirm your email first — check your inbox for the link.", "warn");
        else say(msg, "That email and password don't match.", "err");
        return;
      }
      say(msg, "Welcome back! Taking you in…", "ok");
      var back = "/games/profile/";
      try { back = localStorage.getItem("site.syncReturn") || back; localStorage.removeItem("site.syncReturn"); } catch (e) {}
      location.href = back;
    }).catch(done);
  });
  function done() { lock(btn, false); say(msg, "Accounts are being set up — check back soon. 💛"); }
}

/* ---------- password reset ---------- */
function doReset(msg) {
  var id = (val("ac-si-email") || "").trim();
  if (!validEmail(id)) { say(msg, "Type your account email above, then tap this again.", "warn"); return; }
  say(msg, "Sending a reset link…");
  supa().then(function (sb) {
    if (!sb) { say(msg, "Password reset is being set up — check back soon."); return; }
    sb.auth.resetPasswordForEmail(id, withCaptcha({ redirectTo: location.origin + "/account/?reset=1" })).then(function (res) {
      if (res && res.error) say(msg, "Couldn't send the reset link — try again in a moment.", "err");
      else say(msg, "If that email has an account, a reset link is on its way. 💛", "ok");
    }).catch(function () { say(msg, "Password reset is being set up — check back soon."); });
  });
}

/* ---------- set a new password (arriving via the reset link, ?reset=1) ---------- */
function renderResetForm() {
  clear();
  var card = el("section", { class: "panel pg-card ac-form ac-reset", "data-reveal": "" });
  card.appendChild(el("h2", { text: "Set a new password" }));
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
        if (res && res.error) say(m, res.error.message || "Couldn't update the password.", "err");
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

  var hello = el("p", { class: "ac-hello", html: "Signed in as <strong>" + escapeHtml(name) + "</strong>" + (handle ? ' <span class="ac-at">@' + escapeHtml(handle) + "</span>" : "") });
  body.appendChild(hello);

  var marks = el("div", { class: "ac-marks" });
  if (a.verified) marks.appendChild(el("span", { class: "ac-badge ac-badge--verified", html: TICK_SVG + "<span>Verified</span>" }));
  if (a.cooldown_until) marks.appendChild(el("span", { class: "ac-badge ac-badge--cool", text: "New account — full voting soon" }));
  if (a.restricted) marks.appendChild(el("span", { class: "ac-badge ac-badge--restricted", text: "Restricted" }));
  if (marks.childNodes.length) body.appendChild(marks);

  /* linked logins */
  var links = el("div", { class: "ac-links" });
  links.appendChild(identRow("DMA Account", hasDma, "email + password", !hasDma ? "Add a password login" : null, function () { addDma(sb); }));
  links.appendChild(identRow("Discord", hasDiscord, "linked", !hasDiscord ? "Link Discord" : null, function () { linkDiscord(sb); }));
  body.appendChild(links);

  /* flair picker (Verified ✔ is separate and always shown) */
  var flair = el("div", { class: "ac-flair" });
  flair.appendChild(el("h3", { text: "Profile flair" }));
  flair.appendChild(el("p", { class: "ac-sub", text: joint ? "You've linked both — show your Discord flair, your DMA flair, or both." : "The badge shown next to your name. More unlock as you link accounts." }));
  var choices = el("div", { class: "ac-flair__row" });
  if (hasDiscord) choices.appendChild(flairChip("discord", "Discord", a.flair));
  if (hasDma) choices.appendChild(flairChip("dma", "DMA", a.flair));
  if (joint) choices.appendChild(flairChip("both", "Both", a.flair));
  choices.addEventListener("click", function (e) {
    var chip = e.target.closest(".ac-flair__chip"); if (!chip) return;
    choices.querySelectorAll(".ac-flair__chip").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
    chip.setAttribute("aria-pressed", "true");
    saveFlair(sb, chip.dataset.flair);
  });
  flair.appendChild(choices);
  body.appendChild(flair);

  /* actions */
  var sec = el("div", { class: "ac-actions" });
  if (hasDma) sec.appendChild(actionBtn("Change password", function () { changePw(sb); }));
  sec.appendChild(actionBtn("Set up 2FA", function () { toast("Two-factor sign-in is coming with the security phase.", "info"); }));
  sec.appendChild(actionBtn("Download my data", function () { toast("Data export is coming soon.", "info"); }));
  var out = actionBtn("Sign out", function () { signOut(sb); });
  out.classList.add("ac-action--danger");
  sec.appendChild(out);
  body.appendChild(sec);
  body.appendChild(el("p", { class: "ac-msg", id: "ac-home-msg", role: "status" }));
  body.appendChild(el("p", { class: "ac-fine", html: 'Manage your public profile, avatar and bio over on <a href="/games/profile/">your profile →</a>' }));
}

function identRow(label, on, detail, actionLabel, onAction) {
  var row = el("div", { class: "ac-ident" + (on ? " is-on" : "") });
  var head = el("div", { class: "ac-ident__head" });
  head.appendChild(el("span", { class: "ac-ident__dot", "aria-hidden": "true" }));
  head.appendChild(el("span", { class: "ac-ident__name", text: label }));
  if (on) head.appendChild(el("span", { class: "ac-ident__state", html: TICK_SVG + "<span>" + escapeHtml(detail || "Linked") + "</span>" }));
  row.appendChild(head);
  if (actionLabel) { var b = el("button", { class: "ac-link", type: "button", text: actionLabel }); b.addEventListener("click", onAction); row.appendChild(b); }
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

/* ---------- boot + return-link handling ---------- */
function boot() {
  if (!feat("accounts")) { renderComingSoon(); return; }
  var q = new URLSearchParams(location.search);

  if (q.has("reset")) { stripQuery(); renderResetForm(); return; }
  if (q.has("confirmed")) { toast("Email confirmed — you're Verified. Welcome aboard! 💛", "ok"); try { if (window.Site && Site.sfx) Site.sfx("win"); } catch (e) {} stripQuery(); }
  if (q.has("linked")) { stripQuery(); verifyAfterLink(); return; }

  if (hasSession()) renderAccount();
  else renderSignedOut();
}
function stripQuery() { try { history.replaceState(null, "", location.pathname); } catch (e) {} }

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
