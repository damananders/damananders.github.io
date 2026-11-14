/* pages/support.js: the on-site donation page (/support/).
 * Two ways to give — a one-time tip of any amount, or $5 a month — both handled on-site through Stripe
 * Checkout, gated behind the same Discord sign-in as Rate-O-Pedia. The backend (create-donation-checkout
 * edge function, donation_progress rpc, member_supporters) lives on the Rate-O-Pedia side; this file only
 * calls it. Everything degrades to a friendly "being set up" state until those are deployed.
 */
import { sb, me, onAuth, signIn } from "/assets/pages/games.common.js?v=16";

const $ = (id) => document.getElementById(id);
const toast = (msg, type) => { try { if (window.Site && Site.toast) Site.toast(msg, { type: type || "info" }); } catch (e) {} };
const money = (c) => { c = Math.round(Number(c) || 0); return "$" + (c % 100 === 0 ? (c / 100).toFixed(0) : (c / 100).toFixed(2)); };

/* ---------- elements ---------- */
var amtWrap = $("sup-amts"), custom = $("sup-custom-input");
var onceBtn = $("sup-once"), onceAmt = $("sup-once-amt");
var monthBtn = $("sup-month"), manageLink = $("sup-manage"), signinNote = $("sup-signin");
var goalCard = $("sup-goal"), goalPct = $("sup-goal-pct"), goalLine = $("sup-goal-line"), barFill = $("sup-bar-fill");
var banner = $("sup-banner");

/* ---------- amount picker (one-time) ---------- */
function selectedPreset() { var on = amtWrap.querySelector(".sup-amt.is-on"); return on ? Number(on.dataset.amt) : 0; }
function currentDollars() {
  var c = parseFloat(custom.value);
  if (custom.value.trim() !== "" && isFinite(c) && c > 0) return c;
  return selectedPreset();
}
function syncLabel() {
  var d = currentDollars();
  onceAmt.textContent = d > 0 ? "$" + (Number.isInteger(d) ? d : d.toFixed(2)) : "a tip";
}
Array.prototype.forEach.call(amtWrap.querySelectorAll(".sup-amt"), function (b) {
  b.addEventListener("click", function () {
    amtWrap.querySelectorAll(".sup-amt").forEach(function (x) { x.classList.remove("is-on"); });
    b.classList.add("is-on");
    custom.value = "";
    syncLabel();
  });
});
custom.addEventListener("input", function () {
  if (custom.value.trim() !== "") amtWrap.querySelectorAll(".sup-amt").forEach(function (x) { x.classList.remove("is-on"); });
  syncLabel();
});
syncLabel();

/* ---------- checkout ---------- */
var busy = false;
function setBusy(btn, v) { busy = v; [onceBtn, monthBtn].forEach(function (b) { b.disabled = v; }); if (btn && v) btn.classList.add("is-busy"); else if (btn) btn.classList.remove("is-busy"); }

async function checkout(body, btn) {
  if (busy) return;
  if (!me.user) { signIn(); return; }               /* send them through Discord sign-in first */
  setBusy(btn, true);
  try {
    var res = await sb.functions.invoke("create-donation-checkout", { body: body });
    var data = res && res.data, error = res && res.error;
    if (data && data.url) { location.href = data.url; return; }
    var status = 0, emsg = (data && data.error) || "";
    if (error) {
      if (error.context && typeof error.context.status === "number") status = error.context.status;
      try { if (error.context && error.context.json) { var j = await error.context.json(); if (j && j.error) emsg = j.error; } } catch (e) {}
    }
    if (status === 401) { signIn(); return; }
    if (status === 400) { toast(emsg || "Please pick an amount between $1 and $1,000.", "warn"); return; }
    if (status === 404 || status === 503 || status === 0) {
      /* function not deployed, key not set, or couldn't be reached — genuinely not live yet */
      toast("Donations are being set up — check back soon. 💛");
      return;
    }
    /* any other status (e.g. a 500 from Stripe) is a real error — surface it, don't hide it */
    console.error("[support] checkout failed:", status, emsg);
    toast(emsg || "Something went wrong — please try again in a moment.", "err");
  } catch (e) {
    console.error("[support] checkout threw:", e);
    toast("Donations are being set up — check back soon. 💛");
  } finally {
    setBusy(btn, false);
  }
}

onceBtn.addEventListener("click", function () {
  var d = currentDollars();
  if (!(d >= 1 && d <= 1000)) { toast("Pick an amount between $1 and $1,000.", "warn"); custom.focus(); return; }
  checkout({ tier: "custom", interval: "once", amount_cents: Math.round(d * 100) }, onceBtn);
});
monthBtn.addEventListener("click", function () {
  if (monthBtn.classList.contains("is-done")) { checkout({ action: "portal" }, monthBtn); return; }
  checkout({ tier: "monthly", interval: "month" }, monthBtn);
});
manageLink.addEventListener("click", function (e) { e.preventDefault(); checkout({ action: "portal" }, monthBtn); });

/* ---------- supporter state (reflects a live monthly gift) ---------- */
async function refreshSupporter() {
  manageLink.hidden = true;
  monthBtn.classList.remove("is-done");
  if (me.user) {
    signinNote.textContent = "You're signed in with Discord. Payments are handled securely by Stripe — I never see your card details.";
  }
  if (!me.user || !me.profile || !me.profile.handle) return;
  try {
    var res = await sb.from("member_supporters").select("supporter_since,supporter_tier").eq("handle", me.profile.handle).maybeSingle();
    var row = res && res.data;
    if (row && row.supporter_tier === "monthly") {
      manageLink.hidden = false;
      monthBtn.classList.add("is-done");
      monthBtn.textContent = "You're a monthly supporter 💛";
    }
  } catch (e) {}
}
onAuth(refreshSupporter);

/* ---------- this month's goal bar ---------- */
async function loadProgress() {
  try {
    var res = await sb.rpc("donation_progress");
    if (!res || res.error || !res.data) return;             /* rpc missing until SQL 22 — just stay hidden */
    var row = Array.isArray(res.data) ? res.data[0] : res.data;
    if (!row) return;
    var goal = Number(row.goal_cents) || 7500;
    var month = Math.max(0, Number(row.month_cents) || 0);
    var sup = Math.max(0, Number(row.supporters) || 0);
    var pct = Math.max(0, Math.min(100, Math.round(month / goal * 100)));
    goalPct.textContent = month > 0 ? pct + "%" : "";                 /* a bright 0% reads as discouraging */
    barFill.parentNode.classList.toggle("sup-bar--empty", month <= 0);
    requestAnimationFrame(function () { barFill.style.width = pct + "%"; });
    var remaining = Math.max(0, goal - month);
    var line;
    if (month <= 0) line = money(goal) + " a month keeps everything running. Be the first to chip in this month.";
    else if (remaining <= 0) line = money(month) + " raised this month — goal reached. Thank you! 💛";
    else line = money(month) + " of " + money(goal) + " this month" + (sup > 0 ? " · " + sup + (sup === 1 ? " supporter" : " supporters") : "");
    goalLine.textContent = line;
    goalCard.hidden = false;
  } catch (e) {}
}

/* ---------- return from Stripe ---------- */
function showBanner(html, kind) {
  banner.className = "sup-flash sup-flash--" + kind;
  banner.innerHTML = html;
  banner.hidden = false;
}
(function handleReturn() {
  var q = new URLSearchParams(location.search);
  if (q.has("thanks")) {
    showBanner("<strong>Thank you so much.</strong> You're the reason these projects stay online — it genuinely means a lot. 💛", "thanks");
    try { if (window.Site && Site.sfx) Site.sfx("win"); } catch (e) {}
  } else if (q.has("cancelled")) {
    showBanner("No worries at all — the door's always open if you change your mind.", "cancelled");
  } else return;
  try { history.replaceState(null, "", location.pathname); } catch (e) {}
})();

loadProgress();
