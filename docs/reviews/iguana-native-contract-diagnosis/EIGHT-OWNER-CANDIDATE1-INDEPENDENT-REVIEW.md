# Eight-owner Iguana candidate 1: independent source review

2026-10-20. **Rejected before physics.** Read-only examination of the frozen eight-owner-candidate1; only this review file is authored. No schema/source edit, build, physics allocation/trial, promotion, Git operation or public write.

## Verified findings

The candidate retains the selected bind sculpture and fits the existing corpse point budget. It nevertheless has two distinct blockers: a strict packed-format omission, and a demonstrated live-hit coverage failure. Fixing the first would not resolve the second. No generic live-shape expansion is designed or justified by these checks.

Input identity: candidate checkpoint frozenAtUtc is 2026-10-20T19:49:40Z. Independently verified all 16 checkpoint-listed file lengths and SHA-256 hashes. Key hashes:

- native-source.json: c316577eccf55f89fbceca39f6af722e742bbbda63918d6fc03bccabf113c142
- metadata.json: eeb6d8c0b3842e261ec6e0bdc3ab07b02fa57f6538f959d6c87a31e33ae0063e
- payload.bin: 88abdc1c335ddf06a93afe2c4cda6a77c1304286d3cb4a8928d80e3cce5b747c
- live-source-witness.json: 4d0a187ee58186f2c14b64130a265aa1df66edf3440dc289af53363cbcfd90cb

### Bind anatomy and ownership

Direct array comparison against complete-character-next confirms equal ordered part names, all 11,610 corner positions, linear colors and fur channels. Independently inflated both payloads, walked the attribute blocks and compared every position/color/fur byte: equal, with each payload occupying 603,720 inflated bytes. Skin indices/weights are intentionally different. Each complete candidate part has one consistent owner, with weights [1,0,0,0]; consequently every triangle has one owner. Bind anatomy preservation does not preserve the original motion, original rig or weighted deformation. The document correctly discloses loss of independent jaw/neck movement, petal flutter and tail flex.

Recomputed convex hulls directly from candidate packed-float32 source positions, transformed by their owner bind translations. Extreme-point counts independently match the recipe:

body 79; head 72; bloom0 44; tail0 46; legFL 55; legFR 54; legBL 54; legBR 53. Total **457**.

Every recipe extreme matches an actual component source point within 1e-12 m. All component points are inside their recipe hull to numerical precision; maximum signed face excess is 4.440892098500626e-16 m. All counts fit existing limits. This is a conditional rigid-component support result, not runtime floor-contact acceptance. No Rapier hull was allocated.

### Actual strict format rejection

Inspected src/game/plugin/geometry.ts:1311–1374 and src/format/rigidCorpse.ts. PackedBody.dims is strict and omits bodyAt, bodyPitch, headAt and fore. AnimalDims in src/engine/entities/species/registry.ts already types those fields, and AnimalView implements their local-axis/owner semantics, so the omission is a real transport/format mismatch, not evidence that those basic facilities are absent from the engine.

For an independent read-only execution, extracted the current packedCreatureBodies function verbatim, erased TypeScript types with Node's built-in stripTypeScriptTypes, and evaluated it with the actual valibot package and actual rigidCorpse schema source. Passed the unchanged candidate metadata and a load callback instrumented only to detect invocation. Result:

    Invalid key: Expected never but received "bodyAt"
    load callback invoked: false

This reproduces the real function's synchronous rejection without importing the entire runtime module, creating a body or modifying its validation. It corroborates the retained full-module test record; it is not a second full-module integration test. An initial attempt to use an uninstalled esbuild package failed before execution; no package was installed, and the built-in erasure route completed successfully.

The retained candidate tests were not rerun because their expected-rejection test writes admission-rejection.json. The frozen candidate was left untouched. No fields were stripped to force acceptance and no alternate consumer route was used.

### Independent authored-idle live failure

Read clips.ts directly: at t=0, speed=0, flinch=0, deathT=-1 and strike phase=0, all authored rotations are zero; leg position channels equal their parent-local bind values. Thus this is an actual authored bind-pose input, not an invented pose. This review verifies that fact by expression inspection, not by claiming a new numeric-program integration run.

Independently computed segment projections and sphere distances using Python arithmetic from candidate dimensions/bind positions, rounding mesh coordinates to packed float32. Reproduced **6,132 outside corners** and **1,771 single-shape-certified triangles out of 3,870**. The uncertified triangles are not all individually proved outside merely by absence of that certificate, but the outside corners are direct counterexamples.

Worst witness: tail triangle 120, corner 362, position (1.623482346534729, 1.8307499885559082, -1.40488862991333). Its outside margins are:

- body capsule: 1.3503159654574999 m
- head sphere: 1.8399297531809142 m
- flower-owned fore capsule: 2.505224790938939 m

These match the retained witness. One authored-pose miss refutes full-pose live coverage for this exact descriptor. This is independent of packed decoding and does not demonstrate anything about corpse penetration or physics solver quality.

## What is necessary next, and what is not established

A bounded typed source-format addition could transport the four facilities the engine already has. For this exact descriptor it is necessary to get past the observed parser boundary, but it is not sufficient for admission. A sound addition would require strict finite tuple/scalar validation, valid named-bone references and appropriate dimension semantics, owned nested copies for repeated spawns, round-trip tests and malformed-input rejection. It must not become an unknown-fields passthrough. This review neither implements nor approves that change.

The second blocker is deeper than serialization for this candidate: its three living volumes belong to torso, cranio-cervical assembly and flower. They supply no corresponding independent tail/paw shapes. AnimalView exposes only bodyCapsule, headWorld and optional foreCapsule here; AnimalManager's ray-hit route reads those facilities, not rigidCorpse. Adding fields to PackedBody.dims cannot create missing collision owners or make the demonstrated tail point enter an unchanged volume.

However, this is not a proof that every anatomically honest descriptor under the current API fails. Independent owner count is not itself a mathematical lower bound on coverage: geometry may overlap another owner's shape if that relationship holds throughout motion. Conversely, a huge enclosing shape or an unexplained cross-owner envelope would not be an acceptable proof. No alternative descriptor or full-pose analytic partition has been established here, and no claimed generic fix has implementation/behavior evidence.

Recommended next decision: treat the format gap as a bounded compatibility item, while first resolving the specific live-anatomy representation at design level. Keep all tail and limb tissue in scope; do not waive it. Either demonstrate one anatomically justified, same-scope live descriptor/ownership contract covering the preserved candidate over authored poses, or state the exact unsupported requirement and the specific source/motion concession needed. Only if that requirement demonstrably cannot be represented should a separately scoped capability design be considered. Do not assume more shapes, a higher cap, another physics architecture, padding or a root lift is authorized or necessary.

## Stop and freeze

Candidate remains stopped before physics and app admission. The 457-point corpse result, preservation checks and strict expected rejection are useful evidence, not approval. No contact trial, source/packed runtime parity, fixed/render lifecycle integration, animation-quality or visual-acceptance result was produced in this review.

This is a frozen standalone review of the checkpoint above. It does not change the candidate's files or earlier reviews. Subsequent findings should identify a different checkpoint or a separate review rather than silently revising this record.
