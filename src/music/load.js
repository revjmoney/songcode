// SPDX-License-Identifier: GPL-3.0-or-later
// SONGCODE by JMSCNC, Copyright (C) 2026 Rev. J. Money / JMSCNC (jmscnc.com).
// Licensed GPL-3.0-or-later; keep this attribution (GPLv3 section 7(b), see NOTICE.md).
//
// Open a song file: Guitar Pro (.gp3 .gp4 .gp5 .gpx .gp, read by alphaTab, MPL-2.0) or MIDI (.mid .midi, our own
// reader). Guitar Pro goes through alphaTab's MIDI generator, so both kinds come out the same way, with repeats
// played out and tempo changes applied. Returns { title, artist, kind, tracks: { name: [{ t, dur, key }] }, length }
// Melodic tracks go in `tracks`. GM drum notes (channel 10 / percussion staves) go in `drums`
// as { t, dur, key, piece } and are left out of the default two-axis conversion.
import { parseMidi } from './midi.js';
import { gmDrum } from './voices.js';

const uniq = (out, name) => { let n = String(name || '').trim() || 'Track'; while (n in out) n += "'"; return n; };

export function fromMidiBytes(bytes, title = '') {
  const m = parseMidi(bytes);
  const tracks = {}, drums = [];
  for (const tr of m.tracks) {
    if (tr.channel === 9) {                                          // General MIDI drums
      for (const n of tr.notes) {
        const piece = gmDrum(n.key);
        if (piece) drums.push({ t: n.t, dur: n.dur, key: n.key, piece });
      }
      continue;
    }
    tracks[uniq(tracks, tr.name)] = tr.notes.map(({ t, dur, key }) => ({ t, dur, key }));
  }
  return { title, artist: '', kind: 'MIDI', tracks, drums, length: m.length, bpm: m.bpm };
}

// alphaTab is passed in (the page bundles it; tests import it), so this file has no hard dependency on it
export function fromGuitarPro(alphaTab, bytes) {
  const settings = new alphaTab.Settings();
  const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(bytes), settings);
  const midi = new alphaTab.midi.MidiFile();
  midi.format = alphaTab.midi.MidiFileFormat.MultiTrack;
  new alphaTab.midi.MidiFileGenerator(score, settings, new alphaTab.midi.AlphaSynthMidiFileHandler(midi, true)).generate();
  const m = parseMidi(midi.toBinary());
  const tracks = {}, drums = [];
  for (const st of score.tracks) {
    const chs = new Set([st.playbackInfo.primaryChannel, st.playbackInfo.secondaryChannel]);
    const notes = m.tracks.filter((t) => chs.has(t.channel)).flatMap((t) => t.notes)
      .sort((a, b) => a.t - b.t || b.key - a.key);
    if (st.isPercussion) {
      for (const n of notes) {
        const piece = gmDrum(n.key);
        if (piece) drums.push({ t: n.t, dur: n.dur, key: n.key, piece });
      }
      continue;
    }
    const pitched = notes.map(({ t, dur, key }) => ({ t, dur, key }));
    if (pitched.length) tracks[uniq(tracks, st.name || `Track ${st.index + 1}`)] = pitched;
  }
  return { title: score.title || '', artist: score.artist || '', kind: 'Guitar Pro', tracks, drums, length: m.length, bpm: score.tempo };
}

export function loadSong(alphaTab, bytes, fileName = '') {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const base = fileName.replace(/\.[^.]+$/, '');
  if (b.length >= 4 && String.fromCharCode(b[0], b[1], b[2], b[3]) === 'MThd') return fromMidiBytes(b, base);
  const s = fromGuitarPro(alphaTab, b);
  if (!s.title) s.title = base;
  return s;
}
