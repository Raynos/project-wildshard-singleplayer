# Rocks, round 3: the Blender island's rocks in B (E114, 2026-09-25)

The user saw `../round-2-b-final/after-spawn.jpg`: a new B rock in front of a bare faceted grey rock from the
Blender-built spawn island. Asked "Convert those to B too?", they answered "Yes, convert them to B". The crags and the
cliffs stay as they are.

**Board: `board.jpg`**. Three cameras, one per column. The rows are:
- before: the live build before this change;
- after: this change;
- `?rocks=now`: the old look, which still brings back every old rock.

Captures are iPhone 390×844 @3×, `touch&tier=phone&mute=1`, on Metal, with the UI hidden.

| file | camera |
|---|---|
| `{before,after,rocks-now}-spawn.jpg` | off the pier, the round-2 `after-spawn` camera: `?explore=world&cam=10,4,-224,-2.36,-0.3` |
| `{before,after,rocks-now}-cluster.jpg` | the boulder cluster on the cove beach: `cam=-28,4.5,-170,2.456,-0.25` |
| `{before,after,rocks-now}-slope.jpg` | small scattered rocks on the slope by the hut path: `cam=-20,5,-140,2.55,-0.35` |

## What changed (`src/world/BlenderIsland.ts`, `src/main.ts`)

The island's `placements.bin` has three kinds of rock (scripts/blender/build_island.py):

- **15 boulders** (`rock0–3`, `rockb0–2`). They stand on the spots of the game's own shore boulders, one per
  `Boulders.scatterShore` rock in the area, and the game's boulders keep their colliders. In rockKit's look they are
  no longer built, and the shore boulders (`Boulders.ts`, already B) are no longer clipped out of the area. So those
  rocks are now the game's own B rocks at the same spots. The colliders are the same as before, because they were
  always the Boulders' hulls, and the drawn rock is now the shape those hulls were made from.
- **400 small rocks** (`smallrock0–2`, 0.5–1.5 m, no colliders). They are rebuilt as B rocks, each at its
  placement's position, tilt and yaw, as wide and as tall as the Blender rock it replaces. They use a lighter build
  (`detail: −1`) and are merged into one mesh (`island-rocks`, one draw).
- **176 crag plates** (`cliff0–5`) on the cliff faces: unchanged, as the user asked. Nothing was fused into the baked
  terrain or cliffs, so nothing had to be cut out.

`?rocks=now` (`v1`) builds the Blender boulders and small rocks as before. The Blender ground-cover `pebble*` clumps
(tiny, `small` kind) are left as they are.

## Budget and physics

| phone tier | before | after |
|---|---|---|
| Blender caster tiles (near) | 274,835 tris | 216,341 |
| `island-rocks` (400 small rocks, 1 draw) | — | 41,640 (~104 / rock) |
| island meshes (draws) | 118 | 111 |
| island props total (log) | 768,635 tris | 751,781 |

The 15 area boulders now draw from the shore-boulder mesh, which was already one draw. No collider changed.
`bake-navmesh --check` says up to date for every shard. `physics-baseline --mode=walk` on Driftwood: 0 stuck on
all 8 legs.
