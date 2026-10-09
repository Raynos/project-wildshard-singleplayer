# Handoff: sf72-signal-gen (SF72, Signal Dunes' code-built world → offline bake), 2026-10-09

Status: unfinished. Landed so far (lane sf72-signal-gen2):

- `9fb0cca1d`: SF57 fix in `src/game/grid/pageResidency.ts`. `composerCover()` covers the composer only while (other
  covered bytes + composer) ≤ the measured home; otherwise the composer is charged uncovered. This was the rocks
  candidate's "Runtime cache coverage exceeds its measured bytes" blocker, and Signal was red on main with it (70 MB phone
  composer against a 49 MB home already 48 MB covered by commons). It was never the GLB, so no runtime-cost re-measure.
- `ac389a949`: the boot smoke boots Developer Signal standalone (`bootCase(..., developer)`).
- `c075fbb21`: the rocks slice (`generators/rocks.ts` → `public/assets/sunscar-dunes/baked/rocks.glb` + `data/rocks.json`,
  `world/baked.ts`, dead `world/buttes.ts` dropped) with the native physics rebake and the map rebake.
  Share 4.3 → 5.8 % (public 247 / custom 3989); runtime + trusted 855 / 965. Graph `shards/sunscar-dunes → sdk` 12 → 13.

## The invariant recipe that worked (one slice, about 45 min)

1. Candidate: private index from HEAD + the slice, `git commit-tree` (no ref), `scripts/serve-build.sh --rev <cand>`;
   the before build is `--rev HEAD`. One preview at a time.
2. Pixels: `node scripts/parity.mjs --url=<preview> --shards=sunscar-dunes --tiers=phone,desktop --only=fingerprint+poses
   --out=<dir>` on both builds (the m5 baselines are stale, so compare before vs after). Each out dir has `run-1/` and
   `retry/` shots: the run-to-run diff of each build is the noise floor (phone quest about 8,600 px from the fire).
3. Colliders: `scripts/browser-lane.sh node scripts/bake-signal-physics.mjs --url=<preview> --revision=<full sha>`.
   Run it **from a clean export of the candidate** (`git archive` + `scripts/link-node-modules.mjs` + `pnpm gen`): the
   script hashes its inputs from its own root, so a working-tree run writes the wrong `inputs`. A before-build run
   proves the before is fresh (only revision / build differ).
4. Walk: `scripts/browser-lane.sh node scripts/physics-baseline.mjs --mode=walk --shard=sunscar-dunes --url=<preview>`
   (it writes `progress/physics/p0-*.json`: move it out, don't commit it).
5. Map: `node scripts/bake-maps.mjs --url=<preview> --shards=sunscar-dunes` from the same export, then copy
   `look/map.baked.json` + `public/assets/sunscar-dunes/map/top.webp` into the landing index.
6. `node scripts/parity/boot-smoke.mjs --url=<preview>` (now includes Developer Signal); `node
   scripts/test-facade-instancing.mjs --url=<preview>`.
7. In the export: `node scripts/generated-files.mjs --write`, `pnpm typecheck`, oxlint, ratchet, shard-coupling, then
   `python3 scripts/heavy-lane.py full-test -- pnpm exec vitest run`. Land with commit-tree + `update-ref NEW OLD`, then
   sync the shared index and disk copies of the landed paths (GIT.md).

## Next, in order

1. `world/dressing.ts` (297 lines): the static scatter part to `generators/`; its `tick` stays in the client.
2. `world/tower.ts` (117), then `world/places.ts` (294: caravan, well, brazier); animated sub-parts as named GLB nodes;
   `models/gear.ts` builds them for the Model Explorer, so it moves to the bake too.
3. The `species/` rigs (288) → baked GLBs; the look tables (`minimap`, `far`, `dusk`, `families`) → `data/` rows.
