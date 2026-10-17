# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**Ruler at `7419a09cf` (10-17 ~05:00Z, pinned basis 1258254a3): M3 56.6 % (45,354 of 80,173 cut)**, plan 33.9–67.3 %. Custom left: Pine 10,584, DW 6,661, Sky 1,303, Signal 1,368, Nalati 20,948, Nine 12,636. Since 54.7 %: Kurgan b65a4de9f (Nalati −460), Nine kits 6612812e6 (−726), pickups f6407f626 (Pine −100).

**Rules in force:** G465 data and existing hosts only, measured net cuts; G466 close bar 100/0 except listed view code; G467 generators are not custom code; G468 each commit deletes a whole runtime module with its data path (~150+ net); G469 one task per agent; G454 second-shard user for any host change. Caps report-only (G433).

**Lanes (one task each):**
- sp-x1 Nalati + Nine manifests to declared data
- sp-x4 proof/build-only charges (simulation.ts proofs, Nine boot catalogue); the ruler change lands as its own commit
- sp-x5 Nalati layout/clearings bake (f4d3b62e7 in checks); terrain.ts stays (live forest mask, paint, water, ambience)
- sp-x6 Nalati paint.ts + signpost.ts bake
- sp-x8 Nine signAtlas bake (source done, checks queued)
- sp-x7 push carrier + grid memory receipt
- Opus OL Nine look graphs, ON Nalati sky/storm graphs + flock
- Opus OP3 baked shader source for node-graph builds
- Opus OP5 road hitches

**Perf (standing goal 60 fps desktop / 30 fps Sim):**
- Desktop standalone 7/7 at 60 fps; milestone 8/8 routes, 0 errors.
- Sim medians 30 fps, but road p95 still fails (Pine ~76, Nalati 52, Sky 42, DW 42 ms).
- Fixes so far:
  - Pine posed-atlas crash on re-entry: fixed (7afedf243, OT), with a re-entry scenario (7419a09cf).
  - Live collider batches split per frame: 2c956f4d9 (OP4), measure pending (OP5).
  - Node build dedupe: no duplicate builds exist (fd737f504), so OP3 bakes the shader source instead.

**Memory:**
- Neighbour products 436 → 48 MB (sp-x7: e38558916..e6066d1f4).
- Settled Nine on desktop reads 1,214 MB from late L0 rings (+43 MB) over the 1.2 GB report cap; Sim Pine 1,169 MB.
- Next: name the top late-ring costs.

**For the next switch point:** single-shard laws in Pine/DW/Nalati are documented in the [floor ledger](../../../progress/shard-platform/honest-floor-2026-10-17/README.md). Recommendation: list them as shard-owned custom. The next real cut needs native actor/save, figure/skin and graph ABIs. Rows: [open-x-queue](open-x-queue.md).
Paused: SF22 SF57 SF67.
