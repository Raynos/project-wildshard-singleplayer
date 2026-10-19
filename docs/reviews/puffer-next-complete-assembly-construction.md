# Puffer next complete assembly: construction and evidence

2026-10-19. **One complete static candidate, unaccepted. No likeness score or
animation/readability score is assigned by the builder.** V70, runtime admission,
physics, selected closed anatomy, and every predecessor source remain unchanged.

## Result and honest visual concern

The guided pre-paint carrier has been repaired and substantially reassembled in
`art/driftwood-isle/puffer-complete-remaster/next-complete-assembly/`.
The complete candidate has seven parts, eight unchanged bind pivots, 3,424
triangles, a 1,379,944-byte native source and a 625,136-byte single-sided GLB.

The builder inspected the authoritative original, selected hero and every selected
nine-view image before construction, then the candidate hero and all nine actual
candidate views. The result should **not be described as a demonstrated improvement**:

- Top/elevated views reveal long channel-like crown planes. Bounded retessellation
  changed the old courses, but did not produce the intended irregular natural roof.
- Raised compact front fans read shoe-like, with longitudinal grooves and a blunt
  cream rim. The thicker shoulders did not resolve the concept's broad fan/toe masses.
- The pouch remains angular, particularly in both profiles. Whole-facet paint makes
  the cream/teal boundary visibly coarse in places.
- Eye, seated mouth, tail and full-body identity remain readable. That is preservation,
  not evidence of a >=4 score.

These are builder observations, not the requested independent rubric judgment.
Complete all-view independent judgment before deciding any next construction.
There is no extra tiny variant, second render candidate, or runtime promotion here.

## Explicit carrier and bounded surface arrangement

The editable starting pin is guided
`seated-mouth-diagnostic-native.json`, SHA-256
`030dbb8c40bf2507429b6017ad4c8d36a15eb5f5ca839c630e14189c51c8424b`.
The selected comparator remains closed-anatomy native SHA-256
`98c4855852fc77ef385b0998e98dc5bdbabf40bb32b815f598c9a922525e5006`.
All other required input pins are asserted by `build_candidate.py`.

`edited-carrier-indexed.json`, `carrier-controls.json`, and
`surface-ownership.json` preserve the explicit pre-paint carrier, original source
face correspondence, exact boundaries, authored controls and replacement topology.
Seven connected patches were replaced:

- Lower-left folded sheet: 26 source triangles to 12 boundary-constrained triangles
- Negative and positive orbital back walls: 16 to 14 each
- Crown: 43 to 31, with seven explicit irregular roof controls
- Negative and positive flanks: 47 to 27 and 50 to 32
- Central pouch patch: 23 to 29, with five explicit support controls

The repair does not reuse the selected source's numeric indices. The guided input
was redetected independently: its core had three proper self-crossings and six
coplanar wall overlaps. Repair uses ordered patch boundaries, constrained polygon
triangulation, explicit interior controls and local diagonal flips. No harmonic
solve, global remesh, voxel union, spherical bowl, or final painted-soup deformation.
All original carrier vertices remain fixed; replacement patches retain their exact
boundary coordinates. Separate spike seating/tip edits have their own explicit
original/final envelopes in `shoulder-controls.json`.

Front fins retain the compact source's complete roots, pivots and sole plane, with
raised/broadened shoulders and whole dorsal fan changes. Rear supports widen toward
the lower web. `whole-fin-controls.json` records exact final envelopes. All eight
spike roots are seated against the final carrier; dominant tip identity remains,
with two shoulder tips lengthened. The selected bordered tail is byte-for-byte
identical as a native part. Four inherited open inlays receive source-specific back
caps/walls; original exposed head positions remain exact.

## Semantic-paint failure and final tradeoff

The fine conditional planar partition attempt failed exact-edge closure and
float32 nonzero-area tests. It is retained as `failed_partition_paint.py` with
`failed-partition-receipt.json`. Its failed native SHA-256 is
`b63af117dc08fe505f7604c40fbdd16e6ca338b5f5e53ce609ad24bef80b3702`.
`reproduce_failed_partition.py` reconstructs that exact earlier prepaint state from
the recorded root-before/root-after controls, reproduces the failed native hash,
and removes only its own temporary copies. `failed-reproduction-receipt.json`
confirms exact reproduction. Frozen candidate files are never overwritten by it.

Final `paint_candidate.py` applies the same diagonal semantic fields to whole
carrier facets. This is an explicit tradeoff: **boundaries are quantized to the
carrier instead of exact new clipping planes**. Paint changes no position, area,
topology or bind array. Flat teal, ivory, orange and socket ownership is recorded
per carrier/source face. The two orange hood fields remain separate. No technical
pass is used as art credit for this compromise.

## Geometry and export evidence

`geometry-audit.json` checks the complete prepaint model and actual exported GLB
float32 positions. Postpaint geometry is proven exactly equal to prepaint by every
position array, so the complete geometric results apply to that stage as well.
Implemented gates pass at all three stages:

- Finite attributes, nonzero areas, oriented two-face edges and single-cycle
  component vertex links; every closed component has positive signed volume
- Zero within-component proper crossings, including shared-vertex crossings
- Zero within-component coplanar overlaps, nonincident vertex/face contacts or
  nonincident edge/edge contacts, using the disclosed fixed tolerances
- No outside-envelope edits; original exposed eye/palate/tongue/nostril colors and
  head positions exact; full tail payload and eight bind pivots exact
- Replacement orientations checked against each explicit carrier projection and
  directed boundary, rather than unrelated old/new face-index normal pairs
- GLB roundtrip: 46/46 checks, including actual position/color/skin arrays, eight
  pivots, inverse binds and single-sided material

Separate closed components intentionally intersect: 1,087 proper triangle-pair
crossings in native and 1,086 after float32 conversion. Every pair and contact is
listed. These involve body/attached fins, body/tail root, seated face layers,
spikes, tail stem/fan, and rear web/cream tips. **No whole-part welded-solid claim**
is made, and these counts are not hidden as self-crossing successes.
The head's closed components now have no welded-union point-contact vertex-link
failure. All complete-model contact rows remain available for independent review.

Eight spike cap containment checks in `geometry-audit.json`, plus tail and all four
fin cap checks in `attachment-cap-audit.json`, pass at native and float32: every
root sample is inside, and the complete triangulated cap has no hull proper crossing,
coplanar area, nonincident point/face or edge/edge contact. This is continuous cap
containment under the documented finite predicates, not exact-arithmetic proof or
an animation-sweep test. No epsilon was lowered to obtain a pass.

`preservation-audit.json` supplies region bounds, new control-to-source-sheet depth
comparisons and dependency pins. Core volume changes from 1.0598386217 to
1.0527636015, **-0.6676%**. Complete-model bounds change primarily with compact fins
and retained tail. The forward bound is 0.945 versus guided 0.9581455; no claim of
increased whole-body forward support is made. The 4,102-direction support-delta
range is -0.2876345 to +0.0623233 and is reported rather than hidden by six-axis bounds.

## Single matched capture and storage

Twenty actual Cycles renders: selected plus candidate, hero and nine fixed views
per model. Fixed 600x740 resolution, 24 samples, seed 0, AgX, no denoising, unchanged
three-area lights, 3.2 hero and 4.2 standard orthographic scales. Model visibility is
the only scene toggle. No saved blend. `render-freeze-receipt.json` and
`capture-receipt.json` record renderer/native hashes, cameras and exact raw hashes.

The initial renderer failed only while serializing the first selected hero receipt.
Its PNG was preserved unchanged and never rerendered. `render-recovery-receipt.json`
records the first renderer hash and raw PNG hash. The amended renderer resumes only
that exact preserved frame and renders the nineteen missing images. Per-frame
renderer provenance is recorded; no raw PNG was re-encoded.

Raw originals are retained in ignored `tmp/puffer-next-complete-assembly/`:
20 PNGs totaling **11,938,580 bytes**, within the allocated 24 MiB reservation.
Twenty full-frame labelled WebPs, two labelled portrait comparison boards and the
GLB total **1,613,596 binary bytes**, within the 7 MB allocation. Each preview is
<=250 KB; each board is <=500 KB. Boards are indices, not substitutes for the actual
full-frame review. `output-closure.json` inventories exact paths, sizes and hashes.

## Reproduction and disposition

Run, in order: `build_candidate.py`, `paint_candidate.py`, `export_glb.py`,
`audit_glb_roundtrip.py`, `audit_geometry.py`, `audit_attachment_caps.py`, and
`audit_preservation.py`. Render only through the existing coordinator-owned heavy
build lane and a fresh/resumable capture receipt. Do not overwrite these raw
originals for a future candidate.

Frozen native SHA-256:
`b48589944bf7b85b05b1ef612969095f5d73941576a4a78c915770922e9a2e20`.
Frozen GLB SHA-256:
`52f7ef179bdf47ebc8231d77fdb4e7b915b91066f310c8831c957fac3de9f49b`.

The coordinator owns checkpoint publication and independent judgment. No Git mutation/Sites,
Mac, runtime, physics, admission, global setting or existing source edits were made
by this construction worker. Owner acceptance, >=4 likeness, animation/readability,
combat, materials-in-runtime and physical-device behavior remain separate gates.
