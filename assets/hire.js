/* hire.js — the "Want to work with me?" gate.
 *
 * Any link or button with [data-hire] opens a "Send Your Contact Info?" box before it goes to its target
 * (href for a link, [data-hire-target] otherwise). The visitor can optionally leave a name, email and/or
 * phone, then "Send It!" (sends and continues) or "Just Passing Through" (continues without sending).
 * The X closes the box and leaves them where they were. Nothing here is required; everything is optional.
 *
 * Where submissions go is assets/site-config.js -> resume.contactEndpoint (a Formspree form works as-is).
 * With no endpoint the box still works; it just doesn't send anything.
 */
(function () {
  if (!window.Site) return;
  var Site = window.Site, el = Site.el, svg = Site.svg;

  function cfg() { return (Site.config && Site.config.resume) || {}; }

  function send(data) {
    var url = (cfg().contactEndpoint || "").trim();
    if (!url) return Promise.resolve(false);
    try {
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(data),
        keepalive: true                                  /* survives the page navigating away */
      }).then(function (r) { return r.ok; }, function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }

  function go(target) { if (target) { try { location.assign(target); } catch (e) { location.href = target; } } }

  function field(name, label, type, hint) {
    var id = "hire-" + name;
    return el("label", { class: "hg-field", "for": id },
      el("span", { class: "hg-field__label", text: label }),
      el("input", { class: "hg-input", id: id, name: name, type: type || "text", autocomplete: hint || "off", placeholder: " " })
    );
  }

  function open(target) {
    /* honeypot: a field no human sees; if a bot fills it, we quietly skip the send */
    var honey = el("input", { class: "hg-honey", type: "text", name: "company", tabindex: "-1", autocomplete: "off", "aria-hidden": "true" });
    var fName = field("name", "Name", "text", "name");
    var fMail = field("email", "Email", "email", "email");
    var fTel = field("phone", "Phone", "tel", "tel");

    var skipBtn = el("button", { class: "hg-btn hg-btn--skip", type: "button" }, "Just Passing Through");
    var sendBtn = el("button", { class: "hg-btn hg-btn--send", type: "submit" },
      "Send It!", svg('<path d="M4 12h15M13 6l6 6-6 6"/>', { class: "hg-btn__i", width: 18, height: 18 }));

    var form = el("form", { class: "hg-form", novalidate: true },
      el("p", { class: "hg-sub", text: "All optional — leave anything you like, or just head in." }),
      honey,
      el("div", { class: "hg-fields" }, fName, fMail, fTel),
      el("div", { class: "hg-actions" }, skipBtn, sendBtn)
    );

    var d = Site.modal({ id: "hg-box", title: "Send Your Contact Info?", className: "hg-modal", body: form });

    var done = false;
    function finish(sending) {
      if (done) return; done = true;
      sendBtn.disabled = skipBtn.disabled = true;
      if (sending) {
        var payload = {
          name: fName.querySelector("input").value.trim(),
          email: fMail.querySelector("input").value.trim(),
          phone: fTel.querySelector("input").value.trim(),
          _subject: "Someone wants to work with you (from your resume page)",
          source: "damananders.github.io resume"
        };
        var empty = !payload.name && !payload.email && !payload.phone;
        if (!honey.value && !empty) { send(payload); Site.toast("Thanks — I'll be in touch.", { type: "ok" }); }
      }
      setTimeout(function () { go(target); }, sending ? 260 : 0);
    }

    skipBtn.addEventListener("click", function () { finish(false); });
    form.addEventListener("submit", function (e) { e.preventDefault(); finish(true); });
    Site.dialog.open(d);
    setTimeout(function () { try { fName.querySelector("input").focus(); } catch (e) {} }, 60);
  }

  Site.ready(function () {
    document.addEventListener("click", function (e) {
      var t = e.target.closest ? e.target.closest("[data-hire]") : null;
      if (!t) return;
      e.preventDefault();
      var target = t.getAttribute("href") || t.getAttribute("data-hire-target") || "";
      open(target || null);
    });
  }, "hire gate");
})();
