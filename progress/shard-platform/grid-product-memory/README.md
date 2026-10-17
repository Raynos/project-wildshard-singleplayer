# Grid product transport memory — 2026-10-17

Product residency falls **436.11 → 46.50 MB**, releasing **389.62 MB**
of page-owned transport/source claims. The cap and calibration are unchanged.
This is the residency model, not native WebContent memory.

The final desktop journey completes all eight routes with zero refusals.
The Simulator journey is **incomplete**: five routes finish with zero
refusals on those legs, then the GPU process restarts before Pine entry.
Nine still exceeds the 1,200 MB standing cap on the Simulator. Per G433 and
the coordinator's 17 October direction, record the overage and hand the
remaining costs to a successor; this receipt does not claim universal cap
qualification or a complete Simulator traversal.

## What landed

`ea542943c` / `e38558916` / `38c709e2a` / `02c15e81d` / `e6066d1f4`:
release runtime-only product wires before neighbour readers copy them;
reread asynchronous terrain/props tiles and placeholders through
`ClientAssets`; include terrain-bound runtime query wires; shrink the same
shared product claim by each wire's bytes once. Synchronous panels,
materials, skins, unbound physics/simulation inputs and shared dependencies
remain available. OP's paced cached-read return is preserved.

Online rereads prefer the browser cache and verify immutable network
misses. Page-long pins previously exhausted the 256 MiB cache and left
extra wires resident after quota failures. Release pins now end immediately.
Offline/default decoder release still requires a durable reread and keeps
the wire when that is unavailable. No new texture policy, cap or renderer
calibration is part of this change.

## Exact comparison

Before: `d398e258e7ea384e053ecd4e1db8e4132c990818`.
After: `e6066d1f437becce2298faa45efd935b560e3a87`.
One served build of each revision was reused for both surfaces. The earlier
`02c15e81d` candidate is retained below because its settled Nine reading
exposed the late-ring cost.

Both use the milestone grid journey, including `far-reach-road-entry`,
Developer on, memory saver off, 30 standing frames and one second of settle.
Desktop uses Auto textures. Simulator commands request the established G386
`--textures=ktx2 --ktx2-probe=skip` measurement pins; its lower-mip pixels
are unsuitable for a look review. These runs have **no timing/FPS credit**.
The failed Simulator records do not retain resolved per-resident texture
metadata, so requested pins are not presented as evidence of every
resident's resolved mode.

Settled playing model, decimal MB, read **after** the standing frame sample:

| Route | Desktop before | Desktop after | Simulator before | Simulator after |
| --- | ---: | ---: | ---: | ---: |
| Template interior | 1,001.03 | 568.56 | 1,030.69 | 598.22 |
| Template return / Driftwood home | 1,306.75 | 873.74 | 1,336.42 | 903.95 |
| Nine Dragon road entry | 1,644.99 | 1,194.70 | 1,674.66 | **1,242.18** |
| Sky Reach road entry | 1,220.56 | 787.84 | 1,249.98 | 739.01 |
| Nalati road entry | 1,531.15 | 1,098.67 | 1,560.81 | 801.55 |
| Pine road entry | 1,167.55 | 742.18 | 1,939.09 | — |
| Signal road entry | 1,041.86 | 614.07 | 1,071.52 | — |
| Driftwood road entry | 1,306.71 | 874.24 | — | — |

The before Simulator run waited about five minutes for its lane, then
exhausted the harness's ten-minute wall-clock budget after seven routes.
The after run lost its document during graphics recovery while approaching
Pine. Its last recovery reason is “the GPU process restarted: every canvas
was wiped”. Missing rows are unmeasured, never passes.

Sampled journey maxima from the existing once-a-second route ledger:

| Surface / revision | Routes | Playing peak MB | Loading peak MB |
| --- | ---: | ---: | ---: |
| Desktop before | 8/8 | 1,644.99 | 1,724.99 |
| Desktop after | 8/8 | 1,198.63 | 1,278.63 |
| Simulator before | 7/8 | 1,946.40 | 2,026.40 |
| Simulator after | 5/8 | 1,242.18 | 1,322.18 |

These are sampled maxima over the observed portion, not continuous/native
allocation peaks. Runtime/near-view state can differ between samples;
attribute the stable **389.62 MB product-category reduction** to this path,
rather than attributing every cross-surface total difference to it.

## Nine's late costs for the successor

Keep the intermediate desktop `02c15e81d` reading: **1,171.19 MB at entry
readiness becomes 1,214.27 MB settled**. L0 grows from 272.20 to 311.01 MB:
38.81 MB of raw claims, or 43.07 MB after the 1.11 model factor. The final
candidate still has 311.01 MB L0. Its lower desktop total also holds only
4.18 MB near placeholders, versus 20.24 MB in the intermediate desktop and
final Simulator readings; the small ground-wire release does not explain
that entire improvement.

The two largest **new L0 claims after entry readiness**, final desktop:

| Claim | Raw accounted MB | Playing-model contribution MB |
| --- | ---: | ---: |
| `render:nine-dragon-stack:l0/3/2` | **29.78** | 33.06 |
| `render:nine-dragon-stack:l0/3/1` | **4.92** | 5.47 |

The two largest L0 claims already present overall are `/3/3` **94.71 MB**
and `/4/4` **43.31 MB**. Nine owns 260.50 MB of the 311.01 MB L0 category;
the platform owns the other 50.51 MB. The other dominant category is sims,
**347.65 MB including the highway**. These are model categories, not a
claim that two native allocations duplicate one another.

## Checks and limits

- Exact `e6066d1f4` mirror: root/layer types, typed lint, all ten products,
  34 cases (14 product-loader, three ledger, 17 shard-headless) pass.
- Full production boot smoke passes at `02c15e81d`; final `e6066d1f4`
  real grid boot and Signal road entry pass with zero faults.
- The carrier's complete local push gate passes through `d680489e7`,
  including the cold Nalati inventory-fixture correction. All source and
  reporting-harness commits are on `origin/main`.
- Focused reread tests cover exact bytes, corrupted cache/network bytes,
  failed cache writes, offline retention, shared leases/dependencies and
  unbound simulation inputs. No look data changes; no phone look board.
- Source-basis component inventory was read in the exact build mirror with
  `scripts/shard-platform.mjs`. This memory task cuts **zero custom shard
  lines in every shard** and deletes **zero runtime modules**. Concurrent
  Nine/Pine/Nalati port cuts are not attributed to it.
- Remaining: complete Simulator traversal after graphics recovery is
  addressed; Nine late-ring/near residency; optional tier-split products.
  No further memory hunt was started after the coordinator's scope limit.

The harness can print `complete=true` alongside a runtime-error record.
This receipt requires eight successful route witnesses and no runtime
error, so the Simulator is explicitly incomplete despite that flag.
Earlier attempts are also not successes: the Auto Simulator images path
at `e38558916` reached Pine at 1,653.54 MB; the initial baseline refused
Pine after its posed atlas lost allocation; an intermediate Simulator run
lost the GPU document on its first route.

Machine-readable measurements, source component counts and proof ids:
[evidence.json](evidence.json). Reproduce with separate surface runs of
`scripts/frame-floor.mjs --shards=grid --devserver --grid-scenario=milestone
--surface=desktop|sim --rev=<sha> --frames=30 --settle=1
--setting=memorySaver=off`, reusing an exact `serve-build.sh` preview via
`--serve-base`. Add the stated G386 pins on the Simulator. Queue time
counts toward the current harness deadline.
