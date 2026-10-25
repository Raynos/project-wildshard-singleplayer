import * as v from 'valibot';
import { PrivateSceneSchema } from './clientChannels';

const finite = v.pipe(v.number(), v.finite());
const name = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const names: v.GenericSchema<string[], string[]> & { readonly pipe: readonly [unknown, unknown, unknown, v.CheckAction<string[], undefined>] } = v.pipe(v.array(name), v.minLength(1), v.maxLength(64),
  v.check(rows => new Set(rows).size === rows.length));
const count = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(4096));
const bounded = <T extends v.GenericSchema>(schema: T, max: number) => v.pipe(v.array(schema), v.maxLength(max));
/** G475 held arms drawn in graph looks: a skinned rig played by the shared arm player (its blade row is the hit sweep's
 * and the swing trail's), its meshes dressed from rows, the trail sampled along the blade during each swing, and the
 * per-frame look writes as named sources. Client-only presentation; ids only, no callbacks. */
export const GraphArmsSchema: v.StrictObjectSchema<{ readonly rig: v.GenericSchema<GraphArmsRowInput['rig'], GraphArmsRow['rig']> & { readonly entries: { readonly sockets: typeof names } }; readonly blade: v.GenericSchema<GraphArmsRowInput['blade'], GraphArmsRow['blade']>; readonly trail: v.GenericSchema<GraphArmsRowInput['trail'], GraphArmsRow['trail']>; readonly claw: v.GenericSchema<GraphArmsRowInput['claw'], GraphArmsRow['claw']>; readonly params: v.GenericSchema<GraphArmsRowInput['params'], GraphArmsRow['params']>; readonly meshes: v.GenericSchema<GraphArmsRowInput['meshes'], GraphArmsRow['meshes']>; readonly maps: v.GenericSchema<GraphArmsRowInput['maps'], GraphArmsRow['maps']>; readonly weave: v.GenericSchema<GraphArmsRowInput['weave'], GraphArmsRow['weave']>; readonly decal: v.GenericSchema<GraphArmsRowInput['decal'], GraphArmsRow['decal']>; readonly back: v.GenericSchema<GraphArmsRowInput['back'], GraphArmsRow['back']>; readonly additive: v.GenericSchema<GraphArmsRowInput['additive'], GraphArmsRow['additive']>; readonly pendants: v.GenericSchema<GraphArmsRowInput['pendants'], GraphArmsRow['pendants']>; readonly frame: v.GenericSchema<GraphArmsRowInput['frame'], GraphArmsRow['frame']>; }, undefined> = v.strictObject({
  rig: v.strictObject({ url: name, skeleton: name, sockets: names, joints: bounded(names, 8), holdRight: bounded(name, 32), holdLeft: bounded(name, 32),
    walkRate: finite, lag: v.strictObject({ max: finite, pitch: finite, yaw: finite }) }),
  /** the blade on its socket: base and tip along the socket's +Y (rig units) */
  blade: v.strictObject({ socket: name, base: finite, tip: finite }),
  /** the swing trail: ribbon profile, its look and seed param, its life as a share of the clip (or `total` s), sampled from `from` of the blade */
  trail: v.strictObject({ look: name, seed: name, samples: count, subdivisions: count, movementSq: finite, life: finite, total: finite, from: finite, order: finite }),
  /** meshes whose name starts with this show with the claw */
  claw: name,
  /** every look's params, by look id; a frame source with no look writes each look that declares its param */
  params: v.record(name, bounded(name, 128)),
  meshes: bounded(v.strictObject({ name, channels: v.record(name, name), look: name, maps: v.exactOptional(name), hull: v.boolean(), doubleSide: v.boolean() }), 64),
  /** per-mesh map pairs: `<base><maps>-<kind>.webp` (or its KTX2 stand-in) lent to the mesh look's params */
  maps: v.strictObject({ base: name, names, kinds: v.strictObject({ maps: name, nrm: name }), anisotropy: finite }),
  /** an R8 repeating weave and per-tier lossless decal images, all named product files */
  weave: v.strictObject({ file: name, size: count, param: name }),
  decal: v.strictObject({ files: v.strictObject({ phone: name, desktop: name }), param: name }),
  back: bounded(name, 64), additive: bounded(name, 64),
  /** the pendants: a private scene on a socket, its geometry read from product JSON (a file of named geometries, or one `field` as `name`) */
  pendants: v.strictObject({ socket: name, scene: PrivateSceneSchema, materials: bounded(name, 64),
    geometry: bounded(v.union([v.strictObject({ file: name }), v.strictObject({ file: name, field: name, name })]), 16) }),
  frame: bounded(v.strictObject({ look: v.exactOptional(name), param: name, source: v.picklist(['time', 'buffer', 'pixels', 'projection']),
    scale: v.exactOptional(finite), min: v.exactOptional(finite) }), 32),
});

/** Build-only admission of the named held-view file, before any native binding reads it. */
export function parseGraphArms(input: unknown): GraphArmsRow { return v.parse(GraphArmsSchema, input); }

/** Admitted data contracts, independent of validator implementation metadata. */
interface GraphArmsRowInputFields {
    rig: {
        url: string;
        skeleton: string;
        sockets: (string)[];
        joints: ((string)[])[];
        holdRight: (string)[];
        holdLeft: (string)[];
        walkRate: number;
        lag: {
            max: number;
            pitch: number;
            yaw: number;
        };
    };
    blade: {
        socket: string;
        base: number;
        tip: number;
    };
    trail: {
        look: string;
        seed: string;
        samples: number;
        subdivisions: number;
        movementSq: number;
        life: number;
        total: number;
        from: number;
        order: number;
    };
    claw: string;
    params: Record<string, (string)[]>;
    meshes: ({
        name: string;
        channels: Record<string, string>;
        look: string;
        maps?: string;
        hull: boolean;
        doubleSide: boolean;
    })[];
    maps: {
        base: string;
        names: (string)[];
        kinds: {
            maps: string;
            nrm: string;
        };
        anisotropy: number;
    };
    weave: {
        file: string;
        size: number;
        param: string;
    };
    decal: {
        files: {
            phone: string;
            desktop: string;
        };
        param: string;
    };
    back: (string)[];
    additive: (string)[];
    pendants: {
        socket: string;
        scene: v.InferInput<typeof PrivateSceneSchema>;
        materials: (string)[];
        geometry: (({
            file: string;
        }) | ({
            file: string;
            field: string;
            name: string;
        }))[];
    };
    frame: ({
        look?: string;
        param: string;
        source: 'time' | 'buffer' | 'pixels' | 'projection';
        scale?: number;
        min?: number;
    })[];
}
export type GraphArmsRowInput = { [Key in keyof GraphArmsRowInputFields]: GraphArmsRowInputFields[Key] };
interface GraphArmsRowFields {
    rig: {
        url: string;
        skeleton: string;
        sockets: (string)[];
        joints: ((string)[])[];
        holdRight: (string)[];
        holdLeft: (string)[];
        walkRate: number;
        lag: {
            max: number;
            pitch: number;
            yaw: number;
        };
    };
    blade: {
        socket: string;
        base: number;
        tip: number;
    };
    trail: {
        look: string;
        seed: string;
        samples: number;
        subdivisions: number;
        movementSq: number;
        life: number;
        total: number;
        from: number;
        order: number;
    };
    claw: string;
    params: Record<string, (string)[]>;
    meshes: ({
        name: string;
        channels: Record<string, string>;
        look: string;
        maps?: string;
        hull: boolean;
        doubleSide: boolean;
    })[];
    maps: {
        base: string;
        names: (string)[];
        kinds: {
            maps: string;
            nrm: string;
        };
        anisotropy: number;
    };
    weave: {
        file: string;
        size: number;
        param: string;
    };
    decal: {
        files: {
            phone: string;
            desktop: string;
        };
        param: string;
    };
    back: (string)[];
    additive: (string)[];
    pendants: {
        socket: string;
        scene: v.InferOutput<typeof PrivateSceneSchema>;
        materials: (string)[];
        geometry: (({
            file: string;
        }) | ({
            file: string;
            field: string;
            name: string;
        }))[];
    };
    frame: ({
        look?: string;
        param: string;
        source: 'time' | 'buffer' | 'pixels' | 'projection';
        scale?: number;
        min?: number;
    })[];
}
export type GraphArmsRow = { [Key in keyof GraphArmsRowFields]: GraphArmsRowFields[Key] };
