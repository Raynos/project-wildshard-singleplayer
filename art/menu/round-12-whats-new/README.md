# Menu round 12: the daily WHAT'S NEW card, second take (SF60, G201)

**Question:** the daily playtest build (G201) shows Jake the day's changes on the main menu. Where does that list live:
a card over the hero, a banner under the logo, or a page inside SETTINGS?

A parallel lane made `art/menu/round-11-whats-new/` the same afternoon (A card over the title art, B a strip above the
doors, C a chip that opens a sheet; real 2026-10-07 lines). This round is the brief's own A / B / C: the same card idea
as A, plus the two lighter placements (a collapsible banner, a SETTINGS tab with a dot). Pick from either board.

Every frame edits the real main menu capture `progress/shard-platform/sf21a/menu-dev-on.jpg` (iPhone portrait,
Developer on, build chip "BC9C3309E · RELOAD"), so the hero, "WILDSHARD", "SHARD SELECT", "INFINITE WILDSHARD" and
"SETTINGS" stay true. C's page edits the real SETTINGS panel `progress/normalization/j10/phone-390x844-settings.jpg`.

**Strings (every variant):** heading **"WHAT'S NEW · WHAT TO TRY"**, build line **"PLAYTEST BUILD BC9C3309E · 7 OCT
2026"**, then the items (examples; the coordinator writes 3–5 each day):

- "Driftwood sits 0.8 m lower — walk in from the road decks"
- "Big item cards in every shop"
- "Pine Hollow fits the memory budget"
- "Open plots fill the empty grid cells"

| file | what it shows |
| --- | --- |
| `board.jpg` | the A / B / C board (B and C in two states each) |
| `A-card.jpg` | **A, a dismissable card over the hero**: a navy-glass card between the logo and the two doors with the heading, the build line, the four items, a **"×"** and a **"GOT IT"** button. The doors and SETTINGS don't move |
| `B-banner.jpg` | **B, a slim banner under the logo, closed**: one line, a cyan dot, **"WHAT'S NEW · 4 CHANGES"**, "BC9C3309E" and a **"▾"** |
| `B-banner-open.jpg` | **B, tapped open**: the banner drops into a panel with **"▴"**, the build line, the four items and **"HIDE UNTIL NEXT BUILD"** |
| `C-badge.jpg` | **C, a dot on SETTINGS**: the menu unchanged except a cyan dot on "SETTINGS" and the caption **"WHAT'S NEW INSIDE"** |
| `C-page.jpg` | **C, the SETTINGS tab**: "BACK", "SETTINGS", tabs **"WHAT'S NEW"** (with the dot) · **"GAME"** · **"DEVELOPER"**, today's list in a framed box, and a collapsed **"YESTERDAY · 7A41D02F0"** row with **"3 CHANGES ▾"** (a short history). Today's main-menu SETTINGS has no tabs; this adds them |

## Recommendation: A, the card over the hero

The card exists to steer Jake's playtest, so he has to read it: A is the only variant he sees at full size with no
tap, and one tap ("GOT IT" or "×") clears it until the next build id. It covers only the hero's sky and road, never
the two doors. B never blocks, but closed it is one line he will learn to skip, and opening it is a tap (JAKE.md: no
phone chores). C is the tidiest menu and keeps a history, but a dot on SETTINGS is the easiest thing to ignore. Round
11's A is the same placement; either A works. Building it is an E332 menu change (herdr to the HUD owners first).

## Notes

- Finals: codex `image_gen`, one take per frame, none re-rolled; every string came back as quoted. 851 × 1848 JPEG.
- Mockups only; nothing is built.
