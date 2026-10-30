# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**G872 (Jake, 10-29): AUTONOMOUS BUILDER. NEVER WAIT FOR JAKE.** Picks take the recommended answer, land, and are logged
below for Jake's review with wildshard-v (an overturn becomes a new row). No idle lane while a counted row is open.

**Legacy (G882 / G883 / G885 / G891):** legacy-final 91a9eef081; Sky + Signal 3be88b3081, Nalati b592b94008, Driftwood
019fa6d0c7. **G908: Pine + Nine untouched** (no prep) until Jake's word after his final QA, likely 10-30.

**LIVE 125bda048-mvu1h3gt** (code ~13:43); 9561743057 deploys the moment CI + six are green (CI3: every proven build ships).
**[FOUNDATIONS](../FOUNDATIONS.md):** done MF1-MF10 (MF7 memory), MF13 (Debug), MF14-MF17, MF19, CX1-CX3; FC1-FC14 done or closed.
Open: MF11 footprint, MF12 Sentry, MF18 (o3 Driftwood, o4 Nalati / Sky), MF20, FC15 (o5). **[CI](../CI-FIRST-PRINCIPLES.md):**
CI1-CI4 done (CI2 / CI3 await first deploy), CI5 x9, CI6 / CI7 / CI9 x2, CI8 x9, CI10 x10, CI11-CI13 x1, CI14 x6.
**For wildshard-v (21:25):** 1fe838b24a carries every 72cd fix incl. the grid wake P0 (4779bbdd6f) and ships when green. sp-o4 is not idle: it cuts engine scene-walk CPU (the one missed frame bar); QB16 / MF19, QB20 Sim, FC9 and QS1 are all done. **G924:** FOUNDATIONS / frame-cost / QA → CX → CI last; no Codex row outranks CI now. **G925: sp-x8 helps sp-ci-deploy. G926: 5 building Codex; sp-x10 retires (CI12 → sp-x9, phone checks → sp-x2).** For Jake: MF13 'Refine dither' needs his phone check;
QB17 zip video tmp/sp-o3-mf15/qb17-zip-before-after.mp4.

**Autonomous decisions (for Jake's review):**
- CPU bar (Sim WebContent ≤ 15 %, now ~22 %): engine walk and per-draw cuts are near their exact limit; viewmodel merge = 1 draw, shadow casters = 0 exact. **For wildshard-v / Jake:** Pine's last ~7 % needs fewer draws (look trade); sp-o5 builds a default-off Debug 'Draw budget: current / lean' + board for his phone pick.
- P0 found by CI: the grid could stop drawing after a crossing (a cached frame gate held async readiness, ca0c7c8b60); fixed 4779bbdd6f (x1).
- Finding (CI13): headless SimHost motor constants differ from the client Player's (radius / step / climb / snap); play unchanged.
- FC12 closes at identical captures (Pine 184, Driftwood ~194 draws).
- QB17 (b): LEGACY's zip is flat too (31 hooks, identical floors); new default rises to the ring per Jake's ask, flat kept as Debug 'Hook zip' (o3).
- FC10 closed (Nine 7 real switches, Nalati 4 passes; phone bloom off, Debug 'Phone bloom'); FC13 at its Debug row; MF11 on lease deletion + footprint.
- **For wildshard-v (QB1):** Jake's home-screen icon predates the launch image; one delete + re-add of the icon fixes the black.
- QB10 / MF12: Sentry verdicts in e74ca75809; S fixed b3b1723a9a, 7S fixed cc75f528ea + 93cf905edc. **wildshard-v: Sentry-only ids need a build + stack.**

**Rules:** G704, G807, G828, G844, G846, G848, G853, G858. No reverts (G674), no new Debug rows (G669), never herdr wildshard-v.
