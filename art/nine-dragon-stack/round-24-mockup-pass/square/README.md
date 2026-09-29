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

## Pass 2

Sheets: `pass-2/A1-spawn-stand-sheet.jpg`, `pass-2/A2-gate-look-sheet.jpg`, `pass-2/banyan-and-mockup-A.jpg` (style-A's
banyan, the engine's from the square and from A2·6, and mockup A as played).

What changed:

- **The paifang in cinnabar and gold** (`GateSpec.paint: 'cinnabar'`, the square's gate only; the Well's and the stair's
  gates keep the mineral blue-greens). The lintels, panels, brackets, soffits and eave boards are red and gold under the
  teal tiles. From the spawn it had read as a teal-green band. The posts lose the gloss lobe that washed them
  salmon-pink. One row of lanterns across the bays, as in style-A: the passage's second and third rows made a cluster of
  a dozen lanterns in the centre bay.
- **The banyan.** Its crown is a dome from 8 m to 16 m. Before it was one flat slab at 12 m, and a pad from the
  aerials. The main limbs are a quarter thicker and reach lower tiers. The prop roots root only in the planter: the ones
  that rooted on the flagstones stood as a grove of poles in front of the trunk, the planter and the shrine. There are
  120 thin hanging roots, down from 260, and 28 in the long curtain, down from 70, bunched near the trunk. Outside the
  planter they stop above head height. The trunk, the planter and the shrine now read from A2·6 and from the square.
- **Lanterns and lamps.** The two lantern strings across the square's north half are gone: they crossed style-A's frame
  in front of the gate's roofs, where the mockup has none. A string along the east shops replaces them, over the
  market. The lamp posts by the balustrade are gone: they stood in the middle of A1·5 and A2·4, and the targets have
  none. So is the east lamp, which stood inside a booth.
- **A sixth parasol table** in A1·6's foreground, out of the mockup's frame.

Nothing was reverted. Mockup A's viewmodel bug from pass 0 (a cyan slab across the frame) was fixed in another lane, so
mockup A is judged as played from this pass on.

| | before (f1e00629, clean) | pass 2 (1cca856d + this lane) |
|---|---|---|
| lane geometry | 30.70 MB | 29.43 MB (−1.27) |
| textures | — | +0 |
| mockup A | 160 draws / 1.51 M | 124 draws / 1.49 M |
| worst A1 / A2 pose | A2·9 113 draws; A1·5 1.31 M | A2·9 105 draws / 1.27 M; A1·5 1.29 M |

## Pass 3

Sheets: `pass-3/A1-spawn-stand-sheet.jpg`, `pass-3/A2-gate-look-sheet.jpg`, `pass-3/mockup-A-and-trunk.jpg` (style-A,
mockup A as played, and the banyan's trunk from A2·6 before and after).

What changed:

- **The stalls' canvas.** The noodle stall's and the hawker's roofs and awnings are plain weathered oxblood. They were
  red-and-white candy stripes, which from the aerials were the square's loudest thing. Style-A's stall and the A2
  targets' noodle stall carry dark brown-red canvas. The stripes stay on the valances.
- **The banyan's trunk.** It has 20 thick strands standing half out of the core, where it had 30 thin ones lying on it.
  From the gate the trunk read as one smooth brown cone. Now it shows the targets' braid of fused roots, each strand its
  own ridge.
- **The promenade.** Seven walkers along the balustrade between the spawn frame's open foreground and the gate (A1·2,
  A2·2). They stop at z −16.5, so A2·4 keeps its foreground clear to the balustrade.

Nothing was reverted. The same pass tried the promenade zone out to z −19.5. It filled A2·4's foreground with walkers
and was cut back before the commit.

| | before (f1e00629, clean) | pass 3 (be97ea90 + this lane) |
|---|---|---|
| lane geometry | 30.70 MB | 29.31 MB (−1.39) |
| textures | — | +0 |
| mockup A | 160 draws / 1.51 M | 124 draws / 1.50 M |
| worst A1 / A2 pose | A2·9 113 draws; A1·5 1.31 M | A2·9 104 draws / 1.27 M; A1·2 / A1·5 1.29 M |

## Pass 4 (the coordinator's two notes at mockup A)

Sheets: `pass-4/A1-spawn-stand-sheet.jpg`, `pass-4/A2-gate-look-sheet.jpg`, `pass-4/mockup-A-pass3-pass4.jpg` (style-A
| pass 3 | pass 4 as played), `pass-4/mockup-A-overlay.jpg` (style-A | engine | the two blended).

What changed:

- **The gate's lanterns are back.** The coordinator's note: the paifang had lost the warm cluster that glows in and
  under it. The second row (two lanterns a step into the passage), the third row on long cords, and each side bay's
  front lantern are restored. That is 13 lanterns again, as before pass 2.
- **The sign masts.** The coordinator's note: the masts hid the fabric lane's new left-hand stack (九龍, 牙科, 火鍋, 茶
  on the Well's north wall) from mockup A. Each mast is now one slim pole. The ladder ties and the twin poles are gone.
  The masts carry no words: their 九龍 / 牙科 / 火鍋 / 茶 / 藥房 doubled the wall's stack at the frame's edge, and the
  far mast's 麻雀 / 當舖 stood in front of the wall's 牙科 / 火鍋. The dragon hooks stay where they were, so the grapple is
  unchanged.
- **The parasol tables collide.** Each table with its stools and sitters is a 1.5 m box (`stalls.ts` `marketColliders`).
- Tried and dropped in this pass: moving the masts' signs to style-A's column positions, placed by rays from the mockup
  camera. From the spawn they doubled the fabric lane's stack, and 牙科's ray runs along the lip, where no sign can hang
  outside the plaza.

**The paifang in mockup A's frame** (the blend): its size matches. The post span is 220 px against style-A's 230 px on
a 460 px frame, and the height from the ground to the ridge ornaments is 255 against 245 px. It sits about 5 % of the
frame's width left of style-A's gate. Style-A's centre bay is also wider than its side bays: about 2.6× in the frame,
against 1.3× in metres here (`GATE.posts`). Both come from `layout.ts`, `GATE` or the mockup camera's yaw, which are
the coordinator's files.

Walk test: 19 legs, 0 stuck, 0 out.

| | before (f1e00629, clean) | pass 4 (80c4259e + this lane) |
|---|---|---|
| lane geometry | 30.70 MB | 29.09 MB (−1.61) |
| textures | — | +0 |
| mockup A | 160 draws / 1.51 M | 124 draws / 1.50 M |
| worst A1 / A2 pose | A2·9 113 draws; A1·5 1.31 M | A2·9 104 draws / 1.27 M; A1·2 / A1·5 1.29 M |
