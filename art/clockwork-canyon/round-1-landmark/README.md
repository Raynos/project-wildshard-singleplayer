# Clockwork Canyon · round 1 · the landmark (OP19, 2026-11-03, sp-o3)

`board.jpg`: the round-62 road-entry target (`../../grid/round-62-open-plot-palettes/11-clockwork-canyon.jpg`) beside the
scripted clock tower, near stair side, near three-quarter and far three-quarter, as Blender EEVEE previews on a neutral
backdrop. The in-engine look follows in the plot's captures.

**The clock tower is a Blender script** (`scripts/blender/open-plots/clocktower.py`, target `open-plots/clocktower`),
decided under G872 without image-to-3D takes: gear teeth, dials and hands smear in Hunyuan3D and TRELLIS.2.

- **Model space** (glTF, before the layout's `turn`): 38 m tall, a two-course pink sandstone plinth 24 m square with a
  stair up **+Z** (its foot 4 m proud) to a dark door.
- **Parts:** three square verdigris stages banded and cornered in brass, a cream dial with dark hands (ten past ten) on
  each face of the clock stage, a brass gear train of three toothed wheels up each flank, an open brass belfry, a
  verdigris dome, a brass lantern and finial.
- **Cost:** near 1,280 triangles, far 578, one swatch atlas. `build.sh --check`: identical.
