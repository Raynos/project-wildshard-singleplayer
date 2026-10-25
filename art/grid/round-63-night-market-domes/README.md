# Night Market dome targets · G726 RM1

Four hero cameras, each with a stand/look pair: eight domes,
72 specified views. The exact camera manifests and floor plans
are committed in each directory. Built-in imagegen produced
two grid candidates per dome; each README records the prompt
set, candidate choice and corrections. The runtime look is
unchanged: these are targets for the remaster, not captures.

**Status: 71/72 detailed targets.** B1 target 2, the southwest
aerial, was refused twice by the image tool. It has no detailed
target file. B1's sheet displays an explicit gap, and RM1 stays
in flight. No substitute image or fallback service was used.

| Pair | Stand | Look |
|---|---|---|
| Road entry | [A1 target](A1-road-stand/sheet-target-3x3.jpg) · [baseline](A1-road-stand/sheet-baseline-3x3.jpg) | [A2 target](A2-road-look/sheet-target-3x3.jpg) · [baseline](A2-road-look/sheet-baseline-3x3.jpg) |
| 40 m above road | [B1 · 8/9](B1-40m-stand/sheet-target-3x3.jpg) | [B2](B2-40m-look/sheet-target-3x3.jpg) |
| 100 m above neighbour | [C1](C1-100m-stand/sheet-target-3x3.jpg) | [C2](C2-100m-look/sheet-target-3x3.jpg) |
| Plaza | [D1 target](D1-plaza-stand/sheet-target-3x3.jpg) · [baseline](D1-plaza-stand/sheet-baseline-3x3.jpg) | [D2 target](D2-gate-look/sheet-target-3x3.jpg) · [baseline](D2-gate-look/sheet-baseline-3x3.jpg) |

[The overview](sheet-overview.jpg) shows each dome's forward
view with the missing-target qualification burned into its title.
RM2 captures the same 72 manifest views on HEAD and reports
actual triangle, draw and memory costs. Neither these targets
nor their detail count supplies that proof.

RM2 road/plaza baseline: `903baf53bc`, iPhone 16 Pro, phone tier,
render scale 2, a 2:3 portrait viewport and the exact 62° horizontal
lens in each manifest. Normal entry prepares the physical anchor;
the existing free camera then holds each requested eye/look.
Tiles, fog, world visibility and the far plane keep their shipping
settings. A1 remains outside on the near view; A2/D1/D2 are entered.
Each view observes 120 completed game draws. The frozen gameplay
camera protocol is descriptive, not a frame-floor acceptance run.

| Dome | Max whole-scene draws | Max whole-scene triangles | Night Market claims MiB | Page renderer / GPU MiB |
|---|---:|---:|---:|---:|
| A1 | 139 | 307,798 | 65.121 | 735.771 / 906.877 |
| A2 | 148 | 339,674 | 85.287 | 1,209.083 / 886.143 |
| D1 | 150 | 348,643 | 114.783 | 931.896 / 875.689 |
| D2 | 156 | 361,596 | 114.783 | 1,234.036 / 879.486 |

Draw/triangle maxima include the whole composer and neighbouring
cells, not just Night Market. All four whole-scene maxima exceed 120
draws; Night Market's own contribution was not isolated. Triangles
stay below 600k. Claims are the existing effective
residency accounting, including shared product transport once.
The separate post-dome CDP private footprints describe the whole
Chromium page, not native iOS memory or a per-shard 1.2 GB verdict.
Browser-process samples were 627.268 / 630.252 / 636.080 / 636.533 MiB,
respectively. No forced GC or app instrumentation was added.
