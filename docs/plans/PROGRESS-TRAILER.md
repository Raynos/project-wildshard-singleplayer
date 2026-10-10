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
- **It escalates, then holds.** Play shots get shorter each chapter (day 1 is one 5 s take, week 1 two of 2 s, week 2
  two of 2 s, week 3 two ~1 s cuts and then an earned hold of ≥ 2 s); the lapses grow to Sky Reach's 8 s showpiece.
  Every boundary is on the 120 bpm grid (a beat 0.5 s, a bar 2 s); §2.2's times are targets that move to the picked
  take's real bars (§3.4).
- **Two halves you can tell apart at a glance.** Play is always full-bleed with no UI. Authoring always uses one frame:
  the picture inset at 1440 × 810; under it a 135 px band with the commit counter, the date and one legible subject
  (≤ 7 words); on the left a 480 px monospace `git log --oneline` rail that scrolls at **the real commits per
  screen-second** (day 1 crawls, Driftwood runs, Nine Dragon and Sky Reach blur), so the rail shows the acceleration
  itself. The one place the frame opens into play is the end of Sky Reach (§2.2).
- **Not the alpha again** (S12): the history leads (the rewind, the lapses, era-true sound) and the score grows by
  arrangement, so a viewer who saw the alpha trailer sees a different film.

### 2.2 Beat sheet (60 s)

| Time | Half | Beat | Source |
|---|---|---|---|
| 0:00–0:02 | play | **Cold open**: the grapple across Nine Dragon's void, re-captured from a new rim and start look (frame 0 is the share thumbnail and must not be the teaser's); hard cut to black on the landing frame | HEAD, `nd-grapple` (`scripts/steam-trailer/shots/nine-dragon.mjs`) with a new start pose (PT4) |
| 0:02–0:04 | card | Over black, silence but the landing's tail: **"16 Sep 2026: an empty repo."** | the date of `402198440`, computed (PT7) |
| 0:04–0:07 | author | **Day 1 is built**: a wall of the 21 stills present at `568a1463f`, each landing as a tile (7 × 3 in the inset) at its commit's moment on a clock compressed from 22:13 to 23:58; the grid is empty for the first 0.86 s under "22:13"; a commit's stills land together in file order, each held ≥ 4 frames; it ends on the whole of day 1 at once | `git log` of `progress/[0-9][0-9][0-9]-*` up to `568a1463f` (PT5) |
| 0:07–0:12 | play | **Day 1**, one 5 s take: stalk, raise the crossbow, the stag drops. Card "DAY 1 · 29 commits" | `568a1463f`, `shots/d01-hunt.mjs` (PT3) |
| 0:12–0:18 | author | **Driftwood Isle is born**: 5–6 stages from `3a83028ec` ("open ocean + the south pier", 18 Sep) to `8a58b9d1e`'s pier, one slow camera; the counter shows each stage's own count (232 → 624) | lapse SHAs picked in PT2 (PT5) |
| 0:18–0:22 | play | **Week 1**, two shots of 2 s: the wooden sword's three-tap combo on Driftwood; a mounted gallop across the Nalati steppe (PT2 confirms each verb on the build) | `8a58b9d1e` (PT3) |
| 0:22–0:28 | author | **Nine Dragon Stack**: a partial square to the full stack (neon from its first commit: no grey stage), in-engine from `3719d1d8e` (26 Sep, count 1,483) to `19a434635` (2,495). If PT2's stages don't read as growth, this lapse becomes the Pine Hollow remaster (24–25 Sep) | PT2, PT5 |
| 0:28–0:32 | play | **Week 2**, Nine Dragon only, two shots of 2 s: the sword in the rain square; the stair street | `19a434635` (PT3) |
| 0:32–0:40 | author | **Sky Reach in its first 43 hours**: grey pucks to a golden archipelago, a 16:9 re-render at archive-picked SHAs from the `aerial-overview` camera (slow, ≤ 3 m/s); on a beat it cuts to a near-spawn crane for the last stage, `c9aaa62ab` itself; over the last bar the rail slides out and the inset grows to full-bleed, landing on the week-3 take's frame 0 (same SHA, same pose) | archive SHAs `54e37d4dd` … `6066f959c`, then `c9aaa62ab` (PT5) |
| 0:40–0:44 | play | **Week 3**: from that eye, hover off the edge across the gap; the war fan's gust; then **the earned hold**, ≥ 2 s: the whip on the Dune Matriarch through a hit and her reaction | `c9aaa62ab` (PT3) |
| 0:44–0:46 | author | **The breath**: one bar of silence but keyclicks; Jake's day-1 line appears as the `+` line it was (a verbatim excerpt of "you use claude code as the UI for building"), with its SHA and time: **"you use claude code as the UI"** (`b39cc8b8a`, 16 Sep 22:22, `sources/WILDSHARD.md`) | git (PT6) |
| 0:46–0:52 | play | **The rewind moment: one bolt, four builds.** At one Pine Hollow spot whose ground matches on all four builds (PT2), the player spawns at the firing spot on frame 0 and one input track (look and fire only, hip-fire) is replayed on each build. A speed ramp: 1× through the raise and release; ≈ 0.05× from the release through three hard cuts (day 1 → 8 → 15 → 22) while the bolt is 2 / 4 / 6 m out and the crossbow model changes in the player's hands; back to 1× before impact, so the hit, the stag's fall and the drop (on 0:50) land at real speed | the four SHAs (PT2, PT3) |
| 0:52–0:54 | close | **One world**: the grid from above | HEAD `g-reveal` (`shots/grid.mjs`) from in-point 0.05 (PT4) |
| 0:54–1:00 | card | Two cards on bars: **"WILDSHARD · Day 24 · 7,0xx commits"** landing on the final hit (the counter rolls to HEAD's count), then **"Play free · wildshard.io"** | computed (PT7) |

Play ≈ 25 s, authoring ≈ 25 s, cards and close ≈ 10 s (about half and half). If PT2's scouting shows a beat can't be shot
honestly (no prey, a later build reads worse, a verb missing), the beat changes to the nearest honest one and its row
says so.

### 2.3 Rules

- **Real play** (L5): every play shot is the player's own inputs on a real build at a named SHA: keys, a look track,
  weapon presses, the normal camera, collision, AI and consequences. **Allowed start conditions**, each recorded in the
  receipt: the spawn and the starting look, the time of day where the build exposes it, a quest stage a player can
  reach, a boss summoned the way its quest summons it, and the choice of take. A look track may follow a visible target
  with lag. Hits come only from the game's own hit test. **Not allowed**: per-frame position writes, camera splines,
  teleports mid-shot, calmed, added or moved animals. **True slow motion of a real take is allowed** (the simulation
  time-dilated, §3.1). The HUD is hidden; the viewmodel stays.
- **Honest authoring**: lapses are real builds at real SHAs, captioned with their real date; a stage that reads worse
  than the one before it is dropped (stages are monotonic). Words shown as someone's are theirs, verbatim, with their
  SHA and date; never a different prompt typed over a session.
- **Era-true**: historical clips get no per-shard grade (`grade: 'none'` in the EDL; `edit.mjs`'s vignette and grain
  are the same over every clip) and their own build's sound (§3.4); the progress is the build's, not the grade's.
- **Receipts** (S10): every number, date and SHA on screen is computed from git by the render:
  - `dayOf(sha)` = calendar days (UTC−5) from `402198440` (16 Sep, day 1) to the commit, plus 1 (9 Oct is day 24);
  - commit counts = `git rev-list --count <sha>` of the SHA on screen (a lapse's counter shows each stage's own count
    and rolls between stages on the swap);
  - spans between two named SHAs ("the first 43 hours" = `54e37d4dd` → `6066f959c`).
  (No shard count is on screen; if one is added, it is the `src/shards/*/manifest.ts` folders at that SHA minus `_*`,
  `*-legacy` and `blender-template`: 6 at `c9aaa62ab`.)
- **Legible on the phone**: every block of text meant to be read (a card, the band's subject, the breath's line) is
  ≥ 56 px cap height at 1080 (≈ 11 pt letterboxed on an iPhone), ≤ 7 words, on screen ≥ 1.2 s; a longer message is
  split into cards. The rail is texture.
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
- **Slow motion and sub-steps** (landed after PT1): `--speed` (`getDelta` / `setCapture` = speed / (60 × sub) per
  sample: 0.25× for the rewind) and `--sub 2` (two samples per 60 fps frame, blended into motion blur by `edit.mjs`);
  `step` runs once per 1/60 s of simulation whatever the speed, so one input track replays identically: day 1's hunt
  fires at +1.27 s and drops the stag at +1.66 s at 1× and at 0.25× / sub 2 alike. Takes are written in `edit.mjs`'s
  frame format (`%06d.jpg` per sample + `meta.json` `{ sub, shard: 'none' }`, so no shard grade), `--scale 2` for
  3840 × 2160; lapses, stills and the terminal enter the edit as `video` clips.
- **A lapse camera adapter (PT2)**: the free camera from v1's `install-world.js` (camera posed after the frame's update,
  `player.spawn` under it so the world streams), proven on the first and last SHA of each lapse; each lapse stage
  carries its SHA, entry URL and pose. A lapse starts at its first loadable SHA.
- **"Checked"** is two steps, both written into the receipt: (1) `scripts/decide/decide.sh qa --set capture-status`
  on the first, middle and last frames, the gate for loading, blank, menu and error screens only (it cannot judge a
  bare plain); (2) the executing agent reads those frames beside the era's reference in the PT2 contact sheet and writes
  one line per frame: the world streamed in (forest, props), prey present where the beat needs it, and, for the rewind
  and the lapses, visibly better than the previous era. References, dated honestly: day 1, the 21 stills at `568a1463f`;
  day 8, the numbered stills committed 22–23 Sep (days 7–8, 62 of them); days 15 and 22, the nearest capture,
  `progress/<slug>/20261002-0011-0d59505c/` (day 17).
- Learned in PT1: `player.spawn` drops onto the terrain (under a pier deck, into the sea), so every spot is scouted;
  wrapping day 8's weapon hooks recursed, so melee cue events are the presses themselves.
- Learned in PT2's first probe (`shots/probe-pine.mjs`): Pine Hollow's remaster reshaped the ground (days 1 and 8 agree,
  days 15 and 22 agree, the pairs differ by 0.6–2 m near the day-22 herds at (97, −220)); on a 20 m grid over the
  shard, 20 points match within 0.1 m on all four builds, among them the south trail at (0, −210…−230), (120…140, 150),
  (−140, 130) and (−180, 90). The rewind's spot is one of them.

### 3.2 HEAD shots and the shared tools (the trailer agent's pipeline, unedited)

The trailer agent landed what HEAD shots need in `64c6d84f0` (asked over herdr): `capture.mjs --shots-file`,
`cut.mjs --cut-file`, InputService held movement in `lib.mjs`, real sub-steps; then in `af87b952b`: **`titles.mjs
--titles-html=<path>`** (the page defines `window.pose(card, t, opts)` and `window.setPortrait(on)`), so this trailer's
cards (the counter, the rail, the compressed clock, the end card) live in `scripts/progress-trailer/titles.html`; and
TR5's session in git, `progress/trailers/tr5-lookout-session.cast` (asciinema v3, its first user line is the original
prompt; `build-beat.mjs` shows how it renders). Mix and edit run unchanged.

### 3.3 The authoring lapses

- **5–6 stages per 6 s** (≈ 1 s each); each swap lands on a beat with a 2-frame flash and one tick. The camera is slow
  (≤ 5°/s orbit, ≤ 3 m/s crane) so the change is the motion, not the move. Each SHA is built once and renders only its
  slice of the path.
- **Stages are picked** from git and the dated captures where the picture changes most, and kept only if PT2's contact
  sheet shows them monotonic.
- **One subject per lapse is legible** (≤ 7 words, cut by the render) in the band under the inset; the rail scrolls at
  the real commit rate as texture.
- **The lapse renderer** writes finished 1920 × 1080 `video` clips with the picture already set into the inset and the
  band; the rail and band text come from `titles.html` (`edit.mjs` only scales clips to full frame). Sky Reach's last
  bar grows the inset to full-bleed.
- **Day 1** is the wall of 21 stills (§2.2), not a re-render. **Sky Reach** uses the archive only to pick SHAs: its
  stills are 780 × 1688 portrait with the touch HUD and their framing moves, so the picture is the 16:9 re-render (the
  overview stages, then a cut on a beat to the near-spawn crane: 98 m of descent can't fit 8 s at ≤ 3 m/s).

### 3.4 Sound

- **A score that grows like the game**: one full hybrid MiniMax Music 3 cue at a fixed 120 bpm, picked of four seeds by
  `music_scan.py`, split into stems with htdemucs (as `cuts/nine-dragon.mjs` does) and **arranged by unmuting stems at
  the chapter starts**: melody alone under day 1, + bass and strings at week 1, + drums at week 2, everything at week 3.
  The cue's in-point is chosen so its strongest downbeat lands on the day-22 impact, and §2.2's boundaries move to the
  take's real bars (the primary method, not a fallback).
- **The climax in sound**: the breath is one bar of silence but keyclicks; under the slow section a riser and a sub swell
  (trailer families); the four ambient beds play at real pitch and swap at each cut (four builds you can hear), and only
  the bolt's whoosh is pitched down; **the drop and a `tr:impact` land on the impact frame**; a final hit on the counter.
- **Era-true SFX**: days 15, 22 and HEAD from that SHA's own sound files (`git show <sha>:public/…`), placed on the
  take's logged events; days 1 and 8 ship no audio files, so their own WebAudio synth (`crossbowFire`, `boltImpact`,
  `kill`) is rendered in an `OfflineAudioContext` on the served build. MOSS-SoundEffect v2 and Stable Audio 3 Medium
  (the better take) only for trailer families (whoosh, impact, riser, sub), the lapse tick and the keyclicks.
- `mix.py` to −14 LUFS, −1 dBTP, checked on the encoded file.

### 3.5 Week 4 and after

The chapters are data (`scripts/progress-trailer/chapters.json`: date, SHA, play takes, lapse stages). The rewind takes
every chapter SHA (≤ 6), its slow section recomputed so each segment stays readable (bolt ≥ 6 px at each cut). A new
chapter costs about 10 s (a play beat and a lapse) and the film stays 60 s (3,600 frames). The seconds come, in order,
from: (1) the oldest middle chapter folds into one 4 s beat (a 2.5 s lapse and one 1.5 s shot); (2) the end cards
shrink to 4 s; (3) every lapse caps at 5 s except the newest, which keeps the 8 s showpiece. The cold open, the day-1
wall and take, the breath and the rewind never compress. The newest chapter's week = (dayOf(chapter) − 1) / 7.

## 4. Rows

| # | Row | Done when | Owner |
|---|---|---|---|
| PT0 | ✅ **Jake's picks** (2026-10-09): 16:9 only, 60 s | answers in §6 | Jake |
| PT1 | ✅ **The historical capture rig** (2026-10-09) — `scripts/progress-trailer/`: `build-rev.sh` (any SHA from its own lockfile), `take.mjs` (two era adapters, fake-clock stepping with one game frame per step asserted, `window.__hold` for held moves, a receipt and cache key per take), proof shots `shots/d01-hunt.mjs` (a headshot kill on a stag the build spawned), `d08-hut.mjs`, `d15-square.mjs`, `d22-sunrest.mjs` (the InputService drives day 22); sheet `progress/progress-trailer/pt1-proofs.jpg`. Learned: `player.spawn` drops onto the terrain (under a pier deck, into the sea), so spots need scouting; wrapping day 8's weapon hooks recursed, so melee cue events are the presses | a 5 s input-driven proof take on each of the four SHAs, viewmodel visible, one game frame per sample asserted, receipt written | progress-trailer agent |
| PT2 | **Scout**: (a) every play beat's spot and verb on its build (week 1's combo, gallop and saddle shot at `8a58b9d1e`; week 3's hover and gust at `c9aaa62ab`); (b) the rewind spot: one Pine Hollow spot on all four builds where the ground differs by < 0.1 m (§3.1 lists the candidates) and stags graze on day 22, with an explicit start pose (day 1 spawns at (0, −236), days 8–22 at (0, −235): `568a1463f:src/main.ts:92`, `8a58b9d1e:src/chunks/pine-hollow.ts:21`, `c9aaa62ab:src/shards/pine-hollow/layout.ts:29`); (c) the lapse camera adapter on each lapse's first and last SHA, and each lapse's stages; (d) whether Nine Dragon's stages read as growth. The rewind spot is one of §3.1's matching points, aimed where the builds show the most authored change, with a day-22 stag within 14 m (≥ 80 px at impact) | one contact sheet per beat and lapse, each frame checked (§3.1), the rewind spot's four frames each visibly better than the last (else escalate to Jake before PT3); §2.2 updated where a beat moves | progress-trailer agent |
| PT3 | **The play takes**: `speed` / `sub` and `edit.mjs` frame output in the adapter; every §2.2 play beat on its SHA; the rewind as one look-and-fire input track (spawn at the firing spot on frame 0) authored on the day-22 take at a real stag, replayed byte-identical on days 1, 8 and 15, hip-fire (day 1's sight zooms to 50°, later builds to 58°), with the §2.2 speed ramp, each take logging the bolt's position per frame so each cut lands where the incoming bolt has flown the same distance | every take accepted by its receipt and checked; the rewind's four takes share one input track; the bolt ≥ 6 px at each cut frame, the stag ≥ 80 px at impact and down before the grid | progress-trailer agent |
| PT4 | **HEAD shots** (the cold open `nd-grapple`, the grid `g-reveal`) through the trailer agent's `capture.mjs --shots-file` (`64c6d84f0`) | the takes exist at 1080p60, in-points as §2.2 | progress-trailer agent |
| PT5 | **The lapses** (§3.3): day 1's wall of 21 stills on their compressed clock (3 s, no camera); Driftwood (6 s) and Nine Dragon (6 s), moving camera, 5–6 stages; Sky Reach (8 s), the overview stages then the near-spawn crane, its last bar opening to full-bleed on the week-3 take's frame 0 | each lapse plays at its §2.2 length in the authoring frame with the rail, counter and date | progress-trailer agent |
| PT6 | **The breath**: Jake's day-1 line "you use claude code as the UI" (`b39cc8b8a`, `sources/WILDSHARD.md`) shown as its `+` diff line with SHA and time, keyclicks under it (TR5's session `progress/trailers/tr5-lookout-session.cast` may run as texture in a lapse's rail, dated "9 Oct · a real session"; its 68-word prompt is never the read) | 2 s, ≥ 56 px cap height, verbatim, cited in the receipt | progress-trailer agent |
| PT7 | **Receipts and titles**: `titles.mjs --titles-html` (`af87b952b`, §3.2); the cards, rail, counter and compressed clock in `scripts/progress-trailer/titles.html`; `dayOf`, counts, shards and spans computed (§2.3) | a test renders the cards from git and asserts 29 / 624 / 2,495 / 5,729, the lapse stage counts (232, 1,483, 3,117 …) and day 24 on 9 Oct | progress-trailer agent |
| PT8 | **Score and SFX** (§3.4) | the cue (picked of four seeds) and the SFX on disk with credits; the mix at −14 LUFS / −1 dBTP on the encoded file | progress-trailer agent |
| PT9 | **Cut and conform** the master from one EDL through the shared `edit.mjs` (historical clips `grade: 'none'`) | the 16:9 master plays whole; a phone copy sent to Jake | progress-trailer agent |
| PT10 | **Jake's verdict and where it goes** (YouTube, X, the site): his notes become rows here | his words recorded | Jake |
| PT11 | **Re-make recipe and the week-4 drill** (§3.5) | the README's commands run as written; a dry week-4 entry renders to exactly 3,600 frames by §3.5's order | progress-trailer agent |

## 5. Not in this plan

The alpha trailer and its rows (TRAILERS Part A, TR9's seam crossing), the cinematic (TRAILERS Part B), the Steam
cut (FINISH-LINE SC4). `scripts/steam-trailer/` stays the trailer agent's; this plan asks, they land.

## 6. Jake's picks

Asked with the question tool, 2026-10-09:
- **Format: 16:9 only**, a 1920 × 1080 / 60 fps master (not the recommended 16:9 + 9:16 stack).
- **Length: 60 s.**
