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
import { bookMidi, bookAlphaTex, bookTracks } from '../src/music/book.js';
import { loadSong } from '../src/music/load.js';
import { PRESETS, songcode } from '../src/music/arrange.js';

const out = (rel) => fileURLToPath(new URL(`../songs/${rel}`, import.meta.url));
for (const d of ['midi', 'tabs', 'gcode']) mkdirSync(out(d), { recursive: true });
const settings = new alphaTab.Settings();
const GCODE = { revturn: 'REVTURN lathe', 'grbl-xy': 'grbl mill / router (X + Y)' };
const rows = [];
for (const song of BOOK) {
  const mid = bookMidi(song);
  writeFileSync(out(`midi/${song.id}.mid`), mid);
  const imp = new alphaTab.importer.AlphaTexImporter();
  imp.initFromString(bookAlphaTex(song), settings);
  let score;
  try { score = imp.readScore(); } catch (e) { console.error(song.id, JSON.stringify(e.cause?.parserDiagnostics?.items ?? e.cause?.semanticDiagnostics?.items ?? e.message)); process.exit(1); }
  const gp = new alphaTab.exporter.Gp7Exporter().export(score, settings);
  writeFileSync(out(`tabs/${song.id}.gp`), gp);
  // check: the tab, read back the way the page reads it, has the same notes as the book (keys and times)
  const want = bookTracks(song), got = loadSong(alphaTab, gp, `${song.id}.gp`).tracks;
  const off = (got.Melody?.[0]?.t ?? 0) - want.Melody[0].t;          // the tab starts with a pickup rest
  for (const name of ['Melody', 'Bass']) {
    const a = want[name], b = got[name] ?? [];
    const bad = a.length !== b.length || a.some((n, i) => n.key !== b[i].key || Math.abs(n.t + off - b[i].t) > 0.03 + 0.012 * n.t);
    if (bad) { console.error(`${song.id} ${name}: tab differs (book ${a.length} notes, tab ${b.length})`, a.slice(0, 3), b.slice(0, 3)); process.exit(1); }
  }
  for (const [tag, preset] of Object.entries(GCODE)) {
    const r = songcode(want, { lead: 'Melody', bass: 'Bass', fill: null }, PRESETS[preset], { title: `${song.title}, ${song.composer}` });
    writeFileSync(out(`gcode/${song.id}-${tag}.nc`), r.text);
    if (tag === 'revturn') rows.push(`| ${song.title} | ${song.composer} | ${Math.round(r.seconds)} s |`);
  }
  console.log(`${song.id}: midi ${mid.length} B, tab ${gp.length} B, ${want.Melody.length} + ${want.Bass.length} notes`);
}
console.log(rows.join('\n'));
