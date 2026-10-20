# Native rigid corpse: physical resource milestone

2026-10-20. Bounded first implementation slice under the reviewed
`NATIVE-RIGID-CORPSE-PROPOSAL.md`; not actor integration or creature admission.

## Implemented boundary

- Numeric hierarchy preparation validates at most 32 ordered, uniquely named
  joints, unit scale/quaternion, finite float32-safe translated endpoints, and
  the unchanged rigid recipe limits: 8 hulls, 128 points per hull, 512 total,
  coordinates within +/-20. It shares the existing convex hull constructor.
  The legacy Three adapter retains identity-parent and unit-ancestry refusal.
  Native eligibility is deliberately narrower: all submitted joints must have
  unit scale, including non-hull decorative branches. A dedicated regression
  proves legacy still accepts such a scaled decorative branch while native
  refuses it. Parity is claimed only within this supported unit-scale subset.
- `NativeRigidCorpse` prepares one disabled dynamic root and mass-zero convex
  colliders, with no joint, scene node, animation evaluator, scheduler or restore
  API. Explicit mass, COM, inertia, launch velocity, damping, friction,
  restitution and DEBRIS filters use the existing rigid recipe, now shared.
- `Ragdolls.reserveNative(scope)` promises capacity at admission. Actual live
  count remains distinct from total occupied count. Native reservations and
  legacy live corpses contend for the existing single cap. Preparation and
  activation transfer that slot without a lethal-time capacity check.
- Failed recoverable preparation/activation keeps the original reservation.
  Concrete resource disposal, freeze and owner disposal release exactly once.
  An allocation scope captures actual native resources even when a wrapper
  throws after allocating. Whole-world teardown does not dereference freed
  handles; abort then releases rather than reviving the retired reservation.
  Allocation is a child of the admission scope, so the actual native census
  includes its body/colliders. Initial endpoints are read from Rapier, not from
  the pre-quantized input tuple.
- Local hull updates validate the whole numeric set first. Setter failure
  replays the last accepted numeric transforms, preserving exact collider
  endpoints in the regression. Creation and updates use the same native setter
  path: restoring a quaternion read back from Rapier would normalize an already
  quantized value again and caused observable float32 drift. That failed test
  was retained and fixed, not weakened to a looser comparison. Failed rollback
  is terminal and throws; it is not reported as a successful refusal.
- Removal failure always attempts allocation cleanup. If the body is genuinely
  gone, its slot releases once while the terminal error still surfaces. If the
  body remains, state becomes `failed`; the exact slot and concrete resource
  stay attached to the lease. `lease.dispose()` can retry even after the parent
  Scope has closed and consumed its callbacks. It must not be reported as a
  successful cleanup or permit another corpse to overbook that slot.
- Partial allocation failures use a pre-existing-body identity set around the
  synchronous one-body construction. If a wrapper throws after allocating but
  before returning, the exact new body receives concrete retained cleanup
  ownership too. Multiple unexpected new bodies fail closed. This performs one
  world-body enumeration per preparation, plus a recovery enumeration only when
  the body was not returned. No authored/awaited work runs between them; no
  pre-existing body is removed and no Physics lookup/restore API was added.
- Endpoint reads copy actual physical position/quaternion without advancing
  time. Only the explicit existing-fixed-step capture advances resource age.
  Freeze remains maximum age 5 seconds OR completed fold with sleeping/quiet
  physics. Incomplete folds cannot retain capacity past maximum age.

## Evidence

`test/native-rigid-corpse-resource.test.ts` has 26 actual installed-Rapier tests:
three-scale numeric/Three hull parity; malformed/numerically unsafe admission;
mixed legacy contention and exact release; body and both collider allocation
failures before/after native effects; body activation failure before/after its
native effect; three-scale 120-step exact rigid-body parity; local setter
rollback; quiet reads; incomplete maximum-age versus completed sleeping freeze;
live/prepared whole-world teardown; closed-owner removal failures before/after
native effects; partial-allocation cleanup failures preserving an unrelated
body; and the conservative non-hull-scale refusal.

Final focused run with `test/rigid-corpse-default-parity.test.ts` and
`test/rigid-corpse-physics.test.ts`: 127/127 passed in 27.93 seconds. Focused
strict TypeScript passed. The initial rollback drift and later cleanup faults
are covered by exact regressions. Earlier type-aware lint attempts were killed
with exit 137; root's actual hook then identified missing nested-error causes
and an object-copy style error. Those concrete diagnostics were repaired without
suppressions. The isolated focused-config lint retry is pending at this freeze. No app build, full suite, geometry edit or public pin change occurred.

## Explicit continuation, not proved by this slice

No caller opts into the resource yet. The default practice actor path therefore
still has the physical-owner limitation recorded in `NATIVE-CORPSE-BOUNDARY.md`.
The tests above do not prove actor damage/publication handoff, CharacterMotor's
cached/native enabled-state rollback, fixed-phase scheduler integration,
physical-quaternion FK/view interpolation, lethal-position loot, or integrated
Retry during collapse. Those remain the next bounded implementation gates in
the accepted proposal. Existing native hit/publication and lifecycle tests are
not substituted for those physical tests.

No selected Conch hulls or pose pass were authored here. Its 15-part blended
surface representability under 8 rigid hulls remains a separate admission gate.
There is no contact/animation/render-quality acceptance, no Bellback expansion,
no cap increase, and no new historical mid-bout rewind authority. Fresh isolated
Retry/reload remains the required persistence behavior once integrated.
