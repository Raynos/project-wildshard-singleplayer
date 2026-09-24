# Pine Hollow creatures, generated + rigged (PINE-HOLLOW-REMASTER PH-M1 / PH-M2, 2026-09-24)

The deer, boar, elk and bear remodelled from photoreal codex references, image-to-3D, PBR-finished and rig-baked onto the
species' own procedural skeletons (Nalati's A1 step 5 pipeline, shard-agnostic). The game loads the rigged copies in
`public/assets/pine-hollow/creatures/<hull>[.phone].rigged.glb` (`src/entities/pineCreatures.ts`); `?creatures=proc` is
the procedural fallback.

| File | What |
|---|---|
| `ref-<hull>.jpg` | codex image_gen reference: one animal, white background, side / slight 3/4, legs planted apart, head straight |
| `<hull>.glb`, `<hull>.phone.glb` | the rig-ready hull: PBR base colour (colour-matched to the reference) + tangent-space normal map, 1024² / 512² WebP |
| `board-<species>.jpg` | versus board per hull: reference · procedural before · generated after (in engine, desktop, day) |

Hulls: `deer-hind` (TRELLIS.2), `deer-stag`, `boar`, `elk-cow`, `elk-bull`, `bear-black`, `bear-brown` (Hunyuan3D-2 full +
paint). TRELLIS.2's Mac port leaves shaggy coats (manes, the boar's bristles, the bears) as open, holed shells, so those
are Hunyuan's watertight meshes; the hind's short coat came out clean on TRELLIS.

Rebuild one hull:
```bash
# 1. generate (under the machine-wide lock)
~/projects/localai/bin/img2mesh/run-locked.sh ~/ml/img2mesh/logs/x.log ~/ml/img2mesh/Hunyuan3D-2/.venv/bin/python \
  ~/projects/localai/bin/img2mesh/hy3d_batch.py --shape full --out ~/ml/img2mesh/out/pine-hollow-creatures-hy art/pine-hollow/round-9-creature-refs/ref-boar.jpg
# 2. metallic off (a generation's metallic 1 bakes to a black albedo), then the PBR post: head turned to +Z (--yaw, from
#    the body's PCA axis), smooth, the texture baked ungraded + a normal map from the high mesh
blender -b -P scripts/img2mesh/driftwood_post.py -- --in <demetalled>.glb --name boar --out ~/ml/img2mesh/out/pine-hollow-creatures-post \
  --tris 5500 --fit height --size 1.1 --yaw 90 --keep-texture --atlas 1024 --roughness 0.85
# 3. colour-match to the reference, write <hull>.glb + .phone.glb here
node scripts/creature-color.mjs --chunk=pine-hollow --only=boar
# 4. rig-bake onto the species' skeleton (desktop + the phone's simplified hull), then judge it in motion
node scripts/creature-rig-bake.mjs --chunk=pine-hollow --only=boar
node scripts/creature-strip.mjs --chunk=pine-hollow --only=boar:boar
```
Desktop / phone tris: hind 5 988 / 2 999, stag 7 996 / 4 000, boar 5 477 / 2 927, cow 6 500 / 3 000, bull 8 999 / 4 500,
black bear 6 988 / 4 498, brown bear 6 968 / 4 500 (the procedural animals: 2 824, 5 232, 2 872, 2 964, 5 604, 5 672).
