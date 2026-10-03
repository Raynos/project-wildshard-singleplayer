# Mockup council round 8

- sunscar-dunes: capture `progress/sunscar-dunes/20261003-0322-0cd1ecbb` (sha 0cd1ecbb, staged {'mock-B-logbook': 'logbook', 'mock-C-waymark': 'waymarks-lit', 'mock-D-hands': 'waymarks-lit'}, page errors 0)

### Signal Dunes, round 8

This is a fresh builder session, started from the round-7 Handoff in docs/tasks/asks/E374.md. The capture is at 0cd1ecbb, which contains the builder's ready SHA 96c73ea36. The builder's later commit 8a6b91e24 (the tower's dune made a broad low mound) is NOT in this capture; it goes to round 9.

Changes since round 7 (generated from the two captures, `20261003-0156-eeee0e02` → `20261003-0322-0cd1ecbb`):

- `mock-A-spawn`: pitch -9 → -12.5
- `mock-B-logbook`: yaw 53.8 → 48.3
- `mock-D-hands`: pitch -1 → 0; x 118 → 38; yaw 46 → 21.7; z 88 → 122

Real camera positions (meta.json camAt):
- `mock-D-hands`: the real camera moved 87.91 m ([117.99, 14.17, 88.02] → [37.98, 27.27, 122])

Commits touching staging code between the captures:
- 96c73ea36 E399 Signal Dunes: the 'waymarks-lit' stage settles at the two-lit dusk (a player who waited there) and then lights the last wayma

All shard commits between the captures:
- 96c73ea36 E399 Signal Dunes: the 'waymarks-lit' stage settles at the two-lit dusk (a player who waited there) and then lights the last wayma
- be2fac8ff E399 Signal Dunes: the re-recorded phone ceiling's pose rows in the manifest (54ab03e91's accepted capture carries spawn / whip / 
- 54ab03e91 E399 Signal Dunes: GPU ceiling re-recorded at the m5 parity measurement of c36bd9425 (phone 108.28 -> 108.99 MB, +0.71 MB: the cod
- c36bd9425 E399 Signal Dunes, round 8 batch part 2: D an overlook, the flats removed, the gauntlet's grain, the keeper's lamp, the camp's clo
- fd2ad32c0 E399 Signal Dunes, council round 8 batch: a code-built plaited coil, the key from behind the tower, crisp near grain, the fire, th
- 4c79afef0 E399 Signal Dunes: stronger near grain octaves (measure.py fine: dusk-fire 5.2 vs mockup 8.3, A 5.6 vs 7.1; was 4.7 / 5.2), the wa
- 551e484de E399 Signal Dunes, council round 7 findings, measured with ONE tool (art/sunscar-dunes/round-21-council-tools/measure.py: Rec. 709

**Camera notes (the builder's reasons):**
- **A:** pitch -9 → -12.5, to put the horizon at the mockup's 0.345 of the frame (it was 0.40).
- **B:** yaw 53.8 → 48.3, to centre the wagon on the crosshair as the mockup frames it. The position is unchanged.
- **D moved 88 m:** from (118, 88), the eye stood under the skirt of the tower's dune, which rose 2.4° over the eye and hid the tower's lower half. The mockup is an overlook: a flat horizon at about 0.51, dune bands below, the whole tower at x about 0.85. A terrain search found the nearest crest with all of that in frame on the spawn ridge's NE arm, at (38, 122). The builder says it is a real walkable crest with ground at 25.7 m. Check that a player can stand there and that the view is not chosen to hide anything (ledger 5).

**Staging:** 'waymarks-lit' now settles at the two-lit dusk, then lights the last waymark through its own handlers while the dusk eases on (fixing R7-A-P1). Check it is a state a player reaches.

**Terrain:** unchanged from round 7 (hash d5c0efe9).

**The look changes are global:**
- the key light from behind the tower near the afterglow;
- crisper near grain;
- a coil built in code, with a real plait and UVs;
- the fire, the camp, the sky and the keeper's lamp;
- the gauntlet's grain.

The phone GPU ceiling was re-recorded at 108.99 MB, approved by the lead as a ratchet; the phone limits are 1.8 GB loading / 1.0 GB Explorer.

- far-reach: capture `progress/far-reach/20261003-0402-185b6810` (sha 185b6810, staged {'h4-crown': 'quest-crown', 'mock-D-crown-arena': 'roc-lap'}, page errors 0)

## Sky Reach (far-reach), round 8

The capture is the builder's: `20261003-0402-185b6810`, built at 185b6810e and pushed in 06c124273.

Changes since round 7 (generated from the two captures, `20261003-0250-1c2c026e` → `20261003-0402-185b6810`):

- `mock-D-crown-arena`: settle 60 → 1500; stage roc-stalk → roc-lap

Commits touching staging code between the captures:
- 185b6810e E399 Sky Reach, the Roc (round 7 item 2): it soars (a slow flex with its wings in a 0.3 rad raised V, strong beats in a short burs
- 2e2327f04 E399 Sky Reach: A's cluster crags at headings -12 / -16 from the spawn (A's frame spans +-18.6 deg, B's and C's start at -14.6 / -
- 0cd1ecbbf E399 Sky Reach, council round 7 findings: the meadow's spread back (gamma 1.15 dropped, the shade floor raised instead; the keeper

All shard commits between the captures:
- 185b6810e E399 Sky Reach, the Roc (round 7 item 2): it soars (a slow flex with its wings in a 0.3 rad raised V, strong beats in a short burs
- ab1d17244 E399 Sky Reach: the meadow's brightness to the mockups' on the seats' ground patch (the steep-view root lift dropped: it fired at 
- 7ecff9410 E399 Sky Reach, council round 7 items 2, 5, 6: the Roc's lap 3 m higher (from the arena's rise it sat 10 deg over the eye among th
- b038ab03d E399 Sky Reach, round 7 item 3: the fan's idle hold 3 cm further in and ~8 % larger for every view (mockup C's pivot sits at x 0.7
- fd20fba69 E399 Sky Reach, round 7 item 4: the sun smaller and the sky paler low, warmer high. The dome rolls off its painted glow within ~14
- 2e2327f04 E399 Sky Reach: A's cluster crags at headings -12 / -16 from the spawn (A's frame spans +-18.6 deg, B's and C's start at -14.6 / -
- 0cd1ecbbf E399 Sky Reach, council round 7 findings: the meadow's spread back (gamma 1.15 dropped, the shade floor raised instead; the keeper
- 9577ce703 E399 Sky Reach: the windmill isle's pines asymmetric, three left of the mill and one right, as mockup A clusters them (four in a s
- 5bca51f01 E399 Sky Reach: the foreground boulders in B and D read as rock (larger, up to the 0.5 m step-over; the moss cap only on the flatt

**Staging:** mock-D now stages the Roc's **rest lap** ('roc-lap', plugin.ts and stormRoc.ts stageLap), replacing round 7's 'roc-stalk' and its 60 ms settle. The builder says this is the 2.4 s rest every fight shows, placed on the lap at -2.64 rad, with a 1.5 s settle; the frames at 1.2, 1.5 and 1.8 s look alike. The lap is 11 m over the crown (it was 10). The Roc banks 0.35 rad through the new engine flight bank (8252e3978). Judge whether a player at the arena sees this rest lap at this point in an ordinary fight, and whether choosing -2.64 rad on the lap is fair framing of a real state or a pose picked for the shot.

**For the seats to rule on (the lead flags it, not the builder):** 2e2327f04 places A's cluster crags at headings -12° / -16° from the spawn. A's frame spans ±18.6°, while B's and C's frames start at -14.6° / -13.6°, so the crags show in A and stay out of B and C. This is one global layout, not a per-view switch, but it is placed by the frame edges. Judge it from the hero views and the aerials too: does the world hold up from everywhere a player stands, or is it a composition that only works from the mock cameras? Round-7 seat A asked for one layout evaluated from all four viewpoints.

**Builder's claims to verify:**
- **Meadow:** gamma back to 1, the shade floor raised instead, the keeper's ring 1.2 m, and denser, wider strands. On the seats' A ground patch, L 49 / 72 / 110 with spread 61 and fine detail (hp) 13.4, against the mockup's 40 / 61 / 105, 65 and 12.4. Round 7 measured a spread of 29 and fine detail of 8.5.
- **The Roc:** slate on its emission as well as its paint, a 19 m span, a soar with its wings in a raised V and short wingbeat bursts, and a 0.35 rad bank.
- **The fan:** the hold stays its size. A larger hold covered A's bridge and D's dais.
- **The sun:** the dome rolls off its painted glow near the sun, so the halo is fainter. D's middle band over 230 is 8 % (round 7: 11.6 %; mockup: 5 %). Proposal B's sky barely moved (chroma 81 against the mockup's 25).
- **Stone and rocks:** the dais rim is fractured and the runes are cut stone. D's rocks sit 10-13 m out, in frame. B's rocks are rough grey with sparse lichen.
- **The rises are grassed:** the dressing clumps had been buried inside them.
- **Route evidence** (art/far-reach/round-22-council-tools/route.mjs and route-result.json, the harness autopilot):
  - the updraft ridden on the board from the windmill rim to the step, y 30.3 → 44.2 in 5.8 s;
  - the raised bridge walked to the crown at y 44.0 in 16.2 s;
  - 0 stuck on both, and the walk baseline 0 stuck.
- **Luminance:** the top 1 % at 235-239, and 1.9-3.1 % of the frame over 230.
