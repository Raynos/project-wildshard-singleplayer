# W1 C1 baked-tile parity (sp-o127, 2026-10-13)

The before / after check for C1 (static world) in wave 1: Sky Reach (`far-reach`) and
Signal Dunes (`sunscar-dunes`) static pieces moving from runtime fits and code builders
to baked generator outputs. A bake that is exact (float32 geometry, same materials) shows
**0 differing pixels** on every pose. Anything else shows on a labelled board.

## Baseline at HEAD `3797f3f84` (build `3797f3f-mv6qqt3n`)

- [baseline/sky/summary.json](baseline/sky/summary.json) and
  [baseline/signal/summary.json](baseline/signal/summary.json): each pose's pixel hash,
  draws and triangles, plus each tier's GPU bytes, program count, shader-source hash and
  collider hash.
- [sky-phone-sheet.jpg](sky-phone-sheet.jpg) and [signal-phone-sheet.jpg](signal-phone-sheet.jpg):
  the phone-tier poses, labelled.
- Repeatability: two captures of the same build compared equal on every row: `sky: 3797f3f-mv6qqt3n = 3797f3f-mv6qqt3n on 18 rows (pixels, draws, triangles, GPU bytes, programs, shaders, colliders)`, and the same line for signal.

The poses: the six look poses each shard's look-parity proof already has, plus three C1
close-ups (`--poses=c1`):

- **Sky:** `c1-lectern` (the Sunrest lectern and lantern), `c1-mill` (the mill) and
  `c1-lectern-west`. The six look poses cover the trees, the sky isles and the crown dais.
- **Signal:** `c1-well` (the well shell), `c1-caravan-lamp` (the caravan and its lamp glass)
  and `c1-tower-deck` (the keeper tower's deck and lamp). The look pose `well` frames the
  well from a distance. The shaft disc is visible only from the rim, so no pose shows it.

Capture settings: Chromium on Metal as "iPhone 16 Pro" (Playwright's 402 × 681 portrait viewport at DPR 2: 804 × 1362 frames),
phone and desktop tiers, a DEVSERVER build, capture clock 30 fps, pinned `Math.random`, a
plain scene render with every time uniform held at 10, the viewmodel hidden. Two captures
of one build are byte-identical.

## How a Codex lane runs it on its candidate

Capture the base and the candidate in the same session. Other lanes' look changes move
pixels too, so the base should be the candidate's parent commit, not this folder's baseline.

```sh
mkdir -p /private/tmp/sp-lanes/<lane>/c1 && cd /private/tmp/sp-lanes/<lane>
# base = your candidate's parent, candidate = your commit (or --head for the working HEAD)
SERVE_OWNER=<lane> scripts/serve-build.sh --rev <parent> --devserver --name <lane>-base   # prints URL A
SERVE_OWNER=<lane> scripts/serve-build.sh --rev <candidate> --devserver --name <lane>-cand # prints URL B
cd <repo>
scripts/browser-lane.sh --max 30 node scripts/w1-c1-parity.mjs capture --url=<A> --out=/private/tmp/sp-lanes/<lane>/c1/base [--shards=sky|signal]
scripts/browser-lane.sh --max 30 node scripts/w1-c1-parity.mjs capture --url=<B> --out=/private/tmp/sp-lanes/<lane>/c1/cand [--shards=sky|signal]
node scripts/w1-c1-parity.mjs compare --base=/private/tmp/sp-lanes/<lane>/c1/base --candidate=/private/tmp/sp-lanes/<lane>/c1/cand --out=/private/tmp/sp-lanes/<lane>/c1/out
scripts/serve-build.sh stop <port A>; scripts/serve-build.sh stop <port B>
```

- **Exit 0** means equal on every row: pixels, draws, triangles, GPU bytes, programs,
  shader sources and colliders. Quote the printed line in your commit body.
- **Exit 1** lists every field that moved and the differing-pixel count for each pose. It
  also writes `out/<shard>-phone-compare.jpg`, a labelled BASE | CANDIDATE | DIFF board
  (differing pixels in magenta, ≤ 500 KB) of the poses that changed, plus `out/report.json`.
  A non-exact bake goes to the visual lane (sp-o127) with that board. Commit it under
  `progress/shard-platform/w1-c1-parity/<your-row>/`. Add `--tier=desktop` for the desktop
  board, or `--all` to include the unchanged poses.
- A quick check with no base build: `compare --base=progress/shard-platform/w1-c1-parity/baseline`
  matches pixel hashes only. It is valid only while nothing else has moved since this
  baseline's SHA.
- One capture of both shards takes about 6 minutes and holds one browser lane. Keep the
  raw frames (≈ 60 MB per shard) only in your scratch folder, and delete them afterwards.

`node scripts/w1-c1-parity.mjs sheet --run=<dir> --out=<dir>` rebuilds the labelled
contact sheets.
