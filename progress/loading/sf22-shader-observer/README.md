# SF22 shader observation without a driver query

`observeShaderCompilations` captures shader text at the existing `shaderSource`
call and records only clock times, a source reference, and synchronous explicit
warm-up nesting at `compileShader`. The report parses names, light counts and
flags after the measured interval. It never calls `getShaderSource`, resolves a
program, draws, changes a shader, or excludes an unclassified native call.
Missing source provenance remains `sourceKnown: false` and the call still counts.

The earlier scratch observer queried and parsed source inside every compile.
Those measurements stay in their receipts; this change alone earns no cadence
or shader-gate pass. The 2026-10-10 10:39–10:50 UTC desktop/Safari timing window
on `f78ffca9f6e5972aa6e29daf1bf450e1110dfc37` is discarded for timing credit:
Sky's floor overlapped 10:39:50–10:41:20 UTC and Nine's parity capture has no
exact interval. A complete matched rerun is required, rather than crediting
unconfirmed portions of that window.

Focused tests cover exact native calls/receivers, source replacement, missing
source, nested explicit warm-up, thrown errors, and ownership-safe retirement.
There is no new production code or graph edge.
