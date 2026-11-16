// Shared constants for the pure game simulation. No DOM access here.

export const COLS = 14;              // playfield / board width in tiles
export const ROWS = 18;              // playfield height in tiles
export const HUD_TOP_ROWS = 1;
export const HUD_BOTTOM_ROWS = 1;
export const SURFACE_ROW = 1;        // always-open surface row
export const DIRT_TOP = 2;           // first dirt row
export const DIRT_BOTTOM = 16;       // last dirt row (also last board row)
export const BOARD_TOP = SURFACE_ROW;
export const BOARD_BOTTOM = DIRT_BOTTOM;
export const TILE = 32;              // logical pixels per tile
export const VIEW_W = COLS * TILE;   // 448
export const VIEW_H = ROWS * TILE;   // 576

// Positions: integer units of an entity's center. 1 tile = 256 units (8 per px).
export const UNITS = 256;
export const HALF = UNITS / 2;
export const center = (t) => t * UNITS + HALF;

// Dirt sub-cells: 4x4 per tile (8 logical px each).
export const SUB = 4;
export const SUB_UNITS = UNITS / SUB; // 64
export const SUB_COLS = COLS * SUB;   // 56
export const SUB_ROWS = ROWS * SUB;   // 72 (HUD rows never hold dirt)

export const STEP_HZ = 60;
// Speeds are integer milli-units per step. Doo walking = 4 tiles/s.
export const WALK_SPEED = Math.round((4 * UNITS * 1000) / STEP_HZ);   // 17067
export const DIG_FACTOR = 0.75;
export const FALL_SPEED = Math.round((6 * UNITS * 1000) / STEP_HZ);   // 25600
export const HOSE_SPEED = Math.round((16 * UNITS * 1000) / STEP_HZ);  // 68267
export const pctSpeed = (pct) => Math.round((WALK_SPEED * pct) / 100);

export const SWIPE_THRESHOLD = 20;   // CSS px a finger must move to register a direction

// Directions are indexes in tie-break order: up, left, down, right.
export const UP = 0, LEFT = 1, DOWN = 2, RIGHT = 3, NONE = -1;
export const DIRS = [UP, LEFT, DOWN, RIGHT];
export const DX = [0, -1, 0, 1];
export const DY = [-1, 0, 1, 0];
export const DIR_NAMES = ['up', 'left', 'down', 'right'];
export const opposite = (d) => (d < 0 ? NONE : (d + 2) % 4);
export const isHorizontal = (d) => d === LEFT || d === RIGHT;

/** Depth layer (1-4) of a board row; the surface counts as layer 1. */
export function layerOf(row) {
  if (row <= 5) return 1;
  if (row <= 9) return 2;
  if (row <= 13) return 3;
  return 4;
}

// Start shaft and Doo's start tile.
export const SHAFT_COL = 6;
export const SHAFT_TOP = DIRT_TOP;
export const SHAFT_BOTTOM = 8;
export const START_TILE = { x: SHAFT_COL, y: SHAFT_BOTTOM };

// Seconds -> simulation steps
export const secs = (s) => Math.round(s * STEP_HZ);
