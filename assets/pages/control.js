/* pages/control.js — the owner's control panel (/control/). Prefix cp-.
 *
 * Nothing on this page is secret: the lock is on the server (12_control_panel.sql). Sign-in is the password, then the
 * 6-digit code from the linked authenticator app; the server checks both and hands back a session key that lasts
 * eight hours. Every save sends that key and the server checks it again. The key is kept in sessionStorage, so it
 * ends when the tab closes; the password is never stored. Site.admin (chrome.js) draws the "site admin" badge.
 *
 *   site_settings "config"  values laid over assets/site-config.js (only the ones that differ from the file)
 *   site_settings "links"   the Links I Like list, in the owner's ranking order
 */
(function () {
  "use strict";
  if (!window.Site || window.Site.page !== "control") return;
  var Site = window.Site, el = Site.el, doc = document, base = Site.configBase || {};
  var SB = Site.sb || { url: "https://zjhlhkruqzfendvbglsb.supabase.co", key: "sb_publishable_j-EgPXB3ZvKuz_3h8dZaNA_aLgmcQrk" };
  /* A browser can pair this file with an older cached site.js for one visit. Never depend on it for sign-in:
     if the shared session helper is missing, use the same thing here. */
  if (!Site.admin) Site.admin = (function () {
    var K = "site.admin", A = {
      get: function () { try { var a = JSON.parse(sessionStorage.getItem(K)); return a && a.token ? a : null; } catch (e) { return null; } },
      set: function (a) { try { sessionStorage.setItem(K, JSON.stringify({ token: a.token, twofa: !!a.twofa, expires: a.expires })); } catch (e) {} },
      clear: function () { try { sessionStorage.removeItem(K); } catch (e) {} },
      check: function () { var a = A.get(); if (!a) return Promise.resolve({ ok: false }); return rpc("site_admin_whoami", { p_token: a.token }).then(function (r) { if (r && r.error === "offline") return null; if (!r || !r.ok) A.clear(); return r; }); },
      signOut: function () { var a = A.get(); A.clear(); return a ? rpc("site_admin_logout", { p_token: a.token }) : Promise.resolve(null); }
    };
    return A;
  })();
  if (!Site.remote) Site.remote = function () {
    return fetch(SB.url + "/rest/v1/site_settings?select=key,value", { headers: { apikey: SB.key, Authorization: "Bearer " + SB.key }, cache: "no-store" })
      .then(function (r) { if (!r.ok) throw r.status; return r.json(); })
      .then(function (rows) { var out = { config: null, links: null }; (rows || []).forEach(function (x) { if (x.key === "config") out.config = x.value; if (x.key === "links") out.links = x.value; }); return out; })
      .catch(function () { return { config: null, links: null }; });
  };
  var HEAD = { apikey: SB.key, Authorization: "Bearer " + SB.key, "Content-Type": "application/json" };
  var token = "", sess = null, ov = {}, links = [], stats = {}, statsOn = false, dirty = { config: false, links: false };
  function $(id) { return doc.getElementById(id); }

  /* ---------- server ---------- */
  function rpc(name, body) {
    return fetch(SB.url + "/rest/v1/rpc/" + name, { method: "POST", headers: HEAD, body: JSON.stringify(body) })
      .then(function (r) { if (r.status === 404) return { ok: false, error: "unset" }; if (!r.ok) return { ok: false, error: "http-" + r.status }; return r.json(); })
      .catch(function () { return { ok: false, error: "offline" }; });
  }
  var ERR = {
    wrong: "That password is not right.",
    "bad-code": "That code is not right, or it was already used. Wait for the next one and try again.",
    locked: "Too many wrong tries. Sign-in is locked for up to 15 minutes.",
    unset: "The panel is not set up yet. Run the latest 12_control_panel.sql in the Supabase SQL Editor with your password on its last line.",
    "signed-out": "Your sign-in has ended. Reload the page and sign in again.",
    "already-linked": "An authenticator is already linked.",
    offline: "Could not reach the server. Check the connection and try again.",
    "too-big": "That is too much data to save in one go.",
    "too-short": "The new password needs 12 characters or more.",
    "no-link-stats": "Visit counts are not set up yet. Run 10_links.sql in the Supabase SQL Editor."
  };
  function why(r) { return ERR[r && r.error] || "That did not work (" + ((r && r.error) || "unknown") + ")."; }

  /* ---------- small helpers ---------- */
  function isObj(v) { return v && typeof v === "object" && !Array.isArray(v); }
  function get(o, path) { var p = path.split("."); for (var i = 0; i < p.length; i++) { if (!isObj(o)) return undefined; o = o[p[i]]; } return o; }
  function set(o, path, v) { var p = path.split("."); for (var i = 0; i < p.length - 1; i++) { if (!isObj(o[p[i]])) o[p[i]] = {}; o = o[p[i]]; } o[p[p.length - 1]] = v; }
  function unset(o, path) {
    var p = path.split("."), chain = [o];
    for (var i = 0; i < p.length - 1; i++) { if (!isObj(o[p[i]])) return; o = o[p[i]]; chain.push(o); }
    delete o[p[p.length - 1]];
    for (var j = chain.length - 1; j > 0; j--) if (!Object.keys(chain[j]).length) delete chain[j - 1][p[j - 1]];
  }
  function val(path, dflt) { var v = get(ov, path); if (v === undefined) v = get(base, path); return v === undefined ? dflt : v; }
  function put(path, v, dflt) {
    var b = get(base, path); if (b === undefined) b = dflt;
    if (b === v) unset(ov, path); else set(ov, path, v);
    mark("config");
  }
  function mark(what) { dirty[what] = true; paintSave(); }
  function slug(t) { return String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40); }
  function okUrl(u) { return /^https?:\/\/[^\s]+$/.test(String(u || "")); }
  function okMedia(u) { return !u || /^(\/(?!\/)|https:\/\/)/.test(u); }
  window.addEventListener("beforeunload", function (e) { if (dirty.config || dirty.links) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- sign in: password, then the authenticator code ---------- */
  Site.ready(function () {
    var form = $("cp-form"), input = $("cp-pass"), msg = $("cp-login-msg"), go = $("cp-go");
    var codeBox = $("cp-code-box"), code = $("cp-code"), passBox = $("cp-pass-box"), steps = $("cp-steps"), held = "";
    if (!form) return;
    function step(n) {
      passBox.hidden = n !== 1; codeBox.hidden = n !== 2; go.textContent = n === 2 ? "Verify code" : "Continue";
      if (steps) Array.prototype.forEach.call(steps.children, function (li, k) { li.setAttribute("data-on", String(k < n)); if (k === n - 1) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current"); });
      try { (n === 2 ? code : input).focus(); } catch (e) {}
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var second = !codeBox.hidden, p = second ? held : input.value, c = second ? code.value.replace(/\D/g, "") : null;
      if (!p || (second && c.length !== 6)) { if (second) msg.textContent = "Type the 6-digit code from your authenticator app."; return; }
      go.disabled = true; msg.textContent = "Checking…";
      rpc("site_admin_login", { p_pass: p, p_code: c }).then(function (r) {
        go.disabled = false;
        if (r && r.error === "need-code") { held = p; input.value = ""; msg.textContent = "Password accepted. Now the code from your authenticator app."; step(2); return; }
        if (!r || !r.ok || !r.token) {
          msg.textContent = why(r); Site.sfx("error");
          if (second) { code.value = ""; if (r && (r.error === "wrong" || r.error === "locked" || r.error === "unset")) { held = ""; step(1); } else code.focus(); } else input.select();
          return;
        }
        held = ""; input.value = ""; code.value = ""; msg.textContent = "Signed in. Opening the panel…";
        try {
          Site.admin.set({ token: r.token, twofa: !!r.twofa, expires: r.expires });
          enter({ twofa: !!r.twofa, expires: r.expires, linked: !!r.twofa }, true, r.token);
        } catch (err) { console.error("[control]", err); msg.textContent = "Signed in, but the panel could not open (" + (err && err.message) + "). Reload the page with Ctrl+Shift+R and try again."; }
      });
    });
    var back = $("cp-code-back"); if (back) back.addEventListener("click", function () { held = ""; code.value = ""; msg.textContent = ""; step(1); });
    /* still signed in from earlier in this tab? */
    var had = Site.admin.get();
    if (had && had.token) {
      msg.textContent = "Checking your sign-in…"; go.disabled = true;
      Site.admin.check().then(function (r) { go.disabled = false; msg.textContent = ""; if (r && r.ok) enter(r, false); else step(1); });
    } else step(1);
  }, "control");

  function enter(info, fresh, tok) {
    var a = Site.admin.get(); token = tok || (a && a.token) || ""; sess = info;
    Promise.all([Site.remote(true), Site.data("links"), loadStats()]).then(function (got) {
      var rem = got[0] || {}, file = got[1];
      ov = isObj(rem.config) ? JSON.parse(JSON.stringify(rem.config)) : {};
      var src = Array.isArray(rem.links) && rem.links.length ? rem.links : ((file && file.items) || []);
      links = src.slice().sort(function (a, b) { return (+a.rank || 9999) - (+b.rank || 9999); }).map(function (x) {
        return { id: String(x.id || ""), title: String(x.title || ""), url: String(x.url || ""), founded: String(x.founded || ""), color: /^#[0-9a-f]{6}$/i.test(x.color) ? x.color : "#cd4257", image: String(x.image || ""), video: String(x.video || ""), blurb: String(x.blurb || ""), _old: true };
      });
      $("cp-login").hidden = true; $("cp-lead").textContent = "Changes go live when you press Save. Visitors see them within about five minutes.";
      build(); if (fresh) { Site.sfx("success"); Site.toast("Signed in as site admin.", { type: "ok" }); }
      if (!sess.linked) show("security");
    }).catch(function (err) { console.error("[control]", err); var m = $("cp-login-msg"); if (m) m.textContent = "Signed in, but the panel could not open (" + (err && err.message) + "). Reload the page with Ctrl+Shift+R and try again."; });
  }

  function loadStats() {
    return fetch(SB.url + "/rest/v1/link_stats?select=id,clicks,score", { headers: HEAD, cache: "no-store" })
      .then(function (r) { if (!r.ok) throw r.status; return r.json(); })
      .then(function (rows) { statsOn = true; stats = {}; (rows || []).forEach(function (x) { stats[x.id] = { clicks: +x.clicks || 0, score: +x.score || 0 }; }); })
      .catch(function () { statsOn = false; });
  }

  /* ---------- the panel ---------- */
  var TABS = [["links", "Links I Like"], ["switches", "Switches"], ["values", "Site values"], ["cheats", "Cheats"], ["advanced", "Advanced"], ["security", "Sign-in"]];
  var saveBtn, saveMsg, panes = {};
  function paintSave() {
    if (!saveBtn) return;
    var n = (dirty.config ? 1 : 0) + (dirty.links ? 1 : 0);
    saveBtn.disabled = !n; saveBtn.textContent = n ? "Save changes" : "Saved";
    if (n) saveMsg.textContent = "You have unsaved changes.";
  }
  function build() {
    var app = $("cp-app"); app.textContent = ""; app.hidden = false;
    var bar = el("div", { class: "cp-tabs", role: "tablist", "aria-label": "Control panel sections" });
    TABS.forEach(function (t, i) {
      var b = el("button", { type: "button", class: "cp-tab", role: "tab", id: "cp-tab-" + t[0], "aria-selected": String(i === 0), "aria-controls": "cp-pane-" + t[0], text: t[1] });
      b.addEventListener("click", function () { show(t[0]); Site.sfx("toggle"); });
      bar.appendChild(b);
      panes[t[0]] = el("section", { class: "panel cp-pane", role: "tabpanel", id: "cp-pane-" + t[0], "aria-labelledby": "cp-tab-" + t[0], hidden: i === 0 ? null : true });
    });
    saveBtn = el("button", { type: "button", class: "btn cp-save", disabled: true, text: "Saved" });
    saveMsg = el("span", { class: "cp-msg", role: "status", "aria-live": "polite" });
    saveBtn.addEventListener("click", save);
    var out = el("button", { type: "button", class: "btn ghost", text: "Sign out" });
    out.addEventListener("click", function () { dirty.config = dirty.links = false; out.disabled = true; Site.admin.signOut().then(function () { location.reload(); }); });
    app.appendChild(el("div", { class: "cp-live", id: "cp-live", role: "status" }));
    app.appendChild(el("div", { class: "cp-top" }, bar, el("div", { class: "cp-savebar" }, saveMsg, saveBtn, out)));
    paintLive(); if (!liveTimer) liveTimer = setInterval(paintLive, 30000);
    TABS.forEach(function (t) { app.appendChild(panes[t[0]]); });
    app.appendChild(el("section", { class: "panel cp-jump" }, el("h2", { text: "Other owner pages" }),
      el("p", { class: "pg-actions" },
        el("a", { class: "btn ghost", href: "/dash/", text: "Dashboard" }),
        el("a", { class: "btn ghost", href: "/games/station/", text: "Rate-O-Pedia Operation Station" }),
        el("a", { class: "btn ghost", href: "/links/", text: "Links I Like" }),
        el("a", { class: "btn ghost", href: "https://supabase.com/dashboard/project/zjhlhkruqzfendvbglsb", target: "_blank", rel: "noopener", text: "Supabase ↗" }),
        el("a", { class: "btn ghost", href: "https://github.com/damananders/damananders.github.io", target: "_blank", rel: "noopener", text: "GitHub ↗" }))));
    drawLinks(); drawSwitches(); drawValues(); drawCheats(); drawAdvanced(); drawSecurity();
  }
  /* The "you are live" strip: green when password and authenticator were both checked, amber on password alone. */
  var liveTimer = 0;
  function paintLive() {
    var box = $("cp-live"); if (!box || !sess) return;
    var left = Math.max(0, new Date(sess.expires).getTime() - Date.now()), h = Math.floor(left / 36e5), m = Math.floor(left % 36e5 / 6e4);
    if (!left) { Site.admin.clear(); location.reload(); return; }
    box.textContent = ""; box.setAttribute("data-level", sess.twofa ? "full" : "pass");
    box.appendChild(el("span", { class: "cp-live__dot", "aria-hidden": "true" }));
    box.appendChild(el("span", { class: "cp-live__shield", "aria-hidden": "true" }, Site.svg('<path d="M12 3l7 3v5c0 4.6-3 8.3-7 10-4-1.700-7-5.400-7-10V6z"/><path d="M9 12l2.200 2.200L15.500 10"/>')));
    box.appendChild(el("div", { class: "cp-live__text" },
      el("strong", { text: "Live as Site Admin" }),
      el("span", { text: (sess.twofa ? "Password and authenticator verified" : "Password only. Link an authenticator in the Sign-in tab") + " · session ends in " + (h ? h + " h " : "") + m + " min" })));
  }
  function show(id) {
    TABS.forEach(function (t) { panes[t[0]].hidden = t[0] !== id; $("cp-tab-" + t[0]).setAttribute("aria-selected", String(t[0] === id)); });
    if (id === "advanced") drawAdvanced();
    if (id === "switches") drawSwitches();
    if (id === "values") drawValues();
  }

  function save() {
    var bad = dirty.links ? checkLinks() : "";
    if (bad) { saveMsg.textContent = bad; show("links"); Site.sfx("error"); return; }
    saveBtn.disabled = true; saveMsg.textContent = "Saving…";
    var jobs = [];
    if (dirty.config) jobs.push(rpc("site_admin_save", { p_token: token, p_key: "config", p_value: ov }).then(function (r) { if (r && r.ok) dirty.config = false; return r; }));
    if (dirty.links) jobs.push(rpc("site_admin_save", { p_token: token, p_key: "links", p_value: cleanLinks() }).then(function (r) { if (r && r.ok) { dirty.links = false; links.forEach(function (l) { l._old = true; }); } return r; }));
    Promise.all(jobs).then(function (rs) {
      var fail = rs.filter(function (r) { return !r || !r.ok; })[0];
      Site.store.set("remote", { t: Date.now(), config: dirty.config ? null : ov, links: dirty.links ? null : cleanLinks() });
      paintSave();
      if (fail) { saveMsg.textContent = why(fail); Site.sfx("error"); return; }
      saveMsg.textContent = "Saved. Live for visitors within about five minutes."; Site.sfx("success"); drawLinks();
    });
  }

  /* ---------- tab: links ---------- */
  function cleanLinks() {
    return links.map(function (l, i) { return { id: l.id, title: l.title.trim(), url: l.url.trim(), founded: l.founded.trim(), rank: i + 1, color: l.color, image: l.image.trim(), video: l.video.trim(), blurb: l.blurb.trim() }; });
  }
  function checkLinks() {
    var seen = {};
    for (var i = 0; i < links.length; i++) {
      var l = links[i], n = "Link " + (i + 1) + (l.title ? " (" + l.title + ")" : "") + ": ";
      if (!l.title.trim()) return n + "needs a title.";
      if (!l._old || !l.id) l.id = uniqueId(slug(l.title) || "link", i);
      if (!/^[a-z0-9-]{1,40}$/.test(l.id)) return n + "has a bad id.";
      if (seen[l.id]) return n + "shares an id with another link.";
      seen[l.id] = 1;
      if (!okUrl(l.url.trim())) return n + "needs an address that starts with https:// or http://.";
      if (!okMedia(l.image.trim()) || !okMedia(l.video.trim())) return n + "picture and video must start with / or https://.";
    }
    return "";
  }
  function uniqueId(want, self) {
    var id = want, k = 2;
    while (links.some(function (l, i) { return i !== self && l.id === id; })) id = want.slice(0, 37) + "-" + (k++);
    return id;
  }
  function drawLinks() {
    var p = panes.links; if (!p) return; p.textContent = "";
    p.appendChild(el("h2", { text: "Links I Like" }));
    p.appendChild(el("p", { class: "cp-fine", text: "The order here is your personal ranking: the top one is number 1. Use the arrows to move a link, then press Save changes." + (statsOn ? "" : " Visit counts and votes are not switched on yet (run 10_links.sql).") }));
    var list = el("ol", { class: "cp-links" });
    links.forEach(function (l, i) { list.appendChild(linkRow(l, i)); });
    p.appendChild(list);
    var add = el("button", { type: "button", class: "btn ghost", text: "+ Add a link" });
    add.addEventListener("click", function () {
      links.push({ id: "", title: "", url: "https://", founded: "", color: "#cd4257", image: "", video: "", blurb: "", _old: false, _open: true });
      mark("links"); drawLinks();
      var rows = list.parentNode.querySelectorAll(".cp-link"), last = rows[rows.length - 1], f = last && last.querySelector("input"); if (f) f.focus();
    });
    p.appendChild(el("p", { class: "pg-actions" }, add));
  }
  function linkRow(l, i) {
    function move(d) { var j = i + d; if (j < 0 || j >= links.length) return; links.splice(j, 0, links.splice(i, 1)[0]); mark("links"); drawLinks(); var b = panes.links.querySelectorAll(".cp-link")[j]; b = b && b.querySelector(d < 0 ? ".cp-up" : ".cp-down"); if (b) b.focus(); }
    function txt(label, key, o) {
      o = o || {};
      var inp = o.area ? el("textarea", { rows: "2", maxlength: "400" }) : el("input", { type: o.type || "text", maxlength: o.max || "300", placeholder: o.ph || null });
      inp.value = l[key];
      inp.addEventListener("input", function () { l[key] = inp.value; mark("links"); if (key === "title") head.textContent = l.title || "New link"; if (key === "color") row.style.setProperty("--lk", l.color); });
      return el("label", { class: "cp-field" + (o.wide ? " cp-field--wide" : "") }, el("span", { text: label }), inp);
    }
    var head = el("strong", { class: "cp-link__title", text: l.title || "New link" });
    var up = el("button", { type: "button", class: "cp-mini cp-up", "aria-label": "Move " + (l.title || "link") + " up", title: "Move up", disabled: i === 0 ? true : null }, Site.svg('<path d="M6 14l6-6 6 6"/>'));
    var down = el("button", { type: "button", class: "cp-mini cp-down", "aria-label": "Move " + (l.title || "link") + " down", title: "Move down", disabled: i === links.length - 1 ? true : null }, Site.svg('<path d="M6 10l6 6 6-6"/>'));
    up.addEventListener("click", function () { move(-1); }); down.addEventListener("click", function () { move(1); });
    var pos = el("input", { type: "number", class: "cp-pos", min: "1", max: String(links.length), value: String(i + 1), "aria-label": "Ranking position of " + (l.title || "link") });
    pos.addEventListener("change", function () { var j = Math.max(1, Math.min(links.length, parseInt(pos.value, 10) || (i + 1))) - 1; if (j === i) { pos.value = String(i + 1); return; } links.splice(j, 0, links.splice(i, 1)[0]); mark("links"); drawLinks(); });
    var s = stats[l.id] || { clicks: 0, score: 0 };
    var body = el("div", { class: "cp-link__body", hidden: l._open ? null : true },
      el("div", { class: "cp-grid" },
        txt("Title", "title", { max: "80" }), txt("Address", "url", { type: "url", ph: "https://" }),
        txt("Founded", "founded", { max: "40", ph: "2008 or April 10, 2008" }), txt("Card colour", "color", { type: "color" }),
        txt("Picture (optional)", "image", { ph: "/assets/links/name.webp or https://…" }), txt("Video (optional)", "video", { ph: "/assets/links/name.mp4" }),
        txt("Description", "blurb", { area: true, wide: true })),
      numbers(l, s),
      (function () {
        var del = el("button", { type: "button", class: "cp-danger", text: "Remove this link" });
        del.addEventListener("click", function () { if (del.getAttribute("data-sure") !== "1") { del.setAttribute("data-sure", "1"); del.textContent = "Press again to remove"; return; } links.splice(i, 1); mark("links"); drawLinks(); });
        return el("p", { class: "cp-link__foot" }, del, l._old && l.id ? el("span", { class: "cp-fine", text: "id: " + l.id }) : null);
      })());
    var tog = el("button", { type: "button", class: "cp-mini cp-edit", "aria-expanded": String(!!l._open), text: l._open ? "Close" : "Edit" });
    tog.addEventListener("click", function () { l._open = !l._open; body.hidden = !l._open; tog.textContent = l._open ? "Close" : "Edit"; tog.setAttribute("aria-expanded", String(!!l._open)); });
    var row = el("li", { class: "cp-link", style: { "--lk": l.color } },
      el("div", { class: "cp-link__head" }, pos, up, down, head,
        el("span", { class: "cp-link__stat", text: statsOn ? s.clicks + " visits · " + s.score + " points" : "" }), tog),
      body);
    return row;
  }
  function numbers(l, s) {
    if (!statsOn || !l._old || !l.id) return null;
    var c = el("input", { type: "number", min: "0", value: String(s.clicks) }), sc = el("input", { type: "number", min: "0", value: String(s.score) });
    var msg = el("span", { class: "cp-msg", role: "status" }), b = el("button", { type: "button", class: "cp-mini", text: "Set numbers" });
    b.addEventListener("click", function () {
      b.disabled = true; msg.textContent = "Saving…";
      var nc = Math.max(0, parseInt(c.value, 10) || 0), ns = Math.max(0, parseInt(sc.value, 10) || 0);
      rpc("site_admin_link_stats", { p_token: token, p_id: l.id, p_clicks: nc, p_score: ns, p_remove: false }).then(function (r) {
        b.disabled = false;
        if (!r || !r.ok) { msg.textContent = why(r); return; }
        stats[l.id] = { clicks: nc, score: ns }; msg.textContent = "Done.";
      });
    });
    return el("div", { class: "cp-nums" }, el("label", { class: "cp-field" }, el("span", { text: "Visits from the site" }), c), el("label", { class: "cp-field" }, el("span", { text: "Public points" }), sc), b, msg);
  }

  /* ---------- tab: switches ---------- */
  var SWITCHES = [
    ["Whole site", [["navMenu", "Page menu at the top left"], ["settingsPanel", "Visitor settings panel"], ["themeToggle", "Light and dark theme button"], ["shareButton", "Share button"], ["stickyHeader", "Header stays on screen while scrolling"],
      ["scrollProgress", "Scroll progress line"], ["backToTop", "Back to top button"], ["footerLinks", "Footer page links"], ["channelBadges", "Footer channel badges"], ["lastUpdated", "Footer last updated stamp"], ["visitorCounter", "Retro visitor counter"],
      ["transitions", "Page to page transitions"], ["cursorRing", "Custom cursor ring"], ["serviceWorker", "Offline copy and instant repeat visits"], ["analytics", "Analytics (when a code is set)"]]],
    ["Fun", [["play", "Trophies and secret words layer"], ["trophies", "Trophies"], ["secretCodes", "Typed secret words"], ["padCombo", "Controller button combo"], ["konami", "Classic cheat code"], ["intro", "Boot intro on the hub"],
      ["seasons", "Seasonal effects"], ["game404", "Mini game on the not found page"], ["uiSounds", "Interface sounds (visitors turn them on)"], ["soundscape", "Hub soundscape (starts muted)"]]],
    ["Hub page", [["typing", "Typing headline"], ["parallax", "Background drifts with the pointer"], ["tilt", "Cards tilt in 3D"], ["glow", "Card glow pulse"], ["particles", "Ambient particles"], ["dayNight", "Tint follows the time of day"], ["ticker", "Latest update ticker"], ["nowCard", "Now building and now playing card"]]],
    ["Accessibility", [["a11y", "Accessibility options (text size, contrast, reading font)"], ["skipLink", "Skip to content link"]]]
  ];
  function drawSwitches() {
    var p = panes.switches; p.textContent = "";
    p.appendChild(el("h2", { text: "Switches" }));
    p.appendChild(el("p", { class: "cp-fine", text: "Turn any part of the site off for everyone. Off here means off for every visitor." }));
    SWITCHES.forEach(function (g) {
      var box = el("div", { class: "cp-switches" });
      g[1].forEach(function (s) {
        var path = "features." + s[0], cb = el("input", { type: "checkbox" }); cb.checked = val(path, true) !== false;
        cb.addEventListener("change", function () { put(path, cb.checked, true); });
        box.appendChild(el("label", { class: "cp-switch" }, cb, el("span", { text: s[1] })));
      });
      p.appendChild(el("h3", { class: "cp-h3", text: g[0] })); p.appendChild(box);
    });
  }

  /* ---------- tab: site values ---------- */
  var VALUES = [
    ["Hub headline", [["hero.lines", "Typing phrases, one per line (blank uses the built-in set; keep each to about 31 characters)", "lines"]]],
    ["Ko-fi goal", [["kofi.url", "Ko-fi page", "url"], ["kofi.goal.title", "Goal title", "text"], ["kofi.goal.current", "Raised so far this month", "number"], ["kofi.goal.target", "Monthly target", "number"]]],
    ["Channels (blank hides the badge)", [["channels.youtube", "YouTube", "url"], ["channels.instagram", "Instagram", "url"], ["channels.tiktok", "TikTok", "url"], ["channels.x", "X", "url"], ["channels.bluesky", "Bluesky", "url"]]],
    ["Twitch and Discord", [["twitch.channel", "Twitch channel name", "text"], ["twitch.live", "Live badge", "live"], ["discord.invite", "Discord invite code", "text"], ["discord.showCount", "Show member count", "bool"]]],
    ["AndersCraft", [["anderscraft.statusUrl", "Live status address (blank hides realm counts)", "url"]]],
    ["AnyPS", [["anyps.githubRepo", "GitHub releases repo, as owner/name", "text"], ["anyps.sha256", "Download checksum (64-bit)", "text"], ["anyps.sha256_32", "Download checksum (32-bit)", "text"]]],
    ["Résumé", [["resume.pdfUrl", "Downloadable PDF address (blank hides the button)", "url"], ["resume.contactEndpoint", "Contact form address", "url"]]],
    ["Counting", [["counter.provider", "Visitor counter", "counter"], ["analytics.goatcounter", "GoatCounter site code (blank is off)", "text"]]]
  ];
  function drawValues() {
    var p = panes.values; p.textContent = "";
    p.appendChild(el("h2", { text: "Site values" }));
    p.appendChild(el("p", { class: "cp-fine", text: "These sit on top of the values in the site's settings file. Everything saved here can be read by visitors, so do not put private links or keys in it." }));
    VALUES.forEach(function (g) {
      var grid = el("div", { class: "cp-grid" });
      g[1].forEach(function (f) {
        var path = f[0], kind = f[2], inp;
        if (kind === "bool") { inp = el("input", { type: "checkbox" }); inp.checked = val(path, true) !== false; inp.addEventListener("change", function () { put(path, inp.checked); }); grid.appendChild(el("label", { class: "cp-switch" }, inp, el("span", { text: f[1] }))); return; }
        if (kind === "lines") {
          inp = el("textarea", { rows: "7", maxlength: "1200", placeholder: "Azeroth, with looser rules?\nOne launcher, six PlayStations?" });
          var cur0 = val(path, null); inp.value = Array.isArray(cur0) ? cur0.join("\n") : "";
          inp.addEventListener("input", function () {
            var arr = inp.value.split("\n").map(function (l) { return l.trim().slice(0, 40); }).filter(Boolean).slice(0, 30);
            if (arr.length) set(ov, path, arr); else unset(ov, path);
            mark("config");
          });
          grid.appendChild(el("label", { class: "cp-field cp-field--wide" }, el("span", { text: f[1] }), inp)); return;
        }
        if (kind === "live" || kind === "counter") {
          var opts = kind === "live" ? [["auto", "Check automatically"], ["on", "Always show live"], ["off", "Never show live"]] : [["abacus", "On"], ["", "Off"]];
          inp = el("select", {}); opts.forEach(function (o) { inp.appendChild(el("option", { value: o[0], text: o[1] })); });
          var cur = val(path, kind === "live" ? "auto" : ""); inp.value = cur === true ? "on" : cur === false ? "off" : String(cur);
          inp.addEventListener("change", function () { put(path, kind === "live" ? (inp.value === "on" ? true : inp.value === "off" ? false : "auto") : inp.value); });
        } else {
          inp = el("input", { type: kind === "number" ? "number" : "text", maxlength: "300", min: kind === "number" ? "0" : null, inputmode: kind === "url" ? "url" : null });
          var v = val(path, ""); inp.value = v == null ? "" : String(v);
          inp.addEventListener("input", function () {
            var nv = kind === "number" ? (inp.value === "" ? 0 : Math.max(0, parseFloat(inp.value) || 0)) : inp.value.trim();
            var bad = kind === "url" && nv && !/^https:\/\//.test(nv); inp.setAttribute("aria-invalid", String(!!bad));
            if (!bad) put(path, nv);
          });
        }
        grid.appendChild(el("label", { class: "cp-field" }, el("span", { text: f[1] }), inp));
      });
      p.appendChild(el("h3", { class: "cp-h3", text: g[0] })); p.appendChild(grid);
    });
  }

  /* ---------- tab: cheats (read-only reference) ---------- */
  var CHEATS = [
    ["Type anywhere", "Type the word on any page — just not while you're in a text box. Press Esc to end an effect early.", [
      ["australia", "Turns the whole site upside down. Type it again or press Esc to flip back."],
      ["gravity", "Everything on the page drops to the floor."],
      ["moon", "Low gravity — the page's bits drift and float."],
      ["barrelroll", "The page does a quick barrel roll."],
      ["crt", "Old CRT-screen look. Type it again to switch it off."],
      ["disco", "Disco lights wash over the page."],
      ["matrix", "Green Matrix code rains down the screen."],
      ["404game", "Jumps straight to the 404 page — the boat game now, the case game later."]
    ]],
    ["Keyboard & controller", "", [
      ["↑ ↑ ↓ ↓ ← → ← → B A", "The Konami code, on the keyboard or a controller — confetti, and the Old School trophy."],
      ["△ ○ ✕ □", "On a controller — a barrel roll and the Button Masher trophy."]
    ]],
    ["Hidden door", "", [
      ["Five quick clicks, bottom-left corner", "Opens the secret code box on the hub and the AnyPS page. Its two codes (Personal Vault and PS Locker) are kept out of the page source on purpose so the door stays hidden — you already know them."]
    ]]
  ];
  function drawCheats() {
    var p = panes.cheats; if (!p) return; p.textContent = "";
    p.appendChild(el("h2", { text: "Cheat Codes" }));
    p.appendChild(el("p", { class: "cp-fine", text: "Every secret code on the site, in one place. This tab only shows them; nothing here changes anything." }));
    CHEATS.forEach(function (g) {
      p.appendChild(el("h3", { class: "cp-h3", text: g[0] }));
      if (g[1]) p.appendChild(el("p", { class: "cp-fine", text: g[1] }));
      var list = el("ul", { class: "cp-cheats" });
      g[2].forEach(function (c) {
        list.appendChild(el("li", { class: "cp-cheat" },
          el("code", { class: "cp-cheat__code", text: c[0] }),
          el("span", { class: "cp-cheat__desc", text: c[1] })));
      });
      p.appendChild(list);
    });
  }

  /* ---------- tab: advanced ---------- */
  function drawAdvanced() {
    var p = panes.advanced; p.textContent = "";
    p.appendChild(el("h2", { text: "Advanced" }));
    p.appendChild(el("p", { class: "cp-fine", text: "Everything this panel has changed, as raw settings. Any value from assets/site-config.js can be overridden here using the same names. An empty { } means the site runs on the file alone." }));
    var ta = el("textarea", { class: "cp-raw", rows: "14", spellcheck: "false", "aria-label": "Raw settings" }); ta.value = JSON.stringify(ov, null, 2);
    var msg = el("span", { class: "cp-msg", role: "status" });
    var apply = el("button", { type: "button", class: "btn ghost", text: "Apply these settings" });
    apply.addEventListener("click", function () {
      var j; try { j = JSON.parse(ta.value); } catch (e) { msg.textContent = "That is not valid JSON: " + e.message; return; }
      if (!isObj(j)) { msg.textContent = "It has to be a { } object."; return; }
      ov = j; mark("config"); msg.textContent = "Applied. Press Save changes to publish.";
    });
    var reset = el("button", { type: "button", class: "cp-danger", text: "Clear every override" });
    reset.addEventListener("click", function () { if (reset.getAttribute("data-sure") !== "1") { reset.setAttribute("data-sure", "1"); reset.textContent = "Press again to clear"; return; } ov = {}; mark("config"); drawAdvanced(); });
    p.appendChild(ta); p.appendChild(el("p", { class: "pg-actions" }, apply, reset, msg));
    var own = el("input", { type: "checkbox" }); own.checked = Site.owner;
    own.addEventListener("change", function () { if (own.checked) Site.store.set("owner", true); else Site.store.remove("owner"); });
    p.appendChild(el("h3", { class: "cp-h3", text: "This browser" }));
    p.appendChild(el("label", { class: "cp-switch" }, own, el("span", { text: "Owner view in this browser (shows the Dashboard and the Vault card)" })));
  }

  /* ---------- tab: sign-in (authenticator app + password) ---------- */
  function field(label, inp) { return el("label", { class: "cp-field" }, el("span", { text: label }), inp); }
  function codeInput() { return el("input", { type: "text", inputmode: "numeric", autocomplete: "one-time-code", maxlength: "7", pattern: "[0-9 ]*", placeholder: "123456", class: "cp-codein" }); }
  function drawSecurity() {
    var p = panes.security; p.textContent = "";
    p.appendChild(el("h2", { text: "Authenticator app" }));
    if (sess.linked) drawLinked(p); else drawLink(p);

    p.appendChild(el("h2", { class: "cp-h2gap", text: "Password" }));
    p.appendChild(el("p", { class: "cp-fine", text: "Changing the password signs every other browser out of the panel." }));
    var cur = el("input", { type: "password", autocomplete: "current-password", maxlength: "200" }), a = el("input", { type: "password", autocomplete: "new-password", maxlength: "200" }), b = el("input", { type: "password", autocomplete: "new-password", maxlength: "200" });
    var msg = el("span", { class: "cp-msg", role: "status" }), go = el("button", { type: "button", class: "btn ghost", text: "Change password" });
    go.addEventListener("click", function () {
      if (!cur.value) { msg.textContent = "Type your current password first."; return; }
      if (a.value.length < 12) { msg.textContent = ERR["too-short"]; return; }
      if (a.value !== b.value) { msg.textContent = "The two new password boxes do not match."; return; }
      go.disabled = true; msg.textContent = "Saving…";
      rpc("site_admin_set_password", { p_token: token, p_pass: cur.value, p_new: a.value }).then(function (r) {
        go.disabled = false;
        if (!r || !r.ok) { msg.textContent = why(r); return; }
        cur.value = a.value = b.value = ""; msg.textContent = "Password changed."; Site.sfx("success");
      });
    });
    p.appendChild(el("div", { class: "cp-grid" }, field("Current password", cur), el("span", {}), field("New password (12 or more characters)", a), field("New password again", b)));
    p.appendChild(el("p", { class: "pg-actions" }, go, msg));
  }
  function drawLink(p) {
    p.appendChild(el("p", { class: "cp-fine", text: "Add a second lock. Once an app is linked, signing in asks for your password and then the 6-digit code from the app. Works with Google Authenticator, Authy, Microsoft Authenticator, 1Password and similar apps." }));
    var area = el("div", { class: "cp-2fa" }), msg = el("span", { class: "cp-msg", role: "status" });
    var start = el("button", { type: "button", class: "btn", text: "Link an authenticator app" });
    start.addEventListener("click", function () {
      start.disabled = true; msg.textContent = "Getting a new key…";
      rpc("site_admin_totp_begin", { p_token: token }).then(function (r) {
        start.disabled = false;
        if (!r || !r.ok || !r.secret) { msg.textContent = why(r); return; }
        msg.textContent = ""; start.hidden = true;
        var uri = "otpauth://totp/" + encodeURIComponent("Anders site:site admin") + "?secret=" + r.secret + "&issuer=" + encodeURIComponent("Anders site") + "&algorithm=SHA1&digits=6&period=30";
        var qr = el("div", { class: "cp-qr", role: "img", "aria-label": "QR code to scan with your authenticator app" });
        try { var q = window.qrcode(0, "M"); q.addData(uri); q.make(); qr.innerHTML = q.createSvgTag({ cellSize: 5, margin: 3, scalable: true }); } catch (e) { qr.textContent = "The QR picture could not be drawn. Type the key below into your app instead."; }
        var code = codeInput(), ok = el("button", { type: "button", class: "btn", text: "Turn it on" }), m2 = el("span", { class: "cp-msg", role: "status" });
        ok.addEventListener("click", function () {
          var c = code.value.replace(/\D/g, ""); if (c.length !== 6) { m2.textContent = "Type the 6-digit code the app shows."; return; }
          ok.disabled = true; m2.textContent = "Checking…";
          rpc("site_admin_totp_confirm", { p_token: token, p_code: c }).then(function (r2) {
            ok.disabled = false;
            if (!r2 || !r2.ok) { m2.textContent = why(r2); code.value = ""; code.focus(); return; }
            sess.linked = true; sess.twofa = true; var a = Site.admin.get(); if (a) { a.twofa = true; Site.admin.set(a); }
            paintLive(); drawSecurity(); Site.sfx("success"); Site.toast("Authenticator linked. Sign-in now asks for a code.", { type: "ok", ms: 4200 });
          });
        });
        area.appendChild(el("ol", { class: "cp-2fa__steps" },
          el("li", {}, "Open your authenticator app and choose to add an account by scanning a QR code.", qr),
          el("li", {}, "No camera? Add it by hand with this key (time based, 6 digits):", el("code", { class: "cp-key", text: r.secret.replace(/(.{4})/g, "$1 ").trim() })),
          el("li", {}, "Type the 6-digit code the app shows now, to prove it works.", el("div", { class: "cp-2fa__go" }, code, ok, m2))));
        area.appendChild(el("p", { class: "cp-fine", text: "This key is shown only now. Anyone who has it can make your codes, so do not screenshot or share it. If you lose the phone, the set-up file explains how to unlink the app from Supabase." }));
        try { code.focus(); } catch (e) {}
      });
    });
    p.appendChild(el("p", { class: "pg-actions" }, start, msg)); p.appendChild(area);
  }
  function drawLinked(p) {
    p.appendChild(el("p", { class: "cp-ok" }, el("span", { class: "cp-live__dot", "aria-hidden": "true" }), "An authenticator app is linked. Signing in asks for your password, then its code."));
    var pw = el("input", { type: "password", autocomplete: "current-password", maxlength: "200" }), code = codeInput();
    var msg = el("span", { class: "cp-msg", role: "status" }), off = el("button", { type: "button", class: "cp-danger", text: "Unlink the authenticator" });
    off.addEventListener("click", function () {
      var c = code.value.replace(/\D/g, ""); if (!pw.value || c.length !== 6) { msg.textContent = "Unlinking needs your password and a fresh code from the app."; return; }
      off.disabled = true; msg.textContent = "Checking…";
      rpc("site_admin_totp_off", { p_token: token, p_pass: pw.value, p_code: c }).then(function (r) {
        off.disabled = false;
        if (!r || !r.ok) { msg.textContent = why(r); return; }
        sess.linked = false; sess.twofa = false; var a = Site.admin.get(); if (a) { a.twofa = false; Site.admin.set(a); }
        paintLive(); drawSecurity();
      });
    });
    var d = el("details", { class: "cp-unlink" }, el("summary", { text: "Unlink or move to a new phone" }),
      el("p", { class: "cp-fine", text: "To move to a new phone, unlink here and then link the new app. Unlinking needs your password and a current code." }),
      el("div", { class: "cp-grid" }, field("Password", pw), field("Code from the app", code)), el("p", { class: "pg-actions" }, off, msg));
    p.appendChild(d);
  }
})();
