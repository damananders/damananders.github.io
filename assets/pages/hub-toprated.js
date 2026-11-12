/* Hub: "Top rated on Rate-O-Pedia" — a row of the best-scored games, right under the Rate-O-Pedia strip.
 * Self-contained (its own small stylesheet, no edits to hub.css / hub.js): it reads the public game_scores view
 * from Supabase with the same publishable key the games page uses, and stays hidden until something is rated.
 * Each card opens the games page searched for that title. Prefix hbt-.
 */
(function () {
  "use strict";
  var SB_URL = "https://zjhlhkruqzfendvbglsb.supabase.co";
  var SB_KEY = "sb_publishable_j-EgPXB3ZvKuz_3h8dZaNA_aLgmcQrk";   // publishable: meant to be public
  var anchor = document.querySelector("a.hb-rate");
  if (!anchor || !anchor.parentNode || !window.fetch) return;

  var CSS =
    ".hbt{margin:14px auto 0;max-width:var(--hb-max,1080px);width:100%}" +
    ".hbt__head{display:flex;align-items:center;gap:10px;margin:0 2px 8px}" +
    ".hbt__h{margin:0;font:600 1rem var(--sx-display,var(--display,system-ui));color:var(--sx-text,#e8e8ea);letter-spacing:.01em}" +
    ".hbt__all{margin-left:auto;font-size:.88rem;color:var(--sx-accent,#3d8bff);text-decoration:none}" +
    ".hbt__all:hover{text-decoration:underline}" +
    ".hbt__nav{display:flex;gap:6px}" +
    ".hbt__btn{-webkit-appearance:none;appearance:none;cursor:pointer;width:32px;height:32px;border-radius:50%;border:1px solid var(--sx-line-2,rgba(255,255,255,.18));" +
      "background:var(--sx-glass,rgba(10,14,22,.55));color:var(--sx-text,#e8e8ea);font-size:1.1rem;line-height:1;display:grid;place-items:center}" +
    ".hbt__btn:hover{border-color:var(--sx-accent,#3d8bff)}" +
    ".hbt__btn:focus-visible,.hbt__card:focus-visible{outline:2px solid var(--sx-accent,#3d8bff);outline-offset:2px}" +
    ".hbt__row{list-style:none;margin:0;padding:2px 2px 8px;display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none}" +
    ".hbt__row::-webkit-scrollbar{display:none}" +
    ".hbt__row>li{flex:0 0 auto;scroll-snap-align:start}" +
    ".hbt__card{display:grid;grid-template-rows:auto 1fr auto;gap:6px;width:190px;min-height:118px;padding:12px 14px;border-radius:14px;text-decoration:none;" +
      "border:1px solid var(--sx-line,rgba(255,255,255,.1));background:var(--sx-glass,rgba(10,14,22,.55));-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);" +
      "color:var(--sx-text,#e8e8ea);transition:transform .15s,border-color .15s}" +
    ".hbt__card:hover{transform:translateY(-2px);border-color:var(--sx-accent,#3d8bff)}" +
    ".hbt__top{display:flex;align-items:center;gap:8px}" +
    ".hbt__rank{font:700 .78rem var(--sx-mono,ui-monospace,monospace);color:var(--sx-muted,#a8abb3)}" +
    ".hbt__c{font:600 .7rem var(--sx-mono,ui-monospace,monospace);letter-spacing:.05em;padding:1px 6px;border:1px solid currentColor;border-radius:6px}" +
    ".hbt__c[data-c=PS1]{color:#9aa6b4}.hbt__c[data-c=PS2]{color:#3f83ff}.hbt__c[data-c=PSP]{color:#1ec5b3}.hbt__c[data-c=PS3]{color:#f0a93b}" +
    ".hbt__c[data-c=Vita]{color:#c069ff}.hbt__c[data-c=PS4]{color:#6c7bff}.hbt__c[data-c=PS5]{color:#ff6076}" +
    ".hbt__t{font:600 .95rem var(--sx-display,var(--display,system-ui));line-height:1.25;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}" +
    ".hbt__s{display:flex;align-items:baseline;gap:8px;font-size:.82rem;color:var(--sx-muted,#a8abb3)}" +
    ".hbt__s b{font:700 1.05rem var(--sx-mono,ui-monospace,monospace);color:var(--sx-text,#e8e8ea)}" +
    ".hbt__bar{height:4px;border-radius:2px;background:var(--sx-line,rgba(255,255,255,.12));overflow:hidden}" +
    ".hbt__bar>i{display:block;height:100%;background:var(--sx-accent,#3d8bff)}" +
    "@media (prefers-reduced-motion:reduce){.hbt__card{transition:none}.hbt__card:hover{transform:none}}";

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  function render(rows) {
    if (!Array.isArray(rows) || !rows.length) return;
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);

    var sec = el("section", "hbt"); sec.setAttribute("aria-label", "Top rated on Rate-O-Pedia");
    var head = el("div", "hbt__head");
    head.appendChild(el("h2", "hbt__h", "Top rated on Rate-O-Pedia"));
    var all = el("a", "hbt__all", "All games →"); all.href = "games/"; head.appendChild(all);
    var nav = el("div", "hbt__nav");
    var prev = el("button", "hbt__btn", "‹"), next = el("button", "hbt__btn", "›");
    prev.type = next.type = "button"; prev.setAttribute("aria-label", "Scroll left"); next.setAttribute("aria-label", "Scroll right");
    nav.appendChild(prev); nav.appendChild(next); head.appendChild(nav);

    var row = el("ol", "hbt__row");
    rows.forEach(function (g, i) {
      if (!g || !g.title) return;
      var avg = Math.max(0, Math.min(5, Number(g.average) || 0)), votes = Number(g.votes) || 0;
      var li = el("li"), a = el("a", "hbt__card");
      a.href = "games/?q=" + encodeURIComponent(String(g.title).slice(0, 80));
      a.setAttribute("aria-label", g.title + ", " + String(g.console || "") + ", " + avg.toFixed(1) + " out of 5 from " + votes + (votes === 1 ? " vote" : " votes"));
      var top = el("div", "hbt__top");
      top.appendChild(el("span", "hbt__rank", "#" + (i + 1)));
      var c = el("span", "hbt__c", String(g.console || "")); c.setAttribute("data-c", String(g.console || "")); top.appendChild(c);
      a.appendChild(top);
      a.appendChild(el("span", "hbt__t", String(g.title)));
      var bottom = el("div");
      var s = el("div", "hbt__s"); s.appendChild(el("b", null, avg.toFixed(1))); s.appendChild(document.createTextNode("/ 5 · " + votes + (votes === 1 ? " vote" : " votes")));
      var bar = el("div", "hbt__bar"), fill = el("i"); fill.style.width = (avg / 5 * 100) + "%"; bar.appendChild(fill);
      bottom.appendChild(s); bottom.appendChild(bar); a.appendChild(bottom);
      li.appendChild(a); row.appendChild(li);
    });
    if (!row.children.length) return;

    function step(dir) {
      var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
      row.scrollBy({ left: dir * Math.max(200, row.clientWidth * 0.8), behavior: reduce ? "auto" : "smooth" });
    }
    prev.addEventListener("click", function () { step(-1); });
    next.addEventListener("click", function () { step(1); });
    function arrows() { var none = row.scrollWidth <= row.clientWidth + 4; nav.hidden = none; prev.disabled = row.scrollLeft <= 2; next.disabled = row.scrollLeft + row.clientWidth >= row.scrollWidth - 2; }
    row.addEventListener("scroll", arrows, { passive: true });
    window.addEventListener("resize", arrows);

    sec.appendChild(head); sec.appendChild(row);
    anchor.parentNode.insertBefore(sec, anchor.nextSibling);
    arrows();
  }

  fetch(SB_URL + "/rest/v1/game_scores?select=id,console,title,votes,average&votes=gt.0&order=average.desc,votes.desc&limit=12",
    { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(render)
    .catch(function () { /* offline or blocked: the hub simply doesn't show the row */ });
})();
