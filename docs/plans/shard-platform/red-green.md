# SHARD-PLATFORM — red → green log (G330; coordinator-written)

Each push-queue, GitHub CI or deploy red: the failing check, the culprit, the fix and the owner lane. sp-x7 reports each
one to the coordinator; only the coordinator writes this file.

| Date | Red | Culprit | Fix | Owner |
|---|---|---|---|---|
| 2026-10-11 | local gate: row-data JSON export | `255dd529c` | `b4a36e751` | sp-x4 |
| 2026-10-11 | Linux CI bake-check: Nine physics bytes | `669511341` | `baa8a3165` (verified on Linux CI 38139754563) | sp-x7 |
| 2026-10-11 | Linux CI bake-check: Nalati places specimens | `27b0d8da1` | `baa8a3165` + `0f0fa888d` (verified on Linux CI 38139754563) | sp-x7 |
| 2026-10-11 | local gate: typecheck-layers TS6307 | `baa8a3165` | `0f0fa888d` | sp-x7 |
| 2026-10-11 | local gate: Signal TS4023 | `e16d4119e` | `2ce849ed3` | sp-x4 |
| 2026-10-11 | admin-deploy: missing module + stale reader | `0e9cb9801`, `b34239411` | `e8574fbb8` | sp-x7 |
| 2026-10-11 | push: unapproved Signal standalone shard-game-plugins 0 → 2 | `f06f3eea9` | `02b4a2dfa` (receipt) | sp-x4 |
| 2026-10-11 | local gate: typed oxlint, Driftwood brain switches non-exhaustive | `33511c931` | `ea1c22453` | sp-x6 |
| 2026-10-11 | local gate: Sky TS2883 SKY_SPECIES_BRAINS inferred type | `f1a096bf1` | `d10d4a1b3` | sp-x6 |
| 2026-10-11 | deploy: release selected before an in-flight exact-SHA smoke (12:47 no-op) | `3b509cff0` | `7ed48b955` | sp-x7 |
| 2026-10-11 | local gate: Driftwood physics bake stale after a source edit | `ea1c22453` | `edd01ddce` (rebake) | sp-x5 |
| 2026-10-11 | detached commit-ratchet: false sim-no-render red on Sky isletLift | `5985020fe` | `c4b6aca04` | sp-x6 |
| 2026-10-11 | push: unapproved Signal skitterer generator-imports 0 → 3 | `79422f721` | `f3c23cb49` (receipt) | sp-x6 (row filed by sp-x7) |
| 2026-10-11 | push: E476 commit-msg hook refuses the pusher's legacy regeneration messages | `95cd3e37a` | `47b53311b` | wildshard-new / sp-x7 |
