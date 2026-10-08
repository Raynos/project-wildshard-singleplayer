# Playtest round 3: Safari minimaps, the grid MAP's "you", the template's held items (SHARD-PLATFORM, E435)

Fixes for round 3's #6 and #9 and the template held-item note (`art/playtest/round-3-2026-10-08/`). Every capture is
Playwright WebKit as an iPhone 16 Pro (portrait, muted, Developer on). **Before** is production `5234da7b`; **after** is
a clean export of HEAD + this change, built and served locally.

## (6) Blank minimaps in Safari

- **Cause.** WebKit draws nothing at all when an `ImageBitmap`'s source window runs past the image's edge. Chromium clips
  the window. The minimap draws a 440 px window of the 1000 px baked map around the player. So within 110 m of any chunk
  edge (Driftwood's pier and beaches, the SHARD SELECT spawns of Pine and Nalati), the ground vanished. The template's
  plaza spawn is mid-chunk, which is why its minimap drew.
  - An isolated probe confirmed it. A 220 px window: WebKit drew 40000 px inside the image, **0** px past the edge, **0**
    px at a negative x. Chromium drew 27200 and 31000. An `<img>` source clips correctly in both.
- **Fix.** `Minimap.ts` `drawWindow`: the window is cut to the source's bounds and the destination is cut to match. This
  applies to the ground layer and to the fog-coverage canvas.
- **Gate.** `scripts/webkit-render-smoke.mjs` now also boots Driftwood. It fails unless at least 42 % of the minimap disc
  differs from the bare void, measured both at the pier spawn and at (200, 200).
  - Production: 27 % and 31 % (fail).
  - After: 74 % and 54 % (pass).
  - The whole smoke takes 16 s.

| | before | after |
|---|---|---|
| Driftwood pier spawn | `before-minimap-driftwood-spawn.jpg` (dark disc, blue fog blob) | `after-minimap-driftwood-spawn.jpg` (pier, beach, island) |
| Driftwood (150, 150) | `before-minimap-driftwood-150-150.jpg` | `after-minimap-driftwood-150-150.jpg` |

## (9) The grid MAP put YOU in Driftwood's cell

The capture drives (held input) from the road into Template-2 at cell (1, 1), then opens the MAP.

- **Cause.** The full map draws in the home cell's metres, but `play.ts` fed it `player.position` (your current cell's
  metres). The minimap already used `mapAt()`.
  - Fix: the full map now reads `mapAt()` too.
- **The header** said DRIFTWOOD ISLE because the menu kept the boot level's name.
  - Fix: `GameMenu.setLevelName` is called on every grid cell entry. The header now reads TEMPLATE SHARD.
- **Pins and zones from other shards** were drawn in the home cell. A grid resident registers its pins, zone names and
  marks in its own cell's metres, so (for example) Pine's THE RIDGE landed in Driftwood.
  - Fix: `src/game/grid/mapFrame.ts` gives each resident's play host a full map and a minimap shifted by
    `cell.origin − home`. Test: `test/grid-map-frame.test.ts`.
- **Labels collided** (JETTY over SKY REACH).
  - Fix: pin labels now lay out clear of the extras' labels (the cells' shard names) and of the PLACES tally.
- **East / west is not swapped on the map.** The map, the minimap, the compass and the baked map all agree that north is
  +z and east is −x, so Nalati at cell (+1, 0) draws on the left (west).
  - The odd one out is the grid's internal side names (`assembly.ts`: `east: [1, 0]`, so +x is called "east"). These
    are not shown to the player, but the playtest's "Pine E out → Nalati W in" uses them.

| before | after |
|---|---|
| `before-grid-template-map.jpg` (arrow in Driftwood, BAG · DRIFTWOOD ISLE, JETTY / SKY REACH overlap) | `after-grid-template-map.jpg` (arrow in Template Shard, BAG · TEMPLATE SHARD, labels apart) |

## The template's held item and LANTERN

- **What WebKit shows.** Both items render lit, with no black: the whip's mean is 89, and 0 % of it is near-black.
  - Portrait framing put them at the screen edges. The whip (x 0.28) showed as a slab on the right edge. The lantern
    (x −0.3) sat mostly off the left edge.
  - The lantern's light (intensity 2) is invisible by day, so tapping LANTERN changed nothing on screen.
- **Fixes** (`src/kit/items/declared.ts`):
  - In portrait, a declared item's view is pulled in to 70 % of the half-frame at its depth. The lantern moves from
    x −0.3 to −0.215, and the whip covers 31k sampled px instead of 20k. Landscape keeps the declared pose.
  - A lit lantern shows a warm band around its body, which is its own mesh and is never a shared material.
  - Material sharing replaces the item's own material at mount, so changing the body's emissive did nothing.
- **Not changed.** The whip is still a dark-grey (#565656) six-sided rod, because that is the template's declared data.

| before | after |
|---|---|
| `before-template-lantern.jpg` (lantern off the left edge) | `after-template-lantern-lit.jpg` (lantern in frame, lit band) |
