# Handoff (sf72-driftwood, part 9) — 2026-10-09, SF72 Driftwood Isle headless

Coordinator `wildshard-new` pushes. Supersedes part 8's "Exact next steps". Driftwood's canonical witness
(`test/proof/driftwood-isle/`) is UNCHANGED and still fails closed (its entry is still `runtime/hybrid.ts`).

## Landed (part 9, one commit: see the report's SHA)

- **The engine seam:** `PLAYER_BODY` (physics/CharacterMotor.ts) is the player's one body law, spread by the page's
  Player and SimHost's player motor: group PLAYER, `blockedBy: ['WORLD','CREATURE','ITEM']`, weight 80. (The host's old
  `'PLAYER'` entry was a no-op: PLAYER's own filter never meets PLAYER.) The host's creature motors are unchanged. Oracle:
  `test/engine/sim-player-items.test.ts` (the two motors' law is equal; both push a BARREL_BODY > 1 m on the same input).
  Sky's checkpoints regenerated in the same commit; every walk tape and baseline test stayed green.
- **One barrel law:** `@wildshard/engine/world/interact/barrel` (renderer-free: BARREL_BODY, BARREL_R / HALF, BarrelEnv,
  BarrelWatch + state / restore, barrelAtPlate). Interactables.ts imports it (no behaviour change; physics-barrel.test.ts
  and physics-bodies.test.ts repointed, green). Approved graph rise (+1 engine node, 3 edges).
- **The headless barrel (runtime/quest.ts):** the kit's body at the baked `tide-barrel` home, upright on its yaw, in its
  own `Bodies` service over the host world (post → BarrelWatch → pre each tick = the page's pre / step / post order); the
  watch reads the walk the tick's last `player` command asks for (headless.ts `walkOf`: stick clamped to 1 × level speed);
  restore adopts the native body by handle (`physicsRestored`) with the watch's clocks. The open sluice disables its baked
  collider (found by its kit box; the page parks it once the gate starts to lift, a tick later than here).
- **By play:** headless-quest.test.ts rolls the barrel north east of the cave rocks at a slow walk, then pushes it west
  into the rock face beside plate b (the face stops it on the plate; retried from the side it lies on), stands on plate a,
  the sluice latches open, walks in through the gate and takes the cave shard (`driftwood.shards@shards:3`). The hand-set
  `shard:cave` is gone. Test ~3 s.

## Not done this part (in order)

1. **Browser check of the barrel** (coordinator asked): a Driftwood browser push of the barrel onto plate b on a build of
   this commit. Not run (time cap); the browser change is a pure module move plus an identical options spread.
2. **The swords' new inputs** (a0aa16128): Driftwood's dodge wake on `host.events.on('player.dodge')`, the heavy swing
   from the HELD `heavy` command (`SweptMeleeCore.step(dt, t, scale, held)`), the lunge via `host.dashTo` + `sweptLunge`.
3. **Night respawns (Ecology.ts)**: the RespawnQueue on the 'spawn' stream, the sailor's night gate on `host.dayClock.night`.
4. **Entry proof**: the outer lanes (±3.65 m) of the 8 m entries step off the jetty's side at 16.5 m into the lowered sea
   (page too). Check the grid's entry contract; if the declared entry is wider than the deck, propose narrowing the
   declared lanes (shard.config / shardfile data, map rebake) or rails to the coordinator with numbers BEFORE changing data.
5. A freshness check for `runtime/spots.baked.json` (inputs hash, like the physics bake's).
6. The witness on `runtime/headless.ts` (10k, a captain mid-fight replay checkpoint, ledger from gameplay; committed
   checkpoints + freshness if the tape is long); point `run.mjs` at the trusted entry; flip `compatibility.json` only from
   a real run.

## Still different from the browser

Part 8's list, plus: the barrel watch's "asked velocity" is the stick's walk (the page's Player.velocity also carries a
dash / knockback); the sluice collider leaves one tick early; no zipline; the shown strongbox keeps no collider.

Plan-State: unchanged.
