# Sky Reach round 23: the war fan and the layered glove (top-10 row 3, E407 / E392)

Plan: `project/archive/2026-10-03-sky-reach-top10.md` row 3. Targets: mockup C (`round-18-council-mockups/mockup-C-hands-fan-painterly.jpg`)
for the model, mockups A, B, D and proposal B for the hold (modest, lower right).

## Files

| File | What |
|---|---|
| `board-before-after.jpg` | Mockup C, before, after; mockup A, before, after (full portrait frames, footprint numbers on top) |
| `board-zoom.jpg` | The same six, cropped to the fan |
| `side-after.jpg` | All five mockups (top) over the game's mock-* views after the change (bottom) |
| `glove-turntable.jpg` | The new hand model: the ref, eight views, the atlas |
| `refs/glove.jpg` | codex image_gen ref on white: layered gauntlet, lamellar bracer, bound sleeve (from `refs/gen.py glove`) |
| `refs/leaf.jpg` | codex image_gen flat silk texture (from `refs/gen.py leaf`), shipped as `public/assets/far-reach/fan/leaf.webp` 1024 x 512 at 0.92 brightness |
| `refs/gen.py` | the two codex prompts and the parallel runner |
| `fanviews.mjs`, `fanmask.py`, `mockiou.py`, `measure.json` | the measuring: the views with the viewmodel's triangles projected to the 390 x 844 frame (exact mask), the mockups' fan + hand traced as polygons, left / top / share / IoU |

## Detail list (mockup C) and where each one lives

1. Angular guards: `fanModel.ts` `guardShape` (a faceted outline: slim root, shaft, shoulder, point) extruded with a real
   1.3 mm chamfer in dark lacquer, on a 2.6 mm larger bronze-iron backing so a metal rim runs round it.
2. Angular end plates: `guardPlate` (a faceted arrowhead with a pierced diamond, chamfered), at the tip and the root.
3. Rivets along each guard (bronze studs) and a stud on every stick where the leaf starts.
4. Lacquered ribs: glossier lacquer (roughness 0.36), unchanged stick layout.
5. Folded silk: pleat crease 18 mm (was 10 mm), the turned-away face at 0.62 (was 0.72); the new painted leaf (larger cloud
   swirls, worn gilt rim, a dark inner band).
6. Gilt rim tube 3 mm (was 2.4 mm).
7. Red tassel: now hangs plumb from the pivot boss in front of the fist (mockup C), swaying; it hung below the fist, off
   the frame.
8. Layered glove: codex ref → BiRefNet → Hunyuan3D-2 turbo shape + 2048 paint → `finish.sh` (12 000 tris, 1024 WebP,
   meshopt; 214 KB desktop): fingerless gauntlet with plates over the back of the hand and the knuckles, a bracer of
   overlapping bronze-edged lames with two buckled straps and an embossed cloud, a linen sleeve bound with cords. Same
   file frame as round 20 (handle at −X, forearm +X), so `glove.ts heroHand` places it unchanged.

## Numbers

- The hold (`WarFan.ts HOLD`): one hold for every view, `{ x 0.155, y −0.194, z −0.6, pitch 0.35, yaw −0.5, roll 0.55,
  scale 0.46 }` (was `{ 0.135, −0.205, −0.6, 0.22, −0.2, 0.95, 0.46 }`): the pivot at about (345, 610), the leaf opening
  up and left, the right guard running off the frame's edge.
- Measured footprint (fan + hand, 390 x 844; mockups traced by hand):

| View | Mockup left / top / share | Before left / top / share, IoU | After left / top / share, IoU |
|---|---|---|---|
| C | 120 / 412 / 13.6 % | 171 / 454 / 7.8 %, 0.33 | 201 / 480 / 6.6 %, 0.45 |
| A | 240 / 480 / 5.6 % | 171 / 456 / 7.8 %, 0.35 | 201 / 479 / 6.6 %, 0.67 |
| B | 275 / 453 / 4.5 % | 171 / 453 / 7.7 %, 0.22 | 201 / 477 / 6.5 %, 0.46 |
| proposal B | 200 / 475 / 8.3 % | 171 / 459 / 7.8 %, 0.48 | 201 / 484 / 6.6 %, 0.53 |
| D | (a sliver at the edge) 335 / 561 / 0.8 % | 171 / 458 / 7.8 %, 0.04 | 201 / 481 / 6.6 %, 0.09 |

- C's hero framing (13.6 % of the frame) is reached by no ordinary pose, so the one modest hold stays (brief, ledger 5).
- Triangles: the hand 12 000 (as before); the fan adds the chamfered guards (a few hundred). Textures: the leaf stays
  1024 x 512, the hand map stays 1024.
