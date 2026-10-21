# Keelmaw rigid-held WIP: rejected physical candidate

This bounded prototype is not admitted to the model/public catalogue and is not
quality 4. It holds a lethal pose; it is not articulated collapse. Its explicit
collision policy remains DEBRIS versus WORLD only, not a player/creature/item
obstacle. Seven source-derived convex support groups (459 points) bridge
concavities and are **not exact occupied geometry**.

The source is the unchanged pinned `../keelmaw-native-owner/grounded` payload,
producer, native attacks and seven support groups. No source, original animated
negative study, floor/root, solver, CCD, impulse, inertia descriptor, or budget
was changed. The opt-in changes only local-pose ownership, initial WORLD overlap
preflight, and lifetime retention of the real dynamic root/reservation.

## Result: strict 5 mm floor gate fails in all four phases

`../keelmaw-rigid-held-contact.json` contains activation and every fixed sample
through tick 480, including alpha 0 / .5 / 1 renders of original source and actual
packed skin, actual native collider vertices, root endpoints, and sleeping state.

| Phase | Lowest native hull Y | Lowest original Y | Lowest packed Y | Worst tick | First sleeping tick |
|---|---:|---:|---:|---:|---:|
| idle | 899.9584109835848 | 899.9584201990548 | 899.9584201999687 | 123 | 173 |
| windup | 899.993266484898 | 899.9932407062059 | 899.9932407065145 | 121 | 161 |
| active | 899.9687004851424 | 899.9687001110846 | 899.9687001117540 | 122 | 165 |
| recover | 899.9491204145061 | 899.9491039827508 | 899.9491039839933 | 123 | 164 |

The floor is Y=900; acceptance requires every observed point Y >= 899.995.
No contact samples were rounded, averaged, skipped at first impact, or corrected.
The branch stopped after this four-phase result. Wall/edge dynamics were not run.
Initial WORLD obstacle refusal is covered separately, including a current-transform
obstacle moved after broadphase synchronization.

Seven new tests passed. The eighth intentionally remains a **failing acceptance
gate**, preserving the physical rejection rather than presenting a passing study.
All 82 existing tests across native resource, practice corpse, and rooted Pitcher
regression files passed in the initial run (88 total passing including six new).
Later lifecycle coverage verifies sleeping and waking preserve one occupied slot
and a live dynamic owner; explicit disposal removes the body and releases once.

The first two runs exposed test representation comparisons, not physical tuning:
Euler zero sign, then quaternion/Euler round-trip differences (~2.1e-17 observed
in that failure). The final test checks exact captured numeric joint records each
tick and rendered local values with decimal precision 12 (Vitest tolerance
5e-13). It did not separately record the measured maximum render representation
error. This tolerance does not apply to the physical 5 mm gate. Actual packed
weights are checked as rigid single-bone ownership; packed/original sampled world
minimum agreement is checked separately within 1e-5.

The initial mass/inertia telemetry is read before Rapier's first step and reports
zero deferred properties. It is not a measured post-step mass/inertia proof.
The production body descriptor is reused unchanged, and initial velocity/spin are
checked against that descriptor. No claim of completed wall/edge or mass proof is
made after this rejected candidate.

The three logs preserve both representation failures and the final physical
failure. Run with installed binaries and the canonical heavy lane:

    WS_HEAVY_ROOT=$PWD/tmp/heavy-lanes WS_VITEST_MAX_WORKERS=1 python3 scripts/heavy-lane.py build -- node_modules/.bin/vitest run test/keelmaw-rigid-held.test.ts
