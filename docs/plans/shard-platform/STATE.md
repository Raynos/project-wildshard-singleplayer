# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**G872 (Jake, 10-29): AUTONOMOUS BUILDER. NEVER WAIT FOR JAKE.** Picks take the recommended answer, land, and are logged
below for Jake's review with wildshard-v (an overturn becomes a new row). No idle lane while a counted row is open.

**Order:** QA rows (all archive blockers, G877/G879), then LD5-LD10 on his word (G873), then CO7 / CO8, then all stop (G845).
**Legacy (G882 / G883 / G885):** legacy-final on 91a9eef081; Sky + Signal retired 3be88b3081; Nalati next (sp-x9).
Driftwood, Pine, Nine wait for Jake shard by shard; LD5 / LD8-LD10 with the last.

**LIVE 8621318d93 (build 8621318d9-mvtvd1tf): Jake's QA build.** He QAs it now.
**[qa-2026-10-29-2](qa-2026-10-29-2-mini-plan.md) (G879):** open QB5 / QB11 / DA-1-3 / NP-5 sp-x6; QB6 / QB12 / QB16 (NP-1-4) /
DA-7 sp-o5; QB7 proof / QB8 / QB17 / QB15 / QB18 sp-o4; QB10 / QB14 sp-x1; QB13 / RL8 sp-x2; RL4 / RL5 / RL1 / RL6 / DA-5 / DA-6 /
GAME-S / QB19 sp-o3; RL7 / DA-4 sp-x10. Spikes: download-audit, nine-popin (G884).

**Done today:** Nine + Far Reach archived (44c51cc4ac), G548 build speed, CO1-CO5, PL6, QA1-QA14, D196-D207.

**Autonomous decisions (for Jake's review):**
- Earlier: D183 B, D185 both paths, PL15 A, PL16 off, QA7 / QA8 / QA6 / QA3 calls (see git log of this file).
- QB11 (crossbow NaN draw) on Codex sp-x6: the Pine spring blows up below ~30 fps; substep fix only if 60 fps stays bit-identical (else Opus).
- RL7-RL9 (warm refetch, chunk hashes, persist) on Codex: SW caching changes no pixels (G848 keeps the SW on Codex).
- **For wildshard-v (QB1, RL3 48492f221e):** Sim warm launch image 0.6 s → title 1.2 s, nothing else. iOS snapshots the
  launch image at install; Jake's icon predates it (10-24), so tell him once: delete + re-add the icon. The first cold
  launch after this deploy still shows the old UPDATING cover once (old worker), never again.
- New QA build for Jake asked of sp-ci-deploy: he was reporting bugs already fixed on main (QB7 14:19).
- RL10: grid New game keeps its road-resume reload (it resumes by design); standalone New game goes to the title (1ec09517d4, o4).
- QB10: lanes have no Sentry credential, so sp-x1 triages from the row + /api/errors and lists issue → verdict → SHA in
  its commit; **wildshard-v resolves them in Sentry** from that list. **wildshard-v: please add all 40 issue ids + titles
  to the QB10 row** (only 7 are listed; sp-x1 can't read Sentry).
- 8 D53 generator-imports sites (Nine 2, Pine 6) go in the ratchet baseline with approvals (sp-ci-deploy), not rewritten.
- families-board retired (3e9937f146); D53 debt; Pine pond, G99 isles kept; Pine drive (D12) under G815; D206 damage list.
- Spike section 3 taken (P1-P6, Q1-Q5, C1-C4, N1, F1, T1, L3-L6; X1 / X2 after the retro; DA1 / PF1 sent, G874).

**Rules:** G704, G807, G828, G844, G846, G848, G853, G858. No reverts (G674), no new Debug rows (G669), never herdr wildshard-v.
