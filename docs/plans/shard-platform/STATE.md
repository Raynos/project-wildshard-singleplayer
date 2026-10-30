# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**G872 (Jake, 10-29): AUTONOMOUS BUILDER. NEVER WAIT FOR JAKE.** Picks take the recommended answer, land, and are logged
below for Jake's review with wildshard-v (an overturn becomes a new row). No idle lane while a counted row is open.

**Legacy (G882 / G883 / G885 / G891):** legacy-final 91a9eef081; Sky + Signal 3be88b3081, Nalati b592b94008, Driftwood
019fa6d0c7. **G908: Pine + Nine untouched** (no prep) until Jake's word after his final QA, likely 10-30.

**LIVE 125bda048-mvu1h3gt** (code ~13:43); 9561743057 deploys the moment CI + six are green (CI3: every proven build ships).
**[FOUNDATIONS](../FOUNDATIONS.md):** done MF1-MF10 (MF7 memory), MF13 (Debug), MF14-MF17, MF19, CX1-CX3; FC1-FC14 done or closed.
Open: MF11 footprint, MF12 Sentry, MF18 (o3 Driftwood, o4 Nalati / Sky), MF20, FC15 (o5). **[CI](../CI-FIRST-PRINCIPLES.md):**
CI1-CI4 done (CI2 / CI3 await first deploy), CI5 x9, CI6 / CI7 / CI9 x2, CI8 x9, CI10 x10, CI11-CI13 x1, CI14 x6.
**For wildshard-v (20:25):** 083d's reds are routed and mostly fixed: docs 9d28656aef (x1), boot-smoke fa13b9fce6 (x2); the 11 CI5 fixture reds are sp-x9's top job now. sp-o5 is running FC15 (not idle, until ~21:00); sp-o4 finished QB16 / MF19, QS1, FC12-14, MF16-18 Pine / Nine / Nalati / Sky verbs, and waits on FC15 for the MF20 board. **G924:** FOUNDATIONS / frame-cost / QA → CX → CI last; no Codex row outranks CI now. **G925: sp-x8 reactivated as sp-ci-deploy's red-test helper tonight (Jake named it).** For Jake: MF13 'Refine dither' needs his phone check;
QB17 zip video tmp/sp-o3-mf15/qb17-zip-before-after.mp4.

**Autonomous decisions (for Jake's review):**
- Finding (CI13): headless SimHost moves with radius .35 / step .3 / climb 45° / snap .2, the client Player .38 / .35 / 40° / .3; the Node walk uses the client's, nothing changed in play.
- FC12 closes at identical captures (Pine 184, Driftwood ~194 draws); no default-off look trades, they cut nothing by default.
- QB17 (b): LEGACY's zip is flat too (31 hooks, identical floors); new default rises to the ring per Jake's ask, flat kept as Debug 'Hook zip' (o3).
- FC10 closes with Nine at 7 real render-target switches (folding its display + FXAA risks its opacity events; o5).
- MF11 closes on the lease deletion + footprint; ownership loans fold into Family 4.
- FC13 done at G912's default-off Debug row (shadow hold, Driftwood 190 → 165 draws); held post only if Jake turns it on.
- FC10: phone bloom off by default; old look = Debug 'Phone bloom' (G910).
- **For wildshard-v (QB1):** Jake's home-screen icon predates the launch image; one delete + re-add of the icon fixes the black.
- QB18 = B, TRUST under GRASS (fc707ba74d).
- QB10 / MF12: Sentry verdicts in e74ca75809; S fixed b3b1723a9a, 7S fixed cc75f528ea + 93cf905edc. **wildshard-v: Sentry-only ids need a build + stack.**

**Rules:** G704, G807, G828, G844, G846, G848, G853, G858. No reverts (G674), no new Debug rows (G669), never herdr wildshard-v.
