# Spec Delta

## Purpose

Defines the overall game loop: the start screen, starting a round, losing lives, finishing levels and moving on, pausing, and game over.

## ADDED Requirements

### Requirement: Start screen
When the game loads, it SHALL show a start screen with:

- The title "DIGGER DOO".
- Doo, a Gloop and a Sizzler with their names.
- A short controls hint matching the device: drag and tap on touch screens, keys on desktop.
- A prompt to tap, or press Enter or Space, to start.

#### Scenario: Starting a game by tapping
- **WHEN** the start screen is shown on a phone and the player taps the screen
- **THEN** a new game begins at level 1 with score 0 and 3 lives

#### Scenario: Starting a game by keyboard
- **WHEN** the start screen is shown on desktop and the player presses Enter or Space
- **THEN** a new game begins at level 1 with score 0 and 3 lives

### Requirement: Round start pause
Each new round, at the start of a level or after losing a life, SHALL show a "READY" message for about 2 seconds with everything frozen in its start position before play begins.

#### Scenario: Ready message
- **WHEN** a round begins
- **THEN** "READY" is shown, nothing moves for about 2 seconds, and then play starts

### Requirement: Losing a life
Doo SHALL lose a life when touched by a harmful enemy, burned by a flame or crushed by a boulder. Play SHALL freeze, a short loss animation SHALL play, and one life SHALL be subtracted. If lives remain, a new round SHALL begin:

- Doo SHALL return to the start tile, and the remaining enemies to their start tiles, all at normal size.
- The dug tunnels, the resting boulders and the set of remaining enemies SHALL stay as they were.

#### Scenario: Caught with lives left
- **WHEN** Doo is touched by a roaming Gloop while having 3 lives and 2 of 4 enemies have been popped
- **THEN** lives drop to 2, Doo and the 2 remaining enemies return to their start tiles, the tunnels are unchanged, and a READY round starts

### Requirement: Level completion
A level SHALL be complete when every enemy has been popped or crushed, or when the last enemy has escaped. Play SHALL then freeze for about 2 seconds with a "ROUND CLEAR" message. The next level SHALL then begin with a freshly generated board, the same score and lives, and the level number increased by one.

#### Scenario: Popping the last enemy
- **WHEN** Doo pops the last remaining enemy on level 1
- **THEN** "ROUND CLEAR" is shown and level 2 starts on a new board

#### Scenario: Last enemy escapes
- **WHEN** the last enemy walks off the left edge of the surface
- **THEN** the level ends and the next level starts, with no points for that enemy

### Requirement: Difficulty progression
Each new level up to level 11 SHALL be harder than the one before:

- Enemy roaming speed SHALL not decrease.
- The ghost interval SHALL not increase.
- The enemy count, chase chance and flame chance SHALL not decrease.
- At least one of these SHALL get harder at every level until all reach their limits.

The ghost interval SHALL be 9 seconds at level 1, shorten by 0.5 seconds per level, and stop at 4 seconds. The chase chance SHALL start at 50% and rise to 85%. The flame chance SHALL start at 25% and rise to 60%.

#### Scenario: Level 2 is harder
- **WHEN** level 2 starts
- **THEN** enemies roam faster or turn into ghosts sooner than on level 1, and nothing has become easier

### Requirement: Pause
During play the game SHALL pause when the player taps the pause button or presses P or Escape. Pausing SHALL stop all timers and movement and show "PAUSED" with Resume and Quit options. Resume SHALL show a 3-2-1 countdown before play continues. Quit SHALL return to the start screen.

#### Scenario: Resume countdown
- **WHEN** the player resumes from pause
- **THEN** a 3-second countdown is shown during which nothing moves, and then play continues

### Requirement: Game over
When the last life is lost, the game SHALL show "GAME OVER" with the final score. Input SHALL be ignored for 1 second so a stray tap does not skip the screen. After that, a tap, Enter or Space SHALL return to the start screen.

#### Scenario: Last life lost
- **WHEN** Doo loses its last life
- **THEN** "GAME OVER" and the final score are shown, and a tap after 1 second returns to the start screen

### Requirement: Deterministic simulation
The game simulation SHALL advance in fixed steps of 1/60 second, and all randomness SHALL come from a seeded random source. Two games with the same seed and the same timed inputs SHALL produce identical states.

#### Scenario: Replay matches
- **WHEN** two games are created with the same seed and fed the same inputs for 3,000 steps
- **THEN** their states are identical at every step
