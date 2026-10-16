# Pine / Driftwood grid-ready witness — 2026-10-16

**Look/travel FAIL for both shards; memory UNKNOWN.** Measured source
`437c479df5c8fba97c136502d847aacd75b48d5e`, build
`437c479-mvb5hoal`. The defining M2 reader accepts the completed plain
Safari road entries as failures. No memory pass is claimed.

Two qualified plain passes per surface cover Pine and Driftwood standing
views, then their independent milestone road entries. Desktop is
1440×900 Chromium/Metal; Safari is portrait iPhone 17 Pro Simulator,
phone tier. Both use the live clock, 2× render scale, muted audio,
Developer, 120 frames/default settle, no profiler or GL observer. This is
Mac-backed Safari evidence, not physical-iPhone performance or memory
clearance. Product index hashes, section hashes, source/validator hashes,
per-window results and raw-receipt hashes are in [receipt.json](receipt.json).

Cells below are median / p95 / worst ms. Median and p95 describe the
worst-p95 window; worst is the maximum across that scope. Previous is the
worst of both [prior milestone passes](../milestone-2026-10-16-follow-up/README.md),
source `4fa84dbe9`. No values are pooled across poses.

Reproduction: serve that SHA with `scripts/serve-build.sh --rev <sha>
--devserver`, then use `scripts/frame-floor.mjs --rev=<sha>
--serve-base=<url> --surface=desktop|sim --devserver --gl-observer=off`
with `--shards=pine-hollow,driftwood-isle` and separately `--shards=grid
--grid-scenario=milestone
--grid-routes=pine-hollow-road-entry,driftwood-isle-road-entry`.
Supply owned scratch/output directories; Simulator also takes browser-lane.

| Surface | Case | Previous worst | Clean pass 1 | Clean pass 2 | Both pass? |
| --- | --- | ---: | ---: | ---: | --- |
| Desktop | Pine standing | 16.7/16.8/16.8 | 33.3/33.4/33.5 | 16.7/16.8/16.8 | FAIL |
| Desktop | Pine road | 16.7/33.3/83.3 | 16.7/16.8/50 | 16.7/16.8/50 | PASS |
| Desktop | Driftwood standing | 16.7/16.8/16.8 | 16.7/16.8/16.8 | 16.7/16.8/16.8 | PASS |
| Desktop | Driftwood road | 16.7/16.8/66.7 | 16.7/16.8/50 | 16.7/33.3/50 | FAIL |
| Safari | Pine standing | 33/34/36 | 33/34/36 | 33/34/43 | PASS |
| Safari | Pine road | 34/91/216 | 33/59/102 | 34/59/101 | FAIL |
| Safari | Driftwood standing | 33/45/51 | 33/45/53 | 33/46/52 | FAIL |
| Safari | Driftwood road | 33/75/164 | 33/63/101 | 33/51/104 | FAIL |

All completed qualified cases reported **zero page errors**. Pine's desktop
standing miss did not repeat. Its desktop road scope passes both times.
Safari travel improved against the older receipt but still misses the
35 ms p95 bar. Driftwood's Safari standing miss also persists. These
unprofiled readings do not identify a first-bad commit or establish a
causal performance gain.

The soak used the floor's DEVSERVER preview. That was a setup error:
`soakCatalogue` intentionally requires the production Developer catalogue
and excludes DEVSERVER-only additions. It refused the extra Nine cell
before driving: **zero circuits, no playing samples, no calibration**.
The boot-only data and clean unload are retained in
[dev-cells.json](dev-cells.json); they cannot establish memory clearance.
The coordinator deferred a production-preview soak plus fresh floor to
the W2-close milestone after the Safari fixes land. The catalogue guard
and all qualification requirements remain unchanged.
The corrected soak uses the ordinary production build from
`scripts/soak/soak.mjs --prepare --rev=<sha> --layouts=dev --legs=cells
--qualifying --out=<owned-scratch>`, not a borrowed DEVSERVER preview.

Quiet windows were owned by sp-x7 and auto-cleaned. Three desktop startup
cohorts were excluded for overlapping in-flight work or an overlapping
retry; two later serial cohorts per scope count. These are not a claim
about an untouched first-cold pass. The coordinator allowed documentation
only light hooks during Safari. Desktop released for the requested
three-minute hook gap before Safari acquired the push lock. All browsers,
Simulator workers and owned previews were closed at release.
