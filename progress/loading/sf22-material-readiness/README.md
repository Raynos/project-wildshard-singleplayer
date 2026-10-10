# SF22: prepare asynchronous material samplers before entry

The dab8f21 source-mapped diagnostic identified Signal's late first-draw upload
by exact ImageBitmap identity: `sunscar.fire.book`, ShaderMaterial `uBook`,
2048 × 2048, 34.7 ms. Uniform collection already worked; the fire effect launched
its fetch without putting it on any preparation barrier. It published after the
sampler scan, so the first visible draw performed the upload.

The renderer now awaits registered pending material resources before compiling
borrowed jobs. The generic weak registry starts no fetch, allocates no texture,
and drops settled work. The shared fire effect registers its existing fetch/decode
promise. Its failed fetch still selects the procedural flame, and its existing
generation fence prevents a retired load from publishing. Shader preparation's
owner fence applies again after the wait. The ordinary upload pass then discovers
the exact sampler. Pixels, shader source, flipbook timing and sampler settings are
unchanged; no shard source, collider, map or witness payload is changed.

Focused checks cover delayed publication before compile/upload, unchanged Signal
shader sources and samplers, procedural failure fallback, successful decode after
retirement, owner cancellation, and resources registered during an earlier wait.
Existing injected-texture preparation and Signal shader-row fixtures also pass.
Touched typed lint and strict checking against committed public package exports
pass. Game → engine +1 (`render/materialPreparation`); no upward import or look
change. Browser re-measurement remains open; this is a scheduling fix, not yet a
new crossing-time verdict. See the road-cull receipt for the exact diagnostic build
and remaining boot owners.

The e0ce4c3 re-measurement used build `e0ce4c3-mv23s87c` (2026-10-10
07:59:17.453Z), Chromium Metal phone tier at 2×, muted, Developer and Memory saver
off, the same six G270 routes at 5 Mbit/s with 3/10 s stalls. All 12 transitions
completed with zero refusals or errors. Activation: Pine 3.6 ms, Nalati 5.4 ms,
Sky 1.3 ms, Signal 1.0 ms, Driftwood 1.3 ms. One-minute load ranged 13.14–37.74.
This owner-instrumented run is diagnostic; its cadence is not a normative floor.

Exact ImageBitmap identity now places `sunscar.fire.book` in `initTexture` inside
precompile, without a live draw owner: 409662.9–409717.2 ms, **54.3 ms**, ending
1022 ms before activation. No fire-book upload occurs on the first visible draw.
The scheduling fix works; the single native upload still exceeds the 50 ms loading
task budget. The enclosed observed task was 54 ms. The compile-only gate reports
1556 explicit calls (maximum individual call 11 ms), zero draw/driver/unclassified
compiles; it excludes upload tasks and therefore is not a universal warm-task pass.

The initial boot's remaining 394 ms first-live task resolves 31 native programs.
Warm and live keys have the same one point light, but the warm key lacks the home
PMREM which the first layered frame applies. That initial presentation ordering is
the next slice. Audio/fingerprint work and the 54.3 ms native upload remain open.
Raw evidence stays in scratch; SHA-256
`42bc56964b9d9358202a40d5caf746efab120008c6cf50ddd43e1616fb3ffab7`.
