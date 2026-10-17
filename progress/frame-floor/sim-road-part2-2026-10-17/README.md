# Simulator road, second attribution pass (2026-10-17)

Before: the predecessor’s quiet four-road run at `8f3f1bc77`, served DEVSERVER
build, phone tier, 2× render scale, KTX2 capability probe skipped. Travel / whole
road p95 ms: Pine 56/52, Nalati 57/48, Driftwood 81/55, Sky 34/37. Drive maxima:
106, 108, 141, 258 ms respectively. The floor is still missed.

## Driftwood attribution

Two additional runs use that exact source pin and the same served-build method,
`--gl-time --task-clock --frame-timeline`, only Driftwood’s road. These are
**diagnostics under shared machine load, with no timing credit**. The first also
samples Safari stacks. Both complete the actual crossing without runtime errors.
Their travel/drive p95 values (50/38 and 43/36 ms) cannot replace the quiet before.
Raw records remain in `.git/proofs/artifacts/20261017-sp-x1-sim-road2/`.

The CSVs record every drive interval over 33 ms, including 34 ms timestamp
quantization at the shipped 30 fps cap. Hook overlap is a location, not a charge
of the whole interval to that hook. JS operations are exact synchronous spans;
parents/children overlap and must not be added. Task totals include microtasks
and queueing until the next wrapped task/echo: upper bounds, not CPU attribution.
GL API wall time is inside JS time, not GPU execution. The sampler drains GL
counters into timestamped frame buckets; a bucket can include the preceding
callback, so inspect adjacent buckets when correlating it with a callback.
WebKit Timeline has zero clocks and no valid RenderingFrame coverage; no idle /
GPU / browser partition can be claimed.

The first trace locates a 90 ms world interval at 43156–43246 ms. Four sphere
scans consume 10+4+5+5 ms in `WholeGeometryAssembler.finish`, called by
`readWholeGeometry` (`game/plugin/geometry.ts`). It validates and bounds every
reconstructed draw in one continuation. Other world scans and clip-system box
scans remain separate costs. AfterPlay has 83 compile calls ≥4 ms, totalling
1674 ms, max 51 ms; node-build counters report 101 builds / 1633 ms. Single TSL
builds remain an unsplit unit.

## First visible frame

The profiled first-visible callback at 51722 ms spends 18 ms updating and 39 ms
rendering. The main renderer takes 37 ms; scene matrices and shadows each take
about 1 ms. The update phase is 12 ms: ground cover 3 ms, adventure 4 ms,
player/HUD/walk/director roughly 1 ms each. Those fine timings use Safari’s
quantized clock and diagnostic wrappers. Other fixed/late work makes up the
remaining update time.

The second trace adds missing uniform-block GL APIs to the observer. Its
first-visible callback at 49356 ms takes 15 ms update / 32 ms render; main
renderer 30 ms, shadow 1 ms, matrices <1 ms. The adjacent GL bucket contains
17 ms in 14 `getUniformBlockIndex` queries, including one 14 ms query. This API
was absent from the old observer: the former near-zero GL reading did not cover
all first-use uniform setup. Update’s 10 ms phase includes ground cover and
adventure at 3 ms each, plus player/HUD/walk/spine around 1 ms each.

## Changes and validation

The existing whole-geometry reader now checks completeness and computes the
same exact bounds in 32,768-element steps under the shared engine work slice.
Driftwood, Pine and Nine already use this reader. Synchronous assembly exhausts
the same steps. Source attributes, transforms and draw order are unchanged;
closing the scope during finalization disposes unpublished results.

The existing shader-link warm-up now resolves node uniform-block indices for
each compiled material variant while its link is being prepared. It performs
read-only metadata queries: it creates no buffer, uploads no value, selects no
variant and changes no binding. The first draw retains its usual pairing and
uploads. This targets the identified cold query without changing graph output.

Focused tests cover byte/exact-sphere identity, cancellation during finalization,
the default owned yield, pending node-program preparation, binding preservation
and reuse on the first actual draw.

## Quiet after result

Source fix: `e7a94a45e39fd0c4a693422f6856b4a3c574609c`. The coordinator granted
the CPU hold; the active push finished before `.git/quiet` was created. The
served build reports `e7a94a4-mvcfp3gq`. The same four routes, order, Simulator,
120-frame windows, phone tier, 2× scale, KTX2 pin and skipped probe were used.
The runner removed quiet and explicitly released both surfaces after the run.

| Shard | Travel p95 before → after | Drive p95 before → after | Drive max before → after | Frames >50 ms before → after |
| --- | ---: | ---: | ---: | ---: |
| Pine | 56 → 36 ms | 52 → 35 ms | 106 → 106 ms | 46 → 5 |
| Nalati | 57 → 45 ms | 48 → 35 ms | 108 → 103 ms | 28 → 3 |
| Driftwood | 81 → 44 ms | 55 → 38 ms | 141 → 102 ms | 46 → 3 |
| Sky | 34 → 34 ms | 37 → 35 ms | 258 → 160 ms | 5 → 3 |

This is a checkpoint comparison, not an isolated causal estimate: other main
commits landed between the two source pins. The after run is complete but
fails the frame-floor gate. The 33 ms goal remains open; even settled interiors
report 34 ms with the 30 fps cap and quantized timestamps. The road still has
real spikes: Sky world 160 ms; Driftwood activate 102 ms / afterKit 95 ms;
Pine activate 106 ms / world 93 ms / play 87 ms; Nalati world 103 ms /
activate 83 ms. Individual TSL builds are still synchronous.

Before raw:
`.git/proofs/artifacts/20261017-sp-x1-sim-road/final/8f3f1bc77-84854-1792241425139.json`.
After raw:
`.git/proofs/artifacts/20261017-sp-x1-sim-road2/after/e7a94a45e-77040-1792243911725.json`.
Quiet-run log:
`.git/proofs/20261017T083151-sp-x1-road2-quiet-after-77008.log`.

The exact landed source passed all ten shard-product builds, root and layer
types, typed lint, and 33 tests across seven files including all 17 headless
cases. Proof:
`.git/proofs/20261017T082324-sp-x1-road2-landed-checks-41712.json`.
The source-basis ruler in the build mirror is unchanged from parent
`a54a7aed84445fa999bcbf0d4be40e324849215c`: net -0 shard lines in every shard.
No runtime file was deleted. Exact attribute/sphere tests and read-only warm-up
tests cover output preservation; no screenshot parity or physical-phone timing
is claimed.

## After diagnostic

A final Driftwood-only trace uses the same landed served build, with the hold
released and shared machine load allowed. It is diagnostic only (travel/drive
42/42 ms), complete, with no runtime errors. Its interval list is
`driftwood-after-long-frames.csv`; raw:
`.git/proofs/artifacts/20261017-sp-x1-sim-road2/after-dw/e7a94a45e-89180-1792244143621.json`.

The first visible game callback starts near 51715 ms and is observed by the
sampler at 51746 ms: update 16 ms / render 15 ms. The update phase itself is
10 ms (cover 3, adventure 4, animals/guide/HUD about 1 each). Fixed work adds
6 ms. Main rendering is 13 ms; scene matrices and shadows round to zero. There
are no `getUniformBlockIndex` queries in the adjacent visible-frame GL buckets.
Those metadata queries now appear throughout warm-up, including 6 ms in four
queries near 50581 ms, before activation at 51716 ms. The earlier diagnostic
had update 15 ms / render 32 ms with 17 ms of adjacent block queries. This
confirms the query moved; the two under-load traces do not isolate its precise
frame-time benefit.

AfterPlay still contains 82 compile calls ≥4 ms, totalling 1443 ms, max 30 ms.
World still contains four other synchronous sphere calls totalling 28 ms,
max 11 ms, plus clip-system box work. The stepped assembler path no longer
calls the synchronous sphere API. Remaining long-frame work includes those
other world paths, individual shader builds, and activation/afterKit tasks.
The WebKit Timeline partition remains invalid (zero clocks); no browser/GPU
attribution is inferred from it. The served-build process was stopped and the
Simulator lane reports zero booted devices after this trace.
