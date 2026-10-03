# Round 5, seat B, Sky Reach (Claude, lens: evidence, region by region)

Surface: `art/mockup-council/round-5/README.md`, the five sheets `art/mockup-council/round-5/far-reach-*.jpg`, the
full-res frames in `progress/far-reach/20261003-0033-9dbf50f8/` (780×1688: every `mock-*`, the four hero views, both
aerials, `clip.mp4` as a 0.5 fps strip, `meta.json` `camAt`), round 4's `progress/far-reach/20261003-0009-fb93141c/` for
before/after, and the five ledger mockups at full resolution. Method: each mockup scaled to 780×1688; the same region
cut from mockup, round 5 and round 4 and set side by side (sky and isles, the subject band, the foreground and
viewmodel, plus zooms of the knoll in C and proposal B). On each patch: mean RGB, luminance p10 / p50 / p90, mean chroma
(max−min) and the highlight share (luminance > 230; also the red channel > 230, the builder's measure, see C1). The
brightest blurred blob in each frame locates the sun. Source checked at the captured commit `9dbf50f8`: the diff
`fb93141c..9dbf50f8` over `src/shards/far-reach` (`manifest.ts` grade, `look/light.ts` rim, `look/sunGlow.ts`,
`world/isle.ts`, `world/meadow.ts`, `world/dressing.ts`, `layout.ts` KNOLL, `plugin.ts` `stage`), plus
`world/knoll.ts`, `world/build.ts`, `species/stormRoc.ts`, `art/far-reach/progress/cameras.json`. Regions are fractions
of the game frame (x left→right, y top→bottom, HUD included). Marks per dimension: composition and subject (Comp), forms
and silhouettes (Form), materials and detail (Mat), light and colour (Light), density and depth (Depth), hands / weapon /
HUD (Hands).

## Measured (mockup / round 5 / round 4)

| Patch | Mockup | Round 5 | Round 4 | Reading |
|---|---|---|---|---|
| Play area y 0.05–0.85, luminance > 230 (A / B / C / D / proposal B) | 2.2 / 2.4 / 1.9 / 2.9 / 3.8 % | 0.5 / 0.4 / 0.2 / 0.8 / 0.5 % | 0.2 / 0.2 / 0.3 / 0.4 / 0.4 % | real highlights doubled but are still a fifth to a tenth of the mockups' |
| Play area, red channel > 230 (same order) | 17.6 / 16.0 / 18.8 / 15.8 / 16.4 % | 13.5 / 13.4 / 14.1 / 9.7 / 19.4 % | 4.9 / 5.5 / 7.1 / 5.6 / 8.9 % | the builder's "10–20 % vs 16–19 %": true on this measure, which counts saturated orange sky, not light |
| Play area, luminance p90 (same order) | 204 / 204 / 210 / 206 / 216 | 199 / 198 / 196 / 191 / 205 | 191 / 192 / 193 / 184 / 196 | up 3–9 everywhere: the gain is real |
| Sky x 0–1, y 0.1–0.42: chroma (A / B / C / D / proposal B) | 69 / 49 / 61 / 39 / 37 | 53 / 51 / 44 / 48 / 72 | 46 / 44 / 38 / 40 / 60 | toward A and C, on B, past D and away from proposal B |
| Proposal B sky left x 0–0.35, y 0.15–0.45 | 222,197,172 | 165,133,86 | 158,132,93 | the mockup's pale bright air vs a darker, more saturated orange |
| Ground x 0.03–0.38, y 0.68–0.82: mean; chroma (A) | 80,67,39; 42 | 100,84,20; 79 | 99,85,25; 74 | **moved away**: blue 25 → 20, chroma 74 → 79 |
| Ground (B) | 88,74,46; 42 | 84,72,25; 58 | 87,75,30; 57 | blue 30 → 25 (the builder's (99, 85, 34) is not this patch) |
| Ground (D) | 86,71,42; 44 | 101,84,29; 71 | 103,88,39; 63 | **moved away**: blue 39 → 29, chroma 63 → 71 |
| D mid-ground x 0.05–0.5, y 0.6–0.67: L p10/p50/p90 | 54/95/174 | 52/111/144 | 55/114/141 | the backlit grass tips still stop 30 under the mockup's |
| A pines right of the mill x 0.72–0.95, y 0.4–0.5 | 166,129,109; ch 58 | 165,132,86; ch 79 | 155,127,90; ch 66 | brighter, but saturated green-gold where the mockup's are hazed rose |
| A under the bridge x 0.25–0.75, y 0.53–0.6 | 147,99,74 | 120,88,55 | 114,89,64 | still a wall, now plain grey stone (the root strips are gone) |
| Sun: the brightest blob (x, y) A / C / D / proposal B | (0.34, 0.35) / (0.07, 0.36) / (0.24, 0.46) / (0.24, 0.40) | (0.71, 0.36) / (1.00, 0.44) / (0.69, 0.43) / (0.94, 0.24) | — | **the sun sits on the opposite side** from four of the five mockups (B's is at the right edge) |

## Scores

| Mockup | Score | Comp / Form / Mat / Light / Depth / Hands | The three biggest differences (region) |
|---|---|---|---|
| `round-11-review/mockup-A-spawn-look` (mock-A-spawn-look) | **7.0** | 8 / 7 / 6 / 6 / 7 / 7 | 1. **The sun and the backlight (x 0.2–0.8, y 0.25–0.5):** the mockup's sun burns left of the mill (x 0.34) in a gold flood that turns the pines and the mill dark against it; the game's sun is now a soft glow right of the hub (x 0.71, no visible disc, blurred peak L 239 vs 252), and the pines right of the mill are lit saturated green (ch 79 vs 58). The house behind the mill (x 0.15–0.35, y 0.3–0.42) is still there. The sky is warmer than round 4 (ch 53 vs 46; the mockup's 69). 2. **Under the bridge (x 0.25–0.75, y 0.53–0.6):** the code root strips are gone, so the band under the windmill isle's lip reads as a plain grey stone wall where the mockup has lit air and hanging roots. 3. **The foreground (y 0.64–0.86):** dark upright tufts over flat olive paint, now more saturated than round 4 (ch 79 vs the mockup's 42); flowers in small clumps (the drift change shows only weakly here); no rocks where the mockup has three lichen boulders at the lower left; the lantern at the left post. The leaned fan and gloved hand match the mockup's grip. |
| `round-18-council-mockups/mockup-B-quest-start-painterly` (mock-B-quest-start) | **6.5** | 6 / 6 / 6 / 7 / 6 / 7 | 1. **The sky over the mill (x 0.3–1, y 0.25–0.45):** unchanged and named as not done: the lowered isle cluster hangs over the keeper and the mill where the mockup has open gold cumulus. The sky's chroma now matches (51 vs 49), and a free ray now shows at the right edge (x 0.97, y 0.37), which the mockup lacks. 2. **The keeper and his stand (x 0.05–0.42, y 0.43–0.62):** the rim and the cloud sea behind him where the mockup has a grassy rock ridge; a square post with a red-brown board and the lantern on the ground, not the carved lectern with an open book and a hung lantern. 3. **The mill and the meadow (x 0.4–1, y 0.3–0.86):** a large white tower, the house and the cyan waterfall pane against the mockup's small dark timber post-mill on a spur; tall pale blades over saturated paint (ground blue 25 vs 46), no rocks at the lower left. The quest chip reads "TALK TO THE KEEPER", the mockup's "RAISE THE BRIDGE". |
| `round-18-council-mockups/mockup-C-hands-fan-painterly` (mock-C-hands-fan) | **5.0** | 4 / 5 / 5 / 4 / 5 / 7 | 1. **The foreground (x 0–1, y 0.6–0.86):** the camera is back at meadow height (camAt y 31.7, verified), but the moved knoll's west foot is 0.43 m from the camera, so its flank now fills the lower centre-right (x 0.35–1, y 0.8–0.86) as a smooth dark-olive dome with few blades; the lower left is the bridge deck and a strip of cloud sea. The mockup's lower-left third is lit meadow sloping to the bridge, with a rock. 2. **Sky and middle (x 0–1, y 0.05–0.6):** still lavender-grey above (ch 44 vs 61; round 4 38), five textured isles across y 0.33–0.5 where the mockup shows one, a small white mill where it has a big dark-timber mill on a spur; the sun is at the right edge (x 1.0), the mockup's at the left (x 0.07). 3. **The fan (x 0.45–1, y 0.55–0.8):** unchanged: the leaned idle hold, glove, bracer and red tassel (good), at about two-thirds of the mockup's leaf size, flat brown sticks with no riveted metal guards or diamond end caps. The near post is twice the mockup's size in the centre-left. |
| `round-11-review/mockup-D-crown-arena` (mock-D-crown-arena, staged `roc-stalk`) | **6.0** | 6 / 6 / 5 / 5 / 5 / 6 | 1. **The Roc and the sun (x 0.1–0.9, y 0.25–0.5):** the Roc is bigger (wingspan ~0.73 of the frame; round 4 0.59; the mockup's ~0.96, tips past the edges), still a symmetric frontal glide with no bank or forward talons. The hotter sun core now makes a large white halo right of centre (x 0.69, y 0.43; L > 230 over 10 % of x 0.3–0.75, y 0.4–0.5) that washes out the lower storm; the mockup's sun is small and low at the left (x 0.24, y 0.46). 2. **The arena (y 0.5–0.7):** the stones are warmer and rim-lit (L p50 158 vs 168), the spirals still glow pale cyan where the mockup's runes are cut; the dais is a thin far ellipse (y 0.58–0.61) whose compass does not read; between the stones a warm haze, no cloud sea, isles or pines. 3. **The meadow (y 0.6–0.86):** tufts over pale paint in the mid-ground, the tips' p90 144 vs 174, more saturated than round 4 (ground ch 71 vs 44); no rocks; the fan over the lower right quarter, the mockup's only a cloth edge. "QUEST COMPLETE" chip (from the staged quest) where the mockup has none. |
| `round-1-proposals/B-sky-reach` (mock-proposal-B) | **5.0** | 4 / 5 / 5 / 4 / 5 / 6 | 1. **No ground (x 0–0.75, y 0.6–0.86):** with the knoll moved to the rim, the camera on its top looks out over the drop: above the HUD there is only cloud sea, and the knoll's crest shows as a sliver under the HUD (y 0.87). The round-4 boulder and box posts are gone (good), but so is the mockup's main foreground: a lit grass ridge with daisies and a rock filling the lower left ~40 % and running down to the bridge. 2. **The bridge and the windmill isle (x 0–1, y 0.15–0.6):** the camera stands 7.6 m east of the bridge's axis, so the bridge crosses in from the left edge (y 0.4–0.55) instead of falling away up the centre from the bottom; the windmill isle fills ~85 % of the frame's width with the mill, the house, the cyan pane and five even pines, where the mockup's is a small far spur in the middle third. Its tapered keel with stalactites is the one area close to the mockup. 3. **Sky and life (x 0–1, y 0.05–0.45):** the mockup's pale bright air (left 222,197,172, ch 37) with the sun low left of the mill and the sky-manta beside it; the game's darker, more saturated orange (165,133,86, ch 72, further off than round 4's 60), the sun in the top right corner, no manta. |

**Seat score, Sky Reach: (7.0 + 6.5 + 5.0 + 6.0 + 5.0) / 5 = 5.9** (round 4, this seat: 6.0).

## The builder's claims, checked against the frames and the code

| Claim | Verdict | Evidence |
|---|---|---|
| Grade saturation 0.32 / contrast 0.24, bloom 0.55 from 0.7 | **verified in code; global** | `manifest.ts` grade (one shard-wide grade). Hero views move the same way as the mock views (h1 chroma 51 → 59, h4 49 → 56, p90 +7 to +8): not tuned for the mock views. |
| Rim light ~45 % stronger | **verified in code** | `look/light.ts` rim [1.8, 1.22, 0.7] → [2.6, 1.7, 0.85] (+44 % red). Visible on D's stones and A's mill edges; it lights front faces too (A's pines ch 79). |
| A hotter sun core | **verified** | `sunGlow.ts` core 2.4 → 3.2, halo 0.6 → 1.0; D's sun zone L > 230 3.4 → 10.4 %. In D it reads as an over-large white halo. |
| The sun ~9° up just right of the windmill from the spawn | **verified, and it is the wrong side** | A's brightest blob at x 0.71, right of the hub; mockup A's at x 0.34, left of the mill. Mockups C, D and proposal B also put the sun left (x 0.07, 0.24, 0.24). |
| The panorama's middle sky a saturated peach | **verified** | Sky chroma +6 to +12 in every view; it overshoots D (48 vs 39) and proposal B (72 vs 37). |
| 10–20 % of each mock view above 230 vs the mockups' 16–19 % | **true only for the red channel** | Red > 230: game 9.7–19.4 %, mockups 15.8–18.8 % (D at 9.7 is under the claimed 10). Luminance > 230, the actual highlights: game 0.2–0.8 % vs mockups 1.9–3.8 % (C1). |
| Darker ground under the blades | **verified, small** | `isle.ts` tint (0.78, 0.82, 0.6) → (0.62, 0.66, 0.58); ground p10 B 30 → 26, D 41 → 38. |
| Flowers in tight drifts | **partly** | `meadow.ts` drift × a second noise field, density 0.07 → 0.24 inside drifts. A and D show small clumps; the frames still read as scattered white dots at this range. |
| Olive-gold meadow, B (99, 85, 34) vs (96, 80, 50) | **not on the matched patch** | The blade mix moved toward warm grey, but the stronger global saturation outweighs it: same patch as round 4, blue A 25 → 20, B 30 → 25, D 39 → 29; chroma 58–79 vs 42–44. |
| Rim crags and code root cones off the playable isles | **verified** | `dressing.ts` `rootsPerM 0`, `cragsPerIsle 0`; A's band and proposal B's lip are clean. |
| C back on the meadow | **height verified; the view is not meadow** | camAt (3.2, 31.7, −11). KNOLL (7.6, −11.5) base 4 ends 0.43 m from the camera; its flank fills C's lower centre-right. |

## Staging, cameras and the no-shortcut rules (ledger 5)

- **The Roc's staged spot is on its flight circle (verified).** `plugin.ts:235` places it at (DAIS.x − 3,
  DAIS.z − √(13² − 9)), exactly 13 m (`ROC.r`) from `ROC`'s centre (= DAIS), at `ROC.y`. `stormRoc.ts`: in phase 0 the
  circle state steers round that same radius and altitude and turns to `stalk` from wherever it is when `rest` runs out,
  and a stalk steers toward the player at `p.y + 10`, which equals `ROC.y` for a player on the crown deck. So the staged
  spot and heading are a state a real lap and stalk pass through; `stageStalk` sets only real flight state. The round-4
  should-fix is closed. The Roc is real 3D (frontal, wingspan 0.73), not a card.
- **Cameras:** only `mock-proposal-B` changed in `cameras.json` (onto the knoll, named); camAt matches the README for all
  five. The re-aim moved the view **away** from its mockup's composition (side-on to the bridge, no foreground; see
  finding 3), though not to dodge anything: it follows the knoll, which was moved to free C.
- **The knoll is real walkable ground** (`build.ts:126–128`, a `hull` collider, surface grass). **New, should-fix:** at
  (7.6, −11.5) with base 4 it reaches 17.8 m from Sunrest's centre, past the 12-gon rim (apothem 16.4, corners 17):
  up to 1.1 m overhang, about 9 % of its footprint, and its hull collider goes with it, so there is a walkable shelf over
  the drop with no deck or keel under it. It does not show in the five views; check it from the bridge and the aerial, and
  pull the knoll in until its foot stays inside `rimAlong`. Also the Sunrest pine at (10, −12) now stands 2.45 m from the
  knoll's centre at deck height, its foot ~0.9 m inside the rise (`build.ts:130` places pines at `isle.y`).
- **The fan is the idle hold a player sees:** `weapons/` is untouched since round 4 and no `fan-gust` stage is in
  `meta.json`; identical placement in all views. **No painted stand-in** for a reachable place (the knoll, keels and
  isles are meshes; the storm and the cloud sea are sky). **No narrowing:** the hero views carry the same light; the clip
  strip shows the archipelago intact; 0 page errors; phone tier, touch HUD; VITALS hidden at full health and LOCK with a
  target are the E319 baseline, not a breach.
- **C1 (process, should-fix): the highlight claim uses a measure that counts colour, not light.** "Above 230" in the
  README is the red channel; a saturated orange sky passes it. The manifest comment for the same change says the mockups
  have "3–6 % over 230"; on luminance they have 1.9–3.8 % and the game 0.2–0.8 %. Report luminance > 230 (or all three
  channels) from here on.

## Findings, ranked by score gained

1. **Put the sun on the mockups' side, low and small** (A, C, D, proposal B; x 0.05–0.4, y 0.35–0.5). Four of five
   mockups have the sun left of the view's subject; the game has it right in all four. Move the painted sun (and the
   light's azimuth with it, `manifest.ts` `sky.sun`, `panoramaData.ts` PANO_SUN) to the left of the mill from the spawn,
   as mockup A shows it, and clear what blocks it there (the house behind the mill, which no mockup shows, sits in that
   sky). This alone puts the backlight, the dark mill and pines against a burn, and D's low-left sun right. Shrink D's
   halo back toward a tight disc with a gold flood: the 3.2 core makes a white wash over a third of D's sky.
2. **Get real highlights, not more saturation** (all five; sky near the sun, cloud rims, grass tips, rims). The global
   saturation raised chroma everywhere, which helped A and C's sky but pushed the meadow (ch 58–79 vs 42–44, blue
   20–29 vs 39–46), D's sky and proposal B's sky (72 vs 37) further off. Bring saturation back down and raise brightness
   at the top end instead: brighter cloud rims and air near the sun (proposal B's left sky is 222,197,172), backlit grass
   tips toward the sun (D's p90 144 vs 174), so luminance > 230 approaches the mockups' 2–4 %. Re-check the meadow's blue
   after the saturation change; the blade tint alone will not hold it.
3. **Proposal B's camera and foreground** (x 0–1, y 0.4–0.86). The view must look down along the bridge from a grassy
   rise, the bridge entering at the bottom centre and the windmill isle small and far. From 7.6 m east of the axis that
   cannot happen. Put the rise on or right beside the bridge's axis, behind the landing, where no other mock camera
   stands (A, B and C's cameras are fixed; B's keeper stands left of the axis), tall enough that the bridge falls away
   below the eye, with the meadow, daisies and a rock over its lip in the lower left.
4. **C's foreground** (x 0–1, y 0.6–0.86). Pull the knoll's foot clear of C's lower frame (with finding 3's move this
   comes free) so the meadow slopes to the bridge with a rough rock, as the mockup shows; grow the meadow's blades over
   the knoll as densely as over the deck (its flank reads bald). Warm C's upper sky (ch 44 vs 61).
5. **The meadow's finish** (A, B, D; y 0.6–0.86): fill the flat paint between the tufts in D's mid-ground; rough
   lichen rocks where the mockups have them (A lower left, three; B lower left; D to the bottom edge).
6. **The view under the spawn bridge** (A; x 0.25–0.75, y 0.53–0.6): without its root strips the band is a plain grey
   wall; thin it under the bridge's line or carry the textured keel's roots and hanging moss up to the lip, so the deck
   crosses lit air as in the mockup.
7. **The crown** (D; y 0.25–0.7): bank the Roc and bring its talons forward (the mockup's pose), since it now fills
   0.73 of the width; carved, unlit runes instead of the cyan glow; the cloud sea and isles between the stones; a dais
   whose compass reads at this range.
8. **The fan's finish and B's set** (C, B): riveted metal guards with diamond end caps and a worn leaf edge; the carved
   lectern with an open book and a hung lantern; A's isle cluster out of B's sightline over the mill (named as not done).

SCORE sky-reach: 5.9
