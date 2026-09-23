# Clean-room rendering plan: painted meadow camp in three.js (phone first)

Proof: `index.html` (one file, about 900 lines, inline modules) plus `assets/` (2.3 MB of WebP). In the repo it runs
through vite: `http://127.0.0.1:5188/dev/nalati-cleanroom/?tier=phone|desktop` (`&hud=0` hides the meter, `&cam=x,z,yawDeg,pitchDeg`
poses the camera, `window.__bench(120)` measures). `tools/` holds the codex image runner, the sprite/tile/plate
pipeline (`process.py`) and the screenshot script (raw codex PNGs are not committed). Evidence is in `shots/`: `compare-final-phone-3way.jpg`
(old engine | prototype | target), `compare-final-phone.jpg`, `compare-final-desk.jpg`, the
`compare-v1…v8` iteration trail, and `other-views.jpg` (the plates reach all the way round).

---

## 1. Analysis: why the target reads as painted and lush, and the engine as a toy

The target is not "better shading". It is **more information per pixel, arranged by a painter.** The engine
frame has about 5 distinct values of green over half the screen. The target has hundreds of distinct
marks per 100 px² in the foreground, a composed sky, and a deliberate value structure (dark forest mass,
bright sky, mid-value meadow). Layer by layer:

| Layer | Target | Engine (old) | How shipped games do it | Phone-budget translation |
|---|---|---|---|---|
| **Sky + clouds** | Fully painted: sun glow, rim-lit cumulus, lavender undersides, dozens of cloudlets, planet hazed by atmosphere | Procedural gradient, a few cartoon cloud blobs, white blown-out sun | BotW/Genshin: painted or hand-authored sky domes and cloud cards; Firewatch: painted skybox with a colour ramp; Ghost of Tsushima: authored volumetric clouds (not for phones) | **Matte-painted plates on a cylinder.** About 0.2 MB each. This alone is more than 40% of the frame. |
| **Far mountains** | Massive jagged snow range, 3–4 receding haze layers, sunward faces warm and shadow sides blue | Two tiny grey cones | Almost every game fakes this with skybox paintings or low-poly silhouettes plus a matching fog colour | **Painted into the plates.** Never geometry at this range. |
| **Mid terrain (hills, forest)** | Dark saturated spruce mass with painted rim light, hazed ridges behind | Flat green plane, a row of cone trees | Genshin/BotW: impostor trees (billboards or octahedral impostors) past 50–100 m | **Painted-sprite billboards** (4 hand-painted spruce), 1 instanced draw, alpha-to-coverage edges |
| **Near ground** | Blade-level grass, value-rich (dark roots, golden tips), flowers in species patches, pebble path | One flat green colour, white stone decals | Ghost of Tsushima: GPU-procedural blades in tiles (about 100k+); Genshin: grass cards; Sable: flat colour with line work | **GPU-procedural blades, zero CPU data,** in world-snapped tiles and 3 LOD rings, plus a painted ground under them |
| **Flowers** | Yellow buttercups, white daisies, edelweiss, lupine spikes, in patches, sized so they read | Yellow specks | Cards / meshes placed by density maps | **Procedural SDF billboards** (4 species, 0 bytes), patch-noise distribution |
| **Water** | Turquoise glacial braids, white-water streaks, bright sparkle | Flat light-blue ribbon | Flowmaps, foam masks, depth-based shallows | Braids come *from the terrain* (bed dips below water level), plus a scrolling-foam strip shader |
| **Structures** | Yurts with a crisp ornament band, felt texture, radial roof seams, dome light falloff | Plain white domes | Hand-textured low-poly | Lathe geometry + **one painted felt texture** (the ornament band is the whole read) |
| **Characters** | Painted horses, saddle blankets | Low-poly rig | Rigged meshes near, impostors far | Painted-sprite horses at camp distance (animals near the player stay rigged meshes) |
| **Light model** | Golden hour, *art-directed*: the sun sits front-right in the sky but objects are front/side-lit (a painter's cheat) | Neutral midday, flat | Genshin/BotW: separate "key" for characters vs sky sun; ramp shading | **Two directions:** a painted sun for glow and translucency, a key light for shading. Wrap diffuse + sky/ground hemisphere. |
| **Shadows / AO** | Soft, few, long; dark root zone in the grass is the main "AO" | None visible | Cascaded shadow maps (Tsushima), baked lightmaps (Firewatch) | **Baked once on the CPU** into a 1024² mask (projected silhouettes + contact AO), sampled by ground, grass and flowers. Zero runtime cost. |
| **Aerial perspective** | Every distance layer a step bluer and lighter; horizon haze matches the painted sky exactly | Uniform grey-white fog | Height fog with an inscatter colour taken from the sky | **Fog colour sampled from the painted plates** (per-azimuth lookup), near 30 m kept clear, so 3D dissolves *into* the painting |
| **Colour grade** | Warm highlights, cool shadows, olive/golden greens (never lime), contrast S-curve | Saturated lime + sky blue, low contrast | LUT grading on everything | Grade function inlined in every shader (no post pass on phone) |
| **Edges** | Soft painted anti-aliasing, crisp silhouettes | Jaggy, then over-blurred | MSAA / TAA | Canvas MSAA 4x + alpha-to-coverage on cut-outs |
| **Detail frequency** | High near, medium mid, painted far: detail matches *pixel density* at every distance | Low everywhere | LOD everywhere | Density rings for grass/flowers; textures at 2 scales; paintings far away |
| **Composition** | Framing, leading path, value masses (dark left forest / bright sky / warm meadow) | Arbitrary | Level art direction | Place objects from the target's angles (the camp sits about 66 m out, not 40 m) |

### Why the engine reads as a toy (ranked)
1. **About 60% of the frame (sky + far) is procedural and low-information.** A painting fixes this for about 1 MB.
2. **Value structure is missing.** Lime ground, uniform light, no dark masses. The target's greens sit around luminance 60–90 (8-bit) with deep roots; the engine's sit at about 150.
3. **Ground detail density is about 100x too low.** Flat colour with stone decals, versus blade-level detail.
4. **The fog colour does not match the sky**, so 3D and backdrop look like separate things.
5. **Composition and scale.** The camp, trees and mountains are the wrong size for the camera.

---

## 2. Architecture (recommended for the real game)

**Principle: paint what's far, generate what's near, bake what's static, grade everything the same way.**

```
 far  (> ~400 m)   PAINTED PLATES   4+ matte plates on a cylinder, cross-faded; zenith gradient above
                                    -> fog LUT (256x1) sampled from the plates' horizon band
 mid  (60-400 m)   IMPOSTORS        painted-sprite trees / animals / props, 1 instanced draw per atlas
                   TERRAIN          camera-centred polar grid (35k tris) reading a half-float heightmap
 near (0-60 m)     GPU PROCEDURAL   grass blades: 3 rings of world-snapped tiles, blades built from
                                    gl_InstanceID + hash (no per-blade buffers); SDF flower billboards
                   GEOMETRY         yurts (lathe + painted felt), fence, props, rocks
 all               SHADING          one shared GLSL chunk: key light wrap + hemisphere + baked shadow
                                    mask + translucency + grade() + applyFog() -> writes sRGB directly
 phone post        none             (MSAA 4x from the canvas; the grade lives in the shaders)
 desktop post      optional         bloom on the sun and highlights, sharpen; not needed for the look
```

**Geometry vs texture vs impostor vs painting**
- Painting: sky, clouds, planet, mountain range, foothill forests (everything past about 400 m). Must be
  authored as **one continuous 360° panorama** (the prototype's 4 separate AI plates show seams, see risks).
- Impostor: spruce (4 painted variants, 1,300+ instances), horses at distance, and later haystacks, carts
  and eagle perches past 30 m.
- Procedural geometry: grass, flowers, water, terrain.
- Real meshes: yurts, fence, props, anything the player touches or that is within 30 m and silhouetted.

**Textures: hand-painted or AI-generated (codex image_gen, as in this prototype)**
- 4 plates at 1536×1024 (use 2048×1024 or wider on desktop): **about 0.8 MB WebP**.
- Tiles at 1024²: meadow, path, gravel, forest floor (**about 0.8 MB**). Sampled at 2 scales plus macro noise.
- Sprite atlases: spruce (0.5 MB), animals (0.12 MB), yurt felt with the ornament band (0.12 MB).
- **Total about 2.3 MB for this scene.** Production budget: **≤ 6 MB per biome** with a KTX2/Basis GPU
  format (halves VRAM on phone).

**Lighting model.** Art-directed, not physical. A painted sun direction drives glare and grass translucency.
A higher key light drives shading so the foreground reads warm and front-lit, the way the painting cheats.
Wrap diffuse (0.25–0.55) and a sky/ground hemisphere ambient. The baked shadow mask is multiplied in. All
shaders call the same `grade()` (filmic shoulder, saturation 1.05, cool-shadow / golden-light split, mild
S-curve) and `applyFog()` (clear to 30 m, exponential after, colour taken from the plates).

**LOD / density.** Grass rings are {4 m tiles × 8², 8 m × 12², 16 m × 14²} on phone (spacing 0.08 / 0.20 /
0.45 m, blade segments 3 / 2 / 1). Each ring cuts out the inner ring's square per blade, and the last ring
fades radially. Tiles are frustum-culled by three.js through their bounding sphere, so with a 30° horizontal
field of view only about 15% of the tiles draw. Flowers use one ring (80 m) with distance thinning. The
terrain is a polar grid that follows the camera (dense near, 1.8 km far).

**Tiers**

| | Phone (390×844, DPR capped at 2) | Desktop (1600×900) |
|---|---|---|
| Grass spacing (m) | 0.08 / 0.20 / 0.45 | 0.05 / 0.14 / 0.32 |
| Grass rings / flower ring | 8, 12, 14 tiles per side / 80 m | 8, 14, 18 tiles per side / 112 m |
| Terrain | 90 rings × 128 segments | 120 × 192 |
| Post | none | none now (bloom optional) |
| Target draw calls | ≤ 80 | ≤ 300 |
| Target triangles submitted | ≤ 250k | ≤ 3M |

### Measured (prototype, `window.__bench(120)`, forced GPU sync per frame)

| Tier | Drawing buffer | ms/frame (GPU+CPU, synced) | Draw calls | Triangles submitted |
|---|---|---|---|---|
| phone | 390×844 (DPR 1) | 1.6 | 124 | 369k |
| phone | 780×1688 (DPR 3 capped at 2) | 1.7 | 124 | 369k |
| desktop | 1600×900 | 4.8–6.4 | 255 | 2.59M |

These numbers are from a **headless Chrome on an Apple M5 Max through ANGLE/Metal. They are not phone numbers.**
A modern phone GPU (A17/A18, Snapdragon 8 Gen 3) is roughly 8–12x slower than an M5 Max. **Estimated
phone time: about 14–20 ms,** which is at the edge of 60 fps and not yet safe. rAF sat at vsync (16.7 ms) on
both tiers. "Triangles" counts every collapsed (culled-in-shader) blade too: roughly 40–50% of the submitted
phone triangles are degenerate.

---

## 3. Risks (honest)

1. **Plate seams and consistency.** The 4 AI plates were generated separately. The front plate's edges don't
   continue into the side plates (a bright hazy seam is visible at about +35°, right edge of the desktop shot).
   Fix: author one continuous panorama (outpaint plate N+1 from plate N's edge, or paint a single 8k strip),
   and give all 4 the same sun and time of day.
2. **Phone GPU time is unproven.** The fix list is known: merge tiles into one multi-draw per ring
   (`WEBGL_multi_draw` / BatchedMesh-style), cull blades per-tile on the CPU instead of collapsing them,
   drop ring 2 on phone and let the painted ground carry it, and use half-res plates on low tiers. This needs
   a real device session (Safari Web Inspector timeline, or an Android GPU profiler).
3. **Near-field grass is the weakest layer.** Within 3 m the blades read as large dark triangles on phone.
   The target shows fine stroke-like blades. Needs textured blade cards (a painted strip with alpha) for the
   first 3 m, plus more flower heads near the camera.
4. **Billboard impostors turn with the camera.** That's fine for spruce, but horses are painted side views
   and read wrong when you walk around them. Use octahedral impostors (8–16 views baked from a real model), or
   meshes within 30 m.
5. **The AI art pipeline is unreliable in composition.** The first front plate had a V-shaped valley exactly
   where the camera looks, and the plate runs hotter (more orange) than the target, so the shader cools it
   away from the sun. Budget for re-rolls, and gate every plate with an in-engine screenshot.
6. **The target itself is aspect-distorted.** The mockups are 2:3 re-renders of 390×844 captures, so they're
   horizontally stretched about 1.44x. Layout must be derived from the *capture* geometry, not measured off
   the mockup. The implied camera is narrow: about 60° vertical, 30° horizontal on portrait.
7. **Time of day is baked into the paintings.** A day/night cycle needs 3–4 plate sets and cross-fading, or
   separate painted layers (sky ramp / clouds / mountains) with tinting.

---

## 4. What to build next (in order)
1. One continuous 360° plate (outpainted) per time of day. Refit the fog LUT.
2. Near-field blade cards (0–3 m) and denser near flowers. Pebble decals on the path edges.
3. Phone perf pass on a real device: multi-draw tiles, CPU tile culling, ring budget per tier.
4. Octahedral impostors for horses, carts and the eagle perch. Real rigged horse within 25 m.
5. Water: flow along the bed gradient, more white-water streaks on the braids, sparkle.
6. Desktop extras: bloom and a sun-shaft sprite, and a real shadow map for the camp only (static, rendered once).
