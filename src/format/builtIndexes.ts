declare const __SHARDFILE_VERDICTS__: unknown;

/** Build-owned address for one first-party index. The complete digest remains
 * admission authority; its short URL version is only a cache identity. */
export function builtIndexHash(path: string): string | null {
  const rows: unknown = typeof __SHARDFILE_VERDICTS__ === 'object' ? __SHARDFILE_VERDICTS__ : null;
  if (!Array.isArray(rows)) return null;
  let found: string | null = null;
  const verdicts: readonly unknown[] = rows;
  for (const row of verdicts) {
    if (typeof row !== 'object' || row === null || !('path' in row) || row.path !== path) continue;
    if (!('indexHash' in row) || typeof row.indexHash !== 'string' || !/^[a-f0-9]{64}$/u.test(row.indexHash)) throw new Error('Invalid built index address');
    if (found !== null && found !== row.indexHash) throw new Error('Ambiguous built index address');
    found = row.indexHash;
  }
  return found;
}

/** The exact first-party index hashes this client build validated; null for an unbundled client or a build with none. */
export function builtIndexHashes(): ReadonlySet<string> | null {
  const rows: unknown = typeof __SHARDFILE_VERDICTS__ === 'object' ? __SHARDFILE_VERDICTS__ : null;
  if (!Array.isArray(rows)) return null;
  const verdicts: readonly unknown[] = rows, hashes = new Set<string>();
  for (const row of verdicts) if (typeof row === 'object' && row !== null && 'indexHash' in row && typeof row.indexHash === 'string') hashes.add(row.indexHash);
  return hashes.size === 0 ? null : hashes;
}
