# Core-game memory benchmax: mini plan (draft, G640)

**State:** `draft` 2026-10-23 — skeleton by the plan agent; a subagent fills the measurements and rows. An extra under
G639 (after Nalati to zero and grid readiness), but its measurements can run any time a lane or subagent is free.

Jake, 2026-10-23, reading the tile streaming page (*"What tiles can't remove: the ~300 MB engine base, the ~320 MB of
page components"*): *"A new draft mini plan called memory benchmaxing the core game … page components, an engine that
takes up 600 megabytes of our allowance … that's really a lot … benchmark how much memory the shard file of template 1,
template 2 use … in shard select, not infinite wild shard, just shard select. If you're saying the engine takes 300 and
the page components take 300, then that should show in template 1 and template 2."*

## Why

The ~300 MB engine base and ~320 MB of page components come from the Developer memory strip's estimator (300 MB base
constant + declared bytes; memory-strip-mini-plan.md), not a measurement. The templates (`_template` = Template 1,
`blender-template` = Template 2) are the smallest shards, so whatever they use in SHARD SELECT is the core game's floor.
If it is ~600 MB, every shard pays it before any content, and the 1.2 GB per-shard limit (G556) leaves only ~600 MB for
content.

## Measure (SHARD SELECT only)

1. Template 1 and Template 2 entered from SHARD SELECT on the phone tier (Chromium iPhone 16 Pro, and the Simulator):
   renderer / GPU / JS heap / wasm / decoded images over the first 60 s and after 2 min idle; also the main menu alone and
   SHARD SELECT with no shard entered, to split menu / engine / shard.
2. Break the floor down: three.js renderer and programs, physics (Rapier wasm), audio, fonts and UI, the HUD, shader
   programs and the program cache, the continuation cache, commons packs, the road/grid code that loads even in SHARD
   SELECT, pre-allocated pools, decoded textures, the strip's own overhead.
3. Compare with the estimator's 300 + 320 MB and with what Chromium / the Simulator report.

## Rows (to be drafted)

From the measurement: the top consumers, what should not load in SHARD SELECT, pools to shrink, caches to cap, and a
"core floor" budget (target to be set by Jake) checked at each milestone.
