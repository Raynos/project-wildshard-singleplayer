import * as v from 'valibot';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const gain = v.pipe(finite, v.minValue(0), v.maxValue(8));
const list = v.pipe(v.array(id), v.minLength(1), v.maxLength(32));
const scalar = v.union([finite, v.boolean(), id, v.null()]);
const conditions = v.pipe(v.array(v.strictObject({ field: id, op: v.picklist(['equals', 'not-equals', 'greater']), value: scalar })), v.maxLength(16));
/** Bounded music catalogue selection; the engine keeps today's bar-grid calm/tension/boss stem decoding. */
export const AudioMusicSchema = v.pipe(v.strictObject({ id, base: id, slots: list, bootSlots: list,
  synthLead: v.picklist(['pluck', 'marimba']), minFade: v.pipe(finite, v.minValue(0), v.maxValue(60)),
  source: v.nullable(v.strictObject({ dir: v.pipe(v.string(), v.regex(/^\/assets\/music\/[a-z0-9_-]+\/$/u)), manifestKey: id })),
  sets: v.record(id, id), selection: v.pipe(v.array(v.strictObject({ slots: list, when: conditions })), v.minLength(1), v.maxLength(64)),
  selectMode: v.picklist(['first', 'all']),
}), v.check((music) => music.selection.every((row) => row.slots.every((slot) => music.slots.includes(slot))) && Object.keys(music.sets).every((slot) => music.slots.includes(slot)), 'every selected slot belongs to the score'));
/** Same-byte sample catalogue and loop gain selection, without author decoder callbacks. */
export const AudioSamplesSchema = v.strictObject({ set: id, bed: id, loopGains: v.pipe(v.record(id, gain), v.check((gains) => Object.keys(gains).length <= 32, 'bounded loop gains')) });
const zone = v.strictObject({ id, x: finite, z: finite, inner: v.pipe(finite, v.minValue(0), v.maxValue(2000)), outer: v.pipe(finite, v.minValue(0), v.maxValue(2000)), gain,
  open: v.optional(v.boolean()), source: v.optional(id) });
/** Bounded zone/mixer data. Terrain, moving emitters and bespoke synthesis remain trusted runtime ports. */
export const AudioZonesSchema = v.strictObject({ id, smoothSeconds: v.pipe(finite, v.minValue(0.001), v.maxValue(10)), tickHz: v.pipe(finite, v.minValue(0.1), v.maxValue(120)),
  silentSeconds: v.pipe(finite, v.minValue(0), v.maxValue(600)), holdSeconds: v.pipe(finite, v.minValue(0), v.maxValue(60)),
  levels: v.pipe(v.record(id, gain), v.check((levels) => Object.keys(levels).length <= 64, 'bounded levels')),
  wet: v.pipe(v.record(id, v.pipe(finite, v.minValue(0), v.maxValue(1))), v.check((levels) => Object.keys(levels).length <= 16, 'bounded rooms')),
  zones: v.pipe(v.array(zone), v.maxLength(512), v.check((zones) => new Set(zones.map((row) => row.id)).size === zones.length, 'unique audio zones')) });
/** The validated score's stable catalogue slots and scene rules. */
export type AudioMusic = v.InferOutput<typeof AudioMusicSchema>;
/** The validated same-byte sample selection. */
export type AudioSamples = v.InferOutput<typeof AudioSamplesSchema>;
/** The validated mixer timing and named ambience zones. */
export type AudioZones = v.InferOutput<typeof AudioZonesSchema>;
