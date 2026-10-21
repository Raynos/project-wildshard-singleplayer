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


X4 Nine rule follow-up: the grapple course's checkpoint, start/finish and fall
rules now live in `nine-dragon-stack/behaviour/practice.as` (22 physical AS
lines), requested no faster than 10 Hz. Native code retains measurements,
placement, timer interpolation and HUD presentation; its one-user charge is
retained. Runtime physical TS delta: **shards 0, platform -2**; authored Nine
AS **+22**. The ordinary baker uses the existing 256-line convention (no
existing limit changed), and emits its stateless guest into the named course
JSON. Real route, seeded continuation and 60-render-frame cadence tests pass.


X4 Nalati arena validation follow-up: the defining fight/geometry validators
move to build-only `format/arenaScriptRows`. The existing named-JSON producer
attaches those exact schemas to its existing files; the normal product reader
checks them before returning the typed values. No new data codec or custom
section is introduced, and neither arena behavior nor the remaining one-user
arena charge earns second-user credit. The generic named-JSON host retains its
real users (6/6); the native arena stays charged (4/6).
Runtime physical TS delta: **shards 0, platform -41**. Build-only TS **+55**
(schema +50, converter +4, producer +1); total physical TS **+14**. Native
fight scenarios and producer/read-side malformed-row refusals cover the move.

X4 retained-projection follow-up: `EncounterSchedule` and `ArenaBossScript`
are deleted as state owners. `ProjectedState` in the defining ReturnProgram
module serves real Nalati arena clocks and real Nine grapple practice (not a
fixture). HOST-BAR **111111, 6/6**: two shipping users, no shard identities,
plain numeric rows, renderer-free, needed by either user alone, and no author
callbacks. The shared ten-Hz sampler drops catch-up bursts. Native field grids,
rosters and per-course controllers keep their individual one-user charges.
Runtime physical TS delta: **shards 0, platform -12**; AS and data unchanged.


X4 encounter validation follow-up: the complete patrol, slot, coupled roster,
schedule, field, clock, whirlwind and timed-file schema declarations move to
build-only `format/encounterRows`. Existing named JSON admission checks the
arena and timed files before native allocation; play imports only row types.
Dynamic native slot metadata still rejects non-finite values. Native grids,
rosters and arena presentation keep their one-user charge: HOST-BAR 4/6.
The existing named-JSON host remains 6/6; no grown host earns new user credit.
Runtime physical TS delta: **shards 0, platform -60**. Build-only TS **+73**;
total physical TS **+13**. Data payloads, colliders, AS and ceilings unchanged.


X4 encounter presentation validation: complete SlotViewSchema,
PatrolViewSchema and ArenaFireSchema declarations move to build-only
encounter rows. Existing arena/timed named files reject oversized visual
pools and malformed view rows before allocation. The native drawing code
and its one-user HOST-BAR 4/6 charge remain; the named-JSON host stays 6/6.
Runtime physical TS: **shards 0, platform -40**; build-only **+40**, total
physical TS **0**. No renderer behavior, collider, AS or ceiling changes.


X4 cloud/arena scene admission: complete CloudBodySchema, ArenaSceneSchema
and encounter material declarations move to build-only encounter rows.
Real arena geometry and cloud specimen files carry the defining schemas;
runtime specimens read through product.json instead of parsing raw bytes.
Native meshes, material construction and resource checks retain their
one-user charge (HOST-BAR 4/6); named JSON remains the existing 6/6 host.
Runtime physical TS: **shards 0, platform -31**; build-only **+39**, total
physical TS **+8**. No visual behavior, collider, AS or ceiling changes.


X4 ProductFigureCatalogue: HOST-BAR **111111, 6/6**, with real Pine
`sdk/quest/forestStory.ts` fromProduct and Driftwood
`runtime/boot/blobAssets.ts` constructor/admit callers. The client-only
owner takes product/file ids and scene handles, has no shard branches or
author callbacks, and either live caller needs it independently.
Release only its catalogue, admitted cache and five import lines from
Pine C5: **43 charged Pine lines -> existing shared platform credit**.
Physical runtime source change: **shards 0, platform 0**. Geometry-source,
posed-library and other reviewed chargebacks from sp-x8 remain intact.


X4 Nalati weak-point policy: the existing balbal AS guest evaluates the
three authored crack spheres and strict radius. Native code supplies
body position, scale, lift and orientation basis as numeric observations;
no new host or guest fuel/line ceiling is introduced. The native adapter
retains its one-user HOST-BAR 4/6 charge. Canonical species metadata moves
to build data; the existing baker emits its runtime boot rows and the
nine-line JSON type facade is deleted. All dependent job roots follow.
Physical runtime TS: **Nalati -9, platform -3**; authoring MJS **+11**,
AS **+6**. JSON metadata relocation is not counted as a source deletion.
Root/layer types, typed lint and three focused suites (six tests) pass,
including translated, yawed, scaled and lifted hit comparisons against
the previous geometric calculation. No collider or AS engine changes.


X4 arena position history: delete the complete EncounterTrail native
class. The existing ProjectedState host retains declared numeric slots;
the Titan AS guest owns sample cadence, oldest-first retention, overflow,
selection and exact reset behavior at the existing ten-Hz decision step.
The current twelve positions use 26 channels, below the unchanged 32
output bound. No coordinate quantization or catch-up sampling is added.
ProjectedState keeps its existing real Nalati + Nine HOST-BAR 6/6;
the surrounding arena owner remains charged to Nalati at 4/6.
Physical runtime TS: **shards 0, platform -20**. Build TS **+2**,
authoring MJS **+3**, AS **+51**. Root/layer types, typed lint and three
focused suites (14 tests) pass, including history comparison, delayed
strikes, pause/RNG, reset and the real headless boss fight. No collider,
AS engine, resource bound or budget changes.


X4 support cohort: delete the complete CoupledEncounter, its member/body
interfaces and its separate damage registry/query. Existing ProjectedState
retains each member and the shared cooldown; existing Titan AS still
chooses the member, retirement mask, health chip, steering and damage.
The arena's native body list remains the sole roster. Damage borrows the
existing native species slot and is neutralized at retirement or clear;
no author callback, new host API or additional platform credit is added.
ProjectedState retains real Nalati + Nine HOST-BAR 6/6; the arena and
native damage binding remain charged to Nalati at 4/6.
Physical runtime TS: **shards 0, platform -73**; build TS **0**, AS **0**.
Retire tests of the deleted wrapper; strengthen the actual mounted Titan
fight with authored support health, ranged/melee damage and retired-owner
checks. Root/layer types, typed lint and six suites (22 tests) pass.
No collider, codec, AS engine or resource/budget changes.


G518 Nalati byte repair: the pinned compiler already uses O3 and emits
no names/debug section; keep the compiler/AS engine unchanged. Factor
history observation reads while preserving exact twelve-slot oldest-first
sampling. Pack existing fire laws with existing pasture/wind, while
attack and rules share the other module. The existing eight-module cap,
32-command cap, fuel, memory and AS line ceilings remain unchanged.
Use the existing radial query for sine/cosine facts; retain guest angle
and motion policy and compare 480 steps to the original trajectory.
Remove the unused duplicate Titan generator-export table from the named
fight payload; all native arena and King consumers retain their rows.
Measured Nalati private JSON: **46 / 12,497,444 B**, versus exact
pushed base 62556d91e3 **46 / 12,519,886 B**
(**-22,442 B**). Existing growth policy passes; no budget edit.
Runtime source: **shards 0 / platform 0**; build TS **0**, MJS **0**,
authored AS **+14**. Existing host scores/charges are unchanged.
Root/layer types, typed lint, field/history/RNG/real boss suites and the
emitted Nalati product pass. No collider or visual change.


X4 mounted-course continuation: delete the complete RidingCourseRun
wrapper and use existing ProjectedState directly. The existing Kokpar
AS still owns laps, back-straight admission, reset, falls and records;
Native retains the same ten-Hz cadence, body placement and UI notices.
ProjectedState retains HOST-BAR 6/6 from real Nalati + Nine callers.
The mounted controller remains Nalati-only, HOST-BAR 4/6 and charged C6;
retire only the deleted wrapper's named charge, with all other G520 rows
preserved. Runtime physical TS: **shards 0 / platform -20**; build/AS **0**.
Root/layer types, typed lint and two focused suites (12 tests) pass,
including original and alternate-data AS lap/record/fall sequences.
No collider, data-byte, codec, guest-resource or budget change.


X4 static encounter slots: delete the complete EncounterSlots and its
private actor, member and retirement maps. SlotEncounterView retains the
single real body roster; existing ProjectedState owns each member and
cycle continuation. Existing night AS still decides dusk/dawn, rotating
selection, break, home and retirement. Keep native body placement and
cue order, including the next-day release of corpses retired after dawn.
ProjectedState retains real Nalati + Nine HOST-BAR 6/6. The slot adapter
and its private types remain Nalati-only HOST-BAR 4/6/C4, explicitly
charged despite optional dispatchers. Fixtures grant no second user.
Physical runtime TS: **shards 0 / platform -68**; build/AS/data rows **0**.
This is a physical deletion, not a claim of 68 lines of ruler credit;
the explicit single-user view charge remains in the next census.
Root/layer types, typed lint and five focused suites (27 tests) pass.
Retire wrapper-only fixtures; verify real native duplicate wakes,
variant/home/height joins, one retirement, dawn and late corpse release.
No collider descriptors, visuals, codec, resource bounds or budgets change.


X4 patrol roster: delete the complete EncounterPatrol module and its
second actor/member/group maps. PatrolEncounterView keeps the actual
body roster; existing ProjectedState retains cycle, group and member
continuations. Existing night AS still chooses admission, route,
steering, fades, first/retry firing clocks, kills and dawn dissolution.
Preserve source-ordered borrowed AI draws and the 100 ms decision step.
ProjectedState retains real Nalati + Nine HOST-BAR 6/6. The native
patrol adapter and its types remain Nalati-only HOST-BAR 4/6/C4,
explicitly charged despite optional dispatch. Fixtures grant no credit.
Physical runtime TS: **shards 0 / platform -91**; build/AS/data **0**.
This is physical deletion, not equal ruler credit: the native patrol
view charge remains in the census. Root/layer types, typed lint and
six focused suites (35 tests) pass, including real roster lifecycle, alternate
route/memory/freeze and exact borrowed AI first-clock draw order.
No collider descriptors, visuals, codec, resource bounds or budgets change.


X4 arena lifecycle admission: remove the entire single-user arena-script
bossFight overload and dispatch branch. The real native arena now uses
existing ProjectedState directly from its admitted fight rows. Move the
complete ArenaScriptBossProfile schema from runtime bossProfiles to
the existing build-only arenaScriptRows admission module; preserve every
numeric, key, retained-channel and event bound. The emitted fight data and
AS programs are unchanged; no new native host API is added.
ProjectedState retains real Nalati + Nine HOST-BAR 6/6; the native arena
remains Nalati-only 4/6/C4. Retire only the old runtime schema's named
charge; the schema now runs at the existing product admission boundary.
Runtime TS: **shards 0 / platform -16**; build TS **+12**; AS/data **0**
(**physical source -4** overall). Root/layer types, typed lint and five
focused suites pass, including real boss play, native shared patterns,
named JSON admission and unchanged life/damage/tell/boundary decisions.
No collider descriptors, visuals, resource limits, codec or budgets change.


X4 arena clocks: delete the complete ArenaEncounter wrapper and its
separate landing array and timer. The actual native chain/tell roster
owns each landing continuation; existing ProjectedState samples the
unchanged AS gate at ten Hz. Preserve shared clock reads, source order,
borrowed AI draws, twelve-position trail, delayed landings and reset.
Native arena remains Nalati-only HOST-BAR 4/6/C4, fully charged; no
optional dispatcher or fixture grants credit. ProjectedState retains
real Nalati + Nine HOST-BAR 6/6; no new host API is added.
Physical runtime TS: **shards 0 / platform -20**; build/AS/data **0**.
Remove wrapper-only clock fixtures; strengthen the actual mounted Titan
fight with sub-step RNG, paused RNG, exactly seven delayed strikes and
reset cancelling pending strikes, then retain both full victory traces.
Root/layer types, typed lint and five focused suites pass.
No collider descriptors, visuals, codec, resources or budgets change.
