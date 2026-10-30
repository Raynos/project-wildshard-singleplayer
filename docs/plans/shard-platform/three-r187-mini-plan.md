# three.js r187: upgrade when it is safe, measure what it buys

**State:** `draft` 2026-10-30 ~12:40 Cancun, waiting for Jake's grill. Written by wildshard-v from its research
subagent's report (`tmp/wildshard-v-three-r187/three-r187.md`; the full breakage table with file:line on both sides lives
there). Ask E513. Jake, 12:23: *"New version of 3.js drop, make a mini plan for upgrading 3.js, apparently has huge
performance gains."* We pin three 0.186.0 (root `^0.186.0`, `src/sdk` `^0.186.0`, `src/commons` exact `0.186.0`).
three 0.187.0 was published 2026-10-30 08:09 UTC. This repo has never upgraded three; it started on 0.186.0.

## What r187 really buys a WebGL game

- **No headline speed claim** in the release notes, the r186 → r187 migration guide or the forum.
- **The one real WebGL win:** PMREM environments become real cube textures (PR #34585). It claims "~25 % in WebGL"
  (3.14 → 2.36 ms on an M1, 30 env-lit spheres). That is a GPU win for classic lit materials, Pine's PBR most. Our
  node materials get it only once our own atlas sampler (`ClassicPMREMNode`, `cubeUVSample.ts`) is deleted.
- **TSL node builds 28–34 % cheaper on the CPU** (PR #34815). That only shortens compile and warm-up, not per frame.
- **Everything else with a number is WebGPU-only** (parallel `compileAsync`, BatchedMesh merging, the new pipelines).
  We are WebGL-only (E184).
- **It does not fix today's measured costs.** The per-draw node overhead is our own `beforeDraw` and uniform flush, and
  the per-draw code in three's `WebGLUniforms` / `WebGLNodesHandler` is unchanged. Nine's 95 programs and Pine's
  unbatched graph trees are untouched. QC1 / QC4 stay [nine-fix](nine-fix-mini-plan.md) NF13–NF15's and
  [pine-fps](pine-fps-mini-plan.md)'s job.

## What breaks (15 places; the silent ones are the danger)

- **Blocker today:** `@types/three@0.187.0` is not on npm, so a strict-TypeScript bump cannot land cleanly.
- **Silent: they turn our optimisations off without an error.**
  - **B1, sky refresh:** the stepped sky refresh (`skyEnvironment.ts:31-43,91`) drives PMREM internals r187 removed.
    It falls back to a whole refresh, bringing back the ~2 ms GPU spike E142 removed.
  - **B2, phone cube size:** the phone's 64 environment cube is forced to 256 (`PMREMGenerator.js` `MIN_SIZE`). That is
    about +8 MB GPU per live environment, and it trips the ratchets (`pmremSize.ts`, `tiers.ts:42`).
  - **B6, shadow bias:** the receiver-plane bias anchor (`shadowFilter.ts:93`) no longer matches r187's shadow chunk.
    The bias switches off and shadow acne returns (checked by running both chunks).
  - **B7, per-draw texture updates:** the shortcut (`textureUpdates.ts:44-60,140`) stops recognising r187's textures.
    That can raise exactly the per-draw cost QC1 / QC4 are about.
- **Node lighting (B3):** the PMREM node API changed (`engineNodesHandler.ts:171-193,212`, `cubeUVSample.ts`). The fix
  is likely deleting both.
- **Medium:**
  - Five tests build `CubeUVReflectionMapping`, which r187 removes.
  - The warm-up keys on a field r187 renamed (`drawnEnvironment.ts`).
  - The uniform-block rename is dead code (`engineNodesHandler.ts:324`).
  - Node build reuse may stop hitting (`nodeBuildReuse.ts`).
  - `scripts/build-sdk.mjs:83` hard-codes `basis/r186`.
  - `postprocessing@6.39.5` declares `three < 0.187.0` (41 imports).
- **Low:** graph lighting drifts slightly (`compile.ts:261` `f90: float(1)`); small viewport / scissor and
  depth-texture disposal changes.

## Rows

| Row | Work | Done when | Lane | Size |
|---|---|---|---|---|
| TR0 | **Bench before anything lands**: r186 vs r187 in `./tmp` (only the two three packages, no repo copy) on Chromium 4× as iPhone 16 Pro and WebKit, through `scripts/browser-lane.sh`. | Numbers recorded. Go if env-lit GPU ms improves ≥ 10 % and `setProgram` + upload is no worse than +5 %. | Codex | S |
| TR1 | **Wait gate.** | `@types/three@0.187.0` on npm, **and** r187.1 out or 2026-11-06 passed (7-day soak), **and** nine-fix NF15 landed (or Jake overrides). | — | — |
| TR2 | **One announced landing**: the bump in root, `src/sdk`, `src/commons` and the lockfile, announced to every lane over herdr first (the shared `node_modules` changes for all). Fix B3 (delete `ClassicPMREMNode` + `cubeUVSample.ts`), B4, B5, B8–B11, B13, B14. | `tsc -b` on the layers plus root tsc exit 0; lint and ratchet clean; `vitest related` green on the touched files; full local build exit 0. | Opus | M |
| TR3 | **Sky refresh and cube size (B1, B2)**: port the stepped refresh onto r187's per-lod steps, default-off Debug row "PMREM stepped refresh (r187)" until a phone reading; keep the phone cube at 256 and move the ratchet by the measured delta only. | Max frame during a sky refresh ≤ today's stepped refresh + 1 ms (Chromium 4×); every shard ≤ 1.2 GB on the phone tier. | Opus | S |
| TR4 | **Shadow bias and texture updates (B6, B7)**: re-anchor the bias to r187's reversed-depth form; rewrite `textureUpdates.ts` for r187's base-node uniforms. | 0 `[sky] … changed` warnings at boot on every shard; Nine P4 uniform calls a frame ≤ 462 and `beforeDraw` ms ≤ today's. | Opus | S |
| TR5 | **Look parity**: G844 before / after at fixed probes on Driftwood, Pine, Nalati, Nine and Far Reach; golden stills where they exist. | No glitches, roughly the same look (G415); 0 shader errors; any visible lighting shift goes to Jake as one labelled board. | Opus | S |
| TR6 | **Numbers** on pinned previews of the parent vs the bump: Nine P4, Pine P1, Chromium 4× + WebKit. | Work p50 no worse than +0.3 ms; Pine P1 GPU ms ≥ 10 % lower; programs ≤ 95 / ≤ 117; memory within ceilings + TR3's delta; then the milestone proofs. | Opus | S |
| TR7 | **Jake's phone playtest** (G558). | His word. | Jake | — |

Order: TR0 any time (cheap, allowed). The bump (TR2–TR6) only after TR1, between nine-fix NF15 and NF17: NF17's
lit-graph shader is then written once against r187's lighting. Taking r187 before NF18 would mean porting node code
NF18 deletes (B3, B7, B8, B9).

## Questions for Jake (the grill)

1. **When?** *Recommend: run the bench (TR0) now, upgrade after the types ship and a 7-day soak or r187.1 (earliest
   2026-11-06), after Nine moves to GLSL (NF15).* Alternative: upgrade now and absorb the silent breakages and the
   missing types.
2. **The phone environment cube 64 → 256** (+~8 MB GPU per environment, forced by r187)? *Recommend accept; it is
   inside the caps.*
