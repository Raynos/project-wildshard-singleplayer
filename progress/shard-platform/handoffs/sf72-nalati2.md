# Handoff (sf72-nalati2) — 2026-10-09, SF72 Nalati Grasslands headless, part 2

Coordinator `wildshard-new` pushes. Supersedes the "Next" list of `sf72-nalati.md` (part 1). Nalati's canonical witness
(`test/proof/nalati-grasslands/`) is UNCHANGED and still fails closed. There is no `runtime/headless.ts` yet.

## Landed (this slice)

- The boot roster in plain Node, id for id: `runtime/bootRoster.ts nalatiBootRoster(ground, clock)` reproduces every body of
  the trusted bake (kind, variant, herd, seed, scale; the four herds' members) from the manager stream `Rng(0x4a1a + 31)`
  (six draws a spawn) and Wildlife's stream `Rng(0x4a1a ^ 0x3a17)` over the baked terrain grid
  (`public/assets/baked/nalati-grasslands/terrain.bin`, `bakedSamplers`), `TERRAIN.waterLevel()` and `nalatiWetAt`.
  Test: `test/shards/nalati-grasslands/boot-roster.test.ts`.
- **creature:24 is the Golden King**: `combat/goldenKing.ts` `fight.reset(0)` spawns him through his boss row
  (`bindRuntimeBoss(..., { identity: 'runtime' })`), then `setPresent(false)` takes him out of every list. The roster
  returns him as `parked`.
- Boot order: pack (0-4) → wild herd (5-19) → dog (20, herd 2 empty) → camp horses (21-22) → shepherd's horse
  (23, `creatures/sheepRaid.ts`) → the King (24, parked) → lair elites whose rule holds: Aqbars (25), Argymaq's herd (26-34)
  and Argymaq (35). Kokbori / Qyran / Qara Batyr are not modeled: a dusk / night / storm boot clock refuses.
- Renderer-free seams (shared with the page, not copies): `creatures/wildPlacement.ts` (Wildlife's free-spot test, pack /
  herd / dog placement and `NALATI_WILDLIFE`), `combat/eliteRoster.ts` (`NALATI_ELITE_DEFS`, `argymaqDefinition`,
  `eliteRuleHolds`, `NALATI_ELITE_ANIMALS`), `nalatiSpawnSpecies()` (the shipping wolf / horse / leopard / King rows, the
  sheepdog's variant, Argymaq's row). `species/wolf.ts` and `species/horse.ts` now load in Node: `runtime/groupDispatch.ts`
  no longer imports the app; manager-only fallback groups read `groupRegistry.ts fallbackGroupHost()`, which the page binds
  (`bindFallbackGroupHost(APP_GROUP_HOST)` in `runtime/state.ts attachAnimals`; unbound refuses).
- Rebaked `runtime/physics.baked.json`: actors, herds, floor, solids and trees byte-identical to part 1's bake; only the
  provenance (revision, build, input hashes) moved.

## Not yet (next, in order)

1. **Positions are unchecked against the page**: the bake has no positions (bodies move between captures). Add a load-time
   position capture (before the first think) to the bake, or a census, and compare `nalatiBootRoster` positions / yaws.
2. `runtime/headless.ts` (Signal's / Pine's shape): `ground: false`; the baked heightfield + `solids`; bodies via `host.spawn`
   with the baked spec at the roster's spots (creature floor as Pine's `creatureFloor`); **`host.useBodyBands()` before
   restore** (3d68396a2: the page's 60 / 160 m bands, capsules under 45 m; `host.brainDt(id, urgent)` for the decision clock).
   Drive the pack / herds with `PackBrain` / `HerdBrain` over `nativePackPorts` / `nativeHerdPorts` and a Node
   `NativeGroupHost` (`sharedRng`: the host's 'ai' stream; `register`: an aggression director); `bindFallbackGroupHost` the
   same host. The home keeper (`installHomeKeeper`) does not fit the groups (no declared homes, no respawn); reuse its
   restore shape (roster reinstall before host restore).
3. Still renderer-bound on that path: `creatures/env.ts` loads, but `nativePackPorts` → `combat/strikes.ts` and the elites
   (`combat/elites.ts`: app, EliteBar, param properties), `creatures/flock.ts` (app, shaders), `ride/*`, `combat/damage.ts`.
   The sabre: build on sf72-nine's `src/engine/combat/sweptMeleeCore.ts` (coordinator relays its SHA); never edit
   `SweptMelee.ts`.
4. Witness: headless 10k → replay → ledger (wolf feats) → entry proof.

Plan-State: unchanged.
