/* Masarain in the field: the eight isometric scenes, one per use case in content.json.
   Each builder draws the static scene into the layers it is given and returns the moving parts:
     update(t, s)  moves vehicles, satellites, clouds, and rings for the story time t and state s
     pathA(), pathB()  screen points from the device to the network side of path A and path B
     sig()  where the small signal meter sits, next to the device
     brkA, brkB  where the break mark goes on each path: { seg: segment index, f: fraction along it }
   The engine (demo.js) adds the far end, the beams, the packets, the call tile, and the tape.
   All timing is illustrative; nothing here is measured. */
(function () {
  "use strict";
  var I = window.ISO, C = I.C, P = I.P, mk = I.mk;

  function uOf(story, t) { return story.wrap(t) / story.T.L; }
  function furrows(g, x, y, w, d, step, col) {
    for (var yy = y + step / 2; yy < y + d; yy += step) I.ln(g, [x + 0.1, yy, 0.01], [x + w - 0.1, yy, 0.01], { stroke: col || C.oliveLit, "stroke-width": 1 });
  }
  function road(g, y, d, x0, x1, fill) {
    I.flat(g, x0 || 0, y, (x1 || 14) - (x0 || 0), d, fill || "#26282B", { stroke: "rgba(194,155,114,.3)" });
    I.ln(g, [(x0 || 0) + 0.2, y + d / 2, 0.01], [(x1 || 14) - 0.2, y + d / 2, 0.01], { "stroke-opacity": 0.42, "stroke-dasharray": "6 7", "stroke-width": 0.7 });
  }
  function dune(g, a, b, lift) {
    var p = P(a[0], a[1], 0), q = P(b[0], b[1], 0);
    mk("path", { d: "M" + I.xy(p) + " Q" + ((p[0] + q[0]) / 2).toFixed(1) + "," + ((p[1] + q[1]) / 2 - (lift || 9)).toFixed(1) + " " + I.xy(q), fill: "none", stroke: C.beige, "stroke-opacity": 0.3, "stroke-width": 0.8 }, g);
  }
  /* a moving low-orbit satellite on a dotted orbit; letter is the path it carries */
  function leo(L, letter, story) {
    var pts = [];
    function at(u) { return [-152 + 236 * u, -94 - 16 * Math.sin(Math.PI * u)]; }
    for (var k = -0.06; k <= 1.06; k += 0.04) pts.push(I.xy(at(k)));
    mk("polyline", { points: pts.join(" "), fill: "none", stroke: C.beige, "stroke-opacity": 0.2, "stroke-dasharray": "2 6" }, L.sky);
    var g = mk("g", {}, L.skym), inner = I.satGlyph(g, 0.62), b = I.badge(L.skym, letter), p = at(0);
    inner.setAttribute("transform", "scale(0.62)");
    return {
      update: function (t, dim) {
        p = at(uOf(story, t));
        g.setAttribute("transform", "translate(" + p[0].toFixed(1) + "," + p[1].toFixed(1) + ")");
        g.setAttribute("opacity", dim ? 0.45 : 1);
        b.at(p, 30, -6);
      },
      point: function () { return [p[0], p[1] + 7]; },
      badge: b
    };
  }
  function mastBadge(L, top, letter) { var b = I.badge(L.badges, letter); b.at(top, 0, -15); return b; }
  /* nearest of a list of mast tops to a screen x */
  function nearest(list, x) {
    var best = list[0], d = 1e9;
    list.forEach(function (m) { var dd = Math.abs(m.gx - x); if (dd < d) { d = dd; best = m; } });
    return best;
  }

  var SCENES = {};

  /* ------------------------------------------------------------------ CD-1 */
  SCENES["CD-1"] = {
    tile: "person",
    build: function (L, story) {
      I.slab(L.base, 14, 7, "#37393E");
      I.flat(L.ground, 0, 3.7, 14, 0.6, "#3F4146", { stroke: "rgba(194,155,114,.22)" });
      road(L.ground, 4.3, 1.5);
      I.flat(L.ground, 0, 5.8, 14, 0.55, "#3F4146", { stroke: "rgba(194,155,114,.22)" });
      var B = L.back;
      I.building(B, 0.5, 0.5, 2.0, 1.7, 2.2);
      /* the incident: a building on fire */
      var fx = 4.0, fy = 0.7;
      I.box(B, fx, fy, 0, 1.6, 1.4, 2.0, C.city);
      for (var z = 0.3; z < 1.8; z += 0.45) {
        I.face(B, [[fx + 0.2, fy + 1.4, z], [fx + 0.6, fy + 1.4, z], [fx + 0.6, fy + 1.4, z + 0.2], [fx + 0.2, fy + 1.4, z + 0.2]], z > 0.9 ? C.flame : C.glass, { stroke: "none" });
        I.face(B, [[fx + 0.9, fy + 1.4, z], [fx + 1.35, fy + 1.4, z], [fx + 1.35, fy + 1.4, z + 0.2], [fx + 0.9, fy + 1.4, z + 0.2]], z > 1.3 ? C.flame : C.glass, { stroke: "none" });
      }
      var fl = mk("g", {}, B);
      I.flame(fl, fx + 0.5, fy + 0.6, 2.0, 0.75, 0.5);
      I.flame(fl, fx + 1.05, fy + 0.9, 2.0, 0.5, 0.36);
      var s1 = P(fx + 0.55, fy + 0.5, 2.9), s2 = P(fx + 0.3, fy + 0.3, 3.5);
      mk("path", { d: "M" + I.xy(s1) + " q -8,-10 2,-18 q 10,-8 -2,-18", fill: "none", stroke: C.pale, "stroke-opacity": 0.45, "stroke-width": 1.2, "stroke-dasharray": "2 3" }, B);
      mk("path", { d: "M" + I.xy(s2) + " q 8,-8 -2,-14", fill: "none", stroke: C.pale, "stroke-opacity": 0.35, "stroke-width": 1, "stroke-dasharray": "2 3" }, B);
      I.building(B, 7.0, 0.5, 2.1, 1.8, 2.8);
      I.building(B, 10.7, 0.6, 2.2, 1.5, 1.7);
      /* congested cellular masts (B) */
      var rA = I.rings(L.ground, 2.92, 2.78, 3), rB = I.rings(L.ground, 11.22, 2.88, 3);
      var m1 = I.mast(B, 2.7, 2.6, 3.5), m2 = I.mast(B, 11.0, 2.7, 3.5);
      mastBadge(L, m1, "B"); mastBadge(L, m2, "B");
      /* a crowd of phones at the cordon, all on the same cells */
      var crowd = [[2.3, 3.82], [2.75, 4.05], [3.2, 3.86], [3.6, 4.1], [4.05, 3.9], [7.3, 3.85], [7.7, 4.08], [8.15, 3.9], [8.6, 4.12], [9.1, 3.88], [9.55, 4.05], [10.1, 3.9], [10.6, 4.1], [11.6, 3.95]];
      crowd.forEach(function (c, i) {
        var top = P(c[0], c[1], 0.45), mt = i < 7 ? m1 : m2;
        mk("line", { x1: top[0].toFixed(1), y1: top[1].toFixed(1), x2: mt[0].toFixed(1), y2: (mt[1] + 4).toFixed(1), stroke: C.beige, "stroke-opacity": 0.1, "stroke-width": 0.6 }, L.ground);
        I.person(B, c[0], c[1], i % 3 ? C.pale : C.cream);
      });
      /* the command vehicle with a LEO terminal on the roof, and a police car */
      I.vanX(B, 4.8, 4.45, 2.3, 0.9, 0.88, 0.5, 0.64, C.body, { stripe: C.olive });
      I.box(B, 5.1, 4.6, 1.0, 0.75, 0.6, 0.06, C.pale);
      I.ln(B, [6.6, 4.7, 0.76], [6.6, 4.7, 1.2], { stroke: C.pale, "stroke-width": 0.9 });
      I.carX(B, 8.4, 4.6, 1.2, 0.72, C.body, { band: "#2F3135", roof: C.beige });
      for (var cx = 3.0; cx < 10.5; cx += 0.9) I.box(B, cx, 6.0, 0, 0.14, 0.14, 0.2, C.terra);
      var ant = P(5.47, 4.9, 1.1);
      var sat = leo(L, "A", story);
      return {
        update: function (t, s) {
          sat.update(t, !s.aUp);
          I.ringsAt(rA, t * 1.7, 1, false, 2.0); I.ringsAt(rB, t * 1.7 + 0.3, 1, false, 2.0);
          fl.setAttribute("opacity", (0.82 + 0.18 * Math.sin(t * 9)).toFixed(2));
        },
        pathA: function () { return [ant, sat.point()]; },
        pathB: function () { return [ant, m1]; },
        sig: function () { return ant; },
        brkA: { seg: 0, f: 0.78 }
      };
    }
  };

  /* ------------------------------------------------------------------ H-1 */
  SCENES["H-1"] = {
    tile: "person",
    build: function (L, story) {
      I.slab(L.base, 14, 7, "#33362D");
      var G = L.ground, B = L.back;
      I.flat(G, 3.8, 0.4, 3.6, 2.2, C.olive, { stroke: "rgba(194,155,114,.25)" }); furrows(G, 3.8, 0.4, 3.6, 2.2, 0.3);
      I.flat(G, 1.2, 5.0, 11.6, 1.6, C.olive, { stroke: "rgba(194,155,114,.25)" }); furrows(G, 1.2, 5.0, 11.6, 1.6, 0.3);
      road(G, 3.25, 1.25);
      /* the town the ambulance leaves */
      I.building(B, 0.3, 0.4, 1.3, 1.1, 1.7);
      I.building(B, 1.9, 0.4, 1.0, 1.0, 2.3);
      I.building(B, 0.4, 1.8, 1.1, 0.9, 1.1);
      /* rural stretch: a low hill and trees */
      I.prism(B, 8.0, 0.4, 0, 2.8, 2.4, 1.3, "#45483E");
      [[7.6, 2.5], [10.9, 2.4], [5.3, 2.7]].forEach(function (q) { I.tree(B, q[0], q[1]); });
      var rA = I.rings(G, 3.22, 2.38, 2), rB = I.rings(G, 12.42, 1.88, 2);
      var m1 = I.mast(B, 3.0, 2.2, 3.6), m2 = I.mast(B, 12.2, 1.7, 3.6);
      mastBadge(L, m1, "A"); mastBadge(L, m2, "A");
      var masts = [{ gx: 3.2, top: m1 }, { gx: 12.4, top: m2 }];
      [[2.4, 4.6], [5.9, 4.62], [9.4, 4.6], [12.6, 4.65]].forEach(function (q) { I.tree(L.front, q[0], q[1], 0.9); });
      /* the ambulance, drawn at x = 0 and moved along the road */
      var car = mk("g", {}, L.mover);
      I.vanX(car, 0, 3.4, 1.8, 0.85, 0.8, 0.45, 0.56, C.body, { stripe: C.terra });
      I.box(car, 0.25, 3.56, 0.92, 0.32, 0.3, 0.08, C.terra);
      I.ln(car, [1.0, 3.8, 0.92], [1.0, 3.8, 1.3], { "stroke-width": 1.2 });
      var x = 0, ant = [0, 0];
      var sat = leo(L, "B", story);
      return {
        update: function (t, s) {
          x = 0.4 + 11.8 * uOf(story, t);
          var sh = P(x, 0, 0);
          car.setAttribute("transform", "translate(" + sh[0].toFixed(1) + "," + (sh[1] + Math.sin(t * 11) * 0.5).toFixed(1) + ")");
          ant = P(x + 1.0, 3.8, 1.32);
          sat.update(t, false);
          I.ringsAt(rA, t, 1, false); I.ringsAt(rB, t + 0.5, 1, false);
        },
        pathA: function () { return [ant, nearest(masts, x + 1).top]; },
        pathB: function () { return [ant, sat.point()]; },
        sig: function () { return ant; },
        brkA: { seg: 0, f: 0.5 },
        moving: true
      };
    }
  };

  /* ------------------------------------------------------------------ EV-1 */
  SCENES["EV-1"] = {
    tile: "class",
    build: function (L, story) {
      I.slab(L.base, 14, 7, "#33362D");
      var G = L.ground, B = L.back, F = L.front;
      var wall = "#6B655D";
      /* garden and street */
      I.flat(G, 8.0, 0.2, 5.8, 5.9, "#384030", { stroke: "rgba(194,155,114,.18)" });
      I.flat(G, 0, 6.3, 14, 0.7, "#26282B", { stroke: "rgba(194,155,114,.3)" });
      /* room floor with planks */
      I.flat(G, 0.6, 0.6, 7.2, 5.6, "#4A4038", { stroke: "rgba(194,155,114,.4)" });
      for (var py = 1.1; py < 6.2; py += 0.5) I.ln(G, [0.6, py, 0.005], [7.8, py, 0.005], { stroke: "#3F362F", "stroke-width": 0.8 });
      I.flat(G, 2.4, 3.95, 3.4, 1.7, "#5A3A30", { stroke: "rgba(194,155,114,.25)" });
      /* fiber line: down the wall, along the floor, out to the street cabinet */
      var fib = [[0.62, 2.95, 1.2], [0.62, 2.95, 0.03], [0.62, 5.75, 0.03], [7.8, 5.75, 0.03], [10.9, 5.45, 0.03], [11.0, 5.4, 0.5]];
      mk("polyline", { points: fib.map(function (p) { return I.xy(P(p[0], p[1], p[2])); }).join(" "), fill: "none", stroke: C.beige, "stroke-opacity": 0.55, "stroke-dasharray": "4 3", "stroke-width": 1 }, G);
      /* walls (the room is cut open toward the viewer) */
      I.box(B, 0.4, 0.4, 0, 7.4, 0.2, 2.6, wall, { top: C.pale });
      I.face(B, [[3.0, 0.6, 1.0], [5.4, 0.6, 1.0], [5.4, 0.6, 2.1], [3.0, 0.6, 2.1]], "#2B333A", { stroke: C.beige, sw: 0.8 });
      I.ln(B, [4.2, 0.6, 1.0], [4.2, 0.6, 2.1], { "stroke-width": 0.7 });
      I.ln(B, [3.0, 0.6, 1.55], [5.4, 0.6, 1.55], { "stroke-width": 0.5, "stroke-opacity": 0.6 });
      I.box(B, 0.4, 0.6, 0, 0.2, 5.6, 2.6, wall, { top: C.pale });
      /* shelf with the Wi-Fi router (A) */
      I.box(B, 0.6, 2.1, 1.12, 0.5, 1.2, 0.07, C.cream);
      I.box(B, 0.68, 2.35, 1.19, 0.36, 0.55, 0.13, C.body);
      I.ln(B, [0.78, 2.42, 1.32], [0.78, 2.42, 1.72], { stroke: C.pale, "stroke-width": 1.2 });
      I.ln(B, [0.78, 2.82, 1.32], [0.78, 2.82, 1.72], { stroke: C.pale, "stroke-width": 1.2 });
      var ledP = P(1.04, 2.62, 1.26), led = mk("circle", { cx: ledP[0].toFixed(1), cy: ledP[1].toFixed(1), r: 1.7, fill: C.oliveLt }, B);
      var wc = P(0.95, 2.62, 1.55), arcs = [];
      [7, 11, 15].forEach(function (r) {
        arcs.push(mk("path", { d: "M" + (wc[0] + r * 0.7).toFixed(1) + "," + (wc[1] - r * 0.7).toFixed(1) + " A" + r + "," + r + " 0 0 1 " + (wc[0] + r * 0.7).toFixed(1) + "," + (wc[1] + r * 0.7).toFixed(1), fill: "none", stroke: C.beige, "stroke-width": 1 }, B));
      });
      var router = P(0.86, 2.62, 1.42);
      /* desk, laptop, and the 5G router (B) */
      [[2.9, 2.7], [5.5, 2.7], [2.9, 3.5], [5.5, 3.5]].forEach(function (q) { I.ln(B, [q[0], q[1], 0], [q[0], q[1], 0.72], { stroke: C.pale, "stroke-width": 1 }); });
      I.box(B, 2.8, 2.6, 0.72, 2.8, 1.0, 0.07, C.cream);
      I.box(B, 3.7, 2.85, 0.79, 0.75, 0.5, 0.035, C.steel);
      I.face(B, [[3.7, 2.85, 0.83], [4.45, 2.85, 0.83], [4.45, 2.85, 1.32], [3.7, 2.85, 1.32]], "#2C3036", { stroke: C.beige, sw: 0.7 });
      I.face(B, [[3.8, 2.85, 0.9], [4.35, 2.85, 0.9], [4.35, 2.85, 1.24], [3.8, 2.85, 1.24]], C.olive, { stroke: "none" });
      I.box(B, 5.0, 2.72, 0.79, 0.28, 0.28, 0.42, "#3F4247");
      I.ln(B, [5.14, 2.86, 1.21], [5.14, 2.86, 1.58], { stroke: C.pale, "stroke-width": 1.2 });
      var led5 = P(5.28, 2.86, 1.1);
      mk("circle", { cx: led5[0].toFixed(1), cy: led5[1].toFixed(1), r: 1.5, fill: C.oliveLt }, B);
      I.box(B, 3.75, 3.95, 0, 0.6, 0.5, 0.42, C.oliveLit);
      I.box(B, 3.75, 4.45, 0.42, 0.6, 0.08, 0.55, C.oliveLit);
      I.box(B, 6.7, 1.0, 0, 0.4, 0.4, 0.3, C.terra);
      I.box(B, 6.6, 0.9, 0.3, 0.6, 0.6, 0.5, C.olive, { top: C.oliveLit });
      var laptop = P(4.07, 2.85, 1.36), fiveG = P(5.14, 2.86, 1.6);
      /* outside: trees, the street cabinet, and the cell mast that serves the 5G router */
      I.tree(B, 9.0, 1.0); I.tree(B, 10.5, 2.6, 1.1); I.tree(B, 12.7, 3.5);
      var rM = I.rings(G, 12.82, 0.78, 2);
      var mB = I.mast(B, 12.6, 0.6, 3.8);
      mastBadge(L, mB, "B");
      I.box(F, 10.9, 5.0, 0, 0.55, 0.45, 0.85, C.gray, { top: C.steel });
      I.box(F, 8.2, 5.95, 0, 5.6, 0.25, 0.28, C.olive, { top: C.oliveLit });
      var cab = P(11.17, 5.22, 0.9);
      var bA = I.badge(L.badges, "A"); bA.at(router, -2, -26);
      var pathA = [laptop, router].concat(fib.map(function (p) { return P(p[0], p[1], p[2]); })).concat([cab]);
      return {
        update: function (t, s) {
          led.setAttribute("fill", s.aUp ? (s.risk > 0.5 ? C.risk : C.oliveLt) : C.risk);
          arcs.forEach(function (a, i) { a.setAttribute("stroke-opacity", (0.2 + 0.6 * Math.max(0, Math.sin(t * 4 - i * 0.9))).toFixed(2)); });
          I.ringsAt(rM, t, 1, false);
        },
        pathA: function () { return pathA; },
        pathB: function () { return [laptop, fiveG, mB]; },
        sig: function () { return laptop; },
        brkA: { seg: 6, f: 0.5 },
        travel: 1.7
      };
    }
  };

  /* ------------------------------------------------------------------ DR-1 */
  SCENES["DR-1"] = {
    tile: "pylons",
    build: function (L, story) {
      I.slab(L.base, 14, 7, "#34352F");
      var G = L.ground, B = L.back;
      var corr = I.flat(G, 0, 2.7, 14, 1.6, "#3C3D35", { stroke: "rgba(194,155,114,.4)" });
      corr.setAttribute("stroke-dasharray", "3 4");
      [[1.0, 1.0], [2.2, 5.6], [5.8, 1.6], [9.4, 5.5], [12.2, 5.9], [13.1, 2.0], [6.4, 6.1], [0.8, 5.4]].forEach(function (q) { I.shrub(G, q[0], q[1]); });
      dune(G, [8.5, 5.2], [11.5, 5.0], 6); dune(G, [2.5, 1.6], [5.0, 1.4], 6);
      /* operator 1 masts (A), behind the corridor */
      var rA = I.rings(G, 3.82, 0.68, 2), rB = I.rings(G, 10.82, 0.78, 2);
      var m1 = I.mast(B, 3.6, 0.5, 3.6), m2 = I.mast(B, 10.6, 0.6, 3.6);
      mastBadge(L, m1, "A"); mastBadge(L, m2, "A");
      var masts = [{ gx: 3.8, top: m1 }, { gx: 10.8, top: m2 }];
      /* the power-line corridor */
      var px = [1.2, 4.9, 8.6, 12.3], arms = [];
      px.forEach(function (x) { arms.push(I.pylon(B, x, 3.5, 3.0)); });
      for (var i = 0; i < arms.length - 1; i++) for (var k = 0; k < 4; k++) I.wire(B, arms[i][k], arms[i + 1][k], 6);
      /* operator 2 mast (B), in front */
      var rO = I.rings(G, 7.22, 6.08, 2);
      var mB = I.mast(L.front, 7.0, 5.9, 3.0, { head: C.oliveLt });
      mastBadge(L, mB, "B");
      /* the remote pilot station: a cabin with a small dish, and its vehicle */
      I.box(L.front, 10.5, 5.0, 0, 1.5, 1.0, 0.7, C.cream, { top: C.pale });
      I.face(L.front, [[10.75, 6.0, 0.25], [11.55, 6.0, 0.25], [11.55, 6.0, 0.5], [10.75, 6.0, 0.5]], C.glass, { stroke: "none" });
      I.dish(L.front, 11.6, 5.3, 0.95, 6, -30);
      I.carX(L.front, 12.3, 5.25, 1.1, 0.62, C.olive);
      [[0.6, 2.0], [13.2, 4.6], [9.2, 1.6], [2.0, 6.2]].forEach(function (q) { I.tree(q[1] > 4 ? L.front : B, q[0], q[1], 0.9); });
      /* the drone and its shadow, drawn at x = 0 and moved along the corridor */
      var DZ = 4.1, DY = 2.9;
      var sh = mk("g", {}, G);
      var sq = P(0, DY, 0);
      mk("ellipse", { cx: sq[0].toFixed(1), cy: sq[1].toFixed(1), rx: 14, ry: 7, fill: "#000", opacity: 0.3 }, sh);
      mk("line", { x1: sq[0].toFixed(1), y1: sq[1].toFixed(1), x2: sq[0].toFixed(1), y2: P(0, DY, DZ - 0.25)[1].toFixed(1), stroke: C.beige, "stroke-width": 0.5, "stroke-dasharray": "1 3", opacity: 0.6 }, sh);
      var dr = mk("g", {}, L.mover);
      var rotors = I.miniDrone(dr, [0, DY, DZ], 1.0);
      var x = 0, ant = [0, 0];
      return {
        update: function (t, s) {
          x = 0.8 + 11.6 * uOf(story, t);
          var d = P(x, 0, 0), bob = Math.sin(t * 3) * 1.2;
          dr.setAttribute("transform", "translate(" + d[0].toFixed(1) + "," + (d[1] + bob).toFixed(1) + ")");
          sh.setAttribute("transform", "translate(" + d[0].toFixed(1) + "," + d[1].toFixed(1) + ")");
          rotors.forEach(function (r, j) { r.setAttribute("rx", (6 + 2.4 * Math.abs(Math.sin(t * 30 + j))).toFixed(1)); });
          ant = P(x, DY, DZ - 0.1); ant[1] += bob;
          I.ringsAt(rA, t, 1, false); I.ringsAt(rB, t + 0.5, 1, false); I.ringsAt(rO, t + 0.25, 1, false);
        },
        pathA: function () { return [ant, nearest(masts, x).top]; },
        pathB: function () { return [ant, mB]; },
        sig: function () { return ant; },
        brkA: { seg: 0, f: 0.5 },
        moving: true
      };
    }
  };

  /* ------------------------------------------------------------------ VM-1 */
  function crane(g, x, y, w, d, h) {
    var top = h - 1.0, boom = h - 0.75;
    var legs = [[x + 0.15, y + 0.15], [x + w - 0.15, y + 0.15], [x + 0.15, y + d - 0.15], [x + w - 0.15, y + d - 0.15]];
    legs.forEach(function (l) { I.ln(g, [l[0], l[1], 0], [l[0], l[1], top], { stroke: C.white, "stroke-width": 1.4 }); });
    I.ln(g, [x + 0.15, y + 0.15, top], [x + 0.15, y + d - 0.15, top], { stroke: C.white, "stroke-width": 1.2 });
    I.ln(g, [x + w - 0.15, y + 0.15, top], [x + w - 0.15, y + d - 0.15, top], { stroke: C.white, "stroke-width": 1.2 });
    I.ln(g, [x + 0.15, y + 0.15, top * 0.45], [x + 0.15, y + d - 0.15, top * 0.45], { stroke: C.white, "stroke-width": 0.8 });
    I.ln(g, [x + w - 0.15, y + 0.15, top * 0.45], [x + w - 0.15, y + d - 0.15, top * 0.45], { stroke: C.white, "stroke-width": 0.8 });
    I.ln(g, [x + 0.15, y + 0.15, top], [x + w - 0.15, y + 0.15, top], { stroke: C.white, "stroke-width": 1.1 });
    I.ln(g, [x + 0.15, y + d - 0.15, top], [x + w - 0.15, y + d - 0.15, top], { stroke: C.white, "stroke-width": 1.1 });
    I.ln(g, [x + w / 2, y - 0.2, boom], [x + w / 2, y + d + 1.3, boom], { stroke: C.white, "stroke-width": 2 });
    I.ln(g, [x + w / 2, y + 0.2, top], [x + w / 2, y + 0.2, boom + 0.5], { stroke: C.white, "stroke-width": 1 });
    I.ln(g, [x + w / 2, y + 0.2, boom + 0.5], [x + w / 2, y + d + 1.3, boom], { stroke: C.white, "stroke-width": 0.6, "stroke-opacity": 0.8 });
    I.box(g, x + w / 2 - 0.3, y + 0.05, boom - 0.05, 0.6, 0.5, 0.32, C.terra);
    I.box(g, x + w / 2 - 0.12, y + d + 0.7, boom - 0.12, 0.24, 0.24, 0.12, C.body);
    I.ln(g, [x + w / 2, y + d + 0.82, boom - 0.12], [x + w / 2, y + d + 0.82, 1.1], { "stroke-width": 0.5, "stroke-opacity": 0.8 });
  }
  function ship(g, x, y, len, wid, mastH) {
    var Lh = len - 0.75, W = wid;
    [0.3, 0.7, 1.1, 1.5].forEach(function (kk) {
      I.ln(g, [x - kk, y + 0.25 + kk * 0.12, 0], [x - kk - 0.6, y + 0.25 + kk * 0.12, 0], { "stroke-opacity": 0.35 });
      I.ln(g, [x - kk, y + W - 0.25 - kk * 0.12, 0], [x - kk - 0.6, y + W - 0.25 - kk * 0.12, 0], { "stroke-opacity": 0.35 });
    });
    I.box(g, x, y, -0.05, Lh, W, 0.14, C.terra);
    I.box(g, x, y, 0.09, Lh, W, 0.4, C.hull);
    I.face(g, [[x + Lh, y, -0.05], [x + Lh + 0.75, y + W / 2, -0.05], [x + Lh + 0.75, y + W / 2, 0.49], [x + Lh, y, 0.49]], I.shade(C.hull, 0.58));
    I.face(g, [[x + Lh, y + W, -0.05], [x + Lh + 0.75, y + W / 2, -0.05], [x + Lh + 0.75, y + W / 2, 0.49], [x + Lh, y + W, 0.49]], I.shade(C.hull, 0.72));
    I.face(g, [[x + Lh, y, 0.49], [x + Lh + 0.75, y + W / 2, 0.49], [x + Lh, y + W, 0.49]], C.hull);
    var cols = [C.terra, C.olive, C.sand, C.terra, C.sand, C.olive];
    for (var r = 0; r < 2; r++) for (var k = 0; k < 3; k++) I.box(g, x + 0.75 + k * 0.68, y + 0.06 + r * W / 2, 0.49, 0.6, W / 2 - 0.08, 0.32 + ((k + r) % 2) * 0.16, cols[(k + r * 3) % 6]);
    I.box(g, x + 0.1, y + 0.08, 0.49, 0.5, W - 0.16, 0.92, C.body);
    I.face(g, [[x + 0.6, y + 0.15, 1.18], [x + 0.6, y + W - 0.15, 1.18], [x + 0.6, y + W - 0.15, 1.28], [x + 0.6, y + 0.15, 1.28]], C.glass, { stroke: "none" });
    I.ln(g, [x + 0.3, y + W / 2, 1.41], [x + 0.3, y + W / 2, mastH], { "stroke-width": 1 });
    var d = P(x + 0.3, y + W / 2, mastH + 0.08);
    mk("ellipse", { cx: d[0].toFixed(1), cy: d[1].toFixed(1), rx: 5.5, ry: 3.6, fill: C.body, stroke: C.beige, "stroke-width": 0.7 }, g);
  }
  SCENES["VM-1"] = {
    tile: "voice",
    build: function (L, story) {
      I.slab(L.base, 14, 7, "#37393E");
      var G = L.ground, B = L.back;
      I.flat(G, 0, 3.3, 14, 3.7, "#202327", { stroke: "rgba(194,155,114,.35)" });
      for (var i = 0; i < 6; i++) { var wy = 3.75 + i * 0.55; I.ln(G, [0.3 + (i % 3) * 0.6, wy, 0], [13.6, wy, 0], { "stroke-opacity": 0.2, "stroke-dasharray": "3 10", "stroke-width": 0.8 }); }
      I.ln(G, [0, 3.3, 0.01], [14, 3.3, 0.01], { "stroke-opacity": 0.7, "stroke-width": 1 });
      for (var bx = 0.6; bx < 13.5; bx += 1.15) I.box(B, bx, 3.08, 0, 0.12, 0.12, 0.12, C.pale);
      var cols = [C.terra, C.olive, C.sand, C.steel, C.terra, C.sand];
      for (var a = 0; a < 5; a++) for (var b = 0; b < 2; b++) I.box(B, 0.4 + a * 0.68, 0.35 + b * 0.62, 0, 0.6, 0.52, 0.4 + ((a + b) % 3) * 0.38, cols[(a + b * 2) % 6]);
      for (var a2 = 0; a2 < 3; a2++) I.box(B, 9.5 + a2 * 0.68, 0.4, 0, 0.6, 0.52, 0.4 + (a2 % 2) * 0.4, cols[(a2 + 1) % 6]);
      crane(B, 4.3, 1.0, 1.4, 1.8, 4.6);
      crane(B, 7.6, 1.0, 1.4, 1.8, 4.6);
      /* coastal cell tower (B) */
      var rC = I.rings(G, 12.62, 2.08, 2);
      var mB = I.mast(B, 12.4, 1.9, 3.8);
      mastBadge(L, mB, "B");
      var sg = mk("g", {}, L.mover);
      ship(sg, 0, 3.95, 3.7, 1.0, 1.95);
      var x = 0, ant = [0, 0];
      var sat = leo(L, "A", story);
      return {
        update: function (t, s) {
          x = -0.3 + 9.8 * uOf(story, t);
          var d = P(x, 0, 0);
          sg.setAttribute("transform", "translate(" + d[0].toFixed(1) + "," + (d[1] + Math.sin(t * 2.2) * 0.8).toFixed(1) + ")");
          ant = P(x + 0.3, 4.45, 2.1); ant[1] += Math.sin(t * 2.2) * 0.8;
          sat.update(t, !s.aUp);
          I.ringsAt(rC, t, 1, false);
        },
        pathA: function () { return [ant, sat.point()]; },
        pathB: function () { return [ant, mB]; },
        sig: function () { return ant; },
        brkA: { seg: 0, f: 0.32 },
        moving: true
      };
    }
  };

  /* ------------------------------------------------------------------ VM-2 */
  function train(g, x, y, len, d) {
    var n = 3, gap = 0.12, cl = (len - gap * (n - 1)) / n;
    for (var i = 0; i < n; i++) {
      var cx = x + i * (cl + gap);
      I.box(g, cx, y, 0.08, cl, d, 0.6, C.body);
      I.face(g, [[cx + 0.1, y + d, 0.38], [cx + cl - 0.1, y + d, 0.38], [cx + cl - 0.1, y + d, 0.52], [cx + 0.1, y + d, 0.52]], C.glass, { stroke: "none" });
      I.face(g, [[cx, y + d, 0.18], [cx + cl, y + d, 0.18], [cx + cl, y + d, 0.25], [cx, y + d, 0.25]], C.terra, { stroke: "none" });
    }
    var hx = x + len;
    I.face(g, [[hx, y + 0.1, 0.36], [hx, y + d - 0.1, 0.36], [hx, y + d - 0.1, 0.55], [hx, y + 0.1, 0.55]], C.glass, { stroke: "none" });
    I.ln(g, [hx - 0.35, y + d / 2, 0.68], [hx - 0.35, y + d / 2, 0.92], { stroke: C.pale, "stroke-width": 1 });
  }
  SCENES["VM-2"] = {
    tile: "voice",
    build: function (L, story) {
      I.slab(L.base, 14, 7, "#33362D");
      var G = L.ground, B = L.back, F = L.front;
      I.flat(G, 0.4, 0.4, 3.6, 1.8, C.olive, { stroke: "rgba(194,155,114,.25)" }); furrows(G, 0.4, 0.4, 3.6, 1.8, 0.3);
      I.flat(G, 10.2, 5.4, 3.4, 1.4, C.olive, { stroke: "rgba(194,155,114,.25)" }); furrows(G, 10.2, 5.4, 3.4, 1.4, 0.3);
      /* track: ballast, sleepers, rails */
      I.flat(G, 0, 3.3, 14, 1.1, "#3A3833", { stroke: "rgba(194,155,114,.3)" });
      for (var sx = 0.12; sx < 14; sx += 0.28) I.ln(G, [sx, 3.42, 0.01], [sx, 4.28, 0.01], { "stroke-opacity": 0.3, "stroke-width": 1.1 });
      I.ln(G, [0, 3.58, 0.02], [14, 3.58, 0.02], { "stroke-opacity": 0.7, "stroke-width": 0.8 });
      I.ln(G, [0, 4.12, 0.02], [14, 4.12, 0.02], { "stroke-opacity": 0.7, "stroke-width": 0.8 });
      /* station platform at the start of the line */
      I.box(B, 0.3, 2.5, 0, 3.0, 0.7, 0.22, C.gray);
      I.box(B, 1.0, 2.55, 0.22, 1.3, 0.4, 0.5, C.cream);
      I.box(B, 0.9, 2.5, 0.72, 1.5, 0.5, 0.06, C.terra);
      [[5.0, 0.9], [8.6, 0.7], [10.6, 0.4], [6.6, 6.0], [3.0, 5.9], [8.8, 6.1]].forEach(function (q) { I.tree(q[1] > 4 ? F : B, q[0], q[1]); });
      var rA = I.rings(G, 2.62, 1.48, 2), rB = I.rings(G, 12.22, 1.78, 2);
      var m1 = I.mast(B, 2.4, 1.3, 3.6), m2 = I.mast(B, 12.0, 1.6, 3.6);
      mastBadge(L, m1, "A"); mastBadge(L, m2, "A");
      var masts = [{ gx: 2.6, top: m1 }, { gx: 12.2, top: m2 }];
      /* the rural cutting: a high bank behind the track and a low bank in front */
      I.prism(B, 4.8, 1.95, 0, 4.4, 1.35, 1.25, "#4C4E42");
      var tg = mk("g", {}, L.mover);
      train(tg, 0, 3.45, 4.2, 0.8);
      I.prism(F, 4.8, 4.4, 0, 4.4, 1.1, 0.5, "#4C4E42");
      var x = 0, ant = [0, 0];
      var sat = leo(L, "B", story);
      return {
        update: function (t, s) {
          x = -0.8 + 9.2 * uOf(story, t);
          var d = P(x, 0, 0);
          tg.setAttribute("transform", "translate(" + d[0].toFixed(1) + "," + d[1].toFixed(1) + ")");
          ant = P(x + 3.85, 3.85, 0.95);
          sat.update(t, false);
          I.ringsAt(rA, t, 1, false); I.ringsAt(rB, t + 0.5, 1, false);
        },
        pathA: function () { return [ant, nearest(masts, x + 3.85).top]; },
        pathB: function () { return [ant, sat.point()]; },
        sig: function () { return ant; },
        brkA: { seg: 0, f: 0.45 },
        moving: true
      };
    }
  };

  /* ------------------------------------------------------------------ DS-1 */
  function convoy(g, x, y, d) {
    var n = 3, gap = 0.14, len = 1.08;
    for (var i = 0; i < n; i++) {
      var tx = x + i * (len + gap), cab = 0.3;
      I.wheels(g, [[tx + 0.2, y + d, 0.12, 3.2], [tx + 0.5, y + d, 0.12, 3.2], [tx + len - 0.2, y + d, 0.12, 3.2]]);
      I.box(g, tx, y, 0.14, len - cab - 0.02, d, 0.5, C.olive);
      I.prism(g, tx, y, 0.64, len - cab - 0.02, d, 0.16, C.oliveLit);
      I.box(g, tx + len - cab, y + 0.04, 0.14, cab, d - 0.08, 0.42, C.oliveLit);
      I.face(g, [[tx + len, y + 0.1, 0.36], [tx + len, y + d - 0.1, 0.36], [tx + len, y + d - 0.1, 0.5], [tx + len, y + 0.1, 0.5]], C.glass, { stroke: "none" });
      I.ln(g, [tx + len - 0.15, y + 0.12, 0.56], [tx + len - 0.3, y + 0.12, 1.15], { stroke: C.pale, "stroke-width": 0.7 });
    }
    return n * len + (n - 1) * gap;
  }
  SCENES["DS-1"] = {
    tile: "voice",
    build: function (L, story) {
      I.slab(L.base, 14, 7, "#3F3933");
      var G = L.ground, B = L.back;
      [[[1.0, 5.4], [4.0, 5.1]], [[5.0, 6.2], [8.6, 5.9]], [[9.6, 5.5], [13.2, 5.2]], [[7.4, 2.9], [10.4, 2.7]], [[2.6, 6.4], [5.6, 6.5]]].forEach(function (d) { dune(G, d[0], d[1]); });
      road(G, 3.55, 1.1, 0, 14, "#2E2A26");
      var town = "#6E5D4A", town2 = "#7A6852";
      I.building(B, 0.3, 0.5, 1.1, 1.0, 0.9, town); I.building(B, 1.5, 0.4, 0.9, 1.2, 1.3, town2); I.building(B, 0.4, 1.8, 1.2, 0.9, 0.7, town);
      /* the ridge that briefly blocks the satellite */
      I.prism(B, 4.0, 0.3, 0, 3.4, 2.6, 2.3, C.rock);
      I.prism(B, 5.5, 1.1, 0, 2.4, 2.2, 1.5, "#574C42");
      I.building(B, 11.7, 0.4, 1.1, 1.0, 1.1, town2); I.building(B, 12.9, 0.5, 0.8, 1.2, 1.5, town); I.building(B, 11.9, 1.7, 1.3, 0.8, 0.8, town);
      var rA = I.rings(G, 2.82, 2.38, 2), rB = I.rings(G, 11.32, 2.58, 2);
      var m1 = I.mast(B, 2.6, 2.2, 3.6), m2 = I.mast(B, 11.1, 2.4, 3.6);
      mastBadge(L, m1, "A"); mastBadge(L, m2, "A");
      var masts = [{ gx: 2.8, top: m1 }, { gx: 11.3, top: m2 }];
      [[9.2, 1.4], [3.4, 5.9], [12.4, 6.1]].forEach(function (q) { I.box(q[1] > 4 ? L.front : B, q[0], q[1], 0, 0.28, 0.28, 0.14, C.sand); });
      var cg = mk("g", {}, L.mover);
      var clen = convoy(cg, 0, 3.7, 0.72);
      var x = 0, ant = [0, 0];
      var sat = leo(L, "B", story);
      return {
        update: function (t, s) {
          x = -0.6 + 10.0 * uOf(story, t);
          var d = P(x, 0, 0);
          cg.setAttribute("transform", "translate(" + d[0].toFixed(1) + "," + (d[1] + Math.sin(t * 13) * 0.4).toFixed(1) + ")");
          ant = P(x + clen - 0.25, 3.82, 1.17);
          sat.update(t, !s.bUp);
          I.ringsAt(rA, t, 1, false); I.ringsAt(rB, t + 0.5, 1, false);
        },
        pathA: function () { return [ant, nearest(masts, x + clen).top]; },
        pathB: function () { return [ant, sat.point()]; },
        sig: function () { return ant; },
        brkA: { seg: 0, f: 0.5 },
        brkB: { seg: 0, f: 0.4 },
        moving: true
      };
    }
  };

  /* ------------------------------------------------------------------ DS-2 */
  SCENES["DS-2"] = {
    tile: "posts",
    build: function (L, story) {
      I.slab(L.base, 14, 7, "#3A3732");
      var G = L.ground, B = L.back, F = L.front;
      var wall = C.sand, wh = 0.32, t0 = 0.16;
      I.flat(G, 1.0, 1.0, 5.6, 4.2, "#433E36", { stroke: "rgba(194,155,114,.25)" });
      /* terrestrial provider line leaving the slab, behind the microwave tower */
      I.ln(G, [11.62, 1.18, 0.01], [14, 1.18, 0.01], { "stroke-opacity": 0.5, "stroke-dasharray": "4 3", "stroke-width": 1 });
      [[8.0, 4.6], [9.8, 5.8], [12.6, 4.4], [7.4, 1.2]].forEach(function (q) { I.box(G, q[0], q[1], 0, 0.5, 0.4, 0.22, C.rock); });
      dune(G, [8.4, 6.2], [12.0, 6.0], 7);
      /* the base: perimeter, tents, a building, a truck, the comms mast, and the satellite dish (B) */
      I.box(B, 1.0, 1.0, 0, 5.6, t0, wh, wall);
      I.box(B, 1.0, 1.0 + t0, 0, t0, 4.2 - 2 * t0, wh, wall);
      I.prism(B, 1.5, 1.5, 0, 1.3, 1.0, 0.6, C.olive);
      I.prism(B, 1.5, 2.7, 0, 1.3, 1.0, 0.6, C.olive);
      I.box(B, 3.4, 1.4, 0, 1.5, 0.6, 0.55, C.olive);
      I.box(B, 3.4, 2.4, 0, 1.6, 1.0, 0.75, "#7A6852", { top: C.cream });
      var mastTop = I.mast(B, 5.4, 1.5, 3.0);
      I.box(B, 5.75, 1.55, 2.3, 0.12, 0.32, 0.32, C.pale);
      var mw = P(5.87, 1.71, 2.46);
      I.cyl(B, 5.5, 4.2, 0, 0.28, 0.5, C.steel);
      I.vanX(B, 3.2, 3.85, 1.6, 0.7, 0.6, 0.45, 0.5, C.olive);
      var dB = I.dish(B, 2.0, 4.3, 0.55, 11, -34);
      I.box(B, 6.6 - t0, 1.0 + t0, 0, t0, 4.2 - 2 * t0, wh, wall);
      I.box(B, 1.0, 5.2 - t0, 0, 2.3, t0, wh, wall);
      I.box(B, 4.3, 5.2 - t0, 0, 2.3, t0, wh, wall);
      /* the microwave tower of the terrestrial provider (A) */
      var mTop = I.mast(B, 11.4, 1.0, 4.2);
      I.box(B, 11.28, 1.06, 3.4, 0.12, 0.32, 0.32, C.pale);
      var tw = P(11.3, 1.22, 3.56);
      mastBadge(L, mTop, "A");
      /* rain clouds drifting over the site */
      var c1 = I.cloud(L.skym), c2 = I.cloud(L.skym);
      var sat = leo(L, "B", story);
      return {
        update: function (t, s) {
          var u = uOf(story, t);
          var x1 = -150 + 300 * ((u + 0.15) % 1), x2 = -150 + 300 * ((u + 0.62) % 1);
          c1.g.setAttribute("transform", "translate(" + x1.toFixed(1) + ",-40)");
          c2.g.setAttribute("transform", "translate(" + x2.toFixed(1) + ",-66) scale(0.8)");
          var dy = ((t * 30) % 8).toFixed(1);
          c1.rain.setAttribute("transform", "translate(0," + dy + ")"); c2.rain.setAttribute("transform", "translate(0," + dy + ")");
          sat.update(t, false);
        },
        pathA: function () { return [mw, tw]; },
        pathB: function () { return [dB, sat.point()]; },
        sig: function () { return mastTop; },
        brkA: { seg: 0, f: 0.55 }
      };
    }
  };

  window.SCENES = SCENES;
})();
