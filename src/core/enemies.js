// Gloops and Sizzlers: roam tunnels, drift through dirt as ghost eyes,
// Sizzlers breathe flame, and the last enemy flees to the surface.
import {
  COLS, UNITS, DX, DY, DIRS, NONE, UP, LEFT, RIGHT, SURFACE_ROW, DIRT_TOP, DIRT_BOTTOM,
  center, opposite, isHorizontal, secs,
} from './constants.js';
import { isOpen } from './board.js';
import { tileOf, atCenter, distToNextCenter, takeUnits } from './movement.js';

export const GHOST_MIN_STEPS = secs(1.5);
export const GHOST_GRACE_STEPS = secs(3);
export const GHOST_JITTER_STEPS = secs(2);
export const CHARGE_STEPS = secs(0.6);
export const FIRE_STEPS = secs(0.5);
export const FLAME_COOLDOWN_STEPS = secs(3);
export const FLAME_RANGE = 4;
export const FLAME_TILES = 3;
export const FLEE_WAIT_STEPS = secs(1);
export const POP_STEPS = secs(0.5);
export const FLEE_SPLIT_COL = 6;        // columns 0-6 flee left, 7-13 flee right
export const BOLD_SPEED = 1.15;         // roam speed factor once half the enemies are gone
export const BOLD_CHASE = 0.15;
const ROLL_GAP_STEPS = secs(0.5); // after a failed flame roll, wait before rolling again

/** States in which an enemy is solid: it can be hooked and crushed. */
export const SOLID = new Set(['roam', 'charge', 'fire', 'fleeWalk', 'inflated']);
/** States in which touching the enemy costs Doo a life. */
export const HARMFUL = new Set(['roam', 'charge', 'fire', 'fleeWalk']);
/** States that no longer count as a remaining enemy. */
export const DONE = new Set(['popped', 'crushed', 'gone', 'escaped']);

export function createEnemy(id, kind, tx, ty, dir = UP) {
  return {
    id, kind, homeX: tx, homeY: ty, homeDir: dir,
    x: center(tx), y: center(ty), dir, acc: 0,
    state: 'roam', resume: 'roam', stage: 0, lastPump: 0,
    ghostTimer: 0, ghostSteps: 0, flameCooldown: 0, timer: 0, flameTiles: null,
    flee: false, fleeWait: 0, fleeDir: LEFT, crossedDirt: false,
  };
}

export function resetEnemy(e, rng, lvl) {
  e.x = center(e.homeX); e.y = center(e.homeY); e.dir = e.homeDir; e.acc = 0;
  e.state = 'roam'; e.resume = 'roam'; e.stage = 0;
  e.ghostSteps = 0; e.flameCooldown = 0; e.timer = 0; e.flameTiles = null;
  e.ghostTimer = lvl.ghostSteps + rng.int(GHOST_JITTER_STEPS + 1);
  e.fleeWait = FLEE_WAIT_STEPS;
}

const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;

/** Open, boulder-free neighbor directions of tile (tx, ty) within rows 2-16. */
export function roamOptions(board, tx, ty, blocked) {
  const out = [];
  for (const d of DIRS) {
    const nx = tx + DX[d], ny = ty + DY[d];
    if (ny < DIRT_TOP || ny > DIRT_BOTTOM || nx < 0 || nx >= COLS) continue;
    if (!isOpen(board, nx, ny) || blocked(nx, ny)) continue;
    out.push(d);
  }
  return out;
}

/** Direction choice at a tile center (spec: enemy-ai "Roaming tunnels"). */
export function chooseDir(e, ctx) {
  const tx = tileOf(e.x), ty = tileOf(e.y);
  const all = roamOptions(ctx.board, tx, ty, ctx.blocked);
  if (all.length === 0) return NONE;
  const rev = opposite(e.dir);
  const opts = all.length > 1 ? all.filter((d) => d !== rev) : all;
  if (opts.length === 1) return opts[0];
  if (ctx.rng.next() < ctx.lvl.chase) {
    let best = opts[0], bd = Infinity;
    for (const d of opts) { // DIRS order gives the up/left/down/right tie-break
      const v = dist2(tx + DX[d], ty + DY[d], ctx.doo.tx, ctx.doo.ty);
      if (v < bd) { bd = v; best = d; }
    }
    return best;
  }
  return opts[ctx.rng.int(opts.length)];
}

function tryFlame(e, ctx) {
  if (e.kind !== 'sizzler' || e.flee || e.flameCooldown > 0) return false;
  const ty = tileOf(e.y), tx = tileOf(e.x);
  const dx = ctx.doo.tx - tx;
  if (ctx.doo.ty !== ty || dx === 0 || Math.abs(dx) > FLAME_RANGE) return false;
  if (ctx.rng.next() >= ctx.lvl.flame) { e.flameCooldown = ROLL_GAP_STEPS; return false; }
  e.state = 'charge';
  e.timer = CHARGE_STEPS;
  e.dir = dx < 0 ? LEFT : RIGHT;
  ctx.emit('charge', { enemy: e.id });
  return true;
}

export function flameTilesFor(e) {
  const tx = tileOf(e.x), ty = tileOf(e.y);
  const out = [];
  for (let i = 1; i <= FLAME_TILES; i++) {
    const x = tx + DX[e.dir] * i;
    if (x < 0 || x >= COLS) break;
    out.push([x, ty]);
  }
  return out;
}

function roam(e, speed, ctx) {
  if (atCenter(e) && tryFlame(e, ctx)) return;
  let rem = takeUnits(e, speed);
  let guard = 8;
  let first = true;
  while (rem > 0 && guard-- > 0) {
    if (atCenter(e)) {
      if (!first && tryFlame(e, ctx)) return;
      const d = chooseDir(e, ctx);
      if (d === NONE) { e.acc = 0; return; }
      e.dir = d;
    }
    const sign = isHorizontal(e.dir) ? DX[e.dir] : DY[e.dir];
    const step = Math.min(rem, distToNextCenter(isHorizontal(e.dir) ? e.x : e.y, sign));
    if (isHorizontal(e.dir)) e.x += sign * step; else e.y += sign * step;
    rem -= step;
    first = false;
  }
}

/** Move straight toward (tx, ty) by up to `units`. Returns true on arrival. */
function drift(e, tx, ty, units) {
  const dx = tx - e.x, dy = ty - e.y;
  const d = Math.hypot(dx, dy);
  if (d <= units) { e.x = tx; e.y = ty; return true; }
  e.x += Math.round((dx * units) / d);
  e.y += Math.round((dy * units) / d);
  if (Math.abs(dx) >= Math.abs(dy)) e.dir = dx < 0 ? LEFT : RIGHT; else e.dir = dy < 0 ? UP : 2;
  return false;
}

export function becomeGhost(e, ctx) {
  e.state = 'ghost';
  e.ghostSteps = 0;
  e.crossedDirt = false;
  ctx.emit('ghost', { enemy: e.id });
}

function ghost(e, ctx) {
  e.ghostSteps += 1;
  drift(e, ctx.doo.x, ctx.doo.y, takeUnits(e, ctx.lvl.ghostSpeed));
  e.x = Math.max(center(0), Math.min(center(COLS - 1), e.x));
  e.y = Math.max(center(DIRT_TOP), Math.min(center(DIRT_BOTTOM), e.y));
  const tx = tileOf(e.x), ty = tileOf(e.y);
  if (ty >= DIRT_TOP && !isOpen(ctx.board, tx, ty)) { e.crossedDirt = true; return; }
  if (ty < DIRT_TOP || ctx.blocked(tx, ty)) return; // boulders don't count as dirt
  // Solid again at the first open tile after crossing dirt (destination or
  // along the way); a ghost that never crossed dirt waits for the fallback.
  if (e.crossedDirt || e.ghostSteps >= GHOST_MIN_STEPS) {
    e.x = center(tx); e.y = center(ty);
    e.state = 'roam';
    e.acc = 0;
    e.ghostTimer = ctx.lvl.ghostSteps + ctx.rng.int(GHOST_JITTER_STEPS + 1);
    ctx.emit('solid', { enemy: e.id });
  }
}

/** Advance one enemy by one step. */
export function updateEnemy(e, ctx) {
  if (e.flameCooldown > 0) e.flameCooldown -= 1;
  switch (e.state) {
    case 'roam':
      if (e.flee) {
        if (--e.fleeWait <= 0) { e.state = 'fleeUp'; e.acc = 0; ctx.emit('ghost', { enemy: e.id }); return; }
      } else if (--e.ghostTimer <= 0 && ctx.roundTick >= GHOST_GRACE_STEPS) {
        becomeGhost(e, ctx);
        return;
      }
      roam(e, ctx.lvl.roamSpeed, ctx);
      return;
    case 'ghost':
      ghost(e, ctx);
      return;
    case 'charge':
      if (--e.timer <= 0) {
        e.state = 'fire';
        e.timer = FIRE_STEPS;
        e.flameTiles = flameTilesFor(e);
        ctx.emit('flame', { enemy: e.id });
      }
      return;
    case 'fire':
      if (--e.timer <= 0) {
        e.state = 'roam';
        e.flameTiles = null;
        e.flameCooldown = FLAME_COOLDOWN_STEPS;
      }
      return;
    case 'fleeUp': {
      const arrived = drift(e, e.x, center(SURFACE_ROW), takeUnits(e, ctx.lvl.ghostSpeed));
      if (arrived) {
        e.x = center(Math.max(0, Math.min(COLS - 1, tileOf(e.x))));
        e.state = 'fleeWalk';
        e.dir = tileOf(e.x) <= FLEE_SPLIT_COL ? LEFT : RIGHT; // nearer side edge
        e.fleeDir = e.dir;
        e.acc = 0;
        ctx.emit('solid', { enemy: e.id });
      }
      return;
    }
    case 'fleeWalk':
      e.dir = e.fleeDir ?? LEFT;
      e.x += DX[e.dir] * takeUnits(e, ctx.lvl.fleeSpeed);
      if (e.x < -UNITS / 2 || e.x > COLS * UNITS + UNITS / 2) { e.state = 'escaped'; ctx.emit('escaped', { enemy: e.id }); }
      return;
    case 'popped':
      if (--e.timer <= 0) e.state = 'gone';
      return;
    default:
      return; // inflated (handled by the pump), crushed (carried), gone, escaped
  }
}

/** Inflate a hooked enemy one stage (or hook it at stage 1). */
export function inflate(e, tick) {
  if (e.state !== 'inflated') {
    e.resume = e.flee ? (e.state === 'fleeWalk' ? 'fleeWalk' : 'roam') : 'roam';
    e.state = 'inflated';
    e.stage = 0;
    e.flameTiles = null;
    e.timer = 0;
  }
  e.stage += 1;
  e.lastPump = tick;
  return e.stage;
}

/** Deflation: one stage per `steps` without a pump. Returns true when recovered. */
export function deflate(e, tick, steps) {
  if (e.state !== 'inflated' || tick - e.lastPump < steps) return false;
  e.stage -= 1;
  e.lastPump = tick;
  if (e.stage > 0) return false;
  e.state = e.resume;
  if (e.state === 'roam' && e.flee) e.fleeWait = FLEE_WAIT_STEPS;
  e.acc = 0;
  return true;
}
