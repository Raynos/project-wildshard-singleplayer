# Signal Dunes, round 23: the held glove and one loose loop (E407 row 4)

The viewmodel rebuilt from mockup D's hand (and A / C / dusk-fire, which show the same hold): one modelled leather glove
gripping a short whip handle, and ONE loosely coiled loop of plaited cord held low in the lower right. It replaces
glove-hd2 (its baked-in coil was cut away by a discard) and the code-built double ring.

Files:
- `mockup-D-crop.jpg`: the hand in mockup D, the reference.
- `ref-glove3.jpg` (picked), `ref-glove1.jpg`: the glove alone on white, three-quarter view (Qwen-Image-2.1 edit of the
  crop, seeds 3 and 1). No coil: the cord is a code tube.

Detail list (each carried by a part or material):
1. A fist closed round the handle, four distinct fingers wrapping it, the thumb over them: the mesh (image-to-3D).
2. Knuckle folds and creases over the back of the hand: mesh relief + the baked texture.
3. Stitched seams along the back of the hand and the fingers: the baked texture.
4. A flared gauntlet cuff with a seamed band at the wrist: the mesh.
5. Worn, lighter scuffed edges on the knuckles and the cuff's rim: the baked texture.
6. Dark brown leather, matte with a soft sheen: the material (roughness ~0.4).
7. A short plaited handle out of the top and the bottom of the fist: the mesh (the handle's top is where the cord leaves).
8. One loose loop of plaited cord, falling from the fist's top, hanging low: a code TubeGeometry with the plait tile (true
   UVs), not part of the glove model.

Numbers: a hand's size in the viewmodel (the model spans ~0.3 m), pivot at the fist, front toward the camera's -z; one
copy; no collider (a viewmodel); no rig (the crack animates the grip group). Budget: <= 20 k triangles, one 1024 texture
(WebP in the GLB), one draw for the glove + one for the cord.

Pipelines: Hunyuan3D-2 (full shape, painted) and TRELLIS.2 (1024 cascade) on ref-glove3, the better take ships.
