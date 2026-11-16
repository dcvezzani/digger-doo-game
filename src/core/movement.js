// Shared movement helpers for grid-aligned entities. Positions are integer
// units of the entity's center; speeds are milli-units per step.
import { UNITS, HALF } from './constants.js';

export const tileOf = (u) => Math.floor(u / UNITS);
const mod = (u) => ((u % UNITS) + UNITS) % UNITS;
export const isCentered = (u) => mod(u) === HALF;
export const atCenter = (e) => isCentered(e.x) && isCentered(e.y);

/** Distance (units) from u to the next tile center in direction sign (+1/-1). */
export function distToNextCenter(u, sign) {
  const m = mod(u);
  if (m === HALF) return UNITS;
  return sign > 0 ? (m < HALF ? HALF - m : UNITS + HALF - m) : (m > HALF ? m - HALF : m + HALF);
}

/** Whole units an entity may move this step at `speed` (milli-units per step). */
export function takeUnits(e, speed) {
  e.acc += speed;
  const n = Math.floor(e.acc / 1000);
  e.acc -= n * 1000;
  return n;
}
