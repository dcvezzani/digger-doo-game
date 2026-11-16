import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createStorage, DEFAULT_SETTINGS } from '../src/storage.js';
import { computeLayout, BUTTON, DPAD_CELL, PUMP_SIZE } from '../src/ui/layout.js';
import { createGame } from '../src/core/game.js';
import { createSwipe } from '../src/core/swipe.js';
import { createKeyStack } from '../src/input/keyboard.js';
import { UP, LEFT, DOWN, RIGHT, NONE, VIEW_W, VIEW_H, TILE } from '../src/core/constants.js';

function memStore() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}
const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };

test('storage: high score survives a reload', () => {
  const store = memStore();
  const a = createStorage(store);
  a.saveHighScore(3000);
  a.saveHighScore(5000);
  a.saveHighScore(4000);
  assert.equal(createStorage(store).loadHighScore(), 5000);
});

test('storage: blocked storage still works for the session and starts at 0', () => {
  const s = createStorage(throwing);
  assert.equal(s.loadHighScore(), 0);
  assert.deepEqual(s.loadSettings(), { ...DEFAULT_SETTINGS });
  s.saveHighScore(1200);
  assert.equal(s.loadHighScore(), 1200);
  assert.doesNotThrow(() => s.saveSettings({ muted: true, dpad: true }));
  assert.deepEqual(s.loadSettings(), { muted: true, dpad: true });
});

test('storage: settings (sound, on-screen controls) persist', () => {
  const store = memStore();
  createStorage(store).saveSettings({ muted: true, dpad: true });
  assert.deepEqual(createStorage(store).loadSettings(), { muted: true, dpad: true });
});

const none = { top: 0, right: 0, bottom: 0, left: 0 };
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const boardRect = (pf) => ({ x: pf.x, y: pf.y + 1 * TILE * pf.scale, w: pf.w, h: 16 * TILE * pf.scale });
const sq = (r) => ({ x: r.x, y: r.y, w: r.size, h: r.size });

for (const [vw, vh, insets] of [[320, 568, none], [390, 844, { top: 47, right: 0, bottom: 34, left: 0 }], [844, 390, { top: 0, right: 47, bottom: 21, left: 47 }], [1440, 900, none], [768, 1024, none]]) {
  for (const dpad of [false, true]) {
    test(`layout ${vw}x${vh} controls=${dpad}: fits the safe area, keeps ratio, nothing covers the board`, () => {
      const L = computeLayout({ vw, vh, insets, dpad });
      const { pf } = L;
      const eps = 0.01;
      assert.ok(pf.x >= insets.left - eps && pf.x + pf.w <= vw - insets.right + eps, 'inside horizontally');
      assert.ok(pf.y - pf.pad >= insets.top - eps && pf.y + pf.h <= vh - insets.bottom + eps, 'inside vertically');
      assert.ok(Math.abs(pf.w / pf.h - VIEW_W / VIEW_H) < 1e-6, 'aspect ratio');
      assert.ok(L.bar.h >= BUTTON - eps, 'button bar fits a 44 px button above the board');
      const board = boardRect(pf);
      assert.ok(L.bar.y + L.bar.h <= board.y + eps, 'buttons stay above the board');
      if (dpad) {
        for (const r of [sq(L.dpad), sq(L.pump)]) {
          assert.ok(!overlaps(r, board), 'controls do not cover the board');
          assert.ok(r.x >= insets.left - eps && r.x + r.w <= vw - insets.right + eps && r.y >= insets.top - eps && r.y + r.h <= vh - insets.bottom + eps, 'inside safe area');
        }
        assert.ok(!overlaps(sq(L.dpad), sq(L.pump)), 'D-pad and PUMP apart');
        assert.ok(DPAD_CELL >= 56 && PUMP_SIZE >= 72);
      } else {
        assert.equal(L.dpad, null);
        assert.equal(L.pump, null);
      }
      if (vw <= 320) assert.ok(pf.scale * 18 >= 10, `HUD digits ${pf.scale * 18} CSS px`);
    });
  }
}

test('layout: portrait phone uses the full safe-area width; controls below the board', () => {
  const L = computeLayout({ vw: 390, vh: 844, insets: none, dpad: false });
  assert.equal(L.pf.w, 390);
  const L2 = computeLayout({ vw: 390, vh: 844, insets: none, dpad: true });
  assert.equal(L2.pf.w, 390);
  assert.ok(L2.dpad.y > L2.pf.y + L2.pf.h);
  assert.ok(L2.pump.x > L2.dpad.x + L2.dpad.size);
});

test('layout: landscape centres the board with the D-pad left and PUMP right', () => {
  const L = computeLayout({ vw: 1440, vh: 900, insets: none, dpad: true });
  assert.ok(Math.abs(L.pf.x + L.pf.w / 2 - 720) < 1);
  assert.ok(L.dpad.x + L.dpad.size <= L.pf.x);
  assert.ok(L.pump.x >= L.pf.x + L.pf.w);
});

test('offline: the service worker precaches every game file; manifest is complete', () => {
  const sw = fs.readFileSync('sw.js', 'utf8');
  const listed = new Set([...sw.matchAll(/'([^']+\.(?:js|css|html|png|webmanifest))'/g)].map((m) => m[1]));
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
  const needed = [...walk('src'), ...walk('icons'), 'index.html', 'manifest.webmanifest'].map((p) => p.split(path.sep).join('/'));
  for (const f of needed) assert.ok(listed.has(f), `${f} missing from sw.js FILES`);
  const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
  for (const icon of manifest.icons) assert.ok(fs.existsSync(icon.src), `${icon.src} exists`);
  assert.equal(manifest.orientation, 'portrait');
  assert.equal(manifest.name, 'Digger Doo');
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'));
  assert.ok(manifest.icons.some((i) => i.sizes === '512x512'));
});

test('one input model: the same timed inputs by drag and by keys give identical states', () => {
  // [tick, action]: a direction to hold, 'up' to release, or 'pump'
  const plan = [[130, DOWN], [200, RIGHT], [260, 'up'], [262, 'pump'], [300, LEFT], [380, UP], [420, 'up'], [430, 'pump'], [460, DOWN], [600, 'up']];
  const keyFor = { [UP]: 'ArrowUp', [DOWN]: 'ArrowDown', [LEFT]: 'ArrowLeft', [RIGHT]: 'ArrowRight' };
  const vec = { [UP]: [0, -1], [DOWN]: [0, 1], [LEFT]: [-1, 0], [RIGHT]: [1, 0] };
  function viaKeys() {
    const g = createGame({ seed: 4 }); g.newGame();
    const keys = createKeyStack();
    let held = null;
    const out = [];
    for (let t = 0; t < 800; t++) {
      for (const [at, a] of plan) {
        if (at !== t) continue;
        if (a === 'pump') { g.pump(true); g.pump(false); continue; }
        if (held !== null) g.setHeld(keys.release(keyFor[held]));
        if (a === 'up') { held = null; continue; }
        held = a;
        g.setHeld(keys.press(keyFor[a]));
      }
      g.step(); out.push(g.snapshot());
    }
    return out;
  }
  function viaTouch() {
    const g = createGame({ seed: 4 }); g.newGame();
    const sw = createSwipe(20);
    let x = 200, y = 300;
    const out = [];
    for (let t = 0; t < 800; t++) {
      for (const [at, a] of plan) {
        if (at !== t) continue;
        if (a === 'pump') { g.pump(true); g.pump(false); continue; } // second finger
        if (a === 'up') { sw.end(); g.setHeld(NONE); continue; }
        if (!sw.active) { sw.start(x, y); g.setHeld(NONE); }
        for (let i = 1; i <= 25; i++) {
          x += vec[a][0]; y += vec[a][1];
          const d = sw.move(x, y);
          if (d !== NONE) g.setHeld(d);
        }
      }
      g.step(); out.push(g.snapshot());
    }
    return out;
  }
  assert.deepEqual(viaTouch(), viaKeys());
});
