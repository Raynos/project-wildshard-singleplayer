# The Blender island (DRIFTWOOD-REMASTER X2, E52)

`pnpm blender:island [--chunk <slug>] [--quick] [--export-only]` rebuilds a shard's area in Blender, headless, and
writes `public/assets/models/<slug>-blender/`. `--chunk` defaults to `driftwood-isle` (Driftwood's spawn cove). In the
game, `?island=blender` (or Settings ▸ Graphics ▸ Island) loads Driftwood's in place of the procedural cove;
`?island=procedural` is the default TypeScript island.

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
