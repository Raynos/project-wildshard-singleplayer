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

The native creature fall reached y = −622.6604614257812. Its logical checkpoint incorrectly used the horizontal
±250 m chunk bound for height as well. The forward matches `AnimalSim.restore`: finite vertical positions,
unchanged bounded horizontal positions and unchanged identity, health, quota and durable-write checks. A real
eight-second `AnimalSim` WORLD fall is checkpointed and restored exactly; non-finite heights still refuse without
replacing the previous save. The world/fall law is unchanged. This is the existing logical HP/pose continuation,
not a claim of full creature-physics continuation.

Departure commits still measured 45.1 ms for Pine and 123.1 ms for the template. Entry commits measured
0.2 / 0.1 / 0.0 / 0.1 ms and entered activations 3.7 / 4.8 / n/a / 1.5 ms. The run did not contain the subsequent
checkpoint/frame/disposal timing boundaries (`7e1f3d40b`), so these departure owners still require attribution.
The earlier Pine first-entry 439 ms long task contained 26 `compileShader` calls after its activation: approach
warm-up did not cover all first-drawn program variants. That remains open alongside the long world/afterKit waits.
No complete SF22 timing or memory pass is claimed.
