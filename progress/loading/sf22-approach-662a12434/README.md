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
