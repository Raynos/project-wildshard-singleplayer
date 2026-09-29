# Plan: model architecture (E306): what a model is, where it lives, how the Model Explorer shows it

**State:** `in progress` 2026-09-29 — Jake approved option B1 and the WHOLE migration (M0–M6), plus rows M7–M11 from his E315 notes: a Sets explorer, static enforcement, model review clips, the Blender practice and the image-to-threejs review. In flight: M0 (the models agent), M9 (the clip tool) and M10 + M11 (research). M1–M4 run shard by shard, in parallel, once M0's contract lands.

## Read this first

Jake's words (E306): *"To me a model is a reusable unit of code, or a model we generate. … There's nothing obvious or
rigorous about it; every agent decides arbitrarily what gets registered. Things with collisions are models (physics
ties into models), enemies are models, dummies are models. … Maybe it needs re-architecting at the code level: a
directory for models, a directory for world, the world made out of the models."*

What the audit found, in one paragraph: the game has no definition of "model". Seven code paths put cards in the Model
Explorer, and each shard marks different things: Driftwood its buildings, Nalati whole places (the 762 k-triangle
kurgan field, a meadow of snow lotus: the "blur"), Pine Hollow 8 hand-picked things, Nine Dragon only its 4 GLB files.
About 300 distinct shapes are drawn; 54 cards exist. The physics registry is the right spine, but one registry
`Piece` is at once the drawn object, a bag of world-space colliders and a catalog entry.

**Jake has approved none of the rows below — ideas only.** No agent builds, "quickly tries" or partly lands a row until
Jake names it.

**The rules this plan keeps** (they are already rules):
1. **Pure refactor for the world.** Moving a thing into a model changes nothing a player sees, hears or walks on, on any
   shard or tier. Only the Model Explorer's catalog changes on purpose.
2. **The other-shards proof** for every change to shared code: identical compiled programs, passes, draws and triangles,
   captures within noise (NINE-DRAGON-STACK rule 4).
3. **No shard branches in core** (`slug ===`, `isOcean ?`): what differs per shard is data or a strategy the shard hands
   to core (GAME-NORMALIZATION rules 3–4, NINE-DRAGON-STACK rule 4). Shard-only code lives in the shard's module.
4. **Physics:** after any collider move, `node scripts/physics-baseline.mjs --no-build --mode=walk` (and `--trails`)
   with 0 stuck; `bake-navmesh --check`.
5. **Instancing, never facade multi-draw** (E271 / E272). The drawing technique of a thing does not change in this plan;
   if it ever does, it needs physical-iPhone memory evidence (≤ 1.8 GB loading, ≤ 1.0 GB Explorer).
6. **Looks stay per shard** (toon / painterly / PBR / Jiehua). A model's materials are its shard's.

## 1. Definitions

| Word | Means | Examples | In the Model Explorer? |
|---|---|---|---|
| **Model** | One reusable thing you could lift off the map and set down elsewhere. Built by **exactly one builder**: a code function, or one GLB file (+ its LOD / phone copies). Built in its **own space**: origin at its foot, metres, +Y up; it knows nothing about where it stands. It may carry **variants** (skins, sizes, damage states, colourways), **LODs** (the same model with less detail), **colliders** (in its own space) and a **rig** (bones + clips) | a palm, a yurt, the hut, the shipwreck, a kurgan kerb stone, a balbal, a snow lotus, a TRELLIS standing stone, a Scots pine (and its 13 sibling variants), a facade balcony, a paper lantern, a boar, the Drowned Captain, a camp elder, a training dummy | **yes, always, once** |
| **Placement** | One use of a model: model id + position, turn, scale + variant. The world owns placements, never the model | "palm #37 at (12, 4, −80), lean 0.3" | counted on the model's card ("× 250 on this shard") |
| **Set** | A named group of placements worth seeing as one; no geometry of its own | Spring camp (6 yurts, 9 props, yard), the kokpar field, the market square | **yes, in a Sets tab**, listing its models |
| **World** | The shard's ground and air, not a thing on it: terrain (including landforms welded into it: the kurgan domes, the glacier tongue, the Blender cove's ground tiles), water, sky, weather, the layout (placements, sets, scatter rules), fields drawn by a shader (grass blades) | terrain, ocean, grass field, the fern *field* | no: the World Explorer |
| **Effect** | Light, particles, trails, streaks, glow | smoke, rain, neon spill, grapple flashes | no |
| **Gear** | What the player holds | swords, bows, the lever rifle, the first-person arms | yes, a Gear tab (or the Weapon Explorer; Jake's call) |

**Grey-zone rules, so nobody has to judge:**
- **Used once is still a model.** The shipwreck, the fire lookout and the Wind Cairn are models placed once.
- **Welded to the ground is world.** If lifting it off would leave a hole or a seam in the terrain (the cove's ground
  tiles, the kurgan domes, the glacier tongue, sculpted crag ledges that are terrain), it is world. The rocks, plants and
  props *on* it are models.
- **Scatter:** the plant is a model; the field that places 6,000 of them is world. A grass blade drawn by a shader field
  has no reusable geometry, so the grass field is world.
- **Creatures, NPCs, enemies, bosses, the crowd, dummies are models** (with a rig when they move). The crowd is a model
  with 6 colourway variants, filed as People, not Creatures.
- **A collider bag is never a model.** Colliders belong to the model that owns them and are placed with it.

## 2. The registration rule an agent applies without judgement

> **A model is a file that calls `defineModel(…)`. Every `defineModel` is in the Model Explorer. Nothing else is.**
> **The world never builds geometry for a thing; it places models (`place(model, placements)`).**

`defineModel` (sketch; the names are placeholders):

```ts
export const palm = defineModel({
  id: 'driftwood/palm', name: 'Coconut palm', category: 'plants',
  pipeline: 'code',                     // 'code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0' — the card's badge
  file: 'src/chunks/driftwood-isle/models/palm.ts',
  variants: [{ id: 'tall', label: 'Tall' }, { id: 'leaning', label: 'Leaning' }],
  build: (ctx, variant, tier) => …,     // Object3D in its own space; ctx = the shard's look (sky, materials)
  lods?: [{ from: 60, build: … }],      // or `levels` for a GLB's -lod1 / .far copies
  colliders?: (variant) => ColliderDesc[],   // in its own space; placement transforms them
  rig?: …,                              // creatures / people: the clips the turntable plays
});
```

`place(model, placements, how?)` does what every shard does by hand today: it builds the geometry once, draws N copies
the way the model's shard asks (`'instanced'` default, `'merged'` where copies differ in shape, `'single'`), culls them
per copy when they spread, applies the LODs, transforms the model's colliders to each placement and adds **one**
registry piece per placement group (so physics, floors and foam stay exactly as now), and records the tap targets. The
drawing technique is data on the call, never a branch in core.

**What the rule removes:** the `model` field on `Piece`, `registerDriftwoodModels`, `registerPineHollowModels`, the
`ENTRY` table's `model: true`, Nine Dragon's `models` list, the `addBuilt(…, {})` argument, and the `if (isOcean) … else
if (chunk.slug === 'pine-hollow')` in `main.ts`. **What enforces it:** a test that fails when (a) a `Piece` with an
`object` is added outside `place()` and is not declared world (`kind: 'world'`), (b) a `defineModel` has no builder,
category or pipeline, (c) two models share an id, (d) a model's colliders are given in world space (they must sit
within its bounds); and the boundary check: no shard imports another shard's models.

## 3. How the Model Explorer presents models

- **One card per model, never per copy, never per place.** 500 ferns are one Fern card, "× 6,000 · instanced". The
  kurgan field disappears as a card; its kerb stone, portal and balbal become cards and the field becomes a Set.
- **Every card shows the facts:** a pipeline badge (CODE · BLENDER · TRELLIS · HUNYUAN · CC0), the count on this shard
  and how it is drawn ("× 250 · merged", "× 13,600 · instanced · culled", "× 1"), triangles *per copy* and *in the
  frame*, draw calls, LOD levels, collides yes / no.
- **Variants on one card** (the variant row already exists): the 14 Pine Hollow trees are one "Forest trees" family
  with 14 variants, or 6 species cards with their variants; the crowd's 6 colourways; the dummy's 3 armours.
- **TIERS shows the real LODs** side by side (near cards → far cards → impostor), not "one build for every tier"
  (EXPLORE-V2 row V2).
- **Tabs:** Buildings · Props · Plants · Rocks · Creatures · People · Gear · **Sets**. A category is a field on the
  model, never guessed from the piece (the `props` → `buildings` bug goes).
- **Placed models open "View in world" on a real copy** (the nearest placement), so it can never fly to the origin.
- **Creatures from the shard's species list, not the live animal list**, so the Captain, the Antler King, flocks,
  marmots and the Storm Titan are always there.
- **Shared models** (the dummy, the deer rig used on two shards) say so on the card.

## 4. Options

The real choice is how far to go. Folders are a second, smaller choice (B1 / B2).

| | **A. Label what's there** | **B. Model modules + `place()` (recommended)** | **C. World as data** |
|---|---|---|---|
| What | Keep every file where it is. Replace the `model` flag with a required `ModelEntry` (kind: model / set / world, pipeline, count, drawnAs, category) on every registry piece; apply the definitions by hand; fix the Explorer's cards (counts, badges, Sets tab) | A, plus the `defineModel` / `place()` contract: every model becomes a module that exports its builder, variants, LODs and own-space colliders; the world composes placements. Migrated shard by shard | B, plus every shard's layout becomes a placement file (data, baked or hand-edited), and one generic world builder reads it. Opens the door to an in-game editor and to the chunk streamer loading placements |
| Fixes the blur | yes | yes | yes |
| Makes the rule mechanical | no: it is still a judgement per piece, just written down | **yes**: "a `defineModel` is a model" is checkable by a test | yes |
| "The world made of models" in code | no | **yes** | yes, fully |
| Shares the plumbing (instancing, per-copy culling, LOD, colliders per placement) | no | **yes**, one `place()` | yes |
| Size | S–M: ~1 week, mostly `src/explore/` + one line per registration | M–L: M0 in days, then one shard per wave (~1–2 weeks each at this repo's pace) | XL: overlaps GAME-NORMALIZATION's full shard-module refactor, which Jake did not want in full (E154) |
| Risk | low: no geometry moves | medium: builders move; guarded by the other-shards proof and the walk test | high: every shard's layout rewritten at once |

**Recommendation: B**, starting with A's Explorer changes as its first half (they are needed either way), and stopping
after each shard wave so Jake can look at that shard's catalog before the next.

### Folders, if B

| | **B1. Shared in `src/models/`, shard-only in the shard's module (recommended)** | **B2. Everything under `src/models/<shard>/`** (the literal sketch) |
|---|---|---|
| Layout | `src/models/` — the contract (`defineModel`, `place`, the catalog reader) and models used by 2+ shards (creature rigs, the dummy, the rock kit) · `src/chunks/<slug>/models/` — that shard's models · `src/chunks/<slug>/world/` — its layout, sets and scatter rules · `src/world/` — terrain, sky, water, culling, placement machinery (core) | `src/models/{shared,driftwood-isle,nalati-grasslands,pine-hollow,nine-dragon-stack}/` · `src/world/<shard>/` |
| Pro | Matches the shard-module rule (everything only one shard uses lives in `src/chunks/<slug>/`) and Nine Dragon's existing layout; one folder per shard to hand to a shard agent; lazy-loading a shard stays one import | "Show me every model in the game" is one folder |
| Con | Models are in five places | A shard lives in three trees (`src/chunks/`, `src/models/`, `src/world/`); core-importing-shard checks get harder; contradicts GAME-NORMALIZATION §3.1 and NINE-DRAGON-STACK rule 4 |

B1 keeps "every model in one place" where it matters to Jake, in the **Model Explorer** (and an `ls src/chunks/*/models
src/models` for agents); the code keeps one folder per shard.

## 5. Migration (option B, B1)

| Step | What | Proves / risks |
|---|---|---|
| **M0a** Explorer facts | Cards show count, drawnAs, pipeline badge, per-copy vs frame triangles; category becomes explicit (fixes `props` → `buildings`); Nine Dragon specimens get `worldView` on a real copy. Explorer-only, reads the scene as it is | No world change. Proof: the four catalogs before / after on the phone |
| **M0b** the contract + one family (the proof) | `src/models/model.ts` (`defineModel`, `place`, the catalog reader, the test). Move **one family** that shows every part of the contract: **Driftwood's shore boulder** (a code model with variants by seed, own-space hull colliders, 110 placements, today merged + a separate unlinked specimen). After: one "Shore boulder" card, "× 110 · merged · collides", and the `rocks` piece built by `place()` | Other shards untouched (identical programs / draws); Driftwood identical: same draws, triangles, colliders (walk test 0 stuck), captures within noise. Risk: the DRIFTWOOD-TOP10 lane is live in the same files, so M0b waits for a quiet window or takes the training dummy instead (shared, GLB + code fallback, variants; no colliders to prove) |
| **M1** Driftwood | palms, bushes, the Blender cove's 72 prototypes as models (the cove's ground stays world), then the structures (pier / jetty as one model with 4 placements, hut, lookout, wreck, shrine, bridge, boat with its ropes, zipline, trailside), then ground cover kinds; `addBuilt` and `registerDriftwoodModels` go | the walk test after each builder; the cove's colliders move from the old bridge into the registry (its own row, physics owner) |
| **M2** Pine Hollow | the 8 TRELLIS hero props (their LOD files become `lods`), the tree set as one family with 14 variants, crags as 12 modules, cabins as one model with its variants + the hamlet, Poly Haven props, hollow log, undergrowth kinds; `registerPineHollowModels` goes | the forest and crags are BatchedMesh today: `place()` must support that path unchanged (no technique change), proven on the phone |
| **M3** Nalati | the POIs split into models + Sets: yurt, camp props, kurgan kerb / portal, balbal (2 carved variants back), cairn, bridge, watchtower, kokpar rider; rocks unified into one rock model family; dressing plants; camp people as People. The `ENTRY` table goes | the per-POI merged mesh (1 draw per POI) must stay 1 draw: `place()`'s `'merged'` path |
| **M4** Nine Dragon | the facade's 32 piece types, market sets, lantern, movers, lion, hook, crowd (with its 6 colourways) as models; region kits stay world (they are the built fabric) or become Sets | the facade stays instanced (E272); `scripts/test-facade-instancing.mjs` must stay green; ≤ 180 draws / 2.3 M triangles per pose |
| **M5** creatures and gear | species files become models (the species list, not the live animals); weapons and first-person arms as Gear | the lineup and clip viewer unchanged |
| **M6** clean-up | delete the `model` field on `Piece`, the two catalog functions, the `main.ts` slug branch; archive this plan | the contract test covers every shard |

**Risks across the migration:**
- **Contention.** ~10 agents share the tree; the Driftwood, Nalati (faces, E302 / E304) and Nine Dragon lanes edit the
  same builders. One model family per commit, pathspec commits, and a shard only in a window its owner isn't in.
- **Identity.** Moving a builder must not change a pixel: the other-shards proof on every shared-code commit, plus the
  same-shard captures. Precompiled shader keys (`src/boot/precompile.ts`) change if a mesh changes kind, so the drawing
  technique of each thing is kept as it is.
- **Physics.** Own-space colliders transformed per placement must land exactly where the world-space ones did; the walk
  and trails baselines at 0 stuck and a navmesh check after each shard.
- **Boot time and memory.** Builders run inside 30 ms tasks today (`slicer`, `macrotask`); `place()` must keep that
  slicing. Lazy specimens stay lazy. Phone memory readings before / after each shard (the Nine Dragon incident's lesson).
- **Overlap with GAME-NORMALIZATION** (draft, not wanted in full, E154). This plan is the "models" slice only; if Jake
  starts that plan, M1–M4 become its shard-module waves.

## 6. The first step that proves it

**M0a + M0b, one short session.** M0a changes only the Explorer, so Jake sees the difference on the phone the same day
(counts, badges, no more Buildings-tab props). M0b adds `src/models/model.ts` and moves Driftwood's shore boulder: one
file in, one registration and one hand-written specimen out, and the card reads "Shore boulder · CODE · × 110 · merged
· collides". Done when: the contract test passes, Driftwood's draws / triangles / colliders are identical, the walk
test is 0 stuck, the other three shards compile to identical programs, and the before / after catalog is on one phone
board.

## Jake's notes (E315, 2026-09-29)

- Every real model is registered and lives in the right directory, shared or per shard. Anything reusable becomes a
  model, and each model lists how many times the world uses it.
- Places, zones, sets, groups and decorated scenes are a new explorable thing. You explore single models, then sets,
  then the full world.
- `place()` must be generic enough for real performance: 30 fps is the baseline on iOS and 60 fps the ideal. It
  owns instancing, merging, LODs and per-copy culling for every shard, so a win there is a win everywhere. Every
  migration wave is perf-neutral or better: the same or fewer draws, triangles and GPU ms on
  `scripts/nine-dragon-gpu.mjs`-style rulers.
- Collisions: the model owns its own-space colliders, and `place()` transforms them per placement (§2).
- Each card says how it's made: CODE · BLENDER · TRELLIS · HUNYUAN · CC0.
- Enforce the structure with static analysis (custom oxlint rules, scripts, tests), so new shards, features, zones,
  sets and models can't fall through the gaps.
- Review on the phone: an agent can make a ~10 s clip spinning one model, or five, in the Model Explorer for the Claude
  app. Jake will also review the Model Explorer UI itself.

## Rows (B1 and the whole migration approved 2026-09-29, E306 / E315)

| # | Row | Size | Status |
|---|---|---|---|
| M0a | Explorer facts: count, drawnAs, pipeline badge, explicit category, `worldView` on a real copy | S | in flight (E306) |
| M0b | `defineModel` / `place()` contract + Driftwood shore boulder (or the training dummy) | S–M | in flight (E306) |
| M1 | Driftwood models | M | approved; after M0 |
| M2 | Pine Hollow models | M | approved; after M0 |
| M3 | Nalati models + Sets | M–L | approved; after M0 |
| M4 | Nine Dragon models | M | approved; after M0 |
| M5 | Creatures from the species list; Gear | S | approved; after M0 |
| M6 | Delete the old paths; archive | S | approved; last |
| M7 | Sets explorer: explore sets / places / zones / scenes as their own mode between models and the world | M | approved; after M3 |
| M8 | Static enforcement: oxlint rules in `lint/wildshard-plugin.js` + a check script: geometry only through `defineModel` / `place()` or declared world, models only under `src/models/` or `src/chunks/<slug>/models/`, no shard imports another's models, the contract test | S–M | approved; starts with M0b, grows each wave |
| M9 | Model review clips: `scripts/model-spin.mjs`, a ~10 s portrait turntable of 1–5 models from the Model Explorer at phone size for the Claude app | S | in flight (E315) |
| M10 | Blender best practice: **Blender scripts are the source, the exported GLB is committed, a `.blend` never is** (`docs/design/blender-practice.md`, `bdf3b4f7`). Refactor: rescue the Nine Dragon arms' deleted scripts, one runner + manifest (pinned Blender, the model lock, `--python-exit-code 1`), builders per shard, delete the orphan yurt script, bring the Nalati img2mesh recipe home, a check script + no-`.blend` guard, an AGENTS.md paragraph | S (decided) + ~1 day | refactor in flight (E315) |
| M11 | image-to-threejs skill: reviewed (`docs/design/image-to-threejs-review.md`): recent (Jul–Sep 2026) but single-agent and one-object, with no LODs, no phone budgets and no real colliders. **Our own skill instead**: `.claude/skills/mockup-to-model/SKILL.md` (`bdf3b4f7`) documents this repo's mockup → model workflow and keeps six of its ideas. The user-wide `~/.claude/skills/img2threejs` links are Jake's to remove | S–M | done (E315) |
