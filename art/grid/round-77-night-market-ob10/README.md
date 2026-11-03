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

## Round 2: tile density (`board-r2.jpg`)

- **Gap (bar 6):** the stall tiles drew up to 17,886 triangles at L0, past the bar's 15k. With R1's 18k gate, the plaza
  tiles reached 15.7k.
- **Fix:** a hero stall every fourth place down each row (was every third); a vendor at every third hero stall (was
  every other); shoppers before the second and sixth stall only; goods behind every third stall; three aisle carts,
  evenly spaced (was four); two plaza planters (was four).
- **Result:** L0 max 14,852, mean 8,910 (bar: max 15k, mean 8k). Phone wire 8.16 to 7.94 MB. The aisle reads
  the same, with one cart fewer per tile.

**Ruling (G941 / G872): R2 ships.**

## Look loop R1 (G983; `sheet-r0.jpg`, `sheet-t0.jpg`, `sheet-r1.jpg`, `board-loop-r1.jpg`)

LOOK-LOOP's nine angles about the plaza anchor P = (0, -40), 40 m south of the gate. T0 is codex `image_gen` edits of R0
with the round-49 board (`art/grid/round-49-night-market-billboards-2x2/bb-b.jpg`) as the style reference.

- **Gaps (R0 against T0), by area:** cold lilac-grey paving where the targets have warm dusk paving; a flat lilac sky
  where they have lavender above and peach at the horizon; dim pink lantern pools; a coral gate where they have crimson.
- **Fixes:** the six ground colours warmed in linear light (two steps of 70 % of the measured gap); a bluer zenith and
  an orange-peach horizon, with the fog matched to it; the lantern pools 1.4x brighter.
- **Check against round 49:** the floor now measures sRGB (146, 103, 88) at eye level, against round 49's
  (130-142, 84-92, 85-88). Codex's T0 overshoots to orange, so the loop stops at round 49's floor.
- **Gap kept:** the gate stays coral. Its landmark graph is shared with other plots.

**Ruling (G941 / G872): R1 ships.** Phone wire 7,940,254 → 7,944,062 B, and seven window rows grow 4–28 B (standing
rule). Draws are unchanged.
