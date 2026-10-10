# SF22: shaped approach, one completed entry and a speculative-copy deadlock

2026-10-09. Runtime pin `662a124349f858df644581008c77ffe6b14002c5`.
**Not a complete SF22 pass.** Chromium entered Pine; the next route stalled before Nalati.
Simulator Safari refused Pine's image-fallback claim. Phone memory remains G269.

Both surfaces use the public G270 catalogue, live held-input road crossings, phone tier, 2× render scale,
Developer off, Memory saver off and Auto textures. Network shaping starts after the initial home is playable:
5 Mbit/s, with 3 / 10 second asset stalls. This measures cold neighbouring entries, not cold application boot.
No limit, admission, route deadline or safety assertion was relaxed.

## Chromium Metal

| Measured owner / interval | Result |
|---|---:|
| Driftwood → Pine route | 117.416 s |
| Pine world hook, wall time including fetches | 52.266 s |
| Pine kit | 4.245 s |
| Pine afterKit | 18.083 s |
| Pine play | 3.108 s |
| Pine afterPlay | 2.768 s |
| Completed preparation before Pine commit | 115.3 ms |
| Pine demanded readiness wait | 4.3 ms |
| Pine synchronous frame commit | 0.2 ms |
| Pine entered activation | 3.5 ms |
| First-route drawn-frame p95 / maximum | 33.4 / 450 ms |
| First-route one-minute load median / range | 28.44 / 21.01–39.76 |
| Subsequent Pine departure commit | 43.7 ms |

Pine's final activation fits 33 ms, but the long approach wait, cadence and later departure do not establish the
overall gate. Timing is **under load**. Hook wall times include network waits; they are not CPU-task totals.

The Pine → Nalati route timed out with no refusal or network failure. A speculatively prepared `template-2` stayed
resident after the road turn; `LiveGridHost.beforeFixed` only retired speculative **exclusive** runtimes. Because
an owned approach requires an empty resident set before allocating its opaque destination, Nalati never started.
The forward fix durably retires every replaced speculative region. Save/disposal refusal retains the world and
claim until explicit retry. Real-Rapier tests cover a declarative copy → opaque runtime turn and quota refusal.

## Simulator Safari

Auto's compressed probe rejected the available ASTC / ETC2 targets and selected images. Its initial projected
image playing envelope was 1,207.0 MB; Pine was refused with `Live sim admission deferred by the shared budget`.
There is no entered Pine timing or Simulator memory pass. Caps stay unchanged; G269 is the phone memory ruler.

## Harness integrity and remaining work

The first attempt lost its preview files and produced `Failed to fetch`; it has no timing verdict. The repeat used
a dedicated port and recorded 233 healthy preview samples (live PID, registry, disk version and matching HTTP 200).
Both attempts closed their browsers, Safari, Inspector, proxy and owned preview. No native sampler or second
Inspector was used.

Re-run all six entries after the speculative-copy fix. Investigate departure checkpoint/disposal work above 33 ms,
and advance world-asset downloads before construction; module-only prefetch leaves most download work on the road.
The Simulator fallback refusal remains explicit rather than being counted as a successful crossing.

Raw diagnostic artifacts remain outside git:
`/private/tmp/claude-501/sp-builders/sp-x5/sf22-approach-proof/` (`result.json`, `simulator-result.json`,
`preview-health.jsonl`, matched harnesses and the invalid first attempt).

## Copy-turn forward: four entries, then a real Sky checkpoint refusal

The desktop repeat on `0be1a5b89ce31bd08fa989650664b411abf06ddf` uses the same shaping, held-input route and limits.
Pine, Nalati, `template-2` and Sky Reach all admitted and entered with no issue. Their route times were
117.376 / 74.669 / 80.197 / 111.287 s; one-minute load medians were 43.46 / 45.50 / 46.94 / 34.69.
The run then refused Sky's departure, so Signal and the return home remain unproved. All owned resources closed.

The refusal reported a native coordinate of −622.6604614257812. Its field was not captured; the original
attribution to height alone was incomplete. The vertical-only forward did not fix departure. A real Rapier witness
shows why the remaining horizontal bound is invalid too: a native WORLD fall passes below the border walls
(they end at y = −250), and steering then continues horizontally in the void. `AnimalSim.restore` accepts all
finite native positions. The follow-up preserves that exact position law, without clamping or changing the fall,
border or steering law. Non-finite coordinates, identity/health failures and quota refusal still preserve the
previous durable save. This is the existing logical HP/pose continuation, not full creature-physics continuation.

Departure commits still measured 45.1 ms for Pine and 123.1 ms for the template. Entry commits measured
0.2 / 0.1 / 0.0 / 0.1 ms and entered activations 3.7 / 4.8 / n/a / 1.5 ms. The run did not contain the subsequent
checkpoint/frame/disposal timing boundaries (`7e1f3d40b`), so these departure owners still require attribution.
The earlier Pine first-entry 439 ms long task contained 26 `compileShader` calls after its activation: approach
warm-up did not cover all first-drawn program variants. That remains open alongside the long world/afterKit waits.
No complete SF22 timing or memory pass is claimed.

## Future-light warm-up repeat: unresolved first-draw variants and departure owners

The repeat on `e48562761643dcefd5fea9f02a7868330ab77a6f` again entered Pine, Nalati, the template and Sky, then
refused Sky departure on a native coordinate outside ±250. Signal and return-home remain open. The phased
crossing clock now attributes Pine departure to 3.1 ms save + 0.1 ms motor/frame commit + 39.7 ms leave/disposal;
template departure is 100.8 ms save + 0.1 ms frame commit + 0.2 ms changed callbacks. No departure pass is claimed.

Detached future lights warm post-entry counts without changing the drawn lights, but first-frame compilation is
still open: Pine activation was 3.3 ms inside a 367 ms task with 70 shader calls in its following second; Nalati
activation was 4.3 ms inside an 82 ms task with 18 calls; Sky activation was 1.2 ms with no calls in that window.
The subsequent diagnostic reads substituted shader light-array sizes to distinguish remaining variants; these calls include the
following second and are not an exact per-frame count. Route load medians were 26.29 / 43.62 / 42.32 / 20.80,
so timing is under load. All owned browser/preview resources closed.

## Completed midpoint circuit: six entries, timing gate still open

The repeat on `c04034a41fcf87033bd3489f6e3ac110af5a8973` completed the whole held-input circuit:
Driftwood → Pine → Nalati → template-2 → Sky → Signal → Driftwood. All six entries admitted, with twelve physical
frame crossings, five runtime activations, zero refusals, errors or network failures. The same 5 Mbit/s shaping,
3 / 10 s stalls, 150 s leg deadline, public settings and limits remain. All owned browser/preview resources closed.

This is **not an SF22 pass**. The drawn route's 13,375 frame intervals have p95 **33.4 ms**, p99 33.5 ms and maximum
416.5 ms, against the unchanged 33.3 ms p95 gate. Pine departure totals **39.3 ms**: 2.7 ms save, 0.0 ms motor/frame
commit and **36.6 ms leave/disposal**. Other departure totals are Driftwood 22.5, Nalati 19.6, template 22.6,
Sky 14.9 and Signal 4.9 ms. The template's improved result is one repeat under varying load, not causal credit.
Runtime entry activations are Pine 2.4, Nalati 5.1, Sky 1.5, Signal 0.7 and return-home Driftwood 1.1 ms.

Preparation completed before each entry commit, but long approach waits remain: Pine world / afterKit / afterPlay
wall intervals are 52.252 / 18.017 / 2.749 s; Nalati's are 35.008 / 13.550 / 0.983 s. These intervals include awaited
work. One-minute load medians by leg are 28.25 / 31.71 / 38.10 / 30.09 / 26.31 / 19.83, so every timing is **under load**.
The midpoint direction fence avoids constructing worlds while moving parallel to their border; product prefetch
and admission remain unchanged. A player can still turn after legitimately approaching an intermediate socket.

Actual shader uniform sizes distinguish a remaining first-draw cause: Pine warms and enters with five point lights,
yet still calls `compileShader` 70 times in the following second. That is not explained by point-light count.
Signal warms with two and enters with three; its first second has 52 calls. Nalati has 18, Sky zero and the return
home 74. The first crossroads has no compilation. These are calls across a second, not exact per-frame CPU costs.
A targeted program-cache-key capture follows; no shader or overall crossing pass is claimed.

`78b0d7d12d1b8c6558d72dc793a99f576fe01112` additionally compares native checkpoint matches four bytes at a time.
Golden packets cover unaligned bases, each word-tail length and overlapping internal references: encoded bytes,
checksums, quota, capture boundary and decode remain exact. An interleaved local Node comparison on a 1,625,923-byte
native template snapshot measured median 6.88 → 4.15 ms over twelve pairs, with large outliers in both arms.
This is encoder attribution, not phone or crossing credit; the completed circuit predates this change.

The Simulator image-fallback refusal above stands. Forced compressed Simulator residency is not a valid phone
memory ruler; the memory verdict remains the G269 phone runs. Remaining work is Pine departure cleanup,
first-drawn shader variants, long world/afterKit waits and drawn-frame cadence. Immutable raw completed-circuit
artifact: `attempt-c040-midpoint-result.json` in the scratch directory above. No raw archive is committed.

## PMREM and resource-capture attribution

The two-leg diagnostic on `1112e45b38d18d8d1bb47360df3fe6ee6460a762` entered Pine and Nalati without refusals or
errors. Pine departure was 36.4 ms (2.2 ms save, 0.1 ms frame, 34.1 ms leave), while entered activation was
2.8 ms for Pine and 5.3 ms for Nalati. Pine still issued 70 shader calls in its first second; this repeat does
**not** credit the initial PMREM warm-up change. Nested disposal observations attributed 12.4 ms to the regional
world and 10.6 ms to its view. Those wall intervals overlap and the callback observer adds overhead; this is
attribution, not a complete circuit or normative timing verdict.

The missing environment has a concrete lifecycle cause: the keyed sky creates its PMREM during layer attachment,
but the first implementation read the holder's environment before attachment, when it was null. `7e2a66d3a`
reads it after the real attachment. Its fixture creates the environment at that same point and proves the
regional scene borrows it without a second native disposal (`528d247e1`). No sky, visibility, claims or look change.

`8d5286dff` also walks each shared material/uniform container once within a scene resource capture, with a new
visited set on the next capture. Late resources and independent delegated owners remain discoverable. A local
Node comparison of 4,096 meshes sharing three resources used 24 interleaved pairs, discarding four warm-up pairs:
median walk time was 7.28 → 0.84 ms, with identical resource identities. This is a synthetic CPU attribution,
not a measured crossing or phone saving. The subsequent two-leg `8d5286dff` diagnostic does not credit a live
departure saving: Pine departure was 45.4 ms, with 42.3 ms leave, under one-minute route-load medians 28.13 / 34.28.
Its warm-target readout confirms the bound scene was the correct `region-scene:pine-hollow`, with a null
environment; Nalati's environment was null too. This rules out the suspected wrong-scene binding for that run
and corroborates the attachment-order cause. The repeat predates `7e2a66d3a`.

Immutable raw diagnostic: `attempt-1112-environment-disposal.json` in the scratch directory above. Scope callback
timing and program-key snapshots run only in diagnostic mode in the next harness; the full-route timing run omits
those extra observers. Memory remains the G269 phone verdict and the Simulator fallback refusal stays recorded.

## Attached PMREM repeat and closing-owner fence

The two-leg diagnostic on `7e2a66d3ae7cb70539846ec99e61e99cbb44c063` confirms the parked Pine scene now borrows
its actual attached PMREM (CubeUV mapping 306, image height 512). Pine's first entered second issued **14 shader
calls**, down from 70 in the preceding diagnostics; eight new programs remained, down from 33. Seven of those
cache keys differ only in shadow-pass point-light count (warm five, draw two); the eighth is an object-flags variant.
No pixel, light-count or residency change is inferred from those cache-key observations.

Pine / Nalati activations were 3.4 / 5.7 ms and entry commits 0.2 ms each, with no refusals or errors. This is still
**not an SF22 pass**: Pine departure was 45.3 ms (save 3.0, frame 0.0, leave 42.3). One-minute route-load medians
were 23.87 / 39.07. Callback instrumentation attributed the largest direct cleanup to final scene-tree capture
and detach: 8.1 ms under the regional world and 7.4 ms under its view. Nested totals overlap and instrumentation
adds overhead; these are diagnostic attribution, not normative full-circuit timing or phone credit.

`da41f86e72` fixes a concrete cleanup error exposed by that lifecycle: a scope marks itself closed before running
its resource cleanups, so its final tree capture used to re-adopt and dispose its own just-freed textures again.
Existing ownership by the same closing scope remains authoritative; unseen late resources are still captured and
freed immediately. A real Scope fixture proves texture, geometry and material native disposal exactly once and
an empty final census. This correctness fix has no measured crossing credit yet. The following full matched
circuit includes it and omits the diagnostic callback/program-key observers.

Immutable raw diagnostic: `attempt-7e2a-attached-pmrem.json` in the scratch directory above. All owned resources
closed. Memory remains G269's phone verdict; the Simulator image-fallback refusal remains unchanged.

## Full six-cell circuit with the closing-owner fence

The matched Chromium Metal phone-tier run on `e2b543bf75c447d2856118d008fac374c7d840c5` completed in 536 seconds:
all six entries, twelve physical crossings and five runtime activations, with zero refusals, page errors or network
failures. The network remained 5 Mbit/s with 22 injected 3/10-second stalls. Every required preparation completed
before entry; readiness waits were 2.3–3.2 ms and entry commits at most 0.2 ms. Runtime activation maxima were
Pine 3.1, Nalati 5.4, Sky 1.4, Signal 1.0 and Driftwood return 1.3 ms. **The crossing-install gate passed**:
maximum synchronous crossing work was Pine departure at 32.0 ms (save 2.1, frame 0.0, leave 29.9).
Other departure totals were Driftwood 17.1, Nalati 15.0, template 30.7, Sky 19.2 and Signal 6.0 ms.
This is a complete measured pass for this circuit, not an isolated causal credit for the cleanup fix.

**SF22 overall remains open.** Drawn-frame p95 was 33.4 ms against the unchanged 33.3 ms gate (p99 33.5;
maximum 316.7). Both ten-second standing samples drew exactly 300 frames and also measured p95 33.4 ms.
The mobile loop intentionally caps at 30 Hz; 1000/30 is 33.333… ms, and Chromium timestamps quantize this into
33.3/33.4 ms. This observation does not change the limit or turn the recorded cadence failure into a pass.
Signal's first visible draw coincided with a 314 ms task despite its 1.0 ms activation hook. First-entered-second
shader calls were Pine 14, Nalati 18, Sky 0, Signal 62 and Driftwood return 12. The crossroads window contained
182 calls, including background approach preparation; that run did not distinguish explicit warm-up from draw
calls, so its zero-compilation gate remains failed rather than attributing all calls to first-draw compilation.

World/afterKit wall intervals remained large: Pine world 52.3 s and afterKit 18.0 s; Nalati world 29.4 s and
afterKit 13.5 s; Sky world 46.2 s. These include awaited work, not CPU-task time. Per-route one-minute load medians
were 19.00, 16.79, 19.47, 13.89, 27.47 and 35.53; timings are under load. Memory stays G269's phone verdict;
the Simulator image-fallback refusal remains unchanged. All owned proof resources closed.

The run predates `62f70259f` (preceding shadow light variants), `d15464944` (one delegated resource walk), and
`dbef738da` (the whole regional view's authored sibling lights). Signal's `ctx.root` light exists during world
construction beside its native scene, so native-scene-only future lighting omitted it. The new fixture covers
that exact topology and hidden descendants without changing any drawn light. No live saving is credited yet.
Immutable raw artifact: `attempt-e2b543-closing-owner-full.json` in the scratch directory above; no raw archive
is committed. The next matched run adds synchronous renderer.compile phase labels and retains the original gate.

### Cadence measurement resolution ruling

The coordinator subsequently approved a same-session resolution rule: crossing p95 within one **observed**
timestamp quantum of standing p95 counts as equal. `scripts/sf22-cadence.mjs` measures the smallest positive
spacing between distinct observed frame intervals; an unvarying sample returns unavailable, never an assumed
0.1 ms. Six decimal places remove floating-point subtraction residue while the original raw numbers stay visible.
Every standing p95 must match the unchanged 33.3 ms limit within that measured quantum, and the crossing comparison
uses the smallest standing p95 conservatively. More than one quantum fails; tests include that boundary and an
independently measured 0.005 ms clock. This is a measurement-resolution rule, not a new frame budget.

For the complete `e2b543` journal the observed step is **0.1 ms**, crossing p95 **33.40000000002328 ms**, and both
standing p95 values **33.40000000002328 ms**. The cadence verdict therefore **passes under this explicit ruling**.
The earlier raw 33.3 ms comparison is preserved above as the originally recorded result. Overall SF22 remains
open on Signal's 314 ms first draw and crossroads compilation attribution; the crossing-install pass is unchanged.

## Whole-view matched repeat

The full matched run on `dbef738da006288ed81a3368ffbecd5c0f66b86c` completed in 667 seconds, with all six entries,
twelve crossings, five activations, zero refusals/errors/network failures and 25 shaped stalls. It includes the
whole-view light fix, preceding shadow variants and single delegated-owner walk. Signal's first entered second
had **zero shader calls and no >50 ms task**, versus 62 calls and a 314 ms task previously. Pine had two calls
and a 73 ms overlapping task; Nalati fourteen calls and a 75 ms task. Sky and Driftwood return also had zero calls.
The remaining Pine pair has instancing/instance-colour flags; no causal object owner is inferred from those flags.

The whole first crossroads vicinity (91 observed frames, plus one-second padding on both sides, 147133.7–152133.5
ms) contained **232 explicit renderer.compile warm-up calls and zero draw-or-driver calls**. A separate 62 ms
task overlapped Driftwood's world hook. All shader calls in this window have now been attributed to explicit
background warm-up, not first-draw compilation. The original literal zero-compilation gate stays false; no gate
change is silently inferred from this classification. The observer distinguishes synchronous renderer.compile
nesting; draw-or-driver elsewhere can include composer warm draws.

The observed timestamp quantum was 0.1 ms; crossing and both standing p95 values were 33.40000000002328 ms,
so cadence passes the explicit resolution rule. Maximum frame interval was 266.7 ms. **Crossing installation
fails this repeat**: Pine departure was 38.9 ms (save 3.0, frame 0.0, leave 35.9). All other synchronous crossing
totals were ≤20.6 ms, entry commits ≤0.2 ms, readiness waits 1.6–3.7 ms and activations ≤5.7 ms. Route load medians
were 29.70, 36.80, 34.53, 23.70, 20.50 and 11.04; timings are under load. Pine world / afterKit still took 52.3 /
18.1 s of awaited wall time, Nalati world up to 28.6 s, and Sky world 46.1 s. The 32.0 ms preceding circuit is kept,
but it does not erase this repeat's failure or establish a robust departure pass.

All owned resources closed. Memory remains G269's phone verdict and the Simulator's honest fallback refusal.
Immutable raw artifact: `attempt-dbef-whole-view-full.json` in the scratch directory above; no raw archive committed.

### Crossroads compilation ruling and task maxima

The coordinator clarified that this is a **zero on-demand draw/driver compilation** gate. Explicit
`renderer.compile` calls in sliced background warm-up are excluded only when each warm-up task stays within
the 50 ms long-task limit. `scripts/sf22-shaders.mjs` encodes that classification, refuses unknown phases or
missing Long Task observation, and keeps raw counts. A reported warm-up task above 50 ms fails. When no such
task is reported, the maximum is **bounded at ≤50 ms**, not measured as zero or as an exact sub-threshold value.
The next harness also records every synchronous warm-up invocation's wall duration separately from task time.

Regrading the immutable `dbef738da` journal: the complete first crossroads vicinity has **232 explicit calls,
zero draw/driver calls, zero unknown calls**. None intersects a reported long task, so the warm-up task maximum
is **≤50 ms** and the crossroads compilation verdict **passes** under this ruling. Across all six in-play routes,
there are 1,820 explicit calls, also with no overlapping long task: maximum **≤50 ms**. A separate **381 ms**
task containing two explicit calls occurred at 4585.1–4966.1 ms, before the first route began at 11913.8 ms;
it remains visible as a boot issue, not an in-play crossroads pass. The unrelated 62 ms crossroads task contains
no warm-up calls. The original literal-zero verdict remains above as the historical recording.

`23ed90be1` also removes the duplicated final resource capture through retiring sibling world/view scopes.
Each delegated owner still runs its own final capture; independently retiring outer roots still capture live
owners that outlast them. Three real-Scope fixtures cover one material visit, late texture discovery and shared
native disposal exactly once. No live departure saving is credited before the next matched repeat. SF22 remains
open on the latest Pine departure **38.9 ms** (leave **35.9 ms**) and any repeat failure; memory remains G269.
