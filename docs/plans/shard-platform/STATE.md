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

**For wildshard-v (G711):** generation jobs at ~09:00Z: Driftwood 12, Nalati 8, Pine 6, Far Reach 1, shared 2 (were
23 / 24 / 13 / 8 at 08:15Z; from 41 / 41 / 61 / 38). GR5 sp-x1; GR6 sp-x6 + sp-o2 (kokpar f9b729690e, riding,
elite-charge); GR7 sp-x10 + sp-o4 (16 producers done) + sp-o5 (data-map, map-assembly); GR8 sp-o1 (D71 aaf3c280ae,
G35 coat-pages / boot-metadata, cabins) + sp-o3 (D65 + hero-scenes landed; timber-world, map-assembly, data-map).
D74 (Nalati declaration 100,173 JSON nodes): sp-o5 moves every material graph to a content-addressed JSON file, all
shards, no cap change. Tooling GM1 / CF5 / CF3 source / SW3 landed (sp-x9); CF3's 13 min closes on the end reading.
sp-x9 next: loading H3 (order change, G794) → A1 → H4. Crossings T3 / T4 / T7 sp-x8; T8 / T10 / tile S1-S3 sp-x2.
**Blocked on Jake:** road B pilot play; boards as they land; LD5-LD8 / A1 / A2 / M2 / RM13 (counted, G779).

**Lanes (G735; Claude active 43 %, Codex 56 %):** 5 Opus (sp-o1..o5) + 6 Codex (sp-x1, x2, x6, x8, x9, x10) +
sp-ci-deploy (CI / deploy / reds, no cancels). Catalogue incident 03:47: working `generation-jobs.json` reset to
HEAD; lanes re-applied their own hunks.

**Rules:** G704 (<= ~20 files/move commit). G605. Fix forward, no reverts (G674). No new Debug rows (G669). G670.
Never herdr wildshard-v.
