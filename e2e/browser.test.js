// Browser checks with Playwright (uses the pre-installed Chromium).
// Run: npm run e2e   Screenshots are written to e2e/output/.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'e2e', 'output');
fs.mkdirSync(outDir, { recursive: true });
const PORT = 8000 + Math.floor(Math.random() * 900);
const BASE = `http://localhost:${PORT}/`;

let server, browser;
before(async () => {
  server = spawn(process.execPath, [path.join(root, 'tools', 'serve.mjs'), '--port', String(PORT)], { stdio: 'pipe' });
  await new Promise((resolve) => server.stdout.once('data', resolve));
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.kill(); });

const iphone = devices['iPhone 13'];
async function open(ctxOpts, url = `${BASE}?seed=3`) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__diggerDoo);
  return { ctx, page, errors };
}
const dd = (page, fn, arg) => page.evaluate(fn, arg);
const phase = (page) => dd(page, () => window.__diggerDoo.game.phase);
async function waitPhase(page, p) { await page.waitForFunction((x) => window.__diggerDoo.game.phase === x, p, { timeout: 8000 }); }
/** Remove enemies' threat so a browser check is not ended by a stray Gloop. */
const calm = (page) => dd(page, () => { const s = window.__diggerDoo.game.state; s.lvl = { ...s.lvl, roamSpeed: 0, ghostSteps: 1e9 }; for (const e of s.enemies) e.ghostTimer = 1e9; });

async function touch(page) {
  const cdp = await page.context().newCDPSession(page);
  return (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });
}

async function touchDrag(page, from, to, { lift = true, steps = 8 } = {}) {
  const send = await touch(page);
  await send('touchStart', [[from.x, from.y]]);
  for (let i = 1; i <= steps; i++) {
    await send('touchMove', [[from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps]]);
  }
  const end = async () => send('touchEnd', []);
  if (lift) await end();
  return { end, send };
}

test('phone: double-tap and drags neither zoom nor scroll the page (1.2)', async () => {
  const { ctx, page, errors } = await open(iphone);
  await page.touchscreen.tap(200, 400);
  await page.touchscreen.tap(200, 400);
  await touchDrag(page, { x: 200, y: 120 }, { x: 200, y: 600 });
  await touchDrag(page, { x: 200, y: 600 }, { x: 200, y: 150 });
  await page.waitForTimeout(300);
  const v = await page.evaluate(() => ({ scale: visualViewport.scale, sy: scrollY, st: document.scrollingElement.scrollTop, sel: String(getSelection()) }));
  assert.equal(v.scale, 1);
  assert.equal(v.sy, 0);
  assert.equal(v.st, 0);
  assert.equal(v.sel, '');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('phone: tap starts; a held drag digs; lifting stops; direction registers mid-drag (3.3)', async () => {
  const { ctx, page, errors } = await open(iphone);
  assert.equal(await phase(page), 'start');
  await page.screenshot({ path: path.join(outDir, 'phone-start.png') });
  await page.touchscreen.tap(195, 420);
  await waitPhase(page, 'playing');
  await calm(page);
  await dd(page, () => {
    const g = window.__diggerDoo.game; const orig = g.setHeld;
    window.__held = []; g.setHeld = (d) => { window.__held.push(d); orig(d); };
  });
  const drag = await touchDrag(page, { x: 200, y: 400 }, { x: 200, y: 440 }, { lift: false }); // down, still touching
  assert.deepEqual(await dd(page, () => window.__held), [2], 'Down registered once, mid-drag');
  const y0 = await dd(page, () => window.__diggerDoo.game.state.player.y);
  await page.waitForTimeout(600);
  const y1 = await dd(page, () => window.__diggerDoo.game.state.player.y);
  assert.ok(y1 > y0, 'Doo keeps digging while the finger is held');
  await page.screenshot({ path: path.join(outDir, 'phone-digging.png') });
  await drag.end();
  await page.waitForTimeout(100);
  const y2 = await dd(page, () => window.__diggerDoo.game.state.player.y);
  await page.waitForTimeout(300);
  assert.equal(await dd(page, () => window.__diggerDoo.game.state.player.y), y2, 'stopped after lifting');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('phone: a quick tap pumps; a second finger pumps while the first keeps steering (3.3)', async () => {
  const { ctx, page, errors } = await open(iphone);
  await page.touchscreen.tap(195, 420);
  await waitPhase(page, 'playing');
  await calm(page);
  await dd(page, () => { const g = window.__diggerDoo.game; const orig = g.pump; window.__pumps = 0; g.pump = (d) => { if (d) window.__pumps += 1; orig(d); }; });
  await page.touchscreen.tap(195, 420);
  assert.equal(await dd(page, () => window.__pumps), 1, 'tap = one pump');
  const send = await touch(page);
  await send('touchStart', [[200, 400]]);
  for (let i = 1; i <= 6; i++) await send('touchMove', [[200, 400 - i * 6]]); // steer up
  await send('touchStart', [[200, 364], [300, 600]]);                        // second finger down
  await send('touchMove', [[200, 364]]);                                     // second finger up (dropped from the list)
  assert.equal(await dd(page, () => window.__pumps), 2, 'second finger pumped');
  assert.equal(await dd(page, () => window.__diggerDoo.game.state.held), 0, 'steering still held');
  await send('touchEnd', []);
  assert.deepEqual(errors, []);
  await ctx.close();
});

for (const [name, vp, mobile] of [['320x568', { width: 320, height: 568 }, true], ['390x844', { width: 390, height: 844 }, true], ['844x390', { width: 844, height: 390 }, true], ['1440x900', { width: 1440, height: 900 }, false]]) {
  test(`layout ${name}: playfield fits, keeps its ratio and is drawn at device resolution (1.3, 7.6)`, async () => {
    const dpr = mobile ? 3 : 1;
    const { ctx, page, errors } = await open({ viewport: vp, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
    for (const dpad of [false, true]) {
      await dd(page, (d) => { window.__diggerDoo.settings.dpad = d; window.__diggerDoo.relayout(); }, dpad);
      const m = await page.evaluate(() => {
        const c = document.getElementById('game');
        const r = c.getBoundingClientRect();
        const btns = [...document.querySelectorAll('#top-buttons button:not([hidden]), #dpad:not([hidden]) button, #btn-pump:not([hidden])')].map((b) => {
          const q = b.getBoundingClientRect(); return { id: b.id || b.dataset.dir, x: q.x, y: q.y, w: q.width, h: q.height, kind: b.id === 'btn-pump' ? 'pump' : b.classList.contains('dpad-btn') ? 'dpad' : 'btn' };
        });
        return { r: { x: r.x, y: r.y, w: r.width, h: r.height }, cw: c.width, ch: c.height, btns, L: window.__diggerDoo.layout };
      });
      assert.ok(m.r.x >= -0.5 && m.r.y >= -0.5 && m.r.x + m.r.w <= vp.width + 0.5 && m.r.y + m.r.h <= vp.height + 0.5, 'inside viewport');
      assert.ok(Math.abs(m.r.w / m.r.h - 448 / 576) < 0.01, 'aspect ratio');
      assert.equal(m.cw, Math.round(m.L.pf.w * dpr), 'canvas backing store = CSS width x DPR');
      const board = { x: m.r.x, y: m.r.y + (32 / 576) * m.r.h, w: m.r.w, h: (512 / 576) * m.r.h };
      const min = { pump: 72, dpad: 56, btn: 44 };
      for (const b of m.btns) {
        assert.ok(b.w >= min[b.kind] - 0.5 && b.h >= min[b.kind] - 0.5, `${b.id} size ${b.w}x${b.h}`);
        const hit = b.x < board.x + board.w - 0.5 && board.x < b.x + b.w - 0.5 && b.y < board.y + board.h - 0.5 && board.y < b.y + b.h - 0.5;
        assert.ok(!hit, `${b.id} overlaps the board`);
      }
      if (dpad) assert.equal(m.btns.filter((b) => b.kind === 'pump').length, 1, 'PUMP shown');
      await page.screenshot({ path: path.join(outDir, `layout-${name}${dpad ? '-controls' : ''}.png`) });
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}

test('settings: on-screen controls and sound apply at once and persist after reload; D-pad moves while held (7.6, 8.2)', async () => {
  const { ctx, page } = await open(iphone);
  await page.click('#btn-settings');
  await page.waitForSelector('#settings-panel:not([hidden])');
  await page.click('#tgl-dpad');
  await page.click('#tgl-sound');
  await page.click('#btn-settings-close');
  assert.equal(await page.isVisible('#dpad'), true);
  assert.equal(await page.isVisible('#btn-pump'), true);
  assert.equal(await page.getAttribute('#btn-sound', 'aria-pressed'), 'true');
  await page.reload();
  await page.waitForFunction(() => window.__diggerDoo);
  assert.equal(await page.isVisible('#dpad'), true, 'controls still on');
  assert.equal(await page.getAttribute('#btn-sound', 'aria-pressed'), 'true', 'still muted');
  await page.touchscreen.tap(195, 200);
  await waitPhase(page, 'playing');
  await calm(page);
  const down = await (await page.$('.dpad-btn[data-dir="2"]')).boundingBox();
  const send = await touch(page);
  await send('touchStart', [[down.x + down.width / 2, down.y + down.height / 2]]);
  await page.waitForTimeout(400);
  assert.equal(await dd(page, () => window.__diggerDoo.game.state.held), 2, 'Down held');
  assert.ok(await dd(page, () => window.__diggerDoo.game.state.player.moving), 'moving while held');
  await send('touchEnd', []);
  assert.equal(await dd(page, () => window.__diggerDoo.game.state.held), -1, 'released');
  const pump = await (await page.$('#btn-pump')).boundingBox();
  await dd(page, () => { const g = window.__diggerDoo.game; const orig = g.pump; window.__pumps = 0; g.pump = (d) => { if (d) window.__pumps += 1; orig(d); }; });
  await page.touchscreen.tap(pump.x + pump.width / 2, pump.y + pump.height / 2);
  assert.equal(await dd(page, () => window.__pumps), 1, 'PUMP button pumps');
  await page.screenshot({ path: path.join(outDir, 'phone-controls.png') });
  await ctx.close();
});

test('lifecycle: hiding the page pauses; no game time passes; resume shows a countdown', async () => {
  const { ctx, page } = await open(iphone);
  await page.touchscreen.tap(195, 420);
  await waitPhase(page, 'playing');
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const t0 = await dd(page, () => window.__diggerDoo.game.state.tick);
  await page.waitForTimeout(800);
  assert.equal(await dd(page, () => window.__diggerDoo.game.state.tick), t0, 'no game time while hidden');
  assert.equal(await dd(page, () => window.__diggerDoo.game.state.paused), true);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(300);
  assert.equal(await dd(page, () => window.__diggerDoo.game.state.paused), true, 'stays paused on return');
  assert.equal(await page.isVisible('#pause-panel'), true);
  await page.screenshot({ path: path.join(outDir, 'paused.png') });
  await page.click('#btn-resume');
  assert.ok(await dd(page, () => window.__diggerDoo.game.state.countdown) > 0, 'countdown running');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, 'countdown.png') });
  await ctx.close();
});

test('offline: after one online visit the game loads and plays with no network (9.1)', async () => {
  const { ctx, page, errors } = await open(iphone, `${BASE}?sw=1`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => window.__diggerDoo);
  await page.touchscreen.tap(195, 420);
  await waitPhase(page, 'playing');
  await ctx.setOffline(false);
  assert.deepEqual(errors.filter((e) => !/ERR_INTERNET_DISCONNECTED/.test(e)), []);
  await ctx.close();
});

test('no Web Audio or vibration: runs silently without errors; no audio files requested (8.1)', async () => {
  const ctx = await browser.newContext(iphone);
  await ctx.addInitScript(() => {
    delete window.AudioContext; delete window.webkitAudioContext;
    try { Object.defineProperty(Navigator.prototype, 'vibrate', { value: undefined, configurable: true }); } catch { /* ignore */ }
  });
  const page = await ctx.newPage();
  const errors = [], audioReqs = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { if (/\.(mp3|ogg|wav|m4a|aac|opus|flac)(\?|$)/i.test(r.url()) || r.resourceType() === 'media') audioReqs.push(r.url()); });
  await page.goto(`${BASE}?seed=5`);
  await page.waitForFunction(() => window.__diggerDoo);
  await page.touchscreen.tap(195, 420);
  await waitPhase(page, 'playing');
  await dd(page, () => window.__diggerDoo.game.setHeld(2));
  await page.touchscreen.tap(195, 420);
  await page.waitForTimeout(1500);
  assert.deepEqual(errors, []);
  assert.deepEqual(audioReqs, []);
  await ctx.close();
});

test('flee alarm starts with the last enemy fleeing and stops when it is popped (8.1)', async () => {
  const { ctx, page, errors } = await open(iphone);
  await page.touchscreen.tap(195, 420); // unlocks audio and starts
  await waitPhase(page, 'playing');
  await calm(page);
  await dd(page, () => { const s = window.__diggerDoo.game.state; s.enemies.slice(1).forEach((e) => { e.state = 'gone'; }); });
  const hasAudio = await dd(page, () => !!window.__diggerDoo.sfx.context && window.__diggerDoo.sfx.context.state === 'running');
  await page.waitForFunction(() => window.__diggerDoo.game.state.fleeing, null, { timeout: 3000 });
  if (hasAudio) await page.waitForFunction(() => window.__diggerDoo.sfx.alarmOn, null, { timeout: 3000 });
  await dd(page, () => { const s = window.__diggerDoo.game.state; const e = s.enemies[0]; e.state = 'popped'; e.timer = 30; });
  await page.waitForFunction(() => !window.__diggerDoo.sfx.alarmOn, null, { timeout: 3000 });
  await waitPhase(page, 'levelClear');
  await page.screenshot({ path: path.join(outDir, 'round-clear.png') });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('desktop: Enter starts, held arrows dig, Space pumps, P pauses and resumes, M toggles sound, clicks work', async () => {
  const { ctx, page, errors } = await open({ viewport: { width: 1440, height: 900 } });
  await page.screenshot({ path: path.join(outDir, 'desktop-start.png') });
  await page.keyboard.press('Enter');
  await waitPhase(page, 'playing');
  await calm(page);
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(500);
  assert.equal(await dd(page, () => window.__diggerDoo.game.state.held), 2);
  assert.ok(await dd(page, () => window.__diggerDoo.game.state.player.moving));
  await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(50);
  assert.equal(await dd(page, () => window.__diggerDoo.game.state.held), -1);
  await page.keyboard.press('Space');
  await page.waitForTimeout(50);
  assert.notEqual(await dd(page, () => window.__diggerDoo.game.state.hose.state), 'idle', 'Space fired the hose');
  const sy = await page.evaluate(() => scrollY);
  assert.equal(sy, 0);
  await page.keyboard.press('KeyP');
  assert.equal(await page.isVisible('#pause-panel'), true);
  await page.keyboard.press('KeyP');
  assert.ok(await dd(page, () => window.__diggerDoo.game.state.countdown) > 0);
  await page.keyboard.press('KeyM');
  assert.equal(await dd(page, () => window.__diggerDoo.settings.muted), true);
  await page.waitForTimeout(3300);
  await page.screenshot({ path: path.join(outDir, 'desktop-playing.png') });
  await page.click('#btn-pause');
  await page.click('#btn-sound');
  assert.equal(await dd(page, () => window.__diggerDoo.settings.muted), false, 'mouse click toggles sound');
  await page.click('#btn-quit');
  assert.equal(await phase(page), 'start');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('game over screen ignores the first second of taps, then returns to start', async () => {
  const { ctx, page } = await open(iphone);
  await page.touchscreen.tap(195, 420);
  await waitPhase(page, 'playing');
  await page.evaluate(() => {
    const s = window.__diggerDoo.game.state;
    s.lives = 1;
    const e = s.enemies[0]; e.state = 'roam'; e.x = s.player.x; e.y = s.player.y;
  });
  await waitPhase(page, 'gameOver');
  await page.touchscreen.tap(195, 420);
  assert.equal(await phase(page), 'gameOver');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, 'game-over.png') });
  await page.touchscreen.tap(195, 420);
  await waitPhase(page, 'start');
  await ctx.close();
});
