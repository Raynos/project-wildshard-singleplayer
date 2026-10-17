# Simulator road, paced travel continuations (2026-10-17)

The standing 30–60 fps goal remains open until every required row passes
both quiet AFTER runs. The floor is p95 ≤35.0 ms and maximum ≤200 ms.
Part seven measures the three travel rows left open by part six: Nalati,
Pine and Driftwood. The prior quiet checkpoint is `554322770`: 9/12 rows
pass in both runs; travel p95 is Nalati 45/43, Pine 42/40 and DW 39/42 ms.

## Attribution

The BEFORE diagnostic pins `f8e5ff189`, which follows part six's fix.
Native Time Profiler records all processes for 166.009 seconds. Only the
game's three Simulator WebContent identities and their main-thread
samples are retained. The in-page task clock also records synchronous
Promise reaction bodies, including where each reaction was registered.
Two page/wall clock anchors put every travel interval on the native
trace clock. Anchor drift is 0 ms for Nalati/DW and 1 ms for Pine.

All 47 observed travel intervals over 35 ms are retained individually
in `native-evidence.json`: Nalati 23, Pine 9, DW 15. These diagnostics run
under ordinary shared-machine load, with instrumentation, and have no
quiet frame-floor timing credit. Observers add work, including clocks
around typed-array copies. Reaction durations include that overhead;
they do not estimate the uninstrumented conversion cost. The 1 kHz sample
weights describe sampled running work. Microtasks and GC are nested categories; they
must not be added to main-thread time. Missing CPU samples do not prove
an idle or blocked thread. Native export reports 4,469 overlapping
Simulator dylib-map warnings; process identities, clock anchors and
readable stacks remain available. Unknown JIT frames are not assigned
an authored function name. Raw all-process traces/XML were deleted
after compact extraction and are not committed.

| Travel interval | Main sample weight | Nested microtasks | Exact page evidence |
| --- | ---: | ---: | --- |
| Nalati 111 ms | 101 ms | 91 ms | Continuations plus nested GC; no single named function explains it |
| Pine 97 ms | 66 ms | 56 ms | Long continuation work |
| Pine 137 ms | 15 ms | 9 ms | Unexplained remainder; no scheduler-only dismissal |
| DW 114 ms | 113 ms | 107 ms | Enemy-placement Promise reaction lasts 102 ms |

The DW reaction was registered in `Enemies.build` after its blob/head
loads. It restores the placement rows and creates several previously
uncached creature models in one synchronous continuation. Its awaits
have already resolved; no frame can run inside that reaction. A second,
separate targeted diagnostic observes individual factory calls: eleven
calls total 202 ms across the drive, with the longest 21 ms, nested in a
94 ms placement reaction. Those nested times are not additional work.

Nalati's targeted diagnostic measures a 27 ms synchronous byte-lane
restoration inside travel. The old bodies/place reader resumes from the
inflate promise and restores the entire lane array before resolving its
caller. It bypassed the already paced geometry reader's lane path.

Pine's targeted diagnostic measures a 41 ms reaction in KTX2Loader's
parse completion wrapper: opaque RGB ETC2 widening. This operation is
**measurement-pin-only**: `--ktx2-probe=skip` bypasses the normal GPU
capability probe, and the existing widening prevents the Simulator's
RGB8 ETC2 upload crash. Real players' normal probe does not take this
path. The largest 41 ms call starts just before the travel window;
smaller reactions also overlap travel. In the native-recorded travel,
three consecutive 8 ms reactions sit inside a 36 ms interval and four
inside a 41 ms interval. Those are separate promise completions that
run back to back without a drawn frame. It is a measured drive cost,
not proof that it alone caused Pine's travel p95.

`page-evidence.json` retains exact operation stacks and per-frame
context for the native recording. `targeted-evidence.json` is a separate
instrumented run, never merged onto the native recording's clock.
Temporary source-map-aware observers wrap lane restoration, factory
model construction and geometry restoration without changing their
arithmetic. Safari initially reused immutable module URLs; that run
has no targeted-span credit. The valid targeted run uses fresh module
filenames with composed source maps. No diagnostic code is shipped.

## Scheduling fix

The existing engine lane reader now owns the canonical lane operation.
Nalati's species, place and dressing bakes join the same bounded,
page-lived path as crags and Pine's rain. The narrow SDK facade is lazy
so Node authoring configurations retain their single-module boundary.
Pine and Nalati both use that facade in this landing. Each block checks
the existing shared frame budget; cancelled construction owners cannot
strand the page's in-flight cached read.

`AnimalFactory.prepareModels(rows)` prepares ordinary kind/variant data
under the calling construction scope, checking the shared budget before
each model. DW awaits it through the existing `animalsBuilt` hook before
placing actors. Pine uses it for its existing boss/parked-variant warmup.
A null/omitted variant prepares every declared variant, covering the
manager's later random roll without consuming that stream. The model key
seeds, geometry bytes, cache identities and placement RNG are preserved.
Retirement refuses further construction. The operation creates no actors.
DW's placement bookkeeping remains local and passes only data rows to the
existing creature spawner.

The existing pin-only ETC2 widening now checks that same budget between
4,096-block batches. The synchronous bake helper exhausts identical
steps. Complete mip chains publish atomically; every colour and opaque
alpha byte is identical. Concurrent callers share the in-flight conversion;
its weak entry is removed on settlement, and the texture version advances
once. Normal capability-probe/format policy is
unchanged. This scheduling fix does not claim a physical-phone benefit
from pacing the pin-only conversion.

There are no shader, material, camera, render-scale or simulation changes.
Exact geometry/byte regressions exercise the touched paths. Full-scene
framebuffer parity is not inferred from these tests. No look changes or
variant board are introduced.

Both Nalati and Pine receive official `bake-maps.mjs` refreshes from a
served build of this candidate in the same source landing. Pine's reader
import is a declared map input, as is Nalati's place reader. Their stamp
hashes must match the landed world inputs; no old stamp is retagged.

## Host bar

The scheduling extensions pass **6/6**. Source references in this table use pacing commit `64265f932`.
Each row below supplies evidence for all six tests in `docs/HOST-BAR.md`.

| Test | Lane reader/facade | Model preparation | Existing ETC2 conversion |
| --- | --- | --- | --- |
| Two real users | Nalati `species/bodies.ts:65`, Pine `runtime/looks/rainFx.ts:61` | DW `creatures/Enemies.ts:163`, Pine `runtime/index.ts:233` | Pine `runtime/looks/paintedTextures.ts:28`, Nalati `look/nalatiTextures.ts:121`, through engine `core/assets.ts:88` |
| No shard nouns | Engine `core/deflate.ts:32`, SDK `kit/geometryPack.ts:187` | Engine `entities/AnimalFactory.ts:314` | Engine `core/ktx2.ts:86` |
| Data-driven | URL and bytes, `core/deflate.ts:42` | Kind/variant rows, `AnimalFactory.ts:314` | Texture/mip bytes, `core/ktx2.ts:86` |
| Server-safe / client presentation | Node byte/lifetime tests, `test/whole-geometry-pacing.test.ts:102` | Client geometry/material preparation; Node geometry test `test/animal-model-preparation.test.ts:24` | Client compressed texture conversion; renderer-free test `test/ktx2-widen-etc2.test.ts:41` |
| Deletion test | Pine still needs its rain bake if Nalati vanishes | Pine still needs cached variants if DW vanishes | Other texture consumers still need pin-safe uploads if Pine vanishes |
| Data-only API | URL string, `core/deflate.ts:42` | Rows without callbacks, `AnimalFactory.ts:314` | CompressedTexture value, `core/ktx2.ts:116` |

## Validation and measurements

Focused regressions cover exact lane bytes and ranged restoration, malformed
and failed inputs, the page lifetime after retirement, exact factory
geometry/bones/cache identity, refusal after scope retirement, exact ETC2
mips and atomic publication. The new factory test is registered in
`scripts/gate-test-products.json`; the touched ETC2 test is registered too.
Root and layer types, typed lint, the 17 shard-headless cases and all ten
products run from the candidate's immutable build-mirror tree.

The ruler uses `sourceProgressInventory` from `scripts/shard-platform.mjs`
in the build mirror. Each side has its own complete generated products;
this is the source-basis component inventory, not a copied repository or
an output/source percentage comparison. Ruler evidence retains exact
parent/tree pins and the per-shard changes. No runtime file is deleted;
this performance landing earns no whole-file deletion credit.

Quiet AFTER uses an exact landed SHA and fresh served build. Only AFTER
requests a coordinator CPU hold. The runner takes BSD `fcntl.flock` on
`.git/push.lock`, waits for existing jobs with native process-exit events,
checks empty heavy/browser/Simulator lanes and creates its own `.git/quiet`
marker. `finally` removes that marker, releases the BSD lock and sends
explicit `HOLD RELEASE, BOTH surfaces`. Push overlap invalidates a run.
The normal-probe Pine pair is measured separately; no time is subtracted
from a recorded frame to pretend that a conversion did not occur.

The prior part-six pair is a checkpoint comparison. Other mainline work
has landed since then; BEFORE diagnostics and the AFTER pair do not form
an isolated causal A/B experiment across those intervening changes.

## Landed source and exact validation

Source fix: `64265f9326e29a52c3c41fd989d93cf46ccf2ae7`, parent
`ef7f29ccd7de1ea6cae366c7378ea149b62b5578`, tree
`e449cb70836807ee0964ec5107fcf1e2368e34db`.

**net -2 shard lines (Nalati -11, Pine -3, DW +12)**. Platform runtime
TypeScript grows 75 physical lines (Git diff); no format lines are added.
No runtime file or module is deleted. This performance fix earns no
whole-file deletion credit. All other shards have zero ruler change.

Final mirror validation passes root and layer types, typed lint, all ten
products, focused geometry/model/ETC2 regressions, all 17 headless cases,
and all product image-pixel checks. The later explicit map-input check
found a stale Pine stamp; see the correction below. Source and exact-parent
ruler pins are retained in `source-checks.json` and `ruler.json`.
Proof: `.git/proofs/20261017T142721-sp-x1-road7-landing-validation-41483.json`.
Both private-index landing hooks also pass; no peer hunks are included.

Official map bakes use source tree
`514807e0c522b3bf2551e11968baca90fe780fcd`. Its tracked declared inputs are
identical to the final landing tree. Ignored generated schemas can also
contribute to its hash; see the correction below. Both map image bytes match the
previous official rasters; only their world-input stamps change:

- Nalati: `c070e8b0853fedf127f589a801a7962989c33c3bd76aaaa40684adcaa0dc377c`.
- Pine: `9c302d18d9bca4bfc651a11880c1453b87e56559b721e49f441fcc70aa8e0e94`.

## Map validation correction

The original final command included `test/baked-maps.test.ts`, a file
that does not exist. Vitest ran the other matching files: seven files,
40 tests. That result supplies no map-test credit. The all-product build
checks image pixels, but reports stale map input hashes as warnings
outside CI. Its Pine freshness warning was missed before source landing.

The official bake reacquired the shared mirror after preview generation.
Ignored `generators/sectionSchemas.generated.ts` survives mirror switches
and contributes to Pine's declared `generators/` inputs. A bake must run
regeneration, official capture and explicit input/pixel assertions within
one continuous mirror lease. No source stamp is retagged as a substitute
for that capture. The coordinator was told to withhold push while the
canonical check/correction is completed. The eventual resolution and
exact proof are recorded below.

H6 reports its continuous combined-source pipeline green at candidate
`d8e9e726aa31947f9bb732dc2388658ff7806820`: regeneration, all ten products,
types/lint/30 focused tests, exact served build, regeneration plus official
Pine/DW bakes, explicit `mapTilesHash == stamp.tilesHash` and
`verifyMapPixels`, then all ten products with no stale warning. Its
canonical Pine hash is the same `9c302d18…8e0e94` recorded above: the
original bake had inherited H6's future generated schema. H6 landed its corresponding source in `5f63be75d`; that source makes
the stamp canonical on main.
The old Road7 SHA alone does not pass strict map-input freshness.
H6's committed receipt is `progress/shard-platform/ambient-life-2026-10-17/proof.json`.


## Safari entry-load regression

The first quiet AFTER attempt at `64265f932` never reached the title: it
remained at DW Props. That incomplete run has no frame-floor credit.
Chromium and desktop Playwright WebKit both loaded the same source, so
neither supplied the missing Mobile Safari proof. The hold was released.

A fresh-origin served build of origin/main `ef7f29ccd` reproduces the same
failure: `undefined is not a constructor (evaluating 'new this.Runtime')`
at `level.world`, after Props. It predates the pacing change. Origin's
exact build was `ef7f29c-mvcth5c0` at localhost port 4471. Both the
coordinator and deploy lane were told to hold promotion for this repair.

The manifest emitter had loaded the runtime, its linked native module and
entry adapter concurrently, destructuring constructor exports from the
results. The repair awaits each namespace in order before reading its
constructors. Both Pine and DW use the emitted path. It changes no host
API, map input or shard runtime file.

The regression executes the actual emitted loader against delayed linked
module initialization. Its concurrent control rejects an unfinished
runtime, and ordered loading preserves both constructor identities. This
unit fixture covers the ordering contract; the real Safari proof supplies
the actual DW load through Props and world drawing.

Uninstrumented, cold Simulator Safari on served candidate tree
`3442448a91d996865b3ee031a8a44ee7c128a687` completes DW with zero page
errors and draws spawn, beach and pier. The task-clock/Promise observers
are absent. This boot-only reading runs under ordinary shared load and
fails the frame floor; it supplies no quiet timing credit.
`boot-regression.json` retains the origin failure, candidate completion
and incomplete first AFTER attempt without game session identifiers.

Repair landing: `87c717f317a2c27808849bf523cb45a0d897256e`, parent `caa8ef651eb54654d0b3d9f5f51ae7e613da09f7`.
**net -0 shard lines (all shards -0)**. No runtime file is deleted.
The emitter is build-only; HOST-BAR does not apply to a new runtime host.
The final immutable check passes 44 tests across manifest, client-plan,
grid preparation and the 17 headless cases, plus root/layer types, typed
lint and all ten products. Both real landing hooks pass.


The repair's final ruler and checks pin `bd2215e7` over `538918559`.
Main moved by the rig landing while those checks ran; the private repair
index was rebuilt on `caa8ef651`, carrying only the three repair paths.
The emitter and semantic regression bytes are identical to that validated
candidate. The earlier Safari preview differs in tests/registry and
unrelated mainline content, not in the repaired emitter. The exact-landed
boot check below covers the resulting combined build.


The exact landed repair build `87c717f-mvcu7r2o`, served from a fresh
localhost origin, also completes DW through Props, world ready
and spawn/beach/wreck drawings with zero page errors. This is a second
uninstrumented Simulator boot regression, not a quiet floor pass.
The first restarted quiet attempt was interrupted/discarded after the
deploy lane announced a critical Linux CI test repair and push. Its
38-second partial run earns no timing credit. The runner released its
BSD push lock and quiet marker; its Simulator and worker children closed.


## Pine grid admission blocker found during AFTER

The restarted quiet cohort at `87c717f317` is incomplete. It recorded Sky
and Nalati, then Pine failed `play` and stayed closed; the route timed
out. Every captured error points to `Import signature outside ABI`.
No paired floor credit is taken from this incomplete cohort, including
its partial Sky/Nalati rows. `incomplete-after.json` retains them as
provisional diagnostics: Sky drive p95 44 ms and Nalati travel 43 ms.

A cold build of origin `99cba0b9a`, with untracked derived files removed
inside one mirror lease and fresh generation/product caches, reproduces
Pine GRID admission failure in uninstrumented phone Chromium. Standalone
Pine boots and passes its short Simulator baseline on that same build;
that shortcut misses the entered-grid path.

`behaviour/night.wasm`, hash `3ecd8e5d…ff8b135`, is valid ABI v1. Its
`env.ws_read(i32,f64,f64)->f64` and `ws_list` signatures match the v1
contract. Pine runtime `PREPARED_MODULES` still includes it, and
`play()` passes that list to `withPreparedScriptMemories`, which admits
ABI v0. The detailed warm diagnostic confirms selected ABI 0 and no
allowed `ws_read` entry; the cold unmodified grid has the same call stack.
This is a source bug, not a malformed guest or warm-cache-only artifact.

The coordinator and deploy lane were notified immediately. The elite
lane owns the forward repair: remove night and its four new v1 elite
modules from the v0 preparation list, retaining the v0 director. No ABI
whitelist is widened. The exact owner landing and resumed AFTER source
are recorded below. Full evidence is in `pine-grid-abi.json`.

Cold origin also reports the later Pine map-input mismatch seen by CI.
The H6 correction was canonical for H6; it does not establish freshness
for all later schema/generator changes. The deploy/elite lanes own the
new cold generation, official bake and strict gate repair.


The ABI repair lands with ELITES in
`17ef0c2e8e56bbbe86b1e72fa4d6f253afbb6a9d`. `PREPARED_MODULES` now
contains only the v0 director. The owner reports a cold real GRID Pine
route with `witnessFailures=[]`, no console errors, stable cold
generation and strict all-ten products green. Road7 takes no elite-port
line-cut credit; its own scheduling delta remains net -2.


## Paired quiet AFTER

The exact served game is `17ef0c2-mvcvojod` at landed
`17ef0c2e8e56bbbe86b1e72fa4d6f253afbb6a9d`. The cold boot and real Pine GRID admission gates pass first.
Both pairs use the coordinator-approved exact-source CPU hold,
BSD push lock and empty-lane drain. The runner releases BOTH surfaces in
`finally`. Each retained run is complete, has no page errors, and passes
the recorded push-overlap validity check.

Required road rows: 7/12 pass in both runs. Common initial standing rows are also retained below; unmatched standing poses remain in paired-rows.json.

### Standard measurement pin

| Row | p95 A/B (ms) | Max A/B (ms) | Both pass |
| --- | ---: | ---: | :---: |
| spawn | 34/34 | 35/38 | yes |
| grid-deck-east | 34/34 | 34/36 | yes |
| grid-crossroads | 34/34 | 34/34 | yes |
| grid-far-reach-road-entry-travel | 34/34 | 137/131 | yes |
| grid-far-reach-road-entry-drive | 43/35 | 137/131 | no |
| grid-far-reach-road-entry | 34/34 | 36/35 | yes |
| grid-nalati-grasslands-road-entry-travel | 42/42 | 76/75 | no |
| grid-nalati-grasslands-road-entry-drive | 35/35 | 76/80 | yes |
| grid-nalati-grasslands-road-entry | 34/34 | 45/37 | yes |
| grid-pine-hollow-road-entry-travel | 42/36 | 99/94 | no |
| grid-pine-hollow-road-entry-drive | 35/36 | 260/241 | no |
| grid-pine-hollow-road-entry | 34/34 | 40/36 | yes |
| grid-driftwood-isle-road-entry-travel | 37/38 | 58/58 | no |
| grid-driftwood-isle-road-entry-drive | 35/35 | 78/69 | yes |
| grid-driftwood-isle-road-entry | 34/35 | 35/35 | yes |

### Pine normal capability probe

| Row | p95 A/B (ms) | Max A/B (ms) | Both pass |
| --- | ---: | ---: | :---: |
| spawn | 34/34 | 37/43 | yes |
| grid-deck-east | 34/34 | 34/34 | yes |
| grid-pine-hollow-road-entry-travel | 54/56 | 102/90 | no |
| grid-pine-hollow-road-entry-drive | 38/40 | 202/219 | no |
| grid-pine-hollow-road-entry | 34/35 | 35/44 | yes |

Paired misses: `grid-far-reach-road-entry-drive`, `grid-nalati-grasslands-road-entry-travel`, `grid-pine-hollow-road-entry-travel`, `grid-pine-hollow-road-entry-drive`, `grid-driftwood-isle-road-entry-travel`.
Normal-probe Pine is a separate observed pair, with no conversion time
subtracted from any pinned frame. Pin-only widening is absent there;
capability selection and its resulting texture path may also differ.
The standing 30–60 fps goal remains open wherever a row misses either
run. These checkpoint readings do not isolate the pacing change from
intervening mainline work, and do not prove physical iPhone performance.

The three assigned travel rows still fail both pinned runs. Sky whole
drive fails only A (43/35 ms), and Pine whole drive fails both: p95
35/36 ms, maxima 260/241 ms. Both Pine spikes are tagged `play`.
Normal-probe Pine also misses travel at 54/56 ms and whole drive at
38/40 ms, maxima 202/219 ms. These are observed hook associations,
not a new native attribution of the specific play work. The compact
row evidence retains long-frame times, hooks and work/callback costs.

Part six had 9/12 passing road rows; this later mainline checkpoint has
7/12. The three travel misses remain, and the Sky/Pine whole-drive rows
lose paired credit. The pacing landing is not a frame-floor success.
Future performance work must attribute those remaining travel reactions
and Pine play spikes on this source before claiming the standing goal.
No feature port or deployment is performed by this lane.
