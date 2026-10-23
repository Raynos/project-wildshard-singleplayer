# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Order (G639):** (1) live reds → (2) NALATI TO ZERO (R1-R15) → (3) GRID READINESS (10/10). Extras: tile streaming →
CI/gate/no-binaries → Night Market pilot NM4-NM6 (unclaimed) → loading → strip → hero.

**(1) LIVE bda4ecdf14** (verified 11:40Z): the crash leak fix, the herd rollback (Nalati ~20-30 fps), Nine
placeholder, backdrop, elites, build fixes. Hourly release of ff45b6a24d running. All of this morning's routed
main reds are fixed and on origin (405acb1a5f AS budget, 8c2f5a2cdc island plan, 34d19e460b Nine spill, 332a7190f3
staticSets, a053803e5a + 77958833ba raw-module loans). The next CI + smoke green build is the next candidate.

**(2) Nalati:** C1-C3/C5-C8 CLOSED; R8 elites 0, R9 0, R3 0, R6 done, R14 C9 -14, dog guard retired -42. Herd re-land
6fa6de0276 (+ binary module 6fa07559f7/2c443c89db; titan JSON base64 425,112 -> 267,224) and pack 3ba6464938
(+78b530c90f; AS ceiling: species 3,189, others 3,184, approved exact): medians pass, but the herd still adds
~15 ms/frame (groupBank decode + numeric capture via tick + drive) -> p95 67 -> 100 and 217 ms frames. Fallbacks
STAY until sp-x8's hot-path fix passes sp-o3's combined sample. R10d/R10e after. R7 Titan 355 charged: Jake pick
(below). R15 waits R7/R10.

**(3) Grid 10/10.** Pine activation frame ~177 ms of work straddles 200 under the 30 fps cap; an 18 ms hook deferral
passes but changes entry semantics: sp-o1's call. Frame floor: Pine look p95 67 -> 50 (crag skin bd6c5005c6);
sp-o4 on species-shared distant trees (default-off row); staticMatrices + staticSets default off.

**Extras:** no-binaries B1-B4 done (121 caps; Nine 0 base64; B3 codec lint), B5 in progress (sp-x9: island plan -889k,
people fallback -578k); TS QW1/2/5/6, LD2/LD4, TD3 (578 -> 574), R3, T3 (18 files colocated), T4 (sp-x1); tile
streaming S1 done, S2 behind Tile residency; Pine P1-P3 (sp-o1; ground draws merged 3b9871866b).

**For wildshard-v (Jake pick needed):** the Titan's 355-line OpenArenaProjection can't be cut honestly with current
APIs (two sized routes failed, sp-x6). Options: (a) approve it as a one-user host for HOST-AUDIT; (b) a full WASM
route (large); (c) leave it charged. Recommended (a). Also: staticMatrices + staticSets on, for the phone check.

**Lanes:** Claude weekly 58 % -> 3 Opus (sp-o1, sp-o3, sp-o4); 5 Codex + sp-x7.

**Rules:** G605 (70 % 2, 80 % 1, 90 % 0). G620 30 min fix-forward then revert. No net-0 moves (G571); never herdr
wildshard-v.
