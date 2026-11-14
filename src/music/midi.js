// SPDX-License-Identifier: GPL-3.0-or-later
// SONGCODE / REVTURN by JMSCNC, Copyright (C) 2026 Rev. J. Money / JMSCNC (jmscnc.com).
// Licensed GPL-3.0-or-later; keep this attribution (GPLv3 section 7(b), see NOTICE.md).
//
// Standard MIDI File reader (format 0 and 1): tracks, names, channels, notes in seconds (tempo changes applied).
// No libraries. Returns { format, ppq, tracks: [{ name, channel, notes: [{ t, dur, key, vel, ch }] }], length }.

const str = (b, i, n) => String.fromCharCode(...b.subarray(i, i + n));

export function parseMidi(input) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (b.length < 14 || str(b, 0, 4) !== 'MThd') throw new Error('not a MIDI file');
  const u16 = (i) => (b[i] << 8) | b[i + 1];
  const u32 = (i) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
  const hlen = u32(4), format = u16(8), ntr = u16(10), div = u16(12);
  if (div & 0x8000) throw new Error('SMPTE-timed MIDI files are not supported');
  const ppq = div;
  let p = 8 + hlen;
  const raw = [];                                        // per track: events with absolute ticks
  const tempos = [];                                      // [tick, usPerQuarter]
  for (let tr = 0; tr < ntr && p + 8 <= b.length; tr++) {
    if (str(b, p, 4) !== 'MTrk') { p += 8 + u32(p + 4); tr--; if (p >= b.length) break; continue; }
    const end = Math.min(b.length, p + 8 + u32(p + 4));
    let i = p + 8, tick = 0, status = 0;
    const ev = { name: '', events: [] };
    const vlq = () => { let v = 0, c; do { c = b[i++]; v = (v << 7) | (c & 0x7f); } while (c & 0x80 && i < end); return v; };
    while (i < end) {
      tick += vlq();
      let s = b[i];
      if (s & 0x80) { i++; if (s < 0xf0) status = s; } else s = status;   // running status
      if (s === 0xff) {
        const type = b[i++], len = vlq();
        if (type === 0x51 && len === 3) tempos.push([tick, (b[i] << 16) | (b[i + 1] << 8) | b[i + 2]]);
        if ((type === 0x03 || type === 0x04) && !ev.name) ev.name = str(b, i, len).trim();
        if (type === 0x2f) { i += len; break; }
        i += len;
      } else if (s === 0xf0 || s === 0xf7) { i += vlq(); }
      else {
        const hi = s & 0xf0, ch = s & 0x0f;
        const d1 = b[i++], d2 = hi === 0xc0 || hi === 0xd0 ? 0 : b[i++];
        if (hi === 0x90 || hi === 0x80) ev.events.push({ tick, on: hi === 0x90 && d2 > 0, key: d1, vel: d2, ch });
        else if (hi === 0xe0) ev.events.push({ tick, bend: true, ch, value: d1 | (d2 << 7) });
        else if (hi === 0xb0) ev.events.push({ tick, cc: true, ch, num: d1, value: d2 });
      }
    }
    raw.push(ev);
    p = end;
  }
  // tick -> seconds through the tempo map (default 120 bpm)
  tempos.sort((x, y) => x[0] - y[0]);
  const map = [[0, 0, 500000]];                           // [tick, seconds at tick, us per quarter]
  for (const [tk, us] of tempos) {
    const [t0, s0, u0] = map[map.length - 1];
    const sec = s0 + ((tk - t0) * u0) / ppq / 1e6;
    if (tk === t0) map[map.length - 1] = [tk, s0, us]; else map.push([tk, sec, us]);
  }
  const toSec = (tk) => {
    let k = map.length - 1; while (k > 0 && map[k][0] > tk) k--;
    const [t0, s0, u0] = map[k];
    return s0 + ((tk - t0) * u0) / ppq / 1e6;
  };
  const tracks = [];
  let length = 0;
  for (const tr of raw) {
    const open = new Map(), notes = [];
    for (const e of tr.events) {
      if (e.bend || e.cc) continue;
      const id = `${e.ch}:${e.key}`;
      if (e.on) {
        if (open.has(id)) close(open.get(id), e.tick);      // a re-strike closes the old note
        open.set(id, { tick: e.tick, key: e.key, vel: e.vel, ch: e.ch });
      } else if (open.has(id)) { close(open.get(id), e.tick); open.delete(id); }
    }
    for (const o of open.values()) close(o, o.tick + ppq);  // a note never released: one beat
    function close(o, tk) { const t = toSec(o.tick); notes.push({ t, dur: Math.max(0.01, toSec(tk) - t), key: o.key, vel: o.vel, ch: o.ch }); }
    notes.sort((x, y) => x.t - y.t || y.key - x.key);
    if (!notes.length) continue;
    const chs = new Set(notes.map((n) => n.ch));
    for (const ch of chs) {                                 // split multi-channel tracks (format 0) per channel
      const ns = notes.filter((n) => n.ch === ch);
      tracks.push({ name: tr.name || `channel ${ch + 1}`, channel: ch, notes: ns });
      length = Math.max(length, ...ns.map((n) => n.t + n.dur));
    }
  }
  applyMidiExpression(tracks, raw, toSec);
  return { format, ppq, tracks, length, bpm: Math.round(60e6 / (tempos[0]?.[1] ?? 500000)) };
}

// Pitch-bend sensitivity (RPN 0,0) defaults to 2 semitones. A bend or a portamento (CC 65)
// into the next note is marked `slide` so expandSlides can write a feed-rate ramp.
export function applyMidiExpression(tracks, raw, toSec) {
  const byCh = new Map();
  const add = (ch, rec) => { if (!byCh.has(ch)) byCh.set(ch, []); byCh.get(ch).push(rec); };
  for (const tr of raw) {
    let rpnMsb = 127, rpnLsb = 127, range = 2, porta = false;
    const evs = [...(tr.events ?? [])].sort((a, b) => a.tick - b.tick);
    for (const e of evs) {
      if (e.cc) {
        if (e.num === 101) rpnMsb = e.value;
        else if (e.num === 100) rpnLsb = e.value;
        else if ((e.num === 6 || e.num === 36) && rpnMsb === 0 && rpnLsb === 0) {
          if (e.num === 6) range = Math.max(1, e.value);
        } else if (e.num === 65) porta = e.value >= 64;
        add(e.ch, { tick: e.tick, t: toSec(e.tick), porta, range });
      } else if (e.bend) {
        add(e.ch, { tick: e.tick, t: toSec(e.tick), bend: e.value, range, porta });
      }
    }
  }
  const at = (list, t, key, def) => {
    let v = def;
    for (const e of list ?? []) { if (e.t > t + 1e-9) break; if (e[key] != null) v = e[key]; }
    return v;
  };
  const stOf = (value, range) => ((value - 8192) / 8192) * (range || 2);
  for (const tr of tracks) {
    const hist = (byCh.get(tr.channel) ?? []);
    hist.sort((a, b) => a.t - b.t);
    const notes = tr.notes;
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i], end = n.t + n.dur;
      const range = at(hist, n.t, 'range', 2);
      const startSt = stOf(at(hist, n.t, 'bend', 8192), range);
      let peakSt = 0;
      for (const e of hist) {
        if (e.t < n.t - 1e-9) continue;
        if (e.t > end + 1e-9) break;
        if (e.bend == null) continue;
        const st = stOf(e.bend, e.range ?? range);
        if (Math.abs(st) >= Math.abs(peakSt)) peakSt = st;
      }
      if (Math.abs(peakSt - startSt) >= 0.4 || Math.abs(peakSt) >= 0.4) {
        n.slide = true;
        n.slideTo = Math.round(n.key + peakSt);
      }
      const porta = at(hist, n.t + n.dur * 0.5, 'porta', false) || at(hist, n.t, 'porta', false);
      const next = notes.slice(i + 1).find((x) => x.t >= n.t - 1e-6 && x !== n);
      if (porta && next && next.t - end < 0.08 && next.key !== n.key) n.slide = true;
    }
  }
}

// Tiny writer, used by the tests and to make demo files: tracks = [{ name, ch, notes: [{ t (beats), dur (beats), key, vel }] }]
export function writeMidi(tracks, { bpm = 120, ppq = 480 } = {}) {
  const vlq = (v) => { const out = [v & 0x7f]; while ((v >>= 7)) out.unshift((v & 0x7f) | 0x80); return out; };
  const chunk = (id, data) => [...id].map((c) => c.charCodeAt(0)).concat([(data.length >>> 24) & 255, (data.length >> 16) & 255, (data.length >> 8) & 255, data.length & 255], data);
  const us = Math.round(60e6 / bpm);
  const trks = tracks.map((tr, ti) => {
    const ev = [];
    if (ti === 0) ev.push([0, [0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255]]);
    const nm = [...(tr.name ?? '')].map((c) => c.charCodeAt(0) & 0x7f);
    ev.push([0, [0xff, 0x03, nm.length, ...nm]]);
    const ch = tr.ch ?? 0;
    const hasSlide = tr.notes.some((n) => n.slide);
    const range = 24;
    if (hasSlide) {
      ev.push([0, [0xb0 | ch, 101, 0]]); ev.push([0, [0xb0 | ch, 100, 0]]); ev.push([0, [0xb0 | ch, 6, range]]);
    }
    const to14 = (st) => Math.max(0, Math.min(16383, Math.round(8192 + (st / range) * 8192)));
    const bendEv = (beats, value) => {
      const v = to14(value);
      ev.push([Math.round(beats * ppq), [0xe0 | ch, v & 0x7f, (v >> 7) & 0x7f]]);
    };
    for (let i = 0; i < tr.notes.length; i++) {
      const n = tr.notes[i], next = tr.notes[i + 1];
      ev.push([Math.round(n.t * ppq), [0x90 | ch, n.key, n.vel ?? 100]]);
      const dest = next ? next.key : n.slideTo;
      if (n.slide && dest != null && dest !== n.key) {
        const st = dest - n.key;
        const steps = Math.max(3, Math.min(16, Math.round(n.dur * 8)));
        for (let s = 0; s < steps; s++) {
          const frac = s / (steps - 1);
          bendEv(n.t + n.dur * frac * 0.999, st * frac);   // last target sits just before note-off
        }
        bendEv(n.t + n.dur, 0);
      }
      ev.push([Math.round((n.t + n.dur) * ppq), [0x80 | ch, n.key, 0]]);
    }
    ev.sort((a, b) => a[0] - b[0] || (a[1][0] & 0xf0) - (b[1][0] & 0xf0)); // offs (0x80) before ons (0x90) at a tie
    const data = []; let last = 0;
    for (const [tk, bytes] of ev) { data.push(...vlq(tk - last), ...bytes); last = tk; }
    data.push(0, 0xff, 0x2f, 0);
    return chunk('MTrk', data);
  });
  const head = chunk('MThd', [0, 1, 0, trks.length, (ppq >> 8) & 255, ppq & 255]);
  return new Uint8Array([...head, ...trks.flat()]);
}
