# Packed creature live-dimension compatibility

2026-10-20. Bounded transport repair for capabilities already typed by AnimalDims
and implemented by AnimalView. This does not add a live shape, increase any
budget, change solver behavior, alter runtime pins or admit an asset.

## Change

Only src/game/plugin/geometry.ts production code is changed. packedCreatureBodies
now admits the existing optional fields bodyAt, bodyPitch, headAt and fore.

- Offsets are strict three-element finite tuples. Pitch is finite radians.
- fore is a strict object with one existing, unambiguous named bone, a finite
  three-element local centre, nonnegative half-length and positive radius.
  Zero half-length is retained as the sphere-degenerate capsule case.
- Missing fields stay omitted. Explicit undefined/null, malformed values and
  unknown keys fail before the load callback. No generic passthrough is added.
- bodyAt/bodyPitch require a unique body bone and a Z/default capsule, matching
  the existing runtime semantics. A Y capsule ignores these fields, so it is
  rejected rather than presenting false support. headAt requires a unique head
  bone. Existing metadata without the new optional fields retains its behavior.
- Each spawn owns fresh bodyAt/headAt arrays, fore object and fore.at array.
  Mutating author input after parsing, or one spawn afterward, cannot affect
  another copy. Geometry, feet and rigidCorpse copying retain their old behavior.

## Superseding the historical parser result, not the candidate verdict

Read the independent candidate review before implementation. The frozen
art/driftwood-isle/approved-bloomthroat-iguana/eight-owner-candidate1 directory is
unchanged, including its historical expected-rejection test and diagnostics.
Its checkpoint SHA-256 remains
8fcd56814b798757f662b3c3ff81209c0573137183d0b6ff613c3585f3760663.

That old test correctly records the pre-compatibility parser behavior. It is not
silently rewritten or rerun to overwrite its frozen rejection record. Running
it against this newer parser would intentionally fail its old rejection
expectation. The separate candidate.test.ts in this report directory verifies
the **current** parser accepts and copies those exact pinned metadata/payload
bytes, retaining eight bones, sixteen mesh parts and the 457-point recipe.
It checks selected pins before and after without writing the candidate.

The superseded claim is only “the current parser rejects bodyAt.” The original
historical rejection remains true for its source revision. The candidate's
live-source witness still reports 6,132 uncovered corners and the 1.350316 m
worst tail margin. No source, animation, live shape or anatomy changed here.
Parser compatibility is not full authored-pose support, physical contact,
visual quality, animation quality, lifecycle admission or gameplay acceptance.
No physics world, contact trial or application build was run.

## Verification

- test/packed-creature-bodies.test.ts: four existing regression tests pass.
- test/packed-creature-live-dimensions.test.ts: four new tests pass, covering
  JSON roundtrip, strict malformed input, caller/spawn isolation, omission,
  valid zero half-length/pitch, named-bone uniqueness and upright rejection.
- Separate current-schema candidate test: one passes using unchanged pinned
  historical metadata and payload through the real packedCreatureBodies.
- Type-aware oxlint passes on production geometry.ts and the new regression test.
- Focused strict typecheck passes under the root project compiler options.
  tsconfig.json adds no exclusions or option relaxations; its bounded entrypoints
  include the modified production file, new tests/config and the project's
  existing ambient definitions. Initial missing-ambient attempts are retained
  in focused-typecheck-first.log and focused-typecheck-second.log. The final
  check ran under the standard shared heavy lane with bounded Go concurrency
  and memory. No application build was performed.
- Whole-root tsc --noEmit was attempted but killed with exit 137 before compiler
  diagnostics. No whole-repository typecheck success is claimed. No app build
  or full test suite substituted for that result.
- Frozen candidate manifest reverified; all sixteen listed files match exactly.

Commands, from repository root:

    node_modules/.bin/vitest run test/packed-creature-live-dimensions.test.ts test/packed-creature-bodies.test.ts
    node_modules/.bin/vitest run docs/reviews/packed-creature-live-dimensions/candidate.test.ts --config docs/reviews/packed-creature-live-dimensions/vitest.config.ts
    node_modules/.bin/oxlint src/game/plugin/geometry.ts test/packed-creature-live-dimensions.test.ts
    node_modules/.bin/tsc --noEmit -p docs/reviews/packed-creature-live-dimensions/tsconfig.json

Reports use repository-relative names. Logs retain substantive diagnostics;
private execution prefixes and excess terminal blank lines are normalized for
delivery. Root owns Git and publication. No Conch files were changed; its owner
confirmed no overlap with this geometry.ts edit.
