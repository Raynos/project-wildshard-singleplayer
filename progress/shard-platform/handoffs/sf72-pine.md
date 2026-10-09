# Handoff (sf72-pine) — 2026-10-09, SF72 Pine Hollow headless (live spawns and the roar's stun; sf72-pine7)

Coordinator `wildshard-new` pushes. Pine's canonical witness (`test/proof/pine-hollow/`) is UNCHANGED and still fails
closed (`finish` refuses: no entry proof yet).

## Landed

- Bake (`scripts/bake-pine-physics.mjs` → `runtime/physics.baked.json`): inputs hash `ai/hunt.ts`, `AnimalManager.ts`, Pine's
  `runtime/index.ts`, `plugin.ts`, `combat/`, `species/`, `models/`, `world/`, `data/`: an edit there rebakes in the same
  commit (build the candidate with `scripts/serve-build.sh --rev <candidate>`, bake with `--revision=<candidate>`).
- Earlier: herd brain, placement, boot roster id for id, `runtime/headless.ts` + `runtime/roster.ts`; the elites' seeded
  streams, the bare `Lane`, the roster on the host's bands; `@wildshard/game/eliteSystem` EliteCore and the shared
  `combat/eliteScripts.ts` run headless in `runtime/elites.ts` (sf72-pine5, sf72-pine6).
- **sf72-pine7:**
  - Live creature spawns: `installPineRoster(...).spawn` is AnimalManager.spawnAnimal in play (the stream's rolls, the
    manager's next entity id: the list + prewarm took creature:0–167, so the first live spawn is creature:168; the recipe
    the bake read for that kind and variant; the creature floor from `max(spawn.y, ground) + 1`); `retire` too. The list is
    dynamic (bounded by `LIVE_MAX` 512). A restoring install reinstalls each saved live spawn from the host's own
    `runtime.actor.<id>` recipe, in saved order, after the roster's step (`ports.saved` = `context.snapshot`).
  - An elite's 20-minute respawn and the Imperial Bull's two rivals go through it. The elites' continuation (version 2) names
    each script's body by entity id; the Imperial Bull's fields save each rival lane's bull (`rival<i>`: creature number,
    `rivalCharge<i>`). `PineEliteWorld.find(id)` (page: the manager's list) resolves them.
  - The roar's stun: the page's `effect.stun` (moveLocked, refresh) roots the host's player where the roar caught them for its
    seconds (the elites' step holds position + motor after the host's move); saved as `stun` in the elites' continuation.
  - `runtime/headless.ts` `installPine(host, parts)`: the install as a function with optional `dusk` / `night` ports (the
    tests hold dusk at 1 to make him bugle).
  - Tests (`test/shards/pine-hollow/headless-runtime.test.ts`): respawn as creature:168 + exact restore; bugle → rivals
    creature:168/169 + exact restore on their way in; a rival charges + exact restore mid-charge; roar roots 1.3 s + exact
    restore mid-stun. One checkpoint per test, `expectSameSimSnapshot`, 90 s budgets (≤ ~23 s each under local coverage).

## Next (Pine headless), in order

1. Wire the day-night clock once sf72-clock lands it on SimHost: pass `dusk` / `night` from it into `installPine` (the
   Imperial Bull bugles on his own then). Until then dusk / night read 0 headless.
2. The Ghost Stag's fade hiding its hitbox: only meaningful with an aimed player weapon; do it with the weapons (a hidden
   body refuses the player's hit test, as the page's raycasts skip `hidden`).
3. One Antler King boss script over `installBossRow` (58d6abc9e), thralls through `Lane`, antlerKing.ts's two Math.random calls
   seeded (his prewarm bodies are parked in `roster.parked()`; spawn them through `roster.spawn`'s path with their baked ids);
   then player weapons as declared items, the quest + facts, the entry proof, the witness (headless 10k with bands → replay
   with a King checkpoint → ledger from gameplay). Flip `compatibility.json` only from a run.

Also open: rain wander goals (`creature.wander-goal`, weather.ts) are null headless; `weapon.fired` / dodge interrupts.

Plan-State: unchanged.
