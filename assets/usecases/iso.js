/* Masarain in the field: isometric drawing helpers.
   Adapted from the atlas diorama (atlas/final/js/diorama.js) and mockup 3 (redo_mockups/opt3_isometric_loop).
   Grid: x runs from the back corner toward the right corner, y toward the left corner, z is height.
   One grid unit is S screen units. Everything here draws plain SVG; nothing animates in this file. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var S = 21;
  var C = {
    char: "#2B2D31", char2: "#25272B", char3: "#1E2023", beige: "#C29B72", white: "#F2ECE4",
    olive: "#3A4027", oliveLit: "#4B5233", oliveLt: "#A9B07E", terra: "#8D321F", risk: "#C4573A", riskText: "#E8896A",
    orange: "#FF4F00", text2: "#BEBAB5", text3: "#9E9C99",
    slab: "#34363B", city: "#3C3E44", body: "#E9E1D6", cream: "#CDBFAE", gray: "#45474D", steel: "#5A5C62",
    glass: "#22252A", sand: "#8C7356", pale: "#BDB4A8", hull: "#3F4247", flame: "#A8452C", rock: "#4F463E"
  };
  var EDGE = "rgba(194,155,114,.5)";

  function P(x, y, z) { return [(x - y) * S, (x + y) * S * 0.5 - (z || 0) * S]; }
  function mk(tag, attrs, parent, text) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function attr(e, a) { for (var k in a) e.setAttribute(k, a[k]); }
  function xy(q) { return q[0].toFixed(1) + "," + q[1].toFixed(1); }
  function fmt(arr) { return arr.map(function (p) { return xy(P(p[0], p[1], p[2] || 0)); }).join(" "); }
  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    r = Math.min(255, Math.round(r * f)); g = Math.min(255, Math.round(g * f)); b = Math.min(255, Math.round(b * f));
    return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }
  function face(g, pts, fill, o) {
    o = o || {};
    return mk("polygon", { points: fmt(pts), fill: fill, stroke: o.stroke || EDGE, "stroke-width": o.sw || 0.6, "stroke-linejoin": "round" }, g);
  }
  function flat(g, x, y, w, d, fill, o) {
    return face(g, [[x, y, o && o.z || 0], [x + w, y, o && o.z || 0], [x + w, y + d, o && o.z || 0], [x, y + d, o && o.z || 0]], fill, o);
  }
  function box(g, x, y, z, w, d, h, c, o) {
    o = o || {};
    face(g, [[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], o.left || shade(c, 0.76), o);
    face(g, [[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], o.right || shade(c, 0.58), o);
    face(g, [[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], o.top || c, o);
  }
  /* a roof or ridge running along x */
  function prism(g, x, y, z, w, d, h, c) {
    face(g, [[x, y, z], [x + w, y, z], [x + w, y + d / 2, z + h], [x, y + d / 2, z + h]], shade(c, 0.86));
    face(g, [[x + w, y, z], [x + w, y + d, z], [x + w, y + d / 2, z + h]], shade(c, 0.56));
    face(g, [[x, y + d, z], [x + w, y + d, z], [x + w, y + d / 2, z + h], [x, y + d / 2, z + h]], c);
  }
  function cyl(g, cx, cy, z, r, h, c, rt) {
    rt = rt || r;
    var b = P(cx, cy, z), t = P(cx, cy, z + h), rx = r * S * 1.4142, ry = rx / 2, rx2 = rt * S * 1.4142;
    var midY = (b[1] + t[1]) / 2;
    var d = "M" + (b[0] - rx) + "," + b[1] + " Q" + (b[0] - rx2 * 0.86) + "," + midY + " " + (t[0] - rx2) + "," + t[1] +
      " L" + (t[0] + rx2) + "," + t[1] + " Q" + (b[0] + rx2 * 0.86) + "," + midY + " " + (b[0] + rx) + "," + b[1] +
      " A" + rx + "," + ry + " 0 0 1 " + (b[0] - rx) + "," + b[1] + "Z";
    mk("path", { d: d, fill: shade(c, 0.7), stroke: EDGE, "stroke-width": 0.6 }, g);
    mk("ellipse", { cx: t[0], cy: t[1], rx: rx2, ry: rx2 / 2, fill: c, stroke: EDGE, "stroke-width": 0.6 }, g);
  }
  function ln(g, a, b, attrs) {
    var p = P(a[0], a[1], a[2] || 0), q = P(b[0], b[1], b[2] || 0);
    var o = { x1: p[0].toFixed(1), y1: p[1].toFixed(1), x2: q[0].toFixed(1), y2: q[1].toFixed(1), stroke: C.beige, "stroke-width": 0.8 };
    if (attrs) for (var k in attrs) o[k] = attrs[k];
    return mk("line", o, g);
  }
  function wheels(g, list) {
    list.forEach(function (w) {
      var q = P(w[0], w[1], w[2]), r = w[3] || 3.4;
      mk("ellipse", { cx: q[0].toFixed(1), cy: q[1].toFixed(1), rx: r, ry: r * 1.1, fill: "#151618", stroke: C.beige, "stroke-width": 0.5 }, g);
    });
  }
  /* a van or truck along x: body plus a cab at the front (x + len) */
  function vanX(g, x, y, len, wid, h, cabLen, cabH, color, o) {
    o = o || {};
    var wz = 0.12;
    wheels(g, [[x + 0.32, y + wid, wz], [x + len - 0.3, y + wid, wz]]);
    box(g, x, y, wz, len - cabLen, wid, h, color);
    box(g, x + len - cabLen, y, wz, cabLen, wid, cabH, o.cab || color);
    face(g, [[x + len, y + 0.08, wz + cabH * 0.45], [x + len, y + wid - 0.08, wz + cabH * 0.45], [x + len, y + wid - 0.08, wz + cabH * 0.86], [x + len, y + 0.08, wz + cabH * 0.86]], C.glass, { stroke: "none" });
    face(g, [[x + len - cabLen + 0.07, y + wid, wz + cabH * 0.5], [x + len - 0.1, y + wid, wz + cabH * 0.5], [x + len - 0.1, y + wid, wz + cabH * 0.86], [x + len - cabLen + 0.07, y + wid, wz + cabH * 0.86]], C.glass, { stroke: "none" });
    if (o.stripe) face(g, [[x, y + wid, wz + h * 0.42], [x + len - cabLen, y + wid, wz + h * 0.42], [x + len - cabLen, y + wid, wz + h * 0.56], [x, y + wid, wz + h * 0.56]], o.stripe, { stroke: "none" });
  }
  function carX(g, x, y, len, wid, color, o) {
    o = o || {};
    wheels(g, [[x + 0.24, y + wid, 0.1, 2.8], [x + len - 0.24, y + wid, 0.1, 2.8]]);
    box(g, x, y, 0.1, len, wid, 0.24, color);
    box(g, x + len * 0.24, y + 0.05, 0.34, len * 0.5, wid - 0.1, 0.2, color, { left: C.glass, right: C.glass });
    if (o.band) face(g, [[x, y + wid, 0.16], [x + len, y + wid, 0.16], [x + len, y + wid, 0.24], [x, y + wid, 0.24]], o.band, { stroke: "none" });
    if (o.roof) box(g, x + len * 0.4, y + wid * 0.3, 0.54, len * 0.18, wid * 0.4, o.roofH || 0.06, o.roof);
  }
  function miniDrone(g, c, s) {
    var arms = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    arms.forEach(function (o) { ln(g, c, [c[0] + o[0] * 0.48 * s, c[1] + o[1] * 0.48 * s, c[2] + 0.08 * s], { stroke: C.white, "stroke-width": 1.2 * Math.max(s, 0.6) }); });
    box(g, c[0] - 0.2 * s, c[1] - 0.2 * s, c[2] - 0.05 * s, 0.4 * s, 0.4 * s, 0.16 * s, C.body);
    var rotors = [];
    arms.forEach(function (o) {
      var q = P(c[0] + o[0] * 0.48 * s, c[1] + o[1] * 0.48 * s, c[2] + 0.12 * s);
      rotors.push(mk("ellipse", { cx: q[0].toFixed(1), cy: q[1].toFixed(1), rx: (8 * s).toFixed(1), ry: (4 * s).toFixed(1), fill: "rgba(242,236,228,.12)", stroke: C.beige, "stroke-width": 0.8 }, g));
    });
    box(g, c[0] - 0.08 * s, c[1] - 0.08 * s, c[2] - 0.22 * s, 0.16 * s, 0.16 * s, 0.16 * s, C.terra);
    return rotors;
  }
  function flame(g, x, y, z, h, w) {
    var bl = P(x - w / 2, y, z), br = P(x + w / 2, y, z), tip = P(x, y, z + h), ml = P(x - w * 0.15, y, z + h * 0.55), mr = P(x + w * 0.25, y, z + h * 0.45);
    return mk("path", { d: "M" + xy(bl) + " Q" + xy(ml) + " " + xy(tip) + " Q" + xy(mr) + " " + xy(br) + " Z", fill: C.flame, stroke: C.terra, "stroke-width": 0.8 }, g);
  }
  /* lattice mast; returns the screen point at the top, where beams attach */
  function mast(g, x, y, h, o) {
    o = o || {};
    var legs = [[x, y], [x + 0.45, y], [x + 0.22, y + 0.4]];
    legs.forEach(function (l) { ln(g, [l[0], l[1], 0], [x + 0.22, y + 0.18, h], { "stroke-width": 0.9 }); });
    for (var z = 0.6; z < h - 0.3; z += 0.7) {
      var f = 1 - z / h;
      ln(g, [x + 0.22 - 0.22 * f, y + 0.18 - 0.18 * f, z], [x + 0.22 + 0.23 * f, y + 0.18 - 0.18 * f, z], { "stroke-width": 0.5, "stroke-opacity": 0.6 });
    }
    box(g, x + 0.08, y + 0.05, h - 0.1, 0.28, 0.26, 0.42, o.head || C.body);
    return P(x + 0.22, y + 0.18, h + 0.36);
  }
  /* power pylon with two crossarms; returns the two arm tips at each side */
  function pylon(g, x, y, h) {
    var legs = [[x - 0.25, y - 0.25], [x + 0.25, y - 0.25], [x - 0.25, y + 0.25], [x + 0.25, y + 0.25]];
    legs.forEach(function (l) { ln(g, [l[0], l[1], 0], [x, y, h], { stroke: C.pale, "stroke-width": 0.9 }); });
    for (var z = 0.5; z < h - 0.4; z += 0.55) {
      var f = 1 - z / h;
      ln(g, [x - 0.25 * f, y + 0.25 * f, z], [x + 0.25 * f, y + 0.25 * f, z + 0.4], { stroke: C.pale, "stroke-width": 0.5, "stroke-opacity": 0.7 });
    }
    ln(g, [x, y - 0.75, h - 0.35], [x, y + 0.75, h - 0.35], { stroke: C.pale, "stroke-width": 1.1 });
    ln(g, [x, y - 0.5, h - 0.05], [x, y + 0.5, h - 0.05], { stroke: C.pale, "stroke-width": 1 });
    return [[x, y - 0.72, h - 0.38], [x, y + 0.72, h - 0.38], [x, y - 0.48, h - 0.08], [x, y + 0.48, h - 0.08]];
  }
  /* sagging wire between two grid points */
  function wire(g, a, b, sag) {
    var p = P(a[0], a[1], a[2]), q = P(b[0], b[1], b[2]);
    var m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 + (sag || 7)];
    return mk("path", { d: "M" + xy(p) + " Q" + xy(m) + " " + xy(q), fill: "none", stroke: C.beige, "stroke-opacity": 0.55, "stroke-width": 0.6 }, g);
  }
  function tree(g, x, y, s) {
    s = s || 1;
    ln(g, [x + 0.22 * s, y + 0.22 * s, 0], [x + 0.22 * s, y + 0.22 * s, 0.2 * s], { stroke: C.sand, "stroke-width": 1.3 });
    box(g, x, y, 0.18 * s, 0.44 * s, 0.44 * s, 0.34 * s, C.olive, { top: C.oliveLit });
  }
  function shrub(g, x, y) { box(g, x, y, 0, 0.3, 0.3, 0.16, C.olive, { top: C.oliveLit }); }
  function building(g, x, y, w, d, h, c) {
    box(g, x, y, 0, w, d, h, c || C.city);
    for (var z = 0.4; z < h - 0.15; z += 0.4) {
      ln(g, [x + 0.12, y + d, z], [x + w - 0.12, y + d, z], { "stroke-opacity": 0.28, "stroke-width": 0.6 });
      ln(g, [x + w, y + 0.12, z], [x + w, y + d - 0.12, z], { "stroke-opacity": 0.2, "stroke-width": 0.6 });
    }
  }
  /* a dish seen in isometric view: an ellipse on a short post, tilted toward the sky */
  function dish(g, x, y, z, r, tilt) {
    var b = P(x, y, z);
    ln(g, [x, y, 0], [x, y, z], { stroke: C.pale, "stroke-width": 1.1 });
    mk("ellipse", { cx: b[0].toFixed(1), cy: (b[1] - 2).toFixed(1), rx: r, ry: r * 0.5, fill: C.pale, stroke: C.beige, "stroke-width": 0.7,
      transform: "rotate(" + (tilt == null ? -28 : tilt) + " " + b[0].toFixed(1) + " " + (b[1] - 2).toFixed(1) + ")" }, g);
    return [b[0], b[1] - 4];
  }
  /* LEO satellite glyph in screen units */
  function satGlyph(g, s) {
    var t = mk("g", {}, g);
    mk("polygon", { points: "-34,-4 -12,-12 -12,0 -34,8", fill: "#3A3C41", stroke: C.beige, "stroke-width": 0.8 }, t);
    mk("polygon", { points: "12,-12 34,-20 34,-8 12,0", fill: "#3A3C41", stroke: C.beige, "stroke-width": 0.8 }, t);
    for (var i = 0; i < 3; i++) {
      mk("line", { x1: -34 + i * 7.3, y1: -4 - i * 2.6, x2: -34 + i * 7.3, y2: 8 - i * 2.6, stroke: C.beige, "stroke-width": 0.4, opacity: 0.6 }, t);
      mk("line", { x1: 12 + i * 7.3, y1: -12 - i * 2.6, x2: 12 + i * 7.3, y2: -i * 2.6, stroke: C.beige, "stroke-width": 0.4, opacity: 0.6 }, t);
    }
    mk("polygon", { points: "-8,-8 0,-12 8,-8 8,2 0,6 -8,2", fill: C.body, stroke: C.beige, "stroke-width": 0.8 }, t);
    mk("line", { x1: 0, y1: 6, x2: 0, y2: 12, stroke: C.white, "stroke-width": 1 }, t);
    t.setAttribute("transform", "scale(" + (s || 0.7) + ")");
    return t;
  }
  /* a rain cloud in screen units, centered at 0,0 */
  function cloud(g) {
    var t = mk("g", {}, g);
    var rain = mk("g", { stroke: C.beige, "stroke-opacity": 0.45, "stroke-width": 0.8 }, t);
    for (var i = 0; i < 9; i++) {
      var x = -26 + i * 6.5;
      mk("line", { x1: x, y1: 8 + (i % 3) * 4, x2: x - 5, y2: 22 + (i % 3) * 4 }, rain);
    }
    [[-16, 2, 14, 8], [0, -4, 18, 11], [16, 2, 14, 8], [4, 5, 26, 7]].forEach(function (e) {
      mk("ellipse", { cx: e[0], cy: e[1], rx: e[2], ry: e[3], fill: "#4A4C52", stroke: C.beige, "stroke-opacity": 0.45, "stroke-width": 0.7 }, t);
    });
    return { g: t, rain: rain };
  }
  /* a person standing, in screen units, at grid point (x, y) */
  function person(g, x, y, col) {
    var p = P(x, y, 0);
    mk("line", { x1: p[0].toFixed(1), y1: p[1].toFixed(1), x2: p[0].toFixed(1), y2: (p[1] - 7).toFixed(1), stroke: col || C.pale, "stroke-width": 2, "stroke-linecap": "round" }, g);
    mk("circle", { cx: p[0].toFixed(1), cy: (p[1] - 9.5).toFixed(1), r: 1.7, fill: col || C.pale }, g);
  }
  /* coverage rings drawn on the ground around a mast foot; animate with ringsAt() */
  function rings(g, x, y, n) {
    var c = P(x, y, 0), out = [];
    for (var i = 0; i < (n || 2); i++) out.push({ e: mk("ellipse", { cx: c[0].toFixed(1), cy: c[1].toFixed(1), fill: "none", stroke: C.beige, "stroke-width": 1 }, g), i: i, n: n || 2 });
    return out;
  }
  function ringsAt(list, t, strength, risky, reach) {
    list.forEach(function (r) {
      var f = ((t * 0.5 + r.i / r.n) % 1), rad = (0.6 + f * (reach || 2.6) * (0.35 + 0.65 * strength)) * S * 1.4142;
      attr(r.e, { rx: rad.toFixed(1), ry: (rad / 2).toFixed(1), "stroke-opacity": (0.42 * (1 - f) * (0.25 + 0.75 * strength)).toFixed(2), stroke: risky ? C.risk : C.beige });
    });
  }
  /* path badge "A" or "B": a small circle with the letter */
  function badge(g, letter) {
    var t = mk("g", { "class": "iso-badge" }, g);
    var c = mk("circle", { r: 8.5, fill: C.char3, stroke: letter === "A" ? C.beige : C.oliveLt, "stroke-width": 1.2 }, t);
    var tx = mk("text", { y: 0.5, "text-anchor": "middle", "dominant-baseline": "central", "class": "svg-badge", fill: letter === "A" ? C.beige : C.oliveLt }, t, letter);
    return { g: t, c: c, t: tx, letter: letter, at: function (p, dx, dy) { t.setAttribute("transform", "translate(" + (p[0] + (dx || 0)).toFixed(1) + "," + (p[1] + (dy || 0)).toFixed(1) + ")"); } };
  }
  /* the slab every vignette stands on */
  function slab(g, W, D, ground, plinth) {
    var T0 = -(plinth || 0.6);
    face(g, [[0, D, T0], [W, D, T0], [W, D, 0], [0, D, 0]], "#26282C", { stroke: "rgba(194,155,114,.6)" });
    face(g, [[W, 0, T0], [W, D, T0], [W, D, 0], [W, 0, 0]], "#1F2124", { stroke: "rgba(194,155,114,.6)" });
    face(g, [[0, 0, 0], [W, 0, 0], [W, D, 0], [0, D, 0]], ground || C.slab, { stroke: "rgba(194,155,114,.7)", sw: 1 });
    for (var gx = 1; gx < W; gx++) ln(g, [gx, 0, 0], [gx, D, 0], { "stroke-opacity": 0.06, "stroke-width": 0.6 });
    for (var gy = 1; gy < D; gy++) ln(g, [0, gy, 0], [W, gy, 0], { "stroke-opacity": 0.06, "stroke-width": 0.6 });
  }

  window.ISO = {
    S: S, C: C, EDGE: EDGE, P: P, mk: mk, attr: attr, xy: xy, fmt: fmt, shade: shade, face: face, flat: flat, box: box, prism: prism,
    cyl: cyl, ln: ln, wheels: wheels, vanX: vanX, carX: carX, miniDrone: miniDrone, flame: flame, mast: mast, pylon: pylon, wire: wire,
    tree: tree, shrub: shrub, building: building, dish: dish, satGlyph: satGlyph, cloud: cloud, person: person, rings: rings,
    ringsAt: ringsAt, badge: badge, slab: slab
  };
})();
