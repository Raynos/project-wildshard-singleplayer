# Brine Puffer: continuous forefin study

Unaccepted independent static study against the approved original and retained V71.
No runtime or retained model is changed. Only two forefins are replaced in memory.

## Evidence-based intent

The approved original's large left-hand creature shows a broad teal slope carrying
its mass into four joined angular cream lobes. Orange separates the teal web from
its cream terminal edge. The visible forefoot is short relative to the pouch and
has no isolated ankle or row of separate toe blades. Hidden underside anatomy is
inferred; the concept does not establish a measurable 3D footprint or rig.

V71's forefins extend to z=0.958 m and x=+/-0.979 m. This candidate's coherent closed
web ends at z=0.675 m and x=+/-0.870 m. The exact root polygon, root height and bone
pivots are retained. Twelve original root corners are retained byte-for-value;
interpolated boundary points allow continuous 36-spoke connection to four broad terminal
lobes and their shallow valleys. The root slopes into the web without an appended
toe component. All four feet still use the original y=0.00400000019 m contact plane.
Rear feet are untouched so this comparison isolates the dominant forefoot problem.

## Reproduce and inspect

- `python art/driftwood-isle/puffer-fin-study/build_fins.py`
- `python art/driftwood-isle/puffer-fin-study/check_fins.py`
- With the coordinator's heavy lane only: `blender -b -t 4 --python art/driftwood-isle/puffer-fin-study/render_comparison.py -- --out tmp/puffer-fin-study`

`fin-fans-indexed.json` is editable indexed mesh data with face regions and explicit
root indices. `fin-native-study.json` is the genuine two-part native mesh payload,
not a binary backup and not a complete creature. Every color is sampled from the
original forefin's existing linear palette. `structural-audit.json` checks finite
vertices, closure, consistent orientation, positive volume, area, exact root corner
and pivot retention, root/boundary-point winding containment in the actual V71 body, and
floor contact. It does not establish self-intersection absence or animation quality.

## Integration risk

Transform is identity. Skinning is intentionally the existing rigid forefin-bone
assignment, with unchanged bone definitions. Shortening the footprint changes the
support polygon and swing/contact behavior even with identical pivots. A later
runtime bind must be revalidated during breathing, brace, release, attack, hit,
death, stepping and turns; static root containment cannot establish those results.
Do not replace tested runtime without independent full-body visual review and real
motion validation. No resemblance score or acceptance is claimed here.

## First failure retained

The first mapping used equal root-angle increments against unequally spaced fan
outline vertices. Its actual full-body renders revealed accordion-like grooves.
`build_failed_first_fins.py` reconstructs that failed construction into the
explicit `failed-first-*` indexed and native meshes. No original source/native hash
was captured before correction, so byte-identical restoration is unverified.
Its six original raw captures remain
in the initial ignored capture directory; they are failed evidence, not the active
candidate. The corrected source aligns angular rays, inserts both polygon corner
sets, and keeps the shoulder convex before introducing scallops at the edge.
