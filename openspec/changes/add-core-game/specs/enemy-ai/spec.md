# Spec Delta

## Purpose

Defines how the Gloop and Sizzler enemies behave:

- Roaming the tunnels.
- Drifting through dirt as ghost eyes.
- The Sizzler's flame.
- The last enemy fleeing.
- Speeds per level.
- When touching an enemy costs Doo a life.

## ADDED Requirements

### Requirement: Two enemy types
The game SHALL have two enemy types, each with its own name and look:

- **Gloop:** a round, wobbly, translucent teal jelly blob with two eyes.
- **Sizzler:** a spiky orange-red ember beetle.

Each enemy SHALL show which way it is facing. Level N SHALL have min(8, 4 + floor((N − 1) / 2)) enemies, of which max(1, floor(total / 3)) are Sizzlers and the rest Gloops.

#### Scenario: Level 1 cast
- **WHEN** level 1 starts
- **THEN** there are 3 Gloops and 1 Sizzler, each in its own burrow

#### Scenario: Level 9 cast
- **WHEN** level 9 starts
- **THEN** there are 8 enemies: 6 Gloops and 2 Sizzlers

### Requirement: Roaming tunnels
A roaming enemy SHALL move along the center lines of open tiles in rows 2–16, and SHALL choose its direction only on reaching a tile center. It SHALL use these rules:

1. **Options:** the neighboring tiles that are open and hold no boulder.
2. **No reversal:** it SHALL NOT reverse unless no other option exists.
3. **Choice:** with the level's chase chance it SHALL pick the option whose tile is closest in straight-line distance to Doo's tile, breaking ties in the order up, left, down, right. Otherwise it SHALL pick an option at random using the game's seeded random source.
4. **No options:** it SHALL wait in place.

#### Scenario: Stays in its burrow
- **WHEN** a round starts and Doo has not dug near an enemy's burrow
- **THEN** the enemy moves back and forth inside its burrow without leaving it through dirt, until it turns into a ghost

#### Scenario: Chases through a connected tunnel
- **WHEN** the chase chance is 100% and an enemy reaches a junction where the left option is closer to Doo
- **THEN** it turns left

### Requirement: Ghosting through dirt
Each enemy SHALL turn into floating ghost eyes when its ghost timer runs out. The ghost timer SHALL be the level's ghost interval plus a seeded random 0–2 seconds, and SHALL never run out in the first 3 seconds of a round. A ghost SHALL behave as follows:

- It SHALL drift in a straight line toward Doo's current position at the level's ghost speed, passing through dirt and boulders and staying within the board.
- It SHALL be harmless, and SHALL NOT be hooked or crushed.
- It SHALL become solid again at the center of the first open, boulder-free tile its center reaches after passing through solid dirt, whether that tile is where Doo is or only along the way. A ghost that has not passed through dirt SHALL become solid at the first such tile once it has been a ghost for 1.5 seconds. Its ghost timer SHALL then restart.

#### Scenario: Ghost reaches Doo's tunnel
- **WHEN** an enemy's ghost timer runs out while Doo is in a tunnel not connected to the enemy's burrow
- **THEN** the enemy drifts as ghost eyes through the dirt toward Doo and becomes solid again once it is over an open tile

#### Scenario: Becomes solid along the way
- **WHEN** a ghost drifting toward Doo crosses dirt and then passes over another open tunnel before reaching Doo's tunnel
- **THEN** it becomes solid in that other tunnel

#### Scenario: Ghost is harmless
- **WHEN** a ghost passes over Doo before it has become solid again
- **THEN** Doo does not lose a life

### Requirement: Sizzler flame
A roaming Sizzler at a tile center SHALL roll the level's flame chance, using the seeded random source, when all of these hold:

- Doo is in the same row and no more than 4 tiles away horizontally.
- Its flame cooldown is over.

If the roll succeeds:

1. The Sizzler SHALL stop, face Doo and glow for 0.6 seconds as a warning.
2. It SHALL then breathe a flame covering the next 3 tiles in that direction, passing through dirt and stopping at the board edge, for 0.5 seconds.
3. Doo SHALL lose a life if Doo's center is inside the flame.
4. The cooldown SHALL then be 3 seconds.

The flame SHALL NOT dig dirt or harm enemies.

#### Scenario: Flame through dirt
- **WHEN** a Sizzler breathes flame to the right while Doo is 2 tiles to its right behind one tile of solid dirt
- **THEN** Doo loses a life

#### Scenario: Warning before the flame
- **WHEN** a Sizzler decides to breathe flame
- **THEN** it glows for 0.6 seconds before any flame appears

### Requirement: The last enemy flees
When exactly one enemy is left that has not been popped or crushed, that enemy SHALL flee once it is not inflated:

1. After 1 second it SHALL rise straight up its own column to the surface row.
2. While it rises, it SHALL be ghost eyes only while its center is over solid dirt (or a boulder), moving at the ghost speed. While its center is over open ground, it SHALL be solid and move at the flee speed.
3. On the surface it SHALL walk, at the flee speed, toward the nearer side edge: left from columns 0–6, right from columns 7–13.
4. When it walks off that edge of the board, it SHALL escape.

Whenever it is solid, rising through open ground or walking on the surface, it SHALL be harmful and SHALL be able to be hooked, inflated and crushed. A fleeing enemy that recovers from inflation SHALL continue fleeing. A fleeing enemy SHALL NOT breathe flame.

#### Scenario: Last enemy escapes
- **WHEN** only one Gloop remains in column 11 and Doo does not stop it
- **THEN** it rises to the surface, walks right and leaves the board, and the level ends

#### Scenario: Solid in cleared ground while fleeing
- **WHEN** the last enemy rises through 3 rows of solid dirt and then up an open vertical tunnel to the surface
- **THEN** it is ghost eyes while in the dirt, and solid (it can be hooked and is harmful) while in the open tunnel

#### Scenario: Nearer edge on the left
- **WHEN** the last enemy rises to the surface in column 3
- **THEN** it walks left toward column 0

### Requirement: Enemy speeds
Enemy speeds SHALL be set per level as percentages of Doo's walking speed:

| Movement | Level 1 | Change per level | Limit |
|---|---|---|---|
| Roaming | 70% | +3% | 95% |
| Ghost | 55% | +2% | 75% |
| Fleeing | 110% | none | 110% |

Enemy speeds SHALL be independent of the display frame rate.

#### Scenario: Faster on later levels
- **WHEN** level 5 starts
- **THEN** roaming enemies move faster than on level 1

### Requirement: Enemies grow bolder as they are defeated
Once half or fewer of a level's enemies remain (not popped, crushed or escaped), the remaining enemies SHALL roam 15% faster than the level's roaming speed. Their chase chance SHALL also rise by 0.15, up to a maximum of 1. The fleeing enemy SHALL keep its flee speed.

#### Scenario: Half the enemies gone
- **WHEN** 2 of the 4 enemies on level 1 have been popped
- **THEN** the remaining 2 roam at 15% above the level 1 roaming speed and chase Doo more often

### Requirement: Touching enemies
Doo SHALL lose a life when Doo's body overlaps a solid enemy that is roaming or fleeing, meaning their centers are less than three quarters of a tile apart both horizontally and vertically. Touching a ghost, an inflated enemy, a popped enemy or a crushed enemy SHALL NOT cost a life.

#### Scenario: Caught by a Gloop
- **WHEN** a roaming Gloop moves into Doo
- **THEN** Doo loses a life
