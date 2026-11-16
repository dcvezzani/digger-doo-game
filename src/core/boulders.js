// Boulders: rest -> wobble (0.75 s) -> fall (6 tiles/s) -> crumble (0.5 s) -> gone.
import { UNITS, DIRT_BOTTOM, FALL_SPEED, center, secs } from './constants.js';
import { isOpen, openTile } from './board.js';
import { tileOf, isCentered, takeUnits } from './movement.js';
import { SOLID } from './enemies.js';

export const WOBBLE_STEPS = secs(0.75);
export const CRUMBLE_STEPS = secs(0.5);
export const CRUSH_POINTS = [0, 1000, 2500, 4000, 6000, 8000, 10000, 12000, 15000];
export const crushPoints = (n) => CRUSH_POINTS[Math.min(n, CRUSH_POINTS.length - 1)];
const CRUSH_DX = (UNITS * 3) / 4; // horizontal overlap needed to be hit
const CRUSH_DY = UNITS;          // vertical: touching

export function createBoulder(tx, ty) {
  return { tx, ty, x: center(tx), y: center(ty), state: 'rest', timer: 0, acc: 0, carried: [] };
}

/** True if a resting or wobbling boulder sits in tile (tx, ty). */
export function boulderBlocks(boulders, tx, ty) {
  for (const b of boulders) {
    if ((b.state === 'rest' || b.state === 'wobble') && b.tx === tx && b.ty === ty) return true;
  }
  return false;
}

/** True if any boulder that is not crumbling or gone occupies tile (tx, ty). */
export function boulderInTile(boulders, tx, ty) {
  for (const b of boulders) {
    if (b.state === 'crumble' || b.state === 'gone') continue;
    if (b.tx === tx && tileOf(b.y) === ty) return true;
  }
  return false;
}

/** Does a tile-sized body centered at (x, y) overlap tile (tx, ty)? */
export const bodyOverlapsTile = (x, y, tx, ty) =>
  Math.abs(x - center(tx)) < UNITS && Math.abs(y - center(ty)) < UNITS;

/**
 * Advance every boulder one step.
 * ctx: { board, doo:{x,y}, enemies, emit(type,data), onFall(b), onLand(b), onCrushDoo() }
 */
export function updateBoulders(boulders, ctx) {
  for (const b of boulders) {
    switch (b.state) {
      case 'rest':
        if (isOpen(ctx.board, b.tx, b.ty + 1) && !bodyOverlapsTile(ctx.doo.x, ctx.doo.y, b.tx, b.ty + 1)) {
          b.state = 'wobble';
          b.timer = WOBBLE_STEPS;
          ctx.emit('wobble', { x: b.x, y: b.y });
        }
        break;
      case 'wobble':
        if (--b.timer <= 0) {
          b.state = 'fall';
          b.acc = 0;
          openTile(ctx.board, b.tx, b.ty);
          ctx.onFall(b);
        }
        break;
      case 'fall':
        fall(b, ctx);
        break;
      case 'crumble':
        if (--b.timer <= 0) b.state = 'gone';
        break;
      default:
        break;
    }
  }
}

function fall(b, ctx) {
  let rem = takeUnits(b, FALL_SPEED);
  let landed = false;
  while (rem > 0) {
    const ty = tileOf(b.y);
    if (isCentered(b.y)) {
      if (ty >= DIRT_BOTTOM || !isOpen(ctx.board, b.tx, ty + 1)) { landed = true; break; }
      const step = Math.min(rem, UNITS);
      b.y += step; rem -= step;
    } else {
      const toCenter = center(ty) > b.y ? center(ty) - b.y : center(ty + 1) - b.y;
      const step = Math.min(rem, toCenter);
      b.y += step; rem -= step;
    }
  }
  if (!landed && isCentered(b.y)) {
    const ty = tileOf(b.y);
    if (ty >= DIRT_BOTTOM || !isOpen(ctx.board, b.tx, ty + 1)) landed = true;
  }
  // Crush anything solid in the way.
  for (const e of ctx.enemies) {
    if (!SOLID.has(e.state)) continue;
    if (Math.abs(e.x - b.x) < CRUSH_DX && Math.abs(e.y - b.y) < CRUSH_DY && e.y >= b.y - UNITS / 4) {
      ctx.onCrushEnemy(e, b);
      e.state = 'crushed';
      b.carried.push(e);
    }
  }
  for (const e of b.carried) { e.x = b.x; e.y = b.y + UNITS / 4; }
  if (Math.abs(ctx.doo.x - b.x) < CRUSH_DX && Math.abs(ctx.doo.y - b.y) < CRUSH_DY - 16 && ctx.doo.y >= b.y - UNITS / 4) {
    ctx.onCrushDoo(b);
  }
  if (landed) {
    b.state = 'crumble';
    b.timer = CRUMBLE_STEPS;
    ctx.onLand(b);
  }
}
