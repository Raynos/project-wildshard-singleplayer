# Approved Brine Puffer: sculpted source study

Status: two rendered revisions failed the approved target. A third clay source is
unexecuted. No model acceptance and no runtime replacement.
The owner approved the concept image on 2026-10-18. This does not approve generated meshes.

## Visual target

Reference: `../concepts/2026-10-18/brine-puffer-explorer-gameplay.webp`.
Use its large Explorer specimen for proportions; gameplay panel for inflated throat.
The tiny side/back views constrain the tail, back coverage and compact stance.

- Continuous compressed body with an arching back, not a sphere with attached decorations.
- Layered irregular teal armor plates following anatomical rows, dark overlap seams,
  restrained ochre chipped edges and coral eye-socket skin.
- Deep amber eyes under heavy inward-sloping ochre brows; hooked cream beak and dark gape.
- Large cream throat pouch with organic longitudinal folds radiating from the mouth.
- Four splayed articulated fin feet: wide web membranes, teal upper paint, ochre edges,
  ivory points. Small fan tail, substantially narrower than the whole body.
- Deliberate asymmetric ivory dorsal spines in a hierarchy of large and small forms.
- Faceting must describe sculpted planes, not random triangle noise.

## Source approach

`build_puffer.py` constructs mesh surfaces directly from anatomical cross sections,
curved armor patches, pleated throat topology and ribbed membranes. No primitive
body assembly. All color is explicit mesh corner paint, preserved by glTF export.
Closed custom rings are permitted for eyes and organic joint masses; no sphere operators.
The script is the editable source; heavy renders, `.blend`, GLB and mesh JSON go only
under repo `tmp/approved-puffer/`. No previous model or runtime file is overwritten.

Rig names retain body, belly, head, tail, finL and finR; rear fin joints are explicit.
The new rest dimensions/pivots require corresponding pose rest-offset changes before
integration. Export both glTF and a native mesh payload, so the existing AnimalSpecies
skin/vertex-color pipeline remains available without runtime Blender dependencies.

## Review and admission

Render front, side, back and three-quarter under the same neutral light; compare the
three-quarter silhouette/face/throat/feet directly against the approved specimen.
A successful source build is not visual acceptance. Require honest discrepancy notes,
then actual Model Explorer and first-person arena proof before completion claims.
No default runtime wiring, production deployment, cap changes, or old-asset deletion.
Raw asset cap remains 1,000,000 bytes; each preview 250,000; board 500,000.

GLB conversion note: Blender +Y-forward exports to glTF -Z-forward. The native
mesh payload explicitly converts to game +Z-forward and reverses triangle winding.
The first glTF validation has zero errors and one standard Blender hierarchy warning
(`NODE_SKINNED_MESH_NON_ROOT`); rig/object parent transforms are identity.

## Revision review, 2026-10-18

- `build_puffer.py`: FAILED. Real front, side, back and concept-angle renders show
  a spherical torso, detached-looking eyes/brows, mechanical throat folds and
  thin fin hands. Geometry/skin validation passes do not imply visual quality.
  Evidence: [failed detailed comparison](failed-study-comparison-board.webp).
- `build_puffer_clay_v2.py`: FAILED. Crest and foot volumes changed, but the eyes
  remain protruding, brow anatomy is weak, the throat reads as a separate jaw
  pad, and the camera clips outer feet.
  Evidence: [failed clay render](failed-clay-v2.webp).
- `build_puffer_clay_v3.py`: UNEXECUTED. Source-only correction integrates the
  jaw/throat into the torso surface, strengthens continuous orbital ridges and
  broad irregular folds, and widens framing. No rendered result or acceptance.

Both failures are preserved. No painting or plate detail will be added to the
new clay pass before silhouette/face review. Neither failed GLB is a shipping
asset. All raw heavy outputs remain in the ignored task directory.
