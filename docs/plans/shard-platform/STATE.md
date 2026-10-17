# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**W1 DONE (10-17 ~09:30Z).** Ruler at `d78cef781` (~12:40Z, JSON-aware G480): **M3 63.8 % (51,155 of 80,173 cut)**, plan 38.3–71.6 %. Sky 528 (7.8 %), Signal 392 (9.5 %); W2: Pine 8,984 (42.2 %; target ≤ 4,261), DW 5,829 (34.0 %; target ≤ 3,433); W3 later: Nalati 20,077, Nine 11,889. Landed features: quest runner 6/6 (974e725c4), boss host 6/6 (c023b2350), collections 5/6 (d78cef781), held arms/catalogue/loadout 5/6 (a29bc1c05, 2d0e3fcb7, c7bd8fe24), actor lifetimes 3/6 (78820910c, fix in flight). Ladder G479: Opus eyes-only, 0 running.

**Rules in force:** G465 data and existing hosts only, measured net cuts; G466 close bar 100/0 except listed view code; G467 generators are not custom code; G468 each commit deletes a whole runtime module with its data path (~150+ net); G469 one task per agent; G454 second-shard user for any host change. Caps report-only (G433).

**Lanes (W2):**
- sp-x5 Z2 world scene assembly (G483; first adopters DW cascade + Pine streams).
- sp-x8 population HOST-BAR fix (honest Pine charge-back; 7 crossings grandfathered until the AS adapter row).
- sp-x6 feature #4 rest: held gear/skins, toon 6/6 fix, DW IronSword claim.
- sp-x4 G484 (a): skitterer to ABI v1 with a generic spawn-group binding.
- sp-x1 Sim road part six (native traces: zlib decode + microtasks; shared inflate pacing).
- sp-x7 pusher. Next free lane: G484 (b) SCRIPT-ABI.md rewrite, then #5 living buildings; Z1 after Z2.

**Perf (standing goal 60 fps desktop / 30 fps Sim):** Sim crash FIXED (0e9f5d4c9, OM: ANGLE RGB8 ETC2 overread, only under the G386 probe-skip pin). Quiet Sim road p95 at e5aba0e01 (travel/drive): Pine 55/55, Nalati 53/46, DW 68/53, Sky 36/44 ms; staged node builds gave no win (removed). sp-x1 attributes Pine's long world-build frames.
- Desktop standalone 7/7 at 60 fps; Sim milestone 8/8 with no crash after 0e9f5d4c9. Landed: 7afedf243 posed-atlas re-entry, 2c956f4d9 + ea3164e39 live collider splits (Nalati 172 → 47 ms), 230be1ccc/e0799b920 Sky pacing.

**Memory:** neighbour products 436 → 47 MB (sp-x7); settled Nine 1,242 MB over the 1.2 GB report cap (late L0 rings), others 600–900 MB.

**Order (G471/G477, plan agent's mini plans `progress/shard-platform/mini-plans-2026-10-17/`):** W1 spike (Sky, Signal ≤ 10 %), then W2 (Pine, DW ≤ 20 % through the G473–G477 platform features, AS only for unique logic), then W3 (Nalati, Nine). Rows: [open-x-queue](open-x-queue.md).
Paused: SF22 SF57 SF67.
