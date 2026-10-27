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
warm solved** by last-cell retention (Sky / Pine / Nalati ~1 s full warm, < 1.2 GB); DW fixed (05 / 49de); Sky warm
still rebuilds on a71 (allocator retires it on approach: sp-o5). **Cold** over 8 s: Sky 8.7-9.4, DW 16.5, Nalati
19.4, Pine 20.7 s; owners sp-x8 (+ sp-x10) grid-crossing, sp-o5 T7 Nalati + D176 shaders; held view >= 30 fps.
Jake picks: D175 / D178 / D179. Closed as misses: S1 1.6 s (D176), I1 closed on the filter with its 26 MB target
moved to I3. Open: H4 (sp-x9: 6.0 / 5.1 s), I2 (Pine 55 MB / 146 req; sp-o3 + sp-x2). Plans: js-heap 50 %,
legacy 50 % (Jake's boundary), grid-crossing 50 %, generators 63 %, shared-waits 93 % (SW3 waits on a CI green).
Counter 144 / 184 = 78 %. CI: all known reds routed to their breaking lanes (G754); newest green + smoke candidate
is still 59a595ab10 (live).
**12:15 reply:** SW12 done (sp-x10). Codex runs past 100 % on credits (G590). G806 applied. Awaiting-reading list:
[finish-line](finish-line.md#landed-awaiting-the-plan-end-reading-g780-1120-cancun-10-27).
**Blocked on Jake:** road B pilot play; boards as they land; LD5-LD8 / A1 / A2 / M2 / RM13 (counted, G779).

**Lanes (G804 / G805; G803 3 Opus; Claude 74 %, Codex 85 % on credits):** sp-o3 iphone-downloads (+ sp-x2 helping), sp-o5 tile-streaming
(+ crossing T7), sp-o4 js-heap, sp-x8 grid-crossing, sp-x9 loading, sp-x6 ci-flow + GM1, sp-x10 shared-waits -> helping grid-crossing, sp-x1
generators, sp-x2 legacy prep (at Jake's boundary), sp-ci-deploy CI reds only. sp-o1 / sp-o2 released.

**Rules:** G704 (<= ~20 files/move commit). G803. No reverts (G674). No new Debug rows (G669). G670.
Never herdr wildshard-v.
