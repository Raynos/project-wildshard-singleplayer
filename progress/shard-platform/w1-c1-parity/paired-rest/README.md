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
initial Signal capture readiness defect is diagnosed below. No pixel
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

The presentation data path exposes its existing owned tile refresh
handle, as full mode does. The first barrier (`f5561c0ba`) advanced a
variable number of captured frames and pinned only wall time. Although
its four basin/edge controls matched, that did not establish a fixed
simulation clock or pose across all captures.

Two independent source `00451c423` captures now match on all four
phone/desktop basin/edge rows: zero differing pixels, identical draws and
triangles, and equal GPU bytes, programs, shader sources and collider
census. [residency-control.json](residency-control.json) retains the rows.

## Frozen queue and fixed capture frame

CALL: wait for the actual refresh promise with `frameGate` frozen and a
120-second wall-time bound. Never advance gameplay to make I/O finish.
Missing authority, fabricated completion, queue failure, timeout or any
pose/full-clock drift refuses capture; the original gate is restored.

Then respawn the actual pose and run exactly one capture frame with
simulation elapsed and wall time pinned to 10 and clock frame 300.
Finish that frame's actual viewer queue frozen, and record the full clock
snapshot and unrounded player position before the plain render.

Two independent full captures of served source `75e44abb4` match exactly
on all 18 phone/desktop poses, including caravan and edge: zero differing
RGBA bytes, identical raw poses and full clocks, draws, triangles, GPU
bytes, programs, shader sources and collider census.
[frozen-control.json](frozen-control.json) retains every row and the
harness source hashes. The original capture wrapper completed both runs
but its comparator used an unsupported Python `zip(strict)` argument;
the compatible comparator verified those same original raw outputs.

22 focused checks preserve queue, authority, wall-bound and full-clock /
pose refusals. Narrowed strict types and touched typed lint pass. This is
a harness repair: no runtime source, native world law or asset pin changes.
