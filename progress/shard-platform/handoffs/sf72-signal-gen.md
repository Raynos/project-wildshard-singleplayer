# Handoff: sf72-signal-gen (SF72, Signal Dunes' code-built world → offline bake), 2026-10-09

Status: unfinished. Landed so far (lanes sf72-signal-gen2 … gen5):

- `9fb0cca1d`: SF57 fix in `src/game/grid/pageResidency.ts` (`composerCover()`); `ac389a949`: the boot smoke boots
  Developer Signal standalone.
- `c075fbb21`: rocks (`generators/rocks.ts` → `baked/rocks.glb` + `data/rocks.json`). Share 4.3 → 5.8 %.
- `ee786f9ed`: dressing, the shared kind baker `generators/kinds.ts` and the generic client `world/baked.ts`
  (`loadBakedWorld()` / `bakedPiece()` over `boot/files.ts` `BAKED_PIECES`). Share 5.8 → 12.7 %.
- `7757f1119`: the tower frame (`generators/tower.ts` → `baked/tower.glb` + `data/tower.json`, eight instanced kinds,
  anchors `deckY` / `lampY`). Share 12.7 → 15.6 %.
- gen5 (this commit): the desktop frame-floor row on `7757f1119` (PASS 59.88 fps) and the places slice.
  `generators/places.ts` builds the caravan's code parts (barrel, logbook, lantern iron, tent, cookfire stones) and the
  well's marker pole as the world showed them over the shipped generated models, folds them with the new generic
  `foldKinds()` (`generators/kinds.ts`: boxes of one look → instances of one unit box; any other geometry one kind per
  shape and look) → `baked/caravan.glb` + `data/caravan.json` (8 kinds, 4 colliders, anchors `y`, `logbook`, `lamp`),
  `baked/well.glb` + `data/well.json` (2 kinds, 15 colliders, anchor `y`), `data/braziers.json` (rows only: each
  waymark's footing `y` and 2 colliders). A kind row may carry `warm: true` (the material's `userData.warm`; the client
  runs `warmByFire`); it is emitted only when set, so the older rows and GLBs stay byte-identical. `world/places.ts`
  keeps the generated models on the baked frames and what lives (lantern glass and halo, cookfire, the well's shaft
  disc, bucket, rope, jar and crank, the waymarks' oil, kindling crown and fire). **The code stand-ins are gone**
  (code / facet-painted wagon, code crates and sacks, code well ring and posts, code brazier, plinth tiers, stones,
  banner pole and lantern): a generated model that fails to load now stands undrawn with its colliders in place, the
  baked pieces' own policy. The Model Explorer's caravan / well / brazier draw the bake, centred at the origin.
  Share 15.6 → 18.8 % (public 791 / custom 3420); runtime + trusted 855 / 965.

## The invariant recipe (one slice, about 45 min)

1. Work in a clean export (`git archive HEAD` + your files + `scripts/link-node-modules.mjs` + `pnpm gen`) and a
   private index (`GIT_INDEX_FILE=… git read-tree HEAD`, `git --work-tree=<export> add -- <paths>`); `git commit-tree`
   a candidate. Serve `--rev HEAD`, then `--rev <cand>`, one preview at a time.
2. Pixels: `node scripts/parity.mjs --url=<preview> --shards=sunscar-dunes --tiers=phone,desktop --only=fingerprint+poses
   --out=<dir>` on both builds; compare before vs after against each build's `run-1/` vs `retry/` noise (>24/255).
3. Colliders: `scripts/browser-lane.sh node scripts/bake-signal-physics.mjs --url=<preview> --revision=<full sha>` from
   the export; diff pieces / spots structurally (only `file` fields and `inputs` should move).
4. Walk: `scripts/browser-lane.sh node scripts/physics-baseline.mjs --no-build --mode=walk --shard=sunscar-dunes
   --url=<preview>` from the export.
5. Map: `scripts/browser-lane.sh node scripts/bake-maps.mjs --url=<preview> --shards=sunscar-dunes` in the export.
6. `node scripts/parity/boot-smoke.mjs --url=<preview>`; `node scripts/test-facade-instancing.mjs --url=<preview>`.
7. Export: `git init` it (check-graph and generated-files need a repo), `node scripts/generated-files.mjs --write`,
   `node scripts/check-graph.mjs --paths`, `pnpm typecheck`, oxlint, ratchet, shard-coupling,
   `node scripts/shard-platform.mjs` (the share), then `python3 scripts/heavy-lane.py full-test -- pnpm exec vitest run`.
8. Load (`boot.playMs`) swings with the machine's load average (35 vs 17 moved it by 1 s): interleave before / after
   fingerprint runs and compare runs taken at similar load.
9. `node scripts/frame-floor.mjs --shards=sunscar-dunes --surface=desktop --rev=<sha>` (it serves its own build).

## Next, in order

1. The `species/` rigs (288 lines) → baked GLBs (`@wildshard/sdk/bake/glb`); `models/gear.ts` follows.
2. The look tables (`minimap`, `far`, `dusk`, `families`) → `data/` rows.
3. Optional: `DUNE_MESHES` still preloads the facet-painted `caravan` (unused since wagon-hd2 shipped, and before this
   slice too); dropping it from `boot/files.ts` saves a fetch and a geometry. `waymark-brazier` is still the tower's
   stand-in.
4. Note: lane sf72-sky-gen is promoting `generators/kinds.ts` and `world/baked.ts` into the SDK; sequence with it
   through the coordinator before touching either.
