# Mockup council round 23

- sunscar-dunes: capture `progress/sunscar-dunes/20261003-1325-8f296fb4` (sha 8f296fb4, staged {'mock-B-logbook': 'logbook', 'mock-C-waymark': 'waymarks-lit', 'mock-D-hands': 'waymarks-lit'}, page errors 0)

**The bar is 7.0.** The phase in force is zoom-out: docs/plans/SIGNAL-DUNES-TOP10-3.md, with rows 1-4 attempted and the queued rows 5-7 (aab0d0a2f) in. The lead's rulings in scores.md apply.

### Signal Dunes, round 23

The capture is `20261003-1325-8f296fb4`, at the builder's ready SHA 8f296fb4b (with aab0d0a2f).

Changes since round 22 (generated; covers every shot's camera, every real-camera move or turn, and every commit touching a file or asset of the shard):

- no camera changed in cameras.json

Commits touching staging code between the captures:
- 8f296fb4b E409 Signal Dunes TOP10-3 row 2 (partial): the late faces turned from the afterglow fall to a quarter, from gentler slopes
- aab0d0a2f E409 Signal Dunes round 23 (seat B after round 21): two coils ~0.5 wide, tops near y 0.60; lit sand and the lantern pool toward go

All shard commits between the captures:
- 8f296fb4b E409 Signal Dunes TOP10-3 row 2 (partial): the late faces turned from the afterglow fall to a quarter, from gentler slopes
- a1563f4a9 E409 Signal Dunes TOP10-3 row 4: D's late-sky shift smooth across headings (no window edge in any frame)
- 0add5da36 E409 Signal Dunes TOP10-3 row 1: the spawn pair's lit faces where the mockups light them (a ridge from the spawn's right toward th
- aab0d0a2f E409 Signal Dunes round 23 (seat B after round 21): two coils ~0.5 wide, tops near y 0.60; lit sand and the lantern pool toward go

**Row 1, done (0add5da36): the terrain moved; no camera or pose moved.**
- **The builder's reason:** under the shipped key (low, ahead), a face the spawn eye sees catches the key only as a flank turned west, seen side-on. A face tilted away hides behind its own crest.
- **The change:** the second crest is now a ridge from the spawn's right, (11.6, 54.4), toward the tower, with its slip face west.
- **How it was shaped:** with a per-pixel predictor (each pixel's ray to the ground, the sand shader's wrap term, a shadow march to the key), correlated with the A and dusk-fire mockups and hill-climbed under 39°. Then the builder checked it in captures.
- **Seat B's windows, mockup / round 22 / now:**

  | Window | Mockup | Round 22 | Now |
  |---|---|---|---|
  | A's diagonal | 96.5 h20 | 46.3 h352 | 86.9 h24 |
  | A's lee | 42.5 | 32.7 | 47.5 |
  | A's near ground | 57.1 | 71.6 | 60.5 |
  | dusk-fire's shoulder | 83.7 | 77.9 | 74.2 |
  | dusk-fire's saddle | 49.5 | 39.7 | 30.9 |

  Dusk-fire's saddle is WORSE: it now sits in the ridge's shadow.
- **Row-mean-removed correlation:** dusk-fire +0.56, A +0.47.
- **Other checks:** climb 39.1° (the field's own face). The walk-test file is committed: progress/physics/sd-r23-b-muspl0kj.json, 0 stuck. h1 and both aerials were checked.
- **Seats:** this terrain was shaped by correlating with two mock frames. It is real, walkable terrain, but judge whether it reads as part of one dune sea from h1-h4 and the aerials (ledger 5's one world).

**Row 2, partial (8f296fb4b), by facing only:**
- The late away-from-glow term goes from ×0.55 to ×0.25, starting on gentler slopes.
- D's land went 37 → 35 (mockup 17), and C's far band 35 → 31 (mockup 27).
- The builder found D's rows are the waymark rise's own glow-facing downslope, 7-36 m out, so their alternation needs landform. Two transverse-ridge trials failed and were not shipped.

**Row 3, partial:**
- The near-left slope is lit by row 1 (shoulder 74 against the mockup's 84).
- The ray's route is unchanged. Its patrol phase at capture depends on load timing, so placing it upper-left would be staging. That's the right call under ledger 5.

**Row 4, done (a1563f4a9):** D's late-sky shift is full within ±10° of heading 341, and eases to none by ±70°. The strip's largest red step per 3° of heading went 21.2 → 3.7 at 10° elevation (the bar: 15). D's rows are unchanged.

**Queued rows 5-7 (aab0d0a2f):**
- **The hold:** two coils about 0.5 wide, tops at y 0.57-0.60 in A, B and C, with the fist on the coil's right side.
- **Lit sand hue:** the direct light's luma-saturation went 2.5 → 1.6.
- **B's lantern pool:** h3 → h11 (mockup h15).

**The builder's lit-quarter hue and saturation:** A h27 s0.44 (mockup h21 s0.67), dusk-fire h25 s0.46 (mockup h22 s0.68). The hue is close; the saturation is short.

**The lead's first look:** A is the closest frame yet. A big lit diagonal dune face crosses the middle of the frame as in the mockup, and the hold is now two loose coils.
