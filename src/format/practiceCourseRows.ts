/** Build-only course admission. Native lifecycle and controllers remain counted. */
import * as v from 'valibot';
import { ReturnProgramSchema } from './namedJsonContracts';
import { isJsonData } from './json';

const n = v.pipe(v.number(), v.finite(), v.minValue(-10000), v.maxValue(10000));
const text = v.pipe(v.string(), v.maxLength(256));
const xyz = v.tuple([n, n, n]);
const positive = v.pipe(n, v.minValue(0.001));
const size = v.tuple([positive, positive, positive]);
const tone = v.picklist(['grey', 'orange', 'dark', 'light', 'sand', 'field']);
const box = v.strictObject({ kind: v.literal('box'), tone, at: xyz, size, tint: n });
const plane = v.strictObject({ kind: v.literal('plane'), tone, at: xyz, size: v.tuple([positive, positive]) });
const wall = v.strictObject({ kind: v.literal('wall'), tone, at: xyz, size: v.tuple([positive, positive]), face: v.picklist(['px', 'nx', 'pz', 'nz']) });
const label = v.strictObject({ kind: v.literal('label'), text, width: n, at: xyz, yaw: n,
  color: v.exactOptional(text), back: v.exactOptional(text), standing: v.exactOptional(v.boolean()) });
const checker = v.strictObject({ kind: v.literal('checker'), at: xyz, length: n });
const mesh = v.pipe(v.strictObject({ kind: v.literal('mesh'), at: xyz, rotation: xyz, name: text,
  position: v.pipe(v.array(n), v.maxLength(200000)), uv: v.exactOptional(v.pipe(v.array(n), v.maxLength(140000))),
  color: v.exactOptional(v.pipe(v.array(n), v.maxLength(200000))), index: v.exactOptional(v.pipe(v.array(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(100000))), v.maxLength(300000))),
  material: v.strictObject({ color: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffffff)), tone: v.exactOptional(tone), side: v.picklist([0, 1, 2]),
    toneMapped: v.boolean(), polygonOffset: v.boolean(), polygonOffsetFactor: n }) }),
  v.check(row => row.position.length > 0 && row.position.length % 3 === 0
    && (row.uv === undefined || row.uv.length * 3 === row.position.length * 2)
    && (row.color === undefined || row.color.length === row.position.length)
    && (row.index === undefined || row.index.length % 3 === 0 && row.index.every(index => index < row.position.length / 3)), 'Complete triangle attributes and indices'));
const rect = { x0: n, z0: n, x1: n, z1: n };
const shape = v.variant('kind', [
  v.strictObject({ kind: v.literal('rect'), ...rect, fill: v.exactOptional(text), stroke: v.exactOptional(text) }),
  v.strictObject({ kind: v.literal('path'), pts: v.pipe(v.array(v.tuple([n, n])), v.maxLength(2048)), width: n, color: text, closed: v.exactOptional(v.boolean()) }),
  v.strictObject({ kind: v.literal('dot'), x: n, z: n, r: n, color: text }),
  v.strictObject({ kind: v.literal('grid'), ...rect, step: n, color: text }),
  v.strictObject({ kind: v.literal('label'), x: n, z: n, text, color: text }),
]);
/** Client-only practice presentation: local developer primitives, baked meshes, colliders and a room map. */
export const PracticeSceneSchema = v.strictObject({
  parts: v.pipe(v.array(v.variant('kind', [box, plane, wall, label, checker, mesh])), v.maxLength(2048)),
  colliders: v.pipe(v.array(v.strictObject({ kind: v.literal('box'), x: n, y: n, z: n, hx: n, hy: n, hz: n,
    surface: v.exactOptional(v.picklist(['ground', 'wood', 'metal'])) })), v.maxLength(2048)),
  map: v.strictObject({ bounds: v.strictObject(rect), shapes: v.pipe(v.array(shape), v.maxLength(2048)) }),
});
export type PracticeScene = v.InferOutput<typeof PracticeSceneSchema>;
/** Reject malformed or unbounded scene data before allocating client geometry. */
export function parsePracticeScene(value: unknown): PracticeScene { return v.parse(PracticeSceneSchema, value); }

/** Client-only mounted practice. The guest owns laps; rows own the room and labels. */
export const RidingPracticeSchema = v.strictObject({
  presentation: PracticeSceneSchema, road: v.pipe(v.array(v.tuple([n,n])), v.minLength(2), v.maxLength(2048)),
  fieldAt: v.strictObject({x:n,z:n}), horseStart: v.strictObject({x:n,z:n,yaw:n}), riderStart: v.strictObject({x:n,z:n}),
  oval: v.strictObject({halfLen:positive,radius:positive,width:positive}), lineX:n,
  title:text, chip:text, piece:v.strictObject({id:text,name:text,file:text}),
  actor:v.strictObject({kind:text,variant:text,name:text}), riderPitch:n, shoulder:n,
  program:ReturnProgramSchema, sampleEpsilon:v.picklist([0,1e-9]),
  words:v.strictObject({ready:text,ride:text,lap:text,half:text,last:text,best:text,fell:text,lapNotice:text,halfNotice:text}),
});
export type RidingPracticeLayout = v.InferOutput<typeof RidingPracticeSchema>;
/** Refuse incomplete room and run rows before constructing the native presentation. */
export function parseRidingPractice(input:unknown):RidingPracticeLayout {
  if(!isJsonData(input))throw new Error('Practice rows require JSON data');
  return v.parse(RidingPracticeSchema,input);
}
/** Pad, hook and run declarations used by the build-time layout and the live traversal adapter. */
export interface HookPracticeRow {
  id: string; title: string; chip: string;
  piece: { id: string; name: string; file: string; surface: string };
  room: { x0: number; x1: number; z0: number; z1: number; height: number };
  ringUp: number; ringOut: number; fallY: number; slab: number;
  pads: { id: string; label: string; x: number; z: number; w: number; d: number; top: number; kind: string; next?: string }[];
  column: { x: number; z: number; w: number; d: number };
  hooks: { pad: string; edge: string; along?: number }[];
  run: { from: string; to: string; goals: number };
  words: { ready: string; finish: string; running: string; between: string; done: string; best: string; fell: string };
  look: { ceiling: number; ring: number; mast: number; paint: number; label: string; startLabel: string; finishLabel: string;
    map: { floor: string; grid: string; wall: string; column: string; lit: string; pad: string; finish: string; hook: string; label: string } };
}
/** Offline traversal-room presentation and the run's data. */
export interface HookPracticeLayout {
  program: unknown; sampleEpsilon: number; frame: Readonly<Record<string, number>>; presentation: PracticeScene; hooks: { pad: string; x: number; y: number; z: number }[]; course: HookPracticeRow;
}
