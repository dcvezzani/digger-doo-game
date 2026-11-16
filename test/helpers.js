// Test helpers: build a game in the playing phase, then reshape its board,
// enemies and boulders so each rule can be checked in isolation.
import { createGame, READY_STEPS } from '../src/core/game.js';
import { resetBoard, openTile } from '../src/core/board.js';
import { createEnemy } from '../src/core/enemies.js';
import { createBoulder } from '../src/core/boulders.js';
import { center, NONE } from '../src/core/constants.js';

export function playing(seed = 7) {
  const g = createGame({ seed });
  g.newGame();
  for (let i = 0; i < READY_STEPS; i++) g.step();
  if (g.phase !== 'playing') throw new Error(`expected playing, got ${g.phase}`);
  g.drainEvents();
  return g;
}

/**
 * Solid board (surface open), no boulders, Doo at (px, py), and a harmless
 * "anchor" enemy sealed in the far bottom-left corner so the level never ends
 * by itself. Pass anchor:false for no enemies at all.
 */
export function blank(g, { px = 6, py = 8, anchor = true } = {}) {
  const s = g.state;
  resetBoard(s.board);
  s.boulders = [];
  s.enemies = [];
  s.fleeing = null;
  s.gem = null;
  s.player.x = center(px);
  s.player.y = center(py);
  s.player.acc = 0;
  openTile(s.board, px, py);
  if (anchor) addEnemy(g, 'gloop', 0, 16);
  s.roundTick = 1000; // past the ghost grace period
  return g;
}

export function open(g, tiles) { for (const [x, y] of tiles) openTile(g.state.board, x, y); }
export function row(y, x0, x1) { const t = []; for (let x = x0; x <= x1; x++) t.push([x, y]); return t; }
export function col(x, y0, y1) { const t = []; for (let y = y0; y <= y1; y++) t.push([x, y]); return t; }

export function addEnemy(g, kind, tx, ty, dir = 0, { ghostTimer = 1e9 } = {}) {
  const s = g.state;
  openTile(s.board, tx, ty);
  const e = createEnemy(s.enemies.length, kind, tx, ty, dir);
  e.ghostTimer = ghostTimer;
  e.fleeWait = 60;
  s.enemies.push(e);
  return e;
}

export function addBoulder(g, tx, ty) {
  const b = createBoulder(tx, ty);
  g.state.boulders.push(b);
  return b;
}

export function steps(g, n) { for (let i = 0; i < n; i++) g.step(); }
export function stepUntil(g, pred, max = 5000) {
  for (let i = 0; i < max; i++) { if (pred()) return i; g.step(); }
  throw new Error('condition not reached');
}
export function tap(g) { g.pump(true); g.pump(false); }
export function events(g) { return g.drainEvents(); }
export const types = (evs) => evs.map((e) => e.type);
export { NONE, center };
