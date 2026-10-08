# SF57 retry — e632fe913, Developer subset

Pinned runtime: `e632fe9132d626335143155841236e8898f66a76`, preview build
`e632fe9-muzs3wpn`. Light observer and coalesced exact-state journal; raw upload
tracing, call-site stacks and extra GPU probes OFF. Same preview is retained for
the five-minute rehearsal and subsequent 30-minute run. Owned fresh Simulator
devices and Safari/Inspector/native sampler lifetimes go through sim-lane.

## Five-minute rehearsal

**Functional PASS**, 316.270 seconds driven (finishes the current fenced leg).
Actual admissions: Pine, Nalati, template-2, Driftwood. Route failures 0, errors
0, GPU loss 0; contemporaneous/journal GL coverage complete, missing GL samples
0, settled calibration passes, unload leak census passes. Raw upload log is
empty as required. The warm-up road tour reached four crossroads before the
duration ended; **zero complete soak laps**, one explicitly partial lap.

| Ruler | MB (decimal) |
| --- | ---: |
| Peak contemporaneous WC + labelled GL | 993.183 |
| Loading overlap WC + labelled GL | 700.239 |
| Initial settled WC + GL baseline | 612.397 |
| Peak game WC interval high, separately | 879.760 |
| Peak labelled GL, separately | 284.230 |
| Peak allocator accounted sum, separately | 710.875 |
| Peak GPU-process footprint in partial lap, separately | 293.915 |

These separate peaks do not occur at one instant and must not be summed. GPU
process footprint is diagnostic and is not added to WC+GL. Simulator native
memory is not a physical-iPhone reading. This run does not establish lap-over-lap
stability or grant cap clearance.

`dry/summary.json` retains exact numbers; `dry/artifacts.json` records SHA-256 and
raw/compressed byte lengths for every preserved worker/native/GL result. Gzip
archives retain all raw data without removing failures. The raw grader's
`refused` list includes deliberately omitted cells: Sky Reach and Signal Dunes
were **not attempted**, rather than observed admission failures. This is the
approved D/P/N/template subset, never a qualifying full-catalogue SF57 proof.

Machine load is sampled every ten seconds in the parent scratch directory for
the combined attempt and will accompany the 30-minute result. A fresh-device
startup load spike reached about 112; its cause has not been established.
The coordinator permitted later desktop floor overlap. Queue waits and load
spikes remain part of the receipt, never an excuse to discard a result.

## Thirty-minute run

Driver launched after the rehearsal cleanup; queued behind a template Simulator
floor. No thirty-minute measurement or result is claimed in this receipt yet.
