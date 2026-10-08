// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { Scene, Vector3 } from 'three';
import { app } from '../../../src/engine/app/runtime';
import { Scope } from '../../../src/engine/app/scope';
import { withOwner } from '../../../src/engine/app/ownership';
import { Game } from '../../../src/engine/core/Game';
import { AnimalManager } from '../../../src/engine/entities/AnimalManager';
import { SaveStore } from '../../../src/engine/saves/store';
import { regionalRuntimeCheckpoint } from '../../../src/game/grid/runtimeCheckpoint';
import { elitesSave } from '../../../src/game/saves';
import { NalatiElites, registerArgymaq } from '../../../src/shards/nalati-grasslands/combat/elites';
import { Wildlife } from '../../../src/shards/nalati-grasslands/creatures/wildlife';
import { NALATI_SPECIES, NALATI_LOOKS, nalatiLook, nalatiRow } from '../../../src/shards/nalati-grasslands/species/rows';
import { speciesDef } from '../../../src/engine/entities/species/registry';
// oxlint-disable-next-line import/no-nodejs-modules -- This witness uses the production native physics binary.
import { readFileSync } from 'node:fs';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { Physics } from '../../../src/engine/physics/Physics';
import { CreatureBodies } from '../../../src/engine/physics/creatures';
import { MemoryStorage } from '../../setup';
import { fakeWorld } from '../../fake/world';

it('rebuilds the authored leopard and complete Argymaq herd before exact identity restore without encounter rewards', async () => {
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const oldScope = app.levelScope, local = new MemoryStorage();
  const logical = regionalRuntimeCheckpoint(new SaveStore({ local, session: null }), { id: 'nalati-grasslands', shard: 'nalati-grasslands' }, 1);
  elitesSave.write({}, 'nalati-grasslands');
  const record = vi.fn((): void => undefined), toast = vi.fn((): void => undefined), feed = vi.fn((): void => undefined);
  let savedIds: string[] = [];
  for (let visit = 0; visit < 2; visit++) {
    const scope = new Scope('nalati.encounters'); app.levelScope = scope;
    const physicsWorlds: Physics[] = [];
    try {
      withOwner(scope, () => {
        for (const row of NALATI_SPECIES) app.species.registerRow(row, scope);
        // Resolve the shipping dynamically derived definition without retaining its hull-I/O look.
        const definitionScope = scope.child('derived-definition'); app.levelScope = definitionScope;
        registerArgymaq(); const argymaq = speciesDef('argymaq');
        definitionScope.dispose(); app.levelScope = scope;
        app.species.registerRow(nalatiRow(argymaq), scope);
        for (const look of [...NALATI_LOOKS, nalatiLook(argymaq)]) {
          // This identity/health witness uses the original procedural rig; hull I/O does not affect allocation.
          const { loadSkin, skin, preload, hasSkin, ...procedural } = look; void loadSkin; void skin; void preload; void hasSkin;
          app.species.registerLook({ ...procedural, id: `${procedural.id}.identity` }, scope);
        }
        const f = fakeWorld(), scene = new Scene(), candidate: unknown = Object.create(Game.prototype);
        if (!(candidate instanceof Game)) throw new Error('Missing Game prototype');
        for (const [key, value] of Object.entries({ app, levelScope: scope, registrationScope: scope, camera: f.game.camera, rootScene: scene, sceneFrames: [] })) {
          Reflect.defineProperty(candidate, key, { configurable: true, writable: true, value });
        }
        const animals = new AnimalManager(scene, f.sky, f.forest, { style: 'toon', render: { waitForModels: false, lowPoly: true, furRim: false, tintRange: 0, oneMaterial: true } });
        // Real allocator:24 wildlife identities precede the Golden King's retired model-prewarm reservation24.
        for (let n = 0; n < 5; n++) animals.spawn('wolf', 0, 0, 0, 'grey');
        for (let n = 0; n < 18; n++) animals.spawn('horse', 0, 0, 0, 'bay');
        animals.spawn('sheepdog', 0, 0, 0, 'collie');
        animals.retire(animals.spawn('golden-king', 0, 0, 0, 'king'));
        const wildlife = new Wildlife(animals, { scene, sky: f.sky, seed: 357 });
        const player = f.player; player.position.set(0, 0, 0);
        const elites = new NalatiElites({ game: candidate, sky: f.sky, player, ledges: [], phase: () => 'day', storm: () => false });
        elites.bind({ animals, wildlife, taming: null, ghosts: null, interactables: [], record, toast, feed, params: new URLSearchParams() });
        const core = elites.elites; if (core === null) throw new Error('Missing authored elite manager');
        const ticks = elites.scripts.map(script => vi.spyOn(script, 'tick'));
        const before = elitesSave.read('nalati-grasslands'); elites.initialize(); elites.initialize();
        expect(animals.animals).toHaveLength(35);
        const roster = animals.animals.map(actor => actor.entityId);
        if (visit === 0) savedIds = roster; else expect(roster).toEqual(savedIds);
        expect(animals.animals.find(actor => actor.entityId === 'creature:25')?.kind).toBe('leopard');
        expect(animals.animals.find(actor => actor.entityId === 'creature:35')?.kind).toBe('argymaq');
        expect(wildlife.herds).toHaveLength(1); expect(wildlife.herds[0]?.members).toHaveLength(10);
        expect(elitesSave.read('nalati-grasslands')).toEqual(before);
        expect(core.entries.every(entry => !entry.discovered)).toBe(true);
        for (const tick of ticks) expect(tick).not.toHaveBeenCalled();
        logical.restore(animals);
        const physics = new Physics(rapier); physicsWorlds.push(physics); const bodies = new CreatureBodies(physics);
        bodies.sync(animals.animals, new Vector3(10000, 0, 10000));
        expect(physics.world.colliders.len()).toBeGreaterThanOrEqual(70);
        scope.onDispose(() => { for (const actor of animals.animals) bodies.remove(actor); });
        const leopard = animals.animals.find(actor => actor.entityId === 'creature:25');
        if (leopard === undefined) throw new Error('Missing restored leopard');
        if (visit === 0) { leopard.hp--; leopard.position.copy(new Vector3(138, 52, -68)); expect(logical.checkpoint(animals)).toBe(true); }
        else { expect(leopard.hp).toBe(699); expect(leopard.position.toArray()).toEqual([138, 52, -68]); }
      });
    } finally {
      scope.dispose();
      for (const physics of physicsWorlds) { expect(physics.world.colliders.len()).toBe(0); expect(physics.world.bodies.len()).toBe(0); physics.dispose(); }
      app.levelScope = oldScope;
    }
  }
  expect(record).not.toHaveBeenCalled(); expect(feed).not.toHaveBeenCalled(); expect(toast).not.toHaveBeenCalled();
});
