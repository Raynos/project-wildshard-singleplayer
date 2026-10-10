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

Round 1 audited v1 with three fresh seats (Codex capture engineer, Claude evidence, Claude red-team trailer director):
37 findings, 15 must-fix. Round 2 reviewed this plan (Claude evidence and red team; the Codex seat timed out): 38
findings, 10 must-fix, fixed below. Files and the register in [progress-trailer/reviews/](progress-trailer/reviews/).
What v1 got wrong:
- **No gameplay at all**: every "first-person" shot is an eye-height dolly with the viewmodel hidden. v1 has less play
  than the alpha trailer already on the site (its sword combo and horseback archery; the grapple is in the Nine Dragon
  teaser).
- **No authoring half**: no time-lapse, no terminal, no prompt, though Sky Reach (42) and Dunes (57) have dated captures.
- **The progress beat runs backwards**: week 2's "remastered" Pine Hollow is a bare plain (the forest had not streamed
  in: 2 s of warm-up), so it looks worse than day 1.
- **Not epic**: a title card for a hook, near-silent first 1.5 s, slow pushes, eight identical dissolves, a spliced menu
  theme, no SFX, a frozen end frame, nothing to rewind to.
- **Facts left on the table**: day 1 went from an empty repo (22:13) to a crossbow game with deer and cabins by 23:58,
  **1 h 46 min, 29 commits**; commits by chapter **29 → 624 → 2,495 → 5,729**; the 18 Sep first-person trailer
  (`progress/wildshard-trailer.mp4`), the day-1 time-lapse (`progress/timelapse.mp4`), 354 numbered progress stills
  (only 21 of them existed by the end of day 1).
- **Pipeline**: v1 forked its own capture and edit. `scripts/steam-trailer/capture.mjs` cannot film the day-1 / day-8
  builds as it is (it waits for `window.__wildshard.world…app.clock`; those builds have `window.__world` and a THREE
  clock), and its shot and cut loaders only read its own folder.

v1 stays committed as the record; this plan replaces it.

## 2. The trailer

### 2.1 Shape (Jake's picks, §6)

- **A 16:9 master, 1920 × 1080 at 60 fps, 60 s** (YouTube, X, the site beside the alpha trailer); **16:9 only** (Jake,
  PT0): no 9:16 cut, on the phone it plays letterboxed. Not an OS screen recording: desktop appears only as the
  terminal inside the authoring beat.
- **About half and half** (Jake's word; within ±3 s): first-person play and authoring alternate; time passing *is* the
  authoring. Cards and the close sit between them.
- **It escalates.** Play shots get shorter each chapter (day 1 is one 5 s take, week 1 three of ~1.7 s, week 2 three of
  ~1.5 s, week 3 four of ~1.2 s); lapses get longer (3 → 6 → 5 → 8 s, Sky Reach is the showpiece). Every boundary
  snaps to the cue's beat grid (§3.4).
- **Two halves you can tell apart at a glance.** Play is always full-bleed with no UI. Authoring always uses one frame:
  the picture inset at 1440 × 810 and a 480 px rail on the left scrolling the real commit subjects between stages, with
  the commit counter and the date.
- **Not the alpha again** (S12): the history leads (the rewind, the lapses, era-true sound) and the score grows by
  arrangement, so a viewer who saw the alpha trailer sees a different film.

### 2.2 Beat sheet (60 s)

| Time | Half | Beat | Source |
|---|---|---|---|
| 0:00–0:02.2 | play | **Cold open**: the grapple across Nine Dragon's void; frame 0 is the rim with the claw target in view (it is the share thumbnail); hard cut to black on the landing frame | HEAD, the Nine Dragon teaser's `nd-grapple` (`scripts/steam-trailer/shots/nine-dragon.mjs`), from in-point 0 (PT4) |
| 0:02.2–0:03.6 | card | Over black, silence but the landing's tail: **"On 16 Sep 2026 this repo was empty."** | the date of `402198440`, computed (PT7) |
| 0:03.6–0:06.6 | author | **Day 1 is built**: the 21 stills present at `568a1463f`, ordered by the time of the commit that added each, each appearing at its commit's moment on a clock compressed from 22:13 to 23:58; the real subjects scroll in the rail | `git log` of `progress/[0-9][0-9][0-9]-*` up to `568a1463f` (PT5) |
| 0:06.6–0:11.6 | play | **Day 1**, one 5 s take: stalk, raise the crossbow, the stag drops. Card "DAY 1 · 29 commits · 1 h 46 min" | `568a1463f`, `shots/d01-hunt.mjs` (PT3) |
| 0:11.6–0:17.6 | author | **Driftwood Isle is born**: 5–6 stages from `3a83028ec` ("open ocean + the south pier", 18 Sep) to `8a58b9d1e`'s pier, one slow camera; counter 29 → 624 | lapse SHAs picked in PT2 (PT5) |
| 0:17.6–0:22.6 | play | **Week 1**, three shots: the wooden sword's three-tap combo on Driftwood; a mounted gallop across the Nalati steppe; a shot from the saddle (PT2 confirms each verb on the build) | `8a58b9d1e` (PT3) |
| 0:22.6–0:27.6 | author | **Nine Dragon Stack**: a partial square to the full stack (it was neon from its first commit: no grey stage), in-engine from `3719d1d8e` (26 Sep) to `19a434635`; counter → 2,495. If PT2's stages don't read as growth, this lapse becomes the Pine Hollow remaster (24–25 Sep) | PT2, PT5 |
| 0:27.6–0:32 | play | **Week 2**, Nine Dragon only, three shots: the sword in the rain square, the stair street, the crowd | `19a434635` (PT3) |
| 0:32–0:40 | author | **Sky Reach**: grey pucks to a golden archipelago, a 16:9 re-render at archive-picked SHAs from the `aerial-overview` camera craning down to the spawn view; the last stage is `c9aaa62ab` itself, whose final frame is the week-3 take's frame 0 (same SHA, same pose). Caption "the first 43 hours" over the archive stages; the last stage carries its own date | archive SHAs `54e37d4dd` … `6066f959`, then `c9aaa62ab` (PT5) |
| 0:40–0:45 | play | **Week 3**, four shots: from that eye, hover off the edge across the gap; a gust; the whip on the Dune Matriarch | `c9aaa62ab` (PT3) |
| 0:45–0:48 | author | **The breath, how it is made**: music out, keyclicks only; a real Claude Code session's own prompt typed large (≤ 12 words, typed in 1.5 s, held 1.5 s) | the session (PT6) |
| 0:48–0:52.5 | play | **The rewind moment, on the drop: one bolt, four builds.** One input track hip-fires the crossbow at a real stag at one Pine Hollow spot; in true slow motion (0.25×) three hard cuts swap day 1 → 8 → 15 → 22 while the bolt flies, the ambient bed changing at each cut; on day 22 it drops the stag | the four SHAs (PT2, PT3) |
| 0:52.5–0:54.3 | close | **Every shard, one world**: the grid from the top, every cell in view | HEAD `g-reveal` (`shots/grid.mjs`) from in-point 0.05 (PT4) |
| 0:54.3–1:00 | card | The counter lands on HEAD's commit count on the final hit; end card **WILDSHARD · play free in your browser · wildshard.io · Day N · week N+1 next week** | computed (PT7) |

Play ≈ 29 s, authoring ≈ 25 s, cards and close ≈ 6 s. If PT2's scouting shows a beat can't be shot honestly (no prey,
a later build reads worse, a verb missing), the beat changes to the nearest honest one and its row says so.

### 2.3 Rules

- **Real play** (L5): every play shot is the player's own inputs on a real build at a named SHA: keys, a look track,
  weapon presses, the normal camera, collision, AI and consequences. **Allowed start conditions**, each recorded in the
  receipt: the spawn and the starting look, the time of day where the build exposes it, a quest stage a player can
  reach, a boss summoned the way its quest summons it, and the choice of take. A look track may follow a visible target
  with lag. Hits come only from the game's own hit test. **Not allowed**: per-frame position writes, camera splines,
  teleports mid-shot, calmed, added or moved animals. **True slow motion of a real take is allowed** (the simulation
  time-dilated, §3.1). The HUD is hidden; the viewmodel stays.
- **Honest authoring**: lapses are real builds at real SHAs, captioned with their real date; a stage that reads worse
  than the one before it is dropped (stages are monotonic). The terminal beat shows a real session's own prompt, never a
  different prompt typed over it.
- **Era-true**: historical clips get no finishing grade (`grade: 'null'` in the EDL) and their own build's sound
  (§3.4); the progress is the build's, not the grade's.
- **Receipts** (S10): every number, date and SHA on screen is computed from git by the render:
  - `dayOf(sha)` = calendar days (UTC−5) from `402198440` (16 Sep, day 1) to the commit, plus 1 (9 Oct is day 24);
  - commit counts = `git rev-list --count <sha>`;
  - shards = the slugs in `SHARDS` (not `LEGACY_SHARDS`, not `_template` or `blender-template`): 6 at `c9aaa62ab`;
  - spans between two named SHAs ("the first 43 hours" = `54e37d4dd` → `6066f959`).
- **Legible on the phone**: anything meant to be read is ≥ 56 px cap height at 1080 (≈ 11 pt letterboxed on an iPhone),
  ≤ 7 words, on screen ≥ 1.2 s; the terminal prompt ≥ 64 px. Rails and scrolling subjects are texture.
- Cards name only what is on screen.

## 3. How

### 3.1 The historical capture (`scripts/progress-trailer/`, PT1 ✅)

- `build-rev.sh <label> <sha>` exports and builds any commit from its own lockfile through the build lane;
  `dist/SHA` names it. Serve each build statically from scratch (`python3 -m http.server`), never a vite dev server.
- `take.mjs --shot=<file> --url=<build>` films one take: Playwright's fake clock; an **era adapter** pins the game's
  delta (`legacy`, days 1–8 and any `window.__world` SHA: the THREE clock's `getDelta`; `app`, `window.__wildshard.world`
  SHAs: `app.clock.setCapture`) and the runner asserts one drawn game frame per step; `window.__hold(code, on)` drives
  held movement (the key set, or the InputService where the player reads one, day 22 on). A receipt (served SHA,
  recipe hash, input option, sim start / end, events, page errors) is written per take and refuses a take whose
  `accept` fails. Shots set their spawn **on frame 0** (a herd alerts to a player parked near it during warm-up).
- **Capture context**: 1920 × 1080 × 2 (3840 × 2160 frames), desktop (no touch), `tier=desktop` where the build reads
  it, muted, through `scripts/browser-lane.sh`; the phone-capture rule's exception, as steam-trailer's. Never
  `weather=clear` on a shot whose look is its weather (the rain square).
- **Still to add (PT3)**: `speed` and `sub` in the adapter (`getDelta` = speed / (60 × sub) per sample: 0.25× for the
  rewind; `sub 2` for 120 Hz motion blur) and output in `edit.mjs`'s frame format (`%06d.jpg` + `meta.json`
  `{ sub, shard }`), so takes enter the edit as frames and lapses, stills and the terminal as `video` clips.
- **A lapse camera adapter (PT2)**: the free camera from v1's `install-world.js` (camera posed after the frame's update,
  `player.spawn` under it so the world streams), proven on the first and last SHA of each lapse; each lapse stage
  carries its SHA, entry URL and pose. A lapse starts at its first loadable SHA.
- **Reference frames per era** for the frame check: day 1, the 21 stills at `568a1463f`; day 8,
  `progress/wildshard-trailer.mp4` (18 Sep) and the numbered stills of 18–23 Sep; days 15 and 22, the 2 Oct captures
  (`progress/<slug>/20261002-0011-0d59505c/`). "Checked" means `scripts/decide/decide.sh qa` on the take's first,
  middle and last frames with the question "is this the 3D world, unobstructed, from a standing eye?".
- Learned in PT1: `player.spawn` drops onto the terrain (under a pier deck, into the sea), so every spot is scouted;
  wrapping day 8's weapon hooks recursed, so melee cue events are the presses themselves.

### 3.2 HEAD shots and the shared tools (the trailer agent's pipeline, unedited)

The trailer agent landed what HEAD shots need in `64c6d84f0` (asked over herdr): `capture.mjs --shots-file`,
`cut.mjs --cut-file`, InputService held movement in `lib.mjs`, real sub-steps. Asked of them next (PT7): **`titles.mjs
--titles-html=<path>`**, so this trailer's cards (the counter, the rail, the compressed clock, the end card) live in
`scripts/progress-trailer/titles.html`; and the path of TR5's session recording (PT6). Mix and edit run unchanged.

### 3.3 The authoring lapses

- **5–6 stages per 6 s** (≈ 1 s each); each swap lands on a beat with a 2-frame flash and one tick. The camera is slow
  (≤ 5°/s orbit, ≤ 3 m/s crane) so the change is the motion, not the move. Each SHA is built once and renders only its
  slice of the path.
- **Stages are picked** from git and the dated captures where the picture changes most, and kept only if PT2's contact
  sheet shows them monotonic.
- **One subject per lapse is legible** (its first clause, ≤ 48 characters, cut by the render) in the rail; the rest
  scroll as texture.
- **Day 1** is the 21 stills (§2.2), not a re-render. **Sky Reach** uses the archive only to pick SHAs: its stills are
  780 × 1688 portrait with the touch HUD and their framing moves, so the picture is the 16:9 re-render.

### 3.4 Sound

- **A score that grows like the game**: a MiniMax Music 3 cue at a fixed 120 bpm (a bar is 2 s, so 2 / 4 / 6 / 8 s beats
  are whole bars) in an additive arrangement: day 1 a solo music box or felt piano motif; + strings at week 1;
  + percussion at week 2; the full hybrid at week 3; music out for the breath; the drop on the day-22 impact; a final hit
  on the counter. Four seeds; the pick is the one whose `music_scan.py` hits fall within ±0.25 s of §2.2's boundaries,
  else the boundaries move to the take and §2.2 is updated. The rewind's cut hits are `tr:impact`s on the cut frames.
- **Era-true SFX**: days 15, 22 and HEAD from that SHA's own sound files (`git show <sha>:public/…`), placed on the
  take's logged events; days 1 and 8 ship no audio files, so their own WebAudio synth (`crossbowFire`, `boltImpact`,
  `kill`) is rendered in an `OfflineAudioContext` on the served build. MOSS-SoundEffect v2 and Stable Audio 3 Medium
  (the better take) only for trailer families (whoosh, impact, riser, sub), the lapse tick and the keyclicks. In the
  rewind the ambient bed swaps at every cut: four builds you can hear.
- `mix.py` to −14 LUFS, −1 dBTP, checked on the encoded file.

### 3.5 Week 4 and after

The chapters are data (`scripts/progress-trailer/chapters.json`: date, SHA, play takes, lapse stages). The rewind takes
every chapter SHA (≤ 6), its slow motion recomputed so each segment stays ≈ 0.6 s on screen. A new chapter adds a play
beat and a lapse; to stay at 60 s the oldest non-day-1 chapter's play beat compresses first. Day 1 and the rewind never
compress.

## 4. Rows

| # | Row | Done when | Owner |
|---|---|---|---|
| PT0 | ✅ **Jake's picks** (2026-10-09): 16:9 only, 60 s | answers in §6 | Jake |
| PT1 | ✅ **The historical capture rig** (2026-10-09) — `scripts/progress-trailer/`: `build-rev.sh` (any SHA from its own lockfile), `take.mjs` (two era adapters, fake-clock stepping with one game frame per step asserted, `window.__hold` for held moves, a receipt and cache key per take), proof shots `shots/d01-hunt.mjs` (a headshot kill on a stag the build spawned), `d08-hut.mjs`, `d15-square.mjs`, `d22-sunrest.mjs` (the InputService drives day 22); sheet `progress/progress-trailer/pt1-proofs.jpg`. Learned: `player.spawn` drops onto the terrain (under a pier deck, into the sea), so spots need scouting; wrapping day 8's weapon hooks recursed, so melee cue events are the presses | a 5 s input-driven proof take on each of the four SHAs, viewmodel visible, one game frame per sample asserted, receipt written | progress-trailer agent |
| PT2 | **Scout**: (a) every play beat's spot and verb on its build (week 1's combo, gallop and saddle shot at `8a58b9d1e`; week 3's hover and gust at `c9aaa62ab`); (b) the rewind spot: one Pine Hollow spot on all four builds where the eye height differs by < 0.1 m and stags graze on day 22, with an explicit start pose (day 1 spawns at (0, −236), days 8–22 at (0, −235): `568a1463f:src/main.ts:92`, `8a58b9d1e:src/chunks/pine-hollow.ts:21`, `c9aaa62ab:src/shards/pine-hollow/layout.ts:29`); (c) the lapse camera adapter on each lapse's first and last SHA, and each lapse's stages; (d) whether Nine Dragon's stages read as growth | one contact sheet per beat and lapse, each frame checked (§3.1); §2.2 updated where a beat moves | progress-trailer agent |
| PT3 | **The play takes**: `speed` / `sub` and `edit.mjs` frame output in the adapter; every §2.2 play beat on its SHA; the rewind as one input track authored on the day-22 take at a real stag, replayed byte-identical on days 1, 8 and 15, hip-fire (day 1's sight zooms to 50°, later builds to 58°), each take logging the bolt's position per frame so each cut lands where the incoming bolt has flown the same distance | every take accepted by its receipt and checked; the rewind's four takes share one input track | progress-trailer agent |
| PT4 | **HEAD shots** (the cold open `nd-grapple`, the grid `g-reveal`) through the trailer agent's `capture.mjs --shots-file` (`64c6d84f0`) | the takes exist at 1080p60, in-points as §2.2 | progress-trailer agent |
| PT5 | **The lapses** (§3.3): day 1's 21 stills on their compressed clock (3 s, no camera); Driftwood (6 s) and Nine Dragon (5 s), moving camera, 5–6 stages; Sky Reach (8 s), the re-render ending on the week-3 take's frame 0 | each lapse plays at its §2.2 length in the authoring frame with the rail, counter and date | progress-trailer agent |
| PT6 | **The Claude Code beat**: TR5's session (path from the trailer agent) showing its own first prompt, or a new session that opens with the words of the ask whose result is on screen next | 3 s, prompt ≥ 64 px cap height at 1080, cited in the receipt | progress-trailer agent |
| PT7 | **Receipts and titles**: `titles.mjs --titles-html` from the trailer agent (§3.2); the cards, rail, counter and compressed clock in `scripts/progress-trailer/titles.html`; `dayOf`, counts, shards and spans computed (§2.3) | a test renders the cards from git and asserts 29 / 624 / 2,495 / 5,729, day 24 on 9 Oct and 6 shards at `c9aaa62ab` | progress-trailer agent, the trailer agent for the flag |
| PT8 | **Score and SFX** (§3.4) | the cue (picked of four seeds) and the SFX on disk with credits; the mix at −14 LUFS / −1 dBTP on the encoded file | progress-trailer agent |
| PT9 | **Cut and conform** the master from one EDL through the shared `edit.mjs` (historical clips `grade: 'null'`) | the 16:9 master plays whole; a phone copy sent to Jake | progress-trailer agent |
| PT10 | **Jake's verdict and where it goes** (YouTube, X, the site): his notes become rows here | his words recorded | Jake |
| PT11 | **Re-make recipe and the week-4 drill** (§3.5) | the README's commands run as written; a dry week-4 entry renders | progress-trailer agent |

## 5. Not in this plan

The alpha trailer and its rows (TRAILERS Part A, TR9's seam crossing), the cinematic (TRAILERS Part B), the Steam
cut (FINISH-LINE SC4). `scripts/steam-trailer/` stays the trailer agent's; this plan asks, they land.

## 6. Jake's picks

Asked with the question tool, 2026-10-09:
- **Format: 16:9 only**, a 1920 × 1080 / 60 fps master (not the recommended 16:9 + 9:16 stack).
- **Length: 60 s.**
