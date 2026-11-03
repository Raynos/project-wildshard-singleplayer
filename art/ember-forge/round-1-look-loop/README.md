# Ember Forge · round 1 · the look loop (OB4, G983, 2026-11-03, sp-o3)

LOOK-LOOP's nine angles about the plaza anchor P = (0, -40), 40 m south of the furnace hall: four first-person views
from P (front faces the furnace's door), straight down, and four aerials 55 m out and 45 m up. 9-diag-back stands past
the furnace, off its axis. Captured in the engine on the phone tier at 2x, as an iPhone 16 Pro.

| File | What |
|---|---|
| `sheet-r0.jpg` | R0: the activated plot (`c33dc15dcc`) |
| `sheet-t0.jpg` | T0: the targets, codex `image_gen` edits of R0, with round 62 as the style reference |
| `sheet-r2.jpg` | R2: after rounds 1 and 2 |
| `board-r2.jpg` | BEFORE (R0) · AFTER (R2) · TARGET for four of the angles |

## Gaps (R0 against T0) and fixes

- **The furnace rendered lilac-white.** The shared landmark graph's fill is about 3x and lilac. The row now lights its
  landmark with the neutral dusk graph (`landmarkLight: "dusk"`, Bayou's), which also warms its foot with an uplight.
  Its stone, iron and soot swatches are darker (0.42), and its lava swatches a deeper orange.
- **Lava read as pale peach.** The lava graph's yellow cores, its intensity and the canal walls' additive glow washed it
  out. Now: intensity 1.2, a redder molten colour (`#ff3c06`), small cores, and a darker wall glow and door pool.
- **A pale grey sky; dark-on-dark yards.** The sky and fog go deep navy. The ambient is brighter (1.4), and the basalt
  paving, courts and stone are a lighter blue-grey.
- **Blue pools crowding the aerials.** The lane bollards keep their lit blue caps but lose their light pools; the lamp
  pools are a darker blue.

**Still gaps:**
- The door glows peach where T0's is saturated molten orange (the dusk graph's warm-texel lift).
- No stars: the sky is a gradient.
- No reflections on the paving.
- From afar the forge and ore yards' coarse stand-ins read as black boxes, with no lit windows.

**Ruling (G872): R2 ships.** Draws are 78–130 a view. The phone wire stays under its 3,688,268 B ceiling, and the tile
bake has no debt.
