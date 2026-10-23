import type { ShardManifest } from './manifest';
import { shards } from './list';

/** Cold-title metadata contains no executable shard bindings. */
export type TitleManifest = Pick<ShardManifest, 'slug' | 'name' | 'biome' | 'status' | 'card' | 'legacy' | 'shardSelect' | 'shardfile' | 'gridShardfile'> & Pick<Partial<ShardManifest>, 'order' | 'bag'> & { readonly entries: NonNullable<ShardManifest['entries']> };
type TitleSource = Omit<TitleManifest, 'entries'> & { readonly entries?: TitleManifest['entries']; readonly load?: unknown };
/** Preserve discovery's entry defaults while copying no executable bindings. */
export function titleMetadata(row: TitleSource): TitleManifest {
  const { slug, name, biome, status, card, legacy, shardSelect, shardfile, gridShardfile, order, bag } = row;
  return { slug, name, biome, status, card, ...(order === undefined ? {} : {order}), ...(bag === undefined ? {} : {bag}), ...(legacy === undefined ? {} : { legacy }),
    ...(shardSelect === undefined ? {} : { shardSelect }), ...(shardfile === undefined ? {} : { shardfile }),
    ...(gridShardfile === undefined ? {} : { gridShardfile }),
    entries: row.entries ?? { legacy: row.load !== undefined, shardfile: row.load === undefined } };
}
let title: readonly TitleManifest[] | null = null;
const worldRows = new WeakMap<readonly ShardManifest[], readonly TitleManifest[]>();
const indexes = new WeakMap<readonly TitleManifest[], ReadonlyMap<string, TitleManifest>>();
/** The composition root installs generated data before recovery or title navigation. */
export function installTitleManifests(rows: readonly TitleManifest[]): void { title = rows; }
/** Loaded-world menus retain the full installed list when no title catalogue is supplied. */
export function titleManifests(): readonly TitleManifest[] {
  if (title !== null) return title;
  const installed = shards();
  let rows = worldRows.get(installed);
  if (rows === undefined) { rows = installed.map(titleMetadata); worldRows.set(installed, rows); }
  return rows;
}
/** Data-only cards plus original prepared manifests: grids and desktop keep their
 * full runnable catalogue; standalone pages prepare only the selected world. */
export function catalogueManifests():readonly (ShardManifest|TitleManifest)[]{
  const prepared=shards();
  if(title===null)return prepared;
  const rows=new Map<string,ShardManifest|TitleManifest>(title.map(row=>[row.slug,row]));
  for(const manifest of prepared)rows.set(manifest.slug,manifest);
  return [...rows.values()];
}
export function findTitleManifest(slug: string): TitleManifest | undefined {
  const rows = titleManifests();
  let index = indexes.get(rows);
  if (index === undefined) { index = new Map(rows.map(row => [row.slug, row])); indexes.set(rows, index); }
  return index.get(slug);
}
