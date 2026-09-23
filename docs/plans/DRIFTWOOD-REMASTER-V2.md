# Driftwood Isle — remaster v2 (after v0.2)

**State:** `in progress` 2026-09-23 — v1 is archived and tagged **v0.2** (project/archive/2026-09-23-driftwood-remaster.md). Next session starts here, solo (no subagents): **V-B1 Blender island-wide** first (the user's pick). Waiting on the user: V-U1 (Look Lab lighting / sky / post picks, tried in-game), V-U2 (iPhone readings + a render-scale pick).

## The v0.2 cut — done 2026-09-23 (tag v0.2)

v0.2 = the **spawn cove at mockup quality** (the E43 9-angle loop signed off by the user), every v1 row landed or
moved here, a fresh in-engine title hero, a `v0.2` git tag. The cut's open rows live in the v1 plan until they land:
X1 learned LUT + the terrain facet fix, M3 silhouettes + captain mesh, M5 sway, X2 milestone 2 (LOD'd Blender cove +
sheets), X3 batch 3 + board, E55 settings, X5 stage-1 parity, 0.5 hero re-capture, one iPhone reading per shard.

## v2 rows

| # | Row | Owner | Status |
|---|---|---|---|
| V-U1 | **The user's Look Lab picks** (E65): lighting Toon / Standard, sky Stylized / Photo, post Clean / Cinematic — the user is trying them in-game (pause ▸ Settings ▸ Look lab); the pick becomes the default, the other stays a setting. Colour grade + painted horizon: keep on (picked) | the user | open |
| V-U2 | **iPhone readings**: one frame-rate reading per shard (PLAY-PERF's 60 fps finish line) and a render-scale pick — the phone default is 1.5× (soft on a 3× screen); 2× and Native are now in main menu ▸ Settings (12b2323) | the user's phone | open |
| V-B1 | **Blender island, island-wide**: every POI and the whole terrain through `scripts/blender/` (Geometry-Nodes scatter, sculpted rocks, the hero / CC0 assets, Cycles-baked GI + AO), LODs + phone-tier culling (≤ 150 calls, ≤ 2.0 M tris at every pose), colliders and anchors exported so the quest runs unchanged | blender-agent | queued after v0.2 |
| V-B2 | **The pick (V1)**: procedural vs Blender island, side by side at the 9 cameras of every area; the loser stays behind the main-menu toggle or is retired | the user | open |
| V-G1 | **WebGPU stage 2**: GPU-driven foliage (compute culling + LOD, wind in compute, 100 k+ blades desktop, a phone count that holds 60 fps); raw WebGPU where TSL is the bottleneck | webgpu-agent | queued after stage-1 parity |
| V-G2 | **WebGPU stage 3**: Pine Hollow on the TSL path, boot / pipeline-compile time vs WebGL on the iPhone, then the flip to default (or not) | webgpu-agent | open |
| V-L1 | **9-angle loops for the other areas**, same method as E43 (`art/driftwood-isle/round-4-remaster/README.md`): hut plateau → wreck cove → ring shrine → lookout; codex mockups (capture + one concept ref, 4–5 runs at a time), gap list, loop until signed off | look + model agents | open |
| V-L2 | Water leftovers: god-ray cones underwater, splash / bubble particles on entry, a separate dusk horizon painting, a sharper desktop horizon (more pixels per degree), the pale fogged far-sea strip from high cameras | look / horizon | open |
| V-M1 | Creatures remodelled from image-to-3D (TRELLIS.2 on MPS, `scripts/img2mesh/`): boar, bear, crab, monkey, drowned sailor, the Drowned Captain — keeping the rigs' bone names | asset + model agents | open |
| V-M2 | The wreck hero asset: a manual Blender pass on the 7.7 k-tri TRELLIS shell (solid planks, ≤ 3 k LOD0 + ≤ 1 k LOD1) | asset-agent | open |
| V-M3 | Gull breadcrumb flights toward the unvisited POIs (`gulls.breadcrumb`) | model-agent | open |
| V-P1 | Perf: the four Driftwood poses re-measured after V-B1 / V-G1; the iPhone meter ≥ 55 fps in each shard (PLAY-PERF's finish line) | PLAY-PERF owner + the user's phone | open |
| V-X1 | Loading screen honesty: Driftwood's steps named for Driftwood (no "HDRI → PMREM", "Pine branch cards", "Cabins", "Crossbow"), the code bundle counted in DOWNLOAD | LOAD-PERF owner | open |

## Decisions carried over

v1's D1–D10 stand (toon ramp, stylized sky, a 20 + 4 min clock, MMO floats, the castaway spine, the guarded iron sword,
Driftwood-only look, textures allowed, whatever it takes). New: V1 (above).
