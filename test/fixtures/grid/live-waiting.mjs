// oxlint-disable-next-line import/no-nodejs-modules -- Native acceptance witness uses the shipped physics binary.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep the fixture independent of a browser and renderer.
import assert from 'node:assert/strict';
import { createSimHost } from '../../../src/engine/sim.ts';
import { loadRapier } from '../../../src/engine/physics/rapier.ts';
import { GridAssembly } from '../../../src/game/grid/assembly.ts';
import { TEMPLATE_WEST_GRID } from './templateWest.ts';
import { LiveGridHost } from '../../../src/game/grid/live.ts';
import { ResidencyAllocator } from '../../../src/game/grid/allocator.ts';

const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
const assembly = new GridAssembly({ developer: false, devserver: false }, TEMPLATE_WEST_GRID), home = assembly.cell('driftwood-isle');
const level = { version: 1, id: 'platform', seed: 1, ground: { size: 500, height: 0 },
  player: { at: { x: 0, y: 0, z: -194 }, yaw: 0, speed: 30 }, entities: [], quests: [],
  weapon: { id: 'none', shape: { kind: 'point', radius: 0 }, windup: 0, active: 0, recover: 0, cooldown: 0, range: 0, damage: 0, tags: [] } };
const page = createSimHost(level, { rapier }), allocator = new ResidencyAllocator();
const player = { position: page.player.position, yaw: 0, health: page.player.health, owner: page.player, motor: page.releasePlayerMotor() };
const attempts = new Map();
const registry = new LiveGridHost(assembly, {
  continuations: 'durable', maxResidents: 4,
  home: { instance: home.instance, physics: page.physics, bytes: 1_000_000, checkpoint: () => true },
  player, allocator, save: () => true, bindFrame: () => {}, gameplayReady: () => true,
  highway: { bytes: 1_000_000, create: () => {
    const host = createSimHost(level, { rapier, playerBody: false, ground: false });
    return { host, dispose: () => { host.dispose(); } };
  } },
  readiness: { link: { speed: 30, linkBitsPerSecond: 5_000_000, requestLatencySeconds: 0.25, maxStallSeconds: 10 },
    bundle: () => ({ criticalWireBytes: 2_000_000, hybridWireBytes: 0, decodeSeconds: 1, runtimeParseSeconds: 0 }) },
  prefetchable: cell => cell.slug === '_template',
  admit: async cell => {
    attempts.set(cell.instance, (attempts.get(cell.instance) ?? 0) + 1);
    if (cell.slug !== '_template') throw new Error('Not yet converted');
    return { bytes: 1_000_000, reloadsCheckpoint: true, create: async () => {
      const host = createSimHost(level, { rapier, playerBody: false, ground: false });
      return { host, dispose: () => { host.dispose(); } };
    } };
  },
});
try {
  // G258 makes the hybrids public, but this fixture only permits cheap template prefetch. G198 plots stay
  // platform ground, never candidates; nearby hybrids must not bypass the prefetchable port.
  registry.beforeFixed();
  assert.deepEqual(registry.state().pending, ['template-3']);
  await registry.prefetch(registry.state().pending);
  for (const id of ['template-3']) assert.equal(registry.ready(id), true);
  assert.equal(registry.ready('nalati-grasslands'), false); assert.equal(registry.ready('pine-hollow'), false);
  for (const id of ['template-2']) assert.equal(attempts.get(id), undefined); // outside the cold readiness radius: no new eager world
  for (const id of ['nalati-grasslands', 'pine-hollow', 'far-reach']) assert.equal(attempts.get(id), undefined);
  for (let tick = 0; tick < 20; tick++) registry.beforeFixed();
  for (const id of ['template-3']) assert.equal(attempts.get(id), 1);
  assert.equal(registry.state().residents.length <= 3, true);
  console.info(JSON.stringify({ warmed: registry.state().residents, waitingWallsClosed: true, repeatedFetches: 0 }));
} finally { registry.dispose(); player.motor.dispose(); page.dispose(); }
assert.deepEqual(allocator.entries(), []);
