# Mockup council round 14

- sunscar-dunes: capture `progress/sunscar-dunes/20261003-0730-69642e60` (sha 69642e60, staged {'mock-B-logbook': 'logbook', 'mock-C-waymark': 'waymarks-lit', 'mock-D-hands': 'waymarks-lit'}, page errors 0)

**The bar is 7.0** (ledger 4 as Jake amended it). This round is on the lead's top-10 plan, docs/plans/SIGNAL-DUNES-TOP10.md (E407).

### Signal Dunes, round 14

The capture is at 69642e60, the builder's ready SHA. Parity is green at 042c219c9 (walk 0 stuck). gpuMB was re-recorded, +5 KB for the new glove.

Changes since round 13 (generated; covers every shot's camera, every real-camera move or turn, and every commit touching a file that holds a stage handler):

- no camera changed in cameras.json

Real camera positions (meta.json camAt):
- `h1-spawn-crest`: the real camera moved 2.48 m ([0, 18.72, 70] → [0, 21.2, 70])
- `h2-caravan`: the real camera moved 9.18 m ([-64, 7.05, 38] → [-64, 16.23, 38])
- `h3-waymark`: the real camera moved 25.07 m ([56.6, 1.83, -40.4] → [56.6, 26.9, -40.4])
- `mock-A-spawn`: the real camera moved 2.48 m ([0, 18.72, 70] → [0, 21.2, 70])
- `mock-B-logbook`: the real camera moved 9.17 m ([-58.8, 7.07, 42.1] → [-58.8, 16.24, 42.1])
- `mock-C-waymark`: the real camera moved 0.49 m ([-53.9, 17.51, -17.2] → [-53.9, 17.02, -17.2])
- `mock-dusk-fire`: the real camera moved 2.48 m ([0, 18.72, 70] → [0, 21.2, 70])

Commits touching staging code between the captures:
- ea0b3939a E407 row 2 (Signal Dunes): the sand material: ripples only where the wind leaves them, macro albedo, a grazing sheen

All shard commits between the captures:
- 69642e603 E407 Signal Dunes: GPU ceiling re-recorded at the m5 parity measurement of 042c219c9 (phone 109.745 -> 109.750 MB, +5 KB: the new 
- 042c219c9 E407 row 4 (Signal Dunes): the viewmodel rebuilt: a modelled leather glove and ONE loose loop, held low in the lower right
- 5db840110 E407 row 1 fixes (the lead after round 13): the crest across the light with its slip face downwind, the dune sea's relief back, th
- ea0b3939a E407 row 2 (Signal Dunes): the sand material: ripples only where the wind leaves them, macro albedo, a grazing sheen

**Plan rows in this capture:**
- **Row 2, the sand material** (ea0b3939a): ripples only on gentle faces, gone on slip faces steeper than about 26° and fading out past 35-110 m; macro albedo at dune scale; a grazing sheen. keyAt is now d^0.7, monotonic.
- **Row 1, fixed after round 13** (5db840110):
  - The crest now runs from far at the frame's right edge, (70, -50) at 30 m, down and left to near the centre, (8, 26) at 14 m.
  - The slip face is DOWNWIND, and the crest crosses the key.
  - It only pulls the field up along its face profile, so the dune sea keeps its relief.
  - Self-check overlay: art/sunscar-dunes/round-22-landforms/overlay-A-duskfire-r14.jpg.
- **Round 13's other fixes:**
  - The late-dusk cut applies only to faces clearly turned away from the glow (toGlow < -0.1) and clearly tilted (more than about 12°), never to flat ground.
  - The low-sky red stripe is 0.01 % in h4 and 0.04 % in h2.
- **Row 4, via mockup-to-model** (042c219c9; art/sunscar-dunes/round-23-glove/board.jpg):
  - The glove is glove-hd3, made with Hunyuan3D-2 from a reference cut from mockup D: 18.9k tris, 171 KB.
  - ONE loose plaited loop, built in code as a tube from the top of the handle. The double ring is retired.
  - The hold is 0.22 m lower, in the lower right.

**The lead's notes for the seats:**
- **h3's real camera rose 25 m.** The crest's far end, (70, -50) at 30 m, now stands on the h3 waymark spot. Check that the waymark, its route and its view are still sensible, real terrain.
- **On a first look,** A's new glove reads as a bulky mitten clutching an upright handle, and the 'single loop' as a thin cord rising from it. Judge it against mockups A, C, D and dusk-fire.

No camera was re-aimed. The terrain and navmesh are re-baked. Dusk: keyAt is d^0.7; fillAt and duskOf are unchanged.
