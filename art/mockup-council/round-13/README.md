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

- far-reach: capture `progress/far-reach/20261003-0719-8512344b` (sha 8512344b, staged {'h4-crown': 'quest-crown', 'mock-D-crown-arena': 'roc-opening'}, page errors 0)

## Sky Reach (far-reach), round 13

This is the first round on the lead's top-10 lever plan (project/archive/2026-10-03-sky-reach-top10.md, E407). **The bar is 7.0.** The lead's rulings in scores.md apply: A's cluster over the mill, and the sky band following mockups A and C.

The capture is the builder's: `20261003-0719-8512344b`, build 8512344bd.

Changes since round 12 (generated; covers every shot's camera, every real-camera move or turn, and every commit touching a file that holds a stage handler; no camera moved):

- no camera changed in cameras.json

Commits touching staging code between the captures:
- fcd630bca E407 Sky Reach top-10 row 8: the hero Storm Roc. A Hunyuan3D-2 eagle from codex references of mockup D's (art/far-reach/round-27-r
- 8e707af7b E407 Sky Reach top-10 row 2: modelled trees. Five Hunyuan3D-2 trees from codex references of the mockups' trees (art/far-reach/rou

All shard commits between the captures:
- 8512344bd E407 Sky Reach top-10 row 10 (the grade): one learned LUT fitted from the council's five mockups against the game's pre-LUT captur
- e0e4b837c E407 Sky Reach top-10 row 4: a green, varied meadow
- c045b9ed7 E407 Sky Reach top-10 row 7: the crown arena's carved set. Two Hunyuan3D-2 standing stones with spiral runes cut into their faces 
- fcd630bca E407 Sky Reach top-10 row 8: the hero Storm Roc. A Hunyuan3D-2 eagle from codex references of mockup D's (art/far-reach/round-27-r
- 073a0e7ed E407 Sky Reach row 1, the lead's notes (a)-(b): the isles' canopies lush green lit warm (the shader dimmed the turf toward olive-g
- 72a093273 E407 Sky Reach: GPU ceilings re-recorded at the m5 parity measurement of 8e707af7b (phone 210.81 -> 234.39, desktop 325.27 -> 348.
- a9454b567 E407 Sky Reach top-10 row 3: the modelled war fan and layered glove at one modest hold
- 8e707af7b E407 Sky Reach top-10 row 2: modelled trees. Five Hunyuan3D-2 trees from codex references of the mockups' trees (art/far-reach/rou
- ed47e72fa E407 Sky Reach top-10 row 1: modelled floating islands. Six Hunyuan3D-2 models from codex references of the mockups' islands (art/

**Plan rows in this capture:**
- **Row 1, modelled islands:** six Hunyuan3D-2 islands (ed47e72fa; art/far-reach/round-25-isles), with the canopy lift and tiers in 073a0e7ed.
- **Row 2, trees:** five Hunyuan3D-2 tree models (8e707af7b; art/far-reach/round-26-trees).
- **Row 3, the fan and glove:** a smaller, lower hold (a9454b567). The builder measures its overlap with each mockup's fan (IoU) at A 0.35 → 0.67 and B 0.22 → 0.46.
- **Row 4, a green, varied meadow** (e0e4b837c).
- **Row 7, the carved crown set:** stones with spiral runes and a compass dais (c045b9ed7).
- **Row 8, a Hunyuan3D-2 eagle Roc** from mockup D (fcd630bca).
- **Row 10, first half: a shard LUT fitted to the five mockups** (8512344bd). The builder's predicted colour error (dE00) is sky 2.1, storm 3.3, low sky 2.1, isles 4.8, meadow 1.0. It is one global grade, which the plan allows; the seats judge whether it hides a material gap (ledger 5: a global grade that hides a material gap).

**Should-fixes kept from rounds 10-12:**
- The take-off faces the entrance.
- A retry resets the Roc to its perch.
- Crag o6 is out of the arena's airspace.
- h3 faces the step.

**Other notes:**
- The top 1 % of luminance is 229-238 in all five views.
- The GPU ceilings were re-recorded: phone 249 MB, desktop 364 MB. The phone limits are 1.8 GB / 1.0 GB.
