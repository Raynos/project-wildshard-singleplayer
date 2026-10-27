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
warm solved** by last-cell retention (b7d6c8b728: Sky / Pine / Nalati ~1.0 s full warm, memory 677-817 MB < 1.2 GB;
DW 11.9 s until sp-x8 / sp-x6 stop a speculative reserve evicting the kept world). **Cold** still over 8 s after the
held duty fix (18736fc479): Pine 20.7, Nalati 19.4, DW 16.5, Sky 10.6 s; owners sp-o1 Pine world, sp-o2 Nalati
world, sp-o3 shaders, sp-x1 DW, sp-x10 Sky; held view >= 30 fps. Jake picks: D175 / D178 / D179. Closed
as a miss: S1 1.6 s (D176). Open: H4 (sp-x9), I2 (Pine 100 MB / 296 product req; sp-x2 / sp-o5 / sp-x9).
Counter 157 / 209 = 75 %.
**12:15 reply:** SW12 (vitest $TMPDIR leak) is sp-x10's next row. Codex lanes keep running past 100 % weekly on
credits (G590; Jake's "$50,000 of credits ... full steam ahead"), so ~17:30 doesn't stop them. G806 applied: push
reds fall back to sp-ci-deploy, and lanes send no routine reports. Awaiting-reading list:
[finish-line](finish-line.md#landed-awaiting-the-plan-end-reading-g780-1120-cancun-10-27).
**Blocked on Jake:** road B pilot play; boards as they land; LD5-LD8 / A1 / A2 / M2 / RM13 (counted, G779).

**Lanes (G803, Jake 11:15: 3 Opus until the account hits 100 %; Claude active 70 %):** sp-o1, sp-o3, sp-o5 + 6
Codex (sp-x1, x2, x6, x8, x9, x10) + sp-ci-deploy (CI / deploy, no cancels).

**Rules:** G704 (<= ~20 files/move commit). G803. No reverts (G674). No new Debug rows (G669). G670.
Never herdr wildshard-v.
