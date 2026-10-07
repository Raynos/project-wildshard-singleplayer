# Grid round 22: entry landings outside the grid (E450 B3)

**Question:** in INFINITE WILDSHARD every shard is entered from the road at its four edge midpoints, and two shards got
entry structures that only make sense next to the road: Sky Reach's **Rising Islet** (G183: a grass islet level with the
road's 8 m entry rises on chains to a gate isle ~50 m in, ~25 m up) and Nine Dragon's **road-height stone landing decks
with the lantern lift** up to Lantern Square (G177 / G184). Played alone from SHARD SELECT there is no road, so the
islet pads and the decks end at the shard's edge over the cloud sea or the fog void. What should they look like there?

Art direction only: codex `image_gen` edits of real captures, iPhone portrait, today's touch HUD, no road anywhere.
Neither entry is built yet (G183 / G184 are picks), so C draws the structure as G183 / G184 describe it plus the
8 m road-shaped mouth the grid socket needs.

| file | what it shows |
| --- | --- |
| `board.jpg` | rows = shards, columns A / B / C |
| `A-skyreach.jpg` | **A hidden**: standing on a big island's grassy rim looking out at the edge: no gate isle, no chains, no islet, only the cloud sea and distant isles (the shard as today) |
| `B-skyreach.jpg` | **B arrival dock**: from the gate isle's lantern-post notch, the four chains run down to the islet waiting at the edge; its outer side carries a short timber sky dock with rope rails, mooring bollards and a tall beacon mast with a brass lantern and a pink pennant: a sky-ship landing stage, not a road end |
| `C-skyreach.jpg` | **C as built**: same camera; the islet's outer side carries the flat 8 m asphalt-and-kerb pad shaped for the road socket, and it stops dead in mid-air, 40 m above the cloud sea |
| `A-ninedragon.jpg` | **A hidden**: at Lantern Square's rim, wet granite up to a carved balustrade, looking out at the dusk sky and the fog void with the cyan chunk-boundary line; no deck, no lift below |
| `B-ninedragon.jpg` | **B arrival terrace**: just out of the lift cage (pavilion eave, lantern and chain at the top / left), looking along the deck: its far end is closed by a carved balustrade with a cinnabar band, a bronze beacon brazier in the middle and two stone-lantern pillars with red lanterns: a lantern-lit lookout you arrive at by the lift |
| `C-ninedragon.jpg` | **C as built**: same camera; the deck runs out to an open 8 m mouth with no rail, a sheer 125 m drop into fog, the chunk-boundary veil hanging just past it |

## Cost and risk

A shard already knows which mode it runs in: `ShardContext.cube` is the 500 m cube in a grid cell and `null`
standalone (src/game/shard/context.ts), and Sky Reach's out-of-cube isles already switch on it.

| | cost | risk |
| --- | --- | --- |
| **A** hidden | each shard's entries builder returns early on `ctx.cube === null`: about 10 lines per shard | the lift and islet exist only in the grid, so a standalone player never rides them and standalone runs no longer test them. Two versions of each shard drift apart. Nothing standalone needs them (no entry lands past a quest), so nothing breaks |
| **B** dock / terrace | the structure stays in both modes. A standalone-only cap piece closes the mouth: Sky Reach gets a plank jetty, rail, bollards and a beacon mast; Nine Dragon gets a balustrade, a brazier and two lantern pillars. That is a few instanced meshes per shard plus one rail collider across the mouth, under `ctx.cube === null`. The beacon is emissive with no real light. About half a day per shard | in the grid the cap must not spawn, because the socket attaches there (the beacon or pillars can stay as a marker beside the mouth). A tiny standalone-only branch to keep green in the physics walk (0 stuck) |
| **C** as built | nothing | an open mouth with nothing past it. Sky Reach drops 40 m into the cloud sea; Nine Dragon drops 125 m into fog, the death or respawn path. Both read as an unfinished road stub, which is the "silly" look G176 rejected |

## Recommendation: B

One world in both modes. The islet and the lantern lift stay real content that players ride and that standalone runs
exercise. The only branch is a small cap that turns the road mouth into a believable arrival point, a lantern you see
from the gate isle or from the fragment rim. A costs less but hides the best new set pieces from SHARD SELECT players
and forks each shard in two. C leaves an open drop shaped like a road to nowhere.

## Notes

- Sources: `progress/far-reach/20261003-0952-6066f959/first-frame.jpg` (a real Sky Reach capture with its in-shard HUD
  and the war fan), `../../far-reach/round-42-entry-ideas/4-rising-islet.jpg` (the G183 islet design), the "N causeway"
  tile of `../../far-reach/round-40-switchbacks/board.jpg` (the real standalone cloud-sea edge),
  `../../nine-dragon-stack/round-30-grid-entries/B-from-above.jpg` (the real standalone deck with its veil and HUD), and
  `../../nine-dragon-stack/round-31-deck-climb/B-1-deck.jpg` (the G184 lift pavilion in the G95 dusk-fog grade).
- Re-rolled: C-skyreach once, because its first take dropped the DODGE and JUMP buttons.
- Mockup liberties: Nine Dragon's city shows as several floating towers in the fog, and A's neon signs carry
  glyph-like marks rather than real characters. Sky Reach's C kerbs are faint. B-skyreach's DODGE / JUMP sit a little
  low over the LOOK pad.
- Prompts and the runner were scratch files; this folder holds only the finals.
