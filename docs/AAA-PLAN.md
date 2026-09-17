# Plan: closing the gap to the `art/` mockups

The mockups (`art/mockup-01…05`) define the target look. What they have that the engine
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
