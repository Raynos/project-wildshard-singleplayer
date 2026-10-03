# Round 8, seat C, Sky Reach only (red team)

Surface:
- The Sky Reach section of `art/mockup-council/round-8/README.md` and the five `far-reach-*.jpg` sheets.
- The full-res capture `progress/far-reach/20261003-0402-185b6810/`: every `mock-*`, h1–h4, both aerials, `clip.mp4` at 0.5 fps,
  and `meta.json` (`camAt`, `staged`, `active`, `pageErrors`).
- Round 7's `20261003-0250-1c2c026e/` beside it (mockup | round 7 | round 8), and the five ledger mockups at full resolution.
- Code at the capture: `skyIsles.ts` (2e2327f04), `plugin.ts` 'roc-lap', `species/stormRoc.ts` (`stageLap`, `think`, `act`),
  `combat/stormRoc.ts` (the boss script), `layout.ts` (`ROC`, `DAIS`, `CROWN`, `PINES`, `FALLEN_BRIDGE`), `world/isle.ts`
  (the keel profile), `world/meadow.ts`, and `art/far-reach/progress/cameras.json`.
- `git show` of 0cd1ecbbf, 9577ce703, 5bca51f01, 2e2327f04, fd20fba69, b038ab03d, 7ecff9410, ab1d17244 and 185b6810e.
- The route evidence `art/far-reach/round-22-council-tools/route.mjs` and `route-result.json`.

Method:
- Every image is resized to 780×1688 with no grading.
- Brightness is Rec. 709 luminance. "hp" is fine detail: the standard deviation of luminance minus a 1.5 px blur of itself.
- Regions are fractions of the frame (x left→right, y top→bottom, HUD included).
- Isle positions on screen are projected from `skyIsles.ts` through each shot's `camAt` (vertical FOV 72°, aspect
  780/1688, so the horizontal half-angle is 18.6°). The projections land on the isles in the pixels.

The meadow is the round's real gain. Dropping gamma and changing the tuft atlas gave A's foreground back its spread and
fine detail, the rises are grassed, and the bridge ties are open. Two of the round's other claims don't hold in the pixels:

- **The cluster crags.** 2e2327f04 says the crags "show in A and stay out of B and C". They stand in the upper left of
  **all four** spawn views. The builder measured from B's and C's **right** frame edges, not their left ones.
- **The Roc.** Its staged frame is a rest lap at a point that no rest reaches while the player stands on that spot.

## Measured (mockup / round 7 / round 8)

| Patch | A | B | C | D | proposal B |
|---|---|---|---|---|---|
| Play y 0.05–0.85: L p99; % > 230 | 240/239/238; 2.2/2.8/2.5 | 242/239/236; 2.4/2.7/1.9 | 236/240/237; 1.9/2.9/2.1 | 242/241/238; 2.9/4.3/2.5 | 239/242/239; 3.8/4.4/3.1 |
| Subject band y 0.45–0.65: L p50 | 87/74/**69** | 92/83/**74** | 81/111/107 | 159/178/176 | 122/73/**61** |
| D band y 0.45–0.65 % > 230; between the stones x 0.3–0.9, y 0.5–0.6 | | | | 5.2/13.6/**8.2**; 3.3/12.6/8.7 | |
| x 0.25–0.75, y 0.53–0.6: L p50 (A under the bridge; P keeper ground) | 108/81/**77** | | | | 106/67/**42** |
| Ground x 0.03–0.38, y 0.68–0.82: L p10/p50/p90; spread; hp | 38/60/108; 70; 16.4 → 58/71/87; 28; 5.4 → **46/71/114; 67; 13.9** | 40/66/126; 87; 17.1 → 48/67/95; 47; 7.0 → **34/54/83; 49; 5.3** | 38/72/137; 99; 17.9 → 36/91/137; 101; 12.6 → 33/89/142; 109; 16.0 | 35/62/127; 92; 16.8 → 40/61/99; 60; 9.3 → **26/65/138; 112; 14.8** | 35/57/112; 77; 12.4 → 52/72/97; 45; 8.5 → 44/66/99; 56; 11.9 |
| Ground median RGB | 70,60,31 / 79,73,25 / 86,72,26 | 76,65,39 / 73,69,23 / 66,52,34 | 85,71,35 / 102,93,30 / 111,88,36 | 71,61,34 / 68,64,15 / 80,64,28 | 62,58,30 / 76,76,17 / 80,66,24 |
| C verge x 0.05–0.65, y 0.77–0.85: p50; hp | | | 67; 16.8 / 90; 12.7 / **94; 17.1** | | |
| Upper sky y 0.05–0.25: L p50; chroma | 166; 47 / 156; 42 / **143; 41** | 161; 32 / 150; 36 / **138; 36** | 170; 47 / 130; 31 / **119; 31** | 81; 22 / 71; 31 / **59; 31** | 159; 20 / 180; 72 / 163; 62 |
| Sky patch x 0.18–0.82, y 0.17–0.33: chroma | 74/78/70 | 48/74/62 | 62/40/41 | 43/50/53 | **26/105/95** |
| Sun (x, y) | 0.34,0.35 / 0.28,0.38 / 0.28,0.38 | **1.0**,0.42 / 0.40,0.39 / 0.39,0.39 | **0.05**,0.34 / 0.43,0.46 / 0.42,0.46 | 0.23,0.46 / 0.29,0.45 / 0.29,0.45 | 0.24,0.40 / 0.28,0.30 / 0.28,0.30 |
| Roc mid-tones (L 60–90): mean RGB; chroma | | | | 86,71,80; 25 / 108,67,55; 56 / **117,64,51; 70** | |

Readings:
- **A's meadow is back.** Its spread is 67 against 70 and its fine detail 13.9 against 16.4; round 7 had 28 and 5.4.
- **B and proposal B got darker in the same round.** B's ground p50 is 54 against 66, with hp 5.3. Proposal B's subject
  band is 61 against 122 (round 7: 73), and its keeper ground 42 against 106. ab1d17244 tuned the meadow's lit factor
  to A's patch, and the views that were already short of their mockups lost more.
- **The upper sky darkened by 11–13 in every view,** away from every mockup. fd20fba69 claims it is "warmer high", but
  its chroma did not move.
- **D's halo is real progress:** 13.6 % → 8.2 % against 5.2 %.

## Scores

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-11-review/mockup-A-spawn-look` → `mock-A-spawn-look` | **7.0** (round 7: 6.5) | 1. **The isle cluster (x 0.05–0.9, y 0.17–0.42): partly back.** One crag (`o1`, with `o3` behind it) hangs at the upper left (x 0–0.3, y 0.21–0.35) with a fall. The mockup's four overlapping rooted crags arch over the mill with the sun under their middle. The game's sun (x 0.28, y 0.38) sits in open cumulus, unframed. 2. **The meadow (x 0–0.65, y 0.64–0.86): much closer.** Tall backlit blades with dark gaps replace round 7's lawn; colour R−G 14 against 10. It is still uniform straw from edge to edge. The mockup's three grey lichen boulders at the lower left (x 0–0.3, y 0.7–0.85) are missing, and so are its daisies set in the grass. 3. **The middle band (x 0–1, y 0.45–0.65).** It is darker than round 7 (p50 69 against 87; under the bridge 77 against 108) now that gamma 1.15 is gone. The mill is still a white stone tower with lattice sails, against warm stone and canvas, and the keel a pale wall. The bridge's sides are open now (ties every 2.5 m): a gain. |
| `round-18-council-mockups/mockup-B-quest-start-painterly` → `mock-B-quest-start` | **6.0** (6.5) | 1. **A crag cluster now hangs over the keeper's sky (x 0.1–0.45, y 0.25–0.38), a regression.** `o1` and `o3` project to x 0.10–0.41, y 0.25–0.37 here, and they are in the pixels. The mockup's sky there is open cumulus. 2. **The foreground (x 0–0.6, y 0.6–0.86).** A huge boulder fills the lower left (x 0–0.38, y 0.68–0.86), close to the camera. It is real grey rock with moss patches now (a material gain), but the mockup has two small lit stones in the grass. The ground went darker (p50 54 against 66) and smoother (hp 5.3 against 17.1). There are no daisies. 3. **The keeper's set and the light (x 0–1, y 0.3–0.6).** The keeper, the box lectern and the white mill are unchanged. The sun is at x 0.39; the mockup's floods in from the right edge. |
| `round-18-council-mockups/mockup-C-hands-fan-painterly` → `mock-C-hands-fan` | **6.0** (6.0) | 1. **The fan (x 0.5–1, y 0.55–0.8), unchanged.** It is about half the mockup's area, upright at the right edge, where the mockup's sweeps diagonally across the middle with a long tassel. 2. **The sky (y 0.05–0.5), worse.** The upper sky darkened to p50 119 (mockup 170, round 7 130) and is still cool lavender (chroma 31 against 47). The sun is at x 0.42, behind the mill, against the mockup's left edge. The new crags (x 0.08–0.40, y 0.32–0.43) are larger and higher than the mockup's small edge isle (x 0–0.1, y 0.4–0.45). 3. **The foreground (x 0–1, y 0.74–0.86).** Tall blades now match the mockup's detail (hp 17.1 against 16.8), but the verge is hotter and more orange (p50 94 against 67; median 114,93,38 against 77,66,34). The lower-left rock and the flowers are missing. |
| `round-11-review/mockup-D-crown-arena` → `mock-D-crown-arena` (staged `roc-lap`, settle 1.5 s) | **6.5** (6.5) | 1. **The Roc (x 0.3–0.9, y 0.2–0.33).** The bird is now in side profile, flying right with a slight bank and its head turned, and the LOCK and the target marker are present (round 7's 60 ms frame had neither). But its raised-V wings read as one thin dark slab with the far wing hidden. Its span is about 0.6 of the width against ~0.96, it shows no underwing and no talons, and it is rust and near-black (mids 117,64,51, chroma 70), not slate (86,71,80, chroma 25). The mockup's eagle fills the upper third in a ¾ view, spread wide. On the staging, see X1. 2. **The light (y 0.05–0.65).** The halo is smaller (8.2 % over 230 against 5.2 %; round 7 13.6 %), a real gain. The storm is a violet/white spiral, where the mockup's is smoky slate with a bolt (the stage's bolt fires 1 s before the frame). The upper sky is darker (59 against 81). 3. **The arena floor (y 0.62–0.86).** The dais rim is fractured into blocks (a gain), but its face is pale and flat, and the runes are still pale spirals. Two small dim grey rocks sit at x 0–0.17, y 0.71–0.77, where the mockup has lit lichened boulders. A dark shrub mat lies before the dais (y 0.66–0.74), with tall straw below. The mockup's floor is lit grass with flowers. The fan covers the dais's right third. |
| `round-1-proposals/B-sky-reach` → `mock-proposal-B` | **5.5** (5.5) | 1. **The sky (y 0.05–0.5).** It is still saturated orange (sky patch chroma 95 against 26). Round 7's bolt over the mill is gone, a gain. The new crag cluster sits high at the upper left (x 0.05–0.3, y 0.17–0.29), while the mockup's isles hang at mid-height either side of the mill (y 0.3–0.65). There is no manta. 2. **The middle ground (x 0–1, y 0.45–0.65), darker.** The band's p50 is 61 against 122 (round 7: 73), and the keeper's ground is 42 against 106. It is a dark flat field with the keeper in it, where the mockup's crest is lit. 3. **The destination and the foreground.** The isle is a wide flat shelf, about 0.7 of the width, against the mockup's narrow rooted spur. The foreground is straw blades (hp 11.9 against 12.4: close) with mossy lumps on the left, where the mockup has a lit grass crest with daisies falling away to dark rock. As ruled, I don't score the 5 m of deck. |

**Seat score, Sky Reach: (7.0 + 6.0 + 6.0 + 6.5 + 5.5) / 5 = 6.2** (round 7, this seat: 6.2).

## The two questions the README flags

**(1) Is the Roc's rest lap at −2.64 rad, with a 1.5 s settle, a state a player sees in an ordinary fight from that spot? No, not as a rest.**

- **What the stage does.** `stageLap(-2.64)` places the Roc on the 13 m lap at (−11.4, −202.2), at `ROC.y` = 55, sets
  `rest = 2.4` and lets it fly. After 1.5 s at 10 m/s, `angle` has advanced 1.15 rad to about −1.49. The Roc is then at
  about (1, −209): on the lap's far side, 33 m from the camera at (0, −176), heading east.
- **Where a real rest starts.** In an ordinary phase-0 fight a rest only follows a strike (`act`: `rest = 2.4`, then
  `transition('rest')`). The strike is the STOOP: windup 1.2 s, then a dive at 20 m/s onto the player's chest (`chest =
  player + 1.2`). So every rest begins **at the player**, about 10 m below the lap altitude. From there the Roc has
  10 m/s × 2.4 s = 24 m of flight, and it climbs at 9 m/s.
- **Why the staged point is out of reach.** With the player on the camera's spot, the Roc 1.5 s into a rest is at most
  ~15 m from the player and still climbing. The whole 2.4 s can't carry it the 33 m to the far side of the lap.
- **The builder's reason doesn't hold here.** "The 2.4 s rest every fight shows" is true as a state. From this spot it
  shows a bird pulling up and away overhead, not a glide across the far side under the bar.
- **The nearest real moment is the fight's opening.**
  - `begin` sets `fighting`. The Roc leaves its perch on the tallest stone behind the dais and steers toward the lap point
    at `angle` 0 (east) for `rest` = 2 s.
  - It crosses the far side heading right, as staged. But it climbs from the perch (≈ 51 m), not gliding at 55.
  - It happens once: `rest` is never reset on a retry, so it starts at whatever value the last fight left.
  - The player then stands at the bridge landing (about (−10, −180); `inArena` fires there), 10 m west of the camera.
- **The tuning.** θ was tuned through −1.2, −1.45, −1.7, −1.85, −1.95, −2.07 and −2.64, and `ROC.y` through
  +10 → +13 → +11, to place the bird under the bar in this one frame. The changes to `ROC.y` are global (gameplay
  altitude), so they are allowed.
- **Ruling: should-fix (borderline), not void.** The look is the Roc's real flight: the soar, the bank and the LOCK
  marker. The pose is a plausible match for the real opening. But the state the frame is justified by is not one this
  spot produces.

**(2) Is A's cluster at headings −12/−16 a world that holds up, or a composition only for the mock cameras?**

- **It is real geometry: no breach.** It is one global layout, not a per-view switch, and it shows in h1, both aerials and
  the clip.
- **It is placed by frame edges, and the placement is wrong.**
  - B looks 4.0° left (dir x −0.07), so its frame spans 22.6° left to 14.6° right. C's spans 23.6° left to 13.6° right.
  - The "−14.6 / −13.6" in the commit are their **right** edges. The crags are at 12–16° **left**, inside both frames.
  - Projected through `camAt`, `o1` and `o3` cover B at x 0.10–0.41, y 0.25–0.37 and C at x 0.08–0.40, y 0.32–0.43.
    Both views show them there.
  - So the property the layout was built for (in A, out of B and C) fails. B, whose mockup keeps that sky open, regresses.
- **It holds up only from the captured angles.** The aerials read it as a tight three-isle cluster with `l4`. In plan,
  though, `o3` (centre (−46, −168), deck 74, keel 17, tip at y 57) sits 13.9 m from `l4`'s centre (−58, −175), inside
  `l4`'s 15 m rim, and `l4`'s deck is at y 66. By `isle.ts`'s keel profile, `o3`'s keel is about 6.9 m in radius at
  y 66. So it passes down through `l4`'s meadow 7–14 m from `l4`'s centre: the two isles interpenetrate.
  - In `aerial-overview`, `o3`'s keel disappears into `l4`'s deck rather than hanging free.
  - From a side view (a hover flight past the cluster) it would read as one isle skewered through another.
- **And A still lacks its cluster over the mill.** Only one crag shows, at A's left edge (x 0.05–0.29).

## The builder's claims, checked

| Claim | Verdict | Evidence |
|---|---|---|
| Meadow: A's patch 49/72/110, spread 61, hp 13.4 (mockup 40/61/105, 65, 12.4) | **verified for A** | My patch gives 46/71/114, spread 67, hp 13.9 (my mockup reads 38/60/108, 70, 16.4 with a 1.5 px blur). But it was tuned to that one patch: B's ground fell to p50 54 (66) with hp 5.3, and proposal B's middle band to 61 (122). |
| The keeper's ring 1.2 m | **verified** | A's lower half is tall sward again. |
| The Roc slate on its emission, 19 m span, soar, 0.35 rad bank | **soar and bank: yes. Slate: no.** | Its mid-tones are 117,64,51 (chroma 70) against the mockup's 86,71,80 (chroma 25), and its darks 43,26,25. The bank shows as a slight roll. The raised V seen side-on makes the wings a thin slab. Its span is ~0.6 of the frame width, not ~0.96. |
| The fan keeps its size | **verified** | Unchanged from round 7. b038ab03d's +8 % was taken back in 7ecff9410. |
| The sun: D's middle band 8 % over 230 | **verified** | 8.2 % (mockup 5.2 %, round 7 13.6 %). |
| The sky "paler low, warmer high" | **paler low: partly. Warmer high: no.** | Mid-sky L fell 12–13 in A and B (toward the mockups), but the upper sky fell 11–13 in every view (away from them), with its chroma unchanged. Proposal B's sky patch is 95 against 26. |
| The dais rim fractured, runes cut stone | **rim: yes. Runes: no.** | The kerb blocks show. The runes still read as pale glowing spirals at phone size. |
| D's rocks 10–13 m out, in frame | **verified, weak** | Two small dark grey rocks at x 0–0.17, y 0.71–0.77, unlit. |
| B's rocks rough grey with sparse lichen | **verified, but oversized** | Real rock texture with moss patches. It fills x 0–0.38, y 0.68–0.86, where the mockup has small stones. |
| The rises grassed | **verified** | `aerial-spawn`: the knoll is textured sward, no longer a dark dome (round 5–7 X6 closed). The clip agrees. |
| Route evidence | **traversable: yes. Ordinary play: partly.** | See X4. |
| Luminance: top 1 % at 235–239; 1.9–3.1 % over 230 | **verified** | y 0.05–0.85: p99 236–239, 1.9–3.1 %. |
| (2e2327f04) The crags show in A and stay out of B and C | **false** | See question (2). |

## No-shortcut audit (ledger 5)

| # | Severity | What | Evidence | Fix |
|---|---|---|---|---|
| X1 | **should-fix (borderline), repeated in a new form** | **D's Roc is staged at a lap point that no rest reaches from this spot.** | Question (1). Each rest starts at the player after a stoop, with ≤ 24 m of flight in 2.4 s, while the staged point is 33 m out. θ and `ROC.y` were hand-tuned across 7 and 3 values for this frame. The look (flight, bank, LOCK) is real, so I don't void it. | Stage the state the spot really produces. Either the fight's opening (`begin`, then ~1.5 s, the Roc lifting off its perch, with the player at the bridge landing where `inArena` fires), or an unstaged fight run by the harness autopilot, taking the frame by a fixed rule (e.g. 1.5 s into the first rest). Write the Roc's state, position, yaw and time-in-state into `meta.json`. Reset `rest` in `reset()`, so the opening is the same on every retry. |
| X2 | should-fix (no narrowing; a false claim) | **A's crags were placed by mock frame edges, and the placement is wrong.** | Question (2): `o1`/`o3` show in B (x 0.10–0.41) and C (x 0.08–0.40); B's mockup sky is open there. `o3`'s keel passes through `l4`'s deck. | Lay the cluster out as a world: no keel through another isle's deck (centre distance > r₁ + r₂ wherever the decks and keels overlap in height). Then evaluate it from A, B, C, proposal B, h1, both aerials and a fly-past. If one sky can't serve A and B, take the trade to the lead as round 7 asked, rather than as a frame-edge calculation. |
| X3 | should-fix (no narrowing; **regression** in a hero view) | **A pine moved for mockup A now blocks h3's view of the step.** | 9577ce703 moved the windmill isle's pine (−11, 3) to (−10.5, 1), i.e. world (−10.5, −63). From h3's camera (−3, −56), heading −41°, it stands 10 m out, 6° off the axis. It fills x 0.1–0.55, y 0.3–0.75 and hides the high step and the updraft's cyan frame, which round 7's h3 showed. That sightline is the route's wayfinding from the windmill isle. | Keep the cluster left of the mill for A, but move that pine off the windmill→step sightline (the updraft's line from about (−7.5, −71) toward (−57, −119)). Re-check h3 shows the step. |
| X4 | partly closed (round 7 X3) | **The route evidence.** | `route.mjs` uses the real player physics (the autopilot holds W toward the waypoints) and ends where it should: the updraft at y 44.2 on the step and the bridge at y 44.0 on the crown, 0 stuck. But each leg teleports to its start: on the board at the windmill rim, and on the step. The bridge is raised by `stage('quest-crown')`, not by working the winch. The "walk baseline 0 stuck" is not in `route-result.json`. It shows the spans are crossable, not an ordinary run of the quest. | Run one leg from the spawn through the keeper, the winch and the crown, with no stage, and save its trace. |
| X5 | note (global, allowed) | **The meadow was tuned to the seats' A patch.** | ab1d17244 hits A's patch closely, and B and proposal B darkened (B ground p50 54 against 66; proposal B band 61 against 122). It is not a shortcut, since the change is global, but optimising to one crop moved two views away. | Check every change on all five views' patches before committing. |
| X6 | ok | The cameras, HUD, phone tier and errors | No `mock-*` camera changed except D's stage and settle (named in the README). D's camAt eye is 47.99 against 48.01. Page errors 0. The rises are grassed (round 7 X6 closed). The bridge ties are thinner. `QUEST COMPLETE` in D/h4 is the bridge quest finished before the fight: plausible. | — |

## Findings, ranked by score gained

1. **Make D's Roc the mockup's bird, in a state this spot produces** (D, x 0–1, y 0.13–0.35; repeated, plus X1).
   - **The pose.** The side-on raised V now hides the wings. Give the soar a flatter dihedral on the lap, so the near
     wing's upper surface and the far wing both read from below. Extend the talons.
   - **The colour.** Take the wings to slate: the mids are 117,64,51 against 86,71,80, so the recolour still misses the
     paint.
   - **The staging.** Re-stage per X1, at the fight's opening.
2. **Put A's cluster where A sees it and B does not, as a real layout** (A x 0.05–0.9, y 0.17–0.42; B x 0.1–0.45,
   y 0.25–0.38; **regression** in B; X2).
   - From the spawn, B's frame covers 22.6° left to 14.6° right, and A's 18.6° either side. So a crag left of the mill
     cannot be out of B. The only A-only band is 14.6–18.6° right; A's top edge, at pitch −3.4°, is lower than B's and
     C's, so there is no A-only band above.
   - Either hang the cluster over and **right** of the sun inside that band, or accept that B shows it and say so.
   - Separate `o3` from `l4` in either case.
3. **Lift B's and proposal B's middle ground back up** (B y 0.6–0.86; proposal B y 0.45–0.65; **regression**).
   - ab1d17244's quarter cut to the lit factor pulled B's ground to 54 against 66, and proposal B's band to 61 against 122.
   - Keep A's spread (67), but raise the lit tips, not the roots, until all three views' patches sit near their mockups.
   - Shrink B's foreground boulder to the mockup's two small stones in the grass (x 0.12–0.32, y 0.67–0.71).
4. **Stop the upper sky darkening, and pale proposal B's** (all five, y 0.05–0.25; **regression**).
   - fd20fba69 left the zenith 11–13 darker everywhere: A 143 against 166, C 119 against 170, D 59 against 81.
   - Proposal B's sky patch is still chroma 95 against 26.
   - Warm and lighten the zenith instead (C's lavender is the worst), and desaturate the band over the destination.
5. **Rocks and flowers the mockups show** (A lower left, three grey boulders; C lower left; D x 0–0.3, y 0.62–0.82,
   lit and larger; repeated).
   - The material is now right (B's boulder), but A has none, and D's are small and unlit.
   - Set daisies down into the straw sward. A's and C's meadows are a uniform straw field.
6. **Unblock h3's sightline to the step** (X3; regression). Move the pine at windmill offset (−10.5, 1).
7. **The fan in C** (x 0.3–1, y 0.5–0.8; repeated). It is about half the mockup's area, upright at the right edge. Change
   the idle hold for everyone toward the mockup's diagonal sweep.
8. **Show the quest route as ordinary play** (X4). Run one unstaged run from the spawn through the winch to the crown.

SCORE sky-reach: 6.2
