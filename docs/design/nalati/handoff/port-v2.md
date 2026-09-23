# Handoff: the Nalati look-v2 port (port lead, 2026-09-23)

The clean-room prototype (`dev/nalati-cleanroom/`, PLAN.md there) is the reference. This note covers what was ported
into the shard, what is left in order, the user's hard rules, and how to test. **Status (2026-09-23, the look agent):
steps 1–7 built — v2 is the Nalati default; `?look=v1` brings the old path back. Code in `src/nalati/look/`
(index.ts lists the one-line hooks). See "Built" below; the steps further down are the original plan, kept as the spec.**

## Built (look agent, 2026-09-23)

| step | commit | what | measured (camp 9, phone tier) |
|---|---|---|---|
| 1 sky dome | `95eafd4` | `look/sky.ts`: the round-6 panorama on a far-plane sphere; slice seams repaired + wrap made continuous (`scripts/nalati-panorama.py`, which also writes `look/panoramaData.ts`: horizon row, ridge line, fog LUT); zenith blend 30°→52°→88°; night fades the painted sky above the ridge into the rig's stars; storm veil / moon / key tint (`look/tint.ts`) | — |
| 2 fog | `d05788b` | `look/fog.ts`: 256×1 LUT from the painting, un-graded, re-tinted by the same `v2Regrade` as the dome | — |
| 3 grade | `f1a7540` | `look/grade.ts`: MSAA ×4 → one EffectPass (bloom on desktop); dome + fog write the exact inverse | 79–94 calls (v1 105–120) |
| 4 light | `0969ba4` | `look/light.ts`: key +40° / +15°, fill lower + cooler, `v2Olive` ground values | 80–95 calls |
| 5 grass | `bf9925a` | `look/grass.ts`: 3 GPU rings + SDF flowers, 4 draws, CPU tile culling into a float texture, the GrassField lattice + a 1 m mask (roads, yurts, splat, dressingCover, trunks); Wind / trample / stealth hooks unchanged | 82–97 calls, 1.28–1.89 M tris |
| 6 bake | `6b70c37` | `look/bake.ts`: static casters' depth map from the key (2048² / phone 1024²) + a top-down contact map, re-baked on a 1.5° key swing | same |
| A3 | `545ca03` | `look/cloudSea.ts` (the deck under the slab, not a pale panel), turquoise braids (`water.ts`), gold-green meadow patches (`terrainSurface.ts`), thinner fog from above | 97–105 calls, 1.30–1.90 M (with the GLB props now in; v1 116–128) |
| 7 default | (this) | `look/flag.ts`: on unless `?look=v1` | `progress/nalati-look/camp9/v2-step7-*`, `progress/nalati-look/walk/v2-step7-strip.jpg` |

Open: near-field painted grass cards (0–3 m) not added (the blades hold up at the feet); the slab lip is still a
straight line from far above; the cloud deck is a shader (no volume); terrain shading by zone + the horizon re-aim for
layout v2 (`docs/design/nalati/layout-v2.md`) wait on the new landscape.

## Phone tier (`?tier=phone`, polish agent 2026-09-23)

Measured headless (390×844 @1.5, Metal) with `?perf=1` and a per-object draw probe; budget **≤ ~110 calls, ≤ 1.6 M
triangles** at every pose (the real-phone 30 fps target can't be measured here). The frame meter's `?perf=1` adds the
check: the worst calls / triangles of the last ~10 s vs that budget, `OK` / `OVER` (red when over), and
`window.__perfBudget` for scripts (src/ui/Perf.ts).

| setting (phone) | value | where |
|---|---|---|
| MSAA | ×2 (desktop ×4); off when the player turns AA off | `look/grade.ts` `buildLookV2Chain` |
| static casters (POIs, dressing, outcrops, spruce, GLB props) | **out of the realtime shadow map**: they shadow through the bake only (terrain + grass read `bakedShadow`); swept every 2 s for streamed-in meshes | `look/bake.ts` `PHONE_STATIC_OFF_CSM`, `sweep()`; `terrainSurface.ts` (the key light × `bakedShadow` in the light loop) |
| realtime shadow map | 1 cascade to 80 m (tier), **512²** — only what moves casts (creatures, the player) | `look/index.ts` |
| baked shadow / contact | 1024² / 1024² over the slab, re-baked on a 1.5° key swing | `look/bake.ts` |
| grass rings | 4 / 8 / 16 m tiles × 8 / 12 / 14, spacing 0.085 / 0.20 / 0.45 m, 3 / 2 / 1 segments; flowers 0.3 m; near cards 0.2 m on 2 m tiles to ~3.4 m | `look/grass.ts` |
| Storm Titan | puffs icosahedron detail 2, 1 bud per puff (desktop 2); flame tongues 8 × 6; smoke pool 90 (desktop 200) | `stormTitan.ts`, `stormTitanLook.ts` |

| pose (layout v2) | before (calls · M tris) | after |
|---|---|---|
| camp, looking W (115, 205) | 106 · 1.75 | 81 · 1.32 |
| camp, looking S (88, 232) | 108 · 1.52 | 83 · 1.09 |
| bowl, looking N (0, 20) | 112 · 1.69 | 79 · 1.20 |
| horse plains, looking E (40, 36) | 108 · 1.43 | 95 · 1.10 |
| Titan fight, phase 1 looking S | — | 81 · 1.23 |
| Titan fight, phase 3 looking N over the fire | 115 · 1.75 | 94 · 1.40 |

Left for the owners: the sheep flock still casts its whole InstancedMesh into the shadow map (~0.1 M tris a frame,
`src/entities/Flock.ts`); ~6 draws a frame are `Points` particle layers that could merge.

## The user's hard rules (2026-09-23, after playing the prototype — these override the prototype)

"so many cardboard cutouts … it only looks good for screenshots, when you move around you can see it's a scam … the
grass is not bad … the port lead better not copy over any of those shortcuts … the fucking skybox transition."

1. **No cardboard cutouts, billboards or sprites for anything in the playable 500 m.** Horses, trees (near and far on
   the slab), yurts, props and rocks are real 3D meshes that hold up when you walk all the way round them and look from
   above. Impostors are allowed only as a distance LOD of a real mesh, beyond about 120 m, and must not read as flat
   when you circle them (multi-angle octahedral impostors, or just cheap meshes). **The prototype's painted spruce and
   horse sprites are NOT ported.** The engine's real spruce (Forest + the 'spruce' factory) stays.
2. **Painted imagery only at true infinity:** sky, clouds, the gas giant and the far range beyond the slab edge, as ONE
   seamless 360° panorama on a sky dome. No plates, no seams, no visible transition anywhere, including looking up or
   down and while turning. Never paint the mid-ground, and never let a painted image stand in for 3D
   terrain / forest / camp.
3. **Keep and port:** the GPU grass rings + shader flowers (the user likes the grass), the olive / golden values and the
   in-shader grade, the lighting model, the fog colour sampled from the panorama, and the baked shadows / contact
   darkening.
4. **Validation is by moving, not by one screenshot.** Every step must pass the 9 camp angles
   (`node scripts/nalati-camp9.mjs --tag=v2-stepN --look=v2`) AND a walk-around check: orbit the camp 360° (about 12
   frames round a circle, as a strip), walk the path, look up and down, and stand on Eagle Rock (170, −20). Look at
   every frame for cutouts, seams and popping. If something only works from one camera, it fails.
5. **Models:** real meshes from the sourced CC0 set (`public/assets/nalati/sourced/`, README
   `art/nalati-grasslands/round-5-sourced/README.md`) and the local image-to-3D models (`public/assets/nalati/models/`)
   as they land. The procedural yurts / POIs stay unless something better and real replaces them.

## What landed

| commit | what |
|---|---|
| `247572c` | `dev/nalati-cleanroom/`: the prototype (index.html via vite at `/dev/nalati-cleanroom/`), PLAN.md, compare shots, asset tools. It is the reference only. It breaks rule 1 (sprites), so nothing of its sprite / plate approach is to be copied |
| (this commit) | `art/nalati-grasslands/round-6-panorama/`: **the one continuous 360° panorama** (5530×1024, seam-checked, chained outpainting; README there has the mapping). This handoff note. look-pass.md updated |

## What is left, in order (each step behind `?look=v2`, measured, pathspec-committed)

Put the new files under `src/nalati/look/`. Each hook into a shared file should be one line, and each one should be
named in that step's commit message.

1. **Sky dome (rule 2).** A full sphere (BackSide, depthWrite off, renderOrder lowest, follows the camera, radius
   < 2600 far). Map azimuth to u with `atan(-d.x, d.z)` (compass: 0 = north = +z, 0.25 = east = −x, the PaintedBackdrop
   convention). Map elevation to v linearly through the painted horizon row (measure it; about 0.24 from the bottom).
   The seams that must not show:
   - **Up:** from about +35° to +65°, blend into a zenith colour taken from the strip's own top rows (per azimuth, heavily
     blurred via textureLod), converging to one zenith colour at 90°. Make the band wide and colour-matched so there is
     no line. Optionally continue faint procedural cloudlets.
   - **Down:** below the painted land, fade to the fog colour.
   - **The u = 0/1 wrap:** use textureGrad with the continuous azimuth branch, as PaintedBackdrop.ts does.

   In v2, hide the old sky: `sky.clouds`, `sky.planet`, `sky.sunDisc`, the DayNight dome + halo, and PaintedBackdrop
   (don't load it). Keep the Horizon rings 0 and 1 (3D hills in front) and the cloud sea. Ship the strip as WebP
   (desktop 6144 px, phone 4096 px). Day / dusk / night / storm, cheapest first: re-grade the day painting in the dome
   shader from `weather.look`, the way `PaintedBackdrop.update()` already does (key tint, moon monochrome, cloudLight
   dimming, storm veil into the fog colour, flash). At night, fade the painted *sky* toward the DayNight dome's stars
   using a sky mask. A per-column ridge line, extracted once from the strip, is enough. Only paint a second (night)
   strip if the tint reads badly.
2. **Fog from the panorama.** Build a 256×1 LUT on the CPU: per azimuth, the strip's colour in the band just above the
   painted horizon, blurred. Override `fog_fragment` after `installAtmosphere` (in wireNalati, before any compile) and
   append the LUT uniform + density to `fog_pars_fragment` (keep `pCloudShadow` / `P_CLOUDS`). Attach the uniforms by
   adding keys to `paintedAir`, which `attachFogUniforms` iterates. Fog = clear to 30 m, then
   `1 − exp(−(d − 30)·0.0032)`, colour = LUT(view azimuth). Fog colour and dome must go through the *same* post, so
   they match exactly.
3. **Grade + post-less phone chain.** One Effect, the prototype's `grade()`: filmic shoulder `x(1 + x/9)/(1 + x)` on
   1.12 × exposure, saturation 1.05, cool-shadow / golden-light split, a mild S-curve. The v2 composer is RenderPass
   (MSAA 4, no SMAA) → that one EffectPass. There is no N8AO, volumetrics, god rays or bloom on phone; bloom is
   desktop only. The dome writes the *inverse* of the shoulder of the painted colour, so it displays as painted. The
   hook is one line in `Game.buildPainterlyChain` (`if (LOOK_V2) return buildLookV2Chain(this, composer)`).
   `game.post` stays null in v2 (DayNight skips it).
4. **Lighting cheat + values.** After the weather rig applies (push an updater after `weather.update`), while the key is
   the sun (`look.moon === 0`), turn the key about 40° further round and about 15° higher than the painted sun
   (compass ≈ 290°, el ≈ 40° at the def's hour) and `sky.setKeyLight` it, so objects read warm and front-lit. Hemi and
   ambient go lower and cooler. The target palette is olive / golden, about 35% darker than the current lime (the
   prototype's region numbers are in its PLAN.md).
5. **Grass v2 (rule 3).** The prototype's GPU rings: world-snapped tiles in 3 rings, blades built from `gl_InstanceID`
   + hash, per-blade hole test for the inner ring, radial fade on the last ring. Feed them from baked textures built
   once at boot on a 1 m lattice over ±256 m: `grassBaseHeightAt` (height 0 = bare), `grassToneAt`, `flowerKindAt`,
   `groundColorAt`, × (1 − `dressingCover`), and 0 on tree trunks. Bend them with `windGust` (WIND_GLSL +
   `wind.uniforms`) + `trampleBend` (TRAMPLE_GLSL + `trample.uniforms`). The new grass must call
   `wind.update` / `trample.push` / `trample.update` each frame, as `GrassPainterly.update` does, so stealth, wolves
   and `grassHeightAt` keep working unchanged. Shader SDF flowers (buttercup / daisy / lupine / edelweiss) in patches
   from `flowerKindAt`. **Near-field (0–3 m): the painted GRASS_CARDS** (`src/world/nalatiTextures.ts`) as crossed quads
   with alpha-to-coverage. These are grass *clumps* on the ground, which rule 1 allows (they're vegetation texture, not
   stand-ins for objects), but check them in the orbit strip. The hook is in `Grass.build()`
   (`if (LOOK_V2) → the v2 grass`). Budget on phone: ≤ 60 grass draws, ≤ 400k submitted tris; collapse blades
   per tile on the CPU where possible.
6. **Baked shadow / contact texture.** Rendered once (not per frame): a static orthographic depth pass of the static
   casters (POIs, dressing, outcrops, spruce) from the key-light direction over the slab at 2048², sampled by the
   terrain / grass / flowers, plus contact AO rings under yurts / rocks / trees. Keep CSM for dynamic things (creatures,
   the player) on desktop; on phone, evaluate the baked mask alone.
7. **Default** once `?look=v2` beats v1 at all 9 angles AND passes the walk-around (rule 4).

## Known issues / notes

- The game camera is **93.8° vertical FOV on phone** (poses.json), not the prototype's 60°. The codex mockups are
  horizontally stretched ~1.44× versus the captures. Compare against the captures' geometry.
- The panorama is golden-hour from about 200° to 330° (the sun is painted at 250°) and blue-sky elsewhere. The clock
  moves the real sun away from 250° / 26°, so the painted sun must be tinted or dimmed as the hour moves (step 1's
  re-grade).
- The prototype's plate seams and its hard sky-top fade are exactly what the user hated. Step 1's wide colour-matched
  zenith blend is the fix, so verify it looking straight up while turning.
- Bytes: panorama WebP ≈ 1 MB desktop / 0.5 MB phone, well inside the ~25 MB Nalati budget.

## How to test

- `?look=v2` on the shard URL: `http://127.0.0.1:5188/?chunk=nalati-grasslands&nolock=1&skipintro=1&look=v2` (+ `&tier=phone`).
- The 9 angles: `node scripts/nalati-camp9.mjs --tag=v2-stepN --look=v2` writes `progress/nalati-look/camp9/<tag>-sheet-pairs.jpg`.
  Beat `v1-baseline-*` (phone 105–120 calls, 1.48–1.94 M tris; Nalati phone target 30 fps).
- The walk-around (rule 4): add a script next to camp9 that orbits (95, 205) at r 25 m in 12 steps (FP, the player
  spawned on the circle facing the centre), walks the CAMP_SPUR track, looks at pitch ±1.2, and stands on Eagle Rock.
  Write one strip JPEG per run and look at every frame.
- For long capture runs, use a clean `git archive HEAD` export on its own vite port (5189+), not the shared :5188.
