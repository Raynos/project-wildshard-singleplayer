# Round 5, seat C, Sky Reach only (red team: the demanding art director)

Surface: `art/mockup-council/round-5/README.md`, the five `far-reach-*.jpg` sheets, the full-res capture
`progress/far-reach/20261003-0033-9dbf50f8/` (every `mock-*`, the four hero views, both aerials, `clip.mp4` at 1/4/7/9.5 s,
`meta.json` `camAt`), round 4's `progress/far-reach/20261003-0009-fb93141c/` cropped side by side with it (mockup | round 4 |
round 5, two bands per view), the five mockups at full resolution (ledger 3), and the source at `9dbf50f82` against
`fb93141c`: `layout.ts` (`KNOLL`, `ROC`, `DAIS`), `world/knoll.ts`, `world/meadow.ts`, `world/dressing.ts`,
`look/panoramaData.ts` (`PANO_SUN`), `look/light.ts`, `look/sunGlow.ts`, `plugin.ts` `stage()`. Regions are fractions of
the game frame (x left→right, y top→bottom, HUD included).

Round 5 is a light-and-tidy round, and to the eye almost nothing moved. Set side by side, round 4 and round 5 are the same
five pictures with a slightly warmer, more orange sky and a hotter sun disc. The meadow is still a lit plane with dark
sticks in it, the fan is still flat brown sticks, the crown is still smooth slabs in rows of tufts. Two things went the wrong
way. The sun was moved further to the **right** of the mill, while four of the five mockups put it on the left. And the
knoll, moved east, is now a **bare, smooth, flat-shaded dome** in two frames, with no grass on it.

## Measured (mockup / round 4 / round 5)

Sky patch x 0.18–0.82, y 0.17–0.33; ground patch x 0.03–0.38, y 0.68–0.82 (mean RGB, then mean chroma). Luminance over
the 3D part of the frame (x 0–0.62, y 0.08–0.85). Every image is decoded and resized to 780×1688, with no grading.

| View | Sky patch | Ground patch | Luminance p99 | Pixels with luminance > 230 |
|---|---|---|---|---|
| A | 197,154,124 c73 / 178,155,136 c44 / **185,156,133 c52** | 80,67,39 c42 / 99,85,25 c74 / **100,84,20 c79** | 242 / 215 / 221 | 3.5 % / 0.1 % / 0.1 % |
| B | 199,166,152 c48 / 179,156,139 c42 / 184,155,135 c50 | 88,74,46 c42 / 87,75,30 c57 / 84,72,25 c58 | 218 / 213 / 220 | 0.3 % / 0.1 % / 0.1 % |
| C | 202,163,141 c62 / 177,161,162 c29 / **181,161,162 c34** | 97,79,42 c54 / (deck) / 101,74,38 c63 | 239 / 215 / 223 | 3.0 % / 0.1 % / 0.1 % |
| D | 133,103,98 c42 / 155,125,123 c42 / 147,113,112 c51 | 86,71,42 c44 / 103,88,39 c63 / 101,84,29 c71 | 246 / 222 / 219 | 4.5 % / 0.4 % / 0.1 % |
| proposal B | 206,191,182 **c26** / 177,150,119 c57 / 178,144,106 **c72** | 73,66,37 (knoll) / sky / sky | 240 / 215 / 223 | 6.1 % / 0.1 % / 0.1 % |

**The sun's side.** I took the brightest blurred point of the sky (y 0.09–0.6) in each frame. Mockup / game:
- A: x 0.35 / **0.70**
- B: 1.00 / 0.83
- C: 0.04 / **1.00**
- D: 0.25 / **0.69**
- proposal B: 0.26 / **0.95**

**The builder's glow claim, checked.** The claim was "10–20 % of each mock view above 230 against the mockups' 16–19 %".
That holds only if "above 230" means the **red channel**: over the whole frame, A is 17.2 → 13.2 %, proposal B 16.0 → 19.0 %.
By luminance the top end did not move: the game's p99 is still 219–223 against the mockups' 239–246, and 0.2–0.8 % of the
frame is above 230 against 1.9–3.7 %. The mid-highs did rise (luminance above 200, A: 4.8 → 9.2 %; mockup 11.4 %). The
grade's saturation pushed orange to clip in the red channel. It did not make anything glow white-gold, and it made the
grass and proposal B's sky more saturated (A's ground chroma 74 → 79 against 42; proposal B's sky 57 → 72 against 26).

## Scores

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-11-review/mockup-A-spawn-look` → `mock-A-spawn-look` | 7.0 | 1. **The meadow (x 0–0.65, y 0.65–0.86).** Unchanged in form from round 4. It is a flat, evenly lit olive plane with separate dark spiky tufts standing on it, and white dandelion-clock flowers on stalks. Its ground is more saturated than round 4's and still lighter than the mockup's (100,84,20 against 80,67,39). The mockup has dense backlit gold grass with three lichen boulders at the lower left (x 0–0.3, y 0.68–0.78). The lantern at the left post (x 0–0.07, y 0.65–0.72) is not in the mockup. 2. **The sun and the isles (x 0–1, y 0.1–0.5).** The mockup's sun burns low at the mill's **left** (x 0.35), under the isle cluster, and floods the left half gold. The game's sits behind the right-hand sail (x 0.70). Its halo is hotter than round 4's, but the pines, the mill's white stone and the house still read front-lit and green. The isles are the same separate, crisp spinning tops. 3. **Under the bridge (x 0.15–0.85, y 0.5–0.66).** Still the grey cliff wall with the comb of strips and the sage shelf (round 4 finding 3). The deck's near end is a thick slab, and the hand ropes are smooth orange tubes. The mockup has open cloud sea under the deck. |
| `round-18-council-mockups/mockup-B-quest-start-painterly` → `mock-B-quest-start` | 6.0 | 1. **The sky (y 0.05–0.45).** Five isles still hang round the mill where the mockup has open cumulus. The sky is a little warmer. The manta now shows as a dark shape cut off at the right edge (x 0.97, y 0.42); it reads as a stray glitch, not a creature. 2. **The keeper and the stand (x 0.05–0.45, y 0.43–0.62).** Same as round 4. The wave is a stiff straight arm, and the cloud sea is behind him. The stand is a red-brown bar post, its book a sliver, the lantern on the ground. The mockup has a carved lectern with an open book, a hung lantern, and a grassy rock ridge behind. 3. **The meadow (y 0.6–0.86).** Tall, pale, silvery blades stand in clumps over dark ground: no rocks, no low gold sward, no warm side light. The darker ground under the blades (`6ce658e63`) shows between the clumps, but it reads as holes, not as a sward in shade. |
| `round-18-council-mockups/mockup-C-hands-fan-painterly` → `mock-C-hands-fan` | 5.5 | 1. **The foreground (x 0–1, y 0.6–0.86).** The camera is back on the meadow (`camAt` y 31.7, verified), so there is ground again (the gain). But the lower right (x 0.45–1, y 0.78–0.86) is the moved knoll: a smooth, flat-shaded dome painted with blotchy moss and **no blades on it**. It is the nearest and crudest surface on screen. The lower left is thin blades over bare ground. The mockup's lower half is a lit grassy verge with flowers and a rough rock at the lower left. 2. **The fan, the subject (x 0.5–1, y 0.5–0.8).** Unchanged: the idle hold leans to the upper left, at about half the mockup's area. It has flat matte brown sticks and guards, with no iron plates, rivets, engraved caps or rim glint, and a clean leaf. 3. **The bridge head, sky and light (x 0–0.7, y 0.1–0.7).** The near post is large at x 0.28–0.45, and the deck enters from the left edge. The mockup's post is at the left margin (x 0.06–0.2), with the deck receding into the centre. The sky is still the coolest of the five (chroma 34 against 62). The mockup's warm light comes from the **left** (its sun at x 0.04); the game's sun is off the right edge. The stone span is excluded from scoring (round 4 ruling). |
| `round-11-review/mockup-D-crown-arena` → `mock-D-crown-arena` (staged `roc-stalk`) | 6.0 | 1. **The arena floor (x 0–1, y 0.58–0.86).** Unchanged. Tufts stand in rows on a pale flat plane, with bare ground between the rows at y 0.6–0.7. The dais is a thin far ellipse whose compass cannot be read, and the fan covers the lower right third. The mockup has a near carved dais (y 0.6–0.66) and lush gold grass with rocks and daisies down to the bottom edge. 2. **The Roc and the sun (x 0–0.75, y 0.28–0.5).** The Roc is larger: its span runs x 0.01–0.73, against the mockup's ~0.95. It is still a symmetric frontal glide, and its left wingtip now runs into the boss bar. The sun moved right (x 0.69, the global `PANO_SUN` change) inside a bigger, brighter halo (`sunGlow` core 2.4 → 3.2, halo 0.6 → 1.0). It is now the largest bright mass in the frame, below and right of the bird. The mockup's sun is a small disc low at the left (x 0.25, y 0.46), clear of the eagle. 3. **The stones and beyond (x 0–1, y 0.45–0.6).** Smooth rectangular slabs, all lit alike, carry thin pale spiral tubes. Beyond them is flat warm haze. The mockup has rough lichen stones with large cut runes, and cloud sea, isles and pines between them. |
| `round-1-proposals/B-sky-reach` → `mock-proposal-B` | 5.0 | 1. **The foreground is gone (x 0–1, y 0.45–0.86).** The camera stands on the knoll's top (7.6, 33.09, −11.5), but nothing of the knoll is in frame above the HUD except a bare, smooth green horizon line at y 0.83–0.86. The mockup's lower 40 % is the knoll itself: a lit grass ridge with daisies and a rough rock, falling away to the bridge. Round 4's crude boulder and box posts are gone, and nothing replaced them. The lower half is now the windmill isle's huge pale inverted keel with stalactites, over open sky. 2. **The composition and scale (x 0–1, y 0.1–0.75).** The bridge enters from the left edge on a diagonal (x 0–0.5, y 0.45–0.62); the mockup's runs straight away from the bottom centre. The windmill isle fills the frame's width, with the mill, the house, five even pines and a sage shelf under the rim (x 0.5–0.75, y 0.47–0.5). The mockup's isle is a small far spur a third of the frame wide. 3. **Sky, sun and life (y 0.05–0.45).** The mockup has pale, bright, nearly colourless air (chroma 26) and a low sun left of the mill (x 0.26). It has isolated isles at many depths and the manta with its glowing trail beside the mill. The game has a saturated orange-peach sky (chroma 72, up from 57), with the sun at the right edge (x 0.95), isles crowding the top, and no manta. |

**Seat score, Sky Reach: (7.0 + 6.0 + 5.5 + 6.0 + 5.0) / 5 = 5.9** (round 4, this seat: 5.9).

## The builder's claims, checked

| Claim | Verdict | Evidence |
|---|---|---|
| Grade saturation 0.32 / contrast 0.24, bloom 0.55 from 0.7, rim ~45 % stronger, hotter sun core | **landed; the glow did not** | `light.ts` rim 1.8,1.22,0.7 → 2.6,1.7,0.85; `sunGlow.ts` core 2.4 → 3.2. The luminance p99 barely moved (215 → 221 in A) and no rim reaches the top of the range. The extra saturation clips the red channel (table). |
| ~10–20 % of each view above 230 against the mockups' 16–19 % | **true only for the red channel** | By luminance: game 0.2–0.8 %, mockups 1.9–3.7 % (whole frame). The metric the builder chose rewards orange, not light. |
| The sun ~9° up, just right of the windmill from the spawn | **verified, and it is the wrong side** | `PANO_SUN.heading` 1.11 → 7.56 (90 = +x). The mockups' suns sit left of the view axis in A, C, D and proposal B (table above). In A the sun is under the isle cluster at the mill's left, the very spot the builder says the high step and winch house hid it. |
| Panorama middle sky warmed to a saturated peach | **partly** | A and C's sky chroma rose 44 → 52 and 29 → 34, still far under the mockups' 73 and 62. Proposal B's sky, whose mockup is pale and nearly grey-gold (chroma 26), went the other way: 57 → 72. |
| Meadow: darker ground under the blades, flowers in tight drifts, olive-gold | **partly** | Drifts read in A. The darker ground shows only as dark gaps in B. A's ground patch is more saturated than in round 4 (blue 25 → 20). D's rows on pale ground are unchanged. |
| Rim crags and code root cones removed from the playable isles | **verified in source** (`dressing.ts` `cragsPerIsle` 4 → 0, `rootsPerM` 2.2 → 0) | Proposal B's brown and green box tops are gone. The comb of strips under A's bridge is unchanged to the eye. |
| Knoll moved 2.6 m east; C back on the meadow; the Roc on its circle | **verified** | `layout.ts` `KNOLL` (7.6, −11.5); `camAt` C y 31.7; `plugin.ts:235` stages at (DAIS.x − 3, DAIS.z − √(13² − 9)), which is on the 13 m circle. |

## No-shortcut audit (ledger 5)

| # | Severity | What | Evidence | Fix |
|---|---|---|---|---|
| X1 | should-fix | **The knoll is bare: the meadow does not grow on it, though its code says it does, and it now shows in two scored frames.** | `knoll.ts` says "the meadow's blades grow over it (world/meadow.ts reads `knollHeight`)", and `meadow.ts:154` adds `farKnoll(p)`. Yet in C (x 0.45–1, y 0.78–0.86) and in proposal B (y 0.83–0.86, and under the HUD) the knoll is a smooth, flat-shaded vertex-coloured dome with no blades. The meadow stops at its foot. This is not a cheat, since it costs both frames, but a surface built for one camera now degrades a second. | Find why the blades are culled or buried on the knoll at its new spot, and grow the full sward over it. Rough its silhouette (the mockup's knoll has a rock at its lip), and drop `flatShading` on the cap. Re-check C and proposal B. |
| X2 | should-fix | **The knoll exists for one camera, and that camera no longer shows it.** | Proposal B's camera stands on its top, at pitch −12°, and the frame above the HUD holds no knoll, no grass and no ground. The 1.4 m rise buys nothing the frame can see. It is real, walkable and named in cameras.json, so it is allowed, but it is not the mockup's knoll. Round 4's X3 nit stands, and is now worse. | Either make it the mockup's knoll (high enough, with its lip in the lower-left third and the bridge falling away down the frame's centre), or re-aim proposal B toward the mockup's downward look. A steeper pitch would put the lip and the lane in frame, which is a re-aim toward the mockup's camera, and it must be named. |
| ok | — | **`roc-stalk`** | Staged on the 13 m circle (X2 of round 4 resolved). `calm: false` (meta `active`). The bolt is a real strike timed to the frame. | — |
| ok | — | **Two H1 boulders removed for the knoll** | `dressing.ts` drops (3.9, −10.4) and (5.2, −10.9), which stood on the knoll's new footprint. That is real layout, not hiding. H1 is unchanged to the eye. | — |
| ok | — | **One look, painted only at infinity** | The sun, grade, rim and panorama are global. The hero views and the orbit clip show the same light as the mock views. Isles, keels and knoll are meshes; storm and cloud sea are sky. HUD baseline (LOCK with a target, VITALS hidden at full health). 0 page errors. | — |

## Findings, ranked by score gained

1. **Put the sun on the mockups' side** (A, C, D, proposal B; whole frame). Four of the five mockups put the sun about 6–17°
   left of the shared north-facing view axis (A x 0.35, C 0.04 with the camera yawed left, D 0.25, proposal B 0.26). This
   round moved it from 1° to 7.6° **right** (`PANO_SUN.heading`), because the high step and the winch house hid it on the
   left. Mockup A shows exactly that arrangement: the sun glowing low under and between the isle masses at the mill's left,
   gold light spilling round them. Fix: one sun, globally, at a heading of about −10° (left), with `SUN_DIR` and the rim
   following. Let the isle cluster and the high step partly occlude it and catch its gold edges, instead of avoiding them.
   This one change also moves D's sun off the Roc to the low left (mockup D), puts C's warm side on the left, where its
   mockup has it, and rims the mill's and pines' left edges as in A. B's mockup (sun at its right edge) is the one view
   that loses: a 4-to-1 trade.
2. **Make light, not saturation** (all five). Measure the glow by luminance, not the red channel. The game's p99 is 219–223
   against 239–246; the top 2–4 % of the mockups is white-gold: the sun core, cloud rims, isle lips, post edges, grass tips
   and fan edges. Push value on the sun-facing rims and cloud edges, so they reach about 240. Pull saturation back in the
   ground and in proposal B's sky (A's ground chroma 79 against 42; proposal B's sky 72 against 26). Tighten D's sun halo,
   which is now the biggest bright blob in the frame.
3. **The meadow is still a lit plane with sticks in it** (A, B, D, and C's lower left; y 0.6–0.86). It is round 4's finding
   1, unchanged on screen: the darker under-sward reads as holes between upright clumps, and D's rows on pale ground are
   untouched. Fix: a continuous low thatch layer of fine, short, curved blades at mixed heights between the clumps, gold only
   on the sun-facing tips. Break D's rows. Put the mockups' rough lichen rocks where they stand: A, three at x 0–0.3,
   y 0.68–0.78; B, lower left; C, lower left; D, down to the bottom edge.
4. **The knoll: grass on it, and a frame that shows it** (C x 0.45–1, y 0.78–0.86; proposal B; X1, X2). Grow the sward
   over it, rough it, and make proposal B's frame show its lip in the lower-left third, with the bridge receding down the
   centre.
5. **Proposal B's isle scale and sky** (x 0–1, y 0.1–0.75). The windmill isle fills the frame where the mockup's is a small
   far spur. The huge pale keel is now half the frame. Darken the keel toward the hero isles' rooted rock, and hide the sage
   keel-top shelf inside the rim cut (round 4 finding 3). Make the sky pale and bright, as the mockup's is.
6. **The fan's finish** (all five; C x 0.5–1, y 0.5–0.8). Unchanged since round 4: iron guard plates with rivets and
   engraved caps, a metal edge that catches the rim light, lacquered ribs, a worn, creased leaf and a longer tassel. In C
   the mockup's fan is about twice the game's area.
7. **The crown** (D; y 0.28–0.86). Give the Roc a bank, talons forward and slate-and-white plumage, and keep its wings
   clear of the boss bar. Make the stones rough and lichened, with cut, unlit runes. Put the dais near and broad, so its
   rose reads. Open the haze between the stones onto the cloud sea, isles and pines.
8. **B's set dressing and sky** (B; x 0.05–0.45, y 0.25–0.62). A carved lectern with an open book and a hung lantern, and
   an open-palm wave. Take the isle cluster out of B's line of sight. Bring the manta's path fully into the frame, or keep
   it out, so it does not read as a clipped dark shape at the right edge.

SCORE sky-reach: 5.9
