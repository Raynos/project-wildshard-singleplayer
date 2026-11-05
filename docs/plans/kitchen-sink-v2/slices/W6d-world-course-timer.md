# W6d: a timed course in the world (the movers time), shared by every west course

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the "course timer" of the old
README rows W7/W10 and the old **W8** (riding course docs and a template example), done once here for the first timed
course (the movers run) and reused by W7a (grapple) and W10b (riding).

## 1. The showcase piece

The movers run's start pad and PB board: step on the pad, the clock runs, touch the six stations' checkpoints in order,
finish on the tank roof; the board shows best and last (W3a records, lower is better); a fall resets you to the last
checkpoint with the clock running.

## 2. Engine / game / host work, just in time

Research:

- **The course law is shared AS**: `src/commons/scripts/course.as` with `courseProgramInputs(kind: 'oval' | 'checkpoints')`
  (`src/commons/courseProgram.ts`): state `lap, started, running, half, best, last, … checkpoint, visited`, 11 pads
  (`pad00…pad10`, each `X, Z, Width, Depth, Top, Yaw, Pitch …`), signals `reset, step, restart`. Built by
  `src/commons/practiceCourse.ts` `buildCourseProgram`.
- **The host only runs in a playground room.** `src/game/client/practice/course.ts` (154 lines) `CourseController`: `kind:
  'horse' | 'grapple'`, built on `engine/client/practice/playground/Playground.ts` (a dev room at y 3000, its own grey scene:
  `format/practiceCourseRows.ts` box / plane / wall / label / checker / mesh rows), imports `ShardContext` from
  `game/plugin/context` and the `GrappleTool` by `instanceof` (`course.ts:45-48`). Users: Nalati (riding,
  `generators/courseScene.ts`, `kokparProgram.ts`) and Nine (grapple), both from the Explore hub.
- Best is in memory only (`numericCourse.ts:11`).

Work:

| Row / host | Shape | Layer |
|---|---|---|
| `world/courses` | `[{ id, law: 'checkpoints'|'oval', start: pad, pads: [box…] (≤ 11), finish: pad, fall: { below, reset: 'checkpoint'|'start' }, record: <records id>, mount?: 'horse', tool?: <item id> }]` | format + game: the controller runs at world coordinates, no room, no playground chip; the HUD clock is the existing playground chip moved to a shared HUD slot (E332) |
| one controller | the playground path becomes the same controller with `placement: 'room'` | game `practice/course.ts`, off the plugin context; the tool found by item id, not `instanceof` |
| records | the course writes `best/last` to W3a's records | game |

Host bar: the course host has Nalati and Nine as users and the showcase as the third; after this slice it scores 6/6
(no plugin context, no class check, data-only). Guards: `shard-game-plugins` ratchet, E332 for the clock chip. Tests:
`test/course-differential.test.ts`, `test/practice-course-admission.test.ts`, `test/practice-controller-rows.test.ts`,
`test/practice-course-scene.test.ts`, `test/nine-practice-law.test.ts`, `test/nalati-practice-verbs.test.ts`,
`test/nalati-course-binary.test.ts`; new `world-course.test.ts` (start, checkpoints in order, fall reset, record).

## 3. Other shards in this slice

| Shard | Today | Migration | Proof | Save risk |
|---|---|---|---|---|
| Nalati | riding playground (oval law) | same rows under `placement: 'room'`; bests to records if W3a Q3 says so | `test/nalati-course-binary.test.ts`, `test/course-differential.test.ts` (same lap times from a scripted ride); one lap in the Explore room | none (new key only) |
| Nine Dragon | grapple playground (checkpoints law) | same; the tool by item id `tool.fei-zhua` | `test/nine-practice-*.test.ts`; one run in the room | none |

## 4. Done when, hours, blockers

**Done when:** the movers run is a timed course from pad to roof with checkpoint resets and a saved PB on its board;
Nalati's and Nine's Explore rooms run the same laps and times.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 14 h (Codex; Opus HUD chip) | 8 h | 4 h | **26 h** |

**Blockers:** W6a, W6b, W6c (the stations exist), W3a (records).

## 5. Risks

- 11 pads is the AS law's ceiling (`pad00…pad10`); the movers run needs 6 checkpoints plus start and finish (8), the
  riding course 8 rings + start (W10b, 9). Enough, but no headroom for a longer course without an ABI change (don't
  run H13).

## 6. Questions for Jake

1. **A fall mid-course.** (a) back to the last checkpoint, clock keeps running; (b) restart from the start pad.
   **Recommended (a):** the run stays a run and the time still tells.
2. **Where the course clock shows.** (a) the existing playground chip, moved to a shared HUD slot under the minimap;
   (b) on the world board only. **Recommended (a):** you need the clock while running; it shows only during a run.
