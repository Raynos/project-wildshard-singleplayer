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
