# Mockup council round 21

- sunscar-dunes: capture `progress/sunscar-dunes/20261003-1206-21fe6dbf` (sha 21fe6dbf, staged {'mock-B-logbook': 'logbook', 'mock-C-waymark': 'waymarks-lit', 'mock-D-hands': 'waymarks-lit'}, page errors 0)

**The bar is 7.0.** The phase in force is detail (E409). The lead's rulings in scores.md apply, including the new fog ruling: aerial perspective is allowed only toward the horizon sky's colour and value.

### Signal Dunes, round 21

The capture is `20261003-1206-21fe6dbf`, which contains the builder's ready SHA 234085dba (Handoff 21fe6dbf4).

Changes since round 20 (generated; covers every shot's camera, every real-camera move or turn, and every commit touching a file that holds a stage handler; no real camera moved):

- no camera changed in cameras.json

Commits touching staging code between the captures:
- 234085dba E409 Signal Dunes round 21: A's second crest turned so its lit edge falls left to right (seat B; edge trace 0.41 0.40 0.40 0.42 0.
- 28a1cf5f1 E409 Signal Dunes: REVERT 52d05dae0's dusk-thickening fog (the lead's ruling after round 20); aerial perspective toward the horizo
- 52d05dae0 E409 Signal Dunes: the night haze thickens with the dusk (the engine's distance fog, x1 -> x3 from Sefa's dusk to the last waymark

All shard commits between the captures:
- 234085dba E409 Signal Dunes round 21: A's second crest turned so its lit edge falls left to right (seat B; edge trace 0.41 0.40 0.40 0.42 0.
- 28a1cf5f1 E409 Signal Dunes: REVERT 52d05dae0's dusk-thickening fog (the lead's ruling after round 20); aerial perspective toward the horizo
- 52d05dae0 E409 Signal Dunes: the night haze thickens with the dusk (the engine's distance fog, x1 -> x3 from Sefa's dusk to the last waymark
- 26b822665 E409 Signal Dunes round 21 (the lead's viewmodel ask): the whip held as the mockups hold it, a coil hanging low in the lower-right

**The builder's batch since round 20:**
- **The coil** hangs low in the lower right (26b822665).
- **C's upper sky** is violet-navy (f4effe449): (28, 27, 54) against the mockup's (39, 32, 57).
- **The fog revert** (28a1cf5f1): 52d05dae0 had pushed a fog that thickened with the dusk. It never reached a scored frame. The fog is now one density (0.0028) at every dusk step, coloured the horizon sky's lighter violet-blue 0x5e5288, never toward black.
- **C's white core** is gated by its place in the flame, low and central over the logs: about 1,700 px over 245 against the mockup's ~2,600, with the tongues orange.
- **A's second crest** (234085dba) is turned so its west end stands highest (20.3 → 10.8 m) and its lit edge falls left to right.
  - Edge trace for x 0.1-0.5: 0.41 0.40 0.40 0.42 0.42; the mockup's 0.37 0.39 0.40 0.42 0.44.
  - Row-mean-removed correlation: A +0.61, dusk-fire +0.31.
  - Climb 39.1°, walk 0 stuck, navmesh re-baked.
- **B's cookfire wisp** leans 0.025, so it rises over the wagon.
- **C's plume** is wider (0.2), to read as a billow.
- **The lantern light** is amber 0xffb766 at 3 cd, and the fire's light 0xff7a30.
- **The low sky** is averaged over ±2° of heading and held at 0.8° (for D's peak and h3's band).

**Still open (the builder says):** D's dark land bands, B's magenta band, C's core count, and the LUT re-fit last.

**The lead's first look:**
- The coil now hangs low (good).
- The fog toward the light violet-blue sky colour makes A's mid-distance dunes and D's far land milky lilac. The mockups keep A's dunes warm amber and D's bands dark. Judge whether the fog now washes the land out.
- D's sky has pink cloud streaks its mockup does not have.
