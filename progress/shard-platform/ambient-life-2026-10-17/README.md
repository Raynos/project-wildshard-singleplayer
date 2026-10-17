# Ambient life as flock rows (G474 / G477)

Pine's scavengers, night sentinels and trunk foragers now use the game's
row-driven `AmbientGroup`, alongside Driftwood's gulls and Pine's guide
ravens. The whole Pine visitor module and Driftwood gull wrapper are
deleted. The existing engine wheel/guide flight and SDK instanced draw
remain the movement and presentation paths. There are no shader, material,
geometry, batching or collider changes.

Rows admit seed, bounded counts, numeric perches and weights, flight and
wingbeat parameters, arrival/circle/feeding/perch/flee motion, call ids and
pose channels. Optional numeric light and weather gates park a presentation
group without advancing its clock or reseeding it. Missing weather samples
refuse the gate. Pine's shipped rows have no new restrictions.

Carcass selection, harvest rewards, guide discovery and story remain
counted shard rules. This feature adds no AssemblyScript guest. Arbitrary
shard decisions and authoritative spawn/retire commands stay on ABI v1;
these render-free presentation groups do not create combat actors.

## Host bar

Score: **6/6**. The same evidence is recorded in the landing body.

| Test | Evidence |
|---|---|
| Two real users | `src/shards/pine-hollow/runtime/life/ambientLife.ts:71`; `src/shards/driftwood-isle/world/build.ts:160`; shared SDK binding `src/sdk/looks/ambientFlock.ts:35` |
| No shard nouns | `src/game/ambient/flock.ts:2` imports only engine/format; generic row selection `src/game/ambient/flock.ts:353` |
| Data-driven | Strict rows `src/game/ambient/flock.ts:349`; independent marsh count, scale, weather, perch, pose and cues `test/ambient-flock-host.test.ts:101` |
| Server-safe | Numeric RNG/flight/terrain imports `src/game/ambient/flock.ts:2`; client presentation stays in `src/sdk/looks/ambientFlock.ts:14` |
| Deletion test | Independent marsh visitors `test/ambient-flock-host.test.ts:101`; engine wheel/guide branch remains `src/game/ambient/flock.ts:353` |
| Data-only API | Constructor row/site admission `src/game/ambient/flock.ts:348`; scalar observations `src/game/ambient/flock.ts:15`; gates `src/format/ambientLife.ts:48` |

## Proof

The pinned shipping trace names its source revision and visitor SHA-256 in
`test/fixtures/ambient-poses.json`. Its five scenarios cover 18,000 complete
seeded bird-state/call frames. Tests compare exact hashes, separately check
counts, release, night gates and flee, reject function-bearing site rows,
drive three small daytime visitors from made-up marsh rows, and verify that
a gated posed draw reserves its full population before first visibility.

Measured source cuts are Pine 312 and Driftwood 4 (316 total). The game
grows by 347 lines, SDK shrinks by 1, and the format adds 4 counted lines: 350 net
platform lines including format. AssemblyScript stays at Pine 351/2,130
and Driftwood 96/1,716.

Source ruler, map stamps, pixel comparisons and check results are
recorded in `proof.json` with the landing.
