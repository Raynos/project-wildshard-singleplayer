import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { runTickWorker } from '../../../src/sdk/tickWorkerLoop';
import { parseShardfile } from '../../../src/sdk/shardfile';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { prepareAssetDecoders, offlineMemoryAdmission } from '../../../src/format/product';
import { validateShardfileAssets } from '../../../src/format/assetAdmission';
import { scriptAdmissionRows } from '../../../src/format/scriptContract';
import { hashImmutableBytes } from '../../../src/sdk/immutable';
import { loadHeadlessProduct } from '../../../src/sdk/headlessProduct';
import { createShardProduct } from '../../../src/game/shardfile/shardProduct';
import { createNativeProofAdapter } from '../headless-native';
import type { PrepareHeadlessRuntime } from '../../../src/sdk/headlessRuntime';

await runTickWorker(async raw => {
  const payload = v.parse(v.strictObject({ shard: v.unknown(), assets: v.map(v.string(), v.instance(Uint8Array)),
    kind: v.picklist(['driftwood', 'pine', 'nine', 'trusted', 'deferred']), directory: v.string(), binary: v.string(),
    sections: v.map(v.string(), v.unknown()), snapshot: v.exactOptional(v.string()) }), raw);
  const shard = parseShardfile(payload.shard), rapier = await loadRapier(readFileSync(payload.binary));
  await prepareAssetDecoders();
  validateShardfileAssets(shard, payload.assets, hashImmutableBytes, offlineMemoryAdmission('refuse'), undefined, scriptAdmissionRows(payload.sections));
  let prepare: PrepareHeadlessRuntime, assets: ReadonlyMap<string, Uint8Array> = payload.assets;
  if (payload.kind === 'driftwood') prepare = (await import('../../proof/driftwood-isle/worker')).prepareHeadlessRuntime;
  else if (payload.kind === 'pine') {
    const native = await import('../pine-headless');
    prepare = native.prepareHeadlessRuntime; assets = native.pineHeadlessAssets(payload.assets);
  }
  else if (payload.kind === 'nine') prepare = (await import('../nine-headless')).prepareHeadlessRuntime;
  else if (payload.kind === 'trusted') prepare = (await import('./trustedRuntime')).prepareHeadlessRuntime;
  else prepare = (await import('./deferredRuntime')).prepareHeadlessRuntime;
  const product = payload.kind === 'trusted' || payload.kind === 'deferred'
    ? createShardProduct({ slug: shard.identity.slug, revision: shard.identity.revision, shardfile: shard, sections: payload.sections,
      files: new Map(), read: () => Promise.reject(new Error('Direct native fixture has no named files')) })
    : await loadHeadlessProduct(payload.directory);
  return createNativeProofAdapter({ shard, assets, rapier, product }, prepare, payload.snapshot);
});
