// oxlint-disable-next-line import/no-nodejs-modules -- Native checkpoint regression uses the shipped physics module.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the existing checked native capability fixture.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture imports the real checked capability map.
import { pathToFileURL } from 'node:url';
import { expect,test } from 'vitest';
import * as v from 'valibot';
import { generateHeadlessModuleMap } from '../scripts/check-headless-assemblies.mjs';
import { prepareHeadlessAssembly,type HeadlessAssemblyModules } from '../src/sdk/headlessAssembly';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import type { ShardProduct } from '../src/game/shardfile/shardProduct';
import * as population from '../src/game/population/environment';
import { decodeTerrainTile } from '../src/format/terrainTileBytes';
import type { BakedGrid } from '../src/format/bakedTerrainBytes';
import { createSimHost,type SimHost } from '../src/engine/sim';
import { snapshotSimHost,serializeSimSnapshot,decodeSimSnapshot,restoreSimHost } from '../src/engine/sim/snapshot';
import { loadRapier } from '../src/engine/physics/rapier';
import rows from '../src/shards/nalati-grasslands/data/headlessAssembly.json' with { type: 'json' };
import { canonicalSimDigest } from './fake/simState';
import { nalatiNativeAssets } from './proof/nalati-grasslands/nativeAssets';

// Frozen pre-consolidation decoder: the independent old sampling admission and storage law.
function originalTerrain(bytes: Uint8Array | undefined,seed: number,row: { resolution: number;size: number }): BakedGrid {
  const tile = bytes === undefined ? null : decodeTerrainTile(bytes);
  if (tile?.splat === undefined || tile.colours !== undefined || tile.resolution !== row.resolution || tile.size !== row.size
    || tile.x !== -row.size/2 || tile.z !== -row.size/2) throw new Error('Native population needs its admitted query terrain sampling');
  return { res: tile.resolution,size: tile.size,seed,landscapeHash: 0,heights: tile.heights,splat: tile.splat,undergrowth: null };
}
function moduleMap(value: unknown): value is { readonly headlessModules: HeadlessAssemblyModules } {
  return value !== null && typeof value === 'object' && 'headlessModules' in value && value.headlessModules !== null
    && typeof value.headlessModules === 'object' && !Array.isArray(value.headlessModules)
    && Object.values(value.headlessModules).every((entry: unknown) => entry !== null && typeof entry === 'object');
}

test('declared sampling rows retain the original native checkpoint and restore suffix',async () => {
  const loaded: unknown = await import(/* @vite-ignore */ pathToFileURL(generateHeadlessModuleMap(resolve(import.meta.dirname,'..'),'nalati-grasslands')).href);
  if (!moduleMap(loaded)) throw new Error('Missing checked native capabilities');
  const metadata = v.parse(v.object({ modules: v.record(v.string(),v.array(v.string())),prepare: v.array(v.object({ name: v.string(),value: v.unknown() })) }),rows);
  const grid = metadata.prepare.find(row => row.name === 'grid');if (grid === undefined) throw new Error('Missing native grid');
  const call = v.parse(v.strictObject({ $call: v.tuple([v.unknown(),v.unknown(),v.unknown()]) }),grid.value).$call;
  expect(call[2]).toEqual({ resolution: 256,size: 500,seed: { $ref: ['shard','identity','seed'] } });
  const { '@wildshard/format/terrainTileBytes': _decoder,...modules } = metadata.modules;
  const product = await loadHeadlessProduct('out/nalati-grasslands'),rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const emitted: unknown = JSON.parse(new TextDecoder().decode(await product.file('sim/headless-assembly.json')));
  const original = v.parse(v.looseObject({ prepare: v.array(v.object({ name: v.string(),value: v.unknown() })) }),emitted);
  const candidateRows = { ...original,modules: metadata.modules,prepare: original.prepare.map(row => row.name === 'grid' ? grid : row) };
  const old = { ...original,modules: { ...modules,'@wildshard/game/population/environment': ['populationTerrain','NativePopulationField'] },
    prepare: original.prepare.map(row => row.name === 'grid' ? { name: row.name,value: { $call: [
      { $ref: ['@wildshard/game/population/environment','populationTerrain'] },call[1],{ $ref: ['shard','identity','seed'] },{ resolution: 256,size: 500 },
    ] } } : row) };
  const withAssembly = (data: unknown): ShardProduct => ({ ...product,file: name => name === 'sim/headless-assembly.json'
    ? Promise.resolve(new TextEncoder().encode(JSON.stringify(data))) : product.file(name) });
  // Only the declaration under test differs; every opaque product/asset read stays on the real admitted product.
  const context = { shard: product.shardfile,assets: nalatiNativeAssets(product.shardfile),rapier };
  const { '@wildshard/format/terrainTileBytes': _tile,...legacyModules } = loaded.headlessModules;
  const baseline = await prepareHeadlessAssembly({ ...context,product: withAssembly(old) },{ ...legacyModules,
    '@wildshard/game/population/environment': { NativePopulationField: population.NativePopulationField,populationTerrain: originalTerrain } });
  const candidate = await prepareHeadlessAssembly({ ...context,product: withAssembly(candidateRows) },loaded.headlessModules);
  const oldHost = createSimHost(baseline.level,{ ...baseline.ports,rapier }),nextHost = createSimHost(candidate.level,{ ...candidate.ports,rapier });
  let restored: SimHost | undefined;
  const effects = { commands: () => [],emit: () => undefined },step = (host: SimHost): void => { host.step({ moveX: .3*Math.sin(host.state.tick/90),moveZ: -1,yaw: 0 }); };
  try {
    baseline.install(oldHost,{ restoring: false,...effects });candidate.install(nextHost,{ restoring: false,...effects });
    for (let i=0;i<100;i++) { step(oldHost);step(nextHost); }
    const saved = serializeSimSnapshot(snapshotSimHost(oldHost));expect(serializeSimSnapshot(snapshotSimHost(nextHost)) === saved).toBe(true);
    const decoded = decodeSimSnapshot(saved);expect(serializeSimSnapshot(decoded) === saved).toBe(true);
    for (let i=0;i<30;i++) { step(oldHost);step(nextHost); }
    const continued = canonicalSimDigest(snapshotSimHost(oldHost));
    expect(canonicalSimDigest(snapshotSimHost(nextHost))).toBe(continued);
    // A restored world gets its own preparation/field owner, as an independent native entry does.
    const freshPlan = await prepareHeadlessAssembly({ ...context,product: withAssembly(candidateRows) },loaded.headlessModules);
    restored = restoreSimHost(freshPlan.level,{ ...freshPlan.ports,rapier },decoded,fresh => { freshPlan.install(fresh,{ restoring: true,snapshot: decoded,...effects }); });
    expect(canonicalSimDigest(snapshotSimHost(restored))).toBe(canonicalSimDigest(saved));
    for (let i=0;i<30;i++) step(restored);
    expect(canonicalSimDigest(snapshotSimHost(restored))).toBe(continued);
  } finally { restored?.dispose();nextHost.dispose();oldHost.dispose(); }
},120_000);
