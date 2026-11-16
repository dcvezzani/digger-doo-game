import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playing, blank, open, row, col, addEnemy, steps, stepUntil, tap, events, types, center } from './helpers.js';
import { UP, LEFT, DOWN, RIGHT } from '../src/core/constants.js';
import { chooseDir, CHARGE_STEPS, GHOST_MIN_STEPS, GHOST_GRACE_STEPS } from '../src/core/enemies.js';
import { boldLevel } from '../src/core/game.js';
import { getLevel } from '../src/core/levels.js';
import { createRng } from '../src/core/rng.js';
import { isOpen } from '../src/core/board.js';
import { tileOf } from '../src/core/movement.js';

const ctxFor = (g, doo, chase = 1) => ({
  board: g.state.board, rng: createRng(1), lvl: { ...g.state.lvl, chase },
  doo, blocked: () => false,
});

test('stays in its burrow until it turns into a ghost', () => {
  const g = blank(playing(), { px: 1, py: 3 });
  const e = addEnemy(g, 'gloop', 10, 12, RIGHT);
  open(g, row(12, 9, 11));
  for (let i = 0; i < 400; i++) {
    g.step();
    assert.equal(tileOf(e.y), 12);
    assert.ok(tileOf(e.x) >= 9 && tileOf(e.x) <= 11);
  }
  assert.equal(e.state, 'roam');
});

test('chases through a connected tunnel: picks the option closest to Doo', () => {
  const g = blank(playing(), { px: 1, py: 10 });
  open(g, [[5, 9], [5, 10], [4, 10], [6, 10], [5, 11]]);
  const e = addEnemy(g, 'gloop', 5, 10, DOWN);
  assert.equal(chooseDir(e, ctxFor(g, { tx: 1, ty: 10 })), LEFT);
  assert.equal(chooseDir(e, ctxFor(g, { tx: 12, ty: 10 })), RIGHT);
});

test('tie order up, left, down, right at equal distance', () => {
  const g = blank(playing(), { px: 1, py: 1 });
  open(g, [[5, 9], [5, 10], [4, 10], [6, 10], [5, 11]]);
  const e = addEnemy(g, 'gloop', 5, 10, RIGHT);
  // Doo straight below at distance: down is closest; with Doo at same distance from up and left choose up.
  assert.equal(chooseDir(e, ctxFor(g, { tx: 4, ty: 9 })), UP);
});

test('never reverses voluntarily', () => {
  const g = blank(playing(), { px: 1, py: 1 });
  open(g, row(10, 3, 7));
  const e = addEnemy(g, 'gloop', 5, 10, RIGHT);
  assert.equal(chooseDir(e, ctxFor(g, { tx: 0, ty: 10 })), RIGHT);
});

test('ghost: drifts through dirt to a disconnected tunnel and becomes solid over an open tile', () => {
  const g = blank(playing(), { px: 2, py: 4 });
  open(g, row(4, 0, 4));
  const e = addEnemy(g, 'gloop', 10, 13, RIGHT, { ghostTimer: 1 });
  open(g, row(13, 9, 11));
  g.step();
  assert.equal(e.state, 'ghost');
  const n = stepUntil(g, () => e.state !== 'ghost', 2000);
  assert.ok(n >= GHOST_MIN_STEPS - 1);
  assert.equal(e.state, 'roam');
  assert.ok(isOpen(g.state.board, tileOf(e.x), tileOf(e.y)));
  assert.equal(tileOf(e.y), 4, 're-formed in Doo\'s tunnel');
  assert.equal(e.x % 256, 128); assert.equal(e.y % 256, 128);
});

test('ghost is harmless before it becomes solid', () => {
  const g = blank(playing());
  const e = addEnemy(g, 'gloop', 6, 8, RIGHT);
  e.state = 'ghost';
  e.ghostSteps = 0;
  steps(g, GHOST_MIN_STEPS - 2);
  assert.equal(g.phase, 'playing');
});

test('ghost timer never runs out in the first 3 seconds of a round', () => {
  const g = blank(playing(), { px: 1, py: 3 });
  const e = addEnemy(g, 'gloop', 10, 12, RIGHT, { ghostTimer: 1 });
  g.state.roundTick = 0;
  steps(g, GHOST_GRACE_STEPS - 2);
  assert.equal(e.state, 'roam');
  steps(g, 3);
  assert.equal(e.state, 'ghost');
});

test('Sizzler flame: warns for 0.6 s, then burns through dirt and Doo loses a life', () => {
  const g = blank(playing(), { px: 7, py: 10 });
  g.state.lvl = { ...g.state.lvl, flame: 1 };
  const e = addEnemy(g, 'sizzler', 5, 10, UP);
  g.step();
  assert.equal(e.state, 'charge');
  assert.equal(e.dir, RIGHT);
  events(g);
  for (let i = 1; i < CHARGE_STEPS; i++) { g.step(); assert.ok(!types(events(g)).includes('flame')); }
  g.step();
  assert.equal(g.phase, 'dying');
  assert.equal(g.state.deathCause, 'flame');
  assert.deepEqual(e.flameTiles, [[6, 10], [7, 10], [8, 10]]);
});

test('Sizzler flame is cancelled by inflation', () => {
  const g = blank(playing(), { px: 8, py: 10 });
  g.state.lvl = { ...g.state.lvl, flame: 1, roamSpeed: 0 };
  open(g, row(10, 5, 8));
  const e = addEnemy(g, 'sizzler', 6, 10, UP);
  g.step();
  assert.equal(e.state, 'charge');
  g.state.player.dir = LEFT;
  tap(g);
  stepUntil(g, () => e.state === 'inflated', 10);
  assert.equal(e.flameTiles, null);
  stepUntil(g, () => e.state !== 'inflated', 200);
  assert.equal(e.state, 'roam');
  assert.equal(g.phase, 'playing');
});

test('the last enemy flees: waits, rises to the surface, walks to the nearer (right) edge and escapes; the level ends', () => {
  const g = blank(playing(), { px: 6, py: 8, anchor: false });
  const gone = addEnemy(g, 'gloop', 0, 16);
  gone.state = 'gone';
  const e = addEnemy(g, 'gloop', 11, 14, LEFT);
  g.step();
  assert.ok(e.flee);
  assert.ok(types(events(g)).includes('fleeStart'));
  stepUntil(g, () => e.state === 'fleeUp', 100);
  stepUntil(g, () => e.state === 'fleeWalk', 1000);
  assert.equal(e.y, center(1));
  assert.equal(e.dir, RIGHT, 'column 11 is nearer the right edge');
  stepUntil(g, () => e.state === 'escaped', 1000);
  assert.ok(e.x > 14 * 256);
  g.step();
  assert.equal(g.phase, 'levelClear');
  assert.ok(types(events(g)).includes('fleeEnd'));
});

test('fleeing: ghost eyes only over solid dirt, solid in an open shaft', () => {
  const g = blank(playing(), { px: 10, py: 14, anchor: false });
  const gone = addEnemy(g, 'gloop', 0, 16);
  gone.state = 'gone';
  // burrow at row 12, solid dirt rows 9-11, then an open shaft rows 2-8 in column 3
  const e = addEnemy(g, 'gloop', 3, 12, UP);
  open(g, col(3, 2, 8));
  const forms = [];
  stepUntil(g, () => {
    const ty = tileOf(e.y);
    if (e.state === 'fleeUp' || e.state === 'fleeRise') forms.push([ty, e.state]);
    return e.state === 'fleeWalk';
  }, 2000);
  const inDirt = forms.filter(([y]) => y >= 9 && y <= 11).map(([, s]) => s);
  const inShaft = forms.filter(([y]) => y >= 2 && y <= 8).map(([, s]) => s);
  assert.ok(inDirt.length && inDirt.every((s) => s === 'fleeUp'), 'ghost in the dirt');
  assert.ok(inShaft.length && inShaft.every((s) => s === 'fleeRise'), 'solid in the open shaft');
});

test('fleeing: a solid riser in an open shaft can be hooked and resumes rising after recovering', () => {
  const g = blank(playing(), { px: 3, py: 2, anchor: false });
  const gone = addEnemy(g, 'gloop', 0, 16);
  gone.state = 'gone';
  const e = addEnemy(g, 'gloop', 3, 9, UP);
  open(g, col(3, 2, 9));
  g.state.player.dir = DOWN;
  stepUntil(g, () => e.state === 'fleeRise' && tileOf(e.y) <= 5, 400);
  tap(g);
  stepUntil(g, () => e.state === 'inflated', 20);
  assert.equal(e.resume, 'fleeRise');
  stepUntil(g, () => e.state !== 'inflated', 200);
  assert.equal(e.state, 'fleeRise');
});

test('a last enemy in column 3 walks left along the surface', () => {
  const g = blank(playing(), { px: 10, py: 12, anchor: false });
  const gone = addEnemy(g, 'gloop', 0, 16);
  gone.state = 'gone';
  const e = addEnemy(g, 'gloop', 3, 14, LEFT);
  stepUntil(g, () => e.state === 'fleeWalk', 1500);
  assert.equal(e.dir, LEFT);
  const x = e.x;
  steps(g, 10);
  assert.ok(e.x < x);
});

test('ghost becomes solid along the way: crossing dirt into another tunnel', () => {
  const g = blank(playing(), { px: 2, py: 4 });
  open(g, row(4, 0, 4));
  open(g, row(9, 3, 9)); // a tunnel between the enemy and Doo
  const e = addEnemy(g, 'gloop', 9, 13, LEFT, { ghostTimer: 1 });
  open(g, row(13, 8, 10));
  g.step();
  assert.equal(e.state, 'ghost');
  stepUntil(g, () => e.state !== 'ghost', 2000);
  assert.equal(tileOf(e.y), 9, 'solid in the tunnel it crossed, not Doo\'s');
});

test('enemies grow bolder once half or fewer remain', () => {
  const g = blank(playing(), { px: 1, py: 3, anchor: false });
  const es = [0, 1, 2, 3].map((i) => addEnemy(g, 'gloop', 2 + i * 3, 12, RIGHT));
  const base = g.state.lvl;
  assert.equal(boldLevel(g.state), base);
  es[0].state = 'gone'; es[1].state = 'popped';
  const bold = boldLevel(g.state);
  assert.equal(bold.roamSpeed, Math.round(base.roamSpeed * 1.15));
  assert.ok(Math.abs(bold.chase - (base.chase + 0.15)) < 1e-9);
  // and it shows in movement: a remaining enemy covers more ground per second
  open(g, row(14, 0, 13));
  const run = (gg) => { const e = gg.state.enemies[3]; e.x = center(0); e.y = center(14); e.dir = RIGHT; e.acc = 0; steps(gg, 60); return e.x; };
  const fast = run(g);
  es[0].state = 'roam'; es[1].state = 'roam';
  const slow = run(g);
  assert.ok(fast > slow, `${fast} > ${slow}`);
});

test('popping the fleeing enemy ends the level', () => {
  const g = blank(playing(), { px: 6, py: 8, anchor: false });
  g.state.lvl = { ...g.state.lvl, roamSpeed: 0 };
  open(g, row(8, 3, 6));
  const gone = addEnemy(g, 'gloop', 0, 16);
  gone.state = 'gone';
  const e = addEnemy(g, 'gloop', 4, 8, LEFT);
  g.state.player.dir = LEFT;
  g.pump(true);
  stepUntil(g, () => e.state === 'popped', 200);
  g.pump(false);
  stepUntil(g, () => g.phase === 'levelClear', 100);
  void col;
});

test('enemy speeds rise with level and stop at their limits', () => {
  assert.ok(getLevel(5).roamSpeed > getLevel(1).roamSpeed);
  assert.equal(getLevel(1).roamPct, 70); assert.equal(getLevel(1).ghostPct, 55); assert.equal(getLevel(1).fleePct, 110);
  assert.equal(getLevel(20).roamPct, 95); assert.equal(getLevel(20).ghostPct, 75);
});

test('touching a roaming Gloop costs a life; an inflated one does not', () => {
  const g = blank(playing());
  open(g, row(8, 6, 9));
  addEnemy(g, 'gloop', 9, 8, LEFT);
  stepUntil(g, () => g.phase === 'dying', 200);
  assert.equal(g.state.deathCause, 'enemy');
  const h = blank(playing());
  const e = addEnemy(h, 'gloop', 6, 8);
  e.state = 'inflated'; e.stage = 2; e.lastPump = h.state.tick;
  steps(h, 20);
  assert.equal(h.phase, 'playing');
});
