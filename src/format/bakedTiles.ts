import * as v from 'valibot';

/**
 * Baked tiles (G532 (4)): a Blender-built set of terrain tiles drawn with one look, the lightmaps an offline bake lent to
 * that look, and optionally prototypes placed instanced from a placement table. `game/shardfile/bakedTiles` draws a row;
 * the `world.baked` client feature installs one from the client plan. Rows name files and looks, never code.
 *
 * Sources are a product's named file (`file`) or an immutable public asset path (`url`, under /assets/).
 * The placement table is `f32 × 10` per copy: prototype index, x, y, z, quaternion (x, y, z, w), scale, tint. The plan
 * (one per tier: the phone's is a prefix of the table) groups copies into families and holds their collider boxes.
 */
const finite = v.pipe(v.number(), v.finite());
const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128), v.regex(/^[a-zA-Z][a-zA-Z0-9._-]*$/u));
const name = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
/** A product's named file or an immutable public asset path (shared with the client plan's water rows). */
export const BakedSourceSchema = v.union([v.strictObject({ file: v.pipe(v.string(), v.minLength(1), v.maxLength(256)) }),
  v.strictObject({ url: v.pipe(v.string(), v.maxLength(512), v.regex(/^\/assets\/[A-Za-z0-9_./-]+$/u), v.check(path => !path.includes('..'), 'no traversal')) })]);
const source = BakedSourceSchema;
const tiers = <T extends v.GenericSchema>(row: T) => v.strictObject({ phone: row, desktop: row });
const part = v.strictObject({ geometry: name, material: id, clone: v.boolean(), castShadow: v.boolean(), receiveShadow: v.boolean() });
const parts = v.pipe(v.record(name, v.pipe(v.array(part), v.maxLength(16))), v.maxEntries(256));
/** A family's model: one variant per prototype, its parts reading the loaded prototypes by name (engine `defineGeometryModel`). */
const model = v.strictObject({
  id: name, name, file: name, category: v.literal('nature'), pipeline: v.union([v.picklist(['cc0', 'trellis', 'blender']), v.pipe(v.array(v.picklist(['cc0', 'trellis', 'blender'])), v.maxLength(3))]),
  defaults: v.strictObject({ proto: name }), variants: v.pipe(v.array(v.strictObject({ id: name, label: name, params: v.strictObject({ proto: name }) })), v.maxLength(256)),
  parts, specimenMaterial: id, lods: v.pipe(v.array(v.strictObject({ from: finite, parts })), v.maxLength(4)),
});
/** How a family's copies are culled: casters while the camera or `casters` m-padded shadow cascades see them, or by cells within `far`. */
const cull = v.union([v.strictObject({ flat: v.boolean(), casters: v.pipe(finite, v.minValue(0)) }),
  v.strictObject({ far: v.pipe(finite, v.minValue(0)), cells: v.strictObject({ size: v.pipe(finite, v.minValue(1)), pad: v.pipe(finite, v.minValue(0)) }) })]);

export const BakedTilesSchema = v.pipe(v.strictObject({
  /** the group's name; pieces are `<id>-<family>` and `<id>-unclaimed` */
  id,
  glb: source,
  /** a tier's tiles: the meshes whose name starts with its prefix, in file order */
  tiles: tiers(v.pipe(v.string(), v.minLength(1), v.maxLength(64))),
  look: id,
  /** metres the tiles and every copy stand lower than authored */
  drop: finite,
  meshPrefix: v.pipe(v.string(), v.maxLength(64)),
  /** the look takes the sky's cascade shadows (a standard surface; a graph look shades its own) */
  sky: v.boolean(),
  /** the look follows the product's toon day clock as the tiles draw */
  toonDay: v.boolean(),
  /** lent to the look's texture params; `channel` is the UV set they read */
  lightmaps: v.pipe(v.array(v.strictObject({ param: id, source: tiers(source), channel: v.picklist([0, 1]), anisotropy: v.pipe(finite, v.minValue(1), v.maxValue(16)) })), v.maxLength(4)),
  /** the look's bounce param follows the live sun: its luminance × elevation over the bake's reference, ÷ gain */
  sun: v.nullable(v.strictObject({ param: id, referenceY: v.pipe(finite, v.minValue(0.01)), gain: v.pipe(finite, v.minValue(1e-6)) })),
  instances: v.nullable(v.strictObject({
    table: source, protos: source,
    plan: tiers(v.strictObject({ source, bytes: v.pipe(finite, v.integer(), v.minValue(1)), used: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(50_000)) })),
    /** the prototype index's variant names */
    names: v.pipe(v.array(name), v.maxLength(256)),
    /** a part's material slot: its look and how its families' copies are culled */
    looks: v.pipe(v.record(id, v.strictObject({ look: id, cull: tiers(cull) })), v.maxEntries(8)),
    /** one model per family, its copies culled as its slot's */
    families: v.pipe(v.array(v.strictObject({ key: id, look: id, model })), v.maxLength(16)),
    /** what the collider boxes are made of, and the name of the piece holding boxes no copy claims */
    surface: v.picklist(['wood', 'stone', 'metal']), unclaimed: name,
  })),
}), v.check(row => row.instances === null || (row.instances.families.every(family => Object.hasOwn(row.instances?.looks ?? {}, family.look))
  && new Set(row.instances.families.map(family => family.key)).size === row.instances.families.length), 'families name declared looks and unique keys'));
export type BakedTilesRow = v.InferOutput<typeof BakedTilesSchema>;
export type BakedSource = BakedTilesRow['glb'];

const box = v.strictObject({ x: finite, z: finite, hw: finite, hd: finite, rot: finite, yTop: finite, yBottom: finite });
const index = v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(50_000));
/** A tier's placement plan: each family's copies (indices into the table) and collider boxes, and boxes no copy claims.
 *  A bake may carry fields of its own beside these. */
export const BakedPlanSchema = v.object({
  version: v.literal(1), used: index,
  families: v.pipe(v.array(v.object({ key: id, indices: v.pipe(v.array(index), v.maxLength(50_000)), colliders: v.pipe(v.array(box), v.maxLength(512)) })), v.maxLength(16)),
  unclaimed: v.pipe(v.array(box), v.maxLength(512)),
});
export type BakedPlan = v.InferOutput<typeof BakedPlanSchema>;
