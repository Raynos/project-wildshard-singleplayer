declare const __SHARDFILE_VERDICTS__: unknown;

/** The exact first-party index hashes this client build validated; null for an unbundled client or a build with none. */
export function builtIndexHashes(): ReadonlySet<string> | null {
  const rows: unknown = typeof __SHARDFILE_VERDICTS__ === 'object' ? __SHARDFILE_VERDICTS__ : null;
  if (!Array.isArray(rows)) return null;
  const verdicts: readonly unknown[] = rows, hashes = new Set<string>();
  for (const row of verdicts) if (typeof row === 'object' && row !== null && 'indexHash' in row && typeof row.indexHash === 'string') hashes.add(row.indexHash);
  return hashes.size === 0 ? null : hashes;
}
