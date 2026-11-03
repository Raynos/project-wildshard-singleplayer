# Frostline Peaks · round 1 · the landmark (OB3, 2026-11-03, sp-o1 from sp-o2's takes)

The plot's signature landmark (docs/plans/open-plots/build-out-mini-plan.md, Frostline Peaks): a granite peak about
70 m tall on the 2 × 2 plaza, a lit summit lodge, and a chair lift (three towers, moving chairs). Look target: round
62's `art/grid/round-62-open-plot-palettes/16-frostline-peaks.jpg`.

| File | What |
|---|---|
| `crop-r62-road.jpg` | The peak cropped from round 62's road-entry view: the mockup |
| `ref-a-peak.jpg` | Reference A (codex `image_gen` from the crop): one rounded granite peak under snow, the lodge on top |
| `ref-b-peak.jpg` | Reference B: a steeper, narrower peak |
| `board.jpg` | The pick: the mockup and reference A over three takes at the shipped budget (two cameras each, the same light), plus the two theme tiles (lodge court, pine wood) and the lift kit pieces |

## Takes (all from reference A's cutout, posted with `scripts/img2mesh/build_props.py`)

- **A · Hunyuan3D 2.1:** 20k near, 2.5k far, 0.38 MB. Clean snow on the rock, no bake holes, the lodge reads with its
  lit windows. Closest to round 62.
- **B · TRELLIS.2:** 19.7k near, far 3.5k (over the 2.5k bar), 0.66 MB. The rock is fine, but the lodge loses its
  walls (an open timber frame).
- **C · Blender script** (`scripts/blender/open-plots/peak.py`, sp-o2): 15.3k near, 2.4k far, 1.14 MB. Faceted kit
  style with its own lift; reads as a pine-covered cone, not round 62's rock-and-snow peak.

## Pick (G872, sp-o1, logged)

**A, Hunyuan3D 2.1**, with the lift as the kit's tower / chair / station pieces placed by `layout.landmark.lift`
(sp-o2's `liftPlacements`), so the chairs move and the lift is shared, not baked into the peak. C stays the fallback.
Jake's pick steers it when it arrives (option 1 of the question is Skip).
