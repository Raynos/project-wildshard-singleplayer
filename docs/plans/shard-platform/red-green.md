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
| 2026-10-11 | local gate: brain-factory refusal tests (flyer, grazer) | `70f2b1ede` | `26eb99d50` | sp-x5 |
| 2026-10-11 | commit message swapped between concurrent commits (shared COMMIT_EDITMSG; `fc3d42c39` kept its wrong label) | — | `b87365957` (commit lock) | sp-x7 |
| 2026-10-11 | local gate: group-factory missing-port assertions | `a52097c07` | `d2754ee70` | sp-x5 |
| 2026-10-11 | local gate: map-coverage expects old map URLs | `e2bc770ab` | `dd6a2b918` | sp-x4 |
| 2026-10-11 | push: unapproved Driftwood audio/install engine imports 2 → 3 | `992fd31b1` | `84193208e` (receipt) | sp-x5 |
| 2026-10-11 | push: unapproved Signal plugin game imports / plugins 6 → 7 | `630fcca7f` | `84193208e` (receipt) | sp-x5 |
| 2026-10-11 | regeneration: nine bake freshness tests (6 physics, Driftwood quest/spots, Pine spots) | `3ab73b7e2` (x2), `630fcca7f` + `786595307` (x5) | `d1b7d0333` (recapture) | sp-x2, sp-x5 |
| 2026-10-11 | Pine physics and spots stale after a runtime/index change | `4a7bb872d` | `da558cf70` (rebake) | sp-x5 |
| 2026-10-11 | local gate: commit-message-lock abort fixture timing under load | `b87365957` | `e5905be80` | sp-x7 |
| 2026-10-11 | local gate: typecheck (SDK flesh surface vs shape schema) and Nine physics stale source | `0cdf42300` | pending | sp-x6 |
| 2026-10-11 | Linux push CI: pusher fixtures use BSD-only mktemp templates (GNU refuses) | `e38a138a1` | `36f64a51e` | sp-x7 |
| 2026-10-11 | Linux push CI: Driftwood native-cache continuous vs mid-fight restore diverges on Node 24.21 | pending | pending | sp-x5 |
