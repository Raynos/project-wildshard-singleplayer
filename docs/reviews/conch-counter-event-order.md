# Conch counter delivery: isolated practice event order

## Result

The missing counter is a practice-host event-order defect. The exact grounded
product reproduces it without rendering or cloud scheduling. Its existing guest
already implements the intended counter response; no strike, guard, pose or
engine-policy change is needed.

Pinned product source: `bb2f0928b20938a942a93f8b9d27b65bebc726464ffedd359c16f19a70c9e8d0`.
Baseline PracticeCreature SHA-256: `96cad9369bcfaee9018f5d1556902e0248a34c8b8ddd2bbd7175eb8717a9505a`.
Unchanged guest SHA-256: `07ded78edf914ccc41c2d636b1d9e99d08f5fd4617a509fc3b3c0b3caea93714`.

## What happens

1. The actual melee path applies damage, queues `damage.dealt`, then staggers the
   surviving body. Guarded damage is correctly reduced from 12 to 3 (60 → 57 HP).
2. PracticeCreature advances borrowed fixed decisions before draining its local
   event queue. The borrowed runner immediately cancels the interrupted thrust.
3. At a decision boundary, guest `onTick` sees stun before `onHit` and changes
   stage 1 to stage 2. The late hit no longer meets the counter predicate.
4. Even away from a decision boundary, cancellation observation queues
   `strike.done` before the delayed `hit`. The guest processes strike completion
   first, again replacing stage 1 with stage 2. This second ordering explains why
   the failure is not merely an unlucky render frame.

DecisionHost correctly drains queued guest events before appending the current
10 Hz tick. The defect is upstream: the hit has not reached that queue yet.

## Bounded correction

In `src/game/practice/PracticeCreature.ts`, after the null callback guard and
before the decision branch, drain `this.events?.flush('update')`. Keep the
existing end-of-update drain for events produced during this update. This only
orders already-applied bout damage before its AI observes the resulting stun.
It does not synchronously run Wasm in the damage path or alter shared engine
Events/DecisionHost policy. The same isolated bout queue remains in use.

With this order, `hit` precedes `strike.done` and `tick`. The unchanged guest
records stage 4, preserves it through stun, and starts its declared stage-3
counter after stun ends. The real StrikeRunner emits its authored 16 damage.

## Focused proof

`art/driftwood-isle/approved-conch/runtime-admission/conch-counter-event-order.test.ts`
loads the pinned preview's verified product and its real guest bytes through
preparePracticeDecision and the borrowed authority. It uses the real
CombatPipeline route, AnimalSim damage/stagger, ShardDecisions, DecisionHost and
StrikeRunner. No browser/build or gameplay source was changed by the diagnostic.

- Boundary trials at 60, 30 and 10 Hz: old order loses counter; early drain
  produces stage 4, counter strike and 16-damage contact.
- Off-boundary queue proof: old `[strike.done, hit]`; corrected `[hit, strike.done]`.
- Late unguarded interruption remains 12 damage and never invents a counter.
- Lethal hit retires fixed callbacks; fresh bout starts at 60 HP with no old hit.
- No world damage/death events escape; fixture localStorage remains empty.
- Source-order assertion deliberately fails before the proposed correction.

Baseline receipt: [test results](../../art/driftwood-isle/approved-conch/runtime-admission/arena-motion2/evidence/counter-event-order-baseline-tests.json).
Structured diagnostic: [receipt](../../art/driftwood-isle/approved-conch/runtime-admission/arena-motion2/evidence/counter-event-order-receipt.json).

Run only the focused file with the existing admission Vitest configuration:
`node node_modules/vitest/vitest.mjs run --config art/driftwood-isle/approved-conch/runtime-admission/vitest.config.ts conch-counter-event-order`.
The pinned build directory must remain available; this diagnostic does not
regenerate or silently substitute another product.

## Integrated correction

The root applied the bounded early drain and retained the existing end drain.
All seven focused tests pass against the corrected source, including the
source-order assertion. The old-order negative controls still reproduce both
failure mechanisms. [Fixed test receipt](../../art/driftwood-isle/approved-conch/runtime-admission/arena-motion2/evidence/counter-event-order-fixed-tests.json).

The related practice damage-parity, exact-target route and player/loot suites
also pass: 15 tests across three files. The first parallel attempt hit a missing
Vitest temporary SSR artifact during setup of one file; its failure receipt is
preserved. Rerunning all three with one worker passed without source changes.
[Regression receipt](../../art/driftwood-isle/approved-conch/runtime-admission/arena-motion2/evidence/counter-practice-regression-tests.json).

## Remaining acceptance

This is renderer-free causal proof, not arena acceptance. Reach/claim are
controlled open ports; contacts, movement, pose and the actual Retry button still
need the root's fresh browser capture. Fresh-bout recreation checks controller
isolation but does not claim UI Retry coverage. The fixture installs no world
save authority; retain the separate browser proof that persistent stores remain
empty. Preserve the four failed real guard-hit trials and their original pins.
