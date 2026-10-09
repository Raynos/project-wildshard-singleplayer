# Round 1 · seat B (evidence and coverage)

Method: v1 pulled at 2 fps (two 8×4 sheets) plus full frames at 1.5 / 5 / 8.6 / 14.6 / 19.5 / 25.5 s; `ebur128` on
the audio; every card, date and count checked against git; then an inventory of `progress/`, `art/`, `scripts/`,
`public/` and `site/media.json`. Cut points from `tools/edit.json` with the 0.35 s crossfades: 3.0, 9.15, 12.25, 15.15,
18.25, 21.25, 24.35, 27.25, end 29.3 s.

## Claims in v1, checked

| Claim (card / README) | Verdict | Evidence |
|---|---|---|
| Day 1 = 16 Sep, `568a1463f` last of the day | true | last commit of 16 Sep, 23:58 −0500; the first is `402198440` "allow empty", 22:13 |
| Day 8 / 15 / 22 = `8a58b9d1e` / `19a434635` / `c9aaa62ab`, last of the day | true | the last commits of 23 Sep, 30 Sep and 7 Oct |
| "22 days · 6 shards" | true at day 22 | `git ls-tree c9aaa62ab src/shards/`: six shards plus `_template` |
| Day 1 "a cabin and a crossbow" | true in code, **not shown** | `src/player/Crossbow.ts`, `src/world/Cabin.ts` at `568a1463f`; no crossbow in any frame; the cabin is a grey block in haze at 8.6 s |
| Week 1 "Driftwood Isle … joins the world" | true but undersold | Driftwood was built on night 2 to 3: `src/chunks/driftwood-isle.ts` at `44aced1a6` (18 Sep), `docs/HOW-DRIFTWOOD-GOT-BUILT.md` |
| Week 2 "Pine Hollow is remastered (the same trail as day 1)" | **shown wrong** | see R1B-1 |

## Findings

| ID | Severity | Where | Finding | Evidence | Fix |
|---|---|---|---|---|---|
| R1B-1 | must-fix | v1 18.25–21.25 s | The "remastered" Pine Hollow is a bare gravel plain with no pines, so the week-2 remaster looks *worse* than day 1. That is the opposite of a progress story. The spot does have trees in that era. The likely cause is that the forest had not streamed in before capture: mkshots gives `loadWaitSec: 2, warmSec: 2`, and install-world spawns the player only at the shot's start point. | frame 19.5 s; `progress/pine-hollow/20261002-0011-0d59505c/first-frame.jpg` (`0d59505c`, 2 Oct) shows the same south trail with trees on both sides; `layout.ts:27` at `19a434635`: "the south-gate spawn: unchanged from v1" | Check every shot against the nearest `shard-progress` capture of that era before cutting. Gate each shot with the `decide.sh` frame check that shard-progress already uses (E394). Warm for at least 10 s. |
| R1B-2 | must-fix | whole video | There is no gameplay. Every shot is a camera lerp: `walk()` is a straight dolly at a fixed height and `fly()` an eased move (mkshots.py). install-world.js hides the camera's children (`for (const c of cam.children) c.visible = false`), which removes the crossbow viewmodel, and capture.mjs hides the DOM. This is L1's "doesn't have real gameplay". | `tools/mkshots.py:9-20`, `tools/install-world.js:9`, `tools/capture.mjs` `__hide` | Drive the player's own inputs on each historical build (S3). Keep the viewmodel on. |
| R1B-3 | should-fix | v1 3.0–9.15 s | The day-1 tour runs 6.15 s (21 % of the video) with a near-static camera: frames 3–9 s barely change. Far better day-1 material is already committed and unused. | `progress/timelapse.mp4` (17 Sep, 43 s, 58 captioned captures: "weapon first", "cabins first cabin" with a campfire, "animals fur shells stag 3m"); `progress/001-first-terrain-and-trees.png` (16 Sep 22:43) … `050-cabins-hollow-camp-sunset.png` (17 Sep 01:38) | Day 1 = 3–4 s of real crossbow play plus a 2 s still run from `001`→`050`. |
| R1B-4 | should-fix | inventory | A real first-person gameplay trailer from day 3 was ignored. It has a crossbow in Pine Hollow, a sword on Driftwood's pier and beach, a boat and a portal, with the HUD on, and its own card "Built in one night". Its capture code is still in the tree. | `progress/wildshard-trailer.mp4` (2:06, 1600×900, `44aced1a6`, 18 Sep), plus 15 s and 30 s cuts, `public/trailer-30.mp4`; `scripts/trailer/capture.mjs` | Treat it as the week-1 gameplay source: re-film at 1080p from `44aced1a6` with its own capture, or reuse its frames as they are (HUD allowed, L5). |
| R1B-5 | should-fix | cards | The facts that make the hook are missing. Day 1 began on an empty repo at 22:13 and was a crossbow game with deer and cabins by 23:58: **1 h 46 min, 29 commits, 151 files**. Commits by chapter: 29 → 624 → 2,495 → 5,729 (7,014 today). | `git rev-list --count <sha>` for each chapter SHA; `git ls-tree -r 568a1463f` | Put the numbers on the cards, worked out from git at render time (S10). |
| R1B-6 | should-fix | 9.15–15.15 s | Neither week-1 shot shows life. Driftwood is shot from 210 m up as a static map. In Nalati the top ~45 % of frame 14.6 s is the painted mountain backdrop over flat terrain, which a sceptic reads as a matte painting (S2). | frames 10–12 s and 14.6 s; `mkshots.py` `drift-d08` and `nalati-d08` | Use shots with motion: the herd and gallop (`n-herd` and `n-gallop` in today's shots, or the same in the day-8 build), and the Driftwood pier combo. |
| R1B-7 | should-fix | audio | The audio is music only, with no SFX at all (L7). The mix is −16.4 LUFS integrated (`compose.py` loudnorm I=−16) against the alpha pipeline's −14. Momentary loudness falls to −30 / −31 LUFS at 15–16 s, exactly under the Week 2 card (cut 15.15), so a chapter lands in a lull. | `ebur128`: I −16.4, LRA 7.2; per second, M −30.4 at 15 s and −31.0 at 16 s; peak −12.0 at 23 s | Time the chapter cards to downbeats. SFX on every gameplay hit. Mix with `mix.py` to −14. |
| R1B-8 | should-add | inventory | History captures exist for only two shards, and in only one format. Sky Reach (42) and Dunes (57) were captured from 1 Oct 14:56 to 3 Oct (~43 h). Their time-lapses use 25 and 23 of those captures, at 540×1168 portrait, with the touch HUD and burned captions. `shard-progress.mjs:87` hard-codes 390×844 portrait. Pine, Nalati, Driftwood and Nine Dragon have **one** capture each (2 Oct). This decides whether the authoring half is reused or re-filmed. | `ls progress/<slug>/2026*`; `progress/far-reach/timelapse-*.mp4` say "x/25"; `meta.json` labels | Either keep the portrait material as panels inside a landscape frame (as TR5's build beat does), or budget a landscape back-fill of 6 shards × N SHAs. Pre-day-15 builds need v1's `__world` hooks; shard-progress expects today's. |
| R1B-9 | should-add | S8 | steam-trailer's `capture.mjs` cannot film the history as it stands. It loads shots only from `./shots/${s}.mjs` (line 44) and waits for `window.__wildshard.world.game` (line 149), which day 1 and day 8 don't have (`window.__world`). To film old builds or keep shots outside its folder, someone has to edit the trailer agent's file. | `scripts/steam-trailer/capture.mjs:44,149`; `568a1463f:src/main.ts:138` sets `window.__world` | The progress trailer's own historical capture lives in its own folder (v1's fake-clock capture plus input driving). Ask the trailer agent over herdr for a `--shots-dir` flag, or film only HEAD shots with their pipeline. Reuse `titles`, `mix` and `edit` as they are. |
| R1B-10 | should-add | authoring half | No real Claude Code session from the past three weeks is on disk as video or as a cast. TR5's cast lives in the trailer agent's private `$T`, and there is no `*.cast` in the repo. What is real and dated: 4 blow-by-blow PDFs (`docs/{Driftwood-Isle,Nalati-Grasslands,Nine-Dragon-Stack,Pine-Hollow-Remaster}-blow-by-blow.pdf`) with every prompt, `git log` messages for every captured SHA, and 459 mockup rounds in `art/*/round-*` (Nine Dragon 90, Sky Reach 45, Dunes 33). | `find . -name '*.cast'` returns nothing; `ls -d art/*/round-* \| wc -l` = 459 | The "authored with Claude Code" proof is the real commit message of each time-lapse frame, ticking beside it, plus mockup → in-engine pairs. Record one new session only for the TR5-style beat. |
| R1B-11 | nit | 0–3 s | The title sits over a dim, nearly static trail. Nothing moves until the card is gone. | frames 0–3 s | Open on action (see the recommendation). |

## Inventory (what a progress trailer can use)

- **First-person gameplay, committed:**
  - `progress/wildshard-trailer.mp4`: 18 Sep, crossbow and sword, 1600×900.
  - `art/nine-dragon-stack/round-{18,19,22}-*/…portrait*.mp4`: 26 Sep, 1080×1920, 15 s each, grapple.
  - `art/hud-explorer/round-8-arena-motion/{crossbow-pine-hollow,sword-driftwood}-player-view.mp4`: 29 Sep, 780×1688.
  - `art/explore/round-1-playgrounds/{horse,grapple}-playground.mp4`.
  - Unusable as trailer shots: `art/playtest/round-{1,2,3}` (38 clips, 540×1174, 7–8 Oct) are agent repro clips of bugs, filmed in real time with the HUD on. The 10 physics walks (`progress/physics/p*-walk-*.mp4`) are 196×424.
  - No recording of Jake's own play exists in the repo.
- **Gameplay as code (HEAD only):** `scripts/steam-trailer/shots/` holds 43 shots. About 12 drive the player or show the viewmodel: `p-elite`, `p-king-fp`, `d-bridge`, `d-combo`, `d-reef`, `n-bow`, `n-gallop`, `n-archer`, `n-titan-fp`, `dn-whip`, `nd-grapple`, `sr-winch`. The rest are rig shots.
- **Shard over time:**
  - Sky Reach: 42 captures × 7 views, plus a 10 s orbit `clip.mp4` per SHA, 8 time-lapses and `clips.mp4` (250 s).
  - Dunes: 57 captures, the same layout.
  - Root `progress/001…298-*`: 354 numbered images in capture order from 16 Sep 22:43. This is the whole game's history as stills.
  - `progress/timelapse.mp4` covers day 1 to 2.
  - About 4,560 images in `progress/` and 4,210 in `art/`.
- **Filmable builds:** any SHA, through v1's `build-rev.sh`. The hooks are `__world` up to day 8 and `__wildshard.world` from day 15.
  - Day 1 is drivable: WASD is read on keydown with no lock check (`Player.ts:33`), `?nolock` lets the crossbow fire on `F` (`main.ts:56`, `Crossbow.ts:534`), and `dt` comes from `THREE.Clock`, which Playwright's fake clock steps.
- **Missing:**
  - history captures of 4 of the 6 shards;
  - any landscape history footage;
  - a historical session recording;
  - game audio for old builds (every capture is muted);
  - a 1080p master of v1, which was never committed.

## Battery walk (v1)

| # | Result | Why |
|---|---|---|
| S1 | fail | The first 3 s are title text over a static dim trail. It says "MMO" but shows nothing worth the next 3 s. |
| S2 | fail | Every shot is a dolly or a fly-through with the viewmodel hidden (R1B-2). Nalati reads as a painting (R1B-6). |
| S3 | fail (not attempted); answerable | Day 1 on `?nolock=1&skipintro=1`: hold `KeyW` with Playwright, set `__world.player.yaw`/`pitch` each step, press `F` to fire at `__world.animals`, and step on `page.clock` at 60 fps (v1 capture.mjs already pauses and steps the clock). Keep the viewmodel on. |
| S4 | fail in v1; material passes for 2 shards | Sky Reach aerial-overview goes from grey placeholder to sunset within frames 1→8 of 25: legible in 4 s. Nothing in v1 says "authored with Claude Code" (R1B-10). The other 4 shards have no history captures (R1B-8). |
| S5 | pass, with edits | Week 4 = one more `build-rev.sh` SHA, shots in `mkshots.py`, and one card. But the cards are hard-coded in `cards.py` ("22 DAYS · 6 SHARDS", "week four is next"). |
| S6 | partial | One 720×1280 file, 29 s: fine for the phone, Shorts and Reels. Nothing at 16:9 for YouTube or the site. |
| S7 | fail | No SFX; the Week 2 card lands in a −31 LUFS lull (R1B-7). |
| S8 | pass for v1; at risk for v2 | v1 stayed in `progress/progress-video/tools`. v2's historical gameplay cannot go through steam-trailer's capture without editing it (R1B-9). |
| S9 | fail | No moment to rewind to. The best shot is the Nine Dragon rain crowd (15.5–18 s), which is atmosphere, not a moment. |
| S10 (new) | fail | **The receipts test.** A commenter checks an on-screen number or date against the public commit log. v1's numbers happen to be right, but they are typed into `cards.py` by hand. Every on-screen claim (date, SHA, commit count, shard count, "1 h 46 min") should be generated from git by the render script and carry its SHA. |

## Recommendation (round 1)

**Format:** one 16:9 master, 1080p60, ~75 s (YouTube, X, the site), plus a 9:16 cut of ~35 s for the phone and Shorts. Capture gameplay once at 3840×2160. A centre crop of 1215×2160 gives the 1080×1920 portrait cut without upscaling. The portrait history material (time-lapses, phone-view clips) sits as panels inside the landscape frame, as TR5's build beat already does.

**Structure:** each chapter is one gameplay shot and one authoring shot. Its card carries the date and the commit count from git.
- **0–3 s, cold open:** day-1 build `568a1463f`, first person. A crossbow bolt fired at a stag on the south trail, viewmodel on. Burned in: "DAY 1 · 1 h 46 min after the first commit".
- **3–13 s, Day 1 (29 commits):**
  - 4 s more day-1 play (walk to the cabin, ADS, hit);
  - 4 s of `progress/001`→`050` stills at 12 fps beside the real commit subjects of 16 Sep (`git log 568a1463f`).
- **13–25 s, Week 1 (624):**
  - Driftwood sword combo on the pier, re-filmed from `44aced1a6` or `8a58b9d1e`, or the 18 Sep trailer frames;
  - Nalati mockup round → the same view in engine (`art/nalati-grasslands/round-*` → day-8 build).
- **25–37 s, Week 2 (2,495):**
  - Nine Dragon grapple (`art/nine-dragon-stack/round-22…` or a fresh `19a434635` capture);
  - a Pine Hollow wipe on the *same trail* from day 1 to day 15, with trees this time (R1B-1).
- **37–55 s, Week 3 (5,729): the authoring centrepiece.**
  - Sky Reach from grey to sunset: 42 captures in 43 h, with each frame's real commit message ticking beside it, plus the Dunes caravan;
  - gameplay from `dn-whip` and `sr-winch`, filmed by the trailer agent's pipeline on HEAD, or by ours on `c9aaa62ab`.
- **55–68 s, the rewind moment (S9):** the **match cut**. The day-1 crossbow fires on the day-1 trail at `(0, −236)`. On the release the cut goes hard to the same spot, same weapon, same yaw on today's build, and the bolt lands in today's forest. That is 23 days in one frame, and it is only possible because the spawn is "unchanged from v1" (`layout.ts:27`). Then 6 s of today's best play.
- **68–75 s, end card:** WILDSHARD · day 24 · 7,014 commits · 6 shards · built with Claude Code. Every number comes from git at render time (S10).

**Capture:**
- Historical builds: v1's `build-rev.sh`, plus a new input-driven capture in the progress trailer's own folder. It extends v1's fake-clock `capture.mjs` with key, aim and fire per step, per era hook (`__world` / `__wildshard.world`), and keeps the viewmodel.
- HEAD shots: requested from the trailer agent, or filmed with their `capture.mjs` unedited (L6, S8).
- Authoring half: the existing Sky Reach and Dunes captures. Back-fill Pine Hollow (day 1, 8, 15, 22) with the same input-driven capture at fixed cameras.

**Sound:**
- One MiniMax Music 3 cue in four sections, one per chapter, with each card on a downbeat.
- SFX from MOSS v2 and Stable Audio 3, the better take of each (L7): crossbow, impact, sword, grapple, and a typing and commit tick under the authoring panels.
- `mix.py` to −14 LUFS.

**Reuse:** `build-rev.sh`, `install-world.js`, `scripts/steam-trailer/{titles,mix,edit}.mjs` unedited, the TR5 build-beat layout, `progress/far-reach` and `progress/sunscar-dunes`, and `progress/001…`.

**Biggest risks:**
1. Old builds may not stream, aim or fire under a fake clock in headless Chromium. R1B-1 shows a shot can fail silently, so every shot needs a frame check against its era's capture.
2. The history half is thin: rich for 2 shards, almost empty for 4. A landscape re-capture costs build-lane time (one app build machine-wide) per SHA.

Verdict: v1's dates and counts are right, but it films no gameplay, its week-2 shot makes the remaster look worse than day 1, and it skips the day-3 gameplay trailer, the day-1 time-lapse and the 99 dated shard captures already in the repo, so v2 should be rebuilt around player-driven captures of the four day SHAs and the day-1 → today match cut.
