# Plan: PROGRESS-TRAILER — "building my first MMO", half first-person play, half shard authoring (E468)

**State:** see [progress-trailer/STATE.md](progress-trailer/STATE.md).

## 0. Why

Jake on v1 (E467's 29 s portrait cut, `progress/progress-video/`), 2026-10-09: *"It's a start but it's shit it's not
epic it doesn't have real gameplay. Maybe it should be landscape maybe it should be desktop. Get a council to review and
audit the video and then make a new plan for a progress trailer. It should be half gameplay in first person of the game.
It should be half shard authoring which means timelapse or progress of a shard over time."* (E468)

It is still the E467 story: the game as it stood on day 1, week 1, week 2 and week 3 of this repo (`568a1463f`,
`8a58b9d1e`, `19a434635`, `c9aaa62ab`), now told with play and with authoring.

## 1. What the council found in v1

One round, three fresh seats (Codex capture engineer, Claude evidence, Claude red-team trailer director); files and the
register in [progress-trailer/reviews/](progress-trailer/reviews/). 37 findings, 15 must-fix. In short:
- **No gameplay at all**: every "first-person" shot is an eye-height dolly with the viewmodel hidden. v1 has less play
  than the alpha trailer already on the site (sword combo, horseback archery, grapple, whip).
- **No authoring half**: no time-lapse, no terminal, no prompt, though Sky Reach (42) and Dunes (57) have dated captures.
- **The progress beat runs backwards**: week 2's "remastered" Pine Hollow is a bare plain (the forest had not streamed
  in: 2 s of warm-up), so it looks worse than day 1.
- **Not epic**: a title card for a hook, near-silent first 1.5 s, slow pushes, eight identical dissolves, a spliced menu
  theme, no SFX, a frozen end frame, nothing to rewind to.
- **Facts left on the table**: day 1 went from an empty repo (22:13) to a crossbow game with deer and cabins by 23:58,
  **1 h 46 min, 29 commits**; commits by chapter **29 → 624 → 2,495 → 5,729**; the 18 Sep first-person trailer
  (`progress/wildshard-trailer.mp4`), the day-1 time-lapse (`progress/timelapse.mp4`), 354 numbered progress stills.
- **Pipeline**: v1 forked its own capture and edit. `scripts/steam-trailer/capture.mjs` cannot film the day-1 / day-8
  builds as it is (it waits for `window.__wildshard.world…app.clock`; those builds have `window.__world` and a THREE
  clock), and its shot and cut loaders only read its own folder.

v1 stays committed as the record; this plan replaces it.

## 2. The trailer

### 2.1 Shape (Jake's picks, §6)

- **A 16:9 master, 1920 × 1080 at 60 fps, 60 s** (YouTube, X, the site beside the alpha trailer). All three seats lead
  with landscape: first person needs horizontal field of view, the day-1 game is a desktop pointer-lock game, a terminal
  and a time-lapse need width, and the shared pipeline is 16:9.
- **16:9 only** (Jake, PT0): no 9:16 cut; on the phone it plays letterboxed.
- **Not an OS screen recording** ("desktop" as window chrome reads as a screen share); desktop appears only as the
  terminal inside the authoring beats.
- **Exactly half and half**: 30 s of first-person play, 30 s of authoring, alternating; time passing *is* the authoring.

### 2.2 Beat sheet (60 s)

| Time | Half | Beat | Source |
|---|---|---|---|
| 0:00–0:03 | play | **Cold open**: the Nine Dragon grapple across the void, hard cut to black on the landing. Type over black: "23 days ago this repo was empty." | HEAD, the alpha's `nd-grapple` re-captured (PT4) |
| 0:03–0:07 | author | **Day 1 is built**: the day-1 stills `progress/001…050` at 12 fps beside the real commit subjects of 16 Sep ticking, clock 22:13 → 23:58 | committed stills + `git log 568a1463f` |
| 0:07–0:13 | play | **Day 1**: stalk, aim, fire the crossbow, the stag drops. Card "DAY 1 · 1 h 46 min · 29 commits" | `568a1463f`, Pine Hollow (PT3) |
| 0:13–0:19 | author | **Lapse to week 1**: Driftwood Isle born over days 2–8, one camera that never stops while the build swaps under it; counter 29 → 624 | ~10 SHAs, 18–23 Sep (PT5) |
| 0:19–0:25 | play | **Week 1**: a sword combo on Driftwood's pier; a gallop across the Nalati steppe | `8a58b9d1e` (PT3) |
| 0:25–0:31 | author | **Lapse to week 2**: Nine Dragon Stack from grey to neon rain; counter → 2,495 | ~10 SHAs, 24–30 Sep (PT5) |
| 0:31–0:37 | play | **Week 2**: first person through the rain square, then the remastered Pine hunt | `19a434635` (PT3) |
| 0:37–0:45 | author | **Sky Reach in 43 hours**: grey pucks to a golden archipelago; on the hit the windmill view becomes the player's eye | the 42 archive captures, curated, plus a landscape re-render (PT5) |
| 0:45–0:51 | play | **Week 3**: step onto the windmill bridge from that view; the whip on the Dune Matriarch | `c9aaa62ab` (PT3) |
| 0:51–0:54 | play | **The rewind moment, on the drop: one bolt, four builds.** The day-1 crossbow fires on Pine's south trail; during the bolt's flight four hard cuts on four drum hits swap day 1 → 8 → 15 → 22 under the same camera; it lands in today's forest | the four SHAs, one scouted spot (PT2, PT3) |
| 0:54–0:57 | author | **How it is made**: one of Jake's real prompts typed large over the terminal of a real Claude Code session | TR5's recording (PT6) |
| 0:57–1:00 | author | **Every shard, one world**: the grid fly-in, then the end card "Day 23 · 7,0xx commits · 6 shards · built with Claude Code" | HEAD `grid.mjs` (PT4); numbers from git (PT7) |

If PT2's scouting shows a beat can't be shot honestly (no prey at the spot, a later build reads worse, a hook missing),
the beat changes to the nearest honest one and the row says so.

### 2.3 Rules

- **Real play** (L5): every play shot is the player's own inputs on a real build at a named SHA: keys, a look track,
  weapon presses, the normal camera, collision, AI and consequences. No camera splines, per-frame teleports, calmed or
  added animals, or staged hits in the play half. Choosing the spawn, the starting look and the take is allowed; the
  HUD may be hidden; the viewmodel stays.
- **Honest authoring**: lapses are real builds at real SHAs, captioned with their real date and commit subject; a
  terminal shown is a real session (TR5), labelled as today's demo, never implied to have made the earlier frames.
- **Receipts** (S10): every number, date and SHA on screen is computed from git by the render, never typed.
- Cards name only what is on screen.

## 3. How

### 3.1 The historical capture (this plan's own folder: `scripts/progress-trailer/`)

v1's `build-rev.sh` exports and builds any SHA from its own lockfile (through the build lane). On top of it, a
**fixed-step, input-driven capture** with one **adapter per era**, kept outside the game's source:
- **Day 1 and day 8** (`window.__world`, a THREE clock): after warm-up, pause Playwright's fake clock, drive the queued
  animation frames one at a time and override `clock.getDelta()` to exactly 1/60; assert one game frame per sample.
  Movement through `player.keys`, look through `player.yaw` / `pitch`, the day-1 crossbow through `adsHeld` /
  `tryFire()` with `nolock`; day 8 through its `weapons` manager. These builds' own URL params are fine (historical).
- **Day 15 and day 22** (`window.__wildshard.world`, the App clock and frame gate): fixed 60 fps, one sub-step; check
  per revision whether movement reads the key set or the InputService before picking the driver.
- **Every take** writes a receipt (served SHA, era adapter, recipe hash, aspect, input track, sim start / end, events
  logged with sim time for the SFX, page errors) and is cached by SHA + shot + aspect + recipe. A take with page errors,
  missing prey or the wrong endpoint is refused, never marked done.
- **Warm-up of at least 10 s** and a frame check against that era's nearest `shard-progress` capture (the R1B-1 lesson).

### 3.2 HEAD shots (the trailer agent's pipeline, unedited)

The cold open, the grid fly-in and any HEAD play run through `scripts/steam-trailer/capture.mjs` as its owner keeps it.
The trailer agent landed what this needs in `64c6d84f0` (2026-10-09, asked over herdr):
- `capture.mjs --shots-file=<path>[,<path>]` and `cut.mjs --cut-file=<path>`, so this plan's shot and cut files live in
  `scripts/progress-trailer/`;
- `lib.mjs` `keyDown` / `keyUp` drive held movement through the InputService at HEAD, plus `held(action, on)`;
- sub-steps advance real simulation time (`--sub 2` = 1/120 s sub-frames; `speed` < 1 is true slow motion).

Titles, mix and edit run unchanged.

### 3.3 The authoring lapses

- **Continuous-camera lapses**: one long camera path per lapse; each SHA is built once and renders only its slice of
  the path, so the camera never stops while the world changes under it. A soft tick per commit, the real commit subject
  in the corner, the commit counter rolling.
- **≤ 10 SHAs per lapse**, chosen where the picture changes most (from git and the dated captures), all builds cached.
- **Sky Reach**: curate 5–7 visually distinct stages per view from the 42 archive captures (check each `meta.json`'s
  QA, page errors and camera), plus a landscape re-render; the 540 px portrait time-lapses are scouting aids only.
- **Day 1**: the committed `progress/001…050` stills beside the commit log, not a re-render.

### 3.4 Sound

One MiniMax Music 3 cue written to the beat sheet: a hit on the cold open, quiet and a little naive under day 1, a
riser through each lapse, **the drop on the rewind moment**, a final hit on the grid. `music_scan.py` finds its hits;
the cut lands on them. SFX on every logged event (crossbow, impact, footsteps, sword, hooves, grapple, whip, keyclicks,
the commit tick), each generated with MOSS-SoundEffect v2 and Stable Audio 3 Medium, the better take. `mix.py` to
−14 LUFS, −1 dBTP, checked on the encoded file.

### 3.5 Week 4 and after

The chapters are data (`scripts/progress-trailer/chapters.json`: date, SHA, play takes, lapse SHAs); the newest
chapter always takes the drop slot and older ones compress. Adding a week is one entry, its takes and a re-run.

## 4. Rows

| # | Row | Done when | Owner |
|---|---|---|---|
| PT0 | ✅ **Jake's picks** (2026-10-09): 16:9 only, 60 s | answers in §6 | Jake |
| PT1 | ✅ **The historical capture rig** (2026-10-09) — `scripts/progress-trailer/`: `build-rev.sh` (any SHA from its own lockfile), `take.mjs` (two era adapters, fake-clock stepping with one game frame per step asserted, `window.__hold` for held moves, a receipt and cache key per take), proof shots `shots/d01-hunt.mjs` (a headshot kill on a stag the build spawned), `d08-hut.mjs`, `d15-square.mjs`, `d22-sunrest.mjs` (the InputService drives day 22); sheet `progress/progress-trailer/pt1-proofs.jpg`. Learned: `player.spawn` drops onto the terrain (under a pier deck, into the sea), so spots need scouting; wrapping day 8's weapon hooks recursed, so melee cue events are the presses | a 5 s input-driven proof take on each of the four SHAs, viewmodel visible, one game frame per sample asserted, receipt written | progress-trailer agent |
| PT2 | **Scout** every play beat's spot on its build, and the rewind spot (Pine's south trail at (0, −236), spawn "unchanged from v1") on all four, after ≥ 10 s warm-up; drop or move any beat where a later build reads worse | one contact sheet per beat, each frame checked against its era's capture; §2.2 updated where a beat moves | progress-trailer agent |
| PT3 | **The play takes** (§2.2 play rows, the rewind moment's four synchronised takes) on their SHAs, at 16:9 | every take refused or accepted by its receipt; first / middle / last frames checked | progress-trailer agent |
| PT4 | **HEAD shots** (cold open, grid fly-in) through the trailer agent's pipeline after their request lands (§3.2) | the takes exist at 1080p60 | progress-trailer agent, the trailer agent for the hooks |
| PT5 | **The lapses** (§3.3): day-1 stills, Driftwood days 2–8, Nine Dragon to week 2, Sky Reach's 43 hours | each lapse plays 6–8 s with a moving camera, real captions and the counter | progress-trailer agent |
| PT6 | **The Claude Code beat**: TR5's real session from the trailer agent, one real prompt from `docs/tasks/asks/` typed large | 3 s, legible on a phone | progress-trailer agent |
| PT7 | **Receipts and titles**: every on-screen number and date generated from git; cards and the end card through the shared titles | a test re-renders the cards from git and matches | progress-trailer agent |
| PT8 | **Score and SFX** (§3.4) | the cue and SFX on disk with credits; the mix at −14 LUFS / −1 dBTP on the encoded file | progress-trailer agent |
| PT9 | **Cut and conform** the master from one EDL through the shared `edit.mjs` | the 16:9 master plays whole; a phone copy sent to Jake | progress-trailer agent |
| PT10 | **Jake's verdict and where it goes** (YouTube, X, the site): his notes become rows here | his words recorded | Jake |
| PT11 | **Re-make recipe and the week-4 drill** (§3.5) | the README's commands run as written; a dry week-4 entry renders | progress-trailer agent |

## 5. Not in this plan

The alpha trailer and its rows (TRAILERS Part A, TR9's seam crossing), the cinematic (TRAILERS Part B), the Steam
cut (FINISH-LINE SC4). `scripts/steam-trailer/` stays the trailer agent's; this plan asks, they land.

## 6. Jake's picks

Asked with the question tool, 2026-10-09:
- **Format: 16:9 only**, a 1920 × 1080 / 60 fps master (not the recommended 16:9 + 9:16 stack).
- **Length: 60 s.**
