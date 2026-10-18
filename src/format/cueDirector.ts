import * as v from 'valibot';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const cue = v.pipe(id, v.regex(/^cue\.[a-zA-Z0-9.-]+$/));
const real = v.pipe(v.number(), v.minValue(-10000), v.maxValue(10000));
const vector = v.tuple([real, real, real]);
const vfxTarget = v.variant('kind', [
  v.strictObject({ kind: v.literal('impact'), material: v.picklist(['sand', 'wood', 'shell', 'sparks', 'dirt', 'stone']),
    count: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(128)), reverse: v.boolean(), offset: vector }),
  v.strictObject({ kind: v.literal('field'), field: id, ahead: real, offset: vector }),
]);
/** Cue rows schedule existing sound cues and native VFX targets in declaration
 * order. Fields are prepared from declared libraries, never shard hooks. */
export const CueDirectorWireSchema = v.strictObject({ version: v.literal(1),
  fields: v.pipe(v.array(v.strictObject({ id, library: id, look: id, name: id, shape: v.picklist(['point', 'streak', 'flake']),
    count: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(8192)),
    palette: v.exactOptional(v.pipe(v.array(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffffff))), v.minLength(1), v.maxLength(64))),
    life: v.exactOptional(v.pipe(real, v.minValue(0.001))),
    place: v.exactOptional(v.strictObject({ at: vector, aim: vector })),
  })), v.maxLength(64)),
  rows: v.pipe(v.array(v.strictObject({ id: cue, sound: v.exactOptional(cue), soundPhase: v.exactOptional(id),
    delay: v.exactOptional(v.pipe(real, v.minValue(0), v.maxValue(60))),
    vfx: v.pipe(v.array(vfxTarget), v.maxLength(16)),
  })), v.maxLength(128)),
});
/** Native admission additionally validates identities and field dependencies. */
export const CueDirectorSchema = v.pipe(CueDirectorWireSchema, v.check(rows => new Set(rows.rows.map(row => row.id)).size === rows.rows.length
  && new Set(rows.fields.map(field => field.id)).size === rows.fields.length
  && rows.rows.every(row => row.vfx.every(target => target.kind !== 'field' || rows.fields.some(field => field.id === target.field && field.life !== undefined))), 'Unique cues and live burst fields'));
export type CueDirectorRows = v.InferOutput<typeof CueDirectorSchema>;
