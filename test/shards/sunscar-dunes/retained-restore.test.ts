// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- Check real creature bodies against the shipped physics binary.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { Scene, Vector3 } from 'three';
import { app } from '../../../src/engine/app/runtime';
import { Scope } from '../../../src/engine/app/scope';
import { withOwner } from '../../../src/engine/app/ownership';
import { activeLevel, configureLevel } from '../../../src/engine/level/selection';
import { createLevelInstallation } from '../../../src/engine/level/installation';
import { AnimalManager } from '../../../src/engine/entities/AnimalManager';
import { Physics } from '../../../src/engine/physics/Physics';
import { CreatureBodies } from '../../../src/engine/physics/creatures';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { SaveStore } from '../../../src/engine/saves/store';
import { Flags } from '../../../src/engine/world/interact/flags';
import { regionalRuntimeCheckpoint } from '../../../src/game/grid/runtimeCheckpoint';
import { shardContext } from '../../../src/game/shard/context';
import { RetainedRuntimeHooks } from '../../../src/game/shard/retainedHooks';
import type { ShardRuntime, ShardPlayHost } from '../../../src/game/shard/runtime';
import { toLevelSpec } from '../../../src/game/shard/spec';
import { SUNSCAR_DUNES } from '../../../src/shards/sunscar-dunes/manifest';
import { installCreatures, RESPAWN } from '../../../src/shards/sunscar-dunes/combat/creatures';
import { installMatriarch } from '../../../src/shards/sunscar-dunes/combat/matriarch';
import { FLAG } from '../../../src/shards/sunscar-dunes/data/flags';
import { DUNE_RAY, DUNE_RAY_LOOK } from '../../../src/shards/sunscar-dunes/species/duneRay';
import { SAND_SKITTERER, SAND_SKITTERER_LOOK } from '../../../src/shards/sunscar-dunes/species/skitterer';
import { DUNE_STRIDER, DUNE_STRIDER_LOOK } from '../../../src/shards/sunscar-dunes/species/strider';
import { DUNE_MATRIARCH, DUNE_MATRIARCH_LOOK } from '../../../src/shards/sunscar-dunes/species/matriarch';
import { MemoryStorage } from '../../setup';
import { fakeWorld } from '../../fake/world';
import { legacyDouble } from '../../fake/FakeGame';

it('restores a cold lit save after home respawn and boss retry without changing identities or keeping native bodies', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const previousScope = app.levelScope, previousLevel = activeLevel();
  const storage = new MemoryStorage();
  let savedIds: string[] = [];
  try {
    for (let visit = 0; visit < 3; visit++) {
      const continuation = regionalRuntimeCheckpoint(new SaveStore({ local: storage, session: null }), { id: SUNSCAR_DUNES.slug, shard: SUNSCAR_DUNES.slug }, 1);
      const scope = new Scope('dunes.restore'), physics = new Physics(rapier);
      app.levelScope = scope; configureLevel(toLevelSpec(SUNSCAR_DUNES));
      try {
        withOwner(scope, () => {
          for (const row of [DUNE_RAY, SAND_SKITTERER, DUNE_STRIDER, DUNE_MATRIARCH]) app.species.registerRow(row, scope);
          for (const look of [DUNE_RAY_LOOK, SAND_SKITTERER_LOOK, DUNE_STRIDER_LOOK, DUNE_MATRIARCH_LOOK]) {
            const { loadSkin, skin, preload, hasSkin, ...procedural } = look;
            void loadSkin; void skin; void preload; void hasSkin;
            app.species.registerLook(procedural, scope);
          }
          const world = fakeWorld(), animals = new AnimalManager(new Scene(), world.sky, world.forest, {
            style: 'toon', render: { waitForModels: false, lowPoly: true, furRim: false, tintRange: 0, oneMaterial: true },
          });
          const runtime = legacyDouble<ShardRuntime>({ world: null, play: legacyDouble<ShardPlayHost>({ animals, hud: legacyDouble<ShardPlayHost['hud']>({ toast: () => undefined }) }), hooks: {} });
          const installation = createLevelInstallation(app, scope, app.levelAdapters, () => ({ set: () => undefined, detail: () => undefined }));
          const hooks = new RetainedRuntimeHooks(shardContext(installation.context, SUNSCAR_DUNES, { shard: SUNSCAR_DUNES,
            rows: new Map(), bag: { tab: () => () => undefined, fragment: () => () => undefined }, runtime }));
          app.encounters.register({ id: 'sunscar.matriarch', displayName: 'Matriarch' }, scope);
          // First visit: homes precede the late fire summon. Cold lit save: boss precedes homes.
          const flags = new Flags(SUNSCAR_DUNES.slug);
          expect(flags.has(FLAG.lit)).toBe(visit > 0);
          const matriarch = installMatriarch(hooks.context, new Vector3(), () => flags.has(FLAG.lit));
          const creatures = installCreatures(hooks.context), home = creatures.homes.find(row => row.kind === 'sandSkitterer');
          if (home?.animal === null || home === undefined) throw new Error('Missing authored skitterer home');
          if (visit === 0) {
            const original = home.animal;
            original.alive = false; original.hp = 0; home.wait = RESPAWN.sandSkitterer;
            const step = app.systemsByPhase().update.find(system => system.id === 'sunscar.creatures');
            if (step === undefined) throw new Error('Missing real home respawn system');
            step.run(RESPAWN.sandSkitterer + 0.01, 0);
            expect(home.animal).not.toBe(original); expect(home.animal.entityId).toBe(original.entityId);
            flags.set(FLAG.lit);
            expect(new Flags(SUNSCAR_DUNES.slug).has(FLAG.lit)).toBe(true);
            matriarch.summon(); const firstBoss = matriarch.boss.body();
            matriarch.boss.devStartAt(0);
            expect(matriarch.boss.body()).not.toBe(firstBoss);
            expect(matriarch.boss.body()?.entityId).toBe(firstBoss?.entityId);
            home.animal.hp--; home.animal.position.x += 0.25;
            const boss = matriarch.boss.body(); if (boss === null) throw new Error('Missing summoned boss');
            boss.hp -= 7;
            savedIds = animals.animals.map(actor => actor.entityId).sort();
            expect(continuation.checkpoint(animals)).toBe(true);
          } else {
            expect(animals.animals.map(actor => actor.entityId).sort()).toEqual(savedIds);
            continuation.restore(animals);
            expect(home.animal.position.x).toBe(home.x + 0.25);
            const boss = matriarch.boss.body(); if (boss === null) throw new Error('Missing cold lit boss');
            expect(boss.hp).toBe(boss.maxHp - 7);
            if (visit === 1) {
              expect(home.animal.hp).toBe(home.animal.maxHp - 1);
              home.animal.alive = false; home.animal.hp = 0;
              expect(continuation.checkpoint(animals)).toBe(true);
            } else {
              expect(home.animal.alive).toBe(false); expect(home.wait).toBe(0);
              const step = app.systemsByPhase().update.find(system => system.id === 'sunscar.creatures');
              if (step === undefined) throw new Error('Missing restored home system');
              step.run(1 / 60, 0);
              expect(home.wait).toBeCloseTo(RESPAWN.sandSkitterer - 1 / 60);
              const dead = home.animal;
              step.run(RESPAWN.sandSkitterer, 0);
              expect(home.animal).not.toBe(dead); expect(home.animal.alive).toBe(true);
              expect(home.animal.entityId).toBe(dead.entityId);
            }
          }
          const bodies = new CreatureBodies(physics);
          bodies.sync(animals.animals, new Vector3(10000, 0, 10000));
          expect(physics.world.colliders.len()).toBeGreaterThan(0);
          scope.onDispose(() => { for (const actor of animals.animals) bodies.remove(actor); });
        });
      } finally {
        scope.dispose(); expect(physics.world.colliders.len()).toBe(0); expect(physics.world.bodies.len()).toBe(0); physics.dispose();
      }
    }
  } finally { app.levelScope = previousScope; configureLevel(previousLevel); }
});
