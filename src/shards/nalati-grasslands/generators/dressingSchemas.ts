import * as v from 'valibot';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import { namedJsonSchema } from '@wildshard/sdk/formatJsonSchema';

const number = v.number(), xz = { x: number, z: number };
/** Wire forms of dressingPlan.ts's Inst, LogSpec, Spot and DressPlan rows. */
const instance = v.array(v.strictObject({ ...xz, y: number, yaw: number, sx: number, sy: number, sz: number,
  tiltX: v.exactOptional(number), tiltZ: v.exactOptional(number), solid: v.exactOptional(v.literal(true)),
  far: number, r: number, g: number, b: number }));
const spot = v.array(v.strictObject({ ...xz, s: number }));
export const DRESSING_SCHEMAS: Readonly<Record<string, v.GenericSchema>> = {
  boulder: instance, slab: instance, juniper: instance, rose: instance, willow: instance, lupin: instance, reed: instance,
  logs: v.array(v.strictObject({ ax: number, az: number, bx: number, bz: number, r: number, drift: v.boolean() })),
  stumps: spot, ovoos: spot, poles: spot,
  fences: v.array(v.array(v.tuple([number, number]))), gates: v.array(v.strictObject({ ...xz, yaw: number })),
  drifts: v.array(v.strictObject({ ...xz, y: number, r: number })),
  colliders: v.array(v.strictObject({ ...xz, hw: number, hd: number, rot: number, yBottom: number, yTop: number, ghost: v.exactOptional(v.literal(true)) })),
  clutter: v.array(v.strictObject({ ...xz, yaw: number, kind: number })),
};

/** Each dressing producer attaches its authored row contract; unknown kinds refuse. */
export function nalatiDressingBlob(name: string, kind: 'json', bytes: Uint8Array): NamedBlob {
  const key = /^world\/dressing-([a-z]+)\.json$/u.exec(name)?.[1];
  const schema = key === undefined ? undefined : DRESSING_SCHEMAS[key];
  if (schema === undefined) throw new Error(`Missing dressing schema: ${name}`);
  return nameBlob(name, kind, bytes, { jsonSchema: namedJsonSchema(schema) });
}
