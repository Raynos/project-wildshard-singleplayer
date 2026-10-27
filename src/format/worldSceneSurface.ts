import * as v from 'valibot';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const number = v.pipe(v.number(), v.finite());
const triple = v.tuple([number, number, number]);
const pair = v.tuple([number, number]);
const distance = v.pipe(number, v.minValue(1), v.maxValue(16384));
const cap = v.strictObject({ phone: distance, desktop: distance });
/** Client-only original standard/PBR surfaces, optionally mapped through an admitted graph. */
export const WorldSceneSurfaceSchema: v.StrictObjectSchema<{ readonly id: v.GenericSchema<WorldSceneSurfaceInput['id'], WorldSceneSurface['id']>; readonly kind: v.GenericSchema<WorldSceneSurfaceInput['kind'], WorldSceneSurface['kind']>; readonly load: v.ExactOptionalSchema<v.GenericSchema<Exclude<WorldSceneSurfaceInput['load'], undefined>, Exclude<WorldSceneSurface['load'], undefined>>, undefined>; readonly scan: v.ExactOptionalSchema<v.GenericSchema<Exclude<WorldSceneSurfaceInput['scan'], undefined>, Exclude<WorldSceneSurface['scan'], undefined>>, undefined>; readonly maxTexture: v.ExactOptionalSchema<v.GenericSchema<Exclude<WorldSceneSurfaceInput['maxTexture'], undefined>, Exclude<WorldSceneSurface['maxTexture'], undefined>>, undefined>; readonly cellTexture: v.ExactOptionalSchema<v.GenericSchema<Exclude<WorldSceneSurfaceInput['cellTexture'], undefined>, Exclude<WorldSceneSurface['cellTexture'], undefined>>, undefined>; readonly properties: v.GenericSchema<WorldSceneSurfaceInput['properties'], WorldSceneSurface['properties']>; readonly map: v.ExactOptionalSchema<v.GenericSchema<Exclude<WorldSceneSurfaceInput['map'], undefined>, Exclude<WorldSceneSurface['map'], undefined>>, undefined>; readonly look: v.ExactOptionalSchema<v.GenericSchema<Exclude<WorldSceneSurfaceInput['look'], undefined>, Exclude<WorldSceneSurface['look'], undefined>>, undefined>; readonly lookTextures: v.OptionalSchema<v.GenericSchema<Exclude<WorldSceneSurfaceInput['lookTextures'], undefined>, Exclude<WorldSceneSurface['lookTextures'], undefined>>, Record<never, never>>; }, undefined> = v.strictObject({ id, kind: v.literal('surface'),
  load: v.exactOptional(v.picklist(['resident', 'placement'])), scan: v.exactOptional(id), maxTexture: v.exactOptional(cap), cellTexture: v.exactOptional(v.strictObject({ atMost: distance, max: distance })),
  properties: v.strictObject({ color: v.exactOptional(v.union([number, triple])), normalScale: v.exactOptional(pair),
    roughness: v.exactOptional(number), metalness: v.exactOptional(number), transparent: v.exactOptional(v.boolean()),
    opacity: v.exactOptional(number), envMapIntensity: v.exactOptional(number), emissive: v.exactOptional(v.union([number, triple])),
    emissiveIntensity: v.exactOptional(number), side: v.exactOptional(v.picklist([0, 1, 2])), depthWrite: v.exactOptional(v.boolean()), vertexColors: v.exactOptional(v.boolean()) }),
  map: v.exactOptional(v.strictObject({ appearance: id, texture: id })),
  look: v.exactOptional(id), lookTextures: v.optional(v.pipe(v.record(id, v.picklist(['normalMap', 'map', 'roughnessMap', 'aoMap'])), v.check(rows => Object.keys(rows).length <= 8)), {}),
});


/** Admitted data contracts, independent of validator implementation metadata. */
interface WorldSceneSurfaceInputFields {
    id: string;
    kind: 'surface';
    load?: 'resident' | 'placement';
    scan?: string;
    maxTexture?: {
        phone: number;
        desktop: number;
    };
    cellTexture?: {
        atMost: number;
        max: number;
    };
    properties: {
        color?: (number) | ([
            number,
            number,
            number
        ]);
        normalScale?: [
            number,
            number
        ];
        roughness?: number;
        metalness?: number;
        transparent?: boolean;
        opacity?: number;
        envMapIntensity?: number;
        emissive?: (number) | ([
            number,
            number,
            number
        ]);
        emissiveIntensity?: number;
        side?: 0 | 1 | 2;
        depthWrite?: boolean;
        vertexColors?: boolean;
    };
    map?: {
        appearance: string;
        texture: string;
    };
    look?: string;
    lookTextures?: Record<string, 'normalMap' | 'map' | 'roughnessMap' | 'aoMap'> | undefined;
}
export type WorldSceneSurfaceInput = { [Key in keyof WorldSceneSurfaceInputFields]: WorldSceneSurfaceInputFields[Key] };
interface WorldSceneSurfaceFields {
    id: string;
    kind: 'surface';
    load?: 'resident' | 'placement';
    scan?: string;
    maxTexture?: {
        phone: number;
        desktop: number;
    };
    cellTexture?: {
        atMost: number;
        max: number;
    };
    properties: {
        color?: (number) | ([
            number,
            number,
            number
        ]);
        normalScale?: [
            number,
            number
        ];
        roughness?: number;
        metalness?: number;
        transparent?: boolean;
        opacity?: number;
        envMapIntensity?: number;
        emissive?: (number) | ([
            number,
            number,
            number
        ]);
        emissiveIntensity?: number;
        side?: 0 | 1 | 2;
        depthWrite?: boolean;
        vertexColors?: boolean;
    };
    map?: {
        appearance: string;
        texture: string;
    };
    look?: string;
    lookTextures: Record<string, 'normalMap' | 'map' | 'roughnessMap' | 'aoMap'>;
}
export type WorldSceneSurface = { [Key in keyof WorldSceneSurfaceFields]: WorldSceneSurfaceFields[Key] };
