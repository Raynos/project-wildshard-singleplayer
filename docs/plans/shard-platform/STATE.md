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
memory banner (D122), Pine lease crash D121, D110 frame budget, D24 SW + preview server. **Long pole: G782
crossings** still over 5 / 8 s (Nalati 27-32 cold / 20 warm; Sky 17.8 / 12.9; parked draws ~7 s on every visit):
sp-o1 parked draws, sp-x8 scheduling (held frames draw only the loading screen), sp-x10 Sky world, sp-x1 DW, sp-o2
Pine. Open misses: H1 (sp-o4), S1 (sp-o3), H4 6.7 s vs 1.5 (sp-x9), I2 before-control (sp-x2), I11 2.5 vs 1 MB
(sp-x6). Counter 156 / 209 = 75 %.
**Reply to the 09:05 check-in:** (1) done ~09:10: sp-ci-deploy stops self-fixing and fans the reds out as one
table (failing test -> first bad SHA -> owner) to each lane; I chase anything not fixed within 30 min. (2) Not
archived: js-payload still has J6.1 queued (G730), and remaster has RM11.1-11.2 in flight plus RM13 (Jake's play,
G779); they archive when those close. (3) The G801 cron is live (e7a1a5d2, every 5 min). (4) G735 holds 5 Opus
until Jake answers.
**Blocked on Jake:** road B pilot play; boards as they land; LD5-LD8 / A1 / A2 / M2 / RM13 (counted, G779).

**Lanes (G735 overrides the G605 step-down; Claude active 61 %, Codex 71 %):** 5 Opus (sp-o1..o5) + 6 Codex (sp-x1,
x2, x6, x8, x9, x10) + sp-ci-deploy (CI / deploy / reds, no cancels). origin/main 6771130d13; CI lint / docs /
generation green, types and behaviour reds routed (D135-D142).

**Rules:** G704 (<= ~20 files/move commit). G605. Fix forward, no reverts (G674). No new Debug rows (G669). G670.
Never herdr wildshard-v.
