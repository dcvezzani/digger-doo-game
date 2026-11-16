# Tasks

## 1. Project scaffolding and app shell

- [x] 1.1 Create `package.json` and `.gitignore`.
  - `package.json`: type module; scripts `test` (`node --test`), `e2e`, `start` (a static server bound to `0.0.0.0`) and `icons`.
  - Folders: `src/core`, `src/input`, `src/render`, `src/ui`, `src/audio`, `test`, `e2e` and `tools`.
  - Verify: `npm test` runs.
- [x] 1.2 Create `index.html` and `src/style.css`.
  - Mobile viewport meta (`viewport-fit=cover`), edge-to-edge background and gesture-blocking CSS.
  - A canvas, plus a DOM overlay for the buttons, panels, D-pad and PUMP button.
  - Verify in Playwright iPhone emulation: a double-tap and drags neither zoom nor scroll the page.
- [x] 1.3 Implement `src/ui/layout.js`.
  - Fit 448×576 into the safe-area-reduced visual viewport.
  - Portrait: controls strip below. Landscape: D-pad left, PUMP right.
  - DPR-sized canvas, capped at 3.
  - Verify: unit tests at 320×568, 390×844, 844×390, 1440×900 and 768×1024, with and without controls, show that the playfield fits, keeps its ratio and nothing covers the board.

## 2. Dirt board and level generation

- [x] 2.1 Add `constants.js` and `rng.js`.
  - `constants.js`: grid, rows, layers, directions, units, sub-cells, speeds base, swipe threshold.
  - Verify: a test that the same seed gives the same random sequence.
- [x] 2.2 Implement `board.js`.
  - Sub-cell grid, carving with a body box, per-tile cleared counts, `isOpen`, `layerOf(row)`, always-open surface, and a dirty-rect list.
  - Verify: tests for a partial dig (half a tile), a full tile opening, the layer of rows 2/6/11/15, and the surface being open.
- [x] 2.3 Implement `levels.js` and the seeded generator `layout.js` with `validateLayout()`.
  - Generator: shaft, burrows, boulders.
  - Verify: tests that the same seed and level give the same board; that levels 1–30 × 5 seeds pass validation; and the enemy counts and mixes for levels 1 and 9.
- [x] 2.4 Render the board: sky, grass line, colored layers with texture, and a cached dirt canvas patched from dirty rects and rebuilt on resize, new level or life lost.
  - Verify by hand: tunnels follow Doo smoothly and layer colors change per level.

## 3. Player controls and movement

- [x] 3.1 Implement `movement.js` (milli-unit speed accumulator, tile and center helpers) and `player.js`.
  - Held-direction movement, a turn at the next center, instant reversal, stopping when released, board limits, boulder blocking, dig vs walk speed.
  - Verify: tests for a turn between tiles, mid-tile reversal, the board edge, a boulder ahead, a walk-vs-dig timing ratio of about 0.75, and no tile skipping.
- [x] 3.2 Implement the pure drag recogniser `swipe.js`.
  - 20 px threshold, dominant axis, mid-drag registration, anchor reset, tap detection.
  - Verify: tests for drag-left-and-hold, tiny movement as a tap, and an L-shaped drag.
- [x] 3.3 Implement `touch.js`, `keyboard.js` and `dpad.js`, all feeding `setHeld`/`pump`.
  - `touch.js`: first pointer steers, a lift stops, a tap pumps or confirms, extra pointers pump.
  - `keyboard.js`: held-key stack, Space/X pump.
  - `dpad.js`: hold to move, PUMP button.
  - Verify: a unit test for the keyboard held-key stack; a test that the same timed inputs via drag paths and via keys give identical states; and in Playwright touch emulation, a held drag moves Doo and a second finger pumps.
- [x] 3.4 Implement the fixed-timestep loop and wire it in `main.js`.
  - Verify: a test that Doo covers the same distance over the same game time with 30 vs 144 fps render pacing.
- [x] 3.5 Render Doo (mole, hard hat, headlamp facing the direction of travel, a dig animation).
  - Verify by hand: Doo faces its direction of travel.

## 4. Pump attack

- [x] 4.1 Implement `pump.js`: hose fire, extension through open tiles, miss and cooldown, nearest-enemy hit test, hook at stage 1.
  - Verify: tests for a miss in a tunnel, being blocked by dirt, hooking a Gloop 2 tiles away, and ghosts not being hookable.
- [x] 4.2 Implement inflate and pop: press rate limit 0.2 s, hold-repeat 0.3 s, pop at stage 4, deflate one stage per 0.75 s, recovery, helpless when inflated, cancel by a new direction or a lost life.
  - Verify: tests for each scenario in the pump-attack spec.
- [x] 4.3 Render the hose (segmented line with a nozzle), the inflation stages and the pop burst.
  - Verify by hand: each stage is visibly larger.

## 5. Boulders

- [x] 5.1 Implement `boulders.js`: loosen when the tile below is open and Doo is not under it, wobble 0.75 s, fall at 6 tiles/s through open tiles, open the origin tile, land, crumble 0.5 s.
  - Verify: tests for digging under then leaving, Doo holding it up, falling down a 4-deep shaft, and being gone after crumbling.
- [x] 5.2 Implement crushing (enemies carried and scored on landing, Doo crushed) and the lost-life cleanup.
  - Verify: tests for a double crush, Doo crushed, and a falling boulder removed at life loss with resting boulders kept.
- [x] 5.3 Render boulders (resting, wobble jitter, falling, crumble).
  - Verify by hand: the wobble is visible before the fall.

## 6. Enemy AI

- [x] 6.1 Implement roaming: center decisions over open, boulder-free neighbors, no reversal unless forced, chase chance with tie order, seeded random picks.
  - Verify: tests for staying inside a burrow, the closest-option choice at 100% chase chance, and no voluntary reversal.
- [x] 6.2 Implement ghosting: timer with jitter and a 3 s round grace, straight drift toward Doo, harmless, re-forming over an open tile after ≥ 1.5 s.
  - Verify: tests for a ghost reaching a disconnected tunnel and re-forming, a ghost not killing Doo, and determinism with the seed.
- [x] 6.3 Implement the Sizzler flame: conditions, 0.6 s warning, 3-tile flame through dirt for 0.5 s, 3 s cooldown, cancelled by inflation.
  - Verify: tests for the warning delay, a flame through dirt killing Doo, and inflation cancelling it.
- [x] 6.4 Implement fleeing: the last enemy waits 1 s, ghosts up to the surface, walks left and escapes; it can be pumped on the surface; flee resumes after inflation.
  - Verify: tests for an escape ending the level, and popping the fleeing enemy.
- [x] 6.5 Apply per-level speeds and the touch-collision rule.
  - Verify: tests that level 5 roams faster than level 1, a roaming Gloop moving into Doo kills, and inflated enemies and ghosts do not.
- [x] 6.6 Render Gloops, Sizzlers (with warning glow and flame), ghost eyes and the fleeing state.
  - Verify by hand on a phone-sized screen: each state is distinct and readable.

## 7. Scoring, game flow, HUD and touch UI

- [x] 7.1 Implement scoring: dig points (not for pre-dug or boulder-opened tiles), pop points by layer with Sizzler ×2 horizontally, the crush table, the bonus gem (after 2 falls, 10 s, level value), and extra lives at 10,000 then every 40,000.
  - Verify: tests for every scoring scenario.
- [x] 7.2 Implement the game state machine: start → READY → playing → dying / level clear → game over → start.
  - Life loss keeps tunnels and the remaining enemies. Level clear on all enemies gone or the last one escaped. Next level gets a new board. 1 s input lock on GAME OVER.
  - Verify: tests for each game-flow scenario.
- [x] 7.3 Implement difficulty progression in `levels.js`.
  - Verify: a test that walks levels 1–15 and checks the monotonic rules, that at least one value gets harder each level up to 11, and the stated limits.
- [x] 7.4 Implement pause (button, P/Escape) with Resume/Quit and a 3-second countdown, and a determinism test.
  - The determinism test runs two seeded simulations for 3,000 steps with identical scripted inputs.
  - Verify: both tests pass, and no timer advances while paused or counting down.
- [x] 7.5 Implement `storage.js` and the canvas HUD: score and high score (live and saved), reserve-life icons, the level number and recent gem icons.
  - Verify: tests for high score save/load and blocked storage; at 320 px width the HUD text is ≥ 10 CSS px and does not overlap.
- [x] 7.6 Implement the DOM touch UI.
  - Pause, sound and settings buttons: ≥ 44 px, inside the safe area.
  - Settings panel: sound and on-screen controls toggles, saved.
  - D-pad (≥ 56 px arrows) and PUMP (≥ 72 px), placed per layout.
  - Verify in Playwright: sizes meet the minimums, nothing overlaps the board, and settings persist after reload.
- [x] 7.7 Draw the start screen (title, cast with names, device-appropriate controls hint, tap to start), READY, PAUSED with countdown, ROUND CLEAR and GAME OVER.
  - Verify with Playwright screenshots on phone and desktop.

## 8. Sound and haptics

- [x] 8.1 Implement `sfx.js`: unlock on first gesture, all listed effects (inflate pitch rising per stage), the flee alarm loop with start/stop, vibration patterns, mute on master gain, suspend/resume.
  - Verify in Playwright: the game runs with no errors when `AudioContext` and `navigator.vibrate` are removed; with audio present, the flee alarm starts and stops with the game events.
- [x] 8.2 Wire the sound toggle (button, settings, M key) with persistence and the muted indicator.
  - Verify in Playwright: mute survives a reload and the indicator shows.

## 9. Install, offline and integration

- [x] 9.1 Add `manifest.webmanifest`, app icons generated by `tools/make-icons.mjs`, and `sw.js` with a versioned precache.
  - Verify: a unit test that every game file is in `FILES` and the manifest icons exist; a Playwright check that the game reloads offline after one online visit.
- [x] 9.2 Write the `README.md` (how to run, install on a phone, controls, tests, manual device checklist, project layout).
  - Verify: the documented `npm start`, `npm test` and `npm run e2e` commands work.
- [x] 9.3 Run the full unit and browser suites and play one full level and a game over in the browser.
  - Verify: all tests pass and the screenshots in `e2e/output/` look right.

## 10. Refinements from the reference article

- [x] 10.1 Disconnect the hose by itself after 0.75 s without a pump while the enemy keeps deflating.
  - Verify: the pump-attack "Enemy recovers" test checks the hose is released at the first deflation and the enemy recovers at 1.5 s.
- [x] 10.2 Make ghosts solid at the first open tile after crossing dirt (with the 1.5 s fallback for ghosts that never crossed dirt).
  - Verify: a test where a ghost crosses dirt into a tunnel that is not Doo's and becomes solid there.
- [x] 10.3 Make enemies bolder when half or fewer remain (roam ×1.15, chase +0.15).
  - Verify: a test that compares a remaining enemy's distance per step before and after half the enemies are gone.
- [x] 10.4 Flee toward the nearer side edge.
  - Verify: tests for an escape to the right from column 11 and a walk to the left from column 3; README updated.
- [x] 10.5 Endless levels.
  - Verify: a test that level 256 generates a valid board with 8 enemies and plays.

- [x] 10.6 While the last enemy rises to the surface, be ghost eyes only over solid dirt and solid (harmful, hookable, crushable, flee speed) over open ground.
  - Verify: a test that rises through dirt then an open shaft and checks the form in each part, plus a test that hooks it in the shaft.
- [x] 10.7 Let the hose pass through ghosts without effect.
  - Verify: a test with a ghost in front of a solid Gloop where the hose hooks the Gloop.

- [x] 10.8 A last enemy that is mid-drift as a ghost starts rising at once (ghost only over dirt).
  - Verify: a test that makes a drifting ghost the last enemy over an open tunnel and sees it become solid and rise.
- [x] 10.9 Stamp the service worker cache version from the game files' contents so a changed file always reaches installed copies.
  - Verify: `npm run stamp` writes the version, and a unit test fails if `sw.js`'s version doesn't match the files.

## Workflow follow-up

- After review, sync the delta specs into `openspec/specs/` and archive the change (`openspec archive add-core-game`).
