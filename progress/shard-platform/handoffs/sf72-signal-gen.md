# Handoff: sf72-signal-gen (SF72, Signal Dunes' code-built world → offline bake), 2026-10-09

Status: unfinished. Landed so far (lanes sf72-signal-gen2 … gen6):

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
- Still open from the coordinator's condition: `world/baked.ts` `loadPiece()` warns (`console.warn`) when a baked GLB
  fails; the promoted SDK module (sf72-sky-gen) should `console.error` there too (asked through the coordinator).

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

1. **The species rigs → a baked GLB: a byte-cost decision first.** gen6 drafted `generators/species.ts` (not landed):
   it moves `skin.ts`, `manta.ts`, the skitterer / code ray / strider geometry builders and `bindRigid` offline,
   reads `dune-strider.glb` / `dune-matriarch.glb` in Node (GLTFLoader + MeshoptDecoder, then the client's own flatten,
   factored out of `world/meshes.ts` as `flatModel(scene)` so the bake and the client cannot drift), and writes one
   GLB with three non-indexed meshes (`skitterer`, `strider`, `matriarch`: POSITION, COLOR_0, JOINTS_0 u16, WEIGHTS_0;
   the ray's tint as `_TINT` on the Matriarch's mesh; no normals, because `manifest.creatures.lowPoly` facets and
   recomputes them, and the Model Explorer draws flat-shaded) plus `data/species.json` (the strider's measured bones and
   `h`). The client then drops `dune-strider` and `dune-matriarch` from `DUNE_MESHES`.
   **Measured:** lossless meshopt GLB = **944 KB** (gzip 843 KB) against the **349 KB** of the two source GLBs it
   replaces: **+595 KB on Signal's 2.4 MB boot pack (+25 %)**. Indexing does not help (the Matriarch's painted facets
   leave 25,845 unique corners of 27,000). Lossless bytes are intrinsic because `fit()` makes arbitrary float32
   positions. Options for the coordinator: (a) `quantize()` + meshopt (likely ~250 KB, sub-noise pixel change to prove
   with parity, not bit-identical); (b) bake only the code-built skitterer (7 KB) and keep the two generated bodies'
   skinning in the client; (c) accept +595 KB. Recommendation: (b) now, (a) after a parity proof.
   Gotchas found: the Model Explorer's `dune-ray` draws the **code** ray (`rayGeometry()`), which the world never shows
   (the world ray is the tinted manta); a bake either keeps it or shows the world's ray there (a visible Explorer
   change). An empty `hardParts` throws in `mergeAnimalGeometry`, so a rig that failed to load needs a degenerate
   stand-in geometry, not `[]`. The world-bake test and `scripts/bake-signal-world.mjs` are synchronous; the species
   generator is async (meshopt), so await it there (or give it its own script and test while sf72-sky-gen edits them).
2. The look tables (`minimap`, `far`, `dusk`, `families`) → `data/` rows.
3. `models/gear.ts` follows the species (its creatures read the rigs).
4. Lane sf72-sky-gen is promoting `generators/kinds.ts` and `world/baked.ts` into the SDK (WIP in the shared tree also
   touches `world/places.ts` and the generators); build on its SHA, and sequence through the coordinator.
