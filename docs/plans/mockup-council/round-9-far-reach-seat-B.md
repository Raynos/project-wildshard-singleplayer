# Round 9, seat B, Sky Reach (Claude, lens: evidence, measured region by region)

Surface:
- The Sky Reach section of `art/mockup-council/round-9/README.md`.
- The five sheets `art/mockup-council/round-9/far-reach-*.jpg`.
- `progress/far-reach/20261003-0447-d3eefd5c/`: every `mock-*`, h1–h4, both aerials, `clip.mp4` (0.5 fps tiles), `meta.json`.
- Round 8's capture `20261003-0402-185b6810`, for before and after.
- The five ledger mockups at full resolution.
- Source at `d3eefd5c7`:
  - `species/stormRoc.ts` (`stageOpening`, the take-off), `plugin.ts` (the `roc-opening` stage, the slate patch), `world/crown.ts` (the stones and PERCH);
  - the diffs of 109655ccb (`look/sky.ts`, `world/meadow.ts`, `world/skyIsles.ts`), 5abe9d651, 4c3288300, efca93202 and d3eefd5c7;
  - `art/far-reach/round-22-council-tools/playrun.mjs` and `playrun-result.json`.

Method:
- The patches and method are the same as my round 8, so every row compares directly.
  - Every frame is resized to 780×1688 (Lanczos).
  - Regions are fractions of the frame: x runs left to right, y top to bottom, and the HUD is included.
  - Each region is cut from the mockup, round 8 and round 9.
- On each patch I measured:
  - mean RGB and chroma (max−min);
  - Rec. 709 luminance p10 / p50 / p90, its standard deviation and the share above 230;
  - fine detail "hp": the standard deviation of L minus its 3 px Gaussian blur.
- For a direct round 8 → round 9 check I also made a whole-frame luminance difference (r9 − r8) per view, per 5 % band.
- To check the builder's B claim, the ground patch x 0.03–0.38, y 0.68–0.82 is also measured at 390×844 with a 1.5 px blur.

## Measured (mockup / round 8 / round 9)

| Patch | Mockup | Round 8 | Round 9 | Reading |
|---|---|---|---|---|
| Play rows y 0.05–0.85, share > 230 (A / B / C / D / proposal B) | 2.2 / 2.4 / 1.9 / 2.9 / 3.8 % | 2.5 / 1.9 / 2.1 / 2.5 / 3.1 % | 2.4 / 2.2 / 2.2 / 3.3 / 2.7 % | still in the mockups' range |
| A cluster zone x 0.05–0.95, y 0.17–0.36: L p10; sd | 105; 42.9 | 120; 34.4 | **109; 40.0** | the mass over the mill is there now |
| A crag bodies (mockup back-left / right / front-left; game left / centre / right): L p50; sd; hp; chroma | 120 / 94 / 120; 15 / 22 / 29; 7.2 / 11.5 / 11.7; 75 / 42 / 91 | — | 118 / 114 / 100; 13 / **7** / 25; 6.8 / **2.8** / 9.8; 51 / 51 / 51 | right tone; the centre crag is smooth, and all three are one flat warm grey |
| A meadow x 0–0.6, y 0.66–0.84: mean; L p10/p50/p90; sd; hp | 91,73,36; 41/65/122; 34.1; 22.5 | 88,73,29; 44/70/109; 27.2; 18.3 | 76,65,25; **40/61/93; 22.8; 15.3** | **regression**: the median matches, but the highlights went (p90 −16) |
| A subject band y 0.45–0.65, p50; under the bridge x 0.25–0.75, y 0.53–0.6, p50 | 87; 108 | 69; 77 | 69; 77 | unchanged |
| A upper sky x 0.05–0.38, y 0.1–0.25: mean; p50 | 219,182,162; 184 | 199,161,146; 172 | 199,161,145; **171** | unchanged |
| C upper sky (same patch): mean; chroma; p50 | 230,193,161; 70; 205 | 164,141,151; 40; 140 | 168,144,152; 41; **141** | unchanged, still lavender |
| Rows y 0–0.15, r9 − r8 mean L (A / B / C / proposal B) | | | +1.3…+2.3 / +1.6…+2.3 / +2.2…+3.3 / +0.4…+0.9 | the sky change reaches the frame as 1–3 levels |
| B lower left x 0–0.3, y 0.66–0.85: mean; L p50/p90; sd; hp | 83,71,43; 62/125; 36.4; 21.6 | 68,53,33; 52/80; 18.6; 7.9 | 84,70,27; **66/107; 26.0; 17.2** | the boulder is gone and the patch is near the mockup's. But it is all grass: the mockup's lit stones are absent |
| B meadow x 0–0.45, y 0.58–0.66: L p50 / p90; hp | 79 / 151; 21.1 | 76 / 117; 20.0 | **62 / 94; 16.3** | darker (the glow cut) |
| B ground (builder's patch, 390 px): L p10/p50/p90; spread; hp | 41/67/122; 80; 17.3 | 34/53/82; 47; 7.2 | **44/68/101; 57; 13.7** | the hp reproduces the claim's 13.8. The claim's 50/77/117 and spread 67 do not (they predate the glow cut) |
| C foreground x 0.05–0.65, y 0.77–0.85: mean; chroma; L p50/p90; hp | 89,73,40; 49; 67/127; 22.5 | 118,96,42; 76; 94/143; 23.2 | **99,82,35; 64; 79/120; 20.0** | half the straw gap closed |
| D Roc mids (L 60–150): RGB; chroma (mockup wings / game far wing / raised wing) | 128,96,91 / 126,92,91; 34–36 | 162,120,85; 76 | **124,99,89; 35 / 143,112,98; 45** | **slate reached**: the mids match the mockup's |
| D Roc darks (L < 60) share on the wing; hp on the wing | 4 %; 18.6–22.8 | 3 %; 14.6 | **44 % (raised wing)**; **7.8–10.9** | heavy dark bars; half the feather detail, with visible blocky texels |
| D Roc box (frame fractions) | x 0.0–0.97, y 0.16–0.42, wings level, ¾ to camera | x 0.15–0.75, y 0.27–0.37 | **x 0.07–0.68, y 0.10–0.45** | the size is right now; the pose is not |
| D middle band y 0.45–0.65 > 230; between the stones x 0.3–0.9, y 0.5–0.6 | 5.2 %; 3.3 % | 8.2 %; 8.7 % | **11.6 %; 16.6 %** | **regression**; h4 shows it too (8.4 → 11.4 %), so the staging did not cause it |
| D storm x 0.05–0.65, y 0.09–0.25: p50 / p90 | 87 / 158 | 70 / 123 | 65 / 137 | still darker |
| D floor x 0–0.45, y 0.70–0.74, p50; near meadow y 0.74–0.84: p50, mean, chroma | 74; 55, 72,62,39, 35 | 42; 92, 116,93,41, 75 | **39; 77, 98,79,33, 64** | the near field is closer; the floor is still inverted |
| Proposal B upper sky: chroma; p50; sky patch x 0.18–0.82, y 0.17–0.33 chroma | 19; 176; 26 | 76; 179; 95 | **80; 181; 81** | still 3–4× the mockup's colour |
| Proposal B foreground x 0–0.45, y 0.62–0.84: L p50 / p90; hp | 66 / 154; 15.6 | 60 / 93; 15.2 | **52 / 78; 12.3** | **darker again** |
| Sun (x, y) A / B / C / D / proposal B | (0.34,0.35) / (1.0,0.42) / (0.05,0.34) / (0.23,0.46) / (0.24,0.40) | (0.28,0.38) / (0.39,0.39) / (0.42,0.46) / (0.29,0.45) / (0.28,0.30) | unchanged | B and C still far from their mockups' edges |

## Scores

| Mockup | Score | The three biggest differences (region) |
|---|---|---|
| `round-11-review/mockup-A-spawn-look` (mock-A-spawn-look) | **7.0** (r8 7.0) | 1. **The cluster (x 0.13–0.72, y 0.20–0.33) is over the mill now, but its finish falls short.** Three crags overlap above the windmill. They span 0.58 of the width; the mockup's four or five span 0.80 (x 0.08–0.88), sit lower (their bottoms at y 0.40 against 0.32) and frame the sun and the mill top. The game's crags are one flat warm grey (chroma 51; the mockup's are 42–91 with orange-lit rims). The centre crag is smooth (sd 7, hp 2.8 against 15–29 and 7–12). Few roots hang where the mockup has dense curtains. 2. **The meadow (x 0–0.6, y 0.64–0.86) lost its highlights.** p90 is 93 against 122 (r8 109), and sd 22.8 against 34.1. It is still edge-to-edge straw, with no grey rocks at the lower left and almost no daisies. 3. **The middle distance (y 0.45–0.65) is unchanged and dim:** p50 69 against 87; under the bridge 77 against 108. The mill is still a white stone tower. |
| `round-18-council-mockups/mockup-B-quest-start-painterly` (mock-B-quest-start) | **6.8** (6.5) | 1. **The sky (y 0.15–0.45).** Under the lead's ruling the cluster's presence is not counted. Its finish is A's: smooth, evenly lit grey crags at x 0.25–0.85, y 0.27–0.37. The sun is still at x 0.40, against the mockup's flood from the right edge. 2. **The foreground (x 0–0.45, y 0.58–0.86).** The oversized boulder is gone, and the patch now reads near the mockup's (p50 66 against 62, hp 17.2 against 21.6). But it is all tall dark grass (the meadow p50 62 against 79). The mockup's lit grey stones and daisies (x 0–0.4, y 0.64–0.86) are absent: the moved rocks sink out of sight in the strands. 3. **The keeper's set (x 0.05–0.45, y 0.45–0.62).** The book now shows open pages to the camera (a gain, verified). The keeper's arm is still straight and stiff, with no open palm, and the coat is plain beside the mockup's layered cloth and satchel. |
| `round-18-council-mockups/mockup-C-hands-fan-painterly` (mock-C-hands-fan) | **6.2** (6.0) | 1. **The sky (y 0.05–0.45).** The upper sky is lavender and dark: 168,144,152, p50 141, against 230,193,161 and 205. The +1–3 "warmer, lighter" lift does not register. The cluster's presence is excused; its finish is as in A, and it sits right over the mill where the mockup's sky has open cumulus and one small isle. 2. **The fan (x 0.5–1, y 0.55–0.82) is unchanged.** It is about half the mockup's leaf, upright at the right edge, where the mockup sweeps it diagonally across the centre with a long tassel. 3. **The foreground (x 0.05–0.65, y 0.77–0.86) is better.** It is 99,82,35, p50 79, chroma 64, against 89,73,40, 67 and 49 (r8: 118,96,42, 94, 76). There is still no rock at the lower left and few flowers. |
| `round-11-review/mockup-D-crown-arena` (mock-D-crown-arena, staged `roc-opening`) | **7.0** (6.5) | 1. **The Roc (x 0.07–0.68, y 0.10–0.45) now has the mockup's size and colour, but not its pose or finish.** Its mids are 124,99,89, chroma 35, against 128,96,91, chroma 36: round 8's brown is gone. It is side-on, though, head to the left, the near wing straight up in an upstroke and the far wing down-right. The mockup's eagle comes at the camera three-quarter, both wings level across ~0.97 of the width, talons forward. The wing reads dark-barred (44 % of the raised wing is under L 60, against 4 %), with half the feather detail (hp 7.8–10.9 against 18.6–22.8) and visible square texels at this distance. 2. **The light (y 0.40–0.65) has regressed.** 11.6 % of the middle band is over 230 (r8 8.2 %, mockup 5.2 %), and 16.6 % between the stones (3.3 %). The gap is a hot yellow wash, not the mockup's cloud sea with isles. The storm is still darker (p50 65 against 87). 3. **The arena floor (y 0.62–0.86) is still inverted.** The dais floor band is 39 against 74. The near field came down from 92 to 77 (mockup 55, chroma 64 against 35). There are no lit grey rocks or daisies in the foreground. |
| `round-1-proposals/B-sky-reach` (mock-proposal-B) | **5.8** (6.0) | Scored on what the fixed camera can match (the lead's ruling). 1. **The sky (y 0.05–0.5)** is still orange: upper chroma 80 and sky patch 81, against 19 and 26. The cluster now caps the mill at y 0.17–0.30. The mockup's isles hang at mid height either side of the mill (y 0.3–0.65), in pale silver-gold air. 2. **The foreground (x 0–1, y 0.55–0.86) is darker again:** p50 52 and p90 78 against 66 and 154 (r8 60 / 93), hp 12.3 against 15.6. The mockup has a sunlit grass crest with daisies. 3. **The destination (x 0.1–0.9, y 0.3–0.55)** is unchanged: a wide flat shelf with five pines and a white mill, against the mockup's narrow rooted spur with the manta beside it. |

**Seat score, Sky Reach: (7.0 + 6.8 + 6.2 + 7.0 + 5.8) / 5 = 6.56, rounded to 6.6** (round 8, this seat: 6.4).

## The README's claims, checked

| Claim | Verdict | Evidence |
|---|---|---|
| The Roc's near-black paint lifted to a slate floor | **verified, and it works** | Mids 124,99,89 / 143,112,98, chroma 35–45, against the mockup's 126–128,92–96,91, chroma 34–36. Round 8's 162,120,85 (chroma 76) is gone. |
| The upper sky warmer and lighter above 18° | **in code, not in the pixels** | `sky.ts` multiplies by (1.28, 1.14, 0.98) through `smoothstep(18, 40, elev) * 0.6`. A portrait frame at pitch −3…+3° tops out at ~33–39°, where the weight is still small. The rows y 0–0.15 lift by 1–3 levels. The seats' upper-sky patches are unchanged: A 172 → 171, C 140 → 141, B 167 → 168, mean colour unchanged. The gap to the mockups is 12–64 levels. |
| The meadow's backlight glow down | **verified; it helps C and D and hurts A, B and proposal B** | D's near field 92 → 77 (mockup 55) and C's 94 → 79 (67) move toward the mockups. A's meadow p90 109 → 93 (122) and sd 27 → 23 (34). B's meadow 76 → 62 (79). Proposal B's foreground p90 93 → 78 (154). One global cut fitted two views and pulled three away (seat A's round-8 X5 again). |
| B's rocks 5–6 m out: spread 67, hp 13.8 against 72, 13.4 | **hp reproduces; the luminance does not** | On the same patch at 390 px: game 44/68/101, spread 57, hp 13.7. The claim's 50/77/117 was measured at 5abe9d651, before 109655ccb's glow cut. The mockup on that patch reads 41/67/122, spread 80, hp 17.3, not 38/63/110, 72, 13.4. The rocks are now barely visible (a sliver at x 0–0.06, y 0.6), so the mockup's lit stones are absent. |
| The crown's runes flush, pale worn stone; the dais rim fractured | **verified as built** | `crown.ts` (efca93202). At phone size they still read as pale spirals; the frame change is within noise. |
| The keeper's book faces its reader | **verified** | B x 0.33–0.40, y 0.51–0.53: open white pages with a ribbon where round 8 showed the box's back. |
| One ordinary play run | **verified, with two notes** | `playrun-result.json`: 4 legs and 0 stuck. The updraft goes from y 30.26 to 44.23 in 5.55 s. The winch is raised in 2.52 s by the E key, and the arena leg ends 11.33 m from the crown's centre. Legs 1→2 and 2→3 join within 0.5 m. Leg 4 starts 3.9 m from leg 3's end, because the quest's REWARD_VIEW places the player (game behaviour, not the script's). The script sets `animals.calm = true` for the whole run, so the fight's start is not exercised by it. |
| h3 faces the step | **verified** | The camAt yaw sign flipped (dir x −0.646 → +0.646). h3 now frames the step isle with its waterfall, and the pine no longer blocks it. Round 8 finding 6 is closed. |

## Ledger 5: the cameras, the staging, the cluster

- **Cameras:** the camAt blobs are identical except h3's corrected yaw (a hero view, no mockup), as the README says. The only
  `mock-*` change is D's stage and settle. The phone tier, touch HUD and baseline HUD are unchanged. 0 page errors.
- **The `roc-opening` stage: reachable; I accept it as a real play frame.**
  - Before a fight, the Roc perches on PERCH. That is the tallest stone (h 5, i = 2) at (0, −204), y 49.6.
  - Every fight's first think sets `takeoff = 1.5 s` (`fighting && !wasFighting`). The Roc then rises 4 m at 2.5 m/s toward its lap point, turning at the flight's rate.
  - D's camera stands 14 m from the crown's centre, inside the 18 m arena. A player who walks in triggers the fight at z ≈ −172 and is at this spot about 1 s later.
  - The geometry fits the frame:
    - the perch is 28 m out, at x 0;
    - after 0.5 s the Roc is ~1.3 m up and turned about a radian off its south-facing perch yaw, so it shows side-on;
    - the body reads at ~9° up, about 4–5 m above the eye, which agrees within 1–2 m.
  - `stageOpening` uses the same take-off state that real play sets.
  - The window is short: the frame is alike for ~0.6 s of a 1.5 s rise. But it is not a freeze. The wing pose is the live flap, with its bank, the LOCK button and the target marker.
  - The `storm.strike(1.0)` bolt is scheduled after the 0.5 s frame, so it plays no part in this shot.
- **The cluster (the lead's ruling):**
  - It is real 3D in the world. The orbit clip and the aerials show three ordinary crags behind the windmill isle.
  - It shows in A, B, C and proposal B.
  - I score its presence in B and C as the ruled conflict, and its finish (finding 2) in all four views.

## Findings, ranked by score gained

1. **New (regression): the meadow's glow cut took the highlights out of A, B and proposal B** (A x 0–0.6, y 0.66–0.84;
   B x 0–0.45, y 0.58–0.66; proposal B x 0–0.45, y 0.62–0.84).
   - **Evidence:**
     - A's p90 is 93 against 122 (r8 109), and its sd 22.8 against 34.1.
     - Proposal B's p90 is 78 against 154 (r8 93).
     - B's meadow is 62 against 79.
     - Meanwhile C and D, the views the cut was fitted to, moved toward their mockups.
   - **Fix:**
     - Restore the glow where the camera looks along the sun's azimuth (A, B, proposal B), and keep the cut only for blades lit from behind at a steep angle (D's near field). Or split it by distance, since D's offending grass is 2–6 m out.
     - Put the mockups' highlights back as objects, not glow: the white and yellow daisies (A and B have dozens) and the lit grey stone tops.
     - Check every change on all five views' patches before committing.
2. **Repeated, in a new form: the cluster's finish** (A x 0.13–0.72, y 0.20–0.33; the same crags in B, C and proposal B).
   - **Evidence:**
     - Placement: three crags spanning 0.58 of the width with their bottoms at y 0.32, against the mockup's 0.80 and 0.40.
     - Colour: one flat warm grey, chroma 51, against the mockup's 42–91 with orange-lit rims.
     - Detail: the centre crag is smooth (sd 7, hp 2.8, against 15–29 and 7–12).
     - Roots: a few thin strands where the mockup hangs dense root curtains.
   - **Fix:**
     - Bring the cluster lower and wider so it frames the windmill top and the sun, as mockup A does: one more crag left of the sun, lower.
     - Give the centre crag the right crag's strata or crevice relief.
     - Add hanging-root curtains (many long strands per crag).
     - Light the grass rims from the sun's side, so the tops glow gold against the shaded undersides.
3. **Repeated: the Roc's pose and feather finish** (D x 0.07–0.68, y 0.10–0.45).
   - **Evidence:**
     - Size and colour are now right (mids chroma 35 against 36).
     - The pose is not: it is side-on with the near wing vertical, against the mockup's three-quarter view with both wings level and talons forward.
     - The raised wing is 44 % darks against 4 %, with hp 7.8–10.9 against 18.6–22.8, and visible square texels.
   - **Fix:**
     - Hold the take-off's yaw toward the arena (the perch yaw, facing the entrance) for its first ~0.8 s, wings in a level glide rather than mid-stroke, and only then turn out to the lap. That is the mockup's pose, and a real one.
     - Drop the talons forward during the rise.
     - Raise the wing texture's resolution (or its mip bias) at this near distance.
     - Lighten the dark coverts' bars toward the mockup's slate.
4. **New (regression): D's hot band** (D y 0.45–0.65; between the stones x 0.3–0.9, y 0.5–0.6).
   - **Evidence:** 11.6 % and 16.6 % over 230 (r8 8.2 % and 8.7 %; mockup 5.2 % and 3.3 %). h4 rose the same way (8.4 → 11.4 %), so the staging did not cause it.
   - **Fix:** find which of this round's commits brightened the horizon under the sun (bisect h4 between 185b6810 and d3eefd5c7). Then put the mockup's cloud sea with distinct isles between the stones in place of the flat yellow wash.
5. **Repeated: the upper sky** (A, B and C x 0.05–0.38, y 0.10–0.25; proposal B's whole sky).
   - **Evidence:** unchanged within 1–3 levels. C is 141 against 205 and lavender. Proposal B's chroma is 80 against 19.
   - **Fix:** start the warm lift at ~8–10°, not 18°. A portrait frame never sees past ~39°, so a ramp that only reaches full strength at 40° cannot move these frames. Lift C's and B's zenith toward 220,185,160. Desaturate proposal B's sky (it shares the dome, so check it on A at the same time).
6. **Repeated: the foreground objects the mockups show** (A x 0–0.35, y 0.70–0.85; B x 0–0.4, y 0.64–0.86; D x 0–0.45, y 0.72–0.86; C x 0–0.2, y 0.80–0.86).
   - **Evidence:** B's rocks moved 5–6 m out and are now hidden in the strands. A, C and D still show none of the mockups' lit grey stones with daisies round them.
   - **Fix:** low, lit-topped stones that stand above the grass height, with daisy clumps in the near meadow. Real, walkable placement; walk-check them.
7. **Repeated: D's arena floor is inverted** (D x 0–0.45, y 0.70–0.74).
   - **Evidence:** p50 39 against 74 (r8 42).
   - **Fix:** light the sward round the dais. Its shade floor and root band are the darkest thing in the frame, where the mockup has its lit grass.
8. **Repeated, unchanged: the sun's side and the subjects' forms.**
   - The sun is at x 0.40 in B (mockup at the right edge) and x 0.42 in C (mockup x 0.05).
   - C's fan is half the mockup's leaf.
   - The keeper's arm is rigid.
   - The mill is a white stone tower.
   - Proposal B's destination is a wide shelf.
   - The builder lists the fan and the keeper as not done.

SCORE sky-reach: 6.6
