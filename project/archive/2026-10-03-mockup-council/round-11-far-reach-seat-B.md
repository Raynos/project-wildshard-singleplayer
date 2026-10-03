# Round 11, seat B, Sky Reach (Claude, lens: evidence, measured region by region)

Surface:
- The Sky Reach section of `art/mockup-council/round-11/README.md` and the five sheets `art/mockup-council/round-11/far-reach-*.jpg`.
- `progress/far-reach/20261003-0601-3307e64a/`: every `mock-*`, h1–h4, both aerials, `clip.mp4` (0.5 fps tiles) and `meta.json`.
- Round 10's capture `20261003-0516-750b533a`, for before and after.
- The five ledger mockups at full resolution.
- The commits between the captures: 3307e64a2 (`skyIsles.ts`, `skyIsleHd.ts`), 21d5e913c (`look/sky.ts`), 3de757394
  (`species/stormRoc.ts`), a28f585cb (`world/rayWake.ts`, `layout.ts`, `plugin.ts`, `meadow.ts`), plus `scripts/shard-progress.mjs`.

Method:
- My round-9/10 method. Each frame is resized to 780×1688 (Lanczos). Regions are fractions of the frame (x left to right,
  y top to bottom, HUD included).
- On each patch: mean RGB, chroma (max − min) and R − B; Rec. 709 luminance p10 / p50 / p90, its standard deviation and the
  share above 230; fine detail "hp", the standard deviation of L minus its 3 px Gaussian blur.
- **Fair crops.** The fan's hold did not change this round: on the fan's own pixels the r10 → r11 difference is 1.6–2.6 levels,
  which is JPEG noise. It reaches x 0.43 at y 0.64–0.86, so every foreground patch is cut at x ≤ 0.36. The crag patches
  are pure rock, checked on overlays (no sky, no pines).
- **Before / after.** I re-measured every round-10 patch on the round-10 capture with the same script. My r10 numbers
  reproduce to ±1, except D's fan-free middle band: it reads 18.5 % now against the 15.9 % I quoted in round 10, so my
  round-10 crop was not exactly this one. The r10 → r11 pairs below come from one run of one tool.
- A whole-frame diff (|ΔL| > 12) finds the changes in four places: the cluster band (A y 0.25–0.45, B y 0.25–0.47, C y 0.35–0.50, P
  y 0.15–0.40), D's Roc (y 0.25–0.37), D's sun band (y 0.50–0.60) and the grass (wind). The sky above y 0.25 is unchanged
  in every view (≤ 0.3 % of pixels).

## Measured (mockup / round 10 / round 11)

| Patch | Mockup | Round 10 | Round 11 | Reading |
|---|---|---|---|---|
| Play rows y 0.05–0.85: share > 230 (A / B / C / D / P) | 2.2 / 2.4 / 1.9 / 2.9 / 3.8 % | 2.4 / 1.9 / 2.3 / 2.8 / 3.0 % | 2.7 / 2.2 / 2.8 / 2.0 / 3.1 % | in range; D is now under the mockup |
| Play rows, L p99 (A / B / C / D / P) | 240 / 242 / 236 / 242 / 239 | 238 / 236 / 238 / 240 / 239 | 239 / 237 / 240 / 237 / 240 | the builder's "top 1 % 236–240" reproduces |
| A crag bodies (pure rock: back-left / centre / right): L p50; chroma | 126 / 117 / 94; 64 / 79 / 39 | 92 / 92 / 82; 50 / 59 / 62 | **99 / 104 / 87; 52 / 61 / 56** | "lighter" verified (+6 to +12); the two sunward crags are still 13–27 darker and less warm |
| A cluster tops / keel bottoms (y, read off the frames) | tops 0.24 (right), 0.25 (back-left), 0.30 (front-left); keels to 0.36–0.39 | tops ~0.27–0.30; keels ~0.355 | **tops 0.265–0.29 across the whole span; keels 0.33–0.36** | one tier, where the mockup has two |
| A gap right of the mill top x 0.47–0.57, y 0.24–0.31: L p50 | 132 (sky and crag edge) | 130 | 121 (crag) | o5 / o6 filled the mockup's open gap |
| A whole cluster band y 0.22–0.36: p50; sd; hp | 174; 46; 11.6 | 170; 48; 12.7 | 166; 48; 12.8 | the band's statistics match |
| A band under the cluster y 0.36–0.46: p50; > 230 | 175; 5.2 % | 205; 16.7 % | **204; 17.1 %** | the cloud wall behind the mill is 3× too hot |
| A subject band y 0.45–0.65 p50; under the bridge | 87; 108 | 70; 82 | 72; 85 | still dim |
| A meadow, fan-clear x 0–0.36, y 0.66–0.84: p10/p50/p90; sd; hp | 39/61/108; 30.9; 20.7 | 43/69/108; 27.3; 18.5 | 43/68/109; 27.8; 18.7 | unchanged |
| Daisies: white specks (L > 170, chroma < 60), fan-clear meadow (A / B) | 0.25 / 0.38 % | 0.07 / 0.00 % | 0.07 / 0.00 % | "tighter daisy drifts" changes nothing in these views |
| Sky by elevation, A x 0.05–0.6: 17–20° / 20–24° / 24–27°: p50; chroma | 204 / 184 / 172; 85 / 55 / 47 | 182 / 167 / 153; 60 / 43 / 41 | 182 / 167 / 153; 60 / 43 / 42 | unchanged; ~20 darker and less warm through 17–27° |
| Sky by elevation, C x 0.05–0.6: 23–27° / 27–30° / 30–33°: p50; chroma | 211 / 176 / 173; 80 / 67 / 47 | 157 / 150 / 147; 41 / 25 / 24 | 157 / 150 / 147; 42 / 25 / 24 | unchanged; grey-mauve above ~25° |
| B upper sky x 0.05–0.95, y 0.08–0.25: mean; chroma | 156,141,137; 32 | 167,144,138; 35 | 167,144,138; 35 | close |
| B lower left x 0–0.3, y 0.66–0.85: p50/p90; sd; hp | 62/125; 36.4; 21.6 | 78/128; 32.1; 20.9 | 78/127; 32.1; 20.9 | unchanged |
| C foreground, fan-clear x 0.05–0.36, y 0.77–0.85: mean; chroma; p50 | 91,74,44; 47; 66 | 121,99,43; 78; 96 | 121,99,43; 78; 96 | unchanged straw |
| D middle band y 0.45–0.65, full width, > 230 | 5.2 % | 9.2 % | **6.4 %** | the builder's 9.1 → 6.5 % reproduces |
| D middle band, fan-clear x 0–0.47, y 0.45–0.65 | 10.3 % | 18.5 % | **13.1 %** | real drop, still over |
| D between the stones x 0.3–0.5, y 0.50–0.60 | 6.8 % | 31.9 % | **28.3 %** | **barely moved: the hot puff is still there** |
| D sun halo, ring 0.07–0.14 of the width round the sun: p50; > 230 | 224; 31 % | 221; 25 % | **215; 5 %** | **the roll-off overshot: the halo is now a sixth of the mockup's** |
| D sun patch x 0.05–0.45, y 0.44–0.50, > 230 | 36.8 % | 39.7 % | 23.3 % | now under the mockup |
| h4 fan-clear x 0–0.47, y 0.48–0.60, > 230 | — | 23.3 % | 17.8 % | the same change |
| D Roc far wing x 0.58–0.9, y 0.315–0.36: dark < 60; p50; hp | 5.8 %; 82; 11.8 | 38.0 %; 68; 4.4 | **22.1 %; 80; 11.8** | feather detail now matches; dark bars still 4× |
| D Roc near wing x 0.08–0.40, y 0.30–0.36: p50; hp | 175; 12.2 | 120; 13.6 | 101; 14.2 | darker than the mockup's lit upper wing |
| D storm x 0.05–0.65, y 0.09–0.25: mean; p50; chroma | 109,96,103; 87; 25 | 91,71,93; 71; 35 | 91,71,93; 71; 35 | unchanged, violet |
| D floor x 0–0.36, y 0.70–0.74 p50; near meadow y 0.74–0.84 p50; chroma | 66; 55; 35 | 42; 98; 78 | 42; 98; 79 | unchanged |
| P foreground, fan-clear x 0–0.36, y 0.62–0.84: p50/p90; hp | 69/159; 16.1 | 59/93; 15.2 | 60/93; 15.3 | unchanged |
| P upper sky x 0.05–0.95, y 0.06–0.16: chroma; sd; hp | 18; 48; 16.7 | 43; 52; 11.3 | 43; 52; 11.3 | ruled on finish: the gradation's spread matches; its fine cirrus detail is two-thirds |
| P band over the mill x 0.18–0.82, y 0.17–0.33: p50 | 193 | 171 | 155 | more crag in it (o5 / o6) |

## Scores

| Mockup | Score | The three biggest differences (region) |
|---|---|---|
| `round-11-review/mockup-A-spawn-look` (mock-A-spawn-look) | **7.3** (r10 7.3) | 1. **The cluster (x 0–1, y 0.22–0.36) is now one flat tier.** Its caps run level at y 0.265–0.29 across the whole frame, and o5 / o6 fill the gap right of the mill top (x 0.47–0.57). The mockup stacks two tiers (the right crag's top at 0.24, the back-left group's at 0.25, the front-left crag lower at 0.30, keels to 0.39) with lit sky between them. The rock is lighter (bodies 99 / 104 / 87 against the mockup's 126 / 117 / 94; r10 92 / 92 / 82). The caps are still lawns with rows of small cone pines, where the mockup has bushy crowns and long root curtains. 2. **The middle band (y 0.36–0.65).** The cloud wall under the cluster is 3× too hot (17.1 % over 230 against 5.2 %), while the mill, pines and bridge below it stay dim (p50 72 against 87). The mill is a white stone tower. A drift ray now crosses right of the mill (x 0.73, y 0.38), where the mockup has none: minor. 3. **The meadow (x 0–0.6, y 0.62–0.86) is unchanged.** Highlights match (p90 109 against 108), but it is all upright straw. It has none of the three grey boulders at the lower left, and the white daisies are 0.07 % against 0.25 %. The fan is still large and central (x 0.43–0.98) where the mockup's is small at the right edge. |
| `round-18-council-mockups/mockup-B-quest-start-painterly` (mock-B-quest-start) | **7.0** (7.0) | 1. **The sky (y 0.18–0.47).** I score the cluster's finish under the lead's ruling. It is now a continuous flat-capped shelf over the whole mill (x 0–1, y 0.25–0.47), where the mockup has open cumulus. It has the same finish as in A: lawn caps, small pines, thin waterfalls. The upper sky itself is close (chroma 35 against 32). 2. **The keeper (x 0.07–0.27, y 0.45–0.62).** He waves from a bent elbow with his upper arm held level. The mockup's arm hangs by his side with the open palm at head height. His coat is plain beside the mockup's scarf, satchel and layered cloth. 3. **The foreground (x 0–0.45, y 0.58–0.86) is unchanged.** Spread and detail match (sd 32 against 36), the median is 78 against 62, and there are no lit grey stones and no white daisies (0.00 % against 0.38 %). |
| `round-18-council-mockups/mockup-C-hands-fan-painterly` (mock-C-hands-fan) | **6.4** (6.4) | 1. **The fan (x 0.43–0.98, y 0.58–0.86) is unchanged:** the pivot is at the lower left, away from the glove at the right edge. The mockup's pivot is in the glove at the lower right, the leaf sweeps up-left across the centre, and a red tassel hangs from it. 2. **The sky (y 0.05–0.40) is grey-mauve above ~25° elevation:** p50 147–157 and chroma 24–42, against the mockup's warm cumulus at 173–211 and 47–80. This is the band A and C agree on (the lead's sky ruling). The cluster fills the mockup's open sky over the mill, which is ruled, and its flat shelf finish is as in A. 3. **The foreground straw (x 0.05–0.36, y 0.77–0.85) is unchanged:** p50 96 against 66, chroma 78 against 47. There is no rock at the lower left and no flowers. |
| `round-11-review/mockup-D-crown-arena` (mock-D-crown-arena, staged `roc-opening`) | **7.2** (7.0) | 1. **The Roc (x 0.04–0.92, y 0.27–0.38).** Both wings are now level and spread under the bar. The far wing's feather detail matches (hp 11.8 against 11.8; r10 4.4), and its dark bars fell to 22 % (r10 38 %, mockup 6 %). But it is still seen from below and behind, flying away: no head, no beak, two grey lumps for feet, and a strip 0.11 of the frame's height against 0.26. The near wing is dark (p50 101 against the mockup's lit 175). 2. **The light (x 0.05–0.7, y 0.40–0.62).** The puff between the stones is still hot (x 0.3–0.5: 28 % against 7 %), while the new dome roll-off cut the sun's halo below the mockup's (ring 0.07–0.14: 5 % against 31 %). The gap between the stones shows a yellow wash, not the mockup's cloud sea with three small isles. The storm is darker and violet (p50 71 against 87, chroma 35 against 25). 3. **The arena ground (y 0.62–0.86) is unchanged:** the near meadow is straw (98 against 55), the floor behind the dais is dark (42 against 66), and the fan covers the dais from x 0.45. The mockup shows no fan in this view. |
| `round-1-proposals/B-sky-reach` (mock-proposal-B) | **6.0** (5.8) | Scored under the lead's new sky ruling. I scored the orange sky as the first difference in round 10, so +0.2 of this score is the ruling, not the build. 1. **The sky's finish (y 0.05–0.40).** The gradation's spread matches (sd 52 against 48), but its fine cirrus detail is two-thirds of the mockup's (hp 11.3 against 16.7). The cluster now closes into one shelf across the band over the mill (x 0–1, y 0.15–0.35), where the mockup has open haze with single isles either side at mid-height. I treat its presence as the same conflict as B's and C's, since this camera looks the same way as A's. 2. **The ray is not in this frame.** Its new home circle is right of the mill, but at capture time neither the ray nor its wake shows. The two cyan lines at the left edge (x 0–0.2, y 0.36–0.39) were there in round 10 too, so they are not the wake. The mockup's ray and curling wake are the second subject (x 0.42–0.62, y 0.29–0.36). 3. **The destination and foreground are unchanged:** a broad flat shelf with five pines, not the narrow rooted spur, and an unlit field (p90 93 against 159). |

**Seat score, Sky Reach: (7.3 + 7.0 + 6.4 + 7.2 + 6.0) / 5 = 6.78, rounded to 6.8** (round 10, this seat: 6.7).

## The README's claims, checked

| Claim | Verdict | Evidence |
|---|---|---|
| The cluster: five overlapping crags in one band over the mill, o5 and o6 added, lighter, gold rims kept | **verified, but it moves away from A's shape** | The band is continuous, and the rock is +6 to +12 lighter on pure-rock patches. All the caps sit at one height (y 0.265–0.29), which mockup A does not have (finding 2). The rim is still the view fresnel in `skyIsleHd.ts`, not sun-side. |
| The Roc's wings near level (dihedral 0.3 → 0.1 rad), both spread wide under the bar | **verified** | `ROC_DIHEDRAL = 0.1`. The span is x 0.04–0.92, the far wing's hp is 4.4 → 11.8 and its dark bars 38 → 22 %. The take-off direction is unchanged, so the bird still shows its back (finding 1). |
| D's sun glare: the middle band's share over 230 down 9.1 → 6.5 % (mockup 5.0) from a stronger dome roll-off | **the number reproduces; the cause is half right** | 9.2 → 6.4 % full width, 18.5 → 13.1 % fan-free (mockup 10.3 %). The gain came off the sun's halo, which is now under the mockup's (ring 0.07–0.14: 25 → 5 %, mockup 31 %), not off the puff between the stones (x 0.3–0.5: 32 → 28 %, mockup 7 %). `sky.ts`'s darkening is 0.28 → 0.42 over a width of 14 → 18°. |
| Every view's top 1 % is still 236–240 | **verified** | L p99 237–240 in all five views. |
| Proposal B: the free ray circles beside the mill, inside the frame on most laps, with a luminous wake (`rayWake.ts`) | **the code is real, the frame doesn't show it** | `rayWake.ts` is an additive camera-facing ribbon along the ray's recorded path, depth-tested, a plain glow. Neither the ray nor its wake is in `mock-proposal-B`. They show in A (x 0.73, y 0.38), C (x 0.90, y 0.47) and aerial-spawn, a short pale streak behind the ray. |
| The meadow: tighter daisy drifts | **no measurable change in the views** | White specks in the fan-clear meadow: A 0.07 → 0.07 %, B 0.00 → 0.00 % (mockups 0.25 / 0.38 %). |
| The walk baseline is 0 stuck and the tests are green | not re-run (evidence seat) | — |

## Ledger 5

- **Cameras:** the cameras blob is identical (f3e3cb06…), every `camAt` is identical to round 10's, and the HUD is the baseline
  touch HUD at 780×1688. 0 page errors; programs 100 → 101 (the wake's material).
- **Staging:** unchanged (`roc-opening`, `quest-crown`). My round-10 acceptance of the 4 s take-off stands.
- **The capture tool changed** between the captures (cde7f9ff4, `scripts/shard-progress.mjs`: an automatic QA check that re-takes a
  frame showing no 3D world, with a longer settle). The README's commit list covers only shard commits, so it does not name
  this. Here `qa.retaken` is empty and every shot is `world`, so no frame was re-taken. It is benign this round. But a
  re-take changes a shot's settle, and a staged Roc frame depends on its settle: list it if it ever fires on a `mock-*`.
- **No narrowing:** the global changes (dome roll-off, crags, dihedral, ray home) show the same way in h4, the aerials and
  the clip. The clip is a real 3D orbit with the ray and the cluster in it. No breach found.

## Findings, ranked by score gained

1. **Repeated: the Roc flies away from D's camera** (D x 0.04–0.92, y 0.27–0.38).
   - **Evidence:** the level wings landed (the far wing's detail matches the mockup now), but the take-off still steers to
     the lap point due north of the perch. At the capture the bird shows its belly and back: no head, no beak, the
     talons as two lumps, a strip 0.11 of the frame's height against 0.26. h4 (`quest-crown`) shows the same model from
     the front with its head, so the model can carry the shot.
   - **Fix:** the one from round 10. Start the lap on the arena's south side, or take off toward the entrance and bank into
     the lap after it. Every fight does this, so it is real play. Lower the talons during the rise, and darken the far
     wing's banding toward the mockup's (dark bars 22 % against 6 %).
2. **New: the cluster is one flat tier** (A x 0–1, y 0.22–0.36; the same crags in B, C and P).
   - **Evidence:** every cap sits at y 0.265–0.29 and the keels at 0.33–0.36. Mockup A stacks two tiers: the right crag
     high (top 0.24), the back-left group (0.25), and the front-left crag clearly lower (top 0.30, keel 0.39), with lit
     sky between the right crag and the rest (x 0.47–0.57). o5 / o6 closed that gap. The caps are lawns with a row of small
     cone pines. The sunward crags are still darker and greyer than the mockup's (99 / 104 against 126 / 117; chroma
     52 / 61 against 64 / 79).
   - **Fix:** keep the overlap, but vary the heights. Drop the front-left crag about a cap's depth below the back group,
     raise the right one, and open the gap right of the mill top again. Give the caps bushy, rounded tree crowns and
     overhanging turf, and hang longer, denser root curtains. Make the rim depend on the sun's direction (`dot(N, sunDir)`
     with a back-light wrap) instead of `N·V`. Check A, B, C, P and aerial-spawn together.
3. **Partly a regression: D's glare fix hit the halo, not the puff** (D x 0.05–0.7, y 0.40–0.62; h4 the same).
   - **Evidence:** the halo ring round the sun went from 25 % to 5 % over 230 (mockup 31 %), and the sun patch from 40 % to 23 %
     (mockup 37 %). Between the stones (x 0.3–0.5, y 0.50–0.60) the hot puff barely moved, 32 % to 28 % against 7 %. The
     band's average fell because the halo went, while the wrong thing (a lit cloud-bank puff under the sun) stayed.
   - **Fix:** take the dome roll-off back toward its round-10 strength, since the mockup's sun has a wide bright halo.
     Then treat the bank: keep its puffs out of a cone of ~8–10° under the sun from the crown, or cap their sun-facing lit
     term, and put a dimmer cloud sea and the mockup's small isles in the gap between the stones. Measure the halo ring and
     the stones' patch separately.
4. **Repeated, now measured by elevation: the sky above ~20° is too dark and grey** (A y 0.10–0.25; C y 0.05–0.30).
   - **Evidence:** at 17–27° elevation A's sky is 153–182 against 172–204 (chroma 42–60 against 47–85). At 23–33° C's
     is 147–157 against 173–211 (chroma 24–42 against 47–80). A and C are the mockups the sky follows (the lead's ruling),
     and both show bright warm cumulus up to ~30°. The game's warmth fades out by ~25°.
   - **Fix:** in `sky.ts` the warm mix runs over 16–34° at up to 0.5, so most of that band gets well under half the
     shift. Raise the mix toward full strength across ~18–32° and lift the cloud layer's lit coverage there. Check A's
     17–20° band, which is already close, so it doesn't overshoot.
5. **Repeated: the band under the cluster is too hot and the subjects under it too dim** (A y 0.36–0.65; B y 0.36–0.46).
   - **Evidence:** A's band under the cluster is 17.1 % over 230 against 5.2 % (p50 204 against 175), while the mill /
     pines / bridge band is 72 against 87. B's is 13.6 % against 9.0 %.
   - **Fix:** dim the cloud wall behind the mill (the lit far bank, not the dome) and lift the near subjects' fill.
6. **Repeated, unchanged: the meadow in C and D, and the missing stones and daisies** (C x 0.05–0.36, y 0.77–0.85: 96
   against 66; D x 0–0.36, y 0.74–0.84: 98 against 55; white daisies A 0.07 % and B 0.00 % against 0.25 % and 0.38 %).
   - **Fix:** the round-10 one: cap the backlit `back * up³` glow on near blades lit from behind, and keep the front-lit
     term. Add low lit stones that stand above the grass, with white daisy clumps that read at this distance (the yellow
     specks don't count as the mockups' white flowers). Place them for real and walk-check them.
7. **Repeated: the fan's hold** (C x 0.43–0.98, y 0.58–0.86; it also covers D's dais from x 0.45). Unchanged this round.
   - **Fix:** put the pivot in the glove at the lower right with the leaf sweeping up-left, hang the tassel from the pivot,
     and at that angle shrink the fan toward A's, B's and P's.
8. **New: proposal B's ray isn't in its frame** (P x 0.42–0.62, y 0.29–0.36).
   - **Evidence:** the ray's new home circle is right of the mill, but the capture shows neither the ray nor its wake. The
     two cyan lines at the left edge were there in round 10. The ray shows in A, C and aerial-spawn instead.
   - **Fix:** don't time the capture. Make the lap keep the ray in front of the cluster band at the height of the mill's
     sails, where the mockup puts it, so a frame taken at any moment of the lap is likely to hold it. Check it on
     a sweep of the clip, not on one frame.
9. **Repeated: D's floor and storm, the keeper and the mill.** The floor is 42 against 66, and the storm violet (chroma 35
   against 25). The keeper's upper arm should hang by his side, with the open palm at head height. The mill is a white tower.

SCORE sky-reach: 6.8
