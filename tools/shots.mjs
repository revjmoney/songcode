// SPDX-License-Identifier: GPL-3.0-or-later
// SONGCODE by JMSCNC, Copyright (C) 2026 Rev. J. Money / JMSCNC (jmscnc.com).
// Licensed GPL-3.0-or-later; keep this attribution (GPLv3 section 7(b), see NOTICE.md).
//
// README screenshots of the built page (dist/index.html served on a local port) via headless Edge or Chrome and the
// Chrome DevTools Protocol. Only public-domain songs from songs/ are opened.
// Usage: node tools/shots.mjs [http://127.0.0.1:8123/] [docs/screenshots]
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://127.0.0.1:8123/';
const outDir = process.argv[3] ?? 'docs/screenshots';
mkdirSync(outDir, { recursive: true });
const browser = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
const port = 9334;
const proc = spawn(browser, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${join(tmpdir(), `songcode-shots-${Date.now()}`)}`, '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch { /* starting */ } }
if (!target) { proc.kill(); throw new Error('browser did not start'); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const cdp = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const js = async (expr) => (await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
const size = (w, h, mobile = false) => cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile });
const save = (name, r) => { writeFileSync(join(outDir, name), Buffer.from(r.result.data, 'base64')); console.log('saved', name); };
const shot = async (name) => save(name, await cdp('Page.captureScreenshot', { format: 'png' }));
// one or more page sections, cropped together
const shotOf = async (name, ...sels) => {
  const box = await js(`(() => { const r = ${JSON.stringify(sels)}.map((s) => document.querySelector(s).getBoundingClientRect());
    const x = Math.min(...r.map((b) => b.left)), y = Math.min(...r.map((b) => b.top)) + scrollY;
    return { x: x - 8, y: y - 8, width: Math.max(...r.map((b) => b.right)) - x + 16, height: Math.max(...r.map((b) => b.bottom)) + scrollY - y + 16 }; })()`);
  save(name, await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...box, scale: 1 } }));
};
const set = (sel, v) => js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.value = ${JSON.stringify(v)}; e.dispatchEvent(new Event('change', { bubbles: true })); e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
const openFile = (path, name) => js(`(() => { const b = Uint8Array.from(atob(${JSON.stringify(readFileSync(path).toString('base64'))}), (c) => c.charCodeAt(0));
  const dt = new DataTransfer(); dt.items.add(new File([b], ${JSON.stringify(name)})); const i = document.getElementById('file'); i.files = dt.files; i.dispatchEvent(new Event('change')); })()`);

await cdp('Page.enable');
await size(1280, 900);
await cdp('Page.navigate', { url });
await sleep(1500);
await js(`localStorage.clear()`); await cdp('Page.reload'); await sleep(1500);
await shot('01-start.png');

await set('#book', 'fur-elise'); await sleep(800);
await shotOf('02-song-book.png', '#open', '#tracks');
await shotOf('03-section-and-machine.png', '#section', '#machine');
await shotOf('04-result-grbl.png', '#result');

await openFile('songs/tabs/greensleeves.gp', 'greensleeves.gp'); await sleep(1500);
await shotOf('05-guitar-pro-tab.png', '#open', '#tracks');

await set('#preset', 'REVTURN lathe'); await sleep(700);
await shotOf('06-revturn-lathe.png', '#machine', '#result');

await set('#preset', '3D printer, Marlin (X + Y)'); await sleep(700);
await shotOf('07-marlin.png', '#result');

await set('#book', 'mountain-king'); await sleep(400);
await set('#preset', 'grbl mill / router (X + Y)'); await sleep(700);
await shotOf('08-mountain-king-plot.png', '#stats', '#plot');

await size(390, 844, true); await cdp('Page.reload'); await sleep(1500);
await set('#book', 'canon-in-d'); await sleep(800);
await shot('09-phone.png');

ws.close(); proc.kill(); process.exit(0);
