# Independent native resource review

2026-10-20. Review of the first physical primitive, not actor integration.
Read AGENTS.md and docs/process/GIT.md. No production/test edits, Git operations,
app build, tuning or remote write; this review is the only authored file.

## Verdict

**Accept this bounded primitive milestone after the cleanup repair.** No open
must-fix found in the revised four source/test files. This is not approval of
selected Conch geometry, contact quality, native actor handoff or public Arena
admission. The resource has no caller opt-in in this milestone.

Reviewed SHA256s, unchanged before and after the independent test:

- `src/engine/physics/rigidCorpse.ts`:
  `fab61f9b0448ab522521cedbd3d3709862878ccf57160afa91785bf1b67105ad`
- `src/engine/physics/ragdoll.ts`:
  `8a5a2768533411f77fc9a20504764f29dc0e83b9d9423123bf5ffd06c4c2937e`
- `src/engine/physics/nativeRigidCorpse.ts`:
  `6cef81660b61474cc3076cc6d57cc460a120adabbf3893527dcc0c313d365db0`
- `test/native-rigid-corpse-resource.test.ts`:
  `d6bdfe3fd79502048fee7a7b9bca8b15c18a68c7940ca5f6933bace9784786a0`

## Concrete finding and resolution

The first frozen implementation called native body removal before allocation
scope cleanup, without a finally-equivalent drain. A removal exception during
owner Scope.dispose could bypass reservation finalization after the owner had
already cleared its callbacks. Repeating owner disposal could not retry cleanup.
This was a must-fix, not an ordinary missing integration test.

The revised `retire` always attempts allocation cleanup, checks whether the
exact body remains, and releases capacity only after verified removal/world
retirement. A surviving body stays attached to its lease in explicit `failed`
resource state and continues consuming capacity. Explicit lease disposal can
retry even after owner closure. After-effect errors still surface, even when
cleanup removed the body. The new regressions cover both outcomes.

Partial allocation followed by cleanup failure is handled by the same concrete
ownership. Pre-existing body identities delimit the synchronous single-body
allocation; an allocation wrapper throwing before returning does not lose the
new body. The regression retains an unrelated body unchanged through recovery.
The design depends on this being synchronous trusted construction with exactly
one new body and no authored callbacks, as documented in the milestone.

## Other source conclusions

- Reservations, prepared resources and legacy corpses use the same per-system
  occupancy. Activation transfers a promised slot without rechecking free
  capacity. Default-off spawn behavior remains the legacy live-count check when
  there are no reservations. Mixed-mode earlier legacy fallback is intentional.
- The allocation scope is now a child of admission ownership. Parent teardown
  and explicit teardown remain idempotent; actual resource census includes the
  child. Initial and subsequent endpoint reads preserve Rapier quaternion tuples.
- Hull updates validate before applying; recoverable setter failure restores
  the accepted numeric transforms, not re-quantized quaternion readbacks.
  Rollback failure is terminal. Resource capture alone advances age; maximum
  age still overrides an incomplete fold.
- Shared hull construction and body descriptor preserve the old rigid law.
  Native eligibility is explicitly narrower than legacy: every submitted joint
  must have unit scale, including non-hull decoration. The milestone and a
  regression record this refusal; parity is only for the supported subset.

## Independent execution

Ran `test/native-rigid-corpse-resource.test.ts`: **26/26 passed**, one file,
11.72 seconds Vitest / 12.46 seconds shared lease, exit 0. Command:

`WS_HEAVY_ROOT="$PWD/tmp/heavy-lanes" python3 scripts/heavy-lane.py build -- node_modules/.bin/vitest run test/native-rigid-corpse-resource.test.ts`

The build lease was expressly selected by root to coordinate resource use after
Pitcher rendering finished. It ran only this test, not an app build. An earlier
`check`-lane attempt rejected the same bounded test as a full-suite request
before executing it; no override was used. Vite emitted its existing future
native-config-loader import-extension advisory, not a test failure.

The writer separately reported 127/127 across resource, default-parity and
rigid-physics files plus focused TypeScript/lint success. This review does not
claim independent reruns of that larger set or those static checks.

## Gates before integration acceptance

Actor code must distinguish recoverable refusal (reservation remains usable)
from terminal cleanup failure (released lease or attached failed resource).
It must close the actor owner on terminal failure and retain explicit cleanup
responsibility if a body survives; it cannot retry combat as a healthy actor
whose promised slot was revoked. Duplicate capture/tick rejection still belongs
to the future host scheduler, not this primitive.

Still unproved: real CharacterMotor handoff/cache rollback, atomic HP/event/pose
publication, pre/physics/post scheduling, physical-quaternion FK/interpolation,
loot at the lethal endpoint, and integrated Retry/exit. Selected weighted-surface
representability remains a separate gate after those ownership tests.
