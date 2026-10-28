import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import { defineNamedRows, type NamedRows } from '@wildshard/sdk/formatJsonSchema';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { packDressingTable } from './dressingTable';

const number = { kind: 'number' } as const, xz = { x: number, z: number };
/** Wire forms of dressingPlan.ts's Inst, LogSpec, Spot and DressPlan rows. */
const instance = defineNamedRows({ kind: 'array', item: { kind: 'object', entries: {
  ...xz, y: number, yaw: number, sx: number, sy: number, sz: number,
  tiltX: { kind: 'exact-optional', item: number }, tiltZ: { kind: 'exact-optional', item: number },
  solid: { kind: 'exact-optional', item: { kind: 'literal', value: true } },
  far: number, r: number, g: number, b: number,
} } });
const spot = defineNamedRows({ kind: 'array', item: { kind: 'object', entries: { ...xz, s: number } } });
export const DRESSING_SCHEMAS: Readonly<Record<string, NamedRows<unknown[]>>> = {
  boulder: instance, slab: instance, juniper: instance, rose: instance, willow: instance, lupin: instance, reed: instance,
  logs: defineNamedRows({ kind: 'array', item: { kind: 'object', entries: { ax: number, az: number, bx: number, bz: number, r: number, drift: { kind: 'boolean' } } } }),
  stumps: spot, ovoos: spot, poles: spot,
  fences: defineNamedRows({ kind: 'array', item: { kind: 'array', item: { kind: 'tuple', items: [number, number] } } }),
  gates: defineNamedRows({ kind: 'array', item: { kind: 'object', entries: { ...xz, yaw: number } } }),
  drifts: defineNamedRows({ kind: 'array', item: { kind: 'object', entries: { ...xz, y: number, r: number } } }),
  colliders: defineNamedRows({ kind: 'array', item: { kind: 'object', entries: { ...xz, hw: number, hd: number, rot: number, yBottom: number, yTop: number,
    ghost: { kind: 'exact-optional', item: { kind: 'literal', value: true } } } } }),
  clutter: defineNamedRows({ kind: 'array', item: { kind: 'object', entries: { ...xz, yaw: number, kind: number } } }),
};

/** Each dressing producer attaches its authored row contract; unknown kinds refuse. */
export function nalatiDressingBlob(name: string, kind: 'json', bytes: Uint8Array): NamedBlob {
  const key = /^world\/dressing-([a-z]+)\.json$/u.exec(name)?.[1];
  const schema = key === undefined ? undefined : DRESSING_SCHEMAS[key];
  if (schema === undefined) throw new Error(`Missing dressing schema: ${name}`);
  return nameBlob(name, kind, bytes, { jsonSchema: schema.jsonSchema });
}

/** Pack source-owned native placement rows with their original file names, exact doubles and admission schemas. */
export function nalatiDressingPlacementBlobs(files: ReadonlyMap<string, Uint8Array>): readonly NamedBlob[] {
  return [...files].map(([name, bytes]) => {
    const key = /^dressing-([a-z]+)\.json$/u.exec(name)?.[1];
    if (key === undefined) throw new Error('Invalid owned dressing placement name');
    const rows: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (key === 'stone' || key === 'daisy') return nameBlob(`world/dressing-${key}.bin`, 'bin', packDressingTable(rows));
    const schema = DRESSING_SCHEMAS[key];
    if (schema === undefined) throw new Error('Missing owned dressing placement schema');
    return nalatiDressingBlob(`world/dressing-${key}.json`, 'json', new TextEncoder().encode(encodeCanonicalJson(schema.parse(rows))));
  });
}
