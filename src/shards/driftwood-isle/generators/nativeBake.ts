import { authorFormatSchema, defineNamedRows, type NamedRowValue , type NamedRows } from '@wildshard/sdk/formatJsonSchema';
import DRIFTWOOD_TERRAIN from '../data/terrainBindings.json' with { type: 'json' };

const DRIFTWOOD_GROUND_RES = DRIFTWOOD_TERRAIN.res;
const nativeBodySchema: ReturnType<typeof authorFormatSchema<'nativePhysics.nativeBodySchema'>> = authorFormatSchema('nativePhysics.nativeBodySchema');
const nativeColliderRecordSchema: ReturnType<typeof authorFormatSchema<'nativePhysics.nativeColliderRecordSchema'>> = authorFormatSchema('nativePhysics.nativeColliderRecordSchema');
const nativeGroundRecordSchema: ReturnType<typeof authorFormatSchema<'nativePhysics.nativeGroundRecordSchema'>> = authorFormatSchema('nativePhysics.nativeGroundRecordSchema');
const finite = ({ ...({ kind: "number" } as const), finite: true } as const), xyz = ({ kind: "object", mode: "strict", entries: { x: finite, y: finite, z: finite } } as const), xz = ({ kind: "object", mode: "strict", entries: { x: finite, z: finite } } as const);
/** One baked native simulation spec, strictly: an unknown or missing field refuses the bake rather than defaulting. */
const BakedSpec: ReturnType<typeof nativeBodySchema> = nativeBodySchema('axis');
const Pose = ({ kind: "object", mode: "strict", entries: { joints: ({ ...({ kind: "array", item: ({ kind: "object", mode: "strict", entries: { name: ({ ...({ kind: "string" } as const), min: 1, max: 64 } as const), parent: ({ ...finite, integer: true, min: -1, max: 31 } as const),
                        position: ({ kind: "tuple", items: [finite, finite, finite] } as const), order: ({ kind: "picklist", values: ['XYZ', 'YXZ', 'ZXY', 'ZYX', 'YZX', 'XZY'] } as const), scale: ({ kind: "tuple", items: [finite, finite, finite] } as const) } } as const) } as const), min: 1, max: 32 } as const), custom: ({ kind: "boolean" } as const),
        gait: ({ kind: "exact-optional", item: ({ kind: "object", mode: "strict", entries: { trot: finite, gallop: finite } } as const) } as const), pose: ({ kind: "exact-optional", item: ({ kind: "object", mode: "strict", entries: { grazeNeck: finite, gallopTail: finite } } as const) } as const) } } as const);
const Actor = ({ kind: "object", mode: "strict", entries: { id: ({ kind: "string" } as const), kind: ({ kind: "string" } as const), variant: ({ kind: "string" } as const), herd: finite, spec: BakedSpec, pose: Pose, seed: finite, scale: finite, at: ({ kind: "nullable", item: xz } as const) } } as const);
const Solid: ReturnType<typeof nativeColliderRecordSchema<readonly [
    1,
    2,
    9
]>> = nativeColliderRecordSchema([1, 2, 9], 'tagged', true);
const Bake: NamedRows<{ ground: NamedRowValue<ReturnType<typeof nativeGroundRecordSchema>>; version: 1; solids: NamedRowValue<typeof Solid>[]; actors: { variant: string; at: { x: number; z: number; } | null; kind: string; id: string; herd: number; spec: NamedRowValue<typeof BakedSpec>; pose: { joints: { name: string; parent: number; position: [number, number, number]; order: "XYZ" | "YXZ" | "ZXY" | "ZYX" | "YZX" | "XZY"; scale: [number, number, number]; }[]; custom: boolean; pose?: { grazeNeck: number; gallopTail: number; }; gait?: { trot: number; gallop: number; }; }; scale: number; seed: number; }[]; herds: { kind: string; members: string[]; }[]; habitat: { perches: { x: number; z: number; y: number; }[]; perchBases: { x: number; z: number; y: number; }[]; crabSites: { x: number; z: number; }[]; practice: string; hold: { x: number; z: number; r: number; guardR: number; step: number; floor: (number | null)[]; }; }; captain: { spec: NamedRowValue<typeof BakedSpec>; pose: { joints: { name: string; parent: number; position: [number, number, number]; order: "XYZ" | "YXZ" | "ZXY" | "ZYX" | "YZX" | "XZY"; scale: [number, number, number]; }[]; custom: boolean; pose?: { grazeNeck: number; gallopTail: number; }; gait?: { trot: number; gallop: number; }; }; pool: { x: number; z: number; yaw: number; }; arena: number; }; }, { ground: unknown; version: 1; solids: unknown[]; actors: { variant: string; at: { x: number; z: number; } | null; kind: string; id: string; herd: number; spec: unknown; pose: { joints: { name: string; parent: number; position: [number, number, number]; order: "XYZ" | "YXZ" | "ZXY" | "ZYX" | "YZX" | "XZY"; scale: [number, number, number]; }[]; custom: boolean; pose?: { grazeNeck: number; gallopTail: number; }; gait?: { trot: number; gallop: number; }; }; scale: number; seed: number; }[]; herds: { kind: string; members: string[]; }[]; habitat: { perches: { x: number; z: number; y: number; }[]; perchBases: { x: number; z: number; y: number; }[]; crabSites: { x: number; z: number; }[]; practice: string; hold: { x: number; z: number; r: number; guardR: number; step: number; floor: (number | null)[]; }; }; captain: { spec: unknown; pose: { joints: { name: string; parent: number; position: [number, number, number]; order: "XYZ" | "YXZ" | "ZXY" | "ZYX" | "YZX" | "XZY"; scale: [number, number, number]; }[]; custom: boolean; pose?: { grazeNeck: number; gallopTail: number; }; gait?: { trot: number; gallop: number; }; }; pool: { x: number; z: number; yaw: number; }; arena: number; }; }>['schema'] = defineNamedRows(({ kind: "object", mode: "strip", entries: { version: ({ kind: "literal", value: 1 } as const),
        ground: nativeGroundRecordSchema(DRIFTWOOD_GROUND_RES, true),
        solids: ({ kind: "array", item: Solid } as const), actors: ({ kind: "array", item: Actor } as const), herds: ({ kind: "array", item: ({ kind: "object", mode: "strict", entries: { kind: ({ kind: "string" } as const), members: ({ kind: "array", item: ({ kind: "string" } as const) } as const) } } as const) } as const),
        habitat: ({ kind: "object", mode: "strip", entries: { perches: ({ kind: "array", item: xyz } as const), perchBases: ({ kind: "array", item: xyz } as const), crabSites: ({ kind: "array", item: xz } as const), practice: ({ kind: "string" } as const),
                hold: ({ kind: "object", mode: "strict", entries: { x: finite, z: finite, r: finite, guardR: finite, step: finite, floor: ({ kind: "array", item: ({ kind: "nullable", item: finite } as const) } as const) } } as const) } } as const),
        // the finale's captain after `used:altar`: his native spec, his pool (the spawn point and yaw) and his arena radius
        captain: ({ kind: "object", mode: "strict", entries: { spec: BakedSpec, pose: Pose, pool: ({ kind: "object", mode: "strict", entries: { x: finite, z: finite, yaw: finite } } as const), arena: finite } } as const) } } as const)).schema;
/** Build-time admission and joins; the native assembly only decodes owned byte channels. */
export function driftwoodNativeRows(input: unknown): {
    physics: NamedRowValue<typeof Bake>;
    nativeSpecs: [
        string,
        NamedRowValue<typeof BakedSpec>
    ][];
} {
    const physics = defineNamedRows(Bake).parse(input);
    const ground = physics.ground;
    if (typeof ground.heights === 'string')
        throw new Error('Driftwood native authoring requires a named floor file');
    if (ground.scale.x !== DRIFTWOOD_TERRAIN.size || ground.scale.z !== DRIFTWOOD_TERRAIN.size || ground.scale.y !== 1)
        throw new Error('Divergent native ground lattice');
    for (const actor of physics.actors)
        if (actor.spec.kind !== actor.kind || actor.spec.variant !== actor.variant)
            throw new Error(`Divergent native actor ${actor.id}`);
    if (physics.captain.spec.kind !== 'captain' || physics.captain.spec.variant !== 'captain')
        throw new Error('Divergent baked Driftwood captain spec');
    const hold = physics.habitat.hold, side = Math.round(2 * hold.guardR / hold.step) + 1;
    if (hold.floor.length !== side * side)
        throw new Error('Driftwood baked hold lattice is not square');
    const specs = new Map<string, typeof physics.captain.spec>();
    for (const actor of physics.actors) {
        const key = `${actor.kind}.${actor.variant}`, known = specs.get(key);
        if (known !== undefined && JSON.stringify(known) !== JSON.stringify(actor.spec))
            throw new Error(`Divergent native Driftwood spec ${key}`);
        specs.set(key, actor.spec);
    }
    specs.set('captain.captain', physics.captain.spec);
    return { physics, nativeSpecs: [...specs] };
}
