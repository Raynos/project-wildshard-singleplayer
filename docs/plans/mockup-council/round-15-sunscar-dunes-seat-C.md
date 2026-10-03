# Round 15, seat C (Claude, red team), Signal Dunes

**What I reviewed:**
- `docs/process/COUNCIL.md`, the ledger (with Jake's amendments: the 7.0 bar and the phases), the brief, `scores.md`,
  and round 14's three Signal Dunes seat files.
- The "Signal Dunes, round 15" section of `art/mockup-council/round-15/README.md` and its five sheets.
- Every frame in `progress/sunscar-dunes/20261003-0835-c1b820c3/`: the `mock-*` views, h1–h4, both aerials,
  `first-frame`, `clip.mp4` at 1 fps and `meta.json`. Round 14's capture `20261003-0730-69642e60/` and round 13's
  `20261003-0648-50cd2d82/` for before and after, on the same regions.
- The five ledger mockups, Lanczos-scaled to 780×1688.
- The builder's overlay `art/sunscar-dunes/round-22-landforms/overlay-A-duskfire-r15.jpg`.

**Source checks (read-only):**
- `git show` of 662e6e99b (layout.ts, render.ts, dunes.ts, whipModel.ts, cameras.json), 9d610a30d and a1aa357f7.
- `render.ts` at c1b820c3 for `sandFar`.
- The working tree's uncommitted `look/painted.ts` (row 5, the painted sky) is not in c1b820c3, so it is not judged
  here.
- The terrain bakes at 69642e60 and c1b820c3, decoded: 256² float32 from byte 24, x and z over −250..250. All eleven
  camAt eye heights come out at 1.70 m over the decoded ground (h4 is on the deck), so the decode is right. From the
  bakes: heights, slopes, line of sight from both D stands, and relief statistics.

**How I measured:**
- Rec. 709 luma on the decoded JPEGs.
- **Clean sand:** x 10–150, y 1180–1400. It is clear of the new loop and its fall in all five views.
- **Fine:** the mean of |luma − luma blurred at σ 2|.
- **Grid r:** the Pearson r of a 10×7 grid of σ-12 luma over y 0.36–0.58, mockup against game.
- **Regions:** frame fractions (x left → right, y top → bottom). They are the same regions as round 14's seat C.
  My r14 numbers reproduce that table to within 0.6 on every patch.

**The short version:**
- **Undone:** round 14's key swing. The spawn pair's warm near sand is back: dusk-fire 69.9 against 74.1 (r14 43.7),
  A 62.9 against 56.7.
- **Landed:** the closed loop. dusk-fire's single loop is now the right kind of shape.
- **Still not landed:** the lit diagonal. A's band correlation is still negative (−0.18), and dusk-fire's went from
  +0.23 to −0.33.
- **The wind flip** turned every far windward face toward the spawn. The violet lift turns those faces into a pale,
  stair-edged, milky sheet right of the tower, where both spawn mockups are in shade.
- **B:** a new mound, placed for B's backdrop, now covers B's right glow band (35.6 against 87.5).
- **The late views:** a new camera-distance darkening (70 % of diffuse past 15–70 m, from dusk 0.55) puts the late
  dune field into near black. The clip's ground fell from 24–31 to 3–6, with 78–99 % of the land under luma 8. That is
  where D's "land under the horizon 10" comes from. I treat it as a ledger-5 breach (below), and I give D no credit for
  it.
- The mean is flat.

## Measurements (mockup / r13 / r14 / r15)

| View | Clean sand | Fine | RGB (clean patch) | Grid r y 0.36–0.58 (r13 / r14 / r15) |
|---|---|---|---|---|
| dusk-fire | 74.1 / 75.5 / 43.7 / **69.9** | 9.8 / 5.4 / 10.6 / **7.7** | 113,66,38 / … / 75,36,20 / **104,62,39** | +0.44 / +0.23 / **−0.33** |
| A spawn | 56.7 / 75.8 / 44.5 / **62.9** | 9.3 / 5.2 / 11.0 / **9.1** | 86,49,35 / … / 77,37,19 / **96,55,33** | +0.34 / −0.29 / **−0.18** |
| B logbook | 39.5 / 24.7 / 28.2 / **39.3** | 2.1 / 2.5 / 2.8 / 3.2 | 62,34,27 / … / 49,22,19 / **66,32,25** | +0.86 / +0.84 / **+0.68** |
| C waymark | 32.4 / 18.2 / 40.3 / **40.4** | 0.6 / 1.2 / 2.2 / 1.7 | 52,27,22 / … / 64,34,29 / 67,33,28 | +0.50 / +0.72 / **+0.65** |
| D hands | 34.7 / 25.0 / 32.6 / **32.7** | 0.6 / 1.3 / 1.5 / 1.7 | 51,30,26 / … / 54,26,24 / 54,26,25 | +0.79 / +0.80 / +0.82 |

| View | Region | Mockup | r14 | r15 |
|---|---|---|---|---|
| A | The mockup's lit diagonal, x 0.4–0.7, y 0.40–0.44 | 96.7 | 30.0 | **48.4** |
| A | Shade under it, x 0.5–1, y 0.48–0.54 | 42.5 | 57.5 | **75.0** |
| A | Right band, x 0.6–1, y 0.36–0.46 | 55.1 | 32.5 | 60.0 |
| A | Horizon strip right of the tower, x 0.6–1, y 0.385–0.405 | 38.2 | 30.2 | **73.3** |
| A | Left lee, x 0–0.3, y 0.38–0.44 | 45.1 | 54.4 | 55.1 |
| dusk-fire | Lit left shoulder, x 0–0.35, y 0.50–0.70 | 82.9 | 55.4 | 69.5 |
| dusk-fire | Saddle, x 0.35–0.9, y 0.46–0.56 | 54.6 | 54.0 | **74.2** |
| dusk-fire | Lower right, x 0.6–0.97, y 0.48–0.56 | 46.1 | 61.7 | **86.3** |
| dusk-fire | Tower mound's face, x 0.2–0.8, y 0.36–0.40 | 33.1 | 36.2 | **64.2** |
| dusk-fire | Sky, y 0.24–0.30 | 84.5 | 117.3 | 117.3 |
| B | Glow right of the wagon, x 0.72–0.9, y 0.40–0.47 | 87.5 | 84.1 | **35.6** |
| B | Backdrop right, x 0.6–1, y 0.44–0.48 | 21.5 | 55.5 | 30.2 |
| B | Land left of the camp, x 0–0.2, y 0.455–0.475 | 39.4 | 60.2 | 56.2 |
| B | Wagon front, x 0.45–0.6, y 0.41–0.47 | 58.3 | 55.1 | 53.7 |
| C | Glow band right, x 0.6–1, y 0.44–0.47 | 72.5 | 33.1 | 98.7 |
| C | Far land, x 0.6–0.9, y 0.48–0.53 | 16.1 | 30.7 | 24.3 (under the fade) |
| C | Left ground, x 0–0.25, y 0.55–0.65 | 66.4 | 72.8 | 67.4 |
| D | Lit near band, x 0–0.4, y 0.64–0.68 | 58.9 | 35.5 | 35.4 |
| D | Glove p50 / p95 / fine (mockup x 0.76–0.97, y 0.69–0.80; game x 0.66–0.82, y 0.62–0.76) | 24.3 / 83.5 / 8.8 | 29.1 / 54.1 / 3.4 | **26.1 / 47.1 / 3.0** |

**D, rows down the left half (x 0–0.49), y 0.47 → 0.71 in steps of 0.015:**

| | |
|---|---|
| mockup | 140 154 67 17 16 15 13 25 13 13 14 **50 61 52** 48 46 43 |
| r14 | 152 46 33 36 35 37 38 38 38 36 36 36 36 36 35 35 34 |
| r15 | 146 31 16 **11 7 7 6 8** 25 36 35 35 35 36 34 33 33 |

- The upper band is now darker than the mockup's (6–11 against 13–17).
- It ends in one step at y 0.59: that is where the 15–70 m fade ends.
- The mockup's lit stripe at y 0.64–0.67 (50–61) is still missing (35).

**clip.mp4 (late dusk, 1 fps):**

| | r14 | r15 |
|---|---|---|
| Ground, y 0.55–0.90 | 24.0–31.5 | **3.1–6.0** |
| Mid band, y 0.30–0.60: median | 31–32 | **4** |
| Mid band: share under 16 | 4–15 % | **96–99 %** |
| Land, y 0.25–0.90: share under 8 | 0–1 % | **78–99 %** |

In r15 the dune field is a black mass under a bright band. The forms that read in round 14's clip are gone.

**Relief (the bakes, inner ±200 m):**

| | r14 | r15 |
|---|---|---|
| Faces over 15° | 20.4 % | 25.6 % |
| Faces over 15°, more than 80–90 m from the crest and both mounds | 13.7 % | 17.3 % |
| Max slope | 39.3° | 39.2° |

The field did not flatten outside the authored forms.

## Signal Dunes (sunscar-dunes)

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` (Jake's pick) | **6.2** | 1. **The light on the land runs the wrong way (x 0–1, y 0.36–0.56). Regression in form; gain in value.** The mockup has a lit near-left shoulder, a shaded saddle running down to the right, and a dark tower mound. The game lights its whole near windward face across the width. It lifts the right side into a pale lilac sheet: saddle 74 against 55, lower right 86 against 46, the mound's face 64 against 33. Grid r is −0.33 (r14 +0.23). 2. **The foreground. Gain.** The warm sand is back (69.9 against 74.1; RGB 104,62,39 against 113,66,38). The one closed loop now has the mockup's kind of shape. But the fist stands upright at x 0.62–0.85 from y 0.61, where the mockup's gauntlet lies low in the corner, and the mid-distance ripples (10–30 m) are bold dark stripes the mockup doesn't have. 3. **The sky (y 0.10–0.36). Repeated.** 117 against 85, with cream-pink banks right. |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.2** | 1. **The lit diagonal (x 0.3–1, y 0.38–0.54). Still not there.** The crest now descends left to right as the mockup's does, but it is the near windward face, ripple-covered and mid-lit (48 against 97). The region beyond it, which the mockup shades (42.5), is the brightest land in the frame (75). Grid r is −0.18. 2. **A milky, stair-edged sheet at the horizon right of the tower (x 0.6–1, y 0.385–0.41). New.** It measures 73 against 38. Zoomed in, it is the far windward faces, flattened to pale lavender layers with aliased, stepped edges. It reads as low cloud or water, where the mockup has dark blue-grey dune rows. 3. **The viewmodel (x 0.27–0.9, y 0.55–0.86).** One upright closed loop and a vertical four-band fist, where the mockup has two low broad coils over a half-hidden hand. The empty vista (Sefa gone) and the near grain (fine 9.1 against 9.3) are gains. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **6.6** | 1. **The new mound covers the glow right of the wagon (x 0.65–1, y 0.33–0.47). Regression.** It is a rippled, lit dune rising above the wagon's roof: the glow is 35.6 against 87.5 (r14 84.1). The mockup has a low dark ridge under a continuous orange band. Grid r is +0.84 → +0.68, whole-frame r +0.79 → +0.70. 2. **The backdrop's values. Gain.** Right of the camp it is 30.2 against 21.5 (r14 55.5), but left of the camp it is still lit (56 against 39). 3. **The sand and the viewmodel.** The near sand matches (39.3 against 39.5; r14 28.2). The fat single loop and the vertical fist stand where the mockup has two broad coils and a hand. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **6.8** | 1. **The right horizon (x 0.6–1, y 0.43–0.53). Mixed.** The glow band is back (98.7 against 72.5; r14 33), now a little hot. But the second waymark dropped from a rise to a small flame low on the plain: about x 0.82, y 0.51, against the mockup's brazier on the skyline at x 0.89, y 0.44–0.47. That followed the removal of waymark 1's lift and the move of the crest. The far land is 24 against 16, partly from the late fade (not credited). 2. **The fire (x 0.25–0.5, y 0.20–0.53). Repeated.** A pale cream core, long graphic tongues, no logs or billowing smoke. 3. **The ground and the viewmodel.** The near ground holds (51 against 49; left 67 against 66), and the pool still glows. The loop and the fist stand where the mockup has two broad low coils. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.4** | 1. **The hero glove (x 0.62–0.9, y 0.60–0.83). Repeated, finish down.** The size is closer now. But it is still four smooth stacked finger bands facing the camera with the handle sticking up, not the mockup's back of a stitched, creased gauntlet with its cuff leaving the right edge. The leather is flatter than round 14's: p95 47 against 83.5, fine 3.0 against 8.8. The single fat loop replaces the mockup's two slim plaited loops (better than r14's hook). 2. **The land under the horizon (y 0.50–0.71). Not credited (ledger 5).** It falls to 6–11 by camera distance, then steps at y 0.59 to a flat 35. The mockup has dark bands of 13–17 with a lit stripe at 50–61 (y 0.64–0.67). Without the fade, the land is round 14's flat 36. 3. **The tower (x 0.84–0.92, y 0.47–0.52).** It is where the mockup puts it. From 30 m closer it stands about 1.5× the mockup's height, and the world label "SIGNAL TOWER 170" sits over it. |

**Seat score, Signal Dunes: (6.2 + 6.2 + 6.6 + 6.8 + 6.4) / 5 = 6.44, so 6.4.**
- This seat's earlier scores: 4.6, 5.1, 4.9, 5.2, 5.6, 5.3, 5.7, 6.1, 6.4, 6.4, 6.7, 6.7, 6.5, 6.4.
- Flat: dusk-fire +0.3 and A +0.1 from the warm sand, B −0.3 from the mound over the glow, C −0.1, D 0.
- With credit for D's faded land, D would be about 6.7 and the mean 6.5. I don't give that credit (ledger-5 audit).

## Builder's claims checked against the pixels

| Claim (README / 662e6e99b) | Verdict | Evidence |
|---|---|---|
| The key at 23.5°, inside the glow | **True** | `KEY.dir` is (0.39, 0.2, −0.9): azimuth +23.4°. The spawn sand is back (69.9 / 62.9). |
| "Crossing A's frame as its lit diagonal" | **Half true** | The crest line descends left to right in A. But the mockup's lit band (x 0.4–0.7, y 0.40–0.44) is 48 against 97, and the land beyond it is brighter than the face. Grid r is −0.18 in A and −0.33 in dusk-fire. |
| Shade share of the dune band: A 34 / 38 % (mockup 23 / 40) | **Unverifiable as stated, and not the right test** | A share ignores where the shade falls. By position, the shade is in the wrong places: the mound's face is lit 64 against 33, the land beyond the crest 75 against 42.5. |
| B right of the wagon 36–45 (was 80; mockup 17–25) | **True for the land; it leaves out the cost** | 30.2 at x 0.6–1, y 0.44–0.48. The same mound covers the glow above it: 35.6 against 87.5 (r14 84.1). |
| D under the horizon 10 (mockup 17) | **True, by a camera-distance fade** | Rows y 0.52–0.58 read 6–11. `farLate = smoothstep(0.55, 0.85, uDusk) * smoothstep(15.0, 70.0, sandFar)`, with `sandFar = length(vSandPos − cameraPosition)`. The code comment says "no gate"; it is a 15–70 m gate on distance from the camera. |
| Near patches: dusk-fire 70.5 / 73.8, A 64 / 57, B 38 / 40, C 40 / 33, D 32 / 35 | **True** | 69.9 / 74.1, 62.9 / 56.7, 39.3 / 39.5, 40.4 / 32.4, 32.7 / 34.7. |
| Near ripples halved | **True** | The spawn pair's fine is 7.7 / 9.1 against 9.8 / 9.3, and p5 is 26–36 (r14 10). The bold mid-distance stripes (10–30 m) are unchanged: the lead's note stands. |
| The glove 0.7 size, three-quarter, the loop closed | **Size and loop true; the pose mostly not** | `rot` y 0.35 → 0.85. On screen the fist still shows four finger bands to the camera, and no cuff or back of the hand. The loop is closed and upright beside the fist in every view. |
| mock-D's new stand is "a reachable 24 m rise, with the tower where the mockup has it" | **True** | See the ledger-5 audit. |
| Max climb green (34.3°) | **Under the limit** | The bake's max slope is 39.2° on a 2 m stencil. None is over 40°. |

## Findings, ranked by score gained

1. **The late darkening is a camera-distance fade, again: replace it (clip, D, C, the late quest).**
   *Ledger-5 breach, regression; repeated pattern (round 10 R10, round 12, and now a third time).*
   - **What it does:** `farLate` cuts direct and indirect diffuse by 70 % between 15 and 70 m from the camera, from
     dusk 0.55. The 662e6e99b change also widens the facing cut (`smoothstep(-0.65, 0.15, toGlow)`,
     `smoothstep(0.06, 0.5, tilt)`), so it now reaches faces turned toward the glow and nearly flat ground.
   - **Late play is now black:** together they leave the late field in near black. The clip's ground is 3–6 (r14
     24–31), with 78–99 % of the land under 8.
   - **It follows the player:** a lit 15 m disc moves with them, and every dune they walk toward brightens as they
     arrive.
   - **Where it starts:** the 0.55 onset falls just past B's staged 0.50 and before the waymark stages (0.62 / 0.74 /
     0.86). It darkens C and D and leaves B untouched.
   - **Fix:**
     - Delete `farLate`.
     - Put the facing windows back near round 14's, minus the hard edge: about `smoothstep(-0.45, -0.05, toGlow)` and
       `smoothstep(0.12, 0.4, tilt)`.
     - Get D's dark bands from the land itself: transverse crests across D's line of sight, with their slip faces
       toward the camera, and view-ray in-scatter toward the glow (by direction, not distance).
     - **Accept when:** the clip's ground is back at 20 or more, D's rows y 0.52–0.62 are 13–20, and the lit stripe at
       y 0.64–0.67 is 45 or more.
2. **The far windward faces read as a milky cloud sheet (A, dusk-fire, h1, first-frame; x 0.6–1, y 0.38–0.56).**
   *New, from the wind flip.*
   - **What it looks like:** A's horizon strip is 73 against 38, A's land beyond the crest 75 against 42.5,
     dusk-fire's lower right 86 against 46. The edges are stair-stepped.
   - **Why:** with the wind blowing away, every far face toward the camera is a lit windward slope. The violet lift
     greys it to lavender.
   - **Fix:**
     - Cap the aerial-perspective lift on lit faces past about 150 m, so the far rows keep a dark, cool value (the
       mockups' 35–45).
     - Fix the far silhouettes' stepping: sample the far ring's height bilinearly, or with a finer LOD, rather than per
       2 m cell.
     - **Re-check:** A's grid r should be ≥ +0.3 and dusk-fire's ≥ +0.4, as the round-13 build had.
3. **B's new mound covers the afterglow (x 0.65–1, y 0.33–0.47).** *Regression, from 662e6e99b
   `mounds[1] = (-118, -30, h 26, r 60)`.*
   - **What it costs:** the glow is 35.6 against 87.5. The mound stands above the wagon's roof, rippled and lit.
   - **Fix:** lower and push back that mound. About 10–12 m high, and 150 m or more from B's camera along its view, so
     its crest sits at or under the band's foot (y ≈ 0.45). Keep its slip face toward the camera, so it reads dark
     under the glow as the mockup's ridge does. **Check:** the glow at x 0.72–0.9 ≥ 80, the backdrop ≤ 30.
4. **The spawn pair's light pattern (A and dusk-fire, x 0.3–1, y 0.36–0.56).** *Repeated (rounds 9–15).*
   - **What is missing:** the mockups light the far side of a crest that faces the camera, beyond a shaded trough, and
     keep the tower's mound dark. The game lights the near windward face and the far right.
   - **Fix:** move the authored crest's line about 30–40 m further out than (−17, 5.6) → (34.6, 49), so the camera sees
     its lit face beyond a shaded trough rather than standing on it. Keep the tower's mound in shade toward the
     camera (about 33). Judge by the grid r against the mockups, not by the shade share.
5. **The glove's pose and leather (D first, then all five; x 0.6–1, y 0.6–0.86).** *Repeated; the finish regressed.*
   - **Pose:** rotate the hold further, so the back of the hand and the cuff face the camera, with the cuff leaving the
     right edge. Lower it so the fist's top is near y 0.67.
   - **Leather:** p95 47 against 83.5, fine 3.0 against 8.8. Bring back the creases, the stitching and a key-catching
     specular.
   - **Loop:** two slimmer turns (the cord thinner) would match A, B, C and D. dusk-fire's single loop is already
     close.
6. **C's second waymark is off its rise (x 0.82–0.89, y 0.44–0.51).** *Regression of round 14's gain.*
   - **What changed:** removing the lift and moving the crest left it as a small flame on the plain, 0.07 of the frame
     under the mockup's skyline brazier.
   - **Fix:** a modest natural rise at waymark 0, with no 41–44° face. Or ask the lead which waymark the mockup's
     "64 M" one is.
7. **Sefa's move leaves the first frame with no pointer (first-frame, A, dusk-fire; tracker at top right).**
   *New, should-fix.*
   - **The cause:** row 9 puts her 5 m right and behind. Her distance drops off the tracker at that range ("LIGHT THE
     SIGNAL FIRE" only; r14 "SEFA 8 M"), and no off-screen chip shows on the right edge.
   - **The risk:** a new player's first look has no cue that the quest-giver is behind them.
   - **Fix:** show an edge chip toward her, or keep her distance on the tracker. Check it on the first frame.
8. **dusk-fire's sky and C's fire.** *Repeated (rows 5 and 6).* The sky band is 117 against 85; the fire core is
   unchanged.

## Ledger-5 audit

- **The wind flip (global): no breach.**
  - It is one `WIND` constant, and it generates the whole field. Relief outside the authored forms rose (faces over
    15°: 13.7 → 17.3 %).
  - The aerials read as one dune sea, and h3 and h4 show consistent forms. So it is not a set built for A.
  - It does carry a cost from other views:
    - From the spawn, the far field turns to a pale sheet (finding 2).
    - In the late clip, the field cannot be read at all, though that is the fade's fault, not the wind's.
  - The authored forms are placed by frames:
    - The crest's comment says it crosses "A's frame from ~0.37 at the left edge to ~0.48 at the right".
    - The new mound is "a dune behind the caravan" for B.
  - They are real, walkable terrain (max slope 39.2°), not cards. This is the frame-placed-landform should-fix rounds 13
    and 14 raised, now repeated.
- **mock-D's 30 m move: real and reachable; no breach.**
  - **The old stand really is blocked.** In the r15 bake, the old stand (38, 122) fell from 25.9 to 18.2 m. From there
    a dune 30 m out rises 5.0° over the eye, against the tower top's 5.2° at 199 m, so the tower would be hidden.
  - **The new stand is on a real rise.** (36, 92) is at 24.27 m, on a 12° flank 12 m from a 25.5 m top: a 5 m ring is
    23.2–25.2, a 30 m ring 9.9–24.8. It is reached from the spawn on ≤ 13.8° grades.
  - **The view is the same kind of view.** The eye is 26.0 against r14's 27.6. The heading is within 0.8°, and the
    tower lands at the mockup's x. The camera moved because the world moved, not to dodge a weak area.
  - What the new frame hides is done by the fade, not the stand.
- **The late fade past 15 m: breach (no narrowing, and a camera-relative trick). Must-fix.**
  - **It is a fade from the camera.** `smoothstep(15.0, 70.0, length(vSandPos − cameraPosition))`, 70 % of the light,
    from dusk 0.55.
  - **The rest of the shard regressed to make the views better.** The late quest (every waymark stage and the tower
    climb) now plays over a black dune field; the clip's ground is 3–6 against 24–31.
  - **It also hides material.** D's missing transverse bands and lit stripe are blacked out instead of built.
  - This is the third time the late darkening has been camera-distance gated (round 10, round 12). The README frames it
    as "falls toward silhouette".
  - **What I did:** D's land is scored as round 14's, and C's far land gain is not credited. If the lead rules the late
    views void under ledger 5's first sentence, my D and C numbers are void with them, and the round is re-run after
    finding 1.
- **Staged state: unchanged and reachable.** `staged` holds `logbook` and `waymarks-lit` ×2. 662e6e99b changes no stage
  handler or dusk curve. `farLate` reads `uDusk`, and its onset sits between the staged stages (finding 1).
- **Sefa (row 9):** a real placement for every player, not a shot-only state. The quest is unchanged. The missing
  pointer is a should-fix (finding 7), not a breach.
- **Device, HUD, build: no breach.**
  - 390×844 touch, stored 780 wide, with the baseline HUD and the 30 fps chip in every frame.
  - `pageErrors: []`, `active: []`, QA retakes none.
  - The uncommitted painted sky in the working tree is not in this capture.
  - Frame time and device memory are not on this surface: unverified, not breached.

SCORE signal-dunes: 6.4
