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

**For wildshard-v (G711):** generation jobs at ~10:10Z: **2 left**, both Nalati (admission sp-x10, elite-charge
night sp-o2); Driftwood, Pine, Far Reach and shared all at 0 (were 41 / 41 / 61 / 38). GR12 final deletion sp-x1
(lands at Nalati 0); G8 generated-JSON rule sp-x9. D74 landed (a1aa193b34 graph files, 70c01675e0 file-only wire,
no version bump); every product builds, Nalati after its wire commit (sp-o5, rule A: byte-identical moved files
only). Phone ceilings re-baselined only by bytes the phone already fetched (D82 Pine, D74 all shards); tier marker +
max-variant selection generic (sp-o3). Now: tile T3 graphical sp-o1 + sp-o5; T6.2 variant lease sp-o3; crossings
T2 shaders sp-o4, T3 / T4 / T7 sp-x8; T8 / T10 / S1-S3 sp-x2; I3 Nine sp-o2. Counter 140.5 / 210 = 67 %.
**Blocked on Jake:** road B pilot play; boards as they land; LD5-LD8 / A1 / A2 / M2 / RM13 (counted, G779).

**Lanes (G735 overrides the G605 step-down; Claude active 50 %, Codex 60 %):** 5 Opus (sp-o1..o5) + 6 Codex (sp-x1,
x2, x6, x8, x9, x10) + sp-ci-deploy (CI / deploy / reds, no cancels). origin/main 70c01675e0; CI 70c queued.

**Rules:** G704 (<= ~20 files/move commit). G605. Fix forward, no reverts (G674). No new Debug rows (G669). G670.
Never herdr wildshard-v.
