# Pine play spike diagnostic (E435)

Diagnostic only: **no timing credit**. Six-route prefix through Pine on
`05ce8a0c069856cd05a43b7e06269defcae92b3d`, desktop, CPU/GPU profiling,
Developer ON, DEVSERVER catalogue, build pacing ON, unchanged render scale
2x. The complete run took 417.3 seconds and reported zero errors. Cleanup
closed the owned preview/browser before quiet release at 22:49:41.757Z.

Pine short travel measured p95 16.8 ms, max 166.7 ms; whole drive p95
16.8 ms, max 166.7 ms; entry interior p95 16.8 ms, max 16.8 ms. Profiling
failed to reproduce the unprofiled 33.3 ms p95 miss. That milestone row
remains open; these samples do not replace it.

The 166.7 ms frame at page time 322194 ms overlaps Pine's `play` hook.
The trace shows a 154.265 ms main-thread function call and about 143 ms
inclusive in the chain `Minimap.update`, `ground`, `paintLayer`,
`paintRegion`, sampling the home Driftwood terrain. The grid's map
replacement gives this base zero opacity, yet Pine's feature registration
made it dirty and the next HUD update painted it synchronously.

Concurrent CDP CPU-profiler deltas include 1593 negative entries. Its
window aggregates are rejected for exact spike attribution; trace-clock
V8 samples establish the minimap stack. Raw profiles stay in scratch.

Fix `511be233025a84fd026f168b0476715a761dbeb4` resolves base ground only
when opacity is positive. It retains dirty state, the exact painter and
cache, visible overlays, marks, fog, animals and HUD controls. Ten focused
map checks, root strict TypeScript and touched typed lint pass. Validation
still requires an unprofiled Pine max <=100 ms and exact positive-opacity
minimap pixel equality in the next reserved slot.

[Scalar receipt](summary.json). No full-floor closure is claimed.
