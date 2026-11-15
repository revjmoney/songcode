// SPDX-License-Identifier: GPL-3.0-or-later
// SONGCODE by JMSCNC, Copyright (C) 2026 Rev. J. Money / JMSCNC (jmscnc.com).
// Licensed GPL-3.0-or-later; keep this attribution (GPLv3 section 7(b), see NOTICE.md).
//
// The SONGCODE page: open a tab or MIDI file, pick the parts, set up the machine, download the g-code.
// Everything runs in the browser; nothing is uploaded anywhere.
import * as alphaTab from '@coderline/alphatab';
import { loadSong } from '../music/load.js';
import { bookTracks, bookLength, bookDroneLine } from '../music/book.js';
import { BOOK } from '../../songs/book.js';
import { noteName } from '../music/voices.js';
import { autoPick, monoOf, PRESETS, songcode, isRotaryLetter, downloadText } from '../music/arrange.js';
import { drawPath2D, drawPath3D } from '../music/path.js';
import { scheduleVoice, isPartialWindow, listenEnvelope, missedPitches } from '../music/listen.js';
import { startRain } from './rain.js';

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
  showExtras();
}
function getProfile() {
  const ax = (v) => Object.fromEntries([...document.querySelectorAll(`.axes tr[data-v=${v}] [data-k]`)].map((el) => [el.dataset.k, el.dataset.k === 'axis' ? el.value : Number(el.value)]));
  const base = PRESETS[presetSel.value] ?? {};
  return {
    flavor: $('flavor').value, units: $('units').value, diameter: $('diameter').checked, g7: $('g7').checked, numbers: $('numbers').checked,
    a: ax('a'), b: ax('b'), c: base.c, start: $('start').value, end: $('end').value, tag: base.tag,
  };
}
function unitLabel() {
  const u = $('units').value === 'in' ? 'in' : 'mm';
  for (const el of document.querySelectorAll('.u')) el.textContent = u;
  const rot = !!$('rotary')?.checked;
  const aRot = rot && isRotaryLetter(document.querySelector('.axes tr[data-v=a] [data-k=axis]')?.value);
  const bRot = rot && isRotaryLetter(document.querySelector('.axes tr[data-v=b] [data-k=axis]')?.value);
  const th = document.querySelectorAll('.axes thead th');
  if (th.length >= 7) {
    const both = aRot && bRot, mix = (aRot || bRot) && !both;
    th[2].textContent = both ? 'Steps/deg' : mix ? 'Steps/mm or deg' : 'Steps/mm';
    th[4].textContent = both ? 'Max deg/min' : mix ? 'Max mm or deg/min' : 'Max mm/min';
    th[5].textContent = both ? 'Accel deg/s²' : mix ? 'Accel mm or deg/s²' : 'Accel mm/s²';
    th[6].innerHTML = both ? 'Travel ± deg' : mix ? 'Travel ± mm or deg' : `Travel ± <span class="u">${u}</span>`;
  }
  if ($('rotary-opts')) $('rotary-opts').hidden = !rot;
  if ($('rotary-radius-wrap')) $('rotary-radius-wrap').hidden = !rot || $('rotary-conv').value !== 'radius';
}
function saveProfile() {
  try {
    localStorage.setItem(STORE, JSON.stringify({
      preset: presetSel.value, p: getProfile(),
      rotary: $('rotary').checked, rotaryConv: $('rotary-conv').value, rotaryRadius: $('rotary-radius').value,
    }));
  } catch { /* private mode */ }
}
function loadProfile() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE));
    if (s?.p?.a) {
      presetSel.value = s.preset; setProfile({ ...s.p, note: PRESETS[s.preset]?.note, c: PRESETS[s.preset]?.c });
      if (s.rotary) $('rotary').checked = true;
      if (s.rotaryConv) $('rotary-conv').value = s.rotaryConv;
      if (s.rotaryRadius) $('rotary-radius').value = s.rotaryRadius;
      unitLabel();
      return;
    }
  } catch { /* none */ }
  presetSel.value = 'grbl mill / router (X + Y)'; setProfile(PRESETS[presetSel.value]);
}
presetSel.addEventListener('change', () => { if (PRESETS[presetSel.value]) setProfile(PRESETS[presetSel.value]); update(); });
$('machine').addEventListener('input', (e) => {
  const extra = e.target && ['trio', 'drums', 'cpart', 'rotary', 'rotary-conv', 'rotary-radius', 'path-2d', 'path-3d'].includes(e.target.id);
  if (e.target !== presetSel && !extra) { if (presetSel.value !== 'Custom') presetSel.value = 'Custom'; $('presetnote').textContent = ''; }
  unitLabel(); showExtras(); update();
});

function isRevturn() { return presetSel.value === 'REVTURN lathe'; }
function showExtras() {
  const on = isRevturn();
  $('revturn-extras').hidden = !on;
  $('cpart-wrap').hidden = !on || !$('trio').checked;
  const hasDrums = (song?.drums?.length ?? 0) > 0;
  $('drum-opt').hidden = !on || !hasDrums;
  if (!on) { $('trio').checked = false; $('drums').checked = false; }
  fillCPart();
}
function fillCPart() {
  const sel = $('cpart');
  const keep = sel.value;
  sel.innerHTML = '';
  sel.add(new Option('Choose a part or the book drone…', ''));
  if (song?.drone) sel.add(new Option(`Book drone (${song.drone})`, '__drone__'));
  if (song) for (const name of Object.keys(song.tracks)) sel.add(new Option(name, name));
  if (keep && [...sel.options].some((o) => o.value === keep)) sel.value = keep;
  else if (song?.drone) sel.value = '__drone__';
}

// ---------- opening songs ----------
function setSongInfo() {
  $('songinfo').className = 'info';
  $('songinfo').textContent = `${song.title || 'song'}${song.artist ? ', ' + song.artist : ''}  ·  ${song.kind}  ·  ${Object.keys(song.tracks).length} parts  ·  ${fmtS(song.length)}`;
  $('songlen').textContent = `The whole song is ${fmtS(song.length)} long. Longer sections make bigger files.`;
}

function afterOpen({ full = false } = {}) {
  const picks = autoPick(song.tracks);
  roles = { lead: picks.lead, fill: picks.fill, bass: picks.bass };
  setSongInfo();
  if (full) {
    $('from').value = 0; $('to').value = Math.ceil(song.length) + 1;
  } else {
    const first = song.tracks[roles.lead]?.[0]?.t ?? 0;
    $('from').value = Math.max(0, Math.floor(first - 8)); $('to').value = Math.min(Math.ceil(song.length), Number($('from').value) + 60);
  }
  $('repeat').value = 1; $('transpose').value = 0;
  $('drums').checked = false;
  showExtras();
  drawTracks();
  for (const id of ['tracks', 'section', 'result']) $(id).hidden = false;
  update();
}

function open(bytes, name) {
  stop();
  try {
    song = loadSong(alphaTab, bytes, name);
    if (!Object.keys(song.tracks).length) throw new Error('no notes found (only drums?)');
    song.drums = song.drums ?? [];
  } catch (e) {
    song = null;
    $('songinfo').className = 'info err'; $('songinfo').textContent = `Could not read ${name}: ${e.message ?? e}`;
    for (const id of ['tracks', 'section', 'result']) $(id).hidden = true;
    $('window-notice').hidden = true;
    return;
  }
  afterOpen({ full: false });
}
$('file').addEventListener('change', async (e) => { const f = e.target.files[0]; $('book').value = ''; if (f) open(new Uint8Array(await f.arrayBuffer()), f.name); });
const drop = $('drop');
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', async (e) => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; $('book').value = ''; if (f) open(new Uint8Array(await f.arrayBuffer()), f.name); });

// the free song book: loaded from the arrangements (slides kept), not from the MIDI export
for (const s of BOOK) $('book').add(new Option(`${s.title} (${s.composer})`, s.id));
$('book').addEventListener('change', () => {
  const s = BOOK.find((x) => x.id === $('book').value);
  if (!s) return;
  stop();
  const tracks = bookTracks(s);
  song = { title: s.title, artist: s.composer, kind: 'SONGCODE book', tracks, drums: [], length: bookLength(s), drone: s.drone, book: s };
  afterOpen({ full: true });
  setSongInfo();
});

$('window-full').addEventListener('click', () => {
  if (!song) return;
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
$('trio').addEventListener('change', () => { showExtras(); update(); });
$('cpart').addEventListener('change', update);
$('drums').addEventListener('change', update);

function windowNotice(from, to, length) {
  const el = $('window-notice');
  const partial = isPartialWindow(from, to, length);
  el.hidden = !partial;
  if (!partial) return;
  $('window-range').textContent = `${fmtClock(from)}–${fmtClock(to)}`;
  $('window-total').textContent = fmtS(length);
}

function cLineOf(from, to) {
  if (!$('trio').checked || !isRevturn()) return null;
  const v = $('cpart').value;
  if (v === '__drone__' && song.drone) {
    const line = bookDroneLine(song.book ?? { drone: song.drone }, Math.max(to, song.length));
    return line.map((n) => ({ ...n, t: Math.max(0, n.t - from), dur: Math.min(n.dur, to - from) })).filter((n) => n.dur > 0);
  }
  if (v && song.tracks[v]) return song.tracks[v];
  return null;
}

function rebuild() {
  if (!song) return;
  stop();
  const n = (id, d) => { const v = Number($(id).value); return Number.isFinite(v) ? v : d; };
  const from = n('from', 0), to = Math.max(n('to', 60), from + 1);
  windowNotice(from, to, song.length);
  const picks = { ...roles, from, to, repeat: Math.max(1, Math.round(n('repeat', 1))), gap: n('gap', 0.6) };
  const title = `${song.title || 'song'}${song.artist ? ', ' + song.artist : ''}`;
  const p = getProfile();
  const bad = ['a', 'b'].flatMap((v) => ['steps', 'micro', 'max', 'accel', 'box'].filter((k) => !(p[v][k] > 0)).map((k) => `${v === 'a' ? 'melody' : 'bass'} ${k}`));
  if (bad.length) { $('warn').textContent = `Fill in the machine numbers: ${bad.join(', ')}`; return; }
  if (p.a.axis === p.b.axis) { $('warn').textContent = 'The melody and bass motors need different axes.'; return; }
  const trio = $('trio').checked && isRevturn();
  const drumsOn = $('drums').checked && isRevturn();
  const rotary = $('rotary').checked;
  result = songcode(song.tracks, picks, p, {
    title, tempo: n('tempo', 100) / 100, transpose: Math.round(n('transpose', 0)),
    trio, cLine: cLineOf(from, to), drums: drumsOn ? (song.drums ?? []) : null,
    rotary, rotaryConvention: $('rotary-conv').value, rotaryRadius: n('rotary-radius', p.units === 'in' ? 1 : 25),
  });
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
  if (result.slides) w.push(`${result.slides} slide steps written into the g-code (notes marked ~ glide into the next pitch).`);
  if (result.trio) w.push('Third voice is on C (chuck). Spindle stays off. Start and end moves are still in inches.');
  if (result.usedDrums) w.push('Drums are playing on Z: kicks and snares under the melody. The bass line is left out.');
  if (trio && !result.trio) w.push('Pick a part for C, or a book drone, to write the third voice.');
  if (result.rotary) w.push(`Rotary feed math is on (${$('rotary-conv').value}): A/B/C uses steps/deg and inverse-time or deg/min feed, not linear hypot.`);
  if (result.path?.overtravel?.length) w.push(...result.path.overtravel.map((x) => `Overtravel: ${x}`));
  const m = result.machine;
  if (m) {
    const envX = listenEnvelope(result.high, { hzPerIpm: m.hz.X, accelMmS2: m.acc.X, legato: result.legato });
    const envZ = listenEnvelope(result.low, { hzPerIpm: m.hz.Z, accelMmS2: m.acc.Z, legato: result.legato });
    const missed = missedPitches(envX) + missedPitches(envZ);
    if (missed) w.push(`LISTEN / the machine: ${missed} note(s) are shorter than the accel ramp, so they will not quite reach pitch.`);
  }
  $('warn').innerHTML = w.map((x) => `<div>${esc(x)}</div>`).join('');
  const shown = result.lines.length > 400 ? [...result.lines.slice(0, 400), `... ${result.lines.length - 400} more lines in the download`] : result.lines;
  $('code').textContent = shown.join('\n');
  plot();
  plotPath();
}

function plot() {
  const c = $('plot'), g = c.getContext('2d'), W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  const all = [...result.high, ...result.low, ...(result.c ?? [])];
  if (!all.length) return;
  const t1 = Math.max(...all.map((n) => n.t + n.dur)), k0 = Math.min(...all.map((n) => n.key)) - 2, k1 = Math.max(...all.map((n) => n.key)) + 2;
  const x = (t) => 40 + ((W - 50) * t) / t1, y = (k) => H - 20 - ((H - 30) * (k - k0)) / (k1 - k0);
  g.strokeStyle = '#1b2733'; g.fillStyle = '#5d7385'; g.font = '11px Consolas, monospace';
  for (let k = Math.ceil(k0 / 12) * 12; k <= k1; k += 12) { g.beginPath(); g.moveTo(40, y(k)); g.lineTo(W - 10, y(k)); g.stroke(); g.fillText(noteName(k), 4, y(k) + 4); }
  for (let s = 0; s <= t1; s += t1 > 120 ? 30 : 10) g.fillText(`${s}s`, x(s) - 8, H - 4);
  const draw = (ns, col) => { g.fillStyle = col; for (const n of ns) g.fillRect(x(n.t), y(n.key) - 2, Math.max(1.5, x(n.t + n.dur) - x(n.t) - 1), 4); };
  draw(result.low, '#ffb347'); draw(result.high, '#7fffb0');
  if (result.c?.length) draw(result.c, '#6cc4ff');
}

let pathCam = { yaw: 0.7, pitch: 0.45 };
function plotPath() {
  if (!result?.path) return;
  const c = $('pathplot'), g = c.getContext('2d');
  if ($('path-3d').checked) drawPath3D(g, result.path, { yaw: pathCam.yaw, pitch: pathCam.pitch });
  else drawPath2D(g, result.path);
  const ot = result.path.overtravel ?? [];
  $('path-over').textContent = ot.length ? `Overtravel: ${ot.join('; ')}` : '';
}
$('path-2d').addEventListener('change', plotPath);
$('path-3d').addEventListener('change', plotPath);
(() => {
  const c = $('pathplot');
  let drag = null;
  c.addEventListener('pointerdown', (e) => { if ($('path-3d').checked) { drag = { x: e.clientX, y: e.clientY, yaw: pathCam.yaw, pitch: pathCam.pitch }; c.setPointerCapture(e.pointerId); } });
  c.addEventListener('pointermove', (e) => {
    if (!drag) return;
    pathCam.yaw = drag.yaw + (e.clientX - drag.x) / 80;
    pathCam.pitch = Math.max(-1.2, Math.min(1.2, drag.pitch + (e.clientY - drag.y) / 80));
    plotPath();
  });
  c.addEventListener('pointerup', () => { drag = null; });
})();

// ---------- listen: square waves with each motor's accel ramp ----------
function stop() {
  if (player) { try { player.ctx.close(); } catch { /* closed */ } player = null; }
  $('listen').classList.remove('on'); $('listen').textContent = '▶ LISTEN';
}
$('listen').addEventListener('click', () => {
  if (player) return stop();
  if (!result) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const tempo = (Number($('tempo').value) || 100) / 100, t0 = ctx.currentTime + 0.15;
  const m = result.machine, dest = ctx.destination;
  scheduleVoice(ctx, result.high, dest, { hzPerIpm: m.hz.X, accelMmS2: m.acc.X, legato: result.legato, tempo, t0, vol: 0.05 });
  scheduleVoice(ctx, result.low, dest, { hzPerIpm: m.hz.Z, accelMmS2: m.acc.Z, legato: result.legato, tempo, t0, vol: 0.06 });
  if (result.trio && result.c?.length) {
    scheduleVoice(ctx, result.c, dest, { hzPerIpm: m.hz.C, accelMmS2: m.acc.C, legato: result.legato, tempo, t0, vol: 0.04 });
  }
  player = { ctx };
  $('listen').classList.add('on'); $('listen').textContent = '■ STOP';
  const end = Math.max(0, ...[...result.high, ...result.low, ...(result.c ?? [])].map((n) => (n.t + n.dur) / tempo));
  const me = player; setTimeout(() => { if (player === me) stop(); }, (end + 0.5) * 1000);
});

// ---------- save ----------
const fileName = () => `${(song?.title || 'song').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'song'}.nc`;
$('download').addEventListener('click', () => {
  if (!result) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([downloadText(result)], { type: 'text/plain' }));
  a.download = fileName(); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
$('copy').addEventListener('click', async () => {
  if (!result) return;
  try { await navigator.clipboard.writeText(result.text); $('copy').textContent = 'COPIED'; } catch { $('copy').textContent = 'COPY FAILED'; }
  setTimeout(() => { $('copy').textContent = 'COPY'; }, 1500);
});

function fmtS(s) { const m = Math.floor(s / 60), r = Math.round(s % 60); return m ? `${m}:${String(r).padStart(2, '0')}` : `${Math.round(s)} s`; }
function fmtClock(s) {
  const t = Math.max(0, s), m = Math.floor(t / 60), r = Math.round(t % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

loadProfile();
startRain();
