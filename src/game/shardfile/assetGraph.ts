import type { Shardfile } from './schema';

/** Refuse orphan wire assets and require look LUTs in the charged library closure before any asset read. */
export function preflightAssetGraph(source: Pick<Shardfile, 'files' | 'library' | 'critical' | 'tiles' | 'far' | 'look' | 'requires'> & Partial<Pick<Shardfile, 'rows' | 'presentation'>>): void {
  const files = new Map(source.files.map((file) => [file.hash, file]));
  const closure = (roots: readonly string[]): Set<string> => {
    const found = new Set<string>(), pending = [...roots];
    while (pending.length > 0) {
      const ref = pending.pop(); if (ref === undefined || found.has(ref)) continue;
      found.add(ref); for (const dependency of files.get(ref)?.dependencies ?? []) pending.push(dependency);
    }
    return found;
  };
  const library = closure(source.library), lut = source.look.grade.lut;
  if (lut !== null && !library.has(lut)) throw new Error('Look LUT must be in the charged library closure');
  for (const ref of Object.values(source.presentation?.card ?? {})) {
    if (!library.has(ref) || files.get(ref)?.kind !== 'image') throw new Error('Presentation images must be declared image files in the charged library closure');
  }
  for (const row of source.rows?.compendiums ?? []) for (const entry of row.entries) {
    if (!entry.sketch.startsWith('data:') && !library.has(entry.sketch)) throw new Error('Compendium sketch hash must be in the charged library closure');
  }
  const reachable = closure([...source.library, ...source.critical, ...source.tiles.flatMap((tile) => tile.files), ...source.far?.files ?? []]);
  if (source.files.some((file) => !reachable.has(file.hash)) || source.requires.commons.some((hash) => !reachable.has(`commons:${hash}`))) throw new Error('Orphan shardfile asset is not reachable from a bundle root');
}
