# Splinter Mantis: integrated complete anatomy

Unreviewed source candidate, 2026-10-19. No score, selected-source replacement,
public candidate change, native animation acceptance, or promotion.

## Intent and reference

The original large standing figure in
`art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/splinter-mantis-lowpoly.webp`
is authoritative. Both original approved nine-angle contexts were inspected;
`scope-audit.json` pins the original PNG bytes. Their AI-generated hidden angles
are approximate supporting guidance, not exact orthographic anatomy.

The comparator is the actual retained `complete-proportion-study` source.
Its separate historical 3.915 and newer paired 3.555 reviews disagree; neither
number transfers to this candidate. The rejected `complete-character-pass`
remains intact. Public candidate 7 and all runtime/app/arena sources are untouched.

This is one complete anatomical correction, rather than a gait or solver study:
- Compact angular rising chest and layered broad wooden plates, preserving a
  forward head transition without the prior long horizontal cervical arch.
- Raised but long descending tapered face, modest convex compound-eye facets,
  integrated cheeks/brows and swept crown splinters. No short broad mask.
- Folded angular raptor arms, thicker three-dimensional blade sections, and a
  longer irregular pale-tooth rhythm along each complete cutting edge.
- Peaked tapered abdomen with four overlapping tergites and a sharpened tail.
- Four differently proportioned folded leaves, staggered broad facets and thinner
  embedded ribs; bent twig antennae with wider terminal leaves.
- Integrated walking limb planes and brighter honey/cut-wood/leaf palette.
- Explicit flat source triangles, retained identically in GLB and native export.

## Editable deliverables

`build_mantis_complete.py` is the complete Blender producer; no external models,
textures, generators or hidden geometry dependencies. `prepare_source.py` records
the derivation from the frozen predecessor but is unnecessary to rebuild.
`mantis-mesh-complete-integrated-next.json` is the editable source mesh data.
`mantis-study-complete-integrated-next.glb` is the full model export.

`prepare_native_mapping.py`, `authored-mapping.json`, and `export_native.py`
produce candidate-specific `mantis-native.json`, `payload.bin` and `metadata.json`.
The explicit 22-bone rigid rest map includes neck and abdomen ownership. It is
integration preparation, not a compatible animation or contact tuning claim.
The existing packed-body consumer is exercised without any engine exemption.
Conservative diagnostic dimensions are not gameplay hit volumes.

## Reproduction and evidence

Run from repository root, with HOME=`$PWD/tmp/home` and
WS_HEAVY_ROOT=`$PWD/tmp/heavy-lanes`:

1. `python3 scripts/heavy-lane.py build -- blender -b -t 2 --python-exit-code 1 -P art/driftwood-isle/lowpoly-mantis/complete-integrated-next/build_mantis_complete.py -- --out art/driftwood-isle/lowpoly-mantis/complete-integrated-next`
2. Run `check_geometry.py`, `check_intersections.py`, `check_scope.py` here.
3. Run `prepare_native_mapping.py`, `export_native.py`, `test_export_native.py` here.
4. Run the explicit `native-consumer.test.ts` through this folder's Vitest config.
5. Run `render_matched.py` under the same Blender/build lane, then
   `assemble_evidence.py` with Python/Pillow.

The matched renderer rebuilds each frozen source, verifies GLB semantics and
binary data plus exact mesh/metrics equality, and renders the real complete models.
Each pair shares real camera/lighting/sample settings. Hero is union-bounds framed;
all nine additional views use one common union-bounds orthographic scale.
Projected bounds test the full tail/antennae and every mesh vertex for clipping.
Raw PNGs live under `tmp/mantis-complete-integrated-next/{baseline,candidate}`;
labelled WebP images and boards are derivatives, never replacements for originals.

Geometry audits reject open/nonmanifold/degenerate parts, opposed normals, any
nonadjacent within-part intersection, or source/export correspondence mismatch.
Cross-object shell overlaps are explicitly counted; they are not safe-motion proof.
The first failed tergite frame's producer and audit are preserved under
`failed-tergite-frame/`; only this candidate's loft-frame continuity was repaired.

Independent review remains required. A technically valid full creature does not
earn likeness points. No in-game or phone-rendering claim is made.
