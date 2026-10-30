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
    kind: v.picklist(['driftwood', 'sky-verbs', 'pine', 'pine-verbs', 'nine', 'nine-flat', 'nalati', 'nalati-world', 'nalati-verbs', 'nalati-kokpar', 'trusted', 'deferred']), directory: v.string(), binary: v.string(),
    sections: v.map(v.string(), v.unknown()), snapshot: v.exactOptional(v.string()) }), raw);
  const shard = parseShardfile(payload.shard), rapier = await loadRapier(readFileSync(payload.binary));
  await prepareAssetDecoders();
  validateShardfileAssets(shard, payload.assets, hashImmutableBytes, offlineMemoryAdmission('refuse'), undefined, scriptAdmissionRows(payload.sections));
  let prepare: PrepareHeadlessRuntime, assets: ReadonlyMap<string, Uint8Array> = payload.assets;
  if (payload.kind === 'driftwood') prepare = (await import('../../proof/driftwood-isle/worker')).prepareHeadlessRuntime;
  else if (payload.kind === 'pine' || payload.kind === 'pine-verbs') {
    const native = await import('../pine-headless');
    prepare = payload.kind === 'pine-verbs' ? (await import('../pine-verbs')).prepareHeadlessRuntime : native.prepareHeadlessRuntime; assets = native.pineHeadlessAssets(payload.assets);
  }
  else if (payload.kind === 'sky-verbs') prepare = (await import('../sky-verbs')).prepareHeadlessRuntime;
  else if (payload.kind === 'nine-flat') prepare = (await import('../nine-headless')).nineHeadlessRuntime(false);
  else if (payload.kind === 'nine') prepare = (await import('../nine-headless')).prepareHeadlessRuntime;
  else if (payload.kind === 'nalati') prepare = (await import('../nalati-headless')).prepareHeadlessRuntime;
  else if (payload.kind === 'nalati-world') prepare = (await import('../nalati-world-verbs')).prepareHeadlessRuntime;
  else if (payload.kind === 'nalati-verbs') prepare = (await import('../nalati-verbs')).prepareHeadlessRuntime;
  else if (payload.kind === 'nalati-kokpar') prepare = (await import('../nalati-kokpar-native')).prepareHeadlessRuntime;
  else if (payload.kind === 'trusted') prepare = (await import('./trustedRuntime')).prepareHeadlessRuntime;
  else prepare = (await import('./deferredRuntime')).prepareHeadlessRuntime;
  const product = payload.kind === 'trusted' || payload.kind === 'deferred'
    ? createShardProduct({ slug: shard.identity.slug, revision: shard.identity.revision, shardfile: shard, sections: payload.sections,
      files: new Map(), read: () => Promise.reject(new Error('Direct native fixture has no named files')) })
    : await loadHeadlessProduct(payload.directory);
  return createNativeProofAdapter({ shard, assets, rapier, product }, prepare, payload.snapshot);
});
