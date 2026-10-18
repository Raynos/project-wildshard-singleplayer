import * as v from 'valibot';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const number = v.pipe(v.number(), v.finite());
const triple = v.tuple([number, number, number]);
const pair = v.tuple([number, number]);
const distance = v.pipe(number, v.minValue(1), v.maxValue(16384));
const cap = v.strictObject({ phone: distance, desktop: distance });
/** Client-only original standard/PBR surfaces, optionally mapped through an admitted graph. */
export const WorldSceneSurfaceSchema = v.strictObject({ id, kind: v.literal('surface'),
  scan: v.exactOptional(id), maxTexture: v.exactOptional(cap), cellTexture: v.exactOptional(v.strictObject({ atMost: distance, max: distance })),
  properties: v.strictObject({ color: v.exactOptional(v.union([number, triple])), normalScale: v.exactOptional(pair),
    roughness: v.exactOptional(number), metalness: v.exactOptional(number), transparent: v.exactOptional(v.boolean()),
    opacity: v.exactOptional(number), envMapIntensity: v.exactOptional(number), emissive: v.exactOptional(v.union([number, triple])),
    emissiveIntensity: v.exactOptional(number), side: v.exactOptional(v.picklist([0, 1, 2])), depthWrite: v.exactOptional(v.boolean()), vertexColors: v.exactOptional(v.boolean()) }),
  map: v.exactOptional(v.strictObject({ appearance: id, texture: id })),
  look: v.exactOptional(id), lookTextures: v.optional(v.pipe(v.record(id, v.picklist(['normalMap', 'map', 'roughnessMap', 'aoMap'])), v.check(rows => Object.keys(rows).length <= 8)), {}),
});
export type WorldSceneSurface = v.InferOutput<typeof WorldSceneSurfaceSchema>;
