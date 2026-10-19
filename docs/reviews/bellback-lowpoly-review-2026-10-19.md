# Bellback low-poly review, 2026-10-19

Approved target: `art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/bellback-lowpoly.webp`.
This is the original owner-approved illustration. Its hidden surfaces are not
measured references; the rear and top of the candidate remain interpretations.

## V5: independent result below the target

At 03:09 UTC the coordinator independently inspected the original, V5 hero
and all nine actual view panels. The unchanged rubric gives:

| Criterion | Weight | /5 |
| --- | ---: | ---: |
| Silhouette/proportions | 35% | 3.6 |
| Face/expression | 30% | 3.0 |
| Defining details | 20% | 3.5 |
| Facets/style | 15% | 3.5 |
| Weighted likeness | | **3.385** |

This fails the owner's **strictly above 3.5/5** requirement. The result is
provisional visual likeness, not user acceptance, game readiness or animation
quality. No rounding or unrelated structural pass raises it above the gate.

The broad stance, mass and bell identity are stronger than V4. The visible
hollow bell and distinct physical clapper survive review. Eyes remain nearly
hidden under the brow; side muzzle reads long and planar; the lower W-jaw is
more uniform than the concept. Bell facets should remain broad and purposeful
rather than accumulating small, high-contrast triangular patches.

## Evidence and reproducibility

Under `art/driftwood-isle/lowpoly-bellback/`:
- `build_bellback_v5.py`: SHA256
  `c798497883c47c76b1eb90828cd78a4c775cbab901c2ea4da75a05a0e7ef28bb`
- `capture_review_v2.py`: fixed camera/lighting capture, overhead front-up,
  actual orthographic eye visibility rays; SHA256
  `a3b31173f044f959cf0961f35b237c0427c10201b7cc258c834c55df7487ce2d`
- `comparison-board-v5.webp`: approved concept crop and actual hero
- `bellback-v5-nine-board.webp`: all nine actual views
- `capture-v5-nine.json`: camera bounds, image hashes, geometry topology and
  per-eye occluder names
- `closure-v5-hero.json`, `closure-v5-nine.json`: exact evidence paths/bytes/hashes

Both frontal eyes and the near eye in each cardinal side view have only one
of four sampled lens positions unobstructed. The other three are blocked by
`Layered brow timber`. Rear/top occlusion is not a failure by itself. The next
revision should change the brow geometry, rather than moving the eyes out of
the skull to cheat visibility.

V5 has 4,470 triangles, 73 separate mesh objects and seven rigid pivot nodes.
The GLB is 327,332 bytes, held under ignored `tmp`. All component meshes have
zero zero-area faces. The bell has one loose edge from coincident crown-ring
cleanup; other objects have zero nonmanifold edges. This defect remains in the
preserved V5 source and capture. The measured lowest sole is about 9.9 mm below
model origin, also requiring correction. The camera-bound checks passed all
nine shots; they check full geometry, not selected landmarks.

## Next complete candidate

V6 is prepared as an unbuilt source correction at this review boundary:
explicit shaped brow underside, compacted whole head, slight dental contour
variation, broader coherent bell color fields, visible upper bronze band,
closed crown cleanup, outward normals and flattened sole contact. Its source
is not evidence that these changes work. Render and independent review remain
required before any quality claim.

Runtime integration, walking/attacks, hit/death, loot/retry, persistence and
physical-phone performance remain untested for this candidate. Named rigid
pivots support later articulation, but no rig, animation or combat pass is
claimed. No engine or Site source was changed by this modeling work.
