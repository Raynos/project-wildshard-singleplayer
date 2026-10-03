# Mockup council round 13

- sunscar-dunes: capture `progress/sunscar-dunes/20261003-0648-50cd2d82` (sha 50cd2d82, staged {'mock-B-logbook': 'logbook', 'mock-C-waymark': 'waymarks-lit', 'mock-D-hands': 'waymarks-lit'}, page errors 0)

**The bar is 7.0** (ledger 4 as Jake amended it). This is the first round on the lead's top-10 lever plan, docs/plans/SIGNAL-DUNES-TOP10.md (E407).

### Signal Dunes, round 13

The capture is at 50cd2d82, the builder's ready SHA.

Changes since round 12 (generated; covers every shot's camera, every real-camera move or turn, and every commit touching a file that holds a stage handler):

- no camera changed in cameras.json

Real camera positions (meta.json camAt):
- `h1-spawn-crest`: the real camera moved 2.58 m ([0, 21.3, 70] → [0, 18.72, 70])
- `h2-caravan`: the real camera moved 9.40 m ([-64, 16.45, 38] → [-64, 7.05, 38])
- `h3-waymark`: the real camera moved 9.08 m ([56.6, 10.91, -40.4] → [56.6, 1.83, -40.4])
- `h4-tower-deck`: the real camera moved 2.48 m ([8.4, 24.28, -73] → [8.4, 26.76, -73])
- `mock-A-spawn`: the real camera moved 2.58 m ([0, 21.3, 70] → [0, 18.72, 70])
- `mock-B-logbook`: the real camera moved 9.39 m ([-58.8, 16.46, 42.1] → [-58.8, 7.07, 42.1])
- `mock-C-waymark`: the real camera moved 4.96 m ([-53.9, 12.55, -17.2] → [-53.9, 17.51, -17.2])
- `mock-D-hands`: the real camera moved 0.32 m ([37.98, 27.27, 122] → [37.99, 27.59, 121.99])
- `mock-dusk-fire`: the real camera moved 2.58 m ([0, 21.3, 70] → [0, 18.72, 70])

Commits touching staging code between the captures:
- none

All shard commits between the captures:
- 50cd2d823 E407 Signal Dunes: GPU ceiling re-recorded at the m5 parity measurement of 073a0e7ed (phone 108.99 -> 109.74 MB, +0.75 MB: the dun
- 5ba40cc0b E407 rows 1 and 3 (Signal Dunes): authored landforms judged from the spawn, and long dune shadows past the ground
- e790c0407 E407 row 1 (Signal Dunes): the dune field reshaped as real dunes: steep slip faces over long windward slopes, the hand patches rem

**Plan row 1: authored landforms** (5ba40cc0b; layout LANDFORMS, world/dunes.ts landforms()):
- A crest spline from (-42, -82) through (-14, -50) to (18, 20), 7 / 13.5 / 12 m high, with a 30 m slip face toward the spawn and a 70 m windward face. It owns its footprint.
- The tower's broad mound: 21.5 m high over 62 m.
- The old crest lines and the near ridge are removed.

**Cameras:** no camera was re-aimed. The real cameras moved with the new ground, as the list above shows (B and h2 dropped about 9.4 m; C rose about 5 m). The builder's self-check overlay of A and dusk-fire against their mockups is art/sunscar-dunes/round-22-landforms/overlay-A-duskfire.jpg (f59c79c30).

Judge the forms from the hero views and the aerials too: they must be real dunes everywhere, not a set built for A. Climbs stay under 40°, and the terrain and navmesh are re-baked.

**Plan row 3: the dune shadow re-baked** on the new field, extended to ±520 m over the skirt (896 texels), with a sharper penumbra with distance and cast shade at 0.28.

**Round 12's should-fixes, as the builder reports them:**
- The late-dusk darkening has no distance gate now.
- The B sand bell is removed.
- The low-sky red stripe in h2 is 0.02 % (blue < 30 and red > 110).
- The near ridge is gone.

**Other notes:**
- fillAt and duskOf are unchanged.
- gpuMB went 108.99 → 109.74 for the bigger shadow map, re-recorded as a ratchet. The phone limits are 1.8 GB / 1.0 GB.
- Rows 2 (the sand material) and 4 (the glove and loop) are next and are NOT in this capture.
