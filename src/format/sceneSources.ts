import * as v from 'valibot';
import type { GraphNode, GraphRef } from './materialGraph.ts';
import type { SurfaceLook } from './surfaceLooks.ts';
import { isJsonData } from './json.ts';
import { ClientChannelsSchema, HeldMeleePhaseSchema, PrivateSceneSchema, type ClientChannelProgram, type HeldMeleePhaseRows, type PrivateScene } from './clientChannels.ts';
import { SceneDrawsSchema, type SceneDrawsRows } from './sceneDraws.ts';
import { ItemEquipmentSchema, type ItemEquipmentRows } from './items.ts';
import { SpecimenModelMetadataSchema } from './specimenCatalogue.ts';
import { ColourFunctionSchema, type ColourFunctionRow } from './colourFunction.ts';

const text = v.pipe(v.string(), v.maxLength(4096));
const finite = v.pipe(v.number(), v.finite());
const natural = v.pipe(finite, v.integer(), v.minValue(0));
const triple = v.tuple([finite, finite, finite]), pair = v.tuple([finite, finite]);
const quaternion = v.strictObject({ x: finite, y: finite, z: finite, w: finite });
const list = <T extends v.GenericSchema>(schema: T, max: number) => v.pipe(v.array(schema), v.maxLength(max));
const strings = v.record(text, text);
const inputs = v.strictObject({ dusk: v.exactOptional(text), lights: v.exactOptional(text) });
const surface = v.picklist(['sand', 'wetSand', 'grass', 'rock', 'planks', 'stone', 'water', 'wood', 'metal', 'flesh', 'shell', 'ground', 'edge', 'felt', 'earth']);
/** The five native surface decorators, without material callbacks. */
const SceneSourceSurfaceSchema: v.GenericSchema<unknown, SurfaceLook> = v.variant('kind', [
    v.strictObject({ kind: v.literal('firelight'), colour: triple, reach: finite, falloff: finite, gain: finite }),
    v.strictObject({ kind: v.literal('viewerLight'), gain: triple, facing: pair, dusk: finite, sheen: finite, sheenColour: triple, sheenPower: finite, sheenDamp: finite }),
    v.strictObject({ kind: v.literal('leather'), crease: triple, sharpness: finite, grain: finite, mix: pair, albedo: pair, depth: finite }),
    v.strictObject({ kind: v.literal('stoneBand'), below: pair, rows: finite, wave: pair, perRow: pair, mortar: pair, aspect: finite,
        dark: triple, light: triple, speckle: pair, speckleScale: finite, mortarColour: triple }),
    v.strictObject({ kind: v.literal('desaturate'), amount: finite }),
]);
const surfaces = v.array(SceneSourceSurfaceSchema);
const collider = v.strictObject({ kind: text, x: finite, y: finite, z: finite, surface: text,
    hx: v.exactOptional(finite), hy: v.exactOptional(finite), hz: v.exactOptional(finite), yaw: v.exactOptional(finite),
    rot: v.exactOptional(quaternion), points: v.exactOptional(v.array(finite)) });
// KindExtra is the author's existing primitive metadata contract. Surface rows
// are explicitly typed; there is no opaque whole-row or whole-document fallback.
const kind = v.objectWithRest({ name: text, count: natural, color: finite, roughness: finite, metalness: finite, flat: v.boolean(),
    emissive: finite, emissiveIntensity: finite, vertexColors: v.boolean(), doubleSided: v.boolean(),
    mesh: v.exactOptional(v.boolean()), unlit: v.exactOptional(v.boolean()),
    colorR: v.exactOptional(finite), colorG: v.exactOptional(finite), colorB: v.exactOptional(finite),
    emissiveR: v.exactOptional(finite), emissiveG: v.exactOptional(finite), emissiveB: v.exactOptional(finite),
    look: v.exactOptional(text), surface: v.exactOptional(surfaces),
}, v.union([text, finite, v.boolean()]));
const box = v.strictObject({ kind: v.literal('box'), x: finite, y: finite, z: finite, hx: finite, hy: finite, hz: finite,
    yaw: v.exactOptional(finite), rot: v.exactOptional(quaternion), surface: v.exactOptional(surface) });
const piece = v.strictObject({ kinds: v.array(kind), colliders: v.array(collider), glb: v.exactOptional(text),
    tints: v.exactOptional(v.record(text, v.array(finite))),
    hulls: v.exactOptional(v.array(v.strictObject({ id: text, x: finite, y: finite, z: finite, points: v.array(finite) }))),
    rigs: v.exactOptional(v.array(v.strictObject({ tops: v.array(triple), local: v.array(triple) }))),
    rails: v.exactOptional(v.array(v.array(v.strictObject({ a: finite, box })))), discs: v.exactOptional(v.array(triple)),
    anchors: v.exactOptional(v.record(text, v.union([finite, triple]))), tip: v.exactOptional(triple), along: v.exactOptional(finite),
    braziers: v.exactOptional(v.array(v.strictObject({ y: finite, colliders: v.array(collider) }))),
});
const worldPiece = v.strictObject({ id: text, name: text, category: v.picklist(['ground', 'buildings', 'nature', 'creatures', 'people', 'gear', 'props']), file: text,
    surface: v.exactOptional(surface), mode: v.exactOptional(v.picklist(['foot', 'board', 'swim', 'ride'])), baked: v.exactOptional(text),
    at: v.exactOptional(triple), yaw: v.exactOptional(finite), node: v.exactOptional(text) });
const byteResource = v.strictObject({ id: text, url: text, compression: v.literal('deflate'), fault: v.strictObject({ level: v.picklist(['warn', 'error']), message: text }) });
/** Complete baked source, including author GLB, hull, rig, rail and anchor data.
 * Native resource decoding and collider ownership remain with bakedMeshWorld. */
export const SceneBakeSourceSchema: v.GenericSchema<unknown, SceneBakeSourceDocument> = v.pipe(v.unknown(), v.check(isJsonData, 'Scene source requires plain JSON'), v.strictObject({ rows: v.pipe(v.record(text, piece), v.maxEntries(128)), urls: strings,
    attributes: v.exactOptional(strings), resources: v.exactOptional(v.array(byteResource)),
    placements: v.exactOptional(v.strictObject({ rows: v.array(worldPiece), colliders: v.exactOptional(v.array(v.strictObject({ id: text, colliders: v.array(collider), name: v.exactOptional(text), category: v.exactOptional(worldPiece.entries.category), file: v.exactOptional(text), active: v.exactOptional(v.boolean()), surface: v.exactOptional(surface), mode: worldPiece.entries.mode }))) })),
    materialLibrary: v.exactOptional(text), inputs: v.exactOptional(inputs) }));
export interface SceneBakeSourceDocument {
    rows: Record<string, SourcePiece>;
    urls: Record<string, string>;
    attributes?: Record<string, string>;
    resources?: SourceByteResource[];
    placements?: {
        rows: SourceWorldPiece[];
        colliders?: {
            id: string;
            colliders: SourceCollider[];
            name?: string;
            category?: SourceWorldPiece['category'];
            file?: string;
            active?: boolean;
            surface?: string;
        }[];
    };
    materialLibrary?: string;
    inputs?: {
        dusk?: string;
        lights?: string;
    };
}
const when = v.strictObject({ alive: v.exactOptional(v.boolean()), attacking: v.exactOptional(v.boolean()), deathAbove: v.exactOptional(finite),
    mem: v.exactOptional(v.strictObject({ key: text, above: v.exactOptional(finite), atLeast: v.exactOptional(finite) })) });
interface ClipWhen {
    alive?: boolean;
    attacking?: boolean;
    deathAbove?: number;
    mem?: {
        key: string;
        above?: number;
        atLeast?: number;
    };
}
interface ClipCase {
    when?: ClipWhen;
    sum: ClipTerm[];
}
type ClipTerm = number | {
    when?: ClipWhen;
    of: ClipFactor[];
};
type ClipFactor = number | {
    wave: 't' | 'phase';
    rate: number;
    offset?: number;
    abs?: boolean;
} | {
    clock: 't' | 'phase';
} | {
    mem: string;
} | {
    bounded: ClipTerm[];
    min?: number;
    max?: number;
    divide?: number;
} | {
    attack: true;
    rate?: number;
    max?: number;
} | {
    gait: number;
    run?: number;
    fast?: number;
    slow?: number;
} | {
    death: true;
} | {
    living: true;
};
const factorSchema: v.GenericSchema<unknown, ClipFactor> = v.union([finite,
        v.strictObject({ wave: v.picklist(['t', 'phase']), rate: finite, offset: v.exactOptional(finite), abs: v.exactOptional(v.boolean()) }),
        v.strictObject({ clock: v.picklist(['t', 'phase']) }), v.strictObject({ mem: text }),
        v.strictObject({ bounded: v.array(v.lazy(sourceClipTerm)), min: v.exactOptional(finite), max: v.exactOptional(finite), divide: v.exactOptional(finite) }),
        v.strictObject({ attack: v.literal(true), rate: v.exactOptional(finite), max: v.exactOptional(finite) }),
        v.strictObject({ gait: finite, run: v.exactOptional(finite), fast: v.exactOptional(finite), slow: v.exactOptional(finite) }),
        v.strictObject({ death: v.literal(true) }), v.strictObject({ living: v.literal(true) }),
    ]);
const termSchema: v.GenericSchema<unknown, ClipTerm> = v.union([finite, v.strictObject({ when: v.exactOptional(when), of: v.array(v.lazy(sourceClipFactor)) })]);
function sourceClipFactor(): v.GenericSchema<unknown, ClipFactor> { return factorSchema; }
function sourceClipTerm(): v.GenericSchema<unknown, ClipTerm> { return termSchema; }
const term: v.GenericSchema<unknown, ClipTerm> = v.lazy(sourceClipTerm);
const cases: v.GenericSchema<unknown, ClipCase[]> = v.array(v.strictObject({ when: v.exactOptional(when), sum: v.array(term) }));
const clips = v.array(v.union([
    v.strictObject({ bone: text, channel: v.picklist(['rotation.x', 'rotation.y', 'rotation.z', 'position.x', 'position.y', 'position.z', 'scale']), bind: v.exactOptional(text), cases }),
    v.strictObject({ mem: text, ease: finite, cases }),
]));
const dims = v.strictObject({ bodyY: finite, bodyHalfLen: finite, bodyRadius: finite, headRadius: finite, legLen: finite, halfWidth: finite });
const standIn = v.strictObject({ bones: v.array(v.strictObject({ name: text, parent: v.nullable(text), pos: triple })), dims });
const clipName = v.pipe(text, v.regex(/^(?:idle|walk|run|attack|hit|die|turn|swim|fly)(?:\..*)?$/u));
// The complete pure-colour graph wire has a structural grammar and still
// runs ColourFunctionSchema's original graph/type/budget admission. Its native
// raw transform is not replaced by an opaque JSON-schema conversion allowance.
const graphLiteral = v.union([finite, v.array(finite)]);
const graphRef: v.GenericSchema<unknown, GraphRef> = v.union([text, graphLiteral]);
const graphNode: v.GenericSchema<unknown, GraphNode> = v.lazy(sourceGraphNode);
const graphNodeBody: v.GenericSchema<unknown, GraphNode> = v.strictObject({ op: text, in: v.exactOptional(v.array(graphRef)),
    value: v.exactOptional(graphLiteral), param: v.exactOptional(text), mask: v.exactOptional(text), count: v.exactOptional(finite),
    body: v.exactOptional(v.strictObject({ nodes: v.record(text, graphNode), out: graphRef })), name: v.exactOptional(text),
    type: v.exactOptional(v.picklist(['float', 'vec2', 'vec3', 'vec4', 'bool'])), default: v.exactOptional(graphLiteral),
    interpolation: v.exactOptional(v.literal('flat')) });
function sourceGraphNode(): v.GenericSchema<unknown, GraphNode> { return graphNodeBody; }
const colourSource: v.GenericSchema<unknown, ColourFunctionRow> = v.pipe(v.strictObject({ name: text, input: text, locals: v.array(text),
    layout: v.picklist(['compact', 'lines', 'spaced']), graph: v.strictObject({ version: v.literal(1), kind: v.literal('material'), model: v.literal('unlit'),
        budget: v.exactOptional(v.strictObject({ nodes: finite, samplers: finite, instructions: finite })), primitive: v.exactOptional(v.picklist(['mesh', 'points'])),
        doubleSided: v.exactOptional(v.boolean()), flipBackfaceNormals: v.exactOptional(v.boolean()), toonCaustics: v.exactOptional(v.boolean()), flatShading: v.exactOptional(v.boolean()),
        params: v.record(text, v.strictObject({ type: v.literal('vec3'), value: triple, min: v.exactOptional(finite), max: v.exactOptional(finite), role: v.exactOptional(v.picklist(['colour', 'data', 'lent'])) })),
        arrays: v.exactOptional(v.strictObject({})), nodes: v.record(text, graphNode), stages: v.strictObject({ surface: v.strictObject({ colour: graphRef }) }),
    }) }), v.check(value => v.safeParse(ColourFunctionSchema, value).success, 'Original native colour graph admission'));
const rigs = v.strictObject({ bodies: v.strictObject({ creatures: list(text, 1024), urls: strings, standIns: v.record(text, standIn), fault: text,
        releaseDecoded: v.exactOptional(v.boolean()) }), looks: v.array(v.strictObject({ body: text, look: v.strictObject({ id: text, species: text, kind: text,
            dims: v.exactOptional(dims), skeleton: text, sockets: v.array(text), clipNames: v.array(clipName), colourTransform: v.exactOptional(v.strictObject({ id: text, row: colourSource })) }), clips })) });
const geometryPool = v.strictObject({ url: text, parts: v.array(text), native: v.exactOptional(v.strictObject({ first: v.exactOptional(v.boolean()), requireIndex: v.boolean(),
        white: v.exactOptional(v.boolean()), disposeSource: v.exactOptional(v.boolean()) })),
    channels: v.exactOptional(v.array(v.strictObject({ name: text, source: text, width: natural, parts: v.exactOptional(v.array(text)) }))),
    atlases: v.exactOptional(v.array(v.strictObject({ id: text, part: text, anisotropy: finite, refresh: v.exactOptional(v.boolean()) }))) });
const hdLook = v.strictObject({ color: v.exactOptional(triple), roughness: v.exactOptional(finite), fog: v.exactOptional(v.boolean()),
    userData: v.exactOptional(v.record(text, v.boolean())), surface: v.exactOptional(surfaces) });
const painted = v.strictObject({ name: text, url: text, geometry: text, pivots: v.exactOptional(v.array(v.nullable(text))), releaseImage: v.exactOptional(v.boolean()) });
const modelLibrary = v.strictObject({ meshes: list(text, 256), preparedMeshes: v.exactOptional(v.array(text)), meshUrls: strings,
    hd: list(text, 256), hdUrls: strings, hdLooks: v.record(text, hdLook), aoFloor: finite,
    geometryPools: v.exactOptional(v.array(geometryPool)), paintedModels: v.exactOptional(v.array(painted)), rigs: v.exactOptional(rigs),
    rigLoad: v.exactOptional(v.literal('manual')), mappedFallback: v.exactOptional(v.strictObject({ roughness: finite, metalness: finite })) });
const metadata = v.strictObject({ id: text, name: text, file: text, category: SpecimenModelMetadataSchema.entries.category,
    pipeline: SpecimenModelMetadataSchema.entries.pipeline, rig: v.exactOptional(v.strictObject({ clips: v.array(text), species: v.exactOptional(text) })) });
const definition = v.strictObject({ model: metadata, builder: text, show: v.exactOptional(v.array(text)), position: v.exactOptional(triple), subtractY: v.exactOptional(text) });
const fit = v.strictObject({ size: finite, by: v.picklist(['span', 'height']), floor: v.exactOptional(finite), yaw: v.exactOptional(finite), centre: v.exactOptional(v.literal('base')) });
const ref = v.strictObject({ library: text, model: text });
const resources = v.strictObject({ geometry: v.array(v.strictObject({ id: text, source: ref, piece: v.exactOptional(text), index: v.exactOptional(v.picklist(['preserve', 'array', 'identity'])) })),
    objects: v.exactOptional(v.array(v.strictObject({ id: text, source: ref, fit }))),
    textures: v.exactOptional(v.array(v.strictObject({ id: text, source: ref, resource: v.exactOptional(text), bytes: v.exactOptional(natural) }))),
    decorators: v.exactOptional(v.array(v.strictObject({ id: text, rows: surfaces }))),
    repeats: v.exactOptional(v.array(v.strictObject({ id: text, value: pair }))) });
const recipe = v.strictObject({ equipment: ItemEquipmentSchema, phases: HeldMeleePhaseSchema, playback: v.record(text, ClientChannelsSchema), scene: PrivateSceneSchema,
    tip: v.exactOptional(triple), restingGroup: v.exactOptional(text), caught: v.exactOptional(v.strictObject({ row: PrivateSceneSchema, part: text })) });
const held = v.strictObject({ item: text, definition, recipe, resources,
    attachments: v.exactOptional(v.array(v.strictObject({ id: text, row: PrivateSceneSchema, parent: text, resources }))) });
const npc = v.strictObject({ npc: text, definition, model: v.strictObject({ kind: v.picklist(['mesh', 'pivots']), id: text, material: v.exactOptional(text) }),
    library: text, materialLibrary: v.exactOptional(text) });
const scene = v.strictObject({ part: text, step: text, materialLibrary: v.exactOptional(text), definition,
    effects: v.exactOptional(v.array(v.strictObject({ part: text, draws: SceneDrawsSchema }))) });
const material = v.strictObject({ color: v.exactOptional(v.union([finite, text])), flatShading: v.exactOptional(v.boolean()), roughness: v.exactOptional(finite),
    metalness: v.exactOptional(finite), vertexColors: v.exactOptional(v.boolean()), side: v.exactOptional(v.picklist([0, 1, 2])),
    transparent: v.exactOptional(v.boolean()), opacity: v.exactOptional(finite), depthWrite: v.exactOptional(v.boolean()), fog: v.exactOptional(v.boolean()),
    emissive: v.exactOptional(v.union([finite, text])), emissiveIntensity: v.exactOptional(finite), envMapIntensity: v.exactOptional(finite) });
const specimen = v.strictObject({ model: metadata, body: text, specimen: v.strictObject({ parts: v.picklist(['all', 'first']), material, scale: v.exactOptional(finite) }) });
/** Full model/rig/held/NPC/scene source envelope. Validation never allocates a
 * loader, geometry, texture, clock or owner and never rewrites the wire value. */
export const SceneModelSourceSchema: v.GenericSchema<unknown, SceneModelSourceDocument> = v.pipe(v.unknown(), v.check(isJsonData, 'Scene source requires plain JSON'), v.strictObject({ rows: modelLibrary, inputs: v.exactOptional(inputs), specimens: v.exactOptional(v.array(specimen)),
    held: v.exactOptional(v.array(held)), npcs: v.exactOptional(v.array(npc)), scenes: v.exactOptional(v.array(scene)) }));
export interface SceneModelSourceDocument {
    rows: SourceModelLibrary;
    inputs?: {
        dusk?: string;
        lights?: string;
    };
    specimens?: SourceSpecimen[];
    held?: SourceHeld[];
    npcs?: SourceNpc[];
    scenes?: SourceScene[];
}
/** Independent wire data shapes; schemas above remain their admission authority. */
interface SourceCollider {
    kind: string;
    x: number;
    y: number;
    z: number;
    surface: string;
    hx?: number;
    hy?: number;
    hz?: number;
    yaw?: number;
    rot?: {
        x: number;
        y: number;
        z: number;
        w: number;
    };
    points?: number[];
}
interface SourcePiece {
    kinds: ({
        name: string;
        count: number;
        color: number;
        roughness: number;
        metalness: number;
        flat: boolean;
        emissive: number;
        emissiveIntensity: number;
        vertexColors: boolean;
        doubleSided: boolean;
        mesh?: boolean;
        unlit?: boolean;
        colorR?: number;
        colorG?: number;
        colorB?: number;
        emissiveR?: number;
        emissiveG?: number;
        emissiveB?: number;
        look?: string;
        surface?: SurfaceLook[];
    } & Record<string, string | number | boolean>)[];
    colliders: {
        kind: string;
        x: number;
        y: number;
        z: number;
        surface: string;
        hx?: number;
        hy?: number;
        hz?: number;
        yaw?: number;
        rot?: {
            x: number;
            y: number;
            z: number;
            w: number;
        };
        points?: number[];
    }[];
    glb?: string;
    tints?: Record<string, number[]>;
    hulls?: {
        id: string;
        x: number;
        y: number;
        z: number;
        points: number[];
    }[];
    rigs?: {
        tops: [
            number,
            number,
            number
        ][];
        local: [
            number,
            number,
            number
        ][];
    }[];
    rails?: {
        a: number;
        box: {
            kind: "box";
            x: number;
            y: number;
            z: number;
            hx: number;
            hy: number;
            hz: number;
            yaw?: number;
            rot?: {
                x: number;
                y: number;
                z: number;
                w: number;
            };
            surface?: "sand" | "wetSand" | "grass" | "rock" | "planks" | "stone" | "water" | "wood" | "metal" | "flesh" | "shell" | "ground" | "edge" | "felt" | "earth";
        };
    }[][];
    discs?: [
        number,
        number,
        number
    ][];
    anchors?: Record<string, number | [
        number,
        number,
        number
    ]>;
    tip?: [
        number,
        number,
        number
    ];
    along?: number;
    braziers?: {
        y: number;
        colliders: {
            kind: string;
            x: number;
            y: number;
            z: number;
            surface: string;
            hx?: number;
            hy?: number;
            hz?: number;
            yaw?: number;
            rot?: {
                x: number;
                y: number;
                z: number;
                w: number;
            };
            points?: number[];
        }[];
        name?: string;
    }[];
}
interface SourceWorldPiece {
    id: string;
    name: string;
    category: "ground" | "buildings" | "nature" | "creatures" | "people" | "gear" | "props";
    file: string;
    surface?: "sand" | "wetSand" | "grass" | "rock" | "planks" | "stone" | "water" | "wood" | "metal" | "flesh" | "shell" | "ground" | "edge" | "felt" | "earth";
    mode?: "foot" | "board" | "swim" | "ride";
    baked?: string;
    at?: [
        number,
        number,
        number
    ];
    yaw?: number;
    node?: string;
}
interface SourceByteResource {
    id: string;
    url: string;
    compression: "deflate";
    fault: {
        level: "warn" | "error";
        message: string;
    };
}
interface SourceModelLibrary {
    meshes: string[];
    preparedMeshes?: string[];
    meshUrls: Record<string, string>;
    hd: string[];
    hdUrls: Record<string, string>;
    hdLooks: Record<string, {
        color?: [
            number,
            number,
            number
        ];
        roughness?: number;
        fog?: boolean;
        userData?: Record<string, boolean>;
        surface?: SurfaceLook[];
    }>;
    aoFloor: number;
    geometryPools?: {
        url: string;
        parts: string[];
        native?: {
            first?: boolean;
            requireIndex: boolean;
            white?: boolean;
            disposeSource?: boolean;
        };
        channels?: {
            name: string;
            source: string;
            width: number;
            parts?: string[];
        }[];
        atlases?: {
            id: string;
            part: string;
            anisotropy: number;
            refresh?: boolean;
        }[];
    }[];
    paintedModels?: {
        name: string;
        url: string;
        geometry: string;
        pivots?: (string | null)[];
        releaseImage?: boolean;
    }[];
    rigs?: {
        bodies: {
            creatures: string[];
            urls: Record<string, string>;
            standIns: Record<string, {
                bones: {
                    name: string;
                    parent: string | null;
                    pos: [
                        number,
                        number,
                        number
                    ];
                }[];
                dims: {
                    bodyY: number;
                    bodyHalfLen: number;
                    bodyRadius: number;
                    headRadius: number;
                    legLen: number;
                    halfWidth: number;
                };
            }>;
            fault: string;
            releaseDecoded?: boolean;
        };
        looks: {
            body: string;
            look: {
                id: string;
                species: string;
                kind: string;
                dims?: {
                    bodyY: number;
                    bodyHalfLen: number;
                    bodyRadius: number;
                    headRadius: number;
                    legLen: number;
                    halfWidth: number;
                };
                skeleton: string;
                sockets: string[];
                clipNames: string[];
                colourTransform?: {
                    id: string;
                    row: ColourFunctionRow;
                };
            };
            clips: ({
                bone: string;
                channel: "rotation.x" | "rotation.y" | "rotation.z" | "position.x" | "position.y" | "position.z" | "scale";
                bind?: string;
                cases: ClipCase[];
            } | {
                mem: string;
                ease: number;
                cases: ClipCase[];
            })[];
        }[];
    };
    rigLoad?: "manual";
    mappedFallback?: {
        roughness: number;
        metalness: number;
    };
}
interface SourceHeld {
    item: string;
    definition: {
        model: {
            id: string;
            name: string;
            file: string;
            category: "buildings" | "nature" | "creatures" | "people" | "gear" | "props";
            pipeline: "code" | "blender" | "trellis" | "hunyuan" | "cc0" | ("code" | "blender" | "trellis" | "hunyuan" | "cc0")[];
            rig?: {
                clips: string[];
                species?: string;
            };
        };
        builder: string;
        show?: string[];
        position?: [
            number,
            number,
            number
        ];
        subtractY?: string;
    };
    recipe: {
        equipment: ItemEquipmentRows;
        phases: HeldMeleePhaseRows;
        playback: Record<string, ClientChannelProgram[]>;
        scene: PrivateScene;
        tip?: [
            number,
            number,
            number
        ];
        restingGroup?: string;
        caught?: {
            row: PrivateScene;
            part: string;
        };
    };
    resources: {
        geometry: {
            id: string;
            source: {
                library: string;
                model: string;
            };
            piece?: string;
            index?: "array" | "preserve" | "identity";
        }[];
        objects?: {
            id: string;
            source: {
                library: string;
                model: string;
            };
            fit: {
                size: number;
                by: "span" | "height";
                floor?: number;
                yaw?: number;
                centre?: "base";
            };
        }[];
        textures?: {
            id: string;
            source: {
                library: string;
                model: string;
            };
            resource?: string;
            bytes?: number;
        }[];
        decorators?: {
            id: string;
            rows: SurfaceLook[];
        }[];
        repeats?: {
            id: string;
            value: [
                number,
                number
            ];
        }[];
    };
    attachments?: {
        id: string;
        row: PrivateScene;
        parent: string;
        resources: {
            geometry: {
                id: string;
                source: {
                    library: string;
                    model: string;
                };
                piece?: string;
                index?: "array" | "preserve" | "identity";
            }[];
            objects?: {
                id: string;
                source: {
                    library: string;
                    model: string;
                };
                fit: {
                    size: number;
                    by: "span" | "height";
                    floor?: number;
                    yaw?: number;
                    centre?: "base";
                };
            }[];
            textures?: {
                id: string;
                source: {
                    library: string;
                    model: string;
                };
                resource?: string;
                bytes?: number;
            }[];
            decorators?: {
                id: string;
                rows: SurfaceLook[];
            }[];
            repeats?: {
                id: string;
                value: [
                    number,
                    number
                ];
            }[];
        };
    }[];
}
interface SourceNpc {
    npc: string;
    definition: {
        model: {
            id: string;
            name: string;
            file: string;
            category: "buildings" | "nature" | "creatures" | "people" | "gear" | "props";
            pipeline: "code" | "blender" | "trellis" | "hunyuan" | "cc0" | ("code" | "blender" | "trellis" | "hunyuan" | "cc0")[];
            rig?: {
                clips: string[];
                species?: string;
            };
        };
        builder: string;
        show?: string[];
        position?: [
            number,
            number,
            number
        ];
        subtractY?: string;
    };
    model: {
        kind: "mesh" | "pivots";
        id: string;
        material?: string;
    };
    library: string;
    materialLibrary?: string;
}
interface SourceScene {
    part: string;
    step: string;
    materialLibrary?: string;
    definition: {
        model: {
            id: string;
            name: string;
            file: string;
            category: "buildings" | "nature" | "creatures" | "people" | "gear" | "props";
            pipeline: "code" | "blender" | "trellis" | "hunyuan" | "cc0" | ("code" | "blender" | "trellis" | "hunyuan" | "cc0")[];
            rig?: {
                clips: string[];
                species?: string;
            };
        };
        builder: string;
        show?: string[];
        position?: [
            number,
            number,
            number
        ];
        subtractY?: string;
    };
    effects?: {
        part: string;
        draws: SceneDrawsRows;
    }[];
}
interface SourceSpecimen {
    model: {
        id: string;
        name: string;
        file: string;
        category: "buildings" | "nature" | "creatures" | "people" | "gear" | "props";
        pipeline: "code" | "blender" | "trellis" | "hunyuan" | "cc0" | ("code" | "blender" | "trellis" | "hunyuan" | "cc0")[];
        rig?: {
            clips: string[];
            species?: string;
        };
    };
    body: string;
    specimen: {
        parts: "first" | "all";
        material: {
            color?: string | number;
            flatShading?: boolean;
            roughness?: number;
            metalness?: number;
            vertexColors?: boolean;
            side?: 0 | 1 | 2;
            transparent?: boolean;
            opacity?: number;
            depthWrite?: boolean;
            fog?: boolean;
            emissive?: string | number;
            emissiveIntensity?: number;
            envMapIntensity?: number;
        };
        scale?: number;
    };
}
