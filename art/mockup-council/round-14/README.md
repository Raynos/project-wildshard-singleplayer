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

- far-reach: capture `progress/far-reach/20261003-0823-ce11353e` (sha ce11353e, staged {'h4-crown': 'quest-crown', 'mock-D-crown-arena': 'roc-opening'}, page errors 0)

## Sky Reach (far-reach), round 14

**The bar is 7.0.** The phase in force is zoom-out: docs/plans/SKY-REACH-TOP10.md. The lead's rulings in scores.md apply.

The capture is the builder's: `20261003-0823-ce11353e`, build ce11353ef. It was built after scripts/gen.mjs, so it shows what ships.

Changes since round 13 (generated; covers every shot's camera, every real-camera move or turn, and every commit touching a file that holds a stage handler; no camera moved):

- no camera changed in cameras.json

Commits touching staging code between the captures:
- 8138fabd4 E392/E399 Sky Reach Roc repair (council round 13, the Roc findings): the tears were the rig's (bindRigid bound each triangle to on

All shard commits between the captures:
- ce11353ef E407 Sky Reach: no grass clumps in the meadow's clearings (round 13, seat A finding 6: the dressing's clumps grew across the crown
- 8138fabd4 E392/E399 Sky Reach Roc repair (council round 13, the Roc findings): the tears were the rig's (bindRigid bound each triangle to on
- 3000a8b71 E407 Sky Reach row 5, second pass: painted cumulus banks, the volumetric cards dropped
- 7119cb4ae E407 Sky Reach top-10 row 5 (volumetric cumulus) and round 13's keel / meadow / o3 fixes
- 97b772624 E407 Sky Reach: keep the LUT file declared as a late read (the engine counts any /assets/lut/<slug>.bin in the build as one, so de
- de148d881 E407 Sky Reach: take the learned LUT out of the build. It never ran in round 13 (the export lacked the untracked file, so loadLUT 
- 3107c0a5a E407 Sky Reach: round-13 progress capture at 8512344bd (top-10 rows 1-4, 7, 8, 10) and the GPU ceilings re-recorded at the measure
- 802c53551 E407 Sky Reach: declare the learned LUT as a late read (boot/files.ts lateReads, manifest boot.lateReads, and its own asset glob)

**The LUT is OFF** (de148d881). Measured live, it greyed C's sky and overshot C's and D's ground and A's and C's highlights, so plan row 10 is open again. Round 13 was also LUT-off, through the capture bug, so the two rounds compare like for like.

**Fixes from round 13, as the builder reports them:**
- **The Roc** (8138fabd4):
  - The tears were the rig binding each triangle to one bone; it now uses blended skin.
  - A 113-vertex lump is deleted, the holes are filled, and the tail's fake claws are painted out.
  - It flies near level, head up.
  - The take-off aims at the LIVE player position, with a three-quarter bank in the turn.
  - A restart or the stage zeroes its speed.
  - D's sun patch over 230 went 3.1 → 20.4 % (mockup 36.7), and D's p99 went 222.5 → 231.4.
  - Still open: the beak and face don't read from D.
- **The keels** (7119cb4ae) fit inside their decks: the widest rock is under the cut, at 0.88 of the deck radius. They're stone only, and the mill sits on the rock mass.
- **The meadow's** camera-distance darkening is now one constant shade.
- **Isle o3** moved to (-40, -214), 44 m from the lap's centre.
- **The dais:** grass clumps skip every meadow clearing, so the compass and paving are clear.

**Row 5, cumulus** (3000a8b71): a Cycles volume cumulus was tried and DROPPED; the builder found it read as CG cotton against the painterly sky (art/far-reach/round-30-cumulus/volumetric/). What shipped is 48 painted cumulus banks between and beyond the isles, with the sun disc kept open.

**Luminance top 1 %, game vs mockup:** proposal B 239.0 vs 238.8, A 239.2 vs 238.4, B 236.4 vs 240.3, C 240.2 vs 235.7, D 231.4 vs 241.4.
