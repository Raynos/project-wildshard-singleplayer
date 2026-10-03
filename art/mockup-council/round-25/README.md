# Mockup council round 25

- sunscar-dunes: capture `progress/sunscar-dunes/20261003-1458-a37cbc42` (sha a37cbc42, staged {'mock-B-logbook': 'logbook', 'mock-C-waymark': 'waymarks-lit', 'mock-D-hands': 'waymarks-lit'}, page errors 0)

**The bar is 7.0.** The phase in force is detail (E409). This round is round 24's **re-run**: round 24's D was void (the mock-D move). mock-D is back at round 23's stand, (38, 122) yaw 21.7 (41adb0d90), and the diff below is against round 23, the last valid stand. The lead's rulings in scores.md apply: **mock-D moves no more.**

### Signal Dunes, round 25

The capture is `20261003-1458-a37cbc42`, which contains the builder's ready SHA 92d11777d.

Changes since round 23 (generated; covers every shot's camera, every real-camera move or turn, and every commit touching a file or asset of the shard). It includes round 24's batch, which seats can read in round-24's README section:

- no camera changed in cameras.json

Commits touching staging code between the captures:
- 92d11777d E409 Signal Dunes round 25 (the round-24 seats): saturation on the lit term only; A's trough shaded by a low crest; the coil's two
- 302c174b7 E409 Signal Dunes: the late fill a third lower after the logbook's step; the sand's fire light falls off tighter
- 7db2a5a26 E409 Signal Dunes round 24 (the round-23 seats): the coil right and smaller; the late troughs floored; the ridge's south end taper
- 5d0be40ff E409 Signal Dunes TOP10-3 row 6: the sunset's lit sand saturated and gold (the direct boost by the dusk; the fill warm on key-lit 

All shard commits between the captures:
- 92d11777d E409 Signal Dunes round 25 (the round-24 seats): saturation on the lit term only; A's trough shaded by a low crest; the coil's two
- 302c174b7 E409 Signal Dunes: the late fill a third lower after the logbook's step; the sand's fire light falls off tighter
- 7db2a5a26 E409 Signal Dunes round 24 (the round-23 seats): the coil right and smaller; the late troughs floored; the ridge's south end taper
- 81c1f8034 E409 Signal Dunes: D's horizon glow line peach and bright (seat C: 131 against 166)
- 8382bdad6 E409 Signal Dunes TOP10-3 row 8: B's night sky clean (the early painting averaged across headings toward B only)
- a5dc51367 E409 Signal Dunes TOP10-3 row 7: B's cookfire plume rises over the wagon (x 0.71 -> 0.565, mockup 0.527)
- 5d0be40ff E409 Signal Dunes TOP10-3 row 6: the sunset's lit sand saturated and gold (the direct boost by the dusk; the fill warm on key-lit

**This batch, after round 24 (the builder's report):**
- **Saturation (seats B and C):** the direct light is saturated by facing toward the key, 1.2 on flat sand up to 2.2 for faces turned into it, never by dusk.
  - The warm fill is gone, the shade fill is bluer, the key is a touch redder, and the direct term is steeper with facing.
  - Dune band, mockup / round 24 / now:

    | Measure | Mockup | Round 24 | Now |
    |---|---|---|---|
    | Red pixels, A | 0.1 % | 4.4 % | 0.9 % |
    | Red pixels, dusk-fire | 0.0 % | 9.9 % | 1.4 % |
    | Blue < 6 | 0 % | 0.9-2.0 % | 0 % |
    | Shade hue, A | h288 | h354 | h342 |
    | Shade hue, dusk-fire | h327 | h345 | h326 |
    | Shade saturation | 0.18-0.23 | 0.42 | 0.34 |

  - Lit saturation is still short: 0.47 against the mockups' 0.67.
- **Dusk (302c174b7):** at sunset the key carries +35 % and the fill -30 %, easing out by dusk 0.4. The builder says this is not fitted to B, whose stage is at 0.50. The late fill is a third lower after dusk 0.6. Seats: check that neither is fitted to a staged dusk.
- **Terrain:** one low crest (2.5 m) beyond A's trough, slip face to the camera. Walk test 0 stuck: progress/physics/sd-r25-b-mussawzm.json.
- **A's trough:** 92.4 → 71.1 (mockup 42.7).
  - A's diagonal is 82.8 (mockup 96.7).
  - Dusk-fire's left is 72.5 (71.5), r +0.49.
  - A taller crest got the trough to 51-57 but cost dusk-fire's r (0.35-0.41), so the builder shipped the balanced one.
- **The coil:** the second turn is stepped up and left, giving two separate rings across x about 0.33-0.80.
- **B:**
  - The sky clean-up weight now falls continuously from B's heading (half at ±30°), with no window.
  - The lantern goes from 3 to 5 cd, because the steeper term scales point lights too: the pool is h11 (mockup h15) at 55.6 (65.9).
- **C:** the open ground reads 44.1 on the right (mockup 33.8) and 50.1 on the left (50.2).

**Open (the builder says):**
- **D's bands from its stand:** D stands on a dune top 27.6 m up. Ridges 10-40 m out lowered D's land median to 28.7 (mockup 14), but they made a 41-54° face beside the stand or walled off the view, so nothing was shipped.
- **A's near sand** is 99 against the mockup's 68, while dusk-fire's same ground matches its mockup (82 / 80).
