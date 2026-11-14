/* Discord page: fills the live member / online-now counts from the same lookup the header pill uses
 * (Site.live.discord(), the public invite API). If it can't be reached, the tiles quietly fall back to
 * the static "—" already in the HTML, so the page still reads fine. Self-contained. Prefix dc-. */
(function () {
  "use strict";
  if (!window.Site || window.Site.page !== "discord") return;
  var Site = window.Site, doc = document;

  Site.ready(function () {
    var mEl = doc.getElementById("dc-members"), oEl = doc.getElementById("dc-online");
    if (!mEl || !oEl) return;
    var fmt = Site.fmtNum || function (n) { return String(n); };

    Site.live.discord().then(function (d) {
      if (!d) return;
      if (typeof d.members === "number" && d.members > 0) mEl.textContent = fmt(d.members);
      if (typeof d.online === "number" && d.online >= 0) {
        oEl.innerHTML = '<span class="dc-dot"></span>' + fmt(d.online);
        oEl.classList.add("is-live");
      }
    }).catch(function () {});
  }, "discord page");
})();
