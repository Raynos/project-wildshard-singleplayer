# Goldens: the known-good look, re-captured before a look change lands

Linked from [AGENTS.md](../../AGENTS.md). Skill: [.claude/skills/goldens/](../../.claude/skills/goldens/SKILL.md).

Jake, 2026-11-03: *"The golden images are really fucking important. Agents should be recapturing golden images and
comparing them against the known good golden images … the most basic thing you can do to check it."* On 11-02 lanes
landed Nine render perf cuts checked only with P1–P5 pixel diffs; nobody re-ran the goldens, and Nine shipped with walls
and floors missing on the iPhone. The same day the plan agent told Jake Nine had no goldens. It has 48.

## Where every set lives

| Set | Path | What it is |
|---|---|---|
| SHARDFILE goldens | `art/shardfile-goldens/<shard>/24/<nn>-<camera>.jpg` | **The look to hold** (G859, G873 L5). 24 per shard, captured on `744c3ab7e2` (10-29); 22 px label strip on top. |
| LEGACY goldens | `art/legacy-goldens/<shard>/24/<nn>-<camera>.jpg` | The frozen record of LEGACY (10-28, G843). Never re-captured, never updated. |
| Cameras | `art/legacy-goldens/compare/cameras24.json` | 24 cameras × 6 shards: 1–4 CO6, POIs, coverage, 2 aerials, 2 hands. Eye, yaw, pitch, FOV, probe. |
| Capture | `art/legacy-goldens/compare/capture.mjs` | Chromium (or `--engine=webkit`), iPhone 16 Pro portrait, phone tier, 2×, seed 357, midday / clear, HUD hidden. |
| Board | `.claude/skills/goldens/board.py` | LEGACY golden · SHARDFILE golden · NOW per camera, labels burned in, SSIM, ≤ 500 KB board; `--promote`. |
| 144-pair page | `art/legacy-goldens/compare/compare.py`, `verdicts.json`, `README.md` | The G859 LEGACY-vs-SHARDFILE review page and its by-eye calls (last judged `2026-10-29-744c3ab7e2`). |
| Open plots | `art/open-plots/golden-2026-11-03/<plot>/` | 8 views per plot (`<n>-<view>.jpg`), `cameras.json` (eye, look, FOV, player pose), scored `board.jpg`. |

Shards with a set: `driftwood-isle`, `pine-hollow`, `nalati-grasslands`, `far-reach`, `sunscar-dunes`,
`nine-dragon-stack`. Plots: `night-market`, `frostline-peaks`, `coral-drift`, `lantern-bayou`, `ember-forge`,
`mosslight-ruins`. **No set yet:** `ink-cel-valley`, `pastel-plain` (their look changes carry G844's before/after
until Jake approves a look and they get 24 cameras). Before you say a shard has no goldens, run
`ls art/*golden*/ art/open-plots/golden-*/`.

## The rule (Jake, 2026-11-03)

**Any commit that can change what the player sees on a shard re-captures that shard's 24 golden cameras on the
candidate build and compares them against the SHARDFILE goldens before it lands.** That covers render, look, shader,
material, texture, geometry, models, placement, tiles, slabs, sky, fog, lighting, shadows, post, LOD, culling,
streaming residency, bakes and producers, and every perf cut that claims to be pixel-identical.

- **Which shards:** the shard you touched. A change in `src/engine/render/`, `src/engine/` shaders or post, the grid
  (`src/game/grid/`), shared kits or the format layer re-captures **all six** (two browser lanes, three shards each).
  An open-plot change re-shoots that plot's 8 views (below).
- **The candidate build** is a working-tree build of your change: `scripts/serve-build.sh --shard <slug>` (G670). After
  landing, a `--head` rerun is the plan agent's QA check, not a substitute.
- **Read every panel**: each camera's row, all three columns. A camera is **red** when the NOW frame loses or gains
  anything against the SHARDFILE golden that the change did not mean to: a missing wall, floor, building or prop, a hole,
  a black or blank area, a seam, a different exposure or colour, a LOD or texture pop, missing hands. Clouds, rain,
  crowds, creatures and the hands' sway move between visits; that is not red. SSIM is a pointer to where to look,
  never the verdict.
- **A red camera blocks the landing.** Fix it and re-capture, or, if the change is a look change meant to be seen, take
  the golden update path below. "Pixel-identical" claims need the goldens green on Chromium **and** WebKit.
- **P1–P5 pixel diffs, frame-floor runs, unit tests and a single spawn shot never count** as the look check on their own.
- **The commit carries the result:** a line in the body, `Goldens: <shard> 24/24 green on <build id>` (or
  `22/24, 11 12 red: <why>, ruling <G…>`), plus the WebKit line when it ran, and the board (≤ 500 KB JPEG) committed as
  `art/golden-runs/<shard>/<date>-<sha10>-board.jpg` in the same commit (the name must say `board` for the 500 KB
  cap). The per-camera rows stay in `./tmp` and are deleted.

This is the one pre-land check G612 keeps for a look change, and it moves G797's "one capture after landing" before
landing; G844's before/after and G858's "against the golden" are this board.

## The WebKit pass

The iPhone is WebKit on Apple's GPU, and the 11-02 Nine breakage was iPhone-only. Add a WebKit pass to the Chromium one
when the change touches **shaders or node graphs, materials' blending or transparency, render targets, the composer or
post, background / clear colour or alpha, texture formats (KTX2, mips, samplers), precision, instancing, batching,
culling or draw-call cuts, or anything sold as perf**, and whenever Jake saw the bug on his phone:

1. `capture.mjs --engine=webkit` (Playwright WebKit) for the same 24 cameras, its own board labelled `NOW webkit`.
   Compare structure (walls, floors, props, sky present), not exact colour, against the SHARDFILE golden.
2. For shader, render-target, clear and perf changes, also a Simulator Safari look through `scripts/sim-lane.sh` and
   the [ios-simulator skill](../../.claude/skills/ios-simulator/SKILL.md): load the shard, screenshot the spawn view and
   the area you changed, and set it beside the matching golden cameras. (No script poses the 24 cameras in the
   Simulator yet; the Simulator is never memory or fps evidence for the iPhone.)

## Updating a golden (never silently)

A golden changes only for an **approved look change**: Jake's pick (a G ruling), or the builder's logged autonomous
decision under G872 (the plan STATE's "Autonomous decisions" names the cameras). Then, in one commit:
`board.py --shard <slug> --now <raw> --promote <cams> --source "<sha10> <ruling>"`, the board showing old golden →
new, and a line in `art/shardfile-goldens/README.md` (date, cameras, ruling). A perf cut, a bug fix or a "close enough"
never updates a golden. LEGACY goldens are never updated.

## Open plots

The 8 views per plot are the regression set for every open-plot change (kit, landmark, layout, generators, plot sky).
There is **no committed re-shoot script yet**: re-shoot with the free-camera harness the plot README describes
(the dome harness's `onLate` override, `scripts/capture-plot-domes.mjs`, at `cameras.json`'s `world.eye` / `look` /
`fov` with the player at `player`), name frames `<n>-<view>.png`, then `board.py --plot <plot>`. The first lane that
re-shoots a plot commits the script beside the set.

## The plan agent's duty

Before telling Jake a shard or plot is ready for QA, or that a fix shipped, **look at a fresh golden rerun board of the
build that will be live** (`--head`, or `--rev` of the deploy pin), every panel, plus the WebKit board when the change
set had a WebKit trigger. Say in the message which run you looked at and how many cameras were green. A milestone
rerun of all 144 also refreshes the G859 page and `verdicts.json` (the compare README's Rerun).
