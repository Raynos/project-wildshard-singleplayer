import { prepareHeadlessRuntime } from './fixtures/nalati-headless';
// oxlint-disable-next-line import/no-nodejs-modules -- Native checkpoint regression uses the shipped physics module.
import { readFileSync } from 'node:fs';
import { expect,test } from 'vitest';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { builtProduct } from './fixtures/builtProduct';
import { decodeTerrainTile } from '../src/format/terrainTileBytes';
import type { BakedGrid } from '../src/format/bakedTerrainBytes';
import { createSimHost,type SimHost } from '../src/engine/sim';
import { snapshotSimHost,serializeSimSnapshot,decodeSimSnapshot,restoreSimHost } from '../src/engine/sim/snapshot';
import { loadRapier } from '../src/engine/physics/rapier';
import { canonicalSimDigest } from './fake/simState';
import { nalatiNativeAssets } from './proof/nalati-grasslands/nativeAssets';

// Frozen pre-consolidation decoder: the independent old sampling admission and storage law.
function originalTerrain(bytes: Uint8Array | undefined,seed: number,row: { resolution: number;size: number }): BakedGrid {
  const tile = bytes === undefined ? null : decodeTerrainTile(bytes);
  if (tile?.splat === undefined || tile.colours !== undefined || tile.resolution !== row.resolution || tile.size !== row.size
    || tile.x !== -row.size/2 || tile.z !== -row.size/2) throw new Error('Native population needs its admitted query terrain sampling');
  return { res: tile.resolution,size: tile.size,seed,landscapeHash: 0,heights: tile.heights,splat: tile.splat,undergrowth: null };
}
test('declared sampling rows retain the original native checkpoint and restore suffix',async () => {
  const product = await loadHeadlessProduct(builtProduct('nalati-grasslands')),rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const context={shard:product.shardfile,assets:nalatiNativeAssets(product.shardfile),rapier,product};
  // Only the decoder differs; all named product reads and native host calls stay on the same direct factory.
  let terrainReads=0;
  const baseline=await prepareHeadlessRuntime(context,(bytes,row)=>{
    terrainReads++;expect(row).toEqual({resolution:256,size:500,seed:context.shard.identity.seed});
    return originalTerrain(bytes,row.seed,row);
  });
  expect(terrainReads).toBe(1);
  const candidate=await prepareHeadlessRuntime(context);
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
    const freshPlan = await prepareHeadlessRuntime(context);
    restored = restoreSimHost(freshPlan.level,{ ...freshPlan.ports,rapier },decoded,fresh => { freshPlan.install(fresh,{ restoring: true,snapshot: decoded,...effects }); });
    expect(canonicalSimDigest(snapshotSimHost(restored))).toBe(canonicalSimDigest(saved));
    for (let i=0;i<30;i++) step(restored);
    expect(canonicalSimDigest(snapshotSimHost(restored))).toBe(continued);
  } finally { restored?.dispose();nextHost.dispose();oldHost.dispose(); }
},120_000);
