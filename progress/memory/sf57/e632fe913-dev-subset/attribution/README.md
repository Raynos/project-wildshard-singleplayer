# SF57 e632 — offline attribution of the settled growth

Source receipt: `16e2dde36472499804f336f6134cda411cd80a22`.
No new browser, Simulator, build or native sample was taken for this analysis.
Reproduce with `python3 progress/memory/sf57/e632fe913-dev-subset/attribution/analyse.py`.
It reads the committed lossless raw archives and writes `attribution.json`.
The original grader's seven settled medians reproduce **byte for byte**; the
per-leg partition telescopes exactly to each component's loop-2→6 change.

## What grows

**197.150 MB of the 204.052 MB rise is WebContent; 6.902 MB is labelled GL.**
The same Driftwood settled pose has the same 39 allocator claims, category/owner
sums, 488.478 MB accounted total and 70.713 MB observed WASM capacity throughout
loops 2–6. The 710 MB figure is the separate interior peak, not the settled sum.

| Settled cycle | WC MB | Labelled GL MB | WC+GL MB | GPU process MB, separate |
| --- | ---: | ---: | ---: | ---: |
| 2 | 616.830 | 191.219 | 808.049 | 344.460 |
| 3 | 679.827 | 189.448 | 869.275 | 395.103 |
| 4 | 730.225 | 194.667 | 924.892 | 442.912 |
| 5 | 770.300 | 192.900 | 963.200 | 488.312 |
| 6 | 813.980 | 198.121 | 1012.101 | 533.761 |

The independent GPU-process median rises 189.301 MB. It is never added to the
WC+GL ruler, and the similarity to the WebContent rise does not prove the same
allocation is charged in both processes. The recorded capture contains neither
JS heap snapshots/heap sizes nor `__wildshard.memory()` / SF64 CPU-owner snapshots
nor native WebContent VM categories. It therefore **cannot split the 197.150 MB
into JS heap versus other native backing, or identify a JS cache/audio/save owner**.
The raw route claims are allocation-model evidence, not a heap census. Unchanged
WASM capacity likewise cannot establish unchanged JS or native memory.

## Trend

WC+GL successive rises are 61.225, 55.617, 38.308 and 48.901 MB. A five-point
least-squares line fits 50.203 MB/circuit (R² 0.9931); WebContent alone fits
48.477 MB/circuit (R² 0.9916). Independent GPU-process footprint fits
47.181 MB/circuit (R² 0.9994). These are descriptive fits on five settled points,
not an extrapolation or a causal model. The last two circuits still add 38–49 MB:
**there is no observed plateau in this run**. It is accumulating retention over
the measured interval; the evidence cannot prove it would grow forever.

## Which crossings

The exact GL labels account for 6.881 MB (99.7% of the GL rise):

| Label / owner | Change, cycle 2→6 | Live allocation count change |
| --- | ---: | ---: |
| PMREM.cubeUv/color/Texture / engine/render-target | +5,505,024 B | +8 textures |
| PMREM.cubeUv/Depthbuffer / engine/render-target | +1,376,256 B | +4 renderbuffers |

They are 336×256 RGBA half-float colour storage (688,128 B each) and 16-bit depth
(344,064 B each), approximately **1,720,320 B per circuit**. Raw handle histories
show newly retained targets born both on **Driftwood→Pine** and
**template→Driftwood**. This is page-lifetime accumulation of live API allocations,
not a peak inferred from a model. All were gone at final page teardown, so the
zero unload census does not establish that a long-lived grid stays stable.
`newPmremStillLiveAt6` and `pmremLiveAtSettled` preserve the exact identities,
creation times and crossings; transient Pine PMREM allocations are also retained
in the history rather than silently counted as leaks.

This is a renderer/target-lifetime finding and has been sent to the coordinator
for Opus. No renderer or texture source was changed. The raw-OFF protocol omitted
call-site stacks: these labels alone cannot distinguish `skyBackdrop.setupHDRI`
from Three's internal PMREM cache, so that exact creator remains a source-audit
question for the renderer owner.

For the larger native rise, temporal partitioning over complete circuits 2–5 is:

| Interval | Mean WC change MB/circuit | Mean labelled GL change MB/circuit | Mean GPU-process change MB/circuit, separate |
| --- | ---: | ---: | ---: |
| driftwood-isle-to-pine-hollow | +70.386 | +51.381 | -36.803 |
| pine-hollow-to-nalati-grasslands | -25.690 | +44.462 | +71.119 |
| nalati-grasslands-to-template-2 | -0.160 | -179.195 | -65.298 |
| template-2-to-driftwood-isle | +5.607 | +85.077 | +78.385 |
| return-home-to-settled-window | -0.856 | +0.000 | -0.078 |

These are **timing partitions, not retained-owner attribution**. They compare
consecutive different content states (e.g. Pine's larger world, Nalati, the small
template); allocation and release both happen within a leg. Endpoints are upper
medians of actual samples from the last five seconds of each recorded route;
settled endpoints use the original ten-second grader windows. No interpolation,
join widening, forced GC or inferred allocator values are used. GL joins retain
the original 1.5-second limit. `endpoints` and `legPartitions` expose every window,
count and component value. Large positive/negative content swaps cancel over a
whole circuit; **the +70 MB WC interval at Driftwood→Pine does not prove a Pine
leak**, especially while GPU-process footprint falls in that same interval.

Same-pose native growth is visible at multiple destinations: cycle-2→5 endpoints
Nalati WC 678.254→807.558 MB, template WC 674.977→808.704 MB, Driftwood WC
680.695→814.881 MB. Thus the growth survives regional unloads and reaches the
small template, rather than existing only while Pine is entered. The larger WC
cause cannot honestly be assigned to a single leg from this capture.

## Next discrimination, requiring a new-run approval

First route the proven PMREM lifetime issue to Opus. To distinguish the remaining
native growth, a focused matched-circuit diagnostic would need same-pose SF64
`memory()` owner snapshots, WebKit JS heap measurements, program/cache counts and
native WebContent VM categories at two or more settled boundaries. Heap capture
must happen outside measured travel; no cap/performance claim from that probe.
The coordinator's approval is required before any new run; none has been started.
There is no evidenced JS retention fix to make from these raw data alone.
