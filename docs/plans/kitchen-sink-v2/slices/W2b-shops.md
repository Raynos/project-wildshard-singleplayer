# W2b: shops (Tinker Rook's UPGRADES and BENCH, the weapons shop)

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs **LE5** (exchange: level gate,
coin + part costs, repeatable goods with a cap, two tabs), the vendor half of the old **W5**, the shop part of **M1.1**
(Driftwood's Maren) and **M1.2** (Pine's Mott, `bolts` → a grant). Upgrade *effects* (LE6) land with the things they
change: toy upgrades in W5b/W7a, combat upgrades in E0.

## 1. The showcase piece

- **Tinker Rook's stall**: UPGRADES tab (the loot plan's 15 one-off upgrades + 3 cosmetics, each with its level, Scrip
  and part cost; locked rows show their level) and BENCH tab (4 repeatable ammo recipes: pitch bolts, broadheads,
  cartridges; iron bolts and arrows refill free at the hub).
- **The weapons shop** (Gunsmith, W1a): weapons bought, level-locked (19j): sword, spear, bow, crossbow, lever rifle,
  each a one-off good granting an owned `gear` id; stock opens by level.
- Both panels open from their keepers' talk. With nothing earned in the west, every price is out of reach until E1
  (Q1 on how this is checked).

## 2. Engine / game / host work, just in time

Research:

- **The exchange reflects into owners by path.** `src/format/exchange.ts:5` `method = { owner, path[] }` and
  `call = { owner, path, args }`; goods hold `payments` and `grants` as such calls. `src/game/quest/trader.ts:128` lends
  the owners by fixed names (`owned`, `purse`, `pack`, `skins`, `ammo` with Pine's `addBolts`). HOST-BAR test 6
  forbids `{owner, path}` reflection; this host scores 5/6 at best today.
- **The trader host sits on the plugin scaffolding:** `trader.ts:1` imports `ShardContext` from `game/plugin/context`.
- Users: Driftwood (coins, Maren) and Pine (barter, Mott); `economy/loot` `exchange` + `goods` (`format/lootEconomy.ts:47,
  78-80`). Tests: `test/quest-shops.test.ts`, `test/quest-trader.test.ts`, `test/quest-trader-page.test.ts`,
  `test/loot-economy.test.ts`.

Work:

| Row | Shape | Layer |
|---|---|---|
| typed costs and grants | `costs: [{ currency, n } | { item, n }]` ≤ 3; `grants: [{ owned } | { item, n } | { ammo, n } | { finish } ]` | format `exchange.ts`; game `loot/exchange.ts` applies them; the `{owner, path}` calls are deleted |
| level gate | `requires: { flags?, level? }` (`level` read only where levels exist; E0 provides it; today a `requires.flags` gate) | format |
| repeatable goods | `repeat: { cap }` (BENCH) vs one-off (owned) | format + game |
| tabs | `tab: 'upgrades' | 'bench' | 'weapons'`, a panel per keeper | game `ShopPanel.ts` (shared UI: E332 notice) |
| shop off the plugin | `installQuestShop` takes the product and the entered owners, not `ShardContext` | game `quest/trader.ts` |

Host bar after: 6/6 (two users, rows only, no reflection). Guards: `no-raw-*`, `host-callbacks` lint
(`lint/host-callbacks.mjs`) must stay clean. Tests: extend the four above; new `exchange-typed-grants.test.ts`.

## 3. Other shards in this slice

| Shard | Today | Migration | Parity proof | Save risk |
|---|---|---|---|---|
| Driftwood | Maren: 6 goods, coins, owner/path grants into `owned`, `purse` | typed grants; same goods, same prices | buy-out costs 90; `test/quest-shops.test.ts`; buy the cape in game | low (owned ids unchanged since W2a) |
| Pine Hollow | Mott: 7 barter trades, ammo via `addBolts`, 2 finishes via `skins` | `{ ammo: 'ammo.bolt', n }` and `{ finish }` grants; contract reward `bolts` stays until E1 (QC5) | the 7 trades give the same counts; `test/quest-trader.test.ts` | low |

## 4. Done when, hours, blockers

**Done when:** in Developer both showcase panels open, list every good with level, Scrip and part costs, refuse a buy
you can't afford, and (with Q1's Developer row) complete a buy that lands in Owned / the pouch; Maren and Mott trade
exactly as before; no `{owner, path}` left in `exchange.ts`.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 18 h (Codex; Opus for the two-tab panel) | 12 h | 10 h (stall + shop fronts dressing, stock rows) | **40 h** |

**Blockers:** W2a, W1a (the keepers).

## 5. Risks

- Upgrade effects are not live until their slices (toys W5b/W7a, combat E0): a bought upgrade shows OWNED and does
  nothing yet. Each effect row lands with the thing it changes.

## 6. Questions for Jake

1. **How a west-only build checks a purchase.** Nothing pays in the west. (a) a Developer Debug row "Give 1,000 Scrip"
   (one engine-wide row, deleted after E1 pays); (b) leave shops unbuyable until E1. **Recommended (a):** the buy path is
   checked in its own slice, and the row is the short-lived kind E451 allows.
2. **Do bought weapons replace the starter kit?** (a) you start with only fists and the range's loaners (W3a), and buy
   each weapon; (b) you start with a sword, buy the rest. **Recommended (b):** a level-1 player in the east needs a
   weapon before the first Scrip, and the sword is the cheapest teacher.
3. **BENCH ammo for free?** The loot plan refills iron bolts and arrows free at the hub. (a) free refill at a hub crate;
   (b) iron ammo is a BENCH good too. **Recommended (a):** the basic ammo never blocks practice or play.
