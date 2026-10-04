# menu / round-7-new-main-menu: a brand-new Wildshard main menu (G79)

Jake rejected every round-4 variant (two entries bolted onto the old title). G79, his words: *"No literally a brand new
wildshard main menu that has a hero image and two buttons. Shard select and infinite wildshard."*

**Question: which new main menu, one hero image plus exactly two buttons, "SHARD SELECT" and "INFINITE WILDSHARD"?**
"SHARD SELECT" opens today's shard carousel (the old title deck). "INFINITE WILDSHARD" is the 3 × 3 grid and shows only
with Settings ▸ Developer on until its gates pass (G63), so each variant also has a Developer-off frame with
"SHARD SELECT" alone. Every variant keeps the small "SETTINGS" button and the "8C90759 · RELOAD" build chip.

| Variant | Files | What it shows |
|---|---|---|
| A | `A-grid-world.jpg`, `A-grid-world-dev-off.jpg` | Full-bleed hero of the grid world: one landmass, Driftwood centre, Pine Hollow north, Nalati east, six template cells, asphalt roads and the ring road; past the outer wall an infinite cyan-grid VR void (G77). "WILDSHARD" logo top centre; two stacked full-width navy-glass buttons at the bottom (stacked-cards icon / 3 × 3 icon). Developer off: one button in the lower slot. |
| B | `B-crossroads-cards.jpg`, `B-crossroads-cards-dev-off.jpg` | First-person hero at an asphalt crossroads: Driftwood low-poly lagoon front left, Nalati yurts and a horse front right, Pine Hollow pines and a template cell (grey sphere, box hut) ahead. Logo top left; two big side-by-side navy-glass cards with line icons. Developer off: one wide "SHARD SELECT" card. |
| C | `C-letterbox-pier.jpg`, `C-letterbox-pier-dev-off.jpg` | Cinematic letterbox: Driftwood's pier at golden hour (faceted low-poly toon) between black bars; widely tracked "WILDSHARD" in the top bar; plain text buttons in the bottom bar ("›" and a cyan underline on the focused one). Developer off: "SHARD SELECT" alone. |
| D | `D-split-seam.jpg`, `D-split-seam-dev-off.jpg` | The bolder UI language: a split hero, Driftwood from the air on top and the infinite VR void grid below, cut on a cyan seam. A heavy condensed logo; the buttons are solid chamfered slabs on the seam, a cyan "SHARD SELECT" over the world and a navy "INFINITE WILDSHARD" over the void. Developer off: the cyan slab alone. |
| | `board.jpg` | The pick board: A–D big (Developer on), each with its small Developer-off frame underneath. |

**Recommended: B.** Its hero shows the shards meeting at a crossroads, so it reads for both entries. The two big
cards are the easiest thumb targets on the phone and stay in today's UI language. With Developer off it collapses
cleanly to one wide card. A's hero only makes sense for the grid, which most players can't open yet. D's void half is
empty with Developer off. C's text buttons are small to tap.

**How they were made** (ask E438, SHARD-PLATFORM mockups, 2026-10-04): codex `image_gen`, 1024 × 1536 iPhone-portrait frames, two rolls
per variant. The hero references were real captures and earlier grid art: A `art/grid/round-1-overview/B-one-landmass.jpg`,
B `art/grid/round-10-asphalt/cr-A-country-crossroads.jpg`, C `progress/driftwood-isle/20261002-0011-0d59505c/h1-pier.jpg`,
D `progress/driftwood-isle/20261002-0011-0d59505c/aerial-overview.jpg`. The UI language came from
`progress/shard-platform/sf21a/title-shipped-dev-on.jpg`. Every UI string was quoted in the prompt. The Developer-off
frames are codex edits of the chosen Developer-on frames. Picks among the rolls: roll 1 for A, roll 2 for B, C and D
(B's roll 1 had a diamond glyph on the card icon, C's roll 2 has the real rope-wrapped pier posts, D's roll 2 is the
real Driftwood island). No re-rolls were needed for garbled text. These are mockups only: nothing here is built.
