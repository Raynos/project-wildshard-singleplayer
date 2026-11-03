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

## Look loop R2: clear aerials

The two aerial hero views sit about 470 m up, and the fog began at 300 m: a pink veil over the whole plot where round 49
is crisp. The row's fog now runs from 600 to 1800 m. The top-down reads its blue canals and green beds; the road
entry and plaza are unchanged.

**Ruling (G941 / G872): R2 ships.**

## Look loop R3: crimson gate, plaza fill (`sheet-r3.jpg`, `board-loop-r3.jpg`)

The same nine angles, against round 49's 2 × 2 (`bb-b.jpg`) for the hero views and T0 for the nine.

- **Gaps:**
  - **Gate:** the pillars measure sRGB (199, 102, 79) in the plaza view, coral; round 49's measure (160-170, 53-64,
    31-40). The shared landmark graph's lilac fill lifts the red's green and blue.
  - **Plaza:** each quarter was open paving with two rings of lanterns. The first-person side views saw bare floor to the
    canals, where round 49 lines its plaza with stalls up to the gate.
- **Fixes:**
  - **Gate:** the row's `landmarkLight: "crimson"` draws it in `landmarkCrimson.graph.json`, the shared graph plus a
    pass that tints only its reds (red over 2.2× its green and blue) toward crimson. The white plinths, the navy roofs
    and the gold keep their light. Every other plot keeps the shared graph, byte for byte.
  - **Plaza quarter:** in place of the rings, benches and planters, an L of the kit's row stalls 22 m off both lanes,
    facing them, five a lane. Each stall has a light pool, there's a lantern at the L's corner, and three kiosks stand in
    the far corner. The beds and their trees stay. The quarter is symmetric about the gate's diagonal, so the four
    turned quarters mirror.
- **Result:**
  - **Gate:** pillars at (164, 60, 50). The remaining blue doesn't move with the graph's tint, so it comes after the
    graph.
  - **Bars:**
    - plaza tiles at 13,960-14,700 triangles (L0 max still 14,852; mean 8,913);
    - draws unchanged (road 116, plaza 110);
    - phone wire 7.94 → 7.90 MB.
  - **Physics walk:** 0 stuck and 0 out of bounds on the build-out route plus both stall aisles of a plaza quarter.

**Ruling (G941 / G872): R3 ships.** Kept gap: round 49 packs its stalls tight round the gate. The plaza tiles sit at the
15k tile bar, so a denser plaza needs triangles from elsewhere.

## The final board (`board-final.jpg`)

Round 49's mockup, the plot before OB10 (`05f1661521`) and now (after look loop R3), at the four hero cameras, all on
the phone tier at 2x as an iPhone 16 Pro.

- **Meets the build-out bar:**
  - bar 1: the gate reads lit from the road entry and from above the neighbour, at 18k triangles near;
  - bar 6: L0 max 14,852 and mean 8,910 triangles;
  - bar 12: 110-116 draws in the plot (road entry and plaza);
  - bar 15: 282k-495k triangles in view in the plot;
  - phone wire 7.90 MB (was 8.13);
  - look loop R3: the gate crimson, stalls lining the plaza.
- **Gaps kept:**
  - The plaza is still wider than round 49's, which packs its stalls tight round the gate. That's the 500 m cell's scale
    gap, which every plot shares, and the plaza tiles sit at the 15k bar.
  - The aerials draw 186-264, past the in-plot bar. They also see the neighbouring cells.
  - Audio comes with OB7.
