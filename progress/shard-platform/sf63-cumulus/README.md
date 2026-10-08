# SF63 cumulus: Driftwood's cloud ring inside its grid cell (SHARD-PLATFORM, E435)

The last cheap G232 gap (`../sf63-gaps/README.md`, gap 4): standalone Driftwood shows its faceted cumulus ring, while inside
its grid cell the ring was missing. The ring already followed the camera and was depth-tested correctly.

## The cause: draw order inside the layer, not depth, fog or the far plane

`probe.mjs` drove into the cell (entry stop, facing west) and tried three things in turn:

| Experiment | Ring seen |
|---|---|
| As is | no |
| Ring depth test off | no, so nothing in the world hides it |
| Ring drawn last (render order 1000) | **yes** |
| Dome hidden | **yes** |

The renderer's transparent list showed the order the frame actually drew: **the ring (id 2068, z 159) before the dome
(id 2066, z −0.16)**, both at render order −9.5.

Standalone, Driftwood draws an opaque, depth-less dome at −20 and then the transparent ring at −15. `BackdropLayer.attach`
turned every piece into a transparent at the one order −9.5. That left the two pieces to three's back-to-front sort, which
uses each geometry's bounding-sphere centre. The ring's centre is off the camera because the ring is not symmetric.
Whenever that centre sorted farther than the dome's, the ring drew first, and then the dome covered it at full weight (blend
alpha 1). How often this happened depended on the view: the old north view caught a few clouds, the west view caught none.

## The fix (generic, `src/engine/world/backdropLayer.ts`)

`layerOrders` gives each mesh of the layered dome its own render order inside the layer's band, LAYER_SKY_ORDER ± 0.4
(within −10 … −9). It keeps the order the backdrop draws in standalone: the meshes that were opaque first, by their own
render order, then the transparents, by theirs.

- Driftwood comes out as dome −9.7, ring −9.3.
- A backdrop with a single piece keeps exactly −9.5.

The dome is still owned by the region's resident scope and disposed when you leave. The change adds no program, no
texture and no allocation: it only sets render orders once, at attach.

## Proof (iPhone 16 Pro portrait, muted, Developer ON, one browser through `scripts/browser-lane.sh`)

The builds were the parent `ab6581ae5` and the candidate `8e636325d`, which is this source over `ab6581ae5`. Both were
served by `serve-build.sh --rev`.

| Check | Result |
|---|---|
| Boards at the same shard-local poses | `driftwood-entry-w.jpg`, `driftwood-inside-w.jpg` and `driftwood-inside-n.jpg` each show SHARD SELECT, grid before and grid after (`drive.mjs`, then `../playtest-2-drivein/standalone.mjs` at the `poses` of `drive-driftwood-after.json`). After the fix, the ring is there in every view, as it is standalone, and it sits behind the island and cliffs |
| Layer orders (`skyOrders`) | Before: dome −9.5, ring −9.5. After: dome −9.7, ring −9.3 |
| Programs inside | 171 before and 171 after. Shader errors: 0 |
| GL MB (`__sc_gl`) | Road: 110.53 before and after. Inside: 200.25 / 200.34 before and after, identical. Back on the road: 112.62 before and after |
| Road read-back after driving out | `readBackExact: true` before and after. This covers the lights, fog, environment, the road material's look uniforms and the chain. The Driftwood drive back works now (jetty fixed). The inside stop at x 120 still ends at the wreck, x 159.6, as in G232 |
| Unit | `test/grid-region-sky.test.ts`: a dome that is opaque at −20 with an off-centre transparent ring at −15 is layered dome-first, inside −10 … −9. sp-x1's two-visit ownership fixture still passes |

| SHARD SELECT parity against the parent (`scripts/parity.mjs --url`, phone tier, Driftwood, same lane) | Program keys are identical, and so is the count (96 and 96). Draw calls and triangles match at every pose: pier 273 / 1,316,708, beach 287 / 1,288,640, wreck 180 / 937,878. Pose image MAE: pier 0.19 / 255, beach 0.16 / 255, wreck 0.002 / 255, which is the moving water. Boot errors: 0. Both runs hit the 20 min lane cap at the parity `pause/resume` step, so they wrote only their `partial.json` (boot, poses, budgets, walk). This is infrastructure and affects both sides equally. The layer runs only in a grid region, so SHARD SELECT never reaches this code |
| `scripts/test-facade-instancing.mjs` (candidate) | PASS on desktop, the phone tier and iPhone desktop quality: 0 batches, 24,710 / 24,710 / 16,389 instances |

## Files

- `probe.mjs`: the draw-state probe and the experiments above (it finds the layer at −9.5, so it reads the parent build).
- `drive.mjs`: sf63-gaps' drive, reading the layer's band and adding `skyOrders`.
- The three boards.
