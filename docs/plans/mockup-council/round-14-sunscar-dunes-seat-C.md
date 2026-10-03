# Round 14, seat C (Claude, red team), Signal Dunes

**What I reviewed:**
- The "Signal Dunes, round 14" section of `art/mockup-council/round-14/README.md` and its five sheets.
- The full-res frames in `progress/sunscar-dunes/20261003-0730-69642e60/`: every `mock-*`, h1–h4, both aerials,
  `first-frame`, `clip.mp4` at 1 fps and `meta.json`.
- Round 13's capture `20261003-0648-50cd2d82/`, for before and after, on the same regions.
- The five ledger mockups, Lanczos-scaled to 780×1688.
- The lead's overlay `art/sunscar-dunes/round-22-landforms/overlay-A-duskfire-r14.jpg` and the glove board
  `art/sunscar-dunes/round-23-glove/board.jpg` with its README.

**Source checks (read-only):** `git show` of ea0b3939a, 5db840110, 042c219c9 and 69642e603; `layout.ts` LANDFORMS,
`world/dunes.ts` (`WIND`, `landforms()`), `look/render.ts` (KEY, the late cut), `look/sky.ts` (SUN_GLOW) and
`weapons/whipModel.ts` (HD_GLOVE, LOOP). The terrain bakes at 50cd2d823 and 69642e603, decoded (256², 500 m): heights at
every camera and site, slope statistics, transects across the crest, N·L and a cast-shadow march under the old and new
key. World points (crest, tower, waymarks) projected through meta.json camAt into A, dusk-fire, C, h4 and both aerials;
the tower lands on the tower in A (x 455) and dusk-fire (x 290), so the projection is right.

**How I measured:** Rec. 709 luma on the decoded JPEGs. Clean sand is the seats' patch x 10–190, y 1160–1420; the new
cord passes near its right edge, so I also read x 10–150, y 1180–1400 (same result within 1.5). Fine detail is mean
|luma − luma blurred at σ 2|. Grid r is the Pearson r of a 10×7 grid of mean luma over y 0.36–0.58, mockup against
game. Regions are fractions of the portrait frame (x left → right, y top → bottom). My round-13 numbers reproduce round
13's seat-C table to within 0.2 on every patch.

**The short version.** Row 2 (the sand) works: the grain at the spawn is back (A 10.8, dusk-fire 10.3 against the
mockups' 9.3 / 9.4) and the slip faces are smooth. The flat-ground cut is gone, which lifts C a lot, and the h4 sky
stripe is gone. But the lead's row-1 fix swung the key light 78° (azimuth −27° → +50°), and that cost the two spawn
views more than anything else gained:
- dusk-fire lost its big warm foreground (near sand 44 against 74; the lit shoulder 55 against 83);
- A's lit diagonal is darker than ever (30 against 97), and its band correlation went negative (+0.33 → −0.28).

The crest still runs within 11° of the key, so the claim that the key now crosses it is false. The new glove is a large,
smooth, knuckles-forward fist with a hook-shaped cord, and the lead's first read of it is right. The mean drops.
No breach voids a score.

## Measurements (mockup / r13 / r14)

| View | Clean sand | Fine (clean patch) | Grid r y 0.36–0.58 (r13 → r14) |
|---|---|---|---|
| dusk-fire | 73.8 / 73.5 / **44.1** | 9.4 / 5.5 / **10.3** | +0.44 → **+0.24** |
| A spawn | 57.4 / 76.0 / **44.8** | 9.3 / 5.2 / **10.8** | +0.33 → **−0.28** |
| B logbook | 39.7 / 26.3 / **29.6** | 2.0 / 2.5 / 3.2 | +0.85 → +0.82 |
| C waymark | 32.6 / 18.1 / **40.0** | 0.7 / 1.2 / 2.5 | +0.47 → **+0.70** |
| D hands | 34.9 / 26.0 / **32.6** | 0.6 / 1.3 / 1.8 | +0.75 → +0.76 |

| View | Region | Mockup | r13 | r14 |
|---|---|---|---|---|
| A | Left lee, x 0–0.3, y 0.38–0.44 | 45.1 | 47.7 | 54.4 |
| A | The mockup's lit diagonal, x 0.4–0.7, y 0.40–0.44 | 96.7 | 50.7 | **30.0** |
| A | Shade under it, x 0.5–1, y 0.48–0.54 | 42.5 | 69.3 | 57.5 |
| A | Right edge, x 0.9–1, y 0.52–0.545 | 33.6 | 69.1 | 68.2 |
| A | Right band, x 0.6–1, y 0.36–0.46 | 55.1 | 37.5 | **32.5** |
| A | Near sand RGB (alt patch) | 86, 50, 35 | 105, 70, 50 | **77, 37, 20** |
| dusk-fire | Lit left shoulder, x 0–0.35, y 0.50–0.70 | 82.9 | 71.6 | **55.4** |
| dusk-fire | Saddle shade, x 0.35–0.9, y 0.46–0.56 | 54.6 | 65.8 | **54.0** |
| dusk-fire | Lower right, x 0.6–0.97, y 0.48–0.56 | 46.1 | 66.2 | 61.7 |
| dusk-fire | Sky, y 0.24–0.30 | 85.0 | 116.3 | 116.9 |
| B | Wagon front, x 0.45–0.60, y 0.41–0.47 | 58.3 | 38.6 | **55.1** |
| B | Horizon glow, x 0.72–0.9, y 0.40–0.47 | 87.5 | 61.5 | **84.1** |
| B | Land left of camp, x 0–0.2, y 0.455–0.475 | 39.4 | 39.6 | **60.2** |
| B | Backdrop right of camp, x 0.6–1, y 0.44–0.48 | 21.5 | 28.6 | **55.5** |
| B | Mid sand, x 0.1–0.6, y 0.52–0.60 | 42.1 | 34.7 | 39.3 |
| C | Far land, x 0.6–0.9, y 0.48–0.53 | 16.1 | 35.1 | 30.7 |
| C | Pool, x 150–450, y 1060–1150 | 40.5 | 29.4 | 52.9 |
| C | Left ground, x 0–0.25, y 0.55–0.65 | 66.4 | 47.8 | 72.8 |
| D | Land, left / right half, y 0.52–0.62 | 16.0 / 16.0 | 33.5 / 24.8 | 36.7 / 26.5 |
| D | Lit near band, x 0–0.4, y 0.64–0.68 | 58.9 | 31.7 | 35.5 |
| D | Glove p50 / p95 / fine (mockup x 0.76–0.97, y 0.69–0.80; game x 0.62–0.92, y 0.60–0.78) | 24.3 / 83.5 / 8.9 | 28.5 / 59.8 / 5.8 | **29.1 / 54.1 / 3.4** |

### The key and the crest, from the code and the bake

- **KEY** moved from (−0.45, 0.2, −0.87) to (0.75, 0.2, −0.62). Its azimuth went from −27.3° to **+50.4°** (from −z
  toward +x), at an elevation of 11.6°. The sky's `SUN_GLOW` is at +11.5°. The key used to sit 39° left of the visible
  glow; now it sits 39° right of it, outside A's frame (the half-width is 18.6°).
- **The crest** runs (70, −50, 30) → (38, −8, 24) → (8, 26, 14), bearing 39.2°. That is **11° from the key's azimuth**
  (the horizontal cosine is −0.98; round 13 was −0.999), so the light still grazes along it. The camera-side face gets a
  horizontal N·L of 0.195, which is why A's right band is 32.5 against 55.1.
- **The wind:** `WIND` is (−0.643, 0.766) and the crest's direction is (−0.632, 0.775), with a cosine of **0.9999**. The
  crest runs exactly along the wind, as a longitudinal ridge at right angles to every crescent in the field. Its "slip
  face" (leeSide 1; the transect at (38, −8) drops 22.1 → 7.3 m over 30 m) faces north-west, across the wind and not
  down it.
- **Heights, r13 → r14:**
  - spawn 17.02 → 19.50;
  - B 5.37 → 14.54 and the caravan 5.69 → 14.87 (round 12's levels again);
  - C 15.81 → 15.32;
  - **waymark 0 at (58, −34): 0.13 → 25.21.** The crest's far end, 20 m away, carries the brazier onto a ridge top. The
    slope there is 0.4°, the global maximum is 39.3° (under the 40° climb), and parity walks clean. So it is reachable.
- **The near field under the new key:**
  - The spawn's slope faced the old key, with N·L 0.40–0.49 at the feet, 3, 10 and 20 m ahead. Under the new key it is
    0.29–0.31. No cast shadow reaches it.
  - The dimmer near field is plain N·L, and with it went dusk-fire's lit foreground.
  - In aerial-spawn, the whole south-west flank of the spawn dune is now one big shaded face with a hard terminator.
- **Relief outside the crest's reach** (cells more than 90 m from it, inner 200 m): faces over 15° are 31.3 % in r12,
  19.4 % in r13 and **20.2 %** in r14. The h4 cone is **unchanged from r13** (p90 10.6°, 5.7 % over 15°). Only the
  r13 crest's flattened footprint came back. The field round 13 flattened did not.

### clip.mp4 (late dusk, 1 fps)

| | Ground y 0.55–0.90 | Mid band y 0.30–0.60: median / share under 16 |
|---|---|---|
| r13 | 26.1 30.4 31.8 31.6 31.7 31.1 29.7 27.8 26.1 24.7 | 18–22 / 27–38 % |
| r14 | 29.2 31.5 31.5 31.2 31.1 30.7 30.0 28.7 26.5 24.0 | 31–32 / 4–15 % |

- The mean holds and the mid band is lighter.
- **New artefact:** the narrow late-cut gates (`smoothstep(0.2, 0.35)` on tilt, `smoothstep(-0.3, -0.1)` on toGlow)
  draw **hard-edged dark ovals** on every lee face, like pits in the dune field (frames 1–10).

### The low-sky stripe

- h4 is now 0.00 % (blue < 10 and red > 60, y 0.15–0.45); it was 3.08 %. **Closed.**
- h2's 0.74 % is the wagon and the dark sand at y 0.425, not sky.

## Signal Dunes (sunscar-dunes)

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` (Jake's pick) | **5.9** | 1. **The foreground went dark (x 0–0.6, y 0.50–0.86). Regression.** The mockup's defining feature is a big warm-lit near-left shoulder over golden sand. In the game it is dark rust: the clean sand is 44.1 against 73.8 (r13 73.5), the shoulder 55.4 against 82.9 (r13 71.6), RGB 75,37,20 against 113,66,38. The saddle now matches (54.0 against 54.6), but the band correlation fell +0.44 → +0.24. 2. **The viewmodel (x 0.25–1, y 0.53–1.0). New.** The mockup holds one slim loop over a gauntlet low in the corner (y 0.70–0.88). The game holds a smooth fist about 0.43 of the frame wide, knuckles to the camera, its handle sticking up to y 0.55, and a hook of cord running out of the bottom edge. 3. **The sky (x 0.5–1, y 0.10–0.36). Repeated.** The cream banks are still on the right, and the band at y 0.24–0.30 is 116.9 against 85.0. No ray. Sefa still stands at the left edge (row 9 landed after this capture). |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.1** | 1. **The diagonal crest (x 0.4–1, y 0.36–0.56). Regression of the round's target finding.** The mockup's crest descends from upper left to lower right with a lit face (96.7). The game's crest rises toward the right edge, and its camera face is dark: 30.0 at the lit diagonal, 32.5 against 55.1 in the right band. Grid r went +0.33 → −0.28, anti-correlated. The light runs along the crest (11°) from 50° right of the frame. 2. **The viewmodel (x 0.25–1, y 0.53–1.0).** A's mockup holds two big rings over a crude hand. The game holds a single tall hook and a big smooth fist. The coverage is similar, but the shape is different and the cords cross in front of the fingers. 3. **The tower and the near sand.** The tower is about 1.75× the mockup's height (0.074 of the frame against 0.042) on a mostly shaded mound. The near sand is closer in value (44.8 against 57.4; r13 76.0) and in grain (10.8 against 9.3), but redder and duller (77,37,20 against 86,50,35). |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **6.9** | 1. **The backdrop (x 0–0.2 and x 0.6–1, y 0.44–0.48). Regression.** With the camp back on its round-12 ground, the land behind it is lit dune: 60.2 against 39.4 on the left and 55.5 against 21.5 on the right. The mockup's dark silhouette ridge is gone. 2. **The camp values. Gain.** The wagon front is 55.1 against 58.3 (r13 38.6), the horizon glow 84.1 against 87.5 (r13 61.5) and the mid sand 39.3 against 42.1. Whole-frame r is +0.90. 3. **The viewmodel and the props. Repeated.** The hook and the fist cover the right third. The tailboard is still saturated paint, and the wisp still rises right of the wagon. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **6.9** | 1. **The ground (x 0–1, y 0.55–0.86). Fixed, slightly over.** The near sand is 40.0 against 32.6 (r13 18.1) and the left ground 72.8 against 66.4. The pool overshoots: 52.9 against 40.5. Grid r +0.47 → +0.70. 2. **The backdrop (x 0.5–1, y 0.42–0.56). Gain, half done.** The second waymark burns on a ridge at x 0.83–0.88, y 0.44, where the mockup's "WAYMARK 64 M" stands. But the far land is still twice the mockup's value (30.7 against 16.1). 3. **The fire and the viewmodel. Repeated.** The fire still has a pale core, holed licks and no logs or billow. The mockup's double ring and crude hand are now a hook and a big fist. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.4** | 1. **The glove, the subject of this mockup (x 0.57–1, y 0.53–0.86). New, and not the mockup's hand.** The mockup shows the back of a stitched, creased gauntlet, its cuff running off the lower right, its leather catching light (p95 83.5, fine 8.9). The game shows the knuckles head-on as stacked smooth sausages, with no cuff in view (p95 54.1, fine 3.4; r13's hd2 had 5.8). The fist is about 1.5× the mockup's width and sits 0.1 higher. 2. **The cord.** The mockup has a closed plaited loop standing beside the fist. The game has an open hook with a kink at its top: LOOP's lead-in control point bends the curve before the ellipse starts. Two strands of the fall cross in front of the fingers. 3. **The land (y 0.52–0.70). Repeated.** It is 36.7 / 26.5 against 16.0, with no dark transverse bands. The near band is 35.5 against 58.9. |

**Seat score, Signal Dunes: (5.9 + 6.1 + 6.9 + 6.9 + 6.4) / 5 = 6.44, so 6.4.**
- This seat's earlier scores: 4.6, 5.1, 4.9, 5.2, 5.6, 5.3, 5.7, 6.1, 6.4, 6.4, 6.7, 6.7, 6.5.
- C gained (+0.4) from the floor fix and the waymark ridge. The spawn pair lost the most (dusk-fire −0.4, A −0.4) to
  the key swing. D (−0.1) traded a mitt for a glove that doesn't match its pose.

## Builder's claims checked against the pixels

| Claim (README / commits / plan status) | Verdict | Evidence |
|---|---|---|
| "The crest across the light … the key crossing it" (5db840110) | **False** | The crest's bearing is 39.2° and the key's azimuth 50.4°: 11° apart (cos −0.98). The camera face's horizontal N·L is 0.195. |
| "Its slip face downwind of it" | **False** | The crest is parallel to `WIND` (cos 0.9999). Its steep side faces north-west, across the wind. Every other dune in the field faces its slip downwind. |
| "The dune sea's relief back … h4 shows dunes" | **Partly true; h4 is unchanged** | Only r13's crest footprint came back. Away from the crest, faces over 15° are 20.2 % (r13 19.4, r12 31.3). The h4 cone is identical to r13's (5.7 %), and the h4 frame looks the same. |
| "C's second waymark burns on its rise in frame again" | **True** | Waymark 0 is at 25.2 m, projects to x 0.83, y 0.44 in C, and shows there. |
| "The late cut never on flat ground" | **True** | C's near sand is 18.1 → 40.0. The clip holds. New hard-edged ovals appear on lee faces (see the clip). |
| "The low-sky stripe 0.01 % in h4" | **True** | 0.00 % on the strict test. |
| Plan row 2: "clean patch dusk-fire 73.8 / 74.6, A 57.4 / 77.0" | **Stale; not this build** | Measured before the key swing. The capture reads **44.1 and 44.8**. The plan status still quotes the old numbers. |
| Row 4: "ONE loose loop … swinging out and down beside the fist"; "the fist low in the lower right" | **Not supported** | The visible cord is an open hook with a kink. The fall crosses the fingers. The fist spans y 0.53–0.86 and x 0.57–1.0, against mockup D's y 0.66–0.87 and x 0.72–1.0. |
| Row 4: "knuckle folds (2) … the flared gauntlet cuff (4)" | **The cuff is not visible in any scored view** | The hold shows the knuckles head-on (the board's second model view). The cuff is behind the fist. |
| "No camera was re-aimed" | **True** | Cameras blob a4219aa3. Every camAt move is vertical and equals the ground change: spawn +2.48, B +9.17, C −0.49, h3 +25.07. |

## Findings, ranked by score gained

1. **Undo the key swing. Put the key inside the visible glow and turn the crest across it (A, dusk-fire, h1, the
   aerials; x 0–1, y 0.36–0.86).** *Regression (dusk-fire −0.4, A −0.4); the claim is false.*
   - The key at +50° lies 39° outside the sky's own sun glow (+11.5°), and still within 11° of the crest. So it darkened
     the spawn dune's whole south-west flank without lighting the crest. dusk-fire's near sand is 44 against 74, and A's
     diagonal 30 against 97.
   - Fix:
     - Put the key's azimuth between the tower and the glow's peak (+5° to +20°), so the light comes from where the sky
       says the sun is.
     - Author the crest **perpendicular to `WIND`**, like every field crest: far-left to near-right, which is also the
       mockup's diagonal. Keep its slip face downwind, toward the spawn side.
     - Before committing, predict the frame offline: render N·L of the bake from A's and dusk-fire's camAt (the numpy
       projection is a few lines) and correlate it with each mockup's 10×7 band grid. Accept only when both rise, and
       when dusk-fire's near patch stays at 70 or more.
2. **Re-pose and re-finish the glove and the loop (D, dusk-fire, then A, B and C; x 0.55–1, y 0.53–1.0).** *New.*
   - Turn the glove so the back of the hand and the thumb face the camera and the cuff runs off the lower-right corner.
     That is the reference's three-quarter view (the board's first model view), not the second.
   - Scale it to about 0.7, so the fist is about 0.27 of the frame wide with its top near y 0.66 (mockup D). Lean the
     handle forward-left, toward the loop.
   - Build LOOP as a closed plaited ellipse (rx ≈ ry) standing up-left of the fist, in a plane facing the camera. Drop
     the lead-in point at `from + (-0.18, 0.16)` that kinks it, and route the fall behind the fingers.
   - Bring back the leather's contrast: p95 54 against 83.5, fine 3.4 against 8.9. Use the model's own detail, with a
     specular that catches the key rather than a flat viewer-side lift.
3. **Darken the land under the dusk horizon in the late views (B x 0.6–1, y 0.44–0.48; C x 0.6–0.9, y 0.48–0.53; D
   y 0.52–0.62).** *Repeated; B's part is a regression from the camp's ground coming back.*
   - B's backdrop is 55.5 against 21.5, C's far land 30.7 against 16.1, D's land 36.7 / 26.5 against 16.0.
   - Fix: plan row 10's aerial perspective toward the glow. A view-direction in-scatter makes backlit far faces read as
     a dark violet silhouette under the bright band. It is fog by view ray, not a lighting cut gated on distance from
     the camera.
4. **Soften the late cut's gates (the clip, C, D).** *New artefact.*
   - Widen `smoothstep(0.2, 0.35)` on tilt to about (0.05, 0.4), and `smoothstep(-0.3, -0.1)` on toGlow to about
     (−0.5, 0.0). The cut then grades with facing instead of drawing hard dark ovals on every lee face.
   - Check that C's pool comes down toward 40 (52.9 now).
5. **dusk-fire's sky (x 0.5–1, y 0.10–0.36).** *Repeated, round 12 → 14.* The band is 116.9 against 85.0. This is
   row 5, the painted sky. Until it lands, dusk-fire caps near 6.5 even with its foreground back.
6. **The tower's size in A (x 0.5–0.65, y 0.25–0.36).** *Repeated.* It is about 1.75× A's mockup tower. A and
   dusk-fire share the camera, so the lead should rule which mockup sets it.
7. **Quote this build's numbers in the plan.** *New, process.* The row-2 status still says dusk-fire 74.6 and A 77.0;
   the capture reads 44.1 and 44.8. Row 1's "crossing the key" and "slip face downwind" are false on the bake. Every
   status line should quote the ready SHA's capture.
8. **Fire, Sefa, B's smoke and the tailboard.** *Repeated; plan rows 6, 7 and 9.* Row 9 (a1aa357f7) landed after this
   capture. Round 15 should check that her new spot is the one players actually meet her at.

## Ledger-5 audit

- **Views: no breach.**
  - Cameras blob a4219aa3 is unchanged and no turn is hidden.
  - Every camAt move is vertical and equals the bake's ground change at that spot: spawn 17.02 → 19.50, B 5.37 → 14.54,
    C 15.81 → 15.32, h3 0.13 → 25.20.
- **h3's 25 m rise: real terrain, no breach.**
  - The crest's far end lifts waymark 0 onto a 25.2 m ridge top. The brazier stands on 0.4° ground, the field's
    steepest face is 39.3° (under the 40° climb), and parity walks clean. So the waymark, its route and the h3 view are
    real and reachable.
  - h3 now looks south from the ridge top over the windward face, which is a sensible view.
- **The authored crest: real, global and walkable, but placed by frames. Should-fix.**
  - The layout comment says "from the frame's right edge, far, down and left to near centre". Its far end sits 20 m
    from waymark 0, and the commit names C's frame ("C's second waymark burns on its rise in frame again").
  - So it is composed for A's and C's frames. It also breaks the field's own physics: a longitudinal ridge exactly along
    `WIND`, at right angles to every crescent.
  - It shows as a ridge in both aerials (projected crest points on a lit ridge line over a shaded pool), so it is no
    card or set. But it is a frame-driven landform, which round 13 already flagged. Fix it with finding 1.
- **The key swing: global, so no breach, but a frame-driven light.**
  - One `KEY` for the whole shard; no per-view switch.
  - It moved 78° to light a crest placed for A, and it now contradicts the sky's sun glow by 39°.
  - It is not a hidden grade, but it is the "tune a global to one frame" pattern, and it cost dusk-fire (Jake's pick).
- **Staged state: unchanged and reachable.**
  - `meta.staged` holds the same three entries. The one commit touching a stage-handler file (ea0b3939a) changes
    `keyAt` to `1 − 0.95·d^0.7`, which is monotonic and global.
  - The waymarks-lit stage now includes a brazier 25 m up a ridge. It is reachable on foot, as shown above.
- **Narrowing: none to help the views.** The regressions (the spawn foreground, B's backdrop) made the scored views
  worse, not better. No other place traded off for a view.
- **The viewmodel: shipped, the same hold in every frame, no debug state.** The glove's viewer-side light (`viewerLit`)
  is a material on the shipped model, not a shot trick.
- **Device and HUD: no breach.**
  - 390×844 touch, stored 780 wide, with the baseline HUD and the 30 fps chip in every scored frame.
  - `pageErrors: []`, `active: []`, 59 programs.
  - gpuMB 109.750 is re-recorded as a ratchet (+5 KB for the glove), inside the phone limits.
  - Frame time and total memory are not on this surface: unverified, not breached.

SCORE signal-dunes: 6.4
