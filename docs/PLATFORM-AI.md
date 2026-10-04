# Declared creatures and encounters

`@wildshard/game/shardfile/creatures` validates `brains` and `spawns` as data.
V0 has one `pursue` archetype: perception/leash radii, movement/return speeds,
stop distance, turn rate, think divisor, strike cooldown and wander radius/time.
Think divisors divide the fixed 60 Hz clock. Brain ids and spawn ids are unique;
every spawn references a declared brain and a loader-resolved species/strike.

`@wildshard/engine/ai/platform` expands stable spawn identities with
`buildPlatformSpawns` before boot, then installs scoped `PlatformBrain` instances
through `installPlatformBrains`. The creature motor resolves movement; the
brain requests strikes through the existing sim combat pipeline. Perception
asks the engine's world-solid ray query. Navigation arrives through an explicit
path port; an empty path stops movement. Targets are ranked by distance and
stable id. Leashing returns home; idle wandering uses the sim's seeded AI stream.
The brain adapter saves target, mode, tick, strike cooldown and wander waypoint.
The sim snapshot also captures the RNG, actor, motor, strike and physics state.

The template's ordinary grey-blob spawn is declared in
`src/shards/_template/data/creatures.ts`. It remains on the legacy runtime until
SF16 switches the whole template onto the shardfile loader.
