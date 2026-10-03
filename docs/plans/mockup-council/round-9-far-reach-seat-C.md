# Round 9, seat C, Sky Reach only (red team)

Surface:
- The Sky Reach section of `art/mockup-council/round-9/README.md` and the five `far-reach-*.jpg` sheets.
- The full-res capture `progress/far-reach/20261003-0447-d3eefd5c/`: every `mock-*`, h1–h4, both aerials, `clip.mp4` at 1 fps,
  and `meta.json` (`camAt`, `staged`, `active`, `pageErrors`).
- Round 8's `20261003-0402-185b6810/` beside it (mockup | round 8 | round 9), and the five ledger mockups at full resolution.
- Code at the capture: `plugin.ts` ('roc-opening', 'quest-winch'), `species/stormRoc.ts` (`stageOpening`, `think`, `act`,
  `PERCH`, `ROC_TAKEOFF`), `combat/stormRoc.ts`, the engine's `ai/BossBrain.ts` (arm, intro, begin, retry), `layout.ts`
  (`CROWN`, `DAIS`, `ROC`, `STEP`, `FALLEN_BRIDGE`, `rimAlong`, `KNOLLS`), `world/crown.ts` (`crownStones`, `HEIGHTS`),
  `world/skyIsles.ts` (the cluster), `look/sky.ts`, `world/meadow.ts`, `world/dressing.ts`, and `art/far-reach/progress/cameras.json`.
- `git show` / `git diff 185b6810e d3eefd5c7` of the shard, and the messages of d3eefd5c7, efca93202, 109655ccb, 5abe9d651,
  4c3288300 and aa6c1080f (the h3 camera).
- The play run `art/far-reach/round-22-council-tools/playrun.mjs`, `playrun-result.json` and `scripts/physics-walk.mjs`.

Method:
- Every image is resized to 780×1688 with no grading.
- Brightness is Rec. 709 luminance. "hp" is fine detail: the standard deviation of luminance minus a 1.5 px blur of itself.
- Regions are fractions of the frame (x left→right, y top→bottom, HUD included). The patches are round 8 seat C's, so the
  rounds compare directly.
- World positions are projected through each shot's `camAt` (vertical FOV 72°, horizontal half-angle 18.6°; −z forward, so
  a negative dir x looks west/left).

The round has two real gains: the Roc is no longer rust (its body mids measure slate), and B's swamping boulder is gone,
with the keeper's book now open toward the reader. Three things go the other way. The glow cut darkened A's meadow and
proposal B's foreground. The clipped band between D's stones doubled. And h3 was turned 82° away from the high step it is
named for, so the pine regression from round 8 left the evidence without being fixed.

## Measured (mockup / round 8 / round 9)

| Patch | A | B | C | D | proposal B |
|---|---|---|---|---|---|
| Play y 0.05–0.85: L p99; % > 230 | 240/238/236; 2.2/2.5/2.4 | 242/236/237; 2.4/1.9/2.2 | 236/237/237; 1.9/2.1/2.2 | 242/238/240; 2.9/2.5/**3.3** | 239/239/238; 3.8/3.1/2.7 |
| Subject band y 0.45–0.65: L p50 | 87/70/69 | 92/74/**70** | 81/108/107 | 159/176/177 | 122/61/**57** |
| Meadow x 0–0.6, y 0.66–0.84: p10/p50/p90; sd; hp | 41/65/122; 34.1; 17.8 → 44/70/110; 27.2; 13.1 → **40/61/93; 22.8; 11.0** | 36/68/130; 37.1; 17.6 → 34/57/90; 22.7; 7.7 → **43/67/105; 25.2; 12.0** | 40/72/130; 36.6; 16.6 → 43/86/140; 39.2; 15.2 → 41/75/128; 35.7; 13.5 | 36/68/134; 39.1; 17.1 → 28/72/138; 43.9; 15.1 → 27/65/133; 39.7; 13.5 | 37/61/119; 34.0; 12.0 → 38/62/96; 23.9; 11.2 → **35/55/82; 20.1; 9.3** |
| C verge x 0.05–0.65, y 0.77–0.85: p50; chroma | | | 67; 49 / 94; 76 / **79; 64** | | |
| Upper sky x 0.2–0.6, y 0.04–0.09; x 0.05–0.38, y 0.11–0.18: L p50 | 141, 177 / 124, 170 / 127, 172 | 143, 165 / 122, 156 / 125, 157 | **165, 190 / 106, 130 / 111, 133** | | 105, 162 / 162, 183 / 162, 183 |
| Cluster zone x 0.05–0.95, y 0.17–0.36: p10; sd | 105; 42.9 / 120; 34.4 / **109; 40.0** | 139; 28.2 / 119; 34.1 / 111; 38.6 | 138; 36.0 / 120; 30.6 / 111; 32.1 | | 167; 31.6 / 118; 43.1 / 111; 47.6 |
| A's crags: left crag body (mockup x 0.09–0.31, y 0.30–0.36; game o1 x 0.16–0.34, y 0.255–0.30): p10/p50/p90; sd; hp | mock 107/131/223; 42.9; 8.9 → r9 110/122/141; **22.2; 5.5** | | | | |
| D band y 0.45–0.65 % > 230; between the stones x 0.3–0.9, y 0.5–0.6 | | | | 5.2 / 8.2 / **11.6**; 3.3 / 8.7 / **16.6** | |
| D floor x 0–0.45, y 0.70–0.74: p50; near meadow y 0.74–0.84: p50, chroma | | | | 74 / 42 / **39**; 54, 36 / 66, 51 / 58, 44 | |
| D Roc mids (L 60–110): mean RGB; chroma | | | | wings 102,81,87; 28 / 118,72,61; 65 / **body 94,78,78; 19** (raised wing 100,69,67; 38) | |
| P sky patch x 0.18–0.82, y 0.17–0.33: chroma; foreground x 0–0.45, y 0.62–0.84: p90 | | | | | 26; 154 / 95; 93 / **81; 78** |
| Sun (x, y) | 0.34,0.35 / 0.28,0.38 / 0.28,0.38 | 1.0,0.42 / 0.39,0.39 / 0.40,0.40 | 0.05,0.34 / 0.42,0.46 / 0.42,0.46 | 0.23,0.46 / 0.29,0.45 / 0.30,0.45 | 0.24,0.40 / 0.28,0.30 / 0.29,0.30 |

Readings:
- **The Roc is slate now.** The body's mid-tones are 94,78,78 (chroma 19), against the mockup's 102,81,87 (28) and round 8's
  rust 118,72,61 (65).
- **The glow cut moved C and D toward their mockups and A and proposal B away.** C's verge is 79 against 67 (it was 94), and
  D's near grass 58 against 54. But A's meadow lost a sixth of its spread, with p90 93 against 122 (it was 110) and hp 11.0
  against 17.8. Proposal B's foreground p90 fell to 78, against 154.
- **The sky lift is real but tiny:** +1 to +5 in every view. C's upper sky is still 111/133, against 165/190.
- **D's halo regressed.** Between the stones, 16.6 % of pixels are over 230, against 8.7 % in round 8 and 3.3 % in the
  mockup. h4, which is unstaged, moved the same way (band 8.4 → 11.4 %), so the cause is global, not the stage.

## Scores

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-11-review/mockup-A-spawn-look` → `mock-A-spawn-look` | **7.0** (round 8: 7.0) | 1. **The cluster (x 0.1–0.75, y 0.18–0.33) is now over the mill, but its finish is not the mockup's.** There are three pale, flat-topped mesas, each with 1–3 pines on a bald grass cap, smooth banded stone sides and a few short drips. o1's body has half the mockup crag's tonal spread (sd 22 against 43) and less fine detail (hp 5.5 against 8.9). The mockup's crags are rugged and back-lit, with wooded tops and dense hanging roots, arching over the sun. The game's sun (x 0.28, y 0.38) still sits in open cloud left of the mass. 2. **The meadow (x 0–0.6, y 0.66–0.84) regressed:** p90 93 against 122 (round 8 110), sd 22.8 against 34.1, hp 11.0 against 17.8. It is a darker, flatter olive field, and the three grey boulders and daisies at the lower left are still missing. 3. **The middle band (y 0.45–0.65) is dim and unchanged:** p50 69 against 87, and under the bridge 77 against 108. The mill is still a white stone tower. |
| `round-18-council-mockups/mockup-B-quest-start-painterly` → `mock-B-quest-start` | **6.5** (6.0) | 1. **The foreground (x 0–0.6, y 0.62–0.86) is better.** The boulder is gone and the ground matches the mockup's level (p50 67 against 66; hp 12.0 against 17.6; round 8 7.7). But it is tall straw blades. The two "rocks 5–6 m out" sink into the grass (two dark lumps at x 0–0.15, y 0.64–0.67), where the mockup has lit grey stones in a short daisy meadow. 2. **The sky (y 0.15–0.42).** The cluster now spans x 0.05–0.75 over the mill, where the mockup's sky is open lilac cumulus. Under the lead's ruling I score its finish: the same pale flat mesas as in A. The sun is still at x 0.40; the mockup's floods in from the right edge. 3. **The keeper's set (x 0.05–0.45, y 0.43–0.62).** The book is open toward the reader now, a gain. The keeper's arm is still a stiff raised rod with no elbow, and the subject band went darker (p50 70 against 92; round 8 74). |
| `round-18-council-mockups/mockup-C-hands-fan-painterly` → `mock-C-hands-fan` | **6.0** (6.0) | 1. **The fan (x 0.5–1, y 0.55–0.8) is unchanged:** about half the mockup's leaf, upright at the right edge, where the mockup sweeps it diagonally across the middle with a long tassel. 2. **The sky (y 0.05–0.45) is still cool lavender and dark:** 111/133 against 165/190, only +3 since round 8. The sun is at x 0.42 behind the mill, not at the left edge (0.05). The cluster crags hang centred over the mill (x 0.2–0.7, y 0.28–0.36), where the mockup has small isles at the edges. 3. **The foreground (x 0.05–0.65, y 0.77–0.85) is closer:** p50 79 against 67 (round 8 94), chroma 64 against 49. It is still straw, with no rock at the lower left and no flowers. |
| `round-11-review/mockup-D-crown-arena` → `mock-D-crown-arena` (staged `roc-opening`, settle 0.5 s) | **7.0** (6.5) | 1. **The Roc (x 0–0.68, y 0.1–0.45) has the mockup's mass and colour now, but not its pose or finish.** It is side-on, head left, one wing in a vertical upstroke that runs up through the boss bar to y 0.1. The mockup's eagle comes at the camera three-quarter, both wings flat and spread, talons forward. The feather texture breaks into ~8 px blocks at phone size. A pale seam runs along the flank (x 0.2–0.5, y 0.44), and cone-facet shards stick out at the tail (x 0.6–0.75, y 0.47–0.5). 2. **The light (y 0.45–0.65) regressed:** between the stones 16.6 % over 230, against 3.3 % (round 8 8.7 %), and the band 11.6 % against 5.2 %. The storm is a violet spiral where the mockup's is smoky slate. 3. **The arena floor (y 0.62–0.86) is still inverted:** the floor behind the dais is 39 against 74, a dark mat. The dais is a pale, smooth, flat slab. The near grass is now at the mockup's level (58 against 54), and the fan still covers the dais's right third. |
| `round-1-proposals/B-sky-reach` → `mock-proposal-B` | **5.5** (5.5) | 1. **The sky (y 0.05–0.5)** is less orange (chroma 81 against 26; round 8 95). The cluster now hangs over the mill at the top (x 0.1–0.75, y 0.15–0.27), while the mockup's isles hang at mid-height either side of the mill. There is no manta. 2. **The foreground and middle got darker again:** the foreground p90 is 78 against 154 (round 8 93), the subject band 57 against 122, and the keeper's ground 38 against 106. It is an unlit field, where the mockup has a sunlit grass crest with daisies. 3. **The destination (x 0.1–0.9, y 0.35–0.55)** is still a wide flat shelf with five pines, against the mockup's narrow rooted spur. |

**Seat score, Sky Reach: (7.0 + 6.5 + 6.0 + 7.0 + 5.5) / 5 = 6.4** (round 8, this seat: 6.2).

## The two questions the README asks

**(1) Is 'roc-opening' the opening a player sees from D's spot, in ordinary play? The state yes; the spot no.**

- **The state is real.** The engine's `BossBrain` arms the fight, and when `inArena` fires (r < 18 m from the crown's
  centre) it runs a 1.5 s intro: input locked, the player eased to face the dais. Then `begin` sets `fighting`, and
  `think` sees the edge and starts `ROC_TAKEOFF`, a 1.5 s, 2.5 m/s rise of 4 m off the perch.
  - The perch is the tallest stone, `HEIGHTS[2]` = 5.0 at a = 1.5π, so (0, 49.6, −204): straight ahead of D's camera
    at 28 m.
  - The frame matches that state 0.5–0.7 s in. The body is about 3.8 m over the eye, close to the perch's 1.6 m plus the
    rise; the bird is side-on, turning from facing south toward its lap point north.
  - The pose is a moving flight state, not a freeze, so it is no ledger 5 breach. The take-off is global behaviour that
    every first fight runs.
- **But no ordinary entry puts the player on D's spot while it happens.**
  - `FALLEN_BRIDGE` lands at the crown's south-west corner, (−12.95, −177.05) (`rimAlong` at 135°: 19.32 − 1). The fight
    begins 0.5 m in, at about (−12.7, 44, −177.3).
  - D stands at (0, 48, −176) on the crown knoll's top: 12.7 m east of that and 2.4 m higher.
  - The play run confirms the entry. It walks the bridge to (−13, −177) and on to (−6.5, −180.7); it never passes D's spot.
  - From the real entry, facing the dais, the perch is 8.6° left of the axis at 29.9 m. The sun, which is 7.4° left of D's
    axis, is 41° left of the player's, out of frame. So D's composition is not the opening the player sees.
  - At the run's ~4.1 m/s, crossing 12.7 m takes ~3.1 s, longer than the 1.5 s take-off.
  - The only way to D's spot is to skirt the 1.3–2 m band between r 18 and the rim round to the south, then step in on the
    knoll (about (0, −172)). That is reachable, but deliberate, not ordinary.
- **And the opening isn't "every fight", as d3eefd5c7 claims.** `reset()` still leaves `rest` unset; round 8 X1 asked for
  it.
  - On a retry, `rest` is whatever the last fight left, nearly always ≤ 0, since it keeps falling through stalk and strike.
  - So `think` switches `circle` → `stalk` on the same tick the take-off is set. The take-off branch in `act` needs
    `circle`, so it never runs.
  - The stage forces `rest = 2`, so it shows the first attempt's opening only.
- **The commit's "wings spread, under the bar" is false in the pixels.** One wing is in a vertical upstroke and crosses the
  bar to y 0.1.
- **Ruling: should-fix, repeated in a new form, not void.** The look is a real, reachable fight state. The framing pairs it
  with a spot that ordinary entry does not reach. The arena was laid out for a south entrance (crown.ts: the stones "open
  toward the bridge (+z)", the perch "opposite the entrance"), but since round 6 the bridge lands at the south-west.

**(2) Is the new cluster one world that holds up from the hero views and the aerials? Yes as geometry; its finish is the weak part.**

- **It is one global layout** (`skyIsles.ts` o1 (−22, −150) deck 72, o3 (−6, −166) deck 81, o4 (11, −152) deck 74), not a
  per-view switch.
  - It shows the same way in A, B, C, proposal B and h1, in both aerials and in every orbit frame of `clip.mp4`.
  - In plan the three are clear of each other: o1–o3 are 22.6 m apart, and o3's keel at o1's deck height is far inside
    that. o3 no longer runs through l4. Round 8's interpenetration is closed.
  - The aerials and the clip read them as three separate isles in a row, hanging 28–37 m above the crown's south half
    and the end of the crown bridge. o3's footprint overlaps the crown's south rim in plan; its keel tip is about 19 m
    above the deck. The "overlap" exists only in depth from the spawn. That is fine: the mockup's overlap is a view effect
    too.
- **No view hides them, and none was re-aimed for them.** D and h4 face away from them (they hang behind the crown
  knoll).
- **The finish is what costs.** Every crag is the same kit: a flat grass cap, 1–3 pines, smooth banded stone and a ring of
  short drips. Hazed, o1 has half the mockup crag's tonal spread. The mockup's are wooded, rugged and root-hung. Under the
  lead's ruling this is the item B and C are scored on.

## The builder's claims, checked

| Claim | Verdict | Evidence |
|---|---|---|
| The Roc's near-black paint lifted to a slate floor | **verified** | Body mids 94,78,78, chroma 19, against the mockup's 102,81,87, chroma 28 (round 8 118,72,61, chroma 65). |
| The take-off is real and "every fight shows it"; D "wings spread, under the bar" | **real for the first attempt; "every fight" and "under the bar" false** | Question (1): retries skip the take-off, and the raised wing crosses the bar. |
| The upper sky warmer and lighter above 18° | **direction yes, size no** | +1 to +5 L (C 106 → 111 against 165). The 18–40° smoothstep barely reaches the frames' upper band. |
| The meadow's backlight down: D's near grass 96 against 56 | **D and C closer; A and proposal B regressed** | D near 66 → 58 (54); C verge 94 → 79 (67); A meadow p90 110 → 93 (122); proposal B foreground p90 93 → 78 (154). |
| B's rocks 5–6 m out: spread 67, hp 13.8 against the mockup's 72, 13.4 | **the game numbers are close; the mockup's are under-quoted** | My B ground patch: game 42/67/105, hp 12.2; mockup 40/66/126, hp 17.1. The rocks are now mostly hidden in tall grass. |
| The crown's runes flush, pale worn stone; dais rim fractured | **verified** | Pale, flat spirals; the rim is in blocks. The dais face is still a smooth pale slab. |
| The keeper's book faces its reader | **verified** | Open white pages show at x 0.28–0.35, y 0.46. |
| One ordinary play run: one load, no teleports | **mostly verified** | See X4: one undeclared harness state. |
| h3 "faces the moved high step, yaw −41; +41 was the wrong sign" | **false** | See X3. |
| The README: "h3's yaw sign was fixed in 3ae4fc10e" | **wrong commit** | 3ae4fc10e is Signal Dunes' round-9 scores; the h3 change is aa6c1080f. |

## No-shortcut audit (ledger 5)

| # | Severity | What | Evidence | Fix |
|---|---|---|---|---|
| X1 | **should-fix (borderline), repeated in a new form** | **D's 'roc-opening' is a real state framed from a spot ordinary play doesn't put you on during it.** | Question (1). The fight begins at the south-west landing (−12.7, −177.3), 12.7 m west of and 2.4 m below D's eye, with ~3.1 s of walking to D against a 1.5 s take-off. Retries skip the take-off (`rest` not reset). | Reset `rest = 2` and `takeoff` in the boss script's `reset()`, so "every fight" is true. Then capture the opening as a player gets it: the player at the landing, after the intro's own face-toward. Or, if the mockup's south framing is the design, land the crown bridge at the south (the arena was laid out for a south entrance) and re-check the route. Write the Roc's state, time-in-state and the player's spot into `meta.json`. |
| X2 | note (no breach) | **The cluster is one world.** | Question (2): a global layout, clear of l4 and of each other, consistent across the spawn views, h1, the aerials and the clip. | Finish it (finding 4); no placement change is needed for ledger 5. |
| X3 | **should-fix (no narrowing; a false claim hides a round-8 regression)** | **h3 was turned 82° away from the high step.** | Round 8's camAt dir was (−0.646, 0.174, −0.743). The step from h3's eye (−3, −56) is at bearing (−61, −70), unit (−0.657, −0.754), so round 8 faced the step exactly, with the windmill pine in front (round 8 X3). aa6c1080f flipped the yaw +41 → −41; camAt is now (+0.646, 0.174, −0.743), north-east. h3 now frames the mill's sails and a cluster crag; no step, no winch, no updraft. `PINES` is unchanged, so the pine still blocks the windmill→step sightline in the game. | Revert h3 to yaw +41 (it was right) and move the pine at windmill offset (−10.5, 1) off the updraft line, as round 8 asked. Re-check h3 shows the step and the updraft frame. |
| X4 | note (process) | **The play run** | One load and the real player physics. Each leg's `spawn()` re-places the player where the last leg ended (0.1–0.4 m: no-op teleports). The 4.2 m move after the winch is the quest's own `REWARD_VIEW`, which is game behaviour. 0 stuck; the winch is raised with E. But the run also sets `world.animals.calm = true`, which neither the README nor efca93202 declares, and stages 'quest-winch' (three quest steps skipped, as declared). It ends 11.3 m from the crown's centre and does not record where the fight began. | Declare `calm`, or drop it. Log the player's position and yaw at the boss's `begin`; that number answers X1. |
| X5 | note (global, allowed; repeated) | **The meadow glow was cut against D's near patch.** | A and proposal B moved away from their mockups (see Measured), as ab1d17244 did in round 8 the other way round. | Check all five patches before a global meadow change. |
| X6 | ok | **The cameras, HUD, phone tier and errors** | No `mock-*` camAt moved; D's stage and settle are named. Phone tier and baseline HUD, 0 page errors. h4 is unchanged apart from the Roc being out of its frame. | — |

## Findings, ranked by score gained

1. **Repeated, partly closed: D's Roc in the mockup's pose, with a clean finish** (D, x 0–0.7, y 0.1–0.45).
   - **Done:** the colour and the mass are right now.
   - **The pose:** the frame catches the take-off's upstroke side-on. The mockup is the bird coming at the camera with
     both wings flat and spread and the talons forward. Hold the soar pose (wings level) through the take-off's glide
     instead of a beat, and bring the talons down in it.
   - **The texture:** the wing texture breaks into blocks at phone size. Check its mipmaps and filtering, or its
     resolution.
   - **The geometry:** close the flank seam (the pale line x 0.2–0.5, y 0.44), and hide or remove the cone-facet shards at
     the tail (`wing()`'s 4-sided cones).
2. **Regression: D's hot band** (D and h4, x 0.3–0.9, y 0.5–0.6).
   - **Evidence:** 16.6 % over 230 against the mockup's 3.3 % (round 8 8.7 %); the band 11.6 % against 5.2 %. Global, since
     h4 moved the same way.
   - **Fix:** find which of this round's changes lit the cloud sea between the stones (the sky dome's lift in `sky.ts`
     is the only global sky change), and take it back to round 8's level or lower.
3. **Regression: A's meadow and proposal B's foreground went darker and flatter** (A x 0–0.6, y 0.66–0.84; proposal B
   x 0–0.45, y 0.62–0.84).
   - **Evidence:** A p90 93 against 122 (round 8 110), sd 22.8 against 34.1; proposal B p90 78 against 154.
   - **Fix:** give back the lit tips that A lost: the round-8 glow factors (1.4 / 0.7) in A's band. Cut the glow only
     where D's and C's near strands face the sun close to the camera. Re-measure all five patches, not one.
4. **New: the cluster's finish** (A x 0.1–0.75, y 0.18–0.33; the same crags in B, C and proposal B).
   - **Evidence:** pale, flat mesas with bald grass caps, 1–3 pines each, smooth banded sides and a few drips. o1's sd is
     22 against 43, its hp 5.5 against 8.9.
   - **Fix:** use the layered crag keel for all three, with dense hanging roots. Give them wooded tops, as mockup A's are.
     Take the haze down on these near isles, so they read back-lit and dark-edged rather than pale.
5. **Repeated: the sky.** C's upper sky is 111/133 against 165/190, still lavender. B's and C's suns are still at x 0.40 and
   0.42, against their mockups' edges.
   - **Fix:** lift and warm the dome from about 8° up, not only above 18°. The new smoothstep barely touches the frames.
6. **Repeated: D's floor is inverted** (D x 0–0.45, y 0.70–0.74): 39 against 74.
   - **Fix:** light the sward round the dais. Break the dais's pale, flat face into worn stone, as mockup D's is.
7. **Process: put h3 back on the step and move the pine** (X3).
8. **Process: X1's capture and the `rest` reset.**
9. **Repeated: the fan in C** (about half the mockup's leaf, upright) and **the rocks and daisies** in A, B, C and D's
   foregrounds.

SCORE sky-reach: 6.4
