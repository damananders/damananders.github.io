/* Site audio: optional UI sounds on every page and the waves-and-wind soundscape on the hub.
 * (overview in assets/README.md, the soundscape button's styles in audio.css)
 *
 * Everything is synthesised live with the Web Audio API. Nothing is downloaded: no audio files, no samples.
 * Everything is OFF until the visitor turns it on, and quiet when it is on:
 *
 *   UI sounds    Site.registerSfx(play): short soft sine blips for tap, hover, open, close, toggle, copy,
 *                toast, error, success, nav. Pref "sfx", switch features.uiSounds.
 *   soundscape   hub only, one per site skin (assets/seasons.js). Pref "soundscape", switch features.soundscape.
 *                A header button (order 30) and a settings row toggle it.
 *                  classic  ocean swells and an airy wind
 *                  fall     a light breeze, and dry leaves rustling down now and then
 *                  winter   a crackling fire, and every so often a bell that rings twice
 *                  spring   a slow violin-like line over a light breeze
 *                  summer   a light sizzle and a low hum
 *   volume       pref "volume" (0..1) drives both, live.
 *
 * Browsers only allow sound after a click, tap or key press, so no AudioContext is created before one.
 * A returning visitor who left the soundscape on sees the button "armed"; it starts on their first press.
 * If this file never loads, the site is simply silent.
 */
(function () {
  "use strict";
  if (!window.Site) return;

  var Site = window.Site, el = Site.el;
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;                                  /* no Web Audio: no sound controls at all */

  var PEAK = 0.28;                                  /* hard ceiling of anything this file sends to the speakers */

  function feat(name) { var f = (Site.config && Site.config.features) || {}; return f[name] !== false; }
  function volume() { var v = parseFloat(Site.pref("volume")); if (isNaN(v)) v = 0.3; return Math.max(0, Math.min(1, v)); }
  /* Slider position -> gain. A gentle curve so the default (30%) is clearly audible and 100% is still modest. */
  function level(v) { return v <= 0 ? 0 : Math.pow(v, 0.75); }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* Soft limiter: transparent at normal levels, never lets a sample past PEAK. */
  var limiterCurve = null;
  function limiter(ctx) {
    if (!limiterCurve) {
      var n = 2049, c = new Float32Array(n), i, x;
      for (i = 0; i < n; i++) { x = (i / (n - 1)) * 2 - 1; c[i] = PEAK * Math.tanh(x / PEAK); }
      limiterCurve = c;
    }
    var ws = ctx.createWaveShaper(); ws.curve = limiterCurve; return ws;
  }

  /* ---- has the visitor pressed anything yet? (browsers block audio until they have) ---- */
  var pressed = false, onPress = [];
  function activated() {
    if (pressed) return true;
    try { if (navigator.userActivation && navigator.userActivation.hasBeenActive) pressed = true; } catch (e) {}
    return pressed;
  }
  function press(e) {
    if (e && e.isTrusted === false) return;
    pressed = true;
    for (var i = 0; i < onPress.length; i++) { try { onPress[i](e); } catch (err) {} }
  }
  ["pointerdown", "pointerup", "touchend", "keydown", "click"].forEach(function (type) {
    document.addEventListener(type, press, { capture: true, passive: true });
  });

  /* ================================================================================================
     UI sounds
     ================================================================================================ */
  var sfxOn = feat("uiSounds");
  var playSample = function () {};

  Site.ready(function () {
    if (!sfxOn) return;

    var ctx = null, out = null, idleTimer = 0, last = {}, lastAny = 0, voices = 0;
    var SFX_GAIN = 0.6;                              /* loudest voice is 0.3, so 0.18 at full volume */

    function ensure() {
      if (ctx && ctx.state !== "closed") return ctx;
      ctx = null;
      if (!activated()) return null;                 /* never create a context before a gesture */
      try {
        ctx = new AC({ latencyHint: "interactive" });
        out = ctx.createGain(); out.gain.value = level(volume()) * SFX_GAIN;
        var lim = limiter(ctx); out.connect(lim); lim.connect(ctx.destination);
      } catch (e) { ctx = null; }
      return ctx;
    }
    function rest() {                                /* an idle context is suspended so it costs nothing */
      clearTimeout(idleTimer);
      idleTimer = setTimeout(function () { if (ctx && ctx.state === "running" && !voices) { try { ctx.suspend(); } catch (e) {} } }, 20000);
    }

    /* One soft voice: sine (or triangle) with a short attack and an exponential tail. f2 glides the pitch. */
    function tone(t, f, dur, peak, o) {
      o = o || {};
      var osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = o.type || "sine";
      osc.frequency.setValueAtTime(f, t);
      if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + (o.attack || 0.006));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g); g.connect(out);
      voices++; osc.onended = function () { voices = Math.max(0, voices - 1); try { g.disconnect(); } catch (e) {} };
      osc.start(t); osc.stop(t + dur + 0.02);
    }

    /* One family: a pentatonic set of sine blips (A major pentatonic around A5). */
    var SOUNDS = {
      tap:     function (t) { tone(t, 740, 0.05, 0.22, { f2: 587 }); },
      hover:   function (t) { tone(t, 1480, 0.028, 0.07); },
      open:    function (t) { tone(t, 587, 0.07, 0.2); tone(t + 0.05, 880, 0.09, 0.2); },
      close:   function (t) { tone(t, 880, 0.06, 0.18); tone(t + 0.05, 587, 0.09, 0.18); },
      toggle:  function (t) { tone(t, 988, 0.06, 0.2, { type: "triangle" }); },
      copy:    function (t) { tone(t, 1175, 0.04, 0.17); tone(t + 0.055, 1480, 0.06, 0.17); },
      toast:   function (t) { tone(t, 740, 0.09, 0.16); tone(t + 0.02, 1109, 0.11, 0.08); },
      error:   function (t) { tone(t, 330, 0.1, 0.26, { type: "triangle" }); tone(t + 0.09, 247, 0.14, 0.26, { type: "triangle" }); },
      success: function (t) { tone(t, 740, 0.07, 0.18); tone(t + 0.06, 988, 0.07, 0.18); tone(t + 0.12, 1480, 0.12, 0.18); },
      nav:     function (t) { tone(t, 494, 0.1, 0.2, { f2: 988, attack: 0.012 }); }
    };

    function play(name) {
      if (!SOUNDS[name] || document.hidden) return;
      if (Site.pref("sfx") !== true || volume() <= 0) return;
      var now = Date.now();
      if (last[name] && now - last[name] < 70) return;             /* the same sound twice in one breath */
      if (name === "hover" && now - lastAny < 90) return;          /* hover never talks over anything */
      if (voices > 8) return;
      var c = ensure(); if (!c) return;
      last[name] = lastAny = now;
      function go() { if (c !== ctx || c.state !== "running") return; try { SOUNDS[name](c.currentTime + 0.012); } catch (e) {} rest(); }
      if (c.state === "running") go();
      else { try { var p = c.resume(); if (p && p.then) p.then(go, function () {}); } catch (e) {} }
    }
    playSample = play;
    Site.registerSfx(play);

    Site.on("pref:volume", function () {
      if (ctx && out && ctx.state !== "closed") { try { out.gain.setTargetAtTime(level(volume()) * SFX_GAIN, ctx.currentTime, 0.02); } catch (e) {} }
    });
    Site.on("pref:sfx", function (v) {
      if (v === true) { play("success"); last.toggle = Date.now(); }   /* a sample, so the visitor hears what they turned on */
      else if (ctx) { try { ctx.close(); } catch (e) {} ctx = null; out = null; voices = 0; }
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && ctx && ctx.state === "running") { try { ctx.suspend(); } catch (e) {} }
    });
    window.addEventListener("pagehide", function () { if (ctx) { try { ctx.close(); } catch (e) {} ctx = null; out = null; voices = 0; } });

    Site.settings.register({ id: "sfx", label: "UI Sounds", type: "toggle", pref: "sfx", order: 40 });
  }, "audio:sfx");

  /* ================================================================================================
     Hub soundscape: ocean swells and wind
     ================================================================================================ */
  var scapeOn = Site.page === "hub" && feat("soundscape");

  Site.ready(function () {
    if (!scapeOn) return;

    var FADE = 1.5, BED_GAIN = 0.55;
    var ctx = null, master = null, parts = null, driftTimer = 0, closeTimer = 0, checkTimer = 0;
    var fade = { from: 0, to: 0, t0: 0, t1: 0 };     /* the ramp currently scheduled on master.gain */
    var btn = null, live = null, state = "off", announced = false;

    var SKINS = { classic: "waves and wind", fall: "a light breeze and falling leaves", winter: "a crackling fire and a bell", spring: "a soft violin and a light breeze", summer: "a light sizzle and a low hum" };
    var skin = "classic";
    function skinNow() { var k = Site.skin ? Site.skin() : "classic"; return SKINS[k] ? k : "classic"; }
    function want() { return Site.pref("soundscape") === true; }
    function target() { return level(volume()) * BED_GAIN; }

    /* ---- noise: 8 seconds of stereo pink noise, the loop seam cross-faded so it never clicks ---- */
    function pinkBuffer(c) {
      var sr = c.sampleRate, len = Math.floor(sr * 8), xf = 4096, buf = c.createBuffer(2, len, sr);
      for (var ch = 0; ch < 2; ch++) {
        var d = buf.getChannelData(ch), tmp = new Float32Array(len + xf);
        var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, w, i, k;
        for (i = 0; i < len + xf; i++) {             /* Paul Kellet's pink filter */
          w = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
          tmp[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
        }
        for (i = 0; i < len; i++) d[i] = tmp[i];
        for (i = 0; i < xf; i++) { k = i / xf; d[i] = tmp[i] * k + tmp[len + i] * (1 - k); }
      }
      return buf;
    }

    /* ---- the graph. Slow sine LFOs at unrelated, randomised rates stand in for the sea's irregular rhythm. ---- */
    function build(c, dest, kind) {
      var buf = pinkBuffer(c), nodes = [], srcs = [], timers = [], dead = false, t = c.currentTime + 0.02;
      /* call fn every so often (between a and b ms) while this soundscape is alive and can be heard */
      function every(a, b, fn, first) {
        var id = { t: 0 };
        function go(ms) { id.t = setTimeout(function () { if (dead) return; if (!document.hidden && c.state === "running") { try { fn(); } catch (e) {} } go(rnd(a, b)); }, ms); }
        timers.push(id); go(first == null ? rnd(a, b) : first);
      }
      /* a loop of sparse clicks and pops (fire, frying): per second, `small` tiny ticks and `big` louder snaps */
      function popBuffer(secs, small, big) {
        var sr = c.sampleRate, len = Math.floor(sr * secs), b = c.createBuffer(1, len, sr), d = b.getChannelData(0), n, i, k, at, dur, amp;
        function burst(count, a0, a1, d0, d1) {
          for (n = 0; n < count; n++) {
            at = Math.floor(Math.random() * (len - 2000)); dur = Math.floor(sr * rnd(d0, d1)); amp = rnd(a0, a1);
            for (i = 0; i < dur; i++) { k = 1 - i / dur; d[at + i] += (Math.random() * 2 - 1) * amp * k * k; }
          }
        }
        burst(Math.round(small * secs), 0.08, 0.3, 0.001, 0.004); burst(Math.round(big * secs), 0.4, 0.95, 0.003, 0.014);
        return b;
      }
      function loop(buffer, rate) { var s2 = keep(c.createBufferSource()); s2.buffer = buffer; s2.loop = true; s2.playbackRate.value = rate || 1; s2.start(t); srcs.push(s2); return s2; }
      function keep(n) { nodes.push(n); return n; }
      function noise(rate) {
        var s = keep(c.createBufferSource()); s.buffer = buf; s.loop = true; s.playbackRate.value = rate;
        s.start(t, Math.random() * 7); srcs.push(s); return s;
      }
      function filter(type, f, q) { var n = keep(c.createBiquadFilter()); n.type = type; n.frequency.value = f; n.Q.value = q; return n; }
      function gain(v) { var n = keep(c.createGain()); n.gain.value = v; return n; }
      function lfo(hz, depth, param) {
        var o = keep(c.createOscillator()), g = gain(depth);
        o.type = "sine"; o.frequency.value = hz; o.connect(g); g.connect(param); o.start(t); srcs.push(o); return o;
      }
      function chain() { for (var i = 0; i < arguments.length - 1; i++) arguments[i].connect(arguments[i + 1]); return arguments[arguments.length - 1]; }

      /* swell: low-passed noise whose loudness and brightness rise and fall together, plus a little foam on the crest */
      function swell(rate, hzA, hzB, lvl, cutoff) {
        var lp = filter("lowpass", cutoff, 0.4), g = gain(lvl * 0.5);
        chain(noise(rate), lp, g, dest);
        lfo(hzA, lvl * 0.27, g.gain); lfo(hzB, lvl * 0.18, g.gain);
        lfo(hzA, cutoff * 0.42, lp.frequency); lfo(hzB, cutoff * 0.25, lp.frequency);
        var bp = filter("bandpass", 2600, 0.5), fg = gain(lvl * 0.11);
        chain(noise(rate * 1.31), bp, fg, dest);
        lfo(hzA, lvl * 0.065, fg.gain); lfo(hzB, lvl * 0.04, fg.gain);
      }
      /* wind: a wide, low-Q band of air that wanders. Low Q keeps it from whistling. Every skin but summer has some. */
      var wbp = null, wind = null, windLvl = 0, rumble = null;
      function breeze(lvl, centre) {
        windLvl = lvl; wbp = filter("bandpass", centre, 0.55); wind = gain(lvl);
        chain(noise(1.19), wbp, filter("highpass", 180, 0.5), wind, dest);
        lfo(rnd(0.028, 0.045), centre * 0.29, wbp.frequency); lfo(rnd(0.075, 0.1), centre * 0.13, wbp.frequency);
        lfo(rnd(0.035, 0.055), lvl * 0.35, wind.gain); lfo(rnd(0.09, 0.12), lvl * 0.17, wind.gain);
      }
      /* a one-shot voice: an oscillator with its own envelope, cleaned up when it ends */
      function tone(type, hz, at, peak, attack, hold, release, into) {
        var o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = hz;
        g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(peak, at + attack);
        if (hold > 0) g.gain.setValueAtTime(peak, at + attack + hold);
        g.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + release);
        o.connect(g); g.connect(into || dest); o.start(at); o.stop(at + attack + hold + release + 0.05);
        o.onended = function () { try { o.disconnect(); g.disconnect(); } catch (e) {} };
        return o;
      }

      /* the season beds are thinner than the sea, so they get a lift to sit at about the same loudness */
      var TRIM = { fall: 2.8, winter: 2.3, spring: 2.6, summer: 2.2 };
      if (TRIM[kind]) { var trim = gain(TRIM[kind]); trim.connect(dest); dest = trim; }

      if (kind === "fall") {
        /* a light breeze, and dry leaves coming down: short papery flutters, a few at a time */
        breeze(0.34, 480);
        var leafBp = filter("bandpass", 3800, 0.9), leafHp = filter("highpass", 1500, 0.5), leaves = gain(0);
        chain(noise(1.63), leafBp, leafHp, leaves, dest);
        every(2200, 6500, function () {
          var at = c.currentTime + 0.05, n = 2 + Math.floor(Math.random() * 5), peak = rnd(0.07, 0.16);
          leafBp.frequency.setValueAtTime(rnd(2800, 5200), at);
          for (var i = 0; i < n; i++) {
            var d = rnd(0.035, 0.09), a = peak * rnd(0.4, 1);
            leaves.gain.setValueAtTime(0.0001, at); leaves.gain.linearRampToValueAtTime(a, at + d * 0.3); leaves.gain.linearRampToValueAtTime(0.0001, at + d);
            at += d + rnd(0.02, 0.16);
          }
        }, 1500);
      } else if (kind === "winter") {
        /* a fire: a warm low body that flickers, a little hiss, and a loop of crackles and snaps */
        var body = gain(0.3), hiss = gain(0.035), crack = gain(0.5);
        chain(noise(0.62), filter("lowpass", 240, 0.6), body, dest);
        lfo(rnd(0.3, 0.5), 0.07, body.gain); lfo(rnd(1.1, 1.7), 0.05, body.gain); lfo(rnd(2.6, 3.4), 0.03, body.gain);
        chain(noise(1.4), filter("bandpass", 1300, 0.4), hiss, dest);
        chain(loop(popBuffer(7, 9, 1.6), 1), filter("highpass", 420, 0.5), filter("lowpass", 5200, 0.5), crack, dest);
        chain(loop(popBuffer(5, 5, 0.7), 0.83), filter("bandpass", 1900, 0.7), gain(0.3), dest);
        breeze(0.05, 420);
        /* the bell: every so often it rings twice. A struck-bell stack of partials, each fading at its own pace. */
        var bellOut = gain(1), echo = keep(c.createDelay(1)), fb = gain(0.28), wet = gain(0.35);
        echo.delayTime.value = 0.31; bellOut.connect(dest); chain(bellOut, echo, wet, dest); chain(echo, fb, echo);
        every(22000, 45000, function () {
          var f0 = rnd(500, 560), at0 = c.currentTime + 0.05, gap = rnd(0.85, 1.05);
          [0, gap].forEach(function (off, strike) {
            [[0.5, 0.05, 4.2], [1, 0.12, 3.4], [1.19, 0.06, 2.6], [1.56, 0.035, 2.0], [2, 0.05, 1.7], [2.51, 0.028, 1.2], [3.01, 0.02, 0.9], [4.1, 0.012, 0.6]].forEach(function (pt) {
              tone("sine", f0 * pt[0], at0 + off, pt[1] * (strike ? 0.85 : 1), 0.004, 0, pt[2], bellOut);
            });
          });
        }, rnd(5000, 9000));
      } else if (kind === "spring") {
        /* a light breeze under a slow bowed line: a saw through a body filter, with vibrato and a soft echo */
        breeze(0.2, 560);
        var fid = gain(1), bodyLp = filter("lowpass", 2300, 0.7), bodyPk = filter("peaking", 2700, 1.2), room = keep(c.createDelay(1)), roomFb = gain(0.34), roomWet = gain(0.42);
        bodyPk.gain.value = 5; room.delayTime.value = 0.27;
        chain(fid, bodyLp, bodyPk, dest); chain(bodyPk, room, roomWet, dest); chain(room, roomFb, room);
        var SCALE = [293.66, 329.63, 392, 440, 493.88, 587.33, 659.25, 783.99], pos = 3;   /* D4 E4 G4 A4 B4 D5 E5 G5 */
        function bow(hz, at, len, peak) {
          var o = tone("sawtooth", hz, at, peak, Math.min(0.45, len * 0.3), len * 0.4, len * 0.55, fid);
          var v = c.createOscillator(), vg = c.createGain(); v.frequency.value = rnd(5.1, 5.9); vg.gain.setValueAtTime(0, at); vg.gain.linearRampToValueAtTime(hz * 0.006, at + len * 0.5);
          v.connect(vg); vg.connect(o.frequency); v.start(at); v.stop(at + len * 1.3 + 0.1);
          v.onended = function () { try { v.disconnect(); vg.disconnect(); } catch (e) {} };
        }
        every(5500, 11000, function () {                    /* a short phrase of three to five notes, then rest */
          var at = c.currentTime + 0.1, n = 3 + Math.floor(Math.random() * 3);
          for (var i = 0; i < n; i++) {
            pos = Math.max(0, Math.min(SCALE.length - 1, pos + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
            var len = rnd(1.5, 2.9);
            bow(SCALE[pos], at, len, 0.05);
            if (Math.random() < 0.3) bow(SCALE[Math.max(0, pos - 2)] / 2, at, len, 0.028);
            at += len * 0.8;
          }
        }, 1200);
      } else if (kind === "summer") {
        /* something frying: a thin bright hiss that never sits still, tiny pops, and a low electric hum */
        var fry = gain(0.035), pops = gain(0.34), wob = keep(c.createBufferSource()), wb = c.createBuffer(1, Math.floor(c.sampleRate * 3), c.sampleRate), wd = wb.getChannelData(0), v0 = 0;
        for (var wi = 0; wi < wd.length; wi++) { if (wi % 420 === 0) v0 = Math.random() * 2 - 1; wd[wi] = wd[wi - 1] ? wd[wi - 1] * 0.992 + v0 * 0.008 : v0 * 0.008; }
        chain(noise(2.1), filter("highpass", 4200, 0.5), fry, dest);
        var wg = gain(0.09); wob.buffer = wb; wob.loop = true; wob.connect(wg); wg.connect(fry.gain); wob.start(t); srcs.push(wob);
        chain(loop(popBuffer(6, 34, 2.2), 1), filter("highpass", 2600, 0.6), pops, dest);
        chain(loop(popBuffer(4, 22, 0.8), 1.21), filter("bandpass", 5200, 0.8), gain(0.2), dest);
        var hum = gain(0.5);
        hum.connect(dest); lfo(rnd(0.05, 0.09), 0.06, hum.gain);
        [[60, 0.085], [120, 0.05], [180, 0.014], [240, 0.006]].forEach(function (h) { var o = keep(c.createOscillator()), g = gain(h[1]); o.type = "sine"; o.frequency.value = h[0]; chain(o, g, hum); o.start(t); srcs.push(o); });
      } else {
        /* classic: the sea */
        swell(1, rnd(0.07, 0.095), rnd(0.115, 0.15), 1, 620);
        swell(0.84, rnd(0.05, 0.065), rnd(0.16, 0.2), 0.7, 880);
        rumble = gain(0.55);                                /* the deep, steady body of the sea */
        chain(noise(0.71), filter("lowpass", 140, 0.5), rumble, dest);
        lfo(rnd(0.021, 0.034), 0.16, rumble.gain);
        breeze(0.2, 520);
      }

      return {
        /* every so often the wind drifts to a slightly different strength and colour, very slowly */
        drift: function () {
          try {
            if (wind) { wind.gain.setTargetAtTime(windLvl * rnd(0.7, 1.35), c.currentTime, 3.5); wbp.frequency.setTargetAtTime(rnd(400, 700), c.currentTime, 4); }
            if (rumble) rumble.gain.setTargetAtTime(rnd(0.45, 0.62), c.currentTime, 4);
          } catch (e) {}
        },
        stop: function () {
          dead = true; timers.forEach(function (id) { clearTimeout(id.t); }); timers = [];
          srcs.forEach(function (s) { try { s.stop(); } catch (e) {} });
          nodes.forEach(function (n) { try { n.disconnect(); } catch (e) {} });
          nodes = []; srcs = [];
        }
      };
    }

    /* ---- fades (the value mid-ramp is tracked here, so a fade can be turned around cleanly) ---- */
    function gainNow() {
      if (!ctx) return 0; var t = ctx.currentTime;
      if (t >= fade.t1) return fade.to; if (t <= fade.t0) return fade.from;
      return fade.from + (fade.to - fade.from) * (t - fade.t0) / (fade.t1 - fade.t0);
    }
    function rampTo(v, secs) {
      if (!ctx || !master) return;
      var t = ctx.currentTime, from = gainNow();
      try {
        master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(from, t); master.gain.linearRampToValueAtTime(v, t + secs);
      } catch (e) {}
      fade = { from: from, to: v, t0: t, t1: t + secs };
    }

    function driftLoop() {
      clearTimeout(driftTimer);
      driftTimer = setTimeout(function () {
        if (!ctx || !parts || document.hidden) return;
        parts.drift(); driftLoop();
      }, rnd(7000, 12000));
    }

    /* the visitor (or the calendar) changed skin: dip, swap the whole soundscape, come back up */
    var swapTimer = 0;
    function reskin() {
      var k = skinNow(); paint();
      if (k === skin || !ctx || !parts) { skin = ctx ? skin : k; return; }
      skin = k; clearTimeout(swapTimer);
      rampTo(0, 0.35);
      swapTimer = setTimeout(function () {
        if (!ctx || !master) return;
        try { parts.stop(); parts = build(ctx, master, skin); } catch (e) { console.error("[site] soundscape", e); return; }
        if (want() && !document.hidden) rampTo(target(), 0.9);
      }, 400);
    }

    function teardown() {
      clearTimeout(closeTimer); clearTimeout(swapTimer); clearTimeout(driftTimer); clearTimeout(checkTimer);
      if (parts) { parts.stop(); parts = null; }
      if (master) { try { master.disconnect(); } catch (e) {} master = null; }
      ana = null;
      if (ctx) { var c = ctx; ctx = null; c.onstatechange = null; try { c.close(); } catch (e) {} }
      fade = { from: 0, to: 0, t0: 0, t1: 0 };
    }

    function start() {
      clearTimeout(closeTimer);
      if (!ctx) {
        if (!activated()) return;                    /* armed: wait for the first press */
        try {
          ctx = new AC({ latencyHint: "playback" });
          master = ctx.createGain(); master.gain.value = 0;
          var lim = limiter(ctx); master.connect(lim); lim.connect(ctx.destination);
          try { ana = ctx.createAnalyser(); ana.fftSize = 256; ana.smoothingTimeConstant = 0.86; master.connect(ana); anaBuf = new Uint8Array(ana.fftSize); } catch (e2) { ana = null; }
          skin = skinNow(); parts = build(ctx, master, skin);
          ctx.onstatechange = paint;
        } catch (e) { console.error("[site] soundscape", e); teardown(); return; }
      }
      if (ctx.state !== "running") { try { var p = ctx.resume(); if (p && p.then) p.then(paint, function () {}); } catch (e) {} }
      rampTo(target(), FADE);
      driftLoop();
      clearTimeout(checkTimer); checkTimer = setTimeout(paint, 400);
    }
    /* fade out, then either close everything (turned off) or just suspend (tab hidden) */
    function stop(suspendOnly) {
      clearTimeout(driftTimer);
      if (!ctx) return;
      if (ctx.state !== "running") { if (!suspendOnly) teardown(); return; }
      rampTo(0, FADE);
      clearTimeout(closeTimer);
      closeTimer = setTimeout(function () {
        if (!ctx) return;
        if (suspendOnly) { try { ctx.suspend(); } catch (e) {} } else teardown();
        paint();
      }, FADE * 1000 + 120);
    }

    /* Sound-reactive accent (idea #49): while the soundscape plays, its loudness drives --sx-pulse (0..1) on
       <html>, which hub.css turns into a soft swell of the accent glow. Skipped when motion is reduced. */
    var ana = null, anaBuf = null, pulseRaf = 0, pulseV = 0;
    function pulse() {
      pulseRaf = 0;
      var rootEl = document.documentElement;
      if (!ana || !ctx || ctx.state !== "running" || !want() || document.hidden || Site.reducedMotion) { rootEl.style.removeProperty("--sx-pulse"); rootEl.removeAttribute("data-au-pulse"); return; }
      ana.getByteTimeDomainData(anaBuf);
      var sum = 0; for (var i = 0; i < anaBuf.length; i++) { var d = (anaBuf[i] - 128) / 128; sum += d * d; }
      var rms = Math.sqrt(sum / anaBuf.length), v = Math.max(0, Math.min(1, rms * 9));
      pulseV += (v - pulseV) * 0.12;
      rootEl.style.setProperty("--sx-pulse", pulseV.toFixed(3)); rootEl.setAttribute("data-au-pulse", "");
      pulseRaf = requestAnimationFrame(pulse);
    }
    function pulseKick() { if (!pulseRaf) pulseRaf = requestAnimationFrame(pulse); }

    function sync() {
      if (want() && !document.hidden) start();
      else stop(want());
      paint();
    }

    /* ---- the button ---- */
    function paint() {
      var w = want(), playing = w && !!ctx && ctx.state === "running" && !document.hidden;
      var s = !w ? "off" : playing ? "on" : "armed";
      if (btn) {
        btn.setAttribute("aria-pressed", String(w));
        btn.setAttribute("data-au-state", s);
        btn.title = s === "on" ? "Turn the soundscape off" : s === "armed" ? "Soundscape is on. It starts when you click or press a key." : "Turn on the soundscape: " + SKINS[skinNow()];
      }
      if (live && s !== state && announced && s !== "armed") live.textContent = s === "on" ? "Soundscape playing" : "Soundscape off";
      state = s;
      pulseKick();
    }

    var tools = Site.tools();
    if (tools) {
      btn = el("button", { type: "button", class: "sx-iconbtn au-btn", style: { order: "30" }, "aria-label": "Soundscape", "aria-pressed": "false", "data-au-state": "off" },
        Site.svg('<path d="M2.5 9.5c2.4-2.9 4.7-2.9 7.1 0s4.7 2.9 7.1 0c1.6-1.9 3.2-2.5 4.8-1.9"/><path d="M2.5 15.5c2.4-2.9 4.7-2.9 7.1 0s4.7 2.9 7.1 0c1.6-1.9 3.2-2.5 4.8-1.9"/>', { class: "au-ico" }),
        el("span", { class: "au-bars", "aria-hidden": "true" }, el("i"), el("i"), el("i"), el("i")));
      btn.addEventListener("click", function () {
        announced = true;
        Site.setPref("soundscape", !want());
        Site.sfx("toggle");
      });
      tools.appendChild(btn);
      live = el("span", { class: "sx-sr au-live", role: "status", "aria-live": "polite" });
      tools.appendChild(live);
    }

    Site.on("pref:soundscape", function () { announced = true; sync(); });
    Site.on("skin", reskin);
    Site.on("pref:volume", function () {
      if (ctx && master && want() && !document.hidden) rampTo(target(), 0.12);
    });
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pagehide", function () { teardown(); paint(); });
    window.addEventListener("pageshow", function (e) { if (e.persisted) sync(); });
    /* armed, or the browser refused to start: try again on the next press */
    onPress.push(function (e) {
      var t = e && e.target;                         /* a press on the button itself is the visitor switching it off */
      if (btn && t && t.nodeType === 1 && btn.contains(t)) return;
      if (want() && !document.hidden && (!ctx || ctx.state !== "running")) { start(); paint(); }
    });

    Site.settings.register({
      id: "soundscape", label: "Hub Soundscape",
      hint: function () { var k = SKINS[skinNow()]; return k.charAt(0).toUpperCase() + k.slice(1) + ", generated in your browser. It changes with the site skin."; },
      type: "toggle", pref: "soundscape", pages: ["hub"], order: 50
    });

    sync();
  }, "audio:soundscape");

  /* ================================================================================================
     Volume row (shared by both)
     ================================================================================================ */
  Site.ready(function () {
    if (!sfxOn && !scapeOn) return;
    var t = 0;
    Site.on("pref:volume", function () {              /* a sample blip once the slider comes to rest */
      clearTimeout(t); t = setTimeout(function () { playSample("tap"); }, 90);
    });
    Site.settings.register({
      id: "volume", label: "Volume", type: "range", pref: "volume", min: 0, max: 1, step: 0.05, order: 60,
      hint: function () {
        var any = (sfxOn && Site.pref("sfx") === true) || (scapeOn && Site.pref("soundscape") === true);
        return any ? "" : "Nothing is making sound yet. Turn one of the sounds on to hear it.";
      }
    });
  }, "audio:volume");
})();
