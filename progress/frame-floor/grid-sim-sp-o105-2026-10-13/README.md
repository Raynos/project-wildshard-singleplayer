# Grid road routes, Simulator: shared costs (sp-o105, 2026-10-13)

**Still FAIL on the Simulator**: three shared costs were cut or ruled out, but no route
moved past the run-to-run noise except Nalati, which is borderline. Measurement:
`scripts/frame-floor.mjs --shards=grid --surface=sim --grid-scenario=milestone --devserver`,
with the standard settings. Safari on `frame-floor-iphone-17-pro`, phone tier, 2×, 30 fps
cap, Developer ON, build pacing ON. There was no quiet window: the load average ran
from 6 to 22 (B2 and A1 hit the 600 s budget).

## Travel p95 / drive max (ms), gate 35 / 200

| Route | B1 `85cab0715` | B2 `85cab0715` | A1 `f766eacf9` | A2 `f766eacf9` | Verdict |
| --- | ---: | ---: | ---: | ---: | --- |
| template-interior | 34 / 44 | 34 / 42 | 34 / 47 | 34 / 37 | PASS |
| template-return | 34 / 139 | 34 / 173 | 34 / 153 | 34 / 129 | PASS |
| nine-dragon-stack | 34 / 181 | 34 / 212 | 34 / 209 | 34 / 197 | travel PASS; max is sp-o101's entry |
| far-reach | 34 / 81 | **52** / 103 | **47** / 124 | **40** / 97 | FAIL, noise ±9 ms |
| nalati-grasslands | **40** / 53 | **36** / 53 | 35 / 50 | 34 / 46 | borderline PASS after (both runs) |
| pine-hollow | **54** / 114 | **50** / 88 | **63** / 139 | **57** / 138 | FAIL, unchanged |
| sunscar-dunes | **40** / 122 | timed out | **46** / 141 | 34 / 78 | noise |
| driftwood-isle | **44** / 107 | timed out | **42** / 118 | **50** / 149 | FAIL, unchanged |

A1 and A2 include both landed changes. Every row is in [summary.json](summary.json).

## What landed

- **`ae2fa3065` perf(grid): upload only the cell screen clock.** When only a loading
  screen's clock changed, the screen repaints just the clock rectangle (the whole
  painter, clipped) and uploads it with `copyTextureToTexture`. The mips are then
  regenerated from level 0. In a Safari profile of this commit, the screens' clock
  uploads are 1.6 % of Pine's drive samples at about 1.3 ms each. sp-o100 measured the
  whole-canvas uploads at 3.7 %, about 5 ms each. Pixel parity: a probe in Chromium and
  WebKit, with and without card art and four clock pairs, read 0 differing canvas bytes
  and 0 differing texels at mips 0, 1, 3 and 6.
- **`f766eacf9` perf(grid): keep the ring step linear in its tiles.** The rings were
  2.0 % of Pine's samples. The change keeps each slot's parent key on the slot, remasks
  in one pass, reads one distance per slot when sorting, and indexes the shardfile tile
  rows once. The behaviour is identical and the ring tests are unchanged.

## What was tried and dropped

- **`9361ccc83` banded warm-up uploads, default-off Developer mode; removed in
  `4951c99b9`.** The texels matched a whole upload in Chromium and WebKit. A Simulator
  Safari probe then showed the mode cannot win. The first upload from a fresh 2048²
  ImageBitmap costs 20 to 25 ms whatever rows it asks for, because WebKit materialises
  the whole bitmap on first touch. Banding splits only the 4 to 6 ms remainder. A fresh
  1024² bitmap's first touch is 5 to 6 ms. So the warm-up's image cost on the Simulator
  is a per-bitmap first touch. Slicing cannot reach it; only a format change (KTX2, a
  look and memory call) could.

## Where the remaining travel time goes (Pine, Safari samples at `ae2fa3065`)

- Warm-up `texSubImage2D`: 4.8 %.
- Pine and Driftwood's own builders. Driftwood's `engine/models/place.ts` generator runs
  shard models (shrine, palm, pier), 9.7 % of its samples.
- The rest: game frame render, 25 %; fixed step, 15 % (physics 3.5 %, animals 4 %); the
  minimap labels, about 1 %.

The long travel frames remain the shard hooks' atomic build units, named by sp-o100.
The changes above cut steady per-frame costs; they cannot clear those units.

## Desktop

One desktop milestone run was taken at `4951c99b9`, which holds both landed changes
(Chromium, Metal, 1440×900 at 2×). **Every travel p95 passes, at 16.7–16.8 ms.** The run
still FAILS on two long frames:

- Nine Dragon: 700 ms in `nine-dragon-stack:world`. That is Nine's own entry, and the
  Nine layout and navigation landings went in between my pins.
- Template-return: 117 ms `between hooks`. The milestone read 100 ms at both of its pins.

Neither long frame can come from a per-step screen or ring cost, so they are not
attributed to these changes.

Raw results, profiles and probes stayed in scratch and were deleted.
