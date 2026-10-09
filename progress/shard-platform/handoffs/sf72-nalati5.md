# Handoff (sf72-nalati5) — 2026-10-09, SF72 Nalati Grasslands headless, part 5

Coordinator `wildshard-new` pushes. Supersedes `sf72-nalati4.md`'s "Not yet" item 1 (the grass half). Nalati's canonical
witness (`test/proof/nalati-grasslands/`) is UNCHANGED and still fails closed (`compatibility.json` not flipped).

## Landed (this slice)

- **The grass field is renderer-free** (`src/game/systems/looks/grassField.ts`): `GrassField` is the 4 m lattice over
  injected samplers (`GrassFieldPorts`: seed, half, height / normal / splat, trails, pads, ponds, water, the level's paint,
  the authored layout). The page's module functions delegate to one field over the installed terrain, rebuilt exactly where
  the old `reset()` ran (configure, dispose, level change): no page change.
- **The trample map's law is renderer-free** (`src/game/systems/looks/trample.ts`): `TrampleField` holds the amount / angle
  window, the stamps, the scroll, the tracked movers and the 10 Hz recovery; `GrassTrample extends TrampleField` adds the
  live-mover uniforms and the RG8 texture through `frame()` / `texels()` / `uploaded()` hooks. Same arithmetic, same order.
- **The headless groups read the page's grass** (`runtime/headless.ts nalatiGrassView`, `runtime/groups.ts
  nalatiHeadlessEnv(grass)`): a `GrassField` over the baked grid + `TERRAIN` + `NALATI_GRASS_LAYOUT` on the level seed, and a
  host-owned `TrampleField`; `grassStandingAt` = the field, `grassHeightAt` = field × (1 − 0.85 × trample), `trample` pushes.
  `NalatiGroups.env` exposes the view. The colour channels use the field's plain default (no headless reader).
- **The bake samples the page's grass** (`scripts/bake-nalati-physics.mjs`, `physics.baked.json grass`): `grassBaseHeightAt`
  at the 35 tick-0 spots + a 48² off-lattice grid, read through the page harness's new `grassBase` handle
  (`runtime/index.ts`). Inputs now include `grassField.ts` and `look/grassFieldLayout.ts`. Rebaked on candidate `ae6cd1e6f`:
  everything else byte-identical but the known pose easing (`_graze`) and the shepherd's horse's 1e-9 heading jitter.
  **Test:** the headless view equals the page at all 2339 points within 1e-9.

## Not yet (next, in order)

1. **The trample map's clock and restore**: `TrampleField.update(dt, player)` on the host step (the page runs it per frame
   from look/grass.ts with the player's push first), and its window / amount / angle / tick in the host snapshot before any
   mover pushes. Then the wildlife pushes (creatures/wildlife.ts: every moving wolf / horse / dog within 70 / 80 m).
2. **The wind and the light**: the weather state machine (world/installWeather.ts) sets `wind` targets, `wildEnv.light` and
   `storm`; take sf72-clock's SimHost day clock when it lands (not in main yet) and model the weather on it.
3. Tick the groups (nalati4 item 2), then the flock / dog / raid director, elites, bosses, sabre, witness (nalati4 items 3–5).

Graph: shards/nalati-grasslands → game 79 → 81 (approved by the coordinator).

Plan-State: unchanged.
