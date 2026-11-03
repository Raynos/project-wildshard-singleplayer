# E7a: rare variants (one shared rarity row; a variant look on one GLB)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs **EBW6** (the shared rarity row:
species `variants` plus level, Scrip, trophy, look, on any creature), **EBW4**'s rarity half (a variant look on one GLB:
palette, emissive eyes, a part toggled), **EB5**'s rarity rows, **M4.1** (Pine's coat rarity onto the shared row) and
19f / §15 ("uncommon +1 level and ×1.5 HP; rare +2 levels, ×2.5 HP and a guaranteed part").

## 1. The showcase piece

Every band spawn rolls its rarity: **uncommon 8 %** (+1 level, ×1.5 HP, Scrip ×1.5, steel trim) and **rare 2 %** (+2
levels, ×2.5 HP, Scrip ×2.5, a guaranteed extra part, a trophy the first time; gold stencils, e.g. the Lamp-Eye
Riveter). A palette and one extra part per robot; an orange nameplate tag (E0f); no name, lair or bar. Day and night
(levels add with the night shift, E7b).

## 2. Engine / game / host work, just in time

Research:

- **Coat rarity is Pine's**: the socket-rig creature card's `coat { id, label, weight, rarity: 'common' | 'uncommon' |
  'rare' | 'legendary', scale, hp?, tint?, traits? }` (`src/format/socketRigCreature.ts:6-8`), used by Pine's
  generators (`coatPages.ts`, `coatPixels.ts`, `creatureHulls.ts`, `kingCard.ts`, `thrallExtras.ts`) and Nalati's
  `output.ts`. Pine's contracts already match on rarity (`matches: … 'rarity'`, `src/format/contracts.ts:26`).
- Species `variants` carry `hp` and `mods` (`out/_template/sections/actors/species.json`); no level, payout or look per
  variant. The exported-skin client (`skinPlayback.ts`) takes a material from the binding's family entry, so a palette
  is a material parameter, not a second GLB.

Work:

| Row / mechanic | Shape | Layer |
|---|---|---|
| rarity row | species `rarity: [{ id: 'uncommon' \| 'rare' \| …, weight, levels: +n, hpMul, payoutMul, salvage?: [{ item, n }], firstTrophy?: <owned id>, look: { palette, emissive?, parts?: [on/off] } }]`, rolled on the `spawn` stream at spawn time | format `creatures.ts` (one shared row), game spawn host |
| variant look | the robot GLB's palette slots and part toggles (E1a) set from `look`; one GLB, one draw path | game skin binding + engine material params |
| readers | payouts (E1d) and salvage (E1e) multiply by the rarity; contracts' `rarity` match reads it; the nameplate tag | game |
| Pine | its coat rarity becomes the shared row with `look: { coat }` (its coats stay its own textures) | Pine data |

Host bar: rarity has two users (Pine's coats, the showcase), test 3 passes (no Pine-shaped coat field in the shared
row). Guards: `shard-names`, the `spawn` rng stream (rolls only for species that declare rarity). Tests: the coat tests
(grep `test/*coat*`), Pine's contract rarity tests; new `rarity-row.test.ts` (8 % / 2 % over 10k seeded spawns, a
species without `rarity` draws nothing).

## 3. Other shards in this slice

| Shard | Today | Migration | Proof | Save risk |
|---|---|---|---|---|
| Pine Hollow | coat rarity on socket-rig cards (weight, rarity, hp, tint) | coats as the shared rarity rows | seeded spawn replay: the same coats on the same spawns; coat goldens of a rare deer (Opus); the rarity contract counts the same | low: coats are rolled, not saved |
| Nalati | coat rows through the same card | same | replay | low |

## 4. Done when, hours, blockers

**Done when:** in a 200-kill walk across the bands roughly 16 uncommon and 4 rare robots appear with their trims, tags,
levels and payouts; the first rare kill gives its trophy; Pine's coats and rarity contract are unchanged.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 12 h (Codex) | 8 h | 8 h (Opus: palettes and one part for six robots) | **28 h** |

**Blockers:** E1a (palette slots), E1c, E1d, E1e; at least E2–E6's robots for the full set (it can land per robot).

## 5. Risks

- The `spawn` stream's draw order changes if a rarity roll is added to an existing species; Pine's roll must reuse the
  coat's draw exactly, or every Pine spawn after it shifts.

## 6. Questions for Jake

1. **Rare odds.** (a) uncommon 8 %, rare 2 % (about one rare every 50 kills); (b) rarer: 5 % / 1 %. **Recommended
   (a):** the enemies plan's numbers; at ~150 kills an hour you see three rares an hour.
