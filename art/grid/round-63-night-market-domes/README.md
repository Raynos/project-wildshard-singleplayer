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
| 40 m above road | [B1 target · 8/9](B1-40m-stand/sheet-target-3x3.jpg) · [baseline](B1-40m-stand/sheet-baseline-3x3.jpg) | [B2 target](B2-40m-look/sheet-target-3x3.jpg) · [baseline](B2-40m-look/sheet-baseline-3x3.jpg) |
| 100 m above neighbour | [C1 target](C1-100m-stand/sheet-target-3x3.jpg) · [baseline](C1-100m-stand/sheet-baseline-3x3.jpg) | [C2 target](C2-100m-look/sheet-target-3x3.jpg) · [baseline](C2-100m-look/sheet-baseline-3x3.jpg) |
| Plaza | [D1 target](D1-plaza-stand/sheet-target-3x3.jpg) · [baseline](D1-plaza-stand/sheet-baseline-3x3.jpg) | [D2 target](D2-gate-look/sheet-target-3x3.jpg) · [baseline](D2-gate-look/sheet-baseline-3x3.jpg) |

[The overview](sheet-overview.jpg) shows each dome's forward
view with the missing-target qualification burned into its title.
RM2 captures the same 72 manifest views on HEAD and reports
actual triangle, draw and memory costs. Neither these targets
nor their detail count supplies that proof.

RM2 baseline: all 72 views on `903baf53bc`, iPhone 16 Pro, phone tier,
render scale 2, a 2:3 portrait viewport and the exact 62° horizontal
lens in each manifest. Normal entry prepares the physical anchor;
the existing free camera then holds each requested eye/look.
Tiles, fog, world visibility and the far plane keep their shipping
settings. A1/B1 remain on the road; C1 stands in the actual Signal
neighbour and retains its sky. These three show Night Market's near
view. A2/B2/C2/D1/D2 are entered. Each dome's body stays at its
ground anchor while the nine detached eyes follow its manifest.
Each view observes 120 completed game draws. The frozen gameplay
camera protocol is descriptive, not a frame-floor acceptance run.

| Dome | Max whole-scene draws | Max whole-scene triangles | Night Market claims MiB | Page renderer / GPU MiB |
|---|---:|---:|---:|---:|
| A1 | 139 | 307,798 | 65.121 | 735.771 / 906.877 |
| A2 | 148 | 339,674 | 85.287 | 1,209.083 / 886.143 |
| B1 | 127 | 296,187 | 63.670 | 734.817 / 918.563 |
| B2 | 170 | 331,062 | 117.073 | 1,214.646 / 874.580 |
| C1 | 122 | 287,121 | 36.915 | 794.130 / 923.127 |
| C2 | 193 | 330,691 | 114.783 | 1,211.333 / 885.330 |
| D1 | 150 | 348,643 | 114.783 | 931.896 / 875.689 |
| D2 | 156 | 361,596 | 114.783 | 1,234.036 / 879.486 |

Draw/triangle maxima include the whole composer and neighbouring
cells, not just Night Market. All eight whole-scene maxima exceed 120
draws; Night Market's own contribution was not isolated. Triangles
stay below 600k. Claims are the existing effective
residency accounting, including shared product transport once.
The separate post-dome CDP private footprints describe the whole
Chromium page, not native iOS memory or a per-shard 1.2 GB verdict.
Browser-process samples were A1 627.268, A2 630.252, B1 626.658,
B2 632.049, C1 635.408, C2 637.268, D1 636.080 and D2 636.533 MiB.
No forced GC or app instrumentation was added. Two sequential cohorts
on one shared preview complete in 325 / 332 seconds, with no page errors.

C1 uses the actual outside near tier (eight L1, zero L0); it is not
a fully entered market disguised as an outside view. C2 view 9 uses
the specified 600 m detached eye while the body remains at its central
anchor, so Night Market stays entered. That image does **not** certify
RM11's far proxy. RM0 streaming acceptance and RM12's live frame and
native-memory gates also remain separate from these baseline sheets.
