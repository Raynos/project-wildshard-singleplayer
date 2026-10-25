import * as v from 'valibot';

const n = v.pipe(v.number(), v.finite()), id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const ids = (max: number) => v.pipe(v.array(id), v.maxLength(max));
const paint = v.strictObject({ rim: n, bands: n, sway: v.pipe(n, v.minValue(0)) });
/**
 * A baked tree set as rows (G474 forest presentation; client-only): its rest geometry pool (`<variant>__<part>` parts,
 * part = trunk / trunkLo / hi / lo / twigs / far; without trunkLo the far band keeps the trunk), the four materials it
 * wears in the forest's LOD slots, its variants in the forest's order (the trunk capsule scaled by `collider`) and the
 * model card the forest draws it as. `looks` are look.materials graphs (compiled from `product`'s look rows, lent the
 * set's card, impostor and bark textures from `/assets/models/<set>/` at the atlases' anisotropy) or painterly
 * vertex-coloured surfaces (rim, bands and wind sway each, no textures; G601 C5).
 */
export const TreeSetSchema: v.GenericSchema<TreeSetRowsInput, TreeSetRows> = v.strictObject({
  product: id, set: id,
  geometry: v.strictObject({ url: id, parts: ids(128),
    channels: v.pipe(v.array(v.strictObject({ name: id, source: id, width: v.pipe(n, v.integer(), v.minValue(1), v.maxValue(4)), parts: v.exactOptional(ids(128)) })), v.maxLength(16)) }),
  looks: v.variant('kind', [
    v.strictObject({ kind: v.literal('graphs'), bark: id, needles: id, twigs: id, far: id,
      anisotropy: v.strictObject({ cards: v.pipe(n, v.minValue(1), v.maxValue(16)), far: v.pipe(n, v.minValue(1), v.maxValue(16)) }) }),
    v.strictObject({ kind: v.literal('painterly'), bark: paint, needles: paint, twigs: paint, far: paint }),
  ]),
  tintBark: v.boolean(),
  model: v.strictObject({ id, name: id, file: id }),
  variants: v.pipe(v.array(v.strictObject({ name: id, label: id, species: id, height: n, trunk: n, collider: n })), v.minLength(1), v.maxLength(32)),
});
/** A validated tree set. */


/** Admitted data contracts, independent of validator implementation metadata. */
export type TreeSetRowsInput = TreeSetRows;
interface TreeSetRowsFields {
    product: string;
    set: string;
    geometry: {
        url: string;
        parts: string[];
        channels: ({
            name: string;
            source: string;
            width: number;
            parts?: string[];
        })[];
    };
    looks: ({
        kind: 'graphs';
        bark: string;
        needles: string;
        twigs: string;
        far: string;
        anisotropy: {
            cards: number;
            far: number;
        };
    }) | ({
        kind: 'painterly';
        bark: {
            rim: number;
            bands: number;
            sway: number;
        };
        needles: {
            rim: number;
            bands: number;
            sway: number;
        };
        twigs: {
            rim: number;
            bands: number;
            sway: number;
        };
        far: {
            rim: number;
            bands: number;
            sway: number;
        };
    });
    tintBark: boolean;
    model: {
        id: string;
        name: string;
        file: string;
    };
    variants: ({
        name: string;
        label: string;
        species: string;
        height: number;
        trunk: number;
        collider: number;
    })[];
}
export type TreeSetRows = { [Key in keyof TreeSetRowsFields]: TreeSetRowsFields[Key] };
