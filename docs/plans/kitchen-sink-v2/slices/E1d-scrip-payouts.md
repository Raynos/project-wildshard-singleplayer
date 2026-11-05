# E1d: Scrip from kills and chests (payout rows; Driftwood's cap becomes a mode)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs **LE2** (kill payouts: coin rows
by kind and variant, night ×, the gap factor, `cap: per-enemy | none`), the payout half of **M1.1** (Driftwood's bounty
onto the rows, exact parity) and the Scrip content of chests (**LW5** for band 1). The west's Developer "Give 1,000
Scrip" row (W2b Q1) is deleted here.

## 1. The showcase piece

Every equal-level Mite kill pays **3 Scrip** (night 4) with today's coin burst; a kill 6+ levels under you pays nothing
(grey, 19h); no per-enemy cap (packs respawn in 90 s). Band 1's two chests pay 15 Scrip each, once. The Scrip chip
(W2a) counts up.

## 2. Engine / game / host work, just in time

Research:

- `Bounty` pays **each enemy once** (Jake 09-30, "cap per enemy"): keyed by herd slot or kind, counted from the starting
  census, saved as `ws.bounty.v1` (`src/game/server/loot/Bounty.ts:1-20`, `bountySave` in `src/game/shared/saves.ts:15`). Coin amounts
  live in `src/game/shared/loot/coinAmounts.ts`; the burst in `CoinBurst.ts`; death listeners are ordered (`loot: 40`,
  `src/game/server/loot/deaths.ts:4`).
- Coins are `economy/loot` `coins: true` until W2a's currency row (`src/format/lootEconomy.ts:25`).
- Chests: `ChestDef.contents: ChestItem[]` where an item is `{ item, n } | { key } | { flag }`
  (`src/engine/shared/world/interact/types.ts:138-141`, `:160`): **no currency content**.

Work:

| Row / mechanic | Shape | Layer |
|---|---|---|
| payout rows | `economy/loot.payouts: [{ match: { kind, variant? }, amount, night?: mul }]`, `cap: 'per-enemy' \| 'none'`, `gap: 'progression' \| 'none'` (grey and the gap factor from E0a's table on levelled products) | format `lootEconomy.ts`, game `Bounty.ts` |
| chest currency | `ChestItem` gains `{ currency, n }` | engine kit (generic "currency" id only) + game |
| `pays: false` | E0d's zones also stop Scrip | game |
| delete | the W2b Developer Scrip row and its code | game / Debug registry |

Host bar: bounty becomes data-driven with two users (Driftwood per-enemy, the showcase none). Guards: `engine-words`
(coin, loot are forbidden in engine: the chest field is `currency`), `shard-names`. Tests: `test/loot-economy.test.ts`,
`test/loot.test.ts`; new `payout-rows.test.ts` (grey pays 0, night ×, cap modes); Driftwood's LE10-style golden.

## 3. Other shards in this slice

| Shard | Today | Migration | Proof | Save risk |
|---|---|---|---|---|
| Driftwood | `Bounty` per-enemy cap, amounts in `coinAmounts.ts` | its amounts as payout rows, `cap: 'per-enemy'`, `gap: 'none'` | full clear pays 92; `ws.bounty.v1` fixture keeps every paid key | **medium**: the saved keys must stay `kind:herd` |
| Sky, Signal | empty `economy/loot` | none | validate | none |
| Pine, Nalati | no coins | none | — | none |

## 4. Done when, hours, blockers

**Done when:** band-1 kills and chests pay Scrip by the rows, grey kills pay 0, Driftwood's full clear still pays 92
and its old bounty save loads, the Developer Scrip row is gone.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 8 h (Codex) | 8 h | 2 h | **18 h** |

**Blockers:** E1c (band 1 exists), E0d (the gap table), W2a, W4a (chests in the interactables section).

## 5. Risks

- Deleting the Developer Scrip row before band 2+ exist means a test buyer has to farm Mites for Forge I; acceptable,
  the bench and the shop are checked again in E16.

## 6. Questions for Jake

1. **Coin burst for Scrip.** (a) today's coin burst (gold coins fly to the chip); (b) a quieter "+3" chip only.
   **Recommended (a):** it is the shared look of money on every shard, and 3–15 a kill keeps it small.
