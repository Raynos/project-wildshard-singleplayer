> Historical transport result, superseded for closure by PACKED-SEAM-REPAIR.md. Independent review found a packed seam defect; the old outputs remain in failed-packed-seam. Read the newer repair and final receipt for the current state.

# Final source-only result

2026-10-20 21:22 UTC. Read alongside REPORT.md, which intentionally preserves
its earlier checkpoint state and pending-test wording.

## Completed

- Complete editable generator, 7,194-corner native model, fifteen bind joints,
  eight explicitly rigid anatomical owners, actual closed hinge/sole surfaces,
  six-channel packed transport, eight-part 333-point exact source recipe, and
  coordinate/ownership/foot contracts are retained.
- Eight Python tests pass. Actual existing packedCreatureBodies consumption,
  every f32/u16 attribute comparison, actual THREE all-weight skin against each
  owner at independent diagnostic transforms, and strict recipe refusals pass:
  three Vitest tests. Focused project-strict TypeScript compilation passes.
- No source triangle, normal or payload changed after the first protected source
  checkpoint. The only generated-data correction was metadata.file, now the
  content-addressed logical /assets/ identifier the existing consumer requires.
  Tests inject the local payload loader; no public asset was written or fetched.
- The failed metadata identifier and its exact generator, metadata, freeze and
  checkpoint remain in failed-metadata-identifier. The earlier arithmetic source
  attempt remains intact in first-build-arithmetic-witness. Original selected
  source and all selected-complete-motion input hashes still pass.

## Quantified source changes

Unaffected 5,802 corners preserve source positions, colors and normals exactly
under B. The two continuous hinges retain their entire exterior surface area,
partitioned anatomically and capped. Across hinge and sole construction there
are 120 new cap triangles. Sole clipping removes precisely the documented
sub-plane source pieces: approximately 0.000012065126404223365 m³ on the left,
0.00000950105787426124 m³ on the right (signed closed-mesh volume differences).
These are real geometry/silhouette edits. Both retained soles have actual flat
support faces at y=0, with no root lift and no below-plane bind vertex.

## Limits and next gate

This is NOT full source/anatomy, motion, live-collider or gameplay admission.
The source could be built honestly as eight closed rigid owners without dropping
inconvenient hinge surfaces, but no accepted bend/pose/recovery envelope exists.
Cap/armor interference, knee/ankle seams under rotation, the fixed upper assembly,
weapon elbow loss, broad shield obstacle envelope and independent likeness need
review. Diagnostic articulation in a skin test is not authored motion.

No authored foot motion, animation clip, physics world, Rapier hull construction,
actual contact sweep, app build, runtime integration, capture or quality score was
produced. Normalized living dimensions are diagnostic region measurements only;
coverage and fixed/render complete contact remain open. Root/owner API work is
separate. No changed hull caps, collider padding, fitting loop or source exemption.

The repository lint configuration excludes art/. Its lint invocation reports
“No files found”; this is NOT a green lint receipt. Strict compilation and focused
Python/Vitest results above are the completed code checks. No broad suite ran.

## Reproduction

python art/driftwood-isle/approved-conch/articulated-source-candidate1/generate.py

python art/driftwood-isle/approved-conch/articulated-source-candidate1/test_source.py

node_modules/.bin/vitest run --config art/driftwood-isle/approved-conch/articulated-source-candidate1/vitest.config.ts art/driftwood-isle/approved-conch/articulated-source-candidate1/native.test.ts

node_modules/.bin/tsc --noEmit -p art/driftwood-isle/approved-conch/articulated-source-candidate1/tsconfig.json

No Git, shared State, engine or public paths were modified by this source lane.
