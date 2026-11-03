# Patchwork Fairground · round 1 · the landmark (OP7, 2026-11-03, sp-o2)

`board.jpg`: the round-75 plaza target (`../../grid/round-75-new-plot-palettes/03-patchwork-fairground.jpg`) beside the
scripted Ferris wheel, near front, near three-quarter and far three-quarter, as Blender EEVEE previews on a neutral
backdrop. The in-engine look follows in the plot's captures.

**The wheel is a Blender script** (`scripts/blender/open-plots/ferris.py`, target `open-plots/ferris`), decided under
G872 without image-to-3D takes: its read is thin white lattice, 16 spokes a side and 12 separate cabins, which Hunyuan3D
and TRELLIS.2 smear into a solid disc (their wins were solid masses: Ember's furnace, Coral's arch, Mosslight's tower).

- **Model space** (glTF, before the layout's `turn`): 42 m tall, a 26 m two-course cream plinth with a broad stair up
  **+Z** (its foot 4 m proud), the axle at 25 m, the rim 17 m in radius and 3 m deep. The layout's `turn: 2` faces the
  stair to the south entry, as Ember's furnace.
- **Parts:** red A-frame legs in front of and behind the wheel, braced; a sunflower hub in a red ring; a white double rim
  with a zigzag lattice; 12 gondolas in turn red, sunflower and royal blue, each with a white roof, a dark window band and
  a hanger.
- **Cost:** near 5,112 triangles (88 KB), far 1,548 (28 KB), one swatch atlas. `build.sh --check`: identical.
