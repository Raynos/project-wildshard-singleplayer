# Independent native rigid-corpse proposal review

2026-10-20. Read-only source review, except this review document. No implementation,
Git operation, app build, tuning experiment, remote write or geometry admission.

Reviewed frozen `NATIVE-RIGID-CORPSE-PROPOSAL.md`, SHA256
`58d74b9d2ddc7b60cbf4cfc1b241d16b94d4d6c8f9e0af8432bab14ab62a2618`.

## Verdict

**Accept as the bounded implementation contract, not as implemented or proved.**
No architectural must-fix found in this revision. Admission-time reservation
correctly resolves the lethal-cap race without a second pool or eviction. The
explicit mixed-mode reduction in legacy availability is necessary, not exact
mixed-mode parity. Default-off compatibility remains a required executable proof.

The one-root resource/SimHost/numeric-pose separation is consistent with the
current layer boundaries. Selected-Conch weighted-surface representability
remains a separate refusal gate; generic ownership success admits no geometry.

## Source checks and implementation acceptance conditions

1. **Shared capacity:** `ragdoll.ts:496–530` currently counts actual legacy live
   resources and provides a per-Physics singleton. Reserve/activate/release must
   modify that same accounting, not only a native-local counter. Assert both
   actual `live` and total occupancy at every transition, including failed hits,
   frozen disposal, construction failure and mixed legacy contention. No slot
   acquisition may occur at the killing hit.
2. **Atomic handoff:** `AnimalSim.ts:262–285` currently prepares before scalar
   mutation, but commits publication after mutation. Activation must therefore
   be a distinct pre-scalar operation, not hidden in `commit`. The existing
   `CharacterMotor.setEnabled` (`CharacterMotor.ts:268`) changes its private
   enabled cache before calling Rapier. Inject failures before and after the
   native setter's side effect; prove the same motor's cached and actual collider
   states both recover. Retired controller/collider removal must remain outside
   the copy-only commit and run on disposal before the next tick too. A failed
   rollback is terminal, never a successful atomic refusal.
3. **Fixed scheduling:** `PracticeNativeActor.fixed:113–117`, not
   `SimHost.stepEmbedded:863–866`, ticks the private clock. `stepSystems:867–886`
   runs callbacks, strikes, body steps and after hooks. Add the physical-owner
   branch at the actual body/pose boundary without ticking those twice. Test
   lethal hits before pre, inside post before/after the actor's body slot, and
   zero-fixed update. A failed pre must still permit post to publish the actual
   physical root with the last accepted local pose; Game catches faults per
   system and continues later phases (`Game.ts:650–683`).
4. **Numeric ownership:** `NativeCreaturePose.publish`, `prepareAppliedHit` and
   `copyPublished` (`animation.ts:667–774`) currently compose roots from Euler
   rotations. Merely storing diagnostic quaternions is insufficient: FK and
   root interpolation must consume the authoritative physical quaternion too.
   Require tilted/off-axis roots, quaternion sign equivalence, alpha 0/1 and
   intermediate view agreement, and no live-pose/scalar mutation during detached
   preparation. `AnimalSim.advancePose:198–205` writes actor scalars, so it cannot
   be reused directly as an off-live prospective operation.
5. **Legacy extraction:** preserve the strict identity-parent rejection and
   unit-scale ancestry checks in `rigidCorpse.ts:32–49`. Non-identity ancestor
   tests must distinguish allowed bone rotations/translations from the currently
   rejected transformed root parent. Preserve mass-zero hulls plus explicit body
   mass properties (`ragdoll.ts:231–239`) rather than recomputing density inertia.
   The legacy freeze predicate (`ragdoll.ts:399–401`) is max age OR completed fold
   with sleep/quiet, not completion required at max age. Test that distinction
   explicitly so a pathological fold cannot hold capacity indefinitely.
6. **Lifecycle and receipts:** `PracticeCreature.enterNative:205–245` constructs
   the native host before exposing targets and binds loot to queued death
   delivery. Reserve before registration and keep failures inside bout cleanup.
   Verify exactly one lethal-position loot drop even if later corpse ticks move
   actor.position, plus Retry before retirement, during collapse and after
   freeze. Refuse physical pose-only restore before mutating any scalar/history,
   and retain existing version-1/version-2 bytes when opt-in is absent.

These are implementation checks against concrete existing seams, not additional
feature requests or claims that the proposal already fails them. No focused
runtime tests were run for this document-only review. Approval covers proceeding
to the proposal's isolated resource/ownership tests only; it does not authorize
an app build, selected geometry acceptance, public Arena selection or deployment.
