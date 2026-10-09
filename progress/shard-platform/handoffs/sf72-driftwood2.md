# Handoff (sf72-driftwood2) — 2026-10-08, SF72 Driftwood Isle headless part 2, 90-min cap

Coordinator `wildshard-new` pushes. Driftwood's canonical witness (`test/proof/driftwood-isle/`) is UNCHANGED and still
fails closed (its entry `runtime/hybrid.ts` is the browser boot). No browser or preview left running.
Supersedes the "exact next steps" 1–2 of `sf72-driftwood.md` (slice 1's handoff).

## Landed (this lane)

- The trusted native bake. `scripts/bake-driftwood-physics.mjs` (muted Chromium, iPhone 16 Pro / phone / DPR2, two equal
  same-page captures, a clean `serve-build.sh --head` preview; `--inputs=<clean export>` so the freshness hash never reads
  foreign WIP) writes `src/shards/driftwood-isle/runtime/physics.baked.json` (1.05 MB):
  - `ground`: Rapier's own 256² heightfield exactly as the page built it, the sea cave's `cutTerrain` included;
  - `solids`: 2067 fixed WORLD colliders (pier, jetties, entry landings / decks, hut, lookout, wreck, shrine, cove, trail,
    boulders, palms, paths, interactables, edge walls). The declared movers' bodies (boat kinematic, bridge chain
    dynamic) are excluded by body type; `data/movers.ts` is excluded from the input hash for the same reason;
  - `actors`: the 34 load-time bodies in the manager's order (13 fauna: 11 boars + 2 bears; 21 enemies: 9 crabs incl. the
    practice crab, 11 monkeys in 3 troops, the sailor) with model-derived specs, seeds, scales, herd, spawn point;
  - `herds` (kind + members), `habitat` (228 palm perches + bases in palm order, the hold + its 0.5 m floor lattice,
    crab sites, the practice crab's id).
- `runtime/placement.ts`: `placeEnemies()` — `creatures/Enemies.ts` placement renderer-free from `Rng(SEED ^ 0xe11e)`
  (crab groups, practice crab, troops, sailor), `holdCentre()`, and `WRECK_SITE` / `PRACTICE_AT` (held equal to the
  manifest by test). Loads in plain Node (policy-node.test.ts). Graph driftwood→engine +1 approved.
- `test/shards/driftwood-isle/physics-bake.test.ts` proves: input freshness; the baked floor equals the manifest field at
  every lattice vertex (< 5 cm) except the cave's cut vertices (0 < cut < 500); the enemies' seeds are the creature
  stream `Rng(SEED + 31)` from draw **148** on (after the fauna's anchor searches), 6 draws per named-variant body, 7 for a
  rolled monkey; `placeEnemies` reproduces every enemy's kind / variant / herd / point to 1e-9 against the bake; every
  baked solid rebuilds natively in Rapier.

## Not done: the brief said so, honestly

- **Step 1 as written (terrain out of `manifest.ts`) was not needed:** the bake carries the exact physics floor and the
  test proves it equals the analytic field, so headless uses the baked floor (Signal / Pine shape) and `manifest.ts` is
  untouched. (Also: `manifest.ts` is NOT a map-hash input — Driftwood's `look/map.json` has no `inputs`, so the default
  `shard.config.ts, layout.ts, world, generators, models` apply; no rebake was due.)
- The captain's spec is not baked (he exists only after `used:altar`); the coconut keeper, finale, swords, quest / ledger,
  entry proof and witness are untouched.
- Fauna (boars / bears) placement is the engine's anchor placer (`faunaLayout`); headless spawns them from their baked
  recipes (seed, scale, point) and starts the enemies' draws at stream offset 148 — not a replica of the placer.

## Exact next steps (in order)

1. **`runtime/headless.ts`** (`PrepareHeadlessRuntime`): `ground:false`, `heightAt` = the baked floor on Rapier's split
   (see the test's `floorAt`), colliders = the baked heightfield (`R.ColliderDesc.heightfield` from `ground.heights`,
   column-major already) + `solids` rebuilt as in the test, owned by `host.scope`. Level: `SEED` 0x5ea1, spawn
   (0, 1.2, −194) yaw π (E463).
2. **A keeper** (Signal's `homes.ts` pattern): one `Rng(SEED + 31)` advanced 148 draws past the fauna (or the fauna
   spawned from their baked recipes through the same six draws each, then verify the stream lands at 148); enemies from
   `placeEnemies(...)` via `host.spawn` with the baked spec per (kind, variant); monkeys' variant roll = one draw through
   the species' weighted table; per body the hybrid policy from `runtime/brains.ts` (`CrabBrain(SkirmisherBrain)`,
   `SailorBrain(GuardianBrain)`, `MonkeyBrain(PerchHunterBrain)` with `pickPerch` / `setPerch` over the baked perches)
   over host ports; 2 attack tokens; 10 Hz think / per-tick act; the practice crab's respawn (45 s, ≥ 30 m away);
   the sailor night-gated by `habitat.night`; restore reinstalls the roster before the host restore.
3. Coconuts on `host.physics` (`COCONUT_BODY`, 8 damage on the feet→head segment), then the captain (bake his spec by
   setting `used:altar` in the bake), swords, quest / ledger, `proveEntries`, the witness.
4. **Rebake** when sf72-herds lands its AnimalManager change (the coordinator will say): the bake hashes HEAD's
   `src/engine/entities/AnimalManager.ts`; `scripts/browser-lane.sh node scripts/bake-driftwood-physics.mjs
   --url=<clean preview> --revision=<sha> --inputs=<git archive of that sha>`.

Plan-State: unchanged.
