# Sky Reach under 10 %: mini plan

The shard is `src/shards/far-reach/`. Its legacy basis is 6,779 lines, so 10 % allows at most **677 custom lines**. Today it has **1,309**, which means we must cut **at least 632**. The AssemblyScript ceiling is 677; today's AS is 53 (`behaviour/roc.as`).

## How the lines were counted (reproduced, read-only)

The ruler is `sourceProgressInventory` in `scripts/shard-platform.mjs`, which calls `countOutput(..., sourceProgress = true)`. Its rules for Sky:

- **Counted:** every authored `.ts` file under `src/shards/far-reach/`, minus tests, `.d.ts`, `generators/**`, and a declaration-only `manifest.ts` or `shard.config.ts`.
- **Generated TS in `data/` still counts.** The `sourceData` exception applies to non-legacy shards, so `data/*.generated.ts` files count.
- **Not counted:** `.json` files (they are not source files), `.as` files (a separate column) and everything under `generators/`, even when it is imported.
- **GLSL counts even inside `generators/`.** The `additional-glsl` path counts shader text in source-only files.
- **G294 sole-user charges:** any engine, game or SDK top-level declaration that only Sky's non-generator files reach is charged to Sky.
- **Line unit:** nonblank lines left after the parser strips comments.

To reproduce the numbers, a scratch script imported that library function with `WS_SHARD_PARSE_CACHE` unset. Its only write path is the parse cache, which stays off without that variable. The script gave **1,309 = 1,262 shard TS + 7 GLSL + 40 G294**, the same as the ruler at 93a250445. The far-reach tree is clean against HEAD 9d114c203. Reach was checked with an import-graph pass. The roots for runtime reach are `plugin.ts`, `roster.ts`, `look/render.ts` and the discovery bindings `data/budgets`, `data/devPoses` and `data/cues`. The roots for build reach are `generators/**` and `shard.config.ts`.

Where the 1,309 lines sit:

| Folder | Lines |
|---|---:|
| `data/` (57 files) | 751 |
| `world/` | 261 |
| `runtime/` | 179 |
| `look/render.ts` | 40 |
| G294 | 40 |
| other | 38 |

The key finding is that **58 % of Sky's custom code is data written in TS**. 238 of those lines are reached only by generators today.

## Ranked table (easy, non-AssemblyScript wins first)

| # | File or group | Counted | Technique | Est. cut | Effort | Needs | AS |
|---|---|---:|---|---:|:-:|---|:-:|
| 1 | **Build-only data** (20 files, no runtime importer): `skyIsles` 41, `isletDesign` 35, `liftPrompts` 33, `rocDecision` 33, `swardAtlas` 13, `stormNoise` 12, `moverViews` 10, `audio` 8, `creatures` 8, `modes` 7, `keeperFigure` 6, `ledger` 6, `trees` 6, `falls` 4, `state` 4, `isleLook` 3, `millShape` 3, `bookStand` 2, `islets.generated.ts` 2, `crownScene.generated.ts` 1, `fanGeometry` 1 | 238 | build-only → `generators/` (G467) | 238 | S | Fix the import paths in about 30 generators. Update the `generation-jobs.json` input paths (strings/bookStand/storm rows, etc.) and the `lint/ratchet.json` keys. Update the paths in tests `sky-storm-noise` and `sky-crown-scene`. Change the `islets.generated.ts` producer's type import. | no |
| 1b | `sdk/modes.ts#ModeRows` (G294) | 1 | Drops for free: `data/modes.ts` stops being a root once it moves. | 1 | S | comes with #1 | no |
| 2 | GLSL patch string in `generators/creatureLooks.ts` | 7 | looks → look JSON: the patch text moves into a `data/*.json` that the generator reads | 7 | S | none | no |
| 3 | Discovery bindings `data/budgets` 23, `budgetCeilings` 12, `devPoses` 11 | 46 | data TS → JSON emitted by a generator. The manifest bindings point at `.json`, as `navigation.generated.json` and `mapPalette.generated.json` already do. | 46 | S | `generators/product.ts` reads the cost from `generators/` | no |
| 4 | `data/meadowLook.ts` (`MEADOW`, `SWARD`, `meadowCard`) | 31 | data and static card geometry → `meadow.generated.json`. `generators/meadowBlades.ts` already imports it; it would also emit the tile, layers, lods and the two card buffers. | ~29 | S | `world/meadow.ts` reads the JSON (+2 lines) | no |
| 5 | `data/windLook.ts` 10, `data/rayWakeLook.ts` 8 | 18 | data TS → JSON; `UPDRAFT_AXIS` is resolved at build | ~16 | S | A single `as EffectFieldRow` / `as WakeRibbonRow` cast, following the `world/baked.ts:31` precedent | no |
| 6 | `world/dressing.ts` 4, `world/shack.ts` 4, plus the shack/dressing branches of `world/baked.ts` (about 6) | 14 | thin wrapper → the generator writes `look: 'shack-plank'` or `'dressing-clump'` into the `worldRows` kinds. `baked.ts` already resolves `'look' in kind`. | 14 | S | `generators/shackKit.ts` takes the `ShackKind` type | no |
| 7 | `data/routeScene.generated.ts` 7, `groundScene.generated.ts` 2, `millScene.generated.ts` 1 | 10 | generated TS → generated JSON | ~8 | S | A typed read (`PrivateScene` cast) in `world/build`, `shapes` and `mill` | no |
| **8** | **Runtime rows chain** (23 files): `brains` 40, `strings` 30, `spawns` 29, `population` 25, `rocFight` 24, `species` 23, `heldWeapon` 22, `items` 22, `fanView` 19, `runtimeRows` 18, `fanContacts` 15, `moverBindings` 14, `nativeMelee` 14, `gearModels` 12, `nativeWorld` 12, `runtimeBoot` 12, `strikes` 10, `equipment` 6, `variants` 6, `meleePhase` 5, `icons` 3, `layoutTypes` 3, `cues` 1 | 365 | **data TS → JSON read by the shared `HybridRuntimePlugin.rows()`**. All 23 files are pure data plus build-time parses (`parseBossOwnerRow`, `parsePersistedQuestPage`, a valibot tuple fix). They move to `generators/runtimeRows.ts`, which emits `runtimeRows.generated.json` (or a `runtime/hybrid` section). The runtime readers switch to rows: `runtime/index.ts` (`weapon`, `encounters.id`, `strings`, `clientMotion.nativeOwners`, the gale-wall strike by id), `world/build` (strings passed in), `world/meshes` (raw rig JSON) and `models/gear` (catalogue rows in the same JSON). | ~360 | M | **Signal is the second user**: `sunscar-dunes/data/runtimeRows.ts` and the same file family. Route (a): a `runtime/hybrid` section with a schema (~+150 platform lines), landing with Signal in the same commit set; otherwise G294 charges it to Sky. Route (b): JSON type-checked at build (`satisfies HybridRuntimeRows` in the generator), one cast in the plugin, 0 platform lines. | no |
| 9 | `data/skyLook.ts` 20, `data/skyPaintedLook.ts` 18 | 38 | data TS → JSON plus a painted-look row admission | ~36 | M | A shared row schema with Signal's `data/lastLight.ts` (both use `engine/render/dataLook#paintedLook`) | no |
| 10 | `world/storm.ts` 24, `data/storm.ts` 2 | 26 | looks → graph JSON: a time-hashed flash uniform on `storm-ring`, with the bolts shown from the graph. This follows the storm-FX graph precedent `9cfdf3e46`. Placement goes into the rest-scene rows. | ~24 | M (Opus) | Similar-not-identical is the bar (G415). Loses the cosmetic `strike(delay)` hook. | no |
| 11 | Props-tile path: G294 `runtimeWorld.ts#bindRuntimeProps` 30, `RuntimePropsPorts` 4, `isMesh` 1, `runtimeProduct.ts#bindRuntimeProductProps` 4, `world/isle.ts#adoptIsleTile` ~8, `runtime/index` ~3 | ~50 | static geometry → the islands become baked kinds on the existing `bakedMeshWorld` (`world/baked.ts`), and the Sky-only platform exports are deleted | ~45 | M | An island visual check. No other shard uses these exports (grep). | no |
| 12 | `runtime/index.ts` dressing spins (mill hub, vanes) | ~10 | client channel rows on the existing `bindClientChannels` (clock, `local`/`retain`, flag read) | ~8 | M | A flag numeric-input port | no |

## Running total against the 632 target

| After | Custom | % of 6,779 | Cut so far |
|---|---:|---:|---:|
| today | 1,309 | 19.3 % | 0 |
| #1 + #1b + #2 | 1,063 | 15.7 % | 246 |
| #3 | 1,017 | 15.0 % | 292 |
| #4–#7 | 950 | 14.0 % | 359 |
| **#8** | **~590** | **8.7 %** | **~719 (target met; margin ~87)** |
| #9–#12 (optional) | ~477 | 7.0 % | ~832 |

Without #8, the best case for #1–#7 plus #9–#12 is about 837 lines (12.3 %). **#8 is the one load-bearing item.**

## Batches (G468: each commit deletes whole files and lands their data path in the same commit)

1. **S1, build-only data to generators (about 246 lines, 2 commits):**
   - S1a moves the layout and look build rows: `isletDesign`, `liftPrompts`, `islets.generated`, `skyIsles`, `trees`, `falls`, `isleLook`, `bookStand`, `millShape`, `crownScene.generated`, `fanGeometry`, `swardAtlas`, `stormNoise`. That is 156 lines.
   - S1b moves the section-only rows: `rocDecision`, `moverViews`, `audio`, `creatures`, `modes`, `keeperFigure`, `ledger`, `state`, plus the GLSL patch and `ModeRows`. That is 90 lines.
   - No runtime file changes, so nothing visual moves. The proof is that the product (`data/product.generated.json`) is byte-identical.
2. **S2, view data to JSON (about 113 lines, 1–2 commits):** items #3, #4, #5, #6 and #7. The discovery bindings and the generated scene TS emit JSON. `meadow`, wind and wake rows become JSON. The dressing and shack wrappers are deleted.
3. **M1, runtime rows (about 360 lines, 1 commit):** item #8. It must be **one commit**, because a runtime-reached `data/` file cannot import `generators/` (P0 no-build-time-import). The JSON read and the move of all 23 files land together. If route (a) is taken, it lands beside Signal's matching cut, so the host has two users the moment it exists.
4. **M2, optional margin (about 113 lines):** items #9 (shared with Signal), #10 (an Opus graph), #11 and #12.

The order is S1, then S2, then M1, then M2. S1 and S2 are mechanical and can start now. M1 should be coordinated with the Signal plan, because the host is the same `HybridRuntimeRows`.

## What stays (view code, about 470–590 lines)

| File | Lines | Why it stays |
|---|---:|---|
| `runtime/index.ts` | ~118 | Page lifecycle (build/install phases, paced `worldBuildYield`). Gust effect-field bursts on the fan's `onGust`, the ray-wake wiring, the gale-wall telegraph (reads live `populationControl` windup and aim) and the hover-deck glow by player mode. This is the A10 boundary: native headless assembly cannot own the page lifecycle. |
| `world/build.ts` | ~100 | Ordered scene assembly with op-hitch41/OP5 per-task yields over the generic `createWorldScene`, `createClientScene` and `bindWorldSceneParts`. A generic "scene sequence" host would need Signal's `world/build.ts` (107 lines) as its twin. That is a later M/L row, not needed for 10 %. |
| `look/render.ts` | 40 | Painted look assembly (dome, cards, discs, LUT). It shrinks only with #9. |
| `runtime/looks/wakeRibbon.ts` | 30 | Per-frame camera-facing ribbon. It is generic in shape, but it has no second user (Nalati Reins is a different contract). |
| `world/meadow.ts` | ~27 | Instanced blade LOD chunks from the baked bytes. |
| `world/storm.ts` | 24 | Stays unless #10 lands. |
| `world/shapes.ts` 22, `world/mill.ts` 13, `models/gear.ts` 11 | 46 | Explorer specimens and route ports. |
| `world/isle.ts` | 21 | Stays unless #11 lands. |
| `world/baked.ts` | ~22 | Baked piece loading. |
| `world/meshes.ts` | 18 | Model libraries. |
| `runtime/looks/discLayer.ts` | 16 | One user. |
| `weapons/fanModel.ts` 7, `plugin.ts` 7, `roster.ts` 6, `runtime/weapons/heldFan.ts` 5, `runtime/source.ts` 3 | 28 | Entry and fan owners. `source.ts` follows Z1. |
| `data/placeholder.ts` | 3 | A cross-shard bake convention read by `scripts/bake/placeholderShards.mjs`. |
| G294 props exports | 39 | Stay unless #11 lands. |

## Verdict

- **Yes, Sky can reach 10 % without AssemblyScript.** S1 + S2 + M1 take it to about 590 (8.7 %); adding the optional M2 makes it about 477 (7.0 %).
- **AssemblyScript changes nothing.** Sky's single-shard sim already moved out: `roc.as` and the shared hosts (KS2 rows). Every remaining counted line is either data written in TS or listed view code (A10). That leaves no G470 logic to move, and the AS budget stays at 53 of 677.
- **The risk is #8.** If the runtime-rows reader takes route (a) and Signal does not land in the same commit set, about 150 platform lines are charged to Sky. That would leave it at about 740 (10.9 %). Route (b) has no platform growth and is safe on its own.
