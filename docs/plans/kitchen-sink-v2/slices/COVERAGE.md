# Kitchen Sink v2: every old row in exactly one slice

Every row id from the two-wave plan (KITCHEN-SINK.md §4–§5 and the kitchen-sink-v2 mini plans), mapped to the one
slice that carries it ([README.md](README.md)'s slice rule). Where a row is split, **Slice** is the slice that owns it
and **Also** names the slices that do a part. West ids are from [INDEX-west.md](INDEX-west.md) and the W slice files.
East ids: the slice files that existed when this was written (E0a–E0i, E1a–E1i) are named; the rest are **provisional** (prov.)
names for README's E rows, to be replaced by INDEX-east.md's ids:

| Provisional | README's E row |
|---|---|
| E1 | Band 1: Crate Mites, packs, respawn, XP, parts, contracts |
| E2 | Bands 2–6, night and rare variants |
| E-elites | elites (band-gate and night), trophies, finishes |
| E-stealth | the stealth yard, storm hour, beacons |
| E-vault | the Training Vault (shrine host + interior) |
| E-gauntlet | the gauntlet (wave director out of the plugin) |
| E-titan | the Crate Titan: one boss path, cutscene timeline, portal + hidden arena |
| E-quests | quest tiers (the 12 quests) |
| E-complete | the shard-complete card (completion validator) |
| E-audio | east audio |
| E-balance | balance |
| E-finish | Jake's east phone pass, grid-ready for the east |

Status words: **mapped** (a slice carries it), **orphan** (no slice named it; a proposal follows), **elsewhere** (owned
and run by another plan; no slice), **dropped** (no longer needed, reason given), **done** (already landed).

## 1. Old Wave 1 host rows (wave-1-hosts-mini-plan.md W1–W21; "W" here is old Wave 1, not a west slice)

| Old | What | Slice | Also | Status, note |
|---|---|---|---|---|
| W1 | ruler + host register (HA0/HA1/HA5) | W0c | W0d | mapped |
| W2 | interactables section | W4a | | mapped |
| W3 | commons AS prefabs (barrels, bridgeSway, director stage) | W4a | W6c, E-gauntlet | mapped |
| W4 | movers and director out of the plugin | W6a | E-gauntlet (director) | mapped |
| W5 | quests, dialogue, vendor, currency, shop | W1b | W1a, W2a, W2b | mapped |
| W6 | held weapons, ammo, parry | W3a | W3b, W3c, W3d | mapped |
| W7 | loaner mount | W10a | | mapped |
| W8 | riding course | W6d | W10b | mapped (the in-world course host is new work) |
| W9 | conveyor, jump pad | W6b | | mapped |
| W10 | grapple, stealth approvals | W7a | E-stealth | mapped |
| W11 | elites, waves, one boss path | E-titan (prov.) | E-elites, E-gauntlet | mapped |
| W12 | cutscene intro (IC1–IC4) | E-titan (prov.) | | mapped |
| W13 | weather / day-night rename | W11a | E-stealth (storm-hour trigger) | mapped |
| W14 | physics props, board, tricks, see-saw | W4a | W4b, W5a, W5b | mapped |
| W15 | portal, interiors, caves, the cube | W9a | W0e, E-vault, E-titan | mapped |
| W16 | benches, secrets, perks, trophies, finishes | W9b | E-elites | mapped |
| W17 | completion card required | E-complete (prov.) | | mapped |
| W18 | ladders, scramble, rope bridge | W8b | W6c, W8a | mapped |
| W19 | audio states | W11b | E-audio | mapped |
| W20 | one breadcrumb guide (merge `engine/quest/view.ts` and `game/quest/chapterDirector.ts`) | W1b | E1i (Pine's `lead` half) | **orphan** in the west: README puts it in W1, no west file names it; E1i takes Pine's half. Proposal: W1b (+6 h) merges the two guides, proved by W1b's quest-shard parity list |
| W21 | docs and template rows | W12 | E-finish | mapped (IMPACT Q11 recommends each slice adds its own template row) |

## 2. Migration rows (wave-1-migration-map.md M0–M9, §8 EC1)

| Old | What | Slice | Also | Status, note |
|---|---|---|---|---|
| M0.1 | shared parity kit | W2a | W6a | **orphan**. Proposal: no standalone kit; each slice commits the fixtures it needs, the first helpers land in W2a (old-save fixtures) and W6a (mover replay) (IMPACT §6) |
| M0.2 | fresh-seat scoring of touched hosts | W0c | W0d | mapped (measuring half W0c; scoring per slice through the W0d register) |
| M1.1 | DW onto LE1–5 / LE9 | W2a | W2b, E1d (bounty), E1e (harvest) | mapped |
| M1.2 | PH (bolts → a grant) | W2a | W2b, E1e (harvest) | mapped |
| M1.3 | NG finishes + legendaries, retire `cosmeticFinishes` | E-elites (prov.) | | **orphan**: no slice names it. Proposal: E-elites (night elites with finishes, LW6), with HA4b H059 |
| M1.4 | SR / SD coins | W2a | | mapped |
| M1.5 | T / IC / PP | W2a | | mapped |
| M1.6 | item save shim | W2a | | mapped (first) |
| M2.1 | PH questRuntime + forest-story → rows + AS | E1h | E1i | mapped; overlaps custom-sections Z8 |
| M2.2 | PH board on QC5 | E1f | | mapped |
| M2.3 | DW composition / discovery / interaction-source | W1b | | mapped for parity; the data moves are custom-sections Z8 (IMPACT Q5: fold unstarted Z8 into W1b / E1) |
| M2.4 | NG chapters / content / carried / panels | W1b | | mapped, same note |
| M2.5 | SR / SD / ND quest rows | W1a | W1b | mapped (nothing to move) |
| M2.6 | templates | W1b | | mapped |
| M3.1 | PH held/equipment → families | W3b | W3c | mapped |
| M3.2 | NG weapon JSON | W3b | W3c | mapped (bow, rifle); sabre / spear pages are Z6, in flight |
| M3.3 | DW arms + maxHitDamage | W3a | E0a | mapped (no change; `maxHitDamage` stays DW's flat rule, 19z) |
| M3.4 | ND jian → rows + GLB | — | | **elsewhere**: custom-sections Z6 (in flight, sp-x8: jian cloth / halo / row); no showcase piece uses it |
| M3.5 | SR / SD `held.melee` | — | | **dropped**: 19z leaves their combat as it is; W3d proves them bit-identical |
| M3.6 | templates (combat) | E0a | | mapped (rewritten for 19z: an opt-in template example, no flat-L1 profile) |
| M4.1 | PH rarity → a shared row | E2 (prov.) | | mapped (with EBW6) |
| M4.2 | PH night director → rows | E2 (prov.) | | mapped |
| M4.3 | DW enemyPlacements → spawns | E1 (prov.) | | mapped; overlaps Z4 |
| M4.4 | NG elites + night | E-elites (prov.) | | mapped |
| M4.5 | SR / SD / T species | E1 (prov.) | | mapped |
| M5.1 | DW Captain | E-titan (prov.) | | mapped |
| M5.2 | PH King | E-titan (prov.) | | mapped |
| M5.3 | NG Titan + Golden King | E-titan (prov.) | | mapped; overlaps Z14 |
| M5.4 | SR roc + SD matriarch | E-titan (prov.) | | mapped |
| M5.5 | T boss | E-titan (prov.) | | mapped |
| M5.6 | five intros → the timeline | E-titan (prov.) | | mapped |
| M6.1 | door / items / idle.as → commons | W4a | | mapped |
| M6.2 | SR bridges → rope deck | W6c | | **dropped** (W6c: Sky's bridges are movers, not rope) |
| M6.3 | NG kunes bridge | W6c | | mapped as a no-op unless Jake picks sway (W6c Q2) |
| M6.4 | PH cave, NG arena, ND portal → `world/interior` | W9a | E-vault, E-titan | mapped (cave W9a; portal and arena east) |
| M6.5 | PH / ND / SR / SD movers | W6a | | mapped (ND's view-WASM movers untouched) |
| M7.1 | PH weather | W11a | | mapped |
| M7.2 | NG weather | W11a | | mapped |
| M7.3 | SD `weather.fields` | W11a | | mapped as a no-op (field weather is a different feature) |
| M7.4 | DW / T / IC / PP days | W11a | | mapped as a no-op (day rows stay in the manifests) |
| M8.1 | NG `audio.scene` → zones | E-audio (prov.) | | **orphan**: W11b says it waits. Proposal: E-audio, the zones remainder only (Z11 already qualified NG `audio/scene`, `7cc93a3856`) |
| M8.2 | PH cabin ambience | — | | **dropped (likely done)**: Z11 retired the dead Pine ambience and PH's built output has no `custom/cabinAmbience`; E-audio confirms |
| M8.3 | boss slots | E-audio (prov.) | | mapped (with W19c) |
| M9.1 | DW collections | W9b | | mapped (CS10-E1 already ported the section, `3c42144c50`) |
| M9.2 | one feats row DW / PH / NG | W9b | E-complete | mapped (west feats; loot feats east) |
| M9.3 | compendium icons | — | | **orphan**: W9b leaves Pine's compendium alone. Proposal: **elsewhere**, HOST-AUDIT HA4d (Pine's icon picklist in `format/compendiumRows.ts:21` is a shard noun in format); no showcase piece needs it |
| M9.4 | NG finds | W9b | | mapped |
| EC1 | enemy cap | E0h | | mapped |

## 3. Levels and combat (levels-combat-mini-plan.md)

| Old | Slice | Status, note |
|---|---|---|
| LV1 progression rows | E0a | mapped |
| LV2 formula module | E0a | mapped |
| LV3 engine outcome, `damage.missed`, rng | E0b | mapped |
| LV4 stat stage | E0b | mapped (streak guard dropped, 19n) |
| LV5 actor stats | E0c | mapped (boss phases as attribute effects in the boss slices) |
| LV6 experience host | E0d | mapped |
| LV7 weapon / ammo scaling fields | E0i | mapped |
| LV8 `pays: false`, `minLevel` | E0d | mapped (`minLevel` in E1g) |
| LV9 AS queries for grade and attributes | E2 (prov.) | mapped with the Arc Sentry's parry (LS7) |
| LV10 band respawn, night-shift variants | E1c | mapped; night variants E7b (named by E1c) |
| LV11 behind Developer | E0a | mapped |
| LV12 flat parity | E0a | mapped, rewritten for 19z (no levels outside the showcase) |
| LVH1 badge + XP bar | E0e | mapped |
| LVH2 nameplate level | E0f | mapped |
| LVH3 outcome numbers | E0f | mapped |
| LVH4 Character tab | E0f | mapped |
| LVH5 level-up banner, death "−XP" | E0e | mapped |
| LS1 showcase progression rows | E0a | mapped (prov.: its showcase piece) |
| LS2 six band species with levels | E2 (prov.) | mapped (band 1 in E1c) |
| LS3 Big Pallet, Vault Warden, Foreman, Titan | E-elites (prov.) | mapped; Warden in E-vault, Titan in E-titan |
| LS4 band strips, west `pays: false` | E1c | mapped (band 1; later bands E2) |
| LS5 quest `minLevel`, kill contracts | E1g | mapped |
| LS6 weapon tiers, vendor stock | E0i | mapped |
| LS7 Arc Sentry parry, Level 10 / 20 feats | E2 (prov.) | mapped |
| LVF1 slip | E0b | mapped |
| LVF2 deflect clang | E0b | mapped |
| LVF3 words and colours | E0f | mapped |
| LVF4 clang / whoosh / ring / thud / crack SFX | E-audio (prov.) | mapped (no E0 file names it) |
| LVF5 hurt arc on you | E0b | mapped |
| LVF6 one-time DEFLECT hint | E0b | mapped |

## 4. Loot and economy (loot-economy-mini-plan.md)

| Old | Slice | Also | Status, note |
|---|---|---|---|
| LE1 currency row | W2a | | mapped |
| LE2 kill payouts | E1d | | mapped |
| LE3 salvage rows out of `Inventory.ts` | E1e | | mapped |
| LE4 pack catalogue | W2a | | mapped |
| LE5 exchange: level gate, costs, tabs | W2b | E0i (gate goes live) | mapped |
| LE6 upgrade effect rows | E0i | W5b, W7a | mapped (toy half west, combat half E0i) |
| LE7 fixed reward rows | E1f | E-elites, E-titan | mapped (contract part E1f) |
| LE8 contract board fixed mode | E1f | | mapped |
| LE9 trophy wall row | W9b | E-elites | mapped (collectibles west, frames east) |
| LE10 economy golden test | E-balance (prov.) | W2a (DW / PH parity numbers) | mapped |
| LW1 Scrip, payouts | E1d | E2 | mapped |
| LW2 parts, cores, salvage, pack catalogue | E1e | E2 | mapped (band 1 in E1e) |
| LW3 Tinker Rook | W2b | | mapped |
| LW4 contract board content | E1f | E2 | mapped (band 1 in E1f) |
| LW5 12 chests + Vault chest | E2 (prov.) | E1d (band 1), E-vault | mapped |
| LW6 night elites' finishes and trophies | E-elites (prov.) | | mapped |
| LW7 mini-boss and Titan rewards | E-titan (prov.) | | mapped |
| LW8 trophy wall, Gold 1×1s, Calibration Chips | W9b | E-elites | mapped |
| LW9 loot feats and titles | E-complete (prov.) | | mapped |
| LW10 balance pass | E-balance (prov.) | | mapped |

## 5. HUD, quests, enemies, shrine, audio, map

| Old | Slice | Also | Status, note |
|---|---|---|---|
| HC1 XP bar + LV chip | E0e | | mapped |
| HC2 level-up moment | E0e | | mapped |
| HC3 floating numbers | E0f | W3d, W5b (words) | mapped |
| HC4 nameplates | E0f | | mapped |
| HC5 Character tab | E0f | | mapped |
| HC6 giver "!" markers | W1b | | mapped |
| HC7 death card XP line | E0e | | mapped |
| QC1 quest level, marker state | W1b | E1g (level half) | mapped |
| QC2 parallel freeform quests | W1b | | mapped |
| QC3 counter steps | E1g | | mapped |
| QC4 discover-N | W1b | | mapped |
| QC5 generic contract board | E1f | | mapped |
| QC6 checkpoint card | W1b | | mapped |
| QK1 author the 12 quests | E-quests (prov.) | W1b (west tour quest), E1g (tier 1) | mapped |
| EBW1 frontal-arc block | E2 (prov.) | | mapped |
| EBW2 creature projectiles | E2 (prov.) | | mapped |
| EBW3 interruptible wind-up | E-elites (prov.) | | mapped |
| EBW4 variant look on one GLB | E2 (prov.) | | mapped |
| EBW5 no respawn in view | E1c | | mapped |
| EBW6 shared rarity row | E2 (prov.) | | mapped |
| EBW7 elite from a director stage | E-gauntlet (prov.) | | mapped |
| EB1 reference sheets | E1a | E1b (the Mite) | mapped |
| EB2 robot Blender pipeline | E1a | | mapped |
| EB3 six band robots | E2 (prov.) | E1b (the Mite) | mapped |
| EB4 band rows | E1c | E2 | mapped (band 1 in E1c) |
| EB5 night and rare variants | E2 (prov.) | | mapped |
| EB6 band-gate elites | E-elites (prov.) | E-vault (Warden) | mapped |
| EB7 night elites | E-elites (prov.) | | mapped |
| EB8 Crate Titan | E-titan (prov.) | | mapped |
| EB9 Titan intro as cutscene data | E-titan (prov.) | | mapped |
| EB10 tuning | E-balance (prov.) | | mapped |
| DG1 sealed room | E-vault (prov.) | | mapped |
| DG2 room checkpoints | E-vault (prov.) | | mapped |
| DG3 shrine card + best time | E-vault (prov.) | | mapped (reuses W6d's course timer and the completion card) |
| DG4 `shrine` composition rows | E-vault (prov.) | | mapped |
| DG5 DW sea cave as second user | E-vault (prov.) | | mapped only with Jake's OK (G595); else the shrine host is a one-user host in the register |
| W19a named stings | W11b | | mapped |
| W19b layers by a scene field | E-audio (prov.) | | mapped |
| W19c boss / elite scene fields | E-audio (prov.) | | mapped |
| W19d one-genre set | W11b | | mapped |
| W19e metal impacts | E-audio (prov.) | | mapped (the west's plates and crates use the existing wood / stone until then) |
| W19f new event cues | E-audio (prov.) | | mapped |
| AU1 briefs | W11b | E-audio | mapped |
| AU2 music | W11b | E-audio | mapped |
| AU3 stings, Titan intro cue | W11b | E-audio | mapped |
| AU4 SFX | W11b | E-audio | mapped |
| AU5 rows | W11b | E-audio | mapped |
| AU6 mix pass, memory read | E-audio (prov.) | W12 | mapped |
| ML1 round 2 blockout | — | | **done** |
| ML2 layout → skeleton data | W0a | | mapped |
| ML3 night-elite lair names | E-elites (prov.) | | mapped |

## 6. Wave 2 rows (KITCHEN-SINK.md §5, K1–K12): umbrellas over the slices

| Old | Slice | Also |
|---|---|---|
| K1 skeleton | W0a | W0b |
| K2 the west toys | W3a | W3b–W10b (spread over the toy slices) |
| K3 bands 1–6 | E1 (prov.) | E2 |
| K4 elites, stealth yard, gauntlet | E-elites (prov.) | E-stealth, E-gauntlet |
| K5 the Training Vault | E-vault (prov.) | |
| K6 the Crate Titan | E-titan (prov.) | |
| K7 quests, board, storm hour, cards | E-quests (prov.) | W1b, E1, E-stealth, E-complete |
| K8 economy, pack, collectibles, FINDS | W2a | W2b, W9b, E1, E-elites |
| K9 audio | W11b | E-audio |
| K10 grid-ready | W12 | E-finish |
| K11 balance | E-balance (prov.) | |
| K12 Jake plays it | W12 | E-finish |

## 7. "Cleanup in other plans" (wave-1-hosts §Cleanup and migration-map §7)

These stay owned by their plans (Jake 11-02, 19l); a slice runs a row and marks it done there.

| Item | Slice | Status, note |
|---|---|---|
| HOST-AUDIT HA0 | W0c | mapped |
| HA1 | W0c | mapped |
| HA5 | W0d | mapped |
| HA4b forest family (H073) | W11a | mapped (cave half W9a) |
| HA4b `ropeDeckSite` (H026) | W6c | mapped |
| HA4b `cosmeticFinishes` (H059) | E-elites (prov.) | **orphan**; proposal with M1.3 |
| HA4b `sceneDressing` | — | **elsewhere**: no showcase piece uses it; stays HOST-AUDIT |
| HA4d the hoverboard | W5a | mapped (look only; the law stays engine) |
| HA4d `engine/player/nalatiArms.ts` | W3b | **orphan**. Proposal: W3b; it is read by `game/weapons/starterBowProfile.ts` and `heldLauncher.ts` on the bow path |
| HA4d `engine/world/steppeWind.ts` | W11a | mapped (also read by SR / SD painted looks, IMPACT §10) |
| HA4d HUD item labels | W2a | **orphan**. Proposal: W2a, with the pack catalogue labels (LE4) |
| HA4e plugin routes | W6a | mapped (mover route; each other route with its slice: W3c firearm, E-gauntlet director, E-titan bossPhase) |
| H110 Titan open-arena projection | E-titan (prov.) | mapped |
| H043 arena rooms / fire / encounter views | E-titan (prov.) | mapped |
| HA4a H021 quest page views | E1h | mapped with M2.1 |
| HA2 / HA3 slice | W0d | mapped (= M0.2) |
| CS5 quests | — | **done** 2026-11-02 in its plan; its last Pine exit closes in E1i, the rest are Z8 (M2.3, M2.4 above) |
| CS6 director envelope | E-gauntlet (prov.) | mapped (CS6 done; the plugin move it owed is here) |
| CS7 weather and held kits | W11a | mapped (CS7 done; the weather union it left out is here) |
| CS8 combat, boss, riding | E-titan (prov.) | mapped; CS8 was folded into Z14 on 2026-11-03 (riding part W10a) |
| CS10 delete the custom path | — | **done** 2026-11-03 for its exact slices; the path deletion is now Z15, after the slices that still read custom sections |
| NEXT N2/N5 `mover.ts` | W6a | mapped |
| N2/N5 `director.ts` | E-gauntlet (prov.) | mapped |
| N2/N5 `heldFirearm.ts` | W3c | mapped |
| N2/N5 `bossPhase.ts` | E-titan (prov.) | mapped |
| NEXT N4 / G496 (held catalogue 2/6) | W3b | mapped |
| NEXT S2 interiors | W9a | mapped (also E-vault) |
| NEXT S3 physics toys | W4b | mapped (also W4a) |
| NEXT S4 climb mode | W8b | mapped |
| NEXT S8 adaptive music | E-audio (prov.) | mapped |
| WASM-HOST H6 | E1h | mapped (PH questRuntime → AS) |
| WASM-HOST H8 | — | **dropped**: parry stays a native window (W3d); only the Arc Sentry's decision is AS |
| WASM-HOST H9 | — | **elsewhere**: in flight in WASM-HOST (view lane) |
| WASM-HOST H14 demo shard | W12 | mapped: folds into the showcase (its p99 script-time reading at W12, again at E-finish) |
| WASM-HOST H17 | — | **elsewhere**: headless v2, not needed by a slice |
| IN-GAME-CUTSCENES IC1 | E-titan (prov.) | mapped |
| IC2 | E-titan (prov.) | mapped |
| IC3 | E-titan (prov.) | mapped |
| IC4 | E-titan (prov.) | mapped |
| BURN-DAMAGE D53 (+ D192) | — | **orphan**. Proposal: **elsewhere**, stays on BURN-DAMAGE-LIST; W0c's ruler reads around it and no showcase piece depends on it |
| D59 decision-module cap | W0e | mapped (IMPACT Q1 on the number) |

## 8. Orphans and their proposals

| Orphan | Proposal |
|---|---|
| W20 breadcrumb merge | W1b, +6 h (E1i already takes Pine's half) |
| M0.1 parity kit | no row: fixtures per slice, first helpers in W2a and W6a |
| M1.3 + HA4b H059 NG finishes, `cosmeticFinishes` | E-elites (night-elite finishes are its second user) |
| M8.1 NG audio scene → zones | E-audio (the zones remainder after Z11) |
| M9.3 compendium icons | HOST-AUDIT HA4d; out of the showcase |
| HA4d `nalatiArms.ts` | W3b |
| HA4d HUD item labels | W2a |
| D53 / D192 | stays on BURN-DAMAGE-LIST |

## 9. Platform-only rows (no showcase piece) and who carries them

W0c (HA0, HA1, M0.2 measuring), W0d (HA5, HA2 / HA3 scoring), W0e (the cube validator, D59), the plugin moves inside
their slices (N2/N5 `mover.ts` in W6a, `heldFirearm.ts` in W3c, `director.ts` in E-gauntlet, `bossPhase.ts` in E-titan),
HA4d's moves (board look W5a, wind W11a, `nalatiArms.ts` W3b), the weather union (CS7) in W11a, the save shim (M1.6) in
W2a, the parity-only quest duty (M2.3–M2.6) in W1b, the completion backfill of every product (W17) in E-complete, the
no-op migrations (M6.3, M7.3, M7.4). Dropped or elsewhere: M3.4 (Z6), M3.5, M6.2, M8.2, M9.3 (HOST-AUDIT), HA4b
`sceneDressing`, H8, H9, H17, D53 / D192.

## 10. Totals

| Source | Old ids | West | East | Dropped / elsewhere / done |
|---|---:|---:|---:|---:|
Counted by the owning **Slice** column of the tables above (a row whose slice decided it a no-op or dropped, e.g. M6.2
in W6c, counts with that slice).

| Source | Old ids | West | East | No slice (dropped / elsewhere / done) |
|---|---:|---:|---:|---:|
| Wave 1 hosts W1–W21 | 21 | 18 | 3 | 0 |
| Migration M0–M9 + EC1 | 48 | 26 | 18 | 4 (M3.4, M3.5, M8.2, M9.3) |
| Levels LV / LVH / LS / LVF | 30 | 0 | 30 | 0 |
| Loot LE / LW | 20 | 6 | 14 | 0 |
| HUD HC | 7 | 1 | 6 | 0 |
| Quests QC / QK | 7 | 4 | 3 | 0 |
| Enemies EBW / EB | 17 | 0 | 17 | 0 |
| Shrine DG | 5 | 0 | 5 | 0 |
| Audio W19a–f / AU | 12 | 7 | 5 | 0 |
| Map ML | 3 | 1 | 1 | 1 (ML1 done) |
| Wave 2 K1–K12 | 12 | 6 | 6 | 0 |
| Cleanup items (incl. HA2 / HA3) | 41 | 20 | 14 | 7 |
| **Total** | **223** | **89** | **122** | **12** |

Orphans (section 8): 8 rows covering 9 ids, each with a proposal; 2 of them (M9.3, D53 / D192) are proposed to stay
with their own plans.

**Hours.** Old: Wave 1 ≈ 1,040 h (planned host rows ≈ 675 h + migration rows ≈ 365 h) plus Wave 2 ≈ 30 lane-days
(≈ 240 h) ≈ **1,280 h**. New: the west is **810 h** (INDEX-west: 365 engine / 181 migration / 264 shard) for 89 old
ids plus new work the old rows missed (the in-world course host W6d, the records host W3a, grind rails W5c, the honest
grid slot, the Rock and its cave). The east's hours come from INDEX-east.md; at the old total, the east would have
about 470 h for 122 old ids (levels, bands, elites, the vault, the Titan and its intro). The old plan itself warned its
enemies, audio and loot estimates had already come in above their first budgets, so expect the whole to pass 1,280 h.
