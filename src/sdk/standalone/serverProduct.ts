import type { Rapier } from '@wildshard/engine/physics/rapier';
import { isOutputIndex } from '@wildshard/format/outputAddress';
import { parseShardfile } from '@wildshard/format/shardSchema';
import { contentHash } from '@wildshard/game/shardfile/contentHash';
import { nodeNamedJsonCheck, nodeOutputDescriptorChecks } from '@wildshard/game/shardfile/outputChecksNode';
import { carryOutputDescriptor, outputDescriptor, resolveOutputDescriptor, serverReadsFile } from '@wildshard/game/shardfile/outputDescriptor';
import { shardProductData } from '@wildshard/game/shardfile/productData';
import type { HeadlessRuntimeInput } from '../headlessRuntime';

/**
 * P1-E5.2: the worker's product reader, loadHeadlessProduct over `fetch`. It verifies the same index, sizes and SHA-256
 * addresses with the same checks; only where the bytes come from differs. C2's server packs replace this.
 */
export async function fetchServerProduct(base: string, rapier: Rapier): Promise<HeadlessRuntimeInput> {
  const root = new URL(base, globalThis.location.href).href;
  const read = async (path: string): Promise<Uint8Array> => {
    const response = await fetch(new URL(path, root));
    if (!response.ok) throw new Error(`Missing server input ${path}`);
    return new Uint8Array(await response.arrayBuffer());
  };
  const input: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await read('shard.json')));
  if (!isOutputIndex(input)) throw new Error('Standalone needs a format-2 output');
  const assembled = await resolveOutputDescriptor(input, { offline: false, hash: contentHash, read, checks: nodeOutputDescriptorChecks });
  const shard = parseShardfile(assembled);
  carryOutputDescriptor(assembled, shard);
  const descriptor = outputDescriptor(shard);
  if (descriptor === undefined) throw new Error('Standalone output has no verified index');
  const files = new Map<string, { readonly path: string; readonly hash: string; readonly bytes: number }>();
  for (const file of descriptor.index.files) files.set(file.commons === true ? `commons:${file.hash}` : file.hash, { path: file.path, hash: file.hash, bytes: file.compressed });
  for (const file of descriptor.index.admission.server ?? []) files.set(file.hash, { path: file.path, hash: file.hash, bytes: file.bytes });
  const verified = async (ref: string): Promise<Uint8Array> => {
    const file = files.get(ref);
    if (file === undefined) throw new Error('Undeclared server input');
    const bytes = await read(file.path);
    if (bytes.length !== file.bytes || await contentHash(bytes) !== file.hash) throw new Error('Server input hash or size mismatch');
    return bytes;
  };
  const product = shardProductData(shard, root, verified, true, false, nodeNamedJsonCheck, { files: true });
  const assets = new Map<string, Uint8Array>();
  // E5.2b: only what a server reads. Everything else is the page's, and every byte here would be a phone's.
  await Promise.all(descriptor.index.files.filter(file => serverReadsFile(file, shard.terrain?.collider)).map(async file => { const ref = file.commons === true ? `commons:${file.hash}` : file.hash; assets.set(ref, await verified(ref)); }));
  return { shard, assets, rapier, product };
}
