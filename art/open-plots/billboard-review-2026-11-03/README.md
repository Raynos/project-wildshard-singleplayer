# Billboard review, 2026-11-03

Jake (2026-11-03, phone shot of Mosslight Ruins' road entry): *"the tree clipping for the billboard is really fucking
bad. I need you to make in-engine images of all the billboards in all of the open plots that have been built. And then
review them from all angles."*

All 27 billboards in the six built plots, 9 views each (243 in-engine frames), one board per plot. A red **DEFECT** tag
marks a panel with a problem; the caption under it names it.

| Plot | Billboards | Defect panels | Board |
|---|---|---|---|
| Mosslight Ruins | plaza + 4 entries | **19** | [mosslight-ruins-board.jpg](mosslight-ruins-board.jpg) |
| Night Market | plaza + 4 entries | **10** | [night-market-board.jpg](night-market-board.jpg) |
| Frostline Peaks | plaza + 4 entries | **10** | [frostline-peaks-board.jpg](frostline-peaks-board.jpg) |
| Lantern Bayou | 4 entries (no plaza poster) | 4 | [lantern-bayou-board.jpg](lantern-bayou-board.jpg) |
| Ember Forge | 4 entries (no plaza poster) | 4 | [ember-forge-board.jpg](ember-forge-board.jpg) |
| Coral Drift | 4 entries (no plaza poster) | 4 | [coral-drift-board.jpg](coral-drift-board.jpg) |

**How it was shot.** Preview `d3b32d2-mw0ppw9a` (only docs changed between it and HEAD `fd04f55`, so the runtime is
HEAD's). Chromium as iPhone 16 Pro portrait 402×603, phone tier, 2× render scale, 62° horizontal FOV, muted, through
`scripts/browser-lane.sh`. Normal grid entry into each plot (the dome harness's route), then the player is posed ~9 m
behind each board so its tile draws at L0 (posters draw at L0 only), and the free camera takes the nine views after the
grid's residency settles. Board positions come from the generator (`tiledPlotCore.mjs` `poster()`): entry boards at
inset 247 m, offset 12.5 m beside the lane, 10 × 5.6 m, bottom 0.6 m; plaza boards 20 × 11.25 m, bottom 2.5 m.

Views: 1 front 8 m · 2 front 25 m · 3/4 front three-quarters (14 m) · 5/6 edge-on · 7 behind 12 m · 8 above 20 m looking
down · 9 the approach (entry boards: from the road 45 m out on the lane axis; plaza boards: from the south lane, 70 m).

## What is fine everywhere

- Both faces carry the picture, the right way round (`face()` flips u per side); nothing reads mirrored or blank.
- Lit and readable from the front at 8 m and 25 m in all six palettes; no z-fighting, no frame/post gaps, posts reach
  the ground, nothing sunk or floating.
- Bayou, Ember and Coral boards are clean from every in-plot angle.

## Defect table

| Plot | Billboard | Views | Defect | Likely cause | Smallest fix |
|---|---|---|---|---|---|
| Mosslight | plaza (-22, -40) | 1–9 (all) | A broadleaf tree stands **through the board**: trunk in its plane, crown over the picture front and back. Jake's shot. | `mossPlaza` / court trees are placed per tile with no idea a poster exists; `poster()` runs after `buildLayout` and checks nothing. | One keep-out for every poster: `tiledPlotCore` computes the 5 board rectangles before `buildLayout` and passes them in `kit`; `writer.placeModel` (kit.mjs) and the tree stand-ins skip any placement whose turned centre is within the board's footprint + 4 m (front strip 8 m). Fixes every row in this table except the road wall and sign. |
| Mosslight | entry-W (-247, -12.5) | 2, 3, 4, 8 | Two court tree crowns 2–4 m behind the board hug and overhang the frame; from the road they read as a tree growing out of it. | `ruinCourt`'s corner trees at tile (±23, -22): "a bigger crown reaches an entry court's road entry footprint" — the footprint, not the board. | Same keep-out (crown radius counts); or drop that corner tree in the four entry tiles. |
| Mosslight | entry-N (-12.5, 247) | 4 | A ruin wall stands flush behind the left end and fuses with the frame. | `ruinCourt` wall L at tile (±16, 18) turned. | Keep-out also for `ruin()` pieces, or shift the board 3 m along its lane (`entry.offset` 12.5 → 15.5). |
| Mosslight | entry-E (247, 12.5) | 7 | A rubble block clips the board's back-left corner. | `ruinCourt` rubble heap `ruin(w, 2, …)` near the court mouth. | Keep-out for `ruin()`. |
| Night Market | plaza (-22, -40) | 1, 2, 3, 7, 8, 9 | The plaza's L of market stalls runs **under and through** the board: a canopy cuts the face and the back, two stalls sit in its footprint. | `nightMarket.mjs` `plaza()` places `PLAZA_STALLS` along the lanes; the plaza poster (offset -22) lands on that L. | Keep-out (above), or skip the two stalls whose x is in [-34, -10] at z ≈ -40. |
| Frostline | plaza (-22, -54) | 3, 4, 6, 9 | Pines stand in the board's front strip; one 3 m in front of its right half; from the south lane the pines hide the poster entirely. | `layout.plazaPines` [14, 57] mirrored → a pine at (-14, -57), 3 m in front of the face (x span -32…-12). | Delete that mirror (or move the row to [14, 64]); the keep-out also covers it. |
| Frostline | plaza (-22, -54) | 1, 5, 8 | The peak's snow slope meets the board's back and pokes out under its left end. | Landmark (70 m peak) base reaches z ≈ -52; board at z = -54. | Move the plaza board to z = -62 (layout `posters.plaza.z`). |
| All six | every entry board | 9 (road approach) | From the road the **cyan road-wall curtain hides the poster's lower third** (Night Market's NIGHT MARKET title is cut). | Board bottom 0.6 m sits behind the grid's road wall (`seamLook` curtain, ~2.5 m) at the plot edge. | Raise the entry boards: layout `posters.entry.bottom` 0.6 → 3.0 (posts lengthen with it), all six layouts. |
| Mosslight, Night Market, Frostline, Coral | entry-S (+ Frost E/W, Coral all four) | 9 | The road's **green distance sign** stands in front of the poster from the approach lane. | `roadLook` signs sit at the turn-in, on the same sight line as a board offset 12.5 m beside the lane. | With the 3 m lift the board clears the sign; else `entry.offset` 12.5 → 18. |

Not counted as defects: the warm disc low in some frames is the sun/moon halo; the board lamps are three glow boxes over
the top edge with no bracket (they read as floating cards at 8 m; a 0.1 m bracket box to the frame would ground them).

## Top fixes, ranked

1. **Poster keep-out in the tile builders** (`tiledPlotCore.mjs` + `kit.mjs` writer): fixes the Mosslight plaza tree
   (Jake's shot), Mosslight entry crowns/ruins, Night Market's stalls and Frostline's pines: 25 of the 51 defect panels.
2. **Lift the entry boards over the road wall** (`posters.entry.bottom` 3.0 in six layouts): all 24 road-approach
   defects, and it clears the green road signs.
3. **Move Frostline's plaza board off the peak** (`posters.plaza.z` -54 → -62): the last 3.
4. Lamp brackets (cosmetic).

Raw frames and camera receipts were kept only until this board was made (`tmp/billboard-review/`, deleted).
