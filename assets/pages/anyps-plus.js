/* AnyPS page upgrades (see assets/README.md). anyps/index.html is rewritten by the AnyPS release process, so
 * nothing here edits it: every feature below attaches itself to ids / classes that already exist on the page,
 * checks that they are there, and quietly does nothing when they are not.
 *
 *   systems      interactive system strip at the top of "What's in the box"
 *   search       search box inside the complete feature list dialog
 *   newdot       "New" dot on the Changelog button until the changelog has been opened for this version
 *   arrows       keeps the page's Left / Right screenshot shortcut away from controls that use those keys
 *   video        chapter dots, progress line and play / pause on the preview video
 *   glyphs       PlayStation / Xbox switch on "Controls at a glance"
 *   checksum     SHA-256 line under each download (only when a hash is configured)
 *   releases     GitHub Releases: download counter and release links (only when Site.live.releases() has data)
 *   walkthrough  "Set up in a few minutes" stepper
 *   roadmap      roadmap section from assets/data/anyps-roadmap.json
 *   share        "Share AnyPS" row
 *   credits      "Credits & licences" dialog
 *
 * Each one can be switched off in site-config.js with features.ap<Name>: false (apSystems, apFeatureSearch,
 * apChangelogDot, apChapters, apGlyphs, apChecksum, apReleases, apWalkthrough, apRoadmap, apShare, apCredits).
 * Everything new is prefixed ap-.
 */
(function () {
  "use strict";
  if (!window.Site) return;
  var Site = window.Site, el = Site.el, doc = document;
  if (Site.page !== "anyps") return;

  var feats = (Site.config && Site.config.features) || {};
  function enabled(name) { return feats[name] !== false; }
  var A = (window.SITE && window.SITE.anyps) || {};
  function $(s, r) { return (r || doc).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }
  /* a page section, found by its aria-label or its heading (the page has no ids on them) */
  function findSec(re) {
    var all = $$("section.sec");
    for (var i = 0; i < all.length; i++) {
      var h = $("h2", all[i]);
      if (re.test(all[i].getAttribute("aria-label") || "") || (h && re.test(h.textContent))) return all[i];
    }
    return null;
  }
  /* ["plain ", {c:"code"}, {b:"bold"}] -> nodes (text only, never markup) */
  function rich(parts) {
    return (parts || []).map(function (p) {
      if (typeof p === "string") return doc.createTextNode(p);
      if (p.c) return el("code", { text: p.c });
      if (p.b) return el("b", { text: p.b });
      return doc.createTextNode("");
    });
  }
  function icon(name, cls) { return Site.svg(ICONS[name] || "", { "class": "ap-ico" + (cls ? " " + cls : "") }); }
  var ICONS = {
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    share: '<circle cx="6" cy="12" r="2.5"/><circle cx="17" cy="6" r="2.5"/><circle cx="17" cy="18" r="2.5"/><path d="M8.2 10.8l6.6-3.6M8.2 13.2l6.6 3.6"/>',
    post: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
    forum: '<path d="M3 5h12v8H8l-3 3v-3H3z"/><path d="M18 9h3v8h-2v3l-3-3h-5"/>',
    play: '<path d="M8 5l11 7-11 7z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    prev: '<path d="M15 5l-7 7 7 7"/>',
    next: '<path d="M9 5l7 7-7 7"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    file: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/>',
    zip: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M10.5 6v1.5M10.5 10v1.5M10.5 14v1.5"/>',
    arrow: '<path d="M4 12h15M13 6l6 6-6 6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.6 2.3c-.8.5-1.2 1-1.2 1.9M12 17h.01"/>'
  };
  function fmtTime(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }

  /* =====================================================================================================
   * systems: a tablist of the six systems at the top of "What's in the box".
   * Emulator and version are read from the page (its emus array, else the rendered cards). The formats and
   * console-file lines are the page's own Setup & FAQ answers and feature list, quoted as they stand there.
   * ===================================================================================================== */
  Site.ready(function () {
    if (!enabled("apSystems")) return;
    var sec = findSec(/in the box/i), cards = doc.getElementById("emuCards");
    if (!sec) return;
    var bios = ["A ", { b: "BIOS" }, " (a ", { c: ".bin" }, " dumped from a console you own)."];
    var SYS = [
      { id: "ps1", tab: "PS1", folder: "PS1", formats: ["cue+bin, chd, pbp, m3u, or a folder."], file: bios },
      { id: "ps2", tab: "PS2", folder: "PS2", formats: ["iso, chd, cso."], file: bios },
      { id: "psp", tab: "PSP", folder: "PSP", formats: ["iso, cso."], file: null },
      { id: "vita", tab: "PS Vita", folder: "Vita",
        formats: ["A ", { c: ".vpk" }, ", a ", { c: ".zip" }, ", or a dumped game folder (NoNpDRM), plus ", { c: ".pkg" }, " add-ons with their zRIF key in a text file beside them."],
        file: [{ c: "PSVUPDAT.PUP" }, " (and, optionally, the font pack ", { c: "PSP2UPDAT.PUP" }, ")."] },
      { id: "ps3", tab: "PS3", folder: "PS3",
        formats: ["A game folder (with ", { c: "PS3_GAME" }, ") plus any ", { c: ".pkg" }, " updates/DLC."],
        file: ["The ", { b: "system software" }, " ", { c: "PS3UPDAT.PUP" }, "."] },
      { id: "ps4", tab: "PS4", folder: "PS4", formats: ["A ", { c: ".pkg" }, " tile or an unpacked folder."], file: null }
    ];
    function sysKey(name) {
      var n = String(name || "").toLowerCase().trim(), m;
      if (/vita/.test(n)) return "vita";
      if (/psp|portable/.test(n)) return "psp";
      if ((m = /(?:playstation|ps)\s*(\d)/.exec(n))) return "ps" + m[1];
      if (/^(playstation|ps|psx|ps ?one)$/.test(n)) return "ps1";
      return "";
    }
    /* {ps1:{name, emu, ver, card}} from the page */
    function readEmus() {
      var out = {}, rows = [], kids = cards ? $$(".card", cards) : [];
      try { if (typeof emus !== "undefined" && Array.isArray(emus)) rows = emus.map(function (r, i) { return { name: r[0], emu: r[1], ver: r[2], card: kids[i] || null }; }); } catch (e) { rows = []; }
      if (!rows.length) rows = kids.map(function (c) {
        var h = $("h3", c), p = $("p:not(.big)", c), v = $("p.big", c);
        return { name: h ? h.textContent : "", emu: p ? p.textContent : "", ver: v ? v.textContent : "", card: c };
      });
      rows.forEach(function (r) { var k = sysKey(r.name); if (k && !out[k] && r.emu) out[k] = { name: String(r.name), emu: String(r.emu), ver: String(r.ver || ""), card: r.card }; });
      return out;
    }
    var found = readEmus(), cur = 0;
    var tabs = SYS.map(function (s, i) {
      return el("button", { "class": "ap-sys__tab", type: "button", role: "tab", id: "ap-sys-tab-" + s.id, "aria-controls": "ap-sys-panel",
        "aria-selected": "false", tabindex: "-1", text: s.tab, onclick: function () { select(i, false); Site.sfx("tap"); } });
    });
    var list = el("div", { "class": "ap-sys__tabs", role: "tablist", "aria-label": "Systems" }, tabs);
    var panel = el("div", { "class": "ap-sys__panel", role: "tabpanel", id: "ap-sys-panel", tabindex: "0" });
    var box = el("div", { "class": "ap-sys" }, list, panel);

    function fact(label, nodes, cls) { return el("div", { "class": "ap-sys__fact" + (cls ? " " + cls : "") }, el("dt", { text: label }), el("dd", null, nodes)); }
    function select(i, focus) {
      cur = (i + SYS.length) % SYS.length;
      var s = SYS[cur], f = found[s.id];
      tabs.forEach(function (t, k) { t.setAttribute("aria-selected", String(k === cur)); t.tabIndex = k === cur ? 0 : -1; });
      panel.setAttribute("aria-labelledby", tabs[cur].id);
      while (panel.firstChild) panel.removeChild(panel.firstChild);
      var facts = el("dl", { "class": "ap-sys__facts" });
      if (f) facts.appendChild(fact("Emulator", [el("b", { text: f.emu }), f.ver ? el("span", { "class": "ap-sys__ver", text: f.ver }) : null]));
      facts.appendChild(fact("Game formats", rich(s.formats).concat([el("span", { "class": "ap-sys__where" }, "Games go in ", el("code", { text: "AnyPS\\Games\\" + s.folder }), ".")])));
      facts.appendChild(fact("Console file", s.file
        ? rich(s.file).concat([el("span", { "class": "ap-sys__where" }, "Drop it into this console's folder in ", el("code", { text: "AnyPS\\System" }), ".")])
        : [doc.createTextNode("No console file needed.")]));
      panel.appendChild(el("h3", { "class": "ap-sys__name", text: (f && f.name) || s.tab }));
      panel.appendChild(facts);
      Object.keys(found).forEach(function (k) { if (found[k].card) found[k].card.classList.toggle("ap-emu-on", k === s.id); });
      if (focus) tabs[cur].focus();
    }
    list.addEventListener("keydown", function (e) {
      var k = e.key, to = k === "ArrowRight" || k === "ArrowDown" ? cur + 1 : k === "ArrowLeft" || k === "ArrowUp" ? cur - 1 : k === "Home" ? 0 : k === "End" ? SYS.length - 1 : null;
      if (to === null) return;
      e.preventDefault(); e.stopPropagation();   /* the page has its own document-level arrow keys for the screenshots */
      select(to, true); Site.sfx("tap");
    });
    /* a mouse resting on a tab shows that system (after a short pause, so sweeping across the strip does not flicker) */
    var hoverT = 0;
    tabs.forEach(function (t, i) {
      t.addEventListener("pointerenter", function (e) {
        if (e.pointerType !== "mouse") return;
        clearTimeout(hoverT); hoverT = setTimeout(function () { if (i !== cur) select(i, false); }, 80);
      });
      t.addEventListener("pointerleave", function () { clearTimeout(hoverT); });
    });
    select(0, false);
    if (cards && cards.parentNode === sec) sec.insertBefore(box, cards); else sec.appendChild(box);
  }, "anyps:systems");

  /* =====================================================================================================
   * arrows: the page moves its screenshot carousel on Left / Right from a document-level listener, whatever
   * has focus. This body-level listener runs first and keeps those keys to the control that is using them:
   * text fields, sliders, grouped controls and everything this file adds. Focus on the page itself or inside
   * the gallery, and the dialogs (the lightbox has its own arrow keys), are left alone.
   * ===================================================================================================== */
  Site.ready(function () {
    if (!doc.body) return;
    var OWN = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="group"], [role="radiogroup"], [role="tablist"], [role="toolbar"], ' +
      '[role="dialog"], [role="menu"], [role="listbox"], .ap-sys, .ap-vc, .ap-gl, .ap-sha, .ap-wt, .ap-share';
    doc.body.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      var t = e.target;
      if (!t || t.nodeType !== 1 || t === doc.body || t.closest("#gallery, dialog")) return;
      if (t.closest(OWN)) e.stopPropagation();
    });
  }, "anyps:arrows");

  /* =====================================================================================================
   * search: filter the complete feature list as you type. Works on whatever headings, lists, paragraphs and
   * tables the dialog holds; matches are wrapped in <mark> inside text nodes only and unwrapped again on clear.
   * ===================================================================================================== */
  Site.ready(function () {
    if (!enabled("apFeatureSearch")) return;
    var dlg = doc.getElementById("features"), body = dlg && $(".dbody", dlg);
    if (!body) return;
    var ITEM = "li, tbody tr, p", HEAD = "h1, h2, h3, h4, h5, h6", BOX = "ul, ol, dl, table, .tbl, details";
    var input = el("input", { "class": "ap-fs__in", id: "ap-fs-in", type: "search", placeholder: "Search the feature list", autocomplete: "off",
      spellcheck: "false", enterkeyhint: "search", "aria-label": "Search the feature list", "aria-describedby": "ap-fs-count" });
    var count = el("span", { "class": "ap-fs__count", id: "ap-fs-count", role: "status", "aria-live": "polite" });
    var hint = el("span", { "class": "sx-kbd ap-fs__key", "aria-hidden": "true", text: "/" });
    var clearBtn = el("button", { "class": "ap-fs__x", type: "button", "aria-label": "Clear the search", hidden: true, html: "&times;", onclick: function () { clear(); input.focus(); } });
    var bar = el("div", { "class": "ap-fs", role: "search" }, icon("search", "ap-fs__ico"), input, count, hint, clearBtn);
    var none = el("p", { "class": "ap-fs__none", hidden: true });
    body.insertBefore(none, body.firstChild); body.insertBefore(bar, none);

    function mine(n) { return n === none || bar.contains(n); }
    function unmark() {
      $$("mark.ap-fs-mark", body).forEach(function (m) { var p = m.parentNode; if (!p) return; p.replaceChild(doc.createTextNode(m.textContent), m); p.normalize(); });
    }
    function reset() {
      unmark();
      $$(".ap-fs-hide", body).forEach(function (n) { n.classList.remove("ap-fs-hide"); if (!n.classList.length) n.removeAttribute("class"); });
      $$("details[data-ap-fs-opened]", body).forEach(function (d) { d.open = false; d.removeAttribute("data-ap-fs-opened"); });
    }
    function hide(n) { n.classList.add("ap-fs-hide"); }
    function hidden(n) { return n.classList.contains("ap-fs-hide"); }
    function mark(q) {
      var w = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT, null), nodes = [], n;
      while ((n = w.nextNode())) { var p = n.parentElement; if (p && !mine(p) && !bar.contains(p) && !p.closest(".ap-fs-hide") && n.nodeValue.trim()) nodes.push(n); }
      nodes.forEach(function (t) {
        var s = t.nodeValue, low = s.toLowerCase(); if (low.length !== s.length) return;
        var at = low.indexOf(q); if (at < 0) return;
        var frag = doc.createDocumentFragment(), from = 0;
        while (at >= 0) {
          if (at > from) frag.appendChild(doc.createTextNode(s.slice(from, at)));
          frag.appendChild(el("mark", { "class": "ap-fs-mark", text: s.slice(at, at + q.length) }));
          from = at + q.length; at = low.indexOf(q, from);
        }
        if (from < s.length) frag.appendChild(doc.createTextNode(s.slice(from)));
        t.parentNode.replaceChild(frag, t);
      });
    }
    function apply() {
      var raw = input.value, q = raw.trim().toLowerCase();
      reset();
      clearBtn.hidden = !raw; bar.classList.toggle("has-q", !!raw);
      if (!q) { none.hidden = true; count.textContent = ""; return; }
      var has = function (n) { return (n.textContent || "").toLowerCase().indexOf(q) >= 0; };
      var items = $$(ITEM, body).filter(function (n) { return !mine(n); });
      var heads = $$(HEAD, body).filter(function (n) { return !mine(n); });
      /* each heading owns what follows it, up to the next heading of the same or a higher level */
      var sections = heads.map(function (h) {
        var lv = +h.tagName.slice(1), els = [];
        for (var s = h.nextElementSibling; s; s = s.nextElementSibling) { if (/^H[1-6]$/.test(s.tagName) && +s.tagName.slice(1) <= lv) break; els.push(s); }
        return { h: h, els: els, hit: has(h) };
      });
      var forced = []; sections.forEach(function (s) { if (s.hit) forced = forced.concat(s.els); });
      var direct = items.filter(has);
      var shown = 0;
      items.forEach(function (n) {
        var ok = direct.indexOf(n) >= 0 || forced.some(function (f) { return f === n || f.contains(n); }) ||
                 direct.some(function (d) { return d !== n && d.contains(n); });
        if (ok) shown++; else hide(n);
      });
      $$(BOX, body).forEach(function (c) {
        if (mine(c)) return;
        var its = $$(ITEM, c); if (!its.length) return;
        if (its.every(hidden)) hide(c);
        else if (c.tagName === "DETAILS" && !c.open) { c.open = true; c.setAttribute("data-ap-fs-opened", ""); }
      });
      var headHits = 0;
      sections.forEach(function (s) {
        if (s.hit) { headHits++; return; }
        var live = s.els.some(function (e) {
          if (hidden(e) || /^H[1-6]$/.test(e.tagName)) return false;
          if (e.matches(ITEM)) return true;
          return $$(ITEM, e).some(function (i) { return !hidden(i) && !i.closest(".ap-fs-hide"); });
        });
        /* a parent heading stays when one of its sub-headings matched */
        if (!live) live = sections.some(function (o) { return o.hit && s.els.indexOf(o.h) >= 0; });
        if (!live) hide(s.h);
      });
      var n = shown || headHits;
      mark(q);
      count.textContent = n ? n + (n === 1 ? " match" : " matches") : "No matches";
      none.hidden = !!n;
      if (!n) none.textContent = "No matches for “" + raw.trim() + "”. Try a shorter word.";
      body.scrollTop = 0;
    }
    function clear() { if (!input.value && !bar.classList.contains("has-q")) return; input.value = ""; apply(); }
    var queued = 0;
    input.addEventListener("input", function () { if (queued) return; queued = setTimeout(function () { queued = 0; apply(); }, 60); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && input.value) { e.preventDefault(); e.stopPropagation(); clear(); }   /* first Escape clears, the next one closes */
      else if (e.key === "Enter") e.preventDefault();
    });
    dlg.addEventListener("cancel", function (e) { if (input.value) { e.preventDefault(); clear(); input.focus(); } });
    dlg.addEventListener("keydown", function (e) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target; if (t === input || (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault(); input.focus(); input.select();
    });
    dlg.addEventListener("close", clear);
  }, "anyps:search");

  /* =====================================================================================================
   * newdot: a "New" dot on the Changelog button until the changelog has been opened for this version.
   * ===================================================================================================== */
  Site.ready(function () {
    if (!enabled("apChangelogDot")) return;
    var v = A.version, dlg = doc.getElementById("changelog"), btn = doc.getElementById("openChangelog");
    if (!v || !dlg) return;
    var dot = null;
    function seen() {
      Site.store.set("anyps.seenVersion", v);
      if (dot) { dot.remove(); dot = null; }
    }
    if (Site.store.get("anyps.seenVersion", null) !== v && btn) {
      dot = el("span", { "class": "ap-newdot" }, el("span", { "class": "sx-sr", text: " (new)" }));
      btn.appendChild(dot);
    }
    ["openChangelog", "openChangelog2"].forEach(function (id) { var b = doc.getElementById(id); if (b) b.addEventListener("click", seen); });
    if ("MutationObserver" in window) new MutationObserver(function () { if (dlg.open) seen(); }).observe(dlg, { attributes: true, attributeFilter: ["open"] });
    if (dlg.open) seen();
  }, "anyps:newdot");

  /* =====================================================================================================
   * video: progress line + chapter dots (bottom left; the page's sound button keeps the bottom right), a
   * play / pause button, and pausing while the video is off screen or the tab is hidden.
   * ===================================================================================================== */
  Site.ready(function () {
    if (!enabled("apChapters")) return;
    var vid = doc.getElementById("preview"); if (!vid) return;
    var host = vid.closest(".preview") || vid.parentNode; if (!host) return;

    /* ---- play state: the visitor's choice wins; otherwise play only while visible ---- */
    var userPaused = Site.reducedMotion, inView = true;
    var ppBtn = el("button", { "class": "ap-vc__pp", type: "button", onclick: function () { userPaused = !vid.paused; sync(); Site.sfx("tap"); } }, icon("pause", "ap-vc__i-pause"), icon("play", "ap-vc__i-play"));
    function paint() {
      var p = vid.paused;
      ppBtn.setAttribute("aria-label", p ? "Play the preview video" : "Pause the preview video");
      ppBtn.classList.toggle("is-paused", p);
    }
    function sync() {
      if (!userPaused && inView && !doc.hidden) { try { var p = vid.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
      else { try { vid.pause(); } catch (e) {} }
      paint();
    }
    vid.addEventListener("play", function () { if (!vid.paused && userPaused && inView && !doc.hidden) userPaused = false; paint(); });   /* e.g. the page's own sound button started it */
    vid.addEventListener("pause", paint);
    doc.addEventListener("visibilitychange", sync);
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { inView = es[es.length - 1].isIntersecting; sync(); }, { threshold: 0.15 }).observe(host);
    Site.on("pref:motion", function () { if (Site.reducedMotion) { userPaused = true; sync(); } });
    sync();

    var bar = el("div", { "class": "ap-vc" }, ppBtn);
    host.appendChild(bar);

    /* ---- chapters ---- */
    var file = "";
    try { var src = vid.currentSrc || (($("source", vid) || {}).src) || vid.src || ""; file = decodeURIComponent(src.split(/[?#]/)[0].split("/").pop() || ""); } catch (e) {}
    function build(chapters, dur, labelled) {
      if (!(dur > 0) || !chapters.length) return;
      var n = chapters.length, cur = -1, peek = -1;
      var label = el("span", { "class": "ap-vc__label", "aria-hidden": "true" });
      var fill = el("i", { "class": "ap-vc__fill" });
      var dots = chapters.map(function (c, i) {
        return el("button", { "class": "ap-vc__dot", type: "button", tabindex: i ? "-1" : "0",
          "aria-label": labelled ? "Jump to " + c.label + " (" + fmtTime(c.t) + ")" : "Jump to " + fmtTime(c.t),
          onclick: function () { jump(i); }, onmouseenter: function () { peek = i; text(); }, onmouseleave: function () { peek = -1; text(); },
          onfocus: function () { peek = i; text(); }, onblur: function () { peek = -1; text(); } });
      });
      var track = el("div", { "class": "ap-vc__track", role: "toolbar", "aria-label": "Video chapters" }, el("span", { "class": "ap-vc__line", "aria-hidden": "true" }, fill), dots);
      /* narrow screens: the dots would be a few pixels wide each, so CSS swaps them for these two buttons */
      var prevBtn = el("button", { "class": "ap-vc__nav ap-vc__prev", type: "button", onclick: function () { jump((cur - 1 + n) % n); } }, icon("prev"));
      var nextBtn = el("button", { "class": "ap-vc__nav ap-vc__next", type: "button", onclick: function () { jump((cur + 1) % n); } }, icon("next"));
      function name(i) { return labelled ? chapters[i].label + " (" + fmtTime(chapters[i].t) + ")" : fmtTime(chapters[i].t); }
      var main = el("div", { "class": "ap-vc__main" + (labelled ? "" : " ap-vc__main--plain") }, labelled ? label : null, prevBtn, nextBtn, track);
      function text() {
        if (!labelled) return;
        var i = peek >= 0 ? peek : cur; if (i < 0) i = 0;
        label.textContent = fmtTime(chapters[i].t) + "  " + chapters[i].label;
        label.classList.toggle("is-peek", peek >= 0 && peek !== cur);
      }
      function at(t) { var i = 0; for (var k = 0; k < n; k++) if (t >= chapters[k].t - 0.01) i = k; return i; }
      function update() {
        var t = vid.currentTime || 0, i = at(t);
        var end = i + 1 < n ? chapters[i + 1].t : dur, span = Math.max(0.001, end - chapters[i].t);
        var p = (i + Math.min(1, Math.max(0, (t - chapters[i].t) / span))) / n;
        fill.style.setProperty("--ap-p", p.toFixed(4));
        if (i !== cur) {
          cur = i;
          prevBtn.setAttribute("aria-label", "Previous chapter: " + name((i - 1 + n) % n));
          nextBtn.setAttribute("aria-label", "Next chapter: " + name((i + 1) % n));
          dots.forEach(function (d, k) { if (k === i) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current"); d.classList.toggle("is-done", k <= i); });
          text();
        }
      }
      function jump(i) {
        try { vid.currentTime = Math.min(dur - 0.1, chapters[i].t + 0.05); } catch (e) {}
        fill.classList.add("is-jump"); update(); void fill.offsetWidth; fill.classList.remove("is-jump");
        Site.sfx("tap");
      }
      track.addEventListener("keydown", function (e) {
        var k = e.key, i = dots.indexOf(doc.activeElement); if (i < 0) return;
        var to = k === "ArrowRight" ? i + 1 : k === "ArrowLeft" ? i - 1 : k === "Home" ? 0 : k === "End" ? n - 1 : null;
        if (to === null) return;
        e.preventDefault(); e.stopPropagation();
        to = Math.max(0, Math.min(n - 1, to));
        dots.forEach(function (d, x) { d.tabIndex = x === to ? 0 : -1; }); dots[to].focus();
      });
      vid.addEventListener("timeupdate", update); vid.addEventListener("seeked", update);
      update(); text();
      bar.appendChild(main);
    }
    function whenDuration(fn) {
      if (isFinite(vid.duration) && vid.duration > 0) { fn(vid.duration); return; }
      var done = false, h = function () { if (!done && isFinite(vid.duration) && vid.duration > 0) { done = true; fn(vid.duration); } };
      vid.addEventListener("loadedmetadata", h); vid.addEventListener("durationchange", h);
    }
    Site.data("anyps-chapters").then(function (d) {
      Site.ready(function () {
        var entry = d && file && Object.prototype.hasOwnProperty.call(d, file) ? d[file] : null;
        var list = entry && Array.isArray(entry.chapters) ? entry.chapters.filter(function (c) { return c && typeof c.t === "number" && c.t >= 0 && typeof c.label === "string" && c.label; })
          .sort(function (a, b) { return a.t - b.t; }) : [];
        if (list.length > 1) {
          var known = isFinite(vid.duration) && vid.duration > 0 ? vid.duration : +entry.duration;
          if (known > 0) build(list.filter(function (c) { return c.t < known; }), known, true);
          else whenDuration(function (dur) { build(list.filter(function (c) { return c.t < dur; }), dur, true); });
        } else {
          /* a video this file does not know: evenly spaced, unlabelled dots */
          whenDuration(function (dur) { var N = 8, ev = []; for (var i = 0; i < N; i++) ev.push({ t: dur * i / N, label: "" }); build(ev, dur, false); });
        }
      }, "anyps:chapters");
    });
  }, "anyps:video");

  /* =====================================================================================================
   * glyphs: PlayStation / Xbox switch above "Controls at a glance". Only the unambiguous glyphs change
   * (the four face buttons and L1 / R1); the original text is kept on the element and put back exactly.
   * ===================================================================================================== */
  Site.ready(function () {
    if (!enabled("apGlyphs")) return;
    var grid = $(".ctrls"); if (!grid || !grid.parentNode) return;
    var MAP = { "✕": "A", "×": "A", "◯": "B", "○": "B", "△": "Y", "□": "X", "L1": "LB", "R1": "RB" };
    var targets = $$(".gly, .key", grid).filter(function (n) { return !n.children.length && Object.prototype.hasOwnProperty.call(MAP, n.textContent.trim()); });
    if (!targets.length) return;
    var orig = targets.map(function (n) { return n.textContent; });
    var mode = "ps";
    var opts = [["ps", "PlayStation"], ["xbox", "Xbox"]].map(function (o) {
      return el("button", { "class": "ap-gl__opt", type: "button", "aria-pressed": "false", dataset: { v: o[0] }, text: o[1],
        onclick: function () { if (mode !== o[0]) { Site.setPref("glyphs", o[0]); Site.sfx("toggle"); } } });
    });
    var sw = el("div", { "class": "ap-gl", role: "group", "aria-label": "Button glyphs" }, el("span", { "class": "ap-gl__lbl", "aria-hidden": "true", text: "Show buttons for" }), el("div", { "class": "ap-gl__seg" }, opts));
    function apply(m) {
      mode = m === "xbox" ? "xbox" : "ps";
      targets.forEach(function (n, i) { n.textContent = mode === "xbox" ? MAP[orig[i].trim()] : orig[i]; n.classList.toggle("ap-gl-x", mode === "xbox"); });
      opts.forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === mode)); });
    }
    function fromPad(pad) {
      if (Site.store.get("glyphs", null) !== null || !pad || !pad.id) return;   /* the visitor already chose */
      var id = String(pad.id);
      if (/xbox|xinput|x-box|microsoft|045e/i.test(id)) apply("xbox");
      else if (/dualsense|dualshock|playstation|sony|054c|wireless controller/i.test(id)) apply("ps");
    }
    grid.parentNode.insertBefore(sw, grid);
    apply(Site.store.get("glyphs", null) || "ps");
    Site.on("pref:glyphs", function (v) { apply(v); });
    Site.on("gamepad:connected", fromPad);
    try { Array.prototype.forEach.call(navigator.getGamepads ? navigator.getGamepads() : [], function (p) { if (p && p.connected) fromPad(p); }); } catch (e) {}
    Site.settings.register({ id: "glyphs", label: "Button glyphs", hint: "On the AnyPS controls list.", type: "choice", pref: "glyphs", pages: ["anyps"], order: 35,
      choices: [{ value: "ps", label: "PlayStation" }, { value: "xbox", label: "Xbox" }] });
  }, "anyps:glyphs");

  /* =====================================================================================================
   * checksum: a SHA-256 line under each download. Shown only when a hash is set (SITE.anyps.sha256 or
   * anyps.sha256 in site-config.js; sha256_32 for the 32-bit build). No hash, no line.
   * ===================================================================================================== */
  var shaLines = [];   /* releases (below) hides these when the buttons move to GitHub files the hashes were not made for */
  Site.ready(function () {
    if (!enabled("apChecksum")) return;
    var C = (Site.config && Site.config.anyps) || {};
    function val(k) { var v = String(A[k] || C[k] || "").trim().toLowerCase(); return /^[a-f0-9]{64}$/.test(v) ? v : ""; }
    var openPop = null;
    function closePop(refocus) {
      if (!openPop) return;
      openPop.pop.hidden = true; openPop.btn.setAttribute("aria-expanded", "false");
      if (refocus) { try { openPop.btn.focus(); } catch (e) {} }
      openPop = null;
    }
    function line(hash, n) {
      var CMD = "Get-FileHash <file> -Algorithm SHA256", pid = "ap-sha-pop-" + n;
      var pop = el("div", { "class": "ap-sha__pop", id: pid, hidden: true },
        el("p", { text: "In PowerShell, run this on the file you downloaded:" }),
        el("div", { "class": "ap-sha__cmd" }, el("code", { text: CMD }),
          el("button", { "class": "ap-sha__btn", type: "button", "aria-label": "Copy the PowerShell line", onclick: function () { Site.copy(CMD, "PowerShell line copied"); } }, icon("copy"))),
        el("p", { text: "The Hash it prints should match the one shown here. Capital letters or small letters make no difference." }));
      var how = el("button", { "class": "ap-sha__how", type: "button", "aria-expanded": "false", "aria-controls": pid, text: "How to check",
        onclick: function (e) {
          e.stopPropagation();
          if (openPop && openPop.pop === pop) { closePop(false); Site.sfx("close"); return; }
          closePop(false); pop.hidden = false; how.setAttribute("aria-expanded", "true"); openPop = { pop: pop, btn: how }; Site.sfx("open");
        } });
      var box = el("div", { "class": "ap-sha" },
        el("span", { "class": "ap-sha__lbl", text: "SHA-256" }),
        el("code", { "class": "ap-sha__hash", title: hash, "aria-label": "SHA-256 " + hash, text: hash.slice(0, 8) + "…" + hash.slice(-8) }),
        el("button", { "class": "ap-sha__btn", type: "button", "aria-label": "Copy the full SHA-256", onclick: function () { Site.copy(hash, "SHA-256 copied"); } }, icon("copy")),
        how, pop);
      pop.addEventListener("click", function (e) { e.stopPropagation(); });
      box.addEventListener("keydown", function (e) { if (e.key === "Escape" && openPop && openPop.pop === pop) { e.preventDefault(); e.stopPropagation(); closePop(true); } });
      shaLines.push(box);
      return box;
    }
    var h = val("sha256"), meta = doc.getElementById("dlmeta");
    if (h && meta && meta.parentNode && A.downloadUrl) meta.parentNode.insertBefore(line(h, 1), meta.nextSibling);
    var h32 = val("sha256_32"), d32 = doc.getElementById("dl32");
    if (h32 && d32 && !d32.hidden) d32.appendChild(line(h32, 2));
    if (!shaLines.length) return;
    doc.addEventListener("click", function () { closePop(false); });
    Site.on("ui:escape", function () { closePop(true); });
  }, "anyps:checksum");

  /* =====================================================================================================
   * releases: when GitHub Releases data exists, show the download count, and if the newest release is at
   * least the version in config.js, point the buttons at its files and keep the old links as "Mirror".
   * A release older than the configured version never replaces anything.
   * ===================================================================================================== */
  Site.ready(function () {
    if (!enabled("apReleases")) return;
    var dl = doc.getElementById("dl"), meta = doc.getElementById("dlmeta");
    if (!dl || !meta) return;
    function ver(s) { var m = /(\d+(?:\.\d+)+|\d+)/.exec(String(s || "")); return m ? { text: m[1], n: m[1].split(".").map(Number) } : null; }
    function cmp(a, b) { for (var i = 0; i < Math.max(a.length, b.length); i++) { var x = a[i] || 0, y = b[i] || 0; if (x !== y) return x < y ? -1 : 1; } return 0; }
    function https(u) { return typeof u === "string" && /^https:\/\//i.test(u); }
    function is32(name) { return /(win|x|_|-|\s)32|32[-_ ]?bit|ia32|x86(?![-_]?64)/i.test(name); }
    /* the old link is a mirror only when it is the same version; next to a newer release it is named as the previous one */
    function mirror(href, same, v) { return el("a", { "class": "ap-mirror", href: href, target: "_blank", rel: "noopener", text: same ? "Mirror" : "Previous version V" + v.text }); }
    Site.live.releases().then(function (rel) {
      Site.ready(function () {
        if (!rel) return;
        if (rel.downloads > 0) meta.appendChild(el("span", { "class": "ap-dlcount" }, meta.textContent ? " · " : "", el("b", { text: Site.fmtNum(rel.downloads) }), rel.downloads === 1 ? " download" : " downloads"));
        var have = ver(A.version), got = ver(rel.tag);
        if (!have || !got || cmp(got.n, have.n) < 0) return;
        var files = (rel.assets || []).filter(function (a) { return a && https(a.url) && /\.(zip|7z|rar|exe|msi)$/i.test(a.name || ""); });
        var a64 = files.filter(function (a) { return !is32(a.name); })[0], a32 = files.filter(function (a) { return is32(a.name); })[0];
        var counter = $(".ap-dlcount", meta);
        if (a64) {
          var old = dl.getAttribute("href");
          dl.href = a64.url; dl.removeAttribute("aria-disabled");
          dl.textContent = "Download AnyPS V" + got.text;
          meta.textContent = [rel.published ? "Posted " + Site.fmtDate(rel.published) : "", Site.fmtBytes(a64.size), "Hosted on GitHub"].filter(Boolean).join(" · ");
          if (https(old)) { meta.appendChild(doc.createTextNode(" · ")); meta.appendChild(mirror(old, cmp(got.n, have.n) === 0, have)); }
          if (counter) meta.appendChild(counter);
          if (shaLines[0] && shaLines[0].parentNode === meta.parentNode) shaLines[0].hidden = true;
        }
        var l32 = doc.getElementById("dl32link"), m32 = doc.getElementById("dl32meta"), d32 = doc.getElementById("dl32");
        if (a32 && l32 && d32) {
          var old32 = l32.getAttribute("href");
          l32.href = a32.url; d32.hidden = false;
          if (m32) {
            m32.textContent = "(" + ["V" + got.text, Site.fmtBytes(a32.size)].filter(Boolean).join(", ") + ")";
            var have32 = ver(A.version32) || have;
            if (https(old32)) { m32.appendChild(doc.createTextNode(" · ")); m32.appendChild(mirror(old32, cmp(got.n, have32.n) === 0, have32)); }
          }
          shaLines.forEach(function (s) { if (d32.contains(s)) s.hidden = true; });
        }
      }, "anyps:releases:apply");
    });
  }, "anyps:releases");

  /* =====================================================================================================
   * walkthrough: "Set up in a few minutes", the page's four Getting started steps as an auto-advancing stepper.
   * The timer is the CSS animation on the current step's bar (animationend moves on), so it pauses for free on
   * hover, focus, a hidden tab or when scrolled away. Reduced motion: no auto-advance, nothing moves.
   * ===================================================================================================== */
  Site.ready(function () {
    if (!enabled("apWalkthrough")) return;
    var before = findSec(/faq/i) || findSec(/controls/i); if (!before || !before.parentNode) return;
    function tile(ic, name, extra) { return el("span", { "class": "ap-wt__tile" + (extra ? " " + extra : "") }, icon(ic), el("span", { text: name })); }
    function tree(branch, leaf) {
      return el("div", { "class": "ap-wt__tree" },
        el("span", { "class": "ap-wt__row" }, icon("folder"), el("span", { text: "AnyPS" })),
        el("span", { "class": "ap-wt__row ap-wt__row--1" }, icon("folder"), el("span", { text: branch })),
        el("span", { "class": "ap-wt__row ap-wt__row--2 is-hot" }, icon("folder"), el("span", { text: "<console>" }), el("span", { "class": "ap-wt__drop" }, icon("file"), el("span", { text: leaf }))));
    }
    var STEPS = [
      { t: "Download and unzip", d: ["Download and unzip the release."],
        art: function () { return el("div", { "class": "ap-wt__flow" }, tile("zip", "AnyPS zip"), icon("arrow", "ap-wt__arrow"), el("span", { "class": "ap-wt__stack" }, tile("folder", "AnyPS"), tile("file", "AnyPS.exe", "ap-wt__tile--sub"))); } },
      { t: "Run AnyPS.exe", d: ["Run ", { c: "AnyPS.exe" }, " and follow the first-boot setup."],
        art: function () { return el("img", { "class": "ap-wt__shot", src: "/assets/shots/71_wizard.webp", alt: "", width: "1440", height: "608", loading: "lazy", decoding: "async" }); } },
      { t: "Add your console files", d: ["Drop console files dumped from hardware you own into ", { c: "AnyPS\\System\\<console>" }, "."],
        art: function () { return tree("System", "your console file"); } },
      { t: "Add your games", d: ["Put your own game backups in ", { c: "AnyPS\\Games\\<console>" }, "."],
        art: function () { return tree("Games", "your game backup"); } }
    ];
    var cur = 0, userPaused = false, hover = false, focus = false, inView = true;
    var panes = STEPS.map(function (s) { return el("div", { "class": "ap-wt__pane" }, s.art()); });
    var stage = el("div", { "class": "ap-wt__stage", "aria-hidden": "true" }, panes);
    var btns = STEPS.map(function (s, i) {
      return el("button", { "class": "ap-wt__step", type: "button", onclick: function () { go(i, true); } },
        el("span", { "class": "ap-wt__num", "aria-hidden": "true", text: String(i + 1) }),
        el("span", { "class": "ap-wt__txt" }, el("b", { text: s.t }), el("span", { "class": "ap-wt__desc" }, rich(s.d))),
        el("span", { "class": "ap-wt__bar", "aria-hidden": "true" }, el("i")));
    });
    var pos = el("span", { "class": "ap-wt__pos", "aria-hidden": "true" });
    var say = el("span", { "class": "sx-sr", role: "status", "aria-live": "polite" });
    var ppBtn = el("button", { "class": "ap-wt__btn ap-wt__pp", type: "button", onclick: function () { userPaused = !userPaused; state(); Site.sfx("toggle"); } }, icon("pause", "ap-wt__i-pause"), icon("play", "ap-wt__i-play"));
    var ctl = el("div", { "class": "ap-wt__ctl" },
      el("button", { "class": "ap-wt__btn", type: "button", "aria-label": "Previous step", onclick: function () { go(cur - 1, true); } }, icon("prev")),
      ppBtn,
      el("button", { "class": "ap-wt__btn", type: "button", "aria-label": "Next step", onclick: function () { go(cur + 1, true); } }, icon("next")),
      pos, say);
    var body = el("div", { "class": "ap-wt__grid" }, stage, el("div", { "class": "ap-wt__side" }, el("ol", { "class": "ap-wt__steps" }, btns.map(function (b) { return el("li", null, b); })), ctl));
    var sec = el("section", { "class": "sec ap-wt", "aria-label": "Set up in a few minutes" },
      el("h2", { text: "Set up in a few minutes" }),
      el("p", { "class": "lead ap-lead", text: "Four steps from download to your first game." }),
      body);

    function go(i, manual) {
      cur = (i + STEPS.length) % STEPS.length;
      btns.forEach(function (b, k) { if (k === cur) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current"); b.classList.toggle("is-done", k < cur); });
      panes.forEach(function (p, k) { p.classList.toggle("is-on", k === cur); });
      pos.textContent = (cur + 1) + " / " + STEPS.length;
      if (manual) { say.textContent = "Step " + (cur + 1) + " of " + STEPS.length + ": " + STEPS[cur].t; Site.sfx("tap"); }
    }
    function state() {
      var auto = !userPaused && !Site.reducedMotion;
      sec.classList.toggle("is-auto", auto);
      sec.classList.toggle("is-hold", hover || focus || doc.hidden || !inView);
      ppBtn.hidden = Site.reducedMotion;
      ppBtn.classList.toggle("is-paused", userPaused);
      ppBtn.setAttribute("aria-label", userPaused ? "Play the walkthrough" : "Pause the walkthrough");
    }
    sec.addEventListener("animationend", function (e) { if (e.animationName === "ap-wt-fill" && sec.classList.contains("is-auto")) go(cur + 1, false); });
    if (window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches) {
      body.addEventListener("pointerenter", function () { hover = true; state(); });
      body.addEventListener("pointerleave", function () { hover = false; state(); });
    }
    body.addEventListener("focusin", function () { focus = true; state(); });
    body.addEventListener("focusout", function (e) { if (!e.relatedTarget || !body.contains(e.relatedTarget)) { focus = false; state(); } });
    doc.addEventListener("visibilitychange", state);
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { inView = es[es.length - 1].isIntersecting; state(); }, { threshold: 0.2 }).observe(body);
    Site.on("pref:motion", state);
    go(0, false); state();
    before.parentNode.insertBefore(sec, before);
    Site.reveal(sec);
  }, "anyps:walkthrough");

  /* =====================================================================================================
   * roadmap: four columns from assets/data/anyps-roadmap.json, placed before "Something broke?".
   * ===================================================================================================== */
  Site.ready(function () {
    if (!enabled("apRoadmap")) return;
    var before = findSec(/report a problem|something broke/i) || $("footer"); if (!before || !before.parentNode) return;
    Site.data("anyps-roadmap").then(function (d) {
      Site.ready(function () {
        if (!d || !Array.isArray(d.columns)) return;
        var cols = d.columns.map(function (c) {
          var items = (c && Array.isArray(c.items) ? c.items : []).filter(function (it) { return it && typeof it.title === "string" && it.title; });
          if (!items.length || typeof c.title !== "string") return null;
          return el("div", { "class": "ap-rm__col ap-rm__col--" + String(c.id || "").replace(/[^a-z0-9-]/gi, "") },
            el("h3", null, el("i", { "class": "ap-rm__dot", "aria-hidden": "true" }), c.title, el("span", { "class": "ap-rm__n", "aria-hidden": "true", text: String(items.length) })),
            typeof c.lead === "string" && c.lead ? el("p", { "class": "ap-rm__lead", text: c.lead }) : null,
            el("ul", null, items.map(function (it) { return el("li", null, el("b", { text: it.title }), typeof it.note === "string" && it.note ? el("span", { text: it.note }) : null); })));
        }).filter(Boolean);
        if (!cols.length) return;
        var sec = el("section", { "class": "sec ap-rm", "aria-label": "Roadmap" },
          el("h2", { text: "Roadmap" }),
          el("p", { "class": "lead ap-lead", text: "What just landed, what is being built, and what is out of reach for now." }),
          el("div", { "class": "ap-rm__grid" }, cols),
          typeof d.note === "string" && d.note ? el("p", { "class": "ap-rm__note", text: d.note }) : null);
        before.parentNode.insertBefore(sec, before);
        Site.reveal(sec);
      }, "anyps:roadmap:render");
    });
  }, "anyps:roadmap");

  /* =====================================================================================================
   * share: "Share AnyPS" row above the footer.
   * ===================================================================================================== */
  Site.ready(function () {
    if (!enabled("apShare")) return;
    var footer = $("footer"); if (!footer || !footer.parentNode) return;
    var og = $('meta[property="og:url"]'), url = (og && og.getAttribute("content")) || (location.origin + location.pathname);
    var title = "AnyPS: one launcher for six generations of PlayStation emulation";
    function ext(href, ic, text) { return el("a", { "class": "ap-share__btn", href: href, target: "_blank", rel: "noopener" }, icon(ic), el("span", { text: text })); }
    var row = el("div", { "class": "ap-share__row" },
      el("button", { "class": "ap-share__btn", type: "button", onclick: function () { Site.copy(url, "Link copied"); } }, icon("link"), el("span", { text: "Copy link" })),
      navigator.share ? el("button", { "class": "ap-share__btn", type: "button", onclick: function () { try { var p = navigator.share({ title: "AnyPS", text: title, url: url }); if (p && p.catch) p.catch(function () {}); } catch (e) {} } }, icon("share"), el("span", { text: "Share…" })) : null,
      ext("https://x.com/intent/post?text=" + encodeURIComponent(title) + "&url=" + encodeURIComponent(url), "post", "Post on X"),
      ext("https://www.reddit.com/submit?url=" + encodeURIComponent(url) + "&title=" + encodeURIComponent(title), "forum", "Share on Reddit"));
    var sec = el("section", { "class": "sec ap-share", "aria-labelledby": "ap-share-t" }, el("h2", { id: "ap-share-t", text: "Share AnyPS" }), row);
    footer.parentNode.insertBefore(sec, footer);
    Site.reveal(sec);
  }, "anyps:share");

  /* =====================================================================================================
   * credits: "Credits & licences" button in the footer, opening a Site.modal.
   * ===================================================================================================== */
  Site.ready(function () {
    if (!enabled("apCredits")) return;
    var footer = $("footer"); if (!footer) return;
    var EMUS = [
      ["DuckStation", "PS1", "CC BY-NC-ND 4.0", "duckstation.org"],
      ["PCSX2", "PS2", "GPL-3.0-or-later", "pcsx2.net"],
      ["PPSSPP", "PSP", "GPL-2.0-or-later", "ppsspp.org"],
      ["Vita3K", "PS Vita", "GPL-2.0", "vita3k.org"],
      ["RPCS3", "PS3", "GPL-2.0", "rpcs3.net"],
      ["shadPS4", "PS4", "GPL-2.0-or-later", "shadps4.net"]
    ];
    function site(host) { return el("a", { href: "https://" + host + "/", target: "_blank", rel: "noopener", text: host }); }
    var legal = "";
    $$("p", footer).forEach(function (p) { if (/not affiliated/i.test(p.textContent)) legal = p.textContent.trim(); });
    var dlg = null, btn;
    function make() {
      var body = el("div", { "class": "ap-cr" },
        el("p", { text: "AnyPS is a front end. The emulators it bundles are made by their own teams, and AnyPS would be nothing without them." }),
        el("h3", { text: "Bundled emulators" }),
        el("ul", { "class": "ap-cr__list" }, EMUS.map(function (e) {
          return el("li", null, el("b", { text: e[0] }), el("span", { "class": "ap-cr__sys", text: e[1] }), el("span", { "class": "ap-cr__lic", text: e[2] }), site(e[3]));
        })),
        el("h3", { text: "Services AnyPS can connect to" }),
        el("ul", { "class": "ap-cr__plain" },
          el("li", null, el("b", { text: "RetroAchievements" }), " ", site("retroachievements.org")),
          el("li", null, el("b", { text: "RPCN" }), " for PS3 online")),
        el("h3", { text: "Fonts on this site" }),
        el("p", { text: "Space Grotesk, Inter and DM Mono, under the SIL Open Font License." }),
        el("p", { "class": "ap-cr__note", text: "Each project is independent. Its own site has the authoritative licence text." }),
        legal ? el("p", { "class": "ap-cr__note", text: legal }) : null);
      return Site.modal({ id: "ap-credits", title: "Credits & licences", body: body });
    }
    btn = el("button", { "class": "linkbtn ap-cr__open", type: "button", "aria-haspopup": "dialog", text: "Credits & licences",
      onclick: function () { if (!dlg) dlg = make(); Site.dialog.open(dlg); } });
    footer.appendChild(el("p", { "class": "ap-cr__p" }, btn));
    Site.on("ui:escape", function () { if (dlg && dlg.open) { Site.dialog.close(dlg); try { btn.focus(); } catch (e) {} } });
  }, "anyps:credits");
  /* ---- hidden door (the same one as on the hub page): a faint face-button mark at the bottom left; five quick
     clicks open a code box. The codes are stored as SHA-256 hashes, not as text. A convenience, not security:
     the pages behind it are protected by Drive's Restricted sharing, not by the code. ---- */
  Site.ready(function () {
    if (doc.getElementById("hb-door")) return;
    var row = el("div", { "class": "hb-door-row" });
    row.innerHTML = '<button class="hb-door" id="hb-door" type="button" aria-label="Hidden door" title=""><svg viewBox="0 0 64 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5 14 13.5H2Z"/><circle cx="24" cy="8" r="5.5"/><path d="M35 3 45 13M45 3 35 13"/><rect x="51" y="2.5" width="11" height="11" rx="1"/></svg></button>';
    var footer = doc.querySelector("footer"), wrap = footer;
    while (wrap && wrap.parentNode && wrap.parentNode !== doc.body) wrap = wrap.parentNode;
    if (wrap && wrap.parentNode === doc.body) doc.body.insertBefore(row, wrap.nextSibling); else doc.body.appendChild(row);
    var btn = doc.getElementById("hb-door"); if (!btn) return;
    var DOORS = { "fabd43b9d8c7ac6e8e88b9bfeb7479dc68b55540d41e5c0a3492011f9b240fed": "/vault/", "57548c4cdac3905a5f2e7ad5a00d2eb03f2204a28ac962664a94e64e3ceebd13": "/locker/" };
    var n = 0, timer = 0, dlg = null, input = null, msg = null, form = null;
    function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }
    function open() {
      if (!dlg) {
        input = el("input", { id: "hb-code-in", type: "password", autocomplete: "off", autocapitalize: "off", spellcheck: "false", maxlength: "64" });
        msg = el("p", { "class": "hb-code__msg", role: "status", "aria-live": "polite" });
        form = el("form", { "class": "hb-code", novalidate: true }, el("label", { "for": "hb-code-in", text: "Enter code" }), input, msg);
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          var v = input.value.trim().toLowerCase(); if (!v) return;
          if (!(window.crypto && crypto.subtle && window.TextEncoder)) { msg.textContent = "This browser can't check codes."; return; }
          crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)).then(function (buf) {
            var to = DOORS[hex(buf)];
            if (to) { Site.sfx("success"); location.href = to; return; }
            msg.textContent = "Nothing happens."; Site.sfx("error");
            form.classList.remove("hb-code--no"); void form.offsetWidth; form.classList.add("hb-code--no");
            input.select();
          }, function () { msg.textContent = "This browser can't check codes."; });
        });
        dlg = Site.modal({ id: "hb-code", title: "△ ○ ✕ □", body: form });
      }
      input.value = ""; msg.textContent = ""; form.classList.remove("hb-code--no");
      Site.dialog.open(dlg); input.focus();
    }
    btn.addEventListener("click", function () {
      n++; clearTimeout(timer); timer = setTimeout(function () { n = 0; }, 2500);
      if (n >= 5) { n = 0; clearTimeout(timer); open(); }
    });
  }, "anyps:hidden door");
})();
