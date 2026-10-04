# menu / round-10-continue-progress: CONTINUE and the shard progress map inside SHARD SELECT (FINISH-LINE M1, G132)

**Question: how does SHARD SELECT hold CONTINUE and a map of your shards with progress?** Jake approved FINISH-LINE M1
(CONTINUE + a shard map with your progress) in the E423 grill, then placed both inside SHARD SELECT (G132, 2026-10-04):
the new main menu (G88) stays two cards, "SHARD SELECT" and "INFINITE WILDSHARD". Every variant edits the real capture
of today's built SHARD SELECT (`progress/shard-platform/sf21a/select-dev-on.jpg`), so the blurred crossroads background,
"BACK", the "SHARD SELECT" title, the build chip, "EXPLORE WORLD", "SETTINGS" and the navy-glass / cyan-hairline
language stay true. The progress is invented but believable: Driftwood Isle "QUESTS 3/5", "FEATS 2" (last played), Pine
Hollow "QUESTS 1/4", Nalati Grasslands "NOT VISITED" (0/5). The Developer-only shards keep their amber "DEV" tags.

| File | What it shows |
|---|---|
| `before-after.jpg` | The difference between M1 and the new menu: today's main menu (unchanged), today's SHARD SELECT, and SHARD SELECT with M1 (variant B) |
| `board.jpg` | The pick board: A / B / C side by side |
| `A-continue-card.jpg` | **A**: a wide "CONTINUE · DRIFTWOOD ISLE" card under the header ("LAST PLAYED · 2 QUESTS LEFT"), then a "YOUR SHARDS" strip of round shard badges with progress rings (3/5, 1/4, 0/5, Signal Dunes and Sky Reach "DEV"), then today's carousel, thumbnail row and "ENTER WORLD" |
| `B-map-toggle.jpg` | **B**: a "MAP" / "CARDS" toggle under the header. MAP (shown) is the shards laid out as the real grid (Pine Hollow north, Nalati east, Signal Dunes "DEV" west, Sky Reach "DEV" south, template cells grey in the corners) joined by boulevards and roundabouts, each with its quest count and bar. CARDS is today's carousel. The main button reads "CONTINUE" ("DRIFTWOOD ISLE · LAST PLAYED") whenever the selected shard has progress, else "ENTER WORLD" |
| `C-card-progress.jpg` | **C**: a one-line progress overview above the carousel (Driftwood 3/5, Pine Hollow 1/4, Nalati 0/5, "FEATS 2"); the last-played card carries a "LAST PLAYED" tag, "QUESTS 3/5" with a bar, "FEATS 2" and a filled "CONTINUE" button; the thumbnails get thin progress bars; "ENTER WORLD" stays as the secondary button |

**Recommended: B.** It is the only variant that is really a *map*, which is what M1 promised. It lays the shards out
where they sit in Infinite Wildshard, so the map also teaches the grid. CONTINUE takes the place of the existing big
button, so no new control is added. CARDS keeps today's carousel one tap away. The cost: MAP has no room for the
off-grid Developer shards (Nine Dragon Stack, Template); they stay in CARDS. A is the fastest to build, but its ring
strip is a list, not a map. C has no map.

**How they were made** (ask E438 / FINISH-LINE M1, 2026-10-04): codex `image_gen`, two takes per variant, each editing
the real SHARD SELECT capture (iPhone 16 Pro portrait, build `BC9C3309E`), with every UI string quoted. Kept: A take 2
(A take 1 broke the heading over two lines), B take 1 (take 2's Driftwood looked glossier, less like low-poly toon),
C take 1 (C take 2 was equally good). No take needed a re-roll for garbled text. Frames are 1024 × 1536 JPEG. These are
mockups only: nothing here is built.
