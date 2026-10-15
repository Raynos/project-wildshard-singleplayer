# Driftwood after the loop-window and paired AAC cuts

Exact served commit `ef70dd7ff9a09b6bdec26bf666c8154eb15abe3a`.
Same G258 protocol as the previous calibration: three fresh iPhone 17 Pro
Simulator Safari processes, cold road recovery before the first Driftwood
admission, ordinary held hover input to entry and centre. Developer on,
Memory saver off, images, 2x render scale, muted. Each pose uses the median
of three fresh kernel WebContent samples from one PID plus reconciled GL
storage, including unlabelled bytes. GPU-process RSS is not added. No heap
census or GC precedes a physical reading. All runs have zero page errors.

| Run | Road WC + GL, MB | Entry WC + GL, MB | Centre WC + GL, MB | Largest raw claim, MB |
| --- | ---: | ---: | ---: | ---: |
| 1 | 442.731048 | 744.616016 | 757.759268 | 283.809208 |
| 2 | 449.284624 | 719.679640 | 732.757332 | 255.380819 |
| 3 | 466.373088 | 738.352528 | 749.906508 | 255.435514 |

Keep the largest paired increment: run 1 centre, 315,028,220 B, divided by
the unchanged 1.11 calibration once and rounded up: **283,809,208 B**.
Previous raw claim: 304,677,561 B. Reduction: **20,868,353 B**. The dated
299 MB engine base remains provenance; the matched road resident set is
what the method subtracts. No run or entered pose is dropped. This is a
fresh calibration, not an additional storage-saving claim.

The observed model still uses the previous committed claim: entry
1055.89–1055.91 MB, centre 1077.63–1077.66 MB. Replacing only that claim
projects a worst centre of **1054.49 MB**, still above 1000 MB. That is a
projection, not a newly observed grid total or a physical-phone cap pass.

Run 1 centre's model decomposes as engine 286.859 MB, overlap 80 MB,
page/composer 42.806 MB, and 1.11 times the following raw allocation claims:

| Owner group | MB |
| --- | ---: |
| Driftwood runtime | 304.678 |
| Other Driftwood claims | 28.972 |
| Platform excluding page | 130.600 |
| Grid products | 96.618 |
| Neighbour cells | 39.858 |
| Highway | 5.119 |

Platform includes 73.922 MB of map-library reservations. These are model
claims, not a physical census. `summary.json` preserves the native samples,
GL reconciliation, live state and full model claims used in the calculation.

`owners.json` is the third run's allocation census, taken only after every
physical sample. It distinguishes RAM capacities and GL allocations. Weakly
observed objects may await collection; capacities must not be called resident
RAM. Notable audit targets are the unentered Pine scene/world and its 30.688 MB
SFX buffer after speculative preparation; only Driftwood is a live resident.
Simulator evidence compares WebKit storage and does not establish a physical
iPhone's absolute memory use.
