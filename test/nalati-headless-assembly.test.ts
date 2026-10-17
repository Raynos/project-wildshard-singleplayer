// oxlint-disable-next-line import/no-nodejs-modules -- Native regression reads the shipped physics module.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import source from '../src/shards/nalati-grasslands/shard.config';
import { createSimHost, type SimHost } from '../src/engine/sim';
import { snapshotSimHost, serializeSimSnapshot, decodeSimSnapshot, restoreSimHost } from '../src/engine/sim/snapshot';
import { loadRapier } from '../src/engine/physics/rapier';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { prepareHeadlessRuntime } from './fixtures/nalati-headless';
import { nalatiNativeAssets } from './proof/nalati-grasslands/nativeAssets';
import { canonicalSimDigest } from './fake/simState';

test('Nalati declared assembly retains its native 100 + 30 tick continuation', async () => {
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const plan = await prepareHeadlessRuntime({ shard: source, assets: nalatiNativeAssets(source), rapier, product: await loadHeadlessProduct('out/nalati-grasslands') });
  const ports = { ...plan.ports, rapier }, effects = { commands: () => [], emit: () => undefined };
  const host = createSimHost(plan.level, ports);
  let restored: SimHost | undefined;
  const step = (value: SimHost): void => { value.step({ moveX: 0.3 * Math.sin(value.state.tick / 90), moveZ: -1, yaw: 0 }); };
  try {
    plan.install(host, { restoring: false, ...effects });
    for (let tick = 0; tick < 100; tick++) step(host);
    const saved = snapshotSimHost(host);
    // Captured before replacing the original ordered installer. These digests
    // include every controller, canonical native body/collider and contact.
    expect(canonicalSimDigest(saved)).toBe('814deb891c90f506790d0f3d832848e18cf12642d8aecc97f3652e141ec4c4ee');
    const decoded = decodeSimSnapshot(serializeSimSnapshot(saved));
    restored = restoreSimHost(plan.level, ports, decoded, fresh => { plan.install(fresh, { restoring: true, snapshot: decoded, ...effects }); });
    expect(canonicalSimDigest(snapshotSimHost(restored))).toBe(canonicalSimDigest(saved));
    for (let tick = 0; tick < 30; tick++) { step(host); step(restored); }
    const continued = canonicalSimDigest(snapshotSimHost(restored));
    expect(continued).toBe('33272982c23215f1d9faf853d9b15d263a0ccacd703045c6095fc9df3ca154b2');
    expect(continued).toBe(canonicalSimDigest(snapshotSimHost(host)));
  } finally {
    restored?.dispose(); host.dispose();
    expect(Object.values(host.scope.census).every(count => count === 0)).toBe(true);
    if (restored !== undefined) expect(Object.values(restored.scope.census).every(count => count === 0)).toBe(true);
  }
}, 120_000);
