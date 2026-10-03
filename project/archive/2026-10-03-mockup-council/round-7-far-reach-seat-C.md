# Round 7, seat C, Sky Reach only (red team)

Surface: the Sky Reach section of `art/mockup-council/round-7/README.md` (with the lead's ruling on proposal B's camera),
the five `far-reach-*.jpg` sheets, the full-res capture `progress/far-reach/20261003-0250-1c2c026e/` (every `mock-*`, h1–h4,
both aerials, `clip.mp4` at 0.5 fps, `meta.json` `camAt`/`staged`), round 6's `20261003-0201-fc54d9df/` cropped beside it
(mockup | round 6 | round 7), the five ledger mockups at full resolution, and `git diff fc54d9df 1c2c026e` over
`src/shards/far-reach` and `art/far-reach/progress/cameras.json` (`layout.ts`, `plugin.ts`, `species/stormRoc.ts` at the
capture, `look/sky.ts`, `look/sunGlow.ts`, `manifest.ts`, `world/isle.ts`, `world/skyIsles.ts`, `world/build.ts`,
`world/dressing.ts`, `world/shapes.ts`, `world/meadow.ts`, `world/storm.ts`, `weapons/fanModel.ts`), plus
`scripts/shard-progress.mjs` (how a stage and its settle are captured). Every image is resized to 780×1688 with no grading.
Brightness is Rec. 709 luminance. Regions are fractions of the frame (x left→right, y top→bottom, HUD included). "hp" is
fine detail: the standard deviation of luminance minus a 1.5 px blur of itself.

Round 7 fixed the two loudest round-6 complaints. The sun is one solid disc again, and the near-ground darkening is gone,
so C's bald slab is now grass. D's storm eye sits up over the bar, as in the mockup. But the round also paid for its gains
in three places. Mockup A's isle cluster, its signature shape, was moved to the horizon to open B, C and proposal B's
skies. A global gamma 1.15 lifted the middle band by flattening the meadow, so A's ground now has under half the
mockup's tonal range and a third of its fine detail. And D's Roc frame is now taken 60 ms after the stage: a transient
in which the lock and the stage's own lightning bolt haven't happened yet, with a heading the brain doesn't produce from
that spot.

## Measured (mockup / round 6 / round 7)

| Patch | A | B | C | D | proposal B |
|---|---|---|---|---|---|
| Play x 0–1, y 0.05–0.85: L p99; % > 230 | 240/239/239; 2.2/2.8/2.8 | 242/238/239; 2.4/2.4/2.7 | 236/239/240; 1.9/2.6/2.9 | 242/243/241; 2.9/4.6/4.3 | 239/242/242; 3.8/3.8/4.4 |
| Subject band x 0–1, y 0.45–0.65: L p50 | 87/56/**74** | 92/71/83 | 81/86/111 | 159/157/178 | 122/57/73 |
| D band, % > 230 | — | — | — | 5.2/15.1/**13.6** | — |
| Under A's bridge x 0.25–0.75, y 0.53–0.6: L p50 | 108/63/**81** | | | | |
| Ground x 0.03–0.38, y 0.68–0.82: median RGB | 70,60,31 / 84,70,19 / **79,73,25** | 76,65,39 / 105,86,22 / 73,69,23 | 85,71,35 / 109,84,24 / 102,93,30 | 71,61,34 / 65,53,18 / 68,64,15 | 62,58,30 / 78,66,20 / 76,76,17 |
| Ground: L p10–p90 spread; hp | 70; 16.3 / 56; 8.7 / **29; 5.3** | 86; 17.1 / 60; 9.4 / **47; 6.9** | 99; 17.9 / 104; 12.3 / 101; 12.6 | 92; 16.8 / 59; 8.9 / 59; 9.2 | 77; 12.4 / 41; 7.2 / 45; 8.4 |
| Upper sky y 0.05–0.25: L p50; chroma | 166; 47 / 141; 38 / 156; 42 | 161; 32 / 138; 33 / 150; 36 | 170; 47 / 115; 32 / **130; 31** | 81; 22 / 42; 24 / **71; 31** | 159; 20 / 159; 59 / **180; 72** |
| Sky patch x 0.18–0.82, y 0.17–0.33: chroma | 74/58/78 | 48/56/74 | 62/38/40 | 43/47/50 | **26/82/105** |
| Sun (brightest blurred point x, y) | 0.35,0.36 / 0.29,0.38 / 0.29,0.38 | **1.00**,0.43 / 0.42,0.41 / 0.40,0.39 | **0.07**,0.37 / 0.42,0.48 / 0.42,0.46 | 0.24,0.47 / 0.27,0.47 / 0.29,0.45 | 0.24,0.40 / 0.33,0.32 / 0.28,0.30 |

- **The sun** (3× crops in all five views): one filled white disc now, with its bloom centred on it (in D the round-6
  ring-plus-blob pair is gone). Its radial luminance is flat at 253 out to ~12 px, then a smooth falloff. A faint darker
  outline still rings the disc, so it reads as a flat sticker with a hard edge rather than the mockups' white-hot point
  bleeding into gold.
- **The ground got greener, not finer.** R and G are now level (A 79,73; proposal B 76,76), while every mockup is warmer
  (R − G 10–14) and bluer (blue 30–39 against 15–30). Fine detail fell again in A and B (hp 5.3 / 6.9, against round 6's
  8.7 / 9.4 and the mockups' 16–17). The tonal spread fell to 29 in A against the mockup's 70. Gamma 1.15 lifted the dark
  roots that the mockups keep dark.
- **The skies got hotter.** Mid-sky chroma (y 0.25–0.45) is 82–92 in A, B, C and D against the mockups' 55–81.
  Proposal B's sky patch is at chroma 105 against the mockup's 26: round 6 was 82, so it moved further away.

## Scores

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-11-review/mockup-A-spawn-look` → `mock-A-spawn-look` | **6.5** (round 6: 7.0) | 1. **The isle cluster is gone (x 0.05–0.9, y 0.17–0.42), a regression.** The mockup's composition hangs on four overlapping crags with roots, framing the sun over the mill. Round 7 moved `o1`–`o3` to z −290…−330 (`skyIsles.ts`), so the upper third is open cumulus with one isle cut off at each edge. The sun is on the right side and a solid disc now (x 0.29 vs 0.35), but nothing frames it. 2. **The meadow (x 0–0.65, y 0.64–0.86), a regression.** It is a smooth, even, green lawn (ground hp 5.3 vs 16.3; L spread 29 vs 70), with white puffballs on bare stalks standing above it. The mockup has crisp backlit blades, dark gaps, daisies in the grass and three lichen boulders at the lower left. The lantern at the left post is still there. 3. **The far isle and the bridge (x 0.15–0.85, y 0.4–0.62).** These moved toward the mockup. The ropes are netted now, with ties to the deck like the mockup's rails, and the band under the bridge is lighter (p50 81 vs 108; round 6 63). Still different: the mill's lattice sails with dark panes against the mockup's canvas, the white stone against the mockup's warm stone, and the keel a pale wall rather than lit rock with roots. |
| `round-18-council-mockups/mockup-B-quest-start-painterly` → `mock-B-quest-start` | **6.5** (6.0) | 1. **The light (x 0.3–1, y 0.15–0.5).** The sky over the mill is open now, as the mockup's is: the step's house and the overhead isles are gone, a real gain. But the sun sits at x 0.40, beside the keeper's hand, where the mockup's floods in from the right edge. Mid-sky chroma is 91 against 63. 2. **The keeper's set and the rocks (x 0–0.45, y 0.43–0.85).** He stands in short grass with his boots in view, and the stand is a box lectern with a lit lantern: closer. The two new rocks at the lower left (x 0–0.2, y 0.68–0.85) are flat-shaded, mossy green polyhedra with hard facets. The mockup's are rough grey lichened stones. 3. **The mill and the meadow (x 0.4–1, y 0.3–0.86).** The mill is a large white stone tower; the mockup's is a small dark timber post-mill on a spur. The meadow is greener but smoother (hp 6.9 vs 17.1), with no daisies. |
| `round-18-council-mockups/mockup-C-hands-fan-painterly` → `mock-C-hands-fan` | **6.0** (5.5) | 1. **The fan (x 0.5–1, y 0.55–0.8).** The silk is a lighter, muted teal now, and the guards carry iron straps with studs and diamond caps, so the leaf reads closer. It is still about half the mockup's area, held upright at the right edge where the mockup's sweeps diagonally across the middle, and its tassel is short. 2. **The sky and the sun (y 0.05–0.5).** The upper sky is still cool lavender (p50 130, chroma 31, against 170 and 47). The sun is at x 0.42, behind the mill; the mockup's floods in from the left edge (0.07). Open cumulus over the mill now matches. 3. **The foreground (x 0–1, y 0.74–0.86).** It is grass now, not round 6's bald dark slab: the biggest gain in this view. But it is a brighter, more acid lime than the mockup's (fg p50 90 vs 67, chroma 73 vs 49), and it lacks the mockup's rough rock at the lower left and the flowered verge. The post now sits on a stone base, and the bridge is netted (a gain). |
| `round-11-review/mockup-D-crown-arena` → `mock-D-crown-arena` (staged `roc-stalk`, settle 60 ms) | **6.5** (6.0) | 1. **The Roc (x 0–0.7, y 0.24–0.36).** It is still a head-on, nearly symmetric glide, with its head facing the camera and its wing tips running behind the boss bar on both sides. Its span is ~0.66 of the frame width against ~0.96. Its talons are tucked, not reaching forward, and its wings are dark chocolate brown (the darks average 71,43,37) where the mockup's are slate. The stage's new heading makes the left wing a little longer on screen; it does not bank the bird (the engine's flight has no roll). 2. **The sun and the storm (x 0–1, y 0.05–0.6).** The storm eye is up over the bar now, a big spiral close to the mockup's (upper sky p50 71 vs 81; round 6 42): the largest gain in this view. There is one sun disc. But its halo still washes the space between the stones (13.6 % of y 0.45–0.65 over 230, against 5.2 %). The mockup's bolt is gone: the stage schedules a strike 0.15 s ahead, and the frame is taken at 0.06 s. 3. **The arena floor and the stones (y 0.5–0.86).** The grass is back to 0.85, so the stubble is gone. Before the dais, though, the floor is a dark, blotchy olive mat, with no flowers and no rocks. The three new hero stones sit at y ≈ 0.87–0.98, under the touch HUD, out of view. The stones are dark slabs with cyan spirals; the mockup's are lit, lichened and carved. The fan covers the dais's right third, where the mockup shows a sliver. |
| `round-1-proposals/B-sky-reach` → `mock-proposal-B` | **5.5** (5.5) | 1. **The sky (y 0.05–0.5), worse.** It is saturated orange-peach (sky patch chroma 105, 15.5 % over 230), against the mockup's pale, almost colourless air (chroma 26, 3.9 %). A lightning bolt now hangs over the mill (x 0.53, y 0.2): the storm sits higher (`storm.ts`, lift 36 → 55), so its strikes reach the spawn's sky. The overhead isles are gone, which matches the mockup's open sky, but its isles hang at mid-height either side of the destination (y 0.25–0.6), and the game's only show cut off at the top corners. There is no manta. 2. **The composition (whole frame), per the lead's ruling.** The bridge axis is right, and the 5 m of deck is excused. The isle still fills ~0.7 of the width (the mockup's spur ~0.3). The bottom half is a flat, dark lawn with the keeper and his tag in it, and a thin hover-deck line crosses the left edge (x 0–0.2, y 0.42–0.46). 3. **The foreground (y 0.55–0.86).** A smooth lime lawn (hp 8.4 vs 12.4; blue 17 vs 30) with flat mossy lumps at the left. The mockup's is a lit grass crest with daisies and a dark rock falling away. |

**Seat score, Sky Reach: (6.5 + 6.5 + 6.0 + 6.5 + 5.5) / 5 = 6.2** (round 6, this seat: 6.0).

## The builder's claims, checked

| Claim | Verdict | Evidence |
|---|---|---|
| Top 1 % at 238–242; 2.8–4.5 % above 230 | **verified** | Play x 0–1, y 0.05–0.85: p99 239–242, 2.7–4.4 % over 230. D's middle band is still 13.6 % over 230 against 5.2 %: the total matches, but D's halo doesn't. |
| A's subject 84 → 99, under the bridge 72 → 88 (gamma 1.15) | **direction verified, numbers from another crop** | Seat patches: band p50 56 → 74 (mockup 87), under the bridge 63 → 81 (108). It is global (`manifest.ts` `gamma: 1.15`), so it also flattened every meadow (finding 2). |
| One hot sun disc in a gold-orange bloom (the dome samples by view direction) | **mostly verified** | `sky.ts` now samples `w.xyz - cameraPosition`, and in D the disc and the glow coincide. Each view shows one filled disc, but a faint dark outline still rings it, and there is no white-hot core brighter than the disc's flat fill. |
| The near-ground darkening is gone | **verified** | `isle.ts` drops the camera-distance multiply. C's foreground is grass (fg p50 55 → 90), and D's floor is no longer black under the eye. |
| The sward finer and greener: twice the texels, arching blades, gold backlit tips, fewer and smaller flowers | **greener: yes. Finer and gold-tipped: no** | Ground hp: A 8.7 → 5.3, B 9.4 → 6.9, C, D and proposal B flat (mockups 12–18). A's ground p90 (the lit tips) fell 98 → 87 against 108. `SWARD.scale` went 1.05 → 0.82, so the tufts are shorter, and at phone size the field reads as lawn. Fewer flowers: yes. |
| A narrower windmill keel; netted rope bridges; thinner planks | **verified** | `build.ts` `CUT.windmill`, `shapes.ts` ties every 1.25 m and the deck scaled 0.5 in y. Visible in A and C. |
| The Roc slate and white | **half** | The head and breast are white. The wings' darks average 71,43,37 (red well over blue): brown, not slate. The `far.roc-slate` patch shifts only texels that pass its brown test. |
| The storm eye higher | **verified** | `storm.ts` lift 36 → 55, ahead 90 → 70. D's upper sky p50 42 → 71 (mockup 81). Side effect: its bolts now show over the spawn (proposal B). |
| B and D have lichened rocks | **B: present but not lichened. D: not visible** | B: two flat-shaded green polyhedra at the lower left. D: `HERO_STONES` (−1.6, −182.2), (−2.7, −183.6), (1.9, −184.2) are 6–8 m ahead and ~4 m below the eye, which puts them at y ≈ 0.87–0.98, under the touch HUD. I find no rock in D's visible frame. |
| The step at (−64, −126), out of B's view | **verified** | B's winch house and step deck are gone from the frame. |
| (README) the Roc "banks across the view" | **not supported** | `Animal.fly` sets yaw and speed only; the engine's flight has no roll. On screen the bird is head-on, its head toward the camera, its wings near-symmetric. |

## No-shortcut audit (ledger 5)

| # | Severity | What | Evidence | Fix |
|---|---|---|---|---|
| X1 | **should-fix, borderline breach (not voided this round)** | **D's Roc frame is a ≤ 0.25 s transient, at a heading the brain doesn't produce from that spot.** | `scripts/shard-progress.mjs` runs `stage()`, then poses the player, then sleeps `settle` (now 60 ms; 300 → 150 → 60 across three rounds). `stageStalk` places the Roc at (−3, −208.65) at `ROC.y` 54 and points it at (−14, −170), 21° west of the bearing to the camera at (0, −176). In `stalk` the brain always steers at the player (turn rate 3 rad/s), so ~0.1 s later it points at the camera. It also climbs at 9 m/s toward `p.y + 10` (≈ 56.3 on the rise), which the builder's own `$doc` says carries it into the bar by 0.15 s. The ordinary circle → stalk start at that spot comes in from the tangent heading (east, about 103°) and turns west onto the bearing, so it never passes the staged west-of-bearing heading. Two things that come with this moment are missing at 60 ms: the lock (LOCK dim, no target marker on the bird, where round 6 at 150 ms had both) and the stage's own bolt (`storm.strike(0.15)` fires after the shot). It is not a freeze, the bird's position on its circle is real, and the heading's on-screen effect is small, so I score the frame. But it is the ledger's "pose a player only sees for an instant", reached by tuning the timing round after round. | Stop staging a stalk heading. Either capture the **circling** state, which the Roc holds for whole laps at `ROC.y` with `calm: false`: it crosses the view side-on, which is closer to mockup D's banked eagle than a head-on stalk. Or let a real stalk run with settle ≥ 0.5 s and accept where it flies. If the sustained stalk over a player on the rise sits behind the bar, change the brain for everyone (phase-0 hover height), not the capture. Record the Roc's state, position and yaw in `meta.json`. |
| X2 | note (a trade, not a breach) | **Mockup A's isle cluster was moved to the horizon for B, C and proposal B.** | `skyIsles.ts` `o1`–`o3` went from 70–80 m up at z −150…−176 to 34–46 m at z −290…−330. It is global (h1 and the aerials lose them too), and it is real geometry, so it doesn't break rule 5. But it trades one mockup's main subject for three others' backgrounds, and A's score falls with it. | Bring a cluster back where A's camera sees it over the mill and B's and C's cameras don't: B looks 4° left of A's axis and C ~5° left from 3 m right. Or accept A's loss and say so in the next README. |
| X3 | should-fix (no narrowing) | **The quest route's two spans keep growing for sky composition.** | STEP has moved (−8, −122) → (−44, −126) → (−64, −126). Edge to edge, the updraft (a board-only ramp, `UPDRAFT`) grew 29 → 46 → 60 m, its climb falling 23° → 15° → 12°. The raised crown bridge (`FALLEN_BRIDGE`) grew 38 → 47 → 61 m. The navmesh was re-baked (`34bcb808d`), and the orbit clip shows the bridge spanning, but no capture or report shows a board ride up the 60 m updraft or a walk across the raised 61 m bridge. | Run the updraft ride and the raised-bridge walk (physics baseline `--mode=walk` plus a board run), and name the result in the next README. |
| X4 | should-fix (no narrowing) | **The updraft's cyan frame fades with camera distance.** | `shapes.ts` `far.hover-frame` multiplies emissive by `mix(1, 0.1, smoothstep(25, 60, dist))`. Its comment cites the mock views. It is real and global, but the frame is the route's wayfinding cue, and now a player at the spawn barely sees where the board route goes. | Keep the cue legible from the spawn: a soft wind ribbon or a thinner but still lit edge at distance, instead of fading it to 10 %. |
| X5 | ok | Gamma 1.15, the sun, the sky dome, the storm, the sward, the keeper's short-grass disc, the hero rocks, the keel, the netted bridges | All global or real 3D, and the hero views and aerials moved with them. The rocks are ≤ 0.5 m, instanced, with no collider (as all dressing rocks are). The crown sward went back to 0.85 (round 6 X3 resolved). The near-ground multiply is gone (round 6 X2 resolved). No `mock-*` camera changed. h3's re-aim (yaw 30 → 41) follows the step and is named in `$doc`, though the generated list covers only `mock-*` views. Page errors 0. | — |
| X6 | should-fix (repeated: round 5 X1, round 6 X1) | **Sunrest's rise is still a bald dome.** | `aerial-spawn` (x 0.25–0.75, y 0.6–0.82): a smooth, dark spherical cap with flower dots and no tuft cards. Pale flat short-grass discs dot the isle round it. | Grow the tuft cards over `KNOLLS`, as `knoll.ts` claims they do. |

**The lead's ruling on proposal B's camera** is respected: I don't score the 5 m of deck. It doesn't hide a fixable gap
in the composition: no spot behind the spawn sees the deck fall away without raising A's and C's ground. It does not
excuse what the camera sees and the builder controls. The sky got more saturated (chroma 82 → 105 against 26), a storm
bolt now hangs over the mill, the meadow is a flat lawn, and the manta is absent. Those are scored.

## Findings, ranked by score gained

1. **Make D's Roc the mockup's bird in a held state** (D, x 0–1, y 0.2–0.4; repeated, plus X1). Capture its circling lap
   (side-on, under the bar at `ROC.y`) or a real stalk with settle ≥ 0.5 s. Give the flight a roll into its turns, so it
   banks for real. Take the wings to slate (the brown test misses the darkest feathers: darks are 71,43,37), extend the
   talons, and scale it toward ~0.96 of the frame width. Then cut D's halo: 13.6 % of the middle band over 230 against
   5.2 %.
2. **Undo the meadow's flattening** (A, B, D, proposal B; y 0.64–0.86; **regression**). Gamma 1.15 and `SWARD.scale` 0.82
   turned the sward into lawn. A's L spread is 29 against 70, and hp 5.3 against 16.3. Keep the band's lift, but put it on
   the forms: a gamma restricted to luminance above the meadow's median, or light on the sun-facing rims. Restore dark
   roots between the tufts and lit gold tips (A's ground p90 87 against 108). Move the colour from lime (R ≈ G) toward
   the mockups' warm olive-gold (R − G ≈ 10–14, blue 30–39). Re-measure hp and spread on the seats' ground patch, not the
   mean.
3. **Give A back its cluster without walling B and C** (A, x 0.05–0.9, y 0.17–0.42; **regression**, X2). One to three
   crags with hanging roots, overlapping, framing the sun from A's camera on the bridge axis. B (4° left, 5 m further
   back) and C (3 m right, yaw 5°) must stay open over the mill. Check all three before committing.
4. **Pale the high sky and the haze toward the mockups'** (proposal B y 0.05–0.5; B, C mid-sky; **regression** in
   proposal B). Mid-sky chroma 82–92 against 55–81; proposal B's sky patch 105 against 26. C's upper sky is still cool
   lavender (p50 130 against 170). One sky serves every view, so desaturate the horizon band toward pale gold and warm the
   zenith on the sun's side. Keep the storm's bolts inside the crown's sky (proposal B shows one over the mill).
5. **The sun as a hot point, not a sticker** (all five; around x 0.25–0.45, y 0.3–0.5; repeated). Lose the outline ring.
   Give it a white core brighter than its fill that bleeds into the gold, at the mockups' smaller size. Its side is still
   wrong in B (x 0.40 against the right edge) and C (0.42 against 0.07). One sun can't satisfy all five, so leave it, but
   stop claiming B.
6. **Rocks the mockups show, where the frame shows them** (A lower left, three; B lower left; C lower left; D down to the
   bottom edge; repeated). B's new rocks are hard-faceted green polyhedra: make them rough grey stone with lichen. D's
   three sit under the HUD (y ≈ 0.87–0.98): set them 10–14 m out (y ≈ 0.72–0.82), clear of the walk.
7. **The fan's size and pose in C** (x 0.3–1, y 0.5–0.8; repeated). The straps and caps landed. The fan is still about
   half the mockup's area and upright at the right edge, where the mockup's sweeps diagonally across the middle with a
   long tassel. Change the idle hold for everyone, not a staged pose.
8. **Evidence for the moved route** (X3, X4). Run the 60 m updraft on the board and the 61 m raised bridge on foot, and
   keep the updraft's cue visible from the spawn.

SCORE sky-reach: 6.2
