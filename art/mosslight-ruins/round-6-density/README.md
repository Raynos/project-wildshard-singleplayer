# Mosslight Ruins · round 6 · density and scale toward round 62 (OB6, G983, 2026-11-03, sp-o1)

One look-loop round against the round-62 sheet (`art/grid/round-62-open-plot-palettes/19-mosslight-ruins.jpg`), at its
four hero cameras (above the neighbour, road entry, top-down, plaza). Captured in the engine on the phone tier at 2x,
as an iPhone 16 Pro, muted.

| File | What |
|---|---|
| `board.jpg` | ROUND 62 · BEFORE (HEAD `4a18d46837`) · AFTER (R1), all four hero views |
| `board-views.jpg` | The road entry and the plaza, before and after, at a readable size |

## Gaps (before against round 62)

- **A plain road entry.** The portrait road view is about ±12 m wide at 35 m out: it saw a bare lane between trees.
  Round 62 frames its entry with ruined arches and green lamps.
- **A bare plaza view.** Round 62 frames the tower through an ivy-hung arch; the game showed the tower alone on
  open paving.
- **Small kit on big tiles.** A court's arch stood 7 m on a 62.5 m tile, so the aerials read as flat squares.

## Fixes

- **The four avenues** (the x = 0 and z = 0 seams): an ivy arch across the lane at 48 m (it frames the tower from the
  plaza's south edge), 160 m (over the pools) and 226 m (it frames the road entry, short of the entry's 15 m
  footprint), its piers just off the lane's 8 m so the walk passes under, its front facing the road. A green lamp post
  either side at 70, 96, 122, 186, 206 and 230 m.
- **Kit scale:** the ruin courts' pieces ×1.4 (an arch now stands 10 m), their trees ×1.25, and the pool tiles'
  column stumps and rubble ×1.4. The walls' L sits 2 m further in: the wall model reaches 7.1 m off its centre (its
  collider 5 m), and scaled at 18 m it crossed into an entry lane's footprint.
- **Plaza fill:** two big trees a quarter round the tower's outcrop, 22 to 40 m off it.

**Still gaps:** the arches' faces toward the cameras read dark under the overcast (the kit's sun shading), where round
62 lights its stone; the aerials change little at 140 m and 470 m up; round 62's stairs at the entry are not built.

## Numbers (Chromium, phone tier)

- Road entry: 118 → 124 draws, 250k → 259k triangles. Plaza: 114 → 118 draws, 310k → 296k triangles.
- Phone wire: 8,152,432 → 8,219,274 B (+66,842 B), under the 8,222,060 B ceiling.
- Tile bake: the four entry tiles' compressed debt grows 7–11 KB each (the avenue's arches and lamps).

**Ruling (G872): R1 ships.**
