# Rigid corpse current-input repair

Status: focused source repair verified; opt-in implementation study only. No
product recipe, browser build, physics walk, or visual acceptance is enabled by
this work.

## Finding and repair

The constructor runs during `AnimalSim.died`, before `damaged` and queued combat
event delivery. A once-frozen memory record could permanently retain a pre-death
strike even after the real guest wrote `tg-state = 6` and `tg-clock = 0`.

`RigidCorpsePose` now copies current memory, phase, state and yaw at every owning
fixed pre step. `AnimalView` lends an explicit trusted data view, so replacing
`animal.mem` is observed too. The admitted numeric evaluator receives a frozen
context and copied/frozen memory, never the actor or its mutable record. No new
callback admission or event/combat reordering is introduced.

Dimensions, uniform scale, seed, position and look target remain detached
construction-time inputs. This avoids structural collider/pose scale drift and
feeding interpolated render positions into fixed pose evaluation. Death time,
flinch decay and numeric time remain fixed-owner clocks. A failed snapshot or
numeric evaluation restores the last published joints and leaves those clocks
uncommitted. Render only interpolates existing bone/root endpoints.

## Evidence

- The auditor's unchanged actual-Bellback differential script now reports zero
  bell/clapper/foreleg differences at all 15 checkpoints across pulse, echo and
  stomp. Output: [fixed-input-results.json](fixed-input-results.json). Prior
  evidence: [audit results](../rigid-corpse-contract-audit/stale-death-input-results.json).
- 76 tests pass across `rigid-corpse-input-order`, `rigid-corpse-clock`,
  `rigid-corpse-physics` and `rigid-corpse-schema`.
- The input-order suite executes the real `Animal` death hook, the already-built
  admitted Bellback Wasm guest, real `PracticeCreature.update`, real `Game`
  fixed scheduler/phase methods and native Rapier eight-part corpse. Browser
  constructors and model loading are bypassed; this is not a rendered-page test.
- Practice update delivery is tested before the next fixed pre. A retained-body
  owner scheduled in fixed post verifies delayed dispatch: the guest stages its
  10 Hz transaction and commits on the following tick; only the next pre sees
  that memory. Every pre endpoint is compared with the unchanged numeric pose,
  and every collider-local translation is compared with its actual bone.
- Actual scheduler coverage includes pause/resume, three-step catch-up cap and
  dropped-backlog non-replay. Repeated render observations do not advance clocks.
- Current/replaced memory, immutable observations, retained structural inputs,
  failed numeric input and corrected retry, and three fresh bout retirement /
  recreation cycles are exercised. Retired actor memory is replaced with a
  throwing getter to verify that no later corpse phase reads it.
- Focused type-aware lint is clean. Whole-tree typecheck, full test suite and
  browser/build/contact/phone acceptance are not claimed by this repair.

## Scope boundary

The current page-world authority uses an alive-only lifetime and retires dead
scopes. The fixed-post test deliberately uses a retained-body authority, as does
the native owner; it does not claim that the current page-world death handler
runs. No decision lifetime, AI, living dimensions, default ragdoll path, product
selection or public surface is changed.

The integration fixture reuses
`tmp/bellback-tucked-preview/motion3-build1/product`; it requires that reviewed
candidate's existing product artifacts. It does not rebuild or enable the
candidate. Focused numeric/schema/physics tests do not require a new product.

## Commands

```sh
NODE_OPTIONS=--max-old-space-size=4096 WS_VITEST_MAX_WORKERS=1 \
  node_modules/.bin/vitest run test/rigid-corpse-input-order.test.ts \
  test/rigid-corpse-clock.test.ts test/rigid-corpse-physics.test.ts \
  test/rigid-corpse-schema.test.ts
NODE_OPTIONS=--max-old-space-size=4096 node_modules/.bin/oxlint --type-aware \
  src/engine/entities/rigidCorpsePose.ts src/engine/entities/AnimalView.ts \
  test/rigid-corpse-input-order.test.ts test/rigid-corpse-clock.test.ts
```
