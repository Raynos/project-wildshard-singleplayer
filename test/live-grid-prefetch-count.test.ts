// oxlint-disable-next-line import/no-nodejs-modules -- Use the production Rapier binary for world ownership and motor transfers.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost } from '../src/engine/sim';
import { GridAssembly } from '../src/game/grid/assembly';
import { LiveGridHost } from '../src/game/grid/live';
import { PageResidency } from '../src/game/grid/pageResidency';
import { SIM_LEVEL } from './fixtures/sim-level/level';

it('reserves both borrowed home and the active cell before prefetching, without stationary rebuilds', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const assembly = new GridAssembly({ developer: false, devserver: false });
  const page = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier });
  const owner = new PageResidency(), home = owner.admitHome('driftwood-isle', 1000);
  const player = { position: page.player.position, yaw: 0, health: page.player.health, owner: {}, motor: page.releasePlayerMotor() };
  const creates: string[] = [], disposes: string[] = [];
  const registry = new LiveGridHost(assembly, {
    home: { instance: home.instance, physics: page.physics, bytes: home.bytes, residency: home, checkpoint: () => true }, player,
    allocator: owner.allocator, maxResidents: 4, continuations: 'durable',
    highway: { bytes: 1000, create: () => {
      const host = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier, playerBody: false });
      return { host, dispose: () => { host.dispose(); } };
    } },
    admit: cell => Promise.resolve({ bytes: 1000, reloadsCheckpoint: true, create: () => {
      creates.push(cell.instance);
      const host = createSimHost({ ...SIM_LEVEL, id: cell.instance, entities: [], quests: [] }, { rapier, playerBody: false });
      return Promise.resolve({ host, checkpoint: () => true, dispose: () => { disposes.push(cell.instance); host.dispose(); } });
    } }),
    save: () => true, gameplayReady: () => true, bindFrame: () => undefined,
    // All neighbours are within the cold readiness bound, as with a slow network in the real grid.
    readiness: { link: { speed: 30, linkBitsPerSecond: 1000, requestLatencySeconds: 0.25, maxStallSeconds: 10 },
      bundle: () => ({ criticalWireBytes: 100_000, hybridWireBytes: 0, decodeSeconds: 1, runtimeParseSeconds: 0 }) },
  });
  const settle = async (): Promise<void> => { for (let turn = 0; turn < 100; turn++) await Promise.resolve(); };
  try {
    const target = assembly.cell('template-1'); player.position.set(target.origin.x, 0, target.origin.z);
    await registry.prefetch([target.instance]);
    const crossing = await registry.prepare(home.instance, target.instance); crossing.commit();
    expect(registry.current()).toBe(target.instance);
    registry.beforeFixed(); await settle();
    expect(registry.state().pending).toEqual([]);
    expect(registry.state().residents).toHaveLength(3);
    expect(creates).toHaveLength(3); expect(disposes).toEqual([]);
    const admitted = [...creates];
    for (let tick = 0; tick < 120; tick++) { registry.beforeFixed(); await settle(); }
    expect(creates).toEqual(admitted); expect(disposes).toEqual([]);
    expect(registry.state().issues).toEqual({});
    expect(owner.allocator.has('sim:driftwood-isle')).toBe(true);
  } finally { registry.dispose(); owner.dispose(); player.motor.dispose(); page.dispose(); }
});
