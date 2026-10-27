import * as THREE from 'three';
import { trailFontFacts } from './trailFont';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rng } from '@wildshard/sdk/random';
import { modelContext, seedOf, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import publicInputs from '../data/publicInputs.json' with { type: 'json' };
import trailRows from '../data/trailCatalogue.json' with { type: 'json' };


/**
 * The trail dressing's models (E306 / E315 M1: models on the contract, src/engine/models/model.ts; they were built inside
 * src/shards/driftwood-isle/world/Trailside.ts): the rope-fence POST (a thick weathered piling with a rope lashing under its cap), the
 * SIGNPOST (a post with an arrow board per direction, stacked, each lettered with the place it points to — E318) and the
 * PLANK STEP let into a climb. Flat-shaded vertex colour, per-face jitter from the stream they are handed.
 *
 * Each builds in its own space, its foot at the origin: the trail (src/shards/driftwood-isle/world/Trailside.ts) builds them in its layout's
 * order from ONE rng stream, between the geometry that is the trail's own (the ropes sagging between the posts, the
 * steps' side rails, the trestle stairs), welds everything into one mesh (one draw, as before) and places each model
 * `drawnInto` it. The posts and signposts collide as the boxes they always had (own space, carried to each placement).
 */

const C = {
  post: new THREE.Color('#6f5638'), postTop: new THREE.Color('#8a6d48'), rope: new THREE.Color('#d2bd85'),
  plank: new THREE.Color('#a07c53'), plankDark: new THREE.Color('#7d5f3f'), board: new THREE.Color('#b8925f'), boardEdge: new THREE.Color('#6a4e33'),
  letter: new THREE.Color('#3b2716'),
};
export const TRAIL_COLOURS: { post: THREE.Color; postTop: THREE.Color; rope: THREE.Color; plank: THREE.Color; plankDark: THREE.Color; board: THREE.Color; boardEdge: THREE.Color; letter: THREE.Color; } = C;

/** the trail's one material (the dressing and the trail's own geometry share it: one draw) */
export function trailMaterial(ctx: ModelContext): THREE.MeshStandardMaterial {
  return ctx.once('driftwood-isle/trail:material', () => {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88, metalness: 0, side: THREE.DoubleSide });
    ctx.sky.setupMaterial(mat);
    return mat;
  });
}

/** paint a part one colour (per-face jitter from the stream) and keep it: the trail's own `add` */
export function trailPart(parts: THREE.BufferGeometry[], rng: Rng): (g: THREE.BufferGeometry, col: THREE.Color, jitter?: number) => void {
  return (g, col, jitter = 0.06) => {
    g.deleteAttribute('uv'); g.deleteAttribute('normal');
    const ni = g.index ? g.toNonIndexed() : g;
    const n = ni.getAttribute('position').count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 3) { const k = 1 - jitter + rng.next() * jitter * 2; for (let j = 0; j < 3; j++) { c[(i + j) * 3] = col.r * k; c[(i + j) * 3 + 1] = col.g * k; c[(i + j) * 3 + 2] = col.b * k; } }
    ni.setAttribute('color', new THREE.BufferAttribute(c, 3));
    parts.push(ni);
  };
}

/** A trail specimen's build: its parts in own space, from the params and the stream it is handed. */
export type TrailBuild<P extends object> = (ctx: ModelContext, params: P, rng: Rng) => readonly ModelPart[];

const one = (ctx: ModelContext, parts: THREE.BufferGeometry[]): ModelPart[] =>
  [{ geometry: parts.length === 1 && parts[0] ? parts[0] : mergeGeometries(parts, false), material: trailMaterial(ctx), castShadow: true, receiveShadow: true }];

/** The fence post's build (the trail's runtime model is the specimen catalogue's row with it, trailside.ts). D76: the
 *  builds live apart from the catalogue, so the product's author bundle reaches no game runtime through the bank. */
export const buildFencePost: TrailBuild<Record<string, never>> = (ctx, _p, rng) => {
  const parts: THREE.BufferGeometry[] = [], add = trailPart(parts, rng);
  const tilt = rng.range(-0.06, 0.06);
  add(new THREE.CylinderGeometry(0.13, 0.16, 1.55, 6).rotateZ(tilt).translate(0, 0.45, 0), C.post, 0.08);
  add(new THREE.CylinderGeometry(0.14, 0.14, 0.07, 6).translate(0, 1.22, 0), C.postTop, 0.04);
  for (let r = 0; r < 3; r++) add(new THREE.CylinderGeometry(0.175, 0.175, 0.07, 6).translate(0, 1.0 - r * 0.08, 0), r === 1 ? C.postTop : C.rope, 0.04);
  return one(ctx, parts);
};

export interface SignpostParams {
  /** the arrow boards, top down: each points this way (radians about +Y, 0 = +z: world (sin, cos)) */
  readonly arrows: readonly number[];
  /** each board's lettering, top down (E318: Jake, "letter them" — a blank board is a placeholder); '' or none = blank */
  readonly labels?: readonly string[];
}

/** Build-time font runs; unsupported characters remain blank cells. */
const FONT: Readonly<Record<string, readonly { start: number; end: number; row: number }[]>> = trailFontFacts();
/** one font cell, metres: letters 0.18 m tall on a 0.3 m board (readable from ~10 m on a phone) */
const CELL = 0.026;
const textWidth = (text: string): number => Math.max(0, text.length * 6 - 1) * CELL;

/** the lettering's quads on one face (`side` +1: the board's +z face, reading left → right from the post; −1: the back,
 *  laid mirrored so it reads left → right from there too), centred on `cx`, in the board's own frame */
function lettering(text: string, cx: number, side: 1 | -1): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [], w = textWidth(text), x0 = cx - (side * w) / 2, z = side * 0.034;
  for (const [k, ch] of text.toUpperCase().split('').entries()) for (const run of FONT[ch] ?? []) {
    const a = (k * 6 + run.start) * CELL, b = (k * 6 + run.end) * CELL, y = (3.5 - run.row) * CELL - CELL / 2;
    const q = new THREE.PlaneGeometry(b - a, CELL);
    if (side < 0) q.rotateY(Math.PI);
    q.translate(x0 + side * (a + b) / 2, y, z);
    out.push(q);
  }
  return out;
}

/** The signpost's build. */
export const buildSignpost: TrailBuild<SignpostParams> = (ctx, p, rng) => {
    const parts: THREE.BufferGeometry[] = [], add = trailPart(parts, rng);
    add(new THREE.CylinderGeometry(0.09, 0.11, 2.4, 6).translate(0, 1.1, 0), C.post, 0.06);
    p.arrows.forEach((toward, i) => {
      const by = 2.1 - i * 0.42, text = p.labels?.[i] ?? '';
      // an arrow board: a box with a wedge tip, pointing along `toward`; as long as its lettering needs (0.9 m at least)
      const len = Math.max(0.9, textWidth(text) + 0.24);
      const board = new THREE.BoxGeometry(len, 0.3, 0.06); board.translate(len / 2 + 0.1, 0, 0);
      const tip = new THREE.ConeGeometry(0.19, 0.3, 4); tip.rotateZ(-Math.PI / 2); tip.rotateX(Math.PI / 4); tip.translate(len + 0.25, 0, 0);
      for (const g of [board, tip]) { g.rotateY(toward - Math.PI / 2); g.translate(0, by, 0); add(g, C.board, 0.05); }
      const edge = new THREE.BoxGeometry(len + 0.02, 0.04, 0.08); edge.translate(len / 2 + 0.1, -0.16, 0); edge.rotateY(toward - Math.PI / 2); edge.translate(0, by, 0); add(edge, C.boardEdge, 0.04);
      // the place's name, burnt dark into both faces
      for (const side of [1, -1] as const) for (const g of lettering(text, len / 2 + 0.1, side)) { g.rotateY(toward - Math.PI / 2); g.translate(0, by, 0); add(g, C.letter, 0.03); }
    });
    return one(ctx, parts);
};

export interface PlankStepParams {
  /** width across the climb, metres */
  readonly w: number;
  /** its roll with the ground across it, radians (E118) */
  readonly roll: number;
  /** which way the climb runs, radians about +Y */
  readonly yaw: number;
  readonly dark: boolean;
}

/** The plank step's build. */
export const buildPlankStep: TrailBuild<PlankStepParams> = (ctx, p, rng) => {
  const parts: THREE.BufferGeometry[] = [], add = trailPart(parts, rng);
  const g = new THREE.BoxGeometry(p.w, 0.14, 0.42); g.rotateZ(p.roll); g.rotateY(p.yaw); g.translate(0, 0.02, 0);
  add(g, p.dark ? C.plankDark : C.plank, 0.05);
  return one(ctx, parts);
};

/** The trail specimens' Explorer GLBs (GR7: the `driftwood-trail-specimens` job's hash-named public copies): each fence post,
 *  signpost and plank-step variant's one native draw by product name, and the public URL each had (trailCatalogue.json's
 *  variant URLs, trailSpecimens.ts) mapped to that name. */
export interface TrailSpecimenBank { readonly glbs: ReadonlyMap<string, Uint8Array>; readonly byUrl: Readonly<Record<string, string>> }
const isParts = (built: unknown): built is readonly ModelPart[] => Array.isArray(built);
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null && !Array.isArray(value);
const numbers = (value: unknown): value is readonly number[] => Array.isArray(value) && (value as readonly unknown[]).every(item => typeof item === 'number');
const strings = (value: unknown): value is readonly string[] => Array.isArray(value) && (value as readonly unknown[]).every(item => typeof item === 'string');
/** A signpost row's params, checked (the catalogue JSON types its rows loosely). */
function signpostParams(value: unknown): SignpostParams {
  const arrows = isRecord(value) ? value['arrows'] : undefined, labels = isRecord(value) ? value['labels'] : undefined;
  if (!numbers(arrows) || (labels !== undefined && !strings(labels))) throw new Error('Invalid signpost catalogue params');
  return labels === undefined ? { arrows } : { arrows, labels };
}
/** A plank step row's params, checked. */
function plankStepParams(value: unknown): PlankStepParams {
  const row = isRecord(value) ? value : {}, { w, roll, yaw, dark } = row;
  if (typeof w !== 'number' || typeof roll !== 'number' || typeof yaw !== 'number' || typeof dark !== 'boolean') throw new Error('Invalid plank step catalogue params');
  return { w, roll, yaw, dark };
}
let trailSpecimens: TrailSpecimenBank | undefined;
/** Built once per build process (no file is read); every reader treats it as read-only. */
export function trailSpecimenBank(): TrailSpecimenBank { trailSpecimens ??= buildTrailSpecimens(); return trailSpecimens; }
function buildTrailSpecimens(): TrailSpecimenBank {
  const ctx = modelContext(null), material = new THREE.MeshStandardMaterial(), glbs = new Map<string, Uint8Array>(), byUrl: Record<string, string> = {};
  ctx.once('driftwood-isle/trail:material', () => material);
  // each specimen's catalogue row (trailCatalogue.json: the id, seed, defaults and variants its runtime model carries)
  const add = <P extends object>(key: string, build: TrailBuild<P>, params: (value: unknown) => P): void => {
    const model = trailRows.find(row => row.key === key)?.model;
    if (model === undefined) throw new Error(`Missing trail catalogue row: ${key}`);
    const variants: readonly { readonly id: string; readonly params: object }[] = 'variants' in model ? model.variants : [{ id: 'fencePost', params: {} }];
    for (const variant of variants) {
      const parts = build(ctx, params({ ...model.defaults, ...variant.params }), new Rng(seedOf(model)));
      const part = isParts(parts) && parts.length === 1 ? parts[0] : undefined;
      if (part === undefined) throw new Error('Trail specimen needs one native draw');
      const bytes = staticGlb([{ geometry: part.geometry, material, compactIndex: true }], model.id), name = `models/trail/${variant.id}.glb`;
      glbs.set(name, bytes); byUrl[`${publicInputs.baked}trail-${hashImmutableBytes(bytes)}.glb`] = name; part.geometry.dispose();
    }
  };
  try { add('fencePost', buildFencePost, () => ({})); add('signpost', buildSignpost, signpostParams); add('plankStep', buildPlankStep, plankStepParams); } finally { material.dispose(); }
  return { glbs, byUrl };
}
