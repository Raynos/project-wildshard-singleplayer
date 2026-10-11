# Nalati preparation: outbound frame attribution

**Matched plain outbound PASS: p95 34 ms, maximum 93 ms, zero frames over 200 ms.** On app pin `1ed327eec`, the template outbound drive with **graph materials ON, Memory saver OFF, build pacing ON** recorded 1,500 frames, completed actual template residency, and reported no game errors or document recovery. These settings match the reported 277 ms case. That frame is absent in this run; its historical cause is not established.

| Run | Drive p95 / p99 / max ms | Floor credit |
| --- | --- | --- |
| Synchronous phase clocks + GL timing | 34 / 50 / 90 | diagnostic only |
| Plain, no extra timing hooks | **34 / 54 / 93** | **PASS** |

Nalati's prepared runtime retirement took **18 ms**. The largest frame overlapped two WASM allocations taking **35 and 31 ms**. Another long interval included **74 ms** in the page origin/update slot, which also advances autosave. These are observed overlaps, not the cause of the historical 277 ms frame. That frame was not reproduced; no isolated saving is claimed.

Diagnostic quiet window 2026-10-11 **11:55:18–11:57:17 UTC**, one-minute load **5.49**. Plain window **12:23:25–12:25:27 UTC**, load **21.28**, started after the push exited. Simulator, browser lane and quiet marker released. The first graph-on attempt failed its configuration fence before driving; the earlier plain max69ms run used graph-default settings and is not a matched comparison. The permanent-road crossroads preamble is `63231ccbe`, a further difference from the old case. One cold run per mode, not an isolated causal saving.

The next check is the matched cold Nalati approach at shipping road speed. Quality, 2× scale and charged ownership are unchanged. All **42 focused checks in four frame/warm-up test files passed**; no builder full suite. Only this compact summary is committed; raw timing stays in the owned scratchpad.
