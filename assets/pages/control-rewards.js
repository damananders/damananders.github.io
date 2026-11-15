/* pages/control-rewards.js — the Rewards folder of the owner's control panel (/control/). Prefix rw-.
 *
 * Plugs into control.js through Site.cpExt (no edits to that file's folders). Everything here is a front end for the
 * Rate-O-Pedia rewards SQL (28_rewards_core.sql, later rounds add automatic rules, review and profile edits). Every call sends the panel's session
 * key and the server checks it again, so nothing here is a lock by itself.
 *
 *   Member     one member's bank: grant / remove / lock on / lock off / unlock / equip; profile cosmetics + name
 *   Catalog    add, edit, enable, hide, delete rewards; bulk grant; recheck everyone
 *   Review     rewards waiting for the owner (needs_review)
 *   Audit      every grant, removal, lock, equip and catalog change
 *   Discord    how the Discord role/nickname queue is doing
 *
 * RPC names live in R so they are easy to re-point. Later-round ones (rules, review, profile edits) may not exist yet: the view says so instead of failing.
 */
(function () {
  "use strict";
  if (!window.Site || window.Site.page !== "control") return;
  var Site = window.Site, el = Site.el;

  var R = {
    bank: "site_admin_member_rewards", set: "site_admin_reward_set", equip: "site_admin_reward_equip",
    bulk: "site_admin_reward_bulk_grant", catalog: "site_admin_rewards_catalog", upsert: "site_admin_reward_upsert",
    del: "site_admin_reward_delete", audit: "site_admin_reward_audit", dq: "site_admin_discord_queue",
    members: "site_admin_member_list",
    /* later rounds (rules, review, profile edits) */
    queue: "site_admin_reward_queue", decide: "site_admin_reward_decide", recheck: "site_admin_reward_recheck_all",
    profile: "site_admin_member_profile_set"
  };
  var KINDS = [["discord_role", "Discord role"], ["badge", "Profile badge"], ["frame", "Avatar frame"], ["banner", "Banner"], ["name_fx", "Name effect"], ["accent", "Accent colour"], ["page_fx", "Page effect"], ["flair", "Flair"]];
  var SLOTS = [["badge", "Badge (wear up to 3)"], ["color", "Name colour (wear 1)"], ["fixed", "Fixed (always on)"]];
  var STATES = { earned: "Earned", granted: "Granted", pending: "Waiting for review", locked_on: "Locked on", locked_off: "Locked off", grandfathered: "Grandfathered" };
  var HELD = { earned: 1, granted: 1, locked_on: 1, grandfathered: 1 };
  var TRIGGERS = ["ratings", "reviews", "review_helpful", "lists", "followers", "forum_posts", "forum_reactions_received", "member_days", "supporter", "supporter_monthly", "ra_masteries", "anderscraft_level", "anderscraft_hardcore", "trophies_all", "trophies_platinum", "trophy:", "arcade:row-home/best", "arcade:supreme-lobbing/cleared", "arcade:supreme-lobbing/pcleared", "arcade:supreme-lobbing/bestWave", "arcade:review-score/best.easy", "arcade:review-score/best.medium", "arcade:review-score/best.hard", "arcade:review-score/best.harder", "arcade:review-score/best.harderer"];
  var ICON = '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>';

  var api = null, tab = "member", who = "", catalog = null;
  function kindLabel(k) { for (var i = 0; i < KINDS.length; i++) if (KINDS[i][0] === k) return KINDS[i][1]; return k; }
  function call(name, extra) { var b = { p_token: api.token() }; for (var k in extra) b[k] = extra[k]; return api.rpc(name, b); }
  function unset(r) { return r && (r.error === "unset" || /could not find the function|does not exist/i.test(r.error || "")); }
  function say(node, txt, kind) { node.textContent = txt || ""; node.setAttribute("data-kind", kind || ""); }
  function fail(node, r, round) {
    if (unset(r)) say(node, round === 29 ? "This part switches on with the next Rate-O-Pedia rewards update (rules and review). Nothing to do here until then." : "Rewards aren't switched on yet. Run 28_rewards_core.sql in the Supabase SQL Editor, then press Refresh.", "warn");
    else say(node, api.why(r), "err");
    Site.sfx("error");
  }

  /* ---------- the folder ---------- */
  var TABS = [["member", "Member"], ["catalog", "Catalog"], ["queue", "Review queue"], ["audit", "Audit log"], ["discord", "Discord sync"]];
  function draw(p, a) {
    api = a; p.textContent = "";
    p.appendChild(el("h2", { class: "cp-pane__h", text: "Rewards" }));
    p.appendChild(el("p", { class: "cp-fine", text: "Earnable Discord roles and profile cosmetics. Members wear at most 1 name colour and 3 badge roles. Changes to Discord roles and nicknames go through the bot within about a minute." }));
    var bar = el("div", { class: "rw-tabs", role: "tablist", "aria-label": "Rewards views" });
    var pane = el("div", { class: "rw-pane", role: "tabpanel" });
    TABS.forEach(function (t) {
      var b = el("button", { type: "button", role: "tab", class: "rw-tab", "aria-selected": String(t[0] === tab), text: t[1] });
      b.addEventListener("click", function () { tab = t[0]; Site.sfx("toggle"); draw(p, api); });
      bar.appendChild(b);
    });
    /* arrow keys move along the tabs */
    bar.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var i = TABS.map(function (t) { return t[0]; }).indexOf(tab), j = (i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length;
      tab = TABS[j][0]; draw(p, api); var nb = p.querySelectorAll(".rw-tab")[j]; if (nb) nb.focus(); e.preventDefault();
    });
    p.appendChild(bar); p.appendChild(pane);
    ({ member: drawMember, catalog: drawCatalog, queue: drawQueue, audit: drawAudit, discord: drawDiscord })[tab](pane);
  }

  /* ---------- Member: one bank ---------- */
  function drawMember(p) {
    var inp = el("input", { type: "search", class: "cp-search", placeholder: "Member handle…", value: who, "aria-label": "Member handle", autocomplete: "off", list: "rw-handles" });
    var dl = el("datalist", { id: "rw-handles" });
    var go = el("button", { type: "button", class: "cp-mini", text: "Open bank" });
    var msg = el("span", { class: "cp-msg rw-msg", role: "status", "aria-live": "polite" });
    var out = el("div", { class: "rw-bank" });
    var t;
    inp.addEventListener("input", function () {
      clearTimeout(t); var q = inp.value.trim(); if (q.length < 2) return;
      t = setTimeout(function () {
        call(R.members, { p_q: q, p_limit: 12, p_offset: 0 }).then(function (r) {
          dl.textContent = ""; if (!r || !r.ok || !Array.isArray(r.members)) return;
          r.members.forEach(function (m) { dl.appendChild(el("option", { value: m.handle, text: (m.forced_name || m.name || m.handle) })); });
        });
      }, 250);
    });
    function open() { who = inp.value.trim().replace(/^@/, ""); if (!who) { say(msg, "Type a member's handle first."); return; } loadBank(out, msg); }
    go.addEventListener("click", open);
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); open(); } });
    p.appendChild(el("div", { class: "cp-urow" }, el("div", { class: "cp-search__wrap" }, Site.svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'), inp), dl, go, msg));
    p.appendChild(out);
    if (who) loadBank(out, msg);
    else out.appendChild(el("p", { class: "cp-empty", text: "Open a member's bank by handle, or press Rewards on their card in the Users folder." }));
  }
  function loadBank(out, msg) {
    say(msg, "Loading…");
    call(R.bank, { p_handle: who }).then(function (r) {
      if (!r || !r.ok) { out.textContent = ""; fail(msg, r); return; }
      say(msg, ""); paintBank(out, msg, r.rewards || []);
    });
  }
  function paintBank(out, msg, rows) {
    out.textContent = "";
    var held = rows.filter(function (x) { return HELD[x.state]; }).length;
    var wornC = rows.filter(function (x) { return x.slot === "color" && x.equipped; }).length;
    var wornB = rows.filter(function (x) { return x.slot === "badge" && x.equipped; }).length;
    out.appendChild(el("div", { class: "rw-sum" },
      el("a", { class: "rw-sum__who", href: "/games/profile/?u=" + encodeURIComponent(who), target: "_blank", rel: "noopener", text: "@" + who + " ↗" }),
      el("span", { text: held + " held" }), el("span", { text: wornC + "/1 colour" }), el("span", { text: wornB + "/3 badges" })));
    var groups = {};
    rows.forEach(function (x) { (groups[x.kind] = groups[x.kind] || []).push(x); });
    KINDS.forEach(function (k) {
      var list = groups[k[0]]; if (!list) return;
      out.appendChild(el("h3", { class: "cp-h3", text: k[1] + (k[0] === "discord_role" ? "s" : "") }));
      var ul = el("ul", { class: "rw-list" });
      list.forEach(function (x) { ul.appendChild(bankRow(x, out, msg)); });
      out.appendChild(ul);
    });
    if (!rows.length) out.appendChild(el("p", { class: "cp-empty", text: "The catalog is empty. Add rewards in the Catalog tab." }));
    out.appendChild(profileEditor(msg));
  }
  function bankRow(x, out, msg) {
    var st = x.state, has = !!HELD[st];
    var chips = el("span", { class: "rw-chips" });
    chips.appendChild(el("span", { class: "rw-chip rw-chip--" + (st || "none"), text: st ? STATES[st] || st : "Not held" }));
    if (x.slot) chips.appendChild(el("span", { class: "rw-chip", text: x.slot === "color" ? "Colour" : x.slot === "fixed" ? "Fixed" : "Badge" }));
    if (x.kind === "discord_role") chips.appendChild(el("span", { class: "rw-chip " + (x.on_discord ? "rw-chip--on" : ""), title: x.has_role ? "" : "No Discord role id yet", text: !x.has_role ? "No role id" : x.on_discord ? "On in Discord" : "Off in Discord" }));
    if (!x.enabled) chips.appendChild(el("span", { class: "rw-chip rw-chip--off", text: "Disabled" }));
    if (x.hidden) chips.appendChild(el("span", { class: "rw-chip", text: "Hidden" }));
    function act(state) { return function () { run(R.set, { p_handle: who, p_reward: x.id, p_state: state }); }; }
    function run(name, extra) {
      say(msg, "Working…");
      call(name, extra).then(function (r) {
        if (!r || !r.ok) { fail(msg, r); if (r && r.rewards) paintBank(out, msg, r.rewards); return; }
        Site.sfx("toggle"); say(msg, "Done.", "ok"); if (r.rewards) paintBank(out, msg, r.rewards); else loadBank(out, msg);
      });
    }
    var row = el("div", { class: "cp-act__row" });
    function b(label, fn, cls) { var n = el("button", { type: "button", class: cls || "cp-mini", text: label, "data-label": label }); n.addEventListener("click", fn); row.appendChild(n); return n; }
    if (!has && st !== "locked_off") b("Grant", act("grant"));
    if (st === "pending") b("Approve", act("grant"));
    if (has && x.slot !== "fixed" && st !== "locked_on") b(x.equipped ? "Unequip" : "Equip", function () { run(R.equip, { p_handle: who, p_reward: x.id, p_on: !x.equipped }); });
    if (st !== "locked_on") b("Lock on", act("lock_on"));
    if (st !== "locked_off") b("Lock off", act("lock_off"));
    if (st === "locked_on" || st === "locked_off") b("Unlock", act("unlock"));
    if (st && st !== "locked_off") { var rm = b("Remove", function () {}, "cp-danger"); api.sure(rm, "Press again to remove", act("remove")); }
    return el("li", { class: "rw-item" + (has ? " is-held" : "") + (x.equipped ? " is-worn" : "") },
      el("span", { class: "rw-ic", "aria-hidden": "true", text: x.icon || "★" }),
      el("span", { class: "rw-txt" }, el("strong", { text: x.name }), el("small", { text: x.id + (x.hint ? " · " + x.hint : "") + (x.at && st ? " · " + api.when(x.at) : "") + (x.source ? " · " + x.source : "") })),
      chips, row);
  }
  /* profile cosmetics + name: later round (site_admin_member_profile_set). Blank fields are left alone. */
  function profileEditor(msg) {
    var F = [["forced_name", "Forced name (blank clears)", "text", 24], ["banner", "Banner", "text", 60], ["frame", "Avatar frame", "text", 60], ["accent", "Accent colour (#rrggbb)", "text", 7], ["flair", "Flair", "text", 60], ["motto", "Motto", "text", 140]];
    var ins = {}, grid = el("div", { class: "cp-grid" });
    F.forEach(function (f) { ins[f[0]] = el("input", { type: "text", maxlength: String(f[3]), placeholder: f[0] === "forced_name" ? "" : "unchanged" }); grid.appendChild(el("label", { class: "cp-field" }, el("span", { text: f[1] }), ins[f[0]])); });
    var av = el("input", { type: "checkbox" });
    var m2 = el("span", { class: "cp-msg rw-msg", role: "status" });
    var save = el("button", { type: "button", class: "btn ghost", text: "Save profile changes" });
    save.addEventListener("click", function () {
      var patch = {}, n = 0;
      F.forEach(function (f) { var v = ins[f[0]].value.trim(); if (v || f[0] === "forced_name") { if (f[0] === "forced_name" && !v && !ins[f[0]].dataset.touched) return; patch[f[0]] = v; n++; } });
      if (patch.accent && !/^#[0-9a-f]{6}$/i.test(patch.accent)) { say(m2, "Accent colour must look like #cd4257.", "err"); return; }
      if (av.checked) { patch.avatar_reset = true; n++; }
      if (!n) { say(m2, "Nothing to change yet."); return; }
      save.disabled = true; say(m2, "Saving…");
      call(R.profile, { p_handle: who, p_patch: patch }).then(function (r) {
        save.disabled = false;
        if (!r || !r.ok) { fail(m2, r, 29); return; }
        Site.sfx("success"); say(m2, "Saved. Their Discord nickname follows within a minute.", "ok");
      });
    });
    ins.forced_name.addEventListener("input", function () { ins.forced_name.dataset.touched = "1"; });
    return el("details", { class: "rw-prof" }, el("summary", { text: "Edit profile cosmetics and name" }),
      el("p", { class: "cp-fine", text: "Fill only what you want to change. A forced name also becomes their Discord nickname." }),
      grid, el("label", { class: "cp-switch" }, av, el("span", { text: "Reset their avatar to their Discord picture" })),
      el("p", { class: "pg-actions" }, save, m2));
  }

  /* ---------- Catalog ---------- */
  function drawCatalog(p) {
    var msg = el("span", { class: "cp-msg rw-msg", role: "status", "aria-live": "polite" });
    var refresh = el("button", { type: "button", class: "cp-mini", text: "Refresh" });
    var add = el("button", { type: "button", class: "cp-mini", text: "+ New reward" });
    var recheck = el("button", { type: "button", class: "cp-mini", text: "Recheck everyone", title: "Re-run every rule for every member and grant anything newly earned" });
    var list = el("div", { class: "rw-cat" }), editor = el("div", { class: "rw-edit" });
    refresh.addEventListener("click", function () { load(); });
    add.addEventListener("click", function () { editor.textContent = ""; editor.appendChild(editForm(null, msg, load)); var f = editor.querySelector("input"); if (f) f.focus(); });
    recheck.addEventListener("click", function () {
      recheck.disabled = true; say(msg, "Rechecking every member…");
      call(R.recheck, {}).then(function (r) { recheck.disabled = false; if (!r || !r.ok) { fail(msg, r, 29); return; } Site.sfx("success"); say(msg, "Done. " + (r.granted || 0) + " newly earned.", "ok"); load(); });
    });
    p.appendChild(el("div", { class: "cp-urow" }, add, recheck, refresh, msg));
    p.appendChild(editor); p.appendChild(list);
    p.appendChild(bulkBox());
    function load() {
      say(msg, "Loading…");
      call(R.catalog, {}).then(function (r) {
        list.textContent = "";
        if (!r || !r.ok) { fail(msg, r); return; }
        say(msg, ""); catalog = r.rewards || [];
        if (!catalog.length) { list.appendChild(el("p", { class: "cp-empty", text: "No rewards yet. Press + New reward." })); return; }
        var ul = el("ul", { class: "rw-list" });
        catalog.forEach(function (x) { ul.appendChild(catRow(x)); });
        list.appendChild(ul);
      });
    }
    function quick(x, patch) {
      var row = { id: x.id }; for (var k in patch) row[k] = patch[k];
      say(msg, "Saving…");
      call(R.upsert, { p_row: row }).then(function (r) { if (!r || !r.ok) { fail(msg, r); return; } Site.sfx("toggle"); say(msg, "Saved.", "ok"); load(); });
    }
    function catRow(x) {
      var en = el("input", { type: "checkbox" }); en.checked = !!x.enabled; en.addEventListener("change", function () { quick(x, { enabled: en.checked }); });
      var hi = el("input", { type: "checkbox" }); hi.checked = !!x.hidden; hi.addEventListener("change", function () { quick(x, { hidden: hi.checked }); });
      var ed = el("button", { type: "button", class: "cp-mini", text: "Edit" });
      ed.addEventListener("click", function () { editor.textContent = ""; editor.appendChild(editForm(x, msg, load)); editor.scrollIntoView({ block: "nearest" }); var f = editor.querySelector("input:not([readonly])"); if (f) f.focus(); });
      var del = el("button", { type: "button", class: "cp-danger", text: "Delete", "data-label": "Delete" });
      api.sure(del, x.holders ? "Remove from " + x.holders + " & delete?" : "Press again to delete", function () {
        say(msg, "Deleting…");
        call(R.del, { p_id: x.id }).then(function (r) { if (!r || !r.ok) { fail(msg, r); return; } say(msg, "Deleted. Taken from " + (r.holders_removed || 0) + " member(s).", "ok"); load(); });
      });
      var rule = x.trigger ? x.trigger + (x.threshold != null ? " ≥ " + x.threshold : "") + (x.trust === "self" ? " (self-reported)" : "") : "Owner only";
      return el("li", { class: "rw-item" + (x.enabled ? "" : " is-off") },
        el("span", { class: "rw-ic", "aria-hidden": "true", text: x.icon || "★" }),
        el("span", { class: "rw-txt" }, el("strong", { text: x.name }),
          el("small", { text: x.id + " · " + kindLabel(x.kind) + (x.slot ? " / " + x.slot : "") + " · " + rule + " · " + (x.holders || 0) + " holder" + (x.holders === 1 ? "" : "s") + (x.needs_review ? " · needs review" : "") + (x.kind === "discord_role" && !x.discord_role_id ? " · no role id" : "") })),
        el("span", { class: "rw-toggles" }, el("label", { class: "cp-switch cp-switch--inline" }, en, el("span", { text: "On" })), el("label", { class: "cp-switch cp-switch--inline" }, hi, el("span", { text: "Hidden" }))),
        el("span", { class: "cp-act__row" }, ed, del));
    }
    load();
  }
  function editForm(x, msg, done) {
    var isNew = !x; x = x || { kind: "discord_role", slot: "badge", trust: "verified", enabled: true, self_select: true, sort: 0 };
    var f = {};
    function inp(key, label, o) {
      o = o || {};
      var n;
      if (o.opts) { n = el("select", {}); if (o.blank) n.appendChild(el("option", { value: "", text: o.blank })); o.opts.forEach(function (q) { n.appendChild(el("option", { value: q[0], text: q[1] })); }); n.value = x[key] == null ? "" : String(x[key]); }
      else if (o.bool) { n = el("input", { type: "checkbox" }); n.checked = !!x[key]; f[key] = n; return el("label", { class: "cp-switch" }, n, el("span", { text: label })); }
      else { n = el("input", { type: o.type || "text", maxlength: o.max || "120", placeholder: o.ph || null, list: o.list || null, readonly: o.ro ? "" : null }); n.value = x[key] == null ? "" : String(x[key]); }
      f[key] = n;
      return el("label", { class: "cp-field" + (o.wide ? " cp-field--wide" : "") }, el("span", { text: label }), n);
    }
    var tl = el("datalist", { id: "rw-triggers" }); TRIGGERS.forEach(function (t) { tl.appendChild(el("option", { value: t })); });
    var grid = el("div", { class: "cp-grid" },
      inp("id", "Id (lowercase, dashes)", { max: "48", ph: "critic-1", ro: !isNew }), inp("name", "Name", { max: "60" }),
      inp("kind", "Kind", { opts: KINDS }), inp("slot", "Discord slot", { opts: SLOTS, blank: "— not a Discord role —" }),
      inp("icon", "Icon (emoji)", { max: "8" }), inp("value", "Cosmetic value (profiles)", { max: "60", ph: "gold-laurel" }),
      inp("discord_role_id", "Discord role id", { max: "25", ph: "filled by the Discord side" }), inp("sort", "Sort order", { type: "number" }),
      inp("hint", "How to earn (shown greyed in the bank)", { max: "120", wide: true }),
      inp("trigger", "Rule (blank = owner only)", { list: "rw-triggers", ph: "reviews, arcade:row-home/best, trophy:<id>…" }), inp("threshold", "Threshold", { type: "number" }),
      inp("trust", "Trust", { opts: [["verified", "Verified (checked in the database)"], ["self", "Self-reported (trophies, arcade)"]] }), el("span", {}));
    var sw = el("div", { class: "cp-switches" }, inp("enabled", "Enabled", { bool: 1 }), inp("hidden", "Hidden until earned", { bool: 1 }), inp("self_select", "Member can equip/unequip it", { bool: 1 }), inp("needs_review", "Needs my review before it's granted", { bool: 1 }));
    function syncSlot() { var role = f.kind.value === "discord_role"; f.slot.disabled = !role; f.discord_role_id.disabled = !role; f.value.disabled = role; if (!role) f.slot.value = ""; else if (!f.slot.value) f.slot.value = "badge"; }
    f.kind.addEventListener("change", syncSlot); syncSlot();
    var m2 = el("span", { class: "cp-msg rw-msg", role: "status" });
    var save = el("button", { type: "button", class: "btn", text: isNew ? "Add reward" : "Save reward" });
    var cancel = el("button", { type: "button", class: "btn ghost", text: "Close" });
    var box = el("section", { class: "rw-form" }, el("h3", { class: "cp-h3", text: isNew ? "New reward" : "Edit " + x.name }), tl, grid, sw, el("p", { class: "pg-actions" }, save, cancel, m2));
    cancel.addEventListener("click", function () { box.remove(); });
    save.addEventListener("click", function () {
      var row = {};
      ["id", "name", "kind", "slot", "icon", "value", "discord_role_id", "hint", "trigger", "trust"].forEach(function (k) { var v = f[k].disabled ? "" : f[k].value.trim(); row[k] = v === "" ? null : v; });
      row.sort = parseInt(f.sort.value, 10) || 0;
      row.threshold = f.threshold.value === "" ? null : +f.threshold.value;
      ["enabled", "hidden", "self_select", "needs_review"].forEach(function (k) { row[k] = f[k].checked; });
      if (!row.id || !/^[a-z0-9][a-z0-9-]{0,47}$/.test(row.id)) { say(m2, "The id needs lowercase letters, numbers and dashes.", "err"); return; }
      if (!row.name) { say(m2, "Give it a name.", "err"); return; }
      if (row.discord_role_id && !/^[0-9]{5,25}$/.test(row.discord_role_id)) { say(m2, "A Discord role id is only digits.", "err"); return; }
      if (isNew && catalog && catalog.some(function (c) { return c.id === row.id; })) { say(m2, "That id is already used.", "err"); return; }
      save.disabled = true; say(m2, "Saving…");
      call(R.upsert, { p_row: row }).then(function (r) {
        save.disabled = false;
        if (!r || !r.ok) { fail(m2, r); return; }
        Site.sfx("success"); say(msg, "Saved " + row.name + ".", "ok"); box.remove(); done();
      });
    });
    return box;
  }
  function bulkBox() {
    var sel = el("select", {}), ta = el("textarea", { rows: "4", placeholder: "handles, one per line or separated by commas" });
    var m2 = el("span", { class: "cp-msg rw-msg", role: "status" }), go = el("button", { type: "button", class: "btn ghost", text: "Grant to all of them" });
    function fill() { sel.textContent = ""; (catalog || []).forEach(function (c) { sel.appendChild(el("option", { value: c.id, text: (c.icon ? c.icon + " " : "") + c.name })); }); }
    var d = el("details", { class: "rw-prof" }, el("summary", { text: "Bulk grant" }),
      el("p", { class: "cp-fine", text: "Give one reward to many members at once (up to 500). Handles that don't exist are listed afterwards." }),
      el("div", { class: "cp-grid" }, el("label", { class: "cp-field" }, el("span", { text: "Reward" }), sel), el("span", {}), el("label", { class: "cp-field cp-field--wide" }, el("span", { text: "Handles" }), ta)),
      el("p", { class: "pg-actions" }, go, m2));
    d.addEventListener("toggle", function () { if (d.open) fill(); });
    go.addEventListener("click", function () {
      var hs = ta.value.split(/[\s,]+/).map(function (h) { return h.replace(/^@/, "").trim(); }).filter(Boolean);
      if (!sel.value || !hs.length) { say(m2, "Pick a reward and paste some handles.", "err"); return; }
      go.disabled = true; say(m2, "Granting to " + hs.length + "…");
      call(R.bulk, { p_reward: sel.value, p_handles: hs }).then(function (r) {
        go.disabled = false;
        if (!r || !r.ok) { fail(m2, r); return; }
        Site.sfx("success"); say(m2, "Granted to " + r.granted + "." + (r.failed && r.failed.length ? " Not found: " + r.failed.join(", ") : ""), "ok");
      });
    });
    return d;
  }

  /* ---------- Review queue (later round) ---------- */
  function drawQueue(p) {
    var msg = el("span", { class: "cp-msg rw-msg", role: "status", "aria-live": "polite" }), refresh = el("button", { type: "button", class: "cp-mini", text: "Refresh" });
    var list = el("div", {});
    p.appendChild(el("p", { class: "cp-fine cp-fine--tight", text: "Self-reported rewards marked “needs review”, and any claim that went past the daily limit or plausibility caps, wait here." }));
    p.appendChild(el("div", { class: "cp-urow" }, refresh, msg)); p.appendChild(list);
    function load() {
      say(msg, "Loading…");
      call(R.queue, {}).then(function (r) {
        list.textContent = "";
        if (!r || !r.ok) { fail(msg, r, 29); return; }
        var rows = r.rows || []; say(msg, rows.length ? rows.length + " waiting" : "");
        if (!rows.length) { list.appendChild(el("p", { class: "cp-empty", text: "Nothing waiting. Nice." })); return; }
        var ul = el("ul", { class: "rw-list" });
        rows.forEach(function (q) {
          function decide(yes) { return function () { say(msg, "Working…"); call(R.decide, { p_handle: q.handle, p_reward: q.reward, p_approve: yes }).then(function (r2) { if (!r2 || !r2.ok) { fail(msg, r2, 29); return; } Site.sfx(yes ? "success" : "toggle"); load(); }); }; }
          var ok = el("button", { type: "button", class: "cp-mini", text: "Approve" }); ok.addEventListener("click", decide(true));
          var no = el("button", { type: "button", class: "cp-danger", text: "Deny" }); no.addEventListener("click", decide(false));
          var open = el("button", { type: "button", class: "cp-mini", text: "Bank" }); open.addEventListener("click", function () { who = q.handle; tab = "member"; api.show("rewards"); });
          ul.appendChild(el("li", { class: "rw-item" },
            el("span", { class: "rw-ic", "aria-hidden": "true", text: q.icon || "★" }),
            el("span", { class: "rw-txt" }, el("strong", { text: (q.reward_name || q.reward) + " → " + (q.name || q.handle) }),
              el("small", { text: "@" + q.handle + " · " + api.when(q.at) + (q.detail ? " · " + JSON.stringify(q.detail).slice(0, 140) : "") })),
            el("span", { class: "cp-act__row" }, ok, no, open)));
        });
        list.appendChild(ul);
      });
    }
    refresh.addEventListener("click", load); load();
  }

  /* ---------- Audit log ---------- */
  var ACTS = { grant: "granted", remove: "removed", lock_on: "locked on", lock_off: "locked off", unlock: "unlocked", equip: "equipped", unequip: "unequipped", catalog_save: "saved catalog entry", catalog_delete: "deleted catalog entry", claim: "claimed", earn: "earned", approve: "approved", deny: "denied" };
  function drawAudit(p) {
    var h = el("input", { type: "search", class: "cp-search", placeholder: "Filter by handle (optional)", value: who, "aria-label": "Filter by handle" });
    var lim = el("select", { "aria-label": "How many" }); [50, 100, 250, 500].forEach(function (n) { lim.appendChild(el("option", { value: String(n), text: "Last " + n })); }); lim.value = "100";
    var go = el("button", { type: "button", class: "cp-mini", text: "Show" }), msg = el("span", { class: "cp-msg rw-msg", role: "status" });
    var out = el("div", {});
    p.appendChild(el("div", { class: "cp-urow" }, el("div", { class: "cp-search__wrap" }, h), lim, go, msg)); p.appendChild(out);
    function load() {
      say(msg, "Loading…");
      var hv = h.value.trim().replace(/^@/, "");
      call(R.audit, { p_limit: +lim.value, p_handle: hv || null }).then(function (r) {
        out.textContent = "";
        if (!r || !r.ok) { fail(msg, r); return; }
        var rows = r.rows || []; say(msg, rows.length + " entr" + (rows.length === 1 ? "y" : "ies"));
        if (!rows.length) { out.appendChild(el("p", { class: "cp-empty", text: "Nothing logged yet." })); return; }
        var tb = el("tbody", {});
        rows.forEach(function (a) {
          tb.appendChild(el("tr", {},
            el("td", { text: api.when(a.at) }), el("td", { text: a.actor || "" }),
            el("td", { text: ACTS[a.action] || a.action }), el("td", { text: a.reward || "" }),
            el("td", { text: a.handle ? "@" + a.handle : "—" }),
            el("td", { class: "rw-detail", text: a.detail ? JSON.stringify(a.detail).slice(0, 160) : "" })));
        });
        out.appendChild(el("div", { class: "rw-tablewrap" }, el("table", { class: "rw-table" },
          el("thead", {}, el("tr", {}, el("th", { text: "When" }), el("th", { text: "Who" }), el("th", { text: "Did" }), el("th", { text: "Reward" }), el("th", { text: "Member" }), el("th", { text: "Detail" }))), tb)));
      });
    }
    go.addEventListener("click", load); h.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); load(); } }); lim.addEventListener("change", load);
    load();
  }

  /* ---------- Discord sync health ---------- */
  function drawDiscord(p) {
    var msg = el("span", { class: "cp-msg rw-msg", role: "status" }), refresh = el("button", { type: "button", class: "cp-mini", text: "Refresh" }), out = el("div", {});
    p.appendChild(el("p", { class: "cp-fine cp-fine--tight", text: "Role and nickname changes wait in a queue that the Discord bot works through every minute. A growing “waiting” number means the bot isn't running." }));
    p.appendChild(el("div", { class: "cp-urow" }, refresh, msg)); p.appendChild(out);
    function load() {
      say(msg, "Loading…");
      call(R.dq, {}).then(function (r) {
        out.textContent = "";
        if (!r || !r.ok) { fail(msg, r); return; }
        say(msg, "");
        out.appendChild(el("div", { class: "rw-stats" },
          el("div", { class: "rw-stat" }, el("strong", { text: String(r.waiting || 0) }), el("span", { text: "waiting" })),
          el("div", { class: "rw-stat" + (r.failing ? " is-bad" : "") }, el("strong", { text: String(r.failing || 0) }), el("span", { text: "retrying after an error" }))));
        var errs = r.recent_errors || [];
        if (errs.length) {
          out.appendChild(el("h3", { class: "cp-h3", text: "Recent errors" }));
          var ul = el("ul", { class: "rw-list" });
          errs.forEach(function (e) { ul.appendChild(el("li", { class: "rw-item" }, el("span", { class: "rw-txt" }, el("strong", { text: e.op + (e.handle ? " · @" + e.handle : "") }), el("small", { text: api.when(e.at) + " · " + (e.error || "") })))); });
          out.appendChild(ul);
        } else out.appendChild(el("p", { class: "cp-fine", text: "No recent errors." }));
      });
    }
    refresh.addEventListener("click", load); load();
  }

  /* ---------- a "Rewards" button on each member's card in Users ---------- */
  function member(u, a) {
    var b = el("button", { type: "button", class: "cp-mini", text: "Open rewards bank" });
    b.addEventListener("click", function () { who = u.handle; tab = "member"; a.show("rewards"); });
    return el("div", { class: "cp-act" }, el("span", { class: "cp-act__lab", text: "Rewards (roles, badges, cosmetics)" }), el("div", { class: "cp-act__row" }, b));
  }

  Site.cpExt = Site.cpExt || [];
  Site.cpExt.push({ id: "rewards", label: "Rewards", desc: "Roles, badges, catalog, review", icon: ICON, after: "users", draw: draw, member: member });
})();
