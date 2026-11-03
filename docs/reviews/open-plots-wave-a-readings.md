# Wave A open-plot readings

**2026-11-03, sp-x6.** Fairground's Codex half is complete on
**8bdf53f635910b526e0550f43a4341b6593390db**, immutable preview
**8bdf53f-mw10fiqq**. Its final visual source is **15efc85eee** and
[final board](../../art/patchwork-fairground/round-3-final/board.jpg)
**80ba3ebf58**. Audio publication is **02c7ca0db0**, activation
**8bdf53f635**, native bar-10 record **92a73ddcc2**. No visual source,
engine routing, shader, collider, cap or verification rule changed here.
Jungle's dependent activation/readings remain open under G999; its real
output/final board/walk boundary is still parked with sp-o1.

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
