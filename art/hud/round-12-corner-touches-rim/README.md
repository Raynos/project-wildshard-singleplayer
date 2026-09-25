# HUD round 12: the BAG corner touches the minimap (E124, 2026-09-25)

Live captures, not mockups. This round follows round 11 (`../round-11-minimap-corner-button/`: a crescent with a
~2.5 px gap to the tick ring). The user's words on round 11:

> "Make it bigger by touching the minimap. The little blue things that stick out from minimap in this corner can go away
> and the button can touch."

**Changed** (`src/ui/BagButton.ts`, `src/ui/styles/minimap.css`):

- The NE tick (1–2 o'clock) is gone while the button is on (`.ws-minimap.bag::before`). The other seven ticks stay.
- The piece now fills the whole top-right quadrant of the square outside the circle:
  - its top and right edges are unchanged: straight, level with PAUSE's top, 12 px from the edge on a phone;
  - its concave edge is the minimap's rim. The piece draws no stroke there, so the minimap's own cyan border is the
    shared edge: no doubled line, no gap (`rim-edge-pixels.jpg`);
  - short end caps stop it ~3 px past the N and E ticks (`n-tick-end-pixels.jpg`).
- The backpack glyph grew from 12 × 14 px to 17 × 20 px on the phone.
  - No BAG label: the corner is ~33 px deep, so a label would be ~5 px text.
- Menus and `?bagbtn=0` are unchanged from round 11 (`../round-11-minimap-corner-button/menu-*.jpg`).

| File | What it shows |
|---|---|
| `board.jpg` | everything below on one sheet |
| `before-round11-phone-top.jpg` / `after-phone-top.jpg` | iPhone 16 Pro emulation (402×874 @3×), top of the screen, round 11 vs 12 |
| `corner-zoom.jpg` / `corner-pressed-zoom.jpg` | the corner, 3× capture enlarged ×2; the pressed state |
| `desktop-corner.jpg` | 1600×900 desktop, the corner ×2 |
| `rim-edge-pixels.jpg` / `n-tick-end-pixels.jpg` | device pixels (nearest-neighbour): the shared rim edge; the N tick next to the end cap |
