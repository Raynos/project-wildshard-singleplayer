# Mockup council round 15

- sunscar-dunes: capture `progress/sunscar-dunes/20261003-0835-c1b820c3` (sha c1b820c3, staged {'mock-B-logbook': 'logbook', 'mock-C-waymark': 'waymarks-lit', 'mock-D-hands': 'waymarks-lit'}, page errors 0)

**The bar is 7.0.** The phase in force is zoom-out: docs/plans/SIGNAL-DUNES-TOP10.md (E407; LOOK-LOOP.md's alternating phases, E409).

### Signal Dunes, round 15

The capture is at c1b820c3, which contains the builder's ready SHA 662e6e99b. It also contains Sky Reach's LUT commit; Signal Dunes has no LUT.

Changes since round 14 (generated; covers every shot's camera, every real-camera move or turn, and every commit touching a file that holds a stage handler):

- `mock-D-hands`: x 38 → 36; yaw 21.7 → 22.5; z 122 → 92

Real camera positions (meta.json camAt):
- `h2-caravan`: the real camera moved 1.11 m ([-64, 16.23, 38] → [-64, 15.12, 38])
- `h3-waymark`: the real camera moved 12.74 m ([56.6, 26.9, -40.4] → [56.6, 14.16, -40.4])
- `h4-tower-deck`: the real camera moved 0.07 m ([8.4, 26.76, -73] → [8.4, 26.83, -73])
- `mock-B-logbook`: the real camera moved 1.11 m ([-58.8, 16.24, 42.1] → [-58.8, 15.13, 42.1])
- `mock-C-waymark`: the real camera moved 0.41 m ([-53.9, 17.02, -17.2] → [-53.9, 17.43, -17.2])
- `mock-D-hands`: the real camera moved 30.09 m ([37.99, 27.59, 121.99] → [35.99, 25.97, 92.01])

Commits touching staging code between the captures:
- 662e6e99b E407 round 15 (Signal Dunes, the lead after round 14): the key back inside the glow, the wind away from the camera, the crest acro
- a1aa357f7 E407 row 9 (Signal Dunes): the spawn's first look is the dunes and the tower: Sefa stands beside the player, 5 m right and a littl

All shard commits between the captures:
- 662e6e99b E407 round 15 (Signal Dunes, the lead after round 14): the key back inside the glow, the wind away from the camera, the crest acro
- 9d610a30d E407 row 4 follow-up (the lead after round 14's first look): a ROUND coil of plaited whip beside a fitted glove
- a1aa357f7 E407 row 9 (Signal Dunes): the spawn's first look is the dunes and the tower: Sefa stands beside the player, 5 m right and a littl

**The builder's batch (round 14's must-fixes):**
1. **The key is back inside the glow,** at 23.5°, which is the glow's azimuth +12°.
2. **The WIND is flipped for the whole dune field** to blow away from the camera (NE, toward the glow).
   - The builder's reason: with the wind blowing toward the spawn view, every slip face faced the camera in its own shade (84-97 % of A's and dusk-fire's dune band).
   - The crest now runs across the wind, from far left to near right, about 50 m ahead and under the eye. Its windward faces are lit toward the camera; its slip faces are shaded beyond.
   - Its peak is 25 m (it was 30), for C's skyline.
   - The builder checked it offline before the commit. Shade share of the dune band, left / right: A 34 / 38 % (mockup 23 / 40, round 14 18 / 44); dusk-fire 39 / 36 % (mockup 19 / 45).
   - Overlay: art/sunscar-dunes/round-22-landforms/overlay-A-duskfire-r15.jpg.
3. **The glove** is at 0.7 size and turned toward three-quarter. The loop is a closed ellipse beside the fist, above DODGE / JUMP, with the cord's fall behind the hand.
4. **The near ripples** are halved, and the late facing-darkening windows are widened (they were the ovals).
5. **The land under the dusk horizon:**
   - B's flat skyline was the caravan pad's 101 m ease levelling everything to 123 m. The ease is now 55 m, with a dune behind the wagon. Right of the wagon, B reads 36-45 (it was 80; mockup 17-25).
   - The late land past 15 m falls toward silhouette from dusk 0.55. Under the horizon, D reads 10 (mockup 17, round 14 42).
6. **Waymark 1's 10 m lift is removed:** it made a 41-44° face.

**MOVED CAMERA:** mock-D moved from (38, 122) to (36, 92), and its yaw from 21.7° to 22.5°.
- The builder's reason: the flipped field raised a dune face over the old stand. The new spot is a reachable 24 m rise, with the tower where the mockup has it.
- Seats: judge under ledger 5 whether this is a real, reachable overlook chosen for the mockup's composition, not a spot chosen to hide anything.
- h3's real camera dropped 12.7 m with the new ground. The other hero cameras are unchanged.

**Other notes:**
- No stage or dusk-curve change, apart from the late-land darkening above.
- **Row 10, the LUT:** fit 1 was made on round 14's swung-key frames and brightened every view 7-12 luma, so it is NOT in this build.
- **The builder's near patches,** game / mockup: dusk-fire 70.5 / 73.8, A 64 / 57, B 38 / 40, C 40 / 33, D 32 / 35.
- **The lead's first look:** the forms read as dunes with the tower on its mound. The mid-distance ripples are still strong, and the fist still reads upright and mitten-like. Judge both.
