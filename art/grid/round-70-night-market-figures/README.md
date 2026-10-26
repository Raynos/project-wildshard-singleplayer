# Night Market figures · RM4.8 (2026-10-26, sp-o1)

Static posed townspeople for the kit (night-market-remaster RM4.8, taking over RM10.5 with sp-o2's agreement): a codex
`image_gen` reference each (styled after the kit's tree reference), then TRELLIS.2 (512) vs Hunyuan3D-2 through the kit's
figure builder at 700 triangles.

| File | What |
|---|---|
| `ref-vendor.jpg`, `ref-shopper.jpg`, `ref-elder.jpg` | The references: a cook in a red apron with a ladle, a shopper with a red paper lantern, an elder with a stick |
| `board.jpg` | The pick: references over both takes at budget |

TRELLIS.2 wins: Hunyuan3D-2 baked slabs of the grey studio background into its meshes. The sources are
`scripts/blender/open-plots/sources/fig-*.glb`; `kit.py`'s `generated_figure` remeshes, decimates and clusters each
figure's colours into its own slots (their defaults in the GLB). Opt-in with the rest of the kit: a vendor behind every
hero stall and at each food cart, a shopper before every third stall, an elder on every other bridge crown.
