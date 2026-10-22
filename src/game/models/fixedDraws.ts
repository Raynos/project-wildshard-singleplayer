import { FixedDrawRowsSchema } from '@wildshard/format/fixedDraws';
import * as v from 'valibot';
import type { BufferGeometry } from 'three';
import { createOwnedGeometry, type OwnedGeometry } from '@wildshard/engine/models/ownedGeometry';
import type { ShardProduct } from '../shardfile/shardProduct';
import type { Scope } from '@wildshard/engine/app/scope';
import { bakedGeometryBytes, readBakedGeometry, type readWholeGeometry } from '../plugin/geometry';

/** One loaded library of fixed draws (see fixedDraws). */
export interface FixedDraws {
  /** every slot's template has completed its intake */
  readonly ready: boolean;
  /** Load every slot together: through the product's verified reader, from `bytes` (a caller's named blobs: Explorer
   *  cards), or from `owner`'s whole-geometry assembly of the product (the world build). */
  load: (bytes?: ReadonlyMap<string, Uint8Array | BufferGeometry>, owner?: Parameters<typeof readWholeGeometry>[0]) => Promise<void>;
  /** the slot's owned template: its intake, a deep copy, or the template itself transferred */
  handle: (slot: string) => OwnedGeometry;
}

type FixedDrawRow = v.InferOutput<typeof FixedDrawRowsSchema>[number];
/** One slot's intake: a GLB file (or an assembled geometry) through the template's own loader, or a baked block decoded
 *  here: its byte count exact, its declared channels renamed, adopted without a copy. */
function admitSlot(row: FixedDrawRow, template: OwnedGeometry, value: Uint8Array | BufferGeometry | undefined): Promise<void> {
  const baked = row.baked;
  if (baked === undefined) return template.load(value);
  if (!(value instanceof Uint8Array)) return Promise.reject(new Error(`Baked fixed draw needs its file bytes: ${row.slot}`));
  if (value.byteLength !== bakedGeometryBytes(baked)) return Promise.reject(new Error(`Baked fixed draw byte count differs: ${row.slot}`));
  let geometry = readBakedGeometry(value, 0, baked);
  if (baked.expand) {
    const flat = geometry.toNonIndexed(); geometry.dispose(); geometry = flat;
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  }
  for (const [from, to] of row.channels) {
    if (!geometry.hasAttribute(from)) { geometry.dispose(); return Promise.reject(new Error(`Baked fixed draw is missing ${from}: ${row.slot}`)); }
    geometry.setAttribute(to, geometry.getAttribute(from)); geometry.deleteAttribute(from);
  }
  template.adopt(geometry);
  return Promise.resolve();
}

/** G571: a product's fixed draws (rows: `FixedDrawRowsSchema`) as owned geometry templates, loaded together. Client-only. */
export function fixedDraws(product: Pick<ShardProduct, 'file' | 'slug'>, input: unknown, intake: typeof createOwnedGeometry = createOwnedGeometry): FixedDraws {
  const rows = v.parse(FixedDrawRowsSchema, input), templates = new Map(rows.map(row => [row.slot, intake(row.slot, Object.fromEntries(row.channels))]));
  if (templates.size !== rows.length) throw new Error('Repeated fixed draw slot');
  let ready = false;
  return {
    get ready() { return ready; },
    handle: slot => { const handle = templates.get(slot); if (handle === undefined) throw new Error(`Undeclared fixed draw: ${slot}`); return handle; },
    load: async (bytes, owner) => {
      const assembled = owner === undefined ? undefined : await (await import('../plugin/geometry')).readWholeGeometry(owner, product.slug);
      try {
        const admitted = new Map(await Promise.all(rows.map(async row => {
          // a baked block is never part of the whole-geometry assembly (GLB meshes only): it reads its own file
          const name = row.file, geometry = row.baked === undefined ? assembled?.get(name.slice(name.lastIndexOf('/') + 1, -4))?.geometry : undefined;
          const value = assembled === undefined || row.baked !== undefined ? bytes?.get(name) ?? (bytes === undefined ? await product.file(name) : undefined) : geometry;
          if (value === undefined) throw new Error(`Missing fixed draw: ${row.slot}`);
          return [row.slot, value] as const;
        })));
        if (assembled !== undefined && assembled.size !== rows.filter(row => row.baked === undefined).length) throw new Error('Unexpected assembled fixed draw');
        await Promise.all(rows.map(row => {
          const template = templates.get(row.slot); if (template === undefined) throw new Error(`Undeclared fixed draw: ${row.slot}`);
          return admitSlot(row, template, admitted.get(row.slot));
        }));
        ready = true;
      } finally { for (const view of assembled?.values() ?? []) view.release?.(); }
    },
  };
}

/** G571: a cold view's own fixed draws (a kit-figure Explorer card): exactly `slots` of the admitted rows, through the
 *  same loader and format, owned by `cardScope` (never the live world's library, and no cache). Every slot's read and
 *  decode settles before the result: a card closed or retiring meanwhile, or any failed slot, releases exactly the
 *  templates that did load and refuses; the card's retirement releases them later. Looks and materials stay the caller's. */
export async function coldFixedDraws(product: Pick<ShardProduct, 'file' | 'slug'>, input: unknown, cardScope: Scope, slots: readonly string[],
  intake: typeof createOwnedGeometry = createOwnedGeometry): Promise<FixedDraws> {
  const wanted = new Set(slots), rows = v.parse(FixedDrawRowsSchema, input).filter(row => wanted.has(row.slot));
  if (wanted.size !== slots.length || rows.length !== wanted.size) throw new Error('Cold fixed draws name an undeclared or repeated slot');
  const closed = (): boolean => cardScope.disposed || cardScope.disposing;
  if (closed()) throw new Error('Cold fixed draws owner left');
  const draws = fixedDraws(product, rows, intake), loaded: string[] = [];
  const release = (): void => { for (const slot of loaded.splice(0)) draws.handle(slot).take().dispose(); };
  const settled = await Promise.allSettled(rows.map(async row => {
    const bytes = await product.file(row.file);
    if (closed()) throw new Error('Cold fixed draws owner left');
    await admitSlot(row, draws.handle(row.slot), bytes); loaded.push(row.slot);
  }));
  const failed = settled.find(result => result.status === 'rejected');
  if (failed !== undefined || closed()) {
    release();
    const reason: unknown = failed?.reason;
    throw reason instanceof Error ? reason : new Error('Cold fixed draws owner left');
  }
  let live = true;
  cardScope.onDispose(() => { live = false; release(); });
  const refuse = (): void => { if (!live || closed()) throw new Error('Cold fixed draws owner left'); };
  return { get ready() { return live && !closed(); }, handle: slot => { refuse(); return draws.handle(slot); },
    load: () => { try { refuse(); return Promise.resolve(); } catch (error) { return Promise.reject(error instanceof Error ? error : new Error(String(error))); } } };
}
