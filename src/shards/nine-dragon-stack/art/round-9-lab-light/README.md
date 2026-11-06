# Round 9 · lab P6 "light": light pools, window glow and the colour grade (E169, 2026-09-25)

A throwaway lab for what makes the round-8 targets glow: warm light pools, lit windows glowing in the silk fog, and the
colour grade (a learned LUT plus the blue-hour sky and fog ramp). It was tested on the clean room's own 9 look-loop
frames against `../round-8-look-loop-1/target-1…9.jpg`.

- **Page:** `dev/nd-lab-light.html`.
- **Code:** `src/dev/nd-lab/light/`:
  - the modules: `lightvol.ts`, `pools.ts`, `glow.ts`, `grade.ts`, `cards.ts`, `lab.ts`;
  - `room/`: a copy of the clean room at **HEAD `3c39b36f`** (= round-8 loop 7) with the hooks from `integrate.py`.
- **Drivers:** `window.__ndLight` (the clean room's `__nd`, renamed so its global cannot collide) and
  `window.__light.set({ pools, poolGain, sheen, glow, halo, veil, glowThr, glowNear, glowFar, grade, sky, wetSky, fogDensity, fogColor, ambient, cards, cardGain })`.
  There are no URL switches.
- **Capture:** `lockf -k <scratchpad>/browser.lock node art/nine-dragon-stack/round-9-lab-light/capture.mjs --out=<dir> --tag=<t> --set='<json>' [--bench]`.
- **Final side-by-side:** `final.jpg`, BEFORE (HEAD) | AFTER | TARGET. `sheet-final-3x3.jpg` has all nine final frames.

## Result

Two baselines, because the clean room moved under the lab:

- **Loops 1–6** ran on a frozen copy of the round-8 **loop-2** state, the one in the brief: sky 8.5, streaks 7.4, cinnabar 6.8.
- **Loops 7–8:** the lead committed `3c39b36f` (loop 7) mid-lab. It already fixed the sky (1.6) and the cinnabar (1.8).
  So the room was rebased onto HEAD, the levers were retuned there, and the LUT was refitted there. **The HEAD numbers
  are the ones to merge.**

ΔE00 per region, mean colour, pooled over the 9 frames (`palette-delta.py --regions ../round-8-look-loop-1/palette-regions.json`),
measured **in engine**, not predicted:

| Region | loop-2 state | + light + LUT (loop 6) | **HEAD (loop 7)** | **+ light + LUT (loop 8, final)** | HEAD + LUT only (predicted) |
|---|---|---|---|---|---|
| wall | 1.6 | 1.3 | 2.1 | **0.8** | 0.9 |
| wet ground | 2.9 | 1.4 | 2.2 | **2.4** | 2.0 |
| streaks (neon) | 7.4 | 5.9 | 4.0 | **3.4** | 3.3 |
| stone | 2.3 | 1.6 | 5.7 | **4.5** | 4.6 |
| silk sky | 8.4 | 1.3 | 1.6 | **2.2** | 1.9 |
| lit windows | 2.4 | 0.9 | 3.1 | **0.5** | 0.2 |
| cinnabar | 6.9 | 4.6 | 1.8 | **1.3** | 2.4 |
| worst | 8.4 | 5.9 | 5.7 | **4.5** | 4.6 |

- **Per frame on HEAD** (25 region × frame cells): mean ΔE 4.2 → 3.3, worst 7.5 (streaks, FP right) → 6.7 (stone, FP left). The table is
  printed by `scratchpad perframe.py`: the pooled table hides frames that cancel.
- **The value structure the mean ΔE misses** (all 9 frames: L* p10 / p50 / p90, b*, warm-light share, cool-dark share):

  | | L* p10 / p50 / p90 | b* | warm % | cool-dark % |
  |---|---|---|---|---|
  | targets | 24.3 / 38.8 / 60.8 | −3.2 | 4.9 | 19.8 |
  | loop-2 state | 28.3 / 44.2 / 64.0 | −0.1 | 4.5 | 14.4 |
  | loop 6 | 28.7 / 41.4 / 59.8 | −1.9 | 4.5 | 14.6 |
  | HEAD | 26.4 / 40.2 / 63.3 | −1.9 | 4.7 | 18.6 |
  | final | 27.0 / 41.7 / 62.8 | −1.7 | 4.9 | 15.5 |

- **Honest verdict.**
  - On the loop-2 state the lab closed the palette: sky 8.4 → 1.3 and every region under 6.
  - On HEAD the **LUT carries the ΔE**. The pools and the window glow are local light, so they barely move region means:
    HEAD + LUT alone predicts the same table.
  - The pools and the glow are a *look* call. Warm pools under the lamps and stalls, and a sheen on the wet stone, are
    visible in `loop-7.jpg`, `methods.jpg` and `glow.jpg`. They show as dark → lit in the crops, not in the means.
    Jake should see them, per the "taste is the user's call" rule.
- **Still open, and not a grade problem:**
  - The Well's far wall (FP left) is a flat mid-grey wash where the targets paint dark concrete with bright rooms.
    That is value by structure, owned by P5 textures / the facade.
  - The aerial square's contrast is still off: mean / sd 122 / 29 against the targets' 103 / 38. Neither the
    ambient, the fog density, the rain nor the pools move it. The LUT even lowers sd by 3–4 (see Failed).

## What won, and the exact parameters

### 1. Light pools: a baked light volume (`lightvol.ts` + `pools.ts`)

**How it works.**
- Every emitter the clean room already collects feeds the bake: lanterns, lit shops, stall counters, the shrine, the
  4 lamps, neon signs and lightboxes, plus every lit interior-mapped window (`ctx.fd.windows`).
- Each becomes a `PoolLight { at, color, k, r, cut }` with irradiance `k·colour / (1 + d²/r²)`, tapered `(1 − d²/(cut·r)²)²`.
- The lights are baked once into two RGBA8 3D textures:
  - the square level: x −30…75, z −175…28, y +123…+171, 1 m cells, 106 × 49 × 204, 4.2 MB;
  - the Well shaft: x −30…2, z −46…18, y −100…+123, 1.5 m cells, 23 × 150 × 44, 0.6 MB.
- Each texel's rgb holds `√(E/6)`. Its alpha holds the luminance-weighted share of light from above, which keeps
  lantern light off undersides and keeps a lit shop's light on the awning above it.
- Bake: 20 ms for 9 566 lights on HEAD, 1.3 k–4.3 k per volume.

**How the materials use it.** `poolLight(wp, n)` is one trilinear fetch.
- The jiehua program adds `albedo × pool × poolGain` to the wash, and on wet flagstones a broad glossy sheen
  `pool × wet × sheen × (0.35 + 0.65(1 − |V.y|)²)`.
- The facade shells add the diffuse term.

**The parameters (`POOL`, `DEFAULTS`):**

| Source | k | r (m) | cut | Colour |
|---|---|---|---|---|
| lantern | 0.35 × s | 2.0 × s | 3 | `#ffa060` + 20 % of the paper's red |
| shop / stall / shrine | 1.8 × min(spill / 0.3, 1) | max(1.8, 0.45 w) | 3 | `#ffb866` + 50 % of the emitter's |
| lamp (new: `square.ts`) | 3.2 | 2.6 | 3.4 | `#ffc987` |
| sign | 0.45 × min(power, 1.5) | max(0.8, 0.55 size) | 2.4 | the sign's |
| lit window | 0.2 × lit | 0.8 | 2.4 | the room's, 0.45 m in front of the glass |

Gains: `poolGain 1`, `sheen 1.0`, underside keep 0.35.

**Compared against method B, ground light cards** (`cards.ts`: one instanced additive draw of shaped pools, `methods.jpg`).
- On the flat square the two are indistinguishable.
- Only the volume reaches walls, pillars, awnings, the crowd, the paifang and the Well verandas.
- Cost is the same within noise (+1 draw for the cards).
- **The volume won.** At most 4 real dynamic lights were never needed: the volume costs one fetch per pixel for any
  number of lights.

### 2. Window glow in the fog (`glow.ts`, zero extra passes)

It rides in the **alpha channel of the bloom pyramid**, which carried a constant 1.0 until now.
- **The prefilter** (½ res) writes `max(brightest − 0.22, 0) × warmth × amber × far` into alpha:
  - `amber` passes a lit room's g/r of 0.56–0.9 and rejects cinnabar, paper lanterns and red neon;
  - `far = smoothstep(6, 40, z)`, where z comes from the colour target's alpha (near / viewZ), so no depth read is needed.
- **The down / up chains** carry the alpha like rgb.
- **The composite** adds amber `#ffa45c × (tight.a · 0.6 + wide.a/4 · 0.15)`. The add is kept off pixels nearer than
  6–10 m, so a dark pillar in front of a lit facade stays dark.

### 3. The wet film reflects the sky (`style.ts` kind 3, `uLpSky`)

- The clean room's wet sheen used `fogCol(vWorld)`. That colour is about black inside the first 16 m of clear air, so the
  near ground never showed a sheen.
- The added term is `uFogBaseCol × (0.35 + 0.65(1 − N·V)³) × wet × uLpSky`, on top of the old one.
- On the loop-2 state, 0.45 took FP wet ground from L* 27 to 34 (target 33, ΔE 3.0 → 1.6). HEAD had already darkened its
  wet stone less, so 0.1 is the setting there.

### 4. The grade: a learned LUT (`grade.ts`, `public/assets/nine-dragon/lab/grade-lut.bin`)

- It is a 33³ RGBA8 table, `fit-lut.py`'s format.
- It runs as the composite's **last colour step**, after `toSRGB` and before the grain: one texture3D fetch.
- **The fit:** `palette-regions-perframe.json`.
  - Every round-8 region is split per frame (`wall@2`, `wall@8`, …), so the Well's pale far wall and the shaft's dark
    wall pair with their own targets.
  - A `shadow@n` region per frame (pixels under 62 % of that frame's wall median, saturation under 0.6, weight 2)
    teaches the dark end.
  - Greys are held (greyAnchor 3).
  - **Streaks are at ½ weight, not 0.** At 0 the LUT learned the cinnabar's darkening and pushed the neon reflections
    7.5 → 8.7. At ½ they land at 5.8. The bloom is not in the ground rectangles, so no bloom is being learned.
  - `grade-lut-noneon.bin` + `palette-regions-perframe-noneon.json` is the strict weight-0 variant: streaks 4.6 on HEAD,
    everything else within 0.3.
- **Refit command** (captures WITHOUT the LUT, `__light.set({ grade: 0 })`):

  ```
  python3 scripts/fit-lut.py --regions art/nine-dragon-stack/round-9-lab-light/palette-regions-perframe.json <dir with mockup-<n>-*.jpg = the 9 targets> '<nolut dir>/<tag>-{n}.jpg' public/assets/nine-dragon/lab/grade-lut.bin
  ```

### 5. The blue-hour ramp and the ambient (they won on loop 2, and are OFF on HEAD)

**The ramp (`BLUE_HOUR`):**
- sky `#7890ae` over `#98acc0`;
- fog `#7585a0` at 0.009;
- the Well's +101 / +36 m bands `#56617a` / `#4a5670`.

On the loop-2 state it took the sky 8.4 → 1.1 and the frame's b* from +0.1 toward −3.

**The ambient** (`uLpAmb`) scales only the non-emissive wash, so emitters, pools and ink keep their value. 0.8 took
the loop-2 frames' L* p50 from 44.2 to 41.0.

**On HEAD both are off.** The lead retuned `LOOKS.jiehua` and added height fog, and now the ramp puts the walls at 4.0
and the ambient makes FP 3 / 4 / 8 too dark. Keep them for a look that has not been retuned.

## What failed, and why

- **Pools at physical gains are invisible on wet stone.** Wet granite's albedo is ~0.03, so a pool of E = 0.6 adds 0.02.
  What reads as a pool in the targets is the wet sheen of the light (`dbg` in `methods.jpg`, ×20).
- **Pools at visible gains flood-lit the paifang.**
  - Lantern clusters sit on the cinnabar, which went to ΔE 8.6. The fix was lantern k 1.6 → 0.35.
  - The stall's two high-spill emitters, scaled ×2 by spill, washed the aerial square orange. Spill now only weakens.
  - The targets' warm-light share is only 4.9 %: their warmth is concentrated in rooms and lamps, not spread.
- **Glow that took red** smoked the paifang orange (cinnabar 9.9), which is why the amber gate exists.
- **A strong halo is a blur, not a glow.** Halo 5 smears the rooms into amber blobs (`glow.jpg`). The targets' glow is
  mostly value: dark wall, bright room.
  - On HEAD, halo 1.2 pushed FP 2's warm share 6.9 → 8.4 %, so it sits at 0.6.
  - The strongest window "glow" lever is darker walls, which is the facade / P5 lane.
- **The pooled mean-colour LUT lifted the darks** (cool-dark 16.7 → 13.8 %). Its regions filter out V < 0.2, so the
  darks were extrapolated from the walls. The fix was the per-frame shadow regions.
- **The LUT lowers the aerials' contrast** (sd −3 to −4). The per-region Reinhard (spread clamp 0.7–1.4) and the grey
  anchor compress the spread. The aerial's contrast is a structure problem, not a grade one.
- **Base fog density and rain do not explain the pale far walls** (FP left: density 0 → 0.005 moved p50 by 0.4 L*,
  rain 0 → 0.55 by 0.5). The walls' own wash is pale.
- **A window light per lit window** (8 784 of them, k 0.2) is invisible in the metrics. It is kept for the sills.

## Cost (the rulers)

- **Draws:** +0 (volume, glow and LUT), identical per frame on / off: 77–95, 1.50–1.77 M tris. The cards add +1.
- **Programs:** +0. Seven existing programs change: jiehua, facade shell, window, prefilter, down, up, composite.
  The cards would add +1.
- **GPU memory:** 4.8 MB for the volumes, 0.14 MB for the LUT.
- **Frame time at 1206 × 2622:**

  | Clean room | Load | All off | All on | Cards | Verdict |
  |---|---|---|---|---|---|
  | loop-2 room | ~18 | 9.97 ms | 10.66 ms | — | +0.7 ms, within the noise |
  | HEAD room | 7–10 | 26.15 ms | 25.60 ms | 26.64 ms | within the noise |

  Per lever on HEAD: pools 25.28 ms, glow 25.45 ms, LUT 24.80 ms, all within noise.
- **Per-pixel work:**
  - one texture3D fetch in the jiehua and facade programs (plus one texture2D lookup);
  - four extra scalar evaluations per prefilter texel at ½ res;
  - one texture3D fetch in the composite.

## How to integrate into the clean room (`src/dev/nine-dragon/`)

1. **Copy the modules.** Put `src/dev/nd-lab/light/{lightvol,pools,glow,grade,lab}.ts` into `src/dev/nine-dragon/light/`
   (`cards.ts` only if you want the A/B).
2. **Apply the hooks.** Run `python3 art/nine-dragon-stack/round-9-lab-light/integrate.py src/dev/nine-dragon ./light`.
   - Every hunk is anchored to HEAD `3c39b36f` text and fails loudly if it drifted.
   - `integration.diff` is the same patch as applied to the lab's copy (import prefix `..`).
   - The hunks:
     - `style.ts`: `...lightVolUniforms()` in `Shared.u`, `${LIGHTVOL_GLSL}` in the jiehua FS, `wetPool`, the
       sky-sheen term, `shaded *= uLpAmb`, and the pool lines after the spill;
     - `facade/material.ts`: the shell's `albedo` / `uLpAmb` / pool lines, and the window FS's `uLpAmb`;
     - `post.ts`: the glow alpha in prefilter / down / up, `glowAdd` + `gradeLut` in the composite, and the
       `glow` / `grade` / `uNearP` fields;
     - `main.ts`: `installLightLab({ shared, pipe, lanterns: paper.emitters, ctxEmitters: ctx.emitters, signs: [...neonSigns.emitters, ...signs.lights], windows: ctx.fd.windows, cards })`
       right after `new Pipeline(renderer, shared)`;
     - `square.ts`: the 4 lamps pushed as emitters.
3. **Settings.** `installLightLab` applies `DEFAULTS` (the HEAD tuning) and exposes `window.__light` like `__nd`.
   - To make the defaults permanent without the API, set the uniforms once: `uLpGain (1, 1.0, 0.35, 1)`, `uLpSky 0.1`,
     `uLpAmb 1`, `pipe.glow.uGlow (1, 0.22, 6, 40)`, `uGlow2 (0.6, 0.15, 10, 1)`, and `pipe.grade.uLut` = the loaded
     LUT with `uLutAmt 1`.
   - In the game proper, every variant is a pause ▸ Settings ▸ Debug row (AGENTS.md), never a URL param.
4. **Refit the LUT after the merge,** and after every look round. It is fitted to this room's frames, and the clean
   room keeps moving (LOOK-LOOP.md step 6). Capture the 9 loop frames with `grade: 0`, then run the command in §4.

## Files

| File | What |
|---|---|
| `final.jpg` | **The side-by-side.** BEFORE (HEAD = loop 7) \| AFTER (pools + glow + wet sheen + LUT) \| TARGET for FP 1, 3, 4, 6 and aerial 9. Crops: the square's wet ground (FP 3) and the Well wall (FP 2) |
| `sheet-final-3x3.jpg` | The nine final frames, in the loop's cell order |
| `loop-1…8.jpg` | capture \| target for FP 1, 3, 4 and aerial 9, per loop. The title and the ΔE are on each |
| `methods.jpg` | Pools: where the volume's light lands (×20), volume vs cards vs target |
| `glow.jpg` | Halo 0 / 2.5 / 5 vs target, far windows |
| `lut.jpg` | No LUT \| LUT \| target on HEAD |
| `integrate.py`, `integration.diff` | The hooks, as a re-appliable script and as a diff against HEAD `3c39b36f` |
| `palette-regions-perframe.json`, `…-noneon.json` | The LUT fit's regions (per frame + shadow; streaks at ½ weight or 0) |
| `capture.mjs` | The 9-camera capture and the bench for the lab page |
| `public/assets/nine-dragon/lab/grade-lut.bin`, `grade-lut-noneon.bin` | The fitted LUTs (HEAD, loop 8) |

## Capture pitfalls met here

- The shared dev server (:5173) went down once.
- A private server was killed mid-run (exit 144).
- Other agents' edits make Vite reload every open page. Some shots died ("execution context destroyed"), and some came
  back as a blank `#0d1b26` frame.
- `scratchpad cap.sh` retries on both: it checks every frame's standard deviation.
