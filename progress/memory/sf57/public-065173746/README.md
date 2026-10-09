# SF57 qualifying shipped-layout soak — 065173746

**Recorded verdict: both cells and road PASS. SF57 shipped-layout gate passes on its own recorded verdict.** One invocation, two thirty-minute legs, current pushed pin06517374684aa0d7917ea04b27b70fc7d9ca59ae; it carries native-byte checkpoint capture95ea6414d and input-manifest forward065173746. Developer OFF, full shipped catalogue, light observer/raw OFF, footprint-only one-second sampler. No heap snapshots, per-pose vmmap, forced GC, manual eviction or measurement-document reload. Build through heavy-lane; each leg through sim-lane. Coordinator GO recorded in the run; other browsers/Simulator were held while serialized full suites continued.

| Leg | Recorded gate | Drive seconds | Completed circuits | Playing WC+GL peak MB | Loading peak MB | Max sample gap s | Native load min / max / mean |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| cells | PASS | 1805.058 | 4 | 800.567 | 914.464 | 1.03 | 5.09 / 179.04 / 33.89 |
| road | PASS | 1804.432 | 3 | 809.116 | 954.962 | 1.16 | 6.66 / 78.80 / 30.01 |

Decimal MB. Playing uses the fixed game WebContent PID interval-high plus labelled live GL; loading conservatively includes overlapping WebContent processes. GPU-process footprint stays separate and is never added. Raw recorded grades, per-lap WC/GL/allocator/GPU maxima, exact settled-window splits and raw journals are archived; `splits.json` copies the recorded grade without rerunning it. Independent component maxima need not occur at the same instant. Simulator memory is measured here; the tool's phoneEstimate is an estimate, not a physical-phone reading.

## Rule (b), recovery and control spread

The historical before-only crossing controls span489–498 MB settled /531–605 MB peak. Including the current-parent control: settled medians489–538 MB / peaks531–640 MB. The earlier559 MB figure was a phase maximum, not a settled median. That broad native spread means the single native-byte matched pair is not a stable saving estimate. It showed boxed byteArray sampled allocation22,591,036 B to0, byte-identical saves, no retained workspace, and the after within the before spread; source proof is `../checkpoint-native-bytes-2026-10-09/README.md`.

The tables below show the actual soak windows and loop extrema. Completed loops compare symmetrically within30 MB against loop two; the final partial loop is reported but not counted complete. This is the recorded grader policy, unchanged. No inference from the crossing pair substitutes for this soak's verdict.

### cells

Functional=True, sampling=True, recovery=True, calibration=True, cleanup=True; errors=0, losses=0, refused=[], crossroads=16.

| Settled after circuit | Samples | WC median MB | GL median MB | Combined median MB | Accounted median MB |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 | 13 | 511.742 | 242.963 | 754.704 | 433.263 |
| 1 | 10 | 516.722 | 245.341 | 762.064 | 433.764 |
| 2 | 10 | 521.048 | 245.341 | 766.389 | 433.764 |
| 3 | 10 | 523.981 | 245.341 | 769.322 | 433.764 |
| 4 | 10 | 527.012 | 245.341 | 772.353 | 433.764 |

After circuits2 to4: combined settled change5.964 MB across2 circuits (2.982 MB/circuit).

| Loop (one-based) | Complete | WC+GL peak MB | WC+GL trough MB |
| --- | --- | ---: | ---: |
| 1 | True | 792.064 | 750.947 |
| 2 | True | 786.849 | 761.631 |
| 3 | True | 779.985 | 766.136 |
| 4 | True | 800.567 | 769.233 |
| 5 | False | 781.426 | 772.215 |

### road

Functional=True, sampling=True, recovery=True, calibration=True, cleanup=True; errors=0, losses=0, refused=[], crossroads=16.

| Settled after circuit | Samples | WC median MB | GL median MB | Combined median MB | Accounted median MB |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 | 10 | 514.216 | 242.963 | 757.179 | 433.263 |
| 1 | 10 | 509.284 | 242.716 | 752.000 | 418.344 |
| 2 | 10 | 509.087 | 242.716 | 751.803 | 418.344 |
| 3 | 10 | 509.432 | 242.716 | 752.147 | 418.344 |

After circuits2 to3: combined settled change0.344 MB across1 circuits (0.344 MB/circuit).

| Loop (one-based) | Complete | WC+GL peak MB | WC+GL trough MB |
| --- | --- | ---: | ---: |
| 1 | True | 809.116 | 750.582 |
| 2 | True | 764.711 | 750.163 |
| 3 | True | 765.211 | 750.547 |
| 4 | False | 762.207 | 750.842 |

Machine one-minute load throughout preparation and both legs: min5.09, max206.45, mean35.53; ten-second raw rows retained. Native per-leg loads appear above. Complete raw archives and their SHA-256 hashes are listed in archives.json. Parent stops its own preview; native/proxy/Inspector/Safari closed and owned Simulator shut down before release. No rendering or look changes.
