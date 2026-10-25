# G720: resident Night Market entry

[Phone-tier entry](entry.jpg), captured on iPhone 16 Pro portrait emulation
(402 × 874 CSS pixels, DPR 3), muted, through `scripts/browser-lane.sh`.
Exact app: `e80c55ee2548281fc5aeec9eb90a86f7aeed9f0d`, build
`e80c55e-mvnand2a`. The defining residency fix is `cb756b79df`.

The traveller walked from the south road into `open-plot-nw`; no tile
readiness wait or forced admission was injected by the capture harness.

| Observation | Before (`acf56cf5c4`) | After (`e80c55ee25`) |
|---|---:|---:|
| Crossing committed, from road start | 5.990 s | 6.038 s |
| First recorded entered view: L1 / L0 | 12 / 16 | 16 / 15 |
| Far proxy in that view | visible | hidden |
| First far-hidden sample after commit | +9.133 s | first entered sample (+0.034 s) |

Geometric entry occurred at 7.409 s in the after route. All 16 L1 and
15 L0 tiles were already resident at its first in-cell sample: **0 ms
waiting after crossing the cell boundary**. Every subsequent entered
sample kept the far proxy hidden. No runtime error or context loss.
Samples are approximately four per second; this is a residency contract
check, not a frame-floor result or an isolated browser-speed comparison.

Cause: data-only destinations prepared simulation independently from
their neighbour tile views. They could commit while the far proxy was
still drawing. Required data entry now awaits admitted views plus coarse
and entry L0 coverage on the existing scheduler. Already uploaded views
are retained when borrowing the same root. The upload budget is unchanged.

The title banner and minimap are the actual shared HUD at capture time.
Map-atlas work and billboard colour are separate rows.
