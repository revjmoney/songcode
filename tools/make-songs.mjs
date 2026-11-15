// SPDX-License-Identifier: GPL-3.0-or-later
// SONGCODE by JMSCNC, Copyright (C) 2026 Rev. J. Money / JMSCNC (jmscnc.com).
// Licensed GPL-3.0-or-later; keep this attribution (GPLv3 section 7(b), see NOTICE.md).
//
// Writes the free song files from songs/book.js: songs/midi/*.mid, songs/tabs/*.gp (Guitar Pro 7, via alphaTab),
// and ready-to-run g-code in songs/gcode/ for two presets. Each tab is read back and checked against the MIDI.
// Usage: node tools/make-songs.mjs
import * as alphaTab from '@coderline/alphatab';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BOOK } from '../songs/book.js';
import { bookMidi, bookAlphaTex, bookTracks, voiceNotes } from '../src/music/book.js';
import { loadSong } from '../src/music/load.js';
import { PRESETS, songcode } from '../src/music/arrange.js';

const out = (rel) => fileURLToPath(new URL(`../songs/${rel}`, import.meta.url));
for (const d of ['midi', 'tabs', 'gcode']) mkdirSync(out(d), { recursive: true });
const settings = new alphaTab.Settings();
const GCODE = { revturn: 'REVTURN lathe', 'grbl-xy': 'grbl mill / router (X + Y)' };

// Mutate the in-memory score: book `~` notes become a legato slide into the next note.
// alphaTex `{sl}` is not reliable in alphaTab 1.9, so this is applied after the tex import.
// Mutate the in-memory score: book `~` notes become a legato slide into the next note.
// alphaTex `{sl}` is not reliable in alphaTab 1.9, so this is applied after the tex import.
// Shift and legato slides only survive a GP7 clone/finish if both notes sit on the same string
// with non-negative frets, so the pair is moved onto a string that can fret both pitches.
function applyBookSlides(score, song) {
  const SlideOut = (typeof alphaTab.model?.SlideOutType?.Legato === 'number') ? alphaTab.model.SlideOutType.Legato : 2;
  for (const [voice, ti] of [['x', 0], ['z', 1]]) {
    const want = voiceNotes(song, voice);
    const track = score.tracks[ti];
    if (!track) continue;
    const got = [];
    for (const staff of track.staves) for (const bar of staff.bars) for (const v of bar.voices) {
      for (const beat of v.beats) {
        if (beat.isEmpty || beat.isRest) continue;
        for (const n of beat.notes) { if (!n.isTieDestination) got.push(n); }
      }
    }
    const tun = track.staves[0]?.tuning ?? [];
    const openOf = (s) => tun[tun.length - s];
    const n = Math.min(want.length, got.length);
    const place = (lo, hi) => {
      const keys = [];
      for (let i = lo; i <= hi; i++) keys.push(got[i].realValue);
      for (let s = tun.length; s >= 1; s--) {
        const open = openOf(s);
        const frets = keys.map((k) => k - open);
        if (frets.every((f) => f >= 0 && f <= 24)) {
          for (let i = lo; i <= hi; i++) { got[i].string = s; got[i].fret = frets[i - lo]; }
          return true;
        }
      }
      return false;
    };
    let i = 0;
    while (i < n) {
      if (!want[i].slide || !got[i + 1]) { i++; continue; }
      let j = i;
      while (j + 1 < n && want[j].slide) j++;
      place(i, j);
      for (let k = i; k < j; k++) {
        got[k].slideOutType = SlideOut;
        got[k].slideTarget = got[k + 1];
        got[k + 1].slideOrigin = got[k];
      }
      i = j + 1;
    }
  }
}

const rows = [];
for (const song of BOOK) {
  const mid = bookMidi(song);
  writeFileSync(out(`midi/${song.id}.mid`), mid);
  const imp = new alphaTab.importer.AlphaTexImporter();
  imp.initFromString(bookAlphaTex(song), settings);
  let score;
  try { score = imp.readScore(); } catch (e) { console.error(song.id, JSON.stringify(e.cause?.parserDiagnostics?.items ?? e.cause?.semanticDiagnostics?.items ?? e.message)); process.exit(1); }
  applyBookSlides(score, song);
  const gp = new alphaTab.exporter.Gp7Exporter().export(score, settings);
  writeFileSync(out(`tabs/${song.id}.gp`), gp);
  // check: the tab, read back the way the page reads it, has the same notes as the book (keys and times)
  const want = bookTracks(song), got = loadSong(alphaTab, gp, `${song.id}.gp`).tracks;
  const off = (got.Melody?.[0]?.t ?? 0) - want.Melody[0].t;          // the tab starts with a pickup rest
  for (const name of ['Melody', 'Bass']) {
    const a = want[name], b = got[name] ?? [];
    const bad = a.length !== b.length || a.some((n, i) => n.key !== b[i].key || Math.abs(n.t + off - b[i].t) > 0.03 + 0.012 * n.t);
    if (bad) { console.error(`${song.id} ${name}: tab differs (book ${a.length} notes, tab ${b.length})`, a.slice(0, 3), b.slice(0, 3)); process.exit(1); }
    const wantSlides = a.filter((n) => n.slide).length, gotSlides = b.filter((n) => n.slide).length;
    if (wantSlides && gotSlides < wantSlides) { console.error(`${song.id} ${name}: slides lost (book ${wantSlides}, tab ${gotSlides})`); process.exit(1); }
  }
  for (const [tag, preset] of Object.entries(GCODE)) {
    const r = songcode(want, { lead: 'Melody', bass: 'Bass', fill: null }, PRESETS[preset], { title: `${song.title}, ${song.composer}` });
    writeFileSync(out(`gcode/${song.id}-${tag}.nc`), r.text);
    if (tag === 'revturn') rows.push(`| ${song.title} | ${song.composer} | ${Math.round(r.seconds)} s |`);
  }
  console.log(`${song.id}: midi ${mid.length} B, tab ${gp.length} B, ${want.Melody.length} + ${want.Bass.length} notes`);
}
console.log(rows.join('\n'));
