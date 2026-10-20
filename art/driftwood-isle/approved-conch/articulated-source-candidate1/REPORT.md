# Conch articulated source candidate 1

Source-only editable milestone, 2026-10-20 21:17 UTC. Not runtime-admitted,
not visual/likeness accepted, and not an authored animation. No physics world,
app build, capture, engine edit or shared State edit was performed.

## Construction and exact changes

- Eight owners: fixed body/shell/head/eyes/whole shield assembly; whole
  shoulder-driven rapier arm; left/right thigh, shin and foot. Fifteen existing
  bind joints remain for sockets and hierarchy. Seven branches are explicitly
  fixed in contract.json, not independently animated. The shield envelope remains
  broad (6.6953966066 cubic metres); obstacle/anatomy acceptance is pending.
- All 5,802 unaffected corners retain exact ordered source positions, linear
  colors and normals after the explicit proper rotation B=Ry(pi). Material
  response remains native toon/flat, not a claim of Blender shader equivalence.
- Both original continuous leg hinges are split by their three original geometric
  rings, never by dominant weights. Ring interval [0,1] is thigh, [1,1.9] shin,
  [1.9,2] foot cuff. The knee seam is the existing knee ring; the ankle cuff seam
  is 90% along the original knee-to-ankle strip, placing it immediately proximal
  to the existing ankle. Every old exterior triangle's area is conserved across
  the three pieces. New opposite-facing triangulated fan caps close each exposed
  seam. New caps use the original coral hinge color and their geometric normals.
  No original leg exterior is discarded or enlarged to pad a collider.
- These closed mechanical seams expose actual cap surfaces when articulated.
  They do NOT establish a collision-free or attractive bend range: cap/armor
  overlap, seam opening and independent anatomy review remain explicit gates.
  There are no authored joint limits or accepted death/attack/gait poses yet.
- Original closed feet/toes are intersected with y>=0 and actual new planar sole
  caps replace the portions below the plane. This is an intentional geometry and
  silhouette change, not a root lift. Original foot minima were -7.553771 mm and
  -9.531468 mm. Retained above-plane surfaces/colors/normals are unchanged except
  splitting at the new boundary; new sole caps have geometric normals. All source
  meshes are accounted for in construction.json, including source minima and
  retained/new triangle counts. No source file is overwritten.
- B is applied to vertices, normals, every absolute bind pivot, foot polygons and
  derived bone-local recipe. Local rotations must be conjugated B R B^-1.
  Root render offset is zero. Source Left now lies at actor negative X; source
  labels are retained explicitly, not mislabeled actor +X. Rapier is actor +X.
- Recipe uses the exact float32 rendered-source convex extremes: 333 points,
  eight owners, largest hull 70. No synthetic support points, hull padding,
  geometry simplification, cap increase or whole-character hull.
- Native dimensions are recomputed from body/head regions, excluding the weapon,
  shell and shield from torso radius. They are DIAGNOSTIC ONLY: living coverage,
  motor, obstacle, complete contact/recovery and gameplay admission remain false.

## Preservation and failures

Original selected source and selected-complete-motion are hash-pinned and unchanged.
The complete first generated attempt is retained in first-build-arithmetic-witness,
including its generator, native JSON, compressed payload, recipe, contract and
failing-test source. failure.json records two exact witnesses: a -8.67e-19 metre
plane-interpolation residual, and unnecessary original-normal renormalization.
The current source enforces the exact authored cut-plane equation for newly cut
vertices and retains original normals exactly. This is arithmetic/source fidelity
repair, not contact tolerance relaxation or a parameter-fitting loop.

## Tests at checkpoint

Eight focused Python tests PASS: frozen input/reproducibility, rigid native
structure, exact unaffected geometry/material/normal provenance, original hinge
surface conservation and closed consistently oriented seams, bind-plane soles,
complete float32/u16 packing roundtrip, all-point hull containment/directional
support, and basis/FK/skin commutation at nonzero yaw and multiple scales.

Actual existing native-consumer/THREE skin/schema tests are written but PENDING
at this checkpoint. Initial Vitest launch was refused because its command omitted
an explicit file filter; no test body ran. The focused filtered invocation is the
next read-only check. No Rapier/world construction or runtime tests are claimed.

## Editable deliverables

Run generate.py with Python, NumPy and SciPy to reproduce all primary outputs.
It refuses nonidentical output overwrite. model.json is ordinary complete native
source, not encoded binary. metadata.json/payload.bin use the existing six-channel
packed native layout. recipe.json, contract.json and construction.json carry all
source topology, ownership, coordinate and material changes. freeze.json pins
inputs/outputs. checkpoint-manifest.json pins this complete milestone.

Next work is independent source/anatomy review, explicit safe articulation range,
then authoritative foot-contact authoring against unchanged actual Arena inputs.
Neither this freeze nor the eight tests authorizes an app build or promotion.
