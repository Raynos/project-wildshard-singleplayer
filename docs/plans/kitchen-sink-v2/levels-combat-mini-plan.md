# Mini plan: KITCHEN-SINK v2 levels, XP and combat maths (LV)

Parent: [KITCHEN-SINK.md](../KITCHEN-SINK.md); joins [wave-1-hosts-mini-plan.md](wave-1-hosts-mini-plan.md) after W6
and W11. Source: `art/showcase-template/round-3-levels/index.html` (ab3614ea5e); Jake's rulings win over it. Nothing is
built until Jake says "build it".

## 1. Decisions (Jake, 2026-11-02)

- Levels 1–20. **XP only from kills.** At most **8 attributes**, shared by players and enemies.
- Enemy bands 1–3 / 4–6 / 7–9 / 10–12 / 13–15 / 16–18. Mini-bosses at 6, 12, 18; the **Crate Titan at 20** (the final
  quest). The **Vault Warden is level 12**, inside the Training Vault mini dungeon.
- **Attacks can miss: real dice misses** (not the page's "glance, never miss"). A hit/miss roll first, then glance,
  clean or crit on hits; fair on a phone.
- **Death costs XP**: part of the XP toward the next level, **never a delevel**. No Morale.
- Quests are freeform and level-locked: grey "!" when too low, yellow when eligible. Bosses are a soft gate.
- West half: no XP, no coins. Kill contracts pay coins, plus a trophy and a joke title the first time.
- About **2.5–3 h to level 20**: the page's curve is kept.
- **Attributes grow automatically**: no points to spend, no respec, no presets (*"really annoying to choose your
  attributes every single time as you go shard by shard"*). **Open: Jake to pick** the attribute list (§2 proposal).
- **Level per shard**: each shard keeps its own level and XP; every shard starts you at 1. Entering a shard puts you
  at your level in that shard; on the road between shards you are level 1. Save rows are keyed by shard.
- **Existing shards**: level 1 against level-1 enemies, range 1 to 1, levels hidden, combat unchanged (§5). Rolling
  1–20 out to them is future work.

## 2. The system

**Attributes (proposal, Open: Jake to pick).** VIT max HP (`40 + 12·VIT + 10·(L−1)`), STR blade damage, DEX ranged
damage, PRE accuracy and crit, AGI evasion, TGH physical armour, RES energy armour, POI stagger bar and parry window.
Cap 40.

**Automatic growth (Jake, 2026-11-02).** The player's one fixed all-round build, the same for every weapon:
VIT, STR, DEX and PRE = `min(40, 2L + 4)`; AGI, TGH, RES and POI = `L + 4`. STR and DEX grow together, so every
weapon scales the same; PRE feeds everyone's accuracy and crit. Enemies use `L + 4`
plus `3·L` lean points (§3). A level-up refills HP and shows "LEVEL 7"; nothing to spend.

**Kill XP** = `(20 + 5 × enemy L) × gap factor × rank` (normal 1, night shift 1.25, mini-boss 10, Titan 25). Quests pay
unlocks only; toys and the west half pay nothing.

| L | To next | Total | Min | Death XP | Band |
|---|---|---|---|---|---|
| 1 | 200 | 0 | 3 | 20 | Mite |
| 2 | 250 | 200 | 3 | 25 | Mite |
| 3 | 400 | 450 | 5 | 40 | Mite |
| 4 | 500 | 850 | 5 | 50 | Jack |
| 5 | 650 | 1,350 | 6 | 65 | Jack |
| 6 | 800 | 2,000 | 6 | 80 | Jack, Big Pallet |
| 7 | 950 | 2,800 | 7 | 95 | Drone |
| 8 | 1,150 | 3,750 | 8 | 115 | Drone |
| 9 | 1,350 | 4,900 | 8 | 135 | Drone |
| 10 | 1,550 | 6,250 | 9 | 155 | Welder |
| 11 | 1,800 | 7,800 | 10 | 180 | Welder |
| 12 | 2,050 | 9,600 | 10 | 205 | Welder, Vault Warden |
| 13 | 2,300 | 11,650 | 11 | 230 | Riveter |
| 14 | 2,600 | 13,950 | 12 | 260 | Riveter |
| 15 | 2,850 | 16,550 | 12 | 285 | Riveter |
| 16 | 3,200 | 19,400 | 13 | 320 | Sentry |
| 17 | 3,500 | 22,600 | 13 | 350 | Sentry |
| 18 | 3,850 | 26,100 | 14 | 385 | Sentry, Foreman Unit 7 |
| 19 | 4,250 | 29,950 | 15 | 425 | Sentry (night shift L19) |
| 20 | | 34,200 | | 0 | Crate Titan |

**The hit model (reworked for dice).** Only a blade or shot that connects rolls; aim and dodges still decide contact.
`g = defender L − attacker L`. Damage-over-time ticks, falls and the environment never roll.

```
1 HIT ROLL  miss % = clamp(8 + 0.5·(AGI_def − PRE_att) + 4·max(0,g) − 2·max(0,−g), 2, 40)
            hit chance is always 60–98 %; a miss deals 0 and shows MISS
            streak guard: after 2 misses in a row on one target, the player's next contact hits
2 ON A HIT  glance % = min(40, 5·max(0,g))                       ×0.5, grey number
            crit %   = clamp(5 + 0.8·(PRE_att − 5) − 2·max(0,g), 0, 50)  ×1.5, orange
            clean    = the rest                                   ×1
3 DAMAGE    max(1, round(B · S · M · G · (1 − A) · Q))
  B  weapon tier base (player) · 12·(1 + 0.1·(L−1)) · strike multiplier (enemy)
  S  1 + 0.04·(STR or DEX − 5)        M  combo 1/1/1.33, heavy 2, headshot 1.5
  G  g > 0: max(0.5, 1 − 0.07g) · g < 0: min(1.2, 1 + 0.04|g|)
  A  R / (R + 60 + 8·attacker L), max 0.75; R = 4·TGH (physical) or 4·RES (energy)
  Q  glance 0.5 · clean 1 · crit 1.5
```

**Example 1 (golden row 1).** You: L10 (STR 24, PRE 24), Steel sword (base 22), third combo swing. It: L12
Welder (AGI 16, TGH 16, 255 HP). g = 2. miss = 8 + 0.5·(16 − 24) + 8 = **12 %**. On a hit: glance 10 %, crit 5 +
15.2 − 4 = 16.2 %, clean 73.8 %. 22 × 1.76 × 1.33 × 0.86 = 44.3; A = 64 / 204 = 0.31 → **clean 30, crit 46, glance
15**. Expected 27.6 a contact: **about 9 contacts**.

**Example 2 (soft gate).** You at L8 (PRE 20, STR 20, Iron base 17) at the L12 Vault Warden (AGI 16, TGH 30, 1,540 HP).
g = 4: miss **22 %**, glance 20 %, crit 9 %. 17 × 1.6 × 0.72 × (1 − 120/244) = clean 10, crit 15, glance 5:
**about 210 contacts**, against about 60 at level 12.

**Example 3 (it hits you).** L12 Welder torch (energy, STR 23, PRE 16) on you at L10 (AGI 14, RES 14). g = −2: miss
3 %, no glance, crit 13.8 %. 25.2 × 1.72 × 1.08 × (1 − 56/212) = **clean 34, crit 52**: about 12 hits to kill 418 HP.

**Level gap** (equal AGI and PRE; output = expected damage vs g = 0, before armour):

| g | Con | XP × | Miss % | Glance % | Crit − | G | Output |
|---|---|---|---|---|---|---|---|
| ≤ −6 | grey | 0 | 2 | 0 | 0 | 1.20 | 1.28 |
| −5 / −4 / −3 | blue | 0.15 / 0.3 / 0.5 | 2 | 0 | 0 | 1.20 / 1.16 / 1.12 | 1.28 / 1.24 / 1.19 |
| −2 / −1 | green | 0.7 / 0.85 | 4 / 6 | 0 | 0 | 1.08 / 1.04 | 1.13 / 1.06 |
| 0 | yellow | 1.0 | 8 | 0 | 0 | 1.00 | 1.00 |
| +1 / +2 | orange | 1.1 / 1.2 | 12 / 16 | 5 / 10 | 2 / 4 | 0.93 / 0.86 | 0.86 / 0.73 |
| +3 / +4 | red | 1.3 / 1.4 | 20 / 24 | 15 / 20 | 6 / 8 | 0.79 / 0.72 | 0.62 / 0.52 |
| +5 / +6 | skull | 1.5 | 28 / 32 | 25 / 30 | 10 / 12 | 0.65 / 0.58 | 0.43 / 0.36 |

**Death.** Lose **25 % of the current level's span** (Jake 11-02, raised from the proposed 10 %; the Death −XP column
×2.5), never below the level's first XP. Level 20 loses nothing; no item or coin loss.

**Healing** (Jake 11-02): out-of-combat regen only. Fast regen starts after about 5 s without being hit; none
mid-fight.

**Enemies roll misses on you too** (Jake 11-02): the same dice both ways, shown as MISS over your head.
Respawn at LastPlace, full HP; the killer heals; a boss resets its phase.

## 3. Roster

HP and hit (after armour, on a level-matched you) are the page's. Mk II attributes follow its lean rule (`L + 4` each,
plus `3·L` lean points split 50/30/20 or 60/40, cap 40, overflow to the next lean).

| L | Enemy | Leans | HP | Hit | Mk II attributes (rest at base) |
|---|---|---|---|---|---|
| 1–3 | Crate Mite | AGI STR VIT | 56–84 | 10–13 | L2: AGI 9 STR 8 VIT 7, rest 6 |
| 4–6 | Pallet Jack | STR TGH POI | 83–105 | 15–19 | L5: STR 17 TGH 13 POI 12, rest 9 |
| 7–9 | Plumb Drone | DEX PRE AGI | 151–179 | 22–27 | L8: DEX 24 PRE 19 AGI 17, rest 12 |
| 10–12 | Welder Unit | RES VIT STR | 221–255 | 26–31 | L11: RES 32 VIT 25 STR 21, rest 15 |
| 13–15 | Riveter Bulwark | TGH POI | 218–245 | 28–32 | L14: TGH 40 POI 38, rest 18 |
| 16–18 | Arc Sentry | PRE AGI STR | 323–356 | 42–48 | L17: PRE 40 AGI 40 STR 34, rest 21 |

| L | Boss | Where | HP | Light / heavy | VIT STR DEX PRE AGI TGH RES POI |
|---|---|---|---|---|---|
| 6 | Big Pallet | open world, Jack band | 903 | 27 / 54 | 14 17 10 10 10 17 10 10 |
| 12 | Vault Warden | Training Vault | 1,540 | 43 / 86 | 16 23 16 16 16 30 16 30 |
| 18 | Foreman Unit 7 | wave finale | 3,320 | 81 / 163 | 22 22 40 40 22 22 33 22 |
| 20 | The Crate Titan | arena, final quest | 9,230 | 68 / 136 | 40 24 24 24 24 40 24 36 (core: TGH 12, RES 10) |

## 4. Player at 1, 10, 20 (the automatic build)

| | L1 | L10 | L20 |
|---|---|---|---|
| Attributes | VIT STR DEX PRE 6, rest 5 | VIT STR DEX PRE 24, rest 14 | VIT STR DEX PRE 40, rest 24 |
| HP | 112 | 418 | 710 |
| Sword / full-draw bow, before armour | 12 / 15 (Scrap) | 39 / 46 (Steel) | 74 / 89 (Titanium) |
| Your miss vs the band | 8.5 % | 3 % | 2 % |
| Its miss on you | 8 % | 8 % | 8 % |
| Crit vs equal level | 6 % | 20 % | 33 % |

## 5. Existing shards: hidden level 1 and the parity rule

Every other shard (all of `src/shards/`, legacy and templates too) gets the **flat profile**: no
`progression` row means range 1–1, every actor level 1, no stats, no dice, no XP, nothing shown. The road between
shards is flat too. Level and XP are saved per shard (keyed by slug, like `Progress` and `Inventory`), so a Kitchen
Sink level never leaves the Kitchen Sink.

**Parity rule: a flat shard's combat is today's, bit for bit.**
1. No stat stage: the `damage.modify` chain keeps today's answers and orders (0, 1, 10, 40, 50, 90, shard rules).
2. No new random draws: the `combat` stream is never created; rng snapshots and replays are unchanged.
3. PlayerHealth stays 100 / 100, 4 HP/s regen after 6 s, `incomingCap` from `fight.maxHitDamage`.
4. Creature, elite and boss `hp` and strike `damage` rows stay authoritative.
5. No new save field; the health snapshot stays version 1; no level, XP or nameplate DOM.

**Test** `test/levels-flat-parity.test.ts` (LV12): every shipped manifest admits flat; each shard's weapon × creature
strike rows through `CombatPipeline.hit` with and without the install give deep-equal `DamageDealt` and rng snapshots;
PlayerHealth snapshots match after 60 s; no level DOM. A levelled manifest with `fight.maxHitDamage` is refused.

## 6. Wave 1 rows (engine, game, format)

Host bar: Kitchen Sink is the first real user (flat shards don't count): each new host needs a pending-user entry
naming the future rollout and Jake's G595 approval, tests 2–6 scored. Rows and ids only, server-safe except UI. The
engine says `grade`, never "level" (its word for a map).

| Row | What | Files | h |
|---|---|---|---|
| LV1 | Progression rows: range, attributes, growth, cap, XP, kill and gap tables, ranks, dice, death | `format/progression.ts` (new), `shardSchema.ts` | 4 |
| LV2 | Pure formula module; golden tests (the three examples, the gap table) | `game/combat/levelMath.ts` (new) | 4 |
| LV3 | Engine: `DamageRequest.damageType`, `.outcome`; a miss emits `damage.missed`, applies nothing; regen an attribute (default 4); `combat` rng stream | `engine/combat/pipeline.ts`, `health.ts`, `engine/events/maps.ts`, `game/rng.merge.d.ts` | 4 |
| LV4 | Stat stage: one `damage.modify` answer (order 30): roll, S, G, A, Q, streak guard; levelled shards only (needs W6) | `game/combat/statStage.ts` (new), `game/session/play.ts` | 5 |
| LV5 | Actor stats: player max HP via `setMaxHealth`; grade and the eight on each `AttributeSet`; strike `damage` → multiplier when levelled; boss phases as attribute effects (needs W11) | `game/combat/actorStats.ts` (new), `format/creatures.ts`, `bossProfiles.ts`, `eliteFeature.ts`, `engine/entities/AnimalSim.ts` | 8 |
| LV6 | Experience host: XP on `actor.died`, level-up with automatic growth, death XP loss, killer heal and reset, save keyed by shard (road = flat), achievements | `game/progression/experience.ts` (new), `game/saves.ts`, `Progress.ts` | 6 |
| LV7 | `scaling`, `tier`, `requirement`, `damageType`, `pierce` on W6's weapon and ammo rows (×0.6, no crit under requirement); parry stays W6 | `format/weaponProfiles.ts`, `heldEquipment.ts`, `engine/combat/ammo.ts` | 4 |
| LV8 | `pays: false` zones (no XP, no coins, with LE); quest `minLevel`; unlock-only rewards | `format/quests.ts`, `questSteps.ts`, `game/loot/Bounty.ts` | 4 |
| LV9 | AS queries for grade and attributes (the Arc Sentry parries by PRE) | `format/scriptQueriesV2.ts`, `engine/script/queriesV2.ts` | 3 |
| LV10 | 90 s band respawn; night-shift variant rows (L+1, XP ×1.25) | `format/populationRespawn.ts`, `eliteFeature.ts` | 3 |
| LV11 | The whole system behind Developer until Jake plays it (E451) | `game/progression/experience.ts` | 1 |
| LV12 | Flat-profile admission and the parity test (§5) | `test/levels-flat-parity.test.ts` (new) | 4 |
| | **Subtotal** | | **50** |

**HUD rows** (E332 herdr notice before, SHA after; Jake's pick on a labelled board first; hidden on flat shards):

| Row | What | Files | h |
|---|---|---|---|
| LVH1 | Level badge and XP bar | `engine/ui/HUD.ts`, `hudSlots.ts`, `styles/game.css` | 3 |
| LVH2 | Lock-on nameplate: level in its con colour | `engine/ui/LockOn.ts`, `Combat.ts` | 2 |
| LVH3 | Outcome numbers: MISS, grey glance, orange crit | `engine/ui/Combat.ts` | 2 |
| LVH4 | Character tab in pause: level, XP and the eight values, read-only | `engine/ui/Menu.ts`, `tabs.ts`, `game/ui/panels.ts` | 4 |
| LVH5 | Level-up banner; "−XP" on the death card | `engine/ui/HUD.ts`, `playerDeath.ts` | 2 |
| | **Subtotal** | | **13** |

## 7. Wave 2 showcase rows (data only)

| Row | What | h |
|---|---|---|
| LS1 | `progression` rows for `showcase-template`: range 1–20 and every number in §2 | 2 |
| LS2 | Six band species with Mk I / II / III levels, leans, ranks; night-shift variants | 6 |
| LS3 | Big Pallet, Vault Warden (in the vault), Foreman Unit 7, Crate Titan (three phases as attribute effects) | 6 |
| LS4 | East band strips with respawn; the west half `pays: false` | 2 |
| LS5 | Quest `minLevel` rows and giver markers; one kill contract per band (coins; a trophy and a joke title the first time) | 3 |
| LS6 | Weapon tiers Scrap to Titan-forged with requirements (vendor stock with LE) | 2 |
| LS7 | Arc Sentry parry (AS, by PRE); "Level 10" and "Level 20" achievements | 3 |
| | **Subtotal** | **24** |

## 8. Open questions for Jake

1. **The eight attributes** (VIT STR DEX PRE AGI TGH RES POI)? Recommended: take them as proposed.
2. **Miss bounds**? Recommended: hit chance 60–98 %, 8 % miss at equal level, streak guard after two misses.
3. ~~Death cost~~: decided 11-02, 25 % of the level's span.
4. ~~Enemies roll misses~~: decided 11-02, yes.
5. **Rare variants** (Jake 11-02: Pine and Driftwood have rarer, tougher variants of each enemy type): fold them in with
   the elites-vs-mini-bosses page.
