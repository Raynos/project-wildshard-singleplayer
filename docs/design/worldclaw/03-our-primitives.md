# 03 · What a Wildshard shard is made of, and where WorldClaw's pieces land

Pre-normalization code (tag `pre-normalization`, branch `worldclaw`). Every path below exists in this tree. After
GAME-NORMALIZATION lands, the same primitives move under `src/shards/<slug>/` behind a `ShardManifest`. §7 says what
that changes.

## 1. A shard is a standalone level

Driftwood Isle, Pine Hollow, Nalati Grasslands and Nine Dragon Stack are each a **complete level**: their own biome,
look, weapon, creatures, quest, places to discover, traversal toys, boss, music and sound (`docs/SHARDS.md`). What the
player does there decides the world's shape, not the other way round. Driftwood shows it:
- **9 named places** with discovery and map pins (`src/game/quest/Places.ts`).
- **A quest spine:** Wendell → three shards → the altar → the Drowned Captain (`src/game/quest/Spine.ts`,
  `Finale.ts`).
- **Traversal toys:** the lookout and its zipline, the rope bridge, swimming and diving.
- **A secret:** the sea cave.
- **Night enemies** (the drowned sailor).
- **A trader**, and a "complete" card at the end.

The terrain, paths and sightlines exist to serve those. **A WorldClaw world without that structure is a diorama**
(Jake, 2026-10-01: "We want to build a real fun shard … not random dioramas that look cute").

## 2. The four primitives (project/archive/2026-09-30-model-architecture.md, `src/models/model.ts`)

| Primitive | Means | API | Review surface |
|---|---|---|---|
| **Model** | one reusable thing, one builder (code fn, or one GLB + its LOD / phone copies), in its own space (metres, +Y up, pivot at foot centre, front +Z), with variants, LODs, own-space colliders, an optional rig | `defineModel({ id: '<slug>/<name>', name, category, pipeline, file, defaults, variants?, build, lods?, colliders?, rig? })` in `src/chunks/<slug>/models/*.ts` | **Model Explorer**: one card per model, a pipeline badge (CODE · BLENDER · TRELLIS · HUNYUAN · CC0), copy count, drawn-as, triangles per copy and in frame, LODs, collides yes/no, TIERS side by side, VIEW IN WORLD |
| **Placement** | one use of a model: position, yaw, lean, scale, variant, params, tint | `place(model, placements, { ctx, draw: 'merged'│'instanced'│'batched'│'single', cell?, cull?, piece? })` → registry piece + colliders + catalog entry | counted on the model's card |
| **Set** | a named group of placements that reads as one place; owns no geometry. **Every named place is a Set** (check-models rule 9) | `placeSet({ id, name, file, members, place: '<slug>/<place id>' })` | **Set Explorer**: the Sets tab between Models and World, region-grouped, the diorama view |
| **World** | ground and air: terrain and anything welded into it, water, sky, weather, shader fields (grass), the layout (placements, sets, scatter rules) | `ChunkDef.terrain` (`TerrainSpec`), `ocean`, `sky`, `atmosphere`, `look`, `render`; world code places models, never builds a thing's geometry | **World Explorer**: god mode in the real game frame, a free camera, tap → card → OPEN IN MODEL EXPLORER |

**The rules that bind a generator** (enforced by `scripts/check-models.mjs`, which runs in vitest):
- A model is a file that calls `defineModel`. Every one is in the Model Explorer; nothing else is (rules 1–3).
- No shard imports another shard's models (rule 4).
- Nothing is drawn or registered by hand outside a models folder unless the area declares it world (rule 7).
- Every creature species has a model (rule 8).
- **Every named place has a Set** (rule 9). Today a shard is added by hand to `NAMED_PLACES` and `PLACES_ENFORCED`;
  after normalization the model checks' successor reads a WorldClaw shard's world JSON instead (plan E2).

## 3. The shard contract (`docs/SHARDS.md`, `src/core/config.ts`, `src/chunks/terrain.ts`)

| Rule | Value | Note for a generator |
|---|---|---|
| Footprint | 500 × 500 m, origin at the centre (±250) | Nine Dragon uses a 500 m cube (250 up / 250 down) via `structures` + `bounds`; Jake OK'd the cube for any shard (E169), but `ChunkDef.extent` (P2-E1) is not built |
| Slab | 100 m of rock under the surface | the floating-island look |
| Entry roads | four, 15 m wide, at the edge midpoints, ≥ 50 m in (60 used), level at y = 0 at the boundary | `buildTerrain()` forces them over any landscape: the layout map must route around them |
| Height range | `landscape()` "roughly −10..+40 m" | WorldClaw's 100 m cliffs don't fit; the cube or graded paths do |
| Terrain grid | 256² over 500 m (~1.95 m cells) | a 2 m feature is the smallest the ground can hold; finer relief is a model welded in (world) |
| Ground | 4 splat layers (`ChunkAssets.groundLayers` + `splat()`), or vertex colour by height / slope (`groundColor`, Driftwood) | Eq. 6's region weights feed at most 4 ground materials |
| Walkability | step 0.35 m, max climb 40° | `TerrainSpec.graded` paths (cut and fill to `maxGrade`, `bench` for traverses), `src/physics/paths.ts` walkways; `scripts/physics-baseline.mjs --mode=walk` (and `--trails`) must report 0 stuck |
| Navmesh | baked per shard | `scripts/bake-navmesh.mjs <slug>` (`--check` when stale) |
| Bake | `scripts/bake-chunk.mjs` writes `public/assets/baked/<slug>/terrain.bin` (heights, splat, undergrowth log), fingerprinted | the analytic terrain is the source; the bake is derived |

`TerrainSpec` gives a generator these hooks:
- `landscape(x, z, noise)` (seeded `TerrainNoise`, never `Math.random`);
- `trails`: the first four are the entry roads;
- `cabinSites`: flattened pads (they build Pine Hollow cabins, so WorldClaw never uses them: its pads are world data, plan R5);
- `pond` and `pondFill`;
- `oceanLevel`;
- `graded`;
- `finish(x, z, h)`: a last touch after the pads, the trails and the pond;
- `streamAt`: running water;
- `splat`.

## 4. How a shard is laid out in code (Nine Dragon's module, the newest pattern)

```
src/chunks/<slug>/
  def.ts            the ChunkDef (or src/chunks/<slug>.ts for the older shards)
  index.ts          exports, registry entry
  layout.ts         every coordinate (Pine Hollow / Nalati keep a <slug>Layout.ts beside the def)
  places.ts         <SLUG>_PLACES: the named places (id, label)
  roster.ts         the creatures / people / gear listed as models (listModel)
  models/           one file per model family (defineModel)
  world/            the layout composed: place(), placeSet(), scatter rules, colliders
  look/             the shard's own look (materials, render strategy)
```

Registered in `src/chunks/registry.ts` (`CHUNKS`, after the shipped shards, `experimental: true`). It needs:
- thumbnails `src/chunks/thumbs/<slug>.jpg` plus the portrait / landscape hero backdrops;
- a `SHARD_STEPS` entry in `src/boot/steps.ts` (the loading screen's own nouns);
- rows in `bench.budget.json`;
- `explore: true` for the World Explorer.

## 5. Generated models today

The image → 3D path that shipped Pine Hollow's hero props, Nalati's 18 models and Nine Dragon's lion
(`.claude/skills/mockup-to-model/SKILL.md`, `scripts/img2mesh/README.md`):
1. A reference image: one object, alone, on white, three-quarter view, whole and unoccluded (codex `image_gen` or
   `scripts/mockup-local.sh`). A sheet is cut with `split_sheet.py`.
2. TRELLIS.2 (`trellis_batch.py`, ~46 s median per image, 34 GB peak) **and** Hunyuan3D-2 turbo (`hy3d_batch.py`,
   15–30 s), both under `run-locked.sh`. The better take ships (`versus_board.py`).
3. A Blender post (`build_props.py` with a `props/<list>.json`): faceted toon or `--keep-texture` PBR. It makes LOD0,
   `-phone` and `-lod1`, meshopt, KTX2 twins.
4. A model file: `defineModel({ pipeline: 'hunyuan'│'trellis', build: … })`. Shard helpers are Nalati's `generated()`
   and the shared `src/models/glb.ts` (`loadGlbPart`).
5. Review: four views plus holes / floating / mirrors / pivot / front; the detail list; the card's numbers; a portrait
   board or a ~10 s spin clip (`scripts/model-spin.mjs`).

**Budgets** (mockup-to-model §5, NINE-DRAGON-STACK §6.4):
- the phone frame is ~2 M triangles and ~150 draws (Nine Dragon's gate: ≤ 2.3 M and ≤ 180 per pose);
- memory is ≤ 1.8 GB while loading and ≤ 1.0 GB in the Explorer (physical iPhone, decimal);
- one model's copies are one draw (instanced or merged);
- facade multi-draw is banned everywhere (E271 / E272).

## 6. WorldClaw → Wildshard, piece by piece

| WorldClaw | Wildshard primitive | Notes |
|---|---|---|
| prompt `q` | Jake's vision + **`design.md`** (04 §2, 06 §3) | WorldClaw has no design doc. We add it first |
| scene spec `P = (R, C_terrain, C_object)` | `design.md` + its twin `spec.json` (06 §10.1, 04 §3) → the manifest + world data | regions R = **named places** + connective zones |
| region `r` with role `φ_r` | a **named place → a Set**; its role is a **gameplay role** (hub, arena, boss site, secret, vista, quest anchor) | rule 9 makes every named region a Set |
| layout map `I_layout` | a painted map → the region weights as world data (06 §10.1, T3) → soft weights in the terrain and the ground layers | entry roads and the slab edge are fixed constraints on the map |
| height field `H(x)` (Eq. 6) | `TerrainSpec.landscape` (+ `graded` for walkable routes, one grade; pads as world data applied in the finish pass, plan R5) | bounded to the height range; walk test gates it |
| terrain materials `M_terrain` | the shard's look: 4 splat layers, or vertex colour, or a `ShardRender` | ≤ 4 layers; procedural or CC0 / Poly Haven sets |
| asset prototypes `O_asset` | **models**, category `nature` (rocks, plants), any pipeline | the scatter itself is **world** (a field placing a model) |
| scatter (Poisson / random samplers) | `place(model, placements, { draw: 'instanced', cull })` from world code, placements made by a seeded sampler over the region weights | instancing + per-copy culling = budget-safe |
| regional objects `M_i` | **models**, mostly `buildings` / `props`, pipeline `hunyuan`│`trellis`│`code`│`blender`│`cc0` | one model per unique object; copies are placements |
| placement `T_place` | `Placement { x, y, z, yaw, scale, variant }` | solved by a ray from the recorded game camera through the physics query layer, then the baked terrain sampler, with support binding (plan R3, 04 §8) |
| region object set `O_r` | `placeSet({ place: '<slug>/<id>', members })` | appears in the Set Explorer |
| co-deformation (flatten under footprint) | place and object pads as world data (plan R5) | stays terrain data; no mesh edits |
| object_check / terrain_check | T9 over the registry, the physics queries and the catalog numbers (04 §8) | run headless every iteration |
| render–inspect loops | captures in the **real game** at fixed cameras (LOOK-LOOP), the Explorers, plus walking | judges what ships, on the phone tier |
| Blender scene output | committed data + code: spec, region weights, GLBs, `layout.ts`, models, sets | reproducible: commit outputs, never regenerate at build |
| (none: WorldClaw has no content) | quests as data (`src/game/quest/quest.ts`), interactables as JSON rows (`src/world/interact/`), `Boss.ts` / `Elite.ts` (normalized: `EncounterService`, 01 §19), spawns (`HerdPlan`) | content is designed and built with the world (plan D37); happenings are an engine mechanism with a row verb (plan R12, E7) |
| (none: no director) | the director's design + verdict log ([GW2-ZONES](../../plans/GW2-ZONES.md) §4.4, then called CONTENT-GAP, puts it in the shard's `docs/SHARDS.md` section; this plan puts `design.md` in the shard folder, linked from there: plan §7 Q2) | WorldClaw's spec is `design.md`'s machine twin (plan D52) |

## 7. After GAME-NORMALIZATION (what changes, what doesn't)

- **Moves:** `src/chunks/<slug>/` → `src/shards/<slug>/`, `ChunkDef` → a `ShardManifest` + plugin hooks, `LookStrategy`
  for the look, `level.*` stages for boot. The template shard (Z1) and "shard 5 by a fresh agent" (Z3) define the new
  shape. Under the lock a shard's folder only reopens at its milestone.
- **Stays:** `defineModel` / `place` / `placeSet`, the Explorers, the budgets, the shard contract's numbers, the
  check-models rules (ported).
- **So the pipeline keeps its outputs as data** (paths in 06 §10.1): `design.md` + `spec.json`, the region weights, GLBs, the
  placements, all in data files. The code it writes is thin: model files, a layout module, a def. Porting a WorldClaw
  shard means rewriting the def and the boot wiring, not the world.
