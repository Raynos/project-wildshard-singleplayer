# SHARD-PLATFORM — red → green log (G330; coordinator-written)

Each push-queue, GitHub CI or deploy red: the failing check, the culprit, the fix and the owner lane. sp-x7 reports each
one to the coordinator; only the coordinator writes this file.

| Date | Red | Culprit | Fix | Owner |
|---|---|---|---|---|
| 2026-10-11 | local gate: row-data JSON export | `255dd529c` | `b4a36e751` | sp-x4 |
| 2026-10-11 | Linux CI bake-check: Nine physics bytes | `669511341` | `baa8a3165` | sp-x4 (fix by sp-x7) |
| 2026-10-11 | Linux CI bake-check: Nalati places specimens | `27b0d8da1` | `baa8a3165` | sp-x4 (fix by sp-x7) |
| 2026-10-11 | local gate: typecheck-layers TS6307 | `baa8a3165` | `0f0fa888d` | sp-x7 |
| 2026-10-11 | local gate: Signal TS4023 | `e16d4119e` | `2ce849ed3` | sp-x4 |
| 2026-10-11 | admin-deploy: missing module + stale reader | `0e9cb9801`, `b34239411` | `e8574fbb8` | sp-x7 |
| 2026-10-11 | push: unapproved Signal standalone shard-game-plugins 0 → 2 | `f06f3eea9` | `02b4a2dfa` (receipt) | sp-x4 |
