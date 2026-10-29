# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**G872 (Jake, 10-29): AUTONOMOUS BUILDER. NEVER WAIT FOR JAKE.** Picks take the recommended answer, land, and are logged
below for Jake's review with wildshard-v (an overturn becomes a new row). No idle lane while a counted row is open.

**Order:** QA rows (all archive blockers, G877/G879), then LD5-LD10 on his word (G873), then CO7 / CO8, then all stop (G845).
**Legacy (G882 / G883 / G885 / G891):** legacy-final 91a9eef081; Sky + Signal 3be88b3081, Nalati b592b94008, Driftwood next
(sp-x9). Pine + Nine keep LEGACY until Jake's QA after wave 1; LD5 / LD8-LD10 with the last.

**LIVE 8621318d93 (build 8621318d9-mvtvd1tf): Jake's QA build.** He QAs it now.
**REPLAN (G886): [FOUNDATIONS](../FOUNDATIONS.md) wave 1, crashes first (G894):** MF7 sp-o5 (memory) + sp-o3 (battery
BA-1/2/3/7/8) + sp-o4 BA-6 + sp-x1 BA-4/5; MF6 sp-x1; MF10 / G888 then G895 sp-x2; MF1 + QB21 sp-x10, MF2 sp-x2, MF3 done,
MF4 sp-x6, MF5 sp-o3. Open: QB15 / QB18 sp-o4, GAME-S / QB19 sp-o3, QB20 sp-o5. G892: open until wave 1 + Jake's QA.

**Done today:** Nine + Far Reach archived, G548, CO1-CO5, PL6, QA1-QA14, D196-D207; QB2/7/8/10/14, RL2-5/9/10.

**Autonomous decisions (for Jake's review):**
- MF3 met: launch image → title 0.7 s warm on the Sim, ~0.5 s of it iOS starting the web app before our page
  navigates (page share 0.16 s, 6e4e5e6817); not reducible in the page.
- Earlier calls (D183, D185, PL15, PL16, QA3-QA8): see this file's git log.
- QB11 crossbow spring substep on Codex sp-x6: 60 fps bit-identical, so no look change.
- SW / manifest rows (RL7-9, MF1 / MF2 / MF4) on Codex: no pixels (G848 keeps the SW on Codex).
- **For wildshard-v (QB1, RL3 48492f221e):** Sim warm launch image 0.6 s → title 1.2 s, nothing else. iOS snapshots the
  launch image at install; Jake's icon predates it (10-24), so tell him once: delete + re-add the icon. The first cold
  launch after this deploy still shows the old UPDATING cover once (old worker), never again.
- New QA build for Jake asked of sp-ci-deploy: he was reporting bugs already fixed on main (QB7 14:19).
- hud.perf world.impacts on Codex sp-x1: read-only count, FX untouched (4718a3fabd).
- RL10: grid New game keeps its road-resume reload; standalone New game → title (1ec09517d4).
- QB10: lanes have no Sentry credential, so sp-x1 triages from the row + /api/errors and lists issue → verdict → SHA in
  its commit; **wildshard-v resolves them in Sentry** from that list. **wildshard-v: please add all 40 issue ids + titles
  to the QB10 row** (only 7 are listed; sp-x1 can't read Sentry).
- 8 D53 generator-imports sites baselined with approvals (dd32fad4b0), not rewritten.
- families-board retired (3e9937f146); D53 debt; Pine pond, G99 isles kept; Pine drive (D12) under G815; D206 damage list.
- Spike section 3 taken (P1-P6, Q1-Q5, C1-C4, N1, F1, T1, L3-L6; X1 / X2 after the retro; DA1 / PF1 sent, G874).

**Rules:** G704, G807, G828, G844, G846, G848, G853, G858. No reverts (G674), no new Debug rows (G669), never herdr wildshard-v.
