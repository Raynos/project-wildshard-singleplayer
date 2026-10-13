import { parseShardfile, type Shardfile } from '@wildshard/format/shardSchema';
import { assetCost } from '@wildshard/format/product';
import { hashImmutableBytes } from './immutable';

/** Build input for a baked map; paths and URLs never enter the authored product. */
export interface ProjectMap { readonly bytes: Uint8Array; readonly tilesHash: string }

/** Pack a bounded still image once into the charged library, retaining the exact authored pixels. */
export function packProjectMap(source: Shardfile, map: ProjectMap): { shard: Shardfile; hash: string } {
  const hash = hashImmutableBytes(map.bytes), cost = assetCost('image', map.bytes);
  if (source.map !== undefined && (source.map.image !== hash || source.map.tilesHash !== map.tilesHash)) throw new Error('Build map differs from the declared map');
  const existing = source.files.find(file => file.hash === hash);
  if (existing !== undefined && (existing.kind !== 'image' || existing.compressed !== map.bytes.length || existing.decoded !== cost.decoded || existing.gpu !== cost.gpu)) throw new Error('Build map differs from its declared image cost');
  const included = source.library.includes(hash);
  return { hash, shard: parseShardfile({ ...source, map: { image: hash, tilesHash: map.tilesHash },
    files: existing === undefined ? [...source.files, { hash, kind: 'image', compressed: map.bytes.length, ...cost, dependencies: [], critical: false }] : source.files,
    library: included ? source.library : [...source.library, hash],
    budgets: { ...source.budgets, library: { ...source.budgets.library,
      ...(source.budgets.library.downloadAllowance === undefined ? {} : { downloadAllowance: source.budgets.library.downloadAllowance + (included ? 0 : map.bytes.length) }),
      compressed: source.budgets.library.compressed + (included ? 0 : map.bytes.length),
      resident: source.budgets.library.resident + (included ? 0 : cost.decoded + cost.gpu) } },
  }) };
}
