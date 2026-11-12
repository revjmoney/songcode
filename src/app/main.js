// SPDX-License-Identifier: GPL-3.0-or-later
// SONGCODE by JMSCNC, Copyright (C) 2026 Rev. J. Money / JMSCNC (jmscnc.com).
// Licensed GPL-3.0-or-later; keep this attribution (GPLv3 section 7(b), see NOTICE.md).
//
// The SONGCODE page: open a tab or MIDI file, pick the parts, set up the machine, download the g-code.
// Everything runs in the browser; nothing is uploaded anywhere.
import * as alphaTab from '@coderline/alphatab';
import { loadSong } from '../music/load.js';
import { bookMidi } from '../music/book.js';
import { BOOK } from '../../songs/book.js';
import { noteName } from '../music/voices.js';
import { autoPick, monoOf, PRESETS, songcode } from '../music/arrange.js';

const $ = (id) => document.getElementById(id);
const AXES = ['X', 'Y', 'Z', 'A', 'B', 'C'];
const STORE = 'songcode.machine.v1';
let song = null, roles = { lead: null, fill: null, bass: null }, result = null, player = null;

// ---------- machine form ----------
const presetSel = $('preset');
for (const name of [...Object.keys(PRESETS), 'Custom']) presetSel.add(new Option(name, name));
for (const sel of document.querySelectorAll('.axes select[data-k=axis]')) for (const a of AXES) sel.add(new Option(a, a));

function setProfile(p) {
  $('flavor').value = p.flavor; $('units').value = p.units;
  $('diameter').checked = !!p.diameter; $('g7').checked = !!p.g7; $('numbers').checked = p.numbers !== false;
  $('start').value = p.start ?? ''; $('end').value = p.end ?? '';
  for (const v of ['a', 'b']) for (const el of document.querySelectorAll(`.axes tr[data-v=${v}] [data-k]`)) el.value = p[v][el.dataset.k];
  $('presetnote').textContent = p.note ?? '';
  unitLabel();
}
function getProfile() {
  const ax = (v) => Object.fromEntries([...document.querySelectorAll(`.axes tr[data-v=${v}] [data-k]`)].map((el) => [el.dataset.k, el.dataset.k === 'axis' ? el.value : Number(el.value)]));
  const base = PRESETS[presetSel.value] ?? {};
  return {
    flavor: $('flavor').value, units: $('units').value, diameter: $('diameter').checked, g7: $('g7').checked, numbers: $('numbers').checked,
    a: ax('a'), b: ax('b'), start: $('start').value, end: $('end').value, tag: base.tag,
  };
}
const unitLabel = () => { for (const el of document.querySelectorAll('.u')) el.textContent = $('units').value === 'in' ? 'in' : 'mm'; };
function saveProfile() { try { localStorage.setItem(STORE, JSON.stringify({ preset: presetSel.value, p: getProfile() })); } catch { /* private mode */ } }
function loadProfile() {
  try { const s = JSON.parse(localStorage.getItem(STORE)); if (s?.p?.a) { presetSel.value = s.preset; setProfile({ ...s.p, note: PRESETS[s.preset]?.note }); return; } } catch { /* none */ }
  presetSel.value = 'grbl mill / router (X + Y)'; setProfile(PRESETS[presetSel.value]);
}
presetSel.addEventListener('change', () => { if (PRESETS[presetSel.value]) setProfile(PRESETS[presetSel.value]); update(); });
$('machine').addEventListener('input', (e) => { if (e.target !== presetSel) { if (presetSel.value !== 'Custom') presetSel.value = 'Custom'; $('presetnote').textContent = ''; } unitLabel(); update(); });

// ---------- opening songs ----------
function open(bytes, name) {
  stop();
  try {
    song = loadSong(alphaTab, bytes, name);
    if (!Object.keys(song.tracks).length) throw new Error('no notes found (only drums?)');
  } catch (e) {
    song = null;
    $('songinfo').className = 'info err'; $('songinfo').textContent = `Could not read ${name}: ${e.message ?? e}`;
    for (const id of ['tracks', 'section', 'result']) $(id).hidden = true;
    return;
  }
  const picks = autoPick(song.tracks);
  roles = { lead: picks.lead, fill: picks.fill, bass: picks.bass };
  $('songinfo').className = 'info';
  $('songinfo').textContent = `${song.title || name}${song.artist ? ', ' + song.artist : ''}  ·  ${song.kind}  ·  ${Object.keys(song.tracks).length} parts  ·  ${fmtS(song.length)}`;
  // default section: 8 s before the melody starts, about a minute
  const first = song.tracks[roles.lead]?.[0]?.t ?? 0;
  $('from').value = Math.max(0, Math.floor(first - 8)); $('to').value = Math.min(Math.ceil(song.length), Number($('from').value) + 60);
  $('repeat').value = 1; $('transpose').value = 0;
  $('songlen').textContent = `The whole song is ${fmtS(song.length)} long. Longer sections make bigger files.`;
  drawTracks();
  for (const id of ['tracks', 'section', 'result']) $(id).hidden = false;
  update();
}
$('file').addEventListener('change', async (e) => { const f = e.target.files[0]; $('book').value = ''; if (f) open(new Uint8Array(await f.arrayBuffer()), f.name); });
const drop = $('drop');
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', async (e) => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; $('book').value = ''; if (f) open(new Uint8Array(await f.arrayBuffer()), f.name); });

// the free song book (public domain, arranged by JMSCNC): built into the page, opened as MIDI like any other file
for (const s of BOOK) $('book').add(new Option(`${s.title} (${s.composer})`, s.id));
$('book').addEventListener('change', () => {
  const s = BOOK.find((x) => x.id === $('book').value);
  if (!s) return;
  open(bookMidi(s), `${s.title}.mid`);
  song.artist = s.composer;
  $('songinfo').textContent = `${s.title}, ${s.composer}  ·  SONGCODE book  ·  2 parts  ·  ${fmtS(song.length)}`;
  $('from').value = 0; $('to').value = Math.ceil(song.length) + 1;
  update();
});

// ---------- tracks ----------
function drawTracks() {
  const rows = Object.entries(song.tracks).map(([name, ns]) => {
    const keys = ns.map((n) => n.key), lo = Math.min(...keys), hi = Math.max(...keys);
    const b = (r, label, cls) => `<button type="button" class="${cls}${roles[r] === name ? ' on' : ''}" data-r="${r}" data-t="${esc(name)}">${label}</button>`;
    return `<tr><td class="name">${esc(name)}</td><td>${ns.length}</td><td>${noteName(lo)} to ${noteName(hi)}</td><td>${Math.round(monoOf(ns) * 100)}%</td>
      <td class="roles">${b('lead', 'MELODY', 'mel')} ${b('fill', 'FILL', 'fill')} ${b('bass', 'BASS', 'bass')}</td></tr>`;
  });
  $('tracktable').innerHTML = `<thead><tr><th>Part</th><th>Notes</th><th>Range</th><th>Single notes</th><th>Use as</th></tr></thead><tbody>${rows.join('')}</tbody>`;
}
$('tracktable').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-r]'); if (!b) return;
  const r = b.dataset.r, t = b.dataset.t;
  roles[r] = roles[r] === t ? null : t;
  for (const k of Object.keys(roles)) if (k !== r && roles[k] === t) roles[k] = null;  // one job per part
  drawTracks(); update();
});

// ---------- build ----------
let timer = 0;
function update() { clearTimeout(timer); timer = setTimeout(rebuild, 120); saveProfile(); }
$('section').addEventListener('input', update);

function rebuild() {
  if (!song) return;
  stop();
  const n = (id, d) => { const v = Number($(id).value); return Number.isFinite(v) ? v : d; };
  const picks = { ...roles, from: n('from', 0), to: Math.max(n('to', 60), n('from', 0) + 1), repeat: Math.max(1, Math.round(n('repeat', 1))), gap: n('gap', 0.6) };
  const title = `${song.title || 'song'}${song.artist ? ', ' + song.artist : ''}`;
  const p = getProfile();
  const bad = ['a', 'b'].flatMap((v) => ['steps', 'micro', 'max', 'accel', 'box'].filter((k) => !(p[v][k] > 0)).map((k) => `${v === 'a' ? 'melody' : 'bass'} ${k}`));
  if (bad.length) { $('warn').textContent = `Fill in the machine numbers: ${bad.join(', ')}`; return; }
  if (p.a.axis === p.b.axis) { $('warn').textContent = 'The melody and bass motors need different axes.'; return; }
  result = songcode(song.tracks, picks, p, { title, tempo: n('tempo', 100) / 100, transpose: Math.round(n('transpose', 0)) });
  const u = p.units === 'in' ? 'in' : 'mm', dec = u === 'in' ? 3 : 1;
  const kb = new Blob([result.text]).size / 1024;
  $('stats').innerHTML = [
    [fmtS(result.seconds), 'playing time'], [result.high.length, 'melody notes'], [result.low.length, 'bass notes'],
    [result.lines.length, 'lines'], [`${kb.toFixed(1)} KB`, 'file size'],
    [`±${result.travel.maxX.toFixed(dec)} ${u}`, `${p.a.axis} travel`], [`±${result.travel.maxZ.toFixed(dec)} ${u}`, `${p.b.axis} travel`],
  ].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
  const w = [...result.warnings];
  if (!roles.lead && !roles.bass) w.unshift('Pick a MELODY or BASS part.');
  if (result.folded.a) w.push(`${result.folded.a} melody notes were moved by an octave to fit the ${p.a.axis} motor.`);
  if (result.folded.b) w.push(`${result.folded.b} bass notes were moved by an octave to fit the ${p.b.axis} motor.`);
  if (result.shift.a) w.push(`Melody shifted ${result.shift.a > 0 ? 'up' : 'down'} ${Math.abs(result.shift.a / 12)} octave(s) to suit the ${p.a.axis} motor.`);
  if (result.shift.b) w.push(`Bass shifted ${result.shift.b > 0 ? 'up' : 'down'} ${Math.abs(result.shift.b / 12)} octave(s) to suit the ${p.b.axis} motor.`);
  $('warn').innerHTML = w.map((x) => `<div>${esc(x)}</div>`).join('');
  const shown = result.lines.length > 400 ? [...result.lines.slice(0, 400), `... ${result.lines.length - 400} more lines in the download`] : result.lines;
  $('code').textContent = shown.join('\n');
  plot();
}

function plot() {
  const c = $('plot'), g = c.getContext('2d'), W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  const all = [...result.high, ...result.low];
  if (!all.length) return;
  const t1 = Math.max(...all.map((n) => n.t + n.dur)), k0 = Math.min(...all.map((n) => n.key)) - 2, k1 = Math.max(...all.map((n) => n.key)) + 2;
  const x = (t) => 40 + ((W - 50) * t) / t1, y = (k) => H - 20 - ((H - 30) * (k - k0)) / (k1 - k0);
  g.strokeStyle = '#1b2733'; g.fillStyle = '#5d7385'; g.font = '11px Consolas, monospace';
  for (let k = Math.ceil(k0 / 12) * 12; k <= k1; k += 12) { g.beginPath(); g.moveTo(40, y(k)); g.lineTo(W - 10, y(k)); g.stroke(); g.fillText(noteName(k), 4, y(k) + 4); }
  for (let s = 0; s <= t1; s += t1 > 120 ? 30 : 10) g.fillText(`${s}s`, x(s) - 8, H - 4);
  const draw = (ns, col) => { g.fillStyle = col; for (const n of ns) g.fillRect(x(n.t), y(n.key) - 2, Math.max(1.5, x(n.t + n.dur) - x(n.t) - 1), 4); };
  draw(result.low, '#ffb347'); draw(result.high, '#7fffb0');
}

// ---------- listen: square waves at the machine's own pitches ----------
function stop() {
  if (player) { try { player.ctx.close(); } catch { /* closed */ } player = null; }
  $('listen').classList.remove('on'); $('listen').textContent = '▶ LISTEN';
}
$('listen').addEventListener('click', () => {
  if (player) return stop();
  if (!result) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const tempo = (Number($('tempo').value) || 100) / 100, t0 = ctx.currentTime + 0.15;
  const voice = (ns, vol) => {
    const o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = 'square'; gn.gain.value = 0; o.connect(gn).connect(ctx.destination);
    for (const n of ns) {
      const a = t0 + n.t / tempo, b = t0 + (n.t + n.dur) / tempo;
      o.frequency.setValueAtTime(n.hz, a); gn.gain.setValueAtTime(vol, a); gn.gain.setValueAtTime(0, Math.max(a + 0.01, b - 0.005));
    }
    o.start(t0); return o;
  };
  voice(result.high, 0.05); voice(result.low, 0.06);
  player = { ctx };
  $('listen').classList.add('on'); $('listen').textContent = '■ STOP';
  const end = Math.max(0, ...[...result.high, ...result.low].map((n) => (n.t + n.dur) / tempo));
  const me = player; setTimeout(() => { if (player === me) stop(); }, (end + 0.5) * 1000);
});

// ---------- save ----------
const fileName = () => `${(song?.title || 'song').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'song'}.nc`;
$('download').addEventListener('click', () => {
  if (!result) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([result.text], { type: 'text/plain' }));
  a.download = fileName(); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
$('copy').addEventListener('click', async () => {
  if (!result) return;
  try { await navigator.clipboard.writeText(result.text); $('copy').textContent = 'COPIED'; } catch { $('copy').textContent = 'COPY FAILED'; }
  setTimeout(() => { $('copy').textContent = 'COPY'; }, 1500);
});

function fmtS(s) { const m = Math.floor(s / 60), r = Math.round(s % 60); return m ? `${m}:${String(r).padStart(2, '0')}` : `${Math.round(s)} s`; }
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

loadProfile();
