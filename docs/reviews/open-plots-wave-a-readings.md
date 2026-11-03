# Wave A open-plot readings

**2026-11-03, sp-x6.** Fairground's Codex half is complete on
**8bdf53f635910b526e0550f43a4341b6593390db**, immutable preview
**8bdf53f-mw10fiqq**. Its final visual source is **15efc85eee** and
[final board](../../art/patchwork-fairground/round-3-final/board.jpg)
**80ba3ebf58**. Audio publication is **02c7ca0db0**, activation
**8bdf53f635**, native bar-10 record **92a73ddcc2**. No visual source,
engine routing, shader, collider, cap or verification rule changed here.
Jungle's Codex half also completes on `61a326a292`, after O1's corrected
stairs and two-leg route. Its source-bound readings follow below; the
original failed walk and one-source clip remain in the audio review.

## Matched Chromium pair

One maintained `frame-floor.mjs` command measured Fairground and Night
Market on the same immutable source: Metal M5 Max, muted phone CSS
402 × 874 / canvas 804 × 1748, 2× rendering, live clock, boot CPU 1×
then acknowledged ready/new-draw CPU 4×. Each window has 120 actual drawn
frames with paired whole-frame render CPU/draw samples, including the
normal shadow/post/held work. No percentile ratios or extrapolation.
The command completed in **239.6 s**. Chromium earns no official timing
floor credit. All six spawn/road/plaza windows have **p95 33.4 ms**, with
zero sampled intervals over 50 or 100 ms and no page errors.

| Plot / pose | Max draws | Median reported triangles | Mean / worst render CPU µs per draw |
|---|---:|---:|---:|
| Fairground spawn | 42 | 104,116 | 49.444 / 76.190 |
| Fairground road | 50 | 80,419 | 38.633 / 74.000 |
| Fairground plaza | 53 | 126,368 | 37.736 / 62.264 |
| Night Market spawn | 48 | 225,198 | 44.722 / 64.583 |
| Night Market road | 56 | 140,577 | 40.923 / 67.857 |
| Night Market plaza | 57 | 283,280 | 35.965 / 54.386 |

The unchanged **30 µs/draw target misses on both plots**. Fairground's
worst sample is 76.190 versus Night Market's 67.857 µs; these values are
retained, not called green or attributed to a cause. The existing
matched-control CPU follow-up is **G908 / OB8-RENDER-CPU**, carried by
[BURN-DAMAGE-LIST](../plans/BURN-DAMAGE-LIST.md). Fairground is below the
draw/triangle bars at these windows, with matched frame cadence. This
measurement does not establish an isolated CPU saving or a whole-game
performance guarantee. Triangle values are reported medians, not maxima.

Road pose: `(0,1.7,-241,pi,0)`; plaza:
`(0,1.7,-62,pi,0)`, world coordinates and radians. These are real player
poses, not the OP4 hero camera. The source/hash-bound pose file and raw
record are under `tmp/wave-a-audio/fairground-readings/chromium/`.

## Independent Chromium memory and maintained walk

The separate `shard-phone-memory.mjs` run completed in **65 s** with
three settled spawn samples, no forced GC and no page errors:

| Sample | Renderer MiB | GPU-process MiB | JS heap MiB | Draws |
|---|---:|---:|---:|---:|
| 1 | 221 | 508 | 82 | 48 |
| 2 | 161 | 512 | 49 | 48 |
| 3 | 163 | 514 | 49 | 48 |

All have phone tier / 2× rendering. These rounded process diagnostics
are not the Simulator loading or native memory acceptance figures.

The maintained `scripts/open-plots/walk.mjs` reads the route from this
exact commit's `scripts/physics-route.json` (**479fa0be90** route source).
One leg reaches all 14 waypoints, finishes at `(0,0.02,-61.976)`, and
reports **0 stuck / 0 out of bounds**, complete, **166 s command time**.
No collider, destination or walk guard changed.

## Official Simulator window

One maintained `frame-floor.mjs --surface=sim --quiet` command on
`wildshard-iphone` completed in **94.816 s**, complete/pass, with native
memory observation. Model lock was verified free before admission.
The runner owns the single Simulator and bounded quiet window; no outer
browser or Simulator wrapper. Existing peer WebKit work finished normally;
no peer process was stopped. This is Mac-backed Mobile Safari, not a
physical-iPhone performance clearance.

| Surface / pose | Reported fps floor | p95 ms | Draws | Reported triangles |
|---|---:|---:|---:|---:|
| Fairground spawn | 30 | 34 | 48 | 112,300 |
| Fairground road | 30 | 34 | 54 | 82,655 |
| Fairground plaza | 30 | 34 | 53 | 126,828 |
| Northeast junction, heading -135° | 30 | 34 | 42 | 205,703 |
| Northeast junction, heading -45° | 30 | 34 | 28 | 41,599 |
| Northeast junction, heading 45° | 30 | 34 | 63 | 90,058 |
| Northeast junction, heading 135° | 30 | 34 | 72 | 143,718 |

Every window contains 120 drawn frames, zero skipped samples and no page
errors. The reader's stricter 33.3 ms target flags remain false; the
existing floor verdict is not relabelled a strict target pass. Home-grid
spawn separately reports **p95 35 ms / 112 draws / 1,084,445 triangles**,
with a maximum interval of 45 ms. That observation is retained separately
from the new plot/junction result; no whole-grid strict-green claim.

The junction is derived from the **actual pinned assembly**, not the
older plan cell label. Fairground is `open-plot-0-0`, cell **(-2,-2)**,
pitch **562.5 m**. Its northeast road intersection is
**(-843.75,1.7,-843.75)**, pitch -0.08 radians and four yaw headings.
The retained native context has Fairground and Bayou near; Showcase and
Fossil use their shipping far proxies, crossing settled, pending empty.
All four source neighbours are present. This qualifies the present
assembly only; OP23's eventual all-plots-built reading remains open.

Native WebContent footprint plus the conservative GPU envelope:

| Visit | Samples (playing / loading) | Playing peak MB | Loading peak MB | Native playing / loading MB | GPU allocation peak MB |
|---|---:|---:|---:|---:|---:|
| Fairground | 272 (221 / 51) | 262.935 | 491.234 | 239.357 / 467.656 | 23.578 |
| Grid visit | 448 (367 / 81) | 863.328 | 831.597 | 699.420 / 667.689 | 163.908 |

MB here is decimal. Each envelope adds the observed native phase peak
to the GPU peak; it is conservative, not a same-instant physical total.
Both visits meet the 1.2 GB playing / 1.8 GB loading caps and 1.0 GB aim.
No missing sample is treated as zero. Native memory sampling itself earns
no timing credit; frame cadence comes from the maintained floor windows.

## Reproduction and release

Use the existing maintained runners; never wrap frame-floor in another
browser/Simulator lane. The source-bound raw records, native readings,
actual neighbour census and fixed poses are in
`tmp/wave-a-audio/fairground-readings/`. Run from the checkout:

```sh
node scripts/frame-floor.mjs --rev=8bdf53f635910b526e0550f43a4341b6593390db --shards=open-plot-patchwork-fairground,open-plot-night-market --surface=desktop --chromium-phone --chromium-cpu=4 --draw-budget-report-only --frames=120 --standing-file=tmp/wave-a-audio/patchwork-fairground-control-poses.json --output-dir=YOUR_CHROMIUM_DIR --serve-base=SAME_SHA_PREVIEW
scripts/browser-lane.sh --max 10 node scripts/shard-phone-memory.mjs SAME_SHA_PREVIEW open-plot-patchwork-fairground wave-a-final YOUR_MEMORY_JSON --pin=8bdf53f635910b526e0550f43a4341b6593390db
scripts/browser-lane.sh --max 10 node scripts/open-plots/walk.mjs --base=SAME_SHA_PREVIEW --pin=8bdf53f635910b526e0550f43a4341b6593390db --plot=patchwork-fairground --out=YOUR_WALK_JSON
node scripts/frame-floor.mjs --rev=8bdf53f635910b526e0550f43a4341b6593390db --surface=sim --quiet --device=wildshard-iphone --shards=open-plot-patchwork-fairground,grid --standing-file=tmp/wave-a-audio/fairground-readings/sim-poses.json --native-memory=EXISTING_NATIVE_DIR --output-dir=YOUR_SIM_DIR --serve-base=SAME_SHA_PREVIEW
```

The working native-audio candidate and committed immutable product have
199/200 bodies exact: only look/map changes its defining-source stamp.
The full native audio section, client plan, seven audio bodies and all
prior geometry/material/collision bodies are exact across those sources.
All check browsers are closed, Simulator is shut down, quiet is released,
and our immutable preview use is released.

## Jungle: corrected source qualification

The complete Jungle cohort binds **61a326a292ad58ecf491d9716306f121b2ed6cbc**,
immutable build **61a326a-mw14hipi**. Audio publication is `add58749da`,
activation `1c287c7c4b`; O1's corrected visual/collider source is
`9c82257231`, with final eight-view board/goldens `42fd0da110`
([board](../../art/jungle-ziggurat/round-3-stairs/board.jpg)). The lower,
four-stair landmark is an intentional owner change. The old four-stuck
walk and one-source road clip remain recorded in the audio review; later
qualification does not rewrite those failures.

The maintained pinned route now has **two legs**, preserving the western
plaza half under the coordinator's ruling. Each keeps the unchanged
**240 s** bound and native stuck/endpoint guards. The first reaches all
11 waypoints, climbs the south stair to **max Y 31.04 m**, and finishes in
**188.043 s** at `(218.743,0.020,218.382)`. The western leg reaches all
three waypoints in **74.297 s**, ending `(63.411,0.020,63.999)`.
Both report **0 stuck / 0 out**, complete; command **268 s**. No hovering,
per-waypoint teleport or dropped western route qualifies this result.

The fixed HERO road-entry eye `(0,1.7,-241)`, look `(0,16,0)` and
**72 degree vertical** lens stay unchanged. Eleven lossless frames cover
0..5004.793 ms, with capture lateness below 100 ms and a live clock.
O1 confirms the two independently visible native sources: a 1.2 m white
Glow egret drifting over the stele walk, and the stone lamp's flickering
Glow head. The declared egret region changes 253..336 pixels per interval;
the disjoint lamp region changes 80..249. Source review identifies the
actual egret rather than treating two changing rectangles as proof.

Full native bar 10 passes again on this final source in **19 s**:
recorded B, seven decoded cue loops (bed plus six spots), sustained score
and bed, native pause/resume, positive local gains and heading pan flips,
no page errors. The eight audio file bodies and native audio section are
byte-identical to the activation candidate. The final geometry's tile,
model and collision changes are intentional; no whole-product byte
identity is claimed across them. Final product: **202 bodies, 11,737,413 B**;
phone served **5,937,673 B**, below **5,981,239 B**.

### Jungle matched Chromium pair

The maintained runner completed in **53.431 s** on muted iPhone 16 Pro
CSS 402 x 874 / canvas 804 x 1748, Metal, 2x rendering, live clock,
boot CPU 1x followed by acknowledged ready/new-draw CPU 4x. All six
120-frame windows complete without skipped samples or page errors;
**p95 33.4 ms** throughout. Chromium earns no official floor credit.

| Plot / pose | Max draws | Reported triangles | Mean / worst render CPU us per draw |
|---|---:|---:|---:|
| Jungle spawn | 44 | 89,049 | 96.307 / 138.636 |
| Jungle road | 56 | 90,760 | 70.893 / 114.286 |
| Jungle plaza | 56 | 114,613 | 55.000 / 91.071 |
| Night Market spawn | 48 | 225,198 | 59.028 / 95.833 |
| Night Market road | 56 | 140,577 | 55.580 / 100.000 |
| Night Market plaza | 57 | 283,280 | 46.257 / 71.930 |

The unchanged **30 us/draw target misses on both plots**; the same-frame
whole render samples include shadow/post/held work. No percentile ratios,
extrapolation, isolated CPU-saving claim or new cause attribution.
G908 / OB8-RENDER-CPU remains the shared follow-up. The strict 33.3 ms
flags remain false. Triangle figures are reported medians, not maxima.

The independent memory command completes in **66 s**, without forced GC,
with phone tier / 2x rendering and errors[]:

| Sample | Renderer MiB | GPU-process MiB | JS heap MiB |
|---|---:|---:|---:|
| 1 | 196 | 513 | 55 |
| 2 | 165 | 508 | 50 |
| 3 | 165 | 499 | 51 |

These rounded process diagnostics do not replace the official native
loading/playing envelope. All source-bound raw records are under
`tmp/wave-a-audio/jungle-readings/final/`.

### Jungle official Simulator window

The maintained quiet Simulator command completes/pass in **95.159 s**.
Model lock was free before admission. It owns its Simulator/quiet window,
closes normally and releases quiet. This is Mac Mobile Safari regression
evidence, not physical-iPhone timing clearance.

| Surface / pose | Reported fps floor | p95 ms | Draws | Reported triangles |
|---|---:|---:|---:|---:|
| Jungle spawn | 30 | 34 | 52 | 97,029 |
| Jungle road | 30 | 34 | 61 | 91,112 |
| Jungle plaza | 30 | 34 | 62 | 117,373 |
| Southeast junction -135 degrees | 30 | 34 | 58 | 83,928 |
| Southeast junction -45 degrees | 30 | 34 | 79 | 261,465 |
| Southeast junction 45 degrees | 30 | 34 | 73 | 118,722 |
| Southeast junction 135 degrees | 30 | 34 | 77 | 129,311 |

All eight windows (including home-grid spawn) have 120 drawn frames,
zero skipped samples and no page errors. The strict 33.3 ms flags stay
false. Home-grid spawn is separate: **p95 35 ms**, max 42 ms, 107 draws,
1,083,262 reported triangles. No whole-grid strict pass is claimed.
The actual pinned southeast junction is **(-843.75,1.7,843.75)**,
yaw -135/-45/45/135 degrees, pitch -0.08 radians. Jungle is actual cell
**(-2,2)**, instance `open-plot-0-4`, pitch 562.5 m; the retained native
context includes Jungle, Thin Ice, Frostline and Night Market. This
qualifies the present assembly; OP23's all-plots-built reading stays open.

| Visit | Samples (playing / loading) | Playing peak MB | Loading peak MB | Native playing / loading MB | GPU allocation peak MB |
|---|---:|---:|---:|---:|---:|
| Jungle | 269 (219 / 50) | 270.407 | 801.171 | 246.664 / 777.429 | 23.742 |
| Grid | 442 (363 / 79) | 920.087 | 913.505 | 755.552 / 748.971 | 164.534 |

Decimal MB; phase native interval maximum plus global GPU allocation
maximum is a conservative envelope, not a simultaneous physical total.
Both meet 1.2 GB playing / 1.8 GB loading caps and the 1.0 GB aim.
Each visit retains one Inspector-closed observation before its first
GPU witness; full loading/playing phase counts are present and no missing
sample is zero-filled. Native sampling supplies no timing credit.
Jungle's Codex half closes with the original red evidence retained.
