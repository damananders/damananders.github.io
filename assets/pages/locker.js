/* PS Locker: draws the owner's private links from SITE_EXTRA.locker.list (assets/site-config.js). */
(function () {
  "use strict";
  if (!window.Site) return;
  Site.ready(function () {
    var root = document.getElementById("lk-list"); if (!root) return;
    var list = (Site.config.locker && Array.isArray(Site.config.locker.list)) ? Site.config.locker.list : [];
    list.forEach(function (it) {
      if (!it || !it.title) return;
      var ok = typeof it.url === "string" && /^https:\/\//.test(it.url);
      var btn = ok ? Site.el("a", { class: "btn", href: it.url, target: "_blank", rel: "noopener noreferrer", text: "Open in Drive" })
                   : Site.el("a", { class: "btn", "aria-disabled": "true", text: "Link not added yet" });
      root.appendChild(Site.el("article", { class: "game" }, Site.el("h2", { text: it.title, style: { "font-size": "1.15rem" } }), Site.el("p", { class: "lk-note", text: it.note || "" }), btn));
    });
    if (!root.children.length) root.appendChild(Site.el("div", { class: "empty", text: "Nothing stored yet." }));
  }, "locker");
})();
