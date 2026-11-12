// SPDX-License-Identifier: GPL-3.0-or-later
// SONGCODE by JMSCNC, Copyright (C) 2026 Rev. J. Money / JMSCNC (jmscnc.com).
// Licensed GPL-3.0-or-later; keep this attribution (GPLv3 section 7(b), see NOTICE.md).
//
// Song book notation -> notes (seconds), MIDI bytes and alphaTex (for Guitar Pro files). See songs/book.js.
import { writeMidi } from './midi.js';

const KEYS = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
export const keyOf = (name) => { const m = /^([A-G]#?)(-?\d)$/.exec(name); if (!m) throw new Error(`bad note ${name}`); return KEYS[m[1]] + 12 * (Number(m[2]) + 1); };

// voice text -> [{ key | null (rest), len (units) }]
export function tokens(song, voice) {
  return (song[voice] ?? '').split(/\s+/).filter((s) => s && s !== '|').map((tok) => {
    const m = /^(r|[A-G]#?-?\d):(\d+(?:\.\d+)?)(~?)$/.exec(tok);
    if (!m) throw new Error(`${song.id} ${voice}: cannot read "${tok}"`);
    return { key: m[1] === 'r' ? null : keyOf(m[1]), len: Number(m[2]) };
  });
}

// unit position -> seconds through the tempo map
export function timeMap(song) {
  const map = (song.tempo ?? [[0, 1]]).slice().sort((a, b) => a[0] - b[0]);
  return (u) => {
    let t = 0;
    for (let i = 0; i < map.length; i++) {
      const [u0, f] = map[i], u1 = i + 1 < map.length ? map[i + 1][0] : Infinity;
      if (u <= u0) break;
      t += ((Math.min(u, u1) - u0) * song.unit) / f;
    }
    return t;
  };
}

export function voiceNotes(song, voice) {
  const at = timeMap(song), out = [];
  let u = 0;
  for (const { key, len } of tokens(song, voice)) {
    if (key != null) out.push({ t: at(u), dur: at(u + len) - at(u), key });
    u += len;
  }
  return out;
}

// { Melody: notes, Bass: notes } for the converter
export const bookTracks = (song) => ({ Melody: voiceNotes(song, 'x'), Bass: voiceNotes(song, 'z') });

// MIDI: one beat = one second (60 bpm), so the tempo map is baked into the note times
export function bookMidi(song) {
  const n = (v) => voiceNotes(song, v).map((x) => ({ t: x.t, dur: x.dur, key: x.key, vel: 96 }));
  return writeMidi([{ name: 'Melody', ch: 0, notes: n('x') }, { name: 'Bass', ch: 1, notes: n('z') }], { bpm: 60, ppq: 960 });
}

// ---------- Guitar Pro (through alphaTex) ----------
const GUITAR = [64, 59, 55, 50, 45, 40];                 // E4 B3 G3 D3 A2 E2, string 1 = high E
const BASS5 = [43, 38, 33, 28, 23];                      // G2 D2 A1 E1 B0
const DUR = [[16, 1, false], [12, 2, true], [8, 2, false], [6, 4, true], [4, 4, false], [3, 8, true], [2, 8, false], [1, 16, false]];

function fretOf(key, tuning) {
  let k = key;
  while (k > tuning[0] + 20) k -= 12;
  while (k < tuning[tuning.length - 1]) k += 12;
  for (let s = 0; s < tuning.length; s++) { const f = k - tuning[s]; if (f >= 0 && f <= 12) return `${f}.${s + 1}`; }
  for (let s = 0; s < tuning.length; s++) { const f = k - tuning[s]; if (f >= 0) return `${f}.${s + 1}`; }
  return `0.${tuning.length}`;
}

// one voice -> alphaTex bars (16ths, notes split at bar lines and tied), tempo marks at bar starts
function texVoice(song, voice, tuning, tempoAtBar) {
  const [num, den] = song.ts ?? [4, 4];
  const bar16 = (num * 16) / den, spu = song.spu ?? 1;
  const lead = song.pickup ? Math.round(bar16 - song.pickup * spu) % bar16 : 0;
  const bars = [[]];
  let pos = 0;
  const put = (key, n16) => {
    let first = true;
    while (n16 > 0) {
      const room = bar16 - (pos % bar16), take = Math.min(room, n16);
      let left = take;
      while (left > 0) {
        const [len, d, dot] = DUR.find(([l]) => l <= left);
        const fret = key == null ? 'r' : first ? fretOf(key, tuning) : `-.${fretOf(key, tuning).split('.')[1]}`;
        bars[bars.length - 1].push(`${fret}.${d}${dot ? ' {d}' : ''}`);
        first = false; left -= len; pos += len;
      }
      n16 -= take;
      if (pos % bar16 === 0) bars.push([]);
    }
  };
  if (lead) put(null, lead);
  for (const { key, len } of tokens(song, voice)) {
    const n16 = Math.round(len * spu);
    if (Math.abs(n16 - len * spu) > 1e-6) throw new Error(`${song.id}: ${len} units is not a whole number of 16ths`);
    put(key, n16);
  }
  if (!bars[bars.length - 1].length) bars.pop();
  else put(null, bar16 - (pos % bar16));                 // fill the last bar with rest
  if (!bars[bars.length - 1].length) bars.pop();
  return bars.map((b, i) => `${voice === 'x' && tempoAtBar.has(i) ? `\\tempo ${tempoAtBar.get(i)} ` : ''}${b.join(' ')}`).join(' |\n');
}

export function bookAlphaTex(song) {
  const [num, den] = song.ts ?? [4, 4];
  const spu = song.spu ?? 1, bar16 = (num * 16) / den;
  const lead = song.pickup ? Math.round(bar16 - song.pickup * spu) % bar16 : 0;
  const bpm = (f) => Math.round(60 / ((4 * song.unit) / spu / f));   // quarter notes per minute (Guitar Pro keeps whole numbers)
  const tempoAtBar = new Map();
  for (const [u, f] of song.tempo ?? []) if (u > 0) tempoAtBar.set(Math.round((u * spu + lead) / bar16), bpm(f));
  const q = (s) => `"${String(s).replace(/"/g, "'")}"`;
  return [
    `\\title ${q(song.title)} \\artist ${q(song.composer)} \\words ${q('Arranged for stepper motors by JMSCNC (public domain melody)')} \\tempo ${bpm(1)}`,
    '.',
    `\\track ${q('Melody')}`, `\\tuning E4 B3 G3 D3 A2 E2`, `\\ts ${num} ${den}`, texVoice(song, 'x', GUITAR, tempoAtBar),
    `\\track ${q('Bass')}`, `\\tuning G2 D2 A1 E1 B0`, `\\ts ${num} ${den}`, texVoice(song, 'z', BASS5, tempoAtBar),
  ].join('\n');
}
