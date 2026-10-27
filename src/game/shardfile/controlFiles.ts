import type { Shardfile } from '@wildshard/format/shardSchema';

/** I2: only an exact first-party validation receipt may use this transport subset. Keep the full declaration;
 * tile scopes verify their own later reads. Global/critical and manifest-construction bytes stay ready. */
export function controlFiles(source: Shardfile, selected: readonly Shardfile['files'][number][]): Shardfile['files'] {
  const card = source.presentation?.card;
  const pending = [...source.critical, ...source.library, ...source.files.filter(file => file.critical).map(file => file.hash),
    ...source.navigation === null ? [] : [source.navigation.file], ...source.map === undefined ? [] : [source.map.image],
    ...card === undefined ? [] : [card.thumb, card.portrait, card.landscape]];
  const needed = new Set<string>(), files = new Map(source.files.map(file => [file.hash, file]));
  while (pending.length > 0) {
    const ref = pending.pop(); if (ref === undefined) break;
    const hash = ref.replace(/^commons:/u, ''); if (needed.has(hash)) continue;
    needed.add(hash);
    const file = files.get(hash);
    if (file === undefined) {
      if (!source.requires.commons.includes(hash)) throw new Error('Control file is not declared');
    } else pending.push(...file.dependencies);
  }
  return selected.filter(file => needed.has(file.hash));
}

/** Remaining immutable transport warms nearest tiles first, dependencies with their first tile; nontile bytes last.
 * This order never changes the renderer's own required-tile priority or content declarations. */
export function deferredFiles(source: Shardfile, selected: readonly Shardfile['files'][number][], initial: ReadonlySet<string>): Shardfile['files'] {
  const files = new Map(source.files.map(file => [file.hash, file])), priority = new Map<string, number>();
  for (const tile of source.tiles) {
    const distance = Math.hypot((tile.bounds.min[0] + tile.bounds.max[0]) / 2 - source.spawn.x,
      (tile.bounds.min[2] + tile.bounds.max[2]) / 2 - source.spawn.z);
    const pending = [...tile.files], seen = new Set<string>();
    while (pending.length > 0) {
      const hash = pending.pop(); if (hash === undefined || seen.has(hash)) continue;
      seen.add(hash); priority.set(hash, Math.min(priority.get(hash) ?? Infinity, distance));
      pending.push(...files.get(hash)?.dependencies ?? []);
    }
  }
  return selected.filter(file => !initial.has(file.hash)).sort((a, b) => {
    const left = priority.get(a.hash), right = priority.get(b.hash);
    return left === right ? 0 : left === undefined ? 1 : right === undefined ? -1 : left - right;
  });
}
