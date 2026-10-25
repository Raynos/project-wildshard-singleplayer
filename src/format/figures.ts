import * as v from 'valibot';
import { HandleIdSchema, ScenePointRefSchema } from './sceneRefs';
import { isJsonData } from './json';
import { SkinClipNameSchema } from './skinData';
import { PackedGeometryRowsSchema } from './geometryPack';
import { KitFigureSchema } from './kitFigure';

const finite = v.pipe(v.number(), v.finite());
/** The authored motion, reach, collider and flame facts, with no runtime defaults. */
export const NpcFigureRowsSchema: v.GenericSchema<FigureMotionRowInput, FigureMotionRow> = v.strictObject({ collider: v.strictObject({ half: finite, top: finite, bottom: finite }),
  talkHeight: finite, drawDistance: finite, shadowDistance: finite, noticeRadius: finite, walk: v.strictObject({ speed: finite, cycle: finite }),
  flame: v.strictObject({ radius: finite, widthSegments: finite, heightSegments: finite, color: v.tuple([finite, finite, finite]) }),
  point: v.strictObject({ period: finite, from: finite, to: finite }), sway: v.strictObject({ breathe: finite, breatheRate: finite, talk: finite, talkRate: finite }) });


const point = v.tuple([finite, finite, finite]);
const text = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
/** Baked humanoid skin facts. No fitting, executable clips or loader hooks. */
export const FigureSkinSchema: v.GenericSchema<FigureSkinRowInput, FigureSkinRow> = v.strictObject({ url: text, material: text, rest: v.pipe(v.array(point), v.length(21)), height: finite, y0: finite,
  surface: v.strictObject({ name: text, roughness: finite, metalness: finite, normalScale: v.tuple([finite, finite]) }),
  lantern: v.nullable(point), ball: v.tuple([point, point]), walkSpeed: finite, walkCycle: finite,
  webs: v.strictObject({ split: finite, coatOnly: finite }) });

/** Client-only presentation over a published root or an owned fallback draw. */
export const FigureRowSchema: v.GenericSchema<FigureRowInput, FigureRow> = v.pipe(v.unknown(), v.check(isJsonData, 'Figure requires plain JSON'), v.strictObject({
  id: HandleIdSchema, name: text, root: v.exactOptional(ScenePointRefSchema),
  fallback: v.exactOptional(v.strictObject({ geometry: text, material: text, glass: v.nullable(text), glow: text })),
  skin: v.exactOptional(FigureSkinSchema), motion: v.exactOptional(NpcFigureRowsSchema),
  feet: point, yaw: finite, talkHeight: finite,
  collider: v.exactOptional(v.union([
    v.strictObject({ kind: v.literal('box'), half: finite, top: finite, bottom: finite }),
    v.strictObject({ kind: v.literal('capsule'), y: finite, halfHeight: finite, radius: finite }),
  ])),
  rig: v.strictObject({ skeleton: text, clips: v.pipe(v.array(SkinClipNameSchema), v.maxLength(32)), sockets: v.pipe(v.array(text), v.maxLength(32)) }),
  joints: v.pipe(v.array(v.union([v.strictObject({ id: HandleIdSchema, source: ScenePointRefSchema }), v.strictObject({ id: HandleIdSchema, bone: text })])), v.maxLength(128)),
  sockets: v.pipe(v.array(v.strictObject({ id: HandleIdSchema, joint: text })), v.maxLength(32)),
  visible: v.pipe(v.array(ScenePointRefSchema), v.maxLength(128)), drawDistance: finite,
  replacement: v.exactOptional(v.strictObject({ target: ScenePointRefSchema, geometry: text })),
  pointAt: point, points: v.boolean(),
}));


/** Product catalogue: the same rows drive live figures and cold Explorer cards. */
export const FigureCatalogueSchema: v.GenericSchema<FigureCatalogueRowInput, FigureCatalogueRow> = v.strictObject({
  pack: v.exactOptional(v.strictObject({ url: text, rows: PackedGeometryRowsSchema })),
  material: v.exactOptional(v.strictObject({ name: text, roughness: v.number(), metalness: v.number() })),
  figures: v.record(text, v.strictObject({
    phone: FigureRowSchema, desktop: FigureRowSchema, body: v.exactOptional(v.number()), glass: v.exactOptional(v.nullable(v.number())),
    kit: v.exactOptional(KitFigureSchema),
    card: v.exactOptional(v.strictObject({ id: text, name: text, file: text,
      pipeline: v.pipe(v.array(v.picklist(['code', 'blender', 'trellis', 'hunyuan', 'cc0'])), v.maxLength(16)),
      rig: v.strictObject({ clips: v.pipe(v.array(text), v.maxLength(32)) }) })),
  })),
});


/** A merged three-joint figure atlas: one prepared skin whose joints are each figure's root, head and arm, painted from
 *  the original images packed onto a canvas grid in the same cells as its offline UVs. No fitting, fallback or callback. */
export const FigureAtlasSchema: v.GenericSchema<FigureAtlasRowInput, FigureAtlasRow> = v.strictObject({
  url: text, name: text, skeleton: text,
  columns: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(8)),
  rows: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(8)),
  cell: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(2048)),
  sources: v.pipe(v.array(text), v.minLength(1), v.maxLength(64)),
  joints: v.pipe(v.array(text), v.minLength(1), v.maxLength(128)),
  rim: finite, bands: finite,
});

const tiered = v.strictObject({ phone: FigureAtlasSchema, desktop: FigureAtlasSchema });
const groupPiece = v.strictObject({ id: text, name: text, category: v.literal('people'), file: text, surface: v.literal('flesh') });
/**
 * A group of root/head/arm figures drawn as one merged atlas skin: each figure's frame (its neck and shoulder pivots),
 * its row (FigureRowSchema), an optional orbit it walks while no one is near, and the registry pieces for the still and
 * the moving figures. Its head, face and arm motion are the shard's admitted channel programs, one group per
 * figure id; the group sleeps beyond `sleep.distance` of `sleep.figure`.
 */
export const FigureGroupSchema: v.GenericSchema<FigureGroupRowsInput, FigureGroupRows> = v.strictObject({
  name: text, sleep: v.strictObject({ figure: text, distance: finite }), atlas: tiered,
  figures: v.pipe(v.record(text, v.object({
    frame: v.object({ neck: point, shoulder: point }),
    motion: v.object({ orbit: v.exactOptional(v.object({ x: finite, z: finite, radius: finite, speed: finite, stopDistance: finite, lift: finite, frequency: finite })) }),
    phase: finite, glanceAfter: finite, row: v.unknown(), moving: v.boolean(), atlas: tiered,
  })), v.check(rows => Object.keys(rows).length <= 64, 'bounded figure group')),
  pieces: v.strictObject({ still: groupPiece, moving: groupPiece }),
});


/** Admitted data contracts, independent of validator implementation metadata. */
export type FigureMotionRowInput = FigureMotionRow;
export interface FigureMotionRow {
    collider: {
        half: number;
        top: number;
        bottom: number;
    };
    talkHeight: number;
    drawDistance: number;
    shadowDistance: number;
    noticeRadius: number;
    walk: {
        speed: number;
        cycle: number;
    };
    flame: {
        radius: number;
        widthSegments: number;
        heightSegments: number;
        color: [
            number,
            number,
            number
        ];
    };
    point: {
        period: number;
        from: number;
        to: number;
    };
    sway: {
        breathe: number;
        breatheRate: number;
        talk: number;
        talkRate: number;
    };
}
export type FigureSkinRowInput = FigureSkinRow;
export interface FigureSkinRow {
    url: string;
    material: string;
    rest: ([
        number,
        number,
        number
    ])[];
    height: number;
    y0: number;
    surface: {
        name: string;
        roughness: number;
        metalness: number;
        normalScale: [
            number,
            number
        ];
    };
    lantern: ([
        number,
        number,
        number
    ]) | null;
    ball: [
        [
            number,
            number,
            number
        ],
        [
            number,
            number,
            number
        ]
    ];
    walkSpeed: number;
    walkCycle: number;
    webs: {
        split: number;
        coatOnly: number;
    };
}
export type FigureRowInput = unknown;
export interface FigureRow {
    id: v.InferOutput<typeof HandleIdSchema>;
    name: string;
    root?: v.InferOutput<typeof ScenePointRefSchema>;
    fallback?: {
        geometry: string;
        material: string;
        glass: (string) | null;
        glow: string;
    };
    skin?: FigureSkinRow;
    motion?: FigureMotionRow;
    feet: [
        number,
        number,
        number
    ];
    yaw: number;
    talkHeight: number;
    collider?: ({
        kind: 'box';
        half: number;
        top: number;
        bottom: number;
    }) | ({
        kind: 'capsule';
        y: number;
        halfHeight: number;
        radius: number;
    });
    rig: {
        skeleton: string;
        clips: (v.InferOutput<typeof SkinClipNameSchema>)[];
        sockets: (string)[];
    };
    joints: (({
        id: v.InferOutput<typeof HandleIdSchema>;
        source: v.InferOutput<typeof ScenePointRefSchema>;
    }) | ({
        id: v.InferOutput<typeof HandleIdSchema>;
        bone: string;
    }))[];
    sockets: ({
        id: v.InferOutput<typeof HandleIdSchema>;
        joint: string;
    })[];
    visible: (v.InferOutput<typeof ScenePointRefSchema>)[];
    drawDistance: number;
    replacement?: {
        target: v.InferOutput<typeof ScenePointRefSchema>;
        geometry: string;
    };
    pointAt: [
        number,
        number,
        number
    ];
    points: boolean;
}
export interface FigureCatalogueRowInput {
    pack?: {
        url: string;
        rows: v.InferInput<typeof PackedGeometryRowsSchema>;
    };
    material?: {
        name: string;
        roughness: number;
        metalness: number;
    };
    figures: Record<string, {
        phone: FigureRowInput;
        desktop: FigureRowInput;
        body?: number;
        glass?: (number) | null;
        kit?: v.InferInput<typeof KitFigureSchema>;
        card?: {
            id: string;
            name: string;
            file: string;
            pipeline: ('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0')[];
            rig: {
                clips: (string)[];
            };
        };
    }>;
}
export interface FigureCatalogueRow {
    pack?: {
        url: string;
        rows: v.InferOutput<typeof PackedGeometryRowsSchema>;
    };
    material?: {
        name: string;
        roughness: number;
        metalness: number;
    };
    figures: Record<string, {
        phone: FigureRow;
        desktop: FigureRow;
        body?: number;
        glass?: (number) | null;
        kit?: v.InferOutput<typeof KitFigureSchema>;
        card?: {
            id: string;
            name: string;
            file: string;
            pipeline: ('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0')[];
            rig: {
                clips: (string)[];
            };
        };
    }>;
}
export type FigureAtlasRowInput = FigureAtlasRow;
export interface FigureAtlasRow {
    url: string;
    name: string;
    skeleton: string;
    columns: number;
    rows: number;
    cell: number;
    sources: (string)[];
    joints: (string)[];
    rim: number;
    bands: number;
}
export interface FigureGroupRowsInput {
    name: string;
    sleep: {
        figure: string;
        distance: number;
    };
    atlas: {
        phone: FigureAtlasRowInput;
        desktop: FigureAtlasRowInput;
    };
    figures: Record<string, {
        frame: {
            neck: [
                number,
                number,
                number
            ];
            shoulder: [
                number,
                number,
                number
            ];
        };
        motion: {
            orbit?: {
                x: number;
                z: number;
                radius: number;
                speed: number;
                stopDistance: number;
                lift: number;
                frequency: number;
            };
        };
        phase: number;
        glanceAfter: number;
        row: unknown;
        moving: boolean;
        atlas: {
            phone: FigureAtlasRowInput;
            desktop: FigureAtlasRowInput;
        };
    }>;
    pieces: {
        still: {
            id: string;
            name: string;
            category: 'people';
            file: string;
            surface: 'flesh';
        };
        moving: {
            id: string;
            name: string;
            category: 'people';
            file: string;
            surface: 'flesh';
        };
    };
}
export interface FigureGroupRows {
    name: string;
    sleep: {
        figure: string;
        distance: number;
    };
    atlas: {
        phone: FigureAtlasRow;
        desktop: FigureAtlasRow;
    };
    figures: Record<string, {
        frame: {
            neck: [
                number,
                number,
                number
            ];
            shoulder: [
                number,
                number,
                number
            ];
        };
        motion: {
            orbit?: {
                x: number;
                z: number;
                radius: number;
                speed: number;
                stopDistance: number;
                lift: number;
                frequency: number;
            };
        };
        phase: number;
        glanceAfter: number;
        row: unknown;
        moving: boolean;
        atlas: {
            phone: FigureAtlasRow;
            desktop: FigureAtlasRow;
        };
    }>;
    pieces: {
        still: {
            id: string;
            name: string;
            category: 'people';
            file: string;
            surface: 'flesh';
        };
        moving: {
            id: string;
            name: string;
            category: 'people';
            file: string;
            surface: 'flesh';
        };
    };
}
