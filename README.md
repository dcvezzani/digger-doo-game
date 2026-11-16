# Digger Doo

An original, mobile-first arcade dig-and-inflate game for the browser. Tunnel through four layers of earth as **Doo**, a little mole in a hard hat. Puff the burrowing pests until they pop, and drop boulders on them.

| Pest | Look | Behaviour |
|---|---|---|
| **Gloop** | wobbly teal jelly | Roams the tunnels and drifts through dirt as ghost eyes, becoming solid at the first tunnel it reaches |
| **Sizzler** | spiky ember beetle | Same, and spits a 3-tile flame through dirt after a short warning glow |

- **Pump:** hook a pest with the hose and pump it 4 times to pop it. Deeper layers score more: 200 / 300 / 400 / 500. A Sizzler popped from the side scores double.
- **Boulders:** dig out the dirt under a boulder, step away, and it falls. Crushing several pests with one boulder scores up to 15,000.
- **Bonus gem:** drop two boulders and a gem appears at the start tile for 10 seconds.
- **Bolder pests:** once half the pests are gone, the rest move faster and chase harder.
- **Last pest:** when only one pest is left, it rises to the surface and runs for the nearer side edge. Stop it before it gets away.

Plain HTML5 Canvas and JavaScript modules. No build step, no runtime dependencies, no audio files. It was built spec-first with [OpenSpec](https://github.com/Fission-AI/OpenSpec), following the same stack and conventions as the sibling project [Neon Nibbler](https://github.com/dcvezzani/neon-nibbler).

## Run it

```bash
npm start
```

Then open http://localhost:8080/. The server also prints a network address, so you can open the game **on your phone** when it's on the same Wi-Fi.

Any static file server works too. The game is just the files in this folder.

## Install on your phone (play offline)

Installing to the home screen and offline play need the game served over **HTTPS**, for example on GitHub Pages or Netlify. Open the URL on your phone, then:

- **iPhone (Safari):** Share → *Add to Home Screen*.
- **Android (Chrome):** menu → *Install app* (or *Add to Home screen*).

After one online visit the game works with no connection. On `localhost` the offline service worker is off by default, so development isn't served stale files. Add `?sw=1` to the URL to test it locally.

## Controls

| | Touchscreen | Keyboard |
|---|---|---|
| Dig / walk | Drag and **hold**. Doo moves while your finger is down and stops when you lift it. Turns chain without lifting | Hold arrow keys or W A S D |
| Pump | Quick tap, or tap with a **second finger** while steering. Hold the second finger to keep pumping | Space or X (hold to repeat) |
| Optional controls | Settings → *On-screen controls* (D-pad + PUMP button) | |
| Start / continue | Tap | Enter or Space |
| Pause | Pause button (top right) | P or Escape |
| Sound and vibration | Sound button or Settings | M |

Doo turns at tile centers. If you ask for a turn between tiles, Doo finishes the step to the next center and then turns. Reversing is instant. Digging is a bit slower than walking through a tunnel you've already dug. Firing the hose stops Doo; a new direction pulls the hose back, and the hose lets go by itself if you stop pumping. Levels never run out. Resuming from pause gives a 3-2-1 countdown. The game pauses itself when you switch apps or lock the phone.

## Tests

```bash
npm test
```

Unit tests for all game rules run headlessly in Node (`test/`). They cover:

- The board, digging and seeded level generation.
- Movement and turning, the drag recogniser and the keyboard stack.
- The pump (hook, inflate, pop, deflate, cancel) and boulders (loosen, wobble, fall, crush).
- Enemy roaming, ghosting, flame and fleeing.
- Scoring, extra lives, the gem, level flow, difficulty progression, pause and determinism.
- Layout, storage and the offline file list.

```bash
npm run e2e
```

Browser checks with Playwright and Chromium (`e2e/`). They cover:

- Phone gestures, drag-and-hold steering and second-finger pumping.
- Layout at 320×568, 390×844, 844×390 and 1440×900, and button, D-pad and PUMP sizes.
- Settings persistence, background pause and offline play.
- Running without audio, and the flee alarm.
- Desktop keyboard play and the game-over screen.

Screenshots go to `e2e/output/`. These checks need the `playwright` package and its Chromium available to Node.

## Manual device checklist

Automated checks can't cover these. Try them on a real iPhone (Safari, installed to the home screen) and a real Android phone (Chrome):

- [ ] Drag-and-hold digging feels responsive. L-shaped drags turn. Lifting stops Doo. A second-finger tap pumps while steering. The D-pad and PUMP button work when on.
- [ ] Sound starts on the first tap. It works again after locking and unlocking the phone and after a call.
- [ ] Every event has its own sound: dig crunch, hose, rising pump stages, pop, boulder rattle and thud, flame hiss, gem, extra life, losing a life, round clear, game start. The flee alarm loops while the last pest escapes, and stops when it's caught or gets away.
- [ ] Android vibrates on losing a life, popping, crushing and clearing a round. Muting stops both sound and vibration.
- [ ] Mute survives closing and reopening the app.
- [ ] Inflation stages are clearly bigger each pump. Sizzlers glow before they breathe fire. Ghost eyes are readable against the dirt.
- [ ] Layer colours change from one level to the next.
- [ ] Play two full levels and a game over at a steady frame rate.
- [ ] The home-screen icon and name look right, and the game opens full screen.
- [ ] Nothing sits under the notch or home indicator, in portrait or landscape.

## Project layout

```
index.html, manifest.webmanifest, sw.js, icons/
src/core/     pure game logic (no DOM): board, layout generator, levels, movement,
              player, enemies, boulders, game, loop, swipe
src/render/   canvas renderer
src/input/    keyboard, touch (drag + pump fingers), D-pad + PUMP
src/ui/       layout (fit, safe areas, orientation, controls) and DOM controls
src/audio/    synthesized sound effects and haptics
test/, e2e/   unit tests and browser checks
openspec/     specs and change proposals (spec-driven development with OpenSpec)
tools/        dev server and icon generator
```

When you change a game file, add it to `FILES` in `sw.js` and bump `VERSION`. A unit test fails if a file is missing from the list.
