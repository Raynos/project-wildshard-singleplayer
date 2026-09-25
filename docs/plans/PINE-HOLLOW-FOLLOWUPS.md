# Pine Hollow — follow-ups after the remaster merge

**State:** `draft` 2026-09-25 — rows Jake moved out of PINE-HOLLOW-REMASTER to finish it sooner (PH-U32). Jake approved none of them yet: nothing is built from this plan until he names a row.

| # | Row | Why it moved |
|---|---|---|
| F-P5 | **WebGPU**: Pine Hollow on the TSL path (V-G2), parity at the 9 cameras (mean \|Δ\| under 6/255); WebGL stays default | WebGL is the default either way; ~half a day of parity work |
| F-0.2 | **The per-shard code split** (ENGINE-FIT E5): `ShardModule { build, look, quest, audio, fauna, loadSteps }`, main.ts's shard branches out into `src/shards/*` | A risky refactor right before a merge; better on main with all three shards landed |
| F-B1 | **Whole-map Blender pass**: `pnpm blender:island --chunk pine-hollow` — terrain at 2× grid, Geometry-Nodes scatter, AO + bounce lightmaps, LOD'd tiles | The trees, crags, cave and landmarks already carry most of the visual win |
| F-B5 | **CC0 photoreal kit**: 20–30 Poly Haven props / scanned rocks and logs | Nice to have |
| F-B6 | **The cabins lifted**: re-materialled for the new look; the ranger's cabin interior dressing | Nice to have |
