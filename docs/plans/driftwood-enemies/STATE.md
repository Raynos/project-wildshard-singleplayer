# DRIFTWOOD-ENEMIES — State

Coordinator: dot. Updated 2026-10-18. Request E487. Work branch: gamedev-dot; baseline 11c99f5f2b037f77de45f454d9b74b491110df63.

Scope: three regular enemies + one elite + one boss, isolated selectable one-on-one arena, full combat/rig/loot proof and later natural Driftwood placement. Public review Site authorized. No Mac, legacy feature edits or deployment. Existing SHARD-PLATFORM coordinator files untouched.

A1/A2 complete locally: six-shard census, source API/migration trace and plan in docs/reviews/driftwood-enemy-pipeline-audit.md. Supported serve-build completed gen/proof, Driftwood shardfile and Vite bundle. Focused baseline: 6 files / 17 tests passed (placement, native binding, creature look/body, finale controller, strike geometry). No full type/lint/suite pass claimed.

A3 partly verified: existing official Chrome Headless Shell works; desktop Chromium had runtime socket EPERM (not a reviewer refusal). Actual loaded Model Explorer captures show reef crab, monkey, sailor, Captain, and Captain Die pose. Zero page errors/HTTP failures. Real arena UI-flow capture pending: direct probe entered y900 but retained Explorer/pause overlays, so that screenshot was rejected. All captures are phone portrait software WebGL, not physical-device proof. Preview/browser share one lifecycle and close afterward; no permanent live :4455 URL.

Baseline warnings: existing Driftwood baked map/world mismatch; report-only download/render budget overages. Generator touched lint/ask-ids.json, public/assets/far-reach/baked/rest-storm.glb and new generated blobs/materials/scenes. Preserve a separate generated-diff inventory; no worker Git actions. No feature code edits. Pinned deps present; pnpm 11 ignored sharp build script, no policy config retained.

Next: coordinator source checkpoint/review Site; supported browser baseline; B1 catalog/lifecycle tests and B2 genuinely isolated actor/runtime ports before UI replacement. All C/D content and integration rows remain open in DRIFTWOOD-ENEMIES.md. Arena must not record world kills/quests or grant world loot.
