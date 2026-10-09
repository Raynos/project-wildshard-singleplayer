# Handoff: sf72-signal-gen (SF72, Signal Dunes' code-built world → offline bake), 2026-10-09

Status: unfinished. Landed so far (lanes sf72-signal-gen2, sf72-signal-gen3):

- `9fb0cca1d`: SF57 fix in `src/game/grid/pageResidency.ts` (`composerCover()`); `ac389a949`: the boot smoke boots
  Developer Signal standalone.
- `c075fbb21`: the rocks slice (`generators/rocks.ts` → `baked/rocks.glb` + `data/rocks.json`). Share 4.3 → 5.8 %.
- The dressing slice (gen3, this commit): `world/dressing.ts` → `generators/dressing.ts` (`bakeSignalDressing`) →
  `public/assets/sunscar-dunes/baked/dressing.glb` (carcasses 5, trees 1, scree 60: one instanced node each) +
  `data/dressing.json` (1 tree collider). The shared kind baker is `generators/kinds.ts` (rocks use it too; their GLB is
  byte-identical). The client is generic: `world/baked.ts` `loadBakedWorld()` / `bakedPiece(baked, piece)` over
  `boot/files.ts` `BAKED_PIECES`. A new piece = a generator returning `bakeKinds(...)`, a `PIECES` row in
  `scripts/bake-signal-world.mjs`, a `BAKED_PIECES` + `BAKED_URLS` entry, a `data/<piece>.json` import in `world/baked.ts`.
  The dressing's empty kinds (shrubs, tufts, posts, cairns, outcrops, gravel: E399 counts are 0) are not baked, and
  their wind sway is gone from the client; `bakeKinds` refuses a kind with per-instance colours (shrubs / tufts), so
  raising those counts means baking instance colours and bringing the sway back first.
  Share 5.8 → 12.7 % (public 538 / custom 3693; `node scripts/shard-platform.mjs`); runtime + trusted 855 / 965.

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

1. `world/tower.ts` (156), then `world/places.ts` (420: caravan, well, brazier); animated sub-parts (the well's bucket,
   rope, crank, jar; the braziers' fire / oil; the tower fire / light) as named GLB nodes the client finds by name;
   `models/gear.ts` builds them for the Model Explorer, so it moves to the bake too. `bakeKinds` handles instanced kinds
   only: plain nodes need a `staticGlb` path without `instances` and a by-name lookup in `world/baked.ts`.
2. The `species/` rigs (288) → baked GLBs; the look tables (`minimap`, `far`, `dusk`, `families`) → `data/` rows.
