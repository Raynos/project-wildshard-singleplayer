# Plan: closing the gap to the `art/` mockups

The mockups (`art/pine-hollow/round-1-target-look/mockup-01…05`) define the target look. What they have that the engine
build does not, ranked by how much of the "PS5 feel" each one buys us:

| # | Gap | What the mockups do | What we build | Owner |
|---|-----|---------------------|---------------|-------|
| 1 | **Golden-hour light** | Sun ~8° above the horizon, orange key light, deep blue-grey shadows, everything backlit with rim light, long shadows across the trail | Sunset HDRI (kloppenheim/rosendal sunset puresky) with the CSM sun matched to it; sun colour `(1.0, 0.72, 0.45)`, intensity ↑, hemisphere fill cooler; needle + grass **translucency** term (sun through leaves), trunk **rim light** via Fresnel warm term | main |
| 2 | **Volumetrics** | Thick god rays fanning through trunks, warm haze in the distance, mist pooling in hollows | God-rays weight/density ↑ + warm tint; aerial perspective: fog colour → sun colour near the sun, blue away from it; height fog thicker below the hollow line; ground-mist sprites (particles agent) tuned warm | main |
| 3 | **Forest floor density** | Every square metre has grass tufts, ferns, needle litter, twigs, small stones, moss on roots, tiny blue flowers; trail edges have taller grass | Grass density ↑ near trails and clearings, fern clusters under trees, a **moss/needle-litter splat layer**, scattered stones + twig litter instanced, flowers sprinkled in the grass instanceColor | grass agent + props agent |
| 4 | **Scots-pine trunks** | Tall bare trunks, plated dark bark low, **orange papery bark high**, big root flares, lean variety, crown only in the top third | Bark shader: height-gradient tint (dark grey-brown → orange), root-flare geometry, trunk heights 24–32 m, sparser lower branches; mix 25 % spruce silhouettes | main |
| 5 | **Beyond the chunk** | Mountain ridges on the horizon, a **sea of clouds below** the floating slab, warm cloud undersides | Distant ridge silhouettes (3 rings of noise-displaced ridges at 1.2–3 km, fogged), cloud-sea plane at −60 m with the cloud shader, cloud dome lit from below at sunset | main |
| 6 | **Post grade** | Filmic contrast, warm highlights / cool shadows split-tone, soft bloom halo around the sun, subtle grain, vignette | Custom `GradeEffect` (split toning + lift/gamma/gain), bloom threshold ↓ around sun, `NoiseEffect` grain 0.03, keep AgX | main |
| 7 | **Cabin dressing** | Mossy shingle roof, chimney smoke, warm window light, woodpile, axe in stump, tripod cooking pot, rubble | Moss overlay on roof material, emissive windows warmer + point light, tripod + pot prop, stone rubble scatter around the foundation | cabin agent |
| 8 | **Hero weapon** | Massive crossbow filling the lower third, twisted cord, iron bands, tiller wood grain, leather | Scale viewmodel ↑ 1.35×, move closer, add twisted-cord string texture, wear on edges | weapon agent |
| 9 | **Animals in the scene** | Deer at the tree line, boar in ferns with range readout | Range readout "BOAR · 15 M" when aiming at an animal (HUD), herds prefer clearings in view of the trail | main + animals agent |

Execution order (each step screenshot-verified against the matching mockup):
1. Sunset lighting + volumetrics (1, 2) — biggest change per hour.
2. Horizon: ridges + cloud sea (5) — sells the floating chunk.
3. Trunk shader + tree mix (4).
4. Grade + grain (6).
5. Integrate agents' features, then push density (3), cabin dressing (7), weapon scale (8), range readout (9).

## Status (2026-09-17)

| # | Item | State |
|---|------|-------|
| 1 | Golden-hour light | done — `qwantani_sunset_puresky`, warm CSM sun, needle translucency, bark rim gradient |
| 2 | Volumetrics | done — depth-aware ray-marched height fog with sun in-scatter + screen-space shadowing (`src/core/Volumetrics.ts`), god rays + corona, valley mist sprites |
| 3 | Forest floor density | done — ~50k grass clumps, 6k ferns, moss, litter, stones, flowers, reeds |
| 4 | Scots-pine trunks / crowns | done — bark height gradient, three-card fans with drooping tips, near-field photoscan twig quads (< 38 m), shaded undersides |
| 5 | Beyond the chunk | done — three ridge rings with snow caps, cloud sea below the slab, cloud dome |
| 6 | Post grade | done — AgX + split-tone `GradeEffect`, grain, contrast |
| 7 | Cabin dressing | done — moss roofs, plumes, lanterns, room lights, camp with tripod/pot, rubble, barrels |
| 8 | Hero weapon | done — walnut/blued-steel materials, mockup framing, range readout |
| 9 | Animals in the scene | done — herds at trail edges, fur shells within 18 m, breathing, look-at, corpse settle + fade |

Verified: 60 FPS at 1600×900 on Apple M-series with everything on; mouse-look, sprint, ADS (72→50 FOV), fire/hit/kill, harvest and doors exercised through the real entry.
