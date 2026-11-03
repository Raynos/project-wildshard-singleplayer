# Coral Drift · round 2 · the coral arch landmark (OB5, 2026-11-03, sp-o2)

The plot's signature landmark (project/archive/2026-11-03-open-plots-build-out.md, Coral Drift): a giant faceted coral arch,
25 m, over the plaza. Look target: the G983 look loop's targets (`../round-1-look-loop/target-*.jpg`), themselves
remastered from round 62's `art/grid/round-62-open-plot-palettes/10-coral-drift.jpg`.

| File | What |
|---|---|
| `crop-target-plaza.jpg` | The look loop's plaza target (the final board's C column): the mockup |
| `ref-arch.jpg` | The reference (codex `image_gen` from the plaza and under-the-arch targets): the whole arch, three-quarter view, on a plain backdrop |
| `board.jpg` | The pick: three takes as stills (`scripts/img2mesh/ab_board.py`, same light and cameras), then in game at four hero angles (the look loop's road entry, 40 m, plaza and under the arch), A / B / C per row |

## Takes

The generations and posts are scratch in `~/ml/img2mesh/out/coral-arch-*`. A and B were both posted flat shaded
(`--smooth-angle 0`), so they compete in the plot's faceted look; their smooth posts read as soft blobs.

- **A · Hunyuan3D 2.1** on a BiRefNet cutout of the reference: on the board 12k near (458 KB), 2.5k far. Chunky peach
  feet, a clean pink body and a lilac crest of coral fingers: the closest to the target.
- **B · TRELLIS.2** on the same cutout: 12k (533 KB), 2.5k. Nearly A's shape, banded darker violet, 75 KB more. It came out
  upside down; it needs no `--up`.
- **C · the Blender script** (`coral.py`, shipped from `1d257a760a`, retired with this pick, in git history): 15k
  (425 KB), 2.4k. Busier and lumpier, and paler than A and B in game.

## The pick (G872: decided on the recommendation)

**A, Hunyuan3D 2.1, ships** (`public/assets/open-plots/coral-drift/landmark.glb`, `landmark-far.glb`), at the plan's
landmark bar: 15k near (573 KB, the board's 12k rebuilt to the bar's floor), 2.5k far (55 KB), 628 KB in all against the
bar's 0.8 MB. It stands 25 m tall, turn 0, under the plot's noon landmark light. Its source record is
`scripts/img2mesh/props/coral-arch.json`. Credits: `public/assets/open-plots/CREDITS.md`.

The bake samples the texture into the landmark's vertex colours, which compress worse than the script's few swatches,
so the two plaza tiles the arch spans grow and the plot's phone wire with them (the landing commit has the numbers).
