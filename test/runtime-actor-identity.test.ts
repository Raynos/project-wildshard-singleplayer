import { expect, it } from 'vitest';
import { Scene } from 'three';
import { app } from '../src/engine/app/runtime';
import { Scope } from '../src/engine/app/scope';
import { withOwner } from '../src/engine/app/ownership';
import { AnimalManager } from '../src/engine/entities/AnimalManager';
import { createLevelInstallation } from '../src/engine/level/installation';
import { shardContext } from '../src/game/shard/context';
import { RetainedRuntimeHooks } from '../src/game/shard/retainedHooks';
import type { ShardRuntime, ShardPlayHost } from '../src/game/shard/runtime';
import { bindRuntimeActor } from '../src/game/shardfile/hybridRows';
import manifest from '../src/shards/sunscar-dunes/manifest';
import source from '../src/shards/sunscar-dunes/shard.config';
import { DUNE_MATRIARCH, DUNE_MATRIARCH_LOOK } from '../src/shards/sunscar-dunes/species/matriarch';
import { fakeWorld } from './fake/world';
import { legacyDouble } from './fake/FakeGame';

for (const identity of ['declared', 'runtime'] as const) it(`preserves ${identity} one-shot actor identity and caller placement across entries`, () => {
  const scope = new Scope(`actor.${identity}`), previous = app.levelScope;
  app.levelScope = scope;
  try {
    withOwner(scope, () => {
      app.species.registerRow(DUNE_MATRIARCH, scope);
      const { loadSkin, skin, preload, hasSkin, ...look } = DUNE_MATRIARCH_LOOK;
      void loadSkin; void skin; void preload; void hasSkin;
      app.species.registerLook(look, scope);
      const world = fakeWorld(), animals = new AnimalManager(new Scene(), world.sky, world.forest, {
        style: 'toon', render: { waitForModels: false, lowPoly: true, furRim: false, tintRange: 0, oneMaterial: true },
      });
      const runtime = legacyDouble<ShardRuntime>({ world: null, play: legacyDouble<ShardPlayHost>({ animals }), hooks: {} });
      const installation = createLevelInstallation(app, scope, app.levelAdapters, () => ({ set: () => undefined, detail: () => undefined }));
      const hooks = new RetainedRuntimeHooks(shardContext(installation.context, manifest, { shard: manifest, rows: new Map(),
        bag: { tab: () => () => undefined, fragment: () => () => undefined }, runtime }));
      const actorSource = { ...source, runtime: source.runtime === null ? null : { ...source.runtime,
        spawns: { homes: [], bosses: [], actors: source.runtime.spawns?.bosses ?? [] } } };
      animals.spawn('duneMatriarch', 0, 0, 0, 'matriarch');
      const actor = identity === 'declared' ? bindRuntimeActor(hooks.context, actorSource, 'sunscar.matriarch')
        : bindRuntimeActor(hooks.context, actorSource, 'sunscar.matriarch', undefined, { identity });
      const first = actor.spawn({ y: 9 });
      if (first === null) throw new Error('Missing declared actor');
      expect(first.entityId).toBe(identity === 'declared' ? 'sunscar.matriarch' : 'creature:1');
      expect(first.position.toArray()).toEqual([-14, 9, -150]);
      first.hp -= 7;
      hooks.deactivate(); hooks.activate();
      expect(animals.animals.find(body => body.entityId === first.entityId)?.hp).toBe(first.maxHp - 7);
      expect(animals.animals).toHaveLength(2); // Entry never refills or allocates another one-shot body.
      actor.retire(first);
      expect(animals.animals).toHaveLength(1);
      expect(() => bindRuntimeActor(hooks.context, actorSource, 'missing')).toThrow('Undeclared runtime actor');
    });
  } finally { scope.dispose(); app.levelScope = previous; }
});
