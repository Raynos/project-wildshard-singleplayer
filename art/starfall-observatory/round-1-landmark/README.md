# Starfall Observatory · round 1 · the landmark (OP15, 2026-11-03, sp-o3)

`board.jpg`: the round-62 road-entry target (`../../grid/round-62-open-plot-palettes/12-starfall-observatory.jpg`) beside
the scripted observatory, near stair side, near three-quarter and far three-quarter, as Blender EEVEE previews on a
neutral backdrop. The in-engine look follows in the plot's captures.

**The observatory is a Blender script** (`scripts/blender/open-plots/observatory.py`, target `open-plots/observatory`),
decided under G872 without image-to-3D takes: its read is a clean turned drum and dome, the dome's slit and a crisp
telescope tube, which Hunyuan3D and TRELLIS.2 smear.

- **Model space** (glTF, before the layout's `turn`): 30 m tall, a two-course white plinth 30 m square with a broad stair
  up **+Z** (its foot 5 m proud) to a blue door; the slit and telescope face the stair.
- **Parts:** a white drum with silver pilasters between twelve tall lit windows, a cornice and a balcony ring, a white
  hemispherical dome split by a dark slit, a royal-blue telescope with a silver band rising out of it at 38 degrees.
- **Cost:** near 1,490 triangles (27 KB), far 374 (9 KB), one swatch atlas. `build.sh --check`: identical.
