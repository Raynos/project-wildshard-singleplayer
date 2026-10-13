# Paired rest geometry — C1

Source proof: parent `cfea55867`, candidate `13877d32d`.
Sky hover/winch and Signal bucket/rope/oil use retained SDK generators,
named geometry pools and the existing client-scene rows. Native motion,
material loans and collider registration retain their original owners.

Sky passes all 18 poses exactly, including pixels, draws, triangles, GPU
bytes, programs, shader sources and colliders. Signal well/caravan close-up
pixels are exact. Its distant horizon differs in the initial paired run:
[report.json](report.json) retains every pose and draw count.

The same-parent cfea baseline control reproduces this variation: phone
basin 6,971 pixels, draws 41 → 43; edge 6,418 pixels, draws 43 → 45.
[control.json](control.json) retains the two independent baseline runs.
The coordinator's Opus verdict accepts C1 parity on this control; the
Signal capture readiness defect remains an open harness row. No pixel
threshold, comparison or asset pin was weakened.

Checks: 43 focused/native checks, narrowed strict types, touched typed lint,
16 executing authoring-doc checks and ten confined author jobs generated
cold and forced with byte-identical pins. Debt lowers. Generated exports
measure Sky 2350 → 2337 custom lines (−13), Signal 1299 → 1296 (−3).
C1 remains open at 666/363 lines; this is no 100/0 closure claim.

Official maps preserve both rasters. The Signal producer's 88 outputs are
exact except shard.json's map.tilesHash; the root pin is re-recorded only
for that officially captured source key.

## Actual presentation queue barrier

The presentation data path now exposes its existing owned tile refresh
handle, as full mode does. Signal's parity capture awaits refresh at the
actual viewer, drives bounded capture frames until that promise completes,
then pins time and camera. Missing handles, failed reads or frames and
finite-bound exhaustion refuse capture; no idle boolean substitutes for
completion. The Node caller also enforces a 120-second wall-clock bound.

Two independent source `00451c423` captures now match on all four
phone/desktop basin/edge rows: zero differing pixels, identical draws and
triangles, and equal GPU bytes, programs, shader sources and collider
census. [residency-control.json](residency-control.json) retains the rows.
