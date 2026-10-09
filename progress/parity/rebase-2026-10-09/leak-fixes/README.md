# Pine and Nine unload ownership (SF57, E435)

On `f983de200b2b54ccde9cb551cc41188c24445222`, five independent phone captures per shard report **zero texture and program leaks**. Pine also has five fresh rain captures with both fields zero. Geometry, bodies and colliders are zero; every capture has zero page/disposal errors. `five-unloads.json` contains the individual results; each compressed capture preserves the actual `__wildshard.leak()` response. The engine's retained event listeners/answerers are reported separately, not claimed as zero.

## Root causes and fixes

- **Pine:** the native GL allocation left after unload was the 512² `rock_ground/arm.phone-4cc2ef34.ktx2` texture, 174,776 bytes. `PineCrags.load()` eagerly uploaded all three `loadPBR('rock_ground')` maps, while its shader references only the diffuse/normal grit maps. The unused ARM wrapper was collected before level cleanup, leaving Three's source allocation alive. `d956d24a4` requests only those two used maps. No shader, collision or weak-upload policy changed.
- **Nine:** the orphan program's key ends `ws-dummy-studio-1`, with `usedTimes=15`. The arena's loading stand-ins had fifteen generated studio materials; replacing them with loaded figures dropped those materials without disposal. `539d18a92` gives each figure an owned child scope and retires it on replacement/unload. Shared acquired model geometry/textures remain asset-owned. The regression tests actual ownership, replacement, compile observation and shared-asset disposal.
- **Generated target attachments:** `5ab479b77` dispatches colour-attachment disposal when a render target retires, so derived environment listeners also run. The earlier render-target explanation of Pine's leak was incomplete: this correction alone still left Pine's ARM allocation. The failed patched capture was preserved before tracing the actual native texture. The regression proves derived-target disposal, and the existing collectable-unowned-upload tests remain green.

`f983de200` rebakes Pine's map and physics from the clean candidate. The physics payload is identical: only build/revision and the crags source hash changed (164 actors, 918 trees, 2,078 solid colliders). The map keeps the existing ground style and geometry; its rebake measured mean absolute RGB differences of 0.891 / 0.798 / 0.972 on the 0–255 scale. Both freshness suites pass, 14 tests.

## Pine's earlier parity side effects

All five walks log `pineLife.drum` and `pineLife.woodpecker`; the later combat window logs only `forest.thrall`. The drum is present in normal gameplay. The `77772d696` entry clearing did not edit PineLife or its local RNG seed. The bird chooses a nearby trunk, flies/perches, drums in short scheduled bouts, and flushes when the traveller moves far away; absence from a later observation window is not a removed sound. No audio change is needed.

All five phone climbs end at `(34.916, 57.477, 211.286)`, with no stuck leg. The original rebase identified the roughly 1 cm contact-solver endpoint change when four distant lane colliders were removed/reordered. No motor law or tolerance is changed here. Baseline recording uses only the measured three-run spread, never an invented band.

## Validation

- Actual parity capture API, phone tier, accelerated clock, `walk+combat+leak`, five independent captures each; Pine rain uses a separate fresh context. One muted Metal browser through `browser-lane.sh`; no Simulator run.
- Real boot smoke: Driftwood, Pine, Developer Signal, grid title entry **4/4 PASS**, ten live gameplay frames, zero faults. Compact receipts are adjacent.
- Clean archive + linked workspace dependencies + `pnpm gen` + export-only generated regeneration: **1,054 files / 5,838 tests PASS**, 128.15 s. The first export under `wildshard-serve` hit a fixture's path-only acceptance assumption; the same fixture and full suite pass in the separate clean archive. No assertion changed.
- `scripts/vercel-tree-gate.sh HEAD`: **GREEN at f983de200**, already stamped by the serialized gate. Source lint, strict types, coupling, ratchet and private-index guards pass.
- No separate Simulator soak: the coordinator's already-running SF57 relaunch owns that proof and its live leak census.

The four M5 baseline records and old-to-new field classification follow in the parent receipt. CI runner baselines remain the coordinator's dispatch.
