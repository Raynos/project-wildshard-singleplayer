# DRIFTWOOD-ENEMIES — State

Updated 2026-10-18. Development work in progress.

Scope: three regular enemies, one elite and one boss for Driftwood Isle. Build a selectable, isolated one-on-one practice mode, verify real combat and animation, then test natural map placements. Prefer the current shard-file implementation; legacy compatibility fixes and isolated prototypes are permitted where needed.

Six-shard source census and migration/API trace are recorded in the linked audit. The existing baseline built successfully and 17 focused baseline tests passed. Model Explorer displays four existing Driftwood enemy specimens and the Captain death pose. The unchanged three-dummy arena now renders successfully, including after four model visits. Combat, exit and selected-opponent integration remain unverified.

The initial isolated-opponent adapter is WIP. It admits declared grounded stalker/skirmisher action bodies, preserves default dummy mode and isolates encounter events. Focused post-edit tests pass. This does not establish complete player damage, item drops, broader behavior support, visual acceptance or physical-device performance.

Five enemy designs are documented but unimplemented. No new enemy is complete or accepted. Next: verify arena combat and lifecycle, fix demonstrated defects, then implement and test the first enemy end to end. Keep world saves, quests and inventory isolated during practice.

Review: https://wildshard-enemy-lab.raynos.chatgpt.site
