# Arena neutral-fill candidate v1

Status: source-only candidate. No visual acceptance or phone-performance claim.

This explicit V70 gait5 practice product uses an `arenaLighting` object with profile `neutral-studio-v1` and separately optional `arenaOcclusion` object with profile `contact-v1` in its strictly admitted presentation data. Each carries its authored numeric settings; strict schemas reject unknown keys, invalid colors and out-of-range or non-finite values. Omitted fields preserve the original practice look and product bytes. The build entry refuses lighting opt-in without the exact V70 rig admission; contact AO additionally requires the explicit lighting profile. No shared engine, normal world, native geometry, palette, gait or combat source changes.

## Bounded parameters

- World sun direction, color and intensity 2.7 remain unchanged.
- Hemisphere sky becomes sRGB #e5e5dd; ground #b2a58e; intensity 0.9 becomes 1.15. This reduces the blue fill and key/fill contrast.
- Toon shade lift, linear RGB: [0.07, 0.035, 0.2] becomes [0.10, 0.09, 0.07].
- Toon rim, linear RGB: [1.3, 0.95, 0.6] becomes [0.65, 0.475, 0.3].
- Optional existing AO pass: radius 2.5 m becomes 0.4 m; intensity 2.5 becomes 1. Sampling, enabled state and all other post settings stay unchanged. An absent pass remains absent. Ordinary phone tier has no AO, so this is a separate desktop contact-scale adjustment.
- Face/shadow band edges, facet grade, terminator, roughness, vertex palette, world key, shadows, fog and tone mapping are unchanged. No camera-following light or emissive/unlit body.

The authored source owns these numeric values in `src/shards/driftwood-isle/data/practiceLighting.json`. The isolated preview generator emits the toon family parameters through existing admitted product data. The practice entry applies the hemisphere from the admitted numeric payload to its arena level and the optional AO parameters to an existing post pass before exposing its ready demo. Shared engine/world defaults are untouched.

## Required verification

Focused tests cover strict optional fields, omitted-profile parity, isolated hemisphere changes, absent phone AO, unchanged samples/enabled state, exact unchanged material graphs and gameplay/pose blobs. The source test resolves the existing schema defaults before comparing toon family parameters, because the omitted family row is filled by the renderer.

Runtime verification must pin the generated source/native/measurement/rig/adapter and complete app inventory. Capture normal real Lock/strafe first, then labelled paused matched-camera controls. Record the actual UA, renderer buffer and pass policy rather than infer phone tier from portrait dimensions. The 2x phone render policy must remain intact. Controlled old/new uniform comparisons must preserve the exact actor, bone, camera and fixed-key transforms; they supplement, rather than replace, real candidate gameplay footage.

Independent review must check dark-side eye/pupil/cream and tail separation at real strafe extremes, bright-side washout, facet readability and contact shadows. Preserve baseline diagnosis, previous app and failure evidence. V70 corpse clearance and overall motion/model acceptance remain separate unresolved work.
