# Host-bar scores: three landed platform commits

Scored against docs/HOST-BAR.md (six tests). Read-only audit of the tree as of c4825d0f8. Line numbers are the
current files. Where a commit mixes good and weak modules, the score is for the commit as a whole and the weak module
is named.

## 1. 4f3e3aa2d quest step runner, slice one: 4 / 6, Borderline

| # | Test | Score | Evidence |
|---|---|---|---|
| 1 | Two real users | 1 | G474/G475 approved. Runner has two users (pine-hollow/quest/index.ts:308, driftwood-isle/quest/adventure.ts:149). lead.ts, chapter.ts, killSteps.ts, hints.ts tagged in lint/platform-pending-users.json (approvedFeature quest-step-runner, rechecked-by end of W3). |
| 2 | No shard nouns | 1 | grep of src/format/questSteps.ts and src/game/quest/{steps,chapter,lead,killSteps,hints}.ts finds no shard names or ids. (lead.ts:20,34 say "apparition" and "night"; see test 3.) |
| 3 | Data-driven | 0 | src/game/quest/lead.ts:5-56: the stare / trot / gone state machine, the "ran past it along the road" rule (:42-43) and the "beat is current and it is night" gate (:34) are Pine's stag walk in a generic coat. src/game/quest/chapter.ts:39-61 and :75: `QuestChapterWorld` / `QuestChapterPorts` are shaped like Driftwood's spine (`drops`, `system`, `deaths: unknown`, hard-coded `sting('chunk')`). |
| 4 | Server-safe or labelled | 1 | steps.ts, lead.ts, killSteps.ts take no DOM or three (killSteps is in Driftwood's headless modules). chapter.ts and hints.ts are client presentation (three, FirstHints, ShardContext) and their docs say so. |
| 5 | Deletion test | 1 | The step runner, kill steps and hints stay if Driftwood vanished. lead.ts would not (counted under test 3). |
| 6 | Data-only API | 0 | src/game/quest/steps.ts:14-22 `QuestStepPorts` is a port object with TS callbacks: `calls: ReadonlyMap<string, (signal) => void>`, `position()`, `notice()`, `actors` as a function. Shards pass closures: pine-hollow/quest/index.ts:308 `calls: new Map([['trader', tradeOwner.open]])`. The `call` effect (questSteps.ts:10) is `{owner: name}` reflection into a shard callback. chapter.ts:84-89 `figures` (`create`, `own`, `at`, `advance` closures) and chapter.ts:94 `calls`. killSteps.ts:14-15 takes `roster()` and `fact()` callbacks. |

Fixes:
- Test 3: move the lead walk into AssemblyScript plus a generic "follow path" Script ABI command, or keep lead.ts as Pine view code until a second shard has a lead. Split chapter.ts into row-declared pieces (no `drops` / `system` / `'chunk'` parameters).
- Test 6: replace `calls` and the `call` effect with Script ABI command ids (a script reference, as HOST-BAR says). Replace `position`, `notice`, `inventory` and `actors` with host-owned services named by id, not lent closures.

## 2. 78820910c native actor lifetimes and population: 3 / 6, Borderline

| # | Test | Score | Evidence |
|---|---|---|---|
| 1 | Two real users | 1 | G474 actor-spawn approved. RespawnQueue is used by Driftwood and Pine. roster, waves, shelter, actors, nativeWaves, pageWaves and the sdk/population* facades are tagged pending (shard nalati-grasslands, rechecked-by end of W3). |
| 2 | No shard nouns | 0 | src/format/populationWaves.ts:6 `mill: {x, z}`, :7 `race: [...]`, :14 `raceRange`, :44 voices `call / wake / flee`: Pine's millrace night encounter fields. src/game/population/waves.ts:30-31, 35-36, 45-46, 49-57 `roam`, `race`, `roamer`, `racer`, `'roam.dawn'`. pageWaves.ts:44 `tags: ['night']`. |
| 3 | Data-driven | 0 | Same lines: the wave spec is one shard's encounter shape (region / exclude / face / mill / race with `actorLimit` 8 and `raceRange`), not rows two shards differ on. waves.ts:49 hard-codes `tuning.actorLimit > 8`. pageWaves.ts reads `rule.label`, `rule.tint`, `rule.fallback`. |
| 4 | Server-safe or labelled | 1 | roster.ts, waves.ts, respawn.ts, nativeWaves.ts run in the headless host. pageWaves.ts (app runtime, three, Animal) is the named client "page" owner. |
| 5 | Deletion test | 1 | roster, respawn, shelter and actors stay if Pine vanished. waves.ts / pageWaves.ts would not and, scored alone, would be roughly 2/6 (a Silly candidate). |
| 6 | Data-only API | 0 | src/game/population/respawn.ts:25 `protected takeAt` is a subclass override seam, used by driftwood-isle/quest/Ecology.ts:21-24 `PageRespawnQueue extends RespawnQueue`. waves.ts:16-23 `PopulationWavePorts` (night, errand, onErrandDone, shot, spawn, own, release, retire, burst callbacks). nativeWaves.ts:11-18 `NativePopulationWavePorts` (night, heightAt, spawn, retire, find). roster.ts:20-30 `PopulationRosterPorts` (`wanderGoal`, `poses.attach / retire` callbacks). |

Fixes:
- Test 2 and 3: pull the wave director back to Pine as AssemblyScript plus Script ABI spawn / retire commands. What stays in the game layer is a generic "scheduled spawn / retire at a place" row (kind, point, gate flag, count). Drop `mill`, `race` and the roam/race pair.
- Test 6: delete the `takeAt` override seam. Give RespawnQueue a row field for traversal order (reverse or forward) so Driftwood's page queue needs no subclass. Turn the port interfaces into host-owned services addressed by id.

## 3. a29bc1c05 toon arms, held-arms host: 5 / 6, Borderline (fails only test 6)

| # | Test | Score | Evidence |
|---|---|---|---|
| 1 | Two real users | 1 | G475 approved feature `held-arms`; tagged in lint/platform-pending-users.json (shard pine-hollow, row G477, rechecked-by end of W3). Only Driftwood uses it today (driftwood-isle/runtime/fpArms.ts:20, :17). |
| 2 | No shard nouns | 1 | grep of src/format/heldArms.ts and src/game/systems/viewmodel/toonArms.ts finds no shard names. Mesh names `sword_wood` / `sword_iron` (toonArms.ts:109,125) are the rig protocol, a Wildshard concept. |
| 3 | Data-driven | 1 | All differences are in `ToonArmsLookSchema` (url, skeleton, sockets, joints, offset, frame, swim, materials). Watch item: the look is fixed to wood plus iron plus swim (heldArms.ts:20); a shard with another loadout needs the schema widened. |
| 4 | Server-safe or labelled | 1 | Client-only presentation (three, Sky, onBeforeRender), under game/systems/viewmodel; the header documents it. |
| 5 | Deletion test | 1 | First-person sword arms are a Wildshard viewmodel; kept if Driftwood vanished. |
| 6 | Data-only API | 0 | src/game/systems/viewmodel/toonArms.ts:48,60 `ToonArmsRigs` is an injectable loader port ("also permits renderer-free fixtures"). :34-45 `ToonArmsLooks` / `ToonArmsLight` lend live Material maps, a `setParam` callback and the live day uniforms. :70 `lend(looks, light)` is called from shard TS (driftwood-isle/runtime/index.ts:74 `lendCastawayArms(arms, { source: toonState().dayLight, target: arms.toon.uniforms })`). Shard TS (fpArms.ts:17-22) constructs the class and calls it per frame. This is a TS class driven by the shard, not rows and ids. |

Fix:
- Test 6: have the host resolve materials and day uniforms itself from the admitted `ToonArmsLook` ids (catalogue and day-clock services it already owns), and expose a manifest entry the boot assembly installs from the row. Then fpArms.ts and `lendCastawayArms` disappear. Remove the `rigs` constructor parameter and test with a fixture asset instead.

## Summary

| Commit | Total | Verdict |
|---|---|---|
| 4f3e3aa2d quest step runner | 4 / 6 | Borderline |
| 78820910c native actors and population | 3 / 6 | Borderline (waves module alone is Silly) |
| a29bc1c05 toon arms | 5 / 6 | Borderline (fails test 6 only; no test 1 relief applies) |
