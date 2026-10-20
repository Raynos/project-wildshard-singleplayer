// oxlint-disable-next-line import/no-nodejs-modules -- Exercise real native carry and its physics continuation.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { createSimHost, type SimHost } from '../src/engine/sim';
import { loadRapier } from '../src/engine/physics/rapier';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import { MoverScriptDriver, type MoverRuntime } from '../src/game/plugin/mover';
import { outputDescriptor } from '../src/game/shardfile/outputDescriptor';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { createTrustedHeadlessResident } from '../src/sdk/headlessRuntime';
import { emptyShardfile } from '../src/sdk/author';
import { canoeMover } from '../src/shards/pine-hollow/generators/canoe';
import { SIM_LEVEL } from './fixtures/sim-level/level';

const row = canoeMover(() => 2), level = { ...SIM_LEVEL, entities: [] };
function install(host: SimHost): MoverRuntime {
  const source = emptyShardfile({ slug: 'carry-test', name: 'Carry', author: 'Test', revision: 1, seed: 3 });
  return new MoverScriptDriver([row], host).install(host, { content: source, assets: new Map(),
    rules: { fields: {}, archetypes: [], events: [], maxEntities: 32 } }, { id: 'carry-test', drive: true });
}
test.each([180, 539])('native ride at tick %i owns carry/release, blocks walking, and resumes the same mover continuation', async (savedTick) => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const host = createSimHost(level, { rapier }), motion = install(host);
  let restored: SimHost | undefined, resumed: MoverRuntime | undefined;
  try {
    motion.command(row.id, 1);
    for (let tick = 0; tick < savedTick; tick++) host.step({ moveX: 1, moveZ: 1, yaw: 0 });
    expect(motion.riding(row.id)).toBe(true);
    const state = snapshotSimHost(host);
    restored = restoreSimHost(level, { rapier }, state, fresh => { resumed = install(fresh); });
    if (resumed === undefined) throw new Error('Missing restored mover');
    for (let tick = savedTick; tick < 550; tick++) {
      host.step({ moveX: 0, moveZ: 0, yaw: 0 }); restored.step({ moveX: 0, moveZ: 0, yaw: 0 });
      expect(restored.player.position.distanceTo(host.player.position)).toBeLessThan(1e-6);
      if (!motion.riding(row.id)) break;
    }
    expect(motion.riding(row.id)).toBe(false); expect(host.flags.has('secret:islet')).toBe(true);
    const landing = row.carry?.landings[1]; if (landing === undefined) throw new Error('Missing landing');
    expect(host.player.position.distanceTo(new Vector3(...landing))).toBeLessThan(1e-6);
    motion.command(row.id, 2);
    for (let tick = 0; tick < 550 && motion.riding(row.id); tick++) host.step();
    expect(motion.riding(row.id)).toBe(false);
    const shore = row.carry?.landings[0]; if (shore === undefined) throw new Error('Missing shore');
    expect(host.player.position.distanceTo(new Vector3(...shore))).toBeLessThan(1e-6);
  } finally { restored?.dispose(); host.dispose(); }
});

test('built Pine installs and commands its admitted carry without a shard ride installer', async () => {
  const product = await loadHeadlessProduct('out/pine-hollow'), source = product.shardfile;
  const descriptor = outputDescriptor(source); if (descriptor === undefined) throw new Error('Missing admitted inventory');
  expect(descriptor.index.files.some(file => file.name === 'movers/canoe.json')).toBe(false);
  const assets = new Map(descriptor.index.files.map(file => [file.commons === true ? `commons:${file.hash}` : file.hash,
    Uint8Array.from(readFileSync(`out/pine-hollow/${file.path}`))]));
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const resident = await createTrustedHeadlessResident({ shard: source, product, assets, rapier },
    { module: new URL('fixtures/pine-headless.ts', import.meta.url).href });
  try {
    const admitted = source.movers.find(value => value.id === 'pine.canoe');
    if (admitted?.carry === undefined) throw new Error('Missing admitted carry row');
    for (const [value, end] of [[1, 1], [2, 0]] as const) {
      resident.step([{ kind: 'script', actorId: admitted.id, value }]);
      expect(resident.host.events.ask('player.carrying', false)).toBe(true);
      for (let tick = 0; tick < 545 && resident.host.events.ask('player.carrying', false); tick++) resident.step([]);
      expect(resident.host.events.ask('player.carrying', false)).toBe(false);
      expect(resident.host.player.position.distanceTo(new Vector3(...admitted.carry.landings[end]))).toBeLessThan(1e-6);
    }
    expect(resident.host.flags.has('secret:islet')).toBe(true);
  } finally { resident.dispose(); }
}, 120_000);
