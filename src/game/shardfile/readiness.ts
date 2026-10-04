import { CONTENT_CAPS } from '@wildshard/engine/core/config';

/** Minimal admitted file graph used by the traversal scheduler; render tiles never enter this closure. */
export interface CriticalWireSource {
  critical: readonly string[];
  files: readonly { hash: string; compressed: number; dependencies: readonly string[] }[];
  sim: { scripts: readonly string[] };
  terrain: { collider: string } | null;
}

/** Count actual admitted critical bytes, deduplicating dependencies and including cold-cache commons. */
export function criticalWireBytes(source: CriticalWireSource, admittedAssets: ReadonlyMap<string, Uint8Array>): number {
  const files = new Map(source.files.map((file) => [file.hash, file])), seen = new Set<string>(), pending = [...source.critical];
  let bytes = 0;
  while (pending.length > 0) {
    const id = pending.pop(); if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    const file = files.get(id), payload = admittedAssets.get(id);
    if (payload === undefined || (file === undefined && !id.startsWith('commons:')) || (file !== undefined && file.compressed !== payload.byteLength)) throw new Error('Missing or mismatched admitted critical payload');
    bytes += payload.byteLength;
    if (bytes > CONTENT_CAPS.sim.compressed) throw new RangeError('Critical wire bundle exceeds 2 MB');
    pending.push(...(file?.dependencies ?? []));
  }
  if (source.sim.scripts.some((module) => !seen.has(module)) || (source.terrain !== null && !seen.has(source.terrain.collider))) throw new Error('Sim or collider omitted from critical bundle');
  return bytes;
}
