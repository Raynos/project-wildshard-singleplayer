# Round 7, seat B, Sky Reach (Claude, lens: evidence, region by region)

Surface:
- The Sky Reach section of `art/mockup-council/round-7/README.md`, including the lead's ruling on proposal B's camera.
- The five sheets `art/mockup-council/round-7/far-reach-*.jpg`.
- The full-res frames in `progress/far-reach/20261003-0250-1c2c026e/`: every `mock-*`, h1–h4, both aerials, `clip.mp4` at 0.5 fps, and `meta.json` `camAt`.
- Round 6's capture `progress/far-reach/20261003-0201-fc54d9df/` for before and after.
- The five ledger mockups at full resolution.

Method:
- Each mockup is resized to 780×1688. The same region is cut from the mockup, round 6 and round 7.
- On each patch I measured:
  - mean and median RGB, and mean chroma (max−min);
  - Rec. 709 luminance p10 / p50 / p90 / p99, its standard deviation, and the share above 230;
  - fine detail "hp": the standard deviation of luminance minus its own 3 px Gaussian blur;
  - the sun's position (the brightest 12 px-blurred point) and a radial luminance profile round it.
- I re-ran the builder's `art/far-reach/round-22-council-tools/measure.py` on both captures.
- Source checked at `1c2c026e` against `fc54d9df`:
  - `layout.ts`, `world/skyIsles.ts`, `world/meadow.ts`, `world/dressing.ts`, `world/build.ts`, `world/isle.ts`;
  - `look/sunGlow.ts`, `look/sky.ts`, `manifest.ts`, `plugin.ts`, `weapons/fanModel.ts`;
  - `species/stormRoc.ts`, `quest/keeper.ts`, and `Animal.fly` / `setMotion` in the engine.
- Regions are fractions of the game frame (x left→right, y top→bottom, HUD included).
- Marks per dimension: composition and subject (Comp), forms and silhouettes (Form), materials and detail (Mat), light
  and colour (Light), density and depth (Depth), and hands / weapon / HUD (Hands).

## Measured (mockup / round 6 / round 7)

| Patch | Mockup | Round 6 | Round 7 | Reading |
|---|---|---|---|---|
| Builder's tool: play rows, L p99; share > 230 (A / B / C / D / proposal B) | 238 / 240 / 236 / 241 / 239; 2.1 / 2.2 / 1.9 / 2.8 / 3.8 % | 239 / 238 / 239 / 243 / 242; 2.8 / 2.4 / 2.6 / 4.8 / 3.9 % | 239 / 238 / 239 / 241 / 242; **2.9 / 2.8 / 2.9 / 4.4 / 4.5 %** | p99 matches. The share is over the mockup in every view: C 1.5×, D 1.6× |
| A subject band y 0.45–0.65, L p50 | 87 | 56 | **74** | +18, toward the mockup (gamma 1.15) |
| A under the bridge x 0.25–0.75, y 0.53–0.6, L p50 | 108 | 63 | **80** | +17, still 28 short |
| A meadow x 0–0.6, y 0.66–0.84: mean; L sd; hp; L p90 | 91,73,37; 34.1; 22.5; 121 | 80,66,18; 27.9; 12.7; 93 | 81,74,25; **17.2; 8.5; 87** | the colour is closer; **the texture fell by a third** (finding 1) |
| B lower left x 0–0.3, y 0.66–0.85: mean; chroma; hp | 84,71,44; 41; 21.6 | 100,81,21; 79; 13.1 | 74,69,24; **50**; 9.5 | the colour is much closer; the detail fell |
| B rock (mockup x 0.12–0.32, y 0.675–0.705; game x 0.03–0.2, y 0.705–0.73): L p50 / p90; hp | 98 / 161; 25.3 | (no rock) | 71 / 90; **5.3** (its side: hp 0.9) | a flat-shaded green slab, not rough grey rock |
| C foreground x 0.05–0.65, y 0.77–0.85: mean; L p50; hp; chroma | 89,74,41; 66; 22.5; 49 | 73,62,22; 54; 12.7; 51 | 100,95,27; **89; 17.0**; 73 | the bald slab is gone; it is now brighter and limier than the mockup |
| C upper sky y 0.05–0.25: chroma; L p50 | 47; 169 | 32; 115 | 31; 130 | still cool lavender |
| D storm y 0.05–0.25, L p50 / p90 | 80 / 140 | 42 / 101 | **70 / 133** | much closer |
| D band y 0.45–0.65, share > 230; between the stones x 0.3–0.9, y 0.5–0.6 | 5.2 %; 3.3 % | 15.1 %; 16.0 % | **13.6 %; 12.6 %** | the halo still washes the gap between the stones |
| D floor x 0–0.45, y 0.70–0.74, L p50 | 73 | 48 | 50 | still dark tufts |
| Proposal B sky, chroma y 0.05–0.25 / 0.25–0.45 | 20 / 56 | 59 / 81 | **72** / 82 | **moved further from the mockup** |
| Fan silk (pixels with b > r+15, g > r+5): median; share of frame (C) | C 53,88,91; 5.2 % | 2,47,44; 2.4 % | **52,86,90**; 2.7 % | the colour now matches (A and proposal B too); the leaf is half the mockup's area |
| Roc wing mid-tones (L 60–90) in D: mean; chroma | 96,72,76; 31 | 133,64,40; 93 | **129,59,39; 91** | **unchanged: rust-brown, not slate** |
| Sun radial profile, L at r 0–3 / 15–18 / 32–45 / 70–110 px (A; D) | 254/250/228/171; 254/251/239/212 | 249/235/214/198; 250/246/245/223 | 253/248/218/200; 253/250/239/224 | **one solid hot disc**, falling off monotonically. D's outer halo (70–110 px) is still 12 above the mockup's |
| Sun (x, y): A / B / C / D / proposal B | (0.34,0.35) / (1.0,0.42) / (0.05,0.34) / (0.23,0.46) / (0.24,0.40) | (0.28,0.38) / (0.39,0.39) / (0.42,0.46) / (0.26,0.47) / (0.32,0.32) | (0.28,0.38) / (0.40,0.39) / (0.43,0.46) / (0.29,0.45) / (0.28,0.30) | unchanged; B and C are still far from their mockups' edges |

## Scores

| Mockup | Score | Comp / Form / Mat / Light / Depth / Hands | The three biggest differences (region) |
|---|---|---|---|
| `round-11-review/mockup-A-spawn-look` (mock-A-spawn-look) | **6.5** | 6 / 7 / 6 / 7 / 6 / 7 | 1. **The isle cluster over the mill is gone (x 0.1–0.9, y 0.17–0.42).** The three overhead isles moved to the far horizon (`skyIsles.ts` o1–o3, commit 34bcb808d). This is mockup A's signature: a backlit cluster with hanging roots over the mill, the sun under it. The game now shows open cumulus there, with one isle at each edge. It is a real, global trade that helps B, C and proposal B, but it moves A away. 2. **The meadow (x 0–0.6, y 0.64–0.86) is mown.** It is a smooth olive lawn (sd 17 vs 34, hp 8.5 vs 22.5, round 6 12.7), with white daisies on bare stalks and no rocks; the mockup has three rocks at the lower left. Cause: the keeper's short-grass disc (finding 1). 3. **The light and the bridge (x 0.15–0.9, y 0.35–0.68).** Gains: the sun is one hot disc left of the mill, the band's p50 rose from 56 to 74 (mockup 87), and under the bridge from 63 to 80 (108), with cloud showing beside the narrower keel. But the netted sides read as a dense fence of vertical ties, where the mockup's hand ropes are open over air. The fan's silk colour matches now. |
| `round-18-council-mockups/mockup-B-quest-start-painterly` (mock-B-quest-start) | **6.5** | 7 / 6 / 6 / 6 / 6 / 7 | 1. **The sky over the mill (x 0.3–1, y 0.15–0.45)** is now open gold cumulus, as the mockup has it: the biggest gain. The step and its house are out of frame, but the moved step's hanging (fallen) bridge, netted, now reads as a dark ladder at the left edge (x 0–0.1, y 0.42–0.6) behind the keeper's arm. Sky isle l4 stays at the top left (x 0–0.2, y 0.3–0.38). The sun is still at x 0.40; the mockup's is at the right edge. 2. **The keeper's set (x 0.05–0.45, y 0.43–0.62)** is better. His boots and stand show in short grass, and the lantern hangs at the stand's side. But the book is a thin pale edge on a dark box, not the mockup's open pages, and the pose is still stiff. The mill is still a big white stone tower, against the mockup's small dark timber post-mill. 3. **The foreground (x 0–0.6, y 0.6–0.86).** The sward is greener and calmer (chroma 50 vs 41; round 6 79). The new rocks at the lower left are flat-shaded, moss-green slabs with a mauve side (hp 5.3 vs 25.3; L p90 90 vs 161); the mockup's are rough grey lichened rock. |
| `round-18-council-mockups/mockup-C-hands-fan-painterly` (mock-C-hands-fan) | **6.0** | 6 / 6 / 6 / 5 / 6 / 6 | 1. **The sky and the sun (y 0.05–0.5).** The overhead isles are gone, which leaves open cumulus with one isle at the left (a gain toward the mockup's two small edge isles). But the upper sky is still cool lavender (chroma 31 vs 47, p50 130 vs 169). The sun is at x 0.43 behind the mill; the mockup's light floods in from the left edge (x 0.05). 2. **The foreground (x 0–1, y 0.74–0.86).** The bald dark slab is gone; the 12-gon meadow edge fills it with a full verge (p50 89, hp 17 vs 22.5). It is a lime yellow-green carpet (100,95,27, chroma 73 vs 49), brighter than the mockup's 66, with no rock at the lower left. 3. **The fan and the bridge (x 0.1–1, y 0.5–0.8).** The silk is the mockup's teal now (52,86,90 vs 53,88,91), with an iron strap and caps. But the leaf covers 2.7 % of the frame against 5.2 %, held at the right where the mockup's sweeps diagonally across the centre. The bridge's sides are a dense tie fence; the mill is white stone, not dark timber. |
| `round-11-review/mockup-D-crown-arena` (mock-D-crown-arena, staged `roc-stalk`) | **6.5** | 7 / 6 / 5 / 7 / 6 / 6 | 1. **The Roc (x 0–0.75, y 0.2–0.36)** is unchanged in the pixels. It is still a frontal V glide (span about 0.70 of the width vs 0.96), its head toward the camera, with no bank and no forward talons. Its wings are still rust-brown (mid-tones 129,59,39, chroma 91; the mockup's slate is 96,72,76, chroma 31). The new stalk heading does not show. 2. **The light (y 0.05–0.62).** The storm is lifted and its eye now turns above the bar (y 0.05–0.25 p50 70 vs 80; round 6 42), and the sun is one disc: both real gains. But the halo still makes 13.6 % of the middle band and 12.6 % of the gap between the stones over 230 (mockup 5.2 % and 3.3 %), so the gap is a yellow wash with one hazy isle, not the mockup's cloud sea, isles and pines. 3. **The arena and the meadow (y 0.55–0.86).** The grass is back to full height and the dais still reads. The band at y 0.70–0.74 is still dark tufts (p50 50 vs 73). No rock shows: the three added rocks sit under the fan and the bottom HUD panel (finding 5), where the mockup has five down to the bottom edge. The stones are smooth slabs with cyan spirals. |
| `round-1-proposals/B-sky-reach` (mock-proposal-B) | **6.0** | 5 / 6 / 5 / 5 / 6 / 6 | Scored on what the fixed camera can match (the lead's ruling). 1. **The sky (y 0.05–0.5).** The overhead isles are gone, so the windmill isle stands in open sky with small isles at the edges, as the mockup's does (a gain). The sun is one disc at (0.28, 0.30) (mockup (0.24, 0.40)). But the sky is more saturated than in round 6 (upper chroma 72 vs the mockup's 20; round 6 59): orange where the mockup is pale and nearly grey. 2. **The destination (x 0.1–0.9, y 0.25–0.55)** is still a wide flat green shelf with four pines and a stone mill (about x 0.14–0.86 on the sheet). The mockup has a narrow rooted spur (x 0.2–0.65) with hanging roots, and the manta gliding beside the mill. 3. **The foreground (x 0–1, y 0.55–0.86).** A flat lawn (L p90 94 vs 123, hp 11.4 vs 16.4), with the keeper, his stand and his "KEEPER 17 M" tag on the axis. The mockup has a lit grass crest with daisies and a rock at the lower left. |

**Seat score, Sky Reach: (6.5 + 6.5 + 6.0 + 6.5 + 6.0) / 5 = 6.3** (round 6, this seat: 6.1).

## The builder's claims, checked against the frames and the code

| Claim | Verdict | Evidence |
|---|---|---|
| Top 1 % at 238–242; 2.8–4.5 % above 230 | **verified** | The builder's own tool gives p99 238.4–241.8 and 2.8–4.5 %. The mockups are at 1.9–3.8 %, so every view is now over its mockup, D by 1.6× (its halo). |
| A subject 84 → 99, under the bridge 72 → 88 (gamma 1.15) | **direction and size verified; the numbers are not reproducible** | On round 6 seat B's patches: band p50 56 → 74 (mockup 87), under the bridge 63 → 80 (mockup 108). The +18 / +17 matches the builder's +15 / +16. The builder's absolutes (and "mockup 130 and 111" in 34bcb808d) come from a patch that isn't named; quote it. The gamma is global (`manifest.ts`; h4 p50 59 → 78). |
| One hot sun disc in a gold-orange bloom; the dome samples by view direction | **verified** | `sky.ts` now samples `w.xyz - cameraPosition`. The radial profile is 253 at the core, flat to r ≈ 18 px, then falls off with no darker ring. In D the second offset glow is gone: one blob at (0.29, 0.45). D's outer halo is still wider than the mockup's (r 70–110 px: 224 vs 212). |
| The near-ground darkening is gone | **verified in code; partly in pixels** | The camera-distance multiply is deleted from `isle.ts`. C's foreground went from p50 54 to 89. D's mid floor (y 0.70–0.74) stays at 50 vs 73: those are the dark tuft roots, not the multiply. |
| The sward finer and greener; fewer, smaller flowers | **colour verified; "finer" not on screen** | Closer colour: B's chroma 79 → 50 (mockup 41); A's blue 18 → 25 (29). But fine detail at the 780 px frame fell: A's meadow hp 12.7 → 8.5 and B's lower left 13.1 → 9.5 (mockups 22.5 and 21.6). The twice-texel atlas doesn't read at phone size, and A's foreground is mown (finding 1). There are fewer flowers, and the yellow heads are mostly gone. |
| The windmill isle on a narrower keel; rope bridges netted, thinner planks | **verified, with a side effect** | Under A's bridge it is brighter (p50 63 → 80), with cloud beside the keel. The ties every 1.25 m read as a near-solid fence along both sides in A and C (finding 6). |
| The Roc slate and white | **not verified** | D's wing mid-tones: round 6 133,64,40, round 7 129,59,39, the mockup 96,72,76. Its darks are 72,39,18. The `far.roc-slate` patch in `plugin.ts` changes nothing visible (finding 3). |
| The storm eye higher | **verified** | The swirl now sits above the bar; y 0.05–0.25 p50 42 → 70 (mockup 80). |
| B and D have lichened rocks | **B: rocks yes, lichen no. D: not in the frame** | B: two flat-shaded slabs at the lower left (hp 5.3 / 0.9 vs 25.3). D: by `dressing.ts` HERO_STONES and D's camAt, the rocks at (−1.6, −182.2), (−2.7, −183.6) and (1.9, −184.2) project to about y 0.80–0.93. That puts them under the fan and the bottom HUD panel. None is visible in the frame. |
| The step at (−64, −126), out of B's view | **verified, with a side effect** | By layout, the step's near edge is at 22.3° left of B's axis, and the frame's edge is at 22.6°. The house is gone from the frame. Its fallen bridge, hanging from the step's north rim (by layout at about 19° left of B's axis), now crosses B's left edge as a dark netted ladder (x 0–0.1, y 0.42–0.6). |
| Not in the README's claims | **name them** | 1. The overhead isles o1–o3 moved to the far horizon (34bcb808d): the biggest change in A, B, C and proposal B. 2. The keeper's 3.2 m short-grass disc (8109cb927). 3. The fan's silk regrade and iron straps (f67d31051), verified: the silk now matches. |

## Staging, cameras and the no-shortcut rules (ledger 5)

- **Cameras.**
  - The only `mock-*` change is D's settle (150 → 60 ms), as listed.
  - camAt matches round 6 except D's eye, 4 cm higher.
  - h3 turned (a hero view, named in cameras.json's `$doc`).
- **The isle and step moves are global layout.**
  - o1–o3 and l2 moved in `skyIsles.ts`, and STEP in `layout.ts`. The clip and the aerials show them as real geometry on the horizon.
  - Nothing is hidden per view, and the archipelago is intact in `clip.mp4`. No breach.
  - Moving the cluster out of every view costs mockup A for the other three. It is a trade the lead should own, not a shortcut.
- **The light, the grade and the crown's grass are global.** The gamma moved the hero views too (h4 p50 59 → 78), and the
  crown's sward is 0.85 for the whole isle. No narrowing; 0 page errors.
- **`roc-stalk` (changed this round): should-fix, not void.** Measured from the code:
  - The stage puts the Roc at (−3, −208.65). That is on its 13 m circle (verified: 13.0 m from `ROC`).
  - It turns the Roc toward (−14, −170), a heading of −15.9°. The camera, where the player stands, is at (0, −176), a bearing of +5.2°.
  - In play, the phase-0 stalk steers at `yawTo(player)` every tick with turn rate 3 rad/s (`stormRoc.ts`; `Animal.setMotion`).
  - A Roc that has just left the circle at that spot is heading about +103° (the circle's tangent; the angle increases).
    It turns from +103° toward +5°, so it never passes −16°.
  - That heading belongs to a player standing about 14 m west (at the crown bridge's landing), not to the player whose
    camera this is.
  - Nothing in the engine rolls a flier (no bank term in `Animal.fly` / `setMotion`), so the change can only yaw the
    bird. In 60 ms it turns back at most 10°.
  - It is not void, because it gained nothing: the frame's Roc is frontal and almost identical to round 6's (wing pixels
    and span unchanged).
  - The honest version: a real, held state at that spot is the **circle** lap itself. It runs at the same altitude, under
    the bar, for seconds per lap, and crosses the view side-on. Stage `circle` (or no stage, with an active fight and a
    timed settle), or put the stalk's face point at the player.
  - The 60 ms settle again picks the instant before the stalk's climb (2.3 m at 9 m/s) carries the Roc into the bar. The
    builder's note says so.
- **h4 / QUEST COMPLETE, the phone tier, the baseline HUD:** unchanged from round 6, allowed.
- **Repeat (round 6 X1, still open):** in `aerial-spawn`, Sunrest's rise still reads as a smooth dark dome with few blades.

## Findings, ranked by score gained

1. **New: A's foreground is mown by the keeper's short-grass disc** (A x 0–0.6, y 0.64–0.86).
   - **Evidence:** `meadowHoles()` adds a 3.2 m short-grass disc at `KEEPER_AT` (−2.4, −13.6). A's camera at (0, −10), eye 1.7 m, pitch −3.4°, sees the ground 3.3–5.2 m ahead in its lower half. That ground is 1.8–2.4 m from the keeper, inside the disc. So the meadow in A's lower half is short grass: hp 12.7 → 8.5 and sd 27.9 → 17.2, against the mockup's 22.5 and 34.1. B (camera 5 m further back) keeps its tall sward.
   - **Fix:** cut the disc to the keeper's boots and the stand (about 1.2 m), or make it an ellipse behind him, away from the spawn axis. Then re-measure A's meadow patch.
   - Add the mockup's three rocks at A's lower left (x 0–0.35, y 0.7–0.85), rough grey stone (see 4).
2. **Repeated: the sun's halo and the sky saturation** (D y 0.45–0.65; proposal B and C y 0.05–0.45).
   - **Evidence:** the disc is fixed. Still open:
     - D: 13.6 % of the middle band and 12.6 % of the gap between the stones over 230 (mockup 5.2 / 3.3 %).
     - Proposal B: the upper sky's chroma rose to 72 against 20.
     - C: the upper sky is still cool (chroma 31 vs 47).
   - **Fix:**
     - Shrink the `sunGlow` wide gold and the painted bloom's radius, not their peak, until D's band share approaches 5 %.
     - Desaturate the high sky toward pale gold-grey on the sun's side and warm C's zenith. One sky serves all five, so
       check all five with the same patches.
3. **Repeated: the Roc** (D x 0–0.75, y 0.2–0.36).
   - **Evidence:** the slate patch has no visible effect. Wing mid-tones are 129,59,39, unchanged from round 6; the mockup's are 96,72,76.
   - **Fix:**
     - Check that the Roc's rendered material compiles `far.roc-slate`: does it contain `#include <map_fragment>`, and does the program key change? Then measure the wing again.
     - Give the species a bank: roll the body by the yaw rate in `animate`, so any turning Roc banks in play.
     - Raise the span toward the mockup's (about 0.96 of the frame from this eye) with the talons forward.
     - Then stage the circle state (above), not a stalk aimed off the player.
4. **New: B's rocks are flat-shaded moss slabs** (B x 0–0.3, y 0.68–0.86).
   - **Evidence:** hp 5.3 on the top and 0.9 on the side, against the mockup rock's 25.3; L p90 90 vs 161.
   - **Fix:** rough grey stone with lichen patches and a lit top edge, as the mockup shows. Use the textured boulder or a
     noise-displaced, non-flat-shaded mesh, not a green-topped faceted lump. The same applies to A's and D's rocks.
5. **New: D's added rocks are out of the frame** (D lower left).
   - **Evidence:** the three rocks project under the fan and the bottom HUD (y 0.80–0.93).
   - **Fix:** mockup D's rocks are at x 0–0.3, y 0.62–0.82, and at the right edge. In world terms that is about 9–15 m
     ahead of the rise and 2–5 m left of the walk, in the real arena. Check that no walk crosses them.
6. **New: the netted bridges read as fences and ladders** (A and C, the deck's sides, x 0.25–0.75, y 0.5–0.65; B x 0–0.1, y 0.42–0.6).
   - **Evidence:** the ties every 1.25 m close in the sides that the mockups keep open: a single hand rope and a mid rope over air.
   - **Fix:** fewer, thinner and lighter ties, so the sky and cloud read through the sides. The fallen bridge at B's left
     edge then fades into the haze instead of drawing a dark ladder.
7. **Repeated: the meadow's detail at phone size** (all five; y 0.6–0.86).
   - **Evidence:** the colour moved toward the mockups (B chroma 50 vs 41). Fine detail fell (B lower left hp 9.5 vs 21.6; proposal B 11.4 vs 16.4). C's new verge is lime (chroma 73 vs 49) and brighter than the mockup (p50 89 vs 66).
   - **Fix:** raise the strand contrast at the frame's scale (dark gaps between lit blades), pull C's verge toward olive-gold, and set the daisies into the grass rather than on bare stalks above a lawn.
8. **Repeated: the subjects' forms** (B and C, the mill, x 0.4–0.9, y 0.3–0.55; proposal B, the destination isle, x 0.1–0.9, y 0.25–0.55; C, the fan, x 0.2–1, y 0.48–0.82). Still open:
   - the white stone tower mill against the mockups' dark timber;
   - proposal B's wide flat shelf against a narrow rooted spur, and its manta;
   - C's fan leaf at half the mockup's area;
   - B's book as a sliver, where the mockup shows open pages.
9. **Trade to rule on: A's isle cluster.**
   - Moving the overhead isles to the horizon helps B, C and proposal B and costs A its signature (the backlit cluster over the mill). No single sky can show both.
   - The lead or Jake should decide which mockups that sky serves, and name it in the next README, instead of the builder deciding it silently in a commit.

SCORE sky-reach: 6.3
