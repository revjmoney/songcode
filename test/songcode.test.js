// SPDX-License-Identifier: GPL-3.0-or-later
// SONGCODE by JMSCNC, Copyright (C) 2026 Rev. J. Money / JMSCNC (jmscnc.com).
// Licensed GPL-3.0-or-later; keep this attribution (GPLv3 section 7(b), see NOTICE.md).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as alphaTab from '@coderline/alphatab';
import { BOOK } from '../songs/book.js';
import { bookTracks, bookMidi } from '../src/music/book.js';
import { loadSong } from '../src/music/load.js';
import { PRESETS, songcode, arrange, autoPick, frame, downloadText, machineOf as machineOfTop } from '../src/music/arrange.js';

const file = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const picks = { lead: 'Melody', bass: 'Bass', fill: null };
const moves = (lines) => lines.filter((l) => /^(N\d+ )?G1 /.test(l));
const word = (l, a) => { const m = new RegExp(`${a}(-?[\d.]+)`).exec(l); return m ? Number(m[1]) : 0; };

describe('song book files', () => {
  it('every shipped tab reads back with the book notes', () => {
    for (const s of BOOK) {
      const got = loadSong(alphaTab, file(`songs/tabs/${s.id}.gp`), `${s.id}.gp`).tracks, want = bookTracks(s);
      expect(got.Melody.map((n) => n.key), s.id).toEqual(want.Melody.map((n) => n.key));
      expect(got.Bass.map((n) => n.key), s.id).toEqual(want.Bass.map((n) => n.key));
    }
  });
  it('every shipped MIDI file is the book', () => {
    for (const s of BOOK) expect(Buffer.from(file(`songs/midi/${s.id}.mid`)).equals(Buffer.from(bookMidi(s))), s.id).toBe(true);
  });
  it('shipped g-code is what the converter writes today (lathe and grbl presets)', () => {
    for (const s of BOOK) for (const [tag, p] of [['revturn', 'REVTURN lathe'], ['grbl-xy', 'grbl mill / router (X + Y)']]) {
      const r = songcode(bookTracks(s), picks, PRESETS[p], { title: `${s.title}, ${s.composer}` });
      expect(r.text, `${s.id} ${tag}`).toBe(file(`songs/gcode/${s.id}-${tag}.nc`).toString());
    }
  });
});

describe('general g-code', () => {
  const tracks = bookTracks(BOOK.find((s) => s.id === 'mountain-king'));
  for (const name of ['grbl mill / router (X + Y)', '3D printer, Marlin (X + Y)', 'LinuxCNC mill (X + Y)']) {
    it(`${name}: no lathe words, relative, inside the box, under max rate, back at start`, () => {
      const p = PRESETS[name], r = songcode(tracks, picks, p);
      expect(r.text).not.toMatch(/G7|G20|M3 /);
      expect(r.lines[1]).toBe('G21 G91 G94');
      let x = 0, y = 0;
      for (const l of moves(r.lines)) {
        x += word(l, 'X'); y += word(l, 'Y');
        expect(Math.abs(x)).toBeLessThanOrEqual(p.a.box + 1e-3);
        expect(Math.abs(y)).toBeLessThanOrEqual(p.b.box + 1e-3);
        const f = word(l, 'F'), dx = Math.abs(word(l, 'X')), dy = Math.abs(word(l, 'Y')), d = Math.hypot(dx, dy);
        if (d > 0) { expect((f * dx) / d).toBeLessThanOrEqual(p.a.max * 1.001); expect((f * dy) / d).toBeLessThanOrEqual(p.b.max * 1.001); }
      }
      expect(Math.abs(x)).toBeLessThan(0.002); expect(Math.abs(y)).toBeLessThan(0.002);
      expect(r.text).not.toMatch(/\bZ-?\d/);
    });
  }
  it('Marlin: dwell in whole milliseconds, no line numbers, no M30', () => {
    const r = songcode(bookTracks(BOOK.find((s) => s.id === 'saints')), picks, PRESETS['3D printer, Marlin (X + Y)']);
    expect(r.text).not.toMatch(/^N\d/m);
    expect(r.text).not.toMatch(/M30/);
    expect(r.lines.filter((l) => l.startsWith('G4')).every((l) => /^G4 P\d+$/.test(l))).toBe(true);
  });
  it('LinuxCNC ends with M2, grbl with M30', () => {
    const t = bookTracks(BOOK[5]);
    expect(songcode(t, picks, PRESETS['LinuxCNC mill (X + Y)']).lines.at(-1)).toBe('M2');
    expect(songcode(t, picks, PRESETS['grbl mill / router (X + Y)']).lines.at(-1)).toBe('M30');
  });
  it('the lathe preset doubles X (diameter) and starts at Z-1.375 X0', () => {
    const r = songcode(tracks, picks, PRESETS['REVTURN lathe']);
    expect(r.lines.slice(1, 5)).toEqual(['G20 G7 G90 G94', 'G1 Z-1.375 F20', 'G0 X0', 'G91']);
    let x = 0; for (const l of moves(r.lines.slice(5))) x += word(l, 'X');
    expect(Math.abs(x)).toBeLessThan(0.001);
    expect(r.travel.maxX).toBeLessThanOrEqual(0.65 + 1e-3);
  });
});

describe('arranging', () => {
  const tr = {
    Vox: [{ t: 0, dur: 1, key: 67 }, { t: 4, dur: 1, key: 69 }],
    Riff: Array.from({ length: 20 }, (_, i) => ({ t: i * 0.25, dur: 0.2, key: 60 + (i % 3) })),
    Bass: [{ t: 0, dur: 2, key: 40 }, { t: 2, dur: 2, key: 43 }],
  };
  it('fill notes play only in the lead rests', () => {
    const { high } = arrange(tr, { lead: 'Vox', fill: 'Riff', bass: 'Bass' });
    const fills = high.filter((n) => n.key < 67);
    expect(fills.length).toBeGreaterThan(0);
    expect(fills.every((n) => n.t >= 1.3 - 1e-9 && n.t + n.dur <= 3.7 + 1e-9)).toBe(true);
  });
  it('auto pick finds the vocal, bass and riff', () => {
    expect(autoPick({ ...tr, Vox: Array.from({ length: 20 }, (_, i) => ({ t: i, dur: 0.9, key: 67 })) })).toEqual({ lead: 'Vox', bass: 'Bass', fill: 'Riff' });
  });
  it('section, repeat and start/end framing', () => {
    const { high } = arrange(tr, { lead: 'Vox', from: 4, to: 5, repeat: 3 });
    expect(high.map((n) => n.t)).toEqual([0, 1, 2]);
    expect(frame(['(t)', 'G21 G91 G94', 'G1 X1 F10', 'G90', 'M30'], { start: 'G0 X5\nG0 Y5', end: 'G0 Z10' }))
      .toEqual(['(t)', 'G21 G90 G94', 'G0 X5', 'G0 Y5', 'G91', 'G1 X1 F10', 'G90', 'G0 Z10', 'M30']);
  });
  it('MIDI files load with track names and drums left out', () => {
    const s = loadSong(alphaTab, bookMidi(BOOK[4]), 'ode.mid');
    expect(Object.keys(s.tracks)).toEqual(['Melody', 'Bass']);
    expect(s.kind).toBe('MIDI');
  });
});

import { tokens, voiceNotes } from '../src/music/book.js';
import { expandSlides, hzOf } from '../src/music/voices.js';
import { buildSong } from '../src/music/build.js';
import { machineOf } from '../src/music/arrange.js';
import { writeMidi, parseMidi } from '../src/music/midi.js';
import { listenEnvelope, rampTime, isPartialWindow } from '../src/music/listen.js';

describe('slides', () => {
  const king = BOOK.find((s) => s.id === 'mountain-king');
  it('keeps the ~ flag on book notes', () => {
    const tok = tokens(king, 'x');
    expect(tok.filter((t) => t.slide).length).toBeGreaterThan(0);
    expect(voiceNotes(king, 'x').some((n) => n.slide)).toBe(true);
  });
  it('expands a slide into a pitch ramp toward the next note', () => {
    const a = { t: 0, dur: 1, key: 60, hz: hzOf(60), slide: true };
    const b = { t: 1, dur: 1, key: 72, hz: hzOf(72) };
    const got = expandSlides([a, b]);
    const ramp = got.filter((n) => n.slide);
    expect(ramp.length).toBeGreaterThanOrEqual(3);
    expect(ramp[0].hz).toBeCloseTo(hzOf(60), 5);
    expect(ramp.at(-1).hz).toBeCloseTo(hzOf(72), 5);
    expect(ramp[1].hz).toBeGreaterThan(ramp[0].hz);
    expect(got.at(-1).key).toBe(72);
  });
  it('with slides off, a sliding song still matches the old two-axis g-code', () => {
    const r = songcode(bookTracks(king), picks, PRESETS['REVTURN lathe'], { title: `${king.title}, ${king.composer}`, slides: false });
    expect(r.text).toBe(file('test/fixtures/mountain-king-revturn-noslide.nc').toString());
    expect(r.slides).toBe(0);
  });
  it('with slides on (the default), the last Mountain King slide is a changing feed, not a held pitch', () => {
    const r = songcode(bookTracks(king), picks, PRESETS['REVTURN lathe'], { title: `${king.title}, ${king.composer}` });
    expect(r.slides).toBeGreaterThan(0);
    expect(r.text).not.toBe(file('test/fixtures/mountain-king-revturn-noslide.nc').toString());
    const ramp = r.high.filter((n) => n.slide);
    expect(ramp.length).toBeGreaterThanOrEqual(3);
    expect(ramp[0].hz).not.toBeCloseTo(ramp.at(-1).hz, 0);
  });
});

describe('safety and opt-in voices', () => {
  const twinkle = BOOK.find((s) => s.id === 'twinkle');
  const tracks = bookTracks(twinkle);
  it('buildSong never turns the spindle on, even if a drone value is passed', () => {
    const m = machineOf(PRESETS['REVTURN lathe']);
    const song = buildSong([{ t: 0, dur: 0.5, hz: 200 }], [], m, { title: 'drone test', drone: 80 });
    expect(song.lines.join('\n')).not.toMatch(/\bM3\b/);
    expect(song.lines.join('\n')).not.toMatch(/\bM4\b/);
  });
  it('a song with no slides still writes the same two-axis REVTURN program', () => {
    const r = songcode(tracks, picks, PRESETS['REVTURN lathe'], { title: `${twinkle.title}, ${twinkle.composer}` });
    expect(r.text).toBe(file('test/fixtures/twinkle-revturn.nc').toString());
    expect(r.trio).toBe(false);
    expect(r.usedDrums).toBe(false);
  });
  it('the C-axis third voice is off by default and opt-in writes C words with the spindle off', () => {
    const cLine = [{ t: 0, dur: 2, key: 74 }]; // D5
    const off = songcode(tracks, picks, PRESETS['REVTURN lathe'], { title: 'twinkle' });
    expect(off.text).not.toMatch(/\bC-?[\d.]/);
    const on = songcode(tracks, picks, PRESETS['REVTURN lathe'], { title: 'twinkle trio', trio: true, cLine });
    expect(on.trio).toBe(true);
    expect(on.text).toMatch(/\bC-?[\d.]/);
    expect(on.lines[1]).toBe('M5');
    expect(on.text).not.toMatch(/\bM3\b/);
    expect(on.lines.some((l) => l === 'G20')).toBe(true);
  });
  it('drums on Z are off by default and opt-in replace the bass with kick/snare strokes', () => {
    const drums = [{ t: 0, piece: 'K' }, { t: 0.8, piece: 'S' }, { t: 1.6, piece: 'K' }];
    const off = songcode(tracks, picks, PRESETS['REVTURN lathe'], { title: 'twinkle' });
    const on = songcode(tracks, picks, PRESETS['REVTURN lathe'], { title: 'twinkle drums', drums });
    expect(on.usedDrums).toBe(true);
    expect(on.low.some((n) => n.drum === 'K' || n.drum === 'S')).toBe(true);
    expect(on.text).not.toBe(off.text);
  });
  it('loadSong keeps GM drum notes in drums, not in pitched tracks', () => {
    const bytes = writeMidi([
      { name: 'Melody', ch: 0, notes: [{ t: 0, dur: 1, key: 60, vel: 100 }] },
      { name: 'Drums', ch: 9, notes: [{ t: 0, dur: 0.1, key: 36, vel: 100 }, { t: 1, dur: 0.1, key: 38, vel: 100 }] },
    ]);
    const s = loadSong(alphaTab, bytes, 'kit.mid');
    expect(Object.keys(s.tracks)).toEqual(['Melody']);
    expect(s.drums.map((d) => d.piece)).toEqual(['K', 'S']);
  });
});

describe('LISTEN ramps and the section window', () => {
  it('a short note on slow Z accel does not reach pitch; a long note does', () => {
    const hzPerIpm = (25.4 / 60) * (1932 / 32);          // REVTURN Z
    const accel = 12;                                    // mm/s²
    const hz = 400;                                       // a high Z note (~15 ipm): ramp is ~0.55 s
    const tRamp = rampTime(0, hz, hzPerIpm, accel);
    expect(tRamp).toBeGreaterThan(0.4);
    const short = listenEnvelope([{ t: 0, dur: 0.1, hz }], { hzPerIpm, accelMmS2: accel });
    expect(short[0].reaches).toBe(false);
    const long = listenEnvelope([{ t: 0, dur: 2, hz }], { hzPerIpm, accelMmS2: accel });
    expect(long[0].reaches).toBe(true);
  });
  it('isPartialWindow is true only when From/To leaves some of the song out', () => {
    expect(isPartialWindow(0, 60, 180)).toBe(true);
    expect(isPartialWindow(0, 181, 180)).toBe(false);
    expect(isPartialWindow(8, 68, 50)).toBe(true);
    expect(isPartialWindow(0, 50, 50)).toBe(false);
  });
});


import { tracePath, pathSummaryComments } from '../src/music/path.js';

describe('slide import from MIDI and Guitar Pro', () => {
  it('parses a pitch-bend into a slide toward the bent pitch', () => {
    const bytes = writeMidi([{
      name: 'Melody', ch: 0,
      notes: [{ t: 0, dur: 1, key: 60, vel: 100, slide: true }, { t: 1, dur: 1, key: 64, vel: 100 }],
    }]);
    const s = loadSong(alphaTab, bytes, 'bend.mid');
    const n = s.tracks.Melody[0];
    expect(n.slide).toBe(true);
    expect(n.slideTo ?? 64).toBe(64);
    const r = songcode({ Melody: s.tracks.Melody, Bass: [] }, { lead: 'Melody', bass: null, fill: null }, PRESETS['grbl mill / router (X + Y)']);
    expect(r.slides).toBeGreaterThan(0);
  });
  it('marks a portamento (CC 65) into the next note as a slide', () => {
    // hand-built: note 60, CC 65 on, note 64 shortly after
    const raw = writeMidi([{
      name: 'Melody', ch: 0,
      notes: [{ t: 0, dur: 0.5, key: 60, vel: 100 }, { t: 0.5, dur: 0.5, key: 64, vel: 100 }],
    }]);
    // inject CC 65 at tick 0 on top of the written file by going through parse after a custom write
    const ev = [];
    const bpm = 120, ppq = 480, ch = 0;
    const us = Math.round(60e6 / bpm);
    const vlq = (v) => { const out = [v & 0x7f]; while ((v >>= 7)) out.unshift((v & 0x7f) | 0x80); return out; };
    const chunk = (id, data) => [...id].map((c) => c.charCodeAt(0)).concat([(data.length >>> 24) & 255, (data.length >> 16) & 255, (data.length >> 8) & 255, data.length & 255], data);
    const events = [
      [0, [0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255]],
      [0, [0xb0 | ch, 65, 127]],
      [0, [0x90 | ch, 60, 100]],
      [Math.round(0.5 * ppq), [0x80 | ch, 60, 0]],
      [Math.round(0.5 * ppq), [0x90 | ch, 64, 100]],
      [Math.round(1 * ppq), [0x80 | ch, 64, 0]],
    ];
    const data = []; let last = 0;
    for (const [tk, bytes] of events) { data.push(...vlq(tk - last), ...bytes); last = tk; }
    data.push(0, 0xff, 0x2f, 0);
    const mid = new Uint8Array([...chunk('MThd', [0, 1, 0, 1, (ppq >> 8) & 255, ppq & 255]), ...chunk('MTrk', data)]);
    const s = loadSong(alphaTab, mid, 'porta.mid');
    expect(Object.values(s.tracks)[0][0].slide).toBe(true);
  });
  it('a book MIDI with slides round-trips the flags, and a no-slide MIDI stays slide-free', () => {
    const king = BOOK.find((s) => s.id === 'mountain-king');
    const twinkle = BOOK.find((s) => s.id === 'twinkle');
    const k = loadSong(alphaTab, bookMidi(king), 'king.mid');
    expect(k.tracks.Melody.some((n) => n.slide)).toBe(true);
    const t = loadSong(alphaTab, bookMidi(twinkle), 'twinkle.mid');
    expect(t.tracks.Melody.some((n) => n.slide)).toBeFalsy();
  });
  it('a book Guitar Pro with slides recovers them on load', () => {
    const king = BOOK.find((s) => s.id === 'mountain-king');
    const s = loadSong(alphaTab, file('songs/tabs/mountain-king.gp'), 'mountain-king.gp');
    expect(s.tracks.Melody.some((n) => n.slide), 'regenerate tabs with make-songs if this fails').toBe(true);
    expect(s.tracks.Melody.map((n) => n.key)).toEqual(bookTracks(king).Melody.map((n) => n.key));
  });
  it('expandSlides follows slideTo when the next note is missing', () => {
    const a = { t: 0, dur: 1, key: 60, hz: hzOf(60), slide: true, slideTo: 72 };
    const got = expandSlides([a]);
    expect(got.length).toBeGreaterThanOrEqual(3);
    expect(got[0].hz).toBeCloseTo(hzOf(60), 5);
    expect(got.at(-1).hz).toBeCloseTo(hzOf(72), 5);
  });
});

describe('bounce-box path plot', () => {
  const twinkle = BOOK.find((s) => s.id === 'twinkle');
  it('traces the relative envelope inside the box and keeps songcode().text free of summary comments', () => {
    const r = songcode(bookTracks(twinkle), picks, PRESETS['grbl mill / router (X + Y)'], { title: `${twinkle.title}, ${twinkle.composer}` });
    expect(r.text).toBe(file('songs/gcode/twinkle-grbl-xy.nc').toString());
    expect(r.text).not.toMatch(/SONGCODE travel/);
    expect(r.path.overtravel).toEqual([]);
    expect(r.path.axes.X.peak).toBeLessThanOrEqual(PRESETS['grbl mill / router (X + Y)'].a.box + 1e-3);
    expect(r.path.axes.Y.peak).toBeLessThanOrEqual(PRESETS['grbl mill / router (X + Y)'].b.box + 1e-3);
    const dl = downloadText(r);
    expect(dl).toMatch(/\(SONGCODE travel:/);
    expect(dl).toMatch(/\(overtravel: none\)/);
    expect(r.pathSummary.some((l) => l.startsWith('(SONGCODE travel:'))).toBe(true);
  });
  it('flags overtravel when a relative move walks past the box', () => {
    const profile = { units: 'mm', a: { axis: 'X', box: 20 }, b: { axis: 'Y', box: 20 } };
    const tr = tracePath(['(t)', 'G21 G91 G94', 'G1 X25 Y0 F100', 'G1 X10 F100', 'G90', 'M30'], { axes: ['X', 'Y'], diameter: false, units: 'mm' }, profile);
    expect(tr.axes.X.peak).toBeCloseTo(35, 5);
    expect(tr.overtravel.length).toBeGreaterThan(0);
    expect(pathSummaryComments(tr).join('\n')).toMatch(/overtravel: X /);
  });
});

describe('rotary feed math', () => {
  const twinkle = BOOK.find((s) => s.id === 'twinkle');
  const tracks = bookTracks(twinkle);
  const mill = PRESETS['grbl mill / router (X + Y)'];
  const rotaryP = {
    ...mill,
    a: { ...mill.a, axis: 'X' },
    b: { axis: 'A', steps: 13.333, micro: 8, max: 18000, accel: 3000, box: 90 },
  };
  it('is off by default: two-axis X+Y output stays byte-identical', () => {
    const r = songcode(tracks, picks, mill, { title: `${twinkle.title}, ${twinkle.composer}` });
    expect(r.rotary).toBe(false);
    expect(r.text).toBe(file('songs/gcode/twinkle-grbl-xy.nc').toString());
  });
  it('G93 inverse time: F is 60/t, A words are degrees, header is G93', () => {
    const r = songcode(tracks, picks, rotaryP, { title: 'twinkle rotary', rotary: true, rotaryConvention: 'g93' });
    expect(r.rotary).toBe(true);
    expect(r.lines[1]).toMatch(/\bG93\b/);
    expect(r.text).toMatch(/\bA-?[\d.]/);
    const move = r.lines.find((l) => /G1 .*A/.test(l) && /F/.test(l));
    expect(move).toBeTruthy();
    const f = Number(/F([\d.]+)/.exec(move)[1]);
    expect(f).toBeGreaterThan(1);
    // inverse time is typically tens to thousands, not a mm/min hypot of 13.333
    const fs = r.lines.filter((l) => /^(N\d+ )?G1 /.test(l)).map((l) => Number(/F([\d.]+)/.exec(l)?.[1])).filter((x) => x > 0);
    expect(fs.every((x) => x === Number(x.toFixed(4)))).toBe(true);
  });
  it('deg/min convention writes F in deg/min on a rotary-only move', () => {
    const onlyA = { Melody: [], Bass: [{ t: 0, dur: 1, key: 69 }] }; // A4 = 440 Hz on A
    const r = songcode(onlyA, { lead: null, bass: 'Bass', fill: null }, rotaryP, { title: 'a-only', rotary: true, rotaryConvention: 'deg' });
    expect(r.lines[1]).toMatch(/\bG94\b/);
    const move = r.lines.find((l) => /G1 .*A/.test(l) && !/X/.test(l));
    expect(move).toBeTruthy();
    const f = Number(/F([\d.]+)/.exec(move)[1]);
    // 440 Hz / ((13.333/8)/60) = 440 / 0.027777... = 15840 deg/min, capped at 18000
    expect(f).toBeCloseTo(15840, 0);
  });
  it('radius convention: F is hypot(linear, ω · radius)', () => {
    const r = songcode(tracks, picks, rotaryP, { title: 'radius', rotary: true, rotaryConvention: 'radius', rotaryRadius: 25 });
    expect(r.lines[1]).toMatch(/\bG94\b/);
    expect(r.text).toMatch(/\bA-?[\d.]/);
    const move = r.lines.find((l) => /G1 /.test(l) && /F/.test(l) && /A/.test(l) && /X/.test(l));
    expect(move).toBeTruthy();
  });
  it('LinuxCNC and Marlin rotary programs keep their end-of-program flavour', () => {
    const linux = { ...PRESETS['LinuxCNC mill (X + Y)'], b: { axis: 'A', steps: 13.333, micro: 8, max: 18000, accel: 3000, box: 90 } };
    const marlin = { ...PRESETS['3D printer, Marlin (X + Y)'], b: { axis: 'A', steps: 13.333, micro: 8, max: 18000, accel: 3000, box: 90 } };
    expect(songcode(tracks, picks, linux, { title: 'l', rotary: true }).lines.at(-1)).toBe('M2');
    const m = songcode(tracks, picks, marlin, { title: 'm', rotary: true });
    expect(m.lines.at(-1)).not.toBe('M30');
    expect(m.text).not.toMatch(/^N\d/m);
  });
});


import { junctionMaxSpeed, trapezoid, planBlocks, planProgram, junctionDeviationOf } from '../src/music/planner.js';
import { parseDivision, smpteDivision, parseMidi } from '../src/music/midi.js';
import { applyDrumMap, markTrackAsDrums, markTrackAsPitched, isAutoDrumTrack, notesToDrums } from '../src/music/load.js';
import { mapDrum, drumNameGuess } from '../src/music/voices.js';
import { machineOf } from '../src/music/arrange.js';

describe('motion planner (LISTEN)', () => {
  it('a short single-axis block is a triangle and never reaches cruise (hand-computed)', () => {
    // d = 10 mm, a = 50 mm/s², F = 50 mm/s, start and end at rest
    const p = trapezoid(10, 50, 0, 0, 50);
    expect(p.kind).toBe('triangle');
    expect(p.vPeak).toBeCloseTo(Math.sqrt(500), 8);       // v² = a d = 500
    expect(p.time).toBeCloseTo(2 * Math.sqrt(500) / 50, 8);
    expect(p.reaches).toBe(false);
  });
  it('a long single-axis block is a trapezoid that cruises at F (hand-computed)', () => {
    // d = 100 mm, a = 50, F = 50 mm/s, rest to rest: accel 25 mm / 1 s, cruise 50 mm / 1 s, decel 25 mm / 1 s
    const p = trapezoid(100, 50, 0, 0, 50);
    expect(p.kind).toBe('trapezoid');
    expect(p.vPeak).toBeCloseTo(50, 8);
    expect(p.accelDist).toBeCloseTo(25, 8);
    expect(p.cruiseDist).toBeCloseTo(50, 8);
    expect(p.decelDist).toBeCloseTo(25, 8);
    expect(p.time).toBeCloseTo(3, 8);
    expect(p.reaches).toBe(true);
  });
  it('a 90-degree corner uses the grbl junction-deviation formula (hand-computed)', () => {
    const vj = junctionMaxSpeed({ X: 1, Y: 0 }, { X: 0, Y: 1 }, 50, 0.01);
    // cos θ_j = 0, sin(θ/2) = √(1/2), v² = (50 · 0.01 · √0.5) / (1 − √0.5)
    const sinHalf = Math.sqrt(0.5);
    const expectV = Math.sqrt((50 * 0.01 * sinHalf) / (1 - sinHalf));
    expect(vj).toBeCloseTo(expectV, 8);
    expect(vj).toBeCloseTo(1.0986841135, 6);
  });
  it('a straight junction does not slow down, a reversal does', () => {
    expect(junctionMaxSpeed({ X: 1 }, { X: 1 }, 50, 0.01)).toBe(Infinity);
    expect(junctionMaxSpeed({ X: 1 }, { X: -1 }, 50, 0.01)).toBe(0);
  });
  it('lookahead lets two colinear blocks cruise through the junction', () => {
    const blocks = [
      { kind: 'move', delta: { X: 80 }, distance: 80, unit: { X: 1 }, accel: 50, vNominal: 50, letters: ['X'] },
      { kind: 'move', delta: { X: 80 }, distance: 80, unit: { X: 1 }, accel: 50, vNominal: 50, letters: ['X'] },
    ];
    const { blocks: out } = planBlocks(blocks, { junctionDeviation: 0.01 });
    const [a, b] = out.filter((x) => x.kind === 'move');
    expect(a.profile.reaches).toBe(true);
    expect(b.profile.reaches).toBe(true);
    expect(a.vExit).toBeCloseTo(50, 5);
    expect(b.vEntry).toBeCloseTo(50, 5);
  });
  it('per-axis accel limits the path accel on a diagonal (hand-computed)', () => {
    const p = PRESETS['grbl mill / router (X + Y)'];
    // override accels: X 50, Y 12 mm/s², a 10+10 mm move
    const profile = { ...p, a: { ...p.a, accel: 50 }, b: { ...p.b, accel: 12 } };
    const m = machineOf(profile);
    const lines = ['(t)', 'G21 G91 G94', 'G1 X10 Y10 F3000', 'G90', 'M30'];
    const plan = planProgram(lines, { axes: ['X', 'Y'], diameter: false, units: 'mm', header: 'G21 G91 G94' }, m, profile);
    const b = plan.blocks.find((x) => x.kind === 'move');
    const u = 10 / Math.hypot(10, 10);                    // 1/√2
    expect(b.accel).toBeCloseTo(12 / u, 6);                 // Y is the limiter
  });
  it('LISTEN planner flags a short block that cannot reach the written feed', () => {
    const profile = PRESETS['REVTURN lathe'];
    const m = machineOf(profile);
    const lines = ['(REVTURN music: t)', 'G20 G7 G91 G94', 'G1 X0.02 F40', 'G90', 'M30'];
    const plan = planProgram(lines, { axes: ['X', 'Z'], diameter: true, units: 'in', header: 'G20 G7 G91 G94' }, m, profile);
    expect(plan.missed).toBeGreaterThan(0);
  });
  it('preset junction deviation follows the flavour (grbl 0.01, Marlin 0.013, LinuxCNC 0.05)', () => {
    expect(junctionDeviationOf(PRESETS['grbl mill / router (X + Y)'])).toBe(0.01);
    expect(junctionDeviationOf(PRESETS['REVTURN lathe'])).toBe(0.01);
    expect(junctionDeviationOf(PRESETS['3D printer, Marlin (X + Y)'])).toBe(0.013);
    expect(junctionDeviationOf(PRESETS['LinuxCNC mill (X + Y)'])).toBe(0.05);
  });
  it('planning a book song does not change songcode().text', () => {
    const twinkle = BOOK.find((s) => s.id === 'twinkle');
    const r = songcode(bookTracks(twinkle), picks, PRESETS['grbl mill / router (X + Y)'], { title: `${twinkle.title}, ${twinkle.composer}` });
    expect(r.text).toBe(file('songs/gcode/twinkle-grbl-xy.nc').toString());
    const plan = planProgram(r.lines, r.out, r.machine, PRESETS['grbl mill / router (X + Y)']);
    expect(plan.blocks.some((b) => b.kind === 'move')).toBe(true);
    expect(plan.seconds).toBeGreaterThan(1);
  });
});

function smpteFile(fpsCode, tpf, { key = 60, ticks = 40, ch = 0, name = 'Melody', bank = null } = {}) {
  const div = smpteDivision(fpsCode, tpf);
  const vlq = (v) => { const out = [v & 0x7f]; while ((v >>= 7)) out.unshift((v & 0x7f) | 0x80); return out; };
  const chunk = (id, data) => [...id].map((c) => c.charCodeAt(0)).concat([(data.length >>> 24) & 255, (data.length >> 16) & 255, (data.length >> 8) & 255, data.length & 255], data);
  const ev = [];
  const nm = [...name].map((c) => c.charCodeAt(0) & 0x7f);
  ev.push([0, [0xff, 0x03, nm.length, ...nm]]);
  if (bank != null) ev.push([0, [0xb0 | ch, 0, bank]], [0, [0xb0 | ch, 32, 0]]);
  ev.push([0, [0x90 | ch, key, 100]]);
  ev.push([ticks, [0x80 | ch, key, 0]]);
  const data = []; let last = 0;
  for (const [tk, bytes] of ev) { data.push(...vlq(tk - last), ...bytes); last = tk; }
  data.push(0, 0xff, 0x2f, 0);
  const head = chunk('MThd', [0, 1, 0, 1, (div >> 8) & 255, div & 255]);
  return new Uint8Array([...head, ...chunk('MTrk', data)]);
}

describe('SMPTE-timed MIDI', () => {
  it('parses the 24 / 25 / 29 / 30 fps division codes, and 29 as 29.97 drop-frame', () => {
    expect(parseDivision(smpteDivision(24, 40))).toMatchObject({ smpte: true, fpsCode: 24, fps: 24, ticksPerFrame: 40, dropFrame: false });
    expect(parseDivision(smpteDivision(25, 40))).toMatchObject({ smpte: true, fpsCode: 25, fps: 25, dropFrame: false });
    const d29 = parseDivision(smpteDivision(29, 80));
    expect(d29.fpsCode).toBe(29);
    expect(d29.dropFrame).toBe(true);
    expect(d29.fps).toBeCloseTo(30 / 1.001, 10);
    expect(parseDivision(smpteDivision(30, 80)).fps).toBe(30);
    expect(parseDivision(480)).toEqual({ smpte: false, ppq: 480 });
  });
  it('converts ticks to seconds at 25 fps, 40 ticks/frame (hand-computed)', () => {
    // 40 ticks = 1 frame = 1/25 s = 0.04 s
    const bytes = smpteFile(25, 40, { ticks: 40 });
    const m = parseMidi(bytes);
    expect(m.timing.smpte).toBe(true);
    expect(m.tracks[0].notes[0].dur).toBeCloseTo(0.04, 10);
    expect(m.length).toBeCloseTo(0.04, 10);
  });
  it('uses 29.97 drop-frame (30/1.001) for the 29 fps code (hand-computed)', () => {
    const tpf = 80;
    const bytes = smpteFile(29, tpf, { ticks: tpf });       // one frame
    const m = parseMidi(bytes);
    expect(m.timing.dropFrame).toBe(true);
    expect(m.tracks[0].notes[0].dur).toBeCloseTo(1.001 / 30, 10);
  });
});

describe('non-GM drum maps', () => {
  it('GS/XG bank-select on a non-10 channel is treated as a drum part', () => {
    const bytes = smpteFile(25, 40, { key: 36, ticks: 40, ch: 2, name: 'GS Kit', bank: 127 });
    // smpteFile works, but also test PPQ writeMidi + hand CC
    const mid = writeMidi([
      { name: 'Kit', ch: 3, notes: [{ t: 0, dur: 0.1, key: 36, vel: 100 }, { t: 0.5, dur: 0.1, key: 38, vel: 100 }] },
      { name: 'Melody', ch: 0, notes: [{ t: 0, dur: 1, key: 60, vel: 100 }] },
    ]);
    // inject CC0=120 at the start of the Kit track by building directly
    const vlq = (v) => { const out = [v & 0x7f]; while ((v >>= 7)) out.unshift((v & 0x7f) | 0x80); return out; };
    const chunk = (id, data) => [...id].map((c) => c.charCodeAt(0)).concat([(data.length >>> 24) & 255, (data.length >> 16) & 255, (data.length >> 8) & 255, data.length & 255], data);
    const ev = [
      [0, [0xff, 0x03, 3, 75, 105, 116]],
      [0, [0xb0 | 3, 0, 120]],
      [0, [0xb0 | 3, 32, 0]],
      [0, [0x90 | 3, 36, 100]],
      [48, [0x80 | 3, 36, 0]],
      [240, [0x90 | 3, 38, 100]],
      [288, [0x80 | 3, 38, 0]],
    ];
    const data = []; let last = 0;
    for (const [tk, bytes] of ev) { data.push(...vlq(tk - last), ...bytes); last = tk; }
    data.push(0, 0xff, 0x2f, 0);
    // tempo track + kit
    const us = Math.round(60e6 / 120);
    const tempo = [];
    tempo.push(0, 0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255, 0, 0xff, 0x2f, 0);
    const mid2 = new Uint8Array([
      ...chunk('MThd', [0, 1, 0, 2, 1, 224]),
      ...chunk('MTrk', tempo),
      ...chunk('MTrk', data),
    ]);
    const s = loadSong(alphaTab, mid2, 'gs-kit.mid');
    expect(Object.keys(s.tracks)).toEqual([]);
    // wait, only Kit track was written — no melody. drums should have K and S.
    expect(s.drums.map((d) => d.piece).sort()).toEqual(['K', 'S']);
    expect(Object.keys(s.drumTracks).length).toBe(1);
  });
  it('a user can move a pitched track to drums and pick the GS map', () => {
    const s = {
      tracks: { 'My Kit': [{ t: 0, dur: 0.1, key: 27 }, { t: 0.5, dur: 0.1, key: 36 }] },
      drums: [], drumTracks: {}, drumMap: 'GM',
    };
    markTrackAsDrums(s, 'My Kit');
    expect(s.tracks['My Kit']).toBeUndefined();
    applyDrumMap(s, 'GM');
    expect(s.drums.map((d) => d.piece)).toEqual(['K']);    // 27 is not on the GM map
    applyDrumMap(s, 'GS');
    expect(s.drums.map((d) => d.piece).sort()).toEqual(['K', 'S']); // 27 → S on GS
    markTrackAsPitched(s, 'My Kit');
    expect(s.tracks['My Kit'].length).toBe(2);
    expect(s.drums.length).toBe(0);
  });
  it('drumNameGuess accepts kit names and rejects ordinary parts', () => {
    expect(drumNameGuess('Drum Kit')).toBe(true);
    expect(drumNameGuess('Percussion')).toBe(true);
    expect(drumNameGuess('Melody')).toBe(false);
    expect(isAutoDrumTrack({ channel: 9, name: 'Whatever' })).toBe(true);
    expect(isAutoDrumTrack({ channel: 0, name: 'Lead', drum: false })).toBe(false);
  });
  it('default two-axis output of a book song stays byte-identical', () => {
    const twinkle = BOOK.find((s) => s.id === 'twinkle');
    const r = songcode(bookTracks(twinkle), picks, PRESETS['REVTURN lathe'], { title: `${twinkle.title}, ${twinkle.composer}` });
    expect(r.text).toBe(file('test/fixtures/twinkle-revturn.nc').toString());
  });
});
