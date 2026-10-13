# Main-menu hero, round 4: above the shards (G343)

Jake: the hero camera stands **above one of the three highest-quality shards, looking across the roundabout at the
others, never above the template**. Round 4 shoots from above Driftwood (`DW`), Nalati (`NA`) and Pine (`PH`), three
poses a spot (`a` over its centre, `b` nearer and lower, `c` back over its edge and higher), each as the square (the
portrait centre band, G341 B, 62° phone-1x lens, 2048² and 1440²) and the landscape (desktop, G341 A, 70° across,
2560 × 1440 and 1920 × 1080; this folder keeps every pose at 2048² / 2560 × 1440 and the two picks at the
smaller size too). Board: [`board.jpg`](board.jpg) (every capture labelled, then the pick on the real phone
menu beside today's SQ-c). Tools: `scripts/capture-main-menu-hero.mjs --round=4 --enter`,
`scripts/main-menu-hero-board.py`, `layout/capture-layouts.mjs`.

**Recommended: SQ-DW-a (square) and LS-DW-c (landscape).** With the cell under the camera entered, Driftwood is the
strongest subject: its own island, palms, piers and turquoise sea fill the front at full quality, and Nalati's river
valley (left), the template (behind) and Pine's forest (right) sit round the roundabout in the centre. The square keeps
the island close; the landscape steps back so the whole island and both piers fit across 70°. Above Pine its own
photoreal grade washes the frame pale and Nalati's near placeholder smears; above Nalati its own slope fills half the
frame. The road shoot's pick (SQ-PH-a + LS-PH-c, kept as `SQ-PH-a-1440x1440.jpg` / `LS-PH-c-1920x1080.jpg` from that
shoot) was made before a cell could be entered from the air. Nothing is wired in: SQ-c / LS-c stay until Jake picks.

**This shoot is entered** (re-shot 2026-10-12, build `392ea09`, a clean HEAD export): the player stands in the cell under
the camera, so that shard draws its own runtime; the other cells draw Debug ▸ Look ▸ Neighbour detail B (the near
placeholder, see [near tier round 3](../../near-tier/round-3/)). Each capture's row in `capture.json` records the entry
witness (the entered runtime, its sim claims, the rings settled).

## The entered-cell bug, fixed

Probe before: [`entered-driftwood-probe.jpg`](entered-driftwood-probe.jpg). Before / after:
[`entered-fix-before-after.jpg`](entered-fix-before-after.jpg) (camera 260 m over each entered cell).

The round's first diagnosis (Driftwood's ocean drawn to the horizon) was wrong: its sea already stops at its cell (the
grid's `uWaterHalf`). Three things hid the grid:

- **G321's horizon fade.** Inside a cell whose own sky owns the frame, everything outside the cell dithers away past
  60–140 m, and the page shell's ridge ring and cloud sea show instead. From 260 m that is the whole grid. Now the frame
  scales the cell's horizon share by how far the drawn eye stands above the player's feet (`HORIZON_LIFT`, 40 → 80 m,
  `src/game/grid/frame.ts`). A play camera stays within a few metres of the feet, so what a player sees is unchanged;
  the hero camera and Explore's free camera see the grid. (`d9a4a5a6d`)
- **The capture's camera frame.** The eye was placed in the player's frame, which is the entered cell's own frame, so
  over Nalati or Pine it stood 555 m off; it now subtracts the live render origin. A second cell is entered from the
  roundabout (an owned crossing commits onto the road first) and the player is held 300 m up, above Nalati's hills
  (40 m was inside them). (`9de256cb4`)
- **World-sized sheets** (G348, generic): a regional world now clips any flat mesh that reaches past the road band to
  its own cell square, by world position in the fragment shader (`src/game/grid/cellClip.ts`). Driftwood's sea, Pine's
  and Signal's one sheet each are clipped; Nalati's sky dome is left whole; a fragment inside the cell draws as before.
  (`d9505eb48`)

Standalone play is unchanged: `scripts/proof-driftwood-look-parity.mjs` reads `87a20b7` = `9de256c` on all 12 poses
(draws, triangles), GPU bytes, programs, shader sources and colliders. Signal still enters and reaches ready in a grid
entry on the same HEAD.

The grey humps on the horizon are the engine's default ridges round the page shell (`src/engine/world/Horizon.ts`),
seen past the grid's outer road.
