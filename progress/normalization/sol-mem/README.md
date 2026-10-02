# E357 L2/L4 — Nine Dragon memory measurement

The previous reading was **720dd05b2e36846d28a72c8bc8859ef5b73645f4**, in
`~/.wildshard/gpu-perf/memory-2026-10-01T22-27-40-199Z-720dd05.json`.
The report selector in `scripts/gpu-perf/nightly.mjs` chooses the most recently started prior report with memory rows.
G6 (26b5f6b3), L8 sky split (ceaac453), J6 (dee61b01), and R9 (eb3d9a78) all predate that reading.

| Runtime SHA | Run | Loading peak GB | Play peak GB | Explorer peak GB |
| --- | --- | ---: | ---: | ---: |
| 720dd05b | Original nightly | 0.780 | 0.385 | 0.357 |
| f3a4a933 | Original nightly | 0.758 | 0.589 | 0.439 |
| f3a4a933 | Cold Nine-only repeat | 0.757 | 0.453 | 0.402 |
| 720dd05b | Cold Nine-only repeat | 0.770 | 0.428 | 0.459 |

The old SHA itself increased 11.2% in play and 28.6% in Explorer; the repeated Explorer comparison reversed.
All four runs had identical scene statistics: 50,856,306 geometry bytes, 3,936,472 instance bytes,
2,228,248 texture-image bytes, 1,330 arrays, 35 scene textures, 154 GPU geometries, 54 GPU textures, and 65 calls.
The failed original play phase started at 589 MB and fell to 439 MB within two seconds; Explorer stayed flat near
438 MB. No allocating commit or new asset was established. Garbage collection / allocator retention is an inference,
not an identified allocation stack. G13's creature checks cannot add Nine creatures (`species: []`); G17's terrain
painter path is bypassed by Nine's `structures: true`. G16 adds capture metadata which this memory driver never invokes.

The lead stopped the bisect on 2026-10-01 and requested a measurement correction. The driver now waits after each
phase's work for three one-second readings with adjacent native footprints within 2%, or at most 20 seconds;
the last three valid readings supply the native and Inspector medians. Reports record every selected sample,
min/max, spread in GB and percent, elapsed settling time, and whether the deadline was reached. Missing readings fail.
Growth still fails strictly above 10%. **Raw native phase high-water peaks still enforce the absolute caps**:
loading 1.8 GB, play 1.0 GB, Explorer 1.0 GB. Existing historical reports remain readable as `legacy-peak` measurements.

`evidence.json` preserves the original and repeat summaries. Repeats used clean `serve-build.sh --rev <sha>` exports
and the committed `sim-memory.mjs` harness, through `sim-lane.sh run --max 10 wildshard-iphone`, with
`--shards=nine-dragon-stack --runs=1 --play=60 --fly=60`. Runtime and assets are unchanged by the correction;
facades remain instanced. No pin acceptance or new memory success status was posted.

Validation: `test/sim-memory-settling.test.ts` covers the synthetic 589→439 MB spike, settling reset, the timeout,
missing/invalid measurements, the unchanged growth band, and absolute-cap spikes. The lead owns the real corrected
Simulator rerun for the pin: `bash scripts/gpu-perf/nightly.sh --memory-only --sha=<landed target SHA>`.
