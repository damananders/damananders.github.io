/* pages/404-case-game.js — "Review Score": the 404 page's second game, offered beside "Row home".
 *
 * Game cases arc in from the edges; stamp one before it falls away and it gets its Rate-O-Pedia tier
 * (GOLD 4+, SILVER 2 to under 4, BRONZE under 2) and its score is added to your Review Score.
 * Hardware flies in too — controllers, consoles, discs — stamp one of those by mistake and it costs a
 * quarter of a life. Survive the timer AND reach the round's goal to win. Beating "Harder ;)" unlocks a
 * hidden fifth difficulty. Mouse / touch to slice or tap; arrow keys + Space, or a controller, also play.
 * features.caseGame404 = false removes it. Covers are drawn placeholders until real art is wired in.
 */
(function () {
  "use strict";
  if (!window.Site || (window.Site.page !== "404" && window.Site.page !== "arcade")) return;
  var Site = window.Site, el = Site.el, doc = document, store = Site.store;
  if (((Site.config && Site.config.features) || {}).caseGame404 === false) return;

  var W = 560, H = 360, MONO = "var(--mono, ui-monospace, monospace)";
  var HR_KEY = "case404.hr";
  function hardererUnlocked() { return !!store.get(HR_KEY, false); }

  var DIFF = [
    { key: "easy",     name: "Easy",        time: 45,  lives: 6, goal: 0.40, interval: 1.15, haz: 0.12 },
    { key: "medium",   name: "Medium",      time: 60,  lives: 5, goal: 0.50, interval: 0.95, haz: 0.16 },
    { key: "hard",     name: "Hard",        time: 90,  lives: 4, goal: 0.60, interval: 0.82, haz: 0.22 },
    { key: "harder",   name: "Harder ;)",   time: 120, lives: 3, goal: 0.70, interval: 0.70, haz: 0.28 },
    { key: "harderer", name: "Harder…er", time: 240, lives: 1, goal: 0.80, interval: 0.56, haz: 0.32, hidden: true }
  ];
  var HAZ = ["pad", "disc", "console"];

  /* famous-game placeholders; real titles/scores/covers arrive from the Rate-O-Pedia thread later */
  var FALLBACK = [
    { title: "Metal Gear Solid", platform: "PS1" }, { title: "Final Fantasy VII", platform: "PS1" },
    { title: "Crash Bandicoot", platform: "PS1" }, { title: "Gran Turismo", platform: "PS1" },
    { title: "God of War", platform: "PS2" }, { title: "Shadow of the Colossus", platform: "PS2" },
    { title: "Kingdom Hearts", platform: "PS2" }, { title: "Okami", platform: "PS2" },
    { title: "Persona 3 Portable", platform: "PSP" }, { title: "Patapon", platform: "PSP" },
    { title: "The Last of Us", platform: "PS3" }, { title: "Journey", platform: "PS3" },
    { title: "Demon's Souls", platform: "PS3" }, { title: "Bloodborne", platform: "PS3" }
  ];

  function scoreOf(g) {
    if (g && typeof g.score === "number" && isFinite(g.score)) return Math.max(0, Math.min(5, g.score));
    var s = String((g && g.title) || ""), h = 0, i;        /* deterministic placeholder until real averages exist */
    for (i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return Math.round((h % 46 + 5) / 10 * 10) / 10;         /* 0.5 .. 5.0 in 0.1 steps */
  }
  function tierOf(s) {
    if (s >= 4) return { col: "#f0c23a", ink: "#2a2103", label: "GOLD" };
    if (s >= 2) return { col: "#d2d8e0", ink: "#20262e", label: "SILVER" };
    return { col: "#c58551", ink: "#2a1708", label: "BRONZE" };
  }

  Site.ready(function () {
    var hero = doc.querySelector(".nf-arcade") || doc.querySelector(".nf-hero"); if (!hero) return;
    var boat = doc.getElementById("nf-game-boat");

    /* ---- game picker (both games stay; visitor chooses) ---- */
    var pick = el("div", { class: "nf-pick", role: "group", "aria-label": "Pick a game" });
    var bBoat = el("button", { type: "button", class: "nf-pick__b is-active", "aria-pressed": "true" }, "🚣 Row home");
    var bCase = el("button", { type: "button", class: "nf-pick__b", "aria-pressed": "false" }, "🎮 Review Score");
    var bBig = el("button", { type: "button", class: "nf-pick__b nf-pick__big", "aria-pressed": "false", title: "Enlarge and center the game" }, "⤢ Enlarge");
    pick.appendChild(bBoat); pick.appendChild(bCase); pick.appendChild(bBig);
    if (boat && boat.parentNode) boat.parentNode.insertBefore(pick, boat);
    else hero.appendChild(pick);

    /* ---- enlarge + center the active game into a focused overlay ---- */
    var dim = el("div", { class: "nf-big-dim" });
    var bigClose = el("button", { type: "button", class: "nf-big-close", "aria-label": "Shrink the game", hidden: "" }, "⤡ Shrink");
    var host = doc.body || hero; host.appendChild(dim); host.appendChild(bigClose);
    var big = false, bigEl = null, bigHome = null;
    function setBig(on) {
      if (on && !bigEl) {
        var active = box.hidden ? boat : box; if (!active || !active.parentNode) return;
        /* lift the active game to <body> so position:fixed centers on the viewport,
           not on a transformed ancestor (the hero/wrap carry transforms) */
        bigEl = active;
        bigHome = doc.createComment("nf-big-home");
        active.parentNode.insertBefore(bigHome, active);
        dim.appendChild(active);   /* dim is a flex box, so it centers the game regardless of ancestor transforms */
        active.classList.add("is-big");
        big = true;
      } else if (!on && bigEl) {
        bigEl.classList.remove("is-big");
        if (bigHome && bigHome.parentNode) { bigHome.parentNode.insertBefore(bigEl, bigHome); bigHome.parentNode.removeChild(bigHome); }
        bigEl = null; bigHome = null; big = false;
      }
      dim.classList.toggle("is-open", big); bigClose.hidden = !big;
      doc.documentElement.classList.toggle("nf-big-open", big);   /* keep the page scroll locked while enlarged */
      bBig.setAttribute("aria-pressed", big ? "true" : "false");
      bBig.classList.toggle("is-active", big);
      bBig.textContent = big ? "⤡ Shrink" : "⤢ Enlarge";
    }
    bBig.addEventListener("click", function () { setBig(!big); });
    bigClose.addEventListener("click", function () { setBig(false); });
    dim.addEventListener("click", function (e) { if (e.target === dim) setBig(false); });
    doc.addEventListener("keydown", function (e) { if (big && e.key === "Escape") { setBig(false); e.preventDefault(); } });

    /* ---- case-game shell (reuses .nf-game styling) ---- */
    var cv = el("canvas", { class: "nf-game__cv", width: String(W), height: String(H), role: "img", "aria-label": "Review Score, a game-stamping game" });
    var over = el("div", { class: "nf-game__over" });
    var box = el("section", { id: "nf-game-case", class: "nf-game nf-game--case", hidden: "" },
      el("div", { class: "nf-game__head" },
        el("h2", { text: "Stamp the review scores" }),
        el("div", { class: "nf-game__nums" }, el("span", { class: "nf-cg__best" }))),
      el("div", { class: "nf-game__frame" }, cv, over),
      el("p", { class: "nf-game__msg", "aria-live": "polite" }));
    if (boat && boat.parentNode) boat.parentNode.insertBefore(box, boat.nextSibling);
    else hero.appendChild(box);
    var bestEl = box.querySelector(".nf-cg__best"), msg = box.querySelector(".nf-game__msg");
    if (Site.reveal) Site.reveal(box);

    var shown = false;
    function toggle(on) {
      shown = on;
      box.hidden = !on; if (boat) boat.hidden = on;
      bCase.classList.toggle("is-active", on); bCase.setAttribute("aria-pressed", on ? "true" : "false");
      bBoat.classList.toggle("is-active", !on); bBoat.setAttribute("aria-pressed", !on ? "true" : "false");
      if (on && state === "menu") renderMenu();
    }
    bBoat.addEventListener("click", function () { if (state === "play") stop(); toggle(false); });
    bCase.addEventListener("click", function () { toggle(true); });

    /* ---- state ---- */
    var ctx = cv.getContext("2d");
    var state = "menu", diff = DIFF[0], raf = 0, last = 0;
    var round = null, si = 0, clock = 0, objs = [], reviewScore = 0, goal = 0, lives = 0, flash = 0, hitCount = 0;
    var ret = { x: W / 2, y: H / 2, on: false }, MO = Site.reducedMotion ? 0.62 : 1;

    function paintBest() {
      var b = store.get("case404.best." + diff.key, 0) || 0;
      bestEl.textContent = b ? "Best (" + diff.name + ") " + b : "";
    }

    /* ---- menu / result overlay ---- */
    function renderMenu(resultHtml) {
      over.textContent = "";
      if (resultHtml) over.appendChild(resultHtml);
      over.appendChild(el("p", { class: "nf-cg__lead", text: resultHtml ? "Pick a difficulty to play again." : "Stamp the game cases, skip the hardware. Hit the round's goal before time runs out." }));
      var grid = el("div", { class: "nf-cg__diffs" });
      DIFF.forEach(function (d) {
        if (d.hidden && !hardererUnlocked()) return;
        var b = el("button", { type: "button", class: "nf-cg__diff" + (d.hidden ? " is-secret" : ""),
          title: d.time + "s · " + d.lives + " " + (d.lives === 1 ? "life" : "lives") + " · goal " + Math.round(d.goal * 100) + "%" },
          el("b", { text: d.name }),
          el("span", { text: d.time + "s · " + d.lives + "♥ · " + Math.round(d.goal * 100) + "%" }));
        b.addEventListener("click", function () { start(d); });
        grid.appendChild(b);
      });
      over.appendChild(grid);
      paintBest();
      try { over.querySelector(".nf-cg__diff").focus(); } catch (e) {}
    }

    /* ---- round build: schedule every throw up front so the goal is a real share of the points thrown ---- */
    function buildRound(d) {
      var items = [], t = 0.7, total = 0, pool = CASES && CASES.length ? CASES : FALLBACK;
      while (t < d.time - 0.5) {
        if (Math.random() < d.haz) items.push({ t: t, kind: "haz", type: HAZ[(Math.random() * HAZ.length) | 0] });
        else {
          var g = pool[(Math.random() * pool.length) | 0], sc = scoreOf(g);
          items.push({ t: t, kind: "case", game: g, score: sc });
          total += Math.max(1, sc);
        }
        t += d.interval * (0.72 + Math.random() * 0.62);
      }
      return { items: items, goal: Math.max(1, Math.round(d.goal * total)) };
    }

    function start(d) {
      diff = d; round = buildRound(d); goal = round.goal;
      si = 0; clock = 0; objs = []; reviewScore = 0; lives = d.lives; hitCount = 0; flash = 0;
      ret.x = W / 2; ret.y = H / 2;
      state = "play"; box.classList.add("is-on"); msg.textContent = "";
      Site.sfx("open"); try { cv.focus(); } catch (e) {}
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    }
    function stop() { state = "menu"; box.classList.remove("is-on"); renderMenu(); }

    function finish() {
      state = "over"; box.classList.remove("is-on");
      var sc = Math.round(reviewScore), won = sc >= goal && lives > 0.0001;
      var bk = "case404.best." + diff.key, best = store.get(bk, 0) || 0;
      if (sc > best) store.set(bk, sc);
      var newUnlock = false;
      if (won && diff.key === "harder" && !hardererUnlocked()) { store.set(HR_KEY, true); newUnlock = true; }
      if (won && Site.trophy) Site.trophy("rs-" + diff.key);
      var head = el("p", { class: "nf-cg__result " + (won ? "is-win" : "is-lose"),
        text: won ? "Stamped! Review Score " + sc + " — goal was " + goal + "." : (lives <= 0.0001 ? "Out of lives at Review Score " + sc + "." : "Time! " + sc + " of " + goal + " — just short.") });
      renderMenu(head);
      if (newUnlock) msg.textContent = "You beat Harder ;) — Harder…er is now unlocked.";
      else if (won) msg.textContent = "Nicely stamped.";
      else msg.textContent = "Stamp the box art, leave the hardware alone.";
      Site.sfx(won ? "success" : "error");
    }

    /* ---- physics ---- */
    function launch(item) {
      var fromSide = Math.random() < 0.26, x, y, vx, vy;
      if (fromSide) {
        var right = Math.random() < 0.5;
        x = right ? W + 26 : -26; y = H - 20 - Math.random() * 60;
        vx = (right ? -1 : 1) * (150 + Math.random() * 90) * MO; vy = -(360 + Math.random() * 150) * MO;
      } else {
        x = 60 + Math.random() * (W - 120); y = H + 28;
        vx = (Math.random() * 2 - 1) * 90 * MO; vy = -(520 + Math.random() * 140) * MO;
      }
      objs.push({ kind: item.kind, type: item.type, game: item.game, score: item.score,
        x: x, y: y, vx: vx, vy: vy, rot: (Math.random() * 2 - 1) * 0.5, vr: (Math.random() * 2 - 1) * 1.4,
        hit: false, stamp: 0, gone: false });
    }
    var G = 560 * MO;
    function updateObjs(dt) {
      for (var i = objs.length - 1; i >= 0; i--) {
        var o = objs[i];
        o.vy += G * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.vr * dt;
        if (o.hit) { o.stamp = Math.min(1, o.stamp + dt * 4); o.vx *= 0.985; }
        if ((o.y > H + 70 && o.vy > 0) || o.x < -80 || o.x > W + 80) objs.splice(i, 1);
      }
    }
    function tryHit(px, py) {
      for (var i = objs.length - 1; i >= 0; i--) {
        var o = objs[i]; if (o.hit) continue;
        var dx = o.x - px, dy = o.y - py;
        if (dx * dx + dy * dy <= 40 * 40) { stamp(o); return true; }
      }
      return false;
    }
    function stamp(o) {
      o.hit = true; o.stamp = 0; o.vy -= 120 * MO;
      if (o.kind === "case") {
        reviewScore += Math.max(1, o.score); hitCount++;
        Site.sfx("tap");
      } else {
        lives = Math.max(0, lives - 0.25); flash = 1;
        Site.sfx("error");
        if (lives <= 0.0001 && state === "play") finish();
      }
    }

    /* ---- draw ---- */
    function rr(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    function bg() {
      var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#0c1420"); g.addColorStop(1, "#070c14");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (flash > 0) { ctx.fillStyle = "rgba(220,70,70," + (flash * 0.28).toFixed(3) + ")"; ctx.fillRect(0, 0, W, H); }
    }
    function drawCase(o) {
      var w = 48, h = 64, t = tierOf(o.score);
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.rot);
      ctx.fillStyle = "rgba(0,0,0,.4)"; rr(-w / 2 + 2, -h / 2 + 5, w, h, 7); ctx.fill();
      ctx.fillStyle = "#18212e"; rr(-w / 2, -h / 2, w, h, 7); ctx.fill();
      ctx.strokeStyle = t.col; ctx.lineWidth = 2.5; rr(-w / 2, -h / 2, w, h, 7); ctx.stroke();
      ctx.fillStyle = t.col; rr(-w / 2, -h / 2, 7, h, 7); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.12)"; rr(-w / 2 + 11, -h / 2 + 6, w - 17, 20, 3); ctx.fill();
      ctx.fillStyle = "rgba(226,232,240,.92)"; ctx.font = "700 7px " + MONO; ctx.textAlign = "center";
      var words = String((o.game && o.game.title) || "Game").split(" "), line = "", lines = [], k;
      for (k = 0; k < words.length; k++) {
        var tryl = line ? line + " " + words[k] : words[k];
        if (tryl.length > 9 && line) { lines.push(line); line = words[k]; } else line = tryl;
        if (lines.length >= 3) break;
      }
      if (line && lines.length < 3) lines.push(line);
      for (k = 0; k < lines.length; k++) ctx.fillText(lines[k].slice(0, 11), 4, 2 + k * 8);
      ctx.textAlign = "left";
      if (o.hit) {
        var s = o.stamp, a = Math.min(1, s * 1.4);
        ctx.globalAlpha = a; ctx.rotate(-0.26); ctx.scale(1.5 - s * 0.5, 1.5 - s * 0.5);
        ctx.fillStyle = t.col; rr(-26, -11, 52, 22, 4); ctx.fill();
        ctx.fillStyle = t.ink; ctx.font = "800 10px " + MONO; ctx.textAlign = "center";
        ctx.fillText(o.score.toFixed(1), 0, 4); ctx.textAlign = "left"; ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
    function drawHaz(o) {
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.rot);
      ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.strokeStyle = "#e0653f"; ctx.lineWidth = 2.5;
      if (o.type === "disc") {
        ctx.fillStyle = "#2b3442"; ctx.beginPath(); ctx.arc(0, 0, 22, 0, 6.3); ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, 22, 0, 6.3); ctx.stroke();
        ctx.fillStyle = "#0c1420"; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 6.3); ctx.fill();
      } else if (o.type === "console") {
        ctx.fillStyle = "#222b38"; rr(-26, -13, 52, 26, 5); ctx.fill(); rr(-26, -13, 52, 26, 5); ctx.stroke();
        ctx.fillStyle = "#e0653f"; rr(-20, -3, 26, 5, 2); ctx.fill();
        ctx.beginPath(); ctx.arc(14, 0, 3.4, 0, 6.3); ctx.fill();
      } else {
        ctx.fillStyle = "#222b38"; rr(-26, -11, 52, 22, 11); ctx.fill(); rr(-26, -11, 52, 22, 11); ctx.stroke();
        ctx.strokeStyle = "#e0653f"; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(-15, -4); ctx.lineTo(-15, 4); ctx.moveTo(-19, 0); ctx.lineTo(-11, 0); ctx.stroke();
        ctx.fillStyle = "#e0653f"; ctx.beginPath(); ctx.arc(13, -3, 2.6, 0, 6.3); ctx.fill();
        ctx.beginPath(); ctx.arc(19, 3, 2.6, 0, 6.3); ctx.fill();
      }
      if (o.hit) { ctx.globalAlpha = Math.min(0.8, o.stamp); ctx.strokeStyle = "#ff5a5a"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-14, -14); ctx.lineTo(14, 14); ctx.moveTo(14, -14); ctx.lineTo(-14, 14); ctx.stroke(); ctx.globalAlpha = 1; }
      ctx.restore();
    }
    function hud() {
      ctx.fillStyle = "rgba(6,11,18,.72)"; ctx.fillRect(0, 0, W, 34);
      ctx.textAlign = "left"; ctx.font = "700 14px " + MONO;
      ctx.fillStyle = reviewScore >= goal ? "#7ee6a6" : "#e6ebf1";
      ctx.fillText("Review Score " + Math.round(reviewScore) + " / " + goal, 12, 23);
      var left = Math.max(0, diff.time - clock), mm = (left / 60) | 0, ssN = Math.floor(left % 60);
      ctx.textAlign = "center"; ctx.fillStyle = left < 10 ? "#ffcf6b" : "#c6ced8";
      ctx.fillText(mm + ":" + (ssN < 10 ? "0" : "") + ssN, W / 2, 23);
      var hx = W - 14, i;                                   /* hearts, quarter-granular */
      for (i = 0; i < diff.lives; i++) {
        var cx = hx - i * 20, fillAmt = Math.max(0, Math.min(1, lives - (diff.lives - 1 - i)));
        heart(cx, 17, 7, fillAmt);
      }
      ctx.textAlign = "left";
    }
    function heart(cx, cy, s, fill) {
      function path() { ctx.beginPath();
        ctx.moveTo(cx, cy + s * 0.9);
        ctx.bezierCurveTo(cx - s * 1.5, cy - s * 0.3, cx - s * 0.6, cy - s * 1.3, cx, cy - s * 0.4);
        ctx.bezierCurveTo(cx + s * 0.6, cy - s * 1.3, cx + s * 1.5, cy - s * 0.3, cx, cy + s * 0.9);
        ctx.closePath(); }
      path(); ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fill();
      if (fill > 0) { ctx.save(); path(); ctx.clip();
        ctx.fillStyle = "#ff5d6c"; ctx.fillRect(cx - s * 1.6, cy + s - fill * (s * 2.3), s * 3.2, fill * (s * 2.3)); ctx.restore(); }
      path(); ctx.strokeStyle = "rgba(255,120,130,.7)"; ctx.lineWidth = 1; ctx.stroke();
    }
    function drawReticle() {
      if (!ret.on) return;
      ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(ret.x, ret.y, 16, 0, 6.3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ret.x - 22, ret.y); ctx.lineTo(ret.x - 8, ret.y);
      ctx.moveTo(ret.x + 8, ret.y); ctx.lineTo(ret.x + 22, ret.y);
      ctx.moveTo(ret.x, ret.y - 22); ctx.lineTo(ret.x, ret.y - 8);
      ctx.moveTo(ret.x, ret.y + 8); ctx.lineTo(ret.x, ret.y + 22); ctx.stroke();
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      var dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
      if (doc.hidden) return;
      if (!shown) { raf && cancelAnimationFrame(raf); raf = 0; return; }  /* sleep when hidden game */
      bg();
      if (flash > 0) flash = Math.max(0, flash - dt * 2.2);
      if (state === "play") {
        clock += dt;
        while (si < round.items.length && round.items[si].t <= clock) { launch(round.items[si]); si++; }
        updateObjs(dt);
        if (clock >= diff.time && state === "play") finish();
      }
      for (var i = 0; i < objs.length; i++) objs[i].kind === "case" ? drawCase(objs[i]) : drawHaz(objs[i]);
      if (state === "play") { hud(); drawReticle(); }
    }
    function wake() { if (shown && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }

    /* ---- input ---- */
    function toCv(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
    cv.addEventListener("pointerdown", function (e) { if (state !== "play") return; var p = toCv(e); tryHit(p.x, p.y); try { cv.setPointerCapture(e.pointerId); } catch (x) {} });
    cv.addEventListener("pointermove", function (e) { if (state !== "play") return; if (e.buttons || e.pointerType === "touch") { var p = toCv(e); tryHit(p.x, p.y); } });
    doc.addEventListener("keydown", function (e) {
      if (!shown || state !== "play") return;
      var t0 = e.target; if (t0 && /^(INPUT|TEXTAREA|SELECT)$/.test(t0.tagName)) return;
      var step = 26, k = e.key;
      if (k === "ArrowLeft" || k === "a" || k === "A") { ret.on = true; ret.x = Math.max(8, ret.x - step); e.preventDefault(); }
      else if (k === "ArrowRight" || k === "d" || k === "D") { ret.on = true; ret.x = Math.min(W - 8, ret.x + step); e.preventDefault(); }
      else if (k === "ArrowUp" || k === "w" || k === "W") { ret.on = true; ret.y = Math.max(40, ret.y - step); e.preventDefault(); }
      else if (k === "ArrowDown" || k === "s" || k === "S") { ret.on = true; ret.y = Math.min(H - 8, ret.y + step); e.preventDefault(); }
      else if (k === " " || k === "Enter") { ret.on = true; tryHit(ret.x, ret.y); e.preventDefault(); }
    });
    if (Site.gamepad) Site.gamepad.on(function (b) {
      if (!shown) return;
      if (state !== "play") { if (b === "a") { var f = over.querySelector(".nf-cg__diff:focus") || over.querySelector(".nf-cg__diff"); if (f) f.click(); } return; }
      var step = 30;
      if (b === "left") { ret.on = true; ret.x = Math.max(8, ret.x - step); }
      else if (b === "right") { ret.on = true; ret.x = Math.min(W - 8, ret.x + step); }
      else if (b === "up") { ret.on = true; ret.y = Math.max(40, ret.y - step); }
      else if (b === "down") { ret.on = true; ret.y = Math.min(H - 8, ret.y + step); }
      else if (b === "a") { ret.on = true; tryHit(ret.x, ret.y); }
    });
    doc.addEventListener("visibilitychange", function () { if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = 0; } } else wake(); });

    /* ---- load dataset, then show the menu ---- */
    var CASES = null;
    function ready() { renderMenu(); }
    try {
      var p = Site.data && Site.data("rop-cases");
      if (p && p.then) p.then(function (d) { CASES = d && Array.isArray(d.cases) ? d.cases : null; ready(); }, ready);
      else ready();
    } catch (e) { ready(); }
  }, "404 case game");
})();
