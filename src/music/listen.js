// SPDX-License-Identifier: GPL-3.0-or-later
// SONGCODE by JMSCNC, Copyright (C) 2026 Rev. J. Money / JMSCNC (jmscnc.com).
// Licensed GPL-3.0-or-later; keep this attribution (GPLv3 section 7(b), see NOTICE.md).
//
// LISTEN preview: square waves whose pitch follows each motor's accel ramp, so a slow axis
// (REVTURN Z at 12 mm/s²) takes time to reach the note, as it does on the iron.

// time in seconds for the motor to change from fromHz to toHz given Hz per ipm and accel in mm/s²
export function rampTime(fromHz, toHz, hzPerIpm, accelMmS2) {
  if (!(hzPerIpm > 0) || !(accelMmS2 > 0)) return 0;
  const accelIpmPerS = (accelMmS2 / 25.4) * 60;          // mm/s² -> in/s² -> ipm/s
  return Math.abs((toHz - fromHz) / hzPerIpm) / accelIpmPerS;
}

// per-note pitch envelope for one axis. fromStop / re-strike follows buildSong's legato rules:
// a new note that is the same pitch, or any note when legato is off, starts from a stop.
export function listenEnvelope(notes, { hzPerIpm, accelMmS2, legato = true } = {}) {
  const out = [];
  let last = null;
  for (const n of notes ?? []) {
    const gap = last ? n.t - (last.t + last.dur) : 1;
    const same = last && Math.abs(last.hz - n.hz) < 0.5;
    const fromStop = !last || gap > 0.02 || !legato || same;
    const startHz = fromStop ? 0 : last.hz;
    const tRamp = rampTime(startHz, n.hz, hzPerIpm, accelMmS2);
    out.push({
      t: n.t, dur: n.dur, fromHz: startHz, toHz: n.hz,
      tRamp: Math.min(tRamp, n.dur), reaches: tRamp < n.dur - 1e-6,
    });
    last = n;
  }
  return out;
}

export function missedPitches(env) {
  return env.filter((e) => !e.reaches).length;
}

// schedule one axis on a Web Audio context. times in the notes are song seconds (already at 1x);
// tempo scales them the same way buildSong does (seconds / tempo).
export function scheduleVoice(ctx, notes, dest, {
  hzPerIpm, accelMmS2, legato = true, tempo = 1, t0 = 0, vol = 0.05,
} = {}) {
  const env = listenEnvelope(notes, { hzPerIpm, accelMmS2, legato });
  if (!env.length) return { osc: null, missed: 0 };
  const o = ctx.createOscillator(), gn = ctx.createGain();
  o.type = 'square';
  gn.gain.value = 0;
  o.connect(gn).connect(dest);
  o.frequency.setValueAtTime(Math.max(env[0].fromHz, 20), t0);
  for (const e of env) {
    const a = t0 + e.t / tempo, b = t0 + (e.t + e.dur) / tempo;
    const ramp = e.tRamp / tempo;
    gn.gain.setValueAtTime(vol, a);
    o.frequency.setValueAtTime(Math.max(e.fromHz, 20), a);
    if (ramp > 0.001) o.frequency.linearRampToValueAtTime(Math.max(e.toHz, 20), a + ramp);
    else o.frequency.setValueAtTime(Math.max(e.toHz, 20), a);
    if (e.reaches) o.frequency.setValueAtTime(Math.max(e.toHz, 20), a + ramp);
    gn.gain.setValueAtTime(0, Math.max(a + 0.01, b - 0.005));
  }
  o.start(t0);
  return { osc: o, missed: missedPitches(env) };
}

// true when the current From/To window does not cover the whole song
export function isPartialWindow(from, to, length, { eps = 0.05 } = {}) {
  if (!(length > 0)) return false;
  return from > eps || to < length - eps;
}
