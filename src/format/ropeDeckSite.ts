import * as v from 'valibot';
import { SpecimenModelMetadataSchema } from './specimenCatalogue';

/** The defining rope-deck grammar, moved unchanged from the site host. */
const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128)), n = v.pipe(v.number(), v.finite());
const xz = v.tuple([n, n]), point = v.object({ x: n, y: n, z: n });
export const RopeDeckSpanSchema = v.strictObject({ a: xz, b: xz, sag: v.exactOptional(n), width: v.exactOptional(n) });
/** a span's baked rest plan (its generator's row; fields the site does not read are ignored) */
const rest = v.object({ key: id, ground: v.pipe(v.array(point), v.maxLength(256)), origin: point, width: n, len: n, direction: v.object({ x: n, z: n }),
  segments: v.pipe(v.array(v.object({ x: n, y: n, z: n, hz: n, rot: v.object({ x: n, y: n, z: n, w: n }) })), v.maxLength(256)),
  ownDescs: v.pipe(v.array(v.unknown()), v.maxLength(256)) });
export const RopeDeckSiteSchema = v.strictObject({
  model: v.pick(SpecimenModelMetadataSchema, ['id', 'name', 'file', 'category', 'pipeline', 'surface']),
  /** which baked span is the Explorer specimen's (flat ground), and the size of its loading stand-in */
  specimen: v.pipe(v.number(), v.integer(), v.minValue(0)), loading: v.tuple([n, n, n]),
  spans: v.pipe(v.array(rest), v.minLength(1), v.maxLength(8)),
  /** the skinned deck's fixed draw slot for the specimen and for every other span */
  draws: v.strictObject({ specimen: id, world: id }),
  /** the deck's defaults (width, sag), segment half thickness and weight, bounds, hit owner and margin; its registry piece */
  deck: v.strictObject({ width: n, sag: n, halfY: n, mass: n, maxSegments: v.pipe(v.number(), v.integer(), v.maxValue(256)),
    maxColliders: v.pipe(v.number(), v.integer(), v.maxValue(256)), margin: n, owner: v.strictObject({ id, name: id }), piece: id }),
});
export type RopeDeckSpan = v.InferOutput<typeof RopeDeckSpanSchema>;
export type RopeDeckRest = v.InferOutput<typeof rest>;
export type RopeDeckSiteRows = v.InferOutput<typeof RopeDeckSiteSchema>;
/** The original numeric bake-key tuple, shared with its runtime reader. */
export const RopeDeckRestKeySchema = v.tuple([xz, xz, n, n]);
