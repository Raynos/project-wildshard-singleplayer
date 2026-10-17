# Simulator road, third bounds pass (2026-10-17)

Source fix: `70a9eb7054602b202f384afe52dc94c483d78697`.
The standing 30–60 fps goal remains open: the quiet after run still misses
the strict 33 ms target and retains individual frames above 100 ms.

## What changed

The existing shadow worker formerly scanned missing spheres while collecting
eligible meshes, before reaching its sliced loop. Large eligibility spheres
and split boxes now use the exact packed bounds steps inside that loop.
The live grid clip census exhausts the same packed box scan synchronously:
its clip decision still publishes in the current sweep, before preparation.
Vertices, triangle order, piece bounds, draw ranges, materials and clipping
are unchanged. No runtime file was deleted or host added.

The source-basis ruler ran in the build mirror on parent `b2f5dd7c7` and the
landed source: every shard is unchanged, net -0 shard lines. Raw comparison:
`.git/proofs/artifacts/20261017-sp-x1-sim-road3/ruler.json`.

The exact source passed all ten products, root and layer types, typed lint,
and 30 tests across four files, including all 17 shard-headless cases. The
new cases check all 21,846 triangles and exact piece bounds, shared attribute
and material identity, four pauses before eligibility sphere publication,
and a clip decision in the same sweep. Proof:
`.git/proofs/20261017T084728-sp-x1-road3-landed-checks-60476.json`.

## Diagnostic attribution

The landed-source run uses `--gl-time --task-clock --frame-timeline` and Safari
stack sampling under shared machine load. It completed both actual road
crossings without runtime errors. It has no frame-floor timing credit.
Two earlier setup attempts are excluded: `all` lacked the milestone road
routes, and a relative profile path was unavailable in the worker scratch.

Sky's 183 ms world interval (43,570–43,753 ms on its page clock) contains
170 ms in the main renderer / 172 ms in its enclosing composer. The adjacent
GL bucket records 131 ms in ten `getUniformBlockIndex` queries (four slow
queries: 46, 32, 30 and 22 ms) and 31 ms of image uploads. These nested spans
must not be added. A hook overlap is a location: this interval is not proof
of a 183 ms static-scene construction call. Cold node-program first use
while the world hook is running remains a major target.

Driftwood has 82 compile calls of at least 4 ms, totalling 1,499 ms, max
27 ms. Its four synchronous sphere scans total 33 ms, max 14 ms, and two
box scans total 11 ms. No clip-census box scan reaches the 4 ms observation
threshold in this trace. Its afterKit interval reaches 109 ms and activation
94 ms; those locations do not establish their CPU causes.

Raw diagnostic:
`.git/proofs/artifacts/20261017-sp-x1-sim-road3/landed-diag/70a9eb705-65217-1792244891220.json`.
The interval CSVs retain all drive intervals over 33 ms. Sampler update/render
values describe the most recently completed game frame, not necessarily the
callback that delayed the interval. Exact calls overlap their enclosing
operations. GL is API wall time, not GPU execution. Safari sample timestamps
are zero, so samples cannot place CPU stacks inside a particular interval.

## Quiet after

| Shard | Travel p95 before → after | Drive p95 before → after | Drive max before → after | Frames >50 ms before → after |
| --- | ---: | ---: | ---: | ---: |
| Pine | 36 → 35 ms | 35 → 35 ms | 106 → 111 ms | 5 → 8 |
| Nalati | 45 → 44 ms | 35 → 35 ms | 103 → 101 ms | 3 → 6 |
| Driftwood | 44 → 35 ms | 38 → 35 ms | 102 → 106 ms | 3 → 3 |
| Sky | 34 → 35 ms | 35 → 34 ms | 160 → 149 ms | 3 → 4 |

Before: the quiet `e7a94a45e` result from part two. After: the exact landed
DEVSERVER build `70a9eb7-mvcglotc` (see the raw record for the build witness).
The coordinator granted the CPU hold. A native process-exit wait let the
already-running jobs finish; heavy, browser and Simulator lanes were empty
before sampling. The runner acquired `push.lock` before creating `.git/quiet`.
The same four roads, order, Simulator, 120-frame windows, phone tier, 2× scale,
KTX2 pin and skipped capability probe were used. Timing instrumentation was
off. The run completed in 166 seconds without runtime errors. Its finally
removed quiet, released the push lock and sent `HOLD RELEASE, BOTH surfaces`.

Driftwood's short travel and whole-drive p95 are lower. The comparison does
not isolate this change: other main commits landed between the source pins,
and these are single quiet runs. Pine and Nalati have more frames over 50 ms.
No every-frame pass is claimed. The ordinary floor also fails on spawn p95
42 ms and Nalati travel 44 ms; settled interiors remain at the quantized
34 ms of the shipped 30 fps cap.

Remaining quiet spikes: Pine world 111 / activation 101 / play 85 ms;
Nalati world 101 / activation 77 / afterWorld 70 ms; Driftwood afterKit
106 / activation 83 / play 56 ms; Sky world 149 / activation 80 ms.
Single synchronous node builds, first-use node-program work, the shard's
remaining foliage scans and activation/afterKit work remain open targets.
The coordinator owns their next SHARD-PLATFORM plan rows.

Before raw:
`.git/proofs/artifacts/20261017-sp-x1-sim-road2/after/e7a94a45e-77040-1792243911725.json`.
After raw:
`.git/proofs/artifacts/20261017-sp-x1-sim-road3/after/70a9eb705-98775-1792245664412.json`.
Quiet log:
`.git/proofs/20261017T085742-sp-x1-road3-quiet-after-93350.log`.

Exact arithmetic/triangle tests establish output preservation; no screenshot
parity or physical-phone performance reading is claimed. The owned preview
is stopped, and no test browser or Simulator remains booted.

