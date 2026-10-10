# Round 1 · Seat C (red team: trailer / devlog creative director)

Watched v1 (`progress/progress-video/wildshard-day1-to-week3.mp4`, 29.27 s, 720×1280, 30 fps) as 2 fps frames plus ten
full-size stills (0:01, 0:04.5, 0:08, 0:10.5, 0:13.5, 0:17, 0:19.5, 0:22, 0:25.5, 0:28); measured motion (mean absolute
frame difference per second, greyscale 180×320) and audio (ebur128, RMS per 0.25 s, onsets). Also checked the alpha
trailer (`site/media.json` → `trailer.mp4Phone`, 63.2 s, 16:9), both shard time-lapses, `scripts/steam-trailer/` and
the day-1 build's source. v1's cut points (edit.json, 0.35 s crossfades): 3.00 · 9.15 · 12.25 · 15.15 · 18.25 · 21.25 ·
24.35 · 27.25.

## Findings

| ID | Severity | Where | Finding | Evidence | Fix |
|---|---|---|---|---|---|
| R1C-1 | must-fix | 0:00–0:29, every shot | **There is no gameplay at all.** No hands, no weapon, no target, no animal reacting, nothing the player causes. The four "first-person" shots are 4–9 m eye-height dolly pushes (`walk()`), so they read as fly-throughs. That is exactly L1's "doesn't have real gameplay". | Stills 0:04.5, 0:17, 0:19.5, 0:25.5. `tools/mkshots.py` SHOTS: `'pine-d01': … walk(0, -236, 180, -2, 9), 3.4` means 9 m in 3.4 s, no input, no viewmodel; `capture.mjs` hides all DOM. | Drive every gameplay shot by **player input** on that day's build (keys, a yaw/pitch track, weapon fire) with the viewmodel visible and something reacting. Allow no pure camera moves in the gameplay half. |
| R1C-2 | must-fix | the whole video vs the shipped alpha | **v1 has less gameplay than the trailer that already ships.** The alpha trailer has a first-person sword combo on a boar (0:10), horseback archery (0:58), the Pine King, the grapple and the whip, all as shot code. v1 reused none of it. | Alpha frames 0:10 and 0:58. `scripts/steam-trailer/shots/driftwood.mjs:46` (`d-combo`), `nalati.mjs:35-40` (`n-gallop`, `n-archer`), `nine-dragon.mjs:127` (GRAPPLE), `dunes.mjs:40,57`. | Film the newest chapter with the alpha's existing player-input shots, re-captured. Spend new work only on the **historical** gameplay that does not exist yet. |
| R1C-3 | must-fix | 0:03–0:09 vs 0:18–0:21 | **The one "same place, later build" beat makes the game look worse.** Day 1 at Pine's south trail has god rays, firs and a cabin (0:04.5). Week 2 "remastered", at the same coordinates, is flat grey gravel under a blown-out sky with low-detail cliffs (0:19.5). The two shots are 12 s apart, so nobody compares them anyway. The rest of v1 shows progress only as "more places". | Stills 0:04.5 and 0:19.5. mkshots `pine-d01` / `pine-d15` use the same `walk(0, -236, …)`. | Show progress by **holding one thing constant (spot, verb, camera) and swapping the build under it**: match cuts, wipes or a split. Scout the spot on all four builds first, and drop any spot where a later build reads worse. |
| R1C-4 | must-fix | 0:00–0:03 | **Fails the scroll test.** The hook is a title card, not an image. The frame is a dim brown path with the title centred. Audio is near-silent until 1.5 s (−40 to −47 dBFS RMS at 1.00–1.25 s). | Contact sheet row 1. RMS envelope: `1.00:-40 1.25:-47 1.50:-25`. | **Cold-open** on the hardest-hitting gameplay of the newest build, with sound from frame 0. The title comes after the hook. |
| R1C-5 | should-fix | 0:09–0:15, 0:27–0:29, every transition | **Low energy.** Motion is 1.6–2.8 in 0:10–0:15 (the Week 1 aerials are almost still) and never above ~10 after 0:03. It is exactly 0.0 from 0:28 (the end card sits on a frozen frame). All 8 transitions are the same 0.35 s dissolve, and there is not one hard cut. | Motion per second: `10 1.63 · 11 2.21 · 13 1.9 · 14 1.89 · 28 0.0`. `edit.json` `"xfade": 0.35`. | Cut hard on the hits. Keep montage shots ≤ 1.5 s. Use speed ramps (true slow-mo via `speed` < 1 in steam-trailer capture). End on motion. |
| R1C-6 | must-fix | the audio, 0:00–0:29 | **The music is a menu loop, not a trailer cue.** It is the title theme (`title-b47c8a52.m4a`), hand-spliced. LRA is 7.2 LU. The "peak" (−17 dB, 0:22–0:26) is no louder than Week 1 (−17 at 0:12.75). The phrase breath (−42 dB at 0:15.5) falls on the Week 2 cut (0:15.15), right into the best shot, and the music comes back 1 s after the picture changes. It ends in a 1.6 s fade, not a button. | ebur128 `I −16.4 LUFS, LRA 7.2`. RMS `15.00:-38 15.50:-42 16.25:-20`. README § How it was made, step 5. | Generate a MiniMax cue to a structure (cold-open hit, quiet day 1, build, a **drop on the rewind moment**, final hit). Scan it with `music_scan.py` and place the cut on its hits the way `cuts/alpha.mjs` does. Mix to −14 LUFS like the pipeline. |
| R1C-7 | must-fix | 0:15–0:18 and every shot | **There are no sound effects.** Every capture URL has `mute=1` and `compose.py` maps only the music. Nine Dragon's rain and crowd are silent. | `mkshots.py` `q = '…mute=1…'`. `compose.py` audio graph = `[music]atrim…loudnorm`. | Log events with virtual time during capture (fire, impact, kill, footstep, hoof) and place SFX on them, as `cut.mjs` does with `game:` sounds. Day 1 has its own WebAudio synth SFX (`568a1463f:src/audio/Audio.ts`: `crossbowFire`, `boltImpact`, `kill`). Use them for day 1: honest, and funny next to the week-3 sound. |
| R1C-8 | should-fix | 0:03–0:09, 0:15–0:21 | **The cards promise what the picture never shows.** The Day 1 card says "a cabin and a crossbow", and no crossbow appears. "Pine Hollow is remastered" sits over the worse-looking shot. | Stills 0:04.5, 0:08, 0:17, 0:19.5. `tools/cards.py`. | Each card names only what is on screen. Day 1 fires the crossbow. |
| R1C-9 | should-fix | 0:04.5, 0:10.5, 0:19.5, 0:25.5 | **Portrait wastes the frame.** At 9:16 with a 60° vertical FOV, the horizontal view is about 36°, and 40–50 % of each first-person frame is ground. Driftwood (0:10.5) shot straight down reads as a map, not a place. Sky Reach and the Dunes are horizontal subjects squeezed into a column. | Stills listed. `mkshots.py` `fov: 60`. | See the format recommendation: a 16:9 master, with portrait as a re-composed derivative, never a crop. |
| R1C-10 | should-fix | 0:03, 0:09, 0:15, 0:21 cards | **Progress is never counted.** Devlog videos run on counters, and the repo has them: commits **29 → 624 → 2,495 → 5,729** at the four SHAs, and `src/` files **35 → 297 → 874 → 2,102**. | `git rev-list --count <sha>`; `git ls-tree -r --name-only <sha> -- src \| wc -l`. | Add a rolling counter to each chapter card ("DAY 8 · 624 commits"). Dates like "16 SEP 2026" mean nothing to a stranger. |
| R1C-11 | must-fix | the whole video vs L2 | **The authoring half is missing**: no terminal, no time-lapse, no prompt. The existing time-lapses are not trailer-grade either: 540×1168 portrait, a burned-in perf chip ("30 fps 33 ms") and a caption bar, the touch HUD visible in `h2-windmill`, and one hard step per second. | `ffprobe` of `progress/far-reach/timelapse-*.mp4` → `540,1168`. Frames at 0.5 s and 26 s of `timelapse-aerial-overview.mp4`. Alpha 0:33 (HUD and joystick visible). | Re-render a shard's history as a **continuous-camera lapse**: one camera spline, with the build swapped under it every few frames. Details are in the recommendation. |
| R1C-12 | should-fix | `progress/progress-video/tools/` vs L6, S8 | **v1 forked the pipeline**: its own `capture.mjs`, `cards.py` and `compose.py` (crossfade, loudnorm at −16) instead of `titles.mjs`, `mix.py` and `edit.mjs` (−14). Two things block reuse without touching the trailer agent's files. `cut.mjs:17` and `capture.mjs:44` load only `./cuts/<name>.mjs` and `./shots/<s>.mjs`. `capture.mjs:52` needs `g.app.clock.setCapture(60)`, which no old build has. | The lines cited. | One herdr request to the trailer agent: add `--cut-file` and `--shots-file` paths, plus a legacy clock mode (Playwright `page.clock`, as v1's `tools/capture.mjs:19`) for builds without `setCapture`. The progress trailer's cut, shots and input tracks then live in its own folder and call their CLIs unchanged. |
| R1C-13 | should-fix | README step 5, S5 | **Week 4 breaks the edit.** The music was hand-cut so its peak lands on Week 3. | `progress/progress-video/README.md` step 5. | Make the structure data. The newest chapter always takes the drop slot and older chapters compress to fixed slots. Adding a week = one SHA, its shots and a re-run of the cut. |
| R1C-14 | should-add | 0:27–0:29 end | **"MMO" is never paid off.** The title claims an MMO and the video ends on blurred dunes. The alpha's grid fly-in already exists ("every shard on one grid"). | `shots/grid.mjs`; alpha card `grid`, `cuts/alpha.mjs:76`. | End on the grid reveal. It changes the build: one more HEAD shot, already scripted. |

## Battery walk

| # | Result | Why |
|---|---|---|
| S1 | fail | The first 1.5 s is a near-silent dark frame with a title (R1C-4). Nothing moves, and nothing says "game" or "made by one person + AI". |
| S2 | fail | Nothing to pause on: every shot is a camera move with no player (R1C-1). |
| S3 | fail in v1, buildable | v1's day 1 is the tour camera. But the day-1 build exposes everything needed: `window.__world` = `{…, animals, crossbow, hud, audio}` (`568a1463f:src/main.ts:138`), `player.keys` is a `Set` of `e.code` (`Player.ts:24,33`), `player.yaw` / `pitch` (`:15-16`), and `crossbow.fire()` (`Crossbow.ts:558`). Drive it with an input track under Playwright's `page.clock` (v1 `tools/capture.mjs:19,45`): set `locked=true`, add/delete `KeyW` per frame, ease the yaw toward a stag, `fire()` at frame N, log events for SFX. |
| S4 | fail in v1, material partly there | Sky Reach has 42 dated captures from 10-01 14:56 to 10-03 09:52 (**43 hours**: a hook in itself). The change is legible: grey pucks become a golden archipelago (time-lapse 0.5 s vs 26 s). But the lapses are 540 px portrait with a perf chip. "Claude Code" does not read at 16:9 either: the alpha's raw terminal at 0:33 is unreadable at 720p. Show one real prompt as big type (Jake's own words are in `docs/tasks/asks/`), with the terminal as texture. |
| S5 | fail | A new week means a new build, new shots, a hand re-edit of the music and a re-compose (R1C-13). |
| S6 | fail | One portrait 720p master; the 1080 master was not committed (README). No landscape cut for YouTube or the site, where the 16:9 alpha already plays. |
| S7 | fail | No SFX (R1C-7). Cuts miss the hits: the Week 2 cut is 1 s before the music returns (R1C-6). Only 0:12.25 lands on an onset (0:12.2). |
| S8 | fail | A forked pipeline (R1C-12). Passes once the two small hooks land through the trailer agent. |
| S9 | fail | No rewind moment. The nearest is Nine Dragon's rain square (0:15–0:18), but it is silent, half-covered by the card and has the breath under it. |
| **S10** (new) | fail | **Same spot, four builds.** A viewer should be able to *see* the game get better at one fixed place and verb. v1's only attempt reads as a downgrade (R1C-3). |

## Recommendation

**Format (L4): a 16:9 master, 1920×1080 60 fps, 60 s, for YouTube, X and the site beside the alpha. Then a 9:16
1080×1920 derivative, 45 s, as a stacked split: gameplay on top (1080×960), authoring underneath (1080×960), on the
same EDL.** Why landscape leads:
- First-person needs horizontal FOV (R1C-9).
- The day-1 build is a desktop pointer-lock game with no touch HUD.
- A terminal and a lapse need width.
- The pipeline is 16:9.

Why the portrait version is a *stack*, not a crop: it is the native TikTok/Shorts split-screen grammar, and it makes
"half gameplay, half authoring" happen at the same moment on Jake's phone. Capture each shot natively at both sizes:
the per-shot `portrait` override already exists (`capture.mjs:44`, `cuts/nine-dragon.mjs --portrait`).

"Desktop" as an OS screen recording should be rejected as the master: window chrome reads as a screen share. Desktop
appears only as the terminal graphic in the lapses.

**The structure: gameplay chapters, with authoring lapses as the transitions.** Time passing *is* the authoring.

| Time | Beat |
|---|---|
| 0:00–0:03 | Cold open, HEAD: the grapple (`nine-dragon.mjs` §5), hard cut to black on the impact. Type: "22 days ago it was one forest." |
| 0:03–0:11 | **Day 1** (`568a1463f`): first-person crossbow. Stalk, aim, fire, bolt hits, stag drops, with day-1 synth SFX. Card: "DAY 1 · 29 commits". |
| 0:11–0:16 | Lapse → Week 1: Driftwood's birth over days 2–8. Fixed orbit, about 10 SHAs swapped under it, counter rolling 29 → 624, one real prompt typed large. |
| 0:16–0:23 | **Week 1** (`8a58b9d1e`, which has `dev/nalati-ride.ts`, `nalati-bow.ts`, `Boss.ts`): horseback archery on the steppe, then the Golden King. |
| 0:23–0:28 | Lapse → Week 2: Nine Dragon goes grey to rain. |
| 0:28–0:35 | **Week 2** (`19a434635`): first person in the rain square. Sword or bow, the crowd parting, rain and crowd SFX. |
| 0:35–0:41 | Lapse → Week 3: Sky Reach's 25 states in 43 h, continuous crane, captioned "43 hours". |
| 0:41–0:49 | **Week 3** (`c9aaa62ab`, or HEAD if the hooks differ): hover across Sky Reach, the whip on the Dune Matriarch (`dunes.mjs:57`). |
| 0:49–0:54 | **The rewind moment (S9), on the drop**: "one bolt, four builds", described below. |
| 0:54–1:00 | Grid fly-in (`grid.mjs`) "every shard, one world", then the end card: "Day 22 · 5,729 commits · built with Claude Code · week 4 next". |

**The rewind moment.** A first-person crossbow at one scouted Pine spot. The day-1 bolt leaves the string. During its
flight, four hard cuts on four drum hits swap the world under the identical camera (d01 → d08 → d15 → d22). Each build
fires its own bolt on the same frame, so the bolt is continuous across the cuts. It lands in the day-22 ghost stag
(`pine.mjs:7` `p-elite`) in true slow-mo. Every frame is real (L5), and it is the whole pitch in 4 s.

**How the gameplay is driven:**
- **Old builds:** v1's `build-rev.sh` plus `page.clock` stepping, and an **input track** per shot (key down/up by
  frame, a yaw/pitch curve with slight hand noise, a fire frame) written against each build's hook (`__world` up to
  day 8, `__wildshard.world` from day 15). Viewmodel on, HUD off, an event log for SFX.
- **HEAD:** steam-trailer `capture.mjs` as it is (4K, 120 Hz sub-frames, motion blur in `edit.mjs`).

**How the lapses are made:** for each SHA in a shard's dated history (the SHAs are in the far-reach and
sunscar-dunes capture folders' `meta.json`), build once and render only its slice (frames k…k+n) of **one long camera
spline**. The camera never stops while the world changes under it: the Minecraft build-lapse technique, not a
slideshow. A hard-light flash on each swap, a soft "tick" SFX per commit.

**Sound:**
- One MiniMax cue to the beat sheet above (L7). Quiet and a little naive under day 1, a riser through the lapses,
  the drop on the rewind moment, a final hit on the grid reveal.
- Game SFX from event logs. Trailer families (whoosh, impact, sub drop) from the existing `sfx-jobs.json` bests.
  Terminal keyclicks under the typed prompts.
- `mix.py` to −14 LUFS.

**Reuse:** `titles.mjs`, `mix.py`, `edit.mjs`, the HEAD shots, `build-beat.mjs`'s asciinema (as texture) and v1's
`build-rev.sh` / `install-world.js`. **Retire** v1's `compose.py` and `cards.py`.

**The two biggest risks:**
1. **Build cost.** About 30–40 historical builds for four lapses plus the rewind moment, through the one machine-wide
   build lane, and each old build's hooks drift. Cap each lapse at about 10 SHAs, cache the builds in scratch, and
   scout every SHA with `--dry` stills before any full capture.
2. **The rewind moment's spot.** Pine's d15 build reads worse at (0, −236) (R1C-3), and animals spawn differently per
   build. Scout a spot where every week is visibly better, and pin a stag at a fixed pose through each build's
   `animals` hook. If no spot works, the fallback is the same match cut on Driftwood's beach (d08 → HEAD).

Verdict: v1 is a slideshow of vistas over a menu loop, with no player, no sound effects and a backwards "remastered"
beat. Rebuild it as a 16:9 master plus a 9:16 stack, alternating first-person gameplay chapters driven by real input
on each day's build with continuous-camera authoring lapses, cut to a commissioned cue whose drop lands on a one-bolt,
four-build match cut.
