# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Order (G639):** (1) live reds → (2) NALATI TO ZERO (R1-R15) → (3) GRID READINESS (10/10 latched). Extras: tile
streaming (G652/G663) → CI/gate → Night Market pilot NM4-NM6 (unclaimed) → loading → strip → hero.

**(1) Live** e314f1f2ac, pinned. Release floor c3de94e718 (crash leak fix 445ab27451 + herd/pack ROLLBACK
acd4ca9d5c (Nalati back to ~20-30 fps) + Pine build fix + native renderer fix 411836e571); sp-x7 unpins and ships
on its CI + exact smoke. The herd/pack-on-AS series (f8e8bac446 ...) was rolled back for a ~6 fps per-frame cost;
it re-lands only with early skips, incremental capture and a measured fps sample.

**(2) Nalati** (corrected 1,877; landed since: R4 -9, R13 -37, R2 -68, R3 -20, R11, R14 -14 C9, R8 224 -> 43, R9 -> 0,
R6 Titan view -69, R10a vocabulary done, dog guard on H4 rows 6cd2dfcd77 with fps proof): C1-C3/C5-C8 CLOSED.
R7 Titan ROUTE APPROVED (sp-x6): the 355-line OpenArenaProjection becomes admitted banks + fixed native-effect rows
on the D1 ArenaRoomEncounter; >= 295 charged removed for <= 280 generic platform; the King is a real second user;
frozen King + Titan oracles gate each slice. R10b/R10c pack + herd re-land later with perf gates; R10d/R10e page/
native copies wait on them (sp-x1 / sp-x9). R15 entry flip mapped (sp-x1), after R7/R10. R12 weather 33 stays
charged (admission/settings policy).

**(3) Grid:** 10/10 latched; quiet at 2498d0447e: Nalati max 183, Pine max 167 (no frame over 200). Nine afterKit
and Template regressions -> sp-o4. Frame floor (p95 <= 35 at phone 4x): none yet; staticMatrices 7de6a6a4d7
(default OFF; +6-9 % frames in Nalati/Pine) awaits a physical-device reading; sp-o3 on draw submission (Pine 227).

**Extras:** tile streamer S1 done + S2 staging (sp-x2: 35ddf09be3, f1b1e61b4c, 7ffc2c6de4 behind the Tile residency
row); DW T3-T5 + T7 slice 1 (sp-o1); Pine splat ground c3de94e718 (Debug Ground tiles, off). TS quick wins QW1/2/5/6
landed (sp-x1; QW5 37 -> 25 large imports). Gate gaps 1-5 + preparation softcap fixed (f529aab8df).

**For wildshard-v (Jake's phone check list):** staticMatrices on (+6-9 % frames); Nalati AS compile guard stays
2,837 (the raise reverted with the rollback).

**Lanes:** Claude weekly 55 % -> 3 Opus (sp-o1, sp-o3, sp-o4); 5 Codex + sp-x7.

**Rules:** G605 (70 % 2, 80 % 1, 90 % 0). G620 30 min fix-forward then revert. No net-0 moves (G571); D2 binders
report platform growth; never herdr wildshard-v.
