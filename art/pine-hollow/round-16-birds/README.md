# Pine Hollow birds, generated (round 16, 2026-09-24)

The raven, the great grey owl and the pileated woodpecker. Each has two poses: `perch` (standing, wings folded) and `fly`
(gliding, wings flat and horizontal along ±X, legs tucked). They replace the procedural sheets in
`src/pinehollow/life/wildlifeMesh.ts`. All six meshes share one material and one atlas, so the game can draw every bird
in one instanced draw.

| File | What it is |
|---|---|
| `ref-<bird>-<pose>.jpg` | codex image_gen reference: one bird on white. `perch` is a side view; `fly` is seen from above |
| `sheet.jpg` | each reference beside its mesh (textured side / top / 3/4), plus the pivot check: head red, tail blue, wing green, neck yellow, shoulders cyan |
| `public/assets/pine-hollow/life/birds.glb` | meshes `raven_perch raven_fly owl_perch owl_fly wood_perch wood_fly`: POSITION/NORMAL/TEXCOORD_0, one doubleSided material, 2048×1024 WebP q85 atlas (4×2 tiles of 512²; tile 6 is white, tile 7 is grey) |
| `birds.phone.glb` | the same geometry with a 1024×512 atlas (q80) |
| `birds.json` | per mesh: tris, bbox, shoulderL/R, bodyHalfWidth, neck + headAxis (headZ/headY), tailRoot + tailAxis (tailZ), feetY, beak/tail tips, atlas tile |

Frame: glTF/three, metres, beak +Z, up +Y, right wing +X, body centre at the origin. Sizes: raven 0.62 m beak to tail
with a 1.2 m span; owl 0.70 m / 1.4 m; woodpecker 0.45 m / 0.66 m. Budgets: perch ≤ 1 200 tris, fly 900.

All six are Hunyuan3D-2 full + paint, seed 42. Notes:
- The fly generations come from top views, so they tilt; `level` turns the wing plane flat (PCA).
- `flatten` removes droop and dihedral.
- `span` stretches the wings outboard of the body to the species' span.
- The owl's fly body came back as a bas-relief; `inflate 1.7` thickens it.
- The owl perch is torn, so it decimates from a 4 mm voxel remesh (`remesh`).
- The owls' eyes are painted yellow in the atlas (`_grade.eyes`); the generation painted them dark.
- The neck and tail pivots are hand-read from grid renders (`birds.json` in `scripts/img2mesh/birds/`), and the sheet's pivot columns check them.

Rebuild:
```bash
S=<scratch>; C=scripts/img2mesh/birds
# 1. refs: codex image_gen (scripts/horizon-matte/run_codex.py on a 6-job jobs.json), then BiRefNet cutouts + Hunyuan, locked
~/projects/localai/bin/img2mesh/run-locked.sh ~/ml/img2mesh/logs/pine-hollow-birds.log bash -c "
  ~/ml/img2mesh/trellis-mac/.venv/bin/python ~/projects/localai/bin/img2mesh/cutout.py --out $S/cut <ref pngs…> &&
  ~/ml/img2mesh/Hunyuan3D-2/.venv/bin/python ~/projects/localai/bin/img2mesh/hy3d_batch.py --shape full \
    --out ~/ml/img2mesh/out/pine-hollow-birds-hy $S/cut/ref-*.png"
# 2. orient / size / flatten / decimate / chart UVs / bake (1024² per mesh) / measure
blender -b -P $C/birds_post.py -- --config $C/birds.json --out $S/post
# 3. colour-match each bake to its reference (CIELAB), paint the owls' eyes, lay out the atlas
python3 $C/birds_atlas.py --post $S/post --refs $S/cut --out $S/atlas --grade $C/birds.json
# 4. one GLB + phone GLB + sidecar
blender -b -P $C/birds_pack.py -- --post $S/post --atlas $S/atlas --out public/assets/pine-hollow/life
# 5. renders + this sheet (birds_view.py previews a raw generation for picking "rot")
blender -b -P $C/birds_render.py -- public/assets/pine-hollow/life/birds.glb public/assets/pine-hollow/life/birds.json $S/render
blender -b -P $C/birds_render.py -- public/assets/pine-hollow/life/birds.glb public/assets/pine-hollow/life/birds.json $S/seg --seg --size 300
python3 $C/birds_sheet.py art/pine-hollow/round-16-birds $S/render $S/seg art/pine-hollow/round-16-birds/sheet.jpg
```
