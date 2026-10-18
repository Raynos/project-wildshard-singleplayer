# DRIFTWOOD-ENEMIES

**State:** `in progress` 2026-10-18 — five source/rig/AI drafts preserved; real three-dummy arena entry, touch combat and exit verified. Selected-enemy integration, world placement and quality acceptance remain open. Coordinator: dot.

Request: [E487](../tasks/asks/E487.md). Current state: [STATE](driftwood-enemies/STATE.md). Review: [enemy pipeline audit](../reviews/driftwood-enemy-pipeline-audit.md).

## Scope and boundaries

Build three regular enemies, one elite and one boss for Driftwood Isle. First verify current enemy inventory, Model Explorer and combat arena; then implement a safe selectable one-on-one arena and use it to test the full asset/AI/attack/death/loot pipeline before world placement. Publish a public review site through the coordinator. Existing Rockhop cleanup proceeds independently.

Work in the authorized dot cloud checkout on `gamedev-dot`. No Mac work or production deployment; no branch/index/publication action by workers. The owner permits legacy compatibility edits and arena-only prototypes reusing real game systems when needed for the five-enemy goal; prefer the current shard-file path. Preserve unrelated production assets. Stay compatible with ongoing SHARD-PLATFORM conversion without editing its coordinator STATE or policies. All unfinished enemy work is Developer-gated. Three regular + one elite + one boss is the selected content mix; final individual designs remain to be reviewed.

## Milestone rows

| Row | Work | Owner | Status | Acceptance |
| --- | --- | --- | --- | --- |
| A1 | Six-shard source census and migration boundary | dot audit | complete locally | Species, variants, encounters and placements reported separately with source files |
| A2 | Existing baseline build and focused combat tests | dot audit | complete locally | Supported preview bundle built; six files / seventeen tests pass; no full-gate claim |
| A3 | Real portrait Model Explorer + arena captures | dot | partial: Driftwood specimens and three-dummy touch combat verified; six-shard capture coverage pending | Current build starts in supported browser, specimen clips and baseline arena captured; browser closed |
| A4 | Source-only checkpoint and public review Site | dot | open | Verified branch checkpoint, source-screened site, no private notes or unsupported runtime claims |
| B1 | Data-only practice catalog and lifecycle tests | dot | open | Unique entries, one opponent, replace/retry/exit/stale-load behavior deterministic |
| B2 | Isolated real combat runtime in arena | dot | open | Real brain/strike/rig/death pipeline; no world progress, loot or save mutation |
| B3 | All six shard weapon kit checks | dot | open | Existing loadouts hit arena targets, loans restore; unsupported encounters explicitly excluded |
| C1 | Five enemy design/asset experiments | dot content | open | Three regular, one elite, one boss; distinctive silhouettes and combat roles; real 3D assets/licences reviewed |
| C2 | Data, rigs, animations, AI, strike and loot integration | dot content | open | Every design resolves admitted body/look/brain/strike/reward rows; no stand-ins counted as complete |
| C3 | Arena combat acceptance | dot | open | Telegraph/dodge/stagger/death/retry/reward-once, disposal and persistence tests pass |
| D1 | Driftwood natural placement and map parity | dot content | open | Valid terrain/water/spacing, no blocked traversal; map and source agree; save/reload consistent |
| D2 | Final related gates and portrait review | dot | open | Relevant types/lint/tests/build + real browser proof; device/perf limits clearly reported |

## Design constraints

The current arena is immortal training targets, not a reusable enemy runtime. Do not transport an existing live enemy into the room or reuse the live onKill chain: this would mutate quests/progress/loot. The current AnimalManager binds global ground and level scope, so a second instance alone is not isolation. Add explicit host ports only where needed and feed shard content as data; engine logic must remain shard-neutral. Existing bosses may require ground, adds, flight or saved-state adapters. A 9 m arena ceiling cannot be assumed to fit airborne bosses.

## Proof and clean-tree accounting

Cold generation creates all shards' build products even for a single selected preview shard. Two tracked generated paths changed during baseline preparation (`lint/ask-ids.json`, Sky's rest-storm GLB) plus generated content-addressed blobs/material/scene outputs. Keep them out of small feature/checkpoint source commits until individually reconciled. The full suite, full typecheck/lint and arena gameplay screenshots are not yet verified; Model Explorer portraits are verified. Current baked Driftwood map mismatch is a pre-existing baseline warning and stays an open D1 requirement.

## 2026-10-18 foundation checkpoint

Developer-only isolated-opponent source is WIP: data-fed selector, arena host port, private creature brain/combat scope and race-safe lifecycle. Initial admission supports declared grounded stalker/skirmisher action bodies only (existing Reef Crab); other behavior families stay unavailable. Focused post-edit regression: 4 files / 23 tests passed. Full integration validation remains pending. The unchanged arena now renders all three targets, including after four model visits. Combat and exit validation remain open.

Public review: https://wildshard-enemy-lab.raynos.chatgpt.site (v1 baseline models and audit; feature runtime proof pending).

## 2026-10-18 playable baseline and five drafts

Canonical checkpoint `18a7b31a3fd08664c2d342959efa43fe5cef31b6` preserves the five ordinary source drafts, editable rig/clip generators, decision guests and combat definitions. They are Brine Puffer, Conch Duelist, Splinter Mantis, Bellback (elite) and Tide-Root Colossus (boss). All remain WIP; zero have completed quality acceptance.

The baseline arena passed real cloud-browser entry, sustained play, touchscreen sword damage and exit at source tree `658b994483b41293cc96a9c27d43298050680652`. Explicit FreeCam lock ownership and touch-aware gameplay pointer-lock policy address the reproduced input failures. Software rendering is not physical-device performance evidence.

Selected-enemy admission now has an authored integration for verified decision guests, fresh bout-local player health, retry and visible authored coin receipts. Focused checks and all-five browser smoke are in progress. This is not yet proof of all-five fights, loot collection, map placements or completion. The public review Site includes the actual rig/pose board and baseline touch-hit screenshot.
