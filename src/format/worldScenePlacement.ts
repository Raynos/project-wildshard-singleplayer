import * as v from 'valibot';
import { isJsonData } from './json';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const finite = v.pipe(v.number(), v.finite(), v.minValue(-1e6), v.maxValue(1e6));
/** `color`: the copy's own colour (an instanced copy's instance colour), as linear RGB components */
const at = { x: finite, y: finite, z: finite, variant: v.exactOptional(id), color: v.exactOptional(v.tuple([finite, finite, finite])),
  params: v.exactOptional(v.pipe(v.record(id, v.unknown()), v.check(value => isJsonData(value), 'Placement params require plain JSON'))) };
const pose = v.union([v.strictObject({ ...at, matrix: v.pipe(v.array(finite), v.length(16)) }),
  v.strictObject({ ...at, yxz: v.strictObject({ yaw: finite, yawAtan2: v.exactOptional(v.tuple([finite, finite])), scale: finite, pitch: v.exactOptional(finite), roll: v.exactOptional(finite) }) })]);
const distance = v.pipe(finite, v.minValue(0));
const tierNumber = v.union([distance, v.strictObject({ phone: distance, desktop: distance })]);
const cull = v.strictObject({ far: v.exactOptional(tierNumber), keepNear: v.exactOptional(finite),
  minAngular: v.exactOptional(tierNumber), view: v.exactOptional(v.literal('forest')),
  flat: v.exactOptional(v.boolean()), from: v.exactOptional(v.picklist(['origin', 'bounds'])),
  lodBy: v.exactOptional(v.picklist(['copy', 'set'])), bounds: v.exactOptional(v.picklist(['sphere', 'box'])), frustum: v.exactOptional(v.boolean()),
  radiusBias: v.exactOptional(finite), step: v.exactOptional(v.pipe(finite, v.minValue(0))) });
/** Deferred named placements use the same model/LOD/cull owner as ordinary placed models. */
export const WorldScenePlacementSchema = v.strictObject({ id, tier: v.exactOptional(v.picklist(['phone', 'desktop'])), model: id, batch: v.exactOptional(id), draw: v.picklist(['single', 'instanced', 'batched', 'merged']),
  drawnInto: v.exactOptional(v.strictObject({ part: id, boxes: v.pipe(v.array(finite), v.maxLength(49152), v.check(rows => rows.length % 6 === 0)) })),
  poses: v.pipe(v.array(pose), v.maxLength(8192)), cull: v.exactOptional(cull), sortObjects: v.exactOptional(v.boolean()),
  colliders: v.exactOptional(v.pipe(v.array(v.pipe(v.unknown(), v.check(isJsonData, 'Placement colliders require plain JSON'))), v.maxLength(32768))),
  piece: v.exactOptional(v.strictObject({ id, follows: v.exactOptional(v.literal('copy')), solidFloor: v.exactOptional(v.boolean()), floorPolicy: v.exactOptional(v.picklist(['first', 'highest'])), floors: v.exactOptional(v.pipe(v.array(v.strictObject({ x: finite, z: finite, hw: v.pipe(finite, v.minValue(0)), hd: v.pipe(finite, v.minValue(0)), y: finite, rot: v.exactOptional(finite), slope: v.exactOptional(finite), tilt: v.exactOptional(finite), profile: v.exactOptional(v.pipe(v.array(v.tuple([finite, v.pipe(finite, v.minValue(0)), finite])), v.minLength(2), v.maxLength(8), v.check(knots => knots.every((k, i) => i === 0 || k[0] > (knots[i - 1]?.[0] ?? Infinity))))) })), v.maxLength(4096))), name: v.exactOptional(id), split: v.exactOptional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2048))) })) });
export type WorldScenePlacementRow = v.InferOutput<typeof WorldScenePlacementSchema>;
/** JSON blobs are decoded independently so one world's contact tables never become a monolithic section. */
export function parseWorldScenePlacement(input: unknown): WorldScenePlacementRow { return v.parse(WorldScenePlacementSchema, input); }
