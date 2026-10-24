import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { TickWorkerHost } from '../../src/sdk/tickWorkerHost';
import type { Shardfile } from '../../src/sdk/shardfile';
import { headlessSections } from '../../src/sdk/headlessSections';
import { outputDescriptor } from '../../src/game/shardfile/outputDescriptor';
import { validateShardfileAssets } from '../../src/format/assetAdmission';
import { offlineMemoryAdmission, prepareAssetDecoders } from '../../src/format/product';
import { scriptAdmissionRows } from '../../src/format/scriptContract';
import { hashImmutableBytes } from '../../src/sdk/immutable';

export type NativeProofKind = 'driftwood' | 'nine' | 'trusted' | 'deferred';

/** One fixed test worker with statically named native factories; no caller-selected code URL. */
export async function createNativeProofWorker(shard: Shardfile, assets: ReadonlyMap<string, Uint8Array>, kind: NativeProofKind,
  snapshot?: string, supplied?: ReadonlyMap<string, unknown>, directory = `out/${shard.identity.slug}`): Promise<TickWorkerHost> {
  const sections = headlessSections(supplied ?? outputDescriptor(shard)?.sections);
  await prepareAssetDecoders();
  validateShardfileAssets(shard, assets, hashImmutableBytes, offlineMemoryAdmission('refuse'), undefined, scriptAdmissionRows(sections));
  const admitted = new Map<string, Uint8Array>();
  for (const hash of [...shard.files.map(file => file.hash), ...shard.requires.commons.map(hash => `commons:${hash}`)]) {
    const bytes = assets.get(hash); if (bytes === undefined) throw new Error('Missing admitted worker bytes'); admitted.set(hash, bytes);
  }
  const worker = new TickWorkerHost(new URL('./headless/worker.ts', import.meta.url),
    { shard, assets: admitted, kind, directory, sections, binary: resolve('public/assets/physics/rapier.wasm'), ...(snapshot === undefined ? {} : { snapshot }) },
    shard.serverBudget, ['--experimental-transform-types', '--import', pathToFileURL(resolve('scripts/sim-node-loader.mjs')).href], 'advisory');
  try { await worker.initialized(); return worker; } catch (error) { await worker.dispose(); throw error; }
}
