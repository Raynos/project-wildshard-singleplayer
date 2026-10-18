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
| A4 | Source-only checkpoint and public review Site | dot | ongoing; source and Site v10 verified | Verified branch checkpoint, source-screened site, no private notes or unsupported runtime claims |
| B1 | Data-only practice catalog and lifecycle tests | dot | partial; all-five entry/retry/exit verified | Unique entries, one opponent, replace/retry/exit/stale-load behavior deterministic |
| B2 | Isolated real combat runtime in arena | dot | partial; scoped combat, local defeat and rewards verified | Real brain/strike/rig/death pipeline; no world progress, loot or save mutation |
| B3 | All six shard weapon kit checks | dot | open | Existing loadouts hit arena targets, loans restore; unsupported encounters explicitly excluded |
| C1 | Five enemy design/asset experiments | dot content | approved image targets; geometry rebuild in progress | Three regular, one elite, one boss; distinctive silhouettes and combat roles; real 3D assets/licences reviewed |
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

## 2026-10-18 owner visual rejection and concept reset

All five existing enemy visuals, including V2 alternatives, were rejected by the owner. Keep them as rejected WIP and mechanics fixtures. Five new OpenAI-generated concept pairs show proposed Explorer and first-person HUD presentation; they are not game captures or approved models. The original concept-art catalog and approval context now accompany them on the existing public review Site. Further geometry follows the stronger art direction and owner feedback.

The owner reaffirmed normal writable checkout restoration and branch read/write work. This does not grant main-branch or production deployment permission. Root continues connector checkpoints. The memory-accounting fix is protected at b72c9079e2c6dd1494288ecae06ea301fd4b9137; actual assembled build and admission tests pass, while all-five browser acceptance remains open.

## 2026-10-18 14:19 UTC concept approval

The owner explicitly approved all five new image-generated pairs as visual build targets and requires close fidelity, with no rough approximation counted as completion. The prior V1/V2 meshes remain rejected. Compare actual Explorer and first-person game views against the approved anatomy, silhouettes, materials and detail. Separately, create20 additional ranked enemy/miniboss/boss concepts with mockups.

The public Site must have five tabs: Overview (brief), Review/Audit/Research, Mockup Catalog (all ideas including rejected), Approved Mockups (explicit owner picks only), and In-Game Footage (actual evidence only). A standalone playable Three.js arena in that review Site is authorized as a bonus, using real isolated systems and no persistent world mutation.

## 2026-10-18 15:09 UTC verified progress

Twenty additional ranked concept pairs are generated and published in Site v10.
All twenty are proposed; the five earlier concepts alone are owner-approved.
The requested five-tab layout, two-row mobile navigation and illustrated iOS
home-screen icon are published. The standalone playable Site arena remains open.

At tree e58e4752c493a7d4cd473dd99f0299a212bf31f6, all five selected fixtures enter,
retry and exit with one opponent and no visible dummies. Puffer death/local
coin collection, Conch two-way damage and Colossus attack/local player defeat
are observed. Sampled world health/quest state and restored weapon match after
exit. These are real touch tests with diagnostic pose setup, not human playtests.
Full repertoire, all-enemy defeats, balance, device performance and map parity
remain open. See docs/reviews/driftwood-practice-mechanics for exact evidence.

The probe exposed an adapter defect: a large integer was supplied to the
factory's unit tint argument, producing overbright RGB before any hit. A unit
RNG correction and actual-factory regression pass focused tests and scoped
lint; corrected rendering awaits its own pinned browser run. The old creature
geometry remains rejected regardless of this separate rendering fix.

Puffer and Conch approved-target rebuilds have editable sources and explicit
failed clay comparisons. No implementation is accepted. Current state is in
docs/plans/driftwood-enemies/STATE.md; earlier entries above remain history.

## Latest owner direction — 2026-10-18 15:14 UTC

Focus only the five approved identities. Leave the twenty additional mockups
for later. Audit the five against existing low-poly assets and original
mockups, revise style mismatches, then build toward the owner's 5/5 visual
quality target and test actual arena behavior. This supersedes copying the
fine sculpted surface detail of earlier approved image pairs verbatim.
Preserve those approvals as history; no named identity was cancelled.

The original crab/monkey, broad rock facets, palm leaves and shrine references
support broad purposeful planes, clean matte colors and sparse accents.
Relative current style fit: Mantis, Conch, Puffer, Colossus, Bellback.
This is a comparative art judgment, not an acceptance score. Retain the five's
silhouettes and gameplay roles; simplify noisy chips, fine roots, dense scales,
rope grain and barnacle carpets. Present Mantis and Colossus in actual inland
jungle/shrine habitats instead of putting every creature on the beach.

## 2026-10-18 15:30 UTC revised targets approved

The owner explicitly approved all five new low-poly mockup pairs. These are
now the build targets in art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/.
Keep the five identities and the 5/5 visual-quality goal. Model/animation/combat
acceptance remains separate; no current implementation is complete. The twenty
other concepts stay deferred. Preserve original targets and failed studies.
