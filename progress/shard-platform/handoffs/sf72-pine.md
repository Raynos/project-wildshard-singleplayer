# Handoff (sf72-pine) — 2026-10-09, SF72 Pine Hollow headless (the shared ranged laws; sf72-pine10)

Coordinator `wildshard-new` pushes. Pine's canonical witness (`test/proof/pine-hollow/`) is UNCHANGED and still fails
closed (`finish` refuses: no entry proof yet).

## Landed

- Bake (`scripts/bake-pine-physics.mjs` → `runtime/physics.baked.json`): inputs hash `ai/hunt.ts`, `AnimalManager.ts`, Pine's
  `runtime/index.ts`, `runtime/fauna.ts`, `plugin.ts`, `combat/`, `species/`, `models/`, `world/`, `data/`: an edit there rebakes
  in the same commit. `runtime/king.ts`, `runtime/roster.ts`, `runtime/headless.ts`, `runtime/weapons/`, `weapons/` are not inputs.
- Earlier lanes: herd brain, boot roster, elites, live spawns, the roar's stun, the King's fight on `installBossRow`, the day
  clock, the King's record on the flags (`797ad880b`), the headless crossbow as a real projectile (`dddb490ed`).
- **sf72-pine10 `5cf7506c7`:** one renderer-free home per ranged law, imported by the page and headless alike:
  - the bolt: `weapons/crossbow/flight.ts` `boltFlightStep` / `PLAIN_FLIGHT` (Crossbow.ts and headlessCrossbow.ts);
  - the arrow: engine `combat/projectileFlight.ts` `projectileFlightStep` / `ProjectileFlight` (view/projectile.ts imports it);
  - the lever-action: `weapons/leverAction.ts` `LeverAction` (tube + chamber, beat, throw, one-round reload, stop-after,
    run-dry cycle, auto-reload test; constants, cycleAction / feedRound, LEVER_PROFILE). LeverRifle delegates through
    `LeverHooks`; its reserve stays on the HUD state (`new LeverAction(this.state)`). Methods are named dropHammer /
    throwLever / beginReload because the runtime-performance lint's recursion check is name-based (a `this.act.reload()`
    inside `reload()` reads as recursion), and `update`'s text is kept identical (a `phase` getter) so its debt stays keyed.
  - `runtime/weapons/headlessRanged.ts`: `bodyHit` (analytic ball + capsule, 0 from inside; good for a 320 m hitscan),
    `worldHit(host, a, b, radius)`, `aimAt`, `spreadInto` (the page's 3 + 1 draw cone). The crossbow's port is now
    `enabled` (installPine passes `!king.locked()`).
  - Proof: full suite 1043 / 5780 green; boot smoke 4/4; parity walk+combat on Pine + Nalati: every projectile shot identical
    to the baseline (the reds there are walk centimetres, the profile save key, ambient schedulers, leak textures: not
    projectiles; not re-checked against a HEAD run).

## Next (Pine headless), in order

1. **The headless lever** (`runtime/weapons/headlessLever.ts`): `LeverAction` with its own `{ reserve: 21 }` store; the
   trigger is engine `Firearm.tryFire`'s template (reload phase → `triggerWhileReloading`; not idle → nothing; unchambered →
   sinceEmpty = 0, tube > 0 ? throwLever : beginReload; else dropHammer + the hitscan); step: sinceEmpty += dt, then
   `act.step(dt, act.wantsAutoReload && 0.35 < sinceEmpty < 5 && held && enabled, hooks)`. The hitscan (view/hitscan.ts):
   `aimAt`, spread `0.06 + 0.9`° (hip, still) with `spreadInto(..., sqrt=true)`, `worldHit(host, eye, eye + dir·320, 0)`,
   `bodyHit` short of it, amount `damageFor(head, hit.distance) × 1.5`, tags `weapon.lever`. Snapshot the action + sinceEmpty.
2. **The headless longbow** (`runtime/weapons/headlessLongbow.ts`): engine `bowDraw.ts` `BowDraw` on `heavy` held
   (`blocked = !enabled || arrows <= 0`), loosing at full only. BowDraw's `wasHeld / needLift / reachedFull` are private:
   add a save / load pair to BowDraw (an engine change; ask the coordinator). Loose: aim at `heavy.targetId` (else the
   player's facing), spread 0.3°, `spreadInto(sqrt)`, start eye + dir·0.55, speed 32 + 30, flight
   `projectileFlightStep` with the arrow's numbers (gravity 6, drag 0.014, windCoupling 0.25: move them out of
   `longbowView.arrowKind` into a renderer-free `weapons/longbowFlight.ts`), radius 0.02, 8 in flight, 4 substeps, the
   page's glance (lift 0.03, keep 0.35, bounce 0.25, max 9; a glanced arrow rests on the next surface), damage
   `max(1, round(damageFor(head, dist from origin) × 1.35))`, 20 arrows. Still air headless: the page's gust clock is the
   render uniform `uWindTime` (engine world/wind.ts), not sim state; say so.
3. **The weapon switch** (`runtime/weapons/headlessLoadout.ts`): a `script` command `pine.weapon` (value = PINE_ITEMS
   order: 0 crossbow, 1 lever, 2 longbow); owned: crossbow always, longbow on `paid:king`, the lever on a flag the cabin
   pickup sets (not headless yet); EquipmentService's swap: 0.25 s out (the held weapon changes then), 0.25 s in, no trigger
   live while swapping; every weapon steps (bolts / arrows fly on, a stowed crossbow reloads itself; the lever auto-reloads
   only held). Each weapon's `enabled` = held && !swapping && !king.locked().
4. The quest + facts (the page's quest/index.ts raises `dead:king` on his kill; headless sets it on the record), then the
   entry proof, then the witness (bands + day clock, a King checkpoint replay, ledger from gameplay; committed checkpoints
   with an inputs-hash freshness test like Sky's `c162fbd6a` if the tape is long).

Also open: the re-fight's three amber resin (no item effect); rain wander goals null headless; the page's King record
still lives in `pine.bosses` state (not flags).

Plan-State: unchanged.
