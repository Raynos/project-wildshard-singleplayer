# Simulator road, native attribution (2026-10-17)

The standing 30–60 fps goal remains open. Part six profiles the native
Simulator WebContent and GPU processes rather than assigning missing page
time to a runtime hook. The floor policy remains p95 ≤35 ms and maximum
≤200 ms per observed row, with both AFTER repeats required to pass.

## Method

Pinned DEVSERVER game: `533662de4`, the final part-five camera-copy fix.
Actual road inputs and residency witnesses come from the existing
`frame-floor.mjs` harness; 120-frame windows, phone tier, 2× render scale,
KTX2 pinned, capability probe skipped, muted portrait Simulator Safari
on the standard `frame-floor-iphone-17-pro` device, as in part five.
All native captures are diagnostics under shared machine load; none has
frame-floor timing credit. No CPU hold is requested for a diagnostic.

Valid recordings use Metal System Trace plus Time Profiler, or Time
Profiler alone, on the Mac hosting the one Simulator. All-process capture
includes both WebKit processes, process identities and competing host
work. Only the game’s Simulator process evidence is retained in this
report. CPU samples describe sampled running work; absence of a sample
alone does not prove a blocked or idle thread. Metal event intervals provide independent evidence, and nested event
spans are never summed as independent elapsed time. A Thread Activity
attempt produced an oversized trace and failed to save; it supplies no
scheduler-state evidence. Direct host attachments to Simulator extension
PIDs also failed, so the readable captures use all-process recording.

A temporary copy of the measurement script adds two `(performance.now(),
Date.now())` clock anchors per sampled window and logs draw-gate refusals.
The game modules, shaders and assets are unchanged. The two wall/page
offsets must agree before individual frames are placed on the trace
clock. The trace’s own start date anchors the native-relative clock.
Web Inspector Timeline is also attempted by the existing `--gl-time`
path; invalid coverage or zero timestamps give no attribution credit.

Raw traces and XML exports were inspected under `tmp/sp-x1-road6/` and
then deleted after extracting the compact findings and clock evidence.
Raw multi-process trace data is not added to Git.

## Native findings

Two readable captures on the same pinned game place native work on the
page clock with zero anchor drift. Nalati uses Metal System Trace plus
Time Profiler; Driftwood uses Time Profiler. Both target all Mac processes
and retain the Simulator WebContent/GPU identities, including the
Simulator's separate `SimMetalHost` processes. The raw Metal execution
runs under `SimMetalHost`, rather than the iOS GPU extension's PID.

| Gap | Interval | WebContent main sample weight | Nested main microtasks | Nested native zlib |
| --- | ---: | ---: | ---: | ---: |
| Nalati world | 100 ms | 87 ms | 81 ms | 24 ms |
| Nalati world | 85 ms | 80 ms | 72 ms | 0 ms |
| Driftwood afterKit | 115 ms | 113 ms | 104 ms | 0 ms |
| Nalati activation | 134 ms | 55 ms | 0 ms | 0 ms |
| Driftwood activation | 81 ms | 27 ms | 0 ms | 0 ms |

These are 1 kHz sampled weights, not stopwatch timings for JavaScript
functions. Microtask/decode samples nest, helper threads overlap, and
cross-process weights must not be added. The world/afterKit gaps contain
substantial page continuation work, even though the old exact-operation
observer did not name it. They are not evidence of an idle page waiting
for the Mac GPU. Unknown JIT addresses do not identify an authored builder.
GC contributes only 3 ms of main-thread samples in Nalati’s 85 ms world
gap and 2 ms in Driftwood’s 115 ms afterKit gap. Nalati also has 54 ms
of overlapping JIT-helper samples in that 85 ms interval; that weight
is not additional main-thread elapsed time.

Nalati's 100/85 ms world intervals have only about 2–3 ms of execution
per Simulator Metal host, with no graphics compiler event in either gap.
At its 134 ms activation, the Metal host with PID 3679 has 7.306 ms of GPU execution,
22.102 ms of driver intervals and 3.967 ms of compiler activity; these
categories can overlap. The longest driver command-buffer interval is
13.185 ms. Native GPU stacks include ANGLE draw setup, pipeline lookup,
texture replacement and Simulator serialization. None accounts alone
for the whole interval.

Driftwood activation has 47 ms of sampled work across the
`SimMetalHost` PID 31518 threads, including argument-buffer/encoder work; WebKit's
GPU extension has 22 ms across its threads. This establishes real
Simulator-native work, but does not prove that host contention is the
entire cause or that the game cannot prepare more of it ahead of entry.
No scheduler-only or Simulator-only dismissal is claimed.

Both pages log zero frame-gate refusals during the roads. Retained
activation itself is 4 ms on Nalati and 2 ms in the first Driftwood
capture. Web Inspector Timeline remains invalid: zero timestamps and no
valid RenderingFrame coverage.

## Scheduling change

`fetchDeflatedBytes` feeds the existing native zlib decoder bounded input
blocks and checks the shared construction budget between them. Both
existing geometry bake fetch APIs use it; the SDK's authoring codec loads
the presentation-aware reader only when its runtime fetch is called, so
isolated Node writers keep their existing dependency surface. Nalati,
Pine and Signal use these paths today. Nalati’s two remaining direct
native-stream readers (species bodies and place/dressing bakes) also use
the existing SDK fetch. The native stack cannot name its input asset, so
this covers those readers without claiming which one supplied the sample.
The fetch uses page-owned pacing so a global cached read survives its
original construction owner’s retirement. Lane reconstruction uses the same
validated byte-copy operation for a complete synchronous read or bounded
word ranges separated by budget checks. No shader, material,
vertex value, index order, compressed asset, render scale or simulation
step changes. Byte equality is tested; full-scene framebuffer parity is
not claimed by these CPU/decoder checks. There is no retained decoded-bake
cache or worker allocation.

Tests compare every output byte, bound native decoder inputs, force yields
across reconstruction blocks and refuse malformed deflate/partial words.
A disposed-owner regression verifies the cached-fetch lifetime.
Driftwood's remaining synchronous creature construction and first-entry
native work are separate open targets; this change does not claim to fix
them.

## Landed source

| Commit | Change | Net shard lines | Platform runtime TS, physical |
| --- | --- | ---: | ---: |
| `180f4d4e1` | Pace native inflate and generic lane restoration | 0 | +37 |
| `554322770` | Adopt remaining Nalati readers; page-lived fetch | Nalati −2, others 0 | +1 |

Both commit bodies record the six-test host score, file/line evidence,
measured shard delta and checks. No runtime file is deleted. No asset or
look changes, so no visual variant board is introduced.

## Evidence

`native-evidence.json` retains the recorder commands, source pin, process
identities, clock anchors, per-frame native sampled weights and Metal
interval unions. `page-evidence.json` retains hook context, draw-gate
counts and the Inspector coverage failures. Their diagnostic p95 values
have no quiet timing credit. The first Driftwood page capture completed,
but its native recorder failed; only `dw-all` has native CPU credit.

The previous quiet checkpoint is part five's final pair at `533662de4`.
Other mainline work has landed since that pin, so a comparison to that
pair is a checkpoint comparison, not an isolated causal A/B experiment.

The focused test file was already registered in
`scripts/gate-test-products.json`; no new test file is introduced.

The change adds 38 net physical TypeScript lines in platform modules and
one package export (Git diff). No shard runtime file or module is deleted;
the measured source-basis delta is two fewer Nalati lines and zero in
each other shard. This performance task adds no runtime-file deletion
credit. The engine decoder's
six-test host score is 6/6: real Nalati/Pine/Signal users, URL data only,
no shard identities or callbacks, native streams exercised in Node, and
remaining users if the first is deleted.

## Source checks and ruler

Source fixes: `180f4d4e13facbaae3b73e5f90eb79b3c56411d2` and
`554322770a39e2c8a69b6e0f63dd27a702020bf9`. Checked tree: `baf460b147545434f8584d84285226ce394df453`, with
source-basis parent `c14cfd71c89e8db745aad276c568d64ad7450d4d`. `40` focused tests in five
files pass, including all 17 shard-headless cases and the real specimen
catalogue fixture. Root/layer types, typed lint and all ten generated
products pass in the build mirror. Proof:
`.git/proofs/20261017T122655-sp-x1-road6-reader-checks-91303.json`. The exact landed preview plus root/layer
types also pass in
`.git/proofs/20261017T123609-sp-x1-road6-serve-readers-40474.json`.

The current JSON-aware source ruler runs in the build mirror.
`first-ruler.json` records the first fix against its own complete
before/after products. `adoption-ruler.json` records the second fix:
AFTER uses its complete checked products; BEFORE uses the immutable
first-fix preview products after verifying identical parent shard,
engine, SDK, format and section-producer inputs. Its evidence records
the exact input paths checked.
Net -2 shard lines (nalati-grasslands -2, others -0). No runtime file
is deleted.

## Quiet AFTER pair

The coordinator granted an AFTER-only CPU hold for the landed fix. The
runner acquired `.git/push.lock` with BSD `fcntl.flock`, drained existing
jobs with native process-exit events, checked empty heavy/browser/Simulator
lanes and created its own quiet marker. Its `finally` removed that marker,
released the lock and sent `HOLD RELEASE, BOTH surfaces`. The coordinator
allowed deploy-critical push work to preempt this window; the runner
checked push timing events and running pushers after each pass. Neither
pass overlaps a recorded push or ends with a pusher active. The validity
records are retained in `paired-rows.json`.

Exact DEVSERVER source: `554322770a39e2c8a69b6e0f63dd27a702020bf9`. Optional GL timers, task-clock
and Inspector Timeline are off; the standard ownership counters remain.
Order: Sky, Nalati, Pine, Driftwood; two runs per road, 120-frame windows,
phone tier, 2× render scale, KTX2 pinned and capability probe skipped.
Only a row passing in both runs receives floor credit; a missing row gets
no paired credit. Both runs complete without runtime errors (165.9 and 160.7 seconds).
The proof runner exits 2 because the frame floor fails, not because
either measurement is incomplete. Proof:
`.git/proofs/20261017T130551-sp-x1-road6-quiet-after-87906.json`.

| Row | AFTER 1 / 2 p95 | AFTER 1 / 2 max | Both pass |
| --- | ---: | ---: | :---: |
| spawn | 34 / 34 ms | 45 / 34 ms | yes |
| grid-deck-east | 34 / 34 ms | 36 / 34 ms | yes |
| grid-deck-north | 34 / — ms | 34 / — ms | no |
| grid-far-reach-road-entry-travel | 34 / 34 ms | 134 / 127 ms | yes |
| grid-far-reach-road-entry-drive | 35 / 34 ms | 134 / 127 ms | yes |
| grid-far-reach-road-entry | 34 / 34 ms | 35 / 35 ms | yes |
| grid-nalati-grasslands-road-entry-travel | 45 / 43 ms | 100 / 73 ms | no |
| grid-nalati-grasslands-road-entry-drive | 34 / 35 ms | 100 / 88 ms | yes |
| grid-nalati-grasslands-road-entry | 34 / 34 ms | 35 / 35 ms | yes |
| grid-pine-hollow-road-entry-travel | 42 / 40 ms | 87 / 105 ms | no |
| grid-pine-hollow-road-entry-drive | 34 / 35 ms | 98 / 105 ms | yes |
| grid-pine-hollow-road-entry | 34 / 34 ms | 34 / 34 ms | yes |
| grid-driftwood-isle-road-entry-travel | 39 / 42 ms | 96 / 97 ms | no |
| grid-driftwood-isle-road-entry-drive | 34 / 35 ms | 96 / 97 ms | yes |
| grid-driftwood-isle-road-entry | 34 / 34 ms | 34 / 34 ms | yes |
| grid-crossroads | — / 34 ms | — / 34 ms | no |

The paired frame-floor goal remains open: three required travel rows fail
in both runs (Nalati 45/43, Pine 42/40 and Driftwood 39/42 ms). Nine of
twelve required road rows pass in both runs. Two selected scan poses
(`grid-deck-north` and `grid-crossroads`) occur in only one run each and
receive no paired credit. All observed maxima stay below 200 ms; the
largest maxima are 134/127 ms.

All four whole-drive rows and Sky travel pass in both runs. Relative to
[part five](../sim-road-part5-2026-10-17/README.md), the newly paired passes
are Sky travel, Sky whole-drive, Pine whole-drive and Driftwood whole-drive.
These are checkpoint transitions, not isolated proof that this change
caused them: unrelated mainline work separates the two source pins.
Nalati and Pine travel remain at roughly the earlier noise floor; the
standing 30–60 fps goal is not achieved.

`paired-rows.json` preserves each run's p95, maximum, CPU ownership pass,
validity flags, exact source and proof-record paths. Native profiling
preceded the quiet pair on the earlier checkpoint, so no isolated causal
performance A/B claim is made across unrelated mainline commits. The
remaining targets include the Nalati/Pine/Driftwood travel tails,
Driftwood's long WebContent preparation continuations and first-entry
native work. The traces do not justify dismissing them as
Simulator-host scheduling artefacts.
