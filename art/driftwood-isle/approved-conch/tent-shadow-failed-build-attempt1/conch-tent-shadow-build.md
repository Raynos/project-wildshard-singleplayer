# Conch first-use tent diagnostic: build closure

Status: adapter prepared, not built or captured. Root review and a new explicit root pin are required. No engine, schema, material source, old host, old pin or prepared fixture was changed. The source-only receipt remains immutable and does not cover the new adapter.

## Fixed inputs and outputs

`tent-shadow-diagnostic/build.mjs` builds the two reviewed fixed HTML entries together, with a shared asset bundle, into `tmp/conch-tent-shadow-dist-attempt1`. The fixed public entries are `control.html` and `tent.html`; each runs in a separate fresh browser context. The original native product is reused byte-for-byte from the strictly verified immutable color-view product. The old app is never rebuilt or modified. Native admission, old product receipts and old host inventory are checked before pinning, before and after build, and before and after capture.

The new pin path is `tmp/conch-tent-shadow-attempt1/reviewed-build-pin.json`. Creation is exclusive and never part of build. Its closure includes the conservative prepared source inventory, every new diagnostic source/test, both review documents, all installed dependency file bytes and symbolic-link destinations reachable from node_modules/workspace links, the actual Node executable hash/version, installed Chrome bundle bytes, original native product bytes and old host identity. Dependency symlinks outside this repository fail closed. New/removed files invalidate the closure as well as changed bytes. No package installation or dependency repair occurs.

The Vite adapter retains the existing rapier aliases/plugin, exact static product validator receipt, existing generated table functions and exact asset bytes. Only the previously reviewed fixed entry/prepare wrappers differ from the ordinary host. Original source paths resolve as their originals did. No module replacement, global shadow patch, cache reset or mutable variant selector is added. Both outputs use identical build settings and common public frozen-rest controls. PCF versus the imported tent filter is the only rendering intervention.

The output directory must not exist. The adapter never cleans or overwrites a previous host. A complete exact generated-file receipt binds both entries and every asset to the new pin. The fixed capture directory must also not exist. Budget checks cover the new host, pin, preserved source receipt and all new evidence, capped at 80 MiB. Existing dependencies and immutable reference product are read-only inputs, not copied into evidence.

## Execution and limits

Root command after independently reviewing the final adapter and this document:

    node art/driftwood-isle/approved-conch/tent-shadow-diagnostic/build.mjs --pin-reviewed "ROOT GO: bounded first-use tent diagnostic; reviewed adapter and manifest"

Then one heavy-lane build:

    WS_HEAVY_ROOT="$PWD/tmp/dot-audit/heavy-lanes" python3 scripts/heavy-lane.py build -- node art/driftwood-isle/approved-conch/tent-shadow-diagnostic/build.mjs --build

Then capture through the browser lane using the installed muted cloud Chromium, iPhone 16 Pro portrait emulation:

    HOME="$PWD/tmp/dot-audit" PATH="$PWD/tmp/dot-audit/bin:$PATH" bash scripts/browser-lane.sh --max 20 node art/driftwood-isle/approved-conch/tent-shadow-diagnostic/capture.mjs

The capture runner verifies strict cross-context equality of all geometry/setup and actual nine-view semantic controls, preserves actual generated fragments with SHA-256 references, requires linked native draws and PCF/tent arithmetic signatures, requires byte-identical repeated rest captures, records real wall timestamps without mocking clocks, and checks visible candidate pixels. It does not tune a failed rig or repair a failed first-use guard. It records partial failures and closes owned browser/server resources.

A completed mechanical capture is still inconclusive until independent visual inspection confirms that the new PCF control reproduces the qualitative stippling. The report explicitly leaves this pending; generated shader proof alone cannot establish reproduction. There is no claim of exact old-host zero-clock parity. Radius 2 retains the approved sixteen-tap tent versus five-tap PCF diagnostic difference. No phone performance, animation, gameplay, shipping or visual-quality acceptance follows.

## Focused checks

The original 13 source/native-admission tests and three new dependency/output guard tests pass (16 total). Node syntax checks pass. The source-only closure check passes. The original prebuild receipt remains SHA-256 `4701dead4a40f37dc10dda822eb4865ab9b86dd41b7f6184066fb338ef6dc8f5`. No full suite, build or browser capture has run. The existing Linux lockf compatibility shim is read and hashed in the closure; no lane script is changed.
