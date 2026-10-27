/** S3 road/junction adapter over the existing engine host. The caller supplies
 * already-durable tile refs and material pools; no whole-road source is kept. */
import type { Scope } from '@wildshard/engine/app/scope';
import { CONTENT_CAPS } from '@wildshard/engine/core/config';
import { TileStreamer, scopedTilePorts, type RingCatalogue, type RingCell, type TileStreamBudget } from '@wildshard/engine/world/tileStreamer';
import type { RoadLayout } from './roadLayout';
import { loadRoadTile, type RoadTileReference, type RoadTileStore } from './roadTileArchive';
import type { RoadTileGeometry } from './roadTileGeometry';
import { roadTileWorkingBytes, type RoadTilePool } from './roadTilePool';

/** One material's immutable backing. Pools retain only currently resident decoded tiles. */
export interface RoadTileSource { readonly pool: RoadTilePool; readonly references: readonly RoadTileReference[] }
export interface PreparedRoadTile { readonly scope: Scope; readonly parts: readonly { readonly pool: RoadTilePool; readonly data: RoadTileGeometry }[] }
interface Part { readonly pool: RoadTilePool; readonly reference: RoadTileReference }

/** One implementation of rings/budgets/readiness, with real road/junction kinds.
 * Fine-only road tiles have no fabricated zero-byte parent or fallback world.
 * Keep the existing collider strips and separately admitted shared materials.
 * All decoded allocations and replacement-buffer working bytes are reserved by
 * the host before fetch; pool publication/disposal runs within that tile lease. */
export function roadTileStream(scope: Scope, sources: readonly RoadTileSource[], origin: { readonly x: number; readonly z: number },
  layout: Pick<RoadLayout, 'junctions'>, budget: TileStreamBudget, store: RoadTileStore, id: string): TileStreamer<PreparedRoadTile> {
  if (scope.disposed || scope.disposing || !Number.isFinite(origin.x) || !Number.isFinite(origin.z)) throw new Error('Invalid road tile owner');
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u.test(id)) throw new Error('Invalid road stream identity');
  const tileKey = (x: number, z: number): string => `${id}:road:${String(x)},${String(z)}`;
  const size = CONTENT_CAPS.l0.size, parts = new Map<string, Part[]>(), coordinates = new Map<string, { x: number; z: number }>();
  for (const source of sources) for (const reference of source.references) {
    if (!Number.isSafeInteger(reference.x) || !Number.isSafeInteger(reference.z)) throw new Error('Invalid road tile coordinate');
    const key = tileKey(reference.x, reference.z), rows = parts.get(key) ?? [];
    if (rows.some(row => row.pool === source.pool)) throw new Error('Duplicate road material tile');
    rows.push({ pool: source.pool, reference: { ...reference } }); parts.set(key, rows); coordinates.set(key, { x: reference.x, z: reference.z });
  }
  const junctions = new Set(layout.junctions.map(junction => tileKey(Math.floor((junction.centre.x - origin.x) / size), Math.floor((junction.centre.z - origin.z) / size))));
  const cells: RingCell[] = [...coordinates].map(([instance, at]) => ({ instance, type: junctions.has(instance) ? 'junction' : 'road',
    origin: { x: origin.x + (at.x + 0.5) * size, z: origin.z + (at.z + 0.5) * size }, extent: { width: size, depth: size } }));
  const costs = new Map<string, number>();
  for (const [key, rows] of parts) {
    const cost = rows.reduce((sum, row) => sum + roadTileWorkingBytes(row.reference), 0);
    if (!Number.isSafeInteger(cost)) throw new Error('Road tile cost overflow');
    costs.set(key, cost);
  }
  const catalogue: RingCatalogue = Object.assign((instance: string, level: 'far' | 'l1' | 'l0', x: number, z: number): number | null =>
    level === 'l0' && x === 0 && z === 0 ? costs.get(instance) ?? null : null, { revision: (): number => 0 });
  const ports = scopedTilePorts<PreparedRoadTile>(scope, async (tile, owner) => {
    const rows = parts.get(tile.instance);
    if (rows === undefined || tile.level !== 'l0') throw new Error('Missing road tile backing');
    const prepared: { pool: RoadTilePool; data: RoadTileGeometry }[] = [];
    for (const row of rows) prepared.push({ pool: row.pool, data: await loadRoadTile(owner, store, row.reference) });
    return { scope: owner, parts: prepared };
  }, (tile, prepared) => {
    const views = prepared.parts.map(part => part.pool.publish(tile, part.data, prepared.scope));
    return { mask: excluded => { for (const view of views) view.mask(excluded); },
      shadow: enabled => { for (const view of views) view.shadow(enabled); } };
  });
  const roadBudget: TileStreamBudget = { ...(budget.now === undefined ? {} : { now: budget.now }),
    reserve: claim => budget.reserve({ ...claim, owner: 'platform' }) };
  const stream = new TileStreamer(cells, roadBudget, catalogue, ports, { viewDistance: CONTENT_CAPS.nearRadius, farPrefetch: 0,
    farRadius: CONTENT_CAPS.nearRadius });
  scope.onDispose(() => { stream.dispose(); });
  return stream;
}
