# Sky Reach top-10 row 10: the keeper set (E410 row 8)

Mockup B's keeper, his carved lectern and its hanging lantern, modelled (Codex round 13 finding 7: "refine the keeper's
face, open fingers and layered coat/scarf/satchel volumes; give the lectern a carved weathered support and attach the
lantern so its hanging relationship reads; keep readable open pages and the quest interaction").

Pipeline: refs/gen.py (codex image_gen, one object each on white, from mockup B) -> BiRefNet cutout -> Hunyuan3D-2 turbo
shape + 2048 paint (~40 s each) -> finish.sh (Blender decimate, re-UV, bake, WebP, meshopt). TRELLIS.2 was not needed:
the Hunyuan takes kept the coat, scarf, satchel, staff and the carved post.

| File | What |
|---|---|
| refs/gen.py | the four prompts (keeper, keeper-b, lectern, lantern) |
| refs/ref-keeper.jpg | take A: both arms out, both hands open, the staff stood beside him (not shipped) |
| refs/ref-keeper-b.jpg | take B, shipped: right arm held out from the coat with an open gloved hand, the staff gripped in his left, as in mockup B; no lantern on the staff |
| refs/ref-lectern.jpg | the carved lectern: iron-strapped plinth, turned post with a leaf-scroll band, slanted empty desk, a wrought-iron arm with a hook |
| refs/ref-lantern.jpg | the iron-and-brass lantern with amber panes |
| turntable-keeper.jpg, turntable-lectern.jpg, turntable-lantern.jpg | each model: ref + 4 views (front, sides, back) |
| board-b.jpg | A mockup B / B round 14 (progress 20261003-0823) / C new, full frame and the keeper crop |
| board-h1.jpg | h1 (the bridge view) before and after, and the stand's crop: the carved post, the iron arm, the lit lantern on its hook |
| board-close.jpg | a 4.7 m close-up of the set (x -1.2, z -9.6, yaw 12, pitch -8), before (HEAD cad1be5b9) and after |

Numbers (measured on the fitted models, the code reads them):
- keeper: public/assets/far-reach/models/keeper-hd/keeper-hd.glb (replaced in place), 14k tris, 1024 WebP, 296 KB; fitted
  to 1.95 m. His right arm is every triangle outboard of x = -0.506 + 0.185 y between y 0.85 and 1.6 (the sleeve-coat gap
  runs from x -0.34 at y 0.9 to -0.22 at the shoulder), shoulder pivot (-0.25, 1.5, 0.03), elbow (-0.5, 1.24) with a cut
  square to the arm (a level cut halved the wide cuff). The arm is modelled held out: at idle the shoulder lowers it
  0.3 rad; the wave keeps the upper arm out and down (+0.1) and folds the forearm up 2.3 rad, so the open hand stands
  beside his head with the elbow out at his chest, as in mockup B (a first take lifted the upper arm level and showed the
  bell cuff as a block).
- The after shots were taken on a preview with the working tree's far-reach assets, so they carry another lane's sky.
- lectern: models/lectern-hd/lectern-hd.glb, 8k tris, 1024 WebP, 129 KB; fitted to 1.12 m (the collider's height). Desk
  plane y = 1.022 - 0.625 z (tilt 0.56 rad, front low), its centre (0, 1.006, 0.025); the hook's bottom at (0.39, 0.67, 0).
- lantern: models/lantern-hd/lantern-hd.glb, 3k tris, 512 WebP, 68 KB; 0.42 m (mockup B: the lantern is 0.38 of the
  lectern's height, 65 of 170 px), its ring on the hook; the amber panes burn (emissive by the paint's colour), a small
  additive halo round the glass.
- The code-built open book sits on the modelled desk; the code stand and its ground lantern stay the fallback. The notes
  lectern on the keeper's isle is the same lectern without the lantern. Colliders unchanged.
