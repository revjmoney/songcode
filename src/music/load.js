// SPDX-License-Identifier: GPL-3.0-or-later
// SONGCODE by JMSCNC, Copyright (C) 2026 Rev. J. Money / JMSCNC (jmscnc.com).
// Licensed GPL-3.0-or-later; keep this attribution (GPLv3 section 7(b), see NOTICE.md).
//
// Open a song file: Guitar Pro (.gp3 .gp4 .gp5 .gpx .gp, read by alphaTab, MPL-2.0) or MIDI (.mid .midi, our own
// reader). Guitar Pro goes through alphaTab's MIDI generator, so both kinds come out the same way, with repeats
// played out and tempo changes applied. Returns { title, artist, kind, tracks: { name: [{ t, dur, key, slide? }] }, length }
// Melodic tracks go in `tracks`. GM drum notes (channel 10 / percussion staves) go in `drums`
// as { t, dur, key, piece } and are left out of the default two-axis conversion.
//
// Slides: MIDI pitch-bend / portamento become `slide` (and optional `slideTo`) in parseMidi. Guitar Pro slide,
// legato-slide and bend effects are read from the score, then the effects are stripped before MIDI generation so
// destination notes are not absorbed into a bend, and the flags are overlaid back onto the parsed notes.
import { parseMidi } from './midi.js';
import { gmDrum } from './voices.js';

const uniq = (out, name) => { let n = String(name || '').trim() || 'Track'; while (n in out) n += "'"; return n; };

const keepSlide = ({ t, dur, key, slide, slideTo }) => ({
  t, dur, key, ...(slide ? { slide: true } : {}), ...(slideTo != null ? { slideTo } : {}),
});

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
    tracks[uniq(tracks, tr.name)] = tr.notes.map(keepSlide);
  }
  return { title, artist: '', kind: 'MIDI', tracks, drums, length: m.length, bpm: m.bpm };
}

// Walk written notes (ties merged). A slide-out / bend marks this note; a slide-in marks the previous note.
export function scoreSlideFlags(track) {
  const out = [];
  for (const staff of track.staves ?? []) {
    for (const bar of staff.bars ?? []) {
      for (const v of bar.voices ?? []) {
        for (const beat of v.beats ?? []) {
          if (beat.isEmpty || beat.isRest) continue;
          for (const n of beat.notes ?? []) {
            if (n.isTieDestination) continue;
            const key = n.realValue;
            let slide = (n.slideOutType ?? 0) > 0 || (n.bendType ?? 0) > 0;
            let slideTo = n.slideTarget != null ? n.slideTarget.realValue : null;
            if (!slideTo && n.bendPoints?.length) {
              const last = n.bendPoints[n.bendPoints.length - 1];
              const st = (last?.value ?? 0) / 2;                       // alphaTab: 2 = one semitone
              if (Math.abs(st) >= 0.4) { slide = true; slideTo = Math.round(key + st); }
            }
            if ((n.slideInType ?? 0) > 0 && out.length) out[out.length - 1].slide = true;
            out.push({ key, slide, slideTo });
          }
        }
      }
    }
  }
  return out;
}

function stripScoreEffects(score) {
  for (const t of score.tracks ?? []) {
    for (const staff of t.staves ?? []) {
      for (const bar of staff.bars ?? []) {
        for (const v of bar.voices ?? []) {
          for (const beat of v.beats ?? []) {
            for (const n of beat.notes ?? []) {
              n.slideOutType = 0;
              n.slideInType = 0;
              n.slideTarget = null;
              n.slideOrigin = null;
              n.bendType = 0;
              if (n.bendPoints) n.bendPoints = [];
              n.isLegatoOrigin = false;
            }
          }
        }
      }
    }
  }
}

// Overlay written flags onto the MIDI-expanded note list (repeats tile the written sequence).
export function overlaySlideFlags(notes, flags) {
  if (!notes?.length || !flags?.length) return notes;
  const apply = (n, f) => {
    if (f.slide) n.slide = true;
    if (f.slideTo != null) n.slideTo = f.slideTo;
  };
  if (notes.length === flags.length && notes.every((n, i) => n.key === flags[i].key)) {
    notes.forEach((n, i) => apply(n, flags[i]));
    return notes;
  }
  if (flags.length && notes.length % flags.length === 0 &&
      notes.every((n, i) => n.key === flags[i % flags.length].key)) {
    notes.forEach((n, i) => apply(n, flags[i % flags.length]));
    return notes;
  }
  let j = 0;
  for (const n of notes) {
    let found = -1;
    for (let k = 0; k < flags.length; k++) {
      const i = (j + k) % flags.length;
      if (flags[i].key === n.key) { found = i; break; }
    }
    if (found >= 0) { apply(n, flags[found]); j = found + 1; }
  }
  return notes;
}

// alphaTab is passed in (the page bundles it; tests import it), so this file has no hard dependency on it
export function fromGuitarPro(alphaTab, bytes) {
  const settings = new alphaTab.Settings();
  const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(bytes), settings);
  const flagsByTrack = score.tracks.map((st) => st.isPercussion ? [] : scoreSlideFlags(st));
  stripScoreEffects(score);
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
    overlaySlideFlags(notes, flagsByTrack[st.index] ?? []);
    const pitched = notes.map(keepSlide);
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
