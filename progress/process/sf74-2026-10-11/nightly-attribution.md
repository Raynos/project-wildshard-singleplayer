# W12: historical GPU parity attribution, still open

Nightly GPU run 38149690316 compared fd7590693 against mixed historical
baselines. Its seven comparison jobs report real sound, render, save and
pose mismatches; mixed-content warnings alone do not explain the red.
sp-x1 inspected the existing run artifacts and source without capturing,
editing source, changing a baseline or widening a threshold.

| Shard | Baseline | Texture-byte delta | Other GPU-byte delta |
|---|---|---:|---:|
| Template | 8664edaed | +17,360,704 | 0 |
| Sky | 8664edaed | +17,360,704 | buffers +28,560 |
| Nine | 8664edaed | +9,460,864 | 0 |
| Driftwood | 584c24d61 | +7,899,840 | depth +5,266,560; buffers −3,114 |
| Nalati | 8664edaed | +1,048,576 | 0 |
| Pine | 7d731563a | +20,156,960 | buffers −64 |
| Signal | bfb9dc325 | 0 | buffers −2,926,136 |

All seven texture deltas reconcile to 195597049 / G271, which changed
the saver default from on to off. The components are bloom luminance
7,899,840 bytes, composer depth 5,266,560, 1024 shadow color 4,194,304,
Nalati's 512 shadow 1,048,576 and Pine's two duplicated ASTC mip textures
2,796,256. Signal's old baseline already had the saver off. This is
source attribution of existing measurements, not a new current-pin GPU
proof or acceptance of the residual buffer, pose and gameplay changes.

Template's extra mesh/program and 0.94676 pose SSIM are attributed to
80299e0bf's lit lantern band and portrait keepInFrame. Six changed
program hashes follow f9fe9e81e's receiver-plane PCF, which Jake picked
NEW in c71039878; Driftwood's unchanged tent hash is a control. Existing
[labeled census](../../shard-platform/parity-triage/census-diff.txt)
retains the before/after allocation evidence.

sp-x5's source inspection identifies a separate harness mismatch:
2beae6f27 / G325 intentionally waits for a first user gesture, while
the parity runner performs its scripted walk before the phone touch.
Nine's rock fallback and missing lantern hum, and Driftwood's missing
walk ambience, follow the locked graph. Template's missing pad/bell/
bass/drum events are silent chunk-sting internals rather than missing
score content. Muting output does not initialize that graph.

Nine's post-touch metal fallback, Pine's drum and Driftwood's combat
scheduler window remain unresolved. Sky buffers/poses, Signal tiles,
Driftwood ramps, Pine entry removals and Nine minimap/disposal retain
their separate historical rows. No later SF29 source is blamed by this
old run, and no blanket baseline acceptance follows.

The next ordinary parity failure needs bounded readiness, actual child
scope/bank and scheduler chronology observations. Mixer sample lists
are not Nine's CueBank, parent scope status does not prove child scope
status, and inspection must not construct audio graphs or draw RNG.
Push CI and exact boot smoke on 92c179a167 are green; this older GPU
parity run remains red and holds no release under newest-ci-green.

The harness diagnostic follow-up copies existing readiness, mixer key
counts, music state, parent scope counts, clock, named RNG state and
the last 16 audio-log entries at boot and walk/combat boundaries. It
does not unlock, play a sample, drain sound counters, create streams or
read getters that build graphs. Its sidecar stays outside raw/compared
baseline fields, retains at most two runs and four boundaries, and
refuses output beyond 64 KiB. It is emitted only for a final red and
removed after a green. Unsupported historical reads produce a bounded
unavailable note, preserving the original comparison verdict.

The diagnostic explicitly cannot observe CueBank, exact child scope,
AudioContext running state, scheduler due times, Math.random or Pine's
local RNG. Those remain further evidence requirements. Pure fixtures
prove serialized-page execution, forbidden getter/RNG/counter access,
bounded copies and output, unchanged report values and green cleanup.
No new browser capture or GPU-green claim accompanies this slice.

Validation: the diagnostic and existing probe-adapter suites pass all
five tests in 1.50 seconds. Scripts strict checking, the fixture's strict
checking and touched type-aware lint pass. The immutable candidate
export also passes ordinary generation and the tooling path check;
its missing author JSON is produced by the registered jobs and matches
the catalogue's pinned SHA256 bytes. No shared generated file is copied
back or committed.

Further read-only owner attribution preserves the historical pins above:

| Shard / field | Proven source | Remaining limit |
|---|---|---|
| Nalati save/profile read and loot/profile write keys | 28fe9f479 declarations, a4ffb1c2d bindings, 70e2a5094 Progress | Key presence does not prove a grant-count change |
| Nalati mesh 307 → 308 | 195597049 eagerly materializes the existing kurgan interior | No new geometry recipe or parity acceptance |
| Signal sunscar.ray system | 0f30825c9 separates held-ray assignment | No extra behavior inferred from a system name |
| Signal terrain and pose heights | 8cce2181c / G266 compiled tile ground; historical feet max 6.4 cm | Exact aggregate triangles/calls/SSIM remain open |
| Driftwood director system | 99ecc7bcd and 256a71405 | The pose/walk residual is separate |
| Sky registry 55 → 56, colliders 1,216 → 1,256 | 2a432fe486 adds far.islet.rails, forty wood cuboids | All other registry rows and body counts are identical |
| Sky mesh −5, instanced +45, instances +90 | Allocation table below | Draw and GPU-byte ownership are separate |
| Sky hover +480 triangles | Forty twelve-triangle rail boxes, frustum culling disabled | Spawn's extra 828 and both poses' −1 calls remain open |
| Sky shallow named census | 20882ab8c / G321 reparents existing dressing | Unchanged depth-one cutoff does not prove removed geometry |

Sky's representation sums reconcile exactly:

| Source | Mesh delta | Instanced delta | Instance delta |
|---|---:|---:|---:|
| Winch house 8942c04ec | −1 | +13 | +14 |
| Roost 3df45db44 | −2 | +5 | +7 |
| 124b14522 crown | 0 | +5 | +5 |
| 124b14522 mill | −3 | +15 | +18 |
| 124b14522 two book stands | 0 | +4 | +4 |
| 124b14522 knolls | 0 | +2 | +2 |
| Rails 2a432fe486 | +1 | +1 | +40 |
| Total | −5 | +45 | +90 |

Sky's full buffer increase of 28,560 bytes remains open: the rail source
accounts for 3,400 bytes, while other bake matrices and index formats
are identifiable mechanisms without a complete allocation journal.
Both retained runs repeat the same counts. The model catalogue remains
10/0, and bodies remain fixed 4, kinematic 4, dynamic 0.

Signal's mesh 391 → 260, instanced 17 → 25 and instances 123 → 247
have proven tower, rocks, dressing, places and tile contributors, but
the artifacts contain no exact per-draw allocation oracle. Driftwood's
three poses each lose 24 triangles with unchanged calls; its pier walk
ends 3 mm east and 8 mm south of the old endpoint. Flared-ramp/contact
commits 00196a4c2 and 794c4e128 are candidates, not isolated culprits.
Those residuals require draw/contact traces and stay open without a
capture, threshold change or baseline acceptance.
