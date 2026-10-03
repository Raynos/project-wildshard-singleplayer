# Mockup council round 16

- sunscar-dunes: capture `progress/sunscar-dunes/20261003-0918-232dbb40` (sha 232dbb40, staged {'mock-B-logbook': 'logbook', 'mock-C-waymark': 'waymarks-lit', 'mock-D-hands': 'waymarks-lit'}, page errors 0)

**The bar is 7.0.** The phase in force is **detail** (E409): this round's work list was round 15's ranked findings. Sky Reach passed in its round 14 and is no longer scored.

### Signal Dunes, round 16

The capture is at 232dbb40, the builder's ready SHA.

Changes since round 15 (generated; covers every shot's camera, every real-camera move or turn, and every commit touching a file that holds a stage handler):

- `mock-D-hands`: x 36 → 38; yaw 22.5 → 21.7; z 92 → 122

Real camera positions (meta.json camAt):
- `h1-spawn-crest`: the real camera moved 1.81 m ([0, 21.24, 70] → [0, 23.05, 70])
- `h2-caravan`: the real camera moved 1.11 m ([-64, 15.12, 38] → [-64, 16.23, 38])
- `h3-waymark`: the real camera moved 11.53 m ([56.6, 14.16, -40.4] → [56.6, 25.69, -40.4])
- `h4-tower-deck`: the real camera moved 0.07 m ([8.4, 26.83, -73] → [8.4, 26.76, -73])
- `mock-A-spawn`: the real camera moved 1.81 m ([0, 21.24, 70] → [0, 23.05, 70])
- `mock-B-logbook`: the real camera moved 1.10 m ([-58.8, 15.13, 42.1] → [-58.8, 16.23, 42.1])
- `mock-C-waymark`: the real camera moved 0.08 m ([-53.9, 17.43, -17.2] → [-53.9, 17.35, -17.2])
- `mock-D-hands`: the real camera moved 30.09 m ([35.99, 25.97, 92.01] → [37.99, 27.59, 121.99])
- `mock-dusk-fire`: the real camera moved 1.81 m ([0, 21.24, 70] → [0, 23.05, 70])

Commits touching staging code between the captures:
- 232dbb408 E409 Signal Dunes round 16 (detail phase, the round-15 seats' list): no camera-distance darkening, the shade back where the mockup

All shard commits between the captures:
- 232dbb408 E409 Signal Dunes round 16 (detail phase, the round-15 seats' list): no camera-distance darkening, the shade back where the mockup
- 46ca3c7f1 E407 Signal Dunes: GPU ceiling re-recorded at the m5 parity measurement of 04f5b02d7 (phone 109.750 -> 109.887 MB, +0.137 MB: the 
- 04f5b02d7 E407 row 10 (Signal Dunes): the learned LUT, fitted from the five mockups against round 15's frames

**The builder's batch, in the lead's order:**
1. **The hard rule:** the late far-land term is removed. Every remaining term that fades with distance from the camera is now zero-mean: ripple troughs carry their mean back, glints pair with dark specks, and the streak has no fade. The builder says no distance fade changes brightness. Seats: verify it, including the late clip.
2. **Shade position:** the wind blows back toward the camera, and the crest is round 15's line with its slip face toward the camera, 30 m wide.
   - The dune band's 10×7 luma grid correlates +0.50 with mockup A (round 13: +0.49) and +0.25 with dusk-fire (round 15: -0.08 / -0.28).
   - Overlay: art/sunscar-dunes/round-22-landforms/overlay-A-duskfire-r16.jpg.
3. **The pale sheet:** traced to the flipped wind, with the key and sheen unchanged.
   - Right of the tower, dusk-fire went 74 → 35 (mockup 46) and A 56 → 34 (mockup 60).
   - Lit-sand saturation is 0.64-0.66 (mockups 0.59-0.66).
4. **Mid-distance ripple amplitude:** 0.7 → 0.26; the near amplitude is unchanged.
5. **Terrain:**
   - B's dune is 26 → 21 m.
   - Waymark 0 sits on a 24 m rise, for C's far brazier.
   - Waymark 1's 10 m lift is back; round 15 removed it because it made a 41-44° face, so check its slopes.
6. **The fist** is turned (y -0.4) so the back of the hand and the cuff face the camera, with the fingers round the handle and lighter, glossier leather. The loop's plane faces the camera, and the cord's fall is routed behind the hand.

**MOVED CAMERA:** mock-D is back at round 14's stand (38, 122), yaw 21.7, which puts the tower at the mockup's size. Round 15 had moved it to (36, 92). No hero camera was re-aimed; h3's real camera rose 11.5 m with its waymark's lift.

**Other notes:**
- Dusk: no stage or curve change.
- Parked for the next zoom-out (uncommitted, not in this capture): row 5's painted skies and row 6's fire flipbook. Row 10's LUT stays as shipped (04f5b02d7).

**The lead's first look:**
- The shade does sit where the mockup's does, but A's middle is now one large, uniformly dark dune face that fills the frame, with the tower barely over its top. The mockup has a lit crest band above its shaded face, and the tower's mound shows. Judge whether the form reads as the mockup's or only correlates with it.
- The new hand holds the handle upright beside the loop. Judge it against the mockups' grip, where the hand holds the handle inside the coil.
