// SPDX-License-Identifier: GPL-3.0-or-later
// SONGCODE / REVTURN by JMSCNC, Copyright (C) 2026 Rev. J. Money / JMSCNC (jmscnc.com).
// Licensed GPL-3.0-or-later; keep this attribution (GPLv3 section 7(b), see NOTICE.md).
//
// Turn MIDI tracks into what two stepper motors can play: one note at a time per motor.
// X plays the melody (the highest sounding note), Z plays the bass (the lowest). Channel 10 is drums and is only
// used by the drum machine (a coordinated machine cannot hit a drum in the middle of a melody move).

export const hzOf = (key) => 440 * 2 ** ((key - 69) / 12);
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = (key) => `${NAMES[((key % 12) + 12) % 12]}${Math.floor(key / 12) - 1}`;
export const isDrumTrack = (tr) => tr.channel === 9;

// auto roles: drums -> 'drums'; the melodic track with the highest average pitch -> 'x', lowest -> 'z', rest 'off'
// (rest also go to 'x' or 'z' if their average sits close to that voice, so a split piano still sounds whole)
export function autoRoles(tracks) {
  const mel = tracks.map((t, i) => ({ i, avg: t.notes.reduce((s, n) => s + n.key, 0) / t.notes.length })).filter(({ i }) => !isDrumTrack(tracks[i]));
  const roles = tracks.map((t) => (isDrumTrack(t) ? 'drums' : 'off'));
  if (!mel.length) return roles;
  mel.sort((a, b) => b.avg - a.avg);
  roles[mel[0].i] = 'x';
  if (mel.length > 1) roles[mel[mel.length - 1].i] = 'z';
  return roles;
}

// one note at a time: at every moment keep the highest (pick='high') or lowest ('low') sounding note.
// Returns [{ t, dur, key }] with no overlaps; a re-struck note starts a new entry.
export function monoLine(notes, pick = 'high') {
  if (!notes.length) return [];
  const marks = [...new Set(notes.flatMap((n) => [n.t, n.t + n.dur]))].sort((a, b) => a - b);
  const out = [];
  for (let k = 0; k < marks.length - 1; k++) {
    const a = marks[k], b2 = marks[k + 1];
    if (b2 - a < 1e-6) continue;
    const live = notes.filter((n) => n.t <= a + 1e-9 && n.t + n.dur >= b2 - 1e-9);
    if (!live.length) continue;
    const n = live.reduce((m, x) => (pick === 'high' ? (x.key > m.key ? x : m) : x.key < m.key ? x : m));
    const prev = out[out.length - 1];
    if (prev && prev.src === n && Math.abs(prev.t + prev.dur - a) < 1e-6) prev.dur += b2 - a;
    else out.push({ t: a, dur: b2 - a, key: n.key, src: n, slide: !!n.slide, slideTo: n.slideTo });
  }
  return out.map(({ t, dur, key, slide, slideTo }) => ({ t, dur, key, ...(slide ? { slide: true } : {}), ...(slideTo != null ? { slideTo } : {}) }));
}

// shift a voice by whole octaves so most notes fit [loHz, hiHz]; notes still outside fold in by octaves and are
// marked folded. Returns { notes: [{ t, dur, key, hz, folded }], shift (semitones), folded (count) }
export function fitVoice(line, loHz, hiHz, transpose = 0) {
  if (!line.length) return { notes: [], shift: 0, folded: 0 };
  let best = 0, bestIn = -1;
  for (let o = -4; o <= 4; o++) {
    const inside = line.filter((n) => { const f = hzOf(n.key + transpose + 12 * o); return f >= loHz && f <= hiHz; }).length;
    if (inside > bestIn || (inside === bestIn && Math.abs(o) < Math.abs(best))) { bestIn = inside; best = o; }
  }
  const shift = transpose + 12 * best;
  let folded = 0;
  const notes = line.map((n) => {
    let key = n.key + shift, f = hzOf(key), fold = false;
    while (f > hiHz && f / 2 >= loHz) { key -= 12; f /= 2; fold = true; }
    while (f < loHz && f * 2 <= hiHz) { key += 12; f *= 2; fold = true; }
    const out = f > hiHz * 1.0001 || f < loHz * 0.9999;
    if (fold) folded++;
    const delta = key - (n.key + shift);
    return { t: n.t, dur: n.dur, key, hz: f, folded: fold, outside: out, ...(n.slide ? { slide: true } : {}),
      ...(n.slideTo != null ? { slideTo: n.slideTo + shift + delta } : {}) };
  });
  return { notes, shift, folded };
}

// a slow motor (Z, low accel) cannot speak short notes: fold notes under minDur into the note before them
export function mergeShort(notes, minDur) {
  const out = [];
  for (const n of notes) {
    const prev = out[out.length - 1];
    if (prev && n.dur < minDur && Math.abs(prev.t + prev.dur - n.t) < 0.02) {
      prev.dur = n.t + n.dur - prev.t;
      if (n.slide) prev.slide = true;
      if (n.slideTo != null) prev.slideTo = n.slideTo;
    } else out.push({ ...n });
  }
  return out;
}

// Drum-map keys -> REVTURN kit pieces (K kick, S snare, H hat, O open hat, T floor tom, U high tom).
// GM is the General MIDI percussion map on channel 10. GS (Roland) and XG (Yamaha) kits keep those
// note numbers and add a few aliases used on non-channel-10 drum parts.
const GM_DRUM = {
  35: 'K', 36: 'K',
  37: 'S', 38: 'S', 39: 'S', 40: 'S',
  42: 'H', 44: 'H',
  46: 'O', 49: 'O', 51: 'O', 52: 'O', 55: 'O', 57: 'O', 59: 'O',
  41: 'T', 43: 'T', 45: 'T',
  47: 'U', 48: 'U', 50: 'U',
};
export const DRUM_MAPS = {
  GM: { ...GM_DRUM },
  GS: { ...GM_DRUM, 27: 'S', 28: 'S', 29: 'S', 31: 'S', 32: 'S', 33: 'T', 34: 'T' },
  XG: { ...GM_DRUM, 25: 'S', 26: 'S', 27: 'S', 31: 'S', 32: 'T', 34: 'T' },
};
export const DRUM_MAP_NAMES = Object.keys(DRUM_MAPS);
export function mapDrum(key, map = 'GM') {
  const table = DRUM_MAPS[map] ?? DRUM_MAPS.GM;
  return table[key] ?? null;
}
export function gmDrum(key) { return mapDrum(key, 'GM'); }

// Bank MSB values that put a MIDI channel in a drum kit (Roland GS / Yamaha XG / similar).
export function isDrumBank(msb) { return msb === 120 || msb === 126 || msb === 127; }
export function drumNameGuess(name) {
  return /\b(drums?|percussion|drumkit|drum\s*kit)\b/i.test(String(name ?? ''));
}

// quantize a MIDI drum track to a grid of 8th notes: rows K,S,H,O,T,U x steps (true/false), up to maxSteps
export function drumsToGrid(notes, bpm, maxSteps = 16) {
  const step = 60 / bpm / 2;
  const grid = { K: [], S: [], H: [], O: [], T: [], U: [] };
  for (const r of Object.keys(grid)) grid[r] = Array(maxSteps).fill(false);
  for (const n of notes) {
    const piece = gmDrum(n.key); const s = Math.round(n.t / step);
    if (piece && s < maxSteps) grid[piece][s] = true;
  }
  return grid;
}

// A note with `slide: true` glides into the next note: split it into short steps whose pitch
// (MIDI key, so log frequency) walks from this note to the next. The next note still holds its
// own pitch when it arrives. Used so SONGCODE g-code matches the REVTURN screen's ~ bends.
export function expandSlides(notes, { minStep = 0.04 } = {}) {
  if (!notes?.length) return notes ?? [];
  const out = [];
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i], next = notes[i + 1];
    const connected = next && (next.t - (n.t + n.dur) < 0.05);
    const dest = (connected && next) ? next.key : (n.slideTo != null ? n.slideTo : null);
    if (!n.slide || dest == null || dest === n.key) { out.push({ ...n }); continue; }
    const steps = Math.max(3, Math.min(16, Math.round(n.dur / minStep)));
    for (let s = 0; s < steps; s++) {
      const frac = s / (steps - 1);
      const key = n.key + (dest - n.key) * frac;
      const hz = hzOf(key);
      out.push({
        t: n.t + (n.dur * s) / steps,
        dur: n.dur / steps,
        key,
        hz,
        folded: n.folded,
        outside: n.outside,
        slide: true,
      });
    }
  }
  return out;
}
