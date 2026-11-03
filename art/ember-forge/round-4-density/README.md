# Ember Forge · round 4 · density and scale toward round 62 (OB4, G983, 2026-11-03, sp-o1)

One look-loop round against the round-62 sheet (`art/grid/round-62-open-plot-palettes/17-ember-forge.jpg`), at its four
hero cameras (above the neighbour, road entry, top-down, plaza). Captured in the engine on the phone tier at 2x, as an
iPhone 16 Pro, muted.

| File | What |
|---|---|
| `board.jpg` | ROUND 62 · BEFORE (HEAD `319bd64088`) · AFTER (R1), all four hero views |
| `board-road.jpg` | The road entry, before and after, at a readable size |

## Gaps (before against round 62)

- **An empty road entry.** The portrait road view is about ±12 m wide at 35 m out, so the forge courts at x ≈ ±31 m
  never reach it: the player saw dark paving, two bollards and a distant furnace. Round 62 lines its entry path with
  blue lamp blocks and lava to either side.
- **Small kit on big tiles.** The forge hall stood 12 m tall on a 62.5 m tile and the ore heaps 3 m, so from the
  aerials the courts read as empty dark squares with specks.

## Fixes

- **The four avenues** (the x = 0 and z = 0 seams) are lined like round 62's entry path: a basalt plinth with a cold
  blue lamp-block either side every 15.6 m, from the road to the furnace's forecourt (none on the moat's bridges, none
  in the entry's 15 m footprint). Through the entry's forge courts, a raised lava trough runs along each edge
  (the row's lava water kind in a waist-high basalt kerb), throwing molten light pools onto the path, with embers off it.
- **Kit scale:** the foundry hall 1.9 → 2.5 (16.5 m), the smithies 1.5 → 2.0, the anvil yard 1.5 → 2.0, the ore
  heaps about ×1.4, the crane 1.4 → 2.0 (19 m, it now reads from the road), the carts 1.2 → 1.6. The far stand-ins
  follow from the same scales.

**Still gaps:** the courts read darker than round 62's blue-rimmed yards from the aerials; the plaza's lava stays a
moat, not round 62's four L's; the road view's furnace is 240 m away, so it stays small.

## Numbers (Chromium, phone tier)

- Road entry: 114 → 120 draws, 207k → 209k triangles. Plaza: 108 draws, 309k triangles.
- Phone wire: 4,289,775 → 4,335,073 B (+45,298 B, inside the +100 KB a round).
- Tile bake: the four entry forge courts draw 9 (the trough's water draw), as Mosslight's entry tiles do.

**Ruling (G872): R1 ships.**
