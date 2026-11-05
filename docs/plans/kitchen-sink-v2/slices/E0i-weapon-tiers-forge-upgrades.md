# E0i: weapon tiers, Forge I–IV and the combat upgrade effects

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs **LV7** (weapon `tier`,
`requirement`, `damageType` on the W3 weapon and ammo rows; its "×0.6, no crit under requirement" is retired by §11/§15),
the combat half of **LE6** (upgrade effect rows: weapon base tier, max HP %, dodge recharge, parry window, energy
armour, ammo capacity; the toy half landed in W5b / W7a), and makes W2b's level gate live (`requires.level`).

## 1. The showcase piece

- Tinker Rook's UPGRADES tab (W2b) now *does* things: Sturdy Heart I–III (+10 % max HP each), Forge I–IV (every weapon's
  base ×1.0 / 1.2 / 1.4 / 1.6), Dodge Servo (dodge recharge −25 %), Parry Gyro (parry window 0.22 s, W3d), Quiver Strap
  (+6 arrows and bolts), Arc Insulation (+15 % MDEF).
- The weapons shop's level locks read your real level: a locked row shows "LV 9".
- The calibration pen's dummies show the Forge change in the numbers.

## 2. Engine / game / host work, just in time

Research:

- Owned upgrades already drive effects: `installItemEffects` (`src/game/server/loadout/effects.ts`) grants `EffectDef`s from
  owned ids (`selectEffectGrants`, `EffectService.ts:213`); a finish is a permanent cosmetic effect
  (`heldFinishEffect`, `effects.ts:15`). Driftwood's whetstones, hearts and charms work this way. It runs on
  `ShardContext` (`effects.ts:23`, the plugin context).
- Weapon rows: `src/format/weaponProfiles.ts` (1,294 lines) and W3's family rows (`held/families`, W3b). No tier or Forge
  multiplier exists. The pouch capacity is data (`src/game/server/loadout/pouch.ts`).
- `requires.level` is W2b's shape on goods, wired to flags until levels exist.

Work:

| Row / mechanic | Shape | Layer |
|---|---|---|
| upgrade effects | an owned id's effect row gains `modifiers: [{ attribute: 'maxHealthPct' \| 'forge' \| 'dodgeRecharge' \| 'parryWindow' \| 'mdefPct' \| 'pouch.<ammo>', op, value }]`; Forge is a single attribute the stat stage reads (`weapon × forge × ATK …`) | engine `EffectDef.modifiers` (exists) + game readers |
| weapon rows | `tier` (display), `damageType` (`physical` \| `energy`), `baseMul` and `cadence` from E0a's weapon table | format W3 family rows |
| level gate | `requires.level` reads the experience host on levelled products; flat products have no level and keep flag gates | game `loot/exchange.ts` (W2b) |
| off the plugin | `installItemEffects` takes the product and the entered services, not `ShardContext` (as W2b did for the shop) | game `loadout/effects.ts` |

Host bar: the item-effects host has Driftwood and Pine as users; after the plugin move it passes test 6. Guards:
`host-callbacks`, `engine-words`. Tests: `test/owned-setup.test.ts`, `test/loot-economy.test.ts`, new
`upgrade-effects.test.ts` (each upgrade moves its number; Forge II takes a sword hit from 14 → 17 at L1).

## 3. Other shards in this slice

| Shard | Today | Migration | Proof | Save risk |
|---|---|---|---|---|
| Driftwood | whetstones (damage), hearts (HP), charms via `installItemEffects` on the plugin context | same rows through the moved host | the LE10-style golden (sword damage with 0 / 1 / 2 whetstones), Bag snapshot | low: owned ids unchanged since W2a |
| Pine | tool effects, finishes | same | `test/isolated-shard-pine-*-values.test.ts`; a finish worn in game | low |
| Nalati | finishes (`held/finishes`) through `clientCosmeticFinishes` | not touched here (E8e) | — | — |

## 4. Done when, hours, blockers

**Done when:** each upgrade bought with the Developer Scrip row (W2b Q1) moves its number in the pen or the Character
tab; the weapons shop shows real level locks; Driftwood's whetstones and Pine's effects are unchanged; the effects host
is off `ShardContext`.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 12 h (Codex) | 6 h | 4 h (stock rows, prices from the loot plan) | **22 h** |

**Blockers:** E0b (the stat stage reads Forge), E0c, W2b, W3d (Parry Gyro), W3b (pouch).

## 5. Risks

- Sturdy Heart is "+10 % max HP" while HP = VIT: the percentage must apply after VIT, or a level-up would erase it.

## 6. Questions for Jake

1. **Does Forge raise every weapon at once?** (a) yes, one Forge tier for all weapons (the loot plan, your 11-02
   pick); (b) per weapon. **Recommended (a):** already decided; listed so the shop text says "all weapons".
