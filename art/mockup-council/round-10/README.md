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
