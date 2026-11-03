# Night Market · round 77 · OB10 (build-out catch-up, G980), 2026-11-03, sp-o3

The build-out bar (docs/plans/open-plots/build-out-mini-plan.md §2) applied to the Night Market. Captured in the engine on
the phone tier at 2x as an iPhone 16 Pro, at the round-62 hero cameras plus the gate at 200 m and 100 m.

## Round 1: the gate (`board-r1.jpg`)

- **Gap (bar 1):** past 150 m the gate drew as its coarse (L1) stand-in in the kit's standard material. The scene sun is
  behind it from the south road, so it read as a dark brown silhouette from the road entry, at 200 m and from above the
  neighbour.
- **Fix:** the row's `coarseLandmark: "lit"` draws the coarse gate in the landmark graph, with no texture (the
  `LandmarkCoarse` material: meshMap colourOrVertex shades its vertex colours as it shades the near model's texture). It
  now reads red and gold with blue roofs from 250 m, matching the near model at the 150 m switch.
- **Near model:** 12k to 18k triangles (bar 15-25k), from the same Hunyuan3D 2.1 take
  (`scripts/img2mesh/props/night-market-gate.json`). It reads the same at 100 m.
- **Cost:** the four plaza L1 tiles draw 3 instead of 2 (approved, wildshard-new). Road entry 108 to 116 draws. Phone
  wire 8,126,234 to 8,164,735 B, under the 8,225,190 B ceiling.

**Ruling (G941 / G872): R1 ships.**
