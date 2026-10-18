# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Ruler (twentieth, 9f77d61bd, 10-18 ~16:00 Cancun):** Nalati 18,615 (AS 283), Nine 11,260, Pine 4,109 (AS 488), DW 3,270 (AS 130), **Sky 0 / Signal 0** (progress/shard-platform/maps-batch-2026-10-18-20/all10-source-ruler.json). Layers at the eighteenth: engine 76,466, game 60,727, format 12,571, sdk 10,766.

**Phase:** W1 done; W2 Pine/DW under 20 % and Sky/Signal at zero; W3 Nalati/Nine now (G501/G504: mini-plan Step 1 batches by component, biggest first, one batch per task).

**Rules in force:** G465 data and existing hosts; G467 generators are not custom code; G468 whole-module deletes; G469 one task per agent; G470 single-shard logic to AS + data; G482 HOST-BAR ≥ 5/6; G490 source-only landings, sp-x10 bakes once per window; G492 no mid-task re-briefs; G493 sp-x7 owns a red gate; G496 shrink-only custom sections, attribution SHAs to the coordinator first; G498 legacy copies take crash fixes only.

**Batches:** twentieth 9f77d61bd LIVE (16:54 Cancun). Twenty-first sealed 2ba606e3d, pushed. Twenty-second window open to 19:30 Cancun, no landing order. Mega-build (G506/G507) 17:18 to 18:50: −6,284 shard lines from commit bodies (Nalati −3,482, Nine −2,713, DW −67, Pine −22), ~4,000 lines/h against ~400 before. Reds fixed by sp-x7: nine-layout pins 1284abfc7, generation order 1040cea94; open: root types from f6735966af (sp-x8 fixing).

**P0:** display-encode lift on main (b835bba67, 13acb03ba, 0ccd5c900). Nine B8 is 5,153 nodes / ~186 KB against the 4,096-node and 64,000-byte graph caps, which stay; sampler3D adoption is row N3D.

**Lanes (G505: 5 Codex builders + sp-x7 deploy + sp-x10 maps; Opus 0 until Mon 10-19):** sp-x1 Nalati native actors · sp-x9 Nalati B8 world · sp-x8 Nalati weapons · sp-x6 Nalati weather · sp-x5 Nalati cover/ambient life · sp-x4 holds Nine world rows (−335) for the release, then stops.

**G507 mega-build (Jake):** lanes only cut and land code; no lane-to-lane messages, receipts, boards, captures or soaks; lanes message the coordinator only for blockers. **Pace:** W3 ~55 lines per lane-hour. From each lane's next task: largest uncut batch first, no sub-200 cuts while big ones remain (G468); G506 (Jake): a batch lands on types + lint + focused tests + the push gate, nothing else; heavy proofs once per W3 milestone or grid deploy (lanes/common.md); a red gate gets sp-x7's fast revert (G493).

**Perf:** drive fix e2141156c default-off until a device reading; Simulator p95 34–35 ms on all roads. PF1 closed: Pine 59.88 fps, p95 16.8 ms.

**Attribution SHAs (G496):** G499 d5a456d5e, ruler key 7b326dcb4, cue director c3ff4774b, section seal 68eb6e360, admin ruler e2a214cdc, W3 classifier df6bab26d; G478 feature keys c9cb5d2b8 (mounts-riding-taming), c208e4ce4 (grapple-traversal, practice-courses).

Rows: [open-x-queue](open-x-queue.md). Paused: SF22 SF57 SF67. G495–G504 in the lane preamble.
