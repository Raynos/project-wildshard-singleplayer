# E13: the quest tiers complete, NPC lines by level, the east's secrets

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs the rest of **QK1** (author the
12 quests, the board, the NPC lines), the decision "lines change as you level" (19e), **LW5** (12 chests, 2 per band,
and the vault chest), **LW8**'s east half (10 east Gold 1×1s, the Calibration Chips that need them) and the east vistas
of the round-5 census (★ on the Titan arch top, the Foreman's office roof Gold).

## 1. The showcase piece

- **All 12 quests** playable, four per tier, each with its checkpoint cards; most were authored in their band slices
  (Clock In, Spare Servos: E1g; Survey the Yard: E2; Big Pallet: E8b; Drone Season: E3; Lights Out: E9; Keycard: E5b; The
  Training Vault: E10d; Rivet Count: E5a; Night Shift: E8c; The Gauntlet: E11d; The Last Contract: E12h). This slice
  checks the set end to end and writes the tier givers' hand-offs (each tier's last quest points at the next giver).
- **The three tier givers' lines change by level band** (L1–6, 7–12, 13–20) and after milestones (Big Pallet down,
  the Vault cleared, the Titan beaten); Tinker Rook and the weapons-shop keeper comment on Forge tiers.
- **East secrets**: 12 band chests (2 per band, fixed Scrip: 15 / 25 / 40 / 60 / 80 / 100), 10 east Gold 1×1s (with
  W9b's west 10: four Calibration Chips), the east vistas; the FINDS tab's east sections; *Cube Collector* (20 Gold).

## 2. Engine / game / host work, just in time

Research: NPC dialogue rows (`dialogue { id, name, start, nodes [{ lines, sets, choices }] }`, `src/format/quests.ts:20-21`)
have no condition per node; W1a / W1b added `visibleWhen` on quests and E1g the `level` atom on conditions.

| Row | Shape | Layer |
|---|---|---|
| line variants | a dialogue node `when: <condition>` (the first matching node is the start), so lines change with `{ level: n }` or flags | format `quests.ts` + game dialogue host |

Host bar: the dialogue host has every quest shard as a user; the field is optional. Tests: extend
`test/author-quest-data.test.ts`, new `dialogue-when.test.ts`.

## 3. Other shards in this slice

None use `when` on dialogue nodes; their dialogue trees parse and run unchanged (`test/quest-story.test.ts`). No save
risk.

## 4. Done when, hours, blockers

**Done when:** a scripted run takes every quest from grey "!" to turn-in in level order (a headless quest walk with
levels set); the givers' lines change at L7 and L13; every chest, Gold cube and vista counts in FINDS.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 6 h (Codex) | 0 | 22 h (Codex rows 10 h; Opus placing and lines 12 h) | **28 h** |

**Blockers:** the slices that own each quest (E1g … E12h); W9b (collectible sets, FINDS).

## 5. Risks

- Quest names and NPC names are still placeholders (quests plan "Open"); a naming pass lands with this slice (Q1).

## 6. Questions for Jake

1. **Names.** The quests plan's names (Clock In, Spare Servos, … The Last Contract) and the NPCs' (Quartermaster Ada,
   Warden Scout, Tinker Rook) are placeholders. (a) keep them; (b) a naming board of three options each.
   **Recommended (a)** for the quests (they read as jokes in the workshop voice), (b) for the two tier givers who
   still have stand-in names.
