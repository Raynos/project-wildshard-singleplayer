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
