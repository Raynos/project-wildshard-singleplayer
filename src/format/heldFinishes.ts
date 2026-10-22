import * as v from 'valibot';
import { CatalogueIconSchema } from './items';
import { PackedGeometryRowsSchema } from './geometryPack';

const text = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const finite = v.pipe(v.number(), v.finite());
const natural = v.pipe(finite, v.integer(), v.minValue(0));
const weapon = v.picklist(['crossbow', 'sword', 'rifle', 'sword-iron', 'bow', 'sabre', 'spear', 'empty']);
const override = v.strictObject({ color: v.exactOptional(finite), emissive: v.exactOptional(finite), emissiveIntensity: v.exactOptional(finite),
  roughness: v.exactOptional(finite), metalness: v.exactOptional(finite), envMapIntensity: v.exactOptional(finite), plain: v.exactOptional(v.boolean()) });
/** Pre-admission locker and Explorer card identities, in the authored order. */
export const HeldFinishCardSchema = v.strictObject({ id: text, name: text, blurb: text, lockedBlurb: text, icon: v.picklist(['crossbow', 'lever']) });
const rgb = v.tuple([finite, finite, finite]);
const range = v.tuple([finite, finite]);
const tag = v.pipe(text, v.regex(/\./u)) as v.GenericSchema<`${string}.${string}`>;
const effect = v.pipe(text, v.regex(/^effect\./u)) as v.GenericSchema<`effect.${string}`>;
/** Client-only cosmetic paint operations. Targets are bound object ids; no reflected paths or shard callbacks. */
export const CosmeticFinishesSchema = v.pipe(v.strictObject({
  menu:v.exactOptional(v.strictObject({title:text})),
  cards: v.pipe(v.array(v.strictObject({ id: text, name: text, blurb: text, lockedBlurb: text, icon: CatalogueIconSchema })), v.maxLength(128)),
  skins: v.pipe(v.array(v.strictObject({ id: text, slot: text, name: text, blurb: text, effect, grant: tag })), v.maxLength(128)),
  paints: v.pipe(v.array(v.strictObject({ target: text, slot: text, material: v.picklist(['standard', 'lambert']),
    choices: v.pipe(v.array(v.strictObject({ skin: v.exactOptional(text), fact: v.exactOptional(text),
      color: v.exactOptional(rgb), emissive: v.exactOptional(rgb), emissiveIntensity: v.exactOptional(finite), finish: v.exactOptional(text),
      repaint: v.exactOptional(v.strictObject({ blue: rgb, white: rgb, blaze: rgb, bone: text,
        vertex: v.strictObject({ redMin: finite, redGreenRatio: finite, ramp: v.tuple([finite, finite, finite]), halfWidth: finite, normalY: finite, weight: finite }),
        zone: v.strictObject({ y: range, z: range }),
        atlas: v.strictObject({ ornamentSaturation: finite, ornamentValue: finite, ornamentWeight: finite, delta: finite,
          hue: v.tuple([finite, finite, finite, finite]), saturation: range, value: range,
          outerHue: v.tuple([finite, finite, finite]), outerSaturation: range, outerValue: range, ramp: range, outerRamp: range }) })) })), v.minLength(1), v.maxLength(32)) })), v.maxLength(128)),
}), v.check(rows => {
  const ids = new Set(rows.skins.map(row => row.id));
  return ids.size === rows.skins.length && new Set(rows.skins.map(row => row.effect)).size === ids.size
    && rows.cards.length === ids.size && new Set(rows.cards.map(row => row.id)).size === ids.size && rows.cards.every(row => ids.has(row.id))
    && new Set(rows.paints.map(row => row.target)).size === rows.paints.length
    && rows.paints.every(row => row.choices.every(choice => (choice.skin === undefined || rows.skins.some(skin => skin.id === choice.skin && skin.slot === row.slot))
      && (choice.repaint === undefined || choice.repaint.vertex.ramp[0] > 0 && choice.repaint.vertex.ramp[2] > 0 && choice.repaint.atlas.ramp[1] > 0 && choice.repaint.atlas.outerRamp[1] > 0)));
}, 'Unique cosmetic identities, complete cards and valid paint references'));
export type CosmeticFinishesRows = v.InferOutput<typeof CosmeticFinishesSchema>;
/** Materials, drop identities and optional geometry extras for held equipment. */
export const HeldFinishesSchema = v.strictObject({
  cosmetics: v.exactOptional(CosmeticFinishesSchema),
  source: v.exactOptional(v.strictObject({ url: text, rows: PackedGeometryRowsSchema })),
  order: v.pipe(v.array(text), v.maxLength(128), v.check(rows => new Set(rows).size === rows.length)),
  rows: v.record(text, v.strictObject({ id: text, weapon, name: text, blurb: text,
    dropsFrom: v.exactOptional(v.strictObject({ kind: text, variant: text })), mats: v.record(text, override) })),
  cards: v.pipe(v.array(HeldFinishCardSchema), v.maxLength(128)),
  extras: v.record(text, v.pipe(v.array(v.strictObject({ name: text, geometry: natural,
    materials: v.pipe(v.array(text), v.minLength(1), v.maxLength(16)) })), v.maxLength(16))),
});
/** Data-only finish catalogue; the host decodes its admitted pack directly, never a shard-built extra. */
export type HeldFinishesRows = v.InferOutput<typeof HeldFinishesSchema>;
