import * as v from 'valibot';
import { PackedGeometryRowsSchema } from './geometryPack';

const text = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const finite = v.pipe(v.number(), v.finite());
const natural = v.pipe(finite, v.integer(), v.minValue(0));
const weapon = v.picklist(['crossbow', 'sword', 'rifle', 'sword-iron', 'bow', 'sabre', 'spear', 'empty']);
const override = v.strictObject({ color: v.exactOptional(finite), emissive: v.exactOptional(finite), emissiveIntensity: v.exactOptional(finite),
  roughness: v.exactOptional(finite), metalness: v.exactOptional(finite), envMapIntensity: v.exactOptional(finite), plain: v.exactOptional(v.boolean()) });
/** Pre-admission locker and Explorer card identities, in the authored order. */
export const HeldFinishCardSchema = v.strictObject({ id: text, name: text, blurb: text, lockedBlurb: text, icon: v.picklist(['crossbow', 'lever']) });
/** Materials, drop identities and optional geometry extras for held equipment. */
export const HeldFinishesSchema = v.strictObject({
  source: v.exactOptional(v.strictObject({ url: text, rows: PackedGeometryRowsSchema })),
  order: v.pipe(v.array(text), v.maxLength(128), v.check(rows => new Set(rows).size === rows.length)),
  rows: v.record(text, v.strictObject({ id: text, weapon, name: text, blurb: text,
    dropsFrom: v.exactOptional(v.strictObject({ kind: text, variant: text })), mats: v.record(text, override) })),
  cards: v.pipe(v.array(HeldFinishCardSchema), v.maxLength(128)),
  extras: v.record(text, v.pipe(v.array(v.strictObject({ name: text, geometry: natural,
    materials: v.pipe(v.array(text), v.minLength(1), v.maxLength(16)) })), v.maxLength(16))),
});
/** Data-only finish catalogue; the host resolves a scoped geometry source id, never a shard-built extra. */
export type HeldFinishesRows = v.InferOutput<typeof HeldFinishesSchema>;
