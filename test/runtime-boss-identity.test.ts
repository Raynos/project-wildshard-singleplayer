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
import { bindRuntimeBoss } from '../src/game/shardfile/hybridRows';
import manifest from '../src/shards/sunscar-dunes/manifest';
import source from '../src/shards/sunscar-dunes/shard.config';
import { DUNE_MATRIARCH, DUNE_MATRIARCH_LOOK } from '../src/shards/sunscar-dunes/species/matriarch';
import { fakeWorld } from './fake/world';
import { legacyDouble } from './fake/FakeGame';

for (const identity of ['declared', 'runtime'] as const) it(`keeps ${identity} boss identities through a retained entry and retry`, () => {
  const scope = new Scope(`boss.${identity}`);
  const previous = app.levelScope;
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
      // Earlier ordinary spawns make allocation order observable, as it is in existing runtime saves.
      const prior = animals.spawn('duneMatriarch', 0, 0, 0, 'matriarch');
      const boss = identity === 'declared' ? bindRuntimeBoss(hooks.context, source, 'sunscar.matriarch')
        : bindRuntimeBoss(hooks.context, source, 'sunscar.matriarch', undefined, { identity });
      const first = boss.spawn();
      if (first === null) throw new Error('Missing declared boss');
      expect(first.entityId).toBe(identity === 'declared' ? 'sunscar.matriarch' : 'creature:1');
      expect(prior.entityId).toBe('creature:0');
      first.hp -= 7;
      hooks.deactivate(); hooks.activate();
      expect(animals.animals.find(actor => actor.entityId === first.entityId)?.hp).toBe(first.maxHp - 7);
      boss.retire(first);
      const retry = boss.spawn(first);
      expect(retry?.entityId).toBe(identity === 'declared' ? first.entityId : 'creature:2');
      expect(retry?.position.x).toBe(-14); expect(retry?.position.z).toBe(-150);
      expect(retry?.hp).toBe(retry?.maxHp);
    });
  } finally { scope.dispose(); app.levelScope = previous; }
});
