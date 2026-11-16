import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import {
  createBoard, isOpen, clearCells, carveBody, openTile, clearFraction,
} from '../src/core/board.js';
import { generateLevel, validateLayout } from '../src/core/layout.js';
import { getLevel } from '../src/core/levels.js';
import {
  COLS, ROWS, TILE, VIEW_W, VIEW_H, UNITS, SUB, center, layerOf,
} from '../src/core/constants.js';

test('rng: same seed gives the same sequence', () => {
  const a = createRng(42), b = createRng(42), c = createRng(43);
  const sa = Array.from({ length: 20 }, () => a.next());
  const sb = Array.from({ length: 20 }, () => b.next());
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, Array.from({ length: 20 }, () => c.next()));
});

test('grid: 14x18 tiles of 32 px; board is rows 1-16', () => {
  assert.equal(COLS, 14); assert.equal(ROWS, 18); assert.equal(TILE, 32);
  assert.equal(VIEW_W, 448); assert.equal(VIEW_H, 576);
  const b = createBoard();
  for (let x = 0; x < COLS; x++) {
    assert.ok(isOpen(b, x, 1), 'surface open');
    assert.ok(!isOpen(b, x, 2), 'dirt solid');
    assert.ok(!isOpen(b, x, 0) && !isOpen(b, x, 17), 'HUD rows are not board');
  }
});

test('layers: rows 2-5, 6-9, 10-13, 14-16; surface counts as layer 1', () => {
  assert.deepEqual([1, 2, 5, 6, 9, 10, 11, 13, 14, 15, 16].map(layerOf), [1, 1, 1, 2, 2, 3, 3, 3, 4, 4, 4]);
});

test('digging: a half-tile dig clears about half the tile; a full dig opens it', () => {
  const b = createBoard();
  openTile(b, 5, 8);
  // body moves half a tile right from (5,8)
  carveBody(b, center(5) + UNITS / 2, center(8));
  assert.equal(clearFraction(b, 6, 8), 0.5);
  assert.ok(!isOpen(b, 6, 8));
  const opened = carveBody(b, center(6), center(8));
  assert.deepEqual(opened, [[6, 8]]);
  assert.ok(isOpen(b, 6, 8));
});

test('digging: clearing is finer than one tile and reports changed rects', () => {
  const b = createBoard();
  b.dirty.length = 0;
  clearCells(b, 6 * SUB, 8 * SUB, 6 * SUB + 1, 9 * SUB);
  assert.equal(clearFraction(b, 6, 8), 0.25);
  assert.equal(b.dirty.length, 1);
});

test('layout: same seed and level give the same board', () => {
  assert.deepEqual(generateLevel(99, 2), generateLevel(99, 2));
  assert.notDeepEqual(generateLevel(99, 2), generateLevel(100, 2));
});

test('layout: levels 1-30 pass every rule for several seeds', () => {
  for (const seed of [1, 2, 3, 77, 4242]) {
    for (let level = 1; level <= 30; level++) {
      const L = generateLevel(seed, level);
      assert.deepEqual(validateLayout(L), [], `seed ${seed} level ${level}`);
      assert.deepEqual(L.start, { x: 6, y: 8 });
    }
  }
});

test('enemy cast: level 1 = 3 Gloops + 1 Sizzler; level 9 = 6 Gloops + 2 Sizzlers', () => {
  const kinds = (L) => generateLevel(5, L).burrows.map((b) => b.kind);
  const count = (arr, k) => arr.filter((x) => x === k).length;
  assert.equal(count(kinds(1), 'gloop'), 3); assert.equal(count(kinds(1), 'sizzler'), 1);
  assert.equal(count(kinds(9), 'gloop'), 6); assert.equal(count(kinds(9), 'sizzler'), 2);
  assert.equal(getLevel(30).enemies, 8);
});
