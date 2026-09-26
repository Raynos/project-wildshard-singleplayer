# A2 · gate-look — dome B's loop 5 (E169, 2026-09-26): under the lane cap

budget.md put the A2 square lane at 0.51 M tris / 25 draws against a cap of **0.42 M / 18**. `eye-check.jpg`: before ·
after for the spawn (+ style-A), A2 views 6, 1, 4 and aerial 3 (`before/` = the same cameras just before the cuts).

## The cuts

| Cut | File | Draws | Tris |
|---|---|---|---|
| Seven kits → two: `paifang` (the gate, the banyan, both stalls, the sign masts, the lantern strings) and `props` (the balustrade, tables, lamps, the floor); one program, so one draw each | `banyan.ts`, `stalls.ts`, `square.ts` | −5 | 0 |
| The TRELLIS pots and lantern trios out (four small props, 23 k) | `props3d.ts` | −2 | −23 k |
| The canopy: 2.6 cards per m² (was 3.6), a lat 4 × lon 7 core (the organic lab's phone levers) | `canopy.ts` | 0 | −22 k |
| The gate's carving at a lower resolution (relief bodies 12 × 4, scrolls 8 × 3, heads 3 × 6); the 28 studs per drum stone out | `gate.ts` | 0 | ~−22 k |
| (loop 4) the crowd's per-figure culling + far LOD | `crowd.ts` | — | ~−480 k |

**Reverted by eye**: the TRELLIS lion at half its triangles (clustered to 4 k): the lion on the post by the spawn went
blobby. Back to 8 k; the lever (−36 k) stays documented in `props3d.ts`.

By eye at phone size the frames are unchanged (the canopy is as dense, the carving reads the same, the pots were never
visible from the domes' cameras).

## The lane now (`scratchpad/domeb/lane.mjs`, rendered, all passes)

| Group | spawn | A2-3 | A2-5 | A2-6 | A2-9 |
|---|---|---|---|---|---|
| kit:paifang (gate + banyan + stalls + masts + strings) | 84 k / 1 | 84 k / 1 | 84 k / 1 | 84 k / 1 | 84 k / 1 |
| crowd | 69 k / 6 | 68 k / 6 | 33 k / 4 | 24 k / 7 | 37 k / 6 |
| canopy | 45 k / 2 | 45 k / 2 | 45 k / 2 | 45 k / 2 | 45 k / 2 |
| kit:props (+ floor) | 12 k / 1 | 12 k / 1 | 12 k / 1 | 12 k / 1 | 12 k / 1 |
| props3d (lions) | 10 k / 1 (19 k with the 8 k lions back) | | | | |
| **dome B** | **~230 k / 11** | **~230 k / 11** | **~185 k / 9** | **~175 k / 12** | **~190 k / 11** |

(+ the shared paper-lantern batch in the square region, 4–25 k / 1.) Under the cap: 0.42 M / 18.

## For dome C: TRELLIS lions on its posts

`props3d.ts` exports `placeLion(x, y, z, rotY, scale = 1)`: queue a lion while the world is being built (any world/
builder); it draws in dome B's lion instanced mesh (no extra call). (x, y, z) = the top of the post (dome B's posts:
y = Y0 + 1.12); rotY about +y: 0 faces +z (south), π/2 +x (east), π −z (north); scale 1 = 0.62 m tall, ~8 k triangles.
