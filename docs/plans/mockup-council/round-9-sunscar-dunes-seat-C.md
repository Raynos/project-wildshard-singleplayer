# Round 9, seat C (Claude, red team), Signal Dunes

Surface: the "Signal Dunes, round 9" section of `art/mockup-council/round-9/README.md` and its five sheets; the full-res
frames in `progress/sunscar-dunes/20261003-0356-544f6b56/` (every `mock-*`, h1–h4, both aerials, `clip.mp4` at 0.5 fps,
`meta.json`); round 8's `20261003-0322-0cd1ecbb/` for before and after; the five ledger mockups at full resolution, scaled
to 780×1688. I built mockup | r8 | r9 triptychs per view and per region. Source checks: `git show` of the six shard commits
the README lists (8a6b91e24, a6e2b238c, 60ee041c4, a2efe88ad, fc2d157d9, 8460576f3) and `git diff 0cd1ecbb 544f6b564`.
I also decoded both baked `terrain.bin` files (24-byte header, f32 heights, 256², 500 m) and sampled them with the
engine's bilinear lookup. All brightness is Rec. 709 luma. Clean sand is the seats' patch **x 10–240, y 1150–1450**, and
fine detail is mean |luma − Gaussian-blurred luma| (σ 2 px). Regions are fractions of the portrait frame (x left → right,
y top → bottom).

**The short version.** Four of round 8's gaps closed in the pixels:
- B's framing is fixed (the lantern at x 0.50; the mockup has it at 0.52).
- C's brazier now stands against open sky.
- D's zenith no longer clips red to 0.
- A's sky is down to the mockup's brightness, with low horizontal banks.

Three things cut against that:
- The global hand change was tuned to mockup D, and it moved the coil away from the other four mockups.
- The new key light made dusk-fire's near grain overshoot. Dusk-fire was the one view that was on target.
- The new fire is bigger but soft and peach, with no hot core. Several builder claims (the core, the dark plume, the
  glove's creases, the sand light) don't show in the pixels.

I found no ledger-5 breach. The waymark rise is real and walkable. It filled a bowl; it does not stand as a pedestal.

## The measurements (mockup / r8 / r9)

| View | Clean sand mean | Spread p95−p5 | Fine detail | Clean sand RGB (mockup / r9) |
|---|---|---|---|---|
| dusk-fire | 72.0 / 68.2 / **63.4** | 69 / 83 / **78** | 8.9 / 9.3 / **11.1** | 108,64,39 / 98,56,32 |
| A spawn | 56.2 / 70.5 / **67.8** | 78 / 90 / **82** | 9.2 / 12.7 / **12.0** | 84,49,36 / 103,60,35 |
| B logbook | 39.0 / 38.2 / **41.6** | 23 / 32 / **37** | 2.3 / 3.4 / **4.0** | 60,33,27 / 62,36,31 |
| C waymark | 32.4 / 40.2 / **41.8** | 15 / 39 / **33** | 1.1 / 2.0 / **1.8** | 51,27,22 / 66,35,30 |
| D hands | 34.5 / 38.1 / **38.3** | 32 / 31 / **28** | 1.3 / 2.1 / **1.9** | 49,30,27 / 57,33,30 |

**Sky box (40,300)–(540,600), mean luma:**

| View | Mockup | r8 | r9 |
|---|---|---|---|
| A | 88 | 114 | **93** |
| dusk-fire | 76 | 96 | **94** |
| B | 50 | 49 | **47** |
| C | 53 | 50 | **50** |
| D | 50 | 41 | **50** |

**Zenith (250,170)–(450,205), RGB and minimum R:**

| View | Mockup | r8 | r9 |
|---|---|---|---|
| D | 18,23,60 | 0,22,97, R min 0 | **30,34,82, R min 27** |
| A | 29,30,58 | 61,46,73 | **36,29,59** |
| C | 22,26,62 | 51,52,91 | **55,53,82** |

C's box lies under the pale smoke column (see C below). Away from it, at (40,170)–(200,260), C reads 27,30,76 against the
mockup's 43,32,47 (the mockup's smoke).

**The dune band, row means at x 5–60 %.**
- A, y 0.40 / 0.44 / 0.48 / 0.52 / 0.56:
  - mockup 65 / 42 / 46 / 79 / 89: shade, then the lit crests;
  - r9 51 / 44 / 60 / 62 / 53: one flat mid-tone.
- dusk-fire:
  - mockup 53 / 63 / 70 / 77 / 82: the lit left shoulder;
  - r9 35 / 32 / 49 / 63 / 58.

**The C fire** (box x 150–450, y 350–900):

| | Mockup | r8 | r9 |
|---|---|---|---|
| Pixels over luma 150 | 13 733 | 7 662 | **15 884** |
| Mean of those pixels | 213 | 181 | **180** |
| Saturated orange | 8 441 | 7 202 | **12 786** |
| White-hot (> 235) | 4 649 | 420 | **311** |
| Pool (x 150–450, y 1060–1150) | 40 | 64 | **59** |

- RGB of the bright pixels: mockup 248,210,143; r9 216,175,122.

**D's afterglow, column x 300–500:**

| | Peak | At y | RGB | Rows over 100 |
|---|---|---|---|---|
| Mockup | 170 | 0.50 | 204,147,114 | 121 |
| r8 | 154 | 0.50 | 206,129,70 | 107 |
| r9 | **130** | 0.48 | **207,112,60** | **99** |

**D's ground (x 0–0.5, y 0.52–0.62):** mockup 16 (26,12,15), r8 64, r9 **47** (69,41,36).

**D's glove (600,1130)–(780,1330):**

| | Mockup | r8 | r9 |
|---|---|---|---|
| p95 | 71.6 | 49.5 | **49.5** |
| Fine detail | 7.7 | 3.5 | **3.2** |

Mean |r9 − r8| on the glove is 2.4 luma.

## Signal Dunes (sunscar-dunes)

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` (Jake's pick) | **6.4** | 1. **The shade's shape (x 0–1, y 0.38–0.60).** The tower dune is now a broad low mound (a gain), but its face is a soft dark wedge with a vertical left edge under the tower (rows 32–35). The mockup's diagonal sweep of shade from the tower's foot sits over a bright raked left shoulder (53–82), and the game has no lit shoulder or crest line. 2. **The near sand and the coil (x 0–1, y 0.56–0.86).** The sand fell further from the mockup (63.4 vs 72; r8 68.2). The grain went from on target to overshooting (11.1 vs 8.9; r8 9.3). The coil is now two thin, near-vertical rings held centre-right. The mockup has one medium-thick loose loop held low-left. 3. **The sky (y 0.10–0.38).** The smears are gone and the banks are low and horizontal, as asked. But there are banks on both sides, where the mockup has one grey-brown bank at the right only. The box is still 94 vs 76, the band at y 0.32 is 122 vs 72, and the flying creature over the tower is absent. |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.3** | 1. **One mound, not receding crests (x 0–1, y 0.34–0.60).** The tower is smaller and the mound broader (gains). The face is still one soft-shaded mass (rows 44–62). The mockup's three or four knife-edge diagonal crests (lit 79–89 inside 42–46 shade) are absent. 2. **The hand (x 0.30–1, y 0.55–0.86).** The cord is now about a third of the mockup's thickness by eye. The mockup has two thick rings rising from the bottom edge. The glove is a lumpy dark mass where the mockup has a simple lit leather hand. 3. **The sand and the cloud colour (y 0.6–0.86; y 0.15–0.32).** The near sand is still 12 too bright (67.8 vs 56.2) with crunchy grain (12.0 vs 9.2). The sky box is now right (93 vs 88), but the banks are thin mauve-grey wisps where the mockup's are broken red-orange. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **6.5** | 1. **The camp's materials (x 0.15–0.95, y 0.42–0.55).** The framing is fixed: the wagon spans x 0.44–0.69 against the mockup's 0.42–0.67. The crates and sacks left of the wagon are still black slabs with no lit faces. The lantern has a small glow that lights nothing around it. The cloth is the blotchy cream-and-brown. 2. **The ground's light (x 0.05–0.6, y 0.44–0.60).** The rows round the camp read 87 / 54 / 65 / 50 / 50 against 56 / 47 / 42 / 42 / 38. The clean sand drifted up (41.6 vs 39; r8 38.2). The horizon glow is weaker and lower (y 0.40: 81 vs 103). 3. **The coil (x 0.33–0.85, y 0.55–0.86).** It is two thin rings held from the right. The mockup's two thick rings rise from the bottom edge across most of the width. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **6.5** | 1. **The fire (x 0.25–0.55, y 0.22–0.47).** The bright area now exceeds the mockup's (15 884 vs 13 733) and is saturated orange. But it is a soft peach sprite with a blurred halo: white-hot 311 vs 4 649 (r8 420), and the mean of its bright pixels is 180 vs 213. The logs don't read through it. There is no billowing grey-brown smoke up-left. Instead a pale column still crosses the top of the frame (box (420,60)–(560,200) 55 vs 27), and the embers stream up-right. 2. **The plinth and the post (x 0.33–0.48, y 0.45–0.62).** The bowl is soot-dark (a gain). The post and plinth are still a twisted copper post on a clean brick block, where the mockup has dark iron on a fieldstone drum. 3. **The sand light (y 0.55–0.86).** The clean patch is 41.8 vs 32.4 and the pool 59 vs 40, so the overshoot the builder said was fixed is still there. The backdrop gap is closed: the bowl is against open sky, and rows y 0.36–0.40 read 91 / 118 against 98 / 122 (r8 58 / 64). |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.3** | 1. **The land (x 0–1, y 0.50–0.65).** The ground is mid-brown, 47 against the mockup's near-black bands (16), with a big rising slope at the right where the mockup has long flat parallel bands. The raised west waymark now burns in frame at x 0.28, a gain toward the mockup's far-left fire at x 0.06. 2. **The afterglow (y 0.42–0.52).** The zenith and the sky box are fixed (50 vs 50, R no longer 0), and the stars are crisp points. The band is still a thin saturated orange (207,112,60, peak 130) where the mockup's is broad peach (204,147,114, peak 170). It has not widened (99 rows over 100 vs 121). 3. **The glove (x 0.75–1, y 0.66–0.80).** The slimmer cord and the two loops set apart now match this mockup. The glove is unchanged in the pixels: p95 49.5 vs 71.6, fine 3.2 vs 7.7, mean change 2.4 luma. It has no creases, crackle or worn highlights, and the fingers are still beads. |

**Seat score, Signal Dunes: (6.4 + 6.3 + 6.5 + 6.5 + 6.3) / 5 = 6.4.** This seat's earlier scores: 4.6, 5.1, 4.9, 5.2,
5.6, 5.3, 5.7, 6.1.

## Builder's claims checked

| Claim | Verdict | Evidence |
|---|---|---|
| B yaw 48.3 → 56.7 puts the lantern at ~0.5 | **True** | The lantern is at x 0.50; the mockup has it at 0.52. |
| Dusk-fire pitch −12.5: horizon ~0.35 | **True** | The dune/sky edge is between rows 0.32 (122) and 0.36 (52). The mockup's is at ~0.34. |
| D pitch −2: horizon ~0.51 | **True** | The afterglow peaks at 0.48 and the ground starts at ~0.50 (mockup 0.50). |
| A and dusk-fire clean patch 66.5 / 62.2, fine 11.8 / 10.9 | **Reproduces within 1.3** | I measure 67.8 / 63.4, fine 12.0 / 11.1. |
| "The near grain clumps a quarter less" | **The cut is in the code, but not in the pixels** | The grain weights are ×0.75 (render.ts), but the new key raised the relief. A's fine detail fell only 12.7 → 12.0, and dusk-fire's *rose* 9.3 → 11.1 (mockup 8.9). |
| The fire: 3.6 m, wider, "a larger core low over the logs" | **Size true, core false** | Bright area 15 884 vs 13 733. White-hot fell 420 → 311 (mockup 4 649). |
| Embers dash along their own motion | **True** | The dashes now follow the up-right drift. |
| "The plume dark brown, lit only at its foot" | **Partly** | No dark plume reads near the fire. The high column across C's top centre is still pale (55 vs the mockup's 27 sky). |
| The fire's light on the sand at 0.18 (C's patch "44 against 32") | **Not fixed** | Clean patch 41.8, pool 59, against 32.4 / 40. |
| The cord 0.03, two taller loops a little apart | **True** | It matches mockup D. It moves away from A, B, C and dusk-fire, whose cords are about 2.5× thicker by eye. |
| A sheen on each strand's crown; the glove's crease octave and deeper bump | **Not visible** | D's glove barely changed: mean \|Δ\| 2.4, p95 49.5 → 49.5, fine 3.5 → 3.2. No crown highlight shows at 780 px. |
| The D zenith and the stars | **True** | 30,34,82 with R min 27; crisp star points. |
| D's afterglow "155,88,78 against 160,103,99 at 42–48 %" | **Does not reproduce on x 5–60 %** | I measure 176,93,64 vs 177,117,98 at y 0.44–0.48; the column peak is 207,112,60 vs 204,147,114. The hue is still too saturated. |
| 8a6b91e24: "every mock camera outside its reach … no real camera moved" | **False for a hero view** | h4-tower-deck's real camera dropped 2.91 m (27.35 → 24.44; the tower stands on the lowered dune). The README's real-camera list omits it. |
| a6e2b238c: the dunes "0–1° over the eye across the frame's middle" | **True** | On the baked r9 terrain from C's eye (12.55 m): at the centre the highest terrain is +1.3° (75 m), and +1.0° at 15° right. At 15° left (near the frame edge) it is +4.5°. In r8 these were +8.6° / +4.5° / +14.5°. |

## Findings, ranked by score gained

1. **The landform in A and dusk-fire (y 0.34–0.60): crests with crisp lit edges, not a soft wedge.** *Repeated since
   round 1.*
   - The key is now from the WNW, and the broad mound shades as one soft-edged dark wedge hanging under the tower. The
     same wedge is plain in `aerial-spawn` and `aerial-overview` (round 8 had a clean dome shade).
   - The mockups show two or three diagonal knife-edge crests between the spawn and the tower, each lit on its west face.
     dusk-fire also shows a bright raked left shoulder.
   - Build those crests in the dune field (`dunes.ts` / `layout.ts`, re-baked, climb test). Then make the shade edge
     follow the crest line: a sharper shadow edge, or a terminator from the slope normal rather than a soft cast-shadow
     blur.
   - Check the result from h1 and both aerials, not only the mock views.
2. **The coil and the glove: per-mockup proportions, not one tuned to D.** *Regression (A, B, C, dusk-fire), partly
   repeated.*
   - The 0.048 → 0.03 cord matched D and made the cord about 2.5× too thin in the other four. The two near-vertical
     rings now sit centre-right in every view.
   - The mockups differ by pose, not by rope:
     - A and B: thick rings entering from the bottom edge;
     - dusk-fire: one loose diagonal loop held low-left;
     - D: tall slim loops in a raised fist.
   - Pick a cord between the two (~0.04), and give the idle hold the lower, looser pose that four of the five mockups
     show.
   - The glove: the deeper crease octave left no trace at 780 px. It needs worn highlights near luma 70–115 and creases
     visible at hand scale (a lower-frequency normal map with real amplitude, or a lit-edge term), and finger joints.
3. **The fire (C, every lit brazier; x 0.25–0.55, y 0.22–0.47).** *Repeated, half fixed.*
   - The size is now right. What is missing:
     - **A hot core:** target ~4 600 pixels over luma 235, against 311 now. Put a white-yellow core low over the logs.
     - **Crisp tongues** instead of the soft premultiplied halo.
     - **The logs reading** through the flame.
     - **A grey-brown billowing plume** near the fire.
   - Take the pale column out of the upper sky: it is 55 against 27 at the top centre.
   - The pool and the sand light still overshoot (59 / 41.8 against 40 / 32.4). Lower the fire's sand light again and
     check it on the clean patch.
4. **D's land and afterglow (y 0.42–0.65).** *Repeated.*
   - The ground under the horizon is 47 against 16. The mockup's long flat bands are near-black under a lit sky. Darken
     the blue-hour fill on the far sand, since the late views share it.
   - Widen the afterglow to rows ~0.44–0.51, and move its hue from 207,112,60 to ~204,147,114.
5. **Dusk-fire's and A's near sand (y 0.6–0.86).** *Regression (dusk-fire), repeated (A).*
   - The new key pushed dusk-fire away from its target: 63.4 vs 72, fine 11.1 vs 8.9. A is still too bright (67.8 vs
     56.2) and crunchy (12.0 vs 9.2).
   - The two mockups disagree on the same ground, so don't chase both with one gain. Cut the grain relief (the
     `grainSlope` normal tilt, not only the albedo grains) until dusk-fire's fine detail is back to ~9.
6. **B's camp (x 0.15–0.95, y 0.42–0.60).** *Repeated.*
   - The lantern's light should fall on the tailboard and the crates.
   - The crates need boards with lit faces.
   - The ground round the camp should drop to the mockup's 42–47 band.
   - The horizon glow should rise to ~100 at y 0.40.
7. **C's plinth and post.** *Repeated.* Dark iron post and fieldstone drum (the mockup), not twisted copper on a brick
   block.
8. **Process: list hero-view camera moves too.** *New, should-fix.* The real-camera list in the README is generated
   from the `mock-*` views only. h4's 2.91 m drop went unlisted, and a commit message claimed no camera moved. Extend the
   camAt diff to every shot.

## Ledger-5 audit

- **The west waymark's rise (a6e2b238c): no breach.**
  - Real, walkable, global terrain. The pad lift is 10 m (flat r 6 m, eased over 46 m), and the baked ground at the
    brazier went from 0.79 m to 10.79 m.
  - It is not a pedestal. It filled a bowl to the level of the dunes around it: radial profiles reach 5–18 m within
    65 m.
  - The maximum slope within 60 m fell from 37.9° to 22.4°. Straight walks to it: from the spawn 14.5° max, from the
    caravan 8.9°, from the tower 20.1°, from the east waymark 6.3°. All are under the 40° climb.
  - The navmesh was re-baked (detail tris 1270 → 1222).
  - C's eye is 1.70 m over the new ground (10.85 m), so the camera rose with the land, not on its own. The rise is named
    in the README.
  - It also shows from D's view, which gains the burning waymark its mockup has. So the edit works off-shot, not only
    for C.
  - Red-team note: the builder lifted only this waymark and left the east one flat "because it stands in the spawn
    views". The shaping is world geometry a player walks and sees from everywhere, so it passes. But it was chosen per
    mockup, and the next seats should keep checking it from the hero views and the aerials.
- **Re-aims: no breach.** B's yaw cures round 8's breach (the lantern at 0.50 against 0.52). The dusk-fire and D
  pitches each move their horizon onto the mockup's (verified above).
- **Staged dusk values: reachable.**
  - `duskOf`: Sefa 0.50, logbook 0.52, oil 0.56, waymarks 0.62 / 0.74 / 0.86, signal 1. It is monotonic.
  - `stepDusk` moves 0.02 per second.
  - B's `logbook` stage sets only Sefa's flag, so 0.50: a player walking to the logbook has it.
  - C settles at 0.74, then lights the last waymark. 3 s later play gives 0.74 + 0.06 = 0.80.
  - D's 11 s settle caps at 0.86.
  - `stage()` is unchanged between the captures. Only the table changed, and every value is one play produces. The
    round-8 analysis (any lighting order, the whip's 7–8 m reach) still holds for C's frame.
- **Global look changes: no view-only switches.**
  - The key from the WNW, the sky banks, the grain and the fire are all shard-wide.
  - Red-team note: the key now comes from ~60° away from the glow (SUN_GLOW just east of north, KEY from ~53° west of
    north), so every cast shadow points ESE under a northern sunset. It follows the mockups' lit west faces, and it is
    global, so it is not a breach. But it is a grade chosen for the views, not for a sun, and the aerials' soft wedge
    comes from it.
- **No narrowing found.**
  - h1–h3 are near-identical to round 8.
  - h4's tower deck is 2.9 m lower (process gap, finding 8).
  - The clip keeps its fires and dusk. Its afterglow band is a little redder.
- **Device and HUD: no breach.** 390×844 phone and touch, stored at 780 wide; the baseline HUD in every view; the
  30 fps chip; `active: []`; page errors 0. The README reports parity green (walk 0 stuck, gpuMB within the 108.99
  ceiling). This surface has no frame-time trace, so that point is unverified, not breached.

SCORE signal-dunes: 6.4
