# Round 5: generated models (image → 3D, local)

Eighteen Nalati models made on this Mac with **TRELLIS.2-4B** (Microsoft, MIT) through the MPS port.
The pipeline: codex `image_gen` reference (one object, painterly, plain background) → TRELLIS.2 `512`
pipeline → re-bake of the saved decode at the game budget (o_voxel `to_glb`, base colour from the voxel
attributes) → Blender headless normalise (scale, pivot, forward axis, PBR metal/rough dropped) →
`gltf-transform optimize` (meshopt + WebP). The kit, the numbers and the traps live in
`~/projects/localai/docs/3d-models.md` and `~/projects/localai/bin/img2mesh/`. Jobs table:
`~/projects/localai/bin/img2mesh/nalati-jobs.tsv`.

Each `<name>-turntable.jpg`: the reference image, 8 orthographic views at 45° steps (view 1 = front), and
the texture atlas.

## Files and conventions (all models)

- `public/assets/nalati/models/<name>.glb` = desktop (1024² WebP atlas); `<name>.phone.glb` = the same
  mesh with a 512² atlas.
- **meshopt-compressed**: load with `GLTFLoader.setMeshoptDecoder(MeshoptDecoder)`
  (`three/examples/jsm/libs/meshopt_decoder.module.js`).
- **Units are metres, +Y up, pivot = centre of the base on Y = 0, front faces +Z** (three.js
  `lookAt` convention). Quadrupeds are aligned by their long axis, head toward +Z.
- One mesh, one material, one base-colour texture, `metallic 0`, `roughness 0.85`, no normal map. Lighting
  was not baked into the colour except the soft light in the painted reference.
- **Static meshes, not rigged.** The creatures are single-piece hulls in a neutral standing pose, ready for
  a rig (img2-character) or for use as-is (a still herd, a trophy, a far LOD).

## Adoption notes

| Model | Owner | Size W×H×D (m) | Tris | Desktop / phone bytes | Notes |
|---|---|---|---:|---:|---|
| `yurt` | poi | 4.55 × 3.20 × 4.91 | 6 000 | 407 KB / 219 KB | door toward +Z. The felt panels between the red bands read patchy (TRELLIS mixed lattice and felt); good at camp distance, weak up close |
| `horse-saddled` | creature | 0.75 × 1.90 × 2.31 | 6 681 | 603 KB / 282 KB | saddle, saddle cloth, stirrups, bridle in one mesh. Coat came out redder than the reference |
| `horse-wild` | creature | 0.64 × 1.75 × 2.15 | 7 005 | 388 KB / 211 KB | dun coat, dark legs, no tack. Mane is a solid crest |
| `wolf` | creature | 0.48 × 0.85 × 0.94 | 7 523 | 313 KB / 159 KB | darker grey than the reference; fur fringe is flaky at the ruff |
| `sheep` | creature | 0.50 × 0.95 × 1.19 | 4 802 | 278 KB / 127 KB | fat-tailed, dark face |
| `snow-leopard` | creature (Aqbars) | 0.48 × 0.80 × 1.33 | 7 997 | 715 KB / 308 KB | tail curled back on itself, rosettes readable |
| `eagle` | creature (Qyran) | 0.43 × 0.85 × 0.57 | 5 903 | 313 KB / 149 KB | perched, wings folded; the reference's post was dropped by the generator. Front (+Z) is the breast |
| `golden-king` | boss | 1.19 × 2.10 × 0.69 | 6 543 | 336 KB / 190 KB | **the gold came out dark bronze**; the red cape reads. Treat as a blockout for the boss, not final |
| `spruce` | world | 4.78 × 16.0 × 4.87 | 1 868 | 249 KB / 108 KB | sparse, feathery; + `spruce.impostor.glb` (2 crossed cards, 4 tris, 256×512 alpha MASK, 8 × 16 m) for far LOD |
| `balbal` | poi | 0.68 × 1.60 × 0.59 | 1 473 | 191 KB / 76 KB | face, cup, belt and sword carved in |
| `boulder-1` | world | 2.59 × 1.40 × 2.84 | 761 | 262 KB / 90 KB | rounded, lichen; **scale freely** |
| `boulder-2` | world | 2.08 × 2.00 × 2.20 | 795 | 236 KB / 75 KB | tall faceted; **has see-through gaps** between facets at 800 tris — bury the base or use `boulder-1`/`-3` up close |
| `boulder-3` | world | 2.39 × 0.80 × 3.00 | 739 | 378 KB / 133 KB | low split slab |
| `kumis-churn` | poi (camp) | 0.60 × 1.10 × 0.66 | 1 334 | 235 KB / 90 KB | leather churn on legs, plunger, red strap |
| `cauldron` | poi (camp) | 1.57 × 1.70 × 1.32 | 1 406 | 224 KB / 82 KB | kazan on a tripod over a stone ring with firewood |
| `saddle` | poi (camp) | 0.54 × 0.60 × 0.46 | 1 456 | 272 KB / 98 KB | red felt, gold ornament, stirrups |
| `firewood` | poi (camp) | 0.58 × 0.60 × 0.68 | 1 492 | 358 KB / 120 KB | birch stack with a hatchet |
| `chest` | poi (camp) | 0.87 × 0.60 × 0.69 | 1 417 | 253 KB / 86 KB | red sandyq, ochre/blue ornament, iron corners; lid closed |

**Totals:** desktop 5.8 MB (18 GLBs + impostor), phone 2.5 MB, against the ~25 MB Nalati budget.
Heights are chosen, not measured: rescale per placement if the scene needs it (widths/depths follow).

## Not here, and why

- **Hunyuan3D-2 versions exist locally** (`~/ml/img2mesh/final-hy/`) and several read better (the yurt most
  of all, and both horses' colours). They are **not delivered**: the Tencent Hunyuan 3D 2.0 Community
  Licence does not apply in, and forbids using or displaying outputs in, the EU, the UK and South Korea, and
  this game is a public web build. The user decides whether that matters.
- No rigs, no animations, no painterly repaint pass on the atlases (the `--paint` option in
  `blender_post.py` exists but is off: it muddied the TRELLIS textures).

## Update 2026-09-23 (A1): colour-matched, Hunyuan swaps, in the world

- **Every GLB is colour-matched** to its reference by `scripts/nalati-models-color.mjs` (re-runnable from the untouched
  generator outputs in `~/ml/img2mesh/final{,-hy}/`): L and chroma histogram-matched to the reference cutout, then per
  hue sector (a crimson cape stays crimson while bronze turns gold), darks lifted; per-model knobs in its `MODELS` table.
- **Hunyuan3D-2 versions shipped** for the yurt, both horses, the spruce (+ impostor) and the three boulders (closed hulls,
  no see-through gaps) — the user cleared the licence ("a South America and North America game"). The phone GLBs of the
  boulders are simplified to 40 % (320 tris), the balbal's to 60 %; the table above is otherwise still the TRELLIS set.
- **In the world** through `src/world/nalati/glbPaint.ts` (the painterly material with the atlas as its map, one
  InstancedMesh per model): balbals, dressing rocks and the camp props by default, the GLB yurts behind `?yurts=1`,
  the skinned creatures behind `?creatures=glb` (`src/entities/glbCreatures.ts`). In-engine comparisons:
  `progress/nalati-look/models/`.
