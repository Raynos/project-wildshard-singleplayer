// oxlint-disable-next-line import/no-nodejs-modules -- Native regression reads the shipped physics module.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { nalatiNativeWitness, nalatiTamingNativeWitness } from './proof/nalati-grasslands/witness';
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
    const decoded = decodeSimSnapshot(serializeSimSnapshot(saved));
    restored = restoreSimHost(plan.level, ports, decoded, fresh => { plan.install(fresh, { restoring: true, snapshot: decoded, ...effects }); });
    expect(canonicalSimDigest(snapshotSimHost(restored))).toBe(canonicalSimDigest(saved));
    for (let tick = 0; tick < 30; tick++) { step(host); step(restored); }
    const continued = canonicalSimDigest(snapshotSimHost(restored));
    expect(continued).toBe(canonicalSimDigest(snapshotSimHost(host)));
  } finally {
    restored?.dispose(); host.dispose();
    expect(Object.values(host.scope.census).every(count => count === 0)).toBe(true);
    if (restored !== undefined) expect(Object.values(restored.scope.census).every(count => count === 0)).toBe(true);
  }
}, 120_000);


test('Nalati chapter landing retains native actor order, codec and strict suffix', async () => {
  const proof = v.parse(v.object({ replay: v.object({ codecByteExact: v.literal(true), suffixTicksExecuted: v.literal(60),
    checkpointCaptured: v.literal(true), suffixHash: v.string() }) }), await nalatiNativeWitness(true, false));
  expect(proof.replay.suffixHash).toMatch(/^[0-9a-f]{64}$/u);
}, 120_000);

test('Nalati chapter landing retains the native taming adoption suffix', async () => {
  const proof = v.parse(v.object({ taming: v.object({ suffixExact: v.literal(true), tulparAdopted: v.literal(true),
    originalHiddenAlive: v.literal(true), rounds: v.literal(5), ticksExecuted: v.number() }) }), await nalatiTamingNativeWitness());
  expect(proof.taming.ticksExecuted).toBeGreaterThan(0);
}, 180_000);
