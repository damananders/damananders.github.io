/* PS Locker: a little "store" for the owner's private backups.
 * Data comes from Site.config.locker (assets/site-config.js). Two views, same page:
 *   /locker/            -> storefront: one card per category, with stats.
 *   /locker/?c=<id>     -> that category: a pack's contents, or a list of separate downloads.
 * Download counts are a private per-browser tally of your own opens (Site.store "lk.dl"); favourites
 * are local too (Site.store "lk.fav"). Nothing here is analytics and nothing leaves the browser.
 */
(function () {
  "use strict";
  if (!window.Site) return;
  var S = Site;

  /* ---------- tiny helpers ---------- */
  function slug(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "x"; }
  function get(key, def) { try { var v = S.store.get(key); return v == null ? def : v; } catch (e) { return def; } }
  function set(key, v) { try { S.store.set(key, v); } catch (e) {} }

  var DL = get("lk.dl", {}) || {};      /* { id: openCount } */
  var FAV = get("lk.fav", {}) || {};    /* { id: 1 } */
  function dlId(catId, name) { return catId + ":" + slug(name); }
  function dlCount(id) { return DL[id] || 0; }
  function bump(id) { DL[id] = (DL[id] || 0) + 1; set("lk.dl", DL); }
  function isFav(id) { return !!FAV[id]; }
  function toggleFav(id) { if (FAV[id]) delete FAV[id]; else FAV[id] = 1; set("lk.fav", FAV); }

  /* size text -> bytes (for summing + sorting); bytes -> text */
  function parseSize(s) {
    if (typeof s === "number") return s;
    var m = /([\d.]+)\s*(tb|gb|mb|kb|b)?/i.exec(String(s || "")); if (!m) return 0;
    var n = parseFloat(m[1]) || 0, u = (m[2] || "mb").toLowerCase();
    return n * ({ b: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12 }[u] || 1e6);
  }
  function fmtSize(bytes) {
    if (!bytes) return ""; var u = ["B", "KB", "MB", "GB", "TB"], i = 0, n = bytes;
    while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
    return (n >= 10 || i === 0 ? Math.round(n) : n.toFixed(1)) + " " + u[i];
  }
  function fmtInt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

  /* an entry/game can carry an optional `added` date (any string Date can parse); within NEW_DAYS it's "new" */
  var NEW_DAYS = 21;
  function addedTime(it) { if (!it || !it.added) return 0; var t = Date.parse(it.added); return isNaN(t) ? 0 : t; }
  function isNew(it) { var t = addedTime(it); return t > 0 && (Date.now() - t) < NEW_DAYS * 864e5; }
  function catHasNew(cat) { return catItems(cat).some(isNew); }

  /* Turn a raw dump / package name into something readable: strip serials, [BRACKET] codes,
     DLCPACK numbers, long hex/number runs, underscores, stray separators. */
  function cleanName(raw) {
    if (!raw) return "";
    var s = String(raw);
    s = s.replace(/\.(pkg|iso|bin|zip|7z|rap|edat|cso)$/i, "");
    s = s.replace(/[\[(]\s*[^\])]*[\])]/g, function (m) {
      var inner = m.slice(1, -1).trim();                 /* keep short human notes like (Disc 1) */
      return (/[a-z]/.test(inner) && inner.length <= 16 && !/\d{4,}/.test(inner)) ? (" " + inner + " ") : " ";
    });
    s = s.replace(/[A-Z]{2,4}[-_]?\d{4,5}(?:[-_][A-Z0-9]+)*/g, " ");  /* UP2611-NPUB30910_00, BLES01807 (may be glued by _) */
    s = s.replace(/\b[A-Z]{4}\d{5}\b/g, " ");
    s = s.replace(/\b(DLC)?PACK[\s_-]?\d+\b/ig, " ");
    s = s.replace(/\b[0-9A-F]{6,}\b/g, " ").replace(/\b\d{6,}\b/g, " ");
    s = s.replace(/[_]+/g, " ");
    s = s.replace(/[\-–—:;,_\s]+$/, "").replace(/^[\-–—:;,_\s]+/, "");
    s = s.replace(/\s{2,}/g, " ").trim();
    return s;
  }
  function dlcLabel(d) { var n = cleanName(d && (d.name || d)); return n && n.length >= 2 ? n : "Add-on"; }

  /* ---------- icons ---------- */
  var ICONS = {
    bios: "<rect x='6' y='6' width='12' height='12' rx='2'/><path d='M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3'/>",
    disc: "<circle cx='12' cy='12' r='9'/><circle cx='12' cy='12' r='2.4'/><path d='M12 3a9 9 0 0 1 7.5 4' opacity='.55'/>",
    handheld: "<rect x='2.5' y='7' width='19' height='10' rx='3.2'/><circle cx='6.6' cy='12' r='1.3'/><path d='M16.4 10.6v2.8M15 12h2.8'/>",
    tower: "<rect x='4' y='3.5' width='16' height='17' rx='2'/><path d='M8 7.5h8M8 11h5'/><circle cx='15.8' cy='16' r='1.05'/>"
  };
  function iconKey(cat) {
    var k = cat.icon || cat.id;
    if (k === "ps1" || k === "ps2") return "disc";
    if (k === "psp" || k === "vita") return "handheld";
    if (k === "ps3") return "tower";
    return ICONS[k] ? k : "disc";
  }
  var DL_ICON = "<path d='M12 3v12M7 11l5 5 5-5'/><path d='M5 20h14'/>";
  var HEART = "<path d='M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10z'/>";
  var BACK = "<path d='M15 5l-7 7 7 7'/>";

  function statChip(iconInner, value, label, title) {
    return S.el("span", { class: "lk-stat", title: title || label },
      S.svg(iconInner, { class: "lk-stat-i" }),
      S.el("b", { text: value }),
      label ? S.el("span", { class: "lk-stat-l", text: label }) : null);
  }

  /* ---------- category maths ---------- */
  function catItems(cat) { return cat.mode === "pack" ? (cat.games || []) : (cat.entries || []); }
  function catItemCount(cat) { return catItems(cat).length; }
  function catSizeBytes(cat) {
    if (cat.size) return parseSize(cat.size);
    return (cat.entries || []).reduce(function (a, e) { return a + parseSize(e.size); }, 0);
  }
  function catSizeText(cat) { var b = catSizeBytes(cat); return cat.size || (b ? fmtSize(b) : ""); }
  function catDownloads(cat) {
    if (cat.mode === "pack") return dlCount(dlId(cat.id, "__pack__"));
    return (cat.entries || []).reduce(function (a, e) {
      var t = dlCount(dlId(cat.id, e.name));
      (e.dlc || []).forEach(function (d) { t += dlCount(dlId(cat.id, e.name + " " + (d.name || ""))); });
      return a + t;
    }, 0);
  }

  /* ---------- hero ---------- */
  function setHero(eyebrow, title, lead, showBack) {
    var e = document.getElementById("lk-eyebrow"), t = document.getElementById("lk-title"),
        l = document.getElementById("lk-lead"), b = document.getElementById("lk-back");
    if (e) e.textContent = eyebrow;
    if (t) t.textContent = title;
    if (l) l.textContent = lead;
    if (b) b.hidden = !showBack;
    document.title = title + " — PS Locker";
  }

  /* ---------- storefront ---------- */
  function renderStore(cats, root) {
    setHero("Private · owner only", "PS Locker",
      (S.config.locker && S.config.locker.intro) || "My private backups.", false);
    root.textContent = "";

    /* whole-library tally across every shelf */
    var totalItems = cats.reduce(function (a, c) { return a + catItemCount(c); }, 0);
    var totalBytes = cats.reduce(function (a, c) { return a + catSizeBytes(c); }, 0);
    if (totalItems || totalBytes) {
      root.appendChild(S.el("div", { class: "lk-lib" },
        statChip("<path d='M4 7h16M4 12h16M4 17h10'/>", fmtInt(totalItems), totalItems === 1 ? "title" : "titles", "Across every shelf"),
        totalBytes ? statChip("<path d='M5 4h14v16H5z'/><path d='M9 4v16'/>", fmtSize(totalBytes), "", "Total library size") : null,
        statChip("<path d='M4 6h16v4H4zM4 14h16v4H4z'/>", fmtInt(cats.length), cats.length === 1 ? "shelf" : "shelves", "")));
    }

    var grid = S.el("div", { class: "lk-grid" });
    cats.forEach(function (cat) {
      var n = catItemCount(cat), size = catSizeText(cat), dls = catDownloads(cat);
      var card = S.el("a", { class: "lk-cat", href: "?c=" + encodeURIComponent(cat.id) },
        S.el("span", { class: "lk-tag", text: "FREE" }),
        catHasNew(cat) ? S.el("span", { class: "lk-new-dot", title: "New additions", "aria-label": "New additions" }) : null,
        S.el("span", { class: "lk-cat-ico" }, S.svg(ICONS[iconKey(cat)])),
        S.el("div", { class: "lk-cat-head" },
          S.el("h2", { class: "lk-cat-name", text: cat.name }),
          S.el("span", { class: "lk-cat-sub", text: cat.console || "" })),
        S.el("p", { class: "lk-cat-blurb", text: cat.blurb || "" }),
        S.el("div", { class: "lk-stats" },
          statChip("<path d='M4 7h16M4 12h16M4 17h10'/>", n ? fmtInt(n) : "0", n === 1 ? "item" : "items",
            cat.mode === "pack" ? "Games in the pack" : "Separate downloads"),
          size ? statChip("<path d='M5 4h14v16H5z'/><path d='M9 4v16'/>", size, "", "Total size") : null,
          statChip(DL_ICON, fmtInt(dls), dls === 1 ? "grab" : "grabs", "Times you've opened these")),
        S.el("span", { class: "lk-cat-go", text: cat.mode === "pack" ? "Browse the pack →" : "Browse →" }));
      grid.appendChild(card);
    });
    root.appendChild(grid);
    if (!cats.length) root.appendChild(S.el("div", { class: "empty", text: "Nothing stored yet." }));
  }

  /* ---------- a download button ---------- */
  function dlButton(id, url, label, size) {
    var ok = typeof url === "string" && /^https:\/\//.test(url);
    var countEl = S.el("span", { class: "lk-dl-n", text: dlCount(id) ? "×" + dlCount(id) : "" });
    var a = ok
      ? S.el("a", { class: "btn lk-dl", href: url, target: "_blank", rel: "noopener noreferrer",
          onclick: function () { bump(id); countEl.textContent = "×" + dlCount(id); S.sfx && S.sfx("toast"); } },
          S.svg(DL_ICON, { class: "lk-dl-i" }), S.el("span", { text: label || "Download" }),
          size ? S.el("span", { class: "lk-dl-sz", text: size }) : null)
      : S.el("span", { class: "btn lk-dl is-pending", "aria-disabled": "true" },
          S.el("span", { text: "Link not added yet" }));
    return S.el("span", { class: "lk-dl-wrap" }, a, countEl);
  }

  function favBtn(id) {
    var b = S.el("button", { class: "lk-fav" + (isFav(id) ? " is-on" : ""), type: "button",
      "aria-pressed": isFav(id) ? "true" : "false", "aria-label": "Favourite",
      onclick: function () { toggleFav(id); var on = isFav(id); b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); } },
      S.svg(HEART, { class: "lk-fav-i" }));
    return b;
  }

  function metaLine(it) {
    var bits = [];
    if (it.year) bits.push(String(it.year));
    if (it.region) bits.push(it.region);
    if (it.genre) bits.push(it.genre);
    return bits.join(" · ");
  }

  function dlcBlock(cat, it) {
    if (!it.dlc || !it.dlc.length) return null;
    var wrap = S.el("div", { class: "lk-dlc" }, S.el("span", { class: "lk-dlc-h", text: "Includes DLC" }));
    it.dlc.forEach(function (d) {
      var label = dlcLabel(d), id = dlId(cat.id, it.name + " " + (d.name || label));
      if (d.url && /^https:\/\//.test(d.url)) {
        wrap.appendChild(S.el("a", { class: "lk-dlc-pill", href: d.url, target: "_blank", rel: "noopener noreferrer",
          title: label + (d.size ? " · " + d.size : ""),
          onclick: function () { bump(id); } },
          S.svg(DL_ICON, { class: "lk-dlc-i" }), S.el("span", { text: label }),
          d.size ? S.el("small", { text: d.size }) : null));
      } else {
        wrap.appendChild(S.el("span", { class: "lk-dlc-pill is-flat", title: label }, S.el("span", { text: label }),
          d.size ? S.el("small", { text: d.size }) : null));
      }
    });
    return wrap;
  }

  function newPill(it) { return isNew(it) ? S.el("span", { class: "lk-new", text: "NEW" }) : null; }

  /* one game inside a pack (info only) */
  function gameCard(cat, g) {
    var id = dlId(cat.id, g.name), meta = metaLine(g);
    return S.el("article", { class: "lk-item", dataset: { fav: isFav(id) ? "1" : "0" } },
      favBtn(id), newPill(g),
      S.el("h3", { class: "lk-item-name", text: cleanName(g.name) || g.name }),
      meta ? S.el("p", { class: "lk-item-meta", text: meta }) : null,
      g.note ? S.el("p", { class: "lk-item-note", text: g.note }) : null,
      dlcBlock(cat, g));
  }

  /* one separately-uploaded entry (its own download) */
  function entryCard(cat, e) {
    var id = dlId(cat.id, e.name), meta = metaLine(e);
    return S.el("article", { class: "lk-item lk-item--dl", dataset: { fav: isFav(id) ? "1" : "0" } },
      favBtn(id), newPill(e),
      S.el("h3", { class: "lk-item-name", text: cleanName(e.name) || e.name }),
      meta ? S.el("p", { class: "lk-item-meta", text: meta }) : null,
      e.note ? S.el("p", { class: "lk-item-note", text: e.note }) : null,
      dlcBlock(cat, e),
      dlButton(id, e.url, "Download", e.size));
  }

  /* ---------- category page ---------- */
  function renderCategory(cat, root) {
    setHero(cat.console || "Locker", cat.name, cat.blurb || "", true);
    root.textContent = "";

    var isPack = cat.mode === "pack";
    var items = catItems(cat).slice();

    /* summary bar */
    var summary = S.el("div", { class: "lk-summary" },
      statChip("<path d='M4 7h16M4 12h16M4 17h10'/>", fmtInt(items.length), items.length === 1 ? "item" : "items"),
      catSizeText(cat) ? statChip("<path d='M5 4h14v16H5z'/><path d='M9 4v16'/>", catSizeText(cat), "", "Total size") : null,
      statChip(DL_ICON, fmtInt(catDownloads(cat)), "grabs", "Times you've opened these"));
    root.appendChild(summary);

    /* pack: one big download for the whole archive */
    if (isPack) {
      var pid = dlId(cat.id, "__pack__");
      root.appendChild(S.el("div", { class: "lk-pack" },
        S.el("div", { class: "lk-pack-txt" },
          S.el("b", { text: "The whole " + cat.name + " pack" }),
          S.el("span", { text: (items.length ? fmtInt(items.length) + " games" : "A bundle of games") + (catSizeText(cat) ? " · " + catSizeText(cat) : "") })),
        dlButton(pid, cat.url, "Download pack", catSizeText(cat))));
    }

    /* toolbar: search + sort + faves (only when there's something to filter) */
    var itemsBox = S.el("div", { class: "lk-items" });
    var state = { q: "", sort: isPack ? "name" : "name", favOnly: false };

    function draw() {
      itemsBox.textContent = "";
      var q = state.q.toLowerCase();
      var out = items.filter(function (it) {
        if (state.favOnly && !isFav(dlId(cat.id, it.name))) return false;
        if (!q) return true;
        var hay = (it.name + " " + (it.genre || "") + " " + (it.region || "") + " " + (it.note || "")).toLowerCase();
        return hay.indexOf(q) >= 0;
      });
      out.sort(function (a, b) {
        if (state.sort === "size") return parseSize(b.size) - parseSize(a.size);
        if (state.sort === "year") return (b.year || 0) - (a.year || 0);
        if (state.sort === "grabs") return dlCount(dlId(cat.id, b.name)) - dlCount(dlId(cat.id, a.name));
        return (cleanName(a.name) || a.name).localeCompare(cleanName(b.name) || b.name);
      });
      if (!out.length) {
        itemsBox.appendChild(S.el("div", { class: "empty", text: items.length ? "Nothing matches that." : "Nothing listed here yet — add some entries in the config." }));
        return;
      }
      out.forEach(function (it) { itemsBox.appendChild(isPack ? gameCard(cat, it) : entryCard(cat, it)); });
    }

    if (items.length) {
      var search = S.el("input", { class: "lk-search", type: "search", placeholder: "Search " + cat.name + "…", "aria-label": "Search", oninput: function () { state.q = this.value; draw(); } });
      var sort = S.el("select", { class: "lk-sort", "aria-label": "Sort", onchange: function () { state.sort = this.value; draw(); } },
        S.el("option", { value: "name", text: "A – Z" }),
        S.el("option", { value: "size", text: "Biggest" }),
        S.el("option", { value: "year", text: "Newest" }),
        S.el("option", { value: "grabs", text: "Most grabbed" }));
      var fav = S.el("button", { class: "lk-favfilter", type: "button", "aria-pressed": "false",
        onclick: function () { state.favOnly = !state.favOnly; this.classList.toggle("is-on", state.favOnly); this.setAttribute("aria-pressed", state.favOnly ? "true" : "false"); draw(); } },
        S.svg(HEART, { class: "lk-fav-i" }), S.el("span", { text: "Faves" }));
      root.appendChild(S.el("div", { class: "lk-tools" }, search, S.el("div", { class: "lk-tools-r" }, fav, sort)));
    }

    root.appendChild(itemsBox);
    draw();
  }

  /* ---------- boot ---------- */
  S.ready(function () {
    var root = document.getElementById("lk-list"); if (!root) return;
    var cfg = S.config.locker || {};
    var cats = Array.isArray(cfg.categories) ? cfg.categories : [];
    /* fall back to the old flat `list` shape if that's all that's set */
    if (!cats.length && Array.isArray(cfg.list)) {
      cats = cfg.list.map(function (it) {
        return { id: slug(it.title), name: it.title, console: "", icon: "disc", mode: "list", blurb: it.note || "", entries: [{ name: it.title, url: it.url, note: it.note }] };
      });
    }
    var cid = null;
    try { cid = new URLSearchParams(location.search).get("c"); } catch (e) {}
    var cat = cid && cats.filter(function (c) { return c.id === cid; })[0];
    if (cat) renderCategory(cat, root);
    else renderStore(cats, root);
  }, "locker");
})();
