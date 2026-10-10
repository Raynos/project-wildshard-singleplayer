# SF22 early visible variants

The exact-source Simulator diagnostic on `7eb7bc08c` identified all 16
remaining route draw-time shader calls: 4 far-proxy, 2 volumetric-scattering,
8 layered dome/cloud/planet/ring, and 2 sword calls. This diagnostic uses
stacks and native program queries and carries **no cadence credit**.
Raw evidence: `/private/tmp/claude-501/sp-builders/sp-x5/sf22-approach-proof/attempt-7eb-safari-exact-owner.json`.

The separate volumetric march was compiled against the caller's canvas, then
drawn into its half-float target. Output colour space / tone mapping are
program-key inputs even for its raw shader. `warm()` now borrows the actual
march target, restoring the caller target on success or failure. No shader,
uniform, target format, frame clock or rendered pass changes. The focused
fixture checks the actual effect's owned target and both restoration paths.
Matched cadence / compilation remains open; no new performance pass claimed.


The layered sky now prepares its final attached materials against the actual
page lights / composer target before registering visible frame weight on
WebKit. The dome, clouds and planet retain their original geometry, material,
blend parameters, uniform identities and render order. Chromium retains its
existing preparation path. Ownership cleanup is registered before preparation:
retirement or failure releases the admitted sky instead of exposing it.
Focused fixtures cover ordering / retirement and the limited material
inventory against unchanged page lighting. A matched route is still needed
for performance credit; this scheduling slice adds no shader or look variant.

The early-boot follow-up routes this through `Game.warmSkyLayer`: a regional
sky can attach before the composer exists, so ordinary boot preparation owns
that case. A ready composer uses its real input target. The native regional
fixture covers attachment-created environment ownership before composer build
and the ready-composer fixture checks the exact preparation arguments.

The `5d2e888e4` Simulator diagnostic stopped on the return to Driftwood:
`play` refused with `Invalid director observation`; the source was retired
and the road wall correctly stayed closed. All browser / native resources
closed. Loads were 99–102 forward and 26–102 returning: no timing credit.
Before refusal, the exact-source journal had six draw-time shader calls
(four far-proxy, two sword); the previous ten sky / march calls were absent.
This incomplete run is not an SF22 pass. Raw scratch evidence remains at
`attempt-5d2-attached-sky-failed.json` beside the existing owner diagnostic.

Streamed far proxies now prepare their actual material / object variants on
WebKit before visible ring upload, against the current page and its declared
exterior light / environment inventory. The same admitted geometry, material
and mesh are exposed after preparation; no extra ring claim or duplicate view
is created. Cancellation and preparation failures retire the hidden view.
Chromium's existing path stays unchanged. The attached-sky inventory shares
this bounded preparation primitive. Focused lifecycle and lighting fixtures
cover the ordering, resource identity and owner fences. Matched route results
remain open; this slice claims no new cadence pass.


The sword constructor mounts its model before the asynchronous equipment
factory finishes; the road frame could draw it before `afterPlay` warm-up.
WebKit regional construction now routes only that owner's additions into a
hidden identity group under the same shared camera. Ordinary warm-up still
inventories the actual materials. Entry exposes it, leave hides it, and the
runtime owner removes it. Other owners and Chromium keep their existing path.
The native fixture covers awaited additions, unrelated page callbacks, exact
material/geometry identity, unchanged camera transforms, depth-clear order
and cancellation. No shader, clock, equipment or gameplay rule changes;
matched performance remains open.


## Completed streamed-far owner diagnostic

Pin `56dde3a5cd410415da5b1b33ccf72aa9605634a6`, iOS Simulator
Safari, phone 2×, Developer off, Auto, Driftwood → Signal → Driftwood.
The same aggregate 5 Mbit/s queue and 3 / 10 s asset stalls were used.
Both real-input routes completed, zero refusals / game errors / GL faults;
all browser, Inspector, sampler and preview resources closed.

Within the two route windows, 392 shader calls were explicit warm-ups and
**2 were draw/driver calls**. The 4 far-proxy calls are gone, as are the
previous sky / march calls. Both remaining calls are `sword`, at 75,702 ms,
inside Driftwood `afterKit` (75,570–75,719 ms), before `afterPlay`
(75,873–76,450 ms). This directly corroborates the constructor exposure
fixed by `d7caa82c4` / `2495c2bbc`; those fixes are not in this diagnostic.
Maximum synchronous explicit warm-up interval: 23 ms.

Crossing synchronous durations: 32 / 2 / 13 / 0 ms; demand waits:
5 / 8 / 5 / 5 ms; activation: 4 / 2 / 4 ms. Raw route cadence:
p95 71 / p99 135 ms. Median machine load: 117.01 forward / 107.95 return.
This exact-source/native-program diagnostic is intrusive, with **no timing
or cadence credit**; a matched uninstrumented run remains required.
Simulator memory authority remains the G269 phone runs, not this subset.

Raw scratch: `attempt-56dde-streamed-far-owner.json`, beside the prior
owner captures, SHA-256 `88a1da827baf00f888db1cdb18e4763d4257bd8ad00b38e97c251370707d3904`.
Proof: `.git/proofs/20261010T082450-sf22-streamed-far-56dde-43341.json`.


## Matched hidden-model run: compilation closed, cadence still open

Pin `2495c2bbc5fba185bac3cfb27537d975b84b8f65`, phone 2×,
Developer off, Auto, 5 Mbit/s and 3 / 10 s asset stalls. Proof process
completed successfully; that means the measurements completed, **not that
all SF22 gates passed**. All six desktop real-input routes and the ordinary
Simulator Driftwood → Signal → Driftwood subset completed with zero
refusals / game errors. Preview, browser, Inspector and Simulator closed.
The owned quiet marker was removed in `finally` (13:47:47–13:58:42 UTC).

Desktop timing from 13:47–13:53 UTC is **discarded**: two external cold
Nalati browser captures overlapped the first three routes (commit
`8b144a8d0` at 13:52:31 UTC). Load jumped 7.97 → 13.17 at 13:50:14.
Their raw values remain visible, but neither low median CPU load nor a
passing raw cadence result establishes isolation from the other GPU client.
No complete matched desktop timing pass is credited from this run.

| Desktop route | UTC interval | Median load | Raw p95 / p99 ms | Timing credit |
| --- | --- | ---: | ---: | --- |
| Driftwood → Pine | 13:48:56–13:50:52 | 10.39 | 33.4 / 33.5 | Discarded |
| Pine → Nalati | 13:50:52–13:52:28 | 6.84 | 33.4 / 33.5 | Discarded |
| Nalati → template-2 | 13:52:28–13:53:07 | 4.80 | 33.4 / 33.5 | Discarded |
| template-2 → Sky | 13:53:07–13:54:58 | 5.57 | 33.4 / 33.4 | Outside reported overlap |
| Sky → Signal | 13:54:58–13:55:41 | 4.50 | 33.4 / 33.5 | Outside reported overlap |
| Signal → Driftwood | 13:55:41–13:56:20 | 3.99 | 33.4 / 33.4 | Outside reported overlap |

The raw desktop aggregate is p95 33.4 / p99 33.5 ms, with observed
0.1 ms timestamp quantum and same-session standing p95 33.4 ms.
Synchronous crossing maximum is 19.6 ms, demand wait maximum 3.2 ms;
the affected route intervals above carry no timing credit. First-crossroads
draw/driver calls are zero. The all-route warm-task gate **fails**: a 51 ms
Long Task overlaps Driftwood `afterPlay` on the Signal approach, outside the
excluded interval. Maximum synchronous `renderer.compile` invocation is
6.4 ms; that API duration does not bound its containing task. The failed
51 ms task remains a separate scheduling item.

Safari measured 13:56:54–13:58:35 UTC, after the reported capture overlap.
Both routes completed with **zero draw/driver or unclassified shader calls**:
394 route calls were explicit warm-ups; the previous two sword calls are
gone. Synchronous crossing durations are **18 / 0 / 9 / 0 ms**, demand waits
3 / 4 / 4 / 3 ms, and activation maximum 3 ms. Maximum explicit compile
invocation is 5 ms. Safari exposes no Long Task observer: the containing
warm-task bound is **unavailable**, not zero and not a pass.

Safari cadence still **fails**: aggregate p95 **47 ms**, p99 **69 ms**,
against same-session standing p95 34 ms and observed 1 ms timestamp quantum.
Forward raw p95 / p99 is 48 / 89 ms (median load 17.60, **under load**);
return is 46 / 53 ms (median load 12.76). Zero shader calls at draw time
has not established 30 fps. The next diagnostic reads the existing drawn
frame work/update/render rings to distinguish frame work from waiting,
without native program queries or an assumed GPU attribution.
Simulator memory authority remains the G269 phone runs; this is only the
honest Auto Driftwood/Signal subset, not full-G270 Simulator admission.

Raw scratch, not committed: `attempt-2495-hidden-model-desktop.json`
SHA-256 `e32080ef82fe6124fd7308fd21f38ace129463d68e705e43a9059a736a346c15`;
`attempt-2495-hidden-model-safari.json`
`be689401540f2ba5d946dc894b76bfdc113fdea50119762e2a0a02d4e355f3c2`;
`quiet-2495-hidden-model.json`
`0f6bf72b20262af13055e1ee99b928895d6229622cf8fd73b131bd69c7867b4d`.
Proof `.git/proofs/20261010T083631-sf22-hidden-model-clean-matched-73207.json`.


## Existing-frame-ring attribution after the priority push

The first CPU-owner attempt was interrupted at the coordinator's request:
its quiet marker was released for the priority push; brief Safari startup
and the aborted attempt carry **no timing credit**. The replacement waited
for the next pusher ok/RED result and actual `push-main` exit before opening
its own quiet window, 14:47:32–14:50:19 UTC (removed in `finally`). Same
`2495c2bbc` runtime, Auto / Developer off / phone 2×, shaped network and
held-input Driftwood → Signal → Driftwood. This diagnostic adds only reads
of the existing completed-frame work/update/render rings, draw counts and
fixed-step count; no new engine timing hooks, GL queries or scoped CPU hooks.

Both routes completed with no refusal / game error and zero draw/driver
compiles (394 explicit warm-ups). Sync crossings 20 / 0 / 11 / 0 ms;
demand waits 4 / 3 / 3 / 3 ms. The task bound remains unavailable on Safari.
Raw aggregate cadence **fails**, p95 49 / p99 72 ms, standing p95 34 ms,
observed timestamp quantum 1 ms. Per-route machine loads remain explicit:

| Interval | Load median (min–max) | Cadence p95 / max ms | Work p95 / max ms | Update p95 / max ms | Render p95 / max ms |
| --- | --- | ---: | ---: | ---: | ---: |
| Driftwood → Signal | 17.94 (15.15–19.56), under load | 50 / 165 | 9 / 31 | 5 / 27 | 4 / 14 |
| Signal → Driftwood | 12.66 (11.61–15.15), brief load >15 | 48 / 131 | 8 / 44 | 5 / 23 | 3 / 21 |
| Standing A, actual final pose | — | 34 / 36 | 7 / 12 | 4 / 8 | 3 / 4 |
| Standing B, same pose | — | 34 / 39 | 7 / 10 | 4 / 7 | 3 / 4 |

The largest forward frame gap is at 28,432 ms: **165 ms between drawn
frames, only 5 ms in the completed frame** (update 3 / render 2). That gap
spans Signal `kit` (28,267–28,286), `afterKit` (28,287–28,338) and `play`
(28,346–28,426), with no shader calls. A 104 ms gap at 29,065 overlaps
Signal `afterPlay`, again only 3 ms in the completed game frame. Return
road gaps at 57,971 / 58,294 / 62,335 ms overlap Driftwood `world`, with
only 3 ms game-frame work. These gaps are **not measured GPU durations**,
and hook overlap does not identify a synchronous CPU task: asynchronous
admission work, event-loop scheduling and native waiting remain possible.
The next task-level attribution must retain that distinction.

The return entry has a separate outlier: 131 ms frame interval at 64,117,
44 ms completed-frame work (update 23 / render 21), after Driftwood
activation (64,004–64,005). This is real CPU-side frame work above 33 ms,
not a new compile. Standing rendering still holds 34 ms at the same final
pose with ~1.35 million triangles and 160 median draw calls.

Nine Dragon's queued cell-entry diagnostic was withdrawn before any build,
browser or Simulator acquisition when the coordinator assigned that hitch
and the desktop 51 ms Driftwood `afterPlay` task to `op-hitch23`. There is
no Nine measurement from this lane.

Raw scratch `attempt-2495-safari-frame-work.json`, SHA-256
`70ecb580de8c93aca4c9f18cf92d5a57331bd7d9951ee066b5e94773d4e61f53`.
Proof `.git/proofs/20261010T091757-sf22-safari-frame-work-after-push-32331.json`.
All resources from this run closed. No 30 fps or phone-memory pass.


## Same-document Safari task-clock pilot: unavailable

On `0b191cf2a`, the already-booted grid document was profiled through its
existing Inspector connection, after entering the public home. The page's
`performance.now()` measured the deliberate diagnostic task at
**12,381–12,393 ms (12 ms)**. Inspector accepted Timeline and ScriptProfiler
commands without protocol errors, returning **40 timeline records and one
profile**. All **658** start/end/sample timestamps were **zero**. No
positive mapping to the known page-clock interval exists. This reproduces
the SF67 clock limitation even without a navigation or target reconnect.

The shaped route was deliberately omitted after clock validation failed.
The proof's exit 0 means the pilot and cleanup completed; it is **not** a
cadence, warm-task, crossing or CPU-attribution pass. No task duration is
inferred from stack counts or zero Inspector clocks. Task-level attribution
through these protocols is blocked; existing frame-ring and hook-wall
measurements remain the evidence above. A bounded page-callback diagnostic
may expose measured callback work, but cannot cover every native or async
continuation and must stay separate from normative timing credit.

Pilot 16:16:48–16:17:09 UTC, 2026-10-10; no quiet window requested. Preview,
Safari, Inspector and proxy closed. Raw scratch SHA-256
`c8c1fa7be5488786a6db97025d75bb23c3a35e98121a0bfec0d69ee60d15a658`.
Proof `.git/proofs/20261010T111519-sf22-safari-task-clock-pilot-86332.json`.


## Page-callback diagnostic: gaps remain outside captured callbacks

Same `0b191cf2a` runtime, Auto / Developer off / phone 2× and the same
shaped held-input Driftwood → Signal → Driftwood route. This diagnostic
wraps page rAF, timers, queued microtasks and explicit Promise callbacks; it
measures synchronous **wall intervals**, not CPU time. Native `await`
continuations are not covered, nested intervals overlap, and registration
metadata/timing adds overhead. It therefore carries **no normative cadence
or warm-task credit**. Focused Node checks preserve argument/receiver,
return/error, timer handles, bounds and ownership-safe restoration. The
page's deliberate timer calibration measured exactly 8 ms.

Both routes completed without refusal or game error; 394 explicit shader
warm-ups and **zero draw/driver compiles** remain. Sync crossings were
19 / 0 / 10 / 0 ms, demand waits 3 / 3 / 2 / 3 ms. Diagnostic cadence p95
50 / p99 65 ms, same-session standing p95 34 ms. Forward load median
18.11; return 19.00 (raw route load ranges retained).

Within routes, the observer recorded **619 rAF, nine timer and one explicit
fulfilled-Promise callback** at least 5 ms. Maximum timer wall time was
11 ms; the explicit Promise callback was 5 ms. A **50 ms rAF interval** at
65,853–65,903 ms agrees with the completed game-frame ring (update 25 /
render 25 ms), after Driftwood activation. That is a real measured frame
callback; it does not attribute its internal systems or native driver cost.

The 165 ms gap at 29,413 ms still spans Signal `kit` / `afterKit` / `play`
(29,249–29,411 ms), but only a 5 ms recorded rAF callback overlaps it.
A 157 ms return-road gap during Driftwood `world` contains a 10 ms recorded
callback; other 102–129 ms road gaps contain none above threshold. This
**does not exonerate preparation**: async continuations and native waits
remain unmeasured. The observer saw 89,548 callback registrations;
registration stacks stop after 2,000, so later callback source is retained
without an exact registration callsite. Rows did not truncate.

The next distinct diagnostic records raw rAF delivery and wall time of
existing GL calls without adding GL queries, separating delivery/skipped
frames from observed native API stalls. No GPU-duration inference.

Run 16:21:13–16:22:55 UTC, 2026-10-10; no quiet window requested. All owned
resources closed. Raw scratch `attempt-0b191-safari-callbacks.json`, SHA-256
`d4e0699f9feea6f3efa9207c8bd7c62aa6a3b35ff977c257f44072346434eee9`.
Proof `.git/proofs/20261010T112017-sf22-safari-callback-owners-2840.json`.

## Raw rAF / existing-GL-call owner diagnostic and upload slice

Same `0b191cf2a` runtime and shaped Auto subset, 16:27:05–16:28:46 UTC.
The observer records wall time of existing GL invocations, without
additional driver queries, and rAF delivery before the drawn-frame filter.
These are native API wall intervals, **not GPU execution durations**;
wrapper overhead and load make this diagnostic, not a normative verdict.
Focused checks preserve receivers, arguments/results and exact call count.

Both routes completed without refusals/errors; 394 explicit warm-ups, zero
draw/driver compiles. Cadence remains open: diagnostic p95 50 / p99 74 ms
versus standing 34 ms. Forward load median 15.21 (12.44–17.25), return
15.89 (14.67–16.99); both include load >15. All 4,713 rAF deliveries and
37 GL calls at least 5 ms fit their bounds.

The largest measured GL calls are image `texSubImage2D` uploads in sliced
precompile: 30,342–30,370 ms (28 ms), 30,469–30,488 (19 ms) and
30,536–30,556 (20 ms). Checking a 12 ms upload budget only after each
call can combine several unpredictable uploads before yielding. Forward
raw-rAF p95 is 21 ms (median 17, maximum 137), return p95 17 ms
(maximum 103); standing p95 17 ms. Drawn frames still miss at 50 ms p95.
This does not establish a frame-cap defect: admission/native delivery gaps
and observer ordering relative to the game callback remain explicit.
The two largest drawn gaps (168 / 166 ms) have no observed GL call at least
5 ms; those waits are still unexplained by GL timings.

The generic forward isolates each image upload during WebKit entered-world
warm-up, yielding after every image before proceeding to the next. The
same texture object, source, version, sampler and upload order remain;
compressed uploads keep their existing fenced path. Ordinary boot and
desktop retain batched uploads. This prevents combining upload costs, but
cannot split an individual native call or claim the complete cadence gate.
Two new tests prove separate paint opportunities with unchanged resources,
ordinary batching and cancellation before a later upload; all 19 focused
precompile checks, strict and touched root lint are green. Matched timing
verification on the landed slice remains pending.

Raw scratch `attempt-0b191-safari-gl-wall.json`, SHA-256
`1cf34c1eabb6a7b969f82683aff41cff1e043295e554b84fa893d83a4e351b06`.
Proof `.git/proofs/20261010T112602-sf22-safari-raf-gl-wall-18482.json`.
All owned preview / Safari / Inspector / proxy resources closed.

## Isolated-image matched result and completed-draw barrier

Runtime `791f8871f`, 2026-10-10, quiet marker 16:37:49–16:49:35 UTC
(removed in finally; no expiry). Desktop ran 16:38:38–16:47:41;
Safari ran 16:47:46–16:49:27. Same shaped network and real held-input
routes, diagnostic callback/GL wrappers disabled, all resources closed.

Desktop's six routes complete without errors/refusals. Drawn p95/p99
33.4/33.4 ms equals standing 33.4 within the observed 0.1 ms quantum:
cadence PASS. Crossing synchronous maximum 25.1 ms, demanded wait
maximum 3.3 ms: install PASS. First crossroads has zero shader calls.
Explicit route warm-ups: 2,900; no overlapping task above the observer's
50 ms threshold. This is a task upper bound, not a measured zero.
Per-route load medians 4.78/3.62/3.34/2.85/2.99/3.74 (all maxima <6).

Safari Auto's honest Driftwood → Signal → Driftwood subset completes
without refusals/errors. Synchronous work 18/1/8/1 ms and demanded wait
3 ms pass; 394 explicit warm-ups, zero draw/driver compiles. Cadence
FAIL: p95 47 / p99 63 ms against standing 34 and observed quantum 1 ms.
Forward load median 16.96, return 12.15; both include load >15, so timing
is under load. Safari's warm-task bound remains unavailable, not zero.
No improvement credited to image isolation. Memory remains G269 phone
runs; this subset is not full G270 coverage.

The scheduling forward waits for a fresh completed game draw and a paint
opportunity between live WebKit preparation batches. Browser rAFs skipped
by the game cap cannot release the next batch. Initial boot and desktop
retain ordinary paint opportunities; resources, samplers and upload order
stay unchanged. Focused tests cover skipped frames, custom barriers and
retirement before/after a draw, with no retained handles. Matched cadence
verification of this forward is pending; SF22 Safari remains OPEN.

Scratch evidence: `attempt-791f-desktop.json` SHA-256
`61b4a06649b457672df912c69a871a2f48dcbfa0e869688453d621e0ab061034`,
`attempt-791f-safari.json`
`db25269ad063c1781d6ef576c85690a2f42442deb2e9441ef4a88fb811813a9d`.
Proof `.git/proofs/20261010T113418-sf22-isolated-images-matched-49487.json`.
