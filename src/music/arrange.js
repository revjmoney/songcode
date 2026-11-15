// SPDX-License-Identifier: GPL-3.0-or-later
// SONGCODE by JMSCNC, Copyright (C) 2026 Rev. J. Money / JMSCNC (jmscnc.com).
// Licensed GPL-3.0-or-later; keep this attribution (GPLv3 section 7(b), see NOTICE.md).
//
// SONGCODE arranging (shared by tools/resonance/gen-gp-song.mjs and the SONGCODE converter page): a song's tracks
// ({ name: [{ t, dur, key }] } in seconds) -> two one-note-at-a-time lines. High voice = the lead line (vocals), and
// wherever it rests for more than `gap` s the fill track's top line plays instead (the riff); low voice = the bass.
// Then machine profiles for any stepper machine and the program framing (start / end code).
import { monoLine, fitVoice, mergeShort, expandSlides } from './voices.js';
import { rangeOf, buildSong, buildTrio, zDrumNotes, LATHE_OUT, netTravel } from './build.js';
import { tracePath, pathSummaryComments, isRotaryLetter } from './path.js';
export { isRotaryLetter, tracePath, pathSummaryComments, downloadText } from './path.js';
export { planProgram, junctionDeviationOf } from './planner.js';

const VOCAL = /vo[xc]|vocal|voice|voix|sing|lead|melod|solo/i;

// how single-note a track is (1 = never two notes at once)
export const monoOf = (ns) => (ns.length ? new Set(ns.map((n) => n.t)).size / ns.length : 0);
const avgKey = (ns) => ns.reduce((s, n) => s + n.key, 0) / (ns.length || 1);

// best guesses: lead = a vocal/lead-named track that is mostly single notes, else the most single-note track with
// enough notes; bass = a track named bass, else the lowest one; fill = the most single-note of the rest
export function autoPick(tracks) {
  const list = Object.entries(tracks).filter(([, ns]) => ns.length);
  if (!list.length) return { lead: null, bass: null, fill: null };
  const score = ([k, ns]) => monoOf(ns) * Math.min(ns.length, 400) * (VOCAL.test(k) ? 2 : 1);
  const lead = [...list].filter(([, ns]) => ns.length >= 16).sort((a, b) => score(b) - score(a))[0]?.[0] ?? list[0][0];
  const rest = list.filter(([k]) => k !== lead);
  const named = rest.find(([k]) => /bass|basse|bajo/i.test(k));
  const low = [...rest].sort((a, b) => avgKey(a[1]) - avgKey(b[1]))[0];
  const bass = named?.[0] ?? (low && avgKey(low[1]) < avgKey(tracks[lead]) - 7 ? low[0] : null);
  const fill = pickFill(tracks, lead, bass);
  return { lead, bass, fill };
}

// --fill auto: the other track that is most single-note (a riff or lead guitar), not the lead or the bass
export function pickFill(tracks, lead, bass) {
  return Object.entries(tracks).filter(([k, ns]) => k !== lead && k !== bass && ns.length >= 16)
    .map(([k, ns]) => [k, monoOf(ns) * Math.min(ns.length, 400)]).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

// opts: { lead, fill, bass, from = 0, to, repeat = 1, gap = 0.6 } -> { high, low } note lines (seconds from `from`)
export function arrange(tracks, { lead, fill, bass, from = 0, to = 1e9, repeat = 1, gap = 0.6 } = {}) {
  const all = Object.values(tracks).flat();
  const loopLen = Math.min(to, all.length ? Math.max(...all.map((n) => n.t + n.dur)) : 0) - from;
  const cut = (ns) => {
    const one = ns.filter((n) => n.t >= from && n.t < to).map((n) => ({ ...n, t: n.t - from, dur: Math.min(n.dur, to - n.t) }));
    return Array.from({ length: repeat }, (_, r) => one.map((n) => ({ ...n, t: n.t + r * loopLen }))).flat();
  };
  const leadLine = monoLine(cut(tracks[lead] ?? []), 'high');
  const fillLine = monoLine(cut(tracks[fill] ?? []), 'high');
  const bassLine = monoLine(cut(tracks[bass] ?? []), 'low');
  const busy = (t0, t1) => leadLine.some((n) => n.t < t1 + gap / 2 && n.t + n.dur > t0 - gap / 2);
  const high = [...leadLine, ...fillLine.filter((n) => !busy(n.t, n.t + n.dur))].sort((a, b) => a.t - b.t);
  return { high, low: bassLine };
}

// ---------- machines ----------
// A profile describes any stepper machine: two axes that sing (high voice, low voice), each with steps/mm (as set in
// the firmware), microsteps (a stepper sings at its FULL-step rate), max rate mm/min and accel mm/s2; a travel box
// (+/- around the start point, in the profile's units: in or mm); the g-code flavour. All moves are relative and end where they started.
export const PRESETS = {
  'REVTURN lathe': {
    note: 'Rev\'s REVTURN lathe (grblHAL). Starts by moving to Z-1.375 X0 in work coordinates, ends at Z-0.25 X0.',
    flavor: 'grbl', units: 'in', diameter: true, g7: true, numbers: true, tag: 'REVTURN music', junctionDeviation: 0.01,
    a: { axis: 'X', steps: 800, micro: 16, max: 1016, accel: 50, box: 0.65 },
    b: { axis: 'Z', steps: 1932, micro: 32, max: 558.8, accel: 12, box: 0.4 },
    // C (chuck): $103 steps/deg, $113 deg/min, $123 deg/s2. Used only when the third-voice option is on.
    c: { axis: 'C', steps: 13.333, micro: 8, max: 99000, accel: 3000 },
    start: 'G1 Z-1.375 F20\nG0 X0', end: 'G1 Z-0.25 F20\nG0 X0',
  },
  'grbl mill / router (X + Y)': {
    note: 'Typical GRBL machine with GT2 belts or 8 mm screws. Jog to a clear spot first: the song moves around it.',
    flavor: 'grbl', units: 'mm', diameter: false, g7: false, numbers: true, junctionDeviation: 0.01,
    a: { axis: 'X', steps: 80, micro: 16, max: 3000, accel: 200, box: 20 },
    b: { axis: 'Y', steps: 80, micro: 16, max: 3000, accel: 200, box: 20 },
    start: '', end: '',
  },
  '3D printer, Marlin (X + Y)': {
    note: 'Marlin: home first and lift Z, the song moves around where the head is. Dwell is in milliseconds.',
    flavor: 'marlin', units: 'mm', diameter: false, g7: false, numbers: false, junctionDeviation: 0.013,
    a: { axis: 'X', steps: 80, micro: 16, max: 6000, accel: 500, box: 25 },
    b: { axis: 'Y', steps: 80, micro: 16, max: 6000, accel: 500, box: 25 },
    start: '', end: '',
  },
  'LinuxCNC mill (X + Y)': {
    note: 'LinuxCNC: G4 P in seconds, M2 at the end.',
    flavor: 'linuxcnc', units: 'mm', diameter: false, g7: false, numbers: true, junctionDeviation: 0.05,
    a: { axis: 'X', steps: 200, micro: 8, max: 2400, accel: 300, box: 20 },
    b: { axis: 'Y', steps: 200, micro: 8, max: 2400, accel: 300, box: 20 },
    start: '', end: '',
  },
};

// profile -> the machine object buildSong uses (internally inches: Hz per ipm, max ipm, accel mm/s2)
// rotary: opt-in. A/B/C steps are steps/deg, max is deg/min, accel is deg/s². Hz is per deg/min.
export function machineOf(p, { rotary = false } = {}) {
  const hzLin = (ax) => (25.4 / 60) * (ax.steps / ax.micro);
  const hzRot = (ax) => (ax.steps / ax.micro) / 60;                    // Hz per deg/min
  // C is rotary: $103 is steps/deg, so Hz per rpm = (steps/deg * 360) / micro / 60
  const hzC = p.c ? (p.c.steps * 360) / p.c.micro / 60 : 1;
  const rotA = rotary && isRotaryLetter(p.a.axis);
  const rotB = rotary && isRotaryLetter(p.b.axis);
  return {
    hz: { X: rotA ? hzRot(p.a) : hzLin(p.a), Z: rotB ? hzRot(p.b) : hzLin(p.b), C: hzC },
    max: { X: rotA ? p.a.max : p.a.max / 25.4, Z: rotB ? p.b.max : p.b.max / 25.4, C: p.c ? p.c.max / 360 : 0 },
    acc: { X: p.a.accel, Z: p.b.accel, C: p.c?.accel ?? 0 },
    micro: { x: p.a.micro, z: p.b.micro, c: p.c?.micro ?? 8 },
  };
}

// profile -> buildSong's `out` (the written words)
export function outOf(p) {
  const units = p.units === 'mm' ? 'mm' : 'in';
  return {
    ...LATHE_OUT, axes: [p.a.axis, p.b.axis], diameter: !!p.diameter, units,
    header: [units === 'mm' ? 'G21' : 'G20', p.g7 ? 'G7' : '', 'G91', 'G94'].filter(Boolean).join(' '),
    dwell: p.flavor === 'marlin' ? 'ms' : 'sec', numbers: p.numbers !== false && p.flavor !== 'marlin',
    end: p.flavor === 'marlin' ? '' : p.flavor === 'linuxcnc' ? 'M2' : 'M30',
    tag: p.tag ?? 'SONGCODE',
  };
}

// start / end code: the header turns absolute (G90) for the start lines, then back to relative for the song;
// the end lines go after the song's own G90. Same as gen-gp-song.mjs always did for the lathe.
export function frame(lines, { start = '', end = '' } = {}, { wrapInch = false } = {}) {
  const L = lines.slice();
  const s = String(start).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const e = String(end).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const inch = (block) => (wrapInch ? ['G20', ...block] : block);
  if (s.length) {
    const i = L.findIndex((l) => /\bG91\b/.test(l));
    if (i >= 0) L.splice(i, 1, L[i].replace(/\bG91\b/, 'G90'), ...inch(s), wrapInch ? 'G21 G91' : 'G91');
    else L.splice(1, 0, ...(wrapInch ? ['G20'] : []), 'G90', ...s, wrapInch ? 'G21 G91' : 'G91');
  }
  if (e.length) {
    const i = L.findLastIndex((l) => /\bG90\b/.test(l));
    L.splice(i >= 0 ? i + 1 : L.length, 0, ...inch(e));
  }
  return L;
}

const inch = (p, v) => (p.units === 'mm' ? v / 25.4 : v);

// everything at once: tracks + picks + profile -> program.
// slides (default on): ~ notes become a pitch ramp in the g-code.
// trio / drums are opt-in and off by default, so two-axis output stays the same except for the new slides.
export function songcode(tracks, picks, profile, {
  title = 'song', tempo = 1, transpose = 0, mergeLow = 0.12, legato = true,
  slides = true, trio = false, drums = null, cLine = null,
  rotary = false, rotaryConvention = 'g93', rotaryRadius = null,
} = {}) {
  const rotA = rotary && isRotaryLetter(profile.a.axis);
  const rotB = rotary && isRotaryLetter(profile.b.axis);
  const rotaryOn = rotA || rotB;
  const { high, low } = arrange(tracks, picks);
  const m = machineOf(profile, { rotary: rotaryOn });
  const [al, ah] = rangeOf(m, 'X'), [bl, bh] = rangeOf(m, 'Z');
  const A = fitVoice(high, al, ah, transpose), B = fitVoice(low, bl, bh, transpose);
  let highNotes = slides ? expandSlides(A.notes) : A.notes;
  let lowNotes = mergeLow ? mergeShort(B.notes, mergeLow) : B.notes;
  if (slides) lowNotes = expandSlides(lowNotes);
  const drumHits = (drums ?? []).filter((d) => d.piece === 'K' || d.piece === 'S');
  const usedDrums = !trio && drumHits.length > 0;
  if (usedDrums) lowNotes = zDrumNotes(drumHits, m).map((n) => ({ ...n, key: 69 + 12 * Math.log2(Math.max(n.hz, 1) / 440) }));
  const out = outOf(profile);
  if (rotaryOn) {
    const conv = rotaryConvention || 'g93';
    const radius = rotaryRadius ?? (profile.units === 'in' ? 1 : 25);
    out.rotary = { enabled: true, convention: conv, radius };
    out.rotaryAxes = [rotA, rotB];
    if (conv === 'g93') out.header = out.header.replace(/\bG94\b/, 'G93');
  }
  const box = {
    boxX: rotA ? profile.a.box : inch(profile, profile.a.box),
    boxZ: rotB ? profile.b.box : inch(profile, profile.b.box),
  };
  let song, lines, travel, C = { notes: [], shift: 0, folded: 0 };
  if (trio && cLine?.length && m.max.C > 0) {
    const [cl, ch] = rangeOf(m, 'C');
    C = fitVoice(cLine, cl, ch, transpose);
    const cNotes = slides ? expandSlides(C.notes) : C.notes;
    song = buildTrio(highNotes, lowNotes, cNotes, m, { title, tempo, legato, ...box });
    // trio programs are written in mm; REVTURN start/end code is in inches
    lines = frame(song.lines, profile, { wrapInch: profile.units === 'in' });
    travel = netTravel(song.lines, { axes: ['X', 'Z'], diameter: true, units: 'mm' });
    // netTravel of mm diameter words: convert to profile units (inches) for the UI
    if (profile.units !== 'mm') {
      const k = 1 / 25.4;
      travel = { x: travel.x * k, z: travel.z * k, maxX: travel.maxX * k, maxZ: travel.maxZ * k };
    }
  } else {
    song = buildSong(highNotes, lowNotes, m, { title, tempo, legato, dolphin: false, ...box, out });
    lines = frame(song.lines, profile);
    travel = netTravel(song.lines, out);
  }
  const path = tracePath(lines, out, { ...profile, rotary: rotaryOn ? out.rotary : null });
  const pathSummary = pathSummaryComments(path);
  return {
    lines, text: lines.join('\n') + '\n', seconds: song.seconds, warnings: song.warnings, travel, out,
    high: highNotes, low: lowNotes, c: C.notes, shift: { a: A.shift, b: B.shift, c: C.shift },
    folded: { a: A.folded, b: B.folded, c: C.folded },
    slides: (slides ? highNotes.filter((n) => n.slide).length + lowNotes.filter((n) => n.slide).length : 0),
    trio: !!(trio && cLine?.length && m.max.C > 0), usedDrums, machine: m, legato,
    rotary: rotaryOn, path, pathSummary,
  };
}
