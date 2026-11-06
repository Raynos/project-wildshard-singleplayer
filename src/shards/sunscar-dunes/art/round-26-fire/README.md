# Signal Dunes, round 26: real fire (E407 row 6, landed as E409 second top-10 row 3)

The waymark braziers', the signal fire's and the keeper lamp's flame is a flipbook of a real fire simulation, in place
of the procedural noise flame (which stays as the fallback until the book loads).

Files:
- `fire.py`: the Blender 5.2 headless gas sim (Mantaflow). A broad, low ember bed burns in a 1.2 x 1.2 x 2.4 m
  domain (resolution 128; buoyancy and flame vorticity tuned for licking tongues). Frames 70-101 are rendered
  emission-only (Cycles, an orthographic side camera, 256 x 512): 32 frames from the settled burn. Run under the model
  lock.
- `pack.py`: packs the 32 frames into one 8 x 4 atlas, 2048 x 2048. The render's alpha is 0 (emission adds no
  coverage), so its RGB is kept as the premultiplied flame over black. Writes
  `public/assets/sunscar-dunes/fx/fire-book.webp`.
- `atlas-preview.jpg`: the atlas at 1024.

How it plays (`world/fireFx.ts`):
- 16 frames a second, each billboard on its own phase, the next frame cross-faded in.
- Coverage comes from the colour's brightness. The colour is pushed toward mockup C's saturated orange, with white
  only in the core.
- With it (`world/places.ts`, `world/build.ts`):
  - the crown's charred logs glow when the brazier is lit;
  - one short-range point light rides to the lit waymark nearest the player, lighting the plinth and the stone as well
    as the sand's pool;
  - the smoke is lifted from near-black to mockup C's lit grey-brown billow.

Tries (fire.py's comments):
1. A 3.2 m domain at resolution 96: the flame filled a quarter of each cell, and crossed log cylinders combed its base.
2. More fuel and buoyancy: a tall jet out of the frame.
3. The ember bed with moderate buoyancy: the shipped book.
