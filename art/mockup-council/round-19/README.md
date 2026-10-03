# Mockup council round 19

- sunscar-dunes: capture `progress/sunscar-dunes/20261003-1047-671128ac` (sha 671128ac, staged {'mock-B-logbook': 'logbook', 'mock-C-waymark': 'waymarks-lit', 'mock-D-hands': 'waymarks-lit'}, page errors 0)

**The bar is 7.0.** The phase in force is zoom-out: docs/plans/SIGNAL-DUNES-TOP10-2.md, with rows 1-4 in round 18 and row 5 now.

### Signal Dunes, round 19

The capture is `20261003-1047-671128ac`, at the builder's ready SHA 671128acd (with b85f9f84f, 5baedc054 and 5e8904aa9).

Changes since round 18 (generated; covers every shot's camera, every real-camera move or turn, and every commit touching a file that holds a stage handler):

- no camera changed in cameras.json

Real camera positions (meta.json camAt):
- `h3-waymark`: the real camera moved 5.01 m ([56.6, 21.69, -40.4] → [56.6, 26.7, -40.4])

Commits touching staging code between the captures:
- 671128acd E409 Signal Dunes round 19 (seats B and C after round 18): one horizon, a slow sky, no seam at 45 deg, a lit smoke, a white-hot co
- b85f9f84f E409 Signal Dunes: the key decoupled from the painted glow (the lead's ruling after round 18): one global direction, 20 deg left o
- 5e8904aa9 E409 Signal Dunes, round 18 follow-ups (the lead): the early sky dark at the top with its glow low; C's smoke a thin dark plume dr

All shard commits between the captures:
- 671128acd E409 Signal Dunes round 19 (seats B and C after round 18): one horizon, a slow sky, no seam at 45 deg, a lit smoke, a white-hot co
- 5baedc054 E409 Signal Dunes second top-10 row 5: the ray's dusk patrol circles the tower, so a player at the spawn sees it there against the
- b85f9f84f E409 Signal Dunes: the key decoupled from the painted glow (the lead's ruling after round 18): one global direction, 20 deg left o
- 5e8904aa9 E409 Signal Dunes, round 18 follow-ups (the lead): the early sky dark at the top with its glow low; C's smoke a thin dark plume dr

**1. The key, decoupled from the glow** (b85f9f84f), under the lead's ruling in scores.md.
- The glow stays painted right of the tower. The key is one global direction, 20° left of north.
- The builder tested it offline on round 13's landform. Row-mean-removed correlation, dusk-fire / A:

  | Key | dusk-fire | A |
  |---|---|---|
  | 20° left (shipped) | +0.42 | +0.13 |
  | 15° | +0.45 | +0.10 |
  | 27° | +0.36 | +0.13 |
  | 40° | +0.24 | +0.07 |
  | west and behind-left | -0.03 to -0.18 | -0.17 to +0.09 |
  | in the glow (round 18) | -0.45 | -0.38 |

- Dusk-fire passes the +0.3 bar. A doesn't under any one key, so its pattern also needs the landform.

**2. Plan row 5, the ray's route** (5baedc054). The ray's home is the tower. Its patrol circles it 34 m out and 22 m up, against the glow seen from the spawn, and it still comes for a player inside 55 m. Seats: check that this is ordinary behaviour, not a stage. The parity harness's 'ray' pose was turned to face the tower; that is a test pose, not a mock camera.

**3. Round 18's findings** (5e8904aa9 and 671128acd):
- **The sky:**
  - The early re-colour now applies only low, and the top is the late painting's navy with stars. The early stage is at dusk 0.64, and the early → late blend runs over the whole quest (dusk 0.45-0.86).
  - The builder measures A's top at 41 (mockup 40.5); D 40-115 (31-116); B within a few points. The glow band is still a little hot: 106-123 against 84-97.
  - No painted ranges sit below 2.5°, so the 3D ranges own the horizon.
  - The 45° seam is gone: the top eases into a heading-averaged colour from 38°.
- **The smoke:** one global dusk breeze, so the smoke and sparks drift left in C. It is half as wide, lit warm only at its foot and dark above. The flame core is stronger.
- **The glove:** procedural leather (creases, grain, bump). The loop is smaller and sits below the crosshair.
- **Shade and sand:**
  - The shade is desaturated: A 0.34 against the mockup's 0.31, dusk-fire 0.34 against 0.43.
  - Lit sand fell to 0.50-0.58 under the new key (mockups 0.57-0.69).
- **Skylines:** B's dune is 24 m, and waymark 0's rise 25 m (round 18's +2 m moved them by less than 0.004).

**Other notes:**
- No mock camera moved. h3's real camera rose 5 m with waymark 0's rise.
- Dusk: no stage or curve change; the sky's blend window was widened.

**The lead's first look:**
- The sky's top is fixed, navy with stars over an orange band.
- The ray reads small over the tower in A.
- The dunes take light on new faces.
- The loop still reads as a hoop on a stick above the hand.
