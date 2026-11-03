# Golden views, 2026-11-03

Jake (2026-11-03): *"let's go and make 8 golden images for all of the open plots. And then you can score them about,
like, are they fucking good enough or not."*

Eight fixed, repeatable cameras per built plot: the regression set. Each plot folder holds the eight frames
(`<n>-<name>.jpg`), `cameras.json` (exact plot-local and world eye / look, FOV, aspect and the player's ground pose) and
`board.jpg` with each view's score burned in.

**Capture.** Preview `d3b32d2-mw0ppw9a` (runtime-identical to HEAD `fd04f55`: docs-only diff). Chromium as iPhone 16 Pro
portrait 402×603, phone tier, 2× render scale, 62° horizontal FOV, live clock, muted, through `scripts/browser-lane.sh`.
Normal grid entry into the plot, the player posed at the view's `player` point (streaming anchor, so the near tiles draw
at L0), then the free camera (the dome harness's `onLate` override) at `eye` → `look` once the grid's residency settles.
World = plot-local + `origin` in `cameras.json`.

**Re-shoot (G998).** One command captures eight views and runs the existing GOLDEN · NOW board with SSIM per view:

```bash
scripts/browser-lane.sh --max 20 uv run --with pillow --with numpy node \
  art/open-plots/golden-2026-11-03/capture.mjs --plot=night-market \
  --base=http://127.0.0.1:4400/ --out=tmp/golden-night-market-new
```

Use an actual `serve-build.sh` URL. `--out` must be a fresh directory under `./tmp`. With Pillow/NumPy already
installed, omit `uv run --with pillow --with numpy`; `--python` can select that interpreter. Optional `--sha=<full SHA>`
checks the served version; HEAD is never the source authority. The wrapper reuses the dome harness camera and
normal grid entry, waits for residency, checks the physical anchor and emits image hashes plus the source manifest hash.
After a grid swap, local poses follow the product's actual served cell; `capture.json` records historical and current
origins. Read all eight rows in `<out>/board/` before a verdict. SSIM is a regression pointer, not the 1–10 art score
below; the generated board is labelled UNREVIEWED. Golden images and the historical scores stay frozen.

The eight views: 1 road entry, eye level (292 m south on the lane) · 2 40 m over the road · 3 100 m over the southern
neighbour · 4 top-down (430 m) · 5 plaza facing the landmark (62 m south) · 6 beside the landmark looking up (24 m south;
Frostline 58 m, its peak's base is ~50 m across, so the 24 m eye stood inside the mesh) · 7 east avenue, eye level
(175 m out) · 8 far NE corner, 15 m up, back to the landmark.

**Scoring.** 1–10 per view against the plot's approved mockup (round 62 for five plots, round 46 / the round-58 board
for Night Market), weighing theme read, landmark quality, density / dressing, light / colour and defects. GOOD ENOUGH
needs a mean of at least 6.5 and no view under 5.

## Scores

| Plot | 1 road | 2 40 m | 3 100 m | 4 top | 5 plaza | 6 up | 7 avenue | 8 corner | Mean | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| [Night Market](night-market/board.jpg) | 6 | 7 | 6 | 7 | 7 | 6 | 5 | 6 | **6.25** | NOT YET |
| [Frostline Peaks](frostline-peaks/board.jpg) | 6 | 7 | 6 | 7 | 5 | 5 | 6 | 7 | **6.12** | NOT YET |
| [Coral Drift](coral-drift/board.jpg) | 4 | 6 | 5 | 6 | 6 | 6 | 4 | 5 | **5.25** | NOT YET |
| [Lantern Bayou](lantern-bayou/board.jpg) | 4 | 5 | 4 | 6 | 6 | 6 | 5 | 4 | **5.00** | NOT YET |
| [Ember Forge](ember-forge/board.jpg) | 5 | 6 | 5 | 6 | 6 | 4 | 4 | 4 | **5.00** | NOT YET |
| [Mosslight Ruins](mosslight-ruins/board.jpg) | 4 | 5 | 4 | 6 | 5 | 4 | 5 | 4 | **4.62** | NOT YET |
| [Jungle Ziggurat](jungle-ziggurat/board.jpg) (OP13, re-shot on `9c82257`: the 54 m four-stair ziggurat, climbable, G872; before/after in `../../jungle-ziggurat/round-3-stairs/`) | 5 | 7 | 7 | 8 | 7 | 7 | 6 | 6 | **6.62** | GOOD ENOUGH |
| [Patchwork Fairground](patchwork-fairground/) | 6 | 5 | 5 | 6 | 5 | 6 | 5 | 6 | **5.50** | NOT YET |
| [Fossil Badlands](fossil-badlands/) (OP21) | 5 | 6 | 5 | 7 | 6 | 7 | 5 | 5 | **5.75** | NOT YET |
| [Sky Harbor](sky-harbor/) (OP11) | 4 | 6 | 5 | 7 | 6 | 7 | 5 | 6 | **5.75** | NOT YET |

The common pattern: every plot's **top-down matches its mockup's layout** (6–7), and every plot loses points at eye
level, where the mockups show one huge landmark framed by dense dressing and the builds show a small landmark over wide
bare paving. Every road-entry view also carries the billboard defects in
[../billboard-review-2026-11-03/](../billboard-review-2026-11-03/README.md) (poster cut by the road wall, a road sign in
front of it).

## Per plot: three biggest gaps, smallest fix each

**Night Market — NOT YET (6.25), closest.**
1. Plaza and avenues are wide bare terracotta (views 3, 5, 7). Fix: a stall or lantern-post row down each avenue's
   middle third (`nightMarket.mjs` lane life, already gated by `D112`'s gate clear radius).
2. Plaza billboard collides with the plaza stall L (billboard review). Fix: the poster keep-out.
3. Road-entry poster cut by the road wall. Fix: `posters.entry.bottom` 3.0.

**Frostline Peaks — NOT YET (6.12).**
1. The peak's texture is smeary and low-res at plaza range (views 5, 6). Fix: a higher-res near texture for
   `landmark.glb` (re-bake at 2K) or a detail-noise term in the landmark graph.
2. Snow glints read as floating white paper triangles round the lodge (5, 6). Fix: shrink them ~4× and fade them by
   distance (`landmark.glints`).
3. Plaza billboard: pines in front, peak slope behind (billboard review). Fix: drop the (-14, -57) pine mirror and move
   the board to z = -62.

**Coral Drift — NOT YET (5.25).**
1. The coral arch is ~3× too small against the mockup's (views 1, 5, 8): it vanishes from the road. Fix: `landmark.height`
   25 → 60.
2. Lagoons are a grid of identical square pools (3, 4). Fix: round the pool corners / vary the pool sizes in
   `coral.mjs` (one radius parameter).
3. Long empty boardwalk at eye level (7). Fix: palms and lantern posts every ~20 m along the avenues.

**Lantern Bayou — NOT YET (5.00).**
1. The cypress is small and low next to the mockup's giant tree (1, 3, 8). Fix: `landmark.height` 40 → 70 (lanterns
   scale with it).
2. Lit like daytime teal: no dusk, no mist (1, 3). Fix: the bayou's `look.day` key toward dusk plus distance fog.
3. Flat and sparse between ponds (2, 7). Fix: stilt houses and reed clumps on the empty pads (the kit has them).

**Ember Forge — NOT YET (5.00).**
1. Everything outside the lava reads as flat navy black (2, 3, 7, 8). Fix: raise the kit's ambient / albedo for the
   night key (the buildings are lit only by their windows).
2. Close-up landmark texture blurry (6). Fix: re-bake the forge's near texture at 2K.
3. Bare dark ground at eye level (7, 8). Fix: lava-lit props (ingots, carts, ember braziers) along the avenues.

**Mosslight Ruins — NOT YET (4.62), furthest.**
1. Ruins and trees render near-black: no mossy grey stone, no green foliage (2, 5, 7). Fix: lift the stone / foliage
   palette values and the overcast fill so the kit reads grey-green, not silhouette.
2. The tower is small and pale (3, 5, 6, 8); its motes read as paper cards. Fix: `landmark.height` 35 → 55, motes at
   half size.
3. The plaza billboard has a tree through it (Jake's shot) and the entries' posters are swamped. Fix: the poster
   keep-out (billboard review, fix 1).

## Updates

- 2026-11-03, Night Market 2, 3 and 8: refreshed from sp-x9's first plot end-to-end run on `b687d09b21`
  (`../../golden-runs/open-plot-night-market/2026-11-03-b687d09b21-harness-board.jpg`). The plot matches in all three; only
  the sky and the neighbours changed, both intended: 2 and 3 lose the sun disc and its halo (G992, `0d7a022fbb`, after
  these frames were shot), 3's right-hand horizon and 8's left-hand horizon (a grey peak) show the plots G993's grid
  moves (`109ef326d6`) put beside the Night Market.
- 2026-11-03, Ember Forge and Mosslight Ruins 2, 3, 4, 5, 7 and 8: refreshed from OP26's candidate run on `86c0716c30`
  (`../../golden-runs/open-plot-ember-forge/2026-11-03-86c0716c30-op26-board.jpg` and the Mosslight one beside it). The
  plots match; the light is sp-o1's G992 relight (`1cc6b48123`, landed after these frames were shot), and OP26's poster
  keep-out leaves two forges (Ember) and ten ruin, rubble, tree and lantern models (Mosslight) out of the boards' strips.
- 2026-11-03, Coral Drift 1: refreshed from OP26's run on `12ca83e456`
  (`../../golden-runs/open-plot-coral-drift/2026-11-03-12ca83e456-op26-board.jpg`): the road and kerb in front are G993's
  grid move (`109ef326d6`, Coral to (-2, 0)); the entry board stands higher and further from the lane (OP26).
- 2026-11-03, Saltwind Lighthouse: first set, from its activation `e28e863753` (preview `e28e863-mw130re0`), cameras
  Patchwork's plot-local set moved to Saltwind's cell (0, 2) (instance `open-plot-2-4`); final board
  `../saltwind-lighthouse/round-3-final/board.jpg` (its README lists the known gaps).
- 2026-11-03, Patchwork Fairground (OP7): first set, shot on `15efc85eee` through `capture.mjs` (grid entry, its cell by
  slug); cameras are Coral's eight plot-local views. Scored against round 75: the helter-skelter road entry and the
  wheel read; the plaza is bare and the rides small from the air (`../../patchwork-fairground/round-3-final/`).
- 2026-11-03, Fossil Badlands (OP21): first set, shot on the working-tree preview of `e9dd800d7a` (the activation
  `1617441602` as landed) through `capture.mjs`; cameras are the Fairground's eight, moved to its cell, view 6 on the dig
  floor inside the skeleton's rim. Scored against round 75: the top-down's trenches, sumps, camps and corner mesas match
  and the bone-white skeleton reads from its floor; the road entry shows the poster before a small skeleton, and the
  avenue and corner views are wide paving with Night Market's banner poles (`../../fossil-badlands/round-3-final/`).
- 2026-11-03, Sky Harbor (OP11): first set, shot on the working-tree preview of `32d153f7b1` (the activation
  `c6d4f23295` as landed) through `capture.mjs`; cameras are the Fairground's eight, moved to its cell (2, 2). Scored
  against round 62: the top-down's basins, wharves and corner cottages match and the airship reads from the plaza and
  under its gondola; the road entry shows the poster before a small airship, and the basins are square ponds where the
  board joins canals round its docks (`../../sky-harbor/round-3-final/`).
- 2026-11-03, Starfall Observatory: first set, from its activation `d4d4b17674` (preview `d4d4b17-mw13gps7`), cameras
  Patchwork's plot-local set moved to Starfall's cell (1, 2) (instance `open-plot-3-4`); final board
  `../starfall-observatory/round-3-final/board.jpg` (its README lists the known gaps).
- 2026-11-03, Clockwork Canyon: first set, from `c40e60e600` (activation `9091bc1c56` plus lamp-lined avenues; preview
  `c40e60e-mw142b9e`), cameras Patchwork's plot-local set moved to Clockwork's cell (2, 1) (instance `open-plot-4-3`);
  final board `../clockwork-canyon/round-3-final/board.jpg` (its README lists the known gaps).
