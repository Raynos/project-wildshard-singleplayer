# Grid programs during loading

Status: unread
Plan: SHARD-PLATFORM · E435 · G451

The reload Debug row **Grid programs during loading** defaults **Off**.
Selecting an admitted cell prepares it while the loading
screen remains visible. It cancels entry and retires that world before
starting the initial home or restoring the saved continuation; native shader programs remain owned until the
page exits. Validation and runtime admission remain active.

G451 permits longer loading to reduce Pine's Safari grid approach stalls.
The coordinator approved one additional comparison row. AGENTS.md's
risky-render rule requires this temporary-world/program-lifetime change
to remain default-off until a physical-device reading backs it. Retire
the row after that reading and the quiet frame floor are green with it on.

The program owner is bounded to 512 keys. Its 128 MiB admission charge
is a conservative estimate, not measured native memory. The loading
comparison records native WebContent and GPU-process footprints before
the frame-floor samples begin.

The comparison is **blocked; no performance or frame-floor credit**.
On candidate `07181ab18`, the matched Safari prefix stopped at Nine
waypoint 0 after 385 seconds: feet `(555.9, 125, -535.4)`, current Nine,
no page errors. The direct Pine control also failed before admission:
`Unbound runtime item profile`, current null at `(0, 0.4, 298.4)`.
Both failures occurred with the experiment **Off**, before a Pine
selection run could be compared. The coordinator routed these baseline
faults separately and approved landing this unfinished experiment off.

Ten focused checks, narrowed types and typed lint passed. The earlier
count-selected comparison never warmed a cell and is excluded. Added
loading time, loading peak with Pine selected, and approach p95 remain
unmeasured; retry after the admission faults are fixed. Simulator native
memory would remain diagnostic, not physical-device safety evidence.
