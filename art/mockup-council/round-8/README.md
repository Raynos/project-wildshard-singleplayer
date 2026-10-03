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
