# Conch motion4: upper-body readability source candidate

Source only, unaccepted. No build, mounted host, published host or production change.
Static character acceptance remains 3.57 and has not been rescored. Motion3 remains
best tested/public. Root review and explicit build-lane assignment are still required.

## Actual failure addressed

The independent motion3 review found generic small preparation, guard/counter shapes
that read too similarly, and white hit flashes stronger than recoil. Its weapon
extension peaked at the end of the active window, with a broad recovery tail.

The canonical packed rig faces +Z, with Y up. Negative shoulder X lifts its
forward/downward shield and rapier. Shoulder Z gives lateral separation; forearm Y
turns the blade into the existing narrow strike lane. Source GLB axes differ: the
canonical transform is T(0,0,.05) Ry(pi). All tests use the actual packed rig.

## Authored changes

New `conchReadableClips.ts` is a separate generator, with a separate isolated
`conchReadablePreview.ts`; neither is wired into an existing host or default bake.

- Ordinary guard closes and lifts the shield (.48rad shoulder lift, -.38rad forearm
  turn), with rapier draw, small shell twist and head focus.
- Counter preparation opens the shield instead, lifts the rapier .55rad and splays
  its shoulder .38rad, with opposite shell/head twist. The tip rises to roughly
  chest height instead of the ordinary lower preparation.
- Attack keys use the real .60s / .45s windups, .10s active window and .90s recovery.
  The authored hit pose occurs 35ms into active; a 200ms withdrawal then a longer
  brace/settle replaces the old sustained extension. All nominal cycle boundaries
  meet the identical rest pose. Smoothstep interpolation has zero slope at knots.
- Recoil involves shell/head/weapon/shield, scaled by the actual flinch observation;
  it reduces attack contribution by up to 65%. No stronger flash or new visual
  effects. There is no separate torso joint: shell/head carry weight without
  pitching the root or moving the unchanged feet.
- The precise motion3 root, lower-body channels, death curve and death rotations
  remain. Added channels are zero during death; legacy death math is equivalent.
  No model, bind, dimensions, light, AI, strike, damage, reward or persistence edit.

## Scoped source evidence

`source-check.json` records all measured poses and weapon tip traces. Focused tests:

- 4,815 living samples: five stages, three recoil levels, 321 times per combination.
  Every weighted mesh minimum is 0.0030000000000000027m.
- 5,300 comparisons: exact lower-body parity in those living samples plus exact
  all-joint death parity across five stages and 97 death times with stale clocks
  and varying recoil. All 7,338 vertices and all four weights are evaluated.
- 1,215 living clearance samples: every edge and vertex of the mapped 168-vertex
  ivory blade stays outside the conservative transformed torso bounding box.
  This is a sampled blade-edge/vertex separation check, not proof of every
  possible part/part collision, between-sample collision or arbitrary world pose.
- Actual authored hit tip: x=.139858m, y=.891506m, z=1.925230m, within the unchanged
  .65m strike lane. Ordinary/counter hit poses occur at .635/.485s. Maximum forward
  tip reach occurs .010s earlier while the tip is still moving inward (x=.567/.683m);
  both maxima are inside the active window, at z=1.948/1.962m. The lane is not a
  swept weapon collision shape; the full approach is not claimed to lie inside it.
- Preview parity checks keep all gameplay platform sections, lighting, body and
  pickup inputs byte-equivalent; only pose bytes and source revision differ.
- Strict numeric admission is unchanged. Attempt1 exceeded its 128-node limit;
  the live/dead branch was algebraically simplified without relaxing the schema.

## Deliberate non-acceptance

The strict pose consumer forbids private state. A stateless clip cannot preserve an
arbitrary incoming pose when AI stage/clock resets on an interrupt. Therefore this
candidate does NOT satisfy full interrupted-transition continuity. Death preserves
motion3 exactly, including its onset behavior, rather than silently changing it.
Nominal complete cycles are continuous, but guarded-hit/counter handoff, repeated
hits, death interruption and low-cadence active-frame visibility need fresh real
host capture and independent complete-cycle review. If full continuity is a hard
pre-build requirement, retain this as a rejected source proposal pending a separately
authorized pose-history/AI design; do not promote it.

No browser, physical phone, live combat, weighted world trace, camera occlusion,
shield/head/body intersection or perceptual telegraph acceptance is claimed. Feet
still inherit motion3 sliding/knockback limitations. Source checks are not runtime
acceptance. Build and promotion permissions remain false in the freeze.

## Preserved attempts and reproduction

`rejected-attempts/` retains the exact initial node-overflow source, the first
wide-tip source and the .20rad shoulder-turn lane miss as ordinary text sources.
Their relative imports intentionally describe the original generator location.

Run:
- `node node_modules/vitest/vitest.mjs run test/conch-readable-contact.test.ts test/conch-readable-preview.test.ts`
- `node --test scripts/conch-readable-admission.test.mjs`

Validation: four focused Vitest tests and the source-freeze Node test pass. Scoped
oxlint passes; no full typecheck, app build or browser run was performed.

The freeze pins this candidate, tests, evidence, unchanged motion3 admission and
canonical inputs. `admitConchReadable` reuses the motion3 native tuple verifier;
it is a source freeze verifier, not permission to build. No build script or Vite
host/config is introduced in this source-only step.
