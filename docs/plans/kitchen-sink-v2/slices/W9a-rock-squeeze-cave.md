# W9a: the Rock and its squeeze cave (the cave host out of the forest page)

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the cave half of the old
**W15** ("a generic `world/interior` (cave is one kind) split from the forest page", HOST-AUDIT **H073** for the cave
part) and the cave part of **M6.4** (Pine's crag cave). Portal interiors (the Training Vault, the Titan arena) are east
work; nothing in the west goes through a portal.

## 1. The showcase piece

| Item | Rows |
|---|---|
| The Rock | a 16 m free-standing crag, 44 × 60 (`layout.js` `ROCK`), modelled in the toon look |
| Squeeze cave | 60 m through the Rock at y −6, two mouths (north on the west avenue, south facing the hover park), a squeeze at mid-length you crouch through, a skylight shaft |
| Lookout | the bench on top (vista ★1, W9b); the ladder chimney on the north face (W8a); the scramble route on the south face (W8b) |
| In the cave | Gold ●4 (W9b), drips, cool cave ambience (W11b) |

## 2. Engine / game / host work, just in time

Research:

- **A terrain cave host exists, inside Pine's forest page.** `src/format/caveInterior.ts` (212 lines): "a cave cut into
  the terrain as rows": `CaveFileSchema { holes, cuts (terrain cut below), spots, inside, shaft {top, foot, r0, r1},
  drips, floor, tris }` and `CaveInteriorSchema { product, file, frame {x, z, yaw} (one mouth), roof, rock {look, fill,
  pbr, grit}, look {near, under, fill, surface: 'rock', shaft, drips} }`. Client host `src/game/client/shardfile/caveInterior.ts`
  (162 lines; imports `fetchDeflated` from `game/plugin/geometry`). It is reached only through the forest page:
  `src/game/client/shardfile/clientForestPage.ts:15-18` ("its optional cave … the cave's cut through the page terrain"). One
  user: Pine's crag cave (`src/shards/pine-hollow/generators/cragLook.ts`, `worldScenes.ts`). Inventory H073: "fold into
  a general host".
- One mouth only (`frame`), one shaft; the squeeze cave needs two mouths.

Work:

| Row / host | Shape | Layer |
|---|---|---|
| `world/caves` section | `[{ id, file, mouths: [{ x, z, yaw }] (1–4), roof, rock, look }]`; `frame` read as `mouths[0]` | format (rename, `mouths`), game host reachable from its own client-plan kind `world.cave`, not only from `world.forest-page` |
| terrain cut | unchanged (`cuts`), now applied by the world host for any product | game |
| off the plugin | `fetchDeflated` moves from `game/plugin/geometry` to a game module | game |
| volume | each cave declares its box for the W0e cube rule | format |

Host bar: two users (Pine, the showcase), 6/6 after the move. Guards: `shard-game-plugins` ratchet, `layer`. Tests:
`test/cave-interior.test.ts`, `test/forest-page-features.test.ts`, `test/forest-page-rows.test.ts`,
`test/isolated-shard-pine-forest-values.test.ts`; new `world-cave-two-mouths.test.ts`.

## 3. Other shards in this slice

| Shard | Today | Migration | Proof | Save risk |
|---|---|---|---|---|
| Pine Hollow | the crag cave inside `world.forest-page` | the page lends its cave through `world.cave`; same file, same look | goldens of the cave mouth and inside (the goldens skill, Pine cameras; Opus); `test/cave-interior.test.ts`; walk in and out | none |

The rest of the forest page (looks, water, wildlife, weather) is untouched here; W11a renames its weather.

## 4. Done when, hours, blockers

**Done when:** you walk into the Rock from the avenue, crouch through the squeeze, come out facing the hover park; the
shaft lights the middle; Pine's cave is pixel-identical (goldens); walk baseline 0 stuck through both caves.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 12 h (Codex host; Opus look) | 8 h | 14 h (Opus: the Rock, the cave file) | **34 h** |

**Blockers:** W0a (the terrain cut reserved).

## 5. Risks

- The cave file is baked from a shell mesh with holes and cuts; Pine's was hand-built. A Blender script for the
  showcase's cave must produce the same file format (the SDK bakes it).

## 6. Questions for Jake

1. **The squeeze.** (a) a real crouch squeeze (1.1 m high for 4 m; crouch exists); (b) a narrow but walkable passage.
   **Recommended (a):** it is called a squeeze cave, and crouch is an existing verb with no use in the west yet.
2. **Light inside.** (a) dark with the shaft and a few glowing crystals (cheap emitters); (b) lit like the outside.
   **Recommended (a):** the cave should feel like a place.
