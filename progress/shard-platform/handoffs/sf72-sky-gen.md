# Handoff (sf72-sky-gen): Sky Reach toward 80/20, after part 3 (2026-10-09)

Landed in part 3 (nothing of Sky is uncommitted in the shared tree):

- `3df45db44`: `layout.ts` / `strings.ts` → `data/layout.ts` / `data/strings.ts` (pure data; `test/row-data.test.ts`
  refuses functions in `data/`, so `ropeSag`, `knollHeight`, `apothem`, `rimAlong`, `spireAt` stay in the root
  `layout.ts`) and the Roost as an offline bake (`generators/roost.ts` → `baked/roost.glb` + `data/roost.json`, tints as
  rows). Share 5.2 → 8.5 %.
- The docks commit: `world/skyDock.ts` → `generators/skyDock.ts` → `baked/docks.glb` + `data/docks.json` (2 kinds, the
  timber tints as rows); the headless quest test's restore checks on `expectSameSimSnapshot`. Share 8.5 → 9.7 %.

Proofs and numbers: `progress/shard-platform/m3-status/sky-8020.md` (the slices table and each slice's proofs).

## The recipe that worked

Clean export (`git archive HEAD` + the change, `scripts/link-node-modules.mjs`, `pnpm gen`); commit-tree a candidate,
`scripts/serve-build.sh --rev <cand>`; `node --import ./scripts/bake-loader.mjs scripts/bake-sky-world.mjs`;
`scripts/bake-sky-physics.mjs --url --revision=<cand>`; `scripts/bake-maps.mjs --shards=far-reach`; the witness
checkpoints (`test/proof/far-reach/run.mjs checkpoints`); parity poses from the main checkout
(`scripts/parity.mjs --url --shards=far-reach --tiers=phone,desktop --only=fingerprint+poses`) compared run-1 vs
run-1 against each build's retry noise. The map bake is not reproducible run to run, so the minimap pixels move with
every map rebake; the world pixels are the check. Make the export its own repo and `node scripts/generated-files.mjs
--write` before the full suite, or AG7 fails on the new edges.

## Next, in order

1. Book stands: the book is code geometry on a modelled (textured, runtime-loaded) lectern; bake the book and the
   code fallback stand, keep the lectern / lantern models live.
2. Crown arena (`world/crown.ts` + `runtime/crownLayout.ts`).
3. Knolls: need a hull collider row; extend `@wildshard/game/shardfile/bakedKinds` collider rows (boxes only today)
   honestly, with a test.
4. Bridges / decks as instanced kinds (the fallen bridge stays a named node under its live pivot).
5. The isles: replay their `cosmetic` stream draws exactly (the storm reads the stream after them); never reseed.
