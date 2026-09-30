# Nine Dragon: mobile facade multi-draw memory failure

**Decision:** facade multi-draw is prohibited across the baseline and all shards, on all platforms and tiers.
The initial mobile guard was `135652ba`; E272 supersedes it with removal of the implementation, shader branch and
toggle. Retain the instanced facade. E257 / E264 / E271 / E272, 2026-09-28.

This is a permanent regression record. Read it before optimizing facade draws. Fewer draw calls did not make this
path safe on an actual iPhone. The Simulator did not reproduce the physical failure.

## What changed and why

`51cf6c8371ff73852aaaba4bfa41cae8a8fe77ba` (2026-09-26), **Batch Nine Dragon facade details when multi-draw is available**,
replaced per-piece `InstancedMesh` draws for large facade details with a Three.js `BatchedMesh` using
`WEBGL_multi_draw`. Small clutter remained instanced. The intended benefit was fewer draw calls; this was a rendering
optimization, not new visual content. Git records Jake as author; it does not establish which model wrote the code.

Affected implementation: `src/chunks/nine-dragon-stack/world/facade/batch.ts`, selected by `world/build.ts`, with batching
shader support in `look/facadeMaterial.ts`. Its scene object is named `facade-large-batch`.

## What failed

On the connected physical iPhone 17 Pro, iOS **26.6.2 (23G90)**, the page flashed white, reloaded, and sometimes reached
"a problem repeatedly occurred" or a subsequent lost-graphics-context error. Native logs recorded WebContent memory
terminations. One observed limit was **ActiveHard 2048 MB (fatal)**. Recorded footprints at termination overshot this
threshold; they are not the configured limit.

| Observation | Native/Inspector evidence |
| --- | --- |
| Safari, failing runs | Native WebContent terminations at 4,680,066 KB and 4,937,809 KB; further failures recorded up to 5,857,250 KB |
| Chrome, default settings, 15:13:17 | WebContent PID79224 killed at 3,969,601 KB |
| Chrome automatic retry, 15:13:30 | PID79272 exceeded ActiveHard2048MB; killed at 2,256,961 KB |
| Safari, `e5e8b8e-muloh54x`, facade instancing, lanterns on | Loaded and rendered World Explorer for over 90 seconds without another observed native kill; user confirmed it loaded |
| Same successful Safari run | Inspector sampled ~0.782 GB loading peak, ~1.054 GB Explorer peak, then ~0.69 GB after collection |
| iOS 26.5 Simulator, multi-draw actually active | Two cold runs: native aggregate WebContent highs 0.819 / 0.800 GB; separate GPU-process lifetime highs ~0.256 GB |

All GB values above are decimal; original native KB values are retained as logged. Raw phone logs remain local because
they contain unrelated device activity. Sanitized other-shard baselines are in
[physical-shard-memory-baseline-2026-09-28.json](physical-shard-memory-baseline-2026-09-28.json).

The Chrome Inspector only sampled ~684 MiB before its first native kill. Periodic samples can miss the fatal burst.
Simulator watchdog native high-water counters also stayed below 1 GB: its successful result was not simply a missed
between-sample peak. Physical and Simulator OS versions differed; Apple's download service did not offer 26.6.2 to
the installed Xcode 26.6 (see E269).

## What the evidence does and does not establish

- The facade multi-draw path is isolated as unsafe on the physical device; selecting the existing instanced path
  produced the successful Safari run. This is enough to disable it on mobile while keeping the visuals.
- The native termination was WebContent's memory footprint. It does **not** prove a growing JavaScript object leak,
  a specific WebKit/ANGLE allocation, or a measured VRAM exhaustion. iPhones use unified memory; JS heap, WebContent
  footprint and GPU-process footprint are different measurements and must not be conflated or blindly summed.
- Red paper lanterns were still on during the successful run, and their source was unchanged from the checkpoint.
  Removing lanterns is not this fix. Synth-only audio also failed, so sampled audio was not necessary for the failure.
- The earlier Opus checkpoint also failed during this investigation. Do not label it a verified good baseline or
  attribute every earlier crash to this commit. See [the broader audit](nine-dragon-phone-regression.md).
- The successful trial exceeded the strict **1.0 GB Explorer** target. E264 remains open for that budget, repeated
  default-build physical acceptance, and longer/moving-camera runs. Do not turn this incident record into a claim
  that all memory goals or all iOS crash causes are solved.

## Permanent global prohibition

Jake explicitly requested this across the **entire baseline and every shard**, not only mobile. The facade builder
now has only the instanced path. Its multi-draw option, BatchedMesh branch, batching shader support and Debug toggle
are removed. Old stored `nineFacade: auto` values cannot enable it. Do not reintroduce this through another builder,
shared helper, renamed feature or per-platform exception. Future agents must use instancing for facade geometry.

`scripts/test-facade-instancing.mjs` runs the real Nine Dragon scene in a multi-draw-capable Metal Chromium browser,
with the retired Auto value still stored and lanterns on. It checks **desktop**, **phone tier** and **iPhone UA with
desktop quality**, enters World Explorer, and requires no batched facade, positive instanced facade content, lantern
content, a live context, rendering, and no unexpected reload/error. It is included in `pnpm test:gpu-boot`. This
prevents selection of the known unsafe path; it is not an emulation of the native iPhone memory failure. Since E323 (2026-09-30) a static gate, `test/facade-no-multidraw.test.ts`, also runs in every push and CI: it fails
if anything under `src/chunks/nine-dragon-stack/` asks for `draw: 'batched'`, `BatchedMesh` or the multi-draw extension. The historical
pre-fix exported build failed the real-scene check with one batched facade in both tested mobile profiles.

The prohibition is project policy, not a temporary flag agents may remove after a favorable benchmark. A future user
request to revisit that policy would still need native physical evidence; performance numbers alone cannot justify
silently changing it. Other rendering optimizations must preserve visual content and report:

1. Exact commit, build, device/OS, settings, camera and before/after behavior.
2. Repeated cold load, reload, Explorer entry, movement and background/resume on physical Safari and Chrome.
3. Native memory evidence: **≤1,800,000,000 bytes loading**, **≤1,000,000,000 bytes Explorer**. Account for GPU memory
   separately where available; missing measurements are missing evidence, not zero memory.
4. Simulator high-water watchdog and GPU recovery/reporting results, without treating them as physical acceptance.

The broader renderer also uses batching for some non-facade systems (forests, crags and interactables). This specific
incident does not prove those paths caused the Nine Dragon failure. E272 removes and prohibits **facade multi-draw**;
it must not be misreported as removal of all non-facade batching.

See [the watchdog guide](../ios-memory-watchdog.md) and [E264](../tasks/asks/E264.md) for ongoing memory acceptance work.

## E272 regression validation

The real-scene test failed the historical pre-fix export: multi-draw supported, one batched facade, in both phone
profiles. The replacement passed all three profiles with multi-draw supported, **zero batched facades**, over 13,600
instanced facade objects, lanterns present, one navigation, a live context and no page errors. Render calls were 115
desktop, 96 phone tier, and 115 iPhone UA with desktop quality. These are local Metal Chromium checks of the removed
path, not new physical-phone memory measurements.
