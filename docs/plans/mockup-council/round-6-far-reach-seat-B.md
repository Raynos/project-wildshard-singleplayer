# Round 6, seat B, Sky Reach (Claude, lens: evidence, region by region)

Surface: `art/mockup-council/round-6/README.md` (the Sky Reach section), the five sheets
`art/mockup-council/round-6/far-reach-*.jpg`, the full-res frames in `progress/far-reach/20261003-0201-fc54d9df/`
(780×1688: every `mock-*`, first-frame, h1–h4, both aerials, `clip.mp4` as a 0.4 fps strip, `meta.json` `camAt`),
round 5's `progress/far-reach/20261003-0033-9dbf50f8/` for before and after, and the five ledger mockups at full
resolution.

Method:
- Each mockup is scaled to 780×1688. The same region is cut from the mockup, round 6 and round 5 and set side by side:
  the sky and the sun, the subject band, the foreground and viewmodel, and zooms of the sun disc in A, D and the aerial.
- On each patch I measured mean RGB, the median, Rec. 709 luminance p10 / p50 / p90 / p99, mean chroma (max−min) and
  the share above 230 (luminance). The brightest blurred blob of y 0.08–0.62 locates the sun.
- Source checked at the captured commit `fc54d9df` against `9dbf50f8`: `layout.ts` (KNOLLS, STEP), `world/knoll.ts`,
  `world/build.ts`, `world/meadow.ts`, `world/isle.ts`, `world/dressing.ts`, `world/skyIsles.ts`, `look/render.ts`,
  `look/sunGlow.ts`, `look/sun.ts`, `look/panoramaData.ts`, `manifest.ts`, `plugin.ts`, and
  `art/far-reach/progress/cameras.json`.
- Regions are fractions of the game frame (x left→right, y top→bottom, HUD included).
- Marks per dimension: composition and subject (Comp), forms and silhouettes (Form), materials and detail (Mat), light
  and colour (Light), density and depth (Depth), hands / weapon / HUD (Hands).

## Measured (mockup / round 6 / round 5)

| Patch | Mockup | Round 6 | Round 5 | Reading |
|---|---|---|---|---|
| Play area y 0.05–0.85, luminance > 230 (A / B / C / D / proposal B) | 2.2 / 2.4 / 1.9 / 2.9 / 3.8 % | 2.8 / 2.4 / 2.6 / 4.6 / 3.8 % | 0.5 / 0.4 / 0.2 / 0.8 / 0.5 % | **the highlight gap is closed** |
| Play area, luminance p99 (same order) | 239 / 241 / 236 / 242 / 238 | 239 / 238 / 239 / 243 / 241 | 224 / 223 / 223 / 228 / 225 | matches |
| Play area, luminance p50 (same order) | 121 / 135 / 120 / 95 / 142 | 98 / 105 / 111 / 70 / 83 | 105 / 111 / 130 / 98 / 141 | **the mid-tones fell 9–59 under the mockups'** |
| Subject band y 0.45–0.65, mean; L p50 (A / B / D / proposal B) | 128,99,77 87 / 128,105,81 92 / 173,141,111 159 / 137,121,114 122 | 84,64,38 56 / 102,83,45 71 / 167,140,94 156 / 82,68,40 57 | — | A, B and proposal B's middle is a dark band |
| D subject band y 0.45–0.65, > 230 | 5.2 % | **15.1 %** | — | D's highlights are piled into the sun's halo |
| A under the bridge x 0.25–0.75, y 0.53–0.6 | 147,99,74, L p50 108 | 91,66,42, p50 63 | 120,88,55, p50 87 | **moved away**: darker than round 5 |
| Ground x 0.03–0.38, y 0.68–0.82: mean; chroma (A / B / C / D / proposal B) | 80,67,39 c42 / 88,74,46 c42 / 97,79,42 c54 / 86,71,42 c44 / 73,66,37 c37 | 89,73,18 c70 / 103,84,21 c82 / 105,80,30 c75 / 74,61,22 c52 / 78,65,18 c59 | 100,84,20 c79 / 84,72,25 c58 / 101,74,38 c63 / 101,84,29 c71 / (sky) | blue still 18–30 against 37–46; luminance close |
| A meadow x 0–0.6, y 0.66–0.84: median; L p90 | 77,64,29; 121 | 76,62,18; 93 | — | the level matches; the lit tips are missing (p90 −28) |
| Upper sky y 0.05–0.25, mean; chroma (A / C / D) | 176,148,139 c46 / 183,157,142 c46 / 93,84,92 c22 | 154,135,137 c38 / 120,113,135 c32 / 64,50,63 c23 | — | C's upper sky is still cool lavender; D's storm is much darker (p50 42 vs 80) |
| Proposal B sky y 0.05–0.25 / 0.25–0.45, chroma | 19 / 55 | 58 / 80 | — | still saturated orange where the mockup is pale and nearly grey |
| A sky-isle rock, darkest quartile | 142,96,72 | 126,99,77 | 102,76,48 | **the haze works**: much closer |
| Sun: brightest blob (x, y) A / B / C / D / proposal B | (0.35,0.35) / (1.00,0.41) / (0.04,0.34) / (0.25,0.46) / (0.28,0.37) | (0.25,0.38) / (0.38,0.39) / (0.41,0.45) / (0.26,0.47) / (0.29,0.31) | (0.71,0.37) / (0.84,0.37) / (1.00,0.44) / (0.70,0.43) / (0.97,0.23) | **left in A, C, D and proposal B**, as their mockups have it. B loses: its mockup's sun is at the right edge |
| C foreground x 0.05–0.65, y 0.77–0.85 | 89,73,40, L p50 66 / p90 126 | 73,61,21, p50 54 / p90 105 | 81,69,21, p50 67 | darker and still bald |

## Scores

| Mockup | Score | Comp / Form / Mat / Light / Depth / Hands | The three biggest differences (region) |
|---|---|---|---|
| `round-11-review/mockup-A-spawn-look` (mock-A-spawn-look) | **7.0** | 8 / 7 / 6 / 7 / 6 / 7 | 1. **The sun (x 0.2–0.4, y 0.33–0.42).** It is on the mockup's side now (x 0.29 vs 0.35, left of the hub), and the house behind the mill is gone. But there is no hot disc: a pale disc with a thin pinkish ring outline sits in a soft cloud glow (zoomed), offset ~0.04 from the glow's centre. The mockup has a white-hot disc with a gold flood behind a backlit, dark mill. 2. **The subject band (x 0–1, y 0.47–0.65).** It is now darker than round 5: mean 81,62,36, L p50 55 against the mockup's 124,96,74, p50 84. Under the bridge (x 0.25–0.75, y 0.53–0.6) the windmill isle's keel is a dark rock wall with a sage shelf (p50 63, round 5 87), where the mockup has warm lit air and the far isle's lit rock (p50 108). The hand ropes are low orange swoops. 3. **The meadow (y 0.64–0.86).** It is a continuous sward now, the clearest gain of the round: the "dark sticks on flat paint" are gone. But it is a yellower carpet (blue 18 vs 29), with no lit gold tips (p90 93 vs 121), yellow dandelions on tall stalks where the mockup has white daisies, no lichen boulders at the lower left (the mockup has three), and the lantern at the left post. The fan and glove match the grip; the fan's finish is unchanged. |
| `round-18-council-mockups/mockup-B-quest-start-painterly` (mock-B-quest-start) | **6.0** | 6 / 6 / 6 / 6 / 6 / 7 | 1. **The sky over the mill (x 0–1, y 0.15–0.45).** The isle cluster still hangs over the keeper and the mill where the mockup has open gold cumulus. The high step's winch house now shows at the left edge (x 0–0.1, y 0.33–0.38): STEP moved 36 m west, into B's frame. The global sun moved to x 0.38, beside the keeper's raised hand, with its ring; the mockup's sun and warm side light come from the right edge. 2. **The keeper and his stand (x 0.05–0.42, y 0.43–0.62).** Same as round 5: the rim and cloud sea behind him where the mockup has a grassy rock ridge; a red-brown board on a post with a lantern at its foot, not the carved lectern with an open book and a hung lantern. 3. **The mill and the meadow (x 0.4–1, y 0.3–0.86).** A large white stone tower mill against the mockup's small dark timber post-mill on a spur. The near sward is now a dense gold carpet (a gain), but more saturated (ground chroma 82 vs 42, blue 21 vs 46), with no rocks at the lower left. |
| `round-18-council-mockups/mockup-C-hands-fan-painterly` (mock-C-hands-fan) | **5.5** | 6 / 5 / 5 / 5 / 5 / 7 | 1. **The foreground (x 0–1, y 0.75–0.86).** The old knoll is gone (moved to (0, 3), behind the camera; checked in `layout.ts`). The dark smooth curve that fills the lower frame now is Sunrest's own deck near the rim: bald ground (blades thinned at the rim and cleared on the bridge-head path), darkened by the new near-camera ×0.55 in `isle.ts` (p50 54 vs 66, blue 21 vs 40). Tall pale blades stand at the left. The mockup's lower half is a lit verge with flowers and a rough rock at the lower left. 2. **The sky (y 0.05–0.45).** The upper sky is still cool lavender (y 0.05–0.25: 120,113,135, chroma 32, p50 115, against 183,157,142, chroma 46, p50 169). Five isles stand where the mockup has one. The sun is on the left now (x 0.41), but not at the edge (0.04), and it is a ring. 3. **The composition and the fan (x 0–1, y 0.5–0.8).** The yaw change worked: the near post is at the left edge (x 0.09–0.26; round 5 0.28–0.45; the mockup 0.06–0.2), the deck recedes beside it and the mill is near the middle. The fan is unchanged: flat brown sticks, no riveted guards or diamond caps, about two-thirds of the mockup's leaf. The mill is white stone where the mockup's is dark timber. |
| `round-11-review/mockup-D-crown-arena` (mock-D-crown-arena, staged `roc-stalk`) | **6.5** | 7 / 6 / 5 / 6 / 5 / 6 | 1. **The sun and the sky (x 0–1, y 0.05–0.55).** The sun is low left now (blob x 0.26, the mockup's 0.25). But there are two sun features: a large soft glow centred at about (0.24, 0.48), and a thin ringed disc up and to the right of it at (0.30, 0.45). 15.1 % of y 0.45–0.65 is above 230 (the mockup 5.2 %), a halo that washes the storm's foot. The storm above is far darker than the mockup's (y 0.05–0.25 p50 42 vs 80; y 0.25–0.45 p90 181 vs 222). The Roc is unchanged in size (span ~0.72 vs ~0.96), is now higher with its head right under the bar, and is still a symmetric frontal glide with no bank or forward talons. 2. **The arena (y 0.5–0.72).** The new rise brings the dais near and broad, with its compass legible: the biggest composition gain. The stones are still smooth slabs with pale cyan spirals where the mockup's are rough, lichened and carved. Between them is warm haze, not the mockup's cloud sea, isles and pines. 3. **The meadow (y 0.65–0.86).** Dark and sparse: L p50 49 vs 62, blue 22 vs 42. The crown's sward was cut from 0.72 to 0.42 (`meadow.ts`, so the tufts no longer hide the dais from the rise), so it shows rows of tufts over dark paint, with a cluster of white and yellow flowers at the lower left. There are no rocks, where the mockup has five down to the bottom edge. The fan covers the lower right quarter. |
| `round-1-proposals/B-sky-reach` (mock-proposal-B) | **5.5** | 5 / 5 / 5 / 5 / 5 / 6 | 1. **The bridge and the drop (x 0.3–0.7, y 0.4–0.65).** The camera is on the bridge's axis now (a gain over round 5's side-on view), but it stands on the rise 8.5 m behind the spawn, ~19 m from the rim, with the eye ~4 m above the deck. The flat deck fills the frame up to the rim at y 0.52. The bridge shows only as a short sliver beyond it (x 0.42–0.6, y 0.43–0.52), half behind the posts and the keeper. In the mockup the hill's lip cuts the ground off at y 0.63, the bridge falls away from the bottom centre over open air, and the cloud sea shows on both sides. 2. **The windmill isle and its sky (x 0–1, y 0.15–0.55).** The isle still fills ~0.7 of the width (the mockup's spur ~0.45) and sits under four overhead isles where the mockup has open pale sky. The sky is saturated orange (chroma 58 / 80 against 19 / 55), and there is no manta. The sun is in the right place (x 0.29 vs 0.28) but is a ring. 3. **The foreground (x 0–1, y 0.55–0.86).** There is ground at last, a dark olive sward (y 0.65–0.85 p50 52, p90 80 vs 66 / 124; blue 20 vs 53). But it is flat meadow with the keeper, his stand and a "KEEPER 17 M" tag in it. The mockup shows a lit grass ridge with daisies and a rock at the lower left, falling to the bridge. |

**Seat score, Sky Reach: (7.0 + 6.0 + 5.5 + 6.5 + 5.5) / 5 = 6.1** (round 5, this seat: 5.9).

## The builder's claims, checked against the frames and the code

| Claim | Verdict | Evidence |
|---|---|---|
| Top 1 % at 238–243 against the mockups' 236–241 | **verified** | Play-area p99: game 238–243, mockups 236–242. |
| 2.5–5.0 % of the frame above 230 against 1.9–3.8 % | **verified, but misplaced** | Game 2.4–4.6 %, mockups 1.9–3.8 %. The share sits in the sun's halo and the sky (D y 0.45–0.65: 15.1 % vs 5.2 %; A y 0.25–0.45: 10.2 % vs 6.5 %), while the subject band and the meadow lost value (p50 −9 to −59; meadow p90 93 vs 121). The totals match; the picture doesn't. |
| NEUTRAL tone mapper; grade saturation 0, contrast 0.12, bloom 0.35 | **verified; global** | `look/render.ts` (`ToneMappingMode.NEUTRAL`), `manifest.ts` grade. Hero views moved the same way: h1 > 230 0.5 → 2.9 %, h4 0.8 → 4.1 %, the aerials 5.4 / 7.9 %. h2, which looks away from the sun, stays at 0.4 %. |
| The meadow median in A (75, 62, 20) against (75, 65, 24) | **half** | The game side holds (76, 62, 18 on x 0–0.6, y 0.66–0.84). The mockup's blue is 29–31 on that patch, not 24. The ground is still bluer and less saturated in every mockup (chroma 37–54 vs the game's 52–82), and its lit tips are missing. |
| The painted sun 15° left and 6° up, under the mill's hub on its left | **position verified; the 15° is wrong** | `PANO_SUN` heading 352.25 is 7.75° left, at 6.07° up. In A the sun is at x 0.29, y 0.38 (the mockup's 0.35, 0.35): left of the hub. But it draws as a ringed pale disc, and a second, offset glow appears in D, h4 and the overview aerial (finding 1). |
| The sky isles off the sun's line, with aerial haze | **verified** | `skyIsles.ts`: l2 and b4 moved west. The darkest quartile of A's isle rock is 126,99,77 (mockup 142,96,72; round 5 102,76,48). |
| Unlisted: the near ground darkened | **not in the README's claims** | `isle.ts` multiplies the island paint by `mix(0.55, 1.0, smoothstep(10, 26, distance to camera))`. It is global and real play, but it is a camera-centred dark ring. It is part of why A's, C's and proposal B's foregrounds lost their top end. Name it in the next README. |
| Known open: sky isles' look and count, the fan's metal, proposal B's small bridge, D's Roc pose | **confirmed open** | See the table. |

## Staging, cameras and the no-shortcut rules (ledger 5)

- **The camera list is right.** cameras.json changed for C (yaw 12 → 5), D (on the crown rise, pitch 2, settle 150 ms)
  and proposal B (on the Sunrest rise). camAt matches the README's moves (D 4.18 m, proposal B 16.40 m). Each is named
  in the round-6 notes.
  - The C and proposal B re-aims move toward their mockups: C's post is now at the left edge, and proposal B is on the
    bridge's axis.
  - D's eye rose 2.3 m, toward the mockup's look down into the arena.
- **The rises are real ground.** Each is a walkable `hull` collider with surface grass (`build.ts`, one piece per
  `KNOLLS` row), and the meadow and stones follow `knollHeight`.
  - Sunrest's rise (0, 3), 7 m base, 2.4 m high, stands 8.5 m behind the spawn on the spawn isle, so a player turning
    round reaches it in seconds.
  - The crown's rise (0, −177.5) is on the arena's south side, beside the walk from the bridge landing (about
    (−11, −174)) to the dais. Its edge stays 0.25 m inside the crown's 12-gon rim (computed with `rimAlong`). The
    round-5 overhang of the old knoll is gone with it.
  - Neither is painted, and both show in the aerials and the orbit clip. **Not a breach.**
  - **Should-fix (layout honesty):** both exist for one camera each, and Sunrest's reads from the aerial-spawn view as
    a perfect smooth, flat-shaded spherical cap. Beyond the sward's 7.5 m near ring its cap shows few blades, unlike
    the meadow round it. It reads as placed, not as land. Rough its silhouette (a rock shoulder), carry the sward's far
    density over it, and drop `flatShading` on the cap.
- **The high step moved 36 m west.** `UPDRAFT` and `FALLEN_BRIDGE` are both built by `along()` from STEP, so the
  updraft (now ~48 m) and the crown bridge (now ~45 m) follow it. `WINCH`, the step's hero stones, its wisp home and its
  pines are all offsets of STEP. The quest route is intact; h3 and the aerial show it as a real isle. A side effect: its
  winch house now stands at B's left edge (above).
- **The Roc's stage is unchanged** (`plugin.ts`: only the atlas `scope.own` line changed), so it is still on its 13 m
  circle (round 5, verified). The 150 ms settle picks the moment the Roc is still at the staged circle spot, just under
  the bar. That is a real state every lap passes, in the normal glide pose, and its strike bolt is live
  (`calm: false`). **Allowed**, but it is timing chosen to fit the bar: from the rise's eye the Roc's real lap runs
  into the bar 0.15 s later. The robust fix is the pose and size (finding 5), not the timing.
- **h4 inside the arena:** the intro and the place toast play during h4's 12 s settle, as they do for a player walking
  in, and D's "QUEST COMPLETE" chip is the state a player has after crossing the raised bridge. **Allowed.**
- **The light is global** (one tone map, one grade, one sun; the hero views and aerials moved with it). **No narrowing**:
  the clip shows the archipelago intact, with 0 page errors.
  - The crown's sward was thinned to 0.42 so the tufts don't hide the dais from the rise. That applies to the whole
    crown isle (real), but it costs D's meadow density; note it as a trade, not a breach.
  - Phone tier and the baseline HUD are kept (VITALS hidden at full health, LOCK with a target).

## Findings, ranked by score gained

1. **One sun, a hot solid disc** (A, B, C, D, proposal B; around x 0.25–0.4, y 0.3–0.5). The side is right now. What
   shows is a pale disc with a thin pinkish ring (zoomed in A, D and the overview aerial) plus a separate soft glow
   offset from it: by ~0.04 of the width in A, ~0.06 in D and ~0.13 of the height in `aerial-overview`. The offset grows
   with the camera's pitch. `sunGlow.ts` centres on `SUN_DIR = sunFromHeading(PANO_SUN)`, so the second feature is the
   panorama's painted disc mapping to a different direction off the horizon. Make the painted disc and the glow core
   coincide at every pitch (or drop one of them), and draw a solid white-gold core. Then shrink D's halo: 15 % of its
   middle band over 230 against the mockup's 5 %.
2. **Put the light on the forms, not only in the sky** (A, B, D, proposal B; the subject band y 0.45–0.65 and the meadow).
   The highlights now total right, but the middle of every frame went dark: A's band p50 55 vs 84, under A's bridge
   63 vs 108 (round 5 87), proposal B's band 57 vs 122. Lift the mid-tones and the sun-facing rims (the mill's left
   edges, the isle lips, the post tops, the grass tips; A's meadow p90 93 vs 121). Undo or narrow the near-ground ×0.55
   in `isle.ts`, which darkens every foreground the mockups show lit. Re-measure the subject band, not only the frame
   totals.
3. **Proposal B: the hill's lip at the bridge head** (x 0–1, y 0.4–0.86). On the axis is right. But from 8.5 m behind
   the spawn the eye sees ~19 m of flat deck, and the bridge shrinks to a sliver. The mockup's crest hides the near
   ground at y 0.63, and the bridge drops away below it over open air. Shape the ground so the crest falls toward the
   landing (the deck between the rise and the posts dropping out of sight, without moving A, B or C's fixed cameras), or
   put the rise's lip closer to the rim. Keep the keeper and his tag out of this line.
4. **The meadow's colour and finish** (all five; y 0.65–0.86). It is a carpet now; give it the mockups' colour and
   detail. Lift the blue (18–30 vs 29–53) and cut the chroma (52–82 vs 37–54) toward the mockups' grey-olive-gold.
   Light the tips toward the sun. Use white daisies for A's and D's flowers (not yellow dandelions on tall stalks). Add
   the rough lichen rocks where the mockups have them: A, three at the lower left; B and C, the lower left; D, down to
   the bottom edge. Give C's bridge-head rim (x 0–1, y 0.76–0.85) the verge it lacks: it is still bald.
5. **The crown** (D; y 0.25–0.72). The dais is right now. Bank the Roc with its talons forward, at the mockup's span
   (~0.96 of the width), below the bar in its real lap. Make the stones rough, with cut unlit runes instead of the cyan
   spirals. Open the haze between the stones onto the cloud sea, the isles and the pines. Lift the storm's value
   (y 0.05–0.25 p50 42 vs 80).
6. **The sky round the mill** (B, C, proposal B; y 0.05–0.45). Take the isle cluster and the step's winch house out of
   B's and proposal B's line over the mill (open cumulus there). Warm C's upper sky (chroma 32 vs 46, p50 115 vs 169).
   Pale proposal B's sky (chroma 58 / 80 vs 19 / 55).
7. **The fan's finish and B's set** (all; C x 0.5–1, y 0.5–0.8): riveted metal guards with diamond end caps, a worn leaf
   edge, the leaf at the mockup's size in C; the carved lectern with an open book and a hung lantern.

SCORE sky-reach: 6.1
