# Script ABI spawn director — G474 / G484

Pine's night guest owns placement, wave iteration, millrace wake/completion,
and dawn retirement. The built-in spawn owner accepts bounded logical slots,
species/site recipe ids and v1 commands. Existing population lifetimes remain
the authority for native ids, recipe RNG draws and saved bodies.

The four deleted runtime modules are `quest/nativeWaves.ts`, `quest/waves.ts`,
`quest/pageWaves.ts` and `quest/waveRows.ts`. Seven grandfathered callback
crossings disappear from the ratchet (three, one and three respectively).
There is no shard-specific callback in the new public API.

## HOST-BAR: 6 / 6

| Test | Score | Evidence |
|---|---|---|
| Two users / approved feature | 1 | G474-approved spawn feature, under HOST-BAR test 1's explicit exception. `test/pine-night-emits.test.ts:107` compiles a separate salt-marsh guest and exercises heron species, static site rows and logical handle 7 through real native bodies. Pine's shipping rows are `src/shards/pine-hollow/generators/nightSpawn.ts:29`. Nalati's pending G477 user is registered in `lint/platform-pending-users.json`. |
| No shard nouns | 1 | `src/game/population/spawnScript.ts:84` resolves a declared roster and species; `src/format/spawnScripts.ts:10` defines generic slots/species/sites. The host has no Pine constants or branches. |
| Data-driven | 1 | `src/format/spawnScripts.ts:40` validates recipe references and capabilities; `src/game/population/spawnScript.ts:152` resolves the command's recipe id to species/site and owned slot. Night rules live in `src/shards/pine-hollow/behaviour/night.as:47`. |
| Server-safe | 1 | `src/game/population/spawnScript.ts:288` installs the native runner on the actual SimHost. `test/pine-night-emits.test.ts:54` runs real Rapier/native population without a browser. The separate page adapter is explicitly labelled client-only at `src/game/population/spawnScript.ts:93`. |
| Deletion test | 1 | Independent guest at `test/pine-night-emits.test.ts:107` still needs bounded v1 spawn/retire, capacity checks, native ids and continuation if Pine is removed. Those operations are `src/game/population/spawnScript.ts:127` and `:222`; no night scheduler lives there. |
| Data-only API | 1 | `src/game/population/spawnScript.ts:84`, `:94` and `:288` take concrete existing platform authorities plus rows. Constructor/body ports are private at `:62`; scripts name recipe ids. Legacy field/group wire names are declared data at `src/format/spawnScripts.ts:21`. |

The already-existing actor roster retains its separately documented 5 / 6
score: its grandfathered ground/pose callbacks are not newly credited here.
The new host resolves that concrete installed authority internally; callers do
not supply a body port, reflection path or TS decision callback.

## Continuation and parity

- `test/pine-night-emits.test.ts:136`: 120 seeded old-sampler comparisons
  match coordinates, facing, accepted species/order, placement RNG state,
  actor ids and the real roster RNG snapshot (six recipe draws per actor).
- `test/pine-night-emits.test.ts:87`: old outer v1 / population v2 saves adopt
  existing ids, accumulator, placement stream, flee ages and race wake state.
  Migration runs without Wasm calls, new draws, spawning or presentation.
  The native save owner preserves the validated input wire through a quiet
  re-save, then writes the new continuation after simulation advances.
- `test/pine-night-emits.test.ts:54`: quiet v2 restore, smooth native escape
  mechanics and dawn retirement.
- `test/pine-night-emits.test.ts:74`: millrace wake, all-three-dead completion
  and no dawn respawn. `:172` rejects forged continuations without mutation.

The published placement seed is the shard identity seed (1337), matching the
old native `Rng(level.seed).fork(step)` stream. The separate embedded
director seed (357) does not own placement. The product-boundary fixture
checks this relationship.

The guest derives elapsed decision time from `Clock.tick`, so start/spawn
events cannot shorten the wave clock. Its one-second accumulator has rounding
tolerance; waves are due at ticks 60, 120 and 180, and ABI command commit
creates their bodies at ticks 61, 121 and 181.
Decisions run at the accepted 10 Hz (G415/G416); smooth stalk movement remains
in the existing engine mechanics at 60 Hz. The two-f64 `radial` list query
uses the portable host's sin/cos while AS retains every placement draw and
acceptance rule. Generic boss decisions still refuse spawn/retire without an
installed population owner; this feature supplies that concrete owner.

The new `actors/spawn-scripts` catalogue declares owned v1 modules for the
same inventory and memory admission as normal decisions, while keeping their
execution owners separate. Catalogue rows carry no executable inline bytes;
`src/game/population/spawnScript.ts:302` resolves the exact admitted module.
`test/pine-night-emits.test.ts:192` guards this product-boundary distinction.

## Measurements and checks

The source-basis ruler in the build mirror compares matching source trees
based on `d5f5118249ebf707dbb20b2ec779e93bcd9cffa5`:

| Charge | Before | After | Net |
|---|---:|---:|---:|
| Pine custom | 9,311 | 9,020 | -291 |
| Driftwood custom | 5,549 | 5,551 | +2 |
| All other shards | unchanged | unchanged | 0 |

net -289 shard lines (Pine -291, DW +2)

The two Driftwood lines are existing `CreatureGroupStream` and
`CreatureGroupGround` declarations, now charged to their sole remaining user.
Platform code adds 306 lines; format code adds 67 outside that ruler. Pine
has 351 AssemblyScript source lines including this 80-line night guest,
below its 2,130-line ceiling.

The native assembly installs the director after the real population roster;
all body identity and draw ownership exists before the director is bound.


Final isolated proof tree: `d42f1c1638c89fcf2eea9ddc3e1a2f4210b76dbb`.
It includes the landed contracts slice. Merged Pine measures 8,821 custom
lines and 351 AS lines; the paired feature-only ruler above isolates this
slice's -291 from the separate contracts reduction.

- Root and layer types, changed typed lint and path validation passed.
- All ten products built; all 41 focused cases passed, including the 17
  shard-headless cases and the seven real-body spawn fixtures.
- Archived DW Captain: 1,000 worker-exact ticks, matching hash
  `5ac20ce6da0d12b8ee015703d848da2b0d786364b416af613f05b89c660141a7`.
- Archived Pine King: 1,200 exact ticks after v1 migration, matching hash
  `ab13f335e181a00db61f93116a5c677ed4ac767507e8e2ab08c2bd2f24bcdc3e`,
  with zero restore re-emissions.
- Fresh Pine: 1,200 exact ticks, matching hash
  `40b7cb65bfb6783a83c7a8a1565b8183cbf51d09d912b1cbc8697aa1455f193d`.
- The uninterrupted 31,301-tick journey passed alive, King defeated and
  dawn complete; durable ledger reload, deduplication and refusal/retry
  passed. Wave/race/mill/dawn phase and placement fixtures passed above.
- G485: official `bake-maps.mjs --shards=pine-hollow` on the served proof
  tree produced a6ea7dbfa701674dfd18b976de11ea657d60ba5123a22d4e6c74bbc0aafab7b1
  as the map-input hash. The 95,090-byte map's pixels are byte-identical;
  pixel hash 5ff27135406a6b9ff2258922aa2d0eba7cf65fbaa01470a18e2368f2f4fc93d1.
  The bake and new stamp land with the feature; private staging refuses
  changed Pine map inputs after capture.

Checkpoint hash metadata is recorded in the separate cadence commit, with
its unchanged phase tick table. The muted served-HEAD phone check follows
that landing.
