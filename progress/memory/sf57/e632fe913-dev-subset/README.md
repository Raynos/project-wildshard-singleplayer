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

**Functional PASS; memory RED.** 1,811.547 seconds driven, six complete circuits
plus a partial seventh; 47 route witnesses, all 16 crossroads, actual admissions
D/P/N/template. Errors 0, GPU loss 0, missing GL samples 0; sampling and unload
leak census pass, cleanup error absent. Calibration and recovery fail. The
partial final lap is reported and is never counted complete.

Peak contemporaneous game WC interval-high + labelled GL is **1,235.984 MB**,
**235.984 MB over the 1.0 GB cap**. The loop-2 settled reference is 808.049 MB;
the loop-6 settled value is 1,012.101 MB, a **204.052 MB rise**. Initial settled
baseline is 578.170 MB. Memory neither fits the cap nor establishes recovery.

| Cycle (zero-based) | Complete | WC+GL peak MB | WC+GL trough MB | Over cap MB |
| --- | --- | ---: | ---: | ---: |
| 0 | yes | 990.070 | 486.609 | 0.000 |
| 1 | yes | 1013.754 | 597.471 | 13.754 |
| 2 | yes | 1012.835 | 725.752 | 12.835 |
| 3 | yes | 1060.897 | 789.303 | 60.897 |
| 4 | yes | 1103.356 | 842.897 | 103.356 |
| 5 | yes | 1147.781 | 883.652 | 147.781 |
| 6 | partial | 1235.984 | 929.486 | 235.984 |

Separate per-lap maxima: game WC 945.839 MB, labelled GL 295.058 MB, allocator
710.875 MB (710.237 MB in later laps), GPU-process footprint 571.559 MB.
These are different instants; do not sum them or add the GPU process to WC+GL.
Loading overlap is 676.679 MB. The failed calibration is retained unchanged;
no heuristic phone estimate grants a physical-device or cap clearance.

The first circuit contains the full crossroads warm-up tour, so its duration
and trough differ from later cell-only circuits. Completed-loop drift is graded
symmetrically within 30 MB; partial-loop bounds remain as approved. Raw grader
`refused` entries for Sky Reach and Signal Dunes mean deliberately unattempted
coverage in this prepared subset. Full catalogue, road-only and shipped-layout
SF57 coverage remain open.

`soak/summary.json` preserves exact grades, baselines, component maxima, native
phase summary and runtime identity. `soak/artifacts.json` contains SHA-256 and
raw/archive lengths; lossless XZ archives preserve all 180,474,500 raw bytes
in 1,880,680 bytes, including complete GL/native journals, result, console
output, manifests, ten-second machine-load trace and browser-lane observations.
Every archive was decompressed and its raw hash checked. Raw upload tracing
stayed OFF (empty upload log). Use `xz -dc <archive>` to inspect.

Drive load1 ranged 4.850–44.310, median 23.752 (181 samples). Whole-attempt
load1 peaked 123.459 during startup/queue activity. Desktop floor overlap was
permitted; no load spike is assigned a cause. These measurements are retained,
not used to discard or rebaseline the RED result.

All Safari/Inspector/native sampler lifetimes closed; sim-lane reported 0/1.
Owned preview :4401 was stopped after capture, and the load logger was stopped.
The coordinator received the explicit Simulator release. Next: attribute the
settled growth offline from this raw evidence before requesting any new run.

Offline follow-up: [settled-growth attribution](attribution/README.md) splits the
204.052 MB rise into WC197.150 +labelled GL6.902 MB, identifies PMREM target
accumulation, and states the unmeasured heap/native distinction explicitly.
