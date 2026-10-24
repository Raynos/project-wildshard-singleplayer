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
| H1 | Install the MLX port in its own venv (`~/ml/img2mesh/hi3d-mlx`, pinned `ec824bbc06`); fetch the weights into `~/projects/weights/manual/mlx-community/Hi3Dv1.0-mlx` | in flight (fetch started 2026-10-24 12:46) |
| H2 | Smoke: stone-a at 512 under the model lock. Fix the orientation (the port wants the image side on +Z) and the alignment back to the raw frame | open |
| H3 | The stage: `scripts/img2mesh/hi3d_refine.py` and an opt-in `"refine": "hi3d"` key in the prop lists. With the key absent, the committed outputs rebuild byte-for-byte | open |
| H4 | The runs: 10 subjects at 1024, 2 at 512 (~3 h of model time, under the lock) | open |
| H5 | Numbers + the four boards | open |
| H6 | Jake's verdict per shard | open |
| H7 | Docs: when to use it and when not. localai `docs/hi3d.md` + `3d-models.md` row; weights `MODELS.md` row; here `scripts/img2mesh/README.md`, `docs/process/LOCAL-MODELS.md`, a line in the mockup-to-model skill | open |

Out of scope: rebuilding the shipped props of the shards that win. That becomes one row per shard after H6.
Characters and rigged meshes are out of scope too.
