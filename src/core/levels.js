// Per-level tuning. All difficulty values reach their limits by level 11.
import { pctSpeed, secs } from './constants.js';

export const GEMS = [
  // [first level, kind, points]
  [1, 'quartz', 400],
  [2, 'amber', 600],
  [3, 'jade', 800],
  [5, 'ruby', 1000],
  [7, 'sapphire', 2000],
  [9, 'opal', 3000],
  [11, 'emerald', 4000],
  [13, 'topaz', 5000],
  [15, 'diamond', 6000],
  [18, 'starstone', 8000],
];

export function gemFor(level) {
  let g = GEMS[0];
  for (const row of GEMS) if (level >= row[0]) g = row;
  return { kind: g[1], value: g[2] };
}

export const enemyCount = (L) => Math.min(8, 4 + Math.floor((L - 1) / 2));
export const sizzlerCount = (L) => Math.max(1, Math.floor(enemyCount(L) / 3));
const cap = (v, lim) => Math.min(v, lim);

export function getLevel(level) {
  const L = Math.max(1, level | 0);
  const n = L - 1;
  const roamPct = cap(70 + 3 * n, 95);
  const ghostPct = cap(55 + 2 * n, 75);
  const ghostSecs = Math.max(4, 9 - 0.5 * n);
  return {
    level: L,
    enemies: enemyCount(L),
    sizzlers: sizzlerCount(L),
    roamPct,
    ghostPct,
    fleePct: 110,
    roamSpeed: pctSpeed(roamPct),
    ghostSpeed: pctSpeed(ghostPct),
    fleeSpeed: pctSpeed(110),
    ghostSecs,
    ghostSteps: secs(ghostSecs),
    chase: cap(0.5 + 0.035 * n, 0.85),
    flame: cap(0.25 + 0.035 * n, 0.6),
    boulders: L <= 4 ? 3 : L <= 9 ? 4 : 5,
    gem: gemFor(L),
  };
}
