// SPDX-License-Identifier: GPL-3.0-or-later
// SONGCODE by JMSCNC, Copyright (C) 2026 Rev. J. Money / JMSCNC (jmscnc.com).
// Licensed GPL-3.0-or-later; keep this attribution (GPLv3 section 7(b), see NOTICE.md).
//
// Bundle the page into one self-contained file: dist/index.html (no server needed: open it from disk or host it on
// GitHub Pages). alphaTab's importer is bundled in; its renderer, fonts, sound font and workers are not used.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const p = (rel) => fileURLToPath(new URL(rel, root));
const js = await build({
  entryPoints: [p('src/app/main.js')], bundle: true, minify: true, format: 'iife', target: ['es2020'], write: false,
  legalComments: 'inline', logLevel: 'warning',
});
const script = js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = await readFile(p('src/app/style.css'), 'utf8');
let html = await readFile(p('src/app/index.html'), 'utf8');
html = html
  .replace('<link rel="stylesheet" href="style.css">', () => `<style>${css}</style>`)
  .replace('<script type="module" src="main.js"></script>', () => `<script>${script}</script>`);
for (const img of ['brand/monkey-320.png', 'brand/monkey-64.png']) {
  const b64 = (await readFile(p(`src/app/${img}`))).toString('base64');
  html = html.replaceAll(`"${img}"`, `"data:image/png;base64,${b64}"`);
}
if (html.includes('src="main.js"') || html.includes('href="style.css"')) throw new Error('inlining failed');
await mkdir(p('dist'), { recursive: true });
await writeFile(p('dist/index.html'), html);
console.log(`dist/index.html ${(html.length / 1024).toFixed(0)} KB`);
