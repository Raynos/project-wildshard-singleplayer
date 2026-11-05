# Mini plan: Wave 1 migration map, every shard onto the shared hosts

Parent: [KITCHEN-SINK.md](../KITCHEN-SINK.md) §4. Jake, 2026-11-02 (E523): normalise every host the showcase touches and
refactor Driftwood, Pine Hollow, Nalati and the rest onto it in the same row. Source: a read-only audit of the source
and the built products (`out/*/sections/`, 11-02). Effort figures are estimates.

**What the audit found:** the platform hosts are mostly empty shells and the shards carry the real data.
`world/weather`, `world/days`, `actors/species`, `actors/creatures`, `combat/strikes`, `combat/encounters` and
`world/traversal` hold no data in the six built products (18–52 bytes, empty rows). The real data lives in named
JSON, client-plan kinds and each shard's `generators/`. Only Driftwood (and `_template` source) ships `ui/completion`.

Short names: DW Driftwood, PH Pine Hollow, NG Nalati, ND Nine Dragon, SR Sky Reach (`far-reach`), SD Signal Dunes
(`sunscar-dunes`), T `_template`, IC ink-cel-valley, PP pastel-plain. `blender-template` and `open-plots` use none of
these except one `door.as`. "gen/" = `src/shards/<slug>/generators/`.

## 1. Today → target

| Area | DW | PH | NG | ND / SR / SD / templates | Target |
|---|---|---|---|---|---|
| Loot / economy | `economy/loot`; JSON `quests/trader`, `stall`, `services`; `custom/collections`; gen/economy, loot, lootBag, tradeCounter, trophyPlaques. Game code: `game/shared/loot/Owned.ts` OWNED (DW ids), `Bounty.ts` pays each enemy once, `game/server/Inventory.ts` ItemId/HARVEST (crab, coconut) | `economy/loot`; `stall`, `services`, `contracts` JSON; `custom/trophyMounts`; contracts*.as; gen/trades, weaponFinishes, trophyWall. OWNED has PH weapons; PINE_PACK_KINDS; deer/boar/elk harvest; `format/contracts.ts` `bolts` | No purse or pack; `held/finishes`, skinFinishes.json, legendaryWeapons.json; `game/loadout/cosmeticFinishes` one user (H059) | SR/SD declare coins/loot but ship empty rows. T/IC/PP: `data/items`, `ledger`, `skins.json` | LE1–LE10, W5, W16: items declared as rows per shard; the OWNED, ItemId and HARVEST unions deleted |
| Quests | `quests` + `host`; `steps`, `hints`, `wake-boss`; story, discovery, interaction-source, page-composition, chapter-director kinds | `custom/questRuntime` (29 KB, live); forest-story, native-story/spots, contracts, panels, persistence, lanterns, mill-door; H021 | `quests`; chapters, content, carried, finds, panels; `chapter.as` | SR/SD: `quests` + `host` + `directors` (the cleanest path). T/IC/PP: `data/quests.json` | One author path (W5, closing CS5's exits), QC1–QC6, a generic board (QC5) with Pine's draws as a mode, migrated now |
| Combat | `held/arms`, meleeProfile, strikes; the only `fight.maxHitDamage` | `held/equipment` 102 KB + gear, loadout; held* JSON (3.7k lines); `game/plugin/heldFirearm`, `heldEquipment`, `heldTool`; `instanceof` checks in `game/client/loadout/held.ts` | bow/rifle/sabre/spear page JSON; `heldWeapons.as`; spear via `game/weapons/heldPolearm` (one user) | ND: `held/arms` + jian JSON (raw three.js). SR/SD: `held.melee` kind. T: `data/moves` | W6 weapon families, ammo, parry; LV1–LV12 with every existing shard on the flat level-1 profile; incomingCap as a fight row |
| Enemies | `species-programs`, `spawns`; `custom/enemyPlacements`; director + `director.as`, `directorV2.as`, `returns.as` | roster, elites; eliteFeatureRows; `night.as` + night JSON; coat rarity; `custom/thrallLook` | spawnPackDemand (2.9k lines), eliteRoster, elite kinds, night rows, herd/pack/qara/balbal .as | SR/SD: species + programs, `skitterer-decision.as`. T: creatures, spawn, director | Species rows + a shared rarity row (EBW6), night variants (LV10), elites with a time rule, director stages out of the plugin (W3, W4) |
| Bosses | Captain: `captain.as`, wake-boss, bossEncounter, BossBrain intro | Antler King: `king.as`, `custom/kingKit`, ~800 lines gen/king*, `game/server/plugin/bossPhase.ts` (1,007) | Storm Titan: 13 titan*.as, arena room (`game/server/boss/arenaRoom.ts`, 1,641; H110). Golden King: gen/goldenKing* (~600) | SR `roc.as`, SD `matriarch.as` + bossStages, `boss.telegraph`. T: `boss.as` | W11 one boss row set + AS per boss; W12 cinematic intros; CS8 |
| Movers, traversal, interactables | `world/movers`; interactables.generated.json; `barrels.as`, `bridgeSway.as`; ropeBridge + ropeDeckSite (H026); zipline | movers, zipline, cave-interior, crag-cave | kunesBridge, arena-room | ND: `movers.as`, grapple, portal.ride, well bridges. SR: movers 40 KB + bridges. T/IC/PP/BT: four `door.as`, three `items.as`, `idle.as` | W2, W3, W4, W9, W14, W15 (`world/interior`), W18 (generic rope deck), DG |
| Weather + day | `dayCycle` only | `weather.forest`, `world.forest-page`; weather JSON; gen/weatherChannels (1,250) | `weather.forest`; weather JSON; `weather.as`; gen/dayClock | SD `weather.fields`. Platform: `format/forestWeather`, `forestPage`, `game/weather/forest`, `clientForestPage`, `engine/world/steppeWind` | W13: one envelope filling `world/weather` + `world/days`; no "forest" kinds |
| Audio | `audio/audio` 68 KB | `world/ambience`, `custom/cabinAmbience`, King layers, `game/audio/forestPage` | `audio/scene` + `audio.scene` kind | ND 9 KB; SR/SD < 1 KB; 4 fixed stings | W19a–f in `audio/audio` |
| Completion, FINDS, feats | only `ui/completion` user; discovery, achievements, `custom/collections` | `ui/compendium`; achievements; Pine icon picklist (`format/compendiumRows.ts:21`) | `quests/finds` + `bag.finds` (G441); chapterFeats | ND discovery only; T card.json | W17 (backfill all, rule last), W16, LE9 |

Two mini-plan lines are superseded by this map: the loot plan's "Later: Driftwood and Pine (no edits now)" and QC5's
"Pine becomes a second user later". Both migrate in Wave 1.

## 2. Rows (h): already planned (W/LE/LV/QC/EB/DG) + new migration rows (M)

| Area | Planned | New migration rows | Parity proof per shard |
|---|---|---|---|
| Loot | W5 28, LE 104, W16 18 | M1.1 DW onto LE1–5/LE9 14 · M1.2 PH (bolts → a grant) 14 · M1.3 NG finishes + legendaries (retire cosmeticFinishes) 8 · M1.4 SR/SD coins 3 · M1.5 T/IC/PP 4 · M1.6 save shim 6 → **49** | LE10 goldens (DW full clear pays 92, Maren 90, Mott's 7 trades); old DW/PH saves keep every item; Bag DOM snapshots |
| Quests | QC 41, W20 6 | M2.1 PH questRuntime + forest-story → rows + AS 20 · M2.2 PH board on QC5 8 · M2.3 DW composition/discovery/interaction-source 12 · M2.4 NG chapters/content/carried/panels 12 · M2.5 SR/SD/ND 4 · M2.6 templates 2 → **58** | Headless chapter replay (same steps, flags, save trail); a mid-quest old-save fixture |
| Combat | W6 36, LV 50, EBW1–3 13 | M3.1 PH held/equipment → families, class checks gone 10 · M3.2 NG weapon JSON 10 · M3.3 DW arms + maxHitDamage 6 · M3.4 ND jian → rows + GLB 8 · M3.5 SR/SD held.melee 6 · M3.6 templates 2 → **42** | LV12 flat parity per product (deep-equal damage and rng, HP after 60 s); held-pose goldens; ammo counts |
| Enemies | W3 12, W4 20, LV10 3, EBW4–7 15 | M4.1 PH rarity → shared row 6 · M4.2 PH night director → rows 8 · M4.3 DW enemyPlacements → spawns 4 · M4.4 NG elites + night 8 · M4.5 SR/SD/T 4 → **30** | Seeded population replay: same spawn ids/positions, stage ticks, elite respawns |
| Bosses | W11 36, W12 40 | M5.1 DW Captain 8 · M5.2 PH King 12 · M5.3 NG Titan + Golden King 16 · M5.4 SR roc + SD matriarch 10 · M5.5 T 2 · M5.6 five intros → timeline (Opus) 12 → **60** | Scripted fight replay (phases, HP curve, hazards, adds); mid-fight save; intro captures before/after |
| Traversal | W2 8, W9 16, W10 6, W14 32, W15 18, W18 28, DG 44 | M6.1 door/items/idle.as → commons 3 · M6.2 SR bridges → rope deck 10 · M6.3 NG kunes bridge 4 · M6.4 PH cave, NG arena, ND portal → `world/interior` 8 · M6.5 PH/ND/SR/SD movers 8 → **33** | `physics-baseline --mode=walk` 0 stuck; mover replay; plate/mover save fixture |
| Weather | W13 14 | M7.1 PH (with W15) 10 · M7.2 NG 6 · M7.3 SD 3 · M7.4 DW/T/IC/PP days 3 → **22** | Seeded weather log; light/fog/wind goldens; one-frame looks at dawn, noon, dusk, storm (Opus) |
| Audio | W19 16 | M8.1 NG scene → zones 6 · M8.2 PH ambience 5 · M8.3 boss slots 3 → **14** | Identical score/ambience event log per tick |
| Completion | W17 14 | M9.1 DW collections 5 · M9.2 one feats row DW/PH/NG 6 · M9.3 compendium icons 3 · M9.4 NG finds 3 → **17** | Bag DOM snapshots; the card fires on the same trigger |
| Cross-cutting | — | M0.1 shard parity kit (save fixtures, headless replay, capture list) 24 · M0.2 fresh-seat scoring of every touched host (HA2/HA3 slice, G595) 16 → **40** | — |

**Totals:** planned rows ≈ 675 h (HUD counted once) + new migration rows ≈ 365 h = **Wave 1 ≈ 1,040 h**.

## 3. Order

1. W1 ruler + M0.1 parity kit + M0.2 scoring, before anything moves.
2. W2, W3 (+M6.1), then W4 (+M4.3, M6.5).
3. In parallel: M1.6 first, then W5, LE1–5, M1; QC + M2; W6 + M3; W13 + M7; W19 + M8; W15/W18 + M6.2–6.4; W16/W17 + M9.
4. W11 + M5.1–5.5 (needs W4, W6), then W12 + M5.6.
5. LV (needs W6, W11), then LE6–10, EBW, DG.
6. W20, W21; then CS10's path deletion and NEXT N5 (owned by their plans).

## 4. WASM / AS

Rows only: loot, completion, audio, finds, weather data. WASM-HOST H6 (and H8 where named): Pine's questRuntime → AS
(M2.1) and per-boss AS (W11, CS8). Parry is a window on the native melee profile; only the Arc Sentry's parry decision
is AS. The commons director script, sealed rooms (DG1), plates and barrels fit today's ABI. **Don't run H13 (ABI v2)
during Wave 1**: it re-touches all 70 AS files. H14 folds into the showcase.

## 5. Riskiest

1. M2.1 Pine questRuntime (29 KB, live, save and phase rules; CS5's open exit).
2. M5.2 / M5.3 / W12: King and Titan onto one boss path (1,007 + 1,641 lines), five intros onto the timeline.
3. M1.6 item saves: `Inventory.ts` drops unknown ids on load; the shim and old-save fixtures land first or DW/PH players
   lose items.
4. M3.1 Pine weapons: 102 KB of `held/equipment`, class checks, the firearm out of the plugin.
5. LV12 flat parity on all 11 products, bit for bit (including DW's `maxHitDamage`).

## 6. Lanes

**Jake 11-02: up to 5 Opus + 5 Codex for this plan when it is built.** The audit's original estimate follows.

Recommended: **3 Opus + 3 Codex lanes for about 6 weeks.** Opus ~35 % (cutscenes, boss and weather captures, board and
climb, HUD, the jian GLB); Codex ~65 % (ruler, schemas, rows, saves, parity kit, most M rows), and Codex is the
critical path (~230 h a lane). AGENTS.md limits Codex lanes to plans Jake names, so Wave 1 needs his word to run them.

## 7. Rows other plans own (cross-referenced, not absorbed; Jake 11-02)

- HOST-AUDIT: HA0/HA1/HA5 ↔ W1; HA2/HA3 slice ↔ M0.2; HA4a H021 ↔ M2.1; HA4b H073 ↔ W13/W15, H026 ↔ W18/M6.2, H059 ↔
  W16/M1.3; HA4d ↔ W13/W14; HA4e ↔ W4; H110, H043 ↔ W11.
- Custom sections (HA7, `docs/plans/host-audit/custom-sections-mini-plan.md`): CS5 is marked done but its exits (PH
  questRuntime, forest-story, native-story/spots, contracts, panels; DW discovery, interaction-source; NG chapters,
  content, finds) are Wave 1 work; CS6 done but W4 owes the plugin move; CS7 left the weather union out (W13 new);
  CS8 open ↔ W11; CS10 after Wave 1. Live `custom/` sections in scope: DW collections, enemyPlacements; PH questRuntime,
  kingKit, trophyMounts, cabinAmbience, thrallLook.
- SHARD-PLATFORM-NEXT: N2/N5 slices ↔ W4/W6/W11; N4 / G496 ↔ W5/W6/M3.1/M9.3; stretch S2 ↔ W15, S3 ↔ W14, S4 ↔ W18,
  S8 ↔ W19b/c.
- WASM-HOST: H6, H8, H17 via the CS plan; H9 in flight; H14 folds into the showcase.

## 8. Added by Jake 11-02

- **EC1 enemy cap:** full AI within 60 m, at most 16 animated on screen, the rest frozen or culled; every shard (16 h).
