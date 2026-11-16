// Top-level game simulation. Pure: no DOM, canvas or audio. Advance it with
// step() at a fixed 60 Hz; read events with drainEvents() for sounds, haptics
// and floating scores.
import {
  UNITS, HALF, DX, DY, NONE, COLS, START_TILE, HOSE_SPEED, WALK_SPEED, center, layerOf, isHorizontal, secs,
} from './constants.js';
import { createBoard, resetBoard, openTile, isOpen, inBoard } from './board.js';
import { createRng } from './rng.js';
import { getLevel } from './levels.js';
import { generateLevel } from './layout.js';
import { createPlayer, resetPlayer, updatePlayer } from './player.js';
import { tileOf, takeUnits } from './movement.js';
import {
  createEnemy, resetEnemy, updateEnemy, inflate, deflate, SOLID, HARMFUL, DONE, POP_STEPS,
} from './enemies.js';
import {
  createBoulder, updateBoulders, boulderBlocks, boulderInTile, crushPoints,
} from './boulders.js';

export const READY_STEPS = secs(2);
export const DYING_FREEZE_STEPS = secs(0.5);
export const DYING_STEPS = secs(2);
export const LEVEL_CLEAR_STEPS = secs(2);
export const GAME_OVER_LOCK_STEPS = secs(1);
export const COUNTDOWN_STEPS = secs(3);
export const GEM_STEPS = secs(10);
export const START_LIVES = 3;
export const FIRST_EXTRA_LIFE = 10000;
export const EXTRA_LIFE_EVERY = 40000;
export const HOSE_MAX = 3 * UNITS;
export const HOSE_MISS_COOLDOWN = secs(0.15);
export const PUMP_MIN_STEPS = secs(0.2);
export const PUMP_REPEAT_STEPS = secs(0.3);
export const DEFLATE_STEPS = secs(0.75);
export const POP_STAGE = 4;
export const TOUCH = (UNITS * 3) / 4;
export const DIG_POINTS = 10;
export const POP_POINTS = [0, 200, 300, 400, 500];
const ACTIVE_PHASES = new Set(['ready', 'playing', 'dying', 'levelClear']);

export function createGame({ seed = 1, highScore = 0 } = {}) {
  const g = {
    seed: seed >>> 0,
    rng: createRng(seed),
    phase: 'start',
    phaseTimer: 0,
    paused: false,
    countdown: 0,
    tick: 0,
    roundTick: 0,
    score: 0,
    high: highScore,
    lives: START_LIVES,
    nextLife: FIRST_EXTRA_LIFE,
    level: 1,
    lvl: getLevel(1),
    layout: null,
    board: createBoard(),
    player: createPlayer(),
    enemies: [],
    boulders: [],
    hose: { state: 'idle', dir: 0, len: 0, acc: 0, target: null, timer: 0 },
    held: NONE,
    newDir: false,
    pumpDown: false,
    pumpEdge: false,
    pumpRepeat: 0,
    lastPumpTick: -1000,
    falls: 0,
    gemSpawned: false,
    gem: null,
    deathCause: null,
    fleeing: null,
    events: [],
  };
  setupLevel(g);

  const api = {
    state: g,
    get phase() { return g.phase; },
    newGame: () => newGame(g),
    confirm: () => confirm(g),
    setHeld: (dir) => setHeld(g, dir),
    pump: (down) => pumpInput(g, down),
    step: () => step(g),
    pause: () => pause(g),
    resume: () => resume(g),
    togglePause: () => (g.paused ? resume(g) : pause(g)),
    quit: () => quit(g),
    drainEvents: () => g.events.splice(0),
    snapshot: () => snapshot(g),
    remaining: () => remaining(g),
  };
  return api;
}

// --- setup -------------------------------------------------------------------
function setupLevel(g) {
  g.lvl = getLevel(g.level);
  g.layout = generateLevel(g.seed, g.level);
  resetBoard(g.board);
  for (const [x, y] of g.layout.shaft) openTile(g.board, x, y);
  for (const b of g.layout.burrows) for (const [x, y] of b.tiles) openTile(g.board, x, y);
  g.board.dirty.length = 0;
  g.board.rebuild = true;
  g.boulders = g.layout.boulders.map(([x, y]) => createBoulder(x, y));
  g.enemies = g.layout.burrows.map((b, i) => {
    const horiz = b.tiles[0][1] === b.tiles[2][1];
    return createEnemy(i, b.kind, b.start[0], b.start[1], horiz ? (i % 2 ? 1 : 3) : (i % 2 ? 0 : 2));
  });
  g.falls = 0;
  g.gemSpawned = false;
  g.fleeing = null;
}

function resetRound(g) {
  resetPlayer(g.player);
  for (const e of g.enemies) {
    if (DONE.has(e.state)) continue;
    resetEnemy(e, g.rng, g.lvl);
  }
  // Boulders that were moving are removed; enemies they carried count as crushed.
  for (const b of g.boulders) {
    if (b.state === 'wobble' || b.state === 'fall' || b.state === 'crumble') {
      if (b.state !== 'crumble' && b.carried.length) scoreCrush(g, b);
      for (const e of b.carried) e.state = 'gone';
      b.carried.length = 0;
      if (b.state === 'wobble') openTile(g.board, b.tx, b.ty);
      b.state = 'gone';
    }
  }
  for (const e of g.enemies) if (e.state === 'crushed' || e.state === 'popped') e.state = 'gone';
  releaseHose(g);
  g.gem = null;
  g.held = NONE;
  g.newDir = false;
  g.pumpDown = false;
  g.pumpEdge = false;
  g.roundTick = 0;
  g.board.rebuild = true;
  updateFlee(g);
  setPhase(g, 'ready', READY_STEPS);
  emit(g, 'ready');
}

function newGame(g) {
  g.score = 0;
  g.lives = START_LIVES;
  g.nextLife = FIRST_EXTRA_LIFE;
  g.level = 1;
  g.paused = false;
  g.countdown = 0;
  g.rng = createRng(g.seed);
  setupLevel(g);
  emit(g, 'gameStart');
  resetRound(g);
}

function nextLevel(g) {
  g.level += 1;
  setupLevel(g);
  emit(g, 'levelStart', { level: g.level });
  resetRound(g);
}

// --- control -----------------------------------------------------------------
function confirm(g) {
  if (g.phase === 'start') newGame(g);
  else if (g.phase === 'gameOver' && g.phaseTimer <= 0) { g.phase = 'start'; emit(g, 'toStart'); }
}

function setHeld(g, dir) {
  if (dir !== NONE && dir !== g.held) g.newDir = true;
  g.held = dir;
}

function pumpInput(g, down) {
  if (down && !g.pumpDown) g.pumpEdge = true;
  g.pumpDown = !!down;
}

function pause(g) {
  if (g.paused || !ACTIVE_PHASES.has(g.phase)) return false;
  g.paused = true;
  g.countdown = 0;
  emit(g, 'pause');
  return true;
}

function resume(g) {
  if (!g.paused) return false;
  g.paused = false;
  g.countdown = COUNTDOWN_STEPS;
  emit(g, 'resume');
  return true;
}

function quit(g) {
  g.paused = false;
  g.countdown = 0;
  g.phase = 'start';
  releaseHose(g);
  emit(g, 'quit');
}

// --- stepping ----------------------------------------------------------------
function setPhase(g, phase, steps = 0) { g.phase = phase; g.phaseTimer = steps; }
function emit(g, type, data = {}) { g.events.push({ type, tick: g.tick, ...data }); }

function step(g) {
  if (g.paused) return;
  if (g.countdown > 0) { g.countdown -= 1; return; }
  g.tick += 1;
  switch (g.phase) {
    case 'start':
      return;
    case 'ready':
      g.pumpEdge = false;
      if (--g.phaseTimer <= 0) { setPhase(g, 'playing'); emit(g, 'go'); g.newDir = false; }
      return;
    case 'playing':
      playStep(g);
      return;
    case 'dying':
      g.phaseTimer -= 1;
      if (g.phaseTimer === DYING_STEPS - DYING_FREEZE_STEPS) emit(g, 'deathAnim', { cause: g.deathCause });
      if (g.phaseTimer <= 0) {
        g.lives -= 1;
        if (g.lives <= 0) {
          setPhase(g, 'gameOver', GAME_OVER_LOCK_STEPS);
          emit(g, 'gameOver', { score: g.score });
        } else {
          resetRound(g);
        }
      }
      return;
    case 'levelClear':
      if (--g.phaseTimer <= 0) nextLevel(g);
      return;
    case 'gameOver':
      if (g.phaseTimer > 0) g.phaseTimer -= 1;
      return;
    default:
      throw new Error(`bad phase ${g.phase}`);
  }
}

function addScore(g, n) {
  g.score += n;
  if (g.score > g.high) g.high = g.score;
  while (g.score >= g.nextLife) {
    g.lives += 1;
    g.nextLife += EXTRA_LIFE_EVERY;
    emit(g, 'extraLife');
  }
}

const blockedFor = (g) => (tx, ty) => boulderBlocks(g.boulders, tx, ty);
const enemyBlocked = (g) => (tx, ty) => boulderInTile(g.boulders, tx, ty);

function playStep(g) {
  g.roundTick += 1;
  const p = g.player;

  // --- input: new direction cancels the hose; pump presses / hold-repeat
  if (g.newDir) {
    if (g.hose.state !== 'idle') releaseHose(g);
    g.newDir = false;
  }
  let trigger = false;
  if (g.pumpEdge) { trigger = true; g.pumpRepeat = PUMP_REPEAT_STEPS; } else if (g.pumpDown && --g.pumpRepeat <= 0) { trigger = true; g.pumpRepeat = PUMP_REPEAT_STEPS; }
  g.pumpEdge = false;
  if (trigger) pumpPress(g);

  // --- hose / player
  updateHose(g);
  if (g.hose.state === 'idle') {
    const opened = updatePlayer(p, g.board, g.held, blockedFor(g), WALK_SPEED);
    for (const [tx, ty] of opened) {
      addScore(g, DIG_POINTS);
      emit(g, 'dig', { tx, ty });
    }
  } else {
    p.moving = false;
    p.digging = false;
  }

  const doo = { x: p.x, y: p.y, tx: tileOf(p.x), ty: tileOf(p.y) };

  // --- boulders
  let crushed = false;
  updateBoulders(g.boulders, {
    board: g.board,
    doo,
    enemies: g.enemies,
    emit: (type, data) => emit(g, type, data),
    onFall: (b) => {
      g.falls += 1;
      emit(g, 'fall', { x: b.x, y: b.y });
      if (g.falls >= 2 && !g.gemSpawned) {
        g.gemSpawned = true;
        g.gem = { ...g.lvl.gem, timer: GEM_STEPS, x: center(START_TILE.x), y: center(START_TILE.y) };
        emit(g, 'gemSpawn', { kind: g.gem.kind });
      }
    },
    onCrushEnemy: (e) => { if (g.hose.target === e) releaseHose(g); emit(g, 'squash', { enemy: e.id }); },
    onLand: (b) => { emit(g, 'land', { x: b.x, y: b.y }); scoreCrush(g, b); for (const e of b.carried) e.state = 'gone'; b.carried.length = 0; },
    onCrushDoo: () => { crushed = true; },
  });

  // --- enemies
  const ctx = {
    board: g.board,
    rng: g.rng,
    lvl: g.lvl,
    doo,
    roundTick: g.roundTick,
    blocked: enemyBlocked(g),
    emit: (type, data) => emit(g, type, data),
  };
  for (const e of g.enemies) {
    if (e.state === 'inflated') {
      if (deflate(e, g.tick, DEFLATE_STEPS)) {
        if (g.hose.target === e) releaseHose(g);
        emit(g, 'recover', { enemy: e.id });
      }
      continue;
    }
    updateEnemy(e, ctx);
  }
  updateFlee(g);

  // --- bonus gem
  if (g.gem) {
    if (Math.abs(p.x - g.gem.x) < HALF + 32 && Math.abs(p.y - g.gem.y) < HALF + 32) {
      addScore(g, g.gem.value);
      emit(g, 'gem', { points: g.gem.value, kind: g.gem.kind, x: g.gem.x, y: g.gem.y });
      g.gem = null;
    } else if (--g.gem.timer <= 0) {
      g.gem = null;
      emit(g, 'gemExpire');
    }
  }

  // --- deaths and level end
  const cause = crushed ? 'crush' : hitCause(g);
  if (cause) { die(g, cause); return; }
  if (g.enemies.every((e) => e.state === 'gone' || e.state === 'escaped')) {
    releaseHose(g);
    g.gem = null;
    setPhase(g, 'levelClear', LEVEL_CLEAR_STEPS);
    emit(g, 'levelClear', { level: g.level });
  }
}

export function remaining(g) { return g.enemies.filter((e) => !DONE.has(e.state)).length; }

function updateFlee(g) {
  const alive = g.enemies.filter((e) => !DONE.has(e.state));
  if (g.fleeing && DONE.has(g.fleeing.state)) {
    emit(g, 'fleeEnd', { escaped: g.fleeing.state === 'escaped' });
    g.fleeing = null;
  }
  if (alive.length === 1 && g.enemies.length > 1 && !alive[0].flee) {
    alive[0].flee = true;
    alive[0].fleeWait = 60;
  }
  if (alive.length === 1 && alive[0].flee && !g.fleeing && g.phase === 'playing') {
    g.fleeing = alive[0];
    emit(g, 'fleeStart', { enemy: alive[0].id });
  }
}

function scoreCrush(g, b) {
  const n = b.carried.length;
  if (!n) return;
  const points = crushPoints(n);
  addScore(g, points);
  emit(g, 'crush', { count: n, points, x: b.x, y: b.y });
}

// --- pump --------------------------------------------------------------------
function releaseHose(g) {
  const h = g.hose;
  h.state = 'idle';
  h.len = 0;
  h.acc = 0;
  h.target = null;
  h.timer = 0;
}

function pumpPress(g) {
  const h = g.hose;
  if (h.state === 'idle') {
    h.state = 'out';
    h.dir = g.player.dir;
    h.len = 0;
    h.acc = 0;
    h.target = null;
    h.lastTick = g.tick;
    emit(g, 'hose', { dir: h.dir });
    // Facing solid ground (or a boulder / the edge) from a tile center: miss at once.
    const p = g.player;
    const ax = tileOf(p.x + DX[h.dir] * (HALF + 1)), ay = tileOf(p.y + DY[h.dir] * (HALF + 1));
    if ((ax !== tileOf(p.x) || ay !== tileOf(p.y)) && !hoseHit(g, HALF)
      && (!inBoard(ax, ay) || !isOpen(g.board, ax, ay) || boulderBlocks(g.boulders, ax, ay))) {
      miss(g);
      return;
    }
    extendHose(g); // the hose starts moving on the press step
    return;
  }
  if (h.state === 'hooked' && h.target && g.tick - g.lastPumpTick >= PUMP_MIN_STEPS) {
    pumpTarget(g, h.target);
  }
}

function pumpTarget(g, e) {
  const stage = inflate(e, g.tick);
  g.lastPumpTick = g.tick;
  if (stage >= POP_STAGE) {
    const layer = layerOf(tileOf(e.y));
    let points = POP_POINTS[layer];
    if (e.kind === 'sizzler' && isHorizontal(g.hose.dir)) points *= 2;
    e.state = 'popped';
    e.timer = POP_STEPS;
    e.stage = POP_STAGE;
    addScore(g, points);
    emit(g, 'pop', { enemy: e.id, kind: e.kind, points, layer, x: e.x, y: e.y });
    releaseHose(g);
  } else {
    emit(g, 'inflate', { enemy: e.id, stage });
  }
}

/** Nearest solid enemy the hose (from Doo, length len) touches, or null. */
export function hoseHit(g, len) {
  const p = g.player, d = g.hose.dir;
  let best = null, bestAlong = Infinity;
  for (const e of g.enemies) {
    if (!SOLID.has(e.state)) continue;
    const rx = e.x - p.x, ry = e.y - p.y;
    const along = rx * DX[d] + ry * DY[d];
    const across = Math.abs(rx * DY[d] - ry * DX[d]);
    if (across >= HALF || along < -HALF / 2 || along > len + HALF) continue;
    if (along < bestAlong) { bestAlong = along; best = e; }
  }
  return best;
}

function extendHose(g) {
  const h = g.hose, p = g.player;
  const prev = h.len;
  h.len = Math.min(HOSE_MAX, h.len + takeUnits(h, HOSE_SPEED));
  // The tip may only pass through open tiles (Doo's own tile is always allowed).
  const ownX = tileOf(p.x), ownY = tileOf(p.y);
  for (let l = prev; l <= h.len; l += 16) {
    const tx = tileOf(p.x + DX[h.dir] * l), ty = tileOf(p.y + DY[h.dir] * l);
    if ((tx !== ownX || ty !== ownY) && (!inBoard(tx, ty) || !isOpen(g.board, tx, ty) || boulderBlocks(g.boulders, tx, ty))) {
      h.len = Math.max(0, l - 16);
      const e = hoseHit(g, h.len);
      if (e) return hook(g, e);
      return miss(g);
    }
  }
  const e = hoseHit(g, h.len);
  if (e) return hook(g, e);
  if (h.len >= HOSE_MAX) return miss(g);
  return null;
}

function hook(g, e) {
  const h = g.hose, p = g.player;
  h.state = 'hooked';
  h.target = e;
  h.len = Math.max(0, Math.abs((e.x - p.x) * DX[h.dir] + (e.y - p.y) * DY[h.dir]) - HALF / 2);
  emit(g, 'hook', { enemy: e.id });
  pumpTarget(g, e);
  return e;
}

function miss(g) {
  const h = g.hose;
  h.state = 'cool';
  h.timer = HOSE_MISS_COOLDOWN;
  h.target = null;
  emit(g, 'miss');
  return null;
}

function updateHose(g) {
  const h = g.hose;
  if (h.state === 'out') {
    if (h.lastTick !== g.tick) extendHose(g);
  } else if (h.state === 'cool') {
    h.len = 0;
    if (--h.timer <= 0) h.state = 'idle';
  } else if (h.state === 'hooked') {
    if (!h.target || h.target.state !== 'inflated') releaseHose(g);
  }
  h.lastTick = g.tick;
}

// --- collisions ----------------------------------------------------------------
function hitCause(g) {
  const p = g.player;
  const ptx = tileOf(p.x), pty = tileOf(p.y);
  for (const e of g.enemies) {
    if (e.state === 'fire' && e.flameTiles) {
      for (const [x, y] of e.flameTiles) if (x === ptx && y === pty) return 'flame';
    }
    if (HARMFUL.has(e.state) && Math.abs(e.x - p.x) < TOUCH && Math.abs(e.y - p.y) < TOUCH) return 'enemy';
  }
  return null;
}

function die(g, cause) {
  releaseHose(g);
  g.deathCause = cause;
  g.gem = null;
  setPhase(g, 'dying', DYING_STEPS);
  emit(g, 'death', { cause });
}

function snapshot(g) {
  return JSON.stringify({
    tick: g.tick, phase: g.phase, score: g.score, lives: g.lives, level: g.level,
    p: [g.player.x, g.player.y, g.player.dir],
    h: [g.hose.state, g.hose.len],
    e: g.enemies.map((e) => [e.x, e.y, e.dir, e.state, e.stage]),
    b: g.boulders.map((b) => [b.y, b.state]),
    rng: g.rng.state,
  });
}

export { COLS };
