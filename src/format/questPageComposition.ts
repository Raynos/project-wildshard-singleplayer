import * as v from 'valibot';
import { isJsonData } from './json';

const n = v.pipe(v.number(), v.finite()), id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const frame = v.exactOptional(v.strictObject({ x: n, z: n, rot: n }));
const place = v.strictObject({ poi: v.picklist(['world', 'hut', 'lookout', 'wreck', 'shrine', 'cave', 'pier']), x: n, z: n,
  y: v.exactOptional(n), dy: v.exactOptional(n), yaw: v.exactOptional(n), anchor: v.exactOptional(id) });
/** Entered quest composition names resources and ordered effects, never functions. */
export const QuestPageCompositionSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Quest page composition requires JSON rows'), v.strictObject({
  id, world: id, debug: id, frames: v.strictObject({ hut: frame, lookout: frame, wreck: frame, shrine: frame, cave: frame, pier: frame }),
  files: v.strictObject({ discovery: id, services: id, assembly: id, stall: id, encounter: id, returns: id }),
  events: v.unknown(), deaths: v.unknown(), services: v.array(id), deathMoves: v.array(v.strictObject({ effect: id, target: id })),
  figures: v.array(v.strictObject({ id, approach: id })), held: id, remaining: id, quietPlaces: v.array(id),
  speaker: v.strictObject({ figure: id, feet: place, fire: place }),
  trader: v.strictObject({ figure: id, counter: id, offer: id, label: id, radius: n }),
  cable: v.strictObject({ scene: id, mode: id, carriage: id, prompt: id, radius: n, label: id, a: id, b: id, anchor: id, publish: id }),
  boss: v.strictObject({ pool: place, reward: id }),
  sway: v.strictObject({ piece: id, height: n, ease: n, threshold: n, rate: n, speed: n, rollHz: n, roll: n, dipHz: n, dip: n }),
  guideHeight: n, placeInterval: n,
  systems: v.strictObject({ speakerPose: id, traderPose: id, kit: id, talks: id, trader: id, cable: id, guide: id, sway: id, places: id, before: v.array(id) }),
}));
export type QuestPageCompositionRows = v.InferOutput<typeof QuestPageCompositionSchema>;
