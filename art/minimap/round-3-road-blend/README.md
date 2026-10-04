# minimap / round-3-road-blend: what the minimap shows at the road boundary (G84)

**Question: on the boulevard between Driftwood (west) and Nalati (east), what does the minimap show?** G84 says there is
no grid map and BAG / MAP / menus stay each shard's own, so the minimap is the only thing that blends at the road
boundary. The boulevard runs north-south. The minimap is north-up and the player arrow sits at its centre. Each board
tile has its minimap at 2× underneath. The HUD stays in today's cyan, so the minimap is the only thing that changes.

| Variant | File | What it shows |
|---|---|---|
| A | `A-terrain-fade.jpg` | Neighbour terrain faded in: Driftwood's own minimap art (sand, lagoon, the pier, palms) left of the road band and Nalati's (steppe, a track, yurts) right of it, darker toward the rim |
| B | `B-road-labels.jpg` | Only the road: the asphalt band on a plain navy disc, with "DRIFTWOOD" curved along the west rim and "NALATI" along the east rim, each with a small chevron |
| C | `C-accent-tint.jpg` | The neighbours as flat translucent tints of their accents: Driftwood MARIGOLD `#fbbb2d` and Nalati EMBER `#fe8169`, with only a faint coastline and track outline |
| + | `N-inside-nalati.jpg` | 40 m inside Nalati (bow in hand): Nalati's own minimap, with the boulevard band near the west rim and a faded sliver of Driftwood's sand and lagoon beyond it (style A) |
| | `board.jpg` | The pick board: A / B / C plus the inside-Nalati frame, each with its minimap at 2× |

**Recommended: A.** It is the only option where the minimap keeps working on the road: you can see the pier, the yurts
and the tracks you are heading for. It continues straight into each shard's own minimap, as the inside-Nalati frame
shows. B tells you names and nothing else. C makes the minimap a colour key and depends on the accent picks. Note for
the build: codex drew A's neighbour terrain almost fully opaque. Build it faded to about 50 % so the road reads as
nobody's ground.

**How they were made** (ask E438, SHARD-PLATFORM mockups, 2026-10-04): codex `image_gen` edits. A, B and C edit the G80
boulevard frame (`art/grid/round-10-asphalt/B-boulevard.jpg`). It already shows Driftwood to the west and Nalati to the
east, and its HUD matches the live layout. The inside-Nalati frame edits a fresh capture of Nalati from the HEAD build
`5ab6a3c08` (`serve-build.sh --head`), taken as an iPhone 16 Pro (402 × 874 @3×), muted, through the browser lane. Its
minimap arrow points south as in the real capture. Every UI string was quoted. The frames are 1024 × 1536, JPEG. No
re-rolls were needed. These are mockups only: nothing here is built.
