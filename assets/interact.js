/* Site-wide motion and input (see assets/README.md). Styles: assets/interact.css. Class prefix: ix-.
 *
 *   1. Cursor ring            fine pointers only; Settings row "Cursor ring"; features.cursorRing
 *   2. Page transitions       cross-document View Transitions, or a quick fade where they are missing; features.transitions
 *   3. Button feedback        ripple on .btn / .social / #go, UI sound requests (press-down is plain CSS)
 *   4. Konami code            keyboard and controller; features.konami
 *   5. Controller navigation  D-pad / stick moves focus, A selects, B goes back, Start opens settings, LB / RB scroll
 *
 * Each feature runs inside its own Site.ready() block, so one failing cannot stop the others.
 * Nothing here is needed for the pages to work: without this file they simply lose the extras.
 */
(function () {
  "use strict";
  if (!window.Site) return;

  var Site = window.Site, doc = document, root = doc.documentElement;
  var features = (Site.config && Site.config.features) || {};
  var finePointer = window.matchMedia ? matchMedia("(hover: hover) and (pointer: fine)") : { matches: false };

  /* Maintenance Hatch early stub — hatch.js loads async (via the add-on loader below), so a page's
     editable regions can call Site.hatch.register() before it arrives (e.g. the arcade panels). This
     synchronous stub (interact.js runs before any async module) queues those registrations; hatch.js
     drains the queue when it defines the real API, so nothing is lost to the load race. */
  if (!Site.hatch) {
    Site.hatch = {
      _queue: [],
      _stub: true,
      register: function (spec) { if (spec && spec.id) Site.hatch._queue.push(spec); return spec; },
      canEdit: function () { return false; },
      get: function () { return undefined; }
    };
  }

  function enabled(name) { return features[name] !== false; }
  function mqListen(mq, fn) { if (mq.addEventListener) mq.addEventListener("change", fn); else if (mq.addListener) mq.addListener(fn); }
  function closest(e, sel) { var t = e && e.target; return t && t.closest ? t.closest(sel) : null; }
  function usable(n) { return !!n && !n.disabled && n.getAttribute("aria-disabled") !== "true"; }

  /* A link that loads another page of this site in this tab (not a new tab, a download, a file or a #hash jump). */
  function internalLink(a) {
    if (!a || !a.getAttribute || a.hasAttribute("download") || !usable(a)) return false;
    var target = (a.getAttribute("target") || "").toLowerCase();
    if (target && target !== "_self") return false;
    if (a.origin !== location.origin || !/^https?:$/.test(a.protocol || "")) return false;
    if (a.pathname === location.pathname && a.search === location.search) return false;
    if (/\.(?!html?$)[a-z0-9]{1,8}$/i.test(a.pathname)) return false;
    return true;
  }

  /* Dialogs opened with showModal() sit in the browser's top layer, above any z-index. Showing an element
     as a manual popover puts it there too, and showing it again moves it back to the front. */
  function topLayer(el) {
    if (!el || typeof el.showPopover !== "function") return false;
    try {
      if (!el.hasAttribute("popover")) el.setAttribute("popover", "manual");
      if (el.matches(":popover-open")) el.hidePopover();
      el.showPopover();
      return true;
    } catch (e) { try { el.removeAttribute("popover"); } catch (e2) {} return false; }
  }

  /* Shared between the features below. */
  var go = function (url) { location.href = url; };   /* the page-transition fallback swaps in a fading version */
  var padSwallow = "";                                 /* a controller press the Konami code has claimed */

  /* ====================================================================================================
   * 1. Cursor reticles (item 40)
   *    A ring by default; members unlock 30 reticles + five look controls (colour, size, follow, click,
   *    glow) from Settings › Appearance › "Reticle". /anyps/ and /anderscraft/ keep their own themed sets;
   *    everywhere else the member's pick wins (the hub still peeks a card's set when the plain ring is on).
   *    Owner and Discord admins see everything unlocked. Other threads can award signal-based reticles via
   *    Site.reticle.grant("wand" | "twitch" | ...).
   * ==================================================================================================== */
  Site.ready(function () {
    if (!enabled("cursorRing")) return;
    var HOT = 'a[href],button,summary,input,select,textarea,label[for],[role="button"],[role="tab"],.avenue';
    var ring = null, active = false, shown = false, raf = 0, last = 0, registered = false;
    var x = 0, y = 0, tx = 0, ty = 0, hot = null, layer = null;
    var dot = null, shapeEl = null, shape = -1, set = null, curRet = null, pickRefresh = null;

    /* ---- the 12-colour tint palette (shared with the picker's colour row) ---- */
    var PALETTE = { rose: "#ff5d73", coral: "#ff784f", amber: "#ffb020", gold: "#ffd34d", lime: "#9bd345", green: "#43c06a",
      teal: "#2bb6a3", sky: "#39a7ff", blue: "#4f7bff", violet: "#8a7dff", magenta: "#d567e0", slate: "#8aa0b5" };
    var COLOR_ORDER = ["rose", "coral", "amber", "gold", "lime", "green", "teal", "sky", "blue", "violet", "magenta", "slate"];

    /* ---- rotating themed sets: forced on the AnyPS / AndersCraft pages, peeked over hub cards ---- */
    var FACE = [
      '<path d="M7 7 23 23M23 7 7 23"/>',
      '<circle cx="15" cy="15" r="11"/>',
      '<path d="M15 4.5 26.5 24.5H3.5Z"/>',
      '<rect x="5" y="5" width="20" height="20" rx="1.5"/>'
    ];
    var WEAPONS = [
      /* sword */ '<path d="M26.5 3.5 25 10 12.5 22.5 7.5 17.5 20 5Z"/><path d="M4.5 14.5 15.5 25.5M10 20 5.2 24.8"/><circle cx="4" cy="26" r="1.7"/>',
      /* arrow */ '<path d="M27 3 24.5 12.5 17.5 5.5Z"/><path d="M21 9 5 25M5 25V19.5L8.5 16M5 25H10.5L14 21.5"/>',
      /* axe   */ '<g transform="rotate(28 15 15)"><path d="M14 2.5V27.5"/><path d="M14 6.5C18 6.5 21 5 23 3 27 8 27 15.5 23 20.5 21 18.5 18 17 14 17Z"/><path d="M14 9H9.5V14.5H14"/></g>'
    ];
    FACE.random = true;
    var FORCED = Site.page === "anyps" ? FACE : Site.page === "anderscraft" ? WEAPONS : null;

    /* ---- a Chipper token face: 0 Poobar … 5 Fromie, red→green and frown→beam ---- */
    function chip(v) {
      var COL = ["#e4584e", "#e8923a", "#e6c23a", "#9ccf43", "#52ab5c", "#33b6a6"][v] || "#9ccf43";
      var mouth = ["M10 21Q15 16.5 20 21", "M10 20.3Q15 18.2 20 20.3", "M10 20H20", "M10 19.4Q15 21.6 20 19.4", "M10 18.7Q15 22.4 20 18.7", "M9.4 18Q15 24 20.6 18"][v] || "M10 20H20";
      return '<circle cx="15" cy="15" r="11" fill="' + COL + '" fill-opacity=".2" stroke="' + COL + '"/>'
        + '<circle cx="11.4" cy="12.7" r="1.5" fill="' + COL + '" stroke="none"/>'
        + '<circle cx="18.6" cy="12.7" r="1.5" fill="' + COL + '" stroke="none"/>'
        + '<path d="' + mouth + '" stroke="' + COL + '" fill="none"/>';
    }
    function pellets() { var s = ""; for (var i = 0; i < 8; i++) { var a = i / 8 * 6.2832; s += '<circle cx="' + (15 + Math.cos(a) * 9).toFixed(1) + '" cy="' + (15 + Math.sin(a) * 9).toFixed(1) + '" r="1.7" fill="currentColor" stroke="none"/>'; } return s; }
    function seasonLook() {
      var m = new Date().getMonth();
      if (m === 11 || m <= 1) return '<path d="M15 4V26M6 9 24 21M24 9 6 21"/><path d="M15 4l-2.4 3M15 4l2.4 3M15 26l-2.4-3M15 26l2.4-3"/>';            /* winter: snowflake */
      if (m <= 4) return '<circle cx="15" cy="9" r="3.1"/><circle cx="21" cy="13" r="3.1"/><circle cx="18.7" cy="20" r="3.1"/><circle cx="11.3" cy="20" r="3.1"/><circle cx="9" cy="13" r="3.1"/><circle cx="15" cy="15" r="2.3" fill="currentColor" stroke="none"/>';   /* spring: blossom */
      if (m <= 7) return '<circle cx="15" cy="15" r="6"/><path d="M15 2.5V6.5M15 23.5V27.5M2.5 15H6.5M23.5 15H27.5M6.2 6.2 9 9M21 21 23.8 23.8M23.8 6.2 21 9M9 21 6.2 23.8"/>';   /* summer: sun */
      return '<path d="M8 22C8 13.5 13.8 7.5 22 8.2 22.8 16.4 16.6 22.3 8 22Z"/><path d="M8 22 19.5 10.5M13 20.5 13.5 15M17 17 17.5 12.2"/>';   /* fall: leaf */
    }

    /* ---- the reticle registry. svg = markup (string | function→string); "ring"/"plain" are special.
       fx = its own click effect; u(c) decides if it is unlocked against a snapshot; hint = how to get it. ---- */
    var RET_LIST = [
      { id: "ring", name: "Classic Ring", fx: "squeeze", hint: "The default — always yours." },
      { id: "plain", name: "Plain Pointer", svg: "", fx: null, hint: "Just your normal mouse pointer." },
      { id: "dot", name: "Dot", svg: '<circle cx="15" cy="15" r="2.7" fill="currentColor" stroke="none"/>', fx: "pulse", hint: "A small aim dot." },
      { id: "cross", name: "Crosshair", svg: '<path d="M15 4V11M15 19V26M4 15H11M19 15H26"/>', fx: "snap", hint: "A four-line crosshair." },
      { id: "chevron", name: "Chevron", svg: '<path d="M7.5 19 15 10.5 22.5 19"/>', fx: "flick", hint: "An upward arrowhead." },
      { id: "reddot", name: "Red Dot Sight", svg: '<circle cx="15" cy="15" r="10"/><circle cx="15" cy="15" r="2.5" fill="#ff4d4d" stroke="none"/>', fx: "flare", hint: "Earn 10 trophies.", u: function (c) { return c.n >= 10; } },
      { id: "scope", name: "Sniper Scope", svg: '<circle cx="15" cy="15" r="11"/><path d="M15 4v6M15 20v6M4 15h6M20 15h6"/><circle cx="15" cy="15" r="1.1" fill="currentColor" stroke="none"/>', fx: "recoil", hint: "Earn 50 trophies.", u: function (c) { return c.n >= 50; } },
      { id: "shotgun", name: "Shotgun Spread", svg: pellets, fx: "burst", hint: "Earn 100 trophies.", u: function (c) { return c.n >= 100; } },
      { id: "hit", name: "Hit Marker", svg: '<path d="M8 8 11.6 11.6M22 8 18.4 11.6M8 22 11.6 18.4M22 22 18.4 18.4"/>', fx: "flash", hint: "Visit every public page.", u: function (c) { return c.pagesAll; } },
      { id: "chip0", name: "Poobar Chip", svg: function () { return chip(0); }, fx: "wobble", hint: "Give a 0 (Poobar) rating on the Dex.", u: function (c) { return c.chip.indexOf(0) >= 0; } },
      { id: "chip1", name: "Eskritt Chip", svg: function () { return chip(1); }, fx: "wobble", hint: "Give a 1 (Eskritt) rating on the Dex.", u: function (c) { return c.chip.indexOf(1) >= 0; } },
      { id: "chip2", name: "Meepo Chip", svg: function () { return chip(2); }, fx: "wobble", hint: "Give a 2 (Meepo) rating on the Dex.", u: function (c) { return c.chip.indexOf(2) >= 0; } },
      { id: "chip3", name: "Gibby Chip", svg: function () { return chip(3); }, fx: "wobble", hint: "Give a 3 (Gibby) rating on the Dex.", u: function (c) { return c.chip.indexOf(3) >= 0; } },
      { id: "chip4", name: "Perisa Chip", svg: function () { return chip(4); }, fx: "wobble", hint: "Give a 4 (Perisa) rating on the Dex.", u: function (c) { return c.chip.indexOf(4) >= 0; } },
      { id: "chip5", name: "Fromie Chip", svg: function () { return chip(5); }, fx: "wobble", hint: "Give a 5 (Fromie) rating on the Dex.", u: function (c) { return c.chip.indexOf(5) >= 0; } },
      { id: "wheel", name: "Chipper Wheel", svg: '<circle cx="15" cy="7.5" r="2.4" fill="#e4584e" stroke="none"/><circle cx="21.5" cy="11.2" r="2.4" fill="#e8923a" stroke="none"/><circle cx="21.5" cy="18.8" r="2.4" fill="#e6c23a" stroke="none"/><circle cx="15" cy="22.5" r="2.4" fill="#9ccf43" stroke="none"/><circle cx="8.5" cy="18.8" r="2.4" fill="#52ab5c" stroke="none"/><circle cx="8.5" cy="11.2" r="2.4" fill="#33b6a6" stroke="none"/>', fx: "spin", hint: "Rate with all six Chippers.", u: function (c) { return [0, 1, 2, 3, 4, 5].every(function (v) { return c.chip.indexOf(v) >= 0; }); } },
      { id: "quill", name: "Critic's Quill", svg: '<path d="M22 8 11 19l-2.5 4 4-2.5L23 9.5Z"/><path d="M11 19l1.8 1.8"/>', fx: "ink", hint: "Write 10 reviews on the Dex.", u: function (c) { return c.reviews >= 10; } },
      { id: "lens", name: "Dex Lens", svg: '<circle cx="13" cy="13" r="7"/><path d="M18 18 25 25"/>', fx: "pulse", hint: "Cast 100 votes on the Dex.", u: function (c) { return c.votes >= 100; } },
      { id: "goldchip", name: "Gold Chip", svg: '<circle cx="15" cy="15" r="10" stroke="#ffcf4d"/><circle cx="15" cy="15" r="2.1" fill="#ffcf4d" stroke="none"/>', fx: "flare", hint: "Become a verified member.", u: function (c) { return c.verified; } },
      { id: "heart", name: "Heart Ring", svg: '<circle cx="15" cy="15" r="10"/><path d="M15 18.6c-3-2-4.5-3.7-4.5-5.4A2.3 2.3 0 0 1 15 11.9a2.3 2.3 0 0 1 4.5 1.3c0 1.7-1.5 3.4-4.5 5.4Z" fill="#ff6b86" stroke="none"/>', fx: "beat", hint: "Become a Supporter (donate).", u: function (c) { return c.supporter; } },
      { id: "crown", name: "Crown", svg: '<path d="M7 20.5h16M7.5 20.5 6 9l5 4 4-6 4 6 5-4-1.5 11.5Z" stroke="#ffcf4d"/>', fx: "bounce", hint: "Platinum: earn every core trophy.", u: function (c) { return !!c.tro.all; } },
      { id: "pixel", name: "Pixel Arrow", svg: '<path d="M9 7v14l3.2-3.2 2.1 4.6 2.4-1.1-2.1-4.5H21Z" fill="currentColor" stroke="none"/>', fx: "flicker", hint: "Play any Arcade game.", u: function (c) { return c.arcade; } },
      { id: "wand", name: "Wand Tip", svg: '<path d="M8.5 22.5 20 11"/><path d="M22 7.5v3M20.5 9h3"/><path d="M16 5.5l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1Z" stroke="none" fill="currentColor"/>', fx: "spark", hint: "Finish a Wizard of the Sprint run.", u: function (c) { return !!c.man.wand; } },
      { id: "dpad", name: "D-Pad", svg: '<path d="M12 7.5h6v4.5h4.5v6H18v4.5h-6V18H7.5v-6H12Z"/>', fx: "press", hint: "Use a controller on the site.", u: function (c) { return c.pad; } },
      { id: "discord", name: "Discord Bubble", svg: '<path d="M7.5 9h15a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2H15l-4.8 3.6V19.5H7.5a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2Z"/>', fx: "pulse", hint: "Link your Discord / join the server.", u: function (c) { return !!c.tro["acct-discord"]; } },
      { id: "twitch", name: "Twitch Pulse", svg: '<circle cx="15" cy="15" r="9" stroke="#9146ff"/><circle cx="15" cy="15" r="2" fill="#9146ff" stroke="none"/>', fx: "pulse", hint: "Catch a stream from the Stream page.", u: function (c) { return c.stream; } },
      { id: "season", name: "Season Leaf", svg: seasonLook, fx: "drift", hint: "Yours — it follows the season.", u: function () { return true; } },
      { id: "comet", name: "Comet", svg: '<circle cx="18.5" cy="11.5" r="2.6" fill="currentColor" stroke="none"/><path d="M16.5 13.5 6.5 23.5"/>', fx: "flare", hint: "Visit on 30 different days.", u: function (c) { return c.days >= 30; } },
      { id: "glitch", name: "Glitch", svg: '<circle cx="15" cy="15" r="9"/>', fx: "glitch", hint: "Find any secret word.", u: function (c) { return c.codes >= 1; } },
      { id: "owner", name: "Owner's Mark", svg: '<circle cx="15" cy="15" r="10" stroke="#ffcf4d"/><path d="M11 10.5v9M11 10.5h3.5a4.5 4.5 0 0 1 0 9H11" stroke="#ffcf4d"/>', fx: "gold", hint: "The owner's own mark.", u: function (c) { return c.owner; } }
    ];
    var RET = {}; RET_LIST.forEach(function (r) { RET[r.id] = r; });

    /* ---- unlock snapshot. Owner + Discord admins see everything; otherwise each reticle's u() decides. ---- */
    var PUBLIC_PAGES = ["hub", "anderscraft", "anyps", "games", "resume", "links", "changelog", "uses", "stream", "support", "discord", "arcade"];
    var padSeen = false;
    try { padSeen = Site.store.get("reticleUnlocks", {}).pad === true; } catch (e) {}
    function allAccess() { try { return Site.owner === true || !!(Site.admin && Site.admin.get()) || window.ROP_ADMIN === true; } catch (e) { return false; } }
    function snap() {
      var tro = {};
      try { tro = (Site.trophy && Site.trophy.all && Site.trophy.all()) || Site.store.get("trophies", {}) || {}; } catch (e) { tro = Site.store.get("trophies", {}) || {}; }
      var seen = Site.store.get("seen", {}) || {}, rop = Site.store.get("ropStats", {}) || {}, man = Site.store.get("reticleUnlocks", {}) || {};
      return {
        tro: tro, n: Object.keys(tro).length,
        pagesAll: PUBLIC_PAGES.every(function (p) { return seen[p]; }),
        days: (Site.store.get("days", []) || []).length,
        codes: Object.keys(Site.store.get("codes", {}) || {}).length,
        chip: (rop.chippers || []).map(Number), reviews: +rop.reviews || 0, votes: +rop.votes || 0,
        verified: !!rop.verified || !!tro["acct-verified"], supporter: !!rop.supporter || !!tro["acct-supporter"],
        arcade: !!seen.arcade || !!tro.arcade, stream: !!seen.stream || !!man.twitch,
        pad: !!man.pad || padSeen, owner: Site.owner === true, man: man
      };
    }
    function unlocked(ret, c) { if (allAccess()) return true; if (!ret.u) return true; try { return !!ret.u(c || snap()); } catch (e) { return false; } }
    function colorUnlocked(v) { return v !== "rainbow" || allAccess() || snap().n >= 25; }
    function resolvedId() {
      if (FORCED) return "__forced";
      var id = Site.pref("reticle") || "ring", ret = RET[id];
      return (ret && unlocked(ret)) ? id : "ring";
    }

    /* The ring trails the pointer; the dot inside sits exactly on the pointer, so aiming stays precise. */
    function place() {
      ring.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0)";
      if (dot) dot.style.transform = "translate3d(" + (tx - x).toFixed(1) + "px," + (ty - y).toFixed(1) + "px,0)";
    }
    function show() { if (!shown) { shown = true; ring.classList.add("ix-ring--show"); root.classList.add("ix-nocursor"); } }
    function hide() { root.classList.remove("ix-nocursor"); if (ring && shown) { shown = false; ring.classList.remove("ix-ring--show", "ix-ring--down"); } }

    /* A rotating themed set (forced pages / hub peek), re-rolled on each click. */
    function roll() {
      if (!shapeEl || !set) return;
      var n = shape;
      if (set.random) { do { n = Math.floor(Math.random() * set.length); } while (n === shape); }
      else n = (shape + 1) % set.length;
      shape = n;
      shapeEl.textContent = "";
      shapeEl.appendChild(Site.svg(set[n], { viewBox: "0 0 30 30", "stroke-width": "2" }));
    }
    function useSet(next) {
      if (!ring || next === set) return;
      set = next; shape = -1;
      ring.classList.toggle("ix-ring--shapes", !!set);
      if (set) roll(); else if (shapeEl) shapeEl.textContent = "";
    }
    /* A single static reticle shape (the member's pick). */
    function useStatic(mk) {
      set = null; shape = -1;
      ring.classList.add("ix-ring--shapes");
      shapeEl.textContent = "";
      if (mk) shapeEl.appendChild(Site.svg(mk, { viewBox: "0 0 30 30", "stroke-width": "2" }));
    }
    function usePlainRing() { set = null; shape = -1; ring.classList.remove("ix-ring--shapes"); shapeEl.textContent = ""; }

    function glowCard() { return (Site.pref("reticleGlow") || "card") === "card"; }
    function sticky() { return (Site.pref("reticleFollow") || "trail") === "stick"; }

    function applyStyle() {
      if (!ring) return;
      var sz = Site.pref("reticleSize") || "m";
      ring.classList.toggle("ix-ring--s", sz === "s");
      ring.classList.toggle("ix-ring--l", sz === "l");
      var col = Site.pref("reticleColor") || "accent";
      var rainbow = col === "rainbow" && colorUnlocked("rainbow");
      ring.classList.toggle("ix-ring--rainbow", rainbow);
      if (!rainbow && col !== "accent" && PALETTE[col]) {
        ring.style.setProperty("--ix-ring-line", PALETTE[col]);
        ring.style.setProperty("--ix-ring-accent", PALETTE[col]);
        ring.classList.add("ix-ring--tint");
      } else {
        ring.style.removeProperty("--ix-ring-line");
        ring.style.removeProperty("--ix-ring-accent");
        ring.classList.remove("ix-ring--tint");
      }
    }
    /* Resolve the active reticle and paint it. Returns false when the pick is the native pointer. */
    function applyReticle() {
      if (!ring) return true;
      if (FORCED) { useSet(FORCED); curRet = null; applyStyle(); return true; }
      var id = resolvedId();
      if (id === "plain") { curRet = RET.plain; return false; }
      curRet = RET[id] || RET.ring;
      if (id === "ring") usePlainRing(); else useStatic(typeof curRet.svg === "function" ? curRet.svg() : curRet.svg);
      applyStyle();
      return true;
    }

    /* ---- click effects: a brief class on the ring body, plus (for some) a spawned flourish ---- */
    var FXCLASS = { squeeze: "ix-fx--squeeze", pulse: "ix-fx--pulse", snap: "ix-fx--snap", flick: "ix-fx--flick", flash: "ix-fx--flash",
      flare: "ix-fx--flare", recoil: "ix-fx--recoil", wobble: "ix-fx--wobble", spin: "ix-fx--spin", beat: "ix-fx--beat",
      bounce: "ix-fx--bounce", press: "ix-fx--squeeze", flicker: "ix-fx--flicker", gold: "ix-fx--gold", glitch: "ix-fx--glitch" };
    var SPAWN = { burst: 1, ink: 1, spark: 1, ripple: 1 }, fxTimer = 0;
    function spawnFx(kind, px, py) {
      if (!doc.body) return;
      var fx = Site.el("div", { class: "ix-cfx ix-cfx--" + kind, "aria-hidden": "true" });
      fx.style.left = px + "px"; fx.style.top = py + "px";
      if (kind === "burst" || kind === "spark") { var np = kind === "burst" ? 8 : 5; for (var i = 0; i < np; i++) { var s = Site.el("i"); s.style.setProperty("--a", (i / np * 360) + "deg"); fx.appendChild(s); } }
      doc.body.appendChild(fx);
      setTimeout(function () { fx.remove(); }, 640);
    }
    function playFx(px, py) {
      if (!ring || Site.reducedMotion) return;
      var pref = Site.pref("reticleClick") || "own";
      if (pref === "none") return;
      var kind = pref === "ripple" ? "ripple" : (curRet && curRet.fx);
      if (!kind || kind === "drift") return;
      var body = ring.querySelector(".ix-ring-c"), cls = FXCLASS[kind];
      if (body && cls) { body.classList.remove(cls); void body.offsetWidth; body.classList.add(cls); clearTimeout(fxTimer); fxTimer = setTimeout(function () { if (body) body.classList.remove(cls); }, 560); }
      if (SPAWN[kind]) spawnFx(kind, px, py);
    }

    /* One loop. It eases the ring towards the pointer and stops as soon as it has caught up. */
    function frame(t) {
      raf = 0;
      if (!active || doc.hidden) return;
      var dt = last ? Math.min(48, t - last) : 16.7; last = t;
      var k = 1 - Math.pow(0.76, dt / 16.7);
      x += (tx - x) * k; y += (ty - y) * k;
      if (Math.abs(tx - x) < 0.1 && Math.abs(ty - y) < 0.1) { x = tx; y = ty; place(); return; }
      place();
      raf = requestAnimationFrame(frame);
    }
    function wake() { if (!raf && active && !doc.hidden) { last = 0; raf = requestAnimationFrame(frame); } }

    function setHot(h) {
      if (h && !usable(h)) h = null;
      if (h === hot) return;
      hot = h;
      ring.classList.toggle("ix-ring--hot", !!h);
      /* over a hub card the ring picks up that card's colour (unless the member fixed a colour or turned glow off) */
      if (!ring.classList.contains("ix-ring--tint")) {
        var c = "";
        if (h && h.classList.contains("avenue") && glowCard()) { try { c = getComputedStyle(h).getPropertyValue("--accent").trim(); } catch (e) {} }
        if (c) ring.style.setProperty("--ix-ring-accent", c); else ring.style.removeProperty("--ix-ring-accent");
      }
      /* ...and, on the hub with the plain ring, that card's shape set (a specific pick wins over the peek) */
      if (Site.page === "hub" && !FORCED && resolvedId() === "ring") {
        var av = h && h.classList.contains("avenue") ? h : null;
        useSet(av && av.classList.contains("anyps") ? FACE : av && av.classList.contains("craft") ? WEAPONS : null);
      }
    }
    function onMove(e) {
      if (e.pointerType === "touch") { hide(); return; }
      tx = e.clientX; ty = e.clientY;
      if (!shown) { x = tx; y = ty; setHot(closest(e, HOT)); show(); }
      if (sticky()) { x = tx; y = ty; }
      place();
      if (!sticky()) wake();
    }
    function onOver(e) {
      if (e.pointerType === "touch") return;
      setHot(closest(e, HOT));
      var d = closest(e, "dialog[open]");
      if (d !== layer) { layer = d; topLayer(ring); }
    }
    function onDown(e) { if (e.pointerType === "touch") hide(); else if (shown) ring.classList.add("ix-ring--down"); }
    function onUp(e) { if (ring) ring.classList.remove("ix-ring--down"); if (!(e && e.type === "pointerup")) return; if (set) roll(); else playFx(tx, ty); }
    function onVisible() { if (!doc.hidden && (x !== tx || y !== ty)) wake(); }
    function onDialog() { if (ring) { layer = null; topLayer(ring); } }

    var passive = { passive: true };
    var wiring = [
      [doc, "pointermove", onMove], [doc, "pointerover", onOver], [doc, "pointerdown", onDown],
      [doc, "pointerup", onUp], [doc, "pointercancel", onUp],
      [root, "pointerleave", hide], [root, "mouseleave", hide], [window, "blur", hide],
      [doc, "visibilitychange", onVisible]
    ];
    function enable() {
      if (active || !doc.body) return;
      active = true;
      dot = Site.el("span", { class: "ix-ring-dot" });
      shapeEl = Site.el("span", { class: "ix-ring-shape" });
      ring = Site.el("div", { class: "ix-ring", "aria-hidden": "true" }, Site.el("span", { class: "ix-ring-c" }, shapeEl), dot);
      set = null;
      doc.body.appendChild(ring);
      topLayer(ring);
      applyReticle();
      wiring.forEach(function (w) { w[0].addEventListener(w[1], w[2], passive); });
    }
    function disable() {
      if (!active) return;
      active = false; shown = false; hot = null; layer = null;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      wiring.forEach(function (w) { w[0].removeEventListener(w[1], w[2], passive); });
      if (ring) ring.remove();
      ring = null; dot = null; shapeEl = null; set = null;
      root.classList.remove("ix-nocursor");
    }
    function wanted() { return finePointer.matches && !Site.reducedMotion && Site.pref("cursor") !== false; }
    function want() { return wanted() && !(!FORCED && resolvedId() === "plain"); }
    function sync() {
      if (finePointer.matches && !registered) {
        registered = true;
        Site.settings.register({ id: "cursor", label: "Cursor", hint: "Hide your mouse pointer behind a reticle.", type: "toggle", pref: "cursor", order: 30 });
        Site.settings.register({ id: "reticle", label: "Reticle", hint: "Pick your pointer — unlock more as you explore.", type: "custom", pref: "reticle", order: 31, build: buildPicker, sync: syncPicker });
      }
      if (want()) enable(); else disable();
    }
    function refreshPicker() { if (pickRefresh) { try { pickRefresh(); } catch (e) {} } }
    function syncPicker() { refreshPicker(); }
    function onPick() { if (!want()) { disable(); refreshPicker(); return; } if (!active) enable(); else applyReticle(); refreshPicker(); }
    function restyle() { if (active) applyStyle(); refreshPicker(); }

    /* ---- the picker that chrome.js renders inside Settings › Appearance ---- */
    function swatchFor(ret) {
      if (ret.id === "plain") return Site.svg('<path d="M9 7 9 23 13 19 16 25 18 24 15 18 20 18Z" fill="currentColor" stroke="none"/>', { viewBox: "0 0 30 30" });
      if (ret.id === "ring") return Site.svg('<circle cx="15" cy="15" r="9"/><circle cx="15" cy="15" r="1.6" fill="currentColor" stroke="none"/>', { viewBox: "0 0 30 30", "stroke-width": "2" });
      return Site.svg(typeof ret.svg === "function" ? ret.svg() : ret.svg, { viewBox: "0 0 30 30", "stroke-width": "2" });
    }
    function buildPicker() {
      var wrap = Site.el("div", { class: "ix-pick" });
      var prevSvg = Site.el("span", { class: "ix-pick__prevring" });
      var prevName = Site.el("strong", { class: "ix-pick__prevname" });
      var prevHint = Site.el("span", { class: "ix-pick__prevhint" });
      var preview = Site.el("div", { class: "ix-pick__preview" }, prevSvg, Site.el("span", { class: "ix-pick__prevtxt" }, prevName, prevHint));

      var grid = Site.el("div", { class: "ix-pick__grid", role: "listbox", "aria-label": "Reticle" });
      var tiles = {};
      RET_LIST.forEach(function (ret) {
        var sw = Site.el("span", { class: "ix-pick__sw" }); sw.appendChild(swatchFor(ret));
        var tile = Site.el("button", { type: "button", class: "ix-pick__tile", role: "option", "aria-selected": "false", title: ret.name },
          sw, Site.el("span", { class: "ix-pick__tname", text: ret.name }));
        tile.addEventListener("click", function () {
          if (tile.getAttribute("aria-disabled") === "true") { if (Site.sfx) Site.sfx("tap"); return; }
          Site.setPref("reticle", ret.id); if (Site.sfx) Site.sfx("toggle");
        });
        tile.addEventListener("pointerenter", function () { showPrev(ret); });
        tile.addEventListener("focus", function () { showPrev(ret); });
        grid.appendChild(tile); tiles[ret.id] = tile;
      });

      function seg(label, pref, def, opts) {
        var segw = Site.el("div", { class: "ix-pick__seg", role: "group", "aria-label": label }), btns = [];
        opts.forEach(function (o) {
          var b = Site.el("button", { type: "button", class: "ix-pick__segb" + (o.swatch ? " ix-pick__segb--sw" : ""), "aria-pressed": "false", title: o.title || o.label });
          if (o.swatch) b.style.setProperty("--sw", o.swatch); else b.textContent = o.label;
          b.addEventListener("click", function () { if (b.getAttribute("aria-disabled") === "true") { if (Site.sfx) Site.sfx("tap"); return; } Site.setPref(pref, o.value); if (Site.sfx) Site.sfx("toggle"); });
          b._opt = o; segw.appendChild(b); btns.push(b);
        });
        var row = Site.el("div", { class: "ix-pick__ctl" }, Site.el("span", { class: "ix-pick__clab", text: label }), segw);
        row._btns = btns; row._pref = pref; row._def = def; return row;
      }
      var colorOpts = [{ value: "accent", label: "Site", title: "Site accent" }]
        .concat(COLOR_ORDER.map(function (k) { return { value: k, swatch: PALETTE[k], title: k }; }));
      colorOpts.push({ value: "rainbow", label: "🌈", title: "Rainbow — unlock at 25 trophies" });
      var rows = [
        seg("Colour", "reticleColor", "accent", colorOpts),
        seg("Size", "reticleSize", "m", [{ value: "s", label: "S" }, { value: "m", label: "M" }, { value: "l", label: "L" }]),
        seg("Follow", "reticleFollow", "trail", [{ value: "trail", label: "Trails" }, { value: "stick", label: "Sticks" }]),
        seg("Click", "reticleClick", "own", [{ value: "own", label: "Reticle" }, { value: "ripple", label: "Ripple" }, { value: "none", label: "None" }]),
        seg("Glow", "reticleGlow", "card", [{ value: "card", label: "Card colour" }, { value: "fixed", label: "Fixed" }])
      ];
      var ctls = Site.el("div", { class: "ix-pick__ctls" }); rows.forEach(function (r) { ctls.appendChild(r); });

      function showPrev(ret) {
        prevSvg.textContent = ""; prevSvg.appendChild(swatchFor(ret));
        prevName.textContent = ret.name;
        var on = unlocked(ret);
        prevHint.textContent = on ? ret.hint : ("Locked — " + ret.hint);
        preview.classList.toggle("is-locked", !on);
      }
      function refresh() {
        var cc = snap(), curId = Site.pref("reticle") || "ring";
        RET_LIST.forEach(function (ret) {
          var t = tiles[ret.id]; if (!t) return;
          var on = unlocked(ret, cc);
          t.classList.toggle("is-locked", !on);
          if (on) t.removeAttribute("aria-disabled"); else t.setAttribute("aria-disabled", "true");
          var sel = ret.id === curId && on;
          t.setAttribute("aria-selected", String(sel)); t.classList.toggle("is-on", sel);
        });
        rows.forEach(function (row) {
          var v = Site.pref(row._pref) || row._def;
          row._btns.forEach(function (b) {
            var o = b._opt, lock = o.value === "rainbow" && !colorUnlocked("rainbow");
            if (lock) b.setAttribute("aria-disabled", "true"); else b.removeAttribute("aria-disabled");
            b.setAttribute("aria-pressed", String(o.value === v && !lock));
            b.classList.toggle("is-on", o.value === v && !lock);
          });
        });
        showPrev(RET[curId] || RET.ring);
        if (FORCED) prevHint.textContent = "This page keeps its own themed reticle.";
      }
      pickRefresh = refresh; refresh();
      wrap.appendChild(preview); wrap.appendChild(grid); wrap.appendChild(ctls);
      if (FORCED) wrap.appendChild(Site.el("p", { class: "ix-pick__note", text: "The AnyPS and AndersCraft pages keep their own themed reticles — your pick shows everywhere else." }));
      return wrap;
    }

    /* Public: let other threads (arcade, stream) award signal-based reticles. */
    Site.reticle = {
      grant: function (key) {
        if (!key) return;
        var m = Site.store.get("reticleUnlocks", {}) || {}; if (m[key]) return;
        m[key] = true; Site.store.set("reticleUnlocks", m); if (key === "pad") padSeen = true; refreshPicker();
      },
      has: function (id) { var r = RET[id]; return r ? unlocked(r) : false; },
      list: function () { return RET_LIST.map(function (r) { return r.id; }); }
    };

    /* A real controller press unlocks the D-Pad reticle. */
    try {
      if (Site.gamepad && Site.gamepad.on) {
        Site.gamepad.on(function () {
          if (padSeen) return; padSeen = true;
          var m = Site.store.get("reticleUnlocks", {}) || {}; m.pad = true; Site.store.set("reticleUnlocks", m); refreshPicker();
        });
      }
    } catch (e) {}

    Site.on("pref:cursor", sync);
    Site.on("pref:motion", sync);
    Site.on("pref:reticle", onPick);
    Site.on("pref:reticleColor", restyle);
    Site.on("pref:reticleSize", restyle);
    Site.on("pref:reticleGlow", restyle);
    Site.on("trophy:earned", refreshPicker);
    Site.on("rop:stats", refreshPicker);
    Site.on("dialog:open", onDialog);
    mqListen(finePointer, sync);
    sync();
  }, "cursor reticles");

  /* ====================================================================================================
   * 2. Page transitions (item 41)
   * ==================================================================================================== */
  Site.ready(function () {
    function wanted() { return enabled("transitions") && !Site.reducedMotion; }
    function clear() { root.classList.remove("ix-leave"); }

    /* Never leave a faded page behind: back/forward cache restores and tab switches always show the page again. */
    window.addEventListener("pageshow", clear);
    doc.addEventListener("visibilitychange", clear);

    /* Browsers with cross-document View Transitions: interact.css opts in, this only says when to skip. */
    if ("CSSViewTransitionRule" in window) {
      /* Chrome only keeps an incoming transition when the stylesheet holding the opt-in rule is already there as
         <body> starts, which in practice means "straight from the cache". Otherwise it drops the transition and
         logs an error. Two small helpers keep that from happening (both switch themselves off if a page ever
         carries the opt-in rule inline in its <head>):
           warm()       when the visitor heads for a link, re-request the stylesheet so a copy that has gone stale
                        is revalidated before the click (no network at all while the copy is fresh);
           cacheCheck() if the cache cannot be used (DevTools "Disable cache", test tools), skip the transition
                        instead of starting one the next page cannot finish. */
      var inline = false, sheetUrl = "", cacheWorks = null, warmedAt = Date.now(), warmLink = null, i;
      try {
        var styles = doc.querySelectorAll("head style");
        for (i = 0; i < styles.length; i++) if (/@view-transition/.test(styles[i].textContent)) inline = true;
        var own = doc.querySelector('link[rel~="stylesheet"][href*="/interact.css"]');
        if (own) sheetUrl = own.href;
      } catch (e) {}

      var skip = function (e) {
        var vt = e && e.viewTransition;
        if (!vt || (wanted() && (inline || cacheWorks !== false || e.type !== "pageswap"))) return;
        ["ready", "finished", "updateCallbackDone"].forEach(function (k) { try { vt[k].catch(function () {}); } catch (err) {} });
        try { vt.skipTransition(); } catch (err2) {}
      };
      window.addEventListener("pageswap", skip);
      window.addEventListener("pagereveal", skip);

      if (!inline && sheetUrl && enabled("transitions")) {
        var warm = function (e) {
          if (Date.now() - warmedAt < 4000 || !wanted() || !internalLink(closest(e, "a[href]"))) return;
          warmedAt = Date.now();
          var old = warmLink;
          warmLink = Site.el("link", { rel: "stylesheet", media: "not all", href: sheetUrl, class: "ix-warm" });   /* never applied: media "not all" */
          doc.head.appendChild(warmLink);
          if (old) old.remove();
        };
        ["pointerover", "focusin", "touchstart"].forEach(function (type) { doc.addEventListener(type, warm, { passive: true }); });

        /* Asks for this page's own address again, cache only (HEAD, so nothing is downloaded). Deliberately not the
           stylesheet: fetching that from script would push it out of the browser's in-memory cache, which is
           exactly where the next page needs to find it. */
        var cacheCheck = function () {
          var here = location.href.split("#")[0];
          if (!window.fetch || !performance.getEntriesByName || Site.page === "404") return;   /* a missing page would log a second 404 */
          fetch(here, { method: "HEAD", cache: "force-cache", credentials: "same-origin" })
            .then(function () {
              setTimeout(function () {
                var list = performance.getEntriesByName(here), last = null;
                for (var j = 0; j < list.length; j++) if (list[j].initiatorType === "fetch") last = list[j];
                if (last && typeof last.transferSize === "number") cacheWorks = last.transferSize === 0;
              }, 60);
            })
            .catch(function () {});
        };
        if (doc.readyState === "complete") setTimeout(cacheCheck, 0);
        else window.addEventListener("load", function () { setTimeout(cacheCheck, 0); });
      }
      return;
    }
    if (!enabled("transitions")) return;

    /* Everyone else: fade the content out (at most 140ms), then go. */
    var timer = 0;
    function leave(url) {
      if (timer) { clearTimeout(timer); timer = 0; location.href = url; return; }
      if (!wanted()) { location.href = url; return; }
      root.classList.add("ix-leave");
      timer = setTimeout(function () {
        timer = 0;
        location.href = url;
        setTimeout(clear, 800);   /* still here (blocked, a download, a slow host)? show the page again */
      }, 140);
    }
    go = leave;

    doc.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !wanted()) return;
      var a = closest(e, "a[href]");
      if (!internalLink(a)) return;
      e.preventDefault();
      leave(a.href);
    });

    /* Fade in, but only when nothing has been painted yet, so the page never flashes. */
    try {
      if (wanted() && window.PerformanceObserver && (PerformanceObserver.supportedEntryTypes || []).indexOf("paint") >= 0 &&
          !performance.getEntriesByType("paint").length) {
        root.classList.add("ix-enter");
        setTimeout(function () { root.classList.remove("ix-enter"); }, 500);
      }
    } catch (e) {}
  }, "page transitions");

  /* ====================================================================================================
   * 3. Button feedback (item 46): ripple and UI sound requests. The press-down itself is CSS (:active).
   * ==================================================================================================== */
  Site.ready(function () {
    var RIPPLE = ".btn,.social,#go";
    var HOVER = ".avenue,.btn,.social";
    var CLICKABLE = 'a[href],button,summary,select,[role="button"],[role="tab"],[role="switch"],' +
      'input[type="checkbox"],input[type="radio"],input[type="submit"],input[type="button"],input[type="reset"]';

    /* The ripple is drawn inside its own clipped box so the button never needs overflow:hidden.
       Looked up on every press because a page may replace a button's contents (the sign-up button does). */
    function holder(host) {
      for (var c = host.firstElementChild; c; c = c.nextElementSibling) if (c.classList.contains("ix-ripple")) return c;
      if (getComputedStyle(host).position === "static") host.classList.add("ix-rel");
      c = Site.el("span", { class: "ix-ripple", "aria-hidden": "true" });
      host.appendChild(c);
      return c;
    }
    function ripple(host, cx, cy) {
      if (Site.reducedMotion || !usable(host)) return;
      var r = host.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return;
      var box = holder(host);
      var px = cx == null ? r.width / 2 : cx - r.left - host.clientLeft;
      var py = cy == null ? r.height / 2 : cy - r.top - host.clientTop;
      var rad = Math.sqrt(Math.pow(Math.max(px, r.width - px), 2) + Math.pow(Math.max(py, r.height - py), 2));
      var ink = Site.el("span", { class: "ix-ripple-ink", style: {
        left: (px - rad).toFixed(1) + "px", top: (py - rad).toFixed(1) + "px", width: (rad * 2).toFixed(1) + "px", height: (rad * 2).toFixed(1) + "px" } });
      box.appendChild(ink);
      var done = function () { ink.remove(); };
      ink.addEventListener("animationend", done);
      setTimeout(done, 900);
    }

    doc.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      var host = closest(e, RIPPLE);
      if (host) ripple(host, e.clientX, e.clientY);
    }, { passive: true });

    /* Counts every UI sound that is asked for, whoever asks (this file loads before audio.js, so the player it
       registers is wrapped here; sounds requested through Site.sfx are counted as well, in case it ever is not). */
    var asked = 0;
    function counted(fn) { return function (name) { if (name !== "hover") asked++; return fn.apply(this, arguments); }; }
    try {
      var register = Site.registerSfx, direct = Site.sfx;
      if (typeof register === "function") Site.registerSfx = function (fn) { return register.call(Site, typeof fn === "function" ? counted(fn) : fn); };
      if (typeof direct === "function") Site.sfx = counted(direct);
    } catch (e) {}

    /* Capture phase, so the sound request is made even if a handler stops the click from bubbling.
       The plain "tap" is only the fallback: it waits until the click's own handlers have run and stays quiet
       when one of them asked for a sound of its own (a switch, the theme button, a panel opening). */
    doc.addEventListener("click", function (e) {
      var hit = closest(e, CLICKABLE);
      if (!usable(hit)) return;
      if (e.detail === 0) { var host = closest(e, RIPPLE); if (host) ripple(host); }   /* keyboard or controller: ripple from the middle */
      if (internalLink(hit)) { Site.sfx("nav"); return; }   /* the page is about to go, so this one cannot wait */
      var before = asked;
      setTimeout(function () { if (asked === before) Site.sfx("tap"); }, 0);
    }, true);

    var lastHover = 0;
    doc.addEventListener("pointerover", function (e) {
      if (e.pointerType !== "mouse" || !finePointer.matches) return;
      var hit = closest(e, HOVER);
      if (!usable(hit)) return;
      var from = e.relatedTarget;
      if (from && from.nodeType && hit.contains(from)) return;   /* moving around inside it */
      var now = Date.now();
      if (now - lastHover < 140) return;
      lastHover = now;
      Site.sfx("hover");
    }, { passive: true });

    /* iOS only applies :active styles when a touch listener exists. */
    doc.addEventListener("touchstart", function () {}, { passive: true });
  }, "button feedback");

  /* ====================================================================================================
   * 4. Konami code (item 48): up up down down left right left right B A, on the keyboard or a controller.
   * ==================================================================================================== */
  Site.ready(function () {
    if (!enabled("konami")) return;
    var CODE = ["up", "up", "down", "down", "left", "right", "left", "right", "b", "a"];
    var KEYS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", b: "b", B: "b", a: "a", A: "a" };
    var COLORS = ["#ff7a1f", "#3d8bff", "#36d39a"];
    var running = false;

    /* Returns a function that takes one input and answers how many of the latest inputs match the start of the code. */
    function tracker() {
      var buf = [];
      var feed = function (k) {
        buf.push(k);
        if (buf.length > CODE.length) buf.shift();
        for (var n = buf.length; n > 0; n--) {
          var ok = true;
          for (var i = 0; i < n; i++) if (buf[buf.length - n + i] !== CODE[i]) { ok = false; break; }
          if (ok) return n;
        }
        return 0;
      };
      feed.reset = function () { buf = []; };
      return feed;
    }

    function confetti(done) {
      var cv = Site.el("canvas", { class: "ix-confetti", "aria-hidden": "true" }), ctx = null;
      try { ctx = cv.getContext("2d"); } catch (e) {}
      if (!ctx || !doc.body) { done(); return; }
      doc.body.appendChild(cv);
      topLayer(cv);

      var TOTAL = 6000, FADE = 900, RAIN = 3600, DRAG = 1.9, GRAVITY = 620, MAX = 340;
      var W = 0, H = 0, dpr = 1, parts = [], elapsed = 0, last = 0, raf = 0, owed = 0, second = false, over = false;

      function size() {
        dpr = Math.min(2, window.devicePixelRatio || 1);
        W = window.innerWidth; H = window.innerHeight;
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      }
      function piece(px, py, vx, vy) {
        if (parts.length >= MAX) return;
        parts.push({ x: px, y: py, vx: vx, vy: vy, w: 6 + Math.random() * 6, h: 9 + Math.random() * 8,
          r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 9, ph: Math.random() * 6.28, vp: 3 + Math.random() * 5,
          sway: 20 + Math.random() * 50, c: COLORS[(Math.random() * COLORS.length) | 0], round: Math.random() < 0.22 });
      }
      function cannon(scale) {
        var n = Math.round(Math.max(30, Math.min(84, W / 16)) * scale);
        for (var i = 0; i < n; i++) {
          var side = i % 2 ? 1 : -1;
          piece(side < 0 ? -8 : W + 8, H * (0.8 + Math.random() * 0.12),
            -side * W * DRAG * (0.05 + Math.random() * 0.5), -H * DRAG * (0.55 + Math.random() * 0.7));
        }
      }
      function step(dt) {
        if (!second && elapsed > 420) { second = true; cannon(0.6); }
        if (elapsed < RAIN) {
          owed += dt * Math.max(10, W / 38);
          while (owed >= 1) { owed -= 1; piece(Math.random() * W, -14, (Math.random() - 0.5) * 120, 40 + Math.random() * 140); }
        }
        var damp = Math.exp(-DRAG * dt);
        for (var i = parts.length - 1; i >= 0; i--) {
          var p = parts[i];
          p.vx *= damp; p.vy = p.vy * damp + GRAVITY * dt;
          p.ph += p.vp * dt; p.r += p.vr * dt;
          p.x += (p.vx + Math.sin(p.ph) * p.sway) * dt; p.y += p.vy * dt;
          if (p.y > H + 30) parts.splice(i, 1);
        }
      }
      function draw() {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, cv.width, cv.height);
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i], c = Math.cos(p.r) * dpr, s = Math.sin(p.r) * dpr, flip = Math.cos(p.ph);
          ctx.setTransform(c, s, -s * flip, c * flip, p.x * dpr, p.y * dpr);
          ctx.fillStyle = p.c;
          if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w * 0.55, 0, 6.2832); ctx.fill(); }
          else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
      }
      function frame(t) {
        raf = 0;
        if (over || doc.hidden) return;          /* paused while the tab is hidden; resumes below */
        var dt = last ? t - last : 16.7; last = t;
        elapsed += Math.min(dt, 250);            /* real time while visible, so a slow device still ends on time */
        if (elapsed >= TOTAL) { stop(); return; }
        step(Math.min(dt, 40) / 1000); draw();
        if (elapsed > TOTAL - FADE) cv.style.opacity = String(Math.max(0, (TOTAL - elapsed) / FADE));
        raf = requestAnimationFrame(frame);
      }
      function resume() { if (!doc.hidden && !raf && !over) { last = 0; raf = requestAnimationFrame(frame); } }
      function stop() {
        if (over) return;
        over = true;
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener("resize", size);
        doc.removeEventListener("visibilitychange", resume);
        cv.remove();
        done();
      }
      size();
      cannon(1);
      window.addEventListener("resize", size);
      doc.addEventListener("visibilitychange", resume);
      resume();
    }

    function party() {
      if (running) return;
      running = true;
      Site.emit("konami");
      Site.toast("Cheat activated. Enjoy the confetti.", { type: "ok", ms: 4200 });
      Site.sfx("success");
      if (Site.reducedMotion) { setTimeout(function () { running = false; }, 2000); return; }   /* toast only */
      confetti(function () { running = false; });
    }

    var keys = tracker(), pad = tracker();

    /* Keyboard: only listens, never preventDefault, so the pages' own arrow-key shortcuts keep working. */
    doc.addEventListener("keydown", function (e) {
      if (document.documentElement.hasAttribute("data-arcade-input")) return;   /* a playable game owns input */
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Shift" || e.key === "CapsLock") return;
      var t = e.target;
      if (t && t.nodeType === 1 && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) { keys.reset(); return; }   /* typing */
      if (keys(KEYS[e.key] || "other") === CODE.length) { keys.reset(); party(); }
    });

    /* Controller: registered before the navigation below, so it can claim the closing B and A
       (otherwise B would go back and A would click something). */
    Site.gamepad.on(function (btn) {
      if (document.documentElement.hasAttribute("data-arcade-input")) return;   /* a playable game owns the pad */
      var n = pad(btn);
      padSwallow = "";
      if (n === CODE.length) { padSwallow = btn; pad.reset(); party(); }
      else if (n === CODE.length - 1) padSwallow = btn;
    });
  }, "konami");

  /* ====================================================================================================
   * 5. Controller navigation (site-wide)
   * ==================================================================================================== */
  Site.ready(function () {
    if (!enabled("controller")) return;
    var FOCUSABLE = 'a[href],button,input,select,textarea,summary,[tabindex],[contenteditable="true"]';
    /* Widgets that keep one member in the Tab order and move between the others with the arrow keys
       (tabs, the video chapter dots): the D-pad may land on every member, not only on the one with tabindex 0. */
    var ROVING = '[role="tablist"],[role="toolbar"],[role="group"],[role="radiogroup"],[role="menu"],[role="listbox"]';
    var ROVER = 'button,a[href],[role="tab"],[role="radio"],[role="option"],[role="menuitem"]';
    /* Looked at first, innermost first, before anything outside them. */
    var GROUPS = '[role="dialog"],[role="menu"],[role="listbox"],[role="radiogroup"],[role="tablist"],[role="toolbar"]';
    var TOLD = "ix:pad-told";
    var marked = null, told = false;

    function smooth() { return Site.reducedMotion ? "auto" : "smooth"; }

    /* The dialog on top: the open one that holds the focus, else the last one opened in the page. */
    function topDialog() {
      var ds = doc.querySelectorAll("dialog[open]"), act = doc.activeElement;
      if (!ds.length) return null;
      for (var i = ds.length - 1; i >= 0; i--) if (act && act !== doc.body && ds[i].contains(act)) return ds[i];
      return ds[ds.length - 1];
    }
    function scrolledAncestor(el) {
      for (var p = el.parentElement; p && p !== doc.body; p = p.parentElement) if (p.scrollTop > 0 || p.scrollLeft > 0) return true;
      return false;
    }
    /* The on-page box of something the D-pad may land on, or null (hidden, disabled, or parked off the page). */
    function roving(el) {
      return el.getAttribute("tabindex") === "-1" && el.matches(ROVER) && !!(el.parentElement && el.parentElement.closest(ROVING));
    }
    function box(el) {
      if (el.disabled || el.type === "hidden" || el.getAttribute("aria-disabled") === "true") return null;
      if (el.tabIndex < 0 && !roving(el)) return null;
      if (el.closest('[inert],[aria-hidden="true"]')) return null;
      if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true, checkVisibilityCSS: true })) return null;
      var cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.pointerEvents === "none") return null;
      var r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return null;
      var offPage = r.right + window.pageXOffset <= 0 || r.bottom + window.pageYOffset <= 0 || r.left >= Math.max(root.scrollWidth, window.innerWidth);
      if (offPage && !scrolledAncestor(el)) return null;   /* honeypot fields, visually hidden skip links */
      return r;
    }
    function candidates(scope) {
      var out = [], nodes = scope.querySelectorAll(FOCUSABLE);
      for (var i = 0; i < nodes.length; i++) { var r = box(nodes[i]); if (r) out.push({ el: nodes[i], r: r }); }
      return out;
    }
    function current(scope) {
      var a = doc.activeElement;
      if (!a || a === doc.body || a === root || !scope.contains(a) || !box(a)) return null;
      return a;
    }
    function headerH() { return parseFloat(getComputedStyle(root).getPropertyValue("--sx-header-h")) || 0; }
    /* Does this element ride along with the screen instead of the page? "fixed" (the back-to-top button),
       "sticky" (the header, once the page has scrolled and it is stuck to the top), or "". */
    function pinned(el) {
      for (var p = el; p && p !== doc.body && p !== root; p = p.parentElement) {
        var pos = getComputedStyle(p).position;
        if (pos === "fixed") return "fixed";
        if (pos === "sticky" && window.pageYOffset > 4) return "sticky";
      }
      return "";
    }
    function offScreen(r) { return r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth; }
    /* The thing closest to the middle of what the visitor is looking at (below the header), or null. */
    function nearest(scope, list) {
      var top = scope === doc ? headerH() : 0, w = window.innerWidth, h = window.innerHeight;
      var mx = w / 2, my = (top + h) / 2, best = null, bestD = Infinity;
      for (var i = 0; i < list.length; i++) {
        var r = list[i].r, cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
        if (cy < top || cy > h || cx < 0 || cx > w) continue;
        if (r.top < top - 1 && r.bottom > h + 1) continue;             /* a box taller than the screen is not "near" anything */
        if (scope === doc && pinned(list[i].el)) continue;
        var d = Math.abs(cy - my) + Math.abs(cx - mx) * 0.5;
        if (d < bestD) { bestD = d; best = list[i].el; }
      }
      return best;
    }
    /* Where to start when nothing is focused: the first hub card, else the first thing in the main content.
       If that is not on screen (the visitor has scrolled), whatever is nearest the middle of the screen. */
    function first(scope, list) {
      if (!list.length) return null;
      if (scope !== doc) return list[0].el;
      var i, pick = null, main = doc.querySelector('main,[role="main"]');
      for (i = 0; i < list.length && !pick; i++) if (list[i].el.classList.contains("avenue")) pick = list[i];
      if (main) for (i = 0; i < list.length && !pick; i++) if (main.contains(list[i].el)) pick = list[i];
      for (i = 0; i < list.length && !pick; i++) if (!list[i].el.closest("nav")) pick = list[i];
      if (!pick) pick = list[0];
      if (pick.r.bottom > headerH() && pick.r.top < window.innerHeight) return pick.el;
      return nearest(scope, list) || pick.el;
    }

    function unmark() { if (marked) { marked.classList.remove("ix-pad-focus"); marked = null; } }
    function focus(el) {
      if (!el) return;
      unmark();
      marked = el;
      el.classList.add("ix-pad-focus");   /* a focus ring that does not depend on the browser's keyboard heuristics */
      try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) {} }
      if (doc.activeElement !== el) { unmark(); return; }
      stopGlide();
      try { el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: smooth() }); } catch (e3) { el.scrollIntoView(false); }
    }
    doc.addEventListener("focusout", function (e) { if (e.target === marked) unmark(); });

    function gap(a1, a2, b1, b2) { return b1 >= a2 ? b1 - a2 : a1 >= b2 ? a1 - b2 : 0; }
    /* Lower is better; Infinity means "not in that direction". Distance along the pressed direction,
       plus a penalty for being off to the side (stronger for left/right, because pages flow downwards). */
    function score(dir, a, b, rows) {
      var ax = (a.left + a.right) / 2, ay = (a.top + a.bottom) / 2, along, aside, weight;
      if (dir === "right") { if (b.left < ax || b.right <= a.right) return Infinity; along = b.left - a.right; }
      else if (dir === "left") { if (b.right > ax || b.left >= a.left) return Infinity; along = a.left - b.right; }
      else if (dir === "down") { if (b.top < ay || b.bottom <= a.bottom) return Infinity; along = b.top - a.bottom; }
      else { if (b.bottom > ay || b.top >= a.top) return Infinity; along = a.top - b.bottom; }
      if (dir === "left" || dir === "right") { aside = gap(a.top, a.bottom, b.top, b.bottom); weight = 3; }
      else { aside = gap(a.left, a.right, b.left, b.right); weight = 1.5; }
      if (along < 0) along = 0;
      /* in a panel of rows, up / down goes to the next row, however far to the side its control sits */
      if (rows) return along * 4 + aside * 0.25 + Math.abs((b.left + b.right) / 2 - ax) * 0.02;
      if (aside > 2 * along + 32) return Infinity;
      return along + aside * weight + (Math.abs((b.left + b.right) / 2 - ax) + Math.abs((b.top + b.bottom) / 2 - ay)) * 0.02;
    }
    /* One box drawn inside the other (the "show passwords" button sits inside its field): edges cannot say which
       way it lies, so the centres do. */
    function within(outer, inner) {
      return inner.left >= outer.left - 1 && inner.right <= outer.right + 1 && inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
    }
    function nestedScore(dir, a, b) {
      var dx = (b.left + b.right) / 2 - (a.left + a.right) / 2, dy = (b.top + b.bottom) / 2 - (a.top + a.bottom) / 2;
      var ok = dir === "right" ? dx > 2 && dx >= Math.abs(dy) : dir === "left" ? -dx > 2 && -dx >= Math.abs(dy)
        : dir === "down" ? dy > 2 && dy > Math.abs(dx) : -dy > 2 && -dy > Math.abs(dx);
      return ok ? (Math.abs(dx) + Math.abs(dy)) * 0.02 : Infinity;
    }
    /* When the focused element has been scrolled out of view and nothing on screen can take over,
       start from the edge of the screen instead. */
    function edge(dir) {
      var w = window.innerWidth, h = window.innerHeight;
      var top = headerH();
      if (dir === "down") return { left: 0, right: w, top: top, bottom: top };
      if (dir === "up") return { left: 0, right: w, top: h, bottom: h };
      if (dir === "right") return { left: 0, right: 0, top: top, bottom: h };
      return { left: w, right: w, top: top, bottom: h };
    }
    /* The part of a dialog that actually scrolls (the dialog itself, or a body element one or two levels in). */
    function scroller(d) {
      var pool = [d], i, j, k;
      for (i = 0; i < d.children.length; i++) { k = d.children[i]; pool.push(k); for (j = 0; j < k.children.length; j++) pool.push(k.children[j]); }
      for (i = 0; i < pool.length; i++) {
        if (pool[i].scrollHeight > pool[i].clientHeight + 4 && /auto|scroll/.test(getComputedStyle(pool[i]).overflowY)) return pool[i];
      }
      return d;
    }
    /* Page scrolling for LB / RB and for "nothing that way". Animated here rather than with the browser's smooth
       scrolling, because two overlapping smooth scrolls (a press landing while the last one is still moving)
       regularly lose one of them. Presses add up; under reduced motion or in a hidden tab it simply jumps. */
    var glide = null;
    function pos(el) { return el === window ? window.pageYOffset : el.scrollTop; }
    function put(el, y) {
      try { el.scrollTo({ top: y, behavior: "instant" }); }
      catch (e) { if (el === window) window.scrollTo(window.pageXOffset, y); else el.scrollTop = y; }
    }
    function limit(el) {
      return el === window ? Math.max(root.scrollHeight, doc.body ? doc.body.scrollHeight : 0) - window.innerHeight : el.scrollHeight - el.clientHeight;
    }
    function stopGlide() { if (glide) { cancelAnimationFrame(glide.raf); glide = null; } }
    function glideTo(el, to) {
      to = Math.max(0, Math.min(limit(el), to));
      stopGlide();
      if (Site.reducedMotion || doc.hidden) { put(el, to); return; }
      var g = glide = { el: el, from: pos(el), to: to, t0: 0, raf: 0 };
      var step = function (t) {
        if (glide !== g) return;
        if (!g.t0) g.t0 = t;
        var k = doc.hidden ? 1 : Math.min(1, (t - g.t0) / 260);
        put(el, g.from + (g.to - g.from) * (1 - Math.pow(1 - k, 3)));
        if (k < 1) g.raf = requestAnimationFrame(step); else glide = null;
      };
      g.raf = requestAnimationFrame(step);
    }
    function scrollBy(sign, share) {
      var d = topDialog(), el = d ? scroller(d) : window;
      var amount = Math.round((d ? el.clientHeight : window.innerHeight) * share) * sign;
      glideTo(el, (glide && glide.el === el ? glide.to : pos(el)) + amount);
    }

    function move(dir) {
      var scope = topDialog() || doc, list = candidates(scope), cur = current(scope), a, best = null, bestScore = Infinity;
      if (!cur) {
        if (list.length) { focus(first(scope, list)); Site.sfx("hover"); }
        return;
      }
      /* a slider takes left / right itself */
      if (cur.tagName === "INPUT" && cur.type === "range" && (dir === "left" || dir === "right")) {
        var before = cur.value;
        try { if (dir === "left") cur.stepDown(); else cur.stepUp(); } catch (e) {}
        if (cur.value !== before) {
          cur.dispatchEvent(new Event("input", { bubbles: true }));
          cur.dispatchEvent(new Event("change", { bubbles: true }));
        }
        return;
      }
      a = cur.getBoundingClientRect();
      if (offScreen(a)) {
        /* The visitor scrolled away from it (LB / RB, the mouse wheel): carry on from what they are looking at,
           not from where the focus was left. */
        var near = nearest(scope, list);
        if (near && near !== cur) { focus(near); Site.sfx("hover"); return; }
        a = edge(dir);
      }
      var vertical = dir === "up" || dir === "down", field = /^(INPUT|TEXTAREA|SELECT)$/;
      /* From the page, things that ride along with the screen (the stuck header, the back-to-top button) are not
         "above" or "beside" anything: they would catch every other press. See below for how they are reached. */
      var free = scope === doc && !pinned(cur);
      var pick = function (group, rows, riders) {
        list.forEach(function (c) {
          if (c.el === cur || (group && !group.contains(c.el))) return;
          if (free && !group && !riders && pinned(c.el)) return;
          var s = within(a, c.r) || (field.test(c.el.tagName) && within(c.r, a)) ? nestedScore(dir, a, c.r) : score(dir, a, c.r, rows);
          if (s < bestScore) { bestScore = s; best = c.el; }
        });
      };
      /* Inside a widget or a floating panel (tabs, a menu, the settings panel) look there first, so the D-pad does
         not wander off to something that merely sits closer on the page behind it. With nothing left that way it
         may leave a widget, but not a panel: that stays put until B closes it. */
      var held = false;
      for (var g = cur.parentElement && cur.parentElement.closest(GROUPS); g && g !== scope && !best && !held; g = g.parentElement && g.parentElement.closest(GROUPS)) {
        var panel = g.getAttribute("role") === "dialog";
        pick(g, panel && vertical, false);
        if (panel) held = true;
      }
      if (!best && !held) pick(null, false, false);
      if (!best && !held && free) {
        /* the header once the page is back at the top (it is not stuck there, so the pass above finds it);
           the floating buttons from the very end of the page */
        if (dir === "down" && window.pageYOffset >= limit(window) - 4) {
          pick(null, false, true);
          if (!best) list.forEach(function (c) {   /* nothing lower: the floating button nearest by */
            if (c.el === cur || pinned(c.el) !== "fixed") return;
            var d = Math.abs((c.r.left + c.r.right - a.left - a.right) / 2) + Math.abs((c.r.top + c.r.bottom - a.top - a.bottom) / 2);
            if (d < bestScore) { bestScore = d; best = c.el; }
          });
        }
      }
      if (best) { focus(best); Site.sfx("hover"); }
      else if (vertical && !held) scrollBy(dir === "up" ? -1 : 1, 0.35);   /* nothing that way: read on */
    }

    function activate() {
      var scope = topDialog() || doc, cur = current(scope);
      if (!cur) { focus(first(scope, candidates(scope))); return; }
      if (offScreen(cur.getBoundingClientRect())) {   /* never press something the visitor cannot see */
        var near = nearest(scope, candidates(scope));
        if (near) { focus(near); return; }
      }
      cur.classList.add("ix-press");
      setTimeout(function () { cur.classList.remove("ix-press"); }, 160);
      if (cur.tagName === "SELECT" && cur.showPicker) { try { cur.showPicker(); return; } catch (e) {} }
      cur.click();
    }

    /* Something the visitor would expect B to close: an expanded popover or panel. */
    function openThings() {
      try { return doc.querySelectorAll('[aria-expanded="true"]:not(summary),[popover]:popover-open:not(.ix-ring):not(.ix-confetti)').length; }
      catch (e) { return doc.querySelectorAll('[aria-expanded="true"]:not(summary)').length; }
    }
    function back() {
      var d = topDialog();
      if (d) { Site.dialog.close(d); Site.sfx("close"); return; }
      var before = openThings(), act = doc.activeElement;
      Site.emit("ui:escape");
      if (openThings() < before || doc.activeElement !== act) return;   /* a popover or panel took it */
      if (Site.page !== "hub") { Site.sfx("nav"); go("/"); }
    }

    Site.gamepad.on(function (btn) {
      if (document.documentElement.hasAttribute("data-arcade-input")) return;   /* a playable game owns the pad */
      if (padSwallow === btn) { padSwallow = ""; return; }   /* the last two presses of the Konami code */
      padSwallow = "";
      if (btn === "up" || btn === "down" || btn === "left" || btn === "right") move(btn);
      else if (btn === "a") activate();
      else if (btn === "b") back();
      else if (btn === "start") Site.emit("ui:settings");
      else if (btn === "lb") scrollBy(-1, 0.8);
      else if (btn === "rb") scrollBy(1, 0.8);
    });

    /* One hint per browser session, the first time a controller shows up. */
    function hello() {
      if (told) return;
      told = true;
      try { if (sessionStorage.getItem(TOLD)) return; sessionStorage.setItem(TOLD, "1"); } catch (e) {}
      Site.toast("Controller connected. D-pad moves, A selects, B goes back.", { ms: 5200 });
    }
    Site.on("gamepad:connected", hello);
    if (Site.gamepad.connected()) hello();
  }, "controller");

  /* ---- add-on layers, loaded here so every page gets them without editing its HTML ----
     play     trophies, secret codes, boot intro      (features.play)
     seasons  seasonal effects                         (features.seasons)
     a11y     text size, contrast, reading font, lite mode, keyboard map   (features.a11y) */
  Site.ready(function () {
    var f = (Site.config && Site.config.features) || {};
    function load(name, v, flag, onFail) {
      if (f[flag] === false || doc.querySelector('script[src*="/assets/' + name + '.js"]')) { if (onFail) onFail(); return; }
      var css = doc.createElement("link"); css.rel = "stylesheet"; css.href = "/assets/" + name + ".css?v=" + v; doc.head.appendChild(css);
      var js = doc.createElement("script"); js.src = "/assets/" + name + ".js?v=" + v; js.async = true;
      if (onFail) js.onerror = onFail;
      doc.head.appendChild(js);
    }
    try {   /* lite mode is decided here so the layers below can respect it from their first frame */
      var lite = Site.store.get("lite", null), dev = (navigator.connection && navigator.connection.saveData) || (window.matchMedia && matchMedia("(prefers-reduced-data: reduce)").matches);
      if (lite === true || (lite !== false && dev)) doc.documentElement.setAttribute("data-lite", "");
    } catch (e) {}
    load("play", 21, "play", function () { doc.documentElement.classList.remove("pl-preboot"); });
    /* service worker: instant repeat visits and basic offline. features.serviceWorker = false unregisters it. */
    try {
      if ("serviceWorker" in navigator && /^https:$/.test(location.protocol)) {
        if (f.serviceWorker === false) navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); });
        else window.addEventListener("load", function () { navigator.serviceWorker.register("/sw.js").catch(function () {}); });
      }
    } catch (e) {}
    load("a11y", 2, "a11y");
    load("seasons", 3, "seasons");
    load("sync", 8, "sync");
    /* whole-site Maintenance Hatch — defines Site.hatch everywhere; edit UI is admin-gated inside.
       v2: hatch.js now drains the early-register queue set up at the top of this file. */
    load("hatch", 3, "hatch");
    /* account settings center — opt-in, loaded only when native accounts are switched on */
    if (f.accounts === true) load("account-center", 5, "accounts");
  }, "add-on loader");
})();
