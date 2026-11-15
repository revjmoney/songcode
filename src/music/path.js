// SPDX-License-Identifier: GPL-3.0-or-later
// SONGCODE by JMSCNC, Copyright (C) 2026 Rev. J. Money / JMSCNC (jmscnc.com).
// Licensed GPL-3.0-or-later; keep this attribution (GPLv3 section 7(b), see NOTICE.md).
//
// Bounce-box travel envelope: walk the relative (G91) G0/G1 moves, compare min/max per axis
// against the preset travel box around the song start (zero), and draw a 2D or 3D plot.
// Download-only summary comments are built here so songcode().text stays unchanged.

export const isRotaryLetter = (ax) => /^[ABC]$/i.test(String(ax ?? ''));

const AXIS = /([A-Z])(-?\d+\.?\d*)/g;
const WORDS = new Set(['X', 'Y', 'Z', 'A', 'B', 'C', 'U', 'V', 'W']);

function boxOf(profile, letter) {
  if (!profile) return null;
  const L = String(letter).toUpperCase();
  if (profile.a?.axis === L) return { box: Number(profile.a.box) || 0, voice: 'a', units: isRotaryLetter(L) && profile.rotary?.enabled ? 'deg' : (profile.units === 'in' ? 'in' : 'mm') };
  if (profile.b?.axis === L) return { box: Number(profile.b.box) || 0, voice: 'b', units: isRotaryLetter(L) && profile.rotary?.enabled ? 'deg' : (profile.units === 'in' ? 'in' : 'mm') };
  return null;
}

// Trace G91 motion. Entering G91 recenters the envelope at the current tool (song zero).
// Diameter mode (lathe X) is applied to the high-voice letter when out.diameter is set.
export function tracePath(lines, out = {}, profile = null) {
  const axesLetters = [out.axes?.[0] || 'X', out.axes?.[1] || 'Z'].map((a) => String(a).toUpperCase());
  const dia = !!out.diameter;
  const units = out.units === 'mm' ? 'mm' : (out.units === 'in' ? 'in' : (profile?.units === 'in' ? 'in' : 'mm'));
  let rel = false, modal = 'G1';
  const pos = Object.fromEntries(axesLetters.map((a) => [a, 0]));
  const min = { ...pos }, max = { ...pos };
  const points = [{ ...pos }];
  const used = new Set();

  const bump = (letter, raw) => {
    const L = letter.toUpperCase();
    if (!WORDS.has(L)) return;
    if (!(L in pos)) { pos[L] = 0; min[L] = 0; max[L] = 0; }
    const v = Number(raw);
    if (!Number.isFinite(v)) return;
    const d = (dia && L === axesLetters[0]) ? v / 2 : v;
    if (!rel) {
      // G90 park moves are not part of the bounce box; ignore for the envelope
      return;
    }
    pos[L] += d;
    min[L] = Math.min(min[L], pos[L]);
    max[L] = Math.max(max[L], pos[L]);
    used.add(L);
  };

  for (const raw of lines ?? []) {
    const l = String(raw).replace(/\([^)]*\)/g, '').trim();
    if (!l || l[0] === ';') continue;
    if (/\bG90\b/.test(l)) rel = false;
    if (/\bG91\b/.test(l)) {
      rel = true;
      for (const k of Object.keys(pos)) { pos[k] = 0; min[k] = 0; max[k] = 0; }
      points.length = 0;
      points.push({ ...pos });
      used.clear();
    }
    if (/\bG0\b/.test(l)) modal = 'G0';
    if (/\bG1\b/.test(l)) modal = 'G1';
    if (!/\bG[01]\b/.test(l) && !/^(N\d+\s+)?G1\b/.test(l) && modal !== 'G1' && modal !== 'G0') continue;
    if (!/\bG[01]\b/.test(l) && !/^(N\d+\s+)?G[01]\b/.test(l) && !/^[A-Z]-?\d/.test(l)) {
      // dwell, M-codes, etc.
      if (!/^(N\d+\s+)?G1\b/.test(l)) continue;
    }
    const isMove = /\bG[01]\b/.test(l) || /^(N\d+\s+)?G1 /.test(l);
    if (!isMove) continue;
    AXIS.lastIndex = 0;
    let m, any = false;
    while ((m = AXIS.exec(l))) {
      if (m[1] === 'F' || m[1] === 'P' || m[1] === 'N' || m[1] === 'G' || m[1] === 'M' || m[1] === 'T' || m[1] === 'S') continue;
      bump(m[1], m[2]);
      any = true;
    }
    if (any && rel) points.push({ ...pos });
  }

  const axes = {};
  const letters = [...new Set([...axesLetters, ...used])];
  const overtravel = [];
  for (const L of letters) {
    const peak = Math.max(Math.abs(min[L] ?? 0), Math.abs(max[L] ?? 0));
    const info = boxOf(profile, L);
    const box = info?.box ?? (L === axesLetters[0] ? (profile?.a?.box ?? 0) : L === axesLetters[1] ? (profile?.b?.box ?? 0) : 0);
    const unit = info?.units ?? (isRotaryLetter(L) && profile?.rotary?.enabled ? 'deg' : units);
    const ot = box > 0 && peak > box + 1e-4;
    axes[L] = { min: min[L] ?? 0, max: max[L] ?? 0, peak, box, units: unit, overtravel: ot };
    if (ot) overtravel.push(`${L} reaches ${peak.toFixed(unit === 'in' ? 3 : 2)} ${unit}, box is ±${box} ${unit}`);
  }

  return { points, axes, used: [...used], letters: axesLetters, units, diameter: dia, overtravel, zero: Object.fromEntries(letters.map((L) => [L, 0])) };
}

export function pathSummaryComments(trace) {
  if (!trace?.axes) return [];
  const bits = Object.entries(trace.axes).map(([L, a]) => {
    const dec = a.units === 'in' ? 3 : 2;
    return `${L} ±${a.peak.toFixed(dec)} of box ${a.box} ${a.units}`;
  });
  const lines = [`(SONGCODE travel: ${bits.join('; ')})`];
  lines.push(trace.overtravel.length ? `(overtravel: ${trace.overtravel.join('; ')})` : '(overtravel: none)');
  return lines;
}

export function downloadText(result) {
  const extra = result?.pathSummary ?? [];
  if (!extra.length) return result.text;
  const L = result.lines.slice();
  L.splice(1, 0, ...extra);
  return L.join('\n') + '\n';
}

function boundsOf(trace, letters) {
  let r = 1e-6;
  for (const L of letters) {
    const a = trace.axes[L];
    if (!a) continue;
    r = Math.max(r, Math.abs(a.min), Math.abs(a.max), a.box || 0);
  }
  return r;
}

function axisPair(trace) {
  const used = trace.used.length ? trace.used : trace.letters;
  const a = used[0] || 'X';
  const b = used[1] || used[0] || 'Z';
  const c = used[2] || null;
  return [a, b, c];
}

export function drawPath2D(ctx, trace, { w, h } = {}) {
  const W = w ?? ctx.canvas.width, H = h ?? ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  const [ax, ay] = axisPair(trace);
  const r = boundsOf(trace, [ax, ay]) * 1.15;
  const cx = W / 2, cy = H / 2, s = Math.min(W, H) * 0.42 / r;
  const X = (v) => cx + v * s, Y = (v) => cy - v * s;
  const boxA = trace.axes[ax]?.box ?? r, boxB = trace.axes[ay]?.box ?? r;
  // box
  ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
  ctx.strokeRect(X(-boxA), Y(boxB), 2 * boxA * s, 2 * boxB * s);
  ctx.setLineDash([]);
  // axes / zero
  ctx.strokeStyle = '#1b2733'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(20, cy); ctx.lineTo(W - 20, cy); ctx.moveTo(cx, 16); ctx.lineTo(cx, H - 16); ctx.stroke();
  ctx.fillStyle = '#5d7385'; ctx.font = '11px Consolas, monospace';
  ctx.fillText(`${ax} →`, W - 40, cy - 6);
  ctx.fillText(`${ay} ↑`, cx + 6, 16);
  ctx.fillText('0', cx + 6, cy + 12);
  const unit = trace.axes[ax]?.units ?? trace.units;
  ctx.fillText(`±${(trace.axes[ax]?.box ?? 0)} ${unit}`, X(boxA) - 8, cy + 14);
  // path
  const pts = trace.points ?? [];
  if (pts.length > 1) {
    ctx.strokeStyle = '#7fffb0'; ctx.lineWidth = 1.6; ctx.beginPath();
    pts.forEach((p, i) => { const x = X(p[ax] || 0), y = Y(p[ay] || 0); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke();
  }
  // start / end
  if (pts.length) {
    ctx.fillStyle = '#6cc4ff'; ctx.beginPath(); ctx.arc(X(pts[0][ax] || 0), Y(pts[0][ay] || 0), 4, 0, Math.PI * 2); ctx.fill();
    const last = pts[pts.length - 1];
    ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(X(last[ax] || 0), Y(last[ay] || 0), 3.5, 0, Math.PI * 2); ctx.fill();
  }
  if (trace.overtravel.length) {
    ctx.fillStyle = '#ff5a4a'; ctx.fillText(trace.overtravel[0], 10, H - 8);
  }
}

export function drawPath3D(ctx, trace, { w, h, yaw = 0.7, pitch = 0.45 } = {}) {
  const W = w ?? ctx.canvas.width, H = h ?? ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  const [ax, ay, az0] = axisPair(trace);
  const az = az0 || ay;
  const r = boundsOf(trace, [ax, ay, az].filter(Boolean)) * 1.2;
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), cpi = Math.cos(pitch), spi = Math.sin(pitch);
  const project = (x, y, z) => {
    const x1 = x * cyw - y * syw;
    const y1 = x * syw + y * cyw;
    const y2 = y1 * cpi - z * spi;
    const z2 = y1 * spi + z * cpi;
    const s = Math.min(W, H) * 0.38 / r;
    return [W / 2 + x1 * s, H / 2 - y2 * s, z2];
  };
  const boxA = trace.axes[ax]?.box ?? r, boxB = trace.axes[ay]?.box ?? r, boxC = (az0 && trace.axes[az]?.box) || 0;
  const corners = [];
  for (const x of [-boxA, boxA]) for (const y of [-boxB, boxB]) for (const z of az0 ? [-boxC, boxC] : [0]) corners.push(project(x, y, z));
  ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
  const edges = [];
  if (az0) {
    const idx = (i, j, k) => (i * 4 + j * 2 + k);
    // 2x2x2
    for (const a of [0, 1]) for (const b of [0, 1]) {
      edges.push([idx(0, a, b), idx(1, a, b)], [idx(a, 0, b), idx(a, 1, b)], [idx(a, b, 0), idx(a, b, 1)]);
    }
  } else {
    const q = [project(-boxA, -boxB, 0), project(boxA, -boxB, 0), project(boxA, boxB, 0), project(-boxA, boxB, 0)];
    ctx.beginPath();
    q.forEach((p, i) => { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
    ctx.closePath(); ctx.stroke();
  }
  if (az0) {
    ctx.beginPath();
    for (const [i, j] of edges) {
      ctx.moveTo(corners[i][0], corners[i][1]);
      ctx.lineTo(corners[j][0], corners[j][1]);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // axis ticks
  const o = project(0, 0, 0), xa = project(r * 0.9, 0, 0), ya = project(0, r * 0.9, 0), za = project(0, 0, r * 0.9);
  ctx.strokeStyle = '#1b2733'; ctx.beginPath();
  ctx.moveTo(o[0], o[1]); ctx.lineTo(xa[0], xa[1]);
  ctx.moveTo(o[0], o[1]); ctx.lineTo(ya[0], ya[1]);
  if (az0) { ctx.moveTo(o[0], o[1]); ctx.lineTo(za[0], za[1]); }
  ctx.stroke();
  ctx.fillStyle = '#5d7385'; ctx.font = '11px Consolas, monospace';
  ctx.fillText(ax, xa[0] + 4, xa[1]); ctx.fillText(ay, ya[0] + 4, ya[1]);
  if (az0) ctx.fillText(az, za[0] + 4, za[1]);
  const pts = (trace.points ?? []).map((p) => project(p[ax] || 0, p[ay] || 0, az0 ? (p[az] || 0) : 0));
  if (pts.length > 1) {
    ctx.strokeStyle = '#7fffb0'; ctx.lineWidth = 1.6; ctx.beginPath();
    pts.forEach((p, i) => { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
    ctx.stroke();
    ctx.fillStyle = '#6cc4ff'; ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(pts.at(-1)[0], pts.at(-1)[1], 3.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#8aa0b2';
  ctx.fillText('drag to rotate', 10, H - 8);
  if (trace.overtravel.length) {
    ctx.fillStyle = '#ff5a4a'; ctx.fillText(trace.overtravel[0], 10, 16);
  }
}
