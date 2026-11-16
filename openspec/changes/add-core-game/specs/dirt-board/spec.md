# Spec Delta

## Purpose

Defines the underground board: the tile grid and screen layout, the surface row and the four depth layers, how digging carves tunnels, which ground counts as open, and how each level's starting layout is generated.

## ADDED Requirements

### Requirement: Playfield grid dimensions
The playfield SHALL be a logical grid of 14 columns by 18 rows of square tiles, with 32 logical pixels per tile (448×576). The rows SHALL be laid out as follows:

| Rows | Use |
|---|---|
| 0 | Top HUD |
| 1 | Surface row |
| 2–16 | Dirt |
| 17 | Bottom HUD |

How the playfield is scaled to the screen is defined by app-shell.

#### Scenario: Board occupies the middle rows
- **WHEN** the playfield is laid out
- **THEN** the board (surface plus dirt) occupies exactly rows 1 through 16 across all 14 columns, and no board content is drawn in rows 0 or 17

### Requirement: Depth layers
The dirt SHALL be split into four depth layers, each drawn in its own color:

| Layer | Rows |
|---|---|
| 1 | 2–5 |
| 2 | 6–9 |
| 3 | 10–13 |
| 4 | 14–16 |

The surface row SHALL count as layer 1 for scoring. The layer colors SHALL change from level to level so consecutive levels look different.

#### Scenario: Layer of a tile
- **WHEN** an enemy is popped on row 11
- **THEN** it is treated as being in layer 3

### Requirement: Digging carves tunnels
Dirt SHALL be cleared wherever Doo's body passes, at a resolution finer than one tile (a quarter tile or finer), so tunnels follow Doo's path smoothly. A tunnel SHALL be exactly as wide as Doo. Cleared ground SHALL stay cleared for the rest of the level, including after a life is lost.

#### Scenario: Partial dig
- **WHEN** Doo moves half a tile into solid dirt and stops
- **THEN** about half of that tile is shown cleared and the rest remains dirt

#### Scenario: Tunnels survive a lost life
- **WHEN** Doo has dug a tunnel and then loses a life
- **THEN** the tunnel is still there when the next round starts

### Requirement: Open tiles
A tile SHALL be open when all of its ground is cleared. The surface row SHALL always be open. Enemies (except as ghosts) and the pump hose SHALL only move through open tiles. A tile holding a resting or wobbling boulder SHALL NOT be open to any entity.

#### Scenario: Partly dug tile blocks enemies
- **WHEN** a tile is only partly cleared
- **THEN** a roaming enemy does not enter it

### Requirement: Level layout generation
Each level SHALL start with a fresh board generated from the game seed and the level number, so the same seed and level always give the same layout. Every generated layout SHALL contain:

- A pre-dug start shaft in column 6 from row 2 down to row 8, with Doo starting at tile (6, 8).
- One pre-dug straight burrow of 3 open tiles per enemy, horizontal or vertical, entirely within rows 3–16. Each enemy starts at the middle tile of its burrow.
- Boulders on solid dirt tiles in rows 3–15.

The layout SHALL obey these rules:

- Each burrow SHALL be at least 3 tiles away, horizontally or vertically, from the start shaft.
- No burrow SHALL touch another burrow or the shaft, side by side or end to end.
- The tile directly below each boulder SHALL be solid at the start, so no boulder is loose when the level begins.
- No two boulders SHALL be in the same column on adjacent rows.

#### Scenario: Same seed, same board
- **WHEN** two games are created with the same seed and both reach level 2
- **THEN** both level 2 boards have identical burrows, boulders and start shaft

#### Scenario: Layout rules hold
- **WHEN** layouts are generated for levels 1 to 30 with several seeds
- **THEN** every layout passes the rules above, and each enemy's start tile is open
