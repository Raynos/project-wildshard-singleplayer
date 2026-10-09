# Handoff (sf72-driftwood4) — 2026-10-09, SF72 Driftwood Isle headless part 4

Coordinator `wildshard-new` pushes. Driftwood's canonical witness (`test/proof/driftwood-isle/`) is UNCHANGED and still
fails closed (its entry is still `runtime/hybrid.ts`). Supersedes the "Exact next steps" of `sf72-driftwood3.md`.

## Landed (this lane)

- `6643c0e2e` the navmesh split: `src/engine/physics/navmesh.ts` is renderer-free (format, parse, queries; query cost via
  `Navmesh.costSink`); `activeNavmesh` / `setActiveNavmesh` / `loadNavmesh` live in `src/engine/physics/navmeshLoad.ts`.
  Oracle `test/navmesh-oracle.test.ts`: Driftwood + Pine answer 400 recorded queries exactly, vitest and plain Node.
- `4a218c00d` fauna decisions: `runtime/keeper.ts` runs the 13 boars / bears through `HuntBrain` (island rows, manifest
  fauna tuning, the navmesh, smoothed player speed, reach; charge → PlayerHurt.creature's blow; damage.dealt → hurt / died).
  `runtime/fauna.ts` reads each fauna body's spawn, yaw and herd centre back off the creature stream (the bake's `at` is a
  memory goal: creature:0 had already retargeted). Wakes on lost sight and non-lethal fauna hits; every creature's attack
  turn is capped (ATTACK_TURN). Continuation v2 carries the memories, the brain clock, the speed meter and sight.
- The navmesh reaches Node as `runtime/navmesh.baked.json`, a byte copy of `public/assets/baked/driftwood-isle/navmesh.bin`
  (test-held equal). **After any Driftwood navmesh rebake, run `node scripts/bake-driftwood-navmesh.mjs`.** It is not an
  admitted shard file: Driftwood's Shardfile admits none and admission parses by kind (glb / ktx2 / audio / module).
- The practice crab's replacement takes the manager's next entity id (creature:34, …) from the engine's own `EntityIds`
  (`@wildshard/engine/entities/ids`), saved in the continuation; the captain must allocate from the same allocator.

## Still different from the browser (each stated in keeper.ts's header)

1. Body bands: the host steps every spawned body every tick (`SimHost.stepSystems` → `entity.step`); the browser halves
   bodies 60–160 m out and pauses them past 160 m (`TickScheduler.bodyDt`). Needs a small host seam (a per-entity body dt
   or a keeper-owned body step). Pine's handoff (`1c3c931ff`) names this body-band host seam as its next step:
   reuse it, don't build a second.
2. A charge's contact is tested at the next keeper step (the host steps bodies after its systems) against the player where
   the charging tick saw it, so the knockback starts one tick later than the browser's.
3. No `target.attack` / `target.dodge` wakes and no `hunt.staggered`: wire them when the swords land (weapon.fired →
   interrupt every aggressive or sensing body; a stagger → `hunt.staggered(a, strength, running)` for fauna).
4. No `clearBody` (a big body pushed off the camera within 6 m).
5. A monkey's coconut releases nothing.

## Exact next steps (in order)

1. Coconuts on `host.physics` (`COCONUT_BODY`, 8 damage on the feet→head segment within 0.45 m, landing, 4 s rest /
   16 s age, float on the sea), then `world.throwCoconut` in keeper.ts.
2. The captain: one view-free boss script shared by the browser and headless (as Signal's Matriarch `fbd8b15b6` and Sky's
   Roc `3361c50c3`); his spec baked by setting `used:altar` in the bake; he allocates his entity id from the keeper's
   `EntityIds` in the browser's spawn order.
3. Swords (then item 3 above), quest / ledger, `proveEntries`, the witness (flip `compatibility.json` only from a run).
4. Fold the keeper into `@wildshard/game/shardfile/homeKeeper` (`4dca8153a`) where it fits (stream, tokens, restore);
   Driftwood's extras (stream-read fauna placement, structure floors, the practice crab) stay shard code.

Plan-State: unchanged.
