/* arcade/wizard-story-admin.js — the control panel's "Wizard Story" page. Prefix wsa-.
 * The control panel calls WizStoryAdmin.mount(host, { get, set }):
 *   get()   returns the saved edits, { beatId: [lines] }
 *   set(v)  hands back the new edits and marks the panel as having unsaved changes (its own Save button stores them)
 * Everything shown here is built from window.WizStory (wizard-story.js), so a beat added to the game appears here by itself. */
(function () {
  "use strict";
  var CSS = [
    ".wsa{--wsa-line:rgba(127,127,127,.28);display:grid;gap:18px;max-width:980px}",
    ".wsa *{box-sizing:border-box}",
    ".wsa-intro{padding:14px 16px;border:1px solid var(--wsa-line);border-radius:12px;line-height:1.55}",
    ".wsa-intro h2{margin:0 0 6px;font-size:1.25rem}",
    ".wsa-intro ul{margin:8px 0 0;padding-left:1.2em}",
    ".wsa-intro code,.wsa-tok{font-family:ui-monospace,Menlo,Consolas,monospace;padding:.05em .4em;border-radius:5px;border:1px solid var(--wsa-line)}",
    ".wsa-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
    ".wsa-bar input{flex:1 1 220px;min-width:0;padding:9px 12px;border-radius:9px;border:1px solid var(--wsa-line);background:transparent;color:inherit;font:inherit}",
    ".wsa-btn{padding:8px 12px;border-radius:9px;border:1px solid var(--wsa-line);background:transparent;color:inherit;font:inherit;cursor:pointer}",
    ".wsa-btn:hover{border-color:currentColor}",
    ".wsa-btn[disabled]{opacity:.45;cursor:default}",
    ".wsa-count{font-size:.9rem;opacity:.8}",
    ".wsa-group>h3{margin:6px 0 2px;font-size:1.15rem}",
    ".wsa-group>p{margin:0 0 10px;opacity:.8}",
    ".wsa-beat{border:1px solid var(--wsa-line);border-radius:12px;padding:14px 16px;margin:0 0 12px}",
    ".wsa-beat.is-edited{border-color:#e8c15a;box-shadow:inset 4px 0 0 #e8c15a}",
    ".wsa-beat.is-bad{border-color:#ff6b7c;box-shadow:inset 4px 0 0 #ff6b7c}",
    ".wsa-head{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline;justify-content:space-between}",
    ".wsa-head h4{margin:0;font-size:1.05rem}",
    ".wsa-tag{font-size:.75rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:.15em .55em;border-radius:6px;border:1px solid var(--wsa-line)}",
    ".wsa-beat.is-edited .wsa-tag{background:#e8c15a;color:#2a1a0e;border-color:#e8c15a}",
    ".wsa-facts{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 12px;margin:10px 0;font-size:.92rem;line-height:1.45}",
    ".wsa-facts dt{font-weight:700;white-space:nowrap}",
    ".wsa-facts dd{margin:0}",
    ".wsa-beat textarea{width:100%;min-height:92px;resize:vertical;padding:10px 12px;border-radius:9px;border:1px solid var(--wsa-line);background:rgba(127,127,127,.08);color:inherit;font:inherit;line-height:1.5}",
    ".wsa-beat textarea:focus{outline:2px solid #e8c15a;outline-offset:1px}",
    ".wsa-foot{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between;margin-top:8px;font-size:.88rem}",
    ".wsa-warn{color:#ff9aa5;font-weight:600}",
    ".wsa-prev{margin:10px 0 0;padding:0;list-style:none;display:grid;gap:6px}",
    ".wsa-prev li{padding:8px 12px;border-radius:9px;line-height:1.45}",
    ".wsa-prev.is-panel li{background:#efe0b4;color:#2a1a0e;border:1px solid #8a6a3a;font-family:Georgia,'Palatino Linotype',serif}",
    ".wsa-prev.is-bubble li{background:#fffdf5;color:#1c1a22;border-radius:14px;justify-self:start;font-weight:600}",
    ".wsa-prev.is-sub li{border:1px dashed var(--wsa-line);font-style:italic}",
    ".wsa-prev li.is-long{outline:2px solid #ff6b7c}",
    ".wsa-none{opacity:.7}",
    "@media (max-width:560px){.wsa-facts{grid-template-columns:1fr}.wsa-facts dt{margin-top:4px}}"
  ].join("\n");

  function el(tag, attrs) {
    var n = document.createElement(tag), i, k;
    if (attrs) for (k in attrs) { if (k === "text") n.textContent = attrs[k]; else if (k === "class") n.className = attrs[k]; else n.setAttribute(k, attrs[k]); }
    for (i = 2; i < arguments.length; i++) if (arguments[i]) n.appendChild(typeof arguments[i] === "string" ? document.createTextNode(arguments[i]) : arguments[i]);
    return n;
  }
  function same(a, b) { if (a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
  function kindOf(b) { return /panel/i.test(b.how) ? "panel" : /bubble/i.test(b.how) ? "bubble" : "sub"; }
  var LIMIT = { panel: 320, bubble: 60, sub: 150 };

  function mount(host, api) {
    var WS = window.WizStory;
    host.textContent = "";
    if (!WS) { host.appendChild(el("p", { text: "Could not load the story list for Wizard of the Sprint." })); return; }
    if (!document.getElementById("wsa-css")) { var st = el("style", { id: "wsa-css" }); st.textContent = CSS; document.head.appendChild(st); }
    var edits = {}, saved = api.get() || {}, k;
    for (k in saved) { var c = WS.clean(saved[k]); if (c && c.length) edits[k] = c; }
    var root = el("div", { class: "wsa" }), cards = [], count = el("span", { class: "wsa-count" });

    function push() {
      var out = {}, n = 0;
      WS.beats.forEach(function (b) { if (edits[b.id] && !same(edits[b.id], b.lines)) { out[b.id] = edits[b.id]; n++; } });
      api.set(out);
      count.textContent = n ? n + " of " + WS.beats.length + " beats changed from the built-in text" : "All " + WS.beats.length + " beats use the built-in text";
    }

    root.appendChild(el("div", { class: "wsa-intro" },
      el("h2", { text: "Wizard of the Sprint: story and dialogue" }),
      el("p", { text: "Every piece of story text in the game is listed below as a beat. Each beat says when it plays and how it is shown, then gives you a box to write in." }),
      el("ul", {},
        el("li", { text: "One line in the box is one panel or one speech bubble. Press Enter to start the next one." }),
        el("li", {}, "Type ", el("span", { class: "wsa-tok", text: "{Name}" }), " anywhere and the game puts the player's wizard name there."),
        el("li", { text: "A box left empty goes back to the built-in text, so nothing can end up blank in the game." }),
        el("li", { text: "Press the control panel's Save button when you are done. The game picks the new text up within about five minutes (straight away on this browser)." }),
        el("li", { text: "Saved text is stored with the site's public settings, so treat it as visible to anyone who goes looking." }))));

    var find = el("input", { type: "search", placeholder: "Find a beat or a line…", "aria-label": "Find a beat or a line" });
    var resetAll = el("button", { type: "button", class: "wsa-btn", text: "Reset every beat" });
    root.appendChild(el("div", { class: "wsa-bar" }, find, resetAll, count));

    WS.groups.forEach(function (g) {
      var sec = el("section", { class: "wsa-group" }, el("h3", { text: g.title }), el("p", { text: g.note }));
      g.beats.forEach(function (b) {
        var kind = kindOf(b), lim = LIMIT[kind];
        var ta = el("textarea", { spellcheck: "true", "aria-label": b.title + " lines", rows: String(Math.min(12, Math.max(3, b.lines.length + 1))) });
        var tag = el("span", { class: "wsa-tag" }), info = el("span"), warn = el("span", { class: "wsa-warn" });
        var prev = el("ul", { class: "wsa-prev is-" + kind, "aria-label": "Preview" });
        var reset = el("button", { type: "button", class: "wsa-btn", text: "Reset to built-in text" });
        var card = el("article", { class: "wsa-beat" },
          el("div", { class: "wsa-head" }, el("h4", { text: b.title }), tag),
          el("dl", { class: "wsa-facts" },
            el("dt", { text: "When it plays" }), el("dd", { text: b.when }),
            el("dt", { text: "How it shows" }), el("dd", { text: b.how }),
            b.tip ? el("dt", { text: "Keep in mind" }) : null, b.tip ? el("dd", { text: b.tip }) : null),
          ta, el("div", { class: "wsa-foot" }, el("span", {}, info, " ", warn), reset), prev);
        function paint() {
          var cur = edits[b.id] || b.lines, edited = !!edits[b.id] && !same(edits[b.id], b.lines), long = 0;
          prev.textContent = "";
          (kind === "sub" ? cur.slice(0, 1) : cur).forEach(function (s, i) {
            var li = el("li", { text: (kind === "panel" ? (i + 1) + ".  " : "") + s.replace(/\{Name\}/g, "Bartholomew") });
            if (s.length > lim) { li.className = "is-long"; long++; }
            prev.appendChild(li);
          });
          card.className = "wsa-beat" + (edited ? " is-edited" : "") + (long ? " is-bad" : "");
          tag.textContent = edited ? "Your text" : "Built-in text";
          info.textContent = cur.length + (kind === "panel" ? (cur.length === 1 ? " panel" : " panels") : kind === "bubble" ? (cur.length === 1 ? " line in the pool" : " lines in the pool") : " line") + ".";
          warn.textContent = long ? long + (long === 1 ? " line is" : " lines are") + " over " + lim + " characters and may not fit." : (kind === "sub" && cur.length > 1 ? "Only the first line is used here." : "");
          reset.disabled = !edits[b.id];
        }
        function read() { var c = WS.clean(ta.value.split("\n")); if (c && c.length) edits[b.id] = c; else delete edits[b.id]; paint(); push(); }
        ta.value = (edits[b.id] || b.lines).join("\n");
        ta.addEventListener("input", read);
        ta.addEventListener("blur", function () { ta.value = (edits[b.id] || b.lines).join("\n"); });
        reset.addEventListener("click", function () { delete edits[b.id]; ta.value = b.lines.join("\n"); paint(); push(); });
        paint();
        cards.push({ b: b, card: card, sec: sec, ta: ta, paint: paint });
        sec.appendChild(card);
      });
      root.appendChild(sec);
    });
    var none = el("p", { class: "wsa-none", text: "Nothing matches that search.", hidden: "" });
    root.appendChild(none);

    find.addEventListener("input", function () {
      var q = find.value.trim().toLowerCase(), shown = 0, secs = [];
      cards.forEach(function (c) {
        var hit = !q || (c.b.title + " " + c.b.when + " " + c.b.id + " " + c.ta.value).toLowerCase().indexOf(q) >= 0;
        c.card.hidden = !hit; if (hit) { shown++; if (secs.indexOf(c.sec) < 0) secs.push(c.sec); }
      });
      cards.forEach(function (c) { c.sec.hidden = secs.indexOf(c.sec) < 0; });
      none.hidden = shown > 0;
    });
    var armed = 0;
    resetAll.addEventListener("click", function () {
      if (Date.now() - armed > 4000) { armed = Date.now(); resetAll.textContent = "Click again to reset every beat"; setTimeout(function () { resetAll.textContent = "Reset every beat"; }, 4000); return; }
      armed = 0; resetAll.textContent = "Reset every beat"; edits = {};
      cards.forEach(function (c) { c.ta.value = c.b.lines.join("\n"); c.paint(); }); push();
    });
    host.appendChild(root);
    count.textContent = (function () { var n = 0; WS.beats.forEach(function (b) { if (edits[b.id] && !same(edits[b.id], b.lines)) n++; }); return n ? n + " of " + WS.beats.length + " beats changed from the built-in text" : "All " + WS.beats.length + " beats use the built-in text"; })();
  }
  window.WizStoryAdmin = { mount: mount };
})();
