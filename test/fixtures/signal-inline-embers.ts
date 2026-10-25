// oxlint-disable-next-line import/no-nodejs-modules -- Reconstruct only the old transport for unchanged independent whole-product goldens.
import { Buffer } from 'node:buffer';
import { parseSceneBuffers } from '../../src/format/sceneBuffers';
import type { OutputFile } from '../../src/format/outputIndex';
import type { Shardfile } from '../../src/sdk/shardfile';
import { nameBlob } from '../../src/sdk/blobs';

/** Project only the new ember transport back to the original inline representation.
 * Full original declaration/output/asset goldens remain strict; no field is omitted. */
export function originalEmberTransport(files: readonly OutputFile[], source: ReadonlyMap<string, Uint8Array>) {
  const removed = new Set<string>(), replacements = new Map<string, OutputFile>(), assets = new Map(source);
  const deltas = { compressed: 0, resident: 0 };
  for (const file of files) {
    if (!/^world\/fields\/embers-[0-9]+\.json$/u.test(file.name ?? '')) continue;
    const bytes = source.get(file.hash); if (bytes === undefined) throw new Error('Missing ember descriptor');
    const scene = parseSceneBuffers(JSON.parse(new TextDecoder().decode(bytes)));
    const buffers = scene.buffers.map(({ file: name, byteOffset, byteLength, ...row }) => {
      const storage = files.find(value => value.name === name), data = storage === undefined ? undefined : source.get(storage.hash);
      if (storage === undefined || data === undefined || byteOffset === undefined || byteLength === undefined || row.bytes !== undefined)
        throw new Error('Missing packed ember oracle source');
      if (!removed.has(storage.hash)) {
        removed.add(storage.hash); assets.delete(storage.hash);
        deltas.compressed -= storage.compressed; deltas.resident -= storage.decoded + storage.gpu;
      }
      return { ...row, bytes: Buffer.from(data.subarray(byteOffset, byteOffset + byteLength)).toString('base64') };
    });
    if (file.name === undefined) throw new Error('Missing ember identity');
    const old = nameBlob(file.name, 'json', new TextEncoder().encode(JSON.stringify(parseSceneBuffers({ ...scene, buffers }))), { gpu: file.gpu });
    replacements.set(file.hash, old.file); assets.delete(file.hash); assets.set(old.file.hash, old.bytes);
    deltas.compressed += old.file.compressed - file.compressed;
    deltas.resident += old.file.decoded + old.file.gpu - file.decoded - file.gpu;
  }
  const namedFiles = files.filter(file => !removed.has(file.hash)).map(file => replacements.get(file.hash) ?? file);
  const shard = (input: Shardfile): Shardfile => ({ ...input,
    files: input.files.filter(file => !removed.has(file.hash)).map(file => {
      const old = replacements.get(file.hash); if (old === undefined) return file;
      const { name: _name, path: _path, jsonSchema: _schema, kind, ...metadata } = old;
      if (kind !== 'json') throw new Error('Invalid old ember kind');
      return { ...metadata, kind };
    }),
    library: input.library.filter(hash => !removed.has(hash)).map(hash => replacements.get(hash)?.hash ?? hash),
    budgets: { ...input.budgets, library: { ...input.budgets.library,
      compressed: input.budgets.library.compressed + deltas.compressed,
      resident: input.budgets.library.resident + deltas.resident,
      ...(input.budgets.library.downloadAllowance === undefined ? {} : { downloadAllowance: input.budgets.library.downloadAllowance + deltas.compressed }) } },
  });
  return { namedFiles, assets: new Map([...assets].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)), shard };
}
