# Round 4, seat C, Sky Reach only (red team: the demanding art director)

Surface: `art/mockup-council/round-4/README.md` (with the lead's ruling: mockup C's stone span is not built and is not
marked down), the five `far-reach-*.jpg` sheets, the full-res capture `progress/far-reach/20261003-0009-fb93141c/` (every
`mock-*`, the four hero views, both aerials, `clip.mp4` at 1/4/7/9.5 s), round 3's `progress/far-reach/20261002-2333-b69c79d1/`
cropped side by side with it (mockup | round 3 | round 4, in three bands per view), the five mockups at full resolution
(ledger 3), and the source at the capture's commit `fb93141c` against `b69c79d1`: `art/far-reach/progress/cameras.json`,
`layout.ts` (`KNOLL`, `ROC`, `DAIS`), `world/knoll.ts`, `world/build.ts` (`far.isle-cut`, `far.isle-keels`),
`world/dressing.ts`, `world/meadow.ts`, `world/skyIsles.ts`, `world/crown.ts`, `quest/keeper.ts`, `weapons/WarFan.ts`,
`plugin.ts` `stage()`, `species/stormRoc.ts`, `scripts/shard-progress.mjs`. Regions are fractions of the game frame
(x left→right, y top→bottom, HUD included).

Round 4 moves the right things a little: the overhead isles now ring the mill in A, the fan leans over with the glove
and tassel clear of GUST, the keeper's scarf is brown, the crown stones carry spirals, the Roc is bigger. None of it
changes what a two-second look says. The meadow is still a flat lit plane stuck with dark spiky tufts, the light still
never glows, the undersides of the playable isles are still a comb of flat strips over a grey wall, and the fan is
still flat brown sticks. Two frames got worse: C lost its whole foreground (the new knoll lifted its camera, unlisted),
and B's open cumulus sky now holds five isles.

## Measured (R,G,B means and luminance; mockup / round 3 / round 4)

Sky patch x 0.18–0.82, y 0.17–0.33; ground patch x 0.03–0.38, y 0.68–0.82. Luminance over the 3D part of the frame
(x 0–0.62, y 0.08–0.85, clear of the right-hand buttons).

| View | Sky patch | Ground patch | Luminance p99 (mockup / r4) | Pixels brighter than 230 (mockup / r4) |
|---|---|---|---|---|
| A | 198,154,125 / 208,178,154 / 179,155,136 | 81,67,39 / 104,91,16 / **99,85,25** | 242 / 215 | 3.4 % / 0.1 % |
| B | 200,167,152 / 200,172,151 / 179,156,139 | 88,74,47 / 95,86,17 / **88,76,30** | 218 / 213 | 0.3 % / 0.1 % |
| C | 203,163,141 / 170,154,150 / 177,162,163 | 97,80,43 / 100,79,46 / 141,108,95 (deck and void now) | 239 / 215 | 3.0 % / 0.1 % |
| D | 133,104,99 / 157,127,126 / 156,125,124 | 86,71,42 / 109,96,27 / **104,89,40** | 245 / 222 | 4.5 % / 0.4 % |
| proposal B | 207,191,182 / 170,144,110 / 177,151,120 | 74,67,37 / 191,162,156 / 151,126,98 | 240 / 215 | 6.0 % / 0.1 % |

- **The grade landed partly.** B's ground is now within a few points of its mockup except blue (30 against 47); A's is
  still brighter and more saturated than its mockup (99,85,25 against 81,67,39); D's is close in hue and still too light.
- **The light has no top end.** In every view the game's brightest 1 % stops at 213–222. Every mockup but B puts
  3–6 % of the frame above 230: the sun's bloom, the lit cloud rims, the gold edges on the isles, the posts and the grass.
  This is the measurable form of "the mockups glow, the game doesn't", and no round so far has moved it.
- **Proposal B's sky** is still more saturated than the mockup's pale open sky (mean saturation 0.42 against 0.29).
- **C's sky** is still the coolest and greyest of the five; A's sky got cooler this round (179,155,136, from 208,178,154),
  partly because the lowered isles now sit in the patch.

## Scores

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-11-review/mockup-A-spawn-look` → `mock-A-spawn-look` | 7.0 | 1. **The meadow (x 0–0.65, y 0.65–0.86).** The mockup's foreground is dense backlit gold grass of mixed height, with three big lichen boulders at the lower left (x 0–0.3, y 0.68–0.78) and daisies in clumps. The game's is a smooth, evenly lit olive plane with separate dark spiky tufts standing on it, and the plane shows between every tuft. The flowers now come in drifts (claim verified), but there are no rocks, and the lantern at the left post (x 0–0.07, y 0.65–0.72) is not in the mockup. 2. **The light and the isles (x 0–1, y 0.08–0.5).** The isles now ring the mill at y 0.2–0.35, where the mockup's hang (the round's gain). But the mockup's are one big overlapping mass, lit gold from behind, hazy, with long roots. The game's are five separate spinning-top shapes, evenly spaced, grey, crisp, and lit from the front. The sun is a small disc behind the hub with no bloom. The mill's white stone, the house and the pines read front-lit and saturated, not as backlit silhouettes. 3. **Under the bridge (x 0.15–0.85, y 0.5–0.66).** Unchanged from round 3 at this view: a grey cliff wall with a comb of evenly spaced flat green and brown strips, a pale sage-green shelf through it (finding 3), and the deck's near end a thick slab with wedge-cut plank ends over a dark gap. The hand ropes are smooth orange tubes with no twist. The mockup has open cloud sea under the deck and the far isle's lit lip. |
| `round-18-council-mockups/mockup-B-quest-start-painterly` → `mock-B-quest-start` | 6.0 | 1. **The sky (y 0.05–0.45).** The mockup's upper half is open, gold-edged cumulus with nothing in it. The game's lowered isles now hang across its middle (x 0–0.9, y 0.23–0.4), five of them, round the mill, where round 3 had two at the top. This is the largest region in the frame, and it now reads as "floating-isle sky" rather than the mockup's "open cumulus sky". (One world serves both A and B, and they look the same way, so this is a trade, not a fault. It is still a difference, and it costs B this round.) 2. **Behind and beside the keeper (x 0–0.8, y 0.3–0.62).** The scarf is now brown (claim verified, `quest/keeper.ts` shader). The rest is as in round 3. He waves with a stiff straight arm, at the rim with the flat cloud sea behind him. The stand is a red-brown square-bar post with a slanted board, its book a sliver, and the lantern on the ground. The mill is large, near, white stone with a blue cap, a house and a cyan glass-pane waterfall. The mockup has a carved lectern with a readable open book and a hanging lantern, and a small dark-timber mill far off on a spur. 3. **The meadow (y 0.6–0.86).** The near grass is taller and denser (claim verified) but pale and silvery, standing blades with no rocks. The mockup's is low gold grass with rocks and daisies, warm side light on it. |
| `round-18-council-mockups/mockup-C-hands-fan-painterly` → `mock-C-hands-fan` | 5.0 | 1. **The foreground (x 0–1, y 0.6–0.86).** The near boulder is gone (claim verified, `dressing.ts` `HERO_STONES`), and with it the last ground in the frame. The lower 40 % is now deck seen from above, open cloud sea, and the windmill isle's pale, washed-out keel hanging under the fan (x 0.55–0.9, y 0.65–0.85). The mockup's lower half is a lit grassy verge sloping to the bridge, with flowers and a rock at the lower left. The camera rose about 1.1 m without a camera change (shortcut check X1). 2. **The fan, the mockup's subject (x 0.5–1, y 0.55–0.8).** It now leans toward the upper left, and the glove, wrist and tassel show clear of GUST (claim verified, `WarFan.ts:14`, the real `HOLD`). But it covers about half the area of the mockup's fan. Its ribs and guards are flat matte brown with oval cut-outs: no iron plates, no engraved corner caps, no rivets, no rim glint, and a clean leaf. The mockup's fan sweeps across the centre, every edge caught by the gold rim light. 3. **The bridge head and sky (x 0–0.7, y 0.15–0.7).** The near post stands at x 0.28–0.45 (the mockup's is at x 0.06–0.2), and the deck enters from the lower-left corner and runs up to the right. The mockup's recedes from the post into the centre. The stone span is ruled out of scoring. The sky is lavender-grey with three isles and a white sun where the mockup has warm cumulus and one far isle. |
| `round-11-review/mockup-D-crown-arena` → `mock-D-crown-arena` (staged `roc-stalk`) | 6.0 | 1. **The arena floor (x 0–1, y 0.58–0.86).** Tufts in visible rows on a pale flat plane, with bare ground between the rows from y 0.6 to 0.7. The dais is a thin dark band at the stones' feet, its compass not visible (the crown.ts joint and inlay recolour cannot show at this angle). The fan covers the lower right third. The mockup has a near carved dais with a compass rose (y 0.6–0.66) and lush gold grass with rocks and daisies to the bottom edge. 2. **The Roc and the sun (x 0.1–0.7, y 0.28–0.48).** The Roc is bigger (span about 0.58 of the frame, from 0.45), but it is still a symmetric frontal glide in brown and cream. The LOCK marker covers its face. The mockup's banks in three-quarter view, a slate-and-white eagle with a white head and yellow beak, talons thrown forward, every barred primary spread, across 0.95 of the frame. The sun sits dead centre under it with a wide halo; the mockup's is small and low at the left. 3. **The stones and past them (x 0–1, y 0.45–0.6).** The stones now carry spirals (claim verified), but they are thin pale tubes on smooth rectangular slabs, all lit the same. The mockup's are rough, lichen-blotched, with big carved concentric runes. Between the stones the game shows flat warm haze. The mockup shows cloud sea, four floating isles and pines. |
| `round-1-proposals/B-sky-reach` → `mock-proposal-B` | 5.5 | 1. **The composition (whole frame).** The camera now stands on the new knoll and looks down (the round's gain). The lower fifth is grass, and the drop reads. But the bridge still enters from the left edge on a diagonal (x 0–0.5, y 0.42–0.65). The mockup's falls straight away from the bottom centre on the view's axis. The windmill isle fills the frame's width (x 0.05–1, y 0.33–0.72), with a huge pale inverted keel cone and stalactites hanging to y 0.72. The mockup's is a small, far, dark rock spur with dense hanging roots, at a third of the frame's width. 2. **The near ground (x 0–1, y 0.72–0.86).** A faceted slab of mottled moss rock fills the lower left (x 0–0.33, y 0.73–0.85). Flat-topped brown blocks and a green rounded block poke up along the rim (x 0.27–0.33, 0.45–0.52 and 0.56–0.62, y 0.73–0.83): these are the tops of the rim's root strips, seen from above. The mockup's knoll is soft grass and flowers falling away to rough rock. 3. **The sky and life (y 0.05–0.45).** The mockup has five isolated isles at many depths, a low sun on the horizon left of the mill, and the sky-manta with its glowing trail beside the mill. The game has four isles crowded round the top, the sun high and right of the mill, more saturated sky, and no manta. |

**Seat score, Sky Reach: (7.0 + 6.0 + 5.0 + 6.0 + 5.5) / 5 = 5.9** (round 3, this seat: 6.0).

## The builder's claims, checked

| Claim | Verdict | Evidence |
|---|---|---|
| Meadow graded olive-gold; twice the flower drifts; taller tufted grass; fuller crown meadow | **partly** | `meadow.ts`: grey-mix grade, flower rate doubled, `high` 0.62 → 0.74, crown `keep` 1. B's ground now matches in R and G; A and D are still lighter and yellower (table). Drifts read in A. The crown is not fuller to the eye: its tufts still stand in rows on bare pale ground (D y 0.6–0.7), and crown `grass` went down 0.85 → 0.72. |
| Windmill isle tapers into textured rock and roots with cloud sea round it | **not at the scored views** | `build.ts` discards the code keel 3.2 m below the deck and hangs a textured keel model 1.8 m below it. In A the area under the bridge is unchanged from round 3 (same wall, same comb). In proposal B the new keel is a pale, hazy inverted cone with stalactites, far bigger than the mockup's spur. The cut leaves a pale sage shelf inside the rim (finding 3). |
| Overhead isles lowered round the low sun behind the mill | **verified** | `skyIsles.ts` `o1`/`o2` 98/108 → 72/80, plus `o3`. A gains. B loses its open sky. |
| The fan's real idle hold leaned to the upper left; glove, wrist and tassel clear of GUST | **verified** | `WarFan.ts:14` `HOLD` roll 0.15 → 0.8, identical in all five views and the hero shots. It is the real hold. |
| The near C boulder removed | **verified** | `dressing.ts` `HERO_STONES` drops `[4.5, -12.2]`. |
| Spiral-carved crown stones, readable dais compass | **spirals verified; compass not readable** | `crown.ts` `TubeGeometry` spiral. The dais is a thin band at this camera. |
| Roc wing-to-wing off the sun's line | **partly** | `ROC_SPAN` 15, staged at a new point (X2). In the frame the sun still sits right under the body (x 0.53, y 0.44). |
| Keeper's scarf brown | **verified** | `quest/keeper.ts` shader patch. |
| Proposal B on a walkable knoll | **verified, real geometry** | `layout.ts` `KNOLL` (5, −11), 1.4 m, hull collider (`build.ts`). See X1 for what it did to C. |

## No-shortcut audit (ledger 5)

| # | Severity | What | Evidence | Fix |
|---|---|---|---|---|
| X1 | should-fix | **The knoll lifted mock-C's camera about 1.1 m, and the round notes don't say so; the frame moved away from its mockup.** | C's camera is unchanged at (3.2, 30, −11.0) (cameras.json at `fb93141c`), but `KNOLL` is centred at (5, −11) with a 4 m base. C stands 1.8 m from its centre, where `knollHeight` gives about 1.14 m. `shard-progress` poses the player and lets him settle for 3 s, so he stands on the rise. In the frame, the post top fell from y ≈ 0.52 to y ≈ 0.67 and the deck is now seen from above (r3 / r4 side by side). The README's camera list is generated from the cameras blobs, so it cannot see a change of the ground under a camera. The result removes the last foreground ground from mockup C's frame. That is not a cheat, since it costs C, but an unlisted change of view is what ledger 5 forbids. | Name it in the round notes. Then put C where mockup C's camera is, on ground: the near post at the left edge (x 0.06–0.2), the grassy verge filling the lower half, the deck receding toward the mill. Have the README's camera list also report each mock view's settled eye height from the capture, so a change of ground under a camera shows up. |
| X2 | should-fix | **`roc-stalk` was re-placed, the README says "staging unchanged", and the new point is off the stalk's path.** | `plugin.ts:234` moved the staged point from (DAIS.x, DAIS.z − 27) to (DAIS.x − 3, DAIS.z − 18). That is 18.2 m from the dais centre, 5 m outside the Roc's 13 m orbit (`layout.ts:111` `ROC.r`), on the side away from the player at the south rim. A phase-1 stalk steers straight at the player (`stormRoc.ts` `act`, heading `yawTo(a, p.x, p.z)`) from somewhere on that orbit, so it never flies there. This is not void: a reachable start on the orbit would put the Roc *nearer* the camera and larger, which is closer to the mockup, so the stage does not flatter the frame. | List the change. Stage on the orbit (at most 13 m beyond the dais, on the far side) or a moment later along the stalk line, and record the brain's state, phase and position in `meta.json` after the settle (round 3 seat A's ask, still open). |
| X3 | nit | **The knoll exists for one camera.** | `KNOLL` sits exactly under `mock-proposal-B` (5.0, 31.4 = 30 + 1.4, −11.0). It is real, walkable, collided and in the mockup, so it is allowed. But at 1.4 m it gives none of the mockup's height (the mockup looks down from well above the bridge), and its flat-shaded cap is the rawest ground on Sunrest. | Keep it only if it becomes the mockup's knoll: a real rise with the bridge falling away down its axis, rocks and lush grass on it. Otherwise the 1.4 m bump is set dressing for one frame. |
| ok | — | **The fan** | The lean is the ordinary `HOLD` in every view and in play. No stage, no freeze. | — |
| ok | — | **Painted only at infinity; no narrowing** | Isles, keels and the knoll are meshes; storm and cloud sea are sky. The hero views and the orbit clip match round 3 apart from the lowered isles. 0 page errors. The LOCK button and its marker on the Roc are the baseline HUD with a target (E319), not a breach. | — |

## Findings, ranked by score gained

1. **The meadow is a lit plane with sticks in it** (A, B, D, proposal B; y 0.6–0.86). Four rounds of grading have not
   fixed it, because the problem is not the colour. Between every tuft the flat, evenly lit ground plane shows. In D the
   tufts stand in rows with bare pale ground between them (y 0.6–0.7). Fix: darken and texture the ground under the
   blades (warm dark thatch and soil, in shadow), so gaps read as depth and not as a floor. Fill with finer blades at
   mixed heights, gold only on the sun-facing tips. Break the crown's rows. Put rough lichen rocks where the mockups have
   them: A, three at x 0–0.3, y 0.68–0.78; B, several in the lower left; D, to the bottom edge. Grade A and D down to
   the mockups' ground (about 81–86 / 67–71 / 39–42).
2. **Let the light glow** (all five; whole frame). The game's brightest 1 % tops out at 213–222. The mockups push 3–6 %
   of the frame above 230: the sun's bloom, gold rims on cloud edges, isle lips, posts, grass tips and the fan's edges.
   Fix this in the shared look, not per view: a real sun bloom in A and proposal B, where the sun is in frame, and rim
   light strong enough to reach the top of the range on the edges facing the sun. Let the camera-facing sides of the
   mill, the pines and the isles fall into warm shade. Pull the isles back into gold haze so they stop sitting crisp.
   Warm C's and A's upper sky. Without this, no view reads as the same finish, whatever the geometry does.
3. **The playable isles' rims and undersides** (A x 0.15–0.85, y 0.5–0.66; proposal B x 0–1, y 0.42–0.83). Under every
   rim the same comb of evenly spaced flat green and brown strips hangs over a grey wall. The new cut has added a pale
   sage-green turf shelf inside the rim, between the strips: the keel model's top, 1.8 m down, showing where the code
   keel is discarded at 3.2 m (`build.ts` `ISLE_CUT` against `far.isle-keels` `y − 1.8`). Seen from the knoll, the
   strips' tops poke above the turf as brown and green blocks. In proposal B the new keel is a huge pale cone. Fix: hide
   the keel model's turf inside the cut, or match the cut to the model's top. Replace the comb with irregular hanging
   roots and moss from the hero isles' texture. Sink the strips' tops below the lip. Give the windmill isle's keel the
   hero isles' dark, rooted rock at the mockup's narrower spur size.
4. **Mock-C's camera and foreground** (C, x 0–1, y 0.45–0.86; X1). Stand where mockup C's camera stands, on the
   grassy verge: the near post at the left edge, the deck receding into the centre, the lower half lit meadow with a rock
   at the lower left. Today the lower 40 % is void and keel.
5. **The fan's finish** (all five; C x 0.5–1, y 0.5–0.8). The lean is right. Now give it mockup C's materials: iron
   guard plates with engraved corner caps and rivets, a metallic edge that catches the rim light, lacquered ribs, wear and
   creases on the leaf, and a longer tassel. In C the mockup's fan is about twice the game's area. Raise the idle hold's
   scale only if it still clears the HUD in A, B and D.
6. **The crown** (D; y 0.28–0.86). Stage the Roc on its orbit (X2), and give the model the mockup's bank, forward talons
   and slate-and-white plumage with a white head. Move the sun off the frame's centre toward the low left, or take the
   halo off it, so the Roc is not a dark shape on a white disc. Make the dais a near carved disc with a compass rose
   between the camera and the stones (the mockup's y 0.6–0.66). Carve the spirals into rough, lichened stones instead of
   laying pale tubes on smooth slabs. Open the haze between the stones onto the cloud sea, the isles and the pines.
7. **Proposal B's bridge axis and isle scale** (whole frame). From the knoll the bridge still crosses diagonally from
   the left edge. The mockup's runs down the frame's centre line to a small, far isle. Fix: a camera on the bridge's
   axis behind the bridge head, on real high ground (X3). Put the manta's real flight path past the mill at the
   mockup's depth.
8. **B's set dressing** (B; x 0.1–0.45, y 0.42–0.62). A carved lectern with an open, readable book and the lantern
   hung from it. Move the keeper a few metres inland, so meadow and rocks stand behind him, not the cloud sea. Relax his
   wave into the mockup's open palm.

SCORE sky-reach: 5.9
