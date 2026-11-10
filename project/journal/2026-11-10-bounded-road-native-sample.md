# Retain a bounded native road sample

Hosted run 42780455995 proves build 9f13915-mwaevr3d, engine b16f67b,
epoch one. WebKit's complete journey passes, including the actual Ember
crossing and earned return. Chromium's primary journey, without invasive
profiling, still runs out of its 210-second road allowance: 298.9 m short,
settled, ready, board closed, moving and sprinting. Its final 25.171 seconds
advance 126.06 m and 1,112 raw server ticks (44.18 TPS). This is a moving
deadline miss; removing the profiler does not fix it. Every loading card
and complete native clipboard passes before the road.

The independent fully profiled diagnosis also misses the road (167.8 m
short) and its unchanged 15-second trace-completion cap. The preceding
actual local short sample completed at 79,580,665 bytes / 316,597 events,
while the game completed the same road and earned return. It shows native
compositor/GPU waits; that local run does not qualify a hosted release or
prove the cause of a different runner's slow clock.

Only the independent failure diagnosis now samples the first 15 seconds
of the long road. Its full gameplay journey, 210-second road allowance,
software backend, capture completion deadline and 128 MiB stream limit
remain unchanged. The primary proof remains free of invasive profiling;
explicit full profiling still samples 210 seconds. A failed primary or
diagnosis never qualifies promotion. This change obtains native evidence,
not a runtime repair or a successful release verdict.

Checks: all 19 shell boundary tests, shell admission, API types and three
Chromium keychain checks pass. J206 one-shot review reports no MUST-FIX or
SHOULD findings; the complete game call and refusal propagation are intact.

## Hosted outcome and native boundary

Source `5430d6b060e30db278e6ba8402df9360697ccc9b`, build
`5430d6b-mwafuac2`, engine b16f67b, epoch one: hosted run
[42783939994](https://github.com/Raynos/project-wildshard-singleplayer/actions/runs/42783939994)
has build/stage and the complete WebKit journey green (6m08s). Chromium
still refuses the real long road: primary 282.4 m short, independent
diagnostic 120.4 m short, moving and ready with a closed board. Release is
skipped. Solo production remains d91507e-mw810im4 / epoch one; MMO play is
separately live on a9d2e4f / epoch one. Only public version HTTP reads were
used for that check, with no MMO production socket or agent join.

The bounded native capture now completes, retaining 38,016,805 bytes and
154,082 events. CPU sample duration is 15,297.593 ms; trace setup, stopping
and collection extend the observed native window. Artifact 13749433264,
`release-worker-profile-5430d6b060e30db278e6ba8402df9360697ccc9b`, retains
the trace, exact worker sources, CPU profiles and native port headers.
Its successful capture does not clear either failed gameplay verdict.

In this hosted native sample, 36 renderer-main
`ScheduledActionSendBeginMainFrame` tasks occupy 18,098.749 ms wall time
but 453.283 ms CPU. Their observed span is 20,080.104 ms. A single task
lasts 902.043 ms wall / 29.555 ms CPU. GPU `TryScheduleSequence` tasks
occupy 16,425.337 ms wall / 111.200 ms CPU in aggregate; a single one is
871.799 ms wall / 6.942 ms CPU. The actual context is phone-profile,
402x681, device scale two, Vulkan SwiftShader. This measures native
compositor/GPU waits rather than an established JavaScript hot loop.

The worker's entire native timer callback is 0.368 ms median / 0.952 ms
p95 wall time (0.354 / 0.865 ms CPU), with a 229.418 ms outlier. Timer
wakes are late by 3.494 ms median / 27.554 ms p95 / 263.977 ms maximum;
27 are over 50 ms late. Those findings do not establish a steady 20 ms
whole-server step. The short port sample shows worker-send ticks at
56.947 TPS and own acknowledgements at 51.364 commands/s, including the
inspector start/stop interval; it is not a steady-state clock verdict.

Separately, the previous full 210-second native port capture on 9f13915
records worker-send snapshots at 59.736 TPS but own acknowledgements at
46.923 commands/s. Page-received snapshots average 59.773 TPS over the
whole capture despite distorted short-window rates. Matched worker-send
to page-observer intervals are 731.050 ms median / 4,323.700 ms p95 /
7,905.600 ms maximum; the reverse is 0.100 / 2.500 / 80.300 ms. Cross-realm
time origins limit absolute one-way precision, and the page observer runs
after an existing receiver handler, so these intervals include earlier
handler work as well as dispatch delay. They are not pure transport delay.
The road's apparent 44 TPS is likewise a received-snapshot rate, not an
independent measurement of the worker's clock.

No ServerClock, command budget, prediction ring, input oracle, backend,
render scale or gameplay deadline changed. The next implementation seam
is native renderer/frame pacing: let the page service real input and
acknowledgements while that backend is busy. That graphical work belongs
to Opus under the write rules. A specific renderer remedy and its real
crossing proof remain open; no speculative server-clock fix or successful
release is claimed from these samples.
