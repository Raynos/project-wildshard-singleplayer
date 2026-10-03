# Mockup council round 7

- sunscar-dunes: capture `progress/sunscar-dunes/20261003-0156-eeee0e02` (sha eeee0e02, staged {'mock-B-logbook': 'logbook', 'mock-C-waymark': 'waymarks-lit', 'mock-D-hands': 'waymarks-lit'}, page errors 0)

### Signal Dunes, round 7

Changes since round 6 (generated from the two captures):

- no mock-* camera changed

Real camera positions (meta.json camAt):
- `mock-A-spawn`: the real camera moved 8.29 m ([0, 13.01, 70] → [0, 21.3, 70])
- `mock-B-logbook`: the real camera moved 5.86 m ([-58.8, 10.6, 42.1] → [-58.8, 16.46, 42.1])
- `mock-C-waymark`: the real camera moved 2.98 m ([-53.9, 5.86, -17.2] → [-53.9, 2.88, -17.2])
- `mock-D-hands`: the real camera moved 3.09 m ([118.02, 11.08, 87.99] → [117.99, 14.17, 88.02])
- `mock-dusk-fire`: the real camera moved 8.29 m ([0, 13.01, 70] → [0, 21.3, 70])

Commits touching staging code between the captures:
- none

All shard commits between the captures:
- 19e78bf2e E399 Signal Dunes, council round 6 regressions fixed, measured against round 5's capture (0d4101be) and the mockups on sand clear 
- c691d95f2 E399 Signal Dunes: the gauntlet's stitching (council rounds 3-5: no seams read on the generated glove): dashed pale-thread seams o
- b3beecc14 E399 Signal Dunes (after the round-6 capture): the late-dusk ground lifted to the mockups' (measured: C 61,31,24 vs mockup 65,32,2

**Note for the seats:** the real camera heights are back to round 5's exactly, because the dune terrain was reverted to round 5's (no camera re-aimed). Compare this capture with round 5's (progress/sunscar-dunes/20261003-0057-56c23085) as well as round 6's: the builder says it kept round 6's gains (sand grain, the bigger low coil, logs with no glow when unlit and no Λ, a stitched gauntlet seam) on round 5's dunes and light.

Builder's claims to verify, measured on sand clear of the viewmodel (Rec. 709): D median 37 (round 5 36, mockup 40), rgb 57,31,32; dusk-fire and A at round 5's light (p50 75); A fine detail 5.8 (round 5 5.3); the plait dark brown with diagonal strands, dark gaps, one warm rim each, sheen roughness 0.45; a highlight on the crest band only.

- far-reach: capture `progress/far-reach/20261003-0250-1c2c026e` (sha 1c2c026e, staged {'h4-crown': 'quest-crown', 'mock-D-crown-arena': 'roc-stalk'}, page errors 0)

## Sky Reach (far-reach), round 7

Changes since round 6 (generated from the two captures, `20261003-0201-fc54d9df` → `20261003-0250-1c2c026e`):

- `mock-D-crown-arena`: settle 150 → 60

Commits touching staging code between the captures:
- 1c2c026e1 E399 Sky Reach: mock-D's staged Roc (plugin stage 'roc-stalk' and cameras.json, both named): its stalk turns in toward the arena e

All shard commits between the captures:
- 1c2c026e1 E399 Sky Reach: mock-D's staged Roc (plugin stage 'roc-stalk' and cameras.json, both named): its stalk turns in toward the arena e
- 148b2e1c4 E399 Sky Reach, council round 6 (seat A items 4-6, B/C): the rope bridges netted (a thick hand rope from the post heads drawn tigh
- 8052fd3e6 E399 Sky Reach GPU ceilings re-recorded at the m5 parity measurement of 9e0db1430 (phone 208.78 -> 210.81, desktop 323.24 -> 325.2
- 9e0db1430 E399 Sky Reach, council round 6 (seat A item 1, B/C items 1 and 6): the sward finer and greener (the tuft atlas at twice the texel
- 34bcb808d E399 Sky Reach, council round 6 findings (seats B and C): the sky dome samples by the view direction (it sampled by its own vertex
- 8109cb927 E399 Sky Reach: the keeper's book stand to mockup B (a box plinth, a square post with collars, a deep reading box, a large open bo
- f67d31051 E399 Sky Reach: the meadow follows each island's 12-gon rim (a circle left the corners bare; from mock-C's camera the band read as

**Staging:** mock-D's Roc stage `roc-stalk` changed in 1c2c026e1: the stalk turns so the Roc banks across the view, and the settle went from 0.15 s to 0.06 s. Both changes are named in cameras.json and in plugin.ts. Check that this is a state a player reaches on an ordinary approach (ledger 5).

**Lead ruling on mock-proposal-B's camera (the lead, wildshard-9; Jake can overrule):** the builder searched the layout and reports the following. No rise behind the spawn hides the bridge deck more than about 5 m past its foot. The proposal mockup's camera stands on a hill at the bridge head, while A and C stand on level ground there, so matching it means raising A's and C's ground. The camera stays where it is: on the rise behind the spawn, looking down the bridge axis. Score proposal B on what that real camera can match (the bridge, the destination isle, the sky, the subjects), not on the 5 m of deck it can't hide. Do score what the builder could still change from that spot.

**Builder's claims to verify (Rec. 709 luminance):**
- The top 1 % of the frame sits at 238–242. 2.8–4.5 % of the frame is above 230.
- The A subject went from 84 to 99, and the area under the bridge from 72 to 88 (gamma 1.15).
- There is one hot sun disc in a gold-orange bloom (the dome now samples by view direction).
- The near-ground darkening is gone.
- The sward is finer and greener: the atlas at twice the texels, arching blades, gold backlit tips, fewer and smaller flowers.
- The windmill isle stands on a narrower keel. The rope bridges are netted, with thinner planks.
- The Roc is slate and white. The storm eye sits higher. B and D have lichened rocks.
- The step is at (-64, -126), out of B's view.
