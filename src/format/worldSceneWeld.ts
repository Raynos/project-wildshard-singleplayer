import * as v from 'valibot';
import { isJsonData } from './json';
import { WorldSceneSurfaceSchema } from './worldSceneSurface';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const finite = v.pipe(v.number(), v.finite(), v.minValue(-1e6), v.maxValue(1e6));
const nonnegative = v.pipe(finite, v.minValue(0));
const integer = v.pipe(nonnegative, v.integer());
const word = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffffffff));
const layerMask = v.pipe(v.number(), v.integer(), v.minValue(-0x80000000), v.maxValue(0xffffffff));
const list = <T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(schema: T, max: number) => v.pipe(v.array(schema), v.maxLength(max));
const bits = (length: number) => v.pipe(v.array(word), v.length(length));
const finiteWords = (values: readonly number[], wide: boolean): boolean => {
  const buffer = Uint32Array.from(values).buffer;
  return (wide ? new Float64Array(buffer) : new Float32Array(buffer)).every(Number.isFinite);
};
const sphere = v.tuple([finite, finite, finite, nonnegative]);
const box = v.tuple([finite, finite, finite, finite, finite, finite]);
const geometry = v.strictObject({ library: id, model: id });
const knob = v.pipe(id, v.regex(/^[a-z][a-z0-9-]*(?:\.[a-z][a-zA-Z0-9-]*)+$/u));
/** Distances remain live quality inputs after the geometry has been baked. */
export const WorldSceneDistanceSchema: v.GenericSchema<WorldSceneDistanceRowsInput, WorldSceneDistanceRows> = v.union([nonnegative, v.strictObject({ knob, multiply: v.optional(nonnegative, 1), add: v.optional(nonnegative, 0) })]);
const distance = WorldSceneDistanceSchema;
const common = { id, parent: id, name: v.optional(v.string(), ''), matrixBits: v.exactOptional(bits(32)), transformBits: v.exactOptional(bits(20)),
  matrixAutoUpdate: v.optional(v.boolean(), true), layers: v.optional(layerMask, 1), visible: v.optional(v.boolean(), true),
  frustumCulled: v.optional(v.boolean(), true), castShadow: v.optional(v.boolean(), false), receiveShadow: v.optional(v.boolean(), false),
  renderOrder: v.optional(finite, 0), until: v.exactOptional(distance), castFrom: v.exactOptional(distance) };
const draw = { geometry, material: id, sphere, box: v.exactOptional(box) };
/** Frozen draw topology, including ordinary weld batches and their shared-buffer selection views. */
export const WorldSceneWeldNodeSchema: v.GenericSchema<WorldSceneWeldNodeInput, WorldSceneWeldNode> = v.variant('kind', [
  v.strictObject({ ...common, kind: v.literal('group') }),
  v.strictObject({ ...common, kind: v.literal('anchor') }),
  v.strictObject({ ...common, ...draw, kind: v.literal('mesh') }),
  v.strictObject({ ...common, ...draw, kind: v.literal('batch') }),
  v.strictObject({ ...common, ...draw, kind: v.literal('instances'), capacity: v.pipe(integer, v.minValue(1), v.maxValue(8192)),
    count: v.pipe(integer, v.maxValue(8192)), matrixWords: list(word, 131072), instanceSphere: sphere, instanceBox: v.exactOptional(box) }),
  v.strictObject({ ...common, kind: v.literal('view'), batch: id, start: integer, count: integer, sphere, box }),
  v.strictObject({ ...common, kind: v.literal('cloud'), material: id, seedWords: list(word, 131072), sphere }),
  v.strictObject({ ...common, kind: v.literal('light'), color: v.pipe(word, v.maxValue(0xffffff)), intensity: nonnegative, distance: nonnegative, decay: nonnegative }),
]);
const hosted = v.strictObject({ meshes: list(id, 128), lists: list(v.strictObject({ unit: integer, matrixWords: list(word, 131072) }), 128) });
/** Fresh specimen materials copy only declared maps, retaining native constructor defaults (a world-scenes section's
 *  `mapped` material row is the same grammar). */
export const WorldSceneWeldMaterialSchema: v.StrictObjectSchema<{ readonly id: v.GenericSchema<WorldSceneWeldMaterialRowsInput['id'], WorldSceneWeldMaterialRows['id']>; readonly kind: v.GenericSchema<WorldSceneWeldMaterialRowsInput['kind'], WorldSceneWeldMaterialRows['kind']>; readonly source: v.ExactOptionalSchema<v.GenericSchema<Exclude<WorldSceneWeldMaterialRowsInput['source'], undefined>, Exclude<WorldSceneWeldMaterialRows['source'], undefined>>, undefined>; readonly properties: v.GenericSchema<WorldSceneWeldMaterialRowsInput['properties'], WorldSceneWeldMaterialRows['properties']>; readonly sky: v.OptionalSchema<v.GenericSchema<Exclude<WorldSceneWeldMaterialRowsInput['sky'], undefined>, Exclude<WorldSceneWeldMaterialRows['sky'], undefined>>, false>; readonly blending: v.ExactOptionalSchema<v.GenericSchema<Exclude<WorldSceneWeldMaterialRowsInput['blending'], undefined>, Exclude<WorldSceneWeldMaterialRows['blending'], undefined>>, undefined>; readonly fog: v.ExactOptionalSchema<v.GenericSchema<Exclude<WorldSceneWeldMaterialRowsInput['fog'], undefined>, Exclude<WorldSceneWeldMaterialRows['fog'], undefined>>, undefined>; }, undefined> = v.strictObject({ id, kind: v.picklist(['standard', 'basic']),
  source: v.exactOptional(v.strictObject({ material: id, maps: list(v.picklist(['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']), 5) })),
  properties: WorldSceneSurfaceSchema.entries.properties, sky: v.optional(v.boolean(), false),
  blending: v.exactOptional(v.picklist([0, 1, 2, 3, 4, 5])), fog: v.exactOptional(v.boolean()) });
/** A weld captures roots and unit order; band values are resolved from current plumbing. */
const cull = v.strictObject({ roots: list(id, 128), origins: list(finite, 384), units: list(integer, 128), details: list(distance, 128), hosted: list(hosted, 128) });
const setRow = v.strictObject({ id, name: id, file: id, place: v.exactOptional(id), members: list(id, 128) });
const resource = v.variant('kind', [v.strictObject({ id, kind: v.literal('geometry'), source: geometry }),
  v.strictObject({ id, kind: v.literal('seeds'), words: v.pipe(list(word, 131072), v.check(values => values.length % 4 === 0 && finiteWords(values, false))) })]);
export const WorldSceneWeldSchema: v.GenericSchema<WorldSceneWeldInput, WorldSceneWeld> = v.pipe(v.unknown(), v.check(isJsonData, 'Frozen scenes require plain JSON'),
  v.strictObject({ id, root: id, result: v.exactOptional(id), nodes: list(WorldSceneWeldNodeSchema, 4096), materials: v.optional(list(WorldSceneWeldMaterialSchema, 128), []), culls: v.optional(list(cull, 32), []),
    placements: v.optional(list(id, 128), []), sets: v.optional(list(setRow, 32), []), resources: v.optional(list(resource, 512), []) }),
  v.check(row => new Set(row.nodes.map(node => node.id)).size === row.nodes.length && new Set(row.materials.map(entry => entry.id)).size === row.materials.length
    && new Set(row.placements).size === row.placements.length && new Set(row.sets.map(entry => entry.id)).size === row.sets.length
    && new Set(row.resources.map(entry => entry.id)).size === row.resources.length
    && row.sets.every(entry => entry.members.every(member => row.placements.includes(member)))
    && (row.result === undefined || row.result === row.root || row.nodes.some(node => node.id === row.result))
    && row.nodes.every(node => node.id !== row.root
      && (node.matrixBits === undefined || finiteWords(node.matrixBits, true) && (!node.matrixAutoUpdate || node.transformBits !== undefined))
      && (node.transformBits === undefined || finiteWords(node.transformBits, true))
      && (node.kind !== 'instances' || node.count <= node.capacity && node.matrixWords.length === node.capacity * 16 && finiteWords(node.matrixWords, false))
      && (node.kind !== 'cloud' || node.seedWords.length % 4 === 0 && finiteWords(node.seedWords, false)))
    && row.culls.every(entry => entry.origins.length % 3 === 0 && entry.units.length === entry.details.length
      && entry.units.every(unit => unit < entry.origins.length / 3)
      && entry.hosted.every(set => set.lists.every(run => run.unit < entry.units.length && run.matrixWords.length % 16 === 0 && finiteWords(run.matrixWords, false))))
    && row.nodes.reduce((sum, node) => sum + (node.kind === 'instances' ? node.matrixWords.length : node.kind === 'cloud' ? node.seedWords.length : 0), 0) <= 1048576, 'Unique bounded frozen scene nodes and cull lanes'));


const file = v.union([id, v.strictObject({ phone: id, desktop: id })]);
/** Geometry topology can follow an independent Debug quality override. `late` (I2): the weld is built after the player
 *  has control, nearest first by its cell-local `at`, never before it; its producer guarantees nothing of it shows in the
 *  spawn view, so it never pops in where the player starts. */
export const WorldSceneWeldSourceSchema: v.GenericSchema<WorldSceneWeldSourceRowsInput, WorldSceneWeldSourceRows> = v.strictObject({ id, file: v.union([file, v.strictObject({ knob, false: file, true: file })]),
  late: v.exactOptional(v.strictObject({ at: v.tuple([finite, finite]) })) });
const parsedWelds = new WeakMap<object, WorldSceneWeld>();
function freezeWeldRows(value: unknown): void {
  if (typeof value !== 'object' || value === null) return;
  for (const child of Object.values(value)) freezeWeldRows(child);
  Object.freeze(value);
}
/** Only this parser's detached immutable result can skip repeated admission when
 * the prepared graph reaches hydration. Frozen author input is still untrusted. */
export function parseWorldSceneWeld(input: unknown): WorldSceneWeld {
  const known = typeof input === 'object' && input !== null ? parsedWelds.get(input) : undefined;
  if (known !== undefined) return known;
  const row = v.parse(WorldSceneWeldSchema, input);
  freezeWeldRows(row);
  parsedWelds.set(row, row);
  return row;
}

/** Admitted data contracts, independent of validator implementation metadata. */
export type WorldSceneDistanceRowsInput = (number) | ({
    knob: string;
    multiply?: number | undefined;
    add?: number | undefined;
});
export type WorldSceneDistanceRows = (number) | ({
    knob: string;
    multiply: number;
    add: number;
});
export type WorldSceneWeldNodeInput = ({
    kind: 'group';
} & {
    id: string;
    parent: string;
    name?: string | undefined;
    matrixBits?: number[];
    transformBits?: number[];
    matrixAutoUpdate?: boolean | undefined;
    layers?: number | undefined;
    visible?: boolean | undefined;
    frustumCulled?: boolean | undefined;
    castShadow?: boolean | undefined;
    receiveShadow?: boolean | undefined;
    renderOrder?: number | undefined;
    until?: WorldSceneDistanceRowsInput;
    castFrom?: WorldSceneDistanceRowsInput;
}) | ({
    kind: 'anchor';
} & {
    id: string;
    parent: string;
    name?: string | undefined;
    matrixBits?: number[];
    transformBits?: number[];
    matrixAutoUpdate?: boolean | undefined;
    layers?: number | undefined;
    visible?: boolean | undefined;
    frustumCulled?: boolean | undefined;
    castShadow?: boolean | undefined;
    receiveShadow?: boolean | undefined;
    renderOrder?: number | undefined;
    until?: WorldSceneDistanceRowsInput;
    castFrom?: WorldSceneDistanceRowsInput;
}) | ({
    kind: 'mesh';
} & {
    id: string;
    parent: string;
    name?: string | undefined;
    matrixBits?: number[];
    transformBits?: number[];
    matrixAutoUpdate?: boolean | undefined;
    layers?: number | undefined;
    visible?: boolean | undefined;
    frustumCulled?: boolean | undefined;
    castShadow?: boolean | undefined;
    receiveShadow?: boolean | undefined;
    renderOrder?: number | undefined;
    until?: WorldSceneDistanceRowsInput;
    castFrom?: WorldSceneDistanceRowsInput;
} & {
    geometry: {
        library: string;
        model: string;
    };
    material: string;
    sphere: [
        number,
        number,
        number,
        number
    ];
    box?: [
        number,
        number,
        number,
        number,
        number,
        number
    ];
}) | ({
    kind: 'batch';
} & {
    id: string;
    parent: string;
    name?: string | undefined;
    matrixBits?: number[];
    transformBits?: number[];
    matrixAutoUpdate?: boolean | undefined;
    layers?: number | undefined;
    visible?: boolean | undefined;
    frustumCulled?: boolean | undefined;
    castShadow?: boolean | undefined;
    receiveShadow?: boolean | undefined;
    renderOrder?: number | undefined;
    until?: WorldSceneDistanceRowsInput;
    castFrom?: WorldSceneDistanceRowsInput;
} & {
    geometry: {
        library: string;
        model: string;
    };
    material: string;
    sphere: [
        number,
        number,
        number,
        number
    ];
    box?: [
        number,
        number,
        number,
        number,
        number,
        number
    ];
}) | ({
    kind: 'instances';
    capacity: number;
    count: number;
    matrixWords: (number)[];
    instanceSphere: [
        number,
        number,
        number,
        number
    ];
    instanceBox?: [
        number,
        number,
        number,
        number,
        number,
        number
    ];
} & {
    id: string;
    parent: string;
    name?: string | undefined;
    matrixBits?: number[];
    transformBits?: number[];
    matrixAutoUpdate?: boolean | undefined;
    layers?: number | undefined;
    visible?: boolean | undefined;
    frustumCulled?: boolean | undefined;
    castShadow?: boolean | undefined;
    receiveShadow?: boolean | undefined;
    renderOrder?: number | undefined;
    until?: WorldSceneDistanceRowsInput;
    castFrom?: WorldSceneDistanceRowsInput;
} & {
    geometry: {
        library: string;
        model: string;
    };
    material: string;
    sphere: [
        number,
        number,
        number,
        number
    ];
    box?: [
        number,
        number,
        number,
        number,
        number,
        number
    ];
}) | ({
    kind: 'view';
    batch: string;
    start: number;
    count: number;
    sphere: [
        number,
        number,
        number,
        number
    ];
    box: [
        number,
        number,
        number,
        number,
        number,
        number
    ];
} & {
    id: string;
    parent: string;
    name?: string | undefined;
    matrixBits?: number[];
    transformBits?: number[];
    matrixAutoUpdate?: boolean | undefined;
    layers?: number | undefined;
    visible?: boolean | undefined;
    frustumCulled?: boolean | undefined;
    castShadow?: boolean | undefined;
    receiveShadow?: boolean | undefined;
    renderOrder?: number | undefined;
    until?: WorldSceneDistanceRowsInput;
    castFrom?: WorldSceneDistanceRowsInput;
}) | ({
    kind: 'cloud';
    material: string;
    seedWords: (number)[];
    sphere: [
        number,
        number,
        number,
        number
    ];
} & {
    id: string;
    parent: string;
    name?: string | undefined;
    matrixBits?: number[];
    transformBits?: number[];
    matrixAutoUpdate?: boolean | undefined;
    layers?: number | undefined;
    visible?: boolean | undefined;
    frustumCulled?: boolean | undefined;
    castShadow?: boolean | undefined;
    receiveShadow?: boolean | undefined;
    renderOrder?: number | undefined;
    until?: WorldSceneDistanceRowsInput;
    castFrom?: WorldSceneDistanceRowsInput;
}) | ({
    kind: 'light';
    color: number;
    intensity: number;
    distance: number;
    decay: number;
} & {
    id: string;
    parent: string;
    name?: string | undefined;
    matrixBits?: number[];
    transformBits?: number[];
    matrixAutoUpdate?: boolean | undefined;
    layers?: number | undefined;
    visible?: boolean | undefined;
    frustumCulled?: boolean | undefined;
    castShadow?: boolean | undefined;
    receiveShadow?: boolean | undefined;
    renderOrder?: number | undefined;
    until?: WorldSceneDistanceRowsInput;
    castFrom?: WorldSceneDistanceRowsInput;
});
export type WorldSceneWeldNode = ({
    kind: 'group';
} & {
    id: string;
    parent: string;
    name: string;
    matrixBits?: number[];
    transformBits?: number[];
    matrixAutoUpdate: boolean;
    layers: number;
    visible: boolean;
    frustumCulled: boolean;
    castShadow: boolean;
    receiveShadow: boolean;
    renderOrder: number;
    until?: WorldSceneDistanceRows;
    castFrom?: WorldSceneDistanceRows;
}) | ({
    kind: 'anchor';
} & {
    id: string;
    parent: string;
    name: string;
    matrixBits?: number[];
    transformBits?: number[];
    matrixAutoUpdate: boolean;
    layers: number;
    visible: boolean;
    frustumCulled: boolean;
    castShadow: boolean;
    receiveShadow: boolean;
    renderOrder: number;
    until?: WorldSceneDistanceRows;
    castFrom?: WorldSceneDistanceRows;
}) | ({
    kind: 'mesh';
} & {
    id: string;
    parent: string;
    name: string;
    matrixBits?: number[];
    transformBits?: number[];
    matrixAutoUpdate: boolean;
    layers: number;
    visible: boolean;
    frustumCulled: boolean;
    castShadow: boolean;
    receiveShadow: boolean;
    renderOrder: number;
    until?: WorldSceneDistanceRows;
    castFrom?: WorldSceneDistanceRows;
} & {
    geometry: {
        library: string;
        model: string;
    };
    material: string;
    sphere: [
        number,
        number,
        number,
        number
    ];
    box?: [
        number,
        number,
        number,
        number,
        number,
        number
    ];
}) | ({
    kind: 'batch';
} & {
    id: string;
    parent: string;
    name: string;
    matrixBits?: number[];
    transformBits?: number[];
    matrixAutoUpdate: boolean;
    layers: number;
    visible: boolean;
    frustumCulled: boolean;
    castShadow: boolean;
    receiveShadow: boolean;
    renderOrder: number;
    until?: WorldSceneDistanceRows;
    castFrom?: WorldSceneDistanceRows;
} & {
    geometry: {
        library: string;
        model: string;
    };
    material: string;
    sphere: [
        number,
        number,
        number,
        number
    ];
    box?: [
        number,
        number,
        number,
        number,
        number,
        number
    ];
}) | ({
    kind: 'instances';
    capacity: number;
    count: number;
    matrixWords: (number)[];
    instanceSphere: [
        number,
        number,
        number,
        number
    ];
    instanceBox?: [
        number,
        number,
        number,
        number,
        number,
        number
    ];
} & {
    id: string;
    parent: string;
    name: string;
    matrixBits?: number[];
    transformBits?: number[];
    matrixAutoUpdate: boolean;
    layers: number;
    visible: boolean;
    frustumCulled: boolean;
    castShadow: boolean;
    receiveShadow: boolean;
    renderOrder: number;
    until?: WorldSceneDistanceRows;
    castFrom?: WorldSceneDistanceRows;
} & {
    geometry: {
        library: string;
        model: string;
    };
    material: string;
    sphere: [
        number,
        number,
        number,
        number
    ];
    box?: [
        number,
        number,
        number,
        number,
        number,
        number
    ];
}) | ({
    kind: 'view';
    batch: string;
    start: number;
    count: number;
    sphere: [
        number,
        number,
        number,
        number
    ];
    box: [
        number,
        number,
        number,
        number,
        number,
        number
    ];
} & {
    id: string;
    parent: string;
    name: string;
    matrixBits?: number[];
    transformBits?: number[];
    matrixAutoUpdate: boolean;
    layers: number;
    visible: boolean;
    frustumCulled: boolean;
    castShadow: boolean;
    receiveShadow: boolean;
    renderOrder: number;
    until?: WorldSceneDistanceRows;
    castFrom?: WorldSceneDistanceRows;
}) | ({
    kind: 'cloud';
    material: string;
    seedWords: (number)[];
    sphere: [
        number,
        number,
        number,
        number
    ];
} & {
    id: string;
    parent: string;
    name: string;
    matrixBits?: number[];
    transformBits?: number[];
    matrixAutoUpdate: boolean;
    layers: number;
    visible: boolean;
    frustumCulled: boolean;
    castShadow: boolean;
    receiveShadow: boolean;
    renderOrder: number;
    until?: WorldSceneDistanceRows;
    castFrom?: WorldSceneDistanceRows;
}) | ({
    kind: 'light';
    color: number;
    intensity: number;
    distance: number;
    decay: number;
} & {
    id: string;
    parent: string;
    name: string;
    matrixBits?: number[];
    transformBits?: number[];
    matrixAutoUpdate: boolean;
    layers: number;
    visible: boolean;
    frustumCulled: boolean;
    castShadow: boolean;
    receiveShadow: boolean;
    renderOrder: number;
    until?: WorldSceneDistanceRows;
    castFrom?: WorldSceneDistanceRows;
});
interface WorldSceneWeldMaterialRowsInputFields {
    id: string;
    kind: 'standard' | 'basic';
    source?: {
        material: string;
        maps: ('map' | 'normalMap' | 'roughnessMap' | 'metalnessMap' | 'aoMap')[];
    };
    properties: v.InferInput<typeof WorldSceneSurfaceSchema.entries.properties>;
    sky?: boolean | undefined;
    blending?: 0 | 1 | 2 | 3 | 4 | 5;
    fog?: boolean;
}
export type WorldSceneWeldMaterialRowsInput = { [Key in keyof WorldSceneWeldMaterialRowsInputFields]: WorldSceneWeldMaterialRowsInputFields[Key] };
interface WorldSceneWeldMaterialRowsFields {
    id: string;
    kind: 'standard' | 'basic';
    source?: {
        material: string;
        maps: ('map' | 'normalMap' | 'roughnessMap' | 'metalnessMap' | 'aoMap')[];
    };
    properties: v.InferOutput<typeof WorldSceneSurfaceSchema.entries.properties>;
    sky: boolean;
    blending?: 0 | 1 | 2 | 3 | 4 | 5;
    fog?: boolean;
}
export type WorldSceneWeldMaterialRows = { [Key in keyof WorldSceneWeldMaterialRowsFields]: WorldSceneWeldMaterialRowsFields[Key] };
export type WorldSceneWeldInput = unknown;
interface WorldSceneWeldFields {
    id: string;
    root: string;
    result?: string;
    nodes: (WorldSceneWeldNode)[];
    materials: (WorldSceneWeldMaterialRows)[];
    culls: ({
        roots: (string)[];
        origins: (number)[];
        units: (number)[];
        details: (WorldSceneDistanceRows)[];
        hosted: ({
            meshes: (string)[];
            lists: ({
                unit: number;
                matrixWords: (number)[];
            })[];
        })[];
    })[];
    placements: (string)[];
    sets: ({
        id: string;
        name: string;
        file: string;
        place?: string;
        members: (string)[];
    })[];
    resources: (({
        id: string;
        kind: 'geometry';
        source: {
            library: string;
            model: string;
        };
    }) | ({
        id: string;
        kind: 'seeds';
        words: (number)[];
    }))[];
}
export type WorldSceneWeld = { [Key in keyof WorldSceneWeldFields]: WorldSceneWeldFields[Key] };
export type WorldSceneWeldSourceRowsInput = WorldSceneWeldSourceRows;
interface WorldSceneWeldSourceRowsFields {
    id: string;
    late?: {
        at: [number, number];
    };
    file: ((string) | ({
        phone: string;
        desktop: string;
    })) | ({
        knob: string;
        false: (string) | ({
            phone: string;
            desktop: string;
        });
        true: (string) | ({
            phone: string;
            desktop: string;
        });
    });
}
export type WorldSceneWeldSourceRows = { [Key in keyof WorldSceneWeldSourceRowsFields]: WorldSceneWeldSourceRowsFields[Key] };
