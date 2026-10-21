# G543 Simulator loading calibration

Measured on the iPhone 16 Pro Simulator `wildshard-loading` (iOS 27),
through `scripts/sim-lane.sh`; native CPU, portrait phone tier, muted.
The served build is `8042d30ab3497069af298350ce1c63bb0be68e5b`.

These receipts supply exclusive stage milliseconds for the application timing
table. SHARD SELECT uses the mean of two runs; the grid uses one run.
Gaps remain in the receipts and are excluded from semantic stage weights.
Missing stages have zero measured time; the weighting code keeps a one-ms floor.

**These are calibration receipts, not passing accuracy acceptance.** The old
build misses service-worker background network bytes and uses MiB under an MB
label. Grid cadence also fails. Later source cuts address those failures;
L8 still requires both paths on Chromium and Simulator to pass on their served
committed build. The renderer's GLTF decode slot and memory caps are unchanged.
