import { ConeWeaponProfileSchema } from './weaponProfiles';
import * as v from 'valibot';

const finite = v.pipe(v.number(), v.finite()), scalar = v.pipe(finite, v.minValue(0), v.maxValue(10000));
const positive = v.pipe(scalar, v.minValue(0.000001));
const count = v.pipe(scalar, v.integer(), v.maxValue(1024));
const name = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9.-]*$/u), v.maxLength(128));
const pair = v.strictObject({ gravity: scalar, drag: scalar });
/** Aimed and radial launches contain coefficients only; their stream and body owners remain native. */
export const BodyLaunchSchema = v.variant('kind', [
  v.pipe(v.strictObject({ kind: v.literal('target'), speed: positive, time: v.tuple([positive, positive]), gravity: scalar,
    rotation: v.tuple([finite, finite, finite]) }), v.check(row => row.time[0] <= row.time[1], 'Ordered flight time bounds')),
  v.strictObject({ kind: v.literal('radial'), horizontal: scalar, up: finite }),
]);
/** Bounded numeric projectile/contact and continuation policy. It supplies values, never executable hooks. */
export const NativeRangedRowSchema = v.pipe(v.strictObject({
  step: name, slot: v.pipe(count, v.maxValue(31)), eye: v.pipe(scalar, v.maxValue(20)), extent: positive, floor: finite,
  radius: scalar, tags: ConeWeaponProfileSchema.entries.gust.entries.tags,
  glance: v.strictObject({ lift: scalar, keep: scalar, bounce: scalar, maxSpeed: scalar }),
  defaultAmmo: name, ammunition: v.pipe(v.array(v.strictObject({ id: name, flight: pair, wet: v.exactOptional(pair),
    presentation: v.exactOptional(v.strictObject({ label: v.pipe(v.string(), v.maxLength(128)), name: v.pipe(v.string(), v.maxLength(128)), pouchMax: count })),
    targets: v.pipe(v.array(name), v.maxLength(128)), damage: scalar })), v.minLength(1), v.maxLength(32)),
  shaft: v.exactOptional(v.strictObject({ capacity: v.pipe(count, v.minValue(1)), length: positive, bury: scalar,
    reach: v.strictObject({ radius: scalar, up: scalar, down: scalar }), recover: v.pipe(scalar, v.maxValue(1)), recoveryStride: v.pipe(count, v.minValue(1)) })),
}), v.check(row => new Set(row.ammunition.map(ammo => ammo.id)).size === row.ammunition.length && row.ammunition.some(ammo => ammo.id === row.defaultAmmo), 'Unique ammunition and declared initial stack'));

const slot = v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(31));
const phase = v.picklist(['beforeBodies', 'afterBodies']);
/** Ordered native slots, ownership flags and numeric input publication; no executable policy. */
export const NativeLoadoutRowSchema = v.pipe(v.strictObject({
  slots: v.pipe(v.array(slot), v.minLength(1), v.maxLength(32)), initial: slot,
  lower: v.pipe(scalar, v.maxValue(60)), raise: v.pipe(scalar, v.maxValue(60)),
  ownership: v.exactOptional(v.pipe(v.array(v.nullable(v.pipe(v.string(), v.minLength(1), v.maxLength(128)))), v.maxLength(32))),
  input: v.exactOptional(v.strictObject({ step: name, phase, command: name,
    publication: v.strictObject({ step: name, phase, aim: v.strictObject({ command: name,
      initial: finite, min: finite, max: finite, sentinel: v.exactOptional(finite) }) }) })),
}), v.check(row => new Set(row.slots).size === row.slots.length && row.slots.includes(row.initial)
  && (row.ownership === undefined || row.ownership.length === row.slots.length)
  && (row.input === undefined || (row.input.publication.aim.min <= row.input.publication.aim.initial
    && row.input.publication.aim.initial <= row.input.publication.aim.max)), 'Valid native slot and input policy'));
/** Strict admission also protects direct native loadout callers outside the product reader. */
export function parseNativeLoadoutRow(input: unknown): v.InferOutput<typeof NativeLoadoutRowSchema> {
  return v.parse(NativeLoadoutRowSchema, input);
}
