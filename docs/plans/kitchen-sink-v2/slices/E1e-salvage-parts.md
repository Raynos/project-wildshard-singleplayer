# E1e: salvage parts (one part per kill, walk-over pickup; harvest rows out of the game layer)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs **LE3** (salvage rows out of
`game/server/Inventory.ts`, E405: match → drops, mode `auto` walk-in or `harvest` Pine's kneel), the harvest half of **M1.1**
and **M1.2** (Driftwood's crab / coconut / fur and Pine's venison / hides / tusk / pelt off the closed `HARVEST` table)
and **LW2** for band 1 (the Servo).

## 1. The showcase piece

Every Mite kill drops **one Servo** (night shift two, E7b) where it broke apart; you collect it by walking over it (no
kneel: 400+ kills are too many beats on a phone). The PACK tab (W2a) shows "Servo 5" and the silhouettes of the five
parts still to find. Tinker Rook's Spare Servos quest (E1g) and Hover Grip / Sturdy Heart I need them.

## 2. Engine / game / host work, just in time

Research:

- **Harvest is a closed species table in the game layer**: `HARVEST` (deer, boar, elk, bear, crab, monkey) in
  `src/game/server/Inventory.ts:42`, beside the closed `ItemId` union (`:32`, which W2a opens). Pine kneels to carve; Driftwood's
  crab claws, coconuts and fur go into the pack the same way.
- Loot tables exist as weighted rows (`registerLootTable`, `src/game/server/loot/tables.ts`, over the engine's
  `WeightedTable`), and touch pickups exist as an interactable (`PickupDef.touch`, "walk into it (feet within 1.1 m)",
  `src/engine/shared/world/interact/types.ts:178-189`).
- Death listeners run at `loot: 40` (`src/game/server/loot/deaths.ts:4`).

Work:

| Row / mechanic | Shape | Layer |
|---|---|---|
| salvage rows | `economy/loot.salvage: [{ match: { kind, variant?, rarity? }, drops: [{ item, n }], mode: 'auto' \| 'harvest', night?: mul }]` | format `lootEconomy.ts` |
| auto drop | on death (order 40) spawn a touch pickup of the item at the body; it despawns after 60 s; walking over adds it | game `loot/salvage.ts` (new) over the engine pickup kit |
| harvest mode | today's kneel-and-carve flow, now driven by the rows | game, Pine's flow unchanged |
| delete | `HARVEST` and its species nouns from `src/game/server/Inventory.ts` | game |

Host bar: salvage has three users (Driftwood, Pine, the showcase); test 2 goes from fail to pass (species names leave
the game layer). Guards: `shard-names`, `engine-words`. Tests: `test/hybrid-inventory.test.ts`,
`test/driftwood-boot-inventory.test.ts`, `test/loot-bag.test.ts`; new `salvage-rows.test.ts`.

## 3. Other shards in this slice

| Shard | Today | Migration | Deleted | Parity proof | Save risk |
|---|---|---|---|---|---|
| Driftwood | crab claw, coconut, fur by `HARVEST` | salvage rows, `mode: 'harvest'` (or `auto` if today's is a walk-over: check in the slice) | its species from `HARVEST` | the same items per kill in a seeded hunt; Bag snapshot | **medium**: pack ids unchanged (W2a's shim covers loads) |
| Pine | venison, hides, tusk, pelt, resin by kneel | salvage rows, `mode: 'harvest'` | its species from `HARVEST` | Mott's 7 trades still fed (the same counts per carve); `test/isolated-shard-pine-*-values.test.ts`; carve a deer in game | medium, same |
| Nalati | no pack | none | — | — | none |

## 4. Done when, hours, blockers

**Done when:** every Mite kill drops a Servo you walk over; `HARVEST` is gone from `src/game`; Driftwood's and Pine's
hunts give the same items; their old saves keep every item.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 8 h (Codex; Opus 2 h for the part's pickup look) | 12 h | 2 h | **22 h** |

**Blockers:** E1c, W2a (open item ids, the save shim).

## 5. Risks

- Unpicked parts: a fight in a pack of 5 leaves 5 pickups; they must not count against E0h's cap or the body cap (they
  are static touch pickups, not physics bodies).

## 6. Questions for Jake

1. **Parts magnetise to you?** (a) walk over each part (the loot plan); (b) parts fly to you within 4 m after the fight
   ends. **Recommended (b):** same rule, less walking on a phone; a part still lands where the robot broke.
