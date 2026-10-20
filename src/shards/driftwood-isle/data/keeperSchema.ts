import { NativeReturnRowsSchema } from '@wildshard/format/populationRespawn';
import * as v from 'valibot';
import { PopulationEnvironmentSchema } from '@wildshard/format/populationEnvironment';
import { BodySlotsSchema } from '@wildshard/format/bodySlots';

const finite = v.pipe(v.number(), v.finite());
const stream = v.strictObject({ version: v.literal(1), state: finite, initial: finite, scrambledFork: v.boolean() });
export const KeeperRowsSchema = v.strictObject({ environment: PopulationEnvironmentSchema, seed: finite,
  volley: BodySlotsSchema,
  ecology: NativeReturnRowsSchema,
  fauna: v.strictObject({ seed: finite, centres: v.pipe(v.array(v.tuple([finite, finite])), v.maxLength(32)),
    rows: v.pipe(v.array(v.strictObject({ id: v.string(), herd: finite, seed: finite, x: finite, z: finite, yaw: finite, stream })), v.maxLength(64)), stream }),
  variants: v.pipe(v.array(v.strictObject({ kind: v.string(), rows: v.pipe(v.array(v.strictObject({ id: v.string(), scale: v.tuple([finite, finite]) })), v.maxLength(32)) })), v.maxLength(32)),
  herds: v.pipe(v.array(v.strictObject({ kind: v.string(), x: finite, z: finite })), v.maxLength(32)),
  bodies: v.pipe(v.array(v.strictObject({ id: v.string(), kind: v.string(), variant: v.string(), herd: finite, x: finite, z: finite,
    yaw: finite, seed: finite, scale: finite, fauna: v.boolean(), practice: v.boolean(), stream: v.nullable(stream) })), v.length(34)) });
