# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Ruler (eighteenth, ef8a24805, 10-18 ~14:00 Cancun):** Nalati 18,760 (AS 240), Nine 11,463, Pine 4,109 (AS 488), DW 3,270 (AS 130), **Sky 0 / Signal 0**. Layers: engine 76,466, game 60,727, format 12,571, sdk 10,766. Running netCut W1 −40,637, W2 −8,440 (progress/shard-platform/maps-batch-2026-10-18-18/all10-source-ruler.json).

**Phase:** W1 done; W2 Pine/DW under 20 % and Sky/Signal at zero; W3 Nalati/Nine now (G501/G504: mini-plan Step 1 batches by component, biggest first, one batch per task).

**Rules in force:** G465 data and existing hosts; G467 generators are not custom code; G468 whole-module deletes; G469 one task per agent; G470 single-shard logic to AS + data; G482 HOST-BAR ≥ 5/6; G490 source-only landings, sp-x10 bakes once per window; G492 no mid-task re-briefs; G493 sp-x7 owns a red gate; G496 shrink-only custom sections, attribution SHAs to the coordinator first; G498 legacy copies take crash fixes only.

**Batches:** eighteenth landed ef8a24805 (W3 audio, Nalati chapter, Nine spill, rock contacts), pushed. Nineteenth (NM2 only) landed 9c4f059ba and pushed; Nalati 18,738 (AS 283). Twentieth window open, cutoff 18:00 Cancun. **Live lag:** still 114973d17; push CI red on quest-step-native-parity (Driftwood ETIMEDOUT 270 s). sp-x7 owns it (G493): fixture split next push, else revert the cause. **Twentieth order:** sp-x8 Nine signs (−207) · sp-x9 Nalati B3 (−123, ready) · sp-x5 Nine B4 (−162, 28 LOD GLBs) · sp-x6 Explorer B10 (11 modules, −204) · sp-x4 Nine B7 (−221) · sp-x1 NM2 close-out (sheepdog to AS at 10 Hz, keeper wrappers deleted).

**P0:** display-encode lift on main (b835bba67, 13acb03ba, 0ccd5c900), validated against the 9190f1569 GLSL (16 captures SSIM ≥ 0.9995). Nine B8 is 5,153 nodes / ~186 KB against the 4,096-node and 64,000-byte graph caps, which stay; sampler3D adoption is row N3D.

**Lanes (7 Codex + sp-x7 deploy; Opus 0 until Mon 10-19):** C1 Nine sp-x5 · C4/NM2 sp-x1 · C9 Nine sp-x8 · C5 Nalati sp-x9 · C6-C8 + ruler sp-x6 · C2/C3 + P0 sp-x4 · maps sp-x10 · sp-x7 deploy only (G485/G493).

**Perf:** drive fix e2141156c default-off until a device reading; Simulator p95 34–35 ms on all roads. PF1 closed: Pine 59.88 fps, p95 16.8 ms.

**Attribution SHAs (G496):** G499 d5a456d5e, ruler key 7b326dcb4, cue director c3ff4774b, section seal 68eb6e360, admin ruler e2a214cdc, W3 classifier df6bab26d (Nalati/Nine path rules, totals unchanged).

Rows: [open-x-queue](open-x-queue.md). Paused: SF22 SF57 SF67. G495–G504 in the lane preamble.
