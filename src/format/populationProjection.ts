import * as v from 'valibot';
import { BodySlotsSchema } from './bodySlots';
import { BodyLaunchSchema } from './nativeItems';
import { ConeWeaponProfileSchema } from './weaponProfiles';

const n = v.pipe(v.number(), v.finite()), key = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const point = v.strictObject({ x: n, z: n });
const stream = v.strictObject({ version: v.literal(1), state: n, initial: n, scrambledFork: v.boolean() });
const spawn = v.strictObject({ kind: key, variant: v.nullable(key), ...point.entries, yaw: n, herd: n, practice: v.exactOptional(v.literal(true)) });
const page = v.strictObject({ stream, herds: n, centres: v.array(point), kinds: v.array(key), enemies: v.array(spawn),
  palms: v.array(v.object({ ...point.entries, h: n, lean: n, leanDir: n })) });
const action = v.strictObject({ state: n, from: v.exactOptional(n), fromNot: v.exactOptional(n), sound: v.exactOptional(key), splash: v.exactOptional(n) });
/** Client-only population projection: physical volleys, pooled splash particles,
 * memory observations and lights share the existing animal manager lifetime. */
export const PopulationProjectionSchema = v.strictObject({
  id: key, seed: n, random: n, page: v.strictObject({ phone: page, desktop: page }),
  counts: v.record(key, v.strictObject({ kind: key, groups: v.boolean(), practice: v.boolean() })),
  practice: v.strictObject({ delay: n, away: n }),
  perches: v.strictObject({ foot: n, crown: n, base: n }),
  hold: v.strictObject({ kind: key, ...point.entries, r: n, guardR: n, step: n, floor: v.array(v.nullable(n)) }),
  volley: BodySlotsSchema, launch: BodyLaunchSchema, strike: v.strictObject({ id: key, damage: n, tags: ConeWeaponProfileSchema.entries.gust.entries.tags }),
  contact: v.strictObject({ sound: key, landSound: key, landAge: n, splash: n }),
  husk: v.strictObject({ colour: v.string(), detail: n }),
  splash: v.strictObject({ capacity: v.pipe(n, v.integer(), v.minValue(1), v.maxValue(240)), gravity: n,
    colour: v.tuple([n, n, n]), size: n, opacity: n, count: n, radius: n,
    height: v.tuple([n, n]), speed: v.tuple([n, n]), up: v.tuple([n, n]), life: v.tuple([n, n]) }),
  effects: v.array(v.strictObject({ kind: key, state: key, actions: v.array(action),
    periodic: v.strictObject({ state: n, interval: n, chance: n, x: key, z: key, radius: n, splash: n }) })),
  light: v.strictObject({ colour: n, distance: n, decay: n, headY: n, deathSplash: n, fade: n,
    intensity: n, rise: key, rising: key, range: n, flicker: v.tuple([n, n, n, n, n]),
    streamRate: n, streamHeight: v.tuple([n, n]), streamSplash: n }),
});
export type PopulationProjectionRows = v.InferOutput<typeof PopulationProjectionSchema>;
