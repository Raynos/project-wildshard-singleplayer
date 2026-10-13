// oxlint-disable-next-line import/no-nodejs-modules -- The continuation witness uses production native physics.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { Scene, Vector3 } from 'three';
import { app } from '../../../src/engine/app/runtime';
import { Scope } from '../../../src/engine/app/scope';
import { withOwner } from '../../../src/engine/app/ownership';
import { configureLevel, activeLevel } from '../../../src/engine/level/selection';
import { AnimalManager } from '../../../src/engine/entities/AnimalManager';
import { SaveStore } from '../../../src/engine/saves/store';
import { Physics } from '../../../src/engine/physics/Physics';
import { CreatureBodies } from '../../../src/engine/physics/creatures';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { regionalRuntimeCheckpoint } from '../../../src/game/grid/runtimeCheckpoint';
import { toLevelSpec } from '../../../src/game/shard/spec';
import { SKY_REACH } from '../../../src/shards/far-reach/manifest';
import { GOATS, RAY_HOMES, ROOST_RAYS, WISP_HOMES, ROC } from '../../../src/shards/far-reach/data/layout';
import { apothem } from '../../../src/shards/far-reach/layout';
import { DRIFT_RAY_DATA as DRIFT_RAY, SKY_GOAT_DATA as SKY_GOAT, GALE_WISP_DATA as GALE_WISP, STORM_ROC_DATA as STORM_ROC } from '../../../src/shards/far-reach/data/species';
import { DRIFT_RAY_LOOK, SKY_GOAT_LOOK, GALE_WISP_LOOK, STORM_ROC_LOOK } from '../../fixtures/far-reach/looks';
import { SKY_FLOCK_GROUPS } from '../../../src/shards/far-reach/data/spawns';
import source from '../../../src/shards/far-reach/shard.config';
import { createLevelInstallation } from '../../../src/engine/level/installation';
import { shardContext } from '../../../src/game/plugin/context';
import { RetainedRuntimeHooks } from '../../../src/game/shard/retainedHooks';
import { bindRuntimeHomes } from '../../../src/game/plugin/headless';
import type { ShardRuntime, ShardPlayHost } from '../../../src/game/shard/runtime';
import { legacyDouble } from '../../fake/FakeGame';
import { MemoryStorage } from '../../setup';
import { fakeWorld } from '../../fake/world';

it('rebuilds living goat identities before restore with no gameplay tick, keeps their HP/pose and retires native bodies', async () => {
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const priorScope = app.levelScope, priorLevel = activeLevel();
  const continuation = regionalRuntimeCheckpoint(new SaveStore({ local: new MemoryStorage(), session: null }), { id: SKY_REACH.slug, shard: SKY_REACH.slug }, 1);
  let ids: string[] = [];
  configureLevel(toLevelSpec(SKY_REACH));
  try {
    for (let visit = 0; visit < 2; visit++) {
      const scope = new Scope('sky.goat.identity'), physics = new Physics(rapier);
      app.levelScope = scope;
      try {
        withOwner(scope, () => {
          for (const row of [DRIFT_RAY, SKY_GOAT, GALE_WISP, STORM_ROC]) app.species.registerRow(row, scope);
          for (const look of [DRIFT_RAY_LOOK, SKY_GOAT_LOOK, GALE_WISP_LOOK, STORM_ROC_LOOK]) {
            const { loadSkin, skin, preload, hasSkin, ...procedural } = look;
            void loadSkin; void skin; void preload; void hasSkin;
            app.species.registerLook(procedural, scope);
          }
          const f = fakeWorld(), animals = new AnimalManager(new Scene(), f.sky, f.forest, {
            style: 'toon', render: { waitForModels: false, lowPoly: true, furRim: false, tintRange: 0, oneMaterial: true },
          });
          // The shipping spawn order reserves every flying actor, then the Roc, before the deferred goat roster.
          for (const home of RAY_HOMES) animals.spawn('driftRay', home.x + home.r, home.z, 0, 'dusk');
          for (const home of ROOST_RAYS) animals.spawn('driftRay', home.x + home.r, home.z, 0, 'dusk');
          for (const home of WISP_HOMES) animals.spawn('galeWisp', home.x + home.r, home.z, 0, 'gale');
          animals.spawn('stormRoc', ROC.x + ROC.r, ROC.z, 0, 'storm');
          if (visit > 0) expect(() => continuation.restore(animals)).toThrow('Missing stable runtime creature');
          const runtime = legacyDouble<ShardRuntime>({ world: null, play: legacyDouble<ShardPlayHost>({ animals }), hooks: {} });
          const installation = createLevelInstallation(app, scope, app.levelAdapters, () => ({ set: () => undefined, detail: () => undefined }));
          const hooks = new RetainedRuntimeHooks(shardContext(installation.context, SKY_REACH, { shard: SKY_REACH, rows: new Map(),
            bag: { tab: () => () => undefined, fragment: () => () => undefined }, runtime }));
          const rows = SKY_FLOCK_GROUPS.goats;
          const homes = bindRuntimeHomes(hooks.context, source, { system: 'fixture.goats', held: {
            order: rows.map(row => row.id), settle: 'far.goats',
            late: id => { const row = rows.find(value => value.id === id); return row === undefined ? undefined : { y: row.home.y, fromY: row.home.y + 2 }; },
          } });
          const goats = rows.map(row => { const body = homes.held(row.id); if (body === null) throw new Error('Missing authored goat'); return body; });
          expect(goats.map(goat => goat.position.y)).toEqual(GOATS.map(g => g.isle.y));
          for (const goat of GOATS) expect(Math.hypot(goat.dx, goat.dz)).toBeLessThan(apothem(goat.isle));
          if (visit === 0) ids = animals.animals.map(animal => animal.entityId);
          else expect(animals.animals.map(animal => animal.entityId)).toEqual(ids);
          continuation.restore(animals);
          const goat = goats[0]; if (goat === undefined) throw new Error('Missing authored goat');
          if (visit === 0) { goat.hp--; goat.position.x += 0.25; expect(continuation.checkpoint(animals)).toBe(true); }
          else { expect(goat.hp).toBe(goat.maxHp - 1); expect(goat.position.x).toBe((GOATS[0]?.isle.x ?? 0) + (GOATS[0]?.dx ?? 0) + 0.25); }
          const bodies = new CreatureBodies(physics);
          bodies.sync(animals.animals, new Vector3(10000, 0, 10000));
          expect(physics.world.colliders.len()).toBeGreaterThan(0);
          scope.onDispose(() => { for (const animal of animals.animals) bodies.remove(animal); });
        });
      } finally {
        scope.dispose();
        expect(physics.world.colliders.len()).toBe(0); expect(physics.world.bodies.len()).toBe(0);
        physics.dispose();
      }
    }
  } finally { app.levelScope = priorScope; configureLevel(priorLevel); }
});
