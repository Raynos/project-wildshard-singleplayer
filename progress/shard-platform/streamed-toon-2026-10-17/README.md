# G475 streamed cover and toon look

Streamed cover uses admitted rows, baked cell bytes and platform-owned
scene resources. The toon look uses a `look/toon` section for its lighting,
fog, shadows, ground assets, kit materials, sky graphs, puffs and clock.
The existing instance upload/swap and sky arithmetic are preserved.
The consumed legacy `nativeView` ground, fog and sky members and their
schemas are removed; `look/toon` supplies those values.

Both game hosts score **6/6** under [HOST-BAR](../../../docs/HOST-BAR.md).
Test 1 uses G475's day-one approval. The marsh and chalk-coast fixtures
exercise independent data through the production hosts.

| Test | Streamed cover | Toon look |
|---|---|---|
| 1. Users / approval | `docs/plans/shard-platform/decisions.md:191`; `test/streamed-cover-platform.test.ts:16` | Same G475 decision; `test/toon-look-platform.test.ts:20` |
| 2. No shard nouns | `src/game/looks/streamedCover.ts:149`: graph/geometry identities come from rows | `src/game/looks/toonSky.ts:30`: graph, channel and sky identities come from rows |
| 3. Data driven | `src/format/streamedCover.ts:13`; executable rows refuse in `test/streamed-cover-platform.test.ts:57` | `src/format/toonLook.ts:35`; executable rows refuse in `test/toon-look-platform.test.ts:51` |
| 4. Client presentation | `src/game/looks/streamedCover.ts:319` | `src/game/looks/toonLook.ts:48` |
| 5. Deletion test | Marsh decoder, attributes, handover and teleport: `test/streamed-cover-platform.test.ts:65` | Chalk ground/scope and sky: `test/toon-look-platform.test.ts:70`, `:102` |
| 6. Data-only API | Private construction behind rows/bytes/resources: `src/game/looks/streamedCover.ts:322` | Product section admission, host-owned hooks: `src/game/looks/toonLook.ts:50` |

The SDK instance utility moves unchanged to the engine, below the game
host. Shared lighting admits one data identity for sky, terrain, cover and
held meshes. Terrain material loans belong to their preparation scope and
are removed on disposal.

## Render parity

[parity.json](parity.json) records the isolated integration tree
`d4981d200e899f44fd0aa739e8d5ce5d1e2926a7` against parent
`427023fff68af1a9c2ca0beba4aa87e0e37db3cd`, including the exact host blobs.
Phone and desktop tiers use iPhone 16 Pro portrait/DPR2, Metal, six real
world poses, midday and night, 180 controlled frames per pose, and the
existing plain-scene parity render. Time and cloud uniforms are pinned;
the viewmodel is hidden by the existing parity harness.

All **24 poses pass SSIM >= 0.9995**. Night is pixel-exact. Midday differs
at one pixel in desktop beach-sea; minimum RGB SSIM is
**0.9999999978194085**. The metric uses a 7x7 uniform window, sample
covariance, RGB channel average and the complete unmasked frame.
Draws, triangles, GPU bytes, programs, shader hashes and collider hashes
match exactly on both tiers and phases.

The existing `scripts/proof-driftwood-look-parity.mjs` runner gains
`--phase=midday|night` and controlled frame advances. Its authored-scene
attribute reconstruction remains intact. Use separate `--raw` and
`--output` paths per phase and build when repeating the capture.

## Frame floor

[frame-floor.json](frame-floor.json) records the same isolated pair with
the official frame-floor runner. Desktop passes every measured pose;
worst p95 remains 16.8 ms. The runner chooses the two heaviest scanned
standing cameras in addition to spawn, so their desktop names can vary.

Simulator retains its existing absolute floor miss, with lower p95 at
every matching standing pose:

| Pose | Parent p95 | Integration p95 |
|---|---:|---:|
| Spawn | 69 ms | 44 ms |
| Beach | 52 ms | 48 ms |
| Wreck | 53 ms | 45 ms |

These are Mac-backed Mobile Safari measurements. The receipts retain the
runner's scope and limitations.

## Map publication

G490 assigns the official clean map bake and strict post-generation
all-10 product build to sp-x10's central batch commit. This source landing
is handed to that owner before the batch is pushed.

## Source checks and ruler

The final source candidate passed root, layer and scripts types, typed
lint, all ten shard products and 43 focused tests, including the 17
headless cases. Its eight host blobs match the isolated parity tree.
The source-basis ruler ran in the build mirror against parent
`b90201ec9e0054c8bcf650566dafd2cff61b497d`:

| Measure | Net |
|---|---:|
| Driftwood custom lines | -451 |
| Driftwood shard source | -450 |
| Driftwood attributed platform | -1 |
| Engine | +99 |
| Game | +380 |
| SDK | -99 |
| Format | +76 |
| Net platform source | +456 |

All other shards and AssemblyScript are unchanged by this source slice.
Driftwood has 4,751 custom lines after adoption, including 249 in C2.
The final parent also retains the coordinator's intervening status update;
that update changes no measured source or build inputs. The non-strict
source build reports Driftwood's expected map mismatch; sp-x10 owns the
next official bake and strict build before push.
