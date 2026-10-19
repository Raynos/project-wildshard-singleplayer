# Bellback V6: complete static candidate

2026-10-19 03:20 UTC. **Fresh independent likeness review pending.** No score
or acceptance is assigned by the builder. V5's independent 3.385/5 failure
remains recorded separately and unchanged.

## Inspect

All evidence is under `art/driftwood-isle/lowpoly-bellback/`:
- `comparison-board-v6.webp`: original approved concept beside actual hero
- `bellback-study-v6-hero.webp`: actual complete hero
- `bellback-v6-nine-board.webp`: all nine fixed-camera views
- `bellback-v6-01-front.webp` through `bellback-v6-09-diag-back.webp`:
  individual actual views
- `capture-v6-hero.json`, `capture-v6-nine.json`: source pins, camera bounds,
  topology, image hashes and eye-visibility diagnostics
- `validation-v6.json`: native GLB validation
- `closure-v6-final.json`: complete frozen path/bytes/SHA256 list

The unchanged authoritative concept is
`art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/bellback-lowpoly.webp`.
Its original oblique view constrains likeness. Hidden rear/top anatomy is
inferred. Inspection images are actual Blender geometry renders, never AI
paintovers or game captures. There is no view-dependent geometry or relighting.

## What changed and what was measured

V6 replaces the eye-covering swept brow with a closed shaped timber whose
underside clears the inset amber triangle. The whole head is compacted 14%
in depth about its neck, preserving relative feature registration. Dental
contour is slightly less uniform. Bell color fields are broader/calmer; the
upper bronze band is moved down where it visibly reads. The physical cavity,
inner wall and clapper remain. Crown cleanup removes the loose edge; outward
normals and flattened sole contact are explicit source operations.

Both eyes have three of four sampled positions visible from the front, and
the near eye has three of four visible from each cardinal side and elevated
side. The remaining sampled point is blocked by its socket rim, not its brow.
This is diagnostic evidence, not an automatic facial-likeness score.

All 73 mesh components have zero nonmanifold edges and zero zero-area faces.
Sole minimum is exactly Z=0. All nine views passed complete-vertex projection
bounds. The hero and nine-view rebuilds produced byte-identical GLBs:
325,032 bytes, SHA256
`ec5850fda8a97e7eef064098fdb212d4e2be2f5dc4699548de0430f812b8e7b0`.
The export has 4,458 triangles, 81 nodes, 73 meshes, 166 material primitives
and 15 materials. Header/length, finite attributes, triangle index bounds and
self-contained buffers pass; there are no external images or dependencies.

Seven named rigid pivots partition body, head, bell and four legs. They are
an articulation starting point, not a skeletal rig or tested animation.
There are zero skins and zero animation clips. Material batching, real
walk-around/motion, runtime combat, hit/death, loot/retry, empty persistence
and physical-phone performance remain untested. Do not infer phone readiness
from the triangle count; 166 material primitives still need runtime work.

## Reproduce

Reserve the coordinator's heavy lane, then from repository root:

```sh
blender -b -t 2 --python-exit-code 1 \
  -P art/driftwood-isle/lowpoly-bellback/capture_review_v2.py -- \
  --source build_bellback_v6.py --out tmp/bellback-v6-reproduce --shots nine
python art/driftwood-isle/lowpoly-bellback/validate_glb.py \
  tmp/bellback-v6-reproduce/bellback-study-v6.glb \
  --out tmp/bellback-v6-reproduce/validation.json
```

Use `--shots hero` for the fixed oblique comparison. Source SHA256:
`952a8ddca0991a5aaaf1044d3a0498626567d6805881b77e43450c65f1e90a1d`.
All V4/V5 failures and evidence are preserved. No engine, Site, Mac or remote
repository changes were made by the builder.
