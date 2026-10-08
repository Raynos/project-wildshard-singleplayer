# SF67 / E461 — matched iOS Simulator Safari loading

**56/56 timed entries reached playable across all seven shards. The loading target
remains open.** Two counterbalanced cold pairs per shard produce the medians below;
these are descriptive results under heavy shared-machine load, not a causal estimate
for an individual fix. Cold ranges overlap, with a large first-arm initialization
cost on both revisions. The earlier 3.138 s template result was desktop Chromium at
4× CPU; it was never a phone timing.

Before: `19e647272191b6e823bd6dd7caf06b71780052f4`, build `19e6472-muzy4uyr`.
After: `6f4490e833fabf317d81578508983f96d118ca26`, build `6f4490e-muzy6c4v`.
Both are the same source pins as the [desktop report](../README.md). Later hybrid
progress forwarding (`11da76006`) and receipt dependency guards (`62c426f46`) are
outside the timed after pin, so their savings are not quantified here.

## Cold tap to playable

| Shard | Before median s (range) | After median s (range) | 1-min load before / after |
|---|---:|---:|---:|
| Driftwood | 9.233 (3.781–14.685) | 7.372 (2.962–11.783) | 68.5–74.7 / 63.2–87.9 |
| Nalati | 9.400 (6.486–12.313) | 8.993 (5.812–12.175) | 62.6–63.3 / 56.4–57.6 |
| Template | 6.856 (5.381–8.331) | 5.429 (3.775–7.083) | 50.9–107.4 / 85.2–117.2 |
| Pine | 18.901 (11.711–26.092) | 18.829 (12.166–25.493) | 86.8–120.8 / 125.9–155.9 |
| Sky Reach | 9.737 (5.572–13.902) | 9.079 (4.239–13.920) | 154.3–211.1 / 118.3–125.4 |
| Signal Dunes | 5.140 (2.930–7.350) | 6.671 (3.199–10.142) | 144.1–151.9 / 129.9–152.9 |
| Nine Dragon | 15.258 (11.576–18.941) | 16.398 (13.740–19.055) | 76.2–146.0 / 82.4–120.2 |

## Warm tap to playable

| Shard | Before median s (range) | After median s (range) | 1-min load before / after |
|---|---:|---:|---:|
| Driftwood | 3.203 (2.983–3.423) | 2.704 (2.472–2.937) | 65.5–93.1 / 77.4–83.5 |
| Nalati | 4.825 (4.623–5.027) | 4.947 (4.766–5.127) | 55.9–61.4 / 47.3–71.8 |
| Template | 3.558 (3.547–3.570) | 3.263 (2.770–3.755) | 81.2–91.7 / 88.9–119.4 |
| Pine | 10.874 (10.291–11.457) | 11.202 (10.822–11.582) | 68.9–158.5 / 106.2–164.7 |
| Sky Reach | 4.500 (4.142–4.857) | 3.850 (3.329–4.372) | 134.9–192.0 / 102.7–227.4 |
| Signal Dunes | 2.444 (2.327–2.560) | 3.067 (3.031–3.102) | 139.3–149.8 / 114.9–162.5 |
| Nine Dragon | 11.839 (11.231–12.448) | 11.521 (11.358–11.685) | 57.0–148.8 / 95.4–100.8 |

Each median has **n=2**; ranges are the two observations, not confidence intervals.
**All 56 capture-start one-minute loads exceeded 30** and are flagged. Capture-start
and end load triples, pair order/times and per-run phase spans are in
[summary.json](summary.json) and the raw archives. No quiet-machine claim is made.

After name + tier were first observed 10–61 ms after the tap,
and an advancing clock at 60–128 ms. These are DOM observation
times, not proof of a painted frame. Download byte/detail changes and every visible
phase transition are preserved in the raw steps. For example, template after-cold
reports the descriptor at 258 ms, 0.19 MB / 5.77 MB and 0 / 167 files at 355 ms,
then increasing byte/file counts from 375 ms. Those are document-relative clocks.
Both pins already contain E458; this comparison measures the subsequent fixes. Longest after loading rAF gaps
range 140–1579 ms across captures. A rAF gap includes scheduling,
paint and GPU waits; it is **not a CPU task duration**. The goal of no ~100 ms loading
CPU task has not been established by this Safari run.

## Ruler and entry policy

- iOS **26.5 Simulator Safari**, owned **iPhone 17 Pro**, portrait 402 × 714 viewport,
  DPR 3 (Safari chrome visible). Muted by the existing device volume setting. This
  uses the Mac CPU/GPU at native speed: no 4× CPU throttle, no physical-iPhone,
  home-screen-PWA, FPS or memory-cap claim.
- Ordinary bare title → SHARD SELECT → card → enabled ENTER. Driftwood, Nalati and
  Pine use Developer off / legacy entry. Template uses Developer on / compiled
  shardfile entry. Sky Reach, Signal Dunes and Nine Dragon are experimental cards,
  requiring Developer on; they use their legacy ENTER, not the grid.
- For each shard: first pair before-cold, before-warm, after-cold, after-warm; second
  pair reverses arms. One owned device is erased while shut down before each pair.
  Each arm starts a fresh Safari website state; warm repeats in the same tab with
  its normal service worker and caches. Cold is fresh data **before the title**;
  title dwell can prefetch. OS/GPU shader caches are not globally cleared.
- The host timestamp immediately before the enabled Enter click starts timing.
  The end is Loading faded + world probe present for two frames. Navigation remains
  included via the document-origin/tap fence. Phase wall intervals include awaits;
  do not charge them as CPU cost or add them to task time.
- One Inspector connection, no second sampler or heap snapshot. Only a scalar HTML
  recorder is injected into owned exports, before game scripts; no production
  bundle/prototype patches. HTTP/disk version and preview listener were verified.
  Original HTML bytes are restored after each arm. Owned devices are deleted after
  the cohort and both previews stopped after the final release.

## Missing task evidence and rejected controls

Safari does not support the LongTask observer here. Inspector Timeline and
ScriptProfiler pilots returned **zero timestamps** for task/profile samples; their
raw records are archived to prove why CPU durations and owners remain **missing**.
The primary repeated ruler disables those unusable streams. Empty longTasks in the
strict reports mean unavailable, as explicitly stated in `missing`, not zero tasks.
The [desktop report](../README.md) contains valid sampled CPU tasks and owners.

Six initial experimental-card attempts in the core raw archive are excluded. The
driver left Developer off, so ENTER was disabled and no game navigation occurred.
It mistakenly reported an Inspector-readiness refusal. Those original failures are
retained unchanged and classified in [manifest.json](manifest.json). This is a
harness failure, not a shard load failure. `6fe1dcd83` fixes explicit mode policy and
checks the control is enabled, visible and nonempty before timing; all 24 corrected
experimental entries passed. The core four's 32 valid entries use the unchanged
recorder. Two source manifests/hash sets preserve the exact harness versions. Original and
injected HTML SHA-256 match across the two cohorts for each arm, confirming the
recorder did not change.

Earlier transport/deferred-navigation pilots and a push-overlapped single-pair
Driftwood trial are separate archives, never pooled into these medians. The latter
has its load-overlap receipt. Local preview telemetry 404s remain in console/resource
records. All 56 primary captures have zero captured script exceptions/rejections;
that does not mean zero console messages.

## Artifacts and verification

- [before-report.json](before-report.json) and [after-report.json](after-report.json):
  strict `loading-benchmark/1`, 28 actual runs per arm, validated by the consumer
  parser; repeated rows retain actual times, never invented median phase clocks.
- [summary.json](summary.json): every run, median/range, load and observed progress.
- [manifest.json](manifest.json): SHA-256 / decoded-length / every archive member's
  hash; deterministic gzip round-tripped byte for byte. Raw archives preserve
  captures, pair/load/device metadata, errors, resources, phases and harness hashes.
- Clean source `64a1f0b4b`: 927 files / 5326 tests + 14 skips, 121.37 s through the
  heavy lane, root strict and typed lint green. Subsequent harness controls:
  3 focused files / 6 tests green plus full root typed lint on loading-benchmark.
  The coordinator owns the clean gate and serialized push.

## Reproduce

Build immutable before/after exports through `serve-build.sh --rev` / the build
queue, verify their versions and pass their exact dist paths. The parent owns and
finally deletes one device; each pair is serialized through sim-lane. Example:

```sh
scripts/browser-lane.sh --max 45 node scripts/loading-benchmark/safari-matched.mjs \
  --before=http://127.0.0.1:4406 --before-pin=19e647272191b6e823bd6dd7caf06b71780052f4 \
  --before-dist=<before-dist> \
  --after=http://127.0.0.1:4400 --after-pin=6f4490e833fabf317d81578508983f96d118ca26 \
  --after-dist=<after-dist> --out=<scratch>
```

The raw core and experimental cohorts are separate because the disabled-card
policy was corrected between them. Both use the same immutable application pins,
HTML recorder and tap/play ruler. SF67's remaining builder/worker/time-slicing work
and physical-phone measurements stay open; this receipt supplies the requested
Safari counterpart and honest limits.
