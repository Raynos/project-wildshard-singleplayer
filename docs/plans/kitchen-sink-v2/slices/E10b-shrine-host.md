# E10b: the shrine host (sealed rooms, room checkpoints and resets, the shrine card and best time)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs **DG1** (sealed room: doors lock
on entry, a wave counter, unlock on the last kill), **DG2** (room checkpoints: a room volume becomes the respawn point;
a death resets that room's fight, keeps puzzle flags), **DG3** (the shrine completion card + best time, reusing the
shard-complete card's layout and the course timer) and **DG4** (the `shrine` composition rows and a template example).
**DG5** (Driftwood's sea cave as the second user) is Q1. The gauntlet (E11c) is the second showcase user of DG1/DG2.

## 1. The showcase piece

The Vault's entry hall (E10a) gets one **sealed test room**: walk in, the doors lock, two small waves of Mites, the doors
open on the last kill; die inside and you respawn at the room's entry with the fight reset; a puzzle flag set in the
room stays set. The run timer starts at the portal and a **SHRINE COMPLETE** card (time, deaths, rooms) shows at the
end, with the best time on the entrance plate.

## 2. Engine / game / host work, just in time

Research (the mini-dungeon plan's table, re-checked):

- Doors on flags exist (`DoorDef.opensWhen`, `latch`, `src/engine/world/interact/types.ts:163-171`). Spawns on stages
  exist (director stages v2 `{ spawn }` / `{ despawn }`, `src/format/directorStages.ts:9`; the template's
  `template.door-wave` director, `out/_template/sections/quests/directors.json`). **No "doors shut until the wave is
  dead"**: the template wires its wave with a flag (`waveDead: flag:template.blob`), and stage inputs see one actor
  (`actor:<id>.dead`), not a group.
- Respawn is `LastPlace` (`src/game/LastPlace.ts`: the last named place you reached; no volumes, nothing resets).
  `death.checkpoint` answers (`PlayerHealth.checkpoint`, `health.ts`) let an encounter claim a death.
- The completion card: `src/format/completion.ts` (83 lines) + `src/game/complete/`; one per shard. Records and the
  course timer: W3a (`ui/records`), W6d (in-world course host).

Work:

| Row / host | Shape | Layer |
|---|---|---|
| sealed room | `rooms: [{ id, volume, doors: [ids], waves: [{ spawns: [ids], count }], seal: 'on-enter' }]`: entering locks the doors, waves run in order, the last kill unlocks; a group input `group:<id>.cleared` for directors | format (shrine rows) + game `src/game/shrine/room.ts` (new) |
| room checkpoint | a room is a respawn volume while you're in it (a `death.checkpoint` answer); a death despawns the room's live wave and resets its stage; flags set by plates / levers stay | game |
| run + card | `shrine: { id, entrance, exit, par, rooms: [ids], reward, card }`: a run timer from the entry portal, deaths and rooms counted, the card on finish (the completion card's layout, a second card kind), the best time into records | format + game; the card is shared UI (E332 notice) |
| template example | a two-room shrine in `src/shards/_template/` | data |

Host bar: one real user (the showcase's Vault, then its gauntlet) until DG5: needs G595 approval (Q1). Guards:
`engine-words` (no "shrine" in engine), E332 for the card. Tests: new `sealed-room.test.ts` (seal, waves, unlock, the
`group:` input), `room-checkpoint.test.ts` (death resets the fight, keeps a puzzle flag), `shrine-card.test.ts`.

## 3. Other shards in this slice

| Shard | Touched | Proof | Save risk |
|---|---|---|---|
| Template | gains a shrine example (and keeps `template.door-wave`) | `wildshard validate`, `test/scripts/_template-boss.test.ts` | none |
| Driftwood (if Q1 a) | its sea cave becomes a two-room shrine | DG5: a cave walk, its fight and its tide puzzle replay unchanged | low |

## 4. Done when, hours, blockers

**Done when:** the test room seals, runs two waves and opens; a death inside resets only that room; the run's card and
best time show; the template's example validates.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 24 h (Codex; Opus 4 h for the card) | 8 h (template 2 h; DG5, Driftwood's sea cave, 6 h if Q1 a) | 4 h | **36 h** |

**Blockers:** E10a, W4a (doors), W3a (records), E1c (Mites).

## 5. Risks

- Room resets and the population's respawn queue both own spawned bodies; a room's waves must be stage spawns outside
  the band respawn rules (no double return).

## 6. Questions for Jake

1. **Approve the shrine host as platform (G595), and its second user.** (a) approve it now with Driftwood's sea cave
   (DG5, ~6 h) as the second user in this slice; (b) approve it with the gauntlet as the second user (same shard);
   (c) showcase-only for now. **Recommended (a):** a same-shard second user doesn't pass test 1, and Driftwood's cave is
   the plan's named candidate; it adds 6 h here.
