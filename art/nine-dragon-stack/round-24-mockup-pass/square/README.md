# Round 24, the square + gate lane (E281, domes A1 · A2 and mockup A)

The E281 mockup pass, lane "square + gate": Lantern Square's paifang, balustrade, banyan, stalls, props and crowd
(`src/chunks/nine-dragon-stack/world/{square,gate,canopy,banyan,stalls,props,props3d,crowd}.ts`) against the A1 / A2
dome targets (`round-15-eight-domes/{A1-spawn-stand,A2-gate-look}/`) and mockup A
(`round-6-baseline-hud/style-A-jiehua-neon.jpg`). Captured with `scripts/nine-dragon-domes.mjs` from a clean export of
HEAD plus this lane's files. Each sheet is target | engine, three rows of the dome's nine views.

Memory is this lane's meshes (`kit:paifang`, `kit:props`, `canopy`, `crowd`, `glb:lion`, `set:*`), measured against a
clean export of the same HEAD: the fragment's total moves with the other lanes and with what has streamed in.

## Pass 1

Sheets: `pass-1/A1-spawn-stand-sheet.jpg`, `pass-1/A2-gate-look-sheet.jpg`, `pass-1/market-closeups.jpg` (a booth
from the front and from the north, a parasol table, the lotus buds).

What changed:

- **The paifang is lower and broader.** It stood 18.3 m to the ridge beasts, against about 14 m in style-A. A1·9's
  aerial camera, 15 m up behind it, sat level with its roof. `GateSpec.k` (0.78) now scales every height and detail
  while the posts stay on `GATE.posts` and the roofs keep their spans. The side roofs reach further out. Its height is
  now about equal to its width, as in style-A. The paper couplets are gone: style-A's posts and the A2 targets' are bare
  lacquer.
- **The balustrade.** The posts are 0.44 m under a square cap slab. Every post carries a 0.7 m lotus bud, a ruled
  eight-faced lathe whose ribs are the petal seams. There are no lions on the plaza run now: the one by the spawn read as
  a dark lump in the mockup's left foreground. The street run keeps its two end lions.
- **The east market.** Five food booths stand against the east shops and five parasol tables stand among them. Each
  booth has a teal tiled roof (the gate's curved roof in small), a striped valance, a counter, a steamer and a pot, a
  lit back wall and a cook. Each parasol table has a red oil-paper parasol and stools. Each kind is one instanced
  geometry (`props3d.ts` `placeSet`), so it costs one draw. Each copy adds lanterns, a 麵 banner or menu strips (existing
  sign specs only), a light-pool emitter, steam, customers and sitters. The booths have colliders
  (`stalls.ts` `marketColliders`, one line in `colliders.ts`).
- **The crowd.** About 45 more walkers: the gate's passage, the street's first stretch, across the square, the market
  aisle and the promenade south of the spawn.
- **A lantern string over the square's south half.** It hangs behind the spawn, out of the mockup's frame.
- **Memory paid back.** The balustrade, tables and lamps moved into the square cluster's kit, `paifang`, which saves
  one draw. The mahjong tables are rebuilt at a quarter of their vertices. The paifang's plinth reliefs behind the drum
  stones are dropped. The booth's and the shrine's roofs use a coarser grid.

Nothing was reverted. A first try at k 0.73 looked squat in A1·5; k 0.78 with broader side roofs replaced it.

| | before (f1e00629, clean) | pass 1 (f1e00629 + this lane) |
|---|---|---|
| lane geometry | 30.70 MB | 30.22 MB (−0.48) |
| textures | — | +0 |
| lane draws | `kit:paifang` + `kit:props` | `kit:paifang` + `set:booth` + `set:parasol`: +1 where both sets are in view, −1 elsewhere |
| mockup A | 160 draws / 1.51 M | 124 draws / 1.54 M |
| worst A1 / A2 pose | A2·9 113 draws; A1·5 1.31 M | A2·9 105 draws / 1.28 M; A1·5 1.34 M |

The whole-frame numbers are noisy at f1e00629: the same clean build probed twice gave 165.2 and 158.9 MB. Other lanes'
meshes (the facade pieces, `kit:blades`, `kit:bridges`, `kit:crown`, `kit:stair-terraces`) came out different on each
load. This lane's meshes did not vary, so the lane geometry above is the number to go by.

Walk test (`physics-baseline.mjs --mode=walk --shard=nine-dragon-stack`): 19 legs, 0 stuck, 0 out.
