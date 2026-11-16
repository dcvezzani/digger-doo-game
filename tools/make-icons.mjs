// Renders the app icons to PNG with the pre-installed Playwright Chromium.
// Usage: npm run icons   (development only; the PNGs are committed)
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const html = (size, maskable) => `<!doctype html><body style="margin:0;background:#000">
<canvas id="c" width="${size}" height="${size}"></canvas>
<script>
const c = document.getElementById('c'), x = c.getContext('2d'), S = ${size}, M = ${maskable};
const k = M ? S / 512 * 0.78 : S / 512;            // maskable keeps a safe zone
const o = (S - 512 * k) / 2;
// earth bands
const bands = ['#2a1f5a', '#e0a458', '#c0703c', '#8c4a2f', '#5e2f3b'];
const ys = [0, 0.3, 0.5, 0.7, 0.86, 1];
for (let i = 0; i < 5; i++) { x.fillStyle = bands[i]; x.fillRect(0, ys[i] * S, S, (ys[i + 1] - ys[i]) * S + 1); }
x.fillStyle = '#4fbf5a'; x.fillRect(0, 0.3 * S - 0.02 * S, S, 0.03 * S);
x.save(); x.translate(o, o); x.scale(k, k);
// tunnel
x.strokeStyle = '#120b16'; x.lineWidth = 120; x.lineCap = 'round'; x.lineJoin = 'round';
x.beginPath(); x.moveTo(256, 120); x.lineTo(256, 300); x.lineTo(440, 300); x.stroke();
// Doo
x.translate(250, 290); x.scale(5.2, 5.2);
x.fillStyle = '#8a5a3c'; x.beginPath(); x.ellipse(0, 3, 12, 11, 0, 0, 7); x.fill();
x.fillStyle = '#c99a72'; x.beginPath(); x.ellipse(2, 6, 7, 6, 0, 0, 7); x.fill();
x.fillStyle = '#1a1020'; x.beginPath(); x.arc(4, 0, 1.9, 0, 7); x.fill();
x.fillStyle = '#ff8fb1'; x.beginPath(); x.arc(12, 3, 3, 0, 7); x.fill();
x.fillStyle = '#ffcc1f'; x.beginPath(); x.ellipse(0, -7, 11, 7, 0, Math.PI, 0); x.fill(); x.fillRect(-13, -8, 26, 3);
x.fillStyle = '#fff7c2'; x.beginPath(); x.arc(7, -10, 2.6, 0, 7); x.fill();
x.restore();
</script></body>`;

const out = [
  ['icon-192.png', 192, false], ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true], ['apple-touch-icon.png', 180, true],
];
const browser = await chromium.launch();
for (const [name, size, maskable] of out) {
  const page = await browser.newPage({ deviceScaleFactor: 1, viewport: { width: size, height: size } });
  page.on('pageerror', (e) => console.error('icon script error:', e.message));
  await page.setContent(html(size, maskable));
  const buf = await page.locator('#c').screenshot();
  fs.writeFileSync(path.join(root, 'icons', name), buf);
  console.log('wrote icons/' + name);
  await page.close();
}
await browser.close();
