// SPDX-License-Identifier: GPL-3.0-or-later
// SONGCODE by JMSCNC, Copyright (C) 2026 Rev. J. Money / JMSCNC (jmscnc.com).
// Licensed GPL-3.0-or-later; keep this attribution (GPLv3 section 7(b), see NOTICE.md).
//
// Open a song file: Guitar Pro (.gp3 .gp4 .gp5 .gpx .gp, read by alphaTab, MPL-2.0) or MIDI (.mid .midi, our own
// reader). Guitar Pro goes through alphaTab's MIDI generator, so both kinds come out the same way, with repeats
// played out and tempo changes applied. Returns { title, artist, kind, tracks: { name: [{ t, dur, key }] }, length }
// with drum tracks left out (a coordinated machine cannot hit a drum in the middle of a melody move).
import { parseMidi } from './midi.js';

const uniq = (out, name) => { let n = String(name || '').trim() || 'Track'; while (n in out) n += "'"; return n; };

export function fromMidiBytes(bytes, title = '') {
  const m = parseMidi(bytes);
  const tracks = {};
  for (const tr of m.tracks) {
    if (tr.channel === 9) continue;                                  // General MIDI drums
    tracks[uniq(tracks, tr.name)] = tr.notes.map(({ t, dur, key }) => ({ t, dur, key }));
  }
  return { title, artist: '', kind: 'MIDI', tracks, length: m.length, bpm: m.bpm };
}

// alphaTab is passed in (the page bundles it; tests import it), so this file has no hard dependency on it
export function fromGuitarPro(alphaTab, bytes) {
  const settings = new alphaTab.Settings();
  const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(bytes), settings);
  const midi = new alphaTab.midi.MidiFile();
  midi.format = alphaTab.midi.MidiFileFormat.MultiTrack;
  new alphaTab.midi.MidiFileGenerator(score, settings, new alphaTab.midi.AlphaSynthMidiFileHandler(midi, true)).generate();
  const m = parseMidi(midi.toBinary());
  const tracks = {};
  for (const st of score.tracks) {
    if (st.isPercussion) continue;
    const chs = new Set([st.playbackInfo.primaryChannel, st.playbackInfo.secondaryChannel]);
    const notes = m.tracks.filter((t) => chs.has(t.channel)).flatMap((t) => t.notes).map(({ t, dur, key }) => ({ t, dur, key }))
      .sort((a, b) => a.t - b.t || b.key - a.key);
    if (notes.length) tracks[uniq(tracks, st.name || `Track ${st.index + 1}`)] = notes;
  }
  return { title: score.title || '', artist: score.artist || '', kind: 'Guitar Pro', tracks, length: m.length, bpm: score.tempo };
}

export function loadSong(alphaTab, bytes, fileName = '') {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const base = fileName.replace(/\.[^.]+$/, '');
  if (b.length >= 4 && String.fromCharCode(b[0], b[1], b[2], b[3]) === 'MThd') return fromMidiBytes(b, base);
  const s = fromGuitarPro(alphaTab, b);
  if (!s.title) s.title = base;
  return s;
}
