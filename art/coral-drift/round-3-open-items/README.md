# Coral Drift · round 3 · the open items (OB5, 2026-11-03, sp-o3)

Two of the three open items that the look loop's finish logged (`../round-1-look-loop/README.md`, "Finish"): the boards
read a touch grey against the codex targets, and the sky outside the plot. The third, a sandy floor seen through the
lagoon, needs a transparent material kind and stays out of scope. sp-o3 took these over on wildshard-new's word. sp-o2
kept the arch (`../round-2-landmark`).

- `board.jpg`: the round, A BEFORE (a5b3470) · B AFTER (1f51f66) · C TARGET.
- `final-board.jpg`: the refreshed board for Jake, A FIRST BUILD (02f325d, the look loop's A column) · B NOW (1f51f66) ·
  C TARGET.

Both boards are the OP4 dome capture on a grid entry (`scripts/open-plots/capture.mjs --domes=A2,B2,D1,D2`, iPhone 16
Pro, phone tier, 2x, 62° across 402 × 603). Each row is one dome's hero view, the look loop's angles 2, 4, 7 and 9. B at
1f51f66 also carries sp-o2's Hunyuan arch (9d0988b3cd).

## What changed (Coral's `outputs.json` row only; no graph)

- **The sun.** The shared look holds every plot at 17:17 on a 40° arc (`dayOverride` 0.72). Coral's "noon" sun stood
  about 13° up, so it barely lit the flat pale planks. That was the grey. The row's new `lookDay` gives Coral a noon sun
  on a 68° arc. Shadows shorten as the targets' do.
- **Grade, sky, fill.** The row's `lookGrade` sets saturation 1.1 and contrast 1.05. The level grade carries
  saturation and contrast; exposure is not read. The sky key is deeper (zenith 0, 0.15, 0.96; horizon 0.06, 0.44, 0.98)
  and the fog bluer. Sun 2.6 and fill 1.6, the fill's ground side neutral.
- The product generator reads `lookGrade` and `lookDay` for a row (`generators/product.ts`). Every other plot keeps the
  shared look.

## Numbers (grid capture, mean colour of a patch)

| view | sky before → after | boards before → after | target sky / boards |
|---|---|---|---|
| road entry | 108,185,237 → 1,160,254 | 151,149,136 → 221,209,186 | 29,157,248 / 207,192,189 |
| 40 m | 160,206,228 → 68,186,243 | 151,149,134 → 222,210,184 | — / 221,210,208 |
| plaza | 88,179,240 → 0,152,255 | 152,154,148 → 222,213,195 | 33,164,254 / 201,200,206 |

Whole-frame peak draws, neighbours included, all go down: A2 131 → 127, B2 147 → 139, D1 160 → 148 and D2 158 → 146.
The drop comes with the high sun and its shorter shadows; the cause is not measured. Phone wire stays inside its
ceiling.

## The sky outside the plot

- Inside Coral's cell, the plot's own sky owns every board view. The road-entry dome looks from z −205, 45 m inside the
  cell, and its sky is now Coral's noon blue.
- Past the cell, on the road, the grid draws the road's own dawn sky and sun: Jake's G165 pick ("A, road light over
  everything"), restyled by his G242 "grid dawn". That rule covers every road on the grid. A Coral-only exception would
  break it, so it is not changed here (G872, logged). Restyling the road sky is a look change for all plots and would go
  to Jake as its own board.
- What still reads dark on the 40 m view's horizon is the neighbouring cells' far proxies, not sky.

## Ruling (G872, sp-o3)

- **Take 1 ships the sun clock and grade** (35ce423537): standalone, the planks went from 133 to 189–207 and the sky
  from 120,167,203 to 44,149,226.
- **Take 2** (1f51f66): the grid capture showed cream-yellow boards and a sky clipping to pure blue. Saturation
  1.2 → 1.1 and a neutral sun and fill moved the grid frames by ≤ 3 per channel. The cream comes from the plank palette
  (round 3's warm bleached boards, `layouts/coral-drift.json`), which is outside this item's row-only scope. Left as is:
  the brightness is inside the targets' band.
- Still apart from the targets: no clouds (the sky key has none), the planks slightly warmer than the targets' grey-pink,
  and no sandy lagoon floor (the transparent material, out of scope).
