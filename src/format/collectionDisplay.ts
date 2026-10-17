import * as v from 'valibot';
import { PackedGeometryRowsSchema } from './geometryPack';
import { AdventureContentSchema } from './questStory';

const text = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const finite = v.pipe(v.number(), v.minValue(-Number.MAX_VALUE), v.maxValue(Number.MAX_VALUE));
const natural = v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(10_000_000));
const triple = v.tuple([finite, finite, finite]);
const rect = v.tuple([finite, finite, finite, finite]);
// Reuse the existing placement contract; collections introduces no location identities.
const poi = AdventureContentSchema.entries.places.item.entries.at.entries.poi;
const params = v.record(text, v.union([finite, v.boolean()]));
const ranges = v.pipe(v.array(v.strictObject({ start: natural, count: natural })), v.maxLength(256));

/** Baked display parts: one merged draw, count reveals and paired empty/full trophy slots. */
export const CollectionModelSchema = v.strictObject({
  id: text, name: text, objectName: text, file: text, surface: v.picklist(['wood', 'stone', 'metal']), geometry: text,
  still: v.boolean(), ranges, defaults: params,
  variants: v.pipe(v.array(v.strictObject({ id: text, label: text, params })), v.maxLength(64)),
  count: v.exactOptional(v.strictObject({ from: natural, to: natural, parameter: text })),
  trophies: v.exactOptional(v.strictObject({ base: natural, empty: v.record(text, natural), full: v.record(text, natural),
    dropGeometry: text, dropOffsets: v.record(text, triple) })),
});
export type CollectionModelRow = v.InferOutput<typeof CollectionModelSchema>;
/** Card metadata is available before cold product admission. */
export const CollectionCardSchema = v.pick(CollectionModelSchema, ['id', 'name', 'file', 'surface', 'defaults', 'variants']);
export function parseCollectionCard(value: unknown): v.InferOutput<typeof CollectionCardSchema> { return v.parse(CollectionCardSchema, value); }

/** Shared pack and chalk declarations; their named bytes remain in the owning shard product. */
export const CollectionMountPackSchema = v.strictObject({ notice: text, url: text, sha256: text,
  rows: PackedGeometryRowsSchema, slots: v.record(text, natural),
});
export const CollectionChalkSchema = v.strictObject({ size: v.tuple([natural, natural]), outlines: v.record(text, rect), labels: v.record(text, rect) });
export type CollectionMountPack = v.InferOutput<typeof CollectionMountPackSchema>;
export type CollectionChalk = v.InferOutput<typeof CollectionChalkSchema>;

/** Keepsake presentation, without a new save owner: flags/Owned/progression keep their original ids. */
export const CollectionKeepsakesSchema = v.strictObject({
  floor: v.strictObject({ poi, anchor: text, x: finite, z: finite }),
  placements: v.pipe(v.array(v.strictObject({ model: text, role: v.picklist(['count', 'trophies']),
    poi, x: finite, z: finite, up: finite, yaw: finite, scale: finite, params, piece: v.strictObject({ id: text, name: text }),
  })), v.maxLength(32)),
  flags: v.strictObject({ prefix: text, count: natural }), delay: finite, spacing: finite,
  trophies: v.record(text, text),
  drops: v.record(text, v.strictObject({ model: text, trophy: v.exactOptional(text), wear: v.boolean() })),
  wardrobe: v.pipe(v.array(v.strictObject({ owned: text, slot: v.picklist(['hat', 'cape']), model: text })), v.maxLength(16)),
  restore: v.pipe(v.array(v.strictObject({ flag: text, item: text })), v.maxLength(32)), debugName: text,
});
export type CollectionKeepsakes = v.InferOutput<typeof CollectionKeepsakesSchema>;

/** Strict product rows for collection model cards and live keepsake presentation. */
export const CollectionDisplaysSchema = v.strictObject({ models: v.record(text, CollectionModelSchema), keepsakes: CollectionKeepsakesSchema });
export function parseCollectionDisplays(value: unknown): v.InferOutput<typeof CollectionDisplaysSchema> { return v.parse(CollectionDisplaysSchema, value); }
