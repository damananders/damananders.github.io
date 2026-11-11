/* pages/404.js: the "Lost at sea." page. Shows the path that was not found, suggests the most likely avenue,
 * and keeps the light beam on the photo's lamp. Nothing here ever redirects. See assets/README.md.
 */
(function () {
  "use strict";
  if (!window.Site) return;
  var Site = window.Site;

  /* ---- the path that was not found, as plain text ---- */
  var rawPath = "";
  try { rawPath = String(location.pathname || ""); } catch (e) {}
  function prettyPath() {
    var p = rawPath;
    try { p = decodeURIComponent(p); } catch (e) {}
    p = p.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, "");
    if (p.length > 90) p = p.slice(0, 60) + "…" + p.slice(-24);
    return p;
  }

  Site.ready(function () {
    var out = document.getElementById("nf-path");
    if (!out) return;
    var p = prettyPath();
    if (!p || p === "/" || /^\/404(\.html)?$/i.test(p)) return;   /* opened directly: keep the plain wording */
    out.textContent = p;
  }, "404-path");

  /* ---- most likely avenue, guessed from the path ---- */
  Site.ready(function () {
    var hint = document.getElementById("nf-hint");
    if (!hint) return;
    var p = prettyPath().toLowerCase();
    if (/^\/404(\.html)?$/.test(p)) return;
    var pick = null;
    if (/^\/games(\/|$)/.test(p) || p.indexOf("vault") >= 0) {
      /* the old /games/ address: only the owner hears about the vault */
      if (Site.owner) pick = { key: "vault", lead: "The games page moved. It is now your ", label: "Personal Vault", href: "/vault/" };
    }
    if (!pick && /craft|wow|signup|register|account/.test(p)) pick = { key: "craft", lead: "Looking for the WoW server? Try ", label: "AndersCraft", href: "/anderscraft/" };
    if (!pick && /any|ps/.test(p)) pick = { key: "anyps", lead: "Looking for the launcher? Try ", label: "AnyPS", href: "/anyps/" };
    if (!pick) return;

    while (hint.firstChild) hint.removeChild(hint.firstChild);
    hint.classList.add("nf-hint--" + pick.key);
    hint.appendChild(document.createTextNode(pick.lead));
    /* the full stop stays glued to the link so it never wraps onto a line of its own */
    hint.appendChild(Site.el("span", { class: "nf-hint__go" }, Site.el("a", { href: pick.href, text: pick.label }), "."));

    var btn = document.getElementById("nf-go-" + pick.key);
    if (btn) btn.classList.add("nf-is-pick");
  }, "404-suggest");

  /* ---- light beam: keep it on the lamp when the page is taller than the screen, and rest it while the tab is hidden ---- */
  Site.ready(function () {
    var sky = document.getElementById("nf-sky");
    if (!sky) return;
    var root = document.documentElement;
    var mq = window.matchMedia ? matchMedia("(max-width: 860px)") : null;
    var queued = false;
    function measure() {
      queued = false;
      /* On phones the photo covers the whole page, not just the screen (see hub.css). */
      if (mq && mq.matches) root.style.setProperty("--nf-h", Math.max(root.scrollHeight, window.innerHeight) + "px");
      else root.style.removeProperty("--nf-h");
    }
    function queue() { if (!queued) { queued = true; requestAnimationFrame(measure); } }
    measure();
    window.addEventListener("resize", queue);
    window.addEventListener("load", queue);
    if (mq) { if (mq.addEventListener) mq.addEventListener("change", queue); else if (mq.addListener) mq.addListener(queue); }

    function vis() { sky.classList.toggle("nf-paused", document.hidden); }
    document.addEventListener("visibilitychange", vis);
    vis();
  }, "404-beam");
})();
