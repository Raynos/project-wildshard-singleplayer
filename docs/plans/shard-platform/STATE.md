# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Ruler (twentieth, 9f77d61bd, 10-18 ~16:00 Cancun):** Nalati 18,615 (AS 283), Nine 11,260, Pine 4,109 (AS 488), DW 3,270 (AS 130), **Sky 0 / Signal 0** (progress/shard-platform/maps-batch-2026-10-18-20/all10-source-ruler.json). Layers at the eighteenth: engine 76,466, game 60,727, format 12,571, sdk 10,766.

**Phase:** W1 done; W2 Pine/DW under 20 % and Sky/Signal at zero; W3 Nalati/Nine now (G501/G504: mini-plan Step 1 batches by component, biggest first, one batch per task).

**Rules in force:** G465 data on existing hosts; G467 generators aren't custom code; G468 whole-module deletes; G469 one task per agent; G470 single-shard logic to AS + data; G482 HOST-BAR ≥ 5/6; G490 source-only landings, sp-x10 bakes; G492 no mid-task re-briefs; G493 sp-x7 owns reds; G496 shrink-only sections; G498 legacy crash fixes only.

**Batches:** twentieth 9f77d61bd LIVE (16:54 Cancun). Twenty-first sealed 2ba606e3d, pushed. Twenty-second window open to 19:30 Cancun, no landing order. Mega-build (G506/G507) 17:18 to 18:50: −6,284 shard lines from commit bodies (Nalati −3,482, Nine −2,713, DW −67, Pine −22), ~4,000 lines/h against ~400 before. Twenty-second pushed 9e3f194f71 (21:00) after six startup reds and the Nalati test fix aee161bd63. Twenty-third window open; closes as soon as sp-x5's Nalati decision-module fold (14 to 8) lands. Live lag: origin 9e3f194f71 is red on CI's cold generation (Nalati layout.generated.json ordering); sp-x7 fixed it in dfdfda62f5, so the twenty-third seal + push moves live. Landing now: sp-x5 Nalati −1,784, sp-x6 Nine −462 (+~240), sp-x8 Nine −335, sp-x9 titan/taming, sp-x1 night roster. G508 painter (sp-x4): templates on data; Sky next; Nalati/Nine wait for full rest assemblies.

**Lanes (G505 + painter; Opus 0 until Mon 10-19):** sp-x1, sp-x5, sp-x6, sp-x8, sp-x9 W3; sp-x4 G508 painter; sp-x10 maps; sp-x7 deploy.

**G508 (Jake):** the next lane to finish builds a data map painter (map/top.webp from terrain + ground types + scene rows, in the normal build, no browser, exactly accurate); data shards switch first, Pine/DW after C1; then bake windows, seals and freezes go. **G507 mega-build (Jake):** lanes only cut and land code; no lane-to-lane messages, receipts, boards, captures or soaks; lanes message the coordinator only for blockers. **Pace:** W3 ~55 lines per lane-hour. From each lane's next task: largest uncut batch first, no sub-200 cuts while big ones remain (G468); G506 (Jake): a batch lands on types + lint + focused tests + the push gate, nothing else; heavy proofs once per W3 milestone or grid deploy (lanes/common.md); a red gate gets sp-x7's fast revert (G493).

**Perf:** drive fix e2141156c default-off until a device reading; PF1 closed.

**Attribution SHAs (G496):** G499 d5a456d5e, ruler key 7b326dcb4, cue director c3ff4774b, section seal 68eb6e360, admin ruler e2a214cdc, W3 classifier df6bab26d; G478 keys c9cb5d2b8, c208e4ce4, d27df7e1f (portal ride), 15485dd84 (audio), 5d021eabb (stealth).

Rows: [open-x-queue](open-x-queue.md). Paused: SF22 SF57 SF67.
