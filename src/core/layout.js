// Seeded level generator: start shaft, one 3-tile burrow per enemy, boulders.
// The layout depends only on (seed, level), never on RNG used during play.
import {
  COLS, SHAFT_COL, SHAFT_TOP, SHAFT_BOTTOM, START_TILE, DIRT_BOTTOM,
} from './constants.js';
import { createRng } from './rng.js';
import { getLevel } from './levels.js';

const BURROW_TOP = 3;
const BOULDER_TOP = 3;
const BOULDER_BOTTOM = 15;

export const shaftTiles = () => {
  const out = [];
  for (let y = SHAFT_TOP; y <= SHAFT_BOTTOM; y++) out.push([SHAFT_COL, y]);
  return out;
};

const key = (x, y) => y * COLS + x;

/**
 * @returns {{ seed:number, level:number, shaft:number[][], start:{x,y},
 *   burrows:{tiles:number[][], start:number[], kind:string}[], boulders:number[][] }}
 */
export function generateLevel(seed, level) {
  const lvl = getLevel(level);
  const rng = createRng(((seed >>> 0) ^ Math.imul(level, 0x9e3779b1)) >>> 0);
  for (let attempt = 0; attempt < 500; attempt++) {
    const out = tryGenerate(rng, lvl);
    if (out) return { seed, level, shaft: shaftTiles(), start: { ...START_TILE }, ...out };
  }
  throw new Error(`could not generate level ${level}`);
}

function tryGenerate(rng, lvl) {
  const shaft = shaftTiles();
  const keepOut = new Set();     // tiles no new burrow may use (burrows + 1-tile ring)
  const used = new Set(shaft.map(([x, y]) => key(x, y)));
  const burrows = [];

  // Enemy kinds: Sizzlers spread through the list.
  const kinds = [];
  for (let i = 0; i < lvl.enemies; i++) kinds.push('gloop');
  for (let s = 0; s < lvl.sizzlers; s++) kinds[Math.floor(((s + 0.5) * lvl.enemies) / lvl.sizzlers)] = 'sizzler';

  for (const kind of kinds) {
    let placed = null;
    for (let t = 0; t < 200 && !placed; t++) {
      const horiz = rng.next() < 0.5;
      const x0 = rng.int(horiz ? COLS - 2 : COLS);
      const y0 = BURROW_TOP + rng.int(horiz ? DIRT_BOTTOM - BURROW_TOP + 1 : DIRT_BOTTOM - BURROW_TOP - 1);
      const tiles = [0, 1, 2].map((i) => (horiz ? [x0 + i, y0] : [x0, y0 + i]));
      if (tiles.every(([x, y]) => burrowOk(x, y, keepOut, shaft))) placed = tiles;
    }
    if (!placed) return null;
    for (const [x, y] of placed) {
      used.add(key(x, y));
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) keepOut.add(key(x + dx, y + dy));
    }
    burrows.push({ tiles: placed, start: placed[1], kind });
  }

  const boulders = [];
  const isBoulder = (x, y) => boulders.some(([bx, by]) => bx === x && by === y);
  for (let i = 0; i < lvl.boulders; i++) {
    let ok = false;
    for (let t = 0; t < 300 && !ok; t++) {
      const x = rng.int(COLS);
      const y = BOULDER_TOP + rng.int(BOULDER_BOTTOM - BOULDER_TOP + 1);
      if (used.has(key(x, y)) || used.has(key(x, y + 1))) continue;
      if (keepOut.has(key(x, y)) || x === SHAFT_COL) continue;
      if (isBoulder(x, y) || isBoulder(x, y - 1) || isBoulder(x, y + 1)) continue;
      boulders.push([x, y]);
      ok = true;
    }
    if (!ok) return null;
  }
  return { burrows, boulders };
}

function burrowOk(x, y, keepOut, shaft) {
  if (x < 0 || x >= COLS || y < BURROW_TOP || y > DIRT_BOTTOM) return false;
  if (keepOut.has(key(x, y))) return false;
  for (const [sx, sy] of shaft) if (Math.max(Math.abs(sx - x), Math.abs(sy - y)) < 3) return false;
  return true;
}

/** Checks every dirt-board layout rule. Returns a list of problems (empty = valid). */
export function validateLayout(L) {
  const errs = [];
  const open = new Set([...L.shaft, ...L.burrows.flatMap((b) => b.tiles)].map(([x, y]) => key(x, y)));
  const shaftOk = L.shaft.length === SHAFT_BOTTOM - SHAFT_TOP + 1 && L.shaft.every(([x, y], i) => x === SHAFT_COL && y === SHAFT_TOP + i);
  if (!shaftOk) errs.push('shaft');
  if (L.start.x !== SHAFT_COL || L.start.y !== SHAFT_BOTTOM) errs.push('start');
  const lvl = getLevel(L.level);
  if (L.burrows.length !== lvl.enemies) errs.push('enemy count');
  if (L.burrows.filter((b) => b.kind === 'sizzler').length !== lvl.sizzlers) errs.push('sizzler count');
  L.burrows.forEach((b, i) => {
    const t = b.tiles;
    const straight = t.length === 3 && (
      t.every(([x, y], j) => x === t[0][0] && y === t[0][1] + j)
      || t.every(([x, y], j) => y === t[0][1] && x === t[0][0] + j));
    if (!straight) errs.push(`burrow ${i} not straight`);
    for (const [x, y] of t) {
      if (y < BURROW_TOP || y > DIRT_BOTTOM || x < 0 || x >= COLS) errs.push(`burrow ${i} out of rows`);
      for (const [sx, sy] of L.shaft) if (Math.max(Math.abs(sx - x), Math.abs(sy - y)) < 3) errs.push(`burrow ${i} near shaft`);
    }
    if (b.start[0] !== t[1][0] || b.start[1] !== t[1][1]) errs.push(`burrow ${i} start`);
    L.burrows.forEach((o, j) => {
      if (j <= i) return;
      for (const [x, y] of t) for (const [ox, oy] of o.tiles) if (Math.abs(x - ox) + Math.abs(y - oy) <= 1) errs.push(`burrows ${i},${j} touch`);
    });
  });
  for (const [x, y] of L.boulders) {
    if (y < BOULDER_TOP || y > BOULDER_BOTTOM) errs.push(`boulder ${x},${y} row`);
    if (open.has(key(x, y)) || open.has(key(x, y + 1))) errs.push(`boulder ${x},${y} not on solid dirt`);
    if (L.boulders.some(([ox, oy]) => ox === x && Math.abs(oy - y) === 1)) errs.push(`boulders stacked at ${x}`);
  }
  if (L.boulders.length !== lvl.boulders) errs.push('boulder count');
  return errs;
}
