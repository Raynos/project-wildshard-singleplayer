# Nalati preparation: outbound frame attribution

**Matched diagnostic complete; plain floor remains pending.** On app pin `1ed327eec`, the template outbound drive with **graph materials ON, Memory saver OFF, build pacing ON** recorded 1,500 frames: p95 **34 ms**, maximum **90 ms**, no game errors or document recovery. These settings match the reported 277 ms case. The diagnostic adds synchronous phase clocks and GL timing, so it earns no plain-floor credit.

Nalati's prepared runtime retirement took **18 ms**. The largest frame overlapped two WASM allocations taking **35 and 31 ms**. Another long interval included **74 ms** in the page origin/update slot, which also advances autosave. These are observed overlaps, not the cause of the historical 277 ms frame. That frame was not reproduced; no isolated saving is claimed.

Quiet window 2026-10-11 **11:55:18–11:57:17 UTC**, one-minute load **5.49**. Simulator, browser lane and quiet marker released. The first graph-on attempt failed its configuration fence before driving; the earlier plain max69ms run used graph-default settings and is not a matched comparison. The permanent-road crossroads preamble is `63231ccbe`, a further difference from the old case.

The next check is one matched **plain** run after the active push exits. Quality, 2× scale and charged ownership are unchanged. All **42 focused checks in four frame/warm-up test files passed**; no builder full suite. Only this compact summary is committed; raw timing stays in the owned scratchpad.
