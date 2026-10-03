# Round 13, seat C, Sky Reach (Claude, lens: red team)

2026-10-03. The bar is 7.0 (ledger 4 as Jake amended it). The bar doesn't change how I score.

Surface:
- The Sky Reach section of `art/mockup-council/round-13/README.md` and the five sheets.
- `progress/far-reach/20261003-0719-8512344b/`: all 12 frames, `clip.mp4` (1 fps tiles) and `meta.json`.
- Round 12's capture `20261003-0608-591bd5b5`: every frame side by side, and a band-by-band pixel diff.
- The five ledger mockups at full resolution, and `docs/plans/SKY-REACH-TOP10.md`.
- `git show` of the nine shard commits between the captures. I read:
  - the LUT path: `look/render.ts`, `src/engine/world/lut.ts`, `Game.ts`'s chain, `scripts/fit-lut.py`, `art/far-reach/round-29-lut/`, `scripts/serve-build.sh` and `vite/gen.ts`;
  - the placement: `world/skyIsles.ts` (073a0e7ed) and `world/dressing.ts` / `world/meadow.ts` (e0e4b837c);
  - the Roc: `species/stormRoc.ts`, with `layout.ts` for CROWN, DAIS and ROC.
- I loaded `public/assets/lut/far-reach.bin` myself and applied it to the frames (trilinear, display sRGB in and out, as `lut.ts` documents).

Method:
- Every image is resized to 780×1688 (Lanczos).
- Brightness is Rec. 709 luminance (L). "hot" is the share of L > 230. "hp" is the standard deviation of L minus its 3 px Gaussian blur.
- "white" is the share with L > 170 and chroma < 60.
- Regions are frame fractions (x left→right, y top→bottom).
- Foreground crops stop at x ≤ 0.36, clear of the fan.
- Cells read mockup / round 12 / round 13.
- The lead's rulings apply:
  - the cluster over the mill is scored on its finish in B, C and P;
  - proposal B's sky is scored on finish, not saturation.

## What changed since round 12

- **Meta:** the SHA and the label changed, and `programs` went 101 → 102. The cameras blob `f3e3cb06…` and every `camAt`
  are identical. Staging is unchanged (`roc-opening` on D, `quest-crown` on h4). `retaken` is empty, every shot is
  `world`, and there are no page errors.
- **The pixels:** 28–49 % of every frame changed by more than 12 levels. The changes are the isles, the trees, the
  meadow, the fan, D's Roc, stones and ground, and the playable islands' keels (aerials and clip).
- **The sky above y ≈ 0.20 is pixel-identical in every view.** The mean RGB difference is 0.00 and the mean |d| is
  0.13–0.15, which is JPEG noise. That also holds for the aerials' top quarter, h2's sky and the unchanged sails. This
  matters for the LUT (ledger 5, below).

## Measured (mockup / round 12 / round 13)

| Patch | Mockup | R12 | R13 | Reading |
|---|---|---|---|---|
| A near ground x .03–.32, y .68–.82: p50; p90; sd; hp; white | 59; 100; 29.7; 19.8; 0.2 % | 61; 90; 22.1; 15.3; 0.2 % | **53; 106; 32.9; 21.5; 0.6 %** | the spread and detail now match; the median is a little dark |
| A near ground: chroma; Lab hue | 38; 84° | 53; 91° | 45; 92° | still yellower than the mockup: hay, not green-gold |
| A nearest band x 0–.36, y .76–.84: p50 | 56 | 57 | **46** | darker (the new camera-distance ground shade, see ledger 5) |
| A mid meadow x 0–.45, y .58–.68: p50; p90 | 88; 162 | 65; 138 | **58; 127** | further away: the smooth dark turf left of the bridge |
| A cluster band y .22–.36: p50; chroma | 174; 80 | 155; 68 | 157; 74 | about the same value; warmer |
| A band under the cluster y .36–.46: hot | 5.2 % | 14.1 % | **15.6 %** | still 3× |
| A behind the posts x .30–.70, y .47–.60: p50; hue | 98; 55° | 72; 73° | 82; 75° | the keel blob (finding 2): green where the mockup is warm cloud and cliff |
| B near ground: p50; p90; sd; hp | 65; 124; 34.8; 22.1 | 65; 101; 24.0; 16.0 | **61; 122; 32.4; 24.2** | matches |
| C verge x .05–.36, y .77–.85: p50; p90; sd | 66; 131; 39.2 | 78; 115; 24.3 | **74; 131; 33.2** | closer |
| C upper sky x .05–.38, y .10–.25: p50; chroma | 205; 70 | 152; 35 | 152; 35 | unchanged (pixel-identical) |
| C top band x .20–.60, y .04–.09: sd | 10.9 | 3.1 | 3.1 | unchanged |
| D near ground x 0–.36, y .74–.84: p50; chroma | 55; 35 | 84; 67 | **58; 42** | fixed |
| D floor behind the dais x 0–.36, y .70–.74: p50 | 66 | 42 | **69** | fixed |
| D sun patch x .05–.45, y .44–.50: hot | 36.8 % | 23.0 % | **3.2 %** | the sun is gone behind the Roc |
| D sun disc, left half y .40–.52: share L > 245 | 7.0 % | 3.2 % | **0.09 %** | the same |
| D between the stones x .30–.50, y .50–.60: chroma; white | 71; 8.0 % | 104; 0.4 % | 109; 0.4 % | unchanged orange haze |
| D storm x .05–.65, y .09–.25: p50; chroma | 87; 25 | 71; 35 | 70; 35 | unchanged, violet |
| D stones band y .53–.62: p50; hp | 128; 24.4 | 99; 15.4 | 120; 15.0 | brighter; the carving doesn't add fine detail |
| D whole play y .05–.85: hot | 2.9 % | 1.1 % | **0.4 %** | dimmer still |
| P crest x 0–.36, y .62–.84: p50; p90; sd; white | 69; 159; 46.4; 4.7 % | 52; 80; 19.3; 0 | **53; 108; 29.9; 0** | the spread is better; still dark, no daisies |
| P under the mill deck x .55–.90, y .40–.50: p50; hue | 180; 56° | 107; 76° | 104; 82° | the bun-shaped keel (finding 2) |
| Fan, teal pixels as a share of the frame (A / C / D) | 0.9 / 3.6 / 0 % | 2.3 / 2.3 / 2.4 % | 1.8 / 1.7 / 1.8 % | 23 % smaller; still 2× A's, half of C's, and present in D, where the mockup has none |
| Sky isles' green share, aerial-spawn y .10–.30 | — | 5.2 % | 3.1 % | **less green**, against "canopies lush green" |

## Scores

| Mockup → view | Score | The three biggest differences (region) |
|---|---|---|
| `round-11-review/mockup-A-spawn-look` → `mock-A-spawn-look` | **7.1** (r12 7.0) | 1. **The cluster (x 0–1, y 0.17–0.40) is organic now**, at staggered heights with sky between them: a real gain. But the masses are smooth olive-grey domes with even, uniform moss drapes and one or two trees on their bald tops. The mockup's crags have lit gold rock faces, bushy crowns along every rim and long root curtains (band chroma 74 against 80; under it 15.6 % hot against 5.2 %). 2. **Behind the bridge (x 0.30–0.70, y 0.47–0.60)** the mockup shows warm open cloud and the cliffs dropping away. The game now shows a wall of faceted green lumps: the mill isle's new Hunyuan keel, wider than its deck (finding 2). 3. **The meadow (x 0–0.45, y 0.55–0.84)** matches the mockup's spread and grain (p90 106 against 100, hp 21.5 against 19.8), with daisies. But it reads as khaki hay (hue 92° against 84°). The nearest rows are too dark (46 against 56), there's a smooth dark turf patch left of the bridge (x 0–0.25, y 0.55–0.62), and none of the three big grey boulders. The fan is smaller, with a red tassel, but still twice the mockup's teal area. |
| `round-18-council-mockups/mockup-B-quest-start-painterly` → `mock-B-quest-start` | **6.8** (6.6) | 1. **The keeper and lectern (x 0.10–0.43, y 0.43–0.64) are unchanged:** a plain coat, no scarf or satchel, a mitten wave and a simple stand. 2. **The sky band (y 0.20–0.50), scored on finish:** the cluster's domes are more natural than round 12's picket of firs. But the mill isle now sits on the bulging green keel (x 0.80–1.0, y 0.50–0.56), where the mockup has a slim rock spur. 3. **The foreground (x 0–0.45, y 0.60–0.85)** now has grey boulders at the left and the mockup's spread (sd 32 against 35, p90 122 against 124). It is still straw-coloured tufts, with no white daisies (0 against 0.3 %). |
| `round-18-council-mockups/mockup-C-hands-fan-painterly` → `mock-C-hands-fan` | **6.4** (6.3) | 1. **The fan (x 0.55–1.0, y 0.57–0.80) is the same modest hold as in A**, now 23 % smaller. The mockup makes it the hero: x 0.32–0.97, 3.6 % teal against 1.7 %, the pivot in a visible glove, the tassel hanging. The builder says no ordinary pose reaches it; that is honest, but the gap is real. 2. **The sky (y 0.04–0.40) is pixel-identical to round 12:** upper left 152 against 205, chroma 35 against 70, top band sd 3.1 against 10.9. 3. **Left of the bridge (x 0–0.30, y 0.50–0.62)** shows the green keel blob where the mockup has the rocky cliff; the cluster's finish is as in A. The verge is closer (p90 131 against 131). |
| `round-11-review/mockup-D-crown-arena` → `mock-D-crown-arena` (staged `roc-opening`, 3.3 s) | **7.0** (6.8) | 1. **The Roc (x 0–1, y 0.15–0.50) is now an eagle in plumage:** slate-and-white banded wings raised in a V, a pale breast, talons. But it is too big: both wingtips still leave the frame, against the commit's "at 19 its wings ran past both frame edges". It hangs down to y 0.50 and **covers the sun** (disc share 0.09 % against 7.0 %; sun patch hot 3.2 % against 36.8 %). Its pitched-up head sits behind the boss bar (x 0.45–0.55, y 0.19–0.23): dark, with no white head, eye or yellow beak in view. Two gold zigzag slits run down through the legs and tail (x 0.40 and 0.58, y 0.40–0.50), the sky's colour showing through: they read as cracks in the bird. 2. **The arena ground is fixed** (near 58 against 55, floor 69 against 66), and the stones carry cut spirals. The dais has a raised spike at its centre (x 0.50, y 0.63–0.66), where the mockup's compass is flush. The fan still covers the dais's right half; the mockup shows no fan. 3. **The sky is unchanged:** a violet storm (chroma 35 against 25), and an orange haze between the stones with no white cloud tops or small isles (white 0.4 % against 8 %). The whole frame is dimmer (0.4 % hot against 2.9 %). |
| `round-1-proposals/B-sky-reach` → `mock-proposal-B` | **5.7** (5.7) | 1. **The destination (x 0.05–0.95, y 0.38–0.55) moved away from the mockup.** The mockup's mill isle is a narrow rocky spur tapering to roots. The game's is a thin deck on a bulging mossy bun wider than itself (x 0.08–0.92), faceted, with no taper. 2. **The ray and its wake are still not in the frame** (x 0.42–0.75, y 0.29–0.47), for the third round. 3. **The foreground (x 0–0.36, y 0.62–0.84)** has more spread now (sd 30 against 46; it was 19), but it is still dark (p50 53 against 69, p90 108 against 159) and hay-coloured, with no daisies (0 against 4.7 %). The cluster domes improve the sky band's finish. |

**Seat score, Sky Reach: (7.1 + 6.8 + 6.4 + 7.0 + 5.7) / 5 = 6.60 → 6.6** (this seat in round 12: 6.5).

- **The gains are real:**
  - the cluster's organic form;
  - D's ground and stones;
  - the near-meadow spread in A, B and C;
  - a smaller fan.
- **The new regressions eat into them:**
  - the playable keels as bulging blobs (A, B, C, P, the aerials and the clip);
  - the Roc covering D's sun;
  - the cracks through the bird.
- **Nothing moved** in C's sky, P's ray or the keeper.

## The README's and commits' claims, checked

| Claim | Verdict | Evidence |
|---|---|---|
| Row 10 half: "one learned LUT … global", "the engine's last grade step" | **Not in the captured frames** | See ledger 5. The sky, h2's sails and A's bridge post are unchanged to JPEG noise. The LUT would lift each of them by 10–15 L. |
| Predicted dE00 sky 2.1, storm 3.3, low sky 2.1, isles 4.8, meadow 1.0 | **Untested, and fitted on the test set** | They are predicted on the same five pre-LUT frames the LUT was fitted to (`fit-lut.py` with `regions.json`), not measured on a capture. |
| Row 1: "the isles' canopies lush green lit warm" (073a0e7ed) | **Partly: not from above** | The sky isles' green share in aerial-spawn y .10–.30 fell 5.2 → 3.1 %. In A the cluster tops are bald olive domes. |
| Row 1: the playable keels "clipped under their decks, so no canopy pokes through" | **True for the top; the flank bulges** | The keel is widest just under the deck and spills past the rim. See the aerial-spawn mill isle at x .5–.9, y .42–.52, and P under the deck. |
| Row 8: span 16 m, "at 19 its wings ran past both frame edges" | **Both tips still leave D's frame** | Both tips are off at y ≈ 0.15–0.17, and the bird now reaches down to y 0.50 over the sun. |
| Row 8: "a white head, a hooked yellow beak" | **Not visible in D** | The head is pitched up behind the boss bar; what reads as white is the breast under the lock marker. |
| A retry puts the Roc back on its perch, facing the entrance (8e707af7b) | **Verified in code** | `restart()` re-places it on `PERCH()` with yaw `yawTo(DAIS.x, DAIS.z + 40)` and the same `angle` as `stageOpening()`. Round 12's should-fix is closed. |
| "Crag o6 is out of the arena's airspace" | **True for o6, but o3 moved in** | See ledger 5. |
| Row 3: a smaller, lower fan | **Verified** | Teal pixels are 23 % fewer in every view (2.3 → 1.8 % of the frame), and the red tassel shows. One hold everywhere. |
| Row 4: D near ground 85 → 59, C 78 → 76 | **Reproduces** | D 83.5 → 58.0 and C 77.5 → 74.1 on my crops. A's nearest band went the other way, 57 → 46 (mockup 56). |

## Ledger 5 audit (red team)

- **The LUT: not a shortcut. It is missing from the scored build.** Must-fix, process.
  - *What it is.* I loaded `far-reach.bin` (33³ RGBA, index (b·33+g)·33+r) and applied it.
    - It is close to a uniform lift: mean node move 7.6 levels, p90 19.9, max 27.5. Grey 128 → 142, deep shadow
      30 → 39, white unchanged.
    - It adds a small violet desaturation: the storm's a*/b* goes 13/−10 → 9.5/−5.
    - It doesn't remap hue. Straw stays straw: A's meadow median (62, 54, 20) → (70, 60, 26), b* 22 → 22.
    - So it cannot hide the meadow's material gap; it doesn't turn hay green. As fitted, it is one global grade.
  - *The problem is that the round-13 frames don't contain it.*
    - The sky above y 0.20 is pixel-identical to round 12 in all 12 frames (mean RGB difference 0.00).
    - h2's sails (133.6 vs 134.1) and A's bridge post (64.2 vs 63.3) are unchanged too.
    - The LUT applied to round 12's upper sky moves 99 % of the pixels by more than 6 levels (A's sky L 146 → 160).
  - *The probable cause:*
    - `scripts/serve-build.sh` runs `vite build` without `pnpm gen`;
    - the working tree's `src/engine/boot/bytes.generated.ts` (gitignored, dated 05:59, before the LUT commit at 07:19)
      has no `/assets/lut/far-reach.bin`;
    - so `lutUrl()` returns null and no LUT pass is built.
  - *Why it matters:*
    - CI's `pnpm build` runs `pnpm gen`, so the shipped game has the LUT and this capture is not the shipped look
      (ledger 5, "the real game").
    - Simulated on these frames, the LUT would raise every view's median by about 12 L. A's sky would go 146 → 160
      (mockup 154) and C's 152 → 166 (205). A's meadow would go 53 → 60 (59), and D's near ground 58 → 66 (55).
    - A's under-cluster glare would go 15.6 → 23.8 % hot (5.2 %), and D's storm chroma 35 → 28 (25).
    - On balance that is mixed, not a clear gain. My scores are for the captured, LUT-off look.
  - *Fix:*
    - Re-capture before the next round, from a build that ran `pnpm gen` (or make `serve-build.sh` run it).
    - Have `shard-progress` record in `meta.json` whether each shard's LUT pass was built.
    - Until a capture shows the LUT, row 10's grade half doesn't count as landed.
- **The LUT is fitted on the five scored frames.**
  - `regions.json` draws every pair from the five mock views, and the "predicted dE00" is measured on those same frames.
  - It is global, as the plan allows, but nobody has shown it holds up in h1–h4, the aerials or the clip.
  - The grey axis isn't anchored (128 → 142): this is an exposure change carried in a LUT, while plan row 9 says to set
    exposure once, after rows 1–5.
  - Should-fix: measure the LUT on the hero views and aerials as well, and anchor grey if the lift isn't meant.
- **Should-fix, regressed: the arena's airspace moved from o6 to o3.**
  - 073a0e7ed moved o6 out to (34, −175), as round 12 asked. In the same commit it moved o3 from (−4, −170) to
    (−4, −186), deck 86, keel 20.
  - That is 4 m from the crown's centre (0, −190). Its keel tip is at y ≈ 66: 22 m over the deck (44) and 11 m over the
    Roc's lap (ROC.y 55, r 13), so its 12 m radius covers the lap's north arc.
  - It sits above D's frame (about 60° up), so no view shows it. But a player in the arena has an island hanging in the
    storm's eye.
  - Fix: push o3 back out along the line from A's camera (it keeps its place in A) until its keel clears the crown's
    20 m radius plus the lap.
- **New should-fix: the near ground is darkened by camera distance** (e0e4b837c, `isle.ts`):
  `diffuseColor.rgb *= mix(0.72, 1.0, smoothstep(4.0, 12.0, length(farWP.xz - cameraPosition.xz)))`.
  - It is justified as the blades' shade over the dense inner tiles, which exist only near the camera, so it follows
    the sward's level of detail. It is one rule for every view.
  - But it is the same shape as round 12's `glowNear` (which this commit removed): a tone ramp tied to where the camera
    is. It takes A's nearest band to 46 against the mockup's 56.
  - Fix: tie the shade to the blade density field the ground really has, not to camera distance. Or shorten the ramp so
    the nearest metre isn't darker than the mockup's.
- **Placement by view.**
  - The modelled isles, trees and meadow rocks are placed by seeded noise or by the isle rows, the same from every view.
  - The cluster rows are still aimed "10–18 deg up from the spawn". That is the lead's ruling (the world follows A);
    not a breach.
  - The Roc's size and pitch were set from D's frame ("at 19 its wings ran past both frame edges", "pitched as mockup D
    shows its eagle"). They are global (one bird everywhere), so not a breach, but the claim doesn't hold (above).
- **Repeated should-fix: the take-off aims at D's camera axis.** `yawTo(a, DAIS.x, CROWN.z + CROWN.r)` = (0, −170) is
  still on x = 0, the line through D's camera. The bridge landing and the retry respawn are about 13 m west of it. Aim at
  the player's position.
- **Staged state:** `roc-opening` is unchanged and reachable at a walk (round 12's audit). The retry now re-perches the
  Roc, so all three paths start alike. `quest-crown` on h4 is real play state.
- **Still props / staged effects:** none found. The meadow rocks (≤ 0.4 m, no colliders) are real meshes. A player walks
  through them, which is a nit, not a card.
- **No narrowing:** h1–h4, the aerials and the clip show the same world as the mock views.
  - Regressions outside the mock views: the playable islands' keels, now bulging faceted masses wider than their decks
    in the aerials and in every second of the clip; the spawn isle's underside faceted (aerial-spawn y .88–1.0); the sky
    isles less green from above.
  - h4's Roc is now off frame (one wingtip at the top left): a lap moment, not a finding.
- **Budget:** the gpuMB ceilings were re-recorded (phone 249 MB). The fps pill reads 30 in the five mock views, and
  `programs` went 101 → 102. I can't verify the phone's memory limits from this surface.

## Findings, ranked by score gained

1. **New, must-fix (process): capture the build that ships.** The LUT is absent from all twelve frames (ledger 5).
   - Re-capture from a build that ran `pnpm gen`, and record the LUT state in `meta.json`.
   - Then judge the grade on the hero views and aerials, not only on the five frames it was fitted to.
   - The simulation says it would overshoot A's under-cluster glare (23.8 % against 5.2 %) and D's near ground (66
     against 55). Anchor grey if the +14 lift isn't meant.
2. **New regression: the playable islands' keels bulge past their decks** (A x .30–.70, y .47–.60; B x .80–1, y .50–.56;
   C x 0–.30, y .50–.62; P x .08–.92, y .40–.55; the aerials and the clip).
   - The Hunyuan keel is fattest right under the deck, so each playable isle reads as a thin disc on a mossy bun.
   - In A it fills the cloud gap behind the bridge with faceted green lumps. In P it replaces the mockup's tapering
     rocky spur.
   - **Fix:** scale each keel's top section to sit inside the deck's rim (x/z scale from the deck apothem at the clip
     height), and taper it below. Use a rock-coloured material on the flanks, not the moss paint, and enough triangles
     that a 20 m mass doesn't show facets at bridge distance. Check on aerial-spawn and P.
3. **New regression, D: the Roc covers the sun, and its head is behind the boss bar** (x 0–1, y 0.15–0.50).
   - Sun disc 0.09 % against 7.0 %, sun patch hot 3.2 % against 36.8 %. Both wingtips still out of frame.
   - **Fix:**
     - Scale it toward the mockup's span, both tips inside, at about x 0.02–0.97.
     - Rise further in the take-off, so the body clears the sun's row (y ≈ 0.45) and the head drops below the bar
       (y > 0.25).
     - Ease the head-up pitch, so the white head and yellow beak face the camera three-quarter on, as in the mockup.
     - Fix the two gold slits through the legs and tail (x 0.40 / 0.58, y 0.40–0.50): weight-paint or close the mesh at
       the leg and tail joins.
     - Keep it one global bird and the same 3.3 s stage.
4. **Repeated: C's sky and D's horizon are untouched** (C x .05–.60, y .04–.25: 152 against 205, sd 3.1 against 10.9;
   D between the stones: white 0.4 % against 8 %, storm chroma 35 against 25).
   - Row 5 (cumulus between the isles) is the plan's answer. It is open, and the sky is pixel-identical to round 12.
   - Build it next: sunlit white-topped cloud at several depths. In D, put it in the stone gap with two or three small
     far isles. In C, give the upper band layered warm cloud relief, in the one shared dome.
5. **Repeated: the meadow's colour is hay, not green-gold** (A, B, C, P foregrounds).
   - The spread and detail now match: A p90 106 / sd 33 / hp 21.5 against 100 / 30 / 20. But the hue is 92° against 84°,
     chroma is 45 against 38, the blade tips are beige, and the nearest rows are too dark (46 against 56).
   - **Fix:** push the tip colour from `0xd8b878` toward a warm yellow-green, and lift the mid colour. Do it in the
     material, not the LUT, which can't change the hue (above).
   - Bring A's three near boulders into its view (real meshes, as B's are). Fill the smooth dark turf patch left of the
     bridge (A x 0–.25, y .55–.62) with sward.
6. **Repeated: the cluster's finish** (A x 0–1, y .17–.40; B, C and P under the ruling).
   - The forms are right now: staggered, overlapping and drooping.
   - Give them lit rock on the sun-rim faces (the mockup's gold undersides, chroma 80), bushy crowns along the rims
     instead of bald dome tops, and a canopy that reads green from above (the aerials lost green).
7. **Should-fix, regressed (ledger 5): o3 now hangs over the crown.** Move it out along A's line of sight (see the audit).
8. **Repeated: P's ray** (x .42–.75, y .29–.47), absent for the third round. Bring the lap's near arc past the mill's
   right shoulder from this camera, checked over a whole lap.
9. **Repeated: the fan in C and D, and the keeper in B.**
   - C's hero framing needs a real ordinary pose that reaches it (an idle flourish or the swing's held follow-through),
     or it stays a gap.
   - D's mockup shows no fan; the hold still covers the dais's right half.
   - The keeper is the open half of row 10: scarf, satchel, layered coat and an open palm.
10. **New should-fix: the camera-distance ground shade** (`isle.ts`). Tie it to the blade density field, not to the
    camera (ledger 5).
11. **Repeated should-fix: aim the take-off at the player**, not at D's camera axis (0, −170).

SCORE sky-reach: 6.6
