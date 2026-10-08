# G252: the baked map is B, stylized (SHARD-PLATFORM, E435)

Jake picked **B, stylized** (art/maps/round-1-baked-map-style/). Commit `edad5463d` makes it the shipped bake:

- `scripts/bake-maps.mjs` renders each shard straight down in 2 × 2 tiles. It clears colour and depth before every tile,
  reads the pixels straight after each draw, and draws movers at rest (`MoverRuntime.showRest`, exposed as
  `movers.<system>`, called in the same task as the draws). It renders a colour pass and a height pass, then runs
  `scripts/map-stylize.py`.
- **A colour table per shard**: `src/shards/<slug>/look/map.json` → `style` (kinds `isle` for Driftwood, `void` for Sky
  Reach, `ground` for everything else: nearest-colour classes with flat fills, optional inked edges, raised trees and
  roofs, steep rock, a hillshade). `look/map.json` is part of the world hash, so a palette change makes the map stale.
- **Sky Reach** showed only the island tops: the old bake's generic `sky` name filter hid `far.sky-isles` (the sky isles
  and every island's keel), and the cumulus puffs covered the rest. Now the puffs, storm and sun glow are hidden, the
  painted sea only tints the void, and nothing is clipped below. All eight places sit on their islands in the height pass
  (deck heights 27–47 m at sunrest, windmill, grove, roost, keeper, ruin, step and crown), so no POI data changed.

| shard | top.webp |
|---|---|
| Driftwood | 97 KB |
| Sky Reach | 35 KB |
| Pine Hollow | 93 KB |
| Nalati | 131 KB |
| Signal Dunes | 24 KB |
| template | 26 KB |
| Nine Dragon | not rebaked (world WIP in the shared tree); still the placeholder |

`contact-sheet.jpg` shows each shard standalone on an iPhone 16 Pro in portrait (phone tier, muted, Developer on): the HUD
minimap on top, Bag ▸ MAP below. The full frames are the `<slug>-minimap.jpg` and `<slug>-mapscreen.jpg` files. The real
fog of war still dims unexplored ground. The template's MAP draws only the dim fog (open: check its layer). The grid map
was not captured.

Reproduce: `scripts/serve-build.sh --rev edad5463d` from a scratch dir, then
`scripts/browser-lane.sh node progress/shard-platform/g252/capture.mjs <url> <out dir> driftwood-isle,far-reach,…`.
Rebake: `scripts/browser-lane.sh node scripts/bake-maps.mjs --url=<scripts/serve-build.sh --head> --shards=<slug>`, run from
a clean export, so the stamps hash HEAD's world and not the shared tree's WIP.
