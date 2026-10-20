import * as v from 'valibot';
import { isJsonData } from '@wildshard/format/json';

const finite = v.pipe(v.number(), v.finite());
const whole = v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(268435456));
const text = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const assetPath = v.pipe(text, v.regex(/^\/assets\/[a-zA-Z0-9/_.-]+$/u), v.check(path => !path.split('/').includes('..'), 'asset path stays within assets'));
const paramsSchema = v.record(v.string(), v.unknown());
const surfaceSchema = v.picklist(['sand', 'wetSand', 'grass', 'rock', 'planks', 'stone', 'water', 'wood', 'metal', 'flesh', 'shell', 'ground', 'edge', 'felt', 'earth']);
const texture = v.strictObject({ url: assetPath, phoneUrl: assetPath, name: text });
export const SpecimenMaterialSchema = v.strictObject({ id: text, family: v.picklist(['lowpoly', 'painterly']), variant: v.optional(text),
  rim: v.optional(finite), bands: v.optional(finite), sway: v.optional(finite), floor: v.optional(finite),
  color: v.optional(v.union([v.string(), finite, v.tuple([finite, finite, finite])])), texture: v.optional(texture) });
const slot = v.pipe(whole, v.maxValue(128));
export const SpecimenAssetSchema = v.strictObject({ url: assetPath, phoneUrl: v.optional(assetPath), material: SpecimenMaterialSchema,
  geometrySlot: v.optional(slot), materialSlot: v.optional(slot), retainedAttribute: v.optional(text),
  instance: v.optional(v.strictObject({ name: text, lod: v.picklist(['near', 'far']) })) });
const pipeline = v.picklist(['code', 'blender', 'trellis', 'hunyuan', 'cc0']);
const model = v.strictObject({ id: text, name: text, file: text, category: v.picklist(['buildings', 'nature', 'creatures', 'people', 'gear', 'props']),
  pipeline: v.union([pipeline, v.pipe(v.array(pipeline), v.maxLength(16))]), surface: v.optional(surfaceSchema), defaults: paramsSchema,
  variants: v.optional(v.pipe(v.array(v.strictObject({ id: text, label: text, params: paramsSchema })), v.maxLength(256))),
  seed: v.optional(finite), specimenYaw: v.optional(finite) });
const box = v.strictObject({ kind: v.literal('box'), x: finite, y: finite, z: finite, hx: finite, hy: finite, hz: finite,
  yaw: v.optional(finite), surface: v.optional(surfaceSchema) });
/** Complete JSON wire schema. It deliberately has no executable fields or extension callbacks. */
export const SpecimenCatalogueSchema = v.pipe(v.array(v.strictObject({ key: text, model,
  colliders: v.optional(v.pipe(v.array(box), v.maxLength(1024))),
  source: v.variant('kind', [v.strictObject({ kind: v.literal('packed') }), v.strictObject({ kind: v.literal('asset'), asset: SpecimenAssetSchema }),
    v.strictObject({ kind: v.literal('owned'), material: SpecimenMaterialSchema, variants: v.pipe(v.array(v.strictObject({ params: paramsSchema, url: assetPath, size: v.tuple([finite, finite, finite]) })), v.maxLength(256)) })]),
})), v.maxLength(1024));
const geometrySchema = v.strictObject({ attrs: v.pipe(v.array(v.tuple([text, v.picklist(['f32', 'f16', 'u16', 'i8', 'u8']), whole, v.boolean()])), v.maxLength(32)),
  count: whole, index: v.nullable(v.picklist(['u16', 'u32'])), indexCount: whole, box: v.boolean(), expand: v.boolean() });
/** Packed bake metadata may also retain the generator's notice, part name and slot. */
export const PackedSpecimenSchema = v.object({ bin: assetPath, bytes: whole,
  rows: v.pipe(v.array(v.object({ key: text, parts: v.pipe(v.array(v.object({ material: text, geometry: geometrySchema })), v.maxLength(64)) })), v.maxLength(4096)) });
export const assertSpecimenJson = (input: unknown): void => { if (!isJsonData(input)) throw new Error('Specimen declarations require plain JSON data'); };

/** Seed-qualified prepared pickup parts. Compressed bytes stay encoded until an owner requests a copy. */
export const PickupCatalogueSchema = v.strictObject({
  file: text, seed: whole, coin: text,
  geometries: v.pipe(v.array(v.strictObject({ key: text, seed: whole, geometry: geometrySchema,
    data: v.pipe(v.string(), v.minLength(1), v.maxLength(1048576)) })), v.maxLength(256)),
  looks: v.pipe(v.array(v.strictObject({ id: text, model: text, name: text, lift: finite, batch: v.picklist(['lit', 'glow']),
    parts: v.pipe(v.array(v.strictObject({ key: text, batch: v.picklist(['lit', 'glow']),
      bob: v.exactOptional(v.tuple([finite, finite, finite])), pulse: v.exactOptional(finite) })), v.maxLength(16)),
  })), v.maxLength(64)),
});

