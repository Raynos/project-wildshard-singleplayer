# Plan: BAKED-WORLDS: the build writes finished meshes and colliders, the phone only uploads them

**State:** `parked (draft, 2026-10-28): starts on Jake's word (G866); outside SHARD-PLATFORM`

Jake, 2026-10-28 ~18:05 Cancun, loading grill: *"Plan it as a draft park outside of shard platform."* (G866, in
[shard-platform/decisions.md](shard-platform/decisions.md)). Read at HEAD ef860948ef. Sources: the phone-speed recording
([phone-loading 10-28](../../project/archive/2026-10-29-phone-loading.md),
[numbers](../../art/loading/round-1-phone-speed/numbers.md)), its raw `wildshard.prepare` marks, and a Pine road-entry
run at Chromium CPU 4× (1618c6730f, 10-28).

## Summary

1. Driftwood's Home region `grid.prepare create` takes 20.7 s cold / 10.2 s warm at CPU 10×. Only ~2–3 s of the warm
   10.2 s is assembly a bake can remove. The rest is GLB decode, waits and yields (PL2, PL5), shader programs and session state.
2. Much is already baked: terrain, navmesh, grid seam plans and strip meshes, the Blender cove, scene welds, quantised
   meshopt GLBs. What's still built at runtime: whole fixed draws glued back from tiles, the per-tile triangle sort, stage merges, colliders.
3. Estimate: Driftwood −1.8 to −2.8 s warm, −1.5 to −2.8 s cold if the bytes don't grow. Pine −1.5 to −2.5 s.
4. The bake has to be pixel-identical and default-off behind one Debug row until an Opus 24-camera check says so (G848).
5. Recommendation: stay parked until PL1–PL16 land, then BW1 measures bytes vs seconds per shard and Jake decides.

## What Home region builds at runtime today (Driftwood, phone profile, s)

| Part (mark) | Where | Cold | Warm | Inputs |
|---|---|---:|---:|---|
| Native foundation: Rapier shell, navmesh, level look, ground | `grid/regionalWorld.ts:308`, `:335` | 1.6 | 1.1 | baked terrain + navmesh |
| World looks (materials, programs) | `shardfile/clientPlan.ts:519` | 0.9 | 0.5 | look graphs |
| Scenes: owned-model GLB intake (cascade 4.3 / 0.5) | `shardfile/worldScenes.ts:375` | 5.6 | 1.2 | ~70 model GLBs |
| Scenes: welds, placement, materials | `worldScenes.ts:179`, `:466` | 0.8 | 0.8 | weld files (already merged) |
| Water, Blender cove (`world.baked`), quest reference | `shardfile/bakedTiles.ts:221` | 1.0 | 0.9 | cove tiles, lightmaps |
| Fixed draws whole: decode L0 tiles + whole library, reassemble draws, bounds | `plugin/geometry.ts:1995`, `models/islandLibrary.ts:104` | 4.8 | 1.7 | 17 L0 tiles (5.7 MB) + 76 library GLBs (8.6 MB) |
| Construct stages (piers … smallRocks: merges, rope deck, gulls, cover) | `shardfile/worldAssembly.ts:257` | 0.5 | 0.5 | fixed draws |
| Untimed tail: per-tile triangle sort, spawn tiles, far stand-in | `shardfile/clientWorldAssembly.ts:112–119`, `tiledMesh.ts` | 2.4 | 0.7 | built meshes |
| Bindings, creatures, held, paths, quest composition, play | `plugin/*`, `quest/*` | 2.6 | 2.3 | save, session RNG |
| Gaps and yields between marks | | ~0.5 | ~0.5 | |
| **Total `grid.prepare create`** | `grid/live.ts:366` | **20.7** | **10.2** | |

Before Home region, row 11 World assembly (4.0 / 2.2) loads the baked strip page (`grid/session.ts:433`, 2.4 / 0.7) and
builds 40 seam trimesh colliders in Rapier (`session.ts:499` → `engine/physics/meshCollision.ts:11`, 0.9 / 0.9). The road
system takes 0.4 s. The fixed-draws phases overlap (`whole.read-wait` 4.5 / 1.5), so decode and glue can't be split from
marks alone (BW1 profiles them).

**Pine (Chromium 4×, road-entry cold, create 14.1 s):** foundation 1.1, tree factory 0.5 (de-quantises meshopt trees on
the CPU, `engine/world/forest/treeSet.ts:34`), forest page 4.0 (scenes 1.1, props tiles 1.2 at `shardfile/forestPage.ts:137`),
afterKit 1.2 (no marks), play 1.0, then afterPlay 6.0: 484 shader programs (2.4) and 28 MB of uploads (1.7). At 10×,
multiply the CPU parts by ~2.5 (an estimate, not a recording).

## Bakeable or not

| Part | Bake? | Ships as | Bytes vs today | Stays runtime |
|---|---|---|---|---|
| Fixed draws whole | **yes** | the original draws, quantised + meshopt GLB per tier, bounds in the row | ≈ same if a baked draw **replaces** its L0 tiles; +5.7 MB if both ship | GLB decode, GPU upload |
| Per-tile triangle sort (`tiledMesh`) | **yes** | per-draw tile index ranges, sorted index buffer | +~1 % | which tiles are resident (player position) |
| Construct-stage merges | **yes** | merged static meshes in the same GLBs | ≈ same | rope deck motion, gulls, movers |
| Scene welds | already baked | weld files | — | binding to looks |
| Owned models, instanced parts | **no** | stay instanced | baking would multiply bytes and GPU MB | decode |
| Cove placement poses, collider boxes | partly | pose table in the cove row | +KB | lightmap decode, live sun bounce |
| Colliders (home, seams) | **arrays only** | flat vertex / index arrays per collider | ≈ same | Rapier BVH build (snapshot is Q4) |
| Pine props tiles, tree de-quantise | partly | tile ranges; float tree streams | trees: +2× tree bytes | tree LOD fade, wind |
| Terrain, navmesh, seams, strip meshes | already baked | — | — | — |
| Looks, shader programs, uploads | **no** | — | — | GPU work (PL6) |
| Quest, creatures, held, save, continuation | **no** | — | — | player and session state |

The bake is a plain script (`scripts/bake-world.mjs`) run by `build-shardfiles` per shard and tier. It writes product
blobs into `out/` and is never committed (STORAGE: 10 MB of binary a push), with no Vite plugin (G799). Precedent:
`scripts/bake-grid-seams.mjs` already runs game code (`GridAssembly`, `compiledStrips`) in Node.

## Interactions

- **Tile streaming:** a baked draw carries its tile ranges, so fine tiles stay one draw each, compacted. Coarse (L1)
  tiles and far stand-ins are unchanged. The L0 tiles of a baked draw are dropped from the product, never shipped twice.
- **I2 byte ratchets (G821: DW 30.8, Nine 19.2, Nalati ~55, Pine 77.5 MB):** a bake that grows a shard's bytes trips its
  ratchet. Each MB costs 0.8 s cold at 10 Mb/s if it's on the critical path. Jake decides (Q1).
- **Memory (1.8 GB loading, 1.2 GB per shard):** loading peak should fall, with no decoded tile copy beside the glued output.
  GPU MB stays flat only if nothing instanced is merged. BW8 measures both.
- **Rapier:** `src/engine/physics/` stays the only Rapier import. The bake hands it arrays, and the physics walk
  (`physics-baseline.mjs --mode=walk`) must report 0 stuck.
- **Phone tier:** baked per tier (`file[TIER]`). The phone downloads only its own.
- **G848 / goldens:** the bake emits meshes, so it counts as visual. It ships default-off behind one Debug row, "World build: A
  assembled / B baked". Opus runs the 24-camera capture (`art/legacy-goldens/compare/capture.mjs`) for A and B per
  shard and needs identical frames. The LEGACY goldens already differ from SHARDFILE, so the bar is "B = A", then
  `art/shardfile-goldens/` once G859 makes them.
- **PL14 (cached home region) and PL15 (workers)** go after the same warm seconds for the home shard. Measure after them.

## Rows

| Row | What | Owner | Size | Done when |
|---|---|---|---|---|
| BW1 | **Measure first:** a Node script runs each heavy shard's home build headless and writes, per part, output bytes (quantised + meshopt) vs today's inputs, plus one 10× CPU profile of `create` that splits decode from glue | Codex | M | a bytes-vs-seconds table per shard (DW, Pine, Nine, Nalati) in this plan; Jake answers Q1–Q5 |
| BW2 | **Split build from install:** the geometry half of `readWholeGeometry`, `WorldAssembly` stage merges and `tiledMesh` becomes pure functions callable in Node (no renderer, no scope) | Codex | L | geometry hashes equal before / after in a test; A captures unchanged (Opus check); `pnpm phone-loading` ±0.3 s |
| BW3 | **Bake fixed draws:** `bake-world.mjs` writes each shard's original draws per tier; row B reads them instead of L0 tiles + whole library | Codex; Opus check | M | DW warm Home region −0.8 s, cold not slower, on `pnpm phone-loading` (G862); 24 cameras B = A |
| BW4 | **Bake tile ranges:** sorted index buffers and per-tile ranges in the baked draws; runtime only compacts | Codex; Opus check | M | DW warm −0.4 s; T4 residency unchanged; 24 cameras B = A |
| BW5 | **Bake stage merges:** construct-stage static merges and cove poses; instanced parts stay instanced | Codex; Opus check | M | DW warm −0.3 s; gpuMB not up; 24 cameras B = A |
| BW6 | **Collider arrays:** home and seam colliders from baked flat arrays, handed to `engine/physics/` | Codex | S | collider-join −0.2 s; physics walk 0 stuck |
| BW7 | **Pine and Nine:** forest props tile ranges; Nine's library draws; tree streams only if Opus finds them identical | Codex; Opus for trees | M | Pine warm −1.5 s on `pnpm phone-loading --flow=select:pine-hollow`; 24 cameras B = A |
| BW8 | **Budgets:** I2 ratchets per Q1, loading and playing memory per shard, gpuMB | Codex | S | no ratchet tripped without Jake's Q1 allowance; ≤ 1.8 / 1.2 GB per shard |
| BW9 | **Flip and delete:** Opus 24-camera check per shard, Jake's phone A/B, then the row and the losing path go (E451) | Opus | S | Jake picks; one commit removes the row and the runtime glue for baked shards |

## Risks

- **Not pixel-identical:** Node and the browser can round differently, and a different quantisation grid moves vertices. Mitigation:
  the same functions (BW2) and the same quantiser; a geometry hash test; the 24 cameras before default-on.
- **Bytes grow:** shipping baked draws beside the L0 tiles, or merging instanced parts, adds MB the phone pays cold. Rule: a
  baked draw replaces its inputs, and nothing instanced is merged.
- **Small prize:** after PL2 (waits), PL5 (yields), PL14 (cached region) and PL15 (workers), the bake's own share may
  be ~1–2 s warm. BW1 decides whether it's worth the second path.
- **Two paths for a while:** A and B coexist only until BW9. Stale bakes are avoided because it's a build output keyed by input hashes
  (`bake-input-hashes.mjs`, `shardfile-cache.mjs`).
- **Build time:** adds Node seconds per shard per tier to `build-shardfiles`; cached by input hash.

## Questions for Jake

1. **May a bake raise a shard's I2 byte ratchet (G821)?** A: never; B: up to +10 % per shard when it saves more seconds
   than its bytes cost at 10 Mb/s; C: no limit. **Recommend B.**
2. **Who builds it under G848?** A: Codex builds the pipeline default-off, Opus proves B = A and flips; B: all Opus.
   **Recommend A** (Codex never lands a visible change).
3. **When?** A: after PL1–PL16 land and `pnpm phone-loading` re-measures; B: now, in parallel. **Recommend A.**
4. **Colliders:** A: baked arrays, Rapier builds its tree at runtime; B: a Rapier world snapshot per shard (tied to the
   Rapier build, all or nothing). **Recommend A.**
5. **Which shards first?** A: Driftwood (home) only, then decide; B: DW, Pine, Nine, Nalati together. **Recommend A.**

## Out of scope

- **One-world (G828):** crossings, per-member product admission, one loader for the whole grid. That plan is Jake's, and
  nobody drafts it. The bake writes plain product files, so a later loader can reuse them.
- Shader programs (PL6), product admission (PL4), the reveal (PL12, G867), and any SHARD-PLATFORM row.
