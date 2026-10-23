# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Order (G639):** (1) live reds → (2) NALATI TO ZERO (R1-R15) → (3) GRID READINESS (now 10/10). Extras, never
pre-empting: tile streaming (G652/G663: DW T0-T5 → T7 crossings by tiles → Pine → Nalati; neighbour = LOD only) →
CI/gate → Night Market pilot NM4-NM6 (unclaimed; needs a SHARD SELECT card) → loading → strip → hero.

**(1) Live** e314f1f2ac. Crash leak closed (5 rounds, floor 445ab27451); Nine placeholder ffa26b824a. Candidate
513fcc4b74: gen/products/types/lint green, behaviours running; sp-x7 ships on CI + exact smoke. Hourly releases
verified (GitHub schedule + launchd backstop 885a217f0e at minute 47).

**(2) Nalati** (corrected 1,877; landed since: R4 -9, R13 -37, R2 -68, R11 taming, R14 targets, R8 -22/-6/-34/-23,
R9 122 -> 0, R6 Titan view -69): C1-C3/C5-C8 CLOSED. R10a group-step vocabulary COMPLETE (a5abff3e48).
R10c herd in production on the shared GroupBrain loop (f8e8bac446; legacy fallback still charged) -> R10b pack
joins (sp-o4, exact 600-tick differential) -> R10d/R10e delete the page/native copies. R5/R7 Titan sp-x6 (shared
ArenaRoomEncounter 846653fabf; whirl gate into AS next; projection stays charged). R8 native elites 138 sp-x1
(roster/install next). R3 species sp-x9. R14/R15 LB sp-x8.

**(3) Grid-ready 10/10:** Nalati memory 8aafd2b665 + oneFrameLooks dac928be76 (entry worst 350 -> 183 ms).
Frame floor (Jake's 30-60 fps goal): no shard meets p95 <= 35 ms at phone 4x (most 50-67); sp-o3 on a quiet
baseline (checking possible Sky/Template/Nine entry regressions first), then shared render costs (draw count,
static matrix walk).

**Tooling:** push gate fixed (48f221e44d: selector JSON in owned files; gaps fixed 9ff3d71239, 97a6ad7a89,
49c4e5df4a); pre-commit soft caps + Ratchet-Approved trailer; G662 tree 662 -> 1 path; commit.sh --patch refreshes
untouched copies (1635d3a6e1). Tile streamer S1 30dcc15182 + time budget 513fcc4b74 + pins 657d13114a (sp-x2,
rectangles next); T3/T4/T5 sp-o1 (dc240845c1, 82e0ac421a).

**For wildshard-v:** nothing pending.

**Lanes:** Claude weekly 51 % -> 3 Opus (sp-o1 tile streaming, sp-o3 frame floor, sp-o4 R10b); sp-o2/sp-o5
stopped (watchdog exempt). 5 Codex + sp-x7.

**Rules:** G605 steps (70 % 2, 80 % 1, 90 % 0). G620 red main = 30 min fix-forward then revert. G492; never herdr
wildshard-v; no net-0 moves (G571); D2 engine binders report platform growth.
