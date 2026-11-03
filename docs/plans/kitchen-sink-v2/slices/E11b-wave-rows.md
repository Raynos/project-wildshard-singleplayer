# E11b: wave rows (group counters, sealed courts, an elite spawned by a stage)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs the wave-director stage script
of the old **W3** ("add a wave-director stage script beside `course.as`"), **EBW7**'s director half (an elite spawned by
a stage, not only from its lair) and the gauntlet's use of **DG1 / DG2** (E10b's sealed rooms as "courts").

## 1. The showcase piece

A **one-court wave test** in the gauntlet forecourt (round 5 `08F`): stand on the run board, a 3-wave run starts, the
court's gate shuts behind you, each wave pours from two spawn doors, the next wave starts on the last kill, the gate
ahead opens after the last wave, a death restarts the court. It becomes C1 in E11c.

## 2. Engine / game / host work, just in time

Research:

- Stage actions: `spawn`, `despawn`, `flag`, `score`, `weather`, `toast`, `reward`, `emit` (`src/format/directorStages.ts:8-14`);
  inputs: `flag:`, `zone:`, `event:`, `actor:<id>.dead|present`, `day:a..b`, at most 16 (`:6`, `:19`). **No group
  input**: "all of wave 2 is dead" can't be read; the template fakes it with one flag.
- A `{ spawn: key }` places a declared spawn; elites only come from their lairs on a timer (`eliteFeature.ts`).
- E10b adds sealed rooms with a `group:<id>.cleared` input.

Work:

| Row / mechanic | Shape | Layer |
|---|---|---|
| group input | `group:<id>.cleared` and `group:<id>.alive` (a count) as stage input bindings | format `directorStages.ts` binding regex + game stage lane |
| wave group | `{ spawn: <group id> }` spawns every member of a declared group at its doors | format + game |
| elite stage spawn | `{ spawn: <elite id> }` for elites declared `spawn: 'stage'` (E8a) | game |
| court | the gauntlet's courts are E10b rooms (seal on enter, reset on death) driven by one run director | data |
| run timer | the director's start and finish feed W3a's records (the run board's best time) | data |

Host bar: director stages are shared (Nine, Sky, Signal, template); new bindings are additive. Guards: the 16-input cap
holds (a 5-wave run uses ~8). Tests: `test/director-*.test.ts`; new `director-group-input.test.ts`.

## 3. Other shards in this slice

None of the four stage users declares a group binding; their directors replay unchanged (E11a's replays rerun). The
template's `door-wave` can switch to a group input (optional, Q1).

## 4. Done when, hours, blockers

**Done when:** the 3-wave test court runs start to finish, seals and reopens, restarts on a death, records a best
time; other directors replay unchanged.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 10 h (Codex) | 2 h | 2 h | **14 h** |

**Blockers:** E11a, E10b, E8a (stage elites).

## 5. Risks

- A wave spawned by a stage must not join the band respawn queue (E1c); stage spawns are never returnable.

## 6. Questions for Jake

1. **The template's door-wave example.** (a) rewrite it on the group input (the clean example for new shards); (b) leave
   it. **Recommended (a):** the template is where new shards copy from; 1 hour.
