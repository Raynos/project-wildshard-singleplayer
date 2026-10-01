# GAME-NORMALIZATION v2 · 04 — The move map: every file → its layer and destination

This spec is the one mapping table the F6 codemod runs from (TP7), plus the later rows that finish a file's move. It
covers every file under `src/` (906 at `0b6aa045`, `src/dev/` included), the 117 test files, the 48 scripts and configs
that name `src/` paths, and the generated modules. The machine-readable copy is [move-map.json](move-map.json); this
file is its reviewed form, and the two are generated from one source (§7.1).

It builds on [01-architecture](01-architecture.md) §0, §20–§22 and §24, and stays consistent with
[05-nine-dragon](05-nine-dragon.md), [06-pine-hollow](06-pine-hollow.md), [09-combat-ai](09-combat-ai.md) and the
F6 section of [02-foundations](02-foundations.md) (a draft). Every place it departs from one of them is listed in
§1.5 and asked in §10. 07-nalati and 08-driftwood are being written beside it: every Nalati or Driftwood placement
that is a judgment call (not a folder rule) carries `07` or `08` in the Confirm column, and §9 lists them.

## 0. How to read this spec

| Item | Rule |
|---|---|
| **Tree** | `0b6aa045` (2026-09-30), `git ls-files src`: 906 files. Lines are `wc -l`; images show their size. A file added after this tree gets a row by §1's rules before F6 runs: the classifier refuses an unmapped file (§7.1) |
| **Prefixes** | `E:` = `src/engine/`, `G:` = `src/game/`, `K:` = `src/kit/`, `ND:` / `PH:` / `NG:` / `DI:` = `src/shards/nine-dragon-stack/`, `pine-hollow/`, `nalati-grasslands/`, `driftwood-isle/` |
| **Columns** | **Today** (the path under the group's folder) · **Lines** · **After F6** (where the codemod puts it; `✗` = deleted before F6, by F7) · **Final** (where it is when the plan is archived; `=` = unchanged after F6; `✗` = deleted by the row) · **Layer** (final) · **Rule** (§1.2) · **Row** · **Why** · **Confirm** |
| **Row notation** | `F6`: moved once, by the codemod. `F6 (+S2.1)`: moved at F6 to its final path; S2.1 changes it **in place**, with no second move. `F6 → S2.3`: F6 puts it on an interim path, and S2.3 moves, splits or deletes it with the same codemod (`move.mjs --row S2.3`, §7.6). `F7`: deleted before F6 |
| **"In place"** | 05 and 06 name a later row in their *When* column for some files that move whole (`pinehollow/elites.ts` "S2.3", `grapple/Traversal.ts` "S1.4"). In this map the move itself is F6's, and the named row changes the file where it lies (§1.1 rule 1) |

## 1. The mapping rules

### 1.1 Principles

1. **One move per file.** A file whose final home is known and that moves whole goes there at F6, even if a later row
   rewrites its insides. `git log --follow` then shows one rename.
2. **An interim path only when a file can't move whole yet.** That is: it is split (§3), a later row deletes it, it is
   rebuilt into a new file set (a weapon family, the species rows), it is looked up by a computed key, or it is renamed
   together with its exports. The interim path follows today's use (02 F6's rules), and the later row moves it with
   the same codemod.
3. **Asset basenames never change.** Vite emits `[name]-[hash].[ext]`, so a renamed image gets a new precached URL.
   Images change folder, never name.
4. **No shard ↔ shard import is created.** A file never lands in a shard that another shard imports it from.
   Temporary upward imports are allowed (engine → game / kit / shard, kit → shard). Each one is a `wildshard/layer`
   ratchet count recorded at F6 (02 F6 step 5), and the row that moves its target takes it to 0.
5. **`public/assets/` does not move** (plan F6; TP §5).

### 1.2 The rules, in order (the first that matches decides; the `Rule` column)

| Code | Rule | Destination | Source |
|---|---|---|---|
| **D** | Dead: deleted before F6 | — (F7) | 02 F7 |
| **T** | Shard territory by path: `src/chunks/<slug>.ts` → `<slug>/manifest.ts`; `src/chunks/<slug>/**`, `src/nalati/**`, `src/pinehollow/**`, `src/chunks/{nalatiLayout,nalatiEdge,pineHollowLayout}.ts`, `src/chunks/thumbs/<slug>*` → the shard folder (renamed as 05 §1.1 and 06 §1.2 say) | the shard | 02 rule 1 |
| **X-SPECIES**, **X-WEAPON**, **X-GLOB** | The interim exceptions E1–E3 (§1.3) | interim at F6, final in the named row | this spec |
| **SPLIT** | A mixed file that a later row splits (§3) | interim at the layer of its largest part | this spec |
| **I** | Single-shard by importers: every non-test importer belongs, after the fixpoint, to one shard | that shard | 02 rule 2 |
| **G** | Single-shard by a `main.ts` gate (`isOcean`, `isPine`, `painterly`, `slug ===`, `built`) | that shard | 02 rule 3 |
| **N** | Named single-shard (`Pine*`, `pine*`, `nalati*`, `Island*`, `Steppe*`, `driftwood`) whose importers are that shard's or engine files | that shard | 02 rule 4 |
| **M** | Mechanism: a loader, runtime or primitive with no shard data. Overrides I, G and N | engine | 02 rule 5, 01 §2.1 |
| **K** | Content that 2+ shards use (the rule of two) | kit | 01 §21 |
| **GM** | Wildshard's own rules: the manifest type, title deck, Bag, coins, loot, compendium, feats, travel | `src/game/` | 01 §20 |
| **SPEC** | Placed by name in 01, 02, 05, 06 or 09 | as that spec says | — |
| **F** | Everything else, by folder: `src/<folder>/**` → `src/engine/<folder>/**`; `src/game/**` keeps its path (it becomes `#game`); `src/*.d.ts` → `E:types/`; `src/pwa/sw.js` → `E:pwa/sw.js` | engine / game | 02 rule 6 |

### 1.3 The interim exceptions

| Id | Files | Why they wait | Final move |
|---|---|---|---|
| **E1** X-SPECIES | The 21 species files of `src/entities/species/` (all but `registry`, `loft`, `rigs`, which are engine) and the creature stack they import: `Flock`, `Pack`, `Herd`, `Wildlife`, `Marmots`, `wildEnv`, `creatureKit`, `creatureCoats`, `glbCreatures`, `creatureRigs`, `painterlyAnimals`, `lowpoly`, `pineCreatures`, `pineCoats`, `pineCreatureRigs`, `bearFix` (37 files, 9,283 lines) | `AnimalFactory.ts:15` registers every species through an eager `import.meta.glob('./species/*.ts')`. Moving a species out of that folder at F6 would mean rewriting the glob and changing the registration order. The species rows replace the glob with `manifest.species` rows anyway. Kept together, F6 changes no registration and adds no engine → shard edge that the rows would only remove again | S2.3 (kit boar, bear, lowpoly; Pine's deer, elk, thrall and hulls), S3.4 (Nalati), S4.2 (Driftwood) |
| **E2** X-WEAPON | `Sword`, `SwordMoves`, `MeleeSweep`, `Weapon`, `Weapons`, `bladeGlow`, `Bow`, `bowDraw`, `Longbow`, `Crossbow`, `Rifle`, `Projectiles`, `hunterHands`, `nalatiArms`, `viewmodelTextures` (+ worker), `world/painterly.ts` | Rebuilt into the Equipment contracts, the families and the blocks (09 §1.3–§1.5, §6). Their final file is the family or the block, not today's file. `painterly.ts` waits because the Bow, Spear, Reins, Terrain and DayClock import it until S2.2 / S3.2 | S1.2 (melee, contracts), S2.2 (ranged), S3.2 (painterly), S4.3 (bladeGlow) |
| **E3** X-GLOB | `src/explore/img/mockups/*.jpg` (26) | `Compare.ts:10` looks each picture up by a computed key (`./img/mockups/${name}.jpg`), which the codemod can't rewrite. They move with each shard's `manifest.explore.compare` | S1.1, S2.1, S3.1, S4.1 |
| **E4** | The engine runtimes inside today's `src/game/`: `Boss.ts`, `Elite.ts`, `quest/core.ts`, `quest/quest.ts`, `quest/QuestUI.ts` | They stay in `#game` at F6 (02 F6 map) and become the boss, elite and quest runtimes | S2.3, S2.5 |
| **E5** | `boot/nineBootTrace.ts`, `boot/nineGpuTrace.ts` | The file is renamed together with its exports (`recordNine…` → `record…`) | S1.1 |
| **E6** | The resident host: `shard/ShardHost.ts`, `shard/disposeListeners.ts`, `core/shardState.ts`, `core/shardScope.ts`, `physics/bridge.ts` | Deleted or renamed by F11 (02 F11) | F11 |

### 1.4 The destination skeletons (when every row has run)

From F6 on, `src/` holds exactly `engine/`, `game/`, `kit/` and `shards/` (02 F6 done-when).

| Layer | Folders |
|---|---|
| `src/engine/` | Today's `audio boot core entities explore fx models native physics player practice pwa telemetry ui world` moved as they are, plus `types/`, `practice/playground/` (01 §22) and `world/forest/` (06 §1.3). The rows add `app/ events/ saves/ input/ render/ combat/ combat/blocks/ ai/ quest/ anim/ debug/ strings/ analytics/` (01). `engine/shard/` is empty after F11 and removed |
| `src/game/` | `shard/` (the manifest type and the generated registry), `bag/`, `loot/`, `compendium/`, `complete/`, `travel/`, `cosmetics/` (X5), `audio/` (the Wildshard theme), `titleDeck.ts`, `Inventory.ts`, `Progress.ts`, `LastPlace.ts`, `achievements.ts` |
| `src/kit/` | `viewmodel/`, `looks/`, `weapons/{melee,bow,crossbow,firearm,thrown}/`, `species/`, `weather/`, `npc/`, `tools/`, `models/`, `audio/`, `interact/`, and `effects/` (new files at S2.5) |
| `src/shards/nine-dragon-stack/` | 05 §1.1: `manifest.ts plugin.ts` + `grapple/ look/ models/ vm/ world/ playground/ explore/ thumbs/` |
| `src/shards/pine-hollow/` | 06 §1: `manifest.ts plugin.ts layout.ts roster.ts compendium.ts` + `audio/ combat/ loadout/ weapons/ species/ life/ quest/ look/ world/ models/ dev/ explore/ thumbs/` |
| `src/shards/nalati-grasslands/` | Today's `src/nalati/**` at the root (02 rule 1), `manifest.ts layout.ts edge.ts quest.ts roster.ts` + `models/ look/ world/` (was `src/world/nalati/`) `ride/ weapons/ species/ creatures/ audio/ playground/ explore/ thumbs/` |
| `src/shards/driftwood-isle/` | `manifest.ts firstMinutes.ts fpArms.ts roster.ts` + `models/ world/ audio/ creatures/ species/ npc/ quest/ loot/ look/ weapons/ explore/ thumbs/` |

### 1.5 Where this map departs from the other specs

| # | The other spec says | This map | Why |
|---|---|---|---|
| 1 | 02 F6: `src/main.ts` → `src/engine/main.ts`. 05 §0: `src/main.ts` keeps its path until S4.4 | **Resolved (13 04#12, R1-03):** `src/main.ts` stays at the root permanently as the composition root (with `src/entry.ts`); the generic boot moves to `src/engine/boot.ts` at S4.4 | `src/` holds the four layer folders plus the two composition-root files |
| 2 | 02 rule 2: `src/chunks/fauna-layout.ts` → Pine | `E:world/faunaLayout.ts` | 06 §1.1: a placement primitive with no Pine word (M overrides I) |
| 3 | 02 Q10: `src/kit/` stays empty at F6 | 5 files enter the kit at F6: `vm/rig.ts` and `rigArms.ts` (05 §1.2), `Particles.ts` and `GrassTrample.ts` (06 §1.3), `GrassField.ts` (the trample reads it) | Whole-file moves with a known home (§1.1 rule 1). Families, species and weather still wait for their rows, for 02's reason |
| 4 | 02 rule 2 moves the 7 Nalati-only species and `eliteBrain.ts` to Nalati at F6 | They wait (E1); `eliteBrain.ts` merges into the engine `EliteBrain` at S2.3 | The species glob (E1); 09 §5.1 |
| 5 | 06 §6.4: Nalati's `world/Weather.ts` "stays at its path until S3.1" | `NG:world/Weather.ts` at F6 (02 rule 2); S2.4 restructures it in place | One move (§1.1). S2.4 edits the file wherever it lies |
| 6 | 02 rule 2: `src/models/slots.ts` → Driftwood | engine | `SlotGeometry` is a mechanism (M) |
| 7 | 06 §1.3: `LeverRifle.ts` → `src/kit/weapons/firearm/leverRifle.ts`. 09 §1.5: Pine's `weapons/`, `LeverRifle extends Firearm` there | `PH:weapons/LeverRifle.ts` at F6 | Rule of two (Pine only); 09 is the combat spec (Q3) |
| 8 | 01 §21, 09 §5.2, plan §2.5: the horse is kit | `NG:species/horse.ts`, with its brain stack in Nalati | Rule of two: 01 §22 moves the horse playground into Nalati, so only Nalati uses the horse (09 Q5 notes the same). A kit horse would pull `Herd` → `Pack` → `wildEnv` and the painterly look (~2k lines of Nalati wildlife AI) into the kit (Q1) |
| 9 | 06 §1.3: `Grass.ts` → Pine at "S2.1 (after S3.1 takes Nalati's GrassV2 dispatch out)" | `F6 → S3.1` | S3.1 runs after S2.1, and the file can only move once the dispatch is out (Q4) |
| 10 | 02 F9 step 3 edits `src/engine/ui/titleDeck.ts`. 01 §20: the title deck is `#game` | **Resolved (R1-04):** `G:titleDeck.ts` at F6 | 01 §20; "shard" is on the engine word list |
| 11 | 02 F11: "`src/engine/shard/switch.ts` stays" | `G:travel/switch.ts` at F6 | 01 §20: travel is `#game`; the engine word list forbids "shard". The file stays; it lives in `#game` |
| 12 | 02 F6 step 6: 28 tests move | 34 move at F6 (§4) | The Driftwood quest and loot files and 3 more Nalati files move at F6 here, so their tests move too |
| 13 | 05 §1.1 and 06 §1.2 give S1.1, S1.4 and S2.x as *When* for whole-file renames (`index.ts` → `world/install.ts`, `Traversal.ts` → `grapple/FeiZhua.ts`, `pinehollow/index.ts` → `combat/install.ts`, …) | The renames happen at F6; the rows restructure in place | §1.1 rule 1 |

## 2. The complete table: every file under `src/` (906)

Grouped by today's folder. Territory folders (`src/chunks/<slug>/`, `src/nalati/`, `src/pinehollow/`,
`src/world/nalati/`) keep their relative paths unless a row says otherwise. The same rows are in
[move-map.json](move-map.json) `files[]`.

#### `src/ (root)` — 3 files, 1,383 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `main.ts` | 1336 | `src/main.ts` | = | root | composition root | F6 → S4.4 | the composition root stays at `src/` (R1-03); its 91 gate lines leave in S1–S4, and the generic boot moves to `src/engine/boot.ts` (≤ 150) at S4.4, leaving main.ts ≤ 20 lines (split table §3.1) |  |
| `meshopt-simplifier.d.ts` | 10 | `E:types/meshopt-simplifier.d.ts` | = | engine | F | F6 | ambient module types (02 F6 folder map) |  |
| `n8ao.d.ts` | 37 | `E:types/n8ao.d.ts` | = | engine | F | F6 | ambient module types (02 F6 folder map) |  |

#### `src/audio/` — 18 files, 5,680 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `Audio.ts` | 1597 | `E:audio/Audio.ts` | = | engine | SPLIT | F6 (+S1.5, S3.5) | the mixer; per-shard SFX routings and beds leave for cue maps (split table §3.4) |  |
| `audioLog.ts` | 21 | `E:audio/audioLog.ts` | = | engine | F | F6 |  |  |
| `credits.ts` | 33 | `E:audio/credits.ts` | = | engine | F | F6 |  |  |
| `dsp.ts` | 183 | `E:audio/dsp.ts` | = | engine | F | F6 |  |  |
| `ForestAmbience.ts` | 288 | `PH:audio/ambience.ts` | = | PH | G | F6 (+S2.1, S3.5) | built only on Pine (main.ts:863; 06 §1.3) |  |
| `gen.ts` | 604 | `E:audio/gen.ts` | `K:audio/gen.ts` | kit | K | F6 → S3.5 | the procedural sound bank is content; Driftwood (IslandSfx) + Pine (interact sounds) use it; the engine Voices takes banks as data at S3.5 |  |
| `IslandAmbience.ts` | 387 | `DI:audio/ambience.ts` | = | DI | G | F6 (+S3.5) | built only on Driftwood (main.ts, isOcean; 02 rule 3) | 08 |
| `IslandSfx.ts` | 97 | `E:audio/IslandSfx.ts` | `DI:audio/sfx.ts` | DI | SPLIT | F6 → S3.5 | footsteps + combat layers → Driftwood; interact() sounds → kit (Pine quest uses them) (split table §3.13) | 08 |
| `Music.ts` | 933 | `E:audio/Music.ts` | = | engine | SPLIT | F6 (+S1.5, S3.5) | the music engine; the shard moods leave for ScoreSources (split table §3.5) |  |
| `PineHollowSfx.ts` | 291 | `PH:audio/sfx.ts` | = | PH | N | F6 (+S3.5) | Pine's voice engine (06 §1.3) |  |
| `preload.ts` | 125 | `E:audio/preload.ts` | = | engine | F | F6 |  |  |
| `score/wildshard-theme.ts` | 244 | `E:audio/score/wildshard-theme.ts` | `G:audio/wildshard-theme.ts` | game | GM | F6 → S1.5 | the Wildshard theme is a Wildshard idea (word list); a #game ScoreSource from S1.5 |  |
| `ShrineHum.ts` | 91 | `DI:audio/shrineHum.ts` | = | DI | G | F6 | the shrine hum, Driftwood only (02 rule 3) | 08 |
| `Stems.ts` | 238 | `E:audio/Stems.ts` | = | engine | F | F6 |  |  |
| `SteppeAmbience.ts` | 187 | `NG:audio/SteppeAmbience.ts` | = | NG | I | F6 (+S3.5) | imported only by nalati/sound.ts (02 rule 2) | 07 |
| `SteppeScore.ts` | 154 | `NG:audio/SteppeScore.ts` | = | NG | N | F6 (+S3.5) | Nalati's score deck (02 rule 4); Music.ts / extras.ts import it until S3.5's ScoreSource | 07 |
| `Surface.ts` | 54 | `E:audio/Surface.ts` | = | engine | F | F6 |  |  |
| `Voices.ts` | 153 | `E:audio/Voices.ts` | = | engine | F | F6 |  |  |

#### `src/boot/` — 29 files, 7,886 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `art.generated.ts` | 36 | `E:boot/art.generated.ts` | = | engine | F | F6 |  |  |
| `audio.generated.ts` | 1913 | `E:boot/audio.generated.ts` | = | engine | F | F6 |  |  |
| `audioFiles.ts` | 103 | `E:boot/audioFiles.ts` | = | engine | F | F6 (+S1–S4, X3) | engine boot; its shard branches become manifest boot data (01 §8; 05 §2.3; X3) |  |
| `bakedTextures.ts` | 113 | `E:boot/bakedTextures.ts` | = | engine | F | F6 |  |  |
| `bytes.generated.ts` | 1240 | `E:boot/bytes.generated.ts` | = | engine | F | F6 |  |  |
| `bytes.ts` | 219 | `E:boot/bytes.ts` | = | engine | F | F6 |  |  |
| `clearDownloads.ts` | 117 | `E:boot/clearDownloads.ts` | = | engine | F | F6 |  |  |
| `entry.ts` | 51 | `E:boot/entry.ts` | = | engine | F | F6 |  |  |
| `extras.ts` | 282 | `E:boot/extras.ts` | = | engine | F | F6 (+S1–S4, X3) | engine boot; its shard branches become manifest boot data (01 §8; 05 §2.3; X3) |  |
| `gpu.generated.ts` | 300 | `E:boot/gpu.generated.ts` | = | engine | F | F6 |  |  |
| `gpuFiles.ts` | 84 | `E:boot/gpuFiles.ts` | = | engine | F | F6 (+S1–S4, X3) | engine boot; its shard branches become manifest boot data (01 §8; 05 §2.3; X3) |  |
| `lastEnd.ts` | 152 | `E:boot/lastEnd.ts` | = | engine | F | F6 |  |  |
| `manifest.ts` | 107 | `E:boot/manifest.ts` | = | engine | F | F6 (+S1–S4, X3) | engine boot; its shard branches become manifest boot data (01 §8; 05 §2.3; X3) |  |
| `nineBootTrace.ts` | 282 | `E:boot/nineBootTrace.ts` | `E:boot/bootTrace.ts` | engine | M | F6 → S1.1 | generic boot trace a manifest flag turns on; renamed with its exports (05 §1.2; 02 rule 5) |  |
| `nineGpuTrace.ts` | 42 | `E:boot/nineGpuTrace.ts` | `E:boot/gpuTrace.ts` | engine | M | F6 → S1.1 | renamed with its exports (05 §1.2) |  |
| `pack.ts` | 189 | `E:boot/pack.ts` | = | engine | F | F6 |  |  |
| `packs.generated.ts` | 252 | `E:boot/packs.generated.ts` | = | engine | F | F6 |  |  |
| `perflog.ts` | 48 | `E:boot/perflog.ts` | = | engine | F | F6 |  |  |
| `plan.ts` | 241 | `E:boot/plan.ts` | = | engine | F | F6 |  |  |
| `precompile.ts` | 329 | `E:boot/precompile.ts` | = | engine | F | F6 |  |  |
| `prefetch.ts` | 110 | `E:boot/prefetch.ts` | = | engine | F | F6 (+S1–S4, X3) | engine boot; its shard branches become manifest boot data (01 §8; 05 §2.3; X3) |  |
| `shardPrefetch.ts` | 280 | `E:boot/shardPrefetch.ts` | = | engine | F | F6 (+S1–S4, X3) | engine boot; its shard branches become manifest boot data (01 §8; 05 §2.3; X3) |  |
| `shell.ts` | 32 | `E:boot/shell.ts` | = | engine | F | F6 |  |  |
| `steps.ts` | 131 | `E:boot/steps.ts` | = | engine | F | F6 (+S1–S4, X3) | engine boot; its shard branches become manifest boot data (01 §8; 05 §2.3; X3) |  |
| `stuck.ts` | 182 | `E:boot/stuck.ts` | = | engine | F | F6 |  |  |
| `sw.ts` | 199 | `E:boot/sw.ts` | = | engine | F | F6 |  |  |
| `timing.ts` | 57 | `E:boot/timing.ts` | = | engine | F | F6 |  |  |
| `titleArrival.ts` | 36 | `E:boot/titleArrival.ts` | = | engine | F | F6 |  |  |
| `versions.generated.ts` | 759 | `E:boot/versions.generated.ts` | = | engine | F | F6 |  |  |

#### `src/chunks/` — 23 files, 3,065 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `_template.ts` | 146 | ✗ | = | ✗ | D | F7 | dead: imported by nothing; Z1 builds src/shards/_template/ (02 F7 step 3) |  |
| `ChunkDef.ts` | 678 | `G:shard/manifest.ts` | = | game | SPEC | F6 | ChunkDef → ShardManifest (02 F6 step 4; 01 §6) |  |
| `driftwood-isle.ts` | 281 | `DI:manifest.ts` | = | DI | T | F6 | shard def → manifest (02 rule 1) |  |
| `fauna-layout.ts` | 122 | `E:world/faunaLayout.ts` | = | engine | SPEC | F6 | placement primitive with no Pine word (06 §1.1; 01 §17). 02 rule 2 would send it to Pine: Q2 |  |
| `nalati-grasslands.ts` | 661 | `NG:manifest.ts` | = | NG | T | F6 | shard def → manifest (02 rule 1) |  |
| `nalatiEdge.ts` | 105 | `NG:edge.ts` | = | NG | T | F6 | 02 rule 1 |  |
| `nalatiLayout.ts` | 161 | `NG:layout.ts` | = | NG | T | F6 | 02 rule 1 |  |
| `pine-hollow.ts` | 333 | `PH:manifest.ts` | = | PH | T | F6 (+S2.1 split) | shard def → manifest; S2.1 moves :23-216 verbatim to world/terrain.ts (06 §1.1) |  |
| `pineHollowLayout.ts` | 296 | `PH:layout.ts` | = | PH | T | F6 | 06 §1.1 |  |
| `registry.ts` | 75 | `G:shard/registry.ts` | ✗ | ✗ | SPEC | F6 → F9 | hand list; F9 replaces it with shards.generated.ts and deletes it (01 §7) |  |
| `terrain.ts` | 207 | `E:world/terrainField.ts` | = | engine | SPEC | F6 | shared landscape maths every terrain shard uses (02 F6 folder map) |  |
| `thumbs/driftwood-isle-landscape.jpg` | bin 202 K | `DI:thumbs/driftwood-isle-landscape.jpg` | = | DI | T | F6 | card art, imported by the shard's own manifest (`card`); the title deck and Explore read the URLs from the registry, so no import crosses a layer (R1-21) |  |
| `thumbs/driftwood-isle-portrait.jpg` | bin 187 K | `DI:thumbs/driftwood-isle-portrait.jpg` | = | DI | T | F6 | card art, imported by the shard's own manifest (`card`); the title deck and Explore read the URLs from the registry, so no import crosses a layer (R1-21) |  |
| `thumbs/driftwood-isle.jpg` | bin 46 K | `DI:thumbs/driftwood-isle.jpg` | = | DI | T | F6 | card art, imported by the shard's own manifest (`card`); the title deck and Explore read the URLs from the registry, so no import crosses a layer (R1-21) |  |
| `thumbs/nalati-grasslands-landscape.jpg` | bin 380 K | `NG:thumbs/nalati-grasslands-landscape.jpg` | = | NG | T | F6 | card art, imported by the shard's own manifest (`card`); the title deck and Explore read the URLs from the registry, so no import crosses a layer (R1-21) |  |
| `thumbs/nalati-grasslands-portrait.jpg` | bin 375 K | `NG:thumbs/nalati-grasslands-portrait.jpg` | = | NG | T | F6 | card art, imported by the shard's own manifest (`card`); the title deck and Explore read the URLs from the registry, so no import crosses a layer (R1-21) |  |
| `thumbs/nalati-grasslands.jpg` | bin 71 K | `NG:thumbs/nalati-grasslands.jpg` | = | NG | T | F6 | card art, imported by the shard's own manifest (`card`); the title deck and Explore read the URLs from the registry, so no import crosses a layer (R1-21) |  |
| `thumbs/nine-dragon-stack-landscape.jpg` | bin 387 K | `ND:thumbs/nine-dragon-stack-landscape.jpg` | = | ND | T | F6 | card art, imported by the shard's own manifest (`card`); the title deck and Explore read the URLs from the registry, so no import crosses a layer (R1-21) |  |
| `thumbs/nine-dragon-stack-portrait.jpg` | bin 353 K | `ND:thumbs/nine-dragon-stack-portrait.jpg` | = | ND | T | F6 | card art, imported by the shard's own manifest (`card`); the title deck and Explore read the URLs from the registry, so no import crosses a layer (R1-21) |  |
| `thumbs/nine-dragon-stack.jpg` | bin 65 K | `ND:thumbs/nine-dragon-stack.jpg` | = | ND | T | F6 | card art, imported by the shard's own manifest (`card`); the title deck and Explore read the URLs from the registry, so no import crosses a layer (R1-21) |  |
| `thumbs/pine-hollow-landscape.jpg` | bin 239 K | `PH:thumbs/pine-hollow-landscape.jpg` | = | PH | T | F6 | card art, imported by the shard's own manifest (`card`); the title deck and Explore read the URLs from the registry, so no import crosses a layer (R1-21) |  |
| `thumbs/pine-hollow-portrait.jpg` | bin 315 K | `PH:thumbs/pine-hollow-portrait.jpg` | = | PH | T | F6 | card art, imported by the shard's own manifest (`card`); the title deck and Explore read the URLs from the registry, so no import crosses a layer (R1-21) |  |
| `thumbs/pine-hollow.jpg` | bin 46 K | `PH:thumbs/pine-hollow.jpg` | = | PH | T | F6 | card art, imported by the shard's own manifest (`card`); the title deck and Explore read the URLs from the registry, so no import crosses a layer (R1-21) |  |

#### `src/chunks/driftwood-isle/` — 31 files, 5,491 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `firstMinutes.ts` | 67 | `DI:firstMinutes.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `fpArms.ts` | 201 | `DI:fpArms.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `models/boat.ts` | 285 | `DI:models/boat.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `models/captainHat.ts` | 108 | `DI:models/captainHat.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `models/cargo.ts` | 99 | `DI:models/cargo.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `models/cove.ts` | 106 | `DI:models/cove.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `models/creatures.ts` | 34 | `DI:models/creatures.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `models/driftLog.ts` | 44 | `DI:models/driftLog.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `models/gear.ts` | 38 | `DI:models/gear.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `models/hibiscusBush.ts` | 201 | `DI:models/hibiscusBush.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `models/hut.ts` | 387 | `DI:models/hut.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `models/lookout.ts` | 395 | `DI:models/lookout.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `models/palm.ts` | 184 | `DI:models/palm.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `models/people.ts` | 22 | `DI:models/people.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `models/pier.ts` | 341 | `DI:models/pier.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `models/reef.ts` | 237 | `DI:models/reef.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `models/reefFish.ts` | 33 | `DI:models/reefFish.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `models/reefRock.ts` | 33 | `DI:models/reefRock.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `models/ropeBridge.ts` | 294 | `DI:models/ropeBridge.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `models/sailclothCape.ts` | 96 | `DI:models/sailclothCape.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `models/seaGlassChime.ts` | 121 | `DI:models/seaGlassChime.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `models/shipwreck.ts` | 802 | `DI:models/shipwreck.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `models/shoreBoulder.ts` | 35 | `DI:models/shoreBoulder.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `models/shrine.ts` | 526 | `DI:models/shrine.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `models/smallRock.ts` | 35 | `DI:models/smallRock.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `models/trader.ts` | 125 | `DI:models/trader.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `models/trailside.ts` | 167 | `DI:models/trailside.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `models/trophyPlaques.ts` | 245 | `DI:models/trophyPlaques.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `models/zipline.ts` | 117 | `DI:models/zipline.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `roster.ts` | 32 | `DI:roster.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |
| `world/places.ts` | 81 | `DI:world/places.ts` | = | DI | T | F6 | Driftwood content (02 rule 1) |  |

#### `src/chunks/nalati-grasslands/` — 33 files, 4,033 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `models/ambientLife.ts` | 119 | `NG:models/ambientLife.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/balbal.ts` | 184 | `NG:models/balbal.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/campGenerated.ts` | 95 | `NG:models/campGenerated.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/campProps.ts` | 518 | `NG:models/campProps.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/cragLedge.ts` | 41 | `NG:models/cragLedge.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/cragRock.ts` | 201 | `NG:models/cragRock.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/creatures.ts` | 135 | `NG:models/creatures.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/dressing.ts` | 480 | `NG:models/dressing.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/dressingProps.ts` | 291 | `NG:models/dressingProps.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/eagleRock.ts` | 132 | `NG:models/eagleRock.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/fence.ts` | 85 | `NG:models/fence.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/fieldstone.ts` | 47 | `NG:models/fieldstone.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/gear.ts` | 152 | `NG:models/gear.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/glacierSnout.ts` | 72 | `NG:models/glacierSnout.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/herdHorse.ts` | 15 | `NG:models/herdHorse.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/kokparGoal.ts` | 27 | `NG:models/kokparGoal.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/kokparPost.ts` | 21 | `NG:models/kokparPost.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/kokparRider.ts` | 15 | `NG:models/kokparRider.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/kunesBridge.ts` | 158 | `NG:models/kunesBridge.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/kurganEntrance.ts` | 148 | `NG:models/kurganEntrance.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/kurganKerb.ts` | 36 | `NG:models/kurganKerb.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/leopardCave.ts` | 102 | `NG:models/leopardCave.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/outcrop.ts` | 115 | `NG:models/outcrop.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/people.ts` | 87 | `NG:models/people.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/reins.ts` | 42 | `NG:models/reins.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/saddledHorse.ts` | 15 | `NG:models/saddledHorse.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/signpost.ts` | 148 | `NG:models/signpost.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/snowLotus.ts` | 15 | `NG:models/snowLotus.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/stoneStep.ts` | 36 | `NG:models/stoneStep.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/watchtower.ts` | 25 | `NG:models/watchtower.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/windCairn.ts` | 121 | `NG:models/windCairn.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `models/yurt.ts` | 311 | `NG:models/yurt.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |
| `roster.ts` | 44 | `NG:roster.ts` | = | NG | T | F6 | Nalati content (02 rule 1) |  |

#### `src/chunks/nine-dragon-stack/` — 108 files, 25,487 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `bag.ts` | 17 | `ND:bag.ts` | ✗ | ✗ | T | F6 → S1.4 | folded into the manifest, strings and the Fei Zhua Tool row, then deleted (05 §1.1) |  |
| `def.ts` | 153 | `ND:manifest.ts` | = | ND | T | F6 (+S1.1 split) | def → manifest; S1.1 moves the hook fields into the new plugin.ts (05 §1.1) |  |
| `grapple/course.ts` | 48 | `ND:grapple/course.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `grapple/fx.ts` | 201 | `ND:grapple/fx.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `grapple/line.ts` | 220 | `ND:grapple/line.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `grapple/Traversal.ts` | 589 | `ND:grapple/FeiZhua.ts` | = | ND | T | F6 (+S1.4) | installFeiZhua → class FeiZhua extends Tool (05 §1.1, 09 §1.7) |  |
| `index.ts` | 57 | `ND:world/install.ts` | = | ND | T | F6 (+S1.1) | NINE_DRAGON_WORLD.build → installWorld(ctx, rt) (05 §1.1) |  |
| `layout.ts` | 50 | `ND:layout.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `look/emitters.ts` | 75 | `ND:look/emitters.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `look/facadeMaterial.ts` | 616 | `ND:look/facadeMaterial.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `look/glyphs.ts` | 168 | `ND:look/glyphs.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `look/lanterns.ts` | 272 | `ND:look/lanterns.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `look/light/glow.ts` | 51 | `ND:look/light/glow.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `look/light/grade.ts` | 90 | `ND:look/light/grade.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `look/light/halos.ts` | 131 | `ND:look/light/halos.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `look/light/install.ts` | 98 | `ND:look/light/install.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `look/light/lightvol.ts` | 239 | `ND:look/light/lightvol.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `look/light/pools.ts` | 77 | `ND:look/light/pools.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `look/neonsigns.ts` | 336 | `ND:look/neonsigns.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `look/paint.ts` | 242 | `ND:look/paint.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `look/post.ts` | 372 | ✗ | = | ✗ | D | F7 | dead: unimported clean-room copy (05 §1.1, 02 F7 step 3) |  |
| `look/render.ts` | 213 | `ND:look/render.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `look/render/bleed.ts` | 210 | `ND:look/render/bleed.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `look/render/haze.ts` | 190 | `ND:look/render/haze.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `look/render/jiehua.ts` | 264 | `ND:look/render/jiehua.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `look/render/reflect.ts` | 290 | `ND:look/render/reflect.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `look/scroll.ts` | 174 | `ND:look/scroll.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `look/signs.ts` | 412 | `ND:look/signs.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `look/specimenLight.ts` | 55 | `ND:look/specimenLight.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `look/streaks.ts` | 319 | `ND:look/streaks.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `look/style.ts` | 1467 | `ND:look/style.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `mockupCameras.ts` | 51 | `ND:mockupCameras.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `models/balustradePanel.ts` | 24 | `ND:models/balustradePanel.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `models/banyan.ts` | 82 | `ND:models/banyan.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `models/bridgePosts.ts` | 36 | `ND:models/bridgePosts.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `models/crowd.ts` | 84 | `ND:models/crowd.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `models/facade.ts` | 172 | `ND:models/facade.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `models/feiZhuaHook.ts` | 80 | `ND:models/feiZhuaHook.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `models/gear.ts` | 66 | `ND:models/gear.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `models/inKit.ts` | 74 | `ND:models/inKit.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `models/landingPlanter.ts` | 24 | `ND:models/landingPlanter.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `models/laundry.ts` | 46 | `ND:models/laundry.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `models/lion.ts` | 38 | `ND:models/lion.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `models/lotusFinial.ts` | 19 | `ND:models/lotusFinial.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `models/market.ts` | 58 | `ND:models/market.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `models/movers.ts` | 40 | `ND:models/movers.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `models/paifang.ts` | 62 | `ND:models/paifang.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `models/paperLantern.ts` | 24 | `ND:models/paperLantern.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `models/signs.ts` | 109 | `ND:models/signs.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `models/stalls.ts` | 59 | `ND:models/stalls.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `models/wallKit.ts` | 33 | `ND:models/wallKit.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `models/wellBalustrade.ts` | 61 | `ND:models/wellBalustrade.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `places.ts` | 11 | `ND:places.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `roster.ts` | 10 | `ND:roster.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `util.ts` | 47 | `ND:util.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `vm/arms.ts` | 64 | `ND:vm/arms.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `vm/cloth.ts` | 421 | `ND:vm/cloth.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `vm/fpArms.ts` | 488 | `ND:vm/fpArms.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `vm/geo.ts` | 289 | `ND:vm/geo.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `vm/jian.ts` | 253 | `ND:vm/jian.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `vm/materials.ts` | 584 | `ND:vm/materials.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `vm/rig.ts` | 310 | `K:viewmodel/armRig.ts` | = | kit | K | F6 | rule of two: Driftwood's fp-arms bake (scripts/blender/driftwood-isle/fp-arms/bake.mjs) builds from it (05 §1.1) |  |
| `vm/trail.ts` | 197 | `ND:vm/trail.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/banyan.ts` | 374 | `ND:world/banyan.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/build.ts` | 501 | `ND:world/build.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/canopy.ts` | 543 | `ND:world/canopy.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/colliders.ts` | 97 | `ND:world/colliders.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/crowd.ts` | 277 | `ND:world/crowd.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/ctx.ts` | 119 | `ND:world/ctx.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/cull.ts` | 308 | `ND:world/cull.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/dressing.ts` | 126 | `ND:world/dressing.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/facade/batch.ts` | 149 | `ND:world/facade/batch.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/facade/geo.ts` | 297 | `ND:world/facade/geo.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/facade/grammar.ts` | 895 | `ND:world/facade/grammar.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/facade/pieces.ts` | 465 | `ND:world/facade/pieces.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/facade/rng.ts` | 34 | `ND:world/facade/rng.ts` | ✗ (deleted at F8) | ND | DELETE | F6 → F8 | one RNG: `Rng.scrambled` keeps the facade sequence (01 §2, G18, R1-04) |  |
| `world/facades.ts` | 233 | `ND:world/facades.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/gate.ts` | 570 | `ND:world/gate.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/hero/figures.ts` | 194 | `ND:world/hero/figures.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/hero/glb.ts` | 196 | `ND:world/hero/glb.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/hero/kitx.ts` | 246 | `ND:world/hero/kitx.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/hero/paifang.ts` | 267 | `ND:world/hero/paifang.ts` | ✗ | ✗ | T | F6 → S1.1 | unimported (superseded by world/gate.ts); 05 Q7 deletes it at S1.1 — it could join F7 instead |  |
| `world/hero/vm-material.ts` | 370 | `ND:world/hero/vm-material.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/hero/weapon-parts.ts` | 283 | `ND:world/hero/weapon-parts.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/inKit.ts` | 57 | `ND:world/inKit.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/jian.ts` | 129 | `ND:world/jian.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/kit.ts` | 301 | `ND:world/kit.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/lod.ts` | 67 | `ND:world/lod.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/modelLook.ts` | 65 | `ND:world/modelLook.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/props.ts` | 208 | `ND:world/props.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/props3d.ts` | 133 | `ND:world/props3d.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/sets.ts` | 53 | `ND:world/sets.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/square.ts` | 444 | `ND:world/square.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/squareProps.ts` | 58 | `ND:world/squareProps.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/stairstreet-upper.ts` | 1048 | `ND:world/stairstreet-upper.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/stairstreet.ts` | 917 | `ND:world/stairstreet.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/stalls.ts` | 629 | `ND:world/stalls.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/towers.ts` | 433 | `ND:world/towers.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/well-bridges.ts` | 692 | `ND:world/well-bridges.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/well-galleries.ts` | 457 | `ND:world/well-galleries.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/well-lower-deep.ts` | 191 | `ND:world/well-lower-deep.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/well-lower-life.ts` | 517 | `ND:world/well-lower-life.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/well-lower.ts` | 101 | `ND:world/well-lower.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/well-mid.ts` | 346 | `ND:world/well-mid.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/well-plan.ts` | 222 | `ND:world/well-plan.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/well-rim.ts` | 196 | `ND:world/well-rim.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/well.ts` | 58 | `ND:world/well.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |
| `world/words.ts` | 9 | `ND:world/words.ts` | = | ND | T | F6 | Nine Dragon content (05 §1.1) |  |

#### `src/chunks/pine-hollow/` — 55 files, 5,186 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `models/antlerKing.ts` | 275 | `PH:models/antlerKing.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/beaverDam.ts` | 17 | `PH:models/beaverDam.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/birds.ts` | 64 | `PH:models/birds.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/canoe.ts` | 17 | `PH:models/canoe.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/caveArch.ts` | 81 | `PH:models/caveArch.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/contractBoard.ts` | 17 | `PH:models/contractBoard.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/cragBoulder.ts` | 22 | `PH:models/cragBoulder.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/cragCliff.ts` | 29 | `PH:models/cragCliff.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/creatures.ts` | 14 | `PH:models/creatures.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/creekFootbridge.ts` | 68 | `PH:models/creekFootbridge.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/fallenLog.ts` | 68 | `PH:models/fallenLog.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/fern.ts` | 17 | `PH:models/fern.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/fireLookout.ts` | 223 | `PH:models/fireLookout.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/forestTree.ts` | 78 | `PH:models/forestTree.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/gear.ts` | 103 | `PH:models/gear.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/hamletShed.ts` | 17 | `PH:models/hamletShed.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/hatchet.ts` | 15 | `PH:models/hatchet.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/hollowLog.ts` | 93 | `PH:models/hollowLog.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/huntingLodge.ts` | 17 | `PH:models/huntingLodge.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/logCabin.ts` | 1544 | `PH:models/logCabin.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/millersHouse.ts` | 17 | `PH:models/millersHouse.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/moss.ts` | 17 | `PH:models/moss.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/mossyBoulder.ts` | 67 | `PH:models/mossyBoulder.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/needleLitter.ts` | 17 | `PH:models/needleLitter.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/pebbles.ts` | 17 | `PH:models/pebbles.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/people.ts` | 300 | `PH:models/people.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/porchLantern.ts` | 13 | `PH:models/porchLantern.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/reeds.ts` | 17 | `PH:models/reeds.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/scree.ts` | 20 | `PH:models/scree.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/shrub.ts` | 17 | `PH:models/shrub.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/skinningKnife.ts` | 220 | `PH:models/skinningKnife.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/standingStone.ts` | 24 | `PH:models/standingStone.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/stoneFirePit.ts` | 13 | `PH:models/stoneFirePit.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/tokenShelf.ts` | 44 | `PH:models/tokenShelf.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/traderStall.ts` | 17 | `PH:models/traderStall.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/treeStump.ts` | 35 | `PH:models/treeStump.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/watermill.ts` | 17 | `PH:models/watermill.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/waystone.ts` | 18 | `PH:models/waystone.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/wildlife.ts` | 497 | `PH:models/wildlife.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/wineBarrel.ts` | 16 | `PH:models/wineBarrel.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/woodenBucket.ts` | 16 | `PH:models/woodenBucket.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/woodenCrate.ts` | 16 | `PH:models/woodenCrate.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/zipCable.ts` | 26 | `PH:models/zipCable.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `models/ziplineLanding.ts` | 90 | `PH:models/ziplineLanding.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `roster.ts` | 40 | `PH:roster.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `world/cabinKit.ts` | 37 | `PH:world/cabinKit.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `world/cabins.ts` | 111 | `PH:world/cabins.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `world/context.ts` | 19 | `PH:world/context.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `world/cragKit.ts` | 50 | `PH:world/cragKit.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `world/drawnModels.ts` | 66 | `PH:world/drawnModels.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `world/hero.ts` | 52 | `PH:world/hero.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `world/places.ts` | 57 | `PH:world/places.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `world/props.ts` | 204 | `PH:world/props.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `world/timber.ts` | 175 | `PH:world/timber.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |
| `world/undergrowthKit.ts` | 45 | `PH:world/undergrowthKit.ts` | = | PH | T | F6 | Pine content (06 §1.1) |  |

#### `src/core/` — 31 files, 3,766 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `assets.ts` | 171 | `E:core/assets.ts` | = | engine | F | F6 |  |  |
| `bootstrap.ts` | 149 | `E:core/bootstrap.ts` | = | engine | F | F6 (+S1.1, S2.1, S3.1) | TREE_FACTORIES and the structure gate become manifest data (05 §2.3) |  |
| `config.ts` | 27 | `E:core/config.ts` | = | engine | F | F6 |  |  |
| `crashFlag.ts` | 32 | `E:core/crashFlag.ts` | = | engine | F | F6 |  |  |
| `devMode.ts` | 38 | `E:core/devMode.ts` | = | engine | F | F6 |  |  |
| `errorReport.ts` | 206 | `E:core/errorReport.ts` | = | engine | F | F6 |  |  |
| `faults.ts` | 121 | `E:core/faults.ts` | = | engine | F | F6 |  |  |
| `fixedStep.ts` | 3 | `E:core/fixedStep.ts` | = | engine | F | F6 |  |  |
| `frameCost.ts` | 227 | `E:core/frameCost.ts` | = | engine | F | F6 |  |  |
| `Game.ts` | 748 | `E:core/Game.ts` | = | engine | SPLIT | F6 (+S1.1, S2.1, S3.2, S4.3) | 10 shard branches leave (split table §3.2) |  |
| `gpuOnly.ts` | 81 | `E:core/gpuOnly.ts` | = | engine | F | F6 |  |  |
| `GpuRecovery.ts` | 306 | `E:core/GpuRecovery.ts` | = | engine | F | F6 |  |  |
| `Grade.ts` | 77 | `E:core/Grade.ts` | = | engine | F | F6 |  |  |
| `KeepAlive.ts` | 15 | `E:core/KeepAlive.ts` | = | engine | F | F6 |  |  |
| `ktx2.ts` | 197 | `E:core/ktx2.ts` | = | engine | F | F6 |  |  |
| `lifeTrace.ts` | 145 | `E:core/lifeTrace.ts` | = | engine | F | F6 |  |  |
| `noise.ts` | 53 | `E:core/noise.ts` | = | engine | F | F6 |  |  |
| `perfLap.ts` | 36 | `E:core/perfLap.ts` | `E:debug/perfLap.ts` | engine | M | F6 → S2.1 | merged with ui/perfLap.ts into the panel's lap runner (06 §1.3) |  |
| `practiceRoom.ts` | 14 | `E:core/practiceRoom.ts` | = | engine | F | F6 |  |  |
| `reloadGuard.ts` | 20 | `E:core/reloadGuard.ts` | = | engine | F | F6 |  |  |
| `rng.ts` | 15 | `E:core/rng.ts` | = | engine | F | F6 |  |  |
| `shadowLayer.ts` | 8 | `E:core/shadowLayer.ts` | = | engine | F | F6 |  |  |
| `shardScope.ts` | 248 | `E:core/shardScope.ts` | `E:app/legacyCapture.ts` | engine | F | F6 → F11 | park / activate deleted, capture kept and renamed (02 F11 step 2); deleted when wildshard/implicit-capture reaches 0 (X1 / X2) |  |
| `shardState.ts` | 140 | `E:core/shardState.ts` | ✗ | ✗ | F | F6 → F11 | resident-host slots, deleted (02 F11 step 2) |  |
| `tier.ts` | 190 | `E:core/tier.ts` | `E:render/tiers.ts` | engine | SPLIT | F6 → X7 | tiers as data: engine knobs stay, shard knobs → manifests (01 §13.3; split table §3.6) |  |
| `time.ts` | 14 | `E:core/time.ts` | = | engine | F | F6 |  |  |
| `Tour.ts` | 43 | `E:core/Tour.ts` | = | engine | F | F6 |  |  |
| `viewport.ts` | 34 | `E:core/viewport.ts` | = | engine | F | F6 |  |  |
| `Volumetrics.ts` | 209 | `E:core/Volumetrics.ts` | = | engine | F | F6 |  |  |
| `webglStartup.ts` | 40 | `E:core/webglStartup.ts` | = | engine | F | F6 |  |  |
| `worldDepth.ts` | 159 | `E:core/worldDepth.ts` | = | engine | F | F6 |  |  |

#### `src/dev/` — 37 files, 6,553 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `ambient.ts` | 94 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `animals.ts` | 102 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `cabins.ts` | 39 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `dive.ts` | 104 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `driftwood.ts` | 110 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `enemies.ts` | 110 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `grass.ts` | 60 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `loot.ts` | 144 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `music.ts` | 47 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `nalati-bow.ts` | 184 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `nalati-creatures.ts` | 128 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `nalati-elites.ts` | 44 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `nalati-grass.ts` | 56 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `nalati-melee.ts` | 98 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `nalati-pois.ts` | 20 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `nalati-ride.ts` | 98 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `nalati-spruce.ts` | 105 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `nd-lab/grapple/feizhua.ts` | 208 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `nd-lab/grapple/fx.ts` | 201 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `nd-lab/grapple/hook.ts` | 220 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `nd-lab/grapple/line.ts` | 220 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `nd-lab/grapple/main.ts` | 274 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `nd-lab/grapple/neon.ts` | 122 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `nd-lab/grapple/post.ts` | 329 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `nd-lab/grapple/sequence.ts` | 443 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `nd-lab/grapple/vm-material.ts` | 484 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `nd-lab/grapple/well.ts` | 195 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `nd-lab/grapple/wetstone.ts` | 188 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `nd-lab/grapple/world/batch.ts` | 94 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `nd-lab/grapple/world/geo.ts` | 234 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `nd-lab/grapple/world/grammar.ts` | 642 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `nd-lab/grapple/world/material.ts` | 498 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `nd-lab/grapple/world/pieces.ts` | 386 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `nd-lab/grapple/world/rng.ts` | 33 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `sword.ts` | 94 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `threeKit.ts` | 6 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |
| `weapon.ts` | 139 | ✗ | = | ✗ | D | F7 | dead (02 F7 step 1) |  |

#### `src/entities/` — 29 files, 9,379 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `Animal.ts` | 922 | `E:entities/Animal.ts` | = | engine | F | F6 |  |  |
| `AnimalFactory.ts` | 566 | `E:entities/AnimalFactory.ts` | = | engine | F | F6 |  |  |
| `AnimalManager.ts` | 1462 | `E:entities/AnimalManager.ts` | = | engine | SPLIT | F6 (+S2.3, S3.4) | the CreatureService stays; melee gate, fight rules, trample and brains leave (split table §3.11) |  |
| `animalMatrices.ts` | 82 | `E:entities/animalMatrices.ts` | = | engine | F | F6 |  |  |
| `animalShadow.ts` | 58 | `E:entities/animalShadow.ts` | = | engine | F | F6 |  |  |
| `bearFix.ts` | 112 | `E:entities/bearFix.ts` | `PH:species/bearFix.ts` | PH | X-SPECIES | F6 → S2.3 | 06 §1.3 |  |
| `creatureCoats.ts` | 265 | `E:entities/creatureCoats.ts` | `NG:species/creatureCoats.ts` | NG | X-SPECIES | F6 → S3.4 | coat atlases for the Nalati GLB hulls | 07 |
| `creatureKit.ts` | 111 | `E:entities/creatureKit.ts` | `NG:species/creatureKit.ts` | NG | X-SPECIES | F6 → S3.4 | shape helpers for the Nalati painterly creatures (horse, wolf) | 07 |
| `creatureRigBake.ts` | 801 | `E:entities/creatureRigBake.ts` | = | engine | F | F6 |  |  |
| `creatureRigs.ts` | 14 | `E:entities/creatureRigs.ts` | `NG:species/creatureRigs.ts` | NG | X-SPECIES | F6 → S3.4 | the Nalati rig list the boot manifest declares (→ boot.files) | 07 |
| `eliteBrain.ts` | 16 | `E:entities/eliteBrain.ts` | ✗ | ✗ | M | F6 → S2.3 | merged into the one engine EliteBrain (09 §5.1); 02 rule 2 would send it to Nalati (Q2) |  |
| `Enemies.ts` | 374 | `DI:creatures/Enemies.ts` | = | DI | G | F6 (+S4.2) | Driftwood's enemy spawner (main.ts gate; 02 rule 3) → spawn.driftwood.enemies at S4.2 | 08 |
| `farHerd.ts` | 302 | `E:entities/farHerd.ts` | = | engine | F | F6 |  |  |
| `fightRules.ts` | 128 | `E:entities/fightRules.ts` | `E:ai/director.ts` | engine | M | F6 → S2.3 | AttackTokens → combat.director (09 §5.5) |  |
| `Flock.ts` | 484 | `E:entities/Flock.ts` | `NG:creatures/Flock.ts` | NG | X-SPECIES | F6 → S3.4 | the sheep flock (GroupBrain at S3.4; 09 §5.2) | 07 |
| `glbCreatures.ts` | 156 | `E:entities/glbCreatures.ts` | `NG:species/glbCreatures.ts` | NG | X-SPECIES | F6 → S3.4 | the Nalati generated hulls on the species skeletons | 07 |
| `Herd.ts` | 532 | `E:entities/Herd.ts` | `NG:creatures/Herd.ts` | NG | X-SPECIES | F6 → S3.4 | the horse herd's brain (with the horse: Q1) | 07 |
| `humanoidRigBake.ts` | 269 | `E:entities/humanoidRigBake.ts` | = | engine | F | F6 |  |  |
| `lowpoly.ts` | 263 | `E:entities/lowpoly.ts` | `K:species/lowpoly.ts` | kit | X-SPECIES | F6 → S2.3 | the faceted creature look the kit boar / bear wear on Driftwood (rule of two with the kit species) |  |
| `Marmots.ts` | 160 | `E:entities/Marmots.ts` | `NG:creatures/Marmots.ts` | NG | X-SPECIES | F6 → S3.4 | ambient marmots, Nalati (09 §5.2) | 07 |
| `npc/Castaway.ts` | 314 | `DI:npc/Castaway.ts` | = | DI | I | F6 (+S4.3) | Driftwood people (importers: its models + quest/Spine.ts); on #kit/npc at S4.3 (01 §21) | 08 |
| `npc/Trader.ts` | 261 | `DI:npc/Trader.ts` | = | DI | I | F6 (+S4.3) | Driftwood people (importers: its models + quest/TraderStall.ts); on #kit/npc at S4.3 | 08 |
| `Pack.ts` | 459 | `E:entities/Pack.ts` | `NG:creatures/Pack.ts` | NG | X-SPECIES | F6 → S3.4 | the wolf pack's GroupBrain policy (09 §5.1, §5.5) | 07 |
| `painterlyAnimals.ts` | 17 | `E:entities/painterlyAnimals.ts` | `NG:species/painterlyAnimals.ts` | NG | X-SPECIES | F6 → S3.4 | the material every Nalati creature is drawn with | 07 |
| `pineCoats.ts` | 533 | `E:entities/pineCoats.ts` | `PH:species/coats.ts` | PH | X-SPECIES | F6 → S2.3 | Pine's coats (06 §1.3) |  |
| `pineCreatureRigs.ts` | 17 | `E:entities/pineCreatureRigs.ts` | `PH:species/rigs.ts` | PH | X-SPECIES | F6 → S2.3 | Pine's rig list, read by boot/manifest.ts → boot.files (06 §1.3) |  |
| `pineCreatures.ts` | 361 | `E:entities/pineCreatures.ts` | `PH:species/hulls.ts` | PH | X-SPECIES | F6 → S2.3 | Pine's TRELLIS hulls (06 §1.3) |  |
| `wildEnv.ts` | 101 | `E:entities/wildEnv.ts` | `NG:creatures/wildEnv.ts` | NG | X-SPECIES | F6 → S3.4 | the view the Nalati creature AIs read (its header) | 07 |
| `Wildlife.ts` | 239 | `E:entities/Wildlife.ts` | `NG:creatures/Wildlife.ts` | NG | X-SPECIES | F6 → S3.4 | Nalati's spawner → spawn tables (09 §5.6) | 07 |

#### `src/entities/species/` — 24 files, 6,082 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `balbal.ts` | 485 | `E:entities/species/balbal.ts` | `NG:species/balbal.ts` | NG | X-SPECIES | F6 → S3.4 | Nalati species (09 §5.2) | 07 |
| `bear.ts` | 285 | `E:entities/species/bear.ts` | `K:species/bear.ts` | kit | X-SPECIES | F6 → S2.3 | kit species: Driftwood + Pine (09 §5.2) |  |
| `boar.ts` | 273 | `E:entities/species/boar.ts` | `K:species/boar.ts` | kit | X-SPECIES | F6 → S2.3 | kit species: Driftwood + Pine (09 §5.2) |  |
| `captain.ts` | 332 | `E:entities/species/captain.ts` | `DI:species/captain.ts` | DI | X-SPECIES | F6 → S4.2 | Driftwood species (09 §5.2) | 08 |
| `captainMesh.ts` | 142 | `E:entities/species/captainMesh.ts` | `DI:species/captainMesh.ts` | DI | X-SPECIES | F6 → S4.2 | Driftwood species (09 §5.2) | 08 |
| `crab.ts` | 307 | `E:entities/species/crab.ts` | `DI:species/crab.ts` | DI | X-SPECIES | F6 → S4.2 | Driftwood species (09 §5.2) | 08 |
| `deer.ts` | 293 | `E:entities/species/deer.ts` | `PH:species/deer.ts` | PH | X-SPECIES | F6 → S2.3 | Pine only since E318 (09 §5.2) |  |
| `eagle.ts` | 159 | `E:entities/species/eagle.ts` | `NG:species/eagle.ts` | NG | X-SPECIES | F6 → S3.4 | Nalati species (09 §5.2) | 07 |
| `elk.ts` | 343 | `E:entities/species/elk.ts` | `PH:species/elk.ts` | PH | X-SPECIES | F6 → S2.3 | Pine only (09 §5.2) |  |
| `ghostRider.ts` | 130 | `E:entities/species/ghostRider.ts` | `NG:species/ghostRider.ts` | NG | X-SPECIES | F6 → S3.4 | Nalati species (09 §5.2) | 07 |
| `goldenKing.ts` | 441 | `E:entities/species/goldenKing.ts` | `NG:species/goldenKing.ts` | NG | X-SPECIES | F6 → S3.4 | Nalati species (09 §5.2) | 07 |
| `horse.ts` | 614 | `E:entities/species/horse.ts` | `NG:species/horse.ts` | NG | X-SPECIES | F6 → S3.4 | rule of two over 01 §21 / 09 §5.2: the horse playground is Nalati's (01 §22), so only Nalati uses it (Q1) | 07 |
| `kokbori.ts` | 40 | `E:entities/species/kokbori.ts` | `NG:species/kokbori.ts` | NG | X-SPECIES | F6 → S3.4 | Nalati species (09 §5.2) | 07 |
| `kurganBalbal.ts` | 12 | `E:entities/species/kurganBalbal.ts` | `NG:species/kurganBalbal.ts` | NG | X-SPECIES | F6 → S3.4 | Nalati species (09 §5.2) | 07 |
| `leopard.ts` | 239 | `E:entities/species/leopard.ts` | `NG:species/leopard.ts` | NG | X-SPECIES | F6 → S3.4 | Nalati species (09 §5.2) | 07 |
| `loft.ts` | 238 | `E:entities/species/loft.ts` | = | engine | M | F6 | loft / skin geometry helpers every species builds with (mechanism) |  |
| `monkey.ts` | 366 | `E:entities/species/monkey.ts` | `DI:species/monkey.ts` | DI | X-SPECIES | F6 → S4.2 | Driftwood species (09 §5.2) | 08 |
| `registry.ts` | 337 | `E:entities/species/registry.ts` | = | engine | M | F6 (+S2.3) | the species contract (engine); the glob registration becomes manifest `species` rows at S2.3 |  |
| `rigs.ts` | 48 | `E:entities/species/rigs.ts` | = | engine | M | F6 | shared rig helpers (NO_FUR, smooth01, bump) for every species |  |
| `sailor.ts` | 371 | `E:entities/species/sailor.ts` | `DI:species/sailor.ts` | DI | X-SPECIES | F6 → S4.2 | Driftwood species (09 §5.2) | 08 |
| `sheep.ts` | 187 | `E:entities/species/sheep.ts` | `NG:species/sheep.ts` | NG | X-SPECIES | F6 → S3.4 | Nalati species (09 §5.2) | 07 |
| `sheepdog.ts` | 25 | `E:entities/species/sheepdog.ts` | `NG:species/sheepdog.ts` | NG | X-SPECIES | F6 → S3.4 | Nalati species (09 §5.2) | 07 |
| `thrall.ts` | 30 | `E:entities/species/thrall.ts` | `PH:species/thrall.ts` | PH | X-SPECIES | F6 → S2.3 | Pine's variant rows of boar / elk (09 §5.2) |  |
| `wolf.ts` | 385 | `E:entities/species/wolf.ts` | `NG:species/wolf.ts` | NG | X-SPECIES | F6 → S3.4 | Nalati species (09 §5.2) | 07 |

#### `src/explore/` — 16 files, 4,240 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `catalog.ts` | 151 | `E:explore/catalog.ts` | = | engine | F | F6 |  |  |
| `Compare.ts` | 127 | `E:explore/Compare.ts` | = | engine | F | F6 (+S1.1, S2.1, S3.1, S4.1) | compare pairs → `level.explore.compare` (05 §2.4; R2-02) |  |
| `diorama.ts` | 246 | `E:explore/diorama.ts` | = | engine | F | F6 |  |  |
| `Explore.ts` | 635 | `E:explore/Explore.ts` | = | engine | F | F6 (+S1.1, S2.1, S3.1, S4.1) | the four art maps lose one shard each (05 §2.4; EI21) |  |
| `fatLines.ts` | 47 | `E:explore/fatLines.ts` | = | engine | F | F6 |  |  |
| `FreeCam.ts` | 291 | `E:explore/FreeCam.ts` | = | engine | F | F6 |  |  |
| `MiniMap.ts` | 274 | `E:explore/MiniMap.ts` | = | engine | F | F6 |  |  |
| `ModelExplorer.ts` | 1060 | `E:explore/ModelExplorer.ts` | = | engine | F | F6 |  |  |
| `pick.ts` | 120 | `E:explore/pick.ts` | = | engine | F | F6 |  |  |
| `registry.ts` | 16 | `E:explore/registry.ts` | = | engine | F | F6 |  |  |
| `Select.ts` | 165 | `E:explore/Select.ts` | = | engine | F | F6 |  |  |
| `SetExplorer.ts` | 530 | `E:explore/SetExplorer.ts` | = | engine | F | F6 |  |  |
| `setView.ts` | 222 | `E:explore/setView.ts` | = | engine | F | F6 |  |  |
| `tiers.ts` | 27 | `E:explore/tiers.ts` | = | engine | F | F6 |  |  |
| `TouchFly.ts` | 229 | `E:explore/TouchFly.ts` | = | engine | F | F6 |  |  |
| `viewPoint.ts` | 100 | `E:explore/viewPoint.ts` | = | engine | F | F6 |  |  |

#### `src/explore/img/` — 47 files, 0 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `mockups/driftwood-overlook-live.jpg` | bin 345 K | `E:explore/img/mockups/driftwood-overlook-live.jpg` | `DI:explore/mockups/driftwood-overlook-live.jpg` | DI | X-GLOB | F6 → S4.1 | Compare.ts looks pictures up by computed key: moves with the shard's manifest.explore.compare | 08 |
| `mockups/driftwood-overlook-target.jpg` | bin 663 K | `E:explore/img/mockups/driftwood-overlook-target.jpg` | `DI:explore/mockups/driftwood-overlook-target.jpg` | DI | X-GLOB | F6 → S4.1 | Compare.ts looks pictures up by computed key: moves with the shard's manifest.explore.compare | 08 |
| `mockups/driftwood-right-live.jpg` | bin 80 K | `E:explore/img/mockups/driftwood-right-live.jpg` | `DI:explore/mockups/driftwood-right-live.jpg` | DI | X-GLOB | F6 → S4.1 | Compare.ts looks pictures up by computed key: moves with the shard's manifest.explore.compare | 08 |
| `mockups/driftwood-right-target.jpg` | bin 475 K | `E:explore/img/mockups/driftwood-right-target.jpg` | `DI:explore/mockups/driftwood-right-target.jpg` | DI | X-GLOB | F6 → S4.1 | Compare.ts looks pictures up by computed key: moves with the shard's manifest.explore.compare | 08 |
| `mockups/driftwood-spawn-live.jpg` | bin 87 K | `E:explore/img/mockups/driftwood-spawn-live.jpg` | `DI:explore/mockups/driftwood-spawn-live.jpg` | DI | X-GLOB | F6 → S4.1 | Compare.ts looks pictures up by computed key: moves with the shard's manifest.explore.compare | 08 |
| `mockups/driftwood-spawn-target.jpg` | bin 336 K | `E:explore/img/mockups/driftwood-spawn-target.jpg` | `DI:explore/mockups/driftwood-spawn-target.jpg` | DI | X-GLOB | F6 → S4.1 | Compare.ts looks pictures up by computed key: moves with the shard's manifest.explore.compare | 08 |
| `mockups/lookout.jpg` | bin 113 K | `E:explore/img/mockups/lookout.jpg` | `DI:explore/mockups/lookout.jpg` | DI | X-GLOB | F6 → S4.1 | no compare pair names it (dead? Q9); moves with Driftwood's pairs | 08 |
| `mockups/nalati-camp-live.jpg` | bin 215 K | `E:explore/img/mockups/nalati-camp-live.jpg` | `NG:explore/mockups/nalati-camp-live.jpg` | NG | X-GLOB | F6 → S3.1 | Compare.ts looks pictures up by computed key: moves with the shard's manifest.explore.compare | 07 |
| `mockups/nalati-camp-target.jpg` | bin 332 K | `E:explore/img/mockups/nalati-camp-target.jpg` | `NG:explore/mockups/nalati-camp-target.jpg` | NG | X-GLOB | F6 → S3.1 | Compare.ts looks pictures up by computed key: moves with the shard's manifest.explore.compare | 07 |
| `mockups/nalati-gully-live.jpg` | bin 192 K | `E:explore/img/mockups/nalati-gully-live.jpg` | `NG:explore/mockups/nalati-gully-live.jpg` | NG | X-GLOB | F6 → S3.1 | Compare.ts looks pictures up by computed key: moves with the shard's manifest.explore.compare | 07 |
| `mockups/nalati-gully-target.jpg` | bin 296 K | `E:explore/img/mockups/nalati-gully-target.jpg` | `NG:explore/mockups/nalati-gully-target.jpg` | NG | X-GLOB | F6 → S3.1 | Compare.ts looks pictures up by computed key: moves with the shard's manifest.explore.compare | 07 |
| `mockups/nalati-rail-live.jpg` | bin 126 K | `E:explore/img/mockups/nalati-rail-live.jpg` | `NG:explore/mockups/nalati-rail-live.jpg` | NG | X-GLOB | F6 → S3.1 | Compare.ts looks pictures up by computed key: moves with the shard's manifest.explore.compare | 07 |
| `mockups/nalati-rail-target.jpg` | bin 288 K | `E:explore/img/mockups/nalati-rail-target.jpg` | `NG:explore/mockups/nalati-rail-target.jpg` | NG | X-GLOB | F6 → S3.1 | Compare.ts looks pictures up by computed key: moves with the shard's manifest.explore.compare | 07 |
| `mockups/nine-gate-live.jpg` | bin 394 K | `E:explore/img/mockups/nine-gate-live.jpg` | `ND:explore/mockups/nine-gate-live.jpg` | ND | X-GLOB | F6 → S1.1 | Compare.ts looks pictures up by computed key: moves with the shard's manifest.explore.compare |  |
| `mockups/nine-gate-target.jpg` | bin 496 K | `E:explore/img/mockups/nine-gate-target.jpg` | `ND:explore/mockups/nine-gate-target.jpg` | ND | X-GLOB | F6 → S1.1 | Compare.ts looks pictures up by computed key: moves with the shard's manifest.explore.compare |  |
| `mockups/nine-stair-live.jpg` | bin 262 K | `E:explore/img/mockups/nine-stair-live.jpg` | `ND:explore/mockups/nine-stair-live.jpg` | ND | X-GLOB | F6 → S1.1 | Compare.ts looks pictures up by computed key: moves with the shard's manifest.explore.compare |  |
| `mockups/nine-stair-target.jpg` | bin 474 K | `E:explore/img/mockups/nine-stair-target.jpg` | `ND:explore/mockups/nine-stair-target.jpg` | ND | X-GLOB | F6 → S1.1 | Compare.ts looks pictures up by computed key: moves with the shard's manifest.explore.compare |  |
| `mockups/pine-den-live.jpg` | bin 96 K | `E:explore/img/mockups/pine-den-live.jpg` | `PH:explore/mockups/pine-den-live.jpg` | PH | X-GLOB | F6 → S2.1 | Compare.ts looks pictures up by computed key: moves with the shard's manifest.explore.compare |  |
| `mockups/pine-den-target.jpg` | bin 312 K | `E:explore/img/mockups/pine-den-target.jpg` | `PH:explore/mockups/pine-den-target.jpg` | PH | X-GLOB | F6 → S2.1 | Compare.ts looks pictures up by computed key: moves with the shard's manifest.explore.compare |  |
| `mockups/pine-hamlet-live.jpg` | bin 85 K | `E:explore/img/mockups/pine-hamlet-live.jpg` | `PH:explore/mockups/pine-hamlet-live.jpg` | PH | X-GLOB | F6 → S2.1 | Compare.ts looks pictures up by computed key: moves with the shard's manifest.explore.compare |  |
| `mockups/pine-hamlet-target.jpg` | bin 273 K | `E:explore/img/mockups/pine-hamlet-target.jpg` | `PH:explore/mockups/pine-hamlet-target.jpg` | PH | X-GLOB | F6 → S2.1 | Compare.ts looks pictures up by computed key: moves with the shard's manifest.explore.compare |  |
| `mockups/pine-ridge-live.jpg` | bin 86 K | `E:explore/img/mockups/pine-ridge-live.jpg` | `PH:explore/mockups/pine-ridge-live.jpg` | PH | X-GLOB | F6 → S2.1 | Compare.ts looks pictures up by computed key: moves with the shard's manifest.explore.compare |  |
| `mockups/pine-ridge-target.jpg` | bin 305 K | `E:explore/img/mockups/pine-ridge-target.jpg` | `PH:explore/mockups/pine-ridge-target.jpg` | PH | X-GLOB | F6 → S2.1 | Compare.ts looks pictures up by computed key: moves with the shard's manifest.explore.compare |  |
| `mockups/shrine.jpg` | bin 121 K | `E:explore/img/mockups/shrine.jpg` | `DI:explore/mockups/shrine.jpg` | DI | X-GLOB | F6 → S4.1 | no compare pair names it (dead? Q9); moves with Driftwood's pairs | 08 |
| `mockups/spawn.jpg` | bin 107 K | `E:explore/img/mockups/spawn.jpg` | `DI:explore/mockups/spawn.jpg` | DI | X-GLOB | F6 → S4.1 | no compare pair names it (dead? Q9); moves with Driftwood's pairs | 08 |
| `mockups/wreck.jpg` | bin 111 K | `E:explore/img/mockups/wreck.jpg` | `DI:explore/mockups/wreck.jpg` | DI | X-GLOB | F6 → S4.1 | no compare pair names it (dead? Q9); moves with Driftwood's pairs | 08 |
| `models-driftwood-isle.webp` | bin 31 K | `DI:explore/models-driftwood-isle.webp` | = | DI | T | F6 | hub card art by slug; Explore.ts imports and the ART glob are rewritten (05 §1.2; EI21) |  |
| `models-nalati-grasslands.webp` | bin 20 K | `NG:explore/models-nalati-grasslands.webp` | = | NG | T | F6 | hub card art by slug; Explore.ts imports and the ART glob are rewritten (05 §1.2; EI21) |  |
| `models-nine-dragon-stack.webp` | bin 26 K | `ND:explore/models-nine-dragon-stack.webp` | = | ND | T | F6 | hub card art by slug; Explore.ts imports and the ART glob are rewritten (05 §1.2; EI21) |  |
| `models-pine-hollow.webp` | bin 32 K | `PH:explore/models-pine-hollow.webp` | = | PH | T | F6 | hub card art by slug; Explore.ts imports and the ART glob are rewritten (05 §1.2; EI21) |  |
| `models.webp` | bin 21 K | `E:explore/img/models.webp` | = | engine | F | F6 | generic hub art; referenced only by the ART glob (dead? Q9) |  |
| `playground-grapple.webp` | bin 24 K | `ND:explore/playground-grapple.webp` | = | ND | T | F6 | the grapple playground card (05 §1.2) |  |
| `playground-horse.webp` | bin 13 K | `NG:explore/playground-horse.webp` | = | NG | T | F6 | the horse playground card (01 §22) |  |
| `practice-driftwood-isle.webp` | bin 32 K | `DI:explore/practice-driftwood-isle.webp` | = | DI | T | F6 | hub card art by slug; Explore.ts imports and the ART glob are rewritten (05 §1.2; EI21) |  |
| `practice-nalati-grasslands.webp` | bin 21 K | `NG:explore/practice-nalati-grasslands.webp` | = | NG | T | F6 | hub card art by slug; Explore.ts imports and the ART glob are rewritten (05 §1.2; EI21) |  |
| `practice-nine-dragon-stack.webp` | bin 30 K | `ND:explore/practice-nine-dragon-stack.webp` | = | ND | T | F6 | hub card art by slug; Explore.ts imports and the ART glob are rewritten (05 §1.2; EI21) |  |
| `practice-pine-hollow.webp` | bin 34 K | `PH:explore/practice-pine-hollow.webp` | = | PH | T | F6 | hub card art by slug; Explore.ts imports and the ART glob are rewritten (05 §1.2; EI21) |  |
| `practice.jpg` | bin 130 K | `E:explore/img/practice.jpg` | = | engine | F | F6 | generic hub art; referenced only by the ART glob (dead? Q9) |  |
| `sets-driftwood-isle.webp` | bin 38 K | `DI:explore/sets-driftwood-isle.webp` | = | DI | T | F6 | hub card art by slug; Explore.ts imports and the ART glob are rewritten (05 §1.2; EI21) |  |
| `sets-nalati-grasslands.webp` | bin 33 K | `NG:explore/sets-nalati-grasslands.webp` | = | NG | T | F6 | hub card art by slug; Explore.ts imports and the ART glob are rewritten (05 §1.2; EI21) |  |
| `sets-nine-dragon-stack.webp` | bin 45 K | `ND:explore/sets-nine-dragon-stack.webp` | = | ND | T | F6 | hub card art by slug; Explore.ts imports and the ART glob are rewritten (05 §1.2; EI21) |  |
| `sets-pine-hollow.webp` | bin 51 K | `PH:explore/sets-pine-hollow.webp` | = | PH | T | F6 | hub card art by slug; Explore.ts imports and the ART glob are rewritten (05 §1.2; EI21) |  |
| `world-driftwood-isle.webp` | bin 32 K | `DI:explore/world-driftwood-isle.webp` | = | DI | T | F6 | hub card art by slug; Explore.ts imports and the ART glob are rewritten (05 §1.2; EI21) |  |
| `world-nalati-grasslands.webp` | bin 23 K | `NG:explore/world-nalati-grasslands.webp` | = | NG | T | F6 | hub card art by slug; Explore.ts imports and the ART glob are rewritten (05 §1.2; EI21) |  |
| `world-nine-dragon-stack.webp` | bin 51 K | `ND:explore/world-nine-dragon-stack.webp` | = | ND | T | F6 | hub card art by slug; Explore.ts imports and the ART glob are rewritten (05 §1.2; EI21) |  |
| `world-pine-hollow.webp` | bin 47 K | `PH:explore/world-pine-hollow.webp` | = | PH | T | F6 | hub card art by slug; Explore.ts imports and the ART glob are rewritten (05 §1.2; EI21) |  |
| `world.webp` | bin 20 K | `E:explore/img/world.webp` | = | engine | F | F6 | generic hub art; referenced only by the ART glob (dead? Q9) |  |

#### `src/fx/` — 2 files, 219 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `Impacts.ts` | 150 | `E:fx/Impacts.ts` | = | engine | F | F6 |  |  |
| `LightPool.ts` | 69 | `E:fx/LightPool.ts` | = | engine | F | F6 |  |  |

#### `src/game/` — 7 files, 1,420 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `achievements.ts` | 103 | `G:achievements.ts` | = | game | SPLIT | F6 (+S2.1, S3.1, S4.3) | feats per shard: each shard's list leaves to shard:feats.ts (06 §1.3; split table §3.13) |  |
| `Boss.ts` | 328 | `G:Boss.ts` | `E:ai/Boss.ts` | engine | M | F6 → S2.3 | the boss runtime is engine (01 §19; 09 §5.1); stays in #game at F6 (02 F6 map) |  |
| `Elite.ts` | 358 | `G:Elite.ts` | `E:ai/Elite.ts` | engine | M | F6 → S2.3 | one elite runtime (09 §5.4); stays in #game at F6 (02 F6 map) |  |
| `Inventory.ts` | 147 | `G:Inventory.ts` | = | game | SPLIT | F6 (+S1.1, S2.1, S4.2) | the pack stays #game; Pine rows / pack rule / ND pack flag → manifests (06 §1.3; 05 §1.2) (split table §3.13) |  |
| `LastPlace.ts` | 69 | `G:LastPlace.ts` | = | game | GM | F6 | src/game/** keeps its path as #game (02 F6 map) |  |
| `Progress.ts` | 109 | `G:Progress.ts` | = | game | GM | F6 | src/game/** keeps its path as #game (02 F6 map) |  |
| `Taming.ts` | 306 | `NG:ride/Taming.ts` | = | NG | I | F6 | imported only by nalati/ride.ts (02 rule 2); riding stays a Nalati mechanism (S3.3) | 07 |

#### `src/game/loot/` — 11 files, 1,033 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `Bounty.ts` | 50 | `G:loot/Bounty.ts` | = | game | GM | F6 | src/game/** keeps its path as #game (02 F6 map) |  |
| `CoinBurst.ts` | 138 | `G:loot/CoinBurst.ts` | = | game | GM | F6 | src/game/** keeps its path as #game (02 F6 map) |  |
| `coins.ts` | 38 | `G:loot/coins.ts` | = | game | GM | F6 (+S4.2) | the kill → coin rule stays #game; Driftwood's values → loot.driftwood.coins (09 §5.6) |  |
| `finds.ts` | 69 | `DI:loot/finds.ts` | = | DI | N | F6 (+S4.3) | Driftwood's FINDS (its header) | 08 |
| `install.ts` | 196 | `G:loot/install.ts` | = | game | GM | F6 (+S4.3) | installLoot (#game); its Driftwood calls move to the plugin at S4.3 | 08 |
| `keepsakes.ts` | 235 | `DI:loot/keepsakes.ts` | = | DI | N | F6 (+S4.3) | Driftwood's keepsakes (its header); trophies → loot.driftwood.trophies (09 §5.6) | 08 |
| `Owned.ts` | 105 | `G:loot/Owned.ts` | = | game | GM | F6 | src/game/** keeps its path as #game (02 F6 map) |  |
| `perks.ts` | 43 | `DI:loot/perks.ts` | = | DI | N | F6 (+S4.3) | what Driftwood's owned things do (its header) | 08 |
| `Purse.ts` | 65 | `G:loot/Purse.ts` | = | game | GM | F6 | src/game/** keeps its path as #game (02 F6 map) |  |
| `shop.ts` | 73 | `DI:loot/shop.ts` | = | DI | N | F6 (+S4.3) | the Driftwood trader's goods (its header) | 08 |
| `store.ts` | 21 | `G:loot/store.ts` | ✗ | ✗ | GM | F6 → F10 | replaced by SaveStore (02 F10 step 5) |  |

#### `src/game/quest/` — 15 files, 1,923 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `Adventure.ts` | 266 | `G:quest/Adventure.ts` | `DI:quest/Adventure.ts` | DI | SPLIT | F6 → S4.3 | Driftwood's adventure install + the per-shard ADVENTURES registry (plugins replace it) (split table §3.13) | 08 |
| `Complete.ts` | 162 | `DI:quest/Complete.ts` | = | DI | N | F6 (+S4.3) | Driftwood complete (its header) | 08 |
| `core.ts` | 173 | `G:quest/core.ts` | `E:quest/core.ts` | engine | M | F6 → S2.5 | the shared quest core = the engine quest runtime (06 §6.5) |  |
| `driftwood.ts` | 97 | `DI:quest/questLine.ts` | = | DI | N | F6 (+S4.3) | Driftwood's quest data (02 rule 4); renamed: a driftwood.ts inside the Driftwood folder names nothing | 08 |
| `Ecology.ts` | 90 | `DI:quest/Ecology.ts` | = | DI | N | F6 (+S4.3) | the island's enemies come back (its header) | 08 |
| `Feats.ts` | 42 | `DI:quest/Feats.ts` | = | DI | N | F6 (+S4.3) | Driftwood's collectibles (its header) | 08 |
| `Finale.ts` | 112 | `DI:quest/Finale.ts` | = | DI | N | F6 (+S4.3) | the Drowned Captain finale → the boss runtime at S4.2 (09 §5.4) | 08 |
| `guards.ts` | 15 | `DI:quest/guards.ts` | = | DI | N | F6 (+S4.3) | the iron sword's guard | 08 |
| `gullGuide.ts` | 89 | `DI:quest/gullGuide.ts` | = | DI | N | F6 (+S4.3) | the gull guide (DRIFTWOOD-TOP10) | 08 |
| `nalati.ts` | 328 | `NG:quest.ts` | = | NG | I | F6 | Nalati's quest data (02 rule 2) | 07 |
| `Places.ts` | 33 | `DI:quest/Places.ts` | = | DI | N | F6 (+S4.3) | Driftwood's named places (check-models.mjs reads it) | 08 |
| `quest.ts` | 151 | `G:quest/quest.ts` | `E:quest/quest.ts` | engine | M | F6 → S2.5 | the quest schema + state machine (engine) |  |
| `QuestUI.ts` | 186 | `G:quest/QuestUI.ts` | `E:quest/QuestUI.ts` | engine | M | F6 → S2.5 | the quest HUD pieces (engine; on UI layers at X2) |  |
| `Spine.ts` | 98 | `DI:quest/Spine.ts` | = | DI | N | F6 (+S4.3) | Driftwood's quest spine | 08 |
| `TraderStall.ts` | 81 | `DI:quest/TraderStall.ts` | = | DI | N | F6 (+S4.3) | the trader's stall at Wendell's hut | 08 |

#### `src/models/` — 18 files, 3,211 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `colliders.ts` | 115 | `E:models/colliders.ts` | = | engine | F | F6 |  |  |
| `creature.ts` | 55 | `E:models/creature.ts` | = | engine | F | F6 |  |  |
| `creatures.ts` | 21 | `E:models/creatures.ts` | `K:models/creatures.ts` | kit | K | F6 → S2.3 | shared/boar + shared/bear with the kit species; `deer` → Pine's models/creatures.ts at S2.3 |  |
| `cull.ts` | 609 | `E:models/cull.ts` | = | engine | F | F6 |  |  |
| `gear.ts` | 87 | `E:models/gear.ts` | `K:models/gear.ts` | kit | K | F6 → S1.2 | shared/ gear models (the iron sword, 09 §1.5); imports Sword / Skins, which move at S1.2 / S2.2 |  |
| `glb.ts` | 89 | `E:models/glb.ts` | = | engine | M | F6 | loader, no shard data (02 rule 5) |  |
| `hoverboard.ts` | 29 | `E:models/hoverboard.ts` | `K:models/hoverboard.ts` | kit | K | F6 → X1 | tool.hoverboard moves to #kit/tools at X1 (09 §1.7 Q7) |  |
| `hull.ts` | 46 | `E:models/hull.ts` | = | engine | M | F6 | loader, no shard data (02 rule 5) |  |
| `interact.ts` | 109 | `E:models/interact.ts` | `K:models/interact.ts` | kit | K | F6 → S4.3 | the interactables kit's models (Driftwood + Pine's token shelf); names doubloons (engine word list) | 08 |
| `live.ts` | 135 | `E:models/live.ts` | = | engine | F | F6 |  |  |
| `model.ts` | 271 | `E:models/model.ts` | = | engine | F | F6 |  |  |
| `place.ts` | 1092 | `E:models/place.ts` | = | engine | F | F6 |  |  |
| `roster.ts` | 41 | `E:models/roster.ts` | = | engine | F | F6 |  |  |
| `sets.ts` | 45 | `E:models/sets.ts` | = | engine | F | F6 |  |  |
| `slots.ts` | 88 | `E:models/slots.ts` | = | engine | M | F6 | SlotGeometry is a mechanism (02 rule 2 would send it to Driftwood: Q2) |  |
| `swimHands.ts` | 42 | `E:models/swimHands.ts` | = | engine | F | F6 |  |  |
| `trainingDummy.ts` | 61 | `E:models/trainingDummy.ts` | = | engine | F | F6 |  |  |
| `weld.ts` | 276 | `E:models/weld.ts` | = | engine | F | F6 |  |  |

#### `src/nalati/` — 36 files, 9,463 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `adventure.ts` | 252 | `NG:adventure.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `bag.ts` | 91 | `NG:bag.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `balbalWarriors.ts` | 269 | `NG:balbalWarriors.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `campPeople.ts` | 376 | `NG:campPeople.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `campPeopleModels.ts` | 265 | `NG:campPeopleModels.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `cragRock.ts` | 180 | `NG:cragRock.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `elites.ts` | 896 | `NG:elites.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `ghostRiders.ts` | 431 | `NG:ghostRiders.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `index.ts` | 427 | `NG:index.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `kokpar.ts` | 122 | `NG:kokpar.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `kurganBoss.ts` | 802 | `NG:kurganBoss.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `look/bake.ts` | 231 | `NG:look/bake.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `look/cloudSea.ts` | 80 | `NG:look/cloudSea.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `look/fog.ts` | 97 | `NG:look/fog.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `look/grade.ts` | 133 | `NG:look/grade.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `look/grass.ts` | 697 | `NG:look/grass.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `look/horizon.ts` | 39 | `NG:look/horizon.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `look/index.ts` | 87 | `NG:look/index.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `look/light.ts` | 66 | `NG:look/light.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `look/panoramaData.ts` | 9 | `NG:look/panoramaData.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `look/sky.ts` | 221 | `NG:look/sky.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `look/tint.ts` | 66 | `NG:look/tint.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `look/zones.ts` | 40 | `NG:look/zones.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `nightEnemies.ts` | 65 | `NG:nightEnemies.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `nightFx.ts` | 124 | `NG:nightFx.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `outcrops.ts` | 183 | `NG:outcrops.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `ride.ts` | 178 | `NG:ride/ride.ts` | = | NG | T | F6 | Nalati ride wiring; into ride/ beside the ride files from engine folders (a ride.ts beside a ride/ folder reads badly) |  |
| `sheepRaid.ts` | 265 | `NG:sheepRaid.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `sound.ts` | 222 | `NG:sound.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `stealth.ts` | 270 | `NG:stealth.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `stormTitan.ts` | 1116 | `NG:stormTitan.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `stormTitanLook.ts` | 304 | `NG:stormTitanLook.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `terrainSurface.ts` | 276 | `NG:terrainSurface.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `water.ts` | 243 | `NG:water.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `weather.ts` | 307 | `NG:weather.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |
| `wet.ts` | 33 | `NG:wet.ts` | = | NG | T | F6 | Nalati code (02 rule 1) |  |

#### `src/native/` — 6 files, 659 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `boot.ts` | 36 | `E:native/boot.ts` | = | engine | F | F6 |  |  |
| `lifecycle.ts` | 22 | `E:native/lifecycle.ts` | = | engine | F | F6 |  |  |
| `ota-config.ts` | 31 | `E:native/ota-config.ts` | = | engine | F | F6 |  |  |
| `ota.ts` | 71 | `E:native/ota.ts` | = | engine | F | F6 |  |  |
| `saves.ts` | 58 | `E:native/saves.ts` | = | engine | F | F6 |  |  |
| `updates.ts` | 441 | `E:native/updates.ts` | = | engine | F | F6 |  |  |

#### `src/physics/` — 23 files, 2,451 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `active.ts` | 15 | `E:physics/active.ts` | = | engine | F | F6 |  |  |
| `bodies.ts` | 400 | `E:physics/bodies.ts` | = | engine | F | F6 |  |  |
| `bridge.ts` | 64 | `E:physics/bridge.ts` | ✗ | ✗ | F | F6 → F11 | the legacy collider bridge, deleted (02 F11 step 1) |  |
| `CharacterMotor.ts` | 273 | `E:physics/CharacterMotor.ts` | = | engine | F | F6 |  |  |
| `creatures.ts` | 142 | `E:physics/creatures.ts` | = | engine | F | F6 |  |  |
| `debug.ts` | 68 | `E:physics/debug.ts` | = | engine | F | F6 |  |  |
| `groups.ts` | 39 | `E:physics/groups.ts` | = | engine | F | F6 |  |  |
| `heightPatch.ts` | 43 | `E:physics/heightPatch.ts` | = | engine | F | F6 |  |  |
| `navmesh.ts` | 251 | `E:physics/navmesh.ts` | = | engine | F | F6 |  |  |
| `navmeshUrl.ts` | 8 | `E:physics/navmeshUrl.ts` | = | engine | F | F6 |  |  |
| `paths.ts` | 135 | `E:physics/paths.ts` | = | engine | F | F6 |  |  |
| `Physics.ts` | 30 | `E:physics/Physics.ts` | = | engine | F | F6 |  |  |
| `pieces.ts` | 86 | `E:physics/pieces.ts` | = | engine | F | F6 |  |  |
| `query.ts` | 102 | `E:physics/query.ts` | = | engine | F | F6 |  |  |
| `ragdoll.ts` | 452 | `E:physics/ragdoll.ts` | = | engine | F | F6 |  |  |
| `rapier-bg.d.ts` | 5 | `E:physics/rapier-bg.d.ts` | = | engine | F | F6 |  |  |
| `rapier.ts` | 29 | `E:physics/rapier.ts` | = | engine | F | F6 |  |  |
| `rapierBindings.ts` | 5 | `E:physics/rapierBindings.ts` | = | engine | F | F6 |  |  |
| `ropeChain.ts` | 119 | `E:physics/ropeChain.ts` | = | engine | F | F6 |  |  |
| `surface.ts` | 33 | `E:physics/surface.ts` | = | engine | F | F6 |  |  |
| `terrain.ts` | 98 | `E:physics/terrain.ts` | = | engine | F | F6 |  |  |
| `trainingTargets.ts` | 51 | `E:physics/trainingTargets.ts` | = | engine | F | F6 |  |  |
| `wasmUrl.ts` | 3 | `E:physics/wasmUrl.ts` | = | engine | F | F6 |  |  |

#### `src/pinehollow/` — 33 files, 6,831 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `ammo.ts` | 83 | `PH:loadout/ammo.ts` | = | PH | T | F6 (+S2.2) | Pine code (06 §1.2) |  |
| `antlerKing.ts` | 687 | `PH:combat/antlerKing.ts` | = | PH | T | F6 (+S2.3) | Pine code (06 §1.2) |  |
| `audioWiring.ts` | 131 | `PH:audio/wiring.ts` | = | PH | T | F6 (+S2.1) | Pine code (06 §1.2) |  |
| `combatMath.ts` | 97 | `PH:combat/combatMath.ts` | = | PH | T | F6 (+S2.3) | Pine code (06 §1.2) |  |
| `ctx.ts` | 134 | `PH:combat/ctx.ts` | = | PH | T | F6 (+S2.3) | Pine code (06 §1.2) |  |
| `elites.ts` | 473 | `PH:combat/elites.ts` | = | PH | T | F6 (+S2.3) | Pine code (06 §1.2) |  |
| `feel.ts` | 83 | `PH:combat/feel.ts` | ✗ | ✗ | T | F6 → S2.2 | its monkey-patches become the ranged profiles' hit-stop / kick / trauma fields, then deleted (06 §1.2) |  |
| `finishes.ts` | 44 | `PH:loadout/finishes.ts` | = | PH | T | F6 (+S2.2) | Pine code (06 §1.2) |  |
| `fxKit.ts` | 116 | `PH:combat/fxKit.ts` | = | PH | T | F6 (+X5) | Pine code (06 §1.2) |  |
| `index.ts` | 156 | `PH:combat/install.ts` | = | PH | T | F6 (+S2.3) | Pine code (06 §1.2) |  |
| `kingRig.ts` | 497 | `PH:combat/kingRig.ts` | = | PH | T | F6 (+S2.3) | Pine code (06 §1.2) |  |
| `life/birdFix.ts` | 201 | `PH:life/birdFix.ts` | = | PH | T | F6 (+S2.1) | Pine code (06 §1.2) |  |
| `life/birdModels.ts` | 202 | `PH:life/birdModels.ts` | = | PH | T | F6 (+S2.1) | Pine code (06 §1.2) |  |
| `life/index.ts` | 761 | `PH:life/index.ts` | = | PH | T | F6 (+S2.1) | Pine code (06 §1.2) |  |
| `life/lifeMath.ts` | 61 | `PH:life/lifeMath.ts` | = | PH | T | F6 (+S2.1) | Pine code (06 §1.2) |  |
| `life/trunks.ts` | 81 | `PH:life/trunks.ts` | = | PH | T | F6 (+S2.1) | Pine code (06 §1.2) |  |
| `loadout.ts` | 241 | `PH:loadout/loadout.ts` | = | PH | T | F6 (+S2.2) | Pine code (06 §1.2) |  |
| `perfLapHost.ts` | 59 | `PH:dev/perfLap.ts` | = | PH | T | F6 (+S2.1) | Pine code (06 §1.2) |  |
| `quest/beats.ts` | 42 | `PH:quest/beats.ts` | = | PH | T | F6 (+S2.5) | Pine code (06 §1.2) |  |
| `quest/contracts.ts` | 190 | `PH:quest/contracts.ts` | = | PH | T | F6 (+S2.5) | Pine code (06 §1.2) |  |
| `quest/hollowLog.ts` | 38 | `PH:quest/hollowLog.ts` | = | PH | T | F6 (+S2.5) | Pine code (06 §1.2) |  |
| `quest/index.ts` | 605 | `PH:quest/index.ts` | = | PH | T | F6 (+S2.5) | Pine code (06 §1.2) |  |
| `quest/nightThralls.ts` | 142 | `PH:quest/nightThralls.ts` | = | PH | T | F6 (+S2.5) | Pine code (06 §1.2) |  |
| `quest/npcModels.ts` | 138 | `PH:quest/npcModels.ts` | = | PH | T | F6 (+S2.5) | Pine code (06 §1.2) |  |
| `quest/npcRig.ts` | 578 | `PH:quest/npcRig.ts` | `K:npc/npcRig.ts` | kit | K | F6 → S2.5 | the seed of the kit NPC rig (01 §21, D9; 06 §1.2) |  |
| `quest/rides.ts` | 162 | `PH:quest/rides.ts` | = | PH | T | F6 (+S2.5) | Pine code (06 §1.2) |  |
| `quest/stagLead.ts` | 108 | `PH:quest/stagLead.ts` | = | PH | T | F6 (+S2.5) | Pine code (06 §1.2) |  |
| `quest/table.ts` | 79 | `PH:quest/table.ts` | = | PH | T | F6 (+S2.5) | Pine code (06 §1.2) |  |
| `quest/tokenShelf.ts` | 53 | `PH:quest/tokenShelf.ts` | = | PH | T | F6 (+S2.5) | Pine code (06 §1.2) |  |
| `quest/trades.ts` | 70 | `PH:quest/trades.ts` | = | PH | T | F6 (+S2.5) | Pine code (06 §1.2) |  |
| `quest/ui.ts` | 145 | `PH:quest/ui.ts` | = | PH | T | F6 (+S2.5) | Pine code (06 §1.2) |  |
| `quest/wardensHollow.ts` | 166 | `PH:quest/wardensHollow.ts` | = | PH | T | F6 (+S2.5) | Pine code (06 §1.2) |  |
| `weather.ts` | 208 | `PH:world/weather.ts` | = | PH | T | F6 (+S2.4) | Pine code (06 §1.2) |  |

#### `src/player/` — 44 files, 15,185 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `AimAssist.ts` | 216 | `E:player/AimAssist.ts` | = | engine | F | F6 |  |  |
| `AimTargets.ts` | 64 | `E:player/AimTargets.ts` | = | engine | F | F6 |  |  |
| `bladeGlow.ts` | 120 | `E:player/bladeGlow.ts` | `DI:loot/bladeGlow.ts` | DI | X-WEAPON | F6 → S4.3 | the sea-glass charm III halo: a Driftwood keepsake effect's look | 08 |
| `BodyShadow.ts` | 148 | `E:player/BodyShadow.ts` | = | engine | F | F6 |  |  |
| `Bow.ts` | 981 | `E:player/Bow.ts` | `K:weapons/bow/Bow.ts` | kit | X-WEAPON | F6 → S2.2 | the Bow family (09 §1.3) |  |
| `bowDraw.ts` | 100 | `E:player/bowDraw.ts` | `K:weapons/bow/bowDraw.ts` | kit | X-WEAPON | F6 → S2.2 | Bow family draw curve (Bow + Longbow) |  |
| `CameraFX.ts` | 79 | `E:player/CameraFX.ts` | = | engine | F | F6 |  |  |
| `Cosmetics.ts` | 119 | `E:player/Cosmetics.ts` | = | engine | F | F6 |  |  |
| `Crossbow.ts` | 1307 | `E:player/Crossbow.ts` | `K:weapons/crossbow/Crossbow.ts` | kit | X-WEAPON | F6 → S2.2 | the Crossbow family (06 §1.3; 09 §1.3) |  |
| `GoldenBow.ts` | 233 | `NG:weapons/GoldenBow.ts` | = | NG | I | F6 (+S3.3) | 02 rule 2; GoldenBow extends Bow at S3.3 | 07 |
| `Hands.ts` | 210 | `E:player/Hands.ts` | = | engine | F | F6 |  |  |
| `horseNames.ts` | 52 | `NG:ride/horseNames.ts` | = | NG | I | F6 | Nalati ride (ws.nalati.horseNames) | 07 |
| `Hoverboard.ts` | 137 | `E:player/Hoverboard.ts` | `K:tools/hoverboard.ts` | kit | K | F6 → X1 | tool.hoverboard (09 §1.7 Q7) |  |
| `hunterHands.ts` | 435 | `E:player/hunterHands.ts` | `K:viewmodel/hunterHands.ts` | kit | X-WEAPON | F6 → S2.2 | shared by the Crossbow family and Pine's Longbow / LeverRifle (06 §1.3) |  |
| `IronSword.ts` | 318 | `DI:weapons/IronSword.ts` | = | DI | G | F6 (+S4.1) | the iron-sword pickup, Driftwood only (02 rule 3; 09 §1.5) | 08 |
| `LeverRifle.ts` | 929 | `PH:weapons/LeverRifle.ts` | = | PH | G | F6 (+S2.2) | Pine only: LeverRifle extends Firearm there (09 §1.5; 06 §1.3 says kit: Q3) |  |
| `LockOnTarget.ts` | 362 | `E:player/LockOnTarget.ts` | = | engine | F | F6 |  |  |
| `Longbow.ts` | 792 | `E:player/Longbow.ts` | `PH:weapons/longbow.ts` | PH | X-WEAPON | F6 → S2.2 | Pine only; becomes the LONGBOW profile row, ~450 lines deleted (09 §1.5, §6 step 7) |  |
| `meleeGeo.ts` | 213 | `NG:weapons/meleeGeo.ts` | = | NG | I | F6 | used by Sabre, Spear and the Nalati gear model only (the dead half goes at F7) | 07 |
| `MeleeSweep.ts` | 50 | `E:player/MeleeSweep.ts` | `E:combat/blocks/meleeSweep.ts` | engine | X-WEAPON | F6 → S1.2 | the melee sweep block (01 §18) |  |
| `Mount.ts` | 794 | `NG:ride/Mount.ts` | = | NG | I | F6 (+S3.3) | riding stays a Nalati mechanism (plan §2.4, S3.3) | 07 |
| `Naizagai.ts` | 264 | `NG:weapons/Naizagai.ts` | = | NG | I | F6 (+S3.3) | 02 rule 2; Naizagai extends Sabre at S3.3 (09 §1.5) | 07 |
| `nalatiArms.ts` | 390 | `E:player/nalatiArms.ts` | `K:viewmodel/nalatiArms.ts` | kit | X-WEAPON | F6 → S2.2 | the arms of the Bow family + Pine's Longbow + Nalati's Sabre / Spear (rule of two) | 07 |
| `nalatiKit.ts` | 58 | `NG:weapons/nalatiKit.ts` | ✗ | ✗ | N | F6 → S3.3 | Nalati's loadout → manifest.loadout, then deleted (bug §7.5) | 07 |
| `nalatiSkins.ts` | 233 | `NG:weapons/nalatiSkins.ts` | = | NG | I | F6 (+X5) | NalatiSkinLocker → skin rows on the #game cosmetics service at X5 | 07 |
| `Player.ts` | 739 | `E:player/Player.ts` | = | engine | F | F6 |  |  |
| `Projectiles.ts` | 453 | `E:player/Projectiles.ts` | `E:combat/blocks/projectile.ts` | engine | X-WEAPON | F6 → S2.2 | the projectile block (01 §18; plan S2.2) |  |
| `Reins.ts` | 183 | `NG:ride/Reins.ts` | = | NG | I | F6 (+S3.3) | Nalati ride | 07 |
| `rideAssist.ts` | 117 | `NG:ride/rideAssist.ts` | = | NG | I | F6 | Nalati ride | 07 |
| `riding.ts` | 21 | `E:player/riding.ts` | `NG:ride/riding.ts` | NG | SPLIT | F6 → S3.3 | the ridden horse read by Combat.ts / main Targets: the engine reads `ask('player.mount')` after S3.3 (split table §3.13) | 07 |
| `Rifle.ts` | 613 | `E:player/Rifle.ts` | `K:weapons/firearm/Firearm.ts` | kit | X-WEAPON | F6 → S2.2 | the Firearm family; the AR15 row → Nalati weapons/ar15.ts (09 §1.5) |  |
| `rigArms.ts` | 282 | `K:viewmodel/rigArms.ts` | = | kit | K | F6 | Nine Dragon vm/arms + fpArms and Driftwood fpArms import it (05 §1.2) |  |
| `Sabre.ts` | 258 | `NG:weapons/Sabre.ts` | = | NG | I | F6 (+S1.2) | every importer is Nalati's (Mount, Naizagai, nalatiKit, nalatiSkins, stormTitan, gear); Sabre extends Melee at S1.2 (09 §1.5) | 07 |
| `Skins.ts` | 299 | `E:player/Skins.ts` | `G:cosmetics/skinLocker.ts` | game | SPLIT | F6 → S2.2 / X5 | SkinLocker → #game cosmetics (X5); SKINS → Pine loadout/skins.ts (S2.2) (06 §1.3) (split table §3.13) |  |
| `Spear.ts` | 758 | `NG:weapons/Spear.ts` | = | NG | I | F6 (+S1.2) | Nalati only (09 §1.5); Spear + Thrown at S1.2 | 07 |
| `Sword.ts` | 1061 | `E:player/Sword.ts` | `K:weapons/melee/Melee.ts` | kit | X-WEAPON | F6 → S1.2 | the Melee family class (09 §1.3, §1.5); the rows go to melee/sword.ts |  |
| `SwordMoves.ts` | 113 | `E:player/SwordMoves.ts` | `K:weapons/melee/swordMoves.ts` | kit | X-WEAPON | F6 → S1.2 | the sword combo moves (Melee family data) |  |
| `TouchControls.ts` | 482 | `E:player/TouchControls.ts` | = | engine | SPLIT | F6 (+S1.4, X1) | the weapon-id sets and the ride / grapple relabels leave for contexts (split table §3.8) |  |
| `viewmodelTextures.ts` | 250 | `E:player/viewmodelTextures.ts` | `K:weapons/crossbow/viewmodelTextures.ts` | kit | X-WEAPON | F6 → S2.2 | the crossbow / rifle texture sets; started by `preload.textures` on a family (05 §2.1) |  |
| `viewmodelTextures.worker.ts` | 25 | `E:player/viewmodelTextures.worker.ts` | `K:weapons/crossbow/viewmodelTextures.worker.ts` | kit | X-WEAPON | F6 → S2.2 | moves with viewmodelTextures.ts (a `new Worker(new URL(...))` pair) |  |
| `WaterLine.ts` | 88 | `E:player/WaterLine.ts` | = | engine | F | F6 |  |  |
| `Weapon.ts` | 62 | `E:player/Weapon.ts` | ✗ | ✗ | X-WEAPON | F6 → S1.2 | replaced by Equipment / Weapon / Tool in #engine/combat (09 §6 step 2) |  |
| `WeaponPickup.ts` | 454 | `E:player/WeaponPickup.ts` | = | engine | F | F6 |  |  |
| `Weapons.ts` | 323 | `E:player/Weapons.ts` | ✗ | ✗ | X-WEAPON | F6 → S1.2 | replaced by EquipmentService (09 §6 step 2) (split table §3.12) |  |

#### `src/playgrounds/` — 9 files, 1,083 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `catalog.ts` | 45 | `E:practice/playground/catalog.ts` | = | engine | SPEC | F6 (+S1.4, S3.1) | the playground framework (01 §22, EI22) |  |
| `devGrid.ts` | 170 | `E:practice/playground/devGrid.ts` | = | engine | SPEC | F6 | the playground framework (01 §22, EI22) |  |
| `grappleCourse.ts` | 87 | `ND:playground/grappleCourse.ts` | = | ND | SPEC | F6 (+S1.4) | 05 §1.2 |  |
| `GrapplePlayground.ts` | 272 | `ND:playground/GrapplePlayground.ts` | = | ND | SPEC | F6 (+S1.4) | registered with ctx.playground at S1.4 (05 §1.2) |  |
| `horseCourse.ts` | 48 | `NG:playground/horseCourse.ts` | = | NG | SPEC | F6 (+S3.1) | 01 §22 | 07 |
| `HorsePlayground.ts` | 322 | `NG:playground/HorsePlayground.ts` | = | NG | SPEC | F6 (+S3.1) | the horse course moves to Nalati (01 §22) | 07 |
| `hud.ts` | 64 | `E:practice/playground/hud.ts` | = | engine | SPEC | F6 | the playground framework (01 §22, EI22) |  |
| `load.ts` | 20 | `E:practice/playground/load.ts` | = | engine | SPEC | F6 (+S1.4, S3.1) | the playground framework (01 §22, EI22) |  |
| `Playground.ts` | 55 | `E:practice/playground/Playground.ts` | = | engine | SPEC | F6 (+S1.4, S3.1) | the playground framework (01 §22, EI22) |  |

#### `src/practice/` — 8 files, 1,223 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `arena.css` | 20 | `E:practice/arena.css` | = | engine | F | F6 |  |  |
| `DummyClips.ts` | 92 | `E:practice/DummyClips.ts` | = | engine | F | F6 |  |  |
| `DummyMotion.ts` | 280 | `E:practice/DummyMotion.ts` | = | engine | F | F6 |  |  |
| `DummyStudio.ts` | 136 | `E:practice/DummyStudio.ts` | = | engine | F | F6 |  |  |
| `lineup.ts` | 17 | `E:practice/lineup.ts` | = | engine | F | F6 |  |  |
| `TrainingArena.ts` | 435 | `E:practice/TrainingArena.ts` | = | engine | F | F6 |  |  |
| `TrainingDummy.ts` | 168 | `E:practice/TrainingDummy.ts` | = | engine | F | F6 |  |  |
| `TrainingDummyAssets.ts` | 75 | `E:practice/TrainingDummyAssets.ts` | = | engine | F | F6 |  |  |

#### `src/pwa/` — 1 files, 504 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `sw.js` | 504 | `E:pwa/sw.js` | = | engine | F | F6 | service worker (02 F6 folder map) |  |

#### `src/shard/` — 3 files, 454 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `disposeListeners.ts` | 79 | `E:shard/disposeListeners.ts` | ✗ | ✗ | F | F6 → F11 | the EventDispatcher patch, deleted (02 F11 step 2) |  |
| `ShardHost.ts` | 325 | `E:shard/ShardHost.ts` | ✗ | ✗ | F | F6 → F11 | the resident host, deleted (02 F11 step 2) |  |
| `switch.ts` | 50 | `G:travel/switch.ts` | = | game | GM | F6 | the page-reload shard switch = today's travel implementation (01 §20); the engine word list forbids 'shard' (02 F11 keeps the file) |  |

#### `src/telemetry/` — 2 files, 120 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `bootInbox.ts` | 17 | `E:telemetry/bootInbox.ts` | = | engine | F | F6 |  |  |
| `browserErrors.ts` | 103 | `E:telemetry/browserErrors.ts` | = | engine | F | F6 |  |  |

#### `src/ui/` — 50 files, 9,214 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `bag.ts` | 227 | `G:bag/bag.ts` | = | game | GM | F6 (+X2) | the Bag (01 §20); registered tabs + fragments at X2 |  |
| `BagButton.ts` | 83 | `G:bag/BagButton.ts` | = | game | GM | F6 | the Bag pill |  |
| `BootSettings.ts` | 150 | `E:ui/BootSettings.ts` | = | engine | F | F6 |  |  |
| `BossBar.ts` | 138 | `E:ui/BossBar.ts` | = | engine | F | F6 |  |  |
| `cards.ts` | 35 | `E:ui/cards.ts` | = | engine | F | F6 |  |  |
| `CoinChip.ts` | 67 | `G:loot/CoinChip.ts` | = | game | GM | F6 | the purse chip (coins are #game, 01 §20) |  |
| `Combat.ts` | 278 | `E:ui/Combat.ts` | = | engine | F | F6 |  |  |
| `DeathFade.ts` | 100 | `E:ui/DeathFade.ts` | = | engine | F | F6 |  |  |
| `DebugMenu.ts` | 177 | `E:ui/DebugMenu.ts` | = | engine | F | F6 |  |  |
| `debugOptions.ts` | 193 | `E:ui/debugOptions.ts` | = | engine | SPLIT | F6 (+S1–S4, X2) | shard rows / palettes / gated rows leave (split table §3.13) |  |
| `devSwitch.ts` | 25 | `E:ui/devSwitch.ts` | = | engine | F | F6 |  |  |
| `EliteBar.ts` | 197 | `E:ui/EliteBar.ts` | = | engine | F | F6 |  |  |
| `ErrorModal.ts` | 296 | `E:ui/ErrorModal.ts` | = | engine | F | F6 |  |  |
| `Feedback.ts` | 324 | `E:ui/Feedback.ts` | = | engine | F | F6 |  |  |
| `FirstHints.ts` | 243 | `E:ui/FirstHints.ts` | = | engine | F | F6 |  |  |
| `haptics.ts` | 26 | `E:ui/haptics.ts` | = | engine | F | F6 |  |  |
| `HorseNamePrompt.ts` | 71 | `NG:ride/HorseNamePrompt.ts` | = | NG | I | F6 | Nalati ride (02 rule 2) | 07 |
| `HUD.ts` | 569 | `E:ui/HUD.ts` | = | engine | SPLIT | F6 (+S1–S4, X2) | shard rows / palettes / gated rows leave (split table §3.13) |  |
| `hudSlots.ts` | 103 | `E:ui/hudSlots.ts` | = | engine | SPLIT | F6 (+S1–S4, X2) | shard rows / palettes / gated rows leave (split table §3.9) |  |
| `HurtArc.ts` | 111 | `E:ui/HurtArc.ts` | = | engine | F | F6 (+S1.1, X2) | respawn text → shard strings (05 §2.4; X2 step 5) |  |
| `icons.ts` | 279 | `E:ui/icons.ts` | = | engine | F | F6 |  |  |
| `loading.css` | 80 | `E:ui/loading.css` | = | engine | F | F6 |  |  |
| `Loading.ts` | 174 | `E:ui/Loading.ts` | = | engine | F | F6 (+S1.1) | the ND trace start → manifest boot data (05 §2.4) |  |
| `LockOn.ts` | 126 | `E:ui/LockOn.ts` | = | engine | F | F6 |  |  |
| `Map.ts` | 427 | `E:ui/Map.ts` | = | engine | F | F6 |  |  |
| `mapShapes.ts` | 102 | `E:ui/mapShapes.ts` | = | engine | F | F6 |  |  |
| `Menu.ts` | 585 | `E:ui/Menu.ts` | = | engine | SPLIT | F6 (+X2) | the pause menu shell stays engine; the Bag tabs leave to #game/bag at X2 (split table §3.13) |  |
| `Minimap.ts` | 727 | `E:ui/Minimap.ts` | = | engine | SPLIT | F6 (+S1–S4, X2) | shard rows / palettes / gated rows leave (split table §3.10) |  |
| `perf.css` | 58 | `E:ui/perf.css` | = | engine | F | F6 |  |  |
| `Perf.ts` | 278 | `E:ui/Perf.ts` | = | engine | F | F6 |  |  |
| `perfHud.ts` | 299 | `E:ui/perfHud.ts` | = | engine | F | F6 |  |  |
| `perfLap.ts` | 197 | `E:ui/perfLap.ts` | `E:debug/perfLap.ts` | engine | M | F6 → S2.1 | merged with core/perfLap.ts (06 §1.3) |  |
| `perfLapSummary.ts` | 91 | `E:ui/perfLapSummary.ts` | = | engine | F | F6 |  |  |
| `perfProbe.ts` | 270 | `E:ui/perfProbe.ts` | = | engine | F | F6 |  |  |
| `ReloadPrompt.ts` | 61 | `E:ui/ReloadPrompt.ts` | = | engine | F | F6 |  |  |
| `Resume.ts` | 111 | `E:ui/Resume.ts` | = | engine | F | F6 |  |  |
| `review.ts` | 134 | `E:ui/review.ts` | = | engine | F | F6 |  |  |
| `RideHUD.ts` | 232 | `NG:ride/RideHUD.ts` | = | NG | I | F6 | Nalati's horse HUD (02 rule 2; X2 step 5) | 07 |
| `roomMap.ts` | 109 | `E:ui/roomMap.ts` | = | engine | F | F6 |  |  |
| `RotateGate.ts` | 35 | `E:ui/RotateGate.ts` | = | engine | F | F6 |  |  |
| `Settings.ts` | 253 | `E:ui/Settings.ts` | = | engine | F | F6 |  |  |
| `ShardComplete.ts` | 132 | `G:complete/ShardComplete.ts` | = | game | GM | F6 | the shard-complete card is a Wildshard idea (01 §20 summary; engine word list forbids 'shard') |  |
| `ShopPanel.ts` | 178 | `DI:loot/ShopPanel.ts` | = | DI | I | F6 (+X2) | the Driftwood trader's panel (its only importer: loot/install.ts, Driftwood's shop) | 08 |
| `SpeedLines.ts` | 45 | `E:ui/SpeedLines.ts` | = | engine | F | F6 |  |  |
| `StartTitle.ts` | 33 | `E:ui/StartTitle.ts` | = | engine | F | F6 |  |  |
| `titleDeck.ts` | 210 | `G:titleDeck.ts` | = | game | GM | F6 → F9 | the title deck is #game (01 §20, R1-04), moved there at F6; F9 builds it from the registry and it reads each manifest's `card` URLs (R1-21) |  |
| `ToastStack.ts` | 108 | `E:ui/ToastStack.ts` | = | engine | F | F6 |  |  |
| `Update.ts` | 101 | `E:ui/Update.ts` | = | engine | F | F6 |  |  |
| `WeaponStrip.ts` | 254 | `E:ui/WeaponStrip.ts` | = | engine | F | F6 |  |  |
| `WindupWarn.ts` | 112 | `E:ui/WindupWarn.ts` | = | engine | F | F6 |  |  |

#### `src/ui/compendium/` — 8 files, 912 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `finds.ts` | 55 | `G:compendium/finds.ts` | = | game | GM | F6 | the compendium is #game, per shard (01 §20) |  |
| `install.ts` | 128 | `G:compendium/install.ts` | = | game | GM | F6 (+S2.1) | the compendium is #game, per shard (01 §20) |  |
| `Journal.ts` | 245 | `G:compendium/Journal.ts` | = | game | GM | F6 | the compendium is #game, per shard (01 §20) |  |
| `registry.ts` | 22 | `G:compendium/registry.ts` | = | game | GM | F6 | the compendium is #game, per shard (01 §20) |  |
| `shards/pine-hollow.ts` | 145 | `PH:compendium.ts` | = | PH | N | F6 (+S2.1) | Pine's compendium, ctx.rows.compendium at S2.1 (06 §1.3) |  |
| `state.ts` | 121 | `G:compendium/state.ts` | = | game | GM | F6 | the compendium is #game, per shard (01 §20) |  |
| `tracker.ts` | 86 | `G:compendium/tracker.ts` | = | game | GM | F6 | the compendium is #game, per shard (01 §20) |  |
| `types.ts` | 110 | `G:compendium/types.ts` | = | game | GM | F6 | the compendium is #game, per shard (01 §20) |  |

#### `src/ui/styles/` — 26 files, 2,716 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `base.css` | 72 | `E:ui/styles/base.css` | = | engine | F | F6 |  |  |
| `boss.css` | 98 | `E:ui/styles/boss.css` | = | engine | F | F6 |  |  |
| `combat.css` | 97 | `E:ui/styles/combat.css` | = | engine | F | F6 |  |  |
| `compendium.css` | 135 | `G:compendium/compendium.css` | = | game | GM | F6 | with compendium/install.ts |  |
| `complete.css` | 71 | `G:complete/complete.css` | = | game | GM | F6 | with ShardComplete.ts |  |
| `debug.css` | 22 | `E:ui/styles/debug.css` | = | engine | F | F6 |  |  |
| `elite.css` | 88 | `E:ui/styles/elite.css` | = | engine | F | F6 |  |  |
| `explore.css` | 433 | `E:ui/styles/explore.css` | = | engine | F | F6 |  |  |
| `feedback.css` | 63 | `E:ui/styles/feedback.css` | = | engine | F | F6 |  |  |
| `game.css` | 259 | `E:ui/styles/game.css` | = | engine | F | F6 |  |  |
| `gmenu.css` | 302 | `E:ui/styles/gmenu.css` | = | engine | F | F6 |  |  |
| `hints.css` | 26 | `E:ui/styles/hints.css` | = | engine | F | F6 |  |  |
| `loot.css` | 19 | `G:loot/loot.css` | = | game | GM | F6 | with CoinChip.ts |  |
| `menu.css` | 126 | `E:ui/styles/menu.css` | = | engine | F | F6 |  |  |
| `minimap.css` | 87 | `E:ui/styles/minimap.css` | = | engine | F | F6 |  |  |
| `pinehollow.css` | 82 | `PH:quest/pinehollow.css` | = | PH | I | F6 | imported by Pine's quest/ui.ts only |  |
| `playgrounds.css` | 18 | `E:ui/styles/playgrounds.css` | = | engine | F | F6 |  |  |
| `quest.css` | 78 | `E:ui/styles/quest.css` | = | engine | F | F6 |  |  |
| `reload.css` | 9 | `E:ui/styles/reload.css` | = | engine | F | F6 |  |  |
| `resume.css` | 59 | `E:ui/styles/resume.css` | = | engine | F | F6 |  |  |
| `ride.css` | 66 | `NG:ride/ride.css` | = | NG | I | F6 | with RideHUD / HorseNamePrompt | 07 |
| `rotate.css` | 55 | `E:ui/styles/rotate.css` | = | engine | F | F6 |  |  |
| `shop.css` | 79 | `DI:loot/shop.css` | = | DI | I | F6 | with ShopPanel.ts | 08 |
| `stealth.css` | 72 | `NG:stealth.css` | = | NG | I | F6 | imported by nalati/stealth.ts only (beside it) | 07 |
| `touch.css` | 289 | `E:ui/styles/touch.css` | = | engine | F | F6 |  |  |
| `update.css` | 11 | `E:ui/styles/update.css` | = | engine | F | F6 |  |  |

#### `src/world/` — 83 files, 22,699 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `Atmosphere.ts` | 292 | `E:world/Atmosphere.ts` | = | engine | SPLIT | F6 (+S2.1, S3.2, S4.3, X5) | shard branches leave (split table §3.13) |  |
| `BakedCards.ts` | 70 | `E:world/BakedCards.ts` | `PH:world/bakedCards.ts` | PH | I | F6 → S2.1 | the baked branch cards of Pine's TreeFactory (boot/manifest.ts → boot.files) |  |
| `BakedSky.ts` | 142 | `E:world/BakedSky.ts` | = | engine | F | F6 |  |  |
| `BakedTerrain.ts` | 140 | `E:world/BakedTerrain.ts` | = | engine | F | F6 |  |  |
| `BeaverPool.ts` | 196 | `PH:world/beaverPool.ts` | = | PH | I | F6 (+S2.1) | 06 §1.3 |  |
| `blenderArea.ts` | 57 | `E:world/blenderArea.ts` | = | engine | M | F6 (+S2.1, S4.1) | the baked-area mechanism; the per-slug table → manifest.world.blenderArea (06 §1.3) |  |
| `BlenderIsland.ts` | 618 | `DI:world/BlenderIsland.ts` | = | DI | G | F6 (+S4.1) | a Driftwood world builder (main.ts isOcean gate; 02 rule 3) | 08 |
| `Boat.ts` | 181 | `DI:world/Boat.ts` | = | DI | G | F6 (+S4.1) | a Driftwood world builder (main.ts isOcean gate; 02 rule 3) | 08 |
| `Boulders.ts` | 102 | `DI:world/Boulders.ts` | = | DI | G | F6 (+S4.1) | a Driftwood world builder (main.ts isOcean gate; 02 rule 3) | 08 |
| `Boundary.ts` | 224 | `E:world/Boundary.ts` | = | engine | F | F6 |  |  |
| `Bushes.ts` | 82 | `DI:world/Bushes.ts` | = | DI | G | F6 (+S4.1) | a Driftwood world builder (main.ts isOcean gate; 02 rule 3) | 08 |
| `Cabin.ts` | 642 | `E:world/Cabin.ts` | `PH:world/homestead.ts` | PH | SPLIT | F6 → S2.1 | Interactable type → src/engine/world/interact/types.ts; Cabins → Pine (06 §1.3) (split table §3.13) |  |
| `cascadeCull.ts` | 122 | `E:world/cascadeCull.ts` | = | engine | F | F6 |  |  |
| `Cove.ts` | 481 | `DI:world/Cove.ts` | = | DI | G | F6 (+S4.1) | a Driftwood world builder (main.ts isOcean gate; 02 rule 3) | 08 |
| `coverTint.ts` | 165 | `DI:world/coverTint.ts` | = | DI | G | F6 | Driftwood's ground-cover tint (main, BlenderIsland, GroundCover) | 08 |
| `DayClock.ts` | 533 | `E:world/DayClock.ts` | `NG:look/dayClock.ts` | NG | SPLIT | F6 → S2.4 / S3.2 | clock → engine DayCycle (S2.4); elevation keys + application → Nalati (S3.2) (06 §6.4) (split table §3.13) | 07 |
| `DayNight.ts` | 242 | `E:world/DayNight.ts` | `DI:look/dayNight.ts` | DI | SPLIT | F6 → S2.4 / S4.3 | clock → engine DayCycle (S2.4); keyframes + application stay → Driftwood (S4.3) (06 §6.4) (split table §3.13) | 08 |
| `driftwood.ts` | 83 | `DI:world/driftLogs.ts` | = | DI | N | F6 | the drift-log painter (02 rule 4); renamed inside its own shard | 08 |
| `faceHeads.ts` | 60 | `E:world/faceHeads.ts` | `DI:npc/faceHeads.ts` | DI | I | F6 → S4.2 | heads for Castaway + the sailor (both Driftwood; the sailor moves at S4.2) | 08 |
| `Forest.ts` | 351 | `E:world/forest/Forest.ts` | = | engine | SPEC | F6 | any forest (06 §1.3) |  |
| `fx.ts` | 6 | `E:world/fx.ts` | = | engine | F | F6 |  |  |
| `Grass.ts` | 614 | `E:world/Grass.ts` | `PH:world/grass.ts` | PH | SPLIT | F6 → S3.1 | the carpet is Pine's after S3.1 takes Nalati's GrassV2 dispatch out (06 §1.3 names S2.1 and S3.1: Q4) (split table §3.13) |  |
| `GrassField.ts` | 201 | `K:looks/grassField.ts` | = | kit | K | F6 | the trample (kit) reads its grassBaseHeightAt: it follows the trample | 07 |
| `GrassTrample.ts` | 239 | `K:looks/trample.ts` | = | kit | K | F6 | Pine + Nalati (01 §21; 06 §1.3) |  |
| `GroundCover.ts` | 830 | `DI:world/GroundCover.ts` | = | DI | G | F6 (+S4.1) | a Driftwood world builder (main.ts isOcean gate; 02 rule 3) | 08 |
| `Gulls.ts` | 603 | `DI:world/Gulls.ts` | = | DI | G | F6 (+S4.1) | Driftwood gulls (main.ts gate + its models) | 08 |
| `Heightfield.ts` | 66 | `E:world/Heightfield.ts` | = | engine | F | F6 |  |  |
| `Horizon.ts` | 319 | `E:world/Horizon.ts` | = | engine | F | F6 |  |  |
| `HorizonMatte.ts` | 376 | `E:world/HorizonMatte.ts` | = | engine | M | F6 (+S2.1, S4.1, X5) | the painted-band mechanism; the Pine and Driftwood strips → manifest.horizon.matte (06 §1.3) |  |
| `Hut.ts` | 79 | `DI:world/Hut.ts` | = | DI | G | F6 (+S4.1) | a Driftwood world builder (main.ts isOcean gate; 02 rule 3) | 08 |
| `lookFlags.ts` | 22 | `E:world/lookFlags.ts` | `PH:look/lookFlags.ts` | PH | SPLIT | F6 → S2.1 | Pine's look-loop grade (`ChunkDef.look`, set by Pine only) → Pine's LookStrategy (02 F6 table row 28) (split table §3.13) |  |
| `Lookout.ts` | 83 | `DI:world/Lookout.ts` | = | DI | G | F6 (+S4.1) | a Driftwood world builder (main.ts isOcean gate; 02 rule 3) | 08 |
| `lowpolyKit.ts` | 557 | `E:world/lowpolyKit.ts` | = | engine | F | F6 |  |  |
| `lut.ts` | 47 | `E:world/lut.ts` | = | engine | F | F6 |  |  |
| `nalatiTextures.ts` | 132 | `NG:look/nalatiTextures.ts` | = | NG | N | F6 (+S3.2) | 02 rule 4; boot/manifest.ts and Terrain.ts lose their imports at S3.2 | 07 |
| `Ocean.ts` | 282 | `DI:world/Ocean.ts` | = | DI | G | F6 (+S4.1) | a Driftwood world builder (main.ts isOcean gate; 02 rule 3) | 08 |
| `painterly.ts` | 325 | `E:world/painterly.ts` | `NG:look/painterly.ts` | NG | X-WEAPON | F6 → S3.2 | Nalati's painterly material; the Bow / Spear / Reins / Terrain / DayClock imports go at S2.2 / S3.2 first | 07 |
| `PainterlySky.ts` | 273 | `E:world/PainterlySky.ts` | `NG:look/PainterlySky.ts` | NG | SPLIT | F6 → S3.2 | Nalati's clouds; Sky.ts builds it (X5 deletes the hidden builds) (split table §3.13) | 07 |
| `Palms.ts` | 105 | `DI:world/Palms.ts` | = | DI | G | F6 (+S4.1) | a Driftwood world builder (main.ts isOcean gate; 02 rule 3) | 08 |
| `Particles.ts` | 423 | `K:looks/particles.ts` | = | kit | K | F6 | Pine + Nalati (06 §1.3) |  |
| `Pier.ts` | 145 | `DI:world/Pier.ts` | = | DI | G | F6 (+S4.1) | a Driftwood world builder (main.ts isOcean gate; 02 rule 3) | 08 |
| `PineCrags.ts` | 1019 | `PH:world/crags.ts` | = | PH | N | F6 (+S2.1) | 06 §1.3 |  |
| `PineDayNight.ts` | 609 | `PH:look/PineDayNight.ts` | `PH:look/skyBackdrop.ts` | PH | SPLIT | F6 → S2.4 | clock → src/engine/world/dayCycle.ts; presets → look/dayKeys.ts; the dome / IBL → look/skyBackdrop.ts (06 §1.3) (split table §3.13) |  |
| `pineHero.ts` | 18 | `PH:world/heroFiles.ts` | = | PH | N | F6 (+S2.1) | 06 §1.3 |  |
| `PineLandmarks.ts` | 422 | `PH:world/landmarks.ts` | = | PH | N | F6 (+S2.1) | 06 §1.3 |  |
| `pineSkyKeys.ts` | 39 | `PH:look/skyKeys.ts` | = | PH | N | F6 (+S2.4) | 06 §1.3 |  |
| `PineStreams.ts` | 278 | `PH:world/streams.ts` | = | PH | G | F6 (+S2.1, X5) | 06 §1.3 |  |
| `PineWeather.ts` | 153 | `PH:world/PineWeather.ts` | `PH:world/weatherProfile.ts` | PH | SPLIT | F6 → S2.4 | state machine → src/engine/world/weather.ts; the numbers → weatherProfile.ts (06 §1.3) (split table §3.13) |  |
| `PineWeatherFX.ts` | 527 | `PH:world/PineWeatherFX.ts` | `PH:world/weatherFx.ts` | PH | SPLIT | F6 → S2.4 | buildRain → src/kit/weather/rainCurtain.ts; cover / puddles / lens drops stay (06 §1.3) (split table §3.13) |  |
| `placement.ts` | 323 | `E:world/forest/placement.ts` | = | engine | SPEC | F6 | 06 §1.3 |  |
| `pointLightSkip.ts` | 31 | `E:world/pointLightSkip.ts` | `E:render/pointLightSkip.ts` | engine | M | F6 → S2.1 | tier knob pointLightSkip (06 §1.3) |  |
| `registry.ts` | 265 | `E:world/registry.ts` | = | engine | F | F6 |  |  |
| `rockKit.ts` | 352 | `E:world/rockKit.ts` | = | engine | F | F6 |  |  |
| `RopeBridge.ts` | 74 | `DI:world/RopeBridge.ts` | = | DI | G | F6 (+S4.1) | a Driftwood world builder (main.ts isOcean gate; 02 rule 3) | 08 |
| `Seabed.ts` | 176 | `DI:world/Seabed.ts` | = | DI | G | F6 (+S4.1) | a Driftwood world builder (main.ts isOcean gate; 02 rule 3) | 08 |
| `shadowChunks.ts` | 138 | `E:world/shadowChunks.ts` | = | engine | F | F6 |  |  |
| `shadowFade.ts` | 167 | `E:world/shadowFade.ts` | = | engine | F | F6 |  |  |
| `shadowFilter.ts` | 73 | `E:world/shadowFilter.ts` | = | engine | F | F6 |  |  |
| `shadowVariants.ts` | 89 | `E:world/shadowVariants.ts` | = | engine | F | F6 |  |  |
| `Shrine.ts` | 148 | `DI:world/Shrine.ts` | = | DI | G | F6 (+S4.1) | a Driftwood world builder (main.ts isOcean gate; 02 rule 3) | 08 |
| `Sky.ts` | 899 | `E:world/Sky.ts` | = | engine | SPLIT | F6 (+S2.1, S3.2, S4.3, X5) | shard branches leave (split table §3.3) |  |
| `Spruce.ts` | 266 | `NG:world/Spruce.ts` | = | NG | G | F6 (+S3.1) | trees.factory 'spruce' is Nalati's (core/bootstrap.ts TREE_FACTORIES) | 07 |
| `spruceMask.ts` | 79 | `NG:world/spruceMask.ts` | = | NG | N | F6 | Nalati's ChunkForest.mask (node-safe; bake-chunk runs it) | 07 |
| `steppeWind.ts` | 157 | `E:world/steppeWind.ts` | ✗ (merged into `E:world/wind.ts`, S3.2) | engine | MERGE | F6 → S3.2 | one `WindField` (01 §17, R1-04); Nalati's steppe numbers become `manifest.wind` |  |
| `stylize.ts` | 216 | `E:world/stylize.ts` | `DI:look/stylize.ts` | DI | SPLIT | F6 → S4.3 | Driftwood's toon lighting patch (a shader-patch registry entry, X6) (split table §3.13) | 08 |
| `StylizedSky.ts` | 188 | `E:world/StylizedSky.ts` | `DI:look/StylizedSky.ts` | DI | SPLIT | F6 → S4.3 | Driftwood's sky (Sky.ts builds it when style === 'lowpoly'): the toon look as a LookStrategy backdrop (S4.3 / X5) (split table §3.13) | 08 |
| `Terrain.ts` | 713 | `E:world/Terrain.ts` | = | engine | SPLIT | F6 (+S2.1, S3.2, S4.3, X5) | shard branches leave (split table §3.7) |  |
| `Trailside.ts` | 333 | `DI:world/Trailside.ts` | = | DI | G | F6 (+S4.1) | a Driftwood world builder (main.ts isOcean gate; 02 rule 3) | 08 |
| `TreeFactory.ts` | 768 | `E:world/TreeFactory.ts` | `PH:world/treeFactory.ts` | PH | SPLIT | F6 → S2.1 | trees.factory 'pine' is Pine's; windUniforms (read by Nalati) → engine/world/wind.ts; buildEmpty goes with 'none' (06 §1.3) (split table §3.13) |  |
| `treeSet.ts` | 185 | `E:world/forest/treeSet.ts` | = | engine | SPEC | F6 | 06 §1.3 |  |
| `treeSpecies.ts` | 29 | `E:world/forest/treeSpecies.ts` | = | engine | SPEC | F6 | 06 §1.3 |  |
| `TrophyWall.ts` | 315 | `PH:world/trophyWall.ts` | = | PH | G | F6 (+S2.1) | built for Pine's compendium only (06 §1.3) |  |
| `Undergrowth.ts` | 539 | `PH:world/undergrowth.ts` | = | PH | G | F6 (+S2.1) | only Pine draws the undergrowth (06 §1.3) |  |
| `Water.ts` | 179 | `PH:world/pond.ts` | = | PH | G | F6 (+S2.1) | Pine's still pond + lily pads (PH-L9; main.ts gate + BeaverPool) |  |
| `Waterfall.ts` | 334 | `DI:world/Waterfall.ts` | = | DI | I | F6 | Driftwood's toon cascade (its only importer: Cove.ts) | 08 |
| `waterSurface.ts` | 353 | `E:world/waterSurface.ts` | = | engine | F | F6 |  |  |
| `waves.ts` | 90 | `E:world/waves.ts` | = | engine | F | F6 |  |  |
| `Weather.ts` | 349 | `NG:world/Weather.ts` | = | NG | I | F6 (+S2.4) | Nalati's storm: `SteppeStorm extends Weather` at S2.4 (06 §6.4; 02 rule 2) | 07 |
| `WeatherFX.ts` | 678 | `NG:world/WeatherFX.ts` | = | NG | I | F6 (+S2.4) | Nalati's weather FX; buildRain → #kit/weather/rainCurtain.ts at S2.4 | 07 |
| `wind.ts` | 137 | `E:world/wind.ts` | = | engine | F | F6 |  |  |
| `WorldClock.ts` | 103 | `E:world/WorldClock.ts` | ✗ | ✗ | F | F6 → S2.4 | deleted: readers use app.world.dayCycle (06 §6.4) |  |
| `Wreck.ts` | 235 | `DI:world/Wreck.ts` | = | DI | G | F6 (+S4.1) | a Driftwood world builder (main.ts isOcean gate; 02 rule 3) | 08 |
| `Zipline.ts` | 143 | `DI:world/Zipline.ts` | = | DI | I | F6 | Driftwood's zipline (its only importer: quest/Adventure.ts) | 08 |

#### `src/world/interact/` — 6 files, 1,416 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `driftwood.ts` | 84 | `DI:quest/interactables.ts` | = | DI | N | F6 (+S4.3) | Driftwood's interactables table (02 rule 4) | 08 |
| `flags.ts` | 76 | `E:world/interact/flags.ts` | = | engine | F | F6 |  |  |
| `Interactables.ts` | 753 | `E:world/interact/Interactables.ts` | = | engine | F | F6 |  |  |
| `models.ts` | 290 | `E:world/interact/models.ts` | `K:interact/models.ts` | kit | K | F6 → S4.3 | the interactables kit's low-poly parts (Driftwood + Pine's token shelf) | 08 |
| `types.ts` | 146 | `E:world/interact/types.ts` | = | engine | F | F6 |  |  |
| `validate.ts` | 67 | `E:world/interact/validate.ts` | = | engine | F | F6 |  |  |

#### `src/world/nalati/` — 31 files, 5,762 lines

| Today | Lines | After F6 | Final | Layer | Rule | Row | Why | Confirm |
|---|---|---|---|---|---|---|---|---|
| `Balbals.ts` | 100 | `NG:world/Balbals.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `Bowl.ts` | 328 | `NG:world/Bowl.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `Bridge.ts` | 23 | `NG:world/Bridge.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `Cairn.ts` | 25 | `NG:world/Cairn.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `clearings.ts` | 44 | `NG:world/clearings.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `Crags.ts` | 65 | `NG:world/Crags.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `dressing/index.ts` | 263 | `NG:world/dressing/index.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `dressing/layer.ts` | 138 | `NG:world/dressing/layer.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `dressing/life.ts` | 267 | `NG:world/dressing/life.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `dressing/place.ts` | 736 | `NG:world/dressing/place.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `dressing/statics.ts` | 139 | `NG:world/dressing/statics.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `EagleRock.ts` | 22 | `NG:world/EagleRock.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `Flutter.ts` | 176 | `NG:world/Flutter.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `glbPaint.ts` | 401 | `NG:world/glbPaint.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `granite.ts` | 24 | `NG:world/granite.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `index.ts` | 146 | `NG:world/index.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `KurganDungeon.ts` | 970 | `NG:world/KurganDungeon.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `KurganField.ts` | 86 | `NG:world/KurganField.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `layout.ts` | 65 | `NG:world/layout.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `NomadCamp.ts` | 165 | `NG:world/NomadCamp.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `paint.ts` | 504 | `NG:world/paint.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `painted.ts` | 312 | `NG:world/painted.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `places.ts` | 106 | `NG:world/places.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `props.ts` | 73 | `NG:world/props.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `RoadFurniture.ts` | 75 | `NG:world/RoadFurniture.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `Smoke.ts` | 119 | `NG:world/Smoke.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `solid.ts` | 119 | `NG:world/solid.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `Stair.ts` | 73 | `NG:world/Stair.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `SummerCamp.ts` | 71 | `NG:world/SummerCamp.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `types.ts` | 49 | `NG:world/types.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |
| `Yard.ts` | 78 | `NG:world/Yard.ts` | = | NG | I | F6 | Nalati world (02 rule 2; the extra nalati/ level dropped) | 07 |

## 3. Files that are split

33 files are marked `SPLIT`. With `chunks/pine-hollow.ts` and `nine-dragon-stack/def.ts` (territory files split in
their own shard), `player/Weapons.ts` (replaced at S1.2) and the seven `boot/*` files that lose their branches, the
tables below cover 43 files. Each sub-table says which part goes where and in which row. Parts are named by a **grep
key** (a quoted fragment still unique after F6), as in 05 §0. The per-line Nine Dragon and Pine Hollow detail of
`main.ts`, `Game.ts`, `boot/*` and `Sky.ts` is in 05 §2 and 06 §2; the tables below cover every shard and point there.
A part that "stays" stays in the file at its F6 path.

### 3.1 `main.ts` (1,336 lines) → `E:main.ts` at F6 → `E:boot.ts` ≤ 150 lines at S4.4 (EI7)

| Part (grep key) | What it is | Goes to | Row |
|---|---|---|---|
| the ~60 imports of shard code (`from './chunks/…'`, `'./nalati/…'`, `'./pinehollow/…'`, the Driftwood world builders) | wiring | deleted as each plugin takes its wiring | S1.1, S2.1, S3.1, S4.1 |
| `const extrasBarrier`, `const deferExtras`, `const fragileBoot`, `markNineBootContextLost` | Nine Dragon boot fragility | `manifest.boot.phone.*` + the engine boot guard | S1.1 (05 §2.1) |
| `if (getActiveChunk().slug === 'pine-hollow') void preloadLeverModel()` | Pine preload | the lever row's `preload` | S2.2 |
| `const sea = chunk.ocean, isOcean`, `const painterly = chunk.style === 'painterly'` | the two big gates | deleted with their last user | S4.4 |
| `step('edge', …)`: `new Water`, `new PineStreams`, `new Ocean`, the 16 Driftwood builders (`Boulders`, `Hut`, `Lookout`, `Wreck`, `Shrine`, `Bushes`, `Trailside`, `RopeBridge`, `Seabed`, `Palms`, `Cove`, …) | the edge step | Pine's world build (S2.1), Driftwood's world build (S4.1); the boundary stays engine | S2.1, S4.1 |
| `addPaths()`, `const blenderIsland = isOcean` | paths, the Blender cove | the shards' world builds | S3.1, S4.1 |
| `step('grass', …)`: `const bare = isOcean \|\| built`, `new Undergrowth` | Pine's carpet | Pine's plugin | S2.1 (Grass.ts itself: S3.1) |
| `step('cabins', …)`: `new Cabins`, `pineHamletBuildings`, `installPineLandmarks` | the homestead | Pine's plugin | S2.1 |
| `step('props', …)`: `wireNalati`, the `structures` branch, Pine's `Props` | the props step | each plugin's `level.world` stage | S1.1, S2.1, S3.1 |
| `step('animals', …)`, `nalatiNow()?.attachAnimals`, `nalatiNow()?.ride`, `new Enemies(` | creatures | `CreatureService` + `level.spawns` / `level.spawnTables` (the `LevelSpec`, R2-02) | S2.3, S3.4, S4.2 |
| `const nalatiClock`, the WorldClock wiring | the clocks | `app.world.dayCycle` | S2.4 |
| `step('weapon', …)`, `buildNalatiKit`, `const isPine`, `new Longbow`, `const isNine`, `new Weapons(` | the loadout | `EquipmentService` from `level.loadout` (built in `level.kit`, R2-02 / R2-05) | S1.2, S2.2, S3.3, S4.1 |
| `await chunk.traversal?.(` | the Fei Zhua | the Tool row | S1.4 |
| `const mood = chunk.ocean ? 'island'` | the score's mood | `manifest.audio.score` | S1.5 |
| `if (chunk.bounds !== undefined)` | soft respawn | the engine system `engine.world.bounds` | S1.1 |
| the menu options (`kit:`, `skins:`, `tools:`, `pack:`, `...(isPine`) | Bag data | registered Bag tabs and fragments | X2 (each shard's part in S1.4, S2.1, S3.1, S4.3) |
| `weapons.onFire =`, `onImpact`, `audio.swordSwing`, `nalatiNow()?.sound?.fire` | weapon sounds | cue maps | S1.5, S2.2, S3.5 |
| `new WeaponPickup({ scene: game.scene, item: rifle.displayModel()` | Pine's cabin rifle | Pine's loadout pickups | S2.2 |
| `installAdventure`, `installKeepsakes`, `installLoot`, `installFirstMinutes` | Driftwood's adventure | Driftwood's plugin | S4.3 |
| `installNalatiAdventure`, `nalatiNow()?.bindPlay`, `.boss.bind`, `.elites.bind`, `.titan.bind`, `.weather.bind` | Nalati's wiring | Nalati's plugin verbs and events | S3.1, S3.4 |
| `installPineCombat`, `installPineQuest`, `installPineWeather`, `installPineLife`, `placePineHollowSets`, `pineFinish` | Pine's wiring | Pine's plugin | S2.1–S2.5 (06 §2.1) |
| `const ambience = sea ? new IslandAmbience` | ambience | `manifest.audio.ambience` → `AmbienceBeds` | S2.1, S3.5, S4.3 |
| the 5 hurt blocks (`health = Math.max(0, health -`), regen, the death check | player health | the damage pipeline | S1.3 |
| `setAimTargets(painterly ? aimList`, the `'main'` updater's shard lines | per-frame work | shard systems | S3.1 and each shard row |
| `step('shaders'`, `step('firstFrame'`, `step('audio'` | the boot's end | the `#engine/boot` stages | X3 |
| `const handle = { ...world` (`window.__world`) | the probe | `window.__wildshard` + each plugin's probe keys | F7 (the alias), each shard row |
| `SHARD_CAP`, the host's `park` / `activate` / `dispose` | the resident host | deleted | F11 |
| what is left: the engine boot sequence | — | `E:boot.ts` | S4.4 |

### 3.2 `core/Game.ts` (748) → `E:core/Game.ts`, de-branched in place

| Part (grep key) | Goes to | Row |
|---|---|---|
| `import { installLookV2Fog }`, `buildLookV2Chain`, `installAtmosphere(getActiveChunk().style === 'painterly')`, `this._composer = buildLookV2Chain` | Nalati's `LookStrategy` (fog + composer) | S3.2 |
| `recordNineGpuCheckpoint`, `const phoneNine` (4 sites), `traceNineBootPasses` | `bootTrace.active` | S1.1 (05 §2.2) |
| `getActiveChunk().slug !== 'nine-dragon-stack' \|\| TIER !== 'phone'` (the AO) | `manifest.tiers.phone.ao` | S1.1 |
| `const slices = R?.slices ?? phonePictureCuts()` | tier data | S2.1 / X7 |
| `const dwPhone = getActiveChunk().style === 'lowpoly'`, `getActiveChunk().style !== 'lowpoly'` (the LUT), `chain(getActiveChunk().style === 'lowpoly')` | Driftwood's `LookStrategy` + tier data | S4.3 |
| `this.sky.attachPost({ vol, rays: godRays, hueSat: grade })` | Pine's backdrop | S2.4 |
| the loop, phases, fault isolation, composer build | stays; F8 makes the phases App systems | F8 |

### 3.3 `world/Sky.ts` (899) → `E:world/Sky.ts`

| Part (grep key) | Goes to | Row |
|---|---|---|
| `setupPine`, `pine: PineDayNight`, `attachPost`, `get lamps`, `pineSunAt` | Pine's backdrop + the engine `DayCycle` | S2.4 (06 §6.4 C) |
| `if (getActiveChunk().slug === 'pine-hollow') patchPointLightSkip()` | the tier knob `pointLightSkip` | S2.1 |
| `toon = style === 'lowpoly'`, `setupStylized`, `StylizedSky`, the `DayNight` build | Driftwood's backdrop | S4.3 |
| `const painted = S.painted`, `buildClouds`, `PainterlySky`, `patchCloudShadows` | Nalati's and Nine Dragon's backdrops; X5 deletes the hidden cloud dome | S3.2, X5 |
| `import { wind } from './steppeWind'` | the engine wind service | X5 |
| `setupHDRI`, `loadLUT(getActiveChunk().slug)`, the baked sky by slug | the engine `SkyRig` (files named by the manifest) | X5 |

### 3.4 `audio/Audio.ts` (1,597) → `E:audio/Audio.ts`

| Part (grep key) | Goes to | Row |
|---|---|---|
| the `SfxName` union's shard names (`'crab_click'` … Driftwood; `'dog_bark'`, `'eagle_cry'`, `'king_call'` … Nalati) | cue names in each shard's cue map | S1.5 (the mechanism), S3.5 (Nalati), S4.3 (Driftwood) |
| `export type AmbientBed`, `this.bed = def.ocean ? 'island'`, the synth beds in `startBed` | `AmbienceBeds` profiles (`manifest.audio.ambience`) | S1.5 (ND), S2.1 (Pine), S3.5 (Nalati), S4.3 (Driftwood) |
| `SteppeLevels`, `sampledSteppe`, `private steppe:`, `HoofSurface`, `NalatiShot`, `SteppeLoop` | `NG:audio/` | S3.5 |
| `crossbowFire`, `boltImpact`, `reload`, `dryFire`, `swordSwing`, `swordHit` | the families' cues + the shards' cue maps | S1.5, S2.2 |
| the mixer, buses, voices, listener, the underwater low-pass, the sampled one-shot bank | stays (`#engine/audio`) | — |

### 3.5 `audio/Music.ts` (933) → `E:audio/Music.ts`

| Part (grep key) | Goes to | Row |
|---|---|---|
| `export type Shard = 'pine' \| 'island' \| 'steppe'`, `shardSlot`, `shard: getActiveChunk().ocean ? 'island' : 'pine'` | a `ScoreSource` per manifest (`audio.score`) | S1.5 |
| `PineScene`, `setPineScene`, `prefetchPine`, `setting('pineScore')` | Pine's `ScoreSource` | S1.5 (mechanism), S2.1 |
| `readonly steppe: SteppeScore`, `setSteppe` | Nalati's `ScoreSource` (`NG:audio/SteppeScore.ts`) | S3.5 |
| the `wildshard-theme` synth score | `#game`'s score source (`G:audio/wildshard-theme.ts`) | S1.5 |
| the deck and stems player, the bar grid, stings, volume | stays | — |

### 3.6 `core/tier.ts` (190) → `E:core/tier.ts` → `E:render/tiers.ts` (X7)

| Part (grep key) | Goes to | Row |
|---|---|---|
| `TIER_TABLE`'s engine knobs (~52) | `E:render/tiers.ts` | X7 |
| the 7 Driftwood knobs (`oceanCell`, `palmCount`, `palmFrondSegs`, `bushCount`, `bushDetail`, `bushShadows`, `boulderShadows`) | Driftwood's `manifest.tiers` | X7 (S4.1 may pull it) |
| `PINE_HOLLOW_PHONE`, `applyShardTier`, `pinePhoneCuts` | Pine's `manifest.tiers.phone` | S2.1 |
| `phonePictureCuts` (Pine + Driftwood) | each manifest's tier data | S2.1, S4.1 |
| device detection, `TIER`, `TIER_CONFIG` | `app.tiers` | X7 |

### 3.7 `world/Terrain.ts` (713) → `E:world/Terrain.ts`

| Part (grep key) | Goes to | Row |
|---|---|---|
| `if (getActiveChunk().structures !== undefined) return this.buildNone()` | `manifest.ground.structures` | S1.1 |
| `buildLowPoly` (`style === 'lowpoly'`) | Driftwood's `LookStrategy.terrainPainter` | S4.3 |
| `buildPainterly`, `applyTerrainSurface`, `zoneWeights`, `loadNalatiTextures`, `painterlyMaterial` | Nalati's `LookStrategy.terrainPainter` (02 F6 table rows 34–35) | S3.2 |
| `getActiveChunk().ocean?.level` | `terrain.waterLevel()` / `WaterBody` | S4.1 / X5 |
| the PBR terrain, the baked terrain, the heightfield mesh | stays | — |

### 3.8 `player/TouchControls.ts` (482) → `E:player/TouchControls.ts` (a HUD file: X1 announces over herdr, E332)

| Part (grep key) | Goes to | Row |
|---|---|---|
| `const MELEE`, `const SPEAR`, `weapons.current.id === 'bow'`, `wasBow`, `wasLockable` | each family's `touch` fragment (09 §1.6) | X1 (S1.2, S2.2 for their families) |
| `wasRiding` (the Nalati saddle) | the `ride` context from Nalati's plugin | S3.3 / X1 |
| the fake `KeyE` on USE | the `interact` action | X1 |
| the `touchHint` relabel | the `grapple` context | S1.4 |
| the discs, sticks and look drag | `#engine/input` touch | X1 |

### 3.9 `ui/hudSlots.ts` (103) → `E:ui/hudSlots.ts`

| Part (grep key) | Goes to | Row |
|---|---|---|
| `export const ROW = { vitals: 0, ammo: 1, steed: 2, stealth: 3, grass: 4, pill: 10 }` | numbered bands `band.1…band.6`; Nalati's `steed`, `stealth`, `grass` come from its manifest | X2 |
| the slot mechanism | stays | — |

### 3.10 `ui/Minimap.ts` (727) → `E:ui/Minimap.ts`

| Part (grep key) | Goes to | Row |
|---|---|---|
| `import * as NALATI_DEF`, `nalatiWetAt`, `function nalatiGround`, `if (getActiveChunk().style === 'painterly')` (the places), `const painted = chunk.style === 'painterly'` | Nalati's `manifest.map.palette` + places | S3.1 / X2 |
| `getActiveChunk().ocean ? OPEN_SEA : VOID`, `const ocean = chunk.ocean ?? null` | Driftwood's `manifest.map.palette` | S4.1 / X2 |
| the sea-chart diamonds (Driftwood, E314) | Driftwood's plugin widget | S4.3 |
| `import { Wildlife }` (herd marks) | Nalati's plugin | S3.4 |
| the canvas minimap | stays | — |

### 3.11 `entities/AnimalManager.ts` (1,462) → `E:entities/AnimalManager.ts` (the `CreatureService`)

| Part (grep key) | Goes to | Row |
|---|---|---|
| `private readonly melee = meleeShard(getActiveChunk())` | `canReach` on every shard (bug B4) | S2.3 |
| `private readonly rules = getActiveChunk().fightRules`, the E297 behaviours, `AttackTokens` | `combat.director` (`E:ai/director.ts`) | S2.3 |
| `private readonly trampling = getActiveChunk().slug === 'pine-hollow'` | a manifest flag the trample reads | S2.3 |
| `if (getActiveChunk().ocean) return false`, `wetAt` | `WaterBody` / the shard's wet map | S3.4 / X5 |
| the 10 Hz herd brain in `think` | the HFSM brains | S2.3 |
| the Nalati and Golden King voice names | cue maps | S3.5 |
| spawn, retire, raycast, hit volumes, ragdolls, animation LOD, far batching | stays | — |

### 3.12 `player/Weapons.ts` (323) → `E:player/Weapons.ts` → deleted at S1.2

| Part (grep key) | Goes to | Row |
|---|---|---|
| `export type WeaponId` | the rows' `weapon.<id>` names (09 §0) | S1.2 |
| slots, the swap ring, Q / 1–9, `private unlocked` | `EquipmentService` (`#engine/combat`) | S1.2 (the keys at X1) |
| the Nalati kit ids (`nalatiKit.ts`) | Nalati's `manifest.loadout` | S3.3 |

### 3.13 The other split files

| File | Parts → destinations | Row |
|---|---|---|
| `world/Atmosphere.ts` | `installAtmosphere(painterly)` + `installPaintedAir` → Nalati's `LookStrategy`; `const edge = getActiveChunk().slug === 'pine-hollow'` → Pine's look data; the fog core → engine, on the fog-patch registry | S3.2, S2.1, X5 |
| `ui/HUD.ts` | Driftwood's sturdy-hearts maximum → `#game` perks; `ws:weather` → the bus; the crossbow's bolt labels → ammo rows; the title card match stays | S1.2, S2.2, S4.3, X2 |
| `ui/Menu.ts` | the pause-menu shell (settings, debug, resume) stays engine; MAP · GEAR · FINDS · PACK · FEATS → registered `#game/bag` tabs; Pine's PACK trade lines, Nalati's skins, Nine Dragon's tools → their plugins | X2 |
| `ui/debugOptions.ts` | the 9 gated rows (`const pineHollow: When`, `const nalati: When`) → each plugin's `ctx.debugRow` | S2.1, S3.1, X2 |
| `game/Inventory.ts` | the pack stays `#game`; `PINE_PACK_*`, `isPineItem`, Pine's item rows → `PH:items.ts` + `manifest.bag.pack`; `isNoPackChunk` → `manifest.bag.pack.slots: 0`; harvest yields → loot tables | S1.1, S2.1, S2.3 |
| `game/achievements.ts` | the table type stays `#game`; `PINE_HOLLOW` → `PH:feats.ts`, Driftwood's table → `DI:feats.ts`, Nalati's → `NG:feats.ts` | S2.1, S3.1, S4.3 |
| `game/quest/Adventure.ts` | Driftwood's `installAdventure` → `DI:quest/Adventure.ts`; the `ADVENTURES` registry → deleted (plugins) | S4.3 |
| `audio/IslandSfx.ts` | footsteps + combat layers → `DI:audio/sfx.ts`; `interact()` sounds → `K:audio/interactSfx.ts` (Pine's quest uses them) | S3.5 |
| `player/Skins.ts` | `SkinLocker` → `G:cosmetics/skinLocker.ts`; `SKINS` → `PH:loadout/skins.ts` | S2.2, X5 |
| `player/riding.ts` | the ridden horse → `NG:ride/riding.ts`; the engine reads `ask('player.mount')` | S3.3 |
| `world/Cabin.ts` | `Interactable` → `E:world/interact/types.ts`; `Cabins` → `PH:world/homestead.ts` | S2.1 |
| `world/TreeFactory.ts` | the `pine` factory → `PH:world/treeFactory.ts`; `windUniforms` (Nalati reads it) → `E:world/wind.ts`; `buildEmpty` → deleted (no Forest when a manifest has none) | S2.1 |
| `world/Grass.ts` | Nalati's `GrassV2` dispatch → Nalati; the carpet → `PH:world/grass.ts` | S3.1 |
| `world/PineDayNight.ts` | the clock → `E:world/dayCycle.ts`; the presets → `PH:look/dayKeys.ts`; the dome and IBL → `PH:look/skyBackdrop.ts` | S2.4 |
| `world/PineWeather.ts` | the state machine → `E:world/weather.ts`; the numbers → `PH:world/weatherProfile.ts` | S2.4 |
| `world/PineWeatherFX.ts` | `buildRain` → `K:weather/rainCurtain.ts`; cover, puddles, lens drops → `PH:world/weatherFx.ts` | S2.4 |
| `world/DayNight.ts` | the clock → `E:world/dayCycle.ts`; the keys and their application → `DI:look/dayNight.ts` | S2.4, S4.3 |
| `world/DayClock.ts` | the clock → `E:world/dayCycle.ts`; the elevation keys and their application → `NG:look/dayClock.ts` | S2.4, S3.2 |
| `world/StylizedSky.ts`, `world/stylize.ts` | Driftwood's backdrop and toon patch (a shader-patch registry entry, X6) | S4.3 |
| `world/PainterlySky.ts` | Nalati's backdrop; the hidden builds deleted | S3.2, X5 |
| `world/lookFlags.ts` | Pine's look-loop grade (`ChunkDef.look`, set by Pine only) → Pine's `LookStrategy` | S2.1 |
| `chunks/pine-hollow.ts` | the data → `PH:manifest.ts`; `:23-216` → `PH:world/terrain.ts` | S2.1 |
| `chunks/nine-dragon-stack/def.ts` | the data → `ND:manifest.ts`; the hook fields → `ND:plugin.ts` | S1.1 |
| `boot/{manifest,extras,shardPrefetch,audioFiles,gpuFiles,steps,prefetch}.ts` | their shard branches → manifest `boot` data; the files stay engine | S1.1–S4.1, X3 |

## 4. Tests (`test/`, `api-tests/`: 117 files)

**The rule.** A test moves to `test/shards/<slug>/` when its **subject** (the module it tests) is that shard's code. A
test whose subject is engine, game or kit code stays in `test/` even when it uses a shard's data as a fixture, and Z1
points it at the template shard (02 F6 step 6). A test that imports two or more shards stays in `test/`. A test whose
subject moves in a later row moves in that row (to `test/engine/`, `test/kit/` or its shard). Tests of new engine
code are written under `test/engine/`, `test/combat/`, `test/ai/` (09 §1.8, §5.8).

**At F6:** 34 files move (Nine Dragon 3, Pine Hollow 15, Nalati 9, Driftwood 7); 83 stay, their imports rewritten.
Tests import through the aliases (`#engine/…`, `#game/…`, `#kit/…`, `#shards/<slug>/…`, deep paths allowed: tests
are outside the layers and the public-API rule).

| Today | Lines | After F6 | Final | Row | Why |
|---|---|---|---|---|---|
| `api-tests/errors.test.ts` | 94 | = | = | — | tests api/ (no src import): unchanged |
| `api-tests/inbox.test.ts` | 92 | = | = | — | tests api/ (no src import): unchanged |
| `test/animal-matrices.test.ts` | 87 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/audio-gen.test.ts` | 158 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/backdrop-prefix.test.ts` | 21 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/bag-tabs.test.ts` | 53 | `test/shards/nine-dragon-stack/bag-tabs.test.ts` | = | F6 | subject is Nine Dragon code (02 F6 step 6; 05 §1.2) |
| `test/boot-plan.test.ts` | 220 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/bow-draw.test.ts` | 101 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/chunks.test.ts` | 164 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/compendium.test.ts` | 204 | = | = | F6 | engine / #game subject (a shard file is only a fixture): stays; imports rewritten |
| `test/cosmetics.test.ts` | 81 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/debug-options.test.ts` | 33 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/diorama.test.ts` | 53 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/ecology.test.ts` | 48 | `test/shards/driftwood-isle/ecology.test.ts` | = | F6 | subject moves to Driftwood at F6 (04 §2 src/game/quest, src/game/loot) |
| `test/entry-rescue.test.ts` | 48 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/error-report.test.ts` | 110 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/explore-view-point.test.ts` | 114 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/explore.test.ts` | 61 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/facade-no-multidraw.test.ts` | 32 | = | = | F6 | engine / #game subject (a shard file is only a fixture): stays; imports rewritten |
| `test/faults.test.ts` | 117 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/fight-rules.test.ts` | 192 | = | = | F6 | engine / #game subject with Driftwood as fixture: stays; Z1 points it at the template (02 F6 step 6) |
| `test/guards.test.ts` | 27 | `test/shards/driftwood-isle/guards.test.ts` | = | F6 | subject moves to Driftwood at F6 (04 §2 src/game/quest, src/game/loot) |
| `test/gull-guide.test.ts` | 133 | `test/shards/driftwood-isle/gull-guide.test.ts` | = | F6 | subject moves to Driftwood at F6 (04 §2 src/game/quest, src/game/loot) |
| `test/hit-damage.test.ts` | 78 | = | = | F6 | engine / #game subject with Driftwood as fixture: stays; Z1 points it at the template (02 F6 step 6) |
| `test/horse-names.test.ts` | 37 | `test/shards/nalati-grasslands/horse-names.test.ts` | = | F6 | subject moves to Nalati at F6 (04 §2: rule 2 / rule 4) |
| `test/hurt.test.ts` | 28 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/interact-sight.test.ts` | 80 | = | = | F6 | engine / #game subject (a shard file is only a fixture): stays; imports rewritten |
| `test/interact.test.ts` | 144 | = | = | F6 | engine / #game subject (a shard file is only a fixture): stays; imports rewritten |
| `test/inventory.test.ts` | 179 | = | = | F6 | engine / #game subject (a shard file is only a fixture): stays; imports rewritten |
| `test/keepsakes.test.ts` | 39 | `test/shards/driftwood-isle/keepsakes.test.ts` | = | F6 | subject moves to Driftwood at F6 (04 §2 src/game/quest, src/game/loot) |
| `test/ktx2-auto.test.ts` | 156 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/last-end.test.ts` | 86 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/last-place.test.ts` | 113 | = | = | F6 | engine / #game subject (a shard file is only a fixture): stays; imports rewritten |
| `test/lockon.test.ts` | 71 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/loot.test.ts` | 187 | = | = | F6 | engine / #game subject with Driftwood as fixture: stays; Z1 points it at the template (02 F6 step 6) |
| `test/map-shapes.test.ts` | 40 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/melee-sweep.test.ts` | 89 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/models-check-rules.test.ts` | 60 | = | = | F6 | engine / #game subject (a shard file is only a fixture): stays; imports rewritten |
| `test/models-contract.test.ts` | 268 | `test/shards/driftwood-isle/models-contract.test.ts` | = | F6 | 02 F6 step 6 (TP audit §3) |
| `test/models-driftwood.test.ts` | 155 | `test/shards/driftwood-isle/models-driftwood.test.ts` | = | F6 | 02 F6 step 6 (TP audit §3) |
| `test/models-interact.test.ts` | 27 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/models-live.test.ts` | 110 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/models-pine-hollow.test.ts` | 311 | `test/shards/pine-hollow/models-pine-hollow.test.ts` | = | F6 | subject is Pine code (02 F6 step 6; 06 §1.3) |
| `test/models-places.test.ts` | 33 | = | = | F6 | spans 2+ shards: stays |
| `test/models-rosters.test.ts` | 42 | = | = | F6 | spans 2+ shards: stays |
| `test/models-weld.test.ts` | 111 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/nalati-bag.test.ts` | 136 | `test/shards/nalati-grasslands/nalati-bag.test.ts` | = | F6 | subject is Nalati code (02 F6 step 6) |
| `test/nalati-models.test.ts` | 300 | `test/shards/nalati-grasslands/nalati-models.test.ts` | = | F6 | subject is Nalati code (02 F6 step 6) |
| `test/nalati-navmesh.test.ts` | 87 | `test/shards/nalati-grasslands/nalati-navmesh.test.ts` | = | F6 | subject is Nalati code (02 F6 step 6) |
| `test/nalati-roster.test.ts` | 67 | `test/shards/nalati-grasslands/nalati-roster.test.ts` | = | F6 | subject is Nalati code (02 F6 step 6) |
| `test/native-updates.test.ts` | 400 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/nd-specimen-light.test.ts` | 31 | `test/shards/nine-dragon-stack/nd-specimen-light.test.ts` | = | F6 | subject is Nine Dragon code (02 F6 step 6; 05 §1.2) |
| `test/nine-boot-trace.test.ts` | 268 | = | `test/engine/boot-trace.test.ts` | F6 → S1.1 | rewritten as test/engine/boot-trace.test.ts for the generic names (05 §1.2) |
| `test/nine-dragon-models.test.ts` | 148 | `test/shards/nine-dragon-stack/nine-dragon-models.test.ts` | = | F6 | subject is Nine Dragon code (02 F6 step 6; 05 §1.2) |
| `test/nine-gpu-trace.test.ts` | 38 | = | `test/engine/gpu-trace.test.ts` | F6 → S1.1 | rewritten as test/engine/gpu-trace.test.ts (05 §1.2) |
| `test/perf-lap.test.ts` | 53 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/physics-barrel.test.ts` | 247 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/physics-bodies.test.ts` | 166 | = | = | F6 | engine / #game subject (a shard file is only a fixture): stays; imports rewritten |
| `test/physics-dash-stall.test.ts` | 37 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/physics-drop.test.ts` | 85 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/physics-hitbox-owners.test.ts` | 58 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/physics-motor.test.ts` | 151 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/physics-navmesh.test.ts` | 152 | = | = | F6 | engine / #game subject (a shard file is only a fixture): stays; imports rewritten |
| `test/physics-pieces.test.ts` | 71 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/physics-ragdoll.test.ts` | 207 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/physics-ranged.test.ts` | 73 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/physics-ropechain.test.ts` | 86 | = | = | F6 | engine / #game subject (a shard file is only a fixture): stays; imports rewritten |
| `test/physics-terrain.test.ts` | 69 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/pine-audio-wiring.test.ts` | 54 | `test/shards/pine-hollow/pine-audio-wiring.test.ts` | = | F6 | subject is Pine code (02 F6 step 6; 06 §1.3) |
| `test/pine-bag.test.ts` | 148 | `test/shards/pine-hollow/pine-bag.test.ts` | = | F6 | subject is Pine code (02 F6 step 6; 06 §1.3) |
| `test/pine-beaver-pool.test.ts` | 86 | `test/shards/pine-hollow/pine-beaver-pool.test.ts` | = | F6 | subject is Pine code (02 F6 step 6; 06 §1.3) |
| `test/pine-combat.test.ts` | 96 | `test/shards/pine-hollow/pine-combat.test.ts` | = | F6 | subject is Pine code (02 F6 step 6; 06 §1.3) |
| `test/pine-crags.test.ts` | 138 | `test/shards/pine-hollow/pine-crags.test.ts` | = | F6 | subject is Pine code (02 F6 step 6; 06 §1.3) |
| `test/pine-day-night.test.ts` | 57 | `test/shards/pine-hollow/pine-day-night.test.ts` | `test/engine/day-cycle.test.ts` | F6 → S2.4 | Pine at F6; becomes test/engine/day-cycle.test.ts with Pine as one fixture (06 §1.3) |
| `test/pine-hollow-roster.test.ts` | 69 | `test/shards/pine-hollow/pine-hollow-roster.test.ts` | = | F6 | subject is Pine code (02 F6 step 6; 06 §1.3) |
| `test/pine-life.test.ts` | 49 | `test/shards/pine-hollow/pine-life.test.ts` | = | F6 | subject is Pine code (02 F6 step 6; 06 §1.3) |
| `test/pine-loadout.test.ts` | 94 | `test/shards/pine-hollow/pine-loadout.test.ts` | = | F6 | subject is Pine code (02 F6 step 6; 06 §1.3) |
| `test/pine-npc-rig.test.ts` | 185 | `test/shards/pine-hollow/pine-npc-rig.test.ts` | `test/kit/npc-rig.test.ts` | F6 → S2.5 | Pine at F6; its subject npcRig.ts moves to #kit/npc at S2.5 → test/kit/npc-rig.test.ts |
| `test/pine-quest.test.ts` | 210 | `test/shards/pine-hollow/pine-quest.test.ts` | = | F6 | subject is Pine code (02 F6 step 6; 06 §1.3) |
| `test/pine-sfx-sprite.test.ts` | 63 | `test/shards/pine-hollow/pine-sfx-sprite.test.ts` | = | F6 | subject is Pine code (02 F6 step 6; 06 §1.3) |
| `test/pine-weather.test.ts` | 76 | `test/shards/pine-hollow/pine-weather.test.ts` | `test/engine/weather.test.ts` | F6 → S2.4 | Pine at F6; becomes test/engine/weather.test.ts with Pine as one fixture (06 §1.3) |
| `test/playgrounds.test.ts` | 174 | = | = | F6 | spans 2+ shards: stays |
| `test/practice-dummy-clips.test.ts` | 77 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/practice-dummy-motion.test.ts` | 99 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/practice-dummy-physics.test.ts` | 38 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/practice-lineup.test.ts` | 21 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/precompile-batching.test.ts` | 38 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/progress.test.ts` | 162 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/quest-nalati.test.ts` | 132 | `test/shards/nalati-grasslands/quest-nalati.test.ts` | = | F6 | subject is Nalati code (02 F6 step 6) |
| `test/quest.test.ts` | 125 | = | = | F6 | engine / #game subject (a shard file is only a fixture): stays; imports rewritten |
| `test/registry-models.test.ts` | 34 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/resume.test.ts` | 23 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/review.test.ts` | 111 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/ride-assist.test.ts` | 67 | `test/shards/nalati-grasslands/ride-assist.test.ts` | = | F6 | subject moves to Nalati at F6 (04 §2: rule 2 / rule 4) |
| `test/rng-noise.test.ts` | 125 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/room-map.test.ts` | 46 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/select-pick.test.ts` | 135 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/sets-explorer.test.ts` | 127 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/settings.test.ts` | 221 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/setup.ts` | 22 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/shadow-variants.test.ts` | 15 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/shard-prefetch.test.ts` | 100 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/shard-state.test.ts` | 74 | = | ✗ | F6 → F11 | shardState.ts is deleted at F11 (02 F11 step 2): the test goes with it |
| `test/shard-tools.test.ts` | 51 | = | = | F6 | engine / #game subject (a shard file is only a fixture): stays; imports rewritten |
| `test/shell.test.ts` | 26 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/shop.test.ts` | 107 | `test/shards/driftwood-isle/shop.test.ts` | = | F6 | subject moves to Driftwood at F6 (04 §2 src/game/quest, src/game/loot) |
| `test/species.test.ts` | 105 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/species.ts` | 6 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/steppe-score.test.ts` | 60 | `test/shards/nalati-grasslands/steppe-score.test.ts` | = | F6 | subject moves to Nalati at F6 (04 §2: rule 2 / rule 4) |
| `test/title-arrival.test.ts` | 38 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/title-deck.test.ts` | 27 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/token-shelf.test.ts` | 25 | `test/shards/pine-hollow/token-shelf.test.ts` | = | F6 | subject is Pine code (02 F6 step 6; 06 §1.3) |
| `test/tree-species.test.ts` | 68 | = | = | F6 | engine / #game subject (a shard file is only a fixture): stays; imports rewritten |
| `test/weather.test.ts` | 161 | `test/shards/nalati-grasslands/weather.test.ts` | = | F6 | subject is Nalati's storm (world/Weather.ts → NG at F6); S2.4 adds its Nalati fixture to test/engine/weather.test.ts |
| `test/webgl-startup.test.ts` | 79 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/wind.test.ts` | 60 | = | = | F6 | engine / game subject: stays; imports rewritten to #engine / #game / #kit |
| `test/worldClock.test.ts` | 45 | = | ✗ | F6 → S2.4 | WorldClock.ts is deleted at S2.4; its cases fold into test/engine/day-cycle.test.ts (06 §6.4) |

### 4.1 Globs and file reads in tests

Every rewritten glob keeps F1's non-empty assert. A glob is rewritten so it matches **at least** the files it
matched before (each at its new path); a test that scans for a banned pattern may match more, never fewer.

| File | Today | After F6 | Also |
|---|---|---|---|
| `test/facade-no-multidraw.test.ts` (stays) | `'../src/chunks/nine-dragon-stack/**/*.ts'`, `FACADE = '../src/chunks/nine-dragon-stack/world/facade/batch.ts'` | `['../src/shards/nine-dragon-stack/**/*.ts', '../src/kit/viewmodel/armRig.ts']`; `FACADE` → `'../src/shards/nine-dragon-stack/world/facade/batch.ts'` | the E271 guard; it now also scans the grapple playground (stricter) |
| `test/shards/driftwood-isle/models-driftwood.test.ts` | `['../src/world/*.ts', '../src/main.ts']` | `['../../../src/engine/world/*.ts', '../../../src/shards/driftwood-isle/world/*.ts', '../../../src/main.ts']` | **manual**: `SOURCES[\`../${file}\`]` → `SOURCES[\`../../../${file}\`]` (the key is built from each model's `file:` field, which the codemod rewrites) |
| `test/shards/pine-hollow/models-pine-hollow.test.ts` | `['../src/world/*.ts', '../src/main.ts', '../src/chunks/pine-hollow/world/*.ts', '../src/pinehollow/quest/*.ts']` | `['../../../src/engine/world/*.ts', '../../../src/main.ts', '../../../src/shards/pine-hollow/world/*.ts', '../../../src/shards/pine-hollow/quest/*.ts']` | **manual**: the same `../${file}` key prefix |
| `test/shards/nalati-grasslands/nalati-roster.test.ts` | `['../src/nalati/*.ts', '../src/entities/Wildlife.ts', '../src/game/Taming.ts']` | `['../../../src/shards/nalati-grasslands/*.ts', '../../../src/shards/nalati-grasslands/ride/ride.ts', '../../../src/engine/entities/Wildlife.ts', '../../../src/shards/nalati-grasslands/ride/Taming.ts']` | the root glob now also scans `manifest.ts`, `layout.ts`, `edge.ts`, `quest.ts` (stricter) |
| `test/species.ts` (helper, stays) | `['../src/entities/species/*.ts', '!…/registry.ts', '!…/loft.ts']` | `['../src/engine/entities/species/*.ts', '!../src/engine/entities/species/registry.ts', '!../src/engine/entities/species/loft.ts']` | S2.3, S3.4 and S4.2 each add their new species folder to the list |
| `test/compendium.test.ts`, `test/ktx2-auto.test.ts`, `test/shell.test.ts` | `../public/…` globs | unchanged (`public/` does not move) | — |
| the 60 `'src/…'` string literals in tests (model and piece `file:` fields, fixtures) | today's paths | rewritten by the string pass (§7.2 step 5) | — |

## 5. Scripts and configs that name `src/` paths (48 files, 277 literals)

`scripts/` is not typechecked, so every path here breaks at run time or silently (TP §1). The codemod's string pass
(§7.2 step 5) rewrites every literal that resolves to a mapped file; the rows marked **manual** need a hand edit in the
F6 commit, listed again in §7.3. The 21 scripts that import game modules through `bake-loader.mjs` are the `import` /
`src()` rows plus the bakers that `import(pathToFileURL(…))` a `src/` path (`bake-chunk`, `bake-sky`, `bake-packs`,
`bake-ktx2`, `unused-assets`, the Blender `export*` scripts). Per-literal detail (line, old path, new path) is in
[move-map.json](move-map.json) `scripts[]`.

| File | Paths | Kind | What it needs |
|---|---|---|---|
| `.oxlintrc.json` | 4 | string | codemod: `src/pwa/sw.js`, `src/boot/bytes.generated.ts`; `src/**` unchanged; the `src/dev/**` block went at F7; F4 adds per-layer overrides |
| `index.html` | 14 | string | codemod: 14 literal(s) |
| `scripts/bake-cards.mjs` | 2 | string | codemod: 2 literal(s) |
| `scripts/bake-chunk.mjs` | 22 | string | manual: shard discovery `readdirSync('src/chunks')` (:39, :75, :80, :90, :95) → the list of `src/shards/*/manifest.ts` that have `ground.terrain` (02 F6 step 3); `localImports()` resolves siblings next to the manifest; `EXTRA_DEPS` keyed by slug |
| `scripts/bake-ktx2.mjs` | 3 | string | codemod: 3 literal(s) |
| `scripts/bake-loader.mjs` | 1 | string | none: its `/src/` image stub regex matches any depth |
| `scripts/bake-navmesh.mjs` | 17 | src() | codemod rewrites the 17 `src('…')` args; manual: `src(`world/${m}.ts`)` (:124) → an explicit list of the 10 Driftwood builders' new paths |
| `scripts/bake-packs.mjs` | 4 | string | codemod: 4 literal(s) |
| `scripts/bake-sky-keys.mjs` | 1 | import | codemod: 1 literal(s) |
| `scripts/bake-sky.mjs` | 2 | string | manual: shard discovery `readdirSync('src/chunks')` (:24, :26) → `src/shards/*/manifest.ts` (02 F6 step 3); its `self` hash changes → every sky.json re-stamps (§7.5) |
| `scripts/bake-textures.mjs` | 5 | string | codemod: 5 literal(s) |
| `scripts/blender/driftwood-isle/export.mjs` | 8 | string | codemod: 8 literal(s) |
| `scripts/blender/driftwood-isle/fp-arms/bake.mjs` | 1 | import | codemod: 1 literal(s) |
| `scripts/blender/lib/export-scene.mjs` | 5 | string | codemod: 5 literal(s) |
| `scripts/blender/nine-dragon-stack/viewmodel/rig/check-clips.mjs` | 1 | string | codemod: 1 literal(s) |
| `scripts/blender/pine-hollow/crags/export-cave.mjs` | 4 | src() | codemod: 4 literal(s) in `src('…')` calls |
| `scripts/blender/pine-hollow/export.mjs` | 1 | string | codemod: 1 literal(s) |
| `scripts/blender/targets.json` | 14 | string | codemod: `sources` / `feeds`; the `nine-dragon-stack/fei-zhua` target went at F7 |
| `scripts/check-css.mjs` | 3 | string | manual: `STYLES = 'src/ui/styles'` + `join(STYLES, '<name>.css')` (:30-60) → a table of full paths (the CSS now lives in engine/ui/styles, game/*, shards/*) |
| `scripts/check-models.mjs` | 87 | string | codemod: the 83 allowlisted paths; manual (TP10): folder rules 1–5 (`src/models/`, `src/chunks/<slug>/models/`, the `shared/` / `<slug>/` id prefixes) → `src/{engine,kit}/models/` and `src/shards/<slug>/models/`, the `SHARD_MODELS` regex, and the per-shard places table (:214-217) |
| `scripts/creature-lineup.mjs` | 2 | page-import | dead since E317 (in-page `import('/src/…')` needs a Vite dev server): F7 liveness keeps or deletes it; if kept, the codemod rewrites the literals and TP16 ports it |
| `scripts/creature-rig-bake.mjs` | 2 | page-import | dead since E317 (in-page `import('/src/…')` needs a Vite dev server): F7 liveness keeps or deletes it; if kept, the codemod rewrites the literals and TP16 ports it |
| `scripts/creature-strip.mjs` | 3 | page-import | dead since E317 (in-page `import('/src/…')` needs a Vite dev server): F7 liveness keeps or deletes it; if kept, the codemod rewrites the literals and TP16 ports it |
| `scripts/e350-hale-web.mjs` | 1 | import | codemod: 1 literal(s) |
| `scripts/e350-king-measure.mjs` | 1 | import | codemod: 1 literal(s) |
| `scripts/img2mesh/birds/birds_fix_preview.mjs` | 1 | import | codemod: 1 literal(s) |
| `scripts/king-rig-bake.mjs` | 1 | import | codemod: 1 literal(s) |
| `scripts/king-rig-gate.mjs` | 1 | import | codemod: 1 literal(s) |
| `scripts/music/gen/sfx_sprite.py` | 1 | string | codemod: 1 literal(s) |
| `scripts/nalati-creature-strip.mjs` | 8 | page-import | dead since E317 (in-page `import('/src/…')` needs a Vite dev server): F7 liveness keeps or deletes it; if kept, the codemod rewrites the literals and TP16 ports it |
| `scripts/nalati-models-compare.mjs` | 7 | page-import | dead since E317 (in-page `import('/src/…')` needs a Vite dev server): F7 liveness keeps or deletes it; if kept, the codemod rewrites the literals and TP16 ports it |
| `scripts/nalati-models-merge-compare.mjs` | 7 | page-import | dead since E317 (in-page `import('/src/…')` needs a Vite dev server): F7 liveness keeps or deletes it; if kept, the codemod rewrites the literals and TP16 ports it |
| `scripts/nalati-panorama.py` | 1 | string | codemod: 1 literal(s) |
| `scripts/nalati-reach.mjs` | 6 | src() | codemod: 6 literal(s) in `src('…')` calls |
| `scripts/nalati-ride-physics.mjs` | 5 | page-import | dead since E317 (in-page `import('/src/…')` needs a Vite dev server): F7 liveness keeps or deletes it; if kept, the codemod rewrites the literals and TP16 ports it |
| `scripts/nalati-rig-bake.mjs` | 4 | page-import | dead since E317 (in-page `import('/src/…')` needs a Vite dev server): F7 liveness keeps or deletes it; if kept, the codemod rewrites the literals and TP16 ports it |
| `scripts/nine-dragon-budget.mjs` | 1 | string | codemod: 1 literal(s) |
| `scripts/nine-dragon-domes.mjs` | 1 | string | codemod: 1 literal(s) |
| `scripts/nine-dragon-gpu.mjs` | 1 | string | codemod: 1 literal(s) |
| `scripts/nine-dragon-grapple-touch.mjs` | 1 | string | codemod: 1 literal(s) |
| `scripts/ota-release.mjs` | 1 | string | codemod: 1 literal(s) |
| `scripts/pine-hollow-hero-shots.mjs` | 1 | page-import | dead since E317 (in-page `import('/src/…')` needs a Vite dev server): F7 liveness keeps or deletes it; if kept, the codemod rewrites the literals and TP16 ports it |
| `scripts/pine-hollow-walkcheck.mjs` | 2 | import | codemod: 2 literal(s) |
| `scripts/playground-cards.mjs` | 1 | import | codemod: 1 literal(s) |
| `scripts/practice/verify_unimate_skin.mjs` | 5 | import, string | codemod: 5 literal(s) |
| `scripts/scorecard.mjs` | 1 | string | codemod: 1 literal(s) |
| `scripts/unused-assets.mjs` | 4 | string | codemod: registry / manifest paths; F7 already dropped the src/dev reads |
| `vite.config.ts` | 8 | string | codemod: the generated outputs + native plugin strings; manual: `writeArtModule` dirs (:118) → `src/shards/*/thumbs`, `src/shards/*/explore`, `src/engine/explore/img` (TP12) |

## 6. Generated files (TP12)

The generated modules live in `src/boot/`, so the folder rule already sends them to `src/engine/boot/`. What changes:

| File | Writer | After F6 | Content after the move |
|---|---|---|---|
| `bytes.generated.ts` | `vite.config.ts` | `E:boot/bytes.generated.ts` | unchanged (keys are public URLs). The `.oxlintrc.json` ignore is rewritten |
| `versions.generated.ts`, `audio.generated.ts` | `vite.config.ts` | `E:boot/` | unchanged |
| `art.generated.ts` | `vite.config.ts` `writeArtModule` | `E:boot/art.generated.ts` | **keys change** (they are `src/…` paths of the thumbs and hub art): regenerated and committed in the F6 commit. `writeArtModule`'s folder list and `extras.ts:61`'s key arithmetic are manual edits (§7.3) |
| `packs.generated.ts` | `bake-packs.mjs` | `E:boot/` | must be byte-identical (§7.5): pack payloads do not change |
| `gpu.generated.ts` | `bake-ktx2.mjs` | `E:boot/` | unchanged |
| `src/game/shard/shards.generated.ts` | `scripts/gen-shards.mjs` | — | new at F9 (01 §7) |

Readers rewritten by the string pass: `scripts/scorecard.mjs`, `scripts/unused-assets.mjs`, `scripts/bake-ktx2.mjs`,
`scripts/bake-packs.mjs`. Also re-keyed by the move: `lint/ratchet.json` (per-file counts), `test/coverage-ratchet.json`
(its scope), `docs/MOVED.md` (generated: the full old → new table, 02 F6 step 2.5).

**Files that rows before F6 add** (not in today's tree) are mapped the same way: `src/core/probe.ts` (F2) →
`E:debug/probe.ts`; `src/engine/index.ts`, `src/game/index.ts`, `src/kit/index.ts` and `src/engine/aliasFixture.ts`
(F1) are already in place. The classifier refuses any other unmapped file (§7.1).

## 7. The codemod (TP7)

### 7.1 Input: `move-map.json`

[move-map.json](move-map.json) is committed next to this file and is the codemod's only input. Its top-level keys:

| Key | Holds |
|---|---|
| `version`, `tree` | `1`; the tree it was measured on (`0b6aa045`) |
| `prefixes`, `rules` | the legends of §0 and §1.2 |
| `files[]` | one row per file of §2: `{ from, lines, bytes, f6, final, layer, rule, row, why, confirm? }`. `f6: null` = deleted by F7; `final: null` = deleted by `row` |
| `tests[]` | one row per file of §4: `{ from, lines, f6, final, row, why }` |
| `scripts[]` | one row per file of §5: `{ file, count, kinds, rewrites: [{ line, from, to, final }], needs }` |
| `globs[]` | the source globs of §4.1 and §7.2 step 3, old → new |
| `manual[]` | the hand edits of §7.3 |
| `generated[]` | §6 |

**Relation to 02 F6 step 1.** 02 has `scripts/normalize/classify.mjs` compute the map and write
`scripts/normalize/move-map.json`. This spec makes the reviewed map the input instead: `classify.mjs --check
docs/plans/game-normalization/move-map.json` recomputes rules I, G, N and M on the tree of the day and exits 1 on any
file with no row, any row whose file is gone, and any row whose computed rule disagrees with the map's rule (the lead
then fixes the map, with a one-line reason, before the move). The codemod reads only the committed map (Q2).

### 7.2 What it rewrites

`node scripts/normalize/move.mjs docs/plans/game-normalization/move-map.json [--row F6|<row>] [--dry-run]`,
idempotent (a second run changes nothing). With `--row F6` it applies every row's `f6`; with `--row S2.3` it moves
every row whose `row` ends in `→ S2.3` from `f6` to `final` (§7.6).

| Step | Rewrites | Rule |
|---|---|---|
| 1 | `git mv` every row (folders created; `git rm` for F7 rows is F7's, not the codemod's) | refuses a destination collision, including a case-only one (macOS is case-insensitive); the map has none (checked) |
| 2 | **Imports** in `src/**` and `test/**`: static `import` / `import type` / `export … from`, dynamic `import('…')`, side-effect `import './x.css'`, query suffixes kept (`?raw`, `?url`, `?inline`, `?worker&inline`) | same layer folder (engine ↔ engine, game ↔ game, kit ↔ kit, one shard ↔ itself) → relative, recomputed; across layers or shards → alias `#engine/<path>`, `#game/<path>`, `#kit/<path>`, `#shards/<slug>/<path>` without the extension (deep paths allowed now; `wildshard/layer` counts them, step 7). Tests always use aliases. Non-`.ts` targets (`.css`, images) keep their extension |
| 3 | **`import.meta.glob`** (3 in `src`, 6 in tests: §4.1) | `extras.ts:47` → `['../../shards/*/thumbs/*.{jpg,jpeg,png,webp}', '../explore/img/*.{jpg,jpeg,png,webp}', '../../shards/*/explore/*.{jpg,jpeg,png,webp}']`; `Compare.ts:9` and `AnimalFactory.ts:15` unchanged at F6 (their files stay beside them: E3, E1), replaced by manifest data in their rows |
| 4 | **Path strings in `src/**` and `test/**`**: the 241 `'src/…'` literals in 186 src files (model `file:` fields, registry pieces, `FILE` constants) and the 60 in tests | exact-path match against the map, longest first, on path boundaries, also inside template literals |
| 5 | **Path strings outside `src/`**: every file `check-paths` scans (`scripts/**/*.{mjs,js,sh,py,json}`, `vite.config.ts`, `vite/**`, `.oxlintrc.json`, `scripts/blender/targets.json` `sources` / `feeds`), `index.html` (10 stylesheet links + 4 scripts), and the `src('…')` helper calls of `bake-navmesh.mjs`, `nalati-reach.mjs`, `export-cave.mjs` (their argument is `src/`-relative) | as step 4; §5 lists every file |
| 6 | **Comments and living docs**: path mentions in comments under `src/`, `test/`, `scripts/`, and in `AGENTS.md`, `README.md`, `docs/*.md`, `docs/design/**`, `docs/plans/**`, `.claude/skills/**`. History (`docs/tasks/**`, `docs/audits/**`, `project/**`, `progress/**`, `art/**`) is untouched; `docs/MOVED.md` is generated | as step 4 (02 F6 step 2.5) |
| 7 | **Ratchets**: `lint/ratchet.json` re-keyed to the new paths, then `--add-layer` records every `wildshard/layer` count (02 F6 step 5) | the only time a count may be added |
| 8 | **Config**: `tsconfig.json` `include` (`src`, `test`: unchanged), `.oxlintrc.json` overrides (`src/pwa/sw.js` → `src/engine/pwa/sw.js`; the ignore of `bytes.generated.ts`), `vite.config.ts` native strings (`/src/boot/entry.ts`, `/src/native/boot.ts`, `/src/boot/sw.ts`, `/src/ui/Update.ts`) and generated outputs, `vite/rapier.ts:26` (`src/physics/rapierBindings.ts`) | as step 4 |

### 7.3 Manual edits (the codemod cannot do these; they go in the same F6 commit)

| # | File | Edit |
|---|---|---|
| 1 | `scripts/bake-chunk.mjs:39, 75, 80, 90, 95` | shard discovery from `readdirSync('src/chunks')` → the `src/shards/*/manifest.ts` files with `ground.terrain` (02 F6 step 3); `localImports()` resolves siblings next to the manifest; `EXTRA_DEPS` keyed by slug |
| 2 | `scripts/bake-sky.mjs:24, 26` | the same discovery |
| 3 | `scripts/bake-navmesh.mjs:124` | ``src(`world/${m}.ts`)`` over 10 Driftwood builders → an explicit list of their new paths (`shards/driftwood-isle/world/<Name>.ts`) |
| 4 | `scripts/check-css.mjs:30-60` | `STYLES = 'src/ui/styles'` + `join(STYLES, '<name>.css')` → a table of full paths: the CSS now lives in `engine/ui/styles/`, `game/{compendium,complete,loot}/`, `shards/{pine-hollow/quest,nalati-grasslands,nalati-grasslands/ride,driftwood-isle/loot}/` |
| 5 | `scripts/check-models.mjs` (TP10) | folder rules 1–5: `src/models/` → `src/{engine,kit}/models/`; `src/chunks/<slug>/models/` → `src/shards/<slug>/models/`; the `SHARD_MODELS` regex; the places table (:214-217) |
| 6 | `vite.config.ts:118` `writeArtModule` | its folders → `src/shards/*/thumbs`, `src/shards/*/explore`, `src/engine/explore/img` (TP12) |
| 7 | `src/engine/boot/extras.ts:61` | `ART_BYTES[\`src/${key.slice(3)}\`]` → the key resolved against `src/engine/boot/` (the glob keys now start `../../shards/` or `../explore/`) |
| 8 | `test/shards/driftwood-isle/models-driftwood.test.ts`, `test/shards/pine-hollow/models-pine-hollow.test.ts` | the source-lookup prefix `../` → `../../../` (§4.1) |

### 7.4 The dry run

`--dry-run` changes nothing and prints, then writes the same as JSON to `scripts/normalize/out/dry-run.json`
(git-ignored):
1. per layer and shard: files and lines moved (must equal §8's F6 column);
2. every `git mv` (906 − 39 F7 rows);
3. per rewritten file: the number of changed lines by step (imports, globs, strings, comments);
4. every import that does not resolve after the rewrite (exit 1 if any);
5. every `src/`-looking literal in the scanned files that matches no map row (a warning, to be fixed or allowlisted in
   `check-paths.allow.json` before the real run);
6. the upward and cross-shard edges it creates, by kind (engine → game, engine → kit, engine → shard, game → shard, kit
   → shard, shard → shard): the ratchet counts step 7 will record. **Shard → shard must be 0**;
7. the collision and case-only checks.

### 7.5 Verification (the F6 done-when, made exact)

| Check | Passes when |
|---|---|
| Idempotence | a second `move.mjs … --row F6` leaves `git status` clean |
| Root | `find src -maxdepth 1 -mindepth 1 \| sort` prints `src/engine src/game src/kit src/shards` |
| Types, lint, CSS, build | `pnpm run typecheck`, `pnpm run lint` (0 warnings), `node scripts/check-css.mjs`, `pnpm exec vite build` exit 0 |
| Tests | `pnpm test` exits 0 (check-paths, check-model-sources, vitest) and runs **the same number of test files and cases** as before the move (vitest `--reporter=json` totals compared; nothing skipped, nothing vacuous) |
| Ratchets | `pnpm lint:ratchet` exits 0; every layer violation has a count; shard → shard = 0 |
| Bakers | after `vite build`: every baked payload is byte-identical (`public/assets/**/*.bin`, images, `packs/*`, `packs.generated.ts`). The staleness `hash` fields in `terrain.json`, `navmesh.json`, `sky.json`, `cards.json` and the textures meta may change **once**, because the files they hash had their import lines rewritten (`bake-chunk` hashes the chunk sources, `bake-navmesh` and `bake-sky` hash their own script). `scripts/normalize/restamp.mjs` recomputes those digests without re-baking and fails if any hashed input differs from HEAD in anything but import / export specifiers and path literals; `bake-cards` / `bake-textures` are never re-rendered (GPU output is not reproducible). `node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/bake-navmesh.mjs --check` exits 0 after the restamp. Cost: `sky.json` ships inside Pine Hollow's phone pack (a 2.7 MB part), so its new hash renames that part once (Q5) |
| Parity | 03 §10's run is green on both lanes with **no** rename map (the move changes no system label, key or registry id) |
| Chunks | `ls dist/assets/*.js \| wc -l` equal and the main chunk's bytes within ±1 % (aliases can move chunk boundaries; 02 F6 risks) |
| History | `git log --follow` on 5 sampled files (one per layer) shows the pre-move history |

### 7.6 The later rows

A row that finishes a move runs `move.mjs … --row <row>` for its own rows only (the `Row` column ends in `→ <row>`),
in its own commit, before it restructures the code, with the same steps 2–8, the same dry run and the same checks
(parity as that row's spec says). For a `SPLIT` row the codemod moves the file to its `final` path (the part that keeps
the file) and the row's author creates the extracted files by hand; the map's `why` names them. When the last row of a
path has run, its `f6` path no longer exists, and `classify.mjs --check` confirms every `final` exists.

## 8. Totals

Files and lines (images counted as files, 0 lines). Today: 906 files, 176,729 lines.

| Destination | After F6: files | lines | Final: files | lines |
|---|---|---|---|---|
| `src/engine/` | 378 | 78,540 | 276 | 57,053 |
| `src/game/` | 34 | 4,807 | 29 | 4,002 |
| `src/kit/` | 5 | 1,455 | 26 | 9,406 |
| `src/shards/nine-dragon-stack/` | 116 | 25,164 | 118 | 24,880 |
| `src/shards/pine-hollow/` | 114 | 18,675 | 131 | 22,611 |
| `src/shards/nalati-grasslands/` | 137 | 26,638 | 168 | 32,987 |
| `src/shards/driftwood-isle/` | 83 | 14,379 | 105 | 17,086 |
| deleted | 39 | 7,071 | 53 | 8,704 |
| **all** | **906** | **176,729** | **906** | **176,729** |

"Final" counts today's lines at their final home; the rows add and delete code on top (families, rows, the extracted
parts), which this map does not predict.

**Against the audit's "~42k lines to move".** The index counts `src/nalati` + `src/pinehollow` + the single-shard files
in engine folders:

| | F6 | Final |
|---|---|---|
| `src/nalati/` + `src/pinehollow/` | 16,294 (69 files) | 16,294 |
| single-shard files from engine folders | 25,337 (122 files) | 38,724 (197 files) |
| single-shard files from `src/game/` | 1,873 (16 files) | 2,139 (17 files) |
| **into shard folders from outside today's shard folders** | **43,504** | **57,157** |
| into the kit from engine folders and shards | 1,455 (5 files) | 9,406 (26 files) |

F6 moves ~43.5k, in line with the audit's ~42k (its count predates the Driftwood quest and loot files). By the end
~57k lines leave the engine folders for shards and ~9.4k for the kit; the engine keeps ~57k of today's lines.

**Rows that finish moves** (files / today's lines): F7 39 / 7,071 (deleted) · F9 2 / 285 · F10 1 / 21 · F11 5 / 856 ·
S1.1 7 / 591 · S1.2 6 / 1,696 · S1.4 1 / 17 · S1.5 1 / 244 · S2.1 13 / 1,766 · S2.2 11 / 5,429 · S2.2 + X5 1 / 299 ·
S2.3 15 / 3,361 · S2.4 4 / 1,392 · S2.4 + S3.2 1 / 533 · S2.4 + S4.3 1 / 242 · S2.5 4 / 1,088 · S3.1 7 / 614 ·
S3.2 2 / 598 · S3.3 2 / 79 · S3.4 22 / 5,255 · S3.5 2 / 701 · S4.1 10 images · S4.2 6 / 1,578 · S4.3 6 / 1,189 ·
S4.4 1 / 1,336 · X1 2 / 166 · X7 1 / 190. The other 733 files move once, at F6.

## 9. Placements the shard specs must confirm

These are the Nalati and Driftwood rows decided by a judgment (rules I, G, N, K, M, SPLIT, X-*), not by a folder. 07-nalati and 08-driftwood either confirm each row or say where it goes instead; the lead then updates the map (a row edit plus `classify.mjs --check`). Territory rows (rule T) need no confirmation.

**07-nalati** (91 rows): `audio/SteppeAmbience.ts` → `NG:audio/SteppeAmbience.ts` (F6 (+S3.5)) · `audio/SteppeScore.ts` → `NG:audio/SteppeScore.ts` (F6 (+S3.5)) · `entities/Flock.ts` → `NG:creatures/Flock.ts` (F6 → S3.4) · `entities/Herd.ts` → `NG:creatures/Herd.ts` (F6 → S3.4) · `entities/Marmots.ts` → `NG:creatures/Marmots.ts` (F6 → S3.4) · `entities/Pack.ts` → `NG:creatures/Pack.ts` (F6 → S3.4) · `entities/Wildlife.ts` → `NG:creatures/Wildlife.ts` (F6 → S3.4) · `entities/creatureCoats.ts` → `NG:species/creatureCoats.ts` (F6 → S3.4) · `entities/creatureKit.ts` → `NG:species/creatureKit.ts` (F6 → S3.4) · `entities/creatureRigs.ts` → `NG:species/creatureRigs.ts` (F6 → S3.4) · `entities/glbCreatures.ts` → `NG:species/glbCreatures.ts` (F6 → S3.4) · `entities/painterlyAnimals.ts` → `NG:species/painterlyAnimals.ts` (F6 → S3.4) · `entities/species/balbal.ts` → `NG:species/balbal.ts` (F6 → S3.4) · `entities/species/eagle.ts` → `NG:species/eagle.ts` (F6 → S3.4) · `entities/species/ghostRider.ts` → `NG:species/ghostRider.ts` (F6 → S3.4) · `entities/species/goldenKing.ts` → `NG:species/goldenKing.ts` (F6 → S3.4) · `entities/species/horse.ts` → `NG:species/horse.ts` (F6 → S3.4) · `entities/species/kokbori.ts` → `NG:species/kokbori.ts` (F6 → S3.4) · `entities/species/kurganBalbal.ts` → `NG:species/kurganBalbal.ts` (F6 → S3.4) · `entities/species/leopard.ts` → `NG:species/leopard.ts` (F6 → S3.4) · `entities/species/sheep.ts` → `NG:species/sheep.ts` (F6 → S3.4) · `entities/species/sheepdog.ts` → `NG:species/sheepdog.ts` (F6 → S3.4) · `entities/species/wolf.ts` → `NG:species/wolf.ts` (F6 → S3.4) · `entities/wildEnv.ts` → `NG:creatures/wildEnv.ts` (F6 → S3.4) · `explore/img/mockups/nalati-camp-live.jpg` → `NG:explore/mockups/nalati-camp-live.jpg` (F6 → S3.1) · `explore/img/mockups/nalati-camp-target.jpg` → `NG:explore/mockups/nalati-camp-target.jpg` (F6 → S3.1) · `explore/img/mockups/nalati-gully-live.jpg` → `NG:explore/mockups/nalati-gully-live.jpg` (F6 → S3.1) · `explore/img/mockups/nalati-gully-target.jpg` → `NG:explore/mockups/nalati-gully-target.jpg` (F6 → S3.1) · `explore/img/mockups/nalati-rail-live.jpg` → `NG:explore/mockups/nalati-rail-live.jpg` (F6 → S3.1) · `explore/img/mockups/nalati-rail-target.jpg` → `NG:explore/mockups/nalati-rail-target.jpg` (F6 → S3.1) · `game/Taming.ts` → `NG:ride/Taming.ts` (F6) · `game/quest/nalati.ts` → `NG:quest.ts` (F6) · `player/GoldenBow.ts` → `NG:weapons/GoldenBow.ts` (F6 (+S3.3)) · `player/Mount.ts` → `NG:ride/Mount.ts` (F6 (+S3.3)) · `player/Naizagai.ts` → `NG:weapons/Naizagai.ts` (F6 (+S3.3)) · `player/Reins.ts` → `NG:ride/Reins.ts` (F6 (+S3.3)) · `player/Sabre.ts` → `NG:weapons/Sabre.ts` (F6 (+S1.2)) · `player/Spear.ts` → `NG:weapons/Spear.ts` (F6 (+S1.2)) · `player/horseNames.ts` → `NG:ride/horseNames.ts` (F6) · `player/meleeGeo.ts` → `NG:weapons/meleeGeo.ts` (F6) · `player/nalatiArms.ts` → `K:viewmodel/nalatiArms.ts` (F6 → S2.2) · `player/nalatiKit.ts` → `✗` (F6 → S3.3) · `player/nalatiSkins.ts` → `NG:weapons/nalatiSkins.ts` (F6 (+X5)) · `player/rideAssist.ts` → `NG:ride/rideAssist.ts` (F6) · `player/riding.ts` → `NG:ride/riding.ts` (F6 → S3.3) · `playgrounds/HorsePlayground.ts` → `NG:playground/HorsePlayground.ts` (F6 (+S3.1)) · `playgrounds/horseCourse.ts` → `NG:playground/horseCourse.ts` (F6 (+S3.1)) · `ui/HorseNamePrompt.ts` → `NG:ride/HorseNamePrompt.ts` (F6) · `ui/RideHUD.ts` → `NG:ride/RideHUD.ts` (F6) · `ui/styles/ride.css` → `NG:ride/ride.css` (F6) · `ui/styles/stealth.css` → `NG:stealth.css` (F6) · `world/DayClock.ts` → `NG:look/dayClock.ts` (F6 → S2.4 / S3.2) · `world/GrassField.ts` → `K:looks/grassField.ts` (F6) · `world/PainterlySky.ts` → `NG:look/PainterlySky.ts` (F6 → S3.2) · `world/Spruce.ts` → `NG:world/Spruce.ts` (F6 (+S3.1)) · `world/Weather.ts` → `NG:world/Weather.ts` (F6 (+S2.4)) · `world/WeatherFX.ts` → `NG:world/WeatherFX.ts` (F6 (+S2.4)) · `world/nalati/Balbals.ts` → `NG:world/Balbals.ts` (F6) · `world/nalati/Bowl.ts` → `NG:world/Bowl.ts` (F6) · `world/nalati/Bridge.ts` → `NG:world/Bridge.ts` (F6) · `world/nalati/Cairn.ts` → `NG:world/Cairn.ts` (F6) · `world/nalati/Crags.ts` → `NG:world/Crags.ts` (F6) · `world/nalati/EagleRock.ts` → `NG:world/EagleRock.ts` (F6) · `world/nalati/Flutter.ts` → `NG:world/Flutter.ts` (F6) · `world/nalati/KurganDungeon.ts` → `NG:world/KurganDungeon.ts` (F6) · `world/nalati/KurganField.ts` → `NG:world/KurganField.ts` (F6) · `world/nalati/NomadCamp.ts` → `NG:world/NomadCamp.ts` (F6) · `world/nalati/RoadFurniture.ts` → `NG:world/RoadFurniture.ts` (F6) · `world/nalati/Smoke.ts` → `NG:world/Smoke.ts` (F6) · `world/nalati/Stair.ts` → `NG:world/Stair.ts` (F6) · `world/nalati/SummerCamp.ts` → `NG:world/SummerCamp.ts` (F6) · `world/nalati/Yard.ts` → `NG:world/Yard.ts` (F6) · `world/nalati/clearings.ts` → `NG:world/clearings.ts` (F6) · `world/nalati/dressing/index.ts` → `NG:world/dressing/index.ts` (F6) · `world/nalati/dressing/layer.ts` → `NG:world/dressing/layer.ts` (F6) · `world/nalati/dressing/life.ts` → `NG:world/dressing/life.ts` (F6) · `world/nalati/dressing/place.ts` → `NG:world/dressing/place.ts` (F6) · `world/nalati/dressing/statics.ts` → `NG:world/dressing/statics.ts` (F6) · `world/nalati/glbPaint.ts` → `NG:world/glbPaint.ts` (F6) · `world/nalati/granite.ts` → `NG:world/granite.ts` (F6) · `world/nalati/index.ts` → `NG:world/index.ts` (F6) · `world/nalati/layout.ts` → `NG:world/layout.ts` (F6) · `world/nalati/paint.ts` → `NG:world/paint.ts` (F6) · `world/nalati/painted.ts` → `NG:world/painted.ts` (F6) · `world/nalati/places.ts` → `NG:world/places.ts` (F6) · `world/nalati/props.ts` → `NG:world/props.ts` (F6) · `world/nalati/solid.ts` → `NG:world/solid.ts` (F6) · `world/nalati/types.ts` → `NG:world/types.ts` (F6) · `world/nalatiTextures.ts` → `NG:look/nalatiTextures.ts` (F6 (+S3.2)) · `world/painterly.ts` → `NG:look/painterly.ts` (F6 → S3.2) · `world/spruceMask.ts` → `NG:world/spruceMask.ts` (F6)

**08-driftwood** (69 rows): `audio/IslandAmbience.ts` → `DI:audio/ambience.ts` (F6 (+S3.5)) · `audio/IslandSfx.ts` → `DI:audio/sfx.ts` (F6 → S3.5) · `audio/ShrineHum.ts` → `DI:audio/shrineHum.ts` (F6) · `entities/Enemies.ts` → `DI:creatures/Enemies.ts` (F6 (+S4.2)) · `entities/npc/Castaway.ts` → `DI:npc/Castaway.ts` (F6 (+S4.3)) · `entities/npc/Trader.ts` → `DI:npc/Trader.ts` (F6 (+S4.3)) · `entities/species/captain.ts` → `DI:species/captain.ts` (F6 → S4.2) · `entities/species/captainMesh.ts` → `DI:species/captainMesh.ts` (F6 → S4.2) · `entities/species/crab.ts` → `DI:species/crab.ts` (F6 → S4.2) · `entities/species/monkey.ts` → `DI:species/monkey.ts` (F6 → S4.2) · `entities/species/sailor.ts` → `DI:species/sailor.ts` (F6 → S4.2) · `explore/img/mockups/driftwood-overlook-live.jpg` → `DI:explore/mockups/driftwood-overlook-live.jpg` (F6 → S4.1) · `explore/img/mockups/driftwood-overlook-target.jpg` → `DI:explore/mockups/driftwood-overlook-target.jpg` (F6 → S4.1) · `explore/img/mockups/driftwood-right-live.jpg` → `DI:explore/mockups/driftwood-right-live.jpg` (F6 → S4.1) · `explore/img/mockups/driftwood-right-target.jpg` → `DI:explore/mockups/driftwood-right-target.jpg` (F6 → S4.1) · `explore/img/mockups/driftwood-spawn-live.jpg` → `DI:explore/mockups/driftwood-spawn-live.jpg` (F6 → S4.1) · `explore/img/mockups/driftwood-spawn-target.jpg` → `DI:explore/mockups/driftwood-spawn-target.jpg` (F6 → S4.1) · `explore/img/mockups/lookout.jpg` → `DI:explore/mockups/lookout.jpg` (F6 → S4.1) · `explore/img/mockups/shrine.jpg` → `DI:explore/mockups/shrine.jpg` (F6 → S4.1) · `explore/img/mockups/spawn.jpg` → `DI:explore/mockups/spawn.jpg` (F6 → S4.1) · `explore/img/mockups/wreck.jpg` → `DI:explore/mockups/wreck.jpg` (F6 → S4.1) · `game/loot/finds.ts` → `DI:loot/finds.ts` (F6 (+S4.3)) · `game/loot/install.ts` → `G:loot/install.ts` (F6 (+S4.3)) · `game/loot/keepsakes.ts` → `DI:loot/keepsakes.ts` (F6 (+S4.3)) · `game/loot/perks.ts` → `DI:loot/perks.ts` (F6 (+S4.3)) · `game/loot/shop.ts` → `DI:loot/shop.ts` (F6 (+S4.3)) · `game/quest/Adventure.ts` → `DI:quest/Adventure.ts` (F6 → S4.3) · `game/quest/Complete.ts` → `DI:quest/Complete.ts` (F6 (+S4.3)) · `game/quest/Ecology.ts` → `DI:quest/Ecology.ts` (F6 (+S4.3)) · `game/quest/Feats.ts` → `DI:quest/Feats.ts` (F6 (+S4.3)) · `game/quest/Finale.ts` → `DI:quest/Finale.ts` (F6 (+S4.3)) · `game/quest/Places.ts` → `DI:quest/Places.ts` (F6 (+S4.3)) · `game/quest/Spine.ts` → `DI:quest/Spine.ts` (F6 (+S4.3)) · `game/quest/TraderStall.ts` → `DI:quest/TraderStall.ts` (F6 (+S4.3)) · `game/quest/driftwood.ts` → `DI:quest/questLine.ts` (F6 (+S4.3)) · `game/quest/guards.ts` → `DI:quest/guards.ts` (F6 (+S4.3)) · `game/quest/gullGuide.ts` → `DI:quest/gullGuide.ts` (F6 (+S4.3)) · `models/interact.ts` → `K:models/interact.ts` (F6 → S4.3) · `player/IronSword.ts` → `DI:weapons/IronSword.ts` (F6 (+S4.1)) · `player/bladeGlow.ts` → `DI:loot/bladeGlow.ts` (F6 → S4.3) · `ui/ShopPanel.ts` → `DI:loot/ShopPanel.ts` (F6 (+X2)) · `ui/styles/shop.css` → `DI:loot/shop.css` (F6) · `world/BlenderIsland.ts` → `DI:world/BlenderIsland.ts` (F6 (+S4.1)) · `world/Boat.ts` → `DI:world/Boat.ts` (F6 (+S4.1)) · `world/Boulders.ts` → `DI:world/Boulders.ts` (F6 (+S4.1)) · `world/Bushes.ts` → `DI:world/Bushes.ts` (F6 (+S4.1)) · `world/Cove.ts` → `DI:world/Cove.ts` (F6 (+S4.1)) · `world/DayNight.ts` → `DI:look/dayNight.ts` (F6 → S2.4 / S4.3) · `world/GroundCover.ts` → `DI:world/GroundCover.ts` (F6 (+S4.1)) · `world/Gulls.ts` → `DI:world/Gulls.ts` (F6 (+S4.1)) · `world/Hut.ts` → `DI:world/Hut.ts` (F6 (+S4.1)) · `world/Lookout.ts` → `DI:world/Lookout.ts` (F6 (+S4.1)) · `world/Ocean.ts` → `DI:world/Ocean.ts` (F6 (+S4.1)) · `world/Palms.ts` → `DI:world/Palms.ts` (F6 (+S4.1)) · `world/Pier.ts` → `DI:world/Pier.ts` (F6 (+S4.1)) · `world/RopeBridge.ts` → `DI:world/RopeBridge.ts` (F6 (+S4.1)) · `world/Seabed.ts` → `DI:world/Seabed.ts` (F6 (+S4.1)) · `world/Shrine.ts` → `DI:world/Shrine.ts` (F6 (+S4.1)) · `world/StylizedSky.ts` → `DI:look/StylizedSky.ts` (F6 → S4.3) · `world/Trailside.ts` → `DI:world/Trailside.ts` (F6 (+S4.1)) · `world/Waterfall.ts` → `DI:world/Waterfall.ts` (F6) · `world/Wreck.ts` → `DI:world/Wreck.ts` (F6 (+S4.1)) · `world/Zipline.ts` → `DI:world/Zipline.ts` (F6) · `world/coverTint.ts` → `DI:world/coverTint.ts` (F6) · `world/driftwood.ts` → `DI:world/driftLogs.ts` (F6) · `world/faceHeads.ts` → `DI:npc/faceHeads.ts` (F6 → S4.2) · `world/interact/driftwood.ts` → `DI:quest/interactables.ts` (F6 (+S4.3)) · `world/interact/models.ts` → `K:interact/models.ts` (F6 → S4.3) · `world/stylize.ts` → `DI:look/stylize.ts` (F6 → S4.3)

## 10. Questions for the lead

Each has the default this map uses, so the map stays executable.

| # | Question | This map's default |
|---|---|---|
| Q1 | **The horse.** 01 §21, 09 §5.2 and plan §2.5 put the horse in the kit; 01 §22 moves the horse playground into Nalati, so by the rule of two only Nalati uses it (09 Q5 says the same). A kit horse would pull `Herd.ts` → `Pack.ts` → `wildEnv.ts`, `creatureKit.ts` and the painterly creature look (~2k lines of Nalati wildlife AI) into the kit | Nalati (`NG:species/horse.ts`, its stack in `NG:creatures/`). If the kit wins, 5 rows change to `K:species/horse/…` |
| Q2 | **One map, one location.** 02 F6 has `classify.mjs` compute the map into `scripts/normalize/move-map.json`; this spec commits the reviewed map at `docs/plans/game-normalization/move-map.json` and makes the classifier a `--check` against it (§7.1). 02's rules also differ in 8 places (§1.5 rows 1–4, 6, 10–12) | This spec's map is the input; 02 F6 step 1 is amended to `--check` it |
| Q3 | **LeverRifle.** 06 §1.3 sends it to `src/kit/weapons/firearm/`; 09 §1.5 keeps it in Pine | Pine (09, rule of two) |
| Q4 | **Grass.ts.** 06 §1.3 says S2.1 but also "after S3.1 takes Nalati's GrassV2 dispatch out", and S3.1 runs after S2.1 | the move is S3.1's; S2.1 wires Pine's call to it where it lies |
| Q5 | **One bake re-stamp.** The staleness digests hash sources whose import lines F6 rewrites, so `terrain.json`, `navmesh.json`, `sky.json` and the cards / textures metas re-stamp once (payloads identical, §7.5). `sky.json` sits in Pine Hollow's phone pack, so one 2.7 MB part gets a new name and every Pine phone player downloads it once, at M2's deploy | accept; the restamp tool proves nothing else changed |
| Q6 | **Which tests move.** This map moves a test by its subject (34 at F6); 02 counts 28 | by subject (§4) |
| Q7 | **Dead images.** `explore/img/{practice.jpg, models.webp, world.webp}` (the ART glob preloads them; no code shows them) and `explore/img/mockups/{lookout,shrine,spawn,wreck}.jpg` (no compare pair names them) | kept (engine / Driftwood); delete at F7 if the lead agrees (a parity-visible preload change: fewer bytes) |
| Q8 | **Driftwood's interact sounds.** Pine's quest plays `IslandSfx.interact()` sounds, so `gen.ts` and the interact half of `IslandSfx.ts` are 2-shard content | kit at S3.5 (`K:audio/gen.ts`, `K:audio/interactSfx.ts`); the alternative is Pine gets its own interact cues and both stay Driftwood's |
| Q9 | **The engine word list** (01 §0, §24): files that stay engine but carry a word-list word (`boot/shardPrefetch.ts`, `ui/Menu.ts`'s Bag, `world/steppeWind.ts` if "steppe" joins the list). The map moves the clear cases (`ShardComplete`, `titleDeck`, `switch.ts`, `wildshard-theme`, `models/interact.ts` → game / kit) | the rest are de-worded in place by X2 (UI) and X8 (strings), counted by the `wildshard/layer` word-list ratchet |
| Q10 | **Rig-bake tooling in `src/`.** `entities/creatureRigBake.ts` (801) and `humanoidRigBake.ts` (269) are imported only by dev-server scripts (`creature-rig-bake`, `nalati-rig-bake`, `nalati-creature-strip`) | engine (`E:entities/`); X4 folds them into the rig loader or F7 deletes them with their scripts |
| Q11 | **Castaway and Trader.** 01 §21 merges four NPC rigs into `#kit/npc` (D9) | the rig code merges into `K:npc/npcRig.ts` at S4.3; the two figures stay Driftwood content (`DI:npc/`) |
