import * as v from 'valibot';
import type { BufferGeometry } from 'three';
import { createOwnedGeometry, type OwnedGeometry } from '@wildshard/engine/models/ownedGeometry';
import type { ShardProduct } from '../shardfile/shardProduct';
import type { readWholeGeometry } from '../plugin/geometry';

const text = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
/** A shard's named fixed draws: each slot a product GLB file, its channels renamed as declared (source, name). */
export const FixedDrawRowsSchema = v.pipe(v.array(v.strictObject({ slot: text, file: text, channels: v.pipe(v.array(v.tuple([text, text])), v.maxLength(16)) })),
  v.minLength(1), v.maxLength(128));

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

/** G571: a product's fixed draws (rows: `FixedDrawRowsSchema`) as owned geometry templates, loaded together. Client-only. */
export function fixedDraws(product: Pick<ShardProduct, 'file' | 'slug'>, input: unknown): FixedDraws {
  const rows = v.parse(FixedDrawRowsSchema, input), templates = new Map(rows.map(row => [row.slot, createOwnedGeometry(row.slot, Object.fromEntries(row.channels))]));
  if (templates.size !== rows.length) throw new Error('Repeated fixed draw slot');
  let ready = false;
  return {
    get ready() { return ready; },
    handle: slot => { const handle = templates.get(slot); if (handle === undefined) throw new Error(`Undeclared fixed draw: ${slot}`); return handle; },
    load: async (bytes, owner) => {
      const assembled = owner === undefined ? undefined : await (await import('../plugin/geometry')).readWholeGeometry(owner, product.slug);
      try {
        const admitted = new Map(await Promise.all(rows.map(async row => {
          const name = row.file, geometry = assembled?.get(name.slice(name.lastIndexOf('/') + 1, -4))?.geometry;
          const value = assembled === undefined ? bytes?.get(name) ?? (bytes === undefined ? await product.file(name) : undefined) : geometry;
          if (value === undefined) throw new Error(`Missing fixed draw: ${row.slot}`);
          return [row.slot, value] as const;
        })));
        if (assembled !== undefined && assembled.size !== admitted.size) throw new Error('Unexpected assembled fixed draw');
        await Promise.all([...templates].map(([slot, template]) => template.load(admitted.get(slot))));
        ready = true;
      } finally { for (const view of assembled?.values() ?? []) view.release?.(); }
    },
  };
}
