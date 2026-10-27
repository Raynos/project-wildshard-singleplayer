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
96.3, Pine 110.5 / 112.2, Nine 160.3 / 210.2 after I3). D74 / D82 / D92 / D93 / D96 fixed. Built, readings at plan
end: tile T3 (sp-o1 + sp-o5), T6.2 lease (sp-o3), T7 (sp-x8), crossings T2 (sp-o4, d10303ddee), open-plot T8 L1 (2
draws, 40 debt rows out), Pine / Sky / Nine T8. Now: plan-end readings on the first HEAD preview after D96 (sp-x2
tile script); D12 frame floor sp-o4; D13 sp-x8; D24 vite/ files sp-o5; I3 sp-o2. Counter 139 / 209 = 67 %.
**Blocked on Jake:** road B pilot play; boards as they land; LD5-LD8 / A1 / A2 / M2 / RM13 (counted, G779).

**Lanes (G735 overrides the G605 step-down; Claude active 54 %, Codex 64 %):** 5 Opus (sp-o1..o5) + 6 Codex (sp-x1,
x2, x6, x8, x9, x10) + sp-ci-deploy (CI / deploy / reds, no cancels). origin/main 1361eb295e; its CI red in
generated-inputs (build-shardfiles), sp-ci-deploy.

**Rules:** G704 (<= ~20 files/move commit). G605. Fix forward, no reverts (G674). No new Debug rows (G669). G670.
Never herdr wildshard-v.
