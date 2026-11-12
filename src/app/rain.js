// SPDX-License-Identifier: GPL-3.0-or-later
// SONGCODE by JMSCNC, Copyright (C) 2026 Rev. J. Money / JMSCNC (jmscnc.com).
// Licensed GPL-3.0-or-later; keep this attribution (GPLv3 section 7(b), see NOTICE.md).
//
// Background: music notes falling like matrix rain (Rev 2026-11-12). A fixed canvas behind the page; each column
// drops a bright head note that leaves a fading green trail. Pauses when the tab is hidden; people who ask their
// system for reduced motion get one still frame.
const GLYPHS = ['♪', '♫', '♩', '♬', '♭', '♯', '𝄞', '𝄢', '♮'];

export function startRain() {
  const c = document.createElement('canvas');
  c.id = 'rain'; c.setAttribute('aria-hidden', 'true');
  document.body.prepend(c);
  const g = c.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const size = 20;
  let w = 0, h = 0, cols = [];
  const resize = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    w = innerWidth; h = innerHeight;
    c.width = w * dpr; c.height = h * dpr; c.style.width = `${w}px`; c.style.height = `${h}px`;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.ceil(w / size);
    cols = Array.from({ length: n }, (_, i) => cols[i] ?? { y: Math.random() * h, v: 0.6 + Math.random() * 1.4 });
    g.fillStyle = '#0b1016'; g.fillRect(0, 0, w, h);
  };
  resize();
  addEventListener('resize', resize);
  g.textAlign = 'center';
  const frame = () => {
    g.fillStyle = 'rgba(11, 16, 22, 0.06)';                 // fade the trails
    g.fillRect(0, 0, w, h);
    g.font = `${size - 2}px "Segoe UI Symbol", "Noto Music", "DejaVu Sans", serif`;
    cols.forEach((col, i) => {
      const glyph = GLYPHS[(Math.random() * GLYPHS.length) | 0];
      const x = i * size + size / 2;
      g.fillStyle = Math.random() < 0.08 ? '#ffb347' : 'rgba(127, 255, 176, 0.85)';
      g.fillText(glyph, x, col.y);
      col.y += size * col.v * 0.5;
      if (col.y > h + size && Math.random() > 0.9) { col.y = -size * (1 + Math.random() * 4); col.v = 0.6 + Math.random() * 1.4; }
    });
  };
  if (still) { for (let k = 0; k < 120; k++) frame(); return; }
  let last = 0, raf = 0;
  const loop = (t) => { raf = requestAnimationFrame(loop); if (t - last < 50) return; last = t; frame(); };   // about 20 fps
  raf = requestAnimationFrame(loop);
  document.addEventListener('visibilitychange', () => { cancelAnimationFrame(raf); if (!document.hidden) raf = requestAnimationFrame(loop); });
}
