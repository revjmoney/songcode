// SPDX-License-Identifier: GPL-3.0-or-later
// SONGCODE by JMSCNC, Copyright (C) 2026 Rev. J. Money / JMSCNC (jmscnc.com).
// Licensed GPL-3.0-or-later; keep this attribution (GPLv3 section 7(b), see NOTICE.md).
//
// A grbl / grblHAL-style motion planner used by LISTEN, so the preview's timing and pitch
// follow trapezoid accel/decel, junction-deviation cornering, lookahead, and per-axis max
// rate/accel. Marlin (junction deviation) and LinuxCNC presets use the same model with a
// flavour-default deviation. This never writes g-code; default programs stay byte-identical.

import { isRotaryLetter } from './path.js';

export function junctionDeviationOf(profile) {
  const v = Number(profile?.junctionDeviation);
  if (v > 0) return v;
  const f = profile?.flavor;
  if (f === 'marlin') return 0.013;
  if (f === 'linuxcnc') return 0.05;
  return 0.01;                                               // grbl / grblHAL $11 default, mm
}

// Junction speed (mm/s or the planner's path units/s) from the grbl planner.c formula.
export function junctionMaxSpeed(unitPrev, unitNext, accel, junctionDeviation, minSpeed = 0) {
  if (!unitPrev || !unitNext || !(accel > 0) || !(junctionDeviation > 0)) return minSpeed;
  let dot = 0;
  for (const k of new Set([...Object.keys(unitPrev), ...Object.keys(unitNext)])) {
    dot += (unitPrev[k] || 0) * (unitNext[k] || 0);
  }
  // grbl: junction_cos_theta = -prev·next. Straight (same direction) is -1; a reversal is +1.
  const cos = -dot;
  if (cos < -0.999999) return Infinity;
  if (cos > 0.999999) return minSpeed;
  const sinHalf = Math.sqrt(Math.max(0, 0.5 * (1 - cos)));
  const denom = 1 - sinHalf;
  if (denom < 1e-12) return minSpeed;
  const v2 = (accel * junctionDeviation * sinHalf) / denom;
  return Math.sqrt(Math.max(minSpeed * minSpeed, v2));
}

// Trapezoid (or triangle) for one block. Speeds in units/s, distance in the same units, accel in units/s².
export function trapezoid(distance, accel, vEntry, vExit, vNominal) {
  const d = Math.max(0, distance), a = Math.max(accel, 1e-12);
  let ve = Math.max(0, vEntry), vx = Math.max(0, vExit), vn = Math.max(Math.max(ve, vx), vNominal);
  const maxExit2 = ve * ve + 2 * a * d;
  if (vx * vx > maxExit2 + 1e-12) vx = Math.sqrt(Math.max(0, maxExit2));
  const maxEntry2 = vx * vx + 2 * a * d;
  if (ve * ve > maxEntry2 + 1e-12) ve = Math.sqrt(Math.max(0, maxEntry2));
  const accelDist = (vn * vn - ve * ve) / (2 * a);
  const decelDist = (vn * vn - vx * vx) / (2 * a);
  let cruise = 0, vPeak = vn, kind = 'trapezoid';
  if (accelDist + decelDist >= d - 1e-12) {
    kind = 'triangle';
    vPeak = Math.sqrt(Math.max(0, a * d + (ve * ve + vx * vx) / 2));
    if (vPeak < Math.max(ve, vx)) vPeak = Math.max(ve, vx);
    const ad = Math.max(0, (vPeak * vPeak - ve * ve) / (2 * a));
    const dd = Math.max(0, d - ad);
    const tA = a > 0 ? Math.abs(vPeak - ve) / a : 0;
    const tD = a > 0 ? Math.abs(vPeak - vx) / a : 0;
    return { kind, vEntry: ve, vExit: vx, vPeak, vNominal: vn, accelDist: ad, decelDist: dd, cruiseDist: 0, tAccel: tA, tCruise: 0, tDecel: tD, time: tA + tD, reaches: vPeak >= vn - 1e-9 };
  }
  cruise = d - accelDist - decelDist;
  const tA = a > 0 ? Math.abs(vn - ve) / a : 0;
  const tD = a > 0 ? Math.abs(vn - vx) / a : 0;
  const tC = vn > 1e-12 ? cruise / vn : 0;
  return { kind, vEntry: ve, vExit: vx, vPeak: vn, vNominal: vn, accelDist: Math.max(0, accelDist), decelDist: Math.max(0, decelDist), cruiseDist: cruise, tAccel: tA, tCruise: tC, tDecel: tD, time: tA + tC + tD, reaches: true };
}

function axisLetters(out) {
  return [out?.axes?.[0] || 'X', out?.axes?.[1] || 'Z'].map((a) => String(a).toUpperCase());
}

function axisLimit(profile, letter, machine) {
  const L = String(letter).toUpperCase();
  const letters = axisLetters({ axes: [profile?.a?.axis, profile?.b?.axis] });
  const voice = L === (profile?.a?.axis || '').toUpperCase() ? 'a'
    : L === (profile?.b?.axis || '').toUpperCase() ? 'b'
    : L === 'C' || L === (profile?.c?.axis || '').toUpperCase() ? 'c'
    : (L === letters[0] ? 'a' : 'b');
  const rot = !!(profile?.rotary?.enabled && isRotaryLetter(L));
  // machine.acc is mm/s² (or deg/s²). machine.max is ipm (or deg/min). machine.hz is per ipm or per deg/min.
  const acc = voice === 'c' ? (machine?.acc?.C ?? 0) : voice === 'b' ? (machine?.acc?.Z ?? 0) : (machine?.acc?.X ?? 0);
  const maxIpmOrDegMin = voice === 'c' ? (machine?.max?.C ?? 0) : voice === 'b' ? (machine?.max?.Z ?? 0) : (machine?.max?.X ?? 0);
  const hzPer = voice === 'c' ? (machine?.hz?.C ?? 0) : voice === 'b' ? (machine?.hz?.Z ?? 0) : (machine?.hz?.X ?? 0);
  return { rot, acc, maxIpmOrDegMin, hzPer, voice };
}

// Convert a programmed axis word into millimetres (linear) or degrees (rotary).
function toNative(deltaWord, unitsMm, diameter, isHighDiaAxis, rot) {
  let d = deltaWord;
  if (diameter && isHighDiaAxis && !rot) d = d / 2;
  if (rot) return d;                                       // degrees
  return unitsMm ? d : d * 25.4;                           // mm
}

const AXIS_RE = /([A-Z])(-?\d+\.?\d*)/g;
const SKIP = new Set(['F', 'P', 'N', 'G', 'M', 'T', 'S', 'O', 'D', 'H', 'L', 'Q']);

// Walk G91 motion into planner blocks { delta, distance, unit, vNominal, accel, n, feed }.
export function blocksFromProgram(lines, out = {}, machine = {}, profile = {}) {
  const letters = axisLetters(out);
  const unitsMm = (out.units ?? profile.units) !== 'in';
  const dia = !!out.diameter;
  const rotOf = (L) => !!(out.rotary?.enabled && isRotaryLetter(L));
  let rel = false, modal = 'G1', inverse = /\bG93\b/.test(out.header ?? '');
  let feed = 0, dwellMs = out.dwell === 'ms';
  const blocks = [];
  let tClock = 0;

  const pushDwell = (sec, n) => {
    if (sec > 0) {
      blocks.push({ kind: 'dwell', time: sec, t0: tClock, n, delta: {}, distance: 0, unit: {}, vNominal: 0, accel: 0, vEntry: 0, vExit: 0 });
      tClock += sec;
    }
  };

  for (const raw of lines ?? []) {
    const l = String(raw).replace(/\([^)]*\)/g, '').trim();
    if (!l || l[0] === ';') continue;
    if (/\bG90\b/.test(l)) rel = false;
    if (/\bG91\b/.test(l)) rel = true;
    if (/\bG93\b/.test(l)) inverse = true;
    if (/\bG94\b/.test(l)) inverse = false;
    if (/\bG20\b/.test(l) && !/\bG21\b/.test(l)) { /* inch words; handled via unitsMm of the program */ }
    const nM = /\bN(\d+)/.exec(l);
    const n = nM ? Number(nM[1]) : 0;
    const pM = /\bP(-?[\d.]+)/.exec(l);
    if (/\bG4\b/.test(l) && pM) {
      const p = Number(pM[1]);
      pushDwell(dwellMs ? p / 1000 : p, n);
      continue;
    }
    if (/\bG0\b/.test(l)) modal = 'G0';
    if (/\bG1\b/.test(l)) modal = 'G1';
    const isMove = /\bG[01]\b/.test(l) || /^(N\d+\s+)?G[01]\b/.test(l);
    if (!isMove) continue;
    if (!rel) continue;                                    // park moves in G90 are not the song
    const words = {};
    AXIS_RE.lastIndex = 0;
    let m;
    while ((m = AXIS_RE.exec(l))) {
      if (SKIP.has(m[1])) {
        if (m[1] === 'F') feed = Number(m[2]);
        continue;
      }
      words[m[1]] = Number(m[2]);
    }
    const delta = {}, acc = {}, max = {}, hz = {};
    for (const [L, w] of Object.entries(words)) {
      const lim = axisLimit(profile, L, machine);
      const highDia = dia && L === letters[0];
      delta[L] = toNative(w, unitsMm, dia, highDia, lim.rot);
      acc[L] = lim.acc;
      // max: machine.max is ipm for linear (already /25.4 from mm/min) or deg/min for rotary / C (rpm*360? C is rpm in machine.max.C)
      // For C, max is in rpm; skip special — voice c as deg/min is p.c.max. For two-axis rotary, max is deg/min already.
      // Linear: convert ipm -> mm/s = ipm * 25.4 / 60
      if (lim.rot || lim.voice === 'c') {
        // C stored as rpm in machine.max.C; two-axis rotary voice stores deg/min in machine.max
        const degMin = lim.voice === 'c' ? (lim.maxIpmOrDegMin * 360) : lim.maxIpmOrDegMin;
        max[L] = degMin / 60;
      } else {
        max[L] = (lim.maxIpmOrDegMin * 25.4) / 60;         // mm/s
      }
      hz[L] = lim.hzPer;
    }
    const keys = Object.keys(delta).filter((k) => Math.abs(delta[k]) > 1e-12);
    if (!keys.length) continue;
    const distance = Math.hypot(...keys.map((k) => delta[k]));
    if (!(distance > 0)) continue;
    const unit = Object.fromEntries(keys.map((k) => [k, delta[k] / distance]));
    let accel = Infinity, vMax = Infinity;
    for (const k of keys) {
      const u = Math.abs(unit[k]);
      if (u > 1e-12) {
        if (acc[k] > 0) accel = Math.min(accel, acc[k] / u);
        if (max[k] > 0) vMax = Math.min(vMax, max[k] / u);
      }
    }
    if (!Number.isFinite(accel)) accel = 1;
    let vNom;
    if (modal === 'G0') {
      vNom = Number.isFinite(vMax) ? vMax : 0;
    } else if (inverse && feed > 0) {
      const t = 60 / feed;                                 // seconds, G93 F = 60 / t_s
      vNom = t > 1e-12 ? distance / t : 0;
    } else if (feed > 0) {
      // F is program units / min (mm/min or in/min, or deg/min)
      const feedNativePerMin = keys.every((k) => axisLimit(profile, k, machine).rot)
        ? feed                                             // deg/min
        : (unitsMm ? feed : feed * 25.4);                  // mm/min
      vNom = feedNativePerMin / 60;
    } else vNom = 0;
    vNom = Math.min(vNom, Number.isFinite(vMax) ? vMax : vNom);
    blocks.push({
      kind: 'move', t0: 0, n, modal, delta, distance, unit, accel, vNominal: Math.max(0, vNom),
      vMax: Number.isFinite(vMax) ? vMax : vNom, acc, max, hz, vEntry: 0, vExit: 0, letters: keys,
    });
  }
  return blocks;
}

// Lookahead: junction caps, reverse pass, forward pass (classic grbl planner).
export function planBlocks(blocks, { junctionDeviation = 0.01, minSpeed = 0 } = {}) {
  const moves = blocks.filter((b) => b.kind === 'move');
  for (let i = 0; i < moves.length; i++) {
    const b = moves[i], prev = moves[i - 1];
    const acc = prev ? Math.min(b.accel, prev.accel) : b.accel;
    const vj = prev && prev.kind === 'move' ? junctionMaxSpeed(prev.unit, b.unit, acc, junctionDeviation, minSpeed) : minSpeed;
    b.maxJunction = Number.isFinite(vj) ? vj : b.vNominal;
    b.maxEntry = Math.min(b.vNominal, b.maxJunction);
  }
  if (moves.length) {
    moves[0].maxEntry = Math.min(moves[0].maxEntry, minSpeed || 0);
    moves[moves.length - 1].vExit = minSpeed;
  }
  // reverse pass: given each block's exit, how fast can we enter?
  let nextExit = minSpeed;
  for (let i = moves.length - 1; i >= 0; i--) {
    const b = moves[i];
    b.vExit = i === moves.length - 1 ? minSpeed : nextExit;
    const maxIn = Math.sqrt(b.vExit * b.vExit + 2 * b.accel * b.distance);
    b.vEntry = Math.min(b.maxEntry, maxIn);
    nextExit = b.vEntry;
  }
  // forward pass: can we actually reach the planned exit from the entry?
  let prevExit = minSpeed;
  for (let i = 0; i < moves.length; i++) {
    const b = moves[i];
    b.vEntry = Math.min(b.vEntry, prevExit || b.vEntry, i === 0 ? (minSpeed || b.vEntry) : prevExit);
    if (i === 0) b.vEntry = minSpeed;
    const maxOut = Math.sqrt(b.vEntry * b.vEntry + 2 * b.accel * b.distance);
    b.vExit = Math.min(b.vExit, maxOut, b.vNominal);
    b.profile = trapezoid(b.distance, b.accel, b.vEntry, b.vExit, b.vNominal);
    b.vExit = b.profile.vExit;
    b.vEntry = b.profile.vEntry;
    b.reaches = b.profile.reaches;
    prevExit = b.vExit;
  }
  // stamp wall-clock times, including dwells in order
  let t = 0;
  for (const b of blocks) {
    b.t0 = t;
    if (b.kind === 'dwell') t += b.time;
    else if (b.profile) { b.time = b.profile.time; t += b.time; }
    else b.time = 0;
  }
  return { blocks, seconds: t };
}

function hzOfAxis(velNativePerS, letter, block, machine, profile) {
  const lim = axisLimit(profile, letter, machine);
  // vel is mm/s (linear) or deg/s (rotary). hzPer is per ipm (linear) or per deg/min (rotary).
  if (lim.rot || lim.voice === 'c') return Math.abs(velNativePerS) * 60 * lim.hzPer;
  const ipm = Math.abs(velNativePerS) * 60 / 25.4;
  return ipm * lim.hzPer;
}

// Axis pitch vs time: list of linear ramps { t, dur, fromHz, toHz, letter, n, reaches, cruiseHz }.
export function axisEnvelopes(planned, machine, profile) {
  const by = {};
  const missedN = new Set();
  for (const b of planned.blocks) {
    if (b.kind !== 'move' || !b.profile) continue;
    const p = b.profile;
    const segs = [];
    if (p.tAccel > 1e-9) segs.push({ dur: p.tAccel, v0: p.vEntry, v1: p.vPeak });
    if (p.tCruise > 1e-9) segs.push({ dur: p.tCruise, v0: p.vPeak, v1: p.vPeak });
    if (p.tDecel > 1e-9) segs.push({ dur: p.tDecel, v0: p.vPeak, v1: p.vExit });
    if (!segs.length) continue;
    let t = b.t0;
    for (const s of segs) {
      for (const L of b.letters ?? Object.keys(b.unit)) {
        const u = Math.abs(b.unit[L] || 0);
        if (u < 1e-12) continue;
        if (!by[L]) by[L] = [];
        const fromHz = hzOfAxis(s.v0 * u, L, b, machine, profile);
        const toHz = hzOfAxis(s.v1 * u, L, b, machine, profile);
        const cruiseHz = hzOfAxis(b.vNominal * u, L, b, machine, profile);
        by[L].push({
          t, dur: s.dur, fromHz, toHz, tRamp: s.dur, letter: L, n: b.n,
          reaches: p.reaches, cruiseHz, programmedHz: cruiseHz,
        });
      }
      t += s.dur;
    }
    if (!p.reaches && b.n) missedN.add(b.n);
    else if (!p.reaches) missedN.add(`@${b.t0.toFixed(3)}`);
  }
  return { axes: by, missed: missedN.size, missedIds: [...missedN] };
}

export function planProgram(lines, out, machine, profile) {
  const jd = junctionDeviationOf(profile);
  const raw = blocksFromProgram(lines, out, machine, profile);
  const planned = planBlocks(raw, { junctionDeviation: jd });
  const env = axisEnvelopes(planned, machine, profile);
  return { ...planned, junctionDeviation: jd, envelopes: env.axes, missed: env.missed, missedIds: env.missedIds };
}

export function schedulePlan(ctx, plan, dest, { tempo = 1, t0 = 0, volOf = () => 0.05 } = {}) {
  const oscs = [];
  let tEnd = 0;
  for (const [letter, env] of Object.entries(plan.envelopes ?? {})) {
    if (!env.length) continue;
    const o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = 'square';
    gn.gain.value = 0;
    o.connect(gn).connect(dest);
    const vol = volOf(letter);
    o.frequency.setValueAtTime(Math.max(env[0].fromHz, 20), t0);
    for (const e of env) {
      const a = t0 + e.t / tempo, b = t0 + (e.t + e.dur) / tempo;
      gn.gain.setValueAtTime(vol, a);
      o.frequency.setValueAtTime(Math.max(e.fromHz, 20), a);
      if (e.dur > 0.001) o.frequency.linearRampToValueAtTime(Math.max(e.toHz, 20), b);
      else o.frequency.setValueAtTime(Math.max(e.toHz, 20), a);
      tEnd = Math.max(tEnd, (e.t + e.dur) / tempo);
    }
    const last = env[env.length - 1];
    gn.gain.setValueAtTime(0, t0 + (last.t + last.dur) / tempo + 0.02);
    o.start(t0);
    oscs.push(o);
  }
  return { oscs, missed: plan.missed ?? 0, seconds: tEnd };
}
