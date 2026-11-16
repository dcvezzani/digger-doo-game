import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playing, blank, open, col, row, addEnemy, addBoulder, steps, stepUntil, events, types, center } from './helpers.js';
import { UP, LEFT } from '../src/core/constants.js';
import { WOBBLE_STEPS, CRUMBLE_STEPS } from '../src/core/boulders.js';
import { isOpen } from '../src/core/board.js';

test('digging under a boulder then leaving sideways: wobbles once Doo has left, falls 0.75 s later', () => {
  const g = blank(playing(), { px: 3, py: 7 });
  const b = addBoulder(g, 3, 5);
  const p = g.state.player;
  g.setHeld(UP);
  stepUntil(g, () => p.y === center(6));
  steps(g, 30);
  assert.equal(b.state, 'rest', 'held up while Doo is beneath');
  g.setHeld(LEFT);
  const left = stepUntil(g, () => b.state === 'wobble', 200);
  assert.ok(p.x <= center(3) - 256 + 1, 'Doo no longer overlaps the tile below');
  assert.ok(left > 0);
  steps(g, WOBBLE_STEPS - 1);
  assert.equal(b.state, 'wobble');
  g.step();
  assert.equal(b.state, 'fall');
});

test('a wobbling boulder still blocks Doo', () => {
  const g = blank(playing(), { px: 3, py: 6 });
  const b = addBoulder(g, 3, 4);
  open(g, [[3, 5], [2, 5]]);
  g.state.player.x = center(2); g.state.player.y = center(5);
  g.step();
  assert.equal(b.state, 'wobble');
  g.state.player.x = center(3); g.state.player.y = center(5);
  b.timer = 1000;
  g.setHeld(UP);
  steps(g, 30);
  assert.equal(g.state.player.y, center(5));
});

test('falls down a 4-deep shaft at 6 tiles/s and lands at the bottom; origin opens', () => {
  const g = blank(playing(), { px: 10, py: 3 });
  const b = addBoulder(g, 4, 5);
  open(g, col(4, 6, 9));
  g.step();
  assert.equal(b.state, 'wobble');
  steps(g, WOBBLE_STEPS);
  assert.equal(b.state, 'fall');
  assert.ok(isOpen(g.state.board, 4, 5), 'origin tile opened');
  const n = stepUntil(g, () => b.state === 'crumble', 200);
  assert.equal(b.y, center(9));
  assert.ok(Math.abs(n - 40) <= 2, `4 tiles in ${n} steps`);
});

test('crumbling: gone 0.5 s after landing and the tile is open', () => {
  const g = blank(playing(), { px: 10, py: 3 });
  const b = addBoulder(g, 4, 5);
  open(g, col(4, 6, 7));
  stepUntil(g, () => b.state === 'crumble', 200);
  assert.ok(types(events(g)).includes('land'));
  steps(g, CRUMBLE_STEPS);
  assert.equal(b.state, 'gone');
  assert.ok(isOpen(g.state.board, 4, 7));
});

test('two enemies crushed: carried down, removed on landing, 2,500 points', () => {
  const g = blank(playing(), { px: 10, py: 3 });
  g.state.lvl = { ...g.state.lvl, roamSpeed: 0 };
  const b = addBoulder(g, 4, 5);
  open(g, col(4, 6, 10));
  const e1 = addEnemy(g, 'gloop', 4, 7);
  const e2 = addEnemy(g, 'gloop', 4, 9);
  const score = g.state.score;
  stepUntil(g, () => b.state === 'crumble', 300);
  assert.equal(e1.state, 'gone'); assert.equal(e2.state, 'gone');
  assert.equal(g.state.score - score, 2500);
  const crush = events(g).find((e) => e.type === 'crush');
  assert.equal(crush.count, 2);
});

test('ghosts are not crushed', () => {
  const g = blank(playing(), { px: 10, py: 3 });
  g.state.lvl = { ...g.state.lvl, ghostSpeed: 0 };
  const b = addBoulder(g, 4, 5);
  open(g, col(4, 6, 8));
  const e = addEnemy(g, 'gloop', 4, 7);
  e.state = 'ghost';
  e.ghostSteps = -10000; // stay a ghost for the whole fall
  stepUntil(g, () => b.state === 'crumble', 300);
  assert.equal(e.state, 'ghost');
});

test('Doo crushed by a falling boulder loses a life', () => {
  const g = blank(playing(), { px: 4, py: 9 });
  const b = addBoulder(g, 4, 5);
  open(g, col(4, 6, 9));
  b.state = 'fall';
  stepUntil(g, () => g.phase === 'dying', 200);
  assert.equal(g.state.deathCause, 'crush');
});

test('falling boulder at life loss is removed; resting boulders stay', () => {
  const g = blank(playing(), { px: 4, py: 9 });
  const falling = addBoulder(g, 4, 5);
  const resting = addBoulder(g, 10, 10);
  open(g, col(4, 6, 9));
  falling.state = 'fall';
  stepUntil(g, () => g.phase === 'dying', 200);
  stepUntil(g, () => g.phase === 'ready', 200);
  assert.equal(falling.state, 'gone');
  assert.equal(resting.state, 'rest');
  void row;
});
