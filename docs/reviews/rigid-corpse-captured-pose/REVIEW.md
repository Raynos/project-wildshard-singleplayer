# Captured lethal-pose policy: source-only implementation

2026-10-19. No product opt-in, build, browser, deployment, dependency change, or
production asset edit. This is an alternative motion policy, not a repaired
animated fold. The authored death fold is sacrificed and may look worse.

## Contract

`dims.rigidCorpse.posePolicy` admits only the exact optional literal `captured`.
Absence retains the prior optional animated recipe; absence of the entire recipe
retains legacy behavior. Unknown keys, unknown policies, and explicit undefined
are rejected at strict data/runtime recipe admission. Nested points remain
copied. Numeric-animation admission is unchanged, including in captured mode.

AnimalView selects the policy at the existing lethal ragdoll boundary. Every
supplied bone's current local position and quaternion is cloned into frozen,
detached endpoints, including bones without collider parts. Captured render uses
exact copies rather than quaternion interpolation. Fixed pre restores these
locals but does not evaluate animation, read live pose inputs, advance animation
clocks, or rewrite collider-local transforms. The original prepared hulls remain
constant relative to their single dynamic root. Recipe/publication policy
mismatch refuses before native body allocation.

Root throw, angular velocity, damping, explicit mass/COM/inertia, scale handling,
identity-parent requirement, masks, world contacts and fixed root interpolation
remain unchanged. Local animation is complete immediately for settling; the
existing fixed-post quiet/sleep/MAX_T lifetime remains in charge of the root.
There is no delay, root lift, final-pose snap, padding, floor correction, kinematic
proxy, extra body or authored callback. Existing cap/no-physics fallback is not
changed. No living animation, simulation, AI or dimensions are edited.

## Checks

Final focused command (one worker):

`WS_VITEST_MAX_WORKERS=1 node_modules/.bin/vitest run test/rigid-corpse-clock.test.ts test/rigid-corpse-schema.test.ts test/rigid-corpse-physics.test.ts test/rigid-corpse-input-order.test.ts test/rigid-corpse-default-parity.test.ts`

Result: **5 files, 157 tests passed** in 33.42 seconds. Raw sanitized final output
is `tests-final.txt`. Coverage includes:

- The unchanged 52-case no-recipe legacy parity test file.
- Strict admission/copying and captured/absent living simulation equivalence.
- Captured endpoint equality at 30/60/120/6 Hz, zero delta, paused renders,
  throwing live-input getters, no evaluator calls, invalid-delta retry, all-bone
  validation, and unchanged death/flinch clocks.
- Actual AnimalView lethal composition with the actual Game fixed scheduler,
  both practice-update and retained-fixed-post death delivery, near/far renders,
  pause, three-step catch-up clamp, repeated bout retirement and stale inputs.
- Actual native 13,374-vertex geometry, eight convex parts and 435 hull points:
  absent and captured modes preserve support extrema in four world directions
  at sampled endpoints through the 48-step fixture. Captured locals and native
  hull local translations/quaternions remain exact at every fixed step. This
  checks native geometry support, not a full contact-quality acceptance gate.
- Initial root pose is unchanged; immediate initial linear/angular throw is
  exact against legacy. Mass, COM and tensor use the existing numeric tolerances;
  damping/masks remain unchanged and airborne integration remains equivalent.
- Allocation failure at every one of eight parts in both policies releases the
  body/colliders/cap and permits retry. Existing world teardown, scope disposal,
  identity-parent, scale, settlement and MAX_T coverage remains green.

The first test attempt reported 138/144 passing: six new assertions compared
Three.js Quaternion objects including their callback identity. Numeric arrays
corrected those assertions. The second attempt reported 151/157 passing: six new
exact angular-velocity checks were incorrectly placed after a physics step,
where legacy versus explicit inertia already uses floating-point tolerance.
Moving the exact throw assertions to the initial pre-step boundary preserves
existing post-step trajectory/tensor tolerances. Raw second-attempt output is
retained separately; no physics adjustment was made to satisfy it.

Final focused type-aware oxlint completed with exit 0 and no diagnostics for all
five changed source files and four changed test files.

The first focused type-aware lint attempt found four style diagnostics and one
unnecessary literal comparison, corrected without weakening lint rules. Its raw
output is retained. A full root `tsc --noEmit` attempt was killed without emitted
diagnostics while other checks were active; it is not a TypeScript pass. No full
suite, build, browser collision walk, non-flat native contact acceptance,
physical-phone performance, full combat visual review or quality acceptance is
claimed here. Independent review and separately authorized isolated product
validation are required before any promotion.
