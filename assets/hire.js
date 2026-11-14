/* hire.js — the "Want to work with me?" gate.
 *
 * Any link or button with [data-hire] opens a "Send Your Contact Info?" box before it goes to its target
 * (href for a link, [data-hire-target] otherwise). The visitor can optionally leave a name, email and/or
 * phone, then "Send It!" (sends and continues) or "Just Passing Through" (continues without sending).
 * The X closes the box and leaves them where they were. Nothing here is required; everything is optional.
 *
 * [data-hire-require] is a stricter variant: the visitor MUST give a name and a valid email before the box
 * lets them through — there is no "just passing through". It opens its own dialog (id hg-gate, so it earns no
 * trophy) and, with [data-hire-newtab], opens the target in a new tab. Used to gate the Edge profile link.
 *
 * Where submissions go is assets/site-config.js -> resume.contactEndpoint (a Formspree form works as-is).
 * With no endpoint the optional box still works; the required gate still blocks until a valid email is given,
 * it just can't deliver the lead.
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

  function go(target, newTab) {
    if (!target) return;
    if (newTab) { try { var w = window.open(target, "_blank", "noopener"); if (w) return; } catch (e) {} }
    try { location.assign(target); } catch (e) { location.href = target; }
  }

  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function field(name, label, type, hint) {
    var id = "hire-" + name;
    return el("label", { class: "hg-field", "for": id },
      el("span", { class: "hg-field__label", text: label }),
      el("input", { class: "hg-input", id: id, name: name, type: type || "text", autocomplete: hint || "off", placeholder: " " })
    );
  }

  function open(target, opts) {
    opts = opts || {};
    var require = !!opts.require, newTab = !!opts.newTab;

    /* honeypot: a field no human sees; if a bot fills it, we quietly skip the send */
    var honey = el("input", { class: "hg-honey", type: "text", name: "company", tabindex: "-1", autocomplete: "off", "aria-hidden": "true" });
    var fName = field("name", require ? "Name" : "Name", "text", "name");
    var fMail = field("email", "Email", "email", "email");
    var fTel = field("phone", "Phone", "tel", "tel");
    var err = el("p", { class: "hg-err", role: "alert", "aria-live": "assertive", hidden: true });

    var sendBtn = el("button", { class: "hg-btn hg-btn--send", type: "submit" },
      require ? "Continue" : "Send It!", svg('<path d="M4 12h15M13 6l6 6-6 6"/>', { class: "hg-btn__i", width: 18, height: 18 }));
    var skipBtn = require ? null : el("button", { class: "hg-btn hg-btn--skip", type: "button" }, "Just Passing Through");

    var actions = require ? el("div", { class: "hg-actions hg-actions--one" }, sendBtn)
                          : el("div", { class: "hg-actions" }, skipBtn, sendBtn);
    var form = el("form", { class: "hg-form", novalidate: true },
      el("p", { class: "hg-sub", text: require
        ? "Add your name and a valid email and I'll open my Edge profile for you."
        : "All optional — leave anything you like, or just head in." }),
      honey,
      el("div", { class: "hg-fields" }, fName, fMail, fTel),
      err,
      actions
    );

    var d = Site.modal({
      id: require ? "hg-gate" : "hg-box",
      title: require ? "Open my Edge profile" : "Send Your Contact Info?",
      className: "hg-modal", body: form
    });

    function mark(wrap, bad) {
      var i = wrap.querySelector("input");
      if (bad) { i.setAttribute("aria-invalid", "true"); wrap.classList.add("hg-field--bad"); }
      else { i.removeAttribute("aria-invalid"); wrap.classList.remove("hg-field--bad"); }
    }
    function showErr(msg, wrap) {
      err.textContent = msg; err.hidden = false;
      if (wrap) { try { wrap.querySelector("input").focus(); } catch (e) {} }
    }

    var done = false;
    function finish(sending) {
      if (done) return;
      var name = fName.querySelector("input").value.trim();
      var mail = fMail.querySelector("input").value.trim();
      var tel = fTel.querySelector("input").value.trim();

      if (require && sending) {
        /* required gate: a name and a valid email are the price of entry */
        mark(fName, false); mark(fMail, false); err.hidden = true;
        if (!name) { mark(fName, true); return showErr("Please add your name.", fName); }
        if (!EMAIL.test(mail)) { mark(fMail, true); return showErr("Please enter a valid email address.", fMail); }
      }

      done = true;
      sendBtn.disabled = true; if (skipBtn) skipBtn.disabled = true;
      if (sending) {
        var payload = {
          name: name, email: mail, phone: tel,
          _subject: require ? "Someone opened your Edge profile (from your resume page)"
                            : "Someone wants to work with you (from your resume page)",
          source: "damananders.github.io resume" + (require ? " · Edge gate" : "")
        };
        var empty = !payload.name && !payload.email && !payload.phone;
        if (!honey.value && (require || !empty)) { send(payload); Site.toast(require ? "Thanks — opening my Edge profile." : "Thanks — I'll be in touch.", { type: "ok" }); }
      }
      setTimeout(function () { try { d.close(); } catch (e) {} go(target, newTab); }, sending ? 260 : 0);
    }

    if (skipBtn) skipBtn.addEventListener("click", function () { finish(false); });
    form.addEventListener("submit", function (e) { e.preventDefault(); finish(true); });
    Site.dialog.open(d);
    setTimeout(function () { try { fName.querySelector("input").focus(); } catch (e) {} }, 60);
  }

  Site.ready(function () {
    document.addEventListener("click", function (e) {
      var t = e.target.closest ? e.target.closest("[data-hire],[data-hire-require]") : null;
      if (!t) return;
      e.preventDefault();
      var target = t.getAttribute("href") || t.getAttribute("data-hire-target") || "";
      open(target || null, {
        require: t.hasAttribute("data-hire-require"),
        newTab: t.hasAttribute("data-hire-newtab")
      });
    });
  }, "hire gate");
})();
