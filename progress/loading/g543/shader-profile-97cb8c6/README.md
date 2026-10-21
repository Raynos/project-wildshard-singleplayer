# Remaining cold loading CPU cost

Exact served build: `97cb8c6723b5b6ebcc7b7b58115a2638bf177be9`.
Muted Chromium, iPhone 16 Pro, CPU 4x, actual 5 x 5 grid. These independently
valid phone cold entries pass byte parity, stage sums and update cadence.
The source batch passed in 432.4 seconds; Simulator acceptance is separate.

| Path | Wall seconds | Node builds | Node build CPU ms |
|---|---:|---:|---:|
| shardfile | 22.3 | 75 | 7254.2 |
| grid | 23.6 | 82 | 4060.8 |

The source maps belong to this exact served dist. The two JSON files retain
raw profile SHA-256, unmapped chunk URLs and the largest sampled self and
inclusive stacks. Inclusive stacks nest: do not add their times together.
Generic material/object names do not prove redundant shader builds.

SHARD SELECT samples 9.109 seconds under precompile and 6.869 under the
node-handler build within it. Grid samples 3.924 seconds under that handler
and 2.754 under road construction. Road clipping and its exact byte preflight
are visible allocation costs. `66b001ff18` skips polygon/attribute allocation
for triangles without an interior bin cut; `f8f5ee9a9d` memoizes preflight LOD
representatives. Their whole-entry benefit is not measured in this baseline.

The row-paint self samples are 334 / 444 ms after `52860bd662`, versus
535 / 633 ms in the earlier build. These sequential shared-machine samples
are not an isolated A/B and establish no particular speedup.

The cold grid remains 23.6 seconds against the approximate 20-second target.
O5/O6 remain open. This evidence neither repeats accepted Safari warm cases
nor conceals the accepted Chromium warm cache-pressure residual.
