# W3b: bow and crossbow lanes, three crossbow ammo types

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the bow / crossbow / ammo part
of the old **W6**, **M3.1**'s crossbow half (Pine's `held/equipment` crossbow rows onto a weapon-family row without
`{owner, path}` inputs) and **M3.2**'s bow half (Nalati's recurve on the same family).

## 1. The showcase piece

| Item | Rows |
|---|---|
| 2 bow lanes, 2 crossbow lanes | ring targets at 10, 20, 30, 40, 50 m (`world/targets` + W3a's ring scoring) |
| Ammo practice at 20 m | a plank (iron bolt sticks), a straw bale (pitch bolt sets it alight), a soft dummy (broadhead staggers it) |
| Drill "Lanes" | 10 arrows or bolts, ring score, a PB on the range board (W3a records) |
| Showcase bow and crossbow | weapon-family rows (data), lent by the range (W3a), sold by the weapons shop (W2b) |
| Three ammo rows | `ammo.iron` (free refill crate at the range), `ammo.pitch` (burns), `ammo.broadhead` (heavy, short) |

## 2. Engine / game / host work, just in time

Research:

- **Ammo rows exist in the engine:** `src/engine/shared/combat/ammo.ts` `AmmoRow { id: 'ammo.*', flight {gravity, drag}, wet?,
  tags: CombatTag[], material?, pouchMax }` and the `projectile.modify` ask. The pouch is data-driven
  (`src/game/server/loadout/pouch.ts`: "content supplies kinds, fallback and capacity").
- **No burn exists outside one boss.** "burn" appears only in Nalati's arena-boss rows (`src/format/bossProfiles.ts:292`,
  `arenaScriptRows.ts` `burnSeconds`, `fireDps`). A pitch bolt lighting a bale is new.
- **The crossbow is Pine-shaped.** Pine ships 102 KB of `held/equipment` (`out/pine-hollow/sections/held/equipment.json`);
  its rows bind inputs and outputs by reflection: `src/format/heldEquipment.ts:9-13` `input { input, owner, path }`,
  `output { property, target, path }` (HOST-BAR test 6 fail; G496 scored `held.ts` and the equipment catalogue 2/6).
  `src/game/client/loadout/held.ts` (195 lines) dispatches by class checks. Pine's ranged page is `held.ranged-page`
  (`src/game/client/loadout/rangedPage.ts`).
- **The bow:** `src/game/server/weapons/Bow.ts`, `heldBowBase.ts`, bow variant rows (`src/format/bowVariantRows.ts`), users Nalati
  (recurve, `generators/heldSlots.ts`) and Pine (the Warden's longbow, "Nalati's Bow.ts").

Work:

| Row / host | Shape | Layer |
|---|---|---|
| weapon family `ranged` | `held/families: [{ id, family: 'bow'|'crossbow', model, pose, draw|reload, ammo: [ids], view }]`: numbers and part ids only; the owner/path bindings become named channels the family host owns | format + game (`loadout/held.ts` dispatch by `family`, no `instanceof`) |
| ammo kinds | the showcase's three `AmmoRow`s + `effects: [{ on: 'hit', kind: 'ignite', seconds } | { kind: 'stagger', … }]` | format rows; engine applies `ignite` to a world target as a prop fire (a flame + smoke emitter, no damage-over-time on actors until E0's status effects) |
| refill crate | an interactable `refill: { ammo, to }` (W4a's interactables section) | data |

Host bar: the ranged family host has three users (Pine crossbow, Pine/Nalati bows, the showcase) and no reflection:
6/6. Guards: `engine-words` (crossbow, longbow are engine words: they stay in game/format/shards),
`lint/weapon-subclasses.json` (entries only shrink), `host-callbacks`. Tests: `test/held-equipment-platform.test.ts`,
`test/held-weapon-laws.test.ts`, `test/bow-variant.test.ts`, `test/held-bow-product.test.ts`,
`test/manual-coat-bow-tools.test.ts`, `test/golden-held-residency.test.ts`; new `ammo-effects.test.ts`.

## 3. Other shards in this slice

| Shard | Today | Migration | Deleted | Parity proof | Save risk |
|---|---|---|---|---|---|
| Pine Hollow | crossbow + longbow on `held/equipment` with owner/path rows | onto `held/families` rows | the reflected input/output rows for these two; class checks in `held.ts` for them | held-pose goldens (the goldens skill, Pine cameras with the crossbow up); bolt counts after Mott's trade; `test/isolated-shard-pine-*-values.test.ts` | medium: ammo counts are saved with the loadout (`loadout/persistence.ts`); a fixture with 37 bolts loads 37 |
| Nalati | recurve via bow variant rows, mounted bow | onto the same family | its bow-specific owner paths | `test/nalati-recurve-source-inputs.test.ts`, `test/held-bow-binding.test.ts`; a mounted shot in game | low |

Pine's lever rifle and Nalati's rifle wait for W3c; Nalati's sabre and spear stay on their rows.

## 4. Done when, hours, blockers

**Done when:** the four lanes score rings and record a PB; iron, pitch and broadhead fly differently, the bale burns,
the soft dummy staggers; Pine's crossbow and longbow and Nalati's bow fire, pose and count ammo as before (goldens +
tests).

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 16 h (Codex rows; Opus fire look, poses) | 14 h | 8 h (lanes, targets, ammo practice) | **38 h** |

**Blockers:** W3a (range, records, loan). W4a for the refill crate (or a plain pickup row until then).

## 5. Risks

- Pine's 102 KB equipment file is the biggest single migration in the west after movers; held-pose goldens before and
  after are the only real check of the look (graphical: Opus).
- Fire on props must stay cheap on the phone: one emitter per lit bale, capped.

## 6. Questions for Jake

1. **What pitch does in the west.** (a) the bale burns for 8 s (look only), no damage system yet; (b) wait for E0's burn
   status and ship iron and broadhead now. **Recommended (a):** the ammo practice reads complete, and E0 adds the burn
   damage to the same row.
2. **Ammo as pack items or a pouch counter?** (a) a pouch counter per kind, never in the pack (today's rule, the loot
   plan's "ammo stays in the pouch"); (b) pack items. **Recommended (a):** the 20-slot pack stays for parts.
3. **Bows and crossbows: shared quiver?** (a) arrows and bolts are separate kinds; (b) one "ammo" count. **Recommended (a):**
   that is what the three crossbow ammo types need.
