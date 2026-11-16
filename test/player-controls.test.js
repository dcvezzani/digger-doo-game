import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playing, blank, open, row, col, addBoulder, steps, stepUntil, center } from './helpers.js';
import { createSwipe } from '../src/core/swipe.js';
import { createKeyStack } from '../src/input/keyboard.js';
import { createStepper } from '../src/core/loop.js';
import { UP, LEFT, DOWN, RIGHT, NONE, UNITS } from '../src/core/constants.js';

test('moves only while a direction is held and stops on release', () => {
  const g = blank(playing());
  open(g, row(8, 6, 10));
  const p = g.state.player;
  g.setHeld(RIGHT);
  steps(g, 10);
  const x = p.x;
  assert.ok(x > center(6));
  g.setHeld(NONE);
  steps(g, 10);
  assert.equal(p.x, x, 'stopped');
  assert.equal(p.moving, false);
});

test('turn requested between tiles: continues to the next center, then turns', () => {
  const g = blank(playing());
  open(g, [[7, 8], [8, 8], [7, 9], [7, 10]]);
  const p = g.state.player;
  g.setHeld(RIGHT);
  stepUntil(g, () => p.x >= center(6) + UNITS / 3);
  g.setHeld(DOWN);
  stepUntil(g, () => p.y > center(8));
  assert.equal(p.x, center(7), 'turned exactly at the next center');
  assert.equal(p.dir, DOWN);
});

test('reverse mid-tile is immediate', () => {
  const g = blank(playing());
  open(g, row(8, 5, 8));
  const p = g.state.player;
  g.setHeld(RIGHT);
  stepUntil(g, () => p.x >= center(6) + UNITS / 2);
  const x = p.x;
  g.setHeld(LEFT);
  g.step();
  assert.ok(p.x < x);
  assert.equal(p.dir, LEFT);
});

test('board edge: Doo stays at the center of column 0 facing left', () => {
  const g = blank(playing(), { px: 0, py: 8 });
  const p = g.state.player;
  g.setHeld(LEFT);
  steps(g, 30);
  assert.equal(p.x, center(0));
  assert.equal(p.dir, LEFT);
});

test('Doo can dig anywhere within rows 1-16 and not above the surface', () => {
  const g = blank(playing(), { px: 3, py: 2 });
  const p = g.state.player;
  g.setHeld(UP);
  steps(g, 120);
  assert.equal(p.y, center(1), 'reached the surface and stopped there');
});

test('boulder ahead: Doo stops at the tile below it', () => {
  const g = blank(playing(), { px: 4, py: 10 });
  addBoulder(g, 4, 7);
  open(g, col(4, 9, 10)); // Doo digs up into (4,8) and holds the boulder up
  const p = g.state.player;
  g.setHeld(UP);
  steps(g, 120);
  assert.equal(p.y, center(8));
  assert.equal(p.dir, UP);
});

test('digging is slower than walking (about 75%)', () => {
  const timed = (dug) => {
    const g = blank(playing());
    if (dug) open(g, row(8, 6, 8));
    const p = g.state.player;
    g.setHeld(RIGHT);
    return stepUntil(g, () => p.x >= center(8));
  };
  const walk = timed(true), dig = timed(false);
  assert.ok(dig > walk);
  assert.ok(Math.abs(walk / dig - 0.75) < 0.05, `ratio ${walk / dig}`);
});

test('never moves a tile or more in one step', () => {
  const g = blank(playing());
  open(g, row(8, 0, 13));
  const p = g.state.player;
  g.setHeld(RIGHT);
  let last = p.x;
  for (let i = 0; i < 60; i++) { g.step(); assert.ok(Math.abs(p.x - last) < UNITS); last = p.x; }
});

test('frame-rate independence: 30 vs 144 fps render pacing cover the same distance', () => {
  const run = (fps) => {
    const g = blank(playing());
    open(g, row(8, 0, 13));
    g.setHeld(LEFT);
    const st = createStepper(() => g.step());
    for (let t = 0; t < 1.5 * fps; t++) st.advance(1000 / fps);
    return g.state.player.x;
  };
  assert.equal(run(30), run(144));
});

test('swipe: drag left 30 px and 5 px down registers Left at 20 px, before lifting', () => {
  const s = createSwipe(20);
  s.start(100, 100);
  assert.equal(s.move(85, 102), NONE);
  assert.equal(s.move(78, 104), LEFT);
  assert.equal(s.move(70, 105), NONE, 'no repeat while holding');
  assert.equal(s.end(), false, 'not a tap');
});

test('swipe: tiny movement is a tap; L-shaped drag gives Left then Up', () => {
  const t = createSwipe(20);
  t.start(10, 10); t.move(15, 18);
  assert.equal(t.end(), true);
  const s = createSwipe(20);
  s.start(200, 200);
  const out = [];
  for (let i = 1; i <= 30; i++) { const d = s.move(200 - i, 200); if (d !== NONE) out.push(d); }
  for (let i = 1; i <= 30; i++) { const d = s.move(170, 200 - i); if (d !== NONE) out.push(d); }
  assert.deepEqual(out, [LEFT, UP]);
});

test('keyboard: held key stack — Right, then Up, release Up -> Right again', () => {
  const k = createKeyStack();
  assert.equal(k.press('ArrowRight'), RIGHT);
  assert.equal(k.press('KeyW'), UP);
  assert.equal(k.release('KeyW'), RIGHT);
  assert.equal(k.release('ArrowRight'), NONE);
});
