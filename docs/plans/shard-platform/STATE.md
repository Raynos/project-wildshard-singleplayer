# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Order (G639):** (1) live reds → (2) NALATI TO ZERO (R1-R15) → (3) GRID READINESS (10/10 latched; regressions
open). Extras: tile streaming (G652/G663) → CI/gate → Night Market pilot NM4-NM6 (unclaimed) → loading → strip →
hero.

**(1) Live** e314f1f2ac, DEPLOY HELD (sp-x7 pin c8a6965398). Crash leak closed (floor 445ab27451). NEW PERF RED:
sp-x8's herd-on-pasture series (f8e8bac446, 73e256b4b7, da64b6f6b4, 8964d99a6d) + sp-o4's pack join b17399806a
dropped Nalati to ~6 fps at phone 4x (per-frame full-bank group step); the gate fix didn't hold, so sp-x8 is
ROLLING BACK all five in one commit (09:35Z). Release resumes after: the revert is on origin + a quiet sample near
30 fps + CI + exact smoke on a build at or above the revert with the 445 floor. Push gate: preparation 45 s timeout
red (sp-x2 fixing first).

**(2) Nalati** (corrected 1,877; landed since: R4 -9, R13 -37, R2 -68, R3 species -20, R11, R14 targets + stealth
-6 + audio/skins -8, R8 elites 224 -> 112, R9 122 -> 0, R6 Titan view -69, R10a vocabulary done): C1-C3/C5-C8
CLOSED. Reopened by the rollback: R10b pack (sp-o4) + R10c herd (sp-x8), re-landing with incremental capture,
early skip gates and a perf reading BEFORE fallback deletion. R10d/R10e page/native copies sp-x1/sp-x9.
R5/R7 Titan sp-x6 (whirl gate folded into the next charged cut). R15 entry mapping sp-x1 (weather 33 stays charged:
admission/settings policy, no AS law).

**(3) Grid:** 10/10 latched (Nalati 8aafd2b665, dac928be76). Quiet-baseline regressions: Pine 700 ms post-activation,
Nine afterKit 283, Template 267 -> sp-o4. Frame floor (p95 <= 35 ms at phone 4x): no shard yet -> sp-o3 after the
herd perf proof.

**Extras:** tile streamer S1 done (30dcc15182, 513fcc4b74, 657d13114a, 554ecd9dd5, acf0248429, 35ddf09be3,
0bc9863270; sp-x2); DW tiles T3-T5 + T7 slice 1 (ea1e2a54bb, -390; no whole-neighbour build) sp-o1, Pine P1 next.
Gate gaps 1-5 fixed (be65bb64ac latest). G662 tree 662 -> ~1.

**For wildshard-v:** AS compile guard raised to 5,674 then reverted to 2,837 with the pack rollback; it re-raises
only with a measured-fast pack (my G454/G600 call, for Jake's notice).

**Lanes:** Claude weekly 53 % -> 3 Opus (sp-o1, sp-o3, sp-o4); 5 Codex + sp-x7.

**Rules:** G605 (70 % 2, 80 % 1, 90 % 0). G620 30 min fix-forward then revert. No net-0 moves (G571); D2 binders
report platform growth; never herdr wildshard-v.
