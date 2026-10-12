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
Exact Linux push CI 38205581726 passes on the defining repair
7250a95cc22c67680260cfb5f2049aa90c54862c. Exact macOS smoke 38205999930
also passes: boot, HOVER and verdict are successful, and the exact-SHA
boot-smoke status is success at 05:10:22 UTC. HOVER starts at 04:59:21
and finishes at 05:10:17: 10 minutes 56 seconds within the unchanged
12-minute limit. Chromium template/road pass at 05:05:51/05:07:37;
WebKit template/road pass at 05:08:22/05:10:01. Their original page-error
and mount/unmount assertions remain intact.

The local cached gate passes in 127.10 seconds; commit-to-origin is
2 minutes 54 seconds. The remote completion qualifies this repair but
is not a controlled speed comparison across runners. The real throwing
generation-config fixture proves duplicate generation is absent from
built preview startup.

The successful smoke follow-up selects this proven repair, then correctly
declines another dispatch: release 38205706682 started only 16 minutes
earlier. Production currently serves the separately proven
5f780a93a-mv4s89ks; shipping the repair waits for the shared hourly slot.
No timeout, assertion, baseline, witness or hourly limit changes;
no GPU parity success is claimed.
