# Round 8 · look loop 11 (E169, 2026-09-25): lab P6's light merged, the LUT refitted

This is dome A's eleventh set of frames, taken from the spawn with the usual 9 cameras (`time(6.5)`, blue hour, no HUD).
The targets are round 1's, and the four round-6 mockup views are the shared scoreboard. The capture exports the shared
working tree, so the other domes' unfinished work shows in these frames too.

| File | What |
|---|---|
| `capture-1…9.jpg`, `sheet-ingame-3x3.jpg` | the 9 loop frames |
| `mock-A…D.jpg`, `sheet-mockups.jpg` | the four mockup views with the HUD \| the mockups |
| `eye-check.jpg` | round 10 \| this round \| target for capture-1, 2, 6 and mock-A…D |
| `warm-vs-cool.jpg`, `stats.txt` | A blue hour \| B warm silk; draws and triangles per camera |

## What changed: lab P6 "light"

Source: `round-9-lab-light/README.md`. Its `integrate.py` is anchored on `3c39b36f`, so the port was done by hand.

- **Modules.** `lightvol`, `pools`, `glow` and `grade` are copied into `src/dev/nine-dragon/light/`. `light/install.ts`
  is a trimmed version of the lab's `lab.ts`. It bakes the two volumes, loads the LUT and applies the lab's HEAD tuning
  (`LIGHT_DEFAULTS`). It adds no global of its own. `__nd.light({...})` sets a variant for A/B captures.
- **Light pools.** Two baked 3D volumes, one over the square and one over the Well, take light from every lantern,
  shop, sign, lightbox and lit window: 4.8 MB, one fetch per pixel.
  - The jiehua program adds the pool to the wash, and a glossy sheen of it on wet flagstones (`style.ts`). The facade
    shells add it too (`facade/material.ts`).
  - The ambient hooks (`uLpAmb`) are in place at 1, which means off, as the lab tuned it.
- **Wet sheen.** The wet film also reflects the blue-hour sky (`uLpSky` 0.1). This fixes the lab's finding that the near
  ground reflected black inside the first 16 m.
- **Window glow.** Lit rooms glow in the fog through the bloom pyramid's alpha (`post.ts`), which adds no passes. An
  amber gate keeps the paifang and the red neon out of it.
- **The learned LUT** is the composite's last colour step.
  - It was **refitted on the clean room's own frames after the merge** (LOOK-LOOP.md step 6). The 9 loop frames were
    captured with the grade off (`__nd.light({ grade: 0 })`, scratch `lutcap.mjs`), then fitted with
    `fit-lut.py --regions round-9-lab-light/palette-regions-perframe.json`.
  - The result is `public/assets/nine-dragon/grade-lut-cleanroom.bin`. The lab's own
    `lab/grade-lut.bin` is left as it was.
- **Not merged: the four square lamps as emitters.** The lab adds them in `square.ts`, which is dome B's file; this is a
  request to dome B. The blue-hour sky ramp is not merged either, since the lab keeps it off on this look.

## Eye check

- **Better, mildly:** the shopfronts and stalls now light the ground in front of them with warm pools and sheen (FP 3,
  FP 4 at the stair foot, mockup A by the stall), and the far rooms glow a little in the fog.
- **Neutral:** the Well views (B, D, 2, 6) look almost unchanged.
- **A little worse:** luminance contrast is a touch lower. Its standard deviation went 44.7 → 42.5 in FP 1 and
  32.7 → 31.0 in aerial 7. That is the LUT's known compression (lab README, "Failed"). It is small by eye, so it was
  **not reverted**. If the next rounds read flat, `__nd.light({ grade: 0.7 })` is the lever.
- **Reverted:** nothing.

## ΔE per region (round-1 targets)

| Region | Round 10 | Round 11 |
|---|---|---|
| wall | 1.6 | **0.9** |
| wet ground | 2.0 | 2.2 |
| streaks | 3.1 | 2.5 |
| stone (dome B) | 5.9 | 5.2 |
| silk sky | 1.6 | 1.9 |
| lit windows | 2.2 | **0.5** |
| cinnabar (dome B) | 2.2 | 1.9 |

## Rulers

- Draws and triangles are unchanged by the light work (+0): 89–111 draws and 1.92–2.28 M triangles, per `stats.txt`.
- GPU memory: +4.8 MB for the volumes and +0.14 MB for the LUT. The bake takes about 20 ms at load.
- Gates: the clean room typechecks and lints clean on its own.
