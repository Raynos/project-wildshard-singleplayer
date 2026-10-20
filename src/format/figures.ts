import * as v from 'valibot';
import { HandleIdSchema, ScenePointRefSchema } from './sceneRefs';
import { isJsonData } from './json';
import { SkinClipNameSchema } from './skinData';
import { PackedGeometryRowsSchema } from './geometryPack';
import { KitFigureSchema } from './kitFigure';

const finite = v.pipe(v.number(), v.finite());
/** The authored motion, reach, collider and flame facts, with no runtime defaults. */
export const NpcFigureRowsSchema = v.strictObject({ collider: v.strictObject({ half: finite, top: finite, bottom: finite }),
  talkHeight: finite, drawDistance: finite, shadowDistance: finite, noticeRadius: finite, walk: v.strictObject({ speed: finite, cycle: finite }),
  flame: v.strictObject({ radius: finite, widthSegments: finite, heightSegments: finite, color: v.tuple([finite, finite, finite]) }),
  point: v.strictObject({ period: finite, from: finite, to: finite }), sway: v.strictObject({ breathe: finite, breatheRate: finite, talk: finite, talkRate: finite }) });
export type FigureMotionRow = v.InferOutput<typeof NpcFigureRowsSchema>;

const point = v.tuple([finite, finite, finite]);
const text = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
/** Baked humanoid skin facts. No fitting, executable clips or loader hooks. */
export const FigureSkinSchema = v.strictObject({ url: text, material: text, rest: v.pipe(v.array(point), v.length(21)), height: finite, y0: finite,
  surface: v.strictObject({ name: text, roughness: finite, metalness: finite, normalScale: v.tuple([finite, finite]) }),
  lantern: v.nullable(point), ball: v.tuple([point, point]), walkSpeed: finite, walkCycle: finite,
  webs: v.strictObject({ split: finite, coatOnly: finite }) });
export type FigureSkinRow = v.InferOutput<typeof FigureSkinSchema>;
/** Client-only presentation over a published root or an owned fallback draw. */
export const FigureRowSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Figure requires plain JSON'), v.strictObject({
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
export type FigureRow = v.InferOutput<typeof FigureRowSchema>;

/** Product catalogue: the same rows drive live figures and cold Explorer cards. */
export const FigureCatalogueSchema = v.strictObject({
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
export type FigureCatalogueRow = v.InferOutput<typeof FigureCatalogueSchema>;

/** A merged three-joint figure atlas: one prepared skin whose joints are each figure's root, head and arm, painted from
 *  the original images packed onto a canvas grid in the same cells as its offline UVs. No fitting, fallback or callback. */
export const FigureAtlasSchema = v.strictObject({
  url: text, name: text, skeleton: text,
  columns: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(8)),
  rows: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(8)),
  cell: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(2048)),
  sources: v.pipe(v.array(text), v.minLength(1), v.maxLength(64)),
  joints: v.pipe(v.array(text), v.minLength(1), v.maxLength(128)),
  rim: finite, bands: finite,
});
export type FigureAtlasRow = v.InferOutput<typeof FigureAtlasSchema>;
const tiered = v.strictObject({ phone: FigureAtlasSchema, desktop: FigureAtlasSchema });
const groupPiece = v.strictObject({ id: text, name: text, category: v.literal('people'), file: text, surface: v.literal('flesh') });
/**
 * A group of root/head/arm figures drawn as one merged atlas skin: each figure's frame (its neck and shoulder pivots),
 * its row (FigureRowSchema), an optional orbit it walks while no one is near, and the registry pieces for the still and
 * the moving figures. Its head, face and arm motion are the shard's admitted channel programs, one group per
 * figure id; the group sleeps beyond `sleep.distance` of `sleep.figure`.
 */
export const FigureGroupSchema = v.strictObject({
  name: text, sleep: v.strictObject({ figure: text, distance: finite }), atlas: tiered,
  figures: v.pipe(v.record(text, v.object({
    frame: v.object({ neck: point, shoulder: point }),
    motion: v.object({ orbit: v.exactOptional(v.object({ x: finite, z: finite, radius: finite, speed: finite, stopDistance: finite, lift: finite, frequency: finite })) }),
    phase: finite, glanceAfter: finite, row: v.unknown(), moving: v.boolean(), atlas: tiered,
  })), v.check(rows => Object.keys(rows).length <= 64, 'bounded figure group')),
  pieces: v.strictObject({ still: groupPiece, moving: groupPiece }),
});
export type FigureGroupRows = v.InferOutput<typeof FigureGroupSchema>;
