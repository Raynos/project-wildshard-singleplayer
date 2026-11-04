import * as v from 'valibot';

const finite = v.pipe(v.number(), v.finite());
const text = v.pipe(v.string(), v.maxLength(512));
const count = v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(1_000_000));
const nonnegative = v.pipe(finite, v.minValue(0));
const triple = v.tuple([finite, finite, finite]);
type ForestSurface = 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water' | 'wood' | 'metal' | 'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth';
const material: v.GenericSchema<ForestSurface, ForestSurface> = v.picklist(['sand', 'wetSand', 'grass', 'rock', 'planks', 'stone', 'water', 'wood', 'metal', 'flesh', 'shell', 'ground', 'edge', 'felt', 'earth']);

/** The complete native forest input document. Its maintained fixture lends
 * boss weak points and shelter trees; this does not invent a page-time owner. */
export interface ForestNativeInputs {
  version: 1;
  profile: string;
  notice: string;
  kingHit: { head: [number, number, number]; body: [[number, number, number], [number, number, number]];
    fore: [[number, number, number], [number, number, number]]; ribs: [number, number, number]; radius: number };
  trees: [number, number, number][];
  shelterTrees: [number, number, number, number, number][];
  pieces: { id: string; name: string; category: 'ground' | 'nature' | 'buildings' | 'props' | 'people'; file: string;
    colliders: number; active: boolean; surface?: ForestSurface;
    follows?: { matrix: number[]; rotation: boolean } }[];
}

/** Every field of the emitted envelope, retaining the native radius/tree
 * bounds and exact f64 matrices rather than a subset of the physics root. */
export const ForestNativeInputsSchema: v.GenericSchema<ForestNativeInputs, ForestNativeInputs> = v.strictObject({
  version: v.literal(1), profile: text, notice: text,
  kingHit: v.strictObject({ head: triple, body: v.tuple([triple, triple]), fore: v.tuple([triple, triple]), ribs: triple,
    radius: v.pipe(finite, v.minValue(.001)) }),
  trees: v.pipe(v.array(v.tuple([finite, finite, nonnegative])), v.maxLength(65_536)),
  shelterTrees: v.pipe(v.array(v.tuple([finite, finite, nonnegative, nonnegative, v.pipe(finite, v.minValue(0), v.maxValue(1))])), v.maxLength(65_536)),
  pieces: v.pipe(v.array(v.strictObject({ id: text, name: text, category: v.picklist(['ground', 'nature', 'buildings', 'props', 'people']),
    file: text, colliders: count, active: v.boolean(), surface: v.exactOptional(material),
    follows: v.exactOptional(v.strictObject({ matrix: v.pipe(v.array(finite), v.length(16)), rotation: v.boolean() })) })), v.maxLength(65_536)),
});
