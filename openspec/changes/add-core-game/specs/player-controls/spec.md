# Spec Delta

## Purpose

Defines how the player controls Doo:

- Drag-and-hold steering, the optional D-pad and the keyboard.
- The pump input.
- Grid-aligned movement and turning.
- Digging speed.
- Blocking by boulders and the board edge.

## ADDED Requirements

### Requirement: Drag-and-hold steering
Dragging anywhere on the game screen, except on buttons, SHALL steer Doo in the drag's main direction (up, down, left or right). The direction SHALL register as soon as the finger has moved 20 CSS pixels, without waiting for it to lift. Doo SHALL keep moving in that direction while the finger stays down, and SHALL stop when the finger lifts.

#### Scenario: Drag left and hold
- **WHEN** the player touches the board, drags 30 px left and 5 px down, and keeps the finger down
- **THEN** a Left input registers once the finger has moved 20 px, and Doo keeps moving left while the finger is held

#### Scenario: Lifting stops Doo
- **WHEN** the player lifts the steering finger while Doo is moving
- **THEN** Doo stops

#### Scenario: Drag on a button
- **WHEN** a touch starts on the pause button
- **THEN** it is handled as a button press and not as steering

### Requirement: Chained drags without lifting
After a drag direction registers, further movement of the same finger SHALL be able to register a new direction. The start point SHALL reset to where the last direction registered, and a further 20 px move in a different main direction SHALL register that direction.

#### Scenario: L-shaped drag
- **WHEN** the player drags 30 px left and then, without lifting, 30 px up
- **THEN** a Left input registers followed by an Up input

### Requirement: Pump input on touch
A touch on the board that lifts before any direction registers SHALL count as one pump press. While a steering finger is down, touching the screen with a second finger SHALL count as a pump press. Holding that second finger down SHALL repeat the pump as defined by pump-attack.

#### Scenario: Quick tap pumps
- **WHEN** the player taps the board without dragging during play
- **THEN** one pump press registers

#### Scenario: Second finger pumps while steering
- **WHEN** the player holds a left drag with one finger and taps with another finger
- **THEN** a pump press registers, and the Left steering stays held

### Requirement: Optional on-screen controls
The game SHALL offer an on-screen D-pad and a PUMP button. They SHALL be off by default and turned on in settings, and the setting SHALL be saved between sessions.

- Each D-pad arrow SHALL be at least 56 CSS px square and move Doo while it is pressed.
- The PUMP button SHALL be at least 72 CSS px across, pump on touch down, and repeat while held.
- Neither SHALL cover the board.
- Drag steering and tap pumping SHALL still work while the on-screen controls are shown.

#### Scenario: D-pad hold
- **WHEN** the D-pad is on and the player holds its Up arrow
- **THEN** Doo moves up while the arrow is held and stops when it is released

#### Scenario: Setting remembered
- **WHEN** the player turns the on-screen controls on and reloads the game
- **THEN** the D-pad and PUMP button are still shown

### Requirement: Keyboard controls
On devices with a keyboard, arrow keys and W/A/S/D SHALL move Doo while held. When more than one direction key is held, the most recently pressed one SHALL apply. When it is released, the most recent key still held SHALL apply, or Doo SHALL stop if no direction key is held. Space and X SHALL pump, and holding either SHALL repeat the pump. Keys used by the game SHALL NOT scroll the page.

#### Scenario: Held keys
- **WHEN** the player holds Right, then also presses Up, then releases Up
- **THEN** Doo is steered right, then up, then right again

#### Scenario: Arrow keys do not scroll
- **WHEN** the player presses an arrow key or Space while the game page is focused
- **THEN** the page does not scroll

### Requirement: One input model for all controls
Drag, D-pad and keyboard SHALL produce the same two kinds of input: a held direction (or none) and pump presses. Both SHALL be handled by the same movement and pump rules, so the game behaves the same whichever control is used.

#### Scenario: Same result from drag and keys
- **WHEN** the same timed sequence of held directions and pumps is given once by touch and once by keys
- **THEN** Doo follows the same path and the game reaches the same state in both cases

### Requirement: Grid-aligned movement
Doo SHALL move along the center lines of rows and columns, only while a direction is held, and SHALL stop when no direction is held. Doo's movement SHALL follow these rules:

- **Turns:** a perpendicular turn SHALL happen only at a tile center. If one is requested between centers, Doo SHALL keep moving along the current line to the next tile center and turn there.
- **Reversal:** reversing SHALL happen at once at any position.
- **Limits:** Doo SHALL be able to move anywhere within columns 0–13 and rows 1–16, digging through dirt as needed.

#### Scenario: Turn requested between tiles
- **WHEN** Doo is a third of the way between two tile centers moving right and the player switches to holding Down
- **THEN** Doo continues right to the next tile center and then moves down

#### Scenario: Reverse mid-tile
- **WHEN** Doo is halfway between two tiles moving right and the player switches to holding Left
- **THEN** Doo starts moving left immediately

#### Scenario: Board edge
- **WHEN** Doo is at column 0 and the player holds Left
- **THEN** Doo stays at the center of column 0 facing left

### Requirement: Digging is slower than walking
Doo SHALL move at the walking speed through open ground. While the front of Doo's body is entering uncleared dirt, Doo SHALL move at 75% of the walking speed.

#### Scenario: Walk versus dig
- **WHEN** Doo moves 2 tiles through an open tunnel and, separately, 2 tiles through solid dirt
- **THEN** the dig takes longer than the walk, at about 75% of the walking speed

### Requirement: Boulders block Doo
Doo SHALL NOT move into a tile that holds a resting or wobbling boulder. When the next tile in the held direction holds one, Doo SHALL stop at the current tile center facing it.

#### Scenario: Boulder ahead
- **WHEN** Doo moves up toward a resting boulder directly above
- **THEN** Doo stops at the center of the tile below the boulder

### Requirement: Player speed
Doo's speed SHALL be independent of the display frame rate, and Doo SHALL never move far enough in one simulation step to skip a tile.

#### Scenario: Frame-rate independence
- **WHEN** the same input sequence is simulated at 30 and at 144 rendered frames per second
- **THEN** Doo covers the same distance over the same game time
