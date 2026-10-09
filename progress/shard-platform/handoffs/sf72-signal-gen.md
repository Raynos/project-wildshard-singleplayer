# Handoff: sf72-signal-gen (SF72, Signal Dunes' code-built world → offline bake), 2026-10-09

Status: unfinished. Landed so far (lanes sf72-signal-gen2, gen3, gen4):

- `9fb0cca1d`: SF57 fix in `src/game/grid/pageResidency.ts` (`composerCover()`); `ac389a949`: the boot smoke boots
  Developer Signal standalone.
- `c075fbb21`: the rocks slice (`generators/rocks.ts` → `baked/rocks.glb` + `data/rocks.json`). Share 4.3 → 5.8 %.
- `ee786f9ed`: the dressing slice (`generators/dressing.ts` → `baked/dressing.glb` + `data/dressing.json`), the shared
  kind baker `generators/kinds.ts` and the generic client `world/baked.ts` (`loadBakedWorld()` / `bakedPiece()` over
  `boot/files.ts` `BAKED_PIECES`). Share 5.8 → 12.7 %. The dressing's empty kinds are not baked (instance colours and
  wind sway would have to come first).
- The tower slice (gen4, this commit): `generators/tower.ts` `buildTowerFrame()` builds the frame as before (legs,
  lattice, deck, planks, rail, crown, rods, antenna, red lamp, the keeper lamp's iron cage, stair, stringers: 127
  meshes) and `towerKinds()` folds it into eight instanced kinds (each box an instance of one unit box, its size in the
  instance scale; the antenna and the red lamp one-instance kinds) → `baked/tower.glb` + `data/tower.json` (40
  colliders, byte-equal to the old builder's, and `anchors: { deckY, lampY }`). `world/tower.ts` keeps only the live
  parts: the keeper's glass, halo and flame, the HD brazier (code stand-ins and kindling), the signal fire and light.
  Kind rows now carry `metalness`, `flat`, `emissive`, `emissiveIntensity` (rocks / dressing rows rebaked, GLBs
  byte-identical); colliders without a yaw pass through without one; `metal` is a baked surface. The Model Explorer's
  tower draws the world's bake (`lastBakedWorld()`, loaded by `roster()`), its deck ground at the origin (the legs now
  reach the world's dune, not flat ground). Share 12.7 → 15.6 % (public 668 / custom 3618).
  Proof: geometry-exact vs HEAD's builder (127 / 127 meshes, same corners and materials; the 7 others are the client's
  stand-ins and kindling); pixels within run-to-run noise on all 8 poses; draw calls phone spawn 192 → 73, quest
  157 → 58, desktop spawn 254 → 135; meshes 384 → 265, geometries 230 → 111; post-GC heap 24.6 → 23.8 MB; load
  median within noise; physics rebake changes only the tower piece's `file`; walk 0 stuck; boot smoke + facade PASS.
  Programs 54 → 55 (one instanced smooth-standard variant). The map bake is nondeterministic run to run (~120–160 px
  differ between two bakes of one build), so its diff is noise.

## The invariant recipe (one slice, about 45 min)

1. Work in a clean export (`git archive HEAD` + `scripts/link-node-modules.mjs` + `pnpm gen`) and a private index
   (`GIT_INDEX_FILE=… git read-tree HEAD`, `git --work-tree=<export> add -- <paths>`); `git commit-tree` a candidate (no
   ref). Serve `--rev HEAD`, then `--rev <cand>`, one preview at a time.
2. Pixels: `node scripts/parity.mjs --url=<preview> --shards=sunscar-dunes --tiers=phone,desktop --only=fingerprint+poses
   --out=<dir>` on both builds; compare before vs after against each build's `run-1/` vs `retry/` noise (the m5 baselines
   are stale). Phone quest differs at the held glove (its idle phase), never the world.
3. Colliders: `scripts/browser-lane.sh node scripts/bake-signal-physics.mjs --url=<preview> --revision=<full sha>` from the
   export (it hashes its inputs from its own root).
4. Walk: `scripts/browser-lane.sh node scripts/physics-baseline.mjs --no-build --mode=walk --shard=sunscar-dunes
   --url=<preview>` (move `progress/physics/p0-*.json` out).
5. Map: `scripts/browser-lane.sh node scripts/bake-maps.mjs --url=<preview> --shards=sunscar-dunes` in the export; stage
   `look/map.baked.json` + `map/top.webp`.
6. `node scripts/parity/boot-smoke.mjs --url=<preview>`; `node scripts/test-facade-instancing.mjs --url=<preview>`.
7. Export: `node scripts/generated-files.mjs --write` (graph check only, never commit), `pnpm typecheck`, oxlint, ratchet,
   shard-coupling, then `python3 scripts/heavy-lane.py full-test -- pnpm exec vitest run`.
   Load (`boot.playMs`) is noisy by ±0.6 s run to run: take 3–4 fingerprint runs per build.
8. The ratchet already reports `boot/files.ts: shard-sandbox is clean; run --update` on HEAD (a stale 1 in
   `lint/ratchet.json`, which the serialized regen owns): not a rise.

## Next, in order

1. `world/places.ts` (420: caravan, well, brazier): animated sub-parts (the well's bucket, rope, crank, jar; the
   braziers' fire / oil) as named GLB nodes the client finds by name, or kept live like the tower's lamp and fire
   (`generators/tower.ts` shows the fold: build the static meshes as before, fold them into kinds, keep live parts in
   the client on baked anchors). `models/gear.ts`'s caravan / well / brazier models then draw the bake like the tower.
2. The `species/` rigs (288) → baked GLBs; the look tables (`minimap`, `far`, `dusk`, `families`) → `data/` rows.
3. The frame-floor desktop row for Signal on the run's last slice.
