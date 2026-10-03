# Mockup council round 22

- sunscar-dunes: capture `progress/sunscar-dunes/20261003-1239-c43b91ce` (sha c43b91ce, staged {'mock-B-logbook': 'logbook', 'mock-C-waymark': 'waymarks-lit', 'mock-D-hands': 'waymarks-lit'}, page errors 0)

**The bar is 7.0.** Round 21 was the third detail round, so the phase switches to zoom-out after this round (E409). This batch was built as detail work and is scored as captured. The lead's rulings in scores.md apply.

### Signal Dunes, round 22

The capture is `20261003-1239-c43b91ce`, which contains the builder's batch: 02cc4e1ba, 2fcdd4696 and 080a1267d.

Changes since round 21 (generated; covers every shot's camera, every real-camera move or turn, and every commit touching a file that holds a stage handler; no real camera moved):

- no camera changed in cameras.json

Commits touching staging code between the captures:
- 080a1267d E409 Signal Dunes round 22c: the fog edited in place and read live (seat C after round 21); the walk test's result file for the ro
- 02cc4e1ba E409 Signal Dunes round 22 (the lead after round 21): the fog subtle in front of ~300 m and darker; the late sky a clean gradient;

All shard commits between the captures:
- 080a1267d E409 Signal Dunes round 22c: the fog edited in place and read live (seat C after round 21); the walk test's result file for the ro
- 02cc4e1ba E409 Signal Dunes round 22 (the lead after round 21): the fog subtle in front of ~300 m and darker; the late sky a clean gradient;

**The builder's batch:**
- **The fog** (02cc4e1ba):
  - It is subtle in front of about 300 m: density 0.0013, which gives 18 % at 150 m, 32 % at 300 m and 48 % at 500 m (it was 34 / 57 / 75 %).
  - Its colour is the horizon's darker violet near the ground (0x3e3452, not the light band's 0x5e5288), the same at every dusk step.
  - **Dusk change, declared:** the density THINS as the light goes, to a fifth by the blue hour, and never thickens. The old late lerp toward near-black 0x1a1733 is removed.
  - Far bands: C 54.6 → 35.5 (mockup 27.1), D 49.7 → 42.7 (mockup 17.0). A's mid dunes are warm, not lilac.
- **The fog fix** (080a1267d): compose now edits scene.fog in place, and the update reads targets.fog live (engine 69b3f0b8a made it a live accessor).
  - The builder says the screen is unchanged by this fix: the dusk thinning already reached the screen through the shared fogDistDensity uniform, and only the colour writes had been orphaned.
  - The colour is one constant, never lerped toward black.
- **D's late sky** (2fcdd4696): the painted sky edited toward D's heading only.
  - The builder measures rows 30-36 % at 59, 50, 102 (mockup 60, 53, 100); rows 36-42 % at 100, 64, 100 (mockup 88, 62, 104); and the glow line at 160, 99, 89 (mockup 160, 103, 99).
  - A clean gradient with no streaks. B's rows are unchanged.
  - Seats: this is an edit of one world-space panorama at one heading, which any player who looks that way sees. Judge whether it holds from h1-h4 and the aerials. A per-camera term would be a breach.
- **The sky above 5°** (02cc4e1ba): the late painting is averaged over ±25° of heading, so the pink streaks are gone in D, B and C. The early sky (A, dusk-fire) keeps its clouds.
- **C's fire pool:** the waymark light went from 14 to 9 cd and the sand's fire term from 0.18 to 0.12. C's near sand went 63.7 → 57.2 (mockup 45.2).
- **The walk-test file** is committed: progress/physics/sd-r22-b-muso9wjb.json, 7 legs, 0 stuck.
- **The builder's hue check** (the lit quarter of the dune band, mockup against game):

  | View | Mockup | Game |
  |---|---|---|
  | A | h21 s0.67 | h20 s0.51 |
  | dusk-fire | h22 s0.68 | h16 s0.56 |
  | C | h16 | h3 |
  | B | h11 | h3 |

  In the builder's words: "The hue is near on A, but saturation and contrast are short. B and C are still red, not amber."

**Not addressed this round (the builder says):** the two-coil hold, B's pink lantern pool, and the wisp's source.

No camera or pose moved. Dusk: the fog's density now thins with the dusk, as declared above.
