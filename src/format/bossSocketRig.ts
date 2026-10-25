import * as v from 'valibot';
import { LimbCollisionBake } from './limbCollision';
import { isJsonData } from './json';

const n = v.pipe(v.number(), v.finite()), id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const xyz = v.tuple([n, n, n]);
const part = v.strictObject({ id, geometry: id, material: id });
/** Client-only attachments, weak-point query and affine opening channels. */
export const BossSocketRigSchema: v.GenericSchema<BossSocketRigRowsInput, BossSocketRigRows> = v.pipe(v.unknown(), v.check(isJsonData, 'Socket rig requires JSON rows'), v.strictObject({
  id, pool: v.strictObject({ url: id, parts: v.pipe(v.array(id), v.maxLength(8)) }), collision: v.strictObject({ joints: LimbCollisionBake.entries.joints, volumes: LimbCollisionBake.entries.volumes }),
  materials: v.pipe(v.array(v.strictObject({ id, colour: xyz, emissive: xyz, gain: n, roughness: n, metalness: n, lit: v.boolean(), fog: v.boolean() })), v.maxLength(8)),
  attachments: v.pipe(v.array(v.strictObject({ id, name: id, socket: id, at: xyz, meshes: v.pipe(v.array(part), v.maxLength(4)) })), v.maxLength(9)),
  hazards: v.pipe(v.array(id), v.maxLength(8)), focus: id, radius: n,
  glow: v.pipe(v.array(v.strictObject({ material: id, gain: n })), v.maxLength(8)),
  opening: v.pipe(v.array(v.strictObject({ part: id, scale: xyz, breathe: xyz, frequency: n })), v.maxLength(8)),
  emission: v.pipe(v.array(v.strictObject({ material: id, base: n, open: n })), v.maxLength(8)),
}));


/** Admitted data contracts, independent of validator implementation metadata. */
export type BossSocketRigRowsInput = unknown;
interface BossSocketRigRowsFields {
    id: string;
    pool: {
        url: string;
        parts: (string)[];
    };
    collision: {
        joints: v.InferOutput<(typeof LimbCollisionBake)['entries']['joints']>;
        volumes: v.InferOutput<(typeof LimbCollisionBake)['entries']['volumes']>;
    };
    materials: ({
        id: string;
        colour: [
            number,
            number,
            number
        ];
        emissive: [
            number,
            number,
            number
        ];
        gain: number;
        roughness: number;
        metalness: number;
        lit: boolean;
        fog: boolean;
    })[];
    attachments: ({
        id: string;
        name: string;
        socket: string;
        at: [
            number,
            number,
            number
        ];
        meshes: ({
            id: string;
            geometry: string;
            material: string;
        })[];
    })[];
    hazards: (string)[];
    focus: string;
    radius: number;
    glow: ({
        material: string;
        gain: number;
    })[];
    opening: ({
        part: string;
        scale: [
            number,
            number,
            number
        ];
        breathe: [
            number,
            number,
            number
        ];
        frequency: number;
    })[];
    emission: ({
        material: string;
        base: number;
        open: number;
    })[];
}
export type BossSocketRigRows = { [Key in keyof BossSocketRigRowsFields]: BossSocketRigRowsFields[Key] };
