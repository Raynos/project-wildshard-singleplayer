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
warm solved** by last-cell retention (~0.03-1 s, < 1.2 GB); Sky rebuild look fixed (f808697807). **Sky passes both
bars** (7.58 s cold / 35.5 ms warm). Cold over 8 s: DW 11.8 (sp-x8 + sp-x10), Nalati ~15 (sp-o5 hooks), Pine 18.3
(no Pine-side lever left; needs Jake's D178 / D181). Official quiet Sim frame floor 10 / 15 (T10, sp-o4 cutting:
spawn p95 81 ms, one 224 ms template-return frame, Pine / Nalati drive 36-43 ms). Jake picks: D175 / D178 / D179 /
D181 / D183. Plans: generators 94 %, loading 94 %, tile-streaming 83 %, shared-waits 85 %, grid-crossing 70 %,
iphone-downloads 58 % (I2 left; DW phone 14.9 MB, Nalati 71.8 -> 67.5 MB), legacy 50 % (Jake), ci-flow 40 % (CF3 13
min). js-heap 100 % archived. Counter 177 / 209 = 85 %. CI: every known source red has a qualified fix; the last
blocker is the GS5 post-publication check (sp-x1); live still 59a595ab10.
**15:25 reply:** (1) end readings ordered now: loading H3 / H4 / A1 (sp-x9), grid-crossing T2-T4 (sp-x8), GR10
(sp-x1), tile T6 / T7 (sp-o5); T10's official reading is in (10 / 15, sp-o4 + sp-o5 cutting). A miss keeps its row open
with the number. (2) sp-x2 is already on I2 with sp-o3; I7, I10, I11 are done (iphone 58 % -> only I2 + I3 parts left).
**Blocked on Jake:** road B pilot play; boards as they land; LD5-LD8 / A1 / A2 / M2 / RM13 (counted, G779).

**Lanes (G804 / G805; G803 3 Opus; Claude 80 %, Codex 96 % on credits):** sp-o3 iphone-downloads (+ sp-x2), sp-o5
tile-streaming + T7 Nalati, sp-o4 T10 frame floor, sp-x8 + sp-x10 grid-crossing DW, sp-x9 loading, sp-x6 ci-flow + GM1,
sp-x1 generators, sp-ci-deploy CI reds only. sp-o1 / sp-o2 released.

**Rules:** G704 (<= ~20 files/move commit). G803. No reverts (G674). No new Debug rows (G669). G670.
Never herdr wildshard-v.
