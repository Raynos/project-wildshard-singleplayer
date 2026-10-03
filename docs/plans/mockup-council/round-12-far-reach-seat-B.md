# Round 12, seat B, Sky Reach (Claude, lens: evidence, measured region by region)

2026-10-03. The bar is 7.0 (ledger 4 as Jake amended it); I score the same way regardless.

Surface:
- The Sky Reach section of `art/mockup-council/round-12/README.md` and the five sheets `art/mockup-council/round-12/far-reach-*.jpg`.
- `progress/far-reach/20261003-0608-591bd5b5/`: every `mock-*`, h1–h4, both aerials, `clip.mp4` (0.5 fps tiles) and `meta.json`.
- Round 11's capture `20261003-0601-3307e64a`, for before and after.
- The five ledger mockups at full resolution.
- `git show` of the two commits between the captures: 064cf48f8 (`look/render.ts`, `species/stormRoc.ts`,
  `weapons/WarFan.ts`, `world/meadow.ts`, `world/skyIsleHd.ts`) and 591bd5b5d (`world/skyIsles.ts`). Also read
  `stormRoc.ts` at 591bd5b5d (perch, take-off, `stageOpening`, `restart`).

Method:
- My round-9 to round-11 method. Each frame is resized to 780×1688 (Lanczos). Regions are fractions of the frame (x left
  to right, y top to bottom, HUD included).
- On each patch: mean RGB, chroma (max − min), and Rec. 709 luminance p10 / p50 / p90, its standard deviation and the
  share above 230. "hp" is fine detail: the standard deviation of L minus its 3 px Gaussian blur. "White" is the share of
  pixels with L > 170 and chroma < 60 (daisies, white cloud tops).
- **Fair crops.** The fan moved right this round: its leaf now spans x 0.50–0.86 (round 11: 0.44–0.80). Every foreground
  patch stops at x ≤ 0.36, clear of it. Crag patches are pure rock, checked on crops.
- **Before / after.** Every round-11 patch is re-measured on the round-11 capture in the same run. My round-11 numbers
  reproduce to ±0.5.
- A whole-frame diff (|ΔL| > 12) changes about 23 % of every mock view (round 11: about 6 %). The changes are in the
  cluster band (y 0.25–0.45), the meadow (y 0.55–0.85: the glow fade plus wind), the fan, and in D the Roc (y 0.25–0.40)
  and the band between the stones. The sky above y 0.20 is unchanged in every view.

## Measured (mockup / round 11 / round 12)

| Patch | Mockup | Round 11 | Round 12 | Reading |
|---|---|---|---|---|
| A near ground x 0.03–0.32, y 0.68–0.82: p50; p90; sd; hp | 59; 100; 29.7; 19.9 | 70; 110; 27.8; 19.3 | **61; 90; 22.1; 15.4** | the median now matches; the highlights, spread and detail fell below the mockup |
| A nearest band x 0–0.36, y 0.76–0.84: p50; p90; sd | 56; 102; 30.1 | 70; 110; 26.2 | **57; 85; 19.8** | the same |
| B near ground x 0.03–0.32, y 0.68–0.82: p50; p90; sd | 65; 124; 34.8 | 79; 126; 31.5 | **65; 101; 24.0** | the same |
| C near ground x 0.05–0.36, y 0.77–0.85: p50; chroma; p90 | 66; 47; 131 | 96; 78; 143 | **78; 63; 115** | closer, still straw |
| D near ground x 0–0.36, y 0.74–0.84: p50; chroma | 55; 35 | 98; 79 | **84; 67** | closer, still the largest ground gap |
| P foreground x 0–0.36, y 0.62–0.84: p50; p90; sd | 69; 159; 46.4 | 60; 93; 23.6 | **52; 80; 19.3** | **further from the mockup** |
| White specks, fan-clear meadow (A / B / P) | 0.2 / 0.4 / 4.7 % | 0.1 / 0.0 / 0.0 % | 0.1 / 0.0 / 0.0 % | no change |
| A crag bodies, pure rock, left x 0.05–0.25 / right x 0.63–0.78, y 0.30–0.325: p50; chroma | 116 / 123; 80 / 67 | 116 / 80; 58 / 44 | **106 / 69; 49 / 39** | **darker and greyer: the sun-side rim mask took the camera-facing rims** |
| A cluster band y 0.22–0.36: p50; hp | 174; 11.6 | 166; 12.8 | 155; 13.0 | darker by the rims; the band's detail rose with the trees |
| A band under the cluster y 0.36–0.46: > 230 | 5.2 % | 17.1 % | 14.1 % | a little better, still 3× |
| A subject band y 0.45–0.65 p50; under the bridge x 0.25–0.75, y 0.53–0.60 p50 | 87; 108 | 72; 85 | 68; 73 | **darker, further from the mockup** |
| B band under the cluster y 0.36–0.46: > 230 | 9.0 % | 13.6 % | 10.7 % | closer |
| C upper sky x 0.05–0.38, y 0.10–0.25: p50; chroma | 205; 70 | 152; 35 | 152; 35 | unchanged |
| C top band x 0.20–0.60, y 0.04–0.09: sd; hp | 10.9; 4.1 | 3.1; 0.3 | 3.1; 0.3 | unchanged, a flat gradient |
| D fan-clear middle band x 0–0.45, y 0.45–0.65: > 230 | 10.7 % | 13.6 % | **5.9 %** | the builder's 13.6 → 5.9 reproduces exactly; now half the mockup's |
| D between the stones x 0.3–0.5, y 0.50–0.60: > 230; chroma; white | 6.8 %; 71; 8.0 % | 28.3 %; 90; 0.4 % | **1.2 %; 104; 0.4 %** | the hot puff is gone; what is left is a saturated orange haze with no white cloud tops |
| D sun patch x 0.05–0.45, y 0.44–0.50: > 230 | 36.8 % | 23.3 % | 23.0 % | the round-11 halo cut stands |
| D whole play rows y 0.05–0.85: p99; > 230 | 242; 2.9 % | 237; 2.0 % | **232; 1.1 %** | D is now the dimmest of the five, under its mockup |
| D floor behind the dais x 0–0.36, y 0.70–0.74 p50 | 66 | 42 | 42 | unchanged |
| D storm x 0.05–0.65, y 0.09–0.25: p50; chroma | 87; 25 | 71; 35 | 71; 35 | unchanged, violet |
| D fan's leftmost pixel, rows y 0.62–0.66 / 0.66–0.70 / 0.70–0.74 | none / 0.78 / 0.65 | 0.455 / 0.429 / 0.427 | **0.526 / 0.496 / 0.494** | the builder's "clear to x 0.50" verified |
| Fan teal share of the frame (A / C / D) | — / — / — (sky noise in the mask) | 2.59 / 2.56 / 2.62 % | 2.50 / 2.45 / 2.53 % | the same size, moved right |
| P upper sky x 0.05–0.95, y 0.06–0.16: sd; hp | 48; 16.7 | 52; 11.3 | 52; 11.3 | unchanged |

The Roc, read off crops of D (y 0.18–0.48): the mockup's eagle spans x 0.02–0.97 with both wingtips inside the frame,
the wings raised (the left tip at y 0.18), its white head and yellow beak in three-quarter view at about x 0.53, y 0.35,
and golden talons down to y 0.425. Round 12's Roc faces the camera: the breast and a pale hood at x 0.37–0.63,
y 0.28–0.41, the wings a flat bar at y 0.29–0.34 that runs off both frame edges, the head foreshortened into the hood
with the lock marker over it (no beak or eye reads), and the feet two blue-grey lumps.

## Scores

| Mockup | Score | The three biggest differences (region) |
|---|---|---|
| `round-11-review/mockup-A-spawn-look` (mock-A-spawn-look) | **7.2** (r11 7.3) | 1. **The cluster (x 0–1, y 0.22–0.36) is still one flat tier, now with a picket of cone pines.** The new stands are tall, evenly spaced, near-identical cones along every cap edge (y 0.24–0.28); the mockup's caps carry low, bushy, rounded crowns and long root curtains, at two heights. The sun-side rim mask removed the gold from the camera-facing rims, so the rock is darker and greyer (left / right bodies 106 / 69 against 116 / 123; chroma 49 / 39 against 80 / 67). 2. **The meadow (x 0–0.36, y 0.66–0.84).** The median now matches (61 against 59), but the highlights and texture went with the glow: p90 90 against 100, sd 22 against 30, hp 15 against 20. It reads as an even, darker field of upright straw, still with none of the three grey boulders or the daisies (0.1 % against 0.2 %). 3. **The middle band (y 0.36–0.65).** The cloud wall under the cluster is still hot (14.1 % over 230 against 5.2 %), and the mill, pines and bridge are darker than in round 11 (under the bridge 73 against 108). The fan is still large and central (x 0.50–0.86). |
| `round-18-council-mockups/mockup-B-quest-start-painterly` (mock-B-quest-start) | **7.0** (7.0) | 1. **The sky (y 0.18–0.47).** I score the cluster's finish under the lead's ruling: the same flat shelf as A, now topped with the cone picket. The band under it came down (10.7 % against 9.0 %; it was 13.6 %). 2. **The keeper (x 0.07–0.27, y 0.45–0.62) is unchanged:** the elbow wave, a plain coat beside the mockup's scarf, satchel and layered cloth, a simple book and lantern. 3. **The foreground (x 0–0.45, y 0.58–0.86).** The median now matches (65 against 65) but the spread fell (sd 24 against 35, p90 101 against 124): no lit grey stones and no white daisies (0.0 % against 0.4 %). |
| `round-18-council-mockups/mockup-C-hands-fan-painterly` (mock-C-hands-fan) | **6.5** (6.4) | 1. **The fan (x 0.50–0.98, y 0.58–0.86).** The pivot is still at the lower left, away from the glove at the right edge, and there is no tassel. The 2.5 cm move to the right takes the leaf further from C's, which sweeps up-left across the centre (x 0.39–0.89). 2. **The sky (y 0.04–0.40) is unchanged:** grey-mauve above ~25° (upper patch 152 against 205, chroma 35 against 70; top band sd 3.1 against 10.9). The cluster is ruled; its finish is as in A. 3. **The foreground straw (x 0.05–0.36, y 0.77–0.85)** is closer (78 against 66; it was 96) but still straw, with no rock at the lower left and no flowers. |
| `round-11-review/mockup-D-crown-arena` (mock-D-crown-arena, staged `roc-opening`) | **7.5** (7.2) | 1. **The Roc (x 0–1, y 0.28–0.41) now comes at the camera, but it doesn't read as the mockup's eagle.** Head-on, the head is foreshortened into a pale hood with no beak or eye, the wings are a flat bar that runs off both frame edges, and the feet are two blue-grey lumps. The mockup's bird is three-quarter on, the wings raised in a V with both tips inside the frame, a white head with a yellow beak, golden talons. 2. **The gap between the stones (x 0.05–0.7, y 0.44–0.62).** The hot puff is gone (1.2 % over 230 against 6.8 %; it was 28.3 %), but what is left is an empty orange haze (chroma 104 against 71, white 0.4 % against 8 %). The mockup has a white-topped cloud sea and three small isles there. The sun's halo stays below the mockup's (23 % against 37 %), so D is now the dimmest frame (play rows 1.1 % over 230 against 2.9 %). 3. **The arena ground (y 0.62–0.86).** The near grass is closer (84 against 55; it was 98) but still straw. The floor behind the dais is dark (42 against 66), and the fan still covers the dais's right half from x 0.50, where the mockup shows no fan. The storm is still violet (chroma 35 against 25). |
| `round-1-proposals/B-sky-reach` (mock-proposal-B) | **5.9** (6.0) | 1. **The ray is again not in this frame.** Neither the manta nor its wake shows. The mockup's ray and curling cyan wake are the second subject, beside the mill (x 0.42–0.62, y 0.29–0.36). 2. **The foreground (x 0–0.36, y 0.62–0.84) moved further from the mockup:** p50 52 against 69, p90 80 against 159, sd 19 against 46. The mockup's is a lit grassy spur with rock and white daisies (4.7 %); the game's is a dark, even field. 3. **The destination and sky's finish.** A broad shelf with five pines, not the narrow rooted spur; the cluster shelf with its new cone picket fills the band over the mill (treated as A's conflict); the cirrus detail is two-thirds of the mockup's (hp 11.3 against 16.7). |

**Seat score, Sky Reach: (7.2 + 7.0 + 6.5 + 7.5 + 5.9) / 5 = 6.82, rounded to 6.8** (round 11, this seat: 6.8).

## The README's claims, checked

| Claim | Verdict | Evidence |
|---|---|---|
| The Roc's take-off launches over the dais toward the arena entrance and comes head-on in D; all paths match | **verified, in the frame and in the code** | The take-off now steers to `(DAIS.x, CROWN.z + CROWN.r)` whatever the lap `angle` is. The perched yaw (fresh fight, line 101) and `stageOpening()`'s yaw are the same, `yawTo(DAIS.x, DAIS.z + 40)`. So a fresh fight and the staged shot take the same heading for the whole 4 s take-off, and round 11's lap-angle mismatch no longer matters before 4 s. In D the bird faces the camera. Rise 5 → 2 m. |
| Meadow backlight fades over the nearest metres; near medians A 72 → 63, C 97 → 78, D 99 → 85 | **the numbers reproduce; the side effect is a loss of spread** | A 69.6 → 61.0 (seat-A crop), C 96.3 → 77.5, D 98.2 → 83.5. But A's p90 110 → 90 (mockup 100), sd 27.8 → 22.1 (29.7), hp 19.3 → 15.4 (19.9); B's p90 126 → 101 (124); proposal B's foreground p90 93 → 80 (159). The fade is in the shader by distance (`glowNear`), global and honest. |
| D's glare, fan-free x 0–0.45, y 0.45–0.65: 13.6 → 5.9 % (mockup 10.4) | **verified exactly (13.6 → 5.9 %; mockup 10.7 % on my crop)** | It now undershoots. The puffs toward the sun were removed from the crown's bank (`render.ts keelPuffs`), a world change also seen in h4 (fan-clear y 0.48–0.60: 17.8 → 11.1 %). Nothing replaced them, so the gap is an empty haze. |
| The fan's hold 2.5 cm right, so D's dais row is clear to x 0.50 | **verified** | The leftmost fan pixel in rows y 0.66–0.74 is 0.494–0.496 (was 0.427–0.429). The leaf's size is unchanged (2.5 % of the frame). |
| Crag rims lit only on their sun side | **verified, and it costs A** | The rim term is now masked by `dot(N, sunDir)`. From the spawn the sun is behind the cluster, so the camera-facing rims lost their gold: the A crag bodies fell 10–11 levels, away from the mockup's warm, bright undersides. |
| Dense fir stands, 6–9 per cap | **verified in the code (9 / 9 / 7 / 6 / 7)** | In the frames they are tall, evenly spaced, near-identical cones in a row along each cap: a picket, not the mockup's bushy rounded crowns. |

## Ledger 5

- **Cameras:** the cameras blob and every `camAt` are identical to round 11's. Staging is unchanged (`roc-opening` on D,
  `quest-crown` on h4; `active` is D only). `qa.retaken` is empty, every shot is `world`, no page errors, programs 101.
- **D's staged frame:** round 11's should-fix (the fresh fight and the staged shot took different headings) is
  **resolved** for the take-off window: the steering target no longer depends on the lap angle, and both paths start
  from the same perched yaw. One residual, for the builder to check, not a finding: `restart()` doesn't re-place the
  Roc on its perch, so a retry's take-off starts from wherever the last lap left it.
- **The crown bank's sun-ward cut** removes real cloud puffs in one sector of the world for every view; it is not a
  card or a per-camera trick. Not a breach.
- **No narrowing:** h1, h2, h3, h4, the aerials and the clip show the same world (the clip is a real 3D orbit with the
  cluster and its new stands). No breach found.

## Findings, ranked by score gained

1. **Repeated, partly a regression: the meadow lost its highlights when its median was fixed** (A, B, P, C, D
   foregrounds, x 0–0.36, y 0.62–0.85).
   - **Evidence:** the medians now match in A and B (61 / 65 against 59 / 65), but the p90s fell below the mockups' (A 90
     against 100, B 101 against 124, P 80 against 159) and so did spread and detail (A sd 22 against 30, hp 15 against 20).
     The mockups' near-ground highlights come from lit grey stones and white daisy heads, not from glowing straw.
   - **Fix:** keep `glowNear`. Add the mockups' low lit stones, placed for real and walk-checked, with white daisy clumps
     round them, and mix in short, darker tufts between the tall blades. The target is near-ground p90 ~100–125 and sd ~30
     with the median held at ~60.
2. **New and a regression: the cluster's crowns and rims** (A, B, C, P: x 0–1, y 0.22–0.36).
   - **Evidence:** the new stands are a row of identical tall cones on each cap rim. The sun-side rim mask darkened the
     camera-facing rock (A left / right bodies 116 / 80 → 106 / 69 against 116 / 123; chroma 49 / 39 against 80 / 67).
   - **Fix:** replace the cone rows with clumped, rounded, bushy crowns of mixed sizes, some overhanging the cap edge,
     and hang longer root curtains. Light the rims the mockup's way for a sun behind the crags: a forward-scatter term
     (`pow(max(dot(-V, sunDir), 0), k)` times the fresnel) so the edges facing the camera with the sun behind them glow.
     Stagger the cap heights (round 11's finding 2, still open).
3. **Repeated: the Roc's read in D** (x 0–1, y 0.28–0.41).
   - **Evidence:** the heading is right now. But the head-on pose hides the head and beak, the wings are a flat bar
     that leaves the frame on both sides (the mockup's tips sit inside at x 0.02 and 0.97, raised to y 0.18), and the feet
     are grey lumps.
   - **Fix:** during the take-off hold the wings in an upstroke V (the mockup's raised pose), pitch the head up so the
     white face and yellow beak show over the breast, and colour and hang the talons gold. Keep the camera; if the wings
     still clip, let the take-off arc a few degrees off the camera's axis so the bird shows three-quarter on, as the
     mockup does, for every path alike.
4. **New: D's gap between the stones is an empty orange haze** (x 0.05–0.7, y 0.44–0.62).
   - **Evidence:** over 230 now 1.2 % against 6.8 %; chroma 104 against 71; white 0.4 % against 8.0 %. The sun patch is
     still 23 % against 37 %. D's whole frame is now the dimmest of the five (1.1 % over 230 against 2.9 %).
   - **Fix:** take the round-11 halo roll-off back toward round 10 for the sun's own ring, and fill the removed sector
     with a lower cloud sea with white lit tops (low chroma) and two or three small far isles, as the mockup has.
5. **Repeated: C's upper sky** (x 0.05–0.60, y 0.04–0.25): 152 against 205, chroma 35 against 70, top band sd 3.1
   against 10.9. Raise the warm mix toward full across ~18–32° and give the top band cloud structure, in the one
   shared dome.
6. **Repeated: the fan's hold** (C x 0.50–0.98, y 0.58–0.86; A, B, P right foreground). The move right helps D's dais
   but takes C's leaf further from the mockup's sweep across the centre. Put the pivot in the glove at the lower right,
   the leaf sweeping up-left, hang the tassel, and shrink it toward A's, B's and P's size (2.5 % of the frame now).
7. **Repeated: proposal B's ray** (x 0.42–0.80, y 0.29–0.47): absent from the frame for the second round. Bring the
   lap's near arc in front of the cluster at sail height beside the mill, checked on a sweep of the lap, not one frame.
8. **Repeated: A's middle band** (y 0.36–0.65): the cloud wall under the cluster 14.1 % over 230 against 5.2 %, while
   the subjects darkened (under the bridge 73 against 108). Dim the lit far bank behind the mill and lift the near
   subjects' fill.
9. **Repeated should-fix (round 11 seat C): crag o6 still hangs in the arena's airspace** (`skyIsles.ts`: o6 at
   (9, −186), keel 20, unchanged in 591bd5b5d). Slide it outward along the line from A's camera so it keeps its place
   in A.
10. **Repeated: D's floor (42 against 66), the violet storm (chroma 35 against 25) and the keeper** (an open palm, a
    layered coat with a scarf and satchel).

SCORE sky-reach: 6.8
