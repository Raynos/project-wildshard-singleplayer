# Signal Dunes, round 27: the glove re-posed (E409 second top-10, row 4)

Every seat from round 14 to 17 asked for the back of the hand and the cuff toward the camera, as mockups D and dusk-fire
hold the whip. glove-hd3 (round 23) was modelled from the finger side, and no turn of it shows its back in the frame. The
lead's order: re-pose it through mockup-to-model, the same budget.

Files:
- `mockup-D-hand.jpg`, `mockup-duskfire-hand.jpg`: the hands in the two mockups, the references' sources.
- `ref-duskfire.jpg` (picked), `ref-D.jpg`: the glove alone on white, posed as the mockups hold it (back of the hand and
  the knuckles to the viewer, the fingers round a short plaited handle, the cuff toward the lower right). codex
  image_gen from the crops (`ref.py`, both in parallel).
- `views.jpg`: glove-hd4 from four sides (Blender stills): no holes, no backdrop card, the handle through the fist.
- `board.jpg`: dusk-fire mockup | the game (A) | D mockup | the game (D), the same crop.
- `post.sh`: the post (weld, simplify to 18 k triangles, the paint at 1024 WebP, meshopt).

Detail list (each carried by a part or material):
1. A fist closed round the handle, the back of the hand and the knuckle row to the camera: the mesh (Hunyuan3D-2).
2. Creases and scuffs over the back of the hand, stitched seams: the painted texture.
3. A flared gauntlet cuff with a seamed band at the wrist, opening toward the lower right: the mesh.
4. Dark brown worn leather, a soft sheen: the material (`world/meshes.ts`, the same as glove-hd3's).
5. A short plaited handle out of the top and the bottom of the fist: the mesh; the cord leaves its top
   (`weapons/whipModel.ts` LOOP.from, the top cluster of the model's vertices).
6. The loop: the code TubeGeometry with the plait tile, a teardrop rising from the handle's top, the fall behind the hand.

Numbers: Hunyuan3D-2 full shape, 2048 paint, 60 k faces, simplified to 18 000 triangles (glove-hd3: 18.9 k), one 1024
WebP texture, 202 KB. One copy, no collider, no rig (the crack animates the grip group). Pipeline: Hunyuan3D-2; the
references came back clean (no backdrop card), so the round-23 card strip was not needed.
