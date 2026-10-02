# Sky Reach style bible: **Gilded Air**

**Ask:** E374 (SKY-REACH P2). **Owner:** the Sky Reach look-loop builder. **Source:** Jake, 2026-10-01: "Choose your own
art style for shard 5 and shard 6. Bonus points for matching the art style from the mock-up … It can be a new and unique
art style based on the art style in the mock-up." Sky Reach's own style, derived from `art/far-reach/round-1-proposals/B-sky-reach.jpg`
and the round-11 targets (`art/far-reach/round-11-review/mockup-A-spawn-look.jpg`, `mockup-D-crown-arena.jpg`).

**Gilded Air** is a storybook painting of an evening above the clouds. It is lit like a golden-hour photograph, shaped
like a low-poly diorama, and coloured like a gouache illustration. It is not Driftwood's flat toon (no hard two-band
ramp, no outlines), not Nalati's painterly grassland (no olive remap, no painted ground textures), and not Pine Hollow's
PBR. The one-line test: **every frame looks into a warm sun, and nothing in it goes black.**

## 1. Light (the shading model)

- **One sun, low and ahead.** Elevation ≈ 8°, sitting just left of the windmill isle from the spawn (`look/sun.ts`
  `SUN_DIR`). The route looks into it. Back-light is the mood; it never moves overhead.
- **The painted light** (`look/light.ts`, one patch of three's `lights_fragment_end`, every lit material):
  - **Warm bounce**: a soft wrap light from the anti-sun side, a little above the horizon: the gold sky scattered back
    onto every face the player sees.
  - **Rim**: a sun-coloured fresnel edge, strongest when the sun is behind the surface and on vertical faces (island
    lips, the windmill, pines, creatures, the fan).
  - **Shade floor**: a shaded surface keeps at least a warm-plum share of its own albedo.
- **Fill**: hemisphere sky `#d8c2d6` (lilac), ground `#c9935c` (gold bounce), intensity 1.4.
- **Shadows** are warm plum, never violet-black. Grade shadow tint `[1.04, 0.95, 0.98]`.
- **The mockup's numbers** (CIE L*, the world band, `stats.py`; a description of mockup A, not a pass bar): mean L* ≈ 59,
  p10 L* ≈ 25, about 17 % of the frame under L* 30.

## 2. Palette

| Region | Lit | Shade | Notes |
|---|---|---|---|
| Sky zenith → horizon | `#8d9ccf` → `#efb9ad` → `#ffd89c` | — | blue-lavender to peach to gold; sky L* ≈ 75 |
| Sun and bloom | `#ffdba2` | — | a hot core and a wide warm wash |
| Cumulus | `#ffe0c4` tops | `#b08fb4` bellies, `#e0a294` toward the sun | silver lining on edges toward the sun |
| Cloud sea | `#fff0e2` tops | `#c2a9c6`, `#e9b7a6` toward the sun | melts into the horizon gold with distance |
| Grass | `#a9bb66` | `#8fa85a` | spring green with gold tips; never olive-grey |
| Keel strata | `#8a7468` | `#6a5560` | warm brown-grey rock, never violet-black |
| Wood (planks, posts) | `#8d6a4c` | `#5a3f2e` | |
| Rope, sail cloth, tower stone | `#d6c095`, `#e8dcc4`, `#d8cfc2` | | white stone, cream cloth |
| Pines | `#3f5a3c` | | deep green, wind-bent |
| Glow (hover glass, wind, magic) | `#9fe6f2` | | the one cool accent; the fan's teal sits next to it |
| Distant islands | `#9d8fb8` | `#e2ad8c` sun side | hazy, in the matte only |

Hue spread target ≥ 60° (the mockup's 62°): green ground, gold sun, pink cloud, blue zenith, cyan glow. Chroma stays
moderate (mean ≈ 15–20): this is gouache, not neon.

## 3. Form, edges and outlines

- **Low-poly forms, soft painted surfaces.** Facets may show on rock and wood; the island tops do not show their
  construction (no radial fan of triangles: subdivide or jitter).
- **No outlines, no ink lines.** Edges read through the rim light and value contrast only.
- **Irregular silhouettes**: island rims are noisy, keels jagged with hanging spires, roots and vines; nothing is a clean
  cone. Islands vary in size and height.

## 4. Sky

- The sky is half of every frame. A **painted dome at infinity** (`look/sky.ts`): gradient, sun bloom, a baked cumulus
  panorama (banks low, wisps high, lit tops and shaded bellies), and a band of distant floating-island silhouettes in the
  haze. Nothing painted sits in the playable space (Jake's no-screenshot-cheats rule).
- **The cloud sea** (`look/cloudSea.ts`): two layered sheets, an opaque floor and drifting puffs, lit from the sun.
- **Storm (the crown only)**: a lit swirling volume over the arena, bruised violet with gold edges, never faceted puffs.

## 5. Materials

- Vertex colour plus painted variation: macro colour noise across the grass, gold tips on clumps, darker strata bands
  on keels. No PBR texture sets, no normal maps; roughness high, metalness 0 except the fan's bronze ribs.
- The generated models (C6) keep their baked shape and AO (60 % floor) and take the Gilded Air palette.
- Glass (hover bridges) is the cyan glow: emissive, half transparent, brighter while you ride.

## 6. Creatures

- Pale against the sky: the drift ray sky blue on top, near-white below, a cyan tail; the Roc banded pale on its
  underside; the wisp a visible knot of wind streaks. A creature never reads as a dark slab.

## 7. FX

- **Wind is visible**: streak ribbons along gusts, the updraft and island rims; the GUST is a cone of streaks with
  petals; the updraft is a soft spiral with rising leaves. Grass sways, sails turn and flutter.
- Bloom is gentle (intensity 0.15, threshold 0.9), mostly on the sun and the glow accent.

## 8. Banned

- Black or violet-black shade; any surface reading under L* 15 in daylight.
- Flat lavender cards: a sky with no clouds; islands with no rim light.
- Outlines and two-band toon ramps (that is Driftwood's style).
- Navy as a material colour (the old fan); dark creatures against the sky.
- Faceted hexagonal cloud puffs; stacked white rings for wind.
- Anything painted in the playable space; screenshot cheats.
- Moving the sun overhead or a day cycle (the hour is fixed).

## 9. How the LOOK-LOOP uses it

Every target in `art/far-reach/round-12-loop-<n>/` is an image-model edit of a live capture with this bible in the
prompt's COMMON block: the palette table, the light model and the banned list. ΔE00 is measured per region of §2
(sky, cloud sea, grass, keel, wood, creatures).
