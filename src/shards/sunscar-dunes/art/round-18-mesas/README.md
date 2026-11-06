# Signal Dunes, round 18: textured far mesas (E374, loop 7)

The far sandstone (`src/shards/sunscar-dunes/world/buttes.ts`) as textured models instead of the pale procedural
prisms, toward the mockups' layered red mesas (`round-9-review/A-spawn-dusk-light.jpg`,
`round-17-loop-5/targets/h4-front.jpg`, `h1-diag-front.jpg`).

| File | What |
|---|---|
| `ref-butte.jpg` | codex image_gen ref: a tall narrow eroded butte (style ref `round-17-loop-5/targets/h4-front.jpg`) |
| `ref-mesa.jpg` | a broad flat-topped mesa with layered strata and a talus skirt |
| `ref-spire.jpg` | a stepped spire with two hoodoos on one rocky base |
| `before-after.jpg` | h4-tower-deck, aerial-spawn, h1-spawn-crest: HEAD 0ce91502e (left of each pair) vs the models (right) |
| `after-look-east.jpg` | from spawn looking east: a mesa up close (layered walls, varnish streaks, talus) |

Pipeline: refs → Hunyuan3D-2 (`hy3d_batch.py --shape turbo --tex 2048 --faces 60000`, under the model lock) →
weld, simplify 0.25, 1024 WebP map, meshopt → `public/assets/sunscar-dunes/models/mesa-{butte,mesa,spire}/`
(172 / 159 / 188 KB, ~11k vertices each). Each BUTTES row takes the model of its shape, fitted by height
(`h × 0.65`, 4 m sunk), its footprint stretched toward `r × 2.6` within ×1.3 of the model's own proportions; a
shape whose model did not load keeps the instanced prism. The first row became a broad mesa (h 44, r 38) so the
tower deck and the spawn aerial frame the mockups' centre mesa.
