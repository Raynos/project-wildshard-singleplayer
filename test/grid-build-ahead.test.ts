// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real regional physics and traveller transfer.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { CHUNK_HALF } from '../src/engine/core/config';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost, type SimLevel } from '../src/engine/sim';
import { GridAssembly } from '../src/game/grid/assembly';
import { LiveGridHost } from '../src/game/grid/live';
import { PageResidency } from '../src/game/grid/pageResidency';

const level: SimLevel = { version: 1, id: 'platform', seed: 1, ground: { size: 500, height: 0 },
  player: { at: { x: 0, y: 0, z: 0 }, yaw: 0, speed: 30 }, entities: [], quests: [],
  weapon: { id: 'none', shape: { kind: 'point', radius: 0 }, windup: 0, active: 0, recover: 0, cooldown: 0, range: 0, damage: 0, tags: [] } };

for (const [axis, side] of [['x', 1], ['x', -1], ['z', 1], ['z', -1]] as const) {
  test(`build ${axis} ${side} destination just after the source edge`, async () => {
    const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
    const assembly = new GridAssembly({ developer: false, devserver: false });
    const home = assembly.cell('driftwood-isle');
    const target = assembly.cells.find(cell => cell.origin[axis] === side * assembly.pitch
      && cell.origin[axis === 'x' ? 'z' : 'x'] === 0);
    if (target === undefined) throw new Error('Missing cardinal destination');
    const page = createSimHost(level, { rapier }), residency = new PageResidency();
    const player = { position: page.player.position, yaw: 0, health: page.player.health, owner: page.player, motor: page.releasePlayerMotor() };
    const created: string[] = [];
    const live = new LiveGridHost(assembly, {
      home: { mode: 'owned', instance: home.instance, bytes: 1000, residency: residency.admitHome(home.instance, 1000) },
      player, allocator: residency.allocator, continuations: 'durable', save: () => true,
      bindFrame: () => undefined, gameplayReady: () => true,
      highway: { bytes: 1000, create: () => ({ physics: page.physics, dispose: () => undefined }) },
      prefetchable: cell => cell.instance === target.instance,
      readiness: { link: { speed: 30, linkBitsPerSecond: 5_000_000, requestLatencySeconds: 0.25, maxStallSeconds: 3 },
        bundle: () => ({ criticalWireBytes: 1000, hybridWireBytes: 1000, decodeSeconds: 0, runtimeParseSeconds: 0 }) },
      admit: cell => Promise.resolve({ bytes: 1000, exclusiveRuntime: true, reloadsCheckpoint: true, prepareRuntime: () => Promise.resolve(),
        create: () => {
          created.push(cell.instance);
          const host = createSimHost(level, { rapier, playerBody: false, ground: false });
          return Promise.resolve({ host, dispose: () => { host.dispose(); } });
        } }),
    });
    try {
      const enterHome = await live.prepare(null, home.instance); enterHome.commit();
      player.position[axis] = side * (CHUNK_HALF - 0.5);
      live.beforeFixed(); await live.prefetch([target.instance]);
      // Products may prefetch inside the source; no second world is constructed.
      expect(created).toEqual([home.instance]); expect(live.state().pending).toEqual([]);
      const leave = await live.prepare(home.instance, null); leave.commit();
      expect(live.unload(home.instance)).toBe(true);
      player.position[axis] = side * (CHUNK_HALF + 0.5);
      live.beforeFixed();
      // Still 21 metres before the old midpoint trigger: the build is already queued.
      expect(live.state().pending).toContain(target.instance);
      const enter = await live.prepare(null, target.instance); enter.commit();
      expect(created).toEqual([home.instance, target.instance]);
      expect(live.state().issues).toEqual({});
    } finally { live.dispose(); player.motor.dispose(); page.dispose(); residency.dispose(); }
    expect(residency.allocator.entries()).toEqual([]);
  });
}
