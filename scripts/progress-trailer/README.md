# The progress trailer — re-make recipe (PROGRESS-TRAILER PT11, E468)

The 60 s "building my first MMO" trailer: first-person play on each chapter's own historical build, authoring
time-lapses of real builds per stage, every number from git. Plan (archived): `project/archive/2026-10-10-progress-trailer.md`. Keep every output
in one private scratch folder (`$T`); every browser run goes through `scripts/browser-lane.sh`.

## 1. Builds (any SHA, from its own lockfile, through the build lane)

```bash
cd $T && for p in "d01 568a1463f" "d08m 2d2c5815a" "d15 19a434635" "d22 c9aaa62ab"; do
  bash $REPO/scripts/progress-trailer/build-rev.sh $p; done          # → $T/<label>/dist (dist/SHA names it)
python3 -m http.server 4721 --bind 127.0.0.1 --directory $T/d01/dist &   # 4725 d08m · 4723 d15 · 4724 d22 (kill by PID after)
scripts/serve-build.sh --head --name pt4                                 # today's build for the cold open and the grid
```

## 2. Play takes (`take.mjs`, real input, one game frame per sample)

```bash
take() { scripts/browser-lane.sh --max 30 node scripts/progress-trailer/take.mjs --out=$T/final --scale=2 --sub=2 "$@"; }
take --shot=scripts/progress-trailer/shots/d01-hunt.mjs   --url=http://127.0.0.1:4721
take --shot=scripts/progress-trailer/shots/w1-combo.mjs   --url=http://127.0.0.1:4725 --frames=270
take --shot=scripts/progress-trailer/shots/d15-square.mjs --url=http://127.0.0.1:4723
take --shot=scripts/progress-trailer/shots/w2-gallop.mjs  --url=http://127.0.0.1:4723
take --shot=scripts/progress-trailer/shots/w3-hover.mjs   --url=http://127.0.0.1:4724       # spawns at the crane's end, (0, −5.5)
take --shot=scripts/progress-trailer/shots/w3-whip.mjs    --url=http://127.0.0.1:4724 --opt='{"prey":"strider"}'
```

**The rewind** (one input track on all four builds). The hip spread draws per rendered frame, so find the day-22 fire
frame that kills **in the final setup** (sub 2, the final ramp starting just after the shot), then shoot all four with it:

```bash
A='"spot":[230,0],"aim":[222.39,1.8,-9.47],"fire":118'; R='--ramp=[[1.9677,1],[1.9833,0.05],[2.0833,0.05],[2.1233,1]]'
take --shot=scripts/progress-trailer/shots/rewind.mjs --frames=330 "$R" --url=http://127.0.0.1:4724 --opt="{$A,\"authoring\":true}"
take --shot=scripts/progress-trailer/shots/rewind.mjs --frames=330 "$R" --url=http://127.0.0.1:4721 --era=legacy --query='nolock=1&skipintro=1&mute=1' --opt="{$A}"
take --shot=scripts/progress-trailer/shots/rewind.mjs --frames=330 "$R" --url=http://127.0.0.1:4725 --era=legacy --query='chunk=pine-hollow&nolock=1&skipintro=1&mute=1&tracer=0' --opt="{$A}"
take --shot=scripts/progress-trailer/shots/rewind.mjs --frames=330 "$R" --url=http://127.0.0.1:4723 --opt="{$A}"
python3 scripts/progress-trailer/cut-rewind.py - <day1> <day8> <day15> <day22 take dirs> --from=0.25 --frames-out=$T/cut/rewind
```

**Today's build**: `scripts/browser-lane.sh node scripts/steam-trailer/capture.mjs $T/head --shots-file=scripts/progress-trailer/head-shots.mjs --sub 2 --scale 2 --base=<serve-build URL>`.

## 3. Lapses, cards, sound

```bash
# each stage of each lapse (lapses/*.mjs), on its own build; then the clip
scripts/browser-lane.sh node scripts/progress-trailer/lapse.mjs render --lapse=scripts/progress-trailer/lapses/<name>.mjs --stage=<sha> --url=<build> --out=$T/lapses/out
node scripts/progress-trailer/lapse-cut.mjs cut --lapse=scripts/progress-trailer/lapses/<name>.mjs --out=$T/lapses/out --mp4=$T/lapses/<name>.mp4
# every on-screen number from git, then the cards
node scripts/progress-trailer/receipts.mjs --out=$T/receipts && node --test scripts/progress-trailer/receipts.test.mjs
scripts/browser-lane.sh node scripts/steam-trailer/titles.mjs $T/titles $T/receipts/cards.json --titles-html=scripts/progress-trailer/titles.html
# the score (one local model at a time) and the era-true sound (era-audio.mjs / era-sfx.mjs, see their headers)
cd scripts/music/gen && lockf -k ~/projects/localai/.model.lock ~/ml/music/minimax-music3/.venv/bin/python gen_minimax.py \
  --jobs $REPO/scripts/progress-trailer/score-jobs.json --keys progress/score --seeds 401,402,403,404 --out $T/score
```

## 4. Cut

```bash
node scripts/progress-trailer/assemble.mjs $T/cut/config.json -        # with "edlOnly": true → $T/cut/edl.json
python3 scripts/progress-trailer/mixbuild.py $T/cut/mixcfg.json $T/cut/mix.json
~/ml/music/analysis/.venv/bin/python scripts/steam-trailer/mix.py $T/cut/mix.json $T/cut/mix.wav
node scripts/progress-trailer/assemble.mjs $T/cut/config.json $T/cut/wildshard-progress-trailer.mp4   # "edlOnly": false, "mix": mix.wav
```

`config.json`: `{ work, titles, mix, takes: { <shot>: <take dir> }, lapses: { driftwood, pine-hollow, sky-reach: <clip> },
edit: { <shot>: { in, dur } } }` (see `assemble.mjs`). `mixcfg.json`: see `mixbuild.py`.

## 5. Week 4 and after

Add the chapter to `chapters.json` (date, SHA, its lapse) and its lapse module; shoot its play beat; the seconds come
from §3.5's order, checked by `node scripts/progress-trailer/week4-drill.mjs` (the week-3 and week-4 EDLs both 3,600
frames). The rewind takes every chapter SHA; re-run its fire-frame search on the newest build.
