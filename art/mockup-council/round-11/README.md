# Mockup council round 11

- sunscar-dunes: capture `progress/sunscar-dunes/20261003-0511-ea6ccc86` (sha ea6ccc86, staged {'mock-B-logbook': 'logbook', 'mock-C-waymark': 'waymarks-lit', 'mock-D-hands': 'waymarks-lit'}, page errors 0)

### Signal Dunes, round 11

The capture is at ea6ccc86, which contains the builder's ready SHA 17d14b684. Parity is green at that SHA (walk 0 stuck, gpuMB within 108.99).

Changes since round 10 (generated from the two captures, `20261003-0432-0ae71b2a` → `20261003-0511-ea6ccc86`; the list covers every shot):

- no mock-* camera changed

Real camera positions (meta.json camAt):
- `h3-waymark`: the real camera moved 0.28 m ([56.6, 11.19, -40.4] → [56.6, 10.91, -40.4])
- `h4-tower-deck`: the real camera moved 0.16 m ([8.4, 24.44, -73] → [8.4, 24.28, -73])

Commits touching staging code between the captures:
- none

All shard commits between the captures:
- 17d14b684 E399 Signal Dunes: the hand (round 10 item 5): the plait's strands darker with a glancing sheen from their own relief (a viewer-si
- 5ad312ab6 E399 Signal Dunes: the waymark fire as overlapping licks with a hot region over the logs (round 10 item 7: graphic, 32 % of the mo
- ed29a4b79 E399 Signal Dunes: the cloud banks thin overlapping filaments with holes and darker cores (round 10 item 6: soft caramel clumps; a
- e62382ae4 E399 Signal Dunes: the crest line a long diagonal crest and slip face ((-24, -52) to (52, 40), 10 m, ends tapered over 14 %; round
- 52142e83c E399 Signal Dunes, council round 10 findings: the near field and the early sky to the spawn mockups, the late far land lit not bla
- 219adb0c3 E405: shard EquipmentSlotMap merges into its defining module (#engine/combat/Equipment), like src/game/equipmentTypes.ts — the mer
- 84a9e99f6 E399 Signal Dunes: the crest line stands apart from the tower's dune (a trough 5 m deep behind it, so its far face no longer runs 
- d97e223c4 E399 Signal Dunes: the crest line's steep lee toward the spawn and longer ((-34, -52) to (22, 16), 8 m, lee 17 m, windward 26 m; m
- 8a26244f7 E399 Signal Dunes: the cookfire's wisp curls, widens and fades as it rises (the seats: a straight pale column; mockup B's smoke a 
- b767507b6 E399 Signal Dunes: the caravan as mockup B shows it, its open back to the approach (the generated wagon turned 180 deg: its arched
- 1fc799b67 E399 Signal Dunes: the waymark flame textured (the seats: a soft sprite; mockup C's fire is many thin flickering licks): fine vert

**Cameras:**
- No mock camera was re-aimed.
- Two hero cameras moved slightly with the terrain: h3 by 0.28 m and h4 by 0.16 m. The builder named h4 but not h3.

**Terrain changed:**
- The crest line is now a long diagonal crest and slip face, (-24, -52) to (52, 40), 10 m, with its lee toward the spawn and a trough behind it.
- The caravan was turned 180°, so its open back and tailboard face the approach.
- The navmesh is re-baked.

**Staging and the dusk values are unchanged** since round 9.

**Builder's claims to verify** (measure.py now uses seat B's clean patch, x 10-190, y 1160-1420):
- Near sand, game / mockup:
  - dusk-fire 74.6 / 73.8;
  - A 78.2 / 57.4 (the builder's own number shows A still well over);
  - B 35.2 / 39.7;
  - C 34.0 / 32.3;
  - D 33.6 / 34.5.
- The glow line shows only late in the dusk.
- The far-land fill starts only from 30 m (round 10's should-fix: the fade to black from 8 m).
- The lantern halo is depth-tested and 0.5 m (round 10's should-fix: a 2.4 m card with depth testing off).
- The clouds are filaments, and the ranges darker.
- The fire has side tongues: pixels over 230 went from 828 to 2,403.
- The cookfire's wisp curls.
- The plait has a sheen, and the gauntlet is darker.
- The hold is at y -0.245.
