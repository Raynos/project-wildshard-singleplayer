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

- far-reach: capture `progress/far-reach/20261003-0601-3307e64a` (sha 3307e64a, staged {'h4-crown': 'quest-crown', 'mock-D-crown-arena': 'roc-opening'}, page errors 0)

## Sky Reach (far-reach), round 11

The capture is the builder's: `20261003-0601-3307e64a`, built at 3307e64a2. **The bar is now 7.0** (Jake amended ledger 4 on 2026-10-03; the no-shortcut rules are unchanged).

The lead's rulings apply (scores.md):
- **The round-8 cluster ruling:** the world follows mockup A's cluster over the mill.
- **The new sky ruling:** the shared sky band follows mockups A and C, so proposal B's sky is scored on its finish (cloud structure, gradation, haze), not its saturation.

Changes since round 10 (generated from the two captures, `20261003-0516-750b533a` → `20261003-0601-3307e64a`; the list covers every shot, and no real camera moved):

- no mock-* camera changed

Commits touching staging code between the captures:
- none

All shard commits between the captures:
- 3307e64a2 E399 Sky Reach, round 10 (seat A item 3, every seat's 'an overlapping cluster'): two more crags in the cluster over the mill (o5, 
- 21d5e913c E399 Sky Reach: the dome's highlight roll-off round the sun stronger and wider (0.28 to 0.42 within ~18 deg; the glow card keeps t
- 3de757394 E399 Sky Reach, the Roc's soaring wings nearly level (dihedral 0.3 to 0.1 rad; round 10, seat A: 'wings level'; round 8's raised V
- a28f585cb E399 Sky Reach, council round 10 (seat A items 4, 7): the free drift ray's luminous wake (world/rayWake.ts: a ribbon along its own

**Builder's claims to verify:**
- **The cluster:** five overlapping crags in one band over the mill (o5 and o6 added), lighter, with the gold rims kept.
- **The Roc:** its wings are near level (dihedral 0.1 rad), so both spread wide under the bar. The frame looks alike at settles of 3.0-3.7 s. The take-off direction is unchanged. Round-10 seat B found it flies away from D's camera, and that finding has been sent to the builder.
- **D's sun glare:** the middle band's share over 230 is down from 9.1 % to 6.5 % (mockup 5.0), from a stronger dome roll-off near the sun. Every view's top 1 % is still 236-240. Measure on fan-free ground: round-10 seat B found that the bigger fan covers part of that band.
- **Proposal B:** the free ray circles beside the mill, inside the frame on most laps, with a luminous wake ribbon along its real flight path (a28f585cb, world/rayWake.ts).
- **The meadow:** tighter daisy drifts.
- **Checks:** the walk baseline is 0 stuck, and the tests are green.
