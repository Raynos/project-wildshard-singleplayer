# TX1: shared texture lifetime

TX1 is repaired: all four ABBA runs complete the three roads on desktop
and Simulator with zero render faults. The frame-floor target remains
open. Entry pacing has mixed results and stays off by default.

## Reproduction and owner chain

The reduced desktop route is Pine road entry, then Driftwood road entry.
It reproduces on `d860db471` with only disposal-stack diagnostics added
(`10d21090e`). Pine completes: travel p95 16.7 ms, whole-drive p95 16.8 ms,
max 50 ms. After Pine retires, Driftwood records no travel frames and the
render loop stops with `rock_moss_set_01_diff` missing its allocation.
The run is incomplete; those missing frames are never substituted.

The texture's CPU mip chain retires after its first successful real draw,
through `compressedUpload` and `compressedMipmaps`. That retirement does
not free the native allocation. A later PBR source-material cleanup calls
`texture.dispose()` directly. The captured native disposal stack points
into the bundled `worldSceneMaterials` callback; its texture has no scene
owner because it belongs to the shared atlas cache. The renderer then
finds the unchanged retired texture bound again without an allocation.

The cache registered the atlas through `createModelLibrary` and
`retainCachedResources`. The PBR source loader also borrowed its maps,
but owned a direct disposal callback instead of an asset reference.
The upload observer counted managed resources for residency without
acquiring a reference for each binding scope. A page draw outside a
cell's delegated tree therefore also needed a real scoped acquisition.
Level-root cleanup independently bypassed scene ownership with raw
`Scope.own`; the regression reproduces that premature disposal too.

The first fixed candidate (`efdacb531`) removes that raw cache disposal but
still fails Driftwood admission on an unnamed retired private texture. A
second trace (`092266341`) resolves its disposal to
`sceneOwnership.ts:103`: the last counted private lease belongs to
`grid.world:pine-hollow`. A later lookup attempts level adoption after the
native allocation has already gone. The renderer keeps drawing, but the
road does not complete; this attempt receives no performance credit.
[The second disposal record](second-disposal.json) preserves the stack.
Independent missing consumer paths include shader-patch samplers and page
compilation outside delegated roots. Four additional regressions fail
before those paths acquire references and pass afterward. A further
regression preserves the captured owner of a stand-in whose source retires
before late compilation. Those unit fixes alone do not close the live
route: `4744259c0` still refuses Driftwood admission when its warm-up requests
`waystone-lod1-albedo` after Pine retires. [This attempt](third-fault.json)
receives no performance credit. The [native property trace](readiness-fault.json)
then distinguishes this from a disposal: the waystone allocation remains live,
with matching native texture/source versions. Its provisional key records
anisotropy 1, while the texture scalar later became 4 without a version
increment. Three continues binding the old live version; the warm-up
readiness check incorrectly demands pixels for its different scalar key.
Retired readiness now follows the native version and guarded allocation,
preserving the exact drawn filtering. No sampler update is forced.

## Ownership fix

- A cached input acquires a reference from its existing asset service.
  That service remains its sole disposal authority.
- Private scene textures keep one lease per using scope and retire after
  the last scope leaves. Final tree capture does not dispose them twice.
- Renderer bindings retain private and cached textures per scope. A page draw
  outside delegated cell roots uses the renderer level. Destination
  compilation retains samplers before their first draw.
- PBR source and level-root cleanup use that ownership path.

Retired readiness accepts the unchanged live native version; allocation
loss and post-retirement mutations still refuse. Sampler configuration,
native texture identity and first-draw CPU mip
retirement stay the same. No shard branches, map inputs, rendering data,
shader edits or new Debug rows. The existing `entry` pacing pick stays off.

## Regression and visual proof

Fifteen lifecycle regressions cover shared scopes in either teardown order,
common-parent teardown, final tree capture, level-root cleanup, cached
source references, the actual PBR source loader, private and cached page samplers outside
cell roots, a compiled destination before its first draw, shader-patch samplers declared or
exposed during compile, page-owned compilation before its first draw, and
a live retired upload with a provisional native sampler key. The original
implementation fails the premature-disposal and missing-reference cases.
The new test is registered in `scripts/gate-test-products.json`.

The before visual capture is `0aab25946`: its shard data matches the
baseline and it predates the cached source/renderer fix. Pine has 20
phone/desktop poses; Driftwood has 12. The after capture `d460c6e2a` passes exact comparison on all 32 poses: RGBA pixels, draws,
triangles, GPU bytes, programs, executable shader sources and colliders.
Pine desktop raw labels differ; executable sources are byte-exact.
[Parity receipt](look-parity.json). Captures use the existing native look proof,
Metal and the iPhone 16 Pro profile; raw frames stay only in scratch.
This pair isolates TX1 on matching shard data; later peer source landings
are retained separately at integration.

## Paired travel measurements

A is existing build pacing `on`; B is `entry`. Both use the same fixed
served source pin `d460c6e2ae12045e5ad4bc51c588d960dcc82a88`, DEVSERVER.
The order is A1, B1, B2, A2, with fresh pages for each run, Sky/Pine/DW roads,
120 travel samples and the standard GL observer. The Simulator uses the
canonical `frame-floor-iphone-17-pro` device, phone tier and 2x render scale;
the desktop uses 1440×900/2x with display/vsync enabled and fps=auto.
KTX2 is pinned and the Simulator capability probe skipped to exercise the
fault path, matching the earlier experiment. Profiling and frame timelines
are off. No own builds or suites ran concurrently. Other shared-machine
load, shader-cache warmth and two replicates per setting limit timing claims.

Every run is complete, every surface has an empty error list, and all 24
road crossings pass their motion/residency witnesses with no context loss.
The five harness file hashes remain identical throughout. Every run still
misses at least one frame-floor row. [Full measurements](paired-travel.json).
An earlier overlapping A1 is retained only as [functional proof](functional-three-road.json);
it receives no performance credit.

Each cell below is **p95/max milliseconds**, in ABBA order.

### desktop

| Road / window | A1 | B1 | B2 | A2 |
| --- | ---: | ---: | ---: | ---: |
| Sky travel | 16.8/83.4 | 16.8/66.6 | 16.7/66.7 | 16.8/66.7 |
| Sky whole drive | 16.7/83.4 | 16.8/66.6 | 16.7/66.7 | 16.8/66.7 |
| Sky interior | 16.7/16.8 | 16.8/16.8 | 16.8/16.8 | 16.7/16.8 |
| Pine travel | 16.7/16.8 | 16.7/33.3 | 16.7/33.3 | 16.7/16.8 |
| Pine whole drive | 16.8/66.6 | 16.8/83.3 | 16.8/66.5 | 16.8/66.7 |
| Pine interior | 16.7/16.8 | 16.7/16.8 | 16.8/16.8 | 16.7/16.8 |
| DW travel | 33.4/50 | 33.3/66.6 | 33.4/66.6 | 33.4/83.4 |
| DW whole drive | 16.8/50 | 16.8/66.6 | 16.8/66.6 | 16.8/83.4 |
| DW interior | 16.7/16.8 | 16.7/33.3 | 16.7/16.8 | 16.7/16.8 |

### sim

| Road / window | A1 | B1 | B2 | A2 |
| --- | ---: | ---: | ---: | ---: |
| Sky travel | 34/158 | 34/124 | 35/152 | 34/161 |
| Sky whole drive | 34/158 | 34/124 | 36/152 | 34/161 |
| Sky interior | 34/35 | 34/35 | 34/35 | 34/35 |
| Pine travel | 34/71 | 34/68 | 34/80 | 34/107 |
| Pine whole drive | 36/101 | 35/82 | 36/99 | 35/107 |
| Pine interior | 34/35 | 34/37 | 34/35 | 34/39 |
| DW travel | 35/63 | 43/58 | 45/87 | 39/65 |
| DW whole drive | 40/149 | 35/85 | 36/98 | 37/82 |
| DW interior | 34/59 | 35/39 | 34/35 | 34/50 |


Entry improves Simulator DW whole-drive p95 in both B runs (35/36 versus
40/37 ms), but worsens DW travel p95 (43/45 versus 35/39 ms). DW whole-drive
max is not a repeatable win: A2 is 82 ms, against B's 85/98 ms. Sky B2
whole-drive p95 regresses to 36 from both A runs' 34 ms. Pine whole-drive
p95 overlaps at 35–36 ms, and desktop p95 has no meaningful gain.
There is no overall pacing win. Entry stays off; any default flip belongs
to the coordinator. TX1 closure does not close the broader frame-floor row.

## Final checks and accounting

Sealed final-runtime candidate `b0a9c1dcd` on eighth map seal `cbb225d2d`
passes strict `CI=1 node scripts/build-shardfiles.mjs`: all ten products,
zero stale-map warnings. Root/layer types, typed lint and 58 cases pass,
including 17 headless and all 15 lifecycle regressions.

Integration `2e2b19794` includes the landed Pine cabin source and passes
root/layer types and typed lint. It builds all ten products, then STRICTLY
REFUSES Pine's pending map stamp. This is the coordinator's source-only
G490 window, not a strict-green claim. TX1 changes no declared map inputs
and runs no bake. With all products prepared, all 60 focused cases pass,
including 17 headless and 15 lifecycle cases. The scratch wrapper then
fails after the passing suite on a missing helper before accounting;
accounting reruns separately successfully in the exact prepared mirror.
[Check receipt](checks.json) preserves both outcomes and the earlier
invalid fixture attempt. Final integration `dd16301bd` on `6322000c2` passes root/layer types,
typed lint and **61 cases**, including the 17 headless and 15 lifecycle
cases. All ten products build; strict mode correctly refuses the pending
Pine and DW stamps in this source-only window. No map inputs change.
The final ruler derives its parent from the immutable candidate and
measures the exact post-generation inventory.

The source-basis ruler reports **net +51 platform lines** (engine +50,
game +1), **net 0 shard lines** across all shards. The existing shared
material import had already landed with the cabin consumer. No runtime
file is deleted by this engine defect repair. [Platform ruler](platform-ruler.json),
[post-generation component inventory](candidate-ruler.json).

A muted iPhone 16 Pro Pine→DW check will run on the exact local-main commit
before the coordinator receives its landing receipt; it is reported by its
separate proof-run result, without a proof-only follow-up commit.
