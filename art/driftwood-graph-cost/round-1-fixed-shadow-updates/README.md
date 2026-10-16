# Fixed shadow sampler updates (G437)

The engine's graph shadow filters sample engine-owned depth textures. Their
backend Y orientation is fixed. Resolve that uniform once during shader setup
and omit the otherwise repeated object updates. The stock UV expression,
filter taps, weights, receiver bias and uniform layout stay intact.

Measured source: parent `2cc5c05cd`, candidate `45a661c10`. Desktop Chromium
with ANGLE Metal, iPhone 16 Pro viewport (402 × 874), phone tier, render scale
2×. These are CPU submission measurements, not physical iPhone frame times.
The same DW camera, frame 32 and app clock 10 s were used for both builds.
Seven rounds each rendered 120 composer frames after 20 warm-up frames.

| Median across rounds | Parent | Candidate |
| --- | ---: | ---: |
| Graph before-draw hooks per frame | 1.603 ms | 1.207 ms |
| Composer CPU per frame | 3.4 ms | 3.3 ms |
| Total draws | 147 | 147 |
| Graph draws | 74 | 74 |
| Triangles | 755,775 | 755,775 |

A separately instrumented 240-frame census put TextureUpdates at
1.021 → 0.397 ms/frame. The fixed shadow sampler nodes no longer appear in
the per-object update inventory. Remaining ordinary/reference node callbacks
keep their existing scheduling.

The labelled board shows actual frozen composer output. Both builds hide
camera-attached viewmodel children for this world/shadow comparison; world
geometry and lighting are unchanged. DW maximum channel difference is 0.
Pine's cross-build maximum is 23, confined to a thin distant horizon band;
the same parent captured again is pixel-identical (maximum 0). The small
cross-build difference is therefore real. The feature ships default-off as
Settings → Debug → Fixed shadow samples (reload). The public path retains
stock texture sampling; the numbers above describe the experiment ON.

Validation: both actual products booted without page errors; both node shadow
filters compile and retain live receiver-offset uniforms; depth retargeting
works, and a colour texture refuses. Focused tests, source types and typed lint
passed. No collider or gameplay change.
