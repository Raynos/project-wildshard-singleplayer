# Declared creatures and encounters

`@wildshard/game/shardfile/creatures` validates `brains` and `spawns` as data.
V0 has one `pursue` archetype: perception/leash radii, movement/return speeds,
stop distance, turn rate, think divisor, strike cooldown and wander radius/time.
Think divisors divide the fixed 60 Hz clock. Brain ids and spawn ids are unique;
every ordinary spawn references a declared brain; encounter-controlled spawns use
`brain: null` so only the phase controller writes their motion. Every spawn references and a loader-resolved species/strike.

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


`@wildshard/game/shardfile/encounters` validates ordered phase tables for the
existing Greyback and Big Blob declarations in `data/encounters.ts`. Every
encounter names a declared actor and may name its matching SF7f boss panel.
Each phase declares its health threshold, caption, speed, stop distance and turn
rate. Thresholds start at 1 and strictly descend; the arena, intro/retry durations
and respawn position are bounded data. The accompanying `ENCOUNTER_UI` is the
existing shared boss panel declaration, with the existing strings.

`@wildshard/engine/ai/phases` installs `PhaseEncounter` over the existing
`BossBrain`, fixed-step clock and damage pipeline. A large hit clamps at the
next threshold before damage commits; the phase beat blocks further damage.
Actor strikes use the existing spawn's strike runner. Intro blocks player
weapon damage. Player death restores actor health at the checkpoint, cancels
its pending strike and respawns the player; retry uses the shorter intro.
Victory writes the supplied instance persistence port once and requests the
reward only when `rewardTaken` is false. The durable grant ledger owns the
reward's deduplication and eventual pickup flag.

The continuation includes phase, checkpoint, attempt count, intro/beat clocks,
saved facts and shield state, plus a contract for the exact encounter data.
The actor, strikes, damage clocks and physics remain in the sim snapshot.
Restoration refreshes presentation without repeating grants or save callbacks.
`BossBrain.snapshot/restore` provides this plain continuation for other adapters.

`@wildshard/game/shard/declaredEncounters` binds a mounted SF7f panel to its
encounter and refuses missing panels or differing strings. It never mounts a
second panel. Headless hosts omit HUD handles; their sim closure stays free of
DOM imports. The full loader resolves the schemas, stable spawn/catalogue
references and persistence ports before installing these adapters. SF16 removes
the legacy template classes when that loader becomes the template runtime.
