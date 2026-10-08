/* Masarain live simulation.
   Live mode: the team's demo server runs the real prototype and this page polls its state.
   Recorded mode: without the server, the page replays the finished runs stored in assets/recorded.js, one per route.
   Both modes feed the same drawing code, so the picture is identical. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const css = getComputedStyle(document.documentElement);
  const tok = name => css.getPropertyValue(name).trim();
  const C = { ground: tok("--ground"), surface: tok("--surface"), ink: tok("--ink"), ink2: tok("--ink-2"), rule: tok("--rule"), call: tok("--call"),
              copy: tok("--copy"), zone: tok("--zone"), zone2: tok("--zone-2"), contour: tok("--contour") };
  const MONO = tok("--font-mono"), BODY = tok("--font-body");
  const KIND = { wifi: "Wi-Fi", cell: "5G", sat: "the satellite link", wired: "the cable" };
  const LANE = { sig: [0, 78], risk: [78, 56], L: [134, 52], R: [186, 52], cop: [238, 44] }, TL_H = 282, ROUTE_H = 150;
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const INTRO = "Both methods carry the same voice call, 50 packets per second, through the same emulated networks at the same time.";
  // recorded runs by route; simulation.html?route=drive&t=31 opens one of them at a given second
  const recs = window.MASARAIN_RECORDINGS || (window.MASARAIN_RECORDED ? { [window.MASARAIN_RECORDED.preset]: window.MASARAIN_RECORDED } : {});
  let rec = window.MASARAIN_RECORDED || Object.values(recs)[0] || null;

  let live = false, trace = null, st = null, presetShown = null, busy = false, polledAt = 0, lastCaption = "";
  let playing = false, tRec = 0, lastFrame = 0, raf = 0;

  /* ------------------------------------------------------------------ canvas helpers */
  function fit(canvas, h) {
    const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth;
    canvas.style.height = h + "px";
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    return [g, w];
  }
  const text = (g, s, x, y, o = {}) => {
    g.font = (o.weight || 400) + " " + (o.size || 11) + "px " + (o.body ? BODY : MONO);
    g.fillStyle = o.color || C.ink2; g.textAlign = o.align || "left"; g.textBaseline = "alphabetic"; g.fillText(s, x, y);
  };
  const line = (g, x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  // a right-aligned note on its own patch of surface, so it stays readable over the data
  const note = (g, s, x, y) => {
    g.font = "400 10.5px " + MONO;
    const tw = g.measureText(s).width;
    g.fillStyle = C.surface; g.fillRect(x - tw - 6, y - 11, tw + 12, 15);
    text(g, s, x, y, { align: "right", size: 10.5 });
  };
  const dbm = v => v.toFixed(0).replace("-", "−") + " dBm";
  const fmtGap = ms => ms >= 1000 ? (ms / 1000).toFixed(1) + " s" : Math.round(ms) + " ms";
  const binAt = e => Math.max(0, Math.min(trace.x.length - 1, Math.floor(e / trace.bin)));

  function elapsed() {
    if (!live) return tRec;
    if (!st || !st.started) return 0;
    return Math.min(st.seconds, st.elapsed + (st.running ? (performance.now() - polledAt) / 1000 : 0));
  }

  /* ------------------------------------------------------------------ the route */
  function drawRoute(e) {
    const [g, w] = fit($("route"), ROUTE_H);
    if (!trace) return;
    const padL = 28, padR = 28, yBand = 30, y = 96, L = trace.length, span = w - padL - padR, sx = m => padL + span * m / L;
    const n = trace.x.length, b = binAt(e), R = st && st.runs ? st.runs.right : null, thr = trace.risk_threshold || 0.05;
    // stretches of the route where Wi-Fi itself loses packets
    g.fillStyle = C.zone;
    for (let i = 0; i < n - 1; i++) {
      if (trace.wifi_loss[i] < 0.05) continue;
      const xa = sx(Math.min(trace.x[i], trace.x[i + 1])), xb = sx(Math.max(trace.x[i], trace.x[i + 1]));
      g.fillRect(xa, 50, Math.max(1, xb - xa) + 0.5, ROUTE_H - 50 - 24);
    }
    // the backup network, present along the whole route, with a mark wherever a second copy was sent
    text(g, trace.backup === "5G" ? "5G along the whole route: the backup network" : "Satellite link along the whole route: the backup network", padL, 16);
    g.fillStyle = C.rule; g.fillRect(padL, yBand - 6, span, 12);
    if (R) { g.fillStyle = C.copy; for (let i = 0; i <= b; i++) if (R.copies[i]) g.fillRect(sx(trace.x[i]) - 1, yBand - 6, 2.5, 12); }
    // access points: signal contours drawn to the scale of the route, so they cross the strip as arcs
    const r = span * 46 / L;
    g.save(); g.beginPath(); g.rect(0, 50, w, ROUTE_H - 50 - 24); g.clip();
    g.strokeStyle = C.contour; g.lineWidth = 1.25;
    trace.aps.forEach(a => [0.5, 1].forEach(f => { g.beginPath(); g.arc(sx(a), y, Math.max(0, r * f), 0, Math.PI * 2); g.stroke(); }));
    g.restore();
    trace.aps.forEach((a, k) => {
      g.fillStyle = C.ink; g.fillRect(sx(a) - 5, y - 5, 10, 10);
      text(g, "AP " + (k + 1), sx(a), y - 12, { align: "center", color: C.ink });
    });
    // the route, and the part already covered
    g.strokeStyle = C.contour; g.lineWidth = 2; line(g, padL, y, w - padR, y);
    const cx = sx(trace.x[b]);
    g.strokeStyle = C.ink; g.lineWidth = 4; line(g, sx(trace.x[0]), y, cx, y);
    // forecast cone: the ground covered within the forecast horizon; it fills when the forecast flags risk
    const ahead = sx(trace.x[Math.min(n - 1, b + Math.round((trace.horizon || 1.5) / trace.bin))]);
    const back = sx(trace.x[Math.max(0, b - 5)]), dir = ahead !== cx ? Math.sign(ahead - cx) : (cx >= back ? 1 : -1);
    const len = Math.max(18, Math.abs(ahead - cx)), risky = R && (R.risk[b] || 0) >= thr;
    g.beginPath(); g.moveTo(cx, y); g.lineTo(cx + dir * len, y - 13); g.lineTo(cx + dir * len, y + 13); g.closePath();
    if (risky) { g.fillStyle = C.copy; g.fill(); }
    else { g.setLineDash([4, 3]); g.strokeStyle = C.ink; g.lineWidth = 1.5; g.stroke(); g.setLineDash([]); }
    // the second copy leaving for the backup network
    let recent = 0;
    if (R) for (let i = Math.max(0, b - 4); i <= b; i++) recent += R.copies[i] || 0;
    if (recent > 0) { g.strokeStyle = C.copy; g.lineWidth = 3; line(g, cx, y - 11, cx, yBand + 6); }
    // the caller
    g.beginPath(); g.arc(cx, y, 8, 0, Math.PI * 2); g.fillStyle = C.ground; g.fill(); g.strokeStyle = C.call; g.lineWidth = 4; g.stroke();
    text(g, "0 m", padL, ROUTE_H - 8);
    text(g, Math.round(L) + " m", w - padR, ROUTE_H - 8, { align: "right" });
  }

  /* ------------------------------------------------------------------ the timeline */
  function drawTimeline(e) {
    const [g, w] = fit($("tl"), TL_H);
    const secs = trace ? trace.seconds : 60;
    if (trace) {                                             // where Wi-Fi itself loses packets, through every lane
      const n0 = trace.x.length, bw0 = w / n0, nb = Math.min(n0, Math.floor(e / trace.bin));
      g.fillStyle = C.zone2;
      for (let i = 0; i < nb; i++) if (trace.wifi_loss[i] >= 0.05) g.fillRect(i * bw0, 0, bw0 + 0.5, TL_H);
    }
    g.strokeStyle = C.rule; g.lineWidth = 1;
    [LANE.risk[0], LANE.L[0], LANE.R[0], LANE.cop[0]].forEach(y => line(g, 0, y - 0.5, w, y - 0.5));
    for (let s = 10; s < secs; s += 10) line(g, Math.round(w * s / secs) + 0.5, 0, Math.round(w * s / secs) + 0.5, TL_H);
    if (!trace) return;
    const n = trace.x.length, bw = w / n, nowB = Math.min(n, Math.floor(e / trace.bin));
    const runs = st && st.runs ? st.runs : {}, R = runs.right, thr = trace.risk_threshold || 0.05;

    // lane 1: the signal the device measures
    const [sy0, sh] = LANE.sig, lo = -95, hi = -45, pad = 10;
    const sy = v => sy0 + pad + (sh - 2 * pad) * (1 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo));
    g.setLineDash([4, 4]); g.strokeStyle = C.contour; line(g, 0, sy(trace.lost_below), w, sy(trace.lost_below)); g.setLineDash([]);
    g.strokeStyle = C.ink; g.lineWidth = 2; g.lineJoin = "round"; g.beginPath();
    let pen = false;
    for (let i = 0; i < nowB; i++) {
      if (!trace.associated[i]) { pen = false; continue; }
      const x = (i + 0.5) * bw, yy = sy(trace.rssi[i]);
      pen ? g.lineTo(x, yy) : g.moveTo(x, yy); pen = true;
    }
    g.stroke();
    note(g, "link drops below " + dbm(trace.lost_below), w - 6, sy0 + 16);

    // lane 2: the forecast
    const [ry0, rh] = LANE.risk, rTop = ry0 + 8, rH = rh - 14;
    if (R) {
      g.fillStyle = C.ink2;
      for (let i = 0; i < nowB; i++) { const v = Math.min(1, R.risk[i] || 0); if (v > 0) g.fillRect(i * bw, rTop + rH * (1 - v), bw + 0.5, rH * v); }
    }
    g.setLineDash([4, 4]); g.strokeStyle = C.contour; g.lineWidth = 1; line(g, 0, rTop + rH * (1 - thr), w, rTop + rH * (1 - thr)); g.setLineDash([]);
    note(g, "copies start above " + Math.round(thr * 100) + "%", w - 6, ry0 + 16);

    // lanes 3 and 4: the call as heard. Voice in time is a block; a gap is an empty slot with its edges kept.
    [["left", LANE.L], ["right", LANE.R]].forEach(([side, [y0, h]]) => {
      const run = runs[side]; if (!run) return;
      const top = y0 + 9, th = h - 18;
      for (let i = 0; i < nowB; i++) {
        const tot = run.tot[i]; if (!tot) continue;
        const good = run.ok[i] / tot, x = i * bw;
        if (good > 0) { g.fillStyle = C.call; g.fillRect(x, top + th * (1 - good), bw + 0.5, th * good); }
        if (good < 1) { g.fillStyle = C.ink2; g.fillRect(x, top, bw + 0.5, 1); if (good === 0) g.fillRect(x, top + th - 1, bw + 0.5, 1); }
      }
    });

    // lane 5: what Masarain puts on the backup network
    const [cy0, ch] = LANE.cop, cTop = cy0 + 9, cH = ch - 18;
    if (R) {
      let prim = "";
      for (let i = 0; i < nowB; i++) {
        prim = R.primary[i] || prim;
        const x = i * bw, v = Math.min(1, (R.copies[i] || 0) / 5);
        if (prim && prim !== "wifi" && R.tot[i]) { g.fillStyle = C.contour; g.fillRect(x, cTop, bw + 0.5, cH); }
        if (v > 0) { g.fillStyle = C.copy; g.fillRect(x, cTop + cH * (1 - v), bw + 0.5, cH * v); }
      }
    }
    // the present moment
    if (e > 0 && e < secs) { g.strokeStyle = C.ink; g.lineWidth = 2; line(g, w * e / secs, 0, w * e / secs, TL_H); }
  }

  function drawAxis() {
    const [g, w] = fit($("axis"), 22), secs = trace ? trace.seconds : 60;
    for (let s = 0; s <= secs; s += 10) text(g, s + " s", w * s / secs, 15, { align: s === 0 ? "left" : s >= secs ? "right" : "center" });
  }

  /* ------------------------------------------------------------------ numbers and words */
  function scores() {
    const r = st && st.runs ? st.runs : {};
    [["left", "L"], ["right", "R"]].forEach(([side, k]) => {
      const x = r[side];
      $("lost" + k).textContent = x ? x.lost_pct.toFixed(1) + "%" : "0.0%";
      $("gap" + k).textContent = x ? fmtGap(x.longest_gap_ms) : "0 ms";
      $("extra" + k).textContent = x ? Math.round(x.extra_pct) + "%" : "0%";
    });
    if (r.left) { $("nameL").textContent = r.left.name; $("laneL").textContent = r.left.name; }
  }

  function readouts(e) {
    if (!trace) return;
    const b = binAt(e), r = st && st.runs ? st.runs : {}, on = trace.associated[b];
    $("rdSig").textContent = on ? dbm(trace.rssi[b]) : "no Wi-Fi";
    // without a Wi-Fi signal there is nothing to forecast from, so the readout says so and does not print 0%
    $("rdRisk").textContent = !r.right ? "" : on ? Math.round(100 * Math.min(1, r.right.risk[b] || 0)) + "%" : "no signal";
    $("rdL").textContent = r.left ? "lost " + r.left.lost_pct.toFixed(1) + "%" : "";
    $("rdR").textContent = r.right ? "lost " + r.right.lost_pct.toFixed(1) + "%" : "";
    $("rdCopy").textContent = r.right ? Math.round(r.right.extra_pct) + "% extra" : "";
    $("routeRead").textContent = "the caller, " + trace.mover + (on ? " · Wi-Fi " + dbm(trace.rssi[b]) : " · no Wi-Fi");
  }

  const sumRange = (a, i0, i1) => { let s = 0; for (let i = Math.max(0, i0); i < Math.min(a.length, i1); i++) s += a[i] || 0; return s; };
  const lastNonEmpty = (a, i) => { for (let k = Math.min(i, a.length - 1); k >= 0; k--) if (a[k]) return a[k]; return ""; };
  function caption(e) {
    if (!st || !st.preset || !trace) return null;
    if (!live && !playing && tRec === 0) return "Press Play. " + INTRO;      // the button reads "Play" at this moment
    if (!st.started) return st.running ? "Starting the call: the two clients are connecting through the emulated networks." : null;
    const L = st.runs.left, R = st.runs.right, backup = trace.backup === "5G" ? "5G" : "the satellite link";
    if (!L || !R) return null;
    if (e >= st.seconds - 0.2 || (live && !st.running)) {
      return "Both methods met the same route and the same radio conditions. " + L.name + " lost " + L.lost_pct.toFixed(1) + "% of the call, with a longest silence of "
        + fmtGap(L.longest_gap_ms) + ". Masarain lost " + R.lost_pct.toFixed(1) + "% and sent " + Math.round(R.extra_pct) + "% extra data as copies.";
    }
    const b = Math.floor(e / trace.bin), a0 = b - 14, a1 = b - 3;
    const lTot = sumRange(L.tot, a0, a1), lLoss = lTot ? 1 - sumRange(L.ok, a0, a1) / lTot : 0;
    const rTot = sumRange(R.tot, a0, a1), rLoss = rTot ? 1 - sumRange(R.ok, a0, a1) / rTot : 0;
    const copies = sumRange(R.copies, b - 8, b + 1), risk = Math.max(0, ...R.risk.slice(Math.max(0, b - 8), b + 1));
    const rPrim = lastNonEmpty(R.primary, b), lPrim = lastNonEmpty(L.primary, b);
    if (lLoss > 0.5 && rLoss > 0.5) return "Both networks are down at this moment, so no method can deliver the call.";
    // Wi-Fi is named as the cause only when Wi-Fi itself was failing in the seconds that the loss figures cover:
    // the existing method is also silent while it reconnects, and it can lose packets on the backup network.
    let wifiBad = false;
    for (let i = Math.max(0, a0); i <= Math.min(trace.x.length - 1, b); i++) if (!trace.associated[i] || trace.wifi_loss[i] >= 0.05) wifiBad = true;
    if (lLoss > 0.5) return (wifiBad ? "Wi-Fi has failed. " : "") + L.name + " is silent, while Masarain's call continues" + (rPrim && rPrim !== "wifi" ? " over " + backup : "") + ".";
    if (wifiBad && lLoss > 0.06 && copies > 0 && !(rPrim && rPrim !== "wifi")) return "Wi-Fi is breaking up. " + L.name + " is losing voice packets; Masarain's copies over " + backup + " fill the holes.";
    if (lLoss > 0.06) return wifiBad && lPrim === "wifi" ? "Wi-Fi is breaking up, and " + L.name + " is losing voice packets." : L.name + " is losing voice packets at this moment.";
    if (rPrim && rPrim !== "wifi") return "Masarain has moved the call to " + KIND[rPrim] + ". It returns to Wi-Fi after three seconds of healthy signal.";
    // rung 2 has two triggers: the forecast (risk at or above the threshold) and a loss that was just detected
    if (copies > 0 && risk >= (trace.risk_threshold || 0.05)) return "Masarain forecasts trouble (risk " + Math.round(risk * 100) + "%) and sends a second copy of each voice packet over " + backup + ", before the loss.";
    if (copies > 0) return "Masarain has just detected a lost packet on Wi-Fi and sends second copies over " + backup + " for a short time.";
    if (lPrim && lPrim !== "wifi") return L.name + " is now carrying the call over " + KIND[lPrim] + ".";
    return "Wi-Fi is healthy (" + dbm(trace.rssi[binAt(e)]) + "). Both methods send each packet once, over Wi-Fi.";
  }

  function paint() {
    const e = elapsed(), secs = st && st.seconds ? st.seconds : (trace ? trace.seconds : 60);
    drawRoute(e); drawTimeline(e); drawAxis(); scores(); readouts(e);
    const c = caption(e);
    if (c && c !== lastCaption) { $("caption").textContent = c; lastCaption = c; }
    $("clockT").textContent = e.toFixed(1) + " s";
    const go = $("go");
    if (live) {
      $("clockNote").textContent = !st || !st.preset ? "not started" : st.running ? "of " + secs + " s" : "finished";
      go.textContent = st && st.running ? "Stop" : (st && st.preset ? "Run again" : "Run the call");
      go.classList.toggle("btn--quiet", !!(st && st.running));
      $("preset").disabled = $("left").disabled = !!(st && st.running);
    } else if (rec) {
      $("clockNote").textContent = "of " + secs + " s, recorded";
      go.textContent = playing ? "Pause" : tRec >= secs ? "Play again" : tRec > 0 ? "Resume" : "Play";
      go.classList.toggle("btn--quiet", playing);
      $("scrub").value = tRec;
      $("scrubRead").textContent = tRec.toFixed(1) + " s of " + secs + " s";
    }
  }

  /* ------------------------------------------------------------------ one clock for both modes */
  function frame(ts) {
    raf = 0;
    if (!live) {
      if (playing) {
        tRec = Math.min(rec.final.seconds, tRec + Math.min(0.25, (ts - lastFrame) / 1000));
        if (tRec >= rec.final.seconds) playing = false;
      }
      st = recState();
    }
    lastFrame = ts;
    paint();
    if (live ? st && st.running : playing) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) { lastFrame = performance.now(); raf = requestAnimationFrame(frame); } }

  // The footer names the protection that the run itself reports.
  function showProtection(mode) {
    if (mode) $("prot").textContent = mode === "aead" ? "encrypted" : "authenticated";
  }

  /* ------------------------------------------------------------------ recorded mode */
  function sampleAt(t) {
    const a = rec.samples;
    let lo = 0, hi = a.length - 1, k = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (a[m].t <= t) { k = m; lo = m + 1; } else hi = m - 1; }
    return k < 0 ? { L: [0, 0, 0], R: [0, 0, 0] } : a[k];
  }
  function recState() {
    const f = rec.final, s = sampleAt(tRec);
    const side = (run, v) => Object.assign({}, run, { lost_pct: v[0], longest_gap_ms: v[1], extra_pct: v[2] });
    return { running: playing, started: true, preset: rec.preset, seconds: f.seconds, elapsed: tRec,
             runs: { left: side(f.runs.left, s.L), right: side(f.runs.right, s.R) } };
  }
  function togglePlay() {
    if (tRec >= rec.final.seconds) tRec = 0;
    playing = !playing;
    kick();
  }
  function useRecording(key) {
    rec = recs[key]; trace = rec.trace; presetShown = key;
    showProtection(rec.protection);
    const [y, m, d] = rec.recorded_on.split("-").map(Number);
    $("mode").textContent = "Recorded run of the prototype over emulated links, " + d + " " + MONTHS[m - 1] + " " + y
      + ". A live run needs the demo server on the team's laptop.";
    $("left").value = rec.left;
    $("routeTitle").textContent = "The route: " + trace.label.charAt(0).toLowerCase() + trace.label.slice(1);
    $("scrub").max = rec.final.seconds;
    tRec = 0; playing = false;
    st = recState(); paint();
  }
  function setupRecorded() {
    const sel = $("preset"), q = new URLSearchParams(location.search);
    Object.keys(recs).forEach(k => sel.add(new Option(recs[k].trace.label, k)));
    sel.disabled = sel.options.length < 2;                    // with several recorded routes the visitor may choose
    $("left").disabled = true;
    $("title").textContent = "Recorded simulation"; document.title = "Masarain recorded simulation";
    $("transport").hidden = false;
    const first = Object.prototype.hasOwnProperty.call(recs, q.get("route")) ? q.get("route") : rec.preset;
    sel.value = first; useRecording(first);
    const at = parseFloat(q.get("t"));
    if (at > 0) tRec = Math.min(at, rec.final.seconds);
    sel.addEventListener("change", ev => useRecording(ev.target.value));
    $("go").addEventListener("click", togglePlay);
    $("restart").addEventListener("click", () => { tRec = 0; playing = true; kick(); });
    $("scrub").addEventListener("input", ev => { tRec = +ev.target.value; st = recState(); paint(); });
    document.addEventListener("keydown", ev => {
      if (ev.code !== "Space" || /^(INPUT|SELECT|BUTTON|A|TEXTAREA)$/.test(ev.target.tagName)) return;
      ev.preventDefault(); if (!ev.repeat) togglePlay();
    });
    st = recState(); paint();
  }

  /* ------------------------------------------------------------------ live mode */
  async function loadTrace(p) {
    trace = await (await fetch("/api/trace?preset=" + p)).json();
    presetShown = p;
    $("routeTitle").textContent = "The route: " + trace.label.charAt(0).toLowerCase() + trace.label.slice(1);
  }
  let polling = false;
  async function poll() {
    if (polling) return;                     // one request at a time: a slow or stopped server must not pile requests up
    polling = true;
    try {
      const s = await (await fetch("/api/state")).json();
      st = s; polledAt = performance.now();
      showProtection(st.protection);
      const sel = $("preset");
      if (!sel.options.length) {
        Object.entries(st.presets).forEach(([k, v]) => sel.add(new Option(v, k)));
        if (st.preset) sel.value = st.preset;
      }
      if (st.running && st.runs && st.runs.left) $("left").value = st.runs.left.mech;      // show what is really running
      const want = st.running && st.preset ? st.preset : sel.value;
      if (want && want !== presetShown) await loadTrace(want);
      st.running ? kick() : paint();
    } catch (err) { $("clockNote").textContent = "demo server not reachable"; }
    finally { polling = false; }
  }
  function setupLive() {
    $("title").textContent = "Live simulation"; document.title = "Masarain live simulation";
    $("mode").textContent = "The real prototype is running on this machine. Only the radio links are emulated.";
    $("go").addEventListener("click", async () => {
      if (busy) return;
      busy = true; $("go").disabled = true;
      try {
        if (st && st.running) await fetch("/api/stop", { method: "POST" });
        else {
          $("caption").textContent = lastCaption = "Starting the call: the two clients are connecting through the emulated networks.";
          await fetch("/api/start?preset=" + $("preset").value + "&left=" + $("left").value, { method: "POST" });
        }
      } finally { busy = false; $("go").disabled = false; poll(); }
    });
    $("preset").addEventListener("change", async ev => {
      await loadTrace(ev.target.value);
      st = { presets: st.presets, mechs: st.mechs };
      paint();
    });
    poll(); setInterval(poll, 250);
  }

  async function init() {
    try {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 1500);
      const r = await fetch("/api/state", { signal: ctl.signal });
      clearTimeout(timer);
      const reply = r.ok ? await r.json().catch(() => null) : null;      // a host that answers every path with a page is not the demo server
      live = !!(reply && reply.presets);
    } catch (err) { live = false; }
    if (live) setupLive();
    else if (rec) setupRecorded();
    else {
      $("mode").textContent = "The demo server is not running and no recorded run is available.";
      $("go").disabled = true;
    }
    window.addEventListener("resize", paint);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(paint);
  }
  init();
})();
