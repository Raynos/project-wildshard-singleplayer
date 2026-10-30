# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**G872 (Jake, 10-29): AUTONOMOUS BUILDER. NEVER WAIT FOR JAKE.** Picks take the recommended answer, land, and are logged
below for Jake's review with wildshard-v (an overturn becomes a new row). No idle lane while a counted row is open.

**Legacy (G882 / G883 / G885 / G891):** legacy-final 91a9eef081; Sky + Signal 3be88b3081, Nalati b592b94008, Driftwood
019fa6d0c7. **G908: Pine + Nine untouched** (no prep) until Jake's word after his final QA, likely 10-30.

**LIVE 2b62556-mvuk0s65 (00:52 Cancun; source 2b62556596, fully green CI 40998533769).** Next green SHA auto-ships; G917's 07:00 refresh stays. Native Escape now passes warmed on Linux (9052d50ac2); Pine / Driftwood story timeouts on CI are the last reds (x9 / x1).
**Open:** MF7 battery (phone), MF12 / QS3 Sentry (wildshard-v), MF20 CPU bar (Jake's pick), FC9 (o5), QB20 thermal (phone), CI2 / 3 / 5 / 6 / 7 / 9 / 10
remote acceptance, CI12 Nalati (x6, x8, kernels o3 / o4), CI14 pin waves. **QA recheck on HEAD (o5, 95196a14db + QB12 app switch b6b19d5095): every QB row passes, no regressions, QB16 too.** For Jake: MF13 'Refine dither' phone check (ready: Sim Nine dither-on longest loader frame 110 ms, was 2.25 s; 9165621261); QB17 zip video
tmp/sp-o3-mf15/qb17-zip-before-after.mp4.

**02:35:** Opus on the CI reds' engine side (o3 phone Driftwood entry, o4 Pine story ticks, o5 DW story ticks), Codex keeps the test side. **00:35:** sweep cron e7a1a5d2 runs every 5 min (G927; watchdog EXEMPT trimmed 09fdb1516c). Opus now hold whole rows: o3 QB16 recheck, o4 QB20 + MF7 battery (20 min Sim), o5 full Jake-QA recheck; QB16 / QB17 / RL7 marked **done**. **23:50:** idle cause: plans marked done only in lane cells; 41 rows fixed, lanes re-tasked.

**Autonomous decisions (for Jake's review):**
- 00:30 fallback shipped the fully green 2b62556596 via the pre-CI2 path once (CI2 packaging then fixed f3dcc64710).
- Player bug found by CI12: after dying in her storm phase, Signal's Matriarch flew off the map on retry (script restarted at step 0 only); fixed ddb75a9d0a (o3, board art/signal-matriarch-retry/).
- **For wildshard-v / Jake (pick):** Debug 'Draw budget' (da65599389, board 6123924204): Lean = 166 → 149 draws, Chromium 4x Pine 18.9 → 16.3 ms, but Sim WebContent stays ~22 %; it thins distant trees / nearer shadows. Recommend Current. The 15 % WebContent bar isn't reachable by exact or draw cuts; Jake decides the bar.
- P0 found by CI: grid stopped drawing after a crossing; fixed 4779bbdd6f.
- QB10 / MF12: Sentry verdicts in e74ca75809; S fixed b3b1723a9a, 7S fixed cc75f528ea + 93cf905edc. **wildshard-v: Sentry-only ids need a build + stack.**

**Rules:** G704, G807, G828, G844, G848, G853, G858; no reverts (G674), no new Debug rows (G669), never herdr wildshard-v.
