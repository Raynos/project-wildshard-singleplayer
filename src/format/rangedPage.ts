import * as v from 'valibot';
import { CollectionMountPackSchema, CollectionChalkSchema } from './collectionDisplay';
import { isJsonData } from './json';

const n = v.pipe(v.number(), v.finite()), id = v.pipe(v.string(), v.minLength(1), v.maxLength(512)), text = v.string();
/** Client-only equipment, pickup, collection and ambience composition. */
export const RangedPageSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Ranged page requires JSON rows'), v.strictObject({
  id, forest: id, elites: id, combat: id, finishSource: id,
  menu: v.strictObject({ title: text, note: text, hint: text, gearHint: text, noTrade: text, lines: v.record(id, text) }),
  drops: v.strictObject({ stream: id, rifleStream: id, rifle: v.strictObject({ at: v.tuple([n, n, n]), label: text, toast: text, scale: n, parameters: v.array(id) }), labels: v.record(id, text) }),
  prewarm: v.pipe(v.array(v.strictObject({ kind: id, variant: id })), v.maxLength(3)),
  collection: v.strictObject({ source: id, pack: CollectionMountPackSchema, chalk: CollectionChalkSchema,
    texture: v.strictObject({ url: id, srgb: v.boolean(), repeat: v.boolean() }) }),
  places: v.array(v.strictObject({ id, name: text, place: id, x: n, z: n, r: n })),
  debugLap: v.exactOptional(v.strictObject({ fightRadius: n, bossBusy: text,
    spots: v.pipe(v.array(v.strictObject({ id, x: n, z: n, yaw: n, y: v.exactOptional(n) })), v.minLength(1), v.maxLength(64)) })),
  life: id, directional: v.boolean(), shadowBatch: v.boolean(),
}));
export type RangedPageRows = v.InferOutput<typeof RangedPageSchema>;
/** The guide is a native quest id. */
export const ForestWeatherObservationSchema = v.strictObject({ page: id, audio: id, guide: id });
const roofs = v.pipe(v.array(v.strictObject({ frame: v.strictObject({ x: n, z: n, yaw: n }), polygon: v.pipe(v.array(v.tuple([n, n])), v.maxLength(128)) })), v.maxLength(16));
/** Declared rain occluders share native deck and yaw-frame polygon queries; roofs are baked in their own frame. */
export const ForestRoofMaskSchema = v.strictObject({ floors: v.pipe(v.array(v.strictObject({ x: n, y: n, z: n, hw: n, hd: n, rot: n })), v.maxLength(128)),
  roofs });
