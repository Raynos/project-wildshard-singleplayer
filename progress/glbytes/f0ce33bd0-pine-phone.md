# SF22b — Pine Hollow labelled GL census

Measured clean commit `f0ce33bd0`; production build `f0ce33b-mutlwo2f`. Chromium with iPhone 16 Pro viewport, phone tier, live clock, render scale 2, Metal GPU; spawn plus every authored standing camera (gate, cabin, pond), 60 drawn frames per pose.

Command: `scripts/browser-lane.sh node scripts/parity/glbytes-probe.mjs <pinned-preview> <output.json>`; preview from `scripts/serve-build.sh --rev f0ce33bd0`.

Result: **1,311 live resources; 656,554,426 bytes (626.14 MiB); zero unlabelled; exact sum reconciliation; zero page errors**. Deleted/lost-context resources are excluded. Totals describe GL allocation, not OS footprint or JS heap.

| Kind | Bytes |
| --- | ---: |
| texture | 605,465,308 |
| renderbuffer | 3,145,728 |
| buffer | 47,943,390 |

Largest asset groups for SF47 (shared textures appear once per live GL allocation; duplicates remain visible):

| Owner / asset | MiB | Resources |
| --- | ---: | ---: |
| engine/loadPBRArray / pbr-array/diffuse:/assets/tex/forrest_ground_03/diffuse_1k.jpg,/assets/tex/leafy_grass/diffuse_1k.jpg,/assets/tex/rock_ground/diffuse_1k.jpg,/assets/tex/stony_dirt_path/diffuse_1k.jpg/Texture | 21.33 | 1 |
| engine/loadPBRArray / pbr-array/nor_gl:/assets/tex/forrest_ground_03/nor_gl_1k.jpg,/assets/tex/leafy_grass/nor_gl_1k.jpg,/assets/tex/rock_ground/nor_gl_1k.jpg,/assets/tex/stony_dirt_path/nor_gl_1k.jpg/Texture | 21.33 | 1 |
| engine/render-target / PMREM.cubeUv/color/Texture | 18.00 | 3 |
| engine/render-target / EffectComposer.Buffer/color/Texture | 16.71 | 2 |
| engine/scene / generated/Scene/Mesh[0]/uniform/tA/hdri/qwantani_late_afternoon_puresky_2k.key.jpg + gain.png/Texture | 16.00 | 1 |
| engine/scene / generated/Scene/Mesh[0]/uniform/tB/hdri/qwantani_mid_morning_puresky_2k.key.jpg + gain.png/Texture | 16.00 | 1 |
| engine/loadTexture / /assets/tex/rock_ground/diffuse_1k.jpg/Texture | 10.67 | 2 |
| engine/loadTexture / /assets/tex/rock_ground/nor_gl_1k.jpg/Texture | 10.67 | 2 |
| engine/loadTexture / /assets/tex/wood_planks_grey/diffuse.jpg/Texture | 10.67 | 2 |
| engine/loadTexture / /assets/tex/wood_planks_grey/nor_gl.jpg/Texture | 10.67 | 2 |
| engine/render-target / EffectComposer.Buffer/depth/Texture | 8.35 | 2 |
| engine/render-target / LuminancePass.Target/color/Texture | 8.35 | 1 |
| engine/loadPBRArray / pbr-array/arm:/assets/tex/pine_bark/arm_1k.jpg,/assets/tex/fir_bark/arm.jpg,/assets/tex/metasequoia_bark/arm.jpg,/assets/tex/birch_bark/arm.jpg,/assets/tex/bark_willow_02/arm.jpg/Texture | 6.67 | 1 |
| engine/loadPBRArray / pbr-array/diffuse:/assets/tex/pine_bark/diffuse_1k.jpg,/assets/tex/fir_bark/diffuse.jpg,/assets/tex/metasequoia_bark/diffuse.jpg,/assets/tex/birch_bark/diffuse.jpg,/assets/tex/bark_willow_02/diffuse.jpg/Texture | 6.67 | 1 |
| engine/loadPBRArray / pbr-array/nor_gl:/assets/tex/pine_bark/nor_gl_1k.jpg,/assets/tex/fir_bark/nor_gl.jpg,/assets/tex/metasequoia_bark/nor_gl.jpg,/assets/tex/birch_bark/nor_gl.jpg,/assets/tex/bark_willow_02/nor_gl.jpg/Texture | 6.67 | 1 |
| engine/scene / generated/Scene/Group[13]/painted-horizon/uniform/tDay/Texture | 5.50 | 1 |
| engine/scene / generated/Scene/Group[13]/painted-horizon/uniform/tNight/Texture | 5.50 | 1 |
| engine/scene / generated/Group/Mesh[2]/map/Texture | 5.33 | 4 |
| engine/loadGLTF / /assets/models/hatchet/hatchet.gltf/hatchet/map/hatchet_diff/Texture | 5.33 | 1 |
| engine/loadGLTF / /assets/models/hatchet/hatchet.gltf/hatchet/normalMap/hatchet_nor_gl/Texture | 5.33 | 1 |

Seven renderer-created lookup/fallback textures retain the explicit generic `engine/texture / generated/texture/Texture` identity (4,327,428 bytes, 0.66% of total). They remain separate census resource IDs and subresources; this group is not claimed as a content filename. Render-target attachments, authored file textures, registered geometry, instance uploads, skeleton/bone allocations, GLB embedded maps and retained baked texture clones carry their source/piece/role identities.

Instrumentation is enabled only when the harness installs its hooks before boot. The normal game does not walk scenes or wrap renderer properties. `vitest run test/glbytes-census.test.ts test/engine/gpu-labels.test.ts`: seven tests pass, including deletion/resize, arrays/mips, context loss, lines/points, cloning and off-mode behavior.
