# Colossus V3: interlocking root anatomy

Unaccepted static study, 19 October 2026. V1 and V2 sources remain unchanged.
The owner's current milestone is an independent complete-model likeness score
strictly above 3.5/5; no source change or favorable hero render establishes it.

## Consequential revision

- Replace horizontal-section beam construction with locally perpendicular,
  asymmetric swept root sections and controlled bark-ridge twist. Broad facets
  remain deliberate; no random vertex noise.
- Recompose chest as staggered, overlapping load roots and inward rib tips
  around an exposed turquoise heart. Carry these roots through a crooked waist
  and across a deep woven back; avoid a regular ring or blank V-shaped panel.
- Split shoulders, upper arms, forearms and calves into connected crossing root
  flows. One forearm root continues directly into an outer claw; three varied
  curved digits and an opposed thumb retain real grip gaps.
- Replace the short owl mask/beak with a long tapered bark-mask volume, narrow
  cyan eyes in dark closed inlays, and cheek roots flowing into the crown.
- Vary antler forks in fore-aft depth and height. Rebuild foliage as angular
  canopy patches with thick hanging leaves, wrapping front, side and rear root
  overlaps instead of repeating spheres along the shoulders.
- Embed three differently oriented stone wedges into each grounded foot and
  additional knee stones. Diagonal calf roots carry into the feet rather than
  a continuous stone shoe rim.

## Reproduction and evidence

Generator: `build_colossus_v3.py`.
Fixed camera renderer: `render_colossus_v3_nine.py`.
Source snapshot: `v3-source-closure.json`.

The hero uses V2's original camera and neutral light setup. The fixed nine use
V2's unchanged world lighting, camera directions, full-bounds framing formula,
resolution and sample settings. Actual bounds are recomputed from V3 geometry;
no cropped comparison or camera-specific geometry is used.

The approved original is
`../concepts/lowpoly-revision-2026-10-18/tide-root-colossus-lowpoly.webp`.
Hidden top/rear anatomy is interpreted, not asserted as exact reference truth.

## Actual preflight and bounded repair

The first V3 hero and fixed nine completed with terminal exit 0. A subsequent
read-only export audit found one omitted top triangle on the bark mask (three
boundary edges and a nonpositive signed volume on that open component). Its
source and complete captures remain frozen; see `v3-original-capture-receipt.json`.
The initial actual views also showed that several foliage patches were seated
inside the new thicker roots and mostly hidden from the front.

The bounded repair is `build_colossus_v3_repair.py`, with
`render_colossus_v3_repair_nine.py` and `v3-repair-source-closure.json`. It closes
that single mask cap and reseats existing growth patches onto exposed shoulder,
elbow, hip, shin and rib surfaces. It does not rewrite the whole model or lighting.

Repair export preflight passed: 4,032 triangles, 195 mesh objects, 651 material
primitives; finite attribute/index checks; zero boundary edges, nonmanifold edges,
winding conflicts, zero-area triangles or nonpositive-volume components after
position welding at 1e-6. This checks each component separately and does not
assert absence of intersections between the intentionally overlapping roots.
The large material-primitive count needs separate native batching before admission.

The repaired hero and all nine actual captures completed with terminal exit 0;
the author opened every image. Hero and nine exports are byte-identical. See
`v3-repair-capture-receipt.json`, labelled `v3-repair-*.webp` previews and
`tide-root-colossus-v3-repair.glb`. A fresh independent complete-model score
remains pending. No rig, animation, performance, phone, combat or
runtime-admission claim.
