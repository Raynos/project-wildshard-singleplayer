# Mockup council round 9

- sunscar-dunes: capture `progress/sunscar-dunes/20261003-0356-544f6b56` (sha 544f6b56, staged {'mock-B-logbook': 'logbook', 'mock-C-waymark': 'waymarks-lit', 'mock-D-hands': 'waymarks-lit'}, page errors 0)

### Signal Dunes, round 9

The capture is at 544f6b56, which contains the builder's ready SHA 8460576f3; 544f6b564 adds only the Handoff.

Changes since round 8 (generated from the two captures, `20261003-0322-0cd1ecbb` → `20261003-0356-544f6b56`):

- `mock-B-logbook`: yaw 48.3 → 56.7
- `mock-D-hands`: pitch 0 → -2
- `mock-dusk-fire`: pitch -10 → -12.5

Real camera positions (meta.json camAt):
- `mock-C-waymark`: the real camera moved 9.67 m ([-53.9, 2.88, -17.2] → [-53.9, 12.55, -17.2])

Commits touching staging code between the captures:
- none

All shard commits between the captures:
- 8460576f3 E399 Signal Dunes, council round 8 findings (2): the fire, the hand, the sky's stars and haze, the lamps, D's pitch, a monotonic d
- fc2d157d9 E399 Signal Dunes, council round 8 findings (1): the key from the west-north-west on the broad tower dune, the clouds low horizont
- a2efe88ad E399 Signal Dunes: the dusk sky measured band by band against the mockups (Rec. 709, x 5-60 %): a deeper, redder afterglow at suns
- 60ee041c4 E399 Signal Dunes: the waymark flame premultiplied over the sky (measured on mock-C's bright flame pixels: B 105-203 against the m
- a6e2b238c E399 Signal Dunes: the west waymark (mock-C's hero brazier) on a rise, its pad 10 m over its own dune height (mockup C: the brazie
- 8a6b91e24 E399 Signal Dunes: the tower's dune a broad low mound (CRESTS lift 13 over 58 m -> 9 over 75 m; mockups dusk-fire and A show a wid

**Camera notes (the builder's reasons, each toward its mockup):**
- **B:** yaw 48.3 → 56.7. This reverses round 8's wrong turn and puts the lantern at about 0.5; the mockup has it at 0.52.
- **Dusk-fire:** pitch -10 → -12.5. It shares A's camera. The horizon moves from 0.39 to about 0.35; the mockup's is 0.345.
- **D:** pitch 0 → -2. The horizon moves from 0.53 to about 0.51.
- **C's real camera rose 9.67 m with no re-aim.** The west waymark (mock-C's hero brazier) now stands on a rise, its pad 10 m above its own dune (a6e2b238c). The camera rises with the ground. The backdrop's dunes now sit 0-1° over the eye, down from 9-13°.

**Terrain changed.** The tower's dune is a broad low mound (8a6b91e24), and the waymark has its rise. The navmesh is re-baked, the max-climb test is green, and parity at 8460576f3 is green: walk 0 stuck, gpuMB within the 108.99 ceiling.

**Staging and dusk (round 8's R8-A-P1 asked for the actual values):**
- The milestones' dusk values: Sefa 0.50; logbook 0.52 (was 0.32); oil 0.56 (was 0.45); waymarks 0.62 / 0.74 / 0.86. The dusk is now monotonic: it no longer brightens after the logbook.
- B's 'logbook' stage snaps to 0.50 and settles for 11 s.
- C's 'waymarks-lit' settles at the two-lit 0.74, then lights the last waymark through its handlers. The shot is 3 s later at about 0.80, with fresh notices.
- D uses the same stage: 11 s, settled at 0.86, no notices.

The stage code is unchanged, but the dusk table it reads changed, so check that each staged dusk is one a player reaches.

**The look changes are global:**
- the key light from the WNW (-0.8, 0.2, -0.6) at 2.3;
- the clouds as low horizontal banks;
- the afterglow right of the tower;
- the sky measured band by band;
- the flame premultiplied, and soot on the braziers;
- a 3.6 m fire with embers along their motion and a dark plume;
- the coil's cord at 0.03 with a crown sheen;
- creases on the glove;
- crisp stars;
- a halo on the lamp.

- far-reach: capture `progress/far-reach/20261003-0447-d3eefd5c` (sha d3eefd5c, staged {'h4-crown': 'quest-crown', 'mock-D-crown-arena': 'roc-opening'}, page errors 0)

## Sky Reach (far-reach), round 9

The capture is the builder's: `20261003-0447-d3eefd5c`, built at d3eefd5c7 and committed in 4e4e57e08.

Changes since round 8 (generated from the two captures, `20261003-0402-185b6810` → `20261003-0447-d3eefd5c`). No shot's real camera position moved. h3's yaw sign was fixed in 3ae4fc10e; before, it framed a pine.

- `mock-D-crown-arena`: settle 1500 → 500; stage roc-lap → roc-opening

Commits touching staging code between the captures:
- 109655ccb E399 Sky Reach, council round 8 (the lead's rulings and items 1-3): A's cluster as one world over the mill (three overlapping crag

All shard commits between the captures:
- d3eefd5c7 E399 Sky Reach, the Roc's real take-off (round 8 item 1): as a fight begins it rises slowly over its perch for 1.5 s (2.5 m/s out 
- 064795009 E405 AG25 (Jake 1A): the engine's 4 shard-identity sites move to data; no-level-identity is a hard error at 0
- efca93202 E399 Sky Reach, council round 8 items 6 and 8: the crown's runes flush with the stone faces, pale worn stone with the faintest glo
- 109655ccb E399 Sky Reach, council round 8 (the lead's rulings and items 1-3): A's cluster as one world over the mill (three overlapping crag
- 5abe9d651 E399 Sky Reach: B's foreground rocks 5-6 m out and smaller (at 2.6-3.9 m they swamped the frame), the boulders' lichen fainter (it
- 4c3288300 E399 Sky Reach: the keeper's book faces its reader (the reading box's reader edge tilted up, so mockup B's view saw the book's bac

**The lead's round-8 ruling applies** (scores.md): the world follows mockup A's cluster over the mill, and B's and C's skies are scored on the cluster's finish, not its presence. The builder placed three overlapping crags over the mill, at headings -9° / -2° / +4° from the spawn, at three depths, 10-20° up. Crag o3 is now clear of isle l4's deck.

**Staging:** mock-D now stages **'roc-opening'**, replacing round 8's 'roc-lap', which is no longer used. The builder says it is a real take-off at every fight's start: a 1.5 s slow rise over the Roc's north-stone perch, before its lap. The stage begins the boss with the Roc on its perch, and settles 0.5 s; the frame looks alike from 0.5 to 1.1 s. Judge whether this is the opening a player sees from that spot.

**Builder's claims to verify:**
- **The Roc:** its near-black paint is lifted to a slate floor.
- **The sky:** the upper sky is warmer and lighter above 18°.
- **The meadow:** its backlight glow is down. D's near grass faced the sun at 96 against the mockup's 56.
- **B's rocks:** 5-6 m out. The seats' B patch reads spread 67 and fine detail (hp) 13.8, against the mockup's 72 and 13.4.
- **The crown:** the runes are flush, pale worn stone, and the dais rim is fractured.
- **The keeper's book** faces its reader.
- **One ordinary play run** (art/far-reach/round-22-council-tools/playrun.mjs, playrun-result.json): one load, no teleports, each leg starting where the last ended.
  - The legs: spawn → the rope bridge on foot in 16.5 s → the updraft on the board, y 30.3 → 44.2 in 5.6 s → the winch on foot in 3.5 s → the winch turned with E (raised in 2.5 s plus the quest's 5 s hold) → the raised bridge into the arena in 17.6 s.
  - 0 stuck. The only staged state is 'quest-winch' (notes, roost and vanes done).

**Not done this round (the builder says):**
- C's fan as the hero subject: a larger hold covered A's bridge and D's dais.
- The keeper's open palm: his arm is rigid, with no elbow.
- Wear on the pennants.
