# Hi3D refine — proof of concept (E494)

Jake (2026-10-24): *"my blessing and approval to do an experiment on this … A/B test whether or not this makes things
better … add this somehow, and then verify if it's an improvement and document when to use and when not to use it"*,
in `~/projects/localai` and in this repo. State: [hi3d-refine/STATE.md](hi3d-refine/STATE.md).

## What it is

[Hi3D v1.0](https://github.com/hi3d-official/Hi3Dv1.0) (ex-Sparc3D, open weights 2026-10-23) refines a coarse mesh into
1 M-face geometry, conditioned on the reference image. Geometry only: no texture, recentred to a unit radius. It runs on
this Mac through the unofficial MLX port ([cguldogan/mlx-vlm@hi3d](https://github.com/cguldogan/mlx-vlm/tree/hi3d)
`ec824bbc06`, weights [mlx-community/Hi3Dv1.0-mlx](https://huggingface.co/mlx-community/Hi3Dv1.0-mlx), 10.2 GB).
Licence: shipped GLBs are standalone outputs, so no "Powered by Hi3D", NOTICE or scale terms apply to the game.

## The A/B

The only difference between the arms is the Hi3D stage. Same raw generation, same reference, same post arguments,
same triangle budget and atlas.

- **A:** the current pipeline, the asset as it ships today.
- **B:** the raw TRELLIS / Hunyuan mesh → Hi3D 1024 → aligned back to the raw mesh's frame, with colour taken from
  the original generation → the same `driftwood_post.py` arguments.
- **B512:** Hi3D at 512 (one pass, ~4× cheaper), on two props, to learn whether the cheap setting is enough.

Subjects (10), chosen to cover every shape type that tends to break:

| Shard (look) | Generator | Props | Why |
|---|---|---|---|
| Pine Hollow (photoreal PBR, normal map) | TRELLIS.2 | stone-a, cave-arch, waystone, beaver-dam, canoe-s7, contract-board | rock, an arch with a hole, carved detail, thin sticks, hard surface, a flat plate |
| Driftwood (faceted toon) | TRELLIS.2 | hut, wreck | the look that should gain least |
| Nalati (painterly, no normal map) | Hunyuan3D-2 | one shipped static prop | the Hunyuan flow |
| Sunscar Dunes | Hunyuan3D-2 | well | the Hunyuan flow, a hollow shape |

What decides it:

1. **Boards, one per shard**: iPhone portrait, burned-in labels. Rows are props, columns are reference · A · B.
   Each prop shows a 3/4 view, the back (where Hi3D invents detail) and a close-up at gameplay distance.
2. **Numbers**, in the commit and the docs: Hi3D seconds and peak memory per prop; the high mesh's islands, holes and
   non-manifold edges before and after; final triangles and GLB bytes (equal by construction, so a regression shows).
3. **Jake's verdict per shard** with the question tool (Skip / use Hi3D / keep current).

## Rows

| # | Row | Status |
|---|---|---|
| H1 | Install the MLX port in its own venv (`~/ml/img2mesh/hi3d-mlx`, pinned `ec824bbc06`); fetch the weights into `~/projects/weights/manual/mlx-community/Hi3Dv1.0-mlx` | done 2026-10-24 (localai `bin/img2mesh/hi3d-setup.sh`) |
| H2 | Smoke: stone-a at 512 under the model lock. Fix the orientation and the alignment back to the raw frame | done: `--turn auto`, bbox + ICP fit (`f42d192560`, `74d7c42f4a`) |
| H3 | The stage: `scripts/img2mesh/hi3d_refine.py`, `driftwood_post.py --geo`, a `"refine"` key / `REFINE` env in `build_props.py`. Off, outputs rebuild byte-for-byte | done (`f42d192560`; stone-a checked byte-for-byte after every change) |
| H4 | The runs. Jake (2026-10-24) swapped the small props for obvious heroes: bear, ranger, horse, wreck, roc (+ stone-a, the 6 Pine Hollow props and the hut as numbers) | done: 14 subjects at 1024, 2 at 512, plus arm C (Hunyuan repaint) on 3 heroes + stone-a |
| H5 | Numbers + boards | done: `art/hi3d-refine/round-1-heroes/` (`d43cc26ab5`); numbers in localai `docs/hi3d.md` |
| H6 | Jake's verdict per shard | done: **Jake (2026-10-24): opt-in per prop**, never a shard default; rebuild the winners shard by shard, each behind Developer first |
| H8 | Driftwood wreck: `"refine"` on its rows of `props/driftwood-hero.json` (LOD0 + lod1), rebuild, ship behind Developer | open |
| H9 | Pine Hollow ranger and bear: refined hulls through the shard's own NPC / creature bakes (`bake-npcs.mjs`, `creature-color.mjs`), behind Developer | open |
| H10 | Far Reach storm roc: refined hull through the shard's model build, behind Developer | open |
| H7 | Docs: when to use it and when not, in localai and here | done here (README §4b, LOCAL-MODELS, mockup-to-model); localai + weights staged, landing needs Jake's `!` line (the commit guard blocks `git commit` outside this repo) |

**Result (same triangle budget, final game GLBs):** B wins on the wreck (spiky shards → a readable ship, same bytes),
the ranger (pocket flaps, lapels; +19 % bytes) and the bear (torn flaps gone); a small win on the roc; no change on
the horse (no normal map); a loss on stone-a (Hi3D carves the reference's glyphs under TRELLIS's different painted
ones). Arm C (Hunyuan repaint) lost every time. Two pipeline bugs found and fixed on the way: black DIFFUSE bakes from
metallic sources (every Hunyuan GLB), and Blender's collapse stalling on 1 M faces.

After H6 the winners are rebuilt one row per shard (H8–H10); stone-a and Nalati's models stay as they are.
