/* pages/404-game.js — "Row home": a tiny game for the 404 page. Steer the boat, dodge the rocks, pick up the lights.
 * Arrow keys or A / D, drag or tap on a touch screen, left / right on a controller. Best score is kept in this browser.
 * features.game404 = false removes it.
 */
(function () {
  "use strict";
  if (!window.Site || window.Site.page !== "404") return;
  var Site = window.Site, el = Site.el, doc = document;
  if (((Site.config && Site.config.features) || {}).game404 === false) return;

  Site.ready(function () {
    var hero = doc.querySelector(".nf-hero"); if (!hero) return;
    var W = 560, H = 300;
    var cv = el("canvas", { class: "nf-game__cv", width: String(W), height: String(H), role: "img", "aria-label": "Row home, a small boat game" });
    var scoreEl = el("span", { class: "nf-game__score", text: "0" }), bestEl = el("span", { class: "nf-game__best" });
    var btn = el("button", { type: "button", class: "btn nf-game__go", style: { "--accent": "#eef0f3" }, text: "Play" });
    var msg = el("p", { class: "nf-game__msg", "aria-live": "polite", text: "Steer with the arrow keys, A and D, or by dragging. Dodge the rocks, grab the lights." });
    var box = el("section", { id: "nf-game-boat", class: "nf-game", "data-reveal": "" },
      el("div", { class: "nf-game__head" }, el("h2", { text: "While you're lost: row home" }), el("div", { class: "nf-game__nums" }, "Score ", scoreEl, bestEl)),
      el("div", { class: "nf-game__frame" }, cv, el("div", { class: "nf-game__over" }, btn)), msg);
    hero.appendChild(box); if (Site.reveal) Site.reveal(box);
    var ctx = cv.getContext("2d"), best = Site.store.get("best404", 0) || 0;
    function paintBest() { bestEl.textContent = best ? "  ·  Best " + best : ""; }
    paintBest();

    var run = false, raf = 0, last = 0, t = 0, boat, things, score, speed, spawnAt, left = false, right = false, target = null, wave = 0;
    function reset() { boat = { x: W / 2, vx: 0 }; things = []; score = 0; speed = 120; spawnAt = 0; t = 0; target = null; }
    function sea() {
      var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#0b1a2e"); g.addColorStop(1, "#06101c");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(160,200,255,.10)"; ctx.lineWidth = 1.5;
      for (var r = 0; r < 7; r++) {
        var y = ((r * 48 + wave) % (H + 48)) - 24; ctx.beginPath();
        for (var x = 0; x <= W; x += 14) ctx.lineTo(x, y + Math.sin(x / 38 + r * 1.7 + wave / 30) * 4);
        ctx.stroke();
      }
    }
    function drawBoat() {
      var x = boat.x, y = H - 44, tilt = Math.max(-0.35, Math.min(0.35, boat.vx / 500));
      ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
      ctx.fillStyle = "#c98a4b"; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.quadraticCurveTo(0, 20, 18, 0); ctx.lineTo(13, -5); ctx.lineTo(-13, -5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#f4efe6"; ctx.beginPath(); ctx.moveTo(1, -8); ctx.lineTo(1, -34); ctx.lineTo(16, -10); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#e8dcc8"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, -36); ctx.stroke();
      ctx.restore();
    }
    function drawThing(o) {
      if (o.k === "rock") {
        ctx.fillStyle = "#3a4654"; ctx.beginPath(); ctx.moveTo(o.x - o.r, o.y + o.r * 0.5); ctx.lineTo(o.x - o.r * 0.5, o.y - o.r * 0.8); ctx.lineTo(o.x + o.r * 0.2, o.y - o.r); ctx.lineTo(o.x + o.r, o.y + o.r * 0.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.beginPath(); ctx.ellipse(o.x, o.y + o.r * 0.55, o.r * 1.15, 3, 0, 0, 6.3); ctx.fill();
      } else {
        var g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, 16); g.addColorStop(0, "rgba(255,236,170,.95)"); g.addColorStop(1, "rgba(255,236,170,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y, 16, 0, 6.3); ctx.fill();
        ctx.fillStyle = "#fff3c4"; ctx.beginPath(); ctx.arc(o.x, o.y, 4, 0, 6.3); ctx.fill();
      }
    }
    function frame(now) {
      raf = requestAnimationFrame(frame);
      var dt = Math.min(0.04, (now - last) / 1000 || 0); last = now;
      if (doc.hidden) return;
      wave += dt * (run ? speed * 0.5 : 14);
      sea();
      if (run) {
        t += dt; speed = 120 + t * 7;
        var ax = (right ? 1 : 0) - (left ? 1 : 0);
        if (target != null) ax = Math.max(-1, Math.min(1, (target - boat.x) / 30));
        boat.vx += (ax * 320 - boat.vx) * Math.min(1, dt * 8); boat.x = Math.max(20, Math.min(W - 20, boat.x + boat.vx * dt));
        if (t > spawnAt) {
          spawnAt = t + Math.max(0.28, 0.85 - t * 0.012);
          things.push(Math.random() < 0.24 ? { k: "light", x: 24 + Math.random() * (W - 48), y: -20, r: 12 } : { k: "rock", x: 24 + Math.random() * (W - 48), y: -24, r: 12 + Math.random() * 12 });
        }
        for (var i = things.length - 1; i >= 0; i--) {
          var o = things[i]; o.y += speed * dt;
          var dx = o.x - boat.x, dy = o.y - (H - 44);
          if (Math.abs(dx) < o.r + 13 && Math.abs(dy) < o.r + 9) {
            if (o.k === "light") { score += 25; things.splice(i, 1); Site.sfx("tap"); continue; }
            end(); break;
          }
          if (o.y > H + 30) things.splice(i, 1);
        }
        score += dt * 10; scoreEl.textContent = String(Math.floor(score));
      }
      for (var j = 0; j < things.length; j++) drawThing(things[j]);
      drawBoat();
    }
    function start() {
      reset(); run = true; box.classList.add("is-on"); msg.textContent = "Rowing…"; scoreEl.textContent = "0";
      Site.sfx("open"); try { cv.focus(); } catch (e) {}
    }
    function end() {
      run = false; box.classList.remove("is-on");
      var s = Math.floor(score), rec = s > best;
      if (rec) { best = s; Site.store.set("best404", best); paintBest(); }
      msg.textContent = (rec ? "New best: " : "You hit the rocks at ") + s + ". " + (rec ? "The lighthouse keeper is impressed." : "Have another go?");
      btn.textContent = "Play again"; Site.sfx(rec ? "success" : "error");
      if (Site.trophy) { if (s >= 300) Site.trophy("sailor"); if (s >= 1000) Site.trophy("boat1k"); if (s >= 5000) Site.trophy("boat5k"); }
    }
    btn.addEventListener("click", start);
    doc.addEventListener("keydown", function (e) {
      var t0 = e.target; if (t0 && /^(INPUT|TEXTAREA|SELECT)$/.test(t0.tagName)) return;
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") { left = true; if (run) e.preventDefault(); }
      else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { right = true; if (run) e.preventDefault(); }
    });
    doc.addEventListener("keyup", function (e) {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") left = false;
      else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") right = false;
    });
    function point(e) { var r = cv.getBoundingClientRect(); target = (e.clientX - r.left) / r.width * W; }
    cv.addEventListener("pointerdown", function (e) { if (run) { point(e); try { cv.setPointerCapture(e.pointerId); } catch (x) {} } });
    cv.addEventListener("pointermove", function (e) { if (run && (e.buttons || e.pointerType === "touch")) point(e); });
    cv.addEventListener("pointerup", function () { target = null; });
    if (Site.gamepad) Site.gamepad.on(function (b) {
      if (!run) { if (b === "a" && doc.activeElement === btn) start(); return; }
      if (b === "left") { left = true; right = false; setTimeout(function () { left = false; }, 220); }
      else if (b === "right") { right = true; left = false; setTimeout(function () { right = false; }, 220); }
    });
    reset(); last = performance.now();
    if (Site.reducedMotion) { sea(); drawBoat(); btn.addEventListener("click", function () { if (!raf) raf = requestAnimationFrame(frame); }, { once: true }); }
    else raf = requestAnimationFrame(frame);
  }, "404 game");
})();
