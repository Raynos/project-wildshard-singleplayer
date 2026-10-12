# Exact HOVER proof: remove duplicate preview generation

Exact 82b919f09 Linux CI 38202915035 passes. Its boot smoke
38203401909 has a successful boot leg, but HOVER is cancelled at the
12-minute job deadline. All four retained Chromium/WebKit template and
road results pass with zero faults; the last road PASS is at
04:33:02.988 UTC, followed by cancellation at 04:33:03.468. Those
artifacts do not supply a successful exact-SHA smoke on their own.

Setup and checkout take about 101 seconds, the real products/dist build
218 seconds, then two sequential browser drives 408 seconds. No cleanup
hang is established. The old status description incorrectly calls every
cancellation supersession, even when the job ran.

The live 92c179a16 and failed candidate 82b919f09 have identical
runtimeTree content hashes:
4b44743bb3cc92486cac30aa15e0600a871ed7fe23e1f9ca8d071dd93876b80e.
Their HOVER driver bytes are identical. No gameplay regression is
attributed to the candidate's audio-diagnostic slice.

The legacy parity preview command, defined in 42eca06261 and retained
by 1d63030fe7, imports the full Vite build config and starts generation
again for each already-built preview. The existing pure preview module
c0d076a80 already serves builds with production headers and Rapier WASM
compression; the parity server now uses it too, with the same historical
host-module fallback as serve-build. Its owned config is removed on
close or child exit. The actual build and all touch proofs remain.

A real Vite/HTTP fixture whose build config throws fails before the
repair. After it, twelve focused preview/transport/historical-config and
smoke-wiring checks pass in 5.33 seconds. The fixture checks exact built
version/HTML, production cache headers, decompressed WASM bytes and
Brotli/content-type headers without importing the generation config.
Scripts and fixture strict checks, touched typed lint and actionlint
pass. The immutable candidate's actual registered JSON producers match
catalogue hashes; ordinary generation and tooling-path admission pass
in 16.83 seconds, and the final fixture update is checked again in the
same private export. No shared generated output is copied back.

Cancellation still refuses proof, now with an accurate incomplete-job
description. Shellcheck also found an existing masked return value in
release pin export; assigning before exporting preserves failure status.
Exact subsequent macOS smoke and production recovery remain open until
those jobs finish. No timeout, assertion, baseline, witness or hourly
limit changes; no GPU parity success is claimed.
