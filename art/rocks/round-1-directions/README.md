# Rocks, round 1: directions (E114, 2026-09-24)

The user, on the wreck and on Explore's Boulder: "The low poly rocks of the shipwreck look like shit. Most low poly
rocks look like shit … way too basic." Three directions are built behind `?rocks=a|b|c` (`src/world/rockKit.ts`); the
current look stays the default until a pick. D is a mockup only.

**Decision board: `board.jpg`**. Columns NOW / A / B / C / D. Rows: the Qwen mockup, the wreck reef in game, Explore →
Shipwreck, Explore → Boulder. Each row uses one camera. All captures are phone 390×844 @2×, muted, on Metal.

| file | what |
|---|---|
| `board.jpg` | the decision board (one image, labelled NOW / A / B / C / D) |
| `ref-live-reef.jpg` | the live capture every mockup edits: `?explore=world&cam=146,4.0,-12.5,-1.87,-0.3`, the Explore chrome hidden |
| `mockup-A.jpg` | A, chiselled: a few large clean planes, chipped corners, a flat moss-capped top (Qwen, seed 7) |
| `mockup-B.jpg` | B, smooth painted: rounded smooth-shaded boulders, a dark foot fading to a light crown, moss draped over the top (seed 7) |
| `mockup-C.jpg` | C, layered slabs: wide stacked sedimentary slabs, bevelled edges, moss on the ledges (seed 7) |
| `mockup-D.jpg` | D, ink outline: faceted rocks with a thin dark outline, Wind Waker style. Mockup only (seed 42) |
| `game-reef-{current,a,b,c}.jpg` | the wreck's reef rocks in game, same camera, `&rocks=<x>` |
| `game-wreck-{current,a,b,c}.jpg` | Explore → Models → Shipwreck (`?explore=model&model=wreck&touch&tier=phone&mute=1`), turntable held still, zoomed ×10 |
| `game-boulder-{current,a,b,c}.jpg` | Explore → Models → Boulder (`?explore=model&model=boulder…`) |
| `boulder-crack-fix-before-after.jpg` | the see-through crack bug on v0.3.0's Boulder (left) and fixed in e953a5a (right) |

The mockups are masked edits (`scripts/mockup-local.sh --mask`, white over the rock area only), so outside the mask
they match the live frame pixel for pixel. The board crops every reef tile to that mask box, so no seam shows. Re-rolls:
the first unmasked pass (seed 42) greyed the whole frame and turned the sea to sand, so every letter was re-run masked
with seeds 42 and 7. A, B and C use seed 7, D uses seed 42.

What each built look is (triangles are averages over the wreck's 17 reef rocks and a shore-scatter-sized set of 110):

| look | built as | tris / rock (wreck · shore) | draws |
|---|---|---|---|
| NOW | jittered icosahedron, green cap on up faces | 80 · 31 | — |
| A | convex polytope from ~26 planes cut through an ellipsoid (a dual convex hull), 12 corner chips, 1–3 fused shoulder blocks; moss on up planes, a wet foot, warm/cool greys per plane | 271 · 302 | +0 (merged into the kit) |
| B | welded icosphere (detail 2–4) with fbm lumps, soft terraces and 1–2 cracks, smooth normals; vertex-painted foot→crown gradient, crease AO from curvature, a noisy moss edge | 279 · 318 | +1 per wreck / cove (own smooth program) |
| C | 2–6 stacked, chamfered, irregular slabs with a shared dip; alternating strata greys, lit chamfers, moss on the exposed tops | 185 · 227 | +0 |

The switch covers the wreck's reef rocks (`Wreck.ts`), the shore boulders and Explore's Boulder (`Boulders.ts`), the
cove's loose tidepool and plunge-pool rocks (`Cove.ts`, not its crag or cave walls), and the ground-cover pebbles
(`GroundCover.ts`). The built rows are first passes; the mockup row shows where each direction would go once picked.
The Explore studio light washes out the pale shore palette on the Boulder row.
