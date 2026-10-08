# Nalati four-entry and exact persisted-save proof — E435 / SF48-g

**PASS**, source pin `a661cebcf`, including restore fix `7ce76d7c0`.
Developer ON, one muted iPhone 16 Pro portrait Chromium lane. The actual
INFINITE WILDSHARD menu card boots the grid. No runtime or save patches.

Command: `scripts/browser-lane.sh node progress/shard-platform/sf48/four-entries.mjs --url=<pinned-preview> --out=<scratch> --caught=on`.

Two pages each walk west, south, east and north: road midpoint → socket →
at least 30 m inward at ground y=0 → road again, using normal movement input.
Only the initial road placement for each edge uses spawn. No stuck recovery,
crossing skip, save reset, save injection or missing-actor removal.

| Page | West inward | South inward | East inward | North inward |
|---|---:|---:|---:|---:|
| Original | 31.2790 m | 31.2792 m | 31.2798 m | 31.3512 m |
| Fresh, persisted | 31.3508 m | 31.3510 m | 31.2789 m | 31.2800 m |

All 8 entry/return routes (16 walking legs) complete with **0 stuck, 0 falls,
0 page errors, 0 console errors, 0 caught restore exceptions, 0 disposal
errors**. Entry feet are y≈0.02 m, within the 0.1 m ground tolerance. Both
pages return to ready road state. All 15 ScopeCensus fields are zero after
normal unload; native before/after censuses are exactly equal on both pages.

Normal unload persists the first page's Nalati document. The fresh page reads
the same localStorage origin before any entry and proves exact byte equality:
6,786 bytes, SHA256
`b9bc3075daa049ef520d8eddacc317519b293c6e7a5f0b5ebb0c184d254b250d`.
The formerly failing third/east entry now passes on both pages. Raw traces,
storage documents and independent resource census are retained in `walk.json.br`;
the compact route/teardown model is `summary.json`. Eight original portrait
captures were inspected; each is under 500 KB. Browser and preview are closed.

This is a functional crossing/restore proof, **not** a frame-floor or memory
envelope pass. The existing Developer overlay still warns about the unported
whole-runtime world cost. G227's tile bake remains necessary; this receipt does
not discount costs or claim the 1 GB total has passed.
