# Spec Delta

## Purpose

Defines how the game fits and behaves on the device it runs on, phones first. That covers screen fitting, orientation, safe areas, page gestures, background and resume, installing to the home screen, offline play and smoothness.

## ADDED Requirements

### Requirement: Fit the playfield to the screen
The 448×576 playfield SHALL scale to the largest size that fits the available screen area while keeping its aspect ratio. Drawing SHALL be sharp on high-density screens. Scaling SHALL NOT change game logic or speed.

#### Scenario: Portrait phone
- **WHEN** the game opens on a 390×844 portrait phone screen
- **THEN** the playfield spans the full width inside the safe area, and when the D-pad is on, the space below the playfield holds the D-pad and the PUMP button

#### Scenario: Screen resized or rotated
- **WHEN** the screen is rotated or the browser window is resized
- **THEN** the layout is recalculated, the playfield is rescaled to fit, and gameplay continues with no change in game state

#### Scenario: Sharp on high-density screens
- **WHEN** the device pixel ratio is 3
- **THEN** the playfield is drawn at the device's full resolution with no blurring of tunnels, characters or text

### Requirement: Portrait first, landscape supported
Portrait SHALL be the primary layout. In landscape the playfield SHALL be centred at the full available height. When the on-screen controls are on, the D-pad SHALL sit on one side of the playfield and the PUMP button on the other, so neither covers the board.

#### Scenario: Landscape with on-screen controls
- **WHEN** the phone is in landscape and the D-pad is on
- **THEN** the board is centred, and the D-pad and PUMP button sit beside it without overlapping any board tile

### Requirement: Respect safe areas
No playfield tile, HUD text or button SHALL be placed under a notch, rounded corner, home indicator or system bar. The background SHALL extend edge to edge behind them.

#### Scenario: Phone with a notch
- **WHEN** the game runs on a phone with a notch in portrait
- **THEN** the top HUD sits below the notch and the background color fills the area behind the notch

### Requirement: No page gestures during play
While the game is on screen, touches SHALL NOT scroll, zoom (pinch or double-tap), pull-to-refresh, select text or show the long-press menu.

#### Scenario: Double-tap and drag down
- **WHEN** the player double-taps the board and then drags down from the top of the playfield
- **THEN** the page neither zooms nor refreshes, and the drag is read as a Down input

### Requirement: Pause when backgrounded
When the page becomes hidden (app switch, screen lock, incoming call), the game SHALL pause, stop its animation loop and silence audio. On return it SHALL stay paused until the player resumes.

#### Scenario: Phone locked mid-level
- **WHEN** the screen is locked during play and then unlocked
- **THEN** the game shows "PAUSED", no game time passed while locked, and play resumes only after the player taps resume

### Requirement: Installable as an app
The game SHALL provide a web app manifest with name, icons and portrait orientation, so supporting browsers can add it to the home screen. When launched from the home screen it SHALL open full screen without browser controls.

#### Scenario: Launch from home screen
- **WHEN** the player adds the game to the home screen and opens it from there
- **THEN** it opens full screen with the Digger Doo icon and name

### Requirement: Offline play
After one successful online visit, the game SHALL load and be fully playable with no network connection. A newly published version SHALL be picked up on a later launch without the player clearing data.

#### Scenario: Airplane mode
- **WHEN** the player has opened the game once online, turns on airplane mode and opens it again
- **THEN** the game loads and plays normally

#### Scenario: Update available
- **WHEN** a new version is published and the player opens the game online twice
- **THEN** the new version is running by the second launch at the latest

### Requirement: Smooth frame rate
On a mid-range phone from 2021 or later, the game SHALL render at the display's refresh rate, up to 60 fps, with no sustained drops during normal play. The first screen SHALL appear within 2 seconds on a typical mobile connection.

#### Scenario: Busy moment
- **WHEN** eight enemies are on screen, two boulders are falling and floating scores are shown
- **THEN** the frame rate stays at or near 60 fps on the reference phone

### Requirement: Desktop support
On a desktop browser, the game SHALL be fully playable with the keyboard and mouse. It SHALL use the same layout rules, with the playfield centred in the window.

#### Scenario: Desktop window
- **WHEN** the game opens in a 1440×900 desktop browser window
- **THEN** the playfield is centred at full window height, and keyboard controls and clickable buttons work
