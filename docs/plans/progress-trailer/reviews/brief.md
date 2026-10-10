# Brief: the progress trailer council (E468), every seat

You are one seat of a three-seat council (docs/process/COUNCIL.md). You are a fresh agent: you have not seen the
conversation that made the video. Read this brief, `ledger.md` (frozen), `battery.md` and `register.md` in this folder.

## The object

**Round 1 audits a video**: `progress/progress-video/wildshard-day1-to-week3.mp4` (29 s, 720×1280 portrait). How it was
made: `progress/progress-video/README.md` and `tools/`. A 1 fps contact sheet: `progress/progress-video/v1-contact-1fps.jpg`.
Jake's verdict is ledger L1. Watch it: pull frames with ffmpeg into **your own private folder**
(`/private/tmp/claude-501/progress-trailer-council/<your seat>/`, create it; never write anywhere else outside this
reviews folder), look at them, listen to the audio's shape if useful (ffmpeg `astats` / `ebur128`).

Then answer the real question: **what should the progress trailer be?** Jake wants a new plan (L2): half first-person
gameplay, half shard authoring (time-lapse / progress of a shard over time), still a story of the game being built over
time (L3). Format is open (L4).

What exists to build from (check it, don't trust this list):
- Every commit since 16 Sep 2026 is in git; v1's `tools/build-rev.sh` exports and builds any of them (the old builds use
  their own URL params and `window.__world` / `window.__wildshard.world` hooks).
- `scripts/steam-trailer/` (TRAILERS, L6): shots as code with player-input or spline rigs, fixed-step 4K / 120 Hz capture,
  titles, score, mix, conform; README § The alpha trailer. The alpha trailer itself: `site/media.json` → `trailer`.
- Shard time-lapses: `scripts/shard-progress.mjs` + `scripts/shard-timelapse.py`; `progress/far-reach/` (42 dated
  captures) and `progress/sunscar-dunes/` (57), each with `timelapse-*.mp4` and `clips.mp4`.
- TRAILERS TR5's "build beat": a real Claude Code session (asciinema) beside Sky Reach's time-lapse.
- Blow-by-blow PDFs in `docs/*-blow-by-blow.pdf`; mockup rounds in `art/`; ~8,000 progress images in `progress/` and `art/`.

## Your output

Write **one file**: `docs/plans/progress-trailer/reviews/round-<n>-seat-<A|B|C>.md`. Do not commit (the lead commits);
do not edit any other file in the repo.

1. **Findings table** — `| ID | Severity | Where (timestamp in v1, or plan §) | Finding | Evidence | Fix |`. IDs
   `R<n><seat>-<k>` (e.g. R1A-3). Severities per COUNCIL.md for a design doc: `must-fix`, `should-fix`, `should-add`
   (only with why it changes what gets built), `nit`. Evidence is a frame you looked at (timestamp), a file and line, a
   command's output, or a source.
2. **Battery walk** — each scenario S1–S9: pass / fail and one or two lines why. Add a scenario if one is missing.
3. **Recommendation** (round 1 only, ≤ 40 lines): the trailer you would make: format(s) and length, the structure beat by
   beat with seconds, where each shot comes from (which build / SHA, which existing capture, which tool), how the
   first-person gameplay is driven and captured, how the authoring half shows change over time, the sound, what to
   reuse, the two biggest risks. Name the one rewind moment (S9).
4. Last line: `Verdict: <one sentence>`.

Keep the whole file under ~150 lines. Be concrete, cite evidence, no filler.

## Rules

- Don't run `~/.claude/set-label.sh`. Follow docs/process/GIT.md (you write only your seat file; never stash, checkout,
  restore or commit).
- You should not need a game browser. If you must open one, run it through `scripts/browser-lane.sh`, muted, captured
  as an iPhone 16 Pro, and close it before you finish. No vite dev servers; no app builds.
- Delete your private folder's throwaways before you finish.

## Round 2 (the plan)

The object is now the plan: **`docs/plans/PROGRESS-TRAILER.md`** (an execution plan: a finding counts if an executing
agent would **fail, do the wrong thing, or have to guess**, or a claim is wrong against its evidence; COUNCIL.md's
table). This is the plan's first review, so the surface is the whole plan, plus the battery S1–S10 walked through the
plan (not v1). The register lists round 1 and how the plan answered it; a repeat of a closed row without new evidence
is closed on sight. Write `round-2-seat-<A|B|C>.md`: findings table (IDs `R2<seat>-<k>`), battery walk, verdict line.
No recommendation section this round: fixes go in each finding's Fix column. Under ~120 lines.
