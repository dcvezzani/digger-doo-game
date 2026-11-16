import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  playing, blank, open, row, col, addEnemy, addBoulder, steps, stepUntil, tap, events, types, center,
} from './helpers.js';
import { createGame, READY_STEPS, COUNTDOWN_STEPS, GAME_OVER_LOCK_STEPS, GEM_STEPS, LEVEL_CLEAR_STEPS } from '../src/core/game.js';
import { getLevel, gemFor } from '../src/core/levels.js';
import { crushPoints } from '../src/core/boulders.js';
import { isOpen } from '../src/core/board.js';
import { generateLevel, validateLayout } from '../src/core/layout.js';
import { UP, LEFT, DOWN, RIGHT, NONE } from '../src/core/constants.js';

// --- scoring -------------------------------------------------------------------
test('dig points: +10 per newly opened tile, none for walking a dug tunnel', () => {
  const g = blank(playing());
  const p = g.state.player;
  g.setHeld(RIGHT);
  stepUntil(g, () => p.x === center(7));
  assert.equal(g.state.score, 10);
  g.setHeld(LEFT);
  stepUntil(g, () => p.x === center(6));
  g.setHeld(RIGHT);
  stepUntil(g, () => p.x === center(7));
  assert.equal(g.state.score, 10);
});

test('pre-dug tiles and boulder-opened tiles do not score', () => {
  const g = blank(playing(), { px: 10, py: 3 });
  const b = addBoulder(g, 4, 5);
  open(g, col(4, 6, 7));
  stepUntil(g, () => b.state === 'gone', 300);
  assert.equal(g.state.score, 0);
});

function popAt(kind, y, dir) {
  const g = blank(playing(), { px: 6, py: y });
  g.state.lvl = { ...g.state.lvl, roamSpeed: 0, flame: 0 };
  if (dir === LEFT) open(g, row(y, 3, 6)); else open(g, col(6, y - 3, y));
  const e = addEnemy(g, kind, dir === LEFT ? 4 : 6, dir === LEFT ? y : y - 2);
  g.state.player.dir = dir;
  const before = g.state.score;
  g.pump(true);
  stepUntil(g, () => e.state === 'popped', 200);
  return { points: g.state.score - before, e };
}

test('pop points by depth: Gloop on row 15 scores 500', () => {
  assert.equal(popAt('gloop', 15, LEFT).points, 500);
  assert.equal(popAt('gloop', 4, LEFT).points, 200);
  assert.equal(popAt('gloop', 11, LEFT).points, 400);
});

test('a Sizzler popped from the side scores double (row 7, hose left = 600); from above it does not', () => {
  assert.equal(popAt('sizzler', 7, LEFT).points, 600);
  assert.equal(popAt('sizzler', 9, UP).points, 300); // enemy at row 7, layer 2
});

test('crush table', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8].map(crushPoints), [0, 1000, 2500, 4000, 6000, 8000, 10000, 12000, 15000]);
});

test('bonus gem: appears at the start tile after the second boulder falls; collecting scores 400', () => {
  const g = blank(playing(), { px: 10, py: 3 });
  const b1 = addBoulder(g, 2, 5); const b2 = addBoulder(g, 12, 5);
  open(g, [[2, 6], [12, 6]]);
  stepUntil(g, () => b1.state === 'fall' && b2.state === 'fall', 200);
  assert.ok(g.state.gem);
  assert.equal(g.state.gem.kind, 'quartz');
  assert.equal(g.state.gem.x, center(6)); assert.equal(g.state.gem.y, center(8));
  const before = g.state.score;
  open(g, [[6, 8]]);
  g.state.player.x = center(6); g.state.player.y = center(8);
  g.step();
  assert.equal(g.state.score - before, 400);
  assert.equal(g.state.gem, null);
});

test('bonus gem expires after 10 seconds and appears only once per level', () => {
  const g = blank(playing(), { px: 10, py: 3 });
  const bs = [addBoulder(g, 1, 5), addBoulder(g, 3, 5), addBoulder(g, 12, 5)];
  open(g, [[1, 6], [3, 6]]);
  stepUntil(g, () => g.state.gem, 200);
  steps(g, GEM_STEPS);
  assert.equal(g.state.gem, null);
  open(g, [[12, 6]]);
  stepUntil(g, () => bs[2].state === 'fall', 200);
  assert.equal(g.state.gem, null);
});

test('gem kinds by level', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 7, 9, 11, 13, 15, 18, 40].map((L) => gemFor(L).value), [400, 600, 800, 800, 1000, 2000, 3000, 4000, 5000, 6000, 8000, 8000]);
});

test('extra lives at 10,000 and every 40,000 after; one life per threshold', () => {
  const g = blank(playing(), { px: 6, py: 8 });
  const s = g.state;
  s.score = 9900;
  const lives = s.lives;
  open(g, [[6, 8]]);
  g.setHeld(RIGHT);
  // dig until score passes 10,000
  s.score = 9995;
  stepUntil(g, () => s.score >= 10005, 200);
  assert.equal(s.lives, lives + 1);
  s.score = 49995;
  g.setHeld(DOWN);
  stepUntil(g, () => s.score >= 50005, 200);
  assert.equal(s.lives, lives + 2);
  assert.equal(s.nextLife, 90000);
});

test('high score tracks the score', () => {
  const g = createGame({ seed: 2, highScore: 3000 });
  g.newGame();
  steps(g, READY_STEPS);
  blank(g);
  g.state.score = 3000;
  g.setHeld(RIGHT);
  stepUntil(g, () => g.state.score === 3010, 100);
  assert.equal(g.state.high, 3010);
});

// --- game flow -------------------------------------------------------------------
test('start: a new game begins at level 1 with score 0 and 3 lives; READY freezes for 2 s', () => {
  const g = createGame({ seed: 9 });
  assert.equal(g.phase, 'start');
  g.confirm();
  assert.equal(g.phase, 'ready');
  assert.deepEqual([g.state.level, g.state.score, g.state.lives], [1, 0, 3]);
  const snap = g.state.enemies.map((e) => [e.x, e.y]);
  g.setHeld(DOWN);
  steps(g, READY_STEPS - 1);
  assert.equal(g.phase, 'ready');
  assert.deepEqual(g.state.enemies.map((e) => [e.x, e.y]), snap);
  assert.equal(g.state.player.y, center(8));
  g.step();
  assert.equal(g.phase, 'playing');
});

test('losing a life keeps the tunnels and the remaining enemies; positions reset', () => {
  const g = playing(11);
  const s = g.state;
  s.enemies[0].state = 'gone'; s.enemies[1].state = 'gone';
  // dig a tunnel to the right
  g.setHeld(RIGHT);
  stepUntil(g, () => s.player.x === center(8), 200);
  const left = s.enemies.filter((e) => e.state !== 'gone');
  // a remaining enemy touches Doo
  left[0].x = s.player.x; left[0].y = s.player.y; left[0].state = 'roam';
  g.step();
  assert.equal(g.phase, 'dying');
  stepUntil(g, () => g.phase === 'ready', 300);
  assert.equal(s.lives, 2);
  assert.ok(isOpen(s.board, 7, 8) && isOpen(s.board, 8, 8), 'tunnel kept');
  assert.equal(s.player.x, center(6)); assert.equal(s.player.y, center(8));
  for (const e of left) { assert.equal(e.x, center(e.homeX)); assert.equal(e.y, center(e.homeY)); assert.equal(e.stage, 0); }
  assert.equal(s.enemies.filter((e) => e.state !== 'gone').length, 2);
});

test('level completion: popping the last enemy shows ROUND CLEAR and level 2 starts on a new board', () => {
  const g = playing(5);
  const s = g.state;
  const boardBefore = JSON.stringify(s.layout.burrows);
  for (const e of s.enemies) e.state = 'gone';
  g.step();
  assert.equal(g.phase, 'levelClear');
  assert.ok(types(events(g)).includes('levelClear'));
  const score = s.score, lives = s.lives;
  steps(g, LEVEL_CLEAR_STEPS);
  assert.equal(g.phase, 'ready');
  assert.equal(s.level, 2);
  assert.equal(s.score, score); assert.equal(s.lives, lives);
  assert.notEqual(JSON.stringify(s.layout.burrows), boardBefore);
  assert.equal(s.enemies.length, getLevel(2).enemies);
});

test('difficulty progression: monotonic up to level 11, something harder each level, limits stated', () => {
  for (let L = 2; L <= 15; L++) {
    const a = getLevel(L - 1), b = getLevel(L);
    assert.ok(b.roamSpeed >= a.roamSpeed && b.ghostSteps <= a.ghostSteps && b.enemies >= a.enemies && b.chase >= a.chase && b.flame >= a.flame);
    if (L <= 11) assert.ok(b.roamSpeed > a.roamSpeed || b.ghostSteps < a.ghostSteps || b.enemies > a.enemies, `level ${L} is harder`);
  }
  assert.equal(getLevel(1).ghostSecs, 9); assert.equal(getLevel(11).ghostSecs, 4); assert.equal(getLevel(20).ghostSecs, 4);
  assert.equal(getLevel(1).chase, 0.5); assert.ok(Math.abs(getLevel(11).chase - 0.85) < 1e-9);
  assert.equal(getLevel(1).flame, 0.25); assert.ok(Math.abs(getLevel(11).flame - 0.6) < 1e-9);
});

test('endless levels: level 256 has a valid board with 8 enemies and plays', () => {
  const L = generateLevel(77, 256);
  assert.deepEqual(validateLayout(L), []);
  const g = playing(77);
  g.state.level = 255;
  for (const e of g.state.enemies) e.state = 'gone';
  g.step();
  steps(g, LEVEL_CLEAR_STEPS + READY_STEPS);
  assert.equal(g.state.level, 256);
  assert.equal(g.phase, 'playing');
  assert.equal(g.state.enemies.length, 8);
  steps(g, 600);
});

test('pause: nothing advances while paused or during the 3-second resume countdown', () => {
  const g = playing(3);
  g.setHeld(DOWN);
  steps(g, 5);
  g.pause();
  const snap = g.snapshot();
  steps(g, 500);
  assert.equal(g.snapshot(), snap);
  g.resume();
  steps(g, COUNTDOWN_STEPS);
  assert.equal(g.snapshot(), snap);
  g.step();
  assert.notEqual(g.snapshot(), snap);
});

test('quit returns to the start screen', () => {
  const g = playing(3);
  g.pause();
  g.quit();
  assert.equal(g.phase, 'start');
});

test('game over: shown after the last life, input ignored for 1 s, then back to start', () => {
  const g = playing(3);
  g.state.lives = 1;
  blank(g);
  addEnemy(g, 'gloop', 6, 8);
  g.step();
  stepUntil(g, () => g.phase === 'gameOver', 300);
  assert.ok(types(events(g)).includes('gameOver'));
  g.confirm();
  assert.equal(g.phase, 'gameOver', 'stray tap ignored');
  steps(g, GAME_OVER_LOCK_STEPS);
  g.confirm();
  assert.equal(g.phase, 'start');
});

test('determinism: same seed and inputs give identical states for 3,000 steps', () => {
  const plan = new Map([[150, DOWN], [260, RIGHT], [330, NONE], [340, 'pump'], [420, LEFT], [600, UP], [700, 'pump'], [900, RIGHT], [1200, DOWN], [1500, LEFT], [1800, 'pump'], [2100, UP]]);
  const run = () => {
    const g = createGame({ seed: 1234 });
    g.newGame();
    const out = [];
    for (let t = 0; t < 3000; t++) {
      const a = plan.get(t);
      if (a === 'pump') tap(g); else if (a !== undefined) g.setHeld(a);
      if (g.phase === 'gameOver' || g.phase === 'start') g.confirm();
      g.step();
      out.push(g.snapshot());
    }
    return out;
  };
  assert.deepEqual(run(), run());
});
