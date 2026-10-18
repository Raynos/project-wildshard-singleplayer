import * as v from 'valibot';
import { CurveSchema } from './materials';
import { isJsonData } from './json';

const scalar = v.pipe(v.number(), v.finite()), rgb = v.tuple([scalar, scalar, scalar]), pair = v.tuple([scalar, scalar]);
const colour = v.union([scalar, rgb]);
const painterRow = v.object({ bounce: rgb, bounceLift: scalar, rim: rgb, floor: rgb, prefix: v.string(), optOut: v.string(),
  rimBack: v.exactOptional(pair), rimSide: v.exactOptional(pair), lift: v.exactOptional(rgb) });
const clockRow = v.object({ units: v.picklist(['hour', 'phase']), start: scalar,
  schedule: v.array(v.object({ phase: v.picklist(['dawn', 'day', 'golden', 'dusk', 'night']), from: scalar, to: scalar, minutes: scalar })),
  sun: v.object({ maxElevation: scalar, azimuthOffset: scalar }), fixed: v.object({ midday: scalar, golden: scalar, sunset: scalar, night: scalar }),
  presets: v.object({ dawn: scalar, noon: scalar, dusk: scalar, night: scalar }), dayFraction: v.exactOptional(scalar), pauseOnPin: v.exactOptional(v.boolean()) });
const stripRow = v.object({ name: v.string(), maps: v.tuple([v.string(), v.string()]), elevation: pair, window: pair, firstGain: pair, hold: scalar,
  strips: v.tuple([v.object({ key: v.string(), url: v.string() }), v.object({ key: v.string(), url: v.string() })]), tag: v.string(), fault: v.string(), scope: v.string() });
const hazeRow = v.object({ strip: v.array(scalar), tint: rgb, near: scalar, far: scalar, max: scalar, sunHaze: scalar, name: v.string(), prefix: v.string() });
const duskRow = v.object({ fog: v.object({ color: scalar, near: scalar, far: scalar }), clock: clockRow,
  sun: v.object({ dir: v.object({ x: scalar, y: scalar, z: scalar }), colour, intensity: scalar }), light: painterRow, lightScope: v.picklist(['page', 'material']),
  hold: v.exactOptional(v.boolean()), neutral: v.exactOptional(v.boolean()), horizon: v.exactOptional(scalar),
  rays: v.exactOptional(v.object({ azimuth: scalar, elevation: scalar })),
  state: v.exactOptional(v.object({ deep: colour, curves: v.object({ key: CurveSchema, fill: CurveSchema, fogSun: CurveSchema, farHaze: CurveSchema, aerialFog: CurveSchema }) })),
  sky: v.variant('kind', [v.object({ kind: v.literal('strips'), row: stripRow }), v.object({ kind: v.literal('haze'), row: hazeRow })]) });

/** Numeric painted light, fog, clock and sky contract shared by page and material looks. */
export const PaintedNumbersSchema = duskRow;
export type PaintedNumbers = v.InferOutput<typeof PaintedNumbersSchema>;
const id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const sampler = v.strictObject({ release: v.exactOptional(v.boolean()), wrapS: v.exactOptional(v.picklist([1000,1001,1002])), wrapT: v.exactOptional(v.picklist([1000,1001,1002])), mips: v.exactOptional(v.boolean()), minFilter: v.exactOptional(v.picklist([1003,1004,1005,1006,1007,1008])), magFilter: v.exactOptional(v.picklist([1003,1006])), anisotropy: v.exactOptional(scalar) });
const image = v.strictObject({ url: id, name: id, warn: id, sampler });
const tierImage = v.union([image, v.strictObject({ phone: image, desktop: image })]);
const attributes = v.pipe(v.record(id, v.strictObject({ size: v.pipe(scalar, v.integer(), v.minValue(1), v.maxValue(4)), float32: v.pipe(v.string(), v.maxLength(262144)) })), v.maxEntries(16));
const draw = v.strictObject({ name: id, graph: id, image: v.exactOptional(id), order: scalar, at: v.optional(v.tuple([scalar,scalar,scalar]), [0,0,0]), spin: v.optional(scalar, 0),
  geometry: v.variant('kind', [v.strictObject({ kind: v.literal('disc'), radius: v.pipe(scalar,v.minValue(.001)), segments: v.pipe(scalar,v.integer(),v.minValue(3),v.maxValue(1024)) }),
    v.strictObject({ kind: v.literal('plane'), size: pair, instances: v.exactOptional(attributes) })]) });
/** Client-only product presentation. Graph ids resolve from look.materials; no executable resource ports cross admission. */
export const PaintedLookSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Painted look requires plain JSON'), v.strictObject({ look: PaintedNumbersSchema, materialSun: v.exactOptional(v.strictObject({ x: scalar, y: scalar, z: scalar })), materialOptOut: v.exactOptional(id), state: v.exactOptional(id), lut: v.exactOptional(id),
  terrain: v.exactOptional(v.literal('declared')),
  images: v.optional(v.pipe(v.record(id,tierImage),v.maxEntries(16)), {}),
  dome: v.exactOptional(v.strictObject({ graph: v.strictObject({phone:id,desktop:id}), image:id })),
  dressing: v.exactOptional(v.strictObject({ name:id, draws:v.pipe(v.array(draw),v.maxLength(64)) })),
}), v.check(row => (row.look.state === undefined) === (row.state === undefined) && (row.dome === undefined || row.images[row.dome.image] !== undefined)
  && (row.dressing?.draws.every(entry => entry.image === undefined || row.images[entry.image] !== undefined) ?? true), 'Declared state and image bindings'));
export type PaintedLookRow = v.InferOutput<typeof PaintedLookSchema>;
export function parsePaintedLook(input: unknown): PaintedLookRow { return v.parse(PaintedLookSchema,input); }
