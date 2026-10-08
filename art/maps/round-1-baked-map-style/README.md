# round-1-baked-map-style: Which look for the map baked from the world?

SHARD-PLATFORM G246 / G247, row SF66. `wildshard build` will render each shard straight down (orthographic, the whole
500 m cell) into its map image; icons, places, quest markers and entries stay a data overlay. Jake asked to see the look
first: photo or stylized. This round shows three looks on Driftwood Isle and Sky Reach, each in the round minimap and in
the Bag ▸ MAP screen.

## Everything here is a real render, shown in the real HUD

- **The bake is real.** `tools/bake.mjs` loads the shard standalone (the SHARD SELECT URL, HEAD `46d6962`, phone tier,
  iPhone 16 Pro, muted). It renders the live scene once through an orthographic copy of the game camera, 700 m up,
  looking straight down at the 500 m cell. It draws 2 × 2 tiles of 250 m and stitches them to 1608 px, then
  downsamples to the minimap's own layer of 1000 px (0.5 m per pixel). It skips the post chain (grade, AO, bloom), so
  colours are slightly flatter than in play. A second pass draws every mesh in its world height (16 bit) for the
  stylizer. That pass hides the sky, the sea planes, Sky Reach's painted cloud sea and the transparent effect meshes.
- **The HUD is real.** `tools/capture.mjs` loads the shard again and swaps the minimap's terrain layer for the baked
  image when it is drawn. Both the minimap and the full map draw that same layer (the 1000 × 1000 canvas), so the live
  overlays stay as they are: the "?" rings, the place names ("THE PIER", "CASTAWAY", "Sunrest", "KEEPER"), the YOU
  arrow, the creature dots, the quest card, "PLACES 1 / 9", the "1×" "2×" "4×" chips and
  "DRAG TO PAN · PINCH TO ZOOM". One thing is changed: **the fog of war is drawn fully explored** so the look can be
  judged. Shipped, unexplored ground stays dimmed as it is today (see the `*-now-*` frames). Sky Reach runs in
  Developer mode, so its frames show the fps chip.
- **No image model was used.** B and C are Python / PIL / SciPy processing of the real capture (`tools/stylize.py`).

## The three looks

| | Made how | File per shard |
|---|---|---|
| **A · Photo** | The colour bake as it comes out. | `<shard>-A-map.jpg`, `-A-minimap.jpg`, `-A-mapscreen.jpg` |
| **B · Stylized** | Flat colours by ground type, sorted by the bake's colour and height. Driftwood: deep and shallow water and a shore band in flat blues; sand; four grass bands by height; rock wherever the slope is steep; palm crowns as dots with a small shadow; sand paths cream with a brown edge (the current map's PATH colour); piers and decks as planks with a dark edge; a hillshade from the height pass. Sky Reach: the void a flat dusk violet with a faint glow of the cloud sea; islands in stone tones by height, green where grassy, with a hillshade, a dark rim and a cast shadow; the bridges and chains picked out cream with a dark edge. | `<shard>-B-*` |
| **C · Photo + outlines** | A with contrast +25 % and saturation +12 %, plus a 1–2 px dark ink line wherever the height jumps (cliffs, island rims, decks) or the ground type changes (the coast, paths). | `<shard>-C-*` |
| today | The current registered-pieces map, for reference (fogged, as it ships). | `<shard>-now-minimap.jpg`, `-now-mapscreen.jpg` |

`board.jpg` puts A / B / C side by side per shard. Each column shows a close-up of the minimap cropped from the HUD frame,
then the MAP screen. The full portrait frames are the `*-minimap.jpg` (the whole HUD at the phone's resolution) and
`*-mapscreen.jpg` files.

## Readability at minimap size (about 110 css px across, ±110 m)

- **Driftwood.** All three read. A is pleasant but soft: the paths are only a slightly lighter tan on green. B reads
  best: cream paths with edges, a blue lagoon and dark cliff bands make the routes obvious at a glance. C is crisp, but
  outlining every palm crown makes the ground busy around the arrow.
- **Sky Reach.** A fails at minimap size: the orange cloud sea is louder than the islands, and the creature dots and
  bridges get lost in it. C helps, since the island rims and bridges become dark lines, but the clouds are still the
  loudest thing. B is the only one where islands, bridges and the arrow read at once.
- **Sky Reach's map shows what the old one was missing.** The bake shows the whole field of islets south of Sunrest
  and the islands to the north, east and west, which today's map leaves out (E457, "the map has not been updated").
  Some "?" rings sit beside their islets rather than on them, which is worth checking when the POIs become data.
- **The Rising Islets move.** The bake catches them where they were at that moment. The real bake should pose them at
  rest (the same way `capture.mjs` waits for the north islet in `progress/shard-platform/g200/`).

## Recommendation: B (stylized)

It is the only look that reads at minimap size on both shards. On Sky Reach that settles it, because the photo's cloud
sea swamps the islands. It is generated with no hand work from two passes that `wildshard build` already has to render
(colour + height), so it stays deterministic and hashable for G247. Its colours should be a small table per shard (each
shard keeps its own look: Driftwood's toon palette here, Sky Reach's dusk), and the bake fills that table in.
Runner-up: **C** for a shard whose own render already reads clean from above, as Driftwood's does.

## Reproduce

```bash
scripts/serve-build.sh --head --name mapstyle            # from your scratchpad
scripts/browser-lane.sh node tools/bake.mjs --url=<url> --shard=driftwood-isle --out=<sp>/bake-driftwood-isle.png
scripts/browser-lane.sh node tools/bake.mjs --url=<url> --shard=far-reach --back=painted-sea --out=<sp>/bake-far-reach.png
uv run --with scipy --with pillow --with numpy python tools/stylize.py <slug> <bake.png> <height.png> <maps dir>
scripts/browser-lane.sh node tools/capture.mjs --url=<url> --shard=driftwood-isle --maps=<maps dir> --out=<shots> --at=0,0,6.5,-135
scripts/browser-lane.sh node tools/capture.mjs --url=<url> --shard=far-reach --maps=<maps dir> --out=<shots> --at=0,0,33,20 --dev=1
python3 tools/assemble.py <shots> <maps dir> art/maps/round-1-baked-map-style
```

Bake gotchas, for the real `wildshard build` baker:
- The engine renders with `autoClear` off, so clear colour and depth before every tile. Without that, tiles 2 to 4
  fail the depth test and repeat tile 1.
- The tools also use a fresh camera per tile. That was a guess and may not be needed: the clear was the real fix.
- Read the pixels straight after each draw.
