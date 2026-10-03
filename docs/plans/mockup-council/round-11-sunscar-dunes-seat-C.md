# Round 11, seat C (Claude, red team), Signal Dunes

**What I reviewed:**
- The "Signal Dunes, round 11" section of `art/mockup-council/round-11/README.md` and its five sheets.
- The full-res frames in `progress/sunscar-dunes/20261003-0511-ea6ccc86/`: every `mock-*`, h1–h4, both aerials,
  `clip.mp4` at 1 fps, and `meta.json`.
- Round 10's `20261003-0432-0ae71b2a/`, for before and after.
- The five ledger mockups, Lanczos-scaled to 780×1688.

**Source checks:**
- `git diff 0ae71b2a ea6ccc86 -- src/shards/sunscar-dunes`, read at the captured SHA.
- Both captured `terrain.bin` bakes, decoded (256², 500 m) and sampled with the engine's bilinear lookup.
- `measure.py`, run on the capture.
- Every shot's camAt.

**How I measured:**
- All brightness is Rec. 709 luma on the decoded JPEGs.
- Clean sand is round 10's patch, **x 10–180, y 1150–1450**.
- Fine detail is mean |luma − luma blurred at σ 2 px|.
- Macro r is the Pearson r of σ-12 luma, mockup against game, over a named band.
- Regions are fractions of the portrait frame (x left → right, y top → bottom).

**The short version.** This is the best round yet, and most of round 10's red-team items are fixed honestly:
- The caravan halo is depth-tested and small. The wagon's arch, lantern and tailboard now read.
- The late-dusk land is no longer faded to black.
- D's fist is back out from under DODGE / JUMP.
- The near sand in dusk-fire, B, C and D is on target.
- C's fire has a real white-hot region.
- The builder's sand numbers reproduce at the capture.

**What still holds the score down:**
- A's near sand is still 35 % over its mockup.
- A's landform is not the mockup's.
- D's land is twice the mockup's value and has no bands.
- The glove got darker, away from its mockup.
- C has no logs, no billow and still the twisted post.

There is no breach that voids a score. One item is a new should-fix: the fill boost is a bump centred on B's staged dusk
value.

## Measurements (mockup / r10 / r11)

| View | Clean sand | Fine | Sky box (40,300)–(540,600) | Macro r, y 0.36–0.58 (mean diff) |
|---|---|---|---|---|
| dusk-fire | 73.4 / 80.3 / **72.7** | 9.3 / 10.1 / **9.5** | 75.9 / 112.8 / **93.4** | +0.37 → **+0.42** (18.1 → **13.1**) |
| A spawn | 55.6 / 82.7 / **75.2** | 9.3 / 11.0 / **10.4** | 88.3 / 107.7 / **87.5** | −0.00 → **+0.12** (31.8 → **25.8**) |
| B logbook | 38.9 / 31.1 / **34.4** | 2.3 / 3.4 / **2.9** | 50.1 / 47.1 / **46.5** | +0.61 → **+0.66** |
| C waymark | 32.2 / 36.1 / **33.4** | 1.1 / 1.8 / **1.8** | 52.5 / 50.0 / **50.3** | +0.60 → **+0.56** |
| D hands | 34.6 / 33.7 / **33.0** | 1.4 / 2.0 / **1.9** | 50.0 / 49.9 / **49.9** | +0.82 → **+0.73** (16.1 → **18.8**) |

`measure.py` on the capture gives the README's numbers exactly: dusk-fire 74.6, A 78.1, B 35.2, C 34.0, D 33.6. **The
builder's sand claims reproduce.**

### A and dusk-fire (the spawn)

**The grid** is luma, columns at x 0.1 steps, in rows of 0.04 from y 0.36.

- **A, y 0.40–0.44:**
  - mockup 35 41 38 61 **92 105 91** 69 45 43, a lit diagonal at x 0.4–0.7 between shaded flanks;
  - r11 **85 97 88** 78 72 64 49 36 32 34, lit at the left and shaded at the right: the opposite pattern.
- **A, y 0.52–0.56:**
  - mockup 88 93 94 87 69 **48 38 35 33 33**, a near crest lit left and shaded right;
  - r11 100 90 62 84 82 80 77 72 66 57, lit nearly all the way across.

**The glow,** by fifths of the frame width, mockup / r10 / r11:

| View, band | Mockup | r10 | r11 |
|---|---|---|---|
| A, glow y 0.31–0.34 | 103 / 118 / 113 / 147 / 162 | 118 / 133 / 144 / 155 / 157 | **85 / 103 / 118 / 129 / 131** |
| A, horizon strip y 0.345–0.365 | 70 / 63 / 40 / 67 / 71 | | **64 / 64 / 76 / 103 / 117** |
| dusk-fire, glow y 0.31–0.34 | 130 / 86 / 97 / 115 / 123 | 133 / 144 / 158 / 158 / 145 | **104 / 117 / 132 / 131 / 120** |

- A's hot spot now sits on the horizon, about 0.03 of the frame too low.
- dusk-fire still peaks in the middle, though it is closer than r10.

**The left horizon strip** (x 0–0.15, y 0.345–0.37), RGB:
- A: r10 132,92,77 → **r11 90,56,46**, mockup 89,58,61. The luma matches, but it now reads as a brick-red smear.
- The same dark red blot shows on h4's horizon and at the far left of aerial-spawn.

### B

| Region | Mockup | r10 | r11 |
|---|---|---|---|
| Wagon front, x 0.45–0.60, y 0.41–0.47 | 58.3 | 90.7 | **48.7** |
| Fine detail in the wagon box, x 0.40–0.70, y 0.38–0.52 | 9.45 | 5.94 | **6.56** |
| p99 in the same box | 200 | 210 | **208** |
| Land left of the camp, x 0–160 px, y 0.455–0.475 | 40.0 | 75.5 | **57.3** |
| Cargo, x 0.12–0.30, y 0.49–0.53 | 44.0 | 40.6 | **44.6** |
| Smoke column, x 0.45–0.60, y 0.15–0.35 | 52.2 | 46.1 | **46.0** |

The smoke column is unchanged: the wisp is still faint.

### C's fire (box x 150–450, y 350–900)

| | Mockup | r10 | r11 |
|---|---|---|---|
| Pixels over 150 | 13 733 | 17 112 | **12 131** |
| Their mean | 213 | 189 | **201** |
| Pixels over 230 | 5 557 | 2 060 | **3 387** |
| Pixels over 235 | 4 649 | 988 | **2 738** (59 %) |
| Pixels over 245 | 2 722 | 130 | **677** |
| Pool | 40.4 | 50.7 | **47.9** |
| Smoke region (40,170)–(200,260), RGB | 44,32,47 | 27,31,77 | **28,31,76** (still bare sky) |
| Column at the top (420,60)–(560,200) | 26.6 | 42.6 | **47.8** |

### D

| | Mockup | r10 | r11 |
|---|---|---|---|
| Afterglow peak (column x 300–500) | 170 at y 0.497 | 195 at y 0.478 | **173 at y 0.482** |
| Its RGB | 210,155,122 | 252,184,135 | **237,157,110** |
| Rows over 100 | 121 | 79 | **76** |
| Ground, x 0–0.5, y 0.52–0.62 | 16.0 | 38.2 | **39.9** |
| Glove (600,1130)–(780,1330): p95 | 71.6 | 49.4 | **42.7** |
| Glove: fine | 7.67 | 3.42 | **3.44** |

**D's rows, y 0.51–0.58,** at 0.01 steps:
- mockup 18 15 13 20 13 12 19 23;
- r10 30 22 21 25 25 27 27 27;
- **r11 35 29 28 32 33 34 35 37.**

### clip.mp4 (the late-dusk orbit, frames 1–10)

| | Ground (y 0.30–0.95) | Glow band (y 0.10–0.20) |
|---|---|---|
| r10 | 5.5–9.0 | 184 → 121 |
| r11 | **23.5–26.8** | 176 → 109 |

r9's ground was about 40. The dune forms read again in every frame.

## Signal Dunes (sunscar-dunes)

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` (Jake's pick) | **6.7** | 1. **Sky (x 0–1, y 0.10–0.36).** Closer: the box is 93.4 against 75.9 (r10 112.8). The clouds are now broken filaments, not caramel clumps. But they still sit on both sides, where the mockup has one grey-brown streaked bank at the right. A brick-red smear sits at the left horizon. There is no ray over the tower, and the keeper's flame is a pin-point. 2. **The tower dune's light (x 0–1, y 0.36–0.58).** Macro r is +0.42 and the mean difference 13.1, the best yet. The mockup's dome is a dark silhouette against the sky over a lit near slope. In ours the tower dune's face is lit, and the shade is a band at the upper right (y 0.38–0.46, x 0.5–1). r10's lit left shoulder is softer (row y 0.40: 68–78 against 52–66). 3. **Foreground (y 0.56–0.86).** The near sand matches (72.7 against 73.4, fine 9.5 against 9.3). The two upright braided rings still stand where the mockup has one low loose loop. Sefa stands at the left edge, where the mockup has none. |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.4** | 1. **The near sand (x 0–1, y 0.56–0.86).** Better, still the largest gap: 75.2 against 55.6 (r10 82.7), RGB 107,69,46 against 83,49,36. 2. **The landform (x 0–1, y 0.36–0.58).** The mockup's lit diagonal at x 0.4–0.7 between shaded flanks is mirrored: we are lit at the left, shaded at the right (grid above). r10's crisp lee crescent is gone: the reshaped crest line reads from the air but barely from here. Macro r is +0.12, the mean difference 25.8. 3. **Sky.** The box now matches (87.5 against 88.3), and the clouds are thin streaks. But the hot spot sits on the horizon (strip 103–117 against 67–71) and under at the mockup's height (129–131 against 147–162). The left horizon is a brick-red smear. The big upright rings and Sefa fill the mockup's open foreground. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **7.0** | 1. **The caravan (x 0.40–0.70, y 0.38–0.52): the round's best gain.** The halo wash is gone (front 48.7 against 58.3; r10 90.7). The turned wagon shows its open arch with the lantern inside, pale torn canvas and a tailboard, as the mockup does. Still off: the tailboard is a saturated red-orange plank, where the mockup's is dark weathered wood with the logbook on it. The arch's inside is near-flat dark (fine 6.6 against 9.5). The wagon sits right of the crosshair, where the mockup centres its tailboard on it. 2. **Smoke and land (x 0–0.6, y 0.15–0.48).** The land left of the camp is 57 against 40 (r10 75). The mockup's distinct pale smoke column rising straight from behind the wagon is a faint curl here (column 46 against 52). The dark tent at the right is absent. 3. **Sand and coil (y 0.55–0.86).** The sand is closer (34.4 against 38.9), but diagonal ripple bands still cross the near ground, where the mockup's is smooth. The rings are upright braided ovals, where the mockup has a broad low coil. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **6.9** | 1. **The fire (x 0.2–0.55, y 0.15–0.47).** A real gain: dense streaked licks and a white-hot region (pixels over 235: 988 → 2 738, 59 % of the mockup's). But the flame is smaller (12 131 pixels over 150 against 13 733; flame 3.6 → 3.0). The white region hides the bowl's fuel: the mockup's crossed logs with flame between them don't read. 2. **Smoke and embers (x 0–0.55, y 0.0–0.35).** The mockup's grey-brown billow drifting up-left is still bare sky (28,31,76 against 44,32,47). The wider plume shows only as a brown haze behind the notices at the top (column 47.8 against 26.6). The embers fly right, where the mockup's fly left. 3. **The brazier (x 0.3–0.5, y 0.45–0.62).** Still a twisted shaft on a pale cut-brick block, where the mockup has a straight worn post on a dark fieldstone drum. The coil covers the plinth's base. The sand (33.4 against 32.2) and the pool (47.9 against 40.4) are close. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.4** | 1. **The land (x 0–1, y 0.50–0.66).** Honest now, and wrong: rows 28–37 against the mockup's 12–23, rising lit slopes with no flat dark bands or lit stripe. The ground is 39.9 against 16.0. Macro r fell from 0.82 to 0.73, because removing the fade put back the true gap. 2. **The hero hand (x 0.4–1, y 0.55–0.86).** The fist is back above DODGE / JUMP (r10's regression fixed), and the plait has a darker strand with an edge sheen. But the glove is still a lumpy, crusted mitt with white flecks, and no fingers or seams read. It got darker, away from the mockup (p95 42.7 against 71.6; r10 49.4). The loops are big ovals across the centre, where the mockup's are slim loops beside a raised fist. 3. **The afterglow (y 0.44–0.50).** The peak and hue are closer (173 at 237,157,110 against 170 at 210,155,122), but it is still a thin band (76 rows over 100 against 121). The tower sits at x ≈ 0.93 under the SIGNAL TOWER chip; the mockup's is at x ≈ 0.84. |

**Seat score, Signal Dunes: (6.7 + 6.4 + 7.0 + 6.9 + 6.4) / 5 = 6.7.** This seat's earlier scores: 4.6, 5.1, 4.9, 5.2,
5.6, 5.3, 5.7, 6.1, 6.4, 6.4.

## Builder's claims checked

| Claim | Verdict | Evidence |
|---|---|---|
| Near sand: dusk-fire 74.6 / 73.8, A 78.2 / 57.4, B 35.2 / 39.7, C 34.0 / 32.3, D 33.6 / 34.5 | **True** | `measure.py` on the capture gives the same numbers. A is still 36 % over. |
| The glow line only in the late dusk | **True** | `smoothstep(0.3, 0.75, uDusk)`. A's horizon is still hot at the right, from round 10's `pow(toward, 9)` glow term, not from the line. |
| Far-land fill only from 30 m | **True, and still a camera-distance term** | `sil = smoothstep(30, 200, sandFar) * smoothstep(0.3, 0.75, uDusk) * 0.6` on the indirect light only; the key is untouched. The fog still lerps to near-black 0x110b16 from 80 m. Clip ground 7 → 25. See the ledger audit. |
| The lantern halo depth-tested, 0.5 m | **True for the caravan** | The `depthTest = false` line is gone, and the cloned `glowMaterial` tests depth. The caravan halo is 0.5 m. The keeper lamp's halo is still 2.6 m (now depth-tested), which the README doesn't mention. |
| Clouds as filaments, ranges darker | **True** | Streaked, holed banks. The ring haze is roughly halved (0.2 / 0.32 / 0.45 → 0.1 / 0.16 / 0.25). |
| Fire side tongues: pixels over 230, 828 → 2 403 | **Direction true** | In my window: 2 060 → 3 387. The windows differ, so I can't check the builder's absolute numbers. The flame was also shrunk (3.6 → 3.0), and pixels over 150 fell 17 112 → 12 131, below the mockup's 13 733. |
| The cookfire's wisp curls | **True, too faint** | B's column 46 against 52. Its alpha went down (0.45 → 0.38), while the mockup's column is the clearest smoke in the frame. |
| Plait sheen; gauntlet darker | **Sheen true; darker moves away** | The glove's p95 went 49.4 → 42.7 against the mockup's 71.6. Hue is not the gap; value and folds are. |
| Hold at y −0.245 | **True** | D's fist is clear of DODGE / JUMP again. |
| "Staging and the dusk values are unchanged" | **True as worded; omits a change** | `duskOf` is unchanged. But `fillAt` gained `+0.7·exp(−((d−0.5)/0.12)²)`, so the light at the staged values changed (finding 5). |

## Findings, ranked by score gained

1. **A's near field and landform (A; x 0–1, y 0.36–0.86).** *Repeated since round 1.*
   - The sand is still 75 against 56. The terrain-shading cut (×0.82 → 0.72) and the key (2.3 → 2.05) fixed dusk-fire
     but left A 20 over.
   - The two views share one spawn and one ground, so the rest must come from form, not exposure.
   - The mockup's lit diagonal at x 0.4–0.7 at y 0.40–0.44 sits between shaded flanks. Ours is lit left and shaded
     right.
   - Fix: give the near slope in A's frame (y 0.52–0.56, x 0.5–1) a face turned from the key, so it reads in shade
     (mockup 33–48, ours 57–80).
   - Do not reshape the crest line a fifth time (finding 6). The patch that matters is the nearer ground.
2. **D's land (D; x 0–1, y 0.50–0.66).** *Repeated; the true gap is back now that the fade is gone.*
   - Rows 28–37 against 12–23, with lit rising slopes.
   - The mockup's late land is flat dark bands with one lit stripe. That is form plus a key from behind the bands.
   - Fix: at late dusk, darken the faces turned from the glow (normal · glow direction, keyed on `uDusk`) and keep a
     narrow rim on the crests.
   - Check the clip keeps its forms. Do not bring back a distance fade.
3. **The hero glove (D, every view; x 0.6–1, y 0.6–0.86).** *Repeated, value regressed.*
   - p95 42.7 against 71.6, fine 3.4 against 7.7.
   - The darkening went the wrong way. The mockup's glove is lighter, worn brown leather with knuckle folds and seams.
   - Fix: take the base value back up, and put the detail in hand-scale normal folds, not in albedo crinkle.
4. **C's fire, smoke and brazier (C; x 0–0.55, y 0.0–0.62).** *Repeated, improving.*
   - Return the flame's height (3.0 → about 3.4) so the over-150 area meets the mockup's.
   - Keep the white region low and narrow enough that the logs show through it.
   - Add the billow up-left, and send the embers left with it, where the mockup's go.
   - The post and the plinth: straight, worn and dark (fieldstone), as three rounds of seats have asked.
5. **The fill bump at B's dusk (B and everything at dusk 0.5–0.62).** *New, should-fix (ledger audit).*
   - `fillAt` now peaks exactly at 0.50, the value `stage('logbook')` snaps to, at 1.72× the fill. It falls back to
     about 1.05× by two lit waymarks.
   - It is real state, held through the Sefa, logbook and oil steps. But it makes the sky fill rise by 70 % while the
     key falls, so the evening's shade brightens, then darkens again.
   - It bought B's sand only 3.3 luma (31.1 → 34.4).
   - Fix: replace it with a monotonic fill curve, or reach B's sand through the near-sand material at that dusk.
     Measure B and the clip together.
6. **The crest line: stop moving it (A, dusk-fire, aerials).** *Process, should-fix.*
   - Its fourth and fifth shapes in two rounds (d97e223c4, 84a9e99f6, e62382ae4), each aimed at A's frame.
   - The claim that its steep lee faces the spawn is not true in the bake. Across the crest at t 0.5, the spawn side
     falls 3.4 m over 15 m (13°), and the far side 5.7 m over 20 m (16°) into the new trough. The field rises toward
     the spawn, so the "lee" is the gentle side.
   - It now reads as a dune from aerial-spawn, but not from A or h1.
   - Fix: leave the ridge where it is and work the near ground (finding 1).
7. **The spawn sky (A, dusk-fire, h4; y 0.30–0.37).** *New (low band), repeated (hot spot).*
   - The dusk-0 band's gain went 0.78 → 0.5. It turned the left horizon brick-red (A 90,56,46 against the mockup's
     89,58,61; a dark red strip on h4).
   - A's hot spot sits about 0.03 of the frame too low.
   - Fix: lift the low band's hue toward orange at the left, not its value. Raise the `pow(toward, 9)` glow's height
     cut (`smoothstep(0, 0.16, h)`) so it peaks at A's y 0.31–0.34.
8. **B's smoke and tailboard (B; x 0.45–0.65, y 0.15–0.50).** *Repeated (smoke), new (tailboard).*
   - Give the cookfire wisp back its opacity: the mockup's column is the clearest smoke in the frame.
   - Take the tailboard from saturated red-orange to dark weathered wood.

## Ledger-5 audit

- **Views: no breach.**
  - The cameras blob is the same (a4219aa3). camAt is identical for all five `mock-*` shots.
  - h3 dropped 0.28 m and h4 0.16 m with the terrain. h3 is in the crest's changed region (x −26.5..69.6,
    z −63.7..46.1), where the trough lowered it. The README names both.
- **Round 10's should-fix 1, the far-land fade: resolved, with a note.**
  - It no longer fades to black: the key's diffuse is untouched, and the cut is only to the sky fill, from 30 m, at
    most 60 %. The late clip's ground went 5.5–9.0 → 23.5–26.8, and the dunes read again.
  - It is not "real lighting" in the strict sense. It is still a camera-distance attenuation, a dark aerial
    perspective, alongside the fog lerp to near-black from 80 m.
  - As a global night-haze term past every near patch, it is acceptable.
  - The proof that it no longer hides a form gap: D's land got honestly brighter (finding 2).
- **Round 10's should-fix 2, the lantern halo: resolved.**
  - `lampGlowMaterial` no longer sets `depthTest = false`, and the cloned `glowMaterial` tests depth.
  - The caravan halo is 0.5 m. B's wagon front is 48.7 against 58.3, and h2 shows a readable arch.
  - The keeper lamp's halo stays 2.6 m (now depth-tested): nit, not disclosed.
- **The crest line: real, walkable, global terrain, so no breach.**
  - In the captured bakes: up to 8.74 m raised and 2.15 m cut. Steepest cell 37.6° at (44, 34), with 10 cells over
    35° and none over 40°.
  - The spawn trails' grades are 15.0° to the tower, 15.2° to the caravan and 19.2° to the well. The navmesh is
    re-baked.
  - It is now a free-standing ridge (round 10's was a terrace): at t 0.5 the crest is 3.4 m over the spawn-side
    hollow and 5.7 m over the far trough.
  - It reads as a long dune with a shaded face in aerial-spawn. The overview still shows hard-edged dark ovals at its
    south end (round 10's nit, repeated).
  - Red-team note: it has been reshaped every round for mockup A (finding 6), and the claim about its steep side is
    wrong.
- **The caravan turned 180°: a sensible world placement, so no breach; it fixes an inconsistency.**
  - The lantern, the logbook (−Z in the caravan frame) and the cookfire (+Z) were already placed for an open back at
    −Z. The generated model's open end faced +Z, so the lantern hung at the wagon's closed front.
  - The turn puts the arch where the logbook is.
  - The spawn → caravan trail arrives along (−0.86, −0.51) at (−70, 32), the same heading as h2 and B. So the open
    back faces the walk a player actually takes, and the tailboard is at the trail's end.
  - The body collider is a symmetric box, unchanged by the turn.
- **The fill bump at dusk 0.5 (commit 52142e83c): should-fix, not void.**
  - It is global and keyed to quest state a player holds for minutes (Sefa met, then logbook and oil: 0.50 to 0.56).
  - But it is a Gaussian centred on the exact value B's stage snaps to, and it makes the fill non-monotonic over the
    evening.
  - The README's "dusk values unchanged" does not mention it (finding 5).
- **Staged state: unchanged and reachable.**
  - Staging code is identical, and `duskOf` is unchanged. `meta.staged` is the same three entries.
  - Round 9's and round 10's reachability analysis holds.
- **Global look: no per-view switches.** The key, terminator, fill, sky, clouds, haze, fire, halo, cloth, hold, plait
  and glove are all shard-wide.
- **No narrowing:**
  - h2 gained (no wash, a readable wagon).
  - h3 is unchanged apart from the coil over the plinth.
  - h4's horizon has the red smear (finding 7).
  - The clip regained its forms.
- **Device and HUD: no breach.**
  - 390×844 phone and touch, stored 780 wide, with the baseline HUD in every scored view.
  - The 30 fps chip shows; `pageErrors: []`; 59 programs (r10 58).
  - Frame time and total memory are not on this surface, so they are unverified, not breached.

SCORE signal-dunes: 6.7
