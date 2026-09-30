# Nine Dragon first-person arms: the sources of `fp-rig.glb` (M10, E315)

`public/assets/nine-dragon/viewmodel/fp-rig.glb` (2.4 MB, 14 skinned meshes, 16 clips) and its map pairs
(`hand-r-*`, `arm-r-*`, `fist-l-*`, `gauntlet-*` `.webp`) are what `src/chunks/nine-dragon-stack/vm/fpArms.ts` plays.
They were made in two stages in the viewmodel lab (lab P8, round 13, E169), and the lab was deleted in `7a339ed2`.
This folder holds every source of that model that could be found.

| Stage | Files here | What it made |
|---|---|---|
| 1. The parts (Blender, headless) | `hand.py` + `hand_lib.py`, `hand_model.py`, `hand_parts.py` | `hand-r.glb`, `arm-r.glb`, `fist-l.glb` + their `-maps` / `-nrm` WebPs |
| | `gauntlet.py` + `gauntlet_geo.py`, `gauntlet_parts.py`, `gauntlet_maps.py`, `gauntlet_preview.py` | `gauntlet.glb` (+ the `claw` node) + its maps |
| | `guard.py` | the jian's dragon-head guard (`--tris 30000` for the body, `--tris 8000 --smooth 20` for its hull), from the TRELLIS.2 generation `~/ml/img2mesh/out/nd-hero/guard.{glb,hi.obj}` |
| 2. The rig bake (three.js, in the lab page) | `rig/bake.ts.txt`, `rig/moves.ts.txt`, `rig/lab-main.ts.txt` | the skeleton, the skin weights, the ink hulls and the 16 clips, exported as one GLB |
| | `rig/rigbake.mjs`, `rig/bakecap.sh` | opened the lab headless, ran `__ndVm.bake()`, wrote `fp-rig.raw.glb`, then `gltf-transform meshopt --level medium` |
| | `rig/riggate.mjs`, `rig/gate_chart.py` | the rig gate (joint limits, velocities, skin weights) → `art/nine-dragon-stack/round-13-viewmodel-rig/rig-gate.{json,jpg}` |
| The check | `rig/check-clips.mjs` | re-samples the 16 clips from `moves.ts` and compares them with the committed GLB |

## Where each file came from

- **The ten Blender scripts** are `7a339ed2^:src/dev/nd-lab/viewmodel/blender/`, restored verbatim in `ad797c52`. That is
  the lab as committed in `5d8feae0` (round 9). The next commit adds the round-13 edits to `hand.py`, `hand_model.py` and
  `hand_parts.py`: the diagonal jian grip, the tilted grip in the hand model, and the cuff axes. The gauntlet and guard
  scripts had no later edits. The shipped `hand-r-*` maps were baked from the round-13 hand.
- **The rig bake was never committed.** It lived in the lab folder's working tree and in a session scratchpad, and both
  are gone. It was recovered on 2026-09-29 from the Claude transcripts of the agents that wrote it: session `be65981d`,
  subagents `a0e9163e8d74bd850` (the rig) and `a4d05de69c38a6b91` (the hand). The recovery replayed every `Write` and
  every scripted edit, in order, into a sandbox.
- **How far the recovery is proven:**
  - The same replay rebuilds files that *were* committed, and they come out identical:
    - all ten Blender scripts at the lab commit `5d8feae0`, byte for byte;
    - `vm/rig.ts`, `cloth.ts`, `geo.ts`, `jian.ts` and `trail.ts` at `7a339ed2`, byte for byte;
    - `materials.ts` and `fpArms.ts` up to the later move's edits (an ASCII arrow; the moved asset path).
  - `rig/check-clips.mjs` then re-samples all 16 clips from the recovered `moves.ts` through the shipped `rig.ts`.
    Every bone rotation matches `fp-rig.glb` within **0.031°**, which is meshopt's quantisation.
  - Not proven by a rebuild: the round-13 hand edits (a rebuild bakes new maps; nothing committed holds the round-13 hand
    mesh on its own) and `bake.ts`'s meshes and skin weights (the lab page is gone).
- `rig/*.ts.txt` are the lab's TypeScript with a `.txt` suffix. They import lab siblings that no longer exist
  (`./assets`, `./viewmodel`, `./post`), so as `.ts` they would fail the type-aware lint. `riggate.mjs` and `rigbake.mjs`
  have two lint-only fixes (a blank line after the import, `Number()` for a unary `+`). `bakecap.sh` still names the old
  scratchpad paths.

## fp-rig.glb is the only complete copy

The compiled rig can't be rebuilt from this repo in one command. Its stage-1 inputs (the round-13 `hand-r.glb` and the
`bake/*-hull.glb` proxies) were never committed, and the lab page that ran the bake was deleted. So **`fp-rig.glb` is the
only complete copy of its 16 clips, its skeleton and its skin.** Keep it. Change it only by re-deriving it as below.
`rig/check-clips.mjs` proves that the clips' source is `rig/moves.ts.txt`, so a clip change starts there.

## Re-deriving it (only if the arms must change)

1. **The parts:** `bash scripts/blender/build.sh nine-dragon-stack/fp-rig` does not do this. Run the scripts by hand,
   under the model lock (Cycles):
   - `blender -b --factory-startup --python-exit-code 1 --python hand.py -- --out <lab>/public/assets/nine-dragon/lab/viewmodel --scratch <dir>`
   - `blender … --python gauntlet.py -- <scratch>`, then `python3 gauntlet_maps.py <scratch> <public dir>`
   - `blender … --python guard.py -- <dir>/out30 --clip 0.27 --tris 30000` and `… <dir>/out8 --clip 0.27 --tris 8000 --smooth 20`
2. **The ink-hull proxies:**
   - `gltf-transform simplify <part>.glb <part>-hull.glb --ratio <r> --error 0.004` with hand-r 0.3, fist-l 0.3,
     gauntlet 0.25 and arm-r 0.5;
   - then `gltf-transform meshopt --level medium` into `lab/viewmodel/bake/`;
   - the guard's two GLBs go there as `bake/guard30.glb` and `bake/guard8.glb`.
   - A stale proxy draws the old silhouette in black.
3. **Reassemble the lab** (a scratch worktree; it is not game code):
   - `dev/nd-lab-viewmodel.html` and `src/dev/nd-lab/viewmodel/{assets,viewmodel,post}.ts` from `7a339ed2^`;
   - `cloth`, `geo`, `jian`, `materials`, `rig`, `trail` and `fpArms` `.ts` from `src/chunks/nine-dragon-stack/vm/`, with
     `fpArms.ts`'s `ASSET_BASE` set back to `/assets/nine-dragon/lab/viewmodel/`;
   - `rig/bake.ts.txt` → `bake.ts`, `rig/moves.ts.txt` → `moves.ts`, `rig/lab-main.ts.txt` → `main.ts`.
4. **Bake:** start the dev server (`:5173`), `node rig/rigbake.mjs fp-rig.raw.glb`, then
   `gltf-transform meshopt fp-rig.raw.glb public/assets/nine-dragon/viewmodel/fp-rig.glb --level medium`.
5. **Gate:** `node rig/riggate.mjs gate.json`, then `python3 rig/gate_chart.py gate.json rig-gate.jpg`. Then
   `node --import ./scripts/bake-loader.mjs rig/check-clips.mjs` with the new `moves.ts` copied back here.
