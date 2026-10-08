# SF57 post-SF69 attribution — incomplete diagnostic

**FAILED / incomplete.** Two of the requested four circuits completed; all eight
owned route witnesses passed. The Inspector closed during `Heap.snapshot` after
circuit 2. No heap payload was saved. Later cleanup RPCs timed out, so the main
result JSON did not receive its final counter/window/grade flush. It says
`circuits: 1`; the eight complete witnesses and boundary-2 home fence establish
two complete circuits. This receipt does not turn that stale JSON into a pass.

Runtime: `2fccee5ba2d50ca53ce298f313781045bf8f31b9`, the coordinator's selected
post-SF69 origin pin. Driver: the same revision, including `2025b98f1` and
`6d3165ebb`. Fresh owned iPhone Simulator Safari, Developer ON, phone tier,
2× render scale, muted. Route: Driftwood → Pine → Nalati → template-2 → Driftwood.
Light c132 observer/coalesced exact GL journal, raw tracing and call-site stacks
OFF. No second Inspector connection or extra GPU probes. Heap requests occur only
outside travel; `__wildshard.memory()`, program counts, native VM reads and passive
WebKit category readings precede them. The PMREM fix `5d5769036` is included;
the place.ts record/culler lifetime fix is absent.

All numbers below use decimal MB. GPU-process memory is independent and is never
added to WebContent + labelled GL. SF64 allocations, native categories and passive
WebKit categories overlap the native footprint; they are not additional totals.

| Boundary | Pre-inspection WC | Live GL | WC + GL | SF64 RAM | Programs | `footprint` during inspection |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 464.605 | 176.644 | 641.249 | 196.036 | 151 | 855.281 |
| 1 | 890.917 | 184.223 | 1,075.140 | 355.382 | 314 | 1,102.189 |
| 2 | 1,213.699 | 186.058 | 1,399.757 | 531.403 | 320 | 1,410.651 |

The pre-inspection columns use the upper median of the **last ten actual joined
observations** in baseline-0 / settle-1 / settle-2, with the unchanged 1.5-second
actual-census fence. They are explicitly distinct from the original grader's
recorded windows: only windows 0 and 1 survived the main JSON checkpoint. Window 2
is not reconstructed from approximate phase timing. Accounted memory in the
settle-1 and settle-2 tails was unchanged at 492.353 MB; independent GPU-process
medians were 283.725 and 340.446 MB.

## What the surviving data supports

SF64 RAM increased **176,021,776 B** from boundary 1 to boundary 2, while labelled
GL increased **1,835,652 B**. Renderer geometry count stayed **251 → 251**;
renderer texture count changed 98 → 103 and shader programs 314 → 320.
The RAM delta reconciles exactly to the following source categories:

| SF64 RAM kind | Increase (MB) |
| --- | ---: |
| Array buffers | 127.251 |
| Image bitmaps | 35.652 |
| Canvases | 7.877 |
| Images | 5.243 |

The largest owner/kind groups include engine/scene array buffers (+44.650 MB),
Nalati world array buffers (+21.913 MB) and image bitmaps (+17.826 MB), Driftwood
world array buffers (+14.608 MB), loadRigFile image bitmaps (+9.437 MB), Pine world
array buffers (+8.933 MB), Pine crag buffers (+6.003 MB), and forest buffers
(+3.940 MB). Concrete assets include Nalati outcrop positions, Driftwood palm /
boulder / hibiscus positions and ground-cover matrices, Pine trophy-chalk canvas,
Nalati sign and camp-person canvases. Full per-asset deltas and allocation counts
are in [summary.json](summary.json); their RAM and GPU sums reconcile exactly.

This is a **CPU-source retention candidate**, useful to the place-lifetime lane.
It is not proof that those weak-labelled objects have strong retaining paths:
the readings precede any successful heap snapshot/collection. Nor does it prove
that every added source is owned by place.ts.

Native `footprint` dirty categories from boundary 1 → 2 grew by 157.336 MB in
WebKit malloc and 126.173 MB in JS VM Gigacage, with JIT +1.638 MB. Passive WebKit
`javascript` estimates rose 889.333 → 1,250.614 MB; these estimates can include
external payload and are **not** a captured live JS heap. All six categories,
unsupported/error records and raw VM reports are retained. The `vmmap` corpse
summary is not substituted for the fixed live-PID footprint ruler.

## Observer effect and failure

Inspection phases materially alter the observed WebContent footprint. Native
phase summaries report sampled WC maxima 477 / 893 / 1,217 MB before the three
inspections; diagnostic phases 0 / 1 reached 856 / 1,102 MB. During diagnostic-2,
which includes the failed heap request, sampled WC peaked at 1,910 MB and the
interval high reached 2,139 MB. These are intrusive diagnostic samples, not a new
production cap result. The timings associate the steps with inspection; they do
not isolate which inspection operation caused each step.

The error retained by the driver is `Error: Inspector closed`; then
`Heap.disable` and `Runtime.evaluate` timed out. The transport did not retain its
close code/reason. Its 512 MiB payload ceiling is a candidate explanation, **not
a diagnosed cause**. Fixed game WebContent PID 85210 remained in native samples
through cleanup. No new local `.ips` was found in the run interval, and the only
native disappearance events were pre-measurement loading processes. That does
not establish GPU health or explain the connection loss.

This incomplete, inspected run cannot establish a four-circuit slope/plateau,
partition the original e632 +197 MB WebContent increase, or causally isolate SF69.
It also includes PMREM and other changes since e632. There is no duration, cap,
performance, full-catalogue or physical-iPhone clearance. No renderer/look change
or speculative retention fix was made. No retry started.

## Evidence and cleanup

- [analyse.py](analyse.py) reproduces [summary.json](summary.json) from archived
  actual observations; repeated execution produced identical summary bytes.
- [artifacts.json](artifacts.json) records every raw/stored byte count and SHA-256.
  All 23 artifacts round-trip exactly: 74,643,077 B raw → 1,033,907 B stored.
- [raw/protocol.json](raw/protocol.json), [raw/preview-proof.json](raw/preview-proof.json)
  and [raw/run.log](raw/run.log) preserve the pin, HTTP/disk identity and failure.
- [cleanup.json](cleanup.json): owned Safari, Inspector, proxy and sampler closed,
  Simulator 0/1; fresh owned device shut down and deleted, owned :4400 stopped.
  [crash-report-scan.json](crash-report-scan.json) records the bounded local scan.

Run `python3 progress/memory/sf57/2fccee5ba-four-circuit/analyse.py` to reproduce.
The next measurement requires coordinator routing; the Simulator is shared.
