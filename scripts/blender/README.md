# The Blender island (DRIFTWOOD-REMASTER X2, E52)

`pnpm blender:island [--quick]` rebuilds Driftwood's spawn cove in Blender, headless, and writes
`public/assets/models/driftwood-blender/`. The game always loads it in place of the procedural cove (the user's pick, E7;
the `?island` switch is gone since E136); the procedural cove stays underneath as the load-failure fallback.

**Per shard (PINE-HOLLOW-REMASTER PH-0.3).** Three things name a shard:
- its area: `src/world/blenderArea.ts`, `blenderAreaFor(slug)`. Driftwood's is also the `area` export that
  BlenderIsland.ts clips at.
- its half of the export: `scripts/blender/shards/<slug>.mjs`. `groundColor(ctx)` gives the area grid's colour;
  `layout(ctx)` gives scene.json's shard keys, plus bake occluders through `ctx.addObject`.
- its Blender builder in `run.sh` (`driftwood-isle` → `build_island.py`). A shard without one stops after the export.

Pine Hollow has an area (provisional: the Hollow, until board B1) and an exporter. `area.bin` holds the splat-weighted
PBR ground albedo, `splat.bin` the real layer weights, and `scene.json` every tree, the cabin sites, the pond and the
trails. Its builder is wave 2 (PH-U17), so `pnpm blender:island --chunk pine-hollow` exports to
`~/.cache/wildshard-blender/pine-hollow/` and writes nothing to `public/`. Every export reads the shard's baked grid,
`public/assets/baked/<slug>/terrain.bin`; the cache is per shard, `~/.cache/wildshard-blender/<slug>/`.

| Step | File | What |
|---|---|---|
| 1 | `export-scene.mjs` + `shards/driftwood-isle.mjs` | Runs the game's own code in Node: the area's heights from the baked grid (the surface `heightAt` walks), the game's ground colour (`lowPolyGroundColor`), slope, trail distance; the whole chunk's coarse heights; the palms / boulders / bushes / trailside specs; the pier, hut and trailside meshes as triangle soup. → `~/.cache/wildshard-blender/driftwood-isle/` |
| 2 | `build_island.py` + `assets.py` | Blender 5.2, Cycles on the Metal GPU. Terrain on a grid twice the game's (edges on the game's grid lines, interior jittered for natural facets), ~60 prototypes from code (palms, crag slabs, boulders, ferns, hibiscus, bushes, flowers, grass, beach grass, shells, starfish, pebbles, driftwood), ~13 k placements by height / slope / path rules. Bakes, exports `island.glb` (no materials, no normals), `placements.bin`, `island.json`. |
| 3 | `run.sh` | meshopt (`gltf-transform meshopt`), lightmaps to WebP (desktop 2048 / 1024, phone half), copy into `public/`. |

The area is `src/world/blenderArea.ts` (x −110.8…110.8, z −214.7…−20.6: the pier landing, the crescent beach, the plank
stair, the hut plateau). Terrain, crag slabs, plants and beach scatter are modelled from code (`assets.py`); the palms,
shore boulders, driftwood and coconuts are the asset-agent's kit (`public/assets/models/driftwood-hero/`, image-to-3D, and
`driftwood-cc0/`, CC0 1.0 — licences in `scripts/img2mesh/CC0.md`), imported by `build_island.py`. The kit palms are
used as authored near the camera (collapse-decimating tore their trunks apart); their far cut is the code palm at the same
height / lean in their own colours. The game draws the props as 4×4 / 3×3 caster tiles (near + far copy) and 8×8 / 4×4
cover tiles (drawn within 32 m on phone, 150 m desktop), phone / desktop.

## Lighting: what is baked and what stays live (the decision)

The island runs a 20 + 4 min day/night clock (`src/world/DayNight.ts`), so the sun cannot be baked. Baked, once:

- **AO lightmap** (terrain, 2048², 5 m sky visibility). Every object occludes: palms, crag slabs, scatter, pier, hut. In
  game it multiplies the indirect term (the hemisphere fill that the clock tints, the toon shade lift), never the sun.
- **Bounce lightmap** (terrain, 1024²): Cycles indirect diffuse with the sun alone at the midday reference (62° up,
  due south), irradiance 1, sky black. In game it is added to the indirect term × the live sun (colour × intensity ×
  its elevation relative to the reference), so it fades with the sun and is gone at night.
- **Prototype AO** in the vertex colour's alpha (self-occlusion + ground contact). Multiplies the fill, and 35 % of
  the direct light (the inside of a palm crown).

Live: the sun's direct light, its CSM shadows and the toon ramp (`stylize.ts`), the hemisphere fill, fog, sky, sea.
Rejected: baking the four DayNight presets and blending (4× the textures and the bake time for a term that the live
sun already gets right); baking the full combined light (static, wrong 23 minutes out of 24).

Measured (first bake): AO mean 0.83; the bounce is small on open ground (mean 0.003 of the sun's irradiance, up to
0.08–0.11 at the foot of the crag and under the pier): honest for a low-poly beach, most of its GI is sky occlusion.

## The tree species set (PINE-HOLLOW-REMASTER PH-B4)

`bash scripts/blender/trees/run.sh [--quick] [--only=bark,cards,trees,lineup] [--no-copy]` builds Pine Hollow's photoreal
species set — Scots pine ×4, fir ×2, old-growth giant ×2 (4–6× a pine's girth), silver birch ×2, dead snag ×2, sapling ×2 —
under the machine-wide model lock (`~/projects/localai/.model.lock`: it waits for a running model job), in ~90 s of
Blender once it has the lock.

| File | What |
|---|---|
| `trees/treegen.py` | The species as numpy geometry, per variant five LOD parts (trunk / trunkLo bark, hi / lo / twigs cards) + the vertex data the game reads (bark layer, bark tint, crown occlusion, crown-bent card normals). `SPECS` = the game's `TREE_SPECS_V2` (`src/world/treeSpecies.ts`, checked by `test/tree-species.test.ts`). |
| `trees/barkgen.py` | The silver birch's bark, generated seamless (Poly Haven has none). |
| `trees/build_trees.py` | Blender 5.2: the bark sets, the branch-card atlas (branches modelled from CC0 photoscan sprigs, rendered top-down in Cycles: albedo × AO, camera-space normal, ARM), `trees.glb`, the impostor atlas (each variant's hi LOD from the side), a lit lineup preview. |
| `trees/glb.py` | A minimal glTF writer (meshes `<variant>__<part>`). |
| `trees/run.sh` | Blender → meshopt (gltf-transform), pngquant / JPEG / half-size `.phone.webp` → `public/assets/models/pine-hollow-trees/` + `public/assets/tex/{fir_bark,metasequoia_bark,birch_bark,bark_willow_02}/`. |

Sources are Poly Haven CC0 (fir_tree_01's sprays + bark, tree_small_02's leaves, pine_tree_01's twig, metasequoia_bark,
bark_willow_02), cached in `~/.cache/wildshard-blender/trees-src/`. The game side is `src/world/treeSet.ts` (the GLB →
plain float geometry, the bark array lookups) and `TreeFactory.buildSet`; `?trees=v1` keeps the runtime pines.
