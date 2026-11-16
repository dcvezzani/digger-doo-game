# Spec Delta

## Purpose

Defines the boulders buried in the dirt: how they come loose, wobble, fall, crush Doo and enemies, and crumble after landing.

## ADDED Requirements

### Requirement: Boulders come loose
A resting boulder SHALL come loose when the tile directly below it is open and Doo's body does not overlap that tile. A loose boulder SHALL wobble in place for 0.75 seconds and then fall. While it wobbles, it SHALL still block Doo and enemies.

#### Scenario: Digging under a boulder
- **WHEN** Doo digs up into the tile directly below a boulder and then moves away sideways
- **THEN** the boulder starts wobbling once Doo has left that tile, and falls 0.75 seconds later

#### Scenario: Doo holds it up
- **WHEN** Doo stays in the tile directly below a boulder after digging it
- **THEN** the boulder does not start wobbling while Doo is there

### Requirement: Falling
A falling boulder SHALL move straight down at 6 tiles per second. It SHALL keep falling while the tile below it is open, and SHALL stop at the center of the last open tile when the next tile is not open or it reaches row 16. The tile the boulder started in SHALL become open once it starts falling.

#### Scenario: Falls down a shaft
- **WHEN** a boulder comes loose above a vertical tunnel 4 tiles deep with solid dirt below it
- **THEN** the boulder falls 4 tiles and lands at the bottom of the tunnel

### Requirement: Crushing
A falling boulder SHALL crush every solid enemy it touches: roaming, fleeing, inflated or hooked. Ghosts and popped enemies are not crushed. Crushed enemies SHALL be carried down with the boulder and removed when it lands, and scored as defined in scoring. If a falling boulder touches Doo, Doo SHALL lose a life.

#### Scenario: Two enemies crushed
- **WHEN** a boulder falls onto two Gloops in the tunnel below it
- **THEN** both are carried down with the boulder and removed when it lands

#### Scenario: Doo crushed
- **WHEN** Doo walks under a falling boulder
- **THEN** Doo loses a life

### Requirement: Crumbling
A boulder that has landed SHALL crumble for 0.5 seconds and then disappear for the rest of the level. A crumbling boulder SHALL NOT block or harm anything.

#### Scenario: Boulder gone after landing
- **WHEN** a boulder lands
- **THEN** half a second later it is gone and the tile it landed in is open

### Requirement: Boulders and lost lives
When Doo loses a life, any boulder that is wobbling, falling or crumbling SHALL be removed. Any enemies it was carrying SHALL count as crushed and be scored. Resting boulders SHALL stay where they are.

#### Scenario: Falling boulder at life loss
- **WHEN** Doo is crushed by a falling boulder
- **THEN** that boulder is gone when the next round starts, and the other resting boulders are still in place
