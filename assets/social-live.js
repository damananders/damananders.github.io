/* social-live.js: live touches on the header social buttons (see assets/README.md).
 *   Twitch   LIVE badge + glow while the channel is live (rechecked every 3 minutes while the tab is visible)
 *   Discord  member count pill
 *   Ko-fi    goal bar + popover, only when Site.config.kofi.goal has numeric current and target
 * Each one is simply absent when its data is missing. Only inline sl-* elements are appended to the buttons.
 */
(function () {
  "use strict";
  if (!window.Site) return;
  var Site = window.Site, el = Site.el;
  var cfg = Site.config || {}, feats = cfg.features || {};
  function enabled(k) { return feats[k] !== false; }
  function btn(kind) { return document.querySelector(".socials .social." + kind) || document.querySelector(".social." + kind); }
  /* remember and restore an attribute we override */
  function setAttr(node, name, value) {
    var key = "slPrev" + name.replace(/[^a-z]/gi, "");
    if (!(key in node.dataset)) node.dataset[key] = node.hasAttribute(name) ? "1" + node.getAttribute(name) : "0";
    node.setAttribute(name, value);
  }
  function restoreAttr(node, name) {
    var key = "slPrev" + name.replace(/[^a-z]/gi, "");
    if (!(key in node.dataset)) return;
    var prev = node.dataset[key]; delete node.dataset[key];
    if (prev.charAt(0) === "1") node.setAttribute(name, prev.slice(1)); else node.removeAttribute(name);
  }
  function compact(n) {
    n = Math.max(0, Math.round(Number(n) || 0));
    function trim(x, unit) { return String(x).replace(/\.0$/, "") + unit; }
    if (n < 1000) return String(n);
    if (n < 9950) return trim((n / 1000).toFixed(1), "k");
    if (n < 999500) return Math.round(n / 1000) + "k";
    return trim((n / 1e6).toFixed(1), "M");
  }

  /* ---------- Twitch: live badge ---------- */
  Site.ready(function () {
    if (!enabled("twitchLive")) return;
    var b = btn("twitch"); if (!b) return;
    var badge = null, last = 0, busy = false, EVERY = 180000;
    function show(uptime) {
      if (!badge) {
        badge = el("span", { class: "sl-badge sl-live", "aria-hidden": "true" }, el("i", { class: "sl-live__dot" }), "Live");
        b.appendChild(badge);
      }
      b.classList.add("sl-on", "sl-is-live");
      setAttr(b, "aria-label", "Twitch, live now");
      setAttr(b, "title", uptime ? "Live now, up for " + uptime : "Live now");
    }
    function hide() {
      if (badge) { badge.remove(); badge = null; }
      b.classList.remove("sl-is-live");
      if (!b.querySelector(".sl-badge,.sl-goal")) b.classList.remove("sl-on");
      restoreAttr(b, "aria-label"); restoreAttr(b, "title");
    }
    function check() {
      if (busy || document.hidden) return;
      busy = true; last = Date.now();
      Site.live.twitch().then(function (s) {
        busy = false;
        if (s && s.live === true) show(typeof s.uptime === "string" ? s.uptime.trim() : ""); else hide();
      }, function () { busy = false; hide(); });
    }
    check();
    setInterval(function () { if (!document.hidden) check(); }, EVERY);
    document.addEventListener("visibilitychange", function () { if (!document.hidden && Date.now() - last >= EVERY) check(); });
  }, "social-twitch");

  /* ---------- Twitch: follower count ---------- */
  Site.ready(function () {
    if (!enabled("twitchFollowers")) return;
    var t = cfg.twitch || {};
    if (!t.channel || t.showFollowers === false) return;
    var b = btn("twitch"); if (!b) return;
    var pill = null;
    function show(n) {
      n = Math.round(Number(n));
      if (!(n >= 0)) return hide();
      if (!pill) { pill = el("span", { class: "sl-badge sl-count sl-follows", "aria-hidden": "true" }); b.appendChild(pill); }
      pill.textContent = compact(n);
      b.classList.add("sl-on");
    }
    function hide() {
      if (pill) { pill.remove(); pill = null; }
      if (!b.querySelector(".sl-badge,.sl-goal")) b.classList.remove("sl-on");
    }
    /* decapi returns a bare number when the channel exists, a short error phrase otherwise */
    function fetchCount() {
      return Site.fetchJSON("https://decapi.me/twitch/followcount/" + encodeURIComponent(t.channel), { ttl: 600, text: true, timeout: 5000 }).then(function (txt) {
        if (typeof txt !== "string") return null;
        var s = txt.trim().replace(/,/g, "");
        return (s && s.length < 12 && /^\d+$/.test(s)) ? parseInt(s, 10) : null;
      });
    }
    var testing = !!Site.debug("twitch");
    var seen = testing ? null : Site.store.get("sl.twfollow", null);
    if (seen && typeof seen.n === "number" && Date.now() - (seen.t || 0) < 7 * 864e5) show(seen.n);
    fetchCount().then(function (n) {
      if (n == null) { if (!seen) hide(); return; }
      show(n);
      if (!testing) Site.store.set("sl.twfollow", { n: n, t: Date.now() });
    }, function () { if (!seen) hide(); });
  }, "social-twitch-followers");

  /* ---------- Discord: member count ---------- */
  Site.ready(function () {
    if (!enabled("discordCount")) return;
    if (cfg.discord && cfg.discord.showCount === false) return;
    var b = btn("discord"); if (!b) return;
    var pill = null;
    function show(d) {
      var members = Math.round(Number(d.members));
      if (!(members > 0)) return hide();
      if (!pill) { pill = el("span", { class: "sl-badge sl-count", "aria-hidden": "true" }); b.appendChild(pill); }
      pill.textContent = compact(members);
      b.classList.add("sl-on");
      var online = Math.round(Number(d.online)) || 0;
      var long = Site.fmtNum(members) + (members === 1 ? " member" : " members") + (online > 0 ? ", " + Site.fmtNum(online) + " online" : "");
      setAttr(b, "title", long);
      setAttr(b, "aria-label", "Discord, " + long);
    }
    function hide() {
      if (pill) { pill.remove(); pill = null; }
      if (!b.querySelector(".sl-badge,.sl-goal")) b.classList.remove("sl-on");
      restoreAttr(b, "title"); restoreAttr(b, "aria-label");
    }
    /* The last count this browser saw is drawn straight away so the button doesn't change width a moment after load. */
    var testing = !!Site.debug("discord");
    var seen = testing ? null : Site.store.get("sl.discord", null);
    if (seen && typeof seen.members === "number" && Date.now() - (seen.t || 0) < 7 * 864e5) show(seen);
    Site.live.discord().then(function (d) {
      if (!d || typeof d.members !== "number") { if (!seen) hide(); return; }
      show(d);
      if (!testing && d.members > 0) Site.store.set("sl.discord", { members: d.members, online: d.online || 0, t: Date.now() });
    });
  }, "social-discord");

  /* ---------- Ko-fi: goal bar + popover ---------- */
  Site.ready(function () {
    if (!enabled("kofiGoal")) return;
    var g = cfg.kofi && cfg.kofi.goal; if (!g) return;
    function num(v) { if (typeof v === "number") return isFinite(v) ? v : NaN; if (typeof v === "string" && v.trim() !== "") return Number(v); return NaN; }
    var current = num(g.current), target = num(g.target);
    if (isNaN(current) || isNaN(target) || !(target > 0) || current < 0) return;
    var b = btn("kofi"); if (!b) return;
    var pct = Math.max(0, Math.min(100, Math.round(current / target * 100)));
    var sign = typeof g.currency === "string" ? g.currency : "$";
    var title = (typeof g.title === "string" && g.title.trim()) || "Ko-fi goal";
    function money(n) { return sign + Site.fmtNum(Math.round(n * 100) / 100); }
    var p = pct + "%";
    var started = current > 0;            /* only show the meter once there's momentum — an empty bar reads as begging */
    var remaining = Math.max(0, target - current);

    /* the thin bar under the button only once donations have started */
    var pop = el("span", { class: "sl-pop", id: "sl-goal-pop", role: "tooltip", style: { "--sl-p": p } },
      el("span", { class: "sl-pop__title", text: title }));
    if (started) {
      b.appendChild(el("span", { class: "sl-goal", "aria-hidden": "true", style: { "--sl-p": p } }, el("i")));
      pop.appendChild(el("span", { class: "sl-pop__row" }, el("b", { text: money(current) + " of " + money(target) }), el("span", { text: p })));
      pop.appendChild(el("span", { class: "sl-pop__bar", "aria-hidden": "true" }, el("i")));
      pop.appendChild(el("span", { class: "sl-pop__note", text: remaining > 0 ? money(remaining) + " to go this month" : "Goal reached — thank you! 💛" }));
    } else {
      pop.appendChild(el("span", { class: "sl-pop__note", text: "Fan projects I build for fun and run at my own cost. Anything at all helps keep them online — no pressure." }));
    }
    pop.appendChild(el("span", { class: "sl-pop__cta", text: "Buy me a coffee ☕ →" }));
    b.appendChild(pop);
    b.classList.add("sl-on", "sl-has-goal");
    var desc = b.getAttribute("aria-describedby");
    b.setAttribute("aria-describedby", desc ? desc + " sl-goal-pop" : "sl-goal-pop");

    /* keep the popover inside the window */
    function place() {
      b.classList.remove("sl-pop-off");
      pop.style.setProperty("--sl-x", "0px");
      var r = b.getBoundingClientRect(), w = pop.offsetWidth, vw = document.documentElement.clientWidth, x = 0;
      if (r.left + w > vw - 12) x = vw - 12 - w - r.left;
      if (r.left + x < 12) x = 12 - r.left;
      pop.style.setProperty("--sl-x", Math.round(x) + "px");
    }
    b.addEventListener("mouseenter", place);
    b.addEventListener("focus", place);
    /* Escape (or the site-wide "close what you own" signal) hides it until the pointer or focus comes back */
    function dismiss() { b.classList.add("sl-pop-off"); }
    b.addEventListener("keydown", function (e) { if (e.key === "Escape") dismiss(); });
    b.addEventListener("mouseleave", function () { b.classList.remove("sl-pop-off"); });
    b.addEventListener("blur", function () { b.classList.remove("sl-pop-off"); });
    Site.on("ui:escape", dismiss);
  }, "social-kofi");
})();
