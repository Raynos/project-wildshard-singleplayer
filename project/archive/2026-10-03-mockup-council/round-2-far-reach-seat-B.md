# Round 2, seat B, Sky Reach (Claude, lens: evidence, region by region)

Surface: the five sheets `art/mockup-council/round-2/far-reach-*.jpg`; the full-res frames in
`progress/far-reach/20261002-2249-1b278da3/` (780×1688: every `mock-*`, the four hero views, both aerials, five frames
of `clip.mp4`); round 1's `progress/far-reach/20261002-2149-7ec2c737/` for before/after; the ledger's five mockups at full
resolution. Method: each mockup scaled to 780×1688, then matching regions (sky and isles, subject band, foreground and
viewmodel, plus close crops of the bridge head, keeper, fan hand, Roc and stones) cut from mockup, round-2 and round-1
frames and set side by side. Mean colours were measured on the same patches. Source checks are at the capture's commit
`1b278da3` (cameras blob `8072eeee`; `stage()` in `plugin.ts` and `quest/install.ts` are unchanged since). Regions are
fractions of the frame (x left→right, y top→bottom). Per-dimension marks: composition and subject (Comp), forms and
silhouettes (Form), materials and detail (Mat), light and colour (Light), density and depth (Depth), hands / weapon / HUD
(Hands).

## Measured colour (R,G,B means; mockup / round 2 / round 1)

Sky patch x 0.18–0.82, y 0.17–0.33. Ground patch x 0.03–0.38, y 0.68–0.82.

| View | Sky patch | Ground patch |
|---|---|---|
| A spawn look | 198,154,125 / 203,176,151 / 202,175,157 | 81,67,39 / **112,102,18** / 118,100,34 |
| B quest start | 197,165,151 / 198,172,148 / 197,171,155 | 87,74,47 / **113,104,22** / 103,102,19 |
| C hands fan | 202,163,141 / **161,145,134** / 153,148,160 | 97,80,43 / 111,100,31 / 115,74,53 |
| D crown arena | **132,103,98 / 154,123,108** / 148,123,118 | 86,71,41 / **132,120,65** / 138,124,74 |
| proposal B | 205,190,181 / 186,154,119 / 176,146,112 | 73,66,36 / **103,96,10** / 102,98,16 |

The spawn skies now match the mockups within a few points, except C (cooler and greyer) and D (lighter: no dark storm
mass). Every meadow is still a saturated yellow-green (blue channel 10–31, against the mockups' 36–47): brighter and
greener than the mockups' darker olive-gold grass.

## Scores

| Mockup | Score | Comp / Form / Mat / Light / Depth / Hands | The three biggest differences (region) |
|---|---|---|---|
| `round-11-review/mockup-A-spawn-look` (mock-A-spawn-look) | **6.0** | 7 / 6 / 5 / 6 / 6 / 5 | 1. **Sky over the mill (x 0.05–0.65, y 0.12–0.45):** the mockup hangs a cluster of big isles with long roots directly behind and over the mill, and puts the sun on the horizon at the mill's left (x 0.35, y 0.43), so the mill and pines are backlit silhouettes. The game's isles sit at the top edge (y 0.08–0.25, cut by it) with open sky behind the mill; the sun is high (x 0.31, y 0.28) and the mill, a house and a stacked cliff behind it are front-lit. 2. **Bridge (x 0.15–0.8, y 0.47–0.66):** now centred between two rope-wrapped posts, the round's biggest gain. The rails are still straight, rigid pale poles where the mockup has sagging knotted ropes, and the planks are flat-shaded with no grain. Under the left rail the far isle's flat grey cliff with dark vertical strips shows, not the mockup's lit cliff over cloud. 3. **Foreground and fan (y 0.64–0.86):** the mockup's darker golden backlit grass with three lichen rocks and clustered daisies; the game's even yellow-green stipple with scattered white and yellow dots, plus a lantern at the left post that the mockup lacks. The game's fan stands upright at x 0.58–1, half past the right edge, the hand behind GUST/DODGE; the mockup's fan sits whole and tilted, lower right, with the gloved hand at its base. |
| `round-18-council-mockups/mockup-B-quest-start-painterly` (mock-B-quest-start) | **6.0** | 6 / 6 / 6 / 6 / 5 / 5 | 1. **The keeper (x 0.1–0.45, y 0.42–0.67):** now a textured wizard: hat, white beard, starred blue coat, scarf, satchel, staff. This is the closest single object in the shard to its mockup. But he stands at the isle's edge with the flat lavender cloud sea right behind him; the mockup's keeper stands inside the meadow, with grass and rocks behind him. He is also about 1.3× the mockup's size: the game's chip reads "KEEPER 6 M" where the mockup's tracker reads "KEEPER 9 M". His arm points rather than waves, and the scarf is bright red, not the mockup's rust-tan. 2. **Behind and above (x 0.3–1, y 0.12–0.55):** the mockup is open sky with big lit cumulus, and a small dark-timber post-mill on a narrow rock spur. The game hangs three isles at y 0.12–0.27 and has a cliff mass at each edge. Its mill is a large white stone tower with a blue cap, a house and a cyan pane beside it. 3. **The stand and ground (x 0.4–0.6, y 0.48–0.68; y 0.68–0.86):** the mockup's low carved lectern with an open, legible book and a lantern hanging from it; the game's tall thin pole stand with a red-brown board, the lantern on top and the bridge post right behind it. The meadow has no rocks: even stipple. The lantern halo is now small and faint (claim verified). |
| `round-18-council-mockups/mockup-C-hands-fan-painterly` (mock-C-hands-fan, staged `fan-gust`) | **5.0** | 4 / 5 / 6 / 5 / 5 / 5 | 1. **The fan and hand (x 0.25–1, y 0.45–0.82):** the finish is much closer: dark lacquered ribs, guard sticks with pierced end plates, the cloud-motif silk, a red tassel. But the mockup sweeps the fan diagonally from lower left (x 0.2, y 0.68) to upper right (x 0.65, y 0.5), held low at the frame's right, wrist bent. The game holds it face-on and upright at x 0.45–1, y 0.5–0.7. Its guards are flat orange-brown slabs with no metal sheen. The hand is small: bare pink fingers on a dark palm, most of it behind GUST. The bracer is a strap at the right edge, and the tassel is a speck under GUST (the mockup's hangs long below the wrist). 2. **Camera and bridge head (x 0–0.45, y 0.45–0.65):** the mockup stands a few metres from the near post: a big rope-wrapped timber post at x 0.06–0.2, y 0.47–0.63, the bridge filling the lower-left quadrant, and a weathered stone span crossing above it (x 0.05–0.9, y 0.45–0.55). The game's nearest post is at x 0.33–0.37, about a third of that height. The bridge is a thin oblique strip at the left, and there is no stone span (round-1 S7 still open). 3. **Sky and middle (y 0.05–0.6):** the mockup's warm gold cumulus over a large dark timber mill (x 0.4–0.75); the game's cooler lavender upper sky (measured above) with three isles hung at y 0.22–0.35, and a small white mill at x 0.45–0.65. In the game's centre-right foreground (x 0.4–0.9, y 0.6–0.75) sit two boulders whose moss caps are hard flat facets; the mockup's rocks are only at the bottom left. |
| `round-11-review/mockup-D-crown-arena` (mock-D-crown-arena, staged `roc-stalk`) | **4.5** | 5 / 5 / 4 / 4 / 4 / 5 | 1. **The sky (y 0–0.5):** the mockup's top half is a dark slate spiral with lightning, and the sun is small and low at the left (x 0.25, y 0.48). The game's painted vortex shows only at the top corners, with two bolts (left y 0.33–0.4, right edge). A huge pale sun bloom fills the centre (x 0.2–0.65, y 0.3–0.47), and the sky patch measures lighter than the mockup's. 2. **The Roc (x 0.05–0.95, y 0.2–0.45):** it is now a textured eagle (barred wings, cream breast, talons), but it sits square behind the boss bar, frontal and level, its body at y 0.28–0.33. The mockup's Roc banks below the bar (body y 0.3–0.45), head turned, talons forward, filling the upper third. 3. **The arena (y 0.45–0.86):** the mockup's four rough, lichen-blotched stones with carved runes, then cloud sea and floating isles beyond them, a large near dais with a carved compass rose (y 0.53–0.6), and lush grass, rocks and flowers to the bottom edge. The game's five smoother slabs with rounded tops and white glyph decals stand against a flat warm haze (no cloud sea, no isles). Its dais is a far, plain grey disc (y 0.6–0.64), and the foreground is a pale bare plane under sparse blades (ground measured 132,120,65 against 86,71,41). The upright fan covers the right third, where the mockup shows only a cloth edge. |
| `round-1-proposals/B-sky-reach` (mock-proposal-B) | **4.0** | 3 / 4 / 5 / 6 / 3 / 4 | 1. **Camera and composition (whole frame):** the mockup stands high on a grassy cliff lip, and a long rope bridge falls away across a cloud chasm to a small isle with a deep rooted underside, the cloud sea filling y 0.45–0.8. The game is the same view as mock-A, 0.5 m forward and pitched down (cameras.json: z −9.5 vs −10). It stands level at the bridge head, with the mill large and high and no chasm. 2. **Isles and life (x 0–1, y 0.25–0.6):** the mockup's five isolated isles at many depths with waterfalls, and the sky-manta beside the mill with a glowing trail; the game's isles crowd behind the mill or are cut by the frame edges, and there is no manta. 3. **Fan and ground (x 0.5–1, y 0.55–0.86):** the mockup's fan sits low, open and tilted, with wind curls in a bare hand; the game's is the same upright, right-clipped fan. Its ground is the saturated yellow-green stipple (103,96,10 against 73,66,36). |

**Seat score, Sky Reach: (6.0 + 6.0 + 5.0 + 4.5 + 4.0) / 5 = 5.1** (round 1, this seat: 4.6).

## The builder's claims, checked against the frames

| Claim | Verdict | Evidence |
|---|---|---|
| Textured HD keeper | **verified** | B x 0.1–0.45: painted coat, scarf, beard, satchel, staff. Pose and scarf colour differ (table). |
| Textured HD Storm Roc | **verified**, but placed badly | D y 0.27–0.36: barred wings, cream breast, talons; hidden behind the bar (and big and close in `h4-crown`). |
| Rope-wrapped bridge-head posts | **verified** | A / proposal B edges: rope coils, iron bands, stone footings. The bands with rivets are not in the mockups. |
| Dark lacquered fan, bronze guards, red tassel | **mostly verified** | C: dark ribs, pierced guard plates (flat orange-brown, no metal read), the tassel small and mostly under GUST. |
| Textured fingerless glove, bracer, sleeve | **partly** | C x 0.6–1, y 0.66–0.8: pink bare fingers and a dark palm, a cream sleeve; the tooled bracer is off frame. In A, B and proposal B the hand is hidden behind GUST/DODGE. |
| Fan held larger and lower | **partly** | Larger yes. In A / B / proposal B it is still upright with half the leaf past the right edge, about 0.07 of the frame higher than the mockups' fan. |
| Crown storm a painted vortex with lightning | **partly** | D: the vortex reads at the top corners and two bolts show, but the centre is a pale sun bloom; the dark mass of the mockup's upper half is missing. |
| Sun beside the windmill | **partly** | A: the sun is up and left of the mill (x 0.31, y 0.28), not on the horizon behind it; the mill is front-lit. |
| Warmer upper sky | **verified for A / B / proposal B; not C** | Sky patches above; C is still lavender-grey. |
| Cloud sea under bridges and past rims | **partly** | B: a flat lavender sea behind the keeper. A / proposal B: under the bridge is the far isle's cliff, and the sea shows only in slivers at the edges. |
| Deeper sward, more clumps | **verified as stated** | Darker ground between blades than round 1. Still uniform and more saturated than the mockups (measured). |
| Faint hover glass | **verified** | Round 1's pale-green rectangles under the bridge are gone; only a thin cyan-framed pane remains beside the mill. |
| Weathered crown stones and dais | **partly** | D: a painted rock texture, but smooth slab silhouettes with rounded tops; the dais is plain, with no carving or moss. |

## No-shortcut check (ledger 5)

- **`quest-crown` (h4, carried into mock-D): reachable.** The quest's four steps end at `raise`
  (`quest/install.ts:47–56`); the Roc is a separate boss with its own flag. So "QUEST COMPLETE" and "DISCOVERED · THE
  STORM CROWN" over the boss bar are a state a player has after walking in over the raised bridge. Nit: `finished()` sets
  `FLAGS.roost` without killing the three roost rays a player must down. They are not in any scored frame.
- **`roc-stalk`: reachable.** The boss bar shows that the fight is on. `stageStalk` (`species/stormRoc.ts:47`) puts the
  Roc in phase 1, on the line its stalk flies, `calm: false`. `storm.strike(0.15)` forces a bolt that the storm throws
  every 3.5–8 s anyway. Round 1's must-fix is fixed.
- **`fan-gust`: the pose is real, but the frame is not one a player sees** (should-fix). `stageHold('gust', 0.36, 2.5)`
  (`WarFan.ts:139`) freezes the GUST motion 0.2 s in. A player's `gust()` (`WarFan.ts:118`) fires the gust FX at k = 0:
  the speed-line streaks and petals (`world/windFx.ts`) are in flight at 0.2 s. The stage skips them, so the frame shows
  the gust pose without its wind, which is nearer to mockup C (it has none). The effect on the score is small, since the
  pose still differs. Fix: stage through `gust()` and then freeze the pose, or stage a pose from a move with no FX.
- **Re-aims that move away from the mockup's camera** (should-fix; neither dodges a weak area outright):
  - `mock-B-quest-start` went from 8 m (round 1) to 5.6 m from the keeper, while the mockup's own tracker reads
    "KEEPER 9 M". Re-aim to about 9 m on the same line.
  - `mock-C-hands-fan`, 3.5 m right and 10 m back, puts the bridge head at about a third of the mockup's size; the
    mockup stands a few metres from the near post. This also shrinks the bridge head, the area round 1 called crudest.
    Re-aim forward to the mockup's framing: the near post large at the left edge, the bridge filling the lower-left
    quadrant.
  - `mock-proposal-B` is still mock-A's camera 0.5 m forward (round-1 seat C's point). The mockup's high-knoll camera is
    not reproduced.
- **Painted only at infinity: no breach found.**
  - Every isle in the frames, the aerials and the clip is a mesh with a rock underside.
  - The painted cloud sea and the storm's painted underside stand in for sky and cloud, not for a place you can walk to.
  - The castle silhouettes in `clip.mp4` are at the horizon.
- **No narrowing:** `h1`–`h3` match round 1, and `h4` gained the textured Roc. The capture had 0 page errors and runs at
  phone tier with the touch HUD. VITALS are hidden at full health in every frame (the E319 baseline HUD, so no breach).
- **After the capture:** `e021f1c63` (the rope bridges sag) landed after `1b278da3` and is not scored here.

## Findings, ranked by score gained

1. **The fan's hold (all five; x 0.5–1, y 0.45–0.86).** The leaf has the finish now; the pose doesn't match. Every
   mockup has the whole fan inside the frame, tilted (A, B, proposal B: low right, about 45° off vertical, the gloved
   hand visible at its base above GUST; C: a diagonal sweep across the centre). Fix: roll and shift `HOLD` (`WarFan.ts:12`)
   so the leaf tilts left and sits wholly in frame, with the hand and its glove clear of GUST/DODGE. Give the guards a
   metallic bronze material and lengthen the tassel. Keep it the idle pose, so it holds in play, not only for the shot.
2. **The crown's sky and the Roc (D, y 0–0.5).** Darken and enlarge the storm's painted mass so it fills the upper
   half, as the mockup's does. Take the bloom off the sun, and put the sun low at the left near the horizon (the mockup
   has it at x 0.25, y 0.48). Stage the Roc further along the same stalk line, nearer and lower, so it reads under the
   bar, banking, talons forward. Every stalk flies that line, so it stays reachable.
3. **The meadow's colour and dressing (A, B, C, proposal B, D; y 0.64–0.86).** It measures far more saturated
   yellow-green than every mockup. Fix: tint the grass toward the mockups' darker olive-gold (lit gold toward the sun),
   cluster the flowers in place of evenly scattered dots, and add the lichen rocks the mockups show (A: three at the
   lower left; B: several in the meadow; D: rocks to the bottom edge). D's pale bare ground needs the same sward as the
   spawn.
4. **The spawn isles and backlight (A, proposal B; y 0.1–0.45).** Hang the isle cluster lower, behind and over the mill
   (A's isles span y 0.27–0.40 with long roots), instead of at the top edge. Put the sun on the horizon just left of the
   mill so the mill and pines read backlit. Drop the house and the cliff stack that fill the sky directly behind the
   mill in the game (A, x 0.1–0.65, y 0.33–0.45).
5. **Mockup C's camera and the stone span (C; x 0–0.9, y 0.45–0.65).** Re-aim to the mockup's camera (see the
   no-shortcut list). Build the weathered stone span over the bridge head that the mockup shows; it has been open since
   round 1. Take the faceted moss caps off the two foreground boulders, or move the boulders to the bottom left where
   the mockup has its rocks.
6. **The arena's ground and back edge (D; y 0.45–0.7).** Rough up the stones' silhouettes (irregular tops, lichen),
   carve the dais's compass rose, and stand nearer the dais, as the mockup does (its dais spans y 0.53–0.6). Let the
   cloud sea and the isles show between the stones, where the game has a flat warm haze.
7. **Mockup B's distance and sky (B).** Re-aim to the mockup's 9 m. The mockup has open cumulus where the game has
   three overhead isles and two edge cliffs; make the isles in this view sit lower and further off, like A's. Use a
   rust-tan scarf and a waving hand.
8. **Bridge finish (A, proposal B, C).** Replace the straight pole rails with sagging, knotted rope rails (the sag of
   `e021f1c63` may already cover this; verify next round). Give the planks a grain and weathering texture in place of
   flat shading.
9. **Proposal B's camera (whole frame).** Proposal B is one of five mockups and still the weakest match. Fix: give it
   its own camera on the highest grass at the spawn's rim, looking down the bridge across the cloud sea, rather than
   A's camera again.

SCORE sky-reach: 5.1
