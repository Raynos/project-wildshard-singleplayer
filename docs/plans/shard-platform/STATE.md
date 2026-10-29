# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**G872 (Jake, 10-29): AUTONOMOUS BUILDER. NEVER WAIT FOR JAKE.** Picks take the recommended answer, land, and are logged
below for Jake's review with wildshard-v (an overturn becomes a new row). No idle lane while a counted row is open.

**Order:** QA rows (all archive blockers, G877/G879), then LD5-LD10 on his word (G873), then CO7 / CO8, then all stop (G845).
**Legacy (G882 / G883 / G885 / G891):** legacy-final 91a9eef081; Sky + Signal 3be88b3081, Nalati b592b94008, Driftwood
019fa6d0c7. **G908: Pine + Nine untouched** (no prep) until Jake's word after his final QA, likely 10-30.

**LIVE 125bda0483 (build 125bda048-mvu1h3gt, a normal proven release, ~16:20)**; the repaired QA build waits on CI.
**REPLAN (G886): [FOUNDATIONS](../FOUNDATIONS.md); overnight G914-G917.** Done: MF2, MF3, MF5, MF6, MF7 memory, FC1-6, FC8,
QS2, G895, G896, G901, QB18; MF1 / MF4 / MF10 landed, proofs open. Opus (G915, 3 lanes held G916): sp-o3 FC12, sp-o4 QB19 → QS1 →
FC14 → FC13, sp-o5 FC9 → FC10 → FC15. Codex: sp-x1 MF9, sp-x2 FC11 → MF12, sp-x6 MF4 → CX1, sp-x9 MF8 → CX3, sp-x10 MF10 →
CX2. **sp-x8 stays released: 5 Codex lanes building is the cap (G611).** 07:00 release for Jake (G917). G892: open to 10-30 QA.

**Done today:** QA1-14, CO1-5, QB2/7/8/10/14/15/18, RL2-5/9/10.

**Autonomous decisions (for Jake's review):**
- MF3 met: launch image → title 0.7 s warm on the Sim, ~0.5 s of it iOS starting the web app before our page
  navigates (page share 0.16 s, 6e4e5e6817); not reducible in the page.
- Earlier calls (D183, D185, PL15, PL16, QA3-QA8): see this file's git log.
- Codex took QB11 (spring substep, 60 fps bit-identical) and hud.perf (read-only count): no pixels.
- SW / manifest rows (RL7-9, MF1 / MF2 / MF4) on Codex: no pixels (G848).
- **For wildshard-v (QB1, RL3 48492f221e):** Sim warm launch image 0.6 s → title 1.2 s, nothing else. iOS snapshots the
  launch image at install; Jake's icon predates it (10-24), so tell him once: delete + re-add the icon. The first cold
  launch after this deploy still shows the old UPDATING cover once (old worker), never again.
- New QA build asked of sp-ci-deploy: Jake was reporting already-fixed bugs (QB7 14:19).
- QB18 = B: Nalati TRUST as a status row under GRASS (A crossed the minimap, C the toast; fc707ba74d, o4).
- QB10: sp-x1 walks the 60 ids (0dd5f3060e) in MF12; wildshard-v resolves them. **wildshard-v: for Sentry-only ids with
  no inbox stack (e.g. 7R, 6Y, 6X, 6W) add one event's build + stack to the row**; titles can't justify a fix.
- families-board retired (3e9937f146); D53 debt; Pine pond, G99 isles kept; Pine drive (D12) under G815; D206 damage list.
- Spike section 3 taken (P1-P6, Q1-Q5, C1-C4, N1, F1, T1, L3-L6; X1 / X2 after the retro; DA1 / PF1 sent, G874).

**Rules:** G704, G807, G828, G844, G846, G848, G853, G858. No reverts (G674), no new Debug rows (G669), never herdr wildshard-v.
