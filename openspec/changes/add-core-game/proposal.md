# Proposal

## Why

We want an original arcade dig-and-inflate game that people play mainly on their phones. It is built spec-first, like its sibling project Neon Nibbler, so each mechanic has a written, testable contract before any code exists. This first change defines a complete playable loop: layered dirt, digging, a pump attack, falling rocks, two enemy types, lives and levels. It is designed for touchscreens in portrait first and still playable with a keyboard on desktop.

The game takes inspiration from the classic tunnel-digging arcade genre but has its own identity. **Digger Doo** stars *Doo*, a small mole in a hard hat with a headlamp. Doo tunnels through four bands of colored earth and fights two kinds of burrowing pests with a *puff pump*:

- *Gloops*: wobbly jelly blobs.
- *Sizzlers*: spiky ember beetles that spit a short flame jet.

Doo can also loosen *boulders* and drop them on the pests. The game does not reuse any existing game's name, characters, level layouts, art or sounds.

## What Changes

- New static web game (HTML5 Canvas + vanilla JS ES modules, no build step), **mobile first**: designed for phone touchscreens in portrait, also working in landscape and on desktop. It reuses Neon Nibbler's proven app-shell approach.
- Installable to the home screen as a full-screen web app (PWA) that plays offline after the first visit.
- Touch controls built for digging:
  - **Steering:** drag to steer; Doo keeps moving while the finger stays down and stops when it lifts.
  - **Pumping:** a quick tap pumps, and a second finger can pump while the first keeps steering.
  - **D-pad:** an optional on-screen D-pad with a PUMP button can be turned on in settings.
  - **Keyboard:** arrow keys or WASD move Doo while held, and Space pumps.
- A 14×16 tile underground board inside a 14×18 tile playfield (1 HUD row on top, 1 on the bottom):
  - A surface row on top, then 15 rows of dirt in 4 colored depth layers.
  - A new seeded layout every level, with enemy burrows and boulders.
- Digging that carves smooth tunnels exactly where Doo goes. Digging is slower than walking through an existing tunnel.
- The puff pump:
  - Fires a short hose along open tunnels and hooks an enemy.
  - Each further pump inflates the enemy one stage, and the fourth stage pops it.
  - A hooked enemy that is not pumped deflates over time and recovers.
- Boulders: once the dirt under a boulder is dug away, it wobbles and falls. It crushes Doo and any enemies in its path.
- Two enemy types:
  - Both roam the tunnels and turn into drifting *ghost eyes* to pass through solid dirt toward Doo.
  - Sizzlers can also breathe a short horizontal flame through dirt.
  - When only one enemy is left, it flees to the surface and escapes off the left edge.
- Scoring:
  - 10 points per newly dug tile.
  - Pop points that rise with depth, doubled for a Sizzler popped from the side.
  - A rising table for crushing several enemies with one boulder.
  - A bonus gem that appears after two boulders have fallen.
  - Extra lives at 10,000 points and every 40,000 points after that.
- 3 starting lives, levels that get harder (more and faster enemies, more frequent ghosting and flames), and a game over.
- A HUD with score, saved high score, reserve lives and level, plus large touch buttons for pause, sound and settings.
- Retro sound effects synthesized with the Web Audio API, and short vibrations on key events on devices that support them. One sound toggle controls both.
- A headless test suite for game logic using Node's built-in test runner, plus Playwright browser checks.

## Capabilities

### New Capabilities
- `app-shell`: How the game fits and behaves on a device: viewport fitting and scaling, orientation, safe areas, blocking page gestures during play, app lifecycle, install and offline play, and frame-rate targets.
- `dirt-board`: The tile grid and playfield layout, the surface row and depth layers, how digging carves tunnels, which tiles count as open, and how each level's layout (enemy burrows, boulders, start shaft) is generated.
- `player-controls`: How the player moves Doo: drag-and-hold, D-pad and keyboard input, the pump input, grid-aligned movement and turning, digging speed, and blocking by boulders and the board edge.
- `pump-attack`: Firing the hose, hooking enemies, inflating by stages, popping, deflating and recovering, and how moving cancels the pump.
- `boulders`: Loosening, wobbling, falling, crushing Doo and enemies, landing and crumbling.
- `enemy-ai`: Gloop and Sizzler behavior: roaming tunnels, ghosting through dirt, the Sizzler flame, the last enemy fleeing, and speeds per level.
- `scoring`: Dig points, pop points by depth, crush combos, the bonus gem, extra lives and the high score value.
- `game-flow`: Start screen, round start, losing a life, level completion and progression, pause, and game over.
- `hud`: On-screen score, high score saving, lives and level indicators, and the touch buttons for pause, sound and settings.
- `sound-and-haptics`: Synthesized sound effects, vibration feedback, unlocking audio on first touch, and the sound toggle.

### Modified Capabilities
- None. This is the first change in the project.

## Impact

- New project files:
  - App files: `index.html`, `manifest.webmanifest`, `sw.js` (offline cache) and app icons.
  - Code and tests: `src/` (core logic, rendering, input, UI, audio), `test/` and `e2e/`.
  - A minimal `package.json` that only holds scripts for `node --test` and a static server.
- No runtime dependencies. Development needs Node 21 or newer for tests. Browser checks use the Playwright and Chromium already on the machine.
- Uses browser `localStorage` (high score, settings), the Web Audio API, the Vibration API where available, and a service worker.
- Must be checked by hand on a real iPhone (Safari) and a real Android phone (Chrome).
