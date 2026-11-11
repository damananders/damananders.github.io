/* pages/vault.js: Personal Vault upgrades (see assets/README.md).
 *   1. Optional passphrase gate   Site.config.vault.passphraseSha256 (cosmetic: Drive sharing is the real lock)
 *   2. Unlock animation           once per browser session, never under reduced motion, any key / click skips it
 *   3. Per-item details           assets/data/vault-meta.json merged into the cards by exact title
 *   4. Owner tools                "Show the Vault card on my hub" switch, and Lock when the gate is in use
 * The catalogue itself is rendered by the page's inline script and works without this file.
 */
(function () {
  "use strict";
  if (!window.Site) return;
  var Site = window.Site, el = Site.el, root = document.documentElement;
  var cfg = Site.config || {}, feats = cfg.features || {};
  function enabled(k) { return feats[k] !== false; }
  var SEEN = "vt.door", UNLOCK = "vault.unlock";
  var gate = { on: false, locked: false, lock: null }; /* filled in by the gate module */

  /* ---------- unlock animation ---------- */
  var door = null, doorTimer = 0;
  function seen() { try { return sessionStorage.getItem(SEEN) === "1"; } catch (e) { return true; } }
  function markSeen() { try { sessionStorage.setItem(SEEN, "1"); } catch (e) {} }
  function endDoor() {
    clearTimeout(doorTimer); doorTimer = 0;
    window.removeEventListener("keydown", endDoor, true);
    window.removeEventListener("pointerdown", endDoor, true);
    root.classList.remove("vt-opening", "vt-pre");
    if (door) { door.remove(); door = null; }
  }
  function doorSvg() {
    var s = '<circle class="vt-door__frame" cx="100" cy="100" r="96"/>';
    s += '<rect class="vt-door__bolt vt-door__bolt--n" x="91" y="8" width="18" height="24" rx="3"/>';
    s += '<rect class="vt-door__bolt vt-door__bolt--s" x="91" y="168" width="18" height="24" rx="3"/>';
    s += '<rect class="vt-door__bolt vt-door__bolt--e" x="168" y="91" width="24" height="18" rx="3"/>';
    s += '<rect class="vt-door__bolt vt-door__bolt--w" x="8" y="91" width="24" height="18" rx="3"/>';
    s += '<circle class="vt-door__plate" cx="100" cy="100" r="78"/><circle class="vt-door__ring" cx="100" cy="100" r="62"/>';
    var i, a, c, n;
    for (i = 0; i < 8; i++) { a = (i * 45 + 22.5) * Math.PI / 180; s += '<circle class="vt-door__rivet" cx="' + (100 + 70 * Math.cos(a)).toFixed(1) + '" cy="' + (100 + 70 * Math.sin(a)).toFixed(1) + '" r="2.6"/>'; }
    s += '<g class="vt-door__dial"><circle cx="100" cy="100" r="40"/>';
    for (i = 0; i < 12; i++) {
      a = i * 30 * Math.PI / 180; c = Math.cos(a); n = Math.sin(a);
      s += '<line' + (i === 9 ? ' class="vt-door__mark"' : "") + ' x1="' + (100 + 31 * c).toFixed(1) + '" y1="' + (100 + 31 * n).toFixed(1) + '" x2="' + (100 + 37 * c).toFixed(1) + '" y2="' + (100 + 37 * n).toFixed(1) + '"/>';
    }
    for (i = 0; i < 3; i++) { a = (i * 120 - 90) * Math.PI / 180; s += '<line class="vt-door__spoke" x1="100" y1="100" x2="' + (100 + 24 * Math.cos(a)).toFixed(1) + '" y2="' + (100 + 24 * Math.sin(a)).toFixed(1) + '"/>'; }
    s += '<circle class="vt-door__hub" cx="100" cy="100" r="7"/></g>';
    return Site.svg(s, { viewBox: "0 0 200 200", class: "vt-door__svg", stroke: null, "stroke-width": null, "stroke-linecap": null, "stroke-linejoin": null });
  }
  function playDoor() {
    root.classList.remove("vt-pre");
    if (Site.reducedMotion || door || !document.body || !enabled("vaultDoor")) return;
    markSeen();
    doorTimer = setTimeout(endDoor, 1300);            /* set first, so the overlay always goes away */
    window.addEventListener("keydown", endDoor, true);
    window.addEventListener("pointerdown", endDoor, true);
    door = el("div", { class: "vt-door", "aria-hidden": "true" }, doorSvg());
    document.body.appendChild(door);
    root.classList.add("vt-opening");
    Site.sfx("open");
  }

  /* ---------- 1. passphrase gate ---------- */
  Site.ready(function () {
    var v = cfg.vault || {};
    var hash = typeof v.passphraseSha256 === "string" ? v.passphraseSha256.trim().toLowerCase() : "";
    var cat = document.getElementById("catalogue");
    if (!/^[0-9a-f]{64}$/.test(hash) || !cat || !cat.parentNode) return;                 /* blank or malformed: no gate */
    if (!(window.crypto && crypto.subtle && crypto.subtle.digest && window.TextEncoder)) return; /* can't check a phrase here: no gate */
    gate.on = true;

    var input = el("input", { class: "vt-gate__input", id: "vt-pass", type: "password", autocomplete: "off", autocapitalize: "off", spellcheck: "false", "aria-describedby": "vt-gate-msg" });
    var msg = el("p", { class: "vt-gate__msg", id: "vt-gate-msg", role: "alert" });
    var go = el("button", { class: "btn vt-gate__go", type: "submit", text: "Unlock" });
    var form = el("form", { class: "vt-gate", id: "vt-gate", "aria-labelledby": "vt-gate-title", novalidate: true, hidden: true },
      el("div", { class: "vt-gate__head" },
        el("span", { class: "vt-gate__icon" }, Site.svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1.2"/>')),
        el("h2", { class: "vt-gate__title", id: "vt-gate-title", text: "This vault is locked" })),
      el("p", { class: "vt-gate__hint", text: "Type the passphrase to see what's stored here." }),
      el("label", { class: "vt-gate__label", for: "vt-pass", text: "Passphrase" }),
      el("div", { class: "vt-gate__row" }, input, go),
      msg);
    cat.parentNode.insertBefore(form, cat);

    function setLocked(yes) {
      gate.locked = yes;
      root.classList.toggle("vt-locked", yes);
      form.hidden = !yes;
      if (yes) { input.value = ""; input.removeAttribute("aria-invalid"); msg.textContent = ""; }
      Site.emit("vault:lock", yes);
    }
    function sha256(text) {
      return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) { return (b < 16 ? "0" : "") + b.toString(16); }).join("");
      });
    }
    var busy = false;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (busy) return;
      var phrase = input.value;
      if (!phrase) { msg.textContent = "Type the passphrase first."; input.setAttribute("aria-invalid", "true"); input.focus(); return; }
      busy = true;
      sha256(phrase).then(function (hex) {
        busy = false;
        if (hex === hash) {
          Site.store.set(UNLOCK, hash);
          setLocked(false);
          playDoor();
          if (!cat.hasAttribute("tabindex")) cat.setAttribute("tabindex", "-1");
          try { cat.focus({ preventScroll: true }); } catch (err) {}
          Site.sfx("success");
          Site.toast("Vault unlocked.", { type: "ok" });
        } else {
          msg.textContent = "";                       /* re-announce when the same message repeats */
          setTimeout(function () { msg.textContent = "That's not the passphrase. Try again."; }, 30);
          input.setAttribute("aria-invalid", "true"); input.focus(); input.select();
          Site.sfx("error");
        }
      }, function () {
        /* hashing failed in this browser: don't leave the owner locked out of a cosmetic gate */
        busy = false; setLocked(false);
      });
    });
    input.addEventListener("input", function () { if (input.hasAttribute("aria-invalid")) { input.removeAttribute("aria-invalid"); msg.textContent = ""; } });

    gate.lock = function () {
      Site.store.remove(UNLOCK);
      setLocked(true);
      try { input.focus(); } catch (e) {}
      Site.sfx("close");
      Site.toast("Vault locked. This browser will ask for the passphrase again.", { type: "info" });
    };
    setLocked(Site.store.get(UNLOCK, "") !== hash);
  }, "vault-gate");

  /* ---------- 2. unlock animation on arrival (after a passphrase unlock it plays from the gate instead) ---------- */
  Site.ready(function () {
    if (gate.locked || seen()) { root.classList.remove("vt-pre"); return; }
    playDoor();
  }, "vault-door");
  root.classList.remove("vt-pre"); /* whatever happened above, never leave the plain cover up */

  /* ---------- 3. per-item details from assets/data/vault-meta.json ---------- */
  Site.ready(function () {
    if (!enabled("vaultMeta")) return;
    var cards = document.querySelectorAll("#catalogue .game"); if (!cards.length) return;
    function str(v) { return v == null ? "" : String(v).trim(); }
    Site.data("vault-meta").then(function (d) {
      var items = d && d.items; if (!items || typeof items !== "object") return;
      Array.prototype.forEach.call(cards, function (card) {
        if (card.querySelector(".vt-meta,.vt-note")) return;
        var h = card.querySelector("h3"), title = h ? h.textContent : "";
        if (!title || !Object.prototype.hasOwnProperty.call(items, title)) return;
        var m = items[title]; if (!m || typeof m !== "object") return;
        var size = typeof m.size === "number" ? Site.fmtBytes(m.size) : str(m.size);
        var date = str(m.date) ? Site.fmtDate(str(m.date)) : "";
        var chips = [["Version", str(m.version)], ["Size", size], ["Uploaded", date]].filter(function (c) { return c[1]; });
        var note = str(m.note);
        if (!chips.length && !note) return;
        var before = card.querySelector(".btn"), frag = document.createDocumentFragment();
        if (chips.length) frag.appendChild(el("ul", { class: "vt-meta", "aria-label": "Details" }, chips.map(function (c) {
          return el("li", { class: "vt-chip" }, el("span", { class: "vt-chip__k", text: c[0] }), el("span", { text: c[1] }));
        })));
        if (note) frag.appendChild(el("p", { class: "vt-note", text: note }));
        if (before && before.parentNode === card) card.insertBefore(frag, before); else card.appendChild(frag);
      });
    });
  }, "vault-meta");

  /* ---------- 4. owner tools: hub card switch (+ Lock when the gate is in use) ---------- */
  Site.ready(function () {
    var wrap = document.querySelector(".wrap"); if (!wrap) return;
    var sw = el("button", { class: "vt-switch", type: "button", role: "switch", "aria-checked": Site.owner ? "true" : "false" },
      el("span", { class: "vt-switch__track", "aria-hidden": "true" }),
      el("span", null, "Show the Vault card on my hub ", el("span", { class: "vt-switch__hint", text: "(this browser)" })));
    sw.addEventListener("click", function () {
      var yes = sw.getAttribute("aria-checked") !== "true";
      if (yes) { Site.store.set("owner", true); root.setAttribute("data-owner", ""); }
      else { Site.store.remove("owner"); root.removeAttribute("data-owner"); }
      sw.setAttribute("aria-checked", yes ? "true" : "false");
      Site.sfx("toggle");
      Site.toast(yes ? "The Vault card now shows on your hub in this browser." : "The Vault card is hidden on your hub in this browser.", { type: "ok" });
    });
    var bar = el("div", { class: "vt-tools" }, sw);
    if (gate.on && gate.lock) {
      bar.appendChild(el("button", { class: "vt-btn", type: "button", onclick: function () { gate.lock(); } },
        Site.svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'), "Lock"));
    }
    var foot = wrap.querySelector("footer");
    if (foot && foot.parentNode === wrap) wrap.insertBefore(bar, foot); else wrap.appendChild(bar);
  }, "vault-tools");
})();
