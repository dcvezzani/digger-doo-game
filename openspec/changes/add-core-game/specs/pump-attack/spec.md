# Spec Delta

## Purpose

Defines Doo's puff pump: firing the hose, hooking an enemy, inflating it in stages until it pops, deflating and recovering, and how moving cancels the pump.

## ADDED Requirements

### Requirement: Firing the hose
A pump press while no hose is out SHALL fire the hose from Doo's center in the direction Doo is facing. While the hose is out, Doo SHALL stop moving. The hose SHALL follow these rules:

- It SHALL extend at 16 tiles per second, up to 3 tiles beyond Doo's center.
- It SHALL only extend through open tiles.
- If it reaches its full length or a tile that is not open without touching an enemy, it SHALL be withdrawn at once (a miss).
- After a miss, Doo SHALL be able to move or fire again 0.15 seconds later.

#### Scenario: Miss in a tunnel
- **WHEN** Doo fires the hose to the right along an empty open tunnel
- **THEN** the hose extends 3 tiles, is withdrawn, and Doo can move again shortly after

#### Scenario: Blocked by dirt
- **WHEN** Doo faces solid dirt and fires the hose
- **THEN** the hose does not pass into the dirt and is withdrawn at once

### Requirement: Hooking an enemy
When the extending hose touches a solid enemy, the hose SHALL stop at that enemy and hook it. A solid enemy is one that is roaming, fleeing or already inflated; ghosts, popped enemies and crushed enemies cannot be hooked. Hooking SHALL inflate the enemy to stage 1. Only the nearest enemy along the hose SHALL be hooked, and only one enemy can be hooked at a time.

#### Scenario: Hook a Gloop
- **WHEN** Doo fires left along a tunnel and a Gloop is 2 tiles to the left
- **THEN** the Gloop is hooked and inflated to stage 1

#### Scenario: Ghosts cannot be hooked
- **WHEN** the hose passes over a tile where an enemy is drifting as a ghost
- **THEN** the enemy is not hooked

### Requirement: Inflating and popping
Each pump press while an enemy is hooked SHALL inflate it one more stage. Presses SHALL count at most once every 0.2 seconds. Holding the pump input SHALL pump again every 0.3 seconds. At stage 4 the enemy SHALL pop: it shows a burst, is removed from the level, and scores as defined in scoring.

#### Scenario: Four stages pop
- **WHEN** Doo hooks a Gloop and then gives three more pump presses at least 0.2 seconds apart
- **THEN** the Gloop pops on the third extra press

#### Scenario: Holding pumps automatically
- **WHEN** Doo has hooked an enemy and the player holds the pump input
- **THEN** the enemy gains a stage every 0.3 seconds until it pops

### Requirement: Inflated enemies are helpless
An enemy at stage 1 or higher SHALL NOT move or breathe flame. Touching it SHALL NOT cost Doo a life. A flame that was being prepared or breathed SHALL be cancelled when the enemy is inflated.

#### Scenario: Touching an inflated enemy
- **WHEN** Doo walks into an enemy at stage 2
- **THEN** Doo does not lose a life

### Requirement: Deflating and recovering
An inflated enemy SHALL lose one stage for every 0.75 seconds that pass without a pump. If 0.75 seconds pass without a pump while an enemy is hooked, the hose SHALL disconnect by itself. The enemy SHALL stay frozen and harmless while it deflates. When it reaches stage 0, it SHALL return to its normal behavior.

#### Scenario: Enemy recovers
- **WHEN** Doo inflates a Gloop to stage 2 and then stops pumping
- **THEN** the hose disconnects about 0.75 seconds after the last pump, and about 1.5 seconds after the last pump the Gloop is back to normal and moving again

### Requirement: Moving cancels the pump
Starting a new direction while the hose is out SHALL withdraw the hose and release any hooked enemy, and Doo SHALL move in that direction. A new direction is a new key press, a new drag direction or a new D-pad press. Losing a life SHALL also withdraw the hose. A direction that was already held when the hose was fired SHALL NOT cancel it. Once the hose is withdrawn by a miss or a pop, Doo SHALL move again in that held direction.

#### Scenario: Walk away mid-pump
- **WHEN** an enemy is hooked at stage 2 and the player presses a direction
- **THEN** the hose is withdrawn, Doo moves, and the enemy starts deflating

#### Scenario: Pump while steering
- **WHEN** the player holds Left and taps a second finger to pump, and the hose misses
- **THEN** Doo stops while the hose is out and then continues left
