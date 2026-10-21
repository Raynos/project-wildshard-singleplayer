# SHARD-PLATFORM: Jake's open picks (coordinator, 2026-10-10)

These are the picks still open (SF67 audio and the public SHARD SELECT flip were decided as G325 / G326) in `docs/plans/shard-platform/STATE.md`. Each one says what the choice is, gives a
recommendation and points to its evidence. Where no board exists yet, that's stated, along with what a lane would make.

| Pick | The question | Recommendation | Evidence |
|---|---|---|---|
| **SF63 Driftwood shadows "Tight"** | Driftwood's grid cell focuses the page's one shadow cascade (sharper shadows near the player), for about +25 MB | **B (Tight)** only if the +25 MB fits the 1.0 GB Explorer budget on the phone reading (G269); otherwise A | `art/sf63/round-1-driftwood-shadows/board-ab.jpg` (A/B, iPhone portrait, midday, pier + wreck); commit `c9a859b31` (default-off Debug row) |
| **Sky isles random per session** | Sky Reach's decorative sky isles draw from the session's random stream; baking them needs one fixed layout (it unblocks Sky's biggest bake) | **Fixed layout, baked** (the current session's draw, replayed exactly, so the look doesn't change) | `progress/shard-platform/sky36/isles-board.jpg` (A–C three live sessions, D the fixed draw; same spawn, 2 views). The island shapes differ by only 0.7–2.2 % of pixels, so fixing the draw costs nothing visible (`progress/shard-platform/sky36/README.md`) |
| **SF59 fixture looks** | The two fixture shards' material-graph looks (ink-cel-valley, pastel-plain) | Taste call; keep both as they are unless one reads wrong on the phone | `progress/shard-platform/sf59/` (tsl-spike boards: `tsl-spike-desktop.jpg`, `tsl-spike-sim.jpg`, presets, lighting) and `progress/shard-platform/sf59-pastel/` |
| **G260 Blender board** | The Blender Template shard's look and filled layout | Taste call | `art/blender-template/round-2-look/board.jpg`, `art/blender-template/round-3-filled/board.jpg` |

**Bug, not a pick (lane op-ship38 is fixing it):** the Template card in SHARD SELECT boots Driftwood when entered through
its default button. The template's slug is `_template`, and it only enters through the card's SHARDFILE button
(`progress/shard-platform/look30/README.md`).
