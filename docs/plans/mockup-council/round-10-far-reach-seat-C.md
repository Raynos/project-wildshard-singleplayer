# Round 10, seat C, Sky Reach only (red team)

Surface:
- The Sky Reach section of `art/mockup-council/round-10/README.md` and the five `far-reach-*.jpg` sheets.
- The capture `progress/far-reach/20261003-0516-750b533a/`: every `mock-*` view, h1–h4, both aerials, `first-frame`,
  `clip.mp4` at 1 fps and `meta.json`. Round 9's `20261003-0447-d3eefd5c/` beside it, and the five ledger mockups at full
  resolution.
- `git show` of 9b96cccdf, 750b533af and c264911bb. The capture-time code: `species/stormRoc.ts` (`ROC_TAKEOFF`, `restart`,
  `stageOpening`, `think`, `act`), `combat/stormRoc.ts`, `src/engine/ai/BossBrain.ts` (arm, reset, intro, begin),
  `layout.ts` (`CROWN`, `DAIS`, `STEP`, `WINCH`, `FALLEN_BRIDGE`, `PINES`), `world/skyIsles.ts`, `world/skyIsleHd.ts`,
  `look/render.ts`, `look/sky.ts`, `world/meadow.ts`, `weapons/WarFan.ts` and `art/far-reach/progress/cameras.json`.
- `art/far-reach/round-22-council-tools/playrun.mjs` and `playrun-result.json` (round 9's and round 10's).

Method:
- Every image is resized to 780×1688 with no grading. Brightness is Rec. 709 luminance. "hp" is fine detail: the standard
  deviation of luminance minus a 1.5 px Gaussian blur of itself.
- Regions are fractions of the frame (x left→right, y top→bottom, HUD included). They are round 9 seat C's patches, so the
  rounds compare directly. **One change:** the fan now covers x 0.43–0.89, y 0.58–0.83 in every view, so I cut the
  ground patches to x ≤ 0.38. That keeps the leaf out of the numbers (the round-9 patches now take it in).
- World positions are projected through each shot's `camAt` (vertical FOV 72°, horizontal half-angle 18.6°).

The round has real gains. The cluster crags are larger, darker and more ragged. The keeper waves from the elbow. The upper
sky is up 20–30 in A, B and C. The glare between D's stones fell by a third. A's meadow highlights are back. There are
three costs. The meadow-glow revert pushed C's verge and D's near grass far brighter than their mockups. The bigger fan
covers about half of D's dais. The Roc's 4 s take-off is a gameplay number chosen to fit the D camera.

## Measured (mockup / round 9 / round 10)

| Patch | Mockup | Round 9 | Round 10 | Reading |
|---|---|---|---|---|
| A meadow, fan-free x 0–0.38, y 0.66–0.84: p10/p50/p90; sd; hp | 39/61/109; 30.9; 15.3 | 39/60/92; 22.8; 11.0 | **43/69/110; 27.8; 13.3** | the highlights are back (p90 matches); the median is 8 high |
| B meadow, fan-free: p10/p50/p90; sd; hp | 38/66/128; 36.3; 15.9 | 43/67/108; 26.0; 12.5 | 48/**80**/129; 32.2; 15.1 | p90 matches; the median is now 14 high |
| C verge x 0.05–0.38, y 0.77–0.85: p50; chroma | 66; 46 | 82; 66 | **97; 78** | **regression**: half the round-9 gain is gone, and it overshoots further |
| D near grass x 0–0.38, y 0.74–0.84: p50; chroma | 55; 35 | 76; 63 | **99; 79** | **regression**: 1.8× the mockup |
| Proposal B foreground x 0–0.4, y 0.62–0.84: p50 / p90; hp | 67 / 157; 10.8 | 52 / 78; 9.1 | 59 / **93**; 11.1 | better, but still 60 % of the mockup's highlights |
| D between the stones, fan-free x 0.3–0.6, y 0.5–0.57: % > 230 | 4.9 | 24.3 | **15.2** | down a third; still 3× the mockup |
| D band y 0.45–0.57, full width: % > 230 | 7.9 | 16.6 | 11.6 | the same direction |
| h4 between the stones, same patch: % > 230 | — | 32.5 | 19.1 | global, as D shows |
| Upper sky x 0.2–0.6, y 0.04–0.09: p50 (A / B / C) | 141 / 143 / 165 | 127 / 125 / 111 | **146 / 147 / 141** | real lift. A's and B's tops are now warm grey (158,143,149) where the mockups' are cool lavender (117,115,137) |
| C sky x 0.05–0.38, y 0.11–0.18: p50; RGB | 191; 225,185,159 | 133; 161,138,151 | 150; 182,157,152 | +17, but greyer pink than the mockup's peach (chroma 33 against 66) |
| A crag body (game o1 x 0.16–0.34, y 0.255–0.30; mockup x 0.09–0.31, y 0.30–0.36): p10/p50/p90; sd; hp | 107/131/223; 42.8; 8.5 | 110/122/141; 22.2; 5.5 | **80/112/194; 49.4; 7.7** | the spread and detail now match the mockup's crag |
| A under the bridge x 0.25–0.75, y 0.53–0.60: p50 | 108 | 77 | 82 | still dim |
| D floor x 0–0.45, y 0.70–0.74: p50 | 74 | 39 | 44 | still inverted |
| Proposal B sky x 0.18–0.82, y 0.17–0.33: chroma | 26 | 81 | 78 | still orange |
| Fan leaf (teal), share of the frame | A 1.1 · B 2.0 · C 3.7 · D 0.35 · proposal B 1.6 % | 1.8 % every view | **2.3 % every view** | bigger everywhere; D's mockup has almost none |

## Scores

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-11-review/mockup-A-spawn-look` → `mock-A-spawn-look` | **7.0** (round 9: 7.0) | 1. **The cluster (x 0–1, y 0.17–0.42) is closer but still three separate mesas.** It is larger and lower, with ragged keels, drips and a faint gold rim, and the crag body now has the mockup's spread (sd 49 against 43). But each crag is a flat lawn cap with 1–3 cone pines in a tidy row. The mockup has one overlapping clump of wooded, sunlit rock, with dense root curtains and the sun glowing under it. 2. **The meadow (x 0–0.38, y 0.66–0.84):** the highlights are back (p90 110 against 109), but it is tall straw with 4–5 daisy dots. The mockup's three grey boulders and daisy drifts at the lower left are missing. 3. **The middle band (y 0.45–0.65)** is still dim: under the bridge 82 against 108. The mill is a white stone tower. The larger fan now reaches the near-right deck and the right post's base (x 0.43–0.9, y 0.58–0.84), where the mockup's smaller fan sits at x 0.63–1. |
| `round-18-council-mockups/mockup-B-quest-start-painterly` → `mock-B-quest-start` | **6.5** (6.5) | 1. **The keeper (x 0.13–0.27, y 0.49–0.62) now waves from the elbow,** with the hand beside his head as the mockup has it. That is a verified gain. He is still about 60 % of the mockup's height, and the arm reads stiff. 2. **The foreground (x 0–0.6, y 0.62–0.86)** is tall golden straw, now too bright (p50 80 against 66). The mockup's lit grey stones and short daisy meadow are dark lumps or absent. The fan covers the lower-right quarter, where the mockup shows only a cropped corner of it. 3. **The sky (y 0.15–0.45).** Under the lead's ruling I score the cluster's finish, not its presence: it is better (darker, ragged, rimmed) but still the same flat mesas. It now fills more of the open warm cumulus the mockup has. |
| `round-18-council-mockups/mockup-C-hands-fan-painterly` → `mock-C-hands-fan` | **6.5** (6.0) | 1. **The fan (x 0.43–0.89, y 0.58–0.82) is now the mockup's size, but in the wrong place and shape.** It is low, partly under the GUST button, and opened to a near-semicircle. Its guard sticks run past the leaf to a disc and a diamond. The mockup's leaf sweeps across the middle of the frame (x 0.33–0.98, y 0.48–0.73) in a ~110° arc, with metal caps, a long red tassel and a gloved forearm. The game shows only a fist at the right edge (x 0.9–1, y 0.73–0.77). 2. **The sky (y 0.05–0.45)** is up 30 (141 against 165) but greyer pink, not peach. The sun is behind the mill (x 0.42), not at the left edge. The cluster fills the space over the mill (finish judged, as in B). 3. **The verge (x 0.05–0.38, y 0.77–0.85) regressed:** 97 against 66 (round 9 82), straw with no rock or flowers. The near post is still about twice the mockup's width. |
| `round-11-review/mockup-D-crown-arena` → `mock-D-crown-arena` (staged `roc-opening`, settle 3.3 s) | **6.5** (7.0) | 1. **The Roc (x 0.05–0.95, y 0.27–0.38) now has its wings spread level under the bar, but it flies away from the camera.** You see its back and dangling feet, with no head, and it is a thin band about a third of the mockup's height. The mockup's eagle comes at the camera, head turned and talons forward, with broad wings spanning y 0.16–0.42. A patchy left wing and a pale seam on the body remain. 2. **The fan now covers about half the dais and the two right stones' bases (x 0.43–0.89, y 0.58–0.83).** Mockup D shows only a sliver at the right edge (0.35 % teal). The near grass doubled the mockup's level (99 against 55). 3. **The light (y 0.45–0.6):** between the stones 15 % over 230 against 5 % (round 9 24 %), a real gain but still a hot wash. The storm is still a violet spiral, and the floor behind the dais is still dark (44 against 74). |
| `round-1-proposals/B-sky-reach` → `mock-proposal-B` | **6.0** (5.5) | 1. **The sky (y 0.05–0.5)** is still orange (chroma 78 against 26). The cluster's mesas hang across the top, where the proposal's isles hang at mid-height either side of the mill, and the big manta with its wake is absent. 2. **The destination (x 0.1–0.9, y 0.35–0.55)** is still a wide flat shelf with five cone pines and a white tower, against a narrow rooted spur. 3. **The foreground (x 0–0.45, y 0.62–0.84)** is better (p90 93 against 157; round 9 78), but still an unlit field rather than a sunlit crest with daisies. The bigger fan now matches this mockup's fan in size and place: the one view the new hold helps. |

**Seat score, Sky Reach: (7.0 + 6.5 + 6.5 + 6.5 + 6.0) / 5 = 6.5** (round 9, this seat: 6.4).

## The three questions

**(1) The 4 s take-off: real play, but stretched to suit the shot. And the 3.3 s frame is not what an ordinary entry
sees.**

- **What the code does** (9b96cccdf):
  - `ROC_TAKEOFF` went from 1.5 s / 2.5 m/s / 4 m to 4 s / 1.6 m/s / 5 m.
  - `think` now holds the first rest to `max(rest, 4.5)`, so the first stalk starts 4.5 s after `begin`. With the boss's
    1.5 s intro (input locked), that is about 6 s from crossing r = 18 m to the first approach.
  - `restart()` resets `rest`, `takeoff` and `wasFighting`, and `combat/stormRoc.ts` `reset` calls it. BossBrain's arm
    path runs `script.reset` before every intro, so round 9's retry bug is fixed in code.
- **Is it plausible boss behaviour?** As pacing, yes. A 6 s opening beat is ordinary for a boss, and it is global: every
  first fight and every retry gets it. So it is real play, not a screenshot trick, and not a void.
- **But the number serves the camera, not the player.**
  - The code comment gives the reason: "the fight starts at the bridge landing; a player walks into the arena's view in
    ~3.1 s".
  - A player at the landing already sees the take-off: the intro turns them to the dais, and the perch is 8.6° left of
    their axis.
  - The 3.1 s is the walk from the landing (−12.7, −177.3) to D's spot (0, −176) on the crown knoll: 12.7 m east and up
    2.4 m. Only the D camera needs that walk.
  - And a 19 m eagle moving at 1.6 m/s for 4 s is a hover, not a take-off.
- **The 3.3 s frame needs a beeline.** At the play run's ~4.2 m/s the walk takes 3.0 s, with no time to turn, so the
  player must head due east up the knoll the instant the intro ends. The builder says the look holds from 3.0 to 3.7 s.
- **Ordinary entry goes elsewhere.** The play run's own route goes to (−6.6, −180.6), toward the dais, not to D's spot.
  From the landing or that route, facing the dais, the sun is 41° off-axis and out of frame. The Roc flies north, away
  from every entry: the frame shows its back.
- **Ruling: should-fix, repeated in a new form (round 9 X1), not void.** The state is real and reachable. The spot is
  reachable by a deliberate sprint. Stretching boss timing to fit a camera is the pattern ledger 5 exists to catch,
  although this instance leaves no frozen pose and no regression worse than a slower opening.

**(2) h3: it faces the step again. The pine move is sensible; the l1 move only swapped sides.**

- **The camera is fixed.** camAt dir is back to (−0.646, 0.174, −0.743), and the step's bearing from (−3, −56) is
  (−0.657, −0.754), so the step sits at the crosshair. The README is right that this reverses aa6c1080f.
- **The pine move works.** The windmill pine moved from (−10.5, 1) to (−11.5, 3.5) offset. It now sits 21° off the axis,
  just outside the 18.6° half-frame, and only its crown fills the left quarter. That is a small, harmless move on a
  decorative pine, and no spawn view changed in a way I can see.
- **The l1 move doesn't clear the sightline.**
  - l1 moved from (−42, −92) to (−36, −104). Its bearing from h3 went from 6.2° left of the step to 6.3° right.
  - At 58 m it now covers about x 0.42–0.94, y 0.41–0.59, in front of the step's right half.
  - The winch at (−60.8, −136.4) projects to x ≈ 0.64 at the deck's height, behind l1's keel (lateral miss ~1 m against
    a keel radius of ~2.8 m at that height).
  - The pixels agree: the step's left half and its hut show at the crosshair, and l1's keel and waterfall cover the right
    half. The fan covers the lower right as well.
- **Ruling:** the turn is fixed. "Out of the step's sightline" is half true, and the step's quest end (the winch and the
  bridge head) is still hidden. Should-fix: move l1 out of ±19° of the step's bearing from h3. It is now on the side the
  winch is on.

**(3) The fan: one hold for every view, verified. Two of the builder's claims about it are not.**

- **One hold, verified.** The leaf, ribs, guard sticks and glove sit at the same pixels in all ten frames (A, B, C, D,
  proposal B, h1–h4, first-frame). `WarFan.ts` has one `HOLD` (scale 0.40 → 0.47, roll 0.8 → 0.95, y −0.172 → −0.205).
  There is no per-view hold, so there is no ledger-5 issue.
- **"D's dais stays clear" is false.** The leaf covers x 0.43–0.89, y 0.58–0.83 in D, about half the dais and the bases of
  the two right stones (round 9 covered about the right third). h4 got the same.
- **"A's bridge stays clear" is about as true as in round 9.** The fan still reaches the near-right deck, and its diamond
  guard end now overlaps the right post's base.
- **The trade is the real problem.** The mockups conflict. Four of the five (A, B, D, proposal B) hold the fan at the
  right edge, at or below proposal B's size, and D nearly off-frame. Only C wants it large. The new hold helps C and
  proposal B, and costs D.

## The builder's claims, checked

| Claim | Verdict | Evidence |
|---|---|---|
| The crown's cloud bank on its own seed cuts D's glare | **direction verified** | Between the stones (fan-free) 24.3 → 15.2 % (mockup 4.9); h4 32.5 → 19.1 %. The README's "10.0 → 12.6 %" reads as a rise; I can't reproduce a god view. Side effect: in `aerial-overview` the crown deck is now veiled by lit puffs (it read clearly in round 9) |
| The meadow's glow is back to round 8's | **verified in code (1.4 / 0.7); a see-saw in the pixels** | A and B's p90 are back to the mockups'. C's verge goes 82 → 97 (66) and D's near grass 76 → 99 (55): the round-9 gains on C and D are undone, as round 9 seat C predicted |
| The cluster is larger and lower, darker, with gold rims and lighter haze | **verified** | o1 (−30, −148, r 13), o3 (−4, −170, r 14), o4 (20, −150, r 11); A's crag sd 22 → 49 (mockup 43), cluster p10 109 → 86. The rim is faint. The caps are still flat lawns with cone pines |
| One fan hold for every view; A's bridge and D's dais stay clear | **one hold yes; "clear" false for D** | Question (3) |
| The high sky is warmer and lighter (C 141 → 152) | **verified, larger than claimed on my patch** | C 111 → 141 (165) and 133 → 150 (191). Its colour is grey pink, and A's and B's cool lavender tops turned warm grey |
| The keeper waves from the elbow | **verified** | The forearm is raised beside the head (B x 0.13–0.18, y 0.50) |
| The play run has creatures live, 0 stuck, the same times | **verified** | `calm = false`, declared in a comment; legs 16.48 / 5.54 / 3.46 / 17.66 s against round 9's 16.51 / 5.55 / 3.46 / 17.64; 0 stuck. It still logs no position at the boss's `begin` (round 9 X4) |
| README: "the stage code didn't change" / "Commits touching staging code: none" | **false** | 9b96cccdf edits `stageOpening` (`this.rest = ROC_TAKEOFF.seconds + 0.5`). It matches what `think` now does in play, so it is no breach, but the generated list missed it |
| README: the generated changes list "covers every shot" (only mock-D's settle) | **incomplete** | h3's cameras.json yaw −41 → 41 and its camAt dir x −0.646 ← +0.646 are not in the generated list; only the hand-written paragraph names them |

## No-shortcut audit (ledger 5)

| # | Severity | What | Evidence | Fix |
|---|---|---|---|---|
| X1 | **should-fix (borderline), repeated in a new form** | **Boss timing stretched to fit D's camera.** | The take-off went 1.5 → 4 s and the first rest waits for it, with the walk to D's spot as the code's stated reason. It is real and global (every fight, retries included), so not a void. But the 3.3 s frame needs a zero-hesitation sprint east up the knoll, which the play run's own route doesn't take. | Capture the opening where a player is at 3.3 s on the play run's route (about (−8, −179), facing the dais after the intro), or land the crown bridge at the south, which crown.ts's "opposite the entrance" layout implies, and re-check the route. Then set the take-off for the fight, not the camera. Log the player's position and time at `begin` in the play run and in `meta.json`. |
| X2 | should-fix (process) | **The round README's generated lists missed two changes.** | `stageOpening` changed in 9b96cccdf ("staging code: none"); h3's re-aim is missing from "covers every shot". The same kind of miss as rounds 3–4. | Generate the staging list from every edit to a `stage*` function or a function it calls, and the camera list from a cameras.json diff plus a camAt diff for every shot, hero views included. |
| X3 | should-fix | **h3's sightline: l1 swapped sides of the step instead of leaving it.** | Question (2): l1's keel hides the winch side of the step. | Move l1 beyond ±19° of the step's bearing from h3, then check h3 shows the winch and the bridge head. |
| X4 | note (no breach) | **One fan hold.** | Pixel-identical in all ten frames. | — (the placement trade is finding 2) |
| X5 | note (ruled) | **The cluster grew for mockup A.** | The lead's ruling covers its presence in B, C and proposal B. It now fills more of those skies. o3's keel tip hangs about 2 m above the eye just behind D's spot, out of D's and h4's frames. | No ledger-5 action. The lead may want to weigh the bigger B and C sky cost against the ruling. |
| X6 | ok | **The cameras, HUD, phone tier, errors** | No `mock-*` camAt moved; the staged shots are declared; the baseline HUD is unchanged; 0 page errors; 30 fps chip in every frame. The clip's orbit shows one consistent world. | — |

## Findings, ranked by score gained

1. **Regression, repeated see-saw: the meadow glow** (C verge x 0.05–0.38, y 0.77–0.85; D near x 0–0.38, y 0.74–0.84; B
   meadow).
   - **Evidence:** C 97 against 66, D 99 against 55, B p50 80 against 66, while A's and B's p90 now match.
   - **Fix:** stop tuning one global factor against one view. Keep 1.4 / 0.7 where A's p90 matches, and give the crown's
     sward and the near strands in front of the camera their own, lower glow. Re-measure all five fan-free patches before
     you commit.
2. **New: the fan hold traded D for C** (D x 0.43–0.89, y 0.58–0.83; all views).
   - **Evidence:** one hold, 2.3 % of the frame everywhere. Mockup D 0.35 %, A 1.1 %, B 2.0 %, proposal B 1.6 %, C 3.7 %.
     Half of D's dais is hidden.
   - **Fix:** size and place the one hold for the majority: pivot at the lower-right corner, leaf opening up-left from
     about x 0.55, at about proposal B's size. That frees D's dais and A's bridge, and C stays about where round 9 had it.
     In C's frame, close the gap that remains through shape: a ~110° leaf arc instead of a semicircle, guard caps at the
     leaf's edge, and the tassel.
3. **Repeated: D's Roc pose** (D x 0.05–0.95, y 0.27–0.38).
   - **Evidence:** the wings are level now, but the bird flies away (back, no head, a thin band about a third of the
     mockup's height). The mockup's eagle comes at the camera.
   - **Fix:** make the take-off turn toward the arena's entrance before it heads for its lap, so the opening shows the
     head and breast, the way the perch already faces south (`yawTo(DAIS.z + 40)`). Fix the patchy left wing and the body
     seam.
4. **Repeated, partly closed: D's glare** (x 0.3–0.6, y 0.5–0.57): 15 % against 5 %. Thin or dim the bank's lit puffs
   nearest the sun's azimuth behind the stones.
5. **Repeated: the cluster's caps** (A x 0–1, y 0.17–0.42). The keels are close now; the tops are not. Use bushy, uneven
   wooded tops and overlap the three into one clump, as mockup A does, instead of three flat lawns with cone pines in a
   row.
6. **Repeated: the foreground props.** No boulders or daisy drifts in A, B, C and D (the lower-left of each). Proposal B's
   crest is still unlit (p90 93 against 157).
7. **Repeated: the sky's colour.** C's sky is peach in the mockup and grey pink in the game. A's and B's zenith should stay
   cool lavender. Proposal B is still orange (chroma 78 against 26).
8. **Process:** X1's capture and `begin` log, X2's list generator, X3's l1 move.

SCORE sky-reach: 6.5
