# Independent review: bounded packed live-dimension compatibility

2026-10-20. **No must-fix identified in the reviewed compatibility patch.** This verdict is limited to transporting existing AnimalDims capabilities. It does not admit the Iguana or resolve its failed live coverage. Root owns publication; no Git operation occurred here.

## Reviewed implementation

Read the current packedCreatureBodies implementation in src/game/plugin/geometry.ts, AnimalDims in src/engine/entities/species/registry.ts, actual capsuleOn/headWorld/bodyCapsule/foreCapsule and bone selection in AnimalView.ts, the AnimalManager ray-hit consumer, the new regression test, and the separate current-parser candidate test/report.

The addition is appropriately bounded:

- bodyAt/headAt are strict finite three-number tuples; bodyPitch is finite. Explicit undefined/null and extra tuple entries fail rather than being silently removed.
- fore is a strict object. Its name must be nonempty and resolve to exactly one bone. Its at tuple is strict/finite, halfLen is finite and nonnegative, and radius is finite and positive. Zero half-length is a valid sphere-degenerate capsule.
- New body offsets/pitch require a unique body bone and default/Z axis. Rejecting them for a Y-axis capsule matches AnimalView, which otherwise ignores those fields on its upright path. headAt requires a unique head bone. Existing absence is preserved, not replaced by invented values.
- The outer dimensions object remains strict; no arbitrary passthrough, callback, additional shape list or cap increase is introduced.
- Every copy creates new bodyAt/headAt arrays, a new fore object and a new fore.at array. Scalar/string fields need no deep copy. Valibot parsing also detaches the nested input used here; the regression test verifies mutation of the original caller data cannot affect subsequent copies.

The finite-only policy on offset/pitch values matches their existing mathematical meaning. This patch is not an anatomy-bound validator, a generic skeleton validator, or an attempt to revise legacy scalar dimension validation. It should not be described as proving reasonable geometric extents or all possible runtime transforms.

## Actual runtime semantics

AnimalView applies each centre through its owning bone matrix. bodyPitch rotates the body's local Z direction toward local +Y; fore uses its named bone's local X direction with zero pitch. Matrix columns carry actor scale once into segment length; headAt is a point transformed by the head matrix. The constructor selects fore.bone directly. The patch transports exactly these values without changing axes, units, owners or their semantics.

Independently extracted the actual capsuleOn function, erased TypeScript annotations with Node's built-in erasure, and compared its endpoints against direct local-point transforms under translation, three-axis rotation and uniform scale 1.7. Tested pitched Z, unpitched Z and fore X. Maximum endpoint discrepancy was 6.280369834735101e-16 m. This is a helper arithmetic check, not an AnimalView lifecycle integration test.

AnimalManager consumes body/head/fore hit facilities; rigidCorpse remains separate. Transporting the four fields does not create independent tail/paw hit shapes. Existing broad-phase/raycast behavior was not redesigned or proven complete for arbitrary offsets by this patch or this review.

## Independent executed checks

- node_modules/.bin/vitest run test/packed-creature-live-dimensions.test.ts: **4/4 pass**. Covers serialization roundtrip, caller/spawn isolation, omission, valid zeros, malformed finite/name/shape input, unknown fields, missing/duplicate owners and ignored upright-field rejection.
- node_modules/.bin/vitest run docs/reviews/packed-creature-live-dimensions/candidate.test.ts --config docs/reviews/packed-creature-live-dimensions/vitest.config.ts: **1/1 pass**. Uses the real imported packedCreatureBodies, unchanged pinned candidate metadata/payload, preloading and two copies. Confirms eight bones, sixteen parts and 457 recipe points without constructing a physics world.
- Independently rechecked all sixteen files in the candidate's frozen manifest after the tests; all hashes and lengths remain unchanged.

The writer reports four existing packed-body regression tests and type-aware lint pass. Those results are attributed to the writer, not independently rerun here. Its whole-root typecheck was killed with exit 137, and its narrowed strict typecheck was still in progress when this review was authored. No whole-repository typecheck/build/gate pass is claimed. Root should use the writer's final exact result and normal applicable gates, not substitute this review for them.

## Candidate status and historical evidence

The separate current-parser test/report is the correct way to supersede the old parser observation without rewriting frozen evidence. The historical candidate test expected bodyAt rejection under its earlier consumer; that expected failure is now obsolete for current code, not evidence that the original recorded outcome was false. It must not be run to overwrite its frozen admission-rejection record.

The change fixes only transport. The previously independently reproduced 6,132 uncovered corners and worst tail outside margin of 1.3503159654574999 m remain applicable: no source anatomy, animation or descriptor changed. No physical-contact, animation-quality, lifecycle, visual or gameplay acceptance follows from these five passing tests. No source exemption, padding, root lift or broader engine design is endorsed.

## Frozen review identity

This review applies to the following exact implementation/test bytes:

- src/game/plugin/geometry.ts: 98fe65663989e94c0418598276e42cf9fd97d618c670fd4d05ce86db7e62ec65
- test/packed-creature-live-dimensions.test.ts: de42baca4a8b1ce4730761e4c5b37513251a06d57d85d8cdec224e1f8dbd5ba9
- docs/reviews/packed-creature-live-dimensions/candidate.test.ts: 0ed4e1e62fde8eb6d1da102f7ca7fb2ea0aefb653047a5097098aa49c6273ee4
- docs/reviews/packed-creature-live-dimensions/vitest.config.ts: 5b69f358d4a8df275d55dae3680ea456a30b3a60652d2417298d1818f48a8058

Only this separate review document was authored. No production/source edits, physics, app build, publication or Git action were performed by this reviewer. Later implementation changes require a new review identity rather than silently extending this verdict.
