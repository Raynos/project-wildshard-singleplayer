import { parseShardfile, type Shardfile } from '../../src/sdk/shardfile';

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** D74's inverse for whole-product goldens pinned before it: every `{ family: 'graph', file }` look material gets its graph
 *  back inline, and the lowering's graph files leave the files, the library, its budget and the assets. The original
 *  declaration, output and asset goldens stay strict; only this one move is projected back. */
export function originalInlineMaterialGraphs(input: Shardfile, source: ReadonlyMap<string, Uint8Array>): { shard: Shardfile; assets: Map<string, Uint8Array> } {
  const value: unknown = JSON.parse(JSON.stringify(input));
  if (!record(value) || !record(value['look']) || !record(value['look']['materials'])) return { shard: input, assets: new Map(source) };
  const materials = value['look']['materials'], files = new Map(input.files.map(file => [file.hash, file]));
  const removed = new Set<string>(), assets = new Map(source);
  let compressed = 0, resident = 0;
  for (const [id, entry] of Object.entries(materials)) {
    if (!record(entry) || entry['family'] !== 'graph' || typeof entry['file'] !== 'string') continue;
    const hash = entry['file'], bytes = source.get(hash), file = files.get(hash);
    if (bytes === undefined || file === undefined) throw new Error(`Missing lowered material graph ${hash}`);
    materials[id] = { family: 'graph', graph: JSON.parse(new TextDecoder().decode(bytes)) };
    if (removed.has(hash)) continue;
    removed.add(hash); assets.delete(hash); compressed += file.compressed; resident += file.decoded + file.gpu;
  }
  const library = input.budgets.library;
  const shard = parseShardfile({ ...value, files: input.files.filter(file => !removed.has(file.hash)), library: input.library.filter(hash => !removed.has(hash)),
    budgets: { ...input.budgets, library: { ...library, compressed: library.compressed - compressed, resident: library.resident - resident,
      ...(library.downloadAllowance === undefined ? {} : { downloadAllowance: library.downloadAllowance - compressed }) } } });
  return { shard, assets: new Map([...assets].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) };
}
