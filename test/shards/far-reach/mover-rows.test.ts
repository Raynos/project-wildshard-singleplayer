// oxlint-disable-next-line import/no-nodejs-modules -- The native owner consumes the committed, admitted guest modules.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parseMovers } from '@wildshard/format/movers';
import { createSimHost } from '@wildshard/engine/sim';
import { restoreSimHost, snapshotSimHost } from '@wildshard/engine/sim/snapshot';
import { loadRapier } from '@wildshard/engine/physics/rapier';
import { installHeadlessMovers, verifiedMoverModules } from '@wildshard/game/plugin/mover';
import { MOVERS } from '../../../src/shards/far-reach/data/movers';
import { SKY_MOVER_BINDING } from '../../../src/shards/far-reach/data/moverBindings';
import source from '../../../src/shards/far-reach/shard.config';
import { SIM_LEVEL } from '../../fixtures/sim-level/level';

it('admits every authored clip row in the exact former browser and native installation order', () => {
  const isSocket = (id: string): boolean => id.startsWith(SKY_MOVER_BINDING.socketPrefix);
  const former = parseMovers([...MOVERS.filter(row => !isSocket(row.id)), ...parseMovers(MOVERS.filter(row => isSocket(row.id)))]);
  expect(parseMovers(source.movers)).toEqual(former);
  expect(parseMovers(source.movers.filter(row => !row.id.startsWith(SKY_MOVER_BINDING.staticPrefix)))).toEqual(former.filter(row => !row.id.startsWith(SKY_MOVER_BINDING.staticPrefix)));
  expect(new Set(source.movers.map(row => row.module))).toEqual(new Set(source.sim.scripts));
});

it('restores the travelling winch and pending command without duplicating native mover bodies', async () => {
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const rows = source.movers.filter(row => !row.id.startsWith(SKY_MOVER_BINDING.staticPrefix));
  const assets = new Map(source.files.map(file => [file.hash, Uint8Array.from(readFileSync(`src/shards/far-reach/assets/${file.hash}`))]));
  const modules = await verifiedMoverModules(assets, rows);
  const level = { ...SIM_LEVEL, entities: [] };
  const host = createSimHost(level, { rapier });
  const install = (sim: typeof host, restoring: boolean) => installHeadlessMovers(sim, rows, modules, {
    systemId: SKY_MOVER_BINDING.systemId, restoring,
    initialPermissions: new Map([[SKY_MOVER_BINDING.winch, 3]]),
  });
  let fresh: typeof host | undefined;
  try {
    const original = install(host, false);
    original.runtime.command(SKY_MOVER_BINDING.winch, 1);
    for (let i = 0; i < 40; i++) host.step();
    const start = rows.find(row => row.id === SKY_MOVER_BINDING.winch);
    if (start === undefined) throw new Error('Missing admitted winch');
    expect(original.runtime.pose(start.id).euler.x).toBeGreaterThan(start.euler.x);
    expect(original.runtime.pose(start.id).euler.x).toBeLessThan(0);
    original.runtime.command(SKY_MOVER_BINDING.winch, 1);
    const saved = snapshotSimHost(host), bodies = original.runtime.snapshotBodies();
    expect(JSON.parse(original.runtime.snapshotState())).toMatchObject({ pending: [[start.id, 1]] });
    expect(bodies.map(body => body.id)).toEqual(rows.map(row => row.id));
    const count = host.physics.world.bodies.len(), colliders = host.physics.world.colliders.len();
    let restored: ReturnType<typeof install> | undefined;
    fresh = restoreSimHost(level, { rapier }, saved, sim => {
      restored = install(sim, true);
      expect(sim.physics.world.bodies.len()).toBe(0);
    });
    expect(restored?.runtime.snapshotState()).toBe(original.runtime.snapshotState());
    expect(restored?.runtime.snapshotBodies()).toEqual(bodies);
    for (let i = 0; i < 90; i++) { host.step(); fresh.step(); }
    expect(restored?.runtime.snapshotState()).toBe(original.runtime.snapshotState());
    expect(restored?.runtime.snapshot()).toEqual(original.runtime.snapshot());
    expect([fresh.physics.world.bodies.len(), fresh.physics.world.colliders.len()]).toEqual([count, colliders]);
    for (const body of bodies) expect(fresh.physics.world.getRigidBody(body.handle).translation()).toEqual(host.physics.world.getRigidBody(body.handle).translation());
    expect(restored?.failures()).toBe(0);
  } finally { fresh?.dispose(); host.dispose(); }
});
