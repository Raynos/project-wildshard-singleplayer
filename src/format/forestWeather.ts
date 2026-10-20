/** Data-only client weather bindings; safe for schema discovery in Node. */
import * as v from 'valibot';

const n = v.pipe(v.number(), v.finite()), id = v.pipe(v.string(), v.minLength(1));
const count = v.pipe(n, v.integer(), v.minValue(1), v.maxValue(16384));
const tiered = v.strictObject({ phone: n, desktop: n });
/** One drawn part of the weather: a lent look on a baked shape (a mesh, points, or an instanced shape placed by a matrix
 *  table of the parts file), or a sprite of a parts texture. Hidden until the lane's `flags.<id>` is above 0. */
const PartSchema = v.variant('kind', [
  v.strictObject({ kind: v.picklist(['mesh', 'points']), id, shape: id, look: id, order: n }),
  v.strictObject({ kind: v.literal('instanced'), id, shape: id, look: id, order: n, matrices: id }),
  v.strictObject({ kind: v.literal('sprite'), id, texture: id, order: n, fog: v.boolean(), toneMapped: v.boolean() }),
]);
/** A square RGBA texture from a byte table of the parts file, lent to `[look, uniform]` pairs. */
const TextureSchema = v.strictObject({ id, bytes: id, size: count, noise: v.boolean(), lend: v.pipe(v.array(v.tuple([id, id])), v.maxLength(16)) });
/** The weather's drawn parts and the channel lane that poses them (`lane`; `params` the looks whose params it writes). */
const PartsSchema = v.strictObject({
  file: id, lane: id, params: v.pipe(v.array(id), v.maxLength(32)),
  textures: v.pipe(v.array(TextureSchema), v.maxLength(8)), parts: v.pipe(v.array(PartSchema), v.maxLength(16)),
  /** a camera-local streak curtain in `look` (offset, velocity, colour, length and alpha from the lane's `rainU`) */
  rain: v.exactOptional(v.strictObject({ look: id, radius: tiered, streaks: tiered, order: n })),
});
/** A voice played on a reaction event: `near` at the event's x z (gain falling to `floor` at `range` m, none beyond),
 *  `distant` at the event's `distance` along its `bearing`, `reach` m out. */
const CueSchema = v.strictObject({ event: id, patch: id, kind: v.picklist(['near', 'distant']), range: n, floor: n, reach: n });
/** Weather reactions on the page: the bundle file (`weather` + `reactions` + baked `shelters`, the host's native rows as
 *  `world`), struck at the world forest's crowns; held while the page answers `weather.indoors` / `weather.storm-hold`. */
const StormSchema = v.strictObject({
  /** `idle` the calm phase: no storm wind bed, and the parts lane's `active` is 0 */
  file: id, idle: id, cues: v.pipe(v.array(CueSchema), v.maxLength(8)),
  /** the group's `rain` and `wind` (the steppe wind's smoothstep over `range` m/s, silent while idle) every `every` s */
  beds: v.strictObject({ group: id, every: n, rain: id, wind: id, range: v.tuple([n, n]) }),
});
const phase = v.picklist(['dawn', 'day', 'golden', 'dusk', 'night']);
/** An hour clock's row (`@wildshard/format/dayCycle` DayClockRow). */
const HourClockSchema = v.strictObject({ units: v.literal('hour'), start: n, sun: v.strictObject({ maxElevation: n, azimuthOffset: n }),
  schedule: v.pipe(v.array(v.strictObject({ phase, from: n, to: n, minutes: n })), v.minLength(1), v.maxLength(16)), pauseOnPin: v.boolean(),
  fixed: v.strictObject({ midday: n, golden: n, sunset: n, night: n }), presets: v.strictObject({ dawn: n, noon: n, dusk: n, night: n }) });
/**
 * A painted sky (the keyed-sky host's second kind, game/looks/keyedSky `paintedSky`): an hour clock; the file's day key
 * (`sky.day`, its `from` fields started from the scene's fog colour, the painterly shade and rim and `light` its key
 * intensity) keyed by the `key` lane and sampled by the `sample` lane into a look of the file's day-look schema; the dome
 * (a file shape in a lent look); the `weather` lane laying the weather over the look, the `dome` lane (flash × `flash`) and
 * the `tint` lane (the panorama's re-grade and the `tint` looks' params). The look is the parts lane's `look` owner.
 */
const PaintedSkySchema = v.strictObject({
  file: id, clock: HourClockSchema, dome: v.strictObject({ shape: id, look: id, order: n }), flash: n,
  lanes: v.strictObject({ key: id, sample: id, dome: id, weather: id, tint: id }), tint: v.pipe(v.array(id), v.maxLength(8)),
  from: v.strictObject({ fog: id, shade: id, rim: id, light: id }),
  moon: v.strictObject({ disc: v.tuple([n, n, n]), gain: n, scale: n, halo: n, haloOpacity: n }),
});
export type PaintedSkyRows = v.InferOutput<typeof PaintedSkySchema>;
/** Native presentation bindings are resource ids and numeric policies only. A page runs a phase `program` on its own
 *  system, or a `storm` its reactions step; the forest blocks (observations, rain, shelter, focus, the `channels` lane) are
 *  each optional. */
export const ForestWeatherSchema = v.pipe(v.strictObject({
  files: v.strictObject({ observations: v.exactOptional(id), rain: v.exactOptional(id), program: v.exactOptional(id), shelter: v.exactOptional(id) }),
  mode: v.picklist(['setting', 'live']), channels: v.exactOptional(id), debug: id, heldPhase: n,
  focus: v.exactOptional(v.strictObject({ kind: id, variant: id, near: n, threshold: n, retention: n, height: n, radius: n, gain: n })),
  sky: v.exactOptional(PaintedSkySchema), storm: v.exactOptional(StormSchema), parts: v.exactOptional(PartsSchema),
  system: v.strictObject({ id, after: v.array(id), before: v.array(id) }),
}), v.check(row => (row.files.program === undefined) !== (row.storm === undefined), 'one weather owner: a program or a storm'),
  v.check(row => (row.files.observations === undefined) === (row.files.rain === undefined && row.files.shelter === undefined && row.focus === undefined && row.channels === undefined),
    'the forest blocks come together'));
export type ForestWeatherRows = v.InferOutput<typeof ForestWeatherSchema>;
