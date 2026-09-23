# The Blender island (DRIFTWOOD-REMASTER X2, E52)

`pnpm blender:island [--quick]` rebuilds Driftwood's spawn cove in Blender, headless, and writes
`public/assets/models/driftwood-blender/`. In the game, `?island=blender` (or Settings ▸ Graphics ▸ Island) loads it in
place of the procedural cove; `?island=procedural` is the default TypeScript island.

| Step | File | What |
|---|---|---|
| 1 | `export-scene.mjs` | Runs the game's own code in Node: the area's heights from the baked grid (the surface `heightAt` walks), the game's ground colour (`lowPolyGroundColor`), slope, trail distance; the whole chunk's coarse heights; the palms / boulders / bushes / trailside specs; the pier, hut and trailside meshes as triangle soup. → `~/.cache/wildshard-blender/` |
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
