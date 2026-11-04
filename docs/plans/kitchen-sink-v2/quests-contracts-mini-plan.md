# Mini plan: quests and kill contracts

Parent: [KITCHEN-SINK.md](../KITCHEN-SINK.md). Ordered by Jake 2026-11-02 (E523). Levels and XP rules:
[levels-combat-mini-plan.md](levels-combat-mini-plan.md); rewards: [loot-economy-mini-plan.md](loot-economy-mini-plan.md).

## Decisions (Jake, 2026-11-02)

1. Quests are **freeform but level-locked**: each quest has a level requirement; the giver shows a **grey "!"** when
   you're too low (like WoW) and a yellow "!" once you reach it. Any order.
2. **12 quests, 4 per tier**, from **three tier givers** in the hub (levels 1–6, 7–12, 13–20). The last tier ends at the
   Crate Titan, the final quest.
3. Quest kinds: **kill + collect**, **explore + elite hunt**, **set pieces** (storm hour beacons, the keycard in the
   stealth yard, clearing the Training Vault, the gauntlet waves).
4. A simple **kill-contract board** in the hub: contracts for the enemy types, the elites and the boss. They pay **Scrip
   plus a trophy and a joke title the first time**. XP still comes only from the kills.
5. **Checkpoint cards** close each quest leg (a card that saves: "Step 2/3").
6. The west half pays nothing; its toys need no quests (a stable hand's riding course and the practice range are free
   play).
7. Hub NPCs: 4–5 dev-bot NPCs (the three tier givers, Tinker Rook at the shop, the stable hand); lines change as you
   level.
8. Storm hour is one quest that turns the whole cell to an evening storm until the four beacons are lit.

## The 12 quests (draft; names are placeholders)

| Tier | Lv | Quest | Kind | Ends with |
|---|---|---|---|---|
| 1 (L1–6) | 1 | **Clock In**: kill 5 Crate Mites at the east gate | kill | checkpoint card |
| | 2 | **Spare Servos**: bring Tinker Rook 6 Servos | collect | first upgrade unlocked |
| | 4 | **Survey the Yard**: discover 4 places in bands 1–2 | explore (FINDS) | a map pin set |
| | 6 | **Big Pallet**: hunt the band-2 gate elite | elite hunt | Big Pallet's trophy |
| 2 (L7–12) | 7 | **Drone Season**: down 8 Plumb Drones | kill | — |
| | 9 | **Lights Out**: storm hour, light the four beacons | set piece | storm clears |
| | 10 | **Keycard**: steal the keycard unseen in the stealth yard | set piece (stealth) | opens the Training Vault |
| | 12 | **The Training Vault**: clear the four rooms and the Vault Warden | set piece (shrine) | SHRINE COMPLETE card |
| 3 (L13–20) | 13 | **Rivet Count**: bring 10 Rivet plates | collect | Forge III unlocked |
| | 15 | **Night Shift**: hunt a night elite | elite hunt (night rule) | its finish |
| | 18 | **The Gauntlet**: survive five waves and Foreman Unit 7 | set piece (waves) | Foreman's trophy |
| | 20 | **The Last Contract**: beat the Crate Titan | boss (cutscene intro) | Titan Cleaver, shard-complete card |

Levels match the blockout's bands. Rewards are unlocks, trophies, finishes and Scrip (the loot mini plan sets amounts);
quest rewards never give XP.

## Contract board

- One row per enemy type (kill N, e.g. 10 at its band), one per elite, one for the Titan.
- Each contract is level-locked like quests (grey until its band's level).
- First completion: Scrip + a trophy for the hub wall + a joke title; repeatable after for Scrip only. Grey kills
  don't count (they pay nothing).

## Engine needs

| Need | Today | Row |
|---|---|---|
| Quest level requirement + grey/yellow "!" | quest givers have no level gate | **QC1** (rows) + LVH (the marker art; HUD pick) |
| Freeform quest log with tiers | chapter quests are linear | **QC2**: the one author quest path (W5) supports parallel quests |
| Kill/collect counters | partial (kill steps exist) | QC3: counter steps for kills by type and parts in the pack |
| Explore step on FINDS | finds exist | QC4: a "discover N places" step |
| Contract board | Pine's lodge contracts (rotating, Pine-shaped) | **QC5**: a generic board row (fixed list, level-locked, first-time rewards); Pine becomes a second user later |
| Checkpoint card | — | **QC6**: a leg-complete card row that saves |
| Storm hour trigger | weather host | W13 (a quest step that forces a weather state until a flag) |
| Set pieces | stealth, shrine, waves, boss | W10, DG, W3/W4, W11–W12 |

| Row | What | h |
|---|---|---|
| QC1 | Quest `level` field; giver marker state (grey / yellow / done) | 6 |
| QC2 | Parallel freeform quests on the single author quest path | 10 |
| QC3 | Counter steps: kill N of type, hold N of an item | 6 |
| QC4 | Discover-N-places step | 3 |
| QC5 | Generic contract board rows | 10 |
| QC6 | Checkpoint card | 6 |
| QK1 (Wave 2) | Author the 12 quests, the board, the NPC lines | 2 d |

## Open

- ~~Quest names and NPC names~~: NPC names D12; the 12 quest names kept as written (Jake 11-03, D63).
