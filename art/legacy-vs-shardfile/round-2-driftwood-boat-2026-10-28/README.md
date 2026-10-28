# Driftwood camera 4: restore the moored sailboat

[Matched before / after board](camera-4-board.jpg), inspected at phone portrait size.

The same camera 4 from [round 1](../round-1-2026-10-28/cameras.json)
is used in every panel: canonical standing eye, rotation and FOV,
iPhone 16 Pro, phone tier, 2× rendering, seed 357, midday / clear,
and 90 actual drawn frames after the pose. Both entries use their
real SHARD SELECT mode buttons. Developer exposes those buttons and
the existing diagnostic camera; diagnostic overlays are hidden in
both modes. Captures are real game frames; only labels and layout
are added to the board.

Before: `a87795e6bd16910ae40e169fd4ecbdb509262e40`.
The native mover sets its tile container to `(-4.2, -203)` while
the original copy below it already has that same rest translation.
The actual hull ends up near `(-8.4, -406)`, outside this view.
LEGACY retains the original one-copy target at `(-4.2, -203)`.

After: `828dd585c81479c6ae928bf537d2c9d242612dcf`, served build
`828dd58-mvsiwxgs`. The generic following-copy placement uses its
existing complete-object path, so its mover borrows the original
object rather than an additional transform owner. The boat is
visible in both modes at `(-4.2, -203)`; wave height differs by the
normal live phase. Both entries complete with zero page errors,
and every camera coordinate, rotation and FOV matches exactly.
This is a registration correction: no mesh, material, collider
recipe, shader, script module or budget is changed.

The original native boat walk on the same pin completes in 2.2 s,
with zero stuck waypoints, no timeout, and all five boat colliders
registered as five native colliders. Focused placement, assembly
and mover-owner controls pass; ordinary static copies still use
tile-owned draws and retirement.

Raw captures and object transforms: `tmp/sp-x10-boat/before/` and
`tmp/sp-x10-boat/after/`. Walk:
`tmp/sp-x10-boat/walk/boat-root-828dd58-mvsiwxgs.json`.
Clouds, reflections, waves and moving actors differ between visits;
this board does not claim pixel equality or complete legacy parity.
