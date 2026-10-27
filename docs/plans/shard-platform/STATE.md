# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Order (G639):** (1) live reds → (2) NALATI 0 → (3) grid / frame floor → extras.

**(1) LIVE 59a595ab10** (the 06:24Z scheduled deploy and the hourly backstop both found nothing newer that passed CI;
sp-ci-deploy is driving one green). G769 MEGA BUILD: every mini plan done; land on types + lint; G768 gate (45 s
fail-open, 5 s pre-commit, no red hold). sp-ci-deploy (wT:pE) keeps CI green + deploys (G802). G801 5-min lane sweep.
**Damage list:** only in [BURN-DAMAGE-LIST](../BURN-DAMAGE-LIST.md); never listed here.

**(2) NALATI 0 done (27dd969127).** HOST-AUDIT (G679) parked until every mini plan finishes. Legacy waits (G606).

**(3) Frame floor:** G717 48/48 latches; official quiet Sim 11/15 on 93514, after 12/15 on 878846e. Readings come
once per plan at the end (G780); official Simulator readings last (G777).

**Memory (G682: Template <= 198.5 MiB):** native Template 268 / 246 MiB ratcheted (C4, G781).

**For wildshard-v (G711):** generation catalogue **empty** (dd873bc775, ~10:30Z; was 41 / 41 / 61 / 38 jobs);
`generation-jobs.json` deleted, GR12 tail sp-x1 + sp-x9. Every product builds under its phone ceiling (Nalati 93.5 /
96.3, Pine 110.5 / 112.2, Nine 160.3 / 210.2 after I3). D96 / D97 / D103 / D106 fixed. **Plan-end readings
are running (G780):** tile 12 spawn rows (sp-x2), heap / loading (sp-x9: G1 pass, D107-D109 misses), Night Market
(sp-o4: RM14 done, RM5 palette D111 and RM10 life D112 open), T3 draws within 10 % and walk 0 stuck (sp-o1), Pine T8
(sp-o5), Nine T8 via T3 (sp-o3), I3 Nine -6.44 MB br (sp-o2). **Long pole: G782 crossings** miss badly (DW 13-17 s,
Sky 20-27 s, Pine 35 s cold, warm refused, against 5 / 8 s): sp-x8 Pine + DW, sp-x10 Sky, sp-o4 shaders. Also D24 vite/
files sp-o5, Nine memory banner sp-o3, iphone reading sp-x6. Counter 146 / 209 = 70 %.
**Blocked on Jake:** road B pilot play; boards as they land; LD5-LD8 / A1 / A2 / M2 / RM13 (counted, G779).

**Lanes (G735 overrides the G605 step-down; Claude active 58 %, Codex 68 %):** 5 Opus (sp-o1..o5) + 6 Codex (sp-x1,
x2, x6, x8, x9, x10) + sp-ci-deploy (CI / deploy / reds, no cancels). origin/main d6738df69a; CI generation passes
now, the --all source guard is the next red (D114-D117, routed).

**Rules:** G704 (<= ~20 files/move commit). G605. Fix forward, no reverts (G674). No new Debug rows (G669). G670.
Never herdr wildshard-v.
