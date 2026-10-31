import type { AuthorWorldScenes } from '@wildshard/sdk/worldScenes';
import { parseShardfileField, type Shardfile } from '@wildshard/sdk/shardfile';

/** D179 B's fine library already has a controlled refinement reader and coarse
 * coverage. Keep its otherwise-exclusive bodies out of the eager library copy;
 * ordinary shared consumers retain their original before-control admission. */
export function nineRefinementFiles(libraries: AuthorWorldScenes['libraries']): { hash: string }[] {
  const ordinary = new Set<string>(), fine = new Set<string>();
  for (const library of libraries) if (library.kind === 'whole' && library.load !== 'explorer') {
    const target = library.load === 'refine' ? fine : ordinary;
    for (const model of library.models) if ('files' in model) for (const file of model.files) target.add(file);
  }
  return [...fine].filter(hash => !ordinary.has(hash)).sort((a, b) => a < b ? -1 : a > b ? 1 : 0).map(hash => ({ hash }));
}

type TileCost = Pick<Shardfile['files'][number], 'hash' | 'compressed' | 'decoded' | 'gpu' | 'triangles' | 'draws'>;
type FineSource = Exclude<Extract<AuthorWorldScenes['libraries'][number], { kind: 'whole' }>, { storage: 'slabs' }>;
/** Only original fine bodies with a complete replacement and no ordinary/cold
 * consumer can retire. Identity rows never stand in for missing source authority. */
export function nineSlabSourceFiles(libraries: AuthorWorldScenes['libraries'], original?: FineSource): Set<string> {
  const covered = new Set<string>(), retained = new Set<string>();
  const keep = (file: string | { phone: string; desktop: string }): void => {
    if (typeof file === 'string') retained.add(file);
    else { retained.add(file.phone); retained.add(file.desktop); }
  };
  for (const library of libraries) if (library.kind !== 'whole') {
    if (library.kind === 'models' || library.kind === 'baked') keep(library.file);
    else if (library.kind === 'owned') for (const model of library.models) { keep(model.file); for (const segment of model.segments ?? []) keep(segment); }
    else if (library.kind === 'pool') { for (const file of library.files) keep(file.file); for (const painted of library.painted) keep(painted.file); }
    else for (const bank of library.tiles) for (const file of bank.files) keep(file.file);
  }
  for (const library of libraries) if (library.kind === 'whole') {
    if (library.load !== 'refine') {
      for (const model of library.models) for (const file of model.files) retained.add(file);
      continue;
    }
    const slabs = libraries.find(row => row.kind === 'slabs' && row.of === library.id);
    if (slabs?.kind !== 'slabs') continue;
    const source = 'storage' in library ? original : library;
    if (source === undefined || source.id !== library.id || source.load !== 'refine') throw new Error('Missing original fine source authority');
    const models = new Set(slabs.keys.flatMap(key => key.sources));
    if (source.models.some(model => !models.has(model.id))) throw new Error('Slabs omit a fine source model');
    for (const model of source.models) for (const hash of model.files) covered.add(hash);
  }
  return new Set([...covered].filter(hash => !retained.has(hash)));
}
/** Slab-covered source pieces remain available to the bake/cold oracle. They
 * no longer travel with an L0 tile whose fine draw reads the baked slabs. */
export function nineSlabTransport(input: unknown, files: readonly TileCost[], libraries: AuthorWorldScenes['libraries'], original?: FineSource): Shardfile['tiles'] {
  const tiles = parseShardfileField('tiles', input), exclusive = nineSlabSourceFiles(libraries, original);
  const declared = new Map(files.map(file => [file.hash, file]));
  for (const hash of exclusive) if (!declared.has(hash)) throw new Error(`Missing fine source metadata: ${hash}`);
  const selected: Shardfile['tiles'] = [];
  for (const tile of tiles) {
    if (tile.lod !== 0 || !tile.files.some(hash => exclusive.has(hash))) { selected.push(tile); continue; }
    const kept = tile.files.filter(hash => !exclusive.has(hash));
    const cost = { compressed: 0, decoded: 0, gpu: 0, triangles: 0, draws: 0 };
    for (const hash of kept) {
      const file = declared.get(hash); if (file === undefined) throw new Error(`Missing tile source metadata: ${hash}`);
      cost.compressed += file.compressed; cost.decoded += file.decoded; cost.gpu += file.gpu; cost.triangles += file.triangles; cost.draws += file.draws;
    }
    selected.push({ ...tile, files: kept, ...cost });
  }
  return selected;
}

/** Keep props' file bindings in exact agreement with the remaining tile
 * transport. Coarse coverage, cold models and collider ownership stay intact. */
export function nineSlabProps(input: unknown, libraries: AuthorWorldScenes['libraries'], original?: FineSource): Shardfile['props'] {
  const props = parseShardfileField('props', input); if (props === null) return null;
  const exclusive = nineSlabSourceFiles(libraries, original);
  const tiles: NonNullable<Shardfile['props']>['tiles'] = [];
  for (const tile of props.tiles) {
    if (tile.lod !== 0) { tiles.push(tile); continue; }
    const kept = [tile.file, ...tile.additionalFiles ?? []].filter(hash => !exclusive.has(hash)), first = kept[0];
    if (first === undefined) continue;
    const next = { ...tile, file: first }; delete next.additionalFiles;
    if (kept.length > 1) next.additionalFiles = kept.slice(1);
    tiles.push(next);
  }
  const retained = new Set([...tiles.flatMap(tile => [tile.file, ...tile.additionalFiles ?? []]), ...props.panels.map(row => row.file),
    ...props.models.map(row => row.file), ...(props.far === null ? [] : [props.far])]);
  const textures = props.textures.filter(row => !exclusive.has(row.model) || retained.has(row.model));
  return { ...props, tiles, textures };
}
