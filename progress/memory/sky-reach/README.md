# Sky Reach under the 1.0 GB playing cap (E435, sky-mem lane, 2026-10-08)

> **Census-inflated (G257, ruler lane, 2026-10-08).** The native WebContent numbers below were read with the old `g227-budget/native.mjs`, which ran `vmmap -summary` on the WebContent process (and an in-page census) after every pose; that inflates every later reading in the run, by ~425 MB at Pine centre (ruler lane, G257). They are not cap verdicts. The fixed-ruler re-reads are in [progress/memory/ruler/README.md](../ruler/README.md).

Ruler: [g227-budget](../g227-budget/README.md). `progress/memory/g227-budget/native.mjs <base> <out> <dist> sky-entry on`
(Developer on, Memory saver on, phone tier, 2×, muted, Auto textures unless `G227_TEX` pins one), one cold iOS Simulator
Safari boot per run (`wildshard-iphone`), north socket → islet ride → gate → bridge → island, every move real input after
the one staged road pose. WebContent = kernel physical footprint (median of three fresh samples per pose) + that pose's
labelled GL. Decimal MB. All numbers and per-run rows: [summary.json](summary.json).

Memory saver: defaults on with Developer only (Jake, `cdd8c8915`); Developer-off players cannot reach the Sky cell
(G233), so every grid Sky entry today runs with it on. The public default stays off until a phone reading (RENDERING.md).

## Attribution at the island (before, `8039db709`)

GPU, labelled GL 253.7 MB: Sky's 22 HD GLB atlases 97.9 (`engine/loadRigFile`, 1024² / 512² RGBA8 + mips, 5.59 MB per
1024²), platform scene textures 50.7 (plot billboards 13.1, signs 6.6, junctions 5.6 …), render targets 30.0 + 4.9
(composer 2 × 9.2 RGBA16F), scene buffers 25.9, Sky painted textures 12.9 (`engine/texture`: rock, meadow) + 12.6
(windmill stone / ivy / canvas) + stormeye 5.6 + fan leaf 2.8 + sward atlas 3.2, Sky world buffers ≈ 16.
RAM (residency ledger): `sim:far-reach` 216.0, the 22 HD atlases' retained CPU copies 73.4 (covered by `sim:far-reach`),
open plots 33.8, composer 31.3, road deck 22.0, WASM 33.1, audio PCM 3.8. Sky's GL is already resident at the lip
(260.7 MB there), so lip/board/gate/island all carry it.

## Results (3 valid cold runs a side; median [min–max] of each run's worst entered settled pose)

| Side | Attempts / valid / failed | Entered worst pose | Island GL |
| --- | --- | ---: | ---: |
| before `8039db709` | 3 / 3 / 0 | **1063.1** [1060.2–1064.3] | 253.7 |
| saver cut (`d2710e6d7` code) | 3 / 3 / 0 | **1067.9** [1036.6–1097.8] | 253.7 |
| saver cut + KTX2 pick (`G227_TEX=ktx2`) | 4 / 3 / 1 (`'Runtime' domain was not found`, Inspector, kept) | **998.2** [986.7–1092.7] | **181.7** |

- **Saver cut** (landed `d2710e6d7`): the HD atlases' and painted textures' ImageBitmaps go at upload. No native saving is
  credited: the medians do not move beyond the ±50 MB WebContent noise (WebKit keeps the freed pages; the decode still
  allocates first). Ownership result only. Pixel diff at all 11 standard poses is within the before-vs-before control.
- **KTX2 A/B** (default off): the 22 HD GLBs baked by `scripts/bake-ktx2.mjs` (phone tier, UASTC 4×4 → ASTC 4×4).
  Labelled GL **−72.0 MB exact** at every entered pose; WebContent medians unchanged (≈ 800–816). Entered worst-pose
  median −65 MB to 998.2, still at the cap, one run at 1092.7, so not ≤ 950. Wire: +22 MB of KTX2 GLBs (the WebPs are 4.6 MB).
  Default stays Images: Sky's phone tier sets `textures: 'img'`, so Auto never picks KTX2; only pause ▸ Settings ▸ Debug ▸
  GPU textures = KTX2 loads them (the existing engine row, no new row).
- Board for Jake: [board-ktx2-ab.jpg](board-ktx2-ab.jpg) (A Images vs B KTX2 at Sunrest, the Crown arena and the hand;
  mean |diff| 0.90 / 6.12 / 5.86 vs the A-vs-A run control 6.28 / 7.45 / 5.75, i.e. inside animation noise).

## G253: KTX2 is the phone's default (Jake picked B; `b49135480`)

Sky's phone tier now sets `textures: 'ktx2'`, so Auto loads the 22 HD models' ASTC 4×4 GLBs from the first visit; the
phone boot, pack and background prefetch name no HD images GLB. Desktop is unchanged (no desktop KTX2 set; G188). The
images GLBs stay in `public/`: they are the desktop's files, the bake sources, and the engine-wide Debug ▸ GPU textures =
Images fallback. Phone pack: 5.8 → 23.9 MB on the wire. All numbers: [g253.json](g253.json).

- **Native, fixed ruler** (`g227-budget/native.mjs` `04556bc45`, `--census=final`; served build `d4a9075-mv02wp8o`, the same
  tree): 4 attempts, 3 valid. Entered worst settled pose (sky-board every run) **1086.5 MB [990.3–1111.4]**: WebContent
  803–924 + labelled GL 187.3. Island GL 180.3 MB in every run, the KTX2 reading (images: 253.7), so Safari's Auto really
  loads KTX2. Not under the 1.0 GB cap. No images run was taken on this ruler, so there is no native delta here: the
  exact saving is the GL one (−72 MB). Rejected attempt 1 (grid-base `native-final.mjs`, which crashed in `enteredCost`
  with no GL before the island): WebContent at lip / board / gate 531 / 524 / 537 MB, ~300 MB below runs 2–4. That gap
  is for the ruler lane: either attempt 1 is a low outlier, or the per-pose light GL read itself costs WebContent.
- **Look:** at the board's three poses, Auto against Debug KTX2 on one build is mean |diff| 6.10 / 5.40 / 5.67 (Sunrest /
  Crown arena / hand). Auto against Auto is 5.38 / 5.49 / 5.47, so the difference is animation noise. Both modes load the
  same six content-addressed pack parts and draw the same calls, triangles and textures.
- **Parity (m5 phone, local):** `gpuBytes.textures` 240.75 → 167.35 MB (parent `ffe27ada8` → G253). Spawn / hover SSIM
  moves by 0.001 (0.9795 → 0.9785). The parent is already red against the committed `bfb9dc325` baseline: texture count
  78 vs 79, 240.8 vs 258.1 MB, SSIM 0.979 vs ≥ 0.990. The far-reach phone baselines need a re-record.

## Not done in this lane

Frame floor (`node scripts/frame-floor.mjs --shards=far-reach --surface=both`) waits for the coordinator's Simulator GO.
Remaining levers for ≤ 950: Sky's painted textures as KTX2 too (≈ 35 MB GL), the render targets, and WebContent itself
(≈ 800 MB entered; `sim:far-reach` 216 MB is unattributed inside the runtime).

Plan-State: unchanged
