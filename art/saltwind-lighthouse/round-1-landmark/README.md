# Saltwind Lighthouse · round 1 · the landmark (OP9, 2026-11-03, sp-o3)

`board.jpg`: the round-75 plaza target (`../../grid/round-75-new-plot-palettes/04-saltwind-lighthouse.jpg`) beside the
scripted lighthouse, near stair side, near three-quarter and far three-quarter, as Blender EEVEE previews on a neutral
backdrop. The in-engine look follows in the plot's captures.

**The lighthouse is a Blender script** (`scripts/blender/open-plots/lighthouse.py`, target `open-plots/lighthouse`),
decided under G872 without image-to-3D takes: its read is crisp turned bands, a railing and a glass lantern room, which
Hunyuan3D and TRELLIS.2 smear (their wins were solid masses: Ember's furnace, Coral's arch, Mosslight's tower).

- **Model space** (glTF, before the layout's `turn`): 39.4 m tall, a three-tier black basalt plinth 22 m square with a
  stair up **+Z** (its foot 4 m proud) to a black door; the layout's turn faces the stair to the south entry.
- **Parts:** a tapered whitewashed tower in seven courses (three signal-red bands), dark slit windows up its front and
  back, a black gallery deck with 24 railing posts and two rails, a cold glass lantern room between eight black
  mullions, a black domed cap, vent ball and finial.
- **Cost:** near 1,354 triangles (23 KB), far 448 (10 KB), one swatch atlas. `build.sh --check`: identical.
