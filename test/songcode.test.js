// SPDX-License-Identifier: GPL-3.0-or-later
// SONGCODE by JMSCNC, Copyright (C) 2026 Rev. J. Money / JMSCNC (jmscnc.com).
// Licensed GPL-3.0-or-later; keep this attribution (GPLv3 section 7(b), see NOTICE.md).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as alphaTab from '@coderline/alphatab';
import { BOOK } from '../songs/book.js';
import { bookTracks, bookMidi } from '../src/music/book.js';
import { loadSong } from '../src/music/load.js';
import { PRESETS, songcode, arrange, autoPick, frame } from '../src/music/arrange.js';

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
