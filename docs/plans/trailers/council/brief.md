# TRAILERS Part B council — the brief every seat gets (2026-10-10)

You are one seat of a council (docs/process/COUNCIL.md) reviewing **the first draft of the cinematic concept trailer
plan** for Project Wildshard (an MMO of player-built shards, made in Claude Code; the singleplayer alpha has six shards).
You are a fresh agent: read the documents and the evidence, never anyone's conversation.

## Read

1. `docs/plans/TRAILERS.md` §3 (Part B) and §5 (Jake's picks).
2. `docs/plans/trailers/ct2-script.md` — **the document under review** (script, shots, the method per shot, cost).
3. `docs/plans/trailers/council/ledger.md` — frozen; reopen an item only with new evidence.
4. `docs/plans/trailers/council/battery.md` — walk every scenario.
5. `docs/plans/trailers/ct1-shot.md`, `docs/plans/trailers/research-2026-10-09.md`.
6. `docs/design/mmo/VISION.md` (the world, the highway, the upload ritual).

## Look (the evidence; read images with your image tool, extract video frames with ffmpeg)

`$CT = /private/tmp/claude-501/-Users-raynos-projects-games-wildshard-singleplayer/9acb64f7-675c-4542-9689-2df62204d961/scratchpad/ct1`
- `$CT/lane-0/ct1-board.mp4` (every experiment, labelled), `$CT/results/<nn>-*/` (each output + notes.md),
  `$CT/lane-0/r10b/out.mp4` (#10b), `$CT/blockout/` (the grey input), `$CT/keyframes/`.
- `art/trailers/round-2-highway/` — the new look: three references (golden aerial, night aerial, crossroads), six shard
  concept paintings from in-engine views, and the draft-2 storyboard (`board-*.jpg`, `b01..b15.jpg`).
- In-engine truth: `site/public/media/wide-*.webp`, `progress/<slug>/…/h1-*.jpg`, `art/grid/round-4-crossroads/`.

## The bar (design doc + execution plan)

A finding needs a **location** (doc §, shot #), **evidence** (file/frame/quote) and a **concrete fix**. It counts if the
person making the trailer would **make a worse trailer, fail, or have to guess**, or a claim is **wrong** against its
evidence. Severities: `must-fix`, `should-fix`, `nit`, `should-add` (an idea that changes what gets built, with the
reason). Don't re-argue the ledger without new evidence.

## Write

`docs/plans/trailers/council/round-<n>-seat-<A|B|C>.md` (create it; edit nothing else, commit nothing):
a findings table (ID like `R1A-1`, severity, location, finding, evidence, fix), then your battery results (each scenario:
pass / fail + where the doc fails), then one last line: `Verdict: <one sentence>`. ≤ 120 lines. Do not run
~/.claude/set-label.sh, do not start browsers or local models, do not delete anything.
