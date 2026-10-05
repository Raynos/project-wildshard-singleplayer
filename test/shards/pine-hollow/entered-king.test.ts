// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { BufferGeometry, Group, MeshBasicMaterial, PerspectiveCamera, Scene, type WebGLRenderer } from 'three';
import { App } from '../../../src/engine/app/app';
import { createLevelInstallation } from '../../../src/engine/level/installation';
import { shardContext } from '../../../src/game/shard/context';
import { installEnteredRuntimeService, RetainedRuntimeHooks } from '../../../src/game/shard/retainedHooks';
import { emptyShardfileSource } from '../../../src/game/shardfile/loader';
import { emptyShardfile } from '../../../src/sdk/author';
import { installPineCombatObservers } from '../../../src/shards/pine-hollow/runtime/combatService';
import { installEnteredKingBindings } from '../../../src/shards/pine-hollow/runtime/kingLifetime';
import { legacyDouble } from '../../fake/FakeGame';

it('restores exact combat observers and borrowed King bindings across two entries', () => {
  const app = new App(), scope = app.engineScope.child('king');
  const manifest = emptyShardfileSource(emptyShardfile({ slug: 'home', name: 'Home', author: 'Fixture', seed: 1, revision: 1 }));
  const base = createLevelInstallation(app, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const hooks = new RetainedRuntimeHooks(shardContext(base.context, manifest, { shard: manifest, rows: new Map(),
    bag: { tab: () => () => undefined, fragment: () => () => undefined } }));
  const scene = new Scene(), parent = vi.fn<Scene['onBeforeRender']>(), atmosphere = vi.fn<() => void>();
  const geometry = new BufferGeometry(), material = new MeshBasicMaterial();
  const render = () => { scene.onBeforeRender(legacyDouble<WebGLRenderer>({}), scene, new PerspectiveCamera(), geometry, material, new Group()); };
  Object.defineProperty(scene, 'onBeforeRender', { value: parent, writable: true, enumerable: false, configurable: true });
  const descriptor = Object.getOwnPropertyDescriptor(scene, 'onBeforeRender');
  const names = ['__pineElites', '__antlerKing'] as const;
  const original = names.map((name) => Object.getOwnPropertyDescriptor(window, name));
  const borrowed = { previous: true }, observers = { elites: { ticks: 0 }, king: { phase: 2 } };
  for (const name of names) Object.defineProperty(window, name, { value: borrowed, writable: false, enumerable: false, configurable: true });
  const before = names.map((name) => Object.getOwnPropertyDescriptor(window, name));
  const baselineDamage = () => 1, kingDamage = () => 0.25;
  let damage = baselineDamage;
  try {
    installPineCombatObservers(hooks.context, observers);
    installEnteredKingBindings(scene, { read: () => damage, write: (value) => { damage = value; } }, kingDamage,
      atmosphere, (install) => { installEnteredRuntimeService(hooks.context, (entered) => { entered.onDispose(install()); }); });
    for (let entry = 0; entry < 2; entry++) {
      if (entry > 0) hooks.activate();
      expect(Reflect.get(window, names[0])).toBe(observers.elites); expect(Reflect.get(window, names[1])).toBe(observers.king);
      expect(damage).toBe(kingDamage); expect(Object.getOwnPropertyDescriptor(scene, 'onBeforeRender')?.value).not.toBe(parent);
      render(); expect(atmosphere).toHaveBeenCalledTimes(entry + 1);
      expect(parent.mock.contexts.at(-1)).toBe(scene);
      hooks.deactivate();
      expect(damage).toBe(baselineDamage); expect(Object.getOwnPropertyDescriptor(scene, 'onBeforeRender')).toEqual(descriptor);
      expect(names.map((name) => Object.getOwnPropertyDescriptor(window, name))).toEqual(before);
      for (let frame = 0; frame < 600; frame++) { app.clock.tick(1 / 60); render(); }
      expect(atmosphere).toHaveBeenCalledTimes(entry + 1); expect(observers.king.phase).toBe(2);
    }
  } finally {
    scope.dispose(); app.engineScope.dispose(); geometry.dispose(); material.dispose();
    for (const [index, name] of names.entries()) {
      const previous = original[index];
      if (previous === undefined) Reflect.deleteProperty(window, name); else Object.defineProperty(window, name, previous);
    }
  }
  expect(scope.census).toMatchObject({ listeners: 0, systems: 0, disposers: 0 });
  expect(damage).toBe(baselineDamage); expect(Object.getOwnPropertyDescriptor(scene, 'onBeforeRender')?.value).toBe(parent);
});
