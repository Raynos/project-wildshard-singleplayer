# Round 21, seat C (Claude, red team), Signal Dunes

**What I reviewed:**
- `docs/process/COUNCIL.md`, the ledger (the 7.0 bar, the phase amendments), the brief, `scores.md` (the camera-distance
  rule, the key ruling and the new fog ruling), and round 20's seat A, B and C files.
- The "Signal Dunes, round 21" section of `art/mockup-council/round-21/README.md` and its five sheets.
- Every frame in `progress/sunscar-dunes/20261003-1206-21fe6dbf/` (`mock-*`, `first-frame`, h1–h4, both aerials,
  `clip.mp4` at 1 fps, `meta.json`), each against round 20's `20261003-1134-e4d15d35/`.
- The five ledger mockups, Lanczos-scaled to 780×1688.
- Source, read-only: `git show` of 26b822665, 52d05dae0, f4effe449, 28a1cf5f1 and 234085dba; `look/render.ts` at
  21fe6dbf4, `look/dusk.ts`, `src/engine/world/Atmosphere.ts` (the fog chunk), `src/engine/world/skyRig.ts` (where the
  fog is created and bound), `src/engine/core/Game.ts` (the order of `buildSky` and `compose`), the baked `terrain.bin` at
  e4d15d354 and 21fe6dbf4, and `progress/physics/`.

**How I measured:** the same tools and regions as my round-20 file; its r20 numbers reproduce exactly (A's lit diagonal
48.7, A's row-demeaned r +0.22, dusk-fire +0.38, C's core 294 over 245).
- Rec. 709 luma on the decoded JPEGs; **sat** = mean (max − min) / max; **h** = hue of the region's mean colour;
  **B/R** = mean blue over mean red.
- **Row-demeaned r:** the Pearson r of a 10×7 grid of σ-12 luma over the dune band (y 0.36–0.56), each row's mean removed.
- **Warm-lit share:** pixels with hue < 35° or > 350°, sat > 0.4 and Y > 55. **Lilac share:** hue 240–330°.
- Regions are frame fractions (x left → right, y top → bottom).

## The short version

- **The fog change washed the whole dune sea lilac.** The captured build's distance fog is one colour, `0x5e5288`
  (luma ~88), at every dusk. The README says it goes to `0x1a1733` late, but that code never runs: see the audit. The fog
  is 0.0028 /m, so the dunes 40–150 m out take 10–35 % of a bright violet.
  - **A and dusk-fire** keep a warm floor under lavender dunes. The warm-lit share in the dune band fell from 53 / 30 %
    to 13 / 11 % (A, left / right; mockup 35 / 26 %) and from 39 / 22 % to 11 / 11 % (dusk-fire; mockup 60 / 33 %).
    The lilac share rose to 60–69 %.
  - **C and D**, the late views: the far land went up, not down. C is 32 → 56 against 16, D 41 → 50 against 16, and
    D's far right 29 → 50 against 23.
  - **The late clip's ground doubled**, 24–31 → 50–53, in a milky lavender (B/R 1.35). The aerial overview's land went
    from 36 to 86.
  - The lead's first look ("milky lilac") is right, and it is worse than a look suggests in the late views.
- **Real gains:**
  - **The coil hangs low.** The handle stick is gone from view, the ring sits at y 0.66–0.83, and nothing crosses C's
    plinth or B's cargo line. This is the first hold change in many rounds that moves toward all five mockups.
  - **C's upper sky** is violet-navy (36.5, sat 0.52; mockup 43.5, 0.38; r20 22.9, 0.86).
  - **C's white-hot core** is 2 086 px over 245 (mockup 2 732; r20 294). The tongues stay orange.
  - **B's band** moved toward orange (h 359 / 5; r20 339 / 353; mockup 12 / 18).
  - **h2's red pool** under the wagon is gone.
- **Builder claims that fail:** dusk-fire's r "+0.31" measures +0.10 (r20 +0.38). "The lantern amber, not red": B's pool
  is h 356, pink. "B's wisp over the wagon": it rises at x 0.71, at the wagon's right rear (mockup 0.53). The README's
  "never toward black" rests on a late lerp that does not run.
- **Ledger 5: no breach, no void.** The fog is the engine's fog at one density, and it goes lighter, not toward black.
  But it is a global term that raises luma in exactly the boxes the builder scores (A's diagonal box 48.7 → 64.4 at h
  312 against the mockup's h 20) while the colour moves away. That is metric gaming by instrument, not by intent.

## Measurements (mockup / r20 / r21)

| View | Region | Mockup | r20 | r21 |
|---|---|---|---|---|
| A | Lit diagonal, x 0.4–0.7, y 0.40–0.44 | **96.7** h 20, B/R 0.32 | 48.7 h 357 | **64.4 h 312, B/R 0.95** |
| A | Tower mound, x 0.45–0.75, y 0.38–0.42 | 73.1 h 15 | 44.1 | 65.6 **h 285** |
| A | Mid dunes right, x 0.55–1, y 0.38–0.47 | 60.8 h 11, B/R 0.53 | 46.6 | 66.8 **h 325, B/R 0.87** |
| A | Left lee, x 0–0.3, y 0.40–0.50 | 39.6 | 58.0 | 52.8 |
| A | Far strip left, x 0–0.4, y 0.375–0.395 | 71.7 h 15 | 87.0 | **100.3 h 339** |
| A | Far strip right, x 0.6–1, y 0.385–0.405 | 38.2 | 52.0 | **70.3** |
| A | Clean sand / near floor | 56.7 / 70.4 | 70.5 / 89.1 | 71.4 / 90.3 |
| A | Warm-lit share, band left / right | 35 / 26 % | 53 / 30 % | **13 / 11 %** |
| A | Row-demeaned r (y 0.36–0.56; 0.38–0.52; 0.34–0.60) | | +0.22; −0.03; +0.22 | **+0.58; +0.42; +0.50** |
| A | Edge y at x 0.1 … 0.5 | 0.37 0.39 0.40 0.42 0.44 | 0.40 0.41 0.45 0.54 0.55 | 0.41 0.40 0.40 0.39 0.52 |
| dusk-fire | Lit shoulder, x 0–0.35, y 0.50–0.70 | 82.9 h 22 | 77.7 | 79.6 h 11, sat 0.49 |
| dusk-fire | Saddle, x 0.55–0.9, y 0.46–0.56 | 49.5 h 13 | 45.9 | 55.1 **h 305** |
| dusk-fire | Mid dunes left, x 0–0.45, y 0.40–0.50 | 62.5 h 18 | 48.6 | 54.8 **h 307** |
| dusk-fire | Far strip right, x 0.6–1, y 0.37–0.40 | 34.5 | 45.2 | **64.8** |
| dusk-fire | Warm-lit / lilac share, band left | 60 / 12 % | 39 / 14 % | **11 / 69 %** |
| dusk-fire | Row-demeaned r (three bands) | | +0.38; +0.26; +0.09 | **+0.10; −0.12; −0.01** |
| B | Glow band left, x 0–0.35, y 0.40–0.45 | 111.1 h 12 | 87.2 h 339 | 89.5 **h 359** |
| B | Glow right, x 0.75–0.95, y 0.40–0.44 | 136.1 h 18 | 86.9 h 353 | 94.4 h 5 |
| B | Land left of camp / backdrop right | 39.4 / 21.5 | 54.3 / 37.0 | **61.8 / 47.1** |
| B | Wagon front, x 0.48–0.62, y 0.47–0.52 | 45.7 h 17, sat 0.71 | 42.5 h 6 | 51.0 h 357, sat 0.56 |
| B | Lantern pool, x 0.40–0.56, y 0.515–0.54 | 56.9 h 14 | 55.3 h 1 | 60.3 **h 356** |
| B | Plume column peak, y 0.20–0.34 | x 0.53, +6.9 | x 0.78, +2.4 | x 0.71, +4.3 |
| C | Upper-left sky, x 0.02–0.3, y 0.10–0.30 | 43.5, sat 0.38 | 22.9, sat 0.86 | **36.5, sat 0.52** |
| C | Flame box x 0.2–0.6, y 0.15–0.5: over 150 / 230 / 245 | 13 804 / 5 557 / 2 732 | 11 379 / 3 873 / 294 | 11 913 / 4 086 / **2 086** |
| C | Plume, x 0.2–0.45, y 0.15–0.33 | 50.4 h 320 | 39.9 h 244 | 47.2 h 271 |
| C | Far land, x 0.6–0.9, y 0.48–0.53 | 16.1 | 31.9 | **55.6 h 280** |
| C | Dune behind the brazier, x 0.55–1, y 0.45–0.49 | 41.0 h 358 | 34.9 | **59.0 h 284** (lilac share 93 %) |
| C | Ground right, x 0.55–0.95, y 0.60–0.70 | 33.7 | 56.2 | 59.5 |
| D | Land, x 0–0.5, y 0.52–0.62 | 16.0 | 41.0 | **49.9** |
| D | Far land right, x 0.5–1, y 0.50–0.58 | 23.0 | 28.9 | **50.0, B/R 1.20** |
| D | Mid sky streaks, x 0.05–0.95, y 0.34–0.44 | 72.1 h 281 | 90.7 h 340 | 90.9 h 340 (unchanged) |
| D | Horizon peak (row mean, x 0–0.7) | 166 | 129 | 129 (unchanged) |
| Late clip | Ground y 0.55–0.90, s 1 … 10 | | 29.0 … 23.9 | **50.6 … 50.0** (B/R 1.31–1.36) |
| Late clip | Far band y 0.40–0.50 | | 26.7 … 28.1 | 57.8 … 64.3 |
| aerial-overview | Land y 0.35–0.60 | | 35.5 | **85.5** |

**Pixels changed r20 → r21** (|ΔY| > 8): A 21.7 %, dusk-fire 24.1 %, B 9.5 %, C 30.9 %, D 12.5 %; h1 21.7 %, h2 10.4 %,
h3 18.4 %, h4 23.1 %, aerial-spawn 85 %, aerial-overview 97 %. Every land band y 0.35–0.60 got brighter (+5 to +11 in
the five; +50 in the overview).

## Signal Dunes (sunscar-dunes)

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` (Jake's pick) | **6.3** | 1. **The mid-ground is lavender (x 0–1, y 0.37–0.56). Regression.** The mockup's warm amber slope and grey-brown saddle are now lilac dunes (saddle h 305 against 13; lilac share 69 % against 12 %; warm-lit share 11 % against 60 %). The light pattern lost its match too: r +0.10 against r20's +0.38, because the turned crest's lit strip now cuts across the mockup's shaded saddle. 2. **The sky (y 0.05–0.36). Repeated.** A saturated navy (sat 0.57 against 0.18) over a hot band (108.5 against 84.5); no big ray over the tower. 3. **The hold (x 0.35–0.85, y 0.62–0.86). Gain.** The ring now hangs low beside the fist, close to the mockup's one loop. It is still a closed braided ring, where the mockup's loop is slack and open, with the cord running off the frame. |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.3** | 1. **Lilac dunes, no amber diagonal (x 0–1, y 0.37–0.56). Regression in colour, gain in form.** The luma pattern is the best yet (r +0.58, holding over three bands). But the diagonal box is lit by fog, not by the key: 64.4 at h 312 against 96.7 at h 20. The tower mound and the right-hand dunes are periwinkle (h 285–325) where the mockup's are orange (h 11–15). The edge trace sits flat at y 0.40 where the mockup's falls from 0.37 to 0.44. 2. **A pale lilac sheet under the ranges (x 0–1, y 0.37–0.41). Regression.** The far strip is 100 on the left against 72, and 70 on the right against 38. It reads as a second, milky horizon. 3. **The hold (x 0.4–1, y 0.66–0.88). Gain.** One ring, low, with no stick, where the mockup has two broad coils at the bottom edge. The small ray at x 0.27, y 0.28 is still not in the mockup. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **6.8** | 1. **The low band and the land (y 0.40–0.50). Mixed.** The band moved toward orange (h 359 / 5 against 12 / 18; r20 339 / 353), but it is still dimmer (89.5 against 111; right 94 against 136). The land left of the camp (62 against 39) and the backdrop right (47 against 21.5) went lighter and lilac under the fog. 2. **The caravan's smoke and light (x 0.4–0.8, y 0.1–0.55). Partly fixed.** The wisp is stronger but rises at x 0.71, the wagon's right rear (mockup x 0.53, over the hood). The pool is still pink (h 356 against 14) under the amber lantern. 3. **The hold (x 0.4–1, y 0.66–0.88). Gain.** It is clear of the cargo line, but one ring where the mockup has two coils. Pink cloud streaks still cross a sky the mockup keeps starry. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **7.4** | 1. **The dune behind the fire is a lilac wall (x 0.5–1, y 0.44–0.53). Regression.** It is 59 at h 284 against 41 at h 358, and the far land is 55.6 against 16.1 (r20 31.9). The mockup's dark brown ridge that sets off the fire is gone. 2. **The fire and smoke (x 0.2–0.6, y 0–0.5). Gain.** The core is back (2 086 against 2 732), the tongues orange. The smoke is wider (plume 47 against 50) but still a column rising straight up from the fire, where the mockup's billow drifts up-left with the sparks. The logs still don't read. 3. **The sky and the hold. Gain.** The upper sky is violet-navy (sat 0.52 against 0.38; r20 0.86), and the ring no longer cuts the plinth. The open ground is still lit flat (59.5 against 33.7). |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.4** | 1. **The land (x 0–1, y 0.50–0.72). Regression.** It is a pale blue-lilac field (50 against 16; the far right 50 at B/R 1.20 against 23), where the mockup has near-black transverse bands. The lit near band is 43.5 against 58.9. 2. **The horizon and sky (y 0.05–0.50). Repeated, unchanged.** The pink cloud streaks (91 at h 340 against 72 at h 281) and a peach line that peaks at 129 against 166. 3. **The hand (x 0.4–1, y 0.60–0.86). Gain.** The coil hangs low beside the fist, with no stick, which is the mockup's arrangement. But it is one stiff ring, where the mockup has two or three slack loops hanging vertically. |

**Seat score, Signal Dunes: (6.3 + 6.3 + 6.8 + 7.4 + 6.4) / 5 = 6.64, so 6.6.**
- This seat's earlier scores: 4.6, 5.1, 4.9, 5.2, 5.6, 5.3, 5.7, 6.1, 6.4, 6.4, 6.7, 6.7, 6.5, 6.4, 6.4, 6.3, 6.5, 6.3, 6.6, 6.7.
- Down 0.1 from round 20. The coil, C's sky and C's core are real gains in all five views. The fog took more than that
  back in the four views where land fills the middle of the frame.

## Builder claims checked against the pixels

| Claim (README / commits) | Verdict | Evidence |
|---|---|---|
| The fog is one density (0.0028) at every dusk step | **True** | `fogDist.value = AERIAL_FOG` in `update`. `fogDistDensity` is a shared uniform, so it reaches the shader. |
| Its colour is the horizon sky's lighter violet-blue, `0x5e5288`, with the late end `0x1a1733`, never toward black | **Half true: there is no late end** | The lerp writes to a `Fog` that is no longer the scene's (the audit). The live colour is `0x5e5288` at every dusk. C's and D's far land went lighter and bluer, by the same delta as A's (D (+18, +21, +37); A's far strip right (+13, +18, +37)). It is not toward black. It is also not the horizon colour at most headings: A's horizon is orange (h 8–12), and the land went to h 285–339. |
| A's lit edge falls left to right; trace 0.41 0.40 0.40 0.42 0.42 against 0.37 0.39 0.40 0.42 0.44 | **The numbers reproduce; the claim doesn't** | I get 0.41 0.40 0.40 0.39 0.52. The builder's own trace rises 0.01 where the mockup's falls 0.07: the edge is flat. The face above it is lilac fogged dune, not key-lit sand. |
| Row-demeaned r A +0.61 | **True** | +0.58 (and +0.42 / +0.50 on narrower and wider bands). |
| Row-demeaned r dusk-fire +0.31 | **False** | +0.10 (r20 +0.38). It is below +0.1 on the two other bands. |
| C's white core ~1 700 px over 245, tongues orange | **True, better than claimed** | 2 086; saturated orange 21 985 (r20 20 754). |
| C's upper sky (28, 27, 54) against (39, 32, 57) | **True** | My region 36.5, sat 0.52. |
| B's wisp over the wagon | **Partly** | The peak moved from x 0.78 to 0.71. The source is still the cookfire at the wagon's right rear (the mockup's plume is at 0.53). |
| The lantern amber, not red | **False at the pool** | The light is 0xffb766. The pool is h 356 (101, 49, 52) and the wagon front h 357, against the mockup's h 14–17. The violet sand and the lilac fog turn it pink. |
| The coil hangs low in the lower right | **True** | The ring is at y 0.66–0.83 in all five, with no stick in view. |
| Climb 39.1°, walk 0 stuck, navmesh re-baked | **Slopes true; walk-test evidence missing** | The terrain changed in 880 cells by ±4.2 m; the steepest changed cell is 30.9° (global max 39.05°, the waymark face). The navmesh was re-baked. The newest walk file, `sd-r21-b-muslzi8h.json`, is stamped 11:31, before 234085dba (12:05). 39.1° is round 20's figure. |
| "No camera changed" | **True** | Cameras blob a4219aa in both captures; every `camAt` and `staged` value is identical. |
| The README's "all shard commits between the captures" | **Incomplete** | It misses f4effe449, the late sky painting pulled toward mockup C at headings 20–140°. It touches only `public/assets/sunscar-dunes/` and `art/`. |

## Findings, ranked by score gained

1. **The fog: the lilac wash over the land (every view; A, dusk-fire, C, D and the clip most).** *Regression, new this
   round.*
   - The fog ruling allows aerial perspective toward the horizon sky. It doesn't require a fog strong enough to recolour
     dunes 40 m out. The mockups keep their mid dunes warm (A h 11–15, B/R 0.5; dusk-fire h 13–18). Only the farthest
     strip turns violet (A's far right B/R 0.95), and that strip is darker (38) than the sky above it.
   - **Fix:**
     - Make the `update` lerp reach the live fog (see the audit): bind to `scene.fog` after `compose`, or stop
       `compose` replacing the engine's `Fog`.
     - Then pick the colour per dusk from the painted sky's low band at the glow's heading, so the sunset fog is a warm
       amber-violet, not `0x5e5288`.
     - Lower the density until A's mid dunes keep their hue. Get the far strip's darker violet from the existing
       facing / `away` shade on far faces, never from a darker fog.
   - **Accept:**
     - A's mid dunes right at B/R ≤ 0.6 and h 0–25.
     - A's and dusk-fire's warm-lit share in the band ≥ 25 % left.
     - A's far strip left ≤ 80.
     - C's far land ≤ 30, D's land ≤ 30.
     - The late clip's ground ≤ 32 with B/R ≤ 1.0, and no step.
2. **Dusk-fire's light pattern, broken by the turned crest (dusk-fire x 0.35–1, y 0.42–0.56).** *Regression.*
   - The crest was turned for A's edge trace. Its lit strip now lies across the mockup's shaded saddle: r +0.38 →
     +0.10, against the commit's +0.31.
   - This is the coupling round 13 named: a landform tuned on one frame.
   - **Fix:** tune the crest on both spawn views together (both cameras share pos (0, 23.05, 70), 8° apart). Shorten the
     second crest's east end ([14.3, 18.3]) so its lit strip ends left of dusk-fire's saddle, or lower it there.
   - **Accept:** dusk-fire ≥ +0.35 and A ≥ +0.45 on the same band, both quoted from the seats' grid.
3. **D's land and sky (D y 0.34–0.72).** *Repeated, now worse.*
   - The land is 50 against 16, the pink streaks are unchanged for three rounds, and the peak is 129 against 166.
   - **Fix:** finding 1 takes most of the land back. Then clear the clouds and lift the peach band in the late painting
     at D's heading (world-space, as f4effe449 did for C).
4. **The hold: from one stiff ring to slack coils (all five, x 0.35–1, y 0.6–0.88).** *Repeated, half fixed (a real
   gain).*
   - The ring is low and the stick is gone. The mockups hang two or three loops (A, B, D) or one open slack loop
     (dusk-fire), with the cord running off-frame.
   - **Fix:** in the one idle pose, open the ring into two overlapping loops hanging below the fist, tilted toward the
     camera. Keep it one pose for all views.
5. **B's pool and plume (B x 0.4–0.8, y 0.1–0.55).** *Repeated, partly fixed.*
   - **Fix:**
     - Move the wisp's source onto the wagon's hood or stovepipe, not just its lean.
     - Exempt point lights from the sand's ×2.5 direct saturation, so the amber lantern lays an amber pool.
   - **Accept:** the pool at h 10–20, and the plume's peak within x 0.48–0.58.
6. **C's background and smoke (C x 0.2–1, y 0–0.53).** *Regression (background), repeated (smoke).*
   - Finding 1 restores the dark ridge. The smoke still needs to billow up-left with the sparks rather than rise as a
     straight column.
7. **Process:**
   - Commit the walk JSON for 234085dba.
   - Quote one correlation band, the seats' (y 0.36–0.56).
   - Add a hue or warm-lit check beside every luma metric. This round's luma "gains" (A's diagonal box +15.7, A's r
     +0.36) came with the colour moving away.
   - The generated commit list should include `public/assets/sunscar-dunes/` (it missed f4effe449).

## Ledger-5 audit

- **The fog: no breach, no void. One bug, and two claims the code doesn't support.**
  - **The bug.** `render.ts`'s `compose` runs `scene.fog = new Fog(new Color(FOG.color), …)`. `Game.buildComposer`
    (from `src/game/session/finish.ts`) calls it after `buildSky`, and `skyRig.build` has already passed its own
    `this.scene.fog` to `backdrop.bind`.
  - **The effect.** `update`'s `fog?.color.copy(fogBase).lerp(DUSK_FOG, late)` edits an orphaned `Fog`. The live fog
    colour is the constant `0x5e5288`.
  - **The pixel evidence.** C's and D's far land moved by the same RGB delta as A's, although A sits at `late` 0 and
    C / D at `late` 1.
  - **Round 20 too.** The live fog then was a constant `0x221d36`, not the "near-black late" one the council discussed.
    The ruling's intent still stands.
  - **Against the ruling.** The density is constant (`fogDistDensity` is a uniform, so that line works). The colour is
    lighter than the land at every dusk, so the far bands move up in value, never toward black. That passes the ruling's
    test, and nothing counts toward the camera-distance void.
  - **Forward warning.** If the orphan is "fixed" while `DUSK_FOG = 0x1a1733` (luma ~24) stays, C's and D's land will
    be pulled down by distance toward a near-black violet. That is exactly what the ruling voids. The working tree's
    uncommitted "round 22" drops that lerp and thins the density with the dusk toward the same lighter colour, which is
    allowed. But its `fog?.color.copy(fogBase)` still writes to the orphan.
  - **Metric gaming (should-fix, not a breach).** A global violet lift raises luma in the builder's boxes while the
    colour leaves the mockups. A's diagonal box went from 48.7 to 64.4 at h 312 against h 20. Builder numbers need a hue
    check (finding 7).
- **The second crest: real terrain, placed by A's frame again. Should-fix (repeated since round 13), not a breach.**
  - It is in the bake (`terrain.json` hash 308680f5…, 880 cells by up to ±4.2 m, at x −28…48, z −42…46). The navmesh
    was re-baked. The same change shows in h1, aerial-spawn and aerial-overview, and no `camAt` moved.
  - Its turn was tuned on A's edge trace and cost dusk-fire its light pattern (finding 2).
  - The changed cells are at most 30.9°, so walkability is not in doubt. But the "walk 0 stuck" for this terrain has no
    committed run.
- **The key: one global direction.** `KEY.dir` (−0.34, 0.2, −0.92) is unchanged and is never set per view.
- **Camera-distance terms:** none new. Between the captures `render.ts` changed only the fog lines. `fireFx.ts` gates
  the core by the flame's UV and widens the smoke. `painted.ts` changed only the low-sky hold (±2°, 0.8°), which is
  world-space by heading and elevation.
- **The sky painting (f4effe449):** painted at infinity, which is allowed. It is pulled toward mockup C's sampled colour
  over headings 20–140°: one world-space panorama, the same for any view that faces east, so it is not per-shot. It is
  missing from the README's list (process).
- **Staged state:** the handlers and `staged` are unchanged (B `logbook`, C and D `waymarks-lit`). The lantern pool is
  the ordinary nearest-light rule.
- **Still props and frozen poses:** none. The flame, smoke and sparks animate, the ray flies, and the hold is the one
  idle pose in all twelve shots.
- **Global grade:** `lut: null`. The fog is not a grade, but it acts like one: see the metric-gaming note.
- **No narrowing:** nothing regressed to help the five views. But the fog regressed every non-scored view as well:
  h1, h3 (lilac land behind the brazier) and h4 (the whole field lavender from the deck); the late clip's ground at
  50–53 against 24–31; the overview's land at 86 against 36. h2's red pool is gone, a gain.
- **Device and HUD:** 390×844 touch stored 780 wide, the baseline HUD, `pageErrors: []`, no QA retakes, 59 programs. The
  FPS chip reads 30 fps / 33 ms in every shot (D's was red in r20).

No score is voided.

SCORE signal-dunes: 6.6
