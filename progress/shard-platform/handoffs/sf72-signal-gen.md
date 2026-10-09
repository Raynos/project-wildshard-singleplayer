# Handoff: sf72-signal-gen (SF72, Signal Dunes' code-built world → offline bake), 2026-10-09

Status: unfinished. Landed so far (lanes sf72-signal-gen2 … gen7):

- `9fb0cca1d`: SF57 fix in `src/game/grid/pageResidency.ts` (`composerCover()`); `ac389a949`: the boot smoke boots
  Developer Signal standalone.
- `c075fbb21`: rocks (`generators/rocks.ts` → `baked/rocks.glb` + `data/rocks.json`). Share 4.3 → 5.8 %.
- `ee786f9ed`: dressing, the shared kind baker `generators/kinds.ts` and the generic client `world/baked.ts`. 5.8 → 12.7 %.
- `7757f1119`: the tower frame (`generators/tower.ts` → `baked/tower.glb` + `data/tower.json`). 12.7 → 15.6 %.
- `a9af86395`: the places (`generators/places.ts` → `baked/caravan.glb`, `baked/well.glb`, `data/braziers.json`); the
  code stand-ins of the generated models are gone. 15.6 → 18.8 %.
- `208d6e262` (gen6): the unused facet `caravan` and `waymark-brazier` preloads dropped (−2 fetches, −0.67 MB retained
  commons), the tower's brazier is `brazier-hd` alone (no facet / code stand-in, no kindling), and a generated model that
  fails to load is a page fault: `world/meshes.ts` logs `console.error` (the boot smoke fails on it);
  `test/shards/sunscar-dunes/model-load-fault.test.ts` proves it per model and `model-cache-coverage.test.ts` fails on
  one. Pixel-identical, colliders identical, physics + map rebaked. Share 791 / 3408 (18.8 %).
- `1a298c6e8` (sf72-sky-gen): the kind baker and the baked-piece loader are SDK modules (`@wildshard/sdk/bake/kinds`,
  the shared client loader, which `console.error`s a failed GLB). Build on those, not Signal-local copies.
- `ac189becd` (gen7, rigs pick (b)): the code skitterer is a bake. `generators/species.ts` (skittererGeometry,
  bakeSignalSkitterer) → `scripts/bake-signal-rigs.mjs` → `public/assets/sunscar-dunes/rigs/skitterer.glb` (38.7 KB,
  3.4 KB gzip; `_JOINTS` / `_WEIGHTS` custom attributes, no normals). `world/meshes.ts` `duneRig(name)` loads `DUNE_RIGS`
  (`boot/files.ts`) in `preloadDuneMeshes`, keeps them without normals (+59,904 retained commons) and recomputes flat
  normals per copy; `undrawnRig()` is the zero-area stand-in a failed rig gets (its load is a `console.error`).
  `test/shards/sunscar-dunes/rig-bake.test.ts` is the byte-exact stale gate and proves the client geometry equals the
  code's attribute for attribute. Pixels identical (run-1 vs run-1 0.000 % > 24), calls / tris / gpuBytes identical,
  colliders identical, walk 0 stuck, frame floor desktop PASS 59.88. Share 18.1 → 18.5 %.
- gen7, far: `look/far.ts` → `generators/farLook.ts` (only the far baker and two tests read it, as the template's).
  Physics + map rebaked (generators/ is an input of both). Share 18.5 → 18.8 %.

## The invariant recipe (one slice, about 45 min)

1. Work in a clean export (`git archive HEAD` + your files + `scripts/link-node-modules.mjs` + `pnpm gen`) and a
   private index (`GIT_INDEX_FILE=… git read-tree HEAD`, `git --work-tree=<export> add -- <paths>`); `git commit-tree`
   a candidate. Serve `--rev HEAD`, then `--rev <cand>`, one preview at a time. Stop previews by port, never
   `all-mine` (a subagent shares its coordinator's session id).
2. Pixels: `node scripts/parity.mjs --url=<preview> --shards=sunscar-dunes --tiers=phone,desktop --only=fingerprint+poses
   --out=<dir>` on both builds, **run from the main checkout** (it resolves the build's sha with git; the export's own
   repo does not have it); compare before vs after against each build's `run-1/` vs `retry/` noise (>24/255).
3. Colliders: `scripts/browser-lane.sh node scripts/bake-signal-physics.mjs --url=<preview> --revision=<full sha>` from
   the export; diff pieces / spots structurally (only `file` fields and `inputs` should move).
4. Walk: `scripts/browser-lane.sh node scripts/physics-baseline.mjs --no-build --mode=walk --shard=sunscar-dunes
   --url=<preview>` from the export.
5. Map: `scripts/browser-lane.sh node scripts/bake-maps.mjs --url=<preview> --shards=sunscar-dunes` in the export.
6. `node scripts/parity/boot-smoke.mjs --url=<preview>`; `node scripts/test-facade-instancing.mjs --url=<preview>`.
7. Export: make it its own repo (`git init`, add everything, commit; the guard hook blocks `git add -A` typed inline, so
   put it in a script), `node scripts/generated-files.mjs --write`, `node scripts/check-graph.mjs --paths`,
   `pnpm typecheck`, oxlint, ratchet, shard-coupling, `node scripts/shard-platform.mjs` (the share), then
   `python3 scripts/heavy-lane.py full-test -- pnpm exec vitest run`.
8. Load (`boot.playMs`) swings with the machine's load average: compare runs taken at similar load.
9. `node scripts/frame-floor.mjs --shards=sunscar-dunes --surface=desktop --rev=<sha>` (it serves its own build and
   writes a receipt under `progress/frame-floor/`; delete it unless you commit it).
10. After `update-ref`: point the shared index at HEAD's blob for each landed path and write HEAD's copy to disk
    (GIT.md, "After a private-index commit").

## Next, in order

1. **The rigs (a) trial (coordinator: land it only with pixel parity within noise at every pose, INCLUDING a close
   creature pose where quantization would show, and the boot pack not growing).** gen7 measured it: the two generated
   bodies flattened as the client does (AO into the colour), fitted, then gltf-transform `quantize({ quantizePosition:
   14, quantizeColor: 8, quantizeWeight: 8 })` + `meshopt({ level: 'high' })` with `meshoptimizer`'s encoder (both
   already dependencies) = **242,688 bytes** for strider (4,800 vertices) + Matriarch (27,000) against the **348,820** of
   `dune-strider.glb` + `dune-matriarch.glb` they replace in `DUNE_MESHES` (−106 KB on the boot pack). Design:
   - `generators/species.ts`: parse the two source GLBs in Node (GLTFLoader + MeshoptDecoder), flatten with the client's
     own code (factor `flatModel(scene)` out of `world/meshes.ts` `load()` so they cannot drift), run `striderMesh`
     (move it from `species/strider.ts`; bones and `h` from the exact floats → `data/species.json`) and the untinted
     `mantaBody` (fit + the five-bone weights), write one rig file each with real `JOINTS_0` / `WEIGHTS_0` through a
     gltf-transform `Document` (not `staticGlb`), then quantize + meshopt. Bake the code ray (`rayGeometry`) lossless
     too: the Model Explorer's `dune-ray` draws it.
   - Client: `loadRig` must read quantized attributes through `getX…` (normalized) and apply the node's matrix
     (KHR_mesh_quantization puts the dequantize transform on the node). The ray's tint (`manta.ts`) stays client-side
     on a copy of the Matriarch rig (it needs the normals). Fallbacks become `undrawnRig()` (the faulted policy), so
     `skin.ts`, `striderGeometry`, `striderMesh`, `rayGeometry` and most of `manta.ts` leave the client.
   - Proof: the parity poses plus a close creature capture (a Model Explorer specimen close-up of strider, Matriarch
     and ray, before vs after, against each build's own run-to-run noise). The async bake needs its own script / test
     (the world-bake ones are synchronous).
2. The look tables: `far` is done. `minimap`'s `ground` / `overlay` still run in the client (the Minimap's no-image
   fallback and `bake-maps.mjs` in the browser), and `dusk` / `families` are runtime curves; moving their numbers to
   `data/` rows saves little unless an SDK look-family row evaluates them.
3. `models/gear.ts` follows the species (its creatures read the rigs).
