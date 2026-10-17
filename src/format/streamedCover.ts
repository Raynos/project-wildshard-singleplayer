import * as v from 'valibot';
import { isJsonData } from './json';

const finite = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1e7));
const positive = v.pipe(finite, v.minValue(0.0001));
const id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const span = v.pipe(v.tuple([finite, positive]), v.check(([lo, hi]) => lo < hi));
const tier = v.strictObject({ phone: positive, desktop: positive });
const cap = v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(1e6));
/** Client-only cover streams. Density/placement is baked in version-1 cells; rows set capacity,
 * reach/fade bands, far stand-ins, slope response, graph ids and upload budgets. Geometry keys
 * resolve in the platform's SceneResources, never in a shard callback or subclass. */
export const StreamedCoverSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Cover requires plain JSON'),
  v.object({ cell: v.pipe(positive, v.integer()), refill: positive, cacheMin: cap, growShare: v.pipe(positive, v.maxValue(1)),
    farRefill: positive, farSlack: positive, farIn: positive, eyeSlack: finite, uploadBytes: cap, nearLag: positive,
    look: id, meshPrefix: id, lighting: id, params: v.strictObject({ reach: id, lodReach: id, mode: id, keep: id, viewer: id, slope: id, growIn: id }), reachK: tier, capK: tier, farBudgetMs: tier,
    slopeReach: v.pipe(v.strictObject({ up: v.pipe(positive, v.minValue(1)), lo: finite, hi: positive, fadeFrom: finite, fadeTo: positive }),
      v.check(row => row.lo < row.hi && row.fadeFrom < row.fadeTo)),
    kinds: v.pipe(v.array(v.strictObject({ name: id, geometry: id, cap, reach: span, scale: span,
      far: v.exactOptional(v.strictObject({ geometry: id, reach: span, cap, keep: v.pipe(positive, v.maxValue(1)) })) })),
      v.minLength(1), v.maxLength(32), v.check(rows => new Set(rows.map(row => row.name)).size === rows.length)),
  }), v.check(row => row.nearLag < row.refill && row.kinds.every(kind => (Math.max(kind.cap, (kind.far?.cap ?? 0) * (kind.far?.keep ?? 1))) * Math.max(row.capK.phone, row.capK.desktop) <= 1e6)));
export type StreamedCoverRow = v.InferOutput<typeof StreamedCoverSchema>;
export function parseStreamedCover(input: unknown): StreamedCoverRow { return v.parse(StreamedCoverSchema, input); }
