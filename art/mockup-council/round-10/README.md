# Mockup council round 10

- sunscar-dunes: capture `progress/sunscar-dunes/20261003-0432-0ae71b2a` (sha 0ae71b2a, staged {'mock-B-logbook': 'logbook', 'mock-C-waymark': 'waymarks-lit', 'mock-D-hands': 'waymarks-lit'}, page errors 0)

### Signal Dunes, round 10

The capture is at 0ae71b2a, the builder's ready SHA. Parity is green at that SHA (walk 0 stuck).

Changes since round 9 (generated from the two captures, `20261003-0356-544f6b56` → `20261003-0432-0ae71b2a`). The camera list now covers every shot, hero views included, and none moved apart from the re-aim below:

- `mock-dusk-fire`: yaw -10 → -8

Commits touching staging code between the captures:
- none

All shard commits between the captures:
- 0ae71b2aa E399 Signal Dunes: the cloud banks broken into masses (the seats round 9: smooth strips; the mockups' banks are layered masses wit
- dad1e3476 E399 Signal Dunes: the gauntlet's creases in the albedo as well as the bump (R9B-4: the crease octave did not register at 780 px; 
- ed3c17393 E399 Signal Dunes: the dusk's far land darker (R9B-2: mockups B, C and D put near-black land under a thin glow line; ours 2-4x bri
- 3b2f5f0e2 E399 Signal Dunes, council round 9 findings (1): the key NNW by a measured sweep, a crisp terminator, the dusk horizon's glow line
- 0dac86de9 E399 Signal Dunes: the idle hold lower with larger loops (seat C round 9: mockups A, B and C hold big rings rising from the frame'
- e2dec8b5e E399 Signal Dunes: the late sand back to the mockups' (clean patch, Rec. 709, mockup / before / now: B 39.0 / 41.6 / 36.6, C 32.4 
- b22c22037 E399 Signal Dunes: the waymark fire crisper and the bowl's width (crisp lick tips, finer tongues, redder outer licks; the core sma
- 06c124273 E399 Signal Dunes: the camp's cargo standing on the sand (sunk to 0.8 of their height they read as low black slabs, every seat sin
- 26f691035 E399 Signal Dunes: a crest line between the spawn and the tower (layout CREST_LINES: (-24, -42) to (20, 14), 7.5 m over the field,

**Re-aim:** dusk-fire yaw -10 → -8, to move the tower from x 0.31 to about 0.38 of the frame (R9B-8).

**Terrain changed:** a crest line between the spawn and the tower (26f691035, layout CREST_LINES (-24, -42) to (20, 14), 7.5 m over the field). The navmesh is re-baked and the max-climb test is green. Note that the builder's message cited the wrong SHA for it; the generated list above is the record.

**Staging is unchanged since round 9.** The dusk values: Sefa 0.50, logbook 0.52, oil 0.56, waymarks 0.62 / 0.74 / 0.86. The stages:
- B: 0.50, then 11 s.
- C: 0.74, then the last light, shot 3 s later at about 0.80.
- D: 0.86, then 11 s.

**Builder's claims to verify:**
- **Clean-patch late sand** (Rec. 709; the builder's measure.py now uses the clean patch): B / C / D 36.6 / 37.5 / 33.4, against the mockups' 39 / 32 / 34.5.
- **The key light and horizon:** the key light from the NNW, chosen by a six-azimuth sweep of grid correlation; a crisp terminator; a glow line over the dusk horizon; the far land darkened at dusk.
- **The fire:** a hot core, and the bowl's width.
- **The caravan:** the lantern has a hot centre and a halo over the canvas, and the camp's crates stand on the sand.
- **The post** is greyed.
- **The held coil and glove:** the idle hold is lower with bigger loops (cord 0.04), and the glove's creases are in the albedo.
- **The clouds** are broken into masses.

- far-reach: capture `progress/far-reach/20261003-0516-750b533a` (sha 750b533a, staged {'h4-crown': 'quest-crown', 'mock-D-crown-arena': 'roc-opening'}, page errors 0)

## Sky Reach (far-reach), round 10

The capture is the builder's: `20261003-0516-750b533a`, built at 750b533af.

Changes since round 9 (generated from the two captures, `20261003-0447-d3eefd5c` → `20261003-0516-750b533a`; the list covers every shot):

- `mock-D-crown-arena`: settle 500 → 3300

Commits touching staging code between the captures:
- none

All shard commits between the captures:
- 750b533af E399 Sky Reach, council round 9 items 5-7: the cluster over the mill larger and lower (o1 / o3 / o4 at 11-14 m, keels down to ~6 d
- 9b96cccdf E399 Sky Reach, council round 9 items 1-3 and 9: h3 back to yaw 41, toward the high step (aa6c1080f turned it to -41, away from it
- c264911bb E399 Sky Reach: the keeper waves as mockup B does (round 8, seat A: 'an open waving hand'): his arm split again at the elbow (the 
- 219adb0c3 E405: shard EquipmentSlotMap merges into its defining module (#engine/combat/Equipment), like src/game/equipmentTypes.ts — the mer

**h3:** back at yaw 41, toward the high step (9b96cccdf). This reverses round 9's turn away from it. The windmill pine moved 2.5 m south, and sky isle l1 moved to (-36, -104), so both are out of the step's sightline. The camera's position is unchanged.

**Staging:** the stage code didn't change, but the Roc's behaviour did (9b96cccdf, combat/stormRoc.ts):
- The take-off now lasts 4 s (1.6 m/s, 5 m up), and the first rest waits for it. The builder says a player walking in from the bridge landing (about 3.1 s) still sees it.
- mock-D's settle went 0.5 s → 3.3 s; the frame looks alike from 3.0 to 3.7 s.
- On a fight restart the brain resets its rest and take-off (the round-9 retry bug).

Judge whether a 4 s take-off is plausible play or only stretched to suit the shot. Check that the frame at 3.3 s is what a player who just walked in from the landing sees.

**Builder's claims to verify:**
- **The glare's cause:** the crown's cloud bank shared the keels' random stream, so adding crag o4 re-rolled it and put lit puffs by the sun between the stones. The bank now has its own seed. On a fixed god view, the share over 230 went 10.0 → 12.6 %.
- **The meadow:** its glow is back to round 8's.
- **The cluster:** larger and lower, with keels down to about 6° and spanning -17° to +12°. Darker crags, gold sunlit rims, lighter haze.
- **One fan hold for every view:** larger, lower and more diagonal (scale 0.47, roll 0.95). The builder says A's bridge and D's dais stay clear.
- **The high sky:** warmer and lighter (C 141 → 152).
- **The keeper:** an elbow wave, his arm split at the elbow with the forearm raised beside his head.
- **The play run:** now with creatures live (calm false, declared in playrun.mjs). 0 stuck, same times.

**Still open (the builder says):**
- Proposal B's sky chroma.
- D's middle band at 9 % over 230, against 5 %.
- The Roc's three-quarter pose.
- Rocks and daisy clusters in the meadow.
- The ray's wake.
