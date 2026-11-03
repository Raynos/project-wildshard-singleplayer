# Mini plan: loot and economy for the Kitchen Sink (and the host it implies)

Parent: [KITCHEN-SINK.md](../KITCHEN-SINK.md). Page for Jake: `art/showcase-template/round-5-loot/index.html`.
Numbers lean on the levels page (`art/showcase-template/round-3-levels/`): its kills per level, bands, gap table and
roster. **State:** `draft`, waiting for Jake's answers below.

Jake, 2026-11-02 (E523): *"The whole loot and items and gear is so under-thought … I know we can collect coins … Zelda-
style, collect coins and buy upgrades in the shops, and we added that to Driftwood. But economy, coins, all of that is so
unfolded. Let's try our best in the plan and design."*

## Decisions (Jake, 2026-11-02)

1. *"The west half pays nothing: no XP, no coins. It is there for fun and practice."*
2. Coins from kills, chests and kill contracts; *"the shop sells flat one-off upgrades (no item levels)"*.
3. *"Loot is fixed rewards only (no random gear)"*, no rarity tiers; set rewards from mini-bosses and the boss; the Crate
   Titan gives a legendary weapon. A 20-slot pack.
4. Collectibles that pay perks; trophies; skins and finishes as elite drops; joke-title feats.
5. *"Death costs XP toward the next level and never delevels."*

All kept. Two readings this plan makes (Q2, Q3): the levels page's weapon tiers become one-off **Forge** upgrades, and
coins follow the XP gap rule instead of Driftwood's per-enemy cap.

## What exists today (audit)

- **Driftwood:** a full clear pays 92 doubloons, each enemy once (`game/loot/Bounty.ts`); Maren's 6 goods cost 90. One
  run buys the shop out, then coins mean nothing. Sea glass charms and the 3 trophies work. Dead: crab claws, coconuts
  and fur (nothing takes them); the pearl necklace is a flag with no use.
- **Pine Hollow:** barter only. Carve → venison, hides, tusk, pelt, resin, ribbons → Mott's 7 trades (ammo, 2
  finishes): the hunt feeds the ammo, our best loop. Thin: elk harvest gives nothing; rarity matters for 2 contracts.
- **Nalati:** no currency, no pack; 5 elite skins, 2 legendaries. Fixed, with nothing to spend.
- **Shared gaps:** `OWNED` is a closed union of Driftwood ids in the game layer; harvest names species in
  `game/Inventory.ts`; contract rewards have Pine's `bolts`; loot domains are `coins` and `trophies` only.

## Proposal

**One loop: the east earns, the west spends.** Kill robots for **Scrip** (coins) and **parts**; spend Scrip at Tinker
Rook's stall on one-off upgrades, many of them west-half toys; turn spare parts into ammo and patch kits at his bench.

1. **Currency: Scrip** (the Foreman's company scrip, gold coin icon). Equal-level kill pays the type's rate × the LV
   gap factor (grey = 0, so low bands can't be farmed), night shift ×1.25. No per-enemy cap (bands respawn in 90 s).
2. **Salvage: one part per robot type**, no rolls: every kill drops one (night shift two), auto-collected by walking
   over it (no kneel; 400+ kills is too many beats on a phone). Mini-bosses drop a **core** once.
3. **Tinker Rook's stall, two tabs.** UPGRADES: Scrip + a few parts, one-off, unlocked by level (table). BENCH: parts →
   consumables (Pine's barter, unchanged host). Weapon tiers are the **Forge I–IV** one-offs: each raises every
   weapon's base (12 → 17 → 22 → 26 → 31, LV's B term), so the bow and the sword never compete for coins.
4. **Pack: 20 slots, one per kind, never full.** 6 parts, 3 cores, patch kits (max 5), the vault keycard. Unfound
   kinds show as silhouettes, so the grid doubles as a "what's out there" board. Ammo stays in the pouch.
5. **Fixed rewards everywhere.** Every elite, mini-boss, chest and contract has a written reward; first kill pays the
   unique, repeats pay Scrip and parts only.
6. **Night-shift named elites, one per band** (L+2, night only): each drops a weapon finish and a trophy.
7. **Trophy wall (12 frames, hub):** 6 elites, 3 mini-bosses, the Titan, 2 secret caches. A hung trophy's perk is
   always on (Driftwood's rule).
8. **Gold 1×1s:** 20 gold stencilled cubes, 10 west and 10 east; every 5 make a Calibration Chip perk. They pay perks,
   never XP or Scrip, so the west still "pays nothing".
9. **Why kill the next pack:** XP; Scrip toward the next upgrade the stall shows locked with its level; this band's part
   counter ("Rotors 5 / 8"); the band's contract; its named elite's finish at night.
10. **Death** costs XP only (LV); Scrip, parts and the pack are never lost.

## Numbers

Rates per equal-level kill, about 150 kills an hour (2.5 a minute, levels page).

| Band | Robot | Scrip / kill (night) | Part | Scrip / h | Count contract | Elite contract | 2 chests |
|---|---|---|---|---|---|---|---|
| 1–3 | Crate Mite | 3 (4) | Servo | 450 | 20 | 30 | 2 × 15 |
| 4–6 | Pallet Jack | 5 (6) | Tine | 750 | 40 | 50 | 2 × 25 |
| 7–9 | Plumb Drone | 7 (9) | Rotor | 1,050 | 70 | 80 | 2 × 40 |
| 10–12 | Welder Unit | 9 (11) | Nozzle | 1,350 | 110 | 120 | 2 × 60 |
| 13–15 | Riveter | 12 (15) | Rivet plate | 1,800 | 160 | 170 | 2 × 80 |
| 16–18 | Arc Sentry | 15 (19) | Arc coil | 2,250 | 220 | 230 | 2 × 100 |

Earned on the climb to 20 (one scripted run of the levels table): kills ≈ 4,430, contracts 2,220, chests 640,
mini-boss drops 410 → **≈ 7,700 before the Titan**; the Titan adds 1,300.

| Upgrade (UPGRADES tab) | Lvl | Scrip | Parts | Does | Bought at* |
|---|---|---|---|---|---|
| Hover Grip (toy) | 2 | 100 | 3 Servo | tighter board turns | 6 |
| Sturdy Heart I | 3 | 60 | 5 Servo | +10 % max HP | 3 |
| Quiver Strap | 4 | 60 | 4 Tine | +6 arrows and bolts | 5 |
| Forge I · Iron | 5 | 80 | 6 Tine | weapon base 17 | 5 |
| Dodge Servo | 6 | 150 | Hydraulic Heart | dodge recharge −25 % | 7 |
| Scrap Scanner | 7 | 120 | 4 Rotor | unfound cubes and chests on the map | 7 |
| Forge II · Steel | 9 | 300 | 8 Rotor | base 22 | 9 |
| Sturdy Heart II | 10 | 250 | 6 Nozzle | +10 % max HP | 10 |
| Grapple Reel (toy) | 10 | 300 | 4 Rotor | faster reel, +8 m reach | 11 |
| Parry Gyro | 12 | 400 | Plate Core | parry window +0.05 s | 13 |
| Forge III · Alloy | 13 | 600 | 8 Rivet | base 26 | 13 |
| Hover Boost (toy) | 14 | 500 | 6 Nozzle | a boost pad on the board | 14 |
| Sturdy Heart III | 15 | 500 | 6 Rivet | +10 % max HP | 16 |
| Forge IV · Titanium | 17 | 900 | 8 Arc coil | base 31 | 17–18 |
| Arc Insulation | 18 | 600 | Foreman's Capacitor | +15 % energy armour | 18 |
| Hi-vis vest · Lamp eyes · Foreman Gold | 1 · 12 · 20 | 150 · 800 · 2,500 | — | cosmetics, the late sink | — |

\* a power-first buyer who spends ~10 % on consumables. Upgrades total 4,920 (64 % of the pre-Titan income); toys
delay Forge by about a level, which is the choice. Each Forge is 20–35 minutes of its band.

BENCH (repeatable): patch kit (heals 40 %, carry 5) = 2 Servo + 1 Tine · pitch bolts ×10 = 3 Nozzle · broadheads ×8 =
3 Rivet · cartridges ×14 = 2 Arc coil + 2 Rotor. Iron bolts and arrows refill free at the hub. Welders feed the pitch
that burns Riveters: the band you farm sets your ammo.

| Boss | First kill (fixed) | Repeat | Contract |
|---|---|---|---|
| Big Pallet L6 | 60, Hydraulic Heart, trophy *Big Pallet's Tines* (+5 % damage to crate robots), 5 Tine | 60 + 5 Tine | 120, title *Forklift Certified* |
| Vault Warden L12 | Vault chest: 150, Plate Core, Warden sword finish, trophy *Warden's Plate* (+5 % physical armour) | 50 (chest pays once) | 300, *Plate Expectations* |
| Foreman Unit 7 L18 | 200, Foreman's Capacitor, the hard hat (worn), trophy *Foreman's Whistle* (+10 % damage to night shift) | 100 + 5 Arc coil | 500, *Middle Management* |
| Crate Titan L20 | 300, the **Crate Cleaver** (legendary sword, base 36, its heavy sends a shock ring that drops TGH 4 s), Titan gold finish, trophy *Titan's Core* (+5 % all damage), Foreman Gold on sale | 300 | 1,000, *Thinks Outside the Box* |

Elites (finish + trophy): Sir Nibbles (Mite, board finish), Old Forky (Jack, spear), Nailbiter (Drone, crossbow), Hot
Mess (Welder, sword), Riveting Rita (Riveter, bow), Static Steve (Sentry, rifle). Feats: *Scrap Metal Enthusiast* (250
parts), *Retail Therapist* (every upgrade), *Independent Contractor* (16 contracts), *Interior Decorator* (12
trophies), *Graveyard Shift* (6 elites), *Cube Collector* (20 Gold 1×1s), *Patch Notes* (25 patch kits).

## Wave 1 rows (engine, game, format; data-only authoring)

Joins the Wave 1 order at step 5. W5 (vendor, generic `Owned` kinds), W2 (chests) and W16 (finds → perks, elite
finish grants) stay where they are; these rows are the rest.

| Row | Work | h |
|---|---|---|
| LE1 | Currency row (id, name, icon, chip) replaces `loot.coins: true`; `game/loot/Purse.ts`, `coins.ts` | 6 |
| LE2 | Kill payouts: coin rows by kind and variant, night ×, LV gap factor, `cap: per-enemy \| none` (`Bounty.ts`; Driftwood keeps its cap) | 10 |
| LE3 | Salvage rows out of `game/Inventory.ts` (E405): match → drops, mode `auto` (walk-in) or `harvest` (Pine's kneel); Driftwood and Pine parity | 14 |
| LE4 | Pack catalogue rows: label, icon, stack cap, "used for" line from the exchange, 20 slots, silhouettes (`inventoryLaw.ts`, bag schema, `Menu.ts`) | 10 |
| LE5 | Exchange: `requires.level`, coin + part costs on one good, repeatable goods with a carry cap, open icon set, two tabs (`format/exchange.ts`, `ShopPanel.ts`) | 14 |
| LE6 | Upgrade effect rows: weapon base tier, max HP %, dodge, parry window (W6), energy armour (LV), ammo capacity, board, grapple | 12 |
| LE7 | Fixed reward rows `{ first, repeat }` for elites, bosses, chests, contracts (Scrip, items, owned ids, titles, flags); contract `bolts` → grants | 14 |
| LE8 | Contract board fixed mode: a level-locked list, accept and claim, no draws (Pine keeps its draws) | 10 |
| LE9 | One trophy wall row (frames, model, perk line, silhouettes); Driftwood's plaques and Pine's wall become rows | 10 |
| LE10 | Economy golden test: Scrip per hour per band and the level each upgrade is affordable, from the rows | 4 |
| | **Total** | **~104** |

## Wave 2 rows (the showcase, data and AS only)

| Row | Work |
|---|---|
| LW1 | Scrip; payouts for 6 types and their night shift |
| LW2 | 6 parts, 3 cores, salvage rows, the pack catalogue |
| LW3 | Tinker Rook: 15 upgrades, 3 cosmetics, 4 bench recipes |
| LW4 | Contract board: 6 count, 6 elite, 3 mini-boss, the Titan |
| LW5 | 12 chests (2 per band) and the Vault chest |
| LW6 | 6 named night elites with finishes and trophies (Opus, visual) |
| LW7 | Mini-boss and Titan rewards; the Crate Cleaver (Opus, visual) |
| LW8 | Trophy wall; 20 Gold 1×1s and 4 Calibration Chips |
| LW9 | 7 loot feats and titles |
| LW10 | One playthrough balance pass; prices move ± 30 %, numbers in the commit |

## Later: Driftwood and Pine Hollow (no edits now)

- **Driftwood** keeps its 30-minute buy-out and the per-enemy cap. Fixes: Maren takes reef shells and silver fur for
  the cape and charm-dye (or the island stops dropping them); the pearl necklace hangs on the plaque wall with a perk;
  its rows move to LE1–LE4 and LE9 with exact parity.
- **Pine Hollow** is already the barter half of this design. Fixes: elk drop a hide Mott takes; ribbons buy a second
  finish; coat rarity pays more parts. Optional later: Scrip for contracts.
- **Nalati** stays fixed rewards with no currency, the model for "no shop needed".

## Open questions for Jake

1. **Parts?** One salvage part per robot type, auto-collected, for upgrades and the bench. *Recommended: yes.*
2. **Weapon tiers as Forge I–IV**, one-off, raising every weapon? *Recommended: yes* (no item levels, no per-weapon
   coin split).
3. **Grey kills pay 0 Scrip** (like XP) with no per-enemy cap? *Recommended: yes.*
4. **The Titan's legendary:** the fixed Crate Cleaver sword, or a Titan Core you forge into any weapon? *Recommended:
   the Cleaver now; the core is a later add.*
5. **Six named night elites**, one per band, each a finish and a trophy? *Recommended: yes.*
6. **Currency name:** Scrip, coins or bolts? *Recommended: Scrip* (bolts are ammo).
