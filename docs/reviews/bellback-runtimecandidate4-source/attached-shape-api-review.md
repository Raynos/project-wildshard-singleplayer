# Installed attached-shape velocity API review

2026-10-19. Read-only inspection of installed @dimforge/rapier3d-simd 0.21.0
(package.json line7), project bridge and fixed-step composition. No simulation,
impulses, engine edits, downloads, architecture changes or settings changes.

## Finding

The installed supported JS API cannot express an independent translating and
rotating attached collider's normal surface velocity in the contact constraints
of its existing single dynamic parent body. This is an API limitation for the
requested design, not a claim that no physics engine implementation could do it.

Exact installed source evidence:
- geometry/collider.d.ts:358,375 expose setTranslationWrtParent(Vector) and
  setRotationWrtParent(Rotation). Their JS implementations at404–407 and428–430
  forward only pose components to the raw collider setters. No dt, local linear
  velocity or local angular velocity is provided. Corresponding raw signatures
  are rapier_wasm3d.d.ts:205,227.
- pipeline/physics_hooks.d.ts:3–7 defines only NONE, FILTER_CONTACT_PAIRS and
  FILTER_INTERSECTION_PAIRS. PhysicsHooks at12–39 returns SolverFlags|null or
  boolean, not modified contacts. pipeline/physics_pipeline.js:13–16 passes
  only those two filter callbacks. Raw stepWithEvents signature at
  rapier_wasm3d.d.ts:870 confirms the same two hooks. There is no supported
  modifySolverContacts callback in this installed bridge.
- geometry/narrow_phase.d.ts:110–129 exposes solver point, distance, friction,
  restitution and tangent velocity getters. narrow_phase.js:208–210 reads the
  tangent vector into a scratch buffer; the optional target is an output object,
  not a setter. Raw solver_contact_tangent_velocity at rapier_wasm3d.d.ts:369
  is likewise a read. No normal target-velocity setter is exposed.
- dynamics/rigid_body.d.ts:270–292 provides next kinematic translation/rotation
  for an entire kinematic body. It is not a parent-relative collider trajectory
  API for a dynamic compound. Lines204–217 explicitly make non-kinematic next
  poses unspecified. Converting the body would change its dynamic response.
- Rigid-body setLinvel/setAngvel (237,268) and impulses (541,571) affect the
  entire parent. They cannot generally encode eight distinct articulated
  surface velocities simultaneously, and are not contact-level constraints.
- Project src/engine/physics/Physics.ts:113–116 steps world directly.
  src/engine/physics/ragdoll.ts:365–377 advances numeric corpse animation and
  applies the parent-relative collider poses before that step. Adding a filter
  hook here would still not provide the missing contact-velocity API.

## Required semantics, not an implementation proposal

At a point on a shape, truthful surface motion includes the parent's rigid
velocity plus local translation velocity and local angular velocity crossed
with the point's local lever, transformed to world coordinates. Contact response
needs the relative velocity of the two surfaces projected onto the actual
contact normal, including non-horizontal terrain. Eight differently moving
parts cannot in general be represented by one chosen parent velocity.

The failed body-timing study and negative solver-iteration study do not prove
that adding this term alone would meet the5mm gate. Discrete advancement,
contact creation, pose sweeps and render interpolation would still require
review and tests. They do establish that neither tested adjustment is accepted.

Decision: blocked within the current API and granted single-body design scope.
Do not substitute a hand-applied impulse, upward velocity bias, floor-height
correction, collider padding, friction tangent setting or unproved CCD claim.
A further step requires an explicitly reviewed change to available contact API
or an approved architecture decision. No such change is made or authorized by
this report, and no more native variants are running.
