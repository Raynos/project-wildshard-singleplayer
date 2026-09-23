# Nalati — the look pass (mockup parity)

The user, after the first in-engine shots (2026-09-22, ask N7): "the painterly style, the art style from the
mock-ups is like a hundred times better than the screenshots in engine … a massive pass over, not the content,
but the art direction, the rendering, the quality of the models, how we make the painterly style click …
procedural models … a lot of density in the world … walk around and really feel that everything is AAA,
polished, almost PS5 level."

**The target is the mockups, literally.** `art/nalati-grasslands/round-1/1-art-style/style-B-painterly.png` is the
master frame; every round-2/3 mockup is a second opinion. "Done" = a side-by-side of engine vs mockup at the same
pose where a stranger could believe they are the same game.

**Desktop tier is the PS5 target.** The phone tier (`?tier=phone`, 390×844) must still hold 60 fps: it gets the same
art direction with scaled density / cheaper post, never a different look.

## What makes the mockups look painted (the levers, in order of payoff)

1. **Aerial perspective.** Distance pushes everything toward a luminous sky-blue haze: distant hills lighten and
   desaturate in layers, the snow range is pale blue-white. This single cue is most of "painted landscape".
2. **Light.** A warm low sun (golden, WSW) and a cool sky fill; soft cel bands with a *painted* ramp (lit side
   warm/saturated, shade side cool blue-violet, never grey/black); a strong hemisphere bounce from the grass;
   rim light on silhouettes; matte (almost no specular) except a soft sheen on grass and water.
3. **Cloud shadows** sliding across the grassland, big cumulus with cel-shaded volume (lit tops, blue undersides),
   a painted gradient sky. Grasslands live on the sky.
4. **Grass.** Wide, soft, curved blades in clumps (not thin spikes), dense, varied height; colour graded root
   (deep olive) → tip (warm gold / fresh green) with patches of different grass tones across the hills; a moving
   sun-sheen that rolls with the wind waves; wildflowers in **drifts** (purple sage, white edelweiss, yellow
   buttercups), not uniform dots.
5. **Ground surface.** Macro colour variation (gold / green / olive patches following terrain), worn dirt roads with
   ruts, stones and grassy verges, gravel bars with pebbles, rock outcrops as real meshes on slopes, snow with blue
   shadows.
6. **Density.** Rocks and boulders with moss/lichen colour, shrubs, flower patches, stones along paths, fences,
   prayer-ribbon poles, felt rugs, firewood, pollen/dust motes in the light, birds, stove smoke. The mockups have
   something interesting every few metres.
7. **Model quality.** Silhouettes first: soft bevels, enough segments where the outline shows, painted vertex-colour
   gradients (AO in the crevices, lighter tops), secondary detail (yurt lattice + ropes + felt folds + ornament
   bands; horse manes/tails that flow, wolf fur ruffs; embroidered sleeves and leather gloves on the hands).
8. **Post.** A colour grade (warm highlights, teal-blue shadows, rich saturation), gentle bloom on sky and
   highlights, soft AO, vignette, sharpening; experiment with a **painterly filter** (anisotropic Kuwahara or a
   brush-stroke pass) on the desktop tier — keep it only if it gets closer to the mockups at 60 fps.

## Reference poses (the parity harness renders these)

| pose | mockup | what it tests |
|---|---|---|
| camp approach | `round-1/1-art-style/style-B-painterly.png` | the master frame: road, yurts, horses, spruce, river, peaks, planet |
| plateau grass | `round-2/1-combat/combat-C-bow-foot.png`, `round-2/3-features/stealth-1-crouched-hidden.png` | grass carpet, flowers, wind |
| horse plains | `round-2/2-creatures/horses-1-wild-herd.png` | open plateau, creatures, distance |
| spruce gully | `round-1/5-concept-art/concept-3-river-gorge.png` | trees, river, slope, rock |
| hitching rail | `round-2/2-creatures/taming-3-bonded.png` | camp detail, props, close models |
| kurgan field (dusk) | `round-2/4-named-elites/elite-2-kokbori-sky-wolf.png`, `round-1/3-enemies/enemy-2-balbal-warriors.png` | stones, dusk light |

## Owners

| lever | owner |
|---|---|
| painterly shader, post chain, aerial perspective, sky + clouds + cloud shadows, grade, the parity harness | look-director |
| terrain surface, roads, gravel, rock outcrops, snow | world-agent (B0) |
| grass + flowers | grass-agent (B1) |
| world density (scatter: rocks, shrubs, flower drifts, stones, fences, particles, birds) | dressing-agent |
| creature models (horse, wolf, sheep, dog, marmot) | creature-agent (B4) |
| POI models (yurts, camp props, bridge, kurgans, balbals, cairn, Eagle Rock, Crags) | poi-agent (B5) |
| first-person hands, sleeves, bow, sabre, spear | bow-agent (B2) + melee-agent (B3) |

Every agent: before/after shots at the relevant parity poses in `progress/nalati-look-*.jpg`, and the phone-tier
frame time in the report.

## Harness

`scripts/nalati-parity.mjs` renders the six reference poses above against the running dev server
(http://127.0.0.1:5188) and writes one side-by-side JPEG per pose and tier — **engine | mockup**, same height, ≤ 500 KB —
to `progress/nalati-look/<tag>-<pose>-<tier>.jpg`, with the frame time (p50 / p95, frame rate uncapped so the ms is the
real cost, not the vsync wait), draw calls and triangles burnt into the caption and written to `<tag>-perf.json`.

```bash
node scripts/nalati-parity.mjs --tag=03-my-change                  # all six poses, desktop (1600×900) + phone (390×844 @1.5)
node scripts/nalati-parity.mjs --tag=wip --poses=camp,kurgan --tiers=phone
node scripts/nalati-parity.mjs --engine-only                        # engine frames without the mockup half
node scripts/nalati-parity.mjs --help
```

- One headless Chromium on the host GPU (`--use-angle=metal`), loaded **once per tier**; each pose re-spawns the player
  (`__world.player.spawn`) and sets the day clock (`__weather.clock`), then settles 5 s (`--settle=`). The clock is
  frozen and the weather forced clear (`?clock=0&weather=clear`), so a set is reproducible.
- An HMR full reload (someone saved a file) is detected and the pose retried; a reload that never comes back is reloaded.
- The poses (x / z / yaw / pitch / time, a `phone` override for the narrow portrait frame) are `POSES` at the top of the
  script — change them there, not per run, so everyone's before / after shots stay comparable.
- The frame ms on a Mac is not an iPhone reading; the draw calls / triangles are the budget that carries over
  (phone ≤ 150 calls / ≤ 2.0 M tris). Other agents' browsers share the GPU: compare p50s within one run.
- The browser is closed at the end (the machine allows at most 3 game browsers). Commit a before and an after set per
  look change (`<nn>-<slug>` tags); `00-before` is the state at the start of the look pass (2026-09-22).

## Strategy change (2026-09-23): painted textures, a matte backdrop, paint-over targets

The user, after the `06-dressing` parity set: "the graphics are still nowhere near the mockups right? How are we
going to close the gap?" Tuning procedural vertex colour will not get there. The mockups are paintings: every
surface carries painted high-frequency detail, and their backdrop is a matte-painted snow range. So:

- **Painted textures** (codex image gen in the style-B look, tileable, WebP/KTX2 with a half-res phone tier,
  ≈ 4 MB desktop / ≈ 2 MB phone): meadow ground, dirt path, gravel, granite (triplanar), snow, spruce bark,
  felt + ornament cloth → `src/world/nalatiTextures.ts`, adopted by terrain, outcrops, yurts and spruce.
- **A 360° painted matte backdrop** of the real Nalati range and the Sky Grassland rolling away →
  `src/world/PaintedBackdrop.ts` (far plane, one draw call, takes the aerial haze and the day/night/storm tint);
  `Horizon.ts` keeps only the near and mid ridges in front of it.
- **Painted grass and flower alpha cards** for the near field (fine blades, much denser for the same cost),
  fading into the painted terrain.
- **Paint-over targets:** codex repaints our own engine frame at each pose in the mockup style, keeping its
  geometry. That gives a reachable target per pose next to the mockup.
- Owner of the assets: the painted-asset agent; adoption by the terrain, grass, POI and spruce owners; the
  look-director stays the arbiter.

## The clean-room result (2026-09-23): the new render path

The user asked for a from-scratch approach ("the gap seems like a canyon … brand new from scratch"). A clean-room agent
saw only the camp 9-angle sheets and three.js and built a one-file prototype of the FP-front view
(`dev/nalati-cleanroom/`; compare shot `compare-final-phone-3way.jpg`: old engine | prototype | target). It closes
most of the gap at 124 calls / 369 k tris on the phone tier. What it found, ranked:

1. **Paint everything far:** sky, clouds, gas giant, snow range, far foothills = painted panorama layers (~60 % of the
   frame, ~1 MB) — the biggest single win.
2. **Fog colour sampled from the painting**, so 3D dissolves into the painted horizon.
3. **Values:** the target is olive-golden and ~35 % darker than our lime greens, with deep grass roots; one shared
   in-shader grade (warm key, cool shade, a touch of contrast).
4. **The lighting cheat:** objects lit by a higher, more side-on light than the painted sun, so the foreground reads
   warm and front-lit.
5. **Density with zero per-blade storage:** GPU-built grass tiles in three rings, shader-drawn flowers, 1,300+ painted
   spruce sprites in one draw call.
6. **Bake shadows / contact darkening once** into a texture sampled by ground, grass and flowers.
7. **Layout from the capture, not the mockup** (the mockups are stretched ~1.44×).

Decision (parent, 2026-09-23): this architecture becomes the Nalati render path — ported by its author (the port
lead) behind `?look=v2` in `src/nalati/look/`, default once it beats the current look at all 9 camp angles. It
replaces the painterly sky / clouds / PainterlyRange, the current grass look and the far forest; gameplay hooks
(Wind, trample, grassHeightAt, stealth, weather) stay. Models: the sourced CC0 set (`public/assets/nalati/sourced/`)
and the local image-to-3D models (`public/assets/nalati/models/`).

**The user's hard rules for the port (2026-09-23, after playing the prototype: "so many cardboard cutouts … it only
looks good for screenshots … the grass is not bad … the fucking skybox transition").** Acknowledged by the port lead.
These override the prototype:

1. No cutouts, billboards or sprites for anything in the playable 500 m. Horses, trees (near and far on the slab),
   yurts, props and rocks are real 3D meshes that hold up when you walk round them and look from above. Impostors are
   allowed only as a distance LOD of a real mesh beyond about 120 m that doesn't read flat when circled. The
   prototype's painted spruce and horse sprites are not ported.
2. Painted imagery only at true infinity: sky, clouds, the gas giant and the far range as ONE seamless 360° panorama
   on a sky dome, with no plates, seams or visible transition (up, down, or turning). Never paint the mid-ground.
3. Keep and port the GPU grass rings + shader flowers, the olive / golden values + in-shader grade, the lighting model,
   the panorama-sampled fog, and the baked shadows / contact darkening.
4. Validation is by moving: every step passes the 9 camp angles AND a walk-around (a 12-frame orbit strip of the camp,
   the path, looking up and down, Eagle Rock), with every frame checked for cutouts, seams and popping.
5. Models come from the sourced CC0 set and the local image-to-3D models as they land.

State and next steps: `docs/design/nalati/handoff/port-v2.md`. The one continuous panorama (chained outpainting,
seam-checked) is in `art/nalati-grasslands/round-6-panorama/`.

### The camp 9-angle set (`scripts/nalati-camp9.mjs`)

The nine fixed cameras round the nomad camp (`art/nalati-grasslands/round-4-camp-9angle/poses.json`: 4 first-person at
the phone tier 390×844 @1.5 with the touch HUD, 5 free cameras from above at 1600×900 with the HUD hidden) re-shot and
measured per render step, against the round-4 codex remasters:

```bash
node scripts/nalati-camp9.mjs --tag=v2-step1 --look=v2     # the port's render path (?look=v2)
node scripts/nalati-camp9.mjs --tag=v1-baseline            # the shipping path
```

Output in `progress/nalati-look/camp9/`: `<tag>-<n>-<id>.jpg` per angle, `<tag>-sheet-engine.jpg` (3×3),
`<tag>-sheet-pairs.jpg` (engine | target, 3×3) and `<tag>-budget.md` (frame p50 / p95, calls, tris per angle against
the phone budget ≤ 150 calls / ≤ 2.0 M tris). Frame ms are vsync-capped (16.7 = keeping up), a Mac reading, not an
iPhone one. `v1-baseline` (2026-09-23): every angle 105–120 calls, 1.48–1.94 M tris, p50 16.7 ms.

### Paint-over targets (`scripts/nalati-paintover.mjs`)

`node scripts/nalati-parity.mjs --tiers=po-desktop,po-phone --engine-frames` saves the engine frames of the six poses at
the image model's sizes; `node scripts/nalati-paintover.mjs --runner=<codex-run2.py> --work=<scratch>` has codex
repaint each one in the style-B look while keeping its camera, layout and HUD. The results
(`art/nalati-grasslands/round-5-paintover/`) show up in the parity sheets as engine | paint-over | mockup.

### Decisions so far (look-director)

- **Kuwahara painterly filter: off** (`?kuwahara=1` to look again). At parity it smears the felt ornaments and grass
  tufts into watercolour, and the mockups are crisp, detailed digital paint. Cost ~2 ms at 1600×900.
- **Procedural painted range (PainterlyRange.ts): opt-in fallback** (`?paintedrange=1`). The snow range is now the
  painted 360° backdrop (PaintedBackdrop.ts).
- **Post chain (painterly):** Khronos Neutral tone map, no grain and no chromatic fringe, cool-blue AO, bloom only on
  highlights, then PaintGrade (greens lean warm, vibrance, a painted value range).
