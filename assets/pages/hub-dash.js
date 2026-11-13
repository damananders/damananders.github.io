/* Hub: "Right now" — a compact live band under the ticker. Three tiles, each shown only when it has data:
 *   • Twitch    "Live now" + uptime, while the channel is actually streaming (else hidden)
 *   • AndersCraft  players online across the realms (from the status endpoint; else hidden)
 *   • Rate-O-Pedia  this week's top-rated game (from the public week_top_rated view; hidden until the
 *                   round-15 Supabase SQL is run, so nothing breaks before then)
 * Self-contained: injects its own CSS, reads the same Site.live API the hub chips use plus the public
 * Supabase views the games page uses. The whole band stays hidden until at least one tile has content.
 * No edits to hub.js / hub.css. Prefix hbd-.
 */
(function () {
  "use strict";
  if (!window.Site) return;
  var Site = window.Site, el = Site.el, doc = document;
  function feat(n) { var f = (Site.config && Site.config.features) || {}; return f[n] !== false; }
  if (!feat("hubDash")) return;

  var SB_URL = "https://zjhlhkruqzfendvbglsb.supabase.co";
  var SB_KEY = "sb_publishable_j-EgPXB3ZvKuz_3h8dZaNA_aLgmcQrk";   /* publishable: meant to be public */

  var CSS =
    ".hbd{margin:14px auto 0;max-width:var(--hb-max,1080px);width:100%;display:flex;flex-wrap:wrap;gap:10px}" +
    ".hbd__tile{flex:1 1 220px;min-width:0;display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:14px;text-decoration:none;" +
      "border:1px solid var(--sx-line,rgba(255,255,255,.1));background:var(--sx-glass,rgba(10,14,22,.55));" +
      "-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:var(--sx-text,#e8e8ea);transition:transform .15s,border-color .15s}" +
    ".hbd__tile:hover{transform:translateY(-2px);border-color:var(--hbd-accent,var(--sx-accent,#3d8bff))}" +
    ".hbd__tile:focus-visible{outline:2px solid var(--hbd-accent,var(--sx-accent,#3d8bff));outline-offset:2px}" +
    ".hbd__ico{flex:none;width:34px;height:34px;display:grid;place-items:center;border-radius:10px;color:var(--hbd-accent,var(--sx-accent,#3d8bff));" +
      "background:color-mix(in srgb,var(--hbd-accent,#3d8bff) 16%,transparent)}" +
    ".hbd__ico svg{width:19px;height:19px}" +
    ".hbd__txt{display:grid;gap:1px;min-width:0}" +
    ".hbd__k{font:600 .68rem var(--sx-mono,ui-monospace,monospace);letter-spacing:.11em;text-transform:uppercase;color:var(--sx-muted,#a8abb3)}" +
    ".hbd__v{font:600 .98rem var(--sx-display,var(--display,system-ui));color:var(--sx-text,#e8e8ea);line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".hbd__sub{font-size:.82rem;color:var(--sx-muted,#a8abb3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".hbd__dot{flex:none;width:9px;height:9px;border-radius:50%;background:var(--hbd-accent,#3d8bff);box-shadow:0 0 0 4px color-mix(in srgb,var(--hbd-accent,#3d8bff) 22%,transparent)}" +
    ".hbd__tile--live{--hbd-accent:#ff4d6a}" +
    ":root:not([data-motion=reduce]) .hbd__tile--live .hbd__dot{animation:hbd-pulse 1.8s ease-in-out infinite}" +
    ".hbd__tile--craft{--hbd-accent:#ff7a1f}.hbd__tile--rop{--hbd-accent:#3d8bff}" +
    "@keyframes hbd-pulse{0%,100%{box-shadow:0 0 0 3px color-mix(in srgb,#ff4d6a 30%,transparent)}50%{box-shadow:0 0 0 7px color-mix(in srgb,#ff4d6a 6%,transparent)}}" +
    "@media (prefers-reduced-motion:reduce){.hbd__tile{transition:none}.hbd__tile:hover{transform:none}}";

  var TW = '<path d="M11.57 4.71h1.72v5.14h-1.72zm4.72 0H18v5.14h-1.71zM6 0 1.71 4.29v15.42h5.15V24l4.28-4.29h3.43L22.29 12V0zm14.57 11.14-3.43 3.43H13.7l-3 3v-3H6.86V1.71h13.71z" fill="currentColor"/>';
  var CRAFT = '<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/>';
  var STAR = '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>';

  var sec = null, added = 0;
  function ensure() {
    if (sec) return sec;
    var st = doc.createElement("style"); st.textContent = CSS; doc.head.appendChild(st);
    sec = el("section", { class: "hbd", "aria-label": "Right now" });
    var anchor = doc.getElementById("hb-ticker") || doc.querySelector(".hero");
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(sec, anchor.nextSibling);
    else { var main = doc.getElementById("main"); if (main && main.parentNode) main.parentNode.insertBefore(sec, main); else return (sec = null); }
    return sec;
  }
  function tile(opts) {
    var s = ensure(); if (!s) return;
    var ico = opts.dot ? el("span", { class: "hbd__dot" }) : el("span", { class: "hbd__ico" }, Site.svg(opts.icon, { "stroke-width": "1.8" }));
    var txt = el("span", { class: "hbd__txt" },
      el("span", { class: "hbd__k", text: opts.k }),
      el("span", { class: "hbd__v", text: opts.v }));
    if (opts.sub) txt.appendChild(el("span", { class: "hbd__sub", text: opts.sub }));
    var a = el("a", { class: "hbd__tile" + (opts.cls ? " " + opts.cls : ""), href: opts.href }, ico, txt);
    if (opts.order != null) a.style.order = String(opts.order);
    if (opts.ext) { a.target = "_blank"; a.rel = "noopener"; }
    s.appendChild(a); added++;
  }

  Site.ready(function () {
    /* Twitch — only while actually live */
    try {
      if (Site.live && Site.live.twitch) Site.live.twitch().then(function (t) {
        if (!t || t.live !== true) return;
        var ch = (Site.config && Site.config.twitch && Site.config.twitch.channel) || "damananders_ttv";
        tile({ k: "Streaming", v: "Live now", sub: t.uptime ? "Up for " + t.uptime : "On Twitch", dot: true,
          cls: "hbd__tile--live", href: "https://www.twitch.tv/" + ch, ext: true, order: 0 });
      }, function () {});
    } catch (e) {}

    /* AndersCraft — players online across the realms */
    try {
      if (Site.live && Site.live.realms) Site.live.realms().then(function (s) {
        if (!s || !Array.isArray(s.realms)) return;
        var total = 0, any = false;
        s.realms.forEach(function (r) { if (r && r.online !== false && typeof r.players === "number" && r.players >= 0) { total += r.players; any = true; } });
        if (!any) return;
        var n = Site.fmtNum ? Site.fmtNum(total) : String(total);
        tile({ k: "AndersCraft", v: n + (total === 1 ? " adventurer" : " adventurers"), sub: "online right now",
          icon: CRAFT, cls: "hbd__tile--craft", href: "anderscraft/", order: 1 });
      }, function () {});
    } catch (e) {}

    /* Rate-O-Pedia — this week's top-rated game (round-15 public view; hidden until the SQL is run) */
    try {
      if (window.fetch) fetch(SB_URL + "/rest/v1/week_top_rated?select=id,title,console,average,votes&order=average.desc,votes.desc&limit=1",
        { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (rows) {
          var g = Array.isArray(rows) && rows[0]; if (!g || !g.title) return;
          var avg = Math.max(0, Math.min(5, Number(g.average) || 0));
          tile({ k: "Top rated this week", v: String(g.title),
            sub: avg.toFixed(1) + " ★ · " + String(g.console || ""),
            icon: STAR, cls: "hbd__tile--rop",
            href: "games/game/?id=" + encodeURIComponent(String(g.id || "")), order: 2 });
        })
        .catch(function () {});
    } catch (e) {}
  }, "hub dashboard");
})();
