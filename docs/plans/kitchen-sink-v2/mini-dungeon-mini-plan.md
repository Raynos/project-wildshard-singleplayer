# Mini plan: the mini dungeon / shrine room and the Training Vault

Parent: [KITCHEN-SINK.md](../KITCHEN-SINK.md). Page for Jake: [Mini Dungeon / Shrine
Room](https://claude.ai/artifact/QT7U953tYyBPBKHA7RrVDQ), mockups in `art/showcase-template/round-2-mini-dungeon/`
(48e89d8d3e). The idea comes from GW2-ZONES §7.1 (a Zelda shrine or Destiny Lost Sector: one ~10 minute challenge).

## Decisions (Jake, 2026-11-02, E523)

1. **The Training Vault is the kitchen sink's mini dungeon:** four rooms and a mini-boss behind its portal, in the
   **east (combat) half**. A shared dungeon host joins Wave 1.
2. **Dying restarts the room you died in.** Solved puzzles stay solved; the fight or mini-boss restarts; no lives
   limit, nothing lost.
3. The Vault Warden is the **level-12 mini-boss** (levels mini plan).

## The run

1. **Entrance:** a walk-in portal with a plate showing rooms, rough time and best time ("4 ROOMS · BOSS · ~10 MIN").
2. **Puzzle room:** two pressure plates, a crate to push, a door that opens when both plates are held.
3. **Fight room:** the doors seal, two or three small waves, the doors open when the last enemy dies.
4. **Climb room:** a ladder, scramble blocks, a rope bridge and a lift to the last door.
5. **Mini-boss:** the Vault Warden (L12), a boss bar, telegraphs, two phases.
6. **Reward and exit:** a chest (pays once), a "SHRINE COMPLETE" card (time, deaths, rooms), the exit portal back.
   Replays are a time trial against your best.

Each room is its own checkpoint. The interior sits under the cell (0 m² of surface, map-layout mini plan).

## In other shards (later, same rows reskinned)

| Shard | Shrine | Today |
|---|---|---|
| Driftwood | the sea cave: tide puzzle, the wreck hold fight, the rope walkway; the Drowned Sailor | two separate places |
| Nalati | the kurgan: a stone-door puzzle, balbal guards; the Golden King | the boss room only |
| Pine Hollow | the bear cave: a lantern puzzle, a log bridge, a ladder; Old Blackpaw | the cave interior exists |
| Nine Dragon | the Yamen Well: gong plates, a jiangshi gallery, a lift down | walkable, no enemies yet |

Driftwood's sea cave is the recommended second real user for the host bar.

## The shrine host (game layer, rows only)

Rows: `shrine` (name, entrance, exit, par time) · `rooms` (volume, checkpoint, kind) · `doors` (opens on a flag) ·
`plates` and `pushables` · `waves` (room, spawn table, count) · `miniBoss` (boss profile, room) · `reward` (loot, once)
· `completion` (the card's fields, best time).

| Piece | Today | Row |
|---|---|---|
| Portal in and out | walk-in portal rides | exists |
| Interior rooms | cave interior (Pine) and arena room (Nalati): two hosts | W15 unifies |
| Doors on flags | quest flag gates, building doors | exists |
| Ladder, rope bridge, lift | exist (scramble is W18) | exists |
| Mini-boss | boss host and elites | W11 |
| Chest | loot bag rows | W16 / LE |
| Pressure plates + pushables | engine `PlateDef`; puzzle logic only in Driftwood's AS | W2, W3 |
| Sealed wave room + counter | spawn tables exist; "doors shut until the wave is dead" doesn't | **DG1** |
| Room checkpoint + reset | LastPlace knows named places only; nothing resets a room | **DG2** |
| Shrine card + best time | the complete card is one per shard; a run timer exists in practice courses | **DG3** |

## Rows

| Row | What | h |
|---|---|---|
| DG1 | Sealed room: doors lock on entry, a wave counter, unlock on the last kill (rows + commons AS) | 10 |
| DG2 | Room checkpoints: a room volume becomes the respawn point; a death resets that room's fight, keeps puzzle flags | 12 |
| DG3 | Shrine completion card + best time, reusing the shard-complete card's layout and the course timer | 8 |
| DG4 | The `shrine` composition rows tying portal, rooms, doors, plates, waves, mini-boss, reward and card together; a template example | 8 |
| DG5 | Second user: Driftwood's sea cave as a shrine (with Jake's OK, G595) | 6 |
| K5 | Wave 2: the Training Vault built on DG1–DG4 | 2 d |

## Open

- The Warden Core reward powering the storm beacons is the page's suggestion; quests are freeform now, so it may become
  a plain reward. Decide with the quests work.
