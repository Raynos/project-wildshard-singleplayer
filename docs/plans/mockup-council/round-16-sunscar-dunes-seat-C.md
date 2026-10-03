# Round 16, seat C (Claude, red team), Signal Dunes

**What I reviewed:**
- `docs/process/COUNCIL.md`, the ledger (with Jake's 7.0 bar and phase amendments), the brief, `scores.md`, and round
  15's three Signal Dunes seat files.
- The "Signal Dunes, round 16" section of `art/mockup-council/round-16/README.md` and its five sheets.
- Every frame in `progress/sunscar-dunes/20261003-0918-232dbb40/`: the `mock-*` views, h1–h4, both aerials,
  `first-frame`, `clip.mp4` at 1 fps and `meta.json`. Round 15's `20261003-0835-c1b820c3/` and round 14's
  `20261003-0730-69642e60/` for before and after, on the same regions.
- The five ledger mockups, Lanczos-scaled to 780×1688.

**Source checks (read-only):**
- `git show` of 232dbb408 (render.ts, layout.ts, dunes.ts, meshes.ts, whipModel.ts, cameras.json), 04f5b02d7 (the
  learned LUT) and 46ca3c7f1.
- `look/render.ts` at 232dbb40 in full for every term that reads `sandFar`, `cameraPosition` or `vViewPosition`, plus
  `world/fireFx.ts` and `world/meshes.ts`.
- `sandGrainTexture()` ported to numpy, to test the "zero-mean" claim on the texture the shader actually samples.
- The terrain bakes at 69642e60, c1b820c3 and 232dbb40, decoded as 256² float32 from byte 24. Every non-aerial camAt
  eye comes out 1.69–1.70 m over the decoded ground, so the decode is right.
- `public/assets/lut/sunscar-dunes.bin` decoded (33³ RGBA8, r fastest) and applied to round 15's frames, to separate
  what the grade did from what the world did.

**How I measured:** these are the same tools and regions as my round 15 file, and my r15 numbers reproduce to 0.1.
- Rec. 709 luma on the decoded JPEGs.
- **Clean sand:** x 10–150, y 1180–1400.
- **Fine:** the mean of |luma − luma blurred at σ 2|.
- **Grid r:** the Pearson r of a 10×7 grid of σ-12 luma, mockup against game. "Band r" is the same over y 0.36–0.50
  only, the dune band without the near floor.
- **Regions:** frame fractions (x left → right, y top → bottom).

**The short version:**
- **The hard rule holds.** The late-dusk term is gone, and the clip's ground is back at 25–32 (r15 4–7, r14 25–33).
  The "every distance fade is zero-mean" claim is true for the ripples and the streak. It is not quite true for the
  glints and the grain octaves, but the error is about 3 % *near* the camera. It cannot darken the far land, so it is not
  a fourth breach (audit below).
- **The +0.50 correlation in A is a metric without the likeness.** All of it comes from the bright near floor under a
  dark band. Inside the dune band itself, A's r is **−0.01** and dusk-fire's is **−0.51**.
  - The mockups' lit crests are gone: in A's band, 1.2 % of pixels are over luma 80, against the mockup's 22.9 %.
  - A and dusk-fire now show one uniform violet wall, the authored crest's slip face. Its skyline is scalloped, and it
    hides the tower's mound and the lower half of the tower.
  - The lead's first-look worry is right.
- **Gains:**
  - The pale sheet is gone.
  - B's glow is back (61 against 87.5, r15 36).
  - C's far brazier is on the skyline.
  - The glove's leather is livelier.
  - The sky values are closer, but that is entirely the LUT (below).
- **Regressions:**
  - The spawn pair's landform.
  - The whip's cord no longer reaches the handle: the loop floats with a cut end.
  - B's near sand dropped 39 → 31.
  - C's new rise covers its glow band.

## Measurements (mockup / r14 / r15 / r16)

| View | Clean sand | Fine | Grid r y 0.36–0.58 (r14 / r15 / r16) | Band r y 0.36–0.50 (r16) |
|---|---|---|---|---|
| dusk-fire | 74.1 / 43.7 / 69.9 / **63.8** | 9.8 / 10.6 / 7.7 / 8.2 | +0.23 / −0.33 / **+0.14** | **−0.51** |
| A spawn | 56.7 / 44.5 / 62.9 / **61.3** | 9.4 / 11.0 / 9.1 / 8.5 | −0.29 / −0.18 / **+0.46** | **−0.01** |
| B logbook | 39.5 / 28.2 / 39.3 / **31.1** | 2.1 / 2.8 / 3.2 / 3.0 | +0.84 / +0.68 / **+0.89** | |
| C waymark | 32.4 / 40.3 / 40.4 / **36.4** | 0.6 / 2.2 / 1.7 / 1.8 | +0.72 / +0.65 / +0.72 | |
| D hands | 34.7 / 32.6 / 32.7 / 31.9 | 0.6 / 1.5 / 1.8 / 1.5 | +0.80 / +0.82 / +0.79 | |

| View | Region | Mockup | r15 | r16 |
|---|---|---|---|---|
| A | The lit diagonal, x 0.4–0.7, y 0.40–0.44 | 96.7 | 48.4 | **32.0** |
| A | Shade under it, x 0.5–1, y 0.48–0.54 | 42.5 | 75.0 | **29.6** |
| A | Horizon strip right of the tower, x 0.6–1, y 0.385–0.405 | 38.2 | 73.3 | **34.4** |
| A | Dune band x 0–1, y 0.44–0.56 | 53.7 | 60.1 | **35.8** |
| A | Near floor x 0–1, y 0.56–0.62 | 79.1 | 64.1 | 83.8 |
| A | Dune band (y 0.36–0.56) share over 80 / over 65 | 22.9 / 28.5 % | | **1.2 / 6.9 %** |
| A | Sky x 0.1–0.9, y 0.18–0.33 | 93.7 | 98.7 | 86.0 (LUT: 98.7 → 86.0) |
| dusk-fire | Lit left shoulder, x 0–0.35, y 0.50–0.70 | 82.9 | 69.5 | 66.5 |
| dusk-fire | Saddle, x 0.35–0.9, y 0.46–0.56 | 54.6 | 74.2 | **33.1** |
| dusk-fire | Lower right, x 0.6–0.97, y 0.48–0.56 | 46.1 | 86.3 | 34.2 |
| dusk-fire | Tower mound's face, x 0.2–0.8, y 0.36–0.40 | 33.1 | 64.2 | 35.7 |
| dusk-fire | Dune band x 0–1, y 0.40–0.56 | 60.4 | 62.6 | **33.1** |
| dusk-fire | Sky y 0.24–0.30 | 85.0 | 116.9 | 99.2 (LUT: 116.9 → 99.1) |
| B | Glow right of the wagon, x 0.72–0.9, y 0.40–0.47 | 87.5 | 35.6 | **61.3** |
| B | Backdrop right, x 0.6–1, y 0.44–0.48 | 21.5 | 30.2 | 31.6 |
| B | Land left of the camp, x 0–0.2, y 0.455–0.475 | 39.4 | 56.2 | 54.9 |
| C | Glow band right, x 0.6–1, y 0.44–0.47 | 72.5 | 98.7 | **30.4** |
| C | Far land, x 0.6–0.9, y 0.48–0.53 | 16.1 | 24.3 | 26.7 |
| C | Left ground, x 0–0.25, y 0.55–0.65 | 66.4 | 67.4 | 63.8 |
| D | Lit near band, x 0–0.4, y 0.64–0.68 | 58.9 | 35.4 | 36.0 |
| D | Upper land, x 0–0.49, y 0.50–0.58 | 26.4 | 9.2 (the fade) | 34.4 |
| D | Glove p50 / p95 / fine (mockup x 0.76–0.97, y 0.69–0.80; game x 0.60–0.78, y 0.70–0.80) | 24.3 / 83.5 / 8.9 | 26.1 / 47.1 / 3.0 | **35.5 / 61.0 / 5.3** |

**A, the 10×7 grid (y 0.36 → 0.58, rows top to bottom):**

| row | mockup | r16 |
|---|---|---|
| 1 | 51 64 86 73 55 42 41 46 48 45 | 53 52 53 44 39 37 36 36 36 35 |
| 2 | 42 42 50 **83 102 94 75** 53 38 34 | 59 56 36 31 32 33 33 33 34 33 |
| 3 | 32 40 37 39 62 **95 97 78** 50 47 | 36 32 29 29 30 30 31 32 32 32 |
| 4 | 36 40 39 37 36 44 **71 83** 59 39 | 36 30 27 28 29 30 30 30 31 30 |
| 5 | 63 57 46 40 41 39 35 41 54 60 | 35 34 30 27 32 32 28 28 29 29 |
| 6 | 89 92 88 74 54 40 36 34 33 34 | 65 59 51 41 35 32 30 29 30 29 |
| 7 | 81 86 89 97 101 94 76 55 40 35 | 72 76 78 78 75 72 69 66 67 69 |

- The mockup's lit diagonal (bold) runs down through rows 2–4. In the game, rows 2–5 are a flat 27–36.
- The +0.46 comes from rows 6–7: the bright floor under a dark band. Any dark wall over a bright floor would score it.

**The late clip (1 fps, 540×1168):**

| | r14 | r15 | r16 |
|---|---|---|---|
| Ground, y 0.55–0.90 | 25.2–33.0 | 3.8–6.8 | **25.3–32.3** |
| Mid band y 0.30–0.60: median | 32–33 | 5–6 | **29–31** |
| Land under luma 8 | 0 % | 74–98 % | **0–1 %** |

The r16 clip reads like r14's: a dim, readable dune field, with no lit disc around the camera and no step at any range.

**The bake (inner ±200 m):**

| | r14 | r15 | r16 |
|---|---|---|---|
| Faces over 15° | 20.4 % | 25.5 % | 24.6 % |
| Faces over 25° | 4.5 % | 7.1 % | 7.4 % |
| Max slope | 39.3° | 34.3° | 39.1° |

**Line of sight, spawn eye (0, 23.05, 70) → tower (8, −75):**
- The authored crest at 87 m stands 22.34 m tall, −0.47° from the eye.
- The tower's ground is 18.08 m, −1.96°.
- So the crest hides the whole mound and about the lower 3.8 m of the tower.

## Signal Dunes (sunscar-dunes)

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` (Jake's pick) | **5.7** | 1. **The landform is the wrong form (x 0–1, y 0.36–0.56). Regression.** The mockup's dominant read is a big lit left shoulder sweeping up to a dark tower mound, with a lit saddle between them. The game shows one uniform violet dome wall (33 against 60 across the band; band r −0.51) over a flat lit plain. The shoulder is gone, and the saddle is 33 against 55. 2. **The tower is half hidden (x 0.45–0.6, y 0.33–0.39). New.** The crest's skyline cuts the tower at mid-height, and its mound is invisible: the crest is 22.3 m at 87 m. Where the mockup's tower stands on its own mound, the game's peeks over a wall. The skyline is a regular scalloped saw-edge with a pale rim (the 1.95 m grid seen edge-on). 3. **The sky and the viewmodel.** The sky value is closer (99 against 85; r15 117), all of it from the LUT, with the banks unchanged. The fist holds a short stick upright, and the loop floats free with a cut end; the mockup has one low loop hanging from the grip. |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **5.9** | 1. **No lit crests (x 0.3–1, y 0.38–0.54). Still not there, and worse in value.** The lit diagonal is 32 against 97 (r15 48). In the band, 1.2 % of pixels are over 80, against 22.9 %. The shade is in the right place only as one undivided slab: the mockup's shade sits between lit crest lines, and the game's fills the band. Band r is −0.01; the claimed +0.50 is the floor. 2. **The far field. Gain.** The pale sheet right of the tower is gone (34 against 38; r15 73). The receding blue-grey rows are still mostly hidden by the near wall, and a few lavender strata remain at the left horizon (x 0–0.3, y 0.37–0.40). 3. **The viewmodel (x 0.3–0.9, y 0.62–0.86).** A free-floating single loop whose top end stops about 50 px short of the handle, beside an upright stick fist. The mockup has two broad coils rising from the bottom edge over a half-hidden hand. The near floor (61 against 57) and the sky value (86 against 94, from the LUT) are fine. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **6.7** | 1. **The afterglow behind the wagon (x 0.6–1, y 0.33–0.48). Gain.** The 21 m dune sits under the band: the glow is 61 against 87.5 (r15 36), and the dark ridge reads as the mockup's. Grid r is +0.89, the best yet. The land left of the camp is still lit (55 against 39). 2. **The near sand (y 0.70–0.83). Regression.** 31.1 against 39.5 (r15 39.3); the LUT accounts for only 1.2 of it. 3. **The smoke and the viewmodel.** The cookfire plume is a thin arc bending off to the right, where the mockup has a column rising over the wagon. The loop is detached from the stick fist (as A). |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **6.6** | 1. **The right horizon (x 0.6–1, y 0.40–0.56). Mixed.** The far brazier is back on a skyline (x ≈ 0.93, y ≈ 0.42; mockup x 0.89, y 0.44). But the 24 m mound under it is a broad lit dune filling the right third, and it covers the glow band: 30 against 72.5 (r15 99). The mockup has a low dark horizon with an unbroken glow band. 2. **The fire (x 0.25–0.5, y 0.20–0.53). Repeated.** A cream core, graphic tongues, no logs, no billowing smoke. 3. **The ground and the viewmodel.** The near sand is closer (36 against 32; r15 40), the left ground holds (64 against 66), and the warm pool is fainter than the mockup's. The loop is detached from the fist. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.4** | 1. **The glove and the coil (x 0.55–0.9, y 0.64–0.86). Mixed.** The leather is livelier: p95 61 against 83.5 (r15 47), fine 5.3 against 8.9 (r15 3.0). But it reads as a smooth tan mitt holding a stick upright like a candle, with the thumb over the top and the four finger rolls still to the camera. The cord's loop floats free to the left with a cut end. The mockup's coil hangs from the gripped handle, beside a stitched, creased gauntlet. 2. **The land under the horizon (y 0.50–0.71). Repeated.** It is a flat 34–36 of rolling dunes, where the mockup has dark horizontal bands at 16–26 with a lit stripe of 59 at y 0.64–0.67 (36 here). This is honestly lit now (no fade). 3. **The tower and the horizon.** The tower is at the mockup's size and place from round 14's stand. The world label "SIGNAL TOWER 200" still sits on it, and a large dune rises on the right where the mockup's bands run flat. |

**Seat score, Signal Dunes: (5.7 + 5.9 + 6.7 + 6.6 + 6.4) / 5 = 6.26, so 6.3.**
- This seat's earlier scores: 4.6, 5.1, 4.9, 5.2, 5.6, 5.3, 5.7, 6.1, 6.4, 6.4, 6.7, 6.7, 6.5, 6.4, 6.4.
- Down 0.1 overall:
  - Jake's pick −0.5 and A −0.3, from the wall that replaced the crests;
  - B +0.1 from the glow;
  - C −0.2, where the glow loss outweighs the brazier;
  - D 0.
- The late world being honest again is real progress, but none of the five scored views is late enough to show it.

## Builder's claims checked against the pixels

| Claim (README / 232dbb408) | Verdict | Evidence |
|---|---|---|
| The late far-land term is removed | **True** | `farLate` is deleted. The clip's ground is 25.3–32.3 (r15 3.8–6.8). |
| Every distance-faded term is zero-mean | **Mostly true; two exceptions, both small and near-side** | The ripple term is exact: mean of −0.7·max(0, −sin) = −0.2228, and +0.2228 is added. The streak fade is gone. The glint "pair" is not balanced: the grain texture's red channel has 0.98 % of texels under 0.18 and 0.14 % over 0.82, so the pair nets −0.46 % within 3–18 m (it was +0.03 %). The three grain octaves (unchanged) subtract 0.5 from a texture whose mean is 0.491, so they net −4.3 % within ~22–40 m. The quartz glint nets +1.35 % near. Overall that is ≈ −3 % within ~20 m (≈ 2 luma). |
| A's band correlation +0.50, dusk-fire +0.25 | **Reproduces roughly (+0.46 / +0.14); the likeness doesn't** | Inside the dune band, r is −0.01 (A) and −0.51 (dusk-fire). The correlation is carried by the floor rows. The lit-crest share is 1.2 % against 22.9 %. |
| The pale sheet is gone: dusk-fire 74 → 35, A 56 → 34 | **True** | Dusk-fire lower right 86 → 34 (mockup 46); A horizon strip 73 → 34 (mockup 38). In dusk-fire it is now covered by the near wall, and is too dark. |
| Mid ripples 0.7 → 0.26 | **True** | Code verified. The wall's face is smooth, and A's band fine dropped. |
| B's dune 26 → 21 m | **True, with a gain** | B's glow is 61 (r15 36). |
| Waymark 0 on a 24 m rise for C | **True** | The bake reads 24.00 m at (58, −34), with slopes within 40 m of max 37.2° and p90 28.6°. It costs C's glow band (30 against 72.5). |
| Waymark 1's 10 m lift is back; "check its slopes" | **Fine** | Max slope 26.7° within 25 m, ground 15.8 m. No 41–44° face. |
| The fist turned so the back of the hand and the cuff face the camera, fingers round the handle | **Not what the pixels show** | The thumb wraps over the top, and the finger rolls still face the camera. The handle stands vertical out of the fist. The loop's `from` point (−0.53, 0.95, 0.19) was not moved with the new `pos` / `rot`, so the cord starts in the air about 50 px from the handle tip. |
| Lighter, glossier leather | **True** | p95 47 → 61, fine 3.0 → 5.3. |
| mock-D back at (38, 122), the tower at the mockup's size | **True** | Eye 1.69 m over the bake. The tower is at the mockup's x and size. |
| "Dusk: no stage or curve change" | **True** | No handler, `dusk.ts` or `uDusk` curve edit in 232dbb408. |

## Findings, ranked by score gained

1. **The spawn pair's crest is a wall, not the mockups' landform (A, dusk-fire, h1, first-frame; x 0–1, y 0.33–0.56).**
   *Regression. The metric was gamed without the likeness. Repeated: placement by A's frame.*
   - **What happened:** the authored crest (`LANDFORMS.crests`, 20 → 23.5 → 27 m, slip face toward the camera) now
     stands at 87 m from the spawn, 22.3 m tall. Its slip face fills the band with one uniform violet slab. It also
     hides the tower's mound and half the tower.
   - **What the mockups show:** they look *over* lower near crests to the tower on its mound. Lit diagonals (82–108)
     separate the shaded slip faces, so the shade is in strips, not one slab.
   - **Fix:**
     - Lower the near crest so its top is under the eye-to-tower-base line. From the spawn, at 87 m it must stay under
       about 21 m, ideally 18–19.
     - Break the 30 m slip face into two or three receding crest lines, each with a lit windward band between slip
       faces.
     - Judge by the **band r over y 0.36–0.50** (target ≥ +0.4 in both A and dusk-fire) and by the lit share over 80
       in A's band (target ≥ 15 %), not by the 0.36–0.58 grid that the floor carries.
     - Smooth the scalloped crest skyline (bilinear or finer heights along the authored crest).
2. **The cord no longer meets the handle (every view; x 0.3–0.55, y 0.62–0.70).** *New regression, from 232dbb408's
   `HD_GLOVE` move.*
   - **Fix:** recompute `LOOP.from` from the rotated handle tip, so the cord leaves the handle.
   - Then hang the loop from the grip, as in D, rather than beside an upright stick. Tilt the handle forward and down
     (toward the loop) so it no longer stands like a candle.
   - Bring the cuff in at the right edge, and add creases and stitching. The leather finish is half-way there (p95 61
     against 83.5).
3. **C's new mound covers the glow band (x 0.6–1, y 0.40–0.50).** *Regression, from the waymark-0 mound (24 m, r 66).*
   - **Fix:** keep the brazier on a skyline, but on a narrower, lower rise: about 8–12 m over its surroundings,
     r 30–40. That gives the mockup's small bump under the brazier, with the glow band continuous across x 0.6–1.
   - **Check:** glow ≥ 65, far land ≤ 22, max slope under 35°.
4. **B's near sand regressed (y 0.70–0.83): 31 against 39.5.** *New regression.* The LUT accounts for 1.2. The rest
   is the wind flip changing the near ground's facing at B's stand. **Fix:** check `away` and the key's N·L on B's
   floor. Restore ~39 there without lifting C's floor (36 against 32).
5. **The LUT is now stale by its own README.**
   - **What changed:** it was fitted on round 15's frames, with the wind away from the camera. Its README says to re-fit
     when the wind changes, and the wind flipped back.
   - **What it does:** it moved the sky 13–18 luma, all of the sky "gain". It does not touch the banks: A's red-orange
     cloud banks still undershoot.
   - **Fix:** re-fit on round 16's frames, with the sky region excluded from the fit. Close the sky gap in the dome
     itself (row 5's painted skies), so the grade isn't doing the sky's work.
6. **D's land (y 0.50–0.71).** *Repeated.* Flat 34–36 against bands of 16–26 with a lit stripe at 59.
   - **Fix:** transverse crests across D's line of sight, with their slip faces toward the camera, in the 60–250 m
     range. Use height and facing only, never distance.
7. **Two near-camera terms aren't zero-mean (render.ts `color_fragment`).** *New, nit and should-fix.*
   - **Fix:** subtract the texture's measured mean (0.491) in the three grain octaves and the base `sandTex.r` term.
   - Pair the glints by percentile (bright tail over the 99.86th, dark under the 0.14th), or drop the dark leg.
   - Small (≈ 2 luma), but the claim should be literally true.
8. **Repeated, unchanged:** C's fire (no logs, cream core); B's smoke arc; Sefa still has no pointer on the first frame
   (tracker "LIGHT THE SIGNAL FIRE" only); "SIGNAL TOWER 200" over D's tower. From above, the authored crest and
   mounds read as three dark crater-like ovals round the tower (aerial-overview, y 0.6–0.8).

## Ledger-5 audit

- **The hard rule (no shard shader term may depend on camera distance; a fourth darkening voids the round): no
  breach.**
  - `farLate` is gone, and the late clip's ground is back at r14's 25–32 with no ring or step.
  - **What still reads `sandFar` and fades:** the ripple amplitude (`sandNear` 4–26 m, `sandFade` 35–110 m), the
    patch floor, three grain octaves, the glints, the ripple bump and the grain bump.
  - **Their brightness:** the ripple term is exactly zero-mean. The others net ≈ −3 % within ~20 m (finding 7). That
    darkens the *near* sand slightly. It cannot fake the far-land darkening the rule was written against.
  - **Wording:** the rule's literal text forbids even these brightness-neutral detail fades. The README reads it as
    "no fade changes brightness", and I apply that reading. The lead should write the rule that way in `scores.md` so
    the next seat doesn't have to guess.
  - **Watch items, pre-existing and not distance terms:**
    - The grazing sheen (`sheenV`, up to +35 % on lit faces) is view-angle, not distance. On flat ground seen from
      1.7 m, though, the angle tracks distance.
    - The engine fog lerps to `0x110b16` late, from 80 m (since round 10). That is an engine term, outside the rule.
- **The LUT (04f5b02d7): no breach.**
  - It is one global grade, shipped and applied to every view, the hero views and the clip. It is not debug-only.
  - It is mild: a mean shift of −4 per channel.
  - It is fitted on the scored frames against the mockups, and it supplies all of the sky's value change while the sky's
    structure is untouched. So I credit it for value only (finding 5).
- **Landforms placed for frames: repeated should-fix, now metric-tuned.**
  - The crest's own comment cites its tuning to the 10×7 correlation with mock A. The waymark-0 mound is "for C's far
    brazier".
  - Both are real, walkable terrain: max slope 39.1° on the field and 37.2° on the mound, under the 40° climb. They are
    not cards, so there is no void.
  - The cost of tuning to a metric shows: A correlates while it looks less like A (finding 1).
- **mock-D's stand: no breach.**
  - It is the old (38, 122), yaw 21.7, as round 15's seat A asked. The eye is 1.69 m over the bake.
  - h3's 11.5 m rise follows waymark 0's real mound, and is disclosed.
- **Staged state: unchanged and reachable.** `logbook` and `waymarks-lit` ×2. 232dbb408 edits no stage handler and no
  dusk curve; its layout edit moves waymark 0's ground, which the player walks to and lights.
- **No narrowing: no breach.**
  - The late world regained its legibility.
  - The first frame and h1 inherit the wall, which is a likeness cost, not a trick.
  - h2–h4 hold.
- **Device and HUD:** 390×844 touch, stored 780 wide, the baseline HUD and the 30 fps / 33 ms chip, `pageErrors: []`,
  no QA retakes. Memory and sustained frame time are not on this surface: unverified, not breached.

SCORE signal-dunes: 6.3
