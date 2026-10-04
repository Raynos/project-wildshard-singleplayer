# SF33 / SF33b save APIs and cross-revision migration

2026-10-04, sp-x3. E435 / E439. Source implementation validated; the coordinator owns the serialized gate/push.

## Per-instance New game (Codex half of SF33b)

`@wildshard/game/newGame` exposes `previewNewGame` and `resetNewGame`. The detached summary gives quests,
inventory and flags before/after, plus kept profile, feats and other shards. Unknown legacy quest counts are null.
The same canonical instance identity serves Select a shard and the grid; template copies are separate.

One durable document write deletes that instance's quests, flags, inventory, item/region continuations and other
local state while preserving legacy feat progress. Profile/global/device saves and other instances remain
byte-identical. Quota refusal preserves old bytes and live bindings. A reset generation rejects stale
checkpoint/disposal writes and prevents legacy template re-import. Success requires reload or eviction/rebinding
of the target, including frozen grid residents. The Settings sheet is the separate Opus half (a8f90b5ee).

Sources: cee746d7e, 833d947f3, 3d711a5c6, ecec2e370, 7ef9fff8d.

## Declarative revision migration (SF33)

Format `migrations` defaults to `[]`. State-version steps declare defaults, rename, drop and value maps by stable
field ids. Rename and map may compose; duplicate/conflicting edits fail. `asHook` is reserved and null; content
cannot execute a migration callback. Additions take defaults, implicit identity changes and dropped-id recycling
fail, and actual saved values are validated atomically. Current full-format admission and cached state lineage
share the strict state validator. A valid online update can replace legacy geometry without admitting that old
geometry; offline cached products still require full admission. Failed upgrades and revision rollback preserve
the cached predecessor.

Logical checkpoint v2 preserves declared state, flags, quests/dialogue and stable item progress. Changed revisions
start with fresh physics and script execution, sanitize item queues/held/cooldowns and restore quests silently.
Version-1 client checkpoints remain readable. Same-revision checkpoints retain the exact fast path.
Regional saves include a portable companion without duplicating WASM memory. Old engine bytes can be unavailable
and a changed revision still restores logical progress. Refusal aborts admission without erasing the save.

Sources: 93052e316, 010758802, bacb1f7d7, 1fdc6bfdb, 15e7d2277, 41a1beb6f, 710f2b151,
2a6b95d8e, 71101c4a1. Integration: sp-x1 036a8f9d3 (fresh bind/restore/refusal); sp-x5 f82393d27
(format/SDK/docs), 78415ff7c (shared state admission leaf).

## Validation

`pnpm exec vitest run` on these thirteen files: **77/77 passed** (2.43 seconds):

```text
test/engine/shard-reset.test.ts test/engine/instance-saves.test.ts test/engine/saves.test.ts
test/new-game.test.ts test/checkpoint-migrations.test.ts test/cross-revision-checkpoint.test.ts
test/shardfile-state.test.ts test/shardfile-product.test.ts test/shardfile-client-state.test.ts
test/live-grid-durability.test.ts test/shardfile-checkpoint-durability.test.ts
test/grid-durability.test.ts test/shardfile-migrations-format.test.ts
```

The real saved Driftwood fixture resets 37 coins and five inventory units while preserving feats/profile/other
copies. The real admitted template keeps its open door, lantern fuel, completed quest and regional coins/rope
across revisions, with fresh execution/physics and zero repeat rewards. Native live-session migration independently
keeps 14 coins, one fact and the added state value 0.4 without rewriting the predecessor during read.

Scoped `pnpm exec oxlint` passed for all changed reset/migration/cache modules and their tests. Root
`pnpm exec tsc --noEmit` passed before the unrelated script-brain fixture was added; the final rerun found only
`test/engine/script-brain.test.ts:43-44` references to absent `PlayerHealth.hp/maxHp`, routed to the coordinator.
No rendering, collider, HUD layout, browser or Simulator work was performed by this migration lane.
