/* arcade/wizard-story-admin.js — the control panel's "Wizard Story" page. Prefix wsa-.
 * The control panel calls WizStoryAdmin.mount(host, { get, set }):
 *   get()   returns the saved edits, { beatId: [lines] }
 *   set(v)  hands back the new edits and marks the panel as having unsaved changes (its own Save button stores them)
 * Everything shown here is built from window.WizStory (wizard-story.js), so a beat added to the game appears here by itself. */
(function () {
  "use strict";
  var CSS = [
    ".wsa{--wsa-line:var(--line-2,rgba(127,127,127,.26));--wsa-soft:var(--panel-2,rgba(127,127,127,.09));--wsa-gold:var(--accent,#e8c15a);display:grid;gap:14px;max-width:1040px}",
    ".wsa *{box-sizing:border-box}",
    ".wsa-top{display:flex;flex-wrap:wrap;gap:6px 16px;align-items:baseline;justify-content:space-between}",
    ".wsa-top h2{margin:0;font-size:1.2rem}",
    ".wsa-help{font-size:.9rem}",
    ".wsa-help summary{cursor:pointer;opacity:.8}",
    ".wsa-help ul{margin:8px 0 0;padding:10px 14px 10px 30px;border:1px solid var(--wsa-line);border-radius:10px;line-height:1.5;display:grid;gap:2px}",
    ".wsa-tok{font-family:ui-monospace,Menlo,Consolas,monospace;padding:.05em .4em;border-radius:5px;border:1px solid var(--wsa-line)}",
    ".wsa-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
    ".wsa-bar input{flex:1 1 200px;min-width:0;padding:8px 12px;border-radius:9px;border:1px solid var(--wsa-line);background:transparent;color:inherit;font:inherit}",
    ".wsa-btn{padding:7px 11px;border-radius:9px;border:1px solid var(--wsa-line);background:transparent;color:inherit;font:inherit;font-size:.88rem;cursor:pointer;white-space:nowrap}",
    ".wsa-btn:hover{border-color:currentColor}",
    ".wsa-btn[disabled]{opacity:.4;cursor:default}",
    ".wsa-btn[aria-pressed=true]{background:var(--wsa-gold);border-color:var(--wsa-gold);color:var(--sx-on-accent,#2a1a0e);font-weight:700}",
    ".wsa-count{font-size:.85rem;opacity:.75;flex:1 0 100%}",
    ".wsa-group{display:grid;gap:6px}",
    ".wsa-ghead{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline;margin-top:8px;padding-bottom:6px;border-bottom:1px solid var(--wsa-line)}",
    ".wsa-ghead h3{margin:0;font-size:.82rem;letter-spacing:.09em;text-transform:uppercase}",
    ".wsa-ghead p{margin:0;font-size:.85rem;opacity:.65}",
    ".wsa-beat{border:1px solid var(--wsa-line);border-radius:10px;overflow:hidden}",
    ".wsa-beat[open]{background:var(--wsa-soft)}",
    ".wsa-beat.is-edited{box-shadow:inset 3px 0 0 var(--wsa-gold)}",
    ".wsa-beat.is-bad{box-shadow:inset 3px 0 0 #ff6b7c}",
    ".wsa-beat>summary{display:grid;grid-template-columns:auto minmax(0,auto) auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 12px;cursor:pointer;list-style:none}",
    ".wsa-beat>summary::-webkit-details-marker{display:none}",
    ".wsa-beat>summary:hover{background:var(--wsa-soft)}",
    ".wsa-chev{width:.55em;height:.55em;border-right:2px solid;border-bottom:2px solid;transform:rotate(-45deg);opacity:.6;transition:transform .12s}",
    ".wsa-beat[open] .wsa-chev{transform:rotate(45deg)}",
    ".wsa-name{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".wsa-kind{font-size:.68rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:.2em .55em;border-radius:99px;border:1px solid var(--wsa-line);white-space:nowrap}",
    ".wsa-kind.is-panel{background:#efe0b4;color:#2a1a0e;border-color:#efe0b4}",
    ".wsa-kind.is-bubble{background:#fffdf5;color:#1c1a22;border-color:#fffdf5}",
    ".wsa-snip{font-size:.88rem;opacity:.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-style:italic}",
    ".wsa-state{font-size:.78rem;opacity:.7;white-space:nowrap}",
    ".wsa-beat.is-edited .wsa-state{opacity:1;color:var(--wsa-gold);font-weight:700}",
    ".wsa-beat.is-bad .wsa-state{opacity:1;color:#ff9aa5;font-weight:700}",
    ".wsa-body{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:14px;padding:4px 12px 12px}",
    ".wsa-edit{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;align-content:start;min-width:0}",
    ".wsa-beat textarea{width:100%;min-height:76px;resize:vertical;padding:9px 11px;border-radius:9px;border:1px solid var(--wsa-line);background:rgba(0,0,0,.18);color:inherit;font:inherit;line-height:1.5}",
    ".wsa-beat textarea:focus{outline:2px solid var(--wsa-gold);outline-offset:1px}",
    ".wsa-foot{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;justify-content:space-between;font-size:.84rem}",
    ".wsa-foot>span{opacity:.75}",
    ".wsa-warn{color:#ff9aa5;font-weight:600}",
    ".wsa-side{display:grid;gap:10px;align-content:start;font-size:.86rem;line-height:1.45;min-width:0}",
    ".wsa-side h5{margin:0 0 2px;font-size:.68rem;letter-spacing:.09em;text-transform:uppercase;opacity:.6}",
    ".wsa-side p{margin:0}",
    ".wsa-prev{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:minmax(0,1fr);gap:5px}",
    ".wsa-prev:empty{display:none}",
    ".wsa-prev li{overflow-wrap:anywhere;padding:7px 11px;border-radius:8px;line-height:1.45;font-size:.92rem}",
    ".wsa-prev.is-panel li{background:#efe0b4;color:#2a1a0e;border:1px solid #8a6a3a;font-family:Georgia,'Palatino Linotype',serif}",
    ".wsa-prev.is-bubble li{background:#fffdf5;color:#1c1a22;border-radius:14px;justify-self:start;font-weight:600}",
    ".wsa-prev.is-sub li{border:1px dashed var(--wsa-line);font-style:italic}",
    ".wsa-prev li.is-long{outline:2px solid #ff6b7c}",
    ".wsa-none{opacity:.7}",
    "@media (max-width:760px){.wsa-body{grid-template-columns:1fr}.wsa-beat>summary{grid-template-columns:auto minmax(0,1fr) auto}.wsa-snip,.wsa-kind{display:none}}"
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
  var KIND = { panel: "Story panel", bubble: "Speech bubble", sub: "Menu text" };
  var HOW = { panel: "One line = one panel, shown in order.", bubble: "One line = one bubble. The game picks one at random.", sub: "A single line. Only the first line is used." };

  function mount(host, api) {
    var WS = window.WizStory;
    host.textContent = "";
    if (!WS) { host.appendChild(el("p", { text: "Could not load the story list for Wizard of the Sprint." })); return; }
    if (!document.getElementById("wsa-css")) { var st = el("style", { id: "wsa-css" }); st.textContent = CSS; document.head.appendChild(st); }
    var unseal = WS.open || function (o) { return o || {}; }, seal = WS.seal || function (o) { return o; };   /* an older cached story file has neither */
    var edits = {}, saved = unseal(api.get() || {}), k;
    for (k in saved) { var c = WS.clean(saved[k]); if (c && c.length) edits[k] = c; }
    var root = el("div", { class: "wsa" }), cards = [], count = el("span", { class: "wsa-count" });

    function tally() {
      var out = {}, n = 0;
      WS.beats.forEach(function (b) { if (edits[b.id] && !same(edits[b.id], b.lines)) { out[b.id] = edits[b.id]; n++; } });
      count.textContent = n ? n + " of " + WS.beats.length + " beats use your text" : "All " + WS.beats.length + " beats use the built-in text";
      return out;
    }
    function push() { api.set(seal(tally())); }      /* stored scrambled, so the saved settings are not readable at a glance */

    root.appendChild(el("div", { class: "wsa-top" },
      el("h2", { text: "Wizard of the Sprint story" }),
      el("details", { class: "wsa-help" }, el("summary", { text: "How this works" }),
        el("ul", {},
          el("li", { text: "Click a beat to open it. One line in the box is one panel or one bubble." }),
          el("li", {}, "Type ", el("span", { class: "wsa-tok", text: "{Name}" }), " and the game puts the wizard's name there."),
          el("li", { text: "Empty the box to go back to the built-in text." }),
          el("li", { text: "Press the control panel's Save when done. The game picks it up within about five minutes." }),
          el("li", { text: "Saved text is stored scrambled, not locked." })))));

    var find = el("input", { type: "search", placeholder: "Find a beat or a line…", "aria-label": "Find a beat or a line" });
    var mine = el("button", { type: "button", class: "wsa-btn", "aria-pressed": "false", text: "My edits only" });
    var openAll = el("button", { type: "button", class: "wsa-btn", text: "Open all" });
    var resetAll = el("button", { type: "button", class: "wsa-btn", text: "Reset every beat" });
    root.appendChild(el("div", { class: "wsa-bar" }, find, mine, openAll, resetAll, count));

    WS.groups.forEach(function (g) {
      var sec = el("section", { class: "wsa-group" }, el("div", { class: "wsa-ghead" }, el("h3", { text: g.title }), el("p", { text: g.note })));
      g.beats.forEach(function (b) {
        var kind = kindOf(b), lim = LIMIT[kind];
        var ta = el("textarea", { spellcheck: "true", "aria-label": b.title + " lines", rows: String(kind === "panel" ? 10 : Math.min(12, Math.max(2, b.lines.length + 1))) });
        var snip = el("span", { class: "wsa-snip" }), state = el("span", { class: "wsa-state" }), info = el("span"), warn = el("span", { class: "wsa-warn" });
        var prev = el("ul", { class: "wsa-prev is-" + kind, "aria-label": "Preview" });
        var reset = el("button", { type: "button", class: "wsa-btn", text: "Reset" });
        var card = el("details", { class: "wsa-beat" },
          el("summary", {}, el("span", { class: "wsa-chev" }), el("span", { class: "wsa-name", text: b.title }), el("span", { class: "wsa-kind is-" + kind, text: KIND[kind] }), snip, state),
          el("div", { class: "wsa-body" },
            el("div", { class: "wsa-edit" }, ta, el("div", { class: "wsa-foot" }, el("span", {}, info, " ", warn), reset), prev),
            el("div", { class: "wsa-side" },
              el("div", {}, el("h5", { text: "When it plays" }), el("p", { text: b.when })),
              el("div", {}, el("h5", { text: "How it shows" }), el("p", { text: HOW[kind] })),
              b.tip ? el("div", {}, el("h5", { text: "Keep in mind" }), el("p", { text: b.tip })) : null)));
        function paint() {
          var cur = edits[b.id] || b.lines, edited = !!edits[b.id] && !same(edits[b.id], b.lines), long = 0;
          prev.textContent = "";
          /* panels and menu text get a full preview; a bubble pool only lists the lines that are too long */
          (kind === "sub" ? cur.slice(0, 1) : cur).forEach(function (s, i) {
            var over = s.length > lim; if (over) long++;
            if (kind === "bubble" && !over) return;
            var li = el("li", { text: (kind === "panel" ? (i + 1) + ".  " : "") + s.replace(/\{Name\}/g, "Bartholomew") });
            if (over) li.className = "is-long";
            prev.appendChild(li);
          });
          card.className = "wsa-beat" + (edited ? " is-edited" : "") + (long ? " is-bad" : "");
          card.wsaEdited = edited;
          snip.textContent = cur[0];
          var n = cur.length + (kind === "panel" ? (cur.length === 1 ? " panel" : " panels") : kind === "bubble" ? (cur.length === 1 ? " line" : " lines") : " line");
          state.textContent = long ? long + " too long" : edited ? "Edited · " + n : n;
          info.textContent = edited ? "Your text." : "Built-in text.";
          warn.textContent = long ? long + (long === 1 ? " line is" : " lines are") + " over " + lim + " characters and may not fit." : (kind === "sub" && cur.length > 1 ? "Only the first line is used here." : "");
          reset.disabled = !edits[b.id];
        }
        function read() { var c = WS.clean(ta.value.split("\n")); if (c && c.length) edits[b.id] = c; else delete edits[b.id]; paint(); push(); }
        ta.value = (edits[b.id] || b.lines).join("\n");
        ta.addEventListener("input", read);
        ta.addEventListener("blur", function () { ta.value = (edits[b.id] || b.lines).join("\n"); });
        reset.addEventListener("click", function () { delete edits[b.id]; ta.value = b.lines.join("\n"); paint(); push(); filter(); });
        paint();
        cards.push({ b: b, card: card, sec: sec, ta: ta, paint: paint });
        sec.appendChild(card);
      });
      root.appendChild(sec);
    });
    var none = el("p", { class: "wsa-none", text: "Nothing matches.", hidden: "" });
    root.appendChild(none);

    function filter() {
      var q = find.value.trim().toLowerCase(), only = mine.getAttribute("aria-pressed") === "true", shown = 0, secs = [];
      cards.forEach(function (c) {
        var hit = (!q || (c.b.title + " " + c.b.when + " " + c.b.id + " " + c.ta.value).toLowerCase().indexOf(q) >= 0) && (!only || c.card.wsaEdited);
        c.card.hidden = !hit; if (hit) { shown++; if (secs.indexOf(c.sec) < 0) secs.push(c.sec); }
      });
      cards.forEach(function (c) { c.sec.hidden = secs.indexOf(c.sec) < 0; });
      none.hidden = shown > 0;
    }
    find.addEventListener("input", filter);
    mine.addEventListener("click", function () { mine.setAttribute("aria-pressed", mine.getAttribute("aria-pressed") === "true" ? "false" : "true"); filter(); });
    function syncOpen() { openAll.textContent = cards.some(function (c) { return !c.card.open; }) ? "Open all" : "Close all"; }
    openAll.addEventListener("click", function () { var to = cards.some(function (c) { return !c.card.open; }); cards.forEach(function (c) { c.card.open = to; }); syncOpen(); });
    cards.forEach(function (c) { c.card.addEventListener("toggle", syncOpen); });
    var armed = 0;
    resetAll.addEventListener("click", function () {
      if (Date.now() - armed > 4000) { armed = Date.now(); resetAll.textContent = "Click again to reset all"; setTimeout(function () { resetAll.textContent = "Reset every beat"; }, 4000); return; }
      armed = 0; resetAll.textContent = "Reset every beat"; edits = {};
      cards.forEach(function (c) { c.ta.value = c.b.lines.join("\n"); c.paint(); }); push(); filter();
    });
    host.appendChild(root);
    tally();
  }
  window.WizStoryAdmin = { mount: mount };
})();
