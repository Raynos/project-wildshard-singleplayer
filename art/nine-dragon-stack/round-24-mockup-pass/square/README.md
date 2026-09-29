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

## Pass 5 (the coordinator's list: the crowd, the banyan)

Sheets: `pass-5/A1-spawn-stand-sheet.jpg`, `pass-5/A2-gate-look-sheet.jpg`, `pass-5/mockup-A.jpg` (style-A | pass 4 |
pass 5), `pass-5/banyan-and-crowd.jpg` (A2·6's target, the engine's A2·6 in pass 4 and pass 5, then A2·9 in pass 4 and
pass 5).

What changed:

- **A denser crowd.** About 50 more figures across the street north of the gate, the gate's passage, the square, the
  market aisle and the south promenade. They are instances of the same TRELLIS walkers, so they add no geometry. They
  are placed after everything else the square places and on their own random stream, so no earlier figure moves. Their
  number is cut to a multiple of ten, so the figures the other lanes place keep their coat and umbrella: `build.ts`
  picks a figure's variant by its index mod 10.
- **Dark blue umbrellas** (`crowd.ts`). A third of the dark-coat walkers carry `BLUE_UMBRELLA` (0x34507e). Which ones is
  picked by a hash of where they stand. Next to the existing black, oxblood and paper umbrellas, that makes the targets'
  mix. It costs one tinted copy of the walker and two meshes, so +2 draws at most (mockup A 124 → 126) and 0.46 MB.
- **The banyan's ribbons and lanterns.** The limbs leave the trunk at about 6.6 m, so the old 6.5 m cut had kept only a
  handful of ribbons. There are now up to 160 red and gold strips, 0.8–1.8 m long, hanging below the canopy. Twelve red
  lanterns hang on cords from the limbs on the square's side, 5–7.5 m up (style-A, A2·6). The lanterns are instances in
  the lantern system, so they cost no geometry.
- **Memory paid back** (`gate.ts` `relief`). Each carved relief has two cloud scrolls instead of four. The square's ~76
  reliefs spent half their vertices on scrolls a few pixels long at phone size. This saves 0.65 MB. The Well lane's
  reliefs get the same trim.

Nothing was reverted.

| | pass 4 | pass 5 (169402bc + this lane) |
|---|---|---|
| lane geometry | 29.09 MB | 29.07 MB |
| textures | +0 | +0 |
| mockup A | 124 draws / 1.50 M | 126 draws / 1.51 M |
| worst A1 / A2 pose | A2·9 104 draws / 1.27 M | A2·9 106 draws / 1.28 M; A1·2 / A1·5 1.31 / 1.30 M |

## Pass 6

Sheets: `pass-6/A1-spawn-stand-sheet.jpg`, `pass-6/A2-gate-look-sheet.jpg`, `pass-6/A1-7-and-A1-6.jpg` (A1·7's target,
A1·7 in pass 5 and pass 6, then A1·6 in pass 5 and pass 6), `pass-6/mockup-C-and-C1-5.jpg` (mockup C, the engine's
mockup C and C1·5 after the east-shops string was split, and A1·6).

What changed:

- **The last lamp post is gone.** It stood in the middle of A1·7, turned round from the spawn; the target has none.
  With it went `props.ts` `lamp`, now unused.
- **Lanterns over the south half.** Two strings run from the south-west corner's front to the east shops. They hang
  where A1·7's and A1·6's targets hang theirs, behind the spawn and out of mockup A's frame.
- **The east shops' string is in two runs** (the stair lane's note). One runs north of the stair-street's mouth (z 2 to
  10), one south of it. It had crossed the mouth about 3 m in front of mockup C's camera, putting two big lanterns
  across the upper third of that frame. Mockup C and C1·5 are clear of it now (`pass-6/mockup-C-and-C1-5.jpg`).
- **The lotus buds are a shade darker** (0x505157). They are the nearest stone in A1·7, A2·4 and mockup A, and they
  read as pale eggs.
- **Ten more walkers on the south promenade** (A1·7's stream of umbrellas). They are placed like pass 5's extras: last,
  on their own stream, cut to a multiple of ten.

Nothing was reverted. Walk test: 19 legs, 0 stuck, 0 out. No colliders changed in passes 5 or 6.

| | pass 5 | pass 6 (4bd549f7 + this lane) |
|---|---|---|
| lane geometry | 29.07 MB | 29.08 MB (29.09 MB after pass 4, the cap) |
| textures | +0 | +0 |
| mockup A | 126 draws / 1.51 M | 126 draws / 1.51 M |
| mockup C | — | 107 draws / 0.89 M |
| worst A1 / A2 pose | A2·9 106 draws / 1.28 M | A2·9 106 draws / 1.28 M; A1·2 1.32 M |

## Round 2, pass 7 (the coordinator's list: the market, the umbrellas, the balustrade)

Sheets: `pass-7/A1-spawn-stand-sheet.jpg`, `pass-7/A2-gate-look-sheet.jpg`, `pass-7/balustrade-tables-umbrellas.jpg`
(A1·5's target balustrade, the engine's carved panels, a full parasol table, the market aisle's umbrellas).

What changed:

- **Carved balustrade panels.** Each panel face is one carving drawn instanced on every panel, both faces: a raised
  frame, a pair of big ruyi scrolls curling in from the ends, a lotus medallion, and small scrolls toward the middle.
  There are 56 faces, one geometry and one draw. The per-panel dragon reliefs in the square's kit are gone. The panel
  wall is 24 cm thick under a 34 cm rail, as in the targets' heavy balustrade. It still sits inside the colliders'
  span (x −0.1 to 0.5), so no collider changed.
- **The umbrella mix** (`crowd.ts`). The crowd is built when its meshes are first read. The black-umbrella walker's
  figures are then dealt out by a hash of where they stand: a quarter keep black, a quarter go dark blue, and the rest
  join the oxblood and paper variants that `build.ts` already adds. The result is about a quarter each of black, blue,
  oxblood and paper, with no new geometry.
- **Every table full.** The mahjong tables' empty seats are filled, and each parasol table seats four. The parasol set's
  two empty stools are gone, since the sitters bring their own. The 15 new sitters come last, a multiple of three, so
  no other lane's sitter changes coat.
- **The booths as lit boxes.** Each has a warm ceiling under its roof and a brighter back wall. Five glazed roast ducks
  and strings of lap cheong hang from the front beam. There are four lanterns along the eave (was two), a column of
  steam, and a second emitter throwing a warm pool onto the flagstones in front, which the render lane turns into a
  tight pool.

Nothing was reverted.

| | pass 6 | pass 7 (69722f30 + this lane) |
|---|---|---|
| lane geometry | 29.08 MB | 28.39 MB (−0.69) |
| textures | +0 | +0 |
| mockup A | 126 draws / 1.51 M | 127 draws / 1.55 M |
| worst A1 / A2 pose | A2·9 106 draws / 1.28 M | A2·9 107 draws / 1.33 M; A1·2 1.37 M |

## Round 2, pass 8

Sheets: `pass-8/A1-spawn-stand-sheet.jpg`, `pass-8/A2-gate-look-sheet.jpg`, `pass-8/hawker-and-pavilions.jpg` (style-A's
hawker stall, the engine's in pass 7 and pass 8, a pavilion, the pavilions from above, the hawker from the square).

What changed:

- **The hawker stall is a lit box.** Its west end, the side the spawn sees, is a counter-high board, open above. It had
  been closed to the roof, so it read as a brown box in mockup A. Roast ducks and sausages hang on a rail in the
  opening. Both the hawker and the noodle stall have a warm ceiling under the roof and a brighter back wall.
- **Three dining pavilions in the south half** (the targets' seated diners under awnings). Each has four lacquer posts
  under a small plum tiled canopy with a warm-lit soffit and ceiling, a cloth fringe, and a table with a hot pot on its
  burner, bowls and a teapot. There are four diners at each, a lantern at each corner, a warm emitter, and steam. They
  are one instanced set (`set:pavilion`) and one draw. They collide: the table and diners as a box, plus the four posts.
  The 12 diners come last, a multiple of three. A walker who stood where a pavilion now stands is moved to its edge,
  never dropped, so no later figure's coat changes.

Nothing was reverted. Walk test: 19 legs, 0 stuck, 0 out. Mockup C is unchanged (107 draws; the pavilions are behind
its camera).

| | pass 7 | pass 8 (2cd6ddb5 + this lane) |
|---|---|---|
| lane geometry | 28.39 MB | 28.91 MB (cap 29.08) |
| textures | +0 | +0 |
| mockup A | 127 draws / 1.55 M | 127 draws / 1.55 M |
| worst A1 / A2 pose | A2·9 107 draws / 1.33 M | A2·9 108 draws / 1.34 M; A1·2 1.40 M |
