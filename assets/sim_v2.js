/* Masarain simulation, "Instrument" restyle (site_v2). Classic script: no modules, so it runs from file:// too.
   Live mode: the team's demo server (tools/demo_ui.py) runs the real prototype and this page polls its state.
   Recorded mode: without the server, the page replays the finished runs stored in assets/recorded.js, one per route.
   Both modes feed the same drawing code, so the picture is identical. The contract with the server is that of
   assets/sim.js, unchanged: GET /api/state (probed once with a 1.5 s timeout, then every 250 ms, one request at a
   time), GET /api/trace?preset=, POST /api/start?preset=&left=, POST /api/stop. Recorded mode reads ?route= and ?t=.
   LIVE is shown only while a run on the demo server is actually running. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const css = getComputedStyle(document.documentElement);
  const tok = name => css.getPropertyValue(name).trim();
  const C = { screen: tok("--screen"), ink: tok("--ink"), ink2: tok("--ink-2"), ink3: tok("--ink-3"), dim: tok("--dim"),
              call: tok("--call"), pb: tok("--path-b"), grid: tok("--grid"), gridM: tok("--grid-major") };
  const MONO = tok("--f-mono") || "monospace";
  const KIND = { wifi: "Wi-Fi", cell: "5G", sat: "the satellite link", wired: "the cable" };
  const PATH = { wifi: "Wi-Fi", cell: "5G", sat: "satellite", wired: "cable" };
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  // The link models were set from published measurements on this day: twinpath/results/pre_mentor_2026-11-04 keeps
  // the results of the earlier models, and site/build_site.py dates the recorded runs by that folder. A run recorded
  // before this day ran on the earlier link models. (_test/check_sim_v2.py checks this date against the folder.)
  const LINK_MODELS_CHANGED = "2026-11-04";
  // what each method does, in one line, under its name (the codes are those of tools/demo_ui.py)
  const MECH = {
    B0: "One path at a time: it hands over to the other path after a modeled detection plus reconnection.",
    B1: "Each packet goes on the path with the lowest round-trip time; no copies.",
    B3: "Copies packets onto the other path after a loss is seen.",
    B2: "Sends a copy of every packet on both paths."
  };
  const INTRO = "Both methods carry the same voice call, 50 packets per second, through the same emulated networks at the same time.";
  const recs = window.MASARAIN_RECORDINGS || (window.MASARAIN_RECORDED ? { [window.MASARAIN_RECORDED.preset]: window.MASARAIN_RECORDED } : {});
  let rec = window.MASARAIN_RECORDED || Object.values(recs)[0] || null;

  let live = false, trace = null, st = null, presetShown = null, busy = false, polledAt = 0, lastCaption = "";
  let playing = false, tRec = 0, lastFrame = 0, raf = 0, lastRead = "", lastState = "";
  const dbg = window.__masarainSim = { mode: "", axis: [], titles: [] };     // read by the tests in _test/; nothing else

  /* ------------------------------------------------------------------ helpers */
  function fit(canvas, h) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.max(1, canvas.clientWidth);
    canvas.style.height = h + "px";
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = C.screen; g.fillRect(0, 0, w, h);
    return [g, w];
  }
  const font = (g, px, w) => { g.font = (w || 500) + " " + px + "px " + MONO; };
  const text = (g, s, x, y, o = {}) => {
    font(g, o.size || 11, o.weight); g.fillStyle = o.color || C.ink2; g.textAlign = o.align || "left";
    g.textBaseline = "alphabetic"; g.fillText(s, x, y);
  };
  const hline = (g, x0, x1, y) => { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); };
  const vline = (g, x, y0, y1) => { g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke(); };
  // a string cut to a width, so that no label ever runs past its column
  function clip(g, s, maxW) {
    if (g.measureText(s).width <= maxW) return s;
    let t = s;
    while (t.length > 1 && g.measureText(t + "…").width > maxW) t = t.slice(0, -1);
    return t.trimEnd() + "…";
  }
  const dbm = v => v.toFixed(0).replace("-", "−") + " dBm";
  const fmtGap = ms => ms >= 1000 ? (ms / 1000).toFixed(1) + " s" : Math.round(ms) + " ms";
  const gapVU = ms => ms >= 1000 ? [(ms / 1000).toFixed(1), "s"] : [String(Math.round(ms)), "ms"];
  const binAt = e => Math.max(0, Math.min(trace.x.length - 1, Math.floor(e / trace.bin)));
  const lowerFirst = s => s && s.slice(0, 2) !== "Wi" && s.slice(0, 2) !== "5G" && s.indexOf("Masarain") !== 0 ? s.charAt(0).toLowerCase() + s.slice(1) : s;
  const shortDate = ymd => { const [y, m, d] = ymd.split("-").map(Number); return d + " " + MON[m - 1] + " " + y; };
  function setVU(el, v, u) {
    const a = el.firstElementChild, b = el.lastElementChild;
    if (a.textContent !== v) a.textContent = v;
    if (b.textContent !== u) b.textContent = u;
  }
  function setText(id, s) { const el = $(id); if (el.textContent !== s) el.textContent = s; }

  function elapsed() {
    if (!live) return tRec;
    if (!st || !st.started) return 0;
    return Math.min(st.seconds, st.elapsed + (st.running ? (performance.now() - polledAt) / 1000 : 0));
  }

  /* ------------------------------------------------------------------ the route */
  function drawRoute(e) {
    const cv = $("route"), phone = cv.clientWidth < 640, short = window.innerHeight < 900;
    const H = phone ? 112 : (short ? 108 : 128);
    const [g, w] = fit(cv, H);
    if (!trace) return;
    const padL = phone ? 14 : 24, padR = phone ? 14 : 24, yBand = 26, y = Math.round(H * 0.64), L = trace.length;
    const span = w - padL - padR, sx = m => padL + span * m / L, stripTop = 42, stripBot = H - 20;
    const n = trace.x.length, b = binAt(e), R = st && st.runs ? st.runs.right : null, thr = trace.risk_threshold || 0.05;
    // stretches of the route where Wi-Fi itself loses packets
    g.fillStyle = "#191C21";          // opaque, so that stretches walked twice do not add up
    for (let i = 0; i < n - 1; i++) {
      if (trace.wifi_loss[i] < 0.05) continue;
      const xa = sx(Math.min(trace.x[i], trace.x[i + 1])), xb = sx(Math.max(trace.x[i], trace.x[i + 1]));
      g.fillRect(xa, stripTop, Math.max(1, xb - xa) + 0.5, stripBot - stripTop);
    }
    // the backup network, present along the whole route, with a mark wherever a second copy was sent
    font(g, phone ? 10 : 11);
    const name = trace.backup === "5G" ? "5G" : "Satellite link";
    let label = name + " along the whole route: the backup network";
    if (g.measureText(label).width > span) label = name + ": the backup network";
    text(g, label, padL, 14, { size: phone ? 10 : 11, color: C.pb });
    g.strokeStyle = C.pb; g.lineWidth = 1.2; g.setLineDash([4, 4]); hline(g, padL, padL + span, yBand + 0.5); g.setLineDash([]);
    if (R) { g.fillStyle = C.pb; for (let i = 0; i <= b; i++) if (R.copies[i]) g.fillRect(sx(trace.x[i]) - 1, yBand - 6, 2.5, 12); }
    // access points: signal contours drawn to the scale of the route, so they cross the strip as arcs
    const r = span * 46 / L;
    g.save(); g.beginPath(); g.rect(0, stripTop, w, stripBot - stripTop); g.clip();
    g.strokeStyle = C.dim; g.lineWidth = 1;
    trace.aps.forEach(a => [0.5, 1].forEach(f => { g.beginPath(); g.arc(sx(a), y, Math.max(0, r * f), 0, Math.PI * 2); g.stroke(); }));
    g.restore();
    // access point labels never overlap: a label that would collide is shortened to its number, or left out
    const apBoxes = [];
    font(g, phone ? 9.5 : 10.5);
    trace.aps.forEach((a, k) => {
      g.fillStyle = C.ink; g.fillRect(sx(a) - 4.5, y - 4.5, 9, 9);
      for (const s of ["AP " + (k + 1), String(k + 1)]) {
        const wd = g.measureText(s).width, x0 = Math.max(0, sx(a) - wd / 2);
        if (apBoxes.some(b => x0 < b[1] + 6 && x0 + wd + 6 > b[0])) continue;
        apBoxes.push([x0, x0 + wd]);
        text(g, s, x0, y - 11, { color: C.ink2, size: phone ? 9.5 : 10.5 });
        break;
      }
    });
    // the route, and the part already covered
    g.strokeStyle = C.dim; g.lineWidth = 2; hline(g, padL, w - padR, y);
    const cx = sx(trace.x[b]);
    g.strokeStyle = C.ink; g.lineWidth = 3; hline(g, sx(trace.x[0]), cx, y);
    // forecast cone: the ground covered within the forecast horizon; it fills when the forecast flags risk
    const ahead = sx(trace.x[Math.min(n - 1, b + Math.round((trace.horizon || 1.5) / trace.bin))]);
    const back = sx(trace.x[Math.max(0, b - 5)]), dir = ahead !== cx ? Math.sign(ahead - cx) : (cx >= back ? 1 : -1);
    const len = Math.max(18, Math.abs(ahead - cx)), risky = R && (R.risk[b] || 0) >= thr;
    g.beginPath(); g.moveTo(cx, y); g.lineTo(cx + dir * len, y - 12); g.lineTo(cx + dir * len, y + 12); g.closePath();
    if (risky) { g.fillStyle = C.ink2; g.fill(); }
    else { g.setLineDash([4, 3]); g.strokeStyle = C.ink2; g.lineWidth = 1.25; g.stroke(); g.setLineDash([]); }
    // the second copy leaving for the backup network
    let recent = 0;
    if (R) for (let i = Math.max(0, b - 4); i <= b; i++) recent += R.copies[i] || 0;
    if (recent > 0) { g.strokeStyle = C.pb; g.lineWidth = 2.5; vline(g, cx, y - 10, yBand + 6); }
    // the caller
    g.beginPath(); g.arc(cx, y, 7, 0, Math.PI * 2); g.fillStyle = C.screen; g.fill(); g.strokeStyle = C.call; g.lineWidth = 3.5; g.stroke();
    g.lineWidth = 1;
    text(g, "0 m", padL, H - 6, { size: phone ? 9.5 : 10.5, color: C.ink3 });
    text(g, Math.round(L) + " m", w - padR, H - 6, { align: "right", size: phone ? 9.5 : 10.5, color: C.ink3 });
  }

  /* ------------------------------------------------------------------ the timeline */
  function tlLayout(w) {
    const phone = w < 640, mid = w < 1000, short = window.innerHeight < 900;
    const LW = phone ? 0 : (mid ? 150 : 196), T = phone ? 15 : 0;
    const spec = phone ? [["sig", 56, 8], ["risk", 32, 8], ["L", 26, 6], ["R", 26, 8], ["B", 30, 6]]
      : short ? [["sig", 66, 10], ["risk", 42, 10], ["L", 34, 6], ["R", 34, 10], ["B", 40, 8]]
        : [["sig", 80, 12], ["risk", 50, 12], ["L", 40, 8], ["R", 40, 12], ["B", 46, 10]];
    let y = phone ? 4 : 12;
    const lanes = {};
    spec.forEach(([id, h, gap]) => { y += T; lanes[id] = { top: y, h: h }; y += h + gap; });
    const px0 = phone ? 8 : LW, px1 = w - (phone ? 8 : 16);
    return { phone, LW, T, lanes, axisTop: y, H: y + (phone ? 20 : 26), px0, px1, pw: px1 - px0 };
  }

  // tick spacing: the smallest of these steps whose labels do not collide at this width
  function axisTicks(g, secs, pw, phone) {
    font(g, phone ? 9.5 : 11);
    const need = g.measureText(secs + " s").width + (phone ? 14 : 22);
    const steps = [1, 2, 5, 10, 15, 20, 30, 60, 120];
    let step = steps[steps.length - 1];
    for (const s of steps) if (pw * s / secs >= need) { step = s; break; }
    const out = [];
    for (let t = 0; t <= secs + 1e-9; t += step) out.push(t);
    return out;
  }

  function laneTitles(g, Lo, sub) {
    const { lanes, phone, LW, px0, pw } = Lo, rows = [
      ["sig", "Wi-Fi signal", "dBm, emulated link", sub.sig, C.ink],
      ["risk", "Risk of loss", "Masarain's forecast", sub.risk, C.ink],
      ["L", sub.nameL, "the call as heard", "", C.ink2],
      ["R", "Masarain", "the call as heard", "", C.call],
      ["B", "Backup: " + sub.backup, "copies, moved call", "", C.pb]
    ];
    dbg.titles = [];
    rows.forEach(([id, title, s2, s3, col]) => {
      const ln = lanes[id];
      if (phone) {
        font(g, 10, 600);
        const s = clip(g, title + "  ·  " + (s3 || s2), pw);
        g.fillStyle = col; g.textAlign = "left"; g.fillText(s, px0, ln.top - 4);
        dbg.titles.push([px0, ln.top - 14, g.measureText(s).width, 12]);
      } else {
        const x = 14, maxW = LW - 26;
        font(g, LW < 190 ? 11 : 12, 600); g.fillStyle = col; g.textAlign = "left";
        g.fillText(clip(g, title, maxW), x, ln.top + 14);
        if (ln.h >= 30) { font(g, LW < 190 ? 9.5 : 10.5); g.fillStyle = C.ink3; g.fillText(clip(g, s2, maxW), x, ln.top + 28); }
        if (s3 && ln.h >= 44) { font(g, LW < 190 ? 9.5 : 10.5); g.fillStyle = C.ink2; g.fillText(clip(g, s3, maxW), x, ln.top + 42); }
      }
    });
  }

  function drawTimeline(e) {
    const cv = $("tl"), Lo = tlLayout(Math.max(1, cv.clientWidth));
    const [g, w] = fit(cv, Lo.H);
    const { lanes, px0, px1, pw, axisTop, phone } = Lo;
    const secs = trace ? trace.seconds : (st && st.seconds) || 60;
    const X = t => px0 + pw * t / secs, top = lanes.sig.top, bot = lanes.B.top + lanes.B.h;
    const runs = st && st.runs ? st.runs : {}, R = runs.right, Lr = runs.left, thr = trace ? (trace.risk_threshold || 0.05) : 0.05;
    const nameL = Lr ? Lr.name : (live ? (($("left").selectedOptions[0] || {}).text || "").split(" (")[0] : "Switch after failure");
    const sub = { sig: trace ? "drops below " + dbm(trace.lost_below) : "", risk: "copies from " + Math.round(thr * 100) + "%",
                  nameL: nameL || "Other method", backup: trace ? (trace.backup === "5G" ? "5G" : "satellite") : "5G" };

    // grid: one vertical per tick of the time axis, and the floor and ceiling of every lane
    g.lineWidth = 1;
    const ticks = axisTicks(g, secs, pw, phone);
    // on a phone the lane titles stand between the lanes, so verticals are drawn lane by lane and never cross them
    const spans = phone ? Object.keys(lanes).map(id => [lanes[id].top, lanes[id].top + lanes[id].h]).concat([[bot, axisTop - 4]]) : [[top, axisTop - 4]];
    const vcol = x => spans.forEach(([a, b]) => vline(g, x, a, b));
    ticks.forEach(t => { g.strokeStyle = t === 0 ? C.gridM : C.grid; vcol(Math.round(X(t)) + 0.5); });
    g.strokeStyle = C.gridM; vcol(Math.round(px1) + 0.5);
    Object.keys(lanes).forEach(id => {
      const ln = lanes[id];
      g.strokeStyle = C.gridM; hline(g, px0, px1, Math.round(ln.top) + 0.5); hline(g, px0, px1, Math.round(ln.top + ln.h) + 0.5);
    });
    laneTitles(g, Lo, sub);
    if (trace) {
      const n = trace.x.length, bw = pw / n, nowB = Math.min(n, Math.floor(e / trace.bin));
      // where Wi-Fi itself loses packets: a band through every lane, and a rail on the floor of the signal lane
      for (let i = 0; i < n; i++) {
        if (trace.wifi_loss[i] < 0.05) continue;
        const x = px0 + i * bw;
        g.fillStyle = "rgba(238,241,245,0.045)"; spans.forEach(([a, b]) => { const z = Math.min(b, bot); if (z > a) g.fillRect(x, a, bw + 0.5, z - a); });
        g.fillStyle = i < nowB ? C.ink3 : "rgba(141,150,163,0.35)"; g.fillRect(x, lanes.sig.top + lanes.sig.h - 3, bw + 0.5, 3);
      }

      // lane 1: the Wi-Fi signal. The route is known before the run, so its whole signal is drawn faint; the part
      // already covered is drawn in full.
      const sg = lanes.sig, lo = -95, hi = -45, pad = 7;
      const sy = v => sg.top + pad + (sg.h - 2 * pad) * (1 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo));
      [-50, -70, -90].forEach(v => {
        g.strokeStyle = C.grid; g.setLineDash([2, 3]); hline(g, px0, px1, Math.round(sy(v)) + 0.5); g.setLineDash([]);
        // scale labels only where the label column is wide enough to hold them beside the lane title
        if (Lo.LW >= 190) text(g, String(v).replace("-", "−"), px0 - 8, sy(v) + 3.5, { align: "right", size: 9.5, color: C.ink3 });
      });
      g.strokeStyle = C.dim; g.setLineDash([5, 4]); hline(g, px0, px1, Math.round(sy(trace.lost_below)) + 0.5); g.setLineDash([]);
      const sigPath = (i0, i1) => {
        g.beginPath(); let pen = false;
        for (let i = i0; i < i1; i++) {
          if (!trace.associated[i]) { pen = false; continue; }
          const x = px0 + (i + 0.5) * bw, yy = sy(trace.rssi[i]);
          pen ? g.lineTo(x, yy) : g.moveTo(x, yy); pen = true;
        }
        g.stroke();
      };
      g.lineJoin = "round";
      g.strokeStyle = "rgba(238,241,245,0.22)"; g.lineWidth = 1.25; sigPath(Math.max(0, nowB - 1), n);
      g.strokeStyle = C.ink; g.lineWidth = 1.75; sigPath(0, nowB);
      g.lineWidth = 1;

      // lane 2: Masarain's forecast, and the threshold at which it starts to copy
      const rk = lanes.risk, rTop = rk.top + 4, rH = rk.h - 7;
      if (R) {
        g.fillStyle = C.ink2;
        for (let i = 0; i < nowB; i++) {
          if (!trace.associated[i]) continue;
          const v = Math.min(1, R.risk[i] || 0);
          if (v > 0) g.fillRect(px0 + i * bw, rTop + rH * (1 - v), bw + 0.5, rH * v);
        }
      }
      g.strokeStyle = C.dim; g.setLineDash([5, 4]); hline(g, px0, px1, Math.round(rTop + rH * (1 - thr)) + 0.5); g.setLineDash([]);

      // lanes 3 and 4: the call as heard. Voice in time is a band whose height is the share of packets in time;
      // a gap is an empty stretch of the lane.
      [[Lr, lanes.L, C.ink2], [R, lanes.R, C.call]].forEach(([run, ln, col]) => {
        const mid = ln.top + ln.h / 2, half = (ln.h - 8) / 2;
        if (nowB > 0) { g.fillStyle = C.dim; g.fillRect(px0, mid - 0.5, nowB * bw, 1); }
        if (!run) return;
        g.fillStyle = col;
        for (let i = 0; i < nowB; i++) {
          const tot = run.tot[i]; if (!tot) continue;
          const good = run.ok[i] / tot; if (good <= 0) continue;
          g.fillRect(px0 + i * bw, mid - half * good, bw + 0.5, 2 * half * good);
        }
      });

      // lane 5: the backup network. Dashed while it is up; Masarain's moved call as a band; its copies as bars;
      // the other method's call on the backup as a strip along the top.
      const bk = lanes.B, base = bk.top + bk.h - 3, cH = bk.h - 9;
      g.strokeStyle = C.pb; g.lineWidth = 1.2; g.setLineDash([4, 4]);
      [[0, nowB, 1], [nowB, n, 0.35]].forEach(([i0, i1, a]) => {
        g.globalAlpha = a; let s = -1;
        for (let i = i0; i <= i1; i++) {
          const up = i < i1 && (!trace.backup_up || trace.backup_up[i]);
          if (up && s < 0) s = i;
          if (!up && s >= 0) { hline(g, px0 + s * bw, px0 + i * bw, Math.round(base) + 0.5); s = -1; }
        }
      });
      g.globalAlpha = 1; g.setLineDash([]); g.lineWidth = 1;
      if (R) {
        let prim = "";
        g.fillStyle = "rgba(136,165,183,0.30)";
        for (let i = 0; i < nowB; i++) {
          prim = R.primary[i] || prim;
          if (prim && prim !== "wifi" && R.tot[i]) g.fillRect(px0 + i * bw, bk.top + 1, bw + 0.5, bk.h - 2);
        }
        g.fillStyle = C.pb;
        for (let i = 0; i < nowB; i++) {
          const v = Math.min(1, (R.copies[i] || 0) / 5);
          if (v > 0) g.fillRect(px0 + i * bw, base - cH * v, Math.max(1, bw - (bw > 3 ? 0.5 : 0)), cH * v);
        }
      }
      if (Lr) {
        let prim = "";
        g.fillStyle = C.ink2;
        for (let i = 0; i < nowB; i++) {
          prim = Lr.primary[i] || prim;
          if (prim && prim !== "wifi") g.fillRect(px0 + i * bw, bk.top + 1, bw + 0.5, 3);
        }
      }

      // the present moment
      if (e > 0 && e < secs) {
        const x = Math.round(X(e)) + 0.5;
        g.strokeStyle = C.ink; g.lineWidth = 1.5; if (phone) vcol(x); else vline(g, x, top - 2, axisTop - 4); g.lineWidth = 1;
        if (!phone) { g.fillStyle = C.ink; g.beginPath(); g.moveTo(x - 4.5, top - 8); g.lineTo(x + 4.5, top - 8); g.lineTo(x, top - 2); g.closePath(); g.fill(); }
      }
    }

    // the time axis: labels never overlap, at any width
    font(g, phone ? 9.5 : 11); g.fillStyle = C.ink3; g.textBaseline = "alphabetic";
    const boxes = [], ay = axisTop + (phone ? 13 : 16);
    const put = (s, x, align) => {
      const wd = g.measureText(s).width, x0 = align === "left" ? x : align === "right" ? x - wd : x - wd / 2;
      if (boxes.some(b => x0 < b[0] + b[1] + 8 && x0 + wd + 8 > b[0])) return false;
      boxes.push([x0, wd]); g.textAlign = "left"; g.fillText(s, x0, ay); return true;
    };
    put(secs + " s", px1, "right");
    ticks.forEach(t => { if (t < secs - 1e-9) put(String(t), X(t), t === 0 ? "left" : "center"); });
    dbg.axis = boxes.map(b => [Math.round(b[0] * 10) / 10, Math.round(b[1] * 10) / 10]);
  }

  /* ------------------------------------------------------------------ numbers and words */
  function scores() {
    const r = st && st.runs ? st.runs : {};
    [["left", "L"], ["right", "R"]].forEach(([side, k]) => {
      const x = r[side];
      setVU($("lost" + k), x ? x.lost_pct.toFixed(1) : "0.0", "%");
      const [gv, gu] = x ? gapVU(x.longest_gap_ms) : ["0", "ms"];
      setVU($("gap" + k), gv, gu);
      setVU($("extra" + k), x ? String(Math.round(x.extra_pct)) : "0", "%");
    });
    const mech = r.left ? r.left.mech || (live ? null : rec && rec.left) : (live ? $("left").value : rec && rec.left);
    const name = r.left ? r.left.name : (live ? (($("left").selectedOptions[0] || {}).text || "").split(" (")[0] : null);
    if (name) {
      setText("nameL", name); setText("legendL", lowerFirst(name)); setText("legendLb", lowerFirst(name));
      if (!live) setText("leftFixedName", name);
    }
    setText("subL", MECH[mech] || "");
  }

  const sumRange = (a, i0, i1) => { let s = 0; for (let i = Math.max(0, i0); i < Math.min(a.length, i1); i++) s += a[i] || 0; return s; };
  const lastNonEmpty = (a, i) => { for (let k = Math.min(i, a.length - 1); k >= 0; k--) if (a[k]) return a[k]; return ""; };

  // the readout bar: the value of every lane at the present moment, and which path carries each method's call
  function readouts(e) {
    let html = "";
    const item = (k, v, cls) => { html += "<span" + (cls ? ' class="' + cls + '"' : "") + "><em>" + k + "</em>" + v + "</span>"; };
    item("t", e.toFixed(1) + " s");
    if (trace) {
      const b = binAt(e), r = st && st.runs ? st.runs : {}, on = trace.associated[b], started = e > 0;
      item("Wi-Fi", on ? dbm(trace.rssi[b]) : "not connected");
      if (r.right && started) item("risk", on ? Math.round(100 * Math.min(1, r.right.risk[b] || 0)) + "%" : "no signal");
      const backup = trace.backup === "5G" ? "5G" : "satellite";
      if (r.left && started) {
        const p = lastNonEmpty(r.left.primary, b), tot = r.left.tot[b], silent = tot && r.left.ok[b] === 0;
        item(lowerFirst(r.left.name), (p ? "on " + (PATH[p] || p) : "waiting") + (silent ? ", silent" : ""), "c-2");
      }
      if (r.right && started) {
        const p = lastNonEmpty(r.right.primary, b), copies = sumRange(r.right.copies, b - 4, b + 1) > 0;
        const where = !p ? "waiting" : p === "wifi" ? (copies ? "on Wi-Fi, copies on " + backup : "on Wi-Fi") : "on " + (PATH[p] || p) + " (moved)";
        item("Masarain", where, "c-call");
      }
      const tag = trace.mover ? trace.mover : "";
      setText("routeRead", "the caller, " + tag + (on ? ", Wi-Fi " + dbm(trace.rssi[b]) : ", no Wi-Fi"));
    }
    if (html !== lastRead) { $("readbar").innerHTML = html; lastRead = html; }
  }

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
    if (lLoss > 0.06) return wifiBad && lPrim === "wifi" ? "Wi-Fi is breaking up, and " + lowerFirst(L.name) + " is losing voice packets." : L.name + " is losing voice packets at this moment.";
    if (rPrim && rPrim !== "wifi") return "Masarain has moved the call to " + KIND[rPrim] + ". It returns to Wi-Fi after three seconds of healthy signal.";
    // rung 2 has two triggers: the forecast (risk at or above the threshold) and a loss that was just detected
    if (copies > 0 && risk >= (trace.risk_threshold || 0.05)) return "Masarain forecasts trouble (risk " + Math.round(risk * 100) + "%) and sends a second copy of each voice packet over " + backup + ", before the loss.";
    if (copies > 0) return "Masarain has just detected a lost packet on Wi-Fi and sends second copies over " + backup + " for a short time.";
    if (lPrim && lPrim !== "wifi") return L.name + " is now carrying the call over " + KIND[lPrim] + ".";
    return "Wi-Fi is healthy (" + dbm(trace.rssi[binAt(e)]) + "). Both methods send each packet once, over Wi-Fi.";
  }

  // the state light, the provenance of what is on screen, and the score tags. LIVE only while a run is running.
  function status(e, secs) {
    let cls, word, pip, pipCls, src;
    if (live) {
      const ran = st && st.preset;
      if (ran && st.running) { cls = st.started ? "is-live" : "is-run"; word = st.started ? "LIVE" : "Starting"; }
      else if (ran) { cls = ""; word = st.started && st.elapsed < st.seconds - 0.5 ? "Stopped" : "Finished"; }
      else { cls = ""; word = "Ready"; }
      pip = ran ? "this run" : "prototype"; pipCls = ran && st.running && st.started ? "pip pip--live" : "pip pip--emu";
      src = ran ? "This run, n = 1, on this laptop, emulated links" : "Prototype on this laptop, emulated links";
    } else if (rec) {
      cls = playing ? "is-run" : ""; word = playing ? "Replay" : tRec >= secs ? "End" : tRec > 0 ? "Paused" : "Hold";
      pip = "recorded"; pipCls = "pip pip--rec";
      src = "Recorded " + shortDate(rec.recorded_on) + ", emulated links" + (rec.recorded_on.slice(0, 10) < LINK_MODELS_CHANGED ? ", earlier link models" : "");
    } else { cls = ""; word = "No run"; pip = "none"; pipCls = "pip pip--emu"; src = "No recorded run is available"; }
    const key = cls + "|" + word + "|" + pip + "|" + src;
    if (key === lastState) return;
    lastState = key;
    const sEl = $("state");
    sEl.className = "state" + (cls ? " " + cls : ""); setText("stateText", word);
    const p = $("srcPip"); p.className = pipCls; p.textContent = pip;
    ["pipL", "pipR"].forEach(id => { const q = $(id); q.className = pipCls; q.textContent = pip; });
    setText("srcText", src);
  }

  function paint() {
    const e = elapsed(), secs = st && st.seconds ? st.seconds : (trace ? trace.seconds : 60);
    drawRoute(e); drawTimeline(e); scores(); readouts(e); status(e, secs);
    const c = caption(e);
    if (c && c !== lastCaption) { $("caption").textContent = c; lastCaption = c; }
    setText("clockT", e.toFixed(1) + " s");
    const go = $("go");
    if (live) {
      setText("clockNote", !st || !st.preset ? "not started" : st.running ? "of " + secs + " s" : "finished");
      go.textContent = st && st.running ? "Stop" : (st && st.preset ? "Run again" : "Run the call");
      go.classList.toggle("btn--line", !!(st && st.running)); go.classList.toggle("btn--ink", !(st && st.running));
      $("preset").disabled = $("left").disabled = !!(st && st.running);
    } else if (rec) {
      setText("clockNote", "of " + secs + " s");
      go.textContent = playing ? "Pause" : tRec >= secs ? "Play again" : tRec > 0 ? "Resume" : "Play";
      go.classList.toggle("btn--line", playing); go.classList.toggle("btn--ink", !playing);
      $("scrub").value = tRec;
      setText("scrubRead", tRec.toFixed(1) + " s of " + secs + " s");
    }
  }

  /* ------------------------------------------------------------------ one clock for both modes */
  function frame(ts) {
    raf = 0;
    if (!live) {
      if (playing) {
        tRec = Math.min(rec.final.seconds, tRec + Math.min(0.25, (ts - lastFrame) / 1000));      // data at data speed
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
    $("left").value = rec.left;
    setText("routeTitle", "The route: " + trace.label.charAt(0).toLowerCase() + trace.label.slice(1));
    $("scrub").max = rec.final.seconds;
    tRec = 0; playing = false;
    st = recState(); paint();
  }
  function seek(t) { tRec = Math.max(0, Math.min(rec.final.seconds, t)); st = recState(); paint(); }
  function setupRecorded() {
    const sel = $("preset"), q = new URLSearchParams(location.search), keys = Object.keys(recs);
    dbg.mode = "recorded";
    keys.forEach(k => sel.add(new Option(recs[k].trace.label, k)));
    sel.disabled = sel.options.length < 2;                    // with several recorded routes the visitor may choose
    $("left").disabled = true;
    // recordings exist against one method only, so the page names it instead of offering a menu that cannot change
    $("leftField").hidden = true; $("leftFixed").hidden = false;
    $("title").textContent = "Simulation"; document.title = "Masarain recorded simulation";
    $("mode").textContent = (WORDS[keys.length] || String(keys.length)) + " recorded run" + (keys.length === 1 ? "" : "s")
      + " of the prototype over emulated links, one per route. A live run needs the demo server on the team's laptop.";
    $("transport").hidden = false; $("keys").hidden = false;
    const first = Object.prototype.hasOwnProperty.call(recs, q.get("route")) ? q.get("route") : rec.preset;
    sel.value = first; useRecording(first);
    const at = parseFloat(q.get("t"));
    if (at > 0) tRec = Math.min(at, rec.final.seconds);
    sel.addEventListener("change", ev => useRecording(ev.target.value));
    $("go").addEventListener("click", togglePlay);
    $("restart").addEventListener("click", () => { tRec = 0; playing = true; kick(); });
    $("scrub").addEventListener("input", ev => { tRec = +ev.target.value; st = recState(); paint(); });
    document.addEventListener("keydown", ev => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const tag = ev.target.tagName;
      if (ev.code === "Space") {
        if (/^(INPUT|SELECT|BUTTON|A|TEXTAREA|SUMMARY)$/.test(tag)) return;
        ev.preventDefault(); if (!ev.repeat) togglePlay(); return;
      }
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(tag)) return;
      if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") {
        ev.preventDefault(); seek(tRec + (ev.key === "ArrowRight" ? 1 : -1) * (ev.shiftKey ? 5 : 1));
      } else if (ev.key === "Home") { ev.preventDefault(); seek(0); }
      else if (ev.key === "r" || ev.key === "R") { tRec = 0; playing = true; kick(); }
      else if (/^[1-9]$/.test(ev.key) && keys[+ev.key - 1]) { sel.value = keys[+ev.key - 1]; useRecording(keys[+ev.key - 1]); }
    });
    st = recState(); paint();
  }

  /* ------------------------------------------------------------------ live mode */
  async function loadTrace(p) {
    trace = await (await fetch("/api/trace?preset=" + p)).json();
    presetShown = p;
    setText("routeTitle", "The route: " + trace.label.charAt(0).toLowerCase() + trace.label.slice(1));
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
    } catch (err) { setText("clockNote", "demo server not reachable"); }
    finally { polling = false; }
  }
  function setupLive() {
    dbg.mode = "live";
    $("title").textContent = "Simulation"; document.title = "Masarain simulation";
    $("mode").textContent = "The real prototype runs on this laptop. Only the radio links are emulated.";
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
    $("left").addEventListener("change", () => { if (!(st && st.running)) paint(); });
    poll(); setInterval(poll, 250);
  }

  async function init() {
    // Opened as a file, the page can have no demo server, and a fetch would only log an error: recorded mode at once.
    if (location.protocol !== "file:") {
      try {
        const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 1500);
        const r = await fetch("/api/state", { signal: ctl.signal });
        clearTimeout(timer);
        const reply = r.ok ? await r.json().catch(() => null) : null;      // a host that answers every path with a page is not the demo server
        live = !!(reply && reply.presets);
      } catch (err) { live = false; }
    }
    if (live) setupLive();
    else if (rec) setupRecorded();
    else {
      dbg.mode = "none";
      $("mode").textContent = "The demo server is not running and no recorded run is available.";
      $("go").disabled = true;
      status(0, 60);
    }
    window.addEventListener("resize", paint);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(paint);
  }
  init();
})();
