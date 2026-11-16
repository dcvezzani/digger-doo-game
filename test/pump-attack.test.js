import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playing, blank, open, row, addEnemy, steps, stepUntil, tap, events, types, center } from './helpers.js';
import { LEFT, RIGHT, NONE } from '../src/core/constants.js';
import { PUMP_MIN_STEPS, PUMP_REPEAT_STEPS, DEFLATE_STEPS, HOSE_MISS_COOLDOWN } from '../src/core/game.js';

function facing(g, dir) { g.state.player.dir = dir; }

/** Doo at (6,8) facing left, tunnel row 8 cols 1-6, Gloop 2 tiles left (frozen in place). */
function withGloop() {
  const g = blank(playing());
  open(g, row(8, 1, 6));
  facing(g, LEFT);
  const e = addEnemy(g, 'gloop', 4, 8, LEFT);
  g.state.lvl = { ...g.state.lvl, roamSpeed: 0 };
  return { g, e };
}

test('miss in a tunnel: the hose extends 3 tiles, is withdrawn, and Doo can move shortly after', () => {
  const g = blank(playing());
  open(g, row(8, 1, 6));
  facing(g, LEFT);
  tap(g);
  let maxLen = 0;
  const n = stepUntil(g, () => { maxLen = Math.max(maxLen, g.state.hose.len); return g.state.hose.state === 'cool'; });
  assert.equal(maxLen, 3 * 256);
  assert.ok(n < 15);
  assert.ok(types(events(g)).includes('miss'));
  steps(g, HOSE_MISS_COOLDOWN);
  assert.equal(g.state.hose.state, 'idle');
  g.setHeld(RIGHT);
  steps(g, 3);
  assert.ok(g.state.player.x > center(6));
});

test('blocked by dirt: the hose does not pass into dirt and is withdrawn at once', () => {
  const g = blank(playing());
  facing(g, LEFT);
  tap(g);
  g.step();
  assert.equal(g.state.hose.state, 'cool');
  assert.ok(g.state.hose.len <= 128);
});

test('hook a Gloop two tiles away: inflated to stage 1', () => {
  const { g, e } = withGloop();
  tap(g);
  stepUntil(g, () => g.state.hose.state === 'hooked', 20);
  assert.equal(e.state, 'inflated');
  assert.equal(e.stage, 1);
  assert.equal(g.state.hose.target, e);
});

test('ghosts cannot be hooked', () => {
  const { g, e } = withGloop();
  e.state = 'ghost';
  e.ghostSteps = 0;
  g.state.lvl = { ...g.state.lvl, ghostSpeed: 0 };
  tap(g);
  g.step();
  stepUntil(g, () => g.state.hose.state !== 'out', 20);
  assert.equal(g.state.hose.state, 'cool');
  assert.equal(e.state, 'ghost');
});

test('the hose passes through a ghost and hooks a solid Gloop behind it', () => {
  const g = blank(playing());
  open(g, row(8, 1, 6));
  facing(g, LEFT);
  g.state.lvl = { ...g.state.lvl, roamSpeed: 0, ghostSpeed: 0 };
  const ghost = addEnemy(g, 'gloop', 5, 8, LEFT);
  ghost.state = 'ghost'; ghost.ghostSteps = -10000;
  const e = addEnemy(g, 'gloop', 4, 8, LEFT);
  tap(g);
  g.step();
  stepUntil(g, () => g.state.hose.state !== 'out', 20);
  assert.equal(g.state.hose.state, 'hooked');
  assert.equal(g.state.hose.target, e);
  assert.equal(ghost.state, 'ghost', 'ghost unaffected');
});

test('four stages pop: three more presses at least 0.2 s apart; scores by depth (row 8 = 300)', () => {
  const { g, e } = withGloop();
  tap(g);
  stepUntil(g, () => g.state.hose.state === 'hooked', 20);
  events(g);
  const score = g.state.score;
  for (let i = 0; i < 3; i++) { steps(g, PUMP_MIN_STEPS); tap(g); g.step(); }
  assert.equal(e.state, 'popped');
  assert.equal(g.state.score - score, 300);
  assert.ok(types(events(g)).includes('pop'));
  assert.equal(g.state.hose.state, 'idle');
});

test('presses faster than 0.2 s count only once', () => {
  const { g, e } = withGloop();
  tap(g);
  stepUntil(g, () => g.state.hose.state === 'hooked', 20);
  for (let i = 0; i < 5; i++) { tap(g); g.step(); }
  assert.equal(e.stage, 1);
  steps(g, PUMP_MIN_STEPS);
  tap(g); g.step();
  assert.equal(e.stage, 2);
});

test('holding the pump inflates a stage every 0.3 s until it pops', () => {
  const { g, e } = withGloop();
  g.pump(true);
  stepUntil(g, () => g.state.hose.state === 'hooked', 20);
  const t0 = g.state.tick;
  stepUntil(g, () => e.state === 'popped', 200);
  const dt = g.state.tick - t0;
  assert.ok(Math.abs(dt - 3 * PUMP_REPEAT_STEPS) <= 8, `popped after ${dt} steps`);
});

test('inflated enemies are helpless: touching one costs no life', () => {
  const { g, e } = withGloop();
  tap(g);
  stepUntil(g, () => g.state.hose.state === 'hooked', 20);
  steps(g, PUMP_MIN_STEPS); tap(g); g.step(); // stage 2
  g.setHeld(LEFT); // walk into it
  steps(g, 30);
  assert.equal(g.phase, 'playing');
  assert.ok(Math.abs(g.state.player.x - e.x) < 192, 'Doo overlaps the inflated Gloop');
});

test('deflating: stage 2 recovers about 1.5 s after the last pump and moves again', () => {
  const { g, e } = withGloop();
  g.state.lvl = { ...g.state.lvl, roamSpeed: 8000 };
  e.x = center(3); // keep it away from Doo once it recovers
  facing(g, LEFT);
  tap(g);
  stepUntil(g, () => g.state.hose.state === 'hooked', 30);
  steps(g, PUMP_MIN_STEPS); tap(g); g.step();
  assert.equal(e.stage, 2);
  const t0 = g.state.tick;
  stepUntil(g, () => g.state.hose.state === 'idle', 200);
  assert.ok(Math.abs(g.state.tick - t0 - DEFLATE_STEPS) <= 2, 'hose lets go ~0.75 s after the last pump');
  assert.equal(e.state, 'inflated', 'still frozen while deflating');
  stepUntil(g, () => e.state === 'roam', 200);
  assert.ok(Math.abs(g.state.tick - t0 - 2 * DEFLATE_STEPS) <= 2);
  const x = e.x;
  steps(g, 20);
  assert.notEqual(e.x, x, 'moving again');
});

test('walking away mid-pump withdraws the hose; the enemy starts deflating', () => {
  const { g, e } = withGloop();
  tap(g);
  stepUntil(g, () => g.state.hose.state === 'hooked', 20);
  steps(g, PUMP_MIN_STEPS); tap(g); g.step();
  g.setHeld(RIGHT);
  g.step();
  assert.equal(g.state.hose.state, 'idle');
  open(g, row(8, 7, 9));
  steps(g, 5);
  assert.ok(g.state.player.x > center(6));
  stepUntil(g, () => e.stage === 1, DEFLATE_STEPS + 2);
});

test('pump while steering: Doo stops while the hose is out, then continues in the held direction', () => {
  const g = blank(playing());
  open(g, row(8, 0, 6));
  g.setHeld(LEFT);
  steps(g, 5);
  tap(g); // second finger
  g.step();
  const x = g.state.player.x;
  steps(g, 8);
  assert.equal(g.state.player.x, x, 'stopped while the hose is out');
  stepUntil(g, () => g.state.hose.state === 'idle', 40);
  steps(g, 3);
  assert.ok(g.state.player.x < x, 'moving left again');
  assert.equal(g.state.held, LEFT);
});

test('losing a life withdraws the hose', () => {
  const { g } = withGloop();
  tap(g);
  stepUntil(g, () => g.state.hose.state === 'hooked', 20);
  addEnemy(g, 'gloop', 6, 8); // on top of Doo: harmful
  g.step();
  assert.equal(g.phase, 'dying');
  assert.equal(g.state.hose.state, 'idle');
  void NONE;
});
