import { afterEach, expect, it } from 'vitest';
import { App } from '../../src/engine/app/app';
import { app } from '../../src/engine/app/runtime';
import { activeRegistry, WorldRegistry } from '../../src/engine/world/registry';
import { activeBodies, activePhysics, setActiveBodies, setActivePhysics } from '../../src/engine/physics/active';
import { activeNavmesh, setActiveNavmesh } from '../../src/engine/physics/navmeshLoad';

afterEach(() => { app.registryValue = null; setActivePhysics(null); setActiveBodies(null); setActiveNavmesh('', null); });
it('legacy getters delegate to the same typed app services, including lazy registry creation', () => {
  const registry = new WorldRegistry(); app.registryValue = registry;
  expect(activeRegistry()).toBe(app.registry); expect(activeRegistry()).toBe(registry);
  app.registryValue = null;
  expect(activeRegistry()).toBe(app.registry); expect(app.registry).not.toBe(registry);
  setActivePhysics(null); setActiveBodies(null); setActiveNavmesh('', null);
  expect(activePhysics()).toBe(app.physics); expect(activeBodies()).toBe(app.bodies);
  expect(activeNavmesh()).toBe(app.navmesh); expect(app.world.dayCycle).toBe(app.dayCycle);
});
it('exposes the save service and schedules unthrottled systems on each frame', () => {
  const isolated = new App();
  expect(isolated.saves).toBe(app.saves);
  expect(isolated.saves.exportAll()).toContain('wildshard.save');
  expect(isolated.scheduler.systemDt({ id: 'frame', phase: 'update', run: () => undefined }, 1 / 60)).toBe(1 / 60);
  isolated.debug.expose('test', 1);
  expect(isolated.debug.snapshot()).toEqual({ test: 1 });
});
