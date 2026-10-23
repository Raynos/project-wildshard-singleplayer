# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Order (G639):** (1) live reds → (2) NALATI TO ZERO (R1-R15) → (3) GRID READINESS 10/10. Extras, never
pre-empting: tile streaming (G652/G663: DW T0-T5 → T7 crossings by tiles → Pine → Nalati; a neighbour is LOD only,
no logic) → CI/gate/pre-commit → Night Market pilot (needs a SHARD SELECT card) → loading → strip → hero.

**(1) Live** e314f1f2ac. Crash leak CLOSED in Chromium over 5 rounds (eae603df0b, 3f972ab731, ff36862436,
90f866b138, da3687d6b4, 445ab27451: no retired region outlives ~45 s, memory flat per round trip); Nine black
placeholder ffa26b824a. Release floor 445ab27451: sp-x7 ships on CI + exact smoke (CI reds on older builds were
all fixed forward). Hourly launchd backstop restored 885a217f0e (minute 47).

**(2) Nalati** (corrected 1,877; since then R4 -9, R13 -37, R2 -68, R11, R14, R8 -22/-6/-34, R9 122 -> 0, R6 -69):
C1-C3/C5-C8 CLOSED. R10a group step sp-x9 (contacts/notifications left) -> R10b pack sp-o4 (pasture v2 selected
9bc0a39192 + ffaa2d9655; pack profile next) / R10c herd sp-x8 (scratch, 16 cases). R5/R7 Titan sp-x6 (shared
open/closed ArenaRoomEncounter, landing next; projection stays charged). R8 native lifecycle sp-x1 (162 left) or
R3. R14/R15 LB sp-x8.

**(3) Grid-ready 9/10:** Nalati memory LATCHED 8aafd2b665 (223 MB); oneFrameLooks drive worst 650 -> 333 ms
(c76560dbe9, 9cbe8b1280, 650d0afbad, 4ef017828c), still > 200 -> sp-o3.

**Tooling:** G662 tree 662 -> ~12-49 paths (sp-x2; commit.sh --patch to refresh untouched working copies next);
gate gaps fixed (9ff3d71239 generated imports, 97a6ad7a89 build-copied assets; regenerated-output gap queued);
pre-commit soft caps d7255f9638 + ratchet HEAD-count / Ratchet-Approved trailer 868c3b353d.

**For wildshard-v:** nothing pending. Jake named the five new plots (G653); rollout after the Night Market pilot.

**Lanes:** Claude weekly 50 % -> G605 3 Opus: sp-o3 (grid readiness), sp-o4 (R10b), sp-o1 (Titan done; all
tile-streaming Opus rows). sp-o2 stopped (watchdog exempt 36509ea966); sp-o5 stops after its current task. 5 Codex
+ sp-x7.

**Rules:** G605 steps (70 % 2, 80 % 1, 90 % 0). G620 red main = 30 min fix-forward then revert. G492; never herdr
wildshard-v; no net-0 moves (G571); D2 engine binders report platform growth.
