# Driftwood cover composition

`world/GroundCover.ts` is deleted whole. The existing streamed-cover host
receives the same rows, geometry, baked cells and scene resources. Authored
`data/coverComposition.json` selects the existing `foliage.logs` placement,
`logs.mesh` native handle, group name and picking flag. No host field or
API changes. The wrapper's placed membership remains available to named
place sets.

The entry landing rows now travel through the validated named product
blob `world/entry-landings.json`; runtime types come from the producer.
This removes the old runtime import of generated build-only inputs.
The model guard retains only the frozen legacy GroundCover allowance.

Source-basis ruler: DW **3,708 → 3,681**, net **−27** shard lines.
Pine stays 4,800; platform runtime lines +0; DW AssemblyScript stays 119.
Measured post-generation with `scripts/shard-platform.mjs` in the mirror.

## Verification

The [machine-readable receipt](proof.json) retains hashes and counts for
28 exact views: six scripted poses and eight site views on each of phone
and desktop tiers. Pixels, calls, triangles, pieces, collider descriptors,
GPU bytes, programs and shader sources agree exactly. Eight physics walk
legs report zero stuck. A muted iPhone 16 Pro real-title entry reached
live play at render scale 2 without errors.

Native proof used `c1288919`; the final source's world builder emits
byte-identical JavaScript after build-only type imports were replaced by
producer types. C9/C5 source changes were composed separately into the
final candidate. Root/layer types, typed lint, the five focused test files
(43 tests including 17 shard-headless cases), all ten products and path
checks passed. The guard corrections retain the legacy path and declare the detached
compile-only stand-in described below.

Desktop medians were 59.88 fps. Candidate spawn p95 reached 33.4 ms;
baseline spawn p95 was 16.8 ms. Simulator ABBA readings were noisy and
automatically selected different standing cameras: common spawn p95
medians were 43.5/40.5 ms, wreck 42/48 ms. These are inconclusive, with no
performance regression or improvement claimed. The coordinator allowed
this composition-only deletion under G415; the next build-path change
uses pinned standing cameras and requests a quiet measurement window.

## Existing host bar: 5/6

No platform source changes in this landing. The existing streamed-cover
host remains 5/6, with test 1 covered by the approved-platform exception:

1. One current user; G475 approval is recorded in
   `lint/platform-pending-users.json:2199`.
2. Generic cell/window/appearance implementation:
   `src/game/looks/streamedCover.ts:30`.
3. Rows and baked cell bytes:
   `src/game/looks/streamedCover.ts:324`.
4. Client-only presentation label:
   `src/game/looks/streamedCover.ts:321`.
5. Reusable geometry/cell streaming independent of this composition:
   `src/game/looks/streamedCover.ts:30`.
6. Data and platform-owned scene resources, no shard callback:
   `src/game/looks/streamedCover.ts:324`.

## Map closure

Source-only landing in the ninth window (G490). Map refresh belongs to
sp-x10. Changed declared inputs are the world root (wrapper deletion and
builder edit), generators/output.ts, generators/sections.ts and the new
direct data/coverComposition.json input. A strict fresh-map product proof
belongs to the canonical map closure; stale-map warnings here are expected.

The checker also carries sp-x6's missing count-1 declaration for the
compile-only zero-count InstancedMesh stand-in at
`src/engine/render/precompile.ts:273`. It borrows the original layout and
buffers, stays detached and draws no world content. The coordinator
approved carrying this bounded declaration with the wrapper retarget;
the commit records the required `Builder-Call: ratify` trailer.
