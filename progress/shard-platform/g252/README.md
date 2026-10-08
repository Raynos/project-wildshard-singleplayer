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
| Sky Reach | 41 KB (G252b: transparent void) |
| Pine Hollow | 93 KB |
| Nalati | 131 KB |
| Signal Dunes | 24 KB |
| template | 26 KB |
| Nine Dragon | not rebaked (world WIP in the shared tree); still the placeholder |

`contact-sheet.jpg` shows each shard standalone on an iPhone 16 Pro in portrait (phone tier, muted, Developer on): the HUD
minimap on top, Bag ▸ MAP below. The full frames are the `<slug>-minimap.jpg` and `<slug>-mapscreen.jpg` files. The real
fog of war still dims unexplored ground. The bottom row is the grid (G252b, below).

Reproduce: `scripts/serve-build.sh --rev edad5463d` from a scratch dir, then
`scripts/browser-lane.sh node progress/shard-platform/g252/capture.mjs <url> <out dir> driftwood-isle,far-reach,…`.
Rebake: `scripts/browser-lane.sh node scripts/bake-maps.mjs --url=<scripts/serve-build.sh --head> --shards=<slug>`, run from
a clean export, so the stamps hash HEAD's world and not the shared tree's WIP.

## G252b: Sky Reach's void, the template's MAP, the grid map

- **Sky Reach: islands and bridges only** (Jake: the void must not read as junk or lava, most likely the orange / red cloud sea
  of the pre-G252 bake, which production `393027e` still ships). `look/map.json` → `style.void: "transparent"`: `scripts/map-stylize.py` now writes an
  RGBA WebP for a transparent void, islands, rims and bridges opaque, the cast shadow a 35 % dark veil, everything else
  see-through, so the minimap's own dark fill and the MAP's frame show through (no glow, no warm tint). Picked over a flat
  calm neutral because it is the neutral each surface already has, and in the grid the cell's own fill. Stamp rehashed
  (`tilesHash 6e9df4b8…`), 41 KB. `far-reach-minimap.jpg`, `far-reach-mapscreen.jpg`.
- **The template's Bag ▸ MAP showed only the fog**: the template boots from its shardfile, and
  `installManifestShardfile` (src/game/shardfile/loader.ts) rebuilt the manifest from the admitted source (`minimap: {}`)
  keeping only the picker identity, so the level had no `minimap.image` and drew the flat painted ground (olive, under the
  fog). Fixed generically: a first-party manifest's `minimap` survives admission, like its card and entries
  (test/shardfile-manifest-source.test.ts). Any first-party shardfile shard gets it. The grid's template copies are only
  affected the same way unless the template was the admitted page shard (the grid's cells read each shard's image from the
  installed manifest list, which admission replaces); on this build they show the template map: `grid-template-*.jpg`. `_template-mapscreen.jpg` now shows the map.
- **The grid map** (INFINITE WILDSHARD, Developer on, iPhone 16 Pro portrait): `grid-home-minimap.jpg` (inside Driftwood),
  `grid-road-minimap.jpg` (the road deck east of home, the two neighbours' maps either side), `grid-mapscreen.jpg` (every
  cell's stylized map at its cell, names, the road), `grid-template-minimap.jpg` / `grid-template-mapscreen.jpg` (inside a
  template copy reached by real travel, the frame floor's template route). Zero page errors (`capture-b.json`).

Reproduce: `scripts/serve-build.sh --rev <sha>` from a scratch dir, then
`scripts/browser-lane.sh node progress/shard-platform/g252/capture-b.mjs <url> <out dir> far-reach,_template grid`.
