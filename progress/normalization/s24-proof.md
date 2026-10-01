# E357 S2.4 — day cycle and weather proof

Runtime checkpoints: `913d9557`, `b73e8eac`, `fd6567bd`, `9c8b9159`, `8843d630`, `992fe28f`, `d3186b18`.

Three authored clocks use engine `DayCycle`; Pine and Nalati storm phase loops use engine `Weather`.
Keyframes, curves, sun paths, schedules, presets and storm policy are shard data. Sky rendering stays in
content adapters. Kit owns seeded rain curtain buffers/materials; puddles and Nalati lightning stay authored.
Legacy WorldClock/DayNight/PineDayNight/PineWeather phase-loop classes are removed.
Common clocks are resident-scope owned. Weather hold/damage, creature shelter goals and wet projectile
requests are typed and scoped. Pine installer accepts LevelContext; S2.1 owns production plugin hookup.
S2.3/S2.1 own removal of the temporary scalar King weatherHold compatibility once combat receives ctx.

## Frozen numerical and rendering evidence

42 tests in nine focused files pass. Whole working-tree TypeScript and all owned-file oxlint pass.
Fixtures were recorded from original `152c5409` before extraction:

- 1001 whole-day Pine/Driftwood curve/body samples and Nalati schedule ticks preserve original arithmetic.
- Three-hour seeded Pine/Nalati weather, pending strikes, lightning and gust traces match exactly.
- 241 Nalati elevation-key sky samples preserve every interpolated look channel within 1e-9.
- Three-minute 60x accelerated sky sequence preserves 10800 frames.
- Both rain curtains preserve position/seed/corner/index and literal vertex/fragment SHA256 hashes.
- Scoped clock lifecycle, phase observation, weather holds/damage and all bolt-flight rain factors are covered.

Deliberate compatibility decisions: weather keeps original isolated seed-xor streams/draw order;
engine Weather accepts an injected RNG. Uniform-phase and schedule-hour arithmetic remain separate modes.
Two literal rain programs remain shard data, preserving compiled GLSL instead of adding a new define.

## Own before/after phone comparison

Before `152c540966efb739265b53cd17ce0f60b14637d1`; final after `b3a71ff8a5a7220e8f269f3be44bad4219f50a0f`.
Raw runs: `/private/tmp/e357-sol-s24/before` and `/private/tmp/e357-sol-s24/final-after2`.
Summary: [s24-self-compare.json](s24-self-compare.json). All captures have zero boot errors.
Shader program lists, scene inventory, registry/model inventory and physics are EXACT on all four shards.
The S1.4 input/HUD system-list changes are intentional peer changes and are listed, not silently ignored.

| Shard | Minimum masked pose SSIM | Result |
| --- | ---: | --- |
| Driftwood | .990151 | Pose band passes |
| Nalati | .9999997 | Pose band passes |
| Nine Dragon | .999176 | Pose band passes |
| Pine | .986358 | Pending forest tier correction |

First after `fd6567bd` exposed Pine +6400 instances/+486400 buffer bytes. Grass cached default56 slots
before declared40; S2.1 corrected construction in `459ce119`. Final instances now EXACT20064.
Residual Pine +11520 buffer bytes and pose triangles +16048..22536 remain. Inspected before/final cabin
shows changed distant crown geometry. Forest.ts caches LOD_DIST80/SHADOW_KEEP before Pine60 policy;
S2.1 confirmed and owns per-instance fix. Pine cabin .988344 and pond .986358 are NOT called green.
Rain buffer/program hashes remain exact. All captured screenshots were inspected; browsers/previews closed.

## Clean export gate and next owner

`bash scripts/vercel-tree-gate.sh d3186b18` passes CSS, Node generation/check, app/API TypeScript, oxlint.
It stops at committed NightBrain.ts public-boundary ratchet (0 -> 6), notified to S2.3 and lead.
Every S2.4 ratchet rise is cleared, including the last Game sky active-chunk read: LevelSpec.lookLayer
now receives authored multipliers through toLevelSpec. No blanket lint escape or baseline rewrite.

Lead: after S2.1 forest/plugin and S2.3 NightBrain fixes, run clean Vercel gate and full two-tier parity.
Builder did not push/deploy. Full milestone parity and pin remain lead-owned.
