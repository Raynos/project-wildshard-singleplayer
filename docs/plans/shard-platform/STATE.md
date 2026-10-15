# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**RESUMED 2026-10-15 15:40Z** after Jake's pause. **W1 CLOSED** (90/10 + G420 grid check). **W2 at `54549d4ff` (clean generated, build mirror): Pine 82.31 %, Driftwood 76.98 %, 0 unknown** (start 107.6 / 104.2; target 80/20).
Pine/DW: C1 4653/4924 · C2 2011/2699 · C3 269/0 · C4 3971/2238 · C5 2506/1459 · C6 3106/1232 · C7 12/0 · C8 360/189 · C9 579/475.

**Lanes (G421 4 Opus visual-only; G428 burn Claude to 100 %, Codex reset):**
- Opus o215 DW ocean re-land (`refs/parked/sp-o198-ocean`, ≈ DW −173) on the E2 fix `78258e147`; o216 DW ground + toon materials (`refs/parked/sp-o207-ground`, then kit, island, palms, pier, creatures, arms, then delete toonGlsl/toonLight); o217 Pine crags + forest on batched graphs (rebuild; the patch was lost in the reboot); o218 Pine water retry on E2 (`data/waterLook.ts` PARKED), then G427 night crown shadow ~0.8, then the Explorer check for DW/Sky/Signal + timber.
- Codex x1 native model pools (`refs/sp-lanes/sp-x1/native-pools-20261014`), then Pine loadout/skins, DW keepsakes/swords; x4 undergrowth records (258 KB) landing; x5 G424 manifest JSON (W1 first, ≤ 10 %), then Pine + DW; x6 dune-log bake, then GroundCover/ropeBridge; x7 SFX loop cut (8.15 MB) then DW music on AAC (iOS check first); x8 reconcile dispose-rebind with `3388936dc`, re-test the parked palm.
- Memory: the grid sits ≈ 1025/1000 MB after the G258 DW claim (`fb64049e3`) and the shadow-leak fix (`2ca20f6bf`); x7's audio cuts take it under.

**New rules (AGENTS.md 10-15):** push manually with `scripts/push-main.sh`; never copy the repo (build mirror, `./tmp/<task>` scratch); storage policy (`scripts/repo-size.mjs`); no worktrees. Leave the untracked nine-dragon-stack files and foreign staged files alone (owner unknown). The reboot wiped `/private/tmp`, so the old scratch patches are gone.

**Waves (G413):** W1 done → W2 Pine + Driftwood (to 80/20) → W3 Nalati + Nine. M2 = grid from the menu, seamless travel, Jake's three phone runs with no tab kill (G417).
**In force:** G415–G428.

**For wildshard-v:** G427 (soften night crown shadow) → Opus o218 after the water; G428 consumed (no Claude reserve, all lanes at full pace). Resume done; x7 confirmed.
Paused rows: SF22, SF57, SF67.
