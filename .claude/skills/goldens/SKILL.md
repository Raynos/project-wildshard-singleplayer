---
name: goldens
description: Re-capture a shard's 24 golden cameras (or an open plot's 8 views) on a build and compare them against the known-good SHARDFILE goldens, as a labelled LEGACY golden · SHARDFILE golden · NOW board, reading every panel and marking red cameras. Use for "goldens", "golden images", "re-run the goldens", "regression check", "did this break the look", "before landing a render / look / shader / LOD / culling / perf change", "compare legacy vs shardfile", "is shard X ready for QA", "does Nine have goldens", or any claim that a change is pixel-identical. Not for making new mockups (MOCKUPS.md) or memory / fps readings.
---

# Goldens: re-capture and compare (Jake, 2026-11-03)

Read [docs/process/GOLDENS.md](../../../docs/process/GOLDENS.md) first: where every set lives, the rule (a look change
re-captures its shard's 24 cameras on the candidate build and lands only with every camera green), the WebKit triggers
and how a golden is updated. Follow [MACHINE.md](../../../docs/process/MACHINE.md) (browser lane, previews, `./tmp`)
and [GIT.md](../../../docs/process/GIT.md). Subagents: no `set-label.sh`; a capture is a long wait (~10 min a shard),
so a subagent commits what it has and hands the exact capture command to its main agent.

## 1. Find the set

```bash
ls art/shardfile-goldens/ art/legacy-goldens/ art/open-plots/golden-*/    # 6 shards x 24, 6 plots x 8
SLUG=nine-dragon-stack                                                    # one of the six shards
ls art/shardfile-goldens/$SLUG/24/                                        # <nn>-<camera>.jpg, the look to hold
```

Never tell anyone a shard has no goldens without running that `ls`.

## 2. Serve the build

```bash
test -e .git/quiet && echo "official Simulator quiet: wait, don't capture"
SHA=$(git rev-parse HEAD)                     # record before the build: HEAD moves while peers land
# candidate (your uncommitted change, before it lands):
URL=$(SERVE_OWNER=goldens-$SLUG scripts/serve-build.sh --shard $SLUG --name goldens-$SLUG --hours 1)
# landed commit (QA check, plan agent):  ... scripts/serve-build.sh --head ...   or  --rev <sha> (then SHA=<full sha>)
PORT=${URL##*:}; PORT=${PORT%/}
```

## 3. Capture the 24 cameras

```bash
RUN=tmp/goldens/$(date +%F)-$(git rev-parse --short=10 $SHA)-$SLUG
scripts/browser-lane.sh --max 20 node art/legacy-goldens/compare/capture.mjs --base=$URL --sha=$SHA \
  --cameras=art/legacy-goldens/compare/cameras24.json --mode=shardfile --shards=$SLUG --out=$RUN/raw
# WebKit pass (GOLDENS.md triggers: shaders, render targets, clear, blending, textures, culling, any perf cut):
scripts/browser-lane.sh --max 25 node art/legacy-goldens/compare/capture.mjs --base=$URL --sha=$SHA --engine=webkit \
  --cameras=art/legacy-goldens/compare/cameras24.json --mode=shardfile --shards=$SLUG --out=$RUN/raw-webkit
```

- **`--cameras=…cameras24.json` is required.** Without it capture.mjs takes the old 4-camera CO6 file and names frames
  differently. Never `--mode=legacy`: the LEGACY goldens are frozen.
- `--sha` must be the commit the preview was built from (capture refuses a mismatch). `--cams=11,12` re-captures some.
- Engine-wide change: all six, two lanes in parallel, `--shards=driftwood-isle,pine-hollow,nalati-grasslands` and
  `--shards=far-reach,sunscar-dunes,nine-dragon-stack`, `--max 40` each.
- Check `$RUN/raw/receipts-$SLUG.json`: `status` `complete`, `errors` empty. A pose with `idle.settled: false` or
  `live.settled: false` was still streaming: re-capture it with `--cams` before calling it red.

## 4. Build the board and read every panel

```bash
python3 .claude/skills/goldens/board.py --shard $SLUG --now $RUN/raw --out $RUN/board --label "NOW $(git rev-parse --short=7 $SHA)"
python3 .claude/skills/goldens/board.py --shard $SLUG --now $RUN/raw-webkit --out $RUN/board-webkit --label "NOW webkit"
```

It prints SSIM per camera against the SHARDFILE golden and writes `$RUN/board/<nn>-<camera>.jpg` (one row per camera:
LEGACY golden · SHARDFILE golden · NOW, labels burned in) and `board-$SLUG.jpg` (all 24, ≤ 500 KB).

**Open every `<nn>-<camera>.jpg` with the Read tool, all 24**, lowest SSIM first but never only those. Red = NOW
lost or gained something the change didn't mean to against the SHARDFILE golden: a wall, floor, building or prop
missing, a hole, black or blank areas, seams, exposure or colour shift, LOD / texture pops, hands missing. Moving
clouds, rain, crowds, creatures and the hands' sway are not red. On WebKit judge structure, not exact colour. Then burn
the verdict in:

```bash
python3 .claude/skills/goldens/board.py --shard $SLUG --now $RUN/raw --out $RUN/board --label "NOW …" --red 11,12
```

## 5. Report, land, clean up

- **Any red camera: don't land.** Fix and re-capture those cameras, or (a look change meant to be seen, with Jake's
  ruling or a logged G872 decision) promote: `board.py --shard $SLUG --now $RUN/raw --promote 11,12 --source
  "<sha10> G…"` and add the line to `art/shardfile-goldens/README.md`.
- Green: copy the board to `art/golden-runs/$SLUG/<date>-<sha10>-board.jpg` and land it with the change through
  `scripts/commit.sh`, with `Goldens: $SLUG 24/24 green on <build id>` (and the WebKit line) in the body.
- Report: the run, green / red counts, red cameras with one line each, the board path. Show Jake the board, not SSIM.
- `scripts/serve-build.sh stop $PORT`, then `rm -rf` the exact `$RUN` path.

## Open plots (8 views a plot)

Set: `art/open-plots/golden-2026-11-03/<plot>/` (`<n>-<view>.jpg`, `cameras.json`). There is no committed re-shoot
script yet: shoot each view with the free-camera harness the set's README describes (`scripts/capture-plot-domes.mjs`'s
`onLate` camera at `world.eye` → `world.look`, `world.fov`, player at `player`, 402 × 603 portrait), save
`$RUN/raw/<plot>/<n>-<view>.png`, then `board.py --plot <plot> --now $RUN/raw --out $RUN/board`. Commit the script you
wrote beside the set so the next run is one command.

## Is shard X ready for QA? (plan agent)

Run steps 2–4 on `--head` (or `--rev` of the deploy pin) for that shard, plus the WebKit board if the change set hit a
WebKit trigger. Say which run you looked at and how many cameras were green; a red camera means not ready.
