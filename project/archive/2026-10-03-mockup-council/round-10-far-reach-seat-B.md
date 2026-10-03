# Round 10, seat B, Sky Reach (Claude, lens: evidence, measured region by region)

Surface:
- The Sky Reach section of `art/mockup-council/round-10/README.md` and the five sheets `art/mockup-council/round-10/far-reach-*.jpg`.
- `progress/far-reach/20261003-0516-750b533a/`: every `mock-*`, h3, h4, both aerials, `clip.mp4` (0.5 fps tiles) and `meta.json`.
- Round 9's capture `20261003-0447-d3eefd5c`, for before and after.
- The five ledger mockups at full resolution.
- Source and diffs at the capture: 9b96cccdf (`combat/stormRoc.ts`, `species/stormRoc.ts`, `look/render.ts`, `world/meadow.ts`,
  `world/skyIsles.ts`, `playrun.mjs`, `playrun-result.json`), 750b533af (`look/sky.ts`, `weapons/WarFan.ts`,
  `world/skyIsleHd.ts`, `world/skyIsles.ts`) and c264911bb (`quest/keeper.ts`); `layout.ts` (`ROC`, `CROWN`, `HIGH`).

Method:
- My round-9 method, so every row compares directly. Each frame is resized to 780×1688 (Lanczos). Regions are fractions
  of the frame (x left to right, y top to bottom, HUD included).
- On each patch: mean RGB and chroma (max−min); Rec. 709 luminance p10 / p50 / p90, its standard deviation and the share
  above 230; fine detail "hp", the standard deviation of L minus its 3 px Gaussian blur.
- **Fair crops.** The fan's one hold is now larger and lower, so several of round 9's patches take in more fan this round.
  I located the viewmodel in both captures (pixels constant across all five views, plus the fan's teal): round 10's fan
  reaches x 0.43–0.45 at y 0.64–0.80 (round 9's x 0.52–0.53). Every foreground patch below is cut at x ≤ 0.36, clear of
  both fans; where I also quote a round-9 full-width patch, it is labelled as such. My round-9 numbers reproduce exactly
  (A meadow 40/61/93, sd 22.8), so the tool is the same.

## Measured (mockup / round 9 / round 10)

| Patch | Mockup | Round 9 | Round 10 | Reading |
|---|---|---|---|---|
| Play rows y 0.05–0.85, share > 230 (A / B / C / D / P) | 2.2 / 2.4 / 1.9 / 2.9 / 3.8 % | 2.4 / 2.2 / 2.2 / 3.3 / 2.7 % | 2.4 / 1.9 / 2.3 / 2.8 / 3.0 % | in the mockups' range |
| A meadow, fan-clear x 0–0.36, y 0.66–0.84: L p10/p50/p90; sd; hp | 39/61/108; 30.9; 20.7 | 39/60/91; 22.5; 15.4 | **43/69/108; 27.3; 18.5** | **the highlights are back** (p90 matches); median +8 |
| A cluster crags (mockup back-left / front-left / right; game left / centre / right): L p50; sd; hp | 131 / 132 / 106; 44 / 44 / 44; 11.4 / 12.1 / 11.2 | 122 / 116 / 163; 22 / 20 / 36; 8.7 / 8.3 / 9.5 | **96 / 96 / 117; 30 / 23 / 54; 11.8 / 11.6 / 12.9** | detail now matches; darker than the mockup's sunlit crags; left and centre chroma 53–58 against 79–100 |
| A cluster span (frame width); bottoms (y) | x 0.02–0.88; ~0.37 | x 0.13–0.72; ~0.33 | **x 0.00–0.82; ~0.355** | the claim's "toward 0.80" holds |
| A subject band y 0.45–0.65 p50; under the bridge x 0.25–0.75, y 0.53–0.6 p50 | 87; 108 | 69; 77 | 70; 82 | still dim |
| A upper sky x 0.05–0.38, y 0.10–0.25: mean; p50 | 219,182,162; 184 | 199,161,145; 171 | 209,170,152; **178** | +7 |
| B lower left x 0–0.3, y 0.66–0.85: p50/p90; sd; hp | 62/125; 36.4; 21.6 | 66/107; 26.0; 17.2 | **78/128; 32.1; 20.9** | spread and detail match; median +16 |
| B meadow, fan-clear x 0–0.36, y 0.58–0.66: p50/p90; hp | 71/135; 20.1 | 60/92; 15.4 | **69/105; 18.4** | closer |
| B upper sky: mean; chroma | 154,140,142; 27 | 194,161,153; 48 | 199,167,154; 47 | still twice the mockup's colour |
| C upper sky x 0.05–0.38, y 0.10–0.25: mean; chroma; p50 | 230,193,161; 70; 205 | 168,144,152; 41; 141 | **185,159,153; 35; 152** | the builder's 141 → 152 reproduces. Lighter, but greyer (R−B 32 against the mockup's 69) |
| C upper x 0–1, y 0.05–0.25 p50; x 0.2–0.6, y 0.04–0.09 p50 | 170; 165 | 122; 111 | **143; 141** | a real lift, two-thirds of the gap left at the very top closed |
| C foreground, fan-clear x 0.05–0.36, y 0.77–0.85: mean; chroma; p50/p90 | 90,73,44; 47; 66/131 | 101,84,35; 66; 81/121 | **120,98,42; 78; 96/143** | **regression**: back to straw (round 8 level) |
| C fan leaf, teal share of the frame | 3.9 % | 2.0 % | **2.6 %** | two-thirds of the mockup's leaf |
| D middle band y 0.45–0.65, full width (round-9 patch) | 5.2 % | 11.6 % | 9.2 % | down, but the fan now covers more of this band |
| D middle band, fan-clear x 0–0.47, y 0.45–0.65 | 10.3 % | 14.8 % | **15.9 %** | **no improvement on fan-free ground** |
| D between the stones, by column y 0.50–0.60: x 0.3–0.5 / x 0.5–0.7 | 9.0, 4.6 / 3.9, 2.0 % | 12.6, 13.3 / 38.2, 34.0 % | **32.1, 31.7 / 0.2, 0.0 %** | the lit puff moved from right of centre to under the sun; it did not go |
| h4, fan-clear x 0–0.47, y 0.48–0.60 | — | 23.4 % | 23.3 % | unchanged |
| D storm x 0.05–0.65, y 0.09–0.25: mean; p50/p90; chroma | 109,95,103; 87/158; 25 | 91,71,82; 65/137; 35 | 90,71,93; 71/124; 35 | still darker and violet |
| D floor, fan-clear x 0–0.36, y 0.70–0.74, p50 | 66 | 38 | 42 | still inverted |
| D near meadow, fan-clear x 0–0.36, y 0.74–0.84: p50/p90; chroma | 55/109; 35 | 75/126; 63 | **98/159; 78** | **regression** (the glow revert) |
| D Roc: extent (x; y) | 0.00–0.97; 0.16–0.43 | 0.07–0.68; 0.10–0.45 | **0.03–0.92; 0.28–0.40** | span right, wings level and under the bar; the body is a thin strip (0.10 of the height against 0.26) |
| D Roc far wing: dark < 60; hp | 4–5 %; 21–24 | 40 %; 16.4 | **38 %; 4.4** (x 0.58–0.9, y 0.315–0.36) | smeared, banded, almost no feather detail |
| P foreground, fan-clear x 0–0.36, y 0.62–0.84: p50/p90; hp | 69/159; 16.1 | 52/78; 12.4 | 59/93; 15.2 | back up a little |
| P sky patch x 0.18–0.82, y 0.17–0.33: mean; chroma | 206,191,182; 26 | 205,166,125; 81 | 190,152,112; 78 | still orange; the patch now holds more crag |
| Sun (x, y) A / B / C / D / P | 0.35,0.36 / 0.97,0.42 / 0.06,0.37 / 0.24,0.46 / 0.25,0.40 | unchanged | 0.29,0.39 / 0.40,0.40 / 0.43,0.46 / 0.30,0.45 / 0.29,0.30 | B and C still far from their mockups' edges |

## Scores

| Mockup | Score | The three biggest differences (region) |
|---|---|---|
| `round-11-review/mockup-A-spawn-look` (mock-A-spawn-look) | **7.3** (r9 7.0) | 1. **The cluster (x 0–0.82, y 0.20–0.36) now has the mockup's span and depth, not its tops.** Width 0.82 against 0.88, bottoms 0.355 against 0.37, and crag detail at the mockup's level (hp 11.6–12.9 against 11.2–12.1). But the caps are still flat lawns with 1–3 cone pines, where the mockup's crags carry bushy wooded crowns and long root curtains. The left and centre crags are dark brown-grey (p50 96, chroma 53–58) where the mockup's glow orange around the sun (131, chroma 79–100). 2. **The meadow (x 0–0.6, y 0.62–0.86).** Its highlights are back (fan-clear p90 108 against 108; sd 27 against 31), but it is all upright straw: none of the mockup's three grey boulders at the lower left (x 0–0.3, y 0.70–0.82) and only a few daisy specks. The fan now covers x 0.43–0.85, y 0.58–0.86; the mockup's fan is a small one at the right edge (teal share 1.4 % against 2.7 %). 3. **The middle band (y 0.45–0.65) is still dim:** p50 70 against 87, and under the bridge 82 against 108. The mill is a white stone tower. |
| `round-18-council-mockups/mockup-B-quest-start-painterly` (mock-B-quest-start) | **7.0** (6.8) | 1. **The sky (y 0.10–0.45).** Under the lead's ruling I score the cluster's finish, not its presence: as in A, darker crags with flat pine caps, and now larger and lower (x 0–0.9, y 0.30–0.47), so it fills more of the open cumulus the mockup has. The upper sky is twice the mockup's chroma (47 against 27). The sun is at x 0.40, against a flood from the right edge. 2. **The keeper (x 0.07–0.27, y 0.45–0.62)** now waves from the elbow, forearm raised beside his head (verified, c264911bb). His upper arm sticks out level where the mockup's hangs by his side with an open palm at head height, and his coat is still plain beside the mockup's scarf, satchel and layered cloth. 3. **The foreground (x 0–0.45, y 0.58–0.86)** is the closest it has been: spread and detail match (sd 32 against 36, hp 20.9 against 21.6), median 78 against 62. It is still all grass: no lit grey stones, few daisies. |
| `round-18-council-mockups/mockup-C-hands-fan-painterly` (mock-C-hands-fan) | **6.4** (6.2) | 1. **The fan (x 0.43–0.86, y 0.58–0.86) is larger but still not the mockup's hold.** The leaf is two-thirds of the mockup's (2.6 % against 3.9 %). Its pivot sits at the lower left (x 0.43, y 0.81) and it opens up and to the right, while the glove sits apart at the right edge (x 0.92–1, y 0.75). The mockup's pivot is in the glove at the lower right (x 0.8, y 0.68), the leaf sweeps up-left across the centre, and a long red tassel hangs from it. 2. **The sky (y 0.05–0.45)** is lighter (152 against 205, was 141; the top band 141 against 165, was 111) but greyer, not warm (R−B 32 against 69). The cluster sits over the mill where the mockup has open cumulus (ruled), and the sun is at x 0.43 where the mockup's is at the left edge. 3. **The foreground (x 0.05–0.36, y 0.77–0.85) regressed:** p50 96 against 66 (r9 81), chroma 78 against 47, straw again. No rock at the lower left, no flowers. |
| `round-11-review/mockup-D-crown-arena` (mock-D-crown-arena, staged `roc-opening`, settle 3.3 s) | **7.0** (7.0) | 1. **The Roc (x 0.03–0.92, y 0.28–0.40).** It now spreads both wings level across the frame under the bar, the mockup's span. But it is seen from below and behind, flying away: no head, no beak, two grey lumps for feet, and a pale zigzag seam down the body. It is a thin strip (0.10 of the frame's height against the mockup's 0.26). The far wing is smeared (hp 4.4 against 21–24) and 38 % dark bars against 4–5 %. 2. **The light between the stones (x 0.3–0.6, y 0.48–0.62) is still a hot wash.** On fan-free ground the band is 15.9 % over 230 (r9 14.8 %, mockup 10.3 %). The lit puff moved from x 0.5–0.7 to x 0.3–0.5, under the sun (32 % there). No cloud sea with isles as in the mockup; the storm is still darker and violet (p50 71 against 87, chroma 35 against 25). 3. **The arena ground (y 0.62–0.86).** The near meadow regressed to 98 against 55 (r9 75), the floor behind the dais is still dark (42 against 66), and the fan now covers the dais from x 0.45 (r9 0.53). The mockup shows no fan in this view at all. |
| `round-1-proposals/B-sky-reach` (mock-proposal-B) | **5.8** (5.8) | Scored on what the fixed camera can match (the lead's ruling). 1. **The sky (y 0.05–0.5)** is still orange (chroma 78 against 26), and the larger, lower cluster now fills the band over the mill (y 0.17–0.33) where the mockup has pale open sky, its isles at mid-height either side. 2. **The foreground (x 0–0.45, y 0.62–0.86)** is up a little (fan-clear 59/93 against 69/159; r9 52/78), but still an unlit field, not the mockup's sunlit crest with daisies. 3. **The destination (x 0.1–0.9, y 0.3–0.55)** is unchanged: a broad flat shelf with five pines, not the narrow rooted spur, and no manta with its wake. |

**Seat score, Sky Reach: (7.3 + 7.0 + 6.4 + 7.0 + 5.8) / 5 = 6.70, rounded to 6.7** (round 9, this seat: 6.6).

## The README's claims, checked

| Claim | Verdict | Evidence |
|---|---|---|
| The glare's cause: the crown's cloud bank had the keels' random stream; on its own seed now | **the seed change is real; the glare is not fixed** | `render.ts` has `rndB` (seed 9137). The bright puff moved rather than went. By column in y 0.50–0.60, x 0.5–0.7 fell from 34–38 % to 0 %, but x 0.3–0.5 rose from 13 % to 32 %. On fan-free ground (x 0–0.47) the band is 15.9 % against 14.8 % in round 9 and 10.3 % in the mockup. h4's fan-free patch is unchanged (23.4 → 23.3 %). The full-width drop 11.6 → 9.2 % is partly the bigger fan covering the band's right side. |
| The meadow's glow back to round 8's | **verified; A, B and P recover, C and D regress** | `meadow.ts` 0.8 / 0.4 → 1.4 / 0.7. A's fan-clear p90 91 → 108 (mockup 108); B's meadow 92 → 105 (135); P 78 → 93 (159). C's verge 81 → 96 (66); D's near field 75 → 98 (55). It is the round-8 trade again (finding 2). |
| The cluster larger and lower: keels to ~6°, -17° to +12°; darker crags, gold rims, lighter haze | **span and detail verified; the gold rim is not sun-side** | Span x 0–0.82, bottoms y 0.355. Crag hp 11.6–12.9 against the mockup's 11.2–12.1 (r9 8.3–9.5). `skyIsleHd.ts` multiplies every crag by 0.82 and adds `pow(1 − |N·V|, 3) * 0.55` gold. That is a view-angle fresnel, so it lights every crag's silhouette gold whichever side the sun is on; it is not "toward the low sun". In A the left and centre crags are darker than the mockup's (p50 96 against 131). |
| One fan hold for every view: larger, lower, more diagonal (scale 0.47, roll 0.95); A's bridge and D's dais stay clear | **one global hold, verified; "D's dais stays clear" is false** | `WarFan.ts` HOLD: scale 0.4 → 0.47, roll 0.8 → 0.95, y −0.172 → −0.205. The bridge deck in A is clear, and the fan's tip touches the right post's base. In D the teal starts at x 0.45 on the dais rows (r9 0.53), so it covers the dais's right part and two stone bases. C's leaf grows to 2.6 % of the frame (mockup 3.9 %), while A's and proposal B's mockups hold a smaller fan (1.4 %, 1.8 %) and D's none. |
| The high sky warmer and lighter (C 141 → 152) | **verified as luminance; not as warmth** | C's patch 141 → 152 and the top band 111 → 141. Its chroma fell, 41 → 35 (mockup 70), and R−B is 32 against 69: lighter grey-mauve, not peach. `sky.ts` mixes toward `(1.22, 0.98, 0.8) * max(L * 1.35, 0.42)` at up to 0.5 from 16–34°, so most of the frame's top still gets less than half the shift. |
| The keeper's elbow wave | **verified** | B x 0.07–0.27, y 0.45–0.55: the forearm is raised beside the head from a bent elbow. The upper arm sticks out level (finding 6). |
| The play run with creatures live | **verified** | `playrun.mjs` sets `calm = false`. `playrun-result.json` moves by ≤ 0.04 m and ≤ 0.04 s against round 9, and still ends 11.36 m from the crown's centre. It still logs no Roc state at the fight's start. |
| h3 back at yaw 41, toward the step | **verified** | camAt dir (−0.646, 0.174, −0.743), the step's bearing. The frame shows the step isle and its hut, the pine at the left edge. |

## Ledger 5: the cameras, the staging, the cluster

- **Cameras:** every `mock-*` camAt is identical to round 9's; only h3 changed (back toward the step, named). Phone tier,
  touch HUD and baseline HUD are unchanged; 0 page errors.
- **The 4 s take-off: plausible play, accepted, with a should-fix on what it shows.**
  - It is global: `think` sets `takeoff = 4` and `rest ≥ 4.5` at every first-phase fight start, and `restart()` now resets
    both on a retry (round 9's retry bug is fixed in code).
  - From the bridge landing, a player who walks straight to D's spot arrives ~3.1 s after `begin` (the 1.5 s intro locks
    input before it), so the 3.3 s frame is a moment that player sees. A 4 s slow lift at a boss's start is an ordinary
    boss-intro length, and the player gets 4.5 s without an attack, which is not easier in any way that changes the shot.
    I accept it.
  - But the commit says outright that the time was tuned so the walk-in still sees it. The fix that matters is what the
    take-off shows (finding 1), not its length.
  - Why the bird shows its back: the take-off steers toward its lap point. `stageOpening` sets
    `angle = atan2(perch.z − ROC.z, perch.x − ROC.x)`, which is −π/2 for the perch (0, −204) and lap centre (0, −196), so the
    lap point is (0, −209): due north, away from D's camera at z −176. It is placed facing south toward the camera, and by
    3.3 s it has turned to fly away. That is why the head is hidden and the bird reads as a thin strip from below.
- **The cluster** is one global layout (o1 / o3 / o4 rows in `skyIsles.ts`), the same in A, B, C, P, the aerials and every
  orbit frame. I score its presence in B and C as the ruled conflict, and its finish in all four.
- **The keel over the arena (note):** o3 now sits at (−4, −170), deck 72, keel 22, so its keel tip is at about y 50. That
  is ~6 m over the crown deck (`HIGH` 44) and ~7 m in plan from D's camera, just past the crown's south rim. It does not
  show in D or h4 (it is behind them). Check that a hovering player and the Roc's stalk at `p.y + 10` cannot clip it.

## Findings, ranked by score gained

1. **Repeated, new cause found: the Roc flies away from D's camera** (D x 0.03–0.92, y 0.28–0.40).
   - **Evidence:** the wings are now level and spread under the bar, the mockup's span. But the take-off heads for the lap
     point at (0, −209), due north, so at 3.3 s D sees the belly and back: no head, feet as two lumps, 0.10 of the
     frame's height against 0.26. The far wing is smeared (hp 4.4 against 21–24) with 38 % dark bars against 4–5 %, and a
     pale zigzag seam runs down the body.
   - **Fix:** start the lap on the arena's south side, or take off toward the entrance and bank into the lap after it.
     Then the 3.3 s frame shows the head, the breast and the talons coming at the player, as the mockup does. Both are
     real behaviour every fight would show. Drop the talons forward during the rise. Close the body seam, and raise the
     wing texture's resolution or fix its mip filtering at this distance.
2. **Regression: the meadow-glow revert put C's and D's straw back** (C x 0.05–0.36, y 0.77–0.85; D x 0–0.36, y 0.74–0.84).
   - **Evidence:** C 96 against 66 (r9 81), D 98 against 55 (r9 75). A, B and P recovered. This is the third global flip
     of the same two coefficients (rounds 8, 9, 10).
   - **Fix:** stop tuning one global number. The views differ in where the sun is relative to the camera. C and D look
     with the sun ahead and low, so their near blades are lit from behind: scale the `back * up³` term down where the blade
     is within ~6 m of the camera *and* backlit, or cap the backlit glow's luminance. Keep 1.4 for the front-lit
     `glow * sh²` that A, B and P need. Check all five fan-clear patches before committing.
3. **Repeated: D's hot band, not fixed by the re-seed** (D x 0.3–0.5, y 0.48–0.62; h4 the same).
   - **Evidence:** fan-free 15.9 % over 230 against 10.3 %; x 0.3–0.5 now 32 % (r9 13 %). h4's fan-free patch is
     unchanged at 23 %.
   - **Fix:** the puffs right under the sun are the problem, whatever the seed. Keep the bank's puffs out of a cone of
     ~8–10° under the sun's direction from the crown, or cap their sun-facing lit term. Put the mockup's isles and a
     dimmer cloud sea in the gap instead. Measure on a fan-free crop.
4. **Repeated: the fan's hold.** One hold has to serve five views. Mockups A, B and P hold a small fan at the right edge,
   C a big diagonal one, and D none.
   - **Evidence:** C's leaf is now 2.6 % of the frame against 3.9 %, but A's and P's fans grew past their mockups'
     (2.7 % against 1.4–1.8 %), and in D it now covers the dais from x 0.45.
   - **Fix:** C's mockup is about the hold, not the size. Put the pivot in the glove at the lower right with the leaf
     sweeping up-left, and hang the tassel from the pivot. At that angle a scale-0.4 fan reads as C's subject while
     covering less of A's, B's and D's middle ground. Today the pivot is at the lower left, away from the glove.
5. **Repeated: the cluster's tops and colour** (A x 0–0.82, y 0.20–0.36; the same crags in B, C and P).
   - **Evidence:** the span and detail landed. But the caps are flat lawns with 1–3 cone pines, the root curtains are
     thin, and the left and centre crags are 35 levels darker and half as warm as the mockup's (p50 96, chroma 53–58,
     against 131, 79–100). The gold rim is a view fresnel, not a sun-side rim.
   - **Fix:** bushy, rounded tree crowns and overhanging turf on the caps; long, dense root curtains under them. Make the
     rim depend on the sun's direction (`dot(N, sunDir)` with a backlight wrap) rather than on `N·V`, so the sides that
     face the low sun glow and the far sides stay dark. Lift the base darkening (×0.82) for the crags near the sun.
6. **Repeated: the upper sky's warmth** (C x 0.05–0.38, y 0.10–0.25; B's and P's whole sky).
   - **Evidence:** C is lighter (152) but greyer (chroma 35 against 70). B's and P's chroma is 47 and 78 against 27 and 26:
     those views need less colour, and C needs more.
   - **Fix:** C's mockup is warm peach, while B's and P's are pale and silvery, and all three share a dome. Since that
     cannot be one tint, match each view's dominant sky region in luminance first, then pick the hue the three agree on:
     less saturated than the current orange at the horizon, warmer than the current grey-mauve at the top.
7. **Repeated: the foreground objects the mockups show** (A x 0–0.35, y 0.70–0.85; B x 0–0.4, y 0.64–0.86; C x 0–0.2,
   y 0.80–0.86; D x 0–0.45, y 0.72–0.86).
   - **Evidence:** no lit grey stones and few daisies in any of the four.
   - **Fix:** low stones with lit tops that stand above the grass, and daisy clumps around them; real, walkable
     placement, walk-checked.
8. **Repeated: D's floor and storm, and the subjects' forms.** D's floor is 42 against 66, the storm violet (chroma 35
   against 25). The keeper's upper arm should hang by his side, with the open palm at head height. The mill is a white
   tower, and proposal B's destination a broad shelf.

SCORE sky-reach: 6.7
