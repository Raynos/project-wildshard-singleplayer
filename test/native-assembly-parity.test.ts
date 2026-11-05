// oxlint-disable-next-line import/no-nodejs-modules -- The parity proof runs the shipped product bytes and physics module.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { NATIVE_ASSEMBLY_FILE, parseNativeAssembly } from '@wildshard/format/nativeAssembly';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { outputDescriptor } from '../src/game/shardfile/outputDescriptor';
import { loadRapier } from '../src/engine/physics/rapier';
import { headlessAssemblyPorts, type PrepareHeadlessRuntime } from '../src/sdk/headlessRuntime';
import { prepareProductRuntimePlan } from '../src/game/shardfile/nativePlan';
import { serializeSimSnapshot, snapshotSimHost } from '../src/engine/sim/snapshot';
import { builtProduct } from './fixtures/builtProduct';
import { createNativeProofResident } from './fixtures/headless-native';
import { prepareHeadlessRuntime as prepareNalati } from './fixtures/nalati-headless';

const steps = [...Array.from({ length: 120 }, () => [{ kind: 'player' as const, moveX: 0.6, moveZ: -0.8, yaw: 0 }]), ...Array.from({ length: 60 }, () => [{ kind: 'player' as const, moveX: -1, moveZ: 0, yaw: 1.5 }])];

test.each([
  { slug: 'nalati-grasslands', direct: prepareNalati as PrepareHeadlessRuntime },
])('$slug: its built native assembly installs the same world as its direct fixture, tick for tick', async ({ slug, direct }) => {
  const directory = builtProduct(slug), product = await loadHeadlessProduct(directory), shard = product.shardfile, descriptor = outputDescriptor(shard);
  if (descriptor === undefined) throw new Error(`Missing admitted ${slug} output`);
  const assets = new Map(descriptor.index.files.map(file => [file.commons === true ? `commons:${file.hash}` : file.hash, Uint8Array.from(readFileSync(`${directory}/${file.path}`))]));
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  expect(parseNativeAssembly(await product.json(NATIVE_ASSEMBLY_FILE)).features.length).toBeGreaterThan(0);
  const preparation = { shard, assets, rapier, product };
  const fromPlan: PrepareHeadlessRuntime = () => prepareProductRuntimePlan(product, assets, headlessAssemblyPorts(rapier));
  const [baseline, candidate] = await Promise.all([createNativeProofResident(preparation, direct), createNativeProofResident(preparation, fromPlan)]);
  try {
    expect([...candidate.host.entities.keys()]).toEqual([...baseline.host.entities.keys()]);
    expect(serializeSimSnapshot(snapshotSimHost(candidate.host))).toBe(serializeSimSnapshot(snapshotSimHost(baseline.host)));
    for (const input of steps) { baseline.step(input); candidate.step(input); }
    const saved = serializeSimSnapshot(snapshotSimHost(baseline.host));
    expect(serializeSimSnapshot(snapshotSimHost(candidate.host))).toBe(saved);
    // A plan restores what a direct fixture saved, and both carry on identically.
    const restored = await createNativeProofResident(preparation, fromPlan, saved);
    try {
      for (const input of steps.slice(0, 60)) { baseline.step(input); restored.step(input); }
      expect(serializeSimSnapshot(snapshotSimHost(restored.host))).toBe(serializeSimSnapshot(snapshotSimHost(baseline.host)));
    } finally { restored.dispose(); }
  } finally { baseline.dispose(); candidate.dispose(); }
}, 240_000);
