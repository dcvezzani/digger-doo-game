// Doo: moves only while a direction is held, along tile center lines.
// Perpendicular turns happen at tile centers; reversal is immediate.
// Digging (front of the body entering dirt) is slower than walking.
import {
  UNITS, SUB_UNITS, DX, DY, NONE, RIGHT, DOWN, START_TILE, WALK_SPEED, DIG_FACTOR, center, isHorizontal,
} from './constants.js';
import { inBoard, carveBody, bodyHasDirt } from './board.js';
import { tileOf, isCentered, distToNextCenter, takeUnits } from './movement.js';

export function createPlayer() {
  const p = { x: 0, y: 0, dir: RIGHT, moving: false, digging: false, acc: 0, walked: 0 };
  resetPlayer(p);
  return p;
}

export function resetPlayer(p) {
  p.x = center(START_TILE.x);
  p.y = center(START_TILE.y);
  p.dir = RIGHT;
  p.moving = false;
  p.digging = false;
  p.acc = 0;
}

/** Direction Doo would actually move this step for a held direction (or NONE). */
export function chooseMove(p, held, blocked) {
  if (held === NONE) return NONE;
  const cx = isCentered(p.x), cy = isCentered(p.y);
  if (cx && cy) {
    const tx = tileOf(p.x) + DX[held], ty = tileOf(p.y) + DY[held];
    return inBoard(tx, ty) && !blocked(tx, ty) ? held : NONE;
  }
  const onHorizontal = cy; // off-center in x => moving along a row
  if (isHorizontal(held) === onHorizontal) return held;
  // Perpendicular request between centers: keep going to the next center.
  return isHorizontal(p.dir) === onHorizontal ? p.dir : (onHorizontal ? RIGHT : DOWN);
}

/**
 * Advance Doo one step.
 * @param {(tx:number, ty:number)=>boolean} blocked tiles Doo may not enter (boulders)
 * @returns {number[][]} tiles that became fully open through digging this step
 */
export function updatePlayer(p, board, held, blocked, walkSpeed = WALK_SPEED) {
  const first = chooseMove(p, held, blocked);
  if (first === NONE) {
    if (held !== NONE) p.dir = held; // face the way the player is pushing
    p.moving = false;
    p.digging = false;
    return [];
  }
  const ahead = bodyHasDirt(board, p.x + DX[first] * SUB_UNITS, p.y + DY[first] * SUB_UNITS);
  p.digging = ahead;
  const speed = ahead ? Math.round(walkSpeed * DIG_FACTOR) : walkSpeed;
  let rem = takeUnits(p, speed);
  const opened = [];
  let guard = 8;
  while (rem > 0 && guard-- > 0) {
    const d = chooseMove(p, held, blocked);
    if (d === NONE) { p.dir = held; break; }
    const sign = isHorizontal(d) ? DX[d] : DY[d];
    const along = isHorizontal(d) ? p.x : p.y;
    const dist = distToNextCenter(along, sign);
    const step = Math.min(rem, dist, UNITS);
    if (isHorizontal(d)) p.x += DX[d] * step; else p.y += DY[d] * step;
    p.dir = d;
    rem -= step;
    p.walked += step;
    for (const t of carveBody(board, p.x, p.y)) opened.push(t);
  }
  p.moving = true;
  return opened;
}
