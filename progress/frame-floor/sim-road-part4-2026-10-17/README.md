# Simulator road, fourth preparation pass (2026-10-17)

Source fix: `96a7116c1`.

The standing 30–60 fps goal remains open. The strict target is at most
33 ms on every row; this report gives no every-frame pass.

## Preparation change

A compile batch can acquire several object-layout programs for a shared
node material. The old inventory read only `currentProgram`, the last
layout the batch selected. Earlier programs could have resolved classic
uniform metadata without preparing their node uniform-block indices.
Preparation now inventories every acquired material program and remembers
block preparation per program/material pair. A material borrowing an
already-resolved program still prepares its blocks. Live WebKit preparation
retains one program per painted slice. Weak identities retain no renderer,
material, scene or geometry after their owners leave.

Shader source, vertices, draw order, uniform values, binding points and live
material selection are unchanged. No runtime file is deleted or host added;
net -0 shard lines (all shards -0).

The regression uses the installed node backend and a shader-only renderer.
It covers two layouts in one batch, separate painted slices, repeated
preparation, a second material borrowing resolved programs, and preservation
of the selected variant. The opt-in task clock also records exact slow
`getUniformBlockIndex` spans and caller stacks, so adjacent GL buckets do
not stand in for synchronous query attribution.

The checked source passed all ten products, root/layer types, typed lint,
and 25 tests in four files, including all 17 shard-headless cases. The
full source proof is
`.git/proofs/20261017T091552-sp-x1-road4-checks-fixed-48136.json`;
the final diagnostic script also passed typed lint in
`.git/proofs/20261017T091733-sp-x1-road4-typed-ruler-52726.json`.
The validated source tree differs from the landed commit only in the
coordinator's State file and that diagnostic script. The exact source
and parent `a19114d1f` ruler inventories match in every shard:
`.git/proofs/artifacts/20261017-sp-x1-sim-road4/ruler.json`.

## Diagnostic before

The complete four-road diagnostic at `99fedb075` uses `--gl-time`,
`--task-clock` and `--frame-timeline` under shared machine load. It has
no frame-floor timing credit and is not the quiet before. There are no
runtime errors. The committed interval CSVs contain every drive interval
above 33 ms, including 34 ms timestamp quantization at the shipped 30 fps
cap. Hook overlap describes location, not CPU ownership. Exact calls nest;
task totals include microtasks and queueing and are upper bounds.

Sky's 146 ms world interval contains a 137 ms renderer/composer call. Its
adjacent GL bucket has 100 ms in eight uniform-block queries (four slow
queries of 40, 23, 23 and 14 ms) and 32 ms of image uploads. These spans
nest and must not be added. The largest measured bucket is still cold
node-program first use.

The four slow before queries identify `graph:material` programs by the
submitted GLSL fingerprints (vertex / fragment):

| Program fingerprints | Query wall time |
| --- | ---: |
| `196a2a72 / bb3725bf` | 40 ms |
| `794b68d8 / cf63e4fb` | 23 ms |
| `196a2a72 / 731f3a4c` | 23 ms |
| `2abe9445 / 6ae2712f` | 14 ms |

These are program identities, not an attribution to an authored prop or
shadow pass. The regression establishes the shared-layout inventory gap;
the traces establish the native-query timing change.

Nalati travel p95 is 46 ms in this diagnostic. Its 101 ms interval at
61,373–61,474 ms includes 6 ms in a sphere scan, 4 ms in a box scan and
12 ms in `toNonIndexed`. Other travel intervals of 72, 54 and 48 ms lack
a measured synchronous operation explaining their duration. Some task-clock
message spans reach 31–40 ms but include queueing; those are not CPU charges.
Remaining foliage/geometry scans and unobserved continuations stay open.

Spawn p95 is 34 ms (max 44 ms), so this diagnostic does not reproduce the
quiet before's 42 ms spawn p95. Pine world max is 109 ms and Driftwood
`afterKit` max is 111 ms; the current exact-operation wrappers do not explain
those complete intervals. Their hook names alone do not attribute them.

Raw diagnostic:
`.git/proofs/artifacts/20261017-sp-x1-sim-road4/diag/99fedb075-18664-1792246075812.json`.

The quiet before is the previous part's exact `70a9eb705` run, with the
same road order (Sky, Nalati, Pine, Driftwood), Simulator, 120-frame windows,
phone tier, 2× render scale, KTX2 pin and skipped capability probe.

## Diagnostic after

The exact landed DEVSERVER build `96a7116-mvci0c52` completes Sky's actual
road crossing without runtime errors. This is another under-load diagnostic,
with no timing credit. World-stage uniform-block API wall time is 100 → 1 ms
(before: 30 calls; after: 36 calls), and no after query reaches the task
clock's 4 ms exact-call threshold. The renderer/composer's largest measured
call is 39/40 ms. Its adjacent image-upload bucket still takes 33 ms.

The world maximum remains 151 ms, with travel/drive p95 35/42 ms. Removing
the measured cold-query bucket does not explain that whole remaining
interval or establish a frame-floor pass. The two diagnostics are not an
isolated causal estimate; driver cache state and shared load can differ.

Raw after diagnostic:
`.git/proofs/artifacts/20261017-sp-x1-sim-road4/after-diag/96a7116c1-6544-1792247735405.json`.
The quiet measurement below has timing instrumentation off.

The coordinator granted the AFTER CPU hold. An initial attempt used a
POSIX lock instead of the BSD `flock` used by macOS `lockf`; it was
interrupted and discarded. Its partial timings are not used. The
coordinator explicitly kept the lanes held for the corrected attempt.
The accepted runner uses `fcntl.flock` on `push.lock`, native process-exit
waits for existing jobs, empty heavy/browser/Simulator checks, then its own
`.git/quiet`. Its `finally` removes quiet, unlocks and sends the explicit
BOTH-surface release. No build or timing instrumentation runs in the sample.


## Quiet after

| Row | p95 before → after | Max before → after |
| --- | ---: | ---: |
| spawn | 42 → 34 ms | 46 → 42 ms |
| grid-crossroads | 34 → 34 ms | 46 → 34 ms |
| grid-deck-east | 34 → 34 ms | 34 → 34 ms |
| grid-far-reach-road-entry-travel | 35 → 34 ms | 149 → 127 ms |
| grid-far-reach-road-entry-drive | 34 → 34 ms | 149 → 127 ms |
| grid-far-reach-road-entry | 34 → 34 ms | 35 → 35 ms |
| grid-nalati-grasslands-road-entry-travel | 44 → 46 ms | 101 → 98 ms |
| grid-nalati-grasslands-road-entry-drive | 35 → 34 ms | 101 → 98 ms |
| grid-nalati-grasslands-road-entry | 34 → 34 ms | 36 → 37 ms |
| grid-pine-hollow-road-entry-travel | 35 → 36 ms | 111 → 88 ms |
| grid-pine-hollow-road-entry-drive | 35 → 35 ms | 111 → 104 ms |
| grid-pine-hollow-road-entry | 34 → 34 ms | 34 → 35 ms |
| grid-driftwood-isle-road-entry-travel | 35 → 43 ms | 106 → 99 ms |
| grid-driftwood-isle-road-entry-drive | 35 → 42 ms | 106 → 99 ms |
| grid-driftwood-isle-road-entry | 34 → 34 ms | 35 → 35 ms |

| Road | Drive frames >50 ms before → after |
| --- | ---: |
| grid-far-reach-road-entry-drive | 4 → 4 |
| grid-nalati-grasslands-road-entry-drive | 6 → 6 |
| grid-pine-hollow-road-entry-drive | 8 → 5 |
| grid-driftwood-isle-road-entry-drive | 3 → 3 |

After raw: `.git/proofs/artifacts/20261017-sp-x1-sim-road4/after/96a7116c1-27639-1792248030780.json`.
The complete run took 162.791 seconds. Harness pass (35 ms policy): False.
Every-row p95 at most 33 ms: False.

The source is the exact landed DEVSERVER preview, verified by the harness
build witness. The four roads keep the previous quiet run's order and
120-frame windows, the same Simulator, phone tier, 2× scale, KTX2 pin and
skipped capability probe. There are no runtime errors. The accepted proof
is `.git/proofs/20261017T093958-sp-x1-road4-quiet-corrected-25059.json`;
its log records empty lanes before sampling and the explicit release.

This is a checkpoint comparison from two single quiet runs, with other
main commits between the pins. It does not isolate this source change.
Spawn and Sky's maximum improve; Nalati travel and Driftwood's travel and
drive p95 worsen. No overall performance improvement or every-frame pass
is claimed. Settled 34 ms rows include the shipped 30 fps cap's timestamp
quantization, and genuine long frames remain.

Quiet maxima by location remain: Sky world 127 / activation 73 ms;
Nalati world 98 / activation 90 / afterWorld 51 ms; Pine world 88 /
activation 104 / play 80 ms; Driftwood afterKit 99 / activation 89 ms.
Hook locations do not explain all of each interval.

Remaining work belongs to the coordinator's standing SHARD-PLATFORM frame
floor row: Nalati's 46 ms travel p95 and geometry/foliage scans; Driftwood's
43/42 ms travel/drive p95 and afterKit/activation; Pine activation; Sky's
127 ms world interval and image uploads. The exact query trace closes the
measured cold-query bucket in that diagnostic, not these entire intervals.
Shader builds are still indivisible synchronous units. Unexplained spans
remain attribution gaps, including the spawn miss not reproduced by the
diagnostics. No physical-phone performance or rendered-image parity reading
is claimed; the change preserves shader source and read-only preparation
state, checked by the focused tests. No look changes or variant board.
