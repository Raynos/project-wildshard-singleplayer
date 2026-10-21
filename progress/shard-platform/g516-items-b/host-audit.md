# G516 items B: host audit

The six columns follow [HOST-BAR](../../../docs/HOST-BAR.md): real users, no
shard nouns, rows, server-safe/client-labelled, deletion test, data-only API.
Fixtures grant no second-user credit (G518). Zeroes below remain chargebacks.

| Host | Tests 1–6 | Score | Evidence / disposition |
|---|---|---|---|
| Held bow, `game/weapons/heldLauncher` | 111111 | 6/6 | Pine's `HeldEquipment.bow` and Nalati's `MountedArsenal.build` load different real bow rows. Whole module moved out of plugin/. |
| Crossbow action in that module | 011101 | 4/6 | Only Pine declares the launcher slot (`src/shards/pine-hollow/data/loadout.json:19`); Nalati's mounted page creates a rifle, not a crossbow. Tests 1 and 5 fail: deleting Pine removes this action's sole live user. Obsolete pending Nalati bolt-flight credit removed. |
| `game/weapons/bowVariant` | 011101 | 4/6 | `src/game/boss/arenaRoom.ts:600` creates the power for Nalati's boss reward; no second shard declares a variant. Tests 1 and 5 fail; charge to Nalati C6. |
| `game/loadout/mounted` | 011101 | 4/6 | `src/shards/nalati-grasslands/weapons/nativeMelee.ts:11` creates the only arsenal. Tests 1 and 5 fail; charge to Nalati C6. |
| `game/practice/ridingCourse` | 011101 | 4/6 | Only `src/shards/nalati-grasslands/data/practiceCard.json:3` declares the horse course. Tests 1 and 5 fail; charge to Nalati C6. |
| `engine/combat/Thrown` | 011100 | 3/6 | `src/game/weapons/heldPolearm.ts:146` is the sole live constructor (Nalati). Tests 1 and 5 fail; protected subclass hooks at `src/engine/combat/Thrown.ts:15` also fail test 6. Charge to Nalati C6. |
| `engine/combat/thrownProfile` | 011101 | 4/6 | Only the same live polearm consumes this profile. Tests 1 and 5 fail; charge to Nalati C6. |
| `engine/player/firstPersonArms` | 111111 | 6/6 | Pine hands and Nalati recurve/sabre/spear bakes supply explicit JSON styles. The legacy path is a small frozen-import adapter until NEXT N5, with no copied geometry implementation. |
| Native swept melee via `game/plugin/nativeItems` | 111111 | 6/6 | Driftwood native swords and Nine Jian declare real swept policies. The shared native clock owns queue, combo and heavy continuation. Nine's custom 60 Hz module is deleted; old single-clock saves migrate. |

Physical TS deltas by cut (generator code is build-time, not custom runtime):

| Cut | Pine | Nalati | Nine | Platform |
|---|---:|---:|---:|---:|
| Launcher move / pending credit | 0 | 0 | 0 | -1 |
| Honest item chargebacks | 0 | 0 | 0 | 0 |
| Explicit arms styles / legacy adapter | -4 | +2 | 0 | -4 |
| Native Jian adoption | 0 | 0 | -52 | +8 |

Chargebacks change attribution, not physical source size. The SDK allocation
comment used for the separate G548 timing case is outside this ledger.


X4 follow-up: the original riding and grapple room modules are deleted.
`game/practice/course` now shares the native `PracticeCourse` lifecycle:
real Nalati horse rows (`data/practiceCard.json`) and Nine grapple rows
(`data/practiceCard.json`) enter through `practice/registration.ts`. The common
lifecycle scores **111111, 6/6**: two real courses; no shard identity;
JSON layouts; explicitly client-only; either course still needs the room
without the other; concrete page services, no authored hook API.
`MountedCourseController` and `RidingCourseRun` remain **011101, 4/6**,
charged to Nalati; `HookCourseController` and its pad helpers remain
**011101, 4/6**, charged to Nine. The dispatcher grants neither a second
user. Their continuation and timing behavior is retained for later X4 cuts.
Runtime physical TS delta: **shards 0, platform -63**. The registry receives
the same scene rows, collider descriptors and surface for each course.
Focused checks cover live entered-mount reuse, repeated room entry/exit,
grapple hook transforms, the mounted guest and separate controller charges.
