// The dirt grid. Dirt is stored as sub-cells (4x4 per tile); a tile is open
// when all 16 of its sub-cells are clear. The surface row is always open.
// Carving pushes changed rectangles (in sub-cells) to `dirty` for the renderer.
import {
  COLS, SUB, SUB_COLS, SUB_ROWS, SUB_UNITS, UNITS, SURFACE_ROW, DIRT_TOP, DIRT_BOTTOM,
} from './constants.js';

const PER_TILE = SUB * SUB;

export function createBoard() {
  const b = {
    cells: new Uint8Array(SUB_COLS * SUB_ROWS),   // 1 = dirt, 0 = clear
    cleared: new Uint8Array(COLS * (DIRT_BOTTOM + 1)), // per-tile clear sub-cell count
    dirty: [],
    rebuild: true,
  };
  resetBoard(b);
  return b;
}

/** Fill every dirt row with dirt; surface (and everything above) clear. */
export function resetBoard(b) {
  b.cells.fill(0);
  b.cleared.fill(0);
  for (let sy = DIRT_TOP * SUB; sy < (DIRT_BOTTOM + 1) * SUB; sy++) {
    b.cells.fill(1, sy * SUB_COLS, (sy + 1) * SUB_COLS);
  }
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < DIRT_TOP; y++) b.cleared[y * COLS + x] = PER_TILE;
  }
  b.dirty.length = 0;
  b.rebuild = true;
}

export const inBoard = (tx, ty) => tx >= 0 && tx < COLS && ty >= SURFACE_ROW && ty <= DIRT_BOTTOM;

/** True when every sub-cell of the tile is clear. Outside the board: false. */
export function isOpen(b, tx, ty) {
  if (!inBoard(tx, ty)) return false;
  return b.cleared[ty * COLS + tx] === PER_TILE;
}

export const isDirtCell = (b, sx, sy) =>
  sx >= 0 && sx < SUB_COLS && sy >= 0 && sy < SUB_ROWS && b.cells[sy * SUB_COLS + sx] === 1;

/**
 * Clear the sub-cells in [sx0, sx1) x [sy0, sy1). Returns the list of tiles that
 * became fully open as a result (as [tx, ty] pairs).
 */
export function clearCells(b, sx0, sy0, sx1, sy1) {
  sx0 = Math.max(0, sx0); sy0 = Math.max(0, sy0);
  sx1 = Math.min(SUB_COLS, sx1); sy1 = Math.min(SUB_ROWS, sy1);
  let opened = null;
  let any = false;
  for (let sy = sy0; sy < sy1; sy++) {
    for (let sx = sx0; sx < sx1; sx++) {
      const i = sy * SUB_COLS + sx;
      if (b.cells[i] !== 1) continue;
      b.cells[i] = 0;
      any = true;
      const t = ((sy / SUB) | 0) * COLS + ((sx / SUB) | 0);
      b.cleared[t] += 1;
      if (b.cleared[t] === PER_TILE) (opened ||= []).push([(sx / SUB) | 0, (sy / SUB) | 0]);
    }
  }
  if (any) {
    if (b.dirty.length > 4096) { b.dirty.length = 0; b.rebuild = true; } // nobody is draining: rebuild later
    b.dirty.push([sx0, sy0, sx1 - sx0, sy1 - sy0]);
  }
  return opened || [];
}

/** Clear a whole tile. Returns true if it became open by this call. */
export function openTile(b, tx, ty) {
  return clearCells(b, tx * SUB, ty * SUB, (tx + 1) * SUB, (ty + 1) * SUB).length > 0;
}

/**
 * Sub-cell span covered by a tile-sized body centered at (x, y) units, shrunk
 * by one unit so a centered body covers exactly its own tile's 4x4 cells.
 */
export function bodyCells(x, y) {
  const h = UNITS / 2 - 1;
  return [
    Math.floor((x - h) / SUB_UNITS), Math.floor((y - h) / SUB_UNITS),
    Math.floor((x + h) / SUB_UNITS) + 1, Math.floor((y + h) / SUB_UNITS) + 1,
  ];
}

/** Carve under a body centered at (x, y). Returns tiles newly opened. */
export function carveBody(b, x, y) {
  const [x0, y0, x1, y1] = bodyCells(x, y);
  return clearCells(b, x0, Math.max(y0, DIRT_TOP * SUB), x1, y1);
}

/** True if any dirt lies in the body box centered at (x, y). */
export function bodyHasDirt(b, x, y) {
  const [x0, y0, x1, y1] = bodyCells(x, y);
  for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) if (isDirtCell(b, sx, sy)) return true;
  return false;
}

/** Clear-cell fraction of a tile (0..1); used by tests and the renderer. */
export const clearFraction = (b, tx, ty) => b.cleared[ty * COLS + tx] / PER_TILE;
