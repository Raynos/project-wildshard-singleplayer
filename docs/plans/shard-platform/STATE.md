# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**W1 DONE (10-17 ~09:30Z): Sky 521 (7.7 %, target 677), Signal 392 (9.51 %, target 412; margin 20) after a19114d1f.** Ruler at 70a9eb705: M3 60.8 % (48,774 of 80,173); since then Signal E −186 and C −168. Pine 10,367, DW 6,488, Nalati 20,069, Nine 11,889. Per G471 all lanes now work Pine/DW (W2) through the G477 features. Ladder G479: Opus eyes-only, 0 running.

**Rules in force:** G465 data and existing hosts only, measured net cuts; G466 close bar 100/0 except listed view code; G467 generators are not custom code; G468 each commit deletes a whole runtime module with its data path (~150+ net); G469 one task per agent; G454 second-shard user for any host change. Caps report-only (G433).

**Lanes (W2, features G477):**
- sp-x5 #1 quest step runner (−208 ready) after its a68cc666a fix c0e16914c and the G415 boss re-record.
- sp-x8 #2 native actor interface + spawn director.
- sp-x6 #4 held arms + loadout/ammo/skins (first: DW toonArms).
- sp-x4 #6 collections and display (keepsakes, trophies, chime).
- sp-x1 Sim road part four (warm-up gap: shared batches drop earlier layout UBO prep).
- sp-x7 pusher. Next free lane: #3 boss host after the re-record, then #5 living buildings.

**Perf (standing goal 60 fps desktop / 30 fps Sim):** Sim crash FIXED (0e9f5d4c9, OM: ANGLE RGB8 ETC2 overread, only under the G386 probe-skip pin). Quiet Sim road p95 at e5aba0e01 (travel/drive): Pine 55/55, Nalati 53/46, DW 68/53, Sky 36/44 ms; staged node builds gave no win (removed). sp-x1 attributes Pine's long world-build frames.
- Desktop standalone 7/7 at 60 fps; Sim milestone 8/8 with no crash after 0e9f5d4c9. Landed: 7afedf243 posed-atlas re-entry, 2c956f4d9 + ea3164e39 live collider splits (Nalati 172 → 47 ms), 230be1ccc/e0799b920 Sky pacing.

**Memory:** neighbour products 436 → 47 MB (sp-x7); settled Nine 1,242 MB over the 1.2 GB report cap (late L0 rings), others 600–900 MB.

**Order (G471/G477, plan agent's mini plans `progress/shard-platform/mini-plans-2026-10-17/`):** W1 spike (Sky, Signal ≤ 10 %), then W2 (Pine, DW ≤ 20 % through the G473–G477 platform features, AS only for unique logic), then W3 (Nalati, Nine). Rows: [open-x-queue](open-x-queue.md).
Paused: SF22 SF57 SF67.
