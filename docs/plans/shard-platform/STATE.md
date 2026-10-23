# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Order:** live P0s → loading plan (G619/G622/G626, P0) → Nalati zero (G621, no open picks, run overnight) → open
plots (G617/G621B/G623) → CI speed. G612 D5: land on types/lint + vitest related. G620: red main = 30 min fix-forward,
then sp-x7 reverts. D3: 5-min waits fail, no retry.

**Live:** 92bba7c1ba (since 04:13Z; P0 entry fixes). Open live P0s from Jake's iPhone: DW -> Sky -> DW crash (sp-o3,
with the O18 leak-after-unload fix: ~120 MB ArrayBuffer + ~50 MB heap per round trip); Nine black grid placeholder +
memory-strip % bug (sp-o5); SHARD SELECT black backdrop (sp-o2, after R1). sp-x7 releases each fix at once.

**Loading plan** (loading-speed-mini-plan.md; < 5 s warm / < 15 s cold): M1 dd2f3010a1 (local HEAD: controls 12.2
cold / 12.0 warm, worst 96 ms; live baseline next, sp-o4). Done: C1 9336ce0d6e + 3bceedea2a, G618 99f142d942,
2416aec1a4, 962ac115e8, R1 dddad396cb (3 s skippable reveal), T1 96c34b4f33 (tap paint). Open: P2 sp-o4, H3 tile
streaming G626 sp-o1, H2 sp-x1, A1 sp-o3 (after crash), S1 sp-o5 (after placeholder), H4/S2 sp-x2, G627 push gate
sp-x2. Road start deleted (G619, abc3e8ff16).

**Nalati** (official 6c80f62227 corrected: 1,877; since then R4 -9, R13 -37, R2 -68): C1-C3 / C5-C8 CLOSED + locked
(C6 e41ab532a1). Open C4 ~1,050, C9 ~714. Rows: R10a group step sp-x9 (critical) -> R10b pack sp-o4 / R10c herd
sp-x8; R11 taming sp-x8; R5/R7 Titan sp-x6 (D1 King arena variant), R6 view sp-o4; R8 elites sp-x1 (D2), R9 view
sp-o3 (slice 85ae215c7a); R3 sp-x9; R12 weather 33 folds into R15 (no duplicate, no AS law); R14/R15 LB sp-x8.

**Grid-ready:** DW + PINE + NINE latched. Open rows: Nine->Nalati 283 ms quiet-only frame (unattributed); GL program
sharing (sp-o5, S1).

**Lanes (5 Opus at Claude weekly 38 %; 5 Codex + sp-x7).** Working tree: 699 stale files synced 03:5x;
scripts/generation-jobs.json + src/format/package.json still stale (hook-blocked restore; Jake's `!` line), so the
broad 'vitest related' is blocked in the working tree; lanes note it in commits.

**For wildshard-v:** nothing pending from the coordinator; Jake's picks so far are all routed (G616-G627).

**Rules:** G605 Opus steps (50 % 3, 70 % 2, 80 % 1, 90 % 0). G492; never herdr wildshard-v; no net-0 moves (G571).
