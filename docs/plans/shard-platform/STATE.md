# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**Ruler at `7419a09cf` (10-17 ~05:00Z, pinned basis 1258254a3): M3 56.6 % (45,354 of 80,173 cut)**, plan 33.9–67.3 %. Custom left: Pine 10,584, DW 6,661, Sky 1,303, Signal 1,368, Nalati 20,948, Nine 12,636. Since 54.7 %: Kurgan b65a4de9f (Nalati −460), Nine kits 6612812e6 (−726), pickups f6407f626 (Pine −100).

**Rules in force:** G465 data and existing hosts only, measured net cuts; G466 close bar 100/0 except listed view code; G467 generators are not custom code; G468 each commit deletes a whole runtime module with its data path (~150+ net); G469 one task per agent; G454 second-shard user for any host change. Caps report-only (G433).

**Lanes (one task each), switch point 10-17 + G477 add-on:**
- W1 spike: sp-x8 Sky S1→S2; next free lanes get Signal A→B, the runtime-rows host (Sky M1 + Signal D) and the painted-look host (Signal F + Sky #9)
- Features (lanes with no spike task): sp-x5 → #1 quest step runner (Pine + DW) after landing DW batch 1. Note for the plan agent: sp-x7's DW quest AS draft was WITHDRAWN under G473/G474 (no host landed), so the runner covers DW quest too.
- Landing now: sp-x1 manifests, sp-x4 proof extraction + a5df1f8c5 forward revert, sp-x6 Nalati paint/signpost
- sp-x7 pusher; wave table fixed (6d687cb50, 02dbb2144); shard-components wave change held until its pending-charge split matches G473–G477
- Opus (cap 2): OL2 Nine look-graph verify, OM Sim GPU crash

**Perf (standing goal 60 fps desktop / 30 fps Sim):** Sim drives crash: a WebKit GPU-process SIGSEGV in ANGLE compressedTexSubImage2D/3D (not memory), 14 reports since 04:53; OM is tracing the upload.
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

**G470 (Jake, 703cdedd2), now applied:** single-shard laws move to AssemblyScript + data inside the 10 % AS ceiling (Pine ~2,130, DW ~1,716); a component closes at data + AS + listed view code. Pine/DW go first. The order freeing lanes take: Pine quest AS, then the native actor + save ABI (Pine roster/nightDirector + DW keeper paired), then the C3/C7 weather, life and doors to AS. sp-x7 already leads DW quest + Pine lodge on a ScriptProcedure host (ABI-v0). [Floor ledger](../../../progress/shard-platform/honest-floor-2026-10-17/README.md), rows: [open-x-queue](open-x-queue.md).
Paused: SF22 SF57 SF67.
