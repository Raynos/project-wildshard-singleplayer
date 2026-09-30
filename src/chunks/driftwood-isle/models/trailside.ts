/**
 * The trail dressing's models (E306 / E315 M1: models on the contract, src/models/model.ts; they were built inside
 * src/world/Trailside.ts): the rope-fence POST (a thick weathered piling with a rope lashing under its cap), the
 * SIGNPOST (a post with an arrow board per direction, stacked) and the PLANK STEP let into a climb. Flat-shaded vertex
 * colour, per-face jitter from the stream they are handed.
 *
 * Each builds in its own space, its foot at the origin: the trail (src/world/Trailside.ts) builds them in its layout's
 * order from ONE rng stream, between the geometry that is the trail's own (the ropes sagging between the posts, the
 * steps' side rails, the trestle stairs), welds everything into one mesh (one draw, as before) and places each model
 * `drawnInto` it. The posts and signposts collide as the boxes they always had (own space, carried to each placement).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Rng } from '../../../core/rng';
import { defineModel, type ModelContext, type ModelPart } from '../../../models/model';

const C = {
  post: new THREE.Color('#6f5638'), postTop: new THREE.Color('#8a6d48'), rope: new THREE.Color('#d2bd85'),
  plank: new THREE.Color('#a07c53'), plankDark: new THREE.Color('#7d5f3f'), board: new THREE.Color('#b8925f'), boardEdge: new THREE.Color('#6a4e33'),
};
export const TRAIL_COLOURS = C;

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

const one = (ctx: ModelContext, parts: THREE.BufferGeometry[]): ModelPart[] =>
  [{ geometry: parts.length === 1 && parts[0] ? parts[0] : mergeGeometries(parts, false), material: trailMaterial(ctx), castShadow: true, receiveShadow: true }];

export const fencePost = defineModel<Record<string, never>>({
  id: 'driftwood-isle/fence-post', name: 'Fence post', category: 'props', pipeline: 'code',
  file: 'src/chunks/driftwood-isle/models/trailside.ts', surface: 'wood',
  defaults: {},
  seed: 0x5ea1 ^ 0x7a11,
  build: (ctx, _p, rng) => {
    const parts: THREE.BufferGeometry[] = [], add = trailPart(parts, rng);
    const tilt = rng.range(-0.06, 0.06);
    add(new THREE.CylinderGeometry(0.13, 0.16, 1.55, 6).rotateZ(tilt).translate(0, 0.45, 0), C.post, 0.08);
    add(new THREE.CylinderGeometry(0.14, 0.14, 0.07, 6).translate(0, 1.22, 0), C.postTop, 0.04);
    for (let r = 0; r < 3; r++) add(new THREE.CylinderGeometry(0.175, 0.175, 0.07, 6).translate(0, 1.0 - r * 0.08, 0), r === 1 ? C.postTop : C.rope, 0.04);
    return one(ctx, parts);
  },
  // from 1 m under the ground to its cap (the legacy box)
  colliders: () => [{ kind: 'box', x: 0, y: 0.1, z: 0, hx: 0.16, hy: 1.1, hz: 0.16 }],
});

export interface SignpostParams {
  /** the arrow boards, top down: each points this way (radians about +Y, 0 = +z) */
  readonly arrows: readonly number[];
}

export const signpost = defineModel<SignpostParams>({
  id: 'driftwood-isle/signpost', name: 'Signpost', category: 'props', pipeline: 'code',
  file: 'src/chunks/driftwood-isle/models/trailside.ts', surface: 'wood',
  defaults: { arrows: [2.9, 0.6] },
  variants: [{ id: 'two', label: 'Two arrows', params: {} }, { id: 'one', label: 'One arrow', params: { arrows: [1.2] } }, { id: 'three', label: 'Three arrows', params: { arrows: [0.3, 2.2, 4.4] } }],
  seed: 0x5ea1 ^ 0x7a11,
  build: (ctx, p, rng) => {
    const parts: THREE.BufferGeometry[] = [], add = trailPart(parts, rng);
    add(new THREE.CylinderGeometry(0.09, 0.11, 2.4, 6).translate(0, 1.1, 0), C.post, 0.06);
    p.arrows.forEach((toward, i) => {
      const by = 2.1 - i * 0.42;
      // an arrow board: a box with a wedge tip, pointing along `toward`
      const board = new THREE.BoxGeometry(0.9, 0.3, 0.06); board.translate(0.45 + 0.1, 0, 0);
      const tip = new THREE.ConeGeometry(0.19, 0.3, 4); tip.rotateZ(-Math.PI / 2); tip.rotateX(Math.PI / 4); tip.translate(1.15, 0, 0);
      for (const g of [board, tip]) { g.rotateY(toward - Math.PI / 2); g.translate(0, by, 0); add(g, C.board, 0.05); }
      const edge = new THREE.BoxGeometry(0.92, 0.04, 0.08); edge.translate(0.55, -0.16, 0); edge.rotateY(toward - Math.PI / 2); edge.translate(0, by, 0); add(edge, C.boardEdge, 0.04);
    });
    return one(ctx, parts);
  },
  colliders: () => [{ kind: 'box', x: 0, y: 0.7, z: 0, hx: 0.12, hy: 1.7, hz: 0.12 }],
});

export interface PlankStepParams {
  /** width across the climb, metres */
  readonly w: number;
  /** its roll with the ground across it, radians (E118) */
  readonly roll: number;
  /** which way the climb runs, radians about +Y */
  readonly yaw: number;
  readonly dark: boolean;
}

export const plankStep = defineModel<PlankStepParams>({
  id: 'driftwood-isle/plank-step', name: 'Plank step', category: 'props', pipeline: 'code',
  file: 'src/chunks/driftwood-isle/models/trailside.ts', surface: 'wood',
  defaults: { w: 2.4, roll: 0, yaw: 0, dark: false },
  variants: [{ id: 'light', label: 'Light', params: {} }, { id: 'dark', label: 'Dark', params: { dark: true } }],
  seed: 0x5ea1 ^ 0x7a11,
  build: (ctx, p, rng) => {
    const parts: THREE.BufferGeometry[] = [], add = trailPart(parts, rng);
    const g = new THREE.BoxGeometry(p.w, 0.14, 0.42); g.rotateZ(p.roll); g.rotateY(p.yaw); g.translate(0, 0.02, 0);
    add(g, p.dark ? C.plankDark : C.plank, 0.05);
    return one(ctx, parts);
  },
});
