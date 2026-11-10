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
