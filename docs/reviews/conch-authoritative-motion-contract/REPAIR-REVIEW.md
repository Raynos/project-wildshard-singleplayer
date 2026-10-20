# Independent hit-preparation repair review

2026-10-20. Root identifies the repair as local `145c3f4` and remote
`602ea413`. This reviewer inspected the current source, not Git/ref state.
The historical `INDEPENDENT-PROTOTYPE-REVIEW.md` remains unchanged.

## Verdict

**The reproduced P1 is repaired within the selected synchronous native-owner
path.** No additional repair blocker was established. This closes that
failure-atomicity finding, not native practice integration or public admission.

## Independent evidence

- Ran `node_modules/.bin/vitest run test/native-creature-pose.test.ts --maxWorkers=1`:
  **4/4 passed**, including nonlethal and lethal refusal, a subsequent valid
  hit, preservation of an already queued receipt, and repeated event flushes.
- Re-ran the exact admitted `transition.kind * 1e12` input from the historical
  review through real AnimalSim, NativeCreaturePose and CombatPipeline.
  Initial evaluation succeeds and the lethal evaluation still refuses.
  Unlike before, actor snapshot, pose snapshot and event queue are unchanged.
- Froze `actor.position`, `actor.lookTarget` and `actor.mem` before the refused
  hit and the subsequent successful hit. Both paths preserved their values;
  the successful commit did not throw due to borrowed-vector writes.

Exact independent output:

```text
REFUSAL {"unchanged":true,"borrowedUnchanged":true}
{"error":"Non-finite or excessive client expression","alive":true,"hp":100,"receipts":0,"deaths":0,"ordinal":0,"headX":0}
SUCCESS {"killed":false,"hp":99,"ordinal":1,"headX":1000000000000,"receipts":1,"deaths":0,"borrowedUnchanged":true}
```

The large successful head coordinate is solely an overflow-boundary witness,
not an accepted animation/contact value.

Reproduction used the historical review's exact stdin module-loader script.
Before the first hit, capture JSON of `actor.snapshot()`, `pose.snapshot()` and
`events.snapshot(payload => JSON.stringify(payload))`; record position,
lookTarget and memory; freeze those three borrowed objects. After catching the
lethal hit, compare the same snapshots before flushing. Finally submit the
same hit with `amount: 1`, flush, and read HP, ordinal, head position and counts.
No source/test files or app build were needed for this additional check.

## Why this boundary is coherent

`AnimalSim.ts:263-277` constructs a prospective scalar hit, calls preparation,
then changes live damage state and consumes its prepared publication. A
preparation exception therefore precedes HP/death/flinch mutation.

`animation.ts:685-708` clones joint transforms into owner-created scratch,
creates a separate context and detached transition entry, evaluates the
admitted numeric row, and builds/solves candidate FK before returning.
`refreshPracticeContext` uses a copied sample rather than shared scratch
(`animation.ts:725-731`).

The context still contains borrowed actor/vector references; it is not a deep
clone of the actor. Safety here follows the actual numeric admission:
`channelPrograms.ts:73-97` restricts outputs to declared joint transform axes
and forbids mutable recurrence, actor-memory reads and arbitrary callbacks.
The outputs are bound to the scratch bones, not borrowed actor vectors.

The commit closure (`animation.ts:709-722`) only copies prepared transforms,
fixed-length typed arrays and scalar fields, then replaces the FK reference.
It does not evaluate the row, solve FK, validate new input, call combat, step
clocks or write the borrowed vectors. With the owner-created ordinary
Vector3/Euler/Matrix4 storage used by this path, no application-level throwing
operation was found after damage commits.

This is not a general guarantee against tampered trusted objects, arbitrary
custom volume ports or retained/replayed commit closures. The selected caller
consumes the closure once, immediately on the same synchronous stack.
Earlier pipeline admission/modifier/diagnostic hooks are also not rolled back
by this narrow damage-publication transaction.

## Next bounded integrated test

Exercise one explicitly opted-in verified Conch product through the real
`PracticeCreature.create` → enter → fixed/update/late-publication → exit/retry
path, using the actual local combat routing and real admitted decision control.
Do not substitute direct owner construction as proof of this integration.

The bounded scenario should establish:

1. One physics/player advance and one native advance per fixed tick, then
   update-phase weapon damage and the final native-publication slot in their
   real ordering. Include a frame with no fixed tick and one with catch-up ticks.
2. A deliberately refused hit leaves local actor/pose/events and unrelated
   world state unchanged; establish the caller's actual exception handling
   rather than assume a thrown numeric row leaves the playable loop usable.
3. Valid nonlethal and lethal hits publish immediately, produce exactly one
   damage/death receipt and local loot drop, and cannot duplicate rewards on
   later publication/flush. Player defeat still disables the local bout.
4. Exit/retry disposes the old route, decision, motor, hitboxes and listeners,
   then constructs a fresh bout with reset health and transition history.
   World rewards, saves and unrelated actors remain untouched.

This is the next source/integration proof, not authorization to switch public
compositions or bypass the separate app-build/browser admission boundary.

## Remaining gates and limits

The original independent review's integration, complete-animation/contact,
phone performance and public-admission gaps remain open. Whole-owner
historical rewind/resume remains unsupported: pose-envelope restore and fresh
retry do not restore an atomic actor/control/motor/events/health/rewards bout.

This pass ran only the focused four-test file and the independent diagnostic
reproduction. Root's broader 42-test, type, lint and hook results were reported
to the reviewer, not independently rerun here. No implementation edits, Git
operations, app builds, admission changes or publication occurred in this pass.
