# Round 6, seat C, Sky Reach only (red team: the demanding art director)

Surface: `art/mockup-council/round-6/README.md` (Sky Reach section), the five `far-reach-*.jpg` sheets, the full-res capture
`progress/far-reach/20261003-0201-fc54d9df/` (every `mock-*`, h1–h4, both aerials, `clip.mp4` at 1/4/7/9.5 s, `meta.json`
`camAt`), round 5's `progress/far-reach/20261003-0033-9dbf50f8/` cropped side by side with it (mockup | round 5 | round 6), the
five ledger mockups at full resolution, and the source diff `9dbf50f8..fc54d9df` over `src/shards/far-reach` and
`art/far-reach/progress/cameras.json`: `layout.ts` (`KNOLLS`, `STEP`, `GOATS`), `world/knoll.ts`, `world/build.ts`,
`world/meadow.ts`, `world/isle.ts`, `world/dressing.ts`, `world/skyIsleHd.ts`, `look/render.ts`, `look/sunGlow.ts`,
`look/panoramaData.ts`, `manifest.ts`. Every image is decoded and resized to 780×1688, with no grading. Brightness is Rec. 709
luminance. Regions are fractions of the game frame (x left→right, y top→bottom, HUD included).

Round 6 did the two things the seats asked for most: the sun is now on the left in A, D and proposal B, and the top end of the
tone range finally reaches the mockups' (NEUTRAL tone map). At a glance the spawn views are warmer and brighter. The look
that a second glance finds is worse in new places. The sun is drawn as a **hollow pink ring** next to a soft white blob, not a
burning disc. Both new rises are **bald**, and a new camera-distance darkening turns the ground near the eye into a dark, smooth
stain, so D, C and proposal B now have the crudest surface in the frame right at the bottom of the frame. The sward is a
denser carpet, but it is softer than round 5's (fine detail down in every view) and still acid yellow. Moving the high step 36 m
west took the stack out from behind the mill in A and put it, with its house, over the keeper's head in B.

## Measured (mockup / round 5 / round 6)

Play region x 0–0.62, y 0.08–0.85; sky patch x 0.18–0.82, y 0.17–0.33; ground patch x 0.03–0.38, y 0.68–0.82. "hp" is fine
detail: the standard deviation of luminance minus a 3 px blur of itself.

| View | Play L p99; % > 230 | Sky patch RGB, chroma | Ground patch RGB, chroma; hp | Sun (brightest blurred point x, y) |
|---|---|---|---|---|
| A | 242 / 221 / **241**; 3.5 / 0.1 / **3.6 %** | 197,154,124 c73 / 185,156,133 c52 / 186,151,130 c58 | 80,67,39 c42; 20.9 / 100,84,20 c79; 18.5 / 89,73,18 c70; **14.2** | 0.34,0.35 / 0.71,0.36 / **0.28,0.38** |
| B | 218 / 220 / 240; 0.3 / 0.1 / **3.2 %** | 199,166,152 c48 / 184,155,135 c50 / 188,154,135 c56 | 88,74,46 c42; 22.3 / 84,72,25 c58; 20.8 / **103,84,21 c82; 13.2** | 1.00,0.42 / 0.83,0.38 / 0.39,0.39 |
| C | 239 / 223 / 241; 3.0 / 0.1 / 3.3 % | 202,163,141 c62 / 181,161,162 c34 / **170,150,154 c37** | 97,79,42 c54; 23.9 / 101,74,38 c63; 13.8 / 105,80,30 c75; 18.3 | 0.05,0.34 / 1.00,0.44 / 0.42,0.46 |
| D | 246 / 219 / 244; 4.5 / 0.1 / **7.0 %** | 133,103,98 c42 / 147,113,112 c51 / 114,83,83 c46 | 86,71,42 c44; 22.8 / 101,84,29 c71; 20.2 / 74,61,22 c52; **14.7** | 0.23,0.46 / 0.69,0.43 / **0.26,0.47** |
| proposal B | 240 / 223 / 244; 6.1 / 0.1 / 5.1 % | 206,191,182 **c26** / 178,144,106 c72 / **207,167,125 c81** | 73,66,37 c37; 16.9 / (sky) / 78,65,18 c59; **10.2** | 0.24,0.40 / 0.94,0.24 / 0.32,0.32 |

- **Where the highlights sit.** Of the play region's pixels over 230, the share within 0.15 frame-widths of the sun:
  mockups 57 / 0 / 60 / 62 / 46 %, game 73 / 76 / 66 / 68 / 71 %. The percentage now matches, but it is mostly one soft bloom.
  The mockups spend a third to a half of their highlights on cloud rims, sails, post caps, grass tips and the fan's edge; the
  game spends a quarter.
- **The sun's disc** (3× crops at the bright point in all five views): a thin pinkish ring, darker than the glow inside and
  outside it, with no hot core. In D the ring sits at (0.30, 0.45) and the hottest blob at (0.26, 0.47): two separate bright
  shapes.
- **Ground medians** (same patch), mockup / game: A 70,60,31 / 84,70,19; B 76,65,39 / 105,86,22; C 85,71,35 / 109,84,24;
  D 71,61,34 / 65,53,18; proposal B 62,58,30 / 78,66,20. Blue is still at half to two-thirds of the mockups'.
- **D's floor by distance** (x 0–0.45, luminance p50): y 0.63–0.66 (about 12–20 m out) 128; y 0.70–0.74 (the rise's slope) 48;
  y 0.76–0.83 61. The mockup's floor brightens toward the camera; the game's goes dark at the camera.

## Scores

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-11-review/mockup-A-spawn-look` → `mock-A-spawn-look` | 7.0 | 1. **The sun and backlight (x 0.15–0.6, y 0.3–0.5).** The sun is on the mill's left now, where the mockup has it (0.28 vs 0.34), and the sky round it glows. But it is a hollow pink ring in a soft yellow wash, not the mockup's white disc burning under the isle cluster. The pines and the mill's stone are still lit from the front, with no dark backlit silhouettes. Cyan hairlines (the updraft ramp's edges) now cross the left edge into the sun (x 0–0.3, y 0.37–0.48); the mockup has nothing there. 2. **The meadow (x 0–0.65, y 0.64–0.86).** It is no longer a lit plane with sticks, but it is a uniform, soft olive-yellow carpet (hp 14.2 vs 20.9; round 5 18.5), with yellow buttons and white puffs on long bare stems standing above it. The mockup has crisp backlit blades, dark gaps, white daisies sitting in the grass and three lichen boulders at the lower left. The lantern on the left post is still there. 3. **The isles and the mill (x 0–1, y 0.2–0.6).** The same five separate, sharp grey-taupe spinning tops with thin white waterfall lines, where the mockup has one merged, hazed cluster with hanging roots. The mill's sails are open lattices with dark panes, not canvas. The rocky spur and blue waterfall stair behind-left of the mockup's mill are gone along with the step. |
| `round-18-council-mockups/mockup-B-quest-start-painterly` → `mock-B-quest-start` | 6.0 | 1. **The meadow (x 0–1, y 0.55–0.86).** Tall acid yellow-olive grass over the whole lower half (ground 103,84,21, chroma 82 vs 42; the most saturated of any round), soft at the near edge (hp 13.2 vs 22.3). The mockup has a green-gold sward with white daisies and grey rocks at the lower left, and a rock ridge behind the keeper. 2. **The sky and what hangs in it (x 0–1, y 0.15–0.55).** The step moved, and it now sits over the keeper's head: its isle and timber house at x 0–0.22, y 0.3–0.4, with the cyan updraft pane at x 0.1–0.2, y 0.39–0.42. Four more isles crowd the mill, where the mockup has open cumulus. The sun moved to x 0.39, behind the keeper's line; the mockup's is at the right edge. The 3.2 % of pixels over 230 is ten times the mockup's 0.3 %. 3. **The keeper's set (x 0.15–0.45, y 0.45–0.6).** The wave now lifts a hand, which is better, but the stand is still a thin post with a sliver of board and the lantern on the ground. The mockup has a carved lectern with an open book and a hung lantern on a crate base. |
| `round-18-council-mockups/mockup-C-hands-fan-painterly` → `mock-C-hands-fan` | 5.5 | 1. **The foreground (x 0–1, y 0.74–0.86).** A smooth, faceted, dark-olive slab with a few long straw blades sticking out of it: bare ground darkened by the new near-camera multiply. It is the nearest and crudest surface on screen. The mockup's lower third is a lit, flowered verge with a rough rock at the lower left. 2. **Sky and light (x 0–1, y 0.05–0.6).** The upper sky got cooler and darker (170,150,154 c37 vs 202,163,141 c62; round 5 c34): lavender with thin streaks, where the mockup has big warm cumulus banks. The sun is a ring behind the mill (x 0.42); the mockup's light floods in from the left edge (x 0.05). Four isles still ring the mill (the mockup shows two, small and at the edges); the updraft's cyan line crosses behind the post (x 0.1–0.3, y 0.46–0.55); the ray is a dark shape clipped at the right edge (x 0.93–1, y 0.45). 3. **The fan, the subject (x 0.5–1, y 0.56–0.8).** Unchanged for the fourth round: about half the mockup's area, with flat brown sticks and guards, no iron plates, rivets, engraved caps or edge glint, and a clean leaf. The re-aim did what it set out to do: the post is now at the left (x 0.09–0.26) and the deck recedes behind it, as in the mockup. The stone span stays excluded (round 4 ruling). |
| `round-11-review/mockup-D-crown-arena` → `mock-D-crown-arena` (staged `roc-stalk`) | 6.0 | 1. **The foreground (x 0–1, y 0.66–0.86).** The camera stands on the new rise, and the rise is bald. Its slope is a dark, smooth, faceted surface (L p50 48), with pale flat stains at its foot (x 0–0.3, y 0.62–0.66) and flower heads on bare stalks. The crown's grass was cut to 0.42 height, so beyond the rise it is a short stubble. The mockup's foreground is lush backlit grass with rocks and daisies all the way to the bottom edge. 2. **The sun and the storm (x 0–1, y 0.2–0.6).** The sun is low-left now (0.26 vs 0.23), which is right, but it is a white blob about a fifth of the frame wide, with a hollow ring beside it, and it washes out the space between the stones into flat yellow (7.0 % over 230 vs 4.5 %). The mockup's is a small sharp disc with gold clouds, isles and pines round it. The right half below the eye is a dark navy mass where the mockup's clouds are lit gold. 3. **The Roc and the stones (x 0–1, y 0.23–0.65).** The Roc has the same symmetric frontal glide, with drooping wings and its feet tucked; the mockup's banks with talons forward and layered slate-and-white feathers. The stones are near-black silhouettes with glowing cyan spirals; the mockup's are lit, lichened grey stone with cut runes. The gain: the dais is now near and broad, and its compass star reads (x 0.12–0.6, y 0.63–0.71). |
| `round-1-proposals/B-sky-reach` → `mock-proposal-B` | 5.5 | 1. **The composition (whole frame).** The bridge now runs up the centre, which fixes round 5's side-on view. But the camera stands 19 m behind the bridge head, so this is mockup A taken from further back: a flat meadow, the posts and keeper small at y 0.45–0.55, and the deck seen only as a short strip. The mockup's camera is on the crest itself, and the long bridge falls away from under the fan, across open air, to a small far isle. No void, no sag and no cloud sea show under the game's bridge. The windmill isle still spans x 0.13–0.86, against the mockup's x 0.2–0.65. 2. **The sky (y 0.05–0.5).** It moved further away again: saturated orange (207,167,125, chroma **81**; 14 % of the sky patch over 230), against the mockup's pale, nearly colourless air (206,191,182, chroma 26). The isles crowd the top third; the mockup's are few, small, and spread over many depths. There is no manta or trail beside the mill. 3. **The foreground (x 0–1, y 0.55–0.86).** The rise under the camera is invisible as a rise. What shows is a flat, dark, soft olive field (hp 10.2 vs 16.9; ground 78,65,18) with dark lumps at the left. The mockup's is a lit grass crest with daisies and a rock falling to the bridge. |

**Seat score, Sky Reach: (7.0 + 6.0 + 5.5 + 6.0 + 5.5) / 5 = 6.0** (round 5, this seat: 5.9).

## The builder's claims, checked

| Claim | Verdict | Evidence |
|---|---|---|
| NEUTRAL tone map; top 1 % at 238–243 vs 236–241; 2.5–5.0 % over 230 vs 1.9–3.8 % | **verified in number; misleading in kind** | `render.ts` sets `c.fx.tone.mode = NEUTRAL`; the grade's saturation is 0 and contrast 0.12 (`manifest.ts`). Play-region p99 is 240–244 (mockups 218–246), and 3.2–7.0 % is over 230. But 66–76 % of those pixels are in the soft sun bloom (mockups 46–62 %). B overshoots tenfold (3.2 vs 0.3 %), and so does D (7.0 vs 4.5). The rims, sails and grass tips are still not white-gold. |
| Meadow median in A (75,62,20) vs (75,65,24) | **R and G close; the mockup's blue is wrong** | On the round-5 seats' patch the mockup's median is 70,60,31 (mean 80,67,39) and the game's 84,70,19. Every view's ground blue is half to two-thirds of the mockup's, and B's chroma is 82 against 42. Fine detail fell in A, B, D and proposal B (hp 13–15 vs the mockups' 21–23; round 5 18–21). |
| The painted sun 15° left and 6° up, under the mill's hub on its left | **position verified; its look is broken** | `PANO_SUN` heading 352.25°, elevation 6.07°; `SUN_DIR` follows it. In A, D and proposal B it sits on the mockups' side. In every view it renders as a hollow ring, and in D the ring and the hot blob are two shapes about 0.04 of the frame apart. `manifest.ts` still says `sun.elevation 4.3` "is the painted sun's"; that is stale now (6.07). |
| Sky isles off the sun's line, with aerial haze | **verified in source, small on screen** | `skyIsleHd.ts` mixes toward the fog colour, at most 0.35 by 260 m; `l2` and `b4` moved. A's isles still read crisp and grey-taupe, not hazed mauve. |
| The step 36 m west, "just past the left edge of the spawn's portrait view" | **false for B, marginal for A** | The portrait frame is about 37° wide (72° vertical, 390/844). From B's camera (−0.3, −4.8), turned 4° left, the step (−44, −126, r 13) spans about 14–26° left of the axis, and the frame's edge is at 22.5°, so about two-thirds of it, house included, is in B (x 0–0.22, y 0.3–0.4). From A it spans about 15–27°, inside the frame's 18.5° edge by about 4° (x 0–0.08). |

## No-shortcut audit (ledger 5)

| # | Severity | What | Evidence | Fix |
|---|---|---|---|---|
| X1 | should-fix (repeat of round 5's X1, now three times the area) | **Both rises are bald, though `knoll.ts` says "the meadow's blades grow over it".** | aerial-spawn: Sunrest's rise (base 7, 2.4 m, at (0, 3)) is a smooth dark dome about 14 m across in the middle of the spawn isle. Flower dots grow on it, but no tuft cards do; round 5's aerial has no dome. The clip at 1 s shows the same. D's rise: dark, faceted, unsodded, with flower stalks. `meadow.ts` adds `farKnoll(p)` to the blade's y, but on screen only the flower branch survives. | Find why the tuft cards are dropped or buried on a knoll (the flower path and the card path diverge; check the card's `-0.04` sink and its cull against the raised y), grow the full sward over both rises, and drop `flatShading` on the cap. Re-check from aerial-spawn, D and proposal B. |
| X2 | should-fix | **The near ground is darkened by its distance to the camera**, a pool that follows the player. | `isle.ts`: `diffuseColor.rgb *= mix(0.55, 1.0, smoothstep(10.0, 26.0, length(farWP - cameraPosition)))`. D's floor: L p50 128 at 12–20 m out, 48 on the slope under the eye. C's lower frame is the same dark slab. It is global, so it is not a mock-only look, but it stands in for sward density and leaves bare ground reading as stain, and in play it moves with you. | Remove the camera-relative multiply. Get the shade between tufts from the sward itself (a thatch layer, darker roots), as the comment beside it intends. |
| X3 | should-fix (not a void) | **The crown's grass was cut for the camera on the new rise.** | `meadow.ts` `grass.crown` 0.72 → 0.42; the comment says "from the arena's rise the sward's tufts hid the dais". It is a global change, but it was made to clear one camera's sightline, and it goes against mockup D, whose meadow is lush right up to a raised dais. | Restore the height, and let the dais read by its own rim and height (the mockup's dais stands proud of the grass), not by mowing the arena. |
| X4 | note | **The rises are real places.** | `build.ts` registers each one as a `ctx.piece` with a convex `hull` collider, surface grass. Sunrest's spans z −4 to 10, inside the 16.4 m apothem, 1.5 m behind the spawn (z −5.5), and clear of B's camera (7.8 m from its centre). The crown's lies inside the arena; the walk from the moved crown-bridge landing (about −11, −173.5) to the dais passes about 8 m from its centre, outside its 7 m base. Both are walkable (38° at the foot, under the 40° climb). Not a breach. Sunrest's rise does nothing for proposal B's frame, though (finding 6). | — |
| X5 | note | **The step's move changes play for every player.** | `STEP` (−8, −122) → (−44, −126). Edge to edge, the updraft span grows from about 30 m to about 47 m, and the fallen crown bridge from about 36 m to about 45 m. Hero h3 was re-aimed 32.5° to follow it, which is named. The move was made for the spawn views' sky, but it is real layout, and the clip shows the archipelago intact. Its cyan updraft edges now cross A, B, C and proposal B. | Confirm that the longer updraft and bridge still play (the board's climb, and the bridge as a quest target); see finding 4 for the frames. |
| X6 | ok | **`roc-stalk`, settle 0.15 s; `h4` inside the arena; the goat moved** | The stage code is unchanged (on its 13 m circle, `calm: false`). 0.15 s is a real frame of real flight, with the wings in their normal glide and lightning live; nothing is frozen. h4's toast and intro play as for a player walking in. The goat moved 16 m inside the windmill isle; no mockup shows goats. VITALS hidden at full health and LOCK with a target are the E319 baseline. 0 page errors. | — |

## Findings, ranked by score gained

1. **Make the sun a sun** (A, B, C, D, proposal B; around x 0.25–0.45, y 0.3–0.5). The disc renders as a hollow pink ring in a
   soft wash, and in D the ring and the hot blob are two shapes. Draw a solid disc clearly hotter than its glow (in the
   `sunGlow.ts` bloom shader, the disc term must win over the halo inside the 0.1 radius after the NEUTRAL map; check what draws
   the darker ring edge, the panorama's painted disc or the smoothstep band). Register it on the panorama's painted sun. Then
   tighten D's halo, since its bloom alone is about 5 % of the frame. Move highlight budget from the bloom to sun-facing rims:
   cloud edges, sails, post caps and the fan's edge. Today 66–76 % of the pixels over 230 sit within 0.15 frame-widths of the
   sun (mockups 46–62 %). Keep the left-hand sun position.
2. **Sod the rises and take out the near-ground darkening** (D y 0.62–0.86, C y 0.74–0.86, proposal B y 0.55–0.86, aerial-spawn;
   X1, X2, X3). These three surfaces are now the crudest on screen, and they sit where the eye lands first. Fix the tuft cards
   on the knolls. Delete the camera-distance multiply in `isle.ts`. Restore the crown's grass height and put rocks and daisies
   in D's foreground where the mockup has them.
3. **The sward's finish and colour** (A, B, D; y 0.6–0.86). The atlas carpet closed the gaps but made the field soft: fine
   detail is down to 13–15 against 21–23, and round 5 was 18–21. Raise the atlas's resolution or strand contrast so single blades
   and their backlit edges read at phone size. Pull the yellow toward the mockups' green-gold: blue median 18–24 against 30–39,
   and chroma 70–82 against 42. Set the flowers into the grass (short stems, daisies at grass height) instead of yellow buttons
   on bare stalks above it. Add the mockups' lichen rocks (A lower left, three; B lower left; D down to the bottom edge).
4. **Get the step and its ramp out of the spawn views for real** (B x 0–0.22, y 0.3–0.42; A, C and proposal B left edge). From B
   the moved step, with its house, hangs over the keeper. Either move it further west (past about 30° left of the spawn axis),
   or accept it and drop the claim. Make the updraft ramp's cyan hairline edges read as a faint wind ribbon rather than a
   laser line across the sun. No per-view hiding.
5. **The skies of C and proposal B** (C y 0.05–0.5; proposal B y 0.05–0.5). C went cooler (chroma 37 against 62). Proposal B went
   hotter and more saturated (chroma 81 against 26; 14 % of its sky over 230 against 3.9 %). One sky has to serve both, so warm
   the high sky toward the sun's side, desaturate the band near the horizon toward pale gold, and thin the isles that crowd
   B's and C's mill (mockups B and C show open cumulus there).
6. **Proposal B's crest** (whole frame). A rise 19 m behind the bridge head cannot give the mockup's look down a bridge that
   falls away from your feet. The mockup's crest is the bridge head. Raise Sunrest's ground at the landing itself (the bridge
   leaving from a grassy crest, the posts on it), so a camera just behind the posts on the axis looks down the sagging deck
   over open air to the isle. Then the far isle can read small. Re-aim only toward that camera, and name it.
7. **The fan's finish** (C x 0.5–1, y 0.56–0.8; every view). Unchanged for four rounds: iron guard plates with rivets and
   engraved end caps, an edge that catches the rim light, lacquered ribs, a creased and worn leaf, and a longer tassel. In C the
   mockup's fan is about twice the game's area.
8. **The crown's forms** (D y 0.23–0.65). Bank the Roc with its talons forward and slate-and-white layered plumage. Light the
   stones as weathered grey rock with cut, unlit runes instead of black slabs with cyan glow. Open the space between them onto
   the gold cloud sea, isles and pines. Lift the dark navy mass under the eye on the right toward the mockup's lit cloud.
9. **B's set** (x 0.15–0.45, y 0.45–0.6). A carved lectern with an open book and a hung lantern, on a crate base, as the mockup
   shows.

SCORE sky-reach: 6.0
