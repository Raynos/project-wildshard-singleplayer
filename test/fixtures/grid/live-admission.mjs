// oxlint-disable-next-line import/no-nodejs-modules -- Plain Node acceptance witness, with no renderer or browser globals.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- Load the shipped physics binary for real owned regional worlds.
import { readFileSync } from 'node:fs';
import { createSimHost } from '../../../src/engine/sim.ts';
import { loadRapier } from '../../../src/engine/physics/rapier.ts';
import { GridAssembly } from '../../../src/game/grid/assembly.ts';
import { TEMPLATE_WEST_GRID } from './templateWest.ts';
import { LiveGridHost } from '../../../src/game/grid/live.ts';
import { ResidencyAllocator } from '../../../src/game/grid/allocator.ts';

const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
const assembly = new GridAssembly({ developer: false, devserver: false }, TEMPLATE_WEST_GRID);
const home = assembly.cell('driftwood-isle'), target = assembly.cell('template-3');
const level = { version: 1, id: 'platform', seed: 1, ground: { size: 500, height: 0 },
  player: { at: { x: 0, y: 0, z: 0 }, yaw: 0, speed: 30 }, entities: [], quests: [],
  weapon: { id: 'none', shape: { kind: 'point', radius: 0 }, windup: 0, active: 0, recover: 0, cooldown: 0, range: 0, damage: 0, tags: [] } };
const scenarios = ['disposed-admit', 'budget', 'runtime', 'create', 'disposed-create', 'invalid-region', 'durability', 'resident-limit', 'cancel-throws', 'success'];
let totalCancelled = 0;
for (const kind of scenarios) {
  const allocator = new ResidencyAllocator(), page = createSimHost(level, { rapier });
  const player = { position: page.player.position, yaw: 0, health: page.player.health, owner: page.player, motor: page.releasePlayerMotor() };
  let signalAdmit = () => {}, signalCreate = () => {}, releaseAdmit = () => {}, releaseCreate = () => {};
  const admitted = new Promise((resolve) => { signalAdmit = () => { resolve(undefined); }; });
  const created = new Promise((resolve) => { signalCreate = () => { resolve(undefined); }; });
  const admitGate = new Promise((resolve) => { releaseAdmit = () => { resolve(undefined); }; });
  const createGate = new Promise((resolve) => { releaseCreate = () => { resolve(undefined); }; });
  let cancellations = 0, creations = 0, disposals = 0;
  const id = `product:${kind}`;
  const registry = new LiveGridHost(assembly, {
    continuations: 'durable', maxResidents: kind === 'resident-limit' ? 1 : 2,
    home: { instance: home.instance, physics: page.physics, bytes: 1_000_000, checkpoint: () => true },
    player, allocator, save: () => true, bindFrame: () => {}, gameplayReady: () => true,
    highway: { bytes: 1_000_000, create: () => {
      const host = createSimHost(level, { rapier, playerBody: false, ground: false });
      return { host, dispose: () => { host.dispose(); } };
    } },
    readiness: { link: { speed: 30, linkBitsPerSecond: 5_000_000, requestLatencySeconds: 0.25, maxStallSeconds: 3 },
      bundle: () => ({ criticalWireBytes: 1000, hybridWireBytes: 1000, decodeSeconds: 0, runtimeParseSeconds: 0 }) },
    admit: async () => {
      const product = allocator.reserve({ id, category: 'library', owner: target.instance, bytes: 100, distance: 0, needed: true });
      assert.ok(product); signalAdmit();
      if (kind === 'disposed-admit') await admitGate;
      return { bytes: kind === 'budget' ? 800_000_000 : 1_000_000, reloadsCheckpoint: kind !== 'durability',
        cancel: () => { cancellations++; product.release(); if (kind === 'cancel-throws') throw new Error('cancel cleanup failed'); },
        prepareRuntime: async () => { if (kind === 'runtime') throw new Error('runtime failed'); },
        create: async () => {
          creations++; signalCreate();
          if (kind === 'create' || kind === 'cancel-throws') throw new Error('create failed');
          const host = createSimHost(level, { rapier, playerBody: kind === 'invalid-region', ground: false });
          if (kind === 'disposed-create') await createGate;
          return { host, dispose: () => { disposals++; host.dispose(); product.release(); } };
        } };
    },
  });
  try {
    const request = registry.prefetch([target.instance]);
    if (kind === 'disposed-admit') { await admitted; registry.dispose(); releaseAdmit(); }
    if (kind === 'disposed-create') { await created; registry.dispose(); releaseCreate(); }
    if (kind === 'success') {
      await request; assert.equal(cancellations, 0); assert.equal(registry.ready(target.instance), true);
      assert.equal(allocator.has(id), true); assert.equal(registry.unload(target.instance), true);
      assert.equal(disposals, 1); assert.equal(allocator.has(id), false);
    } else {
      await assert.rejects(request, kind === 'cancel-throws' ? (error) => {
        assert.ok(error instanceof AggregateError);
        assert.deepEqual(error.errors.map((failure) => failure.message), ['create failed', 'cancel cleanup failed']);
        return true;
      } : undefined);
      assert.equal(cancellations, 1); assert.equal(allocator.has(id), false);
      assert.equal(allocator.has(`sim:${target.instance}`), false);
      assert.equal(registry.ready(target.instance), false); assert.deepEqual(registry.state().pending, []);
      assert.equal(creations, ['create', 'cancel-throws', 'disposed-create', 'invalid-region'].includes(kind) ? 1 : 0);
      assert.equal(disposals, ['disposed-create', 'invalid-region'].includes(kind) ? 1 : 0);
      totalCancelled += cancellations;
    }
  } finally { registry.dispose(); player.motor.dispose(); page.dispose(); }
  assert.deepEqual(allocator.entries(), []);
}
console.info(JSON.stringify({ scenarios: scenarios.length, cancelled: totalCancelled, successfulRegionOwnsRelease: true, leakedClaims: 0 }));
