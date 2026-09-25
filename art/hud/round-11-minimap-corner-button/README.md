# HUD round 11: the minimap corner BAG button (E124, 2026-09-25)

Live captures of the built button, not mockups. Round 10 (`../round-10-inventory-button/`, three Qwen mockups) was
rejected. The user's pick words:

> "I want a button that squares out the minimap, so that button should be having a circular edge, and it should [make]
> the top right corner of the minimap into a square, and we don't touch the pause button. You can build it and show it
> to me lol. The button even has top and right straight edge, and on the minimap the button has like a reverse moon edge"

**Built** (`src/ui/BagButton.ts`, styles in `src/ui/styles/minimap.css`): one SVG inside `.ws-minimap`.

- The top and right edges are straight. They sit on the square around the circle, just past the rim's tick tips.
- The third edge is concave. It is an arc around the minimap's centre, about 2.5 px outside the tick ring on a phone
  at 3×, so it hugs the ring the whole way round the corner.
- Glass fill, a 1 px cyan hairline on all three edges, a 2 px cyan bracket on the outer corner, a backpack glyph in
  the corner, where the piece is widest.
- The hit area is the piece plus about 14 px outward, into the screen margin. A tap on the map itself still opens the
  MAP tab.
- **Phone:** the circle steps about 7 px down and 7 px left, so the square's top lines up with PAUSE's top and its right
  edge is 12 px in, like PAUSE's left edge. The PAUSE chip itself is not touched.
- **Menus:** the bag opens the BAG menu on Inventory (tabs Map · Inventory · Achievements). The minimap and M open BAG on
  Map. PAUSE and Esc open the PAUSED menu: Settings, plus Feedback once the review inbox is unlocked. With a single tab
  the tab bar hides.
- `?bagbtn=0` turns it all off: no button, the old place, one menu with every tab.

| File | What it shows |
|---|---|
| `board.jpg` | everything below on one sheet |
| `before-phone-top.jpg` / `after-phone-top.jpg` | iPhone 16 Pro emulation (402×874 @3×), top of the screen, `?bagbtn=0` vs on |
| `corner-zoom.jpg` / `corner-pressed-zoom.jpg` | the corner, 3× capture enlarged ×2 again; the pressed state (`.down`) |
| `desktop-corner.jpg` | 1600×900 desktop, the corner ×2 |
| `menu-bag.jpg` / `menu-paused.jpg` | the BAG menu the button opens / the PAUSED menu PAUSE opens |

Captured from the local dev server with `?skipintro&nolock&weapon=sword&touch&tier=phone&mute=1`.
