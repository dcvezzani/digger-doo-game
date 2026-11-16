# Design

## Context

This is a new project with no code yet. See proposal.md for the motivation and the specs under `specs/` for the required behavior. The sibling project Neon Nibbler (`dcvezzani/neon-nibbler`) already solved the mobile app shell under the same constraints:

- Fixed-timestep loop.
- Swipe recogniser, safe-area layout, DOM buttons over a canvas.
- Synthesized audio, service worker, Playwright checks.

This design reuses those patterns wherever the behavior is the same and calls out where digging play needs something different. Constraints:

- Mobile first: iOS Safari and Android Chrome, portrait first. Desktop keyboard play is still supported.
- Vanilla JS ES modules, no build step, no runtime dependencies.
- Game logic testable in Node without a DOM.

## Goals / Non-Goals

**Goals:**
- Keep the pure simulation (no DOM, no canvas, no audio) separate from presentation, so every rules scenario can be tested headlessly.
- Make the simulation deterministic (fixed step, seeded RNG, integer positions) so tests and replays repeat exactly.
- Make the dirt state an exact, serialisable grid. Rendering, enemy pathing and boulder physics all read the same data.
- Keep frame time low on mid-range phones:
  - Dirt is drawn to a cached offscreen canvas and only patched where it changes.
  - Few draw calls per frame.
  - No per-frame allocations in the hot loop.
- Keep all tunable numbers (speeds, timers, values, thresholds) in one place.

**Non-Goals:**
- Gamepad or tilt controls, two-player mode, intermissions, online leaderboards, hand-authored level maps. These can come in later changes.
- Native app store builds.
- Matching any existing arcade game's exact timings, layouts or quirks.

## Decisions

### D1. Module layout

```
index.html              viewport meta, canvas, UI overlay, <script type="module" src="src/main.js">
manifest.webmanifest    name, icons, display fullscreen/standalone, orientation portrait
sw.js                   service worker: versioned precache of all game files
icons/                  app icons (192, 512, maskable, apple-touch) drawn for this game
src/core/               pure logic, no DOM. Imported by both the browser and tests
  constants.js          grid sizes, rows, layers, directions, units, sub-cells, swipe threshold
  rng.js                seeded PRNG (mulberry32), same as Neon Nibbler
  levels.js             per-level table: enemy count/mix, speeds, ghost interval, chances, boulders, gem
  board.js              dirt sub-cell grid: carve, isOpen(tile), layer(row), dirty-rect list for the renderer
  layout.js             seeded level generator (shaft, burrows, boulders) + validateLayout()
  movement.js           shared helpers: tile of a position, centers, speed accumulator
  player.js             held-direction movement, turning at centers, digging speed, boulder blocking
  pump.js               hose extension, hit test, inflate/deflate timing
  boulders.js           resting -> wobbling -> falling -> crumbling, crush capture
  enemies.js            roam decisions, ghost drift, Sizzler flame, flee route
  game.js               top-level state machine, scoring, collisions, lives, levels, events list
  loop.js               fixed-step accumulator (from Neon Nibbler)
  swipe.js              pure drag recogniser: points in -> directions out; tracks hold + tap
src/input/              keyboard.js (held-key stack), touch.js (pointer events -> swipe.js, pump fingers), dpad.js
src/render/renderer.js  canvas drawing: cached dirt, tunnels, entities, hose, flame, HUD, screens
src/ui/                 layout.js (fit + safe areas + orientation + controls placement), ui.js (buttons, panels)
src/audio/sfx.js        Web Audio synthesis + vibration, reacts to game events
src/storage.js          try/catch wrappers around localStorage (high score, settings)
src/main.js             wiring, lifecycle, requestAnimationFrame loop
test/*.test.js          node --test
e2e/*.test.js           Playwright + pre-installed Chromium
```

### D2. Fixed-timestep simulation with event output

This works as in Neon Nibbler. `game.step()` advances exactly 1/60 s, and `main.js` runs whole steps from an accumulator, capped at 5 per frame. `step` appends events to a queue that audio, haptics and the floating-score renderer drain:

- Doo: `dig`, `hose`, `inflate`, `pop`.
- Boulders: `wobble`, `fall`, `land`, `crush`.
- Other: `flame`, `gemSpawn`, `gem`, `extraLife`, `death`, `levelClear`, `fleeStart`, `fleeEnd`, `gameStart`.

### D3. Positions, speeds and sub-cells

**Positions.** One tile is 32 logical px and **256 units** (8 units per px). Positions are integer units of the entity's center, so a tile center is `t*256 + 128`.

**Speeds.** Speeds are stored as integer **milli-units per step**. Each entity keeps a remainder accumulator, so fractional speeds stay exact and deterministic:

| Movement | Tiles/s | Milli-units per step |
|---|---|---|
| Doo walking (100%) | 4 | 17,067 |
| Doo digging (75%) | 3 | 12,800 |
| Boulder falling | 6 | 25,600 |
| Hose extending | 16 | 68,267 |

The fastest mover, the hose, covers 68 units (about a quarter tile) per step. Nothing moves a full tile in one step, so center crossings can always be detected. When a step would carry an entity past a tile center where it must decide something, the move is split: move to the center, decide, then spend the rest of the step.

**Sub-cells.** Dirt is a `Uint8Array` of **sub-cells** with 4×4 per tile (8 px each). Over 14×16 tiles that is 56×64 cells.

**Carving.** Carving clears every sub-cell overlapped by Doo's tile-sized body box, shrunk by 1 unit so a centered Doo clears exactly its own 16 cells. As Doo moves, this clears one 8 px column or row at a time, which gives smooth, Doo-wide tunnels.

**Open tiles.** A tile is **open** when all 16 of its sub-cells are clear. Keeping a per-tile "cleared count" makes `isOpen` O(1) and lets the game award dig points the moment the count reaches 16.

**Renderer feed.** Each carve pushes the changed sub-cell rectangle to a `dirty` list. The renderer drains the list and erases only those rectangles from its cached dirt canvas.

Alternatives considered:
- Per-tile dug flags plus edge flags. Rejected because tunnels look blocky and partial digs (a spec requirement) can't be shown.
- A pixel-exact mask. Rejected because it is large and slow to test, and gives no extra gameplay value.

### D4. Input: held direction + pump presses

Unlike a maze-chase game, Doo moves only while a direction is held. Every control feeds `game.setHeld(dir | NONE)` and `game.pump(down: boolean)`:

- **Touch** (`touch.js` + `swipe.js`): Pointer Events with `touch-action: none` on the game surface.
  - The **first** pointer steers. Once it has moved ≥ 20 CSS px from its anchor, the dominant axis gives the held direction, and the anchor resets so turns chain.
  - Lifting the first pointer sets `NONE`. If it lifted without registering a direction, it was a **tap**: on the start and game-over screens a tap confirms, and in play it gives one pump press.
  - **Any additional pointer** is a pump finger: `pump(true)` on down and `pump(false)` on up.
  - Pointers that start on UI controls are ignored by the recogniser.
- **Keyboard** (`keyboard.js`): keeps a stack of held direction keys. The top of the stack is the held direction, and repeats are ignored. Space and X map to `pump(true/false)`. Enter confirms. Arrows, WASD and Space call `preventDefault`.
- **D-pad** (`dpad.js`): `pointerdown` sets held, and `pointerup`/`pointercancel`/`pointerleave` clears it. The PUMP button maps to `pump(true/false)`.

Inside the game:
- A **new direction** is a held value that is not `NONE` and differs from the previous one. A new direction cancels the hose (pump-attack spec).
- `pump(true)` is an edge press. While the pump stays down, the pump repeats every 18 steps (0.3 s).
- Counted pumps are rate-limited to one every 12 steps (0.2 s).

Alternative considered: Neon Nibbler's continuous movement with a 0.5 s turn buffer. Rejected because digging needs precise stopping (for example, under a boulder), and the genre's hold-to-move feel is part of its strategy. The buffer isn't needed: a held perpendicular direction simply waits for the next tile center.

### D5. Player movement

Each step works out a desired direction from `held`:

- **Reverse** of the current axis: take it at once.
- **Perpendicular:** if Doo is at a center, turn when the target tile is inside the board and holds no resting or wobbling boulder. Otherwise keep moving in the current direction to the next center, then turn.
- **None:** stop where Doo is. Mid-tile stops are allowed, which is what makes partial digs possible.

Speed comes from whether the sub-cells just ahead of Doo's leading edge are still dirt (dig speed) or not (walk speed).

### D6. Pump

The hose is a small state machine: `idle → extending → hooked | missed(cooldown 9 steps) → idle`.

**Extending.** Each step the hose length grows by the hose speed. The tip tile is checked with `isOpen`, and a closed tile or full length means a miss.

**Hit test.** An enemy is hit when its center lies within 128 units (half a tile) of the hose line, measured across the line, and at most `len + 128` along it. Only solid, hookable enemies count, and the nearest one is chosen.

**Hooked.** The hooked enemy holds `stage` and `lastPumpTick`. Deflation is checked in the enemy update: one stage is lost every 45 steps since the last pump. At stage 4 it pops, and the enemy enters `popped` for 30 steps (burst animation) before removal.

**Sizzler bonus.** A Sizzler popped by a hose pointing left or right scores double.

### D7. Enemies

Each enemy has a kind (`gloop`/`sizzler`) and a state:

| State | Meaning |
|---|---|
| `roam` | Moving through tunnels |
| `ghost` | Drifting through dirt toward Doo |
| `inflated` | stage 1–3, frozen |
| `popped` | Burst animation, then removed |
| `crushed` | Carried by a boulder |
| `fleeUp` | Ghost drifting up to the surface |
| `fleeWalk` | Walking left along the surface |
| `escaped` | Left the board |
| `charge` | Sizzler warning glow, 36 steps |
| `fire` | Sizzler flame, 30 steps |

- **Roam:** at tile centers, choose from open, boulder-free neighbors in rows 2–16. Never reverse unless that is the only option. With the level's chase chance, take the closest to Doo's tile using the tie order up, left, down, right; otherwise make a seeded random pick. In a 3-tile burrow this naturally bounces back and forth.
- **Ghost:** free 2D movement. Each step, move `ghostSpeed` units along the normalized vector to Doo's center. The vector is computed with `Math.hypot` on integers; the result is rounded to integers each step, so it stays deterministic in V8. Positions are clamped to the board. Once `ghostSteps ≥ 90` and the tile under the center is open and boulder-free, snap to that tile's center and go back to `roam`.
- **Flame:** checked at roam decision points (D5's center logic) using the conditions in the spec. Flame tiles are computed once when the fire starts.
- **Flee:** set by `game.js` when the count of enemies not popped, crushed or escaped drops to 1:
  1. After 60 steps, `fleeUp` targets (current x, surface center y) as a ghost.
  2. On arrival it switches to `fleeWalk`, moving left at flee speed.
  3. When its x is below −128 it becomes `escaped`.
  An inflated enemy picks up the flee route after it recovers.
- All RNG calls go through the game's seeded RNG in a fixed order (enemy index order each step), never `Math.random`.

### D8. Boulders

Each boulder has a `tile`, a `state` (`rest`, `wobble`, `fall`, `crumble`), a `y` in units, a timer and a `carried` list.

- **Rest → wobble:** when the tile below is open and Doo's body box does not overlap that tile.
- **Wobble → fall:** after 45 steps. The origin tile's sub-cells are cleared without dig points, and the fall count goes up. On the second fall in a level, the gem spawns.
- **Fall:** move by the fall speed. On crossing a tile center, keep going only if the next tile is open and the row is below 16; otherwise snap to the center and land. Each step, capture solid enemies whose box overlaps the boulder's box: center distance under 192 units (three quarters of a tile) on x and under 256 on y. If Doo overlaps, it is a death with cause `crush`.
- **Land:** score the crush table for `carried.length`, mark the carried enemies as removed, then `crumble` for 30 steps and remove the boulder.

### D9. Level generation (`core/layout.js`)

`generateLevel(seed, level)` builds its own RNG from `seed ^ (level * 0x9e3779b1)`. That way a level's layout doesn't depend on how much RNG play consumed, and the same seed and level always match the spec. The steps:

1. Clear the surface row and the shaft (col 6, rows 2–8).
2. For each enemy, try up to 200 random placements of a 3-tile burrow (orientation, then position in rows 3–16) that satisfy the spacing rules. Use a one-tile "keep-out" ring around existing burrows and a Chebyshev distance of at least 3 from shaft tiles.
3. Place boulders on solid tiles in rows 3–15 that are not inside any keep-out ring, have solid dirt below, and have no other boulder directly above or below.
4. If any placement fails, retry the whole level with the next RNG values. The RNG stream is still deterministic.

`validateLayout()` checks every rule in the dirt-board spec, and a test runs it over levels 1–30 for several seeds.

### D10. Level table (`core/levels.js`)

| Value | Formula | Limit |
|---|---|---|
| Enemy count | min(8, 4 + floor((L−1)/2)) | 8 |
| Sizzlers | max(1, floor(count/3)) | |
| Roam speed | 70% + 3%·(L−1) | 95% |
| Ghost speed | 55% + 2%·(L−1) | 75% |
| Flee speed | 110% | |
| Ghost interval | 9 s − 0.5 s·(L−1) | 4 s |
| Chase chance | 50% + 3.5%·(L−1) | 85% |
| Flame chance | 25% + 3.5%·(L−1) | 60% |
| Boulders | 3 for L1–4, 4 for L5–9, 5 for L10+ | |
| Gem | as in the scoring spec | |

Percentages are of Doo's walking speed. All limits are reached by level 11. Speeds are converted to milli-units per step once per level.

### D11. Screen layout and rendering

**Viewport.** The viewport meta, gesture-blocking CSS and safe-area probe are the same as Neon Nibbler. `ui/layout.js` keeps Neon Nibbler's fit logic: the playfield aspect is 448:576, and room is reserved above the HUD when it is shorter than a 44 px button. When on-screen controls are on, it places a **controls strip** of D-pad (188 px) and PUMP (84 px):

- **Portrait:** the strip goes below the playfield, with the D-pad on the left and PUMP on the right.
- **Landscape/desktop:** the D-pad goes left of the playfield and PUMP to the right. The playfield stays centred when there is room.

**Canvas.** The backing store is CSS size × DPR (capped at 3).

**Cached layers:**
- *Sky and HUD background:* redrawn on resize.
- *Dirt:* the layer colors with a speckle texture from a fixed per-level seed, drawn once per level and per resize. Carved sub-cells are then erased with `clearRect` from the board's dirty list. On rebuild (resize, new level, life lost) all cleared cells are re-erased from the board state, so the cache can always be rebuilt from game state.

**Per frame:** blit the dirt cache over a dark tunnel background, then draw boulders, the gem, enemies, the hose, flame, Doo, floating scores, HUD text and overlays.

**Look:**
- **Palette:** a deep indigo night sky with a thin grass line. The dirt layers are warm bands (sand, clay, umber, plum) whose hue rotates per level. Tunnels are near-black with a soft inner shadow.
- **Doo:** a round brown mole with a pink nose, a yellow hard hat and a headlamp that faces where Doo is heading.
- **Gloop:** a teal translucent jelly that wobbles, with white eyes.
- **Sizzler:** an orange-red spiky beetle with ember flecks, glowing yellow during the warning.
- **Ghost:** just the eyes with a faint outline.
- **Inflation:** scales the sprite by 1.2, 1.45 and 1.7 per stage with a tint.
- **Pop:** a ring of bubbles.
- **Boulder:** a grey lumpy stone that jitters while wobbling.

### D12. Audio and haptics

This works as in Neon Nibbler. `sfx.js` creates the `AudioContext` on the first gesture and resumes it after pause or background, with every call guarded. The effects are short oscillator envelopes:

| Event | Sound |
|---|---|
| Digging a tile | Soft noise-like square ticks, rate-limited |
| Firing the hose | Whoosh |
| Inflating | Rising "pff" per stage |
| Popping | Pop |
| Boulder wobbling | Rattle |
| Boulder landing | Thud |
| Flame | Hiss (sawtooth sweep) |

The flee alarm is a looping two-tone. Vibration patterns are: life lost 120 ms, pop 30 ms, crush 60 ms, level clear 40-60-40.

### D13. Lifecycle, install and offline

These are the same as Neon Nibbler:

- `visibilitychange` and `pagehide` pause the game, stop the loop and suspend audio. Resuming takes a player tap and then the 3-2-1 countdown.
- The manifest has `display: fullscreen` with a standalone fallback and portrait orientation.
- `sw.js` precaches a fixed `FILES` list under a version key and serves cache first. It deletes old caches on activate and is skipped on `localhost` unless `?sw=1` is set.
- A unit test fails if a game file is missing from `FILES`.

### D14. Testing

- `node --test` runs `test/`. Tests drive `game.js` with scripted held directions and pumps and a fixed seed. Board, boulder and enemy scenarios set up a game, then edit its board directly, using test helpers to carve a tunnel or place an enemy or boulder, so each rule can be tested in isolation.
- Every rules scenario in the specs maps to at least one test.
- `e2e/` runs Playwright with the pre-installed Chromium in iPhone emulation and at desktop sizes. It checks gestures, drag-hold steering, second-finger pumping, layout at 320×568, 390×844, 844×390 and 1440×900, button and control sizes, settings persistence, background pause, offline play, running without audio and the game-over screen.
- A manual checklist in the README covers real-device audio, haptics, install and performance.

## Risks / Trade-offs

- **Hold-to-move needs a finger on the screen, so pumping while moving needs a second finger.** Mitigations: a quick tap also pumps, the optional D-pad and PUMP button, and the hose stopping Doo anyway.
- **Ghost snapping can jump up to half a tile.** Mitigation: snapping only happens over open tiles, and the eyes fade into the body over a few frames in the renderer. It's a visual-only smoothing.
- **Seeded generation could produce unfair starts (an enemy right next to Doo).** Mitigations: spacing rules from the shaft, `validateLayout()` over many seeds, and a 3-second ghost grace period.
- **Sub-cell erasing on canvas could get costly.** Mitigations: only dirty rects are erased, at most a handful per step, and full rebuilds happen only on resize, new level or life lost.
- **iOS Safari quirks (audio suspension, no vibration, toolbar resizing the viewport).** Mitigation: Neon Nibbler's handling (resume on each resume, feature-detect vibration, use the visual viewport).
- **Service worker serving stale files during development.** Mitigation: the version key is bumped per release, and registration is skipped on localhost unless `?sw=1`.

## Open Questions

- The exact speeds, chances and ghost interval after play testing on real phones. They can be tuned within the rules in the specs.
- Final art polish for the gems at higher levels. This is presentation only.
