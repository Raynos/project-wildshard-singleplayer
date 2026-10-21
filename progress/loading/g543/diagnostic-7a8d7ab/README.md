# Diagnostic loading receipts

Served SHA: `7a8d7ab209f2cd4667936f9bfe9bfefc19c258cf`.
These are diagnostic measurements, **not Phase 1 acceptance**.
All browsers were muted; phone Chromium used iPhone 16 Pro / CPU 4x.
Safari used the iPhone 16 Pro Simulator through sim-lane.

The phone grid profile reproduced a 1.376 s meaningful-detail gap.
Source mapping attributed 403 ms inside `GridSession.attach` to a second
full `plotCellColliders` generation (`plotCells.ts:50`,
`plotCellLayout.ts:224`); the constructor itself took 106 ms.
`e0b3064e0929365c82a229753e7b2c5a9de3b0fc` retains the exact sliced
collision buffers and reuses them at attachment, dropping render colours.
It yields the completed assembly before play setup. No plot internals changed.

The desktop profiles passed cadence (198 / 454 ms). Earlier multi-second
first-frame gaps did not recur. Safari's fresh-origin harness completed both
paths with healthy workers and no application errors (931 / 483 ms cadence).
Its older byte accounting remained red at 5.63 / 5.76% error. The subsequent
all-worker ownership source requires its own exact-build acceptance proof.

Raw captures and CPU profiles remain in the lane scratchpad while needed;
JSON includes their SHA-256 digests, stage rows, timing and byte totals.
