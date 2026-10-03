# Mockup council round 24

- sunscar-dunes: capture `progress/sunscar-dunes/20261003-1406-7db2a5a2` (sha 7db2a5a2, staged {'mock-B-logbook': 'logbook', 'mock-C-waymark': 'waymarks-lit', 'mock-D-hands': 'waymarks-lit'}, page errors 0)

**The bar is 7.0.** The phase in force is detail (E409): this round's work list was round 23's findings. The lead's rulings in scores.md apply.

### Signal Dunes, round 24

The capture is `20261003-1406-7db2a5a2`, at the builder's ready SHA 7db2a5a26. The batch is 5d0be40ff, a5dc51367, 8382bdad6, 81c1f8034, 38496b429 and 7db2a5a26.

Changes since round 23 (generated; covers every shot's camera, every real-camera move or turn, and every commit touching a file or asset of the shard):

- `mock-D-hands`: x 38 → 25; yaw 21.7 → 19.7; z 122 → 75

Real camera positions (meta.json camAt):
- `mock-D-hands`: the real camera moved 49.11 m ([37.99, 27.59, 121.99] → [25.01, 21.7, 74.99])
- `mock-D-hands`: the real camera turned 2.0 deg ([-0.37, -0.035, -0.929] → [-0.337, -0.035, -0.941])

Commits touching staging code between the captures:
- 7db2a5a26 E409 Signal Dunes round 24 (the round-23 seats): the coil right and smaller; the late troughs floored; the ridge's south end taper
- 5d0be40ff E409 Signal Dunes TOP10-3 row 6: the sunset's lit sand saturated and gold (the direct boost by the dusk; the fill warm on key-lit 

All shard commits between the captures:
- 7db2a5a26 E409 Signal Dunes round 24 (the round-23 seats): the coil right and smaller; the late troughs floored; the ridge's south end taper
- 81c1f8034 E409 Signal Dunes: D's horizon glow line peach and bright (seat C: 131 against 166)
- 8382bdad6 E409 Signal Dunes TOP10-3 row 8: B's night sky clean (the early painting averaged across headings toward B only)
- a5dc51367 E409 Signal Dunes TOP10-3 row 7: B's cookfire plume rises over the wagon (x 0.71 -> 0.565, mockup 0.527)
- 5d0be40ff E409 Signal Dunes TOP10-3 row 6: the sunset's lit sand saturated and gold (the direct boost by the dusk; the fill warm on key-lit

**MOVED CAMERA (38496b429): mock-D-hands, from (38, 122) yaw 21.7 to (25, 75) yaw 19.7.**
- The builder's reason: D stood on the waymark rise, so its land rows were that rise's own glow-facing downslope, lit flat. From the new spot, D looks across the ridge's slip faces at the tower (151 m, frame x 0.85), with a lit waymark on the left. Pitch, stage and settle are unchanged.
- **The lead flags this hard.** It is mock-D's third relocation in this council: (118, 88) → (38, 122) in round 8, → (36, 92) in round 15, back in round 16, and now (25, 75). Ledger 5 voids a score when a view is moved to make it match, unless the new stand is where the mockup's composition actually is.
- **Seats, decide:**
  1. Does the new stand reproduce mockup D's composition: an overlook across long dark bands to the tower at the right, with its distance and the tower's size?
  2. Is it a place a player reaches and would stand?
  3. Was it chosen to escape a land problem (the flat-lit rows) that the shard should fix in its terrain instead?

  If you find it a breach, say so and score D as void.

**Terrain:** the ridge's south end is lowered and tapered into the field (to 14 m at (14, 62)). The walk test is 0 stuck (file progress/physics/sd-r24-b-musrfqm6.json), and the navmesh is re-baked.

**Dusk:** the direct-light saturation is now 2.5 at sunset, easing to 1.6 by the logbook step (a time-of-day term).

**Round 23's items, as the builder reports them:**
1. **A's trough: NOT fixed.** It is the ridge's own west flank, and every shift that shades it costs the diagonal or dusk-fire. A's diagonal is 78.9 h18 (mockup 96.5), r +0.52.
2. **The coil:** the handle's top now sits at the coil's upper left, so the turns hang right of it and behind the fist, smaller: x about 0.45-0.85, top about 0.6 in A, B and C. C's plinth is clear.
3. **Warm lit sand** (5d0be40ff): A's lit quarter is 130, 90, 66 h22 s0.49 (mockup 172, 95, 55 h21 s0.68). The hue holds; the saturation is still short.
4. **The floor:** the late term is ×0.45, not ×0.25.
   - D's band below luma 8 is 2.6 % (round 23: 11.5 %; accept at ≤ 3 %), and C's 2.1 %.
   - D's median is 33.6: not met (accept at ≤ 25; mockup 14).
5. **Dusk-fire's saddle** went 31.4 → 47.4 (mockup 49.5); its correlation is +0.59.
6. **The ridge's cap** is tapered, and the aerial's lens has shrunk.

**Also:**
- B's plume peaks at x 0.565 (mockup 0.527).
- B's night sky is clean.
- D's glow line is 200, 140, 105 (mockup 198, 140, 105).

**Known open, measured clear of the coil:**
- A's near sand is 88 against the mockup's 68, still too bright.
- Since the sunset saturation change, aerial-spawn shows a vivid orange key-lit patch at the lower right, bounded by a baked shadow edge.
