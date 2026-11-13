/* Masarain in the field: page builder and motion engine.
   Text and numbers come only from window.CONTENT (js/content.js, generated from content.json).
   The story clock is adapted from mockup 1 (redo_mockups/opt1_split_screen/story.js); the beams, packets, and tape
   from mockup 3. Every timing below is illustrative and is never shown on the page. */
(function () {
  "use strict";
  var CT = window.CONTENT, I = window.ISO, SCENES = window.SCENES, C = I.C, mk = I.mk, attr = I.attr;
  if (!CT || !I || !SCENES) return;

  var VB = { x: -175, y: -128, w: 510, h: 373 };
  var TILE = { x: 198, y: -120, w: 128, h: 80 };
  /* beams end at the bottom-left corner of the call tile; the state tag sits under the tile, right-aligned,
     so no beam rising from a mast below the tile runs behind it */
  var FAR = [TILE.x, TILE.y + TILE.h - 1];
  var KEY = 7.4;
  /* story beats in seconds of one loop (illustrative, not measured, never displayed) */
  var BASE_T = { risk: 2.6, riskFull: 4.4, copies: 3.8, drop: 5.8, move: 6.3, baseSwitch: 8.8, aBack: 9.4, aHealthy: 10.2,
    ret: 12.0, retEnd: 12.8, L: 14.5, bDown0: null, bDown1: null };
  /* scene-specific beats: the home case has a short risky phase (its gain is faster detection);
     on the desert road the ridge briefly blocks the satellite while the cell is fading */
  var OVER = { "EV-1": { risk: 5.0, riskFull: 5.6, copies: 5.3 }, "DS-1": { bDown0: 4.5, bDown1: 5.1 } };
  var TXT = { today: "Today: switch after failure", mas: "With Masarain", playing: "Playing", frozen: "Frozen",
    pause: "Pause", play: "Play", timing: "Motion timing is illustrative.", fit: "Fit: ", todayBar: "Today", masBar: "Masarain" };

  var reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { reduce = false; }
  var q = {};
  location.search.replace(/[?&]([^=&]+)=([^&]*)/g, function (m, k, v) { q[k] = decodeURIComponent(v); });

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function ease(u) { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); }

  /* ---------------------------------------------------------------- story */
  function Story(over) {
    var T = {}, k;
    for (k in BASE_T) T[k] = BASE_T[k];
    if (over) for (k in over) T[k] = over[k];
    function wrap(t) { t = t % T.L; return t < 0 ? t + T.L : t; }
    function state(t) {
      t = wrap(t);
      var s = { t: t };
      if (t < T.risk) s.cov = 1;
      else if (t < T.riskFull) s.cov = 1 - 0.72 * ease((t - T.risk) / (T.riskFull - T.risk));
      else if (t < T.drop) s.cov = 0.28 + 0.05 * Math.sin(t * 14);
      else if (t < T.aBack) s.cov = 0;
      else if (t < T.aHealthy) s.cov = 0.25 + 0.75 * ease((t - T.aBack) / (T.aHealthy - T.aBack));
      else s.cov = 1;
      s.risk = t < T.risk ? 0 : t < T.riskFull ? ease((t - T.risk) / (T.riskFull - T.risk)) : t < T.aBack ? 1 :
        t < T.aHealthy ? 1 - ease((t - T.aBack) / (T.aHealthy - T.aBack)) : 0;
      s.aUp = !(t >= T.drop && t < T.aBack);
      s.bUp = !(T.bDown0 != null && t >= T.bDown0 && t < T.bDown1);
      s.copies = t >= T.copies && t < T.move;
      s.mas = t < T.move ? "A" : t < T.ret ? "B" : t < T.retEnd ? "AB" : "A";
      s.base = t < T.drop ? "A" : t < T.baseSwitch ? "none" : "B";
      s.frozen = t >= T.drop && t < T.baseSwitch;
      return s;
    }
    return { T: T, wrap: wrap, state: state };
  }

  /* packets in flight at time t. who = "mas" (Masarain) or "base" (today: switch after failure).
     kind: pk (packet), cp (hollow copy), pb (probe), ack; u = 0..1 along the path */
  function flows(story, t, who, travel, step) {
    var out = [], t0 = Math.ceil((t - travel) / step) * step;
    for (var n = 0; ; n++) {
      var te = t0 + n * step;
      if (te > t + 1e-9) break;
      var u = (t - te) / travel, s = story.state(te), k = Math.round(te / step);
      if (who === "mas") {
        if (s.mas !== "B") out.push({ p: "A", kind: "pk", lost: !s.aUp, u: u });
        if (s.mas !== "A") out.push({ p: "B", kind: "pk", lost: !s.bUp, u: u });
        if (s.copies) out.push({ p: "B", kind: "cp", lost: !s.bUp, u: u });
        if (k % 3 === 0) {
          if (s.mas === "A" && !s.copies) out.push({ p: "B", kind: "pb", lost: !s.bUp, u: u });
          if (s.mas === "B") out.push({ p: "A", kind: "pb", lost: !s.aUp, u: u });
        }
        if (k % 2 === 1 && s.mas !== "B" && s.aUp) out.push({ p: "A", kind: "ack", u: u });
        if (k % 2 === 1 && s.mas === "B" && s.bUp) out.push({ p: "B", kind: "ack", u: u });
      } else {
        if (s.base !== "B") out.push({ p: "A", kind: "pk", lost: !s.aUp, u: u });
        else out.push({ p: "B", kind: "pk", lost: !s.bUp, u: u });
        if (k % 2 === 1 && s.base === "A" && s.aUp) out.push({ p: "A", kind: "ack", u: u });
        if (k % 2 === 1 && s.base === "B" && s.bUp) out.push({ p: "B", kind: "ack", u: u });
      }
    }
    return out;
  }

  /* polyline with cumulative lengths */
  function Poly(pts) {
    var cum = [0], tot = 0;
    for (var i = 1; i < pts.length; i++) { tot += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); cum.push(tot); }
    return {
      pts: pts, tot: tot,
      at: function (u) {
        var d = clamp(u, 0, 1) * tot, j = 1;
        while (j < cum.length - 1 && cum[j] < d) j++;
        var a = pts[j - 1], b = pts[j], seg = cum[j] - cum[j - 1] || 1, f = (d - cum[j - 1]) / seg;
        return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      },
      frac: function (seg, f) {
        seg = Math.min(seg, pts.length - 2);
        return tot ? (cum[seg] + (cum[seg + 1] - cum[seg]) * f) / tot : 0.5;
      },
      str: function () { return pts.map(I.xy).join(" "); }
    };
  }

  /* ---------------------------------------------------------------- DOM helpers */
  function h(tag, cls, text, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function add(p) { for (var i = 1; i < arguments.length; i++) if (arguments[i]) p.appendChild(arguments[i]); return p; }
  function num(v) { return parseFloat(String(v).replace(/,/g, "")); }
  var uid = 0;

  /* ---------------------------------------------------------------- call tile (the far end) */
  function makeTile(parent, defs, kind) {
    var id = "tc" + (++uid), w = TILE.w, hh = TILE.h;
    var cp = mk("clipPath", { id: id }, defs);
    mk("rect", { width: w, height: hh, rx: 2 }, cp);
    var g = mk("g", { transform: "translate(" + TILE.x + "," + TILE.y + ")" }, parent);
    var inner = mk("g", { "clip-path": "url(#" + id + ")" }, g);
    mk("rect", { width: w, height: hh, fill: "#17191C" }, inner);
    var parts = {};
    if (kind === "person" || kind === "class") {
      if (kind === "class") {
        mk("rect", { x: w * 0.08, y: hh * 0.12, width: w * 0.5, height: hh * 0.34, fill: "#2A2E2A", stroke: C.beige, "stroke-opacity": 0.3 }, inner);
        for (var r = 0; r < 3; r++) mk("line", { x1: w * 0.13, x2: w * (0.36 + r * 0.06), y1: hh * (0.2 + r * 0.08), y2: hh * (0.2 + r * 0.08), stroke: C.text3, "stroke-width": 1.2 }, inner);
      } else {
        mk("rect", { x: w * 0.6, y: hh * 0.14, width: w * 0.3, height: hh * 0.36, fill: "#22252A", stroke: C.beige, "stroke-opacity": 0.22 }, inner);
      }
      mk("line", { x1: 0, y1: hh * 0.74, x2: w, y2: hh * 0.74, stroke: C.beige, "stroke-opacity": 0.12 }, inner);
      var px = kind === "class" ? 0.62 : 0.42;
      var person = mk("g", {}, inner);
      mk("path", { d: "M" + (w * (px - 0.26)) + "," + (hh + 4) + " C" + (w * (px - 0.24)) + "," + (hh * 0.7) + " " + (w * (px - 0.12)) + "," + (hh * 0.62) + " " + (w * px) + "," + (hh * 0.62) +
        " C" + (w * (px + 0.12)) + "," + (hh * 0.62) + " " + (w * (px + 0.24)) + "," + (hh * 0.7) + " " + (w * (px + 0.26)) + "," + (hh + 4) + " Z", fill: "#3F4147", stroke: C.beige, "stroke-opacity": 0.3 }, person);
      mk("circle", { cx: w * px, cy: hh * 0.42, r: hh * 0.14, fill: "#5E5953", stroke: C.beige, "stroke-opacity": 0.35 }, person);
      parts.mouth = mk("line", { x1: w * (px - 0.03), x2: w * (px + 0.03), y1: hh * 0.48, y2: hh * 0.48, stroke: "#2A2A2A", "stroke-width": 1.6, "stroke-linecap": "round" }, person);
      parts.person = person;
      parts.bars = [];
      for (var i = 0; i < 6; i++) parts.bars.push(mk("rect", { x: w - 40 + i * 5.5, width: 3, fill: C.oliveLt }, inner));
    } else if (kind === "pylons" || kind === "posts") {
      mk("rect", { width: w, height: hh * 0.58, fill: "#202329" }, inner);
      mk("rect", { y: hh * 0.58, width: w, height: hh * 0.42, fill: "#2A2B26" }, inner);
      mk("line", { x1: 0, y1: hh * 0.58, x2: w, y2: hh * 0.58, stroke: C.beige, "stroke-opacity": 0.4 }, inner);
      parts.scroll = mk("g", {}, inner);
      var span = kind === "pylons" ? 64 : 22;
      parts.span = span;
      for (var x = 0; x < w + span * 2; x += span) {
        if (kind === "pylons") {
          mk("path", { d: "M" + (x - 6) + "," + (hh * 0.78) + " L" + x + "," + (hh * 0.26) + " L" + (x + 6) + "," + (hh * 0.78) + " M" + (x - 9) + "," + (hh * 0.34) + " L" + (x + 9) + "," + (hh * 0.34), fill: "none", stroke: C.pale, "stroke-width": 1.1 }, parts.scroll);
          mk("path", { d: "M" + (x - 9) + "," + (hh * 0.34) + " Q" + (x + span / 2 - 9) + "," + (hh * 0.44) + " " + (x + span - 9) + "," + (hh * 0.34), fill: "none", stroke: C.beige, "stroke-opacity": 0.6, "stroke-width": 0.7 }, parts.scroll);
        } else {
          mk("line", { x1: x, y1: hh * 0.5, x2: x, y2: hh * 0.74, stroke: C.pale, "stroke-width": 1.4 }, parts.scroll);
          mk("line", { x1: x, y1: hh * 0.56, x2: x + span, y2: hh * 0.56, stroke: C.beige, "stroke-opacity": 0.6, "stroke-width": 0.8 }, parts.scroll);
          mk("line", { x1: x, y1: hh * 0.66, x2: x + span, y2: hh * 0.66, stroke: C.beige, "stroke-opacity": 0.6, "stroke-width": 0.8 }, parts.scroll);
        }
      }
      mk("path", { d: "M" + (w / 2 - 7) + "," + (hh / 2) + " h14 M" + (w / 2) + "," + (hh / 2 - 7) + " v14", stroke: C.white, "stroke-opacity": 0.6, "stroke-width": 0.8 }, inner);
    } else {
      mk("line", { x1: 10, y1: hh * 0.55, x2: w - 10, y2: hh * 0.55, stroke: C.beige, "stroke-opacity": 0.18 }, inner);
      mk("path", { d: "M14," + (hh * 0.22) + " h6 l7,-6 v20 l-7,-6 h-6 Z", fill: C.pale, stroke: "none" }, inner);
      parts.wave = mk("polyline", { fill: "none", stroke: C.oliveLt, "stroke-width": 1.6, "stroke-linejoin": "round" }, inner);
    }
    var hid = "hz" + uid;
    var pat = mk("pattern", { id: hid, width: 7, height: 7, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
    mk("rect", { width: 2.5, height: 7, fill: "rgba(196,87,58,.42)" }, pat);
    var frz = mk("rect", { width: w, height: hh, fill: "url(#" + hid + ")", visibility: "hidden" }, inner);
    var border = mk("rect", { width: w, height: hh, rx: 2, fill: "none", stroke: C.beige, "stroke-opacity": 0.6, "stroke-width": 1 }, g);
    var live = mk("circle", { cx: w - 8, cy: 8, r: 2.8, fill: C.oliveLt }, g);
    return function (vt, frozen) {
      if (parts.person) {
        parts.person.setAttribute("transform", "translate(" + (Math.sin(vt * 1.9) * 2.2).toFixed(2) + "," + (Math.sin(vt * 2.7) * 1.4).toFixed(2) + ")");
        var open = frozen ? 0 : Math.abs(Math.sin(vt * 9)) * 2.2;
        var my = parseFloat(parts.mouth.getAttribute("y1")) + parseFloat(parts.mouth.getAttribute("y2"));
        attr(parts.mouth, { y1: (my / 2 - open / 2).toFixed(2), y2: (my / 2 + open / 2).toFixed(2) });
        for (var i = 0; i < parts.bars.length; i++) {
          var bh = frozen ? 1 : 3 + Math.abs(Math.sin(vt * (5 + i * 1.3) + i)) * 11;
          attr(parts.bars[i], { y: (hh - 7 - bh).toFixed(1), height: bh.toFixed(1), fill: frozen ? C.text3 : C.oliveLt });
        }
      }
      if (parts.scroll) parts.scroll.setAttribute("transform", "translate(" + (-((vt * 18) % parts.span)).toFixed(1) + ",0)");
      if (parts.wave) {
        var pts = [];
        for (var k = 0; k <= 44; k++) {
          var xx = 34 + k * ((w - 44) / 44), env = Math.sin(k / 44 * Math.PI);
          var yy = frozen ? 0 : env * (Math.sin(k * 0.9 + vt * 11) * 9 + Math.sin(k * 0.37 - vt * 5) * 6) * (0.55 + 0.45 * Math.abs(Math.sin(vt * 1.7)));
          pts.push(xx.toFixed(1) + "," + (hh * 0.55 + yy).toFixed(1));
        }
        parts.wave.setAttribute("points", pts.join(" "));
        parts.wave.setAttribute("stroke", frozen ? C.text3 : C.oliveLt);
      }
      frz.setAttribute("visibility", frozen ? "visible" : "hidden");
      attr(border, { stroke: frozen ? C.risk : C.beige, "stroke-opacity": frozen ? 1 : 0.6 });
      attr(live, { fill: frozen ? C.risk : C.oliveLt, opacity: frozen ? 1 : (Math.sin(vt * 6) > 0 ? 1 : 0.35) });
    };
  }

  /* ---------------------------------------------------------------- one half of a section */
  function Half(sec, who, def, kase) {
    var fig = h("figure", "half half-" + who);
    var cap = h("figcaption", "half-cap");
    add(cap, h("span", "half-name", who === "mas" ? TXT.mas : TXT.today));
    var stage = h("div", "stage");
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    attr(svg, { viewBox: [VB.x, VB.y, VB.w, VB.h].join(" "), "class": "iso", role: "img", focusable: "false",
      "aria-label": (who === "mas" ? TXT.mas : TXT.today) + ". " + kase.scene + ". " + kase.event });
    var tag = h("span", "state", TXT.playing, { "aria-hidden": "true" });
    tag.style.right = ((VB.x + VB.w - TILE.x - TILE.w) / VB.w * 100).toFixed(2) + "%";
    tag.style.top = ((TILE.y + TILE.h + 5 - VB.y) / VB.h * 100).toFixed(2) + "%";
    add(stage, svg, tag);
    var tapeWrap = h("div", "tape");
    var cv = h("canvas", null, null, { "aria-hidden": "true" });
    add(tapeWrap, cv);
    add(fig, cap, stage, tapeWrap);

    var defs = mk("defs", {}, svg), L = {};
    ["sky", "skym", "base", "ground", "back", "mover", "front", "beams", "pk", "badges", "tile"].forEach(function (n) { L[n] = mk("g", { "class": "L-" + n }, svg); });
    var dyn = def.build(L, sec.story);
    var travel = dyn.travel || 1.3, step = 0.16;
    var beamA = mk("polyline", { fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, L.beams);
    var beamB = mk("polyline", { fill: "none", stroke: C.oliveLt, "stroke-linecap": "round", "stroke-linejoin": "round" }, L.beams);
    function brk() {
      var g = mk("g", { visibility: "hidden" }, L.beams);
      return { g: g, c: mk("circle", { r: 6.5, fill: C.char, stroke: C.risk, "stroke-width": 1.3 }, g), x: mk("path", { stroke: C.riskText, "stroke-width": 1.5 }, g) };
    }
    var brA = brk(), brB = brk();
    var rects = [], dots = [];
    function rectAt(i) { if (!rects[i]) rects[i] = mk("rect", { width: 6, height: 6 }, L.pk); return rects[i]; }
    function dotAt(i) { if (!dots[i]) dots[i] = mk("circle", { r: 2 }, L.pk); return dots[i]; }
    var sigG = mk("g", {}, L.badges), sigBars = [];
    for (var si = 0; si < 4; si++) sigBars.push(mk("rect", { x: si * 4.6, y: -(si + 1) * 3.6, width: 3.2, height: (si + 1) * 3.6 }, sigG));
    var tile = makeTile(L.tile, defs, def.tile);
    var fadeLayers = [L.mover, L.skym, L.beams, L.pk, sigG];

    function placeBrk(b, poly, spec, on) {
      b.g.setAttribute("visibility", on ? "visible" : "hidden");
      if (!on) return 0;
      var fr = poly.frac(spec.seg, spec.f), p = poly.at(fr);
      attr(b.c, { cx: p[0].toFixed(1), cy: p[1].toFixed(1) });
      b.x.setAttribute("d", "M" + (p[0] - 3.2).toFixed(1) + "," + (p[1] - 3.2).toFixed(1) + " l6.4,6.4 M" + (p[0] + 3.2).toFixed(1) + "," + (p[1] - 3.2).toFixed(1) + " l-6.4,6.4");
      return fr;
    }

    /* tape (canvas) */
    var cx = cv.getContext("2d"), dpr = 1, cw = 0, ch = 0;
    function sizeTape() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cw = cv.clientWidth; ch = cv.clientHeight;
      cv.width = Math.max(1, Math.round(cw * dpr)); cv.height = Math.max(1, Math.round(ch * dpr));
    }
    function mark(x, y, k) {
      if (k === "pk") { cx.fillStyle = who === "mas" ? C.orange : C.white; cx.fillRect(x - 2.5, y - 2.5, 5, 5); }
      else if (k === "cp") { cx.strokeStyle = C.orange; cx.lineWidth = 1.3; cx.strokeRect(x - 2.4, y - 2.4, 4.8, 4.8); }
      else if (k === "pb") { cx.fillStyle = C.oliveLt; cx.beginPath(); cx.arc(x, y, 1.7, 0, 6.3); cx.fill(); }
      else if (k === "pblost") { cx.fillStyle = "rgba(196,87,58,.6)"; cx.beginPath(); cx.arc(x, y, 1.4, 0, 6.3); cx.fill(); }
      else { cx.strokeStyle = C.riskText; cx.lineWidth = 1.1; cx.beginPath(); cx.moveTo(x - 2.2, y - 2.2); cx.lineTo(x + 2.2, y + 2.2); cx.moveTo(x + 2.2, y - 2.2); cx.lineTo(x - 2.2, y + 2.2); cx.stroke(); }
    }
    function drawTape(t) {
      if (!cw || !ch) sizeTape();
      if (!cw || !ch) return;
      var story = sec.story, T = story.T;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx.clearRect(0, 0, cw, ch);
      var x0 = 20, x1 = cw - 5, span = cw < 420 ? 6 : 8, pps = (x1 - x0) / span, yA = Math.round(ch * 0.32), yB = Math.round(ch * 0.74);
      cx.font = "500 10px 'Martian Mono', ui-monospace, monospace";
      cx.textBaseline = "middle";
      cx.fillStyle = C.beige; cx.fillText("A", 2, yA);
      cx.fillStyle = C.oliveLt; cx.fillText("B", 2, yB);
      cx.strokeStyle = "rgba(194,155,114,.22)"; cx.lineWidth = 1;
      [yA, yB].forEach(function (y) { cx.beginPath(); cx.moveTo(x0, y + 0.5); cx.lineTo(x1, y + 0.5); cx.stroke(); });
      if (who === "base") {
        var lp = Math.floor(t / T.L) * T.L;
        for (var kk = -1; kk <= 0; kk++) {
          var a = x1 - (t - (T.drop + lp + kk * T.L)) * pps, b = x1 - (t - (T.baseSwitch + lp + kk * T.L)) * pps;
          a = Math.max(a, x0); b = Math.min(b, x1);
          if (b <= a) continue;
          cx.fillStyle = "rgba(196,87,58,.16)"; cx.fillRect(a, 3, b - a, ch - 6);
          cx.strokeStyle = "rgba(196,87,58,.55)"; cx.lineWidth = 1;
          cx.beginPath(); cx.moveTo(a + 0.5, 3); cx.lineTo(a + 0.5, ch - 3); cx.stroke();
        }
      }
      var t0 = Math.ceil((t - span) / step) * step;
      for (var n = 0; ; n++) {
        var te = t0 + n * step;
        if (te > t + 1e-9) break;
        var x = x1 - (t - te) * pps, s = story.state(te), k = Math.round(te / step);
        if (x < x0 + 3) continue;
        if (who === "mas") {
          if (s.mas !== "B") mark(x, yA, s.aUp ? "pk" : "lost");
          if (s.mas !== "A") mark(x, yB, s.bUp ? "pk" : "lost");
          if (s.copies) mark(x, yB, s.bUp ? "cp" : "lost");
          if (k % 3 === 0) {
            if (s.mas === "A" && !s.copies) mark(x, yB, s.bUp ? "pb" : "pblost");
            if (s.mas === "B") mark(x, yA, s.aUp ? "pb" : "pblost");
          }
        } else {
          if (s.base !== "B") mark(x, yA, s.aUp ? "pk" : "lost");
          else mark(x, yB, s.bUp ? "pk" : "lost");
        }
      }
      cx.fillStyle = C.white; cx.fillRect(x1, 2, 1.5, ch - 4);
    }

    function render(t, s) {
      var story = sec.story, T = story.T, w = story.wrap(t);
      dyn.update(t, s);
      var fade = w < 0.35 ? w / 0.35 : (w > T.L - 0.35 ? (T.L - w) / 0.35 : 1);
      fadeLayers.forEach(function (g) { g.setAttribute("opacity", fade.toFixed(2)); });
      var pa = Poly(dyn.pathA().concat([FAR])), pb = Poly(dyn.pathB().concat([FAR]));
      beamA.setAttribute("points", pa.str()); beamB.setAttribute("points", pb.str());
      var mainA = who === "mas" ? s.mas !== "B" : s.base !== "B";
      var useB = who === "mas" ? (s.mas !== "A" || s.copies) : s.base === "B";
      if (!s.aUp) attr(beamA, { stroke: C.risk, "stroke-opacity": 0.45, "stroke-dasharray": "2 6", "stroke-width": 1.4 });
      else if (s.risk > 0.15) attr(beamA, { stroke: C.risk, "stroke-opacity": mainA ? 0.95 : 0.6, "stroke-dasharray": "7 4", "stroke-width": mainA ? 1.8 : 1.2 });
      else attr(beamA, { stroke: C.beige, "stroke-opacity": mainA ? 0.95 : 0.5, "stroke-dasharray": mainA ? "none" : "3 6", "stroke-width": mainA ? 1.8 : 1.2 });
      if (!s.bUp) attr(beamB, { stroke: C.risk, "stroke-opacity": 0.45, "stroke-dasharray": "2 6", "stroke-width": 1.4 });
      else attr(beamB, useB ? { stroke: C.oliveLt, "stroke-opacity": 0.95, "stroke-dasharray": "none", "stroke-width": 1.8 } :
        { stroke: C.oliveLt, "stroke-opacity": who === "mas" ? 0.55 : 0.3, "stroke-dasharray": "3 6", "stroke-width": 1.2 });
      var cutA = placeBrk(brA, pa, dyn.brkA || { seg: 0, f: 0.5 }, !s.aUp);
      var cutB = placeBrk(brB, pb, dyn.brkB || { seg: 0, f: 0.5 }, !s.bUp);

      var list = flows(story, t, who, travel, step), ri = 0, di = 0;
      for (var i = 0; i < list.length; i++) {
        var it = list[i], poly = it.p === "A" ? pa : pb, cut = it.p === "A" ? cutA : cutB;
        var u = it.kind === "ack" ? 1 - it.u : it.u, op = 1;
        if (it.lost) { if (u > cut) continue; if (u > cut - 0.08) op = (cut - u) / 0.08; }
        var pt = poly.at(u);
        if (it.kind === "pk" || it.kind === "cp") {
          var fillc = who === "mas" ? (it.kind === "cp" ? C.char3 : C.orange) : C.white;
          attr(rectAt(ri++), { x: (pt[0] - 3).toFixed(1), y: (pt[1] - 3).toFixed(1), fill: fillc, stroke: it.kind === "cp" ? C.orange : "none",
            "stroke-width": 1.4, opacity: op.toFixed(2), visibility: "visible" });
        } else {
          attr(dotAt(di++), { cx: pt[0].toFixed(1), cy: pt[1].toFixed(1), r: it.kind === "ack" ? 1.5 : 2.1,
            fill: it.kind === "ack" ? C.text2 : (it.p === "B" ? C.oliveLt : C.beige), opacity: op.toFixed(2), visibility: "visible" });
        }
      }
      for (var a = ri; a < rects.length; a++) rects[a].setAttribute("visibility", "hidden");
      for (var b = di; b < dots.length; b++) dots[b].setAttribute("visibility", "hidden");

      var sp = dyn.sig();
      sigG.setAttribute("transform", "translate(" + (sp[0] + 9).toFixed(1) + "," + (sp[1] - 6).toFixed(1) + ")");
      var nb = Math.ceil(s.cov * 4 - 0.01);
      for (var j = 0; j < 4; j++) sigBars[j].setAttribute("fill", j < nb ? (s.risk > 0.5 ? C.risk : C.beige) : "#45474D");

      var frozen = who === "base" && s.frozen;
      tile(frozen ? T.drop : t, frozen);
      var txt = frozen ? TXT.frozen : TXT.playing;
      if (tag.textContent !== txt) { tag.textContent = txt; tag.className = "state" + (frozen ? " is-frozen" : ""); }
      drawTape(t);
    }
    return { el: fig, render: render, sizeTape: sizeTape, canvas: cv };
  }

  /* ---------------------------------------------------------------- page text */
  function buildHeader() {
    var p = CT.page;
    document.title = p.title;
    var top = document.getElementById("top-text");
    var h1 = h("h1", "page-title", p.title);
    var slogan = h("p", "slogan", p.slogan);
    var intro = h("p", "intro", p.intro);
    var lg = h("ul", "legend");
    ["sw-pk", "sw-cp", "sw-frz"].forEach(function (cls, i) {
      var li = h("li", "lg");
      add(li, h("i", "sw " + cls, null, { "aria-hidden": "true" }), h("span", null, p.legend[i]));
      lg.appendChild(li);
    });
    var timing = h("p", "timing", TXT.timing);
    var hon = h("p", "honesty", p.honesty);
    var nav = h("nav", "toc", null, { "aria-label": "Use cases" });
    var ul = h("ul");
    CT.cases.forEach(function (c) {
      var li = h("li"), a = h("a", null, null, { href: "#case-" + c.id });
      add(a, h("span", "toc-id", c.id), h("span", "toc-t", c.title));
      li.appendChild(a); ul.appendChild(li);
    });
    nav.appendChild(ul);
    var left = h("div", "top-l"), right = h("div", "top-r");
    add(left, h1, slogan);
    add(right, intro, lg, timing, hon);
    add(top, left, right);
    document.getElementById("toc-slot").appendChild(nav);
    var fh = document.getElementById("foot-honesty");
    if (fh) fh.textContent = p.honesty;
  }

  function pinIcon() {
    var NS = "http://www.w3.org/2000/svg", s = document.createElementNS(NS, "svg");
    attr(s, { viewBox: "0 0 12 12", width: "11", height: "11", "aria-hidden": "true", focusable: "false" });
    mk("path", { d: "M6 11 C6 11 2 6.8 2 4.6 A4 4 0 0 1 10 4.6 C10 6.8 6 11 6 11 Z M6 6 A1.4 1.4 0 1 0 6 3.2 A1.4 1.4 0 1 0 6 6 Z", fill: "currentColor", "fill-rule": "evenodd" }, s);
    return s;
  }

  function buildText(c) {
    var col = h("div", "text");
    var a = h("div", "t-a"), b = h("div", "t-b");
    var head = h("div", "t-head");
    add(head, h("p", "cid", c.id), h("h2", "ctitle", c.title, { id: "t-" + c.id }));
    var chips = h("div", "chips");
    var where = h("span", "chip chip-where");
    add(where, pinIcon(), h("span", null, c.where));
    add(chips, h("span", "chip chip-fit fit-" + c.fit.toLowerCase(), TXT.fit + c.fit), where);
    var prob = h("p", "problem", c.problem);
    var paths = h("ul", "paths");
    [["A", c.path_a], ["B", c.path_b]].forEach(function (pp) {
      var li = h("li");
      add(li, h("span", "pbadge pbadge-" + pp[0].toLowerCase(), pp[0], { "aria-hidden": "true" }), h("span", "pname", pp[1]));
      paths.appendChild(li);
    });
    var does = h("ul", "does");
    c.does.forEach(function (d) { does.appendChild(h("li", null, d)); });
    var res = h("div", "result");
    var r = c.result, tv = num(r.today), mv = num(r.masarain);
    add(res, h("p", "rlabel", r.label));
    [[TXT.todayBar, r.today, 100, "rb-today"], [TXT.masBar, r.masarain, tv > 0 ? mv / tv * 100 : 0, "rb-mas"]].forEach(function (row) {
      var d = h("div", "rrow" + (row[3] === "rb-mas" ? " me" : ""));
      var track = h("span", "rt", null, { "aria-hidden": "true" }), bar = h("i", "rb " + row[3]);
      bar.style.width = clamp(row[2], 1.5, 100).toFixed(2) + "%";
      track.appendChild(bar);
      add(d, h("span", "rl", row[0]), track, h("span", "rv", row[1]));
      res.appendChild(d);
    });
    add(res, h("p", "rnote", r.note));
    add(a, head, chips, prob, paths);
    add(b, does, res);
    add(col, a, b);
    return col;
  }

  /* ---------------------------------------------------------------- sections and the scheduler */
  var sections = [], running = [], rafId = 0;
  function want(sec) { return sec.playing && sec.inView && !document.hidden; }
  function refresh(sec) {
    var i = running.indexOf(sec);
    if (want(sec)) { if (i < 0) { running.push(sec); sec.last = null; } }
    else if (i >= 0) running.splice(i, 1);
    if (!rafId && running.length) rafId = requestAnimationFrame(frame);
  }
  function frame(now) {
    rafId = 0;
    for (var i = 0; i < running.length; i++) {
      var sec = running[i];
      if (sec.last != null) sec.t += Math.min(0.05, (now - sec.last) / 1000);
      sec.last = now;
      sec.render(sec.t);
      sec.frames++;
    }
    if (running.length) rafId = requestAnimationFrame(frame);
  }

  function buildSection(c, idx, main) {
    var def = SCENES[c.id];
    if (!def) return;
    var sec = { id: c.id, idx: idx, story: Story(OVER[c.id]), t: reduce ? KEY : 0, playing: !reduce, inView: false, frames: 0, last: null };
    var el = h("section", "case", null, { id: "case-" + c.id, "aria-labelledby": "t-" + c.id });
    var inner = h("div", "case-in wrap");
    var motion = h("div", "motion");
    var halves = h("div", "halves");
    sec.halves = [Half(sec, "base", def, c), Half(sec, "mas", def, c)];
    sec.halves.forEach(function (hf) { halves.appendChild(hf.el); });
    var ctl = h("div", "ctl");
    var btn = h("button", "pp", null, { type: "button" });
    var ico = h("span", "pp-ico", null, { "aria-hidden": "true" }), lab = h("span", "pp-lab");
    add(btn, ico, lab);
    function syncBtn() {
      lab.textContent = sec.playing ? TXT.pause : TXT.play;
      btn.setAttribute("aria-label", (sec.playing ? TXT.pause : TXT.play) + " the " + c.id + " animation");
      btn.classList.toggle("is-paused", !sec.playing);
    }
    btn.addEventListener("click", function () { sec.playing = !sec.playing; syncBtn(); refresh(sec); });
    syncBtn();
    ctl.appendChild(btn);
    add(motion, halves, ctl);
    add(inner, buildText(c), motion);
    el.appendChild(inner);
    main.appendChild(el);
    sec.el = el; sec.btn = btn; sec.syncBtn = syncBtn;
    sec.render = function (t) { var s = sec.story.state(t); sec.halves[0].render(t, s); sec.halves[1].render(t, s); };
    sections.push(sec);
  }

  function init() {
    buildHeader();
    var main = document.getElementById("cases");
    CT.cases.forEach(function (c, i) { buildSection(c, i, main); });
    var fixedT = q.t != null ? parseFloat(q.t) : null;
    sections.forEach(function (sec) {
      if (fixedT != null && !isNaN(fixedT)) { sec.t = fixedT; sec.playing = false; sec.syncBtn(); }
      sec.halves.forEach(function (hf) { hf.sizeTape(); });
      sec.render(sec.t);
    });
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          var sec = sections.filter(function (s) { return s.el === e.target; })[0];
          if (!sec) return;
          sec.inView = e.isIntersecting;
          refresh(sec);
        });
      }, { threshold: 0.08 });
      sections.forEach(function (sec) { io.observe(sec.el); });
    } else sections.forEach(function (sec) { sec.inView = true; refresh(sec); });
    document.addEventListener("visibilitychange", function () { sections.forEach(refresh); });
    var rz = 0;
    window.addEventListener("resize", function () {
      if (rz) return;
      rz = requestAnimationFrame(function () {
        rz = 0;
        sections.forEach(function (sec) { sec.halves.forEach(function (hf) { hf.sizeTape(); }); if (running.indexOf(sec) < 0) sec.render(sec.t); });
      });
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { sections.forEach(function (sec) { if (running.indexOf(sec) < 0) sec.render(sec.t); }); });

    /* hooks for the QA script */
    window.__demo = {
      KEY: KEY, sections: sections,
      running: function () { return running.map(function (s) { return s.id; }); },
      frames: function () { var o = {}; sections.forEach(function (s) { o[s.id] = s.frames; }); return o; },
      seek: function (id, t, pause) {
        var sec = sections.filter(function (s) { return s.id === id; })[0];
        if (!sec) return false;
        if (pause) { sec.playing = false; sec.syncBtn(); refresh(sec); }
        sec.t = t; sec.render(t); return true;
      }
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
