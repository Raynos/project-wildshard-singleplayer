# Simulator road, fifth preparation pass (2026-10-17)

Source fixes: `c6bd39818`, `473859cb5`, `533662de4`. The standing
30–60 fps goal remains open. The quiet pair still misses the frame floor.

## Activation attribution

Two exact `636e6932d` four-road diagnostics run under shared machine load,
with `--gl-time --task-clock --frame-timeline`. Neither has frame-floor
timing credit. Both complete the real crossings without runtime errors.

| Road | Retained activation CPU, runs 1 / 2 | Enclosing interval, runs 1 / 2 |
| --- | ---: | ---: |
| Sky | 2 / 2 ms | 79 / 73 ms |
| Nalati | 4 / 4 ms | 85 / 77 ms |
| Pine | 3 / 4 ms | 88 / 100 ms |
| Driftwood | 2 / 1 ms | 91 / 86 ms |

These exact spans include retained service installation and its final
input refresh/repaint. Slot publication was not independently captured. `activation-groups.csv`
records the exact nested child counts/spans (service installation, event
registration, system registration and input refresh/repaint). Nested spans
must not be summed as independent CPU costs.
Splitting the measured installers would not remove the majority of the
interval.
The first diagnostic's first-visible game work is 22 / 35 / 34 / 34 ms,
respectively. Unobserved gaps remain after the callback. Task total spans
include microtasks and queueing; they are upper bounds, not CPU charges.
GL wall time is not GPU execution. Adjacent GL buckets cannot assign a
particular buffer to a model.

Both diagnostics also record first-entry buffer creation: Sky 62,
Nalati 11, Pine 121, Driftwood 16 / 14 adjacent `bufferData` calls.
The code shows a concrete preparation gap: camera equipment lives outside
the parked world root. It is compiled, but its hidden staging group and
hidden equipment roots exclude it from the world's sliced first draws.
The new pass prepares only that owner's camera equipment on the existing
1×1-scissored draw path, with the destination lighting root and PMREM.
Every yield follows restoration of its visibility, layers, culling,
shadows, environment and targets. Hidden details remain hidden; world
geometry is not drawn in this pass. No simulation tick advances; authored shaders, vertices and equipment
selection stay unchanged. This closes a preparation gap;
it does not attribute every first-entry buffer or the entire stall to gear.

Nalati again has a 13 ms `toNonIndexed` in its crag construction. Its
remaining world spans and Driftwood afterKit are separate open targets.

## Checks and ruler

The first checked source passes all ten products, root/layer types, typed
lint and 26 tests in four files, including the 17 shard-headless cases.
The lighting correction adds the fourth focused test, proving destination
light visibility and exclusion of world geometry during camera warm-up.
The exact `473859cb5` tree passes all ten products, root/layer types, typed
lint and 27 tests in those four files. The source tree is
`bd7a99669a086a1df14867010b02c5d5677239d7`; proof
`.git/proofs/20261017T100804-sp-x1-road5-final-source-checks-30922.json`.
The static GPU operation check is described below; full-scene parity
was inconclusive.

No runtime file is deleted, no content host or AssemblyScript is added.
All three source commits are net -0 shard lines (all shards -0).
The source-basis ruler runs in the shared build mirror; no repo export.

## Diagnostic before pair

These are instrumented, under-load readings, and are not a quiet before
pair. They are included to expose run-to-run variation. The previous
part's one quiet `96a7116c1` AFTER remains the quiet checkpoint before.

| Row | Diagnostic before 1 / 2 p95 | Diagnostic before 1 / 2 max |
| --- | ---: | ---: |
| spawn | 34 / 34 ms | 35 / 42 ms |
| grid-deck-east | 34 / 34 ms | 34 / 34 ms |
| grid-crossroads | 34 / 34 ms | 34 / 34 ms |
| grid-far-reach-road-entry-travel | 35 / 36 ms | 147 / 135 ms |
| grid-far-reach-road-entry-drive | 43 / 36 ms | 147 / 135 ms |
| grid-far-reach-road-entry | 34 / 34 ms | 37 / 35 ms |
| grid-nalati-grasslands-road-entry-travel | 47 / 47 ms | 90 / 113 ms |
| grid-nalati-grasslands-road-entry-drive | 35 / 40 ms | 90 / 113 ms |
| grid-nalati-grasslands-road-entry | 34 / 34 ms | 39 / 39 ms |
| grid-pine-hollow-road-entry-travel | 42 / 36 ms | 105 / 152 ms |
| grid-pine-hollow-road-entry-drive | 37 / 35 ms | 105 / 152 ms |
| grid-pine-hollow-road-entry | 34 / 34 ms | 35 / 35 ms |
| grid-driftwood-isle-road-entry-travel | 42 / 43 ms | 101 / 100 ms |
| grid-driftwood-isle-road-entry-drive | 41 / 35 ms | 101 / 100 ms |
| grid-driftwood-isle-road-entry | 35 / 34 ms | 35 / 35 ms |

## Quiet pair at the lighting fix

The coordinator granted an AFTER-only CPU hold. The runner acquired the
BSD `fcntl.flock` push lock, waited for existing jobs with native process
exit events, checked empty heavy/browser/Simulator lanes, then created its
own quiet marker. Its `finally` removed quiet, unlocked pushes and sent
`HOLD RELEASE, BOTH surfaces`. Each road ran twice in the same quiet
window, with timing instrumentation off, from exact DEVSERVER source
`473859cb5`. Order: Sky, Nalati, Pine, Driftwood; 120-frame windows, phone
tier, 2× scale, KTX2 pinned and the capability probe skipped. Both runs
complete without runtime errors and fail the 35 ms p95 policy. All quiet
maxima stay below 200 ms. The strict 33.3 ms bar also fails.

| Row | Quiet AFTER 1 / 2 p95 | Quiet AFTER 1 / 2 max |
| --- | ---: | ---: |
| spawn | 34 / 34 ms | 35 / 38 ms |
| grid-crossroads | 34 / 34 ms | 34 / 34 ms |
| grid-deck-east | 34 / 34 ms | 34 / 34 ms |
| grid-far-reach-road-entry-travel | 35 / 34 ms | 150 / 132 ms |
| grid-far-reach-road-entry-drive | 35 / 39 ms | 150 / 132 ms |
| grid-far-reach-road-entry | 34 / 34 ms | 38 / 35 ms |
| grid-nalati-grasslands-road-entry-travel | 46 / 45 ms | 89 / 98 ms |
| grid-nalati-grasslands-road-entry-drive | 35 / 35 ms | 89 / 98 ms |
| grid-nalati-grasslands-road-entry | 34 / 34 ms | 34 / 35 ms |
| grid-pine-hollow-road-entry-travel | 35 / 41 ms | 112 / 122 ms |
| grid-pine-hollow-road-entry-drive | 35 / 35 ms | 112 / 122 ms |
| grid-pine-hollow-road-entry | 34 / 34 ms | 37 / 39 ms |
| grid-driftwood-isle-road-entry-travel | 44 / 41 ms | 95 / 104 ms |
| grid-driftwood-isle-road-entry-drive | 42 / 35 ms | 95 / 104 ms |
| grid-driftwood-isle-road-entry | 35 / 34 ms | 35 / 35 ms |


This pair does not establish an overall improvement. Comparing it with
part four is a checkpoint comparison, with other main landings between
the pins, not an isolated causal estimate. Sky drive and Pine travel vary
across the policy boundary inside one quiet window. Nalati and Driftwood
travel miss in both runs. Activation-labelled frames remain 73–90 ms.
Hook overlap describes location, not synchronous CPU ownership.

Raw pair:
`.git/proofs/artifacts/20261017-sp-x1-sim-road5/after-1/473859cb5-20373-1792250697294.json`
and
`.git/proofs/artifacts/20261017-sp-x1-sim-road5/after-2/473859cb5-34304-1792250859453.json`.
Proof: `.git/proofs/20261017T102314-sp-x1-road5-quiet-after-pair-10660.json`.
The proof exits 2 because the frame floor fails; both crossings complete.

## Rendered-pixel check

A static camera cube with cold geometry uses the actual game renderer and
composer input target on both Driftwood and Pine pages. Full 804×1748
framebuffer reads have zero changed bytes for the repeated control and
zero after the warm, with 318,828 nonzero RGB bytes and restored visibility.
The focused tests separately check hidden-detail and light restoration,
world-geometry exclusion, cancellation and driver failure. This is exact
pixel evidence for the operation fixture, not full-scene image parity or
physical-iPhone performance evidence. Earlier live-scene reads have a
nonzero repeated control, so they are inconclusive and receive no credit.
No look change or variant board is claimed.

Pixel proof:
`.git/proofs/20261017T102232-sp-x1-road5-static-pixels-5187.json`.
The complete under-load AFTER diagnostic at `473859cb5` records activation
CPU 3/5/4/2 ms and parked equipment counts 14/20/29/4. Its elapsed warm
stages include frame waits and are not synchronous costs. Nalati has a
269 ms afterPlay interval with no exact wrapped call explaining it. This
under-load maximum is not hidden by the quieter pair's better maxima.

## Remaining work

The coordinator's standing SHARD-PLATFORM frame-floor row remains open.
Nalati travel and its world geometry/foliage scans, Driftwood travel and
afterKit, and the activation-labelled intervals still need fixes and
attribution. Pine travel and Sky drive also cross the policy boundary
between quiet runs. The camera preparation gap is closed, but the
activation interval has not been brought below 50 ms. There is no claim
of sustained 30–60 fps at all times.


## Camera copy follow-up

The parked-draw view previously recursively copied the camera's child
hierarchy, though the draw uses the real equipment attached to the scene.
The follow-up copies the view without its children, retains the camera
subclass/projection and avoids unused equipment/material copies. The
regression throws if camera equipment is cloned and checks projection,
camera type, child count and restoration. This removes unnecessary work;
it is not an explanation for the measured long frames.

A diagnostic on the old `473859cb5` build traces exact camera clone spans
on Nalati and Pine. No clone reaches the 4 ms recording threshold. Its
drive p95/max is 35/103 and 35/126 ms, respectively. This under-load run
has no timing credit and does not reproduce the earlier 269 ms gap.
Raw:
`.git/proofs/artifacts/20261017-sp-x1-sim-road5/camera-before-diag/473859cb5-52923-1792251174044.json`.


The camera follow-up passes all ten products, root/layer types, typed lint
and 28 tests in four files, including all 17 shard-headless cases. Proof:
`.git/proofs/20261017T103559-sp-x1-road5-camera-checks-fixed-66985.json`.
Checked tree: `32e62e2d890d8ff889ee4df797305f8024d9027d`. The final source
lands across intervening documentation and Git-hook commits, with the
three checked source blobs unchanged. The hooks pass on the landed tree.
Its exact parent/source ruler inventories also match. Driftwood is 6,135
lines in both because the quest lane landed between the earlier pins;
that reduction is not this lane's credit. Other shard counts are the same
as the first source's ruler. The committed ruler summaries preserve both
pairs and their exact pins.


The exact `533662de4` DEVSERVER build also passes the same static GPU
operation fixture on both shard pages. Proof:
`.git/proofs/20261017T104116-sp-x1-road5-camera-pixels-86278.json`.
Both controls and both AFTER reads have zero changed bytes; the browser
closes before the final CPU hold is requested.

## Final quiet pair

The coordinator granted a new AFTER-only hold after the landed build and
pixel check were ready. The same BSD-lock/drain/quiet/release runner uses
distinct output directories so the earlier pair remains intact. The final
pair has timing instrumentation off and repeats the same road order,
120-frame windows, phone tier, render scale and texture settings.

The comparison below gives both quiet readings at `473859cb5` before the
camera cleanup and both at `533662de4` after it. These are separate quiet
windows; unrelated main documentation/Git-hook and quest commits also lie
between the pins. It is a checkpoint comparison, not an isolated causal
estimate. The only paired readings before the first preparation commit
are the under-load diagnostics above; no quiet paired before is claimed
for that initial change.


## Actual rendered-world follow-up

The exact `533662de4` preview also renders its actual world and camera
equipment with simulation frozen, using the raw renderer so composer
history does not enter the comparison. Driftwood's repeated control and
AFTER reads both have zero changed bytes across 804×1748 pixels (4,216,176
nonzero RGB bytes); two equipment drawables are warmed and visibility is
restored. Pine's control differs by seven bytes (max delta four); its
AFTER differs by one byte (max delta one). A nonzero control makes exact
Pine world parity inconclusive, regardless of its smaller AFTER difference.

A final isolated actual-equipment check uses the authored meshes and
materials with cold cloned geometry and excludes the world background.
Driftwood again has zero control/AFTER changes, with 343,491 nonzero RGB
bytes and two warmed drawables. Pine still varies: control 42 bytes,
max delta two; AFTER 14 bytes, max delta one; 15 warmed drawables and
restored visibility. It is also inconclusive. There is no exact Pine
scene-parity claim or physical-phone reading. The static operation fixture
passes on both pages, and the focused tests pass the restoration cases.
Both additional browser runs close in their finalizers.

Proofs (each exits 1 for the Pine exact-pixel assertion):
`.git/proofs/20261017T104614-sp-x1-road5-real-world-pixels-98914.json`
and
`.git/proofs/20261017T104950-sp-x1-road5-equipment-pixels-22119.json`.

## Landed source and scope

| Commit | Change | Measured shard delta |
| --- | --- | ---: |
| `c6bd39818` | Draw staged camera equipment on the existing parked-draw path | 0 in every shard |
| `473859cb5` | Borrow destination lights during those first draws | 0 in every shard |
| `533662de4` | Copy the camera view without unused equipment children | 0 in every shard |

No runtime file is deleted, no new content host or AssemblyScript is
added, and no shard-specific branch or render-scale change is introduced.
The real common path prepares equipment in Driftwood and Pine (and the
other road destinations), as recorded by the diagnostic stage counts.
The coordinator pushes these local-main commits. The standing performance
row remains open, with Nalati/Pine/Driftwood travel, variable Sky drive,
Driftwood afterKit and unexplained activation-labelled intervals remaining.
