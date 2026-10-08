# G242: the road sky is B, "grid dawn" (SHARD-PLATFORM, E455)

Jake picked B (`art/grid/round-26-road-sky/B-grid-dawn.jpg`): on the road network a dawn gradient with a thin cyan horizon
line and a faint grid that echoes the HUD and the VR void, as one shader dome with no textures, and a key light of the
road's own instead of the home shard's sun. The road's sky and light blend over the 16 m cell-edge band into each shard's
own sky (G232).

- `board.jpg`: Jake's mockup, then for Driftwood and Nalati: A the road before (G165's grey-blue dome, the home sun),
  B the road now, C on the cell edge line (half and half), D inside the shard (its own sky and light).
- `drive-road-to-driftwood.mp4`: a held-input drive from the road into Driftwood (2.2 MB, 540 px, iPhone 16 Pro portrait).
- `drive.mjs`: the capture (Developer ON grid boot, a pose onto the road, held input into the cell, then back to the road
  and in again), `drive-<shard>.json` its readouts.

## How it works (generic engine and game code, no shard named)

| Part | Mechanism |
|---|---|
| The dome (`src/game/grid/roadSky.ts`) | One camera-centred `ShaderMaterial` sphere, no textures: the dawn gradient (the frame's air at the horizon, a lavender band, a blue zenith, a warm glow toward the sun), a one-pixel cyan grid round the horizon (azimuth lines every 4°, rows at even steps of tan(elevation), antialiased with an analytic screen rate so there is no seam where `atan` wraps, faded where lines crowd and above ~14°), and a hairline cyan horizon line with a soft glow. The palette and the sun are data (`ROAD_SKY` in `frameModel.ts`) |
| The key light | A low warm dawn sun (azimuth 70°, elevation 13°, intensity 2.4), its fill, fog in-scatter colour and environment intensity, written once into the layer's own targets (`RoadSkyBackdrop.bind`) |
| The road's air | The frame's fog colour on the road is the road's dawn air (`frameFog(…, ROAD_SKY.air)`), the same colour as the dome's horizon, so far proxies haze into it |
| A base layer (`src/engine/world/backdropLayer.ts`, `SkyRig.layerBackdrop({ base: true })`) | The road's dome and key light are a layer on the page's one sky rig, like a region's own sky (G223), with one difference: a base layer is applied first and drawn under every other layer (render order −9.95), at its weight's share of what the other layers leave (`applyLayers`: `w / (1 − S)`, capped at 1). With the frame's owner weights summing to 1 the shared light and the drawn sky are exactly `w·road + Σ wᵢ·regionᵢ + (rest)·page`: on the edge line the road and the region's own sky are half and half and none of the page's sky shows. At road weight 0 the layer is off, so inside a cell the page and the region's sky are exactly what they were without it |
| No recompile at a crossing | The blend is a constant blend alpha and uniforms. The dome's one program is warmed into the composer's input buffer once the page's composer exists (`RoadSkyPage.warm`), so a boot that starts inside a cell does not compile it on the first road visit |
| Without a sky rig (tests) | The dome alone is drawn on the scene by the road weight, with no key light |

## The checks (iPhone 16 Pro portrait, muted, one browser through `scripts/browser-lane.sh`, Developer ON)

Builds: the candidate (this source over `414a98ad7`) and the parent `414a98ad7`, both from `scripts/serve-build.sh`.

| Check | Result |
|---|---|
| Road readout | On the road: road sky share 1, owner none, the shared key light is the road's (DirectionalLight 2.4 `[1, 0.8, 0.66]`, hemisphere 1.1), fog `[0.95, 0.56, 0.44]`, environment 0.7 |
| Edge line | Driftwood (its own sky layer): region weight 0.504, road share 1 (it takes all the page would have kept). Nalati (no sky backdrop, its scoped look): road share 0.496 over the page sky |
| Inside | Road share 0, the region's light and sky only |
| Road read-back after leaving | `exact: true` for Driftwood and Nalati (sun and light direction, lights, fog, environment, owner, road share, air) |
| The shard's look on re-entry | Owner, road share and carried chain identical; lights, fog and environment identical; only the sun direction differs, because both shards' day clocks run between visits |
| Programs (parent → candidate) | Road 83 → 83 (the dome's program replaces G165's). Driftwood edge / inside 179 → 180: the one extra is a shadow-depth variant (a caster the low dawn sun now reaches), no new look program. Nalati 220 → 221 inside. SF59 budget kept |
| GL MB (`__sc_gl`) | Road 94.46 → 94.49, Driftwood inside 185.09 → 185.12: the dome holds no texture memory |
| Shader errors | 0 in every drive |
| `scripts/test-facade-instancing.mjs` | PASS desktop / phone tier / iPhone desktop quality: 0 batches, 24,710 instances |
| Unit tests | `test/grid-road-sky.test.ts`: the road owns the key light on the road, the region inside, half and half on the edge line with none of the page; exact at road weight 0 against no road layer; a cell with no sky of its own keeps its page share; the dome is one shader with no textures under the region band; the frame lays it on the rig once built and warms it once |

## The desktop floor at grid-crossroads (g242-perf)

The first floor run on this change read grid-crossroads at p95 33.2 ms against 16.8 ms on its parent. That miss is not
G242's. `floor-probe.mjs` (the floor's desktop setup, the same pose) shows:

- **The floor's "crossroads" pose is inside Driftwood, not on the road.** At (240, 6, 240) the frame reads owner
  `driftwood-isle`, weights `{driftwood-isle: 1}`, road sky share 0. The road's base layer is off there (`applied 0`,
  dome hidden), so G242 draws and moves nothing.
- **The GL command stream per frame is identical on both builds.** Calls per frame for each of 38 WebGL functions match
  to two decimals (81 `drawElements`, 98 `useProgram`, 214 `uniformMatrix4fv`, 8.05 `texSubImage2D` …). Programs read
  168 on both, before and after sampling: nothing compiles while standing there.
- **The pose sits at the edge of the budget on both builds, and machine load decides pass or fail.** Render alone is
  ~14.5 ms of the 16.7 ms frame at 2880×1800 (Driftwood's 1.6 M triangles, 155 calls). In an interleaved A/B (parent,
  G242, parent, G242) both builds flipped: the parent read p95 33.4 then 16.8 ms, G242 16.7 then 33.4 ms, at a load
  average of 19–27 on 18 cores.
- **On the road, where G242 does draw** (grid-deck-north, road share 1): work p95 5.4 ms with the dome and 5.4 ms with it
  hidden. The dome costs one draw and no measurable time.

The floors on the rebuilt source (49ef3b917; its parent 2ed39b862), `node scripts/frame-floor.mjs --shards=grid --surface=<sim|desktop> --rev=<sha>`:

| Run | G242 | Parent |
|---|---|---|
| Simulator, one pair | **PASS**: spawn p95 34, crossroads 35, deck-east 34 ms | **FAIL**: crossroads p95 39 ms (spawn 34, deck-north 34) |
| Desktop 1 (G242) | 30.03 fps at every pose, spawn included: sp-x3's Simulator soak booted at that moment, so the run is contaminated | |
| Desktop 2 (parent), 3 (G242), 4 (parent) | crossroads p95 16.8 ms **PASS** | crossroads p95 16.7 / 16.8 ms **PASS** |
| Spawn, every desktop run | p95 33.4 ms | p95 33.4 ms (the shared spawn hitch, SF69; not G242's) |

The breakdown of the crossroads pose (for SF69; measured under load, so the figures are inflated): content CPU owners
total ~0.8 ms and the update phase 1.5–2 ms. Render takes ~14.5 ms quiet and ~20 ms loaded. Of the loaded figure, the
scene `RenderPass` is 9.4 ms (shadow maps 1.8 ms of it), the N8AO pass 9.9 ms (it re-renders the scene for its
transparency pre-passes) and the effect passes 0.6 ms. The GPU timer reads ~14.7 ms p50, so the pose is GPU-bound and
the AO pass is about half of it.

## Not covered here

- Pine's own cell: entering Pine fails on this base (`Regional runtime entry failed: Compressed texture … has no mipmaps`,
  the Pine P0 sp-x4 is on). Its edge line was captured: Pine's sky layer at weight 0.5 with the road share at 1.
- The road keeps G75's grey-blue grade (Jake's earlier pick) over the dawn sky; the dome's colours are set so the dawn reads
  through it.
