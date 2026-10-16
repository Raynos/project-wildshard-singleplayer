import * as v from 'valibot';

const finite = v.pipe(v.number(), v.finite());
const triple = v.tuple([finite, finite, finite]);
const xyz = v.strictObject({ x: finite, y: finite, z: finite });
const materials = ['sand', 'wetSand', 'grass', 'rock', 'planks', 'stone', 'water', 'wood', 'metal', 'flesh', 'shell', 'ground', 'edge', 'felt', 'earth'] as const;

/** Strict numeric native body recipe. Decoding and actor construction belong to the native host. */
const body = v.strictObject({ kind: v.string(), label: v.string(), variant: v.string(), rarity: v.picklist(['common', 'uncommon', 'rare', 'legendary']),
  hp: finite, aggressive: v.boolean(), lockable: v.exactOptional(v.boolean()),
  dims: v.strictObject({ bodyY: finite, bodyHalfLen: finite, bodyRadius: finite, headRadius: finite, legLen: finite, feet: v.array(v.tuple([finite, finite])), halfWidth: finite,
    capsuleAxis: v.exactOptional(v.picklist(['z', 'y'])), headAt: v.exactOptional(triple), bodyAt: v.exactOptional(triple), bodyPitch: v.exactOptional(finite),
    fore: v.exactOptional(v.strictObject({ bone: v.string(), at: triple, halfLen: finite, radius: finite })) }),
  mods: v.strictObject({ speed: finite, chargeDist: finite, damageTaken: finite, chargeDamage: finite, relentless: v.boolean() }) });

/** Preserve the original segmented/axis contact-rig admission without importing the engine. */
export function nativeBodySchema(rig: 'segments' | 'axis'): v.GenericSchema<unknown, v.InferOutput<typeof body>> {
  return v.pipe(body, v.check(row => rig === 'segments' ? !Object.hasOwn(row.dims, 'capsuleAxis')
    : !['headAt', 'bodyAt', 'bodyPitch', 'fore'].some(key => Object.hasOwn(row.dims, key)), 'Unsupported native body rig field'));
}

/** Raw native floor declaration; its lattice resolution remains an explicit caller policy. */
export interface NativeGroundRecord {
  readonly rows: number; readonly cols: number; readonly heights: string;
  readonly friction: number; readonly groups: number;
  readonly scale: { x: number; y: number; z: number };
  readonly at: { x: number; y: number; z: number };
}

/** The native lattice's original structural admission; the decoder also checks byte count and world scale. */
export function nativeGroundRecordSchema(resolution: number): v.GenericSchema<unknown, NativeGroundRecord> {
  return v.strictObject({ rows: v.literal(resolution - 1), cols: v.literal(resolution - 1), scale: xyz, at: xyz,
    friction: finite, groups: finite, heights: v.string() });
}

const colliderFields = { groups: finite, friction: finite, at: triple, rot: v.tuple([finite, finite, finite, finite]),
  body: v.exactOptional(v.nullable(finite)), material: v.exactOptional(v.picklist(materials)), owner: v.exactOptional(v.string()),
  ownerId: v.exactOptional(v.pipe(v.string(), v.regex(/^(?:piece|declared):[^\r\n]{1,256}$/u))),
  half: v.exactOptional(triple), halfHeight: v.exactOptional(finite), radius: v.exactOptional(finite), vertices: v.exactOptional(v.string()), indices: v.exactOptional(v.string()) };

/** Undecoded numeric collider with an explicit producer provenance policy. */
export interface NativeColliderRecord<S extends 1 | 2 | 6 | 9 = 1 | 2 | 6 | 9> {
  readonly shape: S; readonly groups: number; readonly friction: number;
  readonly at: readonly [number, number, number]; readonly rot: readonly [number, number, number, number];
  readonly body?: number | null; readonly material?: (typeof materials)[number]; readonly owner?: string; readonly ownerId?: string;
  readonly half?: readonly [number, number, number]; readonly halfHeight?: number; readonly radius?: number;
  readonly vertices?: string; readonly indices?: string;
}

/** Retain each producer's admitted shapes and provenance namespace before binary decoding. */
export function nativeColliderRecordSchema<const S extends readonly (1 | 2 | 6 | 9)[]>(shapes: S, owner: 'piece' | 'tagged'): v.GenericSchema<unknown, NativeColliderRecord<S[number]>> {
  return v.pipe(v.strictObject({ shape: v.picklist(shapes), ...colliderFields }),
    v.check(row => owner === 'piece' ? Object.hasOwn(row, 'body') && !Object.hasOwn(row, 'owner')
      : !['body', 'ownerId', 'indices'].some(key => Object.hasOwn(row, key)), 'Unsupported native collider provenance'));
}
