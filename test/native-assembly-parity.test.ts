// oxlint-disable-next-line import/no-nodejs-modules -- The parity proof runs the shipped product bytes and physics module.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { NATIVE_ASSEMBLY_FILE, NativeAssemblyDataSchema, parseNativeAssembly } from '@wildshard/format/nativeAssembly';
import { encodeCanonicalJson } from '../src/sdk/immutable';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { outputDescriptor } from '../src/game/shardfile/outputDescriptor';
import { loadRapier } from '../src/engine/physics/rapier';
import { headlessAssemblyPorts, type PrepareHeadlessRuntime } from '../src/sdk/headlessRuntime';
import type { ShardProduct } from '../src/game/shardfile/shardProduct';
import { prepareProductRuntimePlan } from '../src/game/shardfile/nativePlan';
import { serializeSimSnapshot, snapshotSimHost } from '../src/engine/sim/snapshot';
import { builtProduct } from './fixtures/builtProduct';
import { createNativeProofResident } from './fixtures/headless-native';
import { driftwoodAssembly, nalatiAssembly, pineAssembly, type EmittedAssembly } from './fixtures/native-assembly-plans';
import { pineHeadlessAssets, prepareHeadlessRuntime as preparePine } from './fixtures/pine-headless';
import { prepareHeadlessRuntime as prepareDriftwood } from './fixtures/driftwood-headless';
import { prepareHeadlessRuntime as prepareNalati } from './fixtures/nalati-headless';

/** The shipped product with a plan's server files lent: what a shard's generator will write, without rebuilding it. */
function withServerFiles(product: ShardProduct, emitted: EmittedAssembly): ShardProduct {
  const files = new Map<string, Uint8Array>(emitted.binary), encoder = new TextEncoder();
  for (const [name, value] of [[NATIVE_ASSEMBLY_FILE, emitted.plan] as const, ...emitted.json]) files.set(name, encoder.encode(encodeCanonicalJson(value)));
  return { ...product, hasFile: name => files.has(name) || product.hasFile(name),
    file: name => { const bytes = files.get(name); return bytes === undefined ? product.file(name) : Promise.resolve(bytes); } };
}
const steps = [...Array.from({ length: 120 }, () => [{ kind: 'player' as const, moveX: 0.6, moveZ: -0.8, yaw: 0 }]), ...Array.from({ length: 60 }, () => [{ kind: 'player' as const, moveX: -1, moveZ: 0, yaw: 1.5 }])];

test.each([
  { slug: 'pine-hollow', direct: preparePine, emit: pineAssembly },
  { slug: 'driftwood-isle', direct: prepareDriftwood, emit: () => driftwoodAssembly() },
  { slug: 'nalati-grasslands', direct: prepareNalati as PrepareHeadlessRuntime, emit: nalatiAssembly },
])('$slug: its native assembly installs the same world as its direct fixture, tick for tick', async ({ slug, direct, emit }) => {
  const directory = builtProduct(slug), product = await loadHeadlessProduct(directory), shard = product.shardfile, descriptor = outputDescriptor(shard);
  if (descriptor === undefined) throw new Error(`Missing admitted ${slug} output`);
  const shipped = new Map(descriptor.index.files.map(file => [file.commons === true ? `commons:${file.hash}` : file.hash, Uint8Array.from(readFileSync(`${directory}/${file.path}`))]));
  const assets = slug === 'pine-hollow' ? pineHeadlessAssets(shipped) : shipped, rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const emitted = await emit(product);
  expect(parseNativeAssembly(emitted.plan).features.length).toBeGreaterThan(0);
  for (const value of emitted.json.values()) expect(() => v.parse(NativeAssemblyDataSchema, value)).not.toThrow();
  const planned = withServerFiles(product, emitted), preparation = { shard, assets, rapier, product };
  const fromPlan: PrepareHeadlessRuntime = () => prepareProductRuntimePlan(planned, shipped, headlessAssemblyPorts(rapier));
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
