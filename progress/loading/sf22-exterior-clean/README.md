# SF22 exterior preparation: uncontaminated matched rerun

Production source pin: `f78ffca9f6e5972aa6e29daf1bf450e1110dfc37`.
Muted phone-tier Chromium and iOS Simulator Safari, 2× render scale, real-input
G270 crossings, 5 Mbit/s shared transfer ceiling and 3/10-second asset stalls.
Quiet window: 2026-10-10 11:13:32–11:25:27 UTC; owned preview and all proof
resources closed. The ENTIRE earlier 10:39–10:50 UTC window was contaminated
by other captures and has **no timing credit**.

## Verdict

Desktop: all six routes complete, zero refusals, crossing install PASS,
cadence p95/p99 **33.4/33.4 ms**. Same-session standing p95 33.4 ms and measured
0.1 ms timestamp quantum satisfy the coordinator's resolution rule; raw numbers
are retained. First crossroads: zero explicit and zero draw/driver shader calls.
Maximum sliced compile invocation **6.9 ms**; long-task observer supports the
unchanged 50 ms warm-up task ceiling. Load median 6.93.

Safari Auto image arm: Driftwood → Signal → Driftwood complete, zero refusals.
Synchronous crossing commits **18/1/10/1 ms**, demanded waits **3/4/5/3 ms**,
entered activations **2/2 ms**: install PASS. Cadence **FAIL: p95 47 / p99 68 ms**.
There are **18 route draw/driver compileShader calls** and 382 explicit warm-ups;
maximum warm-up invocation 6 ms. Safari has no longtask observer, so a total
warm-up-task bound is **unavailable**, not credited as zero. Remaining calls
include environment conversion/convolution before activation. This is an open
cadence/shader result, not a Safari 30 fps claim. Phone memory verdict is G269;
this Auto subset is not the full G270 Simulator gate.

| Safari route | 1-minute load median | Under load (>15) |
| --- | ---: | --- |
| driftwood-to-signal | 15.31 | True |
| signal-to-driftwood | 12.92 | False |

The scalar shader observer caches shaderSource text weakly and parses it only
after measurement; it never calls getShaderSource inside measured tasks.
No instrumentation speedup is credited as a production change.

## Raw provenance (scratch only)

- Desktop JSON SHA-256: `f9a4e20bddf29ff12f9235f8bf5fb6c002002b209a4e7bdde748c5eaa8b0db5d`.
- Safari JSON SHA-256: `a0541b810a93600caf05a411cd2ae75f81aec60d3e7a7b65a9297e1a51feea44`.
- Detached proof: `.git/proofs/20261010T055725-sf22-exterior-clean-matched-2369.json`.

The new offscreen-build port passes three actual-Three PMREM command oracles
(HDR, six-face scene with coloured background, cancellation/refusal). Exact
commands, cameras, uniforms/samplers and renderer restoration are checked;
this is **not yet a GPU pixel or Safari cadence proof**. No production caller
uses the port in this slice.
