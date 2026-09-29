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
