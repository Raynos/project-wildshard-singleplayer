# Splinter Mantis V4 — anatomical mass revision

Original approved reference: `../concepts/lowpoly-revision-2026-10-18/splinter-mantis-lowpoly.webp`.
No new target was generated. The approved concept governs likeness; hidden
anatomy is a modeler's interpretation. V1, V2 and V3 remain intact.

## Identity and construction

1. Long forward-sloping prothorax: thicker continuous neck plus five overlapping
   bark scales on each side and seated rear collars.
2. Four planted walking legs: broad tapered femurs, shaped tibiae, small tarsi,
   hip shields and green femoral leaves. Separate anatomical pivots remain.
3. Two raptorial limbs: shaped shoulder and forearm roots, continuous curved
   timber hooks and connected ivory serrated cutting edges.
4. Four volumetric leaf wings: bowed midribs, staggered bent edges and folded
   front/back surfaces. Broad authored planes, no random facet noise.
5. Triangular insect head: convex faceted compound eyes, reduced mandibles,
   swept brow horns and two bent leaf-tipped antennae.
6. Segmented abdomen: overlapping dorsal shells, lateral terminal splinters.

The source is `build_mantis_v4.py`, using Blender 4.3.2. Geometry is closed,
flat-shaded, with decoded-sRGB materials and no texture, painted card or
camera-facing silhouette mesh. X is lateral, -Y is forward and Z is up;
GLB exports Y-up. Scale is an art study, not an admitted runtime size.

## Reproduction

Coordinate the heavy lane before running Blender. From the repository root:

    blender -b -t 2 --python-exit-code 1 \
      -P art/driftwood-isle/lowpoly-mantis/build_mantis_v4.py \
      -- --out tmp/mantis-v4 --render --view front --samples 24 --height 1100

Canonical nine-view capture:

    blender -b -t 2 --python-exit-code 1 \
      -P art/driftwood-isle/lowpoly-mantis/render_mantis_v4_nine.py \
      -- --out tmp/mantis-v4-nine --samples 16 --height 700

The dedicated nine-view renderer uses four cardinal views, top and four elevated
cardinal diagonals. It automatically fits the full silhouette using one shared
orthographic scale and 10% margin. Exact camera transforms are recorded in its
output. The builder's optional `--view all` is a different full orbit; it is not
the canonical half-dome evidence. `review_board_v4.py` labels the actual pixels
and the original reference crop without repainting either.

## Checked and unchecked

Python syntax, actual Blender export and hero render passed. Mesh audit reports
2,010 triangles, 67 mesh parts, zero boundary edges, zero nonmanifold edges and
zero degenerate faces. Actual full silhouette fits, including both hook tips.
The first hero view visibly improves leg mass and leaf folding, but simplified
cranial planes and broad plain wing regions remain. No self-score is assigned.
Independent full-view likeness review remains pending; this is not accepted.

Outputs remain in ignored `tmp/mantis-v4` and `tmp/mantis-v4-nine` pending the
coordinator's storage/publication decision. Raw `.blend` and PNGs are not Git
assets. The GLB is an editable-source-derived study, not a shipped game model.

Rig binding, clips, anatomy under animation, draw-call optimization, Model
Explorer integration, arena behavior, phone performance and human fun are
untested. Geometry counts do not establish runtime admission or performance.
