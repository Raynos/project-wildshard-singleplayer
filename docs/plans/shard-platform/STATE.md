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
bars** (7.58 s cold / 35.5 ms warm); warm passes on every crossing. Cold over 8 s: DW ~11.8 (sp-x8 + sp-x10), Nalati
~15-16 (sp-o4 shaders, G808), Pine 18.3 (needs D178 / D181). Nalati warm green ground (G784): sp-o4. Official quiet
Sim frame floor 10 / 15 (T10, now sp-o5). Jake picks: D175 / D178 / D179 / D181 / D183 / D185. Plans: generators 94 %,
loading 94 %, shared-waits 85 %, tile-streaming 83 %, grid-crossing 70 %, iphone-downloads 67 % (I2 honest status in
row: 3-12x over 12 MB; Pine 64.6 MB phone), legacy 50 % (Jake), ci-flow 40 %. Counter 178 / 209 = 85 %. CI: every
known source red has a qualified fix; awaiting a whole green run + six-leg smoke; live still 59a595ab10.
**G807-G810 applied (15:45):** a row is done on landed code + one Chromium reading by its own lane, marked at once
(G807 replaces G780; every held reading is being taken now). sp-o4 joins sp-x8 on cold crossing shaders (G808); sp-o5
owns T10's frame floor. SW3 / CF3-CF5 / GM1 / build-speed close on the first green push run (G809, sp-ci-deploy).
**Blocked on Jake:** his phone QA tonight (G810, nothing waits); LD5-LD8 / A1 / A2 / M2 / RM13 (counted, G779).

**Lanes (G804 / G805; G803 3 Opus; Claude 82 %, Codex 99 % on credits):** sp-o3 iphone + D2 heap (+ sp-x2), sp-o5
tile-streaming + T10, sp-o4 crossing shaders (G808), sp-x8 + sp-x10 grid-crossing DW, sp-x9 loading (+ sp-x6),
sp-x1 generators, sp-ci-deploy CI reds only. sp-o1 / sp-o2 released.

**Rules:** G704. G803. G807. No reverts (G674). No new Debug rows (G669). G670.
Never herdr wildshard-v.
