# Round 24, the render lane: the global look (E281)

The render agent's passes toward the four round-6 mockups and the eight round-15 domes: the key and ambient light, the
sky and the colour script, the warm light in the drizzle, the wet ground, the mist and the post chain. Every sheet is
**target | previous pass | this pass**, one per dome (its nine views) plus the four mockup cameras on the phone frame,
captured with `scripts/nine-dragon-domes.mjs` from a clean export of HEAD plus the lane's files (tier phone, 3×).

Pass 0 (the lane's baseline, `f9ca6490`): flat grey overcast daylight against the targets' blue hour. Measured on the
dome views: the targets' darks sit ~10 L* under ours (p10 L* 16 against 23–40) while the lights match, and their colour
is richer (mean saturation 0.3 against 0.2). The square's floor was a flat salmon wash: the light volume's four terms
(diffuse, wet sheen, gloss lobe, rim) each lit it from the faint field hundreds of lanterns add up to. White daylight
cumulus (the engine's cloud dome) filled every look-up.

## Pass 1

`pass-1/`, captured at `c3b14631` + the lane's files.

| Change | File | GPU cost on the phone |
|---|---|---|
| The engine's cloud dome hidden: the shard's painted sky is the whole sky | `look/render.ts` | −1 draw, −a full-sky two-texture fill |
| The sky a deep cerulean (#4674b4 → #6a80a6), the far air a deeper blue haze (#8596b6), the shaded faces an ink-blue (#7a86a6); the game never called `setLook`, so `Shared.u` is the live look and `LOOKS.jiehua` now says the same | `look/style.ts` | none (uniforms) |
| Ambient 0.78 → 0.62 on every wash (the lights, pools, spill and ink keep their value) | `look/light/install.ts` | none |
| The pools' knee, E²/(E + 0.3): a lantern's pool stays, the faint field between them drops away; an up-facing surface keeps half the diffuse pool and 15 % of the rim (the floor's "rim" was the field under it) | `look/light/lightvol.ts` | ~6 ALU per volume read |
| Wet granite darker (wet darkening 45 → 60 %): the lights live in its reflections | `look/style.ts` | none |
| The phone's streak cards at full strength (they were cut to 60 % on screen for a screen-space reflection the phone does not draw) and ×1.5 | `look/render.ts` | none (same cards; a few more pass the dim-card cull) |
| Light halos: one instanced additive draw of soft discs round every lantern, lamp, lit shop and neon sign, fog-attenuated per corner, capped at 12 % of the view's height, faded near the eye. The phone has no bleed pyramid, so it had no glow at all | `look/light/halos.ts`, `look/render.ts` | +1 draw (net 0 with the clouds), ALU-only fragments; the fill is the paifang's cluster at worst |
| The composite's blue-hour toe (darks × 0.5 fading out by luminance 0.32) and vibrance 0.3 (the dull washes lifted most, cinnabar and neon left alone) | `look/render/jiehua.ts` | ~15 ALU per pixel |

Reverted in the live tuning before the commit: saturation as a flat 1.2–1.3 (the gate's cinnabar and the timber bridge
went over, 0.4–0.5 mean saturation against the targets' 0.3; vibrance replaced it), a navy sky (#22345a: darker than any
target's sky), pool gains cut as a whole (they dimmed the shopfronts' pools with the floor's).

Memory: geometry 168.5 MB, textures 79.6 MB (pass 0: 168.7 / 79.6). Worst pose: mockup A, 162 draws, 1.66 M triangles
(pass 0: the same).

## Pass 2

`pass-2/`, captured at `4fea5c24` + the lane's files (the other lanes moved too: the Well's pass 3 and the stair's
pass 1 are in both columns' difference, so this pass was judged in the live tuning, one build, the lane's uniforms
switched per variant).

| Change | File | GPU cost on the phone |
|---|---|---|
| The pools' soft ceiling, E / (1 + E / 0.8): under the gate's ~20 lanterns the plinths, the walkers and the floor were one flat orange | `look/light/lightvol.ts` | ~4 ALU per volume read |
| The knee 0.3 → 0.4, and an up-facing surface keeps 30 % of the diffuse pool (was 50 %) | `look/light/lightvol.ts` | none |
| The halos 1.3 → 2.0 and ×1.2 wider: the lanterns hang in their glow, as in the targets (2 006 discs) | `look/light/halos.ts` | a little more fill round the clusters |
| The sky screens: saturation 1.1 → 1.3, their fog 0.45 → 0.32 (the targets' screens are vivid azurite and malachite) | `look/scroll.ts` | none |
| Silk clouds in the painted sky: soft pale drifts lit from below, faded toward the horizon (the flat blue read as a CG fill once the white cumulus went) | `look/style.ts` (sky) | two value noises per sky pixel |

Reverted in the live tuning: the lit air (the light volume read twice along each view ray in the composite, the phone's
haze march without a target): at σ 0.004 it washed the gate orange and lifted the darks (A2·5 p10 L* 24 → 31), as the
desktop haze march had in round 14. Filling each sky screen with the painting (span = the screen's depth): one huge
mountain on a flat teal field instead of the scroll's range. Long anisotropic cloud bands: they drew rays toward the
vanishing point low in the sky (C1·1).

Memory: geometry 165.2 MB, textures 79.6 MB (the fabric lane's diet in the same build). Worst pose: mockup A, 161 draws,
1.51 M triangles.

## Pass 3: high key (the coordinator's eye-check) and the Well's mist (the Well lane's request)

`pass-3/`, captured at `6249a22b` + the lane's files. The coordinator's eye-check of passes 1–2 on the four mockup
cameras: the wet streaks and the neon read better, but A and C sank into a purple night. The mockups are high key: a
bright silver-blue silk, a pale sky, mid-grey wet stone under bright reflections, warm lanterns as accents. Measured on
the mockup frames' world region (L* p10 / p50): the mockups 29–33 / 48–60, pass 2 2–4 / 31–38, **pass 3 26–33 / 50–60**.
The Well lane's request: from the rim, 50–80 m down the mist passed only a quarter of the light and the deep levels and
the temple read as a pale floor.

| Change | File | GPU cost on the phone |
|---|---|---|
| The toe lightened to 0.8 (only the deepest darks) and vibrance 0.3 → 0.15; a lit-side warm split (+6 % red, −6 % blue above luminance 0.06 → 0.4) over the cool shadow lift | `look/render/jiehua.ts` | ~6 ALU per pixel |
| The ambient 0.62 → 0.9, the shaded faces #8f9ab4, the wet film's sky sheen 0.1 → 0.3 (mid-grey silver stone) | `look/light/install.ts`, `look/style.ts` | none |
| The silk: a pale silver-blue (#b8c2d2) at twice the density (0.0052 → 0.01), the sky a soft cerulean (#6f94c8 → #b3c3d8) | `look/style.ts` | none |
| Lights cut through the silk harder (emitters × T^0.25, was T^0.35): the lit windows, lanterns and neon down the Well and across the far city | `look/style.ts` (`EMIT_FOG`, shared by every program) | none |
| The Well's mist: the cloud strata at half their depth, the depth silk 0.05 → 0.02, the base air's thickening under the square capped at 1× (was 2.5×), and the shaft's silk takes the strata's pale colour script (`uShaftLit`) instead of the grey-blue base air | `look/style.ts` | none (uniforms; the cap and e-fold became uniforms) |
| The streak cards: the phone's ×1.5 back to ×1 and the stair's ×2 to ×1.3 (a curtain of colour over the stone the mockups keep visible), and the warm lights' runs ×2.5 (`uCardWarm` 1.5: the neon's power is ~8× a lantern's, so the stone carried magenta and cyan only) | `look/render.ts`, `look/streaks.ts` | none |

Kept from the eye-check: every mockup frame reads high key at blue hour; the paifang keeps its warm lanterns; mockup D
shows the levels stepping down into the mist; mockup B's silk thins into the run north. Traded: the domes' dusk views
(their targets are darker than the mockups) and the aerials read paler and hazier than their targets; the mockups won,
as the coordinator asked. Rejected in the tuning: dropping the toe entirely (flat, no ink in the darks), the warm-cards
boost without the gain cuts (orange curtain on the stair).

Memory: geometry 157.0 MB, textures 79.6 MB (the fabric lane's diet in the same build). Worst pose: mockup A, 125 draws,
1.50 M triangles.

## Pass 4: the stair's streaks (the stair lane's eye-check) and the aerials' haze

`pass-4/`, captured at `be97ea90` (the stair's sky screen removed) + the lane's files. The stair lane: the neon streaks
ran as full-saturation bands the whole flight wide and drowned the treads; mockup C and the C domes show three or four
thin broken stripes on mid-grey wet stone with every tread edge readable.

| Change | File | GPU cost on the phone |
|---|---|---|
| The stair's card sets narrow (width 0.4 → 0.12) and broken (dash 0.45 → 0.8) | `look/streaks.ts` | less fill (a third of the cards' width on the stair) |
| The square's runs a little narrower (0.4 → 0.3) and more broken (dash 0.6): separate stripes with the stone between them | `look/streaks.ts` | less fill |
| The silk over the datum thins faster (e-fold 45 → 18 m, floor 0.35 → 0.2): pass 3's denser silk turned the aerials over the square into a pale haze; the eye-level views keep theirs | `look/style.ts` | none |

Memory: geometry 156.2 MB, textures 79.6 MB. Worst pose: mockup A, 125 draws, 1.49 M triangles.

## Pass 5: three features (the far skyline, the tread glints, the amber pools) and the square lane's notes

`pass-5/`, captured at `d5acb0c2` + the lane's files. The uniform levers were spent after pass 4, so pass 5 adds shader
features, in the look files only: no textures, no render targets, no new draws.

| Change | File | GPU cost on the phone |
|---|---|---|
| **The far Stack at infinity**: four layers of procedural pagoda and tower silhouettes painted into the sky shader round the whole sky, the farther layer higher (高遠, the hanging scroll's high distance), each layer's feet dissolving into a band of silk, lit windows on the nearer ones. One seamless panorama (whole cells round the sky), never a card in the playable space. It stands 33–60° up, the only sky the fragment shows (the gaps between towers and decks looking up) | `look/style.ts` (FS_SKY `skyline`) | 4 layers × ~40 ALU per **sky** pixel only: the sky now draws after the opaques (render order 900, depth-tested at the far plane, `look/render.ts`), so it shades only where sky shows. Before, it filled the whole screen under the city (depthTest off) |
| **Tread and riser glints**: a wet step's tread top (under 0.6 m deep) and a riser's top edge (the nosing seen from below) catch broken, twinkling cells of light just inside the ruled ground line: the lamps' reflection (one light-volume read along R) and the sky's. Far off they average into one bright line | `look/style.ts` (FS_JIEHUA) | one volume read + ~25 ALU on wet step faces only |
| **Amber pools**: the floor keeps 80 % of an amber light's pool (lit shops, stalls, lamps; g / r ≥ 0.28–0.42 on the raw irradiance) against 30 % of the lanterns' red-orange field (which washed the gate's floor salmon in pass 1), plus a warm sheen of it on wet stone | `look/light/lightvol.ts`, `look/style.ts` | ~6 ALU |
| The square lane's notes: the lanterns' halos ×3 and the shops' ×2 (per-kind gains, `uHaloKind`), so each lantern reads as a lit red globe at 20–40 m; the mineral accents (the paifang's cinnabar, the roofs' malachite) take T^0.35 of the silk (a pigment holds its colour through the silk) | `look/light/halos.ts`, `look/style.ts` | none |
| The square lane's notes: the flagstones as big wet granite slabs, a stronger per-stone value swing (0.3 → 0.5) and granite speckle (0.52 → 0.8), the granite paint at 0.3 on wet stone, the joints at least 12 mm | `look/style.ts` (STONES_GLSL, kind 3) | none |

Reverted in the tuning: the skyline at the horizon (0–30°): the fragment never shows that sky. Silk-coloured layers:
invisible against the pale sky (an ink-blue wash instead). Glints on the nosing strip alone: a 0.085 m strip is under a
pixel from the mockup cameras. 20 mm joints: bold brown lines. The amber sheen at ×4: a flat orange floor, the pass-2
wash again.

Memory: geometry 155.8 MB, textures 79.6 MB. Worst pose: mockup A, 125 draws, 1.50 M triangles (no new draws: the
features are all in existing programs).

## Pass 6: the features tuned

`pass-6/`, captured at `f785ac6e` + the lane's files.

| Change | File | GPU cost on the phone |
|---|---|---|
| The tread and riser glints stronger (gain 2 → 3) and denser (22 → 28 % of the cells): C2·5's treads sparkle as the target's do | `look/style.ts` | none |
| The far layers' lit windows denser (28 → 34 %), a third of them the targets' red lanterns strung along the far galleries | `look/style.ts` (FS_SKY) | none |

Reverted in the tuning: the skyline higher (×1.25, bases up to 72°): the towers pointed at the zenith and read as a
radial crown in the look-ups. Lower (×0.8): hidden behind the near towers.

Memory: geometry 155.1 MB, textures 79.6 MB. Worst pose: mockup A, 125 draws, 1.50 M triangles.

## Round 2, pass 7: the Well's depth, a taller skyline, split warm runs, neon glints

`pass-7/`, captured at `51bfc032` (the Well lane's pass 7 and the stair's pass 7 in the same build) + the lane's files.

The Well: probing each fog term on its own showed they overlap: switching any one off barely moved D2·8, all off
darkened it by 17 L*. The pale "floor" was (a) the uniform silk and the shaft's depth silk added up over 50–80 m, and
(b) the Well's pale washes under the high-key ambient; the jiehua and facade programs barely reach the deep floor at
all (a wash-tint probe left it untouched), so D2's pale bottom is the Well lane's backstop and temple geometry, not the
mist.

| Change | File | GPU cost on the phone |
|---|---|---|
| The Well's air thinner: the base air under the datum ×0.3 (was ×1), the shaft's depth silk 0.02 → 0.01, the along-canyon air 0.006 → 0.003 | `look/style.ts` | none |
| **The Well's levels sink into shadow going down**: under the square the washes lose ambient (to ×0.3 by 50 m down) and cool, while their own lights (windows, lanterns, neon) stay at full strength, so each level reads by its own light over a darker shaft (`uDeepAmb`) | `look/style.ts` (FS_JIEHUA) | ~8 ALU |
| New knobs, left at their old values after the tuning: a deep blue air term (`uDeepAir` / `uDeepAir2`: σ ramping in under the datum), the cloud strata's puff density / hole sharpness (`uPuff`) | `look/style.ts`, `look/render/jiehua.ts` | ~10 ALU when on |
| The far skyline: six layers from 16° to 56° (four from 33° to 60° in pass 5), wider and taller silhouettes, darker ink, a lighter silk band at each foot | `look/style.ts` (FS_SKY) | 6 layers on sky pixels only |
| **Tight warm runs**: a warm light wider than 1.4 m (a lit shopfront, a stall's counter) splits into 2–6 narrow streak cards ~0.8 m apart, each ×1.6: a row of tight runs straight under the shop instead of one broad band | `look/streaks.ts` | ~2× the warm cards (instanced, same draw); narrower fill |
| **Neon glints**: the tread and riser glints take the baked neon spill (×2) as well as the lamps, in longer 0.1 m cells, so they sparkle in the neon's colours | `look/style.ts` | none |

Mockup D: L* p10 / p50 33 / 52 (pass 6) → 24 / 42 (pass 7) against the mockup's 33 / 50; the levels read by their
lights over a darker, bluer shaft. Rejected: dense cloud puffs (×4–×8): pale blobs over the levels. A deep blue air on
top of the rest: marginal.

Memory: geometry 151.5 MB, textures 79.6 MB. Worst pose: mockup A, 128 draws, 1.55 M triangles.

## Round 2, pass 8: the skyline's ink, the Well's shadow lifted

`pass-8/`, captured at `94e4be80` + the lane's files.

| Change | File | GPU cost on the phone |
|---|---|---|
| The far skyline's ink 1.6 → 2.6 and its lit windows / lanterns ×1.5: the layers read as a dark blue city with warm lights in the sky gaps over the stair and the gate | `look/style.ts` | none |
| The Well's deep ambient floor 0.3 → 0.45: pass 7's levels were a little too dark under their lights (mockup D L* p10 / p50 24 / 42 → 25 / 43) | `look/style.ts` | none |

A small pass: the uniform tuning on these features is close to its plateau.

Memory: geometry 151.0 MB, textures 79.6 MB. Worst pose: mockup A, 128 draws, 1.59 M triangles (A2·9 1.60 M, 108 draws).
