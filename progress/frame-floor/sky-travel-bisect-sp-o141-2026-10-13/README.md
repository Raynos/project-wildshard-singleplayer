# Sky road travel on the Simulator: bisect and attribution (sp-o141, 2026-10-13, G407)

**There's no real regression to fix. The Sky road travel row sits right at the gate, and a single SHA reads anywhere
from 34 to 41 ms.** `3afdcb608`, the commit flagged red at 41 / 36, read 34 / 34 in this lane. `cfea55867` read
34 / 35. Current HEAD `5c81bd3a4` read 39 / 35 / 37, so by the brief's rule it is bad and `22d016a63` is the first bad
commit (it is the only runtime commit after `cfea55867`). But the diagnostic run finds nothing in the travel window
that `22d016a63` added. The warm-up is the same size as sp-o134's (`sky-warmup-sp-o134-2026-10-13`). The slow frames
aren't page work: main-thread tasks in them are 4–13 ms. Nothing was changed in this lane.

Settings: `scripts/frame-floor.mjs --shards=grid --grid-scenario=milestone --grid-routes=far-reach-road-entry
--devserver --surface=sim --rev=<sha>`, plus the standard settings (Simulator Safari on `frame-floor-iphone-17-pro`,
phone tier, 2×, 30 fps cap, Developer ON, build pacing ON). Load is the 1-minute average at the start and end of each
run. Each run started only with load ≤ 12 and no other frame-floor process running. Rule: a pin is bad if it fails
twice or reads ≥ 38, and good if it passes twice at ≤ 35. The hook-, type- and metric-only commits (`a891c520f`,
`98d74336b`, `d0af1ac4f`, `c653ad56b`, and the docs commits) were skipped.

## Bisect table (travel row, 120 frames)

| Run | SHA | Load | Travel p95 / p99 / max | Drive p95 / max (> 50 ms) | Verdict |
| --- | --- | ---: | ---: | ---: | --- |
| coord ×2 | `7ca8b75f8` | – | 34 / – / – and 34 | – | good (relayed) |
| C1 | `c1bdc0ff0` | 6.8–5.5 | **37** / 65 / 71 | 35 / 94 (8) | fail |
| C2 | `c1bdc0ff0` | 5.4–6.3 | 35 / 57 / 68 | 35 / 73 (6) | pass: one fail, one pass, so undecided |
| D1 | `dda135b7b` | 5.7–5.8 | 34 / 65 / 69 | 35 / 75 (5) | pass |
| coord ×2 | `3afdcb608` | ≤ 8 | **41** and 36 | 35 / 103 | flagged red (relayed) |
| A1 | `3afdcb608` | 5.4–5.9 | 34 / 54 / 65 | 35 / 115 (6) | pass |
| A2 | `3afdcb608` | 6.8–6.0 | 34 / 52 / 66 | 34 / 74 (6) | pass, so **good** |
| F1 | `cfea55867` | 5.7–7.2 | 34 / 49 / 65 | 35 / 73 (6) | pass |
| F2 | `cfea55867` | 5.8–8.2 | 35 / 70 / 71 | 34 / 72 (7) | pass, so **good** |
| H1 | `5c81bd3a4` (HEAD) | 7.9–7.2 | **39** / 49 / 68 | 34 / 77 (5) | fail |
| H2 | `5c81bd3a4` | 6.7–7.7 | 35 / 73 / 74 | 34 / 74 (5) | pass |
| H3 | `5c81bd3a4` | 7.5–12.0 | **37** / – / – | 34 / 81 (5) | fail, so **bad** |
| X1 | `22d016a63` | 11.4–9.4 | **42** / 68 / 73 | 34 / 121 (5) | diagnostic, no credit |

The drive's max and its frames over 50 ms barely change from run to run (72–121 ms, 5–8 frames, all in Sky's
`world` / `play` / `activate` / `afterPlay` hooks), and every run held 60 calls and 173,681 triangles. The travel p95
is the window's 114th frame out of 120, so 7 frames over 35 ms fail the row. Across the runs, that count swings for the
same SHA (`3afdcb608`: 41, 36, 34, 34).

## Attribution (X1, `--gl-time --frame-timeline --task-clock`, `22d016a63`)

- **11 of the 120 travel frames ran over 35 ms:** two long ones (68 and 73 ms) and nine at 37–43 ms.
- **They aren't main-thread bound.** The game's update + render work is 3–8 ms on those frames, with a median of 5 ms
  against 4 ms on the frames that held the cadence. The 68 and 73 ms frames have no page task over 4 ms at all: the
  page sat waiting on the compositor / GPU process. The 73 ms frame is the first frame that draws Sky content (draws go
  from 26 to 43 elements, plus 1 instanced). The 68 ms frame falls in Sky's `world` hook. The nine 40–43 ms frames
  each miss vsync by a few ms. Four of them carry a precompile slice of 4–13 ms; the rest carry only a 5–6 ms game rAF.
- **Main-thread load in the window is about 21 %.** That's 875 ms of tasks ≥ 4 ms over 4.07 s: game rAF 470 ms (89
  tasks, max 20 ms), precompile slices 270 ms (28 tasks, max 20 ms) and workSlice messages 62 ms.
- **The warm-up didn't grow.** Here it built 69 programs (54 scene-entered, 8 scene-other, 5 family, 2 shadow); on
  `861f87d7d` sp-o134 counted 71. The other warm-up stages, X1 against `861f87d7d`:

  | Stage | X1 | `861f87d7d` |
  | --- | ---: | ---: |
  | compile | 2217 ms / 353 jobs | 2168 ms / 359 jobs |
  | link | 302 ms / 9 programs pending | 433 ms / 13 programs pending |
  | upload | 919 ms / 63 textures, 124,608 KiB | 969 ms / 63 textures, 124,608 KiB |
  | parked draws | 458 ms / 214 drawables | 537 ms / 218 drawables |
- **What `22d016a63` adds at runtime** is four small rest-geometry GLBs (the winch and 3 hover decks). They're fetched
  and parsed in `SKY_LIBRARY.preload`, then cloned by `createClientScene`. The materials keep the same parameters as
  before, so they share the old programs. No task in the window points at them.

## Verdict and what would add margin

- No first bad commit can be named reliably. By the rule it's `22d016a63`, but its own attribution shows no cost of its
  own, and `3afdcb608` swings from 34 to 41 on the same tree. The row is a coin-flip at about 35 ms on every commit
  from `7ca8b75f8` to HEAD. Holding the Sky library over this specific "regression" isn't supported.
- The margin is GPU-process time during the entry warm-up: parallel compiles and uploads, plus the first draws of new
  Sky content. It's not page JS, so neither a cache fix nor a page-side pacer of JS slices would move it. The likeliest
  lever is fewer GPU-side compiles in flight per presented frame during travel (stretching the warm-up), or finishing
  more of Sky's warm-up before the road window. Either is a rendering pacing change that needs its own proof:
  two plain runs, the Sim standalone floor for Sky and Signal, and the desktop floor.

Raw JSONs stayed in scratch and were deleted. Mac-backed Simulator Safari: no physical-iPhone claim.
