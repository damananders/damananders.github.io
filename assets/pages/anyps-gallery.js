/* AnyPS page: a screenshot carousel. Inserts a "Screenshots" section (a horizontal filmstrip of the app's
 * shots with captions) after the hero, and a full-screen lightbox with prev/next on click or arrow keys.
 * Self-contained: injects its own CSS, uses the shots already in /assets/shots/. The page's document-level
 * arrow-key handler already leaves "#gallery" and dialogs alone, so this gets Left/Right for free. Prefix apg-.
 */
(function () {
  "use strict";
  if (!window.Site || window.Site.page !== "anyps") return;
  var Site = window.Site, doc = document;
  function feat(n) { var f = (Site.config && Site.config.features) || {}; return f[n] !== false; }
  if (!feat("anypsGallery")) return;

  var SHOTS = [
    ["35_hub", "The home hub"],
    ["14_home", "Your whole library at a glance"],
    ["1_consoles", "Pick a console"],
    ["2_consoles_ps5", "Six generations, one launcher"],
    ["70_grid", "Grid view of your games"],
    ["37_ps1_lane_real", "PS1 lane"],
    ["41_ps2_lane_real", "PS2 lane"],
    ["42_psp_lane_real", "PSP lane"],
    ["43_ps3_lane_real", "PS3 lane"],
    ["31c_vita_lane", "PS Vita lane"],
    ["7_ps4", "PS4 games"],
    ["19_recent", "Jump back into recent games"],
    ["71_wizard", "Guided first-boot setup"],
    ["54_remap", "Remap your controller"],
    ["31d_vita_settings", "Per-system settings"],
    ["72_cheats", "Built-in cheats"],
    ["77_states", "Save states, any time"],
    ["87_smartlists", "Smart lists that sort themselves"],
    ["13_trophies", "Trophies"],
    ["44_profiles_select", "Up to 10 player profiles"],
    ["94_vault", "The save vault"],
    ["61_slideshow", "Screenshot slideshow"]
  ];

  var CSS =
    ".apg{margin-top:8px}" +
    ".apg__head{display:flex;align-items:center;gap:10px;margin:0 0 10px}" +
    ".apg__nav{display:flex;gap:6px;margin-left:auto}" +
    ".apg__btn{-webkit-appearance:none;appearance:none;cursor:pointer;width:34px;height:34px;border-radius:50%;" +
      "border:1px solid var(--sx-line-2,rgba(255,255,255,.18));background:var(--sx-glass,rgba(10,14,22,.55));color:var(--sx-text,#e8e8ea);" +
      "font-size:1.15rem;line-height:1;display:grid;place-items:center}" +
    ".apg__btn:hover{border-color:var(--sx-accent,#3d8bff)}" +
    ".apg__btn:disabled{opacity:.35;cursor:default}" +
    ".apg__btn:focus-visible,.apg__cell:focus-visible{outline:2px solid var(--sx-accent,#3d8bff);outline-offset:2px}" +
    ".apg__row{list-style:none;margin:0;padding:2px 2px 10px;display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none}" +
    ".apg__row::-webkit-scrollbar{display:none}" +
    ".apg__row>li{flex:0 0 auto;scroll-snap-align:start}" +
    ".apg__cell{display:block;width:300px;max-width:78vw;padding:0;border:1px solid var(--sx-line,rgba(255,255,255,.1));border-radius:14px;overflow:hidden;" +
      "background:var(--sx-glass,rgba(10,14,22,.55));cursor:zoom-in;transition:transform .15s,border-color .15s}" +
    ".apg__cell:hover{transform:translateY(-3px);border-color:var(--sx-accent,#3d8bff)}" +
    ".apg__cell img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:#0b0f16}" +
    ".apg__cap{display:block;padding:9px 12px;font:600 .86rem var(--sx-display,var(--display,system-ui));color:var(--sx-text,#e8e8ea);text-align:left}" +
    ".apg__lb{border:0;padding:0;max-width:min(1200px,94vw);max-height:92vh;width:auto;background:transparent;overflow:visible}" +
    ".apg__lb::backdrop{background:rgba(5,7,12,.86);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}" +
    ".apg__lbin{position:relative;display:flex;flex-direction:column;gap:10px;align-items:center}" +
    ".apg__lbin img{max-width:94vw;max-height:80vh;width:auto;height:auto;border-radius:12px;box-shadow:0 30px 80px -20px rgba(0,0,0,.8)}" +
    ".apg__lbcap{color:#e8e8ea;font:600 1rem var(--sx-display,system-ui);text-align:center}" +
    ".apg__lbx{position:absolute;top:-14px;right:-14px;width:40px;height:40px;border-radius:50%;cursor:pointer;border:1px solid rgba(255,255,255,.3);" +
      "background:rgba(10,14,22,.9);color:#fff;font-size:1.4rem;line-height:1;display:grid;place-items:center}" +
    ".apg__lbp,.apg__lbn{position:absolute;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;cursor:pointer;" +
      "border:1px solid rgba(255,255,255,.3);background:rgba(10,14,22,.85);color:#fff;font-size:1.5rem;line-height:1;display:grid;place-items:center}" +
    ".apg__lbp{left:-10px}.apg__lbn{right:-10px}" +
    ".apg__lbx:hover,.apg__lbp:hover,.apg__lbn:hover{border-color:var(--sx-accent,#3d8bff)}" +
    ".apg__lbx:focus-visible,.apg__lbp:focus-visible,.apg__lbn:focus-visible{outline:2px solid var(--sx-accent,#3d8bff);outline-offset:2px}" +
    "@media (prefers-reduced-motion:reduce){.apg__cell{transition:none}.apg__cell:hover{transform:none}}" +
    "@media (max-width:560px){.apg__lbp{left:2px}.apg__lbn{right:2px}}";

  function el(tag, cls, text) { var n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function src(id) { return "/assets/shots/" + id + ".webp"; }

  Site.ready(function () {
    var st = doc.createElement("style"); st.textContent = CSS; doc.head.appendChild(st);

    /* ---- lightbox ---- */
    var lb = doc.createElement("dialog"); lb.className = "apg__lb"; lb.id = "gallery-lb";
    var lbImg = el("img"); lbImg.alt = "";
    var lbCap = el("div", "apg__lbcap");
    var lbx = el("button", "apg__lbx"); lbx.type = "button"; lbx.setAttribute("aria-label", "Close"); lbx.innerHTML = "&times;";
    var lbp = el("button", "apg__lbp"); lbp.type = "button"; lbp.setAttribute("aria-label", "Previous"); lbp.innerHTML = "&#8249;";
    var lbn = el("button", "apg__lbn"); lbn.type = "button"; lbn.setAttribute("aria-label", "Next"); lbn.innerHTML = "&#8250;";
    var lbin = el("div", "apg__lbin"); lbin.appendChild(lbp); lbin.appendChild(lbImg); lbin.appendChild(lbn); lbin.appendChild(lbCap); lbin.appendChild(lbx);
    lb.appendChild(lbin); doc.body.appendChild(lb);
    var at = 0;
    function show(i) { at = (i + SHOTS.length) % SHOTS.length; lbImg.src = src(SHOTS[at][0]); lbImg.alt = SHOTS[at][1]; lbCap.textContent = SHOTS[at][1]; }
    function open(i) { show(i); try { if (!lb.open) lb.showModal(); } catch (e) {} try { Site.sfx("open"); } catch (e) {} }
    lbx.addEventListener("click", function () { lb.close(); });
    lbp.addEventListener("click", function () { show(at - 1); });
    lbn.addEventListener("click", function () { show(at + 1); });
    lb.addEventListener("click", function (e) { if (e.target === lb) lb.close(); });   /* click the backdrop */
    lb.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); show(at - 1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); show(at + 1); }
    });

    /* ---- filmstrip section ---- */
    var sec = el("section", "sec apg"); sec.id = "gallery"; sec.setAttribute("aria-label", "Screenshots");
    var head = el("div", "apg__head"); head.appendChild(el("h2", null, "Screenshots"));
    var nav = el("div", "apg__nav");
    var prev = el("button", "apg__btn", "‹"), next = el("button", "apg__btn", "›");
    prev.type = next.type = "button"; prev.setAttribute("aria-label", "Scroll left"); next.setAttribute("aria-label", "Scroll right");
    nav.appendChild(prev); nav.appendChild(next); head.appendChild(nav);
    var row = el("ul", "apg__row");
    SHOTS.forEach(function (s, i) {
      var cell = el("button", "apg__cell"); cell.type = "button"; cell.setAttribute("aria-label", "View screenshot: " + s[1]);
      var img = el("img"); img.src = src(s[0]); img.alt = s[1]; img.loading = "lazy"; img.decoding = "async";
      cell.appendChild(img); cell.appendChild(el("span", "apg__cap", s[1]));
      cell.addEventListener("click", function () { open(i); });
      var li = doc.createElement("li"); li.appendChild(cell); row.appendChild(li);
    });
    sec.appendChild(head); sec.appendChild(row);

    function step(dir) {
      var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
      row.scrollBy({ left: dir * Math.max(240, row.clientWidth * 0.8), behavior: reduce ? "auto" : "smooth" });
    }
    prev.addEventListener("click", function () { step(-1); });
    next.addEventListener("click", function () { step(1); });
    function arrows() { prev.disabled = row.scrollLeft <= 2; next.disabled = row.scrollLeft + row.clientWidth >= row.scrollWidth - 2; }
    row.addEventListener("scroll", arrows, { passive: true });
    window.addEventListener("resize", arrows);

    /* place it right after the hero (.split), else before the first content section */
    var anchor = doc.querySelector(".split");
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(sec, anchor.nextSibling);
    else { var first = doc.querySelector("section.sec"); if (first && first.parentNode) first.parentNode.insertBefore(sec, first); else return; }
    if (Site.reveal) Site.reveal(sec);
    arrows();
  }, "anyps gallery");
})();
