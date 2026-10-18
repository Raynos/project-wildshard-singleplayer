import * as v from 'valibot';
import { HandleIdSchema, ScenePointRefSchema } from './sceneRefs';
import { isJsonData } from './json';
import { SkinClipNameSchema } from './skinData';
import { PackedGeometryRowsSchema } from './geometryPack';

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
    card: v.exactOptional(v.strictObject({ id: text, name: text, file: text,
      pipeline: v.pipe(v.array(v.picklist(['code', 'blender', 'trellis', 'hunyuan', 'cc0'])), v.maxLength(16)),
      rig: v.strictObject({ clips: v.pipe(v.array(text), v.maxLength(32)) }) })),
  })),
});
export type FigureCatalogueRow = v.InferOutput<typeof FigureCatalogueSchema>;
