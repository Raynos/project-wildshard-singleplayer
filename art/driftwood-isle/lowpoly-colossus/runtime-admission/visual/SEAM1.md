# Seam1: source-only local correspondence candidate

Prepared after actual original source/native rest comparisons, 2026-10-19.
This is **not selected or exported**. Original V4, GLB, payload and all evidence
are untouched. No Blender/build/browser ran for this candidate preparation.

Only `Shin growth -1 living seam` uses ring correspondence offsets `[0,2,4]`.
All 18 point coordinates, the two original cap polygons, 14 source face color
indices and all other 226 source meshes are unchanged. The two span connections
are shifted by two positions each. This changes only the twelve seam side
polygons; no global or isolated-triangle winding flip is used.

`prepare_seam_candidate.py` pins original source SHA and emits the separate
`build_colossus_v4_seam1.py`. Its default output, GLB filename and metrics filename
are separate from V4. The original source is never overwritten. Future Blender
execution must use a new `--out` child beneath this visual directory or project
tmp, never the original V4 output. Do not invoke Blender without a granted lane.

Six pure-source tests pass, including executing all 227 mesh constructors with
a numeric Vector substitute: every point and face-color sequence is identical;
only the named seam's side faces differ. All 30 undirected edges have exactly
one traversal in each direction. Both possible diagonals of every side quad
have positive alignment with its polygon normal: minimum .989908, versus
−.186065 originally. This is not an exported-GLB normal test. The original
both-diagonal audit has six negative hypothetical triangles, versus three
negative triangles in the pinned actual GLB.

Material preservation here means the same color per source face index, including
caps. Reconnecting vertices necessarily changes a side face's spatial coverage;
that change requires visual review. Original source DoubleSide and eye/heart
emission records are unchanged, and native loss of those semantics remains
unresolved. This candidate does not adapt materials or solve the 1,733 original
normal deviations globally.

Next gate: a bounded separate Blender export, exact point/cap/material and all
unaffected GLB mesh comparisons, fresh candidate native conversion with its own
pins, then matched original/candidate source/native game-host pairs. Review
closed volume, side crossing/folds, shading, seam attachment and full-model
identity before the coordinator chooses a technical repair. No animation,
attachment-deformation or gameplay admission follows from these source tests.

```sh
python3 -m unittest discover -s art/driftwood-isle/lowpoly-colossus/runtime-admission/visual -p test_seam_candidate.py -v
```
