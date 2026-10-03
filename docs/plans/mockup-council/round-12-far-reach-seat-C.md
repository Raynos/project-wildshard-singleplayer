# Round 12, seat C, Sky Reach (Claude, lens: red team)

2026-10-03. The bar is 7.0 (ledger 4 as Jake amended it). I score the same way regardless.

Surface:
- The Sky Reach section of `art/mockup-council/round-12/README.md` and the five sheets.
- `progress/far-reach/20261003-0608-591bd5b5/`: all 12 frames, `clip.mp4` (1 fps tiles) and `meta.json`.
- Round 11's capture `20261003-0601-3307e64a`: every frame side by side, the meta diffed.
- The five ledger mockups at full resolution.
- `git show` of 064cf48f8 and 591bd5b5d. Source read at 591bd5b5d: `species/stormRoc.ts`, `combat/stormRoc.ts`,
  `plugin.ts` (`stage`), `layout.ts`, `world/crown.ts`, and the engine's `ai/BossBrain.ts` and `player/Player.ts` (speed).

Method:
- Every image is resized to 780×1688 (Lanczos).
- Brightness is Rec. 709 luminance (L). "hot" is the share of L > 230.
- "hp" is the standard deviation of L minus its 3 px Gaussian blur.
- Regions are frame fractions (x left→right, y top→bottom).
- Foreground crops stop at x ≤ 0.36, clear of the fan, whose left edge is now at x 0.49 (below).
- Cells read mockup / round 11 / round 12.
- The lead's rulings apply:
  - the cluster over the mill is scored on its finish in B, C and P, not on its presence;
  - proposal B's sky is scored on finish, not saturation.

## What changed since round 11

- **Meta:** only the SHA, the label and `loadSeconds` differ. Every `camAt` and the cameras blob are identical, and
  `programs` is still 101.
- **The frames:**
  - D's Roc, now head-on;
  - D's band between the stones;
  - the near meadow in every ground view, darker;
  - the cluster's caps, more firs;
  - the fan, 0.067 of the width further right in every view.
- **Unchanged:** h1-h4, the aerials and the clip, apart from the firs and the meadow. The clip is the same aerial orbit.

## Scores

| Mockup → view | Score | The three biggest differences (region) |
|---|---|---|
| `round-11-review/mockup-A-spawn-look` → `mock-A-spawn-look` | **7.0** (r11 7.0) | 1. **The cluster (x 0–1, y 0.22–0.36)** is still a level row of flat mesas. It now carries picket rows of identical cone firs, each with a bright orange trunk drawn up the front of its crown (finding 3). The mockup's crags have bushy rounded crowns, long root curtains and staggered heights. The band is now darker than the mockup's (p50 174 / 166 / 155). 2. **The meadow (x 0–0.36, y 0.66–0.84)** now matches on median (61.1 / 68.3 / 59.8). But it lost the mockup's lit tips and grain: p90 108 / 109 / 89, hp 20.4 / 18.6 / 14.8, and the nearest rows (y 0.80–0.85) at 58 / 62 / 50. Still no grey boulders, and white daisies at 0.25 / 0.07 / 0.13 %. 3. **The middle band:** the cloud wall under the cluster is still too hot (y 0.36–0.46: 5.2 / 17.1 / 14.1 % hot), and the mill, pines and bridge band is dim (y 0.45–0.65: p50 87 / 72 / 68). The fan is still the big round leaf, now at x 0.49–1.0. |
| `round-18-council-mockups/mockup-B-quest-start-painterly` → `mock-B-quest-start` | **6.6** (6.5) | 1. **The keeper and lectern (x 0.10–0.43, y 0.43–0.64) are unchanged:** a mitten hand, a plain coat, a simple book stand and lantern. The mockup has a scarf, a satchel, layered cloth and an open palm. 2. **The foreground (x 0–0.30, y 0.66–0.85)** is closer in value: p50 61.6 / 77.5 / 64.1, chroma 41 / 67 / 55. But its highlights and grain fell (p90 125 / 127 / 103, hp 21.3 / 20.6 / 15.9). It has no lit grey stones and no white daisies (0.36 / 0 / 0 %). 3. **The sky (y 0.25–0.47), scored on finish:** the shelf of flat caps now carries a continuous row of cone firs across B's open cumulus. |
| `round-18-council-mockups/mockup-C-hands-fan-painterly` → `mock-C-hands-fan` | **6.3** (6.2) | 1. **The fan's hold (x 0.49–1.0, y 0.58–0.86) is still the wrong way round.** The pivot is at the lower left, the leaf opens up and right, and the glove sits apart at the right edge with no tassel. The mockup's pivot is in the glove at the lower right, and its leaf sweeps up-left across x 0.32–0.97. The 2.5 cm shift moves the leaf further from C's central sweep. 2. **The sky is unchanged and dark:** upper left (x 0.05–0.38, y 0.10–0.25) p50 205 / 152 / 152, chroma 70 / 35 / 35. The top band (x 0.20–0.60, y 0.04–0.09) is a flat gradient: sd 10.9 / 3.1 / 3.1, hp 4.2 / 0.3 / 0.3. 3. **The foreground (x 0.05–0.36, y 0.77–0.85)** moved toward the mockup (p50 66 / 96 / 78; chroma 47 / 78 / 63), but it is still straw with no rock and no flowers, and its grain fell (hp 23.0 / 22.8 / 18.1). |
| `round-11-review/mockup-D-crown-arena` → `mock-D-crown-arena` (staged `roc-opening`, 3.3 s) | **6.8** (6.5) | 1. **The Roc (x 0–1, y 0.27–0.42) now comes at the camera, but it doesn't read as the mockup's eagle.** The wings are a flat, level plank that runs off both frame edges (the mockup's span is 0.01–0.97, with the near wing raised in a bank). It is about 0.14 of the frame tall against 0.24. The head is a grey lump hidden under the chest and the lock marker, with no white head, eye or golden beak. The feet are two grey stumps with no talons, and the chest is a noisy bulb. Seen from three-quarters, the mockup's head, beak and talons are its focal point. 2. **The arena ground is still inverted.** The near meadow (x 0–0.36, y 0.74–0.84) is p50 55 / 98 / 84, and the floor behind the dais (y 0.70–0.74) is 66 / 42 / 42. The fan is clear of the dais from x 0.49 now (was 0.43), but the mockup shows no fan in this view. 3. **The sky and horizon.** The puff between the stones is gone: x 0.30–0.50, y 0.50–0.60 is 6.8 / 28.3 / 1.2 % hot, p50 190 / 216 / 201, which is now slightly under the mockup. But the gap still shows a pale yellow wash, where the mockup has a cloud sea with three small isles. The halo rows (y 0.425–0.475) are still under the mockup (36 / 22 / 22 % hot), and the storm is still violet and dark (p50 87 / 71 / 71, chroma 25 / 35 / 35). D's whole-play p99 fell to 232 against the mockup's 242. |
| `round-1-proposals/B-sky-reach` → `mock-proposal-B` | **5.7** (5.8) | 1. **The foreground regressed** (x 0–0.36, y 0.62–0.84). It was already too dark, and the near-glow fade took it further away: p50 69 / 60 / 52, p90 159 / 93 / 80, hp 16.3 / 15.2 / 12.6. The mockup's verge is sunlit grass with white daisies (4.7 % against 0 / 0) and rock. 2. **The ray and its wake are still not in the frame.** The mockup's second subject is the manta beside the mill with its curling cyan wake (x 0.42–0.75, y 0.29–0.47). 3. **The destination and the sky's finish.** The destination is a broad shelf with five pines, not the narrow rooted spur. The cluster's shelf, now with a row of masted firs, fills the haze over the mill, where the mockup has single isles either side. |

**Seat score, Sky Reach: (7.0 + 6.6 + 6.3 + 6.8 + 5.7) / 5 = 6.48 → 6.5** (this seat in round 11: 6.4).

The Roc's heading, the stones' hot puff and the near-ground medians in B, C and D are real gains. The fir stands and the
near-glow fade each trade one gap for another.

## The README's claims, checked

| Claim | Verdict | Evidence |
|---|---|---|
| The take-off launches over the dais toward the arena entrance, where the player walks in; D comes head-on, wings spread, under the bar | **Head-on: true. "Toward the entrance, where the player walks in": false.** | The take-off steers to `(DAIS.x, CROWN.z + CROWN.r)` = (0, −170), the crown's south rim on D's camera axis. D's camera is at (0, −176) looking due north. The fallen bridge lands, and the retry respawns, at (−12.95, −177.05), the south-west rim. From there the flight path is about 26° off head-on. The aim reads no player position. See ledger 5. |
| The first fight, a retry and the staged shot now share one heading | **First fight and staged: yes, at 3.3 s. Retry: no.** | See ledger 5. |
| Meadow near-ground medians A 72→63 (61), C 97→78 (67), D 99→85 (56) | **Reproduces** | My crops: A 69.6→61.0 (59.2), C 96.3→77.5 (66.2), D 98.2→83.5 (55.3). But p90 and hp fell in every view (A p90 110→90 against 100–108; hp 18.8→15.0 against 19.3), and P's dark foreground got darker (finding 2). |
| D's glare on fan-free ground (x 0–0.45, y 0.45–0.65): 13.6 → 5.9 % (mockup 10.4) | **Reproduces, and this time it hit the right rows** | 10.7 / 13.6 / 5.9 %. The rows between the stones (y 0.50–0.60) are 5.4 / 16.3 / 1.5 %. The halo rows are unchanged (22.3 %), so the cut came off the puff, as round 11 asked. It now slightly undershoots. |
| The fan's hold 2.5 cm right; D's dais row clear to x 0.50 (was 0.43) | **Verified, global** | The fan's teal left edge at y 0.68–0.76 is 0.427 → 0.494 in A, C and D alike. |
| Crag rims lit only on their sun side | **True in code** | A `smoothstep(-0.1, 0.5, dot(N, sunDir_view))` factor on the Fresnel rim (skyIsleHd.ts). It is a global shader. |
| Dense fir stands, 6–9 per cap | **True, but the form is wrong** | The pine counts are 4/3/2/2/2 → 9/9/7/6/7. Every fir shows its orange trunk up the front of the crown (finding 3). |

## Ledger 5 audit (red team)

- **The views: no change.**
  - The cameras blob and every `camAt` match round 11.
  - Only the fan's global hold moved, the same 0.067 in all ten ground frames.
  - The HUD is the baseline touch HUD at 780×1688.
- **D's `roc-opening` against a first fight: equivalent at the captured moment, and reachable at a walk. Not void.**
  - **Same start.** `stageOpening()` places the Roc on the perch (0, −204) with yaw `yawTo(DAIS.x, DAIS.z + 40)`. That is
    exactly where and how the unfought Roc sits (`act`, `!fighting`). It sets `takeoff` 4 s and `rest` 4.5 s, which is
    what `think` sets on the first `fighting` edge.
  - **Same flight.** The take-off ignores the lap `angle`, so the 3.3 s frame is the same flight in both paths.
  - **The lap angle still differs.** Staged sets −π/2; a fresh fight keeps 0, so after 4 s the staged bird banks
    back north and the real one east. That is outside the frame, but the "same in all paths" claim isn't fully true.
  - **Reachable at a walk.** The intro's `lockInput` only disables the weapons (`combat/stormRoc.ts`), so a player keeps
    walking through the 1.5 s intro. The bridge landing is 12.95 m from D's spot, 3.0 s at the 4.3 m/s walk
    (`Player.ts:410`). So D's spot at 3.3 s needs no sprint. This retires round 10's sprint concern.
  - **A held pose, not an instant.** The bird lifts at 1.6 m/s for 4 s, so the head-on view lasts seconds.
- **Should-fix, new: a retry doesn't replay this opening.**
  - On a death, `onPlayerDeath` respawns the player at (−12.95, −179.05), 16.96 m from the crown's centre. That is
    inside `inArena` (< 18 m), so the short intro starts on the next tick and the fight begins 0.3 s later.
  - `restart()` resets `takeoff`, `rest` and `wasFighting`, but never puts the Roc back on its perch, and 0.3 s of
    perch-seeking moves it about 3 m at most.
  - So a phase-1 retry's "take-off" starts wherever the bird was when the player died, usually above the player after
    a stoop. It drifts at 1.6 m/s toward (0, −170) and sinks toward the perch height (`min(altitude, perch.y + 2k)`).
  - That is a different start, heading and height from the staged frame and the first fight.
  - Fix: in `restart()`, place the Roc on the perch with the perched yaw, behind the retry card. Set `angle` in one place
    for all three paths, on the first `fighting` edge.
- **Should-fix, new: the take-off aims at D's camera axis, not at the player or the entrance.**
  - (0, −170) is on the line x = 0, which runs through D's camera. The real entrance, the bridge landing and the retry
    respawn are 13–15 m west of it.
  - Every first fight flies this path, so the frame is real play: not a void. But the aim point was picked for the
    mock camera, and the code comment ("at whoever walks in") isn't what it does.
  - Fix: `yawTo(a, p.x, p.z)`, the player's position. D's frame doesn't change (the capture's player stands on the same
    line), and every player who walks in, from the landing or anywhere else, gets the head-on take-off.
- **A global grade that hides a material gap (should-fix, not a void): the near-glow fade.**
  - `glowNear = mix(0.35, 1, smoothstep(2, 6, vDist))` dims the backlight within 6 m of the camera, wherever the player
    stands. It is one rule for every view, not tuned per view.
  - It moves the medians the seats quote onto the mockups. But it also lowers the highlights and grain in every view,
    and darkens proposal B's already-dark verge.
  - The material gap, the mockups' rocks, daisies and short foliage, is untouched: white daisies 0.00–0.13 % against
    0.05–4.7 %.
  - It is honest code, but the score it buys is a grade, not the material.
- **The cloud-bank gap under the sun.** `keelPuffs()` now skips puffs within about 32° of the sun's azimuth round the
  crown. This is real world decoration and the same from every view, so not a breach. A's under-cluster band changed
  with it (17.1 → 14.1 % hot).
- **No narrowing.**
  - h1-h4, the aerials and the clip changed only in the firs and the meadow. No route, isle or bridge moved.
  - Regressions outside the mock views: the fir trunks in h1, h2, h3 and the aerials, which the round multiplied.
- **Phone budget (watch).**
  - The fps pill is red in 1 of 12 frames (mock-B), against 3 of 12 in round 11. `programs` is unchanged.
  - About 25 more fir instances were added, with no phone-tier reading quoted. Quote one next round.

## Findings, ranked by score gained

1. **D, repeated (the Roc): make the head-on bird an eagle** (x 0–1, y 0.27–0.42).
   - **Why:** the heading landed. What's left is presentation.
   - **Fix, in order:**
     - Aim the take-off at the player (ledger 5 above).
     - Bank it about 15–20° into its coming turn, so one wing rises as in the mockup.
     - Pitch the head up and forward of the chest, so the white head and golden beak clear the chest's silhouette and the
       boss bar.
     - Drop the talons forward, open, under the chest.
     - Keep the rise and distance such that the span sits inside the frame (the mockup's is 0.01–0.97). Today both tips
       are cut.
   - Re-capture D at the same camera and the same 3.3 s.
2. **Regression and repeated: the meadow material, not its grade** (A x 0–0.36, y 0.66–0.84; B; C; D; P x 0–0.36,
   y 0.62–0.84).
   - **Fix:**
     - Keep the near fade for C and D, but bring back the tips' highlight. A p90 should be ~108 and P's ~159, not 89
       and 80.
     - Add what the mockups have: placed, walkable grey boulders standing above the grass, white daisy clumps that read at
       2–8 m, and shorter darker foliage with soil pockets in the nearest metres.
     - Measure p90 and hp, not only p50.
3. **New, worsened this round: the firs' trunks show through their crowns** (A, B, C, P and h1 y 0.20–0.36; h2, h3
   near pines).
   - **Evidence:** every pine on the cluster shows an orange trunk line up the front of its cone to a green tuft, and the
     near pines in h2 and h3 show the same.
     591bd5b5d tripled the instances, and they now line the skyline of every spawn view.
   - **Fix:**
     - End the trunk inside the crown, or make the crown occlude it (depth and alpha order).
     - For the cluster, use the mockup's rounded broadleaf crowns hugging the cap edges, at uneven heights, instead of
       rows of cones.
4. **Repeated, two rounds: one opening for every path** (D; ledger 5).
   - Re-perch the Roc in `restart()`, and set `angle` on the first `fighting` edge.
   - Record a fresh fight and a retry from the bridge landing, with elapsed time and the bird's position, to show they
     match.
5. **Repeated: the cluster is a flat shelf** (A x 0–1, y 0.22–0.36; B, C and P under the ruling).
   - The band is now darker than the mockup (p50 155 against 174).
   - Stagger the heights: the front-left crag a cap's depth lower and the right one higher. Re-open the lit gap right of
     the mill top, and hang longer, denser root curtains.
6. **Repeated: the band under the cluster is too hot, and the subjects under it too dim** (A y 0.36–0.65).
   - 14.1 % against 5.2 % hot; 68 against 87.
   - Dim the far cloud wall behind the mill and lift the near subjects' fill.
7. **Repeated: the fan's hold** (C x 0.32–0.97, y 0.50–0.86).
   - Put the pivot in the glove at the lower right, with the leaf sweeping up-left and the red tassel at the pivot.
   - The 2.5 cm shift cleared D but doesn't touch C's main difference.
8. **Repeated: C's upper sky** (x 0.05–0.60, y 0.04–0.25).
   - Lighter and warmer above 25° elevation, with cloud structure (top band sd 3.1 against 10.9).
   - One shared dome.
9. **Repeated: proposal B's ray in its frame** (x 0.42–0.75, y 0.29–0.47).
   - The lap's near arc has to pass the mill's right shoulder from this camera.
   - Don't time the capture.
10. **Repeated: D's horizon and storm.**
    - The cloud sea and the three small isles in the gap between the stones, where a yellow wash is now.
    - A slate storm, not violet (chroma 35 against 25).
    - The halo back toward the mockup's (36 % against 22 %).

SCORE sky-reach: 6.5
