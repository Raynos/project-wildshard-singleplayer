# W9b: vistas, caches, the Gold 1×1s, FINDS and the west feats

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the west part of the old
**W16** ("finds `every: N` → perk rows"; benches, secrets, perks, feats), **LE9**'s collectible half (the trophy wall's
frames wait for the east's elites), and **M9.1** (Driftwood's collections), **M9.2** (feat rows, the west's), **M9.4**
(Nalati's finds) where the rows they use change.

## 1. The showcase piece

| Item | Count, where (round 4 census) | Rows |
|---|---|---|
| Vistas (bench views) | ★1 Rock lookout, ★2 tank roof, ★3 tower top, ★4 NW corner, ★5 SW corner, ★6 east gatehouse roof | `bench` interactables + named places; sitting pans a framed view and marks the vista found |
| Hidden caches | ◆1 behind the oval, ◆2 behind the Rock, ◆3 hover/physics alley, ◆4 north wall | `chest` interactables with fixed contents: a cosmetic each (no Scrip: the west pays nothing) (Q2) |
| Gold 1×1s | ●1 tank roof, ●2 tower deck 4, ●3 Rock top, ●4 squeeze cave, ●5 halfpipe lip, ●6 oval infield, ●7 range berm, ●8 movers top deck, ●9 obelisk crown, ●10 zip-house roof | `pickup` (touch) rows into a collectible set; every 5 → a Calibration Chip perk (10 west + 10 east = 4 chips) |
| FINDS tab | sections: Vistas 0/8, Caches 0/6, Gold 0/20, Personal bests | `findsCatalogue` rows |
| West feats | joke titles for the toys: e.g. "Sub-Minute Mover" (movers < 60 s), "Strike!" (all 10 skittles), "Air Traffic" (trick score), "Zip Tied" (grapple under X), "Lap Dog" (riding lap) | achievement rows with `title` |

## 2. Engine / game / host work, just in time

Research:

- **Benches, chests and touch pickups are interactable kinds** (`src/engine/shared/world/interact/types.ts:191`; bench drawn in
  `Interactables.ts:363`); Driftwood's quest host already routes a `vista-bench` owner. Named places and discovery:
  `src/engine/shared/quest/discovery.ts` (`PlacePoint { id, label, x, z, r, quiet }`).
- **The finds catalogue is nearly the collectible-set host:** `src/format/findsCatalogue.ts`: `counters [{label,
  flags}]`, `sections [{title, items [{label, icon, prize?, flag | owned}]}]`, **`glass`** (Driftwood's sea glass: flags,
  colours, fallback) and **`next {counter, every, max, text}`** ("every 5 glass → a charm"). The perk the charm grants is
  an Owned charm read by `game/server/loadout/effects.ts`. `glass` is Driftwood-shaped by name. Users: Driftwood
  (`game/server/loot/runtime.ts`), Nalati (`bag.finds`, `game/client/shardfile/clientFinds.ts`), the SDK (`src/sdk/finds.ts`).
- **Feats with joke titles exist:** quest `achievements [{ id, name, goal, count, kind, variant, event, title, icon }]`
  (`src/format/quests.ts:20-21`, "display metadata for the existing achievement registry"); counters
  `src/format/achievementCounters.ts`, `src/game/shared/achievements.ts`.
- Driftwood also ships `custom/collections` (the plaque displays, `out/driftwood-isle/sections/collections/displays.json`,
  host `src/game/client/models/collectionWall.ts`, 236 lines).

Work:

| Row / host | Shape | Layer |
|---|---|---|
| collectible sets | `glass` generalised: `sets: [{ id, flags | prefix, look?: { colours }, every: n, perk: <owned id>, max }]`; Driftwood's glass is one set | format `findsCatalogue.ts`, game `clientFinds.ts`, `loot/runtime.ts` |
| perks | the perk is an owned id with an effect row (W2a / `loadout/effects.ts`); Calibration Chip: e.g. +5 % reel and board speed (Q1) | data |
| vista | `bench` gains `view: { yaw, pitch, fov, seconds }` and marks a named place | engine kit (no game nouns) |
| feats from records | achievement `event: 'record'` with `{ record: <id>, better: n }` | format + game achievements |

Host bar: finds catalogue 3 users, collectible sets 2 (Driftwood, showcase), achievements many. Guards: `engine-words`
(feat, loot, bag are engine words: keep them out of engine). Tests: `test/finds-catalogue.test.ts`,
`test/client-finds.test.ts`, `test/collections-display.test.ts`, `test/collection-game-ports.test.ts`,
`test/achievement-counters.test.ts`.

## 3. Other shards in this slice

| Shard | Today | Migration | Proof | Save risk |
|---|---|---|---|---|
| Driftwood | `glass` + `next`, charms, the collection plaques | glass → one collectible set (same flags, same every 5); plaques untouched unless LE9 (east) | `test/finds-catalogue.test.ts`; Bag FINDS DOM snapshot; pick up the fifth glass and get the charm | medium: the glass flags are saved; ids unchanged |
| Nalati | `bag.finds` | reads the same catalogue; no change in rows | `test/client-finds.test.ts`; FINDS tab snapshot | none |
| Pine | `ui/compendium` (its own) | not touched (M9.3 waits for a slice that changes compendium rows) | — | — |

## 4. Done when, hours, blockers

**Done when:** the six vistas sit and frame their view, the four caches open, the ten Gold cubes count into the FINDS
tab with a Calibration Chip at five, the west feats unlock from personal bests; Driftwood's glass and Nalati's finds
read the same.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 14 h (Codex; Opus vista framing) | 8 h | 10 h (placing 20 items, the gold cube look) | **32 h** |

**Blockers:** the places exist: W5a (halfpipe), W6a (movers deck), W7a/b (tank, tower, zip house), W9a (Rock, cave).
It can land in pieces as those land.

## 5. Risks

- The Calibration Chip perk must stay "west pays nothing": a perk, never XP or Scrip (loot plan item 8).

## 6. Questions for Jake

1. **What a Calibration Chip does.** (a) +5 % board and grapple reel speed per chip (toy perks, west flavoured); (b) a
   small combat perk (+2 % crit each); (c) cosmetic only. **Recommended (a):** it rewards exploring with better toys
   and keeps combat balance out of the west.
2. **What a cache holds.** (a) a cosmetic each (a board finish, a hard-hat colour); (b) Scrip. **Recommended (a):** the
   west pays nothing (your decision 1), and cosmetics are the reward that rule allows.
3. **Feats for the toys.** (a) one per course PB threshold plus "all vistas", "all caches"; (b) none in the west.
   **Recommended (a):** 19l says west toys have feats.
