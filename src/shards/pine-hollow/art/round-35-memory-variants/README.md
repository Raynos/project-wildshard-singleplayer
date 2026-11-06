# Pine Hollow memory variants (G65 / G110, SHARD-PLATFORM SF47-g)

Pine Hollow plays at 1,192 MB on the Simulator (WebContent + labelled GL, sp-x2, pin `6c0aaea4f`): 192 MB over the
1.0 GB cap. The Pine memory trim row brings it to 1,172 MB. The invisible cuts left do not close the other ~170 MB (see
below), so these are the **visible** candidates for Jake to pick from. **None of them is applied.**

How measured: the labelled GL census `progress/shard-platform/sf47/census-31271762a.json` (iPhone 16 Pro context, phone
tier, render scale 2, GPU textures KTX2, after every capture pose). Pine's GL is **357.0 MB** with the trim off and 340.2 MB
with it on. Frames come from `progress/shard-platform/sf47/pose-shots.mjs`: iPhone 16 Pro portrait, muted, phone tier.

| | Candidate | GL MB | How known | Frames |
|---|---|---|---|---|
| **B1** | **512² building sets and Poly Haven PBR sets** (the phone's texture cap 1024 → 512 for `loadTexture` sets: cabin logs, planks, stone wall, door, bark, rock ground, mossy rock …) | **−20.5** | measured (cap-512 build, the same commit with one line changed) | `board-512-sets.jpg`, `A-*.jpg` / `B-*.jpg` |
| B1+ | the same for the glTF props (fire pit, barrel, bucket, crate, hatchet, lantern: 1024² ASTC, ~16 MB) | ~−12 | estimate (¼ of their bytes) | none yet |
| **B2** | **ASTC 6×6 instead of 4×4** for every compressed set (83.0 MB of ASTC 4×4: terrain arrays, building sets, props, trees, horizons) | **~−46** | estimate (6×6 is 16/36 of 4×4's bytes) | `board-astc6x6-texture.jpg`: two sets at 3× zoom, texture space only |
| B3 | B1 + B2 together | ~−55 | estimate (B2 on what B1 leaves) | none |
| B4 | PMREM environment at cube size 128 (three 256 targets today) | ~−16.5 | estimate (breakdown `4ec64f071`) | none |
| B5 | `herd-shadow`: the herd casts from its visible LOD (or a blob) instead of skinned shadow-only copies | ~−7.9 | estimate (breakdown) | none |

**Close to invisible, but lossy** (each needs a UASTC encode, so by the noise-floor bar below none can be parity-identical
and retire itself; they belong on this sheet):

| Candidate | GL MB | Note |
|---|---|---|
| Creature hull normal maps as KTX2 (8 × 512² RGBA8, 11.2 MB; the coats read only the albedo) | ~−8.4 | the bake skips every `pine-hollow/creatures` GLB (`CPU_READ` in `scripts/bake-ktx2.mjs`); split the normals out |
| Coat atlases as KTX2 (11 recoloured 512² canvases, 15.4 MB) plus the hull albedos (8.4 MB) | ~−18 | the coats are made on the CPU at load; the page has no ASTC encoder, so the coats would be baked offline per variant |
| The ground decal / pond sets' runtime RGBA8 parts (`Group/Mesh[1–3]`, 26.5 MB together with their ASTC parts) | ≤ −15 | baked offline from the generator |

**Not Pine's and invisible:** the engine's Memory saver (Debug ▸ Loading & memory, SF22d) loads the practice dummies when
the room opens. That is **−33.6 MB of GL** still resident in this census with the saver off, plus its CPU-copy release.

## What "invisible" measures on Pine (the noise floor)

On one build (`31271762a`), Pine OFF vs OFF scores SSIM **0.99959–1.0** (phone 1.0 / 1.0 / 0.99959, desktop 1.0 / 1.0 /
0.99997, both green: `progress/shard-platform/sf47/parity-31271762a-off-off.json`). The trim's OFF vs ON scores
**0.9977–0.9979** on every pose (`parity-31271762a-off-on.json`). That is outside the noise floor. The difference is spread
evenly over the frame: mean |Δ| 0.35 / 255, channel means within ±0.02 / 255, max 16 at JPEG block edges. It is the IBL
lit from RGB9_E5 keys (9-bit mantissas under a shared exponent) instead of half floats. Nobody would see it, but it is not
parity-identical, so G112 does not retire the row on its own.
