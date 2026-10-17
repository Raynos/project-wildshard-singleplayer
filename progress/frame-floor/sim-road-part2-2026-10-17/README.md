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
and reuse on the first actual draw. Final exact-SHA checks and quiet after
measurements are recorded in the landing report.
