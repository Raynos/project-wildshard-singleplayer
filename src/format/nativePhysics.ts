import * as v from 'valibot';

const finite = v.pipe(v.number(), v.finite());
const triple = v.tuple([finite, finite, finite]);
const xyz = v.strictObject({ x: finite, y: finite, z: finite });
const materials = ['sand', 'wetSand', 'grass', 'rock', 'planks', 'stone', 'water', 'wood', 'metal', 'flesh', 'shell', 'ground', 'edge', 'felt', 'earth'] as const;

/** Strict numeric native body recipe. Decoding and actor construction belong to the native host. */
const body: v.GenericSchema<NativeBodyInput, NativeBody> = v.strictObject({ kind: v.string(), label: v.string(), variant: v.string(), rarity: v.picklist(['common', 'uncommon', 'rare', 'legendary']),
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

/** An admitted raw floor blob, read through the original native product. */
export interface NativeGroundFile { readonly file: string }
const binaryFile = v.pipe(v.string(),v.minLength(1),v.maxLength(240),v.regex(/^(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.bin$/u));
export const NativeGroundFileSchema: v.GenericSchema<unknown, NativeGroundFile> = v.strictObject({
  file: binaryFile,
});
export type NativeGroundStorage = string | NativeGroundFile;

/** Aligned byte range in an admitted native collider buffer; no numeric conversion. */
export interface NativeArraySlice {
  readonly file: string;
  readonly byteOffset: number;
  readonly byteLength: number;
}
const aligned = v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(2_147_483_644), v.multipleOf(4));
export const NativeArraySliceSchema: v.GenericSchema<unknown, NativeArraySlice> = v.strictObject({
  file: binaryFile, byteOffset: aligned, byteLength: aligned,
});
export type NativeArrayStorage = string | NativeArraySlice;

/** Raw native floor declaration; its lattice resolution remains an explicit caller policy. */
export interface NativeGroundRecord<Storage extends NativeGroundStorage = string> {
  readonly rows: number; readonly cols: number; readonly heights: Storage;
  readonly friction: number; readonly groups: number;
  readonly scale: { x: number; y: number; z: number };
  readonly at: { x: number; y: number; z: number };
}

/** The native lattice's original structural admission; the decoder also checks byte count and world scale. */
export function nativeGroundRecordSchema(resolution: number): v.GenericSchema<unknown, NativeGroundRecord>;
export function nativeGroundRecordSchema(resolution: number, files: true): v.GenericSchema<unknown, NativeGroundRecord<NativeGroundStorage>>;
export function nativeGroundRecordSchema(resolution: number, files = false): v.GenericSchema<unknown, NativeGroundRecord<NativeGroundStorage>> {
  return v.strictObject({ rows: v.literal(resolution - 1), cols: v.literal(resolution - 1), scale: xyz, at: xyz,
    friction: finite, groups: finite, heights: files ? v.union([v.string(),NativeGroundFileSchema]) : v.string() });
}

const colliderFields = { groups: finite, friction: finite, at: triple, rot: v.tuple([finite, finite, finite, finite]),
  body: v.exactOptional(v.nullable(finite)), material: v.exactOptional(v.picklist(materials)), owner: v.exactOptional(v.string()),
  ownerId: v.exactOptional(v.pipe(v.string(), v.regex(/^(?:piece|declared):[^\r\n]{1,256}$/u))),
  half: v.exactOptional(triple), halfHeight: v.exactOptional(finite), radius: v.exactOptional(finite) };

/** Undecoded numeric collider with an explicit producer provenance policy. */
export interface NativeColliderRecord<S extends 1 | 2 | 6 | 9 = 1 | 2 | 6 | 9, Storage extends NativeArrayStorage = string> {
  readonly shape: S; readonly groups: number; readonly friction: number;
  readonly at: readonly [number, number, number]; readonly rot: readonly [number, number, number, number];
  readonly body?: number | null; readonly material?: (typeof materials)[number]; readonly owner?: string; readonly ownerId?: string;
  readonly half?: readonly [number, number, number]; readonly halfHeight?: number; readonly radius?: number;
  readonly vertices?: Storage; readonly indices?: Storage;
}

/** Retain each producer's admitted shapes and provenance namespace before binary decoding. */
export function nativeColliderRecordSchema<const S extends readonly (1 | 2 | 6 | 9)[]>(
  shapes: S, owner: 'piece' | 'tagged',
): v.GenericSchema<unknown, NativeColliderRecord<S[number]>>;
export function nativeColliderRecordSchema<const S extends readonly (1 | 2 | 6 | 9)[]>(
  shapes: S, owner: 'piece' | 'tagged', files: true,
): v.GenericSchema<unknown, NativeColliderRecord<S[number], NativeArrayStorage>>;
export function nativeColliderRecordSchema<const S extends readonly (1 | 2 | 6 | 9)[]>(
  shapes: S, owner: 'piece' | 'tagged', files = false,
): v.GenericSchema<unknown, NativeColliderRecord<S[number], NativeArrayStorage>> {
  const array = files ? v.union([v.string(), NativeArraySliceSchema]) : v.string();
  return v.pipe(v.strictObject({ shape: v.picklist(shapes), ...colliderFields, vertices: v.exactOptional(array), indices: v.exactOptional(array) }),
    v.check(row => owner === 'piece' ? Object.hasOwn(row, 'body') && !Object.hasOwn(row, 'owner')
      : !['body', 'ownerId', 'indices'].some(key => Object.hasOwn(row, key)), 'Unsupported native collider provenance'));
}

/** Exact admitted data, independent of validator implementation metadata. */
export type NativeBodyInput = NativeBody;
interface NativeBodyFields {
    kind: string;
    label: string;
    variant: string;
    rarity: "common" | "uncommon" | "rare" | "legendary";
    hp: number;
    aggressive: boolean;
    lockable?: boolean;
    dims: {
        bodyY: number;
        bodyHalfLen: number;
        bodyRadius: number;
        headRadius: number;
        legLen: number;
        feet: [
            number,
            number
        ][];
        halfWidth: number;
        capsuleAxis?: "z" | "y";
        headAt?: [
            number,
            number,
            number
        ];
        bodyAt?: [
            number,
            number,
            number
        ];
        bodyPitch?: number;
        fore?: {
            bone: string;
            at: [
                number,
                number,
                number
            ];
            halfLen: number;
            radius: number;
        };
    };
    mods: {
        speed: number;
        chargeDist: number;
        damageTaken: number;
        chargeDamage: number;
        relentless: boolean;
    };
}
export type NativeBody = { [Key in keyof NativeBodyFields]: NativeBodyFields[Key] };
