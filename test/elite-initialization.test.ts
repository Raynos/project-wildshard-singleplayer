// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { Group, PerspectiveCamera, Scene, Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { withOwner } from '../src/engine/app/ownership';
import { Animal } from '../src/engine/entities/AnimalView';
import { AnimalManager } from '../src/engine/entities/AnimalManager';
import { SaveStore } from '../src/engine/saves/store';
import { EliteBar } from '../src/engine/ui/EliteBar';
import { Elites, type EliteDef, type EliteScript } from '../src/game/Elite';
import { elitesSave } from '../src/game/saves';
import { regionalRuntimeCheckpoint } from '../src/game/grid/runtimeCheckpoint';
import { MemoryStorage } from './setup';
import { fakeWorld } from './fake/world';

it('materializes eligible encounters before strict HP restore without AI, timers, discovery or rewards', () => {
  const local = new MemoryStorage(), logical = regionalRuntimeCheckpoint(new SaveStore({ local, session: null }), { id: 'pine-hollow', shard: 'pine-hollow' }, 1);
  const saved = { timer: 10, discovered: false, skinTaken: false, kills: 0, retired: false };
  elitesSave.write({ cooldown: saved, retired: { ...saved, timer: 0, retired: true } }, 'pine-hollow');
  const tick = vi.fn((): void => undefined), trophy = vi.fn((): void => undefined), toast = vi.fn((): void => undefined);
  for (let visit = 0; visit < 2; visit++) {
    const scope = new Scope('elite-restore');
    try {
      withOwner(scope, () => {
        const scene = new Scene(), f = fakeWorld();
        const animals = new AnimalManager(scene, f.sky, f.forest, { style: 'toon', render: { waitForModels: false, lowPoly: true, furRim: false, tintRange: 0, oneMaterial: true } });
        const bar = new EliteBar(), show = vi.spyOn(bar, 'show'), elites = new Elites({ scene, camera: new PerspectiveCamera(), player: { position: new Vector3() },
          condition: rule => rule === 'always', addInteractable: () => undefined, removeInteractable: () => undefined, toast }, bar, 'pine-hollow');
        const add = (id: string, rule: EliteDef['rule'] = 'always', allowed = true): void => {
          const def: EliteDef = { id, name: id, epithet: 'Fixture', lair: { x: 0, z: 0, r: 5 }, awareR: 10, engageR: 5, leashR: 20,
            rule, respawnMin: 20, signature: 'Hit', phase2: 'Phase', drop: { skin: null, skinName: '', weapon: 'rifle', blurb: '' } };
          let animal: Animal | null = null;
          const script: EliteScript = { def, get animal() { return animal; }, spawn: () => {
            const model = animals.factory.model('boar');
            animal = new Animal(animals.factory.instantiate(model, 0.5), model, 0.5, 1, id); animals.animals.push(animal);
          }, despawn: () => { throw new Error('Initialization must not despawn'); }, tick, enterPhase2: () => undefined,
            reset: () => undefined, dropModel: () => new Group(), trophy, canSpawn: () => allowed };
          elites.add(script);
        };
        for (let actor = 164; actor < 168; actor++) add(`creature:${actor}`);
        add('cooldown'); add('retired'); add('night', 'night'); add('locked', 'always', false);
        const before = elitesSave.read('pine-hollow');
        expect(animals.animals).toHaveLength(0); elites.initialize(); elites.initialize();
        expect(animals.animals.map(animal => animal.entityId)).toEqual(['creature:164', 'creature:165', 'creature:166', 'creature:167']);
        expect(elites.entry('cooldown')?.timer).toBe(10); expect(elites.entry('retired')?.state).toBe('retired');
        expect(elites.entries.every(entry => !entry.discovered)).toBe(true);
        expect(elitesSave.read('pine-hollow')).toEqual(before); expect(show).not.toHaveBeenCalled();
        logical.restore(animals);
        const first = animals.animals[0]; if (first === undefined) throw new Error('Missing initialized actor');
        if (visit === 0) { first.hp--; first.position.x = 12; expect(logical.checkpoint(animals)).toBe(true); }
        else { expect(first.hp).toBe(first.maxHp - 1); expect(first.position.x).toBe(12); }
      });
    } finally { scope.dispose(); }
  }
  expect(tick).not.toHaveBeenCalled(); expect(trophy).not.toHaveBeenCalled(); expect(toast).not.toHaveBeenCalled();
});
