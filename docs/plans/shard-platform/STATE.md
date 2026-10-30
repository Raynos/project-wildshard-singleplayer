# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**G872 (Jake, 10-29): AUTONOMOUS BUILDER. NEVER WAIT FOR JAKE.** Picks take the recommended answer, land, and are logged
below for Jake's review with wildshard-v (an overturn becomes a new row). No idle lane while a counted row is open.

**Legacy (G882 / G883 / G885 / G891):** legacy-final 91a9eef081; Sky + Signal 3be88b3081, Nalati b592b94008, Driftwood
019fa6d0c7. **G908: Pine + Nine untouched** (no prep) until Jake's word after his final QA, likely 10-30.

**LIVE 125bda048-mvu1h3gt.** 00:30 fallback of 2b62556596 failed in the controller (gh compare > 1 MB, ENOBUFS); sp-x2 fixes it and it redispatches; CI2 packaging fixed f3dcc64710.
**Open:** MF7 battery (phone), MF12 / QS3 Sentry (wildshard-v), MF20 CPU bar (Jake's pick), FC9 (o5), QB20 thermal (phone), CI2 / 3 / 5 / 6 / 7 / 9 / 10
remote acceptance, CI12 Nalati (x6, x8, kernels o3 / o4), CI14 pin waves. For Jake: MF13 'Refine dither' phone check; QB17 zip video
tmp/sp-o3-mf15/qb17-zip-before-after.mp4.

**00:35 (wildshard-v):** sweep cron e7a1a5d2 still runs every 5 min (G927; watchdog EXEMPT trimmed 09fdb1516c). Opus now hold whole rows: o3 QB16 recheck, o4 QB20 + MF7 battery (20 min Sim), o5 full Jake-QA recheck; QB16 / QB17 / RL7 marked **done**. **23:50:** my 5-min lane sweep cron (e7a1a5d2) has run all night. The 23:21-23:46 idle was my call: I judged their rows done and had no Opus row to give, and the plans marked done only in the lane cell, so wildshard-v counted 29 open rows. Fixed: 41 finished rows now carry **done**, and all 5 idle lanes have rows with 'take the next open row without waiting'. scripts/lane-watchdog.mjs (G418) hasn't run since its pane went (≥6 days); the cron replaces it.

**Autonomous decisions (for Jake's review):**
- 2b62556596 is fully green; CI2 prebuilt packaging lacks @vercel/blob. If not fixed by ~00:30, ship 2b62 via the pre-CI2 deploy workflow once.
- Player bug found by CI12: after dying in her storm phase, Signal's Matriarch flew off the map on retry (script restarted at step 0 only); fixed ddb75a9d0a (o3, board art/signal-matriarch-retry/).
- **For wildshard-v / Jake (pick):** Debug 'Draw budget' (da65599389, board 6123924204): Lean = 166 → 149 draws, Chromium 4x Pine 18.9 → 16.3 ms, but Sim WebContent stays ~22 %; it thins distant trees / nearer shadows. Recommend Current. The 15 % WebContent bar isn't reachable by exact or draw cuts; Jake decides the bar.
- P0 found by CI: the grid could stop drawing after a crossing (a cached frame gate held async readiness, ca0c7c8b60); fixed 4779bbdd6f (x1).
- **For wildshard-v (QB1):** Jake's home-screen icon predates the launch image; one delete + re-add of the icon fixes the black.
- QB10 / MF12: Sentry verdicts in e74ca75809; S fixed b3b1723a9a, 7S fixed cc75f528ea + 93cf905edc. **wildshard-v: Sentry-only ids need a build + stack.**

**Rules:** G704, G807, G828, G844, G846, G848, G853, G858. No reverts (G674), no new Debug rows (G669), never herdr wildshard-v.
