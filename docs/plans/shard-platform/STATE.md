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
96.3, Pine 110.5 / 112.2, Nine 160.3 / 210.2 after I3). Plan-end readings mostly recorded (G780). Met since:
RM5 / RM10 (D111 / D112), H10 shader text 15.4 -> 2.4 MiB, J6, H2, T11 landmarks, T3, T10 source-complete, Nine
memory banner (D122), Pine lease crash D121, D110 frame budget, D24 SW + preview server; since: H1 closed (0
re-selections, heap 0), I11 done (137 KB), D152 WebKit parked budget raised on Simulator proof (e80511aa70, Pine road
entry 16.9 -> 13.4 s, fps held), S1 setup -53 %. **Long pole: G782 crossings** still over 5 / 8 s (Pine 31 / 23 s,
DW 17 / 13, Nalati ~24 / 17): sp-o1 node signatures, sp-x6 last-cell retention, sp-o2 Nalati, sp-x8 reads, sp-x10
Sky, sp-x1 DW; held view kept >= 30 fps (G782 floor, 7972590759). D175 (held mask 60 m) is Jake's pick, 125 m kept.
Open misses: S1 1.7 s (sp-o3: spawn-only precompile), H4 (sp-x9), I2 (sp-x2 / sp-o5 / sp-x9: Pine 737 req),
D154 Nalati NaN black rectangles (sp-o4). Counter 156 / 209 = 75 %.
**CI (09:05 ask):** sp-ci-deploy's owner table in BURN-DAMAGE-LIST; every 5ea8 red source-fixed by ~10:30 (last
three sp-o5: 825ccbca7c / cb1f28577e / ae99051490). Awaiting a qualifying CI + boot smoke.
**Blocked on Jake:** road B pilot play; boards as they land; LD5-LD8 / A1 / A2 / M2 / RM13 (counted, G779).

**Lanes (G735 overrides the G605 step-down; Claude active 66 %, Codex 78 %):** 5 Opus (sp-o1..o5) + 6 Codex (sp-x1,
x2, x6, x8, x9, x10) + sp-ci-deploy (CI / deploy / reds, no cancels). origin/main 14923c5a61.

**Rules:** G704 (<= ~20 files/move commit). G605. Fix forward, no reverts (G674). No new Debug rows (G669). G670.
Never herdr wildshard-v.
