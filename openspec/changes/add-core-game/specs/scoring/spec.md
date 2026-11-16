# Spec Delta

## Purpose

Defines how points are earned: digging, popping enemies by depth, crushing enemies with boulders, the bonus gem, and extra lives.

## ADDED Requirements

### Requirement: Dig points
Doo SHALL score 10 points each time a tile becomes fully open through Doo's digging. Tiles that were open at the start of the level, opened by a boulder leaving them, or already open SHALL NOT score.

#### Scenario: Digging a new tile
- **WHEN** Doo digs through one full tile of solid dirt
- **THEN** the score increases by 10

#### Scenario: Walking a tunnel
- **WHEN** Doo walks back through a tunnel already dug
- **THEN** no dig points are scored

### Requirement: Pop points by depth
Popping an enemy SHALL score points based on the depth layer of the tile the enemy is in:

| Layer | Points |
|---|---|
| 1 (including the surface row) | 200 |
| 2 | 300 |
| 3 | 400 |
| 4 | 500 |

A Sizzler popped by a horizontal hose (Doo in the same row) SHALL score double.

#### Scenario: Deep Gloop
- **WHEN** Doo pops a Gloop on row 15
- **THEN** the score increases by 500

#### Scenario: Sizzler from the side
- **WHEN** Doo pops a Sizzler on row 7 with the hose pointing left
- **THEN** the score increases by 600

### Requirement: Crush points
When a boulder lands, it SHALL score according to how many enemies it crushed:

| Enemies | Points |
|---|---|
| 0 | 0 |
| 1 | 1,000 |
| 2 | 2,500 |
| 3 | 4,000 |
| 4 | 6,000 |
| 5 | 8,000 |
| 6 | 10,000 |
| 7 | 12,000 |
| 8 | 15,000 |

#### Scenario: Double crush
- **WHEN** a boulder crushes two enemies
- **THEN** the score increases by 2,500 when it lands

### Requirement: Bonus gem
Once two boulders have started falling in a level, a bonus gem SHALL appear at Doo's start tile, at most once per level. It SHALL stay for 10 seconds or until Doo collects it by touching it. The kind and value SHALL depend on the level:

| Level | Gem | Points |
|---|---|---|
| 1 | Quartz | 400 |
| 2 | Amber | 600 |
| 3–4 | Jade | 800 |
| 5–6 | Ruby | 1,000 |
| 7–8 | Sapphire | 2,000 |
| 9–10 | Opal | 3,000 |
| 11–12 | Emerald | 4,000 |
| 13–14 | Topaz | 5,000 |
| 15–17 | Diamond | 6,000 |
| 18+ | Starstone | 8,000 |

Collecting it SHALL award its points and show them where it was. A lost life SHALL remove a gem that is showing.

#### Scenario: Gem appears and is collected
- **WHEN** the second boulder of level 1 starts falling and Doo reaches the start tile within 10 seconds
- **THEN** a Quartz gem appeared at the start tile and collecting it scores 400

#### Scenario: Gem expires
- **WHEN** the gem is not collected within 10 seconds
- **THEN** it disappears without scoring

### Requirement: Extra lives
The player SHALL earn an extra life at 10,000 points and at every 40,000 points after that (50,000, 90,000 and so on). Each threshold SHALL award at most one life.

#### Scenario: First extra life
- **WHEN** the score goes from 9,900 to 10,100
- **THEN** one extra life is added

#### Scenario: Second extra life
- **WHEN** the score later goes past 50,000
- **THEN** another life is added, and passing 10,000 again cannot award a second life

### Requirement: High score tracks the score
The high score value SHALL update at once whenever the current score goes above it. How it is saved and shown is defined by hud.

#### Scenario: Beating the high score
- **WHEN** the high score is 3,000 and the score reaches 3,010
- **THEN** the high score becomes 3,010
