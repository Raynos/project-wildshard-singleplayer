# W2a: currency, the pack catalogue and generic ownership (Scrip, 20 slots, owned rows)

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs **LE1** (currency row),
**LE4** (pack catalogue), the `Owned` half of the old **W5**, **M1.6** (save shim, first), **M1.1/M1.2** (the parts of
Driftwood's and Pine's economies these rows touch), **M1.4** (Sky/Signal empty coin rows), **M1.5** (templates).
Payouts (LE2), salvage drops (LE3), rewards (LE7) and the trophy wall (LE9) are east work (E1+): nothing in the west pays.

## 1. The showcase piece

- **Scrip**: a currency row (name, gold coin icon, HUD chip) and the Scrip chip on the Bag. Starts at 0.
- **The pack**: 20 slots, one per kind, never full; its catalogue rows (6 parts, 3 cores, the vault keycard) with
  silhouettes for unfound kinds, so the PACK tab is a "what's out there" board from minute one.
- **Owned rows** for the showcase's upgrades, cosmetics and bought weapons (the ids W2b sells).

## 2. Engine / game / host work, just in time

Research (11-03): the economy is shard-shaped in the game layer.

| Today | File:line | Problem |
|---|---|---|
| `OWNED` closed union of Driftwood ids plus Pine's `warden-longbow`, `lever-rifle` | `src/game/shared/loot/Owned.ts:24` | a new shard can't own anything without editing game code; game names shard items (E405) |
| `ItemId` closed union (venison … crab-claw, coconut, doubloon, ironhide-tusk, lodge-ribbon) | `src/game/server/Inventory.ts:32` | same |
| `HARVEST` species table (deer, boar, elk, bear, crab, monkey) | `src/game/server/Inventory.ts:42` | species nouns in the game (LE3 later moves it to salvage rows) |
| 12-slot pack, `ws.inventory.v1`; unknown ids **dropped on load** | `src/game/server/Inventory.ts:12, 70` | an id rename loses items (M1.6 risk) |
| `ws.owned.v1` `{owned, worn}` | `src/game/shared/loot/Owned.ts:4` | keep the key, change the id type |
| coins = `loot.coins: true`; loot domains `coins` / `trophies` only | `src/format/lootEconomy.ts:25` | no named currency |
| `ITEMS` registered per shard at runtime (`registerItemRow`) | `src/game/shared/bag/itemCatalog.ts:6` | already the right shape: rows per shard |

Work:

| Row | Shape | Layer |
|---|---|---|
| currency | `economy/loot` `currency: { id, name, icon, chip }` replaces `coins: true` | format + game `Purse.ts` |
| owned catalogue | `economy/loot` `owned: [{ id, kind: 'upgrade'|'cosmetic'|'charm'|'trophy'|'gear', label, icon }]`; `OWNED` and `OwnedId` deleted, `isOwnedId` reads the shard's rows | format + game `Owned.ts` (+ `loot/runtime.ts:16,127,131`, `loadout/effects.ts:12,32,43`) |
| pack catalogue | `items` rows gain `stack`, `silhouette`, `usedFor`; `bag.pack.slots` up to 20; `ItemId` becomes `string` checked against the shard's rows | format `items.ts`, game `Inventory.ts`, `inventoryLaw.ts`, engine `Menu.ts` PACK tab |
| **save shim first** | on load, ids are checked against the shard's own rows (not a global union); a one-shot fixture per shard proves no item is dropped | game `saves.ts` |

Host bar: Purse / Owned / Inventory become data-driven game hosts with 2+ users (Driftwood, Pine, the showcase);
tests 2 (no nouns) and 3 (data-driven) go from fail to pass. Guards: `engine-words` (coin, loot, bag are already engine
words: keep them in game), `shard-names` (the unions go, so names leave game code). Tests: `test/loot-economy.test.ts`,
`test/loot.test.ts`, `test/loot-bag.test.ts`, `test/owned-setup.test.ts`, `test/hybrid-inventory.test.ts`,
`test/driftwood-boot-inventory.test.ts`; new `owned-save-shim.test.ts` with an old Driftwood and an old Pine save.

## 3. Other shards in this slice

| Shard | Today | Migration | Deleted | Parity proof | Save risk |
|---|---|---|---|---|---|
| Driftwood | doubloons (`coins: true`), OWNED ids (whetstones, hearts, charms, cape, hat, trophies, iron sword), pack (crab, coconut, fur) | currency row "Doubloons"; owned rows; pack rows | its ids from `Owned.ts`, `Inventory.ts` | LE10-style golden: full clear pays 92, Maren's goods cost 90; Bag DOM snapshot; old-save fixture | **high**: `ws.owned.v1` / `ws.inventory.v1` ids must stay byte-identical |
| Pine Hollow | barter, 7 kept kinds (`PINE_PACK_KINDS`), `warden-longbow`, `lever-rifle` owned | pack rows (7), owned rows | its ids from both unions | Mott's 7 trades; Bag snapshot; old-save fixture (the longbow flag migration `had(id)` stays) | high, same |
| Nalati | no pack (`slots: 0`), no purse | none (declares no pack) | — | Bag shows no PACK tab | none |
| Sky, Signal | `economy/loot` empty rows (21 bytes) | currency row absent = no chip, as today | — | `wildshard validate` | none |
| Templates (T, IC, PP) | `data/items.json`, `ledger.json` | add `owned: []` where needed | — | validate | none |

## 4. Done when, hours, blockers

**Done when:** the showcase's Bag shows Scrip 0 and a 20-slot PACK with silhouettes; Driftwood and Pine old-save
fixtures load every item; Driftwood's golden (92 / 90) and Mott's trades pass; no shard id remains in `src/game`.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 16 h (Codex; Opus for the PACK tab silhouettes) | 20 h (6 shim, 8 DW, 6 PH) | 2 h | **38 h** |

**Blockers:** W0a (a product to declare into). Runs beside W1.

## 5. Risks

- The riskiest west migration for players: `Inventory.ts` drops unknown ids on load, so the shim and the fixtures land
  in the first commit, before any id moves.
- The PACK tab is shared UI (E332 notice; silhouettes are a look change, so a before/after capture).

## 6. Questions for Jake

1. **One currency per shard or a shared wallet?** (a) per shard, like levels (19a): Scrip is spent only here, doubloons
   only on Driftwood; (b) one wallet across shards. **Recommended (a):** your level-per-shard rule applies to money too,
   and it keeps each shard's balance its own.
2. **Silhouettes for unfound pack kinds** (loot plan item 4). (a) yes, every kind shows as a dark outline until found;
   (b) hidden until found. **Recommended (a)** in the showcase only; Driftwood and Pine keep today's look (a row
   switch, default off).
