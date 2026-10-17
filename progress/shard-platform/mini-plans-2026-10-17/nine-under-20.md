# Nine Dragon Stack under 20 %: mini plan and feature brainstorm

Read-only planning page for `src/shards/nine-dragon-stack/`, made on 2026-10-17 (~06:40 Cancun). It uses the same
counting method as the Pine and Driftwood plans. The sibling plan covers Nalati.

**Basis.**
- Ruler at `93a250445` (10-17 05:31): **12,555 custom / 21,111 legacy = 59.5 %**.
- Today, measured on the live tree at HEAD `1f49c4b41`: **11,957 custom = 56.6 %**. That is 11,393 shard TS, 1 GLSL
  line and 563 platform lines only Nine reaches.
- HEAD without uncommitted work is **≈ 12,185 (57.7 %)**. The ≈ 229-line difference is in-flight lane work in the tree:
  - sp-x1: `manifest.ts` 56 → 27 lines, and `budgets.ts` → `data/budgets.ts`.
  - sp-x4: `boot/headlessModules.ts` deleted, and the `game/plugin/simulation.ts` proof charge (~143) removed.
  - `mockupCameras.ts` → `generators/`, and `data/placeholder.ts` → JSON.
- This plan starts from 11,957 and assumes that in-flight work lands.

**Targets.**
- 20 % target: **≤ 4,222**, so the cut needed is **≥ 7,735**.
- AssemblyScript ceiling: 2,111 lines. Nine has 0 lines of AssemblyScript today.

## Verdict

**Yes. Nine can reach 20 % without AssemblyScript, but only with new platform features.** Nine is the opposite of Pine
and Driftwood:
- It has almost no single-shard gameplay logic: no quest, creatures, bosses, contracts or roster.
- About 2,600 of its lines are GLSL in TypeScript strings.
- About 2,000 more are generic presentation or traversal modules. They say "nothing here knows a shard", but they were
  pushed into the shard because Nine is their only user (H1).

| After | Nine custom | % | Cut so far |
|---|---:|---:|---:|
| Today (live tree) | 11,957 | 56.6 % | — |
| **Step 1:** easy and medium wins (data, generators, bakes, look graphs, catalogue rows, existing hosts) | ≈ 7,320 | **≈ 34.7 %** | 4,640 |
| **Step 2:** approved G473–G477 features (25 % held back) | ≈ 6,050 | **≈ 28.6 %** | 5,910 |
| **Step 3:** five new generic features (25 % held back) | ≈ 3,680 | **≈ 17.4 %** | 8,280 |

What step 3 has to deliver:
- After step 2, step 3 must cut at least ≈ 1,825 lines.
- Two features together are **not** enough: **grapple tool (824) + post chain (796) = 1,620**.
- Add **verlet strands (362)**, or **portal ride (199) + emitter lights (190)**, and Nine passes 20 %.
- If the uncertain step 2 items fall through (streamed cover 269, pending marks 104), all five new features are needed.
  The margin is then ≈ 170 lines.
- AssemblyScript is optional. The only single-shard laws left are about 150 lines:
  - the Well-rail sight rule (`grapple/sim.ts`);
  - the ring exit-road policy;
  - the Jian combo gap.

  They could go to AssemblyScript to buy margin, well inside the 2,111 ceiling.

**The gating dependency is a platform bug, not a feature.** `9190f1569` reverted the portal look graphs. On the phone
frame with post on, graph output gets an extra display encode: low channels rise 30–40/255. The `nine-lantern` paper
graph shows the same lift. Every emissive look-graph batch in step 1 (≈ 2,130 lines) waits on that fix, and so does the
step 3 post chain. Fix it first.

## How the lines were counted (reproduced, read-only)

These are the `scripts/shard-platform.mjs` rules (`countOutput(..., sourceProgress=true)`), the same as in the Pine and
Driftwood plans.

**Counted:**
- every `.ts`/`.tsx` under the shard, as non-blank lines after the parser removes comments (`codeLines`);
- GLSL inside TypeScript strings, because it is lines of the `.ts` file;
- `data/*.ts`, even when it is generated;
- G294 platform declarations that only Nine reaches.

**Not counted:**
- `generators/` (G467), tests, `.d.ts` and `.as` files;
- `manifest.ts` and `shard.config.ts`, but only when declaration-only;
- generated outputs (`ktx2.generated.ts` is ignored);
- JSON.

**Reproduced two ways, with nothing written:**
1. An in-process call of the exported `sourceProgressInventory()`, with `WS_SHARD_PARSE_CACHE` unset (the only write
   path, `cachedSourceInfo`, is off). No CLI and no generate step. It took 5.6 s, twice, with the same result:
   **Nine 11,957**.
2. My own per-file counter: the ruler's exported `codeLines` / `declarationOnlyManifest` / `declarationOnlyConfig` run
   over `git show HEAD:<file>` for every shard file. It gave **11,479** at HEAD, against **11,393** live; the
   difference is exactly the in-flight files above.

**The 563 platform lines Nine alone reaches (live):**

| Lines | Declaration | Leaves with |
|---:|---|---|
| 205 | `game/systems/viewmodel/armRig.ts` (sole module: two-bone arm, wrist and joint measurement) | Step 2, held arms |
| 239 | `game/plugin/mover.ts`: `GrappleSim` 124, `nearestHook` 20, `landingFor` 19, `GrappleCourse`/`GrappleEvents`/`grappleApproachFor` 9 each, `grappleStandable` 8, 16 one-liners | Step 3, grapple tool |
| 83 | `engine/audio/AmbienceBeds.ts` (sole module) | Step 2, pending mark (pick) |
| 15 | `engine/audio/Cues.ts#CuePlayer` | Step 2, pending mark (pick) |
| 9 | `sdk/entries.ts#Portal` | Step 3, portal ride |
| 12 | `inState`, `copiesAt`, `bakedGeometry` / `canvasAtlas` / `shaderFamily` one-liners, and 1 GLSL line in `generators/bakeWrite.ts` | Mixed |

**Importers.** I mapped imports of every counted file across `src/`, `scripts/`, `test/` and `lint/`, and checked
`data/headlessAssembly.json` and `data/placeholder.json` for module references.
- **Build-only** (only generators, tests or bake inputs reach them): `look/far.ts`, `assets/contracts/signPlacement.ts`,
  `modelPlacement.ts`, `tangentRows.ts`, `data/casts.ts`, `data/words.ts`.
- **Not dead, though nothing in the shard imports them:** `runtime/grapple.ts`, `runtime/jian.ts` and
  `runtime/portals/hostRide.ts` are headless-assembly modules.
- **Dead code:** none found. Nine has no LEGACY entry and no harness URL params.

## 1. Easy and medium wins: no AssemblyScript, no new feature

Effort: S is under half a day, M is 1–2 days, L is up to 5 days. "Est. cut" already keeps a remainder per file. The two
L groups (1e graphs, 1g world rows) also carry a further 15 % hold-back.

| # | File or group | Counted | Technique | Est. cut | Effort | Needs |
|---|---|---:|---|---:|---|---|
| 1a | `look/far.ts` 36, `assets/contracts/{signPlacement,modelPlacement,tangentRows}.ts` 62, `data/casts.ts` 9, `data/words.ts` 7 | 114 | Build-only, so move to `generators/`: far look → `generators/farLook.ts` (Sky precedent) and repoint `data/placeholder.json`; contracts and bake rows follow their generators | 114 | S | nothing |
| 1b | `data/signs` 145, `cloth` 75, `specimenProfiles` 68, `arms` 39, `facadeModels` 35, `specimenDims` 22, `weaponLooks` 18, `budgets` 17, `floorPlan` 13, `layoutPlan` 13, `ledger` 11, `worldDressing` 11, `lod` 6, `aoLook` 4, `modes` 3, `decks` 2; `shard.config.ts` 24; `layout.ts` 26; `util.ts` 13; `terrain.ts` 13 | 558 | Data in TS → JSON rows, with row types in generated `.d.ts` (Pine's `layout.generated.d.json.ts` precedent). `shard.config.ts` → `export default product` from `generators/product.ts` (Sky/DW precedent), and its 5 runtime importers read `ctx.product.shardfile`. `layout.ts` and `util.ts` stop re-exporting: importers read the JSON. `terrain.ts` → a flat-datum terrain row | 492 | S | `authored-manifest.mjs` accepts a JSON budget (DW #6) |
| 1c | Runtime valibot parses of build-validated JSON: `world/layoutBake.ts` ~50, `world/casts.ts` ~15, `plugin.ts` ~20, `neonText` ~10, `world/jian.ts` ~10, `runtime/geometry.ts` ~10 | ~115 | Schemas to `generators/`; reads go through the typed custom-section reader | 115 | S–M | Pine/DW batch 3 platform reader (`ShardProduct.section` with no runtime schema) |
| 1d | **Static bakes:** `vertexSpill` 174, `lightVolume` 95, `meshLod` 83, `paintArray` 79, `kitConvert`/`kitMeshes`/`kitSet` 115, `weave` 48, `mistGeometry` 46, `lutTexture` 31, `edgeDecks` 31, `emitterCards` 19, `runtime/signs/neonText.ts` 161 | 882 | Build-time work moves to generators:<br>• `aSpill` baked into the layout GLBs (the open-x Simulator row already names this; ≈ +14 MB download, not a reason to hold, G438)<br>• the 3D irradiance volume baked at build<br>• meshoptimizer LOD copies baked into the cast/hook/lion GLBs<br>• kits as baked per-kit meshes<br>• the paint array shipped as a KTX2 texture array for the graph `textureArray` param<br>• the weave texture baked as an R8 image<br>• the LUT read by the engine's `loadLUTFile`<br>• mist sheets/puffs, emitter cards and the neon board/tube geometry baked with the sign-atlas bake (`ff8b90f61` precedent) | 695 | M | Bake scripts (not counted); one parity run per batch |
| 1e | **Looks → graph JSON** on the existing `look.materials` graph host (ops include `textureArray`, `loop`, `fwidth`, `attribute`, outline places, `post`):<br>• architecture: `look.ts` 803, `facadeLook` 577, `light` 220, `paint` 113, look glue 126<br>• cards: `streaks` 211, `reflectionCards` 78, `canopy` 181, `cardCanopy` 70<br>• `scroll` 101 + `look/scroll` 42 + `wrappedTexture` 16<br>• portals `portalLook` 61 + `world/portals` 25 (re-land `ec95ed40d`)<br>• viewmodel `vmLook` 309, `heroVm` 145<br>• `burstFx` 179 → **effectField burst rows** (the SDK already has seeded burst fields)<br>• GLSL in `ropeFilament`, `brushTrail`, `vm/fpArms` | ≈ 3,290 | Rewrite GLSL as graph JSON, authored by a TS generator in `generators/` if wanted (not counted). Per-frame drivers stay (`setLentParam`, `syncSilkFog` style) | **≈ 2,130** | L (Opus) | **Display-encode fix (P0).** A `sampler3D` / `texture3D` graph op (+~20 platform) for the light-volume and LUT taps. Graph sub-programs for the shared splices (`FOG_GLSL`, `NOISE_GLSL`) are composed in the generator |
| 1f | **Explorer models:** `models/*` 533, `world/modelLook.ts` 60, `runtime/signs/signModel.ts` 57 | 650 | `defineModel` registrations → specimen-catalogue rows (DW #12, Nalati precedent): the catalogue lists the baked specimen geometry, params, variants and colliders | 450 | M | A catalogue material that names a lent graph look (+~20 platform) and the `fixed` draw source DW #12 also needs |
| 1g | **World assembly on existing hosts:**<br>• `world/build.ts` 303, `layoutBake` (rest), `facade/*` 163, `ctx` 53, `kit` 14, `sets` 25<br>• `squareProps`/`props3d` 98 (W3 `ModelPlacementBatch` row)<br>• `floorRows` 30 (W3 `floorAtRects` row)<br>• `specimens` 32 + `runtime/geometry` (W3 `ownedGeometry` row)<br>• `crowd` 62, `colliders` 28, `wellBounds` 20, `moverCopies` 27 (declared movers)<br>• `plugin.ts` world-install pieces, `state.ts` 47, `casts` (rest) | ≈ 1,350 | After 1e and 1f: the world becomes world-scene / `bakedMeshWorld` rows with graph material keys. The **W3 Nine rows** land here: `BuildStages`, `ModelPlacementBatch`, `floorAtRects`, `ownedGeometry`. Crowd dealing and collider boxes move to the bake | ≈ 590 | M–L | 1e and 1f first; phone frame check (the instance culler stays until step 2) |
| 1h | `runtime/audio/ambience.ts` 85, `runtime/audio/cues.ts` 35 | 120 | Rect-distance blend → `AmbienceZones` rows. Cue recipes → shardfile cue aliases | 55 | S | nothing |
| | **Step 1 total** | | | **≈ 4,640** | | Platform +~60 (3D op, catalogue look family; the section reader is shared with Pine/DW) |

### Batches (G468: each commit deletes whole runtime files and lands their data path; parity once per batch)

| Batch | Contents | Cut | Nine after | % |
|---|---|---:|---:|---:|
| B1 | 1a build-only, plus `data/signs`, `cloth`, `specimenProfiles`, `arms`, `facadeModels`, `weaponLooks` → JSON | 440 | 11,517 | 54.6 |
| B2 | The rest of the data → JSON, `shard.config` declaration-only, `layout`/`util`/`terrain`, 1c schemas (after the Pine/DW section reader) | 285 | 11,232 | 53.2 |
| B3 | Bakes I: `aSpill` in GLBs, irradiance volume, weave, LUT on the engine, emitter cards, mist geometry, neon board/tube geometry | 460 | 10,772 | 51.0 |
| B4 | Bakes II: LOD copies, kits as baked meshes, paint array as KTX2, edge decks as rows | 235 | 10,537 | 49.9 |
| — | **Platform P0:** fix the graph display-encode lift (`9190f1569`), add the `sampler3D` graph op | — | — | — |
| B5 | Portal graphs re-land (`ec95ed40d`), scroll, fog bands, `burstFx` → effectField burst rows, the rope/brush/arm GLSL | 400 | 10,137 | 48.0 |
| B6 | Wet-ground streaks and reflection cards; banyan card canopy | 324 | 9,813 | 46.5 |
| B7 | Viewmodel toon and ink-hull graphs (`vmLook`, `heroVm`) | 327 | 9,486 | 44.9 |
| B8 | The architecture program (`look.ts`) as graphs | 476 | 9,010 | 42.7 |
| B9a | Facade program (`facadeLook`, interior-mapped windows) | 375 | 8,635 | 40.9 |
| B9b | Light, paint and the small look glue files | 239 | 8,396 | 39.8 |
| B10 | Explorer models → specimen-catalogue rows | 450 | 7,946 | 37.6 |
| B11 | World rows I: W3 `ModelPlacementBatch` / `floorAtRects` / `ownedGeometry` / `BuildStages`, baked crowd, colliders, movers | 290 | 7,656 | 36.3 |
| B12 | World rows II: `build.ts` / `layoutBake` / facade batch / `ctx` / `plugin` / `state` remainder, audio hosts | 339 | **7,317** | **34.7** |

B1–B4 and B11–B12 are non-graphical code work (Codex). B5–B10 are look and model work (Opus), with a board only when a
batch changes what you see (G468).

## 2. Reuse of the approved features (G473–G477; 25 % held back)

Nine has no quest, spawns, boss, contracts, elites, quadrupeds, weather or collections. So **quest step runner, spawn
director, boss fight host, contracts + elites, quadruped rig, weather + keyed sky and collections absorb nothing from
Nine**. Each line below already has its 25 % taken off.

| Approved feature | Nine files it absorbs | Lines | × 0.75 | Confidence |
|---|---|---:|---:|---|
| **Held viewmodel arms + loadout/skins**, with the **toon look host** for the ink-hull and class-palette binding | `runtime/viewmodel/fpArmsRig.ts` 334 (the W3 `RigArms` row), `armRig.ts` charge 205, `vm/fpArms.ts` 135 (not its GLSL), `vm/arms.ts` 41, `world/jian.ts` 31, `runtime/jian.ts` 34, `brushTrail` 76 (held blade trail as a held-row effect on `SlashTrail`), `inkedRig` 40, `vm/materials` 41, `world/hero/vm-material` 38, the Jian equipment block in `plugin.ts` ~30, `grapple/row.ts` 7 | 1,012 | **761** | High. DW `toonArms.ts` already runs on `RigArms`; Pine lever/crossbow arms are the third user |
| **Streamed cover**, if its host also owns per-instance cull and LOD dealing for static instanced batches | `runtime/cull/instanceCuller.ts` 225, `figureCrowd` 111, `handedBatches` 12, `placedDraws` 11 | 359 | **269** | Medium-low: the honest floor says the allocation and LOD ownership differ from DW's cell streamer. **Pick 3** |
| **Living buildings** (lanterns, site lights) | `runtime/looks/hangingLanterns.ts` 160 (lanterns hung from hooks, near/far/dot draws), `look/lanterns.ts` 21 | 181 | **136** | Medium-low: Pine's swinging lanterns are the model; Nine's ~2,500 lanterns are dressing, not buildings |
| **Pending-user marks** (G474/G475 pattern) | `engine/audio/AmbienceBeds.ts` 83, `Cues.ts#CuePlayer` 15, `inState` 3, `copiesAt` 3 | 104 | **104** | Only with Jake's pick (**pick 2**) |
| **Resident world for every shard** (G476) | Nine adopts it, but no lines are cut | 0 | 0 | — |
| H6 ambient life, weather reactions + keyed sky, toon look (sky/ground) | Nothing: Nine's crowd is static figures, its night is fixed, and its sky is already a graph | 0 | 0 | — |
| **Step 2 total** | | | **≈ 1,270** | |

Nine's resident-world memory: settled desktop Nine is already at **1,214 MB**, above the 1.2 GB report cap (STATE).
Keeping Nine resident behind another shard needs the G476 default-off Debug row and a phone reading.

## 3. New missing features: generic, data-driven, for future shards

The rules match G474: each new feature is platform code from day one, ships with a fixture test driven by a made-up
second shard's rows, has source docs and an ENGINE.md section, and lives in `src/game/` with rows in `src/format/`.

| # | Feature | What it is | Nine files (lines) | × 0.75 | Platform + | Future users | Confidence |
|---|---|---|---|---:|---:|---|---|
| N1 | **Grapple / hook traversal tool** | Hook rows (visibility, approach, landing), aim + line + zip view, course rows, fixed-step sim and headless adapter. It extends the engine's approved `grapple` driven player mode (`@wildshard/engine/player/modes`: *"ride and grapple ship"*) | `mover.ts` Grapple* 239, `grappleAim` 376, `hookCourse` 273, `runtime/grapple` 78, `grapple/sim` 33, `FeiZhua` 54, playground 23, `feats` 19, context 2 = 1,097 | **824** | ~350 (the sim is already platform) | Sky Reach (vertical islands), WorldClaw shards with verticality, Pine crags and lookout; `playerModes.ts` already names grapple as approved | Medium (60 %) |
| N2 | **Walk-in portal ride** | Ring trigger, hold, fade veil and the checked transfer on the existing `portalLink` / `createPortalTraversal` (format and game already admit links; the client has no ride layer). Look as a graph row | `walkInRide` 140, `hostRide` 49, `rideVeil` 13, `portalRide` 18, `portalVeil` 7, `world/portals` 28, `sdk Portal` 9 = 264 | **199** | ~150 | In-shard fast travel on every shard (Pine waystones, DW shrines, Nalati distances), WorldClaw hubs | High (75 %) |
| N3 | **Post chain with scaled targets** | Extends `look.post` (today ≤ 4 full-screen passes, ≤ 1,000 instructions per pixel, no intermediate targets) with declared targets (scale, filter, mip pyramid, half-res trace), pass rows and per-frame uniform bindings. Nine's bleed pyramid, wet-stone reflection trace and lantern haze march become post graphs + rows | `renderPass` 228, `passes` 525, `look/render.ts` 139, `jiehua` 76, `renderEvents` 27, `aoTuning` 31, `uniformScan` 11, light/grade/glow/lightvol/family 25 = 1,062 | **796** | ~250 | Nalati v2 grade + bloom (`look/grade.ts` 97 builds its own `postprocessing` chain), Pine/DW bloom and grade, every WorldClaw style (ink, painterly, toon) | Medium (60 %); needs the encode fix and a phone cost proof |
| N4 | **Verlet strands** | Fixed-step pinned strands and sheets with capsule colliders, rewriting a fixed-topology geometry: held cloth (tassels, sleeves) and lines between moving endpoints (a grapple line, a tether, a fishing line) | `strandCloth` 328, `ropeFilament` 155 (not its GLSL) = 483 | **362** | ~200 | Nalati tassels, banners and horse tack; DW and Pine rope props; fishing; N1 lines. DW `mooringLines.ts` is baked today, so it is weak evidence | Medium-low (45 %) |
| N5 | **Light emitters** | Emitter rows → spill bake (build), irradiance volume (build), wet-plane reflection cards, glow halos and light pools, installed from rows | `look/light/install` 68, `pools` 47, `halos` 42, `reflectionCards` 48, `vertexSpill` 24, `lightVolume` 20, `emitterCards` 4 (the runtime left after 1d) = 253 | **190** | ~150 | Any night scene: Pine lodge and lantern night, Nalati campfires and yurts, DW torches, WorldClaw night markets | Medium-low (45 %) |
| | **Step 3 total** | | | **≈ 2,370** | ≈ +1,100 | | |

Considered but not proposed:
- **An ambience-beds feature:** pick 2's pending mark is cheaper.
- **A figure-crowd host:** it rides with streamed cover, or with N5 if that fails.
- **A separate burst-FX host:** the SDK `effectField` already has burst fields, so it is step 1.

## 4. The path to 20 %

| After | Nine custom | % | Net platform (G466 (9)) |
|---|---:|---:|---:|
| Today | 11,957 | 56.6 % | — |
| Step 1 (B1–B12) | 7,317 | 34.7 % | +~60 |
| Step 2, approved features | 6,047 | 28.6 % | shared with Pine/DW |
| Step 3, N1–N5 | **3,676** | **17.4 %** | +~1,100 |
| Target | ≤ 4,222 | 20.0 % | |

**What stays (≈ 3,680), with reasons:**
- **Graph drivers and look remainders (≈ 1,150):**
  - `look.ts` ≈ 330: the fog bands, the shared uniform table and `uRootAt` per grid cell.
  - `facadeLook` ≈ 210: window instance glue for interior mapping.
  - `light`/`paint`/`style` ≈ 160, `vmLook`/`heroVm` ≈ 130, `streaks`/`canopy`/`cardCanopy`/`scroll` ≈ 220, `look/render` ≈ 95.

  All of this is per-frame parameter writes and draw setup the graph host does not own.
- **World assembly (≈ 620):**
  - `build.ts` ≈ 175: composing the square, the Well, the towers, the crowd and the cull owners.
  - `layoutBake` ≈ 76, facade batch ≈ 57, `geometry` ≈ 45, `casts` ≈ 38, `crowd` ≈ 36, `state` ≈ 38, `ctx` ≈ 32, `drawnInto` 42.

  These bind the baked layout to its draws and owners.
- **Feature hold-backs (≈ 1,250):** the 25 % of N1–N5 and the step 2 features that won't generalise.
  - The Well-rail sight rule and the FeiZhua row (N1).
  - The Jiehua composite's ink silhouette and LUT order (N3).
  - The arms' pendants and capsules and the first-rig policy (held arms).
  - Nine's lantern LOD and dot switch.
- **Signs (≈ 90):** `neonText` ≈ 41 after the geometry bake, `signModel` ≈ 22, `data/signs` ≈ 25 (lettering row types).
- **Glue (≈ 200):** `plugin.ts` ≈ 62 (page install order), `manifest.ts` 27 (sp-x1 may make it declaration-only), audio
  ≈ 65, `tier.ts`, `roster.ts`.
- **AssemblyScript:** none needed. The ≈ 150 lines of real single-shard law (Well rail, exit road, Jian combo gap) are
  optional, as margin.

**Order:**
1. Step 1 is W3 work. Under G471, lanes return to Nine after Pine and Driftwood reach 20 %. B1–B4 are safe today and
   need no feature.
2. The display-encode fix is the first platform row; it unblocks B5–B9 and N3.
3. Step 2 rides the G477 shared-first order: held arms comes early, and its W3 `RigArms` row is already queued.
4. N1–N5 come after the G477 list, unless Jake approves them sooner.

## 5. Picks for Jake

1. **Approve the five new platform features (N1–N5) under the G473 exception** (fixture second shard, docs, Nine as rows
   only). **Recommended: approve all five.** The path needs N1 + N3 and at least one of N4 or N2 + N5. With all five,
   the margin under 20 % is ≈ 550 lines. Without them Nine stalls at ≈ 29 %.
2. **Pending-user marks for Nine's one-user platform audio and model code:** `AmbienceBeds` 83, `CuePlayer` 15,
   `inState` 3, `copiesAt` 3 (−104). This is the same pattern as bolt flight, ripples, fog, the binder and the resident
   world. **Recommended: approve.**
3. **Streamed cover's scope:** let the approved streamed-cover host also own per-instance cull and LOD dealing for static
   instanced batches (Nine's instance culler and figure crowd, −269). Otherwise it stays Nine view code or needs its own
   feature. **Recommended: yes, one host.**

No pick is needed for:
- The `aSpill` bake's ≈ +14 MB download (G438).
- Look parity: graph conversions aim at the same look, similar and not identical (G415), with a board only where a batch
  changes it.
- Nine's resident world: G476 already says default-off behind a Debug row.

## Risks and checks

- **The display-encode lift** (`9190f1569`) blocks ≈ 2,930 lines (1e + N3). Until it is fixed, only B1–B4, B10–B12
  and the non-emissive graphs can land.
- **1e on the architecture program (B8–B9)** is the riskiest:
  - interior mapping;
  - the light-volume tap (needs the `sampler3D` op);
  - texture-array paint;
  - ruled ink by `fwidth`;
  - the silk-fog splice.

  The 15 % hold-back covers some of it. Parity is checked on the phone frame with post on.
- **1d bakes** change download and boot shape: the open-x Nine travel p95 row (the Simulator gate is 35 ms) and the
  late-ring memory (1,214 MB). Measure once per batch.
- **1f and 1g** need the catalogue to wear lent graph looks and to take a `fixed` draw source (shared with DW #12).
  Land them with DW's catalogue change.
- **The in-flight work** (sp-x1 manifest, sp-x4 proof charge, sp-x8 sign atlas) is assumed landed. If it is not, add
  ≈ 229 to every figure.
- **The second users in step 2** are design claims. Each feature's fixture test proves it is generic (G474 (2)). Recount
  after each landing.
