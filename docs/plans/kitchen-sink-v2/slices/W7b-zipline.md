# W7b: the 99 m zipline over the town wall

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the zipline line of the old
audit ("Zipline is shared (Driftwood and Pine, `engine/sim/cableTraversal`)") with its Driftwood generator moved to the
SDK.

## 1. The showcase piece

The **zipline** from the tower's top deck to the zip-house roof: 99 m on plan, 103 m of cable, about 4.7 s at 22 m/s,
over the town wall; the finish pad of the grapple time is on the zip-house roof (the W7a course's last checkpoint).
Gold ●10 waits on the roof (W9b).

## 2. Engine / game / host work, just in time

Research:

- **The zipline is already a row:** `src/format/modes.ts:11` `ZiplineModeSchema { kind: 'zipline', id, top, bottom, … }`,
  one of three traverse kinds (`modes.ts:54`: zipline, updraft, ladder). The law is `src/engine/shared/sim/cableTraversal.ts`
  (286 lines, client and headless).
- **The cable look is a Driftwood generator:** `src/shards/driftwood-isle/generators/ziplineCable.ts` (45 lines) builds
  the cable's geometry; Driftwood's quest host starts the ride with a `cable` command (`out/driftwood-isle/sections/
  quests/host.json`: `{ cable: 'driftwood.zipline', command: 'start' }`), so the start prompt goes through the quest
  page. Pine's zip cable is a piece of its forest page (`generators/forestPage.ts:65` `timbers.zip-cable`).
- The same quest-page gate as W7a applies (`shardSchema.ts:285`).

Work:

| Row | Shape | Layer |
|---|---|---|
| cable look | the zipline row gains `look: { cable, sag, towers? }`; the SDK bakes the cable mesh (Driftwood's generator moves to `src/sharddev/bake/`) | sdk bake + format |
| start prompt | the zipline row's own `prompt: { at, radius, label }` (no quest-host command needed) | game reader |
| finish | the zipline's bottom is a course checkpoint (W6d) | data |

Host bar: zipline already 2 users; the bake moves from a shard to the SDK (deletes shard code). Tests:
`test/cable-traversal.test.ts`, `test/driftwood-zipline-cable.test.ts`, `test/driftwood-zipline-verbs.test.ts`,
`test/quest-cable-entry.test.ts`.

## 3. Other shards in this slice

| Shard | Today | Migration | Deleted | Proof | Save risk |
|---|---|---|---|---|---|
| Driftwood | zipline row + `ziplineCable.ts` + quest-host `cable` command | cable baked by the SDK from the row; prompt from the row; the quest command kept as an alias until its quest step reads the row | `generators/ziplineCable.ts` | the zipline tests above; ride it in game, before/after capture (Opus) | low (the ride is transient; the quest flag `quest.zipline-riding` unchanged) |
| Pine Hollow | zip cable inside the forest page | none now (it moves with the forest page, W9a/W11a) | — | — | — |

## 4. Done when, hours, blockers

**Done when:** from the tower deck you ride the zip over the wall onto the zip-house roof and the grapple clock
finishes; Driftwood's zipline looks and rides the same.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 8 h | 6 h | 4 h | **18 h** |

**Blockers:** W7a.

## 5. Risks

- A 103 m cable over the town wall must clear the wall-walk and the roofs at its sag; the bake checks clearance against
  colliders (a validator line).

## 6. Questions for Jake

1. **Zip both ways?** (a) one way, tower → town (today's law is top → bottom); (b) a return line. **Recommended (a):** the
   grapple course is the way back up.
