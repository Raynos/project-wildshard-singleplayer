# Splinter Mantis: complete sculpted anatomy

Unreviewed static sibling, 2026-10-20. The retained `complete-integrated-next`
remains selected until an independent paired review. No self-score, model/runtime
promotion, animation claim, or changes to gameplay, physics or public candidate7.

## Authority and complete-character intent

Inspected the original lossless approved hero, original Explorer nine-angle sheet,
corrected World nine-angle sheet, and all ten actual integrated-next model views
before editing. The original standing figure controls identity. Generated hidden
surfaces are approximate guides, not an exact topology or leaf-count requirement.
The original World sheet is preserved and pinned alongside the corrected one.

This is a single coherent complete-source pass addressing the prior independent
review, not an arm-only patch or iterative parameter fit:

- Smaller almond eye lenses sit inside newly authored dark orbit volumes. A
  stronger brow, cheek and compact lower mask are constructed as one head family.
- Four overlapping sternal bark wedges and broader wrapping thorax plates break
  up the plain pale throat. A continuous waist taper and narrower asymmetric
  abdominal segments link the rising torso to the four hip attachments.
- Six distinct thick leaf volumes form a long/medium/short fan. The new shorter
  leaves attach to the existing lower wing bones; ribs stay subordinate. All
  geometry exists around the full model, not only the hero camera.
- Both wood sickles and their contiguous ivory edges share a single anatomical
  rotation about their unchanged hook pivots, giving the cutting faces depth in
  profile without floating teeth or a camera trick.
- Walking femur and shin sections taper coherently and carry smaller integrated
  leaf armor. Existing four ground contacts, foot geometry and all pivots remain.
- Broad flat wood/leaf facets and the retained warm/green/cream palette remain.

## Editable source and exact native contract

`build_mantis_complete.py` is the self-contained editable Blender producer.
`prepare_source.py` records the one-time derivation from the frozen selected source;
it is not required to rebuild. The mesh JSON contains the same complete authored
triangles as the GLB. No external model generator, texture, network or Mac is used.

There are 100 source objects and 3,388 triangles. Native preparation uses the exact
retained 22 bones, names, order, parents and rest positions. Existing part ownership
is unchanged; the ten new shells have explicit ownership in
`prepare_native_mapping.py` and `authored-mapping.json`. There is no new bone,
root lift, animation/callback change, physics exemption or collider change.

Before rendering, source topology/export/normal checks, all-object intersection
checks, 7 Python export tests and 4 real packed-consumer/GLTFLoader/THREE skin tests
passed. These prove geometry and rest/ownership parity, not native visual response,
reliable contact, motion quality, combat readability or likeness acceptance.
Intentional shell overlaps are counted, not excused as safe motion.

## Reproduction and evidence

From repository root, set HOME to `$PWD/tmp/home` and WS_HEAVY_ROOT to
`$PWD/tmp/heavy-lanes` for Blender jobs, then:

1. Run the producer via `python3 scripts/heavy-lane.py build -- blender -b -t 2
   --python-exit-code 1 -P <this-folder>/build_mantis_complete.py -- --out <this-folder>`.
2. Run `check_geometry.py`, `check_intersections.py`, `prepare_native_mapping.py`,
   `check_scope.py`, `export_native.py` and `test_export_native.py` in this folder.
3. Run the named `native-consumer.test.ts` using this folder's Vitest config.
   The filename is required by the repository's focused-test lane guard.
4. Run `render_matched.py` under the same Blender build lane, then
   `assemble_evidence.py` and `verify_delivery.py` with Python.

Matched baseline is the actual retained `complete-integrated-next`, freshly rebuilt
and checked against its frozen mesh/metrics/GLB. The candidate is likewise rebuilt
and checked, never substituted by a concept image. Candidate and baseline share
identical cameras, lighting and render settings for hero plus all nine views.
One common union-bounds scale frames the nine views; hero has its own common pair
scale. Projected bounds verify every vertex is fully inside every 638×900 portrait.

Immutable full-resolution raw PNGs are under
`tmp/mantis-complete-sculpted-anatomy/{baseline,candidate}/`. Labelled compact WebP
previews and boards are convenience derivatives, not independent scoring inputs.
The raw original frames remain retained for native Site protection by the parent.
No Site edits or external publication are part of this pass.

`input-pins.json`, `scope-audit.json`, `geometry-audit.json`, `normal-audit.json`,
`intersection-audit.json`, `closure.json`, `capture-provenance.json`, `evidence.json`
and `final-verification.json` record exact evidence and limitations. Logs are kept
in the same scoped ignored raw directory; no prior source or failed study changed.
