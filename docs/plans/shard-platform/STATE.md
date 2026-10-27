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
`generation-jobs.json` deleted. Every product builds under its phone ceiling. Met today: RM5 / RM10, H10, J6, H2,
T11, T3, D122, D121, D110, D24, H1, I11, D152 (Simulator-proven fence raise), D154 NaN blocks. **G782 crossings:
warm solved** by last-cell retention (~0.03-1 s, < 1.2 GB). **Sky passes both bars** (7.58 s cold / 35.5 ms
warm, f782e7ebab). Cold over 8 s: DW 16.5 (sp-x8 + sp-x10), Nalati 19.4 (sp-o5), Pine 18.3 (sp-o4 afterPlay
budget); held view >= 30 fps. Jake picks: D175 / D178 / D179 / D181 + Sky retention A / B. Closed as misses: S1
(D176), I1 (26 MB target moved to I3; I3 now measured on real brotli wire). js-heap 100 % archived; I7 / I10 / I12
done (iphone 10 / 12). Open: H4 (sp-x9), I2 (Pine 140 MB raw / 404 req; sp-o3 + sp-x2). Counter 171.5 / 209 = 82 %.
CI: every known red routed to its breaker or taken by sp-ci-deploy as G754 backup; live still 59a595ab10.
**12:15 reply:** SW12 done (sp-x10). Codex runs past 100 % on credits (G590). G806 applied. Awaiting-reading list:
[finish-line](finish-line.md#landed-awaiting-the-plan-end-reading-g780-1120-cancun-10-27).
**Blocked on Jake:** road B pilot play; boards as they land; LD5-LD8 / A1 / A2 / M2 / RM13 (counted, G779).

**Lanes (G804 / G805; G803 3 Opus; Claude 76 %, Codex 89 % on credits):** sp-o3 iphone-downloads (+ sp-x2), sp-o5
tile-streaming + crossing T7, sp-o4 grid-crossing Pine (js-heap done), sp-x8 grid-crossing (+ sp-x10), sp-x9 loading,
sp-x6 ci-flow + GM1, sp-x1 generators, sp-ci-deploy CI reds only. sp-o1 / sp-o2 released.

**Rules:** G704 (<= ~20 files/move commit). G803. No reverts (G674). No new Debug rows (G669). G670.
Never herdr wildshard-v.
