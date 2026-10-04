import type { Shardfile } from './schema';
import { preflightShardfile } from './preflight';

/** Conservative transport/source heap claim: two parsed-source copies, owned asset buffers and map/object overhead. */
export function productResidentBytes(source: Shardfile): number {
  preflightShardfile(source);
  let heap = 0;
  const pending: unknown[] = [source];
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value === 'string') heap += 24 + value.length * 2;
    else if (Array.isArray(value)) { const items: readonly unknown[] = value; heap += 40 + items.length * 8; pending.push(...items); }
    else if (typeof value === 'object' && value !== null) {
      const entries = Object.entries(value); heap += 64 + entries.length * 16;
      for (const [key, item] of entries) { heap += 24 + key.length * 2; pending.push(item); }
    } else heap += 8;
  }
  // File/common aliases are copied into separate owned buffers by admitProduct, so count each actual Map entry.
  const wire = source.files.reduce((sum, file) => sum + file.compressed, 0)
    + source.requires.commons.reduce((sum, hash) => sum + (source.requires.commonsWire[hash] ?? 0), 0);
  return wire + heap * 2 + (source.files.length + source.requires.commons.length) * 128 + 1024;
}
