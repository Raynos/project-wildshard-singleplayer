// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- This lifecycle witness admits the production native physics binary.
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { app } from '../src/engine/app/runtime';
import { withOwner } from '../src/engine/app/ownership';
import { createLevelInstallation } from '../src/engine/level/installation';
import { Game } from '../src/engine/core/Game';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier } from '../src/engine/physics/rapier';
import { Flags } from '../src/engine/world/interact/flags';
import { GridCellEvents } from '../src/game/grid/boot';
import { shardContext, type ShardContext } from '../src/game/shard/context';
import { ShardPlugin } from '../src/game/shard/plugin';
import type { ShardWorld } from '../src/game/shard/world';
import type { ShardRuntime } from '../src/game/shard/runtime';
import { HybridShardPlugin } from '../src/game/shardfile/hybrid';
import { installFinale, type FinaleWorld } from '../src/shards/driftwood-isle/quest/Finale';
import type { AdvAnimal } from '../src/shards/driftwood-isle/quest/adventure';
import manifest from '../src/shards/driftwood-isle/manifest';
import { fakeWorld } from './fake/world';

it('recreates a home finale twice without retaining page encounters, callbacks or native handles', async () => {
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const page = app.engineScope.child('hybrid-home'), physics = new Physics(rapier), prior = app.levelScope, adapters = app.levelAdapters;
  app.levelScope = page; app.levelAdapters = { debugRow: () => () => undefined };
  const candidate: unknown = Object.create(Game.prototype);
  if (!(candidate instanceof Game)) throw new Error('Missing Game prototype');
  const faults = new Map<string, object>();
  for (const [key, value] of Object.entries({ app, registrationScope: page, levelScope: page, faultSystems: faults, anonymous: 0 })) {
    Reflect.defineProperty(candidate, key, { value, writable: true });
  }
  // Only unbuilt view services are doubles. Game callbacks, encounter registrations, scopes and native handles are real.
  const game = candidate, world = { ...fakeWorld(), game, physics, chunk: manifest } as ShardWorld;
  const runtime: ShardRuntime = { world, play: null, step: null, hooks: {}, objects: {}, interactables: [], overhead: [], viewer: () => new Vector3(), horizonVeil: null };
  const base = createLevelInstallation(app, page, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const context = shardContext(base.context, manifest, { shard: manifest, runtime, rows: new Map(), bag: { tab: () => () => undefined, fragment: () => () => undefined } });
  const cells = new GridCellEvents(), cell = { instance: 'driftwood-isle', slug: 'driftwood-isle' }, ready: boolean[] = [];
  let updates = 0;
  class Runtime extends ShardPlugin {
    override async play(ctx: ShardContext): Promise<void> {
      await Promise.resolve(); // Reproduce the actual asynchronous audio/adventure handoff, with no ambient entered owner.
      const borrowed = ctx.game.runtime?.world; if (borrowed === undefined || borrowed === null) throw new Error('Missing borrowed world');
      borrowed.game.onUpdate(() => { updates++; }, 'home.fixture');
      withOwner(ctx.scope, () => physics.world.createCollider(rapier.ColliderDesc.cuboid(1, 1, 1)));
      const player = { position: new Vector3(20, 0, 0), velocity: new Vector3(), yaw: 0, pitch: 0, carried: false };
      const finaleWorld: FinaleWorld<AdvAnimal> = { scope: ctx.scope, game: borrowed.game, player,
        sky: { planetDir: new Vector3(0, 0, 1), dayNight: null }, animals: { spawn: () => { throw new Error('Unstarted finale must not spawn'); } },
        hud: { toast: () => undefined }, music: { sting: () => undefined } };
      await installFinale({ flags: new Flags('driftwood-isle', false), spine: null, complete: null,
        place: point => ({ x: point.x, y: point.dy ?? 0, z: point.z, yaw: 0 }), floorAt: () => 0, setAnchor: () => undefined }, finaleWorld, ctx);
    }
  }
  class Data extends ShardPlugin {}
  const plugin = new HybridShardPlugin(new Data(), Runtime, { instance: cell.instance, cells, readiness: value => { ready.push(value); } });
  const before = { events: app.events.census(), systems: app.systemIds(page) };
  try {
    cells.enter(cell); await plugin.world(context); await plugin.kit(context); await plugin.play(context);
    for (let visit = 0; visit < 2; visit++) {
      await vi.waitFor(() => { expect(ready.at(-1)).toBe(true); }); expect(game.registrationScope).toBe(page); expect(game.levelScope).toBe(page);
      expect(app.encounters.get('boss.captain')).toBeDefined(); expect(app.encounters.runtime('boss.captain')).toBeDefined();
      expect(physics.world.colliders.len()).toBe(1);
      for (const system of app.systemsByPhase().update) system.run(1 / 60, visit);
      expect(updates).toBe(visit + 1);
      cells.leave(); expect(app.encounters.get('boss.captain')).toBeUndefined(); expect(app.encounters.runtime('boss.captain')).toBeUndefined();
      expect(app.systemIds(page)).toEqual(before.systems); expect(app.events.census()).toEqual(before.events);
      expect(faults.size).toBe(0); expect(physics.world.colliders.len()).toBe(0);
      for (let tick = 0; tick < 600; tick++) for (const system of app.systemsByPhase().update) system.run(1 / 60, tick);
      expect(updates).toBe(visit + 1);
      if (visit === 0) {
        cells.enter(cell);
        for (let turn = 0; turn < 100 && ready.at(-1) !== true; turn++) await Promise.resolve();
      }
    }
    page.dispose(); expect(page.census.disposers).toBe(0); expect(physics.world.bodies.len()).toBe(0); expect(physics.world.colliders.len()).toBe(0);
  } finally { page.dispose(); physics.dispose(); app.levelScope = prior; app.levelAdapters = adapters; }
});
